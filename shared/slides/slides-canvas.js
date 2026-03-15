/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/slides-canvas
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/slides-canvas.js"></script>
 */
/**
 * slides-canvas.js — CanvasEditor
 * Éditeur canvas pour les slides de type "canvas".
 * Gère les éléments librement positionnables, le drag/resize et les guides d'alignement.
 */

const CanvasHelpers = window.OEISlidesCanvasHelpers;
if (!CanvasHelpers) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-helpers.js avant slides-canvas.js.');
}
const CanvasGuides = window.OEISlidesCanvasGuides;
if (!CanvasGuides) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-guides.js avant slides-canvas.js.');
}
const CanvasCodeRuntime = window.OEISlidesCanvasCodeRuntime;
if (!CanvasCodeRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-code-runtime.js avant slides-canvas.js.');
}
const CanvasWidgetRuntime = window.OEISlidesCanvasWidgetRuntime;
if (!CanvasWidgetRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-widget-runtime.js avant slides-canvas.js.');
}
const CanvasOverflowRuntime = window.OEISlidesCanvasOverflowRuntime;
if (!CanvasOverflowRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-overflow-runtime.js avant slides-canvas.js.');
}
const CanvasConnectorsRuntime = window.OEISlidesCanvasConnectorsRuntime;
if (!CanvasConnectorsRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-connectors-runtime.js avant slides-canvas.js.');
}
const CanvasDomRuntime = window.OEISlidesCanvasDomRuntime;
if (!CanvasDomRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-dom-runtime.js avant slides-canvas.js.');
}
const CanvasSelectionRuntime = window.OEISlidesCanvasSelectionRuntime;
if (!CanvasSelectionRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-selection-runtime.js avant slides-canvas.js.');
}
const CanvasRenderRuntime = window.OEISlidesCanvasRenderRuntime;
if (!CanvasRenderRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-render-runtime.js avant slides-canvas.js.');
}
const CanvasEventsRuntime = window.OEISlidesCanvasEventsRuntime;
if (!CanvasEventsRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-events-runtime.js avant slides-canvas.js.');
}
const CanvasTransformRuntime = window.OEISlidesCanvasTransformRuntime;
if (!CanvasTransformRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-transform-runtime.js avant slides-canvas.js.');
}
const CanvasSpecialRuntime = window.OEISlidesCanvasSpecialRuntime;
if (!CanvasSpecialRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-special-runtime.js avant slides-canvas.js.');
}
const CanvasInlineEditRuntime = window.OEISlidesCanvasInlineEditRuntime;
if (!CanvasInlineEditRuntime) {
    throw new Error('[CanvasEditor] Module manquant: charger slides-canvas-inline-edit-runtime.js avant slides-canvas.js.');
}

class CanvasEditor {

    /* =========================================================
       STATIC CONFIG
       ========================================================= */

    static ELEMENT_TYPES = [
        { id: 'heading',    icon: 'H',   label: 'Titre',      w: 900, h: 120 },
        { id: 'text',       icon: 'T',   label: 'Texte',      w: 620, h: 100 },
        { id: 'code',       icon: '{}',  label: 'Code',       w: 620, h: 300 },
        { id: 'list',       icon: '≡',   label: 'Liste',      w: 500, h: 220 },
        { id: 'table',      icon: '⊞',  label: 'Tableau',    w: 700, h: 280 },
        { id: 'image',      icon: 'IMG', label: 'Image',      w: 400, h: 300 },
        { id: 'shape',      icon: '□',   label: 'Forme',      w: 200, h: 150 },
        { id: 'widget',     icon: 'W',   label: 'Widget',     w: 800, h: 420 },
        { id: 'definition', icon: 'DEF', label: 'Définition', w: 700, h: 200 },
        { id: 'callout-box', icon: 'ℹ', label: 'Callout box', w: 680, h: 220 },
        { id: 'exercise-block', icon: 'EXO', label: 'Exercice', w: 760, h: 420 },
        { id: 'before-after', icon: 'B/A', label: 'Before / After', w: 760, h: 340 },
        { id: 'mistake-fix', icon: 'FIX', label: 'Erreur/Correction', w: 760, h: 320 },
        { id: 'rubric-block', icon: 'RUB', label: 'Rubric block', w: 820, h: 360 },
        { id: 'code-example', icon: 'EX', label: 'Exemple code', w: 760, h: 360 },
        { id: 'terminal-session', icon: '$', label: 'Session terminal', w: 760, h: 320 },
        { id: 'quote',      icon: '"',   label: 'Citation',   w: 900, h: 340 },
        { id: 'card',       icon: '▤',   label: 'Carte',      w: 540, h: 380 },
        { id: 'video',      icon: '▶',   label: 'Vidéo',      w: 560, h: 315 },
        { id: 'mermaid',    icon: 'MMD', label: 'Mermaid',    w: 700, h: 400 },
        { id: 'diagramme',  icon: 'CH',  label: 'Diagramme',  w: 760, h: 380 },
        { id: 'latex',      icon: 'FX',  label: 'LaTeX',      w: 500, h: 120 },
        { id: 'timer',      icon: 'TM',  label: 'Timer',      w: 200, h: 100 },
        { id: 'iframe',     icon: 'WEB', label: 'Iframe',     w: 700, h: 450 },
        { id: 'highlight',  icon: '{}', label: 'Code',       w: 620, h: 300 },
        { id: 'qrcode',     icon: 'QR',  label: 'QR Code',    w: 200, h: 200 },
        { id: 'smartart',   icon: 'SA',  label: 'SmartArt',   w: 700, h: 350 },
        { id: 'code-live',  icon: '▶',   label: 'Code Live',  w: 700, h: 400 },
        { id: 'quiz-live',  icon: 'QZ',  label: 'Quiz',       w: 600, h: 420 },
        { id: 'cloze',      icon: 'CLZ', label: 'Texte à trous', w: 760, h: 280 },
        { id: 'mcq-single', icon: 'Q1',  label: 'QCM simple', w: 700, h: 340 },
        { id: 'drag-drop',  icon: 'DND', label: 'Drag & Drop', w: 760, h: 340 },
        { id: 'mcq-multi',  icon: 'QCM', label: 'QCM multi',  w: 700, h: 360 },
        { id: 'poll-likert', icon: 'LK', label: 'Likert live', w: 620, h: 300 },
        { id: 'debate-mode', icon: 'DB', label: 'Débat live', w: 620, h: 300 },
        { id: 'exit-ticket', icon: 'EXT', label: 'Exit ticket', w: 760, h: 340 },
        { id: 'postit-wall', icon: 'PI', label: 'Post-it live', w: 760, h: 400 },
        { id: 'audience-roulette', icon: 'RND', label: 'Roulette', w: 520, h: 240 },
        { id: 'room-stats', icon: 'STAT', label: 'Stats live', w: 760, h: 300 },
        { id: 'leaderboard-live', icon: 'LDB', label: 'Leaderboard', w: 680, h: 320 },
        { id: 'swot-grid', icon: 'SWOT', label: 'SWOT', w: 760, h: 360 },
        { id: 'decision-tree', icon: 'TREE', label: 'Arbre décision', w: 760, h: 360 },
        { id: 'timeline-vertical', icon: 'TL', label: 'Timeline V', w: 700, h: 420 },
        { id: 'code-compare', icon: 'CMP', label: 'Code compare', w: 760, h: 360 },
        { id: 'algo-stepper', icon: 'ALG', label: 'Algo stepper', w: 760, h: 360 },
        { id: 'gallery-annotable', icon: 'GAL', label: 'Gallery annotable', w: 760, h: 420 },
        { id: 'rank-order', icon: 'RANK', label: 'Classement', w: 700, h: 320 },
        { id: 'kanban-mini', icon: '▤', label: 'Kanban mini', w: 760, h: 360 },
        { id: 'myth-reality', icon: 'MR', label: 'Mythe/Réalité', w: 700, h: 300 },
        { id: 'flashcards-auto', icon: 'FC', label: 'Flashcards', w: 640, h: 300 },
    ];

    // Widget registry: use shared OEI_WIDGET_REGISTRY (loaded via WidgetRegistry.js)
    static WIDGET_REGISTRY = (typeof OEI_WIDGET_REGISTRY !== 'undefined') ? OEI_WIDGET_REGISTRY : {};

    static defaultElement(type) {
        const meta = CanvasEditor.ELEMENT_TYPES.find(t => t.id === type) || CanvasEditor.ELEMENT_TYPES[1];
        const base = {
            id: 'el_' + Math.random().toString(36).slice(2, 9),
            type,
            x: Math.round((1280 - meta.w) / 2),
            y: Math.round((720 - meta.h) / 2),
            w: meta.w,
            h: meta.h,
            z: 1,
        };
        switch (type) {
            case 'heading':
                return { ...base, data: { text: 'Titre principal' }, style: { fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' } };
            case 'text':
                return { ...base, data: { text: 'Votre texte ici.' }, style: { fontWeight: 400, color: 'var(--sl-text)', textAlign: 'left', fontFamily: 'var(--sl-font-body)' } };
            case 'code':
                return { ...base, data: { label: 'Code', language: 'python', code: '# Code ici\nprint("Hello, World!")' } };
            case 'list':
                return { ...base, data: { items: ['Premier point', 'Deuxième point', 'Troisième point'] }, style: { color: 'var(--sl-text)' } };
            case 'image':
                return { ...base, data: { src: '', alt: '', caption: '' } };
            case 'shape':
                return { ...base, data: { shape: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.2, borderRadius: 8 } };
            case 'widget':
                return { ...base, data: { widget: 'workflow-trigger-simulator', config: {} } };
            case 'definition':
                return { ...base, data: { label: 'Definition', term: 'Terme', definition: 'La définition complète du terme.', exampleLabel: 'Exemple', example: '' }, style: {} };
            case 'callout-box':
                return {
                    ...base,
                    data: {
                        label: 'Attention',
                        text: 'Message important à retenir pour éviter une erreur fréquente.',
                        tone: 'warning',
                    },
                    style: {},
                };
            case 'exercise-block':
                return {
                    ...base,
                    data: {
                        title: 'Exercice guidé',
                        objective: 'Appliquez la notion vue précédemment sur un cas concret.',
                        instructions: [
                            'Implémentez la fonction demandée.',
                            'Testez-la sur 2 cas.',
                            'Expliquez votre choix d’algorithme.',
                        ],
                        hints: [
                            'Commencez par un cas simple.',
                            'Validez les entrées avant le traitement.',
                        ],
                        correction: '',
                        showCorrection: false,
                    },
                    style: {},
                };
            case 'before-after':
                return {
                    ...base,
                    data: {
                        title: 'Avant / Après',
                        beforeLabel: 'Avant',
                        before: 'Situation initiale, limites, approche précédente.',
                        afterLabel: 'Après',
                        after: 'Approche améliorée, résultat attendu, bénéfices.',
                        tone: 'info',
                    },
                    style: {},
                };
            case 'mistake-fix':
                return {
                    ...base,
                    data: {
                        title: 'Erreur fréquente vs correction',
                        language: 'python',
                        mistake: 'for i in range(len(items)):\nprint(items[i])',
                        fix: 'for i in range(len(items)):\n    print(items[i])',
                        tone: 'danger',
                    },
                    style: {},
                };
            case 'rubric-block':
                return {
                    ...base,
                    data: {
                        title: 'Grille d’évaluation',
                        levels: ['Débutant', 'Intermédiaire', 'Maîtrise'],
                        rows: [
                            { criterion: 'Exactitude', descriptors: ['Erreurs majeures', 'Quelques erreurs', 'Sans erreur'] },
                            { criterion: 'Clarté', descriptors: ['Peu clair', 'Globalement clair', 'Très clair'] },
                            { criterion: 'Justification', descriptors: ['Absente', 'Partielle', 'Solide'] },
                        ],
                        tone: 'primary',
                    },
                    style: {},
                };
            case 'code-example':
                return {
                    ...base,
                    data: {
                        label: 'Exemple',
                        text: 'Décrivez le cas d’usage ou la logique attendue.',
                        widgetType: 'terminal',
                        language: 'python',
                        code: '# Exemple\nfor i in range(3):\n    print(i)',
                        stepperTitle: 'Exécution pas à pas',
                        stepperSteps: [
                            { title: 'Initialisation', detail: 'Préparer les variables utiles.', code: 'i = 0' },
                            { title: 'Traitement', detail: 'Appliquer la logique principale.', code: 'i += 1' },
                            { title: 'Affichage', detail: 'Afficher le résultat final.', code: 'print(i)' },
                        ],
                    },
                    style: {},
                };
            case 'terminal-session':
                return {
                    ...base,
                    data: {
                        label: 'Session terminal',
                        language: 'bash',
                        script: '$ python3 app.py\nApplication démarrée\n$ pytest -q\n4 passed in 0.10s',
                        tone: 'info',
                    },
                    style: {},
                };
            case 'quote':
                return { ...base, data: { text: 'Votre citation ici.', author: '' }, style: { color: 'var(--sl-heading)' } };
            case 'card':
                return { ...base, data: { title: 'Titre de la carte', items: ['Premier point', 'Deuxième point', 'Troisième point'] }, style: { color: 'var(--sl-text)', titleColor: 'var(--sl-primary)' } };
            case 'table': {
                const defaultRows = [
                    ['En-tête 1', 'En-tête 2', 'En-tête 3'],
                    ['Cellule', 'Cellule', 'Cellule'],
                    ['Cellule', 'Cellule', 'Cellule']
                ];
                return { ...base, data: { rows: defaultRows }, style: { color: 'var(--sl-text)', headerBg: 'var(--sl-primary)' } };
            }
            case 'video':
                return { ...base, data: { src: '', embedUrl: '', alt: '' } };
            case 'mermaid':
                return { ...base, data: { code: 'graph LR\n    A[Début] --> B{Condition}\n    B -->|Oui| C[Action]\n    B -->|Non| D[Fin]' } };
            case 'diagramme':
                return {
                    ...base,
                    data: {
                        title: 'Diagramme',
                        chartType: 'bar',
                        rows: [
                            ['Catégorie', 'Série A', 'Série B'],
                            ['A', '12', '8'],
                            ['B', '18', '11'],
                            ['C', '9', '14'],
                        ],
                    },
                    style: {},
                };
            case 'latex':
                return { ...base, data: { expression: 'E = mc^2' }, style: { color: 'var(--sl-text)' } };
            case 'timer':
                return { ...base, data: { duration: 300, label: 'Timer' }, style: { color: 'var(--sl-heading)' } };
            case 'iframe':
                return { ...base, data: { url: '', title: 'Contenu embarqué' } };
            case 'highlight':
                return { ...base, data: { label: 'Code', language: 'python', code: '# Code\ndef hello():\n    print("Hello!")\n\nhello()', highlights: [] } };
            case 'qrcode':
                return { ...base, data: { value: 'https://example.com', label: '', alt: '' } };
            case 'smartart':
                return { ...base, data: { variant: 'process', items: ['Étape 1', 'Étape 2', 'Étape 3'] }, style: { color: 'var(--sl-primary)' } };
            case 'code-live':
                return { ...base, data: { language: 'python', code: '# Code ici\nprint("Hello, World!")', autoRun: false }, style: {} };
            case 'quiz-live':
                return { ...base, data: { label: 'Quiz', question: 'Quelle est la bonne réponse ?', options: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'], answer: 0, duration: 30 }, style: {} };
            case 'cloze':
                return { ...base, data: { title: 'Texte à trous', sentence: 'Le protocole ____ garantit la livraison des paquets.', blanks: ['TCP'] }, style: {} };
            case 'mcq-single':
                return { ...base, data: { label: 'QCM simple', question: 'Quelle est la bonne réponse ?', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 1 }, style: {} };
            case 'drag-drop':
                return { ...base, data: { title: 'Classez les éléments', items: ['Cache L1', 'RAM', 'SSD'], targets: ['Très rapide', 'Moyen', 'Plus lent'] }, style: {} };
            case 'mcq-multi':
                return { ...base, data: { label: 'QCM multi', question: 'Quelles propositions sont exactes ?', options: ['Option A', 'Option B', 'Option C', 'Option D'], answers: [0, 2] }, style: {} };
            case 'poll-likert':
                return { ...base, data: { prompt: 'Votre niveau de confiance (1 à 5) ?' }, style: {} };
            case 'debate-mode':
                return { ...base, data: { prompt: 'Êtes-vous plutôt pour ou contre cette proposition ?' }, style: {} };
            case 'exit-ticket':
                return { ...base, data: { title: 'Exit ticket', prompts: ['Ce que j’ai retenu', 'Ce qui reste flou', 'Question pour la suite'] }, style: {} };
            case 'postit-wall':
                return { ...base, data: { prompt: 'Partagez une idée clé en quelques mots' }, style: {} };
            case 'audience-roulette':
                return { ...base, data: { title: 'Roulette participants' }, style: {} };
            case 'room-stats':
                return { ...base, data: { title: 'Stats de salle', metrics: ['students', 'hands', 'questions', 'feedback'] }, style: {} };
            case 'leaderboard-live':
                return { ...base, data: { title: 'Leaderboard live', limit: 5 }, style: {} };
            case 'swot-grid':
                return {
                    ...base,
                    data: {
                        strength: ['Forces internes'],
                        weakness: ['Faiblesses internes'],
                        opportunity: ['Opportunités externes'],
                        threat: ['Menaces externes'],
                    },
                    style: {},
                };
            case 'decision-tree':
                return { ...base, data: { title: 'Arbre de décision', root: 'Choix initial', branches: [{ label: 'Option A', outcome: 'Conséquence A' }, { label: 'Option B', outcome: 'Conséquence B' }, { label: 'Option C', outcome: 'Conséquence C' }] }, style: {} };
            case 'timeline-vertical':
                return { ...base, data: { title: 'Timeline', steps: ['Étape 1', 'Étape 2', 'Étape 3', 'Étape 4'] }, style: {} };
            case 'code-compare':
                return { ...base, data: { language: 'javascript', before: 'function sum(a,b){return a+b;}', after: 'const sum = (a, b) => a + b;' }, style: {} };
            case 'algo-stepper':
                return { ...base, data: { title: 'Parcours en largeur (BFS)', steps: [{ title: 'Initialisation', detail: 'Ajouter la source dans la file', code: 'queue = [source]' }, { title: 'Extraction', detail: 'Défiler le prochain nœud', code: 'node = queue.shift()' }, { title: 'Expansion', detail: 'Ajouter les voisins non visités', code: 'for v in neighbors(node)' }] }, style: {} };
            case 'gallery-annotable':
                return { ...base, data: { src: '', alt: '', notes: [{ x: 24, y: 30, text: 'Point clé 1' }, { x: 67, y: 58, text: 'Point clé 2' }] }, style: {} };
            case 'rank-order':
                return { ...base, data: { title: 'Classez du plus important au moins important', items: ['Item A', 'Item B', 'Item C', 'Item D'] }, style: {} };
            case 'kanban-mini':
                return { ...base, data: { title: 'Kanban mini', columns: [{ name: 'À faire', cards: ['Tâche 1', 'Tâche 2'] }, { name: 'En cours', cards: ['Tâche 3'] }, { name: 'Fait', cards: ['Tâche 4'] }] }, style: {} };
            case 'myth-reality':
                return { ...base, data: { myth: 'Mythe: il suffit d’ajouter du matériel.', reality: 'Réalité: il faut aussi optimiser l’architecture.' }, style: {} };
            case 'flashcards-auto':
                return { ...base, data: { title: 'Flashcards', cards: [{ front: 'Définition de TCP ?', back: 'Protocole fiable orienté connexion.' }, { front: 'IPv4 = ?', back: 'Adresse sur 32 bits.' }] }, style: {} };
            default:
                return { ...base, data: { text: '' }, style: {} };
        }
    }

    static ensureStyles() {
        if (document.getElementById('canvas-editor-styles')) return;
        const s = document.createElement('style');
        s.id = 'canvas-editor-styles';
        s.textContent = `
/* ── Canvas element ── */
.cel {
    position: absolute;
    cursor: move;
    user-select: none;
    outline: 1.5px dashed transparent;
    box-sizing: border-box;
    overflow: visible;
}
.cel:hover { outline-color: rgba(129,140,248,0.5); }
.cel.selected { outline: 2px solid #818cf8 !important; }
.cel.is-locked { cursor: default; }
.cel.is-locked:hover { outline-color: rgba(251,191,36,0.55); }
.cel.is-locked.selected { outline: 2px solid #f59e0b !important; }
.cel-lock-badge {
    position: absolute;
    top: -8px;
    left: -8px;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    background: #f59e0b;
    color: #111827;
    border: 1px solid rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
    z-index: 12;
}
.cel-anim-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #818cf8;
    color: #fff;
    font-size: 8px;
    padding: 1px 4px;
    border-radius: 6px;
    pointer-events: none;
    z-index: 9999;
    white-space: nowrap;
}
.cel-overflow-badge {
    position: absolute;
    right: -8px;
    bottom: -8px;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    padding: 0 5px;
    background: #ef4444;
    color: #fff;
    border: 1px solid rgba(0, 0, 0, 0.3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    pointer-events: none;
    z-index: 9999;
}
.cel.has-overflow { outline-color: rgba(239, 68, 68, 0.65) !important; }
.cel.is-locked .cel-handle { display: none !important; }
.cel-inner { width: 100%; height: 100%; overflow: hidden; box-sizing: border-box; pointer-events: none; }
.cel.editing .cel-inner { pointer-events: auto; }
.cel-widget-mount-target {
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
}
/* ── Connector anchor points ── */
.cel-anchor {
    position:absolute; width:12px; height:12px;
    background:#818cf8; border:2px solid #fff; border-radius:50%;
    display:none; z-index:11; cursor:crosshair; pointer-events:all;
    transition: transform 0.12s, background 0.12s;
}
.cel-anchor-top    { top:-6px;  left:calc(50% - 6px); }
.cel-anchor-right  { top:calc(50% - 6px); right:-6px; }
.cel-anchor-bottom { bottom:-6px; left:calc(50% - 6px); }
.cel-anchor-left   { top:calc(50% - 6px); left:-6px; }
.canvas-connector-mode .cel:hover .cel-anchor,
.canvas-connector-mode.conn-creating .cel .cel-anchor { display:block; }
.cel-anchor:hover { background:#f472b6; transform:scale(1.3); }
.cel-anchor.anchor-active { display:block !important; background:#22c55e; transform:scale(1.3); }

/* ── Resize handles ── */
.cel-handle {
    position: absolute;
    width: 9px; height: 9px;
    background: #fff;
    border: 1.5px solid #818cf8;
    border-radius: 2px;
    display: none;
    z-index: 10;
}
.cel.selected .cel-handle { display: block; }
.cel-handle-nw { top: -5px;  left: -5px;             cursor: nw-resize; }
.cel-handle-n  { top: -5px;  left: calc(50% - 4px);  cursor: n-resize;  }
.cel-handle-ne { top: -5px;  right: -5px;             cursor: ne-resize; }
.cel-handle-e  { top: calc(50% - 4px); right: -5px;  cursor: e-resize;  }
.cel-handle-se { bottom: -5px; right: -5px;           cursor: se-resize; }
.cel-handle-s  { bottom: -5px; left: calc(50% - 4px);cursor: s-resize;  }
.cel-handle-sw { bottom: -5px; left: -5px;            cursor: sw-resize; }
.cel-handle-w  { top: calc(50% - 4px); left: -5px;   cursor: w-resize;  }

/* ── Guide layer ── */
.canvas-guide-layer { position: absolute; inset: 0; pointer-events: none; z-index: 9000; }
.canvas-grid-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
    opacity: 0.25;
}
.group-bbox {
    position: absolute;
    border: 1.5px dashed rgba(255,255,255,0.2);
    border-radius: 4px;
    pointer-events: none;
    z-index: 9998;
}
.group-bbox-badge {
    position: absolute;
    top: -10px;
    left: 6px;
    font-size: 9px;
    background: var(--panel, #1e1e2e);
    padding: 0 4px;
    border-radius: 2px;
    pointer-events: none;
}
/* ── Marquee (rubber band) selection ── */
.cel-marquee {
    position: absolute; border: 1.5px dashed #818cf8;
    background: rgba(129, 140, 248, 0.08); pointer-events: none;
    z-index: 8999; display: none;
}
.canvas-guide-h { position: absolute; left: 0; right: 0; background: #f472b6; opacity: 0.9; }
.canvas-guide-v { position: absolute; top: 0; bottom: 0; background: #f472b6; opacity: 0.9; }
/* ── Inline editing ── */
.cel-inline-edit { outline: none !important; cursor: text !important; }
.cel.editing { cursor: text; outline: 2px solid #f472b6 !important; }
.cel-code-edit {
    width:100%; height:100%; resize:none; border:none; outline:none; display:block;
    background:var(--sl-code-bg,#0d1117); color:var(--sl-code-text,#e2e8f0);
    font-family:var(--sl-font-mono,monospace); font-size:13px; line-height:1.6;
    padding:0.75rem 1rem; box-sizing:border-box; tab-size:4;
}
.cel-list-content li[contenteditable] { outline:none; cursor:text; }
.cel-list-content li[contenteditable]:focus { background:rgba(129,140,248,0.06); border-radius:3px; }
.cel-def-edit-field { outline:none; cursor:text; min-height:1em; }
.cel-def-edit-field:focus { background:rgba(129,140,248,0.08); border-radius:3px; }
.cel-def-inline-label { font-size:0.75em; color:var(--sl-muted,#64748b); user-select:none; }
.cel-inline-code {
    font-family: var(--sl-font-mono,monospace);
    background: rgba(129,140,248,0.12);
    padding: 0.1em 0.3em;
    border-radius: 3px;
    font-size: 0.9em;
}

/* ── Element content types ── */
.cel-text-content {
    width: 100%; height: 100%;
    padding: 8px 10px;
    overflow: hidden;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
}
/* ── Terminal code block ── */
.cel-code-terminal {
    width: 100%; height: 100%;
    background: #0d1117;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid #21262d;
}
.cel-code-tbar {
    background: #161b22;
    display: flex;
    align-items: center;
    padding: 0 12px;
    height: 34px;
    gap: 6px;
    flex-shrink: 0;
    border-bottom: 1px solid #21262d;
}
.cel-code-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.cel-code-dot-r { background: #ff5f57; }
.cel-code-dot-y { background: #febc2e; }
.cel-code-dot-g { background: #28c840; }
.cel-code-tbar-lang {
    margin-left: auto;
    font-size: var(--cel-code-lang-size, 10px);
    color: #6e7681;
    font-family: var(--sl-font-mono, monospace);
    letter-spacing: 0.04em;
}
.cel-code-scroll { flex: 1; overflow: auto; display: flex; min-height: 0; }
.cel-code-gutter {
    padding: 0.65rem 0.6rem 0.65rem 0.85rem;
    color: #3d4451;
    font-size: var(--cel-code-gutter-size, 13px);
    line-height: var(--cel-code-line-height, 1.58);
    user-select: none; text-align: right;
    font-family: var(--sl-font-mono, monospace);
    white-space: pre; border-right: 1px solid #21262d;
    min-width: 2.2em; flex-shrink: 0;
}
.cel-code-scroll > pre {
    flex: 1; margin: 0; padding: 0.65rem 1rem;
    background: transparent !important;
    overflow: visible; min-width: 0; border: none !important;
}
.cel-code-scroll > pre code {
    font-family: var(--sl-font-mono, monospace);
    font-size: var(--cel-code-font-size, 13px);
    line-height: var(--cel-code-line-height, 1.58);
    color: #e6edf3;
    background: transparent !important; white-space: pre; display: block; padding: 0 !important;
}
.cel-list-content { width:100%; height:100%; padding: 6px 0 6px 1.5em; overflow: auto; }
.cel-list-content li { margin-bottom: 0.4em; }
.cel-list-content li::marker { color: var(--sl-primary, #818cf8); }
.cel-image-placeholder {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--sl-border, #2d3347);
    border-radius: 8px;
    color: var(--sl-muted, #64748b);
    font-size: 14px;
    flex-direction: column; gap: 0.5rem;
}
.cel-image-placeholder-icon {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--sl-border, #2d3347);
    background: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 80%, #000);
}
.cel-shape-content { width: 100%; height: 100%; }
/* ── Connector overlay ── */
.cel-connector-overlay { position:absolute; inset:0; pointer-events:none; z-index:8000; overflow:visible; }
.cel-connector-overlay .conn-g { pointer-events:stroke; cursor:pointer; }
.cel-connector-overlay .conn-hit { pointer-events:stroke; cursor:pointer; stroke:transparent; stroke-width:14; fill:none; }
.cel-connector-overlay .conn-g.conn-selected .conn-line-bg { stroke:rgba(129,140,248,0.25); stroke-width:8; }
.canvas-connector-mode { cursor:crosshair !important; }
.canvas-connector-mode .cel { cursor:crosshair !important; }
.cel-widget-placeholder, .cel-widget-loading {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--sl-border, #2d3347);
    border-radius: 8px;
    color: var(--sl-muted, #64748b);
    font-size: 13px;
    flex-direction: column; gap: 0.4rem;
}
.cel-def-content {
    width: 100%; height: 100%;
    background: color-mix(in srgb, var(--sl-primary, #818cf8) 8%, var(--sl-slide-bg, #1a1d27));
    border-left: 4px solid var(--sl-primary, #818cf8);
    border-radius: 0 8px 8px 0;
    padding: 0.75rem 1rem;
    overflow: auto;
    box-sizing: border-box;
}
.cel-def-term { font-family: var(--sl-font-mono, monospace); font-weight: 700; color: var(--sl-primary, #818cf8); margin-bottom: 0.35rem; font-size: 1em; }
.cel-def-body { color: var(--sl-text, #cbd5e1); font-size: 0.9em; line-height: 1.5; }
.cel-def-example { margin-top: 0.5rem; font-size: 0.82em; color: var(--sl-muted, #64748b); }
.cel-code-example-content {
    width: 100%;
    height: 100%;
    background: color-mix(in srgb, var(--sl-primary, #818cf8) 8%, var(--sl-slide-bg, #1a1d27));
    border-left: 4px solid var(--sl-primary, #818cf8);
    border-radius: 0 8px 8px 0;
    padding: 0.75rem 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    overflow: hidden;
}
.cel-code-example-label {
    font-family: var(--sl-font-mono, monospace);
    font-weight: 700;
    color: var(--sl-primary, #818cf8);
    font-size: 1em;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.cel-code-example-text {
    color: var(--sl-text, #cbd5e1);
    font-size: 0.88em;
    line-height: 1.45;
    max-height: 36%;
    overflow: auto;
}
.cel-code-example-widget {
    flex: 1;
    min-height: 110px;
    border: 1px solid var(--sl-border, #2d3347);
    border-radius: 8px;
    overflow: hidden;
    background: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 82%, #000);
}
.cel-code-example-widget .cel-code-terminal {
    --cel-code-font-size: var(--ce-code-font-size, 13px);
    --cel-code-gutter-size: var(--ce-code-gutter-size, 13px);
    --cel-code-lang-size: var(--ce-code-lang-size, 10px);
    height: 100%;
    border: none;
    border-radius: 0;
}
.cel-code-example-widget .cel-code-gutter {
    font-size: var(--ce-code-gutter-size, var(--cel-code-gutter-size, 13px));
}
.cel-code-example-widget .cel-code-tbar-lang {
    font-size: var(--ce-code-lang-size, var(--cel-code-lang-size, 10px));
}
.cel-code-example-widget .cel-code-scroll > pre code {
    font-size: var(--ce-code-font-size, var(--cel-code-font-size, 13px));
}
.cel-codeexample-live,
.cel-codeexample-stepper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.cel-codeexample-live-head,
.cel-codeexample-stepper-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    border-bottom: 1px solid var(--sl-border, #2d3347);
    background: color-mix(in srgb, var(--sl-surface, #1e2130) 88%, #000);
    font-size: 0.66rem;
}
.cel-codeexample-live-lang {
    font-family: var(--sl-font-mono, monospace);
    color: var(--sl-muted, #64748b);
    text-transform: uppercase;
}
.cel-codeexample-live-tag,
.cel-codeexample-stepper-tag {
    margin-left: auto;
    color: var(--ce-accent, var(--sl-primary, #818cf8));
    font-weight: 700;
    text-transform: uppercase;
}
.cel-codeexample-live-code {
    margin: 0;
    padding: 8px 10px;
    font-size: 0.72rem;
    line-height: var(--ce-code-line-height, var(--cel-code-line-height, 1.58));
    font-family: var(--sl-font-mono, monospace);
    color: var(--sl-text, #e2e8f0);
    white-space: pre;
    overflow: auto;
    flex: 1;
}
.cel-codeexample-live-code code,
.cel-codeexample-stepper-code code {
    display: block;
    font: inherit;
    color: inherit;
    background: transparent;
    white-space: pre;
}
.cel-codeexample-stepper-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    min-height: 0;
    overflow: auto;
}
.cel-codeexample-stepper-title {
    font-size: 0.74rem;
    color: var(--sl-heading, #f1f5f9);
    font-weight: 600;
}
.cel-codeexample-stepper-detail {
    font-size: 0.69rem;
    color: var(--sl-muted, #64748b);
}
.cel-codeexample-stepper-code {
    margin: 0;
    margin-top: auto;
    padding: 7px 8px;
    border: 1px solid var(--sl-border, #2d3347);
    border-radius: 7px;
    background: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 80%, #000);
    font-size: 0.66rem;
    line-height: var(--ce-code-line-height, var(--cel-code-line-height, 1.58));
    font-family: var(--sl-font-mono, monospace);
    color: var(--sl-text, #e2e8f0);
    white-space: pre;
    overflow: auto;
}
/* ── Table element ── */
.cel-table-content { width:100%; height:100%; overflow:auto; box-sizing:border-box; }
.cel-table-content table { width:100%; border-collapse:collapse; table-layout:fixed; }
.cel-table-content th, .cel-table-content td {
    border:1px solid rgba(255,255,255,0.15); padding:6px 10px;
    text-align:left; vertical-align:top;
}
.cel-table-content th {
    font-weight:700; color:#fff;
    background:color-mix(in srgb, var(--sl-primary,#818cf8) 60%, transparent);
}
.cel-table-content td {
    background:color-mix(in srgb, var(--sl-slide-bg,#1a1d27) 80%, rgba(255,255,255,0.03));
}
.cel-table-content tr:nth-child(even) td {
    background:color-mix(in srgb, var(--sl-slide-bg,#1a1d27) 70%, rgba(255,255,255,0.06));
}
.cel-table-content td[contenteditable], .cel-table-content th[contenteditable] {
    outline:none; cursor:text;
}
.cel-table-content td[contenteditable]:focus, .cel-table-content th[contenteditable]:focus {
    outline:2px solid var(--sl-primary,#818cf8); outline-offset:-2px;
    background:color-mix(in srgb, var(--sl-primary,#818cf8) 12%, transparent);
}
/* ── Mermaid element ── */
.cel-mermaid-content { width:100%; height:100%; overflow:auto; display:flex; align-items:center; justify-content:center; background:var(--sl-slide-bg,#1a1d27); border-radius:8px; }
.cel-mermaid-render { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
.cel-mermaid-render svg { max-width:100%; max-height:100%; }
.cel-mermaid-src { font-size:11px; color:var(--sl-muted); }
/* ── LaTeX element ── */
.cel-latex-content { overflow:hidden; }
.cel-latex-render .katex { font-size:inherit; }
/* ── Timer element ── */
.cel-timer-btn { width:32px; height:32px; border-radius:50%; border:1px solid var(--sl-border,#2d3347); background:var(--sl-surface,#1e2133); color:var(--sl-text,#e2e8f0); cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
.cel-timer-btn:hover { background:var(--sl-primary,#818cf8); color:#fff; }
/* ── Highlight code element ── */
.cel-highlight-content { width:100%; height:100%; display:flex; flex-direction:column; gap:6px; }
.cel-highlight-content .cel-code-terminal { flex:1; min-height:0; }
.cel-hl-wrap { display:inline; }
.cel-hl-line { background:rgba(129,140,248,0.18); display:inline; border-left:3px solid #818cf8; margin-left:-1rem; padding-left:calc(1rem - 3px); }
.cel-hl-legend { display:flex; gap:8px; flex-wrap:wrap; padding:2px 4px; }
.cel-hl-legend-item { font-size:11px; color:var(--sl-muted,#64748b); background:rgba(129,140,248,0.1); padding:2px 8px; border-radius:4px; border:1px solid rgba(129,140,248,0.2); cursor:default; }
/* ── QR code element ── */
.cel-qrcode-content { box-sizing:border-box; }
.cel-qr-render svg { display:block; }
/* ── SmartArt elements ── */
.cel-smartart { width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box; gap:8px; }
.cel-sa-process { flex-wrap:nowrap; }
.cel-sa-step { flex:1; min-width:0; padding:12px 16px; border:2px solid var(--sa-color,#818cf8); border-radius:10px; text-align:center; color:var(--sl-text,#e2e8f0); font-size:14px; background:color-mix(in srgb,var(--sa-color,#818cf8) 8%,var(--sl-slide-bg,#1a1d27)); display:flex; align-items:center; justify-content:center; }
.cel-sa-arrow { color:var(--sa-color,#818cf8); font-size:24px; flex-shrink:0; opacity:0.7; }
.cel-sa-cycle { position:relative; min-height:200px; }
.cel-sa-cycle-ring { position:absolute; top:15%; left:15%; width:70%; height:70%; border:2px dashed; border-radius:50%; opacity:0.3; }
.cel-sa-node { position:absolute; transform:translate(-50%,-50%); padding:8px 14px; border:2px solid; border-radius:20px; font-size:13px; color:var(--sl-text,#e2e8f0); background:color-mix(in srgb,var(--sa-color,#818cf8) 10%,var(--sl-slide-bg,#1a1d27)); white-space:nowrap; }
.cel-sa-pyramid { flex-direction:column; gap:4px; }
.cel-sa-pyrow { padding:10px; border-radius:6px; text-align:center; color:var(--sl-text,#e2e8f0); font-size:14px; margin:0 auto; }
.cel-sa-matrix { display:grid !important; grid-template-columns:repeat(var(--sa-cols,2),1fr); gap:8px; }
.cel-sa-cell { padding:12px; border:2px solid; border-radius:8px; text-align:center; color:var(--sl-text,#e2e8f0); font-size:14px; background:color-mix(in srgb,var(--sa-color,#818cf8) 8%,var(--sl-slide-bg,#1a1d27)); display:flex; align-items:center; justify-content:center; }
/* ── Code Live element ── */
.cel-codelive-content { width:100%; height:100%; display:flex; flex-direction:column; border-radius:8px; overflow:hidden; border:1px solid var(--sl-border,#2d3347); box-sizing:border-box; }
.cel-codelive-header { display:flex; align-items:center; gap:8px; padding:6px 12px; background:color-mix(in srgb,var(--sl-surface,#1e2130) 90%,#000); border-bottom:1px solid var(--sl-border,#2d3347); }
.cel-codelive-lang { font-size:0.7rem; color:var(--sl-muted,#64748b); font-family:var(--sl-font-mono,monospace); text-transform:uppercase; }
.cel-codelive-label { margin-left:auto; font-size:0.7rem; font-weight:600; color:var(--sl-primary,#818cf8); }
.cel-codelive-body { display:flex; flex:1; min-height:0; }
.cel-codelive-editor { flex:1; overflow:auto; background:var(--sl-slide-bg,#1a1d27); }
.cel-codelive-editor pre { margin:0; padding:10px; font-size:12px; font-family:var(--sl-font-mono,monospace); color:var(--sl-text,#e2e8f0); }
.cel-codelive-output { flex:0 0 35%; border-left:1px solid var(--sl-border,#2d3347); background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000); display:flex; flex-direction:column; }
.cel-codelive-output-label { display:block; padding:4px 10px; font-size:0.6rem; color:var(--sl-muted,#64748b); text-transform:uppercase; border-bottom:1px solid var(--sl-border,#2d3347); }
.cel-codelive-console { flex:1; margin:0; padding:8px; font-size:11px; color:var(--sl-muted,#64748b); font-family:var(--sl-font-mono,monospace); overflow:auto; }
/* ── Quiz Live element ── */
.cel-quizlive-content { width:100%; height:100%; display:flex; flex-direction:column; padding:12px; box-sizing:border-box; gap:8px; }
.cel-quizlive-header { display:flex; align-items:center; gap:8px; }
.cel-quizlive-icon { width: 16px; height: 16px; display:inline-flex; color: var(--sl-primary,#818cf8); }
.cel-quizlive-timer { margin-left:auto; font-family:var(--sl-font-mono,monospace); font-size:0.85rem; color:var(--sl-muted,#64748b); }
.cel-quizlive-question { font-size:0.9rem; font-weight:600; color:var(--sl-heading,#f1f5f9); line-height:1.3; }
.cel-quizlive-options { display:flex; flex-direction:column; gap:5px; flex:1; overflow:auto; }
.cel-quizlive-option { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--sl-border,#2d3347); border-radius:6px; font-size:0.75rem; color:var(--sl-text,#e2e8f0); }
.cel-quizlive-letter { width:22px; height:22px; border-radius:50%; background:color-mix(in srgb,var(--sl-primary,#818cf8) 15%,var(--sl-slide-bg,#1a1d27)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.7rem; color:var(--sl-primary,#818cf8); flex-shrink:0; }
.cel-quizlive-footer { font-size:0.6rem; color:var(--sl-muted,#64748b); text-align:center; margin-top:auto; }
        `;
        document.head.appendChild(s);
    }

    /* =========================================================
       INSTANCE
       ========================================================= */

    constructor(container, { scale = 1, onChange = () => {}, onSelect = () => {}, scriptBasePath = '../shared/components/' } = {}) {
        this.scriptBasePath = scriptBasePath;
        CanvasEditor.ensureStyles();
        this.container = container;
        this.elements = [];
        this.selectedId = null;
        this.selectedIds = new Set();
        this.scale = scale;
        this.typography = SlidesShared.resolveTypographyDefaults(null);
        this.onChange = onChange;
        this.onSelect = onSelect;
        this._drag = null;
        this._resize = null;
        this.connectors = [];
        this._connectorMode = false;
        this._connCreation = null;        // { sourceId, sourceAnchor }
        this._selectedConnectorId = null;
        this.onConnectorSelect = () => {};
        this._marquee = null;
        this._marqueeDiv = null;
        this._gridSize = 0;   // 0 = off, otherwise pixels (e.g. 20, 40, 80)
        this._showGrid = false;
        this._mouseBoundMove = this._onMouseMove.bind(this);
        this._mouseBoundUp   = this._onMouseUp.bind(this);
        document.addEventListener('mousemove', this._mouseBoundMove);
        document.addEventListener('mouseup',   this._mouseBoundUp);

        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.style.userSelect = 'none';
        container.addEventListener('mousedown', e => {
            if (e.target === container || e.target.classList.contains('canvas-guide-layer')) {
                if (!e.shiftKey) this.select(null);
                // Start marquee selection
                const rect = container.getBoundingClientRect();
                const sx = (e.clientX - rect.left) / this.scale;
                const sy = (e.clientY - rect.top) / this.scale;
                this._marquee = { startX: sx, startY: sy, active: true, shift: e.shiftKey };
                if (!this._marqueeDiv) {
                    this._marqueeDiv = document.createElement('div');
                    this._marqueeDiv.className = 'cel-marquee';
                    container.appendChild(this._marqueeDiv);
                }
                this._marqueeDiv.style.display = 'none';
                e.preventDefault();
            }
        });

        // Guide layer
        const gl = document.createElement('div');
        gl.className = 'canvas-guide-layer';
        container.appendChild(gl);
    }

    destroy() {
        document.removeEventListener('mousemove', this._mouseBoundMove);
        document.removeEventListener('mouseup',   this._mouseBoundUp);
    }

    setScale(s) { this.scale = s; }

    setTypography(typography = null) {
        const prev = this.typography || SlidesShared.resolveTypographyDefaults(null);
        const next = SlidesShared.resolveTypographyDefaults(typography);
        if (prev.heading === next.heading && prev.text === next.text) return;
        this.typography = next;
        for (const el of this.elements) this._refreshDOM(el.id);
        this._refreshConnectors();
    }

    /* ── Grid ──────────────────────────────────────────────── */
    setGrid(size, show) {
        this._gridSize = size || 0;
        this._showGrid = show !== undefined ? show : (size > 0);
        this._renderGridOverlay();
    }
    toggleGrid() {
        if (this._gridSize === 0) this._gridSize = 40;
        this._showGrid = !this._showGrid;
        this._renderGridOverlay();
        return this._showGrid;
    }
    _renderGridOverlay() {
        let overlay = this.container.querySelector('.canvas-grid-overlay');
        if (!this._showGrid || this._gridSize <= 0) {
            if (overlay) overlay.remove();
            return;
        }
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.className = 'canvas-grid-overlay';
            overlay.width = 1280; overlay.height = 720;
            this.container.insertBefore(overlay, this.container.firstChild);
        }
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, 1280, 720);
        const g = this._gridSize;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let x = g; x < 1280; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, 720); }
        for (let y = g; y < 720; y += g) { ctx.moveTo(0, y); ctx.lineTo(1280, y); }
        ctx.stroke();
        // Draw heavier lines at 4× intervals
        const g4 = g * 4;
        if (g4 < 1280) {
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = g4; x < 1280; x += g4) { ctx.moveTo(x, 0); ctx.lineTo(x, 720); }
            for (let y = g4; y < 720; y += g4) { ctx.moveTo(0, y); ctx.lineTo(1280, y); }
            ctx.stroke();
        }
    }

    /* ── Data ─────────────────────────────────────────────── */

    load(elements, bg, connectors, slideIndex = 0, typography = null) {
        this.elements = JSON.parse(JSON.stringify(elements || []));
        // Filter out legacy connector elements (pre-v2)
        this.elements = this.elements.filter(e => e.type !== 'connector');
        this.connectors = JSON.parse(JSON.stringify(connectors || []));
        this.slideIndex = slideIndex;
        this.typography = SlidesShared.resolveTypographyDefaults(typography);
        this.selectedId = null;
        this.selectedIds.clear();
        this._selectedConnectorId = null;
        this._connCreation = null;
        this._captionRegistry = null;
        this._renderAll(bg);
    }

    /** Set the caption registry for cross-reference resolution. */
    setCaptionRegistry(registry) {
        this._captionRegistry = registry;
    }

    serialize() {
        return {
            elements: JSON.parse(JSON.stringify(this.elements)),
            connectors: JSON.parse(JSON.stringify(this.connectors)),
        };
    }

    getSelected() {
        return this.selectedId ? this.elements.find(e => e.id === this.selectedId) || null : null;
    }

    _isElementLocked(el) {
        return CanvasSelectionRuntime.isElementLocked(el);
    }

    _syncLockVisual(div, el) {
        CanvasSelectionRuntime.syncLockVisual({
            div,
            el,
            isElementLocked: candidate => this._isElementLocked(candidate),
            documentRef: document,
        });
    }

    add(type) {
        const el = CanvasEditor.defaultElement(type);
        el.z = this.elements.reduce((max, e) => Math.max(max, e.z || 0), 0) + 1;
        this.elements.push(el);
        this._addElementDOM(el);
        this.select(el.id);
        this.onChange(this.serialize());
        return el;
    }

    remove(id) {
        const el = this.elements.find(e => e.id === id);
        if (this._isElementLocked(el)) return;
        const dom = this._dom(id);
        if (dom) dom.remove();
        this.elements = this.elements.filter(e => e.id !== id);
        // Remove connectors referencing this element
        this.connectors = this.connectors.filter(c => c.sourceId !== id && c.targetId !== id);
        this.selectedIds.delete(id);
        if (this.selectedId === id) {
            this.selectedId = null;
            this.onSelect(null);
        }
        this._refreshConnectors();
        this.onChange(this.serialize());
    }

    updateData(id, patch) {
        const el = this.elements.find(e => e.id === id);
        if (!el) return;
        const keys = Object.keys(patch || {});
        const isLockToggleOnly = keys.length === 1 && keys[0] === 'locked';
        if (this._isElementLocked(el) && !isLockToggleOnly && keys.length > 0) return;
        if ('x' in patch) el.x = +patch.x;
        if ('y' in patch) el.y = +patch.y;
        if ('w' in patch) el.w = +patch.w;
        if ('h' in patch) el.h = +patch.h;
        if ('z' in patch) el.z = +patch.z;
        if ('locked' in patch) el.locked = !!patch.locked;
        if (patch.data)  Object.assign(el.data || (el.data = {}), patch.data);
        if (patch.style) Object.assign(el.style || (el.style = {}), patch.style);
        if ('animation' in patch) el.animation = patch.animation;
        this._refreshDOM(id);
        this.onChange(this.serialize());
    }

    select(id) {
        this.selectedId = id;
        this.selectedIds.clear();
        if (id) {
            this.selectedIds.add(id);
            // Auto-select all group members
            const el = this.elements.find(e => e.id === id);
            if (el?.groupId) {
                for (const e of this.elements) {
                    if (e.groupId === el.groupId) this.selectedIds.add(e.id);
                }
            }
        }
        // Deselect any selected connector
        if (this._selectedConnectorId) {
            this._selectedConnectorId = null;
            this._refreshConnectors();
        }
        this._updateSelectionVisuals();
        this.onSelect(id ? (this.elements.find(e => e.id === id) || null) : null);
    }

    toggleSelect(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
            if (this.selectedId === id) {
                this.selectedId = this.selectedIds.size > 0 ? [...this.selectedIds][0] : null;
            }
        } else {
            this.selectedIds.add(id);
            this.selectedId = id;
        }
        this._updateSelectionVisuals();
        this.onSelect(this.selectedId ? (this.elements.find(e => e.id === this.selectedId) || null) : null);
    }

    selectAllElements() {
        this.selectedIds.clear();
        for (const el of this.elements) this.selectedIds.add(el.id);
        this.selectedId = this.elements.length > 0 ? this.elements[this.elements.length - 1].id : null;
        this._updateSelectionVisuals();
        this.onSelect(this.selectedId ? (this.elements.find(e => e.id === this.selectedId) || null) : null);
    }

    getSelectedElements() {
        return this.elements.filter(e => this.selectedIds.has(e.id));
    }

    fitToContent(id) {
        const el = this.elements.find(e => e.id === (id || this.selectedId));
        if (!el) return;
        const dom = this.container.querySelector(`[data-id="${el.id}"] .cel-inner`);
        if (!dom) return;
        // Temporarily remove height constraint to measure natural height
        const prev = dom.parentElement.style.height;
        dom.parentElement.style.height = 'auto';
        const natural = dom.scrollHeight + 10; // +10 for padding
        dom.parentElement.style.height = prev;
        if (natural > 20 && natural !== el.h) {
            this.updateData(el.id, { h: Math.max(40, Math.round(natural)) });
        }
    }

    ungroupSelected() {
        const selected = this.getSelectedElements().filter(el => !this._isElementLocked(el));
        if (!selected.length) return false;
        let ungrouped = false;
        for (const el of selected) {
            if (el.groupId) {
                delete el.groupId;
                ungrouped = true;
            }
        }
        if (ungrouped) {
            this._updateSelectionVisuals();
            this.onChange(this.serialize());
        }
        return ungrouped;
    }

    groupSelected() {
        const selected = this.getSelectedElements().filter(el => !this._isElementLocked(el));
        if (selected.length < 2) return false;
        const gid = 'grp_' + Math.random().toString(36).slice(2, 8);
        for (const el of selected) el.groupId = gid;
        this._updateSelectionVisuals();
        this.onChange(this.serialize());
        return true;
    }

    _updateSelectionVisuals() {
        CanvasSelectionRuntime.updateSelectionVisuals({
            container: this.container,
            selectedIds: this.selectedIds,
            elements: this.elements,
            documentRef: document,
        });
    }

    /* ── Rendering ────────────────────────────────────────── */

    _renderAll(bg) {
        const result = CanvasRenderRuntime.renderAll({
            container: this.container,
            bg,
            elements: this.elements,
            marqueeDiv: this._marqueeDiv,
            addElementDOM: el => this._addElementDOM(el),
            refreshConnectors: () => this._refreshConnectors(),
            onConnectorMouseDown: connId => this.selectConnector(connId),
            resolveConnector: connId => this.connectors.find(conn => conn.id === connId) || null,
            onConnectorDblClick: (conn, event) => {
                if (conn && this.onConnectorDblClick) this.onConnectorDblClick(conn, event);
            },
            documentRef: document,
        });
        this._connOverlay = result.connOverlay || null;
        this._marqueeDiv = result.marqueeDiv || null;
    }

    _addElementDOM(el) {
        const div = document.createElement('div');
        div.className = 'cel';
        div.dataset.id = el.id;
        div.dataset.type = el.type;
        div.style.left = `${el.x}px`;
        div.style.top = `${el.y}px`;
        div.style.width = `${el.w}px`;
        div.style.height = `${el.h}px`;
        div.style.zIndex = String(el.z || 1);
        if (el.style?.rotate) div.style.transform = `rotate(${el.style.rotate}deg)`;
        else div.style.removeProperty('transform');
        const inner = document.createElement('div');
        inner.className = 'cel-inner';
        inner.innerHTML = this._renderContent(el);
        div.appendChild(inner);
        ['nw','n','ne','e','se','s','sw','w'].forEach(pos => {
            const h = document.createElement('div');
            h.className = `cel-handle cel-handle-${pos}`;
            h.dataset.handle = pos;
            div.appendChild(h);
        });
        // Connector anchor points
        ['top','right','bottom','left'].forEach(anchor => {
            const a = document.createElement('div');
            a.className = `cel-anchor cel-anchor-${anchor}`;
            a.dataset.anchor = anchor;
            a.dataset.elId = el.id;
            div.appendChild(a);
        });
        this._bindElementEvents(div, el.id);
        this._syncLockVisual(div, el);
        // Insert before guide layer
        const guide = this.container.querySelector('.canvas-guide-layer');
        this.container.insertBefore(div, guide);
        if (el.type === 'widget') this._mountWidget(div, el);
        if (el.type === 'code' || el.type === 'highlight' || el.type === 'code-example' || el.type === 'terminal-session') this._highlightCodeBlock(div);
        this._postRenderElement(el);
        requestAnimationFrame(() => this._updateOverflowVisual(div, el));
        return div;
    }

    _postRenderElement(el) {
        if (el.type === 'mermaid') this._renderMermaidElements();
        if (el.type === 'latex')   this._renderLatexElements();
        if (el.type === 'qrcode')  this._renderQRElements();
        if (el.type === 'timer')   this._initTimerElements();
    }

    _shouldCheckOverflow(el) {
        return CanvasOverflowRuntime.shouldCheckOverflow(el);
    }

    _updateOverflowVisual(div, el) {
        CanvasOverflowRuntime.updateOverflowVisual({
            div,
            el,
            documentRef: document,
            shouldCheckOverflow: candidate => this._shouldCheckOverflow(candidate),
        });
    }

    _renderContent(el) {
        // Rebuild caption entry for this element from local elements
        this._updateCaptionEntry(el);
        const body = this._renderContentInner(el);
        const caption = SlidesShared.renderCaptionHtml(el, 'cel');
        return body + caption;
    }

    /** Recompute _captionEntry for a single element based on current elements order. */
    _updateCaptionEntry(el) {
        if (!el.data?.caption && !el.data?.refLabel) { delete el._captionEntry; return; }
        // Count elements of same caption-prefix type that appear before this one
        const prefix = SlidesShared.CAPTION_PREFIXES[el.type] || '';
        let number = null;
        if (prefix && el.data?.caption) {
            number = 0;
            for (const e of this.elements) {
                const p = SlidesShared.CAPTION_PREFIXES[e.type] || '';
                if (p === prefix && e.data?.caption) {
                    number++;
                    if (e.id === el.id) break;
                }
            }
        }
        el._captionEntry = { prefix, number, caption: el.data.caption || '', elementId: el.id };
        // Update the external registry if present
        if (el.data?.refLabel && this._captionRegistry) {
            this._captionRegistry[el.data.refLabel] = el._captionEntry;
        }
    }

    _renderContentInner(el) {
        switch (el.type) {
            case 'heading':
            case 'text': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize(el.type, s, this.typography, 22);
                const vAlign = s.verticalAlign || 'top';
                const vAlignCSS = vAlign === 'middle' ? 'display:flex;flex-direction:column;justify-content:center;'
                    : vAlign === 'bottom' ? 'display:flex;flex-direction:column;justify-content:flex-end;'
                    : '';
                const extras = [
                    s.fontStyle     ? `font-style:${s.fontStyle};`         : '',
                    s.textTransform ? `text-transform:${s.textTransform};` : '',
                    s.letterSpacing ? `letter-spacing:${s.letterSpacing};` : '',
                    s.opacity != null ? `opacity:${s.opacity};`            : '',
                    s.background    ? `background:${s.background};`        : '',
                ].join('');
                // Use rich HTML if available, otherwise escape plain text
                let body = el.data?.html || SlidesShared.autoFormatText(el.data?.text || '');
                // Replace template variables
                body = body.replace(/\{\{slideNumber\}\}/g, String((this.slideIndex || 0) + 1));
                // Resolve cross-references
                if (this._captionRegistry) body = SlidesShared.resolveRefs(body, this._captionRegistry);
                return `<div class="cel-text-content" style="font-size:${base}px;font-weight:${s.fontWeight||400};color:${s.color||'var(--sl-text)'};text-align:${s.textAlign||'left'};font-family:${s.fontFamily||'var(--sl-font-body)'};line-height:${s.lineHeight||1.35};width:100%;height:100%;box-sizing:border-box;${vAlignCSS}${extras}">${body}</div>`;
            }
            case 'code': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code', s, this.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(label)}</div>
                    <div style="flex:1;min-height:0;--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(el.data?.code || '', el.data?.language || 'text', 'cel')}</div>
                </div>`;
            }
            case 'list': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('list', s, this.typography, 22);
                const items = (el.data?.items || []).map(i => `<li>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                return `<ul class="cel-list-content" style="font-size:${base}px;color:${s.color||'var(--sl-text)'};">${items}</ul>`;
            }
            case 'image': {
                if (el.data?.src) {
                    return `<img src="${escHtml(el.data.src)}" alt="${escHtml(el.data?.alt||'')}" style="width:100%;height:100%;object-fit:contain;">`;
                }
                return `<div class="cel-image-placeholder">
                    <span class="cel-image-placeholder-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><polyline points="21 16 15 10 6 19"/></svg>
                    </span>
                    <span>URL de l'image</span>
                </div>`;
            }
            case 'shape': {
                return CanvasEditor._renderShapeSVG(el, this.typography);
            }
            case 'widget': {
                // Placeholder shown while the widget script loads asynchronously
                return `<div class="cel-widget-loading"><span style="font-size:0.75rem;font-weight:700">WIDGET</span><span>Chargement…</span></div>`;
            }
            case 'definition': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('definition', s, this.typography, 16);
                const blockLabelRaw = String(el.data?.label ?? el.data?.blockLabel ?? 'Definition').trim() || 'Definition';
                const blockLabel = blockLabelRaw;
                const exampleLabel = String(el.data?.exampleLabel ?? 'Exemple').trim() || 'Exemple';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, blockLabelRaw);
                const termSize = Math.round(base * 1.06);
                const bodySize = Math.round(base);
                const exampleSize = Math.round(base * 0.78);
                return `<div class="cel-def-content" style="background:${tone.strongBg};border-left-color:${tone.accent};border-color:${tone.border};">
                    <div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem;">${escHtml(blockLabel)}</div>
                    <div class="cel-def-term" style="font-size:${termSize}px;color:${tone.accent};">${escHtml(el.data?.term||'')}</div>
                    <div class="cel-def-body" style="font-size:${bodySize}px;">${el.data?.definition||''}</div>
                    ${el.data?.example ? `<div class="cel-def-example" style="font-size:${exampleSize}px;">${escHtml(exampleLabel)} : ${escHtml(el.data.example)}</div>` : ''}
                </div>`;
            }
            case 'callout-box': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('callout-box', s, this.typography, 18);
                const labelRaw = String(el.data?.label || 'Info').trim() || 'Info';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:5px solid ${tone.accent};border-radius:8px;padding:0.9rem 1rem;box-sizing:border-box;overflow:auto;">
                    <div style="font-size:${Math.round(base * 0.78)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.45rem;">${escHtml(labelRaw)}</div>
                    <div style="font-size:${base}px;line-height:1.5;color:${s.color || 'var(--sl-text)'};">${el.data?.text || ''}</div>
                </div>`;
            }
            case 'exercise-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('exercise-block', s, this.typography, 18);
                const title = String(el.data?.title || 'Exercice').trim() || 'Exercice';
                const objective = String(el.data?.objective || '').trim();
                const instructions = Array.isArray(el.data?.instructions) ? el.data.instructions : [];
                const hints = Array.isArray(el.data?.hints) ? el.data.hints : [];
                const correction = String(el.data?.correction || '').trim();
                const showCorrection = !!el.data?.showCorrection;
                const liHtml = (items) => items.map((item) => `<li>${escHtml(item)}</li>`).join('');
                return `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 7%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;padding:0.85rem 1rem;box-sizing:border-box;overflow:auto;display:flex;flex-direction:column;gap:0.65rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    ${objective ? `<div style="font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;"><strong style="color:var(--sl-primary,#818cf8);">Objectif :</strong> ${escHtml(objective)}</div>` : ''}
                    ${instructions.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Consignes</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;">${liHtml(instructions)}</ul></div>` : ''}
                    ${hints.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-info,#38bdf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Indices</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.8)}px;color:var(--sl-muted,#94a3b8);line-height:1.4;">${liHtml(hints)}</ul></div>` : ''}
                    ${correction ? `<div style="margin-top:auto;border-top:1px dashed var(--sl-border,#2d3347);padding-top:0.5rem;"><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Correction</div><div style="font-size:${Math.round(base * 0.82)}px;color:${showCorrection ? 'var(--sl-text,#cbd5e1)' : 'var(--sl-muted,#94a3b8)'};line-height:1.4;">${showCorrection ? escHtml(correction) : 'Masquée (activez "Afficher la correction").'}</div></div>` : '' }
                </div>`;
            }
            case 'before-after': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('before-after', s, this.typography, 17);
                const title = String(el.data?.title || 'Avant / Après').trim() || 'Avant / Après';
                const beforeLabel = String(el.data?.beforeLabel || 'Avant').trim() || 'Avant';
                const afterLabel = String(el.data?.afterLabel || 'Après').trim() || 'Après';
                const beforeText = String(el.data?.before || '').trim();
                const afterText = String(el.data?.after || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.55rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,${tone.accent} 34%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,${tone.accent} 10%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;">${escHtml(beforeLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;">${escHtml(beforeText)}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 36%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-success,#22c55e) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">${escHtml(afterLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;">${escHtml(afterText)}</div>
                        </div>
                    </div>
                </div>`;
            }
            case 'mistake-fix': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('mistake-fix', s, this.typography, 17);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.78));
                const title = String(el.data?.title || 'Erreur fréquente vs correction').trim() || 'Erreur fréquente vs correction';
                const lang = String(el.data?.language || 'python').trim() || 'python';
                const mistake = String(el.data?.mistake || '').trim();
                const fix = String(el.data?.fix || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;">
                    <div style="font-size:${Math.round(base * 0.92)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-danger,#ef4444) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-danger,#ef4444) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-danger,#ef4444);text-transform:uppercase;letter-spacing:0.03em;">Erreur fréquente</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;"><code class="language-${escHtml(lang)}">${escHtml(mistake)}</code></pre>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-success,#22c55e) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">Correction</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;"><code class="language-${escHtml(lang)}">${escHtml(fix)}</code></pre>
                        </div>
                    </div>
                </div>`;
            }
            case 'rubric-block':
            case 'rubrick-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('rubric-block', s, this.typography, 16);
                const title = String(el.data?.title || 'Grille d’évaluation').trim() || 'Grille d’évaluation';
                const levels = (Array.isArray(el.data?.levels) ? el.data.levels : [])
                    .map((level) => String(level || '').trim())
                    .filter(Boolean)
                    .slice(0, 5);
                const rowsRaw = Array.isArray(el.data?.rows) ? el.data.rows : [];
                const rows = rowsRaw
                    .map((row) => {
                        const criterion = String(row?.criterion || '').trim();
                        const descriptors = (Array.isArray(row?.descriptors) ? row.descriptors : [])
                            .map((value) => String(value || '').trim())
                            .slice(0, levels.length || 3);
                        return { criterion, descriptors };
                    })
                    .filter((row) => row.criterion || row.descriptors.some(Boolean))
                    .slice(0, 8);
                const safeLevels = levels.length ? levels : ['Niveau 1', 'Niveau 2', 'Niveau 3'];
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                const cellSize = Math.round(base * 0.78);
                let tableHtml = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">`;
                tableHtml += `<tr><th style="padding:6px 8px;text-align:left;border:1px solid ${tone.border};background:color-mix(in srgb,${tone.accent} 20%,transparent);font-size:${cellSize}px;color:var(--sl-heading,#f1f5f9);">Critère</th>`;
                safeLevels.forEach((level) => {
                    tableHtml += `<th style="padding:6px 8px;text-align:left;border:1px solid ${tone.border};background:color-mix(in srgb,${tone.accent} 20%,transparent);font-size:${cellSize}px;color:var(--sl-heading,#f1f5f9);">${escHtml(level)}</th>`;
                });
                tableHtml += `</tr>`;
                rows.forEach((row) => {
                    tableHtml += `<tr><td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;font-weight:600;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 86%,#000);">${escHtml(row.criterion)}</td>`;
                    safeLevels.forEach((_, idx) => {
                        const value = row.descriptors[idx] || '';
                        tableHtml += `<td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;line-height:1.35;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${escHtml(value)}</td>`;
                    });
                    tableHtml += `</tr>`;
                });
                if (!rows.length) {
                    tableHtml += `<tr><td colspan="${safeLevels.length + 1}" style="padding:10px;border:1px solid ${tone.border};font-size:${cellSize}px;color:var(--sl-muted,#94a3b8);text-align:center;">Ajoutez des critères dans le panneau de propriétés.</td></tr>`;
                }
                tableHtml += `</table>`;
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:4px solid ${tone.accent};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;overflow:hidden;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:${tone.accent};">${escHtml(title)}</div>
                    <div style="flex:1;min-height:0;overflow:auto;">${tableHtml}</div>
                </div>`;
            }
            case 'code-example': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code-example', s, this.typography, 16);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.82));
                const data = el.data || {};
                const labelRaw = String(data.label ?? data.blockTitle ?? 'Exemple').trim() || 'Exemple';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(data.labelTone ?? data.tone, labelRaw);
                const body = data.text || '';
                const widgetMode = data.widgetType || 'terminal';
                const widgetHtml = CanvasEditor._renderCodeExampleWidget(data, widgetMode, s, base);
                return `<div class="cel-code-example-content" style="font-size:${base}px;background:${tone.strongBg};border-left-color:${tone.accent};border-color:${tone.border};--ce-accent:${tone.accent};">
                    <div class="cel-code-example-label" style="font-size:${Math.round(base * 1.02)}px;color:${tone.accent};">${escHtml(label)}</div>
                    <div class="cel-code-example-text" style="font-size:${Math.round(base * 0.92)}px;">${body}</div>
                    <div class="cel-code-example-widget" style="--ce-code-font-size:${Math.round(base * 0.82)}px;--ce-code-gutter-size:${Math.round(base * 0.82)}px;--ce-code-lang-size:${Math.round(base * 0.64)}px;--ce-code-line-height:${codeLineHeight};">${widgetHtml}</div>
                </div>`;
            }
            case 'terminal-session': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('terminal-session', s, this.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Session terminal').trim() || 'Session terminal';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const script = String(el.data?.script || '').replace(/\r\n/g, '\n');
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(labelRaw)}</div>
                    <div style="flex:1;min-height:0;--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(script, el.data?.language || 'bash', 'cel')}</div>
                </div>`;
            }
            case 'quote': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('quote', s, this.typography, 26);
                const markSize = Math.round(base * 1.85);
                const authorSize = Math.round(base * 0.48);
                const author = el.data?.author
                    ? `<div style="margin-top:0.75rem;font-size:${authorSize}px;color:var(--sl-primary,#818cf8);font-weight:600;font-style:normal;">— ${escHtml(el.data.author)}</div>`
                    : '';
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 1.5rem;box-sizing:border-box;overflow:hidden;">
                    <div style="font-size:${markSize}px;color:var(--sl-primary,#818cf8);opacity:0.4;line-height:0.7;margin-bottom:0.2rem;">"</div>
                    <div style="font-size:${base}px;font-style:italic;color:${s.color||'var(--sl-heading,#f1f5f9)'};line-height:1.5;font-family:var(--sl-font-body,system-ui);">${escHtml(el.data?.text||'')}</div>
                    ${author}
                </div>`;
            }
            case 'card': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('card', s, this.typography, 18);
                const titleSize = Math.round(base * 0.76);
                const titleRaw = String(el.data?.title || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, titleRaw);
                const cardTitle = el.data?.title
                    ? `<div style="font-size:${titleSize}px;font-weight:700;color:${s.titleColor||tone.accent};border-bottom:1px solid ${tone.border};padding-bottom:0.5rem;margin-bottom:0.75rem;">${escHtml(el.data.title)}</div>`
                    : '';
                const items = (el.data?.items || []).map(i => `<li>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:3px solid ${tone.accent};border-radius:10px;padding:1rem 1.2rem;overflow:auto;box-sizing:border-box;">
                    ${cardTitle}
                    <ul style="margin:0;padding-left:1.4em;font-size:${base}px;color:${s.color||'var(--sl-text,#cbd5e1)'};">${items}</ul>
                </div>`;
            }
            case 'table': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('table', s, this.typography, 18);
                const rows = el.data?.rows || [];
                let html = `<div class="cel-table-content" style="font-size:${base}px;color:${s.color||'var(--sl-text,#cbd5e1)'};"><table>`;
                rows.forEach((row, ri) => {
                    html += '<tr>';
                    const tag = ri === 0 ? 'th' : 'td';
                    (row || []).forEach(cell => { html += `<${tag}>${SlidesShared.formatInlineRichText(cell)}</${tag}>`; });
                    html += '</tr>';
                });
                html += '</table></div>';
                return html;
            }
            case 'video': {
                if (el.data?.embedUrl) {
                    const videoTitle = escHtml(el.data?.alt || el.data?.caption || 'Vidéo intégrée');
                    return `<div style="width:100%;height:100%;background:#000;border-radius:8px;overflow:hidden;"><iframe src="${escHtml(el.data.embedUrl)}" title="${videoTitle}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
                }
                return `<div style="width:100%;height:100%;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.88rem;"><span>URL vidéo non définie</span></div>`;
            }
            case 'mermaid': {
                const code = el.data?.code || '';
                const mermaidId = 'mermaid-' + el.id;
                return `<div class="cel-mermaid-content" data-mermaid-id="${mermaidId}">
                    <div class="cel-mermaid-render" id="${mermaidId}"></div>
                    <pre class="cel-mermaid-src" style="display:none">${escHtml(code)}</pre>
                </div>`;
            }
            case 'diagramme': {
                const s = el.style || {};
                return SlidesShared.renderDiagrammeBlock(el.data || {}, s, this.typography, {
                    prefix: 'cel',
                    fallbackFontSize: 16,
                });
            }
            case 'latex': {
                const s = el.style || {};
                const expr = el.data?.expression || '';
                const base = SlidesShared.resolveElementFontSize('latex', s, this.typography, 32);
                return `<div class="cel-latex-content" style="font-size:${base}px;color:${s.color||'var(--sl-text)'};display:flex;align-items:center;justify-content:center;width:100%;height:100%;" data-latex="${escHtml(expr)}">
                    <span class="cel-latex-render">${escHtml(expr)}</span>
                </div>`;
            }
            case 'timer': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('timer', s, this.typography, 48);
                const dur = el.data?.duration || 300;
                const label = el.data?.label || '';
                const mins = Math.floor(dur / 60);
                const secs = dur % 60;
                const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
                return `<div class="cel-timer-content" data-duration="${dur}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
                    ${label ? `<div style="font-size:${Math.round(base * 0.4)}px;color:var(--sl-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escHtml(label)}</div>` : ''}
                    <div class="cel-timer-display" style="font-size:${base}px;color:${s.color||'var(--sl-heading)'};font-variant-numeric:tabular-nums;font-weight:700;font-family:var(--sl-font-mono,monospace);">${display}</div>
                    <div style="display:flex;gap:0.5rem;margin-top:0.3rem;">
                        <button class="cel-timer-btn cel-timer-start" title="Démarrer">▶</button>
                        <button class="cel-timer-btn cel-timer-pause" title="Pause" style="display:none">⏸</button>
                        <button class="cel-timer-btn cel-timer-reset" title="Réinitialiser">↺</button>
                    </div>
                </div>`;
            }
            case 'iframe': {
                const url = el.data?.url;
                const title = el.data?.title || 'Contenu embarqué';
                if (url) {
                    return `<div style="width:100%;height:100%;border-radius:8px;overflow:hidden;border:1px solid var(--sl-border);display:flex;flex-direction:column;">
                        <div style="background:var(--sl-surface);padding:4px 10px;font-size:12px;color:var(--sl-muted);display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--sl-border);">⧉ <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(url)}</span></div>
                        <iframe src="${escHtml(url)}" style="flex:1;border:none;background:#fff;" title="${escHtml(title)}" sandbox="allow-scripts allow-same-origin"></iframe>
                    </div>`;
                }
                return `<div style="width:100%;height:100%;border-radius:8px;border:2px dashed var(--sl-border);display:flex;align-items:center;justify-content:center;color:var(--sl-muted);font-size:1.1rem;flex-direction:column;gap:0.5rem;"><span style="font-size:2rem">⧉</span><span>URL non définie</span></div>`;
            }
            case 'highlight': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('highlight', s, this.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const highlights = el.data?.highlights || [];
                const lines = code.split('\n');
                let html = `<div class="cel-highlight-content"><div class="cel-code-terminal" style="--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};"><div class="cel-code-tbar"><div class="cel-code-dot cel-code-dot-r"></div><div class="cel-code-dot cel-code-dot-y"></div><div class="cel-code-dot cel-code-dot-g"></div><span class="cel-code-tbar-lang">${escHtml(lang)}</span><span style="margin-left:auto;font-size:${Math.round(base * 0.58)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(label)}</span></div><div class="cel-code-scroll"><pre><code class="language-${escHtml(lang)}">`;
                lines.forEach((line, i) => {
                    const ln = i + 1;
                    const cls = highlights.some(h => CanvasEditor._lineInRange(ln, h.lines)) ? ' cel-hl-line' : '';
                    html += `<span class="cel-hl-wrap${cls}" data-line="${ln}">${escHtml(line)}\n</span>`;
                });
                html += `</code></pre></div></div>`;
                if (highlights.length > 0) {
                    html += `<div class="cel-hl-legend">`;
                    highlights.forEach((h, i) => {
                        html += `<span class="cel-hl-legend-item" data-hl="${i}">L${h.lines} ${h.label ? '— '+escHtml(h.label) : ''}</span>`;
                    });
                    html += `</div>`;
                }
                html += `</div>`;
                return html;
            }
            case 'qrcode': {
                const val = el.data?.value || '';
                const label = el.data?.label || '';
                const alt = escHtml(el.data?.alt || label || val || 'QR code');
                return `<div class="cel-qrcode-content" data-qr-value="${escHtml(val)}" role="img" aria-label="${alt}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;">
                    <div class="cel-qr-render" style="width:80%;aspect-ratio:1;max-height:80%;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;padding:8px;"></div>
                    ${label ? `<div style="font-size:14px;color:var(--sl-muted);text-align:center;">${escHtml(label)}</div>` : ''}
                </div>`;
            }
            case 'smartart': {
                const variant = el.data?.variant || 'process';
                const items = el.data?.items || [];
                const color = el.style?.color || 'var(--sl-primary)';
                return CanvasEditor._renderSmartArt(variant, items, color);
            }
            case 'code-live': {
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                return `<div class="cel-codelive-content">
                    <div class="cel-codelive-header">
                        <span class="cel-codelive-lang">${escHtml(lang)}</span>
                        <span class="cel-codelive-label">▶ Code Live</span>
                    </div>
                    <div class="cel-codelive-body">
                        <div class="cel-codelive-editor"><pre><code>${escHtml(code)}</code></pre></div>
                        <div class="cel-codelive-output"><span class="cel-codelive-output-label">Sortie</span><pre class="cel-codelive-console"></pre></div>
                    </div>
                </div>`;
            }
            case 'quiz-live': {
                const q = el.data?.question || '';
                const opts = el.data?.options || [];
                const dur = el.data?.duration || 30;
                const label = String(el.data?.label ?? 'Quiz').trim() || 'Quiz';
                const optHtml = opts.map((o, i) => `<div class="cel-quizlive-option"><span class="cel-quizlive-letter">${String.fromCharCode(65 + i)}</span>${escHtml(o)}</div>`).join('');
                return `<div class="cel-quizlive-content">
                    <div class="cel-quizlive-header">
                        <span class="cel-quizlive-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></span>
                        <span>${escHtml(label)}</span>
                        <span class="cel-quizlive-timer">${dur}s</span>
                    </div>
                    <div class="cel-quizlive-question">${escHtml(q)}</div>
                    <div class="cel-quizlive-options">${optHtml}</div>
                    <div class="cel-quizlive-footer">Les étudiants répondent via QR code</div>
                </div>`;
            }
            case 'cloze': {
                const sentence = String(el.data?.sentence || '');
                const safeSentence = escHtml(sentence);
                const rendered = safeSentence.includes('____')
                    ? safeSentence.replace(/____/g, '<span style="border-bottom:2px dashed var(--sl-primary,#818cf8);padding:0 10px;color:transparent">___</span>')
                    : safeSentence;
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;background:color-mix(in srgb,var(--sl-primary,#818cf8) 6%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;">Texte à trous</div>
                    <div style="font-size:1rem;line-height:1.45;color:var(--sl-text,#e2e8f0);">${rendered}</div>
                    <div style="margin-top:auto;font-size:0.68rem;color:var(--sl-muted,#64748b);">Interaction en présentation</div>
                </div>`;
            }
            case 'mcq-single': {
                const q = el.data?.question || '';
                const opts = Array.isArray(el.data?.options) ? el.data.options : [];
                const label = String(el.data?.label ?? 'QCM simple').trim() || 'QCM simple';
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:50%;"></span>${escHtml(o || `Option ${i + 1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${escHtml(label)}</div>
                    <div style="font-size:0.85rem;color:var(--sl-heading,#f1f5f9);">${escHtml(q)}</div>
                    <div style="display:flex;flex-direction:column;gap:5px;overflow:auto;">${optHtml}</div>
                </div>`;
            }
            case 'drag-drop': {
                const items = Array.isArray(el.data?.items) ? el.data.items : [];
                const targets = Array.isArray(el.data?.targets) ? el.data.targets : [];
                const itemHtml = items.slice(0, 4).map(i => `<div style="padding:5px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 75%,#000);font-size:0.72rem;">${escHtml(i)}</div>`).join('');
                const targetHtml = targets.slice(0, 3).map(t => `<div style="flex:1;min-height:52px;border:1px dashed var(--sl-border,#2d3347);border-radius:8px;padding:6px;font-size:0.68rem;color:var(--sl-muted,#64748b);">${escHtml(t)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Drag & Drop</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">${itemHtml}</div>
                    <div style="display:flex;gap:6px;min-height:0;flex:1;">${targetHtml}</div>
                </div>`;
            }
            case 'mcq-multi': {
                const q = el.data?.question || '';
                const opts = Array.isArray(el.data?.options) ? el.data.options : [];
                const label = String(el.data?.label ?? 'QCM multi').trim() || 'QCM multi';
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:3px;"></span>${escHtml(o || `Option ${i+1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${escHtml(label)}</div>
                    <div style="font-size:0.85rem;color:var(--sl-heading,#f1f5f9);">${escHtml(q)}</div>
                    <div style="display:flex;flex-direction:column;gap:5px;overflow:auto;">${optHtml}</div>
                </div>`;
            }
            case 'poll-likert': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 9%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">Likert live (1-5)</div>
                    <div style="font-size:0.9rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:auto;">${[1,2,3,4,5].map(n => `<div style="padding:7px 0;border:1px solid var(--sl-border,#2d3347);border-radius:7px;text-align:center;font-weight:700;color:var(--sl-muted,#64748b);">${n}</div>`).join('')}</div>
                </div>`;
            }
            case 'debate-mode': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 9%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">Débat live</div>
                    <div style="font-size:0.9rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;">
                        <div style="padding:8px;border:1px solid rgba(52,211,153,0.45);border-radius:8px;text-align:center;color:#34d399;font-weight:700;">Pour</div>
                        <div style="padding:8px;border:1px solid rgba(248,113,113,0.45);border-radius:8px;text-align:center;color:#f87171;font-weight:700;">Contre</div>
                    </div>
                </div>`;
            }
            case 'exit-ticket': {
                const title = escHtml(el.data?.title || 'Exit ticket');
                const prompts = Array.isArray(el.data?.prompts) ? el.data.prompts : [];
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${title}</div>
                    ${(prompts.slice(0, 4).map((p, i) => `<div style="padding:7px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);font-size:0.72rem;"><strong>${i + 1}.</strong> ${escHtml(p)}</div>`).join(''))}
                </div>`;
            }
            case 'postit-wall': {
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">Mur Post-it live</div>
                    <div style="font-size:0.86rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:1;">
                        <div style="background:#fde68a;color:#78350f;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 1</div>
                        <div style="background:#bfdbfe;color:#1e3a8a;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 2</div>
                        <div style="background:#bbf7d0;color:#14532d;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 3</div>
                    </div>
                </div>`;
            }
            case 'audience-roulette': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">Roulette audience</div>
                    <div style="font-size:1rem;color:var(--sl-heading,#f1f5f9);text-align:center;">${escHtml(el.data?.title || 'Roulette participants')}</div>
                    <div style="font-size:0.72rem;color:var(--sl-muted,#64748b);">Tirage aléatoire pendant la présentation</div>
                </div>`;
            }
            case 'room-stats': {
                const metrics = Array.isArray(el.data?.metrics) ? el.data.metrics : ['students', 'hands', 'questions', 'feedback'];
                const labels = {
                    students: 'Connectés',
                    hands: 'Mains levées',
                    questions: 'Questions',
                    feedback: 'Feedback 10min',
                    poll: 'Sondage actif',
                    wordcloud: 'Nuage actif',
                };
                const cards = metrics.slice(0, 6).map(key => `
                    <div style="padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000);">
                        <div style="font-size:0.64rem;color:var(--sl-muted,#64748b);text-transform:uppercase;">${escHtml(labels[key] || key)}</div>
                        <div style="font-size:1.05rem;color:var(--sl-heading,#f1f5f9);font-weight:700;margin-top:2px;">--</div>
                    </div>
                `).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">${escHtml(el.data?.title || 'Stats live')}</div>
                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;min-height:0;">${cards}</div>
                    <div style="font-size:0.66rem;color:var(--sl-muted,#64748b);">Mis à jour en mode présentateur</div>
                </div>`;
            }
            case 'leaderboard-live': {
                const title = escHtml(el.data?.title || 'Leaderboard live');
                const limit = Math.max(3, Math.min(10, Number(el.data?.limit || 5)));
                const rows = Array.from({ length: limit }).map((_, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="width:22px;font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="flex:1;color:var(--sl-text,#e2e8f0);font-size:0.72rem;">Étudiant</span>
                        <span style="color:var(--sl-heading,#f1f5f9);font-weight:700;font-size:0.72rem;">0</span>
                    </div>
                `).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;overflow:auto;">${rows}</div>
                </div>`;
            }
            case 'swot-grid': {
                const toItems = list => (Array.isArray(list) ? list : []).slice(0, 3).map(it => `<li>${escHtml(it)}</li>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;">
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(52,211,153,0.09);font-size:0.68rem;"><strong>Forces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.strength)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(248,113,113,0.4);background:rgba(248,113,113,0.09);font-size:0.68rem;"><strong>Faiblesses</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.weakness)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(14,165,233,0.4);background:rgba(14,165,233,0.09);font-size:0.68rem;"><strong>Opportunités</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.opportunity)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.09);font-size:0.68rem;"><strong>Menaces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.threat)}</ul></div>
                </div>`;
            }
            case 'decision-tree': {
                const root = escHtml(el.data?.root || '');
                const branches = Array.isArray(el.data?.branches) ? el.data.branches : [];
                const bHtml = branches.slice(0, 4).map(b => `<div style="padding:6px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.7rem;"><strong>${escHtml(b.label || 'Branche')}</strong><div style="color:var(--sl-muted,#64748b);margin-top:2px;">${escHtml(b.outcome || '')}</div></div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#ec4899;text-transform:uppercase;">Arbre de décision</div>
                    <div style="padding:8px;border:1px solid rgba(236,72,153,0.45);border-radius:8px;text-align:center;font-size:0.84rem;">${root}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow:auto;">${bHtml}</div>
                </div>`;
            }
            case 'timeline-vertical': {
                const steps = Array.isArray(el.data?.steps) ? el.data.steps : [];
                const html = steps.slice(0, 6).map((s, i) => `<div style="display:flex;gap:8px;align-items:flex-start;">
                        <span style="width:16px;height:16px;border-radius:50%;background:color-mix(in srgb,#ec4899 20%,var(--sl-slide-bg,#1a1d27));border:1px solid #ec4899;display:inline-flex;align-items:center;justify-content:center;font-size:0.62rem;color:#ec4899;">${i+1}</span>
                        <span style="font-size:0.74rem;color:var(--sl-text,#e2e8f0);">${escHtml(s)}</span>
                    </div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#ec4899;text-transform:uppercase;">Timeline verticale</div>
                    <div style="display:flex;flex-direction:column;gap:7px;overflow:auto;">${html}</div>
                </div>`;
            }
            case 'code-compare': {
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:auto;"><div style="padding:4px 8px;font-size:0.66rem;color:var(--sl-muted,#64748b);border-bottom:1px solid var(--sl-border,#2d3347);">Avant</div><pre style="margin:0;padding:8px;font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(el.data?.before || '')}</pre></div>
                    <div style="border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:auto;"><div style="padding:4px 8px;font-size:0.66rem;color:var(--sl-muted,#64748b);border-bottom:1px solid var(--sl-border,#2d3347);">Après</div><pre style="margin:0;padding:8px;font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(el.data?.after || '')}</pre></div>
                </div>`;
            }
            case 'algo-stepper': {
                const steps = Array.isArray(el.data?.steps) ? el.data.steps : [];
                const first = steps[0] || {};
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#22c55e;text-transform:uppercase;">Algo stepper</div>
                    <div style="font-size:0.83rem;color:var(--sl-heading,#f1f5f9);">${escHtml(first.title || 'Étape 1')}</div>
                    <div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">${escHtml(first.detail || '')}</div>
                    <pre style="margin:0;margin-top:auto;padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(first.code || '')}</pre>
                </div>`;
            }
            case 'gallery-annotable': {
                const src = String(el.data?.src || '').trim();
                const alt = escHtml(el.data?.alt || el.data?.caption || 'Image annotée');
                const notes = Array.isArray(el.data?.notes) ? el.data.notes : [];
                const points = notes.slice(0, 8).map((n, i) => `<span style="position:absolute;left:${Math.max(5, Math.min(95, Number(n.x)||0))}%;top:${Math.max(5, Math.min(95, Number(n.y)||0))}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#f43f5e;color:#fff;font-size:0.62rem;display:flex;align-items:center;justify-content:center;">${i+1}</span>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#f43f5e;text-transform:uppercase;">Gallery annotable</div>
                    <div style="position:relative;flex:1;min-height:0;border-radius:8px;overflow:hidden;border:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">
                        ${src ? `<img src="${escHtml(src)}" alt="${alt}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#64748b);font-size:0.74rem;">Image non définie</div>`}
                        ${points}
                    </div>
                </div>`;
            }
            case 'rank-order': {
                const title = escHtml(el.data?.title || 'Classement');
                const items = Array.isArray(el.data?.items) ? el.data.items : [];
                const rows = items.slice(0, 6).map((it, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.73rem;"><span style="font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);min-width:20px;">${i + 1}.</span><span>${escHtml(it)}</span></div>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;overflow:auto;">${rows}</div>
                </div>`;
            }
            case 'kanban-mini': {
                const cols = Array.isArray(el.data?.columns) ? el.data.columns : [];
                const colHtml = cols.slice(0, 3).map(col => `<div style="flex:1;min-width:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;text-transform:uppercase;">${escHtml(col.name || '')}</div>
                    ${(Array.isArray(col.cards) ? col.cards : []).slice(0, 3).map(c => `<div style="padding:5px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;font-size:0.66rem;">${escHtml(c)}</div>`).join('')}
                </div>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Kanban mini</div>
                    <div style="display:flex;gap:6px;flex:1;min-height:0;">${colHtml}</div>
                </div>`;
            }
            case 'myth-reality': {
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="padding:8px;border:1px solid rgba(251,146,60,0.45);border-radius:8px;background:rgba(251,146,60,0.08);"><div style="font-size:0.65rem;color:#fb923c;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Mythe</div><div style="font-size:0.75rem;">${escHtml(el.data?.myth || '')}</div></div>
                    <div style="padding:8px;border:1px solid rgba(52,211,153,0.45);border-radius:8px;background:rgba(52,211,153,0.08);"><div style="font-size:0.65rem;color:#34d399;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Réalité</div><div style="font-size:0.75rem;">${escHtml(el.data?.reality || '')}</div></div>
                </div>`;
            }
            case 'flashcards-auto': {
                const cards = Array.isArray(el.data?.cards) ? el.data.cards : [];
                const first = cards[0] || {};
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Flashcards</div>
                    <div style="width:86%;min-height:110px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:0.8rem;">
                        ${escHtml(first.front || 'Question')}
                    </div>
                    <div style="font-size:0.66rem;color:var(--sl-muted,#64748b);">${cards.length} carte(s)</div>
                </div>`;
            }
            default:
                return `<div style="padding:8px;color:var(--sl-muted)">${escHtml(el.type)}</div>`;
        }
    }

    /* ── Shape SVG rendering ──────────────────────────────── */

    static _renderShapeSVG(el, typography = null) {
        const fallback = SlidesShared.resolveElementFontSize('shape', el.style || {}, typography, 16);
        const { svgInner, opacity, textHtml } = SlidesShared.shapeSVG(el, {
            escapeText: false,
            baseFontSize: fallback,
            typography,
        });
        return `<div class=\"cel-shape-content\" style=\"position:relative;opacity:${opacity};\"><svg viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" style=\"width:100%;height:100%;display:block;\">${svgInner}</svg>${textHtml}</div>`;
    }

    /* ── Highlight line range helper ──────────────────────── */

    static _lineInRange(lineNum, rangeStr) {
        return CanvasHelpers.lineInRange(lineNum, rangeStr);
    }

    /* ── SmartArt rendering ───────────────────────────────── */

    static _renderSmartArt(variant, items, color) {
        const safeItems = SlidesShared.normalizeSmartArtItems(items, []);
        const n = safeItems.length || 1;
        switch (variant) {
            case 'process': {
                const cols = safeItems.map((item, i) => {
                    const arrow = i < n - 1 ? `<div class="cel-sa-arrow">→</div>` : '';
                    return `<div class="cel-sa-step" style="border-color:${color}"><span>${escHtml(item)}</span></div>${arrow}`;
                }).join('');
                return `<div class="cel-smartart cel-sa-process" style="--sa-color:${color}">${cols}</div>`;
            }
            case 'cycle': {
                const anglePer = 360 / n;
                const nodes = safeItems.map((item, i) => {
                    const angle = i * anglePer - 90;
                    const rad = angle * Math.PI / 180;
                    const x = 50 + 35 * Math.cos(rad);
                    const y = 50 + 35 * Math.sin(rad);
                    return `<div class="cel-sa-node" style="left:${x}%;top:${y}%;border-color:${color}">${escHtml(item)}</div>`;
                }).join('');
                return `<div class="cel-smartart cel-sa-cycle" style="--sa-color:${color}"><div class="cel-sa-cycle-ring" style="border-color:${color}"></div>${nodes}</div>`;
            }
            case 'pyramid': {
                const rows = safeItems.map((item, i) => {
                    const w = 30 + (70 * (i + 1) / n);
                    return `<div class="cel-sa-pyrow" style="width:${w}%;background:color-mix(in srgb,${color} ${20 + 60*(n-i)/n}%,var(--sl-slide-bg,#1a1d27));border:1px solid ${color};">${escHtml(item)}</div>`;
                }).join('');
                return `<div class="cel-smartart cel-sa-pyramid" style="--sa-color:${color}">${rows}</div>`;
            }
            case 'matrix': {
                const cols = Math.ceil(Math.sqrt(n));
                const cells = safeItems.map(item =>
                    `<div class="cel-sa-cell" style="border-color:${color}">${escHtml(item)}</div>`
                ).join('');
                return `<div class="cel-smartart cel-sa-matrix" style="--sa-color:${color};--sa-cols:${cols}">${cells}</div>`;
            }
            default:
                return `<div class="cel-smartart cel-sa-process" style="--sa-color:${color}">${safeItems.map(i => `<div class="cel-sa-step" style="border-color:${color}"><span>${escHtml(i)}</span></div>`).join('')}</div>`;
        }
    }

    static _normalizeCodeExampleMode(mode) {
        return CanvasHelpers.normalizeCodeExampleMode(mode);
    }

    static _renderCodeExampleWidget(data, mode, style = {}, baseFontSize = null) {
        const resolvedMode = CanvasEditor._normalizeCodeExampleMode(mode);
        const lang = data.language || 'python';
        const code = data.code || '';
        const providedBase = Number(baseFontSize);
        const base = Number.isFinite(providedBase)
            ? Math.max(10, providedBase)
            : SlidesShared.resolveElementFontSize('code-example', style, null, 16);
        const metrics = CanvasHelpers.computeCodeMetrics(base, SlidesShared.resolveCodeLineHeight);
        const headSize = metrics.headSize;
        const codeSize = metrics.codeSize;
        const codeLineHeight = metrics.codeLineHeight;
        const stepTitleSize = metrics.stepTitleSize;
        const stepDetailSize = metrics.stepDetailSize;
        if (resolvedMode === 'live') {
            return `<div class="cel-codeexample-live">
                <div class="cel-codeexample-live-head" style="font-size:${headSize}px;">
                    <span class="cel-codeexample-live-lang">${escHtml(lang)}</span>
                    <span class="cel-codeexample-live-tag">Live</span>
                </div>
                <pre class="cel-codeexample-live-code" style="font-size:${codeSize}px;line-height:${codeLineHeight};"><code class="language-${escHtml(lang)}">${escHtml(code)}</code></pre>
            </div>`;
        }
        if (resolvedMode === 'stepper') {
            const steps = Array.isArray(data.stepperSteps) ? data.stepperSteps : [];
            const first = steps[0] || {};
            return `<div class="cel-codeexample-stepper">
                <div class="cel-codeexample-stepper-head" style="font-size:${headSize}px;">
                    <span>${escHtml(data.stepperTitle || 'Exécution pas à pas')}</span>
                    <span class="cel-codeexample-stepper-tag">Stepper</span>
                </div>
                <div class="cel-codeexample-stepper-body">
                    <div class="cel-codeexample-stepper-title" style="font-size:${stepTitleSize}px;">${escHtml(first.title || 'Étape 1')}</div>
                    <div class="cel-codeexample-stepper-detail" style="font-size:${stepDetailSize}px;">${escHtml(first.detail || '')}</div>
                    <pre class="cel-codeexample-stepper-code" style="font-size:${codeSize}px;line-height:${codeLineHeight};"><code class="language-${escHtml(lang)}">${escHtml(first.code || '')}</code></pre>
                </div>
            </div>`;
        }
        return SlidesShared.codeTerminal(code, lang, 'cel');
    }

    static _editableToPlainText(root) {
        if (!root) return '';
        const blockTags = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
        let out = '';

        const ensureLineBreak = () => {
            if (!out.endsWith('\n')) out += '\n';
        };

        const walk = node => {
            if (!node) return;
            if (node.nodeType === 3) {
                out += String(node.nodeValue || '').replace(/\u00a0/g, ' ');
                return;
            }
            if (node.nodeType !== 1) return;
            const tag = (node.tagName || '').toUpperCase();
            if (tag === 'BR') {
                out += '\n';
                return;
            }
            const isBlock = blockTags.has(tag);
            if (isBlock && out && !out.endsWith('\n')) ensureLineBreak();
            for (const child of node.childNodes || []) walk(child);
            if (isBlock) ensureLineBreak();
        };

        walk(root);
        return out
            .replace(/\r\n?/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\n+$/g, '');
    }

    /* ── Mermaid / KaTeX / QR lazy rendering ──────────────── */

    _renderMermaidElements() {
        CanvasSpecialRuntime.renderMermaidElements({
            container: this.container,
            windowRef: window,
            documentRef: document,
            loadScript: src => this._loadScript(src),
            escapeHtml: escHtml,
        });
    }

    _renderLatexElements() {
        CanvasSpecialRuntime.renderLatexElements({
            container: this.container,
            windowRef: window,
            documentRef: document,
            loadScript: src => this._loadScript(src),
            escapeHtml: escHtml,
        });
    }

    _renderQRElements() {
        CanvasSpecialRuntime.renderQRElements({
            container: this.container,
            windowRef: window,
            documentRef: document,
            loadScript: src => this._loadScript(src),
        });
    }

    _initTimerElements() {
        CanvasSpecialRuntime.initTimerElements({
            container: this.container,
        });
    }

    /* ── Connector system ─────────────────────────────────── */

    _getAnchorPos(el, anchor) {
        return CanvasHelpers.getAnchorPosition(el, anchor);
    }

    _anchorDir(anchor) {
        return CanvasHelpers.getAnchorDirection(anchor);
    }

    _connectorPathData(conn) {
        const src = this.elements.find(e => e.id === conn.sourceId);
        const tgt = this.elements.find(e => e.id === conn.targetId);
        if (!src || !tgt) return null;
        return CanvasHelpers.buildConnectorPathData(conn, src, tgt);
    }

    _elbowPoints(p1, a1, p2, a2) {
        return CanvasHelpers.computeElbowPoints(p1, a1, p2, a2);
    }

    _roundedPolyline(pts) {
        return CanvasHelpers.buildRoundedPolylinePath(pts);
    }

    _refreshConnectors() {
        CanvasConnectorsRuntime.refreshConnectors({
            connOverlay: this._connOverlay,
            connectors: this.connectors,
            elements: this.elements,
            selectedConnectorId: this._selectedConnectorId,
            getConnectorPathData: conn => this._connectorPathData(conn),
            getAnchorPos: (el, anchor) => this._getAnchorPos(el, anchor),
            escapeHtml: escHtml,
            documentRef: document,
        });
    }

    _updateTempLine(mx, my) {
        CanvasConnectorsRuntime.updateTempLine({
            connOverlay: this._connOverlay,
            connCreation: this._connCreation,
            elements: this.elements,
            getAnchorPos: (el, anchor) => this._getAnchorPos(el, anchor),
            mx,
            my,
        });
    }

    enterConnectorMode() {
        CanvasConnectorsRuntime.enterConnectorMode({
            state: this,
            deselectElements: () => this.select(null),
        });
    }

    exitConnectorMode() {
        CanvasConnectorsRuntime.exitConnectorMode({ state: this });
    }

    toggleConnectorMode() {
        CanvasConnectorsRuntime.toggleConnectorMode({
            state: this,
            deselectElements: () => this.select(null),
        });
    }

    addConnector(connData) {
        return CanvasConnectorsRuntime.addConnector({
            state: this,
            refreshConnectors: () => this._refreshConnectors(),
            selectConnector: id => this.selectConnector(id),
            notifyChange: () => this.onChange(this.serialize()),
        }, connData);
    }

    removeConnector(id) {
        CanvasConnectorsRuntime.removeConnector({
            state: this,
            refreshConnectors: () => this._refreshConnectors(),
            notifyChange: () => this.onChange(this.serialize()),
        }, id);
    }

    updateConnector(id, patch) {
        CanvasConnectorsRuntime.updateConnector({
            state: this,
            refreshConnectors: () => this._refreshConnectors(),
            notifyChange: () => this.onChange(this.serialize()),
        }, id, patch);
    }

    selectConnector(id) {
        CanvasConnectorsRuntime.selectConnector({
            state: this,
            clearElementSelection: () => {
                this.selectedIds.clear();
                this.selectedId = null;
            },
            updateSelectionVisuals: () => this._updateSelectionVisuals(),
            refreshConnectors: () => this._refreshConnectors(),
            notifyConnectorSelect: conn => this.onConnectorSelect(conn),
        }, id);
    }

    getSelectedConnector() {
        return CanvasConnectorsRuntime.getSelectedConnector({ state: this });
    }

    _refreshDOM(id) {
        CanvasDomRuntime.refreshElementDom({
            id,
            container: this.container,
            elements: this.elements,
            syncLockVisual: (div, el) => this._syncLockVisual(div, el),
            renderContent: el => this._renderContent(el),
            mountWidget: (div, el) => this._mountWidget(div, el),
            highlightCodeBlock: div => this._highlightCodeBlock(div),
            postRenderElement: el => this._postRenderElement(el),
            updateOverflowVisual: (div, el) => this._updateOverflowVisual(div, el),
            requestAnimationFrameFn: fn => requestAnimationFrame(fn),
            documentRef: document,
        });
    }

    _dom(id) {
        return CanvasDomRuntime.getElementDom(this.container, id);
    }

    /* ── Widget mounting ──────────────────────────────────── */

    _loadScript(src) {
        return CanvasCodeRuntime.loadScript(src, { documentRef: document });
    }

    async _mountWidget(div, el) {
        await CanvasWidgetRuntime.mountWidget({
            div,
            el,
            registry: CanvasEditor.WIDGET_REGISTRY,
            scriptBasePath: this.scriptBasePath,
            loadScript: src => this._loadScript(src),
            windowRef: window,
            documentRef: document,
            escapeHtml: escHtml,
        });
    }

    /* ── Syntax highlighting ──────────────────────────────── */

    _highlightCodeBlock(div) {
        CanvasCodeRuntime.highlightCodeBlock({
            div,
            windowRef: window,
            documentRef: document,
            loadScript: src => this._loadScript(src),
        });
    }

    /* ── Events ───────────────────────────────────────────── */

    _bindElementEvents(div, id) {
        CanvasEventsRuntime.bindElementEvents({
            div,
            id,
            editor: this,
            tryHandlePipetteClick: candidateId => (
                typeof handlePipetteClick === 'function' ? !!handlePipetteClick(candidateId) : false
            ),
        });
    }

    _startInlineEdit(div, el, dblClickEvent = null) {
        CanvasInlineEditRuntime.startInlineEdit({
            editor: this,
            resolveElementFontSize: (...args) => SlidesShared.resolveElementFontSize(...args),
            editableToPlainText: editable => CanvasEditor._editableToPlainText(editable),
        }, div, el, dblClickEvent);
    }

    _startInlineEditCode(div, el) {
        CanvasInlineEditRuntime.startInlineEditCode({ editor: this }, div, el);
    }

    _startInlineEditDefinition(div, el) {
        CanvasInlineEditRuntime.startInlineEditDefinition({ editor: this }, div, el);
    }

    _startInlineEditCodeExample(div, el) {
        CanvasInlineEditRuntime.startInlineEditCodeExample({ editor: this }, div, el);
    }

    _startInlineEditList(div, el) {
        CanvasInlineEditRuntime.startInlineEditList({
            editor: this,
            resolveElementFontSize: (...args) => SlidesShared.resolveElementFontSize(...args),
        }, div, el);
    }

    _startInlineEditTable(div, el) {
        CanvasInlineEditRuntime.startInlineEditTable({
            editor: this,
            resolveElementFontSize: (...args) => SlidesShared.resolveElementFontSize(...args),
        }, div, el);
    }

    _onMouseMove(e) {
        CanvasTransformRuntime.handleMouseMove({
            editor: this,
            computeSnap: payload => this._computeSnap(payload),
        }, e);
    }

    _onMouseUp() {
        CanvasTransformRuntime.handleMouseUp({ editor: this });
    }

    /* ── Nudge & Align/Distribute ─────────────────────────── */

    nudge(dx, dy) {
        CanvasTransformRuntime.nudge({ editor: this }, dx, dy);
    }

    alignElements(direction) {
        CanvasTransformRuntime.alignElements({
            editor: this,
            alignElementsRects: CanvasHelpers.alignElementsRects,
        }, direction);
    }

    distributeElements(axis) {
        CanvasTransformRuntime.distributeElements({
            editor: this,
            distributeElementsRects: CanvasHelpers.distributeElementsRects,
        }, axis);
    }

    /**
     * Réorganise intelligemment la sélection en grille dans une zone de travail.
     * - Préserve l'ordre visuel (haut → bas, gauche → droite)
     * - Réduit légèrement les éléments si nécessaire pour éviter les chevauchements
     * - Conserve les proportions lors du redimensionnement
     */
    autoLayoutSelected(options = {}) {
        return CanvasTransformRuntime.autoLayoutSelected({
            editor: this,
            computeAutoLayoutRects: CanvasHelpers.computeAutoLayoutRects,
        }, options);
    }

    removeSelected() {
        CanvasTransformRuntime.removeSelected({ editor: this });
    }

    /* ── Alignment guides ─────────────────────────────────── */

    _computeSnap({ id, x: nx, y: ny, w, h }) {
        return CanvasHelpers.computeSnapResult(
            { id, x: nx, y: ny, w, h },
            this.elements,
            { gridSize: this._gridSize, snapThreshold: 8, canvasWidth: 1280, canvasHeight: 720 }
        );
    }

    _showGuides(xs, ys) {
        CanvasGuides.renderGuides(this.container, xs, ys, { scale: this.scale, documentRef: document });
    }

    _clearGuides() {
        CanvasGuides.clearGuides(this.container);
    }
}

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.CanvasEditor = CanvasEditor;
