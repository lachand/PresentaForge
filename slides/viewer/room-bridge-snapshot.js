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
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function defaultToNumberOr(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {Record<string, any> | null | undefined} studentsByPeer
 * @param {{ toTrimmedString?: (value: any, maxLen?: number) => string, toNumberOr?: (value: any, fallback?: number) => number }=} deps
 * @returns {Array<{ peerId: string, pseudo: string, score: number, quizCount: number, quizCorrect: number, handRaised: boolean, telemetry: any }>}
 */
export function buildRoomStudentsSnapshot(studentsByPeer, deps = {}) {
    const toTrimmedString = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    const toNumberOr = typeof deps.toNumberOr === 'function' ? deps.toNumberOr : defaultToNumberOr;
    const entries = Object.entries(studentsByPeer || {});
    return entries.map(([peerId, student]) => ({
        peerId,
        pseudo: String(student?.pseudo || peerId || 'Anonyme'),
        score: toNumberOr(student?.score, 0),
        quizCount: toNumberOr(student?.quizCount, 0),
        quizCorrect: toNumberOr(student?.quizCorrect, 0),
        handRaised: !!student?.handRaised,
        telemetry: (student?.telemetry && typeof student.telemetry === 'object')
            ? {
                ts: toNumberOr(student.telemetry.ts, 0),
                state: toTrimmedString(student.telemetry.state, 40),
                transport: toTrimmedString(student.telemetry.transport, 40),
                slideIndex: toNumberOr(student.telemetry.slideIndex, 0),
                fragmentOrder: toNumberOr(student.telemetry.fragmentOrder, -1),
                followPresenter: student.telemetry.followPresenter !== false,
                queueDepth: Math.max(0, toNumberOr(student.telemetry.queueDepth, 0)),
                reason: toTrimmedString(student.telemetry.reason, 80),
            }
            : null,
    }));
}

/**
 * @param {{
 *   roomActive: boolean,
 *   relayActive: boolean,
 *   studentsByPeer: Record<string, any>,
 *   handsCount: number,
 *   questionsOpen: number,
 *   questionsTotal: number,
 *   feedback10m: any,
 *   pollActive: boolean,
 *   wordCloudActive: boolean,
 *   exitTicketActive: boolean,
 *   rankOrderActive: boolean,
 *   telemetry: any,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 *   toNumberOr?: (value: any, fallback?: number) => number,
 * }} params
 * @returns {{
 *   active: boolean,
 *   transport: string,
 *   studentsCount: number,
 *   handsCount: number,
 *   questionsOpen: number,
 *   questionsTotal: number,
 *   feedback10m: any,
 *   pollActive: boolean,
 *   wordCloudActive: boolean,
 *   exitTicketActive: boolean,
 *   rankOrderActive: boolean,
 *   telemetry: any,
 *   students: Array<{ peerId: string, pseudo: string, score: number, quizCount: number, quizCorrect: number, handRaised: boolean, telemetry: any }>,
 * }}
 */
export function buildRoomSnapshot(params) {
    const students = buildRoomStudentsSnapshot(params?.studentsByPeer, {
        toTrimmedString: params?.toTrimmedString,
        toNumberOr: params?.toNumberOr,
    });
    return {
        active: !!params?.roomActive,
        transport: params?.roomActive ? (params?.relayActive ? 'p2p+relay' : 'p2p') : 'off',
        studentsCount: students.length,
        handsCount: Number(params?.handsCount || 0),
        questionsOpen: Number(params?.questionsOpen || 0),
        questionsTotal: Number(params?.questionsTotal || 0),
        feedback10m: params?.feedback10m || { total: 0, counts: {} },
        pollActive: !!params?.pollActive,
        wordCloudActive: !!params?.wordCloudActive,
        exitTicketActive: !!params?.exitTicketActive,
        rankOrderActive: !!params?.rankOrderActive,
        telemetry: params?.telemetry || null,
        students,
    };
}
