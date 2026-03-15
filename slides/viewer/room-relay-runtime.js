// @ts-check

/**
 * @param {any} value
 * @param {number} maxLen
 * @returns {string}
 */
function defaultTrim(value, maxLen = 0) {
    if (typeof value !== 'string') return '';
    const out = value.trim();
    return maxLen > 0 ? out.slice(0, maxLen) : out;
}

/**
 * @param {any} value
 * @returns {string}
 */
function defaultEsc(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * @param {{
 *   relayRoom: {
 *     ws: any,
 *     active: boolean,
 *     roomId: string,
 *     reconnectTimer: any,
 *     reconnectAttempts: number,
 *     peers: Map<string, any>,
 *   },
 *   room: { active: boolean, students: Record<string, any>, connections: any[] },
 *   roomHands: any[],
 *   roomFeedback: { lastByPeer: Map<string, number> },
 *   roomSeenByPeer: Map<string, any>,
 *   relayOptions: { enabled: boolean, wsUrl: string, token?: string },
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   reconnectDelayMs: (attempt: number) => number,
 *   roomSetStatus: (text: string, tone?: string) => void,
 *   roomEsc?: (value: any) => string,
 *   roomHandleIncoming: (conn: any, msg: any) => void,
 *   roomUpdatePanel: () => void,
 *   createWebSocket?: (url: string) => any,
 *   now?: () => number,
 *   setTimeoutFn?: (cb: (...args: any[]) => void, delay: number) => any,
 *   clearTimeoutFn?: (timer: any) => void,
 * }} params
 */
export function createRoomRelayRuntime(params) {
    const relayRoom = params?.relayRoom;
    const room = params?.room;
    const roomHands = Array.isArray(params?.roomHands) ? params.roomHands : [];
    const roomFeedback = params?.roomFeedback;
    const roomSeenByPeer = params?.roomSeenByPeer;
    const relayOptions = params?.relayOptions || { enabled: false, wsUrl: '', token: '' };
    const toTrimmedString = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const reconnectDelayMs = typeof params?.reconnectDelayMs === 'function'
        ? params.reconnectDelayMs
        : ((attempt) => Math.max(1000, Math.trunc(Number(attempt) || 1) * 1000));
    const roomSetStatus = typeof params?.roomSetStatus === 'function' ? params.roomSetStatus : (() => {});
    const roomEsc = typeof params?.roomEsc === 'function' ? params.roomEsc : defaultEsc;
    const roomHandleIncoming = typeof params?.roomHandleIncoming === 'function' ? params.roomHandleIncoming : (() => {});
    const roomUpdatePanel = typeof params?.roomUpdatePanel === 'function' ? params.roomUpdatePanel : (() => {});
    const createWebSocket = typeof params?.createWebSocket === 'function'
        ? params.createWebSocket
        : (url => new WebSocket(url));
    const now = typeof params?.now === 'function' ? params.now : (() => Date.now());
    const setTimeoutFn = typeof params?.setTimeoutFn === 'function' ? params.setTimeoutFn : setTimeout;
    const clearTimeoutFn = typeof params?.clearTimeoutFn === 'function' ? params.clearTimeoutFn : clearTimeout;

    if (!relayRoom || typeof relayRoom !== 'object') {
        throw new Error('createRoomRelayRuntime requires relayRoom state object');
    }
    if (!relayRoom.peers || typeof relayRoom.peers.set !== 'function') {
        relayRoom.peers = new Map();
    }

    function wsOpen() {
        return !!(relayRoom.ws && relayRoom.ws.readyState === WebSocket.OPEN);
    }

    function sendRaw(payload) {
        if (!wsOpen()) return false;
        try {
            relayRoom.ws.send(JSON.stringify(payload));
            return true;
        } catch (_) {
            return false;
        }
    }

    function sendDirect(peerId, message) {
        const target = toTrimmedString(peerId, 160);
        if (!target || !message) return false;
        return sendRaw({
            type: 'relay:direct',
            roomId: relayRoom.roomId,
            token: relayOptions.token || '',
            to: target,
            message,
            at: now(),
        });
    }

    function sendBroadcast(message) {
        if (!message) return false;
        return sendRaw({
            type: 'relay:broadcast',
            roomId: relayRoom.roomId,
            token: relayOptions.token || '',
            message,
            at: now(),
        });
    }

    function connectionFor(peerId) {
        const pid = toTrimmedString(peerId, 160) || `relay-${Math.random().toString(36).slice(2, 8)}`;
        const existing = relayRoom.peers.get(pid);
        if (existing) return existing;
        const relayConn = {
            peer: pid,
            open: true,
            __transport: 'relay',
            send: payload => sendDirect(pid, payload),
        };
        relayRoom.peers.set(pid, relayConn);
        return relayConn;
    }

    function handleIncoming(raw) {
        if (!raw || typeof raw !== 'object') return;
        const envelope = raw;
        const msg = (envelope.message && typeof envelope.message === 'object')
            ? envelope.message
            : ((envelope.payload && typeof envelope.payload === 'object') ? envelope.payload : null);
        if (!msg) return;
        const from = toTrimmedString(
            envelope.from || envelope.peerId || envelope.clientId || envelope.source,
            160
        ) || 'relay-anon';
        const conn = connectionFor(from);
        roomHandleIncoming(conn, msg);
    }

    function clearReconnectTimer() {
        if (relayRoom.reconnectTimer) {
            clearTimeoutFn(relayRoom.reconnectTimer);
            relayRoom.reconnectTimer = null;
        }
    }

    function scheduleReconnect(reason = '') {
        if (!room?.active || !relayOptions.enabled || !relayOptions.wsUrl) return;
        if (relayRoom.reconnectTimer) return;
        relayRoom.reconnectAttempts += 1;
        const delay = reconnectDelayMs(relayRoom.reconnectAttempts);
        roomSetStatus(`Relay déconnecté, reconnexion…${reason ? ` (${reason})` : ''}`, 'warn');
        relayRoom.reconnectTimer = setTimeoutFn(() => {
            relayRoom.reconnectTimer = null;
            open(relayRoom.roomId);
        }, delay);
    }

    function open(roomId) {
        if (!relayOptions.enabled || !relayOptions.wsUrl || !roomId) return;
        clearReconnectTimer();
        if (relayRoom.ws) {
            try { relayRoom.ws.close(); } catch (_) {}
            relayRoom.ws = null;
        }
        relayRoom.roomId = String(roomId);
        try {
            relayRoom.ws = createWebSocket(relayOptions.wsUrl);
        } catch (_) {
            scheduleReconnect('ws-init');
            return;
        }

        relayRoom.ws.addEventListener('open', () => {
            relayRoom.active = true;
            relayRoom.reconnectAttempts = 0;
            sendRaw({
                type: 'relay:join',
                role: 'presenter',
                roomId: relayRoom.roomId,
                token: relayOptions.token || '',
                at: now(),
            });
            roomSetStatus('Salle active (P2P + relay).', 'ok');
        });

        relayRoom.ws.addEventListener('message', ev => {
            let parsed = null;
            try { parsed = JSON.parse(String(ev?.data || '')); } catch (_) { return; }
            if (Array.isArray(parsed)) {
                parsed.forEach(handleIncoming);
                return;
            }
            if (parsed?.type === 'relay:error') {
                roomSetStatus(`Relay: ${roomEsc(parsed.reason || 'erreur')}`, 'warn');
                return;
            }
            handleIncoming(parsed);
        });

        relayRoom.ws.addEventListener('close', () => {
            relayRoom.active = false;
            relayRoom.ws = null;
            relayRoom.peers.clear();
            scheduleReconnect('close');
        });

        relayRoom.ws.addEventListener('error', () => {
            relayRoom.active = false;
            roomSetStatus('Relay en erreur (fallback indisponible).', 'warn');
        });
    }

    function close() {
        clearReconnectTimer();
        relayRoom.reconnectAttempts = 0;
        relayRoom.active = false;
        relayRoom.roomId = '';
        const relayPeers = new Set(relayRoom.peers.keys());
        relayPeers.forEach(pid => {
            if (room?.students && typeof room.students === 'object') {
                delete room.students[pid];
            }
            if (roomFeedback?.lastByPeer && typeof roomFeedback.lastByPeer.delete === 'function') {
                roomFeedback.lastByPeer.delete(pid);
            }
            if (roomSeenByPeer && typeof roomSeenByPeer.delete === 'function') {
                roomSeenByPeer.delete(pid);
            }
        });
        for (let i = roomHands.length - 1; i >= 0; i--) {
            if (relayPeers.has(roomHands[i]?.peerId)) roomHands.splice(i, 1);
        }
        relayRoom.peers.clear();
        if (relayRoom.ws) {
            try { relayRoom.ws.close(); } catch (_) {}
            relayRoom.ws = null;
        }
        roomUpdatePanel();
    }

    return {
        wsOpen,
        sendRaw,
        sendDirect,
        sendBroadcast,
        open,
        close,
    };
}

export const testUtils = Object.freeze({
    defaultTrim,
    defaultEsc,
});
