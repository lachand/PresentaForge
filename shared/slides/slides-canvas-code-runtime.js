// @ts-check
/* slides-canvas-code-runtime.js — runtime code highlight/script loader pour CanvasEditor */
(function initSlidesCanvasCodeRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasCodeRuntime) return;

    const loadScript = (src, options = {}) => {
        const documentRef = options.documentRef || root.document;
        if (!documentRef) return Promise.reject(new Error('Document indisponible'));
        if (documentRef.querySelector?.(`script[src="${src}"]`)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = documentRef.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            documentRef.head?.appendChild?.(script);
        });
    };

    const highlightCodeBlock = (context = {}) => {
        const div = context.div;
        if (!div) return;
        const windowRef = context.windowRef || root;
        const documentRef = context.documentRef || root.document;
        const loadScriptFn = typeof context.loadScript === 'function'
            ? context.loadScript
            : (src => loadScript(src, { documentRef }));

        const isHighlight = div.dataset?.type === 'highlight';
        const codeEls = isHighlight
            ? [div?.querySelector?.('.cel-code-scroll code')].filter(Boolean)
            : Array.from(div?.querySelectorAll?.('.cel-code-scroll code, .cel-codeexample-live-code code, .cel-codeexample-stepper-code code') || []);
        if (!codeEls.length || codeEls.every(node => node.dataset?.highlighted)) return;

        const apply = () => {
            if (!windowRef.hljs) return;
            if (isHighlight) {
                const codeEl = codeEls[0];
                if (!codeEl) return;
                const lang = String(codeEl.className || '').replace('language-', '').trim();
                codeEl.querySelectorAll?.('.cel-hl-wrap')?.forEach(span => {
                    const raw = String(span.textContent || '').replace(/\n$/, '');
                    try {
                        const result = lang && lang !== 'text'
                            ? windowRef.hljs.highlight(raw, { language: lang, ignoreIllegals: true })
                            : windowRef.hljs.highlightAuto(raw);
                        span.innerHTML = `${result.value}\n`;
                    } catch (_) {
                        // Keep original content on highlighting failures.
                    }
                });
                codeEl.dataset.highlighted = '1';
                return;
            }

            codeEls.forEach(codeEl => {
                if (!codeEl || codeEl.dataset?.highlighted) return;
                try {
                    windowRef.hljs.highlightElement(codeEl);
                } catch (_) {}
                codeEl.dataset.highlighted = '1';
            });
        };

        if (windowRef.hljs) {
            apply();
            return;
        }

        const cssHref = '../vendor/highlightjs/11.9.0/styles/github-dark.min.css';
        const jsSrc = '../vendor/highlightjs/11.9.0/highlight.min.js';
        if (documentRef && !documentRef.querySelector?.(`link[href="${cssHref}"]`)) {
            const link = documentRef.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssHref;
            documentRef.head?.appendChild?.(link);
        }
        loadScriptFn(jsSrc).then(apply).catch(() => {});
    };

    root.OEISlidesCanvasCodeRuntime = Object.freeze({
        loadScript,
        highlightCodeBlock,
        testUtils: Object.freeze({
            loadScript,
            highlightCodeBlock,
        }),
    });
})(window);
