// @ts-check
/* slides-canvas-special-runtime.js — runtime Mermaid/KaTeX/QR/Timers pour CanvasEditor */
(function initSlidesCanvasSpecialRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasSpecialRuntime) return;

    const MERMAID_SRC = '../vendor/mermaid/10.9.1/mermaid.min.js';
    const KATEX_CSS = '../vendor/katex/0.16.11/katex.min.css';
    const KATEX_SRC = '../vendor/katex/0.16.11/katex.min.js';
    const QRCODE_SRC = '../vendor/qrcode-generator/1.4.4/qrcode.min.js';

    /** Thème Mermaid ('dark'/'default') selon la luminance du fond de slide résolu. */
    function mermaidThemeForSlide(windowRef) {
        try {
            const cs = (windowRef || root).getComputedStyle((windowRef || root).document.documentElement);
            const raw = (cs.getPropertyValue('--sl-slide-bg') || cs.getPropertyValue('--sl-bg') || '').trim();
            const m = raw.match(/^#?([0-9a-f]{6})$/i);
            if (!m) return 'default';
            const h = m[1];
            const lum = (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
            return lum < 0.5 ? 'dark' : 'default';
        } catch (_) { return 'default'; }
    }

    let mermaidLoading = false;
    let katexLoading = false;
    let qrcodeLoading = false;

    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const defaultLoadScript = (src, documentRef) => {
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

    const ensureStylesheet = (href, documentRef) => {
        if (!documentRef) return;
        if (documentRef.querySelector?.(`link[href="${href}"]`)) return;
        const link = documentRef.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        documentRef.head?.appendChild?.(link);
    };

    const doRenderMermaid = async (els, context = {}) => {
        const windowRef = context.windowRef || root;
        const esc = typeof context.escapeHtml === 'function' ? context.escapeHtml : escapeHtml;
        for (const el of els) {
            const src = el.querySelector?.('.cel-mermaid-src');
            const target = el.querySelector?.('.cel-mermaid-render');
            if (!src || !target || target.dataset?.rendered) continue;
            try {
                const id = el.dataset?.mermaidId || `mermaid-${Math.random().toString(36).slice(2)}`;
                const result = await windowRef.mermaid.render(`${id}-svg`, src.textContent);
                target.innerHTML = result.svg;
                target.dataset.rendered = '1';
            } catch (error) {
                target.innerHTML = `<pre style="color:#f87171;font-size:12px;">${esc(error?.message || 'Erreur Mermaid')}</pre>`;
            }
        }
    };

    const renderMermaidElements = context => {
        const container = context.container;
        if (!container) return;
        const windowRef = context.windowRef || root;
        const documentRef = context.documentRef || root.document;
        const loadScript = typeof context.loadScript === 'function'
            ? context.loadScript
            : (src => defaultLoadScript(src, documentRef));
        const els = Array.from(container.querySelectorAll?.('.cel-mermaid-content') || []);
        if (!els.length) return;
        if (windowRef.mermaid) {
            doRenderMermaid(els, context);
            return;
        }
        if (mermaidLoading) return;
        mermaidLoading = true;
        loadScript(MERMAID_SRC).then(() => {
            if (windowRef.mermaid?.initialize) {
                windowRef.mermaid.initialize({ startOnLoad: false, theme: mermaidThemeForSlide(windowRef), securityLevel: 'loose' });
            }
            return doRenderMermaid(els, context);
        }).catch(() => {}).finally(() => {
            mermaidLoading = false;
        });
    };

    const doRenderLatex = (els, context = {}) => {
        const windowRef = context.windowRef || root;
        const esc = typeof context.escapeHtml === 'function' ? context.escapeHtml : escapeHtml;
        els.forEach(el => {
            const target = el.querySelector?.('.cel-latex-render');
            if (!target || target.dataset?.rendered) return;
            const expr = el.dataset?.latex || '';
            try {
                target.innerHTML = windowRef.katex.renderToString(expr, { displayMode: true, throwOnError: false });
                target.dataset.rendered = '1';
            } catch (_) {
                target.innerHTML = `<span style="color:#f87171">${esc(expr)}</span>`;
            }
        });
    };

    const renderLatexElements = context => {
        const container = context.container;
        if (!container) return;
        const windowRef = context.windowRef || root;
        const documentRef = context.documentRef || root.document;
        const loadScript = typeof context.loadScript === 'function'
            ? context.loadScript
            : (src => defaultLoadScript(src, documentRef));
        const els = Array.from(container.querySelectorAll?.('.cel-latex-content') || []);
        if (!els.length) return;
        if (windowRef.katex) {
            doRenderLatex(els, context);
            return;
        }
        if (katexLoading) return;
        katexLoading = true;
        ensureStylesheet(KATEX_CSS, documentRef);
        loadScript(KATEX_SRC).then(() => {
            doRenderLatex(els, context);
        }).catch(() => {}).finally(() => {
            katexLoading = false;
        });
    };

    const doRenderQR = (containers, context = {}) => {
        const windowRef = context.windowRef || root;
        containers.forEach(container => {
            const render = container.querySelector?.('.cel-qr-render');
            if (!render || render.dataset?.rendered) return;
            const val = container.dataset?.qrValue || '';
            if (!val) {
                render.innerHTML = '<span style="color:var(--sl-muted);font-size:0.72rem;font-weight:700;letter-spacing:0.06em;">QR</span>';
                return;
            }
            try {
                const qr = windowRef.qrcode(0, 'M');
                qr.addData(val);
                qr.make();
                render.innerHTML = qr.createSvgTag({ scalable: true });
                const svg = render.querySelector?.('svg');
                if (svg?.style) {
                    svg.style.width = '100%';
                    svg.style.height = '100%';
                }
                render.dataset.rendered = '1';
            } catch (_) {
                render.innerHTML = '<span style="color:#f87171">Erreur QR</span>';
            }
        });
    };

    const renderQRElements = context => {
        const container = context.container;
        if (!container) return;
        const windowRef = context.windowRef || root;
        const documentRef = context.documentRef || root.document;
        const loadScript = typeof context.loadScript === 'function'
            ? context.loadScript
            : (src => defaultLoadScript(src, documentRef));
        const els = Array.from(container.querySelectorAll?.('.cel-qrcode-content') || []);
        if (!els.length) return;
        if (windowRef.qrcode) {
            doRenderQR(els, context);
            return;
        }
        if (qrcodeLoading) return;
        qrcodeLoading = true;
        loadScript(QRCODE_SRC).then(() => {
            doRenderQR(els, context);
        }).catch(() => {}).finally(() => {
            qrcodeLoading = false;
        });
    };

    const initTimerElements = context => {
        const container = context.container;
        if (!container) return;
        container.querySelectorAll?.('.cel-timer-content')?.forEach(el => {
            if (el.dataset?.timerBound) return;
            el.dataset.timerBound = '1';
            const dur = parseInt(el.dataset?.duration, 10) || 300;
            let remaining = dur;
            let interval = null;
            let running = false;
            const display = el.querySelector?.('.cel-timer-display');
            const btnStart = el.querySelector?.('.cel-timer-start');
            const btnPause = el.querySelector?.('.cel-timer-pause');
            const btnReset = el.querySelector?.('.cel-timer-reset');
            const fmt = secs => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
            const tick = () => {
                remaining = Math.max(0, remaining - 1);
                if (display) display.textContent = fmt(remaining);
                if (remaining <= 0) {
                    clearInterval(interval);
                    running = false;
                    if (btnStart?.style) btnStart.style.display = '';
                    if (btnPause?.style) btnPause.style.display = 'none';
                    if (display?.style) display.style.color = '#f87171';
                }
            };
            btnStart?.addEventListener?.('click', event => {
                event.stopPropagation?.();
                if (running) return;
                running = true;
                interval = setInterval(tick, 1000);
                if (btnStart.style) btnStart.style.display = 'none';
                if (btnPause?.style) btnPause.style.display = '';
            });
            btnPause?.addEventListener?.('click', event => {
                event.stopPropagation?.();
                clearInterval(interval);
                running = false;
                if (btnStart?.style) btnStart.style.display = '';
                if (btnPause?.style) btnPause.style.display = 'none';
            });
            btnReset?.addEventListener?.('click', event => {
                event.stopPropagation?.();
                clearInterval(interval);
                running = false;
                remaining = dur;
                if (display) display.textContent = fmt(dur);
                if (display?.style) display.style.color = '';
                if (btnStart?.style) btnStart.style.display = '';
                if (btnPause?.style) btnPause.style.display = 'none';
            });
        });
    };

    root.OEISlidesCanvasSpecialRuntime = Object.freeze({
        renderMermaidElements,
        renderLatexElements,
        renderQRElements,
        initTimerElements,
        testUtils: Object.freeze({
            doRenderMermaid,
            doRenderLatex,
            doRenderQR,
            initTimerElements,
            escapeHtml,
        }),
    });
})(window);
