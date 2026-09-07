// @ts-check
/* import-pipeline-normalization.js — helpers de normalisation partagés */
(function initImportPipelineNormalization(global) {
    'use strict';

    if (global.OEIImportPipelineNormalization) return;

    const toStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.text === 'string') return value.text;
            if (typeof value.label === 'string') return value.label;
            if (typeof value.title === 'string') return value.title;
        }
        return fallback;
    };

    const levelToArray = raw => {
        if (Array.isArray(raw)) return raw;
        if (Number.isFinite(Number(raw))) return [Number(raw)];
        return [];
    };

    const pickListText = (value, depth = 0) => {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value !== 'object' || depth >= 2) return '';
        const keys = ['text', 'label', 'title', 'name', 'value', 'content'];
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            const candidate = pickListText(value[key], depth + 1);
            if (candidate) return candidate;
        }
        for (const candidateValue of Object.values(value)) {
            if (candidateValue == null || typeof candidateValue === 'object') continue;
            const candidate = pickListText(candidateValue, depth + 1);
            if (candidate) return candidate;
        }
        for (const candidateValue of Object.values(value)) {
            if (!candidateValue || typeof candidateValue !== 'object') continue;
            const candidate = pickListText(candidateValue, depth + 1);
            if (candidate) return candidate;
        }
        return '';
    };

    const cleanListText = value => String(pickListText(value)).replace(/\s+/g, ' ').trim();

    const normalizeListItems = (items, fallback = []) => {
        if (!Array.isArray(items)) return fallback;
        const out = items.map(cleanListText).filter(Boolean);
        return out.length ? out : fallback;
    };

    // Comme normalizeListItems, mais PRÉSERVE la structure { text, sub:[…] } des
    // puces à sous-liste — le type de slide 'bullets' rend un <ul> imbriqué
    // (shared/slides/slides-core.js _bullets). Les sous-puces restent plates.
    // Utilisé uniquement pour `type: 'bullets'` ; les autres listes (smartart,
    // options, cartes, colonnes split) restent des tableaux de chaînes.
    const normalizeBulletItems = (items, fallback = []) => {
        if (!Array.isArray(items)) return fallback;
        const out = [];
        for (const item of items) {
            if (item && typeof item === 'object' && !Array.isArray(item) && Array.isArray(item.sub)) {
                const text = cleanListText(item.text ?? item.label ?? item.title ?? '');
                const sub = item.sub.map(cleanListText).filter(Boolean);
                if (sub.length) { out.push({ text, sub }); continue; }
                if (text) out.push(text);
                continue;
            }
            const t = cleanListText(item);
            if (t) out.push(t);
        }
        return out.length ? out : fallback;
    };

    const decodeBasicEntities = text => String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'");

    const stripHtmlToText = value => decodeBasicEntities(String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, ''));

    const parseHtmlList = html => {
        const src = String(html || '');
        const liMatches = [...src.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1] || '');
        if (liMatches.length) {
            return liMatches
                .map(txt => txt.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
        }
        const plain = src
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return plain ? [plain] : [];
    };

    global.OEIImportPipelineNormalization = Object.freeze({
        toStr,
        levelToArray,
        normalizeListItems,
        normalizeBulletItems,
        stripHtmlToText,
        parseHtmlList,
        testUtils: Object.freeze({
            toStr,
            levelToArray,
            normalizeListItems,
            normalizeBulletItems,
            stripHtmlToText,
            parseHtmlList,
        }),
    });
})(window);
