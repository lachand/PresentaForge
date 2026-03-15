// @ts-check

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
 * @returns {number | null}
 */
function toIntOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * @param {any} raw
 * @param {{ maxItems?: number, maxLen?: number, fallback?: any[] }} options
 * @returns {string[]}
 */
export function sanitizeStringList(raw, options = {}) {
    const maxItems = Math.max(0, Math.trunc(Number(options.maxItems ?? 8)));
    const maxLen = Math.max(1, Math.trunc(Number(options.maxLen ?? 120)));
    const source = Array.isArray(raw) ? raw : [];
    const cleaned = source
        .map(item => toTrimmedString(item, maxLen))
        .filter(Boolean)
        .slice(0, maxItems);
    if (cleaned.length) return cleaned;
    const fallback = Array.isArray(options.fallback) ? options.fallback : [];
    return fallback
        .map(item => toTrimmedString(item, maxLen))
        .filter(Boolean)
        .slice(0, maxItems);
}

/**
 * @param {{ prompts?: any[] } | null | undefined} ticket
 * @param {any} rawAnswers
 * @returns {string[] | null}
 */
export function normalizeExitTicketAnswers(ticket, rawAnswers) {
    if (!ticket || !Array.isArray(ticket.prompts) || !ticket.prompts.length) return null;
    const source = Array.isArray(rawAnswers) ? rawAnswers : [];
    const answers = ticket.prompts.map((_, index) => toTrimmedString(source[index], 280));
    return answers.some(Boolean) ? answers : null;
}

/**
 * @param {{ items?: any[] } | null | undefined} rank
 * @param {any} rawOrder
 * @returns {number[] | null}
 */
export function normalizeRankOrderSubmission(rank, rawOrder) {
    if (!rank || !Array.isArray(rank.items) || rank.items.length < 2) return null;
    const total = rank.items.length;
    const source = Array.isArray(rawOrder) ? rawOrder : [];
    const seen = new Set();
    const normalized = [];
    source.forEach((value) => {
        const index = toIntOrNull(value);
        if (index === null || index < 0 || index >= total) return;
        if (seen.has(index)) return;
        seen.add(index);
        normalized.push(index);
    });
    for (let index = 0; index < total; index += 1) {
        if (!seen.has(index)) normalized.push(index);
    }
    if (normalized.length !== total) return null;
    return normalized;
}

/**
 * @param {{ items?: any[], responses?: { forEach?: (fn: (entry: any) => void) => void } } | null | undefined} rank
 * @returns {Array<{ itemIndex: number, label: string, score: number, votes: number, avgPos: number | null }>}
 */
export function computeRankOrderAggregate(rank) {
    const items = Array.isArray(rank?.items) ? rank.items : [];
    if (!items.length) return [];
    const totals = items.map((_, itemIndex) => ({
        itemIndex,
        label: String(items[itemIndex] || ''),
        score: 0,
        votes: 0,
        posSum: 0,
    }));
    const maxScore = items.length;
    const responses = rank && rank.responses && typeof rank.responses.forEach === 'function'
        ? rank.responses
        : null;
    if (!responses) return [];
    responses.forEach((entry) => {
        const order = Array.isArray(entry?.order) ? entry.order : [];
        order.forEach((itemIndex, pos) => {
            const row = totals[itemIndex];
            if (!row) return;
            row.score += (maxScore - pos);
            row.votes += 1;
            row.posSum += (pos + 1);
        });
    });
    return totals
        .map(row => ({
            itemIndex: row.itemIndex,
            label: row.label,
            score: row.score,
            votes: row.votes,
            avgPos: row.votes ? (row.posSum / row.votes) : null,
        }))
        .sort((a, b) => {
            const ds = b.score - a.score;
            if (ds !== 0) return ds;
            const da = (a.avgPos ?? 999) - (b.avgPos ?? 999);
            if (da !== 0) return da;
            return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
        });
}

export const testUtils = Object.freeze({
    toTrimmedString,
    toIntOrNull,
});
