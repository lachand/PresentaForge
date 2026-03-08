/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/design-tokens
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/design-tokens.js"></script>
 */
/* design-tokens.js — Global design tokens for slides presentations */
(function initOEIDesignTokens(global) {
    'use strict';

    if (global.OEIDesignTokens) return;

    const DEFAULTS = Object.freeze({
        colors: {},
        fonts: {},
        layout: {
            radius: 12,
            contentPaddingX: 48,
            contentPaddingY: 40,
            bodyLineHeight: 1.45,
        },
    });

    function _clone(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function _clampNumber(value, fallback, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    }

    function normalize(tokens) {
        const src = (tokens && typeof tokens === 'object') ? tokens : {};
        const out = _clone(DEFAULTS);
        const colors = src.colors && typeof src.colors === 'object' ? src.colors : {};
        const fonts = src.fonts && typeof src.fonts === 'object' ? src.fonts : {};
        const layout = src.layout && typeof src.layout === 'object' ? src.layout : {};

        for (const key of ['primary', 'accent', 'heading', 'text', 'slideBg', 'bg', 'muted', 'border', 'codeBg', 'codeText']) {
            const val = String(colors[key] || '').trim();
            if (val) out.colors[key] = val;
        }
        for (const key of ['heading', 'body', 'mono']) {
            const val = String(fonts[key] || '').trim();
            if (val) out.fonts[key] = val;
        }

        out.layout.radius = _clampNumber(layout.radius, DEFAULTS.layout.radius, 0, 80);
        out.layout.contentPaddingX = _clampNumber(layout.contentPaddingX, DEFAULTS.layout.contentPaddingX, 0, 180);
        out.layout.contentPaddingY = _clampNumber(layout.contentPaddingY, DEFAULTS.layout.contentPaddingY, 0, 140);
        out.layout.bodyLineHeight = _clampNumber(layout.bodyLineHeight, DEFAULTS.layout.bodyLineHeight, 1.1, 2.2);
        return out;
    }

    function mergeTheme(themeData, tokens) {
        const t = (themeData && typeof themeData === 'object') ? _clone(themeData) : {};
        const norm = normalize(tokens);
        t.colors = { ...(t.colors || {}), ...norm.colors };
        t.fonts = { ...(t.fonts || {}), ...norm.fonts };
        t.layoutTokens = norm.layout;
        return t;
    }

    function resolvePresentationTheme(presentationData) {
        const data = presentationData || {};
        const all = (typeof global.SlidesThemes?.list === 'function')
            ? global.SlidesThemes.list()
            : (global.SlidesThemes?.BUILT_IN || {});
        const base = (typeof data.theme === 'string')
            ? (all[data.theme] || global.SlidesThemes?.BUILT_IN?.dark || {})
            : (data.theme || global.SlidesThemes?.BUILT_IN?.dark || {});
        return mergeTheme(base, data.designTokens || {});
    }

    global.OEIDesignTokens = Object.freeze({
        DEFAULTS,
        normalize,
        mergeTheme,
        resolvePresentationTheme,
    });
})(window);
