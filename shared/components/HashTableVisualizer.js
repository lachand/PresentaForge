/**
 * HashTableVisualizer — table de hachage à chaînage séparé.
 *
 * La mécanique de bucket (sonder/comparer/insérer/mettre à jour/supprimer)
 * vit dans shared/components/algorithms/hashtable-traces.js, pure. Comme
 * pour les structures pile/file et la liste chaînée, chaque clic est une
 * opération INDÉPENDANTE sur une table qui PERSISTE entre les opérations —
 * pas « un » algorithme à dérouler du début à la fin. Cette classe est
 * l'ADAPTATEUR PAGE (hash polynomial d'une clé texte, mode 'map' — une clé
 * déjà présente met à jour sa valeur) ; HashTableWidget l'ADAPTATEUR SLIDE
 * (clé numérique directe, mode 'multiset' — comportement d'origine inchangé,
 * pas de recherche de doublon).
 */
class HashTableVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.NUM_BUCKETS = 10;
        this.table = [];
        this.totalCollisions = 0;
        this._pendingCommit = null;
    }

    // ── contrat trace ────────────────────────────────────────────────────────

    traceGeneratorScripts() {
        return ['algorithms/hashtable-traces.js'];
    }

    /** Ne reconstruit jamais toute seule : chaque opération pose sa propre trace (voir doInsert/doSearch/doDelete). */
    buildTrace() {
        return this._trace || [];
    }

    stepDelay(step) {
        return this.getCurrentDelay(step && step.delay === 'quick' ? 0.8 : 1);
    }

    /** Rendu d'un pas : buckets + panneau de calcul de hash. Le panneau "feedback"
     *  n'est mis à jour qu'à la fin de l'opération (voir doInsert/doSearch/doDelete),
     *  pas à chaque pas — comme dans le code d'origine (aucun flicker de message). */
    renderStep(step) {
        this.table = step.table;
        this.renderBuckets(step.marks.activeBucket, step.marks.indices.length
            ? { bucket: step.marks.activeBucket, indices: step.marks.indices, cls: step.marks.cls }
            : null);
        if (step.info) this.showHashSteps(step.key, step.info);
    }

    onPlayerState(state) {
        if (state.atEnd && !state.playing && this._pendingCommit) {
            const commit = this._pendingCommit;
            this._pendingCommit = null;
            commit();
        }
    }

    /** Lance la trace de l'opération courante puis appelle `onDone` (table figée) à la fin. */
    runOperation(trace, onDone) {
        if (this._pendingCommit) return; // opération déjà en cours : ignorer le clic
        this._trace = trace;
        this._pendingCommit = () => onDone(trace.at(-1));
        if (this.player) {
            this.player.reset();
            this.player.play();
        } else {
            onDone(trace.at(-1));
        }
    }

    /**
     * Initialise la table
     */
    initTable() {
        this.table = Array.from({ length: this.NUM_BUCKETS }, () => []);
        this.totalCollisions = 0;
        this.renderBuckets();
        this.updateStats();
    }

    /**
     * Reset
     */
    reset() {
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this._trace = null;
        this._pendingCommit = null;
        this.initTable();
        this.loadDefaultData();
    }

    /**
     * Charge les données par défaut
     */
    loadDefaultData() {
        const defaultData = this.data.visualization?.config?.defaultData || [];
        for (const d of defaultData) {
            const info = this.hashKey(d.key);
            if (this.table[info.hash].length > 0) this.totalCollisions++;
            this.table[info.hash].push({ key: d.key, value: d.value });
        }
        this.renderBuckets();
        this.updateStats();
    }

    /**
     * Calcule le hash d'une clé (méthode choisie par #hashFn, modulo par défaut)
     */
    hashKey(key) {
        const raw = Math.abs(OEITrace.polynomialHash(key));
        const methodEl = document.getElementById('hashFn');
        const method = methodEl ? methodEl.value : 'modulo';
        return OEITrace.computeHashInfo(raw, { method, numBuckets: this.NUM_BUCKETS });
    }

    /**
     * Affiche les étapes du calcul de hash
     */
    showHashSteps(key, info) {
        const el = document.getElementById('hashSteps');
        if (!el) return;
        let html = '<div class="step">Cle : "<strong>' + this.escHtml(String(key)) + '</strong>" &rarr; valeur numerique : <strong>' + info.raw + '</strong></div>';
        if (info.method === 'modulo') {
            html += '<div class="step">' + info.raw + ' mod ' + this.NUM_BUCKETS + ' = <span class="step-result">' + info.hash + '</span></div>';
        } else {
            html += '<div class="step">' + info.raw + ' &times; A = ' + (info.raw * info.A).toFixed(4) + ', partie fractionnaire = ' + info.frac.toFixed(6) + '</div>';
            html += '<div class="step">&lfloor;' + info.frac.toFixed(6) + ' &times; ' + this.NUM_BUCKETS + '&rfloor; = <span class="step-result">' + info.hash + '</span></div>';
        }
        el.innerHTML = html;
    }

    /**
     * Rendu des buckets
     */
    renderBuckets(activeBucket, highlightNodes) {
        const container = document.getElementById('bucketsContainer');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < this.NUM_BUCKETS; i++) {
            const row = document.createElement('div');
            row.className = 'bucket-row';

            const idx = document.createElement('div');
            idx.className = 'bucket-index';
            idx.textContent = i;
            row.appendChild(idx);

            const chain = document.createElement('div');
            chain.className = 'bucket-chain';
            if (i === activeBucket) chain.classList.add('active-bucket');

            if (this.table[i].length === 0) {
                const empty = document.createElement('span');
                empty.className = 'bucket-empty';
                empty.textContent = 'vide';
                chain.appendChild(empty);
            } else {
                this.table[i].forEach((node, ni) => {
                    if (ni > 0) {
                        const arrow = document.createElement('span');
                        arrow.className = 'chain-arrow';
                        arrow.textContent = '→';
                        chain.appendChild(arrow);
                    }
                    const nd = document.createElement('span');
                    nd.className = 'chain-node';
                    if (highlightNodes && highlightNodes.bucket === i && highlightNodes.indices.includes(ni)) {
                        nd.classList.add(highlightNodes.cls);
                    }
                    nd.textContent = node.key + ':' + node.value;
                    chain.appendChild(nd);
                });
            }

            row.appendChild(chain);
            container.appendChild(row);
        }
    }

    /**
     * Met à jour les statistiques
     */
    updateStats() {
        const total = this.table.reduce((s, b) => s + b.length, 0);
        const maxChain = this.table.reduce((m, b) => Math.max(m, b.length), 0);
        const nonEmpty = this.table.filter((b) => b.length > 0).length;
        const statElements = document.getElementById('statElements');
        const statBuckets = document.getElementById('statBuckets');
        const statLoad = document.getElementById('statLoad');
        const statCollisions = document.getElementById('statCollisions');
        const statMaxChain = document.getElementById('statMaxChain');
        const statNonEmpty = document.getElementById('statNonEmpty');

        if (statElements) statElements.textContent = total;
        if (statBuckets) statBuckets.textContent = this.NUM_BUCKETS;
        if (statLoad) statLoad.textContent = (total / this.NUM_BUCKETS).toFixed(2);
        if (statCollisions) statCollisions.textContent = this.totalCollisions;
        if (statMaxChain) statMaxChain.textContent = String(maxChain);
        if (statNonEmpty) statNonEmpty.textContent = String(nonEmpty);
        this.renderBucketHistogram();
    }

    renderBucketHistogram() {
        const host = document.getElementById('bucketHistogram');
        if (!host) return;

        const maxLen = this.table.reduce((m, b) => Math.max(m, b.length), 0);
        host.innerHTML = '';

        this.table.forEach((bucket, idx) => {
            const row = document.createElement('div');
            row.className = 'hist-row';

            const label = document.createElement('span');
            label.className = 'hist-label';
            label.textContent = idx;

            const barWrap = document.createElement('div');
            barWrap.className = 'hist-bar-wrap';

            const bar = document.createElement('div');
            bar.className = 'hist-bar';
            const ratio = maxLen === 0 ? 0 : (bucket.length / maxLen);
            bar.style.width = (ratio * 100).toFixed(1) + '%';
            bar.textContent = bucket.length ? String(bucket.length) : '';
            if (bucket.length === maxLen && maxLen > 0) bar.classList.add('peak');

            barWrap.appendChild(bar);
            row.appendChild(label);
            row.appendChild(barWrap);
            host.appendChild(row);
        });
    }

    /**
     * Feedback
     */
    setFeedback(msg, cls) {
        const fb = document.getElementById('feedback');
        if (fb) {
            fb.textContent = msg;
            fb.className = 'feedback ' + cls;
        }
    }

    /**
     * Basculer entre pseudocode insertion/recherche
     */
    showPseudo(tab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const insertEl = document.getElementById('pseudo-insert');
        const searchEl = document.getElementById('pseudo-search');
        if (insertEl) insertEl.classList.add('hidden');
        if (searchEl) searchEl.classList.add('hidden');
        const targetEl = document.getElementById('pseudo-' + tab);
        if (targetEl) targetEl.classList.remove('hidden');
        if (event && event.target) event.target.classList.add('active');
    }

    getInspectorContainerIds() {
        return ['pseudo-insert', 'pseudo-search'];
    }

    /** Rend les deux blocs de pseudocode dans leurs conteneurs respectifs. */
    setupPseudocode() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-insert', blockFilter: 'insert' });
        PseudocodeSupport.renderFromData(this.data, { containerId: 'pseudo-search', blockFilter: 'search' });
    }

    /**
     * Met à jour l'info de la fonction de hachage
     */
    updateHashInfo() {
        const info = document.getElementById('hashFnInfo');
        if (!info) return;
        const hashFnEl = document.getElementById('hashFn');
        if (hashFnEl && hashFnEl.value === 'multiplication') {
            info.innerHTML = '<strong>Multiplication :</strong> h(k) = &lfloor;m &times; (kA mod 1)&rfloor;<br>A &asymp; 0.618 (nombre d\'or). Meilleure distribution.';
        } else {
            info.innerHTML = '<strong>Modulo :</strong> h(k) = k mod m<br>Simple et rapide. Sensible au choix de m.';
        }
    }

    /**
     * Insertion
     */
    doInsert() {
        if (this._pendingCommit) return;
        const key = document.getElementById('inputKey')?.value.trim();
        const value = document.getElementById('inputValue')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle.', 'error'); return; }
        if (!value) { this.setFeedback('Veuillez entrer une valeur.', 'error'); return; }

        this.showPseudo('insert');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const firstTab = document.querySelectorAll('.tab-btn')[0];
        if (firstTab) firstTab.classList.add('active');

        const info = this.hashKey(key);
        const trace = OEITrace.buildHashInsertTrace(this.table, key, value, info, { mode: 'map' });
        this.runOperation(trace, (last) => {
            this.table = last.table;
            if (!last.updated && last.collision) this.totalCollisions++;
            this.updateStats();
            this.setFeedback(
                last.updated
                    ? 'Cle "' + key + '" mise a jour avec valeur "' + value + '".'
                    : 'Cle "' + key + '" inseree dans le bucket ' + info.hash + '.',
                'success'
            );
            // La dernière ligne de pseudocode reste visible un temps avant de s'effacer
            // (comme le sleep(getCurrentDelay()) final du code d'origine).
            setTimeout(() => {
                this.clearHighlight();
                const inputKey = document.getElementById('inputKey');
                const inputValue = document.getElementById('inputValue');
                if (inputKey) inputKey.value = '';
                if (inputValue) inputValue.value = '';
            }, this.getCurrentDelay());
        });
    }

    /**
     * Recherche
     */
    doSearch() {
        if (this._pendingCommit) return;
        const key = document.getElementById('inputKey')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle a rechercher.', 'error'); return; }

        this.showPseudo('search');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const secondTab = document.querySelectorAll('.tab-btn')[1];
        if (secondTab) secondTab.classList.add('active');

        const info = this.hashKey(key);
        const trace = OEITrace.buildHashSearchTrace(this.table, key, info);
        this.runOperation(trace, (last) => {
            if (last.ok) {
                const idx = last.marks.indices[0];
                const foundValue = last.table[info.hash][idx].value;
                this.setFeedback('Cle "' + key + '" trouvee ! Valeur : "' + foundValue + '"', 'success');
            } else {
                this.setFeedback('Cle "' + key + '" non trouvee.', 'error');
            }
            setTimeout(() => this.clearHighlight(), this.getCurrentDelay());
        });
    }

    /**
     * Suppression
     */
    doDelete() {
        if (this._pendingCommit) return;
        const key = document.getElementById('inputKey')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle a supprimer.', 'error'); return; }

        const info = this.hashKey(key);
        const trace = OEITrace.buildHashDeleteTrace(this.table, key, info);
        this.runOperation(trace, (last) => {
            this.table = last.table;
            if (last.ok) this.updateStats();
            this.setFeedback(
                last.ok ? 'Cle "' + key + '" supprimee.' : 'Cle "' + key + '" non trouvee.',
                last.ok ? 'success' : 'error'
            );
            setTimeout(() => {
                this.clearHighlight();
                const inputKey = document.getElementById('inputKey');
                if (inputKey) inputKey.value = '';
            }, this.getCurrentDelay());
        });
    }

    /**
     * Réinitialiser
     */
    resetTable() {
        this._pendingCommit = null;
        this.clearHighlight();
        const hashSteps = document.getElementById('hashSteps');
        if (hashSteps) hashSteps.innerHTML = '<span class="text-muted">Effectuez une operation pour voir le calcul du hash.</span>';
        this.setFeedback('', '');
        this.initTable();
        this.loadDefaultData();
    }

    /**
     * Échappement HTML
     */
    escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Rendu principal (compatibilité avec SimulationPage)
     */
    render() {
        this.renderBuckets();
        this.updateStats();
    }

    /**
     * Initialisation
     */
    async init() {
        await super.init();
        this.NUM_BUCKETS = this.data.visualization?.config?.numBuckets || 10;
        this.bindPseudocodeLineInspector();
        this.reset();
    }
}

// Export global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HashTableVisualizer;
}
if (typeof window !== 'undefined') {
    window.HashTableVisualizer = HashTableVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// HashTableWidget — adaptateur SLIDE. Consomme la MÊME mécanique de bucket
// (hashtable-traces.js) mais en mode 'multiset' (clé numérique directe,
// jamais de recherche de doublon — comportement d'origine inchangé) et rendu
// instantané (pas d'animation par pas, comme pile/file/liste chaînée). DOM
// .htw-* inchangé. Usage : HashTableWidget.mount(container, { buckets: 8, data: [14, 7, 21, 3] })
// ─────────────────────────────────────────────────────────────────────────────
class HashTableWidget {
    static mount(container, config = {}) {
        const w = new HashTableWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.NUM_BUCKETS = config.buckets || 8;
        this._table = Array.from({ length: this.NUM_BUCKETS }, () => []);
        this._activeRow = -1;
        this._foundKey = null;
        this._action = `h(k) = k mod ${this.NUM_BUCKETS}`;
        const defaults = Array.isArray(config.data) ? config.data : [14, 7, 21, 3, 28];
        defaults.forEach(k => {
            const info = window.OEITrace.computeHashInfo(k, { method: 'modulo', numBuckets: this.NUM_BUCKETS });
            this._table[info.hash].push({ key: k, value: k });
        });
    }

    init() {
        this.root.innerHTML = `<div class="htw-container">
            <div class="htw-header">Table de hachage (chainage)</div>
            <div class="htw-table"></div>
            <div class="htw-info-bar htw-action"></div>
            <div class="htw-controls">
                <input type="number" class="htw-input htw-key-input" placeholder="cle" value="42">
                <button class="htw-btn htw-btn-insert">+ Inserer</button>
                <button class="htw-btn htw-btn-search htw-btn-secondary">Chercher</button>
                <button class="htw-btn htw-btn-reset htw-btn-secondary">&#8635; Reset</button>
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
        const tableEl = this.root.querySelector('.htw-table');
        if (!tableEl) return;
        tableEl.innerHTML = '';
        this._table.forEach((bucket, i) => {
            const row = document.createElement('div');
            row.className = 'htw-row';
            let html = `<span class="htw-row-idx">${i}</span>`;
            if (bucket.length === 0) {
                html += `<div class="htw-cell"></div>`;
            } else {
                bucket.forEach((entry, ki) => {
                    let cls = 'filled';
                    if (i === this._activeRow && ki === bucket.length - 1) {
                        cls = ki === 0 ? 'active' : 'collision';
                    } else if (this._foundKey !== null && entry.key === this._foundKey) {
                        cls = 'found';
                    }
                    if (ki > 0) html += `<span class="htw-chain-arr">&#8594;</span>`;
                    html += `<div class="htw-cell ${cls}">${entry.key}</div>`;
                });
            }
            row.innerHTML = html;
            tableEl.appendChild(row);
        });
        const act = this.root.querySelector('.htw-action');
        if (act) act.textContent = this._action;
    }

    _key() {
        const el = this.root.querySelector('.htw-key-input');
        return el ? parseInt(el.value, 10) : NaN;
    }

    _bindControls() {
        this.root.querySelector('.htw-btn-insert')?.addEventListener('click', () => {
            const k = this._key();
            if (isNaN(k)) return;
            const info = window.OEITrace.computeHashInfo(k, { method: 'modulo', numBuckets: this.NUM_BUCKETS });
            const last = window.OEITrace.buildHashInsertTrace(this._table, k, k, info, { mode: 'multiset' }).at(-1);
            this._table = last.table;
            this._activeRow = info.hash;
            this._foundKey = null;
            this._action = `Inserer ${k} -> h(${k})=${info.hash}${last.collision ? ' (collision : chainee)' : ''}`;
            this._render();
            setTimeout(() => { this._activeRow = -1; this._render(); }, 900);
        });
        this.root.querySelector('.htw-btn-search')?.addEventListener('click', () => {
            const k = this._key();
            if (isNaN(k)) return;
            const info = window.OEITrace.computeHashInfo(k, { method: 'modulo', numBuckets: this.NUM_BUCKETS });
            const bucketLen = this._table[info.hash].length;
            const last = window.OEITrace.buildHashSearchTrace(this._table, k, info).at(-1);
            this._activeRow = -1;
            this._foundKey = null;
            if (!last.ok) {
                this._action = `Chercher ${k} -> bucket ${info.hash}, non trouve (${bucketLen} comp.)`;
            } else {
                this._foundKey = k;
                const idx = last.marks.indices[0];
                this._action = `Cle ${k} trouvee dans bucket ${info.hash} (${idx + 1} comparaison(s))`;
            }
            this._render();
        });
        this.root.querySelector('.htw-btn-reset')?.addEventListener('click', () => {
            this._table = Array.from({ length: this.NUM_BUCKETS }, () => []);
            this._activeRow = -1;
            this._foundKey = null;
            this._action = `Table reinitialisee — ${this.NUM_BUCKETS} buckets vides`;
            this._render();
        });
    }
}

if (typeof window !== 'undefined') {
    window.HashTableWidget = HashTableWidget;
}
