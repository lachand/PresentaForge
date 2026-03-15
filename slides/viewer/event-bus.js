// @ts-check

/**
 * @param {string[]} [initialTopics]
 * @returns {{
 *   subscribe: (topic: string, listener: (payload: any) => void) => () => void,
 *   emit: (topic: string, payload: any) => void,
 *   listenerCount: (topic: string) => number,
 *   clear: (topic?: string) => void,
 * }}
 */
export function createTopicEventBus(initialTopics = []) {
    /** @type {Map<string, Set<(payload: any) => void>>} */
    const topics = new Map();

    const ensure = (topic) => {
        const key = String(topic || '').trim();
        if (!key) return null;
        let listeners = topics.get(key);
        if (!listeners) {
            listeners = new Set();
            topics.set(key, listeners);
        }
        return listeners;
    };

    if (Array.isArray(initialTopics)) {
        initialTopics.forEach((topic) => { ensure(topic); });
    }

    const subscribe = (topic, listener) => {
        const listeners = ensure(topic);
        if (!listeners || typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    const emit = (topic, payload) => {
        const listeners = ensure(topic);
        if (!listeners || !listeners.size) return;
        listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (_) {}
        });
    };

    const listenerCount = (topic) => {
        const listeners = ensure(topic);
        return listeners ? listeners.size : 0;
    };

    const clear = (topic) => {
        if (!topic) {
            topics.clear();
            return;
        }
        const key = String(topic || '').trim();
        if (!key) return;
        topics.delete(key);
    };

    return { subscribe, emit, listenerCount, clear };
}
