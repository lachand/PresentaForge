class BellmanFordPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);

        this.nodes = [
            { id: 'A', x: 80, y: 90 },
            { id: 'B', x: 240, y: 70 },
            { id: 'C', x: 390, y: 95 },
            { id: 'D', x: 120, y: 280 },
            { id: 'E', x: 300, y: 300 },
            { id: 'F', x: 500, y: 240 }
        ];

        this.baseEdges = [
            { from: 'A', to: 'B', w: 6 },
            { from: 'A', to: 'C', w: 5 },
            { from: 'A', to: 'D', w: 5 },
            { from: 'B', to: 'E', w: -1 },
            { from: 'C', to: 'B', w: -2 },
            { from: 'C', to: 'E', w: 1 },
            { from: 'D', to: 'C', w: -2 },
            { from: 'D', to: 'F', w: -1 },
            { from: 'E', to: 'F', w: 3 }
        ];

        this.negativeCycleEdge = { from: 'E', to: 'D', w: -2 };

        this.edges = [];
        this.dist = {};
        this.pred = {};
        this.iteration = 1;
        this.edgeIndex = 0;
        this.phase = 'idle';
        this.currentEdge = null;
        this.edgeStates = {};
        this.cycleDetected = false;
        this.logs = [];

        this.speedCtrl = null;
        this.autoTimer = null;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.graph = new GraphVisualizer('bf-graph-svg', {
            weighted: true,
            nodeRadius: 22,
            distanceOffsetY: 38,
            weightOffset: 14
        });

        this.cacheDom();
        this.bindEvents();
        this.populateSources();
        this.refreshEdges();
        this.resetAlgorithm();
    }

    cacheDom() {
        this.sourceSelect = document.getElementById('bf-source-select');
        this.toggleNegativeCycle = document.getElementById('bf-negative-cycle');
        this.btnStart = document.getElementById('bf-start');
        this.btnStep = document.getElementById('bf-step');
        this.btnAuto = document.getElementById('bf-auto');
        this.btnReset = document.getElementById('bf-reset');

        this.iterationOutput = document.getElementById('bf-iteration');
        this.iterationMaxOutput = document.getElementById('bf-total-iterations');
        this.currentEdgeOutput = document.getElementById('bf-current-edge');
        this.cycleStatus = document.getElementById('bf-cycle-status');
        this.feedback = document.getElementById('bf-feedback');

        this.distBody = document.getElementById('bf-distances-body');
        this.edgesBody = document.getElementById('bf-edges-body');
        this.logOutput = document.getElementById('bf-log');
    }

    bindEvents() {
        this.btnStart.addEventListener('click', () => this.initializeRun());
        this.btnStep.addEventListener('click', () => this.step());
        this.btnAuto.addEventListener('click', () => this.toggleAuto());
        this.btnReset.addEventListener('click', () => this.resetAlgorithm());

        this.sourceSelect.addEventListener('change', () => this.resetAlgorithm());
        this.toggleNegativeCycle.addEventListener('change', () => {
            this.refreshEdges();
            this.resetAlgorithm();
        });
    }

    populateSources() {
        this.sourceSelect.innerHTML = this.nodes
            .map((node) => `<option value="${this.escapeHtml(node.id)}">${this.escapeHtml(node.id)}</option>`)
            .join('');
        this.sourceSelect.value = 'A';
    }

    refreshEdges() {
        this.edges = this.baseEdges.slice();
        if (this.toggleNegativeCycle.checked) {
            this.edges.push({ ...this.negativeCycleEdge });
        }
        this.graph.setGraph(this.nodes, this.edges);
    }

    sourceNode() {
        return this.sourceSelect.value || this.nodes[0].id;
    }

    totalIterations() {
        return Math.max(this.nodes.length - 1, 0);
    }

    distanceText(value) {
        return value === Infinity ? '∞' : String(value);
    }

    addLog(message, type = 'info') {
        this.logs.unshift({ message, type });
        this.logs = this.logs.slice(0, 25);
    }

    setFeedback(message, type) {
        this.feedback.className = `feedback ${type || ''}`;
        this.feedback.textContent = message;
    }

    resetAlgorithm() {
        this.stopAuto();
        this.phase = 'idle';
        this.iteration = 1;
        this.edgeIndex = 0;
        this.currentEdge = null;
        this.edgeStates = {};
        this.cycleDetected = false;
        this.logs = [];

        const source = this.sourceNode();
        this.nodes.forEach((node) => {
            this.dist[node.id] = Infinity;
            this.pred[node.id] = null;
        });
        this.dist[source] = 0;

        this.addLog(`Etat initial: dist(${source}) = 0, autres = ∞.`, 'info');
        this.setFeedback('Pret: cliquez sur Initialiser ou Etape pour demarrer les relaxations.', 'info');
        this.render();
    }

    initializeRun() {
        this.stopAuto();
        this.phase = 'relax';
        this.iteration = 1;
        this.edgeIndex = 0;
        this.currentEdge = null;
        this.edgeStates = {};
        this.cycleDetected = false;

        const source = this.sourceNode();
        this.nodes.forEach((node) => {
            this.dist[node.id] = Infinity;
            this.pred[node.id] = null;
        });
        this.dist[source] = 0;

        this.logs = [];
        this.addLog(`Demarrage Bellman-Ford depuis ${source}.`, 'warn');
        this.setFeedback('Relaxations en cours.', 'info');
        this.render();
    }

    relaxEdge(edge) {
        const fromDist = this.dist[edge.from];
        const key = this.graph.edgeKey(edge.from, edge.to);

        this.edgeStates = {};
        this.edgeStates[key] = 'active';

        if (fromDist === Infinity) {
            this.addLog(`It ${this.iteration}: ${edge.from} -> ${edge.to} ignoree (source inatteignable).`, 'info');
            return;
        }

        const alt = fromDist + edge.w;
        if (alt < this.dist[edge.to]) {
            this.dist[edge.to] = alt;
            this.pred[edge.to] = edge.from;
            this.edgeStates[key] = 'relaxing';
            this.addLog(
                `It ${this.iteration}: relaxation ${edge.from} -> ${edge.to}, nouvelle dist=${alt}.`,
                'ok'
            );
            return;
        }

        this.addLog(
            `It ${this.iteration}: ${edge.from} -> ${edge.to}, pas d amelioration (${this.distanceText(this.dist[edge.to])}).`,
            'info'
        );
    }

    checkNegativeCycle() {
        const cycleEdge = this.edges.find((edge) => {
            const fromDist = this.dist[edge.from];
            if (fromDist === Infinity) return false;
            return fromDist + edge.w < this.dist[edge.to];
        });

        if (cycleEdge) {
            this.cycleDetected = true;
            this.edgeStates = {};
            this.edgeStates[this.graph.edgeKey(cycleEdge.from, cycleEdge.to)] = 'relaxing';
            this.addLog(
                `Detection cycle negatif via ${cycleEdge.from} -> ${cycleEdge.to} (amelioration encore possible).`,
                'bad'
            );
            this.setFeedback('Cycle negatif detecte: les plus courts chemins ne sont plus definis.', 'bad');
            return;
        }

        this.cycleDetected = false;
        this.addLog('Aucune amelioration supplementaire: pas de cycle negatif atteignable.', 'ok');
        this.setFeedback('Execution terminee: distances stables.', 'ok');
    }

    step() {
        if (this.phase === 'idle') {
            this.initializeRun();
            return true;
        }

        if (this.phase === 'done') {
            this.setFeedback('Algorithme deja termine. Reset ou changez les options.', 'warning');
            return false;
        }

        if (this.phase === 'relax') {
            this.currentEdge = this.edges[this.edgeIndex] || null;
            if (this.currentEdge) {
                this.relaxEdge(this.currentEdge);
            }

            this.edgeIndex += 1;
            if (this.edgeIndex >= this.edges.length) {
                this.edgeIndex = 0;
                this.iteration += 1;
                if (this.iteration > this.totalIterations()) {
                    this.phase = 'check';
                    this.addLog('Fin des N-1 iterations, verification du cycle negatif...', 'warn');
                }
            }

            this.render();
            return true;
        }

        if (this.phase === 'check') {
            this.checkNegativeCycle();
            this.phase = 'done';
            this.render();
            return false;
        }

        return false;
    }

    toggleAuto() {
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }

        this.btnAuto.textContent = 'Pause';
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    autoLoop() {
        if (!this.autoTimer) return;
        const keepRunning = this.step();
        if (!keepRunning) {
            this.stopAuto();
            return;
        }
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    stopAuto() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.btnAuto.textContent = 'Lecture auto';
    }

    renderGraph() {
        const source = this.sourceNode();
        const nodeStates = {};

        this.nodes.forEach((node) => {
            if (this.dist[node.id] !== Infinity) {
                nodeStates[node.id] = 'visited';
            }
            if (node.id === source) {
                nodeStates[node.id] = 'source';
            }
        });

        if (this.currentEdge) {
            nodeStates[this.currentEdge.from] = 'current';
            nodeStates[this.currentEdge.to] = 'processing';
        }

        const badges = {};
        this.nodes.forEach((node) => {
            badges[node.id] = this.distanceText(this.dist[node.id]);
        });

        this.graph.render({
            nodeStates,
            edgeStates: this.edgeStates,
            nodeBadges: badges
        });
    }

    renderDistancesTable() {
        this.distBody.innerHTML = this.nodes
            .map((node) => {
                const dist = this.dist[node.id];
                const isInfinity = dist === Infinity;
                const pred = this.pred[node.id] || '-';
                return `
                    <tr>
                        <td><strong>${this.escapeHtml(node.id)}</strong></td>
                        <td class="${isInfinity ? 'bf-dist-infinity' : ''}">${this.escapeHtml(this.distanceText(dist))}</td>
                        <td>${this.escapeHtml(pred)}</td>
                    </tr>
                `;
            })
            .join('');
    }

    renderEdgesTable() {
        const active = this.currentEdge ? `${this.currentEdge.from}->${this.currentEdge.to}` : '';
        this.edgesBody.innerHTML = this.edges
            .map((edge) => {
                const edgeId = `${edge.from}->${edge.to}`;
                const cls = active === edgeId ? 'bf-edge-active' : '';
                return `
                    <tr class="${cls}">
                        <td><code>${this.escapeHtml(edgeId)}</code></td>
                        <td><code>${this.escapeHtml(edge.w)}</code></td>
                    </tr>
                `;
            })
            .join('');
    }

    renderLogs() {
        this.logOutput.innerHTML = this.logs
            .map((entry) => `<li class="mod-log-item ${this.escapeHtml(entry.type)}">${this.escapeHtml(entry.message)}</li>`)
            .join('');
    }

    renderCycleStatus() {
        if (this.phase !== 'done') {
            this.cycleStatus.className = 'mod-status info';
            this.cycleStatus.textContent = 'Non verifie';
            return;
        }

        if (this.cycleDetected) {
            this.cycleStatus.className = 'mod-status bad';
            this.cycleStatus.textContent = 'Detecte';
            return;
        }

        this.cycleStatus.className = 'mod-status ok';
        this.cycleStatus.textContent = 'Absent';
    }

    render() {
        this.iterationOutput.textContent = String(Math.min(this.iteration - 1, this.totalIterations()));
        this.iterationMaxOutput.textContent = String(this.totalIterations());
        this.currentEdgeOutput.textContent = this.currentEdge
            ? `${this.currentEdge.from} -> ${this.currentEdge.to} (w=${this.currentEdge.w})`
            : '-';

        this.renderCycleStatus();
        this.renderGraph();
        this.renderDistancesTable();
        this.renderEdgesTable();
        this.renderLogs();
    }
}

if (typeof window !== 'undefined') {
    window.BellmanFordPage = BellmanFordPage;
}
