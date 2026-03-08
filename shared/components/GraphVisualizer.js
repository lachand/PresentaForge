/**
 * GraphVisualizer - Generic SVG graph renderer for weighted/unweighted graphs.
 */
class GraphVisualizer {
    constructor(svgId, options = {}) {
        this.svg = document.getElementById(svgId);
        this.options = {
            weighted: false,
            nodeRadius: 22,
            distanceOffsetY: 36,
            weightOffset: 14,
            ...options
        };
        this.nodes = [];
        this.edges = [];
        this.nodeMap = new Map();
        this.interactionHandlers = {
            onNodeClick: null,
            onNodeEnter: null,
            onNodeLeave: null
        };
        this.lastSnapshot = {
            nodeStates: {},
            edgeStates: {}
        };
    }

    setGraph(nodes, edges, options = {}) {
        this.nodes = Array.isArray(nodes) ? nodes : [];
        this.edges = Array.isArray(edges) ? edges : [];
        this.options = { ...this.options, ...options };
        this.rebuildNodeMap();
    }

    rebuildNodeMap() {
        this.nodeMap.clear();
        this.nodes.forEach((node) => this.nodeMap.set(node.id, node));
    }

    setInteractionHandlers(handlers = {}) {
        this.interactionHandlers = {
            ...this.interactionHandlers,
            ...(handlers || {})
        };
    }

    getNode(id) {
        return this.nodeMap.get(id) || null;
    }

    edgeKey(a, b) {
        return String(a) < String(b) ? String(a) + '-' + String(b) : String(b) + '-' + String(a);
    }

    clear() {
        if (!this.svg) return;
        this.svg.innerHTML = '';
    }

    render(state = {}) {
        if (!this.svg) return;
        const normalized = this.normalizeRenderState(state);
        this.clear();
        this.drawEdges(normalized);
        this.drawNodes(normalized);
        this.updateSnapshot(normalized);
    }

    normalizeRenderState(state = {}) {
        const toSet = (value) => {
            if (value instanceof Set) return value;
            if (Array.isArray(value)) return new Set(value);
            return new Set();
        };
        const toMapObject = (value) => (value && typeof value === 'object' ? value : {});

        return {
            edgeStates: toMapObject(state.edgeStates),
            nodeStates: toMapObject(state.nodeStates),
            pathEdges: toSet(state.pathEdges),
            highlightNodes: toSet(state.highlightNodes),
            highlightEdges: toSet(state.highlightEdges),
            nodeBadges: toMapObject(state.nodeBadges),
            nodeTooltips: toMapObject(state.nodeTooltips),
            distances: state.distances || null,
            showDistances: Boolean(state.showDistances)
        };
    }

    resolveEdgeState(edgeKey, normalized) {
        if (normalized.pathEdges.has(edgeKey)) return 'path';
        return normalized.edgeStates[edgeKey] || '';
    }

    resolveEdgeClass(edgeKey, normalized) {
        const state = this.resolveEdgeState(edgeKey, normalized);
        const prevState = this.lastSnapshot.edgeStates[edgeKey] || '';
        let className = 'svg-edge';
        if (state) className += ' ' + state;
        if (normalized.highlightEdges.has(edgeKey)) className += ' compare-focus';
        if (prevState !== state) className += ' state-changed';
        return className;
    }

    resolveNodeState(nodeId, normalized) {
        return normalized.nodeStates[nodeId] || '';
    }

    resolveNodeClass(nodeId, normalized) {
        const state = this.resolveNodeState(nodeId, normalized);
        const prevState = this.lastSnapshot.nodeStates[nodeId] || '';
        let className = 'svg-node';
        if (state) className += ' ' + state;
        if (normalized.highlightNodes.has(nodeId)) className += ' compare-focus';
        if (prevState !== state) className += ' state-changed';
        return className;
    }

    labelToneForState(nodeState) {
        if (['processing', 'visited', 'source', 'path', 'found', 'current'].includes(nodeState)) {
            return 'light';
        }
        return 'dark';
    }

    drawEdges(normalized) {
        this.edges.forEach((edge) => {
            const from = this.getNode(edge.from);
            const to = this.getNode(edge.to);
            if (!from || !to) return;

            const key = this.edgeKey(edge.from, edge.to);
            const line = OEIUtils.createSVGElement('line', {
                x1: from.x,
                y1: from.y,
                x2: to.x,
                y2: to.y,
                class: this.resolveEdgeClass(key, normalized)
            });
            this.svg.appendChild(line);

            if (this.options.weighted && edge.w !== undefined) {
                this.drawEdgeWeight(from, to, edge.w);
            }
        });
    }

    drawEdgeWeight(from, to, weight) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt((dx * dx) + (dy * dy)) || 1;
        const ox = -(dy / len) * this.options.weightOffset;
        const oy = (dx / len) * this.options.weightOffset;

        const rect = OEIUtils.createSVGElement('rect', {
            x: mx + ox - 10,
            y: my + oy - 9,
            width: 20,
            height: 18,
            class: 'edge-weight-bg'
        });
        this.svg.appendChild(rect);

        const text = OEIUtils.createSVGElement('text', {
            x: mx + ox,
            y: my + oy + 1,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            class: 'edge-weight'
        });
        text.textContent = weight;
        this.svg.appendChild(text);
    }

    drawNodes(normalized) {
        this.nodes.forEach((node) => {
            const nodeState = this.resolveNodeState(node.id, normalized);
            const circle = OEIUtils.createSVGElement('circle', {
                cx: node.x,
                cy: node.y,
                r: this.options.nodeRadius,
                class: this.resolveNodeClass(node.id, normalized),
                'data-node-id': node.id
            });
            const tooltip = normalized.nodeTooltips[node.id];
            if (tooltip) circle.setAttribute('title', String(tooltip));
            this.attachNodeInteractions(circle, node);
            this.svg.appendChild(circle);

            const label = OEIUtils.createSVGElement('text', {
                x: node.x,
                y: node.y,
                class: 'svg-label ' + this.labelToneForState(nodeState)
            });
            label.textContent = node.id;
            this.svg.appendChild(label);

            const badge = normalized.nodeBadges[node.id];
            if (badge != null && badge !== '') {
                const badgeEl = OEIUtils.createSVGElement('text', {
                    x: node.x,
                    y: node.y - (this.options.nodeRadius + 10),
                    class: 'dist-label'
                });
                badgeEl.textContent = String(badge);
                this.svg.appendChild(badgeEl);
            }

            if (normalized.showDistances && normalized.distances) {
                const distanceText = OEIUtils.createSVGElement('text', {
                    x: node.x,
                    y: node.y + this.options.distanceOffsetY,
                    class: 'dist-label'
                });
                const value = normalized.distances[node.id];
                distanceText.textContent = value === Infinity ? '∞' : value;
                this.svg.appendChild(distanceText);
            }
        });
    }

    attachNodeInteractions(circle, node) {
        const { onNodeClick, onNodeEnter, onNodeLeave } = this.interactionHandlers;
        if (onNodeClick || onNodeEnter || onNodeLeave) {
            circle.style.cursor = 'pointer';
        }

        if (typeof onNodeClick === 'function') {
            circle.addEventListener('click', (event) => onNodeClick({
                event,
                nodeId: node.id,
                node
            }));
        }
        if (typeof onNodeEnter === 'function') {
            circle.addEventListener('mouseenter', (event) => onNodeEnter({
                event,
                nodeId: node.id,
                node
            }));
        }
        if (typeof onNodeLeave === 'function') {
            circle.addEventListener('mouseleave', (event) => onNodeLeave({
                event,
                nodeId: node.id,
                node
            }));
        }
    }

    updateSnapshot(normalized) {
        const nodeStates = {};
        this.nodes.forEach((node) => {
            nodeStates[node.id] = this.resolveNodeState(node.id, normalized);
        });

        const edgeStates = {};
        this.edges.forEach((edge) => {
            const key = this.edgeKey(edge.from, edge.to);
            edgeStates[key] = this.resolveEdgeState(key, normalized);
        });

        this.lastSnapshot = { nodeStates, edgeStates };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphVisualizer;
}

if (typeof window !== 'undefined') {
    window.GraphVisualizer = GraphVisualizer;
}
