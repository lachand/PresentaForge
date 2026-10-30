/**
 * SchedulingPage / SchedulingWidget : les deux affichent le planning calculé par le moteur pur
 * `algorithms/scheduling-engine.js` (relecture 3b, B3, OR-I1, OR-I2) ; aucun ordonnanceur ici.
 */
class SchedulingPage extends ConceptPage {
    static COLORS = ['var(--accent)', 'var(--ok)', 'var(--attention)', 'var(--critique)', 'var(--cote)', 'var(--ink-muted)', 'var(--production)', 'var(--consommation)'];
    static ALGO_NAMES = { fcfs: 'FCFS', sjf: 'SJF', srtf: 'SRTF', rr: 'Round Robin', priority: 'Priorité' };

    async init() {
        await super.init();
        this.processes = [];
        this.pidCounter = 1;
        this.currentMode = 'single';
        this.loadExample('course');
        this.onAlgoChange();
        this.onAlgoChange2();
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    static fmt(x, digits = 2) {
        return Number(x).toFixed(digits).replace('.', ',');
    }

    // --- Table des processus ---
    readProcesses() {
        const rows = document.querySelectorAll('#processBody tr');
        const procs = [];
        rows.forEach((row, idx) => {
            const inputs = row.querySelectorAll('input');
            procs.push({
                name: inputs[0].value || ('P' + (idx + 1)),
                arrival: parseInt(inputs[1].value, 10) || 0,
                burst: Math.max(1, parseInt(inputs[2].value, 10) || 1),
                priority: parseInt(inputs[3].value, 10) || 0
            });
        });
        return procs;
    }

    renderProcessTable() {
        const esc = SchedulingPage.escapeHtml;
        document.getElementById('processBody').innerHTML = this.processes.map((p, idx) => `<tr>
                <td><span class="color-dot" style="background:${SchedulingPage.COLORS[idx % 8]}"></span></td>
                <td><input type="text" value="${esc(p.name)}" aria-label="Nom"></td>
                <td><input type="number" value="${Number(p.arrival)}" min="0" aria-label="Arrivée"></td>
                <td><input type="number" value="${Number(p.burst)}" min="1" aria-label="Durée"></td>
                <td><input type="number" value="${Number(p.priority)}" min="0" aria-label="Priorité"></td>
                <td><button class="btn-remove" data-inline-onclick="page.removeProcess(${idx})" title="Supprimer">&times;</button></td>
            </tr>`).join('');
    }

    addProcess() {
        this.processes = this.readProcesses();
        this.processes.push({ name: 'P' + this.pidCounter++, arrival: 0, burst: 1, priority: 0 });
        this.renderProcessTable();
    }

    removeProcess(idx) {
        this.processes = this.readProcesses();
        this.processes.splice(idx, 1);
        this.renderProcessTable();
    }

    loadExample(name) {
        const src = name === 'staggered' ? OEITrace.SCHEDULER_STAGGERED_EXAMPLE : OEITrace.SCHEDULER_COURSE_EXAMPLE;
        this.processes = src.map((p) => Object.assign({}, p));
        this.pidCounter = this.processes.length + 1;
        this.renderProcessTable();
        if (name === 'staggered') {
            document.getElementById('algoSelect').value = 'srtf';
            document.getElementById('algoSelect2').value = 'sjf';
            this.onAlgoChange();
            this.onAlgoChange2();
        }
    }

    // --- Options ---
    optionsFor(suffix) {
        const algo = document.getElementById('algoSelect' + suffix).value;
        return {
            algo: algo,
            quantum: parseInt(document.getElementById('quantumInput' + suffix).value, 10) || 2,
            aging: !!document.getElementById('agingInput' + suffix).checked,
            agingEvery: parseInt(document.getElementById('agingEvery' + suffix).value, 10) || 5
        };
    }

    toggleAlgoGroups(suffix) {
        const algo = document.getElementById('algoSelect' + suffix).value;
        document.getElementById('quantumGroup' + suffix).style.display = algo === 'rr' ? '' : 'none';
        document.getElementById('agingGroup' + suffix).style.display = algo === 'priority' ? '' : 'none';
    }

    onAlgoChange() {
        this.toggleAlgoGroups('');
        this.renderPseudocode(this.optionsFor('').algo);
    }

    onAlgoChange2() {
        this.toggleAlgoGroups('2');
    }

    switchTab(mode, el) {
        this.currentMode = mode;
        document.querySelectorAll('.tab-bar .tab').forEach((t) => t.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('compareConfig').style.display = mode === 'compare' ? '' : 'none';
        document.getElementById('resultSingle').style.display = mode === 'single' ? '' : 'none';
        document.getElementById('resultCompare').style.display = mode === 'compare' ? '' : 'none';
    }

    // --- Rendu ---
    async renderGantt(result, chartId, timelineId, animated) {
        const chart = document.getElementById(chartId);
        const timeline = document.getElementById(timelineId);
        chart.innerHTML = '';
        timeline.innerHTML = '';
        let prevId = -1;
        for (const s of result.slices) {
            const block = document.createElement('div');
            const isSwitch = !s.idle && prevId !== -1 && prevId !== s.id;
            block.className = 'gantt-block' + (s.idle ? ' idle' : '') + (isSwitch ? ' switch' : '');
            block.style.minWidth = ((s.end - s.start) * 40) + 'px';
            if (!s.idle) block.style.background = SchedulingPage.COLORS[s.id % 8];
            if (isSwitch) block.title = 'Changement de contexte';
            const name = document.createElement('span');
            name.textContent = s.name;
            const label = document.createElement('span');
            label.className = 'gantt-label';
            label.textContent = s.start + '-' + s.end;
            block.append(name, label);
            chart.appendChild(block);
            if (!s.idle) prevId = s.id;
            if (animated) await new Promise((r) => setTimeout(r, 300));
        }
        result.slices.forEach((s) => {
            const span = document.createElement('span');
            span.style.minWidth = ((s.end - s.start) * 40) + 'px';
            span.textContent = s.start;
            timeline.appendChild(span);
        });
        if (result.slices.length) {
            const last = document.createElement('span');
            last.textContent = result.slices[result.slices.length - 1].end;
            last.style.minWidth = '20px';
            timeline.appendChild(last);
        }
    }

    renderMetrics(result, gridId, tableId) {
        const f = SchedulingPage.fmt;
        const cards = [
            [f(result.avgWait), 'Temps d\'attente moyen'],
            [f(result.avgTurnaround), 'Temps de séjour moyen'],
            [f(result.avgResponse), 'Temps de réponse moyen'],
            [String(result.contextSwitches), 'Changements de contexte'],
            [f(result.cpuUtil * 100, 1) + ' %', 'Utilisation CPU']
        ];
        document.getElementById(gridId).innerHTML = cards.map(([v, l]) => `<div class="metric-card">
                <div class="metric-value">${v}</div>
                <div class="metric-label">${l}</div>
            </div>`).join('');
        const table = document.getElementById(tableId);
        table.style.display = 'table';
        table.innerHTML = `<thead><tr>
            <th></th><th>Processus</th><th>Arrivée</th><th>Durée</th>
            <th>Fin</th><th>Séjour</th><th>Attente</th><th>Réponse</th>
        </tr></thead><tbody>` + result.processes.map((d) => `<tr>
            <td><span class="color-dot" style="background:${SchedulingPage.COLORS[d.id % 8]}"></span></td>
            <td>${SchedulingPage.escapeHtml(d.name)}</td><td>${d.arrival}</td><td>${d.burst}</td>
            <td>${d.completion}</td><td>${d.turnaround}</td><td>${d.waiting}</td><td>${d.response}</td>
        </tr>`).join('') + '</tbody>';
    }

    renderPseudocode(algo) {
        const container = document.getElementById('pseudocode-container');
        if (!container) return;
        const blocks = this.data.pseudocode || [];
        const block = blocks.find((b) => b.name === algo) || blocks[0];
        if (!block || !Array.isArray(block.lines)) {
            container.innerHTML = '';
            return;
        }
        const html = block.lines.map((line, i) => {
            const content = (typeof PseudocodeSupport !== 'undefined')
                ? PseudocodeSupport.renderLineContent(line, { autoKeywordHighlight: true, domain: this.data.metadata && this.data.metadata.category })
                : SchedulingPage.escapeHtml(line);
            return '<span class="line line-clickable" id="' + block.name + '-line' + (i + 1) + '">' + content + '</span>';
        }).join('');
        container.innerHTML = '<div class="card algorithm-code">' + html + '</div>';
        container.querySelectorAll('.line[id]').forEach((lineEl) => {
            lineEl.addEventListener('click', () => {
                container.querySelectorAll('.line.inspected').forEach((n) => n.classList.remove('inspected'));
                lineEl.classList.add('inspected');
                this.explainLine(lineEl.id);
            });
        });
    }

    explainLine(lineId) {
        const output = document.getElementById('explain-output');
        if (!output) return;
        const entry = this.data.explanations && this.data.explanations.byLineId ? this.data.explanations.byLineId[lineId] : null;
        if (!entry) {
            output.textContent = 'Aucune explication disponible pour ' + lineId + '.';
            return;
        }
        const esc = SchedulingPage.escapeHtml;
        output.innerHTML = '<strong>Quoi ?</strong> ' + esc(entry.what || '') + '<br><strong>Pourquoi ?</strong> ' + esc(entry.why || '');
    }

    title(opts) {
        let t = SchedulingPage.ALGO_NAMES[opts.algo];
        if (opts.algo === 'rr') t += ' (quantum ' + opts.quantum + ')';
        if (opts.algo === 'priority' && opts.aging) t += ' avec aging (tous les ' + opts.agingEvery + ')';
        return t;
    }

    async runSimulation() {
        const procs = this.readProcesses();
        if (!procs.length) return;
        const optsA = this.optionsFor('');
        const resultA = OEITrace.schedulerRun(procs, optsA);
        if (this.currentMode === 'single') {
            document.getElementById('ganttCard').style.display = '';
            await this.renderGantt(resultA, 'ganttChart', 'ganttTimeline', true);
            this.renderMetrics(resultA, 'metricsGrid', 'detailTable');
        } else {
            const optsB = this.optionsFor('2');
            const resultB = OEITrace.schedulerRun(procs, optsB);
            document.getElementById('compareTitleA').textContent = this.title(optsA);
            document.getElementById('compareTitleB').textContent = this.title(optsB);
            await Promise.all([
                this.renderGantt(resultA, 'ganttChartA', 'ganttTimelineA', false),
                this.renderGantt(resultB, 'ganttChartB', 'ganttTimelineB', false)
            ]);
            this.renderMetrics(resultA, 'metricsGridA', 'detailTableA');
            this.renderMetrics(resultB, 'metricsGridB', 'detailTableB');
        }
        this.renderPseudocode(optsA.algo);
    }

    resetSimulation() {
        document.getElementById('ganttCard').style.display = 'none';
        ['ganttChart', 'ganttTimeline', 'metricsGrid', 'ganttChartA', 'ganttChartB', 'metricsGridA', 'metricsGridB', 'detailTableA', 'detailTableB']
            .forEach((id) => { document.getElementById(id).innerHTML = ''; });
        document.getElementById('detailTable').style.display = 'none';
    }
}

if (typeof window !== 'undefined') {
    window.SchedulingPage = SchedulingPage;
}

// ─────────────────────────────────────────────────────────────────────────────
// SchedulingWidget - Widget autonome pour intégration dans les slides
// Usage : SchedulingWidget.mount(container, { algorithm: 'fcfs'|'sjf'|'srtf'|'rr'|'priority', quantum: 2, example: 'course'|'staggered' })
// ─────────────────────────────────────────────────────────────────────────────
class SchedulingWidget {
    static LABELS = { fcfs: 'FCFS', sjf: 'SJF', srtf: 'SRTF', rr: 'Round Robin', priority: 'Priorité' };

    static mount(container, config = {}) {
        const w = new SchedulingWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._algo = SchedulingWidget.LABELS[config.algorithm] ? config.algorithm : 'fcfs';
        this._quantum = config.quantum || 2;
        this._aging = config.aging === true;
        this._procs = config.processes || (config.example === 'staggered' ? OEITrace.SCHEDULER_STAGGERED_EXAMPLE : OEITrace.SCHEDULER_COURSE_EXAMPLE).map((p) => Object.assign({}, p));
    }

    init() {
        this.root.innerHTML = `<div class="schw-container widget-fit">
            <div class="widget-fit-header">
                <div class="schw-header"><span>Ordonnancement</span></div>
                <div class="schw-algo-bar">
                    ${Object.entries(SchedulingWidget.LABELS).map(([k, v]) =>
                        `<button class="schw-algo-btn${k === this._algo ? ' active' : ''}" data-algo="${k}">${v}</button>`).join('')}
                </div>
                <div class="schw-quantum-row schw-rr-row" style="${this._algo === 'rr' ? '' : 'display:none'}">
                    Quantum : <input type="number" class="schw-quantum-input" value="${this._quantum}" min="1" max="10" aria-label="Quantum">
                </div>
                <label class="schw-quantum-row schw-aging-row" style="${this._algo === 'priority' ? '' : 'display:none'}">
                    <input type="checkbox" class="schw-aging-input"${this._aging ? ' checked' : ''}> Aging (un cran toutes les 5 unités d'attente)
                </label>
            </div>
            <div class="widget-fit-body">
                <table class="schw-proc-table">
                    <thead><tr><th></th><th>Proc.</th><th>Arr.</th><th>Durée</th><th>Prio.</th></tr></thead>
                    <tbody class="schw-proc-body"></tbody>
                </table>
                <div class="schw-gantt-zone"><div class="schw-gantt"></div><div class="schw-gtick"></div></div>
            </div>
            <div class="widget-fit-footer">
                <div class="schw-metrics"></div>
                <div class="schw-controls">
                    <button class="schw-btn schw-btn-example schw-btn-secondary" data-example="course">Exemple du cours</button>
                    <button class="schw-btn schw-btn-example schw-btn-secondary" data-example="staggered">Arrivées décalées</button>
                </div>
            </div>
        </div>`;
        this._renderProcs();
        this._bindControls();
        this._run();
    }

    _renderProcs() {
        const tbody = this.root.querySelector('.schw-proc-body');
        tbody.innerHTML = '';
        this._procs.forEach((p, i) => {
            const tr = document.createElement('tr');
            const dot = document.createElement('td');
            const span = document.createElement('span');
            span.className = 'schw-dot';
            span.style.background = SchedulingPage.COLORS[i % 8];
            dot.appendChild(span);
            tr.appendChild(dot);
            [p.name, p.arrival, p.burst, p.priority ?? 0].forEach((v) => {
                const td = document.createElement('td');
                td.textContent = v;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    _run() {
        const result = OEITrace.schedulerRun(this._procs, { algo: this._algo, quantum: this._quantum, aging: this._aging, agingEvery: 5 });
        this._renderGantt(result);
        this._renderMetrics(result);
    }

    _renderGantt(result) {
        const gantt = this.root.querySelector('.schw-gantt');
        const ticks = this.root.querySelector('.schw-gtick');
        const scale = 22;
        gantt.innerHTML = '';
        ticks.innerHTML = '';
        let prevId = -1;
        result.slices.forEach((s) => {
            const block = document.createElement('div');
            const isSwitch = !s.idle && prevId !== -1 && prevId !== s.id;
            block.className = 'schw-gblock' + (s.idle ? ' idle' : '') + (isSwitch ? ' switch' : '');
            block.style.minWidth = Math.max(scale, (s.end - s.start) * scale) + 'px';
            if (!s.idle) block.style.background = SchedulingPage.COLORS[s.id % 8];
            const name = document.createElement('span');
            name.textContent = s.name;
            const range = document.createElement('span');
            range.className = 'schw-grange';
            range.textContent = s.start + '-' + s.end;
            block.append(name, range);
            gantt.appendChild(block);
            if (!s.idle) prevId = s.id;
            const tick = document.createElement('span');
            tick.style.minWidth = Math.max(scale, (s.end - s.start) * scale) + 'px';
            tick.textContent = s.start;
            ticks.appendChild(tick);
        });
        if (result.slices.length) {
            const last = document.createElement('span');
            last.textContent = result.slices[result.slices.length - 1].end;
            ticks.appendChild(last);
        }
    }

    _renderMetrics(r) {
        const f = SchedulingPage.fmt;
        const el = this.root.querySelector('.schw-metrics');
        el.innerHTML = '';
        [
            ['Attente moy.', f(r.avgWait)],
            ['Séjour moy.', f(r.avgTurnaround)],
            ['Réponse moy.', f(r.avgResponse)],
            ['Changements de contexte', String(r.contextSwitches)],
            ['CPU', f(r.cpuUtil * 100, 0) + ' %']
        ].forEach(([label, value]) => {
            const div = document.createElement('div');
            div.className = 'schw-metric';
            div.append(label + ' : ');
            const strong = document.createElement('strong');
            strong.textContent = value;
            div.appendChild(strong);
            el.appendChild(div);
        });
    }

    _bindControls() {
        this.root.querySelectorAll('.schw-algo-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this._algo = btn.dataset.algo;
                this.root.querySelectorAll('.schw-algo-btn').forEach((b) => b.classList.toggle('active', b === btn));
                this.root.querySelector('.schw-rr-row').style.display = this._algo === 'rr' ? 'flex' : 'none';
                this.root.querySelector('.schw-aging-row').style.display = this._algo === 'priority' ? 'flex' : 'none';
                this._run();
            });
        });
        this.root.querySelector('.schw-quantum-input').addEventListener('input', (e) => {
            this._quantum = Math.max(1, parseInt(e.target.value, 10) || 1);
            if (this._algo === 'rr') this._run();
        });
        this.root.querySelector('.schw-aging-input').addEventListener('change', (e) => {
            this._aging = e.target.checked;
            this._run();
        });
        this.root.querySelectorAll('.schw-btn-example').forEach((btn) => {
            btn.addEventListener('click', () => {
                const staggered = btn.dataset.example === 'staggered';
                this._procs = (staggered ? OEITrace.SCHEDULER_STAGGERED_EXAMPLE : OEITrace.SCHEDULER_COURSE_EXAMPLE).map((p) => Object.assign({}, p));
                this._renderProcs();
                this._run();
            });
        });
    }
}

if (typeof window !== 'undefined') {
    window.SchedulingWidget = SchedulingWidget;
}
