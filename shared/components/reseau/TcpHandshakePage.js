class TcpHandshakePage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// TCP Handshake Simulator
// ============================================================

const speedCtrl = new OEIUtils.SpeedController();

var Tcp = window.OEITrace;
var scenarios = {};
Object.keys(Tcp.TCP_SCENARIOS).forEach(function(name) {
    scenarios[name] = Tcp.TCP_SCENARIOS[name].steps.map(function(step) {
        return Object.assign({}, step, { detail: Tcp.tcpDetail(step) });
    });
});

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
    document.getElementById('stepInfo').innerHTML = 'Choisis un scénario, puis clique sur « Lancer » ou « Étape »';
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
        info: step.info + '<br><strong>Perte simulée :</strong> segment perdu, attente du timeout.'
    };

    // Inject a retransmission step right after the lost packet.
    var retransLabel = step.label.indexOf('(retrans.)') !== -1 ? step.label : (step.label + ' (retrans.)');
    var retransStep = {
        ...step,
        label: retransLabel,
        retransmitted: true,
        title: 'Retransmission',
        info: 'Le segment est renvoyé après expiration du timer (RTO).'
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
    var spacing = animState.steps.length > 6 ? 48 : 70;
    container.style.minHeight = (animState.steps.length * spacing + 30) + 'px';
    message.style.top = (index * spacing + 20) + 'px';

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
    document.getElementById('stepInfo').innerHTML = '<strong>' + step.title + ' :</strong> ' + step.info + netInfo;

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
// TcpWidget - Widget autonome pour intégration dans les slides
// Usage : TcpWidget.mount(container, { scenario: 'normal'|'data'|'close'|'lost'|'dataloss' })
// ─────────────────────────────────────────────────────────────────────────────
class TcpWidget {

    static get _SCENARIOS() {
        const T = window.OEITrace;
        const out = {};
        Object.keys(T.TCP_SCENARIOS).forEach((name) => {
            const steps = T.TCP_SCENARIOS[name].steps;
            out[name] = steps.map((st, i) => ({
                from: st.from === 'client' ? 'c' : 's',
                label: st.label,
                detail: T.tcpDetail(st),
                lost: !!st.lost,
                cState: st.clientState,
                sState: st.serverState,
                info: st.title + ' : ' + st.info,
                done: i === steps.length - 1
            }));
        });
        return out;
    }

    static mount(container, config = {}) {
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
        this._renderStatus('CLOSED', 'LISTEN', 'Clique sur « Lancer » ou « Étape ».');
        this._highlightScenarioBtn(name);
    }

    init() {
        this.root.innerHTML = `<div class="tcpw-container widget-fit">
            <div class="widget-fit-header">
                <div class="tcpw-header">Simulation TCP</div>
                <div class="tcpw-scenario-bar">
                    <button class="tcpw-sc-btn" data-sc="normal">3-way handshake</button>
                    <button class="tcpw-sc-btn" data-sc="data">Transfert de données</button>
                    <button class="tcpw-sc-btn" data-sc="close">Fermeture</button>
                    <button class="tcpw-sc-btn" data-sc="lost">Perte de SYN</button>
                    <button class="tcpw-sc-btn" data-sc="dataloss">Perte de données</button>
                </div>
            </div>
            <div class="widget-fit-body">
                <div class="tcpw-diagram">
                    <div class="tcpw-lane"><div class="tcpw-lane-label">CLIENT</div><div class="tcpw-lane-line"></div></div>
                    <div style="flex:3;position:relative;"><div class="tcpw-messages"></div></div>
                    <div class="tcpw-lane"><div class="tcpw-lane-label">SERVEUR</div><div class="tcpw-lane-line"></div></div>
                </div>
            </div>
            <div class="widget-fit-footer">
                <div class="tcpw-status">
                    <div class="tcpw-state tcpw-cstate"><span class="tcpw-state-name">CLOSED</span><div style="font-size:.62rem;color:var(--sl-muted,#94a3b8)">Client</div></div>
                    <div class="tcpw-state tcpw-sstate"><span class="tcpw-state-name">LISTEN</span><div style="font-size:.62rem;color:var(--sl-muted,#94a3b8)">Serveur</div></div>
                </div>
                <div class="tcpw-info tcpw-info-text"></div>
                <div class="tcpw-controls">
                    <button class="tcpw-btn tcpw-btn-play">&#9654; Lancer</button>
                    <button class="tcpw-btn tcpw-btn-step tcpw-btn-secondary">Étape</button>
                    <button class="tcpw-btn tcpw-btn-reset tcpw-btn-secondary">&#8635; Reset</button>
                </div>
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
            div.style.top = (i * (this._steps.length > 6 ? 30 : 44)) + 'px';
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
