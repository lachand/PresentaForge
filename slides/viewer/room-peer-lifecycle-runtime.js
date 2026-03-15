// @ts-check

/**
 * @param {any} value
 * @param {number} [maxLen]
 * @returns {string}
 */
function defaultTrim(value, maxLen = 0) {
    const out = String(value ?? '').trim();
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
 * @param {string} text
 * @returns {boolean}
 */
function isNetworkPeerError(text) {
    const safe = String(text || '');
    return ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(safe);
}

/**
 * @param {string} rawId
 * @param {{ generateRoomId?: () => string, maxLen?: number }} [options]
 * @returns {string}
 */
function sanitizeRoomId(rawId, options = {}) {
    const maxLen = Number.isFinite(Number(options.maxLen)) ? Math.max(8, Math.trunc(Number(options.maxLen))) : 40;
    const cleaned = String(rawId || '')
        .trim()
        .replace(/[^a-zA-Z0-9\-_]/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, maxLen);
    if (cleaned) return cleaned;
    const fallback = (typeof options.generateRoomId === 'function') ? String(options.generateRoomId() || '') : '';
    return sanitizeRoomId(fallback, { maxLen }) || 'room-default';
}

/**
 * @param {Document|{ getElementById?: Function }} doc
 * @returns {{ input: any, refresh: any }}
 */
function getRoomIdElements(doc) {
    const get = (doc && typeof doc.getElementById === 'function') ? (id => doc.getElementById(id)) : (() => null);
    return {
        input: get('rm-room-id-input'),
        refresh: get('rm-room-id-refresh'),
    };
}

/**
 * @param {Document|{ getElementById?: Function }} doc
 * @param {boolean} disabled
 */
function setRoomIdInputsDisabled(doc, disabled) {
    const els = getRoomIdElements(doc);
    if (els.input) els.input.disabled = !!disabled;
    if (els.refresh) els.refresh.disabled = !!disabled;
}

/**
 * @param {Object} params
 * @param {{ peer?: any, connections: any[], students: Record<string, any>, active: boolean, studentUrl?: string }} params.room
 * @param {{ active: boolean }} params.relayRoom
 * @param {any[]} params.roomHands
 * @param {{ lastByPeer?: Map<string, number> }} params.roomFeedback
 * @param {Map<string, any>} params.roomSeenByPeer
 * @param {{ clear: () => void, schedule: (reason?: string) => boolean, resetAttempts: () => void }} params.peerReconnectRuntime
 * @param {(text: string, tone?: string) => void} params.roomSetStatus
 * @param {(value: any) => string} [params.roomEsc]
 * @param {(icon: string, label: string) => string} [params.withIcon]
 * @param {(id: string) => string} params.buildStudentUrl
 * @param {() => string} params.generateRoomId
 * @param {(roomId: string) => void} [params.remoteLoadConfig]
 * @param {(peerId: string) => void} [params.remoteDropPeer]
 * @param {(roomId: string) => void} [params.relayOpen]
 * @param {() => void} [params.relayClose]
 * @param {(conn: any) => void} params.roomSendInit
 * @param {(conn: any, msg: any) => void|Promise<void>} params.roomHandleIncoming
 * @param {() => void} params.roomUpdatePanel
 * @param {() => void} [params.roomUpdateStudents]
 * @param {() => void} [params.runRoomPreviewUpdater]
 * @param {(msg: any) => void} [params.roomBroadcast]
 * @param {(active: boolean) => void} [params.setRoomIdInputsDisabled]
 * @param {(key: string, value: string) => boolean} [params.storageSetRaw]
 * @param {string} [params.lastRoomIdKey]
 * @param {{ isPeerScriptLoaded?: () => boolean, markPeerScriptLoaded?: () => void, studentRoom?: any, studentRoomBroadcast?: any }} [params.viewerRuntime]
 * @param {{ enabled?: boolean, wsUrl?: string }} [params.relayOptions]
 * @param {any} [params.peerOptions]
 * @param {(mode: string, persist?: boolean) => void} [params.switchRoomPresenterMode]
 * @param {boolean} [params.isPresenterMode]
 * @param {Document|{ getElementById?: Function, createElement?: Function, head?: any }} [params.documentRef]
 * @param {{ clipboard?: { writeText?: (value: string) => Promise<void> } }} [params.navigatorRef]
 * @param {{ Peer?: any }} [params.windowRef]
 * @param {string} [params.peerScriptSrc]
 * @param {any} [params.peerCtor]
 * @param {() => void} [params.onPeerOpen]
 */
export function createRoomPeerLifecycleRuntime(params = {}) {
    const room = (params.room && typeof params.room === 'object') ? params.room : { connections: [], students: {}, active: false };
    const relayRoom = (params.relayRoom && typeof params.relayRoom === 'object') ? params.relayRoom : { active: false };
    const roomHands = Array.isArray(params.roomHands) ? params.roomHands : [];
    const roomFeedback = (params.roomFeedback && typeof params.roomFeedback === 'object')
        ? params.roomFeedback
        : { lastByPeer: new Map() };
    const roomSeenByPeer = (params.roomSeenByPeer instanceof Map) ? params.roomSeenByPeer : new Map();
    const peerReconnectRuntime = params.peerReconnectRuntime || { clear: () => {}, schedule: () => false, resetAttempts: () => {} };
    const roomSetStatus = (typeof params.roomSetStatus === 'function') ? params.roomSetStatus : () => {};
    const roomEsc = (typeof params.roomEsc === 'function') ? params.roomEsc : defaultEsc;
    const withIcon = (typeof params.withIcon === 'function') ? params.withIcon : ((_, label) => label);
    const buildStudentUrl = (typeof params.buildStudentUrl === 'function') ? params.buildStudentUrl : (() => '');
    const generateRoomId = (typeof params.generateRoomId === 'function') ? params.generateRoomId : (() => 'room-default');
    const remoteLoadConfig = (typeof params.remoteLoadConfig === 'function') ? params.remoteLoadConfig : () => {};
    const remoteDropPeer = (typeof params.remoteDropPeer === 'function') ? params.remoteDropPeer : () => {};
    const relayOpen = (typeof params.relayOpen === 'function') ? params.relayOpen : () => {};
    const relayClose = (typeof params.relayClose === 'function') ? params.relayClose : () => {};
    const roomSendInit = (typeof params.roomSendInit === 'function') ? params.roomSendInit : () => {};
    const roomHandleIncoming = (typeof params.roomHandleIncoming === 'function') ? params.roomHandleIncoming : () => {};
    const roomUpdatePanel = (typeof params.roomUpdatePanel === 'function') ? params.roomUpdatePanel : () => {};
    const roomUpdateStudents = (typeof params.roomUpdateStudents === 'function') ? params.roomUpdateStudents : roomUpdatePanel;
    const runRoomPreviewUpdater = (typeof params.runRoomPreviewUpdater === 'function') ? params.runRoomPreviewUpdater : () => {};
    const roomBroadcast = (typeof params.roomBroadcast === 'function') ? params.roomBroadcast : () => {};
    const setRoomIdInputsDisabledFn = (typeof params.setRoomIdInputsDisabled === 'function')
        ? params.setRoomIdInputsDisabled
        : (active => setRoomIdInputsDisabled(params.documentRef || (typeof document !== 'undefined' ? document : null), active));
    const storageSetRaw = (typeof params.storageSetRaw === 'function') ? params.storageSetRaw : () => false;
    const lastRoomIdKey = defaultTrim(params.lastRoomIdKey || '', 120);
    const viewerRuntime = (params.viewerRuntime && typeof params.viewerRuntime === 'object') ? params.viewerRuntime : {};
    const relayOptions = params.relayOptions || { enabled: false, wsUrl: '' };
    const peerOptions = params.peerOptions || {};
    const switchRoomPresenterMode = (typeof params.switchRoomPresenterMode === 'function') ? params.switchRoomPresenterMode : () => {};
    const isPresenterMode = !!params.isPresenterMode;
    const doc = params.documentRef || (typeof document !== 'undefined' ? document : null);
    const nav = params.navigatorRef || (typeof navigator !== 'undefined' ? navigator : null);
    const win = params.windowRef || (typeof window !== 'undefined' ? window : null);
    const peerScriptSrc = defaultTrim(params.peerScriptSrc || '../vendor/peerjs/1.5.5/peerjs.min.js', 280);
    const onPeerOpen = (typeof params.onPeerOpen === 'function') ? params.onPeerOpen : () => {};

    const ensurePeerCtor = async () => {
        if (typeof params.peerCtor === 'function') return params.peerCtor;
        if (win && typeof win.Peer === 'function') return win.Peer;
        if (!doc || typeof doc.createElement !== 'function' || !doc.head) {
            throw new Error('PeerJS indisponible (document/head manquant)');
        }
        await new Promise((resolve, reject) => {
            if (typeof viewerRuntime.isPeerScriptLoaded === 'function' && viewerRuntime.isPeerScriptLoaded()) {
                const wait = () => {
                    if (win && typeof win.Peer === 'function') {
                        resolve();
                    } else {
                        setTimeout(wait, 100);
                    }
                };
                wait();
                return;
            }
            if (typeof viewerRuntime.markPeerScriptLoaded === 'function') viewerRuntime.markPeerScriptLoaded();
            const scriptEl = doc.createElement('script');
            scriptEl.src = peerScriptSrc;
            scriptEl.onload = () => resolve();
            scriptEl.onerror = err => reject(err || new Error('PeerJS script load failed'));
            doc.head.appendChild(scriptEl);
        });
        if (win && typeof win.Peer === 'function') return win.Peer;
        throw new Error('PeerJS indisponible après chargement script');
    };

    const clearPeerReconnectTimer = () => {
        peerReconnectRuntime.clear();
    };

    const schedulePeerReconnect = (reason = '') => {
        return peerReconnectRuntime.schedule(reason);
    };

    const _setCopyButtonConnectingState = () => {
        const copyBtn = doc && typeof doc.getElementById === 'function' ? doc.getElementById('sl-room-copy') : null;
        if (!copyBtn) return;
        copyBtn.disabled = true;
        copyBtn.innerHTML = withIcon('refresh', 'Connexion…');
    };

    const _setCopyButtonReadyState = studentUrl => {
        const copyBtn = doc && typeof doc.getElementById === 'function' ? doc.getElementById('sl-room-copy') : null;
        if (!copyBtn) return;
        copyBtn.disabled = false;
        copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
        copyBtn.onclick = () => {
            const writeText = nav?.clipboard && typeof nav.clipboard.writeText === 'function'
                ? nav.clipboard.writeText(studentUrl)
                : Promise.reject(new Error('clipboard-unavailable'));
            writeText.then(() => {
                copyBtn.innerHTML = withIcon('check', 'Copié !');
                setTimeout(() => {
                    if (!copyBtn.isConnected) return;
                    copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                }, 2000);
            }).catch(() => {});
        };
    };

    const _removeConnection = conn => {
        room.connections = room.connections.filter(c => c !== conn);
        const peerId = defaultTrim(conn?.peer || '', 160);
        const hi = roomHands.findIndex(h => defaultTrim(h?.peer || h?.peerId, 160) === peerId || defaultTrim(h?.peerId, 160) === peerId);
        if (hi !== -1) roomHands.splice(hi, 1);
        if (roomFeedback?.lastByPeer && typeof roomFeedback.lastByPeer.delete === 'function') {
            roomFeedback.lastByPeer.delete(peerId);
        }
        roomSeenByPeer.delete(peerId);
        remoteDropPeer(peerId);
        if (room.students && typeof room.students === 'object') delete room.students[peerId];
        roomUpdatePanel();
    };

    const openPeer = async () => {
        if (room.active) return false;
        const PeerCtor = await ensurePeerCtor();
        const idElements = getRoomIdElements(doc);
        const rawId = defaultTrim(idElements.input?.value || '', 160);
        const roomId = sanitizeRoomId(rawId, { generateRoomId, maxLen: 40 });
        if (idElements.input) idElements.input.value = roomId;
        if (lastRoomIdKey) storageSetRaw(lastRoomIdKey, roomId);
        remoteLoadConfig(roomId);
        setRoomIdInputsDisabledFn(true);
        _setCopyButtonConnectingState();
        roomSetStatus('Connexion P2P…', 'warn');

        room.peer = new PeerCtor(roomId, peerOptions);

        room.peer.on('open', id => {
            clearPeerReconnectTimer();
            peerReconnectRuntime.resetAttempts();
            room.active = true;
            viewerRuntime.studentRoom = room;
            viewerRuntime.studentRoomBroadcast = roomBroadcast;

            const studentUrl = buildStudentUrl(id);
            room.studentUrl = studentUrl;
            _setCopyButtonReadyState(studentUrl);

            if (relayOptions.enabled && relayOptions.wsUrl) relayOpen(id);
            roomSetStatus(relayRoom.active ? 'Salle active (P2P + relay).' : 'Salle active.', 'ok');
            roomUpdateStudents();
            if (isPresenterMode) switchRoomPresenterMode('technique', true);
            onPeerOpen();
        });

        room.peer.on('disconnected', () => {
            schedulePeerReconnect('signalisation');
        });

        room.peer.on('connection', conn => {
            conn.on('open', () => {
                room.connections.push(conn);
                roomSendInit(conn);
            });
            conn.on('data', rawMsg => {
                roomHandleIncoming(conn, rawMsg);
            });

            let removed = false;
            const removeConn = () => {
                if (removed) return;
                removed = true;
                _removeConnection(conn);
            };
            conn.on('close', removeConn);
            conn.on('error', removeConn);
        });

        room.peer.on('error', err => {
            const peerError = err || {};
            if (peerError.type === 'unavailable-id') {
                setRoomIdInputsDisabledFn(false);
                room.active = false;
                roomSetStatus('ID de salle déjà utilisé.', 'error');
                runRoomPreviewUpdater();
                return;
            }
            if (isNetworkPeerError(peerError.type)) {
                schedulePeerReconnect(peerError.type);
                return;
            }
            setRoomIdInputsDisabledFn(false);
            room.active = false;
            roomSetStatus(`Erreur salle: ${roomEsc(peerError.message || String(peerError))}`, 'error');
            runRoomPreviewUpdater();
            roomUpdatePanel();
        });
        return true;
    };

    /**
     * @param {{ setStatus?: boolean, statusText?: string, statusTone?: string, updatePanel?: boolean, switchPresenterMode?: boolean, runPreviewUpdater?: boolean }} [options]
     */
    const closeTransport = (options = {}) => {
        clearPeerReconnectTimer();
        peerReconnectRuntime.resetAttempts();
        room.active = false;
        relayClose();
        if (room.peer) {
            try { room.peer.destroy(); } catch (_) {}
            room.peer = null;
        }
        room.connections = [];
        room.students = {};
        roomSeenByPeer.clear();
        roomHands.length = 0;
        if (roomFeedback?.lastByPeer && typeof roomFeedback.lastByPeer.clear === 'function') {
            roomFeedback.lastByPeer.clear();
        }
        setRoomIdInputsDisabledFn(false);
        if (options.runPreviewUpdater !== false) runRoomPreviewUpdater();
        if (options.setStatus !== false) {
            roomSetStatus(
                defaultTrim(options.statusText || 'Salle fermée.', 240),
                defaultTrim(options.statusTone || '', 40)
            );
        }
        if (options.updatePanel !== false) roomUpdatePanel();
        if (options.switchPresenterMode !== false && isPresenterMode) {
            switchRoomPresenterMode('technique', true);
        }
    };

    return {
        openPeer,
        closeTransport,
        clearPeerReconnectTimer,
        schedulePeerReconnect,
    };
}

export const testUtils = Object.freeze({
    defaultTrim,
    defaultEsc,
    isNetworkPeerError,
    sanitizeRoomId,
    getRoomIdElements,
    setRoomIdInputsDisabled,
});

