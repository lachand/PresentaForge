// @ts-check

const DEFAULT_RECONNECT_DELAY_STEPS = [1000, 1500, 2500, 4000, 6000, 8000, 10000];

const defaultReconnectDelay = attempt => {
    const i = Math.max(0, Math.trunc(Number(attempt) || 0) - 1);
    return DEFAULT_RECONNECT_DELAY_STEPS[Math.min(i, DEFAULT_RECONNECT_DELAY_STEPS.length - 1)];
};

/**
 * @typedef {Object} RoomPeerReconnectRuntimeParams
 * @property {{ peer?: any, active?: boolean }} room
 * @property {(text: string, tone?: string) => void} roomSetStatus
 * @property {(active: boolean) => void} setRoomIdInputsDisabled
 * @property {() => void} runRoomPreviewUpdater
 * @property {(attempt: number) => number} [reconnectDelayMs]
 * @property {(fn: Function, ms: number) => any} [setTimeoutFn]
 * @property {(id: any) => void} [clearTimeoutFn]
 */

/**
 * Runtime for PeerJS reconnect scheduling in presenter room mode.
 *
 * The runtime owns attempts/timer state and exposes thin commands for
 * viewer-main (`schedule`, `clear`, `resetAttempts`).
 *
 * @param {RoomPeerReconnectRuntimeParams} params
 */
export function createRoomPeerReconnectRuntime(params = {}) {
    const room = (params.room && typeof params.room === 'object') ? params.room : {};
    const roomSetStatus = (typeof params.roomSetStatus === 'function') ? params.roomSetStatus : () => {};
    const setRoomIdInputsDisabled = (typeof params.setRoomIdInputsDisabled === 'function')
        ? params.setRoomIdInputsDisabled
        : () => {};
    const runRoomPreviewUpdater = (typeof params.runRoomPreviewUpdater === 'function')
        ? params.runRoomPreviewUpdater
        : () => {};
    const reconnectDelayMs = (typeof params.reconnectDelayMs === 'function')
        ? params.reconnectDelayMs
        : defaultReconnectDelay;
    const setTimeoutFn = (typeof params.setTimeoutFn === 'function') ? params.setTimeoutFn : setTimeout;
    const clearTimeoutFn = (typeof params.clearTimeoutFn === 'function') ? params.clearTimeoutFn : clearTimeout;

    let reconnectAttempts = 0;
    let reconnectTimer = null;

    const clear = () => {
        if (reconnectTimer) {
            clearTimeoutFn(reconnectTimer);
            reconnectTimer = null;
        }
    };

    const resetAttempts = () => {
        reconnectAttempts = 0;
    };

    const getAttempts = () => reconnectAttempts;

    const schedule = (reason = '') => {
        if (!room.peer || room.peer.destroyed) return false;
        if (reconnectTimer) return false;

        reconnectAttempts += 1;
        const delay = Math.max(0, Math.trunc(Number(reconnectDelayMs(reconnectAttempts)) || 0));
        roomSetStatus(`Connexion salle instable, reconnexion…${reason ? ` (${reason})` : ''}`, 'warn');

        reconnectTimer = setTimeoutFn(() => {
            reconnectTimer = null;
            if (!room.peer || room.peer.destroyed) return;
            try {
                room.peer.reconnect();
            } catch (_) {
                try { room.peer.destroy(); } catch (_) {}
                room.peer = null;
                room.active = false;
                setRoomIdInputsDisabled(false);
                runRoomPreviewUpdater();
            }
        }, delay);

        return true;
    };

    return {
        clear,
        schedule,
        resetAttempts,
        getAttempts,
    };
}

export const testUtils = {
    defaultReconnectDelay,
};
