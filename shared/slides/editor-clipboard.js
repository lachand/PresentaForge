/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-clipboard
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-clipboard.js"></script>
 */
/* editor-clipboard.js — Clipboard functions for slide editor */

let _clipboard = null;
let _clipboardStyle = null;

function clipboardCut() {
    if (!canvasEditor) return;
    const selected = canvasEditor.getSelectedElements();
    if (!selected.length) return;
    _clipboard = JSON.parse(JSON.stringify(selected));
    selected.forEach(e => canvasEditor.remove(e.id));
    notify('Coupé', 'success');
}
function clipboardCopy() {
    if (!canvasEditor) return;
    const selected = canvasEditor.getSelectedElements();
    if (!selected.length) return;
    _clipboard = JSON.parse(JSON.stringify(selected));
    notify(selected.length > 1 ? `${selected.length} éléments copiés` : 'Copié', 'success');
}
function clipboardPaste() {
    if (!_clipboard || !canvasEditor) return;
    const items = Array.isArray(_clipboard) ? _clipboard : [_clipboard];
    const maxZ = canvasEditor.elements.reduce((max, e) => Math.max(max, e.z || 0), 0);
    const newIds = [];
    items.forEach((item, i) => {
        const el = JSON.parse(JSON.stringify(item));
        el.id = 'el_' + Math.random().toString(36).slice(2, 9);
        el.x += 20; el.y += 20;
        el.z = maxZ + 1 + i;
        canvasEditor.elements.push(el);
        canvasEditor._addElementDOM(el);
        newIds.push(el.id);
    });
    // Select all pasted elements
    canvasEditor.selectedIds.clear();
    newIds.forEach(id => canvasEditor.selectedIds.add(id));
    canvasEditor.selectedId = newIds[newIds.length - 1];
    canvasEditor._updateSelectionVisuals();
    canvasEditor.onSelect(canvasEditor.elements.find(e => e.id === canvasEditor.selectedId) || null);
    canvasEditor.onChange(canvasEditor.serialize());
    notify(newIds.length > 1 ? `${newIds.length} éléments collés` : 'Collé', 'success');
}
function clipboardPasteFormat() {
    if (!_clipboardStyle || !canvasEditor?.getSelected()) return;
    const s = canvasEditor.getSelected();
    canvasEditor.updateData(s.id, { style: { ..._clipboardStyle } });
    notify('Format appliqué', 'success');
}
function copyFormat() {
    const s = canvasEditor?.getSelected();
    if (!s) return;
    _clipboardStyle = { ...(s.style || {}) };
    notify('Format copié', 'success');
}

/* ── Style Pipette Mode ────────────────────────────────── */
let _pipetteMode = false;
let _pipetteSource = null;

function togglePipetteMode() {
    if (!canvasEditor) { notify('Pas de canvas actif', 'error'); return; }
    _pipetteMode = !_pipetteMode;
    _pipetteSource = null;
    const btn = document.getElementById('btn-pipette');
    const frame = document.getElementById('preview-frame');
    if (_pipetteMode) {
        btn?.classList.add('active');
        frame?.classList.add('pipette-mode');
        notify('🎨 Pipette : cliquez sur un élément source', 'warning');
    } else {
        btn?.classList.remove('active');
        frame?.classList.remove('pipette-mode');
    }
}

function handlePipetteClick(elementId) {
    if (!_pipetteMode || !canvasEditor) return false;
    const el = canvasEditor.elements.find(e => e.id === elementId);
    if (!el) return false;
    if (!_pipetteSource) {
        // Step 1: pick source style
        _pipetteSource = { ...(el.style || {}) };
        notify('🎨 Style capturé — cliquez sur la cible', 'success');
        return true;
    } else {
        // Step 2: apply to target
        canvasEditor.updateData(el.id, { style: { ..._pipetteSource } });
        notify('🎨 Style appliqué !', 'success');
        // Stay in pipette mode to allow multiple pastes (shift behavior)
        // Exit on next toggle or Escape
        _pipetteSource = null;
        _pipetteMode = false;
        document.getElementById('btn-pipette')?.classList.remove('active');
        document.getElementById('preview-frame')?.classList.remove('pipette-mode');
        return true;
    }
}

/* ── Copy to another slide ─────────────────────────────── */

function openCopyToSlideDialog() {
    if (!canvasEditor || !editor.data) return;
    const selected = canvasEditor.getSelectedElements();
    if (!selected.length) { notify('Sélectionnez d\'abord un élément', 'info'); return; }

    const slides = editor.data.slides;
    const currentIdx = editor.selectedIndex;

    // Build list of canvas slides (excluding current)
    const canvasSlides = slides
        .map((s, i) => ({ slide: s, index: i }))
        .filter(s => s.slide.type === 'canvas' && s.index !== currentIdx);

    if (!canvasSlides.length) {
        notify('Aucun autre slide canvas disponible', 'info');
        return;
    }

    // Create modal dialog
    const overlay = document.createElement('div');
    overlay.className = 'copy-slide-overlay';
    overlay.innerHTML = `
        <div class="copy-slide-panel">
            <h3 class="copy-slide-title">Copier vers un slide</h3>
            <p class="copy-slide-meta">${selected.length} élément(s) sélectionné(s)</p>
            <div class="copy-slide-list" id="copy-slide-list"></div>
            <div class="copy-slide-actions">
                <button id="copy-slide-cancel" class="copy-slide-cancel-btn">Annuler</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('#copy-slide-list');
    canvasSlides.forEach(({ slide, index }) => {
        const title = slide.title || `Slide ${index + 1}`;
        const count = (slide.elements || []).length;
        const btn = document.createElement('button');
        btn.className = 'copy-slide-target-btn';
        btn.innerHTML = `<b>Slide ${index + 1}</b> — ${count} élément(s)`;
        btn.addEventListener('click', () => {
            // Deep-clone selected elements and add to target slide
            const cloned = JSON.parse(JSON.stringify(selected));
            const targetElements = slides[index].elements || [];
            const maxZ = targetElements.reduce((max, e) => Math.max(max, e.z || 0), 0);
            cloned.forEach((el, i) => {
                el.id = 'el_' + Math.random().toString(36).slice(2, 9);
                el.z = maxZ + 1 + i;
            });
            if (!slides[index].elements) slides[index].elements = [];
            slides[index].elements.push(...cloned);
            editor._push();
            overlay.remove();
            notify(`${cloned.length} élément(s) copié(s) vers le slide ${index + 1}`, 'success');
        });
        list.appendChild(btn);
    });

    overlay.querySelector('#copy-slide-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
