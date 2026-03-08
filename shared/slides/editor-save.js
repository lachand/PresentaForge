/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-save
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-save.js"></script>
 */
/* editor-save.js — File System Access API + IndexedDB persistence + revision history */

/* ── File System Access API (save in-place) ──────────── */

let _fileHandle = null;

/**
 * Save using File System Access API (Chromium).
 * First call opens a file picker; subsequent calls overwrite silently.
 */
async function saveToFile() {
    if (!('showSaveFilePicker' in window)) {
        // Fallback: classic JSON download
        editor.exportJson();
        notify('JSON téléchargé (votre navigateur ne supporte pas la sauvegarde directe)', 'success');
        return;
    }
    try {
        if (!_fileHandle) {
            const name = (editor.data.metadata?.title || 'presentation')
                .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9àéèùêîôâ_-]/g, '') + '.json';
            _fileHandle = await window.showSaveFilePicker({
                suggestedName: name,
                types: [{ description: 'JSON Presentation', accept: { 'application/json': ['.json'] } }]
            });
        }
        const data = JSON.parse(JSON.stringify(editor.data));
        data.metadata.modified = new Date().toISOString().slice(0, 10);
        const writable = await _fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();

        _updateFileIndicator(_fileHandle.name);
        notify('Sauvegardé : ' + _fileHandle.name, 'success');
        updateSaveIndicator(true);
        saveRevision('save');
    } catch (err) {
        if (err.name === 'AbortError') return; // User cancelled picker
        console.error('Save error:', err);
        notify('Erreur de sauvegarde : ' + err.message, 'error');
    }
}

/**
 * Open a file from disk using File System Access API.
 * Keeps the handle for subsequent in-place saves.
 */
async function openFromFile() {
    if (!('showOpenFilePicker' in window)) {
        // Fallback: classic file input
        try {
            await editor.importJson();
            notify('Présentation chargée', 'success');
        } catch (e) { notify('Erreur : ' + e.message, 'error'); }
        return;
    }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Presentation', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(_repairJsonText(text));
        if (!Array.isArray(data.slides)) throw new Error('Format invalide');
        _fileHandle = handle;
        editor.load(data);
        _updateFileIndicator(handle.name);
        notify('Ouvert : ' + handle.name, 'success');
        saveRevision('open');
    } catch (err) {
        if (err.name === 'AbortError') return;
        notify('Erreur : ' + err.message, 'error');
    }
}

/** Reset file handle (new presentation) */
function resetFileHandle() {
    _fileHandle = null;
    _updateFileIndicator(null);
}

function _updateFileIndicator(filename) {
    const el = document.getElementById('file-name-indicator');
    if (!el) return;
    if (filename) {
        el.textContent = filename;
        el.title = 'Fichier lié : ' + filename;
        el.classList.add('linked');
    } else {
        el.textContent = 'Brouillon';
        el.title = 'Aucun fichier lié — Ctrl+S pour sauvegarder';
        el.classList.remove('linked');
    }
}

/* ── IndexedDB for revision history ──────────────────── */

const IDB_NAME = window.OEIStorage?.KEYS?.REVISIONS_DB || 'oei-slides-revisions';
const IDB_STORE = 'revisions';
const IDB_VERSION = 1;
const MAX_REVISIONS = 30;

function _openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                const store = db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('presentationId', 'presentationId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Save a revision snapshot to IndexedDB.
 * @param {string} reason - 'save' | 'open' | 'auto' | 'manual'
 */
async function saveRevision(reason = 'auto') {
    try {
        const db = await _openIDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const presId = editor.data.metadata?.id || editor.data.metadata?.title || 'untitled';

        store.add({
            presentationId: presId,
            timestamp: Date.now(),
            reason,
            title: editor.data.metadata?.title || 'Sans titre',
            slideCount: editor.data.slides.length,
            data: JSON.stringify(editor.data)
        });

        // Prune old revisions for this presentation
        const idx = store.index('presentationId');
        const range = IDBKeyRange.only(presId);
        const cursorReq = idx.openCursor(range, 'prev');
        let count = 0;
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            count++;
            if (count > MAX_REVISIONS) {
                cursor.delete();
            }
            cursor.continue();
        };

        await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    } catch (e) {
        console.warn('Revision save failed:', e);
    }
}

/**
 * Get revision history for current presentation.
 * @returns {Promise<Array>} revisions sorted newest-first
 */
async function getRevisions() {
    try {
        const db = await _openIDB();
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const presId = editor.data.metadata?.id || editor.data.metadata?.title || 'untitled';
        const idx = store.index('presentationId');
        const range = IDBKeyRange.only(presId);

        return new Promise((resolve, reject) => {
            const req = idx.getAll(range);
            req.onsuccess = () => {
                const revisions = req.result.sort((a, b) => b.timestamp - a.timestamp);
                resolve(revisions);
                db.close();
            };
            req.onerror = () => { reject(req.error); db.close(); };
        });
    } catch (e) {
        console.warn('Revision load failed:', e);
        return [];
    }
}

/**
 * Restore a specific revision by its id.
 */
async function restoreRevision(revId) {
    try {
        const db = await _openIDB();
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        return new Promise((resolve, reject) => {
            const req = store.get(revId);
            req.onsuccess = () => {
                if (req.result?.data) {
                    const data = JSON.parse(req.result.data);
                    editor.load(data);
                    notify('Révision restaurée', 'success');
                    resolve(true);
                } else {
                    notify('Révision introuvable', 'error');
                    resolve(false);
                }
                db.close();
            };
            req.onerror = () => { reject(req.error); db.close(); };
        });
    } catch (e) {
        notify('Erreur : ' + e.message, 'error');
    }
}

/* ── Revision History Modal ──────────────────────────── */

async function openRevisionHistory() {
    const revisions = await getRevisions();

    const existing = document.getElementById('revision-modal');
    if (existing) existing.remove();

    const getIcon = (name, fallback = '') => {
        if (typeof window.oeiIcon === 'function') return window.oeiIcon(name) || fallback;
        return fallback;
    };
    const icons = {
        close: getIcon('close', '✕'),
        save: getIcon('save'),
        open: getIcon('open'),
        auto: getIcon('clock'),
        manual: getIcon('manual'),
    };
    const reasonLabels = {
        save: `${icons.save}<span>Sauvegarde</span>`,
        open: `${icons.open}<span>Ouverture</span>`,
        auto: `${icons.auto}<span>Auto</span>`,
        manual: `${icons.manual}<span>Manuel</span>`,
    };
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const modal = document.createElement('div');
    modal.id = 'revision-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal revision-modal" style="max-width:560px">
            <div class="modal-header">
                <h3 class="modal-title" style="margin:0;flex:1">Historique des révisions</h3>
                <button class="modal-close" id="close-revision-modal" aria-label="Fermer">${icons.close}</button>
            </div>
            <div class="revision-list">
                ${revisions.length === 0
                    ? '<div style="text-align:center;padding:32px;color:var(--muted)">Aucune révision enregistrée</div>'
                    : revisions.map(r => {
                        const d = new Date(r.timestamp);
                        const date = d.toLocaleDateString('fr-FR');
                        const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                        return `<div class="revision-item" data-rev-id="${r.id}">
                            <div class="revision-info">
                                <span class="revision-reason">${reasonLabels[r.reason] || `<span>${esc(r.reason)}</span>`}</span>
                                <span class="revision-date">${date} à ${time}</span>
                            </div>
                            <div class="revision-meta">${r.slideCount} slides · ${r.title}</div>
                            <button class="tb-btn revision-restore">Restaurer</button>
                        </div>`;
                    }).join('')
                }
            </div>
        </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#close-revision-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.revision-restore').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = +btn.closest('.revision-item').dataset.revId;
            if (await OEIDialog.confirm('Restaurer cette révision ? Les modifications non sauvegardées seront perdues.')) {
                await restoreRevision(id);
                modal.remove();
            }
        });
    });
}

/* ── Auto-save revision on interval ──────────────────── */

let _autoRevisionTimer = null;

function startAutoRevisions(intervalMs = 5 * 60 * 1000) {
    stopAutoRevisions();
    _autoRevisionTimer = setInterval(() => {
        if (editor?.data?.slides?.length) {
            saveRevision('auto');
        }
    }, intervalMs);
}

function stopAutoRevisions() {
    if (_autoRevisionTimer) {
        clearInterval(_autoRevisionTimer);
        _autoRevisionTimer = null;
    }
}

/* ── Exports ─────────────────────────────────────────── */

window.saveToFile = saveToFile;
window.openFromFile = openFromFile;
window.resetFileHandle = resetFileHandle;
window.saveRevision = saveRevision;
window.getRevisions = getRevisions;
window.restoreRevision = restoreRevision;
window.openRevisionHistory = openRevisionHistory;
window.startAutoRevisions = startAutoRevisions;
window.stopAutoRevisions = stopAutoRevisions;
