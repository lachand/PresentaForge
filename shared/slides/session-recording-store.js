/**
 * @module slides/session-recording-store
 * Magasin IndexedDB pour l'enregistrement de séance en cours (mode présentateur).
 *
 * L'enregistrement (`slides/viewer/session-recording-runtime.js`) vit sinon
 * uniquement en mémoire : fermer la fenêtre = audio + synchro + sous-titres perdus,
 * sans avertissement. Ce magasin persiste en continu un *brouillon* :
 *   - `meta`  → titre, horodatage, events de synchro, sous-titres, notes auto…
 *   - `deck`  → { slides, data, themeCss } figés au démarrage (pour rejouer le
 *               bon cours même si le présentateur a changé de deck entre-temps)
 *   - `chunk:NNNNNN` → tranches audio `Blob` coalescées (~15 s), ajoutées au fil de l'eau
 *
 * Un seul brouillon à la fois (un présentateur n'enregistre qu'une séance).
 * À la réouverture du présentateur, un brouillon non finalisé déclenche la
 * bannière de reprise. Après un export réussi → `clearDraft()`.
 *
 * Repli gracieux : sans IndexedDB (navigation privée, profils restreints) chaque
 * opération renvoie un résultat neutre (`false` / `null`) et le runtime retombe
 * sur son comportement mémoire actuel.
 *
 * Pure : aucun accès DOM. Calqué sur `shared/slides/deck-blob-store.js`.
 */
(function attachSessionRecordingStore(root) {
    'use strict';

    const DB_NAME = 'oei-session-recording';
    const STORE = 'parts';
    const DB_VERSION = 1;
    const META_KEY = 'meta';
    const DECK_KEY = 'deck';
    const CHUNK_PREFIX = 'chunk:';
    const OP_TIMEOUT_MS = (root && Number(root.__OEI_SESSION_REC_TIMEOUT_MS)) || 4000;
    const idb = (root && root.indexedDB) || null;

    let _dbPromise = null;
    let _disabled = false;

    const _chunkKey = i => CHUNK_PREFIX + String(Math.max(0, Math.trunc(Number(i) || 0))).padStart(6, '0');

    /** Course une promesse contre un timeout ; à l'expiration → valeur de repli. */
    function _withTimeout(promise, fallback) {
        if (typeof setTimeout !== 'function') return promise;
        let timer = null;
        const guard = new Promise(resolve => { timer = setTimeout(() => resolve(fallback), OP_TIMEOUT_MS); });
        return Promise.race([promise, guard]).then(
            v => { if (timer && typeof clearTimeout === 'function') clearTimeout(timer); return v; },
            e => { if (timer && typeof clearTimeout === 'function') clearTimeout(timer); throw e; },
        );
    }

    function _open() {
        if (!idb || _disabled) return Promise.resolve(null);
        if (_dbPromise) return _dbPromise;
        _dbPromise = _withTimeout(new Promise(resolve => {
            let req;
            try { req = idb.open(DB_NAME, DB_VERSION); } catch (_) { resolve(null); return; }
            req.onupgradeneeded = () => {
                const db = req.result;
                if (db && !db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'k' });
            };
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        }), null).then(db => {
            if (!db) _disabled = true;
            return db;
        }).catch(() => { _disabled = true; return null; });
        return _dbPromise;
    }

    function _tx(mode, run) {
        return _open().then(db => {
            if (!db) return { ok: false };
            return _withTimeout(new Promise(resolve => {
                let tx;
                try { tx = db.transaction(STORE, mode); } catch (_) { resolve({ ok: false }); return; }
                let request;
                try { request = run(tx.objectStore(STORE)); } catch (_) { resolve({ ok: false }); return; }
                tx.oncomplete = () => resolve({ ok: true, value: request ? request.result : undefined });
                tx.onerror = () => resolve({ ok: false });
                tx.onabort = () => resolve({ ok: false });
            }), { ok: false });
        }).catch(() => ({ ok: false }));
    }

    async function _allKeys() {
        const r = await _tx('readonly', s => s.getAllKeys());
        return (r.ok && Array.isArray(r.value)) ? r.value.map(String) : [];
    }

    const store = {
        /** @returns {boolean} IndexedDB présent et pas (encore) marqué inutilisable. */
        available() { return !!idb && !_disabled; },
        /** Force la ré-évaluation (tests). */
        _reset() { _dbPromise = null; _disabled = false; },

        /**
         * Démarre un brouillon : purge l'éventuel précédent, écrit la méta initiale
         * et le deck figé.
         * @param {object} meta
         * @param {{slides:any[],data:any,themeCss:string}} deck
         * @returns {Promise<boolean>}
         */
        async startDraft(meta, deck) {
            if (!this.available()) return false;
            await this.clearDraft();
            const now = Date.now();
            const metaRec = {
                k: META_KEY,
                startedAt: now,
                stopAt: 0,
                pausedAccumMs: 0,
                durationMs: 0,
                title: '',
                sourceFile: '',
                audioMimeType: 'audio/webm',
                audioBitsPerSecond: 0,
                audioCodec: '',
                events: [],
                captions: [],
                autoNotesBySlide: {},
                chunkCount: 0,
                finalized: false,
                ...(meta && typeof meta === 'object' ? meta : {}),
                updatedAt: now,
            };
            const okMeta = await _tx('readwrite', s => s.put(metaRec));
            const deckRec = {
                k: DECK_KEY,
                slides: (deck && Array.isArray(deck.slides)) ? deck.slides : [],
                data: (deck && deck.data) || null,
                themeCss: (deck && typeof deck.themeCss === 'string') ? deck.themeCss : '',
            };
            await _tx('readwrite', s => s.put(deckRec));
            return !!okMeta.ok;
        },

        /**
         * @param {number} index
         * @param {Blob} blob  tranche audio coalescée
         * @returns {Promise<boolean>}
         */
        async appendChunk(index, blob) {
            if (!this.available() || !blob) return false;
            const r = await _tx('readwrite', s => s.put({ k: _chunkKey(index), blob }));
            return !!r.ok;
        },

        /**
         * Fusion superficielle dans la méta (events/captions/notes/durée/chunkCount…).
         * @param {object} patch
         * @returns {Promise<boolean>}
         */
        async updateMeta(patch) {
            if (!this.available()) return false;
            const cur = await this.getDraftMeta();
            if (!cur) return false;
            const next = { ...cur, ...(patch && typeof patch === 'object' ? patch : {}), k: META_KEY, updatedAt: Date.now() };
            const r = await _tx('readwrite', s => s.put(next));
            return !!r.ok;
        },

        /** @returns {Promise<object|null>} la méta du brouillon, ou null. */
        async getDraftMeta() {
            const r = await _tx('readonly', s => s.get(META_KEY));
            return (r.ok && r.value && typeof r.value === 'object') ? r.value : null;
        },

        /** @returns {Promise<{slides:any[],data:any,themeCss:string}|null>} */
        async loadDraftDeck() {
            const r = await _tx('readonly', s => s.get(DECK_KEY));
            if (!r.ok || !r.value) return null;
            return { slides: r.value.slides || [], data: r.value.data || null, themeCss: r.value.themeCss || '' };
        },

        /** @returns {Promise<Blob[]>} tranches audio dans l'ordre. */
        async loadDraftChunks() {
            const keys = (await _allKeys()).filter(k => k.startsWith(CHUNK_PREFIX)).sort();
            const out = [];
            for (const k of keys) {
                // eslint-disable-next-line no-await-in-loop
                const r = await _tx('readonly', s => s.get(k));
                if (r.ok && r.value && r.value.blob) out.push(r.value.blob);
            }
            return out;
        },

        /** Supprime tout le brouillon (méta + deck + chunks). @returns {Promise<boolean>} */
        async clearDraft() {
            if (!this.available()) return false;
            const keys = await _allKeys();
            if (!keys.length) return true;
            const r = await _tx('readwrite', s => { keys.forEach(k => s.delete(k)); return null; });
            return !!r.ok;
        },
    };

    root.OEISessionRecordingStore = Object.freeze(store);
})(typeof window !== 'undefined' ? window : globalThis);
