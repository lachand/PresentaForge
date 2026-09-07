/**
 * @module slides/deck-blob-store
 * Magasin IndexedDB pour les decks volumineux (images base64) qui dépassent le
 * quota localStorage (~5 Mo par origine) :
 *   - archive de révision hors-CM  → clé = courseKey
 *   - remise éditeur → viewer « Présenter »  → clé = "__present__"
 *
 * IndexedDB est partagé entre onglets de même origine et se compte en centaines
 * de Mo. Repli gracieux : sans IndexedDB (ou en cas d'échec), chaque opération
 * renvoie un résultat neutre (`false` / `null`) et l'appelant retombe sur son
 * chemin localStorage.
 *
 * Pure : aucun accès DOM.
 */
(function attachDeckBlobStore(root) {
    'use strict';

    const DB_NAME = 'oei-slides-deck-blobs';
    const STORE = 'decks';
    const DB_VERSION = 1;
    // Certaines configs (snap, navigation privée, profils restreints) laissent
    // `indexedDB.open()` sans jamais lever d'évènement → on abandonne après ce délai.
    const OP_TIMEOUT_MS = (root && Number(root.__OEI_DECK_BLOB_TIMEOUT_MS)) || 4000;
    const idb = (root && root.indexedDB) || null;

    let _dbPromise = null;
    let _disabled = false;

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
                if (db && !db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        }), null).then(db => {
            if (!db) _disabled = true; // ne pas retenter à chaque opération
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

    const store = {
        /**
         * @returns {boolean} IndexedDB présent et pas (encore) marqué inutilisable.
         * Passe à `false` définitivement dès qu'une ouverture a échoué / expiré.
         */
        available() { return !!idb && !_disabled; },
        /** Force la ré-évaluation (tests). */
        _reset() { _dbPromise = null; _disabled = false; },

        /**
         * @param {string} id
         * @param {any} deck  objet deck (`{ slides:[…] }`)
         * @param {object} [meta]
         * @returns {Promise<boolean>}
         */
        async put(id, deck, meta) {
            if (!id || !deck) return false;
            const r = await _tx('readwrite', s => s.put({ id: String(id), deck, meta: meta || null, savedAt: Date.now() }));
            return !!r.ok;
        },

        /** @param {string} id @returns {Promise<any|null>} le deck, ou null. */
        async get(id) {
            if (!id) return null;
            const r = await _tx('readonly', s => s.get(String(id)));
            return (r.ok && r.value && r.value.deck) ? r.value.deck : null;
        },

        /** @param {string} id @returns {Promise<{id,deck,meta,savedAt}|null>} */
        async getRecord(id) {
            if (!id) return null;
            const r = await _tx('readonly', s => s.get(String(id)));
            return (r.ok && r.value) ? r.value : null;
        },

        /** @param {string} id @returns {Promise<boolean>} */
        async delete(id) {
            if (!id) return false;
            const r = await _tx('readwrite', s => s.delete(String(id)));
            return !!r.ok;
        },

        /** @returns {Promise<string[]>} toutes les clés stockées. */
        async keys() {
            const r = await _tx('readonly', s => s.getAllKeys());
            return (r.ok && Array.isArray(r.value)) ? r.value.map(String) : [];
        },
    };

    root.OEIDeckBlobStore = Object.freeze(store);
})(typeof window !== 'undefined' ? window : globalThis);
