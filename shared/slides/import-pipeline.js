/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/import-pipeline
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/import-pipeline.js"></script>
 */
/* import-pipeline.js — Unified import/repair/normalize pipeline with preview */
(function initImportPipeline(global) {
    'use strict';

    if (global.OEIImportPipeline) return;

    const SAFE_THEMES = new Set(['dark', 'light', 'beige', 'night', 'solarized', 'black', 'white', 'league', 'icom']);
    const SUPPORTED_SLIDE_TYPES = new Set(['title', 'chapter', 'bullets', 'code', 'split', 'definition', 'comparison', 'image', 'quote', 'blank', 'quiz', 'canvas']);
    const CANVAS_TYPES = new Set([
        'heading', 'text', 'list', 'image', 'shape', 'table', 'definition', 'code-example', 'quote', 'card', 'highlight',
        'mermaid', 'diagramme', 'latex', 'smartart', 'qrcode', 'video', 'iframe', 'quiz-live', 'poll-likert',
        'mcq-single', 'mcq-multi', 'rank-order', 'flashcards-auto', 'code', 'terminal-session', 'cloze', 'drag-drop'
    ]);

    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const toStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.text === 'string') return value.text;
            if (typeof value.label === 'string') return value.label;
            if (typeof value.title === 'string') return value.title;
        }
        return fallback;
    };

    const nowDate = () => new Date().toISOString().slice(0, 10);

    const deepClone = value => JSON.parse(JSON.stringify(value));

    const makeReport = () => ({
        repairedText: false,
        fixes: [],
        warnings: [],
        errors: [],
        inputSummary: null,
        outputSummary: null,
    });

    const pushFix = (report, path, message) => {
        report.fixes.push({ path, message });
    };
    const pushWarn = (report, path, message) => {
        report.warnings.push({ path, message });
    };
    const pushErr = (report, path, message) => {
        report.errors.push({ path, message });
    };

    const normalizeLevels = (target, report, path) => {
        if (!target || typeof target !== 'object') return;
        let levels = [];
        if (Array.isArray(target.levels)) levels = target.levels;
        else if (Number.isFinite(Number(target.level))) levels = [Number(target.level)];

        const cleaned = [...new Set(levels
            .map(v => Number(v))
            .filter(v => Number.isFinite(v))
            .map(v => Math.trunc(v))
            .filter(v => v >= 1 && v <= 4))];

        if (cleaned.length) {
            if (!Array.isArray(target.levels) || cleaned.join(',') !== target.levels.join(',')) {
                target.levels = cleaned;
                pushFix(report, `${path}.levels`, 'Niveaux normalisés en tableau [1..4].');
            }
        } else if (target.levels != null || target.level != null) {
            delete target.levels;
            delete target.level;
            pushFix(report, path, 'Niveaux invalides supprimés.');
        }
    };

    const summarize = data => {
        if (!data || typeof data !== 'object' || !Array.isArray(data.slides)) {
            return {
                title: 'Présentation invalide',
                slideCount: 0,
                canvasCount: 0,
                visualCount: 0,
                quizCount: 0,
                typeCounts: {},
            };
        }
        const typeCounts = {};
        let canvasCount = 0;
        let visualCount = 0;
        let quizCount = 0;
        for (const slide of data.slides) {
            const type = String(slide?.type || 'unknown');
            typeCounts[type] = (typeCounts[type] || 0) + 1;
            if (type === 'canvas') canvasCount += 1;
            if (['image', 'canvas', 'comparison', 'split'].includes(type)) visualCount += 1;
            if (type === 'quiz') quizCount += 1;
        }
        return {
            title: String(data.metadata?.title || 'Sans titre'),
            slideCount: data.slides.length,
            canvasCount,
            visualCount,
            quizCount,
            typeCounts,
        };
    };

    const levelToArray = raw => {
        if (Array.isArray(raw)) return raw;
        if (Number.isFinite(Number(raw))) return [Number(raw)];
        return [];
    };

    const normalizeListItems = (items, fallback = []) => {
        if (!Array.isArray(items)) return fallback;
        const out = items.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                if (typeof item.text === 'string') return item.text;
                if (typeof item.label === 'string') return item.label;
                if (typeof item.title === 'string') return item.title;
            }
            if (item == null) return '';
            return String(item);
        }).map(v => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
        return out.length ? out : fallback;
    };

    const parseHtmlList = html => {
        const src = String(html || '');
        const liMatches = [...src.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1] || '');
        if (liMatches.length) {
            return liMatches
                .map(txt => txt.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
        }
        const plain = src
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return plain ? [plain] : [];
    };

    const isValidElementId = id => /^el_[a-zA-Z0-9]{7}$/.test(String(id || ''));

    const createElementId = used => {
        let id = '';
        do {
            id = 'el_' + Math.random().toString(36).slice(2, 9);
        } while (used.has(id));
        used.add(id);
        return id;
    };

    const normalizeElement = (el, slidePath, index, usedIds, report) => {
        if (!el || typeof el !== 'object') {
            pushWarn(report, `${slidePath}.elements[${index}]`, 'Élément canvas invalide ignoré.');
            return null;
        }
        const out = deepClone(el);
        const type = String(out.type || '').trim();
        if (!type) {
            pushWarn(report, `${slidePath}.elements[${index}]`, 'Élément canvas sans type ignoré.');
            return null;
        }
        if (!isValidElementId(out.id) || usedIds.has(out.id)) {
            const next = createElementId(usedIds);
            pushFix(report, `${slidePath}.elements[${index}].id`, `ID normalisé (${next}).`);
            out.id = next;
        } else {
            usedIds.add(out.id);
        }

        out.data = (out.data && typeof out.data === 'object') ? out.data : {};
        out.style = (out.style && typeof out.style === 'object') ? out.style : {};

        if (out.type === 'list') {
            const nextItems = normalizeListItems(out.data.items || out.items || [], ['Point']);
            if (!Array.isArray(out.data.items) || nextItems.join('||') !== (out.data.items || []).join('||')) {
                out.data.items = nextItems;
                pushFix(report, `${slidePath}.elements[${index}].data.items`, 'Liste normalisée en tableau de chaînes.');
            }
        }

        if (out.type === 'table') {
            const rows = Array.isArray(out.data.rows) ? out.data.rows : [];
            const cleanedRows = rows.map(r => Array.isArray(r) ? r.map(c => toStr(c, '')) : [toStr(r, '')]);
            if (!rows.length) {
                out.data.rows = [['Colonne 1', 'Colonne 2'], ['Valeur', 'Valeur']];
                pushFix(report, `${slidePath}.elements[${index}].data.rows`, 'Tableau vide remplacé par une structure minimale.');
            } else if (JSON.stringify(rows) !== JSON.stringify(cleanedRows)) {
                out.data.rows = cleanedRows;
                pushFix(report, `${slidePath}.elements[${index}].data.rows`, 'Tableau normalisé en matrice de chaînes.');
            }
        }

        if (out.type === 'card' && Object.prototype.hasOwnProperty.call(out.data, 'content') && !Array.isArray(out.data.items)) {
            out.data.items = normalizeListItems(parseHtmlList(out.data.content), ['Contenu']);
            delete out.data.content;
            pushFix(report, `${slidePath}.elements[${index}].data`, 'card.data.content converti en card.data.items.');
        }

        if (out.type === 'mcq-single') {
            if (!Array.isArray(out.data.options)) out.data.options = normalizeListItems(out.options || [], ['Option A', 'Option B']);
            if (!Number.isFinite(Number(out.data.answer)) && Number.isFinite(Number(out.data.correctIndex))) {
                out.data.answer = Math.trunc(Number(out.data.correctIndex));
                pushFix(report, `${slidePath}.elements[${index}].data.answer`, 'correctIndex converti en answer.');
            }
            delete out.data.correctIndex;
            const max = Math.max(0, (out.data.options?.length || 1) - 1);
            const ans = Math.trunc(Number(out.data.answer));
            if (!Number.isFinite(ans) || ans < 0 || ans > max) {
                out.data.answer = 0;
                pushFix(report, `${slidePath}.elements[${index}].data.answer`, 'Réponse hors bornes corrigée à 0.');
            }
        }

        if (out.type === 'mcq-multi') {
            if (!Array.isArray(out.data.options)) out.data.options = normalizeListItems(out.options || [], ['Option A', 'Option B']);
            const rawAnswers = Array.isArray(out.data.answers)
                ? out.data.answers
                : (Array.isArray(out.data.correctIndices)
                    ? out.data.correctIndices
                    : (Number.isFinite(Number(out.data.correctIndex)) ? [Number(out.data.correctIndex)] : []));
            const max = Math.max(0, (out.data.options?.length || 1) - 1);
            const answers = [...new Set(rawAnswers
                .map(v => Number(v))
                .filter(v => Number.isFinite(v))
                .map(v => Math.trunc(v))
                .filter(v => v >= 0 && v <= max))];
            out.data.answers = answers;
            delete out.data.correctIndex;
            delete out.data.correctIndices;
            if (answers.length !== rawAnswers.length || !Array.isArray(out.data.answers)) {
                pushFix(report, `${slidePath}.elements[${index}].data.answers`, 'Réponses multi normalisées.');
            }
        }

        if (['code-example', 'definition', 'highlight', 'code'].includes(out.type)) {
            if (out.label != null && out.data.label == null) {
                out.data.label = toStr(out.label, '');
                delete out.label;
                pushFix(report, `${slidePath}.elements[${index}].data.label`, 'label déplacé vers data.label.');
            }
            if (out.tone != null && out.data.tone == null) {
                out.data.tone = toStr(out.tone, 'auto');
                delete out.tone;
                pushFix(report, `${slidePath}.elements[${index}].data.tone`, 'tone déplacé vers data.tone.');
            }
        }

        return out;
    };

    const createCanvasFromUnsupportedSlide = (slide, index, report) => {
        const originalType = String(slide.type || 'text');
        const data = (slide.data && typeof slide.data === 'object') ? deepClone(slide.data) : {};
        const passthrough = ['title', 'subtitle', 'text', 'quote', 'author', 'caption', 'term', 'definition', 'example', 'question', 'options', 'answer', 'answers', 'rows', 'items', 'code', 'language', 'widgetType', 'label', 'tone'];
        for (const key of passthrough) {
            if (data[key] == null && slide[key] != null) data[key] = deepClone(slide[key]);
        }
        const slidePath = `slides[${index}]`;
        const used = new Set();
        const el = normalizeElement({
            id: 'el_' + Math.random().toString(36).slice(2, 9),
            type: CANVAS_TYPES.has(originalType) ? originalType : 'text',
            x: 100,
            y: 140,
            w: 1080,
            h: 460,
            z: 1,
            data,
            style: (slide.style && typeof slide.style === 'object') ? slide.style : {},
        }, slidePath, 0, used, report);

        const elements = [];
        if (slide.title) {
            elements.push({
                id: createElementId(used),
                type: 'heading',
                x: 70,
                y: 40,
                w: 1140,
                h: 80,
                z: 1,
                data: { text: toStr(slide.title, 'Titre') },
                style: { fontSize: 44, fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' },
            });
        }
        if (el) {
            if (elements.length) el.z = 2;
            elements.push(el);
        }

        const out = {
            type: 'canvas',
            notes: toStr(slide.notes, ''),
            levels: levelToArray(slide.levels || slide.level),
            elements,
            connectors: [],
        };
        normalizeLevels(out, report, slidePath);
        pushFix(report, slidePath, `Slide de type "${originalType}" convertie en canvas.`);
        return out;
    };

    const convertLegacySplitDataToCanvas = (slide, index, report) => {
        const data = (slide.data && typeof slide.data === 'object') ? slide.data : {};
        const contentHtml = toStr(data.content, '');
        const media = (data.media && typeof data.media === 'object') ? data.media : null;
        const items = parseHtmlList(contentHtml);
        const used = new Set();
        const elements = [];
        if (slide.title) {
            elements.push({
                id: createElementId(used),
                type: 'heading',
                x: 70,
                y: 40,
                w: 1140,
                h: 72,
                z: 1,
                data: { text: toStr(slide.title, 'Sans titre') },
                style: { fontSize: 42, fontWeight: 800, color: 'var(--sl-heading)', textAlign: 'left', fontFamily: 'var(--sl-font-heading)' },
            });
        }

        if (items.length) {
            elements.push({
                id: createElementId(used),
                type: 'list',
                x: 70,
                y: 140,
                w: media ? 620 : 1140,
                h: 500,
                z: 2,
                data: { items },
                style: { color: 'var(--sl-text)' },
            });
        } else if (contentHtml) {
            elements.push({
                id: createElementId(used),
                type: 'text',
                x: 70,
                y: 140,
                w: media ? 620 : 1140,
                h: 500,
                z: 2,
                data: { text: contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() },
                style: { color: 'var(--sl-text)' },
            });
        }

        if (media && String(media.type || '').toLowerCase() === 'image' && media.src) {
            elements.push({
                id: createElementId(used),
                type: 'image',
                x: 730,
                y: 140,
                w: 480,
                h: 500,
                z: 2,
                data: {
                    src: String(media.src || ''),
                    alt: toStr(media.alt, 'Illustration'),
                    caption: '',
                },
                style: {},
            });
        }

        const out = {
            type: 'canvas',
            notes: toStr(slide.notes, ''),
            levels: levelToArray(slide.levels || slide.level),
            elements,
            connectors: [],
        };
        normalizeLevels(out, report, `slides[${index}]`);
        pushFix(report, `slides[${index}]`, 'Split legacy (data.content/media) converti en canvas.');
        return out;
    };

    const normalizeSlide = (slide, index, report) => {
        const path = `slides[${index}]`;
        if (!slide || typeof slide !== 'object') {
            pushWarn(report, path, 'Slide invalide remplacé par un slide bullets.');
            return {
                type: 'bullets',
                title: `Slide ${index + 1}`,
                items: ['Contenu indisponible'],
                notes: '',
            };
        }

        const out = deepClone(slide);
        out.notes = toStr(out.notes, '');
        normalizeLevels(out, report, path);

        const type = String(out.type || '').trim().toLowerCase();
        if (!type) {
            pushWarn(report, path, 'Type manquant, slide converti en bullets.');
            out.type = 'bullets';
            out.title = toStr(out.title, `Slide ${index + 1}`);
            out.items = normalizeListItems(out.items || [out.text], ['Point principal']);
            return out;
        }

        if (type === 'split') {
            if (out.data && typeof out.data === 'object' && (out.data.content != null || out.data.media != null)) {
                return convertLegacySplitDataToCanvas(out, index, report);
            }
            if (typeof out.left === 'string' || typeof out.right === 'string') {
                const leftText = toStr(out.left, '');
                const rightText = toStr(out.right, '');
                out.left = { label: 'Contenu', type: 'text', text: leftText };
                out.right = { label: 'Illustration', type: 'text', text: rightText };
                pushFix(report, path, 'split.left/right (texte) normalisés en colonnes structurées.');
            }
        }

        if (type === 'comparison') {
            out.data = (out.data && typeof out.data === 'object') ? out.data : {};
            const left = (out.data.left && typeof out.data.left === 'object') ? out.data.left : (out.left && typeof out.left === 'object' ? out.left : {});
            const right = (out.data.right && typeof out.data.right === 'object') ? out.data.right : (out.right && typeof out.right === 'object' ? out.right : {});
            if ((out.leftTitle || out.leftItems) && (!left.title || !(left.items || []).length)) {
                left.title = toStr(out.leftTitle, left.title || 'Option A');
                left.items = normalizeListItems(out.leftItems || left.items || [], ['Point']);
                pushFix(report, `${path}.data.left`, 'leftTitle/leftItems convertis en data.left.');
            }
            if ((out.rightTitle || out.rightItems) && (!right.title || !(right.items || []).length)) {
                right.title = toStr(out.rightTitle, right.title || 'Option B');
                right.items = normalizeListItems(out.rightItems || right.items || [], ['Point']);
                pushFix(report, `${path}.data.right`, 'rightTitle/rightItems convertis en data.right.');
            }
            out.data.left = {
                title: toStr(left.title, 'Option A'),
                items: normalizeListItems(left.items || [], []),
                pros: normalizeListItems(left.pros || [], []),
                cons: normalizeListItems(left.cons || [], []),
            };
            out.data.right = {
                title: toStr(right.title, 'Option B'),
                items: normalizeListItems(right.items || [], []),
                pros: normalizeListItems(right.pros || [], []),
                cons: normalizeListItems(right.cons || [], []),
            };
            delete out.leftTitle;
            delete out.leftItems;
            delete out.rightTitle;
            delete out.rightItems;
            delete out.left;
            delete out.right;
        }

        if (type === 'bullets') {
            out.items = normalizeListItems(out.items || [], ['Point principal']);
        }

        if (type === 'quiz' && Array.isArray(out.questions)) {
            out.questions = out.questions.map((q, qi) => {
                const qq = (q && typeof q === 'object') ? deepClone(q) : { type: 'mcq-single', data: {} };
                qq.data = (qq.data && typeof qq.data === 'object') ? qq.data : {};
                if (!Array.isArray(qq.data.options)) qq.data.options = normalizeListItems(qq.options || [], ['Option A', 'Option B']);
                if (qq.type === 'mcq-single') {
                    if (!Number.isFinite(Number(qq.data.answer)) && Number.isFinite(Number(qq.data.correctIndex))) {
                        qq.data.answer = Math.trunc(Number(qq.data.correctIndex));
                        delete qq.data.correctIndex;
                        pushFix(report, `${path}.questions[${qi}].data.answer`, 'correctIndex converti en answer.');
                    }
                    if (!Number.isFinite(Number(qq.data.answer))) qq.data.answer = 0;
                }
                if (qq.type === 'mcq-multi') {
                    const rawAnswers = Array.isArray(qq.data.answers)
                        ? qq.data.answers
                        : (Array.isArray(qq.data.correctIndices) ? qq.data.correctIndices : []);
                    qq.data.answers = [...new Set(rawAnswers.map(v => Math.trunc(Number(v))).filter(v => Number.isFinite(v) && v >= 0))];
                    delete qq.data.correctIndices;
                    delete qq.data.correctIndex;
                }
                return qq;
            });
        }

        if (type === 'canvas') {
            out.elements = Array.isArray(out.elements) ? out.elements : [];
            out.connectors = Array.isArray(out.connectors) ? out.connectors : [];
            const used = new Set();
            const normalizedElements = [];
            out.elements.forEach((el, elIndex) => {
                const next = normalizeElement(el, path, elIndex, used, report);
                if (next) normalizedElements.push(next);
            });
            out.elements = normalizedElements;
        }

        if (!SUPPORTED_SLIDE_TYPES.has(type)) {
            if (CANVAS_TYPES.has(type)) {
                return createCanvasFromUnsupportedSlide(out, index, report);
            }
            pushWarn(report, path, `Type de slide non supporté (${type}) converti en bullets.`);
            return {
                type: 'bullets',
                title: toStr(out.title, `Slide ${index + 1}`),
                items: normalizeListItems(out.items || [out.text || out.definition || out.quote], ['Contenu']),
                notes: toStr(out.notes, ''),
                levels: levelToArray(out.levels || out.level),
            };
        }

        out.type = type;
        return out;
    };

    const normalizePresentation = (value, report) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            pushErr(report, 'root', 'Le JSON doit être un objet racine.');
            return null;
        }

        const data = deepClone(value);

        if (!Array.isArray(data.slides)) {
            pushErr(report, 'slides', 'Champ slides manquant (tableau attendu).');
            return null;
        }

        if (!data.metadata || typeof data.metadata !== 'object') {
            data.metadata = {};
            pushFix(report, 'metadata', 'Bloc metadata ajouté.');
        }
        if (!toStr(data.metadata.title, '').trim()) {
            data.metadata.title = 'Présentation importée';
            pushFix(report, 'metadata.title', 'Titre par défaut appliqué.');
        }
        if (!toStr(data.metadata.created, '').trim()) {
            data.metadata.created = nowDate();
            pushFix(report, 'metadata.created', 'Date de création ajoutée.');
        }
        data.metadata.modified = nowDate();

        if (typeof data.theme === 'string') {
            if (!SAFE_THEMES.has(data.theme)) pushWarn(report, 'theme', `Thème personnalisé conservé (${data.theme}).`);
        } else if (data.theme == null) {
            data.theme = 'dark';
            pushFix(report, 'theme', 'Thème par défaut appliqué.');
        }

        const normalizedSlides = [];
        data.slides.forEach((slide, idx) => {
            const next = normalizeSlide(slide, idx, report);
            if (next) normalizedSlides.push(next);
        });
        data.slides = normalizedSlides;

        return data;
    };

    const parseJsonText = text => {
        const raw = String(text ?? '');
        const repaired = typeof global._repairJsonText === 'function' ? global._repairJsonText(raw) : raw;
        const parsed = JSON.parse(repaired);
        return { parsed, repairedChanged: repaired !== raw };
    };

    const buildHtmlSummary = (result, sourceLabel = '') => {
        const report = result?.report || makeReport();
        const input = report.inputSummary || {};
        const output = report.outputSummary || {};
        const header = sourceLabel ? `<div style="font-size:.78rem;color:var(--muted,#94a3b8);margin-bottom:8px">Source: ${esc(sourceLabel)}</div>` : '';
        const stats = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 10px">
                <div style="padding:8px;border:1px solid var(--border,#2d3347);border-radius:8px">
                    <div style="font-size:.72rem;color:var(--muted,#94a3b8)">Avant</div>
                    <div style="font-size:.82rem"><strong>${esc(input.title || 'Sans titre')}</strong></div>
                    <div style="font-size:.74rem;color:var(--muted,#94a3b8)">${Number(input.slideCount || 0)} slide(s)</div>
                </div>
                <div style="padding:8px;border:1px solid var(--border,#2d3347);border-radius:8px">
                    <div style="font-size:.72rem;color:var(--muted,#94a3b8)">Après correction</div>
                    <div style="font-size:.82rem"><strong>${esc(output.title || 'Sans titre')}</strong></div>
                    <div style="font-size:.74rem;color:var(--muted,#94a3b8)">${Number(output.slideCount || 0)} slide(s)</div>
                </div>
            </div>`;

        const fixList = report.fixes.slice(0, 8).map(item => `<li><code>${esc(item.path)}</code> — ${esc(item.message)}</li>`).join('');
        const warnList = report.warnings.slice(0, 6).map(item => `<li><code>${esc(item.path)}</code> — ${esc(item.message)}</li>`).join('');
        const moreFix = report.fixes.length > 8 ? `<div style="font-size:.72rem;color:var(--muted,#94a3b8)">+${report.fixes.length - 8} correction(s) supplémentaire(s)</div>` : '';
        const repaired = report.repairedText ? '<div style="font-size:.74rem;color:#f59e0b">Le JSON brut a été réparé (guillemets/retours à la ligne).</div>' : '';

        return `${header}${stats}${repaired}
            <div style="font-size:.8rem;margin-top:6px"><strong>${report.fixes.length}</strong> correction(s) automatique(s), <strong>${report.warnings.length}</strong> avertissement(s).</div>
            ${fixList ? `<div style="margin-top:8px"><div style="font-size:.76rem;font-weight:700">Corrections</div><ul style="margin:4px 0 0 16px;padding:0;font-size:.75rem;line-height:1.45">${fixList}</ul>${moreFix}</div>` : ''}
            ${warnList ? `<div style="margin-top:8px"><div style="font-size:.76rem;font-weight:700">Avertissements</div><ul style="margin:4px 0 0 16px;padding:0;font-size:.75rem;line-height:1.45">${warnList}</ul></div>` : ''}`;
    };

    async function importFromText(text) {
        const report = makeReport();
        let parsed;
        try {
            const parsedInfo = parseJsonText(text);
            parsed = parsedInfo.parsed;
            report.repairedText = !!parsedInfo.repairedChanged;
        } catch (err) {
            pushErr(report, 'root', `JSON invalide: ${err?.message || 'erreur de parsing'}`);
            const e = new Error(report.errors[0].message);
            e.report = report;
            throw e;
        }

        report.inputSummary = summarize(parsed);
        const normalized = normalizePresentation(parsed, report);
        if (!normalized || report.errors.length) {
            const e = new Error(report.errors.map(x => x.message).join(' | ') || 'Import impossible');
            e.report = report;
            throw e;
        }
        report.outputSummary = summarize(normalized);
        return { data: normalized, report, raw: parsed };
    }

    async function confirmImport(result, options = {}) {
        if (!global.OEIDialog?.confirm) return true;
        const report = result?.report || makeReport();
        const html = buildHtmlSummary(result, options.sourceLabel || '');
        const confirmLabel = report.fixes.length ? 'Importer avec corrections' : 'Importer';
        return !!(await global.OEIDialog.confirm(html, {
            title: 'Prévisualisation de l’import',
            confirmLabel,
            cancelLabel: 'Annuler',
            danger: false,
        }));
    }

    global.OEIImportPipeline = Object.freeze({
        importFromText,
        confirmImport,
        summarize,
        buildHtmlSummary,
    });
})(typeof window !== 'undefined' ? window : globalThis);
