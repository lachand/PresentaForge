/**
 * @module slides/ui-icons
 * @public
 * Façade de compatibilité : le registre d'icônes de PresentaForge est désormais le jeu Signature (shared/icons.js,
 * global `OEIIcons`). Ce module conserve l'API historique (`oeiIcon`, `oeiIconLabel`, `OEI_UI_ICONS`) pour les
 * appelants existants. Les icônes ont la taille du texte voisin (1em) au lieu d'une taille en pixels fixe.
 */
(function initOeiUiIcons(global) {
    if (!global) return;

    const KEYS = [
        'close', 'save', 'open', 'clock', 'manual', 'users', 'hand', 'question', 'dot', 'copy', 'check', 'play', 'stop',
        'link', 'refresh', 'remote', 'feedback_fast', 'feedback_unclear', 'feedback_pause', 'feedback_clear', 'poll',
        'cloud', 'bookmark', 'bookmark_star', 'grid', 'text', 'media', 'diagram', 'code', 'activity', 'facilitation',
        'integration', 'chevron_down', 'flashcards', 'shuffle', 'layers', 'list', 'quote', 'book', 'trash', 'undo',
        'redo', 'moon', 'sun', 'palette', 'settings',
    ];

    const esc = v => String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const render = name => (global.OEIIcons ? global.OEIIcons.render(name) : '');

    // Objet clé -> SVG, comme l'ancien registre (les appelants lisent `OEI_UI_ICONS[clé]`).
    const ICONS = {};
    KEYS.forEach((key) => {
        Object.defineProperty(ICONS, key, { enumerable: true, get: () => render(key) });
    });

    global.OEI_UI_ICONS = ICONS;
    global.oeiIcon = function oeiIcon(name) {
        return render(name);
    };
    global.oeiIconLabel = function oeiIconLabel(name, label) {
        const icon = render(name);
        if (!label) return icon;
        return `${icon}<span>${esc(label)}</span>`;
    };
})(typeof window !== 'undefined' ? window : globalThis);
