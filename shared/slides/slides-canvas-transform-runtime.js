// @ts-check
/* slides-canvas-transform-runtime.js — runtime transformations/interactions pour CanvasEditor */
(function initSlidesCanvasTransformRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasTransformRuntime) return;

    const findElementById = (elements, id) => {
        if (!Array.isArray(elements) || !id) return null;
        return elements.find(el => el && el.id === id) || null;
    };

    const handleMouseMove = (context, event) => {
        const editor = context?.editor;
        if (!editor || !event) return false;

        if (editor._marquee && editor._marquee.active) {
            const rect = editor.container.getBoundingClientRect();
            const cx = (event.clientX - rect.left) / editor.scale;
            const cy = (event.clientY - rect.top) / editor.scale;
            const { startX, startY } = editor._marquee;
            const x = Math.min(startX, cx);
            const y = Math.min(startY, cy);
            const w = Math.abs(cx - startX);
            const h = Math.abs(cy - startY);
            if (editor._marqueeDiv) {
                editor._marqueeDiv.style.display = 'block';
                editor._marqueeDiv.style.left = x + 'px';
                editor._marqueeDiv.style.top = y + 'px';
                editor._marqueeDiv.style.width = w + 'px';
                editor._marqueeDiv.style.height = h + 'px';
            }
            editor._marqueeRect = { x, y, w, h };
            return true;
        }

        if (editor._connCreation && editor._connectorMode) {
            const rect = editor.container.getBoundingClientRect();
            const mx = (event.clientX - rect.left) / editor.scale;
            const my = (event.clientY - rect.top) / editor.scale;
            editor._updateTempLine(mx, my);
            return true;
        }

        if (editor._drag) {
            const { id, startMX, startMY, origX, origY, dragOrigins } = editor._drag;
            const el = findElementById(editor.elements, id);
            if (!el) return true;
            const dx = (event.clientX - startMX) / editor.scale;
            const dy = (event.clientY - startMY) / editor.scale;
            let nx = Math.round(origX + dx);
            let ny = Math.round(origY + dy);

            const snap = context.computeSnap
                ? context.computeSnap({ id, x: nx, y: ny, w: el.w, h: el.h })
                : { x: nx, y: ny, guideXs: [], guideYs: [] };
            const x = snap.x;
            const y = snap.y;
            const guideXs = Array.isArray(snap.guideXs) ? snap.guideXs : [];
            const guideYs = Array.isArray(snap.guideYs) ? snap.guideYs : [];

            const snapDX = x - nx;
            const snapDY = y - ny;
            el.x = x;
            el.y = y;
            const div = editor._dom(id);
            if (div) {
                div.style.left = x + 'px';
                div.style.top = y + 'px';
            }

            if (dragOrigins) {
                for (const sid of editor.selectedIds || []) {
                    if (sid === id) continue;
                    const sel = findElementById(editor.elements, sid);
                    const orig = dragOrigins[sid];
                    if (!sel || !orig) continue;
                    sel.x = Math.round(orig.origX + dx + snapDX);
                    sel.y = Math.round(orig.origY + dy + snapDY);
                    const sdiv = editor._dom(sid);
                    if (sdiv) {
                        sdiv.style.left = sel.x + 'px';
                        sdiv.style.top = sel.y + 'px';
                    }
                }
            }
            editor._showGuides(guideXs, guideYs);
            if (editor.connectors?.length) editor._refreshConnectors();
        }

        if (editor._resize) {
            const { id, origEl, handle, startMX, startMY, aspectRatio, groupId, groupBBox, groupOrigRects } = editor._resize;
            const el = findElementById(editor.elements, id);
            if (!el) return true;
            // Élément groupé : on redimensionne la boîte englobante du groupe comme
            // référence (au lieu de l'élément cliqué seul), puis chaque membre est mis à
            // l'échelle proportionnellement — voir l'application du scale plus bas.
            const refOrig = groupBBox || origEl;
            const dx = (event.clientX - startMX) / editor.scale;
            const dy = (event.clientY - startMY) / editor.scale;
            let { x, y, w, h } = refOrig;
            const MIN_W = 40;
            const MIN_H = 24;

            if (handle.includes('e')) w = Math.max(MIN_W, refOrig.w + dx);
            if (handle.includes('w')) {
                const nw = Math.max(MIN_W, refOrig.w - dx);
                x = refOrig.x + (refOrig.w - nw);
                w = nw;
            }
            if (handle.includes('s')) h = Math.max(MIN_H, refOrig.h + dy);
            if (handle.includes('n')) {
                const nh = Math.max(MIN_H, refOrig.h - dy);
                y = refOrig.y + (refOrig.h - nh);
                h = nh;
            }

            if (event.ctrlKey && handle.length === 2 && aspectRatio) {
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                if (absDx / aspectRatio >= absDy) {
                    const newH = Math.max(MIN_H, w / aspectRatio);
                    if (handle.includes('n')) y = refOrig.y + refOrig.h - newH;
                    h = newH;
                } else {
                    const newW = Math.max(MIN_W, h * aspectRatio);
                    if (handle.includes('w')) x = refOrig.x + refOrig.w - newW;
                    w = newW;
                }
            }

            // Rect de travail : la boîte englobante du groupe en redimensionnement de
            // groupe, sinon l'élément lui-même — le snapping ci-dessous s'applique à
            // cette référence commune, jamais directement à `el` (qui ne serait que
            // l'élément cliqué, pas le groupe entier).
            const rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };

            const SNAP = 8;
            const guideXs = [];
            const guideYs = [];
            const others = editor.elements.filter(item => groupId ? item.groupId !== groupId : item.id !== id);
            const xCands = [0, 640, 1280];
            const yCands = [0, 360, 720];
            if (editor._gridSize > 0) {
                const g = editor._gridSize;
                for (let gx = g; gx < 1280; gx += g) xCands.push(gx);
                for (let gy = g; gy < 720; gy += g) yCands.push(gy);
            }
            for (const other of others) {
                xCands.push(other.x, other.x + other.w / 2, other.x + other.w);
                yCands.push(other.y, other.y + other.h / 2, other.y + other.h);
            }

            if (handle.includes('e')) {
                const right = rect.x + rect.w;
                for (const cx of xCands) {
                    if (Math.abs(right - cx) < SNAP) {
                        rect.w = cx - rect.x;
                        guideXs.push(cx);
                        break;
                    }
                }
            }
            if (handle.includes('w')) {
                for (const cx of xCands) {
                    if (Math.abs(rect.x - cx) < SNAP) {
                        rect.w += rect.x - cx;
                        rect.x = cx;
                        guideXs.push(cx);
                        break;
                    }
                }
            }
            if (handle.includes('s')) {
                const bottom = rect.y + rect.h;
                for (const cy of yCands) {
                    if (Math.abs(bottom - cy) < SNAP) {
                        rect.h = cy - rect.y;
                        guideYs.push(cy);
                        break;
                    }
                }
            }
            if (handle.includes('n')) {
                for (const cy of yCands) {
                    if (Math.abs(rect.y - cy) < SNAP) {
                        rect.h += rect.y - cy;
                        rect.y = cy;
                        guideYs.push(cy);
                        break;
                    }
                }
            }

            if (guideXs.length === 0 && (handle.includes('e') || handle.includes('w'))) {
                const lm = rect.x;
                const rm = 1280 - rect.x - rect.w;
                if (Math.abs(lm - rm) < SNAP) {
                    if (handle.includes('e')) rect.w = 1280 - 2 * rect.x;
                    else rect.x = Math.round((1280 - rect.w) / 2);
                    guideXs.push(640);
                }
            }
            if (guideYs.length === 0 && (handle.includes('n') || handle.includes('s'))) {
                const tm = rect.y;
                const bm = 720 - rect.y - rect.h;
                if (Math.abs(tm - bm) < SNAP) {
                    if (handle.includes('s')) rect.h = 720 - 2 * rect.y;
                    else rect.y = Math.round((720 - rect.h) / 2);
                    guideYs.push(360);
                }
            }
            editor._showGuides(guideXs, guideYs);

            if (groupBBox && groupOrigRects) {
                // Redimensionnement de groupe : chaque membre est mis à l'échelle
                // proportionnellement à la transformation de la boîte englobante,
                // pour préserver la mise en page relative du groupe.
                const scaleX = groupBBox.w > 0 ? rect.w / groupBBox.w : 1;
                const scaleY = groupBBox.h > 0 ? rect.h / groupBBox.h : 1;
                for (const orig of groupOrigRects) {
                    const member = findElementById(editor.elements, orig.id);
                    if (!member) continue;
                    member.x = Math.round(rect.x + (orig.x - groupBBox.x) * scaleX);
                    member.y = Math.round(rect.y + (orig.y - groupBBox.y) * scaleY);
                    member.w = Math.round(orig.w * scaleX);
                    member.h = Math.round(orig.h * scaleY);
                    const memberDiv = editor._dom(orig.id);
                    if (memberDiv) {
                        memberDiv.style.left = member.x + 'px';
                        memberDiv.style.top = member.y + 'px';
                        memberDiv.style.width = member.w + 'px';
                        memberDiv.style.height = member.h + 'px';
                    }
                    if (editor.onPositionChange) editor.onPositionChange(member);
                }
            } else {
                el.x = rect.x;
                el.y = rect.y;
                el.w = rect.w;
                el.h = rect.h;
                const div = editor._dom(id);
                if (div) {
                    div.style.left = el.x + 'px';
                    div.style.top = el.y + 'px';
                    div.style.width = el.w + 'px';
                    div.style.height = el.h + 'px';
                }
                if (editor.onPositionChange) editor.onPositionChange(el);
            }
            if (editor.connectors?.length) editor._refreshConnectors();
        }

        return true;
    };

    const handleMouseUp = context => {
        const editor = context?.editor;
        if (!editor) return false;

        if (editor._marquee && editor._marquee.active) {
            if (editor._marqueeDiv) editor._marqueeDiv.style.display = 'none';
            if (editor._marqueeRect) {
                const { x, y, w, h } = editor._marqueeRect;
                if (w > 4 || h > 4) {
                    if (!editor._marquee.shift) {
                        editor.selectedIds.clear();
                        editor.selectedId = null;
                    }
                    for (const el of editor.elements) {
                        const ex2 = el.x + el.w;
                        const ey2 = el.y + el.h;
                        if (el.x < x + w && ex2 > x && el.y < y + h && ey2 > y) {
                            editor.selectedIds.add(el.id);
                            if (!editor.selectedId) editor.selectedId = el.id;
                        }
                    }
                    editor._updateSelectionVisuals();
                    const selected = editor.selectedId ? findElementById(editor.elements, editor.selectedId) : null;
                    editor.onSelect(selected || null);
                }
            }
            editor._marquee = null;
            editor._marqueeRect = null;
            return true;
        }

        if (editor._drag || editor._resize) {
            editor._clearGuides();
            const id = (editor._drag || editor._resize).id;
            editor._drag = null;
            editor._resize = null;
            const el = findElementById(editor.elements, id);
            if (el && editor.onPositionChange) editor.onPositionChange(el);
            editor.onChange(editor.serialize());
            return true;
        }

        return false;
    };

    const nudge = (context, dx, dy) => {
        const editor = context?.editor;
        if (!editor) return false;

        const ids = editor.selectedIds?.size > 0
            ? [...editor.selectedIds]
            : (editor.selectedId ? [editor.selectedId] : []);
        if (!ids.length) return false;

        let moved = false;
        for (const id of ids) {
            const el = findElementById(editor.elements, id);
            if (!el || editor._isElementLocked(el)) continue;
            el.x = Math.round(el.x + dx);
            el.y = Math.round(el.y + dy);
            const div = editor._dom(id);
            if (div) {
                div.style.left = el.x + 'px';
                div.style.top = el.y + 'px';
            }
            moved = true;
        }
        if (!moved) return false;

        if (editor.onPositionChange) {
            editor.onPositionChange(findElementById(editor.elements, editor.selectedId));
        }
        editor.onChange(editor.serialize());
        return true;
    };

    const alignElements = (context, direction) => {
        const editor = context?.editor;
        const alignRects = context?.alignElementsRects;
        if (!editor || typeof alignRects !== 'function') return false;

        const els = editor.getSelectedElements().filter(el => !editor._isElementLocked(el));
        if (els.length < 2) return false;

        const aligned = alignRects(els, direction);
        const byId = new Map(aligned.map(el => [el.id, el]));
        els.forEach(el => {
            const next = byId.get(el.id);
            if (!next) return;
            el.x = next.x;
            el.y = next.y;
        });
        els.forEach(el => editor._refreshDOM(el.id));
        editor.onChange(editor.serialize());
        return true;
    };

    const distributeElements = (context, axis) => {
        const editor = context?.editor;
        const distributeRects = context?.distributeElementsRects;
        if (!editor || typeof distributeRects !== 'function') return false;

        const els = editor.getSelectedElements().filter(el => !editor._isElementLocked(el));
        if (els.length < 3) return false;

        const distributed = distributeRects(els, axis);
        const byId = new Map(distributed.map(el => [el.id, el]));
        els.forEach(el => {
            const next = byId.get(el.id);
            if (!next) return;
            el.x = next.x;
            el.y = next.y;
        });
        els.forEach(el => editor._refreshDOM(el.id));
        editor.onChange(editor.serialize());
        return true;
    };

    const autoLayoutSelected = (context, options = {}) => {
        const editor = context?.editor;
        const computeAutoLayoutRects = context?.computeAutoLayoutRects;
        if (!editor || typeof computeAutoLayoutRects !== 'function') return { moved: false, count: 0 };

        const els = editor.getSelectedElements().filter(el => !editor._isElementLocked(el));
        if (els.length < 2) return { moved: false, count: els.length };

        const layout = computeAutoLayoutRects(els, options, { canvasWidth: 1280, canvasHeight: 720 });
        if (!layout.moved) return { moved: false, count: layout.count };

        const byId = new Map((Array.isArray(layout.rects) ? layout.rects : []).map(el => [el.id, el]));
        els.forEach(el => {
            const next = byId.get(el.id);
            if (!next) return;
            el.x = next.x;
            el.y = next.y;
            el.w = next.w;
            el.h = next.h;
            editor._refreshDOM(el.id);
        });

        if (editor.connectors?.length) editor._refreshConnectors();
        if (editor.onPositionChange) {
            editor.onPositionChange(findElementById(editor.elements, editor.selectedId) || null);
        }
        editor.onChange(editor.serialize());
        return { moved: true, count: layout.count, cols: layout.cols, rows: layout.rows };
    };

    const removeSelected = context => {
        const editor = context?.editor;
        if (!editor) return false;

        if (editor._selectedConnectorId) {
            editor.removeConnector(editor._selectedConnectorId);
            return true;
        }

        const ids = [...(editor.selectedIds || [])];
        if (!ids.length) return false;

        let removed = false;
        ids.forEach(id => {
            const el = findElementById(editor.elements, id);
            if (!el || editor._isElementLocked(el)) return;
            const dom = editor._dom(id);
            if (dom) dom.remove();
            editor.elements = editor.elements.filter(item => item.id !== id);
            editor.connectors = editor.connectors.filter(conn => conn.sourceId !== id && conn.targetId !== id);
            removed = true;
        });

        if (!removed) return false;
        editor.selectedIds.clear();
        editor.selectedId = null;
        editor.onSelect(null);
        editor._refreshConnectors();
        editor.onChange(editor.serialize());
        return true;
    };

    root.OEISlidesCanvasTransformRuntime = Object.freeze({
        handleMouseMove,
        handleMouseUp,
        nudge,
        alignElements,
        distributeElements,
        autoLayoutSelected,
        removeSelected,
        testUtils: Object.freeze({
            findElementById,
            handleMouseMove,
            handleMouseUp,
            nudge,
            alignElements,
            distributeElements,
            autoLayoutSelected,
            removeSelected,
        }),
    });
})(window);
