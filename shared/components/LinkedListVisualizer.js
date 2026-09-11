/**
 * LinkedListVisualizer — liste chaînée simple.
 *
 * Les 5 opérations (ajouter en tête/queue/position, supprimer, rechercher)
 * vivent dans shared/components/algorithms/linkedlist-traces.js, pures : une
 * liste y est un tableau de valeurs `[v0, v1, …]`, jamais une classe
 * Noeud/ListeChainee à pointeurs — le pointeur-chasing (prev/current/next)
 * reste une affaire de VISUALISATION (`marks`), pas de structure de données.
 * Cette classe est l'ADAPTATEUR PAGE ; LinkedListWidget l'ADAPTATEUR SLIDE.
 */
class LinkedListVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.values = [];
        this.isAnimating = false;
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this.foundIndex = -1;
        this.deleteIndex = -1;
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/linkedlist-traces.js'];
    }

    /** Rejoue `trace` en animant chaque pas (délai piloté par la vitesse), puis fige le résultat. */
    async runTrace(trace) {
        for (const step of trace) {
            this.applyStepState(step);
            this.render();
            await OEIUtils.sleep(this.getCurrentDelay(step.delay === 'quick' ? 0.75 : 1));
        }
        return trace.at(-1);
    }

    applyStepState(step) {
        this.values = step.array.slice();
        this.pointerState = {
            prev: step.marks.prev[0] ?? -1,
            current: step.marks.current[0] ?? -1,
            next: step.marks.next[0] ?? -1
        };
        this.foundIndex = step.marks.found[0] ?? -1;
        this.deleteIndex = step.marks.removing[0] ?? -1;
        this._enteringIndex = step.marks.entering[0] ?? -1;
    }

    reset() {
        this.values = [];
        const defaultValues = this.data.visualization?.config?.defaultValues || [10, 25, 42, 7];
        defaultValues.forEach((v) => { this.values = OEITrace.buildListInsertTailTrace(this.values, v).at(-1).array; });
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this._enteringIndex = -1;
        this.render();
        this.clearHighlight();
    }

    async ajouterEnTete() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputHead');
        const val = input ? input.value.trim() : '';
        if (!val) { this.setFeedback('Veuillez entrer une valeur.', 'error'); return; }

        this.isAnimating = true;
        const trace = OEITrace.buildListInsertHeadTrace(this.values, val);
        await this.runTrace(trace);
        this.state.stepCount += 1;
        if (input) input.value = '';
        this.setFeedback(`"${val}" ajouté en tête de liste.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this._enteringIndex = -1;
        this.render();
        this.clearHighlight();
        this.isAnimating = false;
    }

    async ajouterEnQueue() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputTail');
        const val = input ? input.value.trim() : '';
        if (!val) { this.setFeedback('Veuillez entrer une valeur.', 'error'); return; }

        this.isAnimating = true;
        const trace = OEITrace.buildListInsertTailTrace(this.values, val);
        await this.runTrace(trace);
        this.state.stepCount += 1;
        if (input) input.value = '';
        this.setFeedback(`"${val}" ajouté en queue de liste.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this._enteringIndex = -1;
        this.render();
        this.isAnimating = false;
    }

    async ajouterAPosition() {
        if (this.isAnimating) return;
        const inputVal = document.getElementById('inputPosVal');
        const inputPos = document.getElementById('inputPos');
        const val = inputVal ? inputVal.value.trim() : '';
        const pos = inputPos ? parseInt(inputPos.value, 10) : NaN;
        if (!val) { this.setFeedback('Veuillez entrer une valeur.', 'error'); return; }

        const trace = OEITrace.buildListInsertAtTrace(this.values, val, pos);
        const last = trace.at(-1);
        if (!last.ok) { this.setFeedback(last.caption, 'error'); return; }

        this.isAnimating = true;
        await this.runTrace(trace);
        this.state.stepCount += 1;
        if (inputVal) inputVal.value = '';
        if (inputPos) inputPos.value = '';
        this.setFeedback(`"${val}" ajouté à la position ${pos}.`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.9));
        this._enteringIndex = -1;
        this.render();
        this.isAnimating = false;
    }

    async supprimerParValeur() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputDelete');
        const val = input ? input.value.trim() : '';
        if (!val) { this.setFeedback('Veuillez entrer une valeur à supprimer.', 'error'); return; }

        const trace = OEITrace.buildListRemoveTrace(this.values, val);
        const last = trace.at(-1);
        if (!last.ok) { this.setFeedback(`"${val}" non trouvé dans la liste.`, 'error'); return; }

        this.isAnimating = true;
        await this.runTrace(trace);
        this.state.stepCount += 1;
        if (input) input.value = '';
        this.setFeedback(`"${last.removedValue}" supprimé de la liste (position ${last.removedIndex}).`, 'success');

        await OEIUtils.sleep(this.getCurrentDelay(0.8));
        this.clearHighlight();
        this.isAnimating = false;
    }

    async rechercher() {
        if (this.isAnimating) return;
        const input = document.getElementById('inputSearch');
        const val = input ? input.value.trim() : '';
        if (!val) { this.setFeedback('Veuillez entrer une valeur à rechercher.', 'error'); return; }

        this.clearHighlights();
        const trace = OEITrace.buildListSearchTrace(this.values, val);
        const last = trace.at(-1);
        if (!last.ok) { this.setFeedback(`"${val}" non trouvé dans la liste.`, 'error'); return; }

        this.isAnimating = true;
        await this.runTrace(trace);
        if (input) input.value = '';
        this.setFeedback(`"${val}" trouvé à la position ${last.marks.found[0]}.`, 'success');
        await OEIUtils.sleep(this.getCurrentDelay(0.8));
        this.isAnimating = false;
    }

    reinitialiser() {
        if (this.isAnimating) return;
        this.reset();
        this.setFeedback('Liste réinitialisée avec les valeurs par défaut.', 'info');
    }

    // ── rendu ────────────────────────────────────────────────────────────────

    render() {
        const container = document.getElementById('listContainer');
        const headPointer = document.getElementById('headPointer');
        if (!container) return;

        const values = this.values;
        container.innerHTML = '';

        if (values.length === 0) {
            container.classList.add('empty-message');
            if (headPointer) headPointer.style.display = 'none';
        } else {
            container.classList.remove('empty-message');
            if (headPointer) headPointer.style.display = 'flex';
        }

        values.forEach((val, i) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'node-wrapper';
            if (i === this._enteringIndex) wrapper.classList.add('entering');
            if (i === this.pointerState.prev) wrapper.classList.add('ptr-prev');
            if (i === this.pointerState.current) wrapper.classList.add('ptr-current');
            if (i === this.pointerState.next) wrapper.classList.add('ptr-next');

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
            nextDiv.textContent = i < values.length - 1 ? '•' : '/';

            node.appendChild(valueDiv);
            node.appendChild(nextDiv);
            wrapper.appendChild(node);

            const arrow = document.createElement('div');
            arrow.className = 'node-arrow';
            arrow.innerHTML = '<div class="arrow-line' + (i === this.pointerState.current ? ' traversing' : '') + '"></div>';
            wrapper.appendChild(arrow);

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

    updateInfo() {
        const sizeDisplay = document.getElementById('sizeDisplay');
        const headDisplay = document.getElementById('headDisplay');
        const tailDisplay = document.getElementById('tailDisplay');
        if (sizeDisplay) sizeDisplay.textContent = this.values.length;
        if (headDisplay) headDisplay.textContent = this.values.length ? this.values[0] : 'null';
        if (tailDisplay) tailDisplay.textContent = this.values.length ? this.values[this.values.length - 1] : 'null';
    }

    renderPointerStatePanel() {
        const host = document.getElementById('pointerState');
        if (!host) return;
        const fmt = (index) => {
            if (index == null || index < 0 || index >= this.values.length) return 'null';
            return '#' + index + ' (' + this.values[index] + ')';
        };
        host.innerHTML = '<div class="ptr-state-row"><span>prev</span><strong>' + fmt(this.pointerState.prev) + '</strong></div>' +
            '<div class="ptr-state-row"><span>current</span><strong>' + fmt(this.pointerState.current) + '</strong></div>' +
            '<div class="ptr-state-row"><span>next</span><strong>' + fmt(this.pointerState.next) + '</strong></div>';
    }

    clearHighlights() {
        this.foundIndex = -1;
        this.deleteIndex = -1;
        this.pointerState = { prev: -1, current: -1, next: -1 };
        this.render();
    }

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
            if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') action(); });
        });
    }

    async init() {
        await super.init();
        this.reset();
        this.setupEventListeners();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LinkedListVisualizer;
}
if (typeof window !== 'undefined') {
    window.LinkedListVisualizer = LinkedListVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedListWidget — adaptateur SLIDE. Consomme la MÊME trace
// (linkedlist-traces.js). Insertion/suppression/recherche restent
// instantanées (comme avant — aucune animation par pas sur les slides, pour
// éviter la régression déjà observée sur pile/file avec des opérations
// animées trop lentes face à des clics rapprochés). DOM .llw-* inchangé.
// ─────────────────────────────────────────────────────────────────────────────
class LinkedListWidget {
    static mount(container, config = {}) {
        const w = new LinkedListWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._defaultValues = (Array.isArray(config.values) && config.values.length > 0)
            ? config.values.map(Number) : [3, 7, 1, 9, 4];
        this.values = this._defaultValues.slice();
        this._highlighted = new Set();
        this._foundIdx = -1;
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

    /** Empêche tout rendu différé après démontage et vide le conteneur (revue §C4). */
    destroy() {
        this._destroyed = true;
        if (this.root) this.root.innerHTML = '';
    }

    _render() {
        if (this._destroyed) return;
        const zone = this.root.querySelector('.llw-list-zone');
        if (!zone) return;
        if (this.values.length === 0) {
            zone.innerHTML = '<span class="llw-null">Liste vide (null)</span>';
        } else {
            zone.innerHTML = this.values.map((val, i) => {
                const cls = this._highlighted.has(i) ? 'active' : (i === this._foundIdx ? 'found' : '');
                const badge = i === 0 ? '<span class="llw-badge">HEAD</span>' : '';
                const box = `<div class="llw-box ${cls} ${i === 0 ? 'head-mark' : ''}">${val}${badge}</div>`;
                const link = i < this.values.length - 1
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

    _bindControls() {
        this.root.querySelector('.llw-btn-head')?.addEventListener('click', () => {
            const v = this._val();
            if (isNaN(v)) { this._action = 'Entrez une valeur.'; this._render(); return; }
            const last = window.OEITrace.buildListInsertHeadTrace(this.values, v).at(-1);
            this.values = last.array;
            this._highlighted = new Set(last.marks.entering);
            this._foundIdx = -1;
            this._action = `+Tete : ${v} insere en O(1) — nouvelle tete`;
            this._render();
        });
        this.root.querySelector('.llw-btn-tail')?.addEventListener('click', () => {
            const v = this._val();
            if (isNaN(v)) { this._action = 'Entrez une valeur.'; this._render(); return; }
            const last = window.OEITrace.buildListInsertTailTrace(this.values, v).at(-1);
            this.values = last.array;
            this._highlighted = new Set(last.marks.entering);
            this._foundIdx = -1;
            this._action = `+Queue : ${v} insere en O(n=${this.values.length}) — parcours complet`;
            this._render();
        });
        this.root.querySelector('.llw-btn-remove')?.addEventListener('click', () => {
            const v = this._val();
            const last = window.OEITrace.buildListRemoveTrace(this.values, v).at(-1);
            this._highlighted = new Set();
            this._foundIdx = -1;
            if (!last.ok) { this._action = `Valeur ${v} introuvable.`; this._render(); return; }
            this.values = last.array;
            this._action = `Supprime : ${last.removedValue} (indice ${last.removedIndex}) — ${last.removedIndex + 1} comparaison(s)`;
            this._render();
        });
        this.root.querySelector('.llw-btn-search')?.addEventListener('click', () => {
            const v = this._val();
            this._highlighted = new Set();
            const trace = window.OEITrace.buildListSearchTrace(this.values, v);
            const last = trace.at(-1);
            if (!last.ok) {
                this._foundIdx = -1;
                this._action = `Valeur ${v} non trouvee (${this.values.length} comparaisons)`;
            } else {
                this._foundIdx = last.marks.found[0];
                this._action = `Valeur ${v} trouvee a l'indice ${this._foundIdx} (${this._foundIdx + 1} comparaison(s))`;
            }
            this._render();
        });
        this.root.querySelector('.llw-btn-reset')?.addEventListener('click', () => {
            this.values = this._defaultValues.slice();
            this._highlighted = new Set();
            this._foundIdx = -1;
            this._action = 'Liste reinitialisee.';
            this._render();
        });
    }
}

if (typeof window !== 'undefined') {
    window.LinkedListWidget = LinkedListWidget;
}
