// @ts-check

/**
 * @typedef {{ name: string, payload: any, at: number, source: string }} CommandTraceEntry
 */

/**
 * @param {{
 *   maxTrace?: number,
 *   onError?: (name: string, error: unknown, payload: any) => void,
 * }} [options]
 * @returns {{
 *   register: (name: string, handler: (payload: any) => any) => () => void,
 *   dispatch: (name: string, payload?: any, source?: string) => any,
 *   has: (name: string) => boolean,
 *   list: () => string[],
 *   getTrace: () => CommandTraceEntry[],
 *   clearTrace: () => void,
 * }}
 */
export function createCommandBus(options = {}) {
    /** @type {Map<string, (payload: any) => any>} */
    const handlers = new Map();
    /** @type {CommandTraceEntry[]} */
    const trace = [];
    const maxTrace = Math.max(1, Math.trunc(Number(options.maxTrace) || 160));
    const onError = typeof options.onError === 'function' ? options.onError : null;

    const normalizeName = (name) => String(name || '').trim();

    const register = (name, handler) => {
        const key = normalizeName(name);
        if (!key || typeof handler !== 'function') return () => {};
        handlers.set(key, handler);
        return () => {
            if (handlers.get(key) === handler) handlers.delete(key);
        };
    };

    const dispatch = (name, payload = null, source = 'direct') => {
        const key = normalizeName(name);
        if (!key) return null;
        const at = Date.now();
        trace.push({
            name: key,
            payload,
            at,
            source: String(source || 'direct').slice(0, 40),
        });
        if (trace.length > maxTrace) trace.splice(0, trace.length - maxTrace);
        const handler = handlers.get(key);
        if (!handler) return null;
        try {
            return handler(payload);
        } catch (error) {
            if (onError) {
                try { onError(key, error, payload); } catch (_) {}
            }
            return null;
        }
    };

    const has = name => handlers.has(normalizeName(name));
    const list = () => [...handlers.keys()].sort();
    const getTrace = () => trace.slice();
    const clearTrace = () => { trace.length = 0; };

    return { register, dispatch, has, list, getTrace, clearTrace };
}
