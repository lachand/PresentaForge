// @ts-check
/* slides-canvas-guides.js — runtime guide lines pour CanvasEditor */
(function initSlidesCanvasGuides(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasGuides) return;

    const getGuideLayer = container => (
        container && typeof container.querySelector === 'function'
            ? container.querySelector('.canvas-guide-layer')
            : null
    );

    const renderGuides = (container, xs = [], ys = [], options = {}) => {
        const layer = getGuideLayer(container);
        if (!layer) return;
        layer.innerHTML = '';

        const doc = options.documentRef || global.document;
        if (!doc || typeof doc.createElement !== 'function') return;

        const scale = Math.max(0.001, Number(options.scale) || 1);
        const thick = Math.ceil(2 / scale);

        (Array.isArray(xs) ? xs : []).forEach(x => {
            const line = doc.createElement('div');
            line.className = 'canvas-guide-v';
            line.style.left = `${Math.round(Number(x) - Math.floor(thick / 2))}px`;
            line.style.width = `${thick}px`;
            layer.appendChild(line);
        });
        (Array.isArray(ys) ? ys : []).forEach(y => {
            const line = doc.createElement('div');
            line.className = 'canvas-guide-h';
            line.style.top = `${Math.round(Number(y) - Math.floor(thick / 2))}px`;
            line.style.height = `${thick}px`;
            layer.appendChild(line);
        });
    };

    const clearGuides = container => {
        const layer = getGuideLayer(container);
        if (layer) layer.innerHTML = '';
    };

    root.OEISlidesCanvasGuides = Object.freeze({
        renderGuides,
        clearGuides,
        testUtils: Object.freeze({
            getGuideLayer,
            renderGuides,
            clearGuides,
        }),
    });
})(window);
