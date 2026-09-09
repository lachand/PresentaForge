/**
 * HtmlSafe — façade unique d'échappement / assainissement pour les pages de cours
 * (revue 2026-09 §A2/A3/C5). Remplace les 7 copies d'`escapeHtml` et les strip-tags
 * maison. S'appuie sur `OEIHtmlSanitizer` (DOMPurify vendoré + repli portable) chargé
 * avant ce fichier ; en son absence, `rich()`/`richInline()` retombent sur `escape()`
 * (échec fermé — jamais moins sûr que du texte).
 */
(function (global) {
    'use strict';

    const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    /** Échappe tout le HTML. Pour les valeurs utilisateur (options, saisies, libellés). */
    function escape(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
    }

    function sanitizer() {
        return (global.OEIHtmlSanitizer && typeof global.OEIHtmlSanitizer.sanitize === 'function')
            ? global.OEIHtmlSanitizer
            : null;
    }

    /** Assainit du HTML riche de cours (formatage + tableaux + listes, jamais `style`/`script`). */
    function rich(html) {
        if (html == null || html === '') return '';
        const s = sanitizer();
        return s ? s.sanitize(String(html), 'course') : escape(html);
    }

    /** Assainit du formatage inline de cours (b/i/em/code/mark/span… + `class`). */
    function richInline(html) {
        if (html == null || html === '') return '';
        const s = sanitizer();
        return s ? s.sanitize(String(html), 'course-inline') : escape(html);
    }

    const SAFE_SCHEME_RE = /^(?:https?:|mailto:|tel:|ftp:)/;
    const ANY_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/;
    // Espaces / retours / caractères de contrôle qui peuvent masquer `java\nscript:`.
    const NOISE_RE = /[\u0000-\u0020\u007f-\u00a0]+/g;

    /** Renvoie l'URL si son schéma est sûr, sinon '#'. Bloque javascript:, data:, vbscript:… */
    function url(href) {
        const value = String(href == null ? '' : href).trim();
        if (!value) return '';
        const probe = value.replace(NOISE_RE, '').toLowerCase();
        if (SAFE_SCHEME_RE.test(probe)) return value;
        if (ANY_SCHEME_RE.test(probe)) return '#';
        return value; // relatif / ancre / query — sûr
    }

    const HtmlSafe = { escape, rich, richInline, url };

    if (typeof module !== 'undefined' && module.exports) module.exports = HtmlSafe;
    global.HtmlSafe = HtmlSafe;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
