/**
 * HashTableVisualizer - Visualisation de tables de hachage
 *
 * Opérations :
 * - doInsert() : Insérer une paire clé-valeur
 * - doSearch() : Rechercher une clé
 * - doDelete() : Supprimer une clé
 * - resetTable() : Réinitialiser la table
 * - showPseudo(tab) : Basculer entre pseudocode insertion/recherche
 * - updateHashInfo() : Mettre à jour l'info de la fonction de hachage
 */

class HashTableVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.NUM_BUCKETS = 10;
        this.table = [];
        this.totalCollisions = 0;
        this.animating = false;
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
     * Calcule le hash d'une clé
     */
    hashKey(key) {
        let numKey = 0;
        for (let i = 0; i < key.length; i++) {
            numKey = numKey * 31 + key.charCodeAt(i);
        }
        numKey = Math.abs(numKey);
        const methodEl = document.getElementById('hashFn');
        const method = methodEl ? methodEl.value : 'modulo';
        if (method === 'multiplication') {
            const A = 0.6180339887;
            const frac = (numKey * A) % 1;
            return { raw: numKey, hash: Math.floor(frac * this.NUM_BUCKETS), method: 'multiplication', A: A, frac: frac };
        } else {
            return { raw: numKey, hash: numKey % this.NUM_BUCKETS, method: 'modulo' };
        }
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    /**
     * Affiche les étapes du calcul de hash
     */
    showHashSteps(key, info) {
        const el = document.getElementById('hashSteps');
        if (!el) return;
        let html = '<div class="step">Cle : "<strong>' + this.escHtml(key) + '</strong>" &rarr; valeur numerique : <strong>' + info.raw + '</strong></div>';
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
                        arrow.textContent = '\u2192';
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

    renderPseudocodeFromData() {
        const blocks = this.data?.pseudocode || this.data?.pseudoCode;
        if (!Array.isArray(blocks)) return;

        const idPrefix = {
            insert: 'ins',
            search: 'src'
        };

        blocks.forEach((block) => {
            const target = document.getElementById('pseudo-' + block.name);
            if (!target) return;

            const prefix = idPrefix[block.name] || (block.name + '-line');
            const lines = (block.lines || []).map((line, idx) => {
                const id = (prefix.endsWith('-line') ? (prefix + idx) : (prefix + (idx + 1)));
                const content = (typeof PseudocodeSupport !== 'undefined')
                    ? PseudocodeSupport.renderLineContent(line, {
                        autoKeywordHighlight: true,
                        domain: this.data?.metadata?.category
                    })
                    : this.escapeHtml(line);
                return '<span class="line" id="' + id + '">' + content + '</span>';
            });

            target.innerHTML = lines.join('');
        });
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
    async doInsert() {
        if (this.animating) return;
        const key = document.getElementById('inputKey')?.value.trim();
        const value = document.getElementById('inputValue')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle.', 'error'); return; }
        if (!value) { this.setFeedback('Veuillez entrer une valeur.', 'error'); return; }

        this.animating = true;
        this.showPseudo('insert');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const firstTab = document.querySelectorAll('.tab-btn')[0];
        if (firstTab) firstTab.classList.add('active');

        this.highlightLine('ins1');
        await OEIUtils.sleep(this.getCurrentDelay());

        const info = this.hashKey(key);
        this.showHashSteps(key, info);
        this.highlightLine('ins2');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('ins3');
        this.renderBuckets(info.hash);
        await OEIUtils.sleep(this.getCurrentDelay());

        let found = false;
        for (let i = 0; i < this.table[info.hash].length; i++) {
            this.highlightLine('ins4');
            this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'probe-node' });
            await OEIUtils.sleep(this.getCurrentDelay());
            this.highlightLine('ins5');
            await OEIUtils.sleep(this.getCurrentDelay());
            if (this.table[info.hash][i].key === key) {
                this.highlightLine('ins6');
                this.table[info.hash][i].value = value;
                this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'highlight-node' });
                await OEIUtils.sleep(this.getCurrentDelay());
                this.highlightLine('ins7');
                this.setFeedback('Cle "' + key + '" mise a jour avec valeur "' + value + '".', 'success');
                found = true;
                break;
            }
        }

        if (!found) {
            if (this.table[info.hash].length > 0) this.totalCollisions++;
            this.highlightLine('ins8');
            this.table[info.hash].push({ key, value });
            this.renderBuckets(info.hash, { bucket: info.hash, indices: [this.table[info.hash].length - 1], cls: 'insert-node' });
            await OEIUtils.sleep(this.getCurrentDelay(0.85));
            this.highlightLine('ins9');
            this.setFeedback('Cle "' + key + '" inseree dans le bucket ' + info.hash + '.', 'success');
        }

        this.updateStats();
        await OEIUtils.sleep(this.getCurrentDelay());
        this.clearHighlight();
        this.animating = false;
        const inputKey = document.getElementById('inputKey');
        const inputValue = document.getElementById('inputValue');
        if (inputKey) inputKey.value = '';
        if (inputValue) inputValue.value = '';
    }

    /**
     * Recherche
     */
    async doSearch() {
        if (this.animating) return;
        const key = document.getElementById('inputKey')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle a rechercher.', 'error'); return; }

        this.animating = true;
        this.showPseudo('search');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const secondTab = document.querySelectorAll('.tab-btn')[1];
        if (secondTab) secondTab.classList.add('active');

        this.highlightLine('src1');
        await OEIUtils.sleep(this.getCurrentDelay());

        const info = this.hashKey(key);
        this.showHashSteps(key, info);
        this.highlightLine('src2');
        await OEIUtils.sleep(this.getCurrentDelay());

        this.highlightLine('src3');
        this.renderBuckets(info.hash);
        await OEIUtils.sleep(this.getCurrentDelay());

        let found = false;
        for (let i = 0; i < this.table[info.hash].length; i++) {
            this.highlightLine('src4');
            this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'probe-node' });
            await OEIUtils.sleep(this.getCurrentDelay());
            this.highlightLine('src5');
            await OEIUtils.sleep(this.getCurrentDelay());
            if (this.table[info.hash][i].key === key) {
                this.highlightLine('src6');
                this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'highlight-node' });
                this.setFeedback('Cle "' + key + '" trouvee ! Valeur : "' + this.table[info.hash][i].value + '"', 'success');
                found = true;
                break;
            }
        }

        if (!found) {
            this.highlightLine('src7');
            this.setFeedback('Cle "' + key + '" non trouvee.', 'error');
        }

        await OEIUtils.sleep(this.getCurrentDelay());
        this.clearHighlight();
        this.animating = false;
    }

    /**
     * Suppression
     */
    async doDelete() {
        if (this.animating) return;
        const key = document.getElementById('inputKey')?.value.trim();
        if (!key) { this.setFeedback('Veuillez entrer une cle a supprimer.', 'error'); return; }

        this.animating = true;
        const info = this.hashKey(key);
        this.showHashSteps(key, info);
        this.renderBuckets(info.hash);
        await OEIUtils.sleep(this.getCurrentDelay());

        let found = false;
        for (let i = 0; i < this.table[info.hash].length; i++) {
            this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'probe-node' });
            await OEIUtils.sleep(this.getCurrentDelay());
            if (this.table[info.hash][i].key === key) {
                this.renderBuckets(info.hash, { bucket: info.hash, indices: [i], cls: 'delete-node' });
                await OEIUtils.sleep(this.getCurrentDelay(0.75));
                this.table[info.hash].splice(i, 1);
                this.renderBuckets(info.hash);
                this.updateStats();
                this.setFeedback('Cle "' + key + '" supprimee.', 'success');
                found = true;
                break;
            }
        }

        if (!found) {
            this.setFeedback('Cle "' + key + '" non trouvee.', 'error');
        }

        await OEIUtils.sleep(this.getCurrentDelay());
        this.clearHighlight();
        this.animating = false;
        const inputKey = document.getElementById('inputKey');
        if (inputKey) inputKey.value = '';
    }

    /**
     * Réinitialiser
     */
    resetTable() {
        this.animating = false;
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
        this.renderPseudocodeFromData();
        this.bindPseudocodeLineInspector();
        this.reset();
    }
}

// Export global
if (typeof window !== 'undefined') {
    window.HashTableVisualizer = HashTableVisualizer;
}

// ─────────────────────────────────────────────────────────────────────────────
// HashTableWidget — Widget autonome pour intégration dans les slides
// Usage : HashTableWidget.mount(container, { buckets: 8, data: [14, 7, 21, 3] })
// ─────────────────────────────────────────────────────────────────────────────
class HashTableWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (HashTableWidget._stylesInjected) return;
        HashTableWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.htw-container{display:flex;flex-direction:column;gap:10px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.htw-header{font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.htw-table{display:flex;flex-direction:column;gap:4px;flex:1;overflow-y:auto;}
.htw-row{display:flex;align-items:center;gap:5px;}
.htw-row-idx{min-width:22px;font-size:.68rem;color:var(--sl-muted,#94a3b8);text-align:right;font-weight:600;}
.htw-cell{min-width:32px;height:24px;border-radius:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;transition:background .2s;}
.htw-cell.filled{background:var(--sl-primary,#6366f1);border-color:var(--sl-primary,#6366f1);color:#fff;}
.htw-cell.active{background:var(--sl-accent,#f97316);border-color:var(--sl-accent,#f97316);color:#fff;}
.htw-cell.found{background:#22c55e;border-color:#22c55e;color:#fff;}
.htw-cell.collision{background:#a855f7;border-color:#a855f7;color:#fff;}
.htw-chain-arr{font-size:.65rem;color:var(--sl-muted,#94a3b8);}
.htw-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.htw-input{background:var(--surface,rgba(0,0,0,.18));border:1px solid var(--border,var(--sl-border,#334155));border-radius:6px;padding:4px 8px;font-size:.75rem;color:var(--text,var(--sl-text,#e2e8f0));width:64px;}
.htw-btn{padding:4px 10px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;}
.htw-btn:hover:not(:disabled){opacity:.8;}
.htw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
.htw-info-bar{font-size:.72rem;color:var(--sl-text,#cbd5e1);min-height:16px;line-height:1.4;}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        HashTableWidget.ensureStyles();
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
        defaults.forEach(k => this._table[this._hash(k)].push(k));
    }

    _hash(k) { return ((k % this.NUM_BUCKETS) + this.NUM_BUCKETS) % this.NUM_BUCKETS; }

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

    _render() {
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
                bucket.forEach((key, ki) => {
                    let cls = 'filled';
                    if (i === this._activeRow && ki === bucket.length - 1) {
                        cls = ki === 0 ? 'active' : 'collision';
                    } else if (this._foundKey !== null && key === this._foundKey) {
                        cls = 'found';
                    }
                    if (ki > 0) html += `<span class="htw-chain-arr">&#8594;</span>`;
                    html += `<div class="htw-cell ${cls}">${key}</div>`;
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
            const h = this._hash(k);
            const collision = this._table[h].length > 0;
            this._table[h].push(k);
            this._activeRow = h;
            this._foundKey = null;
            this._action = `Inserer ${k} -> h(${k})=${h}${collision ? ' (collision : chainee)' : ''}`;
            this._render();
            setTimeout(() => { this._activeRow = -1; this._render(); }, 900);
        });
        this.root.querySelector('.htw-btn-search')?.addEventListener('click', () => {
            const k = this._key();
            if (isNaN(k)) return;
            const h = this._hash(k);
            const bucket = this._table[h];
            const idx = bucket.indexOf(k);
            this._activeRow = -1;
            this._foundKey = null;
            if (idx === -1) {
                this._action = `Chercher ${k} -> bucket ${h}, non trouve (${bucket.length} comp.)`;
            } else {
                this._foundKey = k;
                this._action = `Cle ${k} trouvee dans bucket ${h} (${idx + 1} comparaison(s))`;
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
