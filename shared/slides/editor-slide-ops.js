/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-slide-ops
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-slide-ops.js"></script>
 */
/* editor-slide-ops.js — Slide operations for slide editor */

/* ── A5: Slide move up/down ────────────────────────────── */

function slideMove(dir) {
    const selected = (typeof editor.getSelectedSlideIndices === 'function')
        ? editor.getSelectedSlideIndices()
        : [editor.selectedIndex];
    const sorted = [...selected].sort((a, b) => a - b);
    if (!sorted.length) return;
    if (dir < 0 && sorted[0] <= 0) return;
    if (dir > 0 && sorted[sorted.length - 1] >= editor.data.slides.length - 1) return;
    if (sorted.length > 1 && typeof editor.moveSlides === 'function') {
        const targetIndex = dir < 0 ? sorted[0] - 1 : sorted[sorted.length - 1] + 2;
        editor.moveSlides(sorted, targetIndex);
        return;
    }
    const idx = editor.selectedIndex;
    const newIdx = idx + dir;
    editor.moveSlide(idx, newIdx);
}

/* ── A6: Hide slide ────────────────────────────────────── */

function toggleHideSlide() {
    const slide = editor.currentSlide;
    if (!slide) return;
    slide.hidden = !slide.hidden;
    editor._push();
    const btn = document.getElementById('btn-hide-slide');
    if (btn) btn.style.background = slide.hidden ? 'var(--primary-muted)' : '';
    notify(slide.hidden ? 'Slide masqué' : 'Slide visible', 'success');
    renderSlideList();
    renderPreview();
}

/* ── A7: Select all / A8: Group ────────────────────────── */

function selectAll() {
    if (!canvasEditor) return;
    const slide = editor.currentSlide;
    if (slide?.type !== 'canvas' || !slide.elements?.length) return;
    canvasEditor.selectAllElements();
    notify(`${slide.elements.length} éléments sélectionnés`, 'success');
}

function groupSelected() {
    if (!canvasEditor) return;
    const selected = canvasEditor.getSelectedElements();
    if (selected.length < 2) { notify('Sélectionnez au moins 2 éléments', 'warning'); return; }
    const groupId = 'grp_' + Math.random().toString(36).slice(2, 7);
    selected.forEach(e => e.groupId = groupId);
    canvasEditor._updateSelectionVisuals();
    const data = canvasEditor.serialize();
    canvasEditor.onChange(data);
    notify(`${selected.length} éléments groupés`, 'success');
    updatePropsPanel();
}

function ungroupSelected() {
    if (!canvasEditor) return;
    if (canvasEditor.ungroupSelected()) {
        notify('Éléments dégroupés', 'success');
    }
}
