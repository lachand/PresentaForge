/**
 * QuickSortVisualizer — visualisation du tri rapide (Lomuto, pivot = dernier).
 *
 * L'algorithme (récursion simulée par pile) vit dans
 * shared/components/algorithms/sort-traces.js → buildQuickSortTrace().
 * Cette classe est l'ADAPTATEUR PAGE ; QuickSortWidget l'ADAPTATEUR SLIDE.
 * Tous deux consomment la même trace via TracePlayer.
 */
class QuickSortVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.numbers = [];
        this.originalNumbers = [];
        this.size = 8;
        this.minValue = 1;
        this.maxValue = 100;
    }

    async init() {
        await super.init();
        const cfg = this.data?.visualization?.config;
        this.size = cfg?.size || 8;
        this.minValue = cfg?.minValue ?? 1;
        this.maxValue = cfg?.maxValue ?? 100;
        this.reset();
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/sort-traces.js'];
    }

    buildTrace() {
        if (typeof OEITrace === 'undefined') return [];
        return OEITrace.buildQuickSortTrace([...this.originalNumbers]);
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

        const r = (step.view && step.view.range) || null;
        const swap = step.marks.swap;
        const opts = {
            pivotIndex: step.marks.pivot.length ? step.marks.pivot[0] : (r ? r.pivotIndex : -1),
            low: step.marks.range ? step.marks.range[0] : (r ? r.low : -1),
            high: step.marks.range ? step.marks.range[1] : (r ? r.high : -1),
            splitIndex: r ? r.splitIndex : -1,
            sortedIndices: step.marks.sorted
        };
        if (swap.length === 2) {
            opts.swapIndex1 = swap[0];
            opts.swapIndex2 = swap[1];
            if (step.anim === 'swap') {
                opts.animateSwap = true;
                opts.swapDurationMs = this.getSwapAnimationDuration();
            }
        }
        this.renderArray(this.numbers, opts);
        this.updatePanels(step);
    }

    onPlayerState(state) {
        const btn = document.querySelector('[data-inline-onclick="page.startSort()"]');
        if (btn) btn.textContent = state.playing ? 'Pause' : (state.atEnd ? 'Rejouer' : 'Lancer le tri rapide');
    }

    // ── helpers DOM conservés ────────────────────────────────────────────────

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    getSwapAnimationDuration() {
        const base = this.getCurrentDelay();
        return Math.max(220, Math.min(680, Math.round(base * 0.72)));
    }

    getPostSwapPause() {
        return Math.max(70, Math.round(this.getCurrentDelay() * 0.3));
    }

    updatePanels(step) {
        const stats = step ? step.stats : { comparisons: 0, swaps: 0, partitions: 0, maxDepth: 0 };
        const v = (step && step.view) || null;
        const r = (v && v.range) || null;

        this.updateInfo('quick-stat-comparisons', String(stats.comparisons || 0));
        this.updateInfo('quick-stat-swaps', String(stats.swaps || 0));
        this.updateInfo('quick-stat-partitions', String(stats.partitions || 0));
        this.updateInfo('quick-stat-depth', String((v && v.maxDepth) || stats.maxDepth || 0));

        this.updateInfo('quick-range', r ? (r.low + '..' + r.high) : '--');
        this.updateInfo('quick-pivot', (r && r.pivotIndex >= 0) ? (r.pivotValue + ' @ ' + r.pivotIndex) : '--');
        this.updateInfo('quick-split', (r && r.splitIndex >= 0) ? String(r.splitIndex) : '--');

        const stackEl = document.getElementById('quick-stack');
        if (stackEl) {
            const stack = (v && v.stack) || [];
            stackEl.innerHTML = stack.length
                ? stack.slice().reverse().map((fr) => '<div class="quick-stack-item">d' + fr.depth + ' : [' + fr.low + '..' + fr.high + ']</div>').join('')
                : '<span class="text-muted text-sm">Pile vide</span>';
        }

        const historyEl = document.getElementById('quick-pivot-history');
        if (historyEl) {
            const hist = (v && v.pivotHistory) || [];
            historyEl.innerHTML = hist.length
                ? hist.slice(-8).reverse().map((e) =>
                    '<div class="quick-history-item"><span class="k">[' + e.low + '..' + e.high + ']</span> ' +
                    '<span class="v">pivot ' + e.value + ' -> index ' + e.finalIndex + '</span></div>').join('')
                : '<span class="text-muted text-sm">Aucun pivot traite.</span>';
        }
    }

    renderArray(array, options = {}) {
        const container = document.getElementById('array-container');
        if (!container) return;
        container.classList.add('quick-array');

        const pivotIndex = options.pivotIndex ?? -1;
        const low = options.low ?? -1;
        const high = options.high ?? -1;
        const swapIndex1 = options.swapIndex1 ?? -1;
        const swapIndex2 = options.swapIndex2 ?? -1;
        const animateSwap = Boolean(options.animateSwap && swapIndex1 >= 0 && swapIndex2 >= 0 && swapIndex1 !== swapIndex2);
        const swapLeft = animateSwap ? Math.min(swapIndex1, swapIndex2) : -1;
        const swapRight = animateSwap ? Math.max(swapIndex1, swapIndex2) : -1;
        const swapDistance = animateSwap ? Math.max(1, swapRight - swapLeft) : 0;
        const swapDuration = animateSwap
            ? Math.max(180, Math.round(options?.swapDurationMs || this.getSwapAnimationDuration()))
            : 0;
        const splitIndex = options.splitIndex ?? -1;
        const sortedIndices = new Set(options.sortedIndices || []);

        container.innerHTML = '';
        array.forEach((value, i) => {
            const element = document.createElement('div');
            element.classList.add('element');
            element.textContent = value;

            if (sortedIndices.has(i)) element.classList.add('sorted');
            if (i === pivotIndex) element.classList.add('pivot');
            if (low >= 0 && high >= 0) {
                if (i >= low && i <= high) element.classList.add('in-range');
                else element.classList.add('outside-range');
            }
            if (pivotIndex >= 0 && i >= low && i <= high && i !== pivotIndex) {
                if (array[i] > array[pivotIndex]) element.classList.add('superieur');
                if (array[i] <= array[pivotIndex]) element.classList.add('inferieur');
            }
            if (splitIndex >= low && low >= 0 && high >= 0) {
                if (i >= low && i <= splitIndex && i !== pivotIndex) element.classList.add('left-partition');
                if (i > splitIndex && i < high) element.classList.add('right-partition');
            }
            if (i === swapIndex1 || i === swapIndex2) element.classList.add('permutation');
            if (animateSwap && (i === swapLeft || i === swapRight)) {
                element.style.setProperty('--swap-shift', `calc(${swapDistance} * (100% + 0.5rem))`);
                element.style.setProperty('--swap-duration', `${swapDuration}ms`);
                if (i === swapLeft) element.classList.add('quick-swap-left');
                else element.classList.add('quick-swap-right');
            }

            container.appendChild(element);
        });
    }

    render() {
        this.renderArray(this.numbers, {});
    }

    reset() {
        this.numbers = Array.from({ length: this.size }, () => this.randomInt(this.minValue, this.maxValue));
        this.originalNumbers = [...this.numbers];
        this.invalidateTrace();
        this.clearHighlight();
        if (this.player) {
            this.player.reset();
        } else {
            this.render();
            this.updatePanels(null);
        }
    }
}

if (typeof window !== 'undefined') {
    window.QuickSortVisualizer = QuickSortVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickSortWidget — adaptateur SLIDE. Même trace (buildQuickSortTrace) via TracePlayer.
// ─────────────────────────────────────────────────────────────────────────────
class QuickSortWidget {
    static mount(container, config = {}) {
        const w = new QuickSortWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = Array.from({ length: 8 }, () => Math.floor(Math.random() * 85) + 5);
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 14) : defaultData;
        this.baseInterval = 500;
        this._trace = null;
        this.player = null;
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
        this.root.innerHTML = `<div class="sw-container">
            <div class="sw-header"><span>Tri rapide (Lomuto)</span><span class="sw-metrics"></span></div>
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
                if (!this._trace) {
                    this._trace = (typeof OEITrace !== 'undefined')
                        ? OEITrace.buildQuickSortTrace([...this.originalData]) : [];
                }
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
        const pivot = step.marks.pivot.length ? step.marks.pivot[0] : -1;
        const current = new Set([...step.marks.compare, ...step.marks.active]);
        const bound = step.vars.i;

        zone.innerHTML = '';
        numbers.forEach((v, idx) => {
            const bar = document.createElement('div');
            bar.className = 'sw-bar';
            if (sorted.has(idx)) bar.classList.add('sorted');
            else if (idx === pivot) bar.classList.add('pivot-mark');
            else if (current.has(idx)) bar.classList.add('current');
            else if (idx === bound) bar.classList.add('bound-mark');
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
    window.QuickSortWidget = QuickSortWidget;
}
