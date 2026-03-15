// @ts-check
/* slides-canvas-widget-runtime.js — runtime montage widgets pour CanvasEditor */
(function initSlidesCanvasWidgetRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasWidgetRuntime) return;

    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const mountWidget = async (context = {}) => {
        const div = context.div;
        const el = context.el;
        const registry = context.registry || {};
        const scriptBasePath = String(context.scriptBasePath || '');
        const windowRef = context.windowRef || root;
        const documentRef = context.documentRef || root.document;
        const loadScript = typeof context.loadScript === 'function'
            ? context.loadScript
            : (async () => {});
        const esc = typeof context.escapeHtml === 'function' ? context.escapeHtml : escapeHtml;

        const wid = el?.data?.widget;
        if (!wid) return false;
        const reg = registry[wid];
        if (!reg) return false;
        const inner = div?.querySelector?.('.cel-inner');
        if (!inner) return false;

        try {
            if (!windowRef?.[reg.global]) {
                const scriptSrc = String(reg.script || '');
                const isAbsolute = /^(https?:)?\/\//i.test(scriptSrc);
                await loadScript(isAbsolute ? scriptSrc : (scriptBasePath + scriptSrc));
            }
            const cls = windowRef?.[reg.global];
            if (!cls || typeof cls.mount !== 'function') return false;
            inner.innerHTML = '';
            const mountTarget = documentRef.createElement('div');
            mountTarget.className = 'cel-widget-mount-target';
            inner.appendChild(mountTarget);
            cls.mount(mountTarget, Object.assign({}, el?.data?.config || {}, { type: wid }));
            return true;
        } catch (_) {
            inner.innerHTML = `<div class="cel-widget-placeholder"><span style="font-size:1.5rem">⚠️</span><span>${esc(wid)}</span></div>`;
            return false;
        }
    };

    root.OEISlidesCanvasWidgetRuntime = Object.freeze({
        mountWidget,
        testUtils: Object.freeze({
            escapeHtml,
            mountWidget,
        }),
    });
})(window);
