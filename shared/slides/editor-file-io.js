/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-file-io
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-file-io.js"></script>
 */
/* editor-file-io.js — File drag-and-drop, recent files, breadcrumb */
const _fileIoRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
const _fileIoCtx = () => {
    if (_fileIoRuntime?.resolveContext) {
        return _fileIoRuntime.resolveContext({
            editor,
            notify,
            esc,
            canvasEditor,
        });
    }
    return {
        editor,
        notify,
        esc,
        canvasEditor,
    };
};

function initFileDrop() {
    const wrap = document.getElementById('preview-wrap');
    const overlay = document.getElementById('drop-overlay');
    if (!wrap || !overlay) return;
    let dragCounter = 0;

    wrap.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('visible');
    });
    wrap.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    wrap.addEventListener('dragleave', e => {
        dragCounter--;
        if (dragCounter <= 0) { overlay.classList.remove('visible'); dragCounter = 0; }
    });
    wrap.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('visible');
        const files = e.dataTransfer.files;
        if (!files.length) return;
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                // Add as image element to current canvas slide
                const reader = new FileReader();
                reader.onload = async () => {
                    const ctx = _fileIoCtx();
                    const slide = ctx.editor?.currentSlide;
                    if (slide?.type === 'canvas' && ctx.canvasEditor) {
                        let src = String(reader.result || '');
                        if (typeof window.optimizeDataImageUrl === 'function' && src.startsWith('data:image/')) {
                            try {
                                const optimized = await window.optimizeDataImageUrl(src, { reason: 'drop-image', maxBytes: 240_000 });
                                if (optimized?.changed && optimized.dataUrl) src = optimized.dataUrl;
                            } catch (_) {}
                        }
                        const el = ctx.canvasEditor.add('image');
                        ctx.canvasEditor.updateData(el.id, { data: { src, alt: file.name } });
                        if (typeof ctx.notify === 'function') ctx.notify('Image ajoutée', 'success');
                    } else {
                        if (typeof ctx.notify === 'function') ctx.notify('Convertissez en canvas pour ajouter des images', 'warning');
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = async () => {
                    const ctx = _fileIoCtx();
                    try {
                        const rawText = String(reader.result || '');
                        if (window.OEIImportPipeline?.importFromText) {
                            if (typeof ctx.notify === 'function') {
                                ctx.notify('Import: exécution des passes IA (plan → illustrations → base64 → validation)…', 'info');
                            }
                            const result = await window.OEIImportPipeline.importFromText(rawText, {
                                pipelineSettings: typeof window.getAIImportPipelineSettings === 'function'
                                    ? window.getAIImportPipelineSettings()
                                    : null,
                            });
                            const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: file.name });
                            if (!ok) return;
                            ctx.editor?.load(result.data);
                            if (typeof ctx.notify === 'function') {
                                ctx.notify(
                                    result.report?.fixes?.length
                                        ? `Présentation chargée (${result.report.fixes.length} correction(s))`
                                        : 'Présentation chargée',
                                    result.report?.fixes?.length ? 'warning' : 'success'
                                );
                            }
                            return;
                        }
                        const data = JSON.parse(_repairJsonText(rawText));
                        if (!Array.isArray(data?.slides)) throw new Error('Format JSON invalide');
                        ctx.editor?.load(data);
                        if (typeof ctx.notify === 'function') ctx.notify('Présentation chargée', 'success');
                    } catch(e) {
                        const cancelCode = window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED';
                        if (e?.code === cancelCode) {
                            if (typeof ctx.notify === 'function') ctx.notify('Import annulé', 'info');
                        } else {
                            if (typeof ctx.notify === 'function') ctx.notify('Erreur JSON: ' + e.message, 'error');
                        }
                    }
                };
                reader.readAsText(file);
            }
        }
    });
}

const _fileIoStorage = window.OEIStorage || null;
const RECENT_KEY = _fileIoStorage?.KEYS?.RECENT_PRESENTATIONS || 'oei-recent-presentations';
const MAX_RECENT = 5;
const _readRecent = () => {
    if (_fileIoStorage?.getJSON) return _fileIoStorage.getJSON(RECENT_KEY, []);
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
};
const _writeRecent = recents => {
    if (_fileIoStorage?.setJSON) return _fileIoStorage.setJSON(RECENT_KEY, recents);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recents)); return true; } catch (e) { return false; }
};

function saveToRecent() {
    const ctx = _fileIoCtx();
    if (!ctx.editor?.data?.metadata?.title) return;
    const recents = _readRecent();
    const entry = {
        title: ctx.editor.data.metadata.title,
        date: new Date().toLocaleDateString('fr-FR'),
        slideCount: ctx.editor.data.slides.length,
        data: JSON.stringify(ctx.editor.data),
    };
    // Remove duplicates by title
    const filtered = recents.filter(r => r.title !== entry.title);
    filtered.unshift(entry);
    _writeRecent(filtered.slice(0, MAX_RECENT));
}

function renderRecentFiles() {
    const ctx = _fileIoCtx();
    const escapeValue = typeof ctx.esc === 'function' ? ctx.esc : (value => String(value ?? ''));
    const container = document.getElementById('recent-files-list');
    if (!container) return;
    const recents = _readRecent();
    if (recents.length === 0) {
        container.innerHTML = '<div class="recent-empty">Aucun fichier récent</div>';
        return;
    }
    container.innerHTML = recents.map((r, i) =>
        `<div class="recent-item" data-recent-idx="${i}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="recent-title">${escapeValue(r.title)}</span>
            <span class="recent-date">${r.slideCount || '?'} slides · ${r.date}</span>
        </div>`
    ).join('');
    container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = +item.dataset.recentIdx;
            const r = recents[idx];
            if (r?.data) {
                try {
                    ctx.editor?.load(JSON.parse(r.data));
                    if (typeof ctx.notify === 'function') ctx.notify('Chargé : ' + r.title, 'success');
                } catch (e) {
                    if (typeof ctx.notify === 'function') ctx.notify('Erreur de chargement', 'error');
                }
            }
            document.getElementById('split-open-menu').classList.add('hidden');
        });
    });
}

/* ── I4: Breadcrumb click → go to slide ────────────────── */

function bindBreadcrumb() {
    // Breadcrumb removed — no longer needed
}
