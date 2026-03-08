/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-format-tab
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-format-tab.js"></script>
 */
/* editor-format-tab.js — Format tab update, binding, and enhanced formatting controls */

function _fmtDefaultFontSizeForType(type, explicitSize) {
    if (Number.isFinite(explicitSize) && explicitSize > 0) return explicitSize;
    const byType = {
        heading: 52,
        text: 22,
        list: 22,
        definition: 16,
        'code-example': 16,
        quote: 26,
        card: 18,
        table: 18,
    };
    return byType[type] || 22;
}

function _fmtSetIntraSlideControlsEnabled(enabled, hintText = '') {
    const typeSelect = document.getElementById('fmt-anim-type');
    const orderInput = document.getElementById('fmt-anim-order');
    const listReveal = document.getElementById('fmt-list-fragments');
    const listRevealWrap = document.getElementById('fmt-list-fragments-wrap');
    const hintEl = document.getElementById('fmt-anim-empty-hint');

    if (typeSelect) typeSelect.disabled = !enabled;
    if (orderInput) orderInput.disabled = !enabled;
    if (listReveal) listReveal.disabled = !enabled;
    if (listRevealWrap) listRevealWrap.classList.toggle('is-disabled', !enabled);
    if (hintEl) {
        hintEl.textContent = hintText || 'Sélectionnez un élément pour configurer son apparition.';
        hintEl.style.display = enabled ? 'none' : '';
    }
}

function updateFormatTab() {
    const tabEl = document.getElementById('tab-format');
    const isCanvas = editor.currentSlide?.type === 'canvas';
    const hasSelection = isCanvas && canvasEditor?.selectedId;
    const hasConnector = isCanvas && canvasEditor?._selectedConnectorId;

    if (tabEl) tabEl.classList.toggle('visible', !!isCanvas);

    // Outside canvas slides, fallback to Accueil.
    if (!isCanvas) {
        if (tabEl && tabEl.classList.contains('active')) {
            switchRibbonTab('accueil');
        }
        return;
    }

    // When nothing is selected: keep Format visible and show Intra-slide guidance.
    if (!hasSelection && !hasConnector) {
        ['fmt-x','fmt-y','fmt-w','fmt-h'].forEach(id => {
            const inp = document.getElementById(id);
            if (inp) inp.value = '';
        });
        ['fmt-text-group','fmt-paragraph-group','fmt-image-group','fmt-shape-group','fmt-code-group','fmt-align-group'].forEach(id => {
            const g = document.getElementById(id);
            if (g) g.style.display = 'none';
        });
        const animGroup = document.getElementById('fmt-anim-group');
        if (animGroup) animGroup.style.display = '';
        const fmtListFragmentsWrap = document.getElementById('fmt-list-fragments-wrap');
        if (fmtListFragmentsWrap) fmtListFragmentsWrap.style.display = 'none';
        _fmtSetIntraSlideControlsEnabled(false, "Sélectionnez un bloc (ex: code-example), puis choisissez son effet d'apparition.");
        cleanFormatSeparators();
        return;
    }

    if (hasConnector && !hasSelection) {
        // Connector selected — hide element-specific format groups
        if (tabEl && !tabEl.classList.contains('active')) tabEl.click();
        ['fmt-x','fmt-y','fmt-w','fmt-h'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        // Hide all element-specific groups
        ['fmt-text-group','fmt-paragraph-group','fmt-image-group','fmt-shape-group','fmt-code-group','fmt-anim-group','fmt-align-group'].forEach(id => {
            const g = document.getElementById(id);
            if (g) g.style.display = 'none';
        });
        _fmtSetIntraSlideControlsEnabled(false, "La transition intra-slide s'applique aux éléments, pas aux connecteurs.");
        cleanFormatSeparators();
        return;
    }

    if (hasSelection) {
        // Auto-switch to Format tab when an element is selected
        if (tabEl && !tabEl.classList.contains('active')) {
            tabEl.click();
        }
        const el = canvasEditor.getSelected();
        if (el) {
            const s = el.style || {};
            const fmtX = document.getElementById('fmt-x');
            const fmtY = document.getElementById('fmt-y');
            const fmtW = document.getElementById('fmt-w');
            const fmtH = document.getElementById('fmt-h');
            if (fmtX && document.activeElement !== fmtX) fmtX.value = el.x;
            if (fmtY && document.activeElement !== fmtY) fmtY.value = el.y;
            if (fmtW && document.activeElement !== fmtW) fmtW.value = el.w;
            if (fmtH && document.activeElement !== fmtH) fmtH.value = el.h;
            const fmtColor = document.getElementById('fmt-color');
            if (fmtColor) fmtColor.value = colorToHex(s.color || s.fill || '#ffffff');
            const fmtFS = document.getElementById('fmt-font-size');
            if (fmtFS && document.activeElement !== fmtFS) fmtFS.value = _fmtDefaultFontSizeForType(el.type, s.fontSize);
            const fmtFW = document.getElementById('fmt-font-weight');
            if (fmtFW) fmtFW.value = String(s.fontWeight || 400);

            // Enhanced format tab fields
            _fmtSetIntraSlideControlsEnabled(true);
            updateFormatTabEnhanced();
        }
    }
}

function bindFormatTab() {
    const bindFmt = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const selected = canvasEditor?.getSelected();
            if (selected) fn(selected, el);
        });
    };
    bindFmt('fmt-x', (s, el) => canvasEditor.updateData(s.id, { x: +el.value }));
    bindFmt('fmt-y', (s, el) => canvasEditor.updateData(s.id, { y: +el.value }));
    bindFmt('fmt-w', (s, el) => canvasEditor.updateData(s.id, { w: +el.value }));
    bindFmt('fmt-h', (s, el) => canvasEditor.updateData(s.id, { h: +el.value }));
    bindFmt('fmt-color', (s, el) => canvasEditor.updateData(s.id, { style: { color: el.value, fill: el.value } }));
    bindFmt('fmt-font-size', (s, el) => canvasEditor.updateData(s.id, { style: { fontSize: +el.value } }));

    document.getElementById('fmt-font-weight')?.addEventListener('change', function() {
        const s = canvasEditor?.getSelected();
        if (s) canvasEditor.updateData(s.id, { style: { fontWeight: +this.value } });
    });

    ['left', 'center', 'right'].forEach(align => {
        document.getElementById('fmt-align-' + align)?.addEventListener('click', () => {
            const s = canvasEditor?.getSelected();
            if (s) canvasEditor.updateData(s.id, { style: { textAlign: align } });
        });
    });

    document.getElementById('fmt-z-up')?.addEventListener('click', () => {
        const s = canvasEditor?.getSelected();
        if (s) { s.z = (s.z || 1) + 1; canvasEditor.updateData(s.id, {}); }
    });
    document.getElementById('fmt-z-down')?.addEventListener('click', () => {
        const s = canvasEditor?.getSelected();
        if (s) { s.z = Math.max(1, (s.z || 1) - 1); canvasEditor.updateData(s.id, {}); }
    });
    document.getElementById('fmt-delete')?.addEventListener('click', () => {
        if (canvasEditor?.selectedId) canvasEditor.remove(canvasEditor.selectedId);
    });
}

function updateFormatTabEnhanced() {
    const el = canvasEditor?.getSelected();
    if (!el) return;
    const s = el.style || {};

    // Rotation
    const rotSlider = document.getElementById('fmt-rotation');
    const rotLabel = document.getElementById('fmt-rotation-label');
    if (rotSlider && document.activeElement !== rotSlider) rotSlider.value = s.rotate || 0;
    if (rotLabel) rotLabel.textContent = (s.rotate || 0) + '°';

    // Opacity
    const opSlider = document.getElementById('fmt-opacity');
    const opLabel = document.getElementById('fmt-opacity-label');
    if (opSlider && document.activeElement !== opSlider) opSlider.value = (s.opacity ?? 1) * 100;
    if (opLabel) opLabel.textContent = Math.round((s.opacity ?? 1) * 100) + '%';

    // Border
    const bColor = document.getElementById('fmt-border-color');
    if (bColor) bColor.value = colorToHex(s.borderColor || '#666666');
    const bWidth = document.getElementById('fmt-border-width');
    const bwLabel = document.getElementById('fmt-border-width-label');
    if (bWidth && document.activeElement !== bWidth) bWidth.value = parseInt(s.borderWidth) || 0;
    if (bwLabel) bwLabel.textContent = (parseInt(s.borderWidth) || 0) + 'px';
    const bRadius = document.getElementById('fmt-border-radius');
    const brLabel = document.getElementById('fmt-border-radius-label');
    if (bRadius && document.activeElement !== bRadius) bRadius.value = parseInt(s.borderRadius) || 0;
    if (brLabel) brLabel.textContent = (parseInt(s.borderRadius) || 0) + 'px';

    // Shadow toggle
    const shadowBtn = document.getElementById('fmt-shadow');
    if (shadowBtn) shadowBtn.classList.toggle('active', !!s.boxShadow && s.boxShadow !== 'none');

    // Lock toggle
    const lockBtn = document.getElementById('fmt-lock');
    if (lockBtn) lockBtn.classList.toggle('active', !!el.locked);

    // Font family
    const ff = document.getElementById('fmt-font-family');
    if (ff) ff.value = s.fontFamily || '';

    // Line height
    const lh = document.getElementById('fmt-line-height');
    const lhLabel = document.getElementById('fmt-line-height-label');
    const lhVal = s.lineHeight || 1.4;
    if (lh && document.activeElement !== lh) lh.value = Math.round(lhVal * 10);
    if (lhLabel) lhLabel.textContent = Number(lhVal).toFixed(1);

    // Letter spacing
    const ls = document.getElementById('fmt-letter-spacing');
    const lsLabel = document.getElementById('fmt-letter-spacing-label');
    const lsVal = parseInt(s.letterSpacing) || 0;
    if (ls && document.activeElement !== ls) ls.value = lsVal;
    if (lsLabel) lsLabel.textContent = lsVal;

    // Show/hide contextual groups
    const type = el.type;
    const textTypes = ['heading', 'text', 'list', 'definition', 'code-example', 'quote', 'card', 'table'];
    document.getElementById('fmt-text-group').style.display = textTypes.includes(type) ? '' : 'none';
    document.getElementById('fmt-paragraph-group').style.display = textTypes.includes(type) ? '' : 'none';
    document.getElementById('fmt-image-group').style.display = type === 'image' ? '' : 'none';
    document.getElementById('fmt-shape-group').style.display = type === 'shape' ? '' : 'none';
    document.getElementById('fmt-code-group').style.display = type === 'code' ? '' : 'none';

    // Animation group (always shown when element selected)
    const animGroup = document.getElementById('fmt-anim-group');
    if (animGroup) animGroup.style.display = '';

    // Show align/distribute when multi-selected
    const alignGroup = document.getElementById('fmt-align-group');
    const multiSelected = canvasEditor && canvasEditor.selectedIds.size >= 2;
    if (alignGroup) alignGroup.style.display = multiSelected ? '' : 'none';

    // Group/Ungroup buttons visibility
    const groupBtn = document.getElementById('fmt-group');
    const ungroupBtn = document.getElementById('fmt-ungroup');
    const hasGroup = !!el.groupId;
    if (groupBtn) groupBtn.style.display = multiSelected && !hasGroup ? '' : 'none';
    if (ungroupBtn) ungroupBtn.style.display = hasGroup ? '' : 'none';

    // Image style (fit + filters)
    if (type === 'image') {
        const fit = s.objectFit || 'cover';
        document.querySelectorAll('#fmt-image-group .fit-btn').forEach(b => b.classList.toggle('active', b.dataset.fit === fit));
        const filter = s.filter || 'none';
        document.querySelectorAll('#fmt-image-group .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
    }

    // Shape fill
    if (type === 'shape') {
        const fc = document.getElementById('fmt-fill-color');
        if (fc) fc.value = colorToHex(s.fill || '#818cf8');
    }

    // Code theme
    if (type === 'code') {
        const ct = document.getElementById('fmt-code-theme');
        if (ct) ct.value = el.data?.codeTheme || 'dark';
    }

    // Animation
    const animType = el.animation?.type || 'none';
    const animOrder = el.animation?.order ?? '';
    const fmtAnimType = document.getElementById('fmt-anim-type');
    const fmtAnimOrder = document.getElementById('fmt-anim-order');
    if (fmtAnimType) fmtAnimType.value = animType;
    if (fmtAnimOrder && document.activeElement !== fmtAnimOrder) fmtAnimOrder.value = animOrder;
    const fmtListFragmentsWrap = document.getElementById('fmt-list-fragments-wrap');
    const fmtListFragments = document.getElementById('fmt-list-fragments');
    const supportsProgressiveItems = type === 'list' || type === 'card';
    if (fmtListFragmentsWrap) fmtListFragmentsWrap.style.display = supportsProgressiveItems ? '' : 'none';
    if (fmtListFragments && document.activeElement !== fmtListFragments) {
        fmtListFragments.checked = !!el.data?.revealItems;
    }

    // Clean up separators (hide when adjacent to hidden groups or other hidden seps)
    cleanFormatSeparators();
}

function cleanFormatSeparators() {
    const panel = document.getElementById('ribbon-format');
    if (!panel) return;
    const children = Array.from(panel.children);
    // Forward pass: hide sep if previous visible item was also a sep (or it's leading)
    let lastVisibleWasSep = true;
    for (const child of children) {
        if (child.classList.contains('ribbon-sep')) {
            child.style.display = lastVisibleWasSep ? 'none' : '';
            if (child.style.display !== 'none') lastVisibleWasSep = true;
        } else if (child.classList.contains('ribbon-group')) {
            if (child.style.display !== 'none') lastVisibleWasSep = false;
        }
    }
    // Backward pass: hide trailing separators
    for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child.classList.contains('ribbon-sep')) {
            child.style.display = 'none';
        } else if (child.classList.contains('ribbon-group') && child.style.display !== 'none') {
            break;
        }
    }
}

function bindFormatTabEnhanced() {
    const bindFmt = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const selected = canvasEditor?.getSelected();
            if (selected) fn(selected, el);
        });
    };

    // Rotation
    bindFmt('fmt-rotation', (s, el) => {
        canvasEditor.updateData(s.id, { style: { rotate: +el.value } });
        const label = document.getElementById('fmt-rotation-label');
        if (label) label.textContent = el.value + '°';
    });

    // Opacity
    bindFmt('fmt-opacity', (s, el) => {
        canvasEditor.updateData(s.id, { style: { opacity: +el.value / 100 } });
        const label = document.getElementById('fmt-opacity-label');
        if (label) label.textContent = el.value + '%';
    });

    // Border
    bindFmt('fmt-border-color', (s, el) => canvasEditor.updateData(s.id, { style: { borderColor: el.value } }));
    bindFmt('fmt-border-width', (s, el) => {
        canvasEditor.updateData(s.id, { style: { borderWidth: el.value + 'px', borderStyle: +el.value > 0 ? 'solid' : 'none' } });
        const label = document.getElementById('fmt-border-width-label');
        if (label) label.textContent = el.value + 'px';
    });
    bindFmt('fmt-border-radius', (s, el) => {
        canvasEditor.updateData(s.id, { style: { borderRadius: el.value + 'px' } });
        const label = document.getElementById('fmt-border-radius-label');
        if (label) label.textContent = el.value + 'px';
    });

    // Shadow toggle
    document.getElementById('fmt-shadow')?.addEventListener('click', () => {
        const s = canvasEditor?.getSelected();
        if (!s) return;
        const hasShadow = s.style?.boxShadow && s.style.boxShadow !== 'none';
        canvasEditor.updateData(s.id, { style: { boxShadow: hasShadow ? 'none' : '0 8px 32px rgba(0,0,0,0.4)' } });
    });

    // Lock toggle
    document.getElementById('fmt-lock')?.addEventListener('click', () => {
        const s = canvasEditor?.getSelected();
        if (!s) return;
        s.locked = !s.locked;
        canvasEditor.updateData(s.id, {});
        const btn = document.getElementById('fmt-lock');
        if (btn) btn.classList.toggle('active', s.locked);
        notify(s.locked ? 'Verrouillé' : 'Déverrouillé', 'success');
    });

    // Duplicate
    document.getElementById('fmt-duplicate')?.addEventListener('click', () => {
        const s = canvasEditor?.getSelected();
        if (!s) return;
        const copy = JSON.parse(JSON.stringify(s));
        copy.id = 'el_' + Math.random().toString(36).slice(2, 9);
        copy.x += 20; copy.y += 20;
        copy.z = canvasEditor.elements.reduce((max, e) => Math.max(max, e.z || 0), 0) + 1;
        canvasEditor.elements.push(copy);
        canvasEditor._addElementDOM(copy);
        canvasEditor.select(copy.id);
        canvasEditor.onChange(canvasEditor.serialize());
    });

    // Delete
    document.getElementById('fmt-delete')?.addEventListener('click', () => {
        canvasEditor?.removeSelected();
    });

    // Group / Ungroup
    document.getElementById('fmt-group')?.addEventListener('click', () => {
        if (canvasEditor?.groupSelected()) {
            notify('Éléments groupés', 'success');
            updateFormatTab();
            updatePropsPanel();
        }
    });
    document.getElementById('fmt-ungroup')?.addEventListener('click', () => {
        if (canvasEditor?.ungroupSelected()) {
            notify('Éléments dégroupés', 'info');
            updateFormatTab();
            updatePropsPanel();
        }
    });

    // Font family
    document.getElementById('fmt-font-family')?.addEventListener('change', function() {
        const s = canvasEditor?.getSelected();
        if (s) canvasEditor.updateData(s.id, { style: { fontFamily: this.value || undefined } });
    });

    // Line height
    bindFmt('fmt-line-height', (s, el) => {
        const val = +el.value / 10;
        canvasEditor.updateData(s.id, { style: { lineHeight: val } });
        const label = document.getElementById('fmt-line-height-label');
        if (label) label.textContent = val.toFixed(1);
    });

    // Letter spacing
    bindFmt('fmt-letter-spacing', (s, el) => {
        canvasEditor.updateData(s.id, { style: { letterSpacing: el.value + 'px' } });
        const label = document.getElementById('fmt-letter-spacing-label');
        if (label) label.textContent = el.value;
    });

    // Image fit
    document.querySelectorAll('#fmt-image-group .fit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const s = canvasEditor?.getSelected();
            if (!s) return;
            document.querySelectorAll('#fmt-image-group .fit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            canvasEditor.updateData(s.id, { style: { objectFit: btn.dataset.fit } });
        });
    });

    // Image filters
    document.querySelectorAll('#fmt-image-group .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const s = canvasEditor?.getSelected();
            if (!s) return;
            document.querySelectorAll('#fmt-image-group .filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            canvasEditor.updateData(s.id, { style: { filter: chip.dataset.filter } });
        });
    });

    // Shape fill
    bindFmt('fmt-fill-color', (s, el) => canvasEditor.updateData(s.id, { style: { fill: el.value } }));

    // Code theme
    document.getElementById('fmt-code-theme')?.addEventListener('change', function() {
        const s = canvasEditor?.getSelected();
        if (s) canvasEditor.updateData(s.id, { data: { codeTheme: this.value } });
    });

    // Animation type
    document.getElementById('fmt-anim-type')?.addEventListener('change', function() {
        const s = canvasEditor?.getSelected();
        if (!s) return;
        const val = this.value;
        if (val === 'none') {
            canvasEditor.updateData(s.id, { animation: null });
        } else {
            const orderInp = document.getElementById('fmt-anim-order');
            const order = orderInp?.value !== '' ? +orderInp.value : undefined;
            canvasEditor.updateData(s.id, { animation: { type: val, order } });
        }
    });

    // Animation order
    bindFmt('fmt-anim-order', (s, el) => {
        const typeInp = document.getElementById('fmt-anim-type');
        const aType = typeInp?.value || 'fade-in';
        if (aType === 'none') return;
        canvasEditor.updateData(s.id, { animation: { type: aType, order: el.value !== '' ? +el.value : undefined } });
    });

    // Progressive list/card items (optional point-by-point reveal)
    document.getElementById('fmt-list-fragments')?.addEventListener('change', function() {
        const s = canvasEditor?.getSelected();
        if (!s || (s.type !== 'list' && s.type !== 'card')) return;
        canvasEditor.updateData(s.id, { data: { revealItems: !!this.checked } });
    });
}
