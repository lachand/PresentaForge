/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/theme-runtime
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/theme-runtime.js"></script>
 */
/* theme-runtime.js — shared UI theme controller (light/dark, storage + DOM apply) */
(function initOEIThemeRuntime(global) {
    'use strict';

    if (!global || global.OEIThemeRuntime) return;

    const MODES = Object.freeze(['light', 'dark']);

    function normalizeMode(value, fallback = 'light') {
        const base = MODES.includes(String(fallback || '').toLowerCase()) ? String(fallback).toLowerCase() : 'light';
        const raw = String(value || '').trim().toLowerCase();
        if (raw === 'light' || raw === 'dark') return raw;
        return base;
    }

    function resolveScopeKey(scope = 'default') {
        const keys = global.OEIStorage?.KEYS || {};
        const safeScope = String(scope || 'default').trim().toLowerCase();
        switch (safeScope) {
            case 'editor':
                return keys.EDITOR_THEME || 'oei-editor-theme';
            case 'student':
                return keys.STUDENT_THEME || 'oei-student-theme';
            case 'presenter':
                return keys.PRESENTER_THEME || 'oei-presenter-theme';
            case 'index':
                return keys.EDITOR_THEME || 'oei-editor-theme';
            default:
                return keys.UI_MODE || 'oei-ui-mode';
        }
    }

    function readRaw(key) {
        if (!key) return null;
        if (typeof global.OEIStorage?.getRaw === 'function') return global.OEIStorage.getRaw(key);
        try {
            return global.localStorage?.getItem(key) || null;
        } catch (e) {
            return null;
        }
    }

    function writeRaw(key, value) {
        if (!key) return false;
        if (typeof global.OEIStorage?.setRaw === 'function') return global.OEIStorage.setRaw(key, value);
        try {
            global.localStorage?.setItem(key, String(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    function readMode(scope = 'default', options = {}) {
        const storageKey = options.storageKey || resolveScopeKey(scope);
        const fallback = normalizeMode(options.defaultMode || 'light', 'light');
        const raw = readRaw(storageKey);
        return normalizeMode(raw, fallback);
    }

    function writeMode(scope = 'default', mode = 'light', options = {}) {
        const storageKey = options.storageKey || resolveScopeKey(scope);
        const fallback = normalizeMode(options.defaultMode || 'light', 'light');
        const normalized = normalizeMode(mode, fallback);
        writeRaw(storageKey, normalized);
        return normalized;
    }

    function applyMode(mode = 'light', options = {}) {
        const normalized = normalizeMode(mode, normalizeMode(options.defaultMode || 'light', 'light'));
        if (typeof options.apply === 'function') {
            options.apply(normalized);
            return normalized;
        }

        const target = String(options.target || 'data-theme');
        if (target === 'body-dark') {
            const bodyEl = options.bodyElement || global.document?.body;
            if (bodyEl?.classList) {
                bodyEl.classList.toggle(String(options.darkClass || 'dark'), normalized === 'dark');
                if (options.lightClass) bodyEl.classList.toggle(String(options.lightClass), normalized === 'light');
            }
            return normalized;
        }
        if (target === 'body-light') {
            const bodyEl = options.bodyElement || global.document?.body;
            if (bodyEl?.classList) {
                bodyEl.classList.toggle(String(options.lightClass || 'light'), normalized === 'light');
                if (options.darkClass) bodyEl.classList.toggle(String(options.darkClass), normalized === 'dark');
            }
            return normalized;
        }

        const rootEl = options.rootElement || global.document?.documentElement;
        if (rootEl?.setAttribute) rootEl.setAttribute(String(options.attrName || 'data-theme'), normalized);
        return normalized;
    }

    function createController(options = {}) {
        const scope = String(options.scope || 'default').trim().toLowerCase();
        const defaultMode = normalizeMode(options.defaultMode || 'light', 'light');
        const storageKey = options.storageKey || resolveScopeKey(scope);
        const applyOptions = { ...options, defaultMode };

        const getMode = () => readMode(scope, { storageKey, defaultMode });
        const setMode = (nextMode) => {
            const mode = writeMode(scope, nextMode, { storageKey, defaultMode });
            applyMode(mode, applyOptions);
            return mode;
        };
        const toggleMode = () => setMode(getMode() === 'dark' ? 'light' : 'dark');
        const applyCurrent = () => {
            const mode = getMode();
            applyMode(mode, applyOptions);
            return mode;
        };
        const applyOnly = (nextMode) => applyMode(nextMode, applyOptions);

        return Object.freeze({
            scope,
            storageKey,
            defaultMode,
            getMode,
            setMode,
            toggleMode,
            applyCurrent,
            applyOnly,
        });
    }

    global.OEIThemeRuntime = Object.freeze({
        MODES,
        normalizeMode,
        resolveScopeKey,
        readMode,
        writeMode,
        applyMode,
        createController,
    });
})(typeof window !== 'undefined' ? window : globalThis);
