// @ts-check
/* slides-canvas-dom-runtime.js — runtime refresh DOM pour CanvasEditor */
(function initSlidesCanvasDomRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasDomRuntime) return;

    const CODE_TYPES = new Set(['code', 'highlight', 'code-example', 'terminal-session']);

    const getElementDom = (container, id) => {
        if (!container || !id || typeof container.querySelector !== 'function') return null;
        return container.querySelector(`.cel[data-id="${id}"]`);
    };

    const refreshElementDom = context => {
        const id = context?.id;
        const container = context?.container;
        const elements = Array.isArray(context?.elements) ? context.elements : [];
        const documentRef = context?.documentRef || root.document;
        const requestFrame = typeof context?.requestAnimationFrameFn === 'function'
            ? context.requestAnimationFrameFn
            : (typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame.bind(root) : fn => fn());

        const div = getElementDom(container, id);
        if (!div) return false;

        const el = elements.find(item => item && item.id === id);
        if (!el) return false;

        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        div.style.width = el.w + 'px';
        div.style.height = el.h + 'px';
        div.style.zIndex = el.z || 1;
        div.style.transform = (el.style?.rotate) ? `rotate(${el.style.rotate}deg)` : '';

        context.syncLockVisual?.(div, el);

        const inner = div.querySelector?.('.cel-inner');
        if (inner) {
            const html = context.renderContent?.(el);
            inner.innerHTML = html != null ? String(html) : '';
        }

        if (el.type === 'widget') context.mountWidget?.(div, el);
        if (CODE_TYPES.has(el.type)) context.highlightCodeBlock?.(div);

        context.postRenderElement?.(el);
        requestFrame(() => {
            context.updateOverflowVisual?.(div, el);
        });

        let badge = div.querySelector?.('.cel-anim-badge');
        if (el.animation && el.animation.type && el.animation.type !== 'none') {
            if (!badge && documentRef?.createElement) {
                badge = documentRef.createElement('span');
                badge.className = 'cel-anim-badge';
                div.appendChild?.(badge);
            }
            if (badge) {
                const orderStr = el.animation.order != null ? ` #${el.animation.order}` : '';
                badge.textContent = '⚡' + orderStr;
            }
        } else if (badge && typeof badge.remove === 'function') {
            badge.remove();
        }

        return true;
    };

    root.OEISlidesCanvasDomRuntime = Object.freeze({
        getElementDom,
        refreshElementDom,
        testUtils: Object.freeze({
            CODE_TYPES: new Set(CODE_TYPES),
            getElementDom,
            refreshElementDom,
        }),
    });
})(window);
