class WebAttacksPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);

        this.payloadByType = {
            'xss-reflected': '<script>alert(1)</script>',
            'xss-stored': '<img src=x onerror="fetch(`/steal`)" />',
            sqli: "' OR 1=1 --",
            csrf: '<form action="/transfer" method="POST">...</form>'
        };

        this.attackCatalog = [
            { id: 'xss-reflected', label: 'XSS reflechie' },
            { id: 'xss-stored', label: 'XSS stockee' },
            { id: 'sqli', label: 'SQL injection' },
            { id: 'csrf', label: 'CSRF' }
        ];

        this.speedCtrl = null;
        this.chainRunId = 0;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.bindEvents();
        this.bootstrapDefaults();
        this.runSelectedAttack();
    }

    cacheDom() {
        this.attackType = document.getElementById('attack-type');
        this.payload = document.getElementById('attack-payload');
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
            const selected = this.attackType.value;
            this.payload.value = this.payloadByType[selected] || '';
            this.runSelectedAttack();
        });

        [
            this.defValidation,
            this.defOutputEncoding,
            this.defCsp,
            this.defPrepared,
            this.defCsrfToken,
            this.defSameSite
        ].forEach((checkbox) => {
            checkbox.addEventListener('change', () => this.runSelectedAttack());
        });
    }

    bootstrapDefaults() {
        this.payload.value = this.payloadByType[this.attackType.value] || '';
        this.defValidation.checked = true;
    }

    resetDefenses() {
        this.defValidation.checked = true;
        this.defOutputEncoding.checked = false;
        this.defCsp.checked = false;
        this.defPrepared.checked = false;
        this.defCsrfToken.checked = false;
        this.defSameSite.checked = false;
        this.setFeedback('Defenses remises en configuration minimale.', 'warning');
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

    readableNode(key) {
        if (key === 'attacker') return 'Attaquant';
        if (key === 'browser') return 'Navigateur victime';
        if (key === 'app') return 'Application web';
        if (key === 'db') return 'Base SQL';
        if (key === 'action') return 'Action sensible';
        return key;
    }

    readDefenses() {
        return {
            validation: Boolean(this.defValidation.checked),
            outputEncoding: Boolean(this.defOutputEncoding.checked),
            csp: Boolean(this.defCsp.checked),
            prepared: Boolean(this.defPrepared.checked),
            csrfToken: Boolean(this.defCsrfToken.checked),
            sameSite: Boolean(this.defSameSite.checked)
        };
    }

    defenseRows(defenses, blueprint, blockedBy) {
        return blueprint.map((entry) => {
            const active = Boolean(defenses[entry.key]);
            const blocks = blockedBy.includes(entry.key);
            return {
                ...entry,
                active,
                blocks
            };
        });
    }

    evaluateAttack(type, defenses) {
        if (type === 'xss-reflected') {
            const blockedBy = [];
            if (defenses.outputEncoding) blockedBy.push('outputEncoding');
            if (defenses.csp) blockedBy.push('csp');

            const blocked = blockedBy.length > 0;
            const reachedNode = blocked
                ? (defenses.outputEncoding ? 'app' : 'browser')
                : 'action';

            return {
                blocked,
                severity: blocked ? 'low' : 'critical',
                signal: blocked
                    ? 'Le script injecte est neutralise avant execution.'
                    : 'Le navigateur execute le script injecte.',
                timeline: [
                    'Payload injecte dans la requete utilisateur.',
                    defenses.validation
                        ? 'Validation active: reduction partielle du bruit d entree.'
                        : 'Aucune validation d entree cote serveur.',
                    blocked
                        ? 'Encodage/CSP bloque l execution JavaScript.'
                        : 'Le payload est renvoye et execute chez la victime.'
                ],
                path: ['attacker', 'app', 'browser', 'action'],
                reachedNode,
                chainSummary: blocked
                    ? `Arret sur ${this.readableNode(reachedNode)} grace a ${blockedBy.join(' + ')}.`
                    : 'La chaine atteint une action sensible cote victime.',
                defenseImpact: this.defenseRows(defenses, [
                    { key: 'validation', label: 'Validation entree', role: 'support', hint: 'Reduit la surface mais ne suffit pas seule.' },
                    { key: 'outputEncoding', label: 'Encodage sortie', role: 'critical', hint: 'Neutralise les balises/scripts au rendu.' },
                    { key: 'csp', label: 'CSP stricte', role: 'critical', hint: 'Bloque l execution inline et domaines non autorises.' }
                ], blockedBy),
                blockedBy
            };
        }

        if (type === 'xss-stored') {
            const blockedBy = [];
            if (defenses.outputEncoding) blockedBy.push('outputEncoding');
            if (defenses.csp) blockedBy.push('csp');

            const blocked = blockedBy.length > 0;
            const reachedNode = blocked ? 'browser' : 'action';

            return {
                blocked,
                severity: blocked ? 'medium' : 'critical',
                signal: blocked
                    ? 'Le contenu stocke est rendu sans execution.'
                    : 'Tous les lecteurs executent le payload stocke.',
                timeline: [
                    'Le payload est stocke en base applicative.',
                    blocked
                        ? 'Au rendu, encodage/CSP stoppe le script.'
                        : 'Au rendu, le script s execute automatiquement.',
                    blocked
                        ? 'Propagation stoppee sur la page.'
                        : 'Compromission potentielle multi-utilisateurs.'
                ],
                path: ['attacker', 'app', 'db', 'browser', 'action'],
                reachedNode,
                chainSummary: blocked
                    ? `Arret au rendu navigateur via ${blockedBy.join(' + ')}.`
                    : 'La charge stockee impacte tous les clients qui consultent la ressource.',
                defenseImpact: this.defenseRows(defenses, [
                    { key: 'validation', label: 'Validation entree', role: 'support', hint: 'Utile mais insuffisant face aux bypass.' },
                    { key: 'outputEncoding', label: 'Encodage sortie', role: 'critical', hint: 'Neutralise le contenu stocke dangereux.' },
                    { key: 'csp', label: 'CSP stricte', role: 'critical', hint: 'Derniere barriere en cas de rendu vulnerable.' }
                ], blockedBy),
                blockedBy
            };
        }

        if (type === 'sqli') {
            const blockedBy = [];
            if (defenses.prepared) blockedBy.push('prepared');

            const blocked = blockedBy.length > 0;
            const reachedNode = blocked ? 'app' : 'action';

            return {
                blocked,
                severity: blocked ? 'low' : 'critical',
                signal: blocked
                    ? 'La requete parametree isole les donnees du code SQL.'
                    : 'Le moteur SQL interprete les segments injectes.',
                timeline: [
                    'Le payload atteint la couche applicative SQL.',
                    defenses.validation
                        ? 'Validation syntaxique appliquee (barriere partielle).'
                        : 'Aucune validation de forme sur les parametres.',
                    blocked
                        ? 'Prepared statement: injection neutralisee.'
                        : 'Concatenation vulnerable, requete detournee.'
                ],
                path: ['attacker', 'app', 'db', 'action'],
                reachedNode,
                chainSummary: blocked
                    ? 'Arret dans le backend grace aux requetes preparees.'
                    : 'La base est atteinte et la logique metier est detournee.',
                defenseImpact: this.defenseRows(defenses, [
                    { key: 'validation', label: 'Validation entree', role: 'support', hint: 'Filtre syntaxique mais contournable.' },
                    { key: 'prepared', label: 'Requetes preparees', role: 'critical', hint: 'Separation stricte donnees / code SQL.' }
                ], blockedBy),
                blockedBy
            };
        }

        if (type === 'csrf') {
            const blockedBy = [];
            if (defenses.csrfToken) blockedBy.push('csrfToken');
            if (defenses.sameSite) blockedBy.push('sameSite');

            const blocked = blockedBy.length > 0;
            const reachedNode = blocked ? 'app' : 'action';

            return {
                blocked,
                severity: blocked ? 'medium' : 'high',
                signal: blocked
                    ? 'La requete forcee est rejetee par verification de contexte.'
                    : 'La session victime est reutilisee pour l action forcee.',
                timeline: [
                    'La victime charge une page piegee.',
                    blocked
                        ? 'Token CSRF ou SameSite invalide la requete cross-site.'
                        : 'Le navigateur envoie la session vers l application cible.',
                    blocked
                        ? 'Action sensible stoppee.'
                        : 'Action sensible executee sans consentement utilisateur.'
                ],
                path: ['attacker', 'browser', 'app', 'action'],
                reachedNode,
                chainSummary: blocked
                    ? `Arret cote application grace a ${blockedBy.join(' + ')}.`
                    : 'La chaine CSRF atteint une action metier critique.',
                defenseImpact: this.defenseRows(defenses, [
                    { key: 'csrfToken', label: 'Token CSRF', role: 'critical', hint: 'Lie la requete a un contexte utilisateur legitime.' },
                    { key: 'sameSite', label: 'Cookie SameSite', role: 'critical', hint: 'Empêche l envoi automatique des cookies cross-site.' },
                    { key: 'validation', label: 'Validation entree', role: 'support', hint: 'Peu utile seule contre CSRF.' }
                ], blockedBy),
                blockedBy
            };
        }

        return {
            blocked: false,
            severity: 'high',
            signal: 'Type d attaque non gere.',
            timeline: ['Scenario non supporte.'],
            path: ['attacker', 'action'],
            reachedNode: 'action',
            chainSummary: 'Scenario non supporte.',
            defenseImpact: [],
            blockedBy: []
        };
    }

    renderSelectedResult(attackType, verdict) {
        const attackLabel = this.attackCatalog.find((entry) => entry.id === attackType)?.label || attackType;

        if (verdict.blocked) {
            this.resultBadge.className = 'mod-status ok';
            this.resultBadge.textContent = 'Attaque bloquee';
            this.resultText.textContent = `${attackLabel}: defenses suffisantes pour stopper l exploitation.`;
        } else {
            this.resultBadge.className = 'mod-status bad';
            this.resultBadge.textContent = 'Attaque reussie';
            this.resultText.textContent = `${attackLabel}: la chaine d attaque reste exploitable.`;
        }

        this.flow.innerHTML = verdict.timeline
            .map((step, index) => {
                const type = verdict.blocked
                    ? (index === verdict.timeline.length - 1 ? 'ok' : 'info')
                    : (index === verdict.timeline.length - 1 ? 'bad' : 'warn');
                return `<li class="mod-log-item ${this.escapeHtml(type)}">${this.escapeHtml(step)}</li>`;
            })
            .join('');
    }

    renderDefenseImpact(verdict) {
        this.defenseImpact.innerHTML = verdict.defenseImpact
            .map((entry) => {
                const state = entry.active ? (entry.blocks ? 'blocks' : 'active') : 'inactive';
                const stateLabel = entry.active
                    ? (entry.blocks ? 'Bloque ici' : 'Active')
                    : 'Inactive';
                return `
                    <li class="attack-impact-item ${entry.role} ${state}">
                        <div class="head">
                            <span class="label">${this.escapeHtml(entry.label)}</span>
                            <span class="state">${this.escapeHtml(stateLabel)}</span>
                        </div>
                        <div class="hint">${this.escapeHtml(entry.hint)}</div>
                    </li>
                `;
            })
            .join('');
    }

    renderMatrix(defenses) {
        const rows = this.attackCatalog.map((attack) => {
            const verdict = this.evaluateAttack(attack.id, defenses);
            const statusClass = verdict.blocked ? 'status-ok' : (verdict.severity === 'critical' ? 'status-bad' : 'status-warn');
            return {
                id: attack.id,
                label: attack.label,
                status: verdict.blocked ? 'Protegee' : 'Vulnerable',
                statusClass,
                signal: verdict.signal,
                blocked: verdict.blocked
            };
        });

        const vulnerableCount = rows.filter((row) => !row.blocked).length;
        const risk = Math.round((vulnerableCount / rows.length) * 100);

        this.riskScore.textContent = `${risk}%`;
        this.riskProgress.value = risk;

        this.matrixBody.innerHTML = rows
            .map((row) => `
                <tr>
                    <td>${this.escapeHtml(row.label)}</td>
                    <td class="${this.escapeHtml(row.statusClass)}">${this.escapeHtml(row.status)}</td>
                    <td>${this.escapeHtml(row.signal)}</td>
                </tr>
            `)
            .join('');

        this.postureCards.innerHTML = rows
            .map((row) => `
                <div class="attack-posture-card ${row.blocked ? 'ok' : 'bad'}">
                    <div class="title">${this.escapeHtml(row.label)}</div>
                    <div class="state">${this.escapeHtml(row.status)}</div>
                </div>
            `)
            .join('');

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
        const verdict = this.evaluateAttack(attackType, defenses);

        this.renderSelectedResult(attackType, verdict);
        this.renderDefenseImpact(verdict);
        const risk = this.renderMatrix(defenses);

        if (verdict.blocked) {
            this.setFeedback('La chaine est interrompue avant impact final.', 'ok');
        } else if (risk >= 75) {
            this.setFeedback('Risque eleve: defenses critiques manquantes.', 'bad');
        } else {
            this.setFeedback('Le scenario actif reste exploitable: renforcez les controles critiques.', 'warning');
        }

        await this.playChain(verdict);
    }
}

if (typeof window !== 'undefined') {
    window.WebAttacksPage = WebAttacksPage;
}
