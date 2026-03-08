/**
 * LinkedListVisualizer - Visualisation de listes chaînées
 *
 * Opérations :
 * - ajouterEnTete(valeur) : Ajouter un nœud en tête (O(1))
 * - ajouterEnQueue(valeur) : Ajouter un nœud en queue (O(n))
 * - ajouterAPosition(valeur, position) : Ajouter à un indice spécifique
 * - supprimerParValeur(valeur) : Supprimer un nœud par sa valeur
 * - rechercher(valeur) : Rechercher un nœud
 * - reinitialiser() : Réinitialiser avec valeurs par défaut
 */

class Noeud {
    constructor(valeur) {
        this.valeur = valeur;
        this.suivant = null;
    }
}

class ListeChainee {
    constructor() {
        this.tete = null;
        this.taille = 0;
    }

    ajouterEnTete(valeur) {
        const nouveau = new Noeud(valeur);
        nouveau.suivant = this.tete;
        this.tete = nouveau;
        this.taille++;
    }

    ajouterEnQueue(valeur) {
        const nouveau = new Noeud(valeur);
        if (!this.tete) {
            this.tete = nouveau;
        } else {
            let courant = this.tete;
            while (courant.suivant) courant = courant.suivant;
            courant.suivant = nouveau;
        }
        this.taille++;
    }

    ajouterAPosition(valeur, position) {
        if (position < 0 || position > this.taille) return false;
        if (position === 0) { this.ajouterEnTete(valeur); return true; }
        const nouveau = new Noeud(valeur);
        let courant = this.tete;
        for (let i = 0; i < position - 1; i++) courant = courant.suivant;
        nouveau.suivant = courant.suivant;
        courant.suivant = nouveau;
        this.taille++;
        return true;
    }

    supprimerParValeur(valeur) {
        if (!this.tete) return -1;
        if (String(this.tete.valeur) === String(valeur)) {
            this.tete = this.tete.suivant;
            this.taille--;
            return 0;
        }
        let courant = this.tete;
        let index = 0;
        while (courant.suivant) {
            if (String(courant.suivant.valeur) === String(valeur)) {
                courant.suivant = courant.suivant.suivant;
                this.taille--;
                return index + 1;
            }
            courant = courant.suivant;
            index++;
        }
        return -1;
    }

    rechercher(valeur) {
        let courant = this.tete;
        let index = 0;
        while (courant) {
            if (String(courant.valeur) === String(valeur)) return index;
            courant = courant.suivant;
            index++;
        }
        return -1;
    }

    getTete() {
        return this.tete ? this.tete.valeur : null;
    }

    getQueue() {
        if (!this.tete) return null;
        let courant = this.tete;
        while (courant.suivant) courant = courant.suivant;
        return courant.valeur;
    }

    toArray() {
        const arr = [];
        let courant = this.tete;
        while (courant) {
            arr.push(courant.valeur);
            courant = courant.suivant;
        }
        return arr;
    }
}

class LinkedListVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.liste = new ListeChainee();
        this.isAnimating = false;
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this.foundIndex = -1;
        this.deleteIndex = -1;
    }

    /**
     * Réinitialise la liste
     */
    reset() {
        this.liste = new ListeChainee();
        const defaultValues = this.data.visualization?.config?.defaultValues || [10, 25, 42, 7];
        defaultValues.forEach(v => this.liste.ajouterEnQueue(v));
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this.render();
        this.clearHighlight();
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    setTraversalPointers(prev, current, next) {
        this.pointerState = { prev, current, next };
    }

    resetTraversalPointers() {
        this.pointerState = { prev: -1, current: -1, next: -1 };
    }

    /**
     * Ajouter en tête avec animation
     */
    async ajouterEnTete() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputHead');
        const val = input ? input.value.trim() : '';
        if (!val) {
            this.setFeedback('Veuillez entrer une valeur.', 'error');
            return;
        }

        this.isAnimating = true;

        this.highlightLine('ajouterEnTete-line0');
        await OEIUtils.sleep(this.getCurrentDelay());
        this.highlightLine('ajouterEnTete-line1');
        await OEIUtils.sleep(this.getCurrentDelay());
        this.highlightLine('ajouterEnTete-line2');
        await OEIUtils.sleep(this.getCurrentDelay());
        this.highlightLine('ajouterEnTete-line3');

        this.liste.ajouterEnTete(val);
        this.state.stepCount += 1;
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this.setTraversalPointers(-1, 0, this.liste.taille > 1 ? 1 : -1);
        this.render(0, 'entering');
        if (input) input.value = '';
        this.setFeedback(`"${val}" ajouté en tête de liste.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this.resetTraversalPointers();
        this.render();
        this.clearHighlight();
        this.isAnimating = false;
    }

    /**
     * Ajouter en queue avec animation
     */
    async ajouterEnQueue() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputTail');
        const val = input ? input.value.trim() : '';
        if (!val) {
            this.setFeedback('Veuillez entrer une valeur.', 'error');
            return;
        }

        this.isAnimating = true;
        this.liste.ajouterEnQueue(val);
        this.state.stepCount += 1;
        this.foundIndex = -1;
        this.deleteIndex = -1;
        const idx = this.liste.taille - 1;
        this.setTraversalPointers(idx - 1, idx, -1);
        this.render(this.liste.taille - 1, 'entering');
        if (input) input.value = '';
        this.setFeedback(`"${val}" ajouté en queue de liste.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this.resetTraversalPointers();
        this.render();
        this.isAnimating = false;
    }

    /**
     * Ajouter à une position donnée
     */
    async ajouterAPosition() {
        if (this.isAnimating) return;
        const inputVal = document.getElementById('inputPosVal');
        const inputPos = document.getElementById('inputPos');
        const val = inputVal ? inputVal.value.trim() : '';
        const pos = inputPos ? parseInt(inputPos.value, 10) : NaN;

        if (!val) {
            this.setFeedback('Veuillez entrer une valeur.', 'error');
            return;
        }
        if (isNaN(pos) || pos < 0 || pos > this.liste.taille) {
            this.setFeedback(`Position invalide. Choisissez entre 0 et ${this.liste.taille}.`, 'error');
            return;
        }

        this.isAnimating = true;
        this.liste.ajouterAPosition(val, pos);
        this.state.stepCount += 1;
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this.setTraversalPointers(pos - 1, pos, pos + 1 < this.liste.taille ? pos + 1 : -1);
        this.render(pos, 'entering');
        if (inputVal) inputVal.value = '';
        if (inputPos) inputPos.value = '';
        this.setFeedback(`"${val}" ajouté à la position ${pos}.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this.resetTraversalPointers();
        this.render();
        this.isAnimating = false;
    }

    /**
     * Supprimer par valeur avec animation
     */
    async supprimerParValeur() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputDelete');
        const val = input ? input.value.trim() : '';
        if (!val) {
            this.setFeedback('Veuillez entrer une valeur à supprimer.', 'error');
            return;
        }

        const index = this.liste.rechercher(val);
        if (index === -1) {
            this.setFeedback(`"${val}" non trouvé dans la liste.`, 'error');
            return;
        }

        this.isAnimating = true;
        this.foundIndex = -1;
        this.highlightLine('supprimer-line1');
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay());

        for (let step = 0; step < index; step++) {
            this.highlightLine(step === 0 ? 'supprimer-line6' : 'supprimer-line7');
            this.setTraversalPointers(step - 1, step, step + 1);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay());
        }

        this.deleteIndex = index;
        this.highlightLine(index === 0 ? 'supprimer-line3' : 'supprimer-line8');
        this.setTraversalPointers(index - 1, index, index + 1 < this.liste.taille ? index + 1 : -1);
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay());

        this.liste.supprimerParValeur(val);
        this.state.stepCount += 1;
        this.deleteIndex = -1;
        this.resetTraversalPointers();
        this.highlightLine(index === 0 ? 'supprimer-line4' : 'supprimer-line9');
        this.render();
        if (input) input.value = '';
        this.setFeedback(`"${val}" supprimé de la liste (position ${index}).`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.8));
        this.clearHighlight();
        this.isAnimating = false;
    }

    /**
     * Rechercher une valeur avec animation
     */
    async rechercher() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputSearch');
        const val = input ? input.value.trim() : '';
        if (!val) {
            this.setFeedback('Veuillez entrer une valeur à rechercher.', 'error');
            return;
        }

        this.clearHighlights();
        const index = this.liste.rechercher(val);

        if (index === -1) {
            this.setFeedback(`"${val}" non trouvé dans la liste.`, 'error');
            return;
        }

        this.isAnimating = true;
        this.foundIndex = -1;
        for (let step = 0; step <= index; step++) {
            this.setTraversalPointers(step - 1, step, step + 1 < this.liste.taille ? step + 1 : -1);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay());
        }

        this.foundIndex = index;
        this.resetTraversalPointers();
        this.render();
        if (input) input.value = '';
        this.setFeedback(`"${val}" trouvé à la position ${index}.`, 'success');
        await OEIUtils.sleep(this.getCurrentDelay(0.8));
        this.isAnimating = false;
    }

    /**
     * Réinitialiser avec valeurs par défaut
     */
    reinitialiser() {
        if (this.isAnimating) return;
        this.reset();
        this.setFeedback('Liste réinitialisée avec les valeurs par défaut.', 'info');
    }

    /**
     * Rendu de la liste chaînée
     */
    render(animateIndex, animationType) {
        const container = document.getElementById('listContainer');
        const headPointer = document.getElementById('headPointer');
        if (!container) return;

        const values = this.liste.toArray();
        container.innerHTML = '';

        if (values.length === 0) {
            container.classList.add('empty-message');
            if (headPointer) headPointer.style.display = 'none';
        } else {
            container.classList.remove('empty-message');
            if (headPointer) headPointer.style.display = 'flex';
        }

        values.forEach((val, i) => {
            // Node wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'node-wrapper';
            if (i === animateIndex && animationType) {
                wrapper.classList.add(animationType);
            }
            if (i === this.pointerState.prev) wrapper.classList.add('ptr-prev');
            if (i === this.pointerState.current) wrapper.classList.add('ptr-current');
            if (i === this.pointerState.next) wrapper.classList.add('ptr-next');

            // Node
            const node = document.createElement('div');
            node.className = 'll-node';
            node.dataset.index = i;
            if (i === this.foundIndex) node.classList.add('found');
            if (i === this.deleteIndex) node.classList.add('delete-target');

            const valueDiv = document.createElement('div');
            valueDiv.className = 'node-value';
            valueDiv.textContent = val;

            const nextDiv = document.createElement('div');
            nextDiv.className = 'node-next';
            nextDiv.textContent = i < values.length - 1 ? '\u2022' : '/';

            node.appendChild(valueDiv);
            node.appendChild(nextDiv);
            wrapper.appendChild(node);

            // Arrow
            const arrow = document.createElement('div');
            arrow.className = 'node-arrow';
            arrow.innerHTML = '<div class="arrow-line' + (i === this.pointerState.current ? ' traversing' : '') + '"></div>';
            wrapper.appendChild(arrow);

            // Null terminator for last node
            if (i === values.length - 1) {
                const nullLabel = document.createElement('div');
                nullLabel.className = 'null-label';
                nullLabel.textContent = 'null';
                wrapper.appendChild(nullLabel);
            }

            container.appendChild(wrapper);
        });

        this.updateInfo();
        this.renderPointerStatePanel();
    }

    /**
     * Mise à jour des informations
     */
    updateInfo() {
        const sizeDisplay = document.getElementById('sizeDisplay');
        const headDisplay = document.getElementById('headDisplay');
        const tailDisplay = document.getElementById('tailDisplay');

        if (sizeDisplay) sizeDisplay.textContent = this.liste.taille;
        if (headDisplay) headDisplay.textContent = this.liste.getTete() !== null ? this.liste.getTete() : 'null';
        if (tailDisplay) tailDisplay.textContent = this.liste.getQueue() !== null ? this.liste.getQueue() : 'null';
    }

    renderPointerStatePanel() {
        const host = document.getElementById('pointerState');
        if (!host) return;

        const fmt = (index) => {
            if (index == null || index < 0 || index >= this.liste.taille) return 'null';
            const values = this.liste.toArray();
            return '#' + index + ' (' + values[index] + ')';
        };

        host.innerHTML = '<div class="ptr-state-row"><span>prev</span><strong>' + fmt(this.pointerState.prev) + '</strong></div>' +
            '<div class="ptr-state-row"><span>current</span><strong>' + fmt(this.pointerState.current) + '</strong></div>' +
            '<div class="ptr-state-row"><span>next</span><strong>' + fmt(this.pointerState.next) + '</strong></div>';
    }

    /**
     * Efface les highlights de recherche
     */
    clearHighlights() {
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this.resetTraversalPointers();
        this.render();
    }

    /**
     * Message de feedback
     */
    setFeedback(message, type) {
        const fb = document.getElementById('feedback');
        if (fb) {
            fb.textContent = message;
            fb.className = 'feedback text-center ' + type;
            if (message) {
                clearTimeout(fb._timer);
                fb._timer = setTimeout(() => {
                    fb.textContent = '';
                    fb.className = 'feedback text-center';
                }, 3500);
            }
        }
    }

    /**
     * Configuration des événements clavier
     */
    setupEventListeners() {
        const inputs = [
            { id: 'inputHead', action: () => this.ajouterEnTete() },
            { id: 'inputTail', action: () => this.ajouterEnQueue() },
            { id: 'inputPos', action: () => this.ajouterAPosition() },
            { id: 'inputPosVal', action: () => this.ajouterAPosition() },
            { id: 'inputDelete', action: () => this.supprimerParValeur() },
            { id: 'inputSearch', action: () => this.rechercher() }
        ];

        inputs.forEach(({ id, action }) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('keydown', e => {
                    if (e.key === 'Enter') action();
                });
            }
        });
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

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkedListVisualizer;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.LinkedListVisualizer = LinkedListVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedListWidget — Widget autonome pour intégration dans les slides
// Usage : LinkedListWidget.mount(container, { values: [3, 7, 1, 9, 4] })
// ─────────────────────────────────────────────────────────────────────────────
class LinkedListWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (LinkedListWidget._stylesInjected) return;
        LinkedListWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.llw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.llw-header{font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.llw-list-zone{display:flex;align-items:center;flex-wrap:wrap;min-height:50px;padding:8px 0;row-gap:8px;}
.llw-node{display:flex;align-items:center;}
.llw-box{min-width:36px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:.8rem;font-weight:600;background:var(--sl-primary,#6366f1);color:#fff;border:2px solid rgba(0,0,0,.22);transition:background .2s,border-color .2s;padding:0 6px;box-shadow:inset 0 1px 0 rgba(255,255,255,.2);}
.llw-box.head-mark{border-color:var(--sl-accent,#f97316);}
.llw-box.active{background:var(--sl-accent,#f97316);}
.llw-box.found{background:#22c55e;}
.llw-arrow{color:var(--sl-muted,#94a3b8);font-size:1rem;padding:0 3px;}
.llw-null{font-size:.7rem;color:var(--sl-muted,#94a3b8);font-style:italic;padding-left:4px;}
.llw-badge{font-size:.58rem;background:var(--sl-accent,#f97316);color:#fff;border-radius:3px;padding:1px 3px;margin-left:2px;}
.llw-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.llw-input{background:var(--surface,rgba(0,0,0,.18));border:1px solid var(--border,var(--sl-border,#334155));border-radius:6px;padding:4px 8px;font-size:.75rem;color:var(--text,var(--sl-text,#e2e8f0));width:58px;}
.llw-btn{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.llw-btn:hover:not(:disabled){opacity:.8;}
.llw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
.llw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        LinkedListWidget.ensureStyles();
        const w = new LinkedListWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._defaultValues = (Array.isArray(config.values) && config.values.length > 0)
            ? config.values.map(Number) : [3, 7, 1, 9, 4];
        this._nodes = this._defaultValues.map(v => ({ val: v, cls: '' }));
        this._action = 'Liste chainee — ajoutez ou supprimez des noeuds';
    }

    init() {
        this.root.innerHTML = `<div class="llw-container">
            <div class="llw-header">Liste chainee</div>
            <div class="llw-list-zone"></div>
            <div class="llw-info-bar llw-action"></div>
            <div class="llw-controls">
                <input type="number" class="llw-input llw-val-input" placeholder="val" value="5">
                <button class="llw-btn llw-btn-head">+Tete</button>
                <button class="llw-btn llw-btn-tail llw-btn-secondary">+Queue</button>
                <button class="llw-btn llw-btn-remove llw-btn-secondary">-Valeur</button>
                <button class="llw-btn llw-btn-search llw-btn-secondary">Chercher</button>
                <button class="llw-btn llw-btn-reset llw-btn-secondary">&#8635;</button>
            </div>
        </div>`;
        this._render();
        this._bindControls();
    }

    _render() {
        const zone = this.root.querySelector('.llw-list-zone');
        if (!zone) return;
        if (this._nodes.length === 0) {
            zone.innerHTML = '<span class="llw-null">Liste vide (null)</span>';
        } else {
            zone.innerHTML = this._nodes.map((node, i) => {
                const badge = i === 0 ? '<span class="llw-badge">HEAD</span>' : '';
                const box = `<div class="llw-box ${node.cls} ${i === 0 ? 'head-mark' : ''}">${node.val}${badge}</div>`;
                const link = i < this._nodes.length - 1
                    ? '<span class="llw-arrow">&#8594;</span>'
                    : '<span class="llw-null">&#8594;null</span>';
                return `<div class="llw-node">${box}${link}</div>`;
            }).join('');
        }
        const act = this.root.querySelector('.llw-action');
        if (act) act.textContent = this._action;
    }

    _val() {
        const el = this.root.querySelector('.llw-val-input');
        return el ? parseInt(el.value, 10) : NaN;
    }

    _clearHighlights() { this._nodes.forEach(n => n.cls = ''); }

    _bindControls() {
        this.root.querySelector('.llw-btn-head')?.addEventListener('click', () => {
            const v = this._val();
            if (isNaN(v)) { this._action = 'Entrez une valeur.'; this._render(); return; }
            this._clearHighlights();
            this._nodes.unshift({ val: v, cls: 'active' });
            this._action = `+Tete : ${v} insere en O(1) — nouvelle tete`;
            this._render();
        });
        this.root.querySelector('.llw-btn-tail')?.addEventListener('click', () => {
            const v = this._val();
            if (isNaN(v)) { this._action = 'Entrez une valeur.'; this._render(); return; }
            this._clearHighlights();
            this._nodes.push({ val: v, cls: 'active' });
            this._action = `+Queue : ${v} insere en O(n=${this._nodes.length}) — parcours complet`;
            this._render();
        });
        this.root.querySelector('.llw-btn-remove')?.addEventListener('click', () => {
            const v = this._val();
            const idx = this._nodes.findIndex(n => n.val === v);
            if (idx === -1) { this._action = `Valeur ${v} introuvable.`; this._render(); return; }
            this._nodes.splice(idx, 1);
            this._clearHighlights();
            this._action = `Supprime : ${v} (indice ${idx}) — ${idx + 1} comparaison(s)`;
            this._render();
        });
        this.root.querySelector('.llw-btn-search')?.addEventListener('click', () => {
            const v = this._val();
            this._clearHighlights();
            const idx = this._nodes.findIndex(n => n.val === v);
            if (idx === -1) {
                this._action = `Valeur ${v} non trouvee (${this._nodes.length} comparaisons)`;
            } else {
                this._nodes[idx].cls = 'found';
                this._action = `Valeur ${v} trouvee a l'indice ${idx} (${idx + 1} comparaison(s))`;
            }
            this._render();
        });
        this.root.querySelector('.llw-btn-reset')?.addEventListener('click', () => {
            this._nodes = this._defaultValues.map(v => ({ val: v, cls: '' }));
            this._action = 'Liste reinitialisee.';
            this._render();
        });
    }
}

if (typeof window !== 'undefined') {
    window.LinkedListWidget = LinkedListWidget;
}
