class PipelinePage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
// ============================================================
// Pipeline Simulator
// ============================================================

var examples = {
    simple: [
        'ADD R1, R2, R3',
        'SUB R4, R1, R5',
        'AND R6, R4, R7',
        'OR R8, R6, R9'
    ],
    hazard: [
        'ADD R1, R2, R3',
        'SUB R4, R1, R5',
        'OR R6, R7, R8',
        'XOR R9, R4, R10'
    ],
    load: [
        'LOAD R1, 0(R2)',
        'ADD R3, R1, R4',
        'STORE R3, 4(R2)',
        'SUB R5, R6, R7'
    ]
};

var state = {
    instructions: [],
    currentCycle: 0,
    pipeline: [],
    completed: 0,
    stalls: 0,
    forwarded: 0,
    hazardLog: [],
    isRunning: false
};

var stages = ['IF', 'ID', 'EX', 'MEM', 'WB'];

const speedCtrl = new OEIUtils.SpeedController();

function loadExample(name) {
    state.instructions = examples[name].slice();
    resetPipeline();
}

function resetPipeline() {
    state.currentCycle = 0;
    state.pipeline = [];
    state.completed = 0;
    state.stalls = 0;
    state.forwarded = 0;
    state.hazardLog = [];
    state.isRunning = false;

    // Initialize pipeline state for each instruction
    for (var i = 0; i < state.instructions.length; i++) {
        state.pipeline.push({
            inst: state.instructions[i],
            cycles: []
        });
    }

    renderPipeline();
    updateStats();
    renderHazardLog();
    updateInfo('Pipeline initialisé. Cliquez sur "Exécuter" ou "Cycle suivant"');
}

async function runPipeline() {
    if (state.isRunning) {
        state.isRunning = false;
        document.getElementById('btnRun').textContent = 'Exécuter';
        return;
    }

    state.isRunning = true;
    document.getElementById('btnRun').textContent = 'Pause';

    var maxCycles = state.instructions.length + 4;

    while (state.currentCycle < maxCycles && state.isRunning) {
        stepPipeline();
        await OEIUtils.sleep(speedCtrl.getDelay());
    }

    state.isRunning = false;
    document.getElementById('btnRun').textContent = 'Exécuter';
}

function stepPipeline() {
    var detectHazards = document.getElementById('detectHazards').checked;
    var forwardingEnabled = document.getElementById('enableForwarding').checked;

    // Advance each instruction in the pipeline
    for (var i = 0; i < state.instructions.length; i++) {
        var instState = state.pipeline[i];
        var instCycle = instState.cycles.length;
        var startCycle = i; // Instruction i starts at cycle i

        if (state.currentCycle < startCycle) {
            instState.cycles.push(null);
            continue;
        }

        var pipelineStage = state.currentCycle - startCycle;

        // Check for hazards
        if (detectHazards && pipelineStage === 1) { // ID stage
            var hazard = detectHazard(i);
            if (hazard && (!forwardingEnabled || hazard.requiresStall)) {
                // Insert stall
                instState.cycles.push('STALL');
                state.stalls++;
                addHazardLog('stall', 'Cycle ' + state.currentCycle + ' : ' + hazard.message + ' -> insertion d\'un stall.');
                updateInfo('Cycle ' + state.currentCycle + ' : ' + hazard.message + ' Insertion d\'un stall.');
                continue;
            } else if (hazard && forwardingEnabled && !hazard.requiresStall) {
                state.forwarded++;
                addHazardLog('forwarded', 'Cycle ' + state.currentCycle + ' : ' + hazard.message + ' -> résolu par forwarding.');
                updateInfo('Cycle ' + state.currentCycle + ' : ' + hazard.message + ' Résolution par forwarding.');
            }
        }

        if (pipelineStage < stages.length) {
            instState.cycles.push(stages[pipelineStage]);

            if (pipelineStage === stages.length - 1) {
                state.completed++;
                updateInfo('Cycle ' + state.currentCycle + ' : Instruction "' + state.instructions[i] + '" terminée (WB)');
            }
        } else {
            instState.cycles.push(null);
        }
    }

    state.currentCycle++;
    renderPipeline();
    updateStats();
    renderHazardLog();
}

function detectHazard(instIndex) {
    // Detect RAW hazard with previous instruction.
    if (instIndex === 0) return false;

    var currInst = state.instructions[instIndex];
    var prevInst = state.instructions[instIndex - 1];

    // Extract destination register from previous instruction (simplified)
    var prevDest = extractDestReg(prevInst);
    var currSrc = extractSrcRegs(currInst);

    if (prevDest && currSrc.indexOf(prevDest) !== -1) {
        var loadUse = /^LOAD\b/i.test(prevInst);
        return {
            requiresStall: loadUse,
            message: 'Aléa RAW sur ' + prevDest + ' entre "' + prevInst + '" et "' + currInst + '"'
        };
    }

    return null;
}

function extractDestReg(inst) {
    var op = (inst.trim().split(/\s+/)[0] || '').toUpperCase();
    if (op === 'STORE') return null;
    var regs = inst.match(/R\d+/g) || [];
    return regs.length > 0 ? regs[0] : null;
}

function extractSrcRegs(inst) {
    var op = (inst.trim().split(/\s+/)[0] || '').toUpperCase();
    var regs = inst.match(/R\d+/g);
    if (!regs) return [];
    if (op === 'STORE') return regs;
    if (op === 'LOAD') return regs.slice(1);
    return regs.slice(1);
}

function addHazardLog(kind, message) {
    state.hazardLog.unshift({ kind: kind, message: message });
    state.hazardLog = state.hazardLog.slice(0, 8);
}

function renderHazardLog() {
    var panel = document.getElementById('hazardLog');
    if (!panel) return;
    if (state.hazardLog.length === 0) {
        panel.innerHTML = '<div class="text-muted text-sm">Aucun aléa détecté pour l’instant.</div>';
        return;
    }
    panel.innerHTML = state.hazardLog.map(function(item) {
        return '<div class="hazard-item ' + item.kind + '">' + item.message + '</div>';
    }).join('');
}

function renderPipeline() {
    var grid = document.getElementById('pipelineGrid');
    grid.innerHTML = '';

    var maxCycles = state.currentCycle + 5;
    grid.style.setProperty('--cycles', maxCycles);

    // Header with cycle numbers
    var header = document.createElement('div');
    header.className = 'pipeline-header';
    header.innerHTML = '<div class="cycle-label">Instruction</div>';
    for (var c = 0; c < maxCycles; c++) {
        header.innerHTML += '<div class="cycle-label">C' + c + '</div>';
    }
    grid.appendChild(header);

    // Instruction rows
    for (var i = 0; i < state.instructions.length; i++) {
        var instState = state.pipeline[i];

        // Instruction label
        var label = document.createElement('div');
        label.className = 'inst-label';
        label.textContent = instState.inst;
        grid.appendChild(label);

        // Stage cells
        for (var c = 0; c < maxCycles; c++) {
            var cell = document.createElement('div');
            cell.className = 'stage-cell';

            if (c < instState.cycles.length) {
                var stage = instState.cycles[c];
                if (stage) {
                    cell.textContent = stage;
                    cell.classList.add(stage === 'STALL' ? 'stall' : stage);
                    if (c === state.currentCycle - 1) {
                        cell.classList.add('current');
                    }
                } else {
                    cell.classList.add('empty');
                }
            } else {
                cell.classList.add('empty');
            }

            grid.appendChild(cell);
        }
    }
}

function updateStats() {
    document.getElementById('statCycle').textContent = state.currentCycle;
    document.getElementById('statCompleted').textContent = state.completed;
    document.getElementById('statStalls').textContent = state.stalls;
    document.getElementById('statForwarded').textContent = state.forwarded;

    if (state.completed > 0) {
        var cpi = (state.currentCycle / state.completed).toFixed(2);
        document.getElementById('statCPI').textContent = cpi;
    } else {
        document.getElementById('statCPI').textContent = '--';
    }
}

function updateInfo(text) {
    document.getElementById('infoPanel').textContent = text;
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// Initialize with simple example
loadExample('simple');
        window.loadExample = loadExample;
        window.runPipeline = runPipeline;
        window.stepPipeline = stepPipeline;
        window.resetPipeline = resetPipeline;
    }
}

if (typeof window !== 'undefined') {
    window.PipelinePage = PipelinePage;
}

// ── Standalone widget ──────────────────────────────────────────
class PipelineWidget {
    static _stylesInjected = false;

    static _EXAMPLES = {
        simple:  ['ADD R1, R2, R3', 'SUB R4, R1, R5', 'AND R6, R4, R7', 'OR R8, R6, R9'],
        hazard:  ['ADD R1, R2, R3', 'SUB R4, R1, R5', 'OR R6, R7, R8', 'XOR R9, R4, R10'],
        load:    ['LOAD R1, 0(R2)', 'ADD R3, R1, R4', 'STORE R3, 4(R2)', 'SUB R5, R6, R7']
    };

    static _STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];

    static _extractDest(inst) {
        const op = (inst.trim().split(/\s+/)[0] || '').toUpperCase();
        if (op === 'STORE') return null;
        const regs = inst.match(/R\d+/g) || [];
        return regs[0] || null;
    }

    static _extractSrc(inst) {
        const op = (inst.trim().split(/\s+/)[0] || '').toUpperCase();
        const regs = inst.match(/R\d+/g);
        if (!regs) return [];
        if (op === 'STORE' || op === 'LOAD') return regs.slice(1);
        return regs.slice(1);
    }

    static _detectHazard(instructions, idx) {
        if (idx === 0) return null;
        const prev = instructions[idx - 1];
        const curr = instructions[idx];
        const prevDest = PipelineWidget._extractDest(prev);
        const currSrc = PipelineWidget._extractSrc(curr);
        if (prevDest && currSrc.indexOf(prevDest) !== -1) {
            const isLoad = /^LOAD\b/i.test(prev);
            return { requiresStall: isLoad, message: `Aléa RAW sur ${prevDest} : "${prev}" → "${curr}"` };
        }
        return null;
    }

    // Compute full pipeline trace (pre-computed steps)
    static _computeTrace(instructions, detectHaz, forwarding) {
        const STAGES = PipelineWidget._STAGES;
        const n = instructions.length;
        const pipeline = instructions.map(inst => ({ inst, cycles: [] }));
        const fifoQ = [];
        let stalls = 0, forwarded = 0;
        const hazardLog = [];
        const maxCycles = n + 4 + n; // upper bound

        for (let cycle = 0; cycle < maxCycles; cycle++) {
            let anyActive = false;
            for (let i = 0; i < n; i++) {
                const ps = pipeline[i];
                const startCycle = i + (pipeline.slice(0, i).reduce((acc, p) => acc + p.cycles.filter(c => c === 'STALL').length, 0));
                // simpler: just track how many stalls were inserted before this instruction
                const stall_prefix = ps.cycles.filter(c => c === 'STALL').length;
                const effective_start = i + stall_prefix;
                const stage_idx = cycle - effective_start;

                if (cycle < i) { ps.cycles.push(null); continue; }

                if (detectHaz && stage_idx === 1) {
                    const haz = PipelineWidget._detectHazard(instructions, i);
                    if (haz && (!forwarding || haz.requiresStall)) {
                        ps.cycles.push('STALL');
                        stalls++;
                        hazardLog.push({ kind: 'stall', msg: `Cycle ${cycle}: ${haz.message} → stall` });
                        anyActive = true;
                        continue;
                    } else if (haz && forwarding && !haz.requiresStall) {
                        forwarded++;
                        hazardLog.push({ kind: 'forwarded', msg: `Cycle ${cycle}: ${haz.message} → forwarding` });
                    }
                }

                if (stage_idx >= 0 && stage_idx < STAGES.length) {
                    ps.cycles.push(STAGES[stage_idx]);
                    anyActive = true;
                } else if (stage_idx >= STAGES.length) {
                    ps.cycles.push(null);
                } else {
                    ps.cycles.push(null);
                }
            }
            if (!anyActive && cycle > n + 2) break;
        }
        return { pipeline, stalls, forwarded, hazardLog };
    }

    static ensureStyles() {
        if (PipelineWidget._stylesInjected) return;
        PipelineWidget._stylesInjected = true;
        const css = `
.plw { font-family: inherit; display: flex; flex-direction: column; gap: 10px; }
.plw-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.plw-select { font-size: 0.82rem; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; background: var(--surface, #fff); color: var(--text, #222); }
.plw-opts { display: flex; gap: 10px; align-items: center; font-size: 0.82rem; }
.plw-opts label { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.plw-btns { display: flex; gap: 6px; margin-left: auto; }
.plw-btn { font-size: 0.82rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--surface, #f5f5f5); color: var(--text, #222); cursor: pointer; }
.plw-btn.primary { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.plw-grid-wrap { overflow-x: auto; }
.plw-grid { display: grid; gap: 2px; width: max-content; }
.plw-grid-hdr { display: contents; }
.plw-cell { height: 28px; min-width: 42px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; border-radius: 4px; padding: 0 4px; }
.plw-cell.inst-lbl { background: transparent; color: var(--text, #222); font-size: 0.72rem; min-width: 100px; justify-content: flex-start; font-weight: 600; }
.plw-cell.cy-lbl { background: transparent; color: var(--muted, #888); font-size: 0.7rem; font-weight: 500; }
.plw-cell.empty { background: transparent; }
.plw-cell.IF  { background: #6366f1; color: #fff; }
.plw-cell.ID  { background: #8b5cf6; color: #fff; }
.plw-cell.EX  { background: #f59e0b; color: #fff; }
.plw-cell.MEM { background: #06b6d4; color: #fff; }
.plw-cell.WB  { background: #22c55e; color: #fff; }
.plw-cell.STALL { background: #ef4444; color: #fff; font-size: 0.65rem; }
.plw-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.82rem; }
.plw-stat { display: flex; flex-direction: column; align-items: center; }
.plw-sv { font-size: 1.1rem; font-weight: 700; color: var(--primary, #6366f1); }
.plw-sl { color: var(--muted, #888); font-size: 0.75rem; }
.plw-hazlog { display: flex; flex-direction: column; gap: 2px; max-height: 100px; overflow-y: auto; }
.plw-hz { font-size: 0.77rem; padding: 2px 6px; border-radius: 4px; }
.plw-hz.stall { background: rgba(239,68,68,0.1); color: #dc2626; }
.plw-hz.forwarded { background: rgba(34,197,94,0.1); color: #16a34a; }
.plw-section-lbl { font-size: 0.78rem; font-weight: 700; color: var(--muted, #888); }
`;
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        PipelineWidget.ensureStyles();
        if (container.dataset.plw) return;
        container.dataset.plw = '1';
        new PipelineWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.instructions = PipelineWidget._EXAMPLES.simple.slice();
        this.detectHaz = true;
        this.forwarding = true;
        this.cycle = 0;
        this.traceData = null;
        this.running = false;
    }

    init() {
        this.root.innerHTML = `<div class="plw">
  <div class="plw-toolbar">
    <select class="plw-select" data-ex>
      <option value="simple">Exemple simple</option>
      <option value="hazard">Aléas RAW</option>
      <option value="load">Load-use</option>
    </select>
    <div class="plw-opts">
      <label><input type="checkbox" data-haz checked> Détecter aléas</label>
      <label><input type="checkbox" data-fwd checked> Forwarding</label>
    </div>
    <div class="plw-btns">
      <button class="plw-btn" data-step>Cycle suivant</button>
      <button class="plw-btn primary" data-run>▶ Exécuter</button>
      <button class="plw-btn" data-reset>↺ Reset</button>
    </div>
  </div>
  <div class="plw-section-lbl">Diagramme pipeline</div>
  <div class="plw-grid-wrap"><div class="plw-grid" data-grid></div></div>
  <div class="plw-stats">
    <div class="plw-stat"><span class="plw-sv" data-sc>0</span><span class="plw-sl">Cycles</span></div>
    <div class="plw-stat"><span class="plw-sv" data-sco>0</span><span class="plw-sl">Terminées</span></div>
    <div class="plw-stat"><span class="plw-sv" data-ss>0</span><span class="plw-sl">Stalls</span></div>
    <div class="plw-stat"><span class="plw-sv" data-sf>0</span><span class="plw-sl">Forwarded</span></div>
    <div class="plw-stat"><span class="plw-sv" data-scpi>--</span><span class="plw-sl">CPI</span></div>
  </div>
  <div class="plw-section-lbl" data-hz-title style="display:none">Journal des aléas</div>
  <div class="plw-hazlog" data-hazlog></div>
</div>`;
        this._bind();
        this._recompute();
        this._renderGrid();
        this._renderStats();
    }

    _q(s) { return this.root.querySelector(s); }

    _bind() {
        this._q('[data-ex]').addEventListener('change', e => {
            this.instructions = PipelineWidget._EXAMPLES[e.target.value].slice();
            this._reset();
        });
        this._q('[data-haz]').addEventListener('change', e => { this.detectHaz = e.target.checked; this._reset(); });
        this._q('[data-fwd]').addEventListener('change', e => { this.forwarding = e.target.checked; this._reset(); });
        this._q('[data-step]').addEventListener('click', () => this._step());
        this._q('[data-run]').addEventListener('click', () => this._toggleRun());
        this._q('[data-reset]').addEventListener('click', () => this._reset());
    }

    _recompute() {
        this.traceData = PipelineWidget._computeTrace(this.instructions, this.detectHaz, this.forwarding);
        this.maxCycles = Math.max(...this.traceData.pipeline.map(p => p.cycles.length));
    }

    _reset() {
        this.running = false;
        this._q('[data-run]').textContent = '▶ Exécuter';
        this.cycle = 0;
        this._recompute();
        this._renderGrid();
        this._renderStats();
    }

    _step() {
        if (this.running) return;
        if (this.cycle < this.maxCycles) { this.cycle++; this._renderGrid(); this._renderStats(); }
    }

    async _toggleRun() {
        if (this.running) { this.running = false; this._q('[data-run]').textContent = '▶ Exécuter'; return; }
        this.running = true;
        this._q('[data-run]').textContent = '⏸ Pause';
        while (this.running && this.cycle < this.maxCycles) {
            this.cycle++;
            this._renderGrid();
            this._renderStats();
            await new Promise(r => setTimeout(r, 500));
        }
        this.running = false;
        this._q('[data-run]').textContent = '▶ Exécuter';
    }

    _renderGrid() {
        const grid = this._q('[data-grid]');
        const { pipeline } = this.traceData;
        const visibleCycles = this.cycle;
        const maxC = Math.max(visibleCycles, 1);
        const cols = 1 + maxC;
        grid.style.gridTemplateColumns = `100px repeat(${maxC}, 42px)`;
        grid.innerHTML = '';

        // Header row
        const hdr = document.createElement('div');
        hdr.className = 'plw-cell cy-lbl';
        hdr.textContent = 'Instruction';
        grid.appendChild(hdr);
        for (let c = 0; c < maxC; c++) {
            const lbl = document.createElement('div');
            lbl.className = 'plw-cell cy-lbl';
            lbl.textContent = 'C' + c;
            grid.appendChild(lbl);
        }

        // Instruction rows
        pipeline.forEach(ps => {
            const lbl = document.createElement('div');
            lbl.className = 'plw-cell inst-lbl';
            lbl.textContent = ps.inst;
            grid.appendChild(lbl);
            for (let c = 0; c < maxC; c++) {
                const cell = document.createElement('div');
                const stage = ps.cycles[c];
                if (stage) {
                    cell.className = `plw-cell ${stage}`;
                    cell.textContent = stage;
                } else {
                    cell.className = 'plw-cell empty';
                }
                grid.appendChild(cell);
            }
        });
    }

    _renderStats() {
        const { pipeline, stalls, forwarded, hazardLog } = this.traceData;
        const completed = pipeline.filter(p => p.cycles.slice(0, this.cycle).includes('WB')).length;
        const cpi = completed > 0 ? (this.cycle / completed).toFixed(2) : '--';
        this._q('[data-sc]').textContent = this.cycle;
        this._q('[data-sco]').textContent = completed;
        this._q('[data-ss]').textContent = stalls;
        this._q('[data-sf]').textContent = forwarded;
        this._q('[data-scpi]').textContent = cpi;

        const hzTitle = this._q('[data-hz-title]');
        const hzLog = this._q('[data-hazlog]');
        if (hazardLog.length > 0) {
            hzTitle.style.display = '';
            hzLog.innerHTML = hazardLog.map(h =>
                `<div class="plw-hz ${h.kind}">${h.msg}</div>`
            ).join('');
        } else {
            hzTitle.style.display = 'none';
            hzLog.innerHTML = '';
        }
    }
}

if (typeof window !== 'undefined') {
    window.PipelineWidget = PipelineWidget;
}
