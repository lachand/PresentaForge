// @ts-check

const FEEDBACK_KIND_ORDER = Object.freeze(['fast', 'unclear', 'pause', 'clear']);
const DEFAULT_FEEDBACK_META = Object.freeze({
    fast: Object.freeze({ iconKey: 'feedback_fast', label: 'Rapide' }),
    unclear: Object.freeze({ iconKey: 'feedback_unclear', label: 'Pas clair' }),
    pause: Object.freeze({ iconKey: 'feedback_pause', label: 'Pause' }),
    clear: Object.freeze({ iconKey: 'feedback_clear', label: 'OK' }),
});
const emptyIcon = () => '';

/**
 * @param {any} value
 * @returns {string}
 */
function escHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {any} value
 * @returns {number}
 */
function safeCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
}

/**
 * @param {number} nowTs
 * @param {number} eventTs
 * @returns {string}
 */
function formatAgoLabel(nowTs, eventTs) {
    const age = Math.max(0, Math.round((Number(nowTs || 0) - Number(eventTs || 0)) / 1000));
    return age < 60 ? `${age}s` : `${Math.round(age / 60)}min`;
}

/**
 * @param {any} value
 * @param {number} maxLen
 * @returns {string}
 */
function safeTrimText(value, maxLen) {
    if (typeof value !== 'string') return '';
    const out = value.trim();
    return maxLen > 0 ? out.slice(0, maxLen) : out;
}

/**
 * @param {string} kind
 * @param {Record<string, {iconKey?: string, label?: string}> | null | undefined} metasByKind
 * @returns {{ iconKey: string, label: string }}
 */
function resolveFeedbackMeta(kind, metasByKind) {
    const key = String(kind || '').trim().toLowerCase();
    const defaults = DEFAULT_FEEDBACK_META[key] || DEFAULT_FEEDBACK_META.clear;
    const src = metasByKind && typeof metasByKind === 'object' ? metasByKind[key] : null;
    if (!src || typeof src !== 'object') return defaults;
    const iconKey = String(src.iconKey || defaults.iconKey);
    const label = String(src.label || defaults.label);
    return { iconKey, label };
}

/**
 * @param {any} snapshot
 * @returns {{
 *   labels: string[],
 *   counts: number[],
 *   total: number,
 *   totalSelections: number,
 *   multi: boolean,
 *   bars: Array<{ label: string, count: number, pct: number }>,
 *   totalLabel: string,
 * }}
 */
export function normalizePollSnapshot(snapshot) {
    const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const labels = Array.isArray(snap.options) && snap.options.length
        ? snap.options.map(value => String(value || ''))
        : ['A', 'B'];
    const rawCounts = Array.isArray(snap.counts) ? snap.counts : [];
    const counts = labels.map((_, index) => safeCount(rawCounts[index]));
    const total = safeCount(snap.total);
    const totalSelections = safeCount(snap.totalSelections);
    const multi = snap.multi === true;
    const denom = multi ? Math.max(1, totalSelections) : Math.max(1, total);
    const bars = labels.map((label, index) => {
        const count = counts[index] || 0;
        const pct = Math.max(0, Math.min(100, Math.round((count / denom) * 100)));
        return { label, count, pct };
    });
    const totalLabel = multi
        ? `${total} répondant(s) · ${totalSelections} sélections`
        : `${total} réponse(s)`;
    return { labels, counts, total, totalSelections, multi, bars, totalLabel };
}

/**
 * @param {any} snapshot
 * @param {{ escHtml?: (value: any) => string }=} options
 * @returns {string}
 */
export function renderPollResultsHtml(snapshot, options = {}) {
    const esc = typeof options.escHtml === 'function' ? options.escHtml : escHtml;
    const normalized = normalizePollSnapshot(snapshot);
    const bars = normalized.bars.map((bar) => (
        `<div class="rm-poll-bar-row">
            <span class="rm-poll-label">${esc(bar.label)}</span>
            <div class="rm-poll-bar-wrap"><div class="rm-poll-bar-fill" style="width:${bar.pct}%"></div></div>
            <span class="rm-poll-count">${bar.count} (${bar.pct}%)</span>
        </div>`
    )).join('');
    return `<div class="rm-poll-total">${normalized.totalLabel}</div>${bars}`;
}

/**
 * @param {{ values?: () => Iterable<number>, size?: number } | null | undefined} wordsMap
 * @returns {{ distinct: number, total: number }}
 */
export function summarizeWordCloud(wordsMap) {
    const distinct = safeCount(wordsMap && typeof wordsMap.size === 'number' ? wordsMap.size : 0);
    const values = wordsMap && typeof wordsMap.values === 'function' ? wordsMap.values() : [];
    let total = 0;
    for (const value of values) total += safeCount(value);
    return { distinct, total };
}

/**
 * @param {{ distinct: number, total: number }} summary
 * @returns {string}
 */
export function formatWordCloudCountLabel(summary) {
    const distinct = safeCount(summary?.distinct);
    const total = safeCount(summary?.total);
    return `${distinct} mots distincts · ${total} soumissions`;
}

/**
 * @param {{
 *   counts: Record<string, number>,
 *   metasByKind?: Record<string, { iconKey?: string, label?: string }>,
 *   iconOnly?: (iconKey: string) => string,
 * }} params
 * @returns {string}
 */
export function renderFeedbackSummaryHtml(params) {
    const counts = params && typeof params.counts === 'object' ? params.counts : {};
    const metasByKind = params && typeof params.metasByKind === 'object' ? params.metasByKind : {};
    const iconOnly = typeof params?.iconOnly === 'function' ? params.iconOnly : emptyIcon;
    return FEEDBACK_KIND_ORDER.map((kind) => {
        const meta = resolveFeedbackMeta(kind, metasByKind);
        const count = safeCount(counts[kind]);
        return `<span class="rm-feedback-pill">${iconOnly(meta.iconKey)}<span>${count}</span></span>`;
    }).join('');
}

/**
 * @param {{
 *   events: any[],
 *   nowTs?: number,
 *   limit?: number,
 *   metasByKind?: Record<string, { iconKey?: string, label?: string }>,
 *   iconOnly?: (iconKey: string) => string,
 *   escHtml?: (value: any) => string,
 *   trimText?: (value: any, maxLen: number) => string,
 * }} params
 * @returns {string}
 */
export function renderFeedbackListHtml(params) {
    const source = Array.isArray(params?.events) ? params.events : [];
    const limit = Math.max(0, safeCount(params?.limit || 8));
    const events = source.slice(0, limit);
    if (!events.length) return '<div class="rm-feedback-empty">Aucun feedback récent.</div>';
    const nowTs = Number.isFinite(Number(params?.nowTs)) ? Number(params.nowTs) : Date.now();
    const esc = typeof params?.escHtml === 'function' ? params.escHtml : escHtml;
    const iconOnly = typeof params?.iconOnly === 'function' ? params.iconOnly : emptyIcon;
    const trimText = typeof params?.trimText === 'function' ? params.trimText : safeTrimText;
    const metasByKind = params && typeof params.metasByKind === 'object' ? params.metasByKind : {};
    return events.map((event) => {
        const meta = resolveFeedbackMeta(String(event?.kind || ''), metasByKind);
        const agoStr = formatAgoLabel(nowTs, Number(event?.time || 0));
        const text = trimText(event?.text, 80);
        return `<div class="rm-feedback-row"><span>${iconOnly(meta.iconKey)}</span><span>${esc(meta.label)}</span>${text ? `<span>· ${esc(text)}</span>` : ''}<span class="rm-feedback-time">${agoStr}</span></div>`;
    }).join('');
}

export const testUtils = Object.freeze({
    safeCount,
    formatAgoLabel,
    resolveFeedbackMeta,
});
