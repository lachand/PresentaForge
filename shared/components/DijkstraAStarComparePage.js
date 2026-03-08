class DijkstraAStarComparePage extends ConceptPage {
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
        this.hoverNodeId = null;
        this.currentSource = null;
        this.currentDest = null;
        this.currentHeuristicMode = 'euclidean';
        this.lastDijkstra = null;
        this.lastAStar = null;
    }

    async init() {
        await super.init();

        this.graphDijkstra = new GraphVisualizer('graph-dijkstra', {
            weighted: true,
            nodeRadius: 20,
            distanceOffsetY: 34,
            weightOffset: 12
        });
        this.graphAStar = new GraphVisualizer('graph-astar', {
            weighted: true,
            nodeRadius: 20,
            distanceOffsetY: 34,
            weightOffset: 12
        });
        this.graphDijkstra.setGraph(this.nodes, this.edges);
        this.graphAStar.setGraph(this.nodes, this.edges);
        this.graphDijkstra.setInteractionHandlers({
            onNodeEnter: ({ nodeId }) => this.onNodeHover(nodeId),
            onNodeLeave: () => this.onNodeHover(null)
        });
        this.graphAStar.setInteractionHandlers({
            onNodeEnter: ({ nodeId }) => this.onNodeHover(nodeId),
            onNodeLeave: () => this.onNodeHover(null)
        });

        this.cacheDom();
        this.initSelectors();
        this.bindEvents();
        this.renderPseudocodeFromData();
        this.bindPseudocodeInspector();
        this.compare();
    }

    cacheDom() {
        this.sourceSelect = document.getElementById('source-select');
        this.destSelect = document.getElementById('dest-select');
        this.heuristicSelect = document.getElementById('heuristic-select');
        this.btnCompare = document.getElementById('btn-compare');

        this.dCost = document.getElementById('d-cost');
        this.dVisited = document.getElementById('d-visited');
        this.dRelax = document.getElementById('d-relax');
        this.dTime = document.getElementById('d-time');
        this.dPath = document.getElementById('d-path');

        this.aCost = document.getElementById('a-cost');
        this.aVisited = document.getElementById('a-visited');
        this.aRelax = document.getElementById('a-relax');
        this.aTime = document.getElementById('a-time');
        this.aPath = document.getElementById('a-path');

        this.compareSummary = document.getElementById('compare-summary');
        this.deltaCost = document.getElementById('compare-delta-cost');
        this.deltaVisited = document.getElementById('compare-delta-visited');
        this.deltaRelax = document.getElementById('compare-delta-relax');
        this.deltaTime = document.getElementById('compare-delta-time');
        this.hoverNode = document.getElementById('compare-hover-node');
        this.hoverDijkstra = document.getElementById('compare-hover-dijkstra');
        this.hoverAStarG = document.getElementById('compare-hover-astar-g');
        this.hoverAStarH = document.getElementById('compare-hover-astar-h');
        this.hoverAStarF = document.getElementById('compare-hover-astar-f');
        this.explainOutput = document.getElementById('explain-output');
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

    bindEvents() {
        this.btnCompare.addEventListener('click', () => this.compare());
        this.sourceSelect.addEventListener('change', () => this.compare());
        this.destSelect.addEventListener('change', () => this.compare());
        this.heuristicSelect.addEventListener('change', () => this.compare());
    }

    nodeById(id) {
        return this.nodes.find((n) => n.id === id) || null;
    }

    edgeKey(a, b) {
        return String(a) < String(b) ? String(a) + '-' + String(b) : String(b) + '-' + String(a);
    }

    neighbors(nodeId) {
        const result = [];
        this.edges.forEach((edge) => {
            if (edge.from === nodeId) result.push({ node: edge.to, w: edge.w });
            if (edge.to === nodeId) result.push({ node: edge.from, w: edge.w });
        });
        return result;
    }

    heuristic(a, b, mode) {
        if (mode === 'zero') return 0;
        const n1 = this.nodeById(a);
        const n2 = this.nodeById(b);
        if (!n1 || !n2) return 0;
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const euclid = Math.sqrt(dx * dx + dy * dy) / 50;
        if (mode === 'inflated') return Math.round(euclid * 1.5);
        return Math.round(euclid);
    }

    reconstructPath(pred, source, dest) {
        const path = [];
        let cur = dest;
        while (cur) {
            path.unshift(cur);
            if (cur === source) break;
            cur = pred[cur];
        }
        if (!path.length || path[0] !== source) return [];
        return path;
    }

    runDijkstra(source, dest) {
        const t0 = performance.now();
        const dist = {};
        const pred = {};
        const visited = new Set();
        const pq = [];
        let relaxCount = 0;
        const edgeStates = {};

        this.nodes.forEach((n) => {
            dist[n.id] = Infinity;
            pred[n.id] = null;
        });
        dist[source] = 0;
        pq.push({ node: source, d: 0 });

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const top = pq.shift();
            if (visited.has(top.node)) continue;
            visited.add(top.node);
            if (top.node === dest) break;

            this.neighbors(top.node).forEach((nb) => {
                if (visited.has(nb.node)) return;
                const alt = dist[top.node] + nb.w;
                const k = this.edgeKey(top.node, nb.node);
                edgeStates[k] = 'visited';
                if (alt < dist[nb.node]) {
                    dist[nb.node] = alt;
                    pred[nb.node] = top.node;
                    pq.push({ node: nb.node, d: alt });
                    relaxCount += 1;
                    edgeStates[k] = 'relaxing';
                }
            });
        }

        const path = this.reconstructPath(pred, source, dest);
        const pathEdges = new Set();
        for (let i = 1; i < path.length; i++) pathEdges.add(this.edgeKey(path[i - 1], path[i]));

        const t1 = performance.now();
        return {
            dist,
            pred,
            visited,
            relaxCount,
            path,
            pathEdges,
            edgeStates,
            cost: dist[dest],
            timeMs: t1 - t0
        };
    }

    runAStar(source, dest, mode) {
        const t0 = performance.now();
        const g = {};
        const f = {};
        const pred = {};
        const openSet = new Set();
        const closed = new Set();
        const open = [];
        let relaxCount = 0;
        const edgeStates = {};

        this.nodes.forEach((n) => {
            g[n.id] = Infinity;
            f[n.id] = Infinity;
            pred[n.id] = null;
        });

        g[source] = 0;
        f[source] = this.heuristic(source, dest, mode);
        open.push({ node: source });
        openSet.add(source);

        const bestOpenNode = () => {
            let best = null;
            openSet.forEach((id) => {
                if (!best || f[id] < f[best] || (f[id] === f[best] && g[id] < g[best])) best = id;
            });
            return best;
        };

        while (openSet.size > 0) {
            const u = bestOpenNode();
            openSet.delete(u);
            closed.add(u);
            if (u === dest) break;

            this.neighbors(u).forEach((nb) => {
                if (closed.has(nb.node)) return;
                const tentative = g[u] + nb.w;
                const k = this.edgeKey(u, nb.node);
                edgeStates[k] = 'visited';
                if (tentative < g[nb.node]) {
                    pred[nb.node] = u;
                    g[nb.node] = tentative;
                    f[nb.node] = tentative + this.heuristic(nb.node, dest, mode);
                    openSet.add(nb.node);
                    open.push({ node: nb.node });
                    relaxCount += 1;
                    edgeStates[k] = 'relaxing';
                }
            });
        }

        const path = this.reconstructPath(pred, source, dest);
        const pathEdges = new Set();
        for (let i = 1; i < path.length; i++) pathEdges.add(this.edgeKey(path[i - 1], path[i]));

        const t1 = performance.now();
        return {
            g,
            f,
            pred,
            closed,
            relaxCount,
            path,
            pathEdges,
            edgeStates,
            cost: g[dest],
            timeMs: t1 - t0
        };
    }

    renderResult(graph, result, source) {
        const nodeStates = {};
        this.nodes.forEach((n) => {
            if (result.path.includes(n.id)) nodeStates[n.id] = 'path';
            else if (result.visited && result.visited.has(n.id)) nodeStates[n.id] = 'visited';
            else if (result.closed && result.closed.has(n.id)) nodeStates[n.id] = 'visited';
        });
        nodeStates[source] = 'source';

        const distances = result.dist || result.g || {};
        graph.render({
            nodeStates,
            edgeStates: result.edgeStates,
            pathEdges: result.pathEdges,
            distances,
            showDistances: true
        });
    }

    formatCost(value) {
        return value === Infinity ? '∞' : String(value);
    }

    formatDelta(value, inverse = false) {
        if (!Number.isFinite(value)) return '-';
        if (value === 0) return '0 (egalite)';
        if (inverse) {
            return value > 0 ? `+${value} (A* plus lent)` : `${value} (A* plus rapide)`;
        }
        return value > 0 ? `+${value} (A* meilleur)` : `${value} (Dijkstra meilleur)`;
    }

    onNodeHover(nodeId) {
        this.hoverNodeId = nodeId || null;
        this.applyNodeFocus();
        this.renderHoverNodeMetrics();
    }

    applyNodeFocus() {
        ['graph-dijkstra', 'graph-astar'].forEach((svgId) => {
            const root = document.getElementById(svgId);
            if (!root) return;
            root.querySelectorAll('.svg-node').forEach((nodeEl) => {
                const id = nodeEl.getAttribute('data-node-id');
                const focused = this.hoverNodeId != null && String(id) === String(this.hoverNodeId);
                nodeEl.classList.toggle('compare-focus', focused);
            });
        });
    }

    renderHoverNodeMetrics() {
        if (!this.hoverNode || !this.hoverDijkstra || !this.hoverAStarG || !this.hoverAStarH || !this.hoverAStarF) return;
        if (!this.hoverNodeId || !this.lastDijkstra || !this.lastAStar) {
            this.hoverNode.textContent = '--';
            this.hoverDijkstra.textContent = '--';
            this.hoverAStarG.textContent = '--';
            this.hoverAStarH.textContent = '--';
            this.hoverAStarF.textContent = '--';
            return;
        }

        const id = this.hoverNodeId;
        const dijkstraDist = this.lastDijkstra.dist ? this.lastDijkstra.dist[id] : Infinity;
        const g = this.lastAStar.g ? this.lastAStar.g[id] : Infinity;
        const h = this.heuristic(id, this.currentDest, this.currentHeuristicMode);
        const f = this.lastAStar.f ? this.lastAStar.f[id] : Infinity;

        this.hoverNode.textContent = id;
        this.hoverDijkstra.textContent = this.formatCost(dijkstraDist);
        this.hoverAStarG.textContent = this.formatCost(g);
        this.hoverAStarH.textContent = this.formatCost(h);
        this.hoverAStarF.textContent = this.formatCost(f);
    }

    renderComparativeMetrics(dijkstra, astar) {
        if (!this.deltaCost || !this.deltaVisited || !this.deltaRelax || !this.deltaTime) return;
        const costDelta = (astar.cost === Infinity || dijkstra.cost === Infinity)
            ? NaN
            : dijkstra.cost - astar.cost;
        const visitedDelta = dijkstra.visited.size - astar.closed.size;
        const relaxDelta = dijkstra.relaxCount - astar.relaxCount;
        const timeDelta = dijkstra.timeMs - astar.timeMs;

        this.deltaCost.textContent = Number.isFinite(costDelta)
            ? (costDelta === 0 ? '0 (meme cout)' : String(costDelta))
            : '-';
        this.deltaVisited.textContent = this.formatDelta(visitedDelta, false);
        this.deltaRelax.textContent = this.formatDelta(relaxDelta, false);
        this.deltaTime.textContent = this.formatDelta(Number(timeDelta.toFixed(2)), true);
    }

    compare() {
        const source = this.sourceSelect.value;
        const dest = this.destSelect.value;
        const mode = this.heuristicSelect.value;
        this.currentSource = source;
        this.currentDest = dest;
        this.currentHeuristicMode = mode;

        if (source === dest) {
            this.compareSummary.textContent = 'Choisis deux sommets distincts pour comparer les algorithmes.';
            this.lastDijkstra = null;
            this.lastAStar = null;
            this.hoverNodeId = null;
            this.applyNodeFocus();
            this.renderHoverNodeMetrics();
            return;
        }

        const dijkstra = this.runDijkstra(source, dest);
        const astar = this.runAStar(source, dest, mode);
        this.lastDijkstra = dijkstra;
        this.lastAStar = astar;

        this.renderResult(this.graphDijkstra, dijkstra, source);
        this.renderResult(this.graphAStar, astar, source);
        this.applyNodeFocus();

        this.dCost.textContent = this.formatCost(dijkstra.cost);
        this.dVisited.textContent = dijkstra.visited.size;
        this.dRelax.textContent = dijkstra.relaxCount;
        this.dTime.textContent = dijkstra.timeMs.toFixed(2) + ' ms';
        this.dPath.textContent = dijkstra.path.length ? dijkstra.path.join(' -> ') : 'Aucun chemin';

        this.aCost.textContent = this.formatCost(astar.cost);
        this.aVisited.textContent = astar.closed.size;
        this.aRelax.textContent = astar.relaxCount;
        this.aTime.textContent = astar.timeMs.toFixed(2) + ' ms';
        this.aPath.textContent = astar.path.length ? astar.path.join(' -> ') : 'Aucun chemin';
        this.renderComparativeMetrics(dijkstra, astar);
        this.renderHoverNodeMetrics();

        if (dijkstra.cost === Infinity || astar.cost === Infinity) {
            this.compareSummary.textContent = 'Au moins un algorithme ne trouve pas de chemin.';
            return;
        }

        const sameCost = dijkstra.cost === astar.cost;
        const visitedGain = dijkstra.visited.size - astar.closed.size;
        const prefix = sameCost
            ? 'Les deux algorithmes trouvent le meme cout optimal.'
            : 'Attention: l heuristique choisie peut casser l optimalite.';
        const detail = visitedGain > 0
            ? ' A* visite ' + visitedGain + ' sommet(s) de moins sur ce cas.'
            : visitedGain < 0
                ? ' Dijkstra visite ' + (-visitedGain) + ' sommet(s) de moins sur ce cas.'
                : ' Les deux visitent le meme nombre de sommets.';
        this.compareSummary.textContent = prefix + detail;
    }

    renderPseudocodeFromData() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (block, idx) => {
                const name = block && block.name ? block.name : 'algo';
                return name + '-line' + (idx + 1);
            }
        });
    }

    bindPseudocodeInspector() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.bindLineInspector(this.data, {
            containerId: 'pseudocode-container',
            explainOutput: this.explainOutput
        });
    }
}

if (typeof window !== 'undefined') {
    window.DijkstraAStarComparePage = DijkstraAStarComparePage;
}
