class TcpHandshakePage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// TCP Handshake Simulator
// ============================================================

const speedCtrl = new OEIUtils.SpeedController();

var scenarios = {
    normal: [
        {
            from: 'client', to: 'server', label: 'SYN', detail: 'seq=1000',
            clientState: 'SYN-SENT', serverState: 'LISTEN',
            info: '<strong>Étape 1 :</strong> Le client envoie un segment SYN avec un numéro de séquence initial (seq=1000) pour demander l\'établissement d\'une connexion.'
        },
        {
            from: 'server', to: 'client', label: 'SYN-ACK', detail: 'seq=2000, ack=1001',
            clientState: 'SYN-SENT', serverState: 'SYN-RECEIVED',
            info: '<strong>Étape 2 :</strong> Le serveur répond avec SYN-ACK, son propre numéro de séquence (seq=2000) et accuse réception (ack=1001).'
        },
        {
            from: 'client', to: 'server', label: 'ACK', detail: 'ack=2001',
            clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
            info: '<strong>Étape 3 :</strong> Le client accuse réception avec ACK. La connexion est maintenant établie des deux côtés.',
            final: 'ÉTABLIE'
        }
    ],
    data: [
        {
            from: 'client', to: 'server', label: 'SYN', detail: 'seq=1000',
            clientState: 'SYN-SENT', serverState: 'LISTEN',
            info: '<strong>Étape 1 :</strong> Le client initie la connexion avec SYN.'
        },
        {
            from: 'server', to: 'client', label: 'SYN-ACK', detail: 'seq=2000, ack=1001',
            clientState: 'SYN-SENT', serverState: 'SYN-RECEIVED',
            info: '<strong>Étape 2 :</strong> Le serveur répond avec SYN-ACK.'
        },
        {
            from: 'client', to: 'server', label: 'ACK', detail: 'ack=2001',
            clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
            info: '<strong>Étape 3 :</strong> Connexion établie. Le client peut maintenant envoyer des données.'
        },
        {
            from: 'client', to: 'server', label: 'DATA', detail: 'seq=1001, 512 bytes',
            clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
            info: '<strong>Transfert de données :</strong> Le client envoie 512 octets de données.'
        },
        {
            from: 'server', to: 'client', label: 'ACK', detail: 'ack=1513',
            clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
            info: '<strong>Accusé de réception :</strong> Le serveur accuse réception des données (ack = seq + data_length).',
            final: 'DONNÉES TRANSFÉRÉES'
        }
    ],
    close: [
        {
            from: 'client', to: 'server', label: 'FIN', detail: 'seq=1500',
            clientState: 'FIN-WAIT-1', serverState: 'ESTABLISHED',
            info: '<strong>Fermeture initiée :</strong> Le client envoie FIN pour fermer sa partie de la connexion.'
        },
        {
            from: 'server', to: 'client', label: 'ACK', detail: 'ack=1501',
            clientState: 'FIN-WAIT-2', serverState: 'CLOSE-WAIT',
            info: '<strong>ACK du FIN :</strong> Le serveur accuse réception du FIN.'
        },
        {
            from: 'server', to: 'client', label: 'FIN', detail: 'seq=2500',
            clientState: 'FIN-WAIT-2', serverState: 'LAST-ACK',
            info: '<strong>FIN du serveur :</strong> Le serveur envoie son propre FIN pour fermer sa partie.'
        },
        {
            from: 'client', to: 'server', label: 'ACK', detail: 'ack=2501',
            clientState: 'TIME-WAIT', serverState: 'CLOSED',
            info: '<strong>ACK final :</strong> Le client accuse réception. Après un délai (TIME-WAIT), la connexion sera complètement fermée.',
            final: 'FERMÉE'
        }
    ],
    lost: [
        {
            from: 'client', to: 'server', label: 'SYN', detail: 'seq=1000', lost: true,
            clientState: 'SYN-SENT', serverState: 'LISTEN',
            info: '<strong>SYN perdu :</strong> Le premier segment SYN est perdu sur le réseau. Le serveur ne le reçoit jamais.'
        },
        {
            from: 'client', to: 'server', label: 'SYN (retrans.)', detail: 'seq=1000',
            clientState: 'SYN-SENT', serverState: 'LISTEN',
            info: '<strong>Retransmission :</strong> Après un timeout, le client retransmet le segment SYN.'
        },
        {
            from: 'server', to: 'client', label: 'SYN-ACK', detail: 'seq=2000, ack=1001',
            clientState: 'SYN-SENT', serverState: 'SYN-RECEIVED',
            info: '<strong>SYN-ACK reçu :</strong> Le serveur répond au SYN retransmis.'
        },
        {
            from: 'client', to: 'server', label: 'ACK', detail: 'ack=2001',
            clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
            info: '<strong>Connexion établie :</strong> Malgré la perte initiale, la connexion est établie grâce à la retransmission.',
            final: 'ÉTABLIE (après retrans.)'
        }
    ]
};

var animState = {
    scenario: 'normal',
    steps: [],
    currentStep: -1,
    isRunning: false,
    segmentsSent: 0
};

var networkConfig = {
    latencyMs: 0,
    lossPct: 0
};

function bindNetworkControls() {
    var latencySlider = document.getElementById('latencySlider');
    var latencyValue = document.getElementById('latencyValue');
    var lossSlider = document.getElementById('lossSlider');
    var lossValue = document.getElementById('lossValue');

    if (!latencySlider || !lossSlider || !latencyValue || !lossValue) return;

    function sync() {
        networkConfig.latencyMs = parseInt(latencySlider.value, 10) || 0;
        networkConfig.lossPct = parseInt(lossSlider.value, 10) || 0;
        latencyValue.textContent = networkConfig.latencyMs + ' ms';
        lossValue.textContent = networkConfig.lossPct + '%';
        document.getElementById('rttValue').textContent = (networkConfig.latencyMs * 2) + ' ms';
    }

    latencySlider.addEventListener('input', sync);
    lossSlider.addEventListener('input', sync);
    sync();
}

function loadScenario(name) {
    animState.scenario = name;
    animState.steps = (scenarios[name] || []).map(function(step) { return { ...step }; });
    resetAnimation();
}

function resetAnimation() {
    animState.currentStep = -1;
    animState.isRunning = false;
    animState.segmentsSent = 0;

    document.getElementById('clientState').textContent = 'CLOSED';
    document.getElementById('serverState').textContent = 'LISTEN';
    document.getElementById('currentStep').textContent = '0';
    document.getElementById('segmentsSent').textContent = '0';
    document.getElementById('connectionStatus').textContent = '--';
    document.getElementById('stepInfo').innerHTML = 'Sélectionnez un scénario et cliquez sur "Lancer" ou "Étape"';
    document.getElementById('btnRun').textContent = 'Lancer';
    document.getElementById('rttValue').textContent = (networkConfig.latencyMs * 2) + ' ms';

    document.getElementById('clientState').classList.remove('active');
    document.getElementById('serverState').classList.remove('active');

    var container = document.getElementById('messagesContainer');
    container.innerHTML = '';
}

async function runAnimation() {
    if (animState.isRunning) {
        animState.isRunning = false;
        document.getElementById('btnRun').textContent = 'Lancer';
        return;
    }

    animState.isRunning = true;
    document.getElementById('btnRun').textContent = 'Pause';

    while (animState.currentStep < animState.steps.length - 1 && animState.isRunning) {
        animState.currentStep++;
        renderStep(animState.currentStep);
        await OEIUtils.sleep(speedCtrl.getDelay() + networkConfig.latencyMs);
    }

    animState.isRunning = false;
    document.getElementById('btnRun').textContent = 'Lancer';
}

function stepAnimation() {
    if (animState.isRunning) return;
    if (animState.currentStep < animState.steps.length - 1) {
        animState.currentStep++;
        renderStep(animState.currentStep);
    }
}

function maybeApplyNetworkLoss(index, step) {
    if (!step || step.lost || step.retransmitted) return step;
    if (networkConfig.lossPct <= 0) return step;
    if (Math.random() * 100 >= networkConfig.lossPct) return step;

    var lostStep = {
        ...step,
        lost: true,
        info: step.info + '<br><strong>Perte simulée :</strong> segment perdu, attente de timeout.'
    };

    // Inject a retransmission step right after the lost packet.
    var retransLabel = step.label.indexOf('(retrans.)') !== -1 ? step.label : (step.label + ' (retrans.)');
    var retransStep = {
        ...step,
        label: retransLabel,
        retransmitted: true,
        info: '<strong>Retransmission :</strong> le segment est renvoyé après expiration du timer (RTO).'
    };
    animState.steps.splice(index + 1, 0, retransStep);

    return lostStep;
}

function renderStep(index) {
    var step = maybeApplyNetworkLoss(index, animState.steps[index]);
    var container = document.getElementById('messagesContainer');

    // Create message element
    var message = document.createElement('div');
    message.className = 'message';
    message.style.top = (index * 70 + 20) + 'px';

    var arrow = document.createElement('div');
    arrow.className = 'message-arrow';

    var label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = step.label;

    var detail = document.createElement('div');
    detail.className = 'message-detail';
    detail.textContent = step.detail;

    arrow.appendChild(label);
    arrow.appendChild(detail);

    if (step.from === 'client') {
        message.style.left = '25%';
        message.style.width = '50%';
    } else {
        message.style.left = '25%';
        message.style.width = '50%';
        arrow.classList.add('reverse');
    }

    if (step.lost) {
        arrow.classList.add('lost');
    }

    message.appendChild(arrow);
    container.appendChild(message);

    // Animate
    setTimeout(function() {
        message.classList.add('visible');
    }, 50);

    // Update states
    document.getElementById('clientState').textContent = step.clientState;
    document.getElementById('serverState').textContent = step.serverState;

    if (step.clientState === 'ESTABLISHED') {
        document.getElementById('clientState').classList.add('active');
    } else {
        document.getElementById('clientState').classList.remove('active');
    }

    if (step.serverState === 'ESTABLISHED') {
        document.getElementById('serverState').classList.add('active');
    } else {
        document.getElementById('serverState').classList.remove('active');
    }

    // Update info
    var netInfo = `<div style="margin-top:0.45rem;font-size:0.82rem;color:var(--muted);"><strong>Réseau simulé :</strong> latence ${networkConfig.latencyMs} ms, perte ${networkConfig.lossPct}%.</div>`;
    document.getElementById('stepInfo').innerHTML = step.info + netInfo;

    // Update stats
    if (!step.lost) {
        animState.segmentsSent++;
    }
    document.getElementById('currentStep').textContent = index + 1;
    document.getElementById('segmentsSent').textContent = animState.segmentsSent;

    if (step.final) {
        document.getElementById('connectionStatus').textContent = step.final;
    }
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// Initialize
bindNetworkControls();
loadScenario('normal');
        window.loadScenario = loadScenario;
        window.runAnimation = runAnimation;
        window.stepAnimation = stepAnimation;
        window.resetAnimation = resetAnimation;
    }
}

if (typeof window !== 'undefined') {
    window.TcpHandshakePage = TcpHandshakePage;
}

// ─────────────────────────────────────────────────────────────────────────────
// TcpWidget — Widget autonome pour intégration dans les slides
// Usage : TcpWidget.mount(container, { scenario: 'normal'|'data'|'close'|'lost' })
// ─────────────────────────────────────────────────────────────────────────────
class TcpWidget {
    static _stylesInjected = false;

    static _SCENARIOS = {
        normal: [
            { from: 'c', label: 'SYN', detail: 'seq=1000', cState: 'SYN-SENT', sState: 'LISTEN',
              info: 'Client envoie SYN (seq=1000) pour demander une connexion.' },
            { from: 's', label: 'SYN-ACK', detail: 'seq=2000, ack=1001', cState: 'SYN-SENT', sState: 'SYN-RECEIVED',
              info: 'Serveur repond SYN-ACK (son seq=2000, ack du client+1=1001).' },
            { from: 'c', label: 'ACK', detail: 'ack=2001', cState: 'ESTABLISHED', sState: 'ESTABLISHED',
              info: 'Client accuse reception. Connexion ETABLIE des deux cotes.', done: true }
        ],
        data: [
            { from: 'c', label: 'SYN', detail: 'seq=1000', cState: 'SYN-SENT', sState: 'LISTEN',
              info: 'Etablissement — client envoie SYN.' },
            { from: 's', label: 'SYN-ACK', detail: 'seq=2000, ack=1001', cState: 'SYN-SENT', sState: 'SYN-RECEIVED',
              info: 'Serveur repond SYN-ACK.' },
            { from: 'c', label: 'ACK', detail: 'ack=2001', cState: 'ESTABLISHED', sState: 'ESTABLISHED',
              info: 'Connexion etablie — transfert de donnees possible.' },
            { from: 'c', label: 'DATA', detail: 'seq=1001, 512 B', cState: 'ESTABLISHED', sState: 'ESTABLISHED',
              info: 'Client envoie 512 octets de donnees.' },
            { from: 's', label: 'ACK', detail: 'ack=1513', cState: 'ESTABLISHED', sState: 'ESTABLISHED',
              info: 'Serveur accuse reception (ack = seq + taille donnees).', done: true }
        ],
        close: [
            { from: 'c', label: 'FIN', detail: 'seq=1500', cState: 'FIN-WAIT-1', sState: 'ESTABLISHED',
              info: 'Client envoie FIN pour fermer sa partie.' },
            { from: 's', label: 'ACK', detail: 'ack=1501', cState: 'FIN-WAIT-2', sState: 'CLOSE-WAIT',
              info: 'Serveur accuse le FIN du client.' },
            { from: 's', label: 'FIN', detail: 'seq=2500', cState: 'FIN-WAIT-2', sState: 'LAST-ACK',
              info: 'Serveur envoie son propre FIN.' },
            { from: 'c', label: 'ACK', detail: 'ack=2501', cState: 'TIME-WAIT', sState: 'CLOSED',
              info: 'Client accuse reception. Apres TIME-WAIT, connexion fermee.', done: true }
        ],
        lost: [
            { from: 'c', label: 'SYN', detail: 'seq=1000', lost: true, cState: 'SYN-SENT', sState: 'LISTEN',
              info: 'SYN envoye — mais perdu sur le reseau.' },
            { from: 'c', label: 'SYN (retrans.)', detail: 'seq=1000', cState: 'SYN-SENT', sState: 'LISTEN',
              info: 'Apres timeout, le client retransmet le SYN.' },
            { from: 's', label: 'SYN-ACK', detail: 'seq=2000, ack=1001', cState: 'SYN-SENT', sState: 'SYN-RECEIVED',
              info: 'Serveur repond au SYN retransmis.' },
            { from: 'c', label: 'ACK', detail: 'ack=2001', cState: 'ESTABLISHED', sState: 'ESTABLISHED',
              info: 'Connexion etablie malgre la perte initiale.', done: true }
        ]
    };

    static ensureStyles() {
        if (TcpWidget._stylesInjected) return;
        TcpWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.tcpw-container{display:flex;flex-direction:column;gap:8px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.tcpw-header{font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.tcpw-scenario-bar{display:flex;gap:6px;flex-wrap:wrap;}
.tcpw-sc-btn{padding:3px 10px;border:1px solid rgba(255,255,255,.15);border-radius:12px;cursor:pointer;font-size:.68rem;background:transparent;color:var(--sl-text,#e2e8f0);transition:all .15s;}
.tcpw-sc-btn.active,.tcpw-sc-btn:hover{background:var(--sl-primary,#6366f1);border-color:var(--sl-primary,#6366f1);color:#fff;}
.tcpw-diagram{display:flex;gap:0;flex:1;min-height:100px;position:relative;}
.tcpw-lane{display:flex;flex-direction:column;align-items:center;gap:0;flex:1;}
.tcpw-lane-label{font-size:.75rem;font-weight:700;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.08);margin-bottom:4px;}
.tcpw-lane-line{flex:1;width:2px;background:rgba(255,255,255,.15);margin:0 auto;}
.tcpw-messages{position:absolute;left:0;right:0;top:30px;bottom:0;pointer-events:none;}
.tcpw-msg{position:absolute;left:15%;width:70%;display:flex;flex-direction:column;align-items:center;opacity:0;transition:opacity .3s;}
.tcpw-msg.visible{opacity:1;}
.tcpw-msg-arrow{width:100%;height:18px;position:relative;display:flex;align-items:center;}
.tcpw-msg-arrow::after{content:'';position:absolute;height:2px;background:var(--sl-primary,#6366f1);width:100%;}
.tcpw-msg-arrow.reverse::after{background:#a855f7;}
.tcpw-msg-arrow.lost::after{background:rgba(239,68,68,.4);border-top:2px dashed #ef4444;height:0;top:50%;}
.tcpw-msg-arrow::before{content:'▶';position:absolute;right:-4px;font-size:10px;color:var(--sl-primary,#6366f1);top:50%;transform:translateY(-50%);}
.tcpw-msg-arrow.reverse::before{content:'◀';right:auto;left:-4px;color:#a855f7;}
.tcpw-msg-arrow.lost::before{display:none;}
.tcpw-msg-label{font-size:.72rem;font-weight:700;color:var(--sl-text,#e2e8f0);}
.tcpw-msg-detail{font-size:.64rem;color:var(--sl-muted,#94a3b8);}
.tcpw-status{display:flex;gap:8px;}
.tcpw-state{flex:1;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.06);font-size:.7rem;text-align:center;}
.tcpw-state-name{font-weight:700;color:var(--sl-accent,#f97316);}
.tcpw-state.established .tcpw-state-name{color:#22c55e;}
.tcpw-info{font-size:.7rem;color:var(--sl-text,#cbd5e1);min-height:28px;line-height:1.4;}
.tcpw-controls{display:flex;gap:8px;flex-wrap:wrap;}
.tcpw-btn{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.tcpw-btn:hover:not(:disabled){opacity:.8;}
.tcpw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        TcpWidget.ensureStyles();
        const w = new TcpWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._scenario = config.scenario || 'normal';
        this._steps = [];
        this._idx = -1;
        this._running = false;
        this._timer = null;
    }

    _loadScenario(name) {
        this._scenario = name;
        this._steps = (TcpWidget._SCENARIOS[name] || TcpWidget._SCENARIOS.normal).map(s => ({ ...s }));
        this._idx = -1;
        this._running = false;
        this._renderDiagram();
        this._renderStatus('CLOSED', 'LISTEN', 'Selectionnez une etape ou cliquez Lancer.');
        this._highlightScenarioBtn(name);
    }

    init() {
        this.root.innerHTML = `<div class="tcpw-container">
            <div class="tcpw-header">Simulation TCP</div>
            <div class="tcpw-scenario-bar">
                <button class="tcpw-sc-btn" data-sc="normal">3-way handshake</button>
                <button class="tcpw-sc-btn" data-sc="data">Transfert donnees</button>
                <button class="tcpw-sc-btn" data-sc="close">Fermeture</button>
                <button class="tcpw-sc-btn" data-sc="lost">Perte de paquet</button>
            </div>
            <div class="tcpw-diagram">
                <div class="tcpw-lane"><div class="tcpw-lane-label">CLIENT</div><div class="tcpw-lane-line"></div></div>
                <div style="flex:3;position:relative;"><div class="tcpw-messages"></div></div>
                <div class="tcpw-lane"><div class="tcpw-lane-label">SERVEUR</div><div class="tcpw-lane-line"></div></div>
            </div>
            <div class="tcpw-status">
                <div class="tcpw-state tcpw-cstate"><span class="tcpw-state-name">CLOSED</span><div style="font-size:.62rem;color:var(--sl-muted,#94a3b8)">Client</div></div>
                <div class="tcpw-state tcpw-sstate"><span class="tcpw-state-name">LISTEN</span><div style="font-size:.62rem;color:var(--sl-muted,#94a3b8)">Serveur</div></div>
            </div>
            <div class="tcpw-info tcpw-info-text"></div>
            <div class="tcpw-controls">
                <button class="tcpw-btn tcpw-btn-play">&#9654; Lancer</button>
                <button class="tcpw-btn tcpw-btn-step tcpw-btn-secondary">Etape</button>
                <button class="tcpw-btn tcpw-btn-reset tcpw-btn-secondary">&#8635; Reset</button>
            </div>
        </div>`;
        this._bindControls();
        this._loadScenario(this._scenario);
    }

    _highlightScenarioBtn(name) {
        this.root.querySelectorAll('.tcpw-sc-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.sc === name);
        });
    }

    _renderDiagram() {
        const container = this.root.querySelector('.tcpw-messages');
        if (!container) return;
        container.innerHTML = '';
        this._steps.slice(0, this._idx + 1).forEach((step, i) => {
            const div = document.createElement('div');
            div.className = 'tcpw-msg visible';
            div.style.top = (i * 44) + 'px';
            const arrowCls = step.from === 's' ? 'reverse' : '';
            const lostCls = step.lost ? 'lost' : '';
            div.innerHTML = `
                <div class="tcpw-msg-arrow ${arrowCls} ${lostCls}"></div>
                <div class="tcpw-msg-label">${step.label}</div>
                <div class="tcpw-msg-detail">${step.detail}</div>`;
            container.appendChild(div);
        });
    }

    _renderStatus(cState, sState, info) {
        const cs = this.root.querySelector('.tcpw-cstate');
        const ss = this.root.querySelector('.tcpw-sstate');
        const inf = this.root.querySelector('.tcpw-info-text');
        if (cs) {
            cs.querySelector('.tcpw-state-name').textContent = cState;
            cs.classList.toggle('established', cState === 'ESTABLISHED');
        }
        if (ss) {
            ss.querySelector('.tcpw-state-name').textContent = sState;
            ss.classList.toggle('established', sState === 'ESTABLISHED');
        }
        if (inf) inf.textContent = info;
    }

    _step() {
        if (this._idx >= this._steps.length - 1) { this._stop(); return; }
        this._idx++;
        const step = this._steps[this._idx];
        this._renderDiagram();
        this._renderStatus(step.cState, step.sState, step.info);
        if (step.done) this._stop();
    }

    _stop() {
        this._running = false;
        clearTimeout(this._timer);
        const btn = this.root.querySelector('.tcpw-btn-play');
        if (btn) btn.textContent = '\u25B6 Lancer';
    }

    _bindControls() {
        this.root.querySelectorAll('.tcpw-sc-btn').forEach(btn => {
            btn.addEventListener('click', () => { this._stop(); this._loadScenario(btn.dataset.sc); });
        });
        this.root.querySelector('.tcpw-btn-play')?.addEventListener('click', () => {
            if (this._running) { this._stop(); return; }
            if (this._idx >= this._steps.length - 1) this._idx = -1;
            this._running = true;
            const btn = this.root.querySelector('.tcpw-btn-play');
            if (btn) btn.textContent = '\u23F8 Pause';
            const tick = () => {
                if (!this._running) return;
                this._step();
                if (this._running) this._timer = setTimeout(tick, 700);
            };
            tick();
        });
        this.root.querySelector('.tcpw-btn-step')?.addEventListener('click', () => {
            this._stop();
            if (this._idx >= this._steps.length - 1) this._idx = -1;
            this._step();
        });
        this.root.querySelector('.tcpw-btn-reset')?.addEventListener('click', () => {
            this._stop();
            this._loadScenario(this._scenario);
        });
    }
}

if (typeof window !== 'undefined') {
    window.TcpWidget = TcpWidget;
}
