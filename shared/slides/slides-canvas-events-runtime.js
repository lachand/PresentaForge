// @ts-check
/* slides-canvas-events-runtime.js — runtime bindings événements éléments pour CanvasEditor */
(function initSlidesCanvasEventsRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasEventsRuntime) return;

    const findElementById = (elements, id) => {
        if (!Array.isArray(elements) || !id) return null;
        return elements.find(el => el && el.id === id) || null;
    };

    const bindElementEvents = context => {
        const div = context?.div;
        const id = context?.id;
        const editor = context?.editor;
        if (!div || !id || !editor || typeof div.addEventListener !== 'function') return false;

        div.addEventListener('mousedown', event => {
            if (div.classList?.contains?.('editing')) return;

            const el = findElementById(editor.elements, id);
            if (!el) return;

            const targetClassList = event.target?.classList;
            if (targetClassList?.contains?.('cel-handle')) {
                event.stopPropagation?.();
                if (el.locked) return;
                editor._resize = {
                    id,
                    origEl: { ...el },
                    handle: event.target.dataset?.handle,
                    startMX: event.clientX,
                    startMY: event.clientY,
                    aspectRatio: el.w / el.h,
                };
                event.preventDefault?.();
                return;
            }

            if (targetClassList?.contains?.('cel-anchor') && editor._connectorMode) {
                event.stopPropagation?.();
                event.preventDefault?.();
                const anchor = event.target.dataset?.anchor;
                if (!editor._connCreation) {
                    editor._connCreation = { sourceId: id, sourceAnchor: anchor };
                    event.target.classList?.add?.('anchor-active');
                    editor.container?.classList?.add?.('conn-creating');
                } else {
                    if (editor._connCreation.sourceId !== id || editor._connCreation.sourceAnchor !== anchor) {
                        editor.addConnector({
                            sourceId: editor._connCreation.sourceId,
                            sourceAnchor: editor._connCreation.sourceAnchor,
                            targetId: id,
                            targetAnchor: anchor,
                        });
                    }
                    editor._connCreation = null;
                    editor.container?.classList?.remove?.('conn-creating');
                    editor.container?.querySelectorAll?.('.anchor-active')?.forEach?.(node => node.classList?.remove?.('anchor-active'));
                    const tempLine = editor._connOverlay?.querySelector?.('.conn-temp');
                    if (tempLine?.style) tempLine.style.display = 'none';
                }
                return;
            }

            event.stopPropagation?.();
            if (context.tryHandlePipetteClick?.(id)) return;

            if (event.ctrlKey || event.metaKey) {
                editor.toggleSelect(id);
            } else if (!editor.selectedIds?.has?.(id)) {
                editor.select(id);
            } else {
                editor.selectedId = id;
                editor.onSelect?.(findElementById(editor.elements, id));
            }

            if (el.locked) return;
            const dragOrigins = {};
            for (const sid of editor.selectedIds || []) {
                const selectedEl = findElementById(editor.elements, sid);
                if (selectedEl) dragOrigins[sid] = { origX: selectedEl.x, origY: selectedEl.y };
            }
            editor._drag = {
                id,
                startMX: event.clientX,
                startMY: event.clientY,
                origX: el.x,
                origY: el.y,
                dragOrigins,
            };
            event.preventDefault?.();
        });

        div.addEventListener('contextmenu', event => {
            event.preventDefault?.();
            event.stopPropagation?.();
            if (!editor.selectedIds?.has?.(id)) editor.select(id);
            editor.onContextMenu?.(id, event);
        });

        div.addEventListener('dblclick', event => {
            event.stopPropagation?.();
            const el = findElementById(editor.elements, id);
            if (!el) return;
            if (editor._isElementLocked(el)) return;
            if (['heading', 'text'].includes(el.type)) editor._startInlineEdit(div, el, event);
            else if (el.type === 'code') editor._startInlineEditCode(div, el);
            else if (el.type === 'definition') editor._startInlineEditDefinition(div, el);
            else if (el.type === 'code-example') editor._startInlineEditCodeExample(div, el);
            else if (el.type === 'list') editor._startInlineEditList(div, el);
            else if (el.type === 'table') editor._startInlineEditTable(div, el);
            else editor.onDblClick?.(el, event);
        });

        return true;
    };

    root.OEISlidesCanvasEventsRuntime = Object.freeze({
        bindElementEvents,
        testUtils: Object.freeze({
            findElementById,
            bindElementEvents,
        }),
    });
})(window);
