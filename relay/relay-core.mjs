/**
 * relay-core.mjs — fabrique du serveur relay WebSocket PresentaForge (sans effet de bord).
 *
 * Protocole (messages JSON) :
 * - relay:join      { role: 'presenter'|'student', roomId, token?, clientId? }
 * - relay:up        { roomId, token?, from?, message }        (étudiant → présentateur)
 * - relay:broadcast { roomId, token?, message }               (présentateur → tous)
 * - relay:direct    { roomId, token?, to, message }            (présentateur → un étudiant)
 * - ping            → pong
 *
 * Ne relaie que des payloads JSON ; la validation métier reste côté client
 * (`shared/slides/realtime-contract.js`).
 *
 * Utilisé par `relay/relay-server.mjs` (déploiement Render autonome, `rootDir: relay`) et
 * `tools/slides/relay-server.mjs` (dev local + API replay combinée). Voir
 * docs/developer/PRESENTAFORGE_PLAN_EXECUTION_2026-08.md — chantier dédup relay.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

const now = () => Date.now();
const toSafeString = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);

/**
 * @param {{
 *   handleApiRequest?: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<boolean>,
 *   host?: string, port?: number,
 *   token?: string, corsOrigin?: string,
 *   roomIdleTtlMs?: number, pruneIntervalMs?: number,
 *   debug?: boolean,
 * }} [options]
 */
export function createRelayServer(options = {}) {
    const env = typeof process !== 'undefined' ? process.env : {};
    const handleApiRequest = typeof options.handleApiRequest === 'function'
        ? options.handleApiRequest
        : async () => false;
    const RELAY_HOST = options.host || env.RELAY_HOST || '0.0.0.0';
    const RELAY_PORT = Math.max(0, Math.min(65535,
        Number(options.port ?? env.PORT ?? env.RELAY_PORT ?? 8787) || 8787));
    const RELAY_TOKEN_DEFAULT = toSafeString(options.token ?? env.RELAY_TOKEN ?? '', 260);
    const CORS_ORIGIN = String(options.corsOrigin || env.CORS_ORIGIN || '*').trim();
    const ROOM_IDLE_TTL_MS = Math.max(60_000,
        Number(options.roomIdleTtlMs ?? env.RELAY_ROOM_IDLE_TTL_MS ?? 45 * 60_000) || (45 * 60_000));
    const PRUNE_INTERVAL_MS = Math.max(1_000, Number(options.pruneIntervalMs ?? 60_000) || 60_000);
    const DEBUG = options.debug ?? ['1', 'true', 'yes', 'on'].includes(String(env.RELAY_DEBUG || '').toLowerCase());

    /** @typedef {{id: string, role: 'presenter'|'student', roomId: string, clientId: string, socket: any, joinedAt: number}} RelayClient */
    /** @typedef {{id: string, token: string, presenter: RelayClient|null, students: Map<string, RelayClient>, createdAt: number, updatedAt: number}} RelayRoom */

    /** @type {Map<string, RelayRoom>} */
    const rooms = new Map();
    const clientsBySocket = new WeakMap();

    function log(...args) { if (DEBUG) console.log('[relay]', ...args); }

    function ensureRoom(roomId, proposedToken = '') {
        const key = toSafeString(roomId, 80);
        if (!key) return null;
        const existing = rooms.get(key);
        if (existing) { existing.updatedAt = now(); return existing; }
        const room = {
            id: key,
            // Quand un token est configuré côté serveur il fait autorité ; sinon le premier
            // client qui crée la salle en propose un (mode LAN sans secret).
            token: RELAY_TOKEN_DEFAULT || toSafeString(proposedToken, 260),
            presenter: null,
            students: new Map(),
            createdAt: now(),
            updatedAt: now(),
        };
        rooms.set(key, room);
        return room;
    }

    function closeSocket(ws, code = 1000, reason = 'closed') {
        try { ws.close(code, reason); } catch (_) {}
    }

    function sendJson(ws, payload) {
        if (!ws || ws.readyState !== ws.OPEN) return false;
        try { ws.send(JSON.stringify(payload)); return true; } catch (_) { return false; }
    }

    function sendError(ws, reason, code = 'bad_request') {
        sendJson(ws, { type: 'relay:error', code: toSafeString(code, 48), reason: toSafeString(reason, 220), at: now() });
    }

    function requireToken(room, payloadToken) {
        if (!room) return false;
        const expected = toSafeString(room.token, 260);
        if (!expected) return true;
        return toSafeString(payloadToken, 260) === expected;
    }

    function pruneEmptyRooms() {
        const t = now();
        for (const [roomId, room] of rooms.entries()) {
            const stale = (t - room.updatedAt) > ROOM_IDLE_TTL_MS;
            if (!room.presenter && room.students.size === 0 && stale) {
                rooms.delete(roomId);
                log('room pruned', roomId);
            }
        }
    }

    function detachClient(client) {
        if (!client) return;
        const room = rooms.get(client.roomId);
        if (!room) return;
        if (client.role === 'presenter') {
            if (room.presenter?.id === client.id) room.presenter = null;
        } else {
            room.students.delete(client.clientId);
        }
        room.updatedAt = now();
        pruneEmptyRooms();
    }

    function attachClient(ws, role, roomId, requestedClientId) {
        const safeRole = role === 'presenter' ? 'presenter' : 'student';
        const client = {
            id: randomUUID(),
            role: safeRole,
            roomId: toSafeString(roomId, 80),
            clientId: safeRole === 'presenter'
                ? 'presenter'
                : (toSafeString(requestedClientId, 160) || `st-${randomUUID().slice(0, 8)}`),
            socket: ws,
            joinedAt: now(),
        };
        clientsBySocket.set(ws, client);
        return client;
    }

    function routeJoin(ws, payload) {
        const role = toSafeString(payload.role, 32).toLowerCase();
        const roomId = toSafeString(payload.roomId, 80);
        if (!roomId) return sendError(ws, 'roomId manquant', 'missing_room');
        if (role !== 'presenter' && role !== 'student') return sendError(ws, 'role invalide', 'invalid_role');
        const proposedToken = toSafeString(payload.token, 260);
        const room = ensureRoom(roomId, proposedToken);
        if (!room) return sendError(ws, 'salle invalide', 'invalid_room');
        if (!requireToken(room, proposedToken)) return sendError(ws, 'token relay invalide', 'bad_token');

        const previous = clientsBySocket.get(ws);
        if (previous) detachClient(previous);

        const client = attachClient(ws, role, room.id, payload.clientId || payload.from);
        room.updatedAt = now();

        if (client.role === 'presenter') {
            if (room.presenter && room.presenter.socket !== ws) {
                sendError(room.presenter.socket, 'présentateur remplacé', 'replaced');
                closeSocket(room.presenter.socket, 4001, 'presenter replaced');
            }
            room.presenter = client;
        } else {
            room.students.set(client.clientId, client);
        }

        sendJson(ws, { type: 'relay:joined', role: client.role, roomId: room.id, clientId: client.clientId, at: now() });
        log('join', room.id, client.role, client.clientId);
    }

    function routeUp(ws, payload) {
        const client = clientsBySocket.get(ws);
        if (!client || client.role !== 'student') return sendError(ws, 'relay:up réservé aux étudiants', 'not_allowed');
        const room = rooms.get(client.roomId);
        if (!room || !room.presenter) return sendError(ws, 'présentateur non connecté', 'no_presenter');
        if (!requireToken(room, payload.token)) return sendError(ws, 'token relay invalide', 'bad_token');
        if (!payload.message || typeof payload.message !== 'object') return sendError(ws, 'message relay:up invalide', 'invalid_message');
        room.updatedAt = now();
        sendJson(room.presenter.socket, {
            type: 'relay:up', roomId: room.id,
            from: client.clientId, peerId: client.clientId, clientId: client.clientId, source: client.clientId,
            message: payload.message, at: now(),
        });
    }

    function routeBroadcast(ws, payload) {
        const client = clientsBySocket.get(ws);
        if (!client || client.role !== 'presenter') return sendError(ws, 'relay:broadcast réservé au présentateur', 'not_allowed');
        const room = rooms.get(client.roomId);
        if (!room) return sendError(ws, 'salle introuvable', 'missing_room');
        if (!requireToken(room, payload.token)) return sendError(ws, 'token relay invalide', 'bad_token');
        if (!payload.message || typeof payload.message !== 'object') return sendError(ws, 'message relay:broadcast invalide', 'invalid_message');
        room.updatedAt = now();
        const envelope = { type: 'relay:down', roomId: room.id, from: 'presenter', message: payload.message, at: now() };
        for (const student of room.students.values()) sendJson(student.socket, envelope);
    }

    function routeDirect(ws, payload) {
        const client = clientsBySocket.get(ws);
        if (!client || client.role !== 'presenter') return sendError(ws, 'relay:direct réservé au présentateur', 'not_allowed');
        const room = rooms.get(client.roomId);
        if (!room) return sendError(ws, 'salle introuvable', 'missing_room');
        if (!requireToken(room, payload.token)) return sendError(ws, 'token relay invalide', 'bad_token');
        const target = toSafeString(payload.to, 160);
        const targetClient = room.students.get(target);
        if (!target || !targetClient) return sendError(ws, 'destination introuvable', 'missing_target');
        if (!payload.message || typeof payload.message !== 'object') return sendError(ws, 'message relay:direct invalide', 'invalid_message');
        room.updatedAt = now();
        sendJson(targetClient.socket, {
            type: 'relay:down', roomId: room.id, from: 'presenter', to: target, message: payload.message, at: now(),
        });
    }

    function handlePacket(ws, payload) {
        if (!payload || typeof payload !== 'object') return sendError(ws, 'payload JSON invalide', 'invalid_payload');
        const type = toSafeString(payload.type, 40).toLowerCase();
        switch (type) {
            case 'relay:join': return routeJoin(ws, payload);
            case 'relay:up': return routeUp(ws, payload);
            case 'relay:broadcast': return routeBroadcast(ws, payload);
            case 'relay:direct': return routeDirect(ws, payload);
            case 'ping': return void sendJson(ws, { type: 'pong', at: now() });
            default: return sendError(ws, `type non supporté: ${type || '(vide)'}`, 'unknown_type');
        }
    }

    const httpServer = createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (await handleApiRequest(req, res)) return;
        if (req.url === '/healthz') {
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, rooms: rooms.size, at: now() }));
            return;
        }
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('not found');
    });

    const wss = new WebSocketServer({ server: httpServer });
    wss.on('connection', (ws, req) => {
        log('client connected', req.socket.remoteAddress || '?');
        ws.on('message', raw => {
            let payload = null;
            try { payload = JSON.parse(String(raw || '')); } catch (_) { sendError(ws, 'JSON invalide', 'invalid_json'); return; }
            handlePacket(ws, payload);
        });
        ws.on('close', () => {
            const client = clientsBySocket.get(ws);
            if (client) { log('client closed', client.roomId, client.role, client.clientId); detachClient(client); }
        });
        ws.on('error', err => log('socket error', err?.message || String(err || '')));
    });

    let pruneTimer = null;

    function listen(cb) {
        pruneTimer = setInterval(pruneEmptyRooms, PRUNE_INTERVAL_MS);
        if (typeof pruneTimer.unref === 'function') pruneTimer.unref();
        httpServer.on('error', err => {
            console.error('[relay] server error:', err?.message || String(err || ''));
            process.exit(1);
        });
        httpServer.listen(RELAY_PORT, RELAY_HOST, () => {
            const hostLabel = RELAY_HOST === '0.0.0.0' ? 'localhost' : RELAY_HOST;
            const port = httpServer.address()?.port ?? RELAY_PORT;
            console.log(`[relay] listening on ws://${hostLabel}:${port}`);
            console.log(RELAY_TOKEN_DEFAULT ? '[relay] token mode enabled' : '[relay] token mode disabled');
            if (typeof cb === 'function') cb(port);
        });
        return httpServer;
    }

    function close() {
        if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; }
        try { for (const ws of wss.clients) { try { ws.terminate(); } catch (_) {} } } catch (_) {}
        try { wss.close(); } catch (_) {}
        try { httpServer.close(); } catch (_) {}
    }

    return { httpServer, wss, rooms, listen, close, handlePacket, prune: pruneEmptyRooms };
}
