/**
 * WebAttacksPage : le verdict (payload, défenses, profondeur, couverture) vient du modèle pur
 * `algorithms/web-attacks-model.js` (relecture 3b, AW-I2, AW-I3, AW-I4) ; ici, l'affichage et l'animation
 * de la chaîne d'attaque.
 */
class WebAttacksPage extends ConceptPage {
    static PRESETS = {
        'xss-reflected': [
            ['<script>alert(1)</script>', 'Balise script'],
            ['<img src=x onerror="alert(1)">', 'Image avec onerror'],
            ['bonjour tout le monde', 'Texte ordinaire (sans effet)']
        ],
        'xss-stored': [
            ['<img src=x onerror="fetch(\'/vol\')" />', 'Image avec onerror'],
            ['<script>alert(1)</script>', 'Balise script'],
            ['un commentaire sympa', 'Texte ordinaire (sans effet)']
        ],
        sqli: [
            ["' OR 1=1 --", 'Condition toujours vraie'],
            ["x'; DROP TABLE users; --", 'Requête empilée'],
            ['martin', 'Valeur ordinaire (sans effet)']
        ],
        csrf: [
            ['<form method="POST" action="https://banque.example/virement">...</form>', 'Formulaire POST'],
            ['<a href="https://banque.example/virement?to=M&amount=900">Gagne un cadeau</a>', 'Lien GET (navigation)'],
            ['<img src="https://banque.example/virement?to=M&amount=900">', 'Image GET (ressource)'],
            ['bonjour', 'Texte ordinaire (sans effet)']
        ]
    };

    constructor(dataPath) {
        super(dataPath);
        this.speedCtrl = null;
        this.chainRunId = 0;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.bindEvents();
        this.fillPresets();
        this.runSelectedAttack();
    }

    cacheDom() {
        this.attackType = document.getElementById('attack-type');
        this.payload = document.getElementById('attack-payload');
        this.preset = document.getElementById('attack-preset');
        this.runBtn = document.getElementById('attack-run');
        this.resetBtn = document.getElementById('attack-reset');

        this.defValidation = document.getElementById('def-validation');
        this.defOutputEncoding = document.getElementById('def-output-encoding');
        this.defCsp = document.getElementById('def-csp');
        this.defPrepared = document.getElementById('def-prepared');
        this.defCsrfToken = document.getElementById('def-csrf-token');
        this.defSameSite = document.getElementById('def-samesite');

        this.resultBadge = document.getElementById('attack-result-badge');
        this.resultText = document.getElementById('attack-result-text');
        this.feedback = document.getElementById('attack-feedback');
        this.flow = document.getElementById('attack-flow');
        this.riskScore = document.getElementById('attack-risk-score');
        this.riskProgress = document.getElementById('attack-risk-progress');
        this.matrixBody = document.getElementById('attack-matrix-body');

        this.chain = document.getElementById('attack-chain');
        this.chainToken = document.getElementById('attack-token');
        this.chainCaption = document.getElementById('attack-chain-caption');
        this.chainNodes = Array.from(this.chain.querySelectorAll('.attack-chain-node'));
        this.chainNodeByKey = {};
        this.chainNodes.forEach((node) => {
            this.chainNodeByKey[node.dataset.node] = node;
        });

        this.defenseImpact = document.getElementById('attack-defense-impact');
        this.postureCards = document.getElementById('attack-posture-cards');
    }

    bindEvents() {
        this.runBtn.addEventListener('click', () => this.runSelectedAttack());
        this.resetBtn.addEventListener('click', () => this.resetDefenses());
        this.attackType.addEventListener('change', () => {
            this.fillPresets();
            this.runSelectedAttack();
        });
        this.preset.addEventListener('change', () => {
            this.payload.value = this.preset.value;
            this.runSelectedAttack();
        });
        this.payload.addEventListener('input', () => this.runSelectedAttack());
        [this.defValidation, this.defOutputEncoding, this.defCsp, this.defPrepared, this.defCsrfToken, this.defSameSite].forEach((el) => {
            el.addEventListener('change', () => this.runSelectedAttack());
        });
    }

    fillPresets() {
        const list = WebAttacksPage.PRESETS[this.attackType.value] || [];
        this.preset.innerHTML = '';
        list.forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            this.preset.appendChild(opt);
        });
        this.payload.value = list.length ? list[0][0] : '';
    }

    resetDefenses() {
        [this.defValidation, this.defOutputEncoding, this.defCsp, this.defPrepared, this.defCsrfToken].forEach((el) => { el.checked = false; });
        this.defSameSite.value = 'none';
        this.setFeedback('Défenses retirées : active-en une seule, lance l\'attaque, puis ajoute-en une deuxième pour comparer.', 'warning');
        this.runSelectedAttack();
    }

    setFeedback(message, type) {
        this.feedback.className = `feedback ${type || ''}`;
        this.feedback.textContent = message;
    }

    sleep(ms) {
        if (typeof OEIUtils !== 'undefined' && typeof OEIUtils.sleep === 'function') {
            return OEIUtils.sleep(ms);
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    chainStepDelay() {
        return Math.max(140, Math.round(this.currentDelay() * 0.55));
    }

    readDefenses() {
        return {
            validation: Boolean(this.defValidation.checked),
            outputEncoding: Boolean(this.defOutputEncoding.checked),
            csp: Boolean(this.defCsp.checked),
            prepared: Boolean(this.defPrepared.checked),
            csrfToken: Boolean(this.defCsrfToken.checked),
            sameSite: this.defSameSite.value
        };
    }

    renderSelectedResult(attackType, verdict) {
        const attackLabel = (OEITrace.WEB_ATTACKS.find((entry) => entry.id === attackType) || {}).label || attackType;
        if (verdict.ineffective) {
            this.resultBadge.className = 'mod-status info';
            this.resultBadge.textContent = 'Sans effet';
            this.resultText.textContent = `${attackLabel} : ${verdict.reason}`;
        } else if (verdict.blocked) {
            this.resultBadge.className = 'mod-status ok';
            this.resultBadge.textContent = verdict.depth === 'deep' ? 'Bloquée, en profondeur' : 'Bloquée, une seule couche';
            this.resultText.textContent = `${attackLabel} : ${verdict.depthLabel}`;
        } else {
            this.resultBadge.className = 'mod-status bad';
            this.resultBadge.textContent = 'Attaque réussie';
            this.resultText.textContent = `${attackLabel} : la chaîne d'attaque reste exploitable.`;
        }
        this.flow.innerHTML = '';
        verdict.timeline.forEach((step, index) => {
            const li = document.createElement('li');
            const last = index === verdict.timeline.length - 1;
            const kind = verdict.ineffective ? 'info' : (verdict.blocked ? (last ? 'ok' : 'info') : (last ? 'bad' : 'warn'));
            li.className = `mod-log-item ${kind}`;
            li.textContent = step;
            this.flow.appendChild(li);
        });
    }

    renderDefenseImpact(verdict) {
        this.defenseImpact.innerHTML = '';
        verdict.defenseImpact.forEach((entry) => {
            const state = entry.active ? (entry.blocks ? 'blocks' : 'active') : 'inactive';
            const stateLabel = entry.active ? (entry.blocks ? 'Bloque ici' : 'Active') : 'Inactive';
            const li = document.createElement('li');
            li.className = `attack-impact-item ${entry.role} ${state}`;
            const head = document.createElement('div');
            head.className = 'head';
            const label = document.createElement('span');
            label.className = 'label';
            label.textContent = entry.label;
            const st = document.createElement('span');
            st.className = 'state';
            st.textContent = stateLabel;
            head.append(label, st);
            const hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = entry.hint;
            li.append(head, hint);
            this.defenseImpact.appendChild(li);
        });
    }

    renderMatrix(defenses) {
        const { rows, risk } = OEITrace.webAttackMatrix(defenses);
        this.riskScore.textContent = `${risk} %`;
        this.riskProgress.value = risk;
        const statusOf = (row) => (row.blocked ? (row.depth === 'deep' ? 'Protégée en profondeur' : 'Protégée, une seule couche') : 'Vulnérable');
        this.matrixBody.innerHTML = '';
        rows.forEach((row) => {
            const tr = document.createElement('tr');
            const cls = row.blocked ? 'status-ok' : (row.severity === 'critical' ? 'status-bad' : 'status-warn');
            [[row.label, ''], [statusOf(row), cls], [row.signal, '']].forEach(([text, c]) => {
                const td = document.createElement('td');
                td.textContent = text;
                if (c) td.className = c;
                tr.appendChild(td);
            });
            this.matrixBody.appendChild(tr);
        });
        this.postureCards.innerHTML = '';
        rows.forEach((row) => {
            const card = document.createElement('div');
            card.className = `attack-posture-card ${row.blocked ? 'ok' : 'bad'}`;
            const title = document.createElement('div');
            title.className = 'title';
            title.textContent = row.label;
            const state = document.createElement('div');
            state.className = 'state';
            state.textContent = statusOf(row);
            card.append(title, state);
            this.postureCards.appendChild(card);
        });
        return risk;
    }

    resetChainState(path) {
        this.chainNodes.forEach((node) => {
            const key = node.dataset.node;
            node.classList.remove('active', 'passed', 'blocked', 'dim');
            if (!path.includes(key)) {
                node.classList.add('dim');
            }
        });
    }

    positionToken(nodeKey) {
        const node = this.chainNodeByKey[nodeKey];
        if (!node) return;
        const chainRect = this.chain.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const x = nodeRect.left - chainRect.left + (nodeRect.width / 2);
        const y = Math.max(4, nodeRect.top - chainRect.top - 26);
        this.chainToken.style.left = `${x}px`;
        this.chainToken.style.top = `${y}px`;
    }

    async playChain(verdict) {
        const runId = ++this.chainRunId;
        const path = verdict.path || [];
        const reached = verdict.reachedNode;

        this.resetChainState(path);
        this.chainToken.classList.remove('hidden');

        for (let i = 0; i < path.length; i += 1) {
            if (runId !== this.chainRunId) return;
            const key = path[i];
            const node = this.chainNodeByKey[key];
            if (!node) continue;

            this.positionToken(key);
            node.classList.add('active');
            await this.sleep(this.chainStepDelay());

            node.classList.remove('active');
            if (key === reached) {
                node.classList.add(verdict.blocked ? 'blocked' : 'passed');
                break;
            }
            node.classList.add('passed');
        }

        if (runId !== this.chainRunId) return;
        this.chainCaption.textContent = verdict.chainSummary;
    }

    async runSelectedAttack() {
        const attackType = this.attackType.value;
        const defenses = this.readDefenses();
        const verdict = OEITrace.webAttackEvaluate(attackType, defenses, this.payload.value);

        this.renderSelectedResult(attackType, verdict);
        this.renderDefenseImpact(verdict);
        const risk = this.renderMatrix(defenses);

        if (verdict.ineffective) {
            this.setFeedback('Ce texte n\'est pas une charge de ce type : aucune défense n\'est en cause.', 'warning');
        } else if (verdict.blocked && verdict.depth === 'single') {
            this.setFeedback('Bloquée, mais une seule défense te protège : ajoute-en une deuxième.', 'warning');
        } else if (verdict.blocked) {
            this.setFeedback('Plusieurs couches interrompent la chaîne avant l\'impact final.', 'ok');
        } else if (risk >= 75) {
            this.setFeedback('Risque élevé : des défenses critiques manquent.', 'bad');
        } else {
            this.setFeedback('Ce scénario reste exploitable : renforce les contrôles critiques.', 'warning');
        }

        await this.playChain(verdict);
    }
}

if (typeof window !== 'undefined') {
    window.WebAttacksPage = WebAttacksPage;
}
