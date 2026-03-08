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
