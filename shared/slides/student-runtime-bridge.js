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
