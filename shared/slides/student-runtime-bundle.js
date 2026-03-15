/* student-runtime-bundle.js — bundled runtime-state/bridge/transport helpers */

/**
 * @module slides/student-runtime-state
 * Runtime state bridge for student app.
 */
(function attachStudentRuntimeState(root) {
    'use strict';

    const RUNTIME_KEY = '__oeiStudentRuntime';

    const toSafeString = (value, max = 120) => String(value == null ? '' : value).trim().slice(0, max);
    const toSafeInt = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.trunc(n);
    };
    const toBool = value => !!value;

    const CONNECTION_STATES = new Set(['idle', 'connecting', 'connected', 'retrying', 'offline']);
    const TRANSPORT_MODES = new Set(['p2p', 'relay']);

    /**
     * @param {Window & typeof globalThis} [globalObj]
     */
    function createStudentRuntimeState(globalObj = root) {
        const state = globalObj[RUNTIME_KEY] || (globalObj[RUNTIME_KEY] = {});
        const read = (key, fallback = null) => (state[key] !== undefined ? state[key] : fallback);
        const write = (key, value) => {
            state[key] = value;
            return value;
        };

        const api = {
            get roomId() { return toSafeString(read('roomId', ''), 120); },
            set roomId(value) { write('roomId', toSafeString(value, 120)); },

            get pseudo() { return toSafeString(read('pseudo', ''), 80); },
            set pseudo(value) { write('pseudo', toSafeString(value, 80)); },

            get transportMode() {
                const value = toSafeString(read('transportMode', 'p2p'), 16).toLowerCase();
                return TRANSPORT_MODES.has(value) ? value : 'p2p';
            },
            set transportMode(value) {
                const mode = toSafeString(value, 16).toLowerCase();
                write('transportMode', TRANSPORT_MODES.has(mode) ? mode : 'p2p');
            },

            get connectionState() {
                const value = toSafeString(read('connectionState', 'idle'), 24).toLowerCase();
                return CONNECTION_STATES.has(value) ? value : 'idle';
            },
            set connectionState(value) {
                const mode = toSafeString(value, 24).toLowerCase();
                write('connectionState', CONNECTION_STATES.has(mode) ? mode : 'idle');
            },

            get connected() { return toBool(read('connected', false)); },
            set connected(value) { write('connected', toBool(value)); },

            get currentIndex() { return Math.max(0, toSafeInt(read('currentIndex', 0), 0)); },
            set currentIndex(value) { write('currentIndex', Math.max(0, toSafeInt(value, 0))); },

            get currentFragmentOrder() { return toSafeInt(read('currentFragmentOrder', -1), -1); },
            set currentFragmentOrder(value) { write('currentFragmentOrder', toSafeInt(value, -1)); },

            get presenterIndex() { return Math.max(0, toSafeInt(read('presenterIndex', 0), 0)); },
            set presenterIndex(value) { write('presenterIndex', Math.max(0, toSafeInt(value, 0))); },

            get followPresenter() { return toBool(read('followPresenter', true)); },
            set followPresenter(value) { write('followPresenter', toBool(value)); },

            get quizActive() { return toBool(read('quizActive', false)); },
            set quizActive(value) { write('quizActive', toBool(value)); },

            get quizAnswered() { return toBool(read('quizAnswered', false)); },
            set quizAnswered(value) { write('quizAnswered', toBool(value)); },

            assign(patch = {}) {
                if (!patch || typeof patch !== 'object') return this.snapshot();
                if ('roomId' in patch) this.roomId = patch.roomId;
                if ('pseudo' in patch) this.pseudo = patch.pseudo;
                if ('transportMode' in patch) this.transportMode = patch.transportMode;
                if ('connectionState' in patch) this.connectionState = patch.connectionState;
                if ('connected' in patch) this.connected = patch.connected;
                if ('currentIndex' in patch) this.currentIndex = patch.currentIndex;
                if ('currentFragmentOrder' in patch) this.currentFragmentOrder = patch.currentFragmentOrder;
                if ('presenterIndex' in patch) this.presenterIndex = patch.presenterIndex;
                if ('followPresenter' in patch) this.followPresenter = patch.followPresenter;
                if ('quizActive' in patch) this.quizActive = patch.quizActive;
                if ('quizAnswered' in patch) this.quizAnswered = patch.quizAnswered;
                return this.snapshot();
            },

            snapshot() {
                return {
                    roomId: this.roomId,
                    pseudo: this.pseudo,
                    transportMode: this.transportMode,
                    connectionState: this.connectionState,
                    connected: this.connected,
                    currentIndex: this.currentIndex,
                    currentFragmentOrder: this.currentFragmentOrder,
                    presenterIndex: this.presenterIndex,
                    followPresenter: this.followPresenter,
                    quizActive: this.quizActive,
                    quizAnswered: this.quizAnswered,
                };
            },

            resetSession() {
                this.connected = false;
                this.connectionState = 'idle';
                this.currentIndex = 0;
                this.currentFragmentOrder = -1;
                this.presenterIndex = 0;
                this.followPresenter = true;
                this.quizActive = false;
                this.quizAnswered = false;
                return this.snapshot();
            },
        };

        return api;
    }

    root.OEIStudentRuntimeState = Object.freeze({
        create: createStudentRuntimeState,
    });
})(window);

/**
 * @module slides/student-runtime-bridge
 * Lightweight runtime bridge for student app state synchronization.
 */
(function attachStudentRuntimeBridge(root) {
    'use strict';

    const CONNECTION_STATES = new Set(['idle', 'connecting', 'connected', 'retrying', 'offline']);
    const TRANSPORT_MODES = new Set(['p2p', 'relay']);

    const toSafeString = (value, max = 120) => String(value == null ? '' : value).trim().slice(0, max);
    const toSafeInt = (value, fallback = 0) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.trunc(n);
    };

    function normalizePatch(rawPatch = {}) {
        const patch = (rawPatch && typeof rawPatch === 'object') ? rawPatch : {};
        /** @type {Record<string, unknown>} */
        const out = {};
        if ('roomId' in patch) out.roomId = toSafeString(patch.roomId, 120);
        if ('pseudo' in patch) out.pseudo = toSafeString(patch.pseudo, 80);
        if ('transportMode' in patch) {
            const mode = toSafeString(patch.transportMode, 16).toLowerCase();
            out.transportMode = TRANSPORT_MODES.has(mode) ? mode : 'p2p';
        }
        if ('connectionState' in patch) {
            const state = toSafeString(patch.connectionState, 24).toLowerCase();
            out.connectionState = CONNECTION_STATES.has(state) ? state : 'idle';
        }
        if ('connected' in patch) out.connected = !!patch.connected;
        if ('currentIndex' in patch) out.currentIndex = Math.max(0, toSafeInt(patch.currentIndex, 0));
        if ('currentFragmentOrder' in patch) out.currentFragmentOrder = toSafeInt(patch.currentFragmentOrder, -1);
        if ('presenterIndex' in patch) out.presenterIndex = Math.max(0, toSafeInt(patch.presenterIndex, 0));
        if ('followPresenter' in patch) out.followPresenter = !!patch.followPresenter;
        if ('quizActive' in patch) out.quizActive = !!patch.quizActive;
        if ('quizAnswered' in patch) out.quizAnswered = !!patch.quizAnswered;
        return out;
    }

    /**
     * @param {{
     *   runtime?: { assign?: (patch: Record<string, unknown>) => unknown } | null,
     *   initialState?: Record<string, unknown> | null,
     * }} [options]
     */
    function createStudentRuntimeBridge(options = {}) {
        const runtime = options.runtime || null;
        let snapshot = {};

        const sync = patch => {
            const normalized = normalizePatch(patch);
            if (!Object.keys(normalized).length) return { ...snapshot };
            snapshot = { ...snapshot, ...normalized };
            if (runtime && typeof runtime.assign === 'function') {
                runtime.assign(normalized);
            }
            return { ...snapshot };
        };

        if (options.initialState) sync(options.initialState);

        return {
            sync,
            snapshot() {
                return { ...snapshot };
            },
            setPseudo(value) {
                return sync({ pseudo: value }).pseudo || '';
            },
            setTransportMode(value) {
                return sync({ transportMode: value }).transportMode || 'p2p';
            },
            setConnectionState(value, connected) {
                const patch = { connectionState: value };
                if (connected !== undefined) patch.connected = !!connected;
                else if (String(value || '').toLowerCase() === 'connected') patch.connected = true;
                return sync(patch).connectionState || 'idle';
            },
            setConnected(value) {
                return !!sync({ connected: !!value }).connected;
            },
            setCurrentIndex(value) {
                return Number(sync({ currentIndex: value }).currentIndex || 0);
            },
            setCurrentFragmentOrder(value) {
                return Number(sync({ currentFragmentOrder: value }).currentFragmentOrder || -1);
            },
            setPresenterIndex(value) {
                return Number(sync({ presenterIndex: value }).presenterIndex || 0);
            },
            setFollowPresenter(value) {
                return !!sync({ followPresenter: !!value }).followPresenter;
            },
            setQuizActive(value) {
                return !!sync({ quizActive: !!value }).quizActive;
            },
            setQuizAnswered(value) {
                return !!sync({ quizAnswered: !!value }).quizAnswered;
            },
        };
    }

    root.OEIStudentRuntimeBridge = Object.freeze({
        create: createStudentRuntimeBridge,
        testUtils: Object.freeze({
            normalizePatch,
        }),
    });
})(window);

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
