// @ts-check
/* slides-canvas-connectors-runtime.js — runtime connecteurs SVG pour CanvasEditor */
(function initSlidesCanvasConnectorsRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasConnectorsRuntime) return;

    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const resolveElement = (elements, id) => {
        if (!Array.isArray(elements) || !id) return null;
        return elements.find(el => el && el.id === id) || null;
    };

    // A connector goes "behind" when at least one anchor is 'center' (or conn.behind === true)
    const _isBehindConnector = conn =>
        conn.behind === true ||
        conn.sourceAnchor === 'center' ||
        conn.targetAnchor === 'center';

    const _renderConnectorGroup = (conn, context, { pathsG, defs }) => {
        const pathD = context.getConnectorPathData(conn);
        if (!pathD) return false;

        const documentRef = context.documentRef || root.document;
        const elements = Array.isArray(context.elements) ? context.elements : [];
        const selectedConnectorId = context.selectedConnectorId || null;
        const getAnchorPos = context.getAnchorPos;
        const esc = context.escapeHtml;

        const style = conn.style || {};
        const stroke = style.stroke || '#818cf8';
        const strokeWidth = style.strokeWidth || 3;
        const opacity = style.opacity != null ? style.opacity : 1;
        const isSelected = conn.id === selectedConnectorId;

        const markerEndId = 'cme-' + conn.id;
        const markerStartId = 'cms-' + conn.id;
        if (conn.arrowEnd) {
            defs.innerHTML += `<marker id="${markerEndId}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="${stroke}"/></marker>`;
        }
        if (conn.arrowStart) {
            defs.innerHTML += `<marker id="${markerStartId}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="10 0,0 3.5,10 7" fill="${stroke}"/></marker>`;
        }
        const markerEnd = conn.arrowEnd ? `marker-end="url(#${markerEndId})"` : '';
        const markerStart = conn.arrowStart ? `marker-start="url(#${markerStartId})"` : '';

        const group = documentRef.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'conn-g' + (isSelected ? ' conn-selected' : ''));
        group.dataset.connId = conn.id;
        group.innerHTML = `<path class="conn-hit" d="${pathD}"/>`;
        group.innerHTML += `<path class="conn-line-bg" d="${pathD}" fill="none" stroke="transparent" stroke-width="8"/>`;
        const dashAttr = style.dashArray ? `stroke-dasharray="${style.dashArray}"` : '';
        group.innerHTML += `<path class="conn-line" d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" ${dashAttr} ${markerEnd} ${markerStart}/>`;

        const source = resolveElement(elements, conn.sourceId);
        const target = resolveElement(elements, conn.targetId);

        if (conn.label && source && target) {
            const p1 = getAnchorPos(source, conn.sourceAnchor);
            const p2 = getAnchorPos(target, conn.targetAnchor);
            const lx = (p1.x + p2.x) / 2;
            const ly = (p1.y + p2.y) / 2;
            const label = String(conn.label);
            group.innerHTML += `<rect x="${lx - label.length * 4 - 4}" y="${ly - 11}" width="${label.length * 8 + 8}" height="22" rx="4" fill="var(--sl-slide-bg, #1a1d27)" opacity="0.85"/>`;
            group.innerHTML += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="13" font-family="var(--sl-font-body, system-ui)" style="pointer-events:none;">${esc(label)}</text>`;
        }

        if (isSelected && source && target) {
            const p1 = getAnchorPos(source, conn.sourceAnchor);
            const p2 = getAnchorPos(target, conn.targetAnchor);

            // Extrémités : glissables pour réattacher le connecteur à une autre ancre/
            // élément (voir handleConnectorHandleMouseDown / le mode "reattach" du drag).
            group.innerHTML += `<circle class="conn-handle conn-handle-endpoint" data-handle-role="endpoint" data-handle-end="source" cx="${Number(p1.x)}" cy="${Number(p1.y)}" r="6" fill="${esc(stroke)}" stroke="#fff" stroke-width="1.5" style="cursor:move;"/>`;
            group.innerHTML += `<circle class="conn-handle conn-handle-endpoint" data-handle-role="endpoint" data-handle-end="target" cx="${Number(p2.x)}" cy="${Number(p2.y)}" r="6" fill="${esc(stroke)}" stroke="#fff" stroke-width="1.5" style="cursor:move;"/>`;

            const lineType = String(conn.lineType || 'straight');
            if (lineType === 'elbow' || lineType === 'rounded') {
                const getEffectiveElbowPoints = context.getEffectiveElbowPoints;
                const pts = typeof getEffectiveElbowPoints === 'function' ? getEffectiveElbowPoints(conn, p1, p2) : [p1, p2];
                const midPts = pts.slice(1, -1);
                midPts.forEach((pt, i) => {
                    group.innerHTML += `<circle class="conn-handle conn-handle-waypoint" data-handle-role="waypoint" data-handle-index="${Number(i)}" cx="${Number(pt.x)}" cy="${Number(pt.y)}" r="5" fill="#fff" stroke="${esc(stroke)}" stroke-width="2" style="cursor:move;"/>`;
                });
            } else if (lineType === 'curve') {
                const getCurveControl = context.getCurveControl;
                const cp = typeof getCurveControl === 'function' ? getCurveControl(conn, p1, p2) : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                group.innerHTML += `<line x1="${Number(p1.x)}" y1="${Number(p1.y)}" x2="${Number(cp.x)}" y2="${Number(cp.y)}" stroke="${esc(stroke)}" stroke-width="1" stroke-dasharray="3 3" opacity="0.5" style="pointer-events:none;"/>`;
                group.innerHTML += `<line x1="${Number(cp.x)}" y1="${Number(cp.y)}" x2="${Number(p2.x)}" y2="${Number(p2.y)}" stroke="${esc(stroke)}" stroke-width="1" stroke-dasharray="3 3" opacity="0.5" style="pointer-events:none;"/>`;
                group.innerHTML += `<circle class="conn-handle conn-handle-curve" data-handle-role="curve-control" cx="${Number(cp.x)}" cy="${Number(cp.y)}" r="5" fill="#fff" stroke="${esc(stroke)}" stroke-width="2" style="cursor:move;"/>`;
            }
        }

        pathsG.appendChild(group);
        return true;
    };

    const refreshConnectors = context => {
        const connOverlay = context?.connOverlay;
        const connBackOverlay = context?.connBackOverlay || null;
        if (!connOverlay) return 0;
        const pathsG = connOverlay.querySelector?.('.conn-paths');
        const defs = connOverlay.querySelector?.('defs');
        if (!pathsG || !defs) return 0;

        const documentRef = context.documentRef || root.document;
        if (!documentRef?.createElementNS) return 0;

        const connectors = Array.isArray(context.connectors) ? context.connectors : [];
        const esc = typeof context.escapeHtml === 'function' ? context.escapeHtml : escapeHtml;
        const renderCtx = {
            ...context,
            getConnectorPathData: typeof context.getConnectorPathData === 'function' ? context.getConnectorPathData : () => null,
            getAnchorPos: typeof context.getAnchorPos === 'function' ? context.getAnchorPos : () => ({ x: 0, y: 0 }),
            escapeHtml: esc,
        };

        pathsG.innerHTML = '';
        defs.innerHTML = '';

        // Also clear the back overlay if present
        const backPathsG = connBackOverlay?.querySelector?.('.conn-paths');
        const backDefs = connBackOverlay?.querySelector?.('defs');
        if (backPathsG) backPathsG.innerHTML = '';
        if (backDefs) backDefs.innerHTML = '';

        let rendered = 0;
        for (const conn of connectors) {
            const isBehind = _isBehindConnector(conn);
            const targetPathsG = isBehind && backPathsG ? backPathsG : pathsG;
            const targetDefs = isBehind && backDefs ? backDefs : defs;
            if (_renderConnectorGroup(conn, renderCtx, { pathsG: targetPathsG, defs: targetDefs })) rendered += 1;
        }

        return rendered;
    };

    const updateTempLine = context => {
        const connOverlay = context?.connOverlay;
        if (!connOverlay) return false;
        const line = connOverlay.querySelector?.('.conn-temp');
        if (!line) return false;

        const connCreation = context?.connCreation;
        if (!connCreation) {
            if (line.style) line.style.display = 'none';
            return false;
        }

        const getAnchorPos = typeof context.getAnchorPos === 'function'
            ? context.getAnchorPos
            : () => ({ x: 0, y: 0 });
        const source = resolveElement(context.elements, connCreation.sourceId);
        if (!source) {
            if (line.style) line.style.display = 'none';
            return false;
        }

        const point = getAnchorPos(source, connCreation.sourceAnchor);
        line.setAttribute?.('x1', point.x);
        line.setAttribute?.('y1', point.y);
        line.setAttribute?.('x2', context.mx);
        line.setAttribute?.('y2', context.my);
        if (line.style) line.style.display = '';
        return true;
    };

    const enterConnectorMode = context => {
        const state = context?.state;
        if (!state) return false;
        state._connectorMode = true;
        state._connCreation = null;
        state.container?.classList?.add?.('canvas-connector-mode');
        context.deselectElements?.();
        return true;
    };

    const exitConnectorMode = context => {
        const state = context?.state;
        if (!state) return false;
        state._connectorMode = false;
        state._connCreation = null;
        state.container?.classList?.remove?.('canvas-connector-mode', 'conn-creating');
        state.container?.querySelectorAll?.('.anchor-active')?.forEach?.(node => node.classList?.remove?.('anchor-active'));
        const line = state._connOverlay?.querySelector?.('.conn-temp');
        if (line?.style) line.style.display = 'none';
        return true;
    };

    const toggleConnectorMode = context => {
        const state = context?.state;
        if (!state) return false;
        if (state._connectorMode) return exitConnectorMode(context);
        return enterConnectorMode(context);
    };

    const addConnector = (context, connData = {}) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors)) return null;
        const conn = {
            id: 'conn_' + Math.random().toString(36).slice(2, 9),
            sourceId: connData.sourceId,
            sourceAnchor: connData.sourceAnchor || 'right',
            targetId: connData.targetId,
            targetAnchor: connData.targetAnchor || 'left',
            lineType: connData.lineType || 'straight',
            arrowEnd: connData.arrowEnd !== false,
            arrowStart: connData.arrowStart || false,
            label: connData.label || '',
            style: connData.style || { stroke: '#818cf8', strokeWidth: 3, opacity: 1 },
        };
        state.connectors.push(conn);
        context.refreshConnectors?.();
        context.selectConnector?.(conn.id);
        context.notifyChange?.();
        return conn;
    };

    const removeConnector = (context, id) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors)) return false;
        const before = state.connectors.length;
        state.connectors = state.connectors.filter(conn => conn.id !== id);
        const removed = state.connectors.length !== before;
        if (!removed) return false;
        if (state._selectedConnectorId === id) state._selectedConnectorId = null;
        context.refreshConnectors?.();
        context.notifyChange?.();
        return true;
    };

    const updateConnector = (context, id, patch = {}) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors)) return false;
        const conn = state.connectors.find(item => item.id === id);
        if (!conn) return false;
        if (patch.lineType !== undefined) conn.lineType = patch.lineType;
        if (patch.arrowEnd !== undefined) conn.arrowEnd = patch.arrowEnd;
        if (patch.arrowStart !== undefined) conn.arrowStart = patch.arrowStart;
        if (patch.label !== undefined) conn.label = patch.label;
        if (patch.sourceAnchor !== undefined) conn.sourceAnchor = patch.sourceAnchor;
        if (patch.targetAnchor !== undefined) conn.targetAnchor = patch.targetAnchor;
        if (patch.sourceId !== undefined) conn.sourceId = patch.sourceId;
        if (patch.targetId !== undefined) conn.targetId = patch.targetId;
        if (patch.waypoints !== undefined) conn.waypoints = patch.waypoints;
        if (patch.curveControl !== undefined) conn.curveControl = patch.curveControl;
        if (patch.style) Object.assign(conn.style || (conn.style = {}), patch.style);
        context.refreshConnectors?.();
        context.notifyChange?.();
        return true;
    };

    /**
     * Insère un nouveau point d'angle sur le segment le plus proche de `point`
     * (types elbow/rounded uniquement) — déclenché par un clic sur le tracé d'un
     * connecteur déjà sélectionné (voir CanvasEditor._onConnectorMouseDown).
     * @param {object} context - { state, getAnchorPos, getEffectiveElbowPoints,
     *   distanceToSegment, refreshConnectors, notifyChange }
     * @param {string} id
     * @param {{x:number,y:number}} point - coordonnées canvas (pas écran)
     */
    const insertWaypointAtPoint = (context, id, point) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors)) return false;
        const conn = state.connectors.find(c => c.id === id);
        if (!conn) return false;
        const lineType = String(conn.lineType || 'straight');
        if (lineType !== 'elbow' && lineType !== 'rounded') return false;
        const source = resolveElement(state.elements, conn.sourceId);
        const target = resolveElement(state.elements, conn.targetId);
        if (!source || !target) return false;
        const getAnchorPos = context.getAnchorPos;
        const getEffectiveElbowPoints = context.getEffectiveElbowPoints;
        const distanceToSegment = context.distanceToSegment;
        if (typeof getAnchorPos !== 'function' || typeof getEffectiveElbowPoints !== 'function' || typeof distanceToSegment !== 'function') return false;

        const p1 = getAnchorPos(source, conn.sourceAnchor);
        const p2 = getAnchorPos(target, conn.targetAnchor);
        const pts = getEffectiveElbowPoints(conn, p1, p2); // [p1, ...mid, p2]

        let bestSeg = 0, bestDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distanceToSegment(point, pts[i], pts[i + 1]);
            if (d < bestDist) { bestDist = d; bestSeg = i; }
        }
        const newWaypoints = pts.slice(1, -1).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
        newWaypoints.splice(bestSeg, 0, { x: Math.round(point.x), y: Math.round(point.y) });
        conn.waypoints = newWaypoints;
        context.refreshConnectors?.();
        context.notifyChange?.();
        return true;
    };

    /**
     * Arme le glissement d'une poignée de connecteur (extrémité/point d'angle/
     * contrôle de courbe). Pour une poignée de type "waypoint" sans `conn.waypoints`
     * encore explicite (points auto-calculés), les fige d'abord dans `conn.waypoints`
     * pour que le point glissé garde son index et que les autres ne sautent pas.
     * @returns {object|null} l'état de drag armé (à stocker sur editor._connHandleDrag)
     */
    const startHandleDrag = (context, id, handle) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors) || !handle?.role) return null;
        const conn = state.connectors.find(c => c.id === id);
        if (!conn) return null;

        if (handle.role === 'waypoint' && (!Array.isArray(conn.waypoints) || !conn.waypoints.length)) {
            const source = resolveElement(state.elements, conn.sourceId);
            const target = resolveElement(state.elements, conn.targetId);
            const getAnchorPos = context.getAnchorPos;
            const getEffectiveElbowPoints = context.getEffectiveElbowPoints;
            if (source && target && typeof getAnchorPos === 'function' && typeof getEffectiveElbowPoints === 'function') {
                const p1 = getAnchorPos(source, conn.sourceAnchor);
                const p2 = getAnchorPos(target, conn.targetAnchor);
                const pts = getEffectiveElbowPoints(conn, p1, p2);
                conn.waypoints = pts.slice(1, -1).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
            }
        }

        // Point de départ du point d'angle glissé — sert de référence à l'alignement
        // horizontal/vertical (Maj enfoncée, cf. updateHandleDrag).
        let startPoint = null;
        if (handle.role === 'waypoint' && handle.index != null && Array.isArray(conn.waypoints)) {
            const p = conn.waypoints[handle.index];
            if (p) startPoint = { x: p.x, y: p.y };
        }

        // Extrémité FIXE (celle qui n'est pas glissée) — sert d'ancrage à la ligne de
        // prévisualisation pointillée pendant le drag d'une extrémité (cf. updateHandleDrag
        // + CanvasEditor._onMouseMove, qui réutilise updateTempLine comme pour la création).
        let fixedElId = null, fixedAnchor = null;
        if (handle.role === 'endpoint') {
            fixedElId = handle.end === 'source' ? conn.targetId : conn.sourceId;
            fixedAnchor = handle.end === 'source' ? conn.targetAnchor : conn.sourceAnchor;
        }

        return {
            connId: id,
            role: handle.role,
            end: handle.end || null,
            index: handle.index,
            startPoint,
            fixedElId,
            fixedAnchor,
            origSourceId: conn.sourceId,
            origSourceAnchor: conn.sourceAnchor,
            origTargetId: conn.targetId,
            origTargetAnchor: conn.targetAnchor,
            pendingReattach: null,
        };
    };

    /**
     * Met à jour la poignée en cours de glissement. `point` (coordonnées canvas) sert
     * au repositionnement direct des points d'angle/contrôle de courbe ; `screenPoint`
     * (coordonnées écran client) sert au survol d'ancre pour le rattachement
     * d'extrémité, via document.elementFromPoint côté CanvasEditor. `shiftKey` (point
     * d'angle uniquement) contraint le déplacement à l'axe horizontal ou vertical par
     * rapport à la position de départ du point (dont la variation est la plus grande).
     * Pour une extrémité, ne déplace pas encore le connecteur (le rattachement se
     * fait au relâchement, cf. endHandleDrag) — seulement l'ancre survolée s'allume.
     */
    const updateHandleDrag = (context, drag, point, screenPoint, shiftKey) => {
        const state = context?.state;
        if (!state || !drag) return;
        const conn = Array.isArray(state.connectors) ? state.connectors.find(c => c.id === drag.connId) : null;
        if (!conn) return;

        if (drag.role === 'waypoint' && drag.index != null && Array.isArray(conn.waypoints)) {
            let px = point.x, py = point.y;
            if (shiftKey && drag.startPoint) {
                const dx = Math.abs(px - drag.startPoint.x);
                const dy = Math.abs(py - drag.startPoint.y);
                if (dx > dy) py = drag.startPoint.y;
                else px = drag.startPoint.x;
            }
            conn.waypoints[drag.index] = { x: Math.round(px), y: Math.round(py) };
            context.refreshConnectors?.();
            return;
        }
        if (drag.role === 'curve-control') {
            conn.curveControl = { x: Math.round(point.x), y: Math.round(point.y) };
            context.refreshConnectors?.();
            return;
        }
        if (drag.role === 'endpoint' && screenPoint) {
            const hit = context.findAnchorAtScreenPoint?.(screenPoint.x, screenPoint.y);
            drag.pendingReattach = hit || null;
            context.highlightAnchor?.(hit);
        }
    };

    /** Termine le glissement — commite le rattachement d'extrémité si une ancre valide est survolée. */
    const endHandleDrag = (context, drag) => {
        if (!drag) return false;
        context.clearAnchorHighlight?.();
        if (drag.role !== 'endpoint' || !drag.pendingReattach) {
            context.notifyChange?.();
            return true;
        }
        const { elId, anchor } = drag.pendingReattach;
        const patch = drag.end === 'source'
            ? { sourceId: elId, sourceAnchor: anchor }
            : { targetId: elId, targetAnchor: anchor };
        updateConnector(context, drag.connId, patch);
        return true;
    };

    /**
     * Supprime un point d'angle précis (élément liste/waypoint) — déclenché par Suppr
     * quand une poignée d'angle vient d'être armée (voir editor-bindings.js).
     * @param {object} context - { state, refreshConnectors, notifyChange }
     * @param {string} connId
     * @param {number} index
     */
    const removeWaypoint = (context, connId, index) => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors)) return false;
        const conn = state.connectors.find(c => c.id === connId);
        if (!conn || !Array.isArray(conn.waypoints) || index == null) return false;
        if (index < 0 || index >= conn.waypoints.length) return false;
        conn.waypoints.splice(index, 1);
        context.refreshConnectors?.();
        context.notifyChange?.();
        return true;
    };

    const getSelectedConnector = context => {
        const state = context?.state;
        if (!state || !Array.isArray(state.connectors) || !state._selectedConnectorId) return null;
        return state.connectors.find(conn => conn.id === state._selectedConnectorId) || null;
    };

    const selectConnector = (context, id) => {
        const state = context?.state;
        if (!state) return null;
        // Re-cliquer un connecteur DÉJÀ sélectionné est un no-op côté état : on évite de
        // reconstruire tout l'overlay SVG (pathsG.innerHTML = '') entre le mousedown et le
        // mouseup du même geste, ce qui remplacerait le nœud DOM cliqué et empêcherait le
        // navigateur de synthétiser 'click'/'dblclick' (identité de nœud rompue) — un
        // double-clic sur un connecteur déjà sélectionné ne déclencherait alors plus jamais
        // l'édition inline du label.
        if (id && id === state._selectedConnectorId) {
            const already = getSelectedConnector({ state });
            context.notifyConnectorSelect?.(already);
            return already;
        }
        state._selectedConnectorId = id;
        context.clearElementSelection?.();
        context.updateSelectionVisuals?.();
        context.refreshConnectors?.();
        const selected = getSelectedConnector({ state });
        context.notifyConnectorSelect?.(selected);
        return selected;
    };

    root.OEISlidesCanvasConnectorsRuntime = Object.freeze({
        refreshConnectors,
        updateTempLine,
        enterConnectorMode,
        exitConnectorMode,
        toggleConnectorMode,
        addConnector,
        removeConnector,
        updateConnector,
        selectConnector,
        getSelectedConnector,
        insertWaypointAtPoint,
        startHandleDrag,
        updateHandleDrag,
        endHandleDrag,
        removeWaypoint,
        testUtils: Object.freeze({
            resolveElement,
            escapeHtml,
            refreshConnectors,
            updateTempLine,
            enterConnectorMode,
            exitConnectorMode,
            toggleConnectorMode,
            addConnector,
            removeConnector,
            updateConnector,
            selectConnector,
            getSelectedConnector,
            insertWaypointAtPoint,
            startHandleDrag,
            updateHandleDrag,
            endHandleDrag,
            removeWaypoint,
        }),
    });
})(window);
