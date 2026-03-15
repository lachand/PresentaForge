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

    const refreshConnectors = context => {
        const connOverlay = context?.connOverlay;
        if (!connOverlay) return 0;
        const pathsG = connOverlay.querySelector?.('.conn-paths');
        const defs = connOverlay.querySelector?.('defs');
        if (!pathsG || !defs) return 0;

        const documentRef = context.documentRef || root.document;
        if (!documentRef?.createElementNS) return 0;

        const connectors = Array.isArray(context.connectors) ? context.connectors : [];
        const elements = Array.isArray(context.elements) ? context.elements : [];
        const selectedConnectorId = context.selectedConnectorId || null;
        const getConnectorPathData = typeof context.getConnectorPathData === 'function'
            ? context.getConnectorPathData
            : () => null;
        const getAnchorPos = typeof context.getAnchorPos === 'function'
            ? context.getAnchorPos
            : () => ({ x: 0, y: 0 });
        const esc = typeof context.escapeHtml === 'function' ? context.escapeHtml : escapeHtml;

        pathsG.innerHTML = '';
        defs.innerHTML = '';

        let rendered = 0;
        for (const conn of connectors) {
            const pathD = getConnectorPathData(conn);
            if (!pathD) continue;

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
                group.innerHTML += `<circle cx="${p1.x}" cy="${p1.y}" r="5" fill="${stroke}" opacity="0.6" style="pointer-events:none;"/>`;
                group.innerHTML += `<circle cx="${p2.x}" cy="${p2.y}" r="5" fill="${stroke}" opacity="0.6" style="pointer-events:none;"/>`;
            }

            pathsG.appendChild(group);
            rendered += 1;
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
        if (patch.style) Object.assign(conn.style || (conn.style = {}), patch.style);
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
        }),
    });
})(window);
