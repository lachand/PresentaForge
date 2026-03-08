class DijkstraPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);

        this.nodes = [
            { id: 'A', x: 70, y: 80 },
            { id: 'B', x: 190, y: 40 },
            { id: 'C', x: 320, y: 35 },
            { id: 'D', x: 450, y: 80 },
            { id: 'E', x: 90, y: 200 },
            { id: 'F', x: 230, y: 180 },
            { id: 'G', x: 360, y: 180 },
            { id: 'H', x: 500, y: 210 },
            { id: 'I', x: 190, y: 340 },
            { id: 'J', x: 360, y: 340 }
        ];

        this.edges = [
            { from: 'A', to: 'B', w: 4 },
            { from: 'A', to: 'E', w: 3 },
            { from: 'A', to: 'F', w: 8 },
            { from: 'B', to: 'C', w: 2 },
            { from: 'B', to: 'F', w: 4 },
            { from: 'B', to: 'E', w: 5 },
            { from: 'C', to: 'D', w: 3 },
            { from: 'C', to: 'F', w: 3 },
            { from: 'C', to: 'G', w: 5 },
            { from: 'D', to: 'G', w: 2 },
            { from: 'D', to: 'H', w: 4 },
            { from: 'E', to: 'F', w: 2 },
            { from: 'E', to: 'I', w: 4 },
            { from: 'F', to: 'G', w: 2 },
            { from: 'F', to: 'I', w: 3 },
            { from: 'F', to: 'J', w: 7 },
            { from: 'G', to: 'H', w: 3 },
            { from: 'G', to: 'J', w: 3 },
            { from: 'H', to: 'J', w: 4 },
            { from: 'I', to: 'J', w: 2 }
        ];

        this.dist = {};
        this.pred = {};
        this.visited = new Set();
        this.pq = [];
        this.currentNode = null;
        this.currentNeighbors = [];
        this.neighborIdx = 0;
        this.phase = 'idle';
        this.stepCount = 0;
        this.relaxCount = 0;
        this.running = false;
        this.edgeStates = {};
        this.pathEdges = new Set();
        this.pqOps = [];
        this.runSource = null;
        this.runDest = null;
    }

    async init() {
        await super.init();

        this.speedCtrl = this.createSpeedController('speed-slider', 'speed-label');
        this.graph = new GraphVisualizer('graph-svg', {
            weighted: true,
            nodeRadius: 22,
            distanceOffsetY: 38,
            weightOffset: 14
        });
        this.graph.setGraph(this.nodes, this.edges);

        this.cacheDom();
        this.renderPseudocodeFromData();
        this.bindPseudocodeInspector();
        this.bindEvents();
        this.initSelectors();
        this.resetAll();
    }

    cacheDom() {
        this.sourceSelect = document.getElementById('source-select');
        this.destSelect = document.getElementById('dest-select');
        this.btnRun = document.getElementById('btn-run');
        this.btnStep = document.getElementById('btn-step');
        this.btnReset = document.getElementById('btn-reset');
        this.feedback = document.getElementById('feedback');
        this.pqList = document.getElementById('pq-list');
        this.pqHistoryEl = document.getElementById('pq-history');
        this.distTbody = document.getElementById('dist-tbody');
        this.statStep = document.getElementById('stat-step');
        this.statVisited = document.getElementById('stat-visited');
        this.statRelax = document.getElementById('stat-relax');
        this.explainOutput = document.getElementById('explain-output');
    }

    bindEvents() {
        this.btnRun.addEventListener('click', () => this.runAuto());
        this.btnStep.addEventListener('click', () => this.stepOnce());
        this.btnReset.addEventListener('click', () => this.resetAll());

        this.sourceSelect.addEventListener('change', () => {
            if (this.phase === 'idle') this.renderGraph();
        });
    }

    getSource() {
        return this.sourceSelect.value;
    }

    getDest() {
        return this.destSelect.value;
    }

    initSelectors() {
        this.sourceSelect.innerHTML = '';
        this.destSelect.innerHTML = '';

        this.nodes.forEach((node) => {
            const sourceOption = document.createElement('option');
            sourceOption.value = node.id;
            sourceOption.textContent = node.id;
            this.sourceSelect.appendChild(sourceOption);

            const destOption = document.createElement('option');
            destOption.value = node.id;
            destOption.textContent = node.id;
            this.destSelect.appendChild(destOption);
        });

        this.sourceSelect.value = this.nodes[0].id;
        this.destSelect.value = this.nodes[this.nodes.length - 1].id;
    }

    neighbors(nodeId) {
        const result = [];
        this.edges.forEach((edge) => {
            if (edge.from === nodeId) result.push({ node: edge.to, weight: edge.w });
            if (edge.to === nodeId) result.push({ node: edge.from, weight: edge.w });
        });
        return result;
    }

    edgeKey(a, b) {
        return this.graph.edgeKey(a, b);
    }

    highlightLines(...ids) {
        this.clearHighlight();
        ids.forEach((id) => {
            const line = document.getElementById(id);
            if (line) line.classList.add('highlight');
        });
    }

    clearHighlight() {
        document.querySelectorAll('.algorithm-code .line.highlight').forEach((line) => line.classList.remove('highlight'));
    }

    renderPseudocodeFromData() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (_block, _idx, lineNumber) => 'dline' + lineNumber
        });
    }

    bindPseudocodeInspector() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.bindLineInspector(this.data, {
            containerId: 'pseudocode-container',
            explainOutput: this.explainOutput,
            clickTitle: 'Cliquer pour expliquer cette ligne'
        });
    }

    selectExplainedLine(lineId) {
        document.querySelectorAll('.algorithm-code .line.inspected').forEach((line) => {
            line.classList.remove('inspected');
        });

        const line = document.getElementById(lineId);
        if (line) line.classList.add('inspected');
        this.explainLine(lineId);
    }

    explainLine(lineId) {
        if (!this.explainOutput) return;
        const line = document.getElementById(lineId);
        const lineText = line ? line.textContent.trim() : lineId;
        const explanation = (typeof PseudocodeSupport !== 'undefined')
            ? PseudocodeSupport.resolveExplanation(this.data, lineId, lineText)
            : { what: lineText, why: '' };
        this.explainOutput.innerHTML =
            '<strong>Quoi ?</strong> ' + this.escapeHtml(explanation.what) +
            '<br><strong>Pourquoi ?</strong> ' + this.escapeHtml(explanation.why);
    }

    setFeedback(message, type) {
        this.feedback.textContent = message;
        this.feedback.className = 'feedback ' + (type || '');
    }

    resetState() {
        this.dist = {};
        this.pred = {};
        this.visited = new Set();
        this.pq = [];
        this.currentNode = null;
        this.currentNeighbors = [];
        this.neighborIdx = 0;
        this.phase = 'idle';
        this.stepCount = 0;
        this.relaxCount = 0;
        this.edgeStates = {};
        this.pathEdges = new Set();
        this.pqOps = [];
        this.runSource = null;
        this.runDest = null;
        this.clearHighlight();

        this.nodes.forEach((node) => {
            this.dist[node.id] = Infinity;
            this.pred[node.id] = null;
        });
    }

    resetAll() {
        this.running = false;
        this.resetState();
        this.renderAll();
        this.setFeedback('Sélectionnez une source et lancez l\'algorithme.', 'info');
        this.btnRun.disabled = false;
        this.btnStep.disabled = false;
    }

    isOnFinalPath(nodeId) {
        if (this.phase !== 'done') return false;

        const destination = this.runDest || this.getDest();
        let current = destination;
        while (current) {
            if (current === nodeId) return true;
            current = this.pred[current];
        }
        return false;
    }

    renderGraph() {
        const nodeStates = {};

        this.nodes.forEach((node) => {
            if (this.pathEdges.size > 0 && this.isOnFinalPath(node.id)) {
                nodeStates[node.id] = 'path';
            } else if (node.id === (this.runSource || this.getSource()) && this.phase !== 'idle') {
                nodeStates[node.id] = 'source';
            } else if (node.id === this.currentNode) {
                nodeStates[node.id] = 'current';
            } else if (this.visited.has(node.id)) {
                nodeStates[node.id] = 'visited';
            }
        });

        this.graph.render({
            edgeStates: this.edgeStates,
            nodeStates,
            pathEdges: this.pathEdges,
            distances: this.dist,
            showDistances: this.phase !== 'idle'
        });
    }

    renderPQ() {
        if (this.pq.length === 0) {
            this.pqList.innerHTML = '<div style="color:var(--muted); font-size:0.85rem; text-align:center; padding:0.5rem;">Vide</div>';
            return;
        }

        const sorted = [...this.pq].sort((a, b) => a.d - b.d);
        this.pqList.innerHTML = sorted.map((item, index) => {
            return '<div class="pq-item' + (index === 0 ? ' current' : '') + '">' +
                '<span>Sommet ' + item.node + '</span>' +
                '<span style="font-family:var(--font-mono);">' + item.d + '</span>' +
                '</div>';
        }).join('');
    }

    formatDistance(value) {
        return value === Infinity ? '∞' : String(value);
    }

    pushPQHistory(action, node, distance, detail = '') {
        this.pqOps.unshift({
            action,
            node,
            distance,
            detail
        });
        if (this.pqOps.length > 18) {
            this.pqOps.length = 18;
        }
    }

    renderPQHistory() {
        if (!this.pqHistoryEl || typeof this.pqHistoryEl.innerHTML === 'undefined') return;
        if (!this.pqOps.length) {
            this.pqHistoryEl.innerHTML = '<div style="color:var(--muted); font-size:0.8rem; text-align:center; padding:0.35rem;">Aucune operation.</div>';
            return;
        }

        this.pqHistoryEl.innerHTML = this.pqOps.map((entry) => {
            const actionClass = entry.action || '';
            const detail = entry.detail ? ` · ${entry.detail}` : '';
            return '<div class="pq-history-item ' + actionClass + '">' +
                '<span class="pq-history-action">' + this.escapeHtml(entry.action.toUpperCase()) + '</span>' +
                '<span class="pq-history-node">Noeud ' + this.escapeHtml(entry.node) + ' (d=' + this.escapeHtml(this.formatDistance(entry.distance)) + ')' + this.escapeHtml(detail) + '</span>' +
                '</div>';
        }).join('');
    }

    renderDistTable() {
        this.distTbody.innerHTML = this.nodes.map((node) => {
            let rowClass = '';
            if (this.visited.has(node.id)) rowClass = 'finalized';
            else if (node.id === this.currentNode) rowClass = 'updated';

            return '<tr class="' + rowClass + '">' +
                '<td style="font-weight:700;">' + node.id + '</td>' +
                '<td style="font-family:var(--font-mono);">' + (this.dist[node.id] === Infinity ? '∞' : this.dist[node.id]) + '</td>' +
                '<td>' + (this.pred[node.id] || '-') + '</td>' +
                '</tr>';
        }).join('');
    }

    updateStats() {
        this.statStep.textContent = this.stepCount;
        this.statVisited.textContent = this.visited.size;
        this.statRelax.textContent = this.relaxCount;
    }

    renderAll() {
        this.renderGraph();
        this.renderPQ();
        this.renderPQHistory();
        this.renderDistTable();
        this.updateStats();
    }

    initAlgorithm() {
        this.resetState();
        this.runSource = this.getSource();
        this.runDest = this.getDest();

        const sourceNodeExists = this.nodes.some((node) => node.id === this.runSource);
        const destNodeExists = this.nodes.some((node) => node.id === this.runDest);
        if (!sourceNodeExists || !destNodeExists) {
            this.phase = 'idle';
            this.setFeedback('Sélection invalide de source/destination. Réinitialisez puis réessayez.', 'error');
            this.renderAll();
            return false;
        }

        this.dist[this.runSource] = 0;
        this.pq.push({ node: this.runSource, d: 0 });
        this.pushPQHistory('push', this.runSource, 0, 'initialisation');
        this.phase = 'extracting';

        this.highlightLines('dline2', 'dline3', 'dline4');
        this.setFeedback('Initialisation : dist[' + this.runSource + '] = 0, insertion dans la file.', 'info');
        this.renderAll();
        return true;
    }

    doStep() {
        if (this.phase === 'idle') {
            const initialized = this.initAlgorithm();
            if (!initialized) return false;
            this.stepCount++;
            this.updateStats();
            return true;
        }

        if (this.phase === 'done') return false;

        Object.keys(this.edgeStates).forEach((key) => {
            if (this.edgeStates[key] === 'relaxing') {
                this.edgeStates[key] = 'visited';
            }
        });

        if (this.phase === 'extracting') {
            // Skip stale PQ entries iteratively (no recursion).
            let min = null;
            while (this.pq.length > 0) {
                this.pq.sort((a, b) => a.d - b.d);
                const candidate = this.pq.shift();
                if (!this.visited.has(candidate.node)) {
                    min = candidate;
                    break;
                }
                this.pushPQHistory('skip', candidate.node, candidate.d, 'entree obsolete');
            }

            if (!min) {
                this.phase = 'done';
                this.showShortestPath();
                return false;
            }

            this.pushPQHistory('pop', min.node, min.d, 'minimum extrait');
            this.currentNode = min.node;
            this.visited.add(this.currentNode);
            this.currentNeighbors = this.neighbors(this.currentNode).filter((neighbor) => !this.visited.has(neighbor.node));
            this.neighborIdx = 0;

            this.highlightLines('dline6', 'dline7');
            this.setFeedback('Extraction du minimum : sommet ' + this.currentNode + ' (distance ' + this.dist[this.currentNode] + ')', 'info');

            this.phase = this.currentNeighbors.length > 0 ? 'relaxing' : 'extracting';
            this.stepCount++;
            this.renderAll();
            return true;
        }

        if (this.phase === 'relaxing') {
            if (this.neighborIdx >= this.currentNeighbors.length) {
                this.phase = 'extracting';
                this.currentNode = null;
                this.stepCount++;
                this.renderAll();
                return true;
            }

            const neighbor = this.currentNeighbors[this.neighborIdx];
            const alt = this.dist[this.currentNode] + neighbor.weight;
            const key = this.edgeKey(this.currentNode, neighbor.node);
            this.edgeStates[key] = 'relaxing';

            this.highlightLines('dline8', 'dline9');

            if (alt < this.dist[neighbor.node]) {
                this.dist[neighbor.node] = alt;
                this.pred[neighbor.node] = this.currentNode;
                this.pq.push({ node: neighbor.node, d: alt });
                this.pushPQHistory('push', neighbor.node, alt, 'relaxation');
                this.relaxCount++;
                this.highlightLines('dline10', 'dline11', 'dline12');
                this.setFeedback('Relaxation : dist[' + neighbor.node + '] = dist[' + this.currentNode + '] + ' + neighbor.weight + ' = ' + alt + ' (amélioration)', 'success');
            } else {
                this.setFeedback('Examen arête ' + this.currentNode + '-' + neighbor.node + ' : ' + alt + ' >= ' + this.dist[neighbor.node] + ' (pas d\'amélioration)', '');
            }

            this.neighborIdx++;
            this.stepCount++;
            this.renderAll();
            return true;
        }

        return false;
    }

    showShortestPath() {
        const source = this.runSource || this.getSource();
        const destination = this.runDest || this.getDest();
        this.pathEdges.clear();

        const pathNodes = [];
        let current = destination;
        while (current) {
            pathNodes.unshift(current);
            if (this.pred[current]) {
                this.pathEdges.add(this.edgeKey(this.pred[current], current));
            }
            current = this.pred[current];
        }

        this.highlightLines('dline13');

        if (this.dist[destination] === Infinity) {
            this.setFeedback('Aucun chemin de ' + source + ' vers ' + destination + '.', 'error');
        } else {
            this.setFeedback('Plus court chemin : ' + pathNodes.join(' -> ') + ' (distance totale : ' + this.dist[destination] + ')', 'success');
        }

        this.renderAll();
    }

    stepOnce() {
        if (this.running) return;
        this.doStep();
    }

    async runAuto() {
        if (this.running) return;

        if (this.phase === 'done') {
            this.phase = 'idle';
        }

        this.running = true;
        this.btnRun.disabled = true;
        this.btnStep.disabled = true;
        this.sourceSelect.disabled = true;
        this.destSelect.disabled = true;

        try {
            if (this.phase === 'idle') {
                const initialized = this.initAlgorithm();
                if (!initialized) {
                    this.running = false;
                    return;
                }
                this.stepCount++;
                this.updateStats();
                await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
            }

            let progressed = false;

            while (this.running && this.phase !== 'done') {
                progressed = true;
                const shouldContinue = this.doStep();
                if (!shouldContinue) break;
                await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
            }

            // Safety net: if the while loop did not run, force one step.
            if (!progressed && this.phase !== 'done') {
                this.doStep();
            }
        } catch (error) {
            console.error('Erreur runAuto Dijkstra:', error);
            this.setFeedback('Erreur pendant l\'exécution automatique. Voir console.', 'error');
        } finally {
            this.running = false;
            this.btnRun.disabled = false;
            this.btnStep.disabled = false;
            this.sourceSelect.disabled = false;
            this.destSelect.disabled = false;
        }

        // Important: do not force "done" here.
        // showShortestPath() is called only when the algorithm actually terminates.
    }
}

if (typeof window !== 'undefined') {
    window.DijkstraPage = DijkstraPage;
}
