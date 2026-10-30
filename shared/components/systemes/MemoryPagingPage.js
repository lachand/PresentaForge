/**
 * MemoryPagingPage / MemoryWidget : remplacement de pages (FIFO, LRU, Optimal, Clock), courbe des
 * défauts selon le nombre de cadres et traduction d'adresse. Tout le calcul est dans le moteur pur
 * `algorithms/paging-engine.js` (relecture 3b, B4, ME-I2) ; ici, seulement de l'affichage.
 */
class MemoryPagingPage extends ConceptPage {
    static LABELS = { fifo: 'FIFO', lru: 'LRU', optimal: 'Optimal', clock: 'Clock' };
    static REASONS = {
        fifo: 'c\'est la page chargée depuis le plus longtemps',
        lru: 'c\'est la page utilisée le moins récemment',
        optimal: 'c\'est la page réutilisée le plus tard',
        clock: 'l\'aiguille a trouvé son bit de référence à 0'
    };
    static DEFAULT_PAGE_TABLE = '0x403 -> 0x1F\n0x404 -> 0x2A';
    static DEFAULT_ADDRESSES = '0x00403A7C\n0x00403A80\n0x00404010\n0x00405000';

    /** Phrase décrivant un pas de la simulation. */
    static describeStep(step, algo) {
        if (step.type === 'hit') return 'Hit : la page ' + step.page + ' est déjà dans le cadre ' + step.frame + '.';
        if (step.victim === null) return 'Défaut : la page ' + step.page + ' est chargée dans le cadre vide ' + step.frame + '.';
        const why = MemoryPagingPage.REASONS[algo];
        return 'Défaut : la page ' + step.victim + ' (cadre ' + step.frame + ') est évincée, ' + why + (step.note ? ' (' + step.note + ')' : '') + '. La page ' + step.page + ' la remplace.';
    }

    /** Histogramme des défauts selon le nombre de cadres (éléments DOM, texte uniquement). */
    static buildCurve(curve, selectedFrames, cls) {
        const wrap = document.createElement('div');
        wrap.className = cls + '-curve';
        const max = Math.max(1, ...curve.map((c) => c.faults));
        curve.forEach((c, i) => {
            const col = document.createElement('div');
            col.className = cls + '-curve-col' + (c.frames === selectedFrames ? ' selected' : '') + (i > 0 && c.faults > curve[i - 1].faults ? ' up' : '');
            const bar = document.createElement('div');
            bar.className = cls + '-curve-bar';
            bar.style.height = Math.round(c.faults / max * 100) + '%';
            const val = document.createElement('span');
            val.className = cls + '-curve-val';
            val.textContent = c.faults;
            const lbl = document.createElement('span');
            lbl.className = cls + '-curve-lbl';
            lbl.textContent = c.frames + (c.frames === 1 ? ' cadre' : ' cadres');
            col.append(val, bar, lbl);
            wrap.appendChild(col);
        });
        return wrap;
    }

    /** Lit "0x403 -> 0x1F" par ligne ; retourne { table, errors }. */
    static parsePageTable(text) {
        const table = {};
        const errors = [];
        String(text).split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
            const parts = line.split(/\s*(?:->|=>|:|\s)\s*/).filter(Boolean);
            const page = OEITrace.pagingParseNumber(parts[0] || '');
            const frame = OEITrace.pagingParseNumber(parts[1] || '');
            if (parts.length !== 2 || page === null || frame === null) errors.push(line);
            else table[page] = frame;
        });
        return { table: table, errors: errors };
    }

    static parseAddresses(text) {
        const out = [];
        const errors = [];
        String(text).split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).forEach((tok) => {
            const v = OEITrace.pagingParseNumber(tok);
            if (v === null || v > 0xFFFFFFFF) errors.push(tok); else out.push(v);
        });
        return { addresses: out, errors: errors };
    }

    /** Tableau de traduction (élément DOM) ; `cls` est le préfixe de classes. */
    static buildTranslation(results, cls) {
        const table = document.createElement('table');
        table.className = cls + '-xlate';
        const head = document.createElement('thead');
        const hr = document.createElement('tr');
        ['Adresse virtuelle', 'Page', 'Déplacement', 'TLB', 'Cadre', 'Adresse physique'].forEach((t) => {
            const th = document.createElement('th');
            th.textContent = t;
            hr.appendChild(th);
        });
        head.appendChild(hr);
        table.appendChild(head);
        const body = document.createElement('tbody');
        results.forEach((r) => {
            const tr = document.createElement('tr');
            const cells = [
                OEITrace.pagingHex(r.vaddr, 8),
                OEITrace.pagingHex(r.page) + ' (' + r.page + ')',
                OEITrace.pagingHex(r.offset),
                r.tlb === 'hit' ? 'hit' : 'miss',
                r.fault ? '-' : OEITrace.pagingHex(r.frame),
                r.fault ? 'défaut de page' : OEITrace.pagingHex(r.paddr)
            ];
            cells.forEach((t, i) => {
                const td = document.createElement('td');
                td.textContent = t;
                if (i === 5 && r.fault) td.className = cls + '-fault';
                if (i === 3) td.className = r.tlb === 'hit' ? cls + '-hit' : '';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        table.appendChild(body);
        return table;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        this.speedCtrl = new OEIUtils.SpeedController();
        this.state = { algorithm: 'fifo', numFrames: 3, sequence: [], currentStep: -1, result: null, isRunning: false };
        this.loadExample(1);
        this.translate();
    }

    updateInfo(text) {
        document.getElementById('infoPanel').textContent = text;
    }

    switchAlgorithm(algo) {
        this.state.algorithm = algo;
        document.querySelectorAll('.algo-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.algo === algo);
        });
        this.resetSimulation();
    }

    switchView(view) {
        document.getElementById('viewReplace').style.display = view === 'replace' ? '' : 'none';
        document.getElementById('viewTranslate').style.display = view === 'translate' ? '' : 'none';
        document.querySelectorAll('.view-tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    }

    loadExample(n) {
        const examples = { 1: ['7,0,1,2,0,3,0,4,2,3,0,3,2', 3], 2: ['1,2,3,4,1,2,5,1,2,3,4,5', 3], 3: ['0,1,2,3,0,1,4,0,1,2,3,4', 4], 4: ['1,2,3,2,4,1', 3] };
        const [seq, frames] = examples[n] || examples[1];
        document.getElementById('sequenceInput').value = seq;
        document.getElementById('framesInput').value = String(frames);
        this.resetSimulation();
    }

    resetSimulation() {
        const s = this.state;
        s.isRunning = false;
        s.numFrames = Math.min(8, Math.max(1, parseInt(document.getElementById('framesInput').value, 10) || 3));
        s.sequence = document.getElementById('sequenceInput').value.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
        s.currentStep = -1;
        s.result = OEITrace.pagingSimulate(s.sequence, s.numFrames, s.algorithm);
        this.render();
        this.updateInfo('Prédis le nombre de défauts avec ' + MemoryPagingPage.LABELS[s.algorithm] + ' et ' + s.numFrames + ' cadres, puis clique sur "Simuler" ou "Étape".');
    }

    async runSimulation() {
        const s = this.state;
        if (s.isRunning) { s.isRunning = false; return; }
        if (s.currentStep >= s.sequence.length - 1) this.resetSimulation();
        s.isRunning = true;
        while (s.currentStep < s.sequence.length - 1 && s.isRunning) {
            this.advance();
            await OEIUtils.sleep(this.speedCtrl.getDelay());
        }
        s.isRunning = false;
    }

    stepSimulation() {
        if (this.state.isRunning) return;
        this.advance();
    }

    advance() {
        const s = this.state;
        if (s.currentStep >= s.sequence.length - 1) return;
        s.currentStep += 1;
        this.render();
        this.updateInfo(MemoryPagingPage.describeStep(s.result.steps[s.currentStep], s.algorithm));
    }

    render() {
        this.renderReferenceString();
        this.renderMemoryFrames();
        this.renderStats();
        this.renderCurve();
        this.compareAlgorithms();
    }

    renderReferenceString() {
        const s = this.state;
        const container = document.getElementById('referenceString');
        container.innerHTML = '';
        s.sequence.forEach((page, index) => {
            const el = document.createElement('div');
            el.className = 'ref-page' + (index === s.currentStep ? ' current' : index < s.currentStep ? ' processed' : '');
            el.textContent = page;
            container.appendChild(el);
        });
    }

    renderMemoryFrames() {
        const s = this.state;
        const container = document.getElementById('memoryFrames');
        container.innerHTML = '';
        const clock = s.algorithm === 'clock';
        for (let f = 0; f < s.numFrames; f += 1) {
            const row = document.createElement('div');
            row.className = 'frame-row';
            const label = document.createElement('div');
            label.className = 'frame-label';
            label.textContent = 'Cadre ' + f;
            const cells = document.createElement('div');
            cells.className = 'frame-cells';
            for (let i = 0; i <= s.currentStep; i += 1) {
                const step = s.result.steps[i];
                const cell = document.createElement('div');
                cell.className = 'frame-cell';
                if (step.frames[f] !== null) {
                    cell.textContent = step.frames[f];
                    if (clock) {
                        const bit = document.createElement('sub');
                        bit.textContent = 'R' + step.refBits[f];
                        cell.appendChild(bit);
                        if (step.hand === f) cell.classList.add('hand');
                    }
                    if (i === s.currentStep) {
                        if (step.type === 'hit' && step.frame === f) cell.classList.add('hit');
                        else if (step.type === 'fault' && step.frame === f) cell.classList.add(step.victim === null ? 'fault' : 'victim');
                    }
                } else {
                    cell.classList.add('empty');
                    cell.textContent = '-';
                }
                cells.appendChild(cell);
            }
            row.append(label, cells);
            container.appendChild(row);
        }
        if (clock) {
            const note = document.createElement('div');
            note.className = 'text-muted text-sm';
            note.textContent = 'R = bit de référence. Contour en pointillé : cadre sous l\'aiguille après ce pas.';
            container.appendChild(note);
        }
    }

    renderStats() {
        const s = this.state;
        const seen = s.result.steps.slice(0, s.currentStep + 1);
        const hits = seen.filter((x) => x.type === 'hit').length;
        const faults = seen.length - hits;
        document.getElementById('statCurrent').textContent = s.currentStep >= 0 ? s.sequence[s.currentStep] : '--';
        document.getElementById('statHits').textContent = hits;
        document.getElementById('statFaults').textContent = faults;
        document.getElementById('statRate').textContent = seen.length ? (hits / seen.length * 100).toFixed(1) + ' %' : '--';
    }

    renderCurve() {
        const s = this.state;
        const box = document.getElementById('faultCurve');
        const note = document.getElementById('curveNote');
        box.innerHTML = '';
        if (!s.sequence.length) { note.textContent = ''; return; }
        const curve = OEITrace.pagingFaultCurve(s.sequence, s.algorithm, 8);
        box.appendChild(MemoryPagingPage.buildCurve(curve, s.numFrames, 'mem'));
        const belady = OEITrace.pagingHasBelady(curve);
        note.textContent = (MemoryPagingPage.LABELS[s.algorithm]) + ' sur cette chaîne : ' + (belady
            ? 'anomalie de Belady, le nombre de défauts augmente avec un cadre de plus (colonne marquée).'
            : 'le nombre de défauts ne remonte jamais quand on ajoute un cadre.');
    }

    compareAlgorithms() {
        const s = this.state;
        const grid = document.getElementById('compareGrid');
        grid.innerHTML = '';
        if (!s.sequence.length) return;
        const results = OEITrace.PAGING_ALGORITHMS.map((algo) => ({ algo: algo, r: OEITrace.pagingSimulate(s.sequence, s.numFrames, algo) }));
        const best = Math.min(...results.map((x) => x.r.faults));
        results.forEach(({ algo, r }) => {
            const card = document.createElement('div');
            card.className = 'compare-card' + (r.faults === best ? ' best' : '');
            const h = document.createElement('h4');
            h.textContent = MemoryPagingPage.LABELS[algo];
            card.appendChild(h);
            [['Hits', r.hits], ['Défauts', r.faults], ['Taux de succès', (r.hitRate * 100).toFixed(1) + ' %']].forEach(([k, v]) => {
                const line = document.createElement('div');
                line.className = 'line';
                const a = document.createElement('span'); a.textContent = k;
                const b = document.createElement('strong'); b.textContent = v;
                line.append(a, b);
                card.appendChild(line);
            });
            grid.appendChild(card);
        });
    }

    translate() {
        const pt = MemoryPagingPage.parsePageTable(document.getElementById('ptInput').value);
        const ad = MemoryPagingPage.parseAddresses(document.getElementById('addrInput').value);
        const tlbSize = parseInt(document.getElementById('tlbInput').value, 10) || 0;
        const out = document.getElementById('translateOut');
        const msg = document.getElementById('translateMsg');
        out.innerHTML = '';
        const errors = pt.errors.concat(ad.errors);
        msg.textContent = errors.length ? 'Entrées ignorées (format attendu : 0x403 -> 0x1F, adresses en hexadécimal) : ' + errors.join(' ; ') : '';
        if (!ad.addresses.length) return;
        out.appendChild(MemoryPagingPage.buildTranslation(OEITrace.pagingTranslateAll(ad.addresses, pt.table, tlbSize), 'mem'));
    }
}

if (typeof window !== 'undefined') {
    window.MemoryPagingPage = MemoryPagingPage;
}

// ── Standalone widget ──────────────────────────────────────────
class MemoryWidget {
    static mount(container, config = {}) {
        if (container.dataset.mpw) return;
        container.dataset.mpw = '1';
        new MemoryWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.algo = MemoryPagingPage.LABELS[config.algorithm] ? config.algorithm : 'fifo';
        this.view = config.view === 'translate' ? 'translate' : 'replace';
        this.step = -1;
        this.result = null;
        this.seq = [];
        this.numFrames = 3;
        this.running = false;
        this.DEFAULT_SEQ = config.sequence || '7,0,1,2,0,3,0,4,2,3,0,3,2';
        this.DEFAULT_FRAMES = config.frames || 3;
    }

    init() {
        const pills = Object.entries(MemoryPagingPage.LABELS)
            .map(([k, v]) => `<button class="mpw-pill${k === this.algo ? ' active' : ''}" data-algo="${k}">${v}</button>`).join('');
        this.root.innerHTML = `<div class="mpw widget-fit">
  <div class="mpw-toolbar widget-fit-header">
    <div class="mpw-pills">
      <button class="mpw-pill${this.view === 'replace' ? ' active' : ''}" data-view="replace">Remplacement</button>
      <button class="mpw-pill${this.view === 'translate' ? ' active' : ''}" data-view="translate">Traduire une adresse</button>
    </div>
  </div>
  <div class="widget-fit-body" data-view-replace>
    <div class="mpw-toolbar">
      <span class="mpw-lbl">Séquence :</span>
      <input class="mpw-input" style="width:200px" data-seq value="${this.DEFAULT_SEQ}" aria-label="Chaîne de références">
      <span class="mpw-lbl">Cadres :</span>
      <input class="mpw-input" style="width:46px" data-frames value="${this.DEFAULT_FRAMES}" aria-label="Nombre de cadres">
      <div class="mpw-pills">${pills}</div>
      <div class="mpw-btns">
        <button class="mpw-btn" data-step>Étape</button>
        <button class="mpw-btn primary" data-run>${OEIIcons.render('play')} Simuler</button>
        <button class="mpw-btn" data-reset>${OEIIcons.render('refresh')} Reset</button>
      </div>
    </div>
    <div class="mpw-lbl">Chaîne de référence</div>
    <div class="mpw-ref" data-ref-row></div>
    <div class="mpw-lbl">Cadres mémoire</div>
    <div data-frames-area></div>
    <div class="mpw-lbl">Défauts selon le nombre de cadres</div>
    <div data-curve></div>
    <div class="mpw-info" data-curve-note></div>
    <div class="mpw-stats">
      <div class="mpw-stat"><span class="mpw-sv" data-sp>--</span><span class="mpw-sl">Page courante</span></div>
      <div class="mpw-stat"><span class="mpw-sv" data-sh>0</span><span class="mpw-sl">Hits</span></div>
      <div class="mpw-stat"><span class="mpw-sv" data-sf>0</span><span class="mpw-sl">Défauts</span></div>
      <div class="mpw-stat"><span class="mpw-sv" data-sr>--</span><span class="mpw-sl">Taux de hit</span></div>
    </div>
    <div class="mpw-info" data-info></div>
  </div>
  <div class="widget-fit-body" data-view-translate style="display:none">
    <div class="mpw-lbl">Pages de 4 Kio : adresse = numéro de page + déplacement sur 12 bits (3 chiffres hexadécimaux)</div>
    <div class="mpw-toolbar">
      <label class="mpw-lbl">Table des pages<br><textarea class="mpw-input" rows="3" data-pt>${MemoryPagingPage.DEFAULT_PAGE_TABLE}</textarea></label>
      <label class="mpw-lbl">Adresses virtuelles<br><textarea class="mpw-input" rows="4" data-addr>${MemoryPagingPage.DEFAULT_ADDRESSES}</textarea></label>
      <label class="mpw-lbl">Entrées de TLB<br><input class="mpw-input" type="number" min="0" max="8" value="4" style="width:60px" data-tlb></label>
      <button class="mpw-btn primary" data-translate>Traduire</button>
    </div>
    <div class="mpw-info" data-msg></div>
    <div data-xl></div>
  </div>
</div>`;
        this._bind();
        this._reset();
        this._translate();
        this._showView(this.view);
    }

    _q(s) { return this.root.querySelector(s); }
    _qa(s) { return this.root.querySelectorAll(s); }

    _bind() {
        this._qa('[data-algo]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.algo = btn.dataset.algo;
                this._qa('[data-algo]').forEach((b) => b.classList.toggle('active', b === btn));
                this._reset();
            });
        });
        this._qa('[data-view]').forEach((btn) => btn.addEventListener('click', () => this._showView(btn.dataset.view)));
        this._q('[data-step]').addEventListener('click', () => this._step());
        this._q('[data-run]').addEventListener('click', () => this._toggleRun());
        this._q('[data-reset]').addEventListener('click', () => this._reset());
        this._q('[data-translate]').addEventListener('click', () => this._translate());
    }

    _showView(view) {
        this.view = view;
        this._q('[data-view-replace]').style.display = view === 'replace' ? '' : 'none';
        this._q('[data-view-translate]').style.display = view === 'translate' ? '' : 'none';
        this._qa('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    }

    _reset() {
        this.running = false;
        OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Simuler');
        this.numFrames = Math.min(8, Math.max(1, parseInt(this._q('[data-frames]').value, 10) || 3));
        this.seq = this._q('[data-seq]').value.split(',').map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
        this.step = -1;
        this.result = OEITrace.pagingSimulate(this.seq, this.numFrames, this.algo);
        this._render();
        this._q('[data-info]').textContent = 'Prédis le nombre de défauts, puis clique sur Étape ou Simuler.';
    }

    _step() {
        if (this.running || this.step >= this.seq.length - 1) return;
        this._advance();
    }

    _advance() {
        this.step += 1;
        this._render();
        this._q('[data-info]').textContent = MemoryPagingPage.describeStep(this.result.steps[this.step], this.algo);
    }

    async _toggleRun() {
        if (this.running) { this.running = false; OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Simuler'); return; }
        if (this.step >= this.seq.length - 1) this._reset();
        this.running = true;
        OEIIcons.setLabel(this._q('[data-run]'), 'pause', 'Pause');
        while (this.running && this.step < this.seq.length - 1) {
            this._advance();
            await new Promise((r) => setTimeout(r, 600));
        }
        this.running = false;
        OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Simuler');
    }

    _render() {
        const ref = this._q('[data-ref-row]');
        ref.innerHTML = '';
        this.seq.forEach((p, i) => {
            const el = document.createElement('div');
            el.className = 'mpw-rc' + (i === this.step ? ' current' : i < this.step ? ' processed' : '');
            el.textContent = p;
            ref.appendChild(el);
        });

        const area = this._q('[data-frames-area]');
        area.innerHTML = '';
        const clock = this.algo === 'clock';
        for (let f = 0; f < this.numFrames; f += 1) {
            const row = document.createElement('div');
            row.className = 'mpw-frame-row';
            const lbl = document.createElement('div');
            lbl.className = 'mpw-frame-lbl';
            lbl.textContent = 'Cadre ' + f;
            const cells = document.createElement('div');
            cells.className = 'mpw-frame-cells';
            for (let i = 0; i <= this.step; i += 1) {
                const hs = this.result.steps[i];
                const cell = document.createElement('div');
                cell.className = 'mpw-fc';
                if (hs.frames[f] !== null) {
                    cell.textContent = hs.frames[f];
                    if (clock) {
                        const bit = document.createElement('sub');
                        bit.textContent = 'R' + hs.refBits[f];
                        cell.appendChild(bit);
                        if (hs.hand === f) cell.classList.add('hand');
                    }
                    if (i === this.step) {
                        if (hs.type === 'hit' && hs.frame === f) cell.classList.add('hit');
                        else if (hs.type === 'fault' && hs.frame === f) cell.classList.add(hs.victim === null ? 'fault' : 'victim');
                    }
                } else {
                    cell.classList.add('empty');
                    cell.textContent = '-';
                }
                cells.appendChild(cell);
            }
            row.append(lbl, cells);
            area.appendChild(row);
        }

        const seen = this.result.steps.slice(0, this.step + 1);
        const hits = seen.filter((x) => x.type === 'hit').length;
        this._q('[data-sp]').textContent = this.step >= 0 ? this.seq[this.step] : '--';
        this._q('[data-sh]').textContent = hits;
        this._q('[data-sf]').textContent = seen.length - hits;
        this._q('[data-sr]').textContent = seen.length ? (hits / seen.length * 100).toFixed(1) + ' %' : '--';

        const curveBox = this._q('[data-curve]');
        curveBox.innerHTML = '';
        if (this.seq.length) {
            const curve = OEITrace.pagingFaultCurve(this.seq, this.algo, 8);
            curveBox.appendChild(MemoryPagingPage.buildCurve(curve, this.numFrames, 'mpw'));
            this._q('[data-curve-note]').textContent = OEITrace.pagingHasBelady(curve)
                ? 'Anomalie de Belady : un cadre de plus donne plus de défauts (colonne marquée).'
                : 'Aucune anomalie : les défauts ne remontent pas avec plus de cadres.';
        }
    }

    _translate() {
        const pt = MemoryPagingPage.parsePageTable(this._q('[data-pt]').value);
        const ad = MemoryPagingPage.parseAddresses(this._q('[data-addr]').value);
        const tlbSize = parseInt(this._q('[data-tlb]').value, 10) || 0;
        const out = this._q('[data-xl]');
        out.innerHTML = '';
        const errors = pt.errors.concat(ad.errors);
        this._q('[data-msg]').textContent = errors.length ? 'Entrées ignorées : ' + errors.join(' ; ') : '';
        if (ad.addresses.length) out.appendChild(MemoryPagingPage.buildTranslation(OEITrace.pagingTranslateAll(ad.addresses, pt.table, tlbSize), 'mpw'));
    }
}

if (typeof window !== 'undefined') {
    window.MemoryWidget = MemoryWidget;
}
