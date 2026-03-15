// @ts-check
/* slides-canvas-helpers.js — helpers purs pour CanvasEditor */
(function initSlidesCanvasHelpers(global) {
    'use strict';

    if (global.OEISlidesCanvasHelpers) return;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const lineInRange = (lineNum, rangeStr) => {
        const ranges = String(rangeStr || '').split(',');
        for (const range of ranges) {
            const trimmed = range.trim();
            if (!trimmed) continue;
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10));
                if (lineNum >= start && lineNum <= end) return true;
            } else {
                const n = parseInt(trimmed, 10);
                if (lineNum === n) return true;
            }
        }
        return false;
    };

    const normalizeCodeExampleMode = mode => (
        ['terminal', 'live', 'stepper'].includes(mode) ? mode : 'terminal'
    );

    const computeCodeMetrics = (baseFontSize, resolveCodeLineHeight = null) => {
        const providedBase = Number(baseFontSize);
        const base = Number.isFinite(providedBase) ? Math.max(10, providedBase) : 16;
        const codeSize = Math.round(base * 0.82);
        const lineHeightResolver = typeof resolveCodeLineHeight === 'function'
            ? resolveCodeLineHeight
            : (() => 1.58);
        return {
            headSize: Math.round(base * 0.66),
            codeSize,
            codeLineHeight: clamp(Number(lineHeightResolver(codeSize)) || 1.58, 1.45, 1.9),
            stepTitleSize: Math.round(base * 0.74),
            stepDetailSize: Math.round(base * 0.69),
        };
    };

    const alignElementsRects = (rects, direction = '') => {
        const list = Array.isArray(rects) ? rects.map(el => ({
            id: String(el?.id || ''),
            x: Number(el?.x) || 0,
            y: Number(el?.y) || 0,
            w: Math.max(1, Number(el?.w) || 0),
            h: Math.max(1, Number(el?.h) || 0),
        })) : [];
        if (list.length < 2) return list;
        switch (String(direction || '')) {
            case 'left': {
                const mn = Math.min(...list.map(e => e.x));
                list.forEach(e => { e.x = mn; });
                break;
            }
            case 'right': {
                const mx = Math.max(...list.map(e => e.x + e.w));
                list.forEach(e => { e.x = mx - e.w; });
                break;
            }
            case 'top': {
                const mn = Math.min(...list.map(e => e.y));
                list.forEach(e => { e.y = mn; });
                break;
            }
            case 'bottom': {
                const mx = Math.max(...list.map(e => e.y + e.h));
                list.forEach(e => { e.y = mx - e.h; });
                break;
            }
            case 'center-h': {
                const cx = Math.round(list.reduce((s, e) => s + e.x + e.w / 2, 0) / list.length);
                list.forEach(e => { e.x = Math.round(cx - e.w / 2); });
                break;
            }
            case 'center-v': {
                const cy = Math.round(list.reduce((s, e) => s + e.y + e.h / 2, 0) / list.length);
                list.forEach(e => { e.y = Math.round(cy - e.h / 2); });
                break;
            }
            default:
                break;
        }
        return list;
    };

    const distributeElementsRects = (rects, axis = 'h') => {
        const list = Array.isArray(rects) ? rects.map(el => ({
            id: String(el?.id || ''),
            x: Number(el?.x) || 0,
            y: Number(el?.y) || 0,
            w: Math.max(1, Number(el?.w) || 0),
            h: Math.max(1, Number(el?.h) || 0),
        })) : [];
        if (list.length < 3) return list;
        if (axis === 'h') {
            list.sort((a, b) => a.x - b.x);
            const totalW = list.reduce((s, e) => s + e.w, 0);
            const minX = list[0].x;
            const maxX = list[list.length - 1].x + list[list.length - 1].w;
            const gap = (maxX - minX - totalW) / (list.length - 1);
            let cx = minX;
            list.forEach(e => {
                e.x = Math.round(cx);
                cx += e.w + gap;
            });
            return list;
        }
        list.sort((a, b) => a.y - b.y);
        const totalH = list.reduce((s, e) => s + e.h, 0);
        const minY = list[0].y;
        const maxY = list[list.length - 1].y + list[list.length - 1].h;
        const gap = (maxY - minY - totalH) / (list.length - 1);
        let cy = minY;
        list.forEach(e => {
            e.y = Math.round(cy);
            cy += e.h + gap;
        });
        return list;
    };

    const computeAutoLayoutRects = (rects, options = {}, canvas = {}) => {
        const list = Array.isArray(rects) ? rects.map(el => ({
            id: String(el?.id || ''),
            x: Number(el?.x) || 0,
            y: Number(el?.y) || 0,
            w: Math.max(1, Number(el?.w) || 0),
            h: Math.max(1, Number(el?.h) || 0),
        })) : [];
        if (list.length < 2) return { moved: false, count: list.length, rects: list };

        const canvasWidth = Math.max(320, Number(canvas.canvasWidth) || 1280);
        const canvasHeight = Math.max(180, Number(canvas.canvasHeight) || 720);
        const margin = Math.max(8, Math.min(140, Number(options.margin ?? 36)));
        const gap = Math.max(4, Math.min(80, Number(options.gap ?? 18)));
        const resizeToFit = options.resizeToFit !== false;

        const sorted = [...list].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const minX = Math.min(...sorted.map(e => e.x));
        const maxX = Math.max(...sorted.map(e => e.x + e.w));
        const minY = Math.min(...sorted.map(e => e.y));
        const maxY = Math.max(...sorted.map(e => e.y + e.h));
        const selectedW = Math.max(1, maxX - minX);
        const selectedH = Math.max(1, maxY - minY);

        const areaW = Math.max(
            220,
            Math.min(canvasWidth - margin * 2, Math.max(selectedW + margin, canvasWidth - margin * 2))
        );
        const areaH = Math.max(
            180,
            Math.min(canvasHeight - margin * 2, Math.max(selectedH + margin, canvasHeight - margin * 2))
        );
        const areaX = Math.round((canvasWidth - areaW) / 2);
        const areaY = Math.round((canvasHeight - areaH) / 2);

        const targetCols = Math.max(1, Math.round(Math.sqrt((sorted.length * areaW) / areaH)));
        let best = null;
        for (let cols = 1; cols <= sorted.length; cols++) {
            const rows = Math.ceil(sorted.length / cols);
            const cellW = (areaW - gap * (cols - 1)) / cols;
            const cellH = (areaH - gap * (rows - 1)) / rows;
            if (cellW < 44 || cellH < 44) continue;

            let scaleSum = 0;
            for (const el of sorted) {
                const scale = resizeToFit ? Math.min(1, cellW / Math.max(1, el.w), cellH / Math.max(1, el.h)) : 1;
                scaleSum += scale;
            }
            const avgScale = scaleSum / sorted.length;
            const score = avgScale * 100 - Math.abs(cols - targetCols) * 2;
            if (!best || score > best.score) best = { cols, rows, cellW, cellH, score };
        }
        if (!best) return { moved: false, count: sorted.length, rects: sorted };

        let moved = false;
        const next = sorted.map((el, i) => {
            const col = i % best.cols;
            const row = Math.floor(i / best.cols);
            const cellX = areaX + col * (best.cellW + gap);
            const cellY = areaY + row * (best.cellH + gap);

            let nextW = el.w;
            let nextH = el.h;
            if (resizeToFit) {
                const fit = Math.min(1, best.cellW / Math.max(1, el.w), best.cellH / Math.max(1, el.h));
                if (fit < 0.999) {
                    nextW = Math.max(24, Math.round(el.w * fit));
                    nextH = Math.max(24, Math.round(el.h * fit));
                }
            }

            const nextX = Math.max(0, Math.min(canvasWidth - nextW, Math.round(cellX + (best.cellW - nextW) / 2)));
            const nextY = Math.max(0, Math.min(canvasHeight - nextH, Math.round(cellY + (best.cellH - nextH) / 2)));
            if (nextX !== el.x || nextY !== el.y || nextW !== el.w || nextH !== el.h) moved = true;
            return { ...el, x: nextX, y: nextY, w: nextW, h: nextH };
        });

        return { moved, count: sorted.length, cols: best.cols, rows: best.rows, rects: next };
    };

    const computeSnapResult = (movingRect = {}, elements = [], options = {}) => {
        const id = String(movingRect?.id || '');
        const nx = Number(movingRect?.x) || 0;
        const ny = Number(movingRect?.y) || 0;
        const w = Math.max(1, Number(movingRect?.w) || 0);
        const h = Math.max(1, Number(movingRect?.h) || 0);
        const snapThreshold = Math.max(1, Number(options.snapThreshold) || 8);
        const canvasWidth = Math.max(1, Number(options.canvasWidth) || 1280);
        const canvasHeight = Math.max(1, Number(options.canvasHeight) || 720);
        const gridSize = Math.max(0, Number(options.gridSize) || 0);
        const list = Array.isArray(elements) ? elements : [];
        const others = list.filter(e => String(e?.id || '') !== id);

        const xCands = [0, Math.round(canvasWidth / 2), canvasWidth];
        const yCands = [0, Math.round(canvasHeight / 2), canvasHeight];
        if (gridSize > 0) {
            for (let gx = gridSize; gx < canvasWidth; gx += gridSize) xCands.push(gx);
            for (let gy = gridSize; gy < canvasHeight; gy += gridSize) yCands.push(gy);
        }
        for (const other of others) {
            const ox = Number(other?.x) || 0;
            const oy = Number(other?.y) || 0;
            const ow = Math.max(0, Number(other?.w) || 0);
            const oh = Math.max(0, Number(other?.h) || 0);
            xCands.push(ox, ox + ow / 2, ox + ow);
            yCands.push(oy, oy + oh / 2, oy + oh);
        }

        const xEdgeOffsets = [0, w / 2, w];
        const yEdgeOffsets = [0, h / 2, h];
        let bestDX = snapThreshold;
        let bestDY = snapThreshold;
        let snapDX = 0;
        let snapDY = 0;
        let guideXs = [];
        let guideYs = [];

        for (const cx of xCands) {
            for (const off of xEdgeOffsets) {
                const d = Math.abs(cx - (nx + off));
                if (d < bestDX) {
                    bestDX = d;
                    snapDX = cx - off - nx;
                    guideXs = [cx];
                }
            }
        }
        for (const cy of yCands) {
            for (const off of yEdgeOffsets) {
                const d = Math.abs(cy - (ny + off));
                if (d < bestDY) {
                    bestDY = d;
                    snapDY = cy - off - ny;
                    guideYs = [cy];
                }
            }
        }

        return {
            x: Math.round(nx + (bestDX < snapThreshold ? snapDX : 0)),
            y: Math.round(ny + (bestDY < snapThreshold ? snapDY : 0)),
            guideXs: bestDX < snapThreshold ? guideXs : [],
            guideYs: bestDY < snapThreshold ? guideYs : [],
        };
    };

    const getAnchorPosition = (el, anchor) => {
        const x = Number(el?.x) || 0;
        const y = Number(el?.y) || 0;
        const w = Math.max(0, Number(el?.w) || 0);
        const h = Math.max(0, Number(el?.h) || 0);
        switch (String(anchor || '')) {
            case 'top': return { x: x + w / 2, y };
            case 'right': return { x: x + w, y: y + h / 2 };
            case 'bottom': return { x: x + w / 2, y: y + h };
            case 'left': return { x, y: y + h / 2 };
            default: return { x: x + w / 2, y: y + h / 2 };
        }
    };

    const getAnchorDirection = anchor => {
        switch (String(anchor || '')) {
            case 'top': return { dx: 0, dy: -1 };
            case 'right': return { dx: 1, dy: 0 };
            case 'bottom': return { dx: 0, dy: 1 };
            case 'left': return { dx: -1, dy: 0 };
            default: return { dx: 0, dy: 0 };
        }
    };

    const computeElbowPoints = (p1, a1, p2, a2, gap = 30) => {
        const from = { x: Number(p1?.x) || 0, y: Number(p1?.y) || 0 };
        const to = { x: Number(p2?.x) || 0, y: Number(p2?.y) || 0 };
        const step = Math.max(0, Number(gap) || 0);
        const d1 = getAnchorDirection(a1);
        const d2 = getAnchorDirection(a2);
        const ext1 = { x: from.x + d1.dx * step, y: from.y + d1.dy * step };
        const ext2 = { x: to.x + d2.dx * step, y: to.y + d2.dy * step };
        const isH1 = d1.dx !== 0;
        const isH2 = d2.dx !== 0;
        if (isH1 && isH2) {
            const mx = (ext1.x + ext2.x) / 2;
            return [from, ext1, { x: mx, y: ext1.y }, { x: mx, y: ext2.y }, ext2, to];
        }
        if (!isH1 && !isH2) {
            const my = (ext1.y + ext2.y) / 2;
            return [from, ext1, { x: ext1.x, y: my }, { x: ext2.x, y: my }, ext2, to];
        }
        if (isH1) {
            return [from, ext1, { x: ext2.x, y: ext1.y }, ext2, to];
        }
        return [from, ext1, { x: ext1.x, y: ext2.y }, ext2, to];
    };

    const buildRoundedPolylinePath = (pts, radius = 12) => {
        const list = Array.isArray(pts) ? pts.map(p => ({ x: Number(p?.x) || 0, y: Number(p?.y) || 0 })) : [];
        if (!list.length) return '';
        if (list.length < 3) return `M${list.map(p => `${p.x},${p.y}`).join(' L')}`;
        const maxRadius = Math.max(1, Number(radius) || 12);
        let d = `M${list[0].x},${list[0].y}`;
        for (let i = 1; i < list.length - 1; i += 1) {
            const prev = list[i - 1];
            const cur = list[i];
            const next = list[i + 1];
            const d1x = cur.x - prev.x;
            const d1y = cur.y - prev.y;
            const d2x = next.x - cur.x;
            const d2y = next.y - cur.y;
            const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
            const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
            const r = Math.min(maxRadius, len1 / 2, len2 / 2);
            if (r < 1) {
                d += ` L${cur.x},${cur.y}`;
                continue;
            }
            const arcStart = { x: cur.x - (d1x / len1) * r, y: cur.y - (d1y / len1) * r };
            const arcEnd = { x: cur.x + (d2x / len2) * r, y: cur.y + (d2y / len2) * r };
            d += ` L${arcStart.x},${arcStart.y} Q${cur.x},${cur.y} ${arcEnd.x},${arcEnd.y}`;
        }
        d += ` L${list[list.length - 1].x},${list[list.length - 1].y}`;
        return d;
    };

    const buildConnectorPathData = (conn, sourceRect, targetRect) => {
        if (!conn || !sourceRect || !targetRect) return null;
        const p1 = getAnchorPosition(sourceRect, conn.sourceAnchor);
        const p2 = getAnchorPosition(targetRect, conn.targetAnchor);
        switch (String(conn.lineType || 'straight')) {
            case 'curve': {
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const ddx = p2.x - p1.x;
                const ddy = p2.y - p1.y;
                return `M${p1.x},${p1.y} Q${mx - ddy * 0.3},${my + ddx * 0.3} ${p2.x},${p2.y}`;
            }
            case 'elbow': {
                const pts = computeElbowPoints(p1, conn.sourceAnchor, p2, conn.targetAnchor);
                return `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`;
            }
            case 'rounded': {
                const pts = computeElbowPoints(p1, conn.sourceAnchor, p2, conn.targetAnchor);
                return buildRoundedPolylinePath(pts);
            }
            default:
                return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
        }
    };

    global.OEISlidesCanvasHelpers = Object.freeze({
        lineInRange,
        normalizeCodeExampleMode,
        computeCodeMetrics,
        alignElementsRects,
        distributeElementsRects,
        computeAutoLayoutRects,
        computeSnapResult,
        getAnchorPosition,
        getAnchorDirection,
        computeElbowPoints,
        buildRoundedPolylinePath,
        buildConnectorPathData,
        testUtils: Object.freeze({
            lineInRange,
            normalizeCodeExampleMode,
            computeCodeMetrics,
            alignElementsRects,
            distributeElementsRects,
            computeAutoLayoutRects,
            computeSnapResult,
            getAnchorPosition,
            getAnchorDirection,
            computeElbowPoints,
            buildRoundedPolylinePath,
            buildConnectorPathData,
        }),
    });
})(window);
