/**
 * @module slides/editor-shortcuts
 * @public
 * @internal Module Slides chargé côté navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portée documentaire du module.
 */
/* editor-shortcuts.js — table unique des raccourcis de l'éditeur + feuille d'aide « ? »
 * (audit UX 2026-10, T12 / E-I5 / E-K5). Les raccourcis eux-mêmes sont gérés par
 * bindKeyboard() (editor-bindings.js) : cette table les DÉCRIT, et alimente l'aide, la
 * palette de commandes (Ctrl+K) et l'affichage selon la plateforme (Ctrl ou ⌘).
 */

/** @type {ReadonlyArray<{ group: string, items: ReadonlyArray<{ keys: string, label: string }> }>} */
const EDITOR_SHORTCUTS = Object.freeze([
    { group: 'Fichier et présentation', items: [
        { keys: 'Ctrl+S', label: 'Enregistrer (fichier lié ou Firebase)' },
        { keys: 'F5', label: 'Présenter' },
        { keys: 'Maj+F5', label: 'Présenter en mode présentateur' },
        { keys: 'Ctrl+K', label: 'Palette de commandes' },
        { keys: '?', label: 'Afficher cette aide' },
    ] },
    { group: 'Édition', items: [
        { keys: 'Ctrl+Z', label: 'Annuler' },
        { keys: 'Ctrl+Maj+Z', label: 'Rétablir' },
        { keys: 'Ctrl+Y', label: 'Rétablir (autre raccourci)' },
        { keys: 'Ctrl+F', label: 'Rechercher et remplacer' },
        { keys: 'Ctrl+X', label: 'Couper' },
        { keys: 'Ctrl+C', label: 'Copier (éléments ou slides selon la zone active)' },
        { keys: 'Ctrl+V', label: 'Coller' },
        { keys: 'Ctrl+Maj+V', label: 'Copier la sélection vers un autre slide' },
        { keys: 'Ctrl+D', label: 'Dupliquer' },
        { keys: 'Ctrl+A', label: 'Tout sélectionner' },
    ] },
    { group: 'Éléments du slide (canvas)', items: [
        { keys: 'Flèches', label: 'Déplacer l\'élément sélectionné de 1 px' },
        { keys: 'Maj+Flèches', label: 'Déplacer de 10 px' },
        { keys: 'Ctrl+Flèches', label: 'Redimensionner (Ctrl+Maj : par 10 px)' },
        { keys: 'Ctrl+G', label: 'Grouper' },
        { keys: 'Ctrl+Maj+G', label: 'Dégrouper' },
        { keys: 'Ctrl+L', label: 'Verrouiller ou déverrouiller' },
        { keys: 'Suppr', label: 'Supprimer l\'élément ou le connecteur' },
        { keys: '/', label: 'Insérer un élément (menu rapide)' },
        { keys: 'Échap', label: 'Quitter le mode en cours (connecteur, pipette)' },
    ] },
    { group: 'Slides', items: [
        { keys: 'Flèches', label: 'Slide précédent ou suivant (sans élément sélectionné)' },
        { keys: 'Ctrl+Maj+↑ / ↓', label: 'Déplacer le slide dans la présentation' },
        { keys: 'Maj+Suppr', label: 'Supprimer le slide (Annuler dans le message)' },
    ] },
]);

const _isApplePlatform = () => /Mac|iPhone|iPad/.test((typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgent)) || '');

/**
 * Affiche un raccourci pour la plateforme : « Ctrl+S » devient « ⌘S » sur Mac.
 * @param {string} keys — notation interne (Ctrl, Maj, Alt, Suppr, Flèches…)
 * @param {boolean} [apple] — forcé pour les tests
 */
function formatShortcut(keys, apple = _isApplePlatform()) {
    if (!apple) return String(keys);
    return String(keys)
        .replace(/Ctrl\+Maj\+/g, '⇧⌘').replace(/Ctrl\+/g, '⌘').replace(/Maj\+/g, '⇧').replace(/Alt\+/g, '⌥')
        .replace(/Suppr/g, '⌫');
}

/** Retire accents et casse : « Définition » et « definition » se trouvent mutuellement. */
const _normalizeSearch = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let _shortcutsOverlay = null;
let _shortcutsRelease = null;

function closeShortcutsHelp() {
    if (!_shortcutsOverlay) return;
    _shortcutsOverlay.remove();
    _shortcutsOverlay = null;
    if (_shortcutsRelease) { _shortcutsRelease(); _shortcutsRelease = null; }
}

/** Ouvre la feuille d'aide : tous les raccourcis, regroupés, adaptés à la plateforme. */
function openShortcutsHelp() {
    if (_shortcutsOverlay) { closeShortcutsHelp(); return; }
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay is-open shortcuts-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'shortcuts-title');
    overlay.style.zIndex = '99998';
    overlay.innerHTML = `
        <div class="ui-modal ui-modal--wide shortcuts-modal">
            <div class="ui-modal-header">
                <h2 class="ui-modal-title" id="shortcuts-title">Raccourcis clavier et premiers pas</h2>
                <button type="button" class="ui-modal-close" aria-label="Fermer" data-close>✕</button>
            </div>
            <div class="ui-modal-body shortcuts-body">
                <section class="shortcuts-tips">
                    <h3>Pour démarrer</h3>
                    <ul>
                        <li><strong>Tapez <kbd>/</kbd></strong> sur un slide canvas pour insérer un élément sans quitter le clavier.</li>
                        <li><strong><kbd>${esc(formatShortcut('Ctrl+K'))}</kbd></strong> ouvre la palette : cherchez une action par son nom.</li>
                        <li>Un slide « gabarit » n'accepte pas d'éléments libres : utilisez <em>Convertir en canvas</em> pour le rendre libre.</li>
                        <li>Le point à côté du titre indique où est enregistré votre travail ; cliquez dessus ou faites <kbd>${esc(formatShortcut('Ctrl+S'))}</kbd> pour enregistrer.</li>
                    </ul>
                </section>
                ${EDITOR_SHORTCUTS.map(g => `
                <section>
                    <h3>${esc(g.group)}</h3>
                    <table class="shortcuts-table"><tbody>
                        ${g.items.map(it => `<tr><th scope="row"><kbd>${esc(formatShortcut(it.keys))}</kbd></th><td>${esc(it.label)}</td></tr>`).join('')}
                    </tbody></table>
                </section>`).join('')}
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-close]')) closeShortcutsHelp(); });
    _shortcutsOverlay = overlay;
    const trap = window.OEIDialog && window.OEIDialog.trapFocus;
    _shortcutsRelease = trap ? trap(overlay, { onEscape: closeShortcutsHelp }) : null;
    overlay.querySelector('[data-close]')?.focus();
}
