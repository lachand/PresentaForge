/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-resize
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-resize.js"></script>
 */
/* =========================================================
   Editor – Resizable panels
   Adds drag-to-resize for:
     1. Left sidebar  (#slide-list)    — vertical handle
     2. Right sidebar (#props-panel)   — vertical handle
     3. Notes panel   (#notes-panel)   — horizontal handle
   Sizes are persisted to localStorage.
   ========================================================= */

const _resizeStorage = window.OEIStorage || null;
const STORAGE_KEY = _resizeStorage?.KEYS?.EDITOR_PANEL_SIZES || 'oei-editor-panel-sizes';
const MIN_SLIDE_LIST = 140;
const MAX_SLIDE_LIST = 420;
const MIN_PROPS = 180;
const MAX_PROPS = 500;
const MIN_NOTES = 50;
const MAX_NOTES = 400;

function _loadPanelSizes() {
    if (_resizeStorage?.getJSON) return _resizeStorage.getJSON(STORAGE_KEY, {}) || {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function _savePanelSizes(s) {
    if (_resizeStorage?.setJSON) _resizeStorage.setJSON(STORAGE_KEY, s);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function initResizablePanels() {
    const sizes = _loadPanelSizes();

    // Apply saved sizes
    const slideList = document.getElementById('slide-list');
    const propsPanel = document.getElementById('props-panel');
    const notesPanel = document.getElementById('notes-panel');
    if (sizes.slideList && slideList) slideList.style.width = sizes.slideList + 'px';
    if (sizes.props && propsPanel) propsPanel.style.width = sizes.props + 'px';
    if (sizes.notes && notesPanel) notesPanel.style.height = sizes.notes + 'px';

    // Left sidebar resize handle
    _initVerticalResize('resize-handle-left', slideList, 'left', MIN_SLIDE_LIST, MAX_SLIDE_LIST, 'slideList');
    // Right sidebar resize handle
    _initVerticalResize('resize-handle-right', propsPanel, 'right', MIN_PROPS, MAX_PROPS, 'props');
    // Notes panel resize handle
    _initHorizontalResize('resize-handle-notes', notesPanel, MIN_NOTES, MAX_NOTES, 'notes');
}

function _initVerticalResize(handleId, panel, side, min, max, storageKey) {
    const handle = document.getElementById(handleId);
    if (!handle || !panel) return;

    handle.addEventListener('pointerdown', e => {
        if (panel.classList.contains('collapsed')) {
            if (side !== 'left') return;
            panel.classList.remove('collapsed');
            const currentWidth = parseFloat(panel.style.width || '0');
            panel.style.width = (Number.isFinite(currentWidth) && currentWidth >= min ? currentWidth : Math.max(min, 240)) + 'px';
            if (typeof window._syncSlideListControls === 'function') window._syncSlideListControls();
            requestAnimationFrame(() => typeof updatePreviewScale === 'function' && updatePreviewScale());
        }
        e.preventDefault();
        const pointerId = e.pointerId;
        const startX = e.clientX;
        const startW = panel.getBoundingClientRect().width;
        try { handle.setPointerCapture(pointerId); } catch (_) {}
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        handle.classList.add('dragging');

        const onMove = ev => {
            if (ev.pointerId !== pointerId) return;
            const dx = side === 'left' ? (ev.clientX - startX) : (startX - ev.clientX);
            const newW = Math.min(max, Math.max(min, startW + dx));
            panel.style.width = newW + 'px';
            panel.style.transition = 'none';
        };
        const onUp = ev => {
            if (ev.pointerId !== pointerId) return;
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            try { handle.releasePointerCapture(pointerId); } catch (_) {}
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            panel.style.transition = '';
            handle.classList.remove('dragging');
            const sizes = _loadPanelSizes();
            sizes[storageKey] = panel.getBoundingClientRect().width;
            _savePanelSizes(sizes);
            requestAnimationFrame(() => typeof updatePreviewScale === 'function' && updatePreviewScale());
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    });
}

function _initHorizontalResize(handleId, panel, min, max, storageKey) {
    const handle = document.getElementById(handleId);
    if (!handle || !panel) return;

    handle.addEventListener('pointerdown', e => {
        if (panel.classList.contains('collapsed')) return;
        e.preventDefault();
        const pointerId = e.pointerId;
        const startY = e.clientY;
        const startH = panel.getBoundingClientRect().height;
        try { handle.setPointerCapture(pointerId); } catch (_) {}
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        handle.classList.add('dragging');

        const onMove = ev => {
            if (ev.pointerId !== pointerId) return;
            const dy = startY - ev.clientY; // dragging up = bigger
            const newH = Math.min(max, Math.max(min, startH + dy));
            panel.style.height = newH + 'px';
            panel.style.transition = 'none';
        };
        const onUp = ev => {
            if (ev.pointerId !== pointerId) return;
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            try { handle.releasePointerCapture(pointerId); } catch (_) {}
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            panel.style.transition = '';
            handle.classList.remove('dragging');
            const sizes = _loadPanelSizes();
            sizes[storageKey] = panel.getBoundingClientRect().height;
            _savePanelSizes(sizes);
            requestAnimationFrame(() => typeof updatePreviewScale === 'function' && updatePreviewScale());
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
    });
}
