/**
 * SortingVisualizer — visualisation des tris élémentaires sur tableau.
 *
 * Algorithmes : bubble-sort, insertion-sort, selection-sort.
 *
 * L'algorithme lui-même vit dans `shared/components/algorithms/sort-traces.js`
 * (générateur de trace pur). Cette classe est un ADAPTATEUR PAGE mince :
 *   - buildTrace()  → délègue au générateur (aucune boucle sur les données)
 *   - renderStep()  → rend un pas dans le DOM de la page de cours
 *   - reset()       → régénère un tableau aléatoire et recharge la trace
 * Le transport (play/pause/pas-à-pas, curseur de vitesse) est fourni par
 * TracePlayer via SimulationPage.
 */
class SortingVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.numbers = [];
        this.originalNumbers = [];
        this.n = 0;

        this.defaultSize = 8;
        this.minValue = 0;
        this.maxValue = 99;
        this.algorithm = 'bubble-sort';

        this.recentCaptions = [];
        this.maxRecentCaptions = 12;
    }

    async init() {
        await super.init();

        const cfg = this.data?.visualization?.config;
        this.defaultSize = cfg?.size || 8;
        this.minValue = cfg?.minValue ?? 0;
        this.maxValue = cfg?.maxValue ?? 99;
        this.algorithm = cfg?.algorithm || this.data?.metadata?.algorithm || 'bubble-sort';

        this.bindPedagogyModeToggle();
        this.reset();
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/sort-traces.js'];
    }

    buildTrace() {
        const src = [...this.originalNumbers];
        if (typeof OEITrace === 'undefined') return [];
        if (this.algorithm === 'insertion-sort') return OEITrace.buildInsertionTrace(src);
        if (this.algorithm === 'selection-sort') return OEITrace.buildSelectionTrace(src);
        return OEITrace.buildBubbleTrace(src);
    }

    stepDelay(step) {
        switch (step && step.delay) {
            case 'swap': return this.getSwapAnimationDuration();
            case 'postswap': return this.getPostSwapPause();
            case 'half': return this.getCurrentDelay(0.75);
            default: return this.getCurrentDelay();
        }
    }

    renderStep(step) {
        if (!step) return;
        this.numbers = step.array.slice();
        this.n = this.numbers.length;

        const options = {};
        if (step.anim === 'swap') {
            options.animateSwap = true;
            options.swapDurationMs = this.getSwapAnimationDuration();
        }
        if (step.insertion) {
            options.insertionKey = step.insertion.key;
            options.insertionTargetIndex = step.insertion.targetIndex;
        }

        const swapping = step.marks.swap.length ? step.marks.swap : [];
        const sorted = step.marks.sorted;
        this.renderArray(swapping, sorted, this.buildPointerMap(step), options);

        this.updatePanels(step);
    }

    onPlayerState(state) {
        const startBtn = document.querySelector('[data-inline-onclick="page.startSort()"]');
        if (startBtn) {
            startBtn.textContent = state.playing ? 'Pause' : (state.atEnd ? 'Rejouer' : 'Démarrer le tri');
        }
    }

    // ── construction des pointeurs / panneaux depuis un pas ──────────────────

    buildPointerMap(step) {
        const pointers = new Map();
        const n = this.numbers.length;
        const add = (index, label) => {
            if (!Number.isInteger(index) || index < 0 || index >= n) return;
            const existing = pointers.get(index) || [];
            if (!existing.includes(label)) existing.push(label);
            pointers.set(index, existing);
        };

        const v = step.vars;
        if (this.algorithm === 'bubble-sort') {
            if (step.marks.compare.length >= 2 || step.marks.swap.length >= 2) {
                const pair = (step.marks.swap.length ? step.marks.swap : step.marks.compare).slice().sort((a, b) => a - b);
                add(pair[0], 'j');
                add(pair[1], 'j+1');
            } else if (v.j != null) {
                add(v.j, 'j');
                add(v.j + 1, 'j+1');
            }
            if (v.i != null) add(n - v.i - 1, 'lim');
        } else if (this.algorithm === 'insertion-sort') {
            if (v.i != null) add(v.i, 'i');
            if (v.j != null) add(v.j, 'j');
            if (step.insertion) add(step.insertion.targetIndex, 'ins');
        } else if (this.algorithm === 'selection-sort') {
            if (v.i != null) add(v.i, 'i');
            if (v.j != null) add(v.j, 'j');
            if (v.minIndex != null) add(v.minIndex, 'min');
        }
        return pointers;
    }

    updatePanels(step) {
        this.updateInfo('sort-metric-comparisons', String(step.stats.comparisons));
        this.updateInfo('sort-metric-writes', String(step.stats.writes));

        const zones = this.describeZones(step.marks.sorted);
        this.updateInfo('sort-zone-sorted', zones.sorted);
        this.updateInfo('sort-zone-unsorted', zones.unsorted);

        const v = step.vars;
        this.updateInfo('sort-var-i', this.formatVar(v.i));
        this.updateInfo('sort-var-j', this.formatVar(v.j));
        this.updateInfo('sort-var-min', this.formatVar(v.minIndex));
        this.updateInfo('sort-var-key', this.formatVar(v.key));
        this.updateInfo('sort-var-n', String(this.numbers.length));

        this.updateInfo('sort-current-action', step.caption || 'En attente.');
        this.renderTraceList(step);
    }

    renderTraceList(step) {
        const traceEl = document.getElementById('sort-trace-list');
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

    // ── helpers DOM conservés ────────────────────────────────────────────────

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    initArray() {
        this.originalNumbers = Array.from(
            { length: this.defaultSize },
            () => this.randomInt(this.minValue, this.maxValue)
        );
        this.numbers = [...this.originalNumbers];
        this.n = this.numbers.length;
    }

    formatVar(value) {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return '-';
            if (value < 0) return '-';
        }
        return String(value);
    }

    renderArray(swappingIndices = [], sortedIndices = [], pointerMap = null, options = {}) {
        const arrayDiv = document.getElementById('array');
        if (!arrayDiv) return;
        arrayDiv.classList.add('sorting-array');

        arrayDiv.innerHTML = '';
        const swapping = new Set(swappingIndices || []);
        const swappingList = [...swapping].sort((a, b) => a - b);
        const swapLeft = swappingList.length >= 2 ? swappingList[0] : -1;
        const swapRight = swappingList.length >= 2 ? swappingList[swappingList.length - 1] : -1;
        const animateSwap = Boolean(options && options.animateSwap && swapLeft >= 0 && swapRight > swapLeft);
        const swapDuration = animateSwap
            ? Math.max(180, Math.round(options?.swapDurationMs || this.getSwapAnimationDuration()))
            : 0;
        const swapDistance = animateSwap ? Math.max(1, swapRight - swapLeft) : 0;
        const sorted = new Set(sortedIndices || []);
        const pointers = pointerMap || new Map();
        const hasInsertionKey = Object.prototype.hasOwnProperty.call(options || {}, 'insertionKey')
            && options.insertionKey !== null
            && options.insertionKey !== undefined;
        const insertionTargetIndex = Number.isInteger(options?.insertionTargetIndex)
            ? options.insertionTargetIndex
            : -1;

        this.numbers.forEach((num, index) => {
            const slot = document.createElement('div');
            slot.className = 'array-slot';
            if (animateSwap && index === swapLeft && swapRight === swapLeft + 1) {
                slot.classList.add('swap-pair-start');
            }
            const isInsertionTarget = hasInsertionKey && index === insertionTargetIndex;
            if (isInsertionTarget) slot.classList.add('insertion-target');

            const pointerRow = document.createElement('div');
            pointerRow.className = 'array-pointer-row';
            const labels = pointers.get(index) || [];
            labels.forEach((label) => {
                const badge = document.createElement('span');
                badge.className = 'pointer-badge sort-pointer';
                badge.textContent = label;
                pointerRow.appendChild(badge);
            });

            const item = document.createElement('div');
            item.className = 'array-item';
            if ((labels || []).length > 0) item.classList.add('current');
            if (swapping.has(index)) item.classList.add('swapping');
            if (animateSwap && (index === swapLeft || index === swapRight)) {
                item.style.setProperty('--swap-shift', `calc(${swapDistance} * (100% + 0.5rem))`);
                item.style.setProperty('--swap-duration', `${swapDuration}ms`);
            }
            if (animateSwap && index === swapLeft) item.classList.add('swap-anim-left');
            else if (animateSwap && index === swapRight) item.classList.add('swap-anim-right');
            if (sorted.has(index)) item.classList.add('sorted');
            else item.classList.add('unsorted-zone');
            if (isInsertionTarget) item.classList.add('insertion-target');
            item.textContent = num;

            if (isInsertionTarget) {
                const keyChip = document.createElement('div');
                keyChip.className = 'insertion-key-chip';
                keyChip.textContent = 'key=' + options.insertionKey;
                slot.appendChild(keyChip);
            }

            const indexLabel = document.createElement('div');
            indexLabel.className = 'array-index-label';
            indexLabel.textContent = String(index);

            slot.appendChild(pointerRow);
            slot.appendChild(item);
            slot.appendChild(indexLabel);
            arrayDiv.appendChild(slot);
        });
    }

    render() {
        this.renderArray([], [], new Map());
    }

    describeZones(sortedIndices) {
        const n = this.numbers.length;
        const sorted = Array.from(new Set(sortedIndices || [])).sort((a, b) => a - b);
        const sortedCount = sorted.length;

        if (n === 0) return { sorted: '-', unsorted: '-' };
        if (sortedCount === 0) return { sorted: 'Aucune', unsorted: '0..' + (n - 1) };
        if (sortedCount === n) return { sorted: '0..' + (n - 1), unsorted: 'Aucune (termine)' };

        const isPrefix = sorted.every((idx, pos) => idx === pos);
        if (isPrefix) {
            return { sorted: 'Prefixe 0..' + (sortedCount - 1), unsorted: sortedCount + '..' + (n - 1) };
        }
        const start = n - sortedCount;
        const isSuffix = sorted.every((idx, pos) => idx === start + pos);
        if (isSuffix) {
            return { sorted: 'Suffixe ' + start + '..' + (n - 1), unsorted: '0..' + (start - 1) };
        }
        return { sorted: sortedCount + ' cases validees', unsorted: (n - sortedCount) + ' cases restantes' };
    }

    getSwapAnimationDuration() {
        const base = this.getCurrentDelay();
        return Math.max(220, Math.min(680, Math.round(base * 0.72)));
    }

    getPostSwapPause() {
        return Math.max(70, Math.round(this.getCurrentDelay() * 0.28));
    }

    // ── reset ────────────────────────────────────────────────────────────────

    reset() {
        this.initArray();
        this.recentCaptions = [];
        this.invalidateTrace();
        this.clearHighlight();

        if (this.player) {
            this.player.reset();
        } else {
            this.render();
            this.updateInfo('sort-metric-comparisons', '0');
            this.updateInfo('sort-metric-writes', '0');
            this.updateInfo('sort-current-action', 'Tableau reinitialise. Lance une simulation pour observer les variables.');
        }
    }
}

if (typeof window !== 'undefined') {
    window.SortingVisualizer = SortingVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// SortingWidget — adaptateur SLIDE (autonome, monté par le registre de widgets).
// Consomme la MÊME trace que la page (sort-traces.js) via TracePlayer.
// Couvre : bubble-sort, insertion-sort, selection-sort.
// ─────────────────────────────────────────────────────────────────────────────
class SortingWidget {
    static mount(container, config = {}) {
        const w = new SortingWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.algorithm = config.algorithm || config.type || 'bubble-sort';
        const defaultData = Array.from({ length: 8 }, () => Math.floor(Math.random() * 85) + 5);
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 16) : defaultData;
        this.baseInterval = 500;
        this._trace = null;
        this.player = null;
    }

    _build() {
        const src = [...this.originalData];
        if (typeof OEITrace === 'undefined') return [];
        if (this.algorithm === 'insertion-sort') return OEITrace.buildInsertionTrace(src);
        if (this.algorithm === 'selection-sort') return OEITrace.buildSelectionTrace(src);
        return OEITrace.buildBubbleTrace(src);
    }

    _stepDelayMs(step) {
        const base = this.baseInterval;
        switch (step && step.delay) {
            case 'swap': return Math.round(base * 0.5);
            case 'postswap': return Math.round(base * 0.34);
            case 'half': return Math.round(base * 0.6);
            default: return base;
        }
    }

    init() {
        const algo = this.algorithm.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        this.root.innerHTML = `<div class="sw-container">
            <div class="sw-header"><span>${algo}</span><span class="sw-metrics"></span></div>
            <div class="sw-array-zone"></div>
            <div class="sw-info-bar"><span class="sw-action"></span></div>
            <div class="sw-controls">
                <button class="sw-btn sw-btn-play">▶ Lancer</button>
                <button class="sw-btn sw-btn-step sw-btn-secondary">Étape</button>
                <button class="sw-btn sw-btn-reset sw-btn-secondary">↺ Reset</button>
            </div>
        </div>`;

        if (typeof TracePlayer === 'undefined') {
            this.root.querySelector('.sw-action').textContent = 'Lecture indisponible (TracePlayer absent).';
            return;
        }

        this.player = new TracePlayer({
            getSteps: () => {
                if (!this._trace) this._trace = this._build();
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
        const zone = this.root.querySelector('.sw-array-zone');
        if (!zone || !step) return;
        const numbers = step.array;
        const max = Math.max(...numbers, 1);
        const sorted = new Set(step.marks.sorted);
        const swapping = new Set(step.marks.swap);
        const current = new Set([...step.marks.compare, ...step.marks.active]);
        const done = step.phase === 'done';

        zone.innerHTML = '';
        numbers.forEach((v, idx) => {
            const bar = document.createElement('div');
            bar.className = 'sw-bar';
            if (sorted.has(idx)) bar.classList.add('sorted');
            else if (swapping.has(idx)) bar.classList.add('swapping');
            else if (current.has(idx)) bar.classList.add('current');
            if (this.algorithm === 'selection-sort' && step.vars.minIndex === idx && !done) {
                bar.classList.add('min-mark');
            }
            if (this.algorithm === 'insertion-sort' && step.insertion && step.insertion.targetIndex === idx && !done) {
                bar.classList.add('key-mark');
            }
            const px = Math.max(6, Math.round((v / max) * 110));
            bar.innerHTML = `<span class="sw-val">${v}</span><div class="sw-bar-inner" style="height:${px}px"></div><span class="sw-idx">${idx}</span>`;
            zone.appendChild(bar);
        });

        const act = this.root.querySelector('.sw-action');
        if (act) act.textContent = step.caption;
        const met = this.root.querySelector('.sw-metrics');
        if (met) met.textContent = `Comp: ${step.stats.comparisons}  Ech: ${step.stats.swaps}`;
    }

    _bindControls() {
        this.root.querySelector('.sw-btn-play')?.addEventListener('click', () => this.player.toggle());
        this.root.querySelector('.sw-btn-step')?.addEventListener('click', () => this.player.stepForward());
        this.root.querySelector('.sw-btn-reset')?.addEventListener('click', () => this.player.reset());
    }

    _syncButtons(state) {
        const btn = this.root.querySelector('.sw-btn-play');
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
    window.SortingWidget = SortingWidget;
}
