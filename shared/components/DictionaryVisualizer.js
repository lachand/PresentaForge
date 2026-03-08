/**
 * DictionaryVisualizer - Visualisation de dictionnaires (Map)
 *
 * Permet de manipuler des paires clé-valeur avec :
 * - put(clé, valeur) : Ajouter/mettre à jour
 * - get(clé) : Chercher
 * - delete(clé) : Supprimer
 * - clear() : Vider
 */
class OrderedDictionaryStore {
    constructor() {
        this.map = new Map();
    }

    put(key, value) {
        const updated = this.map.has(key);
        this.map.set(key, value);
        return { updated, bucket: null, collision: false };
    }

    get(key) {
        if (!this.map.has(key)) return { found: false, value: null, bucket: null };
        return { found: true, value: this.map.get(key), bucket: null };
    }

    delete(key) {
        const existed = this.map.has(key);
        this.map.delete(key);
        return { deleted: existed, bucket: null };
    }

    clear() {
        this.map.clear();
    }

    entriesSorted() {
        return Array.from(this.map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }

    snapshot() {
        return {
            mode: 'ordered',
            entries: this.entriesSorted(),
            size: this.map.size,
            buckets: null
        };
    }
}

class HashDictionaryStore {
    constructor(bucketCount = 8) {
        this.bucketCount = bucketCount;
        this.buckets = Array.from({ length: bucketCount }, () => []);
        this.collisions = 0;
    }

    hash(key) {
        let h = 0;
        for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0;
        return h % this.bucketCount;
    }

    put(key, value) {
        const bucketIndex = this.hash(key);
        const bucket = this.buckets[bucketIndex];
        const idx = bucket.findIndex(([k]) => k === key);
        if (idx >= 0) {
            bucket[idx][1] = value;
            return { updated: true, bucket: bucketIndex, collision: false };
        }

        const collision = bucket.length > 0;
        if (collision) this.collisions += 1;
        bucket.push([key, value]);
        return { updated: false, bucket: bucketIndex, collision };
    }

    get(key) {
        const bucketIndex = this.hash(key);
        const pair = this.buckets[bucketIndex].find(([k]) => k === key);
        if (!pair) return { found: false, value: null, bucket: bucketIndex };
        return { found: true, value: pair[1], bucket: bucketIndex };
    }

    delete(key) {
        const bucketIndex = this.hash(key);
        const bucket = this.buckets[bucketIndex];
        const idx = bucket.findIndex(([k]) => k === key);
        if (idx < 0) return { deleted: false, bucket: bucketIndex };
        bucket.splice(idx, 1);
        return { deleted: true, bucket: bucketIndex };
    }

    clear() {
        this.buckets = Array.from({ length: this.bucketCount }, () => []);
        this.collisions = 0;
    }

    entriesSorted() {
        const flat = [];
        this.buckets.forEach((bucket) => bucket.forEach((pair) => flat.push(pair)));
        return flat.sort((a, b) => a[0].localeCompare(b[0]));
    }

    snapshot() {
        const size = this.buckets.reduce((sum, bucket) => sum + bucket.length, 0);
        return {
            mode: 'hash',
            entries: this.entriesSorted(),
            size,
            collisions: this.collisions,
            buckets: this.buckets.map((bucket) => bucket.map(([k, v]) => [k, v]))
        };
    }
}

class DictionaryVisualizer extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.hashBucketCount = 8;
        this.stores = {
            ordered: new OrderedDictionaryStore(),
            hash: new HashDictionaryStore(this.hashBucketCount)
        };
        this.backendMode = 'ordered';
        this.store = this.stores.ordered;
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    syncStoreSelection() {
        const select = document.getElementById('dict-backend-mode');
        const mode = select ? select.value : this.backendMode;
        this.backendMode = mode === 'hash' ? 'hash' : 'ordered';
        this.store = this.stores[this.backendMode];
    }

    resetStores() {
        this.hashBucketCount = this.data?.visualization?.config?.hashBuckets || 8;
        this.stores = {
            ordered: new OrderedDictionaryStore(),
            hash: new HashDictionaryStore(this.hashBucketCount)
        };
        this.syncStoreSelection();
    }

    reset() {
        this.resetStores();
        this.state.phase = 'idle';
        this.state.stepCount = 0;
        this.render();
        this.updateFeedback('');
    }

    async put(key, value) {
        const safeKey = (key || '').trim();
        if (!safeKey) {
            this.updateFeedback('Veuillez entrer une cle !');
            return;
        }

        const safeValue = value == null ? '' : String(value);
        const orderedResult = this.stores.ordered.put(safeKey, safeValue);
        const hashResult = this.stores.hash.put(safeKey, safeValue);
        this.state.stepCount += 1;
        this.syncStoreSelection();
        this.render();
        const suffix = this.backendMode === 'hash'
            ? ` (bucket ${hashResult.bucket}${hashResult.collision ? ', collision' : ''})`
            : '';
        this.updateFeedback(
            orderedResult.updated
                ? `Mise a jour : ${safeKey} -> ${safeValue}${suffix}`
                : `Ajout : ${safeKey} -> ${safeValue}${suffix}`
        );
        await this.flashHighlight(
            safeKey,
            this.getCurrentDelay(0.85),
            orderedResult.updated ? 'highlight' : 'inserting'
        );
    }

    async get(key) {
        const safeKey = (key || '').trim();
        if (!safeKey) {
            this.updateFeedback('Veuillez entrer une cle.');
            return;
        }

        this.syncStoreSelection();
        const result = this.store.get(safeKey);
        if (result.found) {
            const suffix = this.backendMode === 'hash' ? ` (bucket ${result.bucket})` : '';
            this.updateFeedback(`Trouve : ${safeKey} -> ${result.value}${suffix}`);
            await this.flashHighlight(safeKey, this.getCurrentDelay(0.85), 'highlight');
        } else {
            this.updateFeedback(`Cle non trouvee : ${safeKey}`);
        }
    }

    async deleteKey(key) {
        const safeKey = (key || '').trim();
        if (!safeKey) {
            this.updateFeedback('Veuillez entrer une cle a supprimer.');
            return;
        }

        const orderedBefore = this.stores.ordered.get(safeKey);
        const hashBefore = this.stores.hash.get(safeKey);
        const exists = Boolean(orderedBefore.found || hashBefore.found);
        if (exists) {
            await this.flashHighlight(safeKey, this.getCurrentDelay(0.7), 'deleting');
        }

        const orderedRes = this.stores.ordered.delete(safeKey);
        const hashRes = this.stores.hash.delete(safeKey);
        this.syncStoreSelection();
        if (orderedRes.deleted || hashRes.deleted) {
            this.state.stepCount += 1;
            this.render();
            this.updateFeedback(`Supprime : ${safeKey}`);
        } else {
            this.updateFeedback(`Cle absente : ${safeKey}`);
        }
    }

    clear() {
        this.stores.ordered.clear();
        this.stores.hash.clear();
        this.state.stepCount += 1;
        this.syncStoreSelection();
        this.updateFeedback('Dictionnaire vide');
        this.render();
    }

    render() {
        const listContainer = document.getElementById('dict-list');
        if (!listContainer) return;

        this.syncStoreSelection();
        const snapshot = this.store.snapshot();
        const entries = snapshot.entries || [];

        listContainer.innerHTML = '';

        if (entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = '(vide)';
            listContainer.appendChild(empty);
        } else {
            entries.forEach(([key, value]) => {
                const row = document.createElement('div');
                row.className = 'kv-row';
                row.dataset.key = key;
                row.style.marginBottom = '6px';

                const leftSpan = document.createElement('span');
                leftSpan.textContent = key;

                const rightSpan = document.createElement('span');
                rightSpan.textContent = '→ ' + value;

                row.appendChild(leftSpan);
                row.appendChild(rightSpan);
                listContainer.appendChild(row);
            });
        }

        this.renderHashView();
        this.updatePythonSnippet();
    }

    renderHashView() {
        const host = document.getElementById('dict-hash-view');
        if (!host) return;

        if (this.backendMode !== 'hash') {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }

        const snap = this.stores.hash.snapshot();
        const rows = snap.buckets.map((bucket, idx) => {
            const content = bucket.length
                ? bucket.map(([k, v]) => `<span class="dict-hash-chip" data-key="${this.escapeHtml(k)}">${this.escapeHtml(k)}:${this.escapeHtml(v)}</span>`).join('<span class="dict-hash-arrow">→</span>')
                : '<span class="text-muted text-sm">vide</span>';
            return `<div class="dict-hash-row"><span class="dict-hash-index">${idx}</span><div class="dict-hash-chain">${content}</div></div>`;
        }).join('');

        host.style.display = '';
        host.innerHTML = `
            <div class="dict-hash-stats text-sm text-muted">
                Buckets: ${snap.buckets.length} • Elements: ${snap.size} • Collisions: ${snap.collisions || 0}
            </div>
            <div class="dict-hash-buckets">${rows}</div>
        `;
    }

    updatePythonSnippet() {
        const codeEl = document.getElementById('dict-code');
        if (!codeEl) return;

        const keyInput = document.getElementById('dict-key');
        const valueInput = document.getElementById('dict-value');

        const k = keyInput ? keyInput.value || 'cle' : 'cle';
        const v = valueInput ? valueInput.value || 'valeur' : 'valeur';
        const backendComment = this.backendMode === 'hash'
            ? '# backend actif: table de hashage (implementation)'
            : '# backend actif: dictionnaire ordonne (abstraction)';

        codeEl.textContent = `${backendComment}
# Exemple Python
mon_dict = {}
mon_dict[${JSON.stringify(k)}] = ${JSON.stringify(v)}
print(mon_dict.get(${JSON.stringify(k)}, None))
if ${JSON.stringify(k)} in mon_dict:
    del mon_dict[${JSON.stringify(k)}]`;
    }

    async flashHighlight(key, delay, cls = 'highlight') {
        const listContainer = document.getElementById('dict-list');
        const selector = `[data-key="${CSS.escape(key)}"]`;
        const row = listContainer ? listContainer.querySelector(selector) : null;
        const chip = document.querySelector(`#dict-hash-view ${selector}`);

        if (row) {
            row.classList.add(cls);
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (chip) chip.classList.add(cls);

        await OEIUtils.sleep(delay);
        if (row) row.classList.remove(cls);
        if (chip) chip.classList.remove(cls);
    }

    updateFeedback(message) {
        const feedbackEl = document.getElementById('dict-feedback');
        if (feedbackEl) {
            feedbackEl.textContent = message;
        }
    }

    setupEventListeners() {
        const keyInput = document.getElementById('dict-key');
        const valueInput = document.getElementById('dict-value');
        const btnPut = document.getElementById('btn-put');
        const btnGet = document.getElementById('btn-get');
        const btnDel = document.getElementById('btn-del');
        const btnClear = document.getElementById('btn-clear');
        const backendMode = document.getElementById('dict-backend-mode');

        if (btnPut) {
            btnPut.addEventListener('click', () => {
                const key = keyInput ? keyInput.value : '';
                const value = valueInput ? valueInput.value : '';
                this.put(key, value);
            });
        }

        if (btnGet) {
            btnGet.addEventListener('click', () => {
                const key = keyInput ? keyInput.value : '';
                this.get(key);
            });
        }

        if (btnDel) {
            btnDel.addEventListener('click', () => {
                const key = keyInput ? keyInput.value : '';
                this.deleteKey(key);
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => this.clear());
        }

        if (backendMode) {
            backendMode.addEventListener('change', () => {
                this.syncStoreSelection();
                this.render();
                this.updateFeedback(this.backendMode === 'hash'
                    ? 'Mode implementation hash actif.'
                    : 'Mode abstraction dictionnaire actif.');
            });
        }

        // Mettre à jour le snippet Python quand on tape
        if (keyInput) {
            keyInput.addEventListener('input', () => this.updatePythonSnippet());
        }
        if (valueInput) {
            valueInput.addEventListener('input', () => this.updatePythonSnippet());
        }
    }

    async init() {
        await super.init();
        this.renderPseudocodeFromData();
        this.bindPseudocodeInspector();
        this.setupEventListeners();
        this.reset();
    }

    renderPseudocodeFromData() {
        if (typeof PseudocodeSupport === 'undefined') return;
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (block, idx) => {
                const name = block?.name || 'dict';
                return `${name}-line${idx + 1}`;
            }
        });
    }

    bindPseudocodeInspector() {
        if (typeof PseudocodeSupport === 'undefined') return;
        const explainOutput = document.getElementById('explain-output');
        PseudocodeSupport.bindLineInspector(this.data, {
            containerId: 'pseudocode-container',
            explainOutput,
            clickTitle: 'Cliquer pour expliquer cette ligne'
        });
    }
}

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DictionaryVisualizer;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.DictionaryVisualizer = DictionaryVisualizer;
}
