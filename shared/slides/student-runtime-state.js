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
