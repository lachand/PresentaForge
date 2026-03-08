class FibonacciVisualizer {
    constructor(container) {
        this.container = container;
        this.animationInterval = null;
    }

    clear() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
        this.container.innerHTML = '';
    }
    
    async runLinearVisualization(n, mode, highlightCallback) {
        if (n > 12) {
            this.container.innerHTML = `<div class="alert alert-warning">N est trop grand pour une animation pas à pas. Maximum: 12.</div>`;
            return;
        }

        this.container.innerHTML = `
            <table class="fib-table">
                <thead>
                    <tr>
                        <th>i</th>
                        <th>a <small>(fib(i-2))</small></th>
                        <th>b <small>(fib(i-1))</small></th>
                        <th>temp <small>(a+b)</small></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;
        
        const tbody = this.container.querySelector('tbody');
        const lineId = (line) => `${mode}-line${line}`;

        await highlightCallback(lineId(0));
        await OEIUtils.sleep(500);

        if (n <= 1) {
            await highlightCallback(lineId(1));
            await OEIUtils.sleep(500);
            await highlightCallback(lineId(2));
            return;
        }

        let a = 0;
        let b = 1;

        await highlightCallback(lineId(3));
        await OEIUtils.sleep(500);
        
        for (let i = 2; i <= n; i++) {
            await highlightCallback(lineId(4));
            
            const temp = a + b;
            const row = document.createElement('tr');
            row.id = `fib-row-${i}`;
            row.innerHTML = `
                <td>${i}</td>
                <td class="fib-val-a">${a}</td>
                <td class="fib-val-b">${b}</td>
                <td class="fib-val-temp"></td>
            `;
            tbody.appendChild(row);
            
            // Highlight row as "in-progress"
            row.classList.add('in-progress');

            await OEIUtils.sleep(800);
            await highlightCallback(lineId(5));
            const tempCell = row.querySelector('.fib-val-temp');
            tempCell.textContent = temp;
            tempCell.classList.add('calculated');
            
            await OEIUtils.sleep(800);
            await highlightCallback(lineId(6));
            const bVal = row.querySelector('.fib-val-b');
            const aVal = row.querySelector('.fib-val-a');
            bVal.classList.add('moving');
            aVal.textContent = '';
            await OEIUtils.sleep(400);
            aVal.textContent = b;
            bVal.classList.remove('moving');

            await OEIUtils.sleep(800);
            await highlightCallback(lineId(7));
            const tempVal = row.querySelector('.fib-val-temp');
            bVal.textContent = '';
            tempVal.classList.add('moving');
            await OEIUtils.sleep(400);
            bVal.textContent = temp;
            tempVal.classList.remove('moving');
            
            row.classList.remove('in-progress');

            a = b;
            b = temp;
            
            tbody.scrollTop = tbody.scrollHeight;
        }

        await OEIUtils.sleep(500);
        await highlightCallback(lineId(8));
    }

    runRecursiveVisualization(treeData, mode) {
        this.clear();
        this.nodes = new Map();
        this.lines = [];
        this._drawTree(treeData, this.container);
    }
    
    _drawTree(treeData, container) {
        if (!treeData) return;

        const levelHeight = 100;
        const positions = this._calculatePositions(treeData, container.clientWidth, levelHeight);
        this._createLines(treeData, positions);
        this._createNodes(treeData, positions);
        
        this.lines.forEach(line => container.appendChild(line));
        for (const node of this.nodes.values()) {
            container.appendChild(node.element);
        }
    }

    _calculatePositions(node, totalWidth, levelHeight) {
        const positions = new Map();
        const widths = this._calculateSubtreeWidths(node);

        function traverse(currNode, x, y, availableWidth) {
            if (!currNode) return;
            positions.set(currNode.id, { x: x + availableWidth / 2, y });
            if (currNode.children && currNode.children.length === 2) {
                const [leftChild, rightChild] = currNode.children;
                const totalChildrenWidth = widths.get(leftChild.id) + widths.get(rightChild.id);
                const space = availableWidth - totalChildrenWidth;
                const leftWidth = widths.get(leftChild.id) + space / 2;
                const rightWidth = widths.get(rightChild.id) + space / 2;
                traverse(leftChild, x, y + levelHeight, leftWidth);
                traverse(rightChild, x + leftWidth, y + levelHeight, rightWidth);
            }
        }
        traverse(node, 0, 50, totalWidth);
        return positions;
    }
    
    _calculateSubtreeWidths(node) {
        const widths = new Map();
        const nodeGap = 40; 
        function getWidth(currNode) {
            if (!currNode) return 0;
            if (widths.has(currNode.id)) return widths.get(currNode.id);
            if (!currNode.children || currNode.children.length === 0) {
                widths.set(currNode.id, nodeGap);
                return nodeGap;
            }
            const childrenWidth = currNode.children.reduce((sum, child) => sum + getWidth(child), 0);
            widths.set(currNode.id, childrenWidth);
            return childrenWidth;
        }
        getWidth(node);
        return widths;
    }

    _createNodes(node, positions) {
        if (!node) return;
        const pos = positions.get(node.id);
        const nodeEl = document.createElement('div');
        nodeEl.className = 'fib-node';
        nodeEl.style.left = `${pos.x}px`;
        nodeEl.style.top = `${pos.y}px`;
        nodeEl.id = `fib-node-${node.id}`;
        
        const valueEl = document.createElement('span');
        valueEl.className = 'value';
        valueEl.textContent = `F(${node.n})`;
        
        const resultEl = document.createElement('span');
        resultEl.className = 'result';
        
        nodeEl.appendChild(valueEl);
        nodeEl.appendChild(resultEl);
        
        this.nodes.set(node.id, { element: nodeEl, data: node });

        if (node.children) {
            node.children.forEach(child => this._createNodes(child, positions));
        }
    }

    _createLines(node, positions) {
        if (!node || !node.children) return;
        const startPos = positions.get(node.id);
        node.children.forEach(child => {
            const endPos = positions.get(child.id);
            const line = document.createElement('div');
            line.className = 'fib-line';
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            line.style.width = `${dist}px`;
            line.style.left = `${startPos.x}px`;
            line.style.top = `${startPos.y}px`;
            line.style.transform = `rotate(${angle}deg)`;
            this.lines.push(line);
            this._createLines(child, positions);
        });
    }

    async highlightNode(nodeId, result) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        const nodeEl = node.element;
        nodeEl.classList.add('highlight');
        
        await OEIUtils.sleep(400);

        const resultEl = nodeEl.querySelector('.result');
        if (resultEl) {
            resultEl.textContent = `= ${result}`;
        }
        nodeEl.classList.remove('highlight');
        nodeEl.classList.add('calculated');
    }
}
