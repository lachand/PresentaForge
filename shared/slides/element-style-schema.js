// @ts-check
/**
 * element-style-schema.js — source de vérité unique des propriétés de style
 * éditables par type d'élément canvas.
 *
 * Consommé par :
 *  - le renderer (`slides-core.js` shapeSVG, `slides-renderer-canvas.js`) → `resolve()` +
 *    `wrapperBoxCss()` (dégradation gracieuse si le module est absent) ;
 *  - l'éditeur (`editor-props-panel.js` section « Style », `editor-format-tab.js` groupes
 *    contextuels) → `schemaFor()` / `groupsFor()` ;
 *  - `slides-editor.js` `_normalizeLegacyCanvasStyles()` → `defaultFor()` (élagage).
 *
 * Aucune dépendance externe, aucun accès DOM. Doit être chargé avant `slides-core.js`.
 */
(function (global) {
    'use strict';

    /** Descripteur par défaut pour une clé de style (utilisé quand SCHEMA[type] ne donne qu'une string). */
    const DESCRIPTORS = {
        fill:          { control: 'color',  group: 'box' },
        background:    { control: 'color',  group: 'box' },
        opacity:       { control: 'range',  group: 'box',  min: 0, max: 1, step: 0.05, default: 1 },
        stroke:        { control: 'color',  group: 'box' },
        strokeWidth:   { control: 'number', group: 'box',  unit: 'px', min: 0, max: 20, default: 0 },
        dashArray:     { control: 'select', group: 'box',  options: ['', '6 4', '2 4', '10 6'],
                         optionLabels: ['Plein', 'Tirets', 'Points', 'Longs tirets'], default: '' },
        borderColor:   { control: 'color',  group: 'box' },
        borderWidth:   { control: 'number', group: 'box',  unit: 'px', min: 0, max: 12, default: 0 },
        borderRadius:  { control: 'number', group: 'box',  unit: 'px', min: 0, max: 48 },
        boxShadow:     { control: 'toggle', group: 'box',  default: '' },
        padding:       { control: 'text',   group: 'box',  placeholder: 'ex : 1rem 1.2rem' },

        color:         { control: 'color',  group: 'text' },
        fontSize:      { control: 'number', group: 'text', unit: 'px', min: 8, max: 120 },
        fontWeight:    { control: 'select', group: 'text', options: [400, 600, 700, 800],
                         optionLabels: ['Normal', 'Semi', 'Gras', 'Extra'], default: 400 },
        fontFamily:    { control: 'font-family', group: 'text', default: '' },
        fontStyle:     { control: 'select', group: 'text', options: ['normal', 'italic'],
                         optionLabels: ['Normal', 'Italique'], default: 'normal' },
        textTransform: { control: 'select', group: 'text',
                         options: ['none', 'uppercase', 'lowercase', 'capitalize'],
                         optionLabels: ['Aucune', 'MAJUSCULES', 'minuscules', 'Capitales'], default: 'none' },
        letterSpacing: { control: 'number', group: 'text', unit: 'px', min: -2, max: 12, step: 0.5, default: 0 },
        lineHeight:    { control: 'number', group: 'text', min: 1, max: 2.4, step: 0.05 },

        textAlign:     { control: 'align',  group: 'paragraph', default: 'left' },
        verticalAlign: { control: 'select', group: 'paragraph', options: ['top', 'middle', 'bottom'],
                         optionLabels: ['Haut', 'Centré', 'Bas'], default: 'top' },

        headerBg:      { control: 'color',  group: 'table' },
        headerColor:   { control: 'color',  group: 'table' },
        stripeBg:      { control: 'color',  group: 'table' },
        cellPadding:   { control: 'text',   group: 'table', placeholder: 'ex : 6px 10px' },

        titleColor:    { control: 'color',  group: 'title' },
        titleSize:     { control: 'number', group: 'title', unit: 'px', min: 10, max: 80 },
        titleWeight:   { control: 'select', group: 'title', options: [400, 600, 700, 800],
                         optionLabels: ['Normal', 'Semi', 'Gras', 'Extra'], default: 700 },

        objectFit:     { control: 'select', group: 'image', options: ['contain', 'cover', 'fill'],
                         optionLabels: ['Contain', 'Cover', 'Étirer'], default: 'contain' },
        filter:        { control: 'select', group: 'image',
                         options: ['none', 'grayscale(1)', 'sepia(1)', 'blur(2px)'],
                         optionLabels: ['Normal', 'N&B', 'Sépia', 'Flou'], default: 'none' },

        labelColor:    { control: 'color',  group: 'text' },
        labelSize:     { control: 'number', group: 'text', unit: 'px', min: 8, max: 40, default: 14 },
        labelBg:       { control: 'color',  group: 'text', default: '' },
    };

    /** Labels FR courts par clé (affichés dans le panneau). */
    const LABELS = {
        fill: 'Fond', background: 'Fond', opacity: 'Opacité',
        stroke: 'Contour', strokeWidth: 'Épaisseur contour', dashArray: 'Style de trait',
        borderColor: 'Couleur bordure', borderWidth: 'Épaisseur bordure', borderRadius: 'Rayon',
        boxShadow: 'Ombre portée', padding: 'Marge intérieure',
        color: 'Couleur texte', fontSize: 'Taille texte', fontWeight: 'Graisse',
        fontFamily: 'Police', fontStyle: 'Style', textTransform: 'Casse',
        letterSpacing: 'Interlettrage', lineHeight: 'Interligne',
        textAlign: 'Alignement', verticalAlign: 'Alignement vertical',
        headerBg: 'Fond en-tête', headerColor: 'Couleur en-tête', stripeBg: 'Fond zébrage',
        cellPadding: 'Marge cellule',
        titleColor: 'Couleur titre', titleSize: 'Taille titre', titleWeight: 'Graisse titre',
        objectFit: 'Ajustement', filter: 'Filtre',
        labelColor: 'Couleur étiquette', labelSize: 'Taille étiquette', labelBg: 'Fond étiquette',
    };

    /**
     * SCHEMA brut : par type, la liste des propriétés éditables. Une entrée est
     * soit une string (→ descripteur par défaut de DESCRIPTORS), soit un objet
     * `{ key, ...overrides }` (override du descripteur par défaut).
     */
    const RAW_SCHEMA = {
        card: [
            { key: 'fill', default: null },
            { key: 'color', default: null },
            { key: 'fontSize', default: null },
            { key: 'titleColor', default: null },
            { key: 'titleSize', default: null },
            { key: 'titleWeight', default: 700 },
            { key: 'borderColor', default: null },
            { key: 'borderRadius', default: 10 },
            { key: 'padding', default: '1rem 1.2rem' },
        ],
        shape: [
            'fill', { key: 'opacity', default: 0.25 }, 'stroke', 'strokeWidth', 'dashArray', 'borderRadius',
            'color', 'fontSize', 'fontWeight', 'fontFamily',
            { key: 'textAlign', default: 'center' },
            { key: 'verticalAlign', default: 'middle' },
            'padding',
        ],
        image: ['objectFit', 'filter', 'borderRadius', 'opacity'],
        table: ['fontSize', 'color', 'headerBg', 'headerColor', 'stripeBg', 'borderColor', 'cellPadding', 'textAlign'],
        list: ['fontSize', 'color', 'textAlign', 'fontWeight', 'fontFamily', 'lineHeight'],
        heading: ['fontSize', 'fontWeight', 'color', 'fontFamily', 'textAlign', 'lineHeight',
                  'verticalAlign', 'fontStyle', 'textTransform', 'background', 'letterSpacing'],
        text: ['fontSize', 'fontWeight', 'color', 'fontFamily', 'textAlign', 'lineHeight',
               'verticalAlign', 'fontStyle', 'textTransform', 'background', 'letterSpacing'],
        quote: ['fontSize', 'color', { key: 'fontStyle', default: 'italic' },
                { key: 'textAlign', default: 'center' }, 'fontFamily'],
        definition: ['fontSize', 'color'],
        smartart: ['color', 'fontSize', 'borderColor', { key: 'borderWidth', default: 2 }],
        latex: ['fontSize', 'color', 'background'],
        timer: ['fontSize', 'color', 'background'],
        connector: ['stroke', 'strokeWidth', 'opacity', 'dashArray', 'labelColor', 'labelSize', 'labelBg'],
    };

    /** Normalise une entrée RAW_SCHEMA en descripteur complet. */
    function normalizeDescriptor(entry) {
        const key = typeof entry === 'string' ? entry : entry.key;
        const base = DESCRIPTORS[key] || { control: 'text', group: 'box' };
        const desc = Object.assign({ key, label: LABELS[key] || key }, base);
        if (typeof entry === 'object') Object.assign(desc, entry);
        if (!('default' in desc)) desc.default = null;
        return desc;
    }

    const SCHEMA = {};
    for (const type of Object.keys(RAW_SCHEMA)) {
        SCHEMA[type] = RAW_SCHEMA[type].map(normalizeDescriptor);
    }
    // text hérite exactement de heading
    const GROUP_ORDER = ['box', 'title', 'text', 'paragraph', 'table', 'image'];

    function schemaFor(type) {
        return SCHEMA[type] ? SCHEMA[type].slice() : [];
    }

    function groupsFor(type) {
        const set = new Set();
        for (const d of schemaFor(type)) set.add(d.group);
        return set;
    }

    /** Descripteur d'une (type, key) ou null. */
    function descriptorFor(type, key) {
        return (SCHEMA[type] || []).find(d => d.key === key) || null;
    }

    /** Valeur par défaut du schéma pour (type, key) — `null` = « pas de défaut, laisser le renderer calculer ». */
    function defaultFor(type, key) {
        const d = descriptorFor(type, key);
        return d && d.default != null ? d.default : null;
    }

    /**
     * Chaîne de résolution : `style[key]` si défini, sinon défaut du schéma (si ≠ null),
     * sinon `fallback` (la valeur codée en dur historique du renderer).
     */
    function resolve(type, style, key, fallback) {
        const v = style ? style[key] : undefined;
        if (v !== undefined && v !== null && v !== '') return v;
        const d = defaultFor(type, key);
        return d != null ? d : fallback;
    }

    /**
     * CSS de « boîte » appliquée au wrapper positionné d'un élément.
     * N'émet une règle que si la clé correspondante est présente dans `style`.
     * Les formes (`shape`) portent leur contour/rayon via le SVG → bordure/rayon sautés.
     */
    function wrapperBoxCss(style, type) {
        if (!style || typeof style !== 'object') return '';
        let css = '';
        const isShape = type === 'shape';
        if (!isShape) {
            const bw = Number(style.borderWidth);
            if (Number.isFinite(bw) && bw > 0 && style.borderColor) {
                css += `border:${bw}px ${style.borderStyle || 'solid'} ${style.borderColor};`;
            }
            if (style.borderRadius !== undefined && style.borderRadius !== null && style.borderRadius !== '') {
                const br = typeof style.borderRadius === 'number' ? `${style.borderRadius}px` : String(style.borderRadius);
                css += `border-radius:${br};`;
            }
        }
        if (style.boxShadow && style.boxShadow !== 'none') {
            const shadow = style.boxShadow === true || style.boxShadow === '1'
                ? '0 8px 24px rgba(0,0,0,0.35)'
                : String(style.boxShadow);
            // drop-shadow plutôt que box-shadow : non rogné par overflow:hidden du wrapper
            css += `filter:drop-shadow(${shadow.replace(/^0 8px 32px/, '0 8px 24px')});`;
        }
        return css;
    }

    global.OEISlidesElementStyle = Object.freeze({
        SCHEMA,
        DESCRIPTORS,
        GROUP_ORDER,
        schemaFor,
        groupsFor,
        descriptorFor,
        defaultFor,
        resolve,
        wrapperBoxCss,
    });
})(window);
