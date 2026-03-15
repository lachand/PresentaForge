// @ts-check

import {
    computeRankOrderAggregate,
    sanitizeStringList,
} from './room-activity-model.js';

const EXIT_TICKET_PROMPTS_FALLBACK = Object.freeze([
    'Ce que je retiens',
    'Ce qui reste flou',
    'Question finale',
]);
const RANK_ORDER_ITEMS_FALLBACK = Object.freeze([
    'Option A',
    'Option B',
    'Option C',
]);

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
 * @param {{ now?: () => number }} deps
 * @returns {number}
 */
function resolveNow(deps) {
    return typeof deps?.now === 'function' ? Number(deps.now()) : Date.now();
}

/**
 * @param {{
 *   configOrTitle: any,
 *   prompts?: any[],
 *   now?: () => number,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 * }} params
 * @returns {{ ticketId: string, title: string, prompts: string[], responses: Map<string, any> } | null}
 */
export function createExitTicketState(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const rawConfig = (params?.configOrTitle && typeof params.configOrTitle === 'object')
        ? params.configOrTitle
        : { title: params?.configOrTitle, prompts: params?.prompts };
    const title = trim(rawConfig.title, 100) || 'Exit ticket';
    const promptList = sanitizeStringList(rawConfig.prompts, {
        maxItems: 4,
        maxLen: 180,
        fallback: EXIT_TICKET_PROMPTS_FALLBACK,
    });
    if (!promptList.length) return null;
    return {
        ticketId: `exit-${resolveNow(params)}`,
        title,
        prompts: promptList,
        responses: new Map(),
    };
}

/**
 * @param {{
 *   configOrTitle: any,
 *   items?: any[],
 *   now?: () => number,
 *   toTrimmedString?: (value: any, maxLen?: number) => string,
 * }} params
 * @returns {{ rankId: string, title: string, items: string[], responses: Map<string, any> } | null}
 */
export function createRankOrderState(params) {
    const trim = typeof params?.toTrimmedString === 'function' ? params.toTrimmedString : defaultTrim;
    const rawConfig = (params?.configOrTitle && typeof params.configOrTitle === 'object')
        ? params.configOrTitle
        : { title: params?.configOrTitle, items: params?.items };
    const title = trim(rawConfig.title, 100) || 'Classement collectif';
    const itemList = sanitizeStringList(rawConfig.items, {
        maxItems: 8,
        maxLen: 120,
        fallback: RANK_ORDER_ITEMS_FALLBACK,
    });
    if (itemList.length < 2) return null;
    return {
        rankId: `rank-${resolveNow(params)}`,
        title,
        items: itemList,
        responses: new Map(),
    };
}

/**
 * @param {{ ticketId: string, title: string, prompts: string[] } | null | undefined} state
 * @returns {{ ticketId: string, title: string, prompts: string[] }}
 */
export function buildExitTicketStartPayload(state) {
    return {
        ticketId: String(state?.ticketId || ''),
        title: String(state?.title || 'Exit ticket'),
        prompts: Array.isArray(state?.prompts) ? state.prompts.slice() : [],
    };
}

/**
 * @param {{ rankId: string, title: string, items: string[] } | null | undefined} state
 * @returns {{ rankId: string, title: string, items: string[] }}
 */
export function buildRankOrderStartPayload(state) {
    return {
        rankId: String(state?.rankId || ''),
        title: String(state?.title || 'Classement collectif'),
        items: Array.isArray(state?.items) ? state.items.slice() : [],
    };
}

/**
 * @param {{ ticketId: string } | null | undefined} state
 * @returns {{ ticketId: string }}
 */
export function buildExitTicketEndPayload(state) {
    return {
        ticketId: String(state?.ticketId || ''),
    };
}

/**
 * @param {{ rankId: string } | null | undefined} state
 * @returns {{ rankId: string }}
 */
export function buildRankOrderEndPayload(state) {
    return {
        rankId: String(state?.rankId || ''),
    };
}

/**
 * @param {any} activeExitTicket
 * @param {{ toTrimmedString?: (value: any, maxLen?: number) => string }=} deps
 * @returns {{ active: false, responses: any[] } | { active: true, ticketId: string, title: string, prompts: string[], responsesCount: number, responses: Array<{ pseudo: string, answers: string[], at: number }> }}
 */
export function buildExitTicketSnapshot(activeExitTicket, deps = {}) {
    if (!activeExitTicket) return { active: false, responses: [] };
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    const responses = [...activeExitTicket.responses.values()]
        .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
        .map(entry => ({
            pseudo: trim(entry?.pseudo, 40) || 'Anonyme',
            answers: Array.isArray(entry?.answers) ? entry.answers.map(value => trim(value, 280)) : [],
            at: Number(entry?.at || 0),
        }));
    return {
        active: true,
        ticketId: String(activeExitTicket.ticketId || ''),
        title: String(activeExitTicket.title || 'Exit ticket'),
        prompts: Array.isArray(activeExitTicket.prompts) ? activeExitTicket.prompts.slice() : [],
        responsesCount: Number(activeExitTicket.responses?.size || 0),
        responses,
    };
}

/**
 * @param {any} activeRankOrder
 * @returns {{ active: false, rows: any[] } | { active: true, rankId: string, title: string, items: string[], responsesCount: number, rows: Array<{ itemIndex: number, label: string, score: number, votes: number, avgPos: number | null }> }}
 */
export function buildRankOrderSnapshot(activeRankOrder) {
    if (!activeRankOrder) return { active: false, rows: [] };
    return {
        active: true,
        rankId: String(activeRankOrder.rankId || ''),
        title: String(activeRankOrder.title || 'Classement'),
        items: Array.isArray(activeRankOrder.items) ? activeRankOrder.items.slice() : [],
        responsesCount: Number(activeRankOrder.responses?.size || 0),
        rows: computeRankOrderAggregate(activeRankOrder),
    };
}

/**
 * @param {any} state
 * @param {any} snapshot
 * @returns {{ ticketId: string, title: string, prompts: string[], responsesCount: number, responses: any[] }}
 */
export function buildExitTicketUpdatePayload(state, snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        ticketId: String(state?.ticketId || ''),
        title: String(state?.title || 'Exit ticket'),
        prompts: Array.isArray(state?.prompts) ? state.prompts.slice() : [],
        responsesCount: Number(safeSnapshot.responsesCount || 0),
        responses: (Array.isArray(safeSnapshot.responses) ? safeSnapshot.responses : []).slice(0, 24),
    };
}

/**
 * @param {any} state
 * @param {any} snapshot
 * @returns {{ rankId: string, title: string, items: string[], responsesCount: number, rows: any[] }}
 */
export function buildRankOrderUpdatePayload(state, snapshot) {
    const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    return {
        rankId: String(state?.rankId || ''),
        title: String(state?.title || 'Classement collectif'),
        items: Array.isArray(state?.items) ? state.items.slice() : [],
        responsesCount: Number(safeSnapshot.responsesCount || 0),
        rows: Array.isArray(safeSnapshot.rows) ? safeSnapshot.rows : [],
    };
}

/**
 * @param {any} kind
 * @param {any} text
 * @param {{ now?: () => number, toTrimmedString?: (value: any, maxLen?: number) => string }=} deps
 * @returns {{ kind: string, text: string, at: number }}
 */
export function buildAudienceNudgePayload(kind, text, deps = {}) {
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    return {
        kind: trim(kind, 24),
        text: trim(text, 160),
        at: resolveNow(deps),
    };
}
