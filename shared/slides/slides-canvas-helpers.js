// @ts-check
/* slides-canvas-helpers.js — helpers purs pour CanvasEditor */
(function initSlidesCanvasHelpers(global) {
    'use strict';

    if (global.OEISlidesCanvasHelpers) return;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const lineInRange = (lineNum, rangeStr) => {
        const ranges = String(rangeStr || '').split(',');
        for (const range of ranges) {
            const trimmed = range.trim();
            if (!trimmed) continue;
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10));
                if (lineNum >= start && lineNum <= end) return true;
            } else {
                const n = parseInt(trimmed, 10);
                if (lineNum === n) return true;
            }
        }
        return false;
    };

    const normalizeCodeExampleMode = mode => (
        ['terminal', 'live', 'stepper'].includes(mode) ? mode : 'terminal'
    );

    const computeCodeMetrics = (baseFontSize, resolveCodeLineHeight = null) => {
        const providedBase = Number(baseFontSize);
        const base = Number.isFinite(providedBase) ? Math.max(10, providedBase) : 16;
        const codeSize = Math.round(base * 0.82);
        const lineHeightResolver = typeof resolveCodeLineHeight === 'function'
            ? resolveCodeLineHeight
            : (() => 1.58);
        return {
            headSize: Math.round(base * 0.66),
            codeSize,
            codeLineHeight: clamp(Number(lineHeightResolver(codeSize)) || 1.58, 1.45, 1.9),
            stepTitleSize: Math.round(base * 0.74),
            stepDetailSize: Math.round(base * 0.69),
        };
    };

    global.OEISlidesCanvasHelpers = Object.freeze({
        lineInRange,
        normalizeCodeExampleMode,
        computeCodeMetrics,
        testUtils: Object.freeze({
            lineInRange,
            normalizeCodeExampleMode,
            computeCodeMetrics,
        }),
    });
})(window);
