// @ts-check

const DEFAULT_TELEMETRY_MAX_AGE_MS = 45 * 1000;
const DEFAULT_FEEDBACK_MAX_AGE_MS = 20 * 60 * 1000;
const DEFAULT_FEEDBACK_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_FEEDBACK_MAX_EVENTS = 240;

/**
 * @param {unknown} value
 * @param {number} maxLen
 */
function defaultTrim(value, maxLen = 0) {
    if (typeof value !== 'string') return '';
    const out = value.trim();
    return maxLen > 0 ? out.slice(0, maxLen) : out;
}

/**
 * @param {any} a
 * @param {any} b
 */
export function roomQuestionComparator(a, b) {
    if (!!a?.hidden !== !!b?.hidden) return a?.hidden ? 1 : -1;
    if (!!a?.pinned !== !!b?.pinned) return a?.pinned ? -1 : 1;
    if (!!a?.resolved !== !!b?.resolved) return a?.resolved ? 1 : -1;
    const av = Number(a?.votes) || 0;
    const bv = Number(b?.votes) || 0;
    if (av !== bv) return bv - av;
    return (Number(b?.time) || 0) - (Number(a?.time) || 0);
}

/**
 * @param {any[]} questions
 */
export function computeRoomQuestionStats(questions = []) {
    let open = 0;
    let resolved = 0;
    let pinned = 0;
    (Array.isArray(questions) ? questions : []).forEach(q => {
        if (q?.read || q?.hidden) return;
        if (q?.pinned) pinned++;
        if (q?.resolved) resolved++;
        else open++;
    });
    return { open, resolved, pinned, total: open + resolved };
}

/**
 * @param {any[]} questions
 * @param {string} filter
 */
export function filterRoomQuestions(questions = [], filter = 'open') {
    const active = (Array.isArray(questions) ? questions : []).filter(q => !q?.read);
    switch (String(filter || '').toLowerCase()) {
        case 'pinned':
            return active.filter(q => !q?.hidden && !!q?.pinned).sort(roomQuestionComparator);
        case 'resolved':
            return active.filter(q => !q?.hidden && !!q?.resolved).sort(roomQuestionComparator);
        case 'hidden':
            return active.filter(q => !!q?.hidden).sort(roomQuestionComparator);
        case 'all':
            return active.sort(roomQuestionComparator);
        case 'open':
        default:
            return active.filter(q => !q?.hidden && !q?.resolved).sort(roomQuestionComparator);
    }
}

/**
 * @param {any} student
 * @param {{ maxAgeMs?: number, now?: number }} [options]
 */
export function isRoomStudentTelemetryFresh(student, options = {}) {
    const maxAgeMs = Number(options.maxAgeMs) > 0 ? Number(options.maxAgeMs) : DEFAULT_TELEMETRY_MAX_AGE_MS;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const ts = Number(student?.telemetry?.ts || 0);
    return ts > 0 && (now - ts) <= maxAgeMs;
}

/**
 * @param {any} student
 * @param {{ maxAgeMs?: number, now?: number, trimFn?: (value: unknown, maxLen?: number) => string }} [options]
 */
export function formatRoomStudentTelemetryLabel(student, options = {}) {
    if (!student || typeof student !== 'object') return '';
    const t = (student.telemetry && typeof student.telemetry === 'object') ? student.telemetry : null;
    if (!t) return '';

    const trim = typeof options.trimFn === 'function' ? options.trimFn : defaultTrim;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const ageSec = Math.max(0, Math.round((now - Number(t.ts || 0)) / 1000));
    const fresh = isRoomStudentTelemetryFresh(student, options);
    const transport = trim(t.transport, 24) || trim(student.__transport, 24);
    const state = trim(t.state, 24);
    const queueDepth = Math.max(0, Number(t.queueDepth || 0));
    const parts = [];

    if (transport) parts.push(transport.toUpperCase());
    if (state) parts.push(state);
    if (queueDepth > 0) parts.push(`queue ${queueDepth}`);
    parts.push(fresh ? `${ageSec}s` : 'stale');
    return parts.join(' · ');
}

/**
 * @param {any[]} students
 * @param {{ maxAgeMs?: number, now?: number }} [options]
 */
export function computeRoomTelemetryStats(students = [], options = {}) {
    const list = Array.isArray(students) ? students : [];
    if (!list.length) return { fresh: 0, stale: 0, withQueue: 0 };
    let fresh = 0;
    let stale = 0;
    let withQueue = 0;
    list.forEach(student => {
        if (isRoomStudentTelemetryFresh(student, options)) fresh += 1;
        else stale += 1;
        const q = Number(student?.telemetry?.queueDepth || 0);
        if (q > 0) withQueue += 1;
    });
    return { fresh, stale, withQueue };
}

/**
 * @param {string} kind
 */
export function getRoomFeedbackMeta(kind) {
    const map = {
        fast: { iconKey: 'feedback_fast', label: 'Trop rapide' },
        unclear: { iconKey: 'feedback_unclear', label: 'Pas clair' },
        pause: { iconKey: 'feedback_pause', label: 'Besoin de pause' },
        clear: { iconKey: 'feedback_clear', label: 'OK' },
    };
    return map[String(kind || '').toLowerCase()] || { iconKey: 'question', label: 'Feedback' };
}

/**
 * @param {{ events?: any[], lastByPeer?: Map<string, number> } | null | undefined} feedback
 * @param {{ maxAgeMs?: number, maxEvents?: number, now?: number }} [options]
 */
export function pruneRoomFeedbackState(feedback, options = {}) {
    if (!feedback || typeof feedback !== 'object') return;
    const maxAgeMs = Number(options.maxAgeMs) > 0 ? Number(options.maxAgeMs) : DEFAULT_FEEDBACK_MAX_AGE_MS;
    const maxEvents = Number(options.maxEvents) > 0 ? Number(options.maxEvents) : DEFAULT_FEEDBACK_MAX_EVENTS;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();

    const nextEvents = (Array.isArray(feedback.events) ? feedback.events : [])
        .filter(evt => (now - Number(evt?.time || 0)) <= maxAgeMs);
    if (nextEvents.length > maxEvents) nextEvents.length = maxEvents;
    feedback.events = nextEvents;

    const map = feedback.lastByPeer instanceof Map ? feedback.lastByPeer : new Map();
    for (const [peerId, ts] of map.entries()) {
        if ((now - Number(ts || 0)) > maxAgeMs) map.delete(peerId);
    }
    feedback.lastByPeer = map;
}

/**
 * @param {any[]} events
 * @param {{ windowMs?: number, now?: number }} [options]
 */
export function computeRoomFeedbackStats(events = [], options = {}) {
    const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : DEFAULT_FEEDBACK_WINDOW_MS;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const counts = { fast: 0, unclear: 0, pause: 0, clear: 0, other: 0 };

    (Array.isArray(events) ? events : []).forEach(evt => {
        if ((now - Number(evt?.time || 0)) > windowMs) return;
        const kind = String(evt?.kind || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(counts, kind)) counts[kind]++;
        else counts.other++;
    });
    const total = counts.fast + counts.unclear + counts.pause + counts.clear + counts.other;
    return { counts, total };
}
