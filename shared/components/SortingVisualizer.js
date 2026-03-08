/**
 * SortingVisualizer - Visualisation d'algorithmes de tri sur tableau
 *
 * Algorithmes supportés :
 * - bubble-sort
 * - insertion-sort
 * - selection-sort
 */
class SortingVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.numbers = [];
        this.n = 0;

        this.i = 0;
        this.j = 0;
        this.minIndex = 0;
        this.isSwapping = false;
        this.isRunning = false;

        this.defaultSize = 8;
        this.minValue = 0;
        this.maxValue = 99;
        this.algorithm = 'bubble-sort';

        this.comparisonCount = 0;
        this.writeCount = 0;
        this.lastSortedIndices = [];
        this.keyValue = null;
        this.currentAction = '';
        this.traceEntries = [];
        this.traceStep = 0;
        this.maxTraceEntries = 12;
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

    bindPedagogyModeToggle() {
        const toggle = document.getElementById('pedagogyModeToggle');
        if (!toggle || typeof window === 'undefined') return;

        const storageKey = 'oei_pedagogy_mode_' + window.location.pathname;
        const applyMode = (expert) => {
            document.body.classList.toggle('mode-expert', expert);
            try {
                localStorage.setItem(storageKey, expert ? 'expert' : 'novice');
            } catch (error) {
                // ignore storage errors
            }
        };

        try {
            const saved = localStorage.getItem(storageKey);
            toggle.checked = saved === 'expert';
        } catch (error) {
            toggle.checked = false;
        }

        applyMode(toggle.checked);
        toggle.addEventListener('change', () => applyMode(toggle.checked));
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    initArray() {
        this.numbers = Array.from(
            { length: this.defaultSize },
            () => this.randomInt(this.minValue, this.maxValue)
        );
        this.n = this.numbers.length;

        if (this.algorithm === 'insertion-sort') {
            this.i = 1;
            this.j = 0;
        } else {
            this.i = 0;
            this.j = this.algorithm === 'selection-sort' ? 1 : 0;
        }
        this.minIndex = 0;
        this.isSwapping = false;
        this.keyValue = null;
        this.currentAction = 'Pret a lancer la simulation.';
    }

    resetNarration() {
        this.currentAction = 'Pret a lancer la simulation.';
        this.traceEntries = [];
        this.traceStep = 0;
    }

    addTrace(message) {
        if (!message) return;
        this.traceStep += 1;
        this.traceEntries.unshift({ step: this.traceStep, text: message });
        if (this.traceEntries.length > this.maxTraceEntries) {
            this.traceEntries = this.traceEntries.slice(0, this.maxTraceEntries);
        }
    }

    setAction(message, recordInTrace = false) {
        this.currentAction = message || '';
        if (recordInTrace) this.addTrace(this.currentAction);
        this.updateActionPanel();
    }

    formatVar(value) {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return '-';
            if (value < 0) return '-';
        }
        return String(value);
    }

    getPointerMap() {
        const pointers = new Map();
        const add = (index, label) => {
            if (!Number.isInteger(index) || index < 0 || index >= this.numbers.length) return;
            const existing = pointers.get(index) || [];
            if (!existing.includes(label)) existing.push(label);
            pointers.set(index, existing);
        };

        if (this.algorithm === 'bubble-sort') {
            add(this.j, 'j');
            add(this.j + 1, 'j+1');
            if (this.i >= 0 && this.i < this.n) {
                add(this.n - this.i - 1, 'lim');
            }
            return pointers;
        }

        if (this.algorithm === 'insertion-sort') {
            add(this.i, 'i');
            add(this.j, 'j');
            add(this.j + 1, 'ins');
            return pointers;
        }

        if (this.algorithm === 'selection-sort') {
            add(this.i, 'i');
            add(this.j, 'j');
            add(this.minIndex, 'min');
        }

        return pointers;
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
        const pointers = pointerMap || this.getPointerMap();
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

        this.lastSortedIndices = [...sorted];
        this.updateMetricsPanel();
    }

    render() {
        this.renderArray();
    }

    getSortedIndices(upto) {
        const sorted = [];
        for (let k = 0; k < upto; k++) sorted.push(k);
        return sorted;
    }

    resetMetrics() {
        this.comparisonCount = 0;
        this.writeCount = 0;
        this.lastSortedIndices = [];
        this.resetNarration();
        this.updateMetricsPanel();
    }

    incrementComparisons(amount = 1) {
        this.comparisonCount += amount;
        this.updateMetricsPanel();
    }

    incrementWrites(amount = 1) {
        this.writeCount += amount;
        this.updateMetricsPanel();
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

    describeZones(sortedIndices) {
        const n = this.numbers.length;
        const sorted = Array.from(new Set(sortedIndices || [])).sort((a, b) => a - b);
        const sortedCount = sorted.length;

        if (n === 0) {
            return {
                sorted: '-',
                unsorted: '-'
            };
        }

        if (sortedCount === 0) {
            return {
                sorted: 'Aucune',
                unsorted: '0..' + (n - 1)
            };
        }

        if (sortedCount === n) {
            return {
                sorted: '0..' + (n - 1),
                unsorted: 'Aucune (termine)'
            };
        }

        const isPrefix = sorted.every((idx, pos) => idx === pos);
        if (isPrefix) {
            return {
                sorted: 'Prefixe 0..' + (sortedCount - 1),
                unsorted: sortedCount + '..' + (n - 1)
            };
        }

        const start = n - sortedCount;
        const isSuffix = sorted.every((idx, pos) => idx === start + pos);
        if (isSuffix) {
            return {
                sorted: 'Suffixe ' + start + '..' + (n - 1),
                unsorted: '0..' + (start - 1)
            };
        }

        return {
            sorted: sortedCount + ' cases validees',
            unsorted: (n - sortedCount) + ' cases restantes'
        };
    }

    updateMetricsPanel() {
        const comparisonsEl = document.getElementById('sort-metric-comparisons');
        const writesEl = document.getElementById('sort-metric-writes');
        const sortedZoneEl = document.getElementById('sort-zone-sorted');
        const unsortedZoneEl = document.getElementById('sort-zone-unsorted');

        if (comparisonsEl) comparisonsEl.textContent = String(this.comparisonCount);
        if (writesEl) writesEl.textContent = String(this.writeCount);

        if (sortedZoneEl || unsortedZoneEl) {
            const zones = this.describeZones(this.lastSortedIndices);
            if (sortedZoneEl) sortedZoneEl.textContent = zones.sorted;
            if (unsortedZoneEl) unsortedZoneEl.textContent = zones.unsorted;
        }

        this.updateVariablePanel();
        this.updateActionPanel();
    }

    updateVariablePanel() {
        const map = {
            i: this.i,
            j: this.j,
            min: this.algorithm === 'selection-sort' ? this.minIndex : null,
            key: this.algorithm === 'insertion-sort' ? this.keyValue : null,
            n: this.numbers.length
        };

        Object.keys(map).forEach((name) => {
            const el = document.getElementById('sort-var-' + name);
            if (!el) return;
            el.textContent = this.formatVar(map[name]);
        });
    }

    updateActionPanel() {
        const actionEl = document.getElementById('sort-current-action');
        if (actionEl) {
            actionEl.textContent = this.currentAction || 'En attente.';
        }

        const traceEl = document.getElementById('sort-trace-list');
        if (!traceEl) return;
        traceEl.innerHTML = '';

        if (!this.traceEntries.length) {
            const empty = document.createElement('div');
            empty.className = 'trace-item';
            empty.textContent = 'Aucune etape enregistree.';
            traceEl.appendChild(empty);
            return;
        }

        this.traceEntries.forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'trace-item';
            row.innerHTML = '<span class="step">#' + entry.step + '</span>' + this.escapeHtml(entry.text);
            traceEl.appendChild(row);
        });
    }

    highlightAlgorithmLine(lineId) {
        this.clearHighlight();
        const direct = document.getElementById(lineId);
        if (direct) {
            this.highlightLine(lineId);
            return;
        }

        const m = /^line(\d+)$/.exec(lineId);
        if (!m) {
            this.highlightLine(lineId);
            return;
        }

        const idx = parseInt(m[1], 10) - 1;
        const fnByAlgo = {
            'bubble-sort': 'bubble',
            'insertion-sort': 'insertion',
            'selection-sort': 'selection'
        };
        const fnName = fnByAlgo[this.algorithm];
        if (!fnName) {
            this.highlightLine(lineId);
            return;
        }

        const mapped = fnName + '-line' + idx;
        this.highlightLine(mapped);
    }

    async startSort() {
        if (this.isRunning) return;

        if (this.algorithm === 'insertion-sort') {
            await this.startInsertionSort();
            return;
        }
        if (this.algorithm === 'selection-sort') {
            await this.startSelectionSort();
            return;
        }

        await this.startBubbleSort();
    }

    async startBubbleSort() {
        this.isRunning = true;
        this.setAction('Demarrage du tri a bulles.', true);

        for (this.i = 0; this.i < this.n - 1; this.i++) {
            this.setAction('Passe ' + (this.i + 1) + ': le plus grand element remonte en fin de zone.', true);
            this.highlightAlgorithmLine('line1');

            for (this.j = 0; this.j < this.n - this.i - 1; this.j++) {
                this.setAction('Comparer les cases ' + this.j + ' et ' + (this.j + 1) + '.', true);
                this.highlightAlgorithmLine('line2');
                this.renderArray([this.j, this.j + 1], [...Array(this.n).keys()].slice(this.n - this.i));
                await OEIUtils.sleep(this.getCurrentDelay());

                this.incrementComparisons(1);
                if (this.numbers[this.j] > this.numbers[this.j + 1]) {
                    this.setAction('Echanger ' + this.numbers[this.j] + ' et ' + this.numbers[this.j + 1] + '.', true);
                    this.highlightAlgorithmLine('line3');
                    const swapDuration = this.getSwapAnimationDuration();
                    this.renderArray(
                        [this.j, this.j + 1],
                        [...Array(this.n).keys()].slice(this.n - this.i),
                        null,
                        { animateSwap: true, swapDurationMs: swapDuration }
                    );
                    await OEIUtils.sleep(swapDuration);

                    [this.numbers[this.j], this.numbers[this.j + 1]] = [this.numbers[this.j + 1], this.numbers[this.j]];
                    this.incrementWrites(2);
                    this.renderArray([], [...Array(this.n).keys()].slice(this.n - this.i));
                    await OEIUtils.sleep(this.getPostSwapPause());
                }
            }
            this.setAction('Passe ' + (this.i + 1) + ' terminee: indice ' + (this.n - this.i - 1) + ' valide.', true);
        }

        this.setAction('Tri termine: toutes les cases sont ordonnees.', true);
        this.renderArray([], this.numbers.map((_, index) => index));
        this.clearHighlight();
        this.isRunning = false;
    }

    async startInsertionSort() {
        this.isRunning = true;
        this.setAction('Demarrage du tri par insertion.', true);

        for (this.i = 1; this.i < this.n; this.i++) {
            this.setAction('Iteration i=' + this.i + ': inserer la valeur courante dans le prefixe trie.', true);
            this.highlightAlgorithmLine('line1');
            this.renderArray([this.i], [...Array(this.i).keys()]);
            await OEIUtils.sleep(this.getCurrentDelay());

            const key = this.numbers[this.i];
            this.keyValue = key;
            this.setAction('Valeur en memoire key = ' + key + '.', true);
            this.highlightAlgorithmLine('line2');
            this.renderArray([this.i], [...Array(this.i).keys()], null, {
                insertionKey: key,
                insertionTargetIndex: this.i
            });
            await OEIUtils.sleep(this.getCurrentDelay());

            this.j = this.i - 1;
            this.setAction('Comparer key aux elements vers la gauche a partir de j=' + this.j + '.', true);
            this.highlightAlgorithmLine('line3');
            this.renderArray([this.i], [...Array(this.i).keys()], null, {
                insertionKey: key,
                insertionTargetIndex: this.j + 1
            });
            await OEIUtils.sleep(this.getCurrentDelay());

            while (this.j >= 0) {
                this.incrementComparisons(1);
                if (!(this.numbers[this.j] > key)) break;

                this.setAction('Decaler ' + this.numbers[this.j] + ' vers la droite.', true);
                this.highlightAlgorithmLine('line4');
                this.renderArray([this.j, this.j + 1], [...Array(this.i).keys()], null, {
                    insertionKey: key,
                    insertionTargetIndex: this.j + 1
                });
                await OEIUtils.sleep(this.getCurrentDelay());

                this.numbers[this.j + 1] = this.numbers[this.j];
                this.incrementWrites(1);
                this.highlightAlgorithmLine('line5');
                this.renderArray([this.j, this.j + 1], [...Array(this.i).keys()], null, {
                    insertionKey: key,
                    insertionTargetIndex: this.j + 1
                });
                await OEIUtils.sleep(this.getCurrentDelay());

                this.j--;
                this.highlightAlgorithmLine('line6');
                this.renderArray([], [...Array(this.i).keys()], null, {
                    insertionKey: key,
                    insertionTargetIndex: this.j + 1
                });
                await OEIUtils.sleep(this.getCurrentDelay(0.75));
            }

            this.numbers[this.j + 1] = key;
            this.incrementWrites(1);
            this.setAction('Insertion de key=' + key + ' a l indice ' + (this.j + 1) + '.', true);
            this.highlightAlgorithmLine('line8');
            this.renderArray([this.j + 1], [...Array(this.i + 1).keys()]);
            await OEIUtils.sleep(this.getCurrentDelay());
        }

        this.keyValue = null;
        this.setAction('Tri termine: toutes les insertions sont effectuees.', true);
        this.renderArray([], this.numbers.map((_, index) => index));
        this.clearHighlight();
        this.isRunning = false;
    }

    async startSelectionSort() {
        this.isRunning = true;
        this.setAction('Demarrage du tri par selection.', true);

        for (this.i = 0; this.i < this.n - 1; this.i++) {
            this.highlightAlgorithmLine('line1');
            this.minIndex = this.i;
            this.setAction('Nouvelle passe i=' + this.i + ': minimum provisoire a l indice ' + this.minIndex + '.', true);
            this.highlightAlgorithmLine('line2');
            await OEIUtils.sleep(this.getCurrentDelay());

            for (this.j = this.i + 1; this.j < this.n; this.j++) {
                this.setAction('Comparer candidat j=' + this.j + ' au minimum courant indice ' + this.minIndex + '.', true);
                this.highlightAlgorithmLine('line3');
                this.renderArray([this.j, this.minIndex], this.getSortedIndices(this.i));
                await OEIUtils.sleep(this.getCurrentDelay());

                this.incrementComparisons(1);
                if (this.numbers[this.j] < this.numbers[this.minIndex]) {
                    this.highlightAlgorithmLine('line4');
                    await OEIUtils.sleep(this.getCurrentDelay(0.75));
                    this.minIndex = this.j;
                    this.setAction('Nouveau minimum trouve a l indice ' + this.minIndex + ' (valeur ' + this.numbers[this.minIndex] + ').', true);
                    this.highlightAlgorithmLine('line5');
                    this.renderArray([this.j, this.minIndex], this.getSortedIndices(this.i));
                    await OEIUtils.sleep(this.getCurrentDelay(0.75));
                }
            }

            if (this.minIndex !== this.i) {
                this.setAction('Permutation entre i=' + this.i + ' et min=' + this.minIndex + '.', true);
                this.highlightAlgorithmLine('line8');
                const swapDuration = this.getSwapAnimationDuration();
                this.renderArray([this.i, this.minIndex], this.getSortedIndices(this.i), null, {
                    animateSwap: true,
                    swapDurationMs: swapDuration
                });
                await OEIUtils.sleep(swapDuration);
                [this.numbers[this.i], this.numbers[this.minIndex]] = [this.numbers[this.minIndex], this.numbers[this.i]];
                this.incrementWrites(2);
                this.highlightAlgorithmLine('line9');
                this.renderArray([], this.getSortedIndices(this.i + 1));
                await OEIUtils.sleep(this.getPostSwapPause());
            }

            this.setAction('Indice ' + this.i + ' fixe dans la zone triee.', true);
            this.renderArray([], this.getSortedIndices(this.i + 1));
            await OEIUtils.sleep(this.getCurrentDelay(0.75));
        }

        this.setAction('Tri termine: tous les minimums successifs sont places.', true);
        this.renderArray([], [...Array(this.n).keys()]);
        this.clearHighlight();
        this.isRunning = false;
    }

    nextStep() {
        if (this.isRunning) return;

        if (this.algorithm === 'selection-sort') {
            this.nextStepSelection();
            return;
        }

        if (this.algorithm !== 'bubble-sort') return;

        if (this.isSwapping) {
            this.setAction('Etape: permutation des indices ' + this.j + ' et ' + (this.j + 1) + '.', true);
            [this.numbers[this.j], this.numbers[this.j + 1]] = [this.numbers[this.j + 1], this.numbers[this.j]];
            this.incrementWrites(2);
            this.renderArray([this.j, this.j + 1]);
            this.isSwapping = false;
            this.j++;
            return;
        }

        if (this.i < this.n - 1) {
            this.highlightAlgorithmLine('line1');

            if (this.j < this.n - this.i - 1) {
                this.setAction('Etape: comparaison des indices ' + this.j + ' et ' + (this.j + 1) + '.', true);
                this.highlightAlgorithmLine('line2');
                this.renderArray([this.j, this.j + 1], [...Array(this.n).keys()].slice(this.n - this.i));

                this.incrementComparisons(1);
                if (this.numbers[this.j] > this.numbers[this.j + 1]) {
                    this.setAction('Echange requis detecte.', true);
                    this.highlightAlgorithmLine('line3');
                    this.isSwapping = true;
                    return;
                }

                this.j++;
            } else {
                this.j = 0;
                this.i++;
            }
        } else {
            this.setAction('Tri termine.', true);
            this.renderArray([], this.numbers.map((_, index) => index));
            this.clearHighlight();
        }
    }

    nextStepSelection() {
        if (this.i >= this.n - 1) {
            this.setAction('Tri termine.', true);
            this.renderArray([], [...Array(this.n).keys()]);
            this.clearHighlight();
            return;
        }

        if (this.j < this.n) {
            this.setAction('Etape: comparaison j=' + this.j + ' vs min=' + this.minIndex + '.', true);
            this.highlightAlgorithmLine('line3');
            this.renderArray([this.j, this.minIndex], this.getSortedIndices(this.i));

            this.incrementComparisons(1);
            if (this.numbers[this.j] < this.numbers[this.minIndex]) {
                this.highlightAlgorithmLine('line4');
                this.minIndex = this.j;
                this.highlightAlgorithmLine('line5');
            }
            this.j++;
            return;
        }

        if (this.minIndex !== this.i) {
            this.setAction('Permutation i=' + this.i + ' avec min=' + this.minIndex + '.', true);
            this.highlightAlgorithmLine('line8');
            [this.numbers[this.i], this.numbers[this.minIndex]] = [this.numbers[this.minIndex], this.numbers[this.i]];
            this.incrementWrites(2);
            this.highlightAlgorithmLine('line9');
        }

        this.i++;
        this.minIndex = this.i;
        this.j = this.i + 1;
        this.renderArray([], this.getSortedIndices(this.i));
    }

    reset() {
        this.isRunning = false;
        this.initArray();
        this.resetMetrics();
        this.setAction('Tableau reinitialise. Lance une simulation pour observer les variables.', false);

        if (this.algorithm === 'selection-sort') {
            this.i = 0;
            this.minIndex = 0;
            this.j = 1;
        }

        this.clearHighlight();
        this.render();
    }
}

if (typeof window !== 'undefined') {
    window.SortingVisualizer = SortingVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// SortingWidget — Widget autonome pour intégration dans les slides
// Couvre : bubble-sort, insertion-sort, selection-sort
// Usage : SortingWidget.mount(container, { algorithm: 'bubble-sort', data: [...] })
// ─────────────────────────────────────────────────────────────────────────────
class SortingWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (SortingWidget._stylesInjected) return;
        SortingWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.sw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.sw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.sw-array-zone{display:flex;align-items:flex-end;gap:4px;height:140px;padding-top:24px;padding-bottom:20px;position:relative;}
.sw-bar{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;flex:1;position:relative;}
.sw-bar-inner{width:100%;border-radius:4px 4px 0 0;background:var(--sl-primary,#6366f1);transition:height .25s,background .2s;border:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.sw-bar.current .sw-bar-inner{background:var(--sl-accent,#f97316);}
.sw-bar.swapping .sw-bar-inner{background:#ef4444;}
.sw-bar.sorted .sw-bar-inner{background:#22c55e;}
.sw-bar.min-mark .sw-bar-inner{background:#a855f7;}
.sw-bar.key-mark .sw-bar-inner{background:#eab308;}
.sw-val{position:absolute;top:-18px;font-size:10px;color:var(--sl-text,#e2e8f0);white-space:nowrap;}
.sw-idx{position:absolute;bottom:-16px;font-size:9px;color:var(--sl-muted,#94a3b8);}
.sw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;display:flex;justify-content:space-between;gap:8px;}
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

    static mount(container, config = {}) {
        SortingWidget.ensureStyles();
        const w = new SortingWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.algorithm = config.algorithm || config.type || 'bubble-sort';
        const defaultData = Array.from({length: 8}, () => Math.floor(Math.random() * 85) + 5);
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 16) : defaultData;
        this.numbers = [...this.originalData];
        this.n = this.numbers.length;
        this._resetState();
        this._timer = null;
        this.isRunning = false;
    }

    _resetState() {
        this.numbers = [...this.originalData];
        this.n = this.numbers.length;
        this.i = 0;
        this.j = this.algorithm === 'insertion-sort' ? 1
               : this.algorithm === 'selection-sort' ? 1 : 0;
        this.minIndex = 0;
        this.keyValue = null;
        this.done = false;
        this.compCount = 0;
        this.swapCount = 0;
        this.sortedIndices = new Set();
        this.activeIndices = [];
        this.swappingIndices = [];
        this.action = 'Prêt — cliquez ▶ Lancer ou Étape';
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
            else if (this.swappingIndices.includes(idx)) bar.classList.add('swapping');
            else if (this.activeIndices.includes(idx)) bar.classList.add('current');
            if (this.algorithm === 'selection-sort' && idx === this.minIndex && !this.done)
                bar.classList.add('min-mark');
            if (this.algorithm === 'insertion-sort' && v === this.keyValue && this.activeIndices.includes(idx))
                bar.classList.add('key-mark');
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
        this.root.querySelector('.sw-btn-reset')?.addEventListener('click', () => { this._stop(); this._reset(); });
    }

    _togglePlay() {
        if (this.isRunning) { this._stop(); return; }
        if (this.done) { this._reset(); }
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

    _reset() {
        this._resetState();
        this._render();
    }

    _step() {
        if (this.done) return;
        if (this.algorithm === 'bubble-sort') this._stepBubble();
        else if (this.algorithm === 'insertion-sort') this._stepInsertion();
        else if (this.algorithm === 'selection-sort') this._stepSelection();
        this._render();
    }

    _stepBubble() {
        const a = this.numbers;
        const n = this.n;
        while (this.i < n - 1) {
            if (this.j < n - 1 - this.i) {
                this.compCount++;
                this.activeIndices = [this.j, this.j + 1];
                if (a[this.j] > a[this.j + 1]) {
                    [a[this.j], a[this.j + 1]] = [a[this.j + 1], a[this.j]];
                    this.swapCount++;
                    this.swappingIndices = [this.j, this.j + 1];
                    this.action = `Échange a[${this.j}]=${a[this.j]} ↔ a[${this.j+1}]=${a[this.j+1]}`;
                } else {
                    this.swappingIndices = [];
                    this.action = `a[${this.j}]=${a[this.j]} ≤ a[${this.j+1}]=${a[this.j+1]} — OK`;
                }
                this.j++;
                return;
            }
            this.sortedIndices.add(n - 1 - this.i);
            this.i++;
            this.j = 0;
        }
        for (let k = 0; k < n; k++) this.sortedIndices.add(k);
        this.done = true;
        this.activeIndices = [];
        this.swappingIndices = [];
        this.action = '✅ Tableau trié !';
        this._stop();
    }

    _stepInsertion() {
        const a = this.numbers;
        const n = this.n;
        if (this.i >= n) {
            for (let k = 0; k < n; k++) this.sortedIndices.add(k);
            this.done = true;
            this.activeIndices = [];
            this.action = '✅ Tableau trié !';
            this._stop();
            return;
        }
        const key = a[this.i];
        this.keyValue = key;
        let j = this.i - 1;
        while (j >= 0 && a[j] > key) {
            this.compCount++;
            a[j + 1] = a[j];
            this.swapCount++;
            j--;
        }
        if (j >= 0) this.compCount++;
        a[j + 1] = key;
        for (let k = 0; k <= this.i; k++) this.sortedIndices.add(k);
        this.activeIndices = [j + 1];
        this.action = `Insertion de ${key} → position ${j + 1}`;
        this.i++;
    }

    _stepSelection() {
        const a = this.numbers;
        const n = this.n;
        if (this.i >= n - 1) {
            this.sortedIndices.add(n - 1);
            this.done = true;
            this.activeIndices = [];
            this.action = '✅ Tableau trié !';
            this._stop();
            return;
        }
        let minIdx = this.i;
        for (let k = this.i + 1; k < n; k++) {
            this.compCount++;
            if (a[k] < a[minIdx]) minIdx = k;
        }
        this.minIndex = minIdx;
        if (minIdx !== this.i) {
            [a[this.i], a[minIdx]] = [a[minIdx], a[this.i]];
            this.swapCount++;
            this.swappingIndices = [this.i, minIdx];
            this.action = `Min=${a[this.i]} (à [${minIdx}]) → échangé avec [${this.i}]`;
        } else {
            this.swappingIndices = [];
            this.action = `Min=${a[this.i]} déjà à sa place [${this.i}]`;
        }
        this.sortedIndices.add(this.i);
        this.activeIndices = [this.i];
        this.i++;
        this.minIndex = this.i;
    }
}

if (typeof window !== 'undefined') {
    window.SortingWidget = SortingWidget;
}
