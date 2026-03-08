class GraphTraversalPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);

        this.nodes = [];
        this.edges = [];
        this.nextId = 0;
        this.selectedNode = null;
        this.startNode = null;
        this.animating = false;
        this.currentAlgo = null;

        this.processingNode = null;
        this.visitedNodes = new Set();
        this.edgeStates = {};
        this.visitSequence = [];
    }

    async init() {
        await super.init();

        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.graph = new GraphVisualizer('graphSvg', {
            weighted: false,
            nodeRadius: 25
        });

        this.cacheDom();
        this.renderPseudocodeFromData();
        this.bindPseudocodeInspector();
        this.bindEvents();
        this.chargerDefaut();
    }

    cacheDom() {
        this.svg = document.getElementById('graphSvg');
        this.svgWrapper = document.getElementById('svgWrapper');

        this.btnBFS = document.getElementById('btnBFS');
        this.btnDFS = document.getElementById('btnDFS');
        this.btnRemoveLast = document.getElementById('btnRemoveLast');
        this.btnReset = document.getElementById('btnResetGraph');
        this.btnLoadDefault = document.getElementById('btnLoadDefault');
        this.btnExportOrder = document.getElementById('btnExportOrder');

        this.algoType = document.getElementById('algoType');
        this.startNodeLabel = document.getElementById('startNodeLabel');
        this.nodeCount = document.getElementById('nodeCount');
        this.edgeCount = document.getElementById('edgeCount');
        this.structureLabel = document.getElementById('structureLabel');
        this.structureContainer = document.getElementById('structureContainer');
        this.structureSize = document.getElementById('structureSize');
        this.visitOrder = document.getElementById('visitOrder');
        this.feedback = document.getElementById('feedback');
        this.explainOutput = document.getElementById('explain-output');
    }

    bindEvents() {
        this.svg.addEventListener('click', (event) => this.onSvgClick(event));

        this.btnBFS.addEventListener('click', () => this.lancerBFS());
        this.btnDFS.addEventListener('click', () => this.lancerDFS());
        this.btnRemoveLast.addEventListener('click', () => this.supprimerDernier());
        this.btnReset.addEventListener('click', () => this.reinitialiser());
        this.btnLoadDefault.addEventListener('click', () => this.chargerDefaut());
        this.btnExportOrder?.addEventListener('click', () => this.exportVisitOrder());
    }

    svgPoint(event) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    edgeKey(a, b) {
        return this.graph.edgeKey(a, b);
    }

    renderGraph() {
        this.graph.setGraph(this.nodes, this.edges);

        const nodeStates = {};
        this.nodes.forEach((node) => {
            if (this.visitedNodes.has(node.id)) {
                nodeStates[node.id] = 'visited';
            }
            if (this.processingNode === node.id) {
                nodeStates[node.id] = 'processing';
            }
            if (this.startNode === node.id) {
                nodeStates[node.id] = nodeStates[node.id] || 'start-node';
            }
            if (this.selectedNode === node.id) {
                nodeStates[node.id] = 'selected';
            }
        });

        this.graph.render({
            nodeStates,
            edgeStates: this.edgeStates
        });

        this.updateInfo();
    }

    updateInfo() {
        this.nodeCount.textContent = this.nodes.length;
        this.edgeCount.textContent = this.edges.length;
        this.startNodeLabel.textContent = this.startNode !== null ? this.startNode : '--';
    }

    onSvgClick(event) {
        if (this.animating) return;

        const clickedNode = event.target.closest('.svg-node');
        if (clickedNode) {
            const id = parseInt(clickedNode.getAttribute('data-node-id'), 10);
            if (!Number.isNaN(id)) {
                this.handleNodeClick(id);
            }
            return;
        }

        const pt = this.svgPoint(event);
        const tooClose = this.nodes.some((node) => Math.hypot(node.x - pt.x, node.y - pt.y) < 55);
        if (tooClose) return;

        const rect = this.svg.getBoundingClientRect();
        const margin = 30;
        const x = Math.max(margin, Math.min(pt.x, rect.width - margin));
        const y = Math.max(margin, Math.min(pt.y, rect.height - margin));
        this.addNode(x, y);
    }

    addNode(x, y) {
        this.nodes.push({ id: this.nextId, x, y });
        if (this.nodes.length === 1) this.startNode = this.nextId;
        this.nextId++;
        this.selectedNode = null;
        this.renderGraph();
    }

    handleNodeClick(id) {
        if (this.selectedNode === null) {
            this.selectedNode = id;
            this.setFeedback('Noeud ' + id + ' selectionne. Cliquez sur un autre noeud pour creer une arete, ou re-cliquez pour choisir comme depart.', 'info');
            this.renderGraph();
            return;
        }

        if (this.selectedNode === id) {
            this.startNode = id;
            this.selectedNode = null;
            this.setFeedback('Noeud ' + id + ' defini comme noeud de depart.', 'success');
            this.renderGraph();
            return;
        }

        const exists = this.edges.some((edge) => {
            return (edge.from === this.selectedNode && edge.to === id)
                || (edge.from === id && edge.to === this.selectedNode);
        });

        if (!exists) {
            this.edges.push({ from: this.selectedNode, to: id });
            this.setFeedback('Arete creee entre ' + this.selectedNode + ' et ' + id + '.', 'success');
        } else {
            this.setFeedback('Cette arete existe deja.', 'error');
        }

        this.selectedNode = null;
        this.renderGraph();
    }

    supprimerDernier() {
        if (this.animating) return;
        if (this.nodes.length === 0) return;

        const last = this.nodes[this.nodes.length - 1];
        this.edges = this.edges.filter((edge) => edge.from !== last.id && edge.to !== last.id);
        this.nodes.pop();

        if (this.startNode === last.id) {
            this.startNode = this.nodes.length > 0 ? this.nodes[0].id : null;
        }

        this.selectedNode = null;
        this.renderGraph();
        this.setFeedback('Dernier noeud supprime.', 'info');
    }

    reinitialiser() {
        if (this.animating) return;

        this.nodes = [];
        this.edges = [];
        this.nextId = 0;
        this.selectedNode = null;
        this.startNode = null;
        this.animating = false;
        this.currentAlgo = null;

        this.processingNode = null;
        this.visitedNodes = new Set();
        this.edgeStates = {};
        this.visitSequence = [];

        this.renderGraph();
        this.clearStructure();
        this.clearVisitOrder();
        this.clearHighlightLines();
        this.algoType.textContent = '--';
        this.setFeedback('Graphe reinitialise.', 'info');
        this.updateExportButton();
    }

    chargerDefaut() {
        if (this.animating) return;

        this.reinitialiser();

        const svgRect = this.svg.getBoundingClientRect();
        const cx = svgRect.width / 2;
        const cy = svgRect.height / 2;
        const rx = Math.min(cx - 50, 180);
        const ry = Math.min(cy - 50, 140);

        const positions = [
            { x: cx, y: cy - ry },
            { x: cx + rx, y: cy - ry * 0.4 },
            { x: cx + rx, y: cy + ry * 0.4 },
            { x: cx, y: cy + ry },
            { x: cx - rx, y: cy + ry * 0.4 },
            { x: cx - rx, y: cy - ry * 0.4 }
        ];

        positions.forEach((position) => {
            this.nodes.push({ id: this.nextId, x: position.x, y: position.y });
            this.nextId++;
        });

        this.edges = [
            { from: 0, to: 1 },
            { from: 0, to: 5 },
            { from: 1, to: 2 },
            { from: 1, to: 3 },
            { from: 2, to: 3 },
            { from: 3, to: 4 },
            { from: 4, to: 5 },
            { from: 0, to: 3 }
        ];

        this.startNode = 0;
        this.renderGraph();
        this.setFeedback('Graphe par defaut charge (6 noeuds, 8 aretes).', 'success');
        this.updateExportButton();
    }

    buildAdj() {
        const adj = {};
        this.nodes.forEach((node) => {
            adj[node.id] = [];
        });

        this.edges.forEach((edge) => {
            adj[edge.from].push(edge.to);
            adj[edge.to].push(edge.from);
        });

        Object.keys(adj).forEach((key) => {
            adj[key].sort((a, b) => a - b);
        });

        return adj;
    }

    highlightLine(lineId) {
        this.clearHighlightLines();
        const line = document.getElementById(lineId);
        if (line) line.classList.add('highlight');
    }

    clearHighlightLines() {
        document.querySelectorAll('.algorithm-code .line').forEach((line) => line.classList.remove('highlight'));
    }

    renderPseudocodeFromData() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (_block, _idx, lineNumber) => 'line' + lineNumber
        });
    }

    bindPseudocodeInspector() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.bindLineInspector(this.data, {
            containerId: 'pseudocode-container',
            explainOutput: this.explainOutput
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
        const entry = (typeof PseudocodeSupport !== 'undefined')
            ? PseudocodeSupport.resolveExplanation(this.data, lineId, lineText)
            : { what: lineText, why: '' };
        this.explainOutput.innerHTML =
            '<strong>Quoi ?</strong> ' + this.escapeHtml(entry.what || '') +
            '<br><strong>Pourquoi ?</strong> ' + this.escapeHtml(entry.why || '');
    }

    async lancerBFS() {
        if (this.animating) return;
        if (this.nodes.length === 0) {
            this.setFeedback('Ajoutez des noeuds d\'abord.', 'error');
            return;
        }

        this.animating = true;
        this.currentAlgo = 'BFS';
        this.disableButtons(true);

        this.algoType.textContent = 'BFS';
        this.structureLabel.textContent = 'File (FIFO)';
        this.clearStructure();
        this.clearVisitOrder();
        this.resetTraversalView();

        const adj = this.buildAdj();
        const start = this.startNode !== null ? this.startNode : this.nodes[0].id;
        this.startNode = start;
        this.renderGraph();

        this.highlightLine('line1');
        await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);

        const visited = new Set();
        const queue = [start];
        visited.add(start);

        this.highlightLine('line2');
        await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
        this.highlightLine('line3');

        this.addToStructure(start);
        this.setFeedback('Debut du BFS depuis le noeud ' + start + '.', 'info');
        await OEIUtils.sleep(this.speedCtrl.getDelay());

        while (queue.length > 0) {
            this.highlightLine('line4');
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

            const current = queue.shift();
            this.highlightLine('line5');
            this.removeFromStructure('queue');

            this.processingNode = current;
            this.renderGraph();
            this.setFeedback('Traitement du noeud ' + current + '...', 'info');
            await OEIUtils.sleep(this.speedCtrl.getDelay());

            this.highlightLine('line6');
            this.addToVisitOrder(current);
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

            this.highlightLine('line7');
            const neighbors = adj[current] || [];
            for (const neighbor of neighbors) {
                this.highlightLine('line8');
                await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

                if (!visited.has(neighbor)) {
                    this.highlightLine('line9');
                    visited.add(neighbor);
                    await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

                    this.highlightLine('line10');
                    queue.push(neighbor);
                    this.addToStructure(neighbor);

                    this.setEdgeState(current, neighbor, 'active');
                    await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
                    this.setEdgeState(current, neighbor, 'traversed');
                }
            }

            this.processingNode = null;
            this.visitedNodes.add(current);
            this.renderGraph();
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
        }

        this.clearHighlightLines();
        this.setFeedback('BFS termine ! ' + visited.size + ' noeud(s) visite(s).', 'success');
        this.animating = false;
        this.disableButtons(false);
    }

    async lancerDFS() {
        if (this.animating) return;
        if (this.nodes.length === 0) {
            this.setFeedback('Ajoutez des noeuds d\'abord.', 'error');
            return;
        }

        this.animating = true;
        this.currentAlgo = 'DFS';
        this.disableButtons(true);

        this.algoType.textContent = 'DFS';
        this.structureLabel.textContent = 'Pile (LIFO)';
        this.clearStructure();
        this.clearVisitOrder();
        this.resetTraversalView();

        const adj = this.buildAdj();
        const start = this.startNode !== null ? this.startNode : this.nodes[0].id;
        this.startNode = start;
        this.renderGraph();

        this.highlightLine('line12');
        await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);

        const visited = new Set();
        const stack = [start];

        this.highlightLine('line13');
        await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
        this.highlightLine('line14');

        this.addToStructure(start);
        this.setFeedback('Debut du DFS depuis le noeud ' + start + '.', 'info');
        await OEIUtils.sleep(this.speedCtrl.getDelay());

        while (stack.length > 0) {
            this.highlightLine('line15');
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

            const current = stack.pop();
            this.highlightLine('line16');
            this.removeFromStructure('stack');

            this.highlightLine('line17');
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);
            if (visited.has(current)) continue;

            this.highlightLine('line18');
            visited.add(current);

            this.processingNode = current;
            this.renderGraph();
            this.setFeedback('Traitement du noeud ' + current + '...', 'info');
            await OEIUtils.sleep(this.speedCtrl.getDelay());

            this.highlightLine('line19');
            this.addToVisitOrder(current);
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);

            this.highlightLine('line20');
            const neighbors = (adj[current] || []).slice().reverse();
            for (const neighbor of neighbors) {
                this.highlightLine('line21');
                await OEIUtils.sleep(this.speedCtrl.getDelay() / 3);
                if (!visited.has(neighbor)) {
                    this.highlightLine('line22');
                    stack.push(neighbor);
                    this.addToStructure(neighbor);

                    this.setEdgeState(current, neighbor, 'active');
                    await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
                    this.setEdgeState(current, neighbor, 'traversed');
                }
            }

            this.processingNode = null;
            this.visitedNodes.add(current);
            this.renderGraph();
            await OEIUtils.sleep(this.speedCtrl.getDelay() / 2);
        }

        this.clearHighlightLines();
        this.setFeedback('DFS termine ! ' + visited.size + ' noeud(s) visite(s).', 'success');
        this.animating = false;
        this.disableButtons(false);
    }

    resetTraversalView() {
        this.processingNode = null;
        this.visitedNodes = new Set();
        this.edgeStates = {};
        this.renderGraph();
    }

    setEdgeState(from, to, state) {
        this.edgeStates[this.edgeKey(from, to)] = state;
        this.renderGraph();
    }

    clearStructure() {
        this.structureContainer.innerHTML = '<span class="text-muted text-sm" style="text-align:center;">Vide</span>';
        this.structureSize.textContent = '0';
    }

    addToStructure(id) {
        const placeholder = this.structureContainer.querySelector('.text-muted');
        if (placeholder) placeholder.remove();

        const item = document.createElement('div');
        const modeClass = this.currentAlgo === 'DFS' ? 'stack-mode' : 'queue-mode';
        item.className = 'structure-item entering op-insert ' + modeClass;
        item.textContent = 'Noeud ' + id;
        this.structureContainer.appendChild(item);
        this.updateStructureSize();
    }

    removeFromStructure(mode) {
        const items = this.structureContainer.querySelectorAll('.structure-item');
        if (items.length === 0) return;

        const target = mode === 'stack' ? items[items.length - 1] : items[0];
        target.classList.add('removing', 'op-delete');
        target.classList.add(mode === 'stack' ? 'removing-stack' : 'removing-queue');

        setTimeout(() => {
            target.remove();
            this.updateStructureSize();
            if (this.structureContainer.querySelectorAll('.structure-item').length === 0) {
                this.structureContainer.innerHTML = '<span class="text-muted text-sm" style="text-align:center;">Vide</span>';
            }
        }, 300);
    }

    updateStructureSize() {
        const count = this.structureContainer.querySelectorAll('.structure-item').length;
        this.structureSize.textContent = count;
    }

    clearVisitOrder() {
        this.visitSequence = [];
        this.visitOrder.innerHTML = '<span class="text-muted text-sm">--</span>';
        this.updateExportButton();
    }

    addToVisitOrder(id) {
        this.visitSequence.push(id);
        this.renderVisitOrder();
        this.updateExportButton();
    }

    renderVisitOrder() {
        this.visitOrder.innerHTML = '';
        if (!this.visitSequence.length) {
            this.visitOrder.innerHTML = '<span class="text-muted text-sm">--</span>';
            return;
        }

        this.visitSequence.forEach((nodeId, idx) => {
            if (idx > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'visit-arrow';
                arrow.textContent = '→';
                this.visitOrder.appendChild(arrow);
            }

            const item = document.createElement('span');
            item.className = 'visit-item';
            item.textContent = nodeId;
            item.title = `Ordre #${idx + 1}`;
            item.setAttribute('aria-label', `Noeud ${nodeId}, ordre ${idx + 1}`);

            const rank = document.createElement('span');
            rank.className = 'visit-rank';
            rank.textContent = String(idx + 1);
            item.appendChild(rank);
            this.visitOrder.appendChild(item);
        });
    }

    exportVisitOrder() {
        if (!this.visitSequence.length) {
            this.setFeedback('Aucun ordre de visite a exporter.', 'error');
            return;
        }

        const algo = this.currentAlgo || '--';
        const source = this.startNode != null ? this.startNode : '--';
        const content = [
            `Algorithme: ${algo}`,
            `Noeud de depart: ${source}`,
            `Ordre de visite: ${this.visitSequence.join(' -> ')}`,
            '',
            'Details:',
            ...this.visitSequence.map((id, idx) => `${idx + 1}. ${id}`)
        ].join('\n');

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileAlgo = (algo || 'parcours').toLowerCase();
        link.href = url;
        link.download = `parcours-graphe-${fileAlgo}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.setFeedback('Export termine: ordre de visite telecharge.', 'success');
    }

    setFeedback(message, type) {
        this.feedback.textContent = message;
        this.feedback.className = 'feedback ' + (type || '');
    }

    disableButtons(disabled) {
        this.btnBFS.disabled = disabled;
        this.btnDFS.disabled = disabled;
        this.btnRemoveLast.disabled = disabled;
        this.btnReset.disabled = disabled;
        this.btnLoadDefault.disabled = disabled;
        this.updateExportButton(disabled);
    }

    updateExportButton(forceDisabled = false) {
        if (!this.btnExportOrder) return;
        this.btnExportOrder.disabled = Boolean(forceDisabled) || this.visitSequence.length === 0;
    }
}

if (typeof window !== 'undefined') {
    window.GraphTraversalPage = GraphTraversalPage;
}
