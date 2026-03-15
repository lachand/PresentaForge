/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/widget-plugins
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/widget-plugins.js"></script>
 */
/* widget-plugins.js — Runtime plugin API for OEI widgets */
(function initOEIWidgetPlugins(global) {
    'use strict';

    if (global.OEIWidgetPlugins) return;

    const STORAGE_KEY = global.OEIStorage?.KEYS?.WIDGET_PLUGINS || 'oei-v1-widget-plugins';
    const POLICY_STORAGE_KEY = global.OEIStorage?.KEYS?.WIDGET_PLUGIN_POLICY || 'oei-v2-widget-plugin-policy';
    const REGISTRY = global.OEI_WIDGET_REGISTRY || (global.OEI_WIDGET_REGISTRY = {});
    const APPLIED_MARK = '__pluginId';
    const APPLIED_IDS = new Set();
    const RUNTIME_STATUS = new Map();
    const RUNTIME_ERRORS = [];
    const RUNTIME_ERROR_LIMIT = 200;
    const WIDGET_PLUGIN_API_VERSION = 2;
    const CURRENT_ORIGIN = (() => {
        try { return String(global.location?.origin || '').trim(); } catch (_) { return ''; }
    })();
    const DEFAULT_POLICY = Object.freeze({
        allowRemoteScripts: false,
        trustedOrigins: CURRENT_ORIGIN ? [CURRENT_ORIGIN] : [],
    });

    function _deepClone(v) {
        return JSON.parse(JSON.stringify(v));
    }

    function _normalizeOrigin(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try { return new URL(raw, CURRENT_ORIGIN || undefined).origin; }
        catch (_) { return ''; }
    }

    function _trimmed(value, maxLen = 240) {
        const out = String(value || '').trim();
        return maxLen > 0 ? out.slice(0, maxLen) : out;
    }

    function _toIntOrNull(value) {
        if (value == null) return null;
        if (typeof value === 'string' && !value.trim()) return null;
        if (typeof value === 'boolean') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return Math.trunc(n);
    }

    function _isJsScriptPath(pathname) {
        const p = String(pathname || '').toLowerCase();
        return p.endsWith('.js') || p.endsWith('.mjs');
    }

    function _readStore() {
        const fallback = { version: 1, plugins: [] };
        const raw = global.OEIStorage?.getJSON
            ? global.OEIStorage.getJSON(STORAGE_KEY, fallback)
            : (() => {
                try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || fallback; }
                catch (_) { return fallback; }
            })();
        if (!raw || typeof raw !== 'object') return fallback;
        const plugins = Array.isArray(raw.plugins) ? raw.plugins : [];
        return { version: 1, plugins };
    }

    function _writeStore(store) {
        if (global.OEIStorage?.setJSON) return global.OEIStorage.setJSON(STORAGE_KEY, store);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
            return true;
        } catch (_) {
            return false;
        }
    }

    function _normalizePolicy(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const trustedOrigins = Array.isArray(source.trustedOrigins) ? source.trustedOrigins : DEFAULT_POLICY.trustedOrigins;
        const normalizedOrigins = Array.from(new Set(
            trustedOrigins
                .map(_normalizeOrigin)
                .filter(Boolean)
                .concat(CURRENT_ORIGIN ? [CURRENT_ORIGIN] : [])
        ));
        return {
            allowRemoteScripts: source.allowRemoteScripts === true,
            trustedOrigins: normalizedOrigins,
        };
    }

    function _readPolicy() {
        const raw = global.OEIStorage?.getJSON
            ? global.OEIStorage.getJSON(POLICY_STORAGE_KEY, DEFAULT_POLICY)
            : (() => {
                try { return JSON.parse(localStorage.getItem(POLICY_STORAGE_KEY) || 'null') || DEFAULT_POLICY; }
                catch (_) { return DEFAULT_POLICY; }
            })();
        return _normalizePolicy(raw);
    }

    function _writePolicy(nextPolicy) {
        if (global.OEIStorage?.setJSON) return global.OEIStorage.setJSON(POLICY_STORAGE_KEY, nextPolicy);
        try {
            localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(nextPolicy));
            return true;
        } catch (_) {
            return false;
        }
    }

    function _evaluateScriptPolicy(script, policy) {
        const ref = String(script || '').trim();
        if (!ref) return { allowed: false, reason: 'missing-script', message: 'script manquant', origin: null };
        if (/^(javascript|data|blob|file):/i.test(ref)) {
            return { allowed: false, reason: 'forbidden-script-scheme', message: 'schéma script interdit', origin: null };
        }
        if (/[\r\n]/.test(ref)) {
            return { allowed: false, reason: 'invalid-script-format', message: 'format script invalide', origin: null };
        }

        const isRemote = /^(https?:)?\/\//i.test(ref);
        if (!isRemote) {
            const cleanRef = ref.split(/[?#]/)[0];
            if (/(^|[\\/])\.\.([\\/]|$)/.test(cleanRef) || cleanRef.includes('\\')) {
                return { allowed: false, reason: 'forbidden-local-path', message: 'chemin local interdit', origin: CURRENT_ORIGIN || null };
            }
            if (!_isJsScriptPath(cleanRef)) {
                return { allowed: false, reason: 'invalid-script-extension', message: 'extension script invalide (attendu .js/.mjs)', origin: CURRENT_ORIGIN || null };
            }
            return { allowed: true, reason: 'local-script', message: 'script local', origin: CURRENT_ORIGIN || null };
        }

        let url;
        try {
            url = /^\/\//.test(ref)
                ? new URL(`${global.location?.protocol || 'https:'}${ref}`)
                : new URL(ref);
        } catch (_) {
            return { allowed: false, reason: 'invalid-script-url', message: 'URL script invalide', origin: null };
        }
        const protocol = String(url.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
            return { allowed: false, reason: 'invalid-script-protocol', message: 'protocole script non supporté', origin: null };
        }
        if (!_isJsScriptPath(url.pathname || '')) {
            return { allowed: false, reason: 'invalid-script-extension', message: 'extension script invalide (attendu .js/.mjs)', origin: String(url.origin || '').trim() || null };
        }

        const origin = String(url.origin || '').trim();
        if (CURRENT_ORIGIN && origin === CURRENT_ORIGIN) {
            return { allowed: true, reason: 'same-origin', message: 'origine locale', origin };
        }
        if (policy.allowRemoteScripts !== true) {
            return { allowed: false, reason: 'remote-disabled', message: 'scripts distants désactivés', origin };
        }
        if (!policy.trustedOrigins.includes(origin)) {
            return { allowed: false, reason: 'untrusted-origin', message: `origine non approuvée: ${origin}`, origin };
        }
        return { allowed: true, reason: 'trusted-origin', message: `origine approuvée: ${origin}`, origin };
    }

    function _normalizeWidget(raw, pluginId) {
        if (!raw || typeof raw !== 'object') throw new Error('Widget invalide');
        const id = String(raw.id || '').trim();
        if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(id)) throw new Error(`ID widget invalide: ${id || '(vide)'}`);
        const globalName = String(raw.global || '').trim();
        const script = String(raw.script || '').trim();
        const label = String(raw.label || '').trim();
        const category = String(raw.category || '').trim() || 'Plugin';
        if (!globalName) throw new Error(`Widget "${id}": champ "global" manquant`);
        if (!script) throw new Error(`Widget "${id}": champ "script" manquant`);
        if (!label) throw new Error(`Widget "${id}": champ "label" manquant`);

        let staticFallback = raw.staticFallback;
        if (!staticFallback && typeof raw.staticFallbackHtml === 'string') {
            const html = raw.staticFallbackHtml;
            staticFallback = () => html;
        }

        return {
            id,
            global: globalName,
            script,
            label,
            category,
            description: String(raw.description || '').trim(),
            level: String(raw.level || '').trim(),
            tags: Array.isArray(raw.tags) ? raw.tags.map(v => String(v)).filter(Boolean) : [],
            defaultConfig: raw.defaultConfig && typeof raw.defaultConfig === 'object' ? _deepClone(raw.defaultConfig) : {},
            staticFallback,
            [APPLIED_MARK]: pluginId,
        };
    }

    function _normalizeCompat(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const minWidgetApi = _toIntOrNull(source.minWidgetApi);
        const maxWidgetApi = _toIntOrNull(source.maxWidgetApi);
        return {
            minWidgetApi: Number.isFinite(minWidgetApi) && minWidgetApi >= 0 ? minWidgetApi : null,
            maxWidgetApi: Number.isFinite(maxWidgetApi) && maxWidgetApi >= 0 ? maxWidgetApi : null,
        };
    }

    function _isCompatSatisfied(compat) {
        const min = _toIntOrNull(compat?.minWidgetApi);
        const max = _toIntOrNull(compat?.maxWidgetApi);
        if (Number.isFinite(min) && WIDGET_PLUGIN_API_VERSION < min) return false;
        if (Number.isFinite(max) && WIDGET_PLUGIN_API_VERSION > max) return false;
        return true;
    }

    function _normalizePlugin(raw) {
        const source = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        if (!source || typeof source !== 'object') throw new Error('Manifest plugin invalide');
        const id = String(source.id || '').trim();
        if (!/^[a-z0-9][a-z0-9-]{2,80}$/i.test(id)) throw new Error('ID plugin invalide');
        const name = String(source.name || '').trim() || id;
        const version = String(source.version || '1.0.0').trim();
        const widgets = Array.isArray(source.widgets) ? source.widgets : [];
        if (!widgets.length) throw new Error('Le plugin ne contient aucun widget');
        const normalizedWidgets = widgets.map(w => _normalizeWidget(w, id));
        const unique = new Set();
        for (const w of normalizedWidgets) {
            if (unique.has(w.id)) throw new Error(`Widget dupliqué dans le plugin: ${w.id}`);
            unique.add(w.id);
        }
        return {
            id,
            name,
            version,
            description: String(source.description || '').trim(),
            compat: _normalizeCompat(source.compat),
            enabled: source.enabled !== false,
            widgets: normalizedWidgets.map(w => ({
                id: w.id,
                global: w.global,
                script: w.script,
                label: w.label,
                category: w.category,
                description: w.description,
                level: w.level,
                tags: w.tags,
                defaultConfig: w.defaultConfig,
                staticFallbackHtml: typeof source?.widgets?.find?.(x => x.id === w.id)?.staticFallbackHtml === 'string'
                    ? source.widgets.find(x => x.id === w.id).staticFallbackHtml
                    : '',
            })),
        };
    }

    function _clearAppliedWidgets() {
        for (const wid of APPLIED_IDS) delete REGISTRY[wid];
        APPLIED_IDS.clear();
        for (const [wid, reg] of Object.entries(REGISTRY)) {
            if (reg && reg[APPLIED_MARK]) {
                delete REGISTRY[wid];
            }
        }
    }

    function _safeDispatchUpdated(detail) {
        try {
            global.dispatchEvent(new CustomEvent('oei:widget-plugins-updated', { detail }));
        } catch (_) {
            // no-op for non-browser test environments
        }
    }

    function reportRuntimeError(raw) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const entry = {
            at: new Date().toISOString(),
            source: _trimmed(source.source || 'widget-runtime', 80),
            pluginId: _trimmed(source.pluginId || '', 120),
            widgetId: _trimmed(source.widgetId || '', 120),
            stage: _trimmed(source.stage || 'runtime', 80),
            reason: _trimmed(source.reason || 'unknown', 120),
            message: _trimmed(source.message || '', 500),
            script: _trimmed(source.script || '', 260),
            globalName: _trimmed(source.globalName || '', 160),
        };
        RUNTIME_ERRORS.push(entry);
        if (RUNTIME_ERRORS.length > RUNTIME_ERROR_LIMIT) {
            RUNTIME_ERRORS.splice(0, RUNTIME_ERRORS.length - RUNTIME_ERROR_LIMIT);
        }
        try {
            global.dispatchEvent(new CustomEvent('oei:widget-plugin-runtime-error', { detail: _deepClone(entry) }));
        } catch (_) {
            // no-op in tests/non-browser contexts.
        }
        return _deepClone(entry);
    }

    function listRuntimeErrors(limit = 50) {
        const requested = Number(limit);
        const max = Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 50;
        if (!max) return [];
        return _deepClone(RUNTIME_ERRORS.slice(-max));
    }

    function clearRuntimeErrors() {
        RUNTIME_ERRORS.splice(0, RUNTIME_ERRORS.length);
        return true;
    }

    function _buildStatusSnapshot() {
        const store = _readStore();
        return store.plugins.map(plugin => {
            const runtime = RUNTIME_STATUS.get(plugin.id) || {};
            const runtimeErrorCount = RUNTIME_ERRORS.filter(err => err.pluginId === plugin.id).length;
            return {
                id: plugin.id,
                enabled: plugin.enabled !== false,
                status: runtime.status || (plugin.enabled === false ? 'disabled' : 'allowed'),
                allowedWidgets: runtime.allowedWidgets || 0,
                blockedWidgets: runtime.blockedWidgets || [],
                warnings: runtime.warnings || [],
                runtimeErrorCount,
            };
        });
    }

    function _applyInstalledPlugins() {
        const store = _readStore();
        const policy = _readPolicy();
        _clearAppliedWidgets();
        RUNTIME_STATUS.clear();
        const warnings = [];

        for (const plugin of store.plugins) {
            if (!plugin || typeof plugin !== 'object') continue;
            const runtime = {
                status: plugin.enabled === false ? 'disabled' : 'allowed',
                allowedWidgets: 0,
                blockedWidgets: [],
                warnings: [],
            };
            const pluginWidgets = Array.isArray(plugin.widgets) ? plugin.widgets : [];
            const compat = _normalizeCompat(plugin.compat);

            if (!_isCompatSatisfied(compat)) {
                const warning = `[${plugin.id}] plugin incompatible avec l'API widgets courante (api=${WIDGET_PLUGIN_API_VERSION}, min=${compat.minWidgetApi ?? 'n/a'}, max=${compat.maxWidgetApi ?? 'n/a'})`;
                warnings.push(warning);
                runtime.warnings.push(warning);
                runtime.status = 'incompatible';
                runtime.blockedWidgets = pluginWidgets.map(rawWidget => ({
                    id: String(rawWidget?.id || '(inconnu)'),
                    reason: 'incompatible-widget-api',
                    message: 'plugin incompatible avec la version API widgets',
                    origin: null,
                }));
                RUNTIME_STATUS.set(plugin.id, runtime);
                continue;
            }

            if (plugin.enabled !== false) {
                for (const rawWidget of pluginWidgets) {
                    const policyCheck = _evaluateScriptPolicy(rawWidget?.script, policy);
                    if (!policyCheck.allowed) {
                        const widgetId = String(rawWidget?.id || '(inconnu)');
                        const warning = `[${plugin.id}] widget "${widgetId}" bloqué: ${policyCheck.message}`;
                        warnings.push(warning);
                        runtime.warnings.push(warning);
                        runtime.blockedWidgets.push({
                            id: widgetId,
                            reason: policyCheck.reason,
                            message: policyCheck.message,
                            origin: policyCheck.origin,
                        });
                        continue;
                    }

                    let widget;
                    try {
                        widget = _normalizeWidget(rawWidget, plugin.id);
                    } catch (err) {
                        const warning = `[${plugin.id}] ${err.message}`;
                        warnings.push(warning);
                        runtime.warnings.push(warning);
                        continue;
                    }
                    if (REGISTRY[widget.id]) {
                        const warning = `[${plugin.id}] collision ID widget "${widget.id}"`;
                        warnings.push(warning);
                        runtime.warnings.push(warning);
                        runtime.blockedWidgets.push({
                            id: widget.id,
                            reason: 'widget-id-collision',
                            message: 'collision ID widget',
                            origin: policyCheck.origin,
                        });
                        continue;
                    }
                    REGISTRY[widget.id] = widget;
                    APPLIED_IDS.add(widget.id);
                    runtime.allowedWidgets += 1;
                }
                if (runtime.allowedWidgets <= 0 && pluginWidgets.length > 0) {
                    runtime.status = 'blocked';
                }
            }

            RUNTIME_STATUS.set(plugin.id, runtime);
        }

        _safeDispatchUpdated({
            warnings,
            policy,
            statuses: _buildStatusSnapshot(),
        });
        return warnings;
    }

    function list() {
        return _deepClone(_readStore().plugins);
    }

    function getPolicy() {
        return _deepClone(_readPolicy());
    }

    function setPolicy(nextPolicy) {
        const merged = _normalizePolicy(Object.assign({}, _readPolicy(), nextPolicy || {}));
        _writePolicy(merged);
        const warnings = _applyInstalledPlugins();
        return { policy: _deepClone(merged), warnings };
    }

    function inspect() {
        const plugins = list();
        const statuses = _buildStatusSnapshot();
        const byId = new Map(statuses.map(s => [s.id, s]));
        return {
            policy: getPolicy(),
            plugins: plugins.map(plugin => {
                const status = byId.get(plugin.id) || null;
                return Object.assign({}, plugin, {
                    runtimeStatus: status?.status || (plugin.enabled === false ? 'disabled' : 'allowed'),
                    runtimeAllowedWidgets: status?.allowedWidgets ?? 0,
                    runtimeBlockedWidgets: status?.blockedWidgets || [],
                    runtimeWarnings: status?.warnings || [],
                    runtimeErrorCount: status?.runtimeErrorCount ?? 0,
                });
            }),
            runtimeErrors: listRuntimeErrors(100),
        };
    }

    function install(manifest) {
        const plugin = _normalizePlugin(manifest);
        const store = _readStore();
        const idx = store.plugins.findIndex(p => p.id === plugin.id);
        if (idx >= 0) store.plugins[idx] = plugin;
        else store.plugins.push(plugin);
        _writeStore(store);
        const warnings = _applyInstalledPlugins();
        return { plugin: _deepClone(plugin), warnings };
    }

    function remove(pluginId) {
        const id = String(pluginId || '').trim();
        if (!id) return false;
        const store = _readStore();
        const next = store.plugins.filter(p => p.id !== id);
        if (next.length === store.plugins.length) return false;
        _writeStore({ version: 1, plugins: next });
        _applyInstalledPlugins();
        return true;
    }

    function setEnabled(pluginId, enabled) {
        const id = String(pluginId || '').trim();
        const store = _readStore();
        const idx = store.plugins.findIndex(p => p.id === id);
        if (idx < 0) return false;
        store.plugins[idx].enabled = !!enabled;
        _writeStore(store);
        _applyInstalledPlugins();
        return true;
    }

    function exportManifest(pluginId) {
        const id = String(pluginId || '').trim();
        const plugin = _readStore().plugins.find(p => p.id === id);
        if (!plugin) return false;
        const blob = new Blob([JSON.stringify(plugin, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `widget-plugin-${id}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        return true;
    }

    const api = Object.freeze({
        apiVersion: WIDGET_PLUGIN_API_VERSION,
        storageKey: STORAGE_KEY,
        policyStorageKey: POLICY_STORAGE_KEY,
        list,
        inspect,
        getPolicy,
        setPolicy,
        install,
        remove,
        setEnabled,
        exportManifest,
        reportRuntimeError,
        listRuntimeErrors,
        clearRuntimeErrors,
        reload: _applyInstalledPlugins,
    });

    global.OEIWidgetPlugins = api;
    _applyInstalledPlugins();
})(window);
