// @ts-check
/* slides-canvas-special-runtime.js — runtime QR pour CanvasEditor.
 *
 * LaTeX / Mermaid / timer sont désormais montés par le runtime unifié partagé avec le
 * viewer (`OEISlidesSpecialRuntime.mountSpecialElements({ prefix: 'cel', passive: true })`,
 * appelé depuis `CanvasEditor._mountSpecialCel`) — voir PRESENTAFORGE_PLAN_EXECUTION_2026-08
 * chantier 3. Seul le rendu QR reste spécifique à l'éditeur (chargement paresseux hors-ligne
 * de qrcode-generator, non géré par le runtime unifié).
 */
(function initSlidesCanvasSpecialRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasSpecialRuntime) return;

    const QRCODE_SRC = '../vendor/qrcode-generator/1.4.4/qrcode.min.js';

    let qrcodeLoading = false;

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

    root.OEISlidesCanvasSpecialRuntime = Object.freeze({
        renderQRElements,
        testUtils: Object.freeze({
            doRenderQR,
        }),
    });
})(window);
