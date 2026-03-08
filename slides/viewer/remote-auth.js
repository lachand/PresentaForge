// @ts-check

export const REMOTE_HASH_ITERATIONS = 120000;

const enc = new TextEncoder();

/** @param {Uint8Array} bytes */
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} value */
function fromBase64Url(value) {
    const b64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** @param {unknown} value */
export async function sha256Hex(value) {
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value || '')));
    return bytesToHex(new Uint8Array(digest));
}

/**
 * @param {unknown} password
 * @param {string} saltToken
 * @param {number} [iterations]
 */
export async function derivePasswordHashHex(password, saltToken, iterations = REMOTE_HASH_ITERATIONS) {
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: fromBase64Url(saltToken),
        iterations: Math.max(10000, Number(iterations) || REMOTE_HASH_ITERATIONS),
    }, baseKey, 256);
    return bytesToHex(new Uint8Array(bits));
}
