// @ts-check

const POLL_TYPES = new Set(['thumbs', 'scale5', 'mcq-single', 'mcq-multi']);

/**
 * @param {any} value
 * @param {number} maxLen
 * @returns {string}
 */
function toTrimmedString(value, maxLen = 0) {
    if (typeof value !== 'string') return '';
    const out = value.trim();
    return maxLen > 0 ? out.slice(0, maxLen) : out;
}

/**
 * @param {any} value
 * @returns {'thumbs' | 'scale5' | 'mcq-single' | 'mcq-multi'}
 */
export function normalizePollType(value) {
    const raw = toTrimmedString(value, 32).toLowerCase();
    if (POLL_TYPES.has(raw)) {
        return /** @type {'thumbs' | 'scale5' | 'mcq-single' | 'mcq-multi'} */ (raw);
    }
    return 'thumbs';
}

/**
 * @param {string} pollType
 * @returns {string[]}
 */
export function defaultPollOptions(pollType) {
    const type = normalizePollType(pollType);
    if (type === 'thumbs') return ['👍 Pour', '👎 Contre'];
    if (type === 'scale5') return ['1', '2', '3', '4', '5'];
    return ['Option A', 'Option B', 'Option C', 'Option D'];
}

/**
 * @param {string} pollType
 * @param {any} rawOptions
 * @returns {string[]}
 */
export function sanitizePollOptions(pollType, rawOptions) {
    const type = normalizePollType(pollType);
    if (type === 'scale5') return ['1', '2', '3', '4', '5'];
    const source = Array.isArray(rawOptions) ? rawOptions : [];
    const seen = new Set();
    const cleaned = [];
    source.forEach((opt) => {
        const label = toTrimmedString(opt, 80);
        if (!label) return;
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        cleaned.push(label);
    });
    if (type === 'thumbs') {
        return cleaned.length >= 2 ? cleaned.slice(0, 2) : ['👍 Pour', '👎 Contre'];
    }
    if (cleaned.length < 2) return defaultPollOptions(type);
    return cleaned.slice(0, 8);
}

/**
 * @param {{ type?: string, options?: any[] } | null | undefined} poll
 * @returns {number[]}
 */
export function pollValueDomain(poll) {
    if (!poll || typeof poll !== 'object') return [];
    const type = normalizePollType(poll.type);
    if (type === 'thumbs') return [1, 0];
    if (type === 'scale5') return [1, 2, 3, 4, 5];
    const options = Array.isArray(poll.options) ? poll.options : [];
    return options.map((_, index) => index);
}

/**
 * @param {{ type?: string, options?: any[], multi?: boolean, responses?: { forEach?: (fn: (answer: any) => void) => void, size?: number } } | null | undefined} poll
 * @returns {{ counts: number[], total: number, totalSelections: number }}
 */
export function computePollStats(poll) {
    const values = pollValueDomain(poll);
    const responses = poll && poll.responses && typeof poll.responses.forEach === 'function'
        ? poll.responses
        : null;
    const counts = values.map((value) => {
        let count = 0;
        if (!responses) return count;
        responses.forEach((answer) => {
            if (poll?.multi && Array.isArray(answer)) {
                if (answer.includes(value)) count += 1;
            } else if (!poll?.multi && answer === value) {
                count += 1;
            }
        });
        return count;
    });
    const total = responses && Number.isFinite(Number(responses.size))
        ? Math.max(0, Math.trunc(Number(responses.size)))
        : 0;
    const totalSelections = counts.reduce((sum, value) => sum + value, 0);
    return { counts, total, totalSelections };
}

/**
 * @param {{ type?: string, options?: any[], multi?: boolean } | null | undefined} poll
 * @param {any} rawValue
 * @returns {number | number[] | null}
 */
export function normalizePollAnswer(poll, rawValue) {
    const domain = new Set(pollValueDomain(poll));
    if (!domain.size) return null;
    if (poll?.multi) {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        const normalized = [...new Set(values
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && domain.has(value)))];
        return normalized.length ? normalized : null;
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value) || !domain.has(value)) return null;
    return value;
}

export const testUtils = Object.freeze({
    toTrimmedString,
});
