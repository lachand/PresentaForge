// @ts-check

/**
 * Resolve realtime contract and validators from global runtime.
 * @param {Window & typeof globalThis} globalObj
 */
export function resolveRealtimeContract(globalObj = window) {
    const contract = globalObj?.OEIRealtimeContract || {};
    const SYNC_MSG = contract.SYNC_MSG || null;
    const ROOM_MSG = contract.ROOM_MSG || null;
    const validateSyncMessage = typeof contract.validateSyncMessage === 'function'
        ? contract.validateSyncMessage
        : (() => true);
    const validateRoomMessage = typeof contract.validateRoomMessage === 'function'
        ? contract.validateRoomMessage
        : (() => true);
    if (!SYNC_MSG || !ROOM_MSG) {
        throw new Error('OEIRealtimeContract indisponible: chargement impossible.');
    }
    return { SYNC_MSG, ROOM_MSG, validateSyncMessage, validateRoomMessage };
}
