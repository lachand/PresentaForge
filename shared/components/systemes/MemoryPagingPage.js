class MemoryPagingPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// Memory Management Simulator
// ============================================================

/* ======== Speed Controller ======== */
const speedCtrl = new OEIUtils.SpeedController();

var state = {
    algorithm: 'fifo',
    numFrames: 3,
    sequence: [],
    currentStep: -1,
    frames: [],
    fifoQueue: [],
    history: [],
    hits: 0,
    faults: 0,
    isRunning: false
};

function switchAlgorithm(algo) {
    state.algorithm = algo;

    document.querySelectorAll('.algo-tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    document.querySelector('.algo-tab[onclick*="' + algo + '"]').classList.add('active');

    resetSimulation();
}

function loadExample(n) {
    if (n === 1) {
        document.getElementById('sequenceInput').value = '7,0,1,2,0,3,0,4,2,3,0,3,2';
        document.getElementById('framesInput').value = '3';
    } else if (n === 2) {
        document.getElementById('sequenceInput').value = '1,2,3,4,1,2,5,1,2,3,4,5';
        document.getElementById('framesInput').value = '3';
    } else if (n === 3) {
        document.getElementById('sequenceInput').value = '0,1,2,3,0,1,4,0,1,2,3,4';
        document.getElementById('framesInput').value = '4';
    }
    resetSimulation();
}

function resetSimulation() {
    state.numFrames = parseInt(document.getElementById('framesInput').value);
    state.sequence = document.getElementById('sequenceInput').value.split(',').map(function(x) {
        return parseInt(x.trim());
    }).filter(function(x) { return !isNaN(x); });

    state.currentStep = -1;
    state.frames = [];
    for (var i = 0; i < state.numFrames; i++) {
        state.frames.push(null);
    }
    state.fifoQueue = [];
    state.history = [];
    state.hits = 0;
    state.faults = 0;
    state.isRunning = false;

    renderReferenceString();
    renderMemoryFrames();
    updateStats();
    compareAlgorithms();
    updateInfo('Configurez les paramètres et cliquez sur "Simuler" ou "Étape"');
}

function renderReferenceString() {
    var container = document.getElementById('referenceString');
    container.innerHTML = '';

    state.sequence.forEach(function(page, index) {
        var pageEl = document.createElement('div');
        pageEl.className = 'ref-page';
        pageEl.textContent = page;
        pageEl.dataset.index = index;

        if (index === state.currentStep) {
            pageEl.classList.add('current');
        } else if (index < state.currentStep) {
            pageEl.classList.add('processed');
        }

        container.appendChild(pageEl);
    });
}

function renderMemoryFrames() {
    var container = document.getElementById('memoryFrames');
    container.innerHTML = '';

    // Show current state
    for (var f = 0; f < state.numFrames; f++) {
        var row = document.createElement('div');
        row.className = 'frame-row';

        var label = document.createElement('div');
        label.className = 'frame-label';
        label.textContent = 'Cadre ' + f;

        var cells = document.createElement('div');
        cells.className = 'frame-cells';

        for (var s = 0; s <= state.currentStep; s++) {
            var cell = document.createElement('div');
            cell.className = 'frame-cell';

            var frameState = state.history[s];
            if (frameState && frameState.frames[f] !== null) {
                cell.textContent = frameState.frames[f];

                if (s === state.currentStep) {
                    if (frameState.type === 'hit' && frameState.hitFrame === f) {
                        cell.classList.add('hit');
                    } else if (frameState.type === 'fault' && frameState.loadedFrame === f) {
                        cell.classList.add('fault');
                    } else if (frameState.type === 'fault' && frameState.victimFrame === f) {
                        cell.classList.add('victim');
                    }
                }
            } else {
                cell.classList.add('empty');
                cell.textContent = '—';
            }

            cells.appendChild(cell);
        }

        row.appendChild(label);
        row.appendChild(cells);
        container.appendChild(row);
    }
}

async function runSimulation() {
    if (state.isRunning) {
        state.isRunning = false;
        return;
    }

    state.isRunning = true;

    while (state.currentStep < state.sequence.length - 1 && state.isRunning) {
        state.currentStep++;
        processStep(state.currentStep);
        renderReferenceString();
        renderMemoryFrames();
        updateStats();
        await OEIUtils.sleep(speedCtrl.getDelay());
    }

    state.isRunning = false;
}

function stepSimulation() {
    if (state.isRunning) return;
    if (state.currentStep < state.sequence.length - 1) {
        state.currentStep++;
        processStep(state.currentStep);
        renderReferenceString();
        renderMemoryFrames();
        updateStats();
    }
}

function processStep(step) {
    var page = state.sequence[step];

    // Check if page is in memory
    var pageIndex = state.frames.indexOf(page);

    if (pageIndex !== -1) {
        // Hit
        state.hits++;
        state.history.push({
            page: page,
            type: 'hit',
            hitFrame: pageIndex,
            frames: state.frames.slice()
        });
        updateInfo('<strong>Hit :</strong> La page ' + page + ' est déjà en mémoire (cadre ' + pageIndex + ')');
    } else {
        // Fault
        state.faults++;

        var victimIndex = -1;
        var emptyIndex = state.frames.indexOf(null);

        if (emptyIndex !== -1) {
            // There's an empty frame
            state.frames[emptyIndex] = page;
            if (state.algorithm === 'fifo') {
                state.fifoQueue.push(emptyIndex);
            }
            state.history.push({
                page: page,
                type: 'fault',
                loadedFrame: emptyIndex,
                victimFrame: -1,
                frames: state.frames.slice()
            });
            updateInfo('<strong>Fault :</strong> La page ' + page + ' est chargée dans le cadre vide ' + emptyIndex);
        } else {
            // Need to replace a page
            victimIndex = selectVictim(step);
            var victim = state.frames[victimIndex];

            state.frames[victimIndex] = page;
            if (state.algorithm === 'fifo') {
                state.fifoQueue.push(victimIndex);
            }
            state.history.push({
                page: page,
                type: 'fault',
                loadedFrame: victimIndex,
                victimFrame: victimIndex,
                victim: victim,
                frames: state.frames.slice()
            });
            updateInfo('<strong>Fault + Remplacement :</strong> La page ' + victim + ' (cadre ' + victimIndex + ') est remplacée par la page ' + page);
        }
    }
}

function selectVictim(currentStep) {
    if (state.algorithm === 'fifo') {
        return selectVictimFIFO(currentStep);
    } else if (state.algorithm === 'lru') {
        return selectVictimLRU(currentStep);
    } else if (state.algorithm === 'optimal') {
        return selectVictimOptimal(currentStep);
    }
    return 0;
}

function selectVictimFIFO(currentStep) {
    if (state.fifoQueue.length > 0) {
        return state.fifoQueue.shift();
    }
    return 0;
}

function selectVictimLRU(currentStep) {
    // Find the least recently used page
    var lastUsed = {};
    for (var i = 0; i <= currentStep; i++) {
        var page = state.sequence[i];
        lastUsed[page] = i;
    }

    var lruFrame = 0;
    var lruTime = Infinity;

    for (var f = 0; f < state.numFrames; f++) {
        var page = state.frames[f];
        if (page !== null) {
            var time = lastUsed[page];
            if (time < lruTime) {
                lruTime = time;
                lruFrame = f;
            }
        }
    }

    return lruFrame;
}

function selectVictimOptimal(currentStep) {
    // Find the page that will be used farthest in the future
    var nextUse = {};

    for (var f = 0; f < state.numFrames; f++) {
        var page = state.frames[f];
        if (page !== null) {
            var found = false;
            for (var i = currentStep + 1; i < state.sequence.length; i++) {
                if (state.sequence[i] === page) {
                    nextUse[f] = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                nextUse[f] = Infinity;
            }
        }
    }

    var optimalFrame = 0;
    var maxDistance = -1;

    for (var f = 0; f < state.numFrames; f++) {
        if (nextUse[f] > maxDistance) {
            maxDistance = nextUse[f];
            optimalFrame = f;
        }
    }

    return optimalFrame;
}

function selectVictimLRUOffline(frames, sequence, currentStep) {
    var lruFrame = 0;
    var oldestUse = Infinity;
    for (var f = 0; f < frames.length; f++) {
        var page = frames[f];
        var lastSeen = -1;
        for (var i = currentStep - 1; i >= 0; i--) {
            if (sequence[i] === page) {
                lastSeen = i;
                break;
            }
        }
        if (lastSeen < oldestUse) {
            oldestUse = lastSeen;
            lruFrame = f;
        }
    }
    return lruFrame;
}

function selectVictimOptimalOffline(frames, sequence, currentStep) {
    var bestFrame = 0;
    var farthestNextUse = -1;
    for (var f = 0; f < frames.length; f++) {
        var page = frames[f];
        var nextUse = Infinity;
        for (var i = currentStep + 1; i < sequence.length; i++) {
            if (sequence[i] === page) {
                nextUse = i;
                break;
            }
        }
        if (nextUse > farthestNextUse) {
            farthestNextUse = nextUse;
            bestFrame = f;
        }
    }
    return bestFrame;
}

function simulateAlgorithm(algorithm, sequence, numFrames) {
    var frames = [];
    var fifoQueue = [];
    for (var i = 0; i < numFrames; i++) frames.push(null);

    var hits = 0;
    var faults = 0;

    for (var step = 0; step < sequence.length; step++) {
        var page = sequence[step];
        var pageIndex = frames.indexOf(page);
        if (pageIndex !== -1) {
            hits++;
            continue;
        }

        faults++;
        var emptyIndex = frames.indexOf(null);
        if (emptyIndex !== -1) {
            frames[emptyIndex] = page;
            if (algorithm === 'fifo') fifoQueue.push(emptyIndex);
            continue;
        }

        var victimIndex = 0;
        if (algorithm === 'fifo') {
            victimIndex = fifoQueue.shift();
            fifoQueue.push(victimIndex);
        } else if (algorithm === 'lru') {
            victimIndex = selectVictimLRUOffline(frames, sequence, step);
        } else {
            victimIndex = selectVictimOptimalOffline(frames, sequence, step);
        }

        frames[victimIndex] = page;
    }

    var total = hits + faults;
    return {
        algorithm: algorithm,
        hits: hits,
        faults: faults,
        rate: total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0'
    };
}

function compareAlgorithms() {
    var compareGrid = document.getElementById('compareGrid');
    var compareNote = document.getElementById('compareNote');
    if (!compareGrid || !compareNote) return;

    if (state.sequence.length === 0 || state.numFrames <= 0) {
        compareGrid.innerHTML = '<div class="text-muted text-sm">Renseignez une séquence valide pour lancer la comparaison.</div>';
        compareNote.textContent = 'Aucune comparaison disponible.';
        return;
    }

    var labels = { fifo: 'FIFO', lru: 'LRU', optimal: 'Optimal' };
    var results = ['fifo', 'lru', 'optimal'].map(function(algo) {
        return simulateAlgorithm(algo, state.sequence, state.numFrames);
    });

    var bestFaults = Math.min.apply(null, results.map(function(r) { return r.faults; }));
    compareGrid.innerHTML = results.map(function(r) {
        var bestClass = r.faults === bestFaults ? ' best' : '';
        return `
            <div class="compare-card${bestClass}">
                <h4>${labels[r.algorithm]}</h4>
                <div class="line"><span>Hits</span><strong>${r.hits}</strong></div>
                <div class="line"><span>Faults</span><strong>${r.faults}</strong></div>
                <div class="line"><span>Taux de succès</span><strong>${r.rate}%</strong></div>
            </div>
        `;
    }).join('');

    var winners = results.filter(function(r) { return r.faults === bestFaults; }).map(function(r) { return labels[r.algorithm]; });
    compareNote.textContent = 'Meilleur(s) sur cette configuration : ' + winners.join(', ') + ' (minimum de page faults).';
}

function updateStats() {
    document.getElementById('statCurrent').textContent = state.currentStep >= 0 ? state.sequence[state.currentStep] : '--';
    document.getElementById('statHits').textContent = state.hits;
    document.getElementById('statFaults').textContent = state.faults;

    if (state.hits + state.faults > 0) {
        var rate = (state.hits / (state.hits + state.faults) * 100).toFixed(1);
        document.getElementById('statRate').textContent = rate + '%';
    } else {
        document.getElementById('statRate').textContent = '--';
    }

    compareAlgorithms();
}

function updateInfo(text) {
    document.getElementById('infoPanel').innerHTML = text;
}

// Initialize
resetSimulation();
        window.switchAlgorithm = switchAlgorithm;
        window.runSimulation = runSimulation;
        window.stepSimulation = stepSimulation;
        window.resetSimulation = resetSimulation;
        window.loadExample = loadExample;
    }
}

if (typeof window !== 'undefined') {
    window.MemoryPagingPage = MemoryPagingPage;
}

// ── Standalone widget ──────────────────────────────────────────
class MemoryWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (MemoryWidget._stylesInjected) return;
        MemoryWidget._stylesInjected = true;
        const css = `
.mpw { font-family: inherit; display: flex; flex-direction: column; gap: 10px; }
.mpw-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.mpw-lbl { font-size: 0.78rem; font-weight: 600; color: var(--muted, #888); }
.mpw-input { font-size: 0.85rem; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; background: var(--surface, #fff); color: var(--text, #222); }
.mpw-pills { display: flex; gap: 4px; }
.mpw-pill { font-size: 0.8rem; padding: 4px 10px; border: 1px solid var(--border, #ccc); border-radius: 12px; background: transparent; color: var(--text, #222); cursor: pointer; }
.mpw-pill.active { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.mpw-btns { display: flex; gap: 6px; margin-left: auto; }
.mpw-btn { font-size: 0.82rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--surface, #f5f5f5); color: var(--text, #222); cursor: pointer; }
.mpw-btn.primary { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.mpw-ref { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-height: 36px; }
.mpw-rc { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 0.88rem; font-weight: 700; background: var(--surface2, #f0f0f0); border: 2px solid transparent; }
.mpw-rc.current { border-color: var(--primary, #6366f1); background: rgba(99,102,241,0.12); }
.mpw-rc.processed { opacity: 0.45; }
.mpw-frame-row { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.mpw-frame-lbl { font-size: 0.75rem; font-weight: 600; color: var(--muted, #888); width: 52px; flex-shrink: 0; }
.mpw-frame-cells { display: flex; gap: 2px; flex-wrap: wrap; }
.mpw-fc { width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 0.82rem; font-weight: 700; background: var(--surface2, #f0f0f0); }
.mpw-fc.empty { color: var(--muted, #aaa); font-weight: 400; }
.mpw-fc.hit { background: #22c55e; color: #fff; }
.mpw-fc.fault { background: var(--primary, #6366f1); color: #fff; }
.mpw-fc.victim { background: #ef4444; color: #fff; }
.mpw-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.82rem; }
.mpw-stat { display: flex; flex-direction: column; align-items: center; }
.mpw-sv { font-size: 1.1rem; font-weight: 700; color: var(--primary, #6366f1); }
.mpw-sl { color: var(--muted, #888); font-size: 0.75rem; }
.mpw-info { font-size: 0.82rem; color: var(--muted, #888); min-height: 1.4em; }
`;
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        MemoryWidget.ensureStyles();
        if (container.dataset.mpw) return;
        container.dataset.mpw = '1';
        new MemoryWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.algo = 'fifo';
        this.numFrames = 3;
        this.seq = [];
        this.step = -1;
        this.frames = [];
        this.fifoQueue = [];
        this.history = [];
        this.hits = 0;
        this.faults = 0;
        this.running = false;
        this.DEFAULT_SEQ = config.sequence || '7,0,1,2,0,3,0,4,2,3,0,3,2';
        this.DEFAULT_FRAMES = config.frames || 3;
    }

    init() {
        this.root.innerHTML = `<div class="mpw">
  <div class="mpw-toolbar">
    <span class="mpw-lbl">Séquence :</span>
    <input class="mpw-input" style="width:200px" data-seq value="${this.DEFAULT_SEQ}">
    <span class="mpw-lbl">Cadres :</span>
    <input class="mpw-input" style="width:46px" data-frames value="${this.DEFAULT_FRAMES}">
    <div class="mpw-pills">
      <button class="mpw-pill active" data-algo="fifo">FIFO</button>
      <button class="mpw-pill" data-algo="lru">LRU</button>
      <button class="mpw-pill" data-algo="optimal">Optimal</button>
    </div>
    <div class="mpw-btns">
      <button class="mpw-btn" data-step>Étape</button>
      <button class="mpw-btn primary" data-run>▶ Simuler</button>
      <button class="mpw-btn" data-reset>↺ Reset</button>
    </div>
  </div>
  <div class="mpw-lbl">Chaîne de référence</div>
  <div class="mpw-ref" data-ref-row></div>
  <div class="mpw-lbl">Cadres mémoire</div>
  <div data-frames-area></div>
  <div class="mpw-stats">
    <div class="mpw-stat"><span class="mpw-sv" data-sp>--</span><span class="mpw-sl">Page courante</span></div>
    <div class="mpw-stat"><span class="mpw-sv" data-sh>0</span><span class="mpw-sl">Hits</span></div>
    <div class="mpw-stat"><span class="mpw-sv" data-sf>0</span><span class="mpw-sl">Faults</span></div>
    <div class="mpw-stat"><span class="mpw-sv" data-sr>--</span><span class="mpw-sl">Taux de hit</span></div>
  </div>
  <div class="mpw-info" data-info>Prêt. Cliquez sur Étape ou Simuler.</div>
</div>`;
        this._bind();
        this._reset();
    }

    _q(s) { return this.root.querySelector(s); }
    _qa(s) { return this.root.querySelectorAll(s); }

    _bind() {
        this._qa('[data-algo]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.algo = btn.dataset.algo;
                this._qa('[data-algo]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._reset();
            });
        });
        this._q('[data-step]').addEventListener('click', () => this._step());
        this._q('[data-run]').addEventListener('click', () => this._toggleRun());
        this._q('[data-reset]').addEventListener('click', () => this._reset());
    }

    _reset() {
        this.running = false;
        this._q('[data-run]').textContent = '▶ Simuler';
        this.numFrames = Math.max(1, parseInt(this._q('[data-frames]').value) || 3);
        this.seq = this._q('[data-seq]').value.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
        this.step = -1;
        this.frames = new Array(this.numFrames).fill(null);
        this.fifoQueue = [];
        this.history = [];
        this.hits = 0;
        this.faults = 0;
        this._renderRef();
        this._renderFrames();
        this._renderStats();
        this._q('[data-info]').textContent = 'Prêt. Cliquez sur Étape ou Simuler.';
    }

    _step() {
        if (this.running) return;
        if (this.step >= this.seq.length - 1) return;
        this.step++;
        this._processStep(this.step);
        this._renderRef();
        this._renderFrames();
        this._renderStats();
    }

    async _toggleRun() {
        if (this.running) { this.running = false; this._q('[data-run]').textContent = '▶ Simuler'; return; }
        this.running = true;
        this._q('[data-run]').textContent = '⏸ Pause';
        while (this.running && this.step < this.seq.length - 1) {
            this.step++;
            this._processStep(this.step);
            this._renderRef();
            this._renderFrames();
            this._renderStats();
            await new Promise(r => setTimeout(r, 600));
        }
        this.running = false;
        this._q('[data-run]').textContent = '▶ Simuler';
    }

    _processStep(s) {
        const page = this.seq[s];
        const pi = this.frames.indexOf(page);
        if (pi !== -1) {
            this.hits++;
            this.history.push({ page, type: 'hit', hitFrame: pi, frames: this.frames.slice() });
            this._q('[data-info]').textContent = `Hit : page ${page} déjà en mémoire (cadre ${pi}).`;
        } else {
            this.faults++;
            const ei = this.frames.indexOf(null);
            if (ei !== -1) {
                this.frames[ei] = page;
                if (this.algo === 'fifo') this.fifoQueue.push(ei);
                this.history.push({ page, type: 'fault', loadedFrame: ei, victimFrame: -1, frames: this.frames.slice() });
                this._q('[data-info]').textContent = `Fault : page ${page} chargée dans le cadre vide ${ei}.`;
            } else {
                const vi = this._selectVictim(s);
                const victim = this.frames[vi];
                this.frames[vi] = page;
                if (this.algo === 'fifo') this.fifoQueue.push(vi);
                this.history.push({ page, type: 'fault', loadedFrame: vi, victimFrame: vi, victim, frames: this.frames.slice() });
                this._q('[data-info]').textContent = `Fault + Remplacement : page ${victim} (cadre ${vi}) → page ${page}.`;
            }
        }
    }

    _selectVictim(s) {
        if (this.algo === 'fifo') return this.fifoQueue.shift();
        if (this.algo === 'lru') {
            const lu = {};
            for (let i = 0; i <= s; i++) lu[this.seq[i]] = i;
            let lf = 0, lt = Infinity;
            for (let f = 0; f < this.numFrames; f++) {
                const t = lu[this.frames[f]] ?? -1;
                if (t < lt) { lt = t; lf = f; }
            }
            return lf;
        }
        // optimal
        let of_ = 0, md = -1;
        for (let f = 0; f < this.numFrames; f++) {
            let next = Infinity;
            for (let i = s + 1; i < this.seq.length; i++) {
                if (this.seq[i] === this.frames[f]) { next = i; break; }
            }
            if (next > md) { md = next; of_ = f; }
        }
        return of_;
    }

    _renderRef() {
        const area = this._q('[data-ref-row]');
        area.innerHTML = '';
        this.seq.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = 'mpw-rc' + (i === this.step ? ' current' : i < this.step ? ' processed' : '');
            el.textContent = p;
            area.appendChild(el);
        });
    }

    _renderFrames() {
        const area = this._q('[data-frames-area]');
        area.innerHTML = '';
        for (let f = 0; f < this.numFrames; f++) {
            const row = document.createElement('div');
            row.className = 'mpw-frame-row';
            const lbl = document.createElement('div');
            lbl.className = 'mpw-frame-lbl';
            lbl.textContent = 'Cadre ' + f;
            const cells = document.createElement('div');
            cells.className = 'mpw-frame-cells';
            for (let s = 0; s <= this.step; s++) {
                const hs = this.history[s];
                const cell = document.createElement('div');
                cell.className = 'mpw-fc';
                if (hs && hs.frames[f] !== null) {
                    cell.textContent = hs.frames[f];
                    if (s === this.step) {
                        if (hs.type === 'hit' && hs.hitFrame === f) cell.classList.add('hit');
                        else if (hs.type === 'fault' && hs.loadedFrame === f) cell.classList.add('fault');
                        else if (hs.type === 'fault' && hs.victimFrame === f) cell.classList.add('victim');
                    }
                } else {
                    cell.classList.add('empty');
                    cell.textContent = '—';
                }
                cells.appendChild(cell);
            }
            row.appendChild(lbl);
            row.appendChild(cells);
            area.appendChild(row);
        }
    }

    _renderStats() {
        this._q('[data-sp]').textContent = this.step >= 0 ? this.seq[this.step] : '--';
        this._q('[data-sh]').textContent = this.hits;
        this._q('[data-sf]').textContent = this.faults;
        const total = this.hits + this.faults;
        this._q('[data-sr]').textContent = total > 0 ? (this.hits / total * 100).toFixed(1) + '%' : '--';
    }
}

if (typeof window !== 'undefined') {
    window.MemoryWidget = MemoryWidget;
}
