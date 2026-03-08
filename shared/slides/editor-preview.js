/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-preview
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-preview.js"></script>
 */
// @ts-check
/* editor-preview.js — Slide list, drag-and-drop, canvas editor mount, preview rendering, popovers, template conversion */

let _canvasLoadedIndex = -1;

function _slideRenderOpts() {
    if (!editor.data) return {};
    return {
        showSlideNumber: editor.data.showSlideNumber || false,
        footerText: editor.data.footerText || null,
        footerConfig: (editor.data && typeof editor.data.footerConfig === 'object' && editor.data.footerConfig) ? editor.data.footerConfig : null,
        metadata: editor.data.metadata || {},
        totalSlides: editor.data.slides?.length || 0,
        chapterNumbers: SlidesRenderer._buildChapterNumbers(editor.data.slides || [], editor.data.autoNumberChapters),
        typography: SlidesShared.resolveTypographyDefaults(editor.data.typography),
    };
}

function isSlideListInteractionContext() {
    const active = document.activeElement;
    if (!active) return false;
    if (active.id === 'slides-items') return true;
    return !!(active.closest && active.closest('#slide-list'));
}
window.isSlideListInteractionContext = isSlideListInteractionContext;

function renderSlideList() {
    const container = document.getElementById('slides-items');
    const slides = editor.data.slides;
    const typeMap = Object.fromEntries(SlidesEditor.SLIDE_TYPES.map(t => [t.id, t]));
    const opts = _slideRenderOpts();
    const selectedSet = new Set(
        (typeof editor.getSelectedSlideIndices === 'function')
            ? editor.getSelectedSlideIndices()
            : [editor.selectedIndex],
    );
    container.tabIndex = 0;
    container.setAttribute('aria-label', 'Liste des slides');
    container.setAttribute('role', 'listbox');

    container.innerHTML = slides.map((slide, i) => {
        const meta = typeMap[slide.type] || { icon: '⬜', label: slide.type };
        const title = slide.title || slide.quote || slide.term || `Slide ${i + 1}`;
        const active = i === editor.selectedIndex ? ' active' : '';
        const selected = selectedSet.has(i) ? ' selected' : '';
        const notesDot = slide.notes ? '<span class="sl-thumb-notes-dot" title="Contient des notes"></span>' : '';
        const thumbHtml = SlidesRenderer.renderSlide(slide, i, opts);
        const hiddenCls = slide.hidden ? ' hidden-slide' : '';
        return `<div class="sl-thumb-wrap${active}${selected}${hiddenCls}" data-idx="${i}" data-selected="${selectedSet.has(i) ? '1' : '0'}" draggable="true" role="option" aria-selected="${selectedSet.has(i) ? 'true' : 'false'}">
            <div class="sl-thumb-outer">
                <div class="sl-thumb-inner">${thumbHtml}</div>
            </div>
            <div class="sl-thumb-info">
                <span class="sl-thumb-num">${i + 1}</span>
                <span class="sl-thumb-icon">${meta.icon}</span>
                <span class="sl-thumb-title" title="${escAttr(title)}">${esc(title)}</span>
                ${notesDot}
            </div>
            <div class="sl-thumb-actions">
                <button class="sl-thumb-action-btn" data-action="dup" title="Dupliquer">⧉</button>
                <button class="sl-thumb-action-btn danger" data-action="del" title="Supprimer">✕</button>
            </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.sl-thumb-wrap').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('[data-action]')) return;
            if (e.target.closest('.sl-thumb-title-input')) return;
            const idx = +el.dataset.idx;
            container.focus({ preventScroll: true });
            if (e.shiftKey && typeof editor.extendSlideSelection === 'function') {
                editor.extendSlideSelection(idx);
            } else if ((e.ctrlKey || e.metaKey) && typeof editor.toggleSlideSelection === 'function') {
                editor.toggleSlideSelection(idx);
            } else {
                editor.selectSlide(idx);
            }
            renderSlideList();
            renderPreview();
        });
        el.addEventListener('mousedown', () => {
            container.focus({ preventScroll: true });
        });
        // Double-click on title for inline edit
        const titleSpan = el.querySelector('.sl-thumb-title');
        if (titleSpan) {
            titleSpan.addEventListener('dblclick', e => {
                e.stopPropagation();
                const idx = +el.dataset.idx;
                const slide = editor.data.slides[idx];
                if (!slide) return;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'sl-thumb-title-input';
                input.value = slide.title || '';
                input.placeholder = `Slide ${idx + 1}`;
                titleSpan.replaceWith(input);
                input.focus();
                input.select();
                const commit = () => {
                    const val = input.value.trim();
                    slide.title = val || undefined;
                    editor._push();
                };
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', ev => {
                    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                    if (ev.key === 'Escape') { input.value = slide.title || ''; input.blur(); }
                });
            });
        }
    });
    container.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const i = +btn.closest('[data-idx]').dataset.idx;
            const selected = (typeof editor.getSelectedSlideIndices === 'function')
                ? editor.getSelectedSlideIndices()
                : [editor.selectedIndex];
            const target = (selected.includes(i) && selected.length > 1) ? selected : [i];
            switch(btn.dataset.action) {
                case 'dup':
                    if (target.length > 1 && typeof editor.duplicateSlides === 'function') editor.duplicateSlides(target);
                    else editor.duplicateSlide(i);
                    break;
                case 'del':
                    if (await OEIDialog.confirm(
                        target.length > 1
                            ? `Supprimer ${target.length} slides sélectionnés ?`
                            : 'Supprimer ce slide ?',
                        { danger: true },
                    )) {
                        if (target.length > 1 && typeof editor.removeSlides === 'function') editor.removeSlides(target);
                        else editor.removeSlide(i);
                    }
                    break;
            }
        });
    });
    setupDragAndDrop(container);
    const active = container.querySelector('.sl-thumb-wrap.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function setupDragAndDrop(container) {
    let dragIdx = null;
    let movingIndices = [];
    container.querySelectorAll('.sl-thumb-wrap').forEach(el => {
        el.addEventListener('dragstart', e => {
            dragIdx = +el.dataset.idx;
            const selected = (typeof editor.getSelectedSlideIndices === 'function')
                ? editor.getSelectedSlideIndices()
                : [editor.selectedIndex];
            movingIndices = (selected.includes(dragIdx) && selected.length > 1) ? selected : [dragIdx];
            movingIndices.forEach((idx) => {
                const node = container.querySelector(`.sl-thumb-wrap[data-idx="${idx}"]`);
                node?.classList.add('dragging');
            });
            container.focus({ preventScroll: true });
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => {
            movingIndices.forEach((idx) => {
                const node = container.querySelector(`.sl-thumb-wrap[data-idx="${idx}"]`);
                node?.classList.remove('dragging');
            });
            container.querySelectorAll('.sl-thumb-wrap').forEach(w => w.classList.remove('drag-over-top', 'drag-over-bottom'));
            dragIdx = null;
            movingIndices = [];
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const overIdx = +el.dataset.idx;
            if (movingIndices.includes(overIdx) && movingIndices.length === 1) return;
            container.querySelectorAll('.sl-thumb-wrap').forEach(w => w.classList.remove('drag-over-top', 'drag-over-bottom'));
            const rect = el.getBoundingClientRect();
            el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over-top', 'drag-over-bottom'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            if (dragIdx === null || !movingIndices.length) return;
            const overIdx = +el.dataset.idx;
            const rect = el.getBoundingClientRect();
            const isTop = e.clientY < rect.top + rect.height / 2;
            const insertIndex = isTop ? overIdx : (overIdx + 1);
            if (typeof editor.moveSlides === 'function') editor.moveSlides(movingIndices, insertIndex);
            else {
                let to = isTop
                    ? (dragIdx < overIdx ? overIdx - 1 : overIdx)
                    : (dragIdx < overIdx ? overIdx : overIdx + 1);
                to = Math.max(0, Math.min(editor.data.slides.length - 1, to));
                if (to !== dragIdx) editor.moveSlide(dragIdx, to);
            }
        });
    });
}

/* ── Preview ───────────────────────────────────────────── */

function mountCanvasEditor(slide) {
    const frame = document.getElementById('preview-frame');
    const currentIndex = editor.selectedIndex;
    const themeData = window.OEIDesignTokens?.resolvePresentationTheme
        ? window.OEIDesignTokens.resolvePresentationTheme(editor.data)
        : (typeof editor.data.theme === 'string'
            ? (SlidesThemes.BUILT_IN[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
            : editor.data.theme);
    const bg = slide.bg || themeData?.colors?.slideBg || '#1a1d27';
    frame.style.background = bg;
    frame.style.backgroundImage = '';
    frame.style.backgroundSize = '';
    frame.style.backgroundPosition = '';
    frame.style.backgroundRepeat = '';
    const bgImageUrl = window.OEIBackgroundUtils?.normalizeUrl
        ? window.OEIBackgroundUtils.normalizeUrl(slide.bgImage)
        : (typeof slide.bgImage === 'string' ? slide.bgImage.trim() : '');
    if (bgImageUrl) {
        const size = window.OEIBackgroundUtils?.cssSize
            ? window.OEIBackgroundUtils.cssSize(slide.bgSize)
            : (slide.bgSize === 'contain' ? 'contain' : (slide.bgSize === 'stretch' ? '100% 100%' : 'cover'));
        frame.style.backgroundImage = slide.bgOverlay
            ? `linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)), url("${bgImageUrl}")`
            : `url("${bgImageUrl}")`;
        frame.style.backgroundSize = size;
        frame.style.backgroundPosition = 'center center';
        frame.style.backgroundRepeat = 'no-repeat';
    }

    if (!canvasEditor) {
        frame.innerHTML = '';
        canvasEditor = new CanvasEditor(frame, {
            scale: previewScale,
            scriptBasePath: '../shared/components/',
            onChange: (data) => editor.updateSlide(editor.selectedIndex, { elements: data.elements, connectors: data.connectors }),
            onSelect: (element) => { updateFormatTab(); updatePropsPanel(); },
        });
        canvasEditor.onDblClick = (el, e) => openCanvasPopover(el, e);
        canvasEditor.onPositionChange = () => { updateFormatTab(); updatePropsPanel(); };
        canvasEditor.onContextMenu = (id, e) => openContextMenu(id, e);
        canvasEditor.onConnectorSelect = (conn) => { updateFormatTab(); updatePropsPanel(); };
        canvasEditor.onConnectorDblClick = (conn, e) => {
            // Expand sidebar to show connector props instead of popover
            const propsPanel = document.getElementById('props-panel');
            if (propsPanel) {
                propsPanel._userCollapsed = false;
                propsPanel.classList.remove('collapsed');
            }
            updatePropsPanel();
        };
        _canvasLoadedIndex = -1;
    }
    if (_canvasLoadedIndex !== currentIndex) {
        canvasEditor.load(
            slide.elements || [],
            slide.bg,
            slide.connectors || [],
            currentIndex,
            SlidesShared.resolveTypographyDefaults(editor.data?.typography),
        );
        // Build caption registry from all slides for cross-references
        canvasEditor.setCaptionRegistry(SlidesShared.buildCaptionRegistry(editor.data?.slides || []));
        _canvasLoadedIndex = currentIndex;
    } else {
        canvasEditor.setTypography(SlidesShared.resolveTypographyDefaults(editor.data?.typography));
    }
    canvasEditor.setScale(previewScale);
}

function unmountCanvasEditor() {
    if (canvasEditor) {
        canvasEditor.destroy();
        canvasEditor = null;
        _canvasLoadedIndex = -1;
    }
    const frame = document.getElementById('preview-frame');
    frame.innerHTML = '';
    frame.style.background = '';
}

function renderPreview() {
    const slide = editor.currentSlide;
    const frame = document.getElementById('preview-frame');
    const total = editor.data?.slides.length || 0;
    if (!slide) { unmountCanvasEditor(); return; }
    // preview-label removed
    const notesArea = document.getElementById('notes-textarea');
    if (notesArea && document.activeElement !== notesArea) notesArea.value = slide.notes || '';
    if (slide.type === 'canvas') {
        mountCanvasEditor(slide);
    } else {
        unmountCanvasEditor();
        frame.innerHTML = SlidesRenderer.renderSlide(slide, editor.selectedIndex, _slideRenderOpts());
        SlidesRenderer.mountWidgets(frame);
        if (window.hljs) {
            frame.querySelectorAll('code[class*=language-]').forEach(block => {
                try { hljs.highlightElement(block); } catch(e) {}
            });
        }
        // Double-click on template slide → open content popover
        frame.ondblclick = (e) => openTemplatePopover(editor.currentSlide, e);

        // Show convert-to-canvas hint
        const hint = document.createElement('div');
        hint.className = 'preview-convert-hint';
        hint.onmouseenter = () => { hint.classList.add('is-hover'); };
        hint.onmouseleave = () => { hint.classList.remove('is-hover'); };
        hint.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Convertir en canvas pour déplacer les éléments';
        hint.onclick = (e) => { e.stopPropagation(); convertTemplateToCanvas(); };
        frame.style.position = 'relative';
        frame.appendChild(hint);
    }
}

/* ── Content Popover ────────────────────────────────────── */

function closeContentPopover() {
    const popover = document.getElementById('content-popover');
    if (popover) { popover.style.display = 'none'; popover.innerHTML = ''; popover.classList.remove('template-popover'); }
}

function positionPopover(popover, refEvent) {
    const ww = window.innerWidth, wh = window.innerHeight;
    let left, top;
    if (refEvent && refEvent.clientX) {
        left = refEvent.clientX + 12;
        top = refEvent.clientY - 30;
    } else {
        const preview = document.getElementById('preview-wrapper');
        const r = preview.getBoundingClientRect();
        left = r.right - 340;
        top = r.top + 40;
    }
    popover.style.display = 'block';
    const pw = popover.offsetWidth || 320, ph = popover.offsetHeight || 300;
    if (left + pw + 8 > ww) left = ww - pw - 12;
    if (top + ph + 8 > wh) top = wh - ph - 12;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
}

function openCanvasPopover(element, event) {
    if (!element) return;
    // For types with inline editing, do nothing
    if (['heading', 'text', 'code', 'definition', 'list'].includes(element.type)) return;

    // For all content types, expand sidebar and focus the first input
    const propsPanel = document.getElementById('props-panel');
    if (propsPanel) {
        propsPanel._userCollapsed = false;
        propsPanel.classList.remove('collapsed');
        updatePropsPanel();
        requestAnimationFrame(() => {
            const firstInput = document.querySelector('#props-content input, #props-content textarea, #props-content select');
            if (firstInput) firstInput.focus();
            updatePreviewScale();
        });
    }
}

function openTemplatePopover(slide, refEvent) {
    if (!slide || slide.type === 'canvas') return;
    const popover = document.getElementById('content-popover');
    const typeMeta = SlidesEditor.SLIDE_TYPES.find(t => t.id === slide.type) || { icon: '⬜', label: slide.type };
    const fields = SlidesEditor.fieldsFor(slide.type);

    let html = `<div class="content-popover-header">
        <span>${typeMeta.icon} ${typeMeta.label} — Contenu</span>
        <button class="popover-close" id="popover-close-btn">✕</button>
    </div>`;

    html += `<div class="field"><label>Type de slide</label>
        <select id="field-type-change">
            ${SlidesEditor.SLIDE_TYPES.map(t => `<option value="${t.id}"${t.id === slide.type ? ' selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
        </select>
    </div>`;

    for (const field of fields) {
        if (field.showIf && !field.showIf(slide)) continue;
        const val = SlidesEditor.getDeep(slide, field.key);
        html += `<div class="field" data-field-key="${field.key}">`;
        html += `<label>${field.label}${field.required ? ' *' : ''}</label>`;
        if (field.type === 'text') {
            html += `<input type="text" value="${escAttr(val || '')}" placeholder="${escAttr(field.placeholder || '')}" data-field="${field.key}">`;
        } else if (field.type === 'textarea') {
            html += `<textarea data-field="${field.key}" placeholder="${escAttr(field.placeholder || '')}">${esc(val || '')}</textarea>`;
        } else if (field.type === 'code') {
            html += `<textarea class="code-field" data-field="${field.key}" style="font-family:var(--mono)">${esc(val || '')}</textarea>`;
        } else if (field.type === 'select') {
            html += `<select data-field="${field.key}">${(field.options || []).map(o => `<option value="${o}"${o === val ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
        } else if (field.type === 'widget-select') {
            const wLabel = (SlidesEditor.WIDGET_OPTIONS.find(o => o.id === val) || {}).label || val || 'Choisir…';
            html += `<input type="hidden" data-field="${field.key}" value="${escAttr(val || '')}">
            <button type="button" class="wpm-trigger-btn" data-wpm-field="${field.key}" style="width:100%">
                <span data-wpm-label="${field.key}">${wLabel}</span>
            </button>`;
        } else if (field.type === 'items') {
            const items = Array.isArray(val) ? val : [];
            html += `<div class="items-editor" data-items-field="${field.key}">
                ${items.map((item, idx) => {
                    const txt = typeof item === 'string' ? item : item.text || '';
                    return `<div class="item-row"><input type="text" value="${escAttr(txt)}" data-item-idx="${idx}">
                        <button class="icon-btn" data-del-item="${idx}" title="Supprimer">✕</button>
                    </div>`;
                }).join('')}
                <button class="add-item-btn" data-add-items>+ Ajouter un point</button>
            </div>`;
        }
        html += `</div>`;
    }

    const TRANSITIONS = ['', 'slide', 'fade', 'zoom', 'convex', 'concave', 'none'];
    const TRANS_LABELS = { '': 'Par défaut', slide: 'Slide', fade: 'Fade', zoom: 'Zoom', convex: 'Convex', concave: 'Concave', none: 'Aucune' };
    html += `<div class="props-section-title">Présentation</div>
    <div class="field"><label>Transition</label>
        <select data-field="transition">
            ${TRANSITIONS.map(v => `<option value="${v}"${slide.transition === v || (!slide.transition && v === '') ? ' selected' : ''}>${TRANS_LABELS[v]}</option>`).join('')}
        </select>
    </div>
    <div class="field"><label>Fond de slide</label>
        <div style="display:flex;gap:6px;align-items:center">
            <input type="color" id="field-bg-pick" value="${colorToHex(slide.bg || '')}" style="width:36px;height:28px">
            <input type="text" data-field="bg" value="${escAttr(slide.bg || '')}" placeholder="(thème)" style="flex:1">
        </div>
    </div>`;

    popover.innerHTML = html;
    popover.classList.add('template-popover');
    positionPopover(popover, refEvent);

    // Bind close
    document.getElementById('popover-close-btn').addEventListener('click', closeContentPopover);

    // Bind type change
    popover.querySelector('#field-type-change')?.addEventListener('change', async e => {
        const newType = e.target.value;
        if (newType !== slide.type) {
            if (!await OEIDialog.confirm(`Changer le type de slide ?\nLe contenu actuel sera remplacé par un slide vide de type "${newType}". Annulable via Ctrl+Z.`)) {
                e.target.value = slide.type;
                return;
            }
            editor.replaceSlide(editor.selectedIndex, SlidesEditor.DEFAULT_SLIDE(newType));
            closeContentPopover();
        }
    });

    // Bind text/textarea/select fields
    popover.querySelectorAll('[data-field]').forEach(input => {
        const key = input.dataset.field;
        const ev = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(ev, () => {
            const patch = {};
            SlidesEditor.setDeep(patch, key, input.value);
            editor.updateSlide(editor.selectedIndex, patch);
        });
    });

    // Bind widget-picker buttons
    popover.querySelectorAll('[data-wpm-field]').forEach(btn => {
        const fieldKey = btn.dataset.wpmField;
        btn.addEventListener('click', () => {
            const hidden = popover.querySelector(`input[type="hidden"][data-field="${fieldKey}"]`);
            WidgetPickerModal.open({
                currentId: hidden?.value || null,
                onSelect: (id) => {
                    if (!hidden) return;
                    hidden.value = id;
                    hidden.dispatchEvent(new Event('input'));
                    const labelEl = btn.querySelector(`[data-wpm-label="${fieldKey}"]`);
                    if (labelEl) {
                        const reg = window.OEI_WIDGET_REGISTRY || {};
                        labelEl.textContent = reg[id]?.label || id;
                    }
                }
            });
        });
    });

    bindBgPicker(popover);

    // Bind items editors
    popover.querySelectorAll('[data-items-field]').forEach(itemsEl => {
        const key = itemsEl.dataset.itemsField;
        const getItems = () => Array.from(itemsEl.querySelectorAll('[data-item-idx]')).map(i => i.value);
        itemsEl.querySelectorAll('[data-item-idx]').forEach(input => {
            input.addEventListener('input', () => { const patch = {}; SlidesEditor.setDeep(patch, key, getItems()); editor.updateSlide(editor.selectedIndex, patch); });
        });
        itemsEl.querySelectorAll('[data-del-item]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = +btn.dataset.delItem;
                const items = getItems(); items.splice(idx, 1);
                const patch = {}; SlidesEditor.setDeep(patch, key, items);
                editor.updateSlide(editor.selectedIndex, patch);
            });
        });
        itemsEl.querySelector('[data-add-items]')?.addEventListener('click', () => {
            const items = getItems(); items.push('');
            const patch = {}; SlidesEditor.setDeep(patch, key, items);
            editor.updateSlide(editor.selectedIndex, patch);
        });
    });

    // Focus first content input
    setTimeout(() => popover.querySelector('input,textarea')?.focus(), 50);
}

// Close popover on Escape or click outside
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeContentPopover(); });
document.addEventListener('mousedown', e => {
    const popover = document.getElementById('content-popover');
    if (popover && popover.style.display !== 'none' && !popover.contains(e.target)) closeContentPopover();
});

/* ── Bind background color picker ──────────────────────── */

function bindBgPicker(container) {
    const bgPick = container.querySelector('#field-bg-pick');
    const bgText = container.querySelector('[data-field="bg"]');
    if (!bgPick || !bgText) return;
    bgPick.addEventListener('input', () => { bgText.value = bgPick.value; editor.updateSlide(editor.selectedIndex, { bg: bgPick.value }); });
    bgText.addEventListener('input', () => { if (!bgText.value.trim()) editor.updateSlide(editor.selectedIndex, { bg: '' }); });
}

/* ── Convert template → canvas ─────────────────────────── */

async function convertTemplateToCanvas() {
    const slide = editor.currentSlide;
    if (!slide || slide.type === 'canvas') return;
    if (!await OEIDialog.confirm('Convertir ce slide en canvas ?\nLe contenu actuel sera transformé en éléments positionnables. Cette action est annulable via Ctrl+Z.')) return;
    const CW = 1280, CH = 720;
    const newSlide = { type: 'canvas', elements: [] };
    const add = (el) => {
        const def = CanvasEditor.defaultElement(el.type);
        newSlide.elements.push({
            ...def, ...el,
            data:  { ...(def.data  || {}), ...(el.data  || {}) },
            style: { ...(def.style || {}), ...(el.style || {}) },
        });
    };
    const colW = Math.round((CW - 192) / 2);
    const H2 = (text, y, h = 80) => ({ type: 'heading', x: 48, y, w: CW - 96, h,
        data: { text }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' }, z: 1 });

    switch (slide.type) {
        case 'title': {
            let y = 190;
            if (slide.eyebrow) {
                add({ type: 'text', x: 48, y: 88, w: CW - 96, h: 44, data: { text: slide.eyebrow },
                    style: { fontSize: 14, fontWeight: 600, color: 'var(--sl-primary)', textAlign: 'center', fontFamily: 'var(--sl-font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }, z: 1 });
                y = 155;
            }
            add({ type: 'heading', x: 48, y, w: CW - 96, h: 155, data: { text: slide.title || 'Titre' },
                style: { fontSize: 56, fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' }, z: 2 });
            if (slide.subtitle) add({ type: 'text', x: 48, y: y + 162, w: CW - 96, h: 60, data: { text: slide.subtitle },
                style: { fontSize: 22, color: 'var(--sl-muted)', textAlign: 'center' }, z: 3 });
            const footer = [slide.author, slide.date].filter(Boolean).join('  ·  ');
            if (footer) add({ type: 'text', x: 48, y: 638, w: CW - 96, h: 40, data: { text: footer },
                style: { fontSize: 14, color: 'var(--sl-muted)', textAlign: 'center' }, z: 4 });
            break;
        }
        case 'chapter': {
            let titleY = 250;
            // Use auto-number if available, falling back to manual number
            const chapterNumbers = editor.data?.autoNumberChapters ? SlidesRenderer._buildChapterNumbers(editor.data.slides, true) : null;
            const chapterNum = chapterNumbers?.get(editor.selectedIndex) || slide.number;
            if (chapterNum) {
                add({ type: 'heading', x: 48, y: 110, w: CW - 96, h: 148, data: { text: String(chapterNum) },
                    style: { fontSize: 96, fontWeight: 900, color: 'var(--sl-primary)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)', opacity: 0.25 }, z: 1 });
                titleY = 295;
            }
            add({ type: 'heading', x: 48, y: titleY, w: CW - 96, h: 110, data: { text: slide.title || 'Chapitre' },
                style: { fontSize: 48, fontWeight: 700, color: 'var(--sl-heading)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' }, z: 2 });
            if (slide.subtitle) add({ type: 'text', x: 48, y: titleY + 118, w: CW - 96, h: 56, data: { text: slide.subtitle },
                style: { fontSize: 18, color: 'var(--sl-muted)', textAlign: 'center' }, z: 3 });
            break;
        }
        case 'bullets': {
            const hasNote = !!slide.note;
            const listW = hasNote ? Math.round((CW - 96) * 0.63) : CW - 96;
            add({ type: 'heading', x: 48, y: 40, w: CW - 96, h: 76, data: { text: slide.title || '' },
                style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' }, z: 1 });
            add({ type: 'list', x: 48, y: 140, w: listW, h: CH - 172, data: { items: slide.items || [] },
                style: { fontSize: 18, color: 'var(--sl-text)' }, z: 2 });
            if (hasNote) {
                const noteX = 48 + listW + 24, noteW = CW - 96 - listW - 24;
                add({ type: 'text', x: noteX, y: 140, w: noteW, h: CH - 172, data: { text: 'Note\n' + slide.note },
                    style: { fontSize: 14, color: 'var(--sl-muted)' }, z: 3 });
            }
            break;
        }
        case 'code':
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            add({ type: 'code', x: 48, y: slide.title ? 136 : 40, w: CW - 96, h: CH - (slide.title ? 168 : 80),
                data: { language: slide.language || 'text', code: slide.code || '' }, z: 2 });
            break;
        case 'definition':
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            add({ type: 'definition', x: 48, y: slide.title ? 136 : 60, w: CW - 96, h: slide.title ? CH - 168 : CH - 92,
                data: { term: slide.term || '', definition: slide.definition || '', example: slide.example || '' }, z: 2 });
            break;
        case 'split': {
            const contentY = slide.title ? 136 : 40, contentH = CH - contentY - 40;
            const gap = 24, splitColW = Math.round((CW - 96 - gap) / 2);
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            let lY = contentY;
            if (slide.left?.label) {
                add({ type: 'text', x: 48, y: lY, w: splitColW, h: 32, data: { text: slide.left.label },
                    style: { fontSize: 11, fontWeight: 700, color: 'var(--sl-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }, z: 2 });
                lY += 36;
            }
            const lH = contentH - (lY - contentY);
            if (slide.left?.type === 'code') add({ type: 'code', x: 48, y: lY, w: splitColW, h: lH, data: { language: slide.left.language || 'text', code: slide.left.code || '' }, z: 2 });
            else if (slide.left?.type === 'bullets' || slide.left?.items) add({ type: 'list', x: 48, y: lY, w: splitColW, h: lH, data: { items: slide.left?.items || [] }, style: { fontSize: 18, color: 'var(--sl-text)' }, z: 2 });
            else add({ type: 'text', x: 48, y: lY, w: splitColW, h: lH, data: { text: slide.left?.text || '' }, style: { fontSize: 18, color: 'var(--sl-text)' }, z: 2 });
            const rX = 48 + splitColW + gap;
            let rY = contentY;
            if (slide.right?.label) {
                add({ type: 'text', x: rX, y: rY, w: splitColW, h: 32, data: { text: slide.right.label },
                    style: { fontSize: 11, fontWeight: 700, color: 'var(--sl-accent,#f472b6)', textTransform: 'uppercase', letterSpacing: '0.08em' }, z: 3 });
                rY += 36;
            }
            const rH = contentH - (rY - contentY);
            if (slide.right?.type === 'code') add({ type: 'code', x: rX, y: rY, w: splitColW, h: rH, data: { language: slide.right.language || 'text', code: slide.right.code || '' }, z: 3 });
            else if (slide.right?.type === 'bullets' || slide.right?.items) add({ type: 'list', x: rX, y: rY, w: splitColW, h: rH, data: { items: slide.right?.items || [] }, style: { fontSize: 18, color: 'var(--sl-text)' }, z: 3 });
            else add({ type: 'text', x: rX, y: rY, w: splitColW, h: rH, data: { text: slide.right?.text || '' }, style: { fontSize: 18, color: 'var(--sl-text)' }, z: 3 });
            break;
        }
        case 'comparison': {
            const contentY = slide.title ? 136 : 40, contentH = CH - contentY - 40;
            const gap = 16, cmpColW = Math.round((CW - 96 - gap) / 2);
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            add({ type: 'card', x: 48, y: contentY, w: cmpColW, h: contentH,
                data: { title: slide.left?.title || '', items: slide.left?.items || [] },
                style: { fontSize: 18, color: 'var(--sl-text)', titleColor: 'var(--sl-primary)' }, z: 2 });
            add({ type: 'card', x: 48 + cmpColW + gap, y: contentY, w: cmpColW, h: contentH,
                data: { title: slide.right?.title || '', items: slide.right?.items || [] },
                style: { fontSize: 18, color: 'var(--sl-text)', titleColor: 'var(--sl-accent,#f472b6)' }, z: 3 });
            break;
        }
        case 'simulation':
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            add({ type: 'widget', x: 48, y: slide.title ? 136 : 40, w: CW - 96, h: slide.title ? CH - 168 : CH - 72,
                data: { widget: slide.widget || 'workflow-trigger-simulator', config: slide.config || {} }, z: 2 });
            break;
        case 'image':
            if (slide.title) add({ ...H2(slide.title, 40), z: 1 });
            add({ type: 'image', x: 48, y: slide.title ? 128 : 40, w: CW - 96,
                h: CH - (slide.title ? 160 : 80) - (slide.caption ? 52 : 0),
                data: { src: slide.src || '', alt: slide.alt || slide.title || '' }, z: 2 });
            if (slide.caption) add({ type: 'text', x: 48, y: CH - 48, w: CW - 96, h: 40, data: { text: slide.caption },
                style: { fontSize: 13, color: 'var(--sl-muted)', textAlign: 'center', fontStyle: 'italic' }, z: 3 });
            break;
        case 'quote':
            add({ type: 'quote', x: 48, y: 100, w: CW - 96, h: 480,
                data: { text: slide.quote || '', author: slide.author || '' },
                style: { fontSize: 26, color: 'var(--sl-heading)' }, z: 1 });
            break;
        case 'blank':
            add({ type: 'text', x: 48, y: 40, w: CW - 96, h: CH - 80,
                data: { text: slide.html || '(contenu HTML libre)' },
                style: { fontSize: 16, color: 'var(--sl-muted)', textAlign: 'center' }, z: 1 });
            break;
        default:
            add({ type: 'heading', x: 48, y: 260, w: CW - 96, h: 120,
                data: { text: slide.title || `Slide ${slide.type}` },
                style: { fontSize: 42, fontWeight: 700, color: 'var(--sl-heading)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' }, z: 1 });
    }

    if (slide.notes) newSlide.notes = slide.notes;
    if (slide.bg)    newSlide.bg    = slide.bg;
    editor.replaceSlide(editor.selectedIndex, newSlide);
    notify('Slide converti en canvas', 'success');
}

/* ── Connector popover (new element-bound connectors) ──── */

function openConnectorPopover(conn, event) {
    const popover = document.getElementById('content-popover');
    if (!popover || !canvasEditor) return;
    closeContentPopover();
    popover.classList.add('visible');

    const lineTypes = [
        { id: 'straight', label: 'Droit' },
        { id: 'curve',    label: 'Courbe' },
        { id: 'elbow',    label: 'Coude' },
        { id: 'rounded',  label: 'Arrondi' }
    ];
    const ltOpts = lineTypes.map(lt => `<option value="${lt.id}"${conn.lineType===lt.id?' selected':''}>${lt.label}</option>`).join('');
    const anchors = ['top','right','bottom','left'];
    const srcOpts = anchors.map(a => `<option value="${a}"${conn.sourceAnchor===a?' selected':''}>${a}</option>`).join('');
    const tgtOpts = anchors.map(a => `<option value="${a}"${conn.targetAnchor===a?' selected':''}>${a}</option>`).join('');
    const strokeVal = (conn.style?.stroke || '#818cf8').replace(/var\(.*\)/, '#818cf8');

    popover.innerHTML = `
        <div class="content-popover-header">
            <span>↗ Connecteur — Propriétés</span>
            <button class="popover-close" id="popover-close-btn">✕</button>
        </div>
        <div class="field"><label>Type de ligne</label><select id="cp-lineType">${ltOpts}</select></div>
        <div class="field" style="display:flex;gap:1rem;">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="cp-arrowStart" ${conn.arrowStart?'checked':''}> Flèche début</label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="cp-arrowEnd" ${conn.arrowEnd?'checked':''}> Flèche fin</label>
        </div>
        <div class="field"><label>Ancrage source</label><select id="cp-srcAnchor">${srcOpts}</select></div>
        <div class="field"><label>Ancrage cible</label><select id="cp-tgtAnchor">${tgtOpts}</select></div>
        <div class="field"><label>Épaisseur</label><input type="range" id="cp-strokeWidth" min="1" max="12" value="${conn.style?.strokeWidth||3}"></div>
        <div class="field"><label>Couleur</label><input type="color" id="cp-stroke" value="${strokeVal}"></div>
        <div class="field"><label>Étiquette</label><input type="text" id="cp-label" value="${escAttr(conn.label||'')}" placeholder="Texte sur la flèche"></div>`;

    positionPopover(popover, event);
    document.getElementById('popover-close-btn').addEventListener('click', closeContentPopover);

    const id = conn.id;
    popover.querySelector('#cp-lineType')?.addEventListener('change', e => canvasEditor.updateConnector(id, { lineType: e.target.value }));
    popover.querySelector('#cp-arrowStart')?.addEventListener('change', e => canvasEditor.updateConnector(id, { arrowStart: e.target.checked }));
    popover.querySelector('#cp-arrowEnd')?.addEventListener('change', e => canvasEditor.updateConnector(id, { arrowEnd: e.target.checked }));
    popover.querySelector('#cp-srcAnchor')?.addEventListener('change', e => canvasEditor.updateConnector(id, { sourceAnchor: e.target.value }));
    popover.querySelector('#cp-tgtAnchor')?.addEventListener('change', e => canvasEditor.updateConnector(id, { targetAnchor: e.target.value }));
    popover.querySelector('#cp-strokeWidth')?.addEventListener('input', e => canvasEditor.updateConnector(id, { style: { strokeWidth: +e.target.value } }));
    popover.querySelector('#cp-stroke')?.addEventListener('input', e => canvasEditor.updateConnector(id, { style: { stroke: e.target.value } }));
    popover.querySelector('#cp-label')?.addEventListener('input', e => canvasEditor.updateConnector(id, { label: e.target.value }));

    setTimeout(() => popover.querySelector('#cp-label')?.focus(), 50);
}
