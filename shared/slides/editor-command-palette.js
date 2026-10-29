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
    { id: 'dup', label: 'Dupliquer le slide actuel', iconKey: 'copy', keys: 'Ctrl+D', action: () => editor.duplicateSlide(editor.selectedIndex) },
    { id: 'del', label: 'Supprimer le slide actuel', iconKey: 'trash', action: async () => { if(await OEIDialog.confirm('Supprimer le slide actuel ?', { danger: true })) editor.removeSlide(editor.selectedIndex); } },
    { id: 'copy-to-slide', label: 'Copier la sélection vers un autre slide', iconKey: 'copy', keys: 'Ctrl+Maj+V', action: () => openCopyToSlideDialog() },
    { id: 'undo', label: 'Annuler', iconKey: 'undo', keys: 'Ctrl+Z', action: () => editor.undo() },
    { id: 'redo', label: 'Rétablir', iconKey: 'redo', keys: 'Ctrl+Maj+Z', action: () => editor.redo() },
    { id: 'export-json', label: 'Exporter en JSON', iconKey: 'save', action: () => { editor.exportJson(); notify('Fichier téléchargé', 'success'); } },
    { id: 'present', label: 'Lancer la présentation', iconKey: 'play', keys: 'F5', action: () => launchPresentation() },
    // Actions du ruban déclenchées par leur bouton : la palette retrouve ainsi tout ce qui existe
    // déjà, sans dupliquer la logique (audit UX 2026-10, E-I4).
    { id: 'save', label: 'Enregistrer', iconKey: 'save', keys: 'Ctrl+S', words: 'sauvegarder fichier firebase', action: () => document.getElementById('save-indicator')?.click() },
    { id: 'search', label: 'Rechercher et remplacer', iconKey: 'search', keys: 'Ctrl+F', action: () => openSearchDialog() },
    { id: 'help', label: 'Aide : raccourcis clavier et premiers pas', iconKey: 'help', keys: '?', words: 'aide raccourcis clavier', action: () => openShortcutsHelp() },
    { id: 'new', label: 'Nouvelle présentation', iconKey: 'plus', action: () => document.getElementById('btn-open-new')?.click() },
    { id: 'open-json', label: 'Ouvrir un fichier JSON', iconKey: 'folder', words: 'importer charger', action: () => document.getElementById('btn-import')?.click() },
    { id: 'import-pptx', label: 'Importer un PowerPoint (PPTX)', iconKey: 'upload', words: 'powerpoint', action: () => document.getElementById('btn-import-pptx')?.click() },
    { id: 'import-pdf', label: 'Importer un PDF', iconKey: 'upload', action: () => document.getElementById('btn-import-pdf')?.click() },
    { id: 'export-pdf', label: 'Exporter en PDF', iconKey: 'download', words: 'imprimer', action: () => document.getElementById('btn-export-pdf')?.click() },
    { id: 'export-pptx', label: 'Exporter en PowerPoint (PPTX)', iconKey: 'download', words: 'powerpoint', action: () => document.getElementById('btn-export-pptx')?.click() },
    { id: 'export-html', label: 'Exporter en HTML autonome', iconKey: 'download', action: () => document.getElementById('btn-export-html')?.click() },
    { id: 'history', label: 'Historique des révisions', iconKey: 'history', words: 'versions restaurer', action: () => document.getElementById('btn-revision-history')?.click() },
    { id: 'checker', label: 'Vérifier la présentation', iconKey: 'check', words: 'vérificateur contrôle', action: () => document.getElementById('btn-checker')?.click() },
    { id: 'ai', label: 'Générer avec l\'IA', iconKey: 'sparkles', words: 'intelligence artificielle pipeline', action: () => document.getElementById('btn-ai-tuning')?.click() },
    { id: 'hide', label: 'Masquer ou afficher le slide', iconKey: 'eye', action: () => document.getElementById('btn-hide-slide')?.click() },
    { id: 'convert-canvas', label: 'Convertir le slide en canvas', iconKey: 'grid', words: 'libre gabarit', action: () => document.getElementById('btn-convert-canvas')?.click() },
    { id: 'toggle-editor-theme', label: 'Thème de l\'éditeur : basculer clair ou sombre', iconKey: 'palette', action: () => toggleEditorTheme() },
];

// Regroupement affiché dans la palette quand aucune recherche n'est saisie.
const COMMAND_GROUPS = [
    ['Diapositive', /^(add-|dup$|del$|copy-to-slide$|hide$|convert-canvas$)/],
    ['Édition', /^(undo$|redo$|search$)/],
    ['Fichier', /^(save$|new$|open-json$|import-|export-|history$|ai$)/],
    ['Présentation et aide', /^(present$|checker$|help$)/],
    ['Thème', /^(theme-|toggle-editor-theme$)/],
];
function commandGroupOf(c) {
    const hit = COMMAND_GROUPS.find(([, re]) => re.test(c.id));
    return hit ? hit[0] : 'Autres';
}

// Un thème de diapositive = une commande, générée depuis SlidesThemes.list() : plus de liste figée,
// les thèmes personnalisés et les thèmes Signature apparaissent d'eux-mêmes.
function themeCommands() {
    let themes = {};
    try { themes = (typeof SlidesThemes !== 'undefined' && SlidesThemes.list) ? SlidesThemes.list() : {}; } catch (_) { themes = {}; }
    return Object.values(themes).filter(t => t && t.id).map(t => ({
        id: 'theme-' + t.id,
        label: 'Thème de la présentation : ' + (t.name || t.id),
        iconKey: 'palette',
        words: 'theme couleurs apparence ' + t.id,
        action: () => { editor.setTheme(t.id); if (typeof buildThemeSelect === 'function') buildThemeSelect(); },
    }));
}
function allCommands() { return COMMANDS.concat(themeCommands()); }

let _releaseCommandPaletteTrap = null;

function openCommandPalette() {
    // cmd-overlay has display:none in CSS class — needs inline override
    document.getElementById('cmd-overlay').style.display = 'block';
    // command-palette has class is-hidden { display:none } — must remove the class
    document.getElementById('command-palette').classList.remove('is-hidden');
    const input = document.getElementById('cmd-input');
    input.value = '';
    input.setAttribute('aria-expanded', 'true');
    // Piège de focus : Tab reste dans la palette, Échap la ferme et rend le focus au bouton d'origine.
    const trap = window.OEIDialog && window.OEIDialog.trapFocus;
    if (typeof trap === 'function' && !_releaseCommandPaletteTrap) {
        _releaseCommandPaletteTrap = trap(document.getElementById('command-palette'), { onEscape: () => closeCommandPalette() });
    }
    input.focus();
    renderCommandResults('');
}
function closeCommandPalette() {
    document.getElementById('cmd-overlay').style.display = '';
    document.getElementById('command-palette').classList.add('is-hidden');
    const input = document.getElementById('cmd-input');
    if (input) { input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    if (_releaseCommandPaletteTrap) { const release = _releaseCommandPaletteTrap; _releaseCommandPaletteTrap = null; release(); }
}
function renderCommandResults(query) {
    const container = document.getElementById('cmd-results');
    const iconHtml = key => (typeof window.oeiIcon === 'function' ? window.oeiIcon(key) : '');
    // Recherche sans accents ni casse (« definition » trouve « Définition »), sur le libellé
    // et des mots-clés (« powerpoint », « sauvegarder »).
    const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const terms = norm(query).split(/\s+/).filter(Boolean);
    const everything = allCommands();
    const filtered = terms.length
        ? everything.filter(c => { const hay = norm(c.label + ' ' + (c.words || '')); return terms.every(t => hay.includes(t)); })
        : everything;
    container.textContent = '';
    const input = document.getElementById('cmd-input');
    if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'command-palette-empty';
        empty.setAttribute('role', 'status');
        empty.textContent = 'Aucune commande ne correspond. Essayez un autre mot (« exporter », « slide », « thème »…).';
        container.appendChild(empty);
        return;
    }
    let lastGroup = null;
    filtered.forEach((c, i) => {
        if (!terms.length) {
            const group = commandGroupOf(c);
            if (group !== lastGroup) {
                lastGroup = group;
                const head = document.createElement('div');
                head.className = 'command-palette-group';
                head.setAttribute('role', 'presentation');
                head.textContent = group;
                container.appendChild(head);
            }
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'command-palette-item' + (i === 0 ? ' active' : '');
        btn.dataset.cmdIdx = String(i);
        btn.id = 'cmd-opt-' + i;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        btn.tabIndex = -1;
        const icon = document.createElement('span');
        icon.className = 'cmd-icon';
        const svg = iconHtml(c.iconKey);
        if (svg) icon.innerHTML = svg; else icon.textContent = (c.label || '?')[0];
        const label = document.createElement('span');
        label.className = 'cmd-label';
        label.textContent = c.label;
        btn.append(icon, label);
        if (c.keys && typeof formatShortcut === 'function') {
            const kbd = document.createElement('kbd');
            kbd.className = 'cmd-shortcut';
            kbd.textContent = formatShortcut(c.keys);
            btn.appendChild(kbd);
        }
        btn.addEventListener('click', () => { closeCommandPalette(); c.action(); });
        container.appendChild(btn);
    });
    if (input) input.setAttribute('aria-activedescendant', 'cmd-opt-0');
    // Annonce du nombre de résultats pour les lecteurs d'écran.
    container.setAttribute('aria-label', filtered.length + (filtered.length > 1 ? ' commandes' : ' commande'));
}
