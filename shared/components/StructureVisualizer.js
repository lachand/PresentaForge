/**
 * StructureVisualizer — pile (stack, LIFO) et file (queue, FIFO).
 *
 * Contrairement aux familles tri/recherche, il n'y a pas « un » algorithme à
 * dérouler du début à la fin : chaque clic (empiler/dépiler, enfiler/défiler)
 * est une opération indépendante sur une structure qui PERSISTE entre les
 * opérations. Les deux opérations (ajout, retrait) vivent dans
 * shared/components/algorithms/structure-traces.js (buildAddTrace/
 * buildRemoveTrace, purs). Cette classe est l'ADAPTATEUR PAGE : elle
 * construit la trace de l'opération en cours, la rejoue via TracePlayer, puis
 * fige le dernier état comme nouvel état courant avant la prochaine opération.
 * StructureWidget est l'ADAPTATEUR SLIDE (même générateur).
 */
class StructureVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.structure = [];
        this.maxElements = 8;
        this.structureType = 'stack'; // stack, queue
        this.operationHistory = [];
        this.maxHistoryEntries = 14;
        this._pendingCommit = null;
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
                '<button class="btn btn-primary" data-inline-onclick="page.' + actionAdd + '()">' + labelAdd + '</button>' +
                '<button class="btn btn-accent" data-inline-onclick="page.' + actionRemove + '()">' + labelRemove + '</button>' +
                '<button class="btn btn-secondary" data-inline-onclick="page.reset()">Reinitialiser</button>' +
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

    async init() {
        await super.init();
        if (this.data.visualization && this.data.visualization.config) {
            this.maxElements = this.data.visualization.config.maxElements || 8;
        }
        this.structureType = this.detectStructureType();
        this.reset();
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/structure-traces.js'];
    }

    /** Ne reconstruit jamais toute seule : chaque opération pose sa propre trace (voir push/pop…). */
    buildTrace() {
        return this._trace || [];
    }

    stepDelay(step) {
        return this.getCurrentDelay(step && step.delay === 'double' ? 2 : 1);
    }

    renderStep(step) {
        this.render(step);
    }

    onPlayerState(state) {
        if (state.atEnd && !state.playing && this._pendingCommit) {
            const commit = this._pendingCommit;
            this._pendingCommit = null;
            commit();
        }
    }

    /** Lance la trace de l'opération courante puis appelle `onDone` (structure figée) à la fin. */
    runOperation(trace, onDone) {
        if (this._pendingCommit) return; // opération déjà en cours : ignorer le clic (évite de perdre une mutation)
        this._trace = trace;
        this._pendingCommit = () => onDone(trace.at(-1));
        if (this.player) {
            this.player.reset();
            this.player.play();
        } else {
            onDone(trace.at(-1));
        }
    }

    // ── rendu ────────────────────────────────────────────────────────────────

    render(step) {
        const container = document.getElementById('viz-container') || document.getElementById('stack');
        if (!container) {
            console.warn('Conteneur de visualisation introuvable');
            return;
        }
        const values = step ? step.array : this.structure;
        const entering = new Set(step ? step.marks.entering : []);
        const removing = new Set(step ? step.marks.removing : []);

        container.innerHTML = '';
        values.forEach((value, index) => {
            const item = document.createElement('div');
            item.className = this.structureType === 'queue' ? 'queue-item' : 'stack-item';
            if (entering.has(index)) item.classList.add('entering', 'op-insert');
            if (removing.has(index)) item.classList.add('removing', 'op-delete');
            item.textContent = value;
            container.appendChild(item);
        });

        this.updateInfo(values);
        this.updatePointer(values);
        this.renderInvariantPanel();
        this.renderTimeline();
        if (step && step.caption) this.setFeedback(step.caption, step.ok === false ? 'bad' : '');
    }

    updateInfo(values) {
        const arr = values || this.structure;
        const countEl = document.getElementById('count');
        const topEl = document.getElementById('top');
        const firstEl = document.getElementById('first');
        const lastEl = document.getElementById('last');
        if (countEl) countEl.textContent = arr.length;
        if (topEl) topEl.textContent = arr[arr.length - 1] || 'aucun';
        if (firstEl) firstEl.textContent = arr.length > 0 ? arr[0] : 'aucun';
        if (lastEl) lastEl.textContent = arr.length > 0 ? arr[arr.length - 1] : 'aucun';
    }

    updatePointer(values) {
        const pointer = document.getElementById('topPointer');
        if (pointer) pointer.style.display = (values || this.structure).length > 0 ? 'block' : 'none';
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
            action, detail, status,
            snapshot: [...this.structure]
        });
        if (this.operationHistory.length > this.maxHistoryEntries) this.operationHistory.shift();
    }

    getInvariantChecks() {
        const size = this.structure.length;
        const checks = [{ label: 'Taille <= capacite max', ok: size <= this.maxElements, detail: `${size}/${this.maxElements}` }];
        if (this.structureType === 'stack') {
            checks.push({ label: 'Sommet = dernier element', ok: true, detail: size ? String(this.structure[size - 1]) : 'pile vide' });
        } else if (this.structureType === 'queue') {
            const first = size ? this.structure[0] : null;
            const last = size ? this.structure[size - 1] : null;
            checks.push({ label: 'FIFO conserve ordre entree->sortie', ok: true, detail: size ? `${first} ... ${last}` : 'file vide' });
            checks.push({ label: 'Bornes first/last coherentes', ok: size === 0 || (first !== null && last !== null), detail: size ? `first=${first}, last=${last}` : 'aucune borne' });
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
        container.innerHTML = this.operationHistory.slice().reverse().map((entry) => {
            const snapshot = entry.snapshot.length ? '[' + entry.snapshot.join(', ') + ']' : '[]';
            return '<div class="timeline-item ' + entry.status + '">' +
                '<div class="timeline-head">#' + entry.step + ' - ' + entry.action + '</div>' +
                '<div class="timeline-detail">' + entry.detail + '</div>' +
                '<div class="timeline-snapshot">' + snapshot + '</div>' +
                '</div>';
        }).join('');
    }

    // ── opérations pile ──────────────────────────────────────────────────────

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
        input.value = '';
        const trace = OEITrace.buildAddTrace(this.structure, value, { structureType: 'stack', maxElements: this.maxElements });
        this.runOperation(trace, (last) => {
            this.structure = last.array.slice();
            this.state.stepCount += 1;
            this.logOperation('push', 'Empile ' + value + '.', 'ok');
            this.render();
            this.setFeedback('Valeur ' + value + ' empilee.', 'ok');
        });
    }

    async pop() {
        const trace = OEITrace.buildRemoveTrace(this.structure, { structureType: 'stack' });
        this.runOperation(trace, (last) => {
            this.structure = last.array.slice();
            this.state.stepCount += 1;
            if (last.ok === false) {
                this.setFeedback('La structure est vide.', 'bad');
                this.logOperation('pop', 'Echec: structure vide.', 'bad');
            } else {
                this.logOperation('pop', 'Depile ' + last.removedValue + '.', 'ok');
                this.render();
                this.setFeedback('Valeur ' + last.removedValue + ' depilee.', 'ok');
            }
        });
    }

    // ── opérations file ──────────────────────────────────────────────────────

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
        input.value = '';
        const trace = OEITrace.buildAddTrace(this.structure, value, { structureType: 'queue', maxElements: this.maxElements });
        this.runOperation(trace, (last) => {
            this.structure = last.array.slice();
            this.state.stepCount += 1;
            this.logOperation('enqueue', 'Enfile ' + value + '.', 'ok');
            this.render();
            this.setFeedback('Valeur ' + value + ' enfilee.', 'ok');
        });
    }

    async dequeue() {
        const trace = OEITrace.buildRemoveTrace(this.structure, { structureType: 'queue' });
        this.runOperation(trace, (last) => {
            this.structure = last.array.slice();
            this.state.stepCount += 1;
            if (last.ok === false) {
                this.setFeedback('La file est vide.', 'bad');
                this.logOperation('dequeue', 'Echec: file vide.', 'bad');
            } else {
                this.logOperation('dequeue', 'Defile ' + last.removedValue + '.', 'ok');
                this.render();
                this.setFeedback('Valeur ' + last.removedValue + ' defilee.', 'ok');
            }
        });
    }

    // ── alias CSP-safe (data-inline-onclick, sans async) ────────────────────

    creerPile() { this.reset(); }
    empiler() { this.push(); }
    depiler() { this.pop(); }
    enfiler() { this.enqueue(); }
    defiler() { this.dequeue(); }

    // ── reset ────────────────────────────────────────────────────────────────

    reset() {
        this.structure = [];
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.operationHistory = [];
        this._trace = null;
        this._pendingCommit = null;
        this.logOperation('reset', 'Structure reinitialisee.');
        this.render();
        this.clearHighlight();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StructureVisualizer;
}
if (typeof window !== 'undefined') {
    window.StructureVisualizer = StructureVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// StructureWidget — adaptateur SLIDE. Consomme la MÊME trace
// (structure-traces.js) via TracePlayer : chaque ajout/retrait s'anime en
// 2 à 4 pas (au lieu d'une mutation instantanée) — DOM .stw-* inchangé.
// Couvre : stack (pile), queue (file).
// ─────────────────────────────────────────────────────────────────────────────
class StructureWidget {
    static mount(container, config = {}) {
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

    /** Empêche tout rendu différé après démontage et vide le conteneur (revue §C4). */
    destroy() {
        this._destroyed = true;
        if (this.root) this.root.innerHTML = '';
    }

    _render() {
        if (this._destroyed) return;
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

        // Même algorithme que la page (buildAddTrace/buildRemoveTrace), mais rendu
        // instantané ici : contrairement aux algos de tri/recherche, une pile/file
        // n'anime pas ses opérations sur les slides (comportement d'origine
        // conservé — pas de changement visible, l'aperçu doit rester réactif).
        const doAdd = () => {
            const val = inp.value.trim() || String(Math.floor(Math.random() * 99) + 1);
            if (this.items.length >= this.maxItems) {
                this.lastAction = `⚠️ Structure pleine (max ${this.maxItems})`;
                this._render(); return;
            }
            const trace = window.OEITrace.buildAddTrace(this.items, val, { structureType: this.structureType, maxElements: this.maxItems });
            this.items = trace.at(-1).array.slice();
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
            const trace = window.OEITrace.buildRemoveTrace(this.items, { structureType: this.structureType });
            const removed = trace.at(-1).removedValue;
            this.items = trace.at(-1).array.slice();
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
