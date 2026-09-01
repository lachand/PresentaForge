// @ts-check

/**
 * @param {any} value
 * @param {number} maxLen
 * @returns {string}
 */
function defaultTrim(value, maxLen = 0) {
    if (typeof value !== 'string') return '';
    const out = value.trim();
    return maxLen > 0 ? out.slice(0, maxLen) : out;
}

/**
 * @param {any} conn
 * @param {any} payload
 * @returns {boolean}
 */
function safeSend(conn, payload) {
    if (!conn || typeof conn.send !== 'function') return false;
    try {
        conn.send(payload);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * @param {any} raw
 * @returns {any | null}
 */
function normalizeWhiteboardSyncPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const active = !!raw.active;
    const slideIndex = Number.isFinite(Number(raw.slideIndex)) ? Math.max(0, Math.trunc(Number(raw.slideIndex))) : 0;
    const updatedAt = Number.isFinite(Number(raw.updatedAt)) ? Math.max(0, Math.trunc(Number(raw.updatedAt))) : Date.now();
    const canvasWidth = Number.isFinite(Number(raw.canvasWidth)) ? Math.max(1, Math.trunc(Number(raw.canvasWidth))) : 1280;
    const canvasHeight = Number.isFinite(Number(raw.canvasHeight)) ? Math.max(1, Math.trunc(Number(raw.canvasHeight))) : 720;
    const commands = Array.isArray(raw.commands)
        ? raw.commands.filter(entry => entry && typeof entry === 'object').map(entry => ({ ...entry })).slice(0, 8000)
        : [];
    return {
        active,
        slideIndex,
        updatedAt,
        canvasWidth,
        canvasHeight,
        commands,
    };
}

/**
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   transport: string,
 *   roomCurrentSlideIndex: () => number,
 *   roomCurrentFragmentIndex: () => number,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   now?: () => number,
 * }} params
 */
export function createStudentJoinRecord(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const pseudo = trim(params?.msg?.pseudo, 40) || 'Anonyme';
    const transport = trim(params?.transport, 40) || 'p2p';
    return {
        pseudo,
        score: 0,
        quizCount: 0,
        quizCorrect: 0,
        handRaised: false,
        __transport: transport,
        telemetry: {
            ts: now(),
            state: 'join',
            transport,
            slideIndex: params.roomCurrentSlideIndex(),
            fragmentOrder: params.roomCurrentFragmentIndex(),
            followPresenter: true,
            handRaised: false,
            queueDepth: 0,
            reason: 'join',
        },
        _lastTelemetryUiAt: now(),
    };
}

/**
 * @param {{
 *   conn: any,
 *   ROOM_MSG: any,
 *   activePoll: any,
 *   activeWordCloud: any,
 *   activeExitTicket: any,
 *   activeRankOrder: any,
 *   whiteboardState?: any | (() => any),
 * }} params
 */
export function sendActiveRoomActivities(params) {
    const ROOM_MSG = params?.ROOM_MSG || {};
    const conn = params?.conn;
    const activePoll = params?.activePoll;
    const activeWordCloud = params?.activeWordCloud;
    const activeExitTicket = params?.activeExitTicket;
    const activeRankOrder = params?.activeRankOrder;
    const wbRaw = typeof params?.whiteboardState === 'function'
        ? params.whiteboardState()
        : params?.whiteboardState;
    const whiteboardState = normalizeWhiteboardSyncPayload(wbRaw);

    if (activePoll) {
        safeSend(conn, {
            type: ROOM_MSG.POLL_START,
            pollId: activePoll.pollId,
            pollType: activePoll.type,
            prompt: activePoll.prompt,
            options: activePoll.options,
            multi: !!activePoll.multi,
        });
    }
    if (activeWordCloud) {
        safeSend(conn, {
            type: ROOM_MSG.WORDCLOUD_START,
            cloudId: activeWordCloud.cloudId,
            prompt: activeWordCloud.prompt,
        });
    }
    if (activeExitTicket) {
        safeSend(conn, {
            type: ROOM_MSG.EXIT_TICKET_START,
            ticketId: activeExitTicket.ticketId,
            title: activeExitTicket.title || 'Exit ticket',
            prompts: Array.isArray(activeExitTicket.prompts) ? activeExitTicket.prompts.slice() : [],
        });
    }
    if (activeRankOrder) {
        safeSend(conn, {
            type: ROOM_MSG.RANK_ORDER_START,
            rankId: activeRankOrder.rankId,
            title: activeRankOrder.title || 'Classement collectif',
            items: Array.isArray(activeRankOrder.items) ? activeRankOrder.items.slice() : [],
        });
    }
    if (whiteboardState && ROOM_MSG.WHITEBOARD_SYNC) {
        safeSend(conn, {
            type: ROOM_MSG.WHITEBOARD_SYNC,
            ...whiteboardState,
        });
    }
}

/**
 * @param {{
 *   conn: any,
 *   ROOM_MSG: any,
 *   roomSendInit: (conn: any) => boolean,
 *   roomCurrentSlideIndex: () => number,
 *   roomCurrentFragmentIndex: () => number,
 *   activePoll: any,
 *   activeWordCloud: any,
 *   activeExitTicket: any,
 *   activeRankOrder: any,
 *   whiteboardState?: any | (() => any),
 * }} params
 * @returns {boolean}
 */
export function syncPeerRuntimeState(params) {
    const roomSendInit = typeof params?.roomSendInit === 'function' ? params.roomSendInit : () => false;
    if (!roomSendInit(params?.conn)) return false;
    sendActiveRoomActivities(params);
    const curFrag = params.roomCurrentFragmentIndex();
    safeSend(params?.conn, {
        type: params?.ROOM_MSG?.SLIDE_CHANGE,
        index: params.roomCurrentSlideIndex(),
        fragmentOrder: curFrag,
        fragmentIndex: curFrag,
    });
    return true;
}

/**
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   studentsByPeer: Record<string, any>,
 *   roomHands: any[],
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   toNumberOr?: (value: any, fallback?: number) => number,
 *   now?: () => number,
 *   transport?: string,
 * }} params
 * @returns {{ updated: boolean, shouldRefresh: boolean }}
 */
export function applyStudentTelemetryMessage(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const toNumberOr = typeof params?.toNumberOr === 'function'
        ? params.toNumberOr
        : ((value, fallback = 0) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        });
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();

    const student = params?.studentsByPeer?.[params.peerId];
    if (!student) return { updated: false, shouldRefresh: false };

    const ts = now();
    const prev = (student.telemetry && typeof student.telemetry === 'object') ? student.telemetry : {};
    const next = {
        ts: Number(params?.msg?.ts) > 0 ? Number(params.msg.ts) : ts,
        state: trim(params?.msg?.state, 40) || trim(prev.state, 40),
        transport: trim(params?.msg?.transport, 40) || trim(params?.transport || student.__transport, 40),
        slideIndex: Number.isFinite(Number(params?.msg?.slideIndex))
            ? Math.max(0, Math.trunc(Number(params.msg.slideIndex)))
            : toNumberOr(prev.slideIndex, 0),
        fragmentOrder: Number.isFinite(Number(params?.msg?.fragmentOrder))
            ? Math.trunc(Number(params.msg.fragmentOrder))
            : toNumberOr(prev.fragmentOrder, -1),
        followPresenter: params?.msg?.followPresenter == null ? (prev.followPresenter !== false) : !!params.msg.followPresenter,
        handRaised: params?.msg?.handRaised == null ? !!student.handRaised : !!params.msg.handRaised,
        queueDepth: Number.isFinite(Number(params?.msg?.queueDepth))
            ? Math.max(0, Math.trunc(Number(params.msg.queueDepth)))
            : Math.max(0, toNumberOr(prev.queueDepth, 0)),
        reason: trim(params?.msg?.reason, 80),
    };
    student.telemetry = next;
    student.__transport = next.transport || student.__transport || trim(params?.transport, 40) || 'p2p';

    if (params?.msg?.handRaised != null) {
        student.handRaised = !!params.msg.handRaised;
        const hands = Array.isArray(params.roomHands) ? params.roomHands : [];
        const existing = hands.find(entry => entry.peerId === params.peerId);
        if (student.handRaised && !existing) hands.push({ peerId: params.peerId, pseudo: student.pseudo });
        if (!student.handRaised && existing) {
            const idx = hands.findIndex(entry => entry.peerId === params.peerId);
            if (idx !== -1) hands.splice(idx, 1);
        }
    }

    const shouldRefresh = (ts - Number(student._lastTelemetryUiAt || 0)) > 2500 || next.reason === 'join';
    if (shouldRefresh) student._lastTelemetryUiAt = ts;
    return { updated: true, shouldRefresh };
}

/**
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   studentsByPeer: Record<string, any>,
 *   roomHands: any[],
 * }} params
 * @returns {boolean}
 */
export function applyStudentHandMessage(params) {
    const student = params?.studentsByPeer?.[params.peerId];
    if (!student) return false;
    const raised = !!params?.msg?.raised;
    student.handRaised = raised;
    const hands = Array.isArray(params.roomHands) ? params.roomHands : [];
    if (raised) {
        if (!hands.find(entry => entry.peerId === params.peerId)) {
            hands.push({ peerId: params.peerId, pseudo: student.pseudo });
        }
    } else {
        const idx = hands.findIndex(entry => entry.peerId === params.peerId);
        if (idx !== -1) hands.splice(idx, 1);
    }
    return true;
}

/**
 * Résout l'index de slide où a eu lieu une interaction étudiante.
 *
 * Ordre de résolution :
 *   1. `msg.slideIndex` — l'élève connaît sa slide et l'envoie (client à jour) ;
 *   2. les replis fournis, dans l'ordre — typiquement la dernière slide connue de
 *      l'élève via sa télémétrie (`student:telemetry` porte `slideIndex` même sur
 *      un client au cache ancien qui n'ajoute pas le champ à la réaction/question),
 *      puis en dernier recours la slide courante du présentateur ;
 *   3. `0` si rien de valide.
 *
 * Sans le repli télémétrie, une réaction d'un élève qui a quitté le fil du
 * présentateur serait taguée sur la slide du présentateur, pas la sienne.
 *
 * @param {any} msg
 * @param {...(number | undefined | null | (() => number | undefined | null))} fallbacks
 * @returns {number}
 */
function resolveSlideIndex(msg, ...fallbacks) {
    const raw = msg && msg.slideIndex;
    if (Number.isInteger(raw) && raw >= 0) return raw;
    for (const fallback of fallbacks) {
        const fb = typeof fallback === 'function' ? fallback() : fallback;
        if (Number.isInteger(fb) && fb >= 0) return fb;
    }
    return 0;
}

/**
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   roomQuestions: any[],
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   now?: () => number,
 *   studentSlideIndex?: number | (() => number),
 *   currentSlideIndex?: number | (() => number),
 * }} params
 * @returns {{ ok: boolean, reason?: string }}
 */
export function applyStudentQuestionMessage(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const text = trim(params?.msg?.text, 300);
    if (!text) return { ok: false, reason: 'empty-question' };
    const qid = trim(params?.msg?.qid, 80) || `q-${now()}`;
    const slideIndex = resolveSlideIndex(params?.msg, params?.studentSlideIndex, params?.currentSlideIndex);
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const roomQuestions = Array.isArray(params?.roomQuestions) ? params.roomQuestions : [];
    const existing = roomQuestions.find((question) => !question.read && String(question._norm || '') === normalized);
    if (existing) {
        existing.time = now();
        existing.read = false;
        existing.hidden = false;
        if (existing.resolved) existing.resolved = false;
        if (!Array.isArray(existing.authors)) existing.authors = [];
        if (!existing.authors.includes(params.peerId)) {
            existing.authors.push(params.peerId);
            existing.votes = (existing.votes || 1) + 1;
        }
        return { ok: true };
    }
    roomQuestions.unshift({
        qid,
        text,
        slideIndex,
        time: now(),
        read: false,
        hidden: false,
        resolved: false,
        pinned: false,
        votes: 1,
        authors: [params.peerId],
        _norm: normalized,
    });
    return { ok: true };
}

/**
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   roomFeedback: { events: any[], lastByPeer: Map<string, number> },
 *   studentsByPeer: Record<string, any>,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   now?: () => number,
 *   minIntervalMs?: number,
 *   studentSlideIndex?: number | (() => number),
 *   currentSlideIndex?: number | (() => number),
 * }} params
 * @returns {{ ok: boolean, throttled: boolean, reason?: string }}
 */
export function applyStudentFeedbackMessage(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const minIntervalMs = Math.max(0, Number(params?.minIntervalMs) || 5000);
    const kind = trim(params?.msg?.kind, 24).toLowerCase();
    const allow = ['fast', 'unclear', 'pause', 'clear'];
    if (!allow.includes(kind)) return { ok: false, throttled: false, reason: 'feedback-invalid' };
    const ts = now();
    const prev = Number(params?.roomFeedback?.lastByPeer?.get(params.peerId) || 0);
    if ((ts - prev) < minIntervalMs) return { ok: true, throttled: true };
    params.roomFeedback.lastByPeer.set(params.peerId, ts);
    params.roomFeedback.events.unshift({
        peerId: params.peerId,
        pseudo: params?.studentsByPeer?.[params.peerId]?.pseudo || 'Anonyme',
        kind,
        text: trim(params?.msg?.text, 120),
        slideIndex: resolveSlideIndex(params?.msg, params?.studentSlideIndex, params?.currentSlideIndex),
        time: ts,
    });
    return { ok: true, throttled: false };
}

/**
 * Journalise une réaction emoji étudiante taguée par slide (rapport de fin de
 * session). L'affichage flottant et le relais aux autres élèves restent gérés
 * côté `viewer-main.js` ; on ne s'occupe ici que du journal `_roomReactions`.
 *
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   roomReactions: any[],
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   now?: () => number,
 *   maxEntries?: number,
 *   studentSlideIndex?: number | (() => number),
 *   currentSlideIndex?: number | (() => number),
 * }} params
 * @returns {{ ok: boolean, emoji: string, pseudo: string, slideIndex: number }}
 */
export function applyStudentReactionMessage(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const emoji = trim(params?.msg?.emoji, 24) || '❓';
    const pseudo = trim(params?.msg?.pseudo, 40);
    const slideIndex = Math.max(0, resolveSlideIndex(params?.msg, params?.studentSlideIndex, params?.currentSlideIndex));
    const reactions = Array.isArray(params?.roomReactions) ? params.roomReactions : [];
    reactions.push({ emoji, pseudo, slideIndex, time: now() });
    const cap = Number.isInteger(params?.maxEntries) && params.maxEntries > 0 ? params.maxEntries : 2000;
    while (reactions.length > cap) reactions.shift();
    return { ok: true, emoji, pseudo, slideIndex };
}

export const testUtils = Object.freeze({
    defaultTrim,
    safeSend,
});
