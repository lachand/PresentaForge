// @ts-check
/* slides-canvas-overflow-runtime.js — runtime overflow visuel pour CanvasEditor */
(function initSlidesCanvasOverflowRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasOverflowRuntime) return;

    const IGNORE_OVERFLOW_TYPES = new Set([
        'code', 'highlight', 'code-example', 'terminal-session', 'table', 'list',
        'mermaid', 'diagramme', 'image', 'video', 'iframe', 'widget', 'quiz-live',
        'poll-likert', 'mcq-single', 'mcq-multi', 'rank-order', 'flashcards-auto',
    ]);

    const shouldCheckOverflow = el => {
        const type = String(el?.type || '');
        return !IGNORE_OVERFLOW_TYPES.has(type);
    };

    const updateOverflowVisual = (context = {}) => {
        const div = context.div;
        const el = context.el;
        const documentRef = context.documentRef || root.document;
        const shouldCheck = typeof context.shouldCheckOverflow === 'function'
            ? context.shouldCheckOverflow
            : shouldCheckOverflow;
        if (!div || !el) return false;

        let badge = div.querySelector('.cel-overflow-badge');
        if (!shouldCheck(el)) {
            div.classList?.remove?.('has-overflow');
            if (badge && typeof badge.remove === 'function') badge.remove();
            return false;
        }

        const inner = div.querySelector('.cel-inner');
        if (!inner) return false;
        const deltaY = Number(inner.scrollHeight || 0) - Number(inner.clientHeight || 0);
        const deltaX = Number(inner.scrollWidth || 0) - Number(inner.clientWidth || 0);
        const hasOverflow = deltaX > 2 || deltaY > 2;
        div.classList?.toggle?.('has-overflow', hasOverflow);
        if (!hasOverflow) {
            if (badge && typeof badge.remove === 'function') badge.remove();
            return false;
        }

        if (!badge && documentRef?.createElement) {
            badge = documentRef.createElement('span');
            badge.className = 'cel-overflow-badge';
            badge.title = 'Contenu rogné : agrandissez le bloc ou réduisez le texte';
            badge.textContent = '!';
            div.appendChild?.(badge);
        }
        return true;
    };

    root.OEISlidesCanvasOverflowRuntime = Object.freeze({
        shouldCheckOverflow,
        updateOverflowVisual,
        testUtils: Object.freeze({
            shouldCheckOverflow,
            updateOverflowVisual,
            IGNORE_OVERFLOW_TYPES: new Set(IGNORE_OVERFLOW_TYPES),
        }),
    });
})(window);
