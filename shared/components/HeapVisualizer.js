/**
 * HeapVisualizer - Visualisation d'un tas binaire (min/max)
 *
 * La mécanique de sift-up/sift-down/heapsort vit dans
 * shared/components/algorithms/heap-traces.js, pure (`mode` 'min'|'max' pilote
 * le seul comparateur partagé). Comme pile/file, liste chaînée et table de
 * hachage, chaque clic (Insérer/Extraire/Heapsort) est une opération
 * INDÉPENDANTE sur un tas qui PERSISTE — la PAGE anime via TracePlayer
 * (patron `runOperation`, identique à StructureVisualizer/HashTableVisualizer) ;
 * le WIDGET reste instantané (règle établie depuis la régression pile/file sur
 * clics rapprochés) et n'expose pas Heapsort (comme CountingRadixWidget qui
 * n'expose pas le mode radix).
 *
 * Opérations :
 * - setMode(mode) : Basculer min-heap / max-heap
 * - doInsert() : Insérer une valeur
 * - doExtract() : Extraire la racine
 * - doHeapsort() : Trier via heapsort (mode-aware — voir heap-traces.js)
 * - resetHeap() : Réinitialiser avec les données de démonstration
 */
class HeapVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.heap = [];
        this.mode = 'min';
        this.activeIndices = new Set();
        this.swappingIndices = new Set();
        this.sortedIndices = new Set();
        this.maxElements = 31;
        this.hoverIndex = -1;
        this.hoverSyncBound = false;
        this.swapMotion = null;
        this._pendingCommit = null;
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

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/heap-traces.js'];
    }

    /** Ne reconstruit jamais toute seule : chaque opération pose sa propre trace (voir doInsert/doExtract/doHeapsort). */
    buildTrace() {
        return this._trace || [];
    }

    stepDelay(step) {
        if (!step) return this.getCurrentDelay();
        switch (step.delay) {
            case 'grow': return this.getCurrentDelay(1.25);
            case 'settle': return this.getCurrentDelay(0.75);
            case 'quick': return this.getCurrentDelay(0.625);
            case 'swap': return this.getSwapAnimationDuration();
            case 'post-swap': return this.getPostSwapPause();
            default: return this.getCurrentDelay();
        }
    }

    renderStep(step) {
        this.heap = step.heap;
        this.activeIndices = new Set(step.marks.active);
        this.swappingIndices = new Set(step.marks.swapping);
        this.sortedIndices = new Set(step.marks.sorted);
        if (step.delay === 'swap' && step.marks.swapping.length === 2) {
            this.setSwapMotion(step.marks.swapping[0], step.marks.swapping[1], this.getSwapAnimationDuration());
        } else {
            this.clearSwapMotion();
        }
        this.render();
    }

    onPlayerState(state) {
        if (state.atEnd && !state.playing && this._pendingCommit) {
            const commit = this._pendingCommit;
            this._pendingCommit = null;
            commit();
        }
    }

    /** Lance la trace de l'opération courante puis appelle `onDone` (tas figé) à la fin. */
    runOperation(trace, onDone) {
        if (this._pendingCommit) return; // opération déjà en cours : ignorer le clic
        this._trace = trace;
        this._pendingCommit = () => onDone(trace.at(-1));
        if (this.player) {
            this.player.reset();
            this.player.play();
        } else {
            onDone(trace.at(-1));
        }
    }

    get animating() {
        return !!this._pendingCommit;
    }

    async init() {
        await super.init();
        this.reset();
        this.bindHoverSync();
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

    /** Rend les deux blocs de pseudocode dans leurs conteneurs respectifs. */
    setupPseudocode() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-insert', blockFilter: 'insert' });
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-extract', blockFilter: 'extract' });
        this.refreshCompareLine();
    }

    getInspectorContainerIds() {
        return ['pseudo-insert', 'pseudo-extract'];
    }

    /** La ligne pins4 (« tant que ... ») change de symbole de comparaison selon le mode. */
    refreshCompareLine() {
        const compareLine = document.getElementById('pins4');
        if (!compareLine) return;
        compareLine.innerHTML = this.mode === 'min'
            ? '  <span class="keyword">tant que</span> i &gt; 0 <span class="keyword">et</span> tas[i] &lt; tas[parent(i)]:'
            : '  <span class="keyword">tant que</span> i &gt; 0 <span class="keyword">et</span> tas[i] &gt; tas[parent(i)]:';
    }

    setMode(newMode) {
        if (this.animating) return;

        this.mode = newMode;
        const minBtn = document.getElementById('btnMin');
        const maxBtn = document.getElementById('btnMax');
        if (minBtn) minBtn.classList.toggle('active', newMode === 'min');
        if (maxBtn) maxBtn.classList.toggle('active', newMode === 'max');
        this.refreshCompareLine();

        this.resetHeap();
    }

    doInsert() {
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

        this.sortedIndices.clear();
        this.showPseudo('insert', document.querySelectorAll('.tab-btn')[0]);

        const trace = OEITrace.buildHeapInsertTrace(this.heap, value, this.mode);
        this.runOperation(trace, (last) => {
            this.heap = last.heap;
            this.activeIndices.clear();
            this.swappingIndices.clear();
            this.clearSwapMotion();
            this.render();
            this.setFeedback('Valeur ' + value + ' inseree.', 'success');
            this.clearHighlight();
            if (inputEl) inputEl.value = '';
        });
    }

    doExtract() {
        if (this.animating) return;

        if (this.heap.length === 0) {
            this.setFeedback('Le tas est vide.', 'error');
            return;
        }

        this.sortedIndices.clear();
        this.showPseudo('extract', document.querySelectorAll('.tab-btn')[1]);

        const trace = OEITrace.buildHeapExtractTrace(this.heap, this.mode);
        this.runOperation(trace, (last) => {
            this.heap = last.heap;
            this.activeIndices.clear();
            this.swappingIndices.clear();
            this.clearSwapMotion();
            this.render();
            this.setFeedback('Racine extraite : ' + last.removedValue, 'success');
            this.clearHighlight();
        });
    }

    doHeapsort() {
        if (this.animating) return;

        if (this.heap.length < 2) {
            this.setFeedback('Il faut au moins 2 elements pour trier.', 'error');
            return;
        }

        this.sortedIndices.clear();
        this.setFeedback('Heapsort en cours...', 'info');

        const trace = OEITrace.buildHeapsortTrace(this.heap, this.mode);
        this.runOperation(trace, (last) => {
            this.heap = last.heap;
            this.activeIndices.clear();
            this.swappingIndices.clear();
            this.clearSwapMotion();
            this.render();
            this.setFeedback('Heapsort termine ! Resultat : [' + last.heap.join(', ') + ']', 'success');
            this.clearHighlight();
        });
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
        this._trace = null;
        this.render();

        const defaults = this.data?.visualization?.config?.defaultValues || [15, 8, 23, 4, 42, 16, 27, 11];
        for (const value of defaults) {
            this.heap = OEITrace.buildHeapInsertTrace(this.heap, value, this.mode).at(-1).heap;
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
        this.refreshCompareLine();

        this.showPseudo('insert', document.querySelectorAll('.tab-btn')[0]);
        this.resetHeap();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeapVisualizer;
}
if (typeof window !== 'undefined') {
    window.HeapVisualizer = HeapVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeapWidget — adaptateur SLIDE. Consomme LA MÊME mécanique de sift-up/
// sift-down (heap-traces.js) mais en lecture instantanée (`.at(-1)` seulement
// — pas d'animation, comme pile/file/liste chaînée/table de hachage). Pas de
// bouton Heapsort (comme CountingRadixWidget sans mode radix). DOM .hpw-*
// inchangé. Usage : HeapWidget.mount(container, { mode: 'min'|'max', data: [...] })
// ─────────────────────────────────────────────────────────────────────────────
class HeapWidget {
    static mount(container, config = {}) {
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

    _insertSilent(val) {
        this._heap = window.OEITrace.buildHeapInsertTrace(this._heap, val, this.mode).at(-1).heap;
    }

    _extract() {
        if (this._heap.length === 0) { this._action = 'Tas vide.'; this._render(); return; }
        const last = window.OEITrace.buildHeapExtractTrace(this._heap, this.mode).at(-1);
        this._heap = last.heap;
        this._action = `Extrait : ${last.removedValue} (${this.mode === 'min' ? 'minimum' : 'maximum'}) — heapify-down`;
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

    /** Empêche tout rendu différé après démontage et vide le conteneur (revue §C4). */
    destroy() {
        this._destroyed = true;
        if (this.root) this.root.innerHTML = '';
    }

    _render() {
        if (this._destroyed) return;
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
                        const p = Math.floor((i - 1) / 2);
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
