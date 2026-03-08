/**
 * CountingRadixVisualizer - Visualisation du tri par comptage et radix sort
 */
class CountingRadixVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);

        this.mode = 'counting';
        this.inputArray = [4, 2, 7, 1, 3, 5, 0, 6];
        this.running = false;
        this.stepCount = 0;

        this.countArr = [];
        this.outputArr = [];
        this.cPhase = 'idle';
        this.cIdx = 0;
        this.cMax = 0;

        this.radixArr = [];
        this.radixTaggedArr = [];
        this.radixBuckets = [];
        this.rPass = 0;
        this.rMaxDigits = 0;
        this.rIdx = 0;
        this.rPhase = 'idle';

        this.stabilityLogs = [];
    }

    getInspectorContainerIds() {
        return ['pseudo-counting', 'pseudo-radix'];
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        const defaults = this.data?.visualization?.config?.defaultData;
        if (Array.isArray(defaults) && defaults.length >= 2) {
            this.inputArray = defaults.filter(v => Number.isInteger(v) && v >= 0);
        }

        const inputEl = document.getElementById('input-data');
        if (inputEl) inputEl.value = this.inputArray.join(', ');
        this.resetAll();
    }

    renderPseudocodeFromData() {
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks)) return;

        const idPrefix = {
            counting: 'cline',
            radix: 'rline'
        };

        blocks.forEach((block) => {
            const host = document.getElementById('pseudo-' + block.name);
            if (!host) return;
            const prefix = idPrefix[block.name] || (block.name + '-line');
            const lines = (block.lines || []).map((line, idx) => {
                const id = prefix.endsWith('-line') ? (prefix + idx) : (prefix + (idx + 1));
                const content = (typeof PseudocodeSupport !== 'undefined')
                    ? PseudocodeSupport.renderLineContent(line, {
                        autoKeywordHighlight: true,
                        domain: this.data?.metadata?.category
                    })
                    : this.escapeHtml(line);
                return '<span class="line" id="' + id + '">' + content + '</span>';
            });
            host.innerHTML = lines.join('');
        });
    }

    render() {
        // no-op, rendering is handled by granular methods
    }

    pushStabilityLog(message) {
        this.stabilityLogs.push(message);
        if (this.stabilityLogs.length > 30) this.stabilityLogs.shift();
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

        panel.innerHTML =
            '<div class="stability-intro">' + intro + '</div>' +
            '<ul class="stability-log">' + logs + '</ul>';
    }

    switchMode(mode) {
        this.mode = mode;

        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        const countingView = document.getElementById('counting-view');
        const radixView = document.getElementById('radix-view');
        const pseudoCounting = document.getElementById('pseudo-counting');
        const pseudoRadix = document.getElementById('pseudo-radix');
        const statMode = document.getElementById('stat-mode');

        if (countingView) countingView.style.display = mode === 'counting' ? '' : 'none';
        if (radixView) radixView.style.display = mode === 'radix' ? '' : 'none';
        if (pseudoCounting) pseudoCounting.style.display = mode === 'counting' ? '' : 'none';
        if (pseudoRadix) pseudoRadix.style.display = mode === 'radix' ? '' : 'none';
        if (statMode) statMode.textContent = mode === 'counting' ? 'Comptage' : 'Radix';

        this.resetAll();
    }

    async loadData() {
        return super.loadData();
    }

    loadInputData() {
        const raw = document.getElementById('input-data')?.value || '';
        const parsed = raw
            .split(/[\s,]+/)
            .map(Number)
            .filter(v => !Number.isNaN(v) && v >= 0);

        if (parsed.length < 2) {
            this.setFeedback('Entrez au moins 2 nombres positifs.', 'error');
            return;
        }

        this.inputArray = parsed;
        this.resetAll();
    }

    randomData() {
        if (this.mode === 'counting') {
            this.inputArray = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10));
        } else {
            this.inputArray = Array.from({ length: 8 }, () => Math.floor(Math.random() * 1000));
        }

        const inputEl = document.getElementById('input-data');
        if (inputEl) inputEl.value = this.inputArray.join(', ');
        this.resetAll();
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
            else if (cumulated && this.cPhase !== 'counting') cls += ' cumul';
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + v + '</div>';
        }).join('');
    }

    renderOutputArr(placedIdx) {
        const div = document.getElementById('output-arr');
        if (!div) return;

        div.innerHTML = this.outputArr.map((v, i) => {
            let cls = 'arr-cell';
            if (v !== null) cls += ' placed';
            if (i === placedIdx) cls += ' active';
            return '<div class="' + cls + '"><span class="index-label">' + i + '</span>' + (v !== null ? v : '') + '</div>';
        }).join('');
    }

    renderRadixArr(activeIdx, pass) {
        const div = document.getElementById('radix-arr');
        if (!div) return;

        div.innerHTML = this.radixTaggedArr.map((entry, i) => {
            const v = entry.value;
            let cls = 'arr-cell';
            if (i === activeIdx) cls += ' active';
            const str = String(v);
            let html = '';
            if (pass !== undefined && pass >= 0 && pass < str.length) {
                const digitPos = str.length - 1 - pass;
                for (let c = 0; c < str.length; c++) {
                    if (c === digitPos) html += '<span style="color:var(--danger);font-weight:800;text-decoration:underline;">' + str[c] + '</span>';
                    else html += str[c];
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

        div.innerHTML = '';
        for (let b = 0; b < 10; b++) {
            let bucket = '<div class="bucket"><div class="bucket-label">' + b + '</div><div class="bucket-items">';
            if (this.radixBuckets[b]) {
                this.radixBuckets[b].forEach((entry) => {
                    const v = entry.value;
                    const str = String(v);
                    const digitPos = str.length - 1 - this.rPass;
                    let html = '';
                    for (let c = 0; c < str.length; c++) {
                        if (c === digitPos) html += '<span class="digit-hl">' + str[c] + '</span>';
                        else html += str[c];
                    }
                    bucket += '<div class="bucket-item">' + html + '<span class="origin-label">#' + entry.origin + '</span></div>';
                });
            }
            bucket += '</div></div>';
            div.innerHTML += bucket;
        }
    }

    getDigit(num, pos) {
        return Math.floor(num / Math.pow(10, pos)) % 10;
    }

    getMaxDigits(arr) {
        const mx = Math.max(...arr);
        return mx === 0 ? 1 : Math.floor(Math.log10(mx)) + 1;
    }

    initCounting() {
        this.cMax = Math.max(...this.inputArray);
        this.countArr = new Array(this.cMax + 1).fill(0);
        this.outputArr = new Array(this.inputArray.length).fill(null);
        this.cIdx = 0;
        this.cPhase = 'counting';
        this.stepCount = 0;
        this.stabilityLogs = [];
        this.pushStabilityLog('Initialisation du tri par comptage sur ' + this.inputArray.length + ' elements.');
    }

    countingStep() {
        if (this.cPhase === 'idle') {
            this.initCounting();
            this.highlightLine('cline2');
            this.setFeedback('Initialisation du tableau de comptage (taille ' + (this.cMax + 1) + ').', 'info');
            this.renderInputArr(-1);
            this.renderCountArr(-1, false);
            this.renderOutputArr(-1);
            this.renderStabilityPanel();
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.cPhase === 'counting') {
            if (this.cIdx >= this.inputArray.length) {
                this.cPhase = 'cumulating';
                this.cIdx = 1;
                this.highlightLine('cline5');
                const countTitle = document.getElementById('count-title');
                if (countTitle) countTitle.textContent = 'Tableau de comptage (somme cumulee)';
                this.setFeedback('Phase de comptage terminee. Passage a la somme cumulee.', 'info');
                this.renderInputArr(-1);
                this.renderCountArr(-1, false);
                this.renderStabilityPanel();
                this.stepCount++;
                this.updateStats();
                return true;
            }

            const val = this.inputArray[this.cIdx];
            this.countArr[val]++;
            this.highlightLine('cline4');
            this.setFeedback('Comptage : A[' + this.cIdx + '] = ' + val + ' => C[' + val + '] = ' + this.countArr[val], 'info');
            this.renderInputArr(this.cIdx);
            this.renderCountArr(val, false);
            this.renderStabilityPanel();
            this.cIdx++;
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.cPhase === 'cumulating') {
            if (this.cIdx > this.cMax) {
                this.cPhase = 'placing';
                this.cIdx = this.inputArray.length - 1;
                this.highlightLine('cline8');
                this.setFeedback('Somme cumulee terminee. Placement des elements.', 'info');
                this.renderCountArr(-1, true);
                this.pushStabilityLog('Placement de droite a gauche active pour garantir la stabilite.');
                this.renderStabilityPanel();
                this.stepCount++;
                this.updateStats();
                return true;
            }

            this.countArr[this.cIdx] += this.countArr[this.cIdx - 1];
            this.highlightLine('cline6');
            this.setFeedback('Cumul : C[' + this.cIdx + '] = ' + this.countArr[this.cIdx], 'info');
            this.renderCountArr(this.cIdx, true);
            this.renderStabilityPanel();
            this.cIdx++;
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.cPhase === 'placing') {
            if (this.cIdx < 0) {
                this.cPhase = 'done';
                this.highlightLine('cline12');
                this.setFeedback('Tri termine !', 'success');
                this.renderInputArr(-1);
                this.renderCountArr(-1, true);
                this.renderOutputArr(-1);
                document.querySelectorAll('#output-arr .arr-cell').forEach(c => {
                    c.classList.remove('placed');
                    c.classList.add('sorted');
                });
                this.pushStabilityLog('Fin comptage: ordre relatif des doublons preserve.');
                this.renderStabilityPanel();
                this.stepCount++;
                this.updateStats();
                return false;
            }

            const val = this.inputArray[this.cIdx];
            this.countArr[val]--;
            const pos = this.countArr[val];
            this.outputArr[pos] = val;
            this.pushStabilityLog('v=' + val + ' : i' + this.cIdx + ' -> B[' + pos + ']');
            this.highlightLine('cline10');
            this.setFeedback('Placement : A[' + this.cIdx + '] = ' + val + ' => B[' + pos + ']', 'info');
            this.renderInputArr(this.cIdx);
            this.renderCountArr(val, true);
            this.renderOutputArr(pos);
            this.renderStabilityPanel();
            this.cIdx--;
            this.stepCount++;
            this.updateStats();
            return true;
        }

        return false;
    }

    initRadix() {
        this.radixTaggedArr = this.inputArray.map((value, origin) => ({ value, origin }));
        this.radixArr = this.radixTaggedArr.map((entry) => entry.value);
        this.rMaxDigits = this.getMaxDigits(this.radixArr);
        this.rPass = 0;
        this.rIdx = 0;
        this.radixBuckets = Array.from({ length: 10 }, () => []);
        this.rPhase = 'distributing';
        this.stepCount = 0;
        this.stabilityLogs = [];
        this.pushStabilityLog('Initialisation radix: ' + this.rMaxDigits + ' passes prevues.');
    }

    radixStep() {
        if (this.rPhase === 'idle') {
            this.initRadix();
            const passNames = ['unites', 'dizaines', 'centaines', 'milliers'];
            const passInfo = document.getElementById('radix-pass-info');
            if (passInfo) passInfo.textContent = 'Passe ' + (this.rPass + 1) + ' : chiffre des ' + (passNames[this.rPass] || ('position ' + this.rPass));
            this.highlightLine('rline2');
            this.setFeedback('Initialisation du tri radix (' + this.rMaxDigits + ' passes).', 'info');
            this.renderRadixArr(-1, this.rPass);
            this.renderRadixBuckets();
            this.renderStabilityPanel();
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.rPhase === 'distributing') {
            if (this.rIdx >= this.radixArr.length) {
                this.rPhase = 'collecting';
                this.highlightLine('rline7');
                this.setFeedback('Distribution terminee. Concatenation des seaux.', 'info');
                for (let b = 0; b < 10; b++) {
                    if (!this.radixBuckets[b].length) continue;
                    const order = this.radixBuckets[b].map((entry) => '#' + entry.origin).join(', ');
                    this.pushStabilityLog('Passe ' + (this.rPass + 1) + ', seau ' + b + ' : ordre ' + order);
                }
                this.renderStabilityPanel();
                this.stepCount++;
                this.updateStats();
                return true;
            }

            const entry = this.radixTaggedArr[this.rIdx];
            const digit = this.getDigit(entry.value, this.rPass);
            this.radixBuckets[digit].push(entry);
            this.highlightLine('rline6');
            this.setFeedback('Distribution : ' + entry.value + ' (origine #' + entry.origin + ') => seau ' + digit, 'info');
            this.renderRadixArr(this.rIdx, this.rPass);
            this.renderRadixBuckets();
            this.renderStabilityPanel();
            this.rIdx++;
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.rPhase === 'collecting') {
            this.radixTaggedArr = [];
            for (let b = 0; b < 10; b++) this.radixTaggedArr.push(...this.radixBuckets[b]);
            this.radixArr = this.radixTaggedArr.map((entry) => entry.value);
            this.rPass++;

            if (this.rPass >= this.rMaxDigits) {
                this.rPhase = 'done';
                this.highlightLine('rline8');
                this.setFeedback('Tri radix termine !', 'success');
                this.renderRadixArr(-1, -1);
                document.querySelectorAll('#radix-arr .arr-cell').forEach(c => c.classList.add('sorted'));
                this.renderRadixBuckets();
                this.pushStabilityLog('Fin radix: stabilite preservee a chaque passe.');
                this.renderStabilityPanel();
                this.stepCount++;
                this.updateStats();
                return false;
            }

            this.radixBuckets = Array.from({ length: 10 }, () => []);
            this.rIdx = 0;
            this.rPhase = 'distributing';
            const passNames = ['unites', 'dizaines', 'centaines', 'milliers'];
            const passInfo = document.getElementById('radix-pass-info');
            if (passInfo) passInfo.textContent = 'Passe ' + (this.rPass + 1) + ' : chiffre des ' + (passNames[this.rPass] || ('position ' + this.rPass));
            this.highlightLine('rline3');
            this.setFeedback('Passe ' + (this.rPass + 1) + ' : reinitialisation des seaux.', 'info');
            this.renderRadixArr(-1, this.rPass);
            this.renderRadixBuckets();
            this.renderStabilityPanel();
            this.stepCount++;
            this.updateStats();
            return true;
        }

        return false;
    }

    stepOnce() {
        if (this.running) return;
        if (this.mode === 'counting') this.countingStep();
        else this.radixStep();
    }

    async runAuto() {
        if (this.running) return;
        this.running = true;
        const btnRun = document.getElementById('btn-run');
        if (btnRun) btnRun.disabled = true;

        let cont = true;
        while (this.running && cont) {
            if (this.mode === 'counting') cont = this.countingStep();
            else cont = this.radixStep();
            await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
        }

        this.running = false;
        if (btnRun) btnRun.disabled = false;
    }

    resetAll() {
        this.running = false;
        this.cPhase = 'idle';
        this.rPhase = 'idle';
        this.stepCount = 0;
        this.stabilityLogs = [];
        this.clearHighlight();
        this.setFeedback('Chargez des donnees et lancez le tri.', 'info');

        const btnRun = document.getElementById('btn-run');
        if (btnRun) btnRun.disabled = false;

        if (this.mode === 'counting') {
            this.cMax = Math.max(...this.inputArray);
            this.countArr = new Array(this.cMax + 1).fill(0);
            this.outputArr = new Array(this.inputArray.length).fill(null);
            const countTitle = document.getElementById('count-title');
            if (countTitle) countTitle.textContent = 'Tableau de comptage (histogramme)';
            this.renderInputArr(-1);
            this.renderCountArr(-1, false);
            this.renderOutputArr(-1);
        } else {
            this.radixTaggedArr = this.inputArray.map((value, origin) => ({ value, origin }));
            this.radixArr = this.radixTaggedArr.map((entry) => entry.value);
            this.radixBuckets = Array.from({ length: 10 }, () => []);
            this.rPass = 0;
            this.rIdx = 0;
            const passInfo = document.getElementById('radix-pass-info');
            if (passInfo) passInfo.textContent = 'Passe 1 : chiffre des unites';
            this.renderRadixArr(-1, 0);
            this.renderRadixBuckets();
        }

        this.renderStabilityPanel();
        this.updateStats();
    }

    highlightLine(id) {
        super.highlightLine(id);
    }

    clearHighlight() {
        super.clearHighlight();
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
            if (this.mode === 'radix') {
                extraEl.innerHTML = 'Passe <span>' + (this.rPass + 1) + ' / ' + (this.rMaxDigits || '?') + '</span>';
            } else {
                extraEl.innerHTML = 'Max valeur <span>' + (this.cMax || '?') + '</span>';
            }
        }
    }

    reset() {
        this.resetAll();
    }
}

if (typeof window !== 'undefined') {
    window.CountingRadixVisualizer = CountingRadixVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// CountingRadixWidget — Widget autonome : tri par comptage (counting sort)
// Usage : CountingRadixWidget.mount(container, { data: [4, 2, 7, 1, 3] })
// ─────────────────────────────────────────────────────────────────────────────
class CountingRadixWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (CountingRadixWidget._stylesInjected) return;
        CountingRadixWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.crw-container{display:flex;flex-direction:column;gap:8px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.crw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.crw-section{display:flex;flex-direction:column;gap:3px;}
.crw-label{font-size:.66rem;color:var(--sl-muted,#94a3b8);font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.crw-cells{display:flex;gap:4px;flex-wrap:wrap;}
.crw-cell{display:flex;flex-direction:column;align-items:center;gap:2px;}
.crw-cell-val{min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:4px;font-size:.74rem;font-weight:600;background:var(--sl-primary,#6366f1);color:#fff;transition:background .2s;border:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.crw-cell-val.active{background:var(--sl-accent,#f97316);}
.crw-cell-val.output{background:#22c55e;}
.crw-cell-val.empty{background:var(--surface,rgba(0,0,0,.12));color:var(--sl-muted,#94a3b8);border-color:var(--border,var(--sl-border,rgba(255,255,255,.12)));box-shadow:none;}
.crw-cell-idx{font-size:9px;color:var(--sl-muted,#94a3b8);}
.crw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;}
.crw-controls{display:flex;gap:8px;flex-wrap:wrap;}
.crw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.crw-btn:hover:not(:disabled){opacity:.8;}
.crw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        CountingRadixWidget.ensureStyles();
        const w = new CountingRadixWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const defaultData = [4, 2, 7, 1, 3, 5, 0, 6];
        this.originalData = Array.isArray(config.data) && config.data.length > 0
            ? config.data.map(Number).filter(v => v >= 0).slice(0, 12) : defaultData;
        this._timer = null;
        this.isRunning = false;
        this._resetState();
    }

    _resetState() {
        this._steps = this._buildSteps([...this.originalData]);
        this._stepIdx = 0;
        this.done = false;
    }

    _buildSteps(arr) {
        const steps = [];
        const max = Math.max(...arr);
        const count = new Array(max + 1).fill(0);
        const output = new Array(arr.length).fill(null);

        steps.push({ phase: 'input', arr: [...arr], count: [...count], output: [...output],
            active: -1, action: 'Tableau initial — h(k) = valeur directe (valeurs 0..' + max + ')' });

        for (let i = 0; i < arr.length; i++) {
            count[arr[i]]++;
            steps.push({ phase: 'count', arr: [...arr], count: [...count], output: [...output],
                active: arr[i], action: `Comptage : count[${arr[i]}] = ${count[arr[i]]}` });
        }

        const preAcc = [...count];
        for (let i = 1; i <= max; i++) {
            count[i] += count[i - 1];
            steps.push({ phase: 'accum', arr: [...arr], count: [...count], output: [...output],
                active: i, action: `Cumul : count[${i}] = ${preAcc[i]} + count[${i-1}] = ${count[i]}` });
        }

        for (let i = arr.length - 1; i >= 0; i--) {
            const val = arr[i];
            count[val]--;
            output[count[val]] = val;
            steps.push({ phase: 'output', arr: [...arr], count: [...count], output: [...output],
                active: count[val], action: `Placement : ${val} -> sortie[${count[val]}]` });
        }

        steps.push({ phase: 'done', arr: [...output], count: [...count], output: [...output],
            active: -1, action: 'Tri par comptage termine !' });
        return steps;
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
        this._render();
        this._bindControls();
    }

    _cell(v, i, cls) {
        return `<div class="crw-cell"><div class="crw-cell-val ${cls}">${v ?? ''}</div><div class="crw-cell-idx">${i}</div></div>`;
    }

    _render() {
        const step = this._steps[this._stepIdx] || this._steps[this._steps.length - 1];

        const inputEl = this.root.querySelector('.crw-input-cells');
        if (inputEl) {
            inputEl.innerHTML = step.arr.map((v, i) => {
                const cls = step.phase === 'done' ? 'output'
                    : (step.phase === 'count' && v === step.active && i === step.arr.lastIndexOf(v, i) ? 'active' : '');
                return this._cell(v, i, cls);
            }).join('');
        }

        const countEl = this.root.querySelector('.crw-count-cells');
        if (countEl) {
            countEl.innerHTML = step.count.map((v, i) => {
                const cls = (step.phase === 'count' || step.phase === 'accum') && i === step.active ? 'active' : '';
                return this._cell(v, i, cls);
            }).join('');
        }

        const outputEl = this.root.querySelector('.crw-output-cells');
        if (outputEl) {
            outputEl.innerHTML = step.output.map((v, i) => {
                const cls = v !== null
                    ? (step.phase === 'output' && i === step.active ? 'active' : 'output')
                    : 'empty';
                return this._cell(v !== null ? v : '', i, cls);
            }).join('');
        }

        const act = this.root.querySelector('.crw-action');
        if (act) act.textContent = step.action;
        const info = this.root.querySelector('.crw-step-info');
        if (info) info.textContent = `${this._stepIdx + 1}/${this._steps.length}`;
    }

    _bindControls() {
        this.root.querySelector('.crw-btn-play')?.addEventListener('click', () => this._togglePlay());
        this.root.querySelector('.crw-btn-step')?.addEventListener('click', () => { this._stop(); this._step(); });
        this.root.querySelector('.crw-btn-reset')?.addEventListener('click', () => { this._stop(); this._reset(); });
    }

    _togglePlay() {
        if (this.isRunning) { this._stop(); return; }
        if (this.done) { this._reset(); }
        this.isRunning = true;
        const btn = this.root.querySelector('.crw-btn-play');
        if (btn) btn.textContent = '\u23F8 Pause';
        this._run();
    }

    _stop() {
        this.isRunning = false;
        clearTimeout(this._timer);
        const btn = this.root.querySelector('.crw-btn-play');
        if (btn) btn.textContent = '\u25B6 Lancer';
    }

    _run() {
        if (!this.isRunning || this.done) { this._stop(); return; }
        this._step();
        if (!this.done) this._timer = setTimeout(() => this._run(), 550);
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
    window.CountingRadixWidget = CountingRadixWidget;
}
