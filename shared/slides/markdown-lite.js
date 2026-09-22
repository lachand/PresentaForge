/**
 * @module slides/markdown-lite
 * @public
 * @internal Module Slides chargé côté navigateur (et sous Node dans les tests).
 */
/*
 * markdown-lite.js — Markdown → HTML, sous-ensemble restreint pour le champ texte du
 * tableau blanc (slides/viewer/whiteboard.js).
 *
 * Aligné volontairement sur la liste blanche du profil 'course' de html-sanitizer.js
 * (titres h3-h6, pas de h1/h2, pas d'images, pas de liens) : la sortie de `toHtml()` DOIT
 * toujours repasser par OEIHtmlSanitizer.sanitize(html, 'course') avant tout innerHTML —
 * ce module ne fait que la mise en forme, pas l'assainissement.
 */
(function initMarkdownLite(global) {
    'use strict';

    if (global.OEIMarkdownLite) return;

    /**
     * @param {string} md
     * @returns {string} HTML (non assaini — passer par OEIHtmlSanitizer avant injection DOM)
     */
    function toHtml(md) {
        if (typeof md !== 'string' || !md) return '';

        let html = md
            // Échappement HTML
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // Blocs de code
            .replace(/```(?:\w*)\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            // Titres — mappés sur h3/h4/h5 (h1/h2 absents de la liste blanche 'course')
            .replace(/^### (.+)$/gm, '<h5>$1</h5>')
            .replace(/^## (.+)$/gm, '<h4>$1</h4>')
            .replace(/^# (.+)$/gm, '<h3>$1</h3>')
            // Gras, italique, code inline
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Listes à puces
            .replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
            // Citations
            .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
            // Paragraphes (lignes vides)
            .replace(/\n{2,}/g, '<br><br>')
            .replace(/\n/g, '<br>');

        // Regroupe les <li> consécutifs dans un <ul>
        html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, m => '<ul>' + m.replace(/<br>/g, '') + '</ul>');
        return html;
    }

    const OEIMarkdownLite = { toHtml };

    global.OEIMarkdownLite = OEIMarkdownLite;
    if (typeof module !== 'undefined' && module.exports) module.exports = OEIMarkdownLite;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
