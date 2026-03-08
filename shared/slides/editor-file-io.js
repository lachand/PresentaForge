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
                    const slide = editor.currentSlide;
                    if (slide?.type === 'canvas' && canvasEditor) {
                        let src = String(reader.result || '');
                        if (typeof window.optimizeDataImageUrl === 'function' && src.startsWith('data:image/')) {
                            try {
                                const optimized = await window.optimizeDataImageUrl(src, { reason: 'drop-image', maxBytes: 240_000 });
                                if (optimized?.changed && optimized.dataUrl) src = optimized.dataUrl;
                            } catch (_) {}
                        }
                        const el = canvasEditor.add('image');
                        canvasEditor.updateData(el.id, { data: { src, alt: file.name } });
                        notify('Image ajoutée', 'success');
                    } else {
                        notify('Convertissez en canvas pour ajouter des images', 'warning');
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const data = JSON.parse(_repairJsonText(reader.result));
                        if (data.metadata && data.slides) {
                            editor.load(data);
                            notify('Présentation chargée', 'success');
                        } else {
                            notify('Format JSON invalide', 'error');
                        }
                    } catch(e) { notify('Erreur JSON: ' + e.message, 'error'); }
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
    if (!editor.data?.metadata?.title) return;
    const recents = _readRecent();
    const entry = {
        title: editor.data.metadata.title,
        date: new Date().toLocaleDateString('fr-FR'),
        slideCount: editor.data.slides.length,
        data: JSON.stringify(editor.data),
    };
    // Remove duplicates by title
    const filtered = recents.filter(r => r.title !== entry.title);
    filtered.unshift(entry);
    _writeRecent(filtered.slice(0, MAX_RECENT));
}

function renderRecentFiles() {
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
            <span class="recent-title">${esc(r.title)}</span>
            <span class="recent-date">${r.slideCount || '?'} slides · ${r.date}</span>
        </div>`
    ).join('');
    container.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = +item.dataset.recentIdx;
            const r = recents[idx];
            if (r?.data) {
                try {
                    editor.load(JSON.parse(r.data));
                    notify('Chargé : ' + r.title, 'success');
                } catch (e) { notify('Erreur de chargement', 'error'); }
            }
            document.getElementById('split-open-menu').classList.add('hidden');
        });
    });
}

/* ── I4: Breadcrumb click → go to slide ────────────────── */

function bindBreadcrumb() {
    // Breadcrumb removed — no longer needed
}
