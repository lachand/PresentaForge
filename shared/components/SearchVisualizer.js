/**
 * SearchVisualizer - Visualisation des recherches séquentielle et dichotomique
 */
class SearchVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);

        this.algorithm = 'sequential'; // sequential | binary
        this.values = [];
        this.defaultData = [];

        this.target = null;

        // sequential state
        this.currentIdx = -1;
        this.compCount = 0;
        this.searching = false;
        this.found = false;

        // binary state
        this.low = 0;
        this.high = 0;
        this.mid = -1;
        this.midValue = null;

        this.eliminatedIndices = new Set();
        this.excludedLeftIndices = new Set();
        this.excludedRightIndices = new Set();
        this.totalCost = 0;
        this.currentDecision = '';
        this.traceEntries = [];
        this.traceStep = 0;
        this.maxTraceEntries = 12;
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        this.bindPedagogyModeToggle();
        const cfg = this.data?.visualization?.config;
        this.algorithm = cfg?.algorithm || this.algorithm || 'sequential';
        this.defaultData = Array.isArray(cfg?.defaultData) ? cfg.defaultData : [];
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

    renderPseudocodeFromData() {
        const host = document.getElementById('pseudocode-container');
        if (!host) return;
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks) || blocks.length === 0) return;

        let idx = 1;
        const lines = [];
        blocks.forEach((block) => {
            (block.lines || []).forEach((line) => {
                const content = (typeof PseudocodeSupport !== 'undefined')
                    ? PseudocodeSupport.renderLineContent(line, {
                        autoKeywordHighlight: true,
                        domain: this.data?.metadata?.category
                    })
                    : this.escapeHtml(line);
                lines.push('<span class="line" id="line' + (idx++) + '">' + content + '</span>');
            });
        });

        host.innerHTML = '<div class="card algorithm-code">' + lines.join('') + '</div>';
    }

    render() {
        this.renderVisualizer();
        this.updateInfo();
    }

    addTrace(message) {
        if (!message) return;
        this.traceStep += 1;
        this.traceEntries.unshift({ step: this.traceStep, text: message });
        if (this.traceEntries.length > this.maxTraceEntries) {
            this.traceEntries = this.traceEntries.slice(0, this.maxTraceEntries);
        }
    }

    setDecision(message, record = true) {
        this.currentDecision = message || '';
        if (record && this.currentDecision) this.addTrace(this.currentDecision);
        this.updateTeachingPanels();
    }

    resetNarration() {
        this.currentDecision = 'En attente de demarrage.';
        this.traceEntries = [];
        this.traceStep = 0;
        this.updateTeachingPanels();
    }

    initData() {
        if (this.defaultData.length > 0) {
            this.values = [...this.defaultData];
            return;
        }

        if (this.algorithm === 'binary') {
            this.values = ['abeille', 'banane', 'cerise', 'chat', 'chien', 'elephant', 'fraise', 'girafe', 'lion', 'mouton', 'pomme', 'renard', 'souris', 'tigre', 'zebre'];
        } else {
            this.values = Array.from({ length: 12 }, () => Math.floor(Math.random() * 100));
        }
    }

    renderVisualizer() {
        const vis = document.getElementById('visualizer');
        if (!vis) return;

        vis.innerHTML = '';
        this.values.forEach((value, index) => {
            const container = document.createElement('div');
            container.className = 'number-container';

            const cell = document.createElement('div');
            cell.className = 'number';
            cell.id = 'num-' + index;

            const pointerLayer = document.createElement('div');
            pointerLayer.className = 'array-pointer-row';
            pointerLayer.id = 'pointer-' + index;

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

        if (this.algorithm === 'binary') {
            this.highlightRange(this.low, this.high);
        }
        this.updatePointers();
    }

    highlightLine(lineId) {
        super.highlightLine(lineId);
    }

    clearHighlight() {
        super.clearHighlight();
    }

    updateInfo() {
        const costEl = document.getElementById('search-cost-total');
        const eliminatedEl = document.getElementById('search-eliminated-count');
        const rangeEl = document.getElementById('search-active-range');
        const comparisonsEl = document.getElementById('comparisons');
        if (costEl) costEl.textContent = String(this.totalCost);
        if (eliminatedEl) eliminatedEl.textContent = String(this.eliminatedIndices.size);

        if (this.algorithm === 'sequential') {
            const currentIndexEl = document.getElementById('currentIndex');
            const currentValueEl = document.getElementById('currentValue');

            if (currentIndexEl) currentIndexEl.textContent = 'Indice courant : ' + (this.currentIdx >= 0 ? this.currentIdx : '-');
            if (currentValueEl) currentValueEl.textContent = 'Valeur courante : ' + (this.currentIdx >= 0 ? this.values[this.currentIdx] : '-');
            if (comparisonsEl) comparisonsEl.textContent = 'Comparaisons : ' + this.compCount;
            if (rangeEl) {
                const start = this.currentIdx < 0 ? 0 : this.currentIdx;
                rangeEl.textContent = start <= this.values.length - 1 ? (start + '..' + (this.values.length - 1)) : '--';
            }

            const visitedEl = document.getElementById('search-seq-visited-text');
            const remainingEl = document.getElementById('search-seq-remaining-text');
            const n = this.values.length;
            if (visitedEl || remainingEl) {
                let visited = 'Aucune';
                let remaining = n > 0 ? ('0..' + (n - 1)) : 'Aucune';

                if (this.currentIdx >= 0 && n > 0) {
                    const end = Math.min(this.currentIdx, n - 1);
                    visited = '0..' + end;

                    if (this.found) {
                        remaining = 'Aucune (trouve)';
                    } else if (end + 1 <= n - 1) {
                        remaining = (end + 1) + '..' + (n - 1);
                    } else {
                        remaining = 'Aucune';
                    }
                }

                if (visitedEl) visitedEl.textContent = visited;
                if (remainingEl) remainingEl.textContent = remaining;
            }
            this.updateTeachingPanels();
            this.updatePointers();
            return;
        }

        const lowEl = document.getElementById('low');
        const highEl = document.getElementById('high');
        const midEl = document.getElementById('mid');
        const midValueEl = document.getElementById('midValue');

        if (lowEl) lowEl.textContent = 'Indice minimum : ' + this.low;
        if (highEl) highEl.textContent = 'Indice maximum : ' + this.high;
        if (midEl) midEl.textContent = 'Indice du milieu : ' + (this.mid >= 0 ? this.mid : '-');
        if (midValueEl) midValueEl.textContent = 'Valeur du milieu : ' + (this.midValue !== null ? this.midValue : '-');
        if (comparisonsEl) comparisonsEl.textContent = String(this.compCount);
        if (rangeEl) {
            rangeEl.textContent = this.low <= this.high ? (this.low + '..' + this.high) : '--';
        }

        const activeIntervalEl = document.getElementById('search-active-interval-text');
        const excludedLeftEl = document.getElementById('search-excluded-left-text');
        const excludedRightEl = document.getElementById('search-excluded-right-text');
        if (activeIntervalEl) {
            activeIntervalEl.textContent = this.low <= this.high ? (this.low + '..' + this.high) : 'Vide';
        }
        if (excludedLeftEl) {
            excludedLeftEl.textContent = this.low > 0 ? ('0..' + (this.low - 1)) : 'Aucun';
        }
        if (excludedRightEl) {
            const n = this.values.length;
            excludedRightEl.textContent = this.high < n - 1 ? ((this.high + 1) + '..' + (n - 1)) : 'Aucun';
        }

        this.updateTeachingPanels();
        this.updatePointers();
    }

    updateTeachingPanels() {
        const decisionEl = document.getElementById('search-current-decision');
        if (decisionEl) {
            decisionEl.textContent = this.currentDecision || 'En attente.';
        }

        const traceEl = document.getElementById('search-trace-list');
        if (traceEl) {
            traceEl.innerHTML = '';
            if (!this.traceEntries.length) {
                const empty = document.createElement('div');
                empty.className = 'trace-item';
                empty.textContent = 'Aucune etape enregistree.';
                traceEl.appendChild(empty);
            } else {
                this.traceEntries.forEach((entry) => {
                    const row = document.createElement('div');
                    row.className = 'trace-item';
                    row.innerHTML = '<span class="step">#' + entry.step + '</span>' + this.escapeHtml(entry.text);
                    traceEl.appendChild(row);
                });
            }
        }

        const vars = {
            target: this.target !== null ? this.target : '-',
            current: this.currentIdx,
            currentValue: this.currentIdx >= 0 ? this.values[this.currentIdx] : '-',
            low: this.low,
            high: this.high,
            mid: this.mid,
            comparisons: this.compCount,
            cost: this.totalCost
        };

        Object.keys(vars).forEach((key) => {
            const el = document.getElementById('search-var-' + key);
            if (!el) return;
            const value = vars[key];
            if (typeof value === 'number' && value < 0) {
                el.textContent = '-';
            } else {
                el.textContent = String(value);
            }
        });
    }

    updatePointers() {
        const addBadge = (index, text) => {
            const row = document.getElementById('pointer-' + index);
            if (!row) return;
            const badge = document.createElement('span');
            badge.className = 'pointer-badge search-pointer';
            badge.textContent = text;
            row.appendChild(badge);
        };

        this.values.forEach((_, index) => {
            const row = document.getElementById('pointer-' + index);
            if (row) row.innerHTML = '';
        });

        if (this.algorithm === 'sequential') {
            if (this.currentIdx >= 0) addBadge(this.currentIdx, 'i');
            return;
        }

        if (this.low >= 0) addBadge(this.low, 'L');
        if (this.high >= 0) addBadge(this.high, 'H');
        if (this.mid >= 0) addBadge(this.mid, 'M');
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

    resetVisualClasses() {
        this.values.forEach((_, i) => {
            const el = document.getElementById('num-' + i);
            if (el) {
                el.classList.remove('current', 'found', 'checked', 'active', 'eliminated', 'mid', 'excluded-left', 'excluded-right');
                el.style.background = '';
                el.style.color = '';
            }
        });
        this.updatePointers();
    }

    setResult(message, type) {
        const result = document.getElementById('result');
        if (!result) return;
        result.textContent = message || '';
        if (type === 'ok') result.style.color = 'var(--accent)';
        else if (type === 'bad') result.style.color = 'var(--danger)';
        else result.style.color = '';
    }

    async startSearch() {
        this.target = this.getTargetInputValue();
        if (this.target === null) {
            this.setResult('Veuillez entrer une valeur valide.', 'bad');
            return;
        }

        if (this.algorithm === 'binary') {
            await this.startBinarySearch();
            return;
        }

        await this.startSequentialSearch();
    }

    async startSequentialSearch() {
        this.resetVisualClasses();
        this.searching = true;
        this.found = false;
        this.currentIdx = -1;
        this.compCount = 0;
        this.totalCost = 0;
        this.eliminatedIndices.clear();
        this.excludedLeftIndices.clear();
        this.excludedRightIndices.clear();
        this.resetNarration();
        this.setDecision('Demarrage de la recherche sequentielle (scan de gauche a droite).', true);
        this.updateInfo();

        this.setResult('', '');

        while (this.searching && !this.found) {
            const cont = await this.stepSequential();
            if (!cont) break;
            await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
        }
    }

    async stepSequential() {
        if (!this.searching || this.found) return false;

        if (this.currentIdx >= 0) {
            const prev = document.getElementById('num-' + this.currentIdx);
            if (prev) {
                prev.classList.remove('current');
                prev.classList.add('checked');
            }
            this.eliminatedIndices.add(this.currentIdx);
        }

        this.currentIdx++;
        if (this.currentIdx >= this.values.length) {
            this.highlightLine('line5');
            this.setResult('Valeur non trouvée !', 'bad');
            this.setDecision('Fin du tableau atteinte: la cible est absente.', true);
            this.searching = false;
            this.updateInfo();
            return false;
        }

        this.highlightLine('line2');
        this.setDecision('Comparer la cible avec la case i=' + this.currentIdx + ' (valeur ' + this.values[this.currentIdx] + ').', true);
        const current = document.getElementById('num-' + this.currentIdx);
        if (current) current.classList.add('current');

        this.compCount++;
        this.totalCost++;
        this.updateInfo();
        await OEIUtils.sleep(250);

        this.highlightLine('line3');
        if (this.values[this.currentIdx] === this.target) {
            this.highlightLine('line4');
            if (current) {
                current.classList.remove('current');
                current.classList.add('found');
            }
            this.setResult('Valeur trouvee a l indice ' + this.currentIdx + ' !', 'ok');
            this.setDecision('Egalite detectee: A[i] = cible, arret de la recherche.', true);
            this.found = true;
            this.searching = false;
        } else {
            this.setDecision('Pas d egalite: passer a i=' + (this.currentIdx + 1) + '.', true);
        }

        return true;
    }

    highlightRange(low, high) {
        this.values.forEach((_, index) => {
            const element = document.getElementById('num-' + index);
            if (!element) return;
            if (this.algorithm === 'binary') {
                const isLeft = index < low;
                const isRight = index > high;
                const isActive = !isLeft && !isRight;

                element.classList.toggle('excluded-left', isLeft);
                element.classList.toggle('excluded-right', isRight);
                element.classList.toggle('active', isActive);
                element.classList.toggle('eliminated', isLeft || isRight);
                return;
            }

            element.classList.toggle('eliminated', this.eliminatedIndices.has(index));
            element.classList.remove('excluded-left', 'excluded-right');
            element.classList.toggle('active', index >= low && index <= high);
        });
    }

    async startBinarySearch() {
        this.low = 0;
        this.high = this.values.length - 1;
        this.mid = -1;
        this.midValue = null;
        this.searching = true;
        this.compCount = 0;
        this.totalCost = 0;
        this.eliminatedIndices.clear();
        this.excludedLeftIndices.clear();
        this.excludedRightIndices.clear();
        this.resetNarration();
        this.setDecision('Demarrage de la dichotomie: intervalle initial [0..' + (this.values.length - 1) + '].', true);

        this.resetVisualClasses();
        this.highlightRange(this.low, this.high);
        this.setResult('', '');
        this.updateInfo();

        while (this.searching) {
            const cont = await this.stepBinary();
            if (!cont) break;
            await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
        }
    }

    async stepBinary() {
        if (this.low > this.high) {
            this.highlightLine('line12');
            this.setResult('Valeur non trouvee !', 'bad');
            this.setDecision('Intervalle vide (low > high): la cible est absente.', true);
            this.searching = false;
            this.clearHighlight();
            this.updateInfo();
            return false;
        }

        this.highlightLine('line4');
        this.mid = Math.floor((this.low + this.high) / 2);
        this.midValue = this.values[this.mid];
        this.highlightRange(this.low, this.high);
        this.compCount++;
        this.totalCost++;
        this.setDecision('Calcul du milieu: mid=' + this.mid + ', A[mid]=' + this.midValue + '.', true);
        this.updateInfo();

        const midElement = document.getElementById('num-' + this.mid);
        if (midElement) {
            midElement.classList.add('mid');
        }

        const delay = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        await OEIUtils.sleep(delay * 0.15);
        this.highlightLine('line5');

        if (this.values[this.mid] === this.target) {
            await OEIUtils.sleep(delay * 0.3);
            this.highlightLine('line6');
            await OEIUtils.sleep(delay * 0.45);
            this.highlightLine('line7');
            if (midElement) {
                midElement.classList.remove('mid');
                midElement.classList.add('found');
            }
            this.setResult('Valeur trouvee a l indice ' + this.mid + ' !', 'ok');
            this.setDecision('A[mid] == cible: recherche terminee.', true);
            this.clearHighlight();
            this.searching = false;
            this.updateInfo();
            return false;
        }

        if (this.values[this.mid] < this.target) {
            await OEIUtils.sleep(delay * 0.3);
            this.highlightLine('line8');
            await OEIUtils.sleep(delay * 0.45);
            this.highlightLine('line9');
            const oldLow = this.low;
            for (let idx = oldLow; idx <= this.mid; idx++) this.eliminatedIndices.add(idx);
            for (let idx = oldLow; idx <= this.mid; idx++) this.excludedLeftIndices.add(idx);
            this.low = this.mid + 1;
            this.setDecision('A[mid] < cible: exclusion de [' + oldLow + '..' + this.mid + '], nouvel intervalle [' + this.low + '..' + this.high + '].', true);
            this.highlightRange(this.low, this.high);
            if (midElement) midElement.classList.remove('mid');
            this.updateInfo();
            return true;
        }

        await OEIUtils.sleep(delay * 0.3);
        this.highlightLine('line10');
        await OEIUtils.sleep(delay * 0.45);
        this.highlightLine('line11');
        const oldHigh = this.high;
        for (let idx = this.mid; idx <= oldHigh; idx++) this.eliminatedIndices.add(idx);
        for (let idx = this.mid; idx <= oldHigh; idx++) this.excludedRightIndices.add(idx);
        this.high = this.mid - 1;
        this.setDecision('A[mid] > cible: exclusion de [' + this.mid + '..' + oldHigh + '], nouvel intervalle [' + this.low + '..' + this.high + '].', true);
        this.highlightRange(this.low, this.high);
        if (midElement) midElement.classList.remove('mid');
        this.updateInfo();
        return true;
    }

    async step() {
        if (this.algorithm === 'binary') {
            if (!this.searching) {
                this.target = this.getTargetInputValue();
                if (this.target === null) {
                    this.setResult('Veuillez entrer une valeur valide.', 'bad');
                    return;
                }
                this.low = 0;
                this.high = this.values.length - 1;
                this.searching = true;
                this.resetVisualClasses();
                this.eliminatedIndices.clear();
                this.excludedLeftIndices.clear();
                this.excludedRightIndices.clear();
                this.compCount = 0;
                this.totalCost = 0;
                this.resetNarration();
                this.setDecision('Mode pas a pas: intervalle initial [0..' + (this.values.length - 1) + '].', true);
            }
            await this.stepBinary();
            this.updateInfo();
            return;
        }

        if (!this.searching) {
            this.target = this.getTargetInputValue();
            if (this.target === null) {
                this.setResult('Veuillez entrer une valeur valide.', 'bad');
                return;
            }
            this.searching = true;
            this.found = false;
            this.currentIdx = -1;
            this.compCount = 0;
            this.totalCost = 0;
            this.eliminatedIndices.clear();
            this.excludedLeftIndices.clear();
            this.excludedRightIndices.clear();
            this.resetVisualClasses();
            this.setResult('', '');
            this.resetNarration();
            this.setDecision('Mode pas a pas: demarrage du parcours sequentiel.', true);
        }
        await this.stepSequential();
    }

    async stepSearch() {
        await this.step();
    }

    resetSearch() {
        this.searching = false;
        this.found = false;
        this.currentIdx = -1;
        this.compCount = 0;
        this.target = null;
        this.low = 0;
        this.high = this.values.length - 1;
        this.mid = -1;
        this.midValue = null;
        this.totalCost = 0;
        this.eliminatedIndices.clear();
        this.excludedLeftIndices.clear();
        this.excludedRightIndices.clear();
        this.resetNarration();

        const targetEl = document.getElementById('target');
        if (targetEl) targetEl.value = '';

        this.setResult('', '');

        this.clearHighlight();
        this.resetVisualClasses();
        this.render();
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
// SearchWidget — Widget autonome pour intégration dans les slides
// Couvre : sequential (recherche séquentielle), binary (recherche dichotomique)
// Usage : SearchWidget.mount(container, { algorithm: 'binary', data: [...], target: 23 })
// ─────────────────────────────────────────────────────────────────────────────
class SearchWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (SearchWidget._stylesInjected) return;
        SearchWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.srw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.srw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.srw-input-row{display:flex;gap:8px;align-items:center;font-size:.78rem;}
.srw-input-row label{color:var(--sl-muted,#94a3b8);}
.srw-input-row input{width:70px;padding:4px 8px;border-radius:5px;border:1px solid var(--border,var(--sl-border,#334155));background:var(--surface,rgba(0,0,0,.18));color:var(--text,var(--sl-text,#e2e8f0));font-size:.78rem;}
.srw-array-zone{display:flex;gap:4px;align-items:stretch;flex-wrap:wrap;min-height:60px;}
.srw-cell{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px;flex:1;border-radius:6px;background:var(--surface,rgba(0,0,0,.14));border:2px solid var(--border,var(--sl-border,rgba(255,255,255,.15)));position:relative;padding:8px 4px;transition:border-color .2s,background .2s;}
.srw-cell .srw-val{font-size:.9rem;font-weight:600;}
.srw-cell .srw-cell-idx{font-size:.65rem;color:var(--sl-muted,#94a3b8);margin-top:2px;}
.srw-cell.current{border-color:var(--sl-accent,#f97316);background:rgba(249,115,22,.12);}
.srw-cell.found{border-color:#22c55e;background:rgba(34,197,94,.15);}
.srw-cell.checked{border-color:var(--sl-border,#334155);opacity:.45;}
.srw-cell.eliminated{opacity:.3;text-decoration:line-through;}
.srw-cell.low-mark,.srw-cell.high-mark{border-color:#6366f1;}
.srw-cell.mid-mark{border-color:#a855f7;background:rgba(168,85,247,.15);}
.srw-pointer-row{display:flex;gap:4px;align-items:flex-start;min-height:16px;margin-top:2px;}
.srw-pointer{font-size:.6rem;padding:1px 4px;border-radius:3px;background:var(--sl-primary,#6366f1);color:#fff;white-space:nowrap;}
.srw-pointer.p-low{background:#6366f1;}
.srw-pointer.p-high{background:#6366f1;}
.srw-pointer.p-mid{background:#a855f7;}
.srw-pointer.p-cur{background:var(--sl-accent,#f97316);}
.srw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;display:flex;justify-content:space-between;gap:8px;}
.srw-action{flex:1;opacity:.9;}
.srw-metrics{color:var(--sl-muted,#94a3b8);white-space:nowrap;}
.srw-controls{display:flex;gap:8px;flex-wrap:wrap;}
.srw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.srw-btn:hover:not(:disabled){opacity:.8;}
.srw-btn:disabled{opacity:.35;cursor:not-allowed;}
.srw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        SearchWidget.ensureStyles();
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
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 20) : defaultData;
        // Binary search requires sorted data
        if (this.algorithm === 'binary') {
            this.originalData = [...this.originalData].sort((a, b) => a - b);
        }
        this.defaultTarget = config.target != null ? Number(config.target) : this.originalData[Math.floor(this.originalData.length * 0.6)];
        this._resetState();
        this._timer = null;
        this.isRunning = false;
    }

    _resetState() {
        this.values = [...this.originalData];
        this.n = this.values.length;
        this.target = this.defaultTarget;
        // sequential state
        this.currentIdx = -1;
        this.found = false;
        this.done = false;
        this.compCount = 0;
        // binary state
        this.low = 0;
        this.high = this.n - 1;
        this.mid = -1;
        this.eliminatedLeft = new Set();
        this.eliminatedRight = new Set();
        this.action = 'Entrez une valeur et cliquez ▶ Lancer';
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
        this._render();
        this._bindControls();
    }

    _render() {
        const zone = this.root.querySelector('.srw-array-zone');
        if (!zone) return;
        zone.innerHTML = '';
        this.values.forEach((v, idx) => {
            const cell = document.createElement('div');
            cell.className = 'srw-cell';
            if (this.found && idx === this.currentIdx) cell.classList.add('found');
            else if (this.algorithm === 'sequential') {
                if (idx < this.currentIdx) cell.classList.add('checked');
                else if (idx === this.currentIdx) cell.classList.add('current');
            } else {
                if (this.eliminatedLeft.has(idx) || this.eliminatedRight.has(idx)) cell.classList.add('eliminated');
                else if (idx === this.mid && this.mid >= 0) cell.classList.add('mid-mark');
                else if (idx === this.low || idx === this.high) cell.classList.add('low-mark');
            }
            cell.innerHTML = `<span class="srw-val">${v}</span><span class="srw-cell-idx">[${idx}]</span>`;
            zone.appendChild(cell);
        });

        // pointer row for binary search
        const prow = this.root.querySelector('.srw-pointer-row');
        if (prow && this.algorithm === 'binary') {
            const cells = zone.querySelectorAll('.srw-cell');
            const cellW = cells[0] ? cells[0].offsetWidth : 44;
            prow.innerHTML = '';
            const addPtr = (idx, label, cls) => {
                if (idx < 0 || idx >= this.n) return;
                const span = document.createElement('span');
                span.className = `srw-pointer ${cls}`;
                span.textContent = label;
                span.style.marginLeft = (idx * (cellW + 4)) + 'px';
                prow.appendChild(span);
            };
            if (!this.done) {
                addPtr(this.low, 'low', 'p-low');
                if (this.mid >= 0 && this.mid !== this.low && this.mid !== this.high) addPtr(this.mid, 'mid', 'p-mid');
                if (this.high !== this.low) addPtr(this.high, 'high', 'p-high');
            }
        }

        const act = this.root.querySelector('.srw-action');
        if (act) act.textContent = this.action;
        const met = this.root.querySelector('.srw-metrics');
        if (met) met.textContent = `Comparaisons : ${this.compCount}`;
    }

    _bindControls() {
        const inp = this.root.querySelector('.srw-target-input');
        inp?.addEventListener('change', () => {
            const v = parseInt(inp.value);
            if (!isNaN(v)) { this.defaultTarget = v; this._stop(); this._resetState(); this._render(); }
        });
        this.root.querySelector('.srw-btn-play')?.addEventListener('click', () => this._togglePlay());
        this.root.querySelector('.srw-btn-step')?.addEventListener('click', () => { this._stop(); this._step(); });
        this.root.querySelector('.srw-btn-reset')?.addEventListener('click', () => { this._stop(); this._resetState(); this._render(); });
    }

    _togglePlay() {
        if (this.isRunning) { this._stop(); return; }
        if (this.done) { this._resetState(); this._render(); }
        const inp = this.root.querySelector('.srw-target-input');
        if (inp) this.target = parseInt(inp.value) || this.defaultTarget;
        this.isRunning = true;
        const btn = this.root.querySelector('.srw-btn-play');
        if (btn) btn.textContent = '⏸ Pause';
        this._run();
    }

    _stop() {
        this.isRunning = false;
        clearTimeout(this._timer);
        const btn = this.root.querySelector('.srw-btn-play');
        if (btn) btn.textContent = '▶ Lancer';
    }

    _run() {
        if (!this.isRunning || this.done) { this._stop(); return; }
        this._step();
        if (!this.done) this._timer = setTimeout(() => this._run(), 600);
    }

    _step() {
        if (this.done) return;
        // Read current target from input on first step
        if (this.compCount === 0 && this.currentIdx === -1 && this.mid === -1) {
            const inp = this.root.querySelector('.srw-target-input');
            if (inp) this.target = parseInt(inp.value) || this.defaultTarget;
        }
        if (this.algorithm === 'binary') this._stepBinary();
        else this._stepSequential();
        this._render();
    }

    _stepSequential() {
        const nextIdx = this.currentIdx + 1;
        if (nextIdx >= this.n) {
            this.done = true;
            this.action = `❌ ${this.target} non trouvé dans le tableau`;
            this._stop();
            return;
        }
        this.currentIdx = nextIdx;
        this.compCount++;
        if (this.values[nextIdx] === this.target) {
            this.found = true;
            this.done = true;
            this.action = `✅ Trouvé : ${this.target} à l'index [${nextIdx}] en ${this.compCount} comparaison(s)`;
            this._stop();
        } else {
            this.action = `a[${nextIdx}]=${this.values[nextIdx]} ≠ ${this.target} → continuer`;
        }
    }

    _stepBinary() {
        if (this.low > this.high) {
            this.done = true;
            this.action = `❌ ${this.target} non trouvé (espace de recherche épuisé)`;
            this._stop();
            return;
        }
        this.mid = Math.floor((this.low + this.high) / 2);
        this.compCount++;
        if (this.values[this.mid] === this.target) {
            this.found = true;
            this.done = true;
            this.currentIdx = this.mid;
            this.action = `✅ Trouvé : ${this.target} à l'index [${this.mid}] en ${this.compCount} comparaison(s)`;
            this._stop();
        } else if (this.values[this.mid] < this.target) {
            this.action = `a[${this.mid}]=${this.values[this.mid]} < ${this.target} → chercher à droite [${this.mid+1}..${this.high}]`;
            for (let k = this.low; k <= this.mid; k++) this.eliminatedLeft.add(k);
            this.low = this.mid + 1;
        } else {
            this.action = `a[${this.mid}]=${this.values[this.mid]} > ${this.target} → chercher à gauche [${this.low}..${this.mid-1}]`;
            for (let k = this.mid; k <= this.high; k++) this.eliminatedRight.add(k);
            this.high = this.mid - 1;
        }
    }
}

if (typeof window !== 'undefined') {
    window.SearchWidget = SearchWidget;
}
