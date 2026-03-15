// @ts-check

import {
    normalizePollType,
    sanitizePollOptions,
} from './room-poll-model.js';

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
 * @param {any} typeOrConfig
 * @param {any} prompt
 * @param {{ now?: () => number, toTrimmedString?: (value: any, maxLen?: number) => string }} deps
 * @returns {{ pollId: string, type: string, prompt: string, options: string[], multi: boolean, responses: Map<string, any> }}
 */
export function createPollState(typeOrConfig = 'thumbs', prompt = '', deps = {}) {
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    const rawConfig = (typeOrConfig && typeof typeOrConfig === 'object')
        ? typeOrConfig
        : { type: typeOrConfig, prompt };
    const pollType = normalizePollType(rawConfig.type);
    const pollPrompt = trim(rawConfig.prompt, 180);
    const pollOptions = sanitizePollOptions(pollType, rawConfig.options);
    const isMulti = pollType === 'mcq-multi';
    return {
        pollId: `poll-${resolveNow(deps)}`,
        type: pollType,
        prompt: pollPrompt,
        options: pollOptions,
        multi: isMulti,
        responses: new Map(),
    };
}

/**
 * @param {{ pollId: string, type: string, prompt: string, options: string[], multi: boolean } | null | undefined} state
 * @returns {{ pollId: string, pollType: string, prompt: string, options: string[], multi: boolean }}
 */
export function buildPollStartPayload(state) {
    return {
        pollId: String(state?.pollId || ''),
        pollType: String(state?.type || 'thumbs'),
        prompt: String(state?.prompt || ''),
        options: Array.isArray(state?.options) ? state.options.slice() : [],
        multi: !!state?.multi,
    };
}

/**
 * @param {{ pollId: string } | null | undefined} state
 * @returns {{ pollId: string }}
 */
export function buildPollEndPayload(state) {
    return { pollId: String(state?.pollId || '') };
}

/**
 * @param {{ type?: string, prompt?: string }} state
 * @returns {string}
 */
export function buildPollPromptDisplayText(state) {
    const prompt = String(state?.prompt || '').trim();
    if (prompt) return prompt;
    const type = String(state?.type || 'thumbs');
    if (type === 'thumbs') return '👍 Pour / 👎 Contre';
    if (type === 'scale5') return 'Évaluez de 1 à 5';
    return 'QCM live';
}

/**
 * @param {any} prompt
 * @param {{ now?: () => number, toTrimmedString?: (value: any, maxLen?: number) => string }} deps
 * @returns {{ cloudId: string, prompt: string, words: Map<string, number> }}
 */
export function createWordCloudState(prompt = '', deps = {}) {
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    return {
        cloudId: `cloud-${resolveNow(deps)}`,
        prompt: trim(prompt, 120),
        words: new Map(),
    };
}

/**
 * @param {{ cloudId: string, prompt: string } | null | undefined} state
 * @returns {{ cloudId: string, prompt: string }}
 */
export function buildWordCloudStartPayload(state) {
    return {
        cloudId: String(state?.cloudId || ''),
        prompt: String(state?.prompt || ''),
    };
}

/**
 * @param {{ cloudId: string } | null | undefined} state
 * @returns {{ cloudId: string }}
 */
export function buildWordCloudEndPayload(state) {
    return {
        cloudId: String(state?.cloudId || ''),
    };
}

/**
 * @param {Map<string, number> | null | undefined} wordsMap
 * @param {number} limit
 * @returns {Array<[string, number]>}
 */
export function buildWordCloudTopWords(wordsMap, limit = 40) {
    const safeLimit = Math.max(1, Math.trunc(Number(limit) || 40));
    const entries = wordsMap instanceof Map ? [...wordsMap.entries()] : [];
    return entries
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, safeLimit)
        .map(([word, count]) => [String(word || ''), Number(count || 0)]);
}

/**
 * @param {any} rawWord
 * @param {{ toTrimmedString?: (value: any, maxLen?: number) => string }} deps
 * @returns {string}
 */
export function normalizeWordCloudWord(rawWord, deps = {}) {
    const trim = typeof deps.toTrimmedString === 'function' ? deps.toTrimmedString : defaultTrim;
    return trim(rawWord, 80)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s\-_'’.,!?]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {Map<string, number> | null | undefined} wordsMap
 * @param {string} word
 * @returns {number}
 */
export function applyWordCloudWord(wordsMap, word) {
    if (!(wordsMap instanceof Map)) return 0;
    const key = String(word || '').trim();
    if (!key) return 0;
    const next = Number(wordsMap.get(key) || 0) + 1;
    wordsMap.set(key, next);
    return next;
}

export const testUtils = Object.freeze({
    defaultTrim,
});
