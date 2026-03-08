// @ts-check

/**
 * @param {BroadcastChannel | null} channel
 * @param {unknown} payload
 * @param {(msg: unknown) => boolean} [validator]
 */
export function postSyncMessage(channel, payload, validator) {
    if (!channel) return false;
    if (typeof validator === 'function' && !validator(payload)) return false;
    try {
        channel.postMessage(payload);
        return true;
    } catch (_) {
        return false;
    }
}
