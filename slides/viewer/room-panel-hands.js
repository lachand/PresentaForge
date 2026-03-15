// @ts-check

/**
 * @param {any[]} hands
 * @param {Record<string, any>} studentsByPeer
 * @param {string} peerId
 * @returns {boolean}
 */
export function clearRaisedHandForPeer(hands, studentsByPeer, peerId) {
    const id = String(peerId || '').trim();
    if (!id) return false;
    let removed = false;
    if (Array.isArray(hands)) {
        const idx = hands.findIndex(entry => String(entry?.peerId || '').trim() === id);
        if (idx !== -1) {
            hands.splice(idx, 1);
            removed = true;
        }
    }
    if (studentsByPeer && typeof studentsByPeer === 'object' && studentsByPeer[id]) {
        studentsByPeer[id].handRaised = false;
    }
    return removed;
}

/**
 * @param {any[]} hands
 * @param {Record<string, any>} studentsByPeer
 * @returns {string[]}
 */
export function clearAllRaisedHands(hands, studentsByPeer) {
    if (!Array.isArray(hands)) return [];
    const peerIds = hands
        .map(entry => String(entry?.peerId || '').trim())
        .filter(Boolean);
    peerIds.forEach((peerId) => {
        if (!studentsByPeer || typeof studentsByPeer !== 'object') return;
        if (studentsByPeer[peerId]) studentsByPeer[peerId].handRaised = false;
    });
    hands.length = 0;
    return peerIds;
}
