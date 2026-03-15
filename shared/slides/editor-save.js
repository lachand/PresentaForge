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
        } catch (e) {
            const cancelCode = window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED';
            if (e?.code === cancelCode) return;
            notify('Erreur : ' + e.message, 'error');
        }
        return;
    }
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Presentation', accept: { 'application/json': ['.json'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        let data = null;
        let report = null;
        if (window.OEIImportPipeline?.importFromText) {
            const result = await window.OEIImportPipeline.importFromText(text, {
                pipelineSettings: typeof window.getAIImportPipelineSettings === 'function'
                    ? window.getAIImportPipelineSettings()
                    : null,
            });
            const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: handle.name || file.name || 'Fichier JSON' });
            if (!ok) return;
            data = result.data;
            report = result.report || null;
        } else {
            data = JSON.parse(_repairJsonText(text));
            if (!Array.isArray(data.slides)) throw new Error('Format invalide');
        }
        _fileHandle = handle;
        editor.load(data);
        _updateFileIndicator(handle.name);
        notify(
            report?.fixes?.length
                ? `Ouvert : ${handle.name} (${report.fixes.length} correction(s))`
                : ('Ouvert : ' + handle.name),
            report?.fixes?.length ? 'warning' : 'success'
        );
        saveRevision('open');
    } catch (err) {
        if (err.name === 'AbortError') return;
        const cancelCode = window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED';
        if (err?.code === cancelCode) {
            notify('Import annulé', 'info');
            return;
        }
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

function _revisionTypeLabel(type) {
    const map = {
        title: 'Titre',
        chapter: 'Chapitre',
        bullets: 'Contenu',
        code: 'Code',
        split: 'Split',
        definition: 'Definition',
        comparison: 'Comparaison',
        simulation: 'Simulation',
        image: 'Image',
        quote: 'Citation',
        quiz: 'Quiz',
        blank: 'Libre',
        canvas: 'Canvas',
    };
    return map[String(type || '').toLowerCase()] || String(type || 'Slide');
}

function _revisionExtractCanvasPreview(slide) {
    const elements = Array.isArray(slide?.elements) ? [...slide.elements] : [];
    elements.sort((a, b) => (Number(a?.z) || 0) - (Number(b?.z) || 0));

    const textByElement = (el) => {
        const data = el?.data || {};
        if (typeof data.text === 'string' && data.text.trim()) return data.text.trim();
        if (typeof data.title === 'string' && data.title.trim()) return data.title.trim();
        if (typeof data.question === 'string' && data.question.trim()) return data.question.trim();
        if (typeof data.term === 'string' && data.term.trim()) return data.term.trim();
        if (Array.isArray(data.items) && data.items.length) return String(data.items[0] || '').trim();
        if (Array.isArray(data.rows) && data.rows.length > 1) return String(data.rows[1]?.[0] || '').trim();
        return '';
    };

    const heading = elements.find((el) => el?.type === 'heading');
    const title = heading ? textByElement(heading) : '';

    const lines = [];
    for (const el of elements) {
        if (el?.type === 'heading') continue;
        const txt = textByElement(el);
        if (!txt) continue;
        lines.push(txt);
        if (lines.length >= 3) break;
    }

    return {
        title: title || 'Slide canvas',
        lines,
    };
}

function _revisionBuildPreviewFromData(data, activeSlideIndex = 0) {
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    if (!slides.length) {
        return {
            slideIndex: 0,
            type: 'slide',
            typeLabel: 'Slide',
            title: 'Presentation vide',
            lines: ['Aucun slide'],
        };
    }

    const idxRaw = Number(activeSlideIndex);
    const idx = Number.isFinite(idxRaw)
        ? Math.max(0, Math.min(slides.length - 1, Math.trunc(idxRaw)))
        : 0;
    const slide = slides[idx] || {};
    const type = String(slide.type || 'slide');
    const typeLabel = _revisionTypeLabel(type);

    let title = '';
    const lines = [];

    if (type === 'canvas') {
        const canvasPreview = _revisionExtractCanvasPreview(slide);
        title = canvasPreview.title;
        lines.push(...canvasPreview.lines);
    } else {
        const directTitle = [
            slide.title,
            slide.term,
            slide.quote,
            slide.question,
        ].find((value) => typeof value === 'string' && value.trim());
        title = String(directTitle || typeLabel || 'Slide').trim();

        if (Array.isArray(slide.items) && slide.items.length) {
            lines.push(...slide.items.slice(0, 3).map((item) => String(item || '').trim()).filter(Boolean));
        }
        if (typeof slide.subtitle === 'string' && slide.subtitle.trim()) lines.push(slide.subtitle.trim());
        if (typeof slide.definition === 'string' && slide.definition.trim()) lines.push(slide.definition.trim());
        if (typeof slide.code === 'string' && slide.code.trim()) {
            const firstLine = slide.code.split('\n').map((line) => line.trim()).find(Boolean);
            if (firstLine) lines.push(firstLine);
        }
    }

    const compactLines = [];
    for (const line of lines) {
        const txt = String(line || '').replace(/\s+/g, ' ').trim();
        if (!txt) continue;
        compactLines.push(txt);
        if (compactLines.length >= 3) break;
    }

    if (!compactLines.length) compactLines.push('Contenu du slide');

    return {
        slideIndex: idx,
        type,
        typeLabel,
        title: title || typeLabel || 'Slide',
        lines: compactLines,
    };
}

function _revisionPreviewFromSerialized(serializedData, activeSlideIndex = 0) {
    try {
        const parsed = JSON.parse(String(serializedData || '{}'));
        return _revisionBuildPreviewFromData(parsed, activeSlideIndex);
    } catch (_) {
        return {
            slideIndex: 0,
            type: 'slide',
            typeLabel: 'Slide',
            title: 'Revision',
            lines: ['Apercu indisponible'],
        };
    }
}

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
        const snapshot = JSON.parse(JSON.stringify(editor.data));
        const activeSlideIndex = Number.isFinite(Number(editor.selectedIndex))
            ? Math.trunc(Number(editor.selectedIndex))
            : 0;
        const preview = _revisionBuildPreviewFromData(snapshot, activeSlideIndex);

        store.add({
            presentationId: presId,
            timestamp: Date.now(),
            reason,
            title: snapshot.metadata?.title || 'Sans titre',
            slideCount: Array.isArray(snapshot.slides) ? snapshot.slides.length : 0,
            activeSlideIndex,
            preview,
            data: JSON.stringify(snapshot)
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
        <div class="modal revision-modal">
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
                        const preview = (r.preview && typeof r.preview === 'object')
                            ? r.preview
                            : _revisionPreviewFromSerialized(r.data, r.activeSlideIndex || 0);
                        const previewLines = Array.isArray(preview?.lines)
                            ? preview.lines.slice(0, 3).map(line => `<li>${esc(line)}</li>`).join('')
                            : '<li>Contenu du slide</li>';
                        const previewSlideNo = Number.isFinite(Number(preview?.slideIndex))
                            ? (Number(preview.slideIndex) + 1)
                            : ((Number.isFinite(Number(r.activeSlideIndex)) ? Number(r.activeSlideIndex) + 1 : 1));
                        return `<div class="revision-item" data-rev-id="${r.id}">
                            <div class="revision-thumb" role="img" aria-label="Aperçu de la révision">
                                <span class="revision-thumb-type">${esc(preview?.typeLabel || 'Slide')}</span>
                                <div class="revision-thumb-title">${esc(preview?.title || 'Slide')}</div>
                                <ul class="revision-thumb-lines">${previewLines}</ul>
                            </div>
                            <div class="revision-info">
                                <span class="revision-reason">${reasonLabels[r.reason] || `<span>${esc(r.reason)}</span>`}</span>
                                <span class="revision-date">${date} à ${time} · Slide ${previewSlideNo}</span>
                            </div>
                            <div class="revision-actions">
                                <div class="revision-meta">${r.slideCount} slides · ${esc(r.title)}</div>
                                <button class="tb-btn ui-btn revision-restore">Restaurer</button>
                            </div>
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
