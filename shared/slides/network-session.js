/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/network-session
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/network-session.js"></script>
 */
// @ts-check
/**
 * network-session.js
 * Shared network helpers for slides runtime (viewer/student/remote).
 * Exposes `window.OEINetworkSession`.
 */
(function initNetworkSession(global) {
    if (!global) return;

    const DEFAULT_ICE_SERVERS = Object.freeze([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
    ]);

    const toSafeString = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);
    const toSafeInt = value => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    };
    const toBoolOrNull = value => {
        if (typeof value === 'boolean') return value;
        const v = toSafeString(value, 16).toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(v)) return true;
        if (['0', 'false', 'no', 'off'].includes(v)) return false;
        return null;
    };

    const parseJSON = (value, fallback = null) => {
        if (value == null) return fallback;
        if (typeof value === 'object') return value;
        try { return JSON.parse(String(value)); } catch (e) { return fallback; }
    };

    function sanitizeIceServers(rawList) {
        if (!Array.isArray(rawList)) return [];
        return rawList
            .map(entry => {
                if (!entry || typeof entry !== 'object') return null;
                const urlsRaw = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
                const urls = urlsRaw
                    .map(url => toSafeString(url, 420))
                    .filter(url => /^stuns?:|^turns?:/i.test(url));
                if (!urls.length) return null;
                const out = { urls: urls.length === 1 ? urls[0] : urls };
                const username = toSafeString(entry.username, 200);
                const credential = toSafeString(entry.credential, 360);
                if (username) out.username = username;
                if (credential) out.credential = credential;
                return out;
            })
            .filter(Boolean)
            .slice(0, 8);
    }

    function buildPeerOptions(params, readJSON, windowOptions) {
        const options = {
            debug: 0,
            pingInterval: 5000,
            config: { iceServers: Array.from(DEFAULT_ICE_SERVERS) },
        };
        const stored = (typeof readJSON === 'function' ? readJSON('oei-v1-peer-options', null) : null) || null;
        const fromWindow = (windowOptions && typeof windowOptions === 'object') ? windowOptions : null;
        const host = toSafeString(params?.get?.('peerHost') || stored?.host || fromWindow?.host, 220);
        const pathRaw = toSafeString(params?.get?.('peerPath') || stored?.path || fromWindow?.path, 140);
        const key = toSafeString(params?.get?.('peerKey') || stored?.key || fromWindow?.key, 160);
        const port = toSafeInt(params?.get?.('peerPort') ?? stored?.port ?? fromWindow?.port);
        const secure = toBoolOrNull(params?.get?.('peerSecure') ?? stored?.secure ?? fromWindow?.secure);
        const pingInterval = toSafeInt(params?.get?.('peerPing') ?? stored?.pingInterval ?? fromWindow?.pingInterval);
        if (host) options.host = host;
        if (pathRaw) options.path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
        if (key) options.key = key;
        if (port && port > 0 && port <= 65535) options.port = port;
        if (secure !== null) options.secure = secure;
        if (pingInterval && pingInterval >= 1000 && pingInterval <= 120000) options.pingInterval = pingInterval;

        const queryIce = sanitizeIceServers(parseJSON(params?.get?.('peerIce'), []));
        const customIce = sanitizeIceServers(
            stored?.config?.iceServers
            || stored?.iceServers
            || fromWindow?.config?.iceServers
            || fromWindow?.iceServers
        );
        if (queryIce.length) options.config.iceServers = queryIce;
        else if (customIce.length) options.config.iceServers = customIce;
        return options;
    }

    function buildRelayOptions(params, readJSON, windowOptions) {
        const stored = (typeof readJSON === 'function' ? readJSON('oei-v1-relay-options', null) : null) || null;
        const fromWindow = (windowOptions && typeof windowOptions === 'object') ? windowOptions : null;
        const wsUrl = toSafeString(params?.get?.('relayWs') || stored?.wsUrl || stored?.url || fromWindow?.wsUrl || fromWindow?.url, 520);
        const token = toSafeString(params?.get?.('relayToken') || stored?.token || fromWindow?.token, 260);
        const enabled = !!wsUrl && /^wss?:\/\//i.test(wsUrl);
        return { enabled, wsUrl, token };
    }

    function normalizeTransportMode(value, fallback = 'auto') {
        const raw = toSafeString(value, 24).toLowerCase();
        if (raw === 'relay' || raw === 'p2p' || raw === 'auto') return raw;
        return fallback === 'relay' || fallback === 'p2p' ? fallback : 'auto';
    }

    function normalizeAudienceMode(value, fallback = 'display') {
        const raw = toSafeString(value, 32).toLowerCase();
        if (['display', 'readonly', 'read-only', 'view', 'observe', 'audience'].includes(raw)) return 'display';
        if (['interactive', 'interactif', 'edit'].includes(raw)) return 'interactive';
        return fallback === 'interactive' ? 'interactive' : 'display';
    }

    function resolveAudiencePolicy(params, options = null) {
        const opt = (options && typeof options === 'object') ? options : {};
        const modeRaw = params?.get?.('audienceMode');
        const mode = normalizeAudienceMode(modeRaw, opt.defaultMode || 'display');
        const forceReadOnly = toBoolOrNull(opt.forceReadOnly);
        const readOnly = forceReadOnly !== null ? forceReadOnly : (mode !== 'interactive');
        return {
            mode,
            readOnly,
            allowAudienceActions: !readOnly,
        };
    }

    function shouldPreferRelay(attempt, reason, transportMode, relayOptions, fallbackAttempt = 5) {
        const relayEnabled = !!(relayOptions?.enabled && relayOptions?.wsUrl);
        if (!relayEnabled) return false;
        if (normalizeTransportMode(transportMode, 'auto') === 'relay') return true;
        const safeAttempt = Math.max(0, toSafeInt(attempt) || 0);
        if (safeAttempt >= Math.max(1, toSafeInt(fallbackAttempt) || 5)) return true;
        const safeReason = toSafeString(reason, 120).toLowerCase();
        const hardSignals = [
            'peer-unavailable',
            'signalisation-timeout',
            'signalisation perdue',
            'timeout',
            'webrtc',
            'eduroam',
            'network',
        ];
        if (hardSignals.some(token => safeReason.includes(token))) {
            return safeAttempt >= 2;
        }
        if (safeReason.includes('resume')) return safeAttempt >= 3;
        return false;
    }

    function reconnectDelayMs(attempt, base = 1200, factor = 1.45, max = 30000, jitter = 500) {
        const step = Math.max(0, Math.trunc(Number(attempt) || 0) - 1);
        const computed = Math.min(max, Math.round(base * Math.pow(factor, step)));
        return computed + Math.round(Math.random() * jitter);
    }

    function createRidFactory(prefix = 'rid') {
        let seq = 0;
        return () => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
    }

    function buildStudentUrl(baseUrl, roomId, params, peerOptions, relayOptions, options = null) {
        const url = new URL(String(baseUrl || ''), global.location?.origin || undefined);
        url.searchParams.set('room', toSafeString(roomId, 80));
        ['peerHost', 'peerPort', 'peerPath', 'peerSecure', 'peerKey', 'peerPing', 'peerIce', 'relayWs', 'relayToken', 'transport', 'audienceMode'].forEach(key => {
            const raw = params?.get?.(key);
            if (raw != null && raw !== '') url.searchParams.set(key, String(raw));
        });
        const opt = (options && typeof options === 'object') ? options : {};
        if (!url.searchParams.get('peerHost') && toSafeString(peerOptions?.host, 220)) {
            url.searchParams.set('peerHost', toSafeString(peerOptions.host, 220));
        }
        if (!url.searchParams.get('peerPort')) {
            const port = toSafeInt(peerOptions?.port);
            if (port && port > 0 && port <= 65535) url.searchParams.set('peerPort', String(port));
        }
        if (!url.searchParams.get('peerPath') && toSafeString(peerOptions?.path, 140)) {
            url.searchParams.set('peerPath', toSafeString(peerOptions.path, 140));
        }
        if (!url.searchParams.get('peerKey') && toSafeString(peerOptions?.key, 160)) {
            url.searchParams.set('peerKey', toSafeString(peerOptions.key, 160));
        }
        if (!url.searchParams.get('peerPing')) {
            const ping = toSafeInt(peerOptions?.pingInterval);
            if (ping && ping >= 1000 && ping <= 120000) url.searchParams.set('peerPing', String(ping));
        }
        if (!url.searchParams.get('peerSecure') && typeof peerOptions?.secure === 'boolean') {
            url.searchParams.set('peerSecure', peerOptions.secure ? '1' : '0');
        }
        if (!url.searchParams.get('peerIce') && Array.isArray(peerOptions?.config?.iceServers) && peerOptions.config.iceServers.length) {
            try { url.searchParams.set('peerIce', JSON.stringify(peerOptions.config.iceServers)); } catch (e) {}
        }
        if (!url.searchParams.get('relayWs') && toSafeString(relayOptions?.wsUrl, 520)) {
            url.searchParams.set('relayWs', toSafeString(relayOptions.wsUrl, 520));
        }
        if (!url.searchParams.get('relayToken') && toSafeString(relayOptions?.token, 260)) {
            url.searchParams.set('relayToken', toSafeString(relayOptions.token, 260));
        }
        const transportMode = normalizeTransportMode(opt.transportMode || url.searchParams.get('transport') || 'auto', 'auto');
        if (transportMode === 'auto') url.searchParams.delete('transport');
        else url.searchParams.set('transport', transportMode);
        const audienceMode = normalizeAudienceMode(opt.audienceMode || url.searchParams.get('audienceMode') || 'display', 'display');
        url.searchParams.set('audienceMode', audienceMode);
        return url.toString();
    }

    global.OEINetworkSession = Object.freeze({
        DEFAULT_ICE_SERVERS,
        toSafeString,
        toSafeInt,
        toBoolOrNull,
        normalizeTransportMode,
        normalizeAudienceMode,
        resolveAudiencePolicy,
        shouldPreferRelay,
        sanitizeIceServers,
        buildPeerOptions,
        buildRelayOptions,
        reconnectDelayMs,
        createRidFactory,
        buildStudentUrl,
    });
})(typeof window !== 'undefined' ? window : globalThis);
