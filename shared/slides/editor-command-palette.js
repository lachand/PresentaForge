/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-command-palette
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-command-palette.js"></script>
 */
/* editor-command-palette.js — Command palette for slide editor */

const COMMANDS = [
    { id: 'add-title', label: 'Ajouter slide : Titre', iconKey: 'text', action: () => editor.addSlide('title', editor.selectedIndex) },
    { id: 'add-bullets', label: 'Ajouter slide : Points clés', iconKey: 'list', action: () => editor.addSlide('bullets', editor.selectedIndex) },
    { id: 'add-code', label: 'Ajouter slide : Code', iconKey: 'code', action: () => editor.addSlide('code', editor.selectedIndex) },
    { id: 'add-canvas', label: 'Ajouter slide : Canvas libre', iconKey: 'grid', action: () => editor.addSlide('canvas', editor.selectedIndex) },
    { id: 'add-split', label: 'Ajouter slide : Split', iconKey: 'layers', action: () => editor.addSlide('split', editor.selectedIndex) },
    { id: 'add-image', label: 'Ajouter slide : Image', iconKey: 'media', action: () => editor.addSlide('image', editor.selectedIndex) },
    { id: 'add-quote', label: 'Ajouter slide : Citation', iconKey: 'quote', action: () => editor.addSlide('quote', editor.selectedIndex) },
    { id: 'add-definition', label: 'Ajouter slide : Définition', iconKey: 'book', action: () => editor.addSlide('definition', editor.selectedIndex) },
    { id: 'add-comparison', label: 'Ajouter slide : Comparaison', iconKey: 'shuffle', action: () => editor.addSlide('comparison', editor.selectedIndex) },
    { id: 'add-simulation', label: 'Ajouter slide : Simulation', iconKey: 'settings', action: () => editor.addSlide('simulation', editor.selectedIndex) },
    { id: 'add-chapter', label: 'Ajouter slide : Chapitre', iconKey: 'bookmark', action: () => editor.addSlide('chapter', editor.selectedIndex) },
    { id: 'dup', label: 'Dupliquer le slide actuel', iconKey: 'copy', action: () => editor.duplicateSlide(editor.selectedIndex) },
    { id: 'del', label: 'Supprimer le slide actuel', iconKey: 'trash', action: async () => { if(await OEIDialog.confirm('Supprimer le slide actuel ?', { danger: true })) editor.removeSlide(editor.selectedIndex); } },
    { id: 'undo', label: 'Annuler', iconKey: 'undo', action: () => editor.undo() },
    { id: 'redo', label: 'Rétablir', iconKey: 'redo', action: () => editor.redo() },
    { id: 'export-json', label: 'Exporter en JSON', iconKey: 'save', action: () => { editor.exportJson(); notify('Fichier téléchargé', 'success'); } },
    { id: 'present', label: 'Lancer la présentation', iconKey: 'play', action: () => launchPresentation() },
    { id: 'theme-dark', label: 'Thème slide : Sombre', iconKey: 'moon', action: () => { editor.setTheme('dark'); buildThemeSelect(); } },
    { id: 'theme-light', label: 'Thème slide : Clair', iconKey: 'sun', action: () => { editor.setTheme('light'); buildThemeSelect(); } },
    { id: 'theme-academic', label: 'Thème slide : Académique', iconKey: 'bookmark_star', action: () => { editor.setTheme('academic'); buildThemeSelect(); } },
    { id: 'toggle-editor-theme', label: 'Basculer thème éditeur clair/sombre', iconKey: 'palette', action: () => toggleEditorTheme() },
];

function openCommandPalette() {
    document.getElementById('cmd-overlay').style.display = '';
    document.getElementById('command-palette').style.display = '';
    const input = document.getElementById('cmd-input');
    input.value = '';
    input.focus();
    renderCommandResults('');
}
function closeCommandPalette() {
    document.getElementById('cmd-overlay').style.display = 'none';
    document.getElementById('command-palette').style.display = 'none';
}
function renderCommandResults(query) {
    const container = document.getElementById('cmd-results');
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const iconHtml = key => (typeof window.oeiIcon === 'function' ? window.oeiIcon(key) : '');
    const q = query.toLowerCase().trim();
    const filtered = q ? COMMANDS.filter(c => c.label.toLowerCase().includes(q)) : COMMANDS;
    container.innerHTML = filtered.map((c, i) =>
        `<button class="command-palette-item${i === 0 ? ' active' : ''}" data-cmd-idx="${i}">
            <span class="cmd-icon">${iconHtml(c.iconKey) || esc((c.label || '?')[0])}</span>
            <span class="cmd-label">${esc(c.label)}</span>
        </button>`
    ).join('');
    container.querySelectorAll('.command-palette-item').forEach((btn, idx) => {
        btn.addEventListener('click', () => { filtered[idx]?.action(); closeCommandPalette(); });
    });
}
