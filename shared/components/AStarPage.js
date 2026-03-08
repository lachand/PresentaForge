class AStarPage extends ConceptPage {
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

        this.g = {};
        this.h = {};
        this.f = {};
        this.pred = {};

        this.open = [];
        this.openSet = new Set();
        this.closed = new Set();

        this.currentNode = null;
        this.currentNeighbors = [];
        this.neighborIdx = 0;
        this.phase = 'idle';
        this.stepCount = 0;
        this.running = false;
        this.edgeStates = {};
        this.pathEdges = new Set();
        this.source = null;
        this.goal = null;
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
        this.openList = document.getElementById('open-list');
        this.scoreTbody = document.getElementById('score-tbody');
        this.statStep = document.getElementById('stat-step');
        this.statOpen = document.getElementById('stat-open');
        this.statClosed = document.getElementById('stat-closed');
        this.statBestF = document.getElementById('stat-bestf');
        this.badgeNode = document.getElementById('astar-focus-node');
        this.badgeG = document.getElementById('astar-focus-g');
        this.badgeH = document.getElementById('astar-focus-h');
        this.badgeF = document.getElementById('astar-focus-f');
        this.explainOutput = document.getElementById('explain-output');
    }

    bindEvents() {
        this.btnRun.addEventListener('click', () => this.runAuto());
        this.btnStep.addEventListener('click', () => this.stepOnce());
        this.btnReset.addEventListener('click', () => this.resetAll());

        this.sourceSelect.addEventListener('change', () => {
            if (this.phase === 'idle') this.renderAll();
        });
        this.destSelect.addEventListener('change', () => {
            if (this.phase === 'idle') this.renderAll();
        });
    }

    initSelectors() {
        this.sourceSelect.innerHTML = '';
        this.destSelect.innerHTML = '';
        this.nodes.forEach((node) => {
            const src = document.createElement('option');
            src.value = node.id;
            src.textContent = node.id;
            this.sourceSelect.appendChild(src);

            const dst = document.createElement('option');
            dst.value = node.id;
            dst.textContent = node.id;
            this.destSelect.appendChild(dst);
        });
        this.sourceSelect.value = 'A';
        this.destSelect.value = 'G';
    }

    nodeById(id) {
        return this.nodes.find((n) => n.id === id) || null;
    }

    heuristic(a, b) {
        const n1 = this.nodeById(a);
        const n2 = this.nodeById(b);
        if (!n1 || !n2) return 0;
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        return Math.round(Math.sqrt(dx * dx + dy * dy) / 50);
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

    setFeedback(message, type) {
        this.feedback.textContent = message;
        this.feedback.className = 'feedback ' + (type || '');
    }

    clearHighlight() {
        document.querySelectorAll('.algorithm-code .line.highlight').forEach((line) => line.classList.remove('highlight'));
    }

    highlightLines() {
        this.clearHighlight();
        for (let i = 0; i < arguments.length; i++) {
            const line = document.getElementById(arguments[i]);
            if (line) line.classList.add('highlight');
        }
    }

    renderPseudocodeFromData() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (_block, _idx, lineNumber) => 'aline' + lineNumber
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

    resetState() {
        this.g = {};
        this.h = {};
        this.f = {};
        this.pred = {};
        this.open = [];
        this.openSet = new Set();
        this.closed = new Set();
        this.currentNode = null;
        this.currentNeighbors = [];
        this.neighborIdx = 0;
        this.phase = 'idle';
        this.stepCount = 0;
        this.edgeStates = {};
        this.pathEdges = new Set();
        this.source = null;
        this.goal = null;
        this.clearHighlight();

        this.nodes.forEach((node) => {
            this.g[node.id] = Infinity;
            this.h[node.id] = 0;
            this.f[node.id] = Infinity;
            this.pred[node.id] = null;
        });
    }

    resetAll() {
        this.running = false;
        this.resetState();
        this.renderAll();
        this.setFeedback('Choisissez une source, un objectif puis lancez A*.', 'info');
        this.btnRun.disabled = false;
        this.btnStep.disabled = false;
    }

    bestOpenNode() {
        let best = null;
        this.open.forEach((entry) => {
            if (!this.openSet.has(entry.node)) return;
            if (!best) {
                best = entry;
                return;
            }
            const lhs = this.f[entry.node];
            const rhs = this.f[best.node];
            if (lhs < rhs || (lhs === rhs && this.g[entry.node] < this.g[best.node])) {
                best = entry;
            }
        });
        return best ? best.node : null;
    }

    renderGraph() {
        const nodeStates = {};
        this.nodes.forEach((node) => {
            if (this.pathEdges.size > 0 && this.pathContains(node.id)) {
                nodeStates[node.id] = 'path';
            } else if (node.id === this.currentNode) {
                nodeStates[node.id] = 'current';
            } else if (this.closed.has(node.id)) {
                nodeStates[node.id] = 'visited';
            } else if (node.id === this.source && this.phase !== 'idle') {
                nodeStates[node.id] = 'source';
            }
        });

        this.graph.render({
            edgeStates: this.edgeStates,
            pathEdges: this.pathEdges,
            nodeStates,
            distances: this.g,
            showDistances: this.phase !== 'idle'
        });
    }

    renderOpenList() {
        const nodes = [...this.openSet]
            .sort((a, b) => {
                if (this.f[a] !== this.f[b]) return this.f[a] - this.f[b];
                return this.g[a] - this.g[b];
            });

        if (nodes.length === 0) {
            this.openList.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;text-align:center;padding:0.5rem;">Vide</div>';
            return;
        }

        const best = this.bestOpenNode();
        this.openList.innerHTML = nodes.map((id) => {
            return '<div class="pq-item' + (id === best ? ' current' : '') + '">' +
                '<div class="pq-item-main">' +
                '<span>Sommet ' + id + '</span>' +
                '<span class="pq-rank">' + (id === best ? 'meilleur f' : '') + '</span>' +
                '</div>' +
                '<div class="pq-item-badges">' +
                '<span class="pq-badge">g=' + this.formatScore(this.g[id]) + '</span>' +
                '<span class="pq-badge">h=' + this.formatScore(this.h[id]) + '</span>' +
                '<span class="pq-badge">f=' + this.formatScore(this.f[id]) + '</span>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    renderScoreTable() {
        this.scoreTbody.innerHTML = this.nodes.map((node) => {
            const id = node.id;
            let cls = '';
            if (this.closed.has(id)) cls = 'finalized';
            else if (id === this.currentNode) cls = 'updated';
            const g = this.g[id] === Infinity ? '∞' : this.g[id];
            const h = this.h[id] === Infinity ? '∞' : this.h[id];
            const f = this.f[id] === Infinity ? '∞' : this.f[id];
            return '<tr class="' + cls + '">' +
                '<td style="font-weight:700;">' + id + '</td>' +
                '<td style="font-family:var(--font-mono);">' + g + '</td>' +
                '<td style="font-family:var(--font-mono);">' + h + '</td>' +
                '<td style="font-family:var(--font-mono);">' + f + '</td>' +
                '<td>' + (this.pred[id] || '-') + '</td>' +
                '</tr>';
        }).join('');
    }

    updateStats() {
        this.statStep.textContent = this.stepCount;
        this.statOpen.textContent = this.openSet.size;
        this.statClosed.textContent = this.closed.size;
        const best = this.bestOpenNode();
        this.statBestF.textContent = best ? this.formatScore(this.f[best]) : '-';
    }

    formatScore(value) {
        if (value === Infinity) return '∞';
        if (typeof value === 'number') return String(value);
        return value == null ? '-' : String(value);
    }

    renderCurrentBadges() {
        if (!this.badgeNode || !this.badgeG || !this.badgeH || !this.badgeF) return;
        const focusNode = this.currentNode || this.bestOpenNode() || this.source;
        if (!focusNode) {
            this.badgeNode.textContent = '--';
            this.badgeG.textContent = '--';
            this.badgeH.textContent = '--';
            this.badgeF.textContent = '--';
            return;
        }
        this.badgeNode.textContent = focusNode;
        this.badgeG.textContent = this.formatScore(this.g[focusNode]);
        this.badgeH.textContent = this.formatScore(this.h[focusNode]);
        this.badgeF.textContent = this.formatScore(this.f[focusNode]);
    }

    renderAll() {
        this.renderGraph();
        this.renderOpenList();
        this.renderScoreTable();
        this.updateStats();
        this.renderCurrentBadges();
    }

    initAlgorithm() {
        this.resetState();
        this.source = this.sourceSelect.value;
        this.goal = this.destSelect.value;

        if (this.source === this.goal) {
            this.phase = 'done';
            this.g[this.source] = 0;
            this.h[this.source] = 0;
            this.f[this.source] = 0;
            this.setFeedback('Source et objectif identiques: cout total 0.', 'success');
            this.renderAll();
            return false;
        }

        this.g[this.source] = 0;
        this.h[this.source] = this.heuristic(this.source, this.goal);
        this.f[this.source] = this.h[this.source];
        this.open.push({ node: this.source });
        this.openSet.add(this.source);
        this.phase = 'extracting';

        this.highlightLines('aline2', 'aline3', 'aline4', 'aline5');
        this.setFeedback('Initialisation: source ' + this.source + ', objectif ' + this.goal + '.', 'info');
        this.renderAll();
        return true;
    }

    pathContains(nodeId) {
        let cursor = this.goal;
        while (cursor) {
            if (cursor === nodeId) return true;
            cursor = this.pred[cursor];
        }
        return false;
    }

    buildFinalPath() {
        this.pathEdges.clear();
        let cursor = this.goal;
        while (cursor && this.pred[cursor]) {
            this.pathEdges.add(this.edgeKey(this.pred[cursor], cursor));
            cursor = this.pred[cursor];
        }
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

        Object.keys(this.edgeStates).forEach((k) => {
            if (this.edgeStates[k] === 'relaxing') this.edgeStates[k] = 'visited';
        });

        if (this.phase === 'extracting') {
            if (this.openSet.size === 0) {
                this.phase = 'done';
                this.highlightLines('aline15');
                this.setFeedback('Echec: aucun chemin vers ' + this.goal + '.', 'error');
                this.renderAll();
                return false;
            }

            const u = this.bestOpenNode();
            this.currentNode = u;
            this.openSet.delete(u);
            this.closed.add(u);

            this.highlightLines('aline6', 'aline7');
            if (u === this.goal) {
                this.buildFinalPath();
                this.phase = 'done';
                this.highlightLines('aline8', 'aline15');
                this.setFeedback('Objectif atteint. Cout du chemin = ' + this.g[this.goal] + '.', 'success');
                this.stepCount++;
                this.renderAll();
                return false;
            }

            this.currentNeighbors = this.neighbors(u).filter((n) => !this.closed.has(n.node));
            this.neighborIdx = 0;
            this.phase = this.currentNeighbors.length > 0 ? 'relaxing' : 'extracting';
            this.setFeedback('Extraction de ' + u + ', exploration de ses voisins.', 'info');
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
            const v = neighbor.node;
            const tentative = this.g[this.currentNode] + neighbor.weight;

            this.highlightLines('aline9', 'aline10');
            const edgeKey = this.edgeKey(this.currentNode, v);
            this.edgeStates[edgeKey] = 'relaxing';

            if (tentative < this.g[v]) {
                this.g[v] = tentative;
                this.h[v] = this.heuristic(v, this.goal);
                this.f[v] = this.g[v] + this.h[v];
                this.pred[v] = this.currentNode;
                this.open.push({ node: v });
                this.openSet.add(v);
                this.highlightLines('aline11', 'aline12', 'aline13');
                this.setFeedback('Mise a jour de ' + v + ': g=' + this.g[v] + ', h=' + this.h[v] + ', f=' + this.f[v] + '.', 'success');
            } else {
                this.setFeedback('Pas d amelioration pour ' + v + ' (tentative=' + tentative + ').', '');
            }

            this.neighborIdx++;
            this.stepCount++;
            this.renderAll();
            return true;
        }

        return false;
    }

    async runAuto() {
        if (this.running) return;
        this.running = true;
        this.btnRun.disabled = true;
        this.btnStep.disabled = true;

        while (this.running) {
            const keepGoing = this.doStep();
            if (!keepGoing) break;
            const delay = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
            await OEIUtils.sleep(delay);
        }

        this.running = false;
        this.btnRun.disabled = false;
        this.btnStep.disabled = false;
    }

    stepOnce() {
        if (this.running) return;
        this.doStep();
    }
}

if (typeof window !== 'undefined') {
    window.AStarPage = AStarPage;
}
