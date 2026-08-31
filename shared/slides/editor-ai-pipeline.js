/**
 * @module slides/editor-ai-pipeline
 * @public
 * @internal Module Slides chargé côté navigateur — cœur partagé + orchestrateur du pipeline IA éditeur.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-ai-pipeline.js"></script>
 */
/* editor-ai-pipeline.js — cœur partagé + orchestrateur du pipeline IA de l'éditeur de slides.
   Expose window.OEIEditorAIPipeline (API publique) et window.OEIEditorAIPipelineShared
   (helpers partagés). Les modules chargés ensuite (dans cet ordre) complètent le pipeline :
   editor-ai-client.js, editor-ai-quiz.js, editor-ai-passes.js, editor-ai-review-ui.js. */
(function initEditorAIPipelineModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const _editorAiSettings = root.OEIEditorAISettings || null;
    if (!_editorAiSettings) {
        throw new Error('OEIEditorAISettings indisponible: impossible de démarrer le pipeline IA éditeur.');
    }

    const AI_IMAGE_GENERATION_ENABLED = _editorAiSettings.AI_IMAGE_GENERATION_ENABLED;
    const AI_PROMPT_DEFAULTS = _editorAiSettings.AI_PROMPT_DEFAULTS;
    const AI_IMPORT_PIPELINE_DEFAULTS = _editorAiSettings.AI_IMPORT_PIPELINE_DEFAULTS;
    const AI_GEMINI_MODELS = _editorAiSettings.AI_GEMINI_MODELS;
    const AI_GEMINI_IMAGE_MODELS = _editorAiSettings.AI_GEMINI_IMAGE_MODELS;
    const AI_GEMINI_DEFAULTS = _editorAiSettings.AI_GEMINI_DEFAULTS;
    const _sanitizeAIPromptTuningSettings = _editorAiSettings.sanitizeAIPromptTuningSettings;
    const _sanitizeAIImportPipelineSettings = _editorAiSettings.sanitizeAIImportPipelineSettings;
    const _sanitizeAIGeminiSettings = _editorAiSettings.sanitizeAIGeminiSettings;
    const getAIPromptTuningSettings = _editorAiSettings.getAIPromptTuningSettings;
    const setAIPromptTuningSettings = _editorAiSettings.setAIPromptTuningSettings;
    const getAIImportPipelineSettings = _editorAiSettings.getAIImportPipelineSettings;
    const setAIImportPipelineSettings = _editorAiSettings.setAIImportPipelineSettings;
    const getAIGeminiSettings = _editorAiSettings.getAIGeminiSettings;
    const setAIGeminiSettings = _editorAiSettings.setAIGeminiSettings;

    let _boundEditor = null;
    let _boundNotify = null;
    let _boundEsc = null;

    const _defaultEsc = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const _defaultNotify = (message, tone = 'info') => {
        const text = String(message || '');
        if (tone === 'error') console.error(text);
        else if (tone === 'warning' || tone === 'warn') console.warn(text);
        else console.log(text);
    };

    function _bindContext(options = {}) {
        if (options && typeof options === 'object') {
            if ('editor' in options) _boundEditor = options.editor || null;
            if ('notify' in options) _boundNotify = (typeof options.notify === 'function') ? options.notify : null;
            if ('esc' in options) _boundEsc = (typeof options.esc === 'function') ? options.esc : null;
        }
    }

    const _getEditor = () => _boundEditor || root.editor || null;
    const _getNotify = () => (typeof _boundNotify === 'function'
        ? _boundNotify
        : (typeof root.notify === 'function' ? root.notify : _defaultNotify));
    const _getEsc = () => (typeof _boundEsc === 'function'
        ? _boundEsc
        : (typeof root.esc === 'function' ? root.esc : _defaultEsc));

    const editor = new Proxy({}, {
        get(_target, prop) {
            const runtimeEditor = _getEditor();
            const value = runtimeEditor?.[prop];
            return typeof value === 'function' ? value.bind(runtimeEditor) : value;
        },
        set(_target, prop, value) {
            const runtimeEditor = _getEditor();
            if (!runtimeEditor) return false;
            runtimeEditor[prop] = value;
            return true;
        },
        has(_target, prop) {
            const runtimeEditor = _getEditor();
            return !!runtimeEditor && prop in runtimeEditor;
        },
    });

    function notify(message, tone) {
        return _getNotify()(message, tone);
    }

    function esc(value) {
        return _getEsc()(value);
    }

function _extractAIPromptTemplate(md) {
    const raw = String(md || '');
    const match = raw.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
    return (match ? match[1] : raw).trim();
}

function _buildAIPromptContext(tuning, pipeline) {
    const data = window.editor?.data;
    const lines = [];
    if (data && typeof data === 'object') {
        const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
        const slideCount = Array.isArray(data.slides) ? data.slides.length : 0;
        const level = String(meta.level || '').trim();
        const institution = String(meta.institution || '').trim();
        const title = String(meta.title || '').trim();
        const aspect = String(meta.aspect || '16:9').trim();
        const showSlideNumber = data.showSlideNumber === true ? 'true' : 'false';
        const autoNumberChapters = data.autoNumberChapters === true ? 'true' : 'false';
        const theme = typeof data.theme === 'string' ? data.theme : 'custom';
        lines.push(
            'CONTEXTE ACTUEL (éditeur)',
            `- Titre courant: ${title || 'non défini'}`,
            `- Niveau: ${level || 'non défini'}`,
            `- Institution: ${institution || 'non définie'}`,
            `- Slides existants: ${slideCount}`,
            `- Aspect: ${aspect}`,
            `- Theme: ${theme}`,
            `- showSlideNumber: ${showSlideNumber}`,
            `- autoNumberChapters: ${autoNumberChapters}`
        );
    }
    lines.push(
        'CIBLAGE PÉDAGOGIQUE',
        `- Public cible: ${tuning.audience}`,
        `- Type de séance: ${tuning.courseType}`,
        `- Profil étudiants: ${tuning.studentProfile || 'non spécifié'}`,
        `- Durée visée: ${tuning.durationMinutes} minutes`,
        `- Nombre de slides visé: ${tuning.targetSlides}`,
        `- Densité visuelle: ${tuning.visualDensity}`,
        `- Style d'illustration: ${tuning.imageStyle}`,
        `- Mode quiz interactifs: ${tuning.quizMode || 'auto-frequency'}`,
        `- Quiz toutes les X slides: ${Math.max(2, Math.min(20, Number(tuning.quizEverySlides) || 6))}`,
        `- Fréquence quiz: ${tuning.quizFrequency}`,
        `- Validation JSON stricte: ${tuning.strictJsonOnly ? 'oui' : 'non (JSON valide suffisant)'}`,
        `- Validation schéma stricte: ${tuning.strictSchema ? 'oui' : 'non'}`,
        `- Base64 local (pass 4): ${pipeline.base64Mode}`,
        `- Auto-injection illustrations: ${pipeline.autoInjectIllustrations ? 'oui' : 'non'}`,
        `- Fetch images distantes: ${pipeline.fetchRemoteImages ? 'oui' : 'non'}`,
        `- Génération image Gemini: ${AI_IMAGE_GENERATION_ENABLED ? 'active' : 'désactivée (mode placeholders)'}`,
        `- Forcer génération images pass3: ${AI_IMAGE_GENERATION_ENABLED && pipeline.forceImageGeneration ? 'oui' : 'non'}`,
        `- Timeout pipeline média: ${pipeline.timeoutMs} ms`,
        `- Max illustrations auto: ${pipeline.maxIllustrations}`,
        `- Validation locale par étape: ${pipeline.stepValidation ? 'oui' : 'non'}`
    );
    return lines.join('\n');
}

function _computeAIQuizTarget(tuning) {
    const targetSlides = Math.max(4, Math.min(120, Math.trunc(Number(tuning?.targetSlides) || AI_PROMPT_DEFAULTS.targetSlides)));
    const mode = String(tuning?.quizMode || 'auto-frequency').toLowerCase();
    const everyN = Math.max(2, Math.min(20, Math.trunc(Number(tuning?.quizEverySlides) || AI_PROMPT_DEFAULTS.quizEverySlides)));
    if (mode === 'none') return 0;
    if (mode === 'every-n') return Math.max(1, Math.floor((targetSlides - 1) / everyN));
    if (mode === 'section-end') return Math.max(1, Math.round(targetSlides / 8));
    if (mode === 'hybrid') {
        const bySection = Math.max(1, Math.round(targetSlides / 8));
        const byN = Math.max(1, Math.floor((targetSlides - 1) / everyN));
        return Math.max(bySection, byN);
    }
    const freq = String(tuning?.quizFrequency || '').toLowerCase();
    if (freq === 'none') return 0;
    if (freq === 'rare') return Math.max(1, Math.round(targetSlides / 14));
    if (freq === 'regular') return Math.max(2, Math.round(targetSlides / 5));
    return Math.max(1, Math.round(targetSlides / 8)); // section
}

function _buildAIAdaptiveBalanceRules(tuning) {
    const quizTarget = _computeAIQuizTarget(tuning);
    const courseType = String(tuning?.courseType || '').trim();
    const mode = String(tuning?.quizMode || 'auto-frequency').toLowerCase();
    const everyN = Math.max(2, Math.min(20, Math.trunc(Number(tuning?.quizEverySlides) || AI_PROMPT_DEFAULTS.quizEverySlides)));
    const lines = [
        '- Garder 1 idée pédagogique principale par slide (éviter les pavés).',
        '- Éviter plus de 2 slides consécutives avec le même pattern visuel.',
        '- Sur un slide canvas: viser 2 à 5 éléments utiles (hors cas exceptionnel).',
        '- Pour les listes: 3 à 6 puces max, formulations courtes et actionnables.',
        '- Alterner régulièrement: concept -> exemple -> application/synthèse.',
    ];
    if (mode === 'every-n') {
        lines.push(`- Insérer un quiz interactif toutes les ${everyN} slides (tolérance ±1 slide).`);
    } else if (mode === 'section-end') {
        lines.push('- Insérer un quiz interactif à la fin de chaque partie / bloc thématique.');
    } else if (mode === 'hybrid') {
        lines.push(`- Mode hybride: quiz à la fin de chaque partie ET toutes les ${everyN} slides.`);
    } else if (quizTarget > 0) {
        lines.push(`- Prévoir environ ${quizTarget} checkpoint(s) interactif(s) sur le deck (quiz/poll/mcq/exit-ticket).`);
    } else {
        lines.push('- Aucun checkpoint quiz obligatoire (fréquence quiz = none).');
    }
    if (courseType === 'CM') {
        lines.push('- En CM: insérer des checkpoints de compréhension à cadence régulière (fin de bloc).');
    } else if (courseType === 'TD' || courseType === 'TP') {
        lines.push('- En TD/TP: privilégier démonstration pas à pas, exercices courts et corrections guidées.');
    }
    lines.push('- Si le sujet est programmation/algorithmique: renforcer code-example + exercice/correction.');
    lines.push('- Si le format est échange/visio: privilégier interactions fréquentes et texte très synthétique.');
    return lines;
}

function _buildAISensitiveComponentRules() {
    return [
        '- `split`: `left`/`right` avec `type` ∈ {bullets, text, code} (champs à plat) OU un type riche {image, video, latex, mermaid, table, highlight, card, definition, callout-box, quote, smartart, timeline-vertical, swot-grid, qrcode} avec les données dans `data`.',
        '- `smartart`: utiliser `data.variant` + `data.items` (éviter `data.type`).',
        '- `algo-stepper`: `data.steps` doit être un tableau d’objets `{title, detail, code}` (>= 3 étapes).',
        '- `quiz-live`: `data.question`, `data.options` (2-5), `data.answer` (index), `data.duration` (secondes).',
        '- `mcq-single`: `data.question`, `data.options` (3-6), `data.answer` (index).',
        '- `mcq-multi`: `data.question`, `data.options` (3-6), `data.answers` (tableau d’index).',
        '- `poll-likert`: `data.prompt`. `exit-ticket`: `data.title` + `data.prompts`.',
    ];
}

function _buildAIPromptQualityGate(tuning, pipeline) {
    const schemaLine = tuning.strictSchema
        ? '- Le JSON final doit respecter strictement le schéma PresentaForge.'
        : '- Le JSON final doit être valide même en mode tolérant.';
    const jsonLine = tuning.strictJsonOnly
        ? '- Sortie finale: JSON pur uniquement, sans texte annexe.'
        : '- Sortie finale: JSON valide prioritaire, avec flexibilité sur la mise en forme.';
    const preferredComponents = 'smartart, diagramme, card, definition, code-example, highlight, table, list, mermaid, quiz-live, mcq-single, mcq-multi, poll-likert, exit-ticket, postit-wall, rank-order, flashcards-auto, algo-stepper, code-compare, quote, shape';
    const adaptiveRules = _buildAIAdaptiveBalanceRules(tuning);
    const sensitiveComponentRules = _buildAISensitiveComponentRules();
    return [
        'PIPELINE OBLIGATOIRE (5 PASSES, sortie finale uniquement):',
        'PASS 1 — PLAN PÉDAGOGIQUE:',
        '- Définir objectif principal, type de slide et message clé pour chaque slide.',
        '- Maintenir une progression claire et limiter le texte dense.',
        'RÈGLES D’ÉQUILIBRE (OBLIGATOIRES):',
        ...adaptiveRules,
        'PASS 2 — PLAN DE COMPOSANTS VISUELS + ILLUSTRATIONS:',
        '- Produire `componentPlan` (array) avec: slide, componentType, intent, placement, priority, payloadHint.',
        `- componentType doit privilégier: ${preferredComponents}.`,
        '- Produire `illustrations` (array) avec: slide, slideTitle, visualType, intent, placement, keywords, assetHint.',
        '- Chaque illustration doit être ciblée (utile pédagogiquement) et concise, pour servir de placeholder.',
        '- Préférer des intentions visuelles concrètes (photo/infographie/schéma/icône) plutôt que du texte brut.',
        'PASS 3 — GÉNÉRATION DU JSON PRESENTAFORGE:',
        '- Générer un JSON complet importable avec notes + niveaux.',
        `- Utiliser au maximum les composants natifs existants: ${preferredComponents}.`,
        '- N’utiliser jamais un composant canvas `columns` (remplacer par `table`, `list`, `card` ou `split`).',
        '- Insérer des placeholders visuels explicites (pas de génération image distante).',
        '- Éviter `[object Object]`, objets vides et structures contradictoires.',
        '- Respecter les formats sensibles (split/comparison/card/mcq/quiz/algo-stepper/smartart).',
        'FORMATS SENSIBLES DES COMPOSANTS:',
        ...sensitiveComponentRules,
        'PASS 4 — ENRICHISSEMENT COMPOSANTS:',
        '- Réduire le texte brut en faveur de composants adaptés.',
        '- Vérifier l’équilibre texte/composants/illustrations.',
        'PASS 5 — VALIDATION & AUTO-CORRECTION:',
        jsonLine,
        schemaLine,
        '- Vérifier IDs canvas, types supportés, échappement JSON, règles quiz.',
    ].join('\n');
}

function _buildPromptForClipboard(template) {
    const tuning = getAIPromptTuningSettings();
    const pipeline = getAIImportPipelineSettings();
    const ctx = _buildAIPromptContext(tuning, pipeline);
    const gate = _buildAIPromptQualityGate(tuning, pipeline);
    return `${template}\n\n${ctx}\n\n${gate}`.trim();
}

let _aiPromptTemplateCache = '';

const _escapeHtmlAi = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function _stripCodeFences(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    const fenceMatch = text.match(/^```(?:json|markdown|md|txt)?\s*([\s\S]*?)\s*```$/i);
    return (fenceMatch ? fenceMatch[1] : text).trim();
}

function _formatPassPreview(text, maxLen = 180) {
    const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
    if (!oneLine) return 'Vide';
    return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen - 1)}…` : oneLine;
}

async function _fetchAIPromptTemplate() {
    if (_aiPromptTemplateCache) return _aiPromptTemplateCache;
    const res = await fetch('../slides/PROMPT_GENERATION_SLIDES.md');
    if (!res.ok) throw new Error(`Impossible de charger PROMPT_GENERATION_SLIDES.md (${res.status})`);
    const md = await res.text();
    _aiPromptTemplateCache = _extractAIPromptTemplate(md);
    return _aiPromptTemplateCache;
}

function _tryParseJsonLoose(raw) {
    const text = _stripCodeFences(raw);
    const attempt = (value) => {
        try {
            return { ok: true, value: JSON.parse(value), error: '' };
        } catch (err) {
            return { ok: false, value: null, error: String(err?.message || 'JSON invalide') };
        }
    };
    if (!text) return { ok: false, value: null, error: 'Réponse vide' };
    let parsed = attempt(text);
    if (parsed.ok) return parsed;
    if (typeof window._repairJsonText === 'function') {
        parsed = attempt(window._repairJsonText(text));
        if (parsed.ok) return parsed;
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
        parsed = attempt(text.slice(start, end + 1));
        if (parsed.ok) return parsed;
    }
    return parsed;
}

function _stringifyPrettyJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (_) {
        return '';
    }
}

function _sanitizePreviewImageSrc(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^data:image\//i.test(value)) return value;
    return '';
}

function _extractPresentationFromPass(pass, text, parsedPayload = null) {
    const parsed = parsedPayload?.ok ? parsedPayload : _tryParseJsonLoose(text);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return '';
    const payload = parsed.value;
    if (payload?.presentation && typeof payload.presentation === 'object') {
        return _stringifyPrettyJson(payload.presentation);
    }
    if (payload?.metadata && Array.isArray(payload?.slides)) {
        return _stringifyPrettyJson(payload);
    }
    if (pass >= 3) {
        return _stringifyPrettyJson(payload);
    }
    return '';
}

function _formatRunnerPreview(pass, text) {
    const parsed = _tryParseJsonLoose(text);
    if (!parsed.ok) return _formatPassPreview(text, 180);
    const payload = parsed.value || {};
    if (pass === 1) {
        const plan = Array.isArray(payload?.plan) ? payload.plan : (Array.isArray(payload?.slidePlan) ? payload.slidePlan : []);
        return `Plan: ${plan.length} slide(s)`;
    }
    if (pass === 2) {
        const illustrations = Array.isArray(payload?.illustrations)
            ? payload.illustrations
            : (Array.isArray(payload?.illustrationPlan) ? payload.illustrationPlan : []);
        const componentPlan = Array.isArray(payload?.componentPlan) ? payload.componentPlan : [];
        if (illustrations.length) return `Illustrations planifiées: ${illustrations.length}`;
        return `Composants visuels planifiés: ${componentPlan.length}`;
    }
    const presentation = (payload?.presentation && typeof payload.presentation === 'object')
        ? payload.presentation
        : ((payload?.metadata && Array.isArray(payload?.slides)) ? payload : null);
    const slides = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    if (pass === 3 && payload?.mediaReport) {
        const kept = Number(payload.mediaReport.kept || 0);
        if (payload.mediaReport.mode === 'placeholder-only') {
            return `Slides: ${slides} • placeholders: ${Number(payload.mediaReport.placeholderCount || 0)}${kept ? ` • gardés: ${kept}` : ''}`;
        }
        return `Slides: ${slides} • images: ${Number(payload.mediaReport.generated || 0)}/${Number(payload.mediaReport.planned || 0)}${kept ? ` • gardées: ${kept}` : ''}`;
    }
    if (pass === 4 && payload?.mediaReport) {
        return `Slides: ${slides} • base64: ${Number(payload.mediaReport.base64Count || 0)}`;
    }
    if (pass === 5 && payload?.validation) {
        return `Slides: ${slides} • validation: ${payload.validation.isValid === true ? 'OK' : 'à corriger'}`;
    }
    return `Slides: ${slides}`;
}

    async function copyAIPromptToClipboard(options = {}) {
        _bindContext(options);
        try {
            const template = await _fetchAIPromptTemplate();
            const prompt = _buildPromptForClipboard(template);
            await navigator.clipboard.writeText(prompt);
            notify('Prompt IA (5 passes) copié dans le presse-papier', 'success');
            return true;
        } catch (_) {
            notify('Erreur lors de la copie du prompt', 'error');
            return false;
        }
    }

    function openAIPromptTuningModal(options = {}) {
        _bindContext(options);
        const reviewUi = root.OEIEditorAIReviewUI;
        if (!reviewUi || typeof reviewUi.openAIPromptTuningModal !== 'function') {
            throw new Error('OEIEditorAIReviewUI indisponible: impossible d’ouvrir les réglages IA éditeur.');
        }
        return reviewUi.openAIPromptTuningModal();
    }

    function bindToolbarAIButtons(options = {}) {
        _bindContext(options);

        const promptBtn = document.getElementById('btn-ai-prompt');
        if (promptBtn && promptBtn.dataset.oeiAiBound !== '1') {
            promptBtn.dataset.oeiAiBound = '1';
            promptBtn.addEventListener('click', async () => {
                await copyAIPromptToClipboard();
            });
        }

        const tuningBtn = document.getElementById('btn-ai-tuning');
        if (tuningBtn && tuningBtn.dataset.oeiAiBound !== '1') {
            tuningBtn.dataset.oeiAiBound = '1';
            tuningBtn.addEventListener('click', () => {
                openAIPromptTuningModal();
            });
        }
    }

    const testUtils = Object.freeze({
        computeAIQuizTarget: _computeAIQuizTarget,
        sanitizePreviewImageSrc: _sanitizePreviewImageSrc,
        extractPresentationFromPass: _extractPresentationFromPass,
        formatRunnerPreview: _formatRunnerPreview,
        get normalizeQuizAugmentPlan() {
            const ns = root.OEIEditorAIQuiz;
            return ns && ns.testUtils ? ns.testUtils.normalizeQuizAugmentPlan : undefined;
        },
    });

    root.OEIEditorAIPipelineShared = Object.freeze({
        editor,
        notify,
        esc,
        escapeHtmlAi: _escapeHtmlAi,
        stripCodeFences: _stripCodeFences,
        tryParseJsonLoose: _tryParseJsonLoose,
        stringifyPrettyJson: _stringifyPrettyJson,
        sanitizePreviewImageSrc: _sanitizePreviewImageSrc,
        formatPassPreview: _formatPassPreview,
        formatRunnerPreview: _formatRunnerPreview,
        extractPresentationFromPass: _extractPresentationFromPass,
        fetchAIPromptTemplate: _fetchAIPromptTemplate,
        buildAIPromptContext: _buildAIPromptContext,
        computeAIQuizTarget: _computeAIQuizTarget,
        buildAIAdaptiveBalanceRules: _buildAIAdaptiveBalanceRules,
        buildAISensitiveComponentRules: _buildAISensitiveComponentRules,
        buildAIPromptQualityGate: _buildAIPromptQualityGate,
    });

    root.OEIEditorAIPipeline = Object.freeze({
        openAIPromptTuningModal,
        copyPromptToClipboard: copyAIPromptToClipboard,
        bindToolbarAIButtons,
        testUtils,
    });
})(window);
