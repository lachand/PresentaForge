/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-masters
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-masters.js"></script>
 */
/* editor-masters.js — Slide Masters / Layouts system */
/* globals: editor, canvasEditor, onUpdate, notify, renderSlideList, renderPreview, esc */

/**
 * Masters are reusable slide templates stored in the presentation data.
 * Structure: editor.data.masters = [ { id, name, slide: { ... } }, ... ]
 * A slide can reference a master via slide.masterId.
 * Applying a master copies its elements/styles; updating a master can cascade.
 */

/* ── Built-in Layouts (dispositions) ───────────────────── */
const BUILT_IN_LAYOUTS = [
    {
        id: 'layout-title-subtitle',
        name: 'Titre + Sous-titre',
        category: 'Titre',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 100, y: 200, w: 1080, h: 100, z: 1, data: { text: 'Titre principal' }, style: { fontSize: 52, fontWeight: 700, color: 'var(--sl-text)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'text', x: 200, y: 320, w: 880, h: 60, z: 2, data: { text: 'Sous-titre de la présentation' }, style: { fontSize: 24, fontWeight: 400, color: 'var(--sl-text)', textAlign: 'center', opacity: 0.6, fontFamily: 'var(--sl-font-body)' } },
            ]
        }
    },
    {
        id: 'layout-title-content',
        name: 'Titre + Contenu',
        category: 'Classique',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 60, y: 40, w: 1160, h: 70, z: 1, data: { text: 'Titre de la slide' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-text)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'shape', x: 60, y: 115, w: 200, h: 4, z: 2, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-accent, #818cf8)' } },
                { id: 'm3', type: 'text', x: 60, y: 140, w: 1160, h: 520, z: 3, data: { text: 'Contenu ici…' }, style: { fontSize: 22, color: 'var(--sl-text)', textAlign: 'left', fontFamily: 'var(--sl-font-body)' } },
            ]
        }
    },
    {
        id: 'layout-two-columns',
        name: '2 colonnes',
        category: 'Colonnes',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 60, y: 40, w: 1160, h: 70, z: 1, data: { text: 'Titre' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-text)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'text', x: 60, y: 140, w: 560, h: 520, z: 2, data: { text: 'Colonne gauche' }, style: { fontSize: 20, color: 'var(--sl-text)', fontFamily: 'var(--sl-font-body)' } },
                { id: 'm3', type: 'text', x: 660, y: 140, w: 560, h: 520, z: 3, data: { text: 'Colonne droite' }, style: { fontSize: 20, color: 'var(--sl-text)', fontFamily: 'var(--sl-font-body)' } },
            ]
        }
    },
    {
        id: 'layout-three-columns',
        name: '3 colonnes',
        category: 'Colonnes',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 40, w: 1200, h: 70, z: 1, data: { text: 'Titre' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'text', x: 40, y: 130, w: 380, h: 530, z: 2, data: { text: 'Colonne 1' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'text', x: 450, y: 130, w: 380, h: 530, z: 3, data: { text: 'Colonne 2' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'text', x: 860, y: 130, w: 380, h: 530, z: 4, data: { text: 'Colonne 3' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-2x2-grid',
        name: 'Grille 2 × 2',
        category: 'Grille',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 20, w: 1200, h: 50, z: 1, data: { text: 'Titre' }, style: { fontSize: 32, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 40, y: 80, w: 580, h: 295, z: 2, data: { title: 'Carte 1', items: ['Point clé'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'card', x: 660, y: 80, w: 580, h: 295, z: 3, data: { title: 'Carte 2', items: ['Point clé'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 40, y: 395, w: 580, h: 295, z: 4, data: { title: 'Carte 3', items: ['Point clé'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm5', type: 'card', x: 660, y: 395, w: 580, h: 295, z: 5, data: { title: 'Carte 4', items: ['Point clé'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-1-plus-2',
        name: '1 + 2 (grand + petits)',
        category: 'Asymétrique',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 30, w: 1200, h: 60, z: 1, data: { text: 'Titre' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'text', x: 40, y: 110, w: 560, h: 550, z: 2, data: { text: 'Contenu principal' }, style: { fontSize: 22, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'text', x: 630, y: 110, w: 570, h: 265, z: 3, data: { text: 'Bloc haut' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'text', x: 630, y: 395, w: 570, h: 265, z: 4, data: { text: 'Bloc bas' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-hero-text',
        name: 'Hero + Texte',
        category: 'Titre',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'shape', x: 0, y: 0, w: 1280, h: 360, z: 1, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.12 } },
                { id: 'm2', type: 'heading', x: 60, y: 80, w: 1160, h: 100, z: 2, data: { text: 'Titre principal' }, style: { fontSize: 48, fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm3', type: 'text', x: 60, y: 200, w: 1160, h: 60, z: 3, data: { text: 'Sous-titre ou description courte' }, style: { fontSize: 22, color: 'var(--sl-muted)', textAlign: 'center' } },
                { id: 'm4', type: 'text', x: 80, y: 400, w: 1120, h: 260, z: 4, data: { text: 'Contenu détaillé…' }, style: { fontSize: 20, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-sidebar',
        name: 'Sidebar',
        category: 'Asymétrique',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'shape', x: 0, y: 0, w: 320, h: 720, z: 1, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.08 } },
                { id: 'm2', type: 'heading', x: 30, y: 40, w: 260, h: 60, z: 2, data: { text: 'Section' }, style: { fontSize: 26, fontWeight: 700, color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm3', type: 'list', x: 20, y: 120, w: 280, h: 500, z: 3, data: { items: ['Point 1', 'Point 2', 'Point 3'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'heading', x: 360, y: 40, w: 860, h: 70, z: 4, data: { text: 'Titre principal' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm5', type: 'text', x: 360, y: 130, w: 860, h: 530, z: 5, data: { text: 'Contenu principal…' }, style: { fontSize: 20, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-image-fullscreen',
        name: 'Image plein écran',
        category: 'Image',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'image', x: 0, y: 0, w: 1280, h: 720, z: 1, data: { src: '' }, style: { objectFit: 'cover' } },
                { id: 'm2', type: 'heading', x: 60, y: 560, w: 1160, h: 80, z: 2, data: { text: 'Légende' }, style: { fontSize: 32, fontWeight: 700, color: '#ffffff', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' } },
            ]
        }
    },
    {
        id: 'layout-image-text',
        name: 'Image + Texte',
        category: 'Image',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 60, y: 40, w: 1160, h: 70, z: 1, data: { text: 'Titre' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'image', x: 60, y: 130, w: 560, h: 520, z: 2, data: { src: '' }, style: { objectFit: 'cover', borderRadius: '12px' } },
                { id: 'm3', type: 'text', x: 660, y: 130, w: 560, h: 520, z: 3, data: { text: 'Description de l\'image…' }, style: { fontSize: 20, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-section-break',
        name: 'Pause / Section',
        category: 'Titre',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'shape', x: 0, y: 0, w: 1280, h: 720, z: 1, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-accent, #818cf8)', opacity: 0.15 } },
                { id: 'm2', type: 'heading', x: 200, y: 260, w: 880, h: 100, z: 2, data: { text: 'Nouvelle section' }, style: { fontSize: 48, fontWeight: 800, color: 'var(--sl-text)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm3', type: 'text', x: 300, y: 370, w: 680, h: 50, z: 3, data: { text: 'Description optionnelle' }, style: { fontSize: 20, color: 'var(--sl-text)', textAlign: 'center', opacity: 0.5, fontFamily: 'var(--sl-font-body)' } },
            ]
        }
    },
    {
        id: 'layout-comparison',
        name: 'Comparaison',
        category: 'Classique',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 60, y: 40, w: 1160, h: 70, z: 1, data: { text: 'Comparaison' }, style: { fontSize: 36, fontWeight: 700, color: 'var(--sl-text)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 60, y: 140, w: 560, h: 520, z: 2, data: { title: '✅ Option A', text: 'Avantages…' }, style: { fill: 'rgba(52,211,153,0.1)', borderLeft: '4px solid #34d399', borderRadius: '0 12px 12px 0' } },
                { id: 'm3', type: 'card', x: 660, y: 140, w: 560, h: 520, z: 3, data: { title: '❌ Option B', text: 'Inconvénients…' }, style: { fill: 'rgba(248,113,113,0.1)', borderLeft: '4px solid #f87171', borderRadius: '0 12px 12px 0' } },
            ]
        }
    },
    {
        id: 'layout-3-cards-row',
        name: '3 cartes en ligne',
        category: 'Grille',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 30, w: 1200, h: 60, z: 1, data: { text: 'Titre' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 40, y: 110, w: 380, h: 560, z: 2, data: { title: 'Carte 1', items: ['Détail'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'card', x: 450, y: 110, w: 380, h: 560, z: 3, data: { title: 'Carte 2', items: ['Détail'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 860, y: 110, w: 380, h: 560, z: 4, data: { title: 'Carte 3', items: ['Détail'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-code-explanation',
        name: 'Code + Explication',
        category: 'Classique',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 30, w: 1200, h: 60, z: 1, data: { text: 'Titre' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'code', x: 40, y: 110, w: 700, h: 560, z: 2, data: { code: '// Code ici…', language: 'javascript' }, style: { fontSize: 16 } },
                { id: 'm3', type: 'text', x: 770, y: 110, w: 470, h: 560, z: 3, data: { text: 'Explication du code…' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-timeline-horizontal',
        name: 'Timeline horizontale',
        category: 'Timeline',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 58, z: 1, data: { text: 'Roadmap / timeline' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'shape', x: 90, y: 210, w: 1100, h: 6, z: 2, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.35, borderRadius: '4px' } },
                { id: 'm3', type: 'card', x: 40, y: 250, w: 280, h: 390, z: 3, data: { title: 'T1', text: 'Objectif + livrables' }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 340, y: 250, w: 280, h: 390, z: 4, data: { title: 'T2', text: 'Objectif + livrables' }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm5', type: 'card', x: 640, y: 250, w: 280, h: 390, z: 5, data: { title: 'T3', text: 'Objectif + livrables' }, style: { fontSize: 16, color: 'var(--sl-text)' } },
                { id: 'm6', type: 'card', x: 940, y: 250, w: 280, h: 390, z: 6, data: { title: 'T4', text: 'Objectif + livrables' }, style: { fontSize: 16, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-kpi-dashboard',
        name: 'Dashboard KPI',
        category: 'Data',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 60, z: 1, data: { text: 'Indicateurs clés' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 40, y: 106, w: 286, h: 180, z: 2, data: { title: 'KPI 1', text: '98%' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'card', x: 346, y: 106, w: 286, h: 180, z: 3, data: { title: 'KPI 2', text: '+24%' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 652, y: 106, w: 286, h: 180, z: 4, data: { title: 'KPI 3', text: '2.1s' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm5', type: 'card', x: 958, y: 106, w: 286, h: 180, z: 5, data: { title: 'KPI 4', text: '1 240' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm6', type: 'text', x: 40, y: 308, w: 800, h: 352, z: 6, data: { text: 'Analyse des variations, contexte, actions proposées…' }, style: { fontSize: 20, color: 'var(--sl-text)' } },
                { id: 'm7', type: 'card', x: 860, y: 308, w: 380, h: 352, z: 7, data: { title: 'Décision', items: ['Action 1', 'Action 2', 'Action 3'] }, style: { fontSize: 16, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-problem-solution-impact',
        name: 'Problème / Solution / Impact',
        category: 'Pédagogie',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 60, z: 1, data: { text: 'Structure d’argumentation' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 40, y: 110, w: 380, h: 560, z: 2, data: { title: 'Problème', text: 'Contexte, symptôme, limites…' }, style: { fontSize: 18, color: 'var(--sl-text)', borderLeft: '4px solid #f59e0b' } },
                { id: 'm3', type: 'card', x: 450, y: 110, w: 380, h: 560, z: 3, data: { title: 'Solution', text: 'Approche, méthode, implémentation…' }, style: { fontSize: 18, color: 'var(--sl-text)', borderLeft: '4px solid #60a5fa' } },
                { id: 'm4', type: 'card', x: 860, y: 110, w: 380, h: 560, z: 4, data: { title: 'Impact', text: 'Bénéfices, risques, KPIs…' }, style: { fontSize: 18, color: 'var(--sl-text)', borderLeft: '4px solid #34d399' } },
            ]
        }
    },
    {
        id: 'layout-workshop',
        name: 'Atelier (consigne/exercice/retour)',
        category: 'Atelier',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 56, z: 1, data: { text: 'Atelier en classe' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'list', x: 40, y: 100, w: 360, h: 580, z: 2, data: { items: ['Consigne 1', 'Consigne 2', 'Consigne 3'] }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'text', x: 430, y: 100, w: 420, h: 580, z: 3, data: { text: 'Zone exercice / démonstration…' }, style: { fontSize: 22, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 880, y: 100, w: 360, h: 580, z: 4, data: { title: 'Retour attendu', items: ['Critère A', 'Critère B', 'Critère C'] }, style: { fontSize: 17, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-agenda-checkpoints',
        name: 'Agenda + checkpoints',
        category: 'Pédagogie',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 58, z: 1, data: { text: 'Plan de séance' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'list', x: 40, y: 100, w: 520, h: 570, z: 2, data: { items: ['1. Intro (10 min)', '2. Démo (20 min)', '3. Exercice (30 min)', '4. Debrief (10 min)'] }, style: { fontSize: 21, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'card', x: 590, y: 100, w: 650, h: 270, z: 3, data: { title: 'Checkpoint milieu', text: 'Questions de vérification + ajustements.' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 590, y: 400, w: 650, h: 270, z: 4, data: { title: 'Checkpoint fin', text: 'Synthèse + actions à retenir.' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-image-comparison',
        name: 'Comparatif visuel (2 images)',
        category: 'Image',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 58, z: 1, data: { text: 'Avant / Après' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'image', x: 40, y: 100, w: 590, h: 430, z: 2, data: { src: '' }, style: { objectFit: 'cover', borderRadius: '12px' } },
                { id: 'm3', type: 'image', x: 650, y: 100, w: 590, h: 430, z: 3, data: { src: '' }, style: { objectFit: 'cover', borderRadius: '12px' } },
                { id: 'm4', type: 'text', x: 40, y: 544, w: 590, h: 66, z: 4, data: { text: 'Image A: contexte / commentaire' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm5', type: 'text', x: 650, y: 544, w: 590, h: 66, z: 5, data: { text: 'Image B: contexte / commentaire' }, style: { fontSize: 18, color: 'var(--sl-text)' } },
                { id: 'm6', type: 'text', x: 40, y: 624, w: 1200, h: 56, z: 6, data: { text: 'Conclusion visuelle et implications…' }, style: { fontSize: 20, color: 'var(--sl-text)' } },
            ]
        }
    },
    {
        id: 'layout-quote-focus',
        name: 'Citation focus',
        category: 'Titre',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'shape', x: 0, y: 0, w: 1280, h: 720, z: 1, data: { shapeType: 'rect' }, style: { fill: 'var(--sl-primary)', opacity: 0.08 } },
                { id: 'm2', type: 'text', x: 150, y: 170, w: 980, h: 250, z: 2, data: { text: '“Une citation forte pour poser l’idée principale.”' }, style: { fontSize: 46, fontWeight: 700, color: 'var(--sl-heading)', textAlign: 'center', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm3', type: 'text', x: 150, y: 450, w: 980, h: 70, z: 3, data: { text: 'Auteur / source' }, style: { fontSize: 26, color: 'var(--sl-muted)', textAlign: 'center', fontFamily: 'var(--sl-font-body)' } },
                { id: 'm4', type: 'text', x: 150, y: 550, w: 980, h: 90, z: 4, data: { text: 'Message clé ou transition vers la suite.' }, style: { fontSize: 20, color: 'var(--sl-text)', textAlign: 'center' } },
            ]
        }
    },
    {
        id: 'layout-roadmap-quarters',
        name: 'Roadmap trimestrielle',
        category: 'Timeline',
        slide: {
            type: 'canvas',
            elements: [
                { id: 'm1', type: 'heading', x: 40, y: 24, w: 1200, h: 58, z: 1, data: { text: 'Roadmap 12 mois' }, style: { fontSize: 34, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                { id: 'm2', type: 'card', x: 40, y: 110, w: 280, h: 560, z: 2, data: { title: 'Q1', items: ['Init', 'Prototype', 'Validation'] }, style: { fontSize: 17, color: 'var(--sl-text)' } },
                { id: 'm3', type: 'card', x: 340, y: 110, w: 280, h: 560, z: 3, data: { title: 'Q2', items: ['Build', 'Itération', 'Tests'] }, style: { fontSize: 17, color: 'var(--sl-text)' } },
                { id: 'm4', type: 'card', x: 640, y: 110, w: 280, h: 560, z: 4, data: { title: 'Q3', items: ['Déploiement', 'Support', 'Mesure'] }, style: { fontSize: 17, color: 'var(--sl-text)' } },
                { id: 'm5', type: 'card', x: 940, y: 110, w: 280, h: 560, z: 5, data: { title: 'Q4', items: ['Industrialisation', 'Bilan', 'Projection'] }, style: { fontSize: 17, color: 'var(--sl-text)' } },
            ]
        }
    },
];

/* ── Built-in Masters (saved templates) ────────────────── */
const BUILT_IN_MASTERS = BUILT_IN_LAYOUTS;
const MASTER_LOCK_PREF_KEY = 'oei-master-apply-locked';
const MASTER_LAYOUT_VERSION = '2026.03';

function _getMasters() {
    return [...BUILT_IN_MASTERS, ...(editor.data?.masters || [])];
}

function _newElementIds(elements) {
    return elements.map(el => ({
        ...JSON.parse(JSON.stringify(el)),
        id: 'el_' + Math.random().toString(36).slice(2, 9)
    }));
}

function _getApplyLockedPref() {
    try { return localStorage.getItem(MASTER_LOCK_PREF_KEY) !== '0'; }
    catch (_) { return true; }
}

function _setApplyLockedPref(locked) {
    try { localStorage.setItem(MASTER_LOCK_PREF_KEY, locked ? '1' : '0'); } catch (_) {}
}

function _masterThemeFingerprint() {
    const payload = {
        theme: editor?.data?.theme || null,
        designTokens: editor?.data?.designTokens || null,
    };
    const raw = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return `th-${(hash >>> 0).toString(36)}`;
}

function _markSlideMasterApplied(slide, masterId, lockMasterElements, masterVersion = MASTER_LAYOUT_VERSION, themeFingerprint = _masterThemeFingerprint()) {
    if (!slide || !masterId) return;
    slide.masterId = masterId;
    slide.masterLocked = !!lockMasterElements;
    slide.masterVersion = String(masterVersion || MASTER_LAYOUT_VERSION);
    slide.masterThemeFingerprint = String(themeFingerprint || _masterThemeFingerprint());
    slide.masterAppliedAt = new Date().toISOString();
}

function _isSlideMasterOutdated(slide) {
    if (!slide?.masterId) return false;
    if (String(slide.masterVersion || '') !== MASTER_LAYOUT_VERSION) return true;
    const currentFingerprint = _masterThemeFingerprint();
    return String(slide.masterThemeFingerprint || '') !== currentFingerprint;
}

function _stripMasterFlags(elements) {
    return (elements || []).map(el => {
        const copy = JSON.parse(JSON.stringify(el));
        delete copy.masterElement;
        delete copy.locked;
        return copy;
    });
}

function _materializeMasterSlide(master, lockMasterElements) {
    const copy = JSON.parse(JSON.stringify(master.slide || {}));
    const withIds = _newElementIds(copy.elements || []);
    copy.elements = withIds.map(el => ({
        ...el,
        masterElement: true,
        locked: lockMasterElements ? true : !!el.locked,
    }));
    copy.connectors = copy.connectors || [];
    return copy;
}

/**
 * Apply a master/layout template to the current slide, replacing its elements.
 */
function applyMaster(masterId, options = {}) {
    const all = [...BUILT_IN_LAYOUTS, ...(editor.data?.masters || [])];
    const master = all.find(m => m.id === masterId);
    if (!master) return;
    const slide = editor.currentSlide;
    if (!slide) return;
    const lockMasterElements = !!options.lockMasterElements;

    const copy = _materializeMasterSlide(master, lockMasterElements);

    slide.type = 'canvas';
    slide.elements = copy.elements;
    slide.connectors = copy.connectors || [];
    _markSlideMasterApplied(
        slide,
        masterId,
        lockMasterElements,
        master.version || MASTER_LAYOUT_VERSION,
        master.themeFingerprint || _masterThemeFingerprint()
    );

    editor._push();
    if (!options.silent) notify(lockMasterElements ? 'Master appliqué (verrouillé)' : 'Master appliqué', 'success');
    onUpdate('slides');
}

/**
 * Save the current slide as a custom master.
 */
function saveAsMaster(name) {
    const slide = editor.currentSlide;
    if (!slide || slide.type !== 'canvas') {
        notify('Sélectionnez un slide canvas', 'info');
        return;
    }
    if (!name) {
        name = prompt('Nom du master :');
        if (!name) return;
    }
    editor.data.masters = editor.data.masters || [];
    const master = {
        id: 'master-custom-' + Date.now(),
        name: name,
        category: 'Personnalisé',
        version: MASTER_LAYOUT_VERSION,
        themeFingerprint: _masterThemeFingerprint(),
        slide: JSON.parse(JSON.stringify({
            type: 'canvas',
            elements: _stripMasterFlags(slide.elements || []),
            connectors: slide.connectors || [],
        }))
    };
    editor.data.masters.push(master);
    editor._push();
    notify(`Master "${name}" enregistré`, 'success');
    _renderMastersContent();
}

/**
 * Delete a custom master (cannot delete built-in).
 */
function deleteMaster(masterId) {
    if (!editor.data?.masters) return;
    const idx = editor.data.masters.findIndex(m => m.id === masterId);
    if (idx === -1) return;
    const name = editor.data.masters[idx].name;
    editor.data.masters.splice(idx, 1);
    editor._push();
    notify(`Master "${name}" supprimé`, 'info');
    _renderMastersContent();
}

/**
 * Update all slides that reference a given master.
 */
function updateMasterSlides(masterId) {
    const all = [...BUILT_IN_LAYOUTS, ...(editor.data?.masters || [])];
    const master = all.find(m => m.id === masterId);
    if (!master) return;
    let count = 0;
    for (const slide of editor.data.slides) {
        if (slide.masterId === masterId) {
            const copy = _materializeMasterSlide(master, !!slide.masterLocked);
            slide.elements = copy.elements;
            slide.connectors = copy.connectors || [];
            _markSlideMasterApplied(
                slide,
                masterId,
                !!slide.masterLocked,
                master.version || MASTER_LAYOUT_VERSION,
                master.themeFingerprint || _masterThemeFingerprint()
            );
            count++;
        }
    }
    if (count > 0) {
        editor._push();
        onUpdate('slides');
        notify(`${count} slide(s) mis à jour`, 'success');
    } else {
        notify('Aucune slide utilise ce master', 'info');
    }
}

function syncCurrentSlideMaster() {
    const slide = editor.currentSlide;
    if (!slide || !slide.masterId) {
        notify('Ce slide n\'utilise pas de master', 'info');
        return;
    }
    const wasOutdated = _isSlideMasterOutdated(slide);
    applyMaster(slide.masterId, { lockMasterElements: !!slide.masterLocked, silent: true });
    notify(wasOutdated ? 'Slide migré vers la version courante du master' : 'Slide re-synchronisé depuis le master', 'success');
}

function detachCurrentSlideMaster() {
    const slide = editor.currentSlide;
    if (!slide) return;
    if (!slide.masterId) {
        notify('Ce slide n\'utilise pas de master', 'info');
        return;
    }
    delete slide.masterId;
    delete slide.masterLocked;
    delete slide.masterVersion;
    delete slide.masterThemeFingerprint;
    delete slide.masterAppliedAt;
    for (const el of (slide.elements || [])) {
        delete el.masterElement;
    }
    editor._push();
    onUpdate('slide-update');
    notify('Slide désolidarisé du master', 'success');
}

/* ── Preview rendering ─────────────────────────────────── */

const _TYPE_COLORS = {
    heading: '#818cf8', text: '#94a3b8', shape: null,
    image: '#6ee7b7', code: '#fbbf24', card: '#f9a8d4',
    list: '#a78bfa', table: '#67e8f9'
};

function _renderPreviewSVG(elements) {
    const W = 160, H = 90;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="border-radius:6px;background:var(--surface2,#1e1e2e)">`;
    for (const el of (elements || [])) {
        const x = el.x / 1280 * W, y = el.y / 720 * H;
        const w = el.w / 1280 * W, h = el.h / 720 * H;
        let fill = _TYPE_COLORS[el.type] || '#64748b';
        let opacity = 0.35;
        if (el.type === 'shape') {
            fill = el.style?.fill || '#818cf8';
            opacity = parseFloat(el.style?.opacity ?? 0.2);
        } else if (el.type === 'heading') {
            opacity = 0.7;
        } else if (el.type === 'image') {
            opacity = 0.25;
        }
        const rx = el.type === 'card' ? 3 : 1.5;
        svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${fill}" opacity="${opacity}"/>`;
        // Show small type icon/label for heading
        if (el.type === 'heading' && w > 20) {
            const lines = Math.max(1, Math.round(h / 14));
            for (let li = 0; li < lines; li++) {
                const lw = w * (li === 0 ? 0.7 : 0.5);
                const ly = y + 3 + li * 5;
                if (ly + 2 > y + h) break;
                svg += `<rect x="${(x + 2).toFixed(1)}" y="${ly.toFixed(1)}" width="${lw.toFixed(1)}" height="2.5" rx="1" fill="${fill}" opacity="0.5"/>`;
            }
        }
        if (el.type === 'text' && w > 10) {
            const lines = Math.min(6, Math.max(1, Math.round(h / 10)));
            for (let li = 0; li < lines; li++) {
                const lw = w * (0.5 + Math.random() * 0.4);
                const ly = y + 3 + li * 5;
                if (ly + 2 > y + h) break;
                svg += `<rect x="${(x + 2).toFixed(1)}" y="${ly.toFixed(1)}" width="${lw.toFixed(1)}" height="2" rx="1" fill="${fill}" opacity="0.25"/>`;
            }
        }
        if (el.type === 'code' && w > 10) {
            const lines = Math.min(8, Math.max(2, Math.round(h / 8)));
            for (let li = 0; li < lines; li++) {
                const lw = w * (0.3 + Math.random() * 0.5);
                const ly = y + 4 + li * 4.5;
                if (ly + 2 > y + h) break;
                svg += `<rect x="${(x + 4).toFixed(1)}" y="${ly.toFixed(1)}" width="${lw.toFixed(1)}" height="1.5" rx="0.5" fill="${fill}" opacity="0.4"/>`;
            }
        }
        if (el.type === 'image') {
            // small mountain icon
            const cx = x + w / 2, cy = y + h / 2;
            svg += `<path d="M${cx - 4} ${cy + 3} L${cx - 1} ${cy - 2} L${cx + 2} ${cy + 1} L${cx + 4} ${cy - 1} L${cx + 6} ${cy + 3}Z" fill="${fill}" opacity="0.5"/>`;
            svg += `<circle cx="${cx + 3}" cy="${cy - 3}" r="1.5" fill="${fill}" opacity="0.4"/>`;
        }
    }
    svg += '</svg>';
    return svg;
}

/* ── Unified modal ─────────────────────────────────────── */

function _renderMastersContent() {
    const container = document.getElementById('masters-gallery');
    if (!container) return;

    // Group built-in layouts by category
    const categories = {};
    for (const l of BUILT_IN_LAYOUTS) {
        const cat = l.category || 'Autre';
        (categories[cat] = categories[cat] || []).push(l);
    }

    // Custom masters
    const customs = editor.data?.masters || [];

    let html = '';

    // Render built-in by category
    for (const [cat, layouts] of Object.entries(categories)) {
        html += `<div class="masters-category">
            <div class="masters-cat-label">${esc(cat)}</div>
            <div class="masters-grid">
                ${layouts.map(m => _renderMasterCard(m, false)).join('')}
            </div>
        </div>`;
    }

    // Custom masters section
    if (customs.length > 0) {
        html += `<div class="masters-category">
            <div class="masters-cat-label">Mes masters personnalisés</div>
            <div class="masters-grid">
                ${customs.map(m => _renderMasterCard(m, true)).join('')}
            </div>
        </div>`;
    }

    container.innerHTML = html;

    const lockMasterElements = document.getElementById('masters-apply-locked')?.checked !== false;
    const currentSlide = editor.currentSlide;
    const currentSlideHasMaster = !!currentSlide?.masterId;
    const currentSlideOutdated = _isSlideMasterOutdated(currentSlide);
    const syncBtn = document.getElementById('btn-sync-master');
    const detachBtn = document.getElementById('btn-detach-master');
    const statusEl = document.getElementById('masters-slide-status');
    if (statusEl) {
        if (!currentSlideHasMaster) {
            statusEl.textContent = 'Slide courant: aucun master lié.';
        } else if (currentSlideOutdated) {
            statusEl.textContent = `Slide courant: master obsolète (v${currentSlide.masterVersion || '?'}) — migration recommandée.`;
        } else {
            statusEl.textContent = `Slide courant: master à jour (v${currentSlide.masterVersion || MASTER_LAYOUT_VERSION}).`;
        }
    }
    if (syncBtn) {
        syncBtn.disabled = !currentSlideHasMaster;
        syncBtn.textContent = currentSlideOutdated ? 'Migrer ce slide' : 'Re-synchroniser';
        syncBtn.title = currentSlideOutdated
            ? 'Mettre à jour ce slide vers la version courante du master/thème'
            : 'Recharger la slide depuis son master';
    }
    if (detachBtn) detachBtn.disabled = !currentSlideHasMaster;

    // Bind clicks
    container.querySelectorAll('.master-card').forEach(card => {
        card.addEventListener('click', () => {
            applyMaster(card.dataset.masterId, { lockMasterElements });
            closeMastersModal();
        });
    });
    container.querySelectorAll('.master-del').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            OEIDialog.confirm('Supprimer ce master ?', { danger: true }).then(ok => { if (ok) deleteMaster(btn.dataset.id); });
        });
    });
}

function _renderMasterCard(m, isCustom) {
    return `<div class="master-card" data-master-id="${m.id}" title="${esc(m.name)}">
        <div class="master-preview">${_renderPreviewSVG(m.slide.elements)}</div>
        <div class="master-label">${esc(m.name)}${isCustom ? `<button class="master-del" data-id="${m.id}" title="Supprimer">✕</button>` : ''}</div>
    </div>`;
}

function openMastersModal(tab) {
    let modal = document.getElementById('masters-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'masters-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal" style="max-width:800px;max-height:85vh;display:flex;flex-direction:column">
            <div style="display:flex;align-items:center;margin-bottom:12px;gap:8px;flex-shrink:0">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="opacity:0.6"><rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="1" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="11" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>
                <span class="modal-title" style="margin:0;flex:1">Dispositions &amp; Masters</span>
                <button class="tb-btn ui-btn" id="btn-save-master" style="font-size:0.72rem;padding:4px 12px" title="Sauvegarder le slide actuel comme master">💾 Sauver comme master</button>
                <button class="modal-close" id="masters-modal-close">✕</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-4px 0 10px;flex-shrink:0">
                <label class="tb-btn ui-btn" style="height:30px;padding:0 10px;gap:6px;cursor:pointer">
                    <input type="checkbox" id="masters-apply-locked" style="accent-color:var(--primary)">
                    Appliquer verrouillé
                </label>
                <button class="tb-btn ui-btn" id="btn-sync-master" style="height:30px;padding:0 10px;font-size:0.72rem" title="Recharger la slide depuis son master">Re-synchroniser</button>
                <button class="tb-btn ui-btn" id="btn-detach-master" style="height:30px;padding:0 10px;font-size:0.72rem" title="Retirer le lien avec le master">Désolidariser</button>
            </div>
            <div id="masters-slide-status" style="font-size:0.7rem;color:var(--muted);margin:-4px 0 8px;flex-shrink:0"></div>
            <div id="masters-gallery" class="masters-gallery" style="overflow-y:auto;flex:1;padding-right:4px"></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeMastersModal(); });
        document.getElementById('masters-modal-close').addEventListener('click', closeMastersModal);
        document.getElementById('btn-save-master').addEventListener('click', () => saveAsMaster());
        const lockInput = document.getElementById('masters-apply-locked');
        if (lockInput) {
            lockInput.checked = _getApplyLockedPref();
            lockInput.addEventListener('change', () => _setApplyLockedPref(!!lockInput.checked));
        }
        document.getElementById('btn-sync-master')?.addEventListener('click', syncCurrentSlideMaster);
        document.getElementById('btn-detach-master')?.addEventListener('click', detachCurrentSlideMaster);
    }
    const lockInput = document.getElementById('masters-apply-locked');
    if (lockInput) lockInput.checked = _getApplyLockedPref();
    modal.style.display = 'flex';
    _renderMastersContent();
}

function closeMastersModal() {
    const modal = document.getElementById('masters-modal');
    if (modal) modal.style.display = 'none';
}

/* Alias: openLayoutPicker redirects to unified modal */
function openLayoutPicker() {
    openMastersModal('layouts');
}

window.applyMaster = applyMaster;
window.saveAsMaster = saveAsMaster;
window.deleteMaster = deleteMaster;
window.updateMasterSlides = updateMasterSlides;
window.syncCurrentSlideMaster = syncCurrentSlideMaster;
window.detachCurrentSlideMaster = detachCurrentSlideMaster;
window.openMastersModal = openMastersModal;
window.closeMastersModal = closeMastersModal;
window.openLayoutPicker = openLayoutPicker;
