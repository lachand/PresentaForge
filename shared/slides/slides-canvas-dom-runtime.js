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

    /**
     * Applique/efface la CSS de « boîte » (bordure, rayon, ombre) sur le wrapper d'un
     * élément dans la preview éditeur — parité avec le wrapper du viewer
     * (`slides-renderer-canvas.js` `_canvasElement` → `SlidesShared.wrapperBoxCss`).
     */
    const applyWrapperBoxStyle = (div, el) => {
        if (!div || !div.style) return;
        const s = el && el.style;
        const isShape = el && el.type === 'shape';
        div.style.border = '';
        div.style.borderRadius = '';
        div.style.filter = '';
        if (!s || typeof s !== 'object') return;
        if (!isShape) {
            const bw = Number(s.borderWidth);
            if (Number.isFinite(bw) && bw > 0 && s.borderColor) {
                div.style.border = `${bw}px ${s.borderStyle || 'solid'} ${s.borderColor}`;
            }
            if (s.borderRadius != null && s.borderRadius !== '') {
                div.style.borderRadius = typeof s.borderRadius === 'number' ? `${s.borderRadius}px` : String(s.borderRadius);
            }
        }
        if (s.boxShadow && s.boxShadow !== 'none') {
            const shadow = s.boxShadow === true || s.boxShadow === '1' ? '0 8px 24px rgba(0,0,0,0.35)' : String(s.boxShadow);
            div.style.filter = `drop-shadow(${shadow.replace(/^0 8px 32px/, '0 8px 24px')})`;
        }
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
        // Background fill (for non-shape types; shapes use SVG fill internally)
        if (el.type !== 'shape' && el.style?.fill) {
            div.style.backgroundColor = el.style.fill;
        } else if (el.type !== 'shape') {
            div.style.backgroundColor = '';
        }
        applyWrapperBoxStyle(div, el);

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
        applyWrapperBoxStyle,
        testUtils: Object.freeze({
            CODE_TYPES: new Set(CODE_TYPES),
            getElementDom,
            refreshElementDom,
            applyWrapperBoxStyle,
        }),
    });
})(window);
