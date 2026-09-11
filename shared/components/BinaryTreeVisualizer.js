/**
 * BinaryTreeVisualizer — arbre binaire de recherche (BST).
 *
 * Les 4 opérations (insérer, supprimer, rechercher, parcourir) vivent dans
 * shared/components/algorithms/bst-traces.js (buildBstInsertTrace/
 * buildBstDeleteTrace/buildBstSearchTrace/buildBstTraversalTrace, purs — un
 * arbre y est un simple objet `{value,left,right}`, jamais une classe). Cette
 * classe est l'ADAPTATEUR PAGE ; BSTWidget l'ADAPTATEUR SLIDE (même trace).
 *
 * NB : sur la page de cours réelle (structures/arbre-binaire.html), l'arbre
 * interactif visible par l'étudiant est le widget de cours `bst-simulator`
 * (BSTWidget), monté depuis le contenu JSON — cette classe page n'y a pas de
 * <svg id="treeSvg"> hôte et ne peint donc rien de visible (héritage du code
 * d'origine). Elle reste maintenue pour toute page qui fournirait ces ids.
 */
class BinaryTreeVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.treeRoot = null;
        this.animating = false;
        this.NODE_RADIUS = 25;
        this.LEVEL_HEIGHT = 80;
        this.MIN_H_SPACING = 50;
        this.SVG_PADDING_TOP = 50;
        this.SVG_PADDING_BOTTOM = 50;
        this.lastDeleteGuide = null;
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/bst-traces.js'];
    }

    /** Rejoue `trace` (0..N pas), avec un délai animé sur la page, puis fige le résultat. */
    async runTrace(trace, { animate = true } = {}) {
        const last = trace.at(-1);
        if (!animate || trace.length <= 1) {
            this.treeRoot = last.tree;
            this.render(new Set(last.marks.visited), new Set(last.marks.found));
            return last;
        }
        for (const step of trace) {
            this.render(new Set(step.marks.visited), new Set(step.marks.found));
            await OEIUtils.sleep(this.getCurrentDelay(step.delay === 'quick' ? 0.9 : 1));
        }
        this.treeRoot = last.tree;
        this.render(new Set(last.marks.visited), new Set(last.marks.found));
        return last;
    }

    // ── delete guide (panneau pédagogique conservé) ──────────────────────────

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

    /** Réinitialise l'arbre */
    reset() {
        this.treeRoot = null;
        const defaultValues = this.data.visualization?.config?.defaultValues || [50, 30, 70, 20, 40, 60, 80];
        defaultValues.forEach((v) => { this.treeRoot = OEITrace.buildBstInsertTrace(this.treeRoot, v).at(-1).tree; });
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.lastDeleteGuide = null;
        this.render();
        this.renderDeleteGuide(null);
        this.clearHighlight();
    }

    async insertValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;
        if (isNaN(val)) { this.showFeedback('Veuillez entrer un nombre valide.', 'error'); return; }

        const trace = OEITrace.buildBstInsertTrace(this.treeRoot, val);
        const last = await this.runTrace(trace, { animate: false });
        if (input) input.value = '';
        if (!last.ok) { this.showFeedback(`La valeur ${val} existe déjà dans l'arbre.`, 'error'); return; }
        this.showFeedback(`Valeur ${val} insérée avec succès.`, 'success');
    }

    async deleteValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;
        if (isNaN(val)) { this.showFeedback('Veuillez entrer un nombre valide.', 'error'); return; }

        const trace = OEITrace.buildBstDeleteTrace(this.treeRoot, val);
        const last = trace.at(-1);
        if (!last.ok) {
            this.showFeedback(`La valeur ${val} n'existe pas dans l'arbre.`, 'error');
            this.renderDeleteGuide(null, 'error');
            return;
        }

        this.animating = true;
        this.setButtonsDisabled(true);
        this.renderDeleteGuide(last.deleteCase, 'preview');

        await this.runTrace(trace, { animate: true });
        this.state.stepCount += 1;
        if (input) input.value = '';
        this.showFeedback(`Valeur ${val} supprimée avec succès.`, 'success');
        this.renderDeleteGuide(last.deleteCase, 'done');
        this.animating = false;
        this.setButtonsDisabled(false);
    }

    async searchValue() {
        if (this.animating) return;
        const input = document.getElementById('inputValue');
        const val = input ? parseInt(input.value, 10) : NaN;
        if (isNaN(val)) { this.showFeedback('Veuillez entrer un nombre valide.', 'error'); return; }

        this.animating = true;
        this.setButtonsDisabled(true);
        const trace = OEITrace.buildBstSearchTrace(this.treeRoot, val);
        const last = await this.runTrace(trace, { animate: true });
        this.showFeedback(
            last.ok ? `Valeur ${val} trouvée dans l'arbre !` : `Valeur ${val} non trouvée dans l'arbre.`,
            last.ok ? 'success' : 'error'
        );
        this.animating = false;
        this.setButtonsDisabled(false);
    }

    async startTraversal(type) {
        if (this.animating) return;
        if (!this.treeRoot) { this.showFeedback('L\'arbre est vide.', 'error'); return; }

        this.animating = true;
        this.setButtonsDisabled(true);
        const traversalResult = document.getElementById('traversalResult');
        if (traversalResult) traversalResult.innerHTML = '';

        const trace = OEITrace.buildBstTraversalTrace(this.treeRoot, type);
        for (const step of trace) {
            this.render(new Set(step.marks.visited), new Set());
            if (traversalResult && step.order.length) {
                traversalResult.innerHTML = '';
                step.order.forEach((value) => {
                    const badge = document.createElement('span');
                    badge.className = 'badge badge-primary';
                    badge.textContent = value;
                    badge.style.animation = 'fadeIn 0.3s ease';
                    traversalResult.appendChild(badge);
                });
            }
            await OEIUtils.sleep(this.getCurrentDelay());
        }

        this.showFeedback(`Parcours ${type} terminé.`, 'success');
        this.animating = false;
        this.setButtonsDisabled(false);
    }

    resetTree() {
        if (this.animating) return;
        this.reset();
        this.showFeedback('Arbre réinitialisé.', 'info');
    }

    // ── layout + rendu SVG (conservé, alimenté par this.treeRoot) ────────────

    computeLayout(root) {
        if (!root) return { positions: new Map(), width: 0, height: 0 };
        const positions = new Map();
        let index = 0;
        const assignIndex = (node) => {
            if (!node) return;
            assignIndex(node.left);
            positions.set(node.value, { inorderIndex: index, node });
            index++;
            assignIndex(node.right);
        };
        assignIndex(root);

        const totalNodes = index;
        const treeH = OEITrace.bstStats(root).height;
        const svgWidth = Math.max(totalNodes * this.MIN_H_SPACING, 300);
        const svgHeight = treeH * this.LEVEL_HEIGHT + this.SVG_PADDING_TOP + this.SVG_PADDING_BOTTOM;

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

    render(highlightSet, foundSet) {
        highlightSet = highlightSet || new Set();
        foundSet = foundSet || new Set();

        const svg = document.getElementById('treeSvg');
        if (!svg) return;
        svg.innerHTML = '';

        if (!this.treeRoot) {
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

        const { positions, width, height } = this.computeLayout(this.treeRoot);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.minHeight = Math.min(height, 500) + 'px';

        const drawEdges = (node) => {
            if (!node) return;
            const parentPos = positions.get(node.value);
            [['left', node.left], ['right', node.right]].forEach(([, child]) => {
                if (!child) return;
                const childPos = positions.get(child.value);
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', parentPos.x);
                line.setAttribute('y1', parentPos.y);
                line.setAttribute('x2', childPos.x);
                line.setAttribute('y2', childPos.y);
                line.classList.add('edge');
                if (highlightSet.has(node.value) && highlightSet.has(child.value)) line.classList.add('visited');
                if (foundSet.has(node.value) && foundSet.has(child.value)) line.classList.add('found');
                svg.appendChild(line);
                drawEdges(child);
            });
        };
        drawEdges(this.treeRoot);

        const drawNodes = (node) => {
            if (!node) return;
            const pos = positions.get(node.value);
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            circle.setAttribute('r', this.NODE_RADIUS);
            circle.classList.add('node-circle');
            if (foundSet.has(node.value)) circle.classList.add('found');
            else if (highlightSet.has(node.value)) circle.classList.add('visited');
            svg.appendChild(circle);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', pos.x);
            label.setAttribute('y', pos.y);
            label.classList.add('node-label');
            if (foundSet.has(node.value)) label.classList.add('found');
            else if (highlightSet.has(node.value)) label.classList.add('visited');
            label.textContent = node.value;
            svg.appendChild(label);

            drawNodes(node.left);
            drawNodes(node.right);
        };
        drawNodes(this.treeRoot);

        this.updateInfo();
    }

    updateInfo() {
        const stats = OEITrace.bstStats(this.treeRoot);
        const nodeCount = document.getElementById('nodeCount');
        const treeHeight = document.getElementById('treeHeight');
        const treeMin = document.getElementById('treeMin');
        const treeMax = document.getElementById('treeMax');
        if (nodeCount) nodeCount.textContent = stats.count;
        if (treeHeight) treeHeight.textContent = stats.height;
        if (treeMin) treeMin.textContent = stats.min !== null ? stats.min : '—';
        if (treeMax) treeMax.textContent = stats.max !== null ? stats.max : '—';
    }

    showFeedback(message, type) {
        const el = document.getElementById('feedback');
        if (el) {
            el.textContent = message;
            el.className = 'feedback text-center ' + (type || 'info');
        }
    }

    setButtonsDisabled(disabled) {
        document.querySelectorAll('.btn').forEach((btn) => {
            if (!btn.classList.contains('btn-back')) btn.disabled = disabled;
        });
    }

    setupEventListeners() {
        const input = document.getElementById('inputValue');
        if (input) {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.insertValue(); });
        }
    }

    async init() {
        await super.init();
        this.reset();
        this.setupEventListeners();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BinaryTreeVisualizer;
}
if (typeof window !== 'undefined') {
    window.BinaryTreeVisualizer = BinaryTreeVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// BSTWidget — adaptateur SLIDE (et widget de cours `bst-simulator`, seul
// consommateur réel sur structures/arbre-binaire.html). Consomme la MÊME
// trace (bst-traces.js). Insertion/suppression instantanées (comme avant) ;
// recherche/parcours animées via TracePlayer (même granularité — un pas par
// nœud visité — que l'ancien code, cadence désormais pilotable).
// ─────────────────────────────────────────────────────────────────────────────
class BSTWidget {
    static mount(container, config = {}) {
        const w = new BSTWidget(container, config);
        w.init();
        return { destroy: () => w.destroy() };
    }

    constructor(container, config = {}) {
        this.root = container;
        this.config = config;
        this.treeRoot = null;
        this.animating = false;
        this.baseInterval = 500;
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
        this._input = q('input');
        this._feedback = q('feedback');
        this._svg = q('svg');
        this._travEl = q('traversal');
        this._countEl = q('count');
        this._heightEl = q('height');
        this._minEl = q('min');
        this._maxEl = q('max');

        q('insert').addEventListener('click', () => this.insertValue());
        q('delete').addEventListener('click', () => this.deleteValue());
        q('search').addEventListener('click', () => this.searchValue());
        q('reset').addEventListener('click', () => this.resetTree());
        q('inorder').addEventListener('click', () => this.startTraversal('inorder'));
        q('preorder').addEventListener('click', () => this.startTraversal('preorder'));
        q('postorder').addEventListener('click', () => this.startTraversal('postorder'));
        q('bfs').addEventListener('click', () => this.startTraversal('bfs'));
        this._input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.insertValue(); });

        const defaults = this.config.values || [50, 30, 70, 20, 40, 60, 80];
        defaults.forEach((v) => { this.treeRoot = OEITrace.buildBstInsertTrace(this.treeRoot, v).at(-1).tree; });
        this.render();
        this.showFeedback('Arbre initialisé.', 'info');
    }

    insertValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        const last = OEITrace.buildBstInsertTrace(this.treeRoot, val).at(-1);
        this._input.value = '';
        if (!last.ok) { this.showFeedback(`${val} existe déjà.`, 'error'); return; }
        this.treeRoot = last.tree;
        this.render();
        this.showFeedback(`${val} inséré.`, 'success');
    }

    deleteValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        const last = OEITrace.buildBstDeleteTrace(this.treeRoot, val).at(-1);
        if (!last.ok) { this.showFeedback(`${val} introuvable.`, 'error'); return; }
        this.treeRoot = last.tree;
        this._input.value = '';
        this.render();
        this.showFeedback(`${val} supprimé.`, 'success');
    }

    async searchValue() {
        if (this.animating) return;
        const val = parseInt(this._input.value, 10);
        if (isNaN(val)) { this.showFeedback('Valeur invalide.', 'error'); return; }
        this.animating = true;
        const trace = OEITrace.buildBstSearchTrace(this.treeRoot, val);
        for (const step of trace) {
            this.render(new Set(step.marks.visited), new Set(step.marks.found));
            await new Promise((r) => setTimeout(r, this.baseInterval));
        }
        const last = trace.at(-1);
        this.showFeedback(last.ok ? `${val} trouvé !` : `${val} introuvable.`, last.ok ? 'success' : 'error');
        this.animating = false;
    }

    resetTree() {
        if (this.animating) return;
        this.treeRoot = null;
        const defaults = this.config.values || [50, 30, 70, 20, 40, 60, 80];
        defaults.forEach((v) => { this.treeRoot = OEITrace.buildBstInsertTrace(this.treeRoot, v).at(-1).tree; });
        this._travEl.textContent = '';
        this.render();
        this.showFeedback('Arbre réinitialisé.', 'info');
    }

    async startTraversal(type) {
        if (this.animating) return;
        if (!this.treeRoot) { this.showFeedback('Arbre vide.', 'error'); return; }
        this.animating = true;
        const labels = { inorder: 'Infixe', preorder: 'Préfixe', postorder: 'Suffixe', bfs: 'Largeur' };
        const trace = OEITrace.buildBstTraversalTrace(this.treeRoot, type);
        for (const step of trace) {
            this.render(new Set(step.marks.visited));
            if (step.order.length) this._travEl.textContent = `${labels[type]}: ${step.order.join(' → ')}`;
            await new Promise((r) => setTimeout(r, this.baseInterval));
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
        const treeH = OEITrace.bstStats(root).height;
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
        foundSet = foundSet || new Set();
        const svg = this._svg;
        const NS = 'http://www.w3.org/2000/svg';
        svg.innerHTML = '';

        if (!this.treeRoot) {
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

        const { positions, w, h } = this._computeLayout(this.treeRoot);
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
                if (foundSet.has(node.value) && foundSet.has(child.value)) line.classList.add('found');
                svg.appendChild(line);
                drawEdges(child);
            }
        };
        drawEdges(this.treeRoot);

        const drawNodes = (node) => {
            if (!node) return;
            const pos = positions.get(node.value);
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y); circle.setAttribute('r', this.NODE_R);
            circle.classList.add('bst-node');
            if (foundSet.has(node.value)) circle.classList.add('found');
            else if (highlightSet.has(node.value)) circle.classList.add('visited');
            svg.appendChild(circle);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', pos.x); label.setAttribute('y', pos.y);
            label.classList.add('bst-label');
            if (foundSet.has(node.value)) label.classList.add('found');
            else if (highlightSet.has(node.value)) label.classList.add('visited');
            label.textContent = node.value;
            svg.appendChild(label);

            drawNodes(node.left);
            drawNodes(node.right);
        };
        drawNodes(this.treeRoot);
        this._updateInfo();
    }

    _updateInfo() {
        const stats = OEITrace.bstStats(this.treeRoot);
        this._countEl.textContent = stats.count;
        this._heightEl.textContent = stats.height;
        this._minEl.textContent = stats.min !== null ? stats.min : '—';
        this._maxEl.textContent = stats.max !== null ? stats.max : '—';
    }

    showFeedback(msg, type) {
        this._feedback.textContent = msg;
        this._feedback.className = 'bstw-feedback' + (type ? ' ' + type : '');
    }

    destroy() {}
}

if (typeof window !== 'undefined') {
    window.BSTWidget = BSTWidget;
}
