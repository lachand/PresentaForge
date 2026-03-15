export const REPLAY_SESSION_FORMAT = 'oei-replay-session-v1';
export const REPLAY_STANDALONE_PAYLOAD_FORMAT = 'oei-replay-standalone-v1';
export const REPLAY_SCHEMA_VERSION = 1;

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
    const n = toFiniteNumber(value, fallback);
    return Math.trunc(n);
}

function toStringSafe(value, fallback = '') {
    if (typeof value === 'string') return value;
    if (value == null) return fallback;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fallback;
}

function cloneEventList(events) {
    if (!Array.isArray(events)) return [];
    return events
        .filter(entry => entry && typeof entry === 'object')
        .map(entry => {
            const payload = entry.payload && typeof entry.payload === 'object' ? { ...entry.payload } : {};
            return {
                type: toStringSafe(entry.type, '').trim(),
                t: Math.max(0, toFiniteNumber(entry.t, 0)),
                payload,
            };
        })
        .filter(entry => !!entry.type)
        .sort((a, b) => a.t - b.t);
}

function normalizeDimensions(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const width = Math.max(320, toInt(source.width, 1280));
    const height = Math.max(180, toInt(source.height, 720));
    return { width, height };
}

export function summarizeReplaySession(session, slideCount = 0) {
    const events = Array.isArray(session?.events) ? session.events : [];
    const summary = {
        events: events.length,
        goToEvents: 0,
        fragmentEvents: 0,
        blackEvents: 0,
        durationMs: Math.max(0, toFiniteNumber(session?.durationMs, 0)),
        coveredSlides: 0,
    };
    const covered = new Set();
    const maxSlides = Math.max(0, toInt(slideCount, 0));

    events.forEach(entry => {
        const type = toStringSafe(entry?.type, '').trim();
        if (type === 'goTo' || type === 'record:start') {
            summary.goToEvents += 1;
            const idx = toInt(entry?.payload?.index, -1);
            if (idx >= 0 && (!maxSlides || idx < maxSlides)) covered.add(idx);
        } else if (type === 'fragment') {
            summary.fragmentEvents += 1;
        } else if (type === 'black') {
            summary.blackEvents += 1;
        }
        summary.durationMs = Math.max(summary.durationMs, Math.max(0, toFiniteNumber(entry?.t, 0)));
    });

    summary.coveredSlides = covered.size;
    return summary;
}

export function normalizeReplaySessionExport(session, options = {}) {
    const source = session && typeof session === 'object' ? session : {};
    const slideCount = Math.max(0, toInt(options.slideCount, toInt(source.slideCount, 0)));
    const events = cloneEventList(source.events);
    const maxEventMs = events.reduce((acc, entry) => Math.max(acc, Math.max(0, toFiniteNumber(entry.t, 0))), 0);
    const durationMs = Math.max(0, toFiniteNumber(source.durationMs, 0), maxEventMs);
    const hasAudio = options.hasAudio === true || source.hasAudio === true;

    const normalized = {
        ...source,
        format: REPLAY_SESSION_FORMAT,
        schemaVersion: REPLAY_SCHEMA_VERSION,
        version: Math.max(1, toInt(source.version, 2)),
        exportedAt: toStringSafe(options.exportedAt, '') || new Date().toISOString(),
        createdAt: toStringSafe(source.createdAt, '') || new Date().toISOString(),
        title: toStringSafe(options.title, toStringSafe(source.title, '')).trim(),
        durationMs,
        events,
        captions: Array.isArray(source.captions) ? source.captions : [],
        slideCount,
        hasAudio,
    };

    if (hasAudio) {
        normalized.audioMimeType = toStringSafe(options.audioMimeType, toStringSafe(source.audioMimeType, 'audio/webm'));
        if (source.audioBitsPerSecond != null) {
            normalized.audioBitsPerSecond = Math.max(1, toInt(source.audioBitsPerSecond, 0));
        }
        const audioCodec = toStringSafe(options.audioCodec, toStringSafe(source.audioCodec, '')).trim();
        if (audioCodec) normalized.audioCodec = audioCodec;
    }

    normalized.sessionStats = summarizeReplaySession(normalized, slideCount);
    return normalized;
}

export function buildReplayStandalonePayload(options = {}) {
    const slideCount = Array.isArray(options.slidesHtml) ? options.slidesHtml.length : 0;
    const normalizedSession = normalizeReplaySessionExport(options.session, {
        title: options.title,
        slideCount,
        hasAudio: !!toStringSafe(options.audioDataUrl, '').trim(),
        audioMimeType: options.audioMimeType,
        audioCodec: options.audioCodec,
    });

    const payload = {
        format: REPLAY_STANDALONE_PAYLOAD_FORMAT,
        schemaVersion: REPLAY_SCHEMA_VERSION,
        title: toStringSafe(options.title, '').trim(),
        generatedAt: toStringSafe(options.generatedAt, '') || new Date().toISOString(),
        dimensions: normalizeDimensions(options.dimensions),
        slidesHtml: Array.isArray(options.slidesHtml) ? options.slidesHtml.slice() : [],
        themeCss: toStringSafe(options.themeCss, ''),
        session: normalizedSession,
        sessionStats: normalizedSession.sessionStats,
        audioDataUrl: toStringSafe(options.audioDataUrl, ''),
    };

    return payload;
}

export function unwrapReplaySessionData(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (Array.isArray(raw.events)) return raw;

    const candidates = [
        raw.session,
        raw.replaySession,
        raw.payload,
        raw.data,
    ];

    for (const entry of candidates) {
        if (entry && typeof entry === 'object') {
            if (Array.isArray(entry.events)) return entry;
            if (entry.session && typeof entry.session === 'object' && Array.isArray(entry.session.events)) {
                return entry.session;
            }
        }
    }
    return null;
}
