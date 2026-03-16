/**
 * @module slides/editor-diagram-panel
 * @internal Module Slides charge cote navigateur.
 */
/* editor-diagram-panel.js — Lot 18B
 * Constantes et helpers diagramme extraits de editor-props-panel.js.
 * Dépendances globales : esc, escAttr (depuis editor-props-panel.js ou globals)
 * Doit être chargé AVANT editor-props-panel.js.
 */

const DIAGRAM_CHART_TYPES = Object.freeze([
    'bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'combo',
    'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall', 'funnel',
    'radar', 'pie', 'donut', 'heatmap', 'treemap', 'sankey', 'gantt', 'radial-gauge',
]);

const DIAGRAM_TYPE_LABELS = Object.freeze({
    bar: 'Barres',
    'stacked-bar': 'Barres empilees',
    'stacked-100': 'Barres empilees 100%',
    line: 'Lignes',
    area: 'Aires',
    combo: 'Combo barres + ligne',
    scatter: 'Nuage (X,Y)',
    bubble: 'Bulles (X,Y,Taille)',
    histogram: 'Histogramme',
    boxplot: 'Boite a moustaches',
    waterfall: 'Waterfall',
    funnel: 'Entonnoir',
    radar: 'Radar',
    pie: 'Camembert',
    donut: 'Anneau',
    heatmap: 'Heatmap',
    treemap: 'Treemap',
    sankey: 'Sankey',
    gantt: 'Gantt',
    'radial-gauge': 'Jauge radiale',
});

const DIAGRAM_TYPE_SCHEMAS = Object.freeze({
    bar: { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Cat.' },
    'stacked-bar': { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Cat.' },
    'stacked-100': { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Cat.' },
    line: { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Cat.' },
    area: { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Cat.' },
    combo: { minRows: 4, minCols: 3, headers: ['Categorie', 'Barres', 'Ligne'], rowPrefix: 'Cat.' },
    scatter: { minRows: 4, minCols: 3, fixedCols: 3, headers: ['Point', 'X', 'Y'], rowPrefix: 'P' },
    bubble: { minRows: 4, minCols: 4, fixedCols: 4, headers: ['Point', 'X', 'Y', 'Taille'], rowPrefix: 'P' },
    histogram: { minRows: 6, minCols: 2, fixedCols: 2, headers: ['Classe', 'Frequence'], rowPrefix: 'Bin' },
    boxplot: { minRows: 4, minCols: 6, fixedCols: 6, headers: ['Categorie', 'Min', 'Q1', 'Mediane', 'Q3', 'Max'], rowPrefix: 'Cat.' },
    waterfall: { minRows: 5, minCols: 2, fixedCols: 2, headers: ['Etape', 'Variation'], rowPrefix: 'Etape' },
    funnel: { minRows: 5, minCols: 2, fixedCols: 2, headers: ['Etape', 'Valeur'], rowPrefix: 'Etape' },
    radar: { minRows: 4, minCols: 3, headers: ['Categorie', 'Serie A', 'Serie B'], rowPrefix: 'Axe' },
    pie: { minRows: 5, minCols: 2, fixedCols: 2, headers: ['Categorie', 'Valeur'], rowPrefix: 'Part' },
    donut: { minRows: 5, minCols: 2, fixedCols: 2, headers: ['Categorie', 'Valeur'], rowPrefix: 'Part' },
    heatmap: { minRows: 4, minCols: 4, headers: ['Ligne/Colonne', 'C1', 'C2', 'C3'], rowPrefix: 'Ligne' },
    treemap: { minRows: 5, minCols: 2, fixedCols: 2, headers: ['Bloc', 'Valeur'], rowPrefix: 'Bloc' },
    sankey: { minRows: 6, minCols: 3, fixedCols: 3, headers: ['Source', 'Cible', 'Valeur'], rowPrefix: 'Flux' },
    gantt: { minRows: 5, minCols: 4, fixedCols: 4, headers: ['Tache', 'Debut', 'Fin', 'Groupe'], rowPrefix: 'Tache' },
    'radial-gauge': { minRows: 2, minCols: 4, fixedCols: 4, fixedRows: 2, headers: ['Mesure', 'Valeur', 'Min', 'Max'], rowPrefix: 'Mesure' },
});

const DIAGRAM_ROW_TEMPLATES = Object.freeze({
    bar: [['Categorie', 'Serie A', 'Serie B'], ['A', '12', '8'], ['B', '18', '11'], ['C', '9', '14']],
    'stacked-bar': [['Categorie', 'Serie A', 'Serie B'], ['A', '12', '8'], ['B', '18', '11'], ['C', '9', '14']],
    'stacked-100': [['Categorie', 'Serie A', 'Serie B'], ['A', '40', '60'], ['B', '70', '30'], ['C', '55', '45']],
    line: [['Categorie', 'Serie A', 'Serie B'], ['S1', '10', '8'], ['S2', '12', '11'], ['S3', '9', '14']],
    area: [['Categorie', 'Serie A', 'Serie B'], ['S1', '10', '8'], ['S2', '12', '11'], ['S3', '9', '14']],
    combo: [['Categorie', 'Barres', 'Ligne'], ['S1', '120', '18'], ['S2', '95', '21'], ['S3', '140', '17']],
    scatter: [['Point', 'X', 'Y'], ['P1', '3', '9'], ['P2', '6', '12'], ['P3', '9', '7']],
    bubble: [['Point', 'X', 'Y', 'Taille'], ['P1', '3', '9', '8'], ['P2', '6', '12', '18'], ['P3', '9', '7', '5']],
    histogram: [['Classe', 'Frequence'], ['0-10', '2'], ['10-20', '7'], ['20-30', '10'], ['30-40', '5'], ['40-50', '2']],
    boxplot: [['Categorie', 'Min', 'Q1', 'Mediane', 'Q3', 'Max'], ['A', '3', '6', '8', '10', '14'], ['B', '2', '5', '7', '9', '12'], ['C', '1', '4', '6', '8', '11']],
    waterfall: [['Etape', 'Variation'], ['Ventes', '120'], ['Couts', '-65'], ['Taxes', '-18'], ['Upsell', '24']],
    funnel: [['Etape', 'Valeur'], ['Visites', '1200'], ['Leads', '420'], ['Essais', '180'], ['Clients', '72']],
    radar: [['Axe', 'Serie A', 'Serie B'], ['Qualite', '8', '6'], ['Prix', '6', '9'], ['Support', '7', '5']],
    pie: [['Categorie', 'Valeur'], ['A', '35'], ['B', '25'], ['C', '20'], ['D', '20']],
    donut: [['Categorie', 'Valeur'], ['A', '35'], ['B', '25'], ['C', '20'], ['D', '20']],
    heatmap: [['Ligne/Colonne', 'C1', 'C2', 'C3'], ['Ligne 1', '12', '5', '18'], ['Ligne 2', '8', '14', '3'], ['Ligne 3', '19', '7', '10']],
    treemap: [['Bloc', 'Valeur'], ['Backend', '40'], ['Frontend', '30'], ['DevOps', '20'], ['QA', '10']],
    sankey: [['Source', 'Cible', 'Valeur'], ['Visites', 'Leads', '420'], ['Leads', 'Essais', '180'], ['Essais', 'Clients', '72'], ['Leads', 'Abandon', '240'], ['Essais', 'Abandon', '108']],
    gantt: [['Tache', 'Debut', 'Fin', 'Groupe'], ['Analyse', '2026-03-10', '2026-03-15', 'Phase 1'], ['Dev', '2026-03-16', '2026-03-28', 'Phase 2'], ['Recette', '2026-03-29', '2026-04-03', 'Phase 3'], ['Lancement', '2026-04-04', '2026-04-06', 'Phase 3']],
    'radial-gauge': [['Mesure', 'Valeur', 'Min', 'Max'], ['Progression', '68', '0', '100']],
});

const DIAGRAM_SERIES_COLOR_FALLBACK = Object.freeze([
    '#818cf8',
    '#38bdf8',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#f472b6',
]);

const DIAGRAM_TRANSFORM_MODES = Object.freeze([
    'none',
    'percent',
    'cumulative',
    'average',
]);

const DIAGRAM_TRANSFORM_LABELS = Object.freeze({
    none: 'Aucune',
    percent: 'Pourcentage par categorie',
    cumulative: 'Cumul par serie',
    average: 'Moyenne par serie',
});

const DIAGRAM_PEDAGOGICAL_PRESETS = Object.freeze({
    evolution: {
        id: 'evolution',
        label: 'Evolution',
        chartType: 'line',
        transformMode: 'none',
        rows: [['Periode', 'Serie A', 'Serie B'], ['S1', '12', '9'], ['S2', '15', '11'], ['S3', '17', '13'], ['S4', '19', '15']],
    },
    distribution: {
        id: 'distribution',
        label: 'Distribution',
        chartType: 'histogram',
        transformMode: 'none',
        rows: [['Classe', 'Frequence'], ['0-10', '3'], ['10-20', '8'], ['20-30', '14'], ['30-40', '9'], ['40-50', '4']],
    },
    conversion: {
        id: 'conversion',
        label: 'Conversion',
        chartType: 'funnel',
        transformMode: 'none',
        rows: [['Etape', 'Valeur'], ['Visites', '1200'], ['Leads', '420'], ['Essais', '180'], ['Clients', '72']],
    },
    planification: {
        id: 'planification',
        label: 'Planification',
        chartType: 'gantt',
        transformMode: 'none',
        rows: [['Tache', 'Debut', 'Fin', 'Groupe'], ['Analyse', '2026-03-10', '2026-03-14', 'Phase 1'], ['Implementation', '2026-03-15', '2026-03-28', 'Phase 2'], ['Recette', '2026-03-29', '2026-04-04', 'Phase 3']],
    },
});

function _normalizeDiagramTransformMode(mode = 'none') {
    const normalized = String(mode || '').trim().toLowerCase();
    return DIAGRAM_TRANSFORM_MODES.includes(normalized) ? normalized : 'none';
}

function _diagramTransformOptionsHtml(selectedMode = 'none') {
    const current = _normalizeDiagramTransformMode(selectedMode);
    return DIAGRAM_TRANSFORM_MODES
        .map((mode) => `<option value="${mode}"${mode === current ? ' selected' : ''}>${esc(DIAGRAM_TRANSFORM_LABELS[mode] || mode)}</option>`)
        .join('');
}

function _diagramPresetOptionsHtml(selectedPreset = '') {
    const current = String(selectedPreset || '').trim().toLowerCase();
    const options = Object.values(DIAGRAM_PEDAGOGICAL_PRESETS)
        .map((preset) => `<option value="${escAttr(preset.id)}"${preset.id === current ? ' selected' : ''}>${esc(preset.label)}</option>`)
        .join('');
    return `<option value="">Aucun</option>${options}`;
}

function _diagramTryNumber(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

function _diagramLooksDate(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return false;
    const ts = Date.parse(raw.replace(/\//g, '-'));
    return Number.isFinite(ts);
}

function _normalizeDiagramSeriesStyles(seriesStyles, seriesCount = 1, chartType = 'bar') {
    const count = Math.max(1, Number(seriesCount) || 1);
    const src = Array.isArray(seriesStyles) ? seriesStyles : [];
    const isLineFamily = ['line', 'area', 'combo', 'radar'].includes(chartType);
    const defaultPoints = ['line', 'combo', 'radar', 'scatter', 'bubble'].includes(chartType);
    const defaultSmooth = ['line', 'area', 'combo'].includes(chartType);

    return Array.from({ length: count }, (_, idx) => {
        const raw = (src[idx] && typeof src[idx] === 'object') ? src[idx] : {};
        const fallbackColor = DIAGRAM_SERIES_COLOR_FALLBACK[idx % DIAGRAM_SERIES_COLOR_FALLBACK.length];
        const widthRaw = Number(raw.width);
        const width = Number.isFinite(widthRaw)
            ? Math.max(0.5, Math.min(10, Math.round(widthRaw * 10) / 10))
            : (isLineFamily ? 2.4 : 1.8);
        const axisRaw = String(raw.axis || '').trim().toLowerCase();
        const axis = chartType === 'combo' && axisRaw === 'secondary'
            ? 'secondary'
            : 'primary';
        return {
            color: String(raw.color || fallbackColor).trim() || fallbackColor,
            width,
            points: raw.points == null ? defaultPoints : !!raw.points,
            smooth: raw.smooth == null ? defaultSmooth : !!raw.smooth,
            axis,
        };
    });
}

function _diagramColorInputValue(color, fallback = '#818cf8') {
    const raw = String(color || '').trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
    return fallback;
}

function _diagramStylesPreviewRowsHtml(seriesNames, seriesStyles, chartType = 'bar') {
    const showAxis = chartType === 'combo';
    return seriesNames.map((name, idx) => {
        const style = seriesStyles[idx] || _normalizeDiagramSeriesStyles([], seriesNames.length, chartType)[idx];
        const colorValue = _diagramColorInputValue(style.color, DIAGRAM_SERIES_COLOR_FALLBACK[idx % DIAGRAM_SERIES_COLOR_FALLBACK.length]);
        return `<div class="sp-diag-series-row" data-diag-series-row="${idx}">
            <div class="sp-diag-series-name" title="${escAttr(name)}">${esc(name)}</div>
            <div class="sp-diag-series-controls">
                <label class="sp-diag-series-inline"><span>Couleur</span><input type="color" data-diag-style="color" data-series-idx="${idx}" value="${escAttr(colorValue)}"></label>
                <label class="sp-diag-series-inline"><span>Ep.</span><input type="number" min="0.5" max="10" step="0.1" data-diag-style="width" data-series-idx="${idx}" value="${escAttr(style.width)}"></label>
                <label class="sp-diag-series-check"><input type="checkbox" data-diag-style="points" data-series-idx="${idx}"${style.points ? ' checked' : ''}> Points</label>
                <label class="sp-diag-series-check"><input type="checkbox" data-diag-style="smooth" data-series-idx="${idx}"${style.smooth ? ' checked' : ''}> Lisse</label>
                ${showAxis ? `<label class="sp-diag-series-check"><input type="checkbox" data-diag-style="axis-secondary" data-series-idx="${idx}"${style.axis === 'secondary' ? ' checked' : ''}> Axe 2</label>` : ''}
            </div>
        </div>`;
    }).join('');
}

function _diagramParseDelimited(text, delimiter = ',') {
    const src = String(text ?? '');
    if (!src.trim()) return [];
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === '"') {
            if (inQuotes && src[i + 1] === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (!inQuotes && ch === delimiter) {
            row.push(cell);
            cell = '';
            continue;
        }
        if (!inQuotes && (ch === '\n' || ch === '\r')) {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            if (ch === '\r' && src[i + 1] === '\n') i++;
            continue;
        }
        cell += ch;
    }
    row.push(cell);
    rows.push(row);
    return rows
        .map((r) => r.map((c) => String(c ?? '').trim()))
        .filter((r) => r.some((c) => c.length > 0));
}

function _diagramRowsToDelimited(rows, delimiter = ',') {
    const safeRows = Array.isArray(rows) ? rows : [];
    const escCell = (value) => {
        const cell = String(value ?? '');
        if (cell.includes('"')) return `"${cell.replace(/"/g, '""')}"`;
        if (cell.includes(delimiter) || cell.includes('\n') || cell.includes('\r')) return `"${cell}"`;
        return cell;
    };
    return safeRows.map((row) => {
        const arr = Array.isArray(row) ? row : [];
        return arr.map((cell) => escCell(cell)).join(delimiter);
    }).join('\n');
}

function _diagramInvalidCells(rows, chartType = 'bar') {
    const invalid = new Set();
    const issues = [];
    const matrix = Array.isArray(rows) ? rows : [];
    const mark = (ri, ci, reason) => {
        const key = `${ri}:${ci}`;
        if (!invalid.has(key)) {
            invalid.add(key);
            issues.push({ row: ri, col: ci, reason });
        }
    };
    const rowHasAny = (row) => (Array.isArray(row) ? row.some((cell) => String(cell ?? '').trim().length > 0) : false);
    const requireNumeric = (ri, ci, allowDate = false) => {
        const value = matrix[ri]?.[ci];
        const raw = String(value ?? '').trim();
        if (!raw) return mark(ri, ci, 'vide');
        if (_diagramTryNumber(raw) != null) return;
        if (allowDate && _diagramLooksDate(raw)) return;
        mark(ri, ci, 'nombre');
    };
    const requireText = (ri, ci) => {
        const raw = String(matrix[ri]?.[ci] ?? '').trim();
        if (!raw) mark(ri, ci, 'texte');
    };

    for (let ri = 1; ri < matrix.length; ri++) {
        const row = matrix[ri];
        if (!rowHasAny(row)) continue;
        const cols = Array.isArray(row) ? row.length : 0;
        const numericAll = () => {
            for (let ci = 1; ci < cols; ci++) requireNumeric(ri, ci, false);
        };
        switch (chartType) {
            case 'sankey':
                requireText(ri, 0);
                requireText(ri, 1);
                requireNumeric(ri, 2, false);
                break;
            case 'gantt':
                requireText(ri, 0);
                requireNumeric(ri, 1, true);
                requireNumeric(ri, 2, true);
                break;
            case 'scatter':
                requireText(ri, 0);
                requireNumeric(ri, 1, false);
                requireNumeric(ri, 2, false);
                break;
            case 'bubble':
                requireText(ri, 0);
                requireNumeric(ri, 1, false);
                requireNumeric(ri, 2, false);
                requireNumeric(ri, 3, false);
                break;
            case 'boxplot':
                requireText(ri, 0);
                requireNumeric(ri, 1, false);
                requireNumeric(ri, 2, false);
                requireNumeric(ri, 3, false);
                requireNumeric(ri, 4, false);
                requireNumeric(ri, 5, false);
                break;
            case 'radial-gauge':
                requireText(ri, 0);
                requireNumeric(ri, 1, false);
                requireNumeric(ri, 2, false);
                requireNumeric(ri, 3, false);
                break;
            default:
                numericAll();
                break;
        }
    }
    return { invalid, issues };
}

function _getDiagramSchema(chartType = 'bar') {
    const key = DIAGRAM_CHART_TYPES.includes(String(chartType || '').toLowerCase())
        ? String(chartType).toLowerCase()
        : 'bar';
    return DIAGRAM_TYPE_SCHEMAS[key] || DIAGRAM_TYPE_SCHEMAS.bar;
}

function _getDiagramTemplateRows(chartType = 'bar') {
    const key = DIAGRAM_CHART_TYPES.includes(String(chartType || '').toLowerCase())
        ? String(chartType).toLowerCase()
        : 'bar';
    const template = DIAGRAM_ROW_TEMPLATES[key] || DIAGRAM_ROW_TEMPLATES.bar;
    return template.map((row) => row.slice());
}

function _diagramTypeOptionsHtml(selectedType = 'bar') {
    const selected = DIAGRAM_CHART_TYPES.includes(String(selectedType || '').toLowerCase())
        ? String(selectedType).toLowerCase()
        : 'bar';
    return DIAGRAM_CHART_TYPES
        .map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${esc(DIAGRAM_TYPE_LABELS[type] || type)}</option>`)
        .join('');
}

function _diagramFormatHint(chartType = 'bar') {
    const type = DIAGRAM_CHART_TYPES.includes(String(chartType || '').toLowerCase())
        ? String(chartType).toLowerCase()
        : 'bar';
    if (type === 'scatter') return 'Format: Point, X, Y.';
    if (type === 'bubble') return 'Format: Point, X, Y, Taille (colonne Taille obligatoire).';
    if (type === 'boxplot') return 'Format: Categorie, Min, Q1, Mediane, Q3, Max.';
    if (type === 'sankey') return 'Format: Source, Cible, Valeur.';
    if (type === 'gantt') return 'Format: Tache, Debut, Fin, Groupe(optionnel).';
    if (type === 'radial-gauge') return 'Format: Mesure, Valeur, Min, Max.';
    if (type === 'pie' || type === 'donut') return 'Format: Categorie, Valeur.';
    return 'Ligne 1: en-tetes. Colonne 1: categories.';
}

function _normalizeDiagramRows(rows, chartType = 'bar', forceHeaders = false) {
    const schema = _getDiagramSchema(chartType);
    const baseRows = Array.isArray(rows) && rows.length
        ? rows.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [])
        : _getDiagramTemplateRows(chartType);
    const inferredCols = Math.max(...baseRows.map((row) => row.length), 0);
    const colCount = Number.isFinite(schema.fixedCols)
        ? schema.fixedCols
        : Math.max(schema.minCols || 2, inferredCols || 0);
    const rowCount = Number.isFinite(schema.fixedRows)
        ? schema.fixedRows
        : Math.max(schema.minRows || 2, baseRows.length || 0);
    const normalized = Array.from({ length: rowCount }, (_, ri) => {
        const source = baseRows[ri] || [];
        const row = source.slice(0, colCount);
        while (row.length < colCount) row.push('');
        return row;
    });
    if (schema.headers?.length) {
        for (let ci = 0; ci < colCount; ci++) {
            const headerLabel = schema.headers[ci] || (ci === 0 ? 'Categorie' : `Serie ${ci}`);
            if (forceHeaders || !String(normalized[0][ci] || '').trim()) normalized[0][ci] = headerLabel;
        }
    }
    for (let ri = 1; ri < normalized.length; ri++) {
        if (!String(normalized[ri][0] || '').trim()) {
            const prefix = schema.rowPrefix || 'Cat.';
            normalized[ri][0] = `${prefix} ${ri}`;
        }
    }
    return normalized;
}

