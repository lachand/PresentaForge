/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/storage
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/storage.js"></script>
 */
/* storage.js — centralized storage keys + lightweight migration helpers */
(function initOEIStorage(global) {
    'use strict';

    if (global.OEIStorage) return;

    const VERSION = 'v2';
    const PREFIX = `oei-${VERSION}`;
    const LEGACY_V1_PREFIX = 'oei-v1';

    const KEYS = Object.freeze({
        PRESENT_DATA: `${PREFIX}-slide-present-data`,
        SLIDE_DRAFT: `${PREFIX}-slide-draft`,
        SLIDE_WORKDOCS: `${PREFIX}-slide-workdocs`,
        RECENT_PRESENTATIONS: `${PREFIX}-recent-presentations`,
        SLIDE_THEMES: `${PREFIX}-slide-themes`,
        UI_MODE: `${PREFIX}-ui-mode`,
        EDITOR_THEME: `${PREFIX}-editor-theme`,
        EDITOR_PANEL_SIZES: `${PREFIX}-editor-panel-sizes`,
        LAST_ROOM_ID: `${PREFIX}-last-room-id`,
        PRESENTER_THEME: `${PREFIX}-presenter-theme`,
        PRESENTER_SESSION: `${PREFIX}-presenter-session`,
        PRESENTER_LAYOUT: `${PREFIX}-presenter-layout`,
        PRESENTER_ANNOTATIONS: `${PREFIX}-presenter-annotations`,
        STUDENT_THEME: `${PREFIX}-student-theme`,
        SLIDE_NARRATION_SETTINGS: `${PREFIX}-slide-narration-settings`,
        SLIDE_LIBRARY: `${PREFIX}-slide-library`,
        REVISIONS_DB: `${PREFIX}-slides-revisions`,
        MEDIA_PIPELINE_SETTINGS: `${PREFIX}-media-pipeline-settings`,
        AI_PROMPT_TUNING: `${PREFIX}-ai-prompt-tuning`,
        AI_IMPORT_PIPELINE: `${PREFIX}-ai-import-pipeline`,
        AI_GEMINI_SETTINGS: `${PREFIX}-ai-gemini-settings`,
        REMOTE_CONTROL_CONFIG: `${PREFIX}-remote-control-config`,
        WIDGET_PLUGINS: `${PREFIX}-widget-plugins`,
        WIDGET_PLUGIN_POLICY: `${PREFIX}-widget-plugin-policy`,
    });

    const LEGACY_KEYS = Object.freeze({
        [KEYS.PRESENT_DATA]: 'oei-slide-present-data',
        [KEYS.SLIDE_DRAFT]: 'oei-slide-draft',
        [KEYS.SLIDE_WORKDOCS]: 'oei-slide-workdocs',
        [KEYS.RECENT_PRESENTATIONS]: 'oei-recent-presentations',
        [KEYS.SLIDE_THEMES]: 'oei-slide-themes',
        [KEYS.UI_MODE]: 'oei-ui-mode',
        [KEYS.EDITOR_THEME]: 'oei-editor-theme',
        [KEYS.EDITOR_PANEL_SIZES]: 'oei-editor-panel-sizes',
        [KEYS.LAST_ROOM_ID]: 'oei-last-room-id',
        [KEYS.PRESENTER_THEME]: 'oei-presenter-theme',
        [KEYS.PRESENTER_SESSION]: 'oei-presenter-session',
        [KEYS.PRESENTER_LAYOUT]: 'oei-presenter-layout',
        [KEYS.PRESENTER_ANNOTATIONS]: 'oei-presenter-annotations',
        [KEYS.STUDENT_THEME]: 'oei-student-theme',
        [KEYS.SLIDE_NARRATION_SETTINGS]: 'oei-slide-narration-settings',
        [KEYS.SLIDE_LIBRARY]: 'oei-slide-library',
        [KEYS.REVISIONS_DB]: 'oei-slides-revisions',
        [KEYS.MEDIA_PIPELINE_SETTINGS]: 'oei-media-pipeline-settings',
        [KEYS.AI_PROMPT_TUNING]: 'oei-ai-prompt-tuning',
        [KEYS.AI_IMPORT_PIPELINE]: 'oei-ai-import-pipeline',
        [KEYS.AI_GEMINI_SETTINGS]: 'oei-ai-gemini-settings',
        [KEYS.REMOTE_CONTROL_CONFIG]: 'oei-remote-control-config',
        [KEYS.WIDGET_PLUGINS]: 'oei-widget-plugins',
        [KEYS.WIDGET_PLUGIN_POLICY]: 'oei-widget-plugin-policy',
    });

    const CHANNELS = Object.freeze({
        PRESENTER_SYNC: 'oei-slides-presenter-sync',
    });

    const STUDENT_ROOM_PREFIX = `${PREFIX}-student-room-`;
    const STUDENT_SCORE_PREFIX = `${PREFIX}-student-score-`;
    const STUDENT_NOTES_PREFIX = `${PREFIX}-student-notes-`;
    const PRESENTER_ANNOTATIONS_PREFIX = `${PREFIX}-presenter-annotations-`;
    const REMOTE_CONTROL_PREFIX = `${PREFIX}-remote-control-`;
    const V1_STUDENT_ROOM_PREFIX = `${LEGACY_V1_PREFIX}-student-room-`;
    const V1_STUDENT_SCORE_PREFIX = `${LEGACY_V1_PREFIX}-student-score-`;
    const V1_STUDENT_NOTES_PREFIX = `${LEGACY_V1_PREFIX}-student-notes-`;
    const V1_PRESENTER_ANNOTATIONS_PREFIX = `${LEGACY_V1_PREFIX}-presenter-annotations-`;
    const V1_REMOTE_CONTROL_PREFIX = `${LEGACY_V1_PREFIX}-remote-control-`;
    const LEGACY_STUDENT_ROOM_PREFIX = 'oei-student-room-';
    const LEGACY_STUDENT_SCORE_PREFIX = 'oei-student-score-';
    const LEGACY_STUDENT_NOTES_PREFIX = 'oei-student-notes-';
    const LEGACY_PRESENTER_ANNOTATIONS_PREFIX = 'oei-presenter-annotations-';
    const LEGACY_REMOTE_CONTROL_PREFIX = 'oei-remote-control-';

    function studentRoomKey(roomId) {
        return `${STUDENT_ROOM_PREFIX}${String(roomId || '').trim()}`;
    }
    function studentScoreKey(roomId) {
        return `${STUDENT_SCORE_PREFIX}${String(roomId || '').trim()}`;
    }
    function studentNotesKey(roomId) {
        return `${STUDENT_NOTES_PREFIX}${String(roomId || '').trim()}`;
    }
    function presenterAnnotationsKey(presentationId) {
        return `${PRESENTER_ANNOTATIONS_PREFIX}${String(presentationId || '').trim()}`;
    }
    function remoteControlConfigKey(roomId) {
        return `${REMOTE_CONTROL_PREFIX}${String(roomId || '').trim()}`;
    }

    function _legacyKeysFor(key) {
        if (typeof key !== 'string') return [];
        const out = [];
        if (LEGACY_KEYS[key]) out.push(LEGACY_KEYS[key]);
        if (key.startsWith(`${PREFIX}-`)) out.push(key.replace(`${PREFIX}-`, `${LEGACY_V1_PREFIX}-`));
        if (key.startsWith(STUDENT_ROOM_PREFIX)) {
            out.push(key.replace(STUDENT_ROOM_PREFIX, V1_STUDENT_ROOM_PREFIX));
            out.push(key.replace(STUDENT_ROOM_PREFIX, LEGACY_STUDENT_ROOM_PREFIX));
        }
        if (key.startsWith(STUDENT_SCORE_PREFIX)) {
            out.push(key.replace(STUDENT_SCORE_PREFIX, V1_STUDENT_SCORE_PREFIX));
            out.push(key.replace(STUDENT_SCORE_PREFIX, LEGACY_STUDENT_SCORE_PREFIX));
        }
        if (key.startsWith(STUDENT_NOTES_PREFIX)) {
            out.push(key.replace(STUDENT_NOTES_PREFIX, V1_STUDENT_NOTES_PREFIX));
            out.push(key.replace(STUDENT_NOTES_PREFIX, LEGACY_STUDENT_NOTES_PREFIX));
        }
        if (key.startsWith(PRESENTER_ANNOTATIONS_PREFIX)) {
            out.push(key.replace(PRESENTER_ANNOTATIONS_PREFIX, V1_PRESENTER_ANNOTATIONS_PREFIX));
            out.push(key.replace(PRESENTER_ANNOTATIONS_PREFIX, LEGACY_PRESENTER_ANNOTATIONS_PREFIX));
        }
        if (key.startsWith(REMOTE_CONTROL_PREFIX)) {
            out.push(key.replace(REMOTE_CONTROL_PREFIX, V1_REMOTE_CONTROL_PREFIX));
            out.push(key.replace(REMOTE_CONTROL_PREFIX, LEGACY_REMOTE_CONTROL_PREFIX));
        }
        return Array.from(new Set(out.filter(Boolean)));
    }

    function _safeGet(storage, key) {
        try { return storage.getItem(key); } catch (e) { return null; }
    }
    function _safeSet(storage, key, value) {
        try { storage.setItem(key, value); return true; } catch (e) { return false; }
    }
    function _safeRemove(storage, key) {
        try { storage.removeItem(key); } catch (e) {}
    }

    function getRaw(key) {
        if (!key) return null;
        const current = _safeGet(localStorage, key);
        if (current !== null) return current;
        const legacyKeys = _legacyKeysFor(key);
        if (!legacyKeys.length) return null;
        for (const legacyKey of legacyKeys) {
            const legacy = _safeGet(localStorage, legacyKey);
            if (legacy !== null) {
                _safeSet(localStorage, key, legacy);
                return legacy;
            }
        }
        return null;
    }

    function setRaw(key, value) {
        if (!key) return false;
        return _safeSet(localStorage, key, String(value));
    }

    function remove(key) {
        if (!key) return;
        _safeRemove(localStorage, key);
        _legacyKeysFor(key).forEach(legacyKey => _safeRemove(localStorage, legacyKey));
    }

    function getJSON(key, fallback = null) {
        const raw = getRaw(key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    function setJSON(key, value) {
        if (!key) return false;
        try { return _safeSet(localStorage, key, JSON.stringify(value)); } catch (e) { return false; }
    }

    function getSessionRaw(key) {
        if (!key) return null;
        const current = _safeGet(sessionStorage, key);
        if (current !== null) return current;
        const legacyKeys = _legacyKeysFor(key);
        if (!legacyKeys.length) return null;
        for (const legacyKey of legacyKeys) {
            const legacy = _safeGet(sessionStorage, legacyKey);
            if (legacy !== null) {
                _safeSet(sessionStorage, key, legacy);
                return legacy;
            }
        }
        return null;
    }

    function setSessionRaw(key, value) {
        if (!key) return false;
        return _safeSet(sessionStorage, key, String(value));
    }

    function getSessionJSON(key, fallback = null) {
        const raw = getSessionRaw(key);
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    function setSessionJSON(key, value) {
        if (!key) return false;
        try { return _safeSet(sessionStorage, key, JSON.stringify(value)); } catch (e) { return false; }
    }

    global.OEIStorage = Object.freeze({
        VERSION,
        PREFIX,
        KEYS,
        LEGACY_KEYS,
        CHANNELS,
        studentRoomKey,
        studentScoreKey,
        studentNotesKey,
        presenterAnnotationsKey,
        remoteControlConfigKey,
        getRaw,
        setRaw,
        remove,
        getJSON,
        setJSON,
        getSessionRaw,
        setSessionRaw,
        getSessionJSON,
        setSessionJSON,
    });
})(window);
