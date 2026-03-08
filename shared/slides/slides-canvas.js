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
        { id: 'code-example', icon: 'EX', label: 'Exemple code', w: 760, h: 360 },
        { id: 'quote',      icon: '"',   label: 'Citation',   w: 900, h: 340 },
        { id: 'card',       icon: '▤',   label: 'Carte',      w: 540, h: 380 },
        { id: 'video',      icon: '▶',   label: 'Vidéo',      w: 560, h: 315 },
        { id: 'mermaid',    icon: 'MMD', label: 'Mermaid',    w: 700, h: 400 },
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
                return { ...base, data: { text: 'Titre principal' }, style: { fontSize: 52, fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' } };
            case 'text':
                return { ...base, data: { text: 'Votre texte ici.' }, style: { fontSize: 22, fontWeight: 400, color: 'var(--sl-text)', textAlign: 'left', fontFamily: 'var(--sl-font-body)' } };
            case 'code':
                return { ...base, data: { language: 'python', code: '# Code ici\nprint("Hello, World!")' } };
            case 'list':
                return { ...base, data: { items: ['Premier point', 'Deuxième point', 'Troisième point'] }, style: { fontSize: 22, color: 'var(--sl-text)' } };
            case 'image':
                return { ...base, data: { src: '', alt: '', caption: '' } };
            case 'shape':
                return { ...base, data: { shape: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.2, borderRadius: 8 } };
            case 'widget':
                return { ...base, data: { widget: 'workflow-trigger-simulator', config: {} } };
            case 'definition':
                return { ...base, data: { term: 'Terme', definition: 'La définition complète du terme.', example: '' }, style: { fontSize: 16 } };
            case 'code-example':
                return {
                    ...base,
                    data: {
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
                    style: { fontSize: 16 },
                };
            case 'quote':
                return { ...base, data: { text: 'Votre citation ici.', author: '' }, style: { fontSize: 26, color: 'var(--sl-heading)' } };
            case 'card':
                return { ...base, data: { title: 'Titre de la carte', items: ['Premier point', 'Deuxième point', 'Troisième point'] }, style: { fontSize: 18, color: 'var(--sl-text)', titleColor: 'var(--sl-primary)' } };
            case 'table': {
                const defaultRows = [
                    ['En-tête 1', 'En-tête 2', 'En-tête 3'],
                    ['Cellule', 'Cellule', 'Cellule'],
                    ['Cellule', 'Cellule', 'Cellule']
                ];
                return { ...base, data: { rows: defaultRows }, style: { fontSize: 18, color: 'var(--sl-text)', headerBg: 'var(--sl-primary)' } };
            }
            case 'video':
                return { ...base, data: { src: '', embedUrl: '', alt: '' } };
            case 'mermaid':
                return { ...base, data: { code: 'graph LR\n    A[Début] --> B{Condition}\n    B -->|Oui| C[Action]\n    B -->|Non| D[Fin]' } };
            case 'latex':
                return { ...base, data: { expression: 'E = mc^2' }, style: { fontSize: 32, color: 'var(--sl-text)' } };
            case 'timer':
                return { ...base, data: { duration: 300, label: 'Timer' }, style: { fontSize: 48, color: 'var(--sl-heading)' } };
            case 'iframe':
                return { ...base, data: { url: '', title: 'Contenu embarqué' } };
            case 'highlight':
                return { ...base, data: { language: 'python', code: '# Code\ndef hello():\n    print("Hello!")\n\nhello()', highlights: [] } };
            case 'qrcode':
                return { ...base, data: { value: 'https://example.com', label: '', alt: '' } };
            case 'smartart':
                return { ...base, data: { variant: 'process', items: ['Étape 1', 'Étape 2', 'Étape 3'] }, style: { color: 'var(--sl-primary)' } };
            case 'code-live':
                return { ...base, data: { language: 'python', code: '# Code ici\nprint("Hello, World!")', autoRun: false }, style: {} };
            case 'quiz-live':
                return { ...base, data: { question: 'Quelle est la bonne réponse ?', options: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'], answer: 0, duration: 30 }, style: {} };
            case 'cloze':
                return { ...base, data: { title: 'Texte à trous', sentence: 'Le protocole ____ garantit la livraison des paquets.', blanks: ['TCP'] }, style: {} };
            case 'mcq-single':
                return { ...base, data: { question: 'Quelle est la bonne réponse ?', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 1 }, style: {} };
            case 'drag-drop':
                return { ...base, data: { title: 'Classez les éléments', items: ['Cache L1', 'RAM', 'SSD'], targets: ['Très rapide', 'Moyen', 'Plus lent'] }, style: {} };
            case 'mcq-multi':
                return { ...base, data: { question: 'Quelles propositions sont exactes ?', options: ['Option A', 'Option B', 'Option C', 'Option D'], answers: [0, 2] }, style: {} };
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
    line-height: 1.6;
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
    line-height: 1.6;
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
    color: var(--sl-primary, #818cf8);
    font-weight: 700;
    text-transform: uppercase;
}
.cel-codeexample-live-code {
    margin: 0;
    padding: 8px 10px;
    font-size: 0.72rem;
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

    load(elements, bg, connectors, slideIndex = 0) {
        this.elements = JSON.parse(JSON.stringify(elements || []));
        // Filter out legacy connector elements (pre-v2)
        this.elements = this.elements.filter(e => e.type !== 'connector');
        this.connectors = JSON.parse(JSON.stringify(connectors || []));
        this.slideIndex = slideIndex;
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
        return !!el?.locked;
    }

    _syncLockVisual(div, el) {
        if (!div || !el) return;
        const locked = this._isElementLocked(el);
        div.classList.toggle('is-locked', locked);
        let badge = div.querySelector('.cel-lock-badge');
        if (locked) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'cel-lock-badge';
                badge.textContent = 'L';
                badge.title = 'Élément verrouillé';
                div.appendChild(badge);
            }
        } else if (badge) {
            badge.remove();
        }
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
        this.container.querySelectorAll('.cel').forEach(el => {
            el.classList.toggle('selected', this.selectedIds.has(el.dataset.id));
        });
        // Group bounding box overlays
        this.container.querySelectorAll('.group-bbox').forEach(el => el.remove());
        const groups = {};
        for (const el of this.elements) {
            if (el.groupId) {
                if (!groups[el.groupId]) groups[el.groupId] = [];
                groups[el.groupId].push(el);
            }
        }
        for (const [gid, members] of Object.entries(groups)) {
            if (members.length < 2) continue;
            const minX = Math.min(...members.map(e => e.x));
            const minY = Math.min(...members.map(e => e.y));
            const maxX = Math.max(...members.map(e => e.x + e.w));
            const maxY = Math.max(...members.map(e => e.y + e.h));
            const bbox = document.createElement('div');
            bbox.className = 'group-bbox';
            const sAny = members.some(e => this.selectedIds.has(e.id));
            bbox.style.left = `${minX - 4}px`;
            bbox.style.top = `${minY - 4}px`;
            bbox.style.width = `${maxX - minX + 8}px`;
            bbox.style.height = `${maxY - minY + 8}px`;
            bbox.style.borderColor = sAny ? 'var(--primary, #818cf8)' : 'rgba(255,255,255,0.2)';
            const badge = document.createElement('span');
            badge.className = 'group-bbox-badge';
            badge.textContent = 'Groupe';
            badge.style.color = sAny ? 'var(--primary, #818cf8)' : 'rgba(255,255,255,0.35)';
            bbox.appendChild(badge);
            this.container.appendChild(bbox);
        }
    }

    /* ── Rendering ────────────────────────────────────────── */

    _renderAll(bg) {
        const guide = this.container.querySelector('.canvas-guide-layer');
        this.container.innerHTML = '';
        if (bg) this.container.style.background = bg;
        // Re-create connector overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'cel-connector-overlay');
        svg.setAttribute('width', '1280');
        svg.setAttribute('height', '720');
        svg.setAttribute('viewBox', '0 0 1280 720');
        svg.innerHTML = '<defs></defs><g class="conn-paths"></g><line class="conn-temp" style="display:none" stroke="#818cf8" stroke-width="2" stroke-dasharray="6 4"/>';
        this._connOverlay = svg;
        this._connOverlay.addEventListener('mousedown', e => {
            const g = e.target.closest('.conn-g');
            if (g) { e.stopPropagation(); this.selectConnector(g.dataset.connId); }
        });
        this._connOverlay.addEventListener('dblclick', e => {
            const g = e.target.closest('.conn-g');
            if (g) {
                e.stopPropagation();
                const conn = this.connectors.find(c => c.id === g.dataset.connId);
                if (conn && this.onConnectorDblClick) this.onConnectorDblClick(conn, e);
            }
        });
        this.container.appendChild(svg);
        // Elements
        const sorted = [...this.elements].sort((a, b) => (a.z || 0) - (b.z || 0));
        for (const el of sorted) this._addElementDOM(el);
        // Guide layer
        const g = document.createElement('div');
        g.className = 'canvas-guide-layer';
        this.container.appendChild(g);
        // Marquee div
        if (!this._marqueeDiv || !this.container.contains(this._marqueeDiv)) {
            this._marqueeDiv = document.createElement('div');
            this._marqueeDiv.className = 'cel-marquee';
            this.container.appendChild(this._marqueeDiv);
        }
        // Render connectors
        this._refreshConnectors();
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
        if (el.type === 'code' || el.type === 'highlight' || el.type === 'code-example') this._highlightCodeBlock(div);
        this._postRenderElement(el);
        return div;
    }

    _postRenderElement(el) {
        if (el.type === 'mermaid') this._renderMermaidElements();
        if (el.type === 'latex')   this._renderLatexElements();
        if (el.type === 'qrcode')  this._renderQRElements();
        if (el.type === 'timer')   this._initTimerElements();
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
                return `<div class="cel-text-content" style="font-size:${s.fontSize||22}px;font-weight:${s.fontWeight||400};color:${s.color||'var(--sl-text)'};text-align:${s.textAlign||'left'};font-family:${s.fontFamily||'var(--sl-font-body)'};line-height:${s.lineHeight||1.35};width:100%;height:100%;box-sizing:border-box;${vAlignCSS}${extras}">${body}</div>`;
            }
            case 'code': {
                const s = el.style || {};
                const base = Math.max(10, Number(s.fontSize || 16));
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                return `<div style="width:100%;height:100%;--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;">${SlidesShared.codeTerminal(el.data?.code || '', el.data?.language || 'text', 'cel')}</div>`;
            }
            case 'list': {
                const s = el.style || {};
                const items = (el.data?.items || []).map(i => `<li>${escHtml(i)}</li>`).join('');
                return `<ul class="cel-list-content" style="font-size:${s.fontSize||22}px;color:${s.color||'var(--sl-text)'};">${items}</ul>`;
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
                return CanvasEditor._renderShapeSVG(el);
            }
            case 'widget': {
                // Placeholder shown while the widget script loads asynchronously
                return `<div class="cel-widget-loading"><span style="font-size:0.75rem;font-weight:700">WIDGET</span><span>Chargement…</span></div>`;
            }
            case 'definition': {
                const s = el.style || {};
                const base = Math.max(10, Number(s.fontSize || 16));
                const termSize = Math.round(base * 1.06);
                const bodySize = Math.round(base);
                const exampleSize = Math.round(base * 0.78);
                return `<div class="cel-def-content">
                    <div class="cel-def-term" style="font-size:${termSize}px;">${escHtml(el.data?.term||'')}</div>
                    <div class="cel-def-body" style="font-size:${bodySize}px;">${el.data?.definition||''}</div>
                    ${el.data?.example ? `<div class="cel-def-example" style="font-size:${exampleSize}px;">Exemple : ${escHtml(el.data.example)}</div>` : ''}
                </div>`;
            }
            case 'code-example': {
                const s = el.style || {};
                const base = Math.max(10, Number(s.fontSize || 16));
                const data = el.data || {};
                const body = data.text || '';
                const widgetMode = data.widgetType || 'terminal';
                const widgetHtml = CanvasEditor._renderCodeExampleWidget(data, widgetMode, s);
                return `<div class="cel-code-example-content" style="font-size:${base}px;">
                    <div class="cel-code-example-label" style="font-size:${Math.round(base * 1.02)}px;">Exemple</div>
                    <div class="cel-code-example-text" style="font-size:${Math.round(base * 0.92)}px;">${body}</div>
                    <div class="cel-code-example-widget" style="--ce-code-font-size:${Math.round(base * 0.82)}px;--ce-code-gutter-size:${Math.round(base * 0.82)}px;--ce-code-lang-size:${Math.round(base * 0.64)}px;">${widgetHtml}</div>
                </div>`;
            }
            case 'quote': {
                const s = el.style || {};
                const base = Math.max(10, Number(s.fontSize || 26));
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
                const base = Math.max(10, Number(s.fontSize || 18));
                const titleSize = Math.round(base * 0.76);
                const cardTitle = el.data?.title
                    ? `<div style="font-size:${titleSize}px;font-weight:700;color:${s.titleColor||'var(--sl-primary,#818cf8)'};border-bottom:1px solid var(--sl-border,#2d3347);padding-bottom:0.5rem;margin-bottom:0.75rem;">${escHtml(el.data.title)}</div>`
                    : '';
                const items = (el.data?.items || []).map(i => `<li>${escHtml(i)}</li>`).join('');
                return `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 5%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;padding:1rem 1.2rem;overflow:auto;box-sizing:border-box;">
                    ${cardTitle}
                    <ul style="margin:0;padding-left:1.4em;font-size:${base}px;color:${s.color||'var(--sl-text,#cbd5e1)'};">${items}</ul>
                </div>`;
            }
            case 'table': {
                const s = el.style || {};
                const rows = el.data?.rows || [];
                let html = `<div class="cel-table-content" style="font-size:${s.fontSize||18}px;color:${s.color||'var(--sl-text,#cbd5e1)'};"><table>`;
                rows.forEach((row, ri) => {
                    html += '<tr>';
                    const tag = ri === 0 ? 'th' : 'td';
                    (row || []).forEach(cell => { html += `<${tag}>${escHtml(cell)}</${tag}>`; });
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
            case 'latex': {
                const s = el.style || {};
                const expr = el.data?.expression || '';
                return `<div class="cel-latex-content" style="font-size:${s.fontSize||32}px;color:${s.color||'var(--sl-text)'};display:flex;align-items:center;justify-content:center;width:100%;height:100%;" data-latex="${escHtml(expr)}">
                    <span class="cel-latex-render">${escHtml(expr)}</span>
                </div>`;
            }
            case 'timer': {
                const s = el.style || {};
                const dur = el.data?.duration || 300;
                const label = el.data?.label || '';
                const mins = Math.floor(dur / 60);
                const secs = dur % 60;
                const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
                return `<div class="cel-timer-content" data-duration="${dur}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
                    ${label ? `<div style="font-size:${Math.round((s.fontSize||48)*0.4)}px;color:var(--sl-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escHtml(label)}</div>` : ''}
                    <div class="cel-timer-display" style="font-size:${s.fontSize||48}px;color:${s.color||'var(--sl-heading)'};font-variant-numeric:tabular-nums;font-weight:700;font-family:var(--sl-font-mono,monospace);">${display}</div>
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
                const base = Math.max(10, Number(s.fontSize || 16));
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                const highlights = el.data?.highlights || [];
                const lines = code.split('\n');
                let html = `<div class="cel-highlight-content"><div class="cel-code-terminal" style="--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;"><div class="cel-code-tbar"><div class="cel-code-dot cel-code-dot-r"></div><div class="cel-code-dot cel-code-dot-y"></div><div class="cel-code-dot cel-code-dot-g"></div><span class="cel-code-tbar-lang">${escHtml(lang)}</span></div><div class="cel-code-scroll"><pre><code class="language-${escHtml(lang)}">`;
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
                const optHtml = opts.map((o, i) => `<div class="cel-quizlive-option"><span class="cel-quizlive-letter">${String.fromCharCode(65 + i)}</span>${escHtml(o)}</div>`).join('');
                return `<div class="cel-quizlive-content">
                    <div class="cel-quizlive-header">
                        <span class="cel-quizlive-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></span>
                        <span>Quiz</span>
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
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:50%;"></span>${escHtml(o || `Option ${i + 1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">QCM simple</div>
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
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:3px;"></span>${escHtml(o || `Option ${i+1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">QCM multi</div>
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

    static _renderShapeSVG(el) {
        const { svgInner, opacity, textHtml } = SlidesShared.shapeSVG(el, { escapeText: false });
        return `<div class=\"cel-shape-content\" style=\"position:relative;opacity:${opacity};\"><svg viewBox=\"0 0 100 100\" preserveAspectRatio=\"none\" style=\"width:100%;height:100%;display:block;\">${svgInner}</svg>${textHtml}</div>`;
    }

    /* ── Highlight line range helper ──────────────────────── */

    static _lineInRange(lineNum, rangeStr) {
        if (!rangeStr) return false;
        return String(rangeStr).split(',').some(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [a, b] = part.split('-').map(Number);
                return lineNum >= a && lineNum <= b;
            }
            return lineNum === Number(part);
        });
    }

    /* ── SmartArt rendering ───────────────────────────────── */

    static _renderSmartArt(variant, items, color) {
        const n = items.length || 1;
        switch (variant) {
            case 'process': {
                const cols = items.map((item, i) => {
                    const arrow = i < n - 1 ? `<div class="cel-sa-arrow">→</div>` : '';
                    return `<div class="cel-sa-step" style="border-color:${color}"><span>${escHtml(item)}</span></div>${arrow}`;
                }).join('');
                return `<div class="cel-smartart cel-sa-process" style="--sa-color:${color}">${cols}</div>`;
            }
            case 'cycle': {
                const anglePer = 360 / n;
                const nodes = items.map((item, i) => {
                    const angle = i * anglePer - 90;
                    const rad = angle * Math.PI / 180;
                    const x = 50 + 35 * Math.cos(rad);
                    const y = 50 + 35 * Math.sin(rad);
                    return `<div class="cel-sa-node" style="left:${x}%;top:${y}%;border-color:${color}">${escHtml(item)}</div>`;
                }).join('');
                return `<div class="cel-smartart cel-sa-cycle" style="--sa-color:${color}"><div class="cel-sa-cycle-ring" style="border-color:${color}"></div>${nodes}</div>`;
            }
            case 'pyramid': {
                const rows = items.map((item, i) => {
                    const w = 30 + (70 * (i + 1) / n);
                    return `<div class="cel-sa-pyrow" style="width:${w}%;background:color-mix(in srgb,${color} ${20 + 60*(n-i)/n}%,var(--sl-slide-bg,#1a1d27));border:1px solid ${color};">${escHtml(item)}</div>`;
                }).join('');
                return `<div class="cel-smartart cel-sa-pyramid" style="--sa-color:${color}">${rows}</div>`;
            }
            case 'matrix': {
                const cols = Math.ceil(Math.sqrt(n));
                const cells = items.map(item =>
                    `<div class="cel-sa-cell" style="border-color:${color}">${escHtml(item)}</div>`
                ).join('');
                return `<div class="cel-smartart cel-sa-matrix" style="--sa-color:${color};--sa-cols:${cols}">${cells}</div>`;
            }
            default:
                return `<div class="cel-smartart cel-sa-process" style="--sa-color:${color}">${items.map(i => `<div class="cel-sa-step" style="border-color:${color}"><span>${escHtml(i)}</span></div>`).join('')}</div>`;
        }
    }

    static _normalizeCodeExampleMode(mode) {
        return ['terminal', 'live', 'stepper'].includes(mode) ? mode : 'terminal';
    }

    static _renderCodeExampleWidget(data, mode, style = {}) {
        const resolvedMode = CanvasEditor._normalizeCodeExampleMode(mode);
        const lang = data.language || 'python';
        const code = data.code || '';
        const base = Math.max(10, Number(style.fontSize || 16));
        const headSize = Math.round(base * 0.66);
        const codeSize = Math.round(base * 0.82);
        const stepTitleSize = Math.round(base * 0.74);
        const stepDetailSize = Math.round(base * 0.69);
        if (resolvedMode === 'live') {
            return `<div class="cel-codeexample-live">
                <div class="cel-codeexample-live-head" style="font-size:${headSize}px;">
                    <span class="cel-codeexample-live-lang">${escHtml(lang)}</span>
                    <span class="cel-codeexample-live-tag">Live</span>
                </div>
                <pre class="cel-codeexample-live-code" style="font-size:${codeSize}px;"><code class="language-${escHtml(lang)}">${escHtml(code)}</code></pre>
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
                    <pre class="cel-codeexample-stepper-code" style="font-size:${codeSize}px;"><code class="language-${escHtml(lang)}">${escHtml(first.code || '')}</code></pre>
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
        const els = this.container.querySelectorAll('.cel-mermaid-content');
        if (!els.length) return;
        if (!window._mermaidLoaded) {
            window._mermaidLoaded = true;
            const s = document.createElement('script');
            s.src = '../vendor/mermaid/10.9.1/mermaid.min.js';
            s.onload = () => {
                window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                this._doRenderMermaid(els);
            };
            document.head.appendChild(s);
        } else if (window.mermaid) {
            this._doRenderMermaid(els);
        }
    }

    async _doRenderMermaid(els) {
        for (const el of els) {
            const src = el.querySelector('.cel-mermaid-src');
            const target = el.querySelector('.cel-mermaid-render');
            if (!src || !target || target.dataset.rendered) continue;
            try {
                const id = el.dataset.mermaidId || 'mermaid-' + Math.random().toString(36).slice(2);
                const { svg } = await window.mermaid.render(id + '-svg', src.textContent);
                target.innerHTML = svg;
                target.dataset.rendered = '1';
            } catch (e) {
                target.innerHTML = `<pre style="color:#f87171;font-size:12px;">${escHtml(e.message||'Erreur Mermaid')}</pre>`;
            }
        }
    }

    _renderLatexElements() {
        const els = this.container.querySelectorAll('.cel-latex-content');
        if (!els.length) return;
        if (!window._katexLoaded) {
            window._katexLoaded = true;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '../vendor/katex/0.16.11/katex.min.css';
            document.head.appendChild(link);
            const s = document.createElement('script');
            s.src = '../vendor/katex/0.16.11/katex.min.js';
            s.onload = () => this._doRenderLatex(els);
            document.head.appendChild(s);
        } else if (window.katex) {
            this._doRenderLatex(els);
        }
    }

    _doRenderLatex(els) {
        els.forEach(el => {
            const target = el.querySelector('.cel-latex-render');
            if (!target || target.dataset.rendered) return;
            const expr = el.dataset.latex || '';
            try {
                target.innerHTML = window.katex.renderToString(expr, { displayMode: true, throwOnError: false });
                target.dataset.rendered = '1';
            } catch (e) {
                target.innerHTML = `<span style="color:#f87171">${escHtml(expr)}</span>`;
            }
        });
    }

    _renderQRElements() {
        const els = this.container.querySelectorAll('.cel-qrcode-content');
        if (!els.length) return;
        if (!window._qrcodeLoaded) {
            window._qrcodeLoaded = true;
            const s = document.createElement('script');
            s.src = '../vendor/qrcode-generator/1.4.4/qrcode.min.js';
            s.onload = () => this._doRenderQR(els);
            document.head.appendChild(s);
        } else if (window.qrcode) {
            this._doRenderQR(els);
        }
    }

    _doRenderQR(els) {
        els.forEach(container => {
            const render = container.querySelector('.cel-qr-render');
            if (!render || render.dataset.rendered) return;
            const val = container.dataset.qrValue || '';
            if (!val) { render.innerHTML = '<span style="color:var(--sl-muted);font-size:0.72rem;font-weight:700;letter-spacing:0.06em;">QR</span>'; return; }
            try {
                const qr = window.qrcode(0, 'M');
                qr.addData(val);
                qr.make();
                render.innerHTML = qr.createSvgTag({ scalable: true });
                const svg = render.querySelector('svg');
                if (svg) {
                    svg.style.width = '100%';
                    svg.style.height = '100%';
                }
                render.dataset.rendered = '1';
            } catch (e) {
                render.innerHTML = `<span style="color:#f87171">Erreur QR</span>`;
            }
        });
    }

    _initTimerElements() {
        this.container.querySelectorAll('.cel-timer-content').forEach(el => {
            if (el.dataset.timerBound) return;
            el.dataset.timerBound = '1';
            const dur = parseInt(el.dataset.duration) || 300;
            let remaining = dur, interval = null, running = false;
            const display = el.querySelector('.cel-timer-display');
            const btnStart = el.querySelector('.cel-timer-start');
            const btnPause = el.querySelector('.cel-timer-pause');
            const btnReset = el.querySelector('.cel-timer-reset');
            const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
            const tick = () => {
                remaining = Math.max(0, remaining - 1);
                display.textContent = fmt(remaining);
                if (remaining <= 0) { clearInterval(interval); running = false; btnStart.style.display = ''; btnPause.style.display = 'none'; display.style.color = '#f87171'; }
            };
            btnStart?.addEventListener('click', (e) => { e.stopPropagation(); if (!running) { running = true; interval = setInterval(tick, 1000); btnStart.style.display = 'none'; btnPause.style.display = ''; } });
            btnPause?.addEventListener('click', (e) => { e.stopPropagation(); clearInterval(interval); running = false; btnStart.style.display = ''; btnPause.style.display = 'none'; });
            btnReset?.addEventListener('click', (e) => { e.stopPropagation(); clearInterval(interval); running = false; remaining = dur; display.textContent = fmt(dur); display.style.color = ''; btnStart.style.display = ''; btnPause.style.display = 'none'; });
        });
    }

    /* ── Connector system ─────────────────────────────────── */

    _getAnchorPos(el, anchor) {
        switch (anchor) {
            case 'top':    return { x: el.x + el.w / 2, y: el.y };
            case 'right':  return { x: el.x + el.w,     y: el.y + el.h / 2 };
            case 'bottom': return { x: el.x + el.w / 2, y: el.y + el.h };
            case 'left':   return { x: el.x,             y: el.y + el.h / 2 };
            default:       return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
        }
    }

    _anchorDir(anchor) {
        switch (anchor) {
            case 'top':    return { dx: 0, dy: -1 };
            case 'right':  return { dx: 1, dy: 0 };
            case 'bottom': return { dx: 0, dy: 1 };
            case 'left':   return { dx: -1, dy: 0 };
            default:       return { dx: 0, dy: 0 };
        }
    }

    _connectorPathData(conn) {
        const src = this.elements.find(e => e.id === conn.sourceId);
        const tgt = this.elements.find(e => e.id === conn.targetId);
        if (!src || !tgt) return null;
        const p1 = this._getAnchorPos(src, conn.sourceAnchor);
        const p2 = this._getAnchorPos(tgt, conn.targetAnchor);
        switch (conn.lineType) {
            case 'curve': {
                const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
                const ddx = p2.x - p1.x, ddy = p2.y - p1.y;
                return `M${p1.x},${p1.y} Q${mx - ddy * 0.3},${my + ddx * 0.3} ${p2.x},${p2.y}`;
            }
            case 'elbow': {
                const pts = this._elbowPoints(p1, conn.sourceAnchor, p2, conn.targetAnchor);
                return 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
            }
            case 'rounded': {
                const pts = this._elbowPoints(p1, conn.sourceAnchor, p2, conn.targetAnchor);
                return this._roundedPolyline(pts);
            }
            default:
                return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
        }
    }

    _elbowPoints(p1, a1, p2, a2) {
        const GAP = 30;
        const d1 = this._anchorDir(a1);
        const d2 = this._anchorDir(a2);
        const ext1 = { x: p1.x + d1.dx * GAP, y: p1.y + d1.dy * GAP };
        const ext2 = { x: p2.x + d2.dx * GAP, y: p2.y + d2.dy * GAP };
        const isH1 = d1.dx !== 0, isH2 = d2.dx !== 0;
        if (isH1 && isH2) {
            const mx = (ext1.x + ext2.x) / 2;
            return [p1, ext1, { x: mx, y: ext1.y }, { x: mx, y: ext2.y }, ext2, p2];
        } else if (!isH1 && !isH2) {
            const my = (ext1.y + ext2.y) / 2;
            return [p1, ext1, { x: ext1.x, y: my }, { x: ext2.x, y: my }, ext2, p2];
        } else if (isH1) {
            return [p1, ext1, { x: ext2.x, y: ext1.y }, ext2, p2];
        } else {
            return [p1, ext1, { x: ext1.x, y: ext2.y }, ext2, p2];
        }
    }

    _roundedPolyline(pts) {
        if (pts.length < 3) return 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
        const R = 12;
        let d = `M${pts[0].x},${pts[0].y}`;
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
            const d1x = cur.x - prev.x, d1y = cur.y - prev.y;
            const d2x = next.x - cur.x, d2y = next.y - cur.y;
            const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
            const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
            const r = Math.min(R, len1 / 2, len2 / 2);
            if (r < 1) { d += ` L${cur.x},${cur.y}`; continue; }
            const arcStart = { x: cur.x - (d1x / len1) * r, y: cur.y - (d1y / len1) * r };
            const arcEnd = { x: cur.x + (d2x / len2) * r, y: cur.y + (d2y / len2) * r };
            d += ` L${arcStart.x},${arcStart.y} Q${cur.x},${cur.y} ${arcEnd.x},${arcEnd.y}`;
        }
        d += ` L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
        return d;
    }

    _refreshConnectors() {
        if (!this._connOverlay) return;
        const pathsG = this._connOverlay.querySelector('.conn-paths');
        const defs = this._connOverlay.querySelector('defs');
        if (!pathsG || !defs) return;
        pathsG.innerHTML = '';
        defs.innerHTML = '';
        for (const conn of this.connectors) {
            const pathD = this._connectorPathData(conn);
            if (!pathD) continue;
            const s = conn.style || {};
            const stroke = s.stroke || '#818cf8';
            const sw = s.strokeWidth || 3;
            const opacity = s.opacity != null ? s.opacity : 1;
            const isSelected = conn.id === this._selectedConnectorId;
            // Markers
            const mkEnd = 'cme-' + conn.id;
            const mkStart = 'cms-' + conn.id;
            if (conn.arrowEnd) {
                defs.innerHTML += `<marker id="${mkEnd}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="${stroke}"/></marker>`;
            }
            if (conn.arrowStart) {
                defs.innerHTML += `<marker id="${mkStart}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="10 0,0 3.5,10 7" fill="${stroke}"/></marker>`;
            }
            const me = conn.arrowEnd ? `marker-end="url(#${mkEnd})"` : '';
            const ms = conn.arrowStart ? `marker-start="url(#${mkStart})"` : '';
            // Group
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'conn-g' + (isSelected ? ' conn-selected' : ''));
            g.dataset.connId = conn.id;
            // Hit area (invisible wider path for easier clicking)
            g.innerHTML = `<path class="conn-hit" d="${pathD}"/>`;
            // Visible background (for selected state glow)
            g.innerHTML += `<path class="conn-line-bg" d="${pathD}" fill="none" stroke="transparent" stroke-width="8"/>`;
            // Visible line
            const dashAttr = s.dashArray ? `stroke-dasharray="${s.dashArray}"` : '';
            g.innerHTML += `<path class="conn-line" d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" ${dashAttr} ${me} ${ms}/>`;
            // Label
            if (conn.label) {
                const src = this.elements.find(e => e.id === conn.sourceId);
                const tgt = this.elements.find(e => e.id === conn.targetId);
                if (src && tgt) {
                    const p1 = this._getAnchorPos(src, conn.sourceAnchor);
                    const p2 = this._getAnchorPos(tgt, conn.targetAnchor);
                    const lx = (p1.x + p2.x) / 2, ly = (p1.y + p2.y) / 2;
                    g.innerHTML += `<rect x="${lx - conn.label.length * 4 - 4}" y="${ly - 11}" width="${conn.label.length * 8 + 8}" height="22" rx="4" fill="var(--sl-slide-bg, #1a1d27)" opacity="0.85"/>`;
                    g.innerHTML += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="13" font-family="var(--sl-font-body, system-ui)" style="pointer-events:none;">${escHtml(conn.label)}</text>`;
                }
            }
            // Source/target endpoint dots (visible when selected)
            if (isSelected) {
                const src = this.elements.find(e => e.id === conn.sourceId);
                const tgt = this.elements.find(e => e.id === conn.targetId);
                if (src && tgt) {
                    const p1 = this._getAnchorPos(src, conn.sourceAnchor);
                    const p2 = this._getAnchorPos(tgt, conn.targetAnchor);
                    g.innerHTML += `<circle cx="${p1.x}" cy="${p1.y}" r="5" fill="${stroke}" opacity="0.6" style="pointer-events:none;"/>`;
                    g.innerHTML += `<circle cx="${p2.x}" cy="${p2.y}" r="5" fill="${stroke}" opacity="0.6" style="pointer-events:none;"/>`;
                }
            }
            pathsG.appendChild(g);
        }
    }

    _updateTempLine(mx, my) {
        if (!this._connOverlay) return;
        const line = this._connOverlay.querySelector('.conn-temp');
        if (!line) return;
        if (!this._connCreation) { line.style.display = 'none'; return; }
        const src = this.elements.find(e => e.id === this._connCreation.sourceId);
        if (!src) { line.style.display = 'none'; return; }
        const p = this._getAnchorPos(src, this._connCreation.sourceAnchor);
        line.setAttribute('x1', p.x);
        line.setAttribute('y1', p.y);
        line.setAttribute('x2', mx);
        line.setAttribute('y2', my);
        line.style.display = '';
    }

    enterConnectorMode() {
        this._connectorMode = true;
        this._connCreation = null;
        this.container.classList.add('canvas-connector-mode');
        // Deselect elements
        this.select(null);
    }

    exitConnectorMode() {
        this._connectorMode = false;
        this._connCreation = null;
        this.container.classList.remove('canvas-connector-mode', 'conn-creating');
        this.container.querySelectorAll('.anchor-active').forEach(a => a.classList.remove('anchor-active'));
        const line = this._connOverlay?.querySelector('.conn-temp');
        if (line) line.style.display = 'none';
    }

    toggleConnectorMode() {
        if (this._connectorMode) this.exitConnectorMode();
        else this.enterConnectorMode();
    }

    addConnector(connData) {
        const conn = {
            id: 'conn_' + Math.random().toString(36).slice(2, 9),
            sourceId: connData.sourceId,
            sourceAnchor: connData.sourceAnchor || 'right',
            targetId: connData.targetId,
            targetAnchor: connData.targetAnchor || 'left',
            lineType: connData.lineType || 'straight',
            arrowEnd: connData.arrowEnd !== false,
            arrowStart: connData.arrowStart || false,
            label: connData.label || '',
            style: connData.style || { stroke: '#818cf8', strokeWidth: 3, opacity: 1 },
        };
        this.connectors.push(conn);
        this._refreshConnectors();
        this.selectConnector(conn.id);
        this.onChange(this.serialize());
        return conn;
    }

    removeConnector(id) {
        this.connectors = this.connectors.filter(c => c.id !== id);
        if (this._selectedConnectorId === id) this._selectedConnectorId = null;
        this._refreshConnectors();
        this.onChange(this.serialize());
    }

    updateConnector(id, patch) {
        const conn = this.connectors.find(c => c.id === id);
        if (!conn) return;
        if (patch.lineType !== undefined)   conn.lineType = patch.lineType;
        if (patch.arrowEnd !== undefined)   conn.arrowEnd = patch.arrowEnd;
        if (patch.arrowStart !== undefined) conn.arrowStart = patch.arrowStart;
        if (patch.label !== undefined)      conn.label = patch.label;
        if (patch.sourceAnchor !== undefined) conn.sourceAnchor = patch.sourceAnchor;
        if (patch.targetAnchor !== undefined) conn.targetAnchor = patch.targetAnchor;
        if (patch.style) Object.assign(conn.style || (conn.style = {}), patch.style);
        this._refreshConnectors();
        this.onChange(this.serialize());
    }

    selectConnector(id) {
        this._selectedConnectorId = id;
        // Deselect elements
        this.selectedIds.clear();
        this.selectedId = null;
        this._updateSelectionVisuals();
        this._refreshConnectors();
        this.onConnectorSelect(id ? (this.connectors.find(c => c.id === id) || null) : null);
    }

    getSelectedConnector() {
        return this._selectedConnectorId ? (this.connectors.find(c => c.id === this._selectedConnectorId) || null) : null;
    }

    _refreshDOM(id) {
        const div = this._dom(id);
        if (!div) return;
        const el = this.elements.find(e => e.id === id);
        if (!el) return;
        div.style.left   = el.x + 'px';
        div.style.top    = el.y + 'px';
        div.style.width  = el.w + 'px';
        div.style.height = el.h + 'px';
        div.style.zIndex = el.z || 1;
        div.style.transform = (el.style?.rotate) ? `rotate(${el.style.rotate}deg)` : '';
        this._syncLockVisual(div, el);
        const inner = div.querySelector('.cel-inner');
        if (inner) inner.innerHTML = this._renderContent(el);
        if (el.type === 'widget') this._mountWidget(div, el);
        if (el.type === 'code' || el.type === 'highlight' || el.type === 'code-example') this._highlightCodeBlock(div);
        this._postRenderElement(el);
        // Animation badge
        let badge = div.querySelector('.cel-anim-badge');
        if (el.animation && el.animation.type && el.animation.type !== 'none') {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'cel-anim-badge';
                div.appendChild(badge);
            }
            const orderStr = el.animation.order != null ? ` #${el.animation.order}` : '';
            badge.textContent = '⚡' + orderStr;
        } else if (badge) {
            badge.remove();
        }
    }

    _dom(id) {
        return this.container.querySelector(`.cel[data-id="${id}"]`);
    }

    /* ── Widget mounting ──────────────────────────────────── */

    _loadScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
    }

    async _mountWidget(div, el) {
        const wid = el.data?.widget;
        if (!wid) return;
        const reg = CanvasEditor.WIDGET_REGISTRY[wid];
        if (!reg) return;

        const inner = div.querySelector('.cel-inner');
        if (!inner) return;

        try {
            if (!window[reg.global]) {
                const isAbsolute = typeof reg.script === 'string' && /^(https?:)?\/\//i.test(reg.script);
                await this._loadScript(isAbsolute ? reg.script : (this.scriptBasePath + reg.script));
            }
            const cls = window[reg.global];
            if (!cls || typeof cls.mount !== 'function') return;

            // Mount into a wrapper with pointer-events disabled (editor: drag takes priority)
            inner.innerHTML = '';
            const mountTarget = document.createElement('div');
            mountTarget.className = 'cel-widget-mount-target';
            inner.appendChild(mountTarget);
            cls.mount(mountTarget, Object.assign({}, el.data?.config || {}, { type: wid }));
        } catch (err) {
            inner.innerHTML = `<div class="cel-widget-placeholder"><span style="font-size:1.5rem">⚠️</span><span>${escHtml(wid)}</span></div>`;
        }
    }

    /* ── Syntax highlighting ──────────────────────────────── */

    _highlightCodeBlock(div) {
        // For 'highlight' type, apply per-line highlighting to preserve wrapper spans
        const isHighlight = div.dataset.type === 'highlight';
        const codeEls = isHighlight
            ? [div?.querySelector('.cel-code-scroll code')].filter(Boolean)
            : Array.from(div?.querySelectorAll('.cel-code-scroll code, .cel-codeexample-live-code code, .cel-codeexample-stepper-code code') || []);
        if (!codeEls.length || codeEls.every(node => node.dataset.highlighted)) return;

        const apply = () => {
            if (!window.hljs) return;
            if (isHighlight) {
                const codeEl = codeEls[0];
                if (!codeEl) return;
                // Highlight each line span individually to preserve .cel-hl-wrap wrappers
                const lang = codeEl.className.replace('language-', '').trim();
                codeEl.querySelectorAll('.cel-hl-wrap').forEach(span => {
                    const raw = span.textContent.replace(/\n$/, '');
                    try {
                        const result = lang && lang !== 'text'
                            ? window.hljs.highlight(raw, { language: lang, ignoreIllegals: true })
                            : window.hljs.highlightAuto(raw);
                        span.innerHTML = result.value + '\n';
                    } catch (_) {
                        // keep original content on error
                    }
                });
                codeEl.dataset.highlighted = '1';
            } else {
                codeEls.forEach(codeEl => {
                    if (!codeEl || codeEl.dataset.highlighted) return;
                    try {
                        window.hljs.highlightElement(codeEl);
                    } catch (_) {}
                    codeEl.dataset.highlighted = '1';
                });
            }
        };
        if (window.hljs) {
            apply();
        } else {
            const CSS = '../vendor/highlightjs/11.9.0/styles/github-dark.min.css';
            const JS  = '../vendor/highlightjs/11.9.0/highlight.min.js';
            if (!document.querySelector(`link[href="${CSS}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet'; link.href = CSS;
                document.head.appendChild(link);
            }
            this._loadScript(JS).then(apply).catch(() => {});
        }
    }

    /* ── Events ───────────────────────────────────────────── */

    _bindElementEvents(div, id) {
        div.addEventListener('mousedown', e => {
            // Don't intercept events when inline editing is active
            if (div.classList.contains('editing')) return;
            const el = this.elements.find(e2 => e2.id === id);
            if (!el) return;
            if (e.target.classList.contains('cel-handle')) {
                e.stopPropagation();
                if (el.locked) return;
                this._resize = { id, origEl: { ...el }, handle: e.target.dataset.handle, startMX: e.clientX, startMY: e.clientY, aspectRatio: el.w / el.h };
                e.preventDefault();
                return;
            }
            // Connector anchor click
            if (e.target.classList.contains('cel-anchor') && this._connectorMode) {
                e.stopPropagation();
                e.preventDefault();
                const anchor = e.target.dataset.anchor;
                if (!this._connCreation) {
                    // Source selected
                    this._connCreation = { sourceId: id, sourceAnchor: anchor };
                    e.target.classList.add('anchor-active');
                    this.container.classList.add('conn-creating');
                } else {
                    // Target selected — create connector
                    if (this._connCreation.sourceId !== id || this._connCreation.sourceAnchor !== anchor) {
                        this.addConnector({
                            sourceId: this._connCreation.sourceId,
                            sourceAnchor: this._connCreation.sourceAnchor,
                            targetId: id,
                            targetAnchor: anchor,
                        });
                    }
                    this._connCreation = null;
                    this.container.classList.remove('conn-creating');
                    this.container.querySelectorAll('.anchor-active').forEach(a => a.classList.remove('anchor-active'));
                    const tempLine = this._connOverlay?.querySelector('.conn-temp');
                    if (tempLine) tempLine.style.display = 'none';
                }
                return;
            }
            e.stopPropagation();
            // Pipette mode: intercept click to pick/apply style
            if (typeof handlePipetteClick === 'function' && handlePipetteClick(id)) return;
            // Multi-select with Ctrl/Meta key
            if (e.ctrlKey || e.metaKey) {
                this.toggleSelect(id);
            } else if (!this.selectedIds.has(id)) {
                this.select(id);
            } else {
                // Already selected — update primary
                this.selectedId = id;
                this.onSelect(this.elements.find(e2 => e2.id === id) || null);
            }
            if (el.locked) return;
            // Store drag origins for all selected elements
            const dragOrigins = {};
            for (const sid of this.selectedIds) {
                const sel = this.elements.find(e2 => e2.id === sid);
                if (sel) dragOrigins[sid] = { origX: sel.x, origY: sel.y };
            }
            this._drag = { id, startMX: e.clientX, startMY: e.clientY, origX: el.x, origY: el.y, dragOrigins };
            e.preventDefault();
        });

        // Right-click context menu
        div.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.selectedIds.has(id)) this.select(id);
            if (this.onContextMenu) this.onContextMenu(id, e);
        });

        // Double-click to inline-edit elements
        div.addEventListener('dblclick', e => {
            e.stopPropagation();
            const el = this.elements.find(e2 => e2.id === id);
            if (!el) return;
            if (this._isElementLocked(el)) return;
            if (['heading', 'text'].includes(el.type)) this._startInlineEdit(div, el, e);
            else if (el.type === 'code')       this._startInlineEditCode(div, el);
            else if (el.type === 'definition') this._startInlineEditDefinition(div, el);
            else if (el.type === 'code-example') this._startInlineEditCodeExample(div, el);
            else if (el.type === 'list')       this._startInlineEditList(div, el);
            else if (el.type === 'table')      this._startInlineEditTable(div, el);
            else if (this.onDblClick) this.onDblClick(el, e);
        });
    }

    _startInlineEdit(div, el, dblClickEvent = null) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const editable = document.createElement('div');
        editable.contentEditable = 'true';
        editable.className = 'cel-text-content cel-inline-edit';
        editable.style.fontSize = `${s.fontSize || 22}px`;
        editable.style.fontWeight = String(s.fontWeight || 400);
        editable.style.color = s.color || 'var(--sl-text)';
        editable.style.textAlign = s.textAlign || 'left';
        editable.style.fontFamily = s.fontFamily || 'var(--sl-font-body)';
        editable.style.lineHeight = String(s.lineHeight || 1.35);
        if (s.fontStyle) editable.style.fontStyle = s.fontStyle;
        else editable.style.removeProperty('font-style');
        if (s.textTransform) editable.style.textTransform = s.textTransform;
        else editable.style.removeProperty('text-transform');
        if (s.letterSpacing) editable.style.letterSpacing = s.letterSpacing;
        else editable.style.removeProperty('letter-spacing');
        if (s.opacity != null) editable.style.opacity = String(s.opacity);
        else editable.style.removeProperty('opacity');
        // Use rich HTML if available, otherwise plain text
        if (el.data?.html) {
            editable.innerHTML = el.data.html;
        } else {
            editable.textContent = el.data?.text || '';
        }
        inner.innerHTML = '';
        inner.appendChild(editable);

        // ── Rich text formatting toolbar ──
        const toolbar = document.createElement('div');
        toolbar.className = 'cel-rich-toolbar';
        toolbar.innerHTML = `
            <button class="cel-rich-btn" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
            <button class="cel-rich-btn" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
            <button class="cel-rich-btn" data-cmd="underline" title="Souligné (Ctrl+U)"><u>U</u></button>
            <button class="cel-rich-btn" data-cmd="strikethrough" title="Barré"><s>S</s></button>
            <button class="cel-rich-btn" data-cmd="code" title="Code inline"><span style="font-family:monospace;font-size:11px">&lt;/&gt;</span></button>
            <span style="width:1px;height:18px;background:var(--border,#2d3347);margin:0 2px;"></span>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#818cf8" title="Couleur accent" style="color:#818cf8;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#f59e0b" title="Couleur jaune" style="color:#f59e0b;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#ef4444" title="Couleur rouge" style="color:#ef4444;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#22c55e" title="Couleur vert" style="color:#22c55e;">A</button>
            <span style="width:1px;height:18px;background:var(--border,#2d3347);margin:0 2px;"></span>
            <button class="cel-rich-btn" data-cmd="createLink" title="Insérer un lien"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L14 19"/></svg></button>
            <button class="cel-rich-btn" data-cmd="removeFormat" title="Effacer mise en forme">✕</button>
        `;
        toolbar.addEventListener('mousedown', e => {
            e.preventDefault(); // Don't steal focus from editable
            e.stopPropagation();
            const btn = e.target.closest('.cel-rich-btn');
            if (!btn) return;
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.value || null;
            if (cmd === 'code') {
                // Toggle <code> wrapping around selection
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                const parentCode = sel.anchorNode?.parentElement?.closest('code');
                if (parentCode) {
                    // Unwrap: replace <code> with its text content
                    const text = document.createTextNode(parentCode.textContent);
                    parentCode.replaceWith(text);
                    sel.removeAllRanges();
                    const r = document.createRange();
                    r.selectNodeContents(text);
                    sel.addRange(r);
                } else if (!range.collapsed) {
                    // Wrap selection in <code>
                    const code = document.createElement('code');
                    code.className = 'cel-inline-code';
                    range.surroundContents(code);
                }
            } else if (cmd === 'createLink') {
                const sel = window.getSelection();
                if (!sel.rangeCount || sel.isCollapsed) return;
                const url = prompt('URL du lien :', 'https://');
                if (url) document.execCommand('createLink', false, url);
            } else {
                document.execCommand(cmd, false, val);
            }
            updateToolbarState();
        });
        div.appendChild(toolbar);

        const updateToolbarState = () => {
            toolbar.querySelectorAll('.cel-rich-btn[data-cmd]').forEach(btn => {
                const cmd = btn.dataset.cmd;
                if (['bold','italic','underline','strikethrough'].includes(cmd)) {
                    btn.classList.toggle('active', document.queryCommandState(cmd));
                }
                if (cmd === 'code') {
                    const sel = window.getSelection();
                    const inCode = sel.anchorNode?.parentElement?.closest('code');
                    btn.classList.toggle('active', !!inCode);
                }
                if (cmd === 'createLink') {
                    const sel = window.getSelection();
                    const inLink = sel.anchorNode?.parentElement?.closest('a');
                    btn.classList.toggle('active', !!inLink);
                }
            });
        };

        editable.addEventListener('input', updateToolbarState);
        editable.addEventListener('mouseup', updateToolbarState);
        editable.addEventListener('keyup', updateToolbarState);

        editable.focus();
        // Position caret at the double-click point (after layout via rAF)
        if (dblClickEvent) {
            requestAnimationFrame(() => {
                const x = dblClickEvent.clientX, y = dblClickEvent.clientY;
                let range;
                if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(x, y);
                } else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(x, y);
                    if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
                }
                if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
                updateToolbarState();
            });
        }

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            committed = true;
            div.classList.remove('editing');
            toolbar.remove();
            const rawHtml = editable.innerHTML;
            // Extract text from contentEditable while preserving tabs + line breaks.
            const plainText = CanvasEditor._editableToPlainText(editable);
            // Store both html (rich) and text (plain fallback)
            const dataUpdate = { text: plainText };
            // Keep html only when real rich formatting is present.
            // Plain line wrappers (<div>/<br>) are discarded so text auto-formatting
            // can transform "- item" + tabulations into bullet rows at render time.
            const hasRichFormatting = /<(?:b|strong|i|em|u|s|strike|code|a|span|font|mark|sub|sup|ul|ol|li|blockquote|h[1-6])\b/i.test(rawHtml);
            if (hasRichFormatting) {
                dataUpdate.html = rawHtml;
            } else {
                dataUpdate.html = ''; // clear previous rich formatting
            }
            this.updateData(el.id, { data: dataUpdate });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            toolbar.remove();
            this._refreshDOM(el.id);
        };

        editable.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); editable.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            e.stopPropagation(); // prevent editor keyboard shortcuts
        });

        editable.addEventListener('blur', e => {
            // Don't commit if clicking on the toolbar
            if (toolbar.contains(e.relatedTarget)) return;
            commit();
        });
    }

    _startInlineEditCode(div, el) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const textarea = document.createElement('textarea');
        textarea.className = 'cel-code-edit';
        textarea.value = el.data?.code || '';
        textarea.spellcheck = false;
        inner.innerHTML = '';
        inner.appendChild(textarea);
        textarea.focus();

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            committed = true;
            div.classList.remove('editing');
            this.updateData(el.id, { data: { code: textarea.value } });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            this._refreshDOM(el.id);
        };

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart, end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); textarea.blur(); }
            e.stopPropagation();
        });

        textarea.addEventListener('blur', commit);
    }

    _startInlineEditDefinition(div, el) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const container = document.createElement('div');
        container.className = 'cel-def-content';
        container.style.cursor = 'text';

        const fields = [
            { key: 'term',       label: 'Terme',      cls: 'cel-def-term',    value: el.data?.term       || '' },
            { key: 'definition', label: 'Définition',  cls: 'cel-def-body',    value: el.data?.definition || '' },
            { key: 'example',    label: 'Exemple',     cls: 'cel-def-example', value: el.data?.example    || '' },
        ];

        const editables = [];
        fields.forEach(({ key, label, cls, value }) => {
            const row = document.createElement('div');
            row.style.marginBottom = '0.35rem';
            const lbl = document.createElement('span');
            lbl.textContent = label + ' : ';
            lbl.className = 'cel-def-inline-label';
            const field = document.createElement('span');
            field.contentEditable = 'true';
            field.className = cls + ' cel-def-edit-field';
            field.textContent = value;
            field.dataset.key = key;
            row.appendChild(lbl);
            row.appendChild(field);
            container.appendChild(row);
            editables.push(field);
        });

        inner.innerHTML = '';
        inner.appendChild(container);
        editables[0].focus();

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (container.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const patch = {};
                editables.forEach(f => { patch[f.dataset.key] = f.textContent; });
                this.updateData(el.id, { data: patch });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            this._refreshDOM(el.id);
        };

        editables.forEach((field, i) => {
            field.addEventListener('keydown', e => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const next = editables[(i + (e.shiftKey ? editables.length - 1 : 1)) % editables.length];
                    next.focus();
                    const range = document.createRange();
                    range.selectNodeContents(next);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                if (e.key === 'Escape') { e.preventDefault(); revert(); }
                e.stopPropagation();
            });
            field.addEventListener('blur', commit);
        });
    }

    _startInlineEditCodeExample(div, el) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-code-example-content';
        wrapper.style.cursor = 'text';

        const label = document.createElement('div');
        label.className = 'cel-code-example-label';
        label.textContent = 'Exemple';

        const body = document.createElement('div');
        body.className = 'cel-code-example-text cel-def-edit-field';
        body.contentEditable = 'true';
        body.textContent = el.data?.text || '';

        const hint = document.createElement('div');
        hint.className = 'cel-codeexample-stepper-detail';
        hint.textContent = 'Le widget de code se règle dans le panneau de droite.';

        wrapper.appendChild(label);
        wrapper.appendChild(body);
        wrapper.appendChild(hint);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
        body.focus();

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                this.updateData(el.id, { data: { text: body.textContent } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            this._refreshDOM(el.id);
        };

        body.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                revert();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                body.blur();
            }
            e.stopPropagation();
        });
        body.addEventListener('blur', commit);
    }

    _startInlineEditList(div, el) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const ul = document.createElement('ul');
        ul.className = 'cel-list-content';
        ul.style.fontSize = `${s.fontSize || 22}px`;
        ul.style.color = s.color || 'var(--sl-text)';

        let committed = false;

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            this._refreshDOM(el.id);
        };

        const commitAll = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (ul.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const items = Array.from(ul.querySelectorAll('li')).map(li => li.textContent).filter(t => t !== '');
                this.updateData(el.id, { data: { items: items.length ? items : [''] } });
            });
        };

        const makeLi = (text = '') => {
            const li = document.createElement('li');
            li.contentEditable = 'true';
            li.textContent = text;
            li.addEventListener('blur', commitAll);
            return li;
        };

        // Single delegated keydown handler on the ul
        ul.addEventListener('keydown', e => {
            const li = e.target.closest('li');
            if (!li || li.parentElement !== ul) return;
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newLi = makeLi('');
                li.after(newLi);
                newLi.focus();
            }
            if (e.key === 'Backspace' && li.textContent === '') {
                e.preventDefault();
                const prev = li.previousElementSibling;
                li.remove();
                if (prev) {
                    prev.focus();
                    const range = document.createRange();
                    range.selectNodeContents(prev);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
        });

        (el.data?.items || ['']).forEach(text => ul.appendChild(makeLi(text)));
        inner.innerHTML = '';
        inner.appendChild(ul);
        const firstLi = ul.querySelector('li');
        if (firstLi) firstLi.focus();
    }

    _startInlineEditTable(div, el) {
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const rows = JSON.parse(JSON.stringify(el.data?.rows || [['', ''], ['', '']]));
        const wrapper = document.createElement('div');
        wrapper.className = 'cel-table-content';
        wrapper.style.fontSize = `${s.fontSize || 18}px`;
        wrapper.style.color = s.color || 'var(--sl-text,#cbd5e1)';

        const table = document.createElement('table');
        let committed = false;

        const readRows = () => {
            const result = [];
            table.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('th, td').forEach(cell => row.push(cell.textContent));
                result.push(row);
            });
            return result;
        };

        const commitAll = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                this.updateData(el.id, { data: { rows: readRows() } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            this._refreshDOM(el.id);
        };

        rows.forEach((row, ri) => {
            const tr = document.createElement('tr');
            (row || []).forEach(cellText => {
                const cell = document.createElement(ri === 0 ? 'th' : 'td');
                cell.contentEditable = 'true';
                cell.textContent = cellText;
                cell.addEventListener('keydown', e => {
                    e.stopPropagation();
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const next = e.shiftKey ? cell.previousElementSibling || cell.parentElement.previousElementSibling?.lastElementChild
                                                : cell.nextElementSibling || cell.parentElement.nextElementSibling?.firstElementChild;
                        if (next) next.focus();
                    }
                    if (e.key === 'Escape') { e.preventDefault(); revert(); }
                });
                cell.addEventListener('blur', commitAll);
                tr.appendChild(cell);
            });
            table.appendChild(tr);
        });

        wrapper.appendChild(table);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
        const firstCell = table.querySelector('th, td');
        if (firstCell) firstCell.focus();
    }

    _onMouseMove(e) {
        if (this._marquee && this._marquee.active) {
            const rect = this.container.getBoundingClientRect();
            const cx = (e.clientX - rect.left) / this.scale;
            const cy = (e.clientY - rect.top) / this.scale;
            const { startX, startY } = this._marquee;
            const x = Math.min(startX, cx), y = Math.min(startY, cy);
            const w = Math.abs(cx - startX), h = Math.abs(cy - startY);
            if (this._marqueeDiv) {
                this._marqueeDiv.style.display = 'block';
                this._marqueeDiv.style.left = x + 'px';
                this._marqueeDiv.style.top = y + 'px';
                this._marqueeDiv.style.width = w + 'px';
                this._marqueeDiv.style.height = h + 'px';
            }
            // Live highlight elements inside marquee
            this._marqueeRect = { x, y, w, h };
            return;
        }
        // Connector creation temp line
        if (this._connCreation && this._connectorMode) {
            const rect = this.container.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / this.scale;
            const my = (e.clientY - rect.top) / this.scale;
            this._updateTempLine(mx, my);
            return;
        }
        if (this._drag) {
            const { id, startMX, startMY, origX, origY, dragOrigins } = this._drag;
            const el = this.elements.find(e2 => e2.id === id);
            if (!el) return;
            const dx = (e.clientX - startMX) / this.scale;
            const dy = (e.clientY - startMY) / this.scale;
            let nx = Math.round(origX + dx);
            let ny = Math.round(origY + dy);
            const { x, y, guideXs, guideYs } = this._computeSnap({ id, x: nx, y: ny, w: el.w, h: el.h });
            const snapDX = x - nx, snapDY = y - ny;
            el.x = x; el.y = y;
            const div = this._dom(id);
            if (div) { div.style.left = x + 'px'; div.style.top = y + 'px'; }
            // Move other selected elements by the same delta
            if (dragOrigins) {
                for (const sid of this.selectedIds) {
                    if (sid === id) continue;
                    const sel = this.elements.find(e2 => e2.id === sid);
                    const orig = dragOrigins[sid];
                    if (!sel || !orig) continue;
                    sel.x = Math.round(orig.origX + dx + snapDX);
                    sel.y = Math.round(orig.origY + dy + snapDY);
                    const sdiv = this._dom(sid);
                    if (sdiv) { sdiv.style.left = sel.x + 'px'; sdiv.style.top = sel.y + 'px'; }
                }
            }
            this._showGuides(guideXs, guideYs);
            // Refresh connectors that reference moved elements
            if (this.connectors.length) this._refreshConnectors();
        }
        if (this._resize) {
            const { id, origEl, handle, startMX, startMY, aspectRatio } = this._resize;
            const el = this.elements.find(e2 => e2.id === id);
            if (!el) return;
            const dx = (e.clientX - startMX) / this.scale;
            const dy = (e.clientY - startMY) / this.scale;
            let { x, y, w, h } = origEl;
            const MIN_W = 40, MIN_H = 24;
            if (handle.includes('e'))  w = Math.max(MIN_W, origEl.w + dx);
            if (handle.includes('w'))  { const nw = Math.max(MIN_W, origEl.w - dx); x = origEl.x + (origEl.w - nw); w = nw; }
            if (handle.includes('s'))  h = Math.max(MIN_H, origEl.h + dy);
            if (handle.includes('n'))  { const nh = Math.max(MIN_H, origEl.h - dy); y = origEl.y + (origEl.h - nh); h = nh; }

            // Ctrl: constrain proportions (corner handles)
            if (e.ctrlKey && handle.length === 2 && aspectRatio) {
                const absDx = Math.abs(dx), absDy = Math.abs(dy);
                if (absDx / aspectRatio >= absDy) {
                    // Width drives
                    const newH = Math.max(MIN_H, w / aspectRatio);
                    if (handle.includes('n')) y = origEl.y + origEl.h - newH;
                    h = newH;
                } else {
                    // Height drives
                    const newW = Math.max(MIN_W, h * aspectRatio);
                    if (handle.includes('w')) x = origEl.x + origEl.w - newW;
                    w = newW;
                }
            }

            el.x = Math.round(x); el.y = Math.round(y);
            el.w = Math.round(w); el.h = Math.round(h);

            // Snap edges to other elements and canvas boundaries during resize
            const SNAP = 8;
            const guideXs = [], guideYs = [];
            const others = this.elements.filter(e2 => e2.id !== id);
            const xCands = [0, 640, 1280];
            const yCands = [0, 360, 720];
            if (this._gridSize > 0) {
                const g = this._gridSize;
                for (let gx = g; gx < 1280; gx += g) xCands.push(gx);
                for (let gy = g; gy < 720; gy += g) yCands.push(gy);
            }
            for (const o of others) {
                xCands.push(o.x, o.x + o.w / 2, o.x + o.w);
                yCands.push(o.y, o.y + o.h / 2, o.y + o.h);
            }

            // Snap the edges being resized
            if (handle.includes('e')) {
                const right = el.x + el.w;
                for (const cx of xCands) { if (Math.abs(right - cx) < SNAP) { el.w = cx - el.x; guideXs.push(cx); break; } }
            }
            if (handle.includes('w')) {
                for (const cx of xCands) { if (Math.abs(el.x - cx) < SNAP) { el.w += el.x - cx; el.x = cx; guideXs.push(cx); break; } }
            }
            if (handle.includes('s')) {
                const bottom = el.y + el.h;
                for (const cy of yCands) { if (Math.abs(bottom - cy) < SNAP) { el.h = cy - el.y; guideYs.push(cy); break; } }
            }
            if (handle.includes('n')) {
                for (const cy of yCands) { if (Math.abs(el.y - cy) < SNAP) { el.h += el.y - cy; el.y = cy; guideYs.push(cy); break; } }
            }

            // Symmetry snap: equal margins → snap to canvas center
            if (guideXs.length === 0 && (handle.includes('e') || handle.includes('w'))) {
                const lm = el.x, rm = 1280 - el.x - el.w;
                if (Math.abs(lm - rm) < SNAP) {
                    if (handle.includes('e')) el.w = 1280 - 2 * el.x;
                    else                      el.x = Math.round((1280 - el.w) / 2);
                    guideXs.push(640);
                }
            }
            if (guideYs.length === 0 && (handle.includes('n') || handle.includes('s'))) {
                const tm = el.y, bm = 720 - el.y - el.h;
                if (Math.abs(tm - bm) < SNAP) {
                    if (handle.includes('s')) el.h = 720 - 2 * el.y;
                    else                      el.y = Math.round((720 - el.h) / 2);
                    guideYs.push(360);
                }
            }
            this._showGuides(guideXs, guideYs);

            const div = this._dom(id);
            if (div) {
                div.style.left = el.x + 'px'; div.style.top = el.y + 'px';
                div.style.width = el.w + 'px'; div.style.height = el.h + 'px';
            }
            // Update position inputs if panel is open
            if (this.onPositionChange) this.onPositionChange(el);
            // Refresh connectors that reference resized elements
            if (this.connectors.length) this._refreshConnectors();
        }
    }

    _onMouseUp() {
        if (this._marquee && this._marquee.active) {
            if (this._marqueeDiv) this._marqueeDiv.style.display = 'none';
            if (this._marqueeRect) {
                const { x, y, w, h } = this._marqueeRect;
                // Select elements intersecting the marquee rectangle (min 4px drag)
                if (w > 4 || h > 4) {
                    if (!this._marquee.shift) {
                        this.selectedIds.clear();
                        this.selectedId = null;
                    }
                    for (const el of this.elements) {
                        const ex2 = el.x + el.w, ey2 = el.y + el.h;
                        if (el.x < x + w && ex2 > x && el.y < y + h && ey2 > y) {
                            this.selectedIds.add(el.id);
                            if (!this.selectedId) this.selectedId = el.id;
                        }
                    }
                    this._updateSelectionVisuals();
                    this.onSelect(this.selectedId ? (this.elements.find(e => e.id === this.selectedId) || null) : null);
                }
            }
            this._marquee = null;
            this._marqueeRect = null;
            return;
        }
        if (this._drag || this._resize) {
            this._clearGuides();
            const id = (this._drag || this._resize).id;
            this._drag = null;
            this._resize = null;
            const el = this.elements.find(e2 => e2.id === id);
            if (el && this.onPositionChange) this.onPositionChange(el);
            this.onChange(this.serialize());
        }
    }

    /* ── Nudge & Align/Distribute ─────────────────────────── */

    nudge(dx, dy) {
        const ids = this.selectedIds.size > 0 ? [...this.selectedIds] : (this.selectedId ? [this.selectedId] : []);
        if (!ids.length) return;
        let moved = false;
        for (const id of ids) {
            const el = this.elements.find(e => e.id === id);
            if (!el || this._isElementLocked(el)) continue;
            el.x = Math.round(el.x + dx);
            el.y = Math.round(el.y + dy);
            const div = this._dom(id);
            if (div) { div.style.left = el.x + 'px'; div.style.top = el.y + 'px'; }
            moved = true;
        }
        if (!moved) return;
        if (this.onPositionChange) this.onPositionChange(this.elements.find(e => e.id === this.selectedId));
        this.onChange(this.serialize());
    }

    alignElements(direction) {
        const els = this.getSelectedElements().filter(el => !this._isElementLocked(el));
        if (els.length < 2) return;
        switch (direction) {
            case 'left':   { const mn = Math.min(...els.map(e => e.x)); els.forEach(e => e.x = mn); break; }
            case 'right':  { const mx = Math.max(...els.map(e => e.x + e.w)); els.forEach(e => e.x = mx - e.w); break; }
            case 'top':    { const mn = Math.min(...els.map(e => e.y)); els.forEach(e => e.y = mn); break; }
            case 'bottom': { const mx = Math.max(...els.map(e => e.y + e.h)); els.forEach(e => e.y = mx - e.h); break; }
            case 'center-h': { const cx = Math.round(els.reduce((s, e) => s + e.x + e.w / 2, 0) / els.length); els.forEach(e => e.x = Math.round(cx - e.w / 2)); break; }
            case 'center-v': { const cy = Math.round(els.reduce((s, e) => s + e.y + e.h / 2, 0) / els.length); els.forEach(e => e.y = Math.round(cy - e.h / 2)); break; }
        }
        els.forEach(e => this._refreshDOM(e.id));
        this.onChange(this.serialize());
    }

    distributeElements(axis) {
        const els = this.getSelectedElements().filter(el => !this._isElementLocked(el));
        if (els.length < 3) return;
        if (axis === 'h') {
            els.sort((a, b) => a.x - b.x);
            const totalW = els.reduce((s, e) => s + e.w, 0);
            const minX = els[0].x, maxX = els[els.length - 1].x + els[els.length - 1].w;
            const gap = (maxX - minX - totalW) / (els.length - 1);
            let cx = minX;
            els.forEach(e => { e.x = Math.round(cx); cx += e.w + gap; });
        } else {
            els.sort((a, b) => a.y - b.y);
            const totalH = els.reduce((s, e) => s + e.h, 0);
            const minY = els[0].y, maxY = els[els.length - 1].y + els[els.length - 1].h;
            const gap = (maxY - minY - totalH) / (els.length - 1);
            let cy = minY;
            els.forEach(e => { e.y = Math.round(cy); cy += e.h + gap; });
        }
        els.forEach(e => this._refreshDOM(e.id));
        this.onChange(this.serialize());
    }

    /**
     * Réorganise intelligemment la sélection en grille dans une zone de travail.
     * - Préserve l'ordre visuel (haut → bas, gauche → droite)
     * - Réduit légèrement les éléments si nécessaire pour éviter les chevauchements
     * - Conserve les proportions lors du redimensionnement
     */
    autoLayoutSelected(options = {}) {
        const els = this.getSelectedElements().filter(el => !this._isElementLocked(el));
        if (els.length < 2) return { moved: false, count: els.length };

        const CANVAS_W = 1280;
        const CANVAS_H = 720;
        const margin = Math.max(8, Math.min(140, Number(options.margin ?? 36)));
        const gap = Math.max(4, Math.min(80, Number(options.gap ?? 18)));
        const resizeToFit = options.resizeToFit !== false;

        const sorted = [...els].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const minX = Math.min(...sorted.map(e => e.x));
        const maxX = Math.max(...sorted.map(e => e.x + e.w));
        const minY = Math.min(...sorted.map(e => e.y));
        const maxY = Math.max(...sorted.map(e => e.y + e.h));
        const selectedW = Math.max(1, maxX - minX);
        const selectedH = Math.max(1, maxY - minY);

        // Zone cible: centrée sur le canvas, mais bornée par la taille de la sélection.
        const areaW = Math.max(220, Math.min(CANVAS_W - margin * 2, Math.max(selectedW + margin, CANVAS_W - margin * 2)));
        const areaH = Math.max(180, Math.min(CANVAS_H - margin * 2, Math.max(selectedH + margin, CANVAS_H - margin * 2)));
        const areaX = Math.round((CANVAS_W - areaW) / 2);
        const areaY = Math.round((CANVAS_H - areaH) / 2);

        const targetCols = Math.max(1, Math.round(Math.sqrt((sorted.length * areaW) / areaH)));
        let best = null;
        for (let cols = 1; cols <= sorted.length; cols++) {
            const rows = Math.ceil(sorted.length / cols);
            const cellW = (areaW - gap * (cols - 1)) / cols;
            const cellH = (areaH - gap * (rows - 1)) / rows;
            if (cellW < 44 || cellH < 44) continue;

            let scaleSum = 0;
            for (const el of sorted) {
                const scale = resizeToFit ? Math.min(1, cellW / Math.max(1, el.w), cellH / Math.max(1, el.h)) : 1;
                scaleSum += scale;
            }
            const avgScale = scaleSum / sorted.length;
            // Score: privilégie la lisibilité (avgScale) puis un nombre de colonnes raisonnable.
            const score = avgScale * 100 - Math.abs(cols - targetCols) * 2;
            if (!best || score > best.score) {
                best = { cols, rows, cellW, cellH, score };
            }
        }
        if (!best) return { moved: false, count: sorted.length };

        let moved = false;
        for (let i = 0; i < sorted.length; i++) {
            const el = sorted[i];
            const col = i % best.cols;
            const row = Math.floor(i / best.cols);
            const cellX = areaX + col * (best.cellW + gap);
            const cellY = areaY + row * (best.cellH + gap);

            let nextW = el.w;
            let nextH = el.h;
            if (resizeToFit) {
                const fit = Math.min(1, best.cellW / Math.max(1, el.w), best.cellH / Math.max(1, el.h));
                if (fit < 0.999) {
                    nextW = Math.max(24, Math.round(el.w * fit));
                    nextH = Math.max(24, Math.round(el.h * fit));
                }
            }

            const nextX = Math.max(0, Math.min(CANVAS_W - nextW, Math.round(cellX + (best.cellW - nextW) / 2)));
            const nextY = Math.max(0, Math.min(CANVAS_H - nextH, Math.round(cellY + (best.cellH - nextH) / 2)));

            if (nextX !== el.x || nextY !== el.y || nextW !== el.w || nextH !== el.h) {
                el.x = nextX;
                el.y = nextY;
                el.w = nextW;
                el.h = nextH;
                moved = true;
            }
            this._refreshDOM(el.id);
        }

        if (!moved) return { moved: false, count: sorted.length };
        if (this.connectors.length) this._refreshConnectors();
        if (this.onPositionChange) this.onPositionChange(this.elements.find(e => e.id === this.selectedId) || null);
        this.onChange(this.serialize());
        return { moved: true, count: sorted.length, cols: best.cols, rows: best.rows };
    }

    removeSelected() {
        // If a connector is selected, remove it
        if (this._selectedConnectorId) {
            this.removeConnector(this._selectedConnectorId);
            return;
        }
        const ids = [...this.selectedIds];
        if (!ids.length) return;
        let removed = false;
        ids.forEach(id => {
            const el = this.elements.find(e => e.id === id);
            if (!el || this._isElementLocked(el)) return;
            const dom = this._dom(id);
            if (dom) dom.remove();
            this.elements = this.elements.filter(e => e.id !== id);
            // Remove connectors referencing removed elements
            this.connectors = this.connectors.filter(c => c.sourceId !== id && c.targetId !== id);
            removed = true;
        });
        if (!removed) return;
        this.selectedIds.clear();
        this.selectedId = null;
        this.onSelect(null);
        this._refreshConnectors();
        this.onChange(this.serialize());
    }

    /* ── Alignment guides ─────────────────────────────────── */

    _computeSnap({ id, x: nx, y: ny, w, h }) {
        const SNAP = 8;
        const others = this.elements.filter(e => e.id !== id);

        // Candidate snap lines
        const xCands = [0, 640, 1280];
        const yCands = [0, 360, 720];
        // Grid snap candidates
        if (this._gridSize > 0) {
            const g = this._gridSize;
            for (let gx = g; gx < 1280; gx += g) xCands.push(gx);
            for (let gy = g; gy < 720; gy += g) yCands.push(gy);
        }
        for (const o of others) {
            xCands.push(o.x, o.x + o.w / 2, o.x + o.w);
            yCands.push(o.y, o.y + o.h / 2, o.y + o.h);
        }

        // Edges of the dragged element
        const xEdgeOffsets = [0, w / 2, w];    // left, center, right
        const yEdgeOffsets = [0, h / 2, h];    // top, center, bottom

        let bestDX = SNAP, snapDX = 0, guideXs = [];
        let bestDY = SNAP, snapDY = 0, guideYs = [];

        for (const cx of xCands) {
            for (const off of xEdgeOffsets) {
                const d = Math.abs(cx - (nx + off));
                if (d < bestDX) {
                    bestDX = d;
                    snapDX = cx - off - nx;
                    guideXs = [cx];
                }
            }
        }
        for (const cy of yCands) {
            for (const off of yEdgeOffsets) {
                const d = Math.abs(cy - (ny + off));
                if (d < bestDY) {
                    bestDY = d;
                    snapDY = cy - off - ny;
                    guideYs = [cy];
                }
            }
        }

        return {
            x: Math.round(nx + (bestDX < SNAP ? snapDX : 0)),
            y: Math.round(ny + (bestDY < SNAP ? snapDY : 0)),
            guideXs: bestDX < SNAP ? guideXs : [],
            guideYs: bestDY < SNAP ? guideYs : [],
        };
    }

    _showGuides(xs, ys) {
        const layer = this.container.querySelector('.canvas-guide-layer');
        if (!layer) return;
        layer.innerHTML = '';
        // Compensate for the preview scale so guides are always ~2px visually
        const thick = Math.ceil(2 / (this.scale || 1));
        xs.forEach(x => {
            const line = document.createElement('div');
            line.className = 'canvas-guide-v';
            line.style.left = (x - Math.floor(thick / 2)) + 'px';
            line.style.width = thick + 'px';
            layer.appendChild(line);
        });
        ys.forEach(y => {
            const line = document.createElement('div');
            line.className = 'canvas-guide-h';
            line.style.top = (y - Math.floor(thick / 2)) + 'px';
            line.style.height = thick + 'px';
            layer.appendChild(line);
        });
    }

    _clearGuides() {
        const layer = this.container.querySelector('.canvas-guide-layer');
        if (layer) layer.innerHTML = '';
    }
}

function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.CanvasEditor = CanvasEditor;
