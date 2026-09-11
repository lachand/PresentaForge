/**
 * SearchVisualizer — recherche séquentielle ET dichotomique.
 *
 * Les deux algorithmes vivent dans shared/components/algorithms/search-traces.js
 * (buildSequentialSearchTrace / buildBinarySearchTrace, purs, génériques sur le
 * type des valeurs — la page compare des chaînes par défaut en dichotomie, le
 * widget slide des entiers, même générateur). Cette classe est l'ADAPTATEUR
 * PAGE ; SearchWidget l'ADAPTATEUR SLIDE.
 */
class SearchVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.algorithm = 'sequential'; // sequential | binary
        this.values = [];
        this.defaultData = [];
        this.target = null;

        // reflets du dernier pas rendu (lecture pratique par les panneaux)
        this.currentIdx = -1;
        this.low = 0;
        this.high = 0;
        this.mid = -1;
        this.midValue = null;
        this.found = false;

        this.recentCaptions = [];
        this.maxRecentCaptions = 12;
    }

    async init() {
        await super.init();
        this.bindPedagogyModeToggle();
        const cfg = this.data?.visualization?.config;
        this.algorithm = cfg?.algorithm || this.algorithm || 'sequential';
        this.defaultData = Array.isArray(cfg?.defaultData) ? cfg.defaultData : [];
        this.reset();
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/search-traces.js'];
    }

    buildTrace() {
        if (typeof OEITrace === 'undefined' || this.target === null) return [];
        return this.algorithm === 'binary'
            ? OEITrace.buildBinarySearchTrace(this.values, this.target)
            : OEITrace.buildSequentialSearchTrace(this.values, this.target);
    }

    stepDelay(step) {
        return step && step.delay === 'quick' ? this.getCurrentDelay(0.35) : this.getCurrentDelay();
    }

    renderStep(step) {
        if (!step) {
            this.renderVisualizer(null);
            this.updatePanels(null);
            return;
        }
        const v = step.vars;
        this.currentIdx = v.currentIdx ?? -1;
        this.low = v.low ?? 0;
        this.high = v.high ?? -1;
        this.mid = v.mid ?? -1;
        this.midValue = this.mid >= 0 ? this.values[this.mid] : null;
        this.found = step.phase === 'found';

        if (step.phase === 'found') {
            const idx = step.marks.found[0];
            this.setResult('Valeur trouvee a l indice ' + idx + ' !', 'ok');
        } else if (step.phase === 'not-found') {
            this.setResult('Valeur non trouvée !', 'bad');
        }

        this.renderVisualizer(step);
        this.updatePanels(step);
        this.renderTraceList(step);
    }

    onPlayerState(state) {
        const btn = document.querySelector('[data-inline-onclick="page.startSearch()"]');
        if (btn) btn.textContent = state.playing ? 'Pause' : 'Démarrer';
    }

    // ── rendu DOM ────────────────────────────────────────────────────────────

    buildPointerMap(step) {
        const pointers = new Map();
        const n = this.values.length;
        const add = (index, label) => {
            if (!Number.isInteger(index) || index < 0 || index >= n) return;
            const existing = pointers.get(index) || [];
            existing.push(label);
            pointers.set(index, existing);
        };
        if (!step) return pointers;
        if (this.algorithm === 'sequential') {
            if (this.currentIdx >= 0) add(this.currentIdx, 'i');
        } else {
            if (this.low >= 0) add(this.low, 'L');
            if (this.high >= 0) add(this.high, 'H');
            if (this.mid >= 0) add(this.mid, 'M');
        }
        return pointers;
    }

    renderVisualizer(step) {
        const vis = document.getElementById('visualizer');
        if (!vis) return;
        vis.innerHTML = '';

        const current = new Set(step ? step.marks.current : []);
        const found = new Set(step ? step.marks.found : []);
        const checked = new Set(step ? step.marks.checked : []);
        const eliminatedLeft = new Set(step ? step.marks.eliminatedLeft : []);
        const eliminatedRight = new Set(step ? step.marks.eliminatedRight : []);
        const rangeMark = step ? step.marks.range : null;
        const pointers = this.buildPointerMap(step);

        this.values.forEach((value, index) => {
            const container = document.createElement('div');
            container.className = 'number-container';

            const cell = document.createElement('div');
            cell.className = 'number';
            cell.id = 'num-' + index;

            if (found.has(index)) {
                cell.classList.add('found');
            } else if (this.algorithm === 'binary') {
                if (eliminatedLeft.has(index)) cell.classList.add('excluded-left', 'eliminated');
                else if (eliminatedRight.has(index)) cell.classList.add('excluded-right', 'eliminated');
                else if (rangeMark && index >= rangeMark[0] && index <= rangeMark[1]) cell.classList.add('active');
                if (current.has(index)) cell.classList.add('mid');
            } else {
                if (current.has(index)) cell.classList.add('current');
                else if (checked.has(index)) cell.classList.add('checked');
            }

            const pointerLayer = document.createElement('div');
            pointerLayer.className = 'array-pointer-row';
            pointerLayer.id = 'pointer-' + index;
            (pointers.get(index) || []).forEach((label) => {
                const badge = document.createElement('span');
                badge.className = 'pointer-badge search-pointer';
                badge.textContent = label;
                pointerLayer.appendChild(badge);
            });

            const text = document.createElement('span');
            text.className = 'number-value';
            text.textContent = value;

            cell.appendChild(pointerLayer);
            cell.appendChild(text);

            const label = document.createElement('div');
            label.className = 'index';
            label.textContent = index;

            container.appendChild(cell);
            container.appendChild(label);
            vis.appendChild(container);
        });
    }

    updatePanels(step) {
        const stats = step ? step.stats : { comparisons: 0, cost: 0 };
        const eliminatedCount = step
            ? (step.marks.eliminatedLeft.length + step.marks.eliminatedRight.length + step.marks.checked.length)
            : 0;

        this.updateInfo('search-cost-total', String(stats.cost || 0));
        this.updateInfo('search-eliminated-count', String(eliminatedCount));
        this.updateInfo('comparisons', this.algorithm === 'sequential' ? 'Comparaisons : ' + (stats.comparisons || 0) : String(stats.comparisons || 0));

        const n = this.values.length;
        if (this.algorithm === 'sequential') {
            this.updateInfo('currentIndex', 'Indice courant : ' + (this.currentIdx >= 0 ? this.currentIdx : '-'));
            this.updateInfo('currentValue', 'Valeur courante : ' + (this.currentIdx >= 0 && this.currentIdx < n ? this.values[this.currentIdx] : '-'));
            const start = this.currentIdx < 0 ? 0 : this.currentIdx;
            this.updateInfo('search-active-range', start <= n - 1 ? (start + '..' + (n - 1)) : '--');

            let visited = 'Aucune';
            let remaining = n > 0 ? ('0..' + (n - 1)) : 'Aucune';
            if (this.currentIdx >= 0 && n > 0) {
                const end = Math.min(this.currentIdx, n - 1);
                visited = '0..' + end;
                remaining = this.found ? 'Aucune (trouve)' : (end + 1 <= n - 1 ? ((end + 1) + '..' + (n - 1)) : 'Aucune');
            }
            this.updateInfo('search-seq-visited-text', visited);
            this.updateInfo('search-seq-remaining-text', remaining);
        } else {
            this.updateInfo('low', 'Indice minimum : ' + this.low);
            this.updateInfo('high', 'Indice maximum : ' + this.high);
            this.updateInfo('mid', 'Indice du milieu : ' + (this.mid >= 0 ? this.mid : '-'));
            this.updateInfo('midValue', 'Valeur du milieu : ' + (this.midValue !== null ? this.midValue : '-'));
            this.updateInfo('search-active-range', this.low <= this.high ? (this.low + '..' + this.high) : '--');
            this.updateInfo('search-active-interval-text', this.low <= this.high ? (this.low + '..' + this.high) : 'Vide');
            this.updateInfo('search-excluded-left-text', this.low > 0 ? ('0..' + (this.low - 1)) : 'Aucun');
            this.updateInfo('search-excluded-right-text', this.high < n - 1 ? ((this.high + 1) + '..' + (n - 1)) : 'Aucun');
        }

        this.updateInfo('search-current-decision', (step && step.caption) || 'En attente.');

        const vars = {
            target: this.target !== null ? this.target : '-',
            current: this.currentIdx,
            currentValue: this.currentIdx >= 0 && this.currentIdx < n ? this.values[this.currentIdx] : '-',
            low: this.low, high: this.high, mid: this.mid,
            comparisons: stats.comparisons || 0, cost: stats.cost || 0
        };
        Object.keys(vars).forEach((key) => {
            const el = document.getElementById('search-var-' + key);
            if (!el) return;
            const value = vars[key];
            el.textContent = (typeof value === 'number' && value < 0) ? '-' : String(value);
        });
    }

    renderTraceList(step) {
        const traceEl = document.getElementById('search-trace-list');
        if (!traceEl) return;
        if (step.i === 0) this.recentCaptions = [];
        if (step.caption) {
            this.recentCaptions.unshift({ step: step.i + 1, text: step.caption });
            if (this.recentCaptions.length > this.maxRecentCaptions) {
                this.recentCaptions = this.recentCaptions.slice(0, this.maxRecentCaptions);
            }
        }
        traceEl.innerHTML = '';
        if (!this.recentCaptions.length) {
            const empty = document.createElement('div');
            empty.className = 'trace-item';
            empty.textContent = 'Aucune etape enregistree.';
            traceEl.appendChild(empty);
            return;
        }
        this.recentCaptions.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'trace-item';
            const badge = document.createElement('span');
            badge.className = 'step';
            badge.textContent = '#' + entry.step;
            row.appendChild(badge);
            row.appendChild(document.createTextNode(entry.text));
            traceEl.appendChild(row);
        });
    }

    setResult(message, type) {
        const result = document.getElementById('result');
        if (!result) return;
        result.textContent = message || '';
        if (type === 'ok') result.style.color = 'var(--accent)';
        else if (type === 'bad') result.style.color = 'var(--danger)';
        else result.style.color = '';
    }

    getTargetInputValue() {
        const raw = document.getElementById('target')?.value?.trim();
        if (!raw) return null;
        if (this.algorithm === 'sequential') {
            const parsed = parseInt(raw, 10);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return raw;
    }

    initData() {
        if (this.defaultData.length > 0) {
            this.values = [...this.defaultData];
            return;
        }
        this.values = this.algorithm === 'binary'
            ? ['abeille', 'banane', 'cerise', 'chat', 'chien', 'elephant', 'fraise', 'girafe', 'lion', 'mouton', 'pomme', 'renard', 'souris', 'tigre', 'zebre']
            : Array.from({ length: 12 }, () => Math.floor(Math.random() * 100));
    }

    // ── contrôles bespoke ────────────────────────────────────────────────────

    async startSearch() {
        const raw = this.getTargetInputValue();
        if (raw === null) {
            this.setResult('Veuillez entrer une valeur valide.', 'bad');
            return;
        }
        this.target = raw;
        this.invalidateTrace();
        this.setResult('', '');
        if (this.player) {
            this.player.reset();
            this.player.play();
        }
    }

    async step() {
        const raw = this.getTargetInputValue();
        if (raw === null) {
            this.setResult('Veuillez entrer une valeur valide.', 'bad');
            return;
        }
        if (this.target !== raw || !this.player) {
            this.target = raw;
            this.invalidateTrace();
            this.setResult('', '');
            if (this.player) this.player.reset();
        }
        if (this.player) this.player.stepForward();
    }

    async stepSearch() {
        await this.step();
    }

    resetSearch() {
        this.target = null;
        this.invalidateTrace();
        this.recentCaptions = [];
        const targetEl = document.getElementById('target');
        if (targetEl) targetEl.value = '';
        this.setResult('', '');
        this.clearHighlight();
        if (this.player) {
            this.player.reset();
        } else {
            this.renderVisualizer(null);
            this.updatePanels(null);
        }
    }

    render() {
        this.renderVisualizer(null);
    }

    reset() {
        this.initData();
        this.resetSearch();
    }
}

if (typeof window !== 'undefined') {
    window.SearchVisualizer = SearchVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchWidget — adaptateur SLIDE. Consomme la MÊME trace (search-traces.js) via
// TracePlayer. Couvre : sequential, binary. DOM .srw-* inchangé.
// ─────────────────────────────────────────────────────────────────────────────
class SearchWidget {
    static mount(container, config = {}) {
        const w = new SearchWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.algorithm = config.algorithm || config.type || 'sequential';
        if (this.algorithm === 'search-sequential') this.algorithm = 'sequential';
        if (this.algorithm === 'search-binary') this.algorithm = 'binary';
        const defaultData = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];
        this.values = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 20) : defaultData;
        if (this.algorithm === 'binary') {
            this.values = [...this.values].sort((a, b) => a - b);
        }
        this.n = this.values.length;
        this.defaultTarget = config.target != null ? Number(config.target) : this.values[Math.floor(this.n * 0.6)];
        this.target = this.defaultTarget;
        this.baseInterval = 600;
        this._trace = null;
        this.player = null;
    }

    _gen() {
        if (typeof OEITrace === 'undefined') return [];
        return this.algorithm === 'binary'
            ? OEITrace.buildBinarySearchTrace(this.values, this.target)
            : OEITrace.buildSequentialSearchTrace(this.values, this.target);
    }

    _stepDelayMs(step) {
        return step && step.delay === 'quick' ? Math.round(this.baseInterval * 0.4) : this.baseInterval;
    }

    /** Relit la cible depuis l'input ; retourne true si une reconstruction de trace est nécessaire. */
    _syncTargetFromInput() {
        const inp = this.root.querySelector('.srw-target-input');
        const v = inp ? parseInt(inp.value, 10) : NaN;
        const next = Number.isNaN(v) ? this.defaultTarget : v;
        if (this._trace === null || next !== this.target) {
            this.target = next;
            this._trace = null;
            return true;
        }
        return false;
    }

    init() {
        const label = this.algorithm === 'binary' ? 'Recherche dichotomique' : 'Recherche séquentielle';
        this.root.innerHTML = `<div class="srw-container">
            <div class="srw-header"><span>${label}</span><span class="srw-metrics"></span></div>
            <div class="srw-input-row">
                <label>Valeur à chercher :</label>
                <input type="number" class="srw-target-input" value="${this.defaultTarget}">
            </div>
            <div class="srw-array-zone"></div>
            <div class="srw-pointer-row"></div>
            <div class="srw-info-bar"><span class="srw-action"></span></div>
            <div class="srw-controls">
                <button class="srw-btn srw-btn-play">▶ Lancer</button>
                <button class="srw-btn srw-btn-step srw-btn-secondary">Étape</button>
                <button class="srw-btn srw-btn-reset srw-btn-secondary">↺ Reset</button>
            </div>
        </div>`;

        if (typeof TracePlayer === 'undefined') {
            this.root.querySelector('.srw-action').textContent = 'Lecture indisponible (TracePlayer absent).';
            return;
        }

        this.player = new TracePlayer({
            getSteps: () => {
                if (!this._trace) this._trace = this._gen();
                return this._trace;
            },
            render: (step) => this._renderStep(step),
            getDelay: () => {
                const p = this.player;
                const step = (p && Array.isArray(p.steps)) ? p.steps[p.cursor] : null;
                return this._stepDelayMs(step);
            },
            onStateChange: (state) => this._syncButtons(state)
        });
        this._bindControls();
        this.player.attach();
    }

    _renderStep(step) {
        if (!step) return;
        const zone = this.root.querySelector('.srw-array-zone');
        if (!zone) return;
        const current = new Set(step.marks.current);
        const found = new Set(step.marks.found);
        const checked = new Set(step.marks.checked);
        const eliminatedLeft = new Set(step.marks.eliminatedLeft);
        const eliminatedRight = new Set(step.marks.eliminatedRight);
        const low = step.vars.low;
        const high = step.vars.high;
        const mid = step.vars.mid;

        zone.innerHTML = '';
        this.values.forEach((v, idx) => {
            const cell = document.createElement('div');
            cell.className = 'srw-cell';
            if (found.has(idx)) {
                cell.classList.add('found');
            } else if (this.algorithm === 'sequential') {
                if (checked.has(idx)) cell.classList.add('checked');
                else if (current.has(idx)) cell.classList.add('current');
            } else {
                if (eliminatedLeft.has(idx) || eliminatedRight.has(idx)) cell.classList.add('eliminated');
                else if (idx === mid && mid >= 0) cell.classList.add('mid-mark');
                else if (idx === low || idx === high) cell.classList.add('low-mark');
            }
            cell.innerHTML = `<span class="srw-val">${v}</span><span class="srw-cell-idx">[${idx}]</span>`;
            zone.appendChild(cell);
        });

        const prow = this.root.querySelector('.srw-pointer-row');
        if (prow && this.algorithm === 'binary') {
            const cells = zone.querySelectorAll('.srw-cell');
            const cellW = cells[0] ? cells[0].offsetWidth : 44;
            prow.innerHTML = '';
            const addPtr = (idx, label, cls) => {
                if (idx == null || idx < 0 || idx >= this.n) return;
                const span = document.createElement('span');
                span.className = `srw-pointer ${cls}`;
                span.textContent = label;
                span.style.marginLeft = (idx * (cellW + 4)) + 'px';
                prow.appendChild(span);
            };
            if (step.phase !== 'found' && step.phase !== 'not-found') {
                addPtr(low, 'low', 'p-low');
                if (mid >= 0 && mid !== low && mid !== high) addPtr(mid, 'mid', 'p-mid');
                if (high !== low) addPtr(high, 'high', 'p-high');
            }
        }

        const act = this.root.querySelector('.srw-action');
        if (act) act.textContent = step.caption;
        const met = this.root.querySelector('.srw-metrics');
        if (met) met.textContent = `Comparaisons : ${step.stats.comparisons}`;
    }

    _bindControls() {
        const inp = this.root.querySelector('.srw-target-input');
        inp?.addEventListener('change', () => {
            const v = parseInt(inp.value, 10);
            if (!Number.isNaN(v)) {
                this.defaultTarget = v;
                this.target = v;
                this._trace = null;
                this.player.pause();
                this.player.reset();
            }
        });
        this.root.querySelector('.srw-btn-play')?.addEventListener('click', () => this._togglePlay());
        this.root.querySelector('.srw-btn-step')?.addEventListener('click', () => {
            if (this._syncTargetFromInput()) this.player.reset();
            this.player.stepForward();
        });
        this.root.querySelector('.srw-btn-reset')?.addEventListener('click', () => {
            this.target = this.defaultTarget;
            this._trace = null;
            this.player.reset();
        });
    }

    _togglePlay() {
        if (this.player.playing) { this.player.pause(); return; }
        if (this._syncTargetFromInput()) this.player.reset();
        this.player.play();
    }

    _syncButtons(state) {
        const btn = this.root.querySelector('.srw-btn-play');
        if (!btn) return;
        btn.textContent = state.playing ? '⏸ Pause' : (state.atEnd ? '↻ Rejouer' : '▶ Lancer');
    }

    destroy() {
        this._destroyed = true;
        if (this.player) this.player.destroy();
        this.player = null;
        this._trace = null;
        if (this.root) this.root.innerHTML = '';
    }
}

if (typeof window !== 'undefined') {
    window.SearchWidget = SearchWidget;
}
