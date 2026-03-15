/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-ai-settings
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-ai-settings.js"></script>
 */
/* editor-ai-settings.js — AI settings persistence/sanitization for slide editor */
(function initEditorAISettingsModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const storage = root.OEIStorage || null;
    const AI_PROMPT_TUNING_KEY = storage?.KEYS?.AI_PROMPT_TUNING || 'oei-ai-prompt-tuning';
    const AI_IMPORT_PIPELINE_KEY = storage?.KEYS?.AI_IMPORT_PIPELINE || 'oei-ai-import-pipeline';
    const AI_GEMINI_SETTINGS_KEY = storage?.KEYS?.AI_GEMINI_SETTINGS || 'oei-ai-gemini-settings';
    const AI_IMAGE_GENERATION_ENABLED = false;

    const AI_PROMPT_DEFAULTS = Object.freeze({
        targetSlides: 16,
        visualDensity: 'high',
        imageStyle: 'mixte',
        quizMode: 'auto-frequency',
        quizEverySlides: 6,
        quizFrequency: 'section',
        audience: 'Étudiants de licence',
        courseType: 'CM',
        studentProfile: '',
        durationMinutes: 90,
        strictJsonOnly: true,
        strictSchema: true,
    });

    const AI_IMPORT_PIPELINE_DEFAULTS = Object.freeze({
        base64Mode: 'icons-only',
        autoInjectIllustrations: true,
        fetchRemoteImages: false,
        stepValidation: false,
        forceImageGeneration: false,
        timeoutMs: 60000,
        maxIllustrations: 14,
    });

    const AI_GEMINI_MODELS = Object.freeze([
        'gemini-3-flash-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
    ]);
    const AI_GEMINI_IMAGE_MODELS = AI_GEMINI_MODELS;

    const AI_GEMINI_DEFAULTS = Object.freeze({
        apiKey: '',
        model: 'gemini-2.5-flash',
        imageModel: 'gemini-2.5-flash',
        requestTimeoutMs: 90000,
        temperature: 0.3,
        briefTemplate: 'Génère un cours structuré, progressif et très visuel sur le sujet suivant.',
    });

    const _readJSON = (key, fallback = null) => {
        if (!key) return fallback;
        if (storage?.getJSON) return storage.getJSON(key, fallback);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    };

    const _writeJSON = (key, value) => {
        if (!key) return false;
        if (storage?.setJSON) return storage.setJSON(key, value);
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    };

    function _sanitizeAIPromptTuningSettings(raw = {}) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const toInt = (value, fallback, min, max) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return fallback;
            return Math.max(min, Math.min(max, Math.trunc(n)));
        };
        const visualDensity = ['low', 'balanced', 'high'].includes(src.visualDensity)
            ? src.visualDensity
            : AI_PROMPT_DEFAULTS.visualDensity;
        const imageStyle = ['photo', 'icones', 'infographie', 'mixte'].includes(src.imageStyle)
            ? src.imageStyle
            : AI_PROMPT_DEFAULTS.imageStyle;
        const quizFrequency = ['none', 'rare', 'section', 'regular'].includes(src.quizFrequency)
            ? src.quizFrequency
            : AI_PROMPT_DEFAULTS.quizFrequency;
        let quizMode = ['auto-frequency', 'none', 'every-n', 'section-end', 'hybrid'].includes(src.quizMode)
            ? src.quizMode
            : AI_PROMPT_DEFAULTS.quizMode;
        if (!src.quizMode && quizFrequency === 'none') quizMode = 'none';
        const courseType = ['CM', 'TD', 'TP', 'Autre'].includes(src.courseType)
            ? src.courseType
            : AI_PROMPT_DEFAULTS.courseType;
        return {
            targetSlides: toInt(src.targetSlides, AI_PROMPT_DEFAULTS.targetSlides, 4, 120),
            visualDensity,
            imageStyle,
            quizMode,
            quizEverySlides: toInt(src.quizEverySlides, AI_PROMPT_DEFAULTS.quizEverySlides, 2, 20),
            quizFrequency,
            audience: String(src.audience || AI_PROMPT_DEFAULTS.audience).trim().slice(0, 180),
            courseType,
            studentProfile: String(src.studentProfile || '').trim().slice(0, 240),
            durationMinutes: toInt(src.durationMinutes, AI_PROMPT_DEFAULTS.durationMinutes, 5, 720),
            strictJsonOnly: src.strictJsonOnly !== false,
            strictSchema: src.strictSchema !== false,
        };
    }

    function _sanitizeAIImportPipelineSettings(raw = {}) {
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
            forceImageGeneration: AI_IMAGE_GENERATION_ENABLED ? (src.forceImageGeneration === true) : false,
            timeoutMs: toInt(src.timeoutMs, AI_IMPORT_PIPELINE_DEFAULTS.timeoutMs, 1000, 300000),
            maxIllustrations: toInt(src.maxIllustrations, AI_IMPORT_PIPELINE_DEFAULTS.maxIllustrations, 0, 60),
        };
    }

    function _sanitizeAIGeminiSettings(raw = {}) {
        const src = (raw && typeof raw === 'object') ? raw : {};
        const model = AI_GEMINI_MODELS.includes(String(src.model || ''))
            ? String(src.model)
            : AI_GEMINI_DEFAULTS.model;
        const rawImageModel = String(src.imageModel || '').trim();
        const imageModel = AI_GEMINI_IMAGE_MODELS.includes(rawImageModel)
            ? rawImageModel
            : AI_GEMINI_DEFAULTS.imageModel;
        const timeout = Number(src.requestTimeoutMs);
        const temp = Number(src.temperature);
        return {
            apiKey: String(src.apiKey || '').trim(),
            model,
            imageModel,
            requestTimeoutMs: Number.isFinite(timeout)
                ? Math.max(5000, Math.min(300000, Math.trunc(timeout)))
                : AI_GEMINI_DEFAULTS.requestTimeoutMs,
            temperature: Number.isFinite(temp)
                ? Math.max(0, Math.min(1.5, temp))
                : AI_GEMINI_DEFAULTS.temperature,
            briefTemplate: String(src.briefTemplate || AI_GEMINI_DEFAULTS.briefTemplate).trim().slice(0, 500),
        };
    }

    function getAIPromptTuningSettings() {
        return _sanitizeAIPromptTuningSettings(_readJSON(AI_PROMPT_TUNING_KEY, AI_PROMPT_DEFAULTS));
    }

    function setAIPromptTuningSettings(next = {}) {
        const current = getAIPromptTuningSettings();
        const merged = _sanitizeAIPromptTuningSettings({ ...current, ...(next || {}) });
        _writeJSON(AI_PROMPT_TUNING_KEY, merged);
        return merged;
    }

    function getAIImportPipelineSettings() {
        return _sanitizeAIImportPipelineSettings(_readJSON(AI_IMPORT_PIPELINE_KEY, AI_IMPORT_PIPELINE_DEFAULTS));
    }

    function setAIImportPipelineSettings(next = {}) {
        const current = getAIImportPipelineSettings();
        const merged = _sanitizeAIImportPipelineSettings({ ...current, ...(next || {}) });
        _writeJSON(AI_IMPORT_PIPELINE_KEY, merged);
        return merged;
    }

    function getAIGeminiSettings() {
        return _sanitizeAIGeminiSettings(_readJSON(AI_GEMINI_SETTINGS_KEY, AI_GEMINI_DEFAULTS));
    }

    function setAIGeminiSettings(next = {}) {
        const current = getAIGeminiSettings();
        const merged = _sanitizeAIGeminiSettings({ ...current, ...(next || {}) });
        _writeJSON(AI_GEMINI_SETTINGS_KEY, merged);
        return merged;
    }

    const api = Object.freeze({
        AI_IMAGE_GENERATION_ENABLED,
        AI_PROMPT_DEFAULTS,
        AI_IMPORT_PIPELINE_DEFAULTS,
        AI_GEMINI_MODELS,
        AI_GEMINI_IMAGE_MODELS,
        AI_GEMINI_DEFAULTS,
        sanitizeAIPromptTuningSettings: _sanitizeAIPromptTuningSettings,
        sanitizeAIImportPipelineSettings: _sanitizeAIImportPipelineSettings,
        sanitizeAIGeminiSettings: _sanitizeAIGeminiSettings,
        getAIPromptTuningSettings,
        setAIPromptTuningSettings,
        getAIImportPipelineSettings,
        setAIImportPipelineSettings,
        getAIGeminiSettings,
        setAIGeminiSettings,
    });

    root.OEIEditorAISettings = api;

    // Legacy global aliases kept for incremental migration.
    root.getAIPromptTuningSettings = getAIPromptTuningSettings;
    root.setAIPromptTuningSettings = setAIPromptTuningSettings;
    root.getAIImportPipelineSettings = getAIImportPipelineSettings;
    root.setAIImportPipelineSettings = setAIImportPipelineSettings;
    root.getAIGeminiSettings = getAIGeminiSettings;
    root.setAIGeminiSettings = setAIGeminiSettings;
})(window);
