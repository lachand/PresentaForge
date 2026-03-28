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
const _clipboardRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
const _clipboardCtx = () => {
    if (_clipboardRuntime?.resolveContext) {
        return _clipboardRuntime.resolveContext({
            editor,
            notify,
            canvasEditor,
        });
    }
    return { editor, notify, canvasEditor };
};
const _clipboardEditor = () => _clipboardCtx().editor;
const _clipboardCanvas = () => _clipboardCtx().canvasEditor || null;
const _clipboardNotify = (message, type = '') => {
    const fn = _clipboardCtx().notify;
    if (typeof fn === 'function') fn(message, type);
};

function clipboardCut() {
    const runtimeCanvas = _clipboardCanvas();
    if (!runtimeCanvas) return;
    const selected = runtimeCanvas.getSelectedElements();
    if (!selected.length) return;
    _clipboard = JSON.parse(JSON.stringify(selected));
    selected.forEach(e => runtimeCanvas.remove(e.id));
    _clipboardNotify('Coupé', 'success');
}
function clipboardCopy() {
    const runtimeCanvas = _clipboardCanvas();
    if (!runtimeCanvas) return;
    const selected = runtimeCanvas.getSelectedElements();
    if (!selected.length) return;
    _clipboard = JSON.parse(JSON.stringify(selected));
    _clipboardNotify(selected.length > 1 ? `${selected.length} éléments copiés` : 'Copié', 'success');
}
function clipboardPaste() {
    const runtimeCanvas = _clipboardCanvas();
    if (!_clipboard || !runtimeCanvas) return;
    const items = Array.isArray(_clipboard) ? _clipboard : [_clipboard];
    const maxZ = runtimeCanvas.elements.reduce((max, e) => Math.max(max, e.z || 0), 0);
    const newIds = [];
    items.forEach((item, i) => {
        const el = JSON.parse(JSON.stringify(item));
        el.id = 'el_' + Math.random().toString(36).slice(2, 9);
        el.x += 20; el.y += 20;
        el.z = maxZ + 1 + i;
        runtimeCanvas.elements.push(el);
        runtimeCanvas._addElementDOM(el);
        newIds.push(el.id);
    });
    // Select all pasted elements
    runtimeCanvas.selectedIds.clear();
    newIds.forEach(id => runtimeCanvas.selectedIds.add(id));
    runtimeCanvas.selectedId = newIds[newIds.length - 1];
    runtimeCanvas._updateSelectionVisuals();
    runtimeCanvas.onSelect(runtimeCanvas.elements.find(e => e.id === runtimeCanvas.selectedId) || null);
    runtimeCanvas.onChange(runtimeCanvas.serialize());
    _clipboardNotify(newIds.length > 1 ? `${newIds.length} éléments collés` : 'Collé', 'success');
}
function clipboardPasteFormat() {
    const runtimeCanvas = _clipboardCanvas();
    if (!_clipboardStyle || !runtimeCanvas?.getSelected()) return;
    const s = runtimeCanvas.getSelected();
    runtimeCanvas.updateData(s.id, { style: { ..._clipboardStyle } });
    _clipboardNotify('Format appliqué', 'success');
}
function copyFormat() {
    const s = _clipboardCanvas()?.getSelected();
    if (!s) return;
    _clipboardStyle = { ...(s.style || {}) };
    _clipboardNotify('Format copié', 'success');
}

/* ── Style Pipette Mode ────────────────────────────────── */
let _pipetteMode = false;
let _pipetteSource = null;

function togglePipetteMode() {
    if (!_clipboardCanvas()) { _clipboardNotify('Pas de canvas actif', 'error'); return; }
    _pipetteMode = !_pipetteMode;
    _pipetteSource = null;
    const btn = document.getElementById('btn-pipette');
    const frame = document.getElementById('preview-frame');
    if (_pipetteMode) {
        btn?.classList.add('active');
        frame?.classList.add('pipette-mode');
        _clipboardNotify('🎨 Pipette : cliquez sur un élément source', 'warning');
    } else {
        btn?.classList.remove('active');
        frame?.classList.remove('pipette-mode');
    }
}

function handlePipetteClick(elementId) {
    const runtimeCanvas = _clipboardCanvas();
    if (!_pipetteMode || !runtimeCanvas) return false;
    const el = runtimeCanvas.elements.find(e => e.id === elementId);
    if (!el) return false;
    if (!_pipetteSource) {
        // Step 1: pick source style
        _pipetteSource = { ...(el.style || {}) };
        _clipboardNotify('🎨 Style capturé — cliquez sur la cible', 'success');
        return true;
    } else {
        // Step 2: apply to target
        runtimeCanvas.updateData(el.id, { style: { ..._pipetteSource } });
        _clipboardNotify('🎨 Style appliqué !', 'success');
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
    const runtimeCanvas = _clipboardCanvas();
    const runtimeEditor = _clipboardEditor();
    if (!runtimeCanvas || !runtimeEditor?.data) return;
    const selected = runtimeCanvas.getSelectedElements();
    if (!selected.length) { _clipboardNotify('Sélectionnez d\'abord un élément', 'info'); return; }

    const slides = runtimeEditor.data.slides;
    const currentIdx = runtimeEditor.selectedIndex;
    const selectedIds = new Set(selected.map(e => e.id));

    // Connectors whose both endpoints are among selected elements
    const relatedConnectors = (runtimeCanvas.connectors || []).filter(
        c => selectedIds.has(c.sourceId) && selectedIds.has(c.targetId)
    );

    // Create modal dialog
    const overlay = document.createElement('div');
    overlay.className = 'copy-slide-overlay';
    const connNote = relatedConnectors.length ? ` + ${relatedConnectors.length} connecteur(s)` : '';
    overlay.innerHTML = `
        <div class="copy-slide-panel">
            <h3 class="copy-slide-title">Copier vers un slide</h3>
            <p class="copy-slide-meta">${selected.length} élément(s)${connNote} — choisir la ou les destinations</p>
            <div class="copy-slide-list" id="copy-slide-list"></div>
            <div class="copy-slide-actions">
                <button id="copy-slide-cancel" class="copy-slide-cancel-btn">Annuler</button>
                <button id="copy-slide-confirm" class="copy-slide-confirm-btn" disabled>Copier</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const list = overlay.querySelector('#copy-slide-list');
    const confirmBtn = overlay.querySelector('#copy-slide-confirm');

    const updateConfirm = () => {
        const checked = list.querySelectorAll('input[type=checkbox]:checked');
        confirmBtn.disabled = checked.length === 0;
        confirmBtn.textContent = checked.length > 1 ? `Copier vers ${checked.length} slides` : 'Copier';
    };

    slides.forEach((slide, index) => {
        const isCanvas = slide.type === 'canvas';
        const isCurrent = index === currentIdx;
        const disabled = !isCanvas || isCurrent;

        const row = document.createElement('label');
        row.className = 'copy-slide-row' + (disabled ? ' copy-slide-row--disabled' : '');

        const typeLabel = isCanvas ? '' : `<span class="copy-slide-type">${slide.type || '?'}</span>`;
        const title = slide.title ? `<span class="copy-slide-row-title">${slide.title}</span>` : '';
        const elemCount = isCanvas ? `<span class="copy-slide-row-count">${(slide.elements || []).length} él.</span>` : '';
        const currentMark = isCurrent ? '<span class="copy-slide-current">actuelle</span>' : '';

        row.innerHTML = `
            <input type="checkbox" value="${index}" ${disabled ? 'disabled' : ''}>
            <span class="copy-slide-row-num">Slide ${index + 1}</span>
            ${title}${typeLabel}${elemCount}${currentMark}`;
        row.querySelector('input')?.addEventListener('change', updateConfirm);
        list.appendChild(row);
    });

    confirmBtn.addEventListener('click', () => {
        const checked = [...list.querySelectorAll('input[type=checkbox]:checked')];
        if (!checked.length) return;
        let total = 0;
        checked.forEach(cb => {
            const index = parseInt(cb.value, 10);
            const cloned = JSON.parse(JSON.stringify(selected));
            const targetElements = slides[index].elements || [];
            const maxZ = targetElements.reduce((max, e) => Math.max(max, e.z || 0), 0);
            const idMap = {};
            cloned.forEach((el, i) => {
                const newId = 'el_' + Math.random().toString(36).slice(2, 9);
                idMap[el.id] = newId;
                el.id = newId;
                el.z = maxZ + 1 + i;
            });
            if (!slides[index].elements) slides[index].elements = [];
            slides[index].elements.push(...cloned);
            // Copy connectors, remapping IDs
            if (relatedConnectors.length) {
                if (!slides[index].connectors) slides[index].connectors = [];
                relatedConnectors.forEach(c => {
                    const cc = JSON.parse(JSON.stringify(c));
                    cc.id = 'cn_' + Math.random().toString(36).slice(2, 9);
                    cc.sourceId = idMap[c.sourceId] || c.sourceId;
                    cc.targetId = idMap[c.targetId] || c.targetId;
                    slides[index].connectors.push(cc);
                });
            }
            total += cloned.length;
        });
        runtimeEditor._push();
        overlay.remove();
        const dest = checked.length > 1 ? `${checked.length} slides` : `slide ${parseInt(checked[0].value, 10) + 1}`;
        _clipboardNotify(`${total} élément(s) copié(s) vers ${dest}`, 'success');
    });

    overlay.querySelector('#copy-slide-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}
