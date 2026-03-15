/**
 * @module slides/student-transport-ui
 * Student transport/status UI helper.
 * Extracted from student-main to reduce monolith coupling.
 */
(function attachStudentTransportUI(root) {
    'use strict';

    const DEFAULT_STATES = Object.freeze({
        IDLE: 'idle',
        CONNECTING: 'connecting',
        CONNECTED: 'connected',
        RETRYING: 'retrying',
        OFFLINE: 'offline',
    });

    const asFunction = value => (typeof value === 'function' ? value : null);
    const asModeLabel = mode => (mode === 'relay' ? 'Relay' : 'P2P');
    const normalizeState = (nextState, states = DEFAULT_STATES) => {
        const allowed = new Set(Object.values(states || DEFAULT_STATES));
        return allowed.has(nextState) ? nextState : (states.IDLE || DEFAULT_STATES.IDLE);
    };

    function createStudentTransportUI(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const states = (opts.connectionStates && typeof opts.connectionStates === 'object')
            ? opts.connectionStates
            : DEFAULT_STATES;
        const bridge = (opts.bridge && typeof opts.bridge === 'object') ? opts.bridge : null;
        const syncRuntime = asFunction(opts.syncRuntime);
        const getTransportMode = asFunction(opts.getTransportMode) || (() => 'p2p');

        let state = normalizeState(opts.initialState, states);
        let stateSince = Date.now();

        const setJoinStatus = (message, tone = '') => {
            const el = document.getElementById('join-status');
            if (!el) return;
            el.textContent = String(message || '');
            el.className = `status-msg ${tone || ''}`.trim();
        };

        const setConnectionDetail = (text, tone = '') => {
            const stateEl = document.getElementById('conn-state');
            if (!stateEl) return;
            stateEl.textContent = String(text || '');
            stateEl.classList.remove('ok', 'warn', 'error');
            if (tone) stateEl.classList.add(tone);
            stateEl.title = stateEl.textContent;
        };

        const syncConnectionRuntime = normalized => {
            const connected = normalized === (states.CONNECTED || DEFAULT_STATES.CONNECTED);
            const mode = getTransportMode();
            if (bridge?.setConnectionState) {
                bridge.setConnectionState(normalized, connected);
                if (bridge?.setTransportMode) bridge.setTransportMode(mode);
                return;
            }
            if (syncRuntime) {
                syncRuntime({
                    connectionState: normalized,
                    transportMode: mode,
                    connected,
                });
            }
        };

        const updateConnectionBadge = normalized => {
            const badge = document.getElementById('conn-badge');
            if (badge) {
                const connectedState = states.CONNECTED || DEFAULT_STATES.CONNECTED;
                const connectingState = states.CONNECTING || DEFAULT_STATES.CONNECTING;
                const retryingState = states.RETRYING || DEFAULT_STATES.RETRYING;
                const offlineState = states.OFFLINE || DEFAULT_STATES.OFFLINE;
                badge.classList.toggle('disconnected', normalized !== connectedState);
                badge.classList.toggle('connecting', normalized === connectingState);
                badge.classList.toggle('retrying', normalized === retryingState);
                badge.classList.toggle('offline', normalized === offlineState);
                const titleMap = {
                    [states.IDLE || DEFAULT_STATES.IDLE]: 'En attente',
                    [connectingState]: 'Connexion en cours',
                    [connectedState]: 'Connecté',
                    [retryingState]: 'Reconnexion en cours',
                    [offlineState]: 'Hors ligne',
                };
                badge.title = titleMap[normalized] || 'État réseau';
            }

            const banner = document.getElementById('reconnect-banner');
            if (!banner) return;
            const showBanner = normalized === (states.CONNECTING || DEFAULT_STATES.CONNECTING)
                || normalized === (states.RETRYING || DEFAULT_STATES.RETRYING)
                || normalized === (states.OFFLINE || DEFAULT_STATES.OFFLINE);
            banner.classList.toggle('visible', showBanner);
            if (!showBanner) banner.textContent = '';
        };

        const defaultLabelFor = normalized => {
            const modeLabel = asModeLabel(getTransportMode());
            return {
                [states.IDLE || DEFAULT_STATES.IDLE]: `${modeLabel} · en attente`,
                [states.CONNECTING || DEFAULT_STATES.CONNECTING]: `${modeLabel} · connexion…`,
                [states.CONNECTED || DEFAULT_STATES.CONNECTED]: `${modeLabel} · connecté`,
                [states.RETRYING || DEFAULT_STATES.RETRYING]: `${modeLabel} · reconnexion…`,
                [states.OFFLINE || DEFAULT_STATES.OFFLINE]: `${modeLabel} · hors ligne`,
            }[normalized] || `${modeLabel} · état inconnu`;
        };

        const defaultToneFor = normalized => {
            if (normalized === (states.CONNECTED || DEFAULT_STATES.CONNECTED)) return 'ok';
            if (normalized === (states.OFFLINE || DEFAULT_STATES.OFFLINE)) return 'error';
            return 'warn';
        };

        const setConnectionState = (nextState, meta = {}) => {
            const normalized = normalizeState(nextState, states);
            state = normalized;
            stateSince = Date.now();
            syncConnectionRuntime(normalized);
            updateConnectionBadge(normalized);

            const detail = String(meta?.detail || '').trim();
            const tone = String(meta?.tone || '').trim();
            setConnectionDetail(detail || defaultLabelFor(normalized), tone || defaultToneFor(normalized));
            return normalized;
        };

        const setConnected = (connected, meta = {}) => {
            const normalized = setConnectionState(
                connected ? (states.CONNECTED || DEFAULT_STATES.CONNECTED) : (states.RETRYING || DEFAULT_STATES.RETRYING),
                meta,
            );
            if (bridge?.setConnected) {
                bridge.setConnected(!!connected);
            } else if (syncRuntime) {
                syncRuntime({ connected: !!connected });
            }
            return normalized;
        };

        return {
            setJoinStatus,
            setConnectionDetail,
            setConnectionState,
            setConnected,
            getState: () => state,
            getStateSince: () => stateSince,
        };
    }

    root.OEIStudentTransportUI = Object.freeze({
        create: createStudentTransportUI,
        DEFAULT_STATES,
        testUtils: Object.freeze({
            normalizeState,
            asModeLabel,
        }),
    });
})(window);
