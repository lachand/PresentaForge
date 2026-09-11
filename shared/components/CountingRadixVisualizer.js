/**
 * CountingRadixVisualizer — tri par comptage ET radix sort (LSD base 10).
 *
 * Les deux algorithmes vivent dans shared/components/algorithms/sort-traces.js
 * (buildCountingSortTrace / buildRadixSortTrace, purs). Cette classe est
 * l'ADAPTATEUR PAGE (2 modes, 2 blocs de pseudocode) ; CountingRadixWidget
 * l'ADAPTATEUR SLIDE (comptage uniquement, historiquement — inchangé).
 */
class CountingRadixVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.mode = 'counting';
        this.inputArray = [4, 2, 7, 1, 3, 5, 0, 6];
        this.stepCount = 0;
        this.cMax = 0;
        this.rPass = 0;
        this.rMaxDigits = 0;
        this.countArr = [];
        this.outputArr = [];
        this.radixTaggedArr = [];
        this.radixBuckets = [];
        this.stabilityLogs = [];
    }

    getInspectorContainerIds() {
        return ['pseudo-counting', 'pseudo-radix'];
    }

    async init() {
        await super.init();
        const defaults = this.data?.visualization?.config?.defaultData;
        if (Array.isArray(defaults) && defaults.length >= 2) {
            this.inputArray = defaults.filter((v) => Number.isInteger(v) && v >= 0);
        }
        const inputEl = document.getElementById('input-data');
        if (inputEl) inputEl.value = this.inputArray.join(', ');
        this.resetAll();
    }

    /** Rend les deux blocs de pseudocode dans leurs conteneurs respectifs. */
    setupPseudocode() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-counting', blockFilter: 'counting' });
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-radix', blockFilter: 'radix' });
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/sort-traces.js'];
    }

    buildTrace() {
        if (typeof OEITrace === 'undefined') return [];
        const src = this.inputArray.slice();
        return this.mode === 'radix'
            ? OEITrace.buildRadixSortTrace(src)
            : OEITrace.buildCountingSortTrace(src);
    }

    stepDelay(step) {
        return step && step.delay === 'quick' ? this.getCurrentDelay(0.4) : this.getCurrentDelay();
    }

    renderStep(step) {
        if (!step) return;
        const v = step.view || {};
        this.stepCount = v.stepCount || 0;
        this.stabilityLogs = v.stabilityLog || [];

        if (v.mode === 'radix') {
            this.mode = 'radix';
            this.rPass = v.pass || 0;
            this.rMaxDigits = v.maxDigits || 0;
            this.radixTaggedArr = v.tagged || [];
            this.radixBuckets = v.buckets || [];
            const passInfo = document.getElementById('radix-pass-info');
            if (passInfo) passInfo.textContent = `Passe ${(v.pass || 0) + 1} : chiffre des ${v.passName || ''}`;
            this.renderRadixArr(v.activeIndex, v.pass);
            this.renderRadixBuckets();
            if (v.rPhase === 'done') {
                document.querySelectorAll('#radix-arr .arr-cell').forEach((c) => c.classList.add('sorted'));
            }
        } else {
            this.mode = 'counting';
            this.cMax = v.cMax || 0;
            this.countArr = v.count || [];
            this.outputArr = v.output || [];
            const countTitle = document.getElementById('count-title');
            if (countTitle) {
                countTitle.textContent = v.cumulated
                    ? 'Tableau de comptage (somme cumulee)'
                    : 'Tableau de comptage (histogramme)';
            }
            this.renderInputArr(v.activeInput);
            this.renderCountArr(v.activeCount, v.cumulated);
            this.renderOutputArr(v.activeOutput, v.cPhase === 'done');
        }

        this.renderStabilityPanel();
        this.setFeedback(step.caption || '', step.phase === 'done' ? 'success' : 'info');
        this.updateStats();
    }

    onPlayerState(state) {
        const btn = document.getElementById('btn-run');
        if (btn) btn.textContent = state.playing ? 'Pause' : (state.atEnd ? 'Rejouer' : 'Lancer');
    }

    // ── contrôles bespoke (2 modes, chargement de données) ───────────────────

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.mode-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        const cv = document.getElementById('counting-view');
        const rv = document.getElementById('radix-view');
        const pc = document.getElementById('pseudo-counting');
        const pr = document.getElementById('pseudo-radix');
        const sm = document.getElementById('stat-mode');
        if (cv) cv.style.display = mode === 'counting' ? '' : 'none';
        if (pc) pc.style.display = mode === 'counting' ? '' : 'none';
        // #radix-view / #pseudo-radix portent la classe utilitaire u-inline-007
        // (display:none, appliquée par défaut car le mode initial est "counting").
        // Vider le style inline ne suffit pas à les révéler : la règle de classe,
        // elle, reste active. On bascule donc la classe elle-même (bug pré-3G).
        if (rv) {
            rv.classList.toggle('u-inline-007', mode !== 'radix');
            rv.style.display = mode === 'radix' ? '' : 'none';
        }
        if (pr) {
            pr.classList.toggle('u-inline-007', mode !== 'radix');
            pr.style.display = mode === 'radix' ? '' : 'none';
        }
        if (sm) sm.textContent = mode === 'counting' ? 'Comptage' : 'Radix';
        this.resetAll();
    }

    loadInputData() {
        const raw = document.getElementById('input-data')?.value || '';
        const parsed = raw.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n) && n >= 0);
        if (parsed.length < 2) {
            this.setFeedback('Entrez au moins 2 nombres positifs.', 'error');
            return;
        }
        this.inputArray = parsed.map((n) => Math.floor(n));
        this.resetAll();
    }

    randomData() {
        this.inputArray = this.mode === 'counting'
            ? Array.from({ length: 10 }, () => Math.floor(Math.random() * 10))
            : Array.from({ length: 8 }, () => Math.floor(Math.random() * 1000));
        const inputEl = document.getElementById('input-data');
        if (inputEl) inputEl.value = this.inputArray.join(', ');
        this.resetAll();
    }

    resetAll() {
        this.invalidateTrace();
        this.clearHighlight();
        if (this.player) {
            this.player.reset();
        } else {
            this.setFeedback('Chargez des donnees et lancez le tri.', 'info');
            this.updateStats();
        }
    }

    reset() {
        this.resetAll();
    }

    render() { /* rendu piloté par renderStep */ }

    // ── helpers DOM conservés ────────────────────────────────────────────────

    getDigit(num, pos) {
        return Math.floor(num / Math.pow(10, pos)) % 10;
    }

    getMaxDigits(arr) {
        const mx = Math.max(...arr);
        return mx === 0 ? 1 : Math.floor(Math.log10(mx)) + 1;
    }

    renderInputArr(activeIdx) {
        const div = document.getElementById('input-arr');
        if (!div) return;
        div.innerHTML = this.inputArray.map((v, i) => {
            let cls = 'arr-cell';
            if (i === activeIdx) cls += ' active';
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + v + '</div>';
        }).join('');
    }

    renderCountArr(activeIdx, cumulated) {
        const div = document.getElementById('count-arr');
        if (!div) return;
        div.innerHTML = this.countArr.map((v, i) => {
            let cls = 'count-cell';
            if (i === activeIdx) cls += ' active';
            else if (cumulated) cls += ' cumul';
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + v + '</div>';
        }).join('');
    }

    renderOutputArr(placedIdx, done) {
        const div = document.getElementById('output-arr');
        if (!div) return;
        div.innerHTML = this.outputArr.map((v, i) => {
            let cls = 'arr-cell';
            if (v !== null && v !== undefined) cls += done ? ' sorted' : ' placed';
            if (i === placedIdx && !done) cls += ' active';
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + (v !== null && v !== undefined ? v : '') + '</div>';
        }).join('');
    }

    renderRadixArr(activeIdx, pass) {
        const div = document.getElementById('radix-arr');
        if (!div) return;
        div.innerHTML = this.radixTaggedArr.map((entry, i) => {
            const str = String(entry.value);
            let cls = 'arr-cell';
            if (i === activeIdx) cls += ' active';
            let html = '';
            if (pass !== undefined && pass >= 0 && pass < str.length) {
                const digitPos = str.length - 1 - pass;
                for (let c = 0; c < str.length; c += 1) {
                    html += c === digitPos
                        ? '<span style="color:var(--danger);font-weight:800;text-decoration:underline;">' + str[c] + '</span>'
                        : str[c];
                }
            } else {
                html = str;
            }
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + html + '<span class="origin-label">#' + entry.origin + '</span></div>';
        }).join('');
    }

    renderRadixBuckets() {
        const div = document.getElementById('radix-buckets');
        if (!div) return;
        let html = '';
        for (let b = 0; b < 10; b += 1) {
            html += '<div class="bucket"><div class="bucket-label">' + b + '</div><div class="bucket-items">';
            (this.radixBuckets[b] || []).forEach((entry) => {
                const str = String(entry.value);
                const digitPos = str.length - 1 - this.rPass;
                let inner = '';
                for (let c = 0; c < str.length; c += 1) {
                    inner += c === digitPos ? '<span class="digit-hl">' + str[c] + '</span>' : str[c];
                }
                html += '<div class="bucket-item">' + inner + '<span class="origin-label">#' + entry.origin + '</span></div>';
            });
            html += '</div></div>';
        }
        div.innerHTML = html;
    }

    renderStabilityPanel() {
        const panel = document.getElementById('stability-panel');
        if (!panel) return;
        const intro = this.mode === 'counting'
            ? 'Comptage: le parcours de droite a gauche preserve l ordre des doublons.'
            : 'Radix: chaque passe distribue puis recolte les seaux sans inverser les doublons.';
        const logs = this.stabilityLogs.length
            ? this.stabilityLogs.slice(-8).reverse().map((line) => '<li>' + this.escapeHtml(line) + '</li>').join('')
            : '<li>Aucune etape enregistree.</li>';
        panel.innerHTML = '<div class="stability-intro">' + intro + '</div><ul class="stability-log">' + logs + '</ul>';
    }

    setFeedback(msg, type) {
        const el = document.getElementById('feedback');
        if (!el) return;
        el.textContent = msg;
        el.className = 'feedback ' + (type || '');
    }

    updateStats() {
        const stepEl = document.getElementById('stat-step');
        const extraEl = document.getElementById('stat-extra');
        if (stepEl) stepEl.textContent = this.stepCount;
        if (extraEl) {
            extraEl.innerHTML = this.mode === 'radix'
                ? 'Passe <span>' + (this.rPass + 1) + ' / ' + (this.rMaxDigits || '?') + '</span>'
                : 'Max valeur <span>' + (this.cMax || '?') + '</span>';
        }
    }
}

if (typeof window !== 'undefined') {
    window.CountingRadixVisualizer = CountingRadixVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// CountingRadixWidget — adaptateur SLIDE : tri par comptage (counting sort).
// Consomme buildCountingSortTrace via TracePlayer ; DOM .crw-* inchangé.
// ─────────────────────────────────────────────────────────────────────────────
class CountingRadixWidget {
    static mount(container, config = {}) {
        const w = new CountingRadixWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = [4, 2, 7, 1, 3, 5, 0, 6];
        const cleaned = Array.isArray(config.data)
            ? config.data.map(Number).filter((v) => Number.isFinite(v) && v >= 0).slice(0, 12)
            : [];
        this.originalData = cleaned.length > 0 ? cleaned : defaultData;
        this.baseInterval = 550;
        this._trace = null;
        this.player = null;
    }

    _stepDelayMs(step) {
        return step && step.delay === 'quick' ? Math.round(this.baseInterval * 0.4) : this.baseInterval;
    }

    init() {
        this.root.innerHTML = `<div class="crw-container">
            <div class="crw-header"><span>Tri par comptage (Counting Sort)</span><span class="crw-step-info"></span></div>
            <div class="crw-section"><div class="crw-label">Entree</div><div class="crw-cells crw-input-cells"></div></div>
            <div class="crw-section"><div class="crw-label">Comptage</div><div class="crw-cells crw-count-cells"></div></div>
            <div class="crw-section"><div class="crw-label">Sortie</div><div class="crw-cells crw-output-cells"></div></div>
            <div class="crw-info-bar crw-action"></div>
            <div class="crw-controls">
                <button class="crw-btn crw-btn-play">&#9654; Lancer</button>
                <button class="crw-btn crw-btn-step crw-btn-secondary">Etape</button>
                <button class="crw-btn crw-btn-reset crw-btn-secondary">&#8635; Reset</button>
            </div>
        </div>`;

        if (typeof TracePlayer === 'undefined') {
            this.root.querySelector('.crw-action').textContent = 'Lecture indisponible (TracePlayer absent).';
            return;
        }

        this.player = new TracePlayer({
            getSteps: () => {
                if (!this._trace) {
                    this._trace = (typeof OEITrace !== 'undefined')
                        ? OEITrace.buildCountingSortTrace([...this.originalData]) : [];
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

    _cell(v, i, cls) {
        return `<div class="crw-cell"><div class="crw-cell-val ${cls}">${v ?? ''}</div><div class="crw-cell-idx">${i}</div></div>`;
    }

    _renderStep(step, ctx) {
        if (!step) return;
        const v = step.view || {};
        const done = step.phase === 'done';
        const input = v.input || step.array;
        const count = v.count || [];
        const output = v.output || [];

        const inputEl = this.root.querySelector('.crw-input-cells');
        if (inputEl) {
            inputEl.innerHTML = input.map((val, i) => {
                const cls = done ? 'output' : (v.activeInput === i ? 'active' : '');
                return this._cell(val, i, cls);
            }).join('');
        }
        const countEl = this.root.querySelector('.crw-count-cells');
        if (countEl) {
            countEl.innerHTML = count.map((val, i) => this._cell(val, i, v.activeCount === i ? 'active' : '')).join('');
        }
        const outputEl = this.root.querySelector('.crw-output-cells');
        if (outputEl) {
            outputEl.innerHTML = output.map((val, i) => {
                const cls = val !== null && val !== undefined
                    ? (v.activeOutput === i && !done ? 'active' : 'output')
                    : 'empty';
                return this._cell(val !== null && val !== undefined ? val : '', i, cls);
            }).join('');
        }
        const act = this.root.querySelector('.crw-action');
        if (act) act.textContent = step.caption;
        const info = this.root.querySelector('.crw-step-info');
        if (info) info.textContent = `${(ctx ? ctx.cursor : step.i) + 1}/${ctx ? ctx.total : this._trace.length}`;
    }

    _bindControls() {
        this.root.querySelector('.crw-btn-play')?.addEventListener('click', () => this.player.toggle());
        this.root.querySelector('.crw-btn-step')?.addEventListener('click', () => this.player.stepForward());
        this.root.querySelector('.crw-btn-reset')?.addEventListener('click', () => this.player.reset());
    }

    _syncButtons(state) {
        const btn = this.root.querySelector('.crw-btn-play');
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
    window.CountingRadixWidget = CountingRadixWidget;
}
