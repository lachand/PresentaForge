/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/background-utils
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/background-utils.js"></script>
 */
// @ts-check
/**
 * background-utils.js
 * Shared helpers for slide background URL normalization and DOM background application.
 * Exposes `window.OEIBackgroundUtils`.
 */
(function backgroundUtilsInit(global) {
    /**
     * @param {unknown} value
     * @returns {string}
     */
    function normalizeUrl(value) {
        const raw = typeof value === 'string' ? value.trim() : String(value || '').trim();
        if (!raw) return '';
        let encoded = raw;
        try { encoded = encodeURI(raw); } catch (e) {}
        return encoded
            .replace(/"/g, '%22')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\s/g, '%20');
    }

    /**
     * @param {unknown} size
     * @returns {'cover'|'contain'|'100% 100%'}
     */
    function cssSize(size) {
        if (size === 'contain') return 'contain';
        if (size === 'stretch') return '100% 100%';
        return 'cover';
    }

    /**
     * @param {HTMLElement | null | undefined} el
     * @param {{ bg?: string, bgImage?: unknown, bgSize?: unknown, bgOverlay?: unknown } | null | undefined} bgData
     */
    function applyToElement(el, bgData) {
        if (!el || !bgData) return;
        const bg = typeof bgData.bg === 'string' ? bgData.bg : '';
        el.style.background = bg;
        el.style.backgroundImage = '';
        el.style.backgroundSize = '';
        el.style.backgroundPosition = '';
        el.style.backgroundRepeat = '';

        const imgUrl = normalizeUrl(bgData.bgImage);
        if (!imgUrl) return;
        const size = cssSize(bgData.bgSize);
        const overlay = !!bgData.bgOverlay;
        el.style.backgroundImage = overlay
            ? `linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.42)), url("${imgUrl}")`
            : `url("${imgUrl}")`;
        el.style.backgroundSize = size;
        el.style.backgroundPosition = 'center center';
        el.style.backgroundRepeat = 'no-repeat';
    }

    global.OEIBackgroundUtils = Object.freeze({
        normalizeUrl,
        cssSize,
        applyToElement,
    });
})(window);
