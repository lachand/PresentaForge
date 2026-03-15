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
 * @returns {number | null}
 */
function defaultToIntOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {any} conn
 * @param {any} payload
 * @returns {boolean}
 */
function safeConnSend(conn, payload) {
    if (!conn || typeof conn.send !== 'function') return false;
    try {
        conn.send(payload);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * @param {number} size
 * @returns {string}
 */
function defaultRandToken(size = 18) {
    const safeSize = Math.max(8, Math.trunc(Number(size) || 18));
    try {
        if (typeof crypto?.getRandomValues === 'function' && typeof btoa === 'function') {
            const bytes = new Uint8Array(safeSize);
            crypto.getRandomValues(bytes);
            return btoa(String.fromCharCode(...bytes))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/g, '');
        }
    } catch (_) {}
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let out = '';
    for (let i = 0; i < safeSize; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

/**
 * @param {any} command
 * @param {any} payload
 * @param {{
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   toIntOrNull?: (value: any) => number | null,
 *   presenterControls?: {
 *     goNext?: (() => void) | null,
 *     goPrev?: (() => void) | null,
 *     goTo?: ((index: number) => void) | null,
 *     toggleBlack?: (() => void) | null,
 *     timerToggle?: (() => void) | null,
 *     timerReset?: (() => void) | null,
 *     switchTab?: ((tab: string) => void) | null,
 *   },
 *   deck?: any,
 * }} deps
 * @returns {{ ok: boolean, reason?: string }}
 */
export function runRemotePresenterCommand(command, payload, deps = {}) {
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    const toIntOrNull = typeof deps.toIntOrNull === 'function' ? deps.toIntOrNull : defaultToIntOrNull;
    const presenterControls = deps.presenterControls && typeof deps.presenterControls === 'object'
        ? deps.presenterControls
        : {};
    const deck = deps.deck || null;
    const cmd = trim(command, 40).toLowerCase();
    switch (cmd) {
        case 'next':
            if (typeof presenterControls.goNext === 'function') { presenterControls.goNext(); return { ok: true }; }
            if (deck && typeof deck.next === 'function') { deck.next(); return { ok: true }; }
            return { ok: false, reason: 'Navigation indisponible' };
        case 'prev':
            if (typeof presenterControls.goPrev === 'function') { presenterControls.goPrev(); return { ok: true }; }
            if (deck && typeof deck.prev === 'function') { deck.prev(); return { ok: true }; }
            return { ok: false, reason: 'Navigation indisponible' };
        case 'goto': {
            const idx = toIntOrNull(payload?.index);
            if (idx === null || idx < 0) return { ok: false, reason: 'Index invalide' };
            if (typeof presenterControls.goTo === 'function') { presenterControls.goTo(idx); return { ok: true }; }
            if (deck && typeof deck.slide === 'function') { deck.slide(idx, 0, -1); return { ok: true }; }
            return { ok: false, reason: 'Navigation indisponible' };
        }
        case 'black':
            if (typeof presenterControls.toggleBlack === 'function') { presenterControls.toggleBlack(); return { ok: true }; }
            return { ok: false, reason: 'Écran noir indisponible' };
        case 'timer-toggle':
            if (typeof presenterControls.timerToggle === 'function') { presenterControls.timerToggle(); return { ok: true }; }
            return { ok: false, reason: 'Minuteur indisponible' };
        case 'timer-reset':
            if (typeof presenterControls.timerReset === 'function') { presenterControls.timerReset(); return { ok: true }; }
            return { ok: false, reason: 'Minuteur indisponible' };
        case 'salle':
            if (typeof presenterControls.switchTab === 'function') { presenterControls.switchTab('salle'); return { ok: true }; }
            return { ok: false, reason: 'Vue salle indisponible' };
        default:
            return { ok: false, reason: 'Commande inconnue' };
    }
}

/**
 * @param {{
 *   ROOM_MSG: any,
 *   safePeerSend: (conn: any, payload: any) => boolean,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   toIntOrNull?: (value: any) => number | null,
 *   applyStatusState?: (el: any, id: string, text: string, tone?: string) => void,
 *   buildRemoteUrl: (roomId: string) => string,
 *   buildQrImageSrc?: (value: string, size?: number) => string,
 *   storageGetJSON?: (key: string, fallback: any) => any,
 *   storageSetJSON?: (key: string, value: any) => boolean,
 *   storageRemove?: (key: string) => void,
 *   remoteControlConfigKey: (roomId: string) => string,
 *   legacyConfigKey?: string,
 *   derivePasswordHashHex: (password: unknown, saltToken: string, iterations?: number) => Promise<string>,
 *   sha256Hex: (value: unknown) => Promise<string>,
 *   hashIterations?: number,
 *   passwordMinLen?: number,
 *   challengeTtlMs?: number,
 *   sessionTtlMs?: number,
 *   lockMs?: number,
 *   getRoomConnections?: () => any[],
 *   isRoomActive?: () => boolean,
 *   runCommand?: (command: any, payload: any) => { ok: boolean, reason?: string },
 *   randToken?: (size?: number) => string,
 *   now?: () => number,
 *   documentRef?: any,
 * }} params
 */
export function createRoomRemoteControl(params) {
    const ROOM_MSG = params?.ROOM_MSG || {};
    const safePeerSend = typeof params?.safePeerSend === 'function' ? params.safePeerSend : () => false;
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const toIntOrNull = typeof params?.toIntOrNull === 'function' ? params.toIntOrNull : defaultToIntOrNull;
    const applyStatusState = typeof params?.applyStatusState === 'function' ? params.applyStatusState : () => {};
    const buildRemoteUrl = typeof params?.buildRemoteUrl === 'function' ? params.buildRemoteUrl : () => '';
    const buildQrImageSrc = typeof params?.buildQrImageSrc === 'function' ? params.buildQrImageSrc : () => '';
    const storageGetJSON = typeof params?.storageGetJSON === 'function' ? params.storageGetJSON : (() => null);
    const storageSetJSON = typeof params?.storageSetJSON === 'function' ? params.storageSetJSON : (() => false);
    const storageRemove = typeof params?.storageRemove === 'function' ? params.storageRemove : (() => {});
    const remoteControlConfigKey = typeof params?.remoteControlConfigKey === 'function'
        ? params.remoteControlConfigKey
        : (() => '');
    const derivePasswordHashHex = typeof params?.derivePasswordHashHex === 'function'
        ? params.derivePasswordHashHex
        : async () => '';
    const sha256Hex = typeof params?.sha256Hex === 'function' ? params.sha256Hex : async () => '';
    const hashIterations = Math.max(10000, Number(params?.hashIterations) || 120000);
    const passwordMinLen = Math.max(4, Number(params?.passwordMinLen) || 8);
    const challengeTtlMs = Math.max(15000, Number(params?.challengeTtlMs) || 60 * 1000);
    const sessionTtlMs = Math.max(60 * 1000, Number(params?.sessionTtlMs) || 15 * 60 * 1000);
    const lockMs = Math.max(1000, Number(params?.lockMs) || 30 * 1000);
    const getRoomConnections = typeof params?.getRoomConnections === 'function' ? params.getRoomConnections : () => [];
    const isRoomActive = typeof params?.isRoomActive === 'function' ? params.isRoomActive : () => false;
    const runCommand = typeof params?.runCommand === 'function'
        ? params.runCommand
        : (() => ({ ok: false, reason: 'Commande inconnue' }));
    const randToken = typeof params?.randToken === 'function' ? params.randToken : defaultRandToken;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const doc = params?.documentRef || (typeof document !== 'undefined' ? document : null);
    const legacyConfigKey = trim(params?.legacyConfigKey, 120);

    const state = {
        roomId: '',
        enabled: false,
        hash: '',
        salt: '',
        iterations: hashIterations,
        sessions: new Map(),
        challenges: new Map(),
        failures: new Map(),
        statusText: '',
        statusTone: '',
    };

    function setStatus(text, tone = '') {
        state.statusText = String(text || '');
        state.statusTone = tone || '';
        const statusEl = doc?.getElementById?.('rm-remote-status');
        applyStatusState(statusEl, 'rm-remote-status', state.statusText, state.statusTone);
    }

    function prune() {
        const ts = now();
        for (const [token, session] of state.sessions.entries()) {
            if (!session || Number(session.expiresAt || 0) <= ts) state.sessions.delete(token);
        }
        for (const [challengeId, challenge] of state.challenges.entries()) {
            if (!challenge || Number(challenge.expiresAt || 0) <= ts) state.challenges.delete(challengeId);
        }
        for (const [peerId, fail] of state.failures.entries()) {
            if (!fail || (fail.lockedUntil && fail.lockedUntil <= ts && !fail.count)) {
                state.failures.delete(peerId);
            }
        }
    }

    function activeSessionsCount() {
        prune();
        return state.sessions.size;
    }

    function buildUrl(roomId) {
        return buildRemoteUrl(String(roomId || ''));
    }

    function updateUI() {
        prune();
        const inputRoomId = trim(doc?.getElementById?.('rm-room-id-input')?.value || '', 40);
        const roomId = state.roomId || inputRoomId;
        const sessions = activeSessionsCount();
        const wrap = doc?.getElementById?.('rm-remote-link-wrap');
        const urlEl = doc?.getElementById?.('rm-remote-url');
        const qrEl = doc?.getElementById?.('rm-remote-qr');
        const enableBtn = doc?.getElementById?.('rm-remote-enable');
        const revokeBtn = doc?.getElementById?.('rm-remote-revoke');

        if (enableBtn) enableBtn.disabled = !roomId;
        if (revokeBtn) revokeBtn.disabled = !state.enabled && sessions === 0;

        if (state.enabled && roomId) {
            const remoteUrl = buildUrl(roomId);
            if (wrap) wrap.style.display = '';
            if (urlEl) urlEl.textContent = remoteUrl;
            if (qrEl) qrEl.innerHTML = `<img src="${buildQrImageSrc(remoteUrl, 180)}" alt="QR contrôle mobile">`;
            if (isRoomActive()) {
                setStatus(
                    sessions > 0
                        ? `Contrôle mobile actif (${sessions} session${sessions > 1 ? 's' : ''}).`
                        : 'Contrôle mobile actif. En attente de connexion distante.',
                    'ok'
                );
            } else {
                setStatus('Contrôle prêt. Ouvrez la salle pour accepter les connexions mobiles.', 'warn');
            }
        } else {
            if (wrap) wrap.style.display = 'none';
            if (!state.statusText || state.statusTone === 'ok') {
                setStatus('Définissez un mot de passe puis activez le contrôle mobile.', '');
            }
        }
    }

    function persistConfig() {
        if (!state.roomId) return;
        storageSetJSON(remoteControlConfigKey(state.roomId), {
            hash: state.hash,
            salt: state.salt,
            iterations: state.iterations,
            updatedAt: now(),
        });
    }

    function clearConfig(roomId) {
        const keyRoomId = trim(roomId, 80);
        if (!keyRoomId) return;
        storageRemove(remoteControlConfigKey(keyRoomId));
        if (legacyConfigKey) storageRemove(legacyConfigKey);
    }

    function loadConfig(roomId) {
        state.roomId = trim(roomId, 80);
        state.sessions.clear();
        state.challenges.clear();
        state.failures.clear();
        const saved = storageGetJSON(remoteControlConfigKey(state.roomId), null);
        if (saved && typeof saved === 'object' && typeof saved.hash === 'string' && typeof saved.salt === 'string') {
            state.enabled = true;
            state.hash = saved.hash;
            state.salt = saved.salt;
            state.iterations = Math.max(10000, toIntOrNull(saved.iterations) || hashIterations);
            setStatus('Contrôle mobile restauré pour cette salle.', 'ok');
        } else {
            state.enabled = false;
            state.hash = '';
            state.salt = '';
            state.iterations = hashIterations;
            setStatus('Définissez un mot de passe puis activez le contrôle mobile.', '');
        }
        updateUI();
    }

    function setRoomId(roomId) {
        state.roomId = trim(roomId, 80);
        updateUI();
    }

    function dropPeer(peerId) {
        const target = trim(peerId, 160);
        if (!target) return;
        for (const [token, session] of state.sessions.entries()) {
            if (session?.peerId === target) state.sessions.delete(token);
        }
        for (const [challengeId, challenge] of state.challenges.entries()) {
            if (challenge?.peerId === target) state.challenges.delete(challengeId);
        }
        state.failures.delete(target);
        updateUI();
    }

    function failPeer(peerId) {
        const target = trim(peerId, 160);
        const ts = now();
        const rec = state.failures.get(target) || { count: 0, lockedUntil: 0 };
        rec.count = Math.max(0, Number(rec.count || 0)) + 1;
        if (rec.count >= 3) {
            rec.lockedUntil = ts + lockMs;
            rec.count = 0;
        }
        state.failures.set(target, rec);
        return rec.lockedUntil > ts ? rec.lockedUntil - ts : 0;
    }

    function checkLock(peerId) {
        const target = trim(peerId, 160);
        const rec = state.failures.get(target);
        const ts = now();
        if (!rec || !rec.lockedUntil) return 0;
        if (rec.lockedUntil <= ts) {
            state.failures.delete(target);
            return 0;
        }
        return rec.lockedUntil - ts;
    }

    function sendAuthError(conn, reason, code = 'auth_error') {
        safePeerSend(conn, {
            type: ROOM_MSG.REMOTE_AUTH_ERROR,
            code,
            reason: String(reason || 'Authentification refusée'),
        });
    }

    function sessionValid(conn, token) {
        if (!state.enabled) return false;
        const safeToken = String(token || '').trim();
        if (!safeToken) return false;
        prune();
        const session = state.sessions.get(safeToken);
        if (!session || session.peerId !== conn?.peer) return false;
        if (Number(session.expiresAt || 0) <= now()) {
            state.sessions.delete(safeToken);
            return false;
        }
        session.expiresAt = now() + sessionTtlMs;
        state.sessions.set(safeToken, session);
        return true;
    }

    function ackCommand(conn, rid, ok, reason = '') {
        safePeerSend(conn, {
            type: ROOM_MSG.REMOTE_COMMAND_ACK,
            rid: trim(rid, 80),
            ok: !!ok,
            reason: trim(reason, 120),
            at: now(),
        });
    }

    function revokeAll(reason = 'Contrôle mobile révoqué', keepSecret = false) {
        const sessionPeers = new Set(
            Array.from(state.sessions.values())
                .map(entry => entry?.peerId)
                .filter(Boolean)
        );
        getRoomConnections().forEach((connection) => {
            if (!connection?.open || !sessionPeers.has(connection.peer)) return;
            safeConnSend(connection, { type: ROOM_MSG.REMOTE_REVOKED, reason });
        });
        state.sessions.clear();
        state.challenges.clear();
        state.failures.clear();
        if (!keepSecret) {
            state.enabled = false;
            state.hash = '';
            state.salt = '';
            state.iterations = hashIterations;
            clearConfig(state.roomId);
            const passEl = doc?.getElementById?.('rm-remote-password');
            if (passEl) passEl.value = '';
        }
        setStatus(reason, keepSecret ? 'warn' : 'error');
        updateUI();
    }

    async function enableFromPassword() {
        const pass = trim(doc?.getElementById?.('rm-remote-password')?.value || '', 128);
        if (pass.length < passwordMinLen) {
            setStatus(`Mot de passe trop court (${passwordMinLen} caractères minimum).`, 'error');
            return false;
        }
        if (!state.roomId) {
            setStatus('ID de salle invalide.', 'error');
            return false;
        }
        setStatus('Activation du contrôle mobile…', 'warn');
        const salt = randToken(16);
        const hash = await derivePasswordHashHex(pass, salt, hashIterations);
        state.enabled = true;
        state.hash = hash;
        state.salt = salt;
        state.iterations = hashIterations;
        state.sessions.clear();
        state.challenges.clear();
        state.failures.clear();
        persistConfig();
        const passEl = doc?.getElementById?.('rm-remote-password');
        if (passEl) passEl.value = '';
        updateUI();
        return true;
    }

    /**
     * @param {any} conn
     * @param {any} msg
     * @returns {Promise<boolean>}
     */
    async function handleIncoming(conn, msg) {
        const msgType = trim(msg?.type, 80);
        if (msgType === ROOM_MSG.REMOTE_HELLO) {
            if (!state.enabled) {
                sendAuthError(conn, 'Contrôle mobile désactivé.', 'remote_disabled');
                return true;
            }
            if (!isRoomActive()) {
                sendAuthError(conn, 'Salle fermée.', 'room_closed');
                return true;
            }
            const lockMsLeft = checkLock(conn?.peer);
            if (lockMsLeft > 0) {
                sendAuthError(conn, `Trop de tentatives. Réessayez dans ${Math.ceil(lockMsLeft / 1000)}s.`, 'cooldown');
                return true;
            }
            const clientNonce = trim(msg?.clientNonce, 120);
            if (clientNonce.length < 12) {
                sendAuthError(conn, 'Challenge invalide.', 'bad_nonce');
                return true;
            }
            const challengeId = randToken(14);
            const serverNonce = randToken(16);
            state.challenges.set(challengeId, {
                peerId: conn?.peer,
                clientNonce,
                serverNonce,
                expiresAt: now() + challengeTtlMs,
            });
            safeConnSend(conn, {
                type: ROOM_MSG.REMOTE_AUTH_CHALLENGE,
                challengeId,
                serverNonce,
                salt: state.salt,
                iterations: state.iterations,
                ttlMs: challengeTtlMs,
            });
            setStatus('Demande de contrôle mobile en cours d’authentification.', 'warn');
            return true;
        }

        if (msgType === ROOM_MSG.REMOTE_AUTH_PROOF) {
            if (!state.enabled) {
                sendAuthError(conn, 'Contrôle mobile désactivé.', 'remote_disabled');
                return true;
            }
            const challengeId = trim(msg?.challengeId, 120);
            const proof = trim(msg?.proof, 200);
            const clientNonce = trim(msg?.clientNonce, 120);
            const challenge = state.challenges.get(challengeId);
            state.challenges.delete(challengeId);
            if (!challenge || challenge.peerId !== conn?.peer || Number(challenge.expiresAt || 0) <= now()) {
                sendAuthError(conn, 'Challenge expiré. Recommencez.', 'challenge_expired');
                return true;
            }
            if (!proof || clientNonce !== challenge.clientNonce) {
                const waitMs = failPeer(conn?.peer);
                if (waitMs > 0) {
                    sendAuthError(conn, `Accès temporairement bloqué (${Math.ceil(waitMs / 1000)}s).`, 'cooldown');
                } else {
                    sendAuthError(conn, 'Preuve invalide.', 'invalid_proof');
                }
                return true;
            }
            const expected = await sha256Hex(`${challengeId}:${challenge.clientNonce}:${challenge.serverNonce}:${state.hash}`);
            if (proof !== expected) {
                const waitMs = failPeer(conn?.peer);
                if (waitMs > 0) {
                    sendAuthError(conn, `Accès temporairement bloqué (${Math.ceil(waitMs / 1000)}s).`, 'cooldown');
                } else {
                    sendAuthError(conn, 'Mot de passe incorrect.', 'invalid_password');
                }
                return true;
            }
            state.failures.delete(trim(conn?.peer, 160));
            const token = randToken(24);
            const expiresAt = now() + sessionTtlMs;
            state.sessions.set(token, { peerId: conn?.peer, expiresAt });
            safeConnSend(conn, {
                type: ROOM_MSG.REMOTE_AUTH_OK,
                token,
                expiresAt,
                ttlMs: sessionTtlMs,
            });
            updateUI();
            return true;
        }

        if (msgType === ROOM_MSG.REMOTE_COMMAND) {
            const token = trim(msg?.token, 160);
            if (!sessionValid(conn, token)) {
                ackCommand(conn, msg?.rid, false, 'Session expirée');
                sendAuthError(conn, 'Session expirée. Reconnectez-vous.', 'session_expired');
                return true;
            }
            const outcome = runCommand(msg?.command, msg);
            ackCommand(conn, msg?.rid, outcome.ok, outcome.reason || '');
            updateUI();
            return true;
        }

        return false;
    }

    return {
        state,
        setStatus,
        setRoomId,
        buildUrl,
        updateUI,
        loadConfig,
        dropPeer,
        activeSessionsCount,
        revokeAll,
        enableFromPassword,
        handleIncoming,
        testUtils: Object.freeze({
            defaultTrim,
            defaultToIntOrNull,
            defaultRandToken,
            safeConnSend,
        }),
    };
}

