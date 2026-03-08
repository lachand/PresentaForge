/**
 * BinaryTreeVisualizer - Visualisation d'arbres binaires de recherche (BST)
 *
 * Opérations :
 * - insertValue() : Insérer une valeur
 * - deleteValue() : Supprimer une valeur
 * - searchValue() : Rechercher une valeur
 * - startTraversal(type) : Parcours (inorder, preorder, postorder, bfs)
 * - resetTree() : Réinitialiser avec valeurs par défaut
 */

// Classes BST
class BSTNode {
    constructor(value) {
        this.value = value;
        this.left = null;
        this.right = null;
    }
}

class BST {
    constructor() {
        this.root = null;
    }

    insert(value) {
        const node = new BSTNode(value);
        if (!this.root) { this.root = node; return true; }
        let current = this.root;
        while (true) {
            if (value === current.value) return false; // duplicate
            if (value < current.value) {
                if (!current.left) { current.left = node; return true; }
                current = current.left;
            } else {
                if (!current.right) { current.right = node; return true; }
                current = current.right;
            }
        }
    }

    search(value) {
        let current = this.root;
        while (current) {
            if (value === current.value) return current;
            current = value < current.value ? current.left : current.right;
        }
        return null;
    }

    delete(value) {
        const deleteNode = (node, val) => {
            if (!node) return null;
            if (val < node.value) {
                node.left = deleteNode(node.left, val);
                return node;
            }
            if (val > node.value) {
                node.right = deleteNode(node.right, val);
                return node;
            }
            // val === node.value
            if (!node.left && !node.right) return null;
            if (!node.left) return node.right;
            if (!node.right) return node.left;
            // Two children: find min in right subtree
            let minRight = node.right;
            while (minRight.left) minRight = minRight.left;
            node.value = minRight.value;
            node.right = deleteNode(node.right, minRight.value);
            return node;
        };
        this.root = deleteNode(this.root, value);
    }

    count() {
        const countNodes = (node) => !node ? 0 : 1 + countNodes(node.left) + countNodes(node.right);
        return countNodes(this.root);
    }

    height() {
        const getHeight = (node) => !node ? 0 : 1 + Math.max(getHeight(node.left), getHeight(node.right));
        return getHeight(this.root);
    }

    min() {
        if (!this.root) return null;
        let current = this.root;
        while (current.left) current = current.left;
        return current.value;
    }

    max() {
        if (!this.root) return null;
        let current = this.root;
        while (current.right) current = current.right;
        return current.value;
    }
}

class BinaryTreeVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.tree = new BST();
        this.animating = false;
        this.NODE_RADIUS = 25;
        this.LEVEL_HEIGHT = 80;
        this.MIN_H_SPACING = 50;
        this.SVG_PADDING_TOP = 50;
        this.SVG_PADDING_BOTTOM = 50;
        this.lastDeleteGuide = null;
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    findNodeWithParent(value) {
        let parent = null;
        let current = this.tree.root;
        const path = [];

        while (current) {
            path.push(current.value);
            if (value === current.value) {
                return { parent, node: current, path };
            }
            parent = current;
            current = value < current.value ? current.left : current.right;
        }

        return null;
    }

    describeDeleteCase(value) {
        const found = this.findNodeWithParent(value);
        if (!found || !found.node) return null;

        const node = found.node;
        const children = Number(!!node.left) + Number(!!node.right);
        let kind = 'leaf';
        let message = '';
        let replacement = null;

        if (children === 0) {
            kind = 'leaf';
            message = `Suppression feuille (${value}) : retrait direct.`;
        } else if (children === 1) {
            if (node.left) {
                kind = 'single-left';
                replacement = node.left.value;
            } else {
                kind = 'single-right';
                replacement = node.right.value;
            }
            message = `Suppression a 1 enfant (${value}) : on remonte ${replacement}.`;
        } else {
            kind = 'two-children';
            let succ = node.right;
            while (succ.left) succ = succ.left;
            replacement = succ.value;
            message = `Suppression a 2 enfants (${value}) : remplacement par successeur ${replacement}.`;
        }

        return {
            value,
            kind,
            replacement,
            path: found.path,
            message
        };
    }

    renderDeleteGuide(guide, status) {
        this.lastDeleteGuide = guide || null;
        const host = document.getElementById('deleteCaseGuide');
        if (!host) return;

        if (!guide) {
            host.innerHTML = '<div class="text-muted text-sm">Choisir une valeur puis cliquer sur "Supprimer".</div>';
            return;
        }

        const tone = status === 'done' ? 'ok' : (status === 'error' ? 'bad' : 'info');
        const caseLabel = {
            leaf: '0 enfant (feuille)',
            'single-left': '1 enfant (gauche)',
            'single-right': '1 enfant (droite)',
            'two-children': '2 enfants'
        }[guide.kind] || guide.kind;

        host.innerHTML = '<div class="delete-guide-box ' + tone + '">' +
            '<div class="delete-guide-title">' + caseLabel + '</div>' +
            '<div class="delete-guide-message">' + guide.message + '</div>' +
            '<div class="delete-guide-path">Chemin: ' + guide.path.join(' -> ') + '</div>' +
            (guide.replacement !== null ? '<div class="delete-guide-repl">Remplacement: ' + guide.replacement + '</div>' : '') +
            '</div>';
    }

    /**
     * Réinitialise l'arbre
     */
    reset() {
        this.tree = new BST();
        const defaultValues = this.data.visualization?.config?.defaultValues || [50, 30, 70, 20, 40, 60, 80];
        defaultValues.forEach(v => this.tree.insert(v));
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.lastDeleteGuide = null;
        this.render();
        this.renderDeleteGuide(null);
        this.clearHighlight();
    }

    /**
     * Insère une valeur dans l'arbre
     */
    async insertValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;

        if (isNaN(val)) {
            this.showFeedback('Veuillez entrer un nombre valide.', 'error');
            return;
        }

        if (this.tree.search(val)) {
            this.showFeedback(`La valeur ${val} existe déjà dans l'arbre.`, 'error');
            return;
        }

        this.tree.insert(val);
        this.render();
        if (input) input.value = '';
        this.showFeedback(`Valeur ${val} insérée avec succès.`, 'success');
    }

    /**
     * Supprime une valeur de l'arbre
     */
    async deleteValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;

        if (isNaN(val)) {
            this.showFeedback('Veuillez entrer un nombre valide.', 'error');
            return;
        }

        const guide = this.describeDeleteCase(val);
        if (!guide) {
            this.showFeedback(`La valeur ${val} n'existe pas dans l'arbre.`, 'error');
            this.renderDeleteGuide(null, 'error');
            return;
        }

        this.animating = true;
        this.setButtonsDisabled(true);
        this.renderDeleteGuide(guide, 'preview');

        this.render(new Set(guide.path), new Set([val]));
        await OEIUtils.sleep(this.getCurrentDelay());

        if (guide.replacement !== null) {
            this.render(new Set(guide.path), new Set([val, guide.replacement]));
            await OEIUtils.sleep(this.getCurrentDelay(0.9));
        }

        this.tree.delete(val);
        this.state.stepCount += 1;
        this.render();
        if (input) input.value = '';
        this.showFeedback(`Valeur ${val} supprimée avec succès.`, 'success');
        this.renderDeleteGuide(guide, 'done');
        this.animating = false;
        this.setButtonsDisabled(false);
    }

    /**
     * Recherche une valeur dans l'arbre
     */
    async searchValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;

        if (isNaN(val)) {
            this.showFeedback('Veuillez entrer un nombre valide.', 'error');
            return;
        }

        this.animating = true;
        this.setButtonsDisabled(true);

        const path = [];
        let current = this.tree.root;
        let found = false;

        while (current) {
            path.push(current.value);
            this.render(new Set(path), new Set());
            await OEIUtils.sleep(this.getCurrentDelay());

            if (val === current.value) {
                found = true;
                break;
            }
            current = val < current.value ? current.left : current.right;
        }

        if (found) {
            this.render(new Set(path), new Set([val]));
            this.showFeedback(`Valeur ${val} trouvée dans l'arbre !`, 'success');
        } else {
            this.render(new Set(path), new Set());
            this.showFeedback(`Valeur ${val} non trouvée dans l'arbre.`, 'error');
        }

        this.animating = false;
        this.setButtonsDisabled(false);
    }

    /**
     * Lance un parcours de l'arbre
     */
    async startTraversal(type) {
        if (this.animating) return;
        if (!this.tree.root) {
            this.showFeedback('L\'arbre est vide.', 'error');
            return;
        }

        this.animating = true;
        this.setButtonsDisabled(true);
        const visited = [];
        const traversalResult = document.getElementById('traversalResult');
        if (traversalResult) traversalResult.innerHTML = '';

        const addToResult = (value) => {
            visited.push(value);
            if (traversalResult) {
                const badge = document.createElement('span');
                badge.className = 'badge badge-primary';
                badge.textContent = value;
                badge.style.animation = 'fadeIn 0.3s ease';
                traversalResult.appendChild(badge);
            }
        };

        if (type === 'inorder') {
            const inorder = async (node) => {
                if (!node) return;
                await inorder(node.left);
                addToResult(node.value);
                this.render(new Set(visited), new Set());
                await OEIUtils.sleep(this.getCurrentDelay());
                await inorder(node.right);
            };
            await inorder(this.tree.root);
        } else if (type === 'preorder') {
            const preorder = async (node) => {
                if (!node) return;
                addToResult(node.value);
                this.render(new Set(visited), new Set());
                await OEIUtils.sleep(this.getCurrentDelay());
                await preorder(node.left);
                await preorder(node.right);
            };
            await preorder(this.tree.root);
        } else if (type === 'postorder') {
            const postorder = async (node) => {
                if (!node) return;
                await postorder(node.left);
                await postorder(node.right);
                addToResult(node.value);
                this.render(new Set(visited), new Set());
                await OEIUtils.sleep(this.getCurrentDelay());
            };
            await postorder(this.tree.root);
        } else if (type === 'bfs') {
            const queue = [this.tree.root];
            while (queue.length > 0) {
                const node = queue.shift();
                addToResult(node.value);
                this.render(new Set(visited), new Set());
                await OEIUtils.sleep(this.getCurrentDelay());
                if (node.left) queue.push(node.left);
                if (node.right) queue.push(node.right);
            }
        }

        this.showFeedback(`Parcours ${type} terminé.`, 'success');
        this.animating = false;
        this.setButtonsDisabled(false);
    }

    /**
     * Réinitialise l'arbre avec valeurs par défaut
     */
    resetTree() {
        if (this.animating) return;
        this.reset();
        this.showFeedback('Arbre réinitialisé.', 'info');
    }

    /**
     * Calcule le layout de l'arbre
     */
    computeLayout(root) {
        if (!root) return { positions: new Map(), width: 0, height: 0 };

        const positions = new Map();
        let index = 0;

        // First pass: assign in-order index
        const assignIndex = (node) => {
            if (!node) return;
            assignIndex(node.left);
            positions.set(node.value, { inorderIndex: index, node });
            index++;
            assignIndex(node.right);
        };
        assignIndex(root);

        const totalNodes = index;
        const treeH = this.tree.height();

        const svgWidth = Math.max(totalNodes * this.MIN_H_SPACING, 300);
        const svgHeight = treeH * this.LEVEL_HEIGHT + this.SVG_PADDING_TOP + this.SVG_PADDING_BOTTOM;

        // Second pass: assign x/y coords
        const assignCoords = (node, depth) => {
            if (!node) return;
            assignCoords(node.left, depth + 1);
            const entry = positions.get(node.value);
            entry.x = (entry.inorderIndex + 0.5) * (svgWidth / totalNodes);
            entry.y = this.SVG_PADDING_TOP + depth * this.LEVEL_HEIGHT;
            assignCoords(node.right, depth + 1);
        };
        assignCoords(root, 0);

        return { positions, width: svgWidth, height: svgHeight };
    }

    /**
     * Rendu SVG de l'arbre
     */
    render(highlightSet, foundSet) {
        highlightSet = highlightSet || new Set();
        foundSet = foundSet || new Set();

        const svg = document.getElementById('treeSvg');
        if (!svg) return;

        svg.innerHTML = '';

        if (!this.tree.root) {
            svg.setAttribute('viewBox', '0 0 600 100');
            svg.style.minHeight = '100px';
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '300');
            text.setAttribute('y', '55');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#64748b');
            text.setAttribute('font-family', 'var(--font)');
            text.setAttribute('font-size', '15');
            text.textContent = 'Arbre vide — inserez des valeurs pour commencer';
            svg.appendChild(text);
            this.updateInfo();
            return;
        }

        const { positions, width, height } = this.computeLayout(this.tree.root);

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.minHeight = Math.min(height, 500) + 'px';

        // Draw edges first
        const drawEdges = (node) => {
            if (!node) return;
            const parentPos = positions.get(node.value);

            if (node.left) {
                const childPos = positions.get(node.left.value);
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', parentPos.x);
                line.setAttribute('y1', parentPos.y);
                line.setAttribute('x2', childPos.x);
                line.setAttribute('y2', childPos.y);
                line.classList.add('edge');
                if (highlightSet.has(node.value) && highlightSet.has(node.left.value)) {
                    line.classList.add('visited');
                }
                if (foundSet.has(node.value) && foundSet.has(node.left.value)) {
                    line.classList.add('found');
                }
                svg.appendChild(line);
                drawEdges(node.left);
            }

            if (node.right) {
                const childPos = positions.get(node.right.value);
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', parentPos.x);
                line.setAttribute('y1', parentPos.y);
                line.setAttribute('x2', childPos.x);
                line.setAttribute('y2', childPos.y);
                line.classList.add('edge');
                if (highlightSet.has(node.value) && highlightSet.has(node.right.value)) {
                    line.classList.add('visited');
                }
                if (foundSet.has(node.value) && foundSet.has(node.right.value)) {
                    line.classList.add('found');
                }
                svg.appendChild(line);
                drawEdges(node.right);
            }
        };
        drawEdges(this.tree.root);

        // Draw nodes
        const drawNodes = (node) => {
            if (!node) return;
            const pos = positions.get(node.value);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', this.NODE_RADIUS);
            circle.classList.add('node-circle');
            if (foundSet.has(node.value)) {
                circle.classList.add('found');
            } else if (highlightSet.has(node.value)) {
                circle.classList.add('visited');
            }
            svg.appendChild(circle);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', pos.x);
            label.setAttribute('y', pos.y);
            label.classList.add('node-label');
            if (foundSet.has(node.value)) {
                label.classList.add('found');
            } else if (highlightSet.has(node.value)) {
                label.classList.add('visited');
            }
            label.textContent = node.value;
            svg.appendChild(label);

            drawNodes(node.left);
            drawNodes(node.right);
        };
        drawNodes(this.tree.root);

        this.updateInfo();
    }

    /**
     * Met à jour les informations
     */
    updateInfo() {
        const nodeCount = document.getElementById('nodeCount');
        const treeHeight = document.getElementById('treeHeight');
        const treeMin = document.getElementById('treeMin');
        const treeMax = document.getElementById('treeMax');

        if (nodeCount) nodeCount.textContent = this.tree.count();
        if (treeHeight) treeHeight.textContent = this.tree.height();
        if (treeMin) treeMin.textContent = this.tree.min() !== null ? this.tree.min() : '—';
        if (treeMax) treeMax.textContent = this.tree.max() !== null ? this.tree.max() : '—';
    }

    /**
     * Affiche un message de feedback
     */
    showFeedback(message, type) {
        const el = document.getElementById('feedback');
        if (el) {
            el.textContent = message;
            el.className = 'feedback text-center ' + (type || 'info');
        }
    }

    /**
     * Désactive/active les boutons pendant l'animation
     */
    setButtonsDisabled(disabled) {
        document.querySelectorAll('.btn').forEach(btn => {
            if (!btn.classList.contains('btn-back')) {
                btn.disabled = disabled;
            }
        });
    }

    /**
     * Configuration des événements
     */
    setupEventListeners() {
        const input = document.getElementById('inputValue');
        if (input) {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') this.insertValue();
            });
        }
    }

    /**
     * Initialisation
     */
    async init() {
        await super.init();
        this.reset();
        this.setupEventListeners();
    }
}

const BST_WIDGET_TEMPLATE = `
<div class="card">
    <div class="controls-section">
        <div class="controls-section-title">Operations</div>
        <div class="controls-group">
            <input type="number" id="inputValue" placeholder="Valeur (entier)" class="input">
            <button onclick="page.insertValue()" class="btn btn-primary">Inserer</button>
            <button onclick="page.deleteValue()" class="btn btn-secondary">Supprimer</button>
            <button onclick="page.searchValue()" class="btn btn-primary">Rechercher</button>
            <button onclick="page.resetTree()" class="btn btn-secondary">Reinitialiser</button>
        </div>
    </div>

    <div class="separator-line"></div>

    <div class="speed-control">
        <label for="speedSlider">Vitesse de simulation :</label>
        <input type="range" id="speedSlider" class="speed-slider"
               min="1" max="5" value="3" step="1">
        <span class="speed-label" id="speedLabel">Normal</span>
    </div>

    <div class="separator-line"></div>

    <div class="controls-section">
        <div class="controls-section-title">Parcours</div>
        <div class="controls-group">
            <button onclick="page.startTraversal('inorder')" class="btn btn-primary" id="btn-inorder">Infixe</button>
            <button onclick="page.startTraversal('preorder')" class="btn btn-primary" id="btn-preorder">Prefixe</button>
            <button onclick="page.startTraversal('postorder')" class="btn btn-primary" id="btn-postorder">Suffixe</button>
            <button onclick="page.startTraversal('bfs')" class="btn btn-primary" id="btn-bfs">Largeur (BFS)</button>
        </div>
    </div>

    <div class="separator-line"></div>

    <svg id="treeSvg" class="tree-svg"></svg>
    <div id="feedback" class="feedback text-center"></div>
    <div id="traversalResult" class="traversal-result"></div>
</div>

<div class="card">
    <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
        <div class="info-card" style="flex: 1; min-width: 200px;">
            <h3>Informations</h3>
            <p>Nombre de noeuds <span class="badge badge-primary" id="nodeCount">0</span></p>
            <p>Hauteur de l'arbre <span class="badge badge-primary" id="treeHeight">0</span></p>
            <p>Valeur minimale <span class="badge badge-accent" id="treeMin">—</span></p>
            <p>Valeur maximale <span class="badge badge-accent" id="treeMax">—</span></p>
        </div>
        <div class="info-card" style="flex: 1; min-width: 200px;">
            <h3>Legende</h3>
            <p><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="white" stroke="#4f46e5" stroke-width="2"/></svg> Noeud normal</p>
            <p><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="#10b981" stroke="#10b981" stroke-width="2"/></svg> Noeud visite / actif</p>
            <p><svg width="20" height="20"><circle cx="10" cy="10" r="8" fill="#4f46e5" stroke="#4f46e5" stroke-width="2"/></svg> Noeud trouve</p>
        </div>
        <div class="info-card" style="flex: 1; min-width: 200px;">
            <h3>Principe du BST</h3>
            <p style="display: block; color: var(--muted); font-size: 0.85rem; line-height: 1.6;">
                Pour chaque noeud, tous les elements du sous-arbre gauche sont inferieurs
                et tous les elements du sous-arbre droit sont superieurs.
            </p>
        </div>
        <div class="info-card" style="flex: 1; min-width: 240px;">
            <h3>Guide suppression</h3>
            <div id="deleteCaseGuide" class="delete-guide-host">
                <div class="text-muted text-sm">Choisir une valeur puis cliquer sur "Supprimer".</div>
            </div>
        </div>
    </div>
</div>
`;

const BSTWidgets = {
    mount(mount) {
        mount.innerHTML = BST_WIDGET_TEMPLATE;
        return { destroy() {} };
    }
};

// ── Standalone widget pour les slides ────────────────────────────────────────
class BSTWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (BSTWidget._stylesInjected) return;
        BSTWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.bstw-root{font-family:var(--font,system-ui);padding:.65rem;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;}
.bstw-controls{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.45rem;align-items:center;flex-shrink:0;}
.bstw-input{padding:.28rem .5rem;border:1px solid var(--border,#e0e0e5);border-radius:6px;font-size:.82rem;width:100px;background:var(--bg,#fff);color:var(--text,#1d1d1f);}
.bstw-btn{padding:.28rem .65rem;border:1px solid var(--border,#e0e0e5);border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:500;background:var(--card,#f9f9fb);color:var(--text,#1d1d1f);transition:opacity .15s;}
.bstw-btn:hover{opacity:.8;}
.bstw-btn-primary{background:var(--primary,#6366f1);border-color:var(--primary,#6366f1);color:#fff;}
.bstw-trav-row{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.4rem;align-items:center;flex-shrink:0;}
.bstw-trav-label{font-size:.78rem;color:var(--muted,#6b7280);}
.bstw-svg-wrap{flex:1;min-height:0;overflow:auto;border:1px solid var(--border,#e0e0e5);border-radius:6px;background:var(--bg,#fff);margin-bottom:.35rem;}
.bstw-svg{width:100%;display:block;}
.bstw-feedback{min-height:1.3rem;font-size:.8rem;padding:.15rem 0;color:var(--muted,#6b7280);}
.bstw-feedback.success{color:#16a34a;}
.bstw-feedback.error{color:#ef4444;}
.bstw-feedback.info{color:#0ea5e9;}
.bstw-traversal{font-size:.78rem;color:var(--muted,#6b7280);min-height:1.1rem;margin-bottom:.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bstw-info{display:flex;flex-wrap:wrap;gap:.35rem;font-size:.78rem;color:var(--muted,#6b7280);}
.bstw-info-chip{background:var(--card,#f9f9fb);border:1px solid var(--border,#e0e0e5);border-radius:4px;padding:.1rem .4rem;}
.bstw-svg .bst-edge{stroke:var(--border,#cbd5e1);stroke-width:1.5;fill:none;}
.bstw-svg .bst-edge.visited{stroke:#10b981;}
.bstw-svg .bst-edge.found{stroke:#6366f1;}
.bstw-svg .bst-node{fill:var(--bg,#fff);stroke:#6366f1;stroke-width:2;}
.bstw-svg .bst-node.visited{fill:#10b981;stroke:#10b981;}
.bstw-svg .bst-node.found{fill:#6366f1;stroke:#6366f1;}
.bstw-svg .bst-label{text-anchor:middle;dominant-baseline:central;font-size:11px;font-weight:600;fill:var(--text,#1d1d1f);font-family:var(--font,system-ui);}
.bstw-svg .bst-label.visited,.bstw-svg .bst-label.found{fill:#fff;}
`;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        BSTWidget.ensureStyles();
        const w = new BSTWidget(container, config);
        w.init();
        return { destroy: () => w.destroy() };
    }

    constructor(container, config = {}) {
        this.root = container;
        this.config = config;
        this.tree = new BST();
        this.animating = false;
        // Layout constants (smaller than page visualizer for compact embed)
        this.MIN_H_SPACING = 38;
        this.LEVEL_HEIGHT = 52;
        this.SVG_PAD_TOP = 22;
        this.SVG_PAD_BOT = 16;
        this.NODE_R = 14;
    }

    init() {
        this.root.innerHTML = `<div class="bstw-root">
  <div class="bstw-controls">
    <input type="number" class="bstw-input" placeholder="Valeur" data-role="input">
    <button class="bstw-btn bstw-btn-primary" data-role="insert">Insérer</button>
    <button class="bstw-btn" data-role="delete">Supprimer</button>
    <button class="bstw-btn bstw-btn-primary" data-role="search">Rechercher</button>
    <button class="bstw-btn" data-role="reset">Réinitialiser</button>
  </div>
  <div class="bstw-trav-row">
    <span class="bstw-trav-label">Parcours :</span>
    <button class="bstw-btn bstw-btn-primary" data-role="inorder">Infixe</button>
    <button class="bstw-btn bstw-btn-primary" data-role="preorder">Préfixe</button>
    <button class="bstw-btn bstw-btn-primary" data-role="postorder">Suffixe</button>
    <button class="bstw-btn bstw-btn-primary" data-role="bfs">Largeur</button>
  </div>
  <div class="bstw-feedback" data-role="feedback"></div>
  <div class="bstw-svg-wrap"><svg class="bstw-svg" data-role="svg"></svg></div>
  <div class="bstw-traversal" data-role="traversal"></div>
  <div class="bstw-info">
    Nœuds: <span class="bstw-info-chip" data-role="count">0</span>
    Hauteur: <span class="bstw-info-chip" data-role="height">0</span>
    Min: <span class="bstw-info-chip" data-role="min">—</span>
    Max: <span class="bstw-info-chip" data-role="max">—</span>
  </div>
</div>`;

        const q = (role) => this.root.querySelector(`[data-role="${role}"]`);
        this._input    = q('input');
        this._feedback = q('feedback');
        this._svg      = q('svg');
        this._travEl   = q('traversal');
        this._countEl  = q('count');
        this._heightEl = q('height');
        this._minEl    = q('min');
        this._maxEl    = q('max');

        q('insert').addEventListener('click',   () => this.insertValue());
        q('delete').addEventListener('click',   () => this.deleteValue());
        q('search').addEventListener('click',   () => this.searchValue());
        q('reset').addEventListener('click',    () => this.resetTree());
        q('inorder').addEventListener('click',  () => this.startTraversal('inorder'));
        q('preorder').addEventListener('click', () => this.startTraversal('preorder'));
        q('postorder').addEventListener('click',() => this.startTraversal('postorder'));
        q('bfs').addEventListener('click',      () => this.startTraversal('bfs'));
        this._input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.insertValue(); });

        const defaults = this.config.values || [50, 30, 70, 20, 40, 60, 80];
        defaults.forEach((v) => this.tree.insert(v));
        this.render();
        this.showFeedback('Arbre initialisé.', 'info');
    }

    insertValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        const ok = this.tree.insert(val);
        this._input.value = '';
        if (!ok) { this.showFeedback(`${val} existe déjà.`, 'error'); return; }
        this.render();
        this.showFeedback(`${val} inséré.`, 'success');
    }

    deleteValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        if (!this.tree.search(val)) { this.showFeedback(`${val} introuvable.`, 'error'); return; }
        this.tree.delete(val);
        this._input.value = '';
        this.render();
        this.showFeedback(`${val} supprimé.`, 'success');
    }

    async searchValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        this.animating = true;
        const visited = new Set();
        const found   = new Set();
        let current = this.tree.root;
        while (current) {
            visited.add(current.value);
            this.render(visited, found);
            await new Promise(r => setTimeout(r, 500));
            if (val === current.value) {
                found.add(current.value);
                this.render(visited, found);
                this.showFeedback(`${val} trouvé !`, 'success');
                this.animating = false;
                return;
            }
            current = val < current.value ? current.left : current.right;
        }
        this.render(visited, found);
        this.showFeedback(`${val} introuvable.`, 'error');
        this.animating = false;
    }

    resetTree() {
        if (this.animating) return;
        this.tree = new BST();
        const defaults = this.config.values || [50, 30, 70, 20, 40, 60, 80];
        defaults.forEach((v) => this.tree.insert(v));
        this._travEl.textContent = '';
        this.render();
        this.showFeedback('Arbre réinitialisé.', 'info');
    }

    async startTraversal(type) {
        if (this.animating) return;
        if (!this.tree.root) { this.showFeedback('Arbre vide.', 'error'); return; }
        this.animating = true;
        const visited = new Set();
        const order   = [];
        const labels  = { inorder: 'Infixe', preorder: 'Préfixe', postorder: 'Suffixe', bfs: 'Largeur' };
        const step = async (v) => {
            visited.add(v);
            order.push(v);
            this.render(visited);
            this._travEl.textContent = `${labels[type]}: ${order.join(' → ')}`;
            await new Promise(r => setTimeout(r, 500));
        };

        if (type === 'inorder') {
            const visit = async (node) => { if (!node) return; await visit(node.left); await step(node.value); await visit(node.right); };
            await visit(this.tree.root);
        } else if (type === 'preorder') {
            const visit = async (node) => { if (!node) return; await step(node.value); await visit(node.left); await visit(node.right); };
            await visit(this.tree.root);
        } else if (type === 'postorder') {
            const visit = async (node) => { if (!node) return; await visit(node.left); await visit(node.right); await step(node.value); };
            await visit(this.tree.root);
        } else {
            const queue = [this.tree.root];
            while (queue.length) { const n = queue.shift(); await step(n.value); if (n.left) queue.push(n.left); if (n.right) queue.push(n.right); }
        }

        this.showFeedback('Parcours terminé.', 'success');
        this.animating = false;
    }

    _computeLayout(root) {
        const positions = new Map();
        let idx = 0;
        const assignIdx = (node) => { if (!node) return; assignIdx(node.left); positions.set(node.value, { idx: idx++, node }); assignIdx(node.right); };
        assignIdx(root);

        const total = idx;
        const getH = (node) => !node ? 0 : 1 + Math.max(getH(node.left), getH(node.right));
        const treeH = getH(root);
        const svgW = Math.max(total * this.MIN_H_SPACING, 280);
        const svgH = treeH * this.LEVEL_HEIGHT + this.SVG_PAD_TOP + this.SVG_PAD_BOT;

        const assignXY = (node, depth) => {
            if (!node) return;
            assignXY(node.left, depth + 1);
            const e = positions.get(node.value);
            e.x = (e.idx + 0.5) * (svgW / total);
            e.y = this.SVG_PAD_TOP + depth * this.LEVEL_HEIGHT;
            assignXY(node.right, depth + 1);
        };
        assignXY(root, 0);
        return { positions, w: svgW, h: svgH };
    }

    render(highlightSet, foundSet) {
        highlightSet = highlightSet || new Set();
        foundSet     = foundSet     || new Set();
        const svg = this._svg;
        const NS  = 'http://www.w3.org/2000/svg';
        svg.innerHTML = '';

        if (!this.tree.root) {
            svg.setAttribute('viewBox', '0 0 280 60');
            svg.style.minHeight = '60px';
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', '140'); t.setAttribute('y', '34');
            t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#64748b'); t.setAttribute('font-size', '13');
            t.textContent = 'Arbre vide — insérez des valeurs';
            svg.appendChild(t);
            this._updateInfo();
            return;
        }

        const { positions, w, h } = this._computeLayout(this.tree.root);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.style.minHeight = Math.min(h, 360) + 'px';

        const drawEdges = (node) => {
            if (!node) return;
            const pp = positions.get(node.value);
            for (const child of [node.left, node.right].filter(Boolean)) {
                const cp = positions.get(child.value);
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', pp.x); line.setAttribute('y1', pp.y);
                line.setAttribute('x2', cp.x); line.setAttribute('y2', cp.y);
                line.classList.add('bst-edge');
                if (highlightSet.has(node.value) && highlightSet.has(child.value)) line.classList.add('visited');
                if (foundSet.has(node.value)     && foundSet.has(child.value))     line.classList.add('found');
                svg.appendChild(line);
                drawEdges(child);
            }
        };
        drawEdges(this.tree.root);

        const drawNodes = (node) => {
            if (!node) return;
            const pos = positions.get(node.value);
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y); circle.setAttribute('r', this.NODE_R);
            circle.classList.add('bst-node');
            if (foundSet.has(node.value))     circle.classList.add('found');
            else if (highlightSet.has(node.value)) circle.classList.add('visited');
            svg.appendChild(circle);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', pos.x); label.setAttribute('y', pos.y);
            label.classList.add('bst-label');
            if (foundSet.has(node.value))          label.classList.add('found');
            else if (highlightSet.has(node.value)) label.classList.add('visited');
            label.textContent = node.value;
            svg.appendChild(label);

            drawNodes(node.left);
            drawNodes(node.right);
        };
        drawNodes(this.tree.root);
        this._updateInfo();
    }

    _updateInfo() {
        this._countEl.textContent  = this.tree.count();
        this._heightEl.textContent = this.tree.height();
        const mn = this.tree.min();
        const mx = this.tree.max();
        this._minEl.textContent = mn !== null ? mn : '—';
        this._maxEl.textContent = mx !== null ? mx : '—';
    }

    showFeedback(msg, type) {
        this._feedback.textContent = msg;
        this._feedback.className   = 'bstw-feedback' + (type ? ' ' + type : '');
    }

    destroy() {}
}

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BinaryTreeVisualizer;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.BinaryTreeVisualizer = BinaryTreeVisualizer;
    window.BSTWidgets = BSTWidgets;
    window.BSTWidget  = BSTWidget;
}
