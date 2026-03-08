/**
 * ExpressionTreeVisualizer - generic recursive DOM tree renderer.
 */
class ExpressionTreeVisualizer {
    constructor() {
        this.nodeMap = {};
    }

    render(container, root, options = {}) {
        if (!container) return;
        container.innerHTML = '';
        this.nodeMap = {};
        if (!root) return;

        container.appendChild(this.buildNode(root, options));
    }

    getNodeElement(nodeId) {
        return this.nodeMap[nodeId] || null;
    }

    buildNode(node, options) {
        const getChildren = options.getChildren || ((n) => n.children || []);
        const getLabel = options.getLabel || ((n) => n.label || n.value || '');
        const getId = options.getId || ((n) => n.id);
        const getNodeTypeClass = options.getNodeTypeClass || (() => '');

        const wrapper = document.createElement('div');
        wrapper.className = options.nodeWrapperClass || 'tree-node';

        if (options.connectorClass) {
            const connector = document.createElement('div');
            connector.className = options.connectorClass;
            wrapper.appendChild(connector);
        }

        const label = document.createElement('div');
        label.className = options.nodeLabelClass || 'tree-node-label';
        const extra = getNodeTypeClass(node);
        if (extra) label.classList.add(extra);
        label.textContent = getLabel(node);

        const nodeId = getId(node);
        if (nodeId !== undefined && nodeId !== null) {
            label.id = (options.nodeIdPrefix || 'tree-') + nodeId;
            this.nodeMap[nodeId] = label;
        }

        wrapper.appendChild(label);

        const children = getChildren(node);
        if (children && children.length > 0) {
            const childrenWrap = document.createElement('div');
            childrenWrap.className = options.childrenClass || 'tree-children';
            if (children.length === 1 && options.singleChildrenClass) {
                childrenWrap.classList.add(options.singleChildrenClass);
            }

            children.forEach((child) => {
                childrenWrap.appendChild(this.buildNode(child, options));
            });

            wrapper.appendChild(childrenWrap);
        }

        return wrapper;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionTreeVisualizer;
}

if (typeof window !== 'undefined') {
    window.ExpressionTreeVisualizer = ExpressionTreeVisualizer;
}
