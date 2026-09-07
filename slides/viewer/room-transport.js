// @ts-check

/** @param {any} conn @param {unknown} payload */
export function safePeerSend(conn, payload) {
    if (!conn || conn.open === false) return false;
    try {
        conn.send(payload);
        return true;
    } catch (_) {
        return false;
    }
}

/** @param {any[]} connections @param {unknown} payload */
export function broadcastPeers(connections, payload) {
    let sent = 0;
    (connections || []).forEach(conn => {
        if (safePeerSend(conn, payload)) sent += 1;
    });
    return sent;
}

// ── room:init découpé ────────────────────────────────────────────────────────
// Un deck avec images base64 (plusieurs Mo) n'est pas livrable en un seul message
// PeerJS (chunk 16 Ko, pas de backpressure applicative). On sérialise, on hache
// (FNV-1a 32), on tranche (~48 Ko) et on envoie INIT_BEGIN + N × INIT_CHUNK avec
// contrôle de flux. L'étudiant réassemble, vérifie le checksum, et redemande les
// tranches manquantes via INIT_NACK.

const ROOM_INIT_SINGLE_MAX = 60000;          // ≤ 60 Ko → un seul message room:init (compat)
const INIT_CHUNK_BYTES = 48 * 1024;
const BACKPRESSURE_HIGH = 512 * 1024;        // octets bufferisés sur le DataChannel
const INIT_PACING_MS = 12;                   // pacing minimal entre tranches (relais surtout)

/** @type {Map<string, { initId: string, chunks: string[], ts: number }>} */
const _pendingInits = new Map();

const _sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const _connKey = conn => String((conn && (conn.peer || conn.connectionId || conn.label)) || 'unknown');

function _prunePendingInits() {
    if (_pendingInits.size <= 64) return;
    const now = Date.now();
    for (const [key, rec] of _pendingInits) {
        if ((now - rec.ts) > 120000) _pendingInits.delete(key);
    }
    if (_pendingInits.size > 128) {
        const oldest = [..._pendingInits.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) _pendingInits.delete(oldest[0]);
    }
}

/**
 * Envoie un `room:init` : message unique si petit, sinon découpé.
 * @param {any} conn
 * @param {any} payload  sortie de _roomBuildInitMessage()
 * @param {Record<string,string>} ROOM_MSG
 * @returns {boolean}
 */
export function roomSendInitAuto(conn, payload, ROOM_MSG) {
    if (!conn || conn.open === false || !payload) return false;
    let json = '';
    try { json = JSON.stringify(payload); } catch (_) { return false; }
    if (json.length <= ROOM_INIT_SINGLE_MAX) return safePeerSend(conn, payload);
    void _sendInitChunked(conn, payload, json, ROOM_MSG);
    return true;
}

async function _sendInitChunked(conn, payload, json, ROOM_MSG) {
    const fnv1a32 = (typeof window !== 'undefined' && window.OEIRealtimeContract && window.OEIRealtimeContract.fnv1a32)
        || (() => 0);
    const chunks = [];
    for (let i = 0; i < json.length; i += INIT_CHUNK_BYTES) chunks.push(json.slice(i, i + INIT_CHUNK_BYTES));
    const initId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    _prunePendingInits();
    _pendingInits.set(_connKey(conn), { initId, chunks, ts: Date.now() });

    const begin = {
        type: ROOM_MSG.INIT_BEGIN,
        initId,
        n: chunks.length,
        len: json.length,
        checksum: fnv1a32(json),
        title: payload.title || '',
        slideCount: payload.slideCount || 0,
        currentIndex: payload.currentIndex || 0,
        currentFragmentOrder: (payload.currentFragmentOrder == null ? -1 : payload.currentFragmentOrder),
    };
    if (!safePeerSend(conn, begin)) return;

    for (let i = 0; i < chunks.length; i++) {
        let guard = 0;
        while (conn.dataChannel && conn.dataChannel.bufferedAmount > BACKPRESSURE_HIGH && guard++ < 600) {
            // eslint-disable-next-line no-await-in-loop
            await _sleep(30);
        }
        if (conn.open === false) return;
        safePeerSend(conn, { type: ROOM_MSG.INIT_CHUNK, initId, i, s: chunks[i] });
        // eslint-disable-next-line no-await-in-loop
        if (!conn.dataChannel) await _sleep(INIT_PACING_MS);
    }
}

/**
 * Réponse à un INIT_NACK d'un étudiant : renvoie uniquement les tranches demandées.
 * @param {any} conn
 * @param {any} msg  { initId, missing: number[] }
 * @param {Record<string,string>} ROOM_MSG
 */
export function resendInitChunks(conn, msg, ROOM_MSG) {
    const rec = _pendingInits.get(_connKey(conn));
    if (!rec || !msg || msg.initId !== rec.initId) return;
    const missing = Array.isArray(msg.missing) ? msg.missing : [];
    let sent = 0;
    for (const idx of missing) {
        if (Number.isInteger(idx) && idx >= 0 && idx < rec.chunks.length && sent < 4000) {
            safePeerSend(conn, { type: ROOM_MSG.INIT_CHUNK, initId: rec.initId, i: idx, s: rec.chunks[idx] });
            sent += 1;
        }
    }
    rec.ts = Date.now();
}

/** Tests / nettoyage. */
export function __resetPendingInits() { _pendingInits.clear(); }
