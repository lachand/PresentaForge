/**
 * StructureVisualizer - Visualisation de structures de données linéaires
 *
 * Supporte : Pile (stack), File (queue), Dictionnaire (dict)
 * Hérite de SimulationPage pour la gestion du cours, contrôles, pseudocode
 */
class StructureVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.structure = [];
        this.maxElements = 8;
        this.structureType = 'stack'; // stack, queue, dict
        this.operationHistory = [];
        this.maxHistoryEntries = 14;
    }

    detectStructureType() {
        const vizType = (this.data?.visualization?.type || '').toLowerCase();
        const metaId = (this.data?.metadata?.id || '').toLowerCase();
        const pathHint = (this.dataPath || '').toLowerCase();

        if (vizType.includes('queue') || metaId === 'file' || pathHint.includes('/file.json')) {
            return 'queue';
        }
        return 'stack';
    }

    getDefaultControlsHtml() {
        const isQueue = this.structureType === 'queue';
        const actionAdd = isQueue ? 'enfiler' : 'empiler';
        const actionRemove = isQueue ? 'defiler' : 'depiler';
        const labelAdd = isQueue ? 'Enfiler' : 'Empiler';
        const labelRemove = isQueue ? 'Defiler' : 'Depiler';
        const placeholder = isQueue ? 'Valeur a enfiler' : 'Valeur a empiler';

        return '' +
            '<div class="controls">' +
                '<input type="text" id="input" placeholder="' + placeholder + '" class="input">' +
                '<button class="btn btn-primary" onclick="page.' + actionAdd + '()">' + labelAdd + '</button>' +
                '<button class="btn btn-accent" onclick="page.' + actionRemove + '()">' + labelRemove + '</button>' +
                '<button class="btn btn-secondary" onclick="page.reset()">Reinitialiser</button>' +
            '</div>' +
            '<div class="speed-control">' +
                '<label for="speedSlider">Vitesse de simulation :</label>' +
                '<input type="range" id="speedSlider" class="speed-slider" min="1" max="5" value="3" step="1">' +
                '<span class="speed-label" id="speedLabel">Normal</span>' +
            '</div>';
    }

    setupControls() {
        const container = document.getElementById('controls-container');
        if (!container) {
            console.warn('Conteneur controls-container introuvable');
            return;
        }

        this.structureType = this.detectStructureType();

        if (Array.isArray(this.data?.controls) && this.data.controls.length > 0) {
            container.innerHTML = this.generateControls();
            return;
        }

        container.innerHTML = this.getDefaultControlsHtml();
    }

    /**
     * Initialise le visualiseur
     */
    async init() {
        await super.init();

        // Récupérer la configuration depuis les données JSON
        if (this.data.visualization && this.data.visualization.config) {
            this.maxElements = this.data.visualization.config.maxElements || 8;
        }

        this.structureType = this.detectStructureType();

        this.reset();
    }

    /**
     * Réinitialise la structure
     */
    reset() {
        this.structure = [];
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.operationHistory = [];
        this.logOperation('reset', 'Structure reinitialisee.');
        this.render();
        this.clearHighlight();
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    setFeedback(message, cls = '') {
        const feedback = document.getElementById('feedback');
        if (!feedback) return;
        feedback.textContent = message || '';
        feedback.className = 'feedback ' + (cls || '');
    }

    logOperation(action, detail, status = 'info') {
        this.operationHistory.push({
            step: this.state.stepCount,
            action,
            detail,
            status,
            snapshot: [...this.structure]
        });
        if (this.operationHistory.length > this.maxHistoryEntries) {
            this.operationHistory.shift();
        }
    }

    getInvariantChecks() {
        const size = this.structure.length;
        const checks = [{
            label: 'Taille <= capacite max',
            ok: size <= this.maxElements,
            detail: `${size}/${this.maxElements}`
        }];

        if (this.structureType === 'stack') {
            checks.push({
                label: 'Sommet = dernier element',
                ok: true,
                detail: size ? String(this.structure[size - 1]) : 'pile vide'
            });
        } else if (this.structureType === 'queue') {
            const first = size ? this.structure[0] : null;
            const last = size ? this.structure[size - 1] : null;
            checks.push({
                label: 'FIFO conserve ordre entree->sortie',
                ok: true,
                detail: size ? `${first} ... ${last}` : 'file vide'
            });
            checks.push({
                label: 'Bornes first/last coherentes',
                ok: size === 0 || (first !== null && last !== null),
                detail: size ? `first=${first}, last=${last}` : 'aucune borne'
            });
        }

        return checks;
    }

    renderInvariantPanel() {
        const container = document.getElementById('structureInvariants');
        if (!container) return;
        container.innerHTML = this.getInvariantChecks().map((check) => {
            const tone = check.ok ? 'ok' : 'bad';
            const state = check.ok ? 'OK' : 'A verifier';
            return '<div class="structure-check ' + tone + '">' +
                '<span class="structure-check-name">' + check.label + '</span>' +
                '<span class="structure-check-state">' + state + '</span>' +
                '<span class="structure-check-detail">' + check.detail + '</span>' +
                '</div>';
        }).join('');
    }

    renderTimeline() {
        const container = document.getElementById('structureTimeline');
        if (!container) return;
        if (!this.operationHistory.length) {
            container.innerHTML = '<div class="text-muted text-sm">Aucune operation.</div>';
            return;
        }

        container.innerHTML = this.operationHistory
            .slice()
            .reverse()
            .map((entry) => {
                const snapshot = entry.snapshot.length ? '[' + entry.snapshot.join(', ') + ']' : '[]';
                return '<div class="timeline-item ' + entry.status + '">' +
                    '<div class="timeline-head">#' + entry.step + ' - ' + entry.action + '</div>' +
                    '<div class="timeline-detail">' + entry.detail + '</div>' +
                    '<div class="timeline-snapshot">' + snapshot + '</div>' +
                    '</div>';
            })
            .join('');
    }

    // ============================================
    // OPÉRATIONS SUR LA PILE
    // ============================================

    /**
     * Empile un élément (pour pile)
     */
    async push() {
        const input = document.getElementById('input');
        const value = input.value.trim();

        if (!value) {
            this.setFeedback('Veuillez entrer une valeur.', 'bad');
            this.logOperation('push', 'Echec: valeur vide.', 'bad');
            this.renderTimeline();
            return;
        }

        if (this.structure.length >= this.maxElements) {
            this.setFeedback('La structure est pleine.', 'bad');
            this.logOperation('push', 'Echec: capacite atteinte.', 'bad');
            this.renderTimeline();
            return;
        }

        // Highlighting du pseudocode
        this.highlightLine('empiler-line0');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('empiler-line1');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('empiler-line2');
        this.structure.push(value);
        this.state.stepCount += 1;
        this.logOperation('push', 'Empile ' + value + '.', 'ok');
        input.value = '';
        this.render();
        this.animateLastItem('entering op-insert');
        this.setFeedback('Valeur ' + value + ' empilee.', 'ok');

        await OEIUtils.sleep(this.getCurrentDelay(2));
        this.clearHighlight();
    }

    /**
     * Dépile un élément (pour pile)
     */
    async pop() {
        // Vérifier si la pile est vide
        if (this.structure.length === 0) {
            this.highlightLine('depiler-line0');
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('depiler-line1');
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('depiler-line2');
            this.setFeedback('La structure est vide.', 'bad');
            this.logOperation('pop', 'Echec: structure vide.', 'bad');
            this.renderTimeline();
            this.clearHighlight();
            return;
        }

        this.highlightLine('depiler-line0');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('depiler-line3');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('depiler-line4');

        // Animation de suppression
        const items = document.querySelectorAll('.stack-item, .queue-item');
        const lastItem = items[items.length - 1];
        if (lastItem) {
            lastItem.classList.add('removing');
            lastItem.classList.add('op-delete');
        }

        await OEIUtils.sleep(this.getCurrentDelay());

        const removed = this.structure.pop();
        this.state.stepCount += 1;
        this.logOperation('pop', 'Depile ' + removed + '.', 'ok');
        this.render();
        this.setFeedback('Valeur ' + removed + ' depilee.', 'ok');

        this.highlightLine('depiler-line5');
        await OEIUtils.sleep(this.getCurrentDelay(2));
        this.clearHighlight();
    }

    // ============================================
    // OPÉRATIONS SUR LA FILE
    // ============================================

    /**
     * Enfile un élément (pour file)
     */
    async enqueue() {
        const input = document.getElementById('input');
        const value = input.value.trim();

        if (!value) {
            this.setFeedback('Veuillez entrer une valeur.', 'bad');
            this.logOperation('enqueue', 'Echec: valeur vide.', 'bad');
            this.renderTimeline();
            return;
        }

        if (this.structure.length >= this.maxElements) {
            this.setFeedback('La file est pleine.', 'bad');
            this.logOperation('enqueue', 'Echec: capacite atteinte.', 'bad');
            this.renderTimeline();
            return;
        }

        this.highlightLine('enfiler-line0');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('enfiler-line1');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('enfiler-line2');
        this.structure.push(value);
        this.state.stepCount += 1;
        this.logOperation('enqueue', 'Enfile ' + value + '.', 'ok');
        input.value = '';
        this.render();
        this.animateLastItem('entering op-insert');
        this.setFeedback('Valeur ' + value + ' enfilee.', 'ok');

        await OEIUtils.sleep(this.getCurrentDelay(2));
        this.clearHighlight();
    }

    /**
     * Défile un élément (pour file)
     */
    async dequeue() {
        if (this.structure.length === 0) {
            this.highlightLine('defiler-line0');
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('defiler-line1');
            await OEIUtils.sleep(this.getCurrentDelay());

            this.highlightLine('defiler-line2');
            this.setFeedback('La file est vide.', 'bad');
            this.logOperation('dequeue', 'Echec: file vide.', 'bad');
            this.renderTimeline();
            this.clearHighlight();
            return;
        }

        this.highlightLine('defiler-line0');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('defiler-line3');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('defiler-line4');

        // Animation de suppression du premier élément
        const items = document.querySelectorAll('.stack-item, .queue-item');
        const firstItem = items[0];
        if (firstItem) {
            firstItem.classList.add('removing');
            firstItem.classList.add('op-delete');
        }

        await OEIUtils.sleep(this.getCurrentDelay());

        const removed = this.structure.shift(); // Retire le premier élément
        this.state.stepCount += 1;
        this.logOperation('dequeue', 'Defile ' + removed + '.', 'ok');
        this.render();
        this.setFeedback('Valeur ' + removed + ' defilee.', 'ok');

        this.highlightLine('defiler-line5');
        await OEIUtils.sleep(this.getCurrentDelay(2));
        this.clearHighlight();
    }

    // ============================================
    // RENDU DE LA VISUALISATION
    // ============================================

    /**
     * Met à jour l'affichage de la structure
     */
    render() {
        const container = document.getElementById('viz-container') || document.getElementById('stack');
        if (!container) {
            console.warn('Conteneur de visualisation introuvable');
            return;
        }

        // Vider le conteneur
        container.innerHTML = '';

        // Créer les éléments visuels
        this.structure.forEach((value, index) => {
            const item = document.createElement('div');
            item.className = this.structureType === 'queue' ? 'queue-item' : 'stack-item';
            item.textContent = value;
            container.appendChild(item);
        });

        // Mettre à jour les informations
        this.updateInfo();
        this.updatePointer();
        this.renderInvariantPanel();
        this.renderTimeline();
    }

    /**
     * Met à jour les informations affichées
     */
    updateInfo() {
        const countEl = document.getElementById('count');
        const topEl = document.getElementById('top');
        const firstEl = document.getElementById('first');
        const lastEl = document.getElementById('last');

        if (countEl) {
            countEl.textContent = this.structure.length;
        }

        if (topEl) {
            const lastElement = this.structure[this.structure.length - 1];
            topEl.textContent = lastElement || 'aucun';
        }

        if (firstEl) {
            firstEl.textContent = this.structure.length > 0 ? this.structure[0] : 'aucun';
        }

        if (lastEl) {
            lastEl.textContent = this.structure.length > 0 ? this.structure[this.structure.length - 1] : 'aucun';
        }
    }

    /**
     * Met à jour le pointeur de sommet (pour pile)
     */
    updatePointer() {
        const pointer = document.getElementById('topPointer');
        if (pointer) {
            pointer.style.display = this.structure.length > 0 ? 'block' : 'none';
        }
    }

    /**
     * Anime le dernier élément ajouté
     * @param {string} animClass - Classe d'animation à ajouter
     */
    animateLastItem(animClass) {
        const items = document.querySelectorAll('.stack-item, .queue-item');
        const lastItem = items[items.length - 1];
        const classes = String(animClass || '')
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);

        if (lastItem && classes.length) {
            classes.forEach((token) => lastItem.classList.add(token));
            setTimeout(() => {
                classes.forEach((token) => lastItem.classList.remove(token));
            }, 300);
        }
    }

    // ============================================
    // MÉTHODES OPTIONNELLES (pour compatibilité)
    // ============================================

    /**
     * Alias pour reset() - pour compatibilité avec l'ancien code
     */
    creerPile() {
        this.reset();
    }

    /**
     * Alias pour push() - sans async pour compatibilité onclick
     */
    empiler() {
        this.push();
    }

    /**
     * Alias pour pop() - sans async pour compatibilité onclick
     */
    depiler() {
        this.pop();
    }

    /**
     * Alias pour enqueue()
     */
    enfiler() {
        this.enqueue();
    }

    /**
     * Alias pour dequeue()
     */
    defiler() {
        this.dequeue();
    }
}

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StructureVisualizer;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.StructureVisualizer = StructureVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// StructureWidget — Widget autonome pour intégration dans les slides
// Couvre : stack (pile), queue (file)
// Usage : StructureWidget.mount(container, { type: 'stack' })
// ─────────────────────────────────────────────────────────────────────────────
class StructureWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (StructureWidget._stylesInjected) return;
        StructureWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.stw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.stw-header{font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);display:flex;justify-content:space-between;align-items:center;}
.stw-input-row{display:flex;gap:8px;align-items:center;}
.stw-input-row input{flex:1;padding:5px 10px;border-radius:5px;border:1px solid var(--border,var(--sl-border,#334155));background:var(--surface,rgba(0,0,0,.18));color:var(--text,var(--sl-text,#e2e8f0));font-size:.8rem;}
.stw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.75rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;white-space:nowrap;}
.stw-btn:hover:not(:disabled){opacity:.8;}
.stw-btn:disabled{opacity:.35;cursor:not-allowed;}
.stw-btn-danger{background:#ef4444;}
.stw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
.stw-viz{flex:1;display:flex;min-height:0;gap:12px;align-items:flex-end;justify-content:center;}
.stw-stack-zone{display:flex;flex-direction:column-reverse;gap:4px;align-items:center;min-width:120px;max-width:200px;padding:8px;border:1px dashed var(--sl-border,#334155);border-radius:8px;min-height:80px;justify-content:flex-start;}
.stw-queue-zone{display:flex;flex-direction:row;gap:4px;align-items:center;flex-wrap:wrap;padding:8px;border:1px dashed var(--sl-border,#334155);border-radius:8px;min-height:60px;align-content:flex-start;}
.stw-item{padding:6px 16px;border-radius:6px;background:var(--sl-primary,#6366f1);color:#fff;font-size:.85rem;font-weight:600;transition:all .3s;text-align:center;white-space:nowrap;border:1px solid rgba(0,0,0,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.2);}
.stw-item.new-item{background:var(--sl-accent,#f97316);animation:stw-pop .3s ease-out;}
.stw-item.top-item{outline:2px solid var(--sl-accent,#f97316);}
.stw-arrow{font-size:.8rem;color:var(--sl-muted,#94a3b8);}
@keyframes stw-pop{0%{transform:scale(1.25);opacity:.5;}100%{transform:scale(1);opacity:1;}}
.stw-info{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;display:flex;justify-content:space-between;}
.stw-empty-hint{font-size:.7rem;color:var(--sl-muted,#64748b);text-align:center;padding:12px 0;}
.stw-labels{display:flex;flex-direction:row;justify-content:space-between;font-size:.65rem;color:var(--sl-muted,#94a3b8);padding:0 4px;}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        StructureWidget.ensureStyles();
        const w = new StructureWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        const t = config.type || config.algorithm || 'stack';
        this.structureType = (t === 'struct-queue' || t === 'queue') ? 'queue' : 'stack';
        this.maxItems = config.maxItems || 8;
        this.items = [];
        this.lastAction = '';
        this.newItemIndex = -1;
    }

    init() {
        const isQueue = this.structureType === 'queue';
        const title = isQueue ? 'File (Queue) — FIFO' : 'Pile (Stack) — LIFO';
        const addLabel = isQueue ? 'Enfiler' : 'Empiler';
        const removeLabel = isQueue ? 'Défiler' : 'Dépiler';
        this.root.innerHTML = `<div class="stw-container">
            <div class="stw-header"><span>${title}</span><span class="stw-size-info"></span></div>
            <div class="stw-input-row">
                <input type="text" class="stw-input" placeholder="Valeur…" value="">
                <button class="stw-btn stw-btn-add">${addLabel}</button>
                <button class="stw-btn stw-btn-danger stw-btn-remove">${removeLabel}</button>
                <button class="stw-btn stw-btn-secondary stw-btn-reset">↺</button>
            </div>
            <div class="stw-viz">
                ${isQueue
                    ? `<div><div class="stw-labels"><span>Sortie ←</span><span>→ Entrée</span></div><div class="stw-queue-zone"></div></div>`
                    : `<div class="stw-stack-zone"></div>`}
            </div>
            <div class="stw-info"><span class="stw-action"></span><span class="stw-size-label"></span></div>
        </div>`;
        this._render();
        this._bindControls();
    }

    _render() {
        const zone = this.root.querySelector(this.structureType === 'queue' ? '.stw-queue-zone' : '.stw-stack-zone');
        if (!zone) return;
        zone.innerHTML = '';
        if (this.items.length === 0) {
            zone.innerHTML = `<div class="stw-empty-hint">Structure vide</div>`;
        } else {
            this.items.forEach((v, i) => {
                const el = document.createElement('div');
                el.className = 'stw-item';
                if (i === this.newItemIndex) el.classList.add('new-item');
                if (this.structureType === 'stack' && i === this.items.length - 1) el.classList.add('top-item');
                if (this.structureType === 'queue' && i === 0) el.classList.add('top-item');
                el.textContent = v;
                zone.appendChild(el);
            });
        }
        const actionEl = this.root.querySelector('.stw-action');
        if (actionEl) actionEl.textContent = this.lastAction;
        const sizeEl = this.root.querySelector('.stw-size-label');
        if (sizeEl) sizeEl.textContent = `Taille : ${this.items.length} / ${this.maxItems}`;
        const sizeInfo = this.root.querySelector('.stw-size-info');
        if (sizeInfo) sizeInfo.textContent = `${this.items.length} élément${this.items.length !== 1 ? 's' : ''}`;
    }

    _bindControls() {
        const inp = this.root.querySelector('.stw-input');
        const addBtn = this.root.querySelector('.stw-btn-add');
        const removeBtn = this.root.querySelector('.stw-btn-remove');
        const resetBtn = this.root.querySelector('.stw-btn-reset');

        const doAdd = () => {
            const val = inp.value.trim() || String(Math.floor(Math.random() * 99) + 1);
            if (this.items.length >= this.maxItems) {
                this.lastAction = `⚠️ Structure pleine (max ${this.maxItems})`;
                this._render(); return;
            }
            this.items.push(val);
            this.newItemIndex = this.items.length - 1;
            const label = this.structureType === 'queue' ? 'Enfilé' : 'Empilé';
            this.lastAction = `${label} : "${val}"`;
            inp.value = '';
            this._render();
            setTimeout(() => { this.newItemIndex = -1; this._render(); }, 600);
        };
        const doRemove = () => {
            if (this.items.length === 0) {
                this.lastAction = '⚠️ Structure vide';
                this._render(); return;
            }
            const removed = this.structureType === 'queue' ? this.items.shift() : this.items.pop();
            const label = this.structureType === 'queue' ? 'Défilé' : 'Dépilé';
            this.lastAction = `${label} : "${removed}"`;
            this._render();
        };
        addBtn?.addEventListener('click', doAdd);
        inp?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
        removeBtn?.addEventListener('click', doRemove);
        resetBtn?.addEventListener('click', () => { this.items = []; this.lastAction = 'Structure réinitialisée'; this._render(); });
    }
}

if (typeof window !== 'undefined') {
    window.StructureWidget = StructureWidget;
}
