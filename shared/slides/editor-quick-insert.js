/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-quick-insert
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-quick-insert.js"></script>
 */
/* editor-quick-insert.js — Quick insert "/" menu with fuzzy search */
/* globals: canvasEditor, editor, onUpdate, notify */

const _quickInsertItems = [
    { id: 'heading', label: 'Titre', keywords: 'heading titre h1 titre principal', iconSelector: '#ribbon-insertion .el-type-btn[data-el="heading"] .el-icon', iconKey: 'text' },
    { id: 'text', label: 'Texte', keywords: 'text texte paragraphe body liste puces bullets - tabulation', iconSelector: '#ribbon-insertion .el-type-btn[data-el="text"] .el-icon', iconKey: 'text' },
    { id: 'highlight', label: 'Code / Terminal', keywords: 'code source programme bloc highlight terminal bash shell console', iconSelector: '#ribbon-insertion .el-type-btn[data-el="highlight"] .el-icon', iconKey: 'code' },
    { id: 'image', label: 'Image', keywords: 'image photo picture illustration', iconSelector: '#ribbon-insertion .el-type-btn[data-el="image"] .el-icon', iconKey: 'media' },
    { id: 'table', label: 'Tableau', keywords: 'table tableau grille grid cells', iconSelector: '#btn-insert-table .el-icon', iconKey: 'grid' },
    { id: 'shape', label: 'Forme', keywords: 'shape forme rectangle cercle ellipse triangle', iconSelector: '#btn-shape-gallery .el-icon', iconKey: 'diagram' },
    { id: 'widget', label: 'Widget', keywords: 'widget plugin composant interactif', iconSelector: '#ribbon-insertion .el-type-btn[data-el="widget"] .el-icon', iconKey: 'settings' },
    { id: 'definition', label: 'Définition', keywords: 'definition glossaire terme définition', iconSelector: '#ribbon-insertion .el-type-btn[data-el="definition"] .el-icon', iconKey: 'book' },
    { id: 'callout-box', label: 'Callout box', keywords: 'callout box encadré attention info warning danger', iconSelector: '#btn-insert-callout .el-icon', iconKey: 'question' },
    { id: 'exercise-block', label: 'Exercice', keywords: 'exercice consigne objectif indice correction activité', iconSelector: '#ribbon-insertion .el-type-btn[data-el="exercise-block"] .el-icon', iconKey: 'activity' },
    { id: 'before-after', label: 'Before / After', keywords: 'before after avant après comparaison', iconSelector: '#ribbon-insertion .el-type-btn[data-el="before-after"] .el-icon', iconKey: 'text' },
    { id: 'mistake-fix', label: 'Erreur / Correction', keywords: 'erreur correction piège fréquent fix', iconSelector: '#ribbon-insertion .el-type-btn[data-el="mistake-fix"] .el-icon', iconKey: 'code' },
    { id: 'rubric-block', label: 'Rubric block', keywords: 'rubric barème grille évaluation critères', iconSelector: '#ribbon-insertion .el-type-btn[data-el="rubric-block"] .el-icon', iconKey: 'poll' },
    { id: 'code-example', label: 'Exemple de code', keywords: 'exemple code terminal live stepper widget', iconSelector: '#ribbon-insertion .el-type-btn[data-el="code-example"] .el-icon', iconKey: 'code' },
    { id: 'terminal-session', label: 'Session terminal', keywords: 'terminal bash shell session commandes sortie', iconSelector: '#ribbon-insertion .el-type-btn[data-el="terminal-session"] .el-icon', iconKey: 'code' },
    { id: 'quote', label: 'Citation', keywords: 'citation quote blockquote', iconSelector: '#ribbon-insertion .el-type-btn[data-el="quote"] .el-icon', iconKey: 'quote' },
    { id: 'card', label: 'Carte', keywords: 'card carte panneau callout', iconSelector: '#ribbon-insertion .el-type-btn[data-el="card"] .el-icon', iconKey: 'grid' },
    { id: 'connector', label: 'Connecteur', keywords: 'connector connecteur ligne flèche arrow line', iconSelector: '#btn-add-connector .el-icon', iconKey: 'diagram' },
    { id: 'video', label: 'Vidéo', keywords: 'video youtube vimeo embed', iconSelector: '#btn-insert-video .el-icon', iconKey: 'play' },
    { id: 'callout', label: 'Callout', keywords: 'callout info warning tip encadré', iconSelector: '#btn-insert-callout .el-icon', iconKey: 'question' },
    { id: 'mermaid', label: 'Diagramme Mermaid', keywords: 'mermaid diagramme graphe flowchart sequence', iconSelector: '#ribbon-insertion .el-type-btn[data-el="mermaid"] .el-icon', iconKey: 'diagram' },
    { id: 'diagramme', label: 'Diagramme', keywords: 'diagramme chart graphique bar line pie area donut radar scatter bubble histogram boxplot waterfall funnel heatmap treemap sankey gantt jauge radial gauge combo stacked 100', iconSelector: '#ribbon-insertion .el-type-btn[data-el="diagramme"] .el-icon', iconKey: 'diagram' },
    { id: 'latex', label: 'Équation LaTeX', keywords: 'latex equation math formule katex', iconSelector: '#ribbon-insertion .el-type-btn[data-el="latex"] .el-icon', iconKey: 'book' },
    { id: 'timer', label: 'Minuteur', keywords: 'timer minuteur countdown chrono temps', iconSelector: '#ribbon-insertion .el-type-btn[data-el="timer"] .el-icon', iconKey: 'clock' },
    { id: 'iframe', label: 'Iframe', keywords: 'iframe embed url site web page', iconSelector: '#ribbon-insertion .el-type-btn[data-el="iframe"] .el-icon', iconKey: 'integration' },
    { id: 'qrcode', label: 'QR Code', keywords: 'qr qrcode code barres lien url', iconSelector: '#ribbon-insertion .el-type-btn[data-el="qrcode"] .el-icon', iconKey: 'grid' },
    { id: 'smartart', label: 'SmartArt', keywords: 'smartart process étapes diagram flux', iconSelector: '#ribbon-insertion .el-type-btn[data-el="smartart"] .el-icon', iconKey: 'diagram' },
    { id: 'code-live', label: 'Code Live', keywords: 'code live exécution python javascript run playground', iconSelector: '#ribbon-insertion .el-type-btn[data-el="code-live"] .el-icon', iconKey: 'code' },
    { id: 'quiz-live', label: 'Quiz Live', keywords: 'quiz live interactif sondage vote audience peer question', iconSelector: '#ribbon-insertion .el-type-btn[data-el="quiz-live"] .el-icon', iconKey: 'poll' },
    { id: 'cloze', label: 'Texte à trous', keywords: 'cloze texte trous compléter assessment', iconSelector: '#ribbon-insertion .el-type-btn[data-el="cloze"] .el-icon', iconKey: 'poll' },
    { id: 'mcq-single', label: 'QCM simple', keywords: 'qcm simple une seule réponse', iconSelector: '#ribbon-insertion .el-type-btn[data-el="mcq-single"] .el-icon', iconKey: 'poll' },
    { id: 'mcq-multi', label: 'QCM multi', keywords: 'qcm multi plusieurs réponses', iconSelector: '#ribbon-insertion .el-type-btn[data-el="mcq-multi"] .el-icon', iconKey: 'poll' },
    { id: 'poll-likert', label: 'Likert live', keywords: 'likert sondage vote 1 5', iconSelector: '#ribbon-insertion .el-type-btn[data-el="poll-likert"] .el-icon', iconKey: 'poll' },
    { id: 'debate-mode', label: 'Débat live', keywords: 'débat pour contre opinion', iconSelector: '#ribbon-insertion .el-type-btn[data-el="debate-mode"] .el-icon', iconKey: 'activity' },
    { id: 'exit-ticket', label: 'Exit ticket', keywords: 'exit ticket bilan fin séance', iconSelector: '#ribbon-insertion .el-type-btn[data-el="exit-ticket"] .el-icon', iconKey: 'bookmark' },
    { id: 'drag-drop', label: 'Drag & Drop', keywords: 'drag drop classer cartes', iconSelector: '#ribbon-insertion .el-type-btn[data-el="drag-drop"] .el-icon', iconKey: 'activity' },
    { id: 'rank-order', label: 'Classement', keywords: 'classement ordonner rank order', iconSelector: '#ribbon-insertion .el-type-btn[data-el="rank-order"] .el-icon', iconKey: 'list' },
    { id: 'kanban-mini', label: 'Kanban mini', keywords: 'kanban colonnes cartes activité', iconSelector: '#ribbon-insertion .el-type-btn[data-el="kanban-mini"] .el-icon', iconKey: 'grid' },
    { id: 'myth-reality', label: 'Mythe / Réalité', keywords: 'mythe réalité carte recto verso', iconSelector: '#ribbon-insertion .el-type-btn[data-el="myth-reality"] .el-icon', iconKey: 'quote' },
    { id: 'flashcards-auto', label: 'Flashcards', keywords: 'flashcards cartes révision', iconSelector: '#ribbon-insertion .el-type-btn[data-el="flashcards-auto"] .el-icon', iconKey: 'flashcards' },
    { id: 'postit-wall', label: 'Post-it live', keywords: 'postit wall mur idées collecter', iconSelector: '#ribbon-insertion .el-type-btn[data-el="postit-wall"] .el-icon', iconKey: 'facilitation' },
    { id: 'audience-roulette', label: 'Roulette audience', keywords: 'roulette aléatoire étudiant audience', iconSelector: '#ribbon-insertion .el-type-btn[data-el="audience-roulette"] .el-icon', iconKey: 'refresh' },
    { id: 'room-stats', label: 'Stats live', keywords: 'stats live salle indicateurs audience', iconSelector: '#ribbon-insertion .el-type-btn[data-el="room-stats"] .el-icon', iconKey: 'poll' },
    { id: 'leaderboard-live', label: 'Leaderboard live', keywords: 'leaderboard classement salle score', iconSelector: '#ribbon-insertion .el-type-btn[data-el="leaderboard-live"] .el-icon', iconKey: 'users' },
    { id: 'swot-grid', label: 'SWOT', keywords: 'swot forces faiblesses opportunités menaces', iconSelector: '#ribbon-insertion .el-type-btn[data-el="swot-grid"] .el-icon', iconKey: 'grid' },
    { id: 'decision-tree', label: 'Arbre de décision', keywords: 'decision tree arbre branche', iconSelector: '#ribbon-insertion .el-type-btn[data-el="decision-tree"] .el-icon', iconKey: 'diagram' },
    { id: 'timeline-vertical', label: 'Timeline verticale', keywords: 'timeline jalons progression', iconSelector: '#ribbon-insertion .el-type-btn[data-el="timeline-vertical"] .el-icon', iconKey: 'list' },
    { id: 'code-compare', label: 'Code compare', keywords: 'code compare avant après diff', iconSelector: '#ribbon-insertion .el-type-btn[data-el="code-compare"] .el-icon', iconKey: 'code' },
    { id: 'algo-stepper', label: 'Algo stepper', keywords: 'algorithme pas à pas stepper', iconSelector: '#ribbon-insertion .el-type-btn[data-el="algo-stepper"] .el-icon', iconKey: 'code' },
    { id: 'gallery-annotable', label: 'Gallery annotable', keywords: 'gallery image annotation point', iconSelector: '#ribbon-insertion .el-type-btn[data-el="gallery-annotable"] .el-icon', iconKey: 'media' },
    { id: 'slidenum', label: 'N° de slide', keywords: 'slide number numéro page', iconSelector: '#btn-slide-number svg', iconKey: 'bookmark' },
    { id: 'autochapter', label: 'N° chapitres auto', keywords: 'chapitre chapter numérotation auto number', iconSelector: '#btn-auto-chapter svg', iconKey: 'list' },
    { id: 'footer', label: 'Pied de page', keywords: 'footer pied de page bas', iconSelector: '#btn-footer svg', iconKey: 'bookmark' },
];

const _quickInsertIconCache = new Map();

let _quickInsertOverlay = null;

function _fuzzyMatch(query, text) {
    query = query.toLowerCase();
    text = text.toLowerCase();
    if (text.includes(query)) return true;
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
        if (text[i] === query[qi]) qi++;
    }
    return qi === query.length;
}

function openQuickInsert() {
    if (!canvasEditor) {
        notify('Sélectionnez un slide canvas pour insérer', 'info');
        return;
    }
    if (_quickInsertOverlay) {
        _quickInsertOverlay.remove();
        _quickInsertOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.id = 'quick-insert-overlay';
    overlay.innerHTML = `
        <div class="qi-panel">
            <input type="text" class="qi-input" placeholder="Rechercher un élément…" autofocus>
            <div class="qi-results"></div>
        </div>`;
    document.body.appendChild(overlay);
    _quickInsertOverlay = overlay;

    const input = overlay.querySelector('.qi-input');
    const results = overlay.querySelector('.qi-results');
    _quickInsertIconCache.clear();

    function render(query) {
        const esc = v => String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const iconForItem = item => {
            if (_quickInsertIconCache.has(item.id)) return _quickInsertIconCache.get(item.id);
            let iconHtml = '';
            if (item.iconSelector) {
                const src = document.querySelector(item.iconSelector);
                if (src) {
                    iconHtml = src.tagName?.toLowerCase() === 'svg'
                        ? src.outerHTML
                        : (src.innerHTML || src.outerHTML || '');
                }
            }
            if (!iconHtml && item.iconKey && typeof window.oeiIcon === 'function') {
                iconHtml = window.oeiIcon(item.iconKey) || '';
            }
            _quickInsertIconCache.set(item.id, iconHtml);
            return iconHtml;
        };
        const items = query
            ? _quickInsertItems.filter(it => _fuzzyMatch(query, it.label + ' ' + it.keywords))
            : _quickInsertItems;

        results.innerHTML = items.map((it, i) =>
            `<div class="qi-item${i === 0 ? ' qi-active' : ''}" data-id="${it.id}">` +
            `<span class="qi-icon">${iconForItem(it)}</span>` +
            `<span class="qi-label">${esc(it.label)}</span>` +
            `</div>`
        ).join('') || '<div class="qi-empty">Aucun résultat</div>';

        results.querySelectorAll('.qi-item').forEach(el => {
            el.addEventListener('click', () => _doQuickInsert(el.dataset.id));
            el.addEventListener('mouseenter', () => {
                results.querySelector('.qi-active')?.classList.remove('qi-active');
                el.classList.add('qi-active');
            });
        });
    }

    render('');

    input.addEventListener('input', () => render(input.value.trim()));

    input.addEventListener('keydown', e => {
        const items = results.querySelectorAll('.qi-item');
        const active = results.querySelector('.qi-active');
        const idx = [...items].indexOf(active);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            active?.classList.remove('qi-active');
            const next = items[Math.min(idx + 1, items.length - 1)];
            next?.classList.add('qi-active');
            next?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            active?.classList.remove('qi-active');
            const prev = items[Math.max(idx - 1, 0)];
            prev?.classList.add('qi-active');
            prev?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active) _doQuickInsert(active.dataset.id);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeQuickInsert();
        }
    });

    // Close on background click
    overlay.addEventListener('mousedown', e => {
        if (e.target === overlay) closeQuickInsert();
    });

    requestAnimationFrame(() => input.focus());
}

function closeQuickInsert() {
    if (_quickInsertOverlay) {
        _quickInsertOverlay.remove();
        _quickInsertOverlay = null;
    }
}

function _doQuickInsert(id) {
    closeQuickInsert();
    if (!canvasEditor) return;

    switch (id) {
        case 'heading':
        case 'text':
        case 'highlight':
        case 'list':
        case 'image':
        case 'widget':
        case 'definition':
        case 'callout-box':
        case 'exercise-block':
        case 'before-after':
        case 'mistake-fix':
        case 'rubric-block':
        case 'code-example':
        case 'terminal-session':
        case 'quote':
        case 'card':
        case 'mermaid':
        case 'diagramme':
        case 'latex':
        case 'timer':
        case 'iframe':
        case 'qrcode':
        case 'smartart':
        case 'code-live':
        case 'quiz-live':
        case 'cloze':
        case 'mcq-single':
        case 'mcq-multi':
        case 'poll-likert':
        case 'debate-mode':
        case 'exit-ticket':
        case 'drag-drop':
        case 'rank-order':
        case 'kanban-mini':
        case 'myth-reality':
        case 'flashcards-auto':
        case 'postit-wall':
        case 'audience-roulette':
        case 'room-stats':
        case 'leaderboard-live':
        case 'swot-grid':
        case 'decision-tree':
        case 'timeline-vertical':
        case 'code-compare':
        case 'algo-stepper':
        case 'gallery-annotable':
            canvasEditor.add(id);
            break;
        case 'table':
            insertTable(3, 3);
            break;
        case 'shape':
            canvasEditor.add('shape');
            break;
        case 'video':
            openVideoDialog();
            return; // dialog handles the rest
        case 'callout':
            insertCallout();
            break;
        case 'connector':
            canvasEditor.toggleConnectorMode();
            document.getElementById('btn-add-connector')?.classList.toggle('active', canvasEditor._connectorMode);
            notify(canvasEditor._connectorMode ? 'Mode connecteur activé — cliquez sur deux éléments' : 'Mode connecteur désactivé', 'info');
            return;
        case 'slidenum':
            insertSlideNumber();
            return;
        case 'autochapter':
            toggleAutoNumberChapters();
            return;
        case 'footer':
            insertFooter();
            return;
        default:
            canvasEditor.add(id);
    }
    onUpdate('slide-update');
}

window.openQuickInsert = openQuickInsert;
window.closeQuickInsert = closeQuickInsert;
