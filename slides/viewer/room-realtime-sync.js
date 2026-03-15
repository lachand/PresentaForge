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
 * }} params
 */
export function sendActiveRoomActivities(params) {
    const ROOM_MSG = params?.ROOM_MSG || {};
    const conn = params?.conn;
    const activePoll = params?.activePoll;
    const activeWordCloud = params?.activeWordCloud;
    const activeExitTicket = params?.activeExitTicket;
    const activeRankOrder = params?.activeRankOrder;

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
 * @param {{
 *   msg: any,
 *   peerId: string,
 *   roomQuestions: any[],
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   now?: () => number,
 * }} params
 * @returns {{ ok: boolean, reason?: string }}
 */
export function applyStudentQuestionMessage(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const now = typeof params?.now === 'function' ? params.now : () => Date.now();
    const text = trim(params?.msg?.text, 300);
    if (!text) return { ok: false, reason: 'empty-question' };
    const qid = trim(params?.msg?.qid, 80) || `q-${now()}`;
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
        time: ts,
    });
    return { ok: true, throttled: false };
}

export const testUtils = Object.freeze({
    defaultTrim,
    safeSend,
});

