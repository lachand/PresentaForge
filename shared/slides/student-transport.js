/**
 * @module slides/student-transport
 * Student realtime transport: PeerJS (P2P) + WebSocket relay fallback, reliable
 * message queue with acks + sessionStorage persistence, resync monitor, connection
 * watchdog, telemetry heartbeat, connection-state UI.
 * Extracted from student-main.js (Lot 20).
 */
(function attachStudentTransport(root) {
    'use strict';

    /**
     * @param {any} H - student app hub
     */
    function createStudentTransport(H) {
        const st = H.state;
        const ROOM_MSG = H.ROOM_MSG;
        const CONNECTION_STATE = H.CONNECTION_STATE;
        const NetworkSession = H.NetworkSession;
        const params = H.params;
        const roomId = H.roomId;
        const toSafeString = H.toSafeString;
        const toSafeInt = H.toSafeInt;
        const localGetJSON = H.storage.localGetJSON;
        const sessionGetJSON = H.storage.sessionGetJSON;
        const sessionSetJSON = H.storage.sessionSetJSON;
        const sessionRemove = H.storage.sessionRemove;
        const _studentTransportUI = H.transportUI;
        const StudentRuntimeBridge = H.bridge;
        const syncRuntime = H.syncRuntime;

        const MAX_RECONNECT = 30;
        const RELAY_FALLBACK_ATTEMPT = 5;
        const MAX_RESYNC_RETRY = 3;
        const RESYNC_TIMEOUT_MS = 9000;

        const PEER_OPTIONS = typeof NetworkSession.buildPeerOptions === 'function'
            ? NetworkSession.buildPeerOptions(params, localGetJSON, root.OEI_PEER_OPTIONS)
            : { debug: 0, pingInterval: 5000, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
        const RELAY_OPTIONS = typeof NetworkSession.buildRelayOptions === 'function'
            ? NetworkSession.buildRelayOptions(params, localGetJSON, root.OEI_RELAY_OPTIONS)
            : { enabled: false, wsUrl: '', token: '' };
        const reconnectDelayMsShared = attempt => (
            typeof NetworkSession.reconnectDelayMs === 'function'
                ? NetworkSession.reconnectDelayMs(attempt)
                : (Math.min(30000, Math.round(1200 * Math.pow(1.45, Math.max(0, attempt - 1)))) + Math.round(Math.random() * 500))
        );
        const nextRid = typeof NetworkSession.createRidFactory === 'function'
            ? NetworkSession.createRidFactory('st')
            : (() => {
                let seq = 0;
                return () => `st-${Date.now().toString(36)}-${(seq++).toString(36)}`;
            })();

        // ── State ────────────────────────────────────────
        let peer = null;
        let conn = null;
        let relaySocket = null;
        let relayKeepaliveTimer = null;
        let relayOpen = false;
        const relayClientId = `st-${Math.random().toString(36).slice(2, 10)}`;
        let reconnectAttempts = 0;
        const pendingAcks = new Map();
        const RELIABLE_QUEUE_PREFIX = H.storage.keys.reliablePrefix;
        let _reliableQueueKey = RELIABLE_QUEUE_PREFIX + 'anon';
        let _connectionWatchdogTimer = null;
        let _forceReconnectCooldownUntil = 0;
        let _resyncMonitorTimer = null;
        let _resyncPending = false;
        let _resyncRetryCount = 0;
        let _resyncLastReason = '';
        let _telemetryTimer = null;
        let _lastTelemetryAt = 0;
        let _trailingTelemetryTimer = null;
        let _buildConnPending = false;
        let _reconnectTimer = null;
        let _connOpenTimer = null;
        let _peerOpenTimer = null;
        let _lastConnectError = '';

        const modeLabel = () => (st.transportMode === 'relay' ? 'Relay' : 'P2P');

        // ── Connection-state UI ──────────────────────────
        function setConnectionDetail(text, tone = '') {
            if (_studentTransportUI?.setConnectionDetail) {
                _studentTransportUI.setConnectionDetail(text, tone);
                return;
            }
            const state = document.getElementById('conn-state');
            if (!state) return;
            state.textContent = String(text || '');
            state.classList.remove('ok', 'warn', 'error');
            if (tone) state.classList.add(tone);
            state.title = state.textContent;
        }

        function setConnectionState(nextState, detail = '', tone = '') {
            if (_studentTransportUI?.setConnectionState) {
                _studentTransportUI.setConnectionState(nextState, { detail, tone });
                if (_studentTransportUI?.getState) st.connectionState = _studentTransportUI.getState();
                if (_studentTransportUI?.getStateSince) st.connectionStateSince = _studentTransportUI.getStateSince();
                return;
            }
            const normalized = Object.values(CONNECTION_STATE).includes(nextState) ? nextState : CONNECTION_STATE.IDLE;
            st.connectionState = normalized;
            st.connectionStateSince = Date.now();
            if (StudentRuntimeBridge?.setConnectionState) {
                StudentRuntimeBridge.setConnectionState(normalized, normalized === CONNECTION_STATE.CONNECTED);
                H.syncTransportMode();
            } else {
                syncRuntime({
                    connectionState: normalized,
                    transportMode: st.transportMode,
                    connected: normalized === CONNECTION_STATE.CONNECTED,
                });
            }

            const badge = document.getElementById('conn-badge');
            if (badge) {
                badge.classList.toggle('disconnected', normalized !== CONNECTION_STATE.CONNECTED);
                badge.classList.toggle('connecting', normalized === CONNECTION_STATE.CONNECTING);
                badge.classList.toggle('retrying', normalized === CONNECTION_STATE.RETRYING);
                badge.classList.toggle('offline', normalized === CONNECTION_STATE.OFFLINE);
                const titleMap = {
                    [CONNECTION_STATE.IDLE]: 'En attente',
                    [CONNECTION_STATE.CONNECTING]: 'Connexion en cours',
                    [CONNECTION_STATE.CONNECTED]: 'Connecté',
                    [CONNECTION_STATE.RETRYING]: 'Reconnexion en cours',
                    [CONNECTION_STATE.OFFLINE]: 'Hors ligne',
                };
                badge.title = titleMap[normalized] || 'État réseau';
            }

            const banner = document.getElementById('reconnect-banner');
            if (banner) {
                const showBanner = normalized === CONNECTION_STATE.CONNECTING
                    || normalized === CONNECTION_STATE.RETRYING
                    || normalized === CONNECTION_STATE.OFFLINE;
                banner.classList.toggle('visible', showBanner);
                if (!showBanner) banner.textContent = '';
            }

            const label = modeLabel();
            const stateLabel = {
                [CONNECTION_STATE.IDLE]: `${label} · en attente`,
                [CONNECTION_STATE.CONNECTING]: `${label} · connexion…`,
                [CONNECTION_STATE.CONNECTED]: `${label} · connecté`,
                [CONNECTION_STATE.RETRYING]: `${label} · reconnexion…`,
                [CONNECTION_STATE.OFFLINE]: `${label} · hors ligne`,
            }[normalized] || `${label} · état inconnu`;
            const stateTone = tone || (
                normalized === CONNECTION_STATE.CONNECTED ? 'ok'
                    : normalized === CONNECTION_STATE.OFFLINE ? 'error'
                        : 'warn'
            );
            setConnectionDetail(detail || stateLabel, stateTone);
        }

        function setConnected(connected) {
            if (_studentTransportUI?.setConnected) {
                _studentTransportUI.setConnected(!!connected);
                if (_studentTransportUI?.getState) st.connectionState = _studentTransportUI.getState();
                if (_studentTransportUI?.getStateSince) st.connectionStateSince = _studentTransportUI.getStateSince();
            } else {
                setConnectionState(connected ? CONNECTION_STATE.CONNECTED : CONNECTION_STATE.RETRYING);
                if (StudentRuntimeBridge?.setConnected) StudentRuntimeBridge.setConnected(!!connected);
                else syncRuntime({ connected: !!connected });
            }
            if (connected) {
                _startTelemetryLoop();
                sendStudentTelemetry('connected', true);
            } else {
                _stopTelemetryLoop();
                _clearResyncMonitor();
            }
        }

        // ── Reliable queue persistence ───────────────────
        function _persistReliableQueue() {
            if (!_reliableQueueKey) return;
            const entries = Array.from(pendingAcks.values()).map(rec => ({
                rid: rec.rid,
                payload: rec.payload,
                retries: Number(rec.retries) || 0,
                maxRetries: Number(rec.maxRetries) || 3,
                retryDelay: Number(rec.retryDelay) || 1300,
                createdAt: Number(rec.createdAt) || Date.now(),
                lastSentAt: Number(rec.lastSentAt) || 0,
            }));
            if (!entries.length) {
                sessionRemove(_reliableQueueKey);
                return;
            }
            sessionSetJSON(_reliableQueueKey, entries.slice(0, 160));
        }

        function _restoreReliableQueue() {
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            const saved = sessionGetJSON(_reliableQueueKey, []);
            if (!Array.isArray(saved)) return;
            saved.slice(0, 160).forEach(raw => {
                if (!raw || typeof raw !== 'object') return;
                const rid = toSafeString(raw.rid, 120);
                const payload = (raw.payload && typeof raw.payload === 'object')
                    ? Object.assign({}, raw.payload)
                    : null;
                if (!rid || !payload || !toSafeString(payload.type, 80)) return;
                payload.rid = rid;
                payload.ts = Number(payload.ts) || Date.now();
                pendingAcks.set(rid, {
                    rid,
                    payload,
                    retries: Math.max(0, Number(raw.retries) || 0),
                    maxRetries: Math.max(1, Number(raw.maxRetries) || 3),
                    retryDelay: Math.max(500, Number(raw.retryDelay) || 1300),
                    createdAt: Number(raw.createdAt) || Date.now(),
                    lastSentAt: Number(raw.lastSentAt) || 0,
                    timer: null,
                });
            });
            if (pendingAcks.size) _persistReliableQueue();
        }

        function _setReliableQueueScope(nextPseudo) {
            const nextKey = RELIABLE_QUEUE_PREFIX + H.storage.safePseudoPart(nextPseudo);
            if (nextKey === _reliableQueueKey) return;
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            _reliableQueueKey = nextKey;
            _restoreReliableQueue();
        }

        function _scheduleReliableRetry(rid, immediate = false) {
            const safeRid = toSafeString(rid, 120);
            if (!safeRid) return;
            const rec = pendingAcks.get(safeRid);
            if (!rec) return;
            if (rec.timer) {
                clearTimeout(rec.timer);
                rec.timer = null;
            }
            const runAttempt = () => {
                const current = pendingAcks.get(safeRid);
                if (!current) return;
                if (current.retries >= current.maxRetries) {
                    clearPendingAck(safeRid);
                    if (st.connectionState === CONNECTION_STATE.CONNECTED) {
                        setConnectionDetail(`${modeLabel()} · message non confirmé`, 'warn');
                    }
                    return;
                }
                const canSend = transportCanSend();
                if (canSend && transportSend(current.payload)) {
                    current.retries += 1;
                    current.lastSentAt = Date.now();
                    _persistReliableQueue();
                }
                const nextDelay = canSend ? current.retryDelay : Math.min(current.retryDelay, 1800);
                current.timer = setTimeout(runAttempt, nextDelay);
            };
            if (immediate) {
                runAttempt();
                return;
            }
            rec.timer = setTimeout(runAttempt, rec.retryDelay);
        }

        function _flushReliableQueue(reason = '') {
            if (!pendingAcks.size) return;
            const canSend = transportCanSend();
            for (const rid of pendingAcks.keys()) _scheduleReliableRetry(rid, canSend);
            if (reason && canSend) {
                setConnectionDetail(`${modeLabel()} · reprise (${pendingAcks.size} msg)`, 'warn');
            }
        }

        function transportCanSend() {
            return !!(conn && conn.open);
        }

        function transportSend(message) {
            if (!transportCanSend()) return false;
            try {
                conn.send(message);
                return true;
            } catch (e) {
                return false;
            }
        }

        function clearPendingAck(rid) {
            const safeRid = toSafeString(rid, 120);
            if (!safeRid) return;
            const pending = pendingAcks.get(safeRid);
            if (pending?.timer) clearTimeout(pending.timer);
            pendingAcks.delete(safeRid);
            _persistReliableQueue();
        }

        function clearAllPendingAcks(options = {}) {
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            if (options.purgeStorage) {
                sessionRemove(_reliableQueueKey);
                return;
            }
            _persistReliableQueue();
        }

        function sendReliable(message, options = {}) {
            if (!message || typeof message !== 'object') return null;
            const rid = toSafeString(message.rid, 120) || nextRid();
            const maxRetries = Math.max(1, Number(options.maxRetries ?? 3) || 1);
            const retryDelay = Math.max(500, Number(options.retryDelay ?? 1300) || 1300);
            const payload = Object.assign({}, message, { rid, ts: message.ts || Date.now() });
            const prev = pendingAcks.get(rid);
            if (prev?.timer) clearTimeout(prev.timer);
            pendingAcks.set(rid, {
                rid,
                payload,
                retries: 0,
                maxRetries,
                retryDelay,
                createdAt: Number(prev?.createdAt) || Date.now(),
                lastSentAt: Number(prev?.lastSentAt) || 0,
                timer: null,
            });
            _persistReliableQueue();
            _scheduleReliableRetry(rid, true);
            return rid;
        }

        // ── Telemetry ────────────────────────────────────
        function _buildTelemetryPayload(reason = 'heartbeat', ts = Date.now()) {
            return {
                type: ROOM_MSG.STUDENT_TELEMETRY,
                pseudo: st.pseudo,
                state: st.connectionState,
                transport: st.transportMode,
                reason: toSafeString(reason, 40) || 'heartbeat',
                ts: Math.max(0, Math.trunc(ts)),
                slideIndex: Math.max(0, Math.trunc(Number(st.currentIndex) || 0)),
                fragmentOrder: Math.trunc(Number(st.currentFragmentOrder) || -1),
                followPresenter: !!st.followPresenter,
                handRaised: !!st.handRaised,
                queueDepth: Math.max(0, pendingAcks.size),
            };
        }

        function sendStudentTelemetry(reason = 'heartbeat', force = false) {
            if (!st.pseudo || !transportCanSend()) return false;
            const now = Date.now();
            const elapsed = now - _lastTelemetryAt;
            const minDelay = reason === 'heartbeat' ? 12_000 : 2_500;
            if (!force && elapsed < minDelay) {
                // Throttlé : la position de l'élève (slide/fragment) a peut-être
                // bougé et le viewer s'en sert de repli pour taguer réactions et
                // questions. On planifie un envoi de rattrapage en fin de fenêtre
                // pour que l'état final soit toujours reporté.
                if (reason !== 'heartbeat' && !_trailingTelemetryTimer) {
                    _trailingTelemetryTimer = setTimeout(() => {
                        _trailingTelemetryTimer = null;
                        sendStudentTelemetry('position', true);
                    }, Math.max(0, minDelay - elapsed) + 50);
                }
                return false;
            }
            if (_trailingTelemetryTimer) { clearTimeout(_trailingTelemetryTimer); _trailingTelemetryTimer = null; }
            _lastTelemetryAt = now;
            return transportSend(_buildTelemetryPayload(reason, now));
        }

        function _startTelemetryLoop() {
            if (_telemetryTimer) return;
            _telemetryTimer = setInterval(() => {
                if (document.hidden) return;
                sendStudentTelemetry('heartbeat');
            }, 15_000);
        }

        function _stopTelemetryLoop() {
            if (_telemetryTimer) {
                clearInterval(_telemetryTimer);
                _telemetryTimer = null;
            }
            if (_trailingTelemetryTimer) {
                clearTimeout(_trailingTelemetryTimer);
                _trailingTelemetryTimer = null;
            }
        }

        // ── Connection watchdog ──────────────────────────
        function _startConnectionWatchdog() {
            if (_connectionWatchdogTimer) return;
            _connectionWatchdogTimer = setInterval(() => {
                if (document.hidden || !st.pseudo) return;
                if (st.connectionState === CONNECTION_STATE.CONNECTED || st.connectionState === CONNECTION_STATE.IDLE) return;
                const elapsed = Date.now() - st.connectionStateSince;
                if (elapsed < 22000) return;
                const hasReconnectPath = !!(_reconnectTimer || _connOpenTimer || _peerOpenTimer);
                if (hasReconnectPath) return;
                const now = Date.now();
                if (now < _forceReconnectCooldownUntil) return;
                _forceReconnectCooldownUntil = now + 8000;
                forceReconnectNow('watchdog');
            }, 3500);
        }

        // ── Resync monitor ───────────────────────────────
        function _clearResyncMonitor() {
            if (_resyncMonitorTimer) {
                clearTimeout(_resyncMonitorTimer);
                _resyncMonitorTimer = null;
            }
            _resyncPending = false;
        }

        function _armResyncMonitor() {
            _clearResyncMonitor();
            _resyncPending = true;
            _resyncMonitorTimer = setTimeout(() => {
                _resyncMonitorTimer = null;
                if (!_resyncPending) return;
                _resyncRetryCount += 1;
                setConnectionDetail(
                    `${modeLabel()} · resync sans réponse (${_resyncRetryCount}/${MAX_RESYNC_RETRY})`,
                    'warn'
                );
                if (_resyncRetryCount >= MAX_RESYNC_RETRY) {
                    _clearResyncMonitor();
                    forceReconnectNow('resync-timeout');
                    return;
                }
                requestResync(`retry-${_resyncLastReason || 'sync'}`);
            }, RESYNC_TIMEOUT_MS);
        }

        function _markResyncApplied(source = '') {
            if (!_resyncPending) return;
            _clearResyncMonitor();
            _resyncRetryCount = 0;
            const suffix = source ? ` (${source})` : '';
            setConnectionDetail(`${modeLabel()} · resynchronisé${suffix}`, 'ok');
        }

        function requestResync(reason = 'manual') {
            _resyncLastReason = toSafeString(reason, 40);
            const rid = sendReliable({
                type: ROOM_MSG.SYNC_REQUEST,
                reason: _resyncLastReason,
                index: st.currentIndex,
                fragmentOrder: st.currentFragmentOrder,
                transport: st.transportMode,
            }, { maxRetries: 4, retryDelay: 1200 });
            if (rid) {
                _armResyncMonitor();
                const waitEl = document.getElementById('waiting-text');
                const connected = transportCanSend();
                if (waitEl) waitEl.textContent = connected
                    ? 'Demande de resynchronisation envoyée…'
                    : 'Resynchronisation en file locale (en attente réseau)…';
                setConnectionDetail(
                    `${modeLabel()} · ${connected ? 'resync demandé' : 'resync en attente'}`,
                    connected ? 'warn' : 'error'
                );
            }
        }

        // ── PeerJS / Relay connection ────────────────────
        function clearConnOpenTimer() {
            if (_connOpenTimer) { clearTimeout(_connOpenTimer); _connOpenTimer = null; }
        }
        function clearReconnectTimer() {
            if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
        }
        function clearPeerOpenTimer() {
            if (_peerOpenTimer) { clearTimeout(_peerOpenTimer); _peerOpenTimer = null; }
        }

        function setReconnectMessage(reason, delayMs = 0, forcedMode = '') {
            const waitEl = document.getElementById('waiting-text');
            const banner = document.getElementById('reconnect-banner');
            const mode = (forcedMode || st.transportMode) === 'relay' ? 'Relay' : 'P2P';
            const left = delayMs > 0 ? ` · retry ${Math.max(1, Math.round(delayMs / 1000))}s` : '';
            const safeReason = toSafeString(reason || _lastConnectError || 'reconnexion', 80);
            const text = `${mode} · ${safeReason}${left}`;
            if (waitEl) waitEl.textContent = text;
            if (banner) banner.textContent = `Connexion instable — ${text}`;
            setConnectionState(CONNECTION_STATE.RETRYING, text, 'warn');
        }

        function relaySocketReady() {
            return !!(relaySocket && relaySocket.readyState === WebSocket.OPEN);
        }

        function closeRelaySocket(resetTransport = true) {
            relayOpen = false;
            if (relayKeepaliveTimer) { clearInterval(relayKeepaliveTimer); relayKeepaliveTimer = null; }
            if (conn && conn.__transport === 'relay') conn.open = false;
            if (relaySocket) {
                try { relaySocket.close(); } catch (e) {}
                relaySocket = null;
            }
            if (resetTransport && st.transportMode === 'relay') {
                st.transportMode = 'p2p';
                H.syncTransportMode();
            }
        }

        function relaySendEnvelope(type, message, extra = {}) {
            if (!relaySocketReady()) return false;
            const payload = Object.assign({
                type,
                roomId,
                token: RELAY_OPTIONS.token || '',
                from: relayClientId,
                at: Date.now(),
            }, extra || {});
            if (message && typeof message === 'object') payload.message = message;
            try {
                relaySocket.send(JSON.stringify(payload));
                return true;
            } catch (e) {
                return false;
            }
        }

        function relayConnSend(message) {
            return relaySendEnvelope('relay:up', message);
        }

        function connectViaRelay(reason = '') {
            if (!RELAY_OPTIONS.enabled || !RELAY_OPTIONS.wsUrl) return false;
            clearConnOpenTimer();
            clearPeerOpenTimer();
            clearReconnectTimer();
            _buildConnPending = false;
            if (peer && !peer.destroyed) { try { peer.destroy(); } catch (e) {} }
            peer = null;
            closeRelaySocket(false);
            st.transportMode = 'relay';
            H.syncTransportMode();
            setConnectionState(CONNECTION_STATE.CONNECTING, 'Relay · connexion…', 'warn');
            setReconnectMessage(reason || 'fallback relay');
            let mySocket;
            try {
                mySocket = relaySocket = new WebSocket(RELAY_OPTIONS.wsUrl);
            } catch (e) {
                _lastConnectError = 'relay-init';
                scheduleReconnect(_lastConnectError);
                return false;
            }

            mySocket.addEventListener('open', () => {
                if (relaySocket !== mySocket) return;
                relayOpen = true;
                reconnectAttempts = 0;
                _lastConnectError = '';
                clearReconnectTimer();
                conn = {
                    open: true,
                    __transport: 'relay',
                    peer: `relay:${relayClientId}`,
                    send: relayConnSend,
                    close: () => closeRelaySocket(true),
                };
                relaySendEnvelope('relay:join', null, { role: 'student', clientId: relayClientId, pseudo: st.pseudo });
                if (relayKeepaliveTimer) clearInterval(relayKeepaliveTimer);
                relayKeepaliveTimer = setInterval(() => {
                    if (relaySocket === mySocket && relaySocketReady()) {
                        try { mySocket.send(JSON.stringify({ type: 'ping', at: Date.now() })); } catch (_) {}
                    } else {
                        clearInterval(relayKeepaliveTimer);
                        relayKeepaliveTimer = null;
                    }
                }, 25_000);
                setConnected(true);
                sendReliable({ type: ROOM_MSG.STUDENT_JOIN, pseudo: st.pseudo }, { maxRetries: 4, retryDelay: 1200 });
                _flushReliableQueue('relay-open');
                requestResync('reconnect-relay');
                H.quiz.saveScore();
            });

            mySocket.addEventListener('message', ev => {
                if (relaySocket !== mySocket) return;
                let payload = null;
                try { payload = JSON.parse(String(ev.data || '')); } catch (e) { return; }
                const packets = Array.isArray(payload) ? payload : [payload];
                packets.forEach(packet => {
                    if (!packet || typeof packet !== 'object') return;
                    const ptype = toSafeString(packet.type ?? '', 40);
                    if (ptype === 'pong') return;
                    if (ptype === 'relay:joined') return;
                    if (ptype === 'relay:error') {
                        const code = toSafeString(packet.code ?? '', 40);
                        if (code === 'no_presenter') {
                            setConnectionDetail('Relay · en attente du présentateur…', 'warn');
                        }
                        return;
                    }
                    const target = toSafeString(packet.to ?? packet.clientIdTo, 120);
                    if (target && target !== relayClientId && target !== '*' && target !== 'all') return;
                    const msg = (packet.message && typeof packet.message === 'object')
                        ? packet.message
                        : ((packet.payload && typeof packet.payload === 'object') ? packet.payload : null);
                    if (msg) {
                        H.handleMessage(msg);
                        return;
                    }
                    if (H.validateRoomMessage(packet)) {
                        H.handleMessage(packet);
                    }
                });
            });

            mySocket.addEventListener('close', () => {
                if (relaySocket !== mySocket) return;
                relayOpen = false;
                if (conn && conn.__transport === 'relay') conn.open = false;
                setConnected(false);
                scheduleReconnect('relay fermé');
            });

            mySocket.addEventListener('error', () => {
                if (relaySocket !== mySocket) return;
                relayOpen = false;
                _lastConnectError = 'relay-error';
                setConnected(false);
                scheduleReconnect(_lastConnectError);
            });
            return true;
        }

        function buildConn() {
            if (_buildConnPending) return;
            if (conn && conn.open) return;
            if (!peer || peer.destroyed || peer.disconnected) {
                reconnectSignaling();
                return;
            }
            if (conn && !conn.open && typeof conn.close === 'function') {
                try { conn.close(); } catch (e) {}
            }
            _buildConnPending = true;
            conn = peer.connect(roomId, { reliable: true });
            clearConnOpenTimer();
            _connOpenTimer = setTimeout(() => {
                if (!_buildConnPending) return;
                _lastConnectError = 'timeout';
                _buildConnPending = false;
                try { conn?.close(); } catch (e) {}
                setConnected(false);
                scheduleReconnect(_lastConnectError);
            }, 12000);

            conn.on('open', () => {
                clearConnOpenTimer();
                clearReconnectTimer();
                closeRelaySocket(false);
                st.transportMode = 'p2p';
                H.syncTransportMode();
                _buildConnPending = false;
                reconnectAttempts = 0;
                _lastConnectError = '';
                setConnected(true);
                sendReliable({ type: ROOM_MSG.STUDENT_JOIN, pseudo: st.pseudo }, { maxRetries: 4, retryDelay: 1200 });
                _flushReliableQueue('p2p-open');
                requestResync('reconnect-p2p');
                H.quiz.saveScore();
            });

            conn.on('data', H.handleMessage);

            conn.on('close', () => {
                clearConnOpenTimer();
                _buildConnPending = false;
                setConnected(false);
                scheduleReconnect('connexion fermée');
            });

            conn.on('error', err => {
                clearConnOpenTimer();
                _buildConnPending = false;
                setConnected(false);
                _lastConnectError = toSafeString(err?.type || err?.message || 'error', 80);
                scheduleReconnect(_lastConnectError);
            });
        }

        function scheduleReconnect(reason = '') {
            if (_reconnectTimer) return;
            const preferRelay = typeof NetworkSession.shouldPreferRelay === 'function'
                ? NetworkSession.shouldPreferRelay(
                    reconnectAttempts,
                    reason,
                    st.transportMode,
                    RELAY_OPTIONS,
                    RELAY_FALLBACK_ATTEMPT
                )
                : (!!(RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl)
                    && (st.transportMode === 'relay'
                        || reconnectAttempts >= RELAY_FALLBACK_ATTEMPT
                        || String(reason).includes('peer-unavailable')));
            if (reconnectAttempts >= MAX_RECONNECT) {
                if (preferRelay && st.transportMode !== 'relay') {
                    connectViaRelay('fallback final');
                    return;
                }
                const waitEl = document.getElementById('waiting-text');
                const text = 'Connexion impossible. Réseau bloquant WebRTC (ex: eduroam). Essayez 4G/partage ou relayWs.';
                if (waitEl) waitEl.textContent = text;
                setConnectionState(CONNECTION_STATE.OFFLINE, 'Connexion impossible (P2P/relay)', 'error');
                return;
            }
            reconnectAttempts++;
            const delay = reconnectDelayMsShared(reconnectAttempts);
            const mode = preferRelay ? 'relay' : 'p2p';
            setReconnectMessage(reason || `tentative ${reconnectAttempts}/${MAX_RECONNECT}`, delay, mode);
            _reconnectTimer = setTimeout(() => {
                _reconnectTimer = null;
                if (preferRelay) {
                    connectViaRelay(reason || 'fallback');
                    return;
                }
                forceReconnectNow(reason || 'retry');
            }, delay);
        }

        function reconnectSignaling() {
            if (!peer || peer.destroyed) { connectToPeer(); return; }
            try { peer.reconnect(); } catch (e) { connectToPeer(); }
        }

        function forceReconnectNow(reason = '') {
            clearConnOpenTimer();
            clearReconnectTimer();
            clearPeerOpenTimer();
            _buildConnPending = false;
            if (conn && typeof conn.close === 'function') {
                try { conn.close(); } catch (e) {}
            }
            conn = null;
            if (st.transportMode === 'relay' && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                connectViaRelay(reason || 'force-reconnect');
                return;
            }
            connectToPeer();
        }

        function connectToPeer() {
            st.transportMode = 'p2p';
            H.syncTransportMode();
            closeRelaySocket(false);
            if (peer && !peer.destroyed) { try { peer.destroy(); } catch (e) {} }
            clearConnOpenTimer();
            clearPeerOpenTimer();
            _buildConnPending = false;
            setConnectionState(CONNECTION_STATE.CONNECTING, 'P2P · connexion…', 'warn');
            peer = new Peer(undefined, PEER_OPTIONS);

            _peerOpenTimer = setTimeout(() => {
                _peerOpenTimer = null;
                if (!conn || !conn.open) {
                    try { peer?.destroy?.(); } catch (e) {}
                    peer = null;
                    setConnected(false);
                    _lastConnectError = 'signalisation-timeout';
                    scheduleReconnect(_lastConnectError);
                }
            }, 10000);

            peer.on('open', () => {
                clearPeerOpenTimer();
                clearReconnectTimer();
                buildConn();
            });

            peer.on('disconnected', () => {
                clearPeerOpenTimer();
                setConnected(false);
                scheduleReconnect('signalisation perdue');
            });

            peer.on('error', e => {
                clearPeerOpenTimer();
                setConnected(false);
                _lastConnectError = toSafeString(e?.type || e?.message || 'peer-error', 80);
                if (e?.type === 'peer-unavailable' && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                    scheduleReconnect('peer-unavailable');
                    return;
                }
                scheduleReconnect(_lastConnectError);
            });
        }

        function connect(opts = {}) {
            reconnectAttempts = 0;
            _buildConnPending = false;
            clearConnOpenTimer();
            clearReconnectTimer();
            clearPeerOpenTimer();
            setConnectionState(CONNECTION_STATE.CONNECTING, 'P2P · connexion…', 'warn');
            const requestedTransport = typeof NetworkSession.normalizeTransportMode === 'function'
                ? NetworkSession.normalizeTransportMode(params.get('transport') || 'auto')
                : toSafeString(params.get('transport'), 20).toLowerCase();
            const forceRelay = opts.forceRelay || requestedTransport === 'relay';
            if (forceRelay && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                st.transportMode = 'relay';
                H.syncTransportMode();
                connectViaRelay('transport=relay');
                return;
            }
            connectToPeer();
        }

        // ── Page lifecycle ───────────────────────────────
        function bindLifecycleEvents() {
            document.addEventListener('visibilitychange', () => {
                if (!st.pseudo) return;
                if (document.hidden) return;
                if (conn && conn.open) {
                    _flushReliableQueue('resume-visible');
                    requestResync('resume');
                    sendStudentTelemetry('resume-visible', true);
                    return;
                }
                reconnectAttempts = 0;
                _buildConnPending = false;
                clearConnOpenTimer();
                clearReconnectTimer();
                clearPeerOpenTimer();
                forceReconnectNow('resume');
            });

            window.addEventListener('online', () => {
                if (!st.pseudo) return;
                if (conn && conn.open) {
                    _flushReliableQueue('online');
                    requestResync('online');
                    sendStudentTelemetry('online', true);
                    return;
                }
                reconnectAttempts = 0;
                forceReconnectNow('online');
            });

            window.addEventListener('offline', () => {
                if (!st.pseudo) return;
                setConnectionState(CONNECTION_STATE.OFFLINE, 'Réseau local indisponible', 'error');
            });
        }

        return {
            setConnectionDetail,
            setConnectionState,
            setConnected,
            canSend: transportCanSend,
            send: transportSend,
            sendReliable,
            clearPendingAck,
            clearAllPendingAcks,
            pendingAcksSize: () => pendingAcks.size,
            flushReliableQueue: _flushReliableQueue,
            requestResync,
            sendTelemetry: sendStudentTelemetry,
            startTelemetryLoop: _startTelemetryLoop,
            stopTelemetryLoop: _stopTelemetryLoop,
            startConnectionWatchdog: _startConnectionWatchdog,
            setReliableQueueScope: _setReliableQueueScope,
            restoreReliableQueue: _restoreReliableQueue,
            isResyncPending: () => _resyncPending,
            markResyncApplied: _markResyncApplied,
            clearResyncMonitor: _clearResyncMonitor,
            connect,
            forceReconnectNow,
            bindLifecycleEvents,
            RELAY_OPTIONS,
        };
    }

    root.OEIStudentTransport = Object.freeze({ create: createStudentTransport });
})(window);
