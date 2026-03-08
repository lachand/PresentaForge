/**
 * QuickSortVisualizer - Visualisation du tri rapide (Lomuto)
 */
class QuickSortVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.numbers = [];
        this.size = 8;
        this.minValue = 1;
        this.maxValue = 100;
        this.isRunning = false;

        this.comparisonCount = 0;
        this.swapCount = 0;
        this.partitionCount = 0;
        this.maxDepth = 0;
        this.currentRange = null;
        this.recursionStack = [];
        this.pivotHistory = [];
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        const cfg = this.data?.visualization?.config;
        this.size = cfg?.size || 8;
        this.minValue = cfg?.minValue ?? 1;
        this.maxValue = cfg?.maxValue ?? 100;
        this.reset();
    }

    renderPseudocodeFromData() {
        const host = document.getElementById('pseudocode-container');
        if (!host) return;
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks) || blocks.length === 0) return;

        const ids = [
            '', 'if-low-high', 'partition-call', 'recursion-left', 'recursion-right',
            '', '', 'pivot-setup', 'index-setup', 'for-loop', 'if-condition',
            'increment-i', 'swap-elements', 'final-swap', 'return-pivot'
        ];

        const lines = [];
        let cursor = 0;
        blocks.forEach((block) => {
            (block.lines || []).forEach((line) => {
                const id = ids[cursor] || '';
                const attr = id ? (' id="' + id + '"') : '';
                const content = (typeof PseudocodeSupport !== 'undefined')
                    ? PseudocodeSupport.renderLineContent(line, {
                        autoKeywordHighlight: true,
                        domain: this.data?.metadata?.category
                    })
                    : this.escapeHtml(line);
                lines.push('<span class="line"' + attr + '>' + content + '</span>');
                cursor++;
            });
        });

        host.innerHTML = '<div class="card algorithm-code">' + lines.join('') + '</div>';
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    resetSimulationStats() {
        this.comparisonCount = 0;
        this.swapCount = 0;
        this.partitionCount = 0;
        this.maxDepth = 0;
        this.currentRange = null;
        this.recursionStack = [];
        this.pivotHistory = [];
        this.updatePanels();
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    getSwapAnimationDuration() {
        const base = this.getCurrentDelay();
        return Math.max(220, Math.min(680, Math.round(base * 0.72)));
    }

    getPostSwapPause() {
        return Math.max(70, Math.round(this.getCurrentDelay() * 0.3));
    }

    updatePanels() {
        const compEl = document.getElementById('quick-stat-comparisons');
        const swapEl = document.getElementById('quick-stat-swaps');
        const partitionEl = document.getElementById('quick-stat-partitions');
        const depthEl = document.getElementById('quick-stat-depth');
        const rangeEl = document.getElementById('quick-range');
        const pivotEl = document.getElementById('quick-pivot');
        const splitEl = document.getElementById('quick-split');
        const stackEl = document.getElementById('quick-stack');
        const historyEl = document.getElementById('quick-pivot-history');

        if (compEl) compEl.textContent = String(this.comparisonCount);
        if (swapEl) swapEl.textContent = String(this.swapCount);
        if (partitionEl) partitionEl.textContent = String(this.partitionCount);
        if (depthEl) depthEl.textContent = String(this.maxDepth);

        if (rangeEl) {
            if (!this.currentRange) rangeEl.textContent = '--';
            else rangeEl.textContent = this.currentRange.low + '..' + this.currentRange.high;
        }

        if (pivotEl) {
            if (!this.currentRange || this.currentRange.pivotIndex < 0) pivotEl.textContent = '--';
            else pivotEl.textContent = this.currentRange.pivotValue + ' @ ' + this.currentRange.pivotIndex;
        }

        if (splitEl) {
            if (!this.currentRange || this.currentRange.splitIndex < 0) splitEl.textContent = '--';
            else splitEl.textContent = String(this.currentRange.splitIndex);
        }

        if (stackEl) {
            if (!this.recursionStack.length) {
                stackEl.innerHTML = '<span class="text-muted text-sm">Pile vide</span>';
            } else {
                stackEl.innerHTML = this.recursionStack
                    .slice()
                    .reverse()
                    .map((frame) => {
                        return '<div class="quick-stack-item">d' + frame.depth + ' : [' + frame.low + '..' + frame.high + ']</div>';
                    })
                    .join('');
            }
        }

        if (historyEl) {
            if (!this.pivotHistory.length) {
                historyEl.innerHTML = '<span class="text-muted text-sm">Aucun pivot traite.</span>';
            } else {
                historyEl.innerHTML = this.pivotHistory
                    .slice(-8)
                    .reverse()
                    .map((entry) => {
                        return '<div class="quick-history-item">' +
                            '<span class="k">[' + entry.low + '..' + entry.high + ']</span> ' +
                            '<span class="v">pivot ' + entry.value + ' -> index ' + entry.finalIndex + '</span>' +
                            '</div>';
                    })
                    .join('');
            }
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
        this.updatePanels();
    }

    async partition(array, low, high, depth) {
        this.partitionCount += 1;

        this.highlightLine('pivot-setup');
        const pivot = array[high];
        this.currentRange = {
            low,
            high,
            pivotIndex: high,
            pivotValue: pivot,
            splitIndex: -1,
            depth
        };
        this.updatePanels();
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('index-setup');
        let i = low - 1;
        await OEIUtils.sleep(this.getCurrentDelay());

        for (let j = low; j < high; j++) {
            this.highlightLine('for-loop');
            this.renderArray(array, {
                pivotIndex: high,
                low,
                high,
                swapIndex1: i + 1,
                swapIndex2: j,
                splitIndex: i
            });
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('if-condition');
            this.comparisonCount += 1;
            this.updatePanels();
            if (array[j] <= pivot) {
                await OEIUtils.sleep(this.getCurrentDelay(0.5));
                this.highlightLine('increment-i');
                i++;
                await OEIUtils.sleep(this.getCurrentDelay(0.5));

                this.highlightLine('swap-elements');
                this.currentRange.splitIndex = i;
                if (i !== j) {
                    const swapDuration = this.getSwapAnimationDuration();
                    this.renderArray(array, {
                        pivotIndex: high,
                        low,
                        high,
                        swapIndex1: i,
                        swapIndex2: j,
                        splitIndex: i,
                        animateSwap: true,
                        swapDurationMs: swapDuration
                    });
                    await OEIUtils.sleep(swapDuration);

                    [array[i], array[j]] = [array[j], array[i]];
                    this.swapCount += 1;
                    this.renderArray(array, {
                        pivotIndex: high,
                        low,
                        high,
                        splitIndex: i
                    });
                    this.updatePanels();
                    await OEIUtils.sleep(this.getPostSwapPause());
                } else {
                    this.renderArray(array, {
                        pivotIndex: high,
                        low,
                        high,
                        swapIndex1: i,
                        swapIndex2: j,
                        splitIndex: i
                    });
                    await OEIUtils.sleep(this.getCurrentDelay(0.35));
                }
            }
        }

        this.highlightLine('final-swap');
        const finalLeft = i + 1;
        const finalRight = high;
        if (finalLeft !== finalRight) {
            const finalSwapDuration = this.getSwapAnimationDuration();
            this.renderArray(array, {
                pivotIndex: high,
                low,
                high,
                swapIndex1: finalLeft,
                swapIndex2: finalRight,
                splitIndex: finalLeft,
                animateSwap: true,
                swapDurationMs: finalSwapDuration
            });
            await OEIUtils.sleep(finalSwapDuration);
            [array[finalLeft], array[finalRight]] = [array[finalRight], array[finalLeft]];
            this.swapCount += 1;
            await OEIUtils.sleep(this.getPostSwapPause());
        }
        this.currentRange.pivotIndex = i + 1;
        this.currentRange.splitIndex = i + 1;
        this.renderArray(array, {
            pivotIndex: i + 1,
            low,
            high,
            swapIndex1: i + 1,
            swapIndex2: high,
            splitIndex: i + 1
        });
        this.pivotHistory.push({
            low,
            high,
            value: pivot,
            finalIndex: i + 1
        });
        this.updatePanels();
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('return-pivot');
        await OEIUtils.sleep(this.getCurrentDelay(0.6));
        return i + 1;
    }

    async quickSort(array, low, high, depth = 1) {
        if (low < high) {
            this.recursionStack.push({ low, high, depth });
            this.maxDepth = Math.max(this.maxDepth, depth);
            this.updatePanels();

            this.highlightLine('if-low-high');
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('partition-call');
            const pivotIndex = await this.partition(array, low, high, depth);

            this.highlightLine('recursion-left');
            await this.quickSort(array, low, pivotIndex - 1, depth + 1);

            this.highlightLine('recursion-right');
            await this.quickSort(array, pivotIndex + 1, high, depth + 1);

            this.recursionStack.pop();
            this.updatePanels();
        }
    }

    async startSort() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.resetSimulationStats();

        await this.quickSort(this.numbers, 0, this.numbers.length - 1, 1);
        this.clearHighlight();
        this.currentRange = null;
        this.recursionStack = [];
        this.renderArray(this.numbers, { sortedIndices: this.numbers.map((_, idx) => idx) });
        this.updatePanels();
        this.isRunning = false;
    }

    reset() {
        if (this.isRunning) return;
        this.numbers = Array.from({ length: this.size }, () => this.randomInt(this.minValue, this.maxValue));
        this.resetSimulationStats();
        this.clearHighlight();
        this.render();
    }
}

if (typeof window !== 'undefined') {
    window.QuickSortVisualizer = QuickSortVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickSortWidget — Widget autonome pour intégration dans les slides
// Algorithme : Lomuto partition scheme (pivot = dernier élément)
// Usage : QuickSortWidget.mount(container, { data: [...] })
// ─────────────────────────────────────────────────────────────────────────────
class QuickSortWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (QuickSortWidget._stylesInjected) return;
        QuickSortWidget._stylesInjected = true;
        // Reuse SortingWidget styles if already injected, else inject minimal subset
        if (!document.querySelector('style[data-sw]')) {
            const s = document.createElement('style');
            s.setAttribute('data-sw', '1');
            s.textContent = `
.sw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.sw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.sw-array-zone{display:flex;align-items:flex-end;gap:4px;height:140px;padding-top:24px;padding-bottom:20px;}
.sw-bar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex:1;position:relative;}
.sw-bar-inner{width:100%;border-radius:4px 4px 0 0;background:var(--sl-primary,#6366f1);transition:height .25s,background .2s;border:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.sw-bar.current .sw-bar-inner{background:var(--sl-accent,#f97316);}
.sw-bar.swapping .sw-bar-inner{background:#ef4444;}
.sw-bar.sorted .sw-bar-inner{background:#22c55e;}
.sw-bar.pivot-mark .sw-bar-inner{background:#eab308;}
.sw-bar.bound-mark .sw-bar-inner{background:#6366f1;opacity:.5;}
.sw-val{position:absolute;top:-18px;font-size:10px;color:var(--sl-text,#e2e8f0);}
.sw-idx{position:absolute;bottom:-16px;font-size:9px;color:var(--sl-muted,#94a3b8);}
.sw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;display:flex;justify-content:space-between;}
.sw-action{flex:1;opacity:.9;}
.sw-metrics{color:var(--sl-muted,#94a3b8);white-space:nowrap;}
.sw-controls{display:flex;gap:8px;flex-wrap:wrap;}
.sw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.sw-btn:hover:not(:disabled){opacity:.8;}
.sw-btn:disabled{opacity:.35;cursor:not-allowed;}
.sw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
            document.head.appendChild(s);
        }
    }

    static mount(container, config = {}) {
        QuickSortWidget.ensureStyles();
        const w = new QuickSortWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = Array.from({length: 8}, () => Math.floor(Math.random() * 85) + 5);
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 14) : defaultData;
        this._resetState();
        this._timer = null;
        this.isRunning = false;
    }

    _resetState() {
        this.numbers = [...this.originalData];
        this.n = this.numbers.length;
        this.compCount = 0;
        this.swapCount = 0;
        this.sortedIndices = new Set();
        this.pivotIdx = -1;
        this.activeIdx = -1;
        this.boundIdx = -1;
        this.action = 'Prêt — cliquez ▶ Lancer ou Étape';
        this.done = false;
        // Use explicit stack to avoid recursion (for step-by-step)
        this._stack = [[0, this.n - 1]];
        this._currentPartition = null; // { lo, hi, pivotVal, i, j }
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
        this._render();
        this._bindControls();
    }

    _render() {
        const zone = this.root.querySelector('.sw-array-zone');
        if (!zone) return;
        const max = Math.max(...this.numbers, 1);
        zone.innerHTML = '';
        this.numbers.forEach((v, idx) => {
            const bar = document.createElement('div');
            bar.className = 'sw-bar';
            if (this.sortedIndices.has(idx)) bar.classList.add('sorted');
            else if (idx === this.pivotIdx) bar.classList.add('pivot-mark');
            else if (idx === this.activeIdx) bar.classList.add('current');
            else if (idx === this.boundIdx) bar.classList.add('bound-mark');
            const px = Math.max(6, Math.round((v / max) * 110));
            bar.innerHTML = `<span class="sw-val">${v}</span><div class="sw-bar-inner" style="height:${px}px"></div><span class="sw-idx">${idx}</span>`;
            zone.appendChild(bar);
        });
        const act = this.root.querySelector('.sw-action');
        if (act) act.textContent = this.action;
        const met = this.root.querySelector('.sw-metrics');
        if (met) met.textContent = `Comp: ${this.compCount}  Ech: ${this.swapCount}`;
    }

    _bindControls() {
        this.root.querySelector('.sw-btn-play')?.addEventListener('click', () => this._togglePlay());
        this.root.querySelector('.sw-btn-step')?.addEventListener('click', () => { this._stop(); this._step(); });
        this.root.querySelector('.sw-btn-reset')?.addEventListener('click', () => { this._stop(); this._resetState(); this._render(); });
    }

    _togglePlay() {
        if (this.isRunning) { this._stop(); return; }
        if (this.done) { this._resetState(); this._render(); }
        this.isRunning = true;
        const btn = this.root.querySelector('.sw-btn-play');
        if (btn) btn.textContent = '⏸ Pause';
        this._run();
    }

    _stop() {
        this.isRunning = false;
        clearTimeout(this._timer);
        const btn = this.root.querySelector('.sw-btn-play');
        if (btn) btn.textContent = '▶ Lancer';
    }

    _run() {
        if (!this.isRunning || this.done) { this._stop(); return; }
        this._step();
        if (!this.done) this._timer = setTimeout(() => this._run(), 500);
    }

    _step() {
        if (this.done) return;
        const a = this.numbers;

        // If we have an active partition in progress, do one comparison step
        if (this._currentPartition) {
            const p = this._currentPartition;
            if (p.j < p.hi) {
                this.compCount++;
                this.activeIdx = p.j;
                this.boundIdx = p.i;
                if (a[p.j] <= p.pivotVal) {
                    p.i++;
                    if (p.i !== p.j) {
                        [a[p.i], a[p.j]] = [a[p.j], a[p.i]];
                        this.swapCount++;
                        this.action = `a[${p.j}]=${a[p.i]} ≤ pivot=${p.pivotVal} → échange avec [${p.i}]`;
                    } else {
                        this.action = `a[${p.j}]=${a[p.j]} ≤ pivot=${p.pivotVal} → OK (déjà en place)`;
                    }
                } else {
                    this.action = `a[${p.j}]=${a[p.j]} > pivot=${p.pivotVal} → laisser à droite`;
                }
                p.j++;
                this._render();
                return;
            }
            // End of partition — place pivot
            [a[p.i + 1], a[p.hi]] = [a[p.hi], a[p.i + 1]];
            const pivotFinalIdx = p.i + 1;
            if (p.i + 1 !== p.hi) this.swapCount++;
            this.sortedIndices.add(pivotFinalIdx);
            this.pivotIdx = -1;
            this.activeIdx = -1;
            this.boundIdx = -1;
            this.action = `Pivot=${p.pivotVal} placé à sa position finale [${pivotFinalIdx}]`;
            // Push sub-arrays to stack
            if (pivotFinalIdx - 1 > p.lo) this._stack.push([p.lo, pivotFinalIdx - 1]);
            if (pivotFinalIdx + 1 < p.hi) this._stack.push([pivotFinalIdx + 1, p.hi]);
            this._currentPartition = null;
            this._render();
            return;
        }

        // Start next sub-array from stack
        if (this._stack.length === 0) {
            // Mark all remaining as sorted
            for (let k = 0; k < this.n; k++) this.sortedIndices.add(k);
            this.done = true;
            this.pivotIdx = -1;
            this.action = '✅ Tableau trié !';
            this._stop();
            this._render();
            return;
        }

        const [lo, hi] = this._stack.pop();
        if (lo >= hi) {
            if (lo === hi) this.sortedIndices.add(lo);
            this._step(); // recurse to get next valid segment
            return;
        }
        this.pivotIdx = hi;
        this.action = `Nouveau segment [${lo}..${hi}], pivot = a[${hi}] = ${a[hi]}`;
        this._currentPartition = { lo, hi, pivotVal: a[hi], i: lo - 1, j: lo };
        this._render();
    }
}

if (typeof window !== 'undefined') {
    window.QuickSortWidget = QuickSortWidget;
}
