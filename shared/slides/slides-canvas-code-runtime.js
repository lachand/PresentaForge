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
            ? [div?.querySelector?.('.cel-highlight-block pre code')].filter(Boolean)
            : Array.from(div?.querySelectorAll?.('.cel-code-scroll code, .cel-codeexample-live-code code, .cel-codeexample-stepper-code code') || []);
        if (!codeEls.length || codeEls.every(node => node.dataset?.highlighted)) return;

        /** Expand a Reveal-style data-line-numbers string into a Set of 1-based line numbers.
         *  Reveal treats "|" as fragment steps and highlights the first segment at rest —
         *  the editor mirrors that initial state (WYSIWYG, no fragment stepping in the canvas). */
        const parseHighlightedLines = spec => {
            const out = new Set();
            const firstSegment = String(spec || '').split('|')[0] || '';
            firstSegment.split(',').forEach(part => {
                const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
                if (!m) return;
                const from = parseInt(m[1], 10);
                const to = m[2] ? parseInt(m[2], 10) : from;
                for (let n = Math.min(from, to); n <= Math.max(from, to); n++) out.add(n);
            });
            return out;
        };

        const apply = () => {
            if (!windowRef.hljs) return;
            if (isHighlight) {
                const codeEl = codeEls[0];
                if (!codeEl || codeEl.dataset?.highlighted) return;
                const lang = String(codeEl.className || '').replace('language-', '').trim();
                const rawCode = String(codeEl.textContent || '').replace(/\n$/, '');
                let highlightedHtml;
                try {
                    const result = lang && lang !== 'text'
                        ? windowRef.hljs.highlight(rawCode, { language: lang, ignoreIllegals: true })
                        : windowRef.hljs.highlightAuto(rawCode);
                    highlightedHtml = result.value;
                } catch (_) {
                    highlightedHtml = null;
                }
                const codeLines = (highlightedHtml != null ? highlightedHtml : rawCode.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))).split('\n');
                const hlLines = parseHighlightedLines(codeEl.getAttribute('data-line-numbers'));
                const hasHighlights = hlLines.size > 0;
                const rows = codeLines.map((lineHtml, i) => {
                    const ln = i + 1;
                    const trCls = hasHighlights && hlLines.has(ln) ? ' class="highlight-line"' : '';
                    return `<tr${trCls}><td class="hljs-ln-numbers">${ln}</td><td class="hljs-ln-code">${lineHtml || ' '}</td></tr>`;
                }).join('');
                codeEl.innerHTML = `<table class="hljs-ln${hasHighlights ? ' has-highlights' : ''}"><tbody>${rows}</tbody></table>`;
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
