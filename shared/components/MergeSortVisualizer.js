/**
 * MergeSortVisualizer — visualisation du tri fusion (TOP-DOWN récursif, arbre d'appels).
 *
 * L'algorithme vit dans shared/components/algorithms/sort-traces.js →
 * buildMergeSortTrace() (canon retenu 3G : top-down récursif — le widget slide
 * consomme désormais la même trace, fin de l'incohérence bottom-up/top-down).
 * Cette classe est l'ADAPTATEUR PAGE ; MergeSortWidget l'ADAPTATEUR SLIDE.
 */
class MergeSortVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.ARRAY_SIZE = 8;
        this.originalNumbers = [];
        this.linearArray = [];
    }

    async init() {
        await super.init();
        const cfg = this.data?.visualization?.config;
        this.ARRAY_SIZE = cfg?.size || 8;
        this.reset();
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/sort-traces.js'];
    }

    buildTrace() {
        if (typeof OEITrace === 'undefined') return [];
        return OEITrace.buildMergeSortTrace([...this.originalNumbers], { variant: 'top-down' });
    }

    stepDelay(step) {
        switch (step && step.delay) {
            case 'quick': return this.getCurrentDelay(0.35);
            case 'half': return this.getCurrentDelay(0.5);
            default: return this.getCurrentDelay();
        }
    }

    renderStep(step) {
        if (!step) return;
        const v = step.view || {};
        this.linearArray = (v.linear && v.linear.values) ? v.linear.values.slice() : step.array.slice();
        this.renderTree(v.tree || []);
        this.renderLinearArray(v.linear || null);
        this.renderSortedRuns(v.sortedRuns || []);
        this.updateMergeStats(step);
        this.setPhase(v.phaseLabel || '', v.phaseLabel && v.phaseLabel.includes('fusion') ? 'merge' : 'split');
        this.setStatus(step.caption || '');
    }

    onPlayerState(state) {
        const btn = document.getElementById('btn-start');
        if (btn) btn.textContent = state.playing ? 'Pause' : (state.atEnd ? 'Rejouer' : 'Démarrer');
    }

    // ── rendu DOM (adapté pour lire un pas de trace) ─────────────────────────

    generateArray() {
        return Array.from({ length: this.ARRAY_SIZE }, () => Math.floor(Math.random() * 99) + 1);
    }

    setPhase(text, type) {
        const el = document.getElementById('phase-indicator');
        if (!el) return;
        el.innerHTML = text ? '<span class="phase-' + type + '">' + this.escapeHtml(text) + '</span>' : '';
    }

    setStatus(text) {
        const el = document.getElementById('status-message');
        if (el) el.textContent = text || '';
    }

    renderTree(tree) {
        const container = document.getElementById('tree-container');
        if (!container) return;
        container.innerHTML = '';

        tree.forEach((level, depth) => {
            if (depth > 0) {
                const arrow = document.createElement('div');
                arrow.className = 'tree-arrow ' + (level.direction === 'up' ? 'up' : 'down');
                container.appendChild(arrow);
            }
            const row = document.createElement('div');
            row.className = 'tree-row';

            const label = document.createElement('div');
            label.className = 'tree-row-label';
            if (depth === 0) label.textContent = 'Initial';
            else if (level.direction === 'up') label.textContent = 'Fusion';
            else label.textContent = 'Div. ' + depth;
            row.appendChild(label);

            (level.subs || []).forEach((sub) => {
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
            container.appendChild(row);
        });
    }

    renderLinearArray(linear) {
        const container = document.getElementById('merge-array-view');
        if (!container) return;
        container.innerHTML = '';

        const values = (linear && linear.values) || this.linearArray;
        const state = (linear && linear.state) || {};
        const linRange = linear && linear.range;
        const preview = linear && linear.preview;

        values.forEach((value, index) => {
            const cell = document.createElement('div');
            cell.className = 'merge-array-cell';
            let displayValue = value;
            if (preview && index >= preview.start && index <= preview.end) {
                const off = index - preview.start;
                if (off < preview.values.length) {
                    displayValue = preview.values[off];
                    cell.classList.add('preview-placed');
                } else {
                    cell.classList.add('preview-pending');
                }
            }
            cell.textContent = displayValue;

            if (state[index]) cell.classList.add(state[index]);
            if (linRange && index >= linRange.start && index <= linRange.end) {
                if (linRange.phase === 'split') cell.classList.add('range-split');
                if (linRange.phase === 'merge') cell.classList.add('range-merge');
            }

            const idx = document.createElement('span');
            idx.className = 'merge-array-index';
            idx.textContent = index;
            cell.appendChild(idx);
            container.appendChild(cell);
        });
    }

    getSortedRunsHost() {
        const simulationRoot = document.getElementById('simulation-fragment');
        if (simulationRoot) {
            const scoped = simulationRoot.querySelector('#merge-sorted-runs');
            if (scoped) return scoped;
        }
        const all = Array.from(document.querySelectorAll('#merge-sorted-runs'));
        if (!all.length) return null;
        return all.find((el) => el.offsetParent !== null) || all[0];
    }

    renderSortedRuns(runs) {
        const host = this.getSortedRunsHost();
        if (!host) return;
        host.innerHTML = '';

        if (!runs.length) {
            const empty = document.createElement('div');
            empty.className = 'sorted-run-empty';
            empty.textContent = 'Aucun sous-tableau trie pour le moment.';
            host.appendChild(empty);
            return;
        }
        runs.forEach((run) => {
            const item = document.createElement('div');
            item.className = 'sorted-run-item';
            const range = document.createElement('span');
            range.className = 'sorted-run-range';
            range.textContent = run.start + '..' + run.end;
            const vals = document.createElement('span');
            vals.className = 'sorted-run-values';
            vals.textContent = '[' + run.values.join(', ') + ']';
            item.appendChild(range);
            item.appendChild(vals);
            host.appendChild(item);
        });
    }

    updateMergeStats(step) {
        const stats = step ? step.stats : {};
        const v = (step && step.view) || {};
        this.updateInfo('merge-stat-splits', String(stats.splits || 0));
        this.updateInfo('merge-stat-merges', String(stats.merges || 0));
        this.updateInfo('merge-stat-comparisons', String(stats.comparisons || 0));

        const rangeEl = document.getElementById('merge-current-range');
        if (rangeEl) {
            const r = v.linear && v.linear.range;
            rangeEl.textContent = r ? (r.start + '..' + r.end + ' (' + r.phase + ')') : '--';
        }
    }

    render() {
        this.renderLinearArray({ values: this.linearArray, state: {}, range: null, preview: null });
    }

    reset() {
        this.originalNumbers = this.generateArray();
        this.linearArray = [...this.originalNumbers];
        this.invalidateTrace();
        this.clearHighlight();
        this.setPhase('', '');

        if (this.player) {
            this.player.reset();
        } else {
            this.renderTree([{ direction: 'down', subs: [{ values: this.originalNumbers.slice(), highlight: null, elementStates: {}, isSorted: false }] }]);
            this.renderLinearArray({ values: this.linearArray, state: {}, range: null, preview: null });
            this.renderSortedRuns([]);
            this.setStatus('Cliquez sur Démarrer pour lancer le tri fusion.');
            this.updateInfo('merge-stat-splits', '0');
            this.updateInfo('merge-stat-merges', '0');
            this.updateInfo('merge-stat-comparisons', '0');
            this.updateInfo('merge-current-range', '--');
        }
    }
}

if (typeof window !== 'undefined') {
    window.MergeSortVisualizer = MergeSortVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// MergeSortWidget — adaptateur SLIDE. Consomme buildMergeSortTrace (top-down),
// rend uniquement les champs cœur (barres + bandes gauche/droite/fusionné) :
// le DOM .msw-* reste identique, seule la SÉQUENCE d'états change (top-down).
// ─────────────────────────────────────────────────────────────────────────────
class MergeSortWidget {
    static mount(container, config = {}) {
        const w = new MergeSortWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = [64, 34, 25, 12, 22, 11, 90, 48];
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).slice(0, 12) : defaultData;
        this.baseInterval = 520;
        this._trace = null;
        this.player = null;
    }

    _stepDelayMs(step) {
        const base = this.baseInterval;
        switch (step && step.delay) {
            case 'quick': return Math.round(base * 0.32);
            case 'half': return Math.round(base * 0.55);
            default: return base;
        }
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

        if (typeof TracePlayer === 'undefined') {
            this.root.querySelector('.msw-action').textContent = 'Lecture indisponible (TracePlayer absent).';
            return;
        }

        this.player = new TracePlayer({
            getSteps: () => {
                if (!this._trace) {
                    this._trace = (typeof OEITrace !== 'undefined')
                        ? OEITrace.buildMergeSortTrace([...this.originalData], { variant: 'top-down' }) : [];
                }
                return this._trace;
            },
            render: (step, ctx) => this._renderStep(step, ctx),
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

    _renderStep(step, ctx) {
        const zone = this.root.querySelector('.msw-bars-zone');
        if (!zone || !step) return;
        const arr = (step.view && step.view.linear && step.view.linear.values) || step.array;
        const bands = (step.view && step.view.bands) || { left: [], right: [], merged: [] };
        const left = new Set(bands.left || []);
        const right = new Set(bands.right || []);
        const merged = new Set(bands.merged || []);
        const max = Math.max(...arr, 1);

        zone.innerHTML = '';
        arr.forEach((v, idx) => {
            const bar = document.createElement('div');
            bar.className = 'msw-bar';
            if (merged.has(idx)) bar.classList.add('merged');
            else if (left.has(idx)) bar.classList.add('left');
            else if (right.has(idx)) bar.classList.add('right');
            const px = Math.max(6, Math.round((v / max) * 100));
            bar.innerHTML = `<span class="msw-val">${v}</span><div class="msw-bar-inner" style="height:${px}px"></div>`;
            zone.appendChild(bar);
        });

        const act = this.root.querySelector('.msw-action');
        if (act) act.textContent = step.caption;
        const info = this.root.querySelector('.msw-step-info');
        if (info) info.textContent = `${(ctx ? ctx.cursor : step.i) + 1}/${ctx ? ctx.total : this._trace.length}`;
    }

    _bindControls() {
        this.root.querySelector('.msw-btn-play')?.addEventListener('click', () => this.player.toggle());
        this.root.querySelector('.msw-btn-step')?.addEventListener('click', () => this.player.stepForward());
        this.root.querySelector('.msw-btn-reset')?.addEventListener('click', () => this.player.reset());
    }

    _syncButtons(state) {
        const btn = this.root.querySelector('.msw-btn-play');
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
    window.MergeSortWidget = MergeSortWidget;
}
