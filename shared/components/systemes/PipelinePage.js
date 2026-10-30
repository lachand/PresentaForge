/**
 * PipelinePage / PipelineWidget : les deux affichent la trace calculée par le moteur pur
 * `algorithms/pipeline-engine.js` (relecture 3b, B2) ; aucun calcul d'étage ici.
 */
class PipelinePage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        this.speedCtrl = new OEIUtils.SpeedController();
        this.state = { instructions: [], cycle: 0, result: null, running: false };
        this.loadExample('indep');
        ['detectHazards', 'enableForwarding', 'mispredictBranches'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.resetPipeline());
        });
    }

    loadExample(name) {
        const program = PipelineWidget.EXAMPLES[name] || PipelineWidget.EXAMPLES.indep;
        this.state.instructions = program.slice();
        const input = document.getElementById('programInput');
        if (input) input.value = program.join('\n');
        this.resetPipeline();
    }

    applyProgram() {
        const input = document.getElementById('programInput');
        const lines = String(input ? input.value : '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 16);
        if (!lines.length) {
            this.updateInfo('Écris au moins une instruction, par exemple ADD R1, R2, R3.');
            return;
        }
        this.state.instructions = lines;
        this.resetPipeline();
    }

    readOptions() {
        const checked = (id, fallback) => {
            const el = document.getElementById(id);
            return el ? el.checked : fallback;
        };
        return {
            detectHazards: checked('detectHazards', true),
            forwarding: checked('enableForwarding', true),
            mispredict: checked('mispredictBranches', false)
        };
    }

    resetPipeline() {
        this.state.running = false;
        const btn = document.getElementById('btnRun');
        if (btn) btn.textContent = 'Exécuter';
        this.state.cycle = 0;
        this.state.result = OEITrace.pipelineSimulate(this.state.instructions, this.readOptions());
        this.render();
        this.updateInfo('Pipeline prêt. Avant de lancer : combien de cycles faut-il pour ces ' + this.state.instructions.length + ' instructions ?');
    }

    async runPipeline() {
        const btn = document.getElementById('btnRun');
        if (this.state.running) {
            this.state.running = false;
            btn.textContent = 'Exécuter';
            return;
        }
        if (this.state.cycle >= this.state.result.totalCycles) this.resetPipeline();
        this.state.running = true;
        btn.textContent = 'Pause';
        while (this.state.running && this.state.cycle < this.state.result.totalCycles) {
            this.stepPipeline();
            await OEIUtils.sleep(this.speedCtrl.getDelay());
        }
        this.state.running = false;
        btn.textContent = 'Exécuter';
    }

    stepPipeline() {
        const { result } = this.state;
        if (this.state.cycle >= result.totalCycles) return;
        this.state.cycle += 1;
        this.render();
        this.updateInfo(this.describeCycle());
    }

    describeCycle() {
        const { result, cycle } = this.state;
        if (cycle >= result.totalCycles) {
            const n = result.rows.length;
            const loss = [];
            if (result.stalls) loss.push(result.stalls + ' stall' + (result.stalls > 1 ? 's' : ''));
            if (result.flushes) loss.push(result.flushes + ' cycles de flush');
            return 'Terminé : ' + result.totalCycles + ' cycles pour ' + n + ' instructions (sans aléa : ' + n + ' + 4 = ' + result.idealCycles + ')'
                + (loss.length ? ', dont ' + loss.join(' et ') + ' de perdus' : '') + '. CPI = ' + result.totalCycles + ' / ' + n + ' = ' + result.cpi.toFixed(2) + '.';
        }
        const parts = [];
        result.rows.forEach((row) => {
            const cell = row.cells[cycle - 1];
            if (cell) parts.push(row.inst + ' : ' + cell);
        });
        return 'Cycle ' + cycle + ' - ' + parts.join(' ; ');
    }

    render() {
        this.renderGrid();
        this.renderStats();
        this.renderHazardLog();
    }

    renderGrid() {
        const { result, cycle } = this.state;
        const grid = document.getElementById('pipelineGrid');
        grid.innerHTML = '';
        const cols = Math.max(cycle, 1);
        grid.style.setProperty('--cycles', cols);
        const add = (cls, text, title) => {
            const el = document.createElement('div');
            el.className = cls;
            el.textContent = text;
            if (title) el.title = title;
            grid.appendChild(el);
        };
        add('cycle-label', 'Instruction');
        for (let c = 1; c <= cols; c += 1) add('cycle-label', 'C' + c);
        const titles = {
            STALL: 'Bulle : l’instruction attend un opérande',
            WAIT: 'Retenue en IF derrière une instruction en stall',
            FLUSH: 'Chargement annulé : mauvais chemin après un branchement mal prédit'
        };
        result.rows.forEach((row) => {
            add('inst-label', row.inst);
            for (let c = 0; c < cols; c += 1) {
                const stage = c < cycle ? row.cells[c] : null;
                if (!stage) { add('stage-cell empty', ''); continue; }
                const text = stage === 'WAIT' ? 'IF' : stage;
                add('stage-cell ' + stage + (c === cycle - 1 ? ' current' : ''), text, titles[stage]);
            }
        });
    }

    renderStats() {
        const { result, cycle } = this.state;
        const done = cycle >= result.totalCycles && result.totalCycles > 0;
        const seen = (row) => row.cells.slice(0, cycle);
        const set = (id, value) => { document.getElementById(id).textContent = value; };
        set('statCycle', cycle);
        set('statCompleted', result.rows.filter((r) => r.wb <= cycle).length);
        set('statStalls', result.rows.reduce((acc, r) => acc + seen(r).filter((x) => x === 'STALL').length, 0));
        set('statForwarded', result.hazards.filter((h) => h.kind === 'forwarded' && h.cycle <= cycle).length);
        set('statFlush', result.rows.reduce((acc, r) => acc + seen(r).filter((x) => x === 'FLUSH').length, 0));
        set('statCPI', done ? result.cpi.toFixed(2) : '--');
    }

    renderHazardLog() {
        const { result, cycle } = this.state;
        const panel = document.getElementById('hazardLog');
        const shown = result.hazards.filter((h) => h.cycle <= cycle);
        panel.innerHTML = '';
        if (!shown.length) {
            const empty = document.createElement('div');
            empty.className = 'text-muted text-sm';
            empty.textContent = 'Aucun aléa détecté pour l’instant.';
            panel.appendChild(empty);
            return;
        }
        shown.slice(-8).reverse().forEach((h) => {
            const item = document.createElement('div');
            item.className = 'hazard-item ' + h.kind;
            item.textContent = OEITrace.pipelineHazardMessage(result, h);
            panel.appendChild(item);
        });
    }

    updateInfo(text) {
        document.getElementById('infoPanel').textContent = text;
    }
}

if (typeof window !== 'undefined') {
    window.PipelinePage = PipelinePage;
}

// ── Standalone widget ──────────────────────────────────────────
class PipelineWidget {

    static EXAMPLES = {
        indep:  ['ADD R1, R2, R3', 'SUB R4, R5, R6', 'AND R7, R8, R9', 'OR R10, R11, R12'],
        simple: ['ADD R1, R2, R3', 'SUB R4, R1, R5', 'AND R6, R4, R7', 'OR R8, R6, R9'],
        hazard: ['ADD R1, R2, R3', 'SUB R4, R1, R5', 'OR R6, R7, R8', 'XOR R9, R4, R10'],
        load:   ['LOAD R1, 0(R2)', 'ADD R3, R1, R4', 'STORE R3, 4(R2)', 'SUB R5, R6, R7'],
        branch: ['ADD R1, R2, R3', 'BEQ R1, R4, fin', 'SUB R5, R6, R7', 'OR R8, R9, R10']
    };

    static mount(container, config = {}) {
        if (container.dataset.plw) return;
        container.dataset.plw = '1';
        new PipelineWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        const name = PipelineWidget.EXAMPLES[config.example] ? config.example : 'indep';
        this.example = name;
        this.instructions = PipelineWidget.EXAMPLES[name].slice();
        this.detectHaz = config.detectHazards !== false;
        this.forwarding = config.forwarding !== false;
        this.mispredict = config.mispredict === true;
        this.cycle = 0;
        this.result = null;
        this.running = false;
    }

    init() {
        const opt = (key, label) => `<option value="${key}"${key === this.example ? ' selected' : ''}>${label}</option>`;
        this.root.innerHTML = `<div class="plw widget-fit">
  <div class="plw-toolbar widget-fit-header">
    <select class="plw-select" data-ex aria-label="Programme">
      ${opt('indep', 'Sans dépendance')}
      ${opt('simple', 'Dépendances en chaîne')}
      ${opt('hazard', 'Aléas RAW (distance 1 et 2)')}
      ${opt('load', 'Load-use')}
      ${opt('branch', 'Branchement')}
    </select>
    <div class="plw-opts">
      <label><input type="checkbox" data-haz${this.detectHaz ? ' checked' : ''}> Détecter les aléas</label>
      <label><input type="checkbox" data-fwd${this.forwarding ? ' checked' : ''}> Forwarding</label>
      <label><input type="checkbox" data-mis${this.mispredict ? ' checked' : ''}> Branchement mal prédit</label>
    </div>
    <div class="plw-btns">
      <button class="plw-btn" data-step>Cycle suivant</button>
      <button class="plw-btn primary" data-run>${OEIIcons.render('play')} Exécuter</button>
      <button class="plw-btn" data-reset>${OEIIcons.render('refresh')} Reset</button>
    </div>
  </div>
  <div class="widget-fit-body">
    <div class="plw-section-lbl">Diagramme pipeline (le registre est écrit en 1re moitié de cycle, lu en 2e)</div>
    <div class="plw-grid-wrap"><div class="plw-grid" data-grid></div></div>
    <div class="plw-section-lbl" data-hz-title style="display:none">Journal des aléas</div>
    <div class="plw-hazlog" data-hazlog></div>
  </div>
  <div class="plw-stats widget-fit-footer">
    <div class="plw-stat"><span class="plw-sv" data-sc>0</span><span class="plw-sl">Cycle</span></div>
    <div class="plw-stat"><span class="plw-sv" data-sco>0</span><span class="plw-sl">Terminées</span></div>
    <div class="plw-stat"><span class="plw-sv" data-ss>0</span><span class="plw-sl">Stalls</span></div>
    <div class="plw-stat"><span class="plw-sv" data-sf>0</span><span class="plw-sl">Forwarding</span></div>
    <div class="plw-stat"><span class="plw-sv" data-sfl>0</span><span class="plw-sl">Flush</span></div>
    <div class="plw-stat"><span class="plw-sv" data-scpi>--</span><span class="plw-sl">CPI final</span></div>
  </div>
</div>`;
        this._bind();
        this._reset();
    }

    _q(s) { return this.root.querySelector(s); }

    _bind() {
        this._q('[data-ex]').addEventListener('change', (e) => {
            this.instructions = PipelineWidget.EXAMPLES[e.target.value].slice();
            this._reset();
        });
        this._q('[data-haz]').addEventListener('change', (e) => { this.detectHaz = e.target.checked; this._reset(); });
        this._q('[data-fwd]').addEventListener('change', (e) => { this.forwarding = e.target.checked; this._reset(); });
        this._q('[data-mis]').addEventListener('change', (e) => { this.mispredict = e.target.checked; this._reset(); });
        this._q('[data-step]').addEventListener('click', () => this._step());
        this._q('[data-run]').addEventListener('click', () => this._toggleRun());
        this._q('[data-reset]').addEventListener('click', () => this._reset());
    }

    _reset() {
        this.running = false;
        OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Exécuter');
        this.cycle = 0;
        this.result = OEITrace.pipelineSimulate(this.instructions, {
            detectHazards: this.detectHaz, forwarding: this.forwarding, mispredict: this.mispredict
        });
        this._render();
    }

    _step() {
        if (this.running) return;
        if (this.cycle < this.result.totalCycles) { this.cycle += 1; this._render(); }
    }

    async _toggleRun() {
        if (this.running) { this.running = false; OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Exécuter'); return; }
        if (this.cycle >= this.result.totalCycles) this._reset();
        this.running = true;
        OEIIcons.setLabel(this._q('[data-run]'), 'pause', 'Pause');
        while (this.running && this.cycle < this.result.totalCycles) {
            this.cycle += 1;
            this._render();
            await new Promise((r) => setTimeout(r, 500));
        }
        this.running = false;
        OEIIcons.setLabel(this._q('[data-run]'), 'play', 'Exécuter');
    }

    _render() {
        this._renderGrid();
        this._renderStats();
    }

    _renderGrid() {
        const grid = this._q('[data-grid]');
        const cols = Math.max(this.cycle, 1);
        grid.style.gridTemplateColumns = `110px repeat(${cols}, 42px)`;
        grid.innerHTML = '';
        const add = (cls, text) => {
            const el = document.createElement('div');
            el.className = cls;
            el.textContent = text;
            grid.appendChild(el);
        };
        add('plw-cell cy-lbl', 'Instruction');
        for (let c = 1; c <= cols; c += 1) add('plw-cell cy-lbl', 'C' + c);
        this.result.rows.forEach((row) => {
            add('plw-cell inst-lbl', row.inst);
            for (let c = 0; c < cols; c += 1) {
                const stage = c < this.cycle ? row.cells[c] : null;
                add(stage ? `plw-cell ${stage}` : 'plw-cell empty', stage === 'WAIT' ? 'IF' : (stage || ''));
            }
        });
    }

    _renderStats() {
        const r = this.result;
        const cyc = this.cycle;
        const done = cyc >= r.totalCycles && r.totalCycles > 0;
        const count = (kind) => r.rows.reduce((acc, row) => acc + row.cells.slice(0, cyc).filter((x) => x === kind).length, 0);
        this._q('[data-sc]').textContent = cyc;
        this._q('[data-sco]').textContent = r.rows.filter((row) => row.wb <= cyc).length;
        this._q('[data-ss]').textContent = count('STALL');
        this._q('[data-sf]').textContent = r.hazards.filter((h) => h.kind === 'forwarded' && h.cycle <= cyc).length;
        this._q('[data-sfl]').textContent = count('FLUSH');
        this._q('[data-scpi]').textContent = done ? r.cpi.toFixed(2) : '--';

        const shown = r.hazards.filter((h) => h.cycle <= cyc);
        const title = this._q('[data-hz-title]');
        const log = this._q('[data-hazlog]');
        title.style.display = shown.length ? '' : 'none';
        log.innerHTML = '';
        shown.forEach((h) => {
            const el = document.createElement('div');
            el.className = `plw-hz ${h.kind}`;
            el.textContent = OEITrace.pipelineHazardMessage(r, h);
            log.appendChild(el);
        });
    }
}

if (typeof window !== 'undefined') {
    window.PipelineWidget = PipelineWidget;
}
