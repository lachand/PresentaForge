#!/usr/bin/env node
/**
 * Simple WebSocket relay for PresentaForge room fallback.
 *
 * Protocol (JSON messages):
 * - relay:join      { role: 'presenter'|'student', roomId, token?, clientId? }
 * - relay:up        { roomId, token?, from?, message }
 * - relay:broadcast { roomId, token?, message }
 * - relay:direct    { roomId, token?, to, message }
 *
 * This server only relays JSON payloads; business validation remains client-side.
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

const RELAY_HOST = process.env.RELAY_HOST || '0.0.0.0';
const RELAY_PORT = Math.max(1, Math.min(65535, Number(process.env.PORT || process.env.RELAY_PORT || 8787) || 8787));
const RELAY_TOKEN_DEFAULT = String(process.env.RELAY_TOKEN || '').trim();
const ROOM_IDLE_TTL_MS = Math.max(60_000, Number(process.env.RELAY_ROOM_IDLE_TTL_MS || 45 * 60_000) || (45 * 60_000));
const DEBUG = ['1', 'true', 'yes', 'on'].includes(String(process.env.RELAY_DEBUG || '').toLowerCase());

/** @typedef {{id: string, role: 'presenter'|'student', roomId: string, clientId: string, socket: import('ws').WebSocket, joinedAt: number}} RelayClient */
/** @typedef {{id: string, token: string, presenter: RelayClient|null, students: Map<string, RelayClient>, createdAt: number, updatedAt: number}} RelayRoom */

/** @type {Map<string, RelayRoom>} */
const rooms = new Map();
/** @type {WeakMap<import('ws').WebSocket, RelayClient>} */
const clientsBySocket = new WeakMap();

const now = () => Date.now();
const toSafeString = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);

function log(...args) {
    if (DEBUG) console.log('[relay]', ...args);
}

function ensureRoom(roomId, proposedToken = '') {
    const key = toSafeString(roomId, 80);
    if (!key) return null;
    const existing = rooms.get(key);
    if (existing) {
        existing.updatedAt = now();
        return existing;
    }
    const room = {
        id: key,
        token: toSafeString(proposedToken || RELAY_TOKEN_DEFAULT, 260),
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
    try {
        ws.send(JSON.stringify(payload));
        return true;
    } catch (_) {
        return false;
    }
}

function sendError(ws, reason, code = 'bad_request') {
    sendJson(ws, {
        type: 'relay:error',
        code: toSafeString(code, 48),
        reason: toSafeString(reason, 220),
        at: now(),
    });
}

function requireToken(room, payloadToken) {
    if (!room) return false;
    const expected = toSafeString(room.token, 260);
    if (!expected) return true;
    const provided = toSafeString(payloadToken, 260);
    return provided === expected;
}

function pruneEmptyRooms() {
    const t = now();
    for (const [roomId, room] of rooms.entries()) {
        const hasPresenter = !!room.presenter;
        const hasStudents = room.students.size > 0;
        const stale = (t - room.updatedAt) > ROOM_IDLE_TTL_MS;
        if (!hasPresenter && !hasStudents && stale) {
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
    const safeRoomId = toSafeString(roomId, 80);
    const safeClientId = safeRole === 'presenter'
        ? 'presenter'
        : (toSafeString(requestedClientId, 160) || `st-${randomUUID().slice(0, 8)}`);
    const client = {
        id: randomUUID(),
        role: safeRole,
        roomId: safeRoomId,
        clientId: safeClientId,
        socket: ws,
        joinedAt: now(),
    };
    clientsBySocket.set(ws, client);
    return client;
}

function routeJoin(ws, payload) {
    const role = toSafeString(payload.role, 32).toLowerCase();
    const roomId = toSafeString(payload.roomId, 80);
    if (!roomId) {
        sendError(ws, 'roomId manquant', 'missing_room');
        return;
    }
    if (role !== 'presenter' && role !== 'student') {
        sendError(ws, 'role invalide', 'invalid_role');
        return;
    }
    const proposedToken = toSafeString(payload.token, 260);
    const room = ensureRoom(roomId, proposedToken);
    if (!room) {
        sendError(ws, 'salle invalide', 'invalid_room');
        return;
    }
    if (!requireToken(room, proposedToken)) {
        sendError(ws, 'token relay invalide', 'bad_token');
        return;
    }

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

    sendJson(ws, {
        type: 'relay:joined',
        role: client.role,
        roomId: room.id,
        clientId: client.clientId,
        at: now(),
    });
    log('join', room.id, client.role, client.clientId);
}

function routeUp(ws, payload) {
    const client = clientsBySocket.get(ws);
    if (!client || client.role !== 'student') {
        sendError(ws, 'relay:up réservé aux étudiants', 'not_allowed');
        return;
    }
    const room = rooms.get(client.roomId);
    if (!room || !room.presenter) {
        sendError(ws, 'présentateur non connecté', 'no_presenter');
        return;
    }
    if (!requireToken(room, payload.token)) {
        sendError(ws, 'token relay invalide', 'bad_token');
        return;
    }
    if (!payload.message || typeof payload.message !== 'object') {
        sendError(ws, 'message relay:up invalide', 'invalid_message');
        return;
    }
    room.updatedAt = now();
    sendJson(room.presenter.socket, {
        type: 'relay:up',
        roomId: room.id,
        from: client.clientId,
        peerId: client.clientId,
        clientId: client.clientId,
        source: client.clientId,
        message: payload.message,
        at: now(),
    });
}

function routeBroadcast(ws, payload) {
    const client = clientsBySocket.get(ws);
    if (!client || client.role !== 'presenter') {
        sendError(ws, 'relay:broadcast réservé au présentateur', 'not_allowed');
        return;
    }
    const room = rooms.get(client.roomId);
    if (!room) {
        sendError(ws, 'salle introuvable', 'missing_room');
        return;
    }
    if (!requireToken(room, payload.token)) {
        sendError(ws, 'token relay invalide', 'bad_token');
        return;
    }
    if (!payload.message || typeof payload.message !== 'object') {
        sendError(ws, 'message relay:broadcast invalide', 'invalid_message');
        return;
    }
    room.updatedAt = now();
    const envelope = {
        type: 'relay:down',
        roomId: room.id,
        from: 'presenter',
        message: payload.message,
        at: now(),
    };
    for (const student of room.students.values()) {
        sendJson(student.socket, envelope);
    }
}

function routeDirect(ws, payload) {
    const client = clientsBySocket.get(ws);
    if (!client || client.role !== 'presenter') {
        sendError(ws, 'relay:direct réservé au présentateur', 'not_allowed');
        return;
    }
    const room = rooms.get(client.roomId);
    if (!room) {
        sendError(ws, 'salle introuvable', 'missing_room');
        return;
    }
    if (!requireToken(room, payload.token)) {
        sendError(ws, 'token relay invalide', 'bad_token');
        return;
    }
    const target = toSafeString(payload.to, 160);
    const targetClient = room.students.get(target);
    if (!target || !targetClient) {
        sendError(ws, 'destination introuvable', 'missing_target');
        return;
    }
    if (!payload.message || typeof payload.message !== 'object') {
        sendError(ws, 'message relay:direct invalide', 'invalid_message');
        return;
    }
    room.updatedAt = now();
    sendJson(targetClient.socket, {
        type: 'relay:down',
        roomId: room.id,
        from: 'presenter',
        to: target,
        message: payload.message,
        at: now(),
    });
}

function handlePacket(ws, payload) {
    if (!payload || typeof payload !== 'object') {
        sendError(ws, 'payload JSON invalide', 'invalid_payload');
        return;
    }
    const type = toSafeString(payload.type, 40).toLowerCase();
    switch (type) {
        case 'relay:join':
            routeJoin(ws, payload);
            return;
        case 'relay:up':
            routeUp(ws, payload);
            return;
        case 'relay:broadcast':
            routeBroadcast(ws, payload);
            return;
        case 'relay:direct':
            routeDirect(ws, payload);
            return;
        case 'ping':
            sendJson(ws, { type: 'pong', at: now() });
            return;
        default:
            sendError(ws, `type non supporté: ${type || '(vide)'}`, 'unknown_type');
    }
}

const httpServer = createServer((req, res) => {
    if (req.url === '/healthz') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            ok: true,
            rooms: rooms.size,
            at: now(),
        }));
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
        try { payload = JSON.parse(String(raw || '')); } catch (_) {
            sendError(ws, 'JSON invalide', 'invalid_json');
            return;
        }
        handlePacket(ws, payload);
    });

    ws.on('close', () => {
        const client = clientsBySocket.get(ws);
        if (client) {
            log('client closed', client.roomId, client.role, client.clientId);
            detachClient(client);
        }
    });

    ws.on('error', err => {
        log('socket error', err?.message || String(err || ''));
    });
});

setInterval(pruneEmptyRooms, 60_000).unref();

httpServer.on('error', err => {
    console.error('[relay] server error:', err?.message || String(err || ''));
    process.exit(1);
});

httpServer.listen(RELAY_PORT, RELAY_HOST, () => {
    const hostLabel = RELAY_HOST === '0.0.0.0' ? 'localhost' : RELAY_HOST;
    console.log(`[relay] listening on ws://${hostLabel}:${RELAY_PORT}`);
    if (RELAY_TOKEN_DEFAULT) console.log('[relay] token mode enabled');
    else console.log('[relay] token mode disabled');
});

function shutdown() {
    try { wss.close(); } catch (_) {}
    try { httpServer.close(); } catch (_) {}
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
