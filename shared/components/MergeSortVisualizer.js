/**
 * MergeSortVisualizer - Visualisation du tri fusion
 */
class MergeSortVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.ARRAY_SIZE = 8;
        this.originalNumbers = [];
        this.isSorting = false;
        this.stopRequested = false;
        this.treeState = [];
        this.splitLevels = {};
        this.linearArray = [];
        this.linearState = {};
        this.linearRange = null;
        this.linearPreview = null;
        this.sortedRuns = [];
        this.splitCount = 0;
        this.mergeCount = 0;
        this.compareCount = 0;
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        const cfg = this.data?.visualization?.config;
        this.ARRAY_SIZE = cfg?.size || 8;
        this.reset();
    }

    renderPseudocodeFromData() {
        const host = document.getElementById('pseudocode');
        if (!host) return;
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks) || blocks.length === 0) return;

        const ids = [
            'line-fn-merge-sort', 'line-base-case', 'line-return-base', 'line-mid',
            'line-split-left', 'line-split-right', 'line-return-merge', 'line-empty',
            'line-fn-merge', 'line-init-result', 'line-while', 'line-compare',
            'line-take-left', 'line-else', 'line-take-right', 'line-concat', 'line-return-result'
        ];

        let cursor = 0;
        const lines = [];
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
        host.innerHTML = lines.join('');
    }

    generateArray() {
        return Array.from({ length: this.ARRAY_SIZE }, () => Math.floor(Math.random() * 99) + 1);
    }

    setPhase(text, type) {
        const phaseIndicator = document.getElementById('phase-indicator');
        if (!phaseIndicator) return;
        phaseIndicator.innerHTML = text ? '<span class="phase-' + type + '">' + text + '</span>' : '';
    }

    setStatus(text) {
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) statusMessage.innerHTML = text || '';
    }

    highlightPseudo(lineId) {
        document.querySelectorAll('#pseudocode .line').forEach(l => l.classList.remove('highlight'));
        if (lineId) {
            const el = document.getElementById(lineId);
            if (el) el.classList.add('highlight');
        }
    }

    resetSortedRuns() {
        this.sortedRuns = [];
        this.renderSortedRuns();
    }

    getSortedRunsHost() {
        const simulationRoot = document.getElementById('simulation-fragment');
        if (simulationRoot) {
            const scoped = simulationRoot.querySelector('#merge-sorted-runs');
            if (scoped) return scoped;
        }

        const all = Array.from(document.querySelectorAll('#merge-sorted-runs'));
        if (!all.length) return null;

        const visible = all.find((el) => el.offsetParent !== null);
        return visible || all[0];
    }

    recordSortedRun(startIndex, values) {
        if (!Array.isArray(values) || !values.length || !Number.isInteger(startIndex)) return;
        const snapshot = {
            start: startIndex,
            end: startIndex + values.length - 1,
            values: [...values]
        };

        const existing = this.sortedRuns.findIndex((run) =>
            run.start === snapshot.start && run.end === snapshot.end
        );
        if (existing >= 0) this.sortedRuns[existing] = snapshot;
        else this.sortedRuns.unshift(snapshot);

        if (this.sortedRuns.length > 20) {
            this.sortedRuns = this.sortedRuns.slice(0, 20);
        }
        this.renderSortedRuns();
    }

    renderSortedRuns() {
        const host = this.getSortedRunsHost();
        if (!host) return;
        host.innerHTML = '';

        if (!this.sortedRuns.length) {
            const empty = document.createElement('div');
            empty.className = 'sorted-run-empty';
            empty.textContent = 'Aucun sous-tableau trie pour le moment.';
            host.appendChild(empty);
            return;
        }

        this.sortedRuns.forEach((run) => {
            const item = document.createElement('div');
            item.className = 'sorted-run-item';

            const range = document.createElement('span');
            range.className = 'sorted-run-range';
            range.textContent = run.start + '..' + run.end;

            const values = document.createElement('span');
            values.className = 'sorted-run-values';
            values.textContent = '[' + run.values.join(', ') + ']';

            item.appendChild(range);
            item.appendChild(values);
            host.appendChild(item);
        });
    }

    renderTree() {
        const treeContainer = document.getElementById('tree-container');
        if (!treeContainer) return;

        treeContainer.innerHTML = '';
        this.treeState.forEach((level, depth) => {
            if (depth > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'tree-arrow';
                arrow.classList.add(level._direction === 'up' ? 'up' : 'down');
                treeContainer.appendChild(arrow);
            }

            const row = document.createElement('div');
            row.className = 'tree-row';

            const label = document.createElement('div');
            label.className = 'tree-row-label';
            if (depth === 0) label.textContent = 'Initial';
            else if (level._direction === 'up') label.textContent = 'Fusion';
            else label.textContent = 'Div. ' + depth;
            row.appendChild(label);

            level.forEach(sub => {
                const subDiv = document.createElement('div');
                subDiv.className = 'sub-array';
                if (sub.highlight === 'split') subDiv.classList.add('active-split');
                if (sub.highlight === 'merge') subDiv.classList.add('active-merge');
                if (sub.isSorted) subDiv.classList.add('sorted-subarray');

                sub.values.forEach((val, idx) => {
                    const el = document.createElement('div');
                    el.className = 'element';
                    el.textContent = val;
                    const state = sub.elementStates && sub.elementStates[idx];
                    if (state) el.classList.add(state);
                    subDiv.appendChild(el);
                });

                row.appendChild(subDiv);
            });

            treeContainer.appendChild(row);
        });
    }

    updateMergeStats() {
        const splitEl = document.getElementById('merge-stat-splits');
        const mergeEl = document.getElementById('merge-stat-merges');
        const compareEl = document.getElementById('merge-stat-comparisons');
        const rangeEl = document.getElementById('merge-current-range');

        if (splitEl) splitEl.textContent = String(this.splitCount);
        if (mergeEl) mergeEl.textContent = String(this.mergeCount);
        if (compareEl) compareEl.textContent = String(this.compareCount);
        if (rangeEl) {
            if (!this.linearRange) rangeEl.textContent = '--';
            else rangeEl.textContent = this.linearRange.start + '..' + this.linearRange.end + ' (' + this.linearRange.phase + ')';
        }
    }

    setLinearRange(start, end, phase) {
        this.linearRange = { start, end, phase };
        if (phase !== 'merge') {
            this.linearPreview = null;
        }
        this.renderLinearArray();
        this.updateMergeStats();
    }

    commitLinearRange(start, values, phase) {
        this.linearPreview = null;
        values.forEach((value, offset) => {
            const idx = start + offset;
            this.linearArray[idx] = value;
            this.linearState[idx] = phase || 'merge';
        });
        this.linearRange = { start, end: start + values.length - 1, phase: phase || 'merge' };
        this.renderLinearArray();
        this.updateMergeStats();
    }

    markLinearSorted() {
        this.linearPreview = null;
        this.linearArray.forEach((_, idx) => {
            this.linearState[idx] = 'sorted';
        });
        this.linearRange = null;
        this.renderLinearArray();
        this.updateMergeStats();
    }

    setLinearPreview(start, values, end) {
        this.linearPreview = {
            start,
            end: Number.isInteger(end) ? end : (start + (Array.isArray(values) ? values.length - 1 : -1)),
            values: Array.isArray(values) ? [...values] : []
        };
        this.renderLinearArray();
        this.updateMergeStats();
    }

    renderLinearArray() {
        const container = document.getElementById('merge-array-view');
        if (!container) return;

        container.innerHTML = '';
        this.linearArray.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'merge-array-cell';
            let displayValue = value;
            const preview = this.linearPreview;
            if (preview && index >= preview.start && index <= preview.end) {
                const previewOffset = index - preview.start;
                if (previewOffset < preview.values.length) {
                    displayValue = preview.values[previewOffset];
                    cell.classList.add('preview-placed');
                } else {
                    cell.classList.add('preview-pending');
                }
            }
            cell.textContent = displayValue;

            const state = this.linearState[index];
            if (state) cell.classList.add(state);
            if (this.linearRange && index >= this.linearRange.start && index <= this.linearRange.end) {
                if (this.linearRange.phase === 'split') cell.classList.add('range-split');
                if (this.linearRange.phase === 'merge') cell.classList.add('range-merge');
            }

            const idx = document.createElement('span');
            idx.className = 'merge-array-index';
            idx.textContent = index;
            cell.appendChild(idx);

            container.appendChild(cell);
        });
    }

    setTreeLevel(depth, subArrays, direction) {
        while (this.treeState.length <= depth) {
            const empty = [];
            empty._direction = direction || 'down';
            this.treeState.push(empty);
        }

        const level = subArrays.map(s => ({
            values: [...s.values],
            highlight: s.highlight || null,
            elementStates: s.elementStates ? { ...s.elementStates } : {},
            isSorted: Boolean(s.isSorted)
        }));
        level._direction = direction || 'down';
        this.treeState[depth] = level;
    }

    clearTreeFromDepth(depth) {
        this.treeState = this.treeState.slice(0, depth);
    }

    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    async addSplitLevel(depth, left, right) {
        if (!this.splitLevels[depth]) this.splitLevels[depth] = [];

        this.splitLevels[depth].push({ values: left, highlight: 'split', elementStates: {}, isSorted: false });
        this.splitLevels[depth].push({ values: right, highlight: 'split', elementStates: {}, isSorted: false });

        this.setTreeLevel(depth, this.splitLevels[depth], 'down');
        this.renderTree();
    }

    updateParentAfterMerge(depth, left, right, merged) {
        if (depth < 0 || depth >= this.treeState.length) return;

        const level = this.treeState[depth];
        let foundIdx = -1;
        for (let i = 0; i < level.length - 1; i++) {
            if (this.arraysEqual(level[i].values, left) && this.arraysEqual(level[i + 1].values, right)) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx >= 0) {
            level.splice(foundIdx, 2, {
                values: merged,
                highlight: 'sorted',
                elementStates: Object.fromEntries(merged.map((_, i) => [i, 'sorted'])),
                isSorted: true
            });
        }

        if (this.splitLevels[depth]) {
            let fi = -1;
            for (let i = 0; i < this.splitLevels[depth].length - 1; i++) {
                if (this.arraysEqual(this.splitLevels[depth][i].values, left) && this.arraysEqual(this.splitLevels[depth][i + 1].values, right)) {
                    fi = i;
                    break;
                }
            }

            if (fi >= 0) {
                this.splitLevels[depth].splice(fi, 2, {
                    values: merged,
                    highlight: 'sorted',
                    elementStates: Object.fromEntries(merged.map((_, i) => [i, 'sorted'])),
                    isSorted: true
                });
            }
        }
    }

    async visualMerge(left, right, depth, startIndex) {
        const mergeEnd = startIndex + left.length + right.length - 1;
        this.setLinearRange(startIndex, mergeEnd, 'merge');
        this.setLinearPreview(startIndex, [], mergeEnd);

        this.highlightPseudo('line-fn-merge');
        this.setStatus('Fusion de [' + left.join(', ') + '] et [' + right.join(', ') + ']');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightPseudo('line-init-result');
        const result = [];
        let li = 0;
        let ri = 0;
        const leftCopy = [...left];
        const rightCopy = [...right];

        const mergeDepth = this.treeState.length;

        while (li < leftCopy.length && ri < rightCopy.length) {
            if (this.stopRequested) return [...result, ...leftCopy.slice(li), ...rightCopy.slice(ri)];

            this.highlightPseudo('line-compare');
            const mergeSubArrays = [
                {
                    values: leftCopy,
                    highlight: 'merge',
                    elementStates: { [li]: 'comparing' },
                    isSorted: true
                },
                {
                    values: rightCopy,
                    highlight: 'merge',
                    elementStates: { [ri]: 'comparing' },
                    isSorted: true
                }
            ];

            if (result.length > 0) {
                mergeSubArrays.unshift({
                    values: result,
                    highlight: 'merge',
                    elementStates: Object.fromEntries(result.map((_, i) => [i, 'placed'])),
                    isSorted: false
                });
            }

            this.setTreeLevel(mergeDepth, mergeSubArrays, 'up');
            this.renderTree();
            this.setStatus('Comparaison : <strong>' + leftCopy[li] + '</strong> vs <strong>' + rightCopy[ri] + '</strong>');
            this.compareCount += 1;
            this.updateMergeStats();
            await OEIUtils.sleep(this.getCurrentDelay());

            if (leftCopy[li] <= rightCopy[ri]) {
                this.highlightPseudo('line-take-left');
                result.push(leftCopy[li]);
                li++;
            } else {
                this.highlightPseudo('line-take-right');
                result.push(rightCopy[ri]);
                ri++;
            }
            this.setLinearPreview(startIndex, result, mergeEnd);
            await OEIUtils.sleep(this.getCurrentDelay(0.5));
        }

        this.highlightPseudo('line-concat');
        while (li < leftCopy.length) result.push(leftCopy[li++]);
        while (ri < rightCopy.length) result.push(rightCopy[ri++]);
        this.setLinearPreview(startIndex, result, mergeEnd);

        this.highlightPseudo('line-return-result');
        this.setTreeLevel(mergeDepth, [{
            values: result,
            highlight: 'merge',
            elementStates: Object.fromEntries(result.map((_, i) => [i, 'placed'])),
            isSorted: true
        }], 'up');
        this.mergeCount += 1;
        this.recordSortedRun(startIndex, result);
        this.commitLinearRange(startIndex, result, 'merge');
        this.renderTree();
        this.setStatus('Résultat de la fusion : [' + result.join(', ') + ']');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.updateParentAfterMerge(depth, left, right, result);
        this.renderTree();
        await OEIUtils.sleep(this.getCurrentDelay(0.5));

        this.clearTreeFromDepth(mergeDepth);
        this.renderTree();

        return result;
    }

    async visualMergeSort(arr, depth, startIndex) {
        if (this.stopRequested) return arr;

        if (arr.length <= 1) {
            this.highlightPseudo('line-base-case');
            await OEIUtils.sleep(this.getCurrentDelay(0.5));
            this.highlightPseudo('line-return-base');
            await OEIUtils.sleep(this.getCurrentDelay(0.5));
            return arr;
        }

        this.highlightPseudo('line-mid');
        this.setPhase('Phase de division', 'split');
        this.setLinearRange(startIndex, startIndex + arr.length - 1, 'split');

        const mid = Math.floor(arr.length / 2);
        const left = arr.slice(0, mid);
        const right = arr.slice(mid);

        this.setStatus('Division de [' + arr.join(', ') + '] en [' + left.join(', ') + '] et [' + right.join(', ') + ']');
        this.splitCount += 1;
        this.updateMergeStats();

        this.highlightPseudo('line-split-left');
        await this.addSplitLevel(depth + 1, left, right);
        await OEIUtils.sleep(this.getCurrentDelay());

        if (this.stopRequested) return arr;

        const sortedLeft = await this.visualMergeSort(left, depth + 1, startIndex);
        if (this.stopRequested) return arr;

        this.highlightPseudo('line-split-right');
        const sortedRight = await this.visualMergeSort(right, depth + 1, startIndex + mid);
        if (this.stopRequested) return arr;

        this.highlightPseudo('line-return-merge');
        this.setPhase('Phase de fusion', 'merge');
        return await this.visualMerge(sortedLeft, sortedRight, depth, startIndex);
    }

    render() {
        this.renderTree();
        this.renderSortedRuns();
    }

    async startSort() {
        if (this.isSorting) return;

        const btnStart = document.getElementById('btn-start');
        this.isSorting = true;
        this.stopRequested = false;
        if (btnStart) btnStart.disabled = true;

        this.treeState = [];
        this.splitLevels = {};
        this.resetSortedRuns();
        this.splitCount = 0;
        this.mergeCount = 0;
        this.compareCount = 0;
        this.linearArray = [...this.originalNumbers];
        this.linearState = {};
        this.linearRange = { start: 0, end: this.originalNumbers.length - 1, phase: 'split' };
        this.linearPreview = null;
        this.setTreeLevel(0, [{ values: [...this.originalNumbers], highlight: 'split', elementStates: {}, isSorted: false }], 'down');
        this.renderTree();
        this.renderLinearArray();
        this.updateMergeStats();

        this.setPhase('Phase de division', 'split');
        this.highlightPseudo('line-fn-merge-sort');
        await OEIUtils.sleep(this.getCurrentDelay());

        const sorted = await this.visualMergeSort([...this.originalNumbers], 0, 0);

        if (!this.stopRequested) {
            this.treeState = [];
            this.setTreeLevel(0, [{
                values: sorted,
                highlight: null,
                elementStates: Object.fromEntries(sorted.map((_, i) => [i, 'sorted'])),
                isSorted: true
            }], 'down');
            this.renderTree();
            this.setPhase('', '');
            this.setStatus('Tri terminé ! Le tableau est trié.');
            this.highlightPseudo(null);
            this.linearArray = [...sorted];
            this.markLinearSorted();
        }

        this.isSorting = false;
        if (btnStart) btnStart.disabled = false;
    }

    reset() {
        this.stopRequested = true;
        this.isSorting = false;

        const btnStart = document.getElementById('btn-start');
        if (btnStart) btnStart.disabled = false;

        this.originalNumbers = this.generateArray();
        this.treeState = [];
        this.splitLevels = {};
        this.resetSortedRuns();
        this.splitCount = 0;
        this.mergeCount = 0;
        this.compareCount = 0;
        this.linearArray = [...this.originalNumbers];
        this.linearState = {};
        this.linearRange = { start: 0, end: this.originalNumbers.length - 1, phase: 'split' };
        this.linearPreview = null;
        this.setPhase('', '');
        this.setStatus('Cliquez sur Démarrer pour lancer le tri fusion.');
        this.highlightPseudo(null);
        this.setTreeLevel(0, [{ values: this.originalNumbers, highlight: null, elementStates: {}, isSorted: false }], 'down');
        this.renderTree();
        this.renderLinearArray();
        this.updateMergeStats();
    }
}

if (typeof window !== 'undefined') {
    window.MergeSortVisualizer = MergeSortVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// MergeSortWidget — Widget autonome pour intégration dans les slides
// Usage : MergeSortWidget.mount(container, { data: [...] })
// ─────────────────────────────────────────────────────────────────────────────
class MergeSortWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (MergeSortWidget._stylesInjected) return;
        MergeSortWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.setAttribute('data-msw', '1');
        s.textContent = `
.msw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.msw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.msw-bars-zone{display:flex;align-items:flex-end;gap:4px;height:130px;padding-top:22px;position:relative;}
.msw-bar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex:1;position:relative;}
.msw-bar-inner{width:100%;border-radius:4px 4px 0 0;background:var(--sl-primary,#6366f1);transition:height .25s,background .2s;border:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.msw-bar.left .msw-bar-inner{background:#3b82f6;}
.msw-bar.right .msw-bar-inner{background:#a855f7;}
.msw-bar.merged .msw-bar-inner{background:#22c55e;}
.msw-val{position:absolute;top:-16px;font-size:10px;color:var(--sl-text,#e2e8f0);white-space:nowrap;}
.msw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;}
.msw-controls{display:flex;gap:8px;flex-wrap:wrap;}
.msw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.msw-btn:hover:not(:disabled){opacity:.8;}
.msw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        MergeSortWidget.ensureStyles();
        const w = new MergeSortWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = [64, 34, 25, 12, 22, 11, 90, 48];
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 12) : defaultData;
        this._timer = null;
        this.isRunning = false;
        this._resetState();
    }

    _resetState() {
        this._steps = this._buildSteps([...this.originalData]);
        this._stepIdx = 0;
        this.done = false;
    }

    _buildSteps(orig) {
        const steps = [];
        const n = orig.length;
        const a = [...orig];

        steps.push({ arr: [...a], activeL: [], activeR: [], mergedRange: [],
            action: 'Tableau initial — fusion bottom-up par sous-tableaux croissants' });

        for (let width = 1; width < n; width *= 2) {
            for (let lo = 0; lo < n; lo += 2 * width) {
                const mid = Math.min(lo + width, n);
                const hi = Math.min(lo + 2 * width, n);
                if (mid >= hi) continue;

                const leftRange = Array.from({ length: mid - lo }, (_, i) => lo + i);
                const rightRange = Array.from({ length: hi - mid }, (_, i) => mid + i);

                steps.push({ arr: [...a], activeL: leftRange, activeR: rightRange, mergedRange: [],
                    action: `Fusion [${lo}..${mid - 1}] (bleu) et [${mid}..${hi - 1}] (violet)` });

                const temp = [];
                let i = lo, j = mid;
                while (i < mid && j < hi) {
                    if (a[i] <= a[j]) temp.push(a[i++]);
                    else temp.push(a[j++]);
                }
                while (i < mid) temp.push(a[i++]);
                while (j < hi) temp.push(a[j++]);
                for (let k = 0; k < temp.length; k++) a[lo + k] = temp[k];

                const mergedRange = Array.from({ length: hi - lo }, (_, k) => lo + k);
                steps.push({ arr: [...a], activeL: [], activeR: [], mergedRange,
                    action: `-> Resultat : [${temp.join(', ')}] aux indices [${lo}..${hi - 1}]` });
            }
        }

        const allIdx = Array.from({ length: n }, (_, i) => i);
        steps.push({ arr: [...a], activeL: [], activeR: [], mergedRange: allIdx,
            action: 'Tri fusion termine !' });
        return steps;
    }

    init() {
        this.root.innerHTML = `<div class="msw-container">
            <div class="msw-header"><span>Tri fusion (Merge Sort)</span><span class="msw-step-info"></span></div>
            <div class="msw-bars-zone"></div>
            <div class="msw-info-bar msw-action"></div>
            <div class="msw-controls">
                <button class="msw-btn msw-btn-play">&#9654; Lancer</button>
                <button class="msw-btn msw-btn-step msw-btn-secondary">Etape</button>
                <button class="msw-btn msw-btn-reset msw-btn-secondary">&#8635; Reset</button>
            </div>
        </div>`;
        this._render();
        this._bindControls();
    }

    _render() {
        const step = this._steps[this._stepIdx] || this._steps[this._steps.length - 1];
        const zone = this.root.querySelector('.msw-bars-zone');
        if (!zone) return;

        const arr = step.arr;
        const max = Math.max(...arr, 1);
        zone.innerHTML = '';
        arr.forEach((v, idx) => {
            const bar = document.createElement('div');
            bar.className = 'msw-bar';
            if (step.mergedRange.includes(idx)) bar.classList.add('merged');
            else if (step.activeL.includes(idx)) bar.classList.add('left');
            else if (step.activeR.includes(idx)) bar.classList.add('right');
            const px = Math.max(6, Math.round((v / max) * 100));
            bar.innerHTML = `<span class="msw-val">${v}</span><div class="msw-bar-inner" style="height:${px}px"></div>`;
            zone.appendChild(bar);
        });

        const act = this.root.querySelector('.msw-action');
        if (act) act.textContent = step.action;
        const info = this.root.querySelector('.msw-step-info');
        if (info) info.textContent = `${this._stepIdx + 1}/${this._steps.length}`;
    }

    _bindControls() {
        this.root.querySelector('.msw-btn-play')?.addEventListener('click', () => this._togglePlay());
        this.root.querySelector('.msw-btn-step')?.addEventListener('click', () => { this._stop(); this._step(); });
        this.root.querySelector('.msw-btn-reset')?.addEventListener('click', () => { this._stop(); this._reset(); });
    }

    _togglePlay() {
        if (this.isRunning) { this._stop(); return; }
        if (this.done) { this._reset(); }
        this.isRunning = true;
        const btn = this.root.querySelector('.msw-btn-play');
        if (btn) btn.textContent = '\u23F8 Pause';
        this._run();
    }

    _stop() {
        this.isRunning = false;
        clearTimeout(this._timer);
        const btn = this.root.querySelector('.msw-btn-play');
        if (btn) btn.textContent = '\u25B6 Lancer';
    }

    _run() {
        if (!this.isRunning || this.done) { this._stop(); return; }
        this._step();
        if (!this.done) this._timer = setTimeout(() => this._run(), 650);
    }

    _reset() {
        this._resetState();
        this._render();
    }

    _step() {
        if (this.done) return;
        this._stepIdx++;
        if (this._stepIdx >= this._steps.length) {
            this._stepIdx = this._steps.length - 1;
            this.done = true;
            this._stop();
        }
        this._render();
    }
}

if (typeof window !== 'undefined') {
    window.MergeSortWidget = MergeSortWidget;
}
