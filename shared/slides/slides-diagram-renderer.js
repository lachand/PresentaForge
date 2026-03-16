// @ts-check
/**
 * slides-diagram-renderer.js — Lot 17A
 * Rendu des diagrammes/graphiques extraits de SlidesShared (slides-core.js).
 * Dépendances : window.SlidesShared (défini dans slides-core.js).
 * Doit être chargé après slides-core.js.
 */
(function(global) {
    'use strict';

    if (!global.SlidesShared) throw new Error('[SlidesDiagramRenderer] slides-core.js doit être chargé avant slides-diagram-renderer.js');

    /** Helper local d'échappement HTML (identique à SlidesShared.esc) */
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const DIAGRAM_PALETTE = Object.freeze([
        'var(--sl-primary,#818cf8)',
        'var(--sl-info,#38bdf8)',
        'var(--sl-success,#22c55e)',
        'var(--sl-warning,#f59e0b)',
        'var(--sl-danger,#ef4444)',
        'var(--sl-accent,#f472b6)',
    ]);

    function _diagramColor(index = 0) {
        const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
        return DIAGRAM_PALETTE[i % DIAGRAM_PALETTE.length];
    }

    function _diagramNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const normalized = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(',', '.');
        if (!normalized) return 0;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    function _diagramRows(rows) {
        if (!Array.isArray(rows)) return [];
        const out = [];
        rows.forEach((row) => {
            if (Array.isArray(row)) {
                const cleaned = row.map((cell) => String(cell ?? '').trim());
                if (cleaned.some(Boolean)) out.push(cleaned);
                return;
            }
            const asText = String(row ?? '').trim();
            if (!asText) return;
            const delimiter = asText.includes('\t')
                ? '\t'
                : (asText.includes(';') ? ';' : (asText.includes('|') ? '|' : null));
            if (!delimiter) {
                out.push([asText]);
                return;
            }
            const parts = asText.split(delimiter).map((cell) => String(cell ?? '').trim());
            if (parts.some(Boolean)) out.push(parts);
        });
        return out;
    }

    function _diagramTransformMode(mode) {
        const normalized = String(mode || '').trim().toLowerCase();
        return ['none', 'percent', 'cumulative', 'average'].includes(normalized) ? normalized : 'none';
    }

    function _diagramSeriesStyles(seriesStyles, count = 1, chartType = 'bar') {
        const src = Array.isArray(seriesStyles) ? seriesStyles : [];
        const n = Math.max(1, Number(count) || 1);
        const lineFamily = ['line', 'area', 'combo', 'radar'].includes(chartType);
        const defaultPoints = ['line', 'combo', 'radar', 'scatter', 'bubble'].includes(chartType);
        const defaultSmooth = ['line', 'area', 'combo'].includes(chartType);
        return Array.from({ length: n }, (_, idx) => {
            const raw = (src[idx] && typeof src[idx] === 'object') ? src[idx] : {};
            const widthRaw = Number(raw.width);
            const width = Number.isFinite(widthRaw)
                ? Math.max(0.5, Math.min(10, widthRaw))
                : (lineFamily ? 2.4 : 1.8);
            const axisRaw = String(raw.axis || '').trim().toLowerCase();
            return {
                color: String(raw.color || _diagramColor(idx)).trim() || _diagramColor(idx),
                width,
                points: raw.points == null ? defaultPoints : !!raw.points,
                smooth: raw.smooth == null ? defaultSmooth : !!raw.smooth,
                axis: chartType === 'combo' && axisRaw === 'secondary' ? 'secondary' : 'primary',
            };
        });
    }

    function _diagramApplyTransform(series, mode = 'none') {
        const transformMode = _diagramTransformMode(mode);
        if (!Array.isArray(series) || !series.length || transformMode === 'none') return series;

        if (transformMode === 'percent') {
            const n = Math.max(...series.map((s) => (Array.isArray(s.values) ? s.values.length : 0)), 0);
            for (let i = 0; i < n; i++) {
                const sum = series.reduce((acc, s) => acc + Math.max(0, Number(s.values?.[i]) || 0), 0);
                for (let si = 0; si < series.length; si++) {
                    const value = Math.max(0, Number(series[si].values?.[i]) || 0);
                    series[si].values[i] = sum > 0 ? (value / sum) * 100 : 0;
                }
            }
            return series;
        }

        if (transformMode === 'cumulative') {
            for (let si = 0; si < series.length; si++) {
                let running = 0;
                const values = Array.isArray(series[si].values) ? series[si].values : [];
                for (let i = 0; i < values.length; i++) {
                    running += Number(values[i]) || 0;
                    values[i] = running;
                }
            }
            return series;
        }

        if (transformMode === 'average') {
            for (let si = 0; si < series.length; si++) {
                const values = Array.isArray(series[si].values) ? series[si].values : [];
                const avg = values.length
                    ? (values.reduce((acc, v) => acc + (Number(v) || 0), 0) / values.length)
                    : 0;
                for (let i = 0; i < values.length; i++) values[i] = avg;
            }
            return series;
        }

        return series;
    }

    function _diagramDataset(data = {}) {
        const rows = _diagramRows(data?.rows || []);
        const chartType = [
            'bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'combo',
            'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall', 'funnel',
            'radar', 'pie', 'donut', 'heatmap', 'treemap', 'sankey', 'gantt', 'radial-gauge',
        ].includes(String(data?.chartType || '').toLowerCase())
            ? String(data.chartType).toLowerCase()
            : 'bar';
        const title = String(data?.title || 'Diagramme').trim() || 'Diagramme';
        const transformMode = _diagramTransformMode(data?.transformMode || 'none');
        if (!rows.length) {
            return { chartType, title, rows: [], categories: [], series: [], seriesStyles: [], transformMode };
        }
        const header = rows[0];
        const seriesNames = header
            .slice(1)
            .map((name, idx) => {
                const n = String(name || '').trim();
                return n || `Série ${idx + 1}`;
            });
        if (!seriesNames.length) seriesNames.push('Série 1');
        const categories = [];
        const series = seriesNames.map((name) => ({ name, values: [] }));
        rows.slice(1).forEach((row, rowIdx) => {
            if (!Array.isArray(row) || !row.length) return;
            const hasAny = row.some((cell) => String(cell ?? '').trim().length > 0);
            if (!hasAny) return;
            const label = String(row[0] || '').trim() || `Catégorie ${rowIdx + 1}`;
            categories.push(label);
            for (let si = 0; si < series.length; si++) {
                series[si].values.push(_diagramNumber(row[si + 1]));
            }
        });
        _diagramApplyTransform(series, transformMode);
        const seriesStyles = _diagramSeriesStyles(data?.seriesStyles, series.length, chartType);
        return { chartType, title, rows, categories, series, seriesStyles, transformMode };
    }

    function renderDiagrammeBlock(data = {}, style = {}, typography = null, options = {}) {
        const dataset = _diagramDataset(data);
        const chartType = dataset.chartType || 'bar';
        const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
        const rowData = rows.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()));
        const categories = dataset.categories || [];
        const series = dataset.series || [];
        const seriesStyles = _diagramSeriesStyles(dataset.seriesStyles, series.length || 1, chartType);
        const title = dataset.title || 'Diagramme';
        const fallbackFontSize = Number(options?.fallbackFontSize);
        const base = window.SlidesShared.resolveElementFontSize(
            'diagramme',
            style,
            typography,
            Number.isFinite(fallbackFontSize) ? fallbackFontSize : 16
        );
        const titleSize = Math.round(base * 0.9);
        const axisSize = Math.round(base * 0.62);
        const legendSize = Math.round(base * 0.66);
        const textColor = style?.color || 'var(--sl-text,#cbd5e1)';
        const headingColor = style?.titleColor || 'var(--sl-heading,#f1f5f9)';
        const borderColor = 'var(--sl-border,#2d3347)';
        const chartBg = 'color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000)';
        const chartW = 1000;
        const chartH = 420;
        const header = Array.isArray(rows[0]) ? rows[0] : [];
        const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const parseNum = (value) => _diagramNumber(value);
        const seriesStyle = (index) => seriesStyles[index] || _diagramSeriesStyles([], series.length || 1, chartType)[index] || {};
        const seriesColor = (index) => String(seriesStyle(index).color || _diagramColor(index)).trim() || _diagramColor(index);
        const seriesWidth = (index, fallback = 2) => {
            const raw = Number(seriesStyle(index).width);
            if (!Number.isFinite(raw)) return fallback;
            return Math.max(0.5, Math.min(10, raw));
        };
        const seriesPointsVisible = (index, defaultValue = true) => {
            const st = seriesStyle(index);
            return st.points == null ? !!defaultValue : !!st.points;
        };
        const seriesSmoothEnabled = (index, defaultValue = false) => {
            const st = seriesStyle(index);
            return st.smooth == null ? !!defaultValue : !!st.smooth;
        };
        const smoothPath = (points = []) => {
            if (!Array.isArray(points) || points.length < 2) return '';
            let d = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i - 1] || points[i];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[i + 2] || p2;
                const cp1x = p1.x + ((p2.x - p0.x) / 6);
                const cp1y = p1.y + ((p2.y - p0.y) / 6);
                const cp2x = p2.x - ((p3.x - p1.x) / 6);
                const cp2y = p2.y - ((p3.y - p1.y) / 6);
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }
            return d;
        };

        if (!rows.length) {
            return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.5rem;padding:0.8rem;box-sizing:border-box;border:1px solid ${borderColor};border-radius:10px;background:var(--sl-slide-bg,#1a1d27);overflow:hidden;">
                <div style="font-size:${titleSize}px;font-weight:700;color:${headingColor};">${esc(title)}</div>
                <div style="flex:1;display:flex;align-items:center;justify-content:center;border:1px dashed ${borderColor};border-radius:8px;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;padding:0.8rem;text-align:center;">
                    Ajoutez un tableau de données (en-tête + lignes) dans le panneau de propriétés.
                </div>
            </div>`;
        }

        const maxSeriesLen = series.reduce((acc, cur) => Math.max(acc, (cur.values || []).length), 0);
        const nCategories = Math.max(categories.length, maxSeriesLen, rowData.length, 1);
        const allValues = [];
        series.forEach((serie) => {
            (serie.values || []).forEach((v) => allValues.push(Number.isFinite(v) ? v : 0));
        });
        let maxValue = Math.max(1, ...allValues.map((v) => Math.max(0, v)));
        const gridSteps = 4;
        const margin = { left: 68, right: 24, top: 16, bottom: 72 };
        const plotW = chartW - margin.left - margin.right;
        const plotH = chartH - margin.top - margin.bottom;
        let xMax = maxValue;
        let yMax = maxValue;

        if (chartType === 'stacked-bar' || chartType === 'stacked-100') {
            const stackedMax = Array.from({ length: nCategories }, (_, idx) =>
                series.reduce((sum, serie) => sum + Math.max(0, (serie.values || [])[idx] || 0), 0)
            ).reduce((max, value) => Math.max(max, value), 0);
            maxValue = chartType === 'stacked-100' ? 100 : Math.max(1, stackedMax);
            xMax = maxValue;
            yMax = maxValue;
        }

        if (chartType === 'scatter' || chartType === 'bubble') {
            const xSeriesValues = (series[0]?.values || []).map((v) => Math.max(0, v));
            const ySeriesValues = ((series[1] || series[0])?.values || []).map((v) => Math.max(0, v));
            xMax = Math.max(1, ...xSeriesValues);
            yMax = Math.max(1, ...ySeriesValues);
            maxValue = yMax;
        }

        const toY = (v, upper = maxValue) => margin.top + plotH - ((Math.max(0, v) / Math.max(1, upper)) * plotH);
        const toX = (v, upper = xMax) => margin.left + ((Math.max(0, v) / Math.max(1, upper)) * plotW);

        let chartBody = '';
        let legendItems = [];

        if (chartType === 'pie' || chartType === 'donut') {
            const firstSeries = series[0] || { name: 'Série 1', values: [] };
            const pieValues = categories.map((_, idx) => Math.max(0, firstSeries.values[idx] || 0));
            const sum = pieValues.reduce((acc, v) => acc + v, 0);
            if (sum > 0) {
                const cx = chartW / 2;
                const cy = chartH / 2;
                const r = Math.min(plotW, plotH) * 0.44;
                const innerR = chartType === 'donut' ? Math.round(r * 0.56) : 0;
                let start = -Math.PI / 2;
                const slices = [];
                for (let i = 0; i < pieValues.length; i++) {
                    const value = pieValues[i];
                    if (value <= 0) continue;
                    const angle = (value / sum) * Math.PI * 2;
                    const end = start + angle;
                    const color = _diagramColor(i);
                    if (angle >= (Math.PI * 2 - 0.0001)) {
                        slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" />`);
                    } else {
                        const x1 = cx + (r * Math.cos(start));
                        const y1 = cy + (r * Math.sin(start));
                        const x2 = cx + (r * Math.cos(end));
                        const y2 = cy + (r * Math.sin(end));
                        const largeArc = angle > Math.PI ? 1 : 0;
                        slices.push(`<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" />`);
                    }
                    start = end;
                }
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
                    ${slices.join('')}
                    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
                    ${innerR > 0 ? `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${chartBg}" />` : ''}
                </svg>`;
                legendItems = categories.map((label, i) => ({
                    label,
                    value: pieValues[i] || 0,
                    color: _diagramColor(i),
                }));
            } else {
                chartBody = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;">Aucune valeur positive à afficher.</div>`;
            }
        } else if (chartType === 'radial-gauge') {
            const value = Math.max(0, parseNum(series[0]?.values?.[0] || rowData[0]?.[1] || 0));
            const minV = parseNum(series[1]?.values?.[0] || rowData[0]?.[2] || 0);
            let maxV = parseNum(series[2]?.values?.[0] || rowData[0]?.[3] || 100);
            if (!Number.isFinite(maxV) || maxV <= minV) maxV = minV + 100;
            const ratio = clamp((value - minV) / Math.max(1, maxV - minV), 0, 1);
            const cx = chartW / 2;
            const cy = chartH * 0.72;
            const r = Math.min(plotW, plotH) * 0.44;
            const toPolar = (angle) => ({
                x: cx + (r * Math.cos(angle)),
                y: cy + (r * Math.sin(angle)),
            });
            const start = (-135 * Math.PI) / 180;
            const end = (135 * Math.PI) / 180;
            const valEnd = start + ((end - start) * ratio);
            const arcPath = (a1, a2) => {
                const p1 = toPolar(a1);
                const p2 = toPolar(a2);
                const large = (a2 - a1) > Math.PI ? 1 : 0;
                return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
            };
            const label = String(rowData[0]?.[0] || header[1] || 'Valeur');
            chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
                <path d="${arcPath(start, end)}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="20" stroke-linecap="round" />
                <path d="${arcPath(start, valEnd)}" fill="none" stroke="${seriesColor(0)}" stroke-width="20" stroke-linecap="round" />
                <text x="${cx}" y="${cy - 16}" text-anchor="middle" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.round(base * 1.15)}" font-weight="700">${esc(String(round2(value)))}</text>
                <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.66)}">${esc(label)}</text>
                <text x="${cx - r}" y="${cy + 30}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.54)}">${esc(String(round2(minV)))}</text>
                <text x="${cx + r}" y="${cy + 30}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.54)}">${esc(String(round2(maxV)))}</text>
            </svg>`;
        } else if (chartType === 'radar') {
            const cx = 500;
            const cy = 210;
            const radius = 142;
            const nAxis = Math.max(3, nCategories);
            const levels = 4;
            const safeMax = Math.max(1, maxValue);
            const polarPoint = (idx, ratio) => {
                const angle = ((Math.PI * 2) * (idx / nAxis)) - (Math.PI / 2);
                return {
                    x: cx + (Math.cos(angle) * radius * ratio),
                    y: cy + (Math.sin(angle) * radius * ratio),
                };
            };
            const svgParts = [];
            for (let lvl = 1; lvl <= levels; lvl++) {
                const ratio = lvl / levels;
                const ring = [];
                for (let i = 0; i < nAxis; i++) {
                    const p = polarPoint(i, ratio);
                    ring.push(`${p.x},${p.y}`);
                }
                svgParts.push(`<polygon points="${ring.join(' ')}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`);
            }
            for (let i = 0; i < nAxis; i++) {
                const outer = polarPoint(i, 1);
                const label = categories[i] || `Cat. ${i + 1}`;
                const labelPoint = polarPoint(i, 1.14);
                svgParts.push(`<line x1="${cx}" y1="${cy}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.16)" stroke-width="1" />`);
                svgParts.push(`<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(label)}</text>`);
            }
            series.forEach((serie, si) => {
                const color = seriesColor(si);
                const strokeW = seriesWidth(si, 2);
                const showPoints = seriesPointsVisible(si, true);
                const points = [];
                for (let i = 0; i < nAxis; i++) {
                    const value = Math.max(0, serie.values[i] || 0);
                    const ratio = value / safeMax;
                    const p = polarPoint(i, ratio);
                    points.push(p);
                }
                const poly = points.map((p) => `${p.x},${p.y}`).join(' ');
                svgParts.push(`<polygon points="${poly}" fill="color-mix(in srgb,${color} 18%,transparent)" stroke="${color}" stroke-width="${strokeW}" />`);
                if (showPoints) {
                    const pointR = Math.max(2.2, Math.min(5.8, strokeW + 0.6));
                    points.forEach((p) => {
                        svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="${pointR}" fill="${color}" />`);
                    });
                }
            });
            chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
            legendItems = series.map((serie, idx) => ({
                label: serie.name || `Série ${idx + 1}`,
                color: seriesColor(idx),
            }));
        } else if (chartType === 'funnel') {
            const values = categories.map((_, idx) => Math.max(0, (series[0]?.values || [])[idx] || 0));
            const maxV = Math.max(1, ...values);
            const n = Math.max(1, values.length);
            const gap = 6;
            const rowH = (plotH - ((n - 1) * gap)) / n;
            const svgParts = [];
            for (let i = 0; i < n; i++) {
                const v = values[i] || 0;
                const nextV = i < n - 1 ? values[i + 1] : (v * 0.65);
                const wTop = (v / maxV) * (plotW * 0.88);
                const wBottom = (nextV / maxV) * (plotW * 0.88);
                const cx = margin.left + (plotW / 2);
                const y = margin.top + (i * (rowH + gap));
                const x1 = cx - (wTop / 2);
                const x2 = cx + (wTop / 2);
                const x3 = cx + (wBottom / 2);
                const x4 = cx - (wBottom / 2);
                const color = _diagramColor(i);
                const label = categories[i] || `Étape ${i + 1}`;
                svgParts.push(`<path d="M ${x1} ${y} L ${x2} ${y} L ${x3} ${y + rowH} L ${x4} ${y + rowH} Z" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1.2" />`);
                svgParts.push(`<text x="${cx}" y="${y + (rowH / 2) + 4}" text-anchor="middle" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.max(10, Math.round(axisSize * 1.02))}">${esc(`${label} (${round2(v)})`)}</text>`);
            }
            chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
        } else if (chartType === 'treemap') {
            const values = categories.map((_, idx) => Math.max(0, (series[0]?.values || [])[idx] || 0));
            const sum = values.reduce((acc, v) => acc + v, 0);
            if (sum > 0) {
                const svgParts = [];
                let xCursor = margin.left;
                for (let i = 0; i < values.length; i++) {
                    const value = values[i];
                    const width = i === values.length - 1
                        ? (margin.left + plotW) - xCursor
                        : Math.max(8, (value / sum) * plotW);
                    const color = _diagramColor(i);
                    const label = categories[i] || `Bloc ${i + 1}`;
                    svgParts.push(`<rect x="${xCursor}" y="${margin.top}" width="${width}" height="${plotH}" rx="2" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1" />`);
                    if (width > 56) {
                        svgParts.push(`<text x="${xCursor + 8}" y="${margin.top + 18}" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.max(10, Math.round(axisSize * 0.98))}" font-weight="600">${esc(label)}</text>`);
                        svgParts.push(`<text x="${xCursor + 8}" y="${margin.top + 36}" fill="var(--sl-text,#cbd5e1)" font-size="${Math.max(9, Math.round(axisSize * 0.86))}">${esc(String(round2(value)))}</text>`);
                    }
                    xCursor += width;
                }
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
                legendItems = categories.map((label, i) => ({ label, value: values[i], color: _diagramColor(i) }));
            } else {
                chartBody = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;">Aucune valeur positive à afficher.</div>`;
            }
        } else if (chartType === 'sankey') {
            const flows = rowData
                .map((row) => ({
                    source: String(row[0] || '').trim(),
                    target: String(row[1] || '').trim(),
                    value: Math.max(0, parseNum(row[2])),
                }))
                .filter((f) => f.source && f.target && f.value > 0);
            if (!flows.length) {
                chartBody = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;">Format attendu: Source | Cible | Valeur.</div>`;
            } else {
                const sourceNames = Array.from(new Set(flows.map((f) => f.source)));
                const targetNames = Array.from(new Set(flows.map((f) => f.target)));
                const nodeW = 18;
                const sourceTotals = new Map(sourceNames.map((name) => [name, 0]));
                const targetTotals = new Map(targetNames.map((name) => [name, 0]));
                flows.forEach((flow) => {
                    sourceTotals.set(flow.source, (sourceTotals.get(flow.source) || 0) + flow.value);
                    targetTotals.set(flow.target, (targetTotals.get(flow.target) || 0) + flow.value);
                });
                const maxSide = Math.max(
                    1,
                    Array.from(sourceTotals.values()).reduce((a, b) => a + b, 0),
                    Array.from(targetTotals.values()).reduce((a, b) => a + b, 0)
                );
                const scale = plotH / maxSide;
                const layoutNodes = (names, totals, x) => {
                    const nodes = new Map();
                    let yCursor = margin.top;
                    names.forEach((name) => {
                        const h = Math.max(10, (totals.get(name) || 0) * scale);
                        nodes.set(name, { x, y: yCursor, h });
                        yCursor += h + 8;
                    });
                    return nodes;
                };
                const sourceX = margin.left + 40;
                const targetX = margin.left + plotW - 58;
                const srcNodes = layoutNodes(sourceNames, sourceTotals, sourceX);
                const tgtNodes = layoutNodes(targetNames, targetTotals, targetX);
                const srcOffset = new Map(sourceNames.map((name) => [name, 0]));
                const tgtOffset = new Map(targetNames.map((name) => [name, 0]));
                const svgParts = [];
                flows.forEach((flow, i) => {
                    const s = srcNodes.get(flow.source);
                    const t = tgtNodes.get(flow.target);
                    if (!s || !t) return;
                    const thickness = Math.max(2, flow.value * scale);
                    const sy = s.y + (srcOffset.get(flow.source) || 0) + (thickness / 2);
                    const ty = t.y + (tgtOffset.get(flow.target) || 0) + (thickness / 2);
                    srcOffset.set(flow.source, (srcOffset.get(flow.source) || 0) + thickness);
                    tgtOffset.set(flow.target, (tgtOffset.get(flow.target) || 0) + thickness);
                    const sx = s.x + nodeW;
                    const tx = t.x;
                    const c1x = sx + 170;
                    const c2x = tx - 170;
                    const color = _diagramColor(i);
                    svgParts.push(`<path d="M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}" fill="none" stroke="color-mix(in srgb,${color} 70%,transparent)" stroke-width="${thickness}" stroke-linecap="round" opacity="0.78" />`);
                });
                sourceNames.forEach((name, i) => {
                    const node = srcNodes.get(name);
                    if (!node) return;
                    const color = _diagramColor(i);
                    svgParts.push(`<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${node.h}" rx="2" fill="${color}" />`);
                    svgParts.push(`<text x="${node.x - 6}" y="${node.y + (node.h / 2) + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${esc(name)}</text>`);
                });
                targetNames.forEach((name, i) => {
                    const node = tgtNodes.get(name);
                    if (!node) return;
                    const color = _diagramColor(i + sourceNames.length);
                    svgParts.push(`<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${node.h}" rx="2" fill="${color}" />`);
                    svgParts.push(`<text x="${node.x + nodeW + 6}" y="${node.y + (node.h / 2) + 4}" text-anchor="start" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${esc(name)}</text>`);
                });
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
            }
        } else if (chartType === 'gantt') {
            const parseTime = (value) => {
                const raw = String(value ?? '').trim();
                if (!raw) return NaN;
                const numeric = Number(raw.replace(',', '.'));
                if (Number.isFinite(numeric)) return numeric;
                const date = Date.parse(raw.replace(/\//g, '-'));
                return Number.isFinite(date) ? date : NaN;
            };
            const tasks = rowData
                .map((row) => ({
                    label: String(row[0] || '').trim(),
                    start: parseTime(row[1]),
                    end: parseTime(row[2]),
                    group: String(row[3] || '').trim(),
                }))
                .filter((task) => task.label && Number.isFinite(task.start) && Number.isFinite(task.end) && task.end >= task.start);
            if (!tasks.length) {
                chartBody = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;">Format attendu: Tâche | Début | Fin | Groupe.</div>`;
            } else {
                const minStart = Math.min(...tasks.map((task) => task.start));
                let maxEnd = Math.max(...tasks.map((task) => task.end));
                if (maxEnd <= minStart) maxEnd = minStart + 1;
                const isDateScale = maxEnd > 10_000_000_000;
                const fmtTick = (value) => {
                    if (!isDateScale) return String(round2(value));
                    const d = new Date(value);
                    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                };
                const groups = Array.from(new Set(tasks.map((task) => task.group).filter(Boolean)));
                const groupIndex = new Map(groups.map((name, idx) => [name, idx]));
                const rowH = plotH / tasks.length;
                const svgParts = [];
                for (let i = 0; i <= gridSteps; i++) {
                    const ratio = i / gridSteps;
                    const x = margin.left + (plotW * ratio);
                    const value = minStart + ((maxEnd - minStart) * ratio);
                    svgParts.push(`<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />`);
                    svgParts.push(`<text x="${x}" y="${chartH - 8}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(fmtTick(value))}</text>`);
                }
                tasks.forEach((task, idx) => {
                    const y = margin.top + (idx * rowH) + (rowH * 0.18);
                    const h = rowH * 0.64;
                    const x1 = margin.left + (((task.start - minStart) / (maxEnd - minStart)) * plotW);
                    const x2 = margin.left + (((task.end - minStart) / (maxEnd - minStart)) * plotW);
                    const color = task.group
                        ? _diagramColor(groupIndex.get(task.group) || 0)
                        : _diagramColor(idx);
                    svgParts.push(`<rect x="${x1}" y="${y}" width="${Math.max(2, x2 - x1)}" height="${h}" rx="3" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1.1" />`);
                    svgParts.push(`<text x="${margin.left - 6}" y="${y + (h / 2) + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${esc(task.label)}</text>`);
                });
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
                if (groups.length) {
                    legendItems = groups.map((name, idx) => ({ label: name, color: _diagramColor(idx) }));
                }
            }
        } else if (chartType === 'heatmap') {
            const xLabels = header.slice(1).map((cell, idx) => String(cell || '').trim() || `Col ${idx + 1}`);
            const yLabels = rowData.map((row, idx) => String(row[0] || '').trim() || `Ligne ${idx + 1}`);
            const matrix = rowData.map((row) => xLabels.map((_, xi) => parseNum(row[xi + 1])));
            const values = matrix.flat().filter((v) => Number.isFinite(v));
            const minV = values.length ? Math.min(...values) : 0;
            const maxV = values.length ? Math.max(...values) : 1;
            const range = Math.max(1e-9, maxV - minV);
            const nRows = Math.max(1, matrix.length);
            const nCols = Math.max(1, xLabels.length);
            const cellW = plotW / nCols;
            const cellH = plotH / nRows;
            const svgParts = [];
            for (let yi = 0; yi < nRows; yi++) {
                for (let xi = 0; xi < nCols; xi++) {
                    const value = matrix[yi]?.[xi] || 0;
                    const ratio = clamp((value - minV) / range, 0, 1);
                    const x = margin.left + (xi * cellW);
                    const y = margin.top + (yi * cellH);
                    const fill = `color-mix(in srgb,var(--sl-primary,#818cf8) ${20 + (ratio * 72)}%,var(--sl-slide-bg,#1a1d27))`;
                    const txt = ratio > 0.62 ? '#ffffff' : 'var(--sl-text,#cbd5e1)';
                    svgParts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${fill}" stroke="${borderColor}" stroke-width="0.8" />`);
                    svgParts.push(`<text x="${x + (cellW / 2)}" y="${y + (cellH / 2) + 4}" text-anchor="middle" fill="${txt}" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${esc(String(round2(value)))}</text>`);
                }
            }
            xLabels.forEach((label, i) => {
                const x = margin.left + (i * cellW) + (cellW / 2);
                svgParts.push(`<text x="${x}" y="${margin.top - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(label)}</text>`);
            });
            yLabels.forEach((label, i) => {
                const y = margin.top + (i * cellH) + (cellH / 2) + 4;
                svgParts.push(`<text x="${margin.left - 8}" y="${y}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(label)}</text>`);
            });
            chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
            legendItems = [
                { label: `Min ${round2(minV)}`, color: 'color-mix(in srgb,var(--sl-primary,#818cf8) 20%,var(--sl-slide-bg,#1a1d27))' },
                { label: `Max ${round2(maxV)}`, color: 'color-mix(in srgb,var(--sl-primary,#818cf8) 92%,var(--sl-slide-bg,#1a1d27))' },
            ];
        } else {
            let svgParts = [];
            let axisMin = 0;
            let axisMax = maxValue;
            let comboSecondaryMax = axisMax;
            let comboHasSecondaryAxis = false;

            const toYRange = (value, minV, maxV) => {
                const range = Math.max(1e-9, maxV - minV);
                return margin.top + plotH - (((value - minV) / range) * plotH);
            };

            if (chartType === 'waterfall') {
                const deltas = categories.map((_, idx) => (series[0]?.values || [])[idx] || 0);
                let acc = 0;
                let minAcc = 0;
                let maxAcc = 0;
                deltas.forEach((delta) => {
                    acc += delta;
                    minAcc = Math.min(minAcc, acc);
                    maxAcc = Math.max(maxAcc, acc);
                });
                axisMin = Math.min(0, minAcc);
                axisMax = Math.max(1, maxAcc);
            }

            if (chartType === 'combo') {
                const primaryValues = [];
                const secondaryValues = [];
                for (let si = 0; si < series.length; si++) {
                    const values = Array.isArray(series[si]?.values) ? series[si].values : [];
                    const isSecondary = si > 0 && String(seriesStyle(si).axis || '').toLowerCase() === 'secondary';
                    values.forEach((value) => {
                        const safe = Math.max(0, Number(value) || 0);
                        if (isSecondary) secondaryValues.push(safe);
                        else primaryValues.push(safe);
                    });
                }
                axisMax = Math.max(1, ...primaryValues);
                comboSecondaryMax = Math.max(1, ...(secondaryValues.length ? secondaryValues : primaryValues));
                comboHasSecondaryAxis = secondaryValues.length > 0;
            }

            for (let t = 0; t <= gridSteps; t++) {
                const ratio = t / gridSteps;
                const value = axisMin + ((axisMax - axisMin) * ratio);
                const y = toYRange(value, axisMin, axisMax);
                svgParts.push(`<line x1="${margin.left}" y1="${y}" x2="${chartW - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.11)" stroke-width="1" />`);
                svgParts.push(`<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(String(round2(value)))}</text>`);
            }
            svgParts.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />`);
            svgParts.push(`<line x1="${margin.left}" y1="${toYRange(0, axisMin, axisMax)}" x2="${chartW - margin.right}" y2="${toYRange(0, axisMin, axisMax)}" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />`);
            if (chartType === 'combo' && comboHasSecondaryAxis) {
                svgParts.push(`<line x1="${chartW - margin.right}" y1="${margin.top}" x2="${chartW - margin.right}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.1" />`);
                for (let t = 0; t <= gridSteps; t++) {
                    const ratio = t / gridSteps;
                    const value = ratio * comboSecondaryMax;
                    const y = margin.top + plotH - (ratio * plotH);
                    svgParts.push(`<text x="${chartW - margin.right + 8}" y="${y + 4}" text-anchor="start" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(String(round2(value)))}</text>`);
                }
            }

            if (chartType === 'bar') {
                const groupW = plotW / nCategories;
                const clusterW = groupW * 0.76;
                const barW = Math.max(5, clusterW / Math.max(1, series.length));
                for (let i = 0; i < nCategories; i++) {
                    const gx = margin.left + (i * groupW);
                    const startX = gx + ((groupW - clusterW) / 2);
                    for (let si = 0; si < series.length; si++) {
                        const value = Math.max(0, series[si].values[i] || 0);
                        const h = (value / axisMax) * plotH;
                        const x = startX + (si * barW);
                        const y = margin.top + plotH - h;
                        svgParts.push(`<rect x="${x + 0.8}" y="${y}" width="${Math.max(1, barW - 1.6)}" height="${h}" fill="${seriesColor(si)}" rx="1.5" />`);
                    }
                    const cx = gx + (groupW / 2);
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
                }
            } else if (chartType === 'stacked-bar' || chartType === 'stacked-100') {
                const groupW = plotW / nCategories;
                const barW = Math.max(10, groupW * 0.48);
                for (let i = 0; i < nCategories; i++) {
                    const cx = margin.left + (i * groupW) + (groupW / 2);
                    const x = cx - (barW / 2);
                    let accumulated = 0;
                    const total = series.reduce((sum, serie) => sum + Math.max(0, serie.values[i] || 0), 0);
                    for (let si = 0; si < series.length; si++) {
                        const raw = Math.max(0, series[si].values[i] || 0);
                        const value = chartType === 'stacked-100'
                            ? (total > 0 ? ((raw / total) * 100) : 0)
                            : raw;
                        const h = (value / axisMax) * plotH;
                        const y = margin.top + plotH - h - accumulated;
                        svgParts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${seriesColor(si)}" />`);
                        accumulated += h;
                    }
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
                }
            } else if (chartType === 'histogram') {
                const values = categories.map((_, idx) => Math.max(0, (series[0]?.values || [])[idx] || 0));
                const groupW = plotW / nCategories;
                const barW = groupW * 0.92;
                for (let i = 0; i < nCategories; i++) {
                    const value = values[i] || 0;
                    const h = (value / axisMax) * plotH;
                    const x = margin.left + (i * groupW) + ((groupW - barW) / 2);
                    const y = margin.top + plotH - h;
                    svgParts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${seriesColor(0)}" rx="1.2" />`);
                    const cx = margin.left + (i * groupW) + (groupW / 2);
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Bin ${i + 1}`)}</text>`);
                }
                legendItems = [{ label: series[0]?.name || 'Fréquence', color: seriesColor(0) }];
            } else if (chartType === 'combo') {
                const groupW = plotW / nCategories;
                const barW = groupW * 0.42;
                const barSerie = series[0] || { name: 'Barres', values: [] };
                for (let i = 0; i < nCategories; i++) {
                    const value = Math.max(0, barSerie.values[i] || 0);
                    const h = (value / axisMax) * plotH;
                    const x = margin.left + (i * groupW) + ((groupW - barW) / 2);
                    const y = margin.top + plotH - h;
                    svgParts.push(`<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${seriesColor(0)}" rx="1.4" />`);
                }
                const lineSeries = series.slice(1).length
                    ? series.slice(1).map((serie, idx) => ({ serie, sourceIdx: idx + 1 }))
                    : [{ serie: barSerie, sourceIdx: 0 }];
                lineSeries.forEach(({ serie, sourceIdx }) => {
                    const color = seriesColor(sourceIdx);
                    const strokeW = seriesWidth(sourceIdx, 2.4);
                    const showPoints = seriesPointsVisible(sourceIdx, true);
                    const smooth = seriesSmoothEnabled(sourceIdx, false);
                    const isSecondary = comboHasSecondaryAxis
                        && sourceIdx > 0
                        && String(seriesStyle(sourceIdx).axis || '').toLowerCase() === 'secondary';
                    const axisForSeries = isSecondary ? comboSecondaryMax : axisMax;
                    const points = [];
                    for (let i = 0; i < nCategories; i++) {
                        const value = Math.max(0, serie.values[i] || 0);
                        points.push({
                            x: margin.left + (i * groupW) + (groupW / 2),
                            y: margin.top + plotH - ((value / Math.max(1e-9, axisForSeries)) * plotH),
                        });
                    }
                    if (smooth && points.length > 2) {
                        const d = smoothPath(points);
                        if (d) svgParts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`);
                    } else {
                        svgParts.push(`<polyline points="${points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`);
                    }
                    if (showPoints) {
                        const pointR = Math.max(2.2, Math.min(5.8, strokeW + 0.6));
                        points.forEach((p) => svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="${pointR}" fill="${color}" />`));
                    }
                });
                for (let i = 0; i < nCategories; i++) {
                    const cx = margin.left + (i * groupW) + (groupW / 2);
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
                }
                legendItems = series.map((serie, idx) => ({ label: serie.name || `Série ${idx + 1}`, color: seriesColor(idx) }));
            } else if (chartType === 'scatter') {
                const xSeries = series[0] || { name: 'X', values: [] };
                const ySeries = series[1] || { name: 'Y', values: [] };
                const pointCount = Math.max(nCategories, xSeries.values.length, ySeries.values.length);
                for (let i = 0; i <= gridSteps; i++) {
                    const ratio = i / gridSteps;
                    const x = margin.left + (plotW * ratio);
                    const value = xMax * ratio;
                    svgParts.push(`<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`);
                    svgParts.push(`<text x="${x}" y="${chartH - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(String(round2(value)))}</text>`);
                }
                for (let i = 0; i < pointCount; i++) {
                    const xv = Math.max(0, xSeries.values[i] || 0);
                    const yv = Math.max(0, ySeries.values[i] || 0);
                    const px = toX(xv, xMax);
                    const py = toY(yv, yMax);
                    const color = seriesColor(0);
                    const label = categories[i] || `P${i + 1}`;
                    svgParts.push(`<circle cx="${px}" cy="${py}" r="4.2" fill="${color}" />`);
                    svgParts.push(`<text x="${px + 7}" y="${py - 6}" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.92))}">${esc(label)}</text>`);
                }
                legendItems = [
                    { label: `X : ${xSeries.name || 'Série A'}`, color: seriesColor(0) },
                    { label: `Y : ${ySeries.name || 'Série B'}`, color: seriesColor(1) },
                ];
            } else if (chartType === 'bubble') {
                const xSeries = series[0] || { name: 'X', values: [] };
                const ySeries = series[1] || { name: 'Y', values: [] };
                const sizeSeries = series[2] || { name: 'Taille', values: [] };
                const pointCount = Math.max(nCategories, xSeries.values.length, ySeries.values.length, sizeSeries.values.length);
                const sizeMax = Math.max(1, ...sizeSeries.values.map((v) => Math.max(0, v || 0)));
                for (let i = 0; i <= gridSteps; i++) {
                    const ratio = i / gridSteps;
                    const x = margin.left + (plotW * ratio);
                    const value = xMax * ratio;
                    svgParts.push(`<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`);
                    svgParts.push(`<text x="${x}" y="${chartH - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(String(round2(value)))}</text>`);
                }
                for (let i = 0; i < pointCount; i++) {
                    const xv = Math.max(0, xSeries.values[i] || 0);
                    const yv = Math.max(0, ySeries.values[i] || 0);
                    const sv = Math.max(0, sizeSeries.values[i] || 0);
                    const px = toX(xv, xMax);
                    const py = toY(yv, yMax);
                    const radius = 4 + ((sv / sizeMax) * 14);
                    const color = seriesColor(0);
                    const label = categories[i] || `P${i + 1}`;
                    svgParts.push(`<circle cx="${px}" cy="${py}" r="${radius}" fill="color-mix(in srgb,${color} 62%,transparent)" stroke="${color}" stroke-width="1.2" />`);
                    svgParts.push(`<text x="${px + radius + 4}" y="${py - 4}" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${esc(label)}</text>`);
                }
                legendItems = [
                    { label: `X : ${xSeries.name || 'Série A'}`, color: seriesColor(0) },
                    { label: `Y : ${ySeries.name || 'Série B'}`, color: seriesColor(1) },
                    { label: `Taille : ${sizeSeries.name || 'Série C'}`, color: seriesColor(2) },
                ];
            } else if (chartType === 'boxplot') {
                if (series.length < 5) {
                    chartBody = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#94a3b8);font-size:${Math.round(base * 0.8)}px;">Format attendu: Catégorie | Min | Q1 | Médiane | Q3 | Max.</div>`;
                } else {
                    const groupW = plotW / nCategories;
                    for (let i = 0; i < nCategories; i++) {
                        const vals = [
                            parseNum(series[0].values[i]),
                            parseNum(series[1].values[i]),
                            parseNum(series[2].values[i]),
                            parseNum(series[3].values[i]),
                            parseNum(series[4].values[i]),
                        ].sort((a, b) => a - b);
                        const minV = vals[0];
                        const q1 = vals[1];
                        const med = vals[2];
                        const q3 = vals[3];
                        const maxV = vals[4];
                        const cx = margin.left + (i * groupW) + (groupW / 2);
                        const boxW = Math.max(10, groupW * 0.38);
                        const yMin = toYRange(minV, axisMin, axisMax);
                        const yQ1 = toYRange(q1, axisMin, axisMax);
                        const yMed = toYRange(med, axisMin, axisMax);
                        const yQ3 = toYRange(q3, axisMin, axisMax);
                        const yMax = toYRange(maxV, axisMin, axisMax);
                        const color = _diagramColor(i);
                        svgParts.push(`<line x1="${cx}" y1="${yMax}" x2="${cx}" y2="${yMin}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<line x1="${cx - (boxW * 0.35)}" y1="${yMax}" x2="${cx + (boxW * 0.35)}" y2="${yMax}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<line x1="${cx - (boxW * 0.35)}" y1="${yMin}" x2="${cx + (boxW * 0.35)}" y2="${yMin}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<rect x="${cx - (boxW / 2)}" y="${yQ3}" width="${boxW}" height="${Math.max(1.6, yQ1 - yQ3)}" fill="color-mix(in srgb,${color} 20%,transparent)" stroke="${color}" stroke-width="1.3" />`);
                        svgParts.push(`<line x1="${cx - (boxW / 2)}" y1="${yMed}" x2="${cx + (boxW / 2)}" y2="${yMed}" stroke="${color}" stroke-width="1.8" />`);
                        svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
                    }
                    legendItems = [
                        { label: series[0]?.name || 'Min', color: seriesColor(0) },
                        { label: series[1]?.name || 'Q1', color: seriesColor(1) },
                        { label: series[2]?.name || 'Médiane', color: seriesColor(2) },
                        { label: series[3]?.name || 'Q3', color: seriesColor(3) },
                        { label: series[4]?.name || 'Max', color: seriesColor(4) },
                    ];
                }
            } else if (chartType === 'waterfall') {
                const deltas = categories.map((_, idx) => (series[0]?.values || [])[idx] || 0);
                const labels = categories.slice();
                let running = 0;
                const bars = [];
                for (let i = 0; i < deltas.length; i++) {
                    const delta = deltas[i];
                    const start = running;
                    const end = running + delta;
                    bars.push({ label: labels[i] || `Étape ${i + 1}`, start, end, delta, total: false });
                    running = end;
                }
                bars.push({ label: 'Total', start: 0, end: running, delta: running, total: true });
                const groupW = plotW / bars.length;
                const barW = Math.max(10, groupW * 0.56);
                for (let i = 0; i < bars.length; i++) {
                    const bar = bars[i];
                    const top = Math.max(bar.start, bar.end);
                    const bottom = Math.min(bar.start, bar.end);
                    const yTop = toYRange(top, axisMin, axisMax);
                    const yBottom = toYRange(bottom, axisMin, axisMax);
                    const cx = margin.left + (i * groupW) + (groupW / 2);
                    const x = cx - (barW / 2);
                    const color = bar.total
                        ? seriesColor(0)
                        : (bar.delta >= 0 ? 'var(--sl-success,#22c55e)' : 'var(--sl-danger,#ef4444)');
                    svgParts.push(`<rect x="${x}" y="${yTop}" width="${barW}" height="${Math.max(1.6, yBottom - yTop)}" fill="${color}" rx="1.2" />`);
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(bar.label)}</text>`);
                    if (!bar.total && i < bars.length - 2) {
                        const next = bars[i + 1];
                        const yConn = toYRange(next.start, axisMin, axisMax);
                        svgParts.push(`<line x1="${x + barW}" y1="${yConn}" x2="${x + groupW + (groupW - barW) / 2}" y2="${yConn}" stroke="rgba(255,255,255,0.28)" stroke-width="1" stroke-dasharray="3 2" />`);
                    }
                }
                legendItems = [
                    { label: 'Hausse', color: 'var(--sl-success,#22c55e)' },
                    { label: 'Baisse', color: 'var(--sl-danger,#ef4444)' },
                    { label: 'Total', color: seriesColor(0) },
                ];
            } else {
                const stepX = nCategories > 1 ? (plotW / (nCategories - 1)) : 0;
                for (let i = 0; i < nCategories; i++) {
                    const x = margin.left + (i * stepX);
                    svgParts.push(`<text x="${x}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
                }
                for (let si = 0; si < series.length; si++) {
                    const color = seriesColor(si);
                    const strokeW = seriesWidth(si, chartType === 'line' ? 2.6 : 2.2);
                    const showPoints = seriesPointsVisible(si, chartType === 'line');
                    const smooth = seriesSmoothEnabled(si, chartType === 'line' || chartType === 'area');
                    const points = [];
                    for (let i = 0; i < nCategories; i++) {
                        points.push({
                            x: margin.left + (i * stepX),
                            y: toYRange(series[si].values[i] || 0, axisMin, axisMax),
                        });
                    }
                    const pointsAttr = points.map((p) => `${p.x},${p.y}`).join(' ');
                    const smoothLineD = smooth && points.length > 2 ? smoothPath(points) : '';
                    if (chartType === 'area' && points.length) {
                        const first = points[0];
                        const last = points[points.length - 1];
                        const areaPath = smoothLineD
                            ? `${smoothLineD} L ${last.x} ${margin.top + plotH} L ${first.x} ${margin.top + plotH} Z`
                            : `M ${first.x} ${margin.top + plotH} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${last.x} ${margin.top + plotH} Z`;
                        svgParts.push(`<path d="${areaPath}" fill="color-mix(in srgb,${color} 24%,transparent)" stroke="none" />`);
                    }
                    if (smoothLineD) {
                        svgParts.push(`<path d="${smoothLineD}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`);
                    } else {
                        svgParts.push(`<polyline points="${pointsAttr}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" />`);
                    }
                    if (showPoints) {
                        const pointR = Math.max(2.2, Math.min(5.8, strokeW + 0.5));
                        points.forEach((p) => {
                            svgParts.push(`<circle cx="${p.x}" cy="${p.y}" r="${pointR}" fill="${color}" />`);
                        });
                    }
                }
            }

            if (!chartBody) {
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
            }
            if (!legendItems.length && series.length) {
                legendItems = series.map((serie, idx) => ({
                    label: serie.name || `Série ${idx + 1}`,
                    color: seriesColor(idx),
                }));
            }
        }

        const legendHtml = legendItems.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;">
                ${legendItems.map((item) => {
                    const suffix = Object.prototype.hasOwnProperty.call(item, 'value')
                        ? ` (${round2(item.value || 0)})`
                        : '';
                    return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:${legendSize}px;color:${textColor};"><span style="width:10px;height:10px;border-radius:2px;background:${item.color};display:inline-block;"></span>${esc(`${item.label}${suffix}`)}</span>`;
                }).join('')}
            </div>`
            : '';

        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.5rem;padding:0.8rem;box-sizing:border-box;border:1px solid ${borderColor};border-radius:10px;background:var(--sl-slide-bg,#1a1d27);overflow:hidden;">
            <div style="font-size:${titleSize}px;font-weight:700;color:${headingColor};line-height:1.2;">${esc(title)}</div>
            <div style="flex:1;min-height:120px;border:1px solid ${borderColor};border-radius:8px;background:${chartBg};overflow:hidden;">
                ${chartBody}
            </div>
            ${legendHtml}
        </div>`;
    }

    global.OEISlideDiagramRenderer = Object.freeze({
        DIAGRAM_PALETTE,
        renderDiagrammeBlock,
        _diagramColor,
        _diagramNumber,
        _diagramRows,
        _diagramTransformMode,
        _diagramSeriesStyles,
        _diagramApplyTransform,
        _diagramDataset,
    });
})(window);
