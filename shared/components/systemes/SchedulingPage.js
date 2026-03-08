class SchedulingPage extends ConceptPage {
    async init() {
        await super.init();
    const pageData = this.data || {};
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function explainLine(lineId) {
        const output = document.getElementById('explain-output');
        if (!output) return;
        const entry = (pageData.explanations && pageData.explanations.byLineId)
            ? pageData.explanations.byLineId[lineId]
            : null;
        if (!entry) {
            output.textContent = 'Aucune explication disponible pour ' + lineId + '.';
            return;
        }
        output.innerHTML =
            '<strong>Quoi ?</strong> ' + escapeHtml(entry.what || '') +
            '<br><strong>Pourquoi ?</strong> ' + escapeHtml(entry.why || '');
    }
    const COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316','#14b8a6','#6366f1'];
    const ALGO_NAMES = { fcfs: 'FCFS', sjf: 'SJF', rr: 'Round Robin', priority: 'Priorite' };

    let processes = [];
    let pidCounter = 1;
    let currentMode = 'single';

    // --- Process Management ---
    function getProcesses() {
        const rows = document.querySelectorAll('#processBody tr');
        const procs = [];
        rows.forEach((row, idx) => {
            const inputs = row.querySelectorAll('input');
            procs.push({
                name: inputs[0].value || ('P' + (idx+1)),
                arrival: parseInt(inputs[1].value) || 0,
                burst: Math.max(1, parseInt(inputs[2].value) || 1),
                priority: parseInt(inputs[3].value) || 0,
                color: COLORS[idx % COLORS.length],
                id: idx
            });
        });
        return procs;
    }

    function renderProcessTable() {
        const tbody = document.getElementById('processBody');
        tbody.innerHTML = '';
        processes.forEach((p, idx) => {
            const color = COLORS[idx % COLORS.length];
            tbody.innerHTML += `<tr>
                <td><span class="color-dot" style="background:${color}"></span></td>
                <td><input type="text" value="${p.name}"></td>
                <td><input type="number" value="${p.arrival}" min="0"></td>
                <td><input type="number" value="${p.burst}" min="1"></td>
                <td><input type="number" value="${p.priority}" min="0"></td>
                <td><button class="btn-remove" onclick="removeProcess(${idx})" title="Supprimer">&times;</button></td>
            </tr>`;
        });
    }

    function addProcess() {
        processes.push({ name: 'P' + pidCounter++, arrival: 0, burst: 1, priority: 0 });
        renderProcessTable();
    }

    function removeProcess(idx) {
        processes.splice(idx, 1);
        renderProcessTable();
    }

    function loadExample() {
        processes = [
            { name: 'P1', arrival: 0, burst: 5, priority: 2 },
            { name: 'P2', arrival: 1, burst: 3, priority: 1 },
            { name: 'P3', arrival: 2, burst: 8, priority: 4 },
            { name: 'P4', arrival: 3, burst: 2, priority: 3 },
            { name: 'P5', arrival: 4, burst: 4, priority: 0 }
        ];
        pidCounter = 6;
        renderProcessTable();
    }

    // --- Algorithm implementations ---
    function scheduleFCFS(procs) {
        const sorted = [...procs].sort((a, b) => a.arrival - b.arrival || a.id - b.id);
        const schedule = [];
        let time = 0;
        const completion = {};
        sorted.forEach(p => {
            if (time < p.arrival) {
                schedule.push({ name: 'Idle', start: time, end: p.arrival, color: null, idle: true });
                time = p.arrival;
            }
            schedule.push({ name: p.name, start: time, end: time + p.burst, color: p.color, id: p.id });
            time += p.burst;
            completion[p.id] = time;
        });
        return { schedule, completion };
    }

    function scheduleSJF(procs) {
        const remaining = procs.map(p => ({ ...p, rem: p.burst }));
        const schedule = [];
        let time = 0;
        const completion = {};
        const done = new Set();
        const maxTime = procs.reduce((s, p) => s + p.burst + p.arrival, 0) + 10;

        while (done.size < procs.length && time < maxTime) {
            const available = remaining.filter(p => p.arrival <= time && !done.has(p.id));
            if (available.length === 0) {
                const nextArr = remaining.filter(p => !done.has(p.id)).reduce((m, p) => Math.min(m, p.arrival), Infinity);
                schedule.push({ name: 'Idle', start: time, end: nextArr, color: null, idle: true });
                time = nextArr;
                continue;
            }
            available.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);
            const chosen = available[0];
            schedule.push({ name: chosen.name, start: time, end: time + chosen.burst, color: chosen.color, id: chosen.id });
            time += chosen.burst;
            completion[chosen.id] = time;
            done.add(chosen.id);
        }
        return { schedule, completion };
    }

    function scheduleRR(procs, quantum) {
        const queue = [];
        const remaining = procs.map(p => ({ ...p, rem: p.burst }));
        remaining.sort((a, b) => a.arrival - b.arrival);
        const schedule = [];
        let time = 0;
        const completion = {};
        const inQueue = new Set();
        let idx = 0;
        const maxTime = procs.reduce((s, p) => s + p.burst + p.arrival, 0) + 10;

        // Add initial processes
        while (idx < remaining.length && remaining[idx].arrival <= time) {
            queue.push(remaining[idx]);
            inQueue.add(remaining[idx].id);
            idx++;
        }

        while ((queue.length > 0 || idx < remaining.length) && time < maxTime) {
            if (queue.length === 0) {
                const nextArr = remaining[idx].arrival;
                schedule.push({ name: 'Idle', start: time, end: nextArr, color: null, idle: true });
                time = nextArr;
                while (idx < remaining.length && remaining[idx].arrival <= time) {
                    if (!inQueue.has(remaining[idx].id)) {
                        queue.push(remaining[idx]);
                        inQueue.add(remaining[idx].id);
                    }
                    idx++;
                }
                continue;
            }
            const current = queue.shift();
            const execTime = Math.min(quantum, current.rem);
            schedule.push({ name: current.name, start: time, end: time + execTime, color: current.color, id: current.id });
            time += execTime;
            current.rem -= execTime;

            // Add newly arrived processes before re-adding current
            while (idx < remaining.length && remaining[idx].arrival <= time) {
                if (!inQueue.has(remaining[idx].id)) {
                    queue.push(remaining[idx]);
                    inQueue.add(remaining[idx].id);
                }
                idx++;
            }

            if (current.rem > 0) {
                queue.push(current);
            } else {
                completion[current.id] = time;
            }
        }
        return { schedule, completion };
    }

    function schedulePriority(procs) {
        const remaining = procs.map(p => ({ ...p }));
        const schedule = [];
        let time = 0;
        const completion = {};
        const done = new Set();
        const maxTime = procs.reduce((s, p) => s + p.burst + p.arrival, 0) + 10;

        while (done.size < procs.length && time < maxTime) {
            const available = remaining.filter(p => p.arrival <= time && !done.has(p.id));
            if (available.length === 0) {
                const nextArr = remaining.filter(p => !done.has(p.id)).reduce((m, p) => Math.min(m, p.arrival), Infinity);
                schedule.push({ name: 'Idle', start: time, end: nextArr, color: null, idle: true });
                time = nextArr;
                continue;
            }
            // Lower number = higher priority
            available.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival);
            const chosen = available[0];
            schedule.push({ name: chosen.name, start: time, end: time + chosen.burst, color: chosen.color, id: chosen.id });
            time += chosen.burst;
            completion[chosen.id] = time;
            done.add(chosen.id);
        }
        return { schedule, completion };
    }

    function runAlgorithm(algo, procs, quantum) {
        switch (algo) {
            case 'fcfs': return scheduleFCFS(procs);
            case 'sjf': return scheduleSJF(procs);
            case 'rr': return scheduleRR(procs, quantum);
            case 'priority': return schedulePriority(procs);
        }
    }

    function computeMetrics(procs, completion) {
        let totalWait = 0, totalTurnaround = 0;
        const details = [];
        let totalBurst = 0, maxTime = 0;
        procs.forEach(p => {
            const ct = completion[p.id] || 0;
            const tat = ct - p.arrival;
            const wt = tat - p.burst;
            totalWait += wt;
            totalTurnaround += tat;
            totalBurst += p.burst;
            maxTime = Math.max(maxTime, ct);
            details.push({ name: p.name, arrival: p.arrival, burst: p.burst, completion: ct, turnaround: tat, waiting: wt, color: p.color });
        });
        return {
            avgWait: (totalWait / procs.length).toFixed(2),
            avgTurnaround: (totalTurnaround / procs.length).toFixed(2),
            cpuUtil: maxTime > 0 ? ((totalBurst / maxTime) * 100).toFixed(1) : '0',
            details
        };
    }

    // --- Rendering ---
    async function renderGantt(schedule, chartId, timelineId, animated) {
        const chart = document.getElementById(chartId);
        const timeline = document.getElementById(timelineId);
        chart.innerHTML = '';
        timeline.innerHTML = '';

        if (animated) {
            for (let i = 0; i < schedule.length; i++) {
                const s = schedule[i];
                const duration = s.end - s.start;
                const block = document.createElement('div');
                block.className = 'gantt-block' + (s.idle ? ' idle' : '');
                block.style.minWidth = (duration * 40) + 'px';
                block.style.background = s.idle ? '' : s.color;
                block.innerHTML = `<span>${s.name}</span><span class="gantt-label">${s.start}-${s.end}</span>`;
                chart.appendChild(block);
                await sleep(300);
            }
        } else {
            schedule.forEach(s => {
                const duration = s.end - s.start;
                const block = document.createElement('div');
                block.className = 'gantt-block' + (s.idle ? ' idle' : '');
                block.style.minWidth = (duration * 40) + 'px';
                block.style.background = s.idle ? '' : s.color;
                block.innerHTML = `<span>${s.name}</span><span class="gantt-label">${s.start}-${s.end}</span>`;
                chart.appendChild(block);
            });
        }

        // Timeline markers
        const times = new Set();
        schedule.forEach(s => { times.add(s.start); times.add(s.end); });
        const sortedTimes = [...times].sort((a,b) => a-b);
        schedule.forEach(s => {
            const span = document.createElement('span');
            span.style.minWidth = ((s.end - s.start) * 40) + 'px';
            span.textContent = s.start;
            timeline.appendChild(span);
        });
        if (schedule.length > 0) {
            const last = document.createElement('span');
            last.textContent = schedule[schedule.length-1].end;
            last.style.minWidth = '20px';
            timeline.appendChild(last);
        }
    }

    function renderMetrics(metrics, gridId, tableId) {
        const grid = document.getElementById(gridId);
        grid.innerHTML = `
            <div class="metric-card">
                <div class="metric-value">${metrics.avgWait}</div>
                <div class="metric-label">Temps d'attente moyen</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.avgTurnaround}</div>
                <div class="metric-label">Temps de s&eacute;jour moyen</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.cpuUtil}%</div>
                <div class="metric-label">Utilisation CPU</div>
            </div>`;

        const table = document.getElementById(tableId);
        table.style.display = 'table';
        table.innerHTML = `<thead><tr>
            <th></th><th>Processus</th><th>Arriv&eacute;e</th><th>Dur&eacute;e</th>
            <th>Compl&eacute;tion</th><th>S&eacute;jour</th><th>Attente</th>
        </tr></thead><tbody>` +
        metrics.details.map(d => `<tr>
            <td><span class="color-dot" style="background:${d.color}"></span></td>
            <td>${d.name}</td><td>${d.arrival}</td><td>${d.burst}</td>
            <td>${d.completion}</td><td>${d.turnaround}</td><td>${d.waiting}</td>
        </tr>`).join('') + `</tbody>`;
    }

    function renderReadyQueue(schedule, procs, queueId) {
        const queue = document.getElementById(queueId);
        if (!schedule || schedule.length === 0) { queue.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Aucun processus</span>'; return; }
        // Show ready queue at the last time step
        const lastTime = schedule[schedule.length - 1].end;
        const arrived = procs.filter(p => p.arrival <= lastTime);
        const running = schedule.length > 0 ? schedule[schedule.length - 1] : null;
        const completed = new Set();
        schedule.forEach(s => { if (!s.idle) completed.add(s.id); });
        // Show arrived but not yet completed (simplified for final state)
        queue.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Simulation termin&eacute;e</span>';
    }

    function renderPseudocode(algo, highlightLines) {
        const container = document.getElementById('pseudocode-container');
        if (!container) return;

        const blocks = pageData.pseudocode || pageData.pseudoCode || [];
        const block = blocks.find((b) => b.name === algo) || blocks[0];
        if (!block || !Array.isArray(block.lines)) {
            container.innerHTML = '';
            return;
        }

        const html = block.lines.map((line, i) => {
            const id = algo + '-line' + (i + 1);
            const hl = highlightLines && highlightLines.includes(i) ? ' highlight' : '';
            const content = (typeof PseudocodeSupport !== 'undefined')
                ? PseudocodeSupport.renderLineContent(line, {
                    autoKeywordHighlight: true,
                    domain: pageData?.metadata?.category
                })
                : escapeHtml(line);
            return '<span class="line line-clickable' + hl + '" id="' + id + '">' + content + '</span>';
        }).join('');
        container.innerHTML = '<div class="card algorithm-code">' + html + '</div>';

        container.querySelectorAll('.line[id]').forEach((lineEl) => {
            lineEl.addEventListener('click', () => {
                container.querySelectorAll('.line.inspected').forEach((n) => n.classList.remove('inspected'));
                lineEl.classList.add('inspected');
                explainLine(lineEl.id);
            });
        });
    }

    // --- UI Logic ---
    function onAlgoChange() {
        const algo = document.getElementById('algoSelect').value;
        document.getElementById('quantumGroup').style.display = algo === 'rr' ? '' : 'none';
        renderPseudocode(algo);
    }

    function onAlgoChange2() {
        const algo = document.getElementById('algoSelect2').value;
        document.getElementById('quantumGroup2').style.display = algo === 'rr' ? '' : 'none';
    }

    function switchTab(mode, el) {
        currentMode = mode;
        document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('compareConfig').style.display = mode === 'compare' ? '' : 'none';
        document.getElementById('resultSingle').style.display = mode === 'single' ? '' : 'none';
        document.getElementById('resultCompare').style.display = mode === 'compare' ? '' : 'none';
    }

    async function runSimulation() {
        const procs = getProcesses();
        if (procs.length === 0) return;

        const algo1 = document.getElementById('algoSelect').value;
        const q1 = parseInt(document.getElementById('quantumInput').value) || 2;

        if (currentMode === 'single') {
            const result = runAlgorithm(algo1, procs, q1);
            const metrics = computeMetrics(procs, result.completion);

            document.getElementById('ganttCard').style.display = '';
            await renderGantt(result.schedule, 'ganttChart', 'ganttTimeline', true);
            renderMetrics(metrics, 'metricsGrid', 'detailTable');
            renderReadyQueue(result.schedule, procs, 'readyQueue');
            renderPseudocode(algo1, [0, 1, 2, 3, 6, 7, 8]);
        } else {
            const algo2 = document.getElementById('algoSelect2').value;
            const q2 = parseInt(document.getElementById('quantumInput2').value) || 3;

            const resultA = runAlgorithm(algo1, procs, q1);
            const resultB = runAlgorithm(algo2, procs, q2);
            const metricsA = computeMetrics(procs, resultA.completion);
            const metricsB = computeMetrics(procs, resultB.completion);

            document.getElementById('compareTitleA').textContent = ALGO_NAMES[algo1] + (algo1 === 'rr' ? ' (Q=' + q1 + ')' : '');
            document.getElementById('compareTitleB').textContent = ALGO_NAMES[algo2] + (algo2 === 'rr' ? ' (Q=' + q2 + ')' : '');

            await Promise.all([
                renderGantt(resultA.schedule, 'ganttChartA', 'ganttTimelineA', false),
                renderGantt(resultB.schedule, 'ganttChartB', 'ganttTimelineB', false)
            ]);
            renderMetrics(metricsA, 'metricsGridA', 'detailTableA');
            renderMetrics(metricsB, 'metricsGridB', 'detailTableB');
            renderPseudocode(algo1, [0, 1, 2, 3]);
        }
    }

    function resetSimulation() {
        document.getElementById('ganttCard').style.display = 'none';
        document.getElementById('ganttChart').innerHTML = '';
        document.getElementById('ganttTimeline').innerHTML = '';
        document.getElementById('metricsGrid').innerHTML = '';
        document.getElementById('detailTable').style.display = 'none';
        document.getElementById('readyQueue').innerHTML = '';
        document.getElementById('ganttChartA').innerHTML = '';
        document.getElementById('ganttChartB').innerHTML = '';
        document.getElementById('metricsGridA').innerHTML = '';
        document.getElementById('metricsGridB').innerHTML = '';
        document.getElementById('detailTableA').innerHTML = '';
        document.getElementById('detailTableB').innerHTML = '';
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // --- Init ---
    loadExample();
    onAlgoChange();
    renderPseudocode('fcfs');
        window.addProcess = addProcess;
        window.loadExample = loadExample;
        window.onAlgoChange = onAlgoChange;
        window.onAlgoChange2 = onAlgoChange2;
        window.runSimulation = runSimulation;
        window.resetSimulation = resetSimulation;
        window.switchTab = switchTab;
        window.removeProcess = removeProcess;
    }
}

if (typeof window !== 'undefined') {
    window.SchedulingPage = SchedulingPage;
}

// ─────────────────────────────────────────────────────────────────────────────
// SchedulingWidget — Widget autonome pour intégration dans les slides
// Usage : SchedulingWidget.mount(container, { algorithm: 'fcfs'|'sjf'|'rr'|'priority', quantum: 2 })
// ─────────────────────────────────────────────────────────────────────────────
class SchedulingWidget {
    static _stylesInjected = false;
    static _COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316'];

    static ensureStyles() {
        if (SchedulingWidget._stylesInjected) return;
        SchedulingWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.schw-container{display:flex;flex-direction:column;gap:8px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.schw-header{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.schw-algo-bar{display:flex;gap:5px;flex-wrap:wrap;}
.schw-algo-btn{padding:3px 9px;border:1px solid rgba(255,255,255,.15);border-radius:12px;cursor:pointer;font-size:.66rem;background:transparent;color:var(--sl-text,#e2e8f0);transition:all .15s;}
.schw-algo-btn.active,.schw-algo-btn:hover{background:var(--sl-primary,#6366f1);border-color:var(--sl-primary,#6366f1);color:#fff;}
.schw-quantum-row{display:flex;align-items:center;gap:6px;font-size:.7rem;color:var(--sl-muted,#94a3b8);}
.schw-quantum-input{width:40px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:2px 6px;font-size:.72rem;color:var(--sl-text,#e2e8f0);text-align:center;}
.schw-proc-table{font-size:.68rem;border-collapse:collapse;width:100%;}
.schw-proc-table th{color:var(--sl-muted,#94a3b8);font-weight:600;padding:2px 6px;text-align:left;}
.schw-proc-table td{padding:2px 6px;}
.schw-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;}
.schw-gantt-zone{overflow-x:auto;}
.schw-gantt{display:flex;gap:1px;min-height:28px;align-items:stretch;}
.schw-gblock{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:24px;border-radius:3px;font-size:.6rem;font-weight:700;color:#fff;padding:0 3px;position:relative;}
.schw-gblock.idle{background:rgba(255,255,255,.1);color:var(--sl-muted,#94a3b8);}
.schw-gtick{display:flex;gap:1px;font-size:.56rem;color:var(--sl-muted,#94a3b8);margin-top:2px;}
.schw-gtick span{text-align:left;}
.schw-metrics{display:flex;gap:6px;flex-wrap:wrap;font-size:.68rem;}
.schw-metric{background:rgba(255,255,255,.06);border-radius:4px;padding:3px 8px;}
.schw-metric strong{color:var(--sl-accent,#f97316);}
.schw-controls{display:flex;gap:6px;flex-wrap:wrap;}
.schw-btn{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.schw-btn:hover{opacity:.8;}
.schw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        SchedulingWidget.ensureStyles();
        const w = new SchedulingWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._algo = config.algorithm || 'fcfs';
        this._quantum = config.quantum || 2;
        this._procs = config.processes || [
            { name: 'P1', arrival: 0, burst: 5, priority: 2 },
            { name: 'P2', arrival: 1, burst: 3, priority: 1 },
            { name: 'P3', arrival: 2, burst: 8, priority: 4 },
            { name: 'P4', arrival: 3, burst: 2, priority: 3 }
        ];
    }

    // ── Pure scheduling algorithms (no DOM) ──────────────────────────────────
    static _fcfs(procs) {
        const sorted = [...procs].sort((a,b)=>a.arrival-b.arrival);
        let t = 0; const sched = [], comp = {};
        sorted.forEach(p => {
            if (t < p.arrival) { sched.push({name:'Idle',start:t,end:p.arrival,idle:true}); t=p.arrival; }
            sched.push({name:p.name,start:t,end:t+p.burst,color:p.color,id:p.id});
            comp[p.id] = t += p.burst;
        });
        return {sched,comp};
    }

    static _sjf(procs) {
        const rem = procs.map(p=>({...p})); let t=0; const sched=[],comp={},done=new Set();
        const max = procs.reduce((s,p)=>s+p.burst+p.arrival,0)+10;
        while (done.size<procs.length && t<max) {
            const avail = rem.filter(p=>p.arrival<=t&&!done.has(p.id));
            if (!avail.length) { const nx=rem.filter(p=>!done.has(p.id)).reduce((m,p)=>Math.min(m,p.arrival),Infinity); sched.push({name:'Idle',start:t,end:nx,idle:true}); t=nx; continue; }
            avail.sort((a,b)=>a.burst-b.burst);
            const p=avail[0]; sched.push({name:p.name,start:t,end:t+p.burst,color:p.color,id:p.id});
            comp[p.id]=t+=p.burst; done.add(p.id);
        }
        return {sched,comp};
    }

    static _rr(procs, q) {
        const rem=procs.map(p=>({...p,r:p.burst})).sort((a,b)=>a.arrival-b.arrival);
        const queue=[]; let t=0,idx=0; const sched=[],comp={},inQ=new Set();
        const max=procs.reduce((s,p)=>s+p.burst+p.arrival,0)+10;
        while(idx<rem.length&&rem[idx].arrival<=t){queue.push(rem[idx]);inQ.add(rem[idx].id);idx++;}
        while((queue.length||idx<rem.length)&&t<max){
            if(!queue.length){const nx=rem[idx].arrival;sched.push({name:'Idle',start:t,end:nx,idle:true});t=nx;while(idx<rem.length&&rem[idx].arrival<=t){if(!inQ.has(rem[idx].id)){queue.push(rem[idx]);inQ.add(rem[idx].id);}idx++;}continue;}
            const cur=queue.shift(); const ex=Math.min(q,cur.r);
            sched.push({name:cur.name,start:t,end:t+ex,color:cur.color,id:cur.id}); t+=ex; cur.r-=ex;
            while(idx<rem.length&&rem[idx].arrival<=t){if(!inQ.has(rem[idx].id)){queue.push(rem[idx]);inQ.add(rem[idx].id);}idx++;}
            if(cur.r>0) queue.push(cur); else comp[cur.id]=t;
        }
        return {sched,comp};
    }

    static _priority(procs) {
        const rem=procs.map(p=>({...p})); let t=0; const sched=[],comp={},done=new Set();
        const max=procs.reduce((s,p)=>s+p.burst+p.arrival,0)+10;
        while(done.size<procs.length&&t<max){
            const avail=rem.filter(p=>p.arrival<=t&&!done.has(p.id));
            if(!avail.length){const nx=rem.filter(p=>!done.has(p.id)).reduce((m,p)=>Math.min(m,p.arrival),Infinity);sched.push({name:'Idle',start:t,end:nx,idle:true});t=nx;continue;}
            avail.sort((a,b)=>a.priority-b.priority||a.arrival-b.arrival);
            const p=avail[0]; sched.push({name:p.name,start:t,end:t+p.burst,color:p.color,id:p.id});
            comp[p.id]=t+=p.burst; done.add(p.id);
        }
        return {sched,comp};
    }

    static _metrics(procs, comp) {
        let tw=0,tt=0,maxT=0; const bTotal=procs.reduce((s,p)=>s+p.burst,0);
        procs.forEach(p=>{const ct=comp[p.id]||0;const tat=ct-p.arrival;tw+=tat-p.burst;tt+=tat;maxT=Math.max(maxT,ct);});
        return { avgWait:(tw/procs.length).toFixed(1), avgTat:(tt/procs.length).toFixed(1),
            util: maxT>0?((bTotal/maxT)*100).toFixed(0):'0' };
    }

    _run() {
        const algos = {fcfs:SchedulingWidget._fcfs, sjf:SchedulingWidget._sjf,
            rr:(p)=>SchedulingWidget._rr(p,this._quantum), priority:SchedulingWidget._priority};
        const fn = algos[this._algo] || algos.fcfs;
        const procs = this._procs.map((p,i) => ({...p, id:i, color:SchedulingWidget._COLORS[i%8]}));
        const {sched, comp} = fn(procs);
        const metrics = SchedulingWidget._metrics(procs, comp);
        this._renderGantt(sched);
        this._renderMetrics(metrics);
    }

    init() {
        const LABELS = {fcfs:'FCFS',sjf:'SJF',rr:'Round Robin',priority:'Priorite'};
        this.root.innerHTML = `<div class="schw-container">
            <div class="schw-header"><span>Ordonnancement</span></div>
            <div class="schw-algo-bar">
                ${Object.entries(LABELS).map(([k,v])=>
                    `<button class="schw-algo-btn${k===this._algo?' active':''}" data-algo="${k}">${v}</button>`
                ).join('')}
            </div>
            <div class="schw-quantum-row schw-rr-row" style="${this._algo==='rr'?'':'display:none'}">
                Quantum : <input type="number" class="schw-quantum-input" value="${this._quantum}" min="1" max="10">
            </div>
            <table class="schw-proc-table">
                <thead><tr><th></th><th>Proc.</th><th>Arr.</th><th>Exec.</th><th>Prio.</th></tr></thead>
                <tbody class="schw-proc-body">
                ${this._procs.map((p,i)=>{
                    const c=SchedulingWidget._COLORS[i%8];
                    return `<tr><td><span class="schw-dot" style="background:${c}"></span></td><td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority??0}</td></tr>`;
                }).join('')}
                </tbody>
            </table>
            <div class="schw-gantt-zone"><div class="schw-gantt"></div><div class="schw-gtick"></div></div>
            <div class="schw-metrics"></div>
            <div class="schw-controls">
                <button class="schw-btn schw-btn-run">&#9654; Simuler</button>
                <button class="schw-btn schw-btn-example schw-btn-secondary">Exemple</button>
            </div>
        </div>`;
        this._bindControls();
        this._run();
    }

    _renderGantt(sched) {
        const gantt = this.root.querySelector('.schw-gantt');
        const ticks = this.root.querySelector('.schw-gtick');
        if (!gantt) return;
        const scale = 22;
        gantt.innerHTML = sched.map(s => {
            const w = Math.max(scale, (s.end-s.start)*scale);
            return `<div class="schw-gblock${s.idle?' idle':''}" style="${s.idle?'':'background:'+s.color};min-width:${w}px">
                <span>${s.name}</span>
                <span style="font-size:.5rem;opacity:.8">${s.start}-${s.end}</span>
            </div>`;
        }).join('');
        if (ticks) {
            const times = [...new Set(sched.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b);
            ticks.innerHTML = times.map(t=>`<span style="min-width:${scale}px">${t}</span>`).join('');
        }
    }

    _renderMetrics(m) {
        const el = this.root.querySelector('.schw-metrics');
        if (el) el.innerHTML = [
            ['Attente moy.', m.avgWait + ' u.'],
            ['Retour moy.', m.avgTat + ' u.'],
            ['Utilisation CPU', m.util + '%']
        ].map(([l,v])=>`<div class="schw-metric">${l} : <strong>${v}</strong></div>`).join('');
    }

    _bindControls() {
        this.root.querySelectorAll('.schw-algo-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._algo = btn.dataset.algo;
                this.root.querySelectorAll('.schw-algo-btn').forEach(b=>b.classList.toggle('active', b===btn));
                const rrRow = this.root.querySelector('.schw-rr-row');
                if (rrRow) rrRow.style.display = this._algo==='rr' ? 'flex' : 'none';
                this._run();
            });
        });
        this.root.querySelector('.schw-quantum-input')?.addEventListener('input', e => {
            this._quantum = Math.max(1, parseInt(e.target.value)||1);
            if (this._algo==='rr') this._run();
        });
        this.root.querySelector('.schw-btn-run')?.addEventListener('click', () => this._run());
        this.root.querySelector('.schw-btn-example')?.addEventListener('click', () => {
            this._procs = [
                {name:'P1',arrival:0,burst:5,priority:2},{name:'P2',arrival:1,burst:3,priority:1},
                {name:'P3',arrival:2,burst:8,priority:4},{name:'P4',arrival:3,burst:2,priority:3}
            ];
            const tbody = this.root.querySelector('.schw-proc-body');
            if (tbody) tbody.innerHTML = this._procs.map((p,i)=>{
                const c=SchedulingWidget._COLORS[i%8];
                return `<tr><td><span class="schw-dot" style="background:${c}"></span></td><td>${p.name}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority}</td></tr>`;
            }).join('');
            this._run();
        });
    }
}

if (typeof window !== 'undefined') {
    window.SchedulingWidget = SchedulingWidget;
}
