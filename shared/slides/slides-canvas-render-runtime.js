// @ts-check
/* slides-canvas-render-runtime.js — runtime render global pour CanvasEditor */
(function initSlidesCanvasRenderRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasRenderRuntime) return;

    const CONNECTOR_OVERLAY_INNER = '<defs></defs><g class="conn-paths"></g><line class="conn-temp" style="display:none" stroke="#818cf8" stroke-width="2" stroke-dasharray="6 4"/>';

    const createConnectorOverlay = (documentRef, handlers = {}) => {
        if (!documentRef?.createElementNS) return null;

        const overlay = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
        overlay.setAttribute('class', 'cel-connector-overlay');
        overlay.setAttribute('width', '1280');
        overlay.setAttribute('height', '720');
        overlay.setAttribute('viewBox', '0 0 1280 720');
        overlay.innerHTML = CONNECTOR_OVERLAY_INNER;

        if (typeof handlers.onConnectorMouseDown === 'function') {
            overlay.addEventListener?.('mousedown', event => {
                const group = event.target?.closest?.('.conn-g');
                if (!group) return;
                event.stopPropagation?.();
                handlers.onConnectorMouseDown(group.dataset?.connId, event);
            });
        }

        if (typeof handlers.onConnectorDblClick === 'function') {
            overlay.addEventListener?.('dblclick', event => {
                const group = event.target?.closest?.('.conn-g');
                if (!group) return;
                const connector = handlers.resolveConnector?.(group.dataset?.connId);
                if (!connector) return;
                event.stopPropagation?.();
                handlers.onConnectorDblClick(connector, event);
            });
        }

        return overlay;
    };

    const renderAll = context => {
        const container = context?.container;
        const documentRef = context?.documentRef || root.document;
        if (!container || !documentRef) return { connOverlay: null, marqueeDiv: context?.marqueeDiv || null };

        const bg = context.bg;
        const elements = Array.isArray(context.elements) ? context.elements : [];

        container.innerHTML = '';
        if (bg) container.style.background = bg;

        // Back overlay (z-index:0) for connectors anchored at center (passes behind elements)
        const connBackOverlay = createConnectorOverlay(documentRef, {
            onConnectorMouseDown: context.onConnectorMouseDown,
            onConnectorDblClick: context.onConnectorDblClick,
            resolveConnector: context.resolveConnector,
        });
        if (connBackOverlay) {
            connBackOverlay.setAttribute('class', 'cel-connector-overlay-back');
            container.appendChild?.(connBackOverlay);
        }

        const connOverlay = createConnectorOverlay(documentRef, {
            onConnectorMouseDown: context.onConnectorMouseDown,
            onConnectorDblClick: context.onConnectorDblClick,
            resolveConnector: context.resolveConnector,
        });
        if (connOverlay) container.appendChild?.(connOverlay);

        const sorted = [...elements].sort((a, b) => (a?.z || 0) - (b?.z || 0));
        sorted.forEach(el => context.addElementDOM?.(el));

        const guideLayer = documentRef.createElement?.('div');
        if (guideLayer) {
            guideLayer.className = 'canvas-guide-layer';
            container.appendChild?.(guideLayer);
        }

        let marqueeDiv = context.marqueeDiv;
        const containsMarquee = typeof container.contains === 'function' ? container.contains(marqueeDiv) : false;
        if (!marqueeDiv || !containsMarquee) {
            marqueeDiv = documentRef.createElement?.('div') || null;
            if (marqueeDiv) {
                marqueeDiv.className = 'cel-marquee';
                container.appendChild?.(marqueeDiv);
            }
        }

        context.refreshConnectors?.();

        return {
            connOverlay,
            connBackOverlay: connBackOverlay || null,
            marqueeDiv,
        };
    };

    root.OEISlidesCanvasRenderRuntime = Object.freeze({
        createConnectorOverlay,
        renderAll,
        testUtils: Object.freeze({
            CONNECTOR_OVERLAY_INNER,
            createConnectorOverlay,
            renderAll,
        }),
    });
})(window);
