// @ts-check
/* import-pipeline-layout.js — helpers de layout pour import-pipeline */
(function initImportPipelineLayout(global) {
    'use strict';

    if (global.OEIImportPipelineLayout) return;

    const localToStr = (value, fallback = '') => {
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

    const localNormalizeListItems = (items, fallback = []) => {
        if (!Array.isArray(items)) return fallback;
        const out = items
            .map(item => localToStr(item, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        return out.length ? out : fallback;
    };

    const localStripHtmlToText = value => String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '');

    const withToStr = (deps, value, fallback = '') => (
        deps && typeof deps.toStr === 'function'
            ? deps.toStr(value, fallback)
            : localToStr(value, fallback)
    );

    const withNormalizeListItems = (deps, items, fallback = []) => (
        deps && typeof deps.normalizeListItems === 'function'
            ? deps.normalizeListItems(items, fallback)
            : localNormalizeListItems(items, fallback)
    );

    const withStripHtmlToText = (deps, value) => (
        deps && typeof deps.stripHtmlToText === 'function'
            ? deps.stripHtmlToText(value)
            : localStripHtmlToText(value)
    );

    const clampNum = (value, min, max) => Math.max(min, Math.min(max, value));

    const toFiniteNumber = (value, fallback) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const estimateWrappedLines = (text, charsPerLine) => {
        const safeCharsPerLine = Math.max(10, Math.trunc(charsPerLine || 10));
        const parts = String(text || '')
            .replace(/\r/g, '')
            .split('\n')
            .map(part => part.trim())
            .filter(Boolean);
        if (!parts.length) return 0;
        return parts.reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / safeCharsPerLine)), 0);
    };

    const estimateCardLineLoad = (title, items, widthPx) => {
        const effective = Math.max(220, Number(widthPx) || 220);
        const charsPerLine = Math.max(16, Math.floor((effective - 88) / 9.5));
        let lines = estimateWrappedLines(title, charsPerLine);
        const list = Array.isArray(items) ? items : [];
        for (const item of list) lines += estimateWrappedLines(item, charsPerLine);
        return Math.max(1, lines);
    };

    const estimateTableLineLoad = (rows, widthPx, deps = {}) => {
        const safeRows = Array.isArray(rows) ? rows : [];
        if (!safeRows.length) return 2;
        let lines = 0;
        safeRows.forEach(row => {
            const cells = Array.isArray(row) ? row : [row];
            const cols = Math.max(1, cells.length);
            const charsPerLine = Math.max(8, Math.floor((Math.max(280, widthPx) - 56) / cols / 8.5));
            const rowLines = Math.max(1, ...cells.map(cell => estimateWrappedLines(withToStr(deps, cell, ''), charsPerLine)));
            lines += rowLines;
        });
        return Math.max(2, lines);
    };

    const estimateCodeLineLoad = (code, widthPx) => {
        const src = String(code || '').replace(/\r/g, '');
        if (!src.trim()) return 1;
        const charsPerLine = Math.max(16, Math.floor((Math.max(320, widthPx) - 44) / 8.2));
        return src.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    };

    const estimateElementLineLoad = (type, data, widthPx, deps = {}) => {
        const safeType = String(type || '').toLowerCase();
        const safeData = (data && typeof data === 'object') ? data : {};
        const charsPerLine = Math.max(14, Math.floor((Math.max(260, widthPx) - 60) / 9.4));
        const richSegments = [];

        if (safeType === 'table') {
            return estimateTableLineLoad(safeData.rows, widthPx, deps);
        }
        if (safeType === 'code' || safeType === 'highlight') {
            return estimateCodeLineLoad(safeData.code, widthPx);
        }
        if (safeType === 'terminal-session') {
            return estimateCodeLineLoad(safeData.script, widthPx);
        }
        if (safeType === 'code-example') {
            const narrative = [safeData.label, safeData.text]
                .map(v => withToStr(deps, v, '').trim())
                .filter(Boolean)
                .reduce((sum, txt) => sum + estimateWrappedLines(txt, charsPerLine), 0);
            const codeLines = estimateCodeLineLoad(safeData.code, widthPx);
            return Math.max(2, narrative + codeLines);
        }
        if (safeType === 'list') {
            const title = withToStr(deps, safeData.title, '').trim();
            const items = withNormalizeListItems(deps, safeData.items || [], []);
            return Math.max(2, estimateCardLineLoad(title, items, widthPx));
        }
        if (safeType === 'definition') {
            richSegments.push(safeData.label, safeData.term, safeData.definition, safeData.example);
        } else if (safeType === 'quote') {
            richSegments.push(safeData.text, safeData.author);
        } else if (safeType === 'callout-box') {
            richSegments.push(safeData.label, safeData.text);
        } else if (safeType === 'exercise-block') {
            richSegments.push(safeData.title, safeData.objective, safeData.correction);
            withNormalizeListItems(deps, safeData.instructions || [], []).forEach(v => richSegments.push(v));
            withNormalizeListItems(deps, safeData.hints || [], []).forEach(v => richSegments.push(v));
        } else if (safeType === 'before-after') {
            richSegments.push(safeData.title, safeData.beforeLabel, safeData.before, safeData.afterLabel, safeData.after);
        } else if (safeType === 'mistake-fix') {
            richSegments.push(safeData.title, safeData.mistakeLabel, safeData.mistake, safeData.fixLabel, safeData.fix);
        } else if (safeType === 'text' || safeType === 'heading') {
            richSegments.push(safeData.html ? withStripHtmlToText(deps, safeData.html) : safeData.text);
        }

        const lines = richSegments
            .map(v => withToStr(deps, v, '').trim())
            .filter(Boolean)
            .reduce((sum, txt) => sum + estimateWrappedLines(txt, charsPerLine), 0);
        return Math.max(1, lines || estimateWrappedLines(withToStr(deps, safeData.text, ''), charsPerLine) || 1);
    };

    const AUTO_EXPAND_LAYOUT = Object.freeze({
        text: { minW: 320, minH: 120, maxW: 1220, maxH: 700, lineHeight: 22, overhead: 34 },
        list: { minW: 340, minH: 170, maxW: 1120, maxH: 700, lineHeight: 23, overhead: 52 },
        table: { minW: 420, minH: 210, maxW: 1220, maxH: 700, lineHeight: 23, overhead: 42 },
        definition: { minW: 420, minH: 220, maxW: 1120, maxH: 700, lineHeight: 22, overhead: 96 },
        quote: { minW: 380, minH: 190, maxW: 1120, maxH: 680, lineHeight: 24, overhead: 72 },
        'callout-box': { minW: 420, minH: 190, maxW: 1120, maxH: 680, lineHeight: 22, overhead: 82 },
        'exercise-block': { minW: 560, minH: 280, maxW: 1180, maxH: 700, lineHeight: 21, overhead: 122 },
        'before-after': { minW: 560, minH: 250, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 106 },
        'mistake-fix': { minW: 560, minH: 250, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 106 },
        'code-example': { minW: 560, minH: 270, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 118 },
        'terminal-session': { minW: 560, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 98 },
        code: { minW: 520, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 90 },
        highlight: { minW: 520, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 90 },
    });

    const callPushFix = (options, path, message) => {
        if (!options || typeof options.pushFix !== 'function') return;
        options.pushFix(options.report, path, message);
    };

    const applyAutoExpandSizing = (out, options = {}) => {
        const type = String(out?.type || '').toLowerCase();
        const cfg = AUTO_EXPAND_LAYOUT[type];
        if (!cfg) return;

        let x = Math.round(toFiniteNumber(out.x, 60));
        let y = Math.round(toFiniteNumber(out.y, 120));
        const minWCanvas = Math.min(cfg.minW, 1280);
        const minHCanvas = Math.min(cfg.minH, 720);
        x = clampNum(x, 0, Math.max(0, 1280 - minWCanvas));
        y = clampNum(y, 0, Math.max(0, 720 - minHCanvas));

        const maxW = Math.max(cfg.minW, Math.min(cfg.maxW, 1280 - x));
        const maxH = Math.max(cfg.minH, Math.min(cfg.maxH, 720 - y));
        let w = Math.round(clampNum(toFiniteNumber(out.w, cfg.minW), cfg.minW, maxW));
        let h = Math.round(clampNum(toFiniteNumber(out.h, cfg.minH), cfg.minH, maxH));
        const original = { x: out.x, y: out.y, w: out.w, h: out.h };

        const deps = {
            toStr: options.toStr,
            normalizeListItems: options.normalizeListItems,
            stripHtmlToText: options.stripHtmlToText,
        };
        const neededHeight = width => {
            const lines = estimateElementLineLoad(type, out.data || {}, width, deps);
            return cfg.overhead + lines * cfg.lineHeight + 14;
        };

        let need = neededHeight(w);
        if (need > h) h = Math.round(clampNum(Math.max(h, need), cfg.minH, maxH));

        if (neededHeight(w) > h) {
            for (let candidate = w + 40; candidate <= maxW; candidate += 40) {
                if (neededHeight(candidate) <= h || candidate >= maxW) {
                    w = candidate;
                    break;
                }
            }
        }

        need = neededHeight(w);
        if (need > h) h = Math.round(clampNum(Math.max(h, need), cfg.minH, maxH));

        out.x = x;
        out.y = y;
        out.w = Math.round(clampNum(w, cfg.minW, maxW));
        out.h = Math.round(clampNum(h, cfg.minH, maxH));

        if (
            Number(original.x) !== out.x
            || Number(original.y) !== out.y
            || Number(original.w) !== out.w
            || Number(original.h) !== out.h
        ) {
            const slidePath = String(options.slidePath || '');
            const index = Math.trunc(Number(options.index));
            callPushFix(options, `${slidePath}.elements[${Number.isFinite(index) ? index : 0}]`, `Dimensions ${type} ajustées pour limiter le défilement interne.`);
        }
    };

    const estimateHeadingOverflow = (headingEl, deps = {}) => {
        if (!headingEl || typeof headingEl !== 'object') return 0;
        const data = (headingEl.data && typeof headingEl.data === 'object') ? headingEl.data : {};
        const style = (headingEl.style && typeof headingEl.style === 'object') ? headingEl.style : {};
        const text = withToStr(deps, data.text, '').trim();
        if (!text) return 0;
        const fontSize = clampNum(toFiniteNumber(style.fontSize, 44), 16, 120);
        const width = Math.max(200, toFiniteNumber(headingEl.w, 1160));
        const charsPerLine = Math.max(8, Math.floor((width - 26) / Math.max(6.5, fontSize * 0.55)));
        const lineCount = Math.max(1, estimateWrappedLines(text, charsPerLine));
        const neededHeight = Math.round(20 + lineCount * (fontSize * 1.18));
        const currentHeight = Math.max(40, toFiniteNumber(headingEl.h, 80));
        return Math.max(0, neededHeight - currentHeight);
    };

    const applyHeadingFlowAdjustments = (elements, options = {}) => {
        if (!Array.isArray(elements) || !elements.length) return;
        const headings = elements
            .filter(el => String(el?.type || '').toLowerCase() === 'heading')
            .sort((a, b) => toFiniteNumber(a?.y, 0) - toFiniteNumber(b?.y, 0));
        if (!headings.length) return;
        const heading = headings[0];
        const overflow = estimateHeadingOverflow(heading, { toStr: options.toStr });
        if (overflow <= 0) return;
        const originalHeadingHeight = Math.max(40, toFiniteNumber(heading.h, 80));
        const headingY = clampNum(Math.round(toFiniteNumber(heading.y, 40)), 0, 719);
        heading.h = clampNum(Math.round(originalHeadingHeight + overflow), 40, Math.max(40, 720 - headingY));
        const shift = Math.max(14, Math.round(overflow + 10));
        const threshold = headingY + originalHeadingHeight - 4;
        let moved = 0;
        elements.forEach((el) => {
            if (!el || el === heading || !Number.isFinite(Number(el.y))) return;
            const y = Math.round(Number(el.y));
            if (y <= threshold) return;
            const h = Math.max(20, Math.round(toFiniteNumber(el.h, 80)));
            const maxY = Math.max(0, 720 - h);
            const nextY = clampNum(y + shift, 0, maxY);
            if (nextY !== y) {
                el.y = nextY;
                moved += 1;
            }
        });
        const slidePath = String(options.slidePath || '');
        callPushFix(options, `${slidePath}.elements`, `Titre long détecté: hauteur du heading ajustée et ${moved} élément(s) décalé(s) vers le bas.`);
    };

    global.OEIImportPipelineLayout = Object.freeze({
        clampNum,
        toFiniteNumber,
        estimateWrappedLines,
        estimateCardLineLoad,
        estimateTableLineLoad,
        estimateCodeLineLoad,
        estimateElementLineLoad,
        applyAutoExpandSizing,
        applyHeadingFlowAdjustments,
        testUtils: Object.freeze({
            clampNum,
            toFiniteNumber,
            estimateWrappedLines,
            estimateCardLineLoad,
            estimateTableLineLoad,
            estimateCodeLineLoad,
            estimateElementLineLoad,
            applyAutoExpandSizing,
            applyHeadingFlowAdjustments,
        }),
    });
})(window);
