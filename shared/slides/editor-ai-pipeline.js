/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-ai-pipeline
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-ai-pipeline.js"></script>
 */
/* editor-ai-pipeline.js — AI import/pipeline orchestration for slide editor */
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

const _AI_PASS_CANCELLED_CODE = 'OEI_AI_PASS_CANCELLED';
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

function _extractGeminiText(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const parts = [];
    candidates.forEach((candidate) => {
        const cParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        cParts.forEach((part) => {
            if (typeof part?.text === 'string') parts.push(part.text);
        });
    });
    return parts.join('\n').trim();
}

function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Lecture blob image impossible'));
            reader.readAsDataURL(blob);
        } catch (err) {
            reject(err);
        }
    });
}

function _extractGeminiPartImageData(part) {
    if (!part || typeof part !== 'object') return null;
    const inline = part.inlineData || part.inline_data || null;
    if (inline && typeof inline === 'object') {
        const mimeType = String(inline.mimeType || inline.mime_type || '').trim().toLowerCase();
        const data = String(inline.data || '').trim();
        if (data) {
            const mime = mimeType.startsWith('image/') ? mimeType : 'image/png';
            return { kind: 'inline', dataUrl: `data:${mime};base64,${data}` };
        }
    }
    const fileData = part.fileData || part.file_data || null;
    if (fileData && typeof fileData === 'object') {
        const fileUri = String(fileData.fileUri || fileData.file_uri || '').trim();
        const mimeType = String(fileData.mimeType || fileData.mime_type || '').trim().toLowerCase();
        if (fileUri) return { kind: 'file', fileUri, mimeType };
    }
    return null;
}

async function _extractGeminiInlineImage(payload, timeoutMs = 20000) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Math.max(2000, Math.min(90000, Number(timeoutMs) || 20000))) : null;
    for (let ci = 0; ci < candidates.length; ci++) {
        const parts = Array.isArray(candidates[ci]?.content?.parts) ? candidates[ci].content.parts : [];
        for (let pi = 0; pi < parts.length; pi++) {
            const info = _extractGeminiPartImageData(parts[pi]);
            if (!info) continue;
            if (info.kind === 'inline' && info.dataUrl) {
                if (timer) clearTimeout(timer);
                return info.dataUrl;
            }
            if (info.kind === 'file') {
                const uri = String(info.fileUri || '').trim();
                if (!uri) continue;
                if (/^data:image\//i.test(uri)) {
                    if (timer) clearTimeout(timer);
                    return uri;
                }
                if (/^https?:\/\//i.test(uri)) {
                    try {
                        const res = await fetch(uri, { signal: controller?.signal });
                        if (!res.ok) continue;
                        const blob = await res.blob();
                        const blobType = String(blob?.type || info.mimeType || '').toLowerCase();
                        if (!blobType.startsWith('image/')) continue;
                        const dataUrl = await _blobToDataUrl(blob);
                        if (dataUrl) {
                            if (timer) clearTimeout(timer);
                            return dataUrl;
                        }
                    } catch (_) {
                        continue;
                    }
                }
            }
        }
    }
    if (timer) clearTimeout(timer);
    return '';
}

function _summarizeGeminiCandidateParts(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const kinds = [];
    candidates.forEach((candidate) => {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        parts.forEach((part) => {
            if (part?.text) kinds.push('text');
            if (part?.inlineData || part?.inline_data) kinds.push('inlineData');
            if (part?.fileData || part?.file_data) kinds.push('fileData');
        });
    });
    return [...new Set(kinds)].join(', ') || 'none';
}

function _makeAIPassCancelledError(step = '') {
    const err = new Error(step ? `Pipeline IA annulé (${step}).` : 'Pipeline IA annulé.');
    err.code = _AI_PASS_CANCELLED_CODE;
    err.step = step;
    return err;
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

async function _callGeminiGenerate({ apiKey, model, prompt, temperature, timeoutMs }) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller?.signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
                generationConfig: {
                    temperature,
                },
            }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = String(payload?.error?.message || `HTTP ${res.status}`).trim();
            throw new Error(msg || 'Erreur Gemini');
        }
        const text = _extractGeminiText(payload);
        if (!text) {
            const blockReason = String(payload?.promptFeedback?.blockReason || '').trim();
            throw new Error(blockReason ? `Réponse vide (blocage: ${blockReason})` : 'Réponse Gemini vide');
        }
        return _stripCodeFences(text);
    } catch (err) {
        if (err?.name === 'AbortError') {
            const timeoutLabel = Number.isFinite(Number(timeoutMs)) ? `${Math.trunc(Number(timeoutMs))} ms` : 'délai imparti';
            throw new Error(`Timeout Gemini (${timeoutLabel})`);
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function _callGeminiGenerateImage({ apiKey, model, prompt, temperature, timeoutMs }) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const normalizedModel = String(model || '').trim().toLowerCase();
        const isFlashImageModel = normalizedModel.includes('flash-image');
        const generationConfig = {
            temperature,
        };
        if (!isFlashImageModel) {
            generationConfig.responseModalities = ['IMAGE', 'TEXT'];
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller?.signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
                generationConfig,
            }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = String(payload?.error?.message || `HTTP ${res.status}`).trim();
            throw new Error(msg || 'Erreur Gemini image');
        }
        const dataUrl = await _extractGeminiInlineImage(payload, Math.max(8000, Math.min(60000, Number(timeoutMs) || 20000)));
        if (!dataUrl) {
            const textHint = _extractGeminiText(payload);
            const blockReason = String(payload?.promptFeedback?.blockReason || '').trim();
            const partsInfo = _summarizeGeminiCandidateParts(payload);
            throw new Error(blockReason
                ? `Image bloquée (${blockReason})`
                : (textHint
                    ? `Aucune image retournée (parts: ${partsInfo}) (${textHint.slice(0, 120)})`
                    : `Aucune image retournée (parts: ${partsInfo})`));
        }
        return {
            dataUrl,
            textHint: _extractGeminiText(payload),
        };
    } catch (err) {
        if (err?.name === 'AbortError') {
            const timeoutLabel = Number.isFinite(Number(timeoutMs)) ? `${Math.trunc(Number(timeoutMs))} ms` : 'délai imparti';
            throw new Error(`Timeout Gemini image (${timeoutLabel})`);
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function _supportsNativeGeminiImageModel(model) {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('flash-image')
        || normalized.includes('image-generation')
        || normalized.includes('image-preview')
    );
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

function _collectImageCandidatesFromPresentation(presentation, max = 8) {
    const out = [];
    const push = (src, label = '') => {
        const safeSrc = _sanitizePreviewImageSrc(src);
        if (!safeSrc) return;
        if (out.some((item) => item.src === safeSrc)) return;
        out.push({ src: safeSrc, label: String(label || '').slice(0, 80) });
    };
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    slides.forEach((slide, slideIdx) => {
        if (!slide || typeof slide !== 'object') return;
        if (typeof slide.src === 'string') push(slide.src, `Slide ${slideIdx + 1}`);
        if (slide?.data?.media?.type === 'image' && typeof slide?.data?.media?.src === 'string') {
            push(slide.data.media.src, `Slide ${slideIdx + 1}`);
        }
        if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
            slide.elements.forEach((el) => {
                if (!el || typeof el !== 'object') return;
                if (el.type === 'image' && typeof el?.data?.src === 'string') {
                    push(el.data.src, `Slide ${slideIdx + 1}`);
                }
            });
        }
    });
    return out.slice(0, Math.max(0, max | 0));
}

function _countSlideTypes(presentation) {
    const counts = {};
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    slides.forEach((slide) => {
        const type = String(slide?.type || 'unknown');
        counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
}

function _renderPassSummaryHtml(pass, parsed, rawText) {
    if (!parsed?.ok) {
        return `
            <div class="ai-pass-review-parse-warning">
                JSON non parseable pour cette passe. Corrige le JSON ci-dessous ou relance avec une consigne.
            </div>
        `;
    }
    const payload = parsed.value;
    if (!payload || typeof payload !== 'object') {
        return `<div class="ai-pass-review-parse-warning">Le contenu n'est pas un objet JSON exploitable.</div>`;
    }

    if (pass === 1) {
        const title = String(payload?.title || payload?.course?.title || '').trim();
        const objectives = Array.isArray(payload?.learningObjectives) ? payload.learningObjectives : [];
        const plan = Array.isArray(payload?.plan) ? payload.plan : (Array.isArray(payload?.slidePlan) ? payload.slidePlan : []);
        const rows = plan.slice(0, 20).map((item, idx) => {
            const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : (idx + 1);
            const type = String(item?.type || '').trim();
            const label = String(item?.title || item?.goal || '').trim();
            const level = Number.isFinite(Number(item?.level)) ? Number(item.level) : '';
            return `<tr><td>${order}</td><td>${_escapeHtmlAi(type || '—')}</td><td>${_escapeHtmlAi(label || '—')}</td><td>${level || '—'}</td></tr>`;
        }).join('');
        return `
            <div class="ai-pass-review-grid">
                <div class="ai-pass-review-card"><strong>Titre</strong><div>${_escapeHtmlAi(title || 'Non défini')}</div></div>
                <div class="ai-pass-review-card"><strong>Slides planifiées</strong><div>${plan.length}</div></div>
                <div class="ai-pass-review-card"><strong>Objectifs</strong><div>${objectives.length}</div></div>
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Plan des slides</div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>#</th><th>Type</th><th>Titre / objectif</th><th>Niveau</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="4">Aucun item de plan</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (pass === 2) {
        const illustrations = Array.isArray(payload?.illustrations)
            ? payload.illustrations
            : (Array.isArray(payload?.illustrationPlan) ? payload.illustrationPlan : []);
        const componentPlan = Array.isArray(payload?.componentPlan) ? payload.componentPlan : [];
        const rows = illustrations.length
            ? illustrations.slice(0, 25).map((item, idx) => {
                const slide = Number.isFinite(Number(item?.slide)) ? Number(item.slide) : (Number.isFinite(Number(item?.slideIndex)) ? Number(item.slideIndex) + 1 : (idx + 1));
                const visualType = String(item?.visualType || '').trim();
                const intent = String(item?.intent || '').trim();
                const placement = String(item?.placement || '').trim();
                const assetHint = String(item?.assetHint || item?.src || '').trim();
                const safeSrc = _sanitizePreviewImageSrc(assetHint);
                const preview = safeSrc
                    ? `<img src="${_escapeHtmlAi(safeSrc)}" alt="Illustration ${slide}" loading="lazy">`
                    : `<span class="ai-pass-asset-hint">${_escapeHtmlAi(assetHint || 'asset://...')}</span>`;
                return `
                    <tr>
                        <td>${slide}</td>
                        <td>${_escapeHtmlAi(visualType || '—')}</td>
                        <td>${_escapeHtmlAi(intent || '—')}</td>
                        <td>${_escapeHtmlAi(placement || '—')}</td>
                        <td>${preview}</td>
                    </tr>
                `;
            }).join('')
            : componentPlan.slice(0, 25).map((item, idx) => {
                const slide = Number.isFinite(Number(item?.slide)) ? Number(item.slide) : (idx + 1);
                const componentType = String(item?.componentType || '').trim();
                const intent = String(item?.intent || '').trim();
                const placement = String(item?.placement || '').trim();
                const hint = String(item?.payloadHint || '').trim();
                return `
                    <tr>
                        <td>${slide}</td>
                        <td>${_escapeHtmlAi(componentType || '—')}</td>
                        <td>${_escapeHtmlAi(intent || '—')}</td>
                        <td>${_escapeHtmlAi(placement || '—')}</td>
                        <td><span class="ai-pass-asset-hint">${_escapeHtmlAi(hint || '—')}</span></td>
                    </tr>
                `;
            }).join('');
        return `
            <div class="ai-pass-review-grid">
                <div class="ai-pass-review-card"><strong>Illustrations prévues</strong><div>${illustrations.length}</div></div>
                <div class="ai-pass-review-card"><strong>Composants visuels</strong><div>${componentPlan.length}</div></div>
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">${illustrations.length ? 'Plan d’illustrations' : 'Plan de composants visuels'}</div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>Slide</th><th>Type</th><th>Intent</th><th>Placement</th><th>${illustrations.length ? 'Aperçu' : 'Payload hint'}</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="5">Aucun plan visuel</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const presentation = (payload?.presentation && typeof payload.presentation === 'object')
        ? payload.presentation
        : ((payload?.metadata && Array.isArray(payload?.slides)) ? payload : null);
    const slidesCount = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    const types = _countSlideTypes(presentation);
    const typeEntries = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const mediaReport = (payload?.mediaReport && typeof payload.mediaReport === 'object') ? payload.mediaReport : null;
    const validation = (payload?.validation && typeof payload.validation === 'object') ? payload.validation : null;
    const images = _collectImageCandidatesFromPresentation(presentation, 8);
    const typesHtml = typeEntries.map(([type, count]) => `<li><span>${_escapeHtmlAi(type)}</span><strong>${count}</strong></li>`).join('');
    const imagesHtml = images.map((item) => `<figure><img src="${_escapeHtmlAi(item.src)}" alt="${_escapeHtmlAi(item.label || 'Visuel')}"><figcaption>${_escapeHtmlAi(item.label || '')}</figcaption></figure>`).join('');
    const issues = Array.isArray(validation?.issues) ? validation.issues : [];
    const isValid = validation?.isValid === true;
    return `
        <div class="ai-pass-review-grid">
            <div class="ai-pass-review-card"><strong>Slides</strong><div>${slidesCount}</div></div>
            <div class="ai-pass-review-card"><strong>Types détectés</strong><div>${typeEntries.length}</div></div>
            ${mediaReport ? `<div class="ai-pass-review-card"><strong>Médias</strong><div>${pass === 3 ? (mediaReport.mode === 'placeholder-only' ? `placeholders: ${Number(mediaReport.placeholderCount || 0)}${Number(mediaReport.kept || 0) ? ` • gardés: ${Number(mediaReport.kept || 0)}` : ''}` : `prévues: ${Number(mediaReport.planned || 0)} • générées: ${Number(mediaReport.generated || 0)} • échecs: ${Number(mediaReport.failed || 0)}${Number(mediaReport.kept || 0) ? ` • gardées: ${Number(mediaReport.kept || 0)}` : ''}`) : `base64: ${Number(mediaReport.base64Count || 0)} • externes: ${Number(mediaReport.remoteUrlCount || 0)}`}</div></div>` : ''}
            ${validation ? `<div class="ai-pass-review-card"><strong>Validation</strong><div>${isValid ? 'OK' : 'À corriger'}${issues.length ? ` • ${issues.length} issue(s)` : ''}</div></div>` : ''}
        </div>
        <div class="ai-pass-review-columns">
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Répartition des types</div>
                <ul class="ai-pass-review-kv">${typesHtml || '<li><span>Aucune donnée</span><strong>0</strong></li>'}</ul>
                ${issues.length ? `<div class="ai-pass-review-issues"><strong>Issues:</strong><ul>${issues.map((it) => `<li>${_escapeHtmlAi(String(it || ''))}</li>`).join('')}</ul></div>` : ''}
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Aperçu visuels</div>
                <div class="ai-pass-review-images">${imagesHtml || '<div class="ai-pass-review-empty">Aucun visuel détecté.</div>'}</div>
            </div>
        </div>
    `;
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

const _AI_QUIZ_COMPONENT_TYPES = new Set([
    'mcq-single',
    'mcq-multi',
    'quiz-live',
    'poll-likert',
    'exit-ticket',
    'cloze',
]);

function _makeCanvasElementId() {
    return 'el_' + Math.random().toString(36).slice(2, 9);
}

function _extractCanvasHeadingText(slide) {
    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    const heading = elements
        .filter(el => String(el?.type || '').toLowerCase() === 'heading')
        .sort((a, b) => Number(a?.y || 0) - Number(b?.y || 0))[0];
    const text = String(heading?.data?.text || '').trim();
    return text;
}

function _extractSlideTitleForQuiz(slide, index) {
    const explicit = String(slide?.title || '').trim();
    if (explicit) return explicit;
    const fromCanvas = _extractCanvasHeadingText(slide);
    if (fromCanvas) return fromCanvas;
    return `Slide ${index + 1}`;
}

function _extractSlideTextForQuiz(slide) {
    const chunks = [];
    const push = (value) => {
        const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        if (text) chunks.push(text);
    };
    if (!slide || typeof slide !== 'object') return '';
    ['title', 'subtitle', 'text', 'term', 'definition', 'quote', 'caption', 'notes'].forEach(k => push(slide[k]));
    if (Array.isArray(slide.items)) slide.items.forEach(item => push(item));
    if (slide.type === 'quiz' && Array.isArray(slide.questions)) {
        slide.questions.forEach(q => {
            push(q?.question);
            if (Array.isArray(q?.options)) q.options.forEach(opt => push(opt));
        });
    }
    if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
        slide.elements.forEach((el) => {
            if (!el || typeof el !== 'object') return;
            const data = (el.data && typeof el.data === 'object') ? el.data : {};
            ['text', 'title', 'question', 'prompt', 'term', 'definition', 'example', 'label', 'sentence'].forEach(k => push(data[k]));
            if (Array.isArray(data.items)) data.items.forEach(item => push(item));
            if (Array.isArray(data.options)) data.options.forEach(opt => push(opt));
            if (Array.isArray(data.prompts)) data.prompts.forEach(item => push(item));
            if (Array.isArray(data.rows)) {
                data.rows.forEach((row) => {
                    if (Array.isArray(row)) row.forEach(cell => push(cell));
                });
            }
        });
    }
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function _buildSlidesOutlineForQuizPrompt(data, maxSlides = 90) {
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    return slides.slice(0, Math.max(1, maxSlides)).map((slide, idx) => {
        const title = _extractSlideTitleForQuiz(slide, idx);
        const type = String(slide?.type || 'unknown');
        const text = _extractSlideTextForQuiz(slide).slice(0, 320);
        return `S${idx + 1} | type=${type} | titre=${title} | contenu=${text || '—'}`;
    }).join('\n');
}

function _describeQuizInsertionStrategy(tuning, slideCount) {
    const mode = String(tuning?.quizMode || 'auto-frequency').toLowerCase();
    const everyN = Math.max(2, Math.min(20, Math.trunc(Number(tuning?.quizEverySlides) || AI_PROMPT_DEFAULTS.quizEverySlides)));
    const target = Math.max(1, _computeAIQuizTarget(tuning));
    if (mode === 'every-n') return `Insérer un quiz toutes les ${everyN} slides de contenu.`;
    if (mode === 'section-end') return 'Insérer un quiz à la fin de chaque grande partie.';
    if (mode === 'hybrid') return `Mode hybride: fin de partie + toutes les ${everyN} slides.`;
    if (mode === 'none') return 'L’utilisateur demande explicitement d’ajouter des quiz: insérer 2 à 4 quiz pertinents.';
    const clamped = Math.max(1, Math.min(slideCount, target));
    return `Mode auto: proposer environ ${clamped} quiz répartis régulièrement.`;
}

function _buildGeminiQuizAugmentPrompt({ tuning, presentation }) {
    const slideCount = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    const target = Math.max(1, Math.min(slideCount || 1, _computeAIQuizTarget(tuning)));
    const strategy = _describeQuizInsertionStrategy(tuning, slideCount);
    const outline = _buildSlidesOutlineForQuizPrompt(presentation, 100);
    return [
        'Tu dois UNIQUEMENT proposer des quiz à AJOUTER dans une présentation existante.',
        'Tu ne réécris pas toute la présentation.',
        'Réponds uniquement en JSON valide (sans markdown).',
        'Schéma JSON strict de sortie:',
        '{"quizzes":[{"afterSlide":1,"quizType":"mcq-single|mcq-multi|quiz-live|poll-likert|exit-ticket|cloze","title":"...","question":"...","options":["..."],"answer":0,"answers":[0,2],"duration":30,"prompt":"...","prompts":["..."],"sentence":"...","blanks":["..."]}]}',
        'Règles:',
        `- Nombre de quiz attendu: environ ${target}.`,
        `- Stratégie de placement: ${strategy}`,
        '- `afterSlide` est 1-based et doit être entre 1 et le nombre de slides existantes.',
        '- `quizType` doit être l’un des types autorisés du schéma.',
        '- Questions courtes, actionnables, liées au contenu de la slide précédente.',
        '- Pour mcq-single/quiz-live: options (3-5), answer = index valide.',
        '- Pour mcq-multi: options (4-6), answers = tableau d’index (>=2).',
        '- Pour exit-ticket: utiliser prompts (2-4) plutôt que options.',
        '- Pour cloze: fournir sentence + blanks.',
        `Contexte de la présentation (${slideCount} slides):`,
        outline,
    ].join('\n\n');
}

function _normalizeQuizChoiceItems(rawOptions, fallback = []) {
    const out = Array.isArray(rawOptions)
        ? rawOptions.map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim()).filter(Boolean)
        : [];
    return out.length ? out : fallback;
}

function _normalizeQuizAugmentPlan(payload, totalSlides, tuning) {
    const src = Array.isArray(payload?.quizzes) ? payload.quizzes : [];
    const maxCount = Math.max(1, Math.min(totalSlides || 1, Math.max(1, _computeAIQuizTarget(tuning))));
    const normalized = src.map((entry, idx) => {
        const rawType = String(entry?.quizType || entry?.type || '').trim().toLowerCase();
        const quizType = _AI_QUIZ_COMPONENT_TYPES.has(rawType) ? rawType : 'mcq-single';
        const afterSlideRaw = Number(entry?.afterSlide ?? entry?.slide ?? entry?.after ?? (idx + 1));
        const afterSlide = Number.isFinite(afterSlideRaw)
            ? Math.max(1, Math.min(Math.max(1, totalSlides), Math.trunc(afterSlideRaw)))
            : Math.max(1, Math.min(Math.max(1, totalSlides), idx + 1));
        const title = String(entry?.title || entry?.label || `Quiz ${idx + 1}`).trim() || `Quiz ${idx + 1}`;
        const question = String(entry?.question || entry?.prompt || '').replace(/\s+/g, ' ').trim();
        const options = _normalizeQuizChoiceItems(entry?.options, [
            'Réponse A',
            'Réponse B',
            'Réponse C',
        ]);
        const answers = Array.isArray(entry?.answers)
            ? [...new Set(entry.answers.map(v => Math.trunc(Number(v))).filter(v => Number.isFinite(v) && v >= 0 && v < options.length))]
            : [];
        let answer = Math.trunc(Number(entry?.answer));
        if (!Number.isFinite(answer) || answer < 0 || answer >= options.length) answer = 0;
        const duration = Math.max(10, Math.min(180, Math.trunc(Number(entry?.duration) || 30)));
        const prompts = _normalizeQuizChoiceItems(entry?.prompts, [question || 'Qu’avez-vous retenu ?', 'Quelle notion reste floue ?']);
        const sentence = String(entry?.sentence || question || '').trim();
        const blanks = _normalizeQuizChoiceItems(entry?.blanks, []);
        return {
            afterSlide,
            quizType,
            title,
            question,
            options,
            answer,
            answers,
            duration,
            prompt: String(entry?.prompt || question || '').trim(),
            prompts,
            sentence,
            blanks,
        };
    }).filter(Boolean);

    if (!normalized.length) return [];
    normalized.sort((a, b) => a.afterSlide - b.afterSlide);
    return normalized.slice(0, Math.max(1, maxCount * 2));
}

function _buildQuizCanvasElementData(spec) {
    const type = spec.quizType;
    if (type === 'mcq-multi') {
        const answers = spec.answers.length ? spec.answers : [0, 1].filter(i => i < spec.options.length);
        return {
            label: spec.title || 'QCM multi',
            question: spec.question || 'Sélectionnez les réponses correctes.',
            options: spec.options.slice(0, 6),
            answers,
        };
    }
    if (type === 'quiz-live') {
        return {
            label: spec.title || 'Quiz',
            question: spec.question || 'Choisissez la bonne réponse.',
            options: spec.options.slice(0, 5),
            answer: spec.answer,
            duration: spec.duration,
        };
    }
    if (type === 'poll-likert') {
        return {
            prompt: spec.prompt || spec.question || 'Votre niveau de confiance (1 à 5) ?',
        };
    }
    if (type === 'exit-ticket') {
        return {
            title: spec.title || 'Exit ticket',
            prompts: spec.prompts.slice(0, 4),
        };
    }
    if (type === 'cloze') {
        const sentence = spec.sentence || spec.question || 'Complétez: ____';
        const safeSentence = sentence.includes('____') ? sentence : `${sentence} ____`;
        return {
            sentence: safeSentence,
            blanks: spec.blanks.length ? spec.blanks : ['réponse'],
        };
    }
    return {
        label: spec.title || 'QCM simple',
        question: spec.question || 'Choisissez la meilleure réponse.',
        options: spec.options.slice(0, 6),
        answer: spec.answer,
    };
}

function _buildQuizCanvasSlide(spec, idx, sourceTitle = '') {
    const slideTitle = spec.title || `Quiz ${idx + 1}`;
    return {
        type: 'canvas',
        title: slideTitle,
        notes: sourceTitle ? `Quiz ajouté après: ${sourceTitle}` : 'Quiz ajouté par IA',
        levels: [],
        elements: [
            {
                id: _makeCanvasElementId(),
                type: 'heading',
                x: 80,
                y: 40,
                w: 1120,
                h: 104,
                z: 1,
                data: { text: slideTitle },
                style: {
                    fontWeight: 800,
                    color: 'var(--sl-heading)',
                    textAlign: 'left',
                    fontFamily: 'var(--sl-font-heading)',
                },
            },
            {
                id: _makeCanvasElementId(),
                type: spec.quizType,
                x: 120,
                y: 170,
                w: 1040,
                h: 470,
                z: 2,
                data: _buildQuizCanvasElementData(spec),
                style: {},
            },
        ],
        connectors: [],
    };
}

function _insertQuizSlidesIntoPresentation(presentation, plan) {
    const source = (presentation && typeof presentation === 'object') ? presentation : {};
    const next = JSON.parse(JSON.stringify(source));
    const slides = Array.isArray(next.slides) ? next.slides : [];
    const originalSlides = slides.slice();
    const sorted = (Array.isArray(plan) ? plan : []).slice().sort((a, b) => a.afterSlide - b.afterSlide);
    let inserted = 0;
    sorted.forEach((spec, idx) => {
        const baseAfter = Math.max(1, Math.min(originalSlides.length || 1, Number(spec.afterSlide) || 1));
        const insertAt = Math.max(0, Math.min(slides.length, baseAfter + inserted));
        const srcTitle = _extractSlideTitleForQuiz(originalSlides[baseAfter - 1], baseAfter - 1);
        slides.splice(insertAt, 0, _buildQuizCanvasSlide(spec, idx, srcTitle));
        inserted += 1;
    });
    next.slides = slides;
    next.metadata = (next.metadata && typeof next.metadata === 'object') ? next.metadata : {};
    next.metadata.modified = new Date().toISOString().slice(0, 10);
    return { data: next, inserted };
}

async function _runGeminiQuizAugmentFlow({ tuning, gemini }) {
    if (!gemini?.apiKey) {
        notify('Ajoute d’abord la clé API Gemini', 'warning');
        return;
    }
    const current = window.editor?.data;
    const totalSlides = Array.isArray(current?.slides) ? current.slides.length : 0;
    if (!current || totalSlides === 0) {
        notify('Aucune slide disponible pour ajouter des quiz', 'warning');
        return;
    }
    const prompt = _buildGeminiQuizAugmentPrompt({ tuning, presentation: current });
    try {
        notify('IA: génération de quiz à partir des slides existantes…', 'info');
        const raw = await _callGeminiGenerate({
            apiKey: gemini.apiKey,
            model: gemini.model,
            prompt,
            temperature: Math.max(0.1, Math.min(0.8, Number(gemini.temperature) || 0.3)),
            timeoutMs: gemini.requestTimeoutMs,
        });
        const parsed = _tryParseJsonLoose(raw);
        if (!parsed.ok) throw new Error(parsed.error || 'JSON de quiz invalide');
        const plan = _normalizeQuizAugmentPlan(parsed.value, totalSlides, tuning);
        if (!plan.length) {
            notify('Aucun quiz exploitable renvoyé par Gemini', 'warning');
            return;
        }

        const previewRows = plan.slice(0, 14).map((q, i) =>
            `<tr><td>${i + 1}</td><td>${q.afterSlide}</td><td>${_escapeHtmlAi(q.quizType)}</td><td>${_escapeHtmlAi(q.title || q.question || 'Quiz')}</td></tr>`
        ).join('');
        const html = `
            <div style="font-size:.92rem;margin-bottom:8px;">${plan.length} quiz proposé(s) à insérer.</div>
            <div style="max-height:260px;overflow:auto;border:1px solid var(--border,#2d3347);border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
                    <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">#</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Après slide</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Type</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Titre</th></tr></thead>
                    <tbody>${previewRows}</tbody>
                </table>
            </div>
        `;
        const ok = await (window.OEIDialog?.confirm
            ? window.OEIDialog.confirm(html, {
                title: 'Ajouter des quiz aux slides courantes',
                confirmLabel: 'Insérer les quiz',
                cancelLabel: 'Annuler',
                danger: false,
            })
            : Promise.resolve(true));
        if (!ok) {
            notify('Ajout de quiz annulé', 'info');
            return;
        }

        const result = _insertQuizSlidesIntoPresentation(current, plan);
        editor.load(result.data);
        notify(`${result.inserted} slide(s) quiz ajoutée(s)`, 'success');
    } catch (err) {
        notify(`Ajout de quiz impossible: ${err?.message || 'erreur inconnue'}`, 'error');
    }
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

function _toBase64Utf8(text) {
    try {
        const enc = new TextEncoder();
        const bytes = enc.encode(String(text || ''));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (_) {
        try {
            return btoa(unescape(encodeURIComponent(String(text || ''))));
        } catch (_err) {
            return '';
        }
    }
}

function _svgToDataUrl(svg) {
    const b64 = _toBase64Utf8(svg);
    return b64 ? `data:image/svg+xml;base64,${b64}` : '';
}

function _pickIllustrationToken(entry = {}) {
    const blob = [
        entry.visualType,
        entry.intent,
        Array.isArray(entry.keywords) ? entry.keywords.join(' ') : '',
        entry.assetHint,
    ].join(' ').toLowerCase();
    if (blob.includes('usb')) return 'usb';
    if (blob.includes('hdd') || blob.includes('disk') || blob.includes('disque')) return 'hdd';
    if (blob.includes('cloud') || blob.includes('nuage')) return 'cloud';
    if (blob.includes('secure') || blob.includes('sécur') || blob.includes('lock') || blob.includes('rgpd')) return 'security';
    if (blob.includes('network') || blob.includes('réseau')) return 'network';
    if (blob.includes('chart') || blob.includes('graph') || blob.includes('diagram')) return 'chart';
    if (blob.includes('quiz') || blob.includes('question')) return 'quiz';
    if (blob.includes('code')) return 'code';
    if (blob.includes('warn') || blob.includes('attention')) return 'warning';
    return 'book';
}

function _fallbackIllustrationSvg({ label = 'Illustration', token = 'book' } = {}) {
    const t = String(label || 'Illustration').slice(0, 48).replace(/[<>&"]/g, '');
    const icons = {
        usb: '<rect x="88" y="66" width="80" height="116" rx="16" fill="none" stroke="#fff" stroke-width="10"/><rect x="108" y="42" width="40" height="24" rx="6" fill="#fff"/>',
        hdd: '<rect x="52" y="72" width="152" height="98" rx="16" fill="none" stroke="#fff" stroke-width="10"/><circle cx="90" cy="121" r="16" fill="none" stroke="#fff" stroke-width="9"/>',
        cloud: '<path d="M82 158h84a28 28 0 0 0 0-56 46 46 0 0 0-88-12 30 30 0 0 0 4 68z" fill="none" stroke="#fff" stroke-width="10"/>',
        security: '<rect x="76" y="104" width="104" height="74" rx="10" fill="none" stroke="#fff" stroke-width="10"/><path d="M100 104V84a28 28 0 0 1 56 0v20" fill="none" stroke="#fff" stroke-width="10"/>',
        network: '<circle cx="60" cy="70" r="14" fill="#fff"/><circle cx="196" cy="70" r="14" fill="#fff"/><circle cx="128" cy="178" r="14" fill="#fff"/>',
        chart: '<rect x="64" y="148" width="24" height="34" rx="4" fill="#fff"/><rect x="102" y="126" width="24" height="56" rx="4" fill="#fff"/><rect x="140" y="98" width="24" height="84" rx="4" fill="#fff"/>',
        quiz: '<circle cx="128" cy="120" r="70" fill="none" stroke="#fff" stroke-width="10"/><path d="M102 102a26 26 0 0 1 52 0c0 14-10 22-20 28v12" fill="none" stroke="#fff" stroke-width="10"/>',
        code: '<polyline points="90,88 58,122 90,156" fill="none" stroke="#fff" stroke-width="10"/><polyline points="166,88 198,122 166,156" fill="none" stroke="#fff" stroke-width="10"/>',
        warning: '<path d="M128 42 214 190H42z" fill="none" stroke="#fff" stroke-width="10"/><line x1="128" y1="92" x2="128" y2="140" stroke="#fff" stroke-width="10"/>',
        book: '<rect x="66" y="64" width="124" height="120" rx="14" fill="none" stroke="#fff" stroke-width="10"/><line x1="92" y1="100" x2="164" y2="100" stroke="#fff" stroke-width="8"/>',
    };
    const icon = icons[token] || icons.book;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 256 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="256" height="160" rx="18" fill="url(#g)"/><g transform="translate(0,-6)">${icon}</g><rect x="18" y="124" width="220" height="24" rx="8" fill="rgba(0,0,0,0.28)"/><text x="128" y="141" fill="#ffffff" font-size="11" font-family="Inter,Arial,sans-serif" text-anchor="middle">${t}</text></svg>`;
}

function _createRuntimeElementId(used = new Set()) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let attempt = 0; attempt < 120; attempt++) {
        let suffix = '';
        for (let i = 0; i < 7; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
        const id = `el_${suffix}`;
        if (!used.has(id)) {
            used.add(id);
            return id;
        }
    }
    return `el_${Date.now().toString(36).slice(-7)}`;
}

function _escapeSvgText(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function _normalizePlacementForPlaceholder(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'full' || raw === 'center' || raw === 'left' || raw === 'right' || raw === 'top') return raw;
    if (raw.includes('full')) return 'full';
    if (raw.includes('left')) return 'left';
    if (raw.includes('right')) return 'right';
    if (raw.includes('top')) return 'top';
    return 'right';
}

function _estimateCanvasTopOffset(slide) {
    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    let maxBottom = 120;
    elements.forEach((el) => {
        if (!el || typeof el !== 'object') return;
        const type = String(el.type || '').toLowerCase();
        if (!['heading', 'text', 'list', 'card', 'definition', 'quote', 'highlight'].includes(type)) return;
        const x = Number(el.x);
        const y = Number(el.y);
        const w = Number(el.w);
        const h = Number(el.h);
        if (!Number.isFinite(y) || !Number.isFinite(h)) return;
        if (Number.isFinite(x) && Number.isFinite(w)) {
            if ((x + w) < 680) return;
        }
        if (y > 320) return;
        maxBottom = Math.max(maxBottom, y + h + 18);
    });
    return Math.max(120, Math.min(300, Math.trunc(maxBottom)));
}

function _computePlaceholderBox(entry, slide) {
    const placement = _normalizePlacementForPlaceholder(entry?.placement);
    const visualType = String(entry?.visualType || '').trim().toLowerCase();
    const top = _estimateCanvasTopOffset(slide);
    let w = 520;
    let h = 300;

    if (visualType.includes('photo')) { w = 560; h = 320; }
    if (visualType.includes('infograph')) { w = 600; h = 350; }
    if (visualType.includes('schema') || visualType.includes('diagram')) { w = 580; h = 330; }
    if (visualType.includes('icon')) { w = 420; h = 280; }
    if (placement === 'full') { w = 1120; h = Math.max(280, Math.min(420, 720 - top - 60)); }
    if (placement === 'top') { w = 900; h = Math.max(230, Math.min(320, 720 - top - 120)); }

    w = Math.max(320, Math.min(1120, Math.trunc(w)));
    h = Math.max(210, Math.min(460, Math.trunc(h)));

    let x = 80;
    let y = top;
    if (placement === 'right') x = 1280 - 80 - w;
    if (placement === 'center') x = Math.max(80, Math.trunc((1280 - w) / 2));
    if (placement === 'full') x = 80;
    if (placement === 'top') {
        x = Math.max(80, Math.trunc((1280 - w) / 2));
        y = Math.max(108, top - 10);
    }

    if (y + h > 700) {
        h = Math.max(200, 700 - y);
    }
    return { x, y, w, h };
}

function _buildIllustrationPlaceholderDataUrl(entry, box, slideIndex = 0) {
    const intent = String(entry?.intent || '').trim() || 'Illustration à insérer';
    const visualType = String(entry?.visualType || '').trim() || 'illustration';
    const keywords = Array.isArray(entry?.keywords)
        ? entry.keywords.filter(Boolean).slice(0, 4).join(', ')
        : '';
    const hintRaw = String(entry?.assetHint || '').trim();
    const hint = hintRaw ? hintRaw.slice(0, 120) : '';
    const w = Math.max(320, Math.trunc(Number(box?.w) || 520));
    const h = Math.max(210, Math.trunc(Number(box?.h) || 300));
    const title = _escapeSvgText(`Placeholder visuel — slide ${slideIndex + 1}`);
    const l1 = _escapeSvgText(intent.slice(0, 96));
    const l2 = _escapeSvgText(`Type: ${visualType}`);
    const l3 = _escapeSvgText(keywords ? `Mots-clés: ${keywords}` : 'Mots-clés: à définir');
    const l4 = _escapeSvgText(hint ? `Suggestion: ${hint}` : 'Suggestion: ajouter une illustration pertinente');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="phg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ecfeff"/><stop offset="100%" stop-color="#f5f3ff"/></linearGradient></defs><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="16" fill="url(#phg)" stroke="#8b5cf6" stroke-width="3" stroke-dasharray="12 8"/><rect x="18" y="16" width="${Math.max(180, w - 36)}" height="28" rx="8" fill="#111827"/><text x="${Math.trunc(w / 2)}" y="35" text-anchor="middle" fill="#ffffff" font-size="14" font-family="Inter,Arial,sans-serif">${title}</text><text x="22" y="78" fill="#111827" font-size="18" font-weight="700" font-family="Inter,Arial,sans-serif">${l1}</text><text x="22" y="108" fill="#334155" font-size="14" font-family="Inter,Arial,sans-serif">${l2}</text><text x="22" y="132" fill="#475569" font-size="13" font-family="Inter,Arial,sans-serif">${l3}</text><text x="22" y="156" fill="#64748b" font-size="12" font-family="Inter,Arial,sans-serif">${l4}</text></svg>`;
    return _svgToDataUrl(svg);
}

function _extractIllustrationsFromPass2(rawPass2) {
    const parsed = _tryParseJsonLoose(rawPass2);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return [];
    const payload = parsed.value;
    const list = Array.isArray(payload.illustrations)
        ? payload.illustrations
        : (Array.isArray(payload.illustrationPlan) ? payload.illustrationPlan : []);
    return list.slice(0, 60);
}

function _normalizePass2Illustrations(rawPass2) {
    const list = _extractIllustrationsFromPass2(rawPass2);
    return list.map((entry, idx) => {
        const slide = Number.isFinite(Number(entry?.slide))
            ? Math.max(1, Math.trunc(Number(entry.slide)))
            : (Number.isFinite(Number(entry?.slideIndex)) ? Math.max(1, Math.trunc(Number(entry.slideIndex)) + 1) : (idx + 1));
        return {
            id: `ill_${idx + 1}`,
            index: idx,
            slide,
            slideIndex: slide - 1,
            slideTitle: String(entry?.slideTitle || '').trim(),
            intent: String(entry?.intent || '').trim(),
            visualType: String(entry?.visualType || '').trim(),
            assetHint: String(entry?.assetHint || entry?.src || '').trim(),
            placement: String(entry?.placement || '').trim(),
            raw: entry || {},
        };
    });
}

function _reviewPass2IllustrationsChoice(items) {
    if (!Array.isArray(items) || !items.length) return Promise.resolve({ ok: true, selectedIds: [] });
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        const rows = items.map((item) => {
            const previewSrc = _sanitizePreviewImageSrc(item.assetHint);
            const preview = previewSrc
                ? `<img src="${_escapeHtmlAi(previewSrc)}" alt="${_escapeHtmlAi(item.intent || item.slideTitle || 'Illustration')}" loading="lazy">`
                : `<span class="ai-pass-asset-hint">${_escapeHtmlAi(item.assetHint || 'asset://...')}</span>`;
            return `
                <tr data-ill-row="${_escapeHtmlAi(item.id)}">
                    <td><input type="checkbox" data-ill-check="${_escapeHtmlAi(item.id)}" checked></td>
                    <td>${item.slide}</td>
                    <td>${_escapeHtmlAi(item.visualType || '—')}</td>
                    <td>${_escapeHtmlAi(item.intent || item.slideTitle || '—')}</td>
                    <td>${preview}</td>
                </tr>
            `;
        }).join('');
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Sélection illustrations passe 2">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Étape intermédiaire — placeholders visuels</h3>
                    <div class="ai-pass-review-hint">Choisis les illustrations à transformer en placeholders en passe 3.</div>
                </div>
                <div class="ai-pass-review-actions ai-pass-review-actions-inline">
                    <button type="button" class="tb-btn ui-btn" data-ill-all>Aucune</button>
                    <button type="button" class="tb-btn ui-btn" data-ill-none>Toutes</button>
                </div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>OK</th><th>Slide</th><th>Type</th><th>Intent</th><th>Aperçu</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-ill-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ill-validate>Continuer</button>
                </div>
            </div>
        `;
        const getSelectedIds = () => items
            .filter((it) => overlay.querySelector(`[data-ill-check="${it.id}"]`)?.checked)
            .map((it) => it.id);
        const close = (ok) => {
            const selectedIds = getSelectedIds();
            overlay.remove();
            resolve({ ok, selectedIds });
        };
        overlay.querySelector('[data-ill-all]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-ill-check="${it.id}"]`);
                if (input) input.checked = false;
            });
        });
        overlay.querySelector('[data-ill-none]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-ill-check="${it.id}"]`);
                if (input) input.checked = true;
            });
        });
        overlay.querySelector('[data-ill-cancel]')?.addEventListener('click', () => close(false));
        overlay.querySelector('[data-ill-validate]')?.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false);
        });
        document.body.appendChild(overlay);
    });
}

function _reviewPass3GeneratedImagesChoice(items) {
    if (!Array.isArray(items) || !items.length) return Promise.resolve({ ok: true, keptIds: [] });
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        const cards = items.map((item) => `
            <label class="ai-pass-image-card">
                <input type="checkbox" data-gen-check="${_escapeHtmlAi(item.id)}" checked>
                <img src="${_escapeHtmlAi(item.afterSrc || '')}" alt="${_escapeHtmlAi(item.label || 'Illustration')}" loading="lazy">
                <div class="ai-pass-image-card-meta">
                    <strong>Slide ${item.slide + 1}</strong>
                    <span>${_escapeHtmlAi(item.label || 'Illustration')}</span>
                </div>
            </label>
        `).join('');
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Sélection finale visuels passe 3">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Étape finale passe 3 — visuels à conserver</h3>
                    <div class="ai-pass-review-hint">Décoche les visuels à retirer avant de continuer.</div>
                </div>
                <div class="ai-pass-review-actions ai-pass-review-actions-inline">
                    <button type="button" class="tb-btn ui-btn" data-gen-none>Aucune</button>
                    <button type="button" class="tb-btn ui-btn" data-gen-all>Toutes</button>
                </div>
                <div class="ai-pass-image-grid">${cards}</div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-gen-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-gen-validate>Valider les visuels</button>
                </div>
            </div>
        `;
        const getKeptIds = () => items
            .filter((it) => overlay.querySelector(`[data-gen-check="${it.id}"]`)?.checked)
            .map((it) => it.id);
        const close = (ok) => {
            const keptIds = getKeptIds();
            overlay.remove();
            resolve({ ok, keptIds });
        };
        overlay.querySelector('[data-gen-none]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-gen-check="${it.id}"]`);
                if (input) input.checked = false;
            });
        });
        overlay.querySelector('[data-gen-all]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-gen-check="${it.id}"]`);
                if (input) input.checked = true;
            });
        });
        overlay.querySelector('[data-gen-cancel]')?.addEventListener('click', () => close(false));
        overlay.querySelector('[data-gen-validate]')?.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false);
        });
        document.body.appendChild(overlay);
    });
}

function _findOrCreateImageSlot(presentation, slideIndex, entry = null) {
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    const slide = slides[slideIndex];
    if (!slide || typeof slide !== 'object') return null;
    if (slide.type === 'image') {
        if (typeof slide.src !== 'string') slide.src = '';
        if (typeof slide.alt !== 'string') slide.alt = '';
        return { owner: slide, key: 'src', altOwner: slide, altKey: 'alt', path: `slides[${slideIndex}].src`, slide, created: false };
    }
    if (slide.type === 'split') {
        if (!slide.data || typeof slide.data !== 'object') slide.data = {};
        if (!slide.data.media || typeof slide.data.media !== 'object') slide.data.media = { type: 'image', src: '', alt: '' };
        if (String(slide.data.media.type || '').toLowerCase() === 'image') {
            if (typeof slide.data.media.src !== 'string') slide.data.media.src = '';
            if (typeof slide.data.media.alt !== 'string') slide.data.media.alt = '';
            return { owner: slide.data.media, key: 'src', altOwner: slide.data.media, altKey: 'alt', path: `slides[${slideIndex}].data.media.src`, slide, created: false };
        }
    }
    if (slide.type === 'canvas') {
        slide.elements = Array.isArray(slide.elements) ? slide.elements : [];
        let imageEl = null;
        let imageIdx = -1;
        let created = false;
        slide.elements.forEach((el, idx) => {
            if (imageEl) return;
            if (el && typeof el === 'object' && String(el.type || '').toLowerCase() === 'image') {
                imageEl = el;
                imageIdx = idx;
            }
        });
        if (!imageEl) {
            const box = _computePlaceholderBox(entry, slide);
            const used = new Set(slide.elements.map((el) => String(el?.id || '')).filter(Boolean));
            imageEl = {
                id: _createRuntimeElementId(used),
                type: 'image',
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                z: 6,
                data: { src: '', alt: '' },
                style: { objectFit: 'contain', borderRadius: '14px' },
            };
            slide.elements.push(imageEl);
            imageIdx = slide.elements.length - 1;
            created = true;
        } else if (entry && typeof imageEl === 'object') {
            const box = _computePlaceholderBox(entry, slide);
            imageEl.x = box.x;
            imageEl.y = box.y;
            imageEl.w = box.w;
            imageEl.h = box.h;
        }
        if (!imageEl.data || typeof imageEl.data !== 'object') imageEl.data = {};
        if (typeof imageEl.data.src !== 'string') imageEl.data.src = '';
        if (typeof imageEl.data.alt !== 'string') imageEl.data.alt = '';
        return {
            owner: imageEl.data,
            key: 'src',
            altOwner: imageEl.data,
            altKey: 'alt',
            path: `slides[${slideIndex}].elements[${imageIdx}].data.src`,
            slide,
            created,
            imageIndex: imageIdx,
            imageElement: imageEl,
        };
    }
    return null;
}

function _collectPass3ImageTargets(presentation, pass2Illustrations, maxItems = 20, strictSelection = false, imageStyle = 'mixte') {
    const out = [];
    const seen = new Set();
    const push = (slot, entry) => {
        if (!slot?.path || seen.has(slot.path)) return;
        seen.add(slot.path);
        out.push({ slot, entry });
    };
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    const max = Math.max(0, Math.min(80, Number(maxItems) || 0));
    pass2Illustrations.forEach((entry, idx) => {
        let slideIndex = Number.isFinite(Number(entry?.slideIndex))
            ? Number(entry.slideIndex)
            : (Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) - 1 : idx);
        slideIndex = Math.max(0, Math.trunc(slideIndex));
        if (slideIndex >= slides.length) return;
        const slot = _findOrCreateImageSlot(presentation, slideIndex, entry || {});
        if (!slot) return;
        const raw = String(slot.owner?.[slot.key] || '').trim();
        if (raw && !raw.startsWith('asset://') && !raw.startsWith('placeholder://')) return;
        push(slot, entry || {});
    });
    if (!strictSelection) {
        const fallbackVisualType = imageStyle === 'infographie'
            ? 'infographic'
            : (imageStyle === 'photo' ? 'photo' : (imageStyle === 'icones' ? 'icon' : 'illustration'));
        for (let i = 0; i < slides.length && out.length < max; i++) {
            const fallbackEntry = { slideIndex: i, visualType: fallbackVisualType, intent: 'Illustration pédagogique', keywords: [], placement: 'right' };
            const slot = _findOrCreateImageSlot(presentation, i, fallbackEntry);
            if (!slot) continue;
            const raw = String(slot.owner?.[slot.key] || '').trim();
            if (!raw || raw.startsWith('asset://') || raw.startsWith('placeholder://')) {
                push(slot, fallbackEntry);
            }
        }
    }
    return out.slice(0, max);
}

function _extractImageResultFromGemini(rawText) {
    const parsed = _tryParseJsonLoose(rawText);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
        const v = parsed.value;
        if (typeof v.dataUrl === 'string' && /^data:image\//i.test(v.dataUrl)) return { dataUrl: v.dataUrl, alt: String(v.alt || '').trim() };
        if (typeof v.src === 'string' && (/^https?:\/\//i.test(v.src) || /^data:image\//i.test(v.src))) {
            return { dataUrl: v.src, alt: String(v.alt || '').trim() };
        }
        if (typeof v.url === 'string' && (/^https?:\/\//i.test(v.url) || /^data:image\//i.test(v.url))) {
            return { dataUrl: v.url, alt: String(v.alt || '').trim() };
        }
        if (typeof v.svg === 'string' && v.svg.includes('<svg')) {
            const dataUrl = _svgToDataUrl(v.svg);
            if (dataUrl) return { dataUrl, alt: String(v.alt || '').trim() };
        }
    }
    const raw = String(rawText || '');
    const svgStart = raw.indexOf('<svg');
    const svgEnd = raw.lastIndexOf('</svg>');
    if (svgStart >= 0 && svgEnd > svgStart) {
        const svg = raw.slice(svgStart, svgEnd + 6);
        const dataUrl = _svgToDataUrl(svg);
        if (dataUrl) return { dataUrl, alt: '' };
    }
    return null;
}

function _buildGeminiSingleImagePrompt({ brief, entry, slideIndex, tuning }) {
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords.filter(Boolean).slice(0, 10).join(', ') : '';
    return [
        'Génère UNE illustration pédagogique (SVG URL ou dataUrl).',
        'Retourne uniquement un JSON valide sans markdown.',
        'Schéma strict:',
        '{"src":"https://...svg","dataUrl":"data:image/svg+xml;base64,...","alt":"..."}',
        'Contraintes:',
        '- Priorité: si le concept est simple (HDD, SSD, clé USB, document, dossier, réseau, base de données), utiliser un SVG externe pertinent (ex: The Noun Project) via `src` HTTPS.',
        '- Sinon, renvoyer un `dataUrl` SVG propre et lisible.',
        '- Pas de texte long dans le dessin (max 3 mots).',
        '- Pas de contenu sensible ou marque déposée.',
        '- Ne pas renvoyer de placeholder décoratif générique.',
        `- Style demandé: ${tuning.imageStyle}`,
        `Contexte slide: index ${slideIndex + 1}`,
        `Intent: ${String(entry?.intent || '').trim() || 'Illustration pédagogique'}`,
        `Type visuel: ${String(entry?.visualType || '').trim() || 'icon'}`,
        `Mots-clés: ${keywords || 'aucun'}`,
        `Brief global: ${brief}`,
    ].join('\n');
}

function _buildGeminiSingleRasterImagePrompt({ brief, entry, slideIndex, tuning }) {
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords.filter(Boolean).slice(0, 12).join(', ') : '';
    const visualType = String(entry?.visualType || '').trim() || 'illustration';
    const style = String(tuning?.imageStyle || 'mixte').trim().toLowerCase();
    const styleHints = style === 'photo'
        ? 'Style photo réaliste, lumière naturelle, composition claire.'
        : (style === 'infographie'
            ? 'Style infographie pédagogique moderne, hiérarchie visuelle nette, pictogrammes lisibles, 16:9.'
            : (style === 'icones'
                ? 'Style illustration vectorielle propre, formes lisibles, couleurs contrastées.'
                : 'Style éditorial pédagogique moderne, riche visuellement, pas uniquement des icônes.'));
    return [
        'Tu dois générer UNE image pédagogique (pas du SVG texte).',
        'Priorité: image finale exploitable dans une slide 16:9.',
        'Contraintes strictes:',
        '- Générer une image raster (PNG/JPEG) avec bon niveau de détail.',
        '- Pas de watermark, pas de logo de marque, pas de texte long.',
        '- Si du texte apparaît dans l’image, il doit être très court (max 6 mots).',
        '- L’image doit illustrer explicitement l’intention pédagogique.',
        styleHints,
        `Contexte slide: ${slideIndex + 1}`,
        `Intent pédagogique: ${String(entry?.intent || '').trim() || 'Illustration pédagogique'}`,
        `Type visuel attendu: ${visualType}`,
        `Mots-clés: ${keywords || 'aucun'}`,
        `Brief global du cours: ${brief}`,
    ].join('\n');
}

function _describeGeminiImageError(err, timeoutMs) {
    const msg = String(err?.message || err || '').trim();
    if (!msg) return 'Erreur inconnue.';
    const lowered = msg.toLowerCase();
    if (lowered.includes('timeout') || lowered.includes('abort')) {
        return `Timeout de génération (${Math.trunc(Number(timeoutMs) || 0)} ms).`;
    }
    if (lowered.includes('429') || lowered.includes('quota') || lowered.includes('rate')) {
        return `Quota/rate limit Gemini: ${msg}`;
    }
    if (lowered.includes('401') || lowered.includes('403') || lowered.includes('api key') || lowered.includes('forbidden') || lowered.includes('unauthorized')) {
        return `Clé API ou permissions Gemini invalides: ${msg}`;
    }
    if (lowered.includes('modality') || lowered.includes('responsemodalities') || lowered.includes('not support') || lowered.includes('unsupported')) {
        return `Modèle non compatible génération d'image: ${msg}`;
    }
    if (lowered.includes('block') || lowered.includes('safety')) {
        return `Contenu bloqué par les règles de sécurité Gemini: ${msg}`;
    }
    if (lowered.includes('response') && lowered.includes('vide')) {
        return `Gemini a renvoyé une réponse vide: ${msg}`;
    }
    return msg;
}

async function _materializePass3ImagesOneByOne({
    outputText,
    pass2Illustrations = [],
    brief,
    tuning,
    pipeline,
    gemini,
    runner,
    pass = 3,
    strictSelection = false,
}) {
    const parsed = _tryParseJsonLoose(outputText);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
        return { text: outputText, payload: null, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };
    }
    const payload = parsed.value;
    const presentation = (payload?.presentation && typeof payload.presentation === 'object')
        ? payload.presentation
        : ((payload?.metadata && Array.isArray(payload?.slides)) ? payload : null);
    if (!presentation) return { text: outputText, payload: null, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };

    const targets = _collectPass3ImageTargets(
        presentation,
        Array.isArray(pass2Illustrations) ? pass2Illustrations : [],
        pipeline?.maxIllustrations || 14,
        strictSelection,
        tuning?.imageStyle || 'mixte'
    );
    if (!targets.length) {
        const nextPayload = { ...payload, mediaReport: { planned: 0, generated: 0, failed: 0 }, presentation };
        const text = _stringifyPrettyJson(nextPayload);
        return { text: text || outputText, payload: nextPayload, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };
    }

    if (!AI_IMAGE_GENERATION_ENABLED) {
        let placeholderCount = 0;
        let generatedId = 0;
        const generatedItems = [];
        runner?.setWaiting?.(pass, `Passe 3 — placeholders visuels (${targets.length})`);
        for (let i = 0; i < targets.length; i++) {
            const { slot, entry } = targets[i];
            const beforeSrc = String(slot.owner?.[slot.key] || '');
            const beforeAlt = String(slot.altOwner?.[slot.altKey] || '');
            const slideIdx = Number.isFinite(Number(entry?.slideIndex))
                ? Number(entry.slideIndex)
                : (Number.isFinite(Number(entry?.slide)) ? Math.max(0, Number(entry.slide) - 1) : i);
            let box = { w: 720, h: 340 };
            if (slot.slide && String(slot.slide.type || '').toLowerCase() === 'canvas') {
                box = _computePlaceholderBox(entry, slot.slide);
                if (slot.imageElement && typeof slot.imageElement === 'object') {
                    slot.imageElement.x = box.x;
                    slot.imageElement.y = box.y;
                    slot.imageElement.w = box.w;
                    slot.imageElement.h = box.h;
                    slot.imageElement.style = {
                        ...(slot.imageElement.style && typeof slot.imageElement.style === 'object' ? slot.imageElement.style : {}),
                        objectFit: 'contain',
                        borderRadius: '14px',
                    };
                }
            }
            const dataUrl = _buildIllustrationPlaceholderDataUrl(entry, box, slideIdx);
            slot.owner[slot.key] = dataUrl || '';
            if (slot.altOwner && slot.altKey) {
                slot.altOwner[slot.altKey] = String(entry?.intent || entry?.slideTitle || 'Placeholder illustration');
            }
            placeholderCount += 1;
            runner?.setProgress?.(
                pass,
                `Passe 3 — placeholder ${i + 1}/${targets.length}`,
                `Slide ${slideIdx + 1} • ${String(entry?.visualType || 'illustration')}`
            );
            runner?.pushImage?.(
                pass,
                slot.owner[slot.key],
                `S${slideIdx + 1} · placeholder · ${String(entry?.visualType || 'illustration')}`
            );
            generatedId += 1;
            generatedItems.push({
                id: `gen_${generatedId}`,
                slide: slideIdx,
                label: String(entry?.intent || entry?.slideTitle || '').trim() || 'Placeholder visuel',
                beforeSrc,
                beforeAlt,
                afterSrc: String(slot.owner?.[slot.key] || ''),
                afterAlt: String(slot.altOwner?.[slot.altKey] || ''),
                slot,
            });
        }
        const mediaReport = {
            planned: targets.length,
            generated: 0,
            failed: 0,
            placeholderCount,
            mode: 'placeholder-only',
        };
        const nextPayload = { ...payload, mediaReport, presentation };
        const text = _stringifyPrettyJson(nextPayload);
        return { text: text || outputText, payload: nextPayload, mediaReport, generatedItems };
    }

    let generated = 0;
    let failed = 0;
    let generatedId = 0;
    const generatedItems = [];
    const perImageTimeout = Math.max(
        8000,
        Math.min(
            240000,
            Math.trunc(Number(pipeline?.timeoutMs) || Number(gemini?.requestTimeoutMs) || 60000)
        )
    );
    runner?.setWaiting?.(pass, `Passe 3 — génération images (0/${targets.length})`);

    for (let i = 0; i < targets.length; i++) {
        const { slot, entry } = targets[i];
        const beforeSrc = String(slot.owner?.[slot.key] || '');
        const beforeAlt = String(slot.altOwner?.[slot.altKey] || '');
        runner?.setProgress?.(
            pass,
            `Passe 3 — génération image ${i + 1}/${targets.length}`,
            `Slide ${Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) : (i + 1)} • ${String(entry?.intent || 'Illustration pédagogique')}`
        );
        const rasterPrompt = _buildGeminiSingleRasterImagePrompt({
            brief,
            entry,
            slideIndex: Number.isFinite(Number(entry?.slideIndex)) ? Number(entry.slideIndex) : i,
            tuning,
        });
        const svgPrompt = _buildGeminiSingleImagePrompt({
            brief,
            entry,
            slideIndex: Number.isFinite(Number(entry?.slideIndex)) ? Number(entry.slideIndex) : i,
            tuning,
        });
        const preferredImageModel = String(gemini?.imageModel || '').trim();
        const imageModelCandidates = [
            preferredImageModel,
            ...AI_GEMINI_IMAGE_MODELS,
        ].map(v => String(v || '').trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx);
        let dataUrl = '';
        let alt = '';
        let failureReason = '';
        let imageSource = '';
        const attemptedModels = [];
        try {
            let lastErr = null;
            const nativeImageModelCandidates = imageModelCandidates.filter(_supportsNativeGeminiImageModel);
            if (!nativeImageModelCandidates.length) {
                runner?.setProgress?.(
                    pass,
                    `Passe 3 — image ${i + 1}/${targets.length}: modèle textuel`,
                    'Aucun modèle image natif sélectionné, passage direct en génération SVG/base64.'
                );
            }
            for (let mi = 0; mi < nativeImageModelCandidates.length; mi++) {
                const modelCandidate = nativeImageModelCandidates[mi];
                attemptedModels.push(modelCandidate);
                runner?.setProgress?.(
                    pass,
                    `Passe 3 — image ${i + 1}/${targets.length}: tentative image réelle`,
                    `Modèle: ${modelCandidate} (${mi + 1}/${nativeImageModelCandidates.length})`
                );
                try {
                    const imageResult = await _callGeminiGenerateImage({
                        apiKey: gemini.apiKey,
                        model: modelCandidate,
                        prompt: rasterPrompt,
                        temperature: Math.max(0.2, Math.min(1.2, Number(gemini.temperature) || 0.5)),
                        timeoutMs: perImageTimeout,
                    });
                    dataUrl = String(imageResult?.dataUrl || '').trim();
                    alt = String(entry?.intent || entry?.slideTitle || '').trim()
                        || String(imageResult?.textHint || '').trim()
                        || 'Illustration pédagogique';
                    if (dataUrl) imageSource = 'gemini-image';
                    if (dataUrl) break;
                } catch (errModel) {
                    lastErr = errModel;
                    const msg = String(errModel?.message || '').toLowerCase();
                    const maybeModelIssue = (
                        msg.includes('not support')
                        || msg.includes('unsupported')
                        || msg.includes('unknown model')
                        || msg.includes('not found')
                        || msg.includes('404')
                        || msg.includes('modality')
                        || msg.includes('responsemodalities')
                        || msg.includes('model')
                    );
                    if (!maybeModelIssue) break;
                }
            }
            if (!dataUrl && lastErr) throw lastErr;
        } catch (err) {
            failureReason = _describeGeminiImageError(err, perImageTimeout);
            if (attemptedModels.length) {
                failureReason = `${failureReason} | Modèles testés: ${attemptedModels.join(', ')}`;
            }
            runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: échec image réelle`, failureReason);
        }
        if (!dataUrl) {
            try {
                const svgModelCandidates = [
                    preferredImageModel,
                    gemini.model,
                    ...AI_GEMINI_MODELS,
                ].map(v => String(v || '').trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx);
                let svgErr = null;
                for (let si = 0; si < svgModelCandidates.length; si++) {
                    const svgModel = svgModelCandidates[si];
                    runner?.setProgress?.(
                        pass,
                        `Passe 3 — image ${i + 1}/${targets.length}: tentative SVG Gemini`,
                        `Modèle: ${svgModel} (${si + 1}/${svgModelCandidates.length})`
                    );
                    try {
                        const raw = await _callGeminiGenerate({
                            apiKey: gemini.apiKey,
                            model: svgModel,
                            prompt: svgPrompt,
                            temperature: Math.max(0.1, Math.min(1.2, Number(gemini.temperature) || 0.3)),
                            timeoutMs: perImageTimeout,
                        });
                        const extracted = _extractImageResultFromGemini(raw);
                        if (extracted?.dataUrl) {
                            dataUrl = extracted.dataUrl;
                            alt = extracted.alt || alt;
                            imageSource = 'gemini-svg';
                            break;
                        }
                        svgErr = new Error('Réponse Gemini reçue mais format image invalide (dataUrl manquant).');
                    } catch (errSvgModel) {
                        svgErr = errSvgModel;
                    }
                }
                if (!dataUrl && svgErr) {
                    const reason = _describeGeminiImageError(svgErr, perImageTimeout);
                    failureReason = failureReason ? `${failureReason} | ${reason}` : reason;
                }
            } catch (err2) {
                const reason = _describeGeminiImageError(err2, perImageTimeout);
                failureReason = failureReason ? `${failureReason} | ${reason}` : reason;
            }
        }
        if (!dataUrl) {
            failed += 1;
            runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: échec`, failureReason || 'Image non générée.');
            const currentSrc = String(slot.owner?.[slot.key] || '').trim();
            const shouldClear =
                !currentSrc
                || currentSrc.startsWith('asset://')
                || currentSrc.startsWith('placeholder://')
                || beforeSrc.trim().startsWith('asset://')
                || beforeSrc.trim().startsWith('placeholder://');
            if (shouldClear) {
                slot.owner[slot.key] = '';
                if (slot.altOwner && slot.altKey) slot.altOwner[slot.altKey] = '';
                if (
                    slot.created
                    && slot.slide
                    && String(slot.slide.type || '').toLowerCase() === 'canvas'
                    && Array.isArray(slot.slide.elements)
                    && Number.isInteger(slot.imageIndex)
                    && slot.imageIndex >= 0
                    && slot.slide.elements[slot.imageIndex] === slot.imageElement
                ) {
                    slot.slide.elements.splice(slot.imageIndex, 1);
                }
            }
            runner?.setProgress?.(
                pass,
                `Passe 3 — image ${i + 1}/${targets.length}: ignorée`,
                'Aucune image conservée pour cette slide.'
            );
            continue;
        }
        generated += 1;
        runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: OK`, 'Image générée via Gemini.');
        runner?.pushImage?.(
            pass,
            dataUrl,
            `S${Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) : (i + 1)} · ${String(entry?.visualType || 'illustration')} · ${imageSource || 'unknown'}`
        );
        slot.owner[slot.key] = dataUrl;
        if (slot.altOwner && slot.altKey) {
            slot.altOwner[slot.altKey] = String(alt || entry?.intent || entry?.slideTitle || 'Illustration');
        }
        generatedId += 1;
        generatedItems.push({
            id: `gen_${generatedId}`,
            slide: Number.isFinite(Number(entry?.slideIndex))
                ? Number(entry.slideIndex)
                : (Number.isFinite(Number(entry?.slide)) ? Math.max(0, Number(entry.slide) - 1) : 0),
            label: String(entry?.intent || entry?.slideTitle || '').trim() || 'Illustration',
            beforeSrc,
            beforeAlt,
            afterSrc: String(slot.owner?.[slot.key] || ''),
            afterAlt: String(slot.altOwner?.[slot.altKey] || ''),
            slot,
        });
    }

    const mediaReport = {
        planned: targets.length,
        generated,
        failed,
    };
    const nextPayload = { ...payload, mediaReport, presentation };
    const text = _stringifyPrettyJson(nextPayload);
    return { text: text || outputText, payload: nextPayload, mediaReport, generatedItems };
}

function _buildGeminiPassPrompt(pass, { brief, tuning, pipeline, previous, promptTemplate, refinePrompt = '', currentDraft = '' }) {
    const baseContext = _buildAIPromptContext(tuning, pipeline);
    const qualityGate = _buildAIPromptQualityGate(tuning, pipeline);
    const adaptiveRules = _buildAIAdaptiveBalanceRules(tuning);
    const sensitiveComponentRules = _buildAISensitiveComponentRules();
    const quizTarget = _computeAIQuizTarget(tuning);
    const relanceBlock = String(refinePrompt || '').trim()
        ? [
            'MODE RELANCE UTILISATEUR',
            '- Applique précisément la consigne suivante.',
            '- Conserve le schéma de la passe.',
            `Consigne de relance: ${refinePrompt}`,
            String(currentDraft || '').trim() ? `Brouillon actuel à corriger:\n${currentDraft}` : '',
        ].filter(Boolean).join('\n')
        : '';
    if (pass === 1) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 1 (Plan pédagogique).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":1,"title":"...","learningObjectives":["..."],"plan":[{"order":1,"title":"...","type":"title|chapter|bullets|code|split|definition|comparison|quote|blank|quiz|canvas","objective":"...","keyPoints":["..."],"level":1}],"risks":["..."]}',
            'Consignes: privilégie des slides compatibles avec des composants natifs riches (canvas + smartart/diagramme/card/definition/code-example/quiz), sans dépendance image.',
            'Règles d’équilibre obligatoires:',
            ...adaptiveRules,
            quizTarget > 0
                ? `- Dans le plan, marquer explicitement ~${quizTarget} slide(s) de checkpoint interactif.`
                : '- Aucun checkpoint quiz imposé dans le plan.',
            baseContext,
            `Brief utilisateur: ${brief}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 2) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 2 (Plan de composants visuels et illustrations).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":2,"illustrations":[{"slide":1,"slideTitle":"...","visualType":"icon|infographic|diagram|photo|schema","intent":"...","placement":"left|right|full","keywords":["..."],"assetHint":"..."}],"componentPlan":[{"slide":1,"componentType":"smartart|diagramme|card|definition|code-example|highlight|table|mermaid|quiz-live|mcq-single|mcq-multi|poll-likert|exit-ticket|postit-wall|rank-order|flashcards-auto|algo-stepper|code-compare|list|quote|shape","intent":"...","placement":"left|right|full","priority":"high|normal|low","payloadHint":"..."}]}',
            `Consignes: produire au plus ${Math.max(0, Math.min(60, Number(pipeline?.maxIllustrations) || 0))} illustrations ciblées et réellement utiles.`,
            `Style attendu prioritaire: ${tuning.imageStyle}. Évite de proposer uniquement des icons si des infographies/photos sont pertinentes.`,
            '- La génération d’image est désactivée: proposer des placeholders descriptifs précis.',
            '- Pour les objets simples (HDD/SSD/clé USB/document/dossier), proposer si pertinent des SVG externes de The Noun Project dans `assetHint`.',
            '- Si aucune illustration utile n’est nécessaire, renvoyer `illustrations: []`.',
            quizTarget > 0
                ? `- Prévoir dans componentPlan environ ${quizTarget} composant(s) interactif(s) de checkpoint (quiz/poll/mcq/exit-ticket).`
                : '- Fréquence quiz = none: pas d’obligation de composant interactif.',
            'Règles de format des composants sensibles:',
            ...sensitiveComponentRules,
            'Interdit: composant `columns` (non supporté).',
            baseContext,
            `Brief utilisateur: ${brief}`,
            `Résultat PASS 1:\n${previous.pass1 || ''}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 3) {
        const selectedIlluBlock = String(previous.pass2Selected || '').trim()
            ? `Illustrations validées par l'utilisateur (à prioriser):\n${previous.pass2Selected}`
            : '';
        return [
            'Tu exécutes UNIQUEMENT la PASS 3 (Génération JSON complet).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":3,"summary":{"slideCount":0,"mainTheme":"..."},"presentation":{"metadata":{},"theme":"icom","showSlideNumber":false,"footerText":null,"autoNumberChapters":false,"slides":[]}}',
            'Contraintes:',
            '- Utiliser les illustrations validées en PASS 2 si elles sont pertinentes.',
            '- Génération d’images désactivée: insérer des placeholders visuels explicites.',
            '- Les emplacements image doivent utiliser `placeholder://...` ou `asset://...` descriptifs.',
            '- Pour les pictogrammes simples, autorisé: URL SVG externe (ex: The Noun Project) dans `assetHint` et/ou `src`.',
            '- Le placeholder doit préciser l’intention visuelle (pas un bloc générique).',
            '- Préfère les composants natifs visuels (smartart, diagramme, card, definition, highlight, code-example, quiz, algo-stepper).',
            'Règles d’équilibre obligatoires:',
            ...adaptiveRules,
            quizTarget > 0
                ? `- Vérifie qu’il y a environ ${quizTarget} slide(s) interactives réparties dans le deck.`
                : '- Ne pas ajouter de quiz interactif si non justifié.',
            'Formats sensibles à respecter exactement:',
            ...sensitiveComponentRules,
            '- Interdit: composant canvas `columns`.',
            baseContext,
            qualityGate,
            `Brief utilisateur: ${brief}`,
            `Résultat PASS 1:\n${previous.pass1 || ''}`,
            `Résultat PASS 2:\n${previous.pass2 || ''}`,
            selectedIlluBlock,
            `Template de référence:\n${promptTemplate}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 4) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 4 (Composants + lisibilité).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":4,"componentReport":{"componentRichness":"high","imageCount":0},"presentation":{...}}',
            'Contraintes: conserver la structure PresentaForge, renforcer les composants natifs et garder uniquement les images pédagogiquement utiles.',
            baseContext,
            `Brief utilisateur: ${brief}`,
            `JSON PASS 3:\n${previous.pass3 || ''}`,
            relanceBlock,
        ].join('\n\n');
    }
    return [
        'Tu exécutes UNIQUEMENT la PASS 5 (Validation finale).',
        'Réponds uniquement avec un JSON valide, sans markdown.',
        'Schéma JSON strict:',
        '{"pass":5,"validation":{"isValid":true,"issues":[]},"presentation":{...}}',
        'Checklist finale: JSON parseable, types supportés, pas de [object Object], formats sensibles conformes, équilibre visuel respecté.',
        quizTarget > 0
            ? `- Vérifier la présence d’environ ${quizTarget} checkpoint(s) interactif(s) dans la présentation finale.`
            : '- Vérifier que la présentation reste cohérente sans checkpoint quiz forcé.',
        baseContext,
        qualityGate,
        `Brief utilisateur: ${brief}`,
        `JSON PASS 4:\n${previous.pass4 || ''}`,
        relanceBlock,
    ].join('\n\n');
}

function _createAIPassRunnerOverlay(total = 5) {
    const overlay = document.createElement('div');
    overlay.className = 'ai-pass-overlay';
    overlay.innerHTML = `
        <div class="ai-pass-modal" role="dialog" aria-modal="true" aria-label="Pipeline Gemini">
            <div class="ai-pass-head">
                <h3 class="ai-pass-title">Pipeline Gemini (5 passes)</h3>
                <div class="ai-pass-subtitle" data-ai-pass-status>Initialisation…</div>
            </div>
            <div class="ai-pass-steps" data-ai-pass-steps>
                ${Array.from({ length: total }).map((_, i) => `
                    <div class="ai-pass-step" data-pass-step="${i + 1}">
                        <span class="ai-pass-step-dot">${i + 1}</span>
                        <span class="ai-pass-step-label">Passe ${i + 1}</span>
                    </div>
                `).join('')}
            </div>
            <div class="ai-pass-skeleton" data-ai-pass-skeleton>
                <div class="ai-pass-skel-line w-80"></div>
                <div class="ai-pass-skel-line w-100"></div>
                <div class="ai-pass-skel-line w-60"></div>
            </div>
            <div class="ai-pass-media-strip" data-ai-pass-media-strip></div>
            <div class="ai-pass-preview" data-ai-pass-preview></div>
            <div class="ai-pass-actions" data-ai-pass-actions>
                <button type="button" class="tb-btn ui-btn" data-ai-pass-close>Fermer</button>
                <button type="button" class="tb-btn ui-btn" data-ai-pass-skip>Passer cette étape</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-pass-retry>Relancer cette étape</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const statusEl = overlay.querySelector('[data-ai-pass-status]');
    const previewEl = overlay.querySelector('[data-ai-pass-preview]');
    const skeletonEl = overlay.querySelector('[data-ai-pass-skeleton]');
    const mediaStripEl = overlay.querySelector('[data-ai-pass-media-strip]');
    const actionsEl = overlay.querySelector('[data-ai-pass-actions]');
    const retryBtn = overlay.querySelector('[data-ai-pass-retry]');
    const closeBtn = overlay.querySelector('[data-ai-pass-close]');
    const skipBtn = overlay.querySelector('[data-ai-pass-skip]');
    let decisionResolver = null;
    let previewLog = [];
    const setStepState = (idx, state) => {
        const el = overlay.querySelector(`[data-pass-step="${idx}"]`);
        if (!el) return;
        el.classList.remove('is-active', 'is-done', 'is-error');
        if (state) el.classList.add(state);
    };
    const appendPreviewLine = (line) => {
        if (!previewEl) return;
        const text = String(line || '').trim();
        if (!text) return;
        previewLog.push(text);
        if (previewLog.length > 10) previewLog = previewLog.slice(-10);
        previewEl.textContent = previewLog.join('\n');
    };
    const clearMediaStrip = () => {
        if (!mediaStripEl) return;
        mediaStripEl.innerHTML = '';
        mediaStripEl.classList.remove('is-visible');
    };
    const appendMediaThumb = (src, label = '') => {
        if (!mediaStripEl) return;
        const safeSrc = _sanitizePreviewImageSrc(src);
        if (!safeSrc) return;
        const card = document.createElement('div');
        card.className = 'ai-pass-media-item';
        const img = document.createElement('img');
        img.className = 'ai-pass-media-thumb';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = safeSrc;
        img.alt = String(label || 'Illustration générée');
        card.appendChild(img);
        if (label) {
            const cap = document.createElement('div');
            cap.className = 'ai-pass-media-caption';
            cap.textContent = String(label);
            card.appendChild(cap);
        }
        mediaStripEl.appendChild(card);
        mediaStripEl.classList.add('is-visible');
        mediaStripEl.scrollLeft = mediaStripEl.scrollWidth;
    };
    const hideActions = () => {
        if (actionsEl) actionsEl.classList.remove('is-visible');
    };
    const resolveDecision = (decision) => {
        if (!decisionResolver) return;
        const resolver = decisionResolver;
        decisionResolver = null;
        hideActions();
        resolver(decision);
    };
    retryBtn?.addEventListener('click', () => resolveDecision('retry'));
    closeBtn?.addEventListener('click', () => resolveDecision('close'));
    skipBtn?.addEventListener('click', () => resolveDecision('skip'));
    return {
        setWaiting(idx, label) {
            for (let i = 1; i <= total; i++) {
                if (i < idx) setStepState(i, 'is-done');
                else if (i === idx) setStepState(i, 'is-active');
                else setStepState(i, '');
            }
            if (statusEl) statusEl.textContent = `${label} — génération en cours…`;
            previewLog = [];
            if (previewEl) previewEl.textContent = '';
            clearMediaStrip();
            if (skeletonEl) skeletonEl.classList.add('is-visible');
            hideActions();
        },
        setProgress(idx, label, detail = '') {
            if (idx > 0) setStepState(idx, 'is-active');
            if (statusEl) statusEl.textContent = `${label} — génération en cours…`;
            if (skeletonEl) skeletonEl.classList.add('is-visible');
            appendPreviewLine(detail);
            hideActions();
        },
        setDone(idx, previewText) {
            setStepState(idx, 'is-done');
            if (statusEl) statusEl.textContent = `Passe ${idx} terminée`;
            previewLog = [];
            if (previewEl) previewEl.textContent = _formatPassPreview(previewText, 240);
            if (skeletonEl) skeletonEl.classList.remove('is-visible');
            hideActions();
        },
        setError(idx, message) {
            if (idx > 0) setStepState(idx, 'is-error');
            if (statusEl) statusEl.textContent = 'Erreur pipeline IA';
            previewLog = [];
            if (previewEl) previewEl.textContent = String(message || 'Erreur inconnue');
            if (skeletonEl) skeletonEl.classList.remove('is-visible');
        },
        pushImage(idx, src, label = '') {
            if (idx > 0) setStepState(idx, 'is-active');
            appendMediaThumb(src, label);
        },
        promptRetry(idx, message, options = null) {
            const allowSkip = options && options.allowSkip === true;
            this.setError(idx, message);
            if (skipBtn) skipBtn.style.display = allowSkip ? '' : 'none';
            if (actionsEl) actionsEl.classList.add('is-visible');
            return new Promise((resolve) => {
                decisionResolver = resolve;
            });
        },
        close() {
            if (decisionResolver) {
                const resolver = decisionResolver;
                decisionResolver = null;
                resolver('close');
            }
            overlay.remove();
        },
    };
}

function _reviewAIPassOutput({ pass, title, content, hint, onRerun }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Validation passe IA">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Validation — Passe ${pass}: ${_escapeHtmlAi(title)}</h3>
                    <div class="ai-pass-review-hint">${_escapeHtmlAi(hint || 'Vérifie le contenu puis valide pour passer à l’étape suivante.')}</div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-title">Lecture guidée</div>
                    <div class="ai-pass-review-summary" data-ai-pass-summary></div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-head">
                        <div class="ai-pass-review-block-title">JSON de la passe (modifiable)</div>
                        <button type="button" class="tb-btn ui-btn ai-pass-json-toggle" data-ai-pass-toggle-json>Afficher JSON</button>
                    </div>
                    <div class="ai-pass-review-json-wrap is-collapsed" data-ai-pass-json-wrap>
                        <textarea class="ai-pass-review-text" spellcheck="false" data-ai-pass-raw>${_escapeHtmlAi(_stripCodeFences(content || ''))}</textarea>
                    </div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-title">Relance ciblée (optionnel)</div>
                    <textarea class="ai-pass-review-rerun" spellcheck="false" data-ai-pass-rerun-text placeholder="Ex: Réduis le texte des cartes, ajoute plus d'icônes SVG sur les slides 3 et 5, corrige les niveaux DigComp..."></textarea>
                    <div class="ai-pass-review-rerun-status" data-ai-pass-rerun-status></div>
                    <div class="ai-pass-skeleton ai-pass-review-skeleton" data-ai-pass-rerun-skeleton>
                        <div class="ai-pass-skel-line w-80"></div>
                        <div class="ai-pass-skel-line w-100"></div>
                        <div class="ai-pass-skel-line w-60"></div>
                    </div>
                </div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-ai-pass-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn" data-ai-pass-rerun-btn>Relancer cette passe</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-pass-validate>Valider la passe</button>
                </div>
            </div>
        `;
        const rawEl = overlay.querySelector('[data-ai-pass-raw]');
        const jsonWrapEl = overlay.querySelector('[data-ai-pass-json-wrap]');
        const toggleJsonBtn = overlay.querySelector('[data-ai-pass-toggle-json]');
        const summaryEl = overlay.querySelector('[data-ai-pass-summary]');
        const rerunEl = overlay.querySelector('[data-ai-pass-rerun-text]');
        const rerunStatusEl = overlay.querySelector('[data-ai-pass-rerun-status]');
        const rerunSkeletonEl = overlay.querySelector('[data-ai-pass-rerun-skeleton]');
        const rerunBtn = overlay.querySelector('[data-ai-pass-rerun-btn]');
        const validateBtn = overlay.querySelector('[data-ai-pass-validate]');
        const cancelBtn = overlay.querySelector('[data-ai-pass-cancel]');

        const setBusy = (busy) => {
            [rerunBtn, validateBtn, cancelBtn].forEach((btn) => {
                if (btn) btn.disabled = !!busy;
            });
            if (rerunSkeletonEl) rerunSkeletonEl.classList.toggle('is-visible', !!busy);
        };
        const setJsonCollapsed = (collapsed) => {
            if (jsonWrapEl) jsonWrapEl.classList.toggle('is-collapsed', !!collapsed);
            if (toggleJsonBtn) toggleJsonBtn.textContent = collapsed ? 'Afficher JSON' : 'Masquer JSON';
        };
        const refreshSummary = () => {
            if (!summaryEl || !rawEl) return;
            const parsed = _tryParseJsonLoose(rawEl.value);
            summaryEl.innerHTML = _renderPassSummaryHtml(pass, parsed, rawEl.value);
        };

        const close = (ok, text = '') => {
            overlay.remove();
            const parsed = _tryParseJsonLoose(text);
            resolve({ ok, text, parsed });
        };
        overlay.querySelector('[data-ai-pass-cancel]')?.addEventListener('click', () => close(false, ''));
        overlay.querySelector('[data-ai-pass-validate]')?.addEventListener('click', () => {
            const text = rawEl?.value || '';
            close(true, _stripCodeFences(text));
        });
        overlay.querySelector('[data-ai-pass-rerun-btn]')?.addEventListener('click', async () => {
            if (typeof onRerun !== 'function') return;
            const refinePrompt = String(rerunEl?.value || '').trim();
            if (!refinePrompt) {
                if (rerunStatusEl) rerunStatusEl.textContent = 'Ajoute une consigne pour relancer cette passe.';
                rerunEl?.focus();
                return;
            }
            try {
                if (rerunStatusEl) rerunStatusEl.textContent = 'Relance Gemini en cours…';
                setBusy(true);
                const next = await onRerun({
                    pass,
                    refinePrompt,
                    currentText: _stripCodeFences(rawEl?.value || ''),
                });
                if (rawEl) rawEl.value = _stripCodeFences(next || '');
                if (rerunStatusEl) rerunStatusEl.textContent = 'Relance terminée. Vérifie puis valide.';
                refreshSummary();
            } catch (err) {
                if (rerunStatusEl) rerunStatusEl.textContent = `Échec relance: ${err?.message || 'erreur inconnue'}`;
            } finally {
                setBusy(false);
            }
        });
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false, '');
        });
        toggleJsonBtn?.addEventListener('click', () => {
            const collapsed = jsonWrapEl?.classList.contains('is-collapsed');
            setJsonCollapsed(!collapsed);
            if (collapsed) rawEl?.focus();
        });
        document.body.appendChild(overlay);
        setJsonCollapsed(true);
        refreshSummary();
        overlay.querySelector('[data-ai-pass-raw]')?.addEventListener('input', refreshSummary);
        overlay.querySelector('[data-ai-pass-rerun-text]')?.focus();
    });
}

async function _runGeminiFivePassFlow({ brief, tuning, pipeline, gemini }) {
    if (!gemini?.apiKey) {
        notify('Clé API Gemini manquante', 'error');
        return;
    }
    if (!String(brief || '').trim()) {
        notify('Ajoute un brief pour lancer le pipeline IA', 'warning');
        return;
    }

    const runner = _createAIPassRunnerOverlay(5);
    const passNames = {
        1: 'Plan pédagogique',
        2: 'Composants visuels',
        3: 'JSON complet',
        4: 'Composants et lisibilité',
        5: 'Validation finale',
    };
    const isCancelledError = (err) => (
        err?.code === _AI_PASS_CANCELLED_CODE
        || err?.code === (window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED')
    );
    try {
        const promptTemplate = await _fetchAIPromptTemplate();
        const previous = {};
        let pass2SelectionMode = false;
        let pass2SelectedIllustrations = [];
        const runPass = async (pass, opts = {}) => {
            const prompt = _buildGeminiPassPrompt(pass, {
                brief,
                tuning,
                pipeline,
                previous,
                promptTemplate,
                refinePrompt: opts.refinePrompt || '',
                currentDraft: opts.currentDraft || '',
            });
            return _callGeminiGenerate({
                apiKey: gemini.apiKey,
                model: gemini.model,
                prompt,
                temperature: gemini.temperature,
                timeoutMs: gemini.requestTimeoutMs,
            });
        };
        const applyPass3MediaWithRecovery = async (jsonText) => {
            let draft = jsonText;
            while (true) {
                try {
                    const forceImageGeneration = AI_IMAGE_GENERATION_ENABLED && pipeline?.forceImageGeneration === true;
                    const forceAutoTargets = forceImageGeneration && pass2SelectionMode && !pass2SelectedIllustrations.length;
                    if (pass2SelectionMode && !pass2SelectedIllustrations.length && !forceImageGeneration) {
                        return draft;
                    }
                    const pass2Pool = pass2SelectionMode
                        ? pass2SelectedIllustrations
                        : _normalizePass2Illustrations(previous.pass2 || '').map((it) => ({ ...it.raw, slide: it.slide, slideIndex: it.slideIndex }));
                    const mediaRes = await _materializePass3ImagesOneByOne({
                        outputText: draft,
                        pass2Illustrations: pass2Pool,
                        brief,
                        tuning,
                        pipeline,
                        gemini,
                        runner,
                        pass: 3,
                        strictSelection: pass2SelectionMode && !forceAutoTargets,
                    });
                    if (Array.isArray(mediaRes.generatedItems) && mediaRes.generatedItems.length) {
                        const keep = await _reviewPass3GeneratedImagesChoice(mediaRes.generatedItems);
                        if (!keep.ok) throw _makeAIPassCancelledError('pass-3-keep-selection');
                        const kept = new Set(keep.keptIds || []);
                        mediaRes.generatedItems.forEach((item) => {
                            if (!kept.has(item.id)) {
                                item.slot.owner[item.slot.key] = item.beforeSrc;
                                if (item.slot.altOwner && item.slot.altKey) item.slot.altOwner[item.slot.altKey] = item.beforeAlt;
                            }
                        });
                        if (mediaRes.payload?.mediaReport && typeof mediaRes.payload.mediaReport === 'object') {
                            mediaRes.payload.mediaReport.kept = kept.size;
                        }
                    }
                    return mediaRes.payload
                        ? (_stringifyPrettyJson(mediaRes.payload) || mediaRes.text || draft)
                        : (mediaRes.text || draft);
                } catch (err) {
                    if (err?.code === _AI_PASS_CANCELLED_CODE) throw err;
                    const action = await runner.promptRetry(3, `Erreur passe 3 (placeholders visuels): ${err?.message || 'erreur inconnue'}`, { allowSkip: true });
                    if (action === 'retry') {
                        notify('Relance de la génération des placeholders…', 'info');
                        continue;
                    }
                    if (action === 'skip') {
                        notify('Génération des placeholders ignorée pour cette passe', 'warning');
                        return draft;
                    }
                    throw _makeAIPassCancelledError('pass-3-media-closed');
                }
            }
        };

        for (let pass = 1; pass <= 5; pass++) {
            const passTitle = passNames[pass] || `Passe ${pass}`;
            let done = false;
            while (!done) {
                try {
                    runner.setWaiting(pass, passTitle);
                    let output = await runPass(pass);
                    if (pass === 3) {
                        output = await applyPass3MediaWithRecovery(output);
                    }
                    runner.setDone(pass, _formatRunnerPreview(pass, output));
                    const review = await _reviewAIPassOutput({
                        pass,
                        title: passTitle,
                        content: output,
                        hint: pass >= 3 ? 'Le contenu doit rester du JSON valide.' : 'Tu peux ajuster le contenu avant de poursuivre.',
                        onRerun: async ({ refinePrompt, currentText }) => {
                            runner.setWaiting(pass, `${passTitle} (relance)`);
                            let next = await runPass(pass, { refinePrompt, currentDraft: currentText });
                            if (pass === 3) {
                                next = await applyPass3MediaWithRecovery(next);
                            }
                            runner.setDone(pass, _formatRunnerPreview(pass, next));
                            return next;
                        },
                    });
                    if (!review.ok) throw _makeAIPassCancelledError(`pass-${pass}`);
                    previous[`pass${pass}`] = review.text;
                    if (pass === 2) {
                        const items = _normalizePass2Illustrations(review.text);
                        if (items.length) {
                            const choice = await _reviewPass2IllustrationsChoice(items);
                            if (!choice.ok) throw _makeAIPassCancelledError('pass-2-selection');
                            const selected = new Set(choice.selectedIds || []);
                            pass2SelectionMode = true;
                            pass2SelectedIllustrations = items
                                .filter((it) => selected.has(it.id))
                                .map((it) => ({ ...it.raw, slide: it.slide, slideIndex: it.slideIndex }));
                            previous.pass2Selected = _stringifyPrettyJson({ illustrations: pass2SelectedIllustrations });
                            notify(`Illustrations sélectionnées pour placeholders: ${pass2SelectedIllustrations.length}/${items.length}`, 'info');
                        } else {
                            pass2SelectionMode = true;
                            pass2SelectedIllustrations = [];
                            previous.pass2Selected = _stringifyPrettyJson({ illustrations: [] });
                            notify('Aucune image prévue: aucun placeholder ajouté en passe 3.', 'info');
                        }
                    }
                    done = true;
                } catch (err) {
                    if (isCancelledError(err)) {
                        notify('Pipeline IA annulé', 'info');
                        return;
                    }
                    const message = `Erreur passe ${pass}: ${err?.message || 'erreur inconnue'}`;
                    console.error('[AI Gemini] pass failed', { pass, err });
                    const action = await runner.promptRetry(pass, message);
                    if (action === 'retry') {
                        notify(`Relance de la passe ${pass}…`, 'info');
                        continue;
                    }
                    notify(message, 'error');
                    return;
                }
            }
        }

        while (true) {
            try {
                runner.setWaiting(5, 'Préparation import');
                let finalJson = _extractPresentationFromPass(5, previous.pass5 || '');
                if (!finalJson) finalJson = _extractPresentationFromPass(4, previous.pass4 || '');
                if (!finalJson) finalJson = _extractPresentationFromPass(3, previous.pass3 || '');
                if (!finalJson) throw new Error('Impossible d’extraire un JSON PresentaForge depuis les passes 3/4/5.');

                runner.setWaiting(5, 'Import local');
                if (!window.OEIImportPipeline?.importFromText) throw new Error('Pipeline d’import local indisponible');
                const result = await window.OEIImportPipeline.importFromText(finalJson, {
                    pipelineSettings: {
                        ...pipeline,
                        // Les 5 passes Gemini sont déjà validées côté utilisateur.
                        // On évite de réouvrir une seconde série de modales de validation.
                        stepValidation: false,
                    },
                });
                const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: `Gemini ${gemini.model}` });
                if (!ok) throw _makeAIPassCancelledError('import-final');
                editor.load(result.data);
                notify(`Pipeline Gemini terminé (${gemini.model})`, 'success');
                break;
            } catch (err) {
                if (isCancelledError(err)) {
                    notify('Pipeline IA annulé', 'info');
                    return;
                }
                const message = `Erreur import final: ${err?.message || 'erreur inconnue'}`;
                console.error('[AI Gemini] import failed', err);
                const action = await runner.promptRetry(5, message);
                if (action === 'retry') {
                    notify('Relance de l’import final…', 'info');
                    continue;
                }
                notify(message, 'error');
                return;
            }
        }
    } finally {
        runner.close();
    }
}

function _openAIPromptTuningModal() {
    const tuning = getAIPromptTuningSettings();
    const pipeline = getAIImportPipelineSettings();
    const gemini = getAIGeminiSettings();
    const imageGenDisabled = !AI_IMAGE_GENERATION_ENABLED;
    const imageGenDisabledAttr = imageGenDisabled ? 'disabled' : '';
    const modelOptions = AI_GEMINI_MODELS
        .map((model) => `<option value="${model}" ${gemini.model === model ? 'selected' : ''}>${model}</option>`)
        .join('');
    const imageModelOptions = AI_GEMINI_IMAGE_MODELS
        .map((model) => `<option value="${model}" ${gemini.imageModel === model ? 'selected' : ''}>${model}</option>`)
        .join('');
    const overlay = document.createElement('div');
    overlay.className = 'ai-tuning-overlay';
    overlay.innerHTML = `
        <div class="ai-tuning-modal" role="dialog" aria-modal="true" aria-label="Réglages IA">
            <div class="ai-tuning-head">
                <div>
                    <h3 class="ai-tuning-title">Réglages IA</h3>
                    <p class="ai-tuning-subtitle">Tune les 5 passes (plan, placeholders visuels, JSON, base64, validation).</p>
                </div>
                <button type="button" class="ai-tuning-close" data-ai-close>✕</button>
            </div>
            <div class="ai-tuning-grid">
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-target-slides">Slides visés</label>
                    <input class="ai-tuning-input ui-input" id="ai-target-slides" type="number" min="4" max="120" value="${tuning.targetSlides}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-duration-minutes">Durée (min)</label>
                    <input class="ai-tuning-input ui-input" id="ai-duration-minutes" type="number" min="5" max="720" value="${tuning.durationMinutes}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-visual-density">Densité visuelle</label>
                    <select class="ai-tuning-select ui-select" id="ai-visual-density">
                        <option value="low" ${tuning.visualDensity === 'low' ? 'selected' : ''}>Faible</option>
                        <option value="balanced" ${tuning.visualDensity === 'balanced' ? 'selected' : ''}>Équilibrée</option>
                        <option value="high" ${tuning.visualDensity === 'high' ? 'selected' : ''}>Élevée</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-image-style">Style illustrations</label>
                    <select class="ai-tuning-select ui-select" id="ai-image-style">
                        <option value="mixte" ${tuning.imageStyle === 'mixte' ? 'selected' : ''}>Mixte</option>
                        <option value="icones" ${tuning.imageStyle === 'icones' ? 'selected' : ''}>Icônes SVG</option>
                        <option value="infographie" ${tuning.imageStyle === 'infographie' ? 'selected' : ''}>Infographie</option>
                        <option value="photo" ${tuning.imageStyle === 'photo' ? 'selected' : ''}>Photo</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-mode">Mode quiz interactifs</label>
                    <select class="ai-tuning-select ui-select" id="ai-quiz-mode">
                        <option value="auto-frequency" ${tuning.quizMode === 'auto-frequency' ? 'selected' : ''}>Auto (via fréquence)</option>
                        <option value="every-n" ${tuning.quizMode === 'every-n' ? 'selected' : ''}>Toutes les X diapos</option>
                        <option value="section-end" ${tuning.quizMode === 'section-end' ? 'selected' : ''}>Fin de chaque partie</option>
                        <option value="hybrid" ${tuning.quizMode === 'hybrid' ? 'selected' : ''}>Hybride (X + fin partie)</option>
                        <option value="none" ${tuning.quizMode === 'none' ? 'selected' : ''}>Désactivé</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-every">Quiz toutes les X slides</label>
                    <input class="ai-tuning-input ui-input" id="ai-quiz-every" type="number" min="2" max="20" value="${tuning.quizEverySlides}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-frequency">Fréquence quiz</label>
                    <select class="ai-tuning-select ui-select" id="ai-quiz-frequency">
                        <option value="none" ${tuning.quizFrequency === 'none' ? 'selected' : ''}>Aucun</option>
                        <option value="rare" ${tuning.quizFrequency === 'rare' ? 'selected' : ''}>Rare</option>
                        <option value="section" ${tuning.quizFrequency === 'section' ? 'selected' : ''}>Fin section</option>
                        <option value="regular" ${tuning.quizFrequency === 'regular' ? 'selected' : ''}>Régulier</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-course-type">Type de cours</label>
                    <select class="ai-tuning-select ui-select" id="ai-course-type">
                        <option value="CM" ${tuning.courseType === 'CM' ? 'selected' : ''}>CM</option>
                        <option value="TD" ${tuning.courseType === 'TD' ? 'selected' : ''}>TD</option>
                        <option value="TP" ${tuning.courseType === 'TP' ? 'selected' : ''}>TP</option>
                        <option value="Autre" ${tuning.courseType === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-audience">Public cible</label>
                    <input class="ai-tuning-input ui-input" id="ai-audience" type="text" maxlength="180" value="${esc(tuning.audience)}">
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-student-profile">Profil étudiants</label>
                    <input class="ai-tuning-input ui-input" id="ai-student-profile" type="text" maxlength="240" value="${esc(tuning.studentProfile)}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-base64-mode">Base64 local</label>
                    <select class="ai-tuning-select ui-select" id="ai-base64-mode">
                        <option value="none" ${pipeline.base64Mode === 'none' ? 'selected' : ''}>Désactivé</option>
                        <option value="icons-only" ${pipeline.base64Mode === 'icons-only' ? 'selected' : ''}>Icônes/SVG</option>
                        <option value="all" ${pipeline.base64Mode === 'all' ? 'selected' : ''}>Toutes images</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-timeout-ms">Timeout média / images (ms)</label>
                    <input class="ai-tuning-input ui-input" id="ai-timeout-ms" type="number" min="1000" max="300000" value="${pipeline.timeoutMs}" ${imageGenDisabledAttr}>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-max-illustrations">Max illustrations auto</label>
                    <input class="ai-tuning-input ui-input" id="ai-max-illustrations" type="number" min="0" max="60" value="${pipeline.maxIllustrations}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Options pipeline</label>
                    <label class="ai-tuning-check"><input id="ai-auto-inject" type="checkbox" ${pipeline.autoInjectIllustrations ? 'checked' : ''}> Auto-injection d'illustrations</label>
                    <label class="ai-tuning-check"><input id="ai-force-images" type="checkbox" ${pipeline.forceImageGeneration ? 'checked' : ''} ${imageGenDisabledAttr}> Forcer génération d'images (test)</label>
                    ${imageGenDisabled ? '<div class="ai-tuning-help">La génération d’images est temporairement désactivée. Le pipeline insère des placeholders visuels adaptatifs.</div>' : ''}
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Options réseau</label>
                    <label class="ai-tuning-check"><input id="ai-fetch-remote" type="checkbox" ${pipeline.fetchRemoteImages ? 'checked' : ''}> Convertir les URLs HTTP(S)</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation par étape</label>
                    <label class="ai-tuning-check"><input id="ai-step-validation" type="checkbox" ${pipeline.stepValidation ? 'checked' : ''}> Confirmer chaque passe IA locale</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation</label>
                    <label class="ai-tuning-check"><input id="ai-strict-json" type="checkbox" ${tuning.strictJsonOnly ? 'checked' : ''}> JSON uniquement</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation schéma</label>
                    <label class="ai-tuning-check"><input id="ai-strict-schema" type="checkbox" ${tuning.strictSchema ? 'checked' : ''}> Schéma strict</label>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label">Gemini — connexion</label>
                    <div class="ai-tuning-help">La clé API est stockée localement sur cette machine (localStorage).</div>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-gemini-key">Clé API Gemini</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-key" type="password" autocomplete="off" placeholder="AIza..." value="${esc(gemini.apiKey)}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-model">Modèle Gemini</label>
                    <select class="ai-tuning-select ui-select" id="ai-gemini-model">${modelOptions}</select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-image-model">Modèle Gemini (passe images/SVG)</label>
                    <select class="ai-tuning-select ui-select" id="ai-gemini-image-model" ${imageGenDisabledAttr}>${imageModelOptions}</select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-timeout">Timeout Gemini (ms)</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-timeout" type="number" min="5000" max="300000" value="${gemini.requestTimeoutMs}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-temperature">Température</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-temperature" type="number" min="0" max="1.5" step="0.1" value="${gemini.temperature}">
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-gemini-brief">Brief de génération (pipeline 5 passes)</label>
                    <textarea class="ai-tuning-input ui-textarea ai-tuning-textarea" id="ai-gemini-brief" rows="5" placeholder="Sujet, public, objectifs, contraintes, style...">${esc(gemini.briefTemplate)}</textarea>
                    <div class="ai-tuning-help">Ce brief sera enrichi avec le contexte éditeur + règles de génération, puis envoyé à Gemini sur 5 passes avec validation humaine à chaque étape.</div>
                </div>
            </div>
            <div class="ai-tuning-actions">
                <button type="button" class="tb-btn ui-btn" data-ai-reset>Réinitialiser</button>
                <button type="button" class="tb-btn ui-btn" data-ai-cancel>Annuler</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-save>Enregistrer</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-run-quiz-augment>Ajouter des quiz aux slides courantes</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-run>Lancer pipeline Gemini (5 passes)</button>
            </div>
        </div>
    `;

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);
    };
    const onKeydown = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });

    const syncQuizModeControls = () => {
        const modeEl = overlay.querySelector('#ai-quiz-mode');
        const freqEl = overlay.querySelector('#ai-quiz-frequency');
        const everyEl = overlay.querySelector('#ai-quiz-every');
        const mode = String(modeEl?.value || 'auto-frequency');
        if (freqEl) {
            const disableFreq = mode !== 'auto-frequency';
            freqEl.disabled = disableFreq;
            freqEl.style.opacity = disableFreq ? '0.65' : '1';
        }
        if (everyEl) {
            const disableEvery = !(mode === 'every-n' || mode === 'hybrid');
            everyEl.disabled = disableEvery;
            everyEl.style.opacity = disableEvery ? '0.65' : '1';
        }
    };
    overlay.querySelector('#ai-quiz-mode')?.addEventListener('change', syncQuizModeControls);
    syncQuizModeControls();

    const readValues = () => ({
        tuning: _sanitizeAIPromptTuningSettings({
            targetSlides: Number(overlay.querySelector('#ai-target-slides')?.value),
            durationMinutes: Number(overlay.querySelector('#ai-duration-minutes')?.value),
            visualDensity: overlay.querySelector('#ai-visual-density')?.value,
            imageStyle: overlay.querySelector('#ai-image-style')?.value,
            quizMode: overlay.querySelector('#ai-quiz-mode')?.value,
            quizEverySlides: Number(overlay.querySelector('#ai-quiz-every')?.value),
            quizFrequency: overlay.querySelector('#ai-quiz-frequency')?.value,
            courseType: overlay.querySelector('#ai-course-type')?.value,
            audience: overlay.querySelector('#ai-audience')?.value,
            studentProfile: overlay.querySelector('#ai-student-profile')?.value,
            strictJsonOnly: overlay.querySelector('#ai-strict-json')?.checked,
            strictSchema: overlay.querySelector('#ai-strict-schema')?.checked,
        }),
        pipeline: _sanitizeAIImportPipelineSettings({
            base64Mode: overlay.querySelector('#ai-base64-mode')?.value,
            timeoutMs: Number(overlay.querySelector('#ai-timeout-ms')?.value),
            maxIllustrations: Number(overlay.querySelector('#ai-max-illustrations')?.value),
            autoInjectIllustrations: overlay.querySelector('#ai-auto-inject')?.checked,
            forceImageGeneration: AI_IMAGE_GENERATION_ENABLED ? overlay.querySelector('#ai-force-images')?.checked : false,
            fetchRemoteImages: overlay.querySelector('#ai-fetch-remote')?.checked,
            stepValidation: overlay.querySelector('#ai-step-validation')?.checked,
        }),
        gemini: _sanitizeAIGeminiSettings({
            apiKey: overlay.querySelector('#ai-gemini-key')?.value,
            model: overlay.querySelector('#ai-gemini-model')?.value,
            imageModel: AI_IMAGE_GENERATION_ENABLED
                ? overlay.querySelector('#ai-gemini-image-model')?.value
                : (overlay.querySelector('#ai-gemini-model')?.value || gemini.model),
            requestTimeoutMs: Number(overlay.querySelector('#ai-gemini-timeout')?.value),
            temperature: Number(overlay.querySelector('#ai-gemini-temperature')?.value),
            briefTemplate: overlay.querySelector('#ai-gemini-brief')?.value,
        }),
    });

    overlay.querySelector('[data-ai-close]')?.addEventListener('click', close);
    overlay.querySelector('[data-ai-cancel]')?.addEventListener('click', close);
    overlay.querySelector('[data-ai-reset]')?.addEventListener('click', () => {
        setAIPromptTuningSettings(AI_PROMPT_DEFAULTS);
        setAIImportPipelineSettings(AI_IMPORT_PIPELINE_DEFAULTS);
        setAIGeminiSettings(AI_GEMINI_DEFAULTS);
        close();
        notify('Réglages IA réinitialisés', 'info');
    });
    overlay.querySelector('[data-ai-save]')?.addEventListener('click', () => {
        const values = readValues();
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        notify('Réglages IA enregistrés', 'success');
    });
    overlay.querySelector('[data-ai-run]')?.addEventListener('click', async () => {
        const values = readValues();
        if (!values.gemini.apiKey) {
            notify('Ajoute d’abord la clé API Gemini', 'warning');
            overlay.querySelector('#ai-gemini-key')?.focus();
            return;
        }
        if (!String(values.gemini.briefTemplate || '').trim()) {
            notify('Ajoute un brief de génération', 'warning');
            overlay.querySelector('#ai-gemini-brief')?.focus();
            return;
        }
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        await _runGeminiFivePassFlow({
            brief: values.gemini.briefTemplate,
            tuning: values.tuning,
            pipeline: values.pipeline,
            gemini: values.gemini,
        });
    });
    overlay.querySelector('[data-ai-run-quiz-augment]')?.addEventListener('click', async () => {
        const values = readValues();
        if (!values.gemini.apiKey) {
            notify('Ajoute d’abord la clé API Gemini', 'warning');
            overlay.querySelector('#ai-gemini-key')?.focus();
            return;
        }
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        await _runGeminiQuizAugmentFlow({
            tuning: values.tuning,
            gemini: values.gemini,
        });
    });

    document.body.appendChild(overlay);
    overlay.querySelector('#ai-target-slides')?.focus();
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
        return _openAIPromptTuningModal();
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
        normalizeQuizAugmentPlan: _normalizeQuizAugmentPlan,
        sanitizePreviewImageSrc: _sanitizePreviewImageSrc,
        extractPresentationFromPass: _extractPresentationFromPass,
    });

    root.OEIEditorAIPipeline = Object.freeze({
        openAIPromptTuningModal,
        copyPromptToClipboard: copyAIPromptToClipboard,
        bindToolbarAIButtons,
        testUtils,
    });
})(window);
