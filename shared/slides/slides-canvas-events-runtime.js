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

            // Contrôle natif toujours interactif (ex. textarea code-live, sans bascule
            // .editing) : laisser le navigateur placer le curseur, ne pas armer de drag —
            // mais la sélection doit quand même se mettre à jour (panneau de propriétés,
            // barre de format), sinon cliquer dedans ne sélectionne jamais l'élément.
            const isNativeEditableTarget = !!event.target?.closest?.('textarea, input, select, [contenteditable="true"]');

            const targetClassList = event.target?.classList;
            if (targetClassList?.contains?.('cel-handle')) {
                event.stopPropagation?.();
                if (el.locked) return;
                // Élément groupé : redimensionner l'élément seul déformerait la mise en
                // page relative du groupe (chaque membre garde ses propres poignées,
                // cf. .cel.selected .cel-handle). On redimensionne donc le groupe entier
                // comme un bloc, à l'échelle, autour de sa boîte englobante.
                const groupMembers = el.groupId
                    ? editor.elements.filter(e => e.groupId === el.groupId)
                    : null;
                let groupBBox = null;
                let groupOrigRects = null;
                if (groupMembers && groupMembers.length > 1) {
                    const minX = Math.min(...groupMembers.map(e => e.x));
                    const minY = Math.min(...groupMembers.map(e => e.y));
                    const maxX = Math.max(...groupMembers.map(e => e.x + e.w));
                    const maxY = Math.max(...groupMembers.map(e => e.y + e.h));
                    groupBBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                    groupOrigRects = groupMembers.map(e => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h }));
                }
                const refRect = groupBBox || el;
                editor._resize = {
                    id,
                    origEl: { ...el },
                    handle: event.target.dataset?.handle,
                    startMX: event.clientX,
                    startMY: event.clientY,
                    aspectRatio: refRect.w / refRect.h,
                    groupId: groupBBox ? el.groupId : null,
                    groupBBox,
                    groupOrigRects,
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

            if (!isNativeEditableTarget) event.stopPropagation?.();
            if (context.tryHandlePipetteClick?.(id)) return;

            if (event.ctrlKey || event.metaKey) {
                editor.toggleSelect(id);
            } else if (!editor.selectedIds?.has?.(id)) {
                editor.select(id);
            } else {
                editor.selectedId = id;
                editor.onSelect?.(findElementById(editor.elements, id));
            }

            if (isNativeEditableTarget) return;
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
            // Le panneau de propriétés doit rester visible pendant l'édition inline
            // (ex. langage du code, zones surlignées) — même pour les types édités
            // directement sur le canvas, pas seulement ceux qui ouvrent le popover.
            editor.onElementDblClick?.(el, event);
            if (['heading', 'text'].includes(el.type)) editor._startInlineEdit(div, el, event);
            else if (el.type === 'code') editor._startInlineEditCode(div, el);
            else if (el.type === 'highlight') editor._startInlineEditHighlight(div, el);
            else if (el.type === 'definition') editor._startInlineEditDefinition(div, el);
            else if (el.type === 'code-example') editor._startInlineEditCodeExample(div, el);
            else if (el.type === 'list') editor._startInlineEditList(div, el);
            else if (el.type === 'table') editor._startInlineEditTable(div, el);
            else if (el.type === 'quote') editor._startInlineEditQuote(div, el);
            else if (el.type === 'callout-box') editor._startInlineEditCalloutBox(div, el);
            else if (el.type === 'terminal-session') editor._startInlineEditTerminalSession(div, el);
            else if (el.type === 'latex') editor._startInlineEditLatex(div, el);
            else if (el.type === 'card') editor._startInlineEditCard(div, el);
            else if (el.type === 'smartart') editor._startInlineEditSmartArt(div, el);
            else if (['poll-likert', 'debate-mode', 'postit-wall'].includes(el.type)) editor._startInlineEditPromptField(div, el);
            else if (el.type === 'audience-roulette') editor._startInlineEditAudienceRoulette(div, el);
            else if (el.type === 'mermaid') editor._startInlineEditMermaid(div, el);
            else if (el.type === 'drawio') editor._openDiagramEditor(div, el);
            else if (el.type === 'timer') editor._startInlineEditTimerLabel(div, el);
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
