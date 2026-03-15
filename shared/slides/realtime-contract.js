/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/realtime-contract
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/realtime-contract.js"></script>
 */
// @ts-check
/**
 * realtime-contract.js
 * Shared message contracts (presenter/audience/student room) with lightweight validation.
 * Exposes `window.OEIRealtimeContract`.
 */
(function realtimeContractInit(global) {
    'use strict';

    const SYNC_MSG = Object.freeze({
        GO_TO: 'goTo',
        FRAGMENT_STEP: 'fragment:step',
        BLACK: 'black',
        AUDIENCE_LOCK: 'audience:lock',
        EXERCISE_MODE: 'exercise:mode',
        ROOM_QR: 'room:qr',
        ELEMENT_STATE: 'element:state',
        POLL_START: 'poll:start',
        POLL_UPDATE: 'poll:update',
        POLL_END: 'poll:end',
        WORDCLOUD_START: 'wordcloud:start',
        WORDCLOUD_UPDATE: 'wordcloud:update',
        WORDCLOUD_END: 'wordcloud:end',
        EXIT_TICKET_START: 'exit-ticket:start',
        EXIT_TICKET_UPDATE: 'exit-ticket:update',
        EXIT_TICKET_END: 'exit-ticket:end',
        RANK_ORDER_START: 'rank-order:start',
        RANK_ORDER_UPDATE: 'rank-order:update',
        RANK_ORDER_END: 'rank-order:end',
        ROULETTE_PICK: 'roulette:pick',
    });

    const ROOM_MSG = Object.freeze({
        INIT: 'room:init',
        WELCOME: 'room:welcome',
        HAND_LOWER: 'room:hand-lower',
        REMOTE_HELLO: 'remote:hello',
        REMOTE_AUTH_CHALLENGE: 'remote:auth:challenge',
        REMOTE_AUTH_PROOF: 'remote:auth:proof',
        REMOTE_AUTH_OK: 'remote:auth:ok',
        REMOTE_AUTH_ERROR: 'remote:auth:error',
        REMOTE_COMMAND: 'remote:command',
        REMOTE_COMMAND_ACK: 'remote:command:ack',
        REMOTE_REVOKED: 'remote:revoked',
        ACK: 'room:ack',
        SYNC_REQUEST: 'sync:request',
        QUIZ_QUESTION: 'quiz:question',
        QUIZ_END: 'quiz:end',
        STUDENT_JOIN: 'student:join',
        QUIZ_ANSWER: 'quiz:answer',
        STUDENT_SCORE: 'student:score',
        STUDENT_REACTION: 'student:reaction',
        STUDENT_HAND: 'student:hand',
        STUDENT_QUESTION: 'student:question',
        STUDENT_FEEDBACK: 'student:feedback',
        STUDENT_TELEMETRY: 'student:telemetry',
        AUDIENCE_NUDGE: 'audience:nudge',
        POLL_ANSWER: 'poll:answer',
        WORDCLOUD_WORD: 'wordcloud:word',
        EXIT_TICKET_SUBMIT: 'exit-ticket:submit',
        RANK_ORDER_SUBMIT: 'rank-order:submit',
        REACTION_SHOW: 'reaction:show',
        SLIDE_CHANGE: 'slide:change',
        SLIDE_FRAGMENT: 'slide:fragment',
        POLL_START: 'poll:start',
        POLL_END: 'poll:end',
        WORDCLOUD_START: 'wordcloud:start',
        WORDCLOUD_UPDATE: 'wordcloud:update',
        WORDCLOUD_END: 'wordcloud:end',
        EXIT_TICKET_START: 'exit-ticket:start',
        EXIT_TICKET_END: 'exit-ticket:end',
        RANK_ORDER_START: 'rank-order:start',
        RANK_ORDER_END: 'rank-order:end',
    });

    const syncTypes = new Set(Object.values(SYNC_MSG));
    const roomTypes = new Set(Object.values(ROOM_MSG));

    /**
     * @param {unknown} msg
     * @returns {msg is { type: string }}
     */
    function hasType(msg) {
        return !!msg && typeof msg === 'object' && typeof msg.type === 'string';
    }

    const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
    const isInt = v => Number.isInteger(v);
    const isNonNegInt = v => isInt(v) && v >= 0;
    const isNumber = v => typeof v === 'number' && Number.isFinite(v);
    const isBoolean = v => typeof v === 'boolean';
    const isString = (v, max = 2048) => typeof v === 'string' && v.length <= max;
    const isStringArray = (v, maxCount = 80, maxLen = 400) => Array.isArray(v) && v.length <= maxCount && v.every(x => isString(x, maxLen));
    const isNumberArray = (v, maxCount = 80) => Array.isArray(v) && v.length <= maxCount && v.every(isNumber);
    const isIntArray = (v, maxCount = 80) => Array.isArray(v) && v.length <= maxCount && v.every(isInt);
    const isWordCloudList = v => Array.isArray(v) && v.length <= 120 && v.every(row => Array.isArray(row) && row.length === 2 && isString(row[0], 120) && isNonNegInt(row[1]));

    /**
     * @param {unknown} v
     * @returns {boolean}
     */
    function isGenericRecord(v) {
        if (!isObject(v)) return false;
        return Object.keys(v).length <= 200;
    }

    const SYNC_VALIDATORS = Object.freeze({
        [SYNC_MSG.GO_TO]: msg => isNonNegInt(msg.index),
        [SYNC_MSG.FRAGMENT_STEP]: msg => isNonNegInt(msg.slideIndex) && isInt(msg.fragmentIndex),
        [SYNC_MSG.BLACK]: msg => isBoolean(msg.on),
        [SYNC_MSG.AUDIENCE_LOCK]: msg => isBoolean(msg.locked) && (msg.index == null || isNonNegInt(msg.index)),
        [SYNC_MSG.EXERCISE_MODE]: msg => isBoolean(msg.active)
            && (msg.title == null || isString(msg.title, 160))
            && (msg.message == null || isString(msg.message, 400)),
        [SYNC_MSG.ROOM_QR]: msg => isBoolean(msg.show) && (msg.url == null || isString(msg.url, 2500)),
        [SYNC_MSG.ELEMENT_STATE]: msg => isString(msg.elementType || '', 80)
            && (msg.slideIndex == null || isNonNegInt(msg.slideIndex))
            && (msg.elementId == null || isString(msg.elementId, 160))
            && (msg.state == null || isGenericRecord(msg.state)),
        [SYNC_MSG.POLL_START]: msg => isString(msg.pollId, 120) && isString(msg.prompt || '', 1200) && isStringArray(msg.options || [], 16, 320),
        [SYNC_MSG.POLL_UPDATE]: msg => isString(msg.pollId, 120)
            && (msg.counts == null || isNumberArray(msg.counts, 32))
            && (msg.total == null || isNonNegInt(msg.total))
            && (msg.totalSelections == null || isNonNegInt(msg.totalSelections)),
        [SYNC_MSG.POLL_END]: msg => msg.pollId == null || isString(msg.pollId, 120),
        [SYNC_MSG.WORDCLOUD_START]: msg => isString(msg.cloudId, 120) && isString(msg.prompt || '', 400),
        [SYNC_MSG.WORDCLOUD_UPDATE]: msg => isString(msg.cloudId, 120) && isWordCloudList(msg.words || []),
        [SYNC_MSG.WORDCLOUD_END]: msg => msg.cloudId == null || isString(msg.cloudId, 120),
        [SYNC_MSG.EXIT_TICKET_START]: msg => isString(msg.ticketId, 120) && isString(msg.title || '', 200) && isStringArray(msg.prompts || [], 10, 400),
        [SYNC_MSG.EXIT_TICKET_UPDATE]: msg => isString(msg.ticketId, 120)
            && (msg.responsesCount == null || isNonNegInt(msg.responsesCount))
            && (msg.responses == null || Array.isArray(msg.responses)),
        [SYNC_MSG.EXIT_TICKET_END]: msg => msg.ticketId == null || isString(msg.ticketId, 120),
        [SYNC_MSG.RANK_ORDER_START]: msg => isString(msg.rankId, 120) && isString(msg.title || '', 200) && isStringArray(msg.items || [], 40, 200),
        [SYNC_MSG.RANK_ORDER_UPDATE]: msg => isString(msg.rankId, 120)
            && (msg.rows == null || Array.isArray(msg.rows))
            && (msg.responsesCount == null || isNonNegInt(msg.responsesCount)),
        [SYNC_MSG.RANK_ORDER_END]: msg => msg.rankId == null || isString(msg.rankId, 120),
        [SYNC_MSG.ROULETTE_PICK]: msg => isString(msg.pseudo || '', 160),
    });

    const ROOM_VALIDATORS = Object.freeze({
        [ROOM_MSG.INIT]: msg => (msg.slideCount == null || isNonNegInt(msg.slideCount))
            && (msg.currentIndex == null || isNonNegInt(msg.currentIndex))
            && (msg.currentFragmentOrder == null || isInt(msg.currentFragmentOrder))
            && (msg.currentFragmentIndex == null || isInt(msg.currentFragmentIndex))
            && (msg.title == null || isString(msg.title, 300))
            && (msg.themeCSS == null || isString(msg.themeCSS, 250000))
            && (msg.slidesHtml == null || isStringArray(msg.slidesHtml, 2000, 500000)),
        [ROOM_MSG.WELCOME]: msg => (msg.title == null || isString(msg.title, 240)) && (msg.peerId == null || isString(msg.peerId, 180)),
        [ROOM_MSG.HAND_LOWER]: () => true,
        [ROOM_MSG.REMOTE_HELLO]: msg => isString(msg.clientNonce || '', 200) && (msg.device == null || isString(msg.device, 120)),
        [ROOM_MSG.REMOTE_AUTH_CHALLENGE]: msg => isString(msg.challengeId || msg.challenge || '', 600)
            && (msg.serverNonce == null || isString(msg.serverNonce, 200))
            && (msg.salt == null || isString(msg.salt, 200))
            && (msg.iterations == null || isNonNegInt(msg.iterations)),
        [ROOM_MSG.REMOTE_AUTH_PROOF]: msg => isString(msg.clientNonce || '', 200) && isString(msg.proof || msg.signature || '', 1800),
        [ROOM_MSG.REMOTE_AUTH_OK]: msg => isString(msg.token || '', 1200) && (msg.expiresAt == null || isNonNegInt(msg.expiresAt)),
        [ROOM_MSG.REMOTE_AUTH_ERROR]: msg => (msg.code == null || isString(msg.code, 120)) && (msg.reason == null || isString(msg.reason, 300)),
        [ROOM_MSG.REMOTE_COMMAND]: msg => isString(msg.command || msg.cmd || '', 120)
            && (msg.args == null || isGenericRecord(msg.args))
            && (msg.payload == null || isGenericRecord(msg.payload))
            && (msg.token == null || isString(msg.token, 1200))
            && (msg.rid == null || isString(msg.rid, 160)),
        [ROOM_MSG.REMOTE_COMMAND_ACK]: msg => (msg.command == null || isString(msg.command, 120))
            && (msg.ok == null || isBoolean(msg.ok))
            && (msg.rid == null || isString(msg.rid, 160))
            && (msg.reason == null || isString(msg.reason, 300)),
        [ROOM_MSG.REMOTE_REVOKED]: msg => msg.reason == null || isString(msg.reason, 300),
        [ROOM_MSG.ACK]: msg => msg.rid == null || isString(msg.rid, 160),
        [ROOM_MSG.SYNC_REQUEST]: msg => (msg.roomId == null || isString(msg.roomId, 80)) && (msg.want == null || isStringArray(msg.want, 30, 80)),
        [ROOM_MSG.QUIZ_QUESTION]: msg => isString(msg.quizId, 120) && isString(msg.question || '', 1400) && isStringArray(msg.options || [], 20, 420),
        [ROOM_MSG.QUIZ_END]: msg => msg.quizId == null || isString(msg.quizId, 120),
        [ROOM_MSG.STUDENT_JOIN]: msg => isString(msg.pseudo || '', 160),
        [ROOM_MSG.QUIZ_ANSWER]: msg => isString(msg.quizId || '', 120)
            && ((msg.answer == null || isInt(msg.answer)) && (msg.answers == null || isIntArray(msg.answers, 40))),
        [ROOM_MSG.STUDENT_SCORE]: msg => (msg.score == null || isNumber(msg.score))
            && (msg.quizCount == null || isNonNegInt(msg.quizCount))
            && (msg.quizCorrect == null || isNonNegInt(msg.quizCorrect))
            && (msg.pseudo == null || isString(msg.pseudo, 160)),
        [ROOM_MSG.STUDENT_REACTION]: msg => isString(msg.emoji || '', 24) && (msg.pseudo == null || isString(msg.pseudo, 160)),
        [ROOM_MSG.STUDENT_HAND]: msg => isBoolean(msg.raised),
        [ROOM_MSG.STUDENT_QUESTION]: msg => isString(msg.text || '', 1600) && (msg.qid == null || isString(msg.qid, 120)),
        [ROOM_MSG.STUDENT_FEEDBACK]: msg => isString(msg.feedback || '', 80),
        [ROOM_MSG.STUDENT_TELEMETRY]: msg => (msg.pseudo == null || isString(msg.pseudo, 160))
            && (msg.state == null || isString(msg.state, 40))
            && (msg.transport == null || isString(msg.transport, 40))
            && (msg.reason == null || isString(msg.reason, 80))
            && (msg.ts == null || isNonNegInt(msg.ts))
            && (msg.slideIndex == null || isNonNegInt(msg.slideIndex))
            && (msg.fragmentOrder == null || isInt(msg.fragmentOrder))
            && (msg.followPresenter == null || isBoolean(msg.followPresenter))
            && (msg.handRaised == null || isBoolean(msg.handRaised))
            && (msg.queueDepth == null || isNonNegInt(msg.queueDepth)),
        [ROOM_MSG.AUDIENCE_NUDGE]: msg => (msg.message == null || isString(msg.message, 260))
            && (msg.level == null || isString(msg.level, 40))
            && (msg.kind == null || isString(msg.kind, 40))
            && (msg.text == null || isString(msg.text, 260)),
        [ROOM_MSG.POLL_ANSWER]: msg => isString(msg.pollId || '', 120) && msg.value !== undefined,
        [ROOM_MSG.WORDCLOUD_WORD]: msg => isString(msg.cloudId || '', 120) && isString(msg.word || '', 120),
        [ROOM_MSG.EXIT_TICKET_SUBMIT]: msg => isString(msg.ticketId || '', 120) && (isObject(msg.answers) || Array.isArray(msg.answers)),
        [ROOM_MSG.RANK_ORDER_SUBMIT]: msg => isString(msg.rankId || '', 120) && isStringArray(msg.order || [], 120, 200),
        [ROOM_MSG.REACTION_SHOW]: msg => isString(msg.emoji || '', 24) && (msg.pseudo == null || isString(msg.pseudo, 160)),
        [ROOM_MSG.SLIDE_CHANGE]: msg => isNonNegInt(msg.index)
            && (msg.fragmentOrder == null || isInt(msg.fragmentOrder))
            && (msg.fragmentIndex == null || isInt(msg.fragmentIndex)),
        [ROOM_MSG.SLIDE_FRAGMENT]: msg => isNonNegInt(msg.index)
            && (((msg.fragmentOrder != null) && isInt(msg.fragmentOrder)) || ((msg.fragmentIndex != null) && isInt(msg.fragmentIndex)))
            && (msg.hidden == null || isBoolean(msg.hidden) || msg.hidden === 0 || msg.hidden === 1),
        [ROOM_MSG.POLL_START]: msg => isString(msg.pollId || '', 120)
            && isString(msg.prompt || '', 1200)
            && isStringArray(msg.options || [], 16, 320)
            && (msg.pollType == null || isString(msg.pollType, 40))
            && (msg.multi == null || isBoolean(msg.multi)),
        [ROOM_MSG.POLL_END]: msg => msg.pollId == null || isString(msg.pollId, 120),
        [ROOM_MSG.WORDCLOUD_START]: msg => isString(msg.cloudId || '', 120) && isString(msg.prompt || '', 400),
        [ROOM_MSG.WORDCLOUD_UPDATE]: msg => isString(msg.cloudId || '', 120) && isWordCloudList(msg.words || []),
        [ROOM_MSG.WORDCLOUD_END]: msg => msg.cloudId == null || isString(msg.cloudId, 120),
        [ROOM_MSG.EXIT_TICKET_START]: msg => isString(msg.ticketId || '', 120)
            && isStringArray(msg.prompts || [], 10, 400)
            && (msg.title == null || isString(msg.title, 200)),
        [ROOM_MSG.EXIT_TICKET_END]: msg => msg.ticketId == null || isString(msg.ticketId, 120),
        [ROOM_MSG.RANK_ORDER_START]: msg => isString(msg.rankId || '', 120)
            && isStringArray(msg.items || [], 40, 200)
            && (msg.title == null || isString(msg.title, 200)),
        [ROOM_MSG.RANK_ORDER_END]: msg => msg.rankId == null || isString(msg.rankId, 120),
    });

    function validateByTypeMap(msg, typeSet, validators) {
        if (!hasType(msg)) return { ok: false, reason: 'missing-type' };
        const m = /** @type {{ type: string }} */ (msg);
        if (!typeSet.has(m.type)) return { ok: false, reason: 'unknown-type' };
        const validator = validators[m.type];
        if (typeof validator !== 'function') return { ok: true, reason: '' };
        try {
            return validator(msg) ? { ok: true, reason: '' } : { ok: false, reason: 'invalid-payload' };
        } catch (_) {
            return { ok: false, reason: 'validator-error' };
        }
    }

    /**
     * @param {string} type
     * @param {unknown} msg
     * @returns {boolean}
     */
    function validateSyncPayload(type, msg) {
        const validator = SYNC_VALIDATORS[type];
        if (typeof validator !== 'function') return false;
        return !!validator(msg);
    }

    /**
     * @param {string} type
     * @param {unknown} msg
     * @returns {boolean}
     */
    function validateRoomPayload(type, msg) {
        const validator = ROOM_VALIDATORS[type];
        if (typeof validator !== 'function') return false;
        return !!validator(msg);
    }

    /**
     * @param {unknown} msg
     * @returns {boolean}
     */
    function validateSyncMessage(msg) {
        return validateByTypeMap(msg, syncTypes, SYNC_VALIDATORS).ok;
    }

    /**
     * @param {unknown} msg
     * @returns {boolean}
     */
    function validateRoomMessage(msg) {
        return validateByTypeMap(msg, roomTypes, ROOM_VALIDATORS).ok;
    }

    /**
     * @param {unknown} msg
     * @returns {{ ok: boolean, reason: string }}
     */
    function explainSyncValidation(msg) {
        return validateByTypeMap(msg, syncTypes, SYNC_VALIDATORS);
    }

    /**
     * @param {unknown} msg
     * @returns {{ ok: boolean, reason: string }}
     */
    function explainRoomValidation(msg) {
        return validateByTypeMap(msg, roomTypes, ROOM_VALIDATORS);
    }

    global.OEIRealtimeContract = Object.freeze({
        SYNC_MSG,
        ROOM_MSG,
        SYNC_VALIDATORS,
        ROOM_VALIDATORS,
        validateSyncPayload,
        validateRoomPayload,
        validateSyncMessage,
        validateRoomMessage,
        explainSyncValidation,
        explainRoomValidation,
    });
})(window);
