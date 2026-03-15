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
    const CURRENT_SCHEMA_VERSION = 2;
    const AI_IMPORT_PIPELINE_KEY = global.OEIStorage?.KEYS?.AI_IMPORT_PIPELINE || 'oei-ai-import-pipeline';
    const AI_IMPORT_PIPELINE_DEFAULTS = Object.freeze({
        base64Mode: 'icons-only',
        autoInjectIllustrations: true,
        fetchRemoteImages: false,
        stepValidation: false,
        forceImageGeneration: false,
        timeoutMs: 60000,
        maxIllustrations: 14,
    });
    const IMPORT_CANCELLED_CODE = 'OEI_IMPORT_CANCELLED';
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

    const importPipelineRuntime = global.OEIImportPipelineRuntime;
    if (!importPipelineRuntime) {
        throw new Error('[OEIImportPipeline] Module manquant: charger import-pipeline-runtime.js avant import-pipeline.js.');
    }
    const importNormalization = global.OEIImportPipelineNormalization;
    if (!importNormalization) {
        throw new Error('[OEIImportPipeline] Module manquant: charger import-pipeline-normalization.js avant import-pipeline.js.');
    }
    const importLayout = global.OEIImportPipelineLayout;
    if (!importLayout) {
        throw new Error('[OEIImportPipeline] Module manquant: charger import-pipeline-layout.js avant import-pipeline.js.');
    }
    const toStr = importNormalization.toStr;
    const levelToArray = importNormalization.levelToArray;
    const normalizeListItems = importNormalization.normalizeListItems;
    const stripHtmlToText = importNormalization.stripHtmlToText;
    const parseHtmlList = importNormalization.parseHtmlList;

    const _readStoredJSON = (key, fallback = null) => {
        if (!key) return fallback;
        if (global.OEIStorage?.getJSON) return global.OEIStorage.getJSON(key, fallback);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    };

    const _sanitizeAIImportPipelineSettings = (raw = {}) => {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const toInt = (value, fallback, min, max) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.max(min, Math.min(max, Math.trunc(n)));
        };
        const base64Mode = ['none', 'icons-only', 'all'].includes(src.base64Mode)
            ? src.base64Mode
            : AI_IMPORT_PIPELINE_DEFAULTS.base64Mode;
        return {
            base64Mode,
            autoInjectIllustrations: src.autoInjectIllustrations !== false,
            fetchRemoteImages: src.fetchRemoteImages === true,
            stepValidation: src.stepValidation === true,
            forceImageGeneration: src.forceImageGeneration === true,
            timeoutMs: toInt(src.timeoutMs, AI_IMPORT_PIPELINE_DEFAULTS.timeoutMs, 1000, 300000),
            maxIllustrations: toInt(src.maxIllustrations, AI_IMPORT_PIPELINE_DEFAULTS.maxIllustrations, 0, 60),
        };
    };

    const getAIImportPipelineSettings = (override = null) => {
        if (override && typeof override === 'object') {
            return _sanitizeAIImportPipelineSettings(override);
        }
        return _sanitizeAIImportPipelineSettings(_readStoredJSON(AI_IMPORT_PIPELINE_KEY, AI_IMPORT_PIPELINE_DEFAULTS));
    };

    const parseSchemaVersion = value => {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const v = Math.trunc(n);
        return v >= 0 ? v : null;
    };

    const inferSchemaVersion = data => {
        if (!data || typeof data !== 'object') return 0;
        let version = 0;
        if (typeof data.showSlideNumber === 'boolean'
            || Object.prototype.hasOwnProperty.call(data, 'footerText')
            || typeof data.autoNumberChapters === 'boolean') {
            version = Math.max(version, 1);
        }
        if (Array.isArray(data.reviewComments)
            || (Array.isArray(data.slides) && data.slides.some(slide => Array.isArray(slide?.levels)))) {
            version = Math.max(version, 2);
        }
        return version;
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
        passes: [],
        media: { generated: 0, fetched: 0, failed: 0 },
        illustrationPlan: [],
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
    const pushPass = (report, name, details = '') => {
        report.passes.push({ name: String(name || ''), details: String(details || '') });
    };
    const _makeImportCancelledError = (report, stepName) => {
        const err = new Error(`Import annulé pendant ${stepName}.`);
        err.code = IMPORT_CANCELLED_CODE;
        err.step = String(stepName || '');
        err.report = report;
        return err;
    };
    const _buildStepValidationHtml = (report, stepName, details = '') => {
        const media = report?.media || { generated: 0, fetched: 0, failed: 0 };
        const passCount = Array.isArray(report?.passes) ? report.passes.length : 0;
        const detailsLine = String(details || '').trim();
        return `
            <div style="font-size:1rem;margin-bottom:10px"><strong>${esc(stepName)}</strong> terminé.</div>
            ${detailsLine ? `<div style="font-size:.9rem;color:var(--muted,#94a3b8);margin-bottom:10px;line-height:1.4">${esc(detailsLine)}</div>` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                <div style="padding:10px;border:1px solid var(--border,#2d3347);border-radius:8px">
                    <div style="font-size:.82rem;color:var(--muted,#94a3b8)">Corrections</div>
                    <div style="font-size:1rem"><strong>${Number(report?.fixes?.length || 0)}</strong></div>
                </div>
                <div style="padding:10px;border:1px solid var(--border,#2d3347);border-radius:8px">
                    <div style="font-size:.82rem;color:var(--muted,#94a3b8)">Avertissements</div>
                    <div style="font-size:1rem"><strong>${Number(report?.warnings?.length || 0)}</strong></div>
                </div>
            </div>
            <div style="font-size:.84rem;color:var(--muted,#94a3b8);line-height:1.45">
                Passes exécutées: ${passCount}<br>
                Média — générés: ${Number(media.generated || 0)}, téléchargés: ${Number(media.fetched || 0)}, échecs: ${Number(media.failed || 0)}
            </div>
            <div style="font-size:.9rem;margin-top:12px">Continuer vers la passe suivante ?</div>
        `;
    };
    const _confirmPipelineStep = async (report, settings, stepName, details = '') => {
        if (!settings?.stepValidation) return true;
        if (!global.OEIDialog?.confirm) return true;
        const ok = await global.OEIDialog.confirm(_buildStepValidationHtml(report, stepName, details), {
            title: 'Validation pipeline local',
            confirmLabel: 'Continuer',
            cancelLabel: 'Arrêter',
            danger: false,
        });
        if (!ok) throw _makeImportCancelledError(report, stepName);
        return true;
    };

    const migratePresentationSchema = (data, report) => {
        let version = parseSchemaVersion(data?.schemaVersion);
        if (version == null) {
            version = inferSchemaVersion(data);
            pushFix(report, 'schemaVersion', `Version de schéma absente, version inférée: v${version}.`);
        }
        if (version > CURRENT_SCHEMA_VERSION) {
            data.schemaVersion = version;
            pushWarn(report, 'schemaVersion', `Version de schéma future (v${version}) conservée telle quelle.`);
            return;
        }

        while (version < CURRENT_SCHEMA_VERSION) {
            if (version === 0) {
                if (typeof data.showSlideNumber !== 'boolean') {
                    data.showSlideNumber = false;
                    pushFix(report, 'showSlideNumber', 'showSlideNumber ajouté (false).');
                }
                if (!Object.prototype.hasOwnProperty.call(data, 'footerText')) {
                    data.footerText = null;
                    pushFix(report, 'footerText', 'footerText ajouté (null).');
                }
                if (typeof data.autoNumberChapters !== 'boolean') {
                    data.autoNumberChapters = false;
                    pushFix(report, 'autoNumberChapters', 'autoNumberChapters ajouté (false).');
                }
                version = 1;
                pushFix(report, 'schemaVersion', 'Migration appliquée: v0 -> v1.');
                continue;
            }
            if (version === 1) {
                if (!Array.isArray(data.reviewComments)) {
                    data.reviewComments = [];
                    pushFix(report, 'reviewComments', 'reviewComments ajouté (tableau vide).');
                }
                if (Array.isArray(data.slides)) {
                    data.slides.forEach((slide, idx) => {
                        if (!slide || typeof slide !== 'object') return;
                        if (typeof slide.notes !== 'string') {
                            slide.notes = toStr(slide.notes, '');
                            pushFix(report, `slides[${idx}].notes`, 'Notes normalisées en chaîne.');
                        }
                    });
                }
                version = 2;
                pushFix(report, 'schemaVersion', 'Migration appliquée: v1 -> v2.');
                continue;
            }
            break;
        }

        if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
            data.schemaVersion = CURRENT_SCHEMA_VERSION;
            pushFix(report, 'schemaVersion', `Version de schéma normalisée en v${CURRENT_SCHEMA_VERSION}.`);
        }
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

    const clampNum = importLayout.clampNum;
    const toFiniteNumber = importLayout.toFiniteNumber;
    const estimateCardLineLoad = importLayout.estimateCardLineLoad;

    const applyAutoExpandSizing = (out, slidePath, index, report) => {
        importLayout.applyAutoExpandSizing(out, {
            slidePath,
            index,
            report,
            pushFix,
            toStr,
            normalizeListItems,
            stripHtmlToText,
        });
    };

    const normalizeColumnsElement = (out, slidePath, index, report) => {
        if (String(out?.type || '').toLowerCase() !== 'columns') return out;
        const data = (out.data && typeof out.data === 'object') ? out.data : {};
        let columns = Array.isArray(data.columns) ? data.columns : [];
        if (!columns.length) {
            const left = (data.left && typeof data.left === 'object') ? data.left : null;
            const right = (data.right && typeof data.right === 'object') ? data.right : null;
            columns = [left, right].filter(Boolean);
        }
        if (!columns.length) {
            const left = (out.left && typeof out.left === 'object') ? out.left : null;
            const right = (out.right && typeof out.right === 'object') ? out.right : null;
            columns = [left, right].filter(Boolean);
        }
        if (!columns.length) {
            columns = [{ title: 'Colonne 1', items: parseHtmlList(data.content || data.text || out.text || '') }];
        }
        const normalizedColumns = columns.map((col, idx) => {
            const title = toStr(col?.title || col?.label || col?.name, `Colonne ${idx + 1}`).trim() || `Colonne ${idx + 1}`;
            let items = normalizeListItems(col?.items || col?.bullets || [], []);
            if (!items.length) {
                const raw = toStr(col?.text || col?.content || col?.body, '').trim();
                if (raw) {
                    items = parseHtmlList(raw);
                    if (!items.length) {
                        items = raw.split(/\n+/).map(v => v.trim()).filter(Boolean);
                    }
                }
            }
            if (!items.length) items = ['—'];
            return { title, items };
        });
        const headers = normalizedColumns.map(col => col.title);
        const maxRows = Math.max(1, ...normalizedColumns.map(col => col.items.length));
        const rows = [headers];
        for (let r = 0; r < maxRows; r++) {
            rows.push(normalizedColumns.map(col => toStr(col.items[r], '')));
        }
        out.type = 'table';
        out.data = { ...data, rows };
        delete out.data.columns;
        delete out.data.left;
        delete out.data.right;
        delete out.data.content;
        delete out.data.text;
        delete out.left;
        delete out.right;
        delete out.text;
        if (!Number.isFinite(Number(out.w))) out.w = 1040;
        if (!Number.isFinite(Number(out.h))) out.h = 360;
        pushFix(report, `${slidePath}.elements[${index}]`, 'Composant "columns" converti en "table" (format supporté).');
        return out;
    };

    const applyHeadingFlowAdjustments = (elements, slidePath, report) => {
        importLayout.applyHeadingFlowAdjustments(elements, {
            slidePath,
            report,
            pushFix,
            toStr,
        });
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
        normalizeColumnsElement(out, slidePath, index, report);
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

        ['text', 'html', 'title', 'label', 'term', 'definition', 'example', 'question', 'language', 'code', 'alt', 'src'].forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(out.data, key)) return;
            const raw = out.data[key];
            if (typeof raw === 'string') return;
            if (raw == null) {
                out.data[key] = '';
                return;
            }
            out.data[key] = toStr(raw, '');
            pushFix(report, `${slidePath}.elements[${index}].data.${key}`, 'Valeur objet normalisée en chaîne.');
        });

        if (out.type === 'heading' && !toStr(out.data.text, '').trim()) {
            out.data.text = 'Titre';
            pushFix(report, `${slidePath}.elements[${index}].data.text`, 'Heading sans texte remplacé par un titre par défaut.');
        }

        if (out.type === 'image') {
            out.data.src = toStr(out.data.src, '').trim();
            out.data.alt = toStr(out.data.alt, '').trim() || 'Illustration';
            if (!out.data.src) {
                out.data.src = _generateAssetSvgDataUrl({ token: 'warning', label: 'Image manquante' });
                pushFix(report, `${slidePath}.elements[${index}].data.src`, 'Image vide remplacée par un SVG local.');
            }
        }

        if (out.type === 'list') {
            const nextItems = normalizeListItems(out.data.items || out.items || [], ['Point']);
            if (!Array.isArray(out.data.items) || nextItems.join('||') !== (out.data.items || []).join('||')) {
                out.data.items = nextItems;
                pushFix(report, `${slidePath}.elements[${index}].data.items`, 'Liste normalisée en tableau de chaînes.');
            }
        }

        if (out.type === 'smartart') {
            const normalizedItems = normalizeListItems(out.data.items || out.items || [], []);
            if (!Array.isArray(out.data.items) || normalizedItems.join('||') !== (out.data.items || []).join('||')) {
                out.data.items = normalizedItems;
                pushFix(report, `${slidePath}.elements[${index}].data.items`, 'SmartArt normalisé en tableau de chaînes.');
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

        if (out.type === 'card') {
            const normalizedItems = normalizeListItems(out.data.items || [], []);
            if (!Array.isArray(out.data.items) || normalizedItems.join('||') !== (out.data.items || []).join('||')) {
                out.data.items = normalizedItems;
                pushFix(report, `${slidePath}.elements[${index}].data.items`, 'Contenu de carte normalisé.');
            }

            let x = Math.round(toFiniteNumber(out.x, 60));
            let y = Math.round(toFiniteNumber(out.y, 140));
            let w = Math.round(clampNum(toFiniteNumber(out.w, 540), 240, 1200));
            let h = Math.round(clampNum(toFiniteNumber(out.h, 320), 140, 680));
            const original = { x, y, w, h };

            x = clampNum(x, 0, 1279);
            y = clampNum(y, 0, 719);
            w = Math.min(w, Math.max(240, 1280 - x));
            h = Math.min(h, Math.max(140, 720 - y));

            const title = toStr(out.data.title, '').trim();
            const items = Array.isArray(out.data.items) ? out.data.items : [];
            const lineHeightPx = 23;
            const baseOverhead = title ? 106 : 66;
            const capacityFor = (heightPx) => Math.max(1, Math.floor((Math.max(120, heightPx) - baseOverhead) / lineHeightPx));
            const linesFor = (widthPx) => estimateCardLineLoad(title, items, widthPx);

            let requiredLines = linesFor(w);
            let capacity = capacityFor(h);
            if (requiredLines > capacity) {
                const maxH = Math.max(140, 720 - y);
                const neededH = baseOverhead + requiredLines * lineHeightPx + 18;
                h = Math.round(clampNum(Math.max(h, neededH), 140, maxH));
                capacity = capacityFor(h);
            }

            if (requiredLines > capacity) {
                const maxW = Math.max(240, 1280 - x);
                for (let candidate = w + 40; candidate <= maxW; candidate += 40) {
                    const lines = linesFor(candidate);
                    if (lines <= capacity || candidate >= maxW) {
                        w = candidate;
                        requiredLines = lines;
                        break;
                    }
                }
            }

            if (requiredLines > capacityFor(h)) {
                const maxH = Math.max(140, 720 - y);
                const neededH = baseOverhead + requiredLines * lineHeightPx + 18;
                h = Math.round(clampNum(Math.max(h, neededH), 140, maxH));
            }

            w = Math.round(clampNum(w, 240, Math.max(240, 1280 - x)));
            h = Math.round(clampNum(h, 140, Math.max(140, 720 - y)));

            out.x = x;
            out.y = y;
            out.w = w;
            out.h = h;

            if (original.x !== x || original.y !== y || original.w !== w || original.h !== h) {
                pushFix(report, `${slidePath}.elements[${index}]`, 'Dimensions de carte ajustées pour limiter les barres de défilement.');
            }
        }

        if (out.type !== 'card') {
            applyAutoExpandSizing(out, slidePath, index, report);
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
            applyHeadingFlowAdjustments(normalizedElements, path, report);
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

        migratePresentationSchema(data, report);

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

    const importPipelineRuntimeDeps = Object.freeze({
        toStr,
        createElementId,
        pushFix,
        pushWarn,
        pushPass,
    });

    const _detectIllustrationToken = text => importPipelineRuntime.detectIllustrationToken(text);

    const _normalizeIllustrationPlan = (rawPlan, data, report, settings) => (
        importPipelineRuntime.normalizeIllustrationPlan(rawPlan, data, report, settings, importPipelineRuntimeDeps)
    );

    const _applyIllustrationPlan = (data, report, settings) => (
        importPipelineRuntime.applyIllustrationPlan(data, report, settings, importPipelineRuntimeDeps)
    );

    const _parseAssetRef = src => importPipelineRuntime.parseAssetRef(src, importPipelineRuntimeDeps);

    const _generateAssetSvgDataUrl = ({ token, label }) => (
        importPipelineRuntime.generateAssetSvgDataUrl({ token, label })
    );

    const _materializeMediaAssets = (data, report, settings) => (
        importPipelineRuntime.materializeMediaAssets(data, report, settings, importPipelineRuntimeDeps)
    );

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
        const passList = (Array.isArray(report.passes) ? report.passes : [])
            .map(item => `<li><strong>${esc(item.name)}</strong>${item.details ? ` — ${esc(item.details)}` : ''}</li>`)
            .join('');
        const moreFix = report.fixes.length > 8 ? `<div style="font-size:.72rem;color:var(--muted,#94a3b8)">+${report.fixes.length - 8} correction(s) supplémentaire(s)</div>` : '';
        const repaired = report.repairedText ? '<div style="font-size:.74rem;color:#f59e0b">Le JSON brut a été réparé (guillemets/retours à la ligne).</div>' : '';
        const mediaStats = report.media
            ? `<div style="font-size:.74rem;color:var(--muted,#94a3b8);margin-top:6px">Média pass 4 — générés: ${Number(report.media.generated || 0)}, téléchargés: ${Number(report.media.fetched || 0)}, échecs: ${Number(report.media.failed || 0)}</div>`
            : '';
        const illuStats = Array.isArray(report.illustrationPlan)
            ? `<div style="font-size:.74rem;color:var(--muted,#94a3b8);margin-top:4px">Illustrations pass 2: ${report.illustrationPlan.length}</div>`
            : '';

        return `${header}${stats}${repaired}
            <div style="font-size:.8rem;margin-top:6px"><strong>${report.fixes.length}</strong> correction(s) automatique(s), <strong>${report.warnings.length}</strong> avertissement(s).</div>
            ${mediaStats}${illuStats}
            ${passList ? `<div style="margin-top:8px"><div style="font-size:.76rem;font-weight:700">Passes exécutées</div><ul style="margin:4px 0 0 16px;padding:0;font-size:.74rem;line-height:1.45">${passList}</ul></div>` : ''}
            ${fixList ? `<div style="margin-top:8px"><div style="font-size:.76rem;font-weight:700">Corrections</div><ul style="margin:4px 0 0 16px;padding:0;font-size:.75rem;line-height:1.45">${fixList}</ul>${moreFix}</div>` : ''}
            ${warnList ? `<div style="margin-top:8px"><div style="font-size:.76rem;font-weight:700">Avertissements</div><ul style="margin:4px 0 0 16px;padding:0;font-size:.75rem;line-height:1.45">${warnList}</ul></div>` : ''}`;
    };

    async function importFromText(text, options = null) {
        const report = makeReport();
        const pipelineSettings = getAIImportPipelineSettings(options?.pipelineSettings || null);
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
        pushPass(report, 'pass-1-plan', 'Analyse du JSON source et préparation du plan de normalisation.');
        const normalized = normalizePresentation(parsed, report);
        if (!normalized || report.errors.length) {
            const e = new Error(report.errors.map(x => x.message).join(' | ') || 'Import impossible');
            e.report = report;
            throw e;
        }
        await _confirmPipelineStep(report, pipelineSettings, 'Pass 1 — plan et normalisation', 'Le JSON a été analysé et normalisé.');
        const illustrationPlan = _applyIllustrationPlan(normalized, report, pipelineSettings);
        await _confirmPipelineStep(report, pipelineSettings, 'Pass 2 — illustrations', 'Le plan d’illustration a été calculé et injecté.');
        if (pipelineSettings.base64Mode !== 'none' || pipelineSettings.fetchRemoteImages) {
            await _materializeMediaAssets(normalized, report, pipelineSettings);
        } else {
            pushPass(report, 'pass-4-base64', 'Conversion base64 désactivée.');
        }
        await _confirmPipelineStep(report, pipelineSettings, 'Pass 4 — média/base64', 'La matérialisation des médias est terminée.');
        pushPass(report, 'pass-5-validation', `Validation finale: ${report.errors.length} erreur(s), ${report.warnings.length} avertissement(s), ${report.fixes.length} correction(s).`);
        await _confirmPipelineStep(report, pipelineSettings, 'Pass 5 — validation finale', 'Le document est prêt à être importé.');
        report.illustrationPlan = illustrationPlan;
        report.outputSummary = summarize(normalized);
        return { data: normalized, report, raw: parsed };
    }

    function normalizeData(value) {
        const report = makeReport();
        report.inputSummary = summarize(value);
        const normalized = normalizePresentation(value, report);
        if (!normalized || report.errors.length) {
            const e = new Error(report.errors.map(x => x.message).join(' | ') || 'Import impossible');
            e.report = report;
            throw e;
        }
        report.outputSummary = summarize(normalized);
        return { data: normalized, report, raw: value };
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

    const testUtils = Object.freeze({
        parseSchemaVersion,
        inferSchemaVersion,
        normalizeListItems,
        parseHtmlList,
        detectIllustrationToken: _detectIllustrationToken,
        parseAssetRef: _parseAssetRef,
        sanitizeAIImportPipelineSettings: _sanitizeAIImportPipelineSettings,
        parseJsonText,
        normalizeIllustrationPlan(rawPlan, data, settingsOverride = null) {
            const report = makeReport();
            const settings = getAIImportPipelineSettings(settingsOverride || null);
            const plan = _normalizeIllustrationPlan(rawPlan, data, report, settings);
            return { plan, report };
        },
    });

    global.OEIImportPipeline = Object.freeze({
        importFromText,
        normalizeData,
        confirmImport,
        summarize,
        buildHtmlSummary,
        CURRENT_SCHEMA_VERSION,
        getAIImportPipelineSettings,
        IMPORT_CANCELLED_CODE,
        testUtils,
    });
})(typeof window !== 'undefined' ? window : globalThis);
