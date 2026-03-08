/**
 * HeapVisualizer - Visualisation d'un tas binaire (min/max)
 *
 * Opérations :
 * - setMode(mode) : Basculer min-heap / max-heap
 * - doInsert() : Insérer une valeur
 * - doExtract() : Extraire la racine
 * - doHeapsort() : Trier via heapsort (ordre croissant)
 * - resetHeap() : Réinitialiser avec les données de démonstration
 */
class HeapVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.heap = [];
        this.mode = 'min';
        this.animating = false;
        this.activeIndices = new Set();
        this.swappingIndices = new Set();
        this.sortedIndices = new Set();
        this.maxElements = 31;
        this.hoverIndex = -1;
        this.hoverSyncBound = false;
        this.swapMotion = null;
    }

    parent(i) {
        return Math.floor((i - 1) / 2);
    }

    left(i) {
        return 2 * i + 1;
    }

    right(i) {
        return 2 * i + 2;
    }

    compare(a, b) {
        return this.mode === 'min' ? a < b : a > b;
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        this.reset();
        this.bindHoverSync();
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
        return Math.max(70, Math.round(this.getCurrentDelay() * 0.28));
    }

    setSwapMotion(a, b, durationMs) {
        if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
            this.swapMotion = null;
            return;
        }
        this.swapMotion = {
            left: Math.min(a, b),
            right: Math.max(a, b),
            distance: Math.max(1, Math.abs(a - b)),
            duration: Math.max(180, Math.round(durationMs || this.getSwapAnimationDuration()))
        };
    }

    clearSwapMotion() {
        this.swapMotion = null;
    }

    bindHoverSync() {
        if (this.hoverSyncBound) return;
        const arrayContainer = document.getElementById('arrayContainer');
        const treeSvg = document.getElementById('treeSvg');
        if (!arrayContainer || !treeSvg) return;

        const setHoverFromTarget = (target) => {
            const idxAttr = target ? target.getAttribute('data-heap-index') : null;
            const idx = idxAttr == null ? -1 : parseInt(idxAttr, 10);
            this.hoverIndex = Number.isNaN(idx) ? -1 : idx;
            this.render();
        };

        arrayContainer.addEventListener('mouseover', (event) => {
            const cell = event.target.closest('[data-heap-index]');
            setHoverFromTarget(cell);
        });
        arrayContainer.addEventListener('mouseout', (event) => {
            if (!arrayContainer.contains(event.relatedTarget)) {
                this.hoverIndex = -1;
                this.render();
            }
        });

        treeSvg.addEventListener('mouseover', (event) => {
            const node = event.target.closest('[data-heap-index]');
            setHoverFromTarget(node);
        });
        treeSvg.addEventListener('mouseout', (event) => {
            if (!treeSvg.contains(event.relatedTarget)) {
                this.hoverIndex = -1;
                this.render();
            }
        });

        this.hoverSyncBound = true;
    }

    renderPseudocodeFromData() {
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks)) return;

        const idPrefix = {
            insert: 'pins',
            extract: 'pext'
        };

        blocks.forEach((block) => {
            const target = document.getElementById('pseudo-' + block.name);
            if (!target) return;

            const prefix = idPrefix[block.name] || (block.name + '-line');
            const lines = (block.lines || []).map((line, idx) => {
                const id = (prefix.endsWith('-line') ? (prefix + idx) : (prefix + (idx + 1)));
                const content = (typeof PseudocodeSupport !== 'undefined')
                    ? PseudocodeSupport.renderLineContent(line, {
                        autoKeywordHighlight: true,
                        domain: this.data?.metadata?.category
                    })
                    : this.escapeHtml(line);
                return '<span class="line" id="' + id + '">' + content + '</span>';
            });

            target.innerHTML = lines.join('');
        });
    }

    setFeedback(message, cls) {
        const feedbackEl = document.getElementById('feedback');
        if (!feedbackEl) return;
        feedbackEl.textContent = message;
        feedbackEl.className = 'feedback ' + cls;
    }

    updateStats() {
        const sizeEl = document.getElementById('statSize');
        const heightEl = document.getElementById('statHeight');
        const rootEl = document.getElementById('statRoot');

        if (sizeEl) sizeEl.textContent = this.heap.length;
        if (heightEl) {
            heightEl.textContent = this.heap.length === 0
                ? 0
                : Math.floor(Math.log2(this.heap.length)) + 1;
        }
        if (rootEl) rootEl.textContent = this.heap.length > 0 ? this.heap[0] : '-';
    }

    renderArray() {
        const container = document.getElementById('arrayContainer');
        if (!container) return;
        container.classList.add('heap-array-animated');

        container.innerHTML = '';
        this.heap.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'heap-arr-cell';

            const idx = document.createElement('div');
            idx.className = 'heap-arr-idx';
            idx.textContent = index;

            const valueEl = document.createElement('div');
            valueEl.className = 'heap-arr-val';
            valueEl.setAttribute('data-heap-index', String(index));
            if (this.activeIndices.has(index)) valueEl.classList.add('active');
            if (this.swappingIndices.has(index)) valueEl.classList.add('swapping');
            if (this.sortedIndices.has(index)) valueEl.classList.add('sorted-cell');
            if (index === this.hoverIndex) valueEl.classList.add('hover-sync');
            if (this.swapMotion && (index === this.swapMotion.left || index === this.swapMotion.right)) {
                valueEl.style.setProperty('--swap-shift', `calc(${this.swapMotion.distance} * (100% + 0.4rem))`);
                valueEl.style.setProperty('--swap-duration', `${this.swapMotion.duration}ms`);
                if (index === this.swapMotion.left) valueEl.classList.add('heap-swap-left');
                if (index === this.swapMotion.right) valueEl.classList.add('heap-swap-right');
            }
            valueEl.textContent = value;

            cell.appendChild(idx);
            cell.appendChild(valueEl);
            container.appendChild(cell);
        });
    }

    renderTree() {
        const svg = document.getElementById('treeSvg');
        if (!svg) return;

        const n = this.heap.length;
        if (n === 0) {
            svg.innerHTML = '';
            return;
        }

        const height = Math.floor(Math.log2(n)) + 1;
        const svgWidth = Math.max(700, Math.pow(2, height) * 50);
        const svgHeight = Math.max(280, height * 75 + 30);
        svg.setAttribute('width', svgWidth);
        svg.setAttribute('height', svgHeight);

        let html = '';
        const positions = [];

        for (let i = 0; i < n; i++) {
            const level = Math.floor(Math.log2(i + 1));
            const posInLevel = i - (Math.pow(2, level) - 1);
            const nodesInLevel = Math.pow(2, level);
            const x = (svgWidth / (nodesInLevel + 1)) * (posInLevel + 1);
            const y = level * 70 + 40;
            positions.push({ x, y });
        }

        for (let i = 0; i < n; i++) {
            const l = this.left(i);
            const r = this.right(i);

            if (l < n) {
                const activeEdge = this.swappingIndices.has(i) && this.swappingIndices.has(l);
                html += '<line x1="' + positions[i].x + '" y1="' + positions[i].y +
                    '" x2="' + positions[l].x + '" y2="' + positions[l].y +
                    '" stroke="' + (activeEdge ? '#ef4444' : '#cbd5e1') +
                    '" stroke-width="2"/>';
            }

            if (r < n) {
                const activeEdge = this.swappingIndices.has(i) && this.swappingIndices.has(r);
                html += '<line x1="' + positions[i].x + '" y1="' + positions[i].y +
                    '" x2="' + positions[r].x + '" y2="' + positions[r].y +
                    '" stroke="' + (activeEdge ? '#ef4444' : '#cbd5e1') +
                    '" stroke-width="2"/>';
            }
        }

        for (let i = 0; i < n; i++) {
            let fill = '#ffffff';
            let stroke = '#4f46e5';
            let textColor = '#1e293b';

            if (this.sortedIndices.has(i)) {
                fill = '#10b981';
                stroke = '#10b981';
                textColor = '#ffffff';
            } else if (this.swappingIndices.has(i)) {
                fill = '#ef4444';
                stroke = '#ef4444';
                textColor = '#ffffff';
            } else if (this.activeIndices.has(i)) {
                fill = '#f59e0b';
                stroke = '#f59e0b';
                textColor = '#ffffff';
            }
            if (i === this.hoverIndex) {
                fill = '#dbeafe';
                stroke = '#2563eb';
                if (this.sortedIndices.has(i)) {
                    fill = '#34d399';
                    stroke = '#059669';
                    textColor = '#ffffff';
                }
            }

            html += '<circle cx="' + positions[i].x + '" cy="' + positions[i].y +
                '" r="22" fill="' + fill + '" stroke="' + stroke +
                '" stroke-width="2.5" data-heap-index="' + i + '"/>';
            html += '<text x="' + positions[i].x + '" y="' + (positions[i].y + 5) +
                '" text-anchor="middle" fill="' + textColor +
                '" font-size="14" font-weight="700" data-heap-index="' + i + '">' + this.heap[i] + '</text>';
        }

        svg.innerHTML = html;
    }

    render() {
        this.renderTree();
        this.renderArray();
        this.updateStats();
    }

    showPseudo(tab, button) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (button) button.classList.add('active');

        const insertEl = document.getElementById('pseudo-insert');
        const extractEl = document.getElementById('pseudo-extract');
        if (insertEl) insertEl.classList.toggle('hidden', tab !== 'insert');
        if (extractEl) extractEl.classList.toggle('hidden', tab !== 'extract');
    }

    setMode(newMode) {
        if (this.animating) return;

        this.mode = newMode;
        const minBtn = document.getElementById('btnMin');
        const maxBtn = document.getElementById('btnMax');
        if (minBtn) minBtn.classList.toggle('active', newMode === 'min');
        if (maxBtn) maxBtn.classList.toggle('active', newMode === 'max');

        const compareLine = document.getElementById('pins4');
        if (compareLine) {
            if (this.mode === 'min') {
                compareLine.innerHTML = '  <span class="keyword">tant que</span> i &gt; 0 <span class="keyword">et</span> tas[i] &lt; tas[parent(i)]:';
            } else {
                compareLine.innerHTML = '  <span class="keyword">tant que</span> i &gt; 0 <span class="keyword">et</span> tas[i] &gt; tas[parent(i)]:';
            }
        }

        this.resetHeap();
    }

    async doInsert() {
        if (this.animating) return;

        const inputEl = document.getElementById('inputVal');
        const value = parseInt(inputEl?.value, 10);

        if (Number.isNaN(value)) {
            this.setFeedback('Veuillez entrer un nombre.', 'error');
            return;
        }

        if (this.heap.length >= this.maxElements) {
            this.setFeedback('Tas plein (max ' + this.maxElements + ' elements).', 'error');
            return;
        }

        this.animating = true;
        this.sortedIndices.clear();

        this.showPseudo('insert', document.querySelectorAll('.tab-btn')[0]);

        this.highlightLine('pins1');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.heap.push(value);
        this.highlightLine('pins2');
        this.activeIndices.clear();
        this.swappingIndices.clear();
        this.activeIndices.add(this.heap.length - 1);
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(1.25));

        let i = this.heap.length - 1;
        this.highlightLine('pins3');
        await OEIUtils.sleep(this.getCurrentDelay(0.75));

        while (i > 0 && this.compare(this.heap[i], this.heap[this.parent(i)])) {
            this.highlightLine('pins4');
            this.activeIndices.clear();
            this.activeIndices.add(i);
            this.activeIndices.add(this.parent(i));
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('pins5');
            this.swappingIndices.clear();
            this.swappingIndices.add(i);
            this.swappingIndices.add(this.parent(i));
            const insertSwapDuration = this.getSwapAnimationDuration();
            this.setSwapMotion(i, this.parent(i), insertSwapDuration);
            this.render();
            await OEIUtils.sleep(insertSwapDuration);

            [this.heap[i], this.heap[this.parent(i)]] = [this.heap[this.parent(i)], this.heap[i]];
            this.clearSwapMotion();
            this.render();
            await OEIUtils.sleep(this.getPostSwapPause());

            this.highlightLine('pins6');
            i = this.parent(i);
            this.swappingIndices.clear();
            this.activeIndices.clear();
            this.activeIndices.add(i);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay(0.75));
        }

        this.activeIndices.clear();
        this.swappingIndices.clear();
        this.clearSwapMotion();
        this.render();
        this.setFeedback('Valeur ' + value + ' inseree.', 'success');
        this.clearHighlight();
        this.animating = false;
        if (inputEl) inputEl.value = '';
    }

    async doExtract() {
        if (this.animating) return;

        if (this.heap.length === 0) {
            this.setFeedback('Le tas est vide.', 'error');
            return;
        }

        this.animating = true;
        this.sortedIndices.clear();

        this.showPseudo('extract', document.querySelectorAll('.tab-btn')[1]);

        this.highlightLine('pext1');
        await OEIUtils.sleep(this.getCurrentDelay());

        const root = this.heap[0];
        this.highlightLine('pext2');
        this.activeIndices.clear();
        this.swappingIndices.clear();
        this.activeIndices.add(0);
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(1.25));

        if (this.heap.length === 1) {
            this.heap.pop();
            this.activeIndices.clear();
            this.clearSwapMotion();
            this.render();
            this.setFeedback('Racine extraite : ' + root, 'success');
            this.clearHighlight();
            this.animating = false;
            return;
        }

        this.highlightLine('pext3');
        this.heap[0] = this.heap[this.heap.length - 1];
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('pext4');
        this.heap.pop();
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay());

        let i = 0;
        this.highlightLine('pext5');
        this.activeIndices.clear();
        this.activeIndices.add(0);
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(0.75));

        while (true) {
            this.highlightLine('pext6');
            let best = i;
            const l = this.left(i);
            const r = this.right(i);

            if (l < this.heap.length && this.compare(this.heap[l], this.heap[best])) best = l;
            if (r < this.heap.length && this.compare(this.heap[r], this.heap[best])) best = r;
            if (best === i) break;

            this.highlightLine('pext7');
            this.activeIndices.clear();
            this.activeIndices.add(i);
            this.activeIndices.add(best);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('pext8');
            this.swappingIndices.clear();
            this.swappingIndices.add(i);
            this.swappingIndices.add(best);
            const extractSwapDuration = this.getSwapAnimationDuration();
            this.setSwapMotion(i, best, extractSwapDuration);
            this.render();
            await OEIUtils.sleep(extractSwapDuration);

            [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
            this.clearSwapMotion();
            this.render();
            await OEIUtils.sleep(this.getPostSwapPause());

            this.highlightLine('pext9');
            i = best;
            this.swappingIndices.clear();
            this.activeIndices.clear();
            this.activeIndices.add(i);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay(0.75));
        }

        this.activeIndices.clear();
        this.swappingIndices.clear();
        this.clearSwapMotion();
        this.render();
        this.setFeedback('Racine extraite : ' + root, 'success');
        this.clearHighlight();
        this.animating = false;
    }

    async doHeapsort() {
        if (this.animating) return;

        if (this.heap.length < 2) {
            this.setFeedback('Il faut au moins 2 elements pour trier.', 'error');
            return;
        }

        this.animating = true;
        this.sortedIndices.clear();
        this.setFeedback('Heapsort en cours...', 'info');

        const arr = [...this.heap];
        const n = arr.length;

        const siftDown = (index, size) => {
            let largest = index;
            const l = 2 * index + 1;
            const r = 2 * index + 2;

            if (l < size && arr[l] > arr[largest]) largest = l;
            if (r < size && arr[r] > arr[largest]) largest = r;

            if (largest !== index) {
                [arr[index], arr[largest]] = [arr[largest], arr[index]];
                siftDown(largest, size);
            }
        };

        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
            siftDown(i, n);
        }

        this.heap = [...arr];
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(1.25));

        for (let end = n - 1; end > 0; end--) {
            this.swappingIndices.clear();
            this.swappingIndices.add(0);
            this.swappingIndices.add(end);
            const heapSortRootSwapDuration = this.getSwapAnimationDuration();
            this.setSwapMotion(0, end, heapSortRootSwapDuration);
            this.render();
            await OEIUtils.sleep(heapSortRootSwapDuration);

            [arr[0], arr[end]] = [arr[end], arr[0]];
            this.heap = [...arr];
            this.sortedIndices.add(end);
            this.clearSwapMotion();
            this.swappingIndices.clear();
            this.render();
            await OEIUtils.sleep(this.getPostSwapPause());

            let i = 0;
            const size = end;
            while (true) {
                let largest = i;
                const l = 2 * i + 1;
                const r = 2 * i + 2;

                if (l < size && arr[l] > arr[largest]) largest = l;
                if (r < size && arr[r] > arr[largest]) largest = r;
                if (largest === i) break;

                this.activeIndices.clear();
                this.activeIndices.add(i);
                this.activeIndices.add(largest);
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.625));

                const heapSortInnerSwapDuration = this.getSwapAnimationDuration();
                this.swappingIndices.clear();
                this.swappingIndices.add(i);
                this.swappingIndices.add(largest);
                this.setSwapMotion(i, largest, heapSortInnerSwapDuration);
                this.render();
                await OEIUtils.sleep(heapSortInnerSwapDuration);

                [arr[i], arr[largest]] = [arr[largest], arr[i]];
                this.heap = [...arr];
                this.clearSwapMotion();
                this.swappingIndices.clear();
                this.render();
                await OEIUtils.sleep(this.getPostSwapPause());

                i = largest;
            }
            this.activeIndices.clear();
        }

        this.sortedIndices.add(0);
        this.heap = [...arr];
        this.clearSwapMotion();
        this.render();

        this.setFeedback('Heapsort termine ! Resultat : [' + arr.join(', ') + ']', 'success');
        this.clearHighlight();
        this.animating = false;
    }

    resetHeap() {
        if (this.animating) return;

        this.heap = [];
        this.hoverIndex = -1;
        this.activeIndices.clear();
        this.swappingIndices.clear();
        this.sortedIndices.clear();
        this.clearSwapMotion();
        this.clearHighlight();
        this.setFeedback('', '');
        this.render();

        const defaults = this.data?.visualization?.config?.defaultValues || [15, 8, 23, 4, 42, 16, 27, 11];
        for (const value of defaults) {
            this.heap.push(value);
            let i = this.heap.length - 1;
            while (i > 0 && this.compare(this.heap[i], this.heap[this.parent(i)])) {
                [this.heap[i], this.heap[this.parent(i)]] = [this.heap[this.parent(i)], this.heap[i]];
                i = this.parent(i);
            }
        }

        this.render();
    }

    reset() {
        this.mode = 'min';
        this.maxElements = this.data?.visualization?.config?.maxElements || 31;

        const minBtn = document.getElementById('btnMin');
        const maxBtn = document.getElementById('btnMax');
        if (minBtn) minBtn.classList.add('active');
        if (maxBtn) maxBtn.classList.remove('active');

        const compareLine = document.getElementById('pins4');
        if (compareLine) {
            compareLine.innerHTML = '  <span class="keyword">tant que</span> i &gt; 0 <span class="keyword">et</span> tas[i] &lt; tas[parent(i)]:';
        }

        this.showPseudo('insert', document.querySelectorAll('.tab-btn')[0]);
        this.resetHeap();
    }
}

if (typeof window !== 'undefined') {
    window.HeapVisualizer = HeapVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeapWidget — Widget autonome pour intégration dans les slides
// Usage : HeapWidget.mount(container, { mode: 'min'|'max', data: [...] })
// ─────────────────────────────────────────────────────────────────────────────
class HeapWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (HeapWidget._stylesInjected) return;
        HeapWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.hpw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.hpw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.hpw-array{display:flex;gap:3px;flex-wrap:wrap;}
.hpw-cell{min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:.75rem;font-weight:600;background:var(--sl-primary,#6366f1);color:#fff;transition:background .2s;border:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.hpw-cell.root{background:var(--sl-accent,#f97316);}
.hpw-tree{height:120px;}
.hpw-tree svg{width:100%;height:100%;display:block;}
.hpw-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.hpw-input{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:4px 8px;font-size:.75rem;color:var(--sl-text,#e2e8f0);width:58px;}
.hpw-btn{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.hpw-btn:hover:not(:disabled){opacity:.8;}
.hpw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
.hpw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        HeapWidget.ensureStyles();
        const w = new HeapWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.mode = config.mode || 'min';
        this._heap = [];
        this._action = `Tas ${this.mode === 'min' ? 'minimum' : 'maximum'} — inserez des valeurs`;
        const defaults = Array.isArray(config.data) && config.data.length > 0
            ? config.data : [15, 10, 20, 8, 12, 30];
        defaults.forEach(v => this._insertSilent(v));
    }

    _cmp(a, b) { return this.mode === 'min' ? a < b : a > b; }
    _parent(i) { return Math.floor((i - 1) / 2); }
    _left(i) { return 2 * i + 1; }
    _right(i) { return 2 * i + 2; }

    _insertSilent(val) {
        this._heap.push(val);
        let i = this._heap.length - 1;
        while (i > 0) {
            const p = this._parent(i);
            if (!this._cmp(this._heap[i], this._heap[p])) break;
            [this._heap[i], this._heap[p]] = [this._heap[p], this._heap[i]];
            i = p;
        }
    }

    _extract() {
        if (this._heap.length === 0) { this._action = 'Tas vide.'; this._render(); return; }
        const root = this._heap[0];
        const last = this._heap.pop();
        if (this._heap.length > 0) {
            this._heap[0] = last;
            let i = 0;
            while (true) {
                let t = i;
                const l = this._left(i), r = this._right(i);
                if (l < this._heap.length && this._cmp(this._heap[l], this._heap[t])) t = l;
                if (r < this._heap.length && this._cmp(this._heap[r], this._heap[t])) t = r;
                if (t === i) break;
                [this._heap[i], this._heap[t]] = [this._heap[t], this._heap[i]];
                i = t;
            }
        }
        this._action = `Extrait : ${root} (${this.mode === 'min' ? 'minimum' : 'maximum'}) — heapify-down`;
        this._render();
    }

    init() {
        const label = this.mode === 'min' ? 'Tas minimum (Min-Heap)' : 'Tas maximum (Max-Heap)';
        this.root.innerHTML = `<div class="hpw-container">
            <div class="hpw-header"><span>${label}</span><span class="hpw-size"></span></div>
            <div class="hpw-array"></div>
            <div class="hpw-tree"><svg viewBox="0 0 400 110"></svg></div>
            <div class="hpw-info-bar hpw-action"></div>
            <div class="hpw-controls">
                <input type="number" class="hpw-input hpw-val-input" placeholder="val" value="5">
                <button class="hpw-btn hpw-btn-insert">+ Inserer</button>
                <button class="hpw-btn hpw-btn-extract hpw-btn-secondary">Extraire ${this.mode === 'min' ? 'min' : 'max'}</button>
                <button class="hpw-btn hpw-btn-reset hpw-btn-secondary">&#8635; Reset</button>
            </div>
        </div>`;
        this._render();
        this._bindControls();
    }

    _render() {
        const arr = this._heap;

        // Array view
        const arrayEl = this.root.querySelector('.hpw-array');
        if (arrayEl) {
            arrayEl.innerHTML = arr.map((v, i) =>
                `<div class="hpw-cell ${i === 0 ? 'root' : ''}" title="[${i}]">${v}</div>`
            ).join('');
        }

        // Tree SVG
        const svg = this.root.querySelector('.hpw-tree svg');
        if (svg) {
            if (arr.length === 0) {
                svg.innerHTML = '<text x="200" y="55" text-anchor="middle" fill="rgba(148,163,184,.5)" font-size="12">Tas vide</text>';
            } else {
                const W = 400, H = 110;
                const levels = Math.floor(Math.log2(arr.length)) + 1;
                const positions = [];
                let svgContent = '';

                arr.forEach((v, i) => {
                    const level = Math.floor(Math.log2(i + 1));
                    const levelStart = Math.pow(2, level) - 1;
                    const pos = i - levelStart;
                    const totalInLevel = Math.pow(2, level);
                    const x = W * (pos + 0.5) / totalInLevel;
                    const y = 14 + level * Math.max(20, Math.floor((H - 28) / Math.max(levels - 1, 1)));
                    positions.push({ x, y });
                    if (i > 0) {
                        const p = this._parent(i);
                        svgContent += `<line x1="${positions[p].x}" y1="${positions[p].y}" x2="${x}" y2="${y}" stroke="rgba(148,163,184,.35)" stroke-width="1.5"/>`;
                    }
                });

                arr.forEach((v, i) => {
                    const { x, y } = positions[i];
                    const fill = i === 0 ? 'var(--sl-accent,#f97316)' : 'var(--sl-primary,#6366f1)';
                    svgContent += `<circle cx="${x}" cy="${y}" r="12" fill="${fill}"/>`;
                    svgContent += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="10" font-weight="600">${v}</text>`;
                });

                svg.innerHTML = svgContent;
            }
        }

        const act = this.root.querySelector('.hpw-action');
        if (act) act.textContent = this._action;
        const sz = this.root.querySelector('.hpw-size');
        if (sz) sz.textContent = `n=${arr.length}`;
    }

    _bindControls() {
        this.root.querySelector('.hpw-btn-insert')?.addEventListener('click', () => {
            const el = this.root.querySelector('.hpw-val-input');
            const v = el ? parseInt(el.value, 10) : NaN;
            if (isNaN(v)) return;
            if (this._heap.length >= 15) { this._action = 'Tas plein (max 15).'; this._render(); return; }
            this._insertSilent(v);
            this._action = `Insere ${v} — remontee jusqu'a la racine (sift-up)`;
            this._render();
        });
        this.root.querySelector('.hpw-btn-extract')?.addEventListener('click', () => {
            this._extract();
        });
        this.root.querySelector('.hpw-btn-reset')?.addEventListener('click', () => {
            this._heap = [];
            const defaults = [15, 10, 20, 8, 12, 30];
            defaults.forEach(v => this._insertSilent(v));
            this._action = 'Tas reinitialise.';
            this._render();
        });
    }
}

if (typeof window !== 'undefined') {
    window.HeapWidget = HeapWidget;
}
