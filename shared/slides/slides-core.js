/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/slides-core
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/slides-core.js"></script>
 */
// @ts-check
/**
 * slides-core.js — SlidesRenderer + SlidesThemes + SlidesShared
 * Convertit un fichier slides.json en HTML Reveal.js + gère les thèmes.
 */

/* =========================================================
   SHARED RENDERING UTILITIES (used by both viewer & editor)
   ========================================================= */

class SlidesShared {
    static esc(t) { return String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    /**
     * Render a tiny safe inline subset for text coming from data fields.
     * Allowed tags (no attributes): b, strong, i, em, u, code, sub, sup, br.
     */
    static formatInlineRichText(value) {
        const escaped = SlidesShared.esc(value);
        return escaped
            // Basic markdown support for bold emphasis in list-like fields.
            .replace(/\*\*([^*\n][^*\n]*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_\n][^_\n]*?)__/g, '<strong>$1</strong>')
            // Preserve bold from imported rich text using span+font-weight wrappers.
            .replace(/&lt;span\b[\s\S]*?font-weight\s*:\s*(?:bold|[6-9]00)[\s\S]*?&gt;([\s\S]*?)&lt;\/span\s*&gt;/gi, '<strong>$1</strong>')
            .replace(/&lt;br\s*\/?\s*&gt;/gi, '<br>')
            // Allow a tiny inline-safe subset and strip any attributes.
            .replace(/&lt;(\/?)\s*(b|strong|i|em|u|code|sub|sup)\b[\s\S]*?&gt;/gi, '<$1$2>')
            .replace(/\r?\n/g, '<br>');
    }
    static DEFAULT_TYPOGRAPHY = Object.freeze({ heading: 52, text: 22 });
    static FONT_BASE_MAP = Object.freeze({
        heading: { source: 'heading', ratio: 1 },
        text: { source: 'text', ratio: 1 },
        list: { source: 'text', ratio: 1 },
        code: { source: 'text', ratio: 16 / 22 },
        highlight: { source: 'text', ratio: 16 / 22 },
        definition: { source: 'text', ratio: 18 / 22 },
        'callout-box': { source: 'text', ratio: 18 / 22 },
        'exercise-block': { source: 'text', ratio: 18 / 22 },
        'before-after': { source: 'text', ratio: 17 / 22 },
        'mistake-fix': { source: 'text', ratio: 17 / 22 },
        'rubric-block': { source: 'text', ratio: 16 / 22 },
        'rubrick-block': { source: 'text', ratio: 16 / 22 },
        'code-example': { source: 'text', ratio: 16 / 22 },
        'terminal-session': { source: 'text', ratio: 16 / 22 },
        shape: { source: 'text', ratio: 16 / 22 },
        diagramme: { source: 'text', ratio: 16 / 22 },
        quote: { source: 'text', ratio: 26 / 22 },
        card: { source: 'text', ratio: 18 / 22 },
        table: { source: 'text', ratio: 18 / 22 },
        latex: { source: 'text', ratio: 32 / 22 },
        timer: { source: 'text', ratio: 48 / 22 },
    });

    static resolveTypographyDefaults(raw = null) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const heading = Number(source.heading);
        const text = Number(source.text);
        return {
            heading: Number.isFinite(heading)
                ? Math.max(12, Math.min(160, Math.round(heading)))
                : SlidesShared.DEFAULT_TYPOGRAPHY.heading,
            text: Number.isFinite(text)
                ? Math.max(10, Math.min(120, Math.round(text)))
                : SlidesShared.DEFAULT_TYPOGRAPHY.text,
        };
    }

    static resolveElementFontSize(type = '', style = {}, typography = null, fallback = 16) {
        const raw = style?.fontSize;
        const explicit = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
        if (Number.isFinite(explicit)) return Math.max(8, explicit);
        const t = SlidesShared.resolveTypographyDefaults(typography);
        const map = SlidesShared.FONT_BASE_MAP[type];
        if (map) {
            const source = map.source === 'heading' ? t.heading : t.text;
            return Math.max(8, Math.round(source * map.ratio));
        }
        const fb = Number(fallback);
        return Number.isFinite(fb) ? Math.max(8, Math.round(fb)) : t.text;
    }

    static resolveCodeLineHeight(fontSizePx, fallback = 1.58) {
        const n = Number(fontSizePx);
        if (!Number.isFinite(n)) return fallback;
        const size = Math.max(8, Math.min(96, n));
        const computed = 1.44 + ((size - 12) / 120);
        return Math.round(Math.max(1.45, Math.min(1.78, computed)) * 100) / 100;
    }

    /**
     * Build a normalized render options object used across editor/viewer/export/replay.
     * @param {any} data
     * @param {any} overrides
     * @returns {any}
     */
    static buildRenderOptions(data = {}, overrides = {}) {
        const src = (data && typeof data === 'object') ? data : {};
        const slides = Array.isArray(src.slides) ? src.slides : [];
        const chapterNumbers = (typeof SlidesRenderer !== 'undefined' && typeof SlidesRenderer._buildChapterNumbers === 'function')
            ? SlidesRenderer._buildChapterNumbers(slides, src.autoNumberChapters)
            : null;
        const base = {
            showSlideNumber: !!src.showSlideNumber,
            footerText: src.footerText || null,
            footerConfig: (src.footerConfig && typeof src.footerConfig === 'object') ? src.footerConfig : null,
            metadata: (src.metadata && typeof src.metadata === 'object') ? src.metadata : {},
            totalSlides: slides.length,
            chapterNumbers,
            captionRegistry: SlidesShared.buildCaptionRegistry(slides),
            typography: SlidesShared.resolveTypographyDefaults(src.typography),
        };
        return Object.assign(base, overrides && typeof overrides === 'object' ? overrides : {});
    }

    static LABEL_TONE_HINTS = Object.freeze({
        'attention': 'warning',
        'consigne': 'warning',
        'cas limite': 'warning',
        'erreur frequente': 'danger',
        'piege frequent': 'danger',
        'contre exemple': 'danger',
        'correction': 'success',
        'solution': 'success',
        'a retenir': 'success',
        'checklist': 'success',
        'astuce': 'info',
        'bonnes pratiques': 'info',
        'api': 'info',
        'debug': 'info',
        'performance': 'info',
        'snippet': 'info',
        'demo': 'info',
        'synthese': 'info',
        'notion': 'info',
        'rappel': 'info',
        'theoreme': 'info',
        'propriete': 'info',
        'vocabulaire': 'info',
        'application': 'info',
    });

    static normalizeLabelToken(value = '') {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    static normalizeTone(value = '') {
        const tone = String(value || '').trim().toLowerCase();
        if (['primary', 'accent', 'info', 'success', 'warning', 'danger'].includes(tone)) return tone;
        return 'auto';
    }

    static resolveTone(rawTone = '', label = '') {
        const tone = SlidesShared.normalizeTone(rawTone);
        if (tone !== 'auto') return tone;
        const token = SlidesShared.normalizeLabelToken(label);
        return SlidesShared.LABEL_TONE_HINTS[token] || 'primary';
    }

    static tonePalette(rawTone = '', label = '') {
        const tone = SlidesShared.resolveTone(rawTone, label);
        const accentMap = {
            primary: 'var(--sl-primary,#818cf8)',
            accent: 'var(--sl-accent,#f472b6)',
            info: 'var(--sl-info,#38bdf8)',
            success: 'var(--sl-success,#22c55e)',
            warning: 'var(--sl-warning,#f59e0b)',
            danger: 'var(--sl-danger,#ef4444)',
        };
        const accent = accentMap[tone] || accentMap.primary;
        return {
            tone,
            accent,
            softBg: `color-mix(in srgb, ${accent} 6%, var(--sl-slide-bg,#1a1d27))`,
            strongBg: `color-mix(in srgb, ${accent} 10%, var(--sl-slide-bg,#1a1d27))`,
            border: `color-mix(in srgb, ${accent} 40%, var(--sl-border,#2d3347))`,
        };
    }

    /**
     * Auto-format plain text bullets:
     * - lines starting with "-" (or "*" / "+") become bullet rows
     * - leading tabs/spaces control visual nesting
     * Returns escaped HTML safe for direct insertion.
     */
    static autoFormatText(text) {
        const raw = String(text ?? '');
        if (!raw) return '';
        const lines = raw.replace(/\r\n?/g, '\n').split('\n');
        const bulletRe = /^([ \t]*)([-*+•–—−])(?:[ \t]+(.*))?$/;
        let hasBullet = false;
        const rows = [];
        for (const rawLine of lines) {
            const line = String(rawLine || '').replace(/\u00a0/g, ' ');
            const match = line.match(bulletRe);
            if (match) {
                hasBullet = true;
                const indentRaw = match[1] || '';
                const tabCount = (indentRaw.match(/\t/g) || []).length;
                const spaceCount = indentRaw.replace(/\t/g, '').length;
                const level = Math.max(0, tabCount + Math.floor(spaceCount / 2));
                rows.push(
                    `<div style="display:flex;align-items:flex-start;gap:0.45em;margin-left:${level * 1.1}em;">` +
                    `<span style="color:var(--sl-primary,#818cf8);line-height:1.35;">•</span>` +
                    `<span>${SlidesShared.esc(match[3] || '')}</span>` +
                    `</div>`
                );
                continue;
            }
            if (!line.trim()) {
                rows.push('<div style="height:0.55em"></div>');
                continue;
            }
            rows.push(`<div>${SlidesShared.esc(line)}</div>`);
        }
        if (!hasBullet) return SlidesShared.esc(raw);
        return rows.join('');
    }

    static _extractObjectText(value, depth = 0) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value !== 'object' || depth >= 2) return '';
        const keys = ['text', 'label', 'title', 'name', 'value', 'content'];
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
            const candidate = SlidesShared._extractObjectText(value[key], depth + 1);
            if (candidate) return candidate;
        }
        for (const candidateValue of Object.values(value)) {
            if (candidateValue == null || typeof candidateValue === 'object') continue;
            const candidate = SlidesShared._extractObjectText(candidateValue, depth + 1);
            if (candidate) return candidate;
        }
        for (const candidateValue of Object.values(value)) {
            if (!candidateValue || typeof candidateValue !== 'object') continue;
            const candidate = SlidesShared._extractObjectText(candidateValue, depth + 1);
            if (candidate) return candidate;
        }
        return '';
    }

    static normalizeSmartArtItems(items, fallback = []) {
        const source = Array.isArray(items) ? items : [];
        const cleaned = source
            .map(item => SlidesShared._extractObjectText(item))
            .map(value => String(value || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        if (cleaned.length) return cleaned;
        const fb = Array.isArray(fallback) ? fallback : [];
        return fb
            .map(item => SlidesShared._extractObjectText(item))
            .map(value => String(value || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    }

    /**
     * Generate SVG inner markup for a shape element.
     * @returns {{ svgInner: string, opacity: number, textHtml: string }}
     */
    static shapeSVG(el, { escapeText = true, baseFontSize = null, typography = null } = {}) {
        const s = el.style || {};
        const d = el.data || {};
        const shapeType = d.shapeType || d.shape || 'rect';
        const fill = s.fill || 'var(--sl-primary)';
        const opacity = s.opacity ?? 0.25;
        const stroke = s.stroke || 'none';
        const sw = s.strokeWidth || 0;
        const text = d.text || '';
        const fallbackFontSize = Number(baseFontSize);
        const finalFontSize = Number.isFinite(fallbackFontSize)
            ? Math.max(8, fallbackFontSize)
            : 16;
        let svgInner = '';
        switch (shapeType) {
            case 'ellipse': svgInner = `<ellipse cx="50%" cy="50%" rx="49%" ry="49%" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'triangle': svgInner = `<polygon points="50,2 98,98 2,98" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'diamond': svgInner = `<polygon points="50,2 98,50 50,98 2,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'hexagon': svgInner = `<polygon points="25,2 75,2 98,50 75,98 25,98 2,50" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'star': svgInner = `<polygon points="50,2 62,38 98,38 68,60 78,96 50,74 22,96 32,60 2,38 38,38" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'arrow-right': svgInner = `<polygon points="2,30 65,30 65,8 98,50 65,92 65,70 2,70" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'arrow-left': svgInner = `<polygon points="98,30 35,30 35,8 2,50 35,92 35,70 98,70" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'arrow-up': svgInner = `<polygon points="30,98 30,35 8,35 50,2 92,35 70,35 70,98" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'arrow-down': svgInner = `<polygon points="30,2 30,65 8,65 50,98 92,65 70,65 70,2" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            case 'rounded-rect': svgInner = `<rect x="2" y="2" width="96" height="96" rx="20" ry="20" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
            default: svgInner = `<rect x="2" y="2" width="96" height="96" rx="${s.borderRadius||2}" ry="${s.borderRadius||2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; break;
        }
        const displayText = escapeText ? SlidesShared.esc(text) : text;
        const textHtml = text ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${s.color||'var(--sl-text,#fff)'};font-size:${SlidesShared.resolveElementFontSize('shape', s, typography, finalFontSize)}px;font-weight:${s.fontWeight||'normal'};text-align:center;padding:8px;pointer-events:none;">${displayText}</div>` : '';
        return { svgInner, opacity, textHtml };
    }

    /**
     * Generate code terminal HTML (title bar + gutter + code).
     * @param {string} code
     * @param {string} language
     * @param {string} prefix - CSS class prefix ('sl' or 'cel')
     * @returns {string}
     */
    static codeTerminal(code, language, prefix = 'sl') {
        const lang = SlidesShared.esc(language || '');
        const lines = (code || '').split('\n');
        const gutter = lines.map((_, i) => i + 1).join('\n');
        const codeEsc = SlidesShared.esc(code || '');
        return `<div class="${prefix}-code-terminal">` +
            `<div class="${prefix}-code-tbar"><span class="${prefix}-code-dot ${prefix}-code-dot-r"></span><span class="${prefix}-code-dot ${prefix}-code-dot-y"></span><span class="${prefix}-code-dot ${prefix}-code-dot-g"></span><span class="${prefix}-code-tbar-lang">${lang}</span></div>` +
            `<div class="${prefix}-code-scroll"><div class="${prefix}-code-gutter">${gutter}</div><pre><code class="language-${lang}">${codeEsc}</code></pre></div>` +
            `</div>`;
    }

    static DIAGRAM_PALETTE = Object.freeze([
        'var(--sl-primary,#818cf8)',
        'var(--sl-info,#38bdf8)',
        'var(--sl-success,#22c55e)',
        'var(--sl-warning,#f59e0b)',
        'var(--sl-danger,#ef4444)',
        'var(--sl-accent,#f472b6)',
    ]);

    static _diagramColor(index = 0) {
        const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
        return SlidesShared.DIAGRAM_PALETTE[i % SlidesShared.DIAGRAM_PALETTE.length];
    }

    static _diagramNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const normalized = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(',', '.');
        if (!normalized) return 0;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    static _diagramRows(rows) {
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

    static _diagramTransformMode(mode) {
        const normalized = String(mode || '').trim().toLowerCase();
        return ['none', 'percent', 'cumulative', 'average'].includes(normalized) ? normalized : 'none';
    }

    static _diagramSeriesStyles(seriesStyles, count = 1, chartType = 'bar') {
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
                color: String(raw.color || SlidesShared._diagramColor(idx)).trim() || SlidesShared._diagramColor(idx),
                width,
                points: raw.points == null ? defaultPoints : !!raw.points,
                smooth: raw.smooth == null ? defaultSmooth : !!raw.smooth,
                axis: chartType === 'combo' && axisRaw === 'secondary' ? 'secondary' : 'primary',
            };
        });
    }

    static _diagramApplyTransform(series, mode = 'none') {
        const transformMode = SlidesShared._diagramTransformMode(mode);
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

    static _diagramDataset(data = {}) {
        const rows = SlidesShared._diagramRows(data?.rows || []);
        const chartType = [
            'bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'combo',
            'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall', 'funnel',
            'radar', 'pie', 'donut', 'heatmap', 'treemap', 'sankey', 'gantt', 'radial-gauge',
        ].includes(String(data?.chartType || '').toLowerCase())
            ? String(data.chartType).toLowerCase()
            : 'bar';
        const title = String(data?.title || 'Diagramme').trim() || 'Diagramme';
        const transformMode = SlidesShared._diagramTransformMode(data?.transformMode || 'none');
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
                series[si].values.push(SlidesShared._diagramNumber(row[si + 1]));
            }
        });
        SlidesShared._diagramApplyTransform(series, transformMode);
        const seriesStyles = SlidesShared._diagramSeriesStyles(data?.seriesStyles, series.length, chartType);
        return { chartType, title, rows, categories, series, seriesStyles, transformMode };
    }

    static renderDiagrammeBlock(data = {}, style = {}, typography = null, options = {}) {
        const dataset = SlidesShared._diagramDataset(data);
        const chartType = dataset.chartType || 'bar';
        const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
        const rowData = rows.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim()));
        const categories = dataset.categories || [];
        const series = dataset.series || [];
        const seriesStyles = SlidesShared._diagramSeriesStyles(dataset.seriesStyles, series.length || 1, chartType);
        const title = dataset.title || 'Diagramme';
        const fallbackFontSize = Number(options?.fallbackFontSize);
        const base = SlidesShared.resolveElementFontSize(
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
        const parseNum = (value) => SlidesShared._diagramNumber(value);
        const seriesStyle = (index) => seriesStyles[index] || SlidesShared._diagramSeriesStyles([], series.length || 1, chartType)[index] || {};
        const seriesColor = (index) => String(seriesStyle(index).color || SlidesShared._diagramColor(index)).trim() || SlidesShared._diagramColor(index);
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
                <div style="font-size:${titleSize}px;font-weight:700;color:${headingColor};">${SlidesShared.esc(title)}</div>
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
                    const color = SlidesShared._diagramColor(i);
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
                    color: SlidesShared._diagramColor(i),
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
                <text x="${cx}" y="${cy - 16}" text-anchor="middle" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.round(base * 1.15)}" font-weight="700">${SlidesShared.esc(String(round2(value)))}</text>
                <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.66)}">${SlidesShared.esc(label)}</text>
                <text x="${cx - r}" y="${cy + 30}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.54)}">${SlidesShared.esc(String(round2(minV)))}</text>
                <text x="${cx + r}" y="${cy + 30}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${Math.round(base * 0.54)}">${SlidesShared.esc(String(round2(maxV)))}</text>
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
                svgParts.push(`<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(label)}</text>`);
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
                const color = SlidesShared._diagramColor(i);
                const label = categories[i] || `Étape ${i + 1}`;
                svgParts.push(`<path d="M ${x1} ${y} L ${x2} ${y} L ${x3} ${y + rowH} L ${x4} ${y + rowH} Z" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1.2" />`);
                svgParts.push(`<text x="${cx}" y="${y + (rowH / 2) + 4}" text-anchor="middle" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.max(10, Math.round(axisSize * 1.02))}">${SlidesShared.esc(`${label} (${round2(v)})`)}</text>`);
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
                    const color = SlidesShared._diagramColor(i);
                    const label = categories[i] || `Bloc ${i + 1}`;
                    svgParts.push(`<rect x="${xCursor}" y="${margin.top}" width="${width}" height="${plotH}" rx="2" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1" />`);
                    if (width > 56) {
                        svgParts.push(`<text x="${xCursor + 8}" y="${margin.top + 18}" fill="var(--sl-heading,#f1f5f9)" font-size="${Math.max(10, Math.round(axisSize * 0.98))}" font-weight="600">${SlidesShared.esc(label)}</text>`);
                        svgParts.push(`<text x="${xCursor + 8}" y="${margin.top + 36}" fill="var(--sl-text,#cbd5e1)" font-size="${Math.max(9, Math.round(axisSize * 0.86))}">${SlidesShared.esc(String(round2(value)))}</text>`);
                    }
                    xCursor += width;
                }
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
                legendItems = categories.map((label, i) => ({ label, value: values[i], color: SlidesShared._diagramColor(i) }));
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
                    const color = SlidesShared._diagramColor(i);
                    svgParts.push(`<path d="M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}" fill="none" stroke="color-mix(in srgb,${color} 70%,transparent)" stroke-width="${thickness}" stroke-linecap="round" opacity="0.78" />`);
                });
                sourceNames.forEach((name, i) => {
                    const node = srcNodes.get(name);
                    if (!node) return;
                    const color = SlidesShared._diagramColor(i);
                    svgParts.push(`<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${node.h}" rx="2" fill="${color}" />`);
                    svgParts.push(`<text x="${node.x - 6}" y="${node.y + (node.h / 2) + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${SlidesShared.esc(name)}</text>`);
                });
                targetNames.forEach((name, i) => {
                    const node = tgtNodes.get(name);
                    if (!node) return;
                    const color = SlidesShared._diagramColor(i + sourceNames.length);
                    svgParts.push(`<rect x="${node.x}" y="${node.y}" width="${nodeW}" height="${node.h}" rx="2" fill="${color}" />`);
                    svgParts.push(`<text x="${node.x + nodeW + 6}" y="${node.y + (node.h / 2) + 4}" text-anchor="start" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${SlidesShared.esc(name)}</text>`);
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
                    svgParts.push(`<text x="${x}" y="${chartH - 8}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(fmtTick(value))}</text>`);
                }
                tasks.forEach((task, idx) => {
                    const y = margin.top + (idx * rowH) + (rowH * 0.18);
                    const h = rowH * 0.64;
                    const x1 = margin.left + (((task.start - minStart) / (maxEnd - minStart)) * plotW);
                    const x2 = margin.left + (((task.end - minStart) / (maxEnd - minStart)) * plotW);
                    const color = task.group
                        ? SlidesShared._diagramColor(groupIndex.get(task.group) || 0)
                        : SlidesShared._diagramColor(idx);
                    svgParts.push(`<rect x="${x1}" y="${y}" width="${Math.max(2, x2 - x1)}" height="${h}" rx="3" fill="color-mix(in srgb,${color} 76%,transparent)" stroke="${color}" stroke-width="1.1" />`);
                    svgParts.push(`<text x="${margin.left - 6}" y="${y + (h / 2) + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${SlidesShared.esc(task.label)}</text>`);
                });
                chartBody = `<svg viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgParts.join('')}</svg>`;
                if (groups.length) {
                    legendItems = groups.map((name, idx) => ({ label: name, color: SlidesShared._diagramColor(idx) }));
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
                    svgParts.push(`<text x="${x + (cellW / 2)}" y="${y + (cellH / 2) + 4}" text-anchor="middle" fill="${txt}" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${SlidesShared.esc(String(round2(value)))}</text>`);
                }
            }
            xLabels.forEach((label, i) => {
                const x = margin.left + (i * cellW) + (cellW / 2);
                svgParts.push(`<text x="${x}" y="${margin.top - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(label)}</text>`);
            });
            yLabels.forEach((label, i) => {
                const y = margin.top + (i * cellH) + (cellH / 2) + 4;
                svgParts.push(`<text x="${margin.left - 8}" y="${y}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(label)}</text>`);
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
                svgParts.push(`<text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(String(round2(value)))}</text>`);
            }
            svgParts.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />`);
            svgParts.push(`<line x1="${margin.left}" y1="${toYRange(0, axisMin, axisMax)}" x2="${chartW - margin.right}" y2="${toYRange(0, axisMin, axisMax)}" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" />`);
            if (chartType === 'combo' && comboHasSecondaryAxis) {
                svgParts.push(`<line x1="${chartW - margin.right}" y1="${margin.top}" x2="${chartW - margin.right}" y2="${margin.top + plotH}" stroke="rgba(255,255,255,0.2)" stroke-width="1.1" />`);
                for (let t = 0; t <= gridSteps; t++) {
                    const ratio = t / gridSteps;
                    const value = ratio * comboSecondaryMax;
                    const y = margin.top + plotH - (ratio * plotH);
                    svgParts.push(`<text x="${chartW - margin.right + 8}" y="${y + 4}" text-anchor="start" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(String(round2(value)))}</text>`);
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
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
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
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
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
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Bin ${i + 1}`)}</text>`);
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
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
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
                    svgParts.push(`<text x="${x}" y="${chartH - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(String(round2(value)))}</text>`);
                }
                for (let i = 0; i < pointCount; i++) {
                    const xv = Math.max(0, xSeries.values[i] || 0);
                    const yv = Math.max(0, ySeries.values[i] || 0);
                    const px = toX(xv, xMax);
                    const py = toY(yv, yMax);
                    const color = seriesColor(0);
                    const label = categories[i] || `P${i + 1}`;
                    svgParts.push(`<circle cx="${px}" cy="${py}" r="4.2" fill="${color}" />`);
                    svgParts.push(`<text x="${px + 7}" y="${py - 6}" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.92))}">${SlidesShared.esc(label)}</text>`);
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
                    svgParts.push(`<text x="${x}" y="${chartH - 6}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(String(round2(value)))}</text>`);
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
                    svgParts.push(`<text x="${px + radius + 4}" y="${py - 4}" fill="var(--sl-muted,#94a3b8)" font-size="${Math.max(9, Math.round(axisSize * 0.9))}">${SlidesShared.esc(label)}</text>`);
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
                        const color = SlidesShared._diagramColor(i);
                        svgParts.push(`<line x1="${cx}" y1="${yMax}" x2="${cx}" y2="${yMin}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<line x1="${cx - (boxW * 0.35)}" y1="${yMax}" x2="${cx + (boxW * 0.35)}" y2="${yMax}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<line x1="${cx - (boxW * 0.35)}" y1="${yMin}" x2="${cx + (boxW * 0.35)}" y2="${yMin}" stroke="${color}" stroke-width="1.2" />`);
                        svgParts.push(`<rect x="${cx - (boxW / 2)}" y="${yQ3}" width="${boxW}" height="${Math.max(1.6, yQ1 - yQ3)}" fill="color-mix(in srgb,${color} 20%,transparent)" stroke="${color}" stroke-width="1.3" />`);
                        svgParts.push(`<line x1="${cx - (boxW / 2)}" y1="${yMed}" x2="${cx + (boxW / 2)}" y2="${yMed}" stroke="${color}" stroke-width="1.8" />`);
                        svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
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
                    svgParts.push(`<text x="${cx}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(bar.label)}</text>`);
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
                    svgParts.push(`<text x="${x}" y="${chartH - 18}" text-anchor="middle" fill="var(--sl-muted,#94a3b8)" font-size="${axisSize}">${SlidesShared.esc(categories[i] || `Cat. ${i + 1}`)}</text>`);
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
                    return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:${legendSize}px;color:${textColor};"><span style="width:10px;height:10px;border-radius:2px;background:${item.color};display:inline-block;"></span>${SlidesShared.esc(`${item.label}${suffix}`)}</span>`;
                }).join('')}
            </div>`
            : '';

        return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.5rem;padding:0.8rem;box-sizing:border-box;border:1px solid ${borderColor};border-radius:10px;background:var(--sl-slide-bg,#1a1d27);overflow:hidden;">
            <div style="font-size:${titleSize}px;font-weight:700;color:${headingColor};line-height:1.2;">${SlidesShared.esc(title)}</div>
            <div style="flex:1;min-height:120px;border:1px solid ${borderColor};border-radius:8px;background:${chartBg};overflow:hidden;">
                ${chartBody}
            </div>
            ${legendHtml}
        </div>`;
    }

    /* ── Caption & Cross-reference system ──────────────── */

    static CAPTION_PREFIXES = {
        image: 'Figure', table: 'Tableau', code: 'Code', highlight: 'Code',
        'terminal-session': 'Code',
        mermaid: 'Diagramme', diagramme: 'Diagramme', latex: 'Équation', video: 'Vidéo',
        smartart: 'Schéma', qrcode: 'QR Code', iframe: 'Contenu',
    };

    /**
     * Scan all canvas slides and build a caption registry.
     * Returns { labelKey: { prefix, number, caption, slideIndex, elementId } }
     * Also attaches _captionEntry to each element for direct access.
     */
    static buildCaptionRegistry(slides) {
        const counters = {}; // { 'Figure': N, 'Tableau': N, ... }
        const registry = {};
        (slides || []).forEach((slide, si) => {
            if (slide.type !== 'canvas' || !slide.elements) return;
            slide.elements.forEach(el => {
                if (!el.data?.caption && !el.data?.refLabel) return;
                const prefix = SlidesShared.CAPTION_PREFIXES[el.type] || '';
                let number = null;
                if (prefix && el.data?.caption) {
                    counters[prefix] = (counters[prefix] || 0) + 1;
                    number = counters[prefix];
                }
                const entry = { prefix, number, caption: el.data.caption || '', slideIndex: si, elementId: el.id };
                el._captionEntry = entry;
                if (el.data?.refLabel) registry[el.data.refLabel] = entry;
            });
        });
        return registry;
    }

    /** Render caption HTML for an element (editor & presentation). */
    static renderCaptionHtml(el, prefix = 'sl') {
        if (!el.data?.caption) return '';
        const entry = el._captionEntry;
        const numbered = entry && entry.prefix && entry.number != null
            ? `<b>${SlidesShared.esc(entry.prefix)}&nbsp;${entry.number}</b> — ` : '';
        return `<div class="${prefix}-caption">${numbered}${SlidesShared.esc(el.data.caption)}</div>`;
    }

    /** Replace {{ref:label}} in text with cross-reference spans. */
    static resolveRefs(text, registry) {
        if (!text || !registry) return text;
        return text.replace(/\{\{ref:([^}]+)\}\}/g, (match, label) => {
            const entry = registry[label];
            if (!entry) return match;
            const display = entry.prefix && entry.number != null
                ? `${entry.prefix}&nbsp;${entry.number}` : (entry.caption || label);
            return `<span class="sl-ref" title="${SlidesShared.esc(entry.caption)}">${display}</span>`;
        });
    }
}

window.SlidesShared = SlidesShared;

/* =========================================================
   RENDERER
   ========================================================= */

class SlidesRenderer {

    static esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Render all slides into a Reveal.js container */
    static renderToReveal(data, container) {
        const slides = data.slides || [];
        const opts = SlidesShared.buildRenderOptions(data);
        container.innerHTML = slides.map((s, i) => SlidesRenderer.renderSlide(s, i, opts)).join('\n');
    }

    /** Compute automatic chapter numbers: returns a Map(slideIndex → formatted number) */
    static _buildChapterNumbers(slides, autoNumber) {
        if (!autoNumber) return null;
        const map = new Map();
        let chapterIdx = 0;
        for (let i = 0; i < slides.length; i++) {
            if (slides[i].type === 'chapter' && !slides[i].hidden) {
                chapterIdx++;
                map.set(i, String(chapterIdx).padStart(2, '0'));
            }
        }
        return map;
    }

    /** Build per-slide CSS variable overrides from slide.themeOverride */
    static _themeOverrideStyle(slide) {
        const ov = slide.themeOverride;
        if (!ov || typeof ov !== 'object') return '';
        const map = {
            heading: '--sl-heading', text: '--sl-text', primary: '--sl-primary',
            accent: '--sl-accent', muted: '--sl-muted', slideBg: '--sl-slide-bg',
            codeBg: '--sl-code-bg', codeText: '--sl-code-text', border: '--sl-border',
            success: '--sl-success', warning: '--sl-warning',
        };
        const parts = [];
        for (const [k, v] of Object.entries(ov)) {
            if (v && map[k]) parts.push(`${map[k]}:${v}`);
        }
        return parts.join(';');
    }

    static _footerTemplateValues(index, opts = {}) {
        const metadata = (opts && typeof opts.metadata === 'object' && opts.metadata) ? opts.metadata : {};
        const footerCfg = (opts && typeof opts.footerConfig === 'object' && opts.footerConfig) ? opts.footerConfig : {};
        return {
            title: String(footerCfg.title || metadata.title || '').trim(),
            author: String(footerCfg.author || metadata.author || '').trim(),
            year: String(footerCfg.year || new Date().getFullYear()).trim(),
            date: String(footerCfg.date || metadata.modified || metadata.created || '').trim(),
            line1: String(footerCfg.line1 || '').trim(),
            slideNumber: String((Number(index) || 0) + 1),
            totalSlides: String(Math.max(1, Number(opts.totalSlides) || 1)),
        };
    }

    static _resolveFooterText(index, opts = {}) {
        const footerCfg = (opts && typeof opts.footerConfig === 'object' && opts.footerConfig) ? opts.footerConfig : null;
        const footerEnabled = footerCfg ? !!footerCfg.enabled : !!opts.footerText;
        if (!footerEnabled) return '';
        const templateRaw = footerCfg?.template || opts.footerText || '';
        const template = String(templateRaw || '').trim();
        if (!template) return '';
        const values = SlidesRenderer._footerTemplateValues(index, opts);
        return template
            .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
                if (Object.prototype.hasOwnProperty.call(values, key)) return String(values[key] ?? '');
                return '';
            })
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    /** Build the overlay HTML for slide number and footer */
    static _slideOverlay(index, opts = {}) {
        const parts = [];
        const footer = SlidesRenderer._resolveFooterText(index, opts);
        if (footer) {
            parts.push(`<div style="position:absolute;left:40px;bottom:12px;font-size:12px;color:rgba(255,255,255,0.4);z-index:9999;pointer-events:none;">${SlidesRenderer.esc(footer)}</div>`);
        }
        if (opts.showSlideNumber) {
            parts.push(`<div style="position:absolute;right:40px;bottom:12px;font-size:14px;color:rgba(255,255,255,0.5);z-index:9999;pointer-events:none;">${index + 1}</div>`);
        }
        return parts.join('');
    }

    static _typographyInlineStyle(opts = {}) {
        const typography = SlidesShared.resolveTypographyDefaults(opts?.typography);
        const codeSize = SlidesShared.resolveElementFontSize('code', {}, typography, 16);
        return `--sl-heading-size:${typography.heading}px;--sl-text-size:${typography.text}px;--sl-code-size:${codeSize}px;`;
    }

    static _bgSize(size) {
        const utils = window.OEIBackgroundUtils;
        if (utils?.cssSize) return utils.cssSize(size);
        if (size === 'contain') return 'contain';
        if (size === 'stretch') return '100% 100%';
        return 'cover';
    }

    static _bgUrl(url) {
        const utils = window.OEIBackgroundUtils;
        if (utils?.normalizeUrl) return utils.normalizeUrl(url);
        const raw = typeof url === 'string' ? url.trim() : String(url || '').trim();
        return raw;
    }

    static _slideBackground(slide = {}) {
        const bgUrl = SlidesRenderer._bgUrl(slide.bgImage);
        const hasBgImage = !!bgUrl;
        const hasBg = !!slide.bg;
        const size = SlidesRenderer._bgSize(slide.bgSize);
        const overlay = !!slide.bgOverlay;

        let style = '';
        let attrs = '';

        if (hasBgImage) {
            const safeUrl = SlidesRenderer.esc(bgUrl);
            if (overlay) {
                style += `background-image:linear-gradient(rgba(0,0,0,0.42),rgba(0,0,0,0.42)),url("${safeUrl}");`;
            } else {
                style += `background-image:url("${safeUrl}");`;
            }
            style += `background-size:${size};background-position:center center;background-repeat:no-repeat;`;
            attrs += ` data-background-image="${safeUrl}" data-background-size="${SlidesRenderer.esc(size)}"`;
            if (hasBg && !String(slide.bg).includes('gradient')) {
                style += `background-color:${SlidesRenderer.esc(slide.bg)};`;
            }
        } else if (hasBg) {
            style += `background:${SlidesRenderer.esc(slide.bg)};`;
            if (String(slide.bg).includes('gradient')) {
                attrs += ` data-background-gradient="${SlidesRenderer.esc(slide.bg)}"`;
            } else {
                attrs += ` data-background-color="${SlidesRenderer.esc(slide.bg)}"`;
            }
        }

        return { style, attrs };
    }

    /** Render a single slide as HTML (for preview or Reveal.js) */
    static renderSlide(slide, index = 0, opts = {}) {
        const type = slide.type || 'blank';
        const includeNotes = opts.includeNotes !== false;
        const notes = includeNotes && slide.notes ? `<aside class="notes">${slide.notes}</aside>` : '';
        const overlay = SlidesRenderer._slideOverlay(index, opts);
        let inner = '';
        switch (type) {
            case 'title':      inner = SlidesRenderer._title(slide); break;
            case 'chapter':    inner = SlidesRenderer._chapter(slide, opts, index); break;
            case 'bullets':    inner = SlidesRenderer._bullets(slide); break;
            case 'code':       inner = SlidesRenderer._code(slide); break;
            case 'split':      inner = SlidesRenderer._split(slide); break;
            case 'simulation': inner = SlidesRenderer._simulation(slide); break;
            case 'definition': inner = SlidesRenderer._definition(slide); break;
            case 'comparison': inner = SlidesRenderer._comparison(slide); break;
            case 'image':      inner = SlidesRenderer._image(slide); break;
            case 'quote':      inner = SlidesRenderer._quote(slide); break;
            case 'quiz':       inner = SlidesRenderer._quiz(slide); break;
            case 'blank':      inner = slide.html || ''; break;
            case 'canvas':     return SlidesRenderer._canvasSection(slide, index, notes, opts);
            default:           inner = `<p>Type inconnu : ${SlidesRenderer.esc(type)}</p>`;
        }
        const typeClass = `sl-${type}`;
        const bg = SlidesRenderer._slideBackground(slide);
        const transitionAttr = slide.transition ? ` data-transition="${SlidesRenderer.esc(slide.transition)}"` : '';
        const themeVars = SlidesRenderer._themeOverrideStyle(slide);
        const combinedStyle = `${SlidesRenderer._typographyInlineStyle(opts)}${themeVars ? `${themeVars};` : ''}${bg.style}`;
        const styleAttr = combinedStyle ? ` style="${combinedStyle}"` : '';
        return `<section class="${typeClass}" data-slide-index="${index}"${bg.attrs}${transitionAttr}${styleAttr}>${inner}${overlay}${notes}</section>`;
    }

    static _title(s) {
        const eyebrow = s.eyebrow ? `<div class="sl-title-eyebrow">${SlidesRenderer.esc(s.eyebrow)}</div>` : '';
        const subtitle = s.subtitle ? `<p class="sl-title-sub">${s.subtitle}</p>` : '';
        const meta = (s.author || s.date)
            ? `<div class="sl-title-meta">${s.author ? `<span>${SlidesRenderer.esc(s.author)}</span>` : ''}${s.date ? `<span>${SlidesRenderer.esc(s.date)}</span>` : ''}</div>`
            : '';
        return `<div class="sl-title-content">${eyebrow}<h1>${s.title || 'Sans titre'}</h1>${subtitle}${meta}</div>`;
    }

    static _chapter(s, opts = {}, index = 0) {
        // Auto-number overrides manual number if chapterNumbers map is available
        const autoNum = opts.chapterNumbers?.get(index);
        const numVal = autoNum || s.number;
        const num = numVal ? `<div class="sl-chapter-num">${SlidesRenderer.esc(String(numVal))}</div>` : '';
        const sub = s.subtitle ? `<p class="sl-chapter-sub">${SlidesRenderer.esc(s.subtitle)}</p>` : '';
        return `<div class="sl-chapter-content">${num}<h2>${SlidesRenderer.esc(s.title || 'Chapitre')}</h2>${sub}</div>`;
    }

    static _bullets(s) {
        const revealItems = !!s.revealItems;
        const liCls = revealItems ? ' class="fragment"' : '';
        const items = (s.items || []).map(item => {
            if (typeof item === 'string') {
                return `<li${liCls}>${SlidesShared.formatInlineRichText(item)}</li>`;
            }
            const subs = (item.sub || []).map(sub => `<li${liCls}>${SlidesShared.formatInlineRichText(sub)}</li>`).join('');
            return `<li${liCls}>${SlidesShared.formatInlineRichText(item.text || item)}${subs ? `<ul>${subs}</ul>` : ''}</li>`;
        }).join('');
        const listHtml = `<ul>${items}</ul>`;
        const note = s.note ? `<div class="sl-bullets-note"><strong class="sl-bullets-note-label">Note</strong><br>${s.note}</div>` : '';
        const layout = note
            ? `<div class="sl-bullets-layout"><div class="sl-bullets-list">${listHtml}</div>${note}</div>`
            : listHtml;
        return `<h2>${SlidesRenderer.esc(s.title || '')}</h2>${layout}`;
    }

    static _code(s) {
        const lang    = SlidesRenderer.esc(s.language || 'text');
        const labelRaw = String(s.label ?? 'Code').trim() || 'Code';
        const label   = SlidesRenderer.esc(labelRaw);
        const tone = SlidesShared.tonePalette(s.labelTone ?? s.tone, labelRaw);
        const rawCode = s.code || '';
        const gutter  = rawCode.split('\n').map((_, i) => i + 1).join('\n');
        const code    = SlidesRenderer.esc(rawCode);
        const terminal = `<div class="sl-code-terminal" style="flex:1;height:auto;min-height:0;">
            <div class="sl-code-tbar">
                <div class="sl-code-dot sl-code-dot-r"></div>
                <div class="sl-code-dot sl-code-dot-y"></div>
                <div class="sl-code-dot sl-code-dot-g"></div>
                <span class="sl-code-tbar-lang">${lang}</span>
                <span style="margin-left:auto;font-size:var(--sl-label-size,0.68rem);font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;line-height:1.3;">${label}</span>
            </div>
            <div class="sl-code-scroll" style="max-height:100%;overflow:auto;">
                <div class="sl-code-gutter">${gutter}</div>
                <pre style="flex:1;margin:0;padding:0.65rem 1rem;background:transparent;overflow:visible;min-width:0;border:none;"><code class="language-${lang}">${code}</code></pre>
            </div>
        </div>`;
        const expl = s.explanation ? `<div class="sl-code-expl">${s.explanation}</div>` : '';
        const layout = expl
            ? `<div class="sl-code-layout">${terminal}${expl}</div>`
            : terminal;
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        return `${title}${layout}`;
    }

    static _split(s) {
        const renderCol = (col) => {
            if (!col) return '';
            const label = col.label ? `<div class="sl-split-label">${SlidesRenderer.esc(col.label)}</div>` : '';
            let content = '';
            if (col.type === 'code') {
                const lang = SlidesRenderer.esc(col.language || 'text');
                content = `<pre><code class="language-${lang}" data-trim data-noescape>${SlidesRenderer.esc(col.code || '')}</code></pre>`;
            } else if (col.type === 'bullets' || (col.type !== 'code' && col.type !== 'text' && Array.isArray(col.items))) {
                const revealItems = (col.revealItems != null) ? !!col.revealItems : !!s.revealItems;
                const liCls = revealItems ? ' class="fragment"' : '';
                const items = (col.items || []).map(i => `<li${liCls}>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                content = `<ul>${items}</ul>`;
            } else {
                // text type: accept col.text (string) or col.items (array, join as paragraphs)
                const txt = col.text || (Array.isArray(col.items) ? col.items.map((v) => SlidesShared.formatInlineRichText(v)).join('</p><p>') : '');
                content = txt ? `<p>${txt}</p>` : '';
            }
            return `<div class="sl-split-col">${label}${content}</div>`;
        };
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        return `${title}<div class="sl-split-layout">${renderCol(s.left)}${renderCol(s.right)}</div>`;
    }

    static _simulation(s) {
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        const cfg = JSON.stringify(s.config || {}).replace(/"/g, '&quot;');
        return `${title}<div class="sl-sim-container" data-widget="${SlidesRenderer.esc(s.widget || '')}" data-config="${cfg}"></div>`;
    }

    static _definition(s) {
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        const labelRaw = String(s.label ?? s.blockLabel ?? 'Definition').trim() || 'Definition';
        const label = SlidesRenderer.esc(labelRaw);
        const tone = SlidesShared.tonePalette(s.labelTone ?? s.tone, labelRaw);
        const exampleLabel = SlidesRenderer.esc(String(s.exampleLabel ?? 'Exemple').trim() || 'Exemple');
        const term = s.term ? `<div class="sl-def-term" style="color:${tone.accent}">${SlidesRenderer.esc(s.term)}</div>` : '';
        const body = s.definition ? `<div class="sl-def-body">${s.definition}</div>` : '';
        const example = s.example ? `<div class="sl-def-example"><strong>${exampleLabel} :</strong> ${s.example}</div>` : '';
        return `${title}<div class="sl-def-box" style="background:${tone.strongBg};border-left-color:${tone.accent};border-color:${tone.border};"><div style="font-size:var(--sl-def-label-size,0.72rem);font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;line-height:1.35;margin-bottom:0.25rem;">${label}</div>${term}${body}${example}</div>`;
    }

    static _comparison(s) {
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        const renderCol = (col) => {
            if (!col) return '';
            const revealItems = (col.revealItems != null) ? !!col.revealItems : !!s.revealItems;
            const liCls = revealItems ? ' class="fragment"' : '';
            const items = (col.items || []).map(i => `<li${liCls}>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
            return `<div class="sl-cmp-col">
                <div class="sl-cmp-col-title">${SlidesRenderer.esc(col.title || '')}</div>
                <ul>${items}</ul>
            </div>`;
        };
        const vs = `<div class="sl-cmp-vs">vs</div>`;
        return `${title}<div class="sl-cmp-layout">${renderCol(s.left)}${vs}${renderCol(s.right)}</div>`;
    }

    static _image(s) {
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        const caption = s.caption ? `<p class="sl-image-caption">${SlidesRenderer.esc(s.caption)}</p>` : '';
        const img = s.src ? `<img src="${SlidesRenderer.esc(s.src)}" alt="${SlidesRenderer.esc(s.alt || s.caption || '')}">` : '<p class="sl-muted">[image]</p>';
        return `${title}<div class="sl-image-wrap">${img}${caption}</div>`;
    }

    static _quote(s) {
        const author = s.author ? `<div class="sl-quote-author">${SlidesRenderer.esc(s.author)}</div>` : '';
        return `<blockquote>${s.quote || ''}</blockquote>${author}`;
    }

    static _quiz(s) {
        const E = SlidesRenderer.esc;
        const qType = s.quizType || s.mode || 'mcq';
        const answer = s.answer; // index (mcq) or 0=Vrai/1=Faux (true-false)
        const questionText = s.title || s.question || 'Question';
        const icon = `<div class="sl-quiz-question-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></div>`;
        const title = `${icon}<h2 class="sl-quiz-title">${E(questionText)}</h2>`;
        let body = '';
        if (qType === 'true-false') {
            const labels = ['Vrai', 'Faux'];
            body = `<div class="sl-quiz-options sl-quiz-tf" data-quiz-type="true-false" data-answer="${answer != null ? answer : ''}">
                <div class="sl-quiz-option fragment" data-idx="0"><span class="sl-quiz-marker">V</span>${labels[0]}</div>
                <div class="sl-quiz-option fragment" data-idx="1"><span class="sl-quiz-marker">F</span>${labels[1]}</div>
            </div>`;
        } else if (qType === 'open') {
            body = `<div class="sl-quiz-open"><div class="sl-quiz-open-placeholder">Réponse libre…</div></div>`;
        } else {
            // mcq
            const opts = (s.options || []).map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `<div class="sl-quiz-option fragment" data-idx="${i}"><span class="sl-quiz-marker">${letter}</span>${E(opt)}</div>`;
            }).join('');
            body = `<div class="sl-quiz-options" data-quiz-type="mcq" data-answer="${answer != null ? answer : ''}">${opts}</div>`;
        }
        const explanation = s.explanation ? `<div class="sl-quiz-explanation fragment"><strong>Explication :</strong> ${E(s.explanation)}</div>` : '';
        const answerCount = qType !== 'open' && s.options ? `<div class="sl-quiz-answer-count">${s.options.length} réponse${s.options.length > 1 ? 's' : ''} possible${s.options.length > 1 ? 's' : ''}</div>` : '';
        return `${title}${body}${answerCount}${explanation}`;
    }

    /**
     * Mount simulation widgets in a container after Reveal.js initialization.
     * Call this once after Reveal.initialize(), then again on slidechanged.
     */
    static async mountWidgets(container, revealInstance) {
        // Utilise OEI_WIDGET_REGISTRY (WidgetRegistry.js) comme source unique de vérité.
        // Les chemins de script sont adaptés selon le contexte (viewer = ../shared/components/).
        const BASE = '../shared/components/';

        // Construit un registre local avec les chemins absolus pour ce contexte
        const sourceReg = window.OEI_WIDGET_REGISTRY || {};
        const REGISTRY = {};
        for (const [id, entry] of Object.entries(sourceReg)) {
            const rawScript = String(entry.script || '');
            const isAbsolute = /^(https?:)?\/\//i.test(rawScript);
            REGISTRY[id] = {
                global: entry.global,
                script: isAbsolute ? rawScript : (BASE + rawScript),
            };
        }

        // Stubs requis par les widgets Page-based (TcpHandshakePage, SchedulingPage, etc.)
        if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
        if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
        if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;
        const pluginRuntimeApi = window.OEIWidgetPlugins || null;
        const reportWidgetRuntimeError = (payload = {}) => {
            if (!pluginRuntimeApi || typeof pluginRuntimeApi.reportRuntimeError !== 'function') return;
            try {
                pluginRuntimeApi.reportRuntimeError(Object.assign({
                    source: 'slides-core',
                    stage: 'mount-widgets',
                }, payload || {}));
            } catch (_) {
                // Ignore plugin runtime reporting failures.
            }
        };

        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const el = document.createElement('script');
            el.src = src; el.onload = resolve; el.onerror = reject;
            document.head.appendChild(el);
        });

        const slots = container.querySelectorAll('.sl-sim-container[data-widget]');
        for (const slot of slots) {
            if (slot.dataset.mounted) continue;
            const widgetId = slot.dataset.widget;
            const reg = REGISTRY[widgetId];
            const sourceEntry = sourceReg[widgetId] || null;
            const pluginId = String(sourceEntry?.__pluginId || '').trim();
            if (!reg) {
                reportWidgetRuntimeError({
                    widgetId,
                    pluginId,
                    reason: 'widget-registry-miss',
                    message: `Widget introuvable dans le registre: ${widgetId || '(vide)'}`,
                });
                slot.innerHTML = SlidesRenderer.renderWidgetStaticFallback(widgetId, {}, sourceReg);
                continue;
            }
            try {
                if (!window[reg.global]) {
                    if (!SlidesRenderer._sv) SlidesRenderer._sv = Date.now();
                    if (!/^(https?:)?\/\//i.test(reg.script)) {
                        document.querySelectorAll(`script[src^="${reg.script}"]`).forEach(t => t.remove());
                    }
                    await loadScript(`${reg.script}?v=${SlidesRenderer._sv}`);
                }
                const cls = window[reg.global];
                if (!cls || typeof cls.mount !== 'function') {
                    reportWidgetRuntimeError({
                        widgetId,
                        pluginId,
                        reason: 'widget-global-missing-mount',
                        message: `Classe widget invalide: ${reg.global}`,
                        globalName: reg.global,
                        script: reg.script,
                    });
                    slot.innerHTML = SlidesRenderer.renderWidgetStaticFallback(widgetId, {}, sourceReg);
                    continue;
                }
                const config = JSON.parse(slot.dataset.config || '{}');
                cls.mount(slot, Object.assign({}, config, { type: widgetId }));
                slot.dataset.mounted = '1';
            } catch(e) {
                let config = {};
                try { config = JSON.parse(slot.dataset.config || '{}'); } catch (_) {}
                reportWidgetRuntimeError({
                    widgetId,
                    pluginId,
                    reason: 'widget-mount-exception',
                    message: String(e?.message || e || 'widget mount error'),
                    globalName: reg.global,
                    script: reg.script,
                });
                slot.innerHTML = SlidesRenderer.renderWidgetStaticFallback(widgetId, config, sourceReg);
            }
        }
    }

    /**
     * Rendu fallback statique unifié pour les widgets (viewer/editor/export).
     * @param {string} widgetId
     * @param {Record<string, any>} [config]
     * @param {Record<string, any>} [registry]
     * @returns {string}
     */
    static renderWidgetStaticFallback(widgetId, config = {}, registry = null) {
        const wid = String(widgetId || '').trim();
        const regSource = registry || window.OEI_WIDGET_REGISTRY || {};
        const entry = wid ? regSource[wid] : null;
        if (entry && typeof entry.staticFallback === 'function') {
            try {
                const html = entry.staticFallback(config || {});
                if (typeof html === 'string' && html.trim()) return html;
            } catch (_) {}
        }
        const safeWid = SlidesRenderer.esc(wid || 'Widget');
        return `<div class="sl-widget-static"><div class="sl-widget-static-icon">⚙️</div><div class="sl-widget-static-name">${safeWid}</div><div class="sl-widget-static-desc">Simulation interactive — disponible en présentation</div></div>`;
    }

    /**
     * Pipeline unifié de montage runtime (special elements + widgets).
     * @param {HTMLElement|Element} container
     * @param {any} [revealInstance]
     * @param {{
     *   includeSpecial?: boolean,
     *   includeWidgets?: boolean,
     *   onError?: (phase: 'special'|'widgets', error: unknown) => void,
     * }} [options]
     * @returns {Promise<{ ok: boolean, errors: Array<{ phase: 'special'|'widgets', message: string }> }>}
     */
    static async mountRuntimeElements(container, revealInstance = null, options = {}) {
        const includeSpecial = options?.includeSpecial !== false;
        const includeWidgets = options?.includeWidgets !== false;
        const onError = typeof options?.onError === 'function' ? options.onError : null;
        /** @type {Array<{ phase: 'special'|'widgets', message: string }>} */
        const errors = [];
        if (!container) return { ok: true, errors };
        if (includeSpecial) {
            try {
                await SlidesRenderer.mountSpecialElements(container);
            } catch (error) {
                errors.push({ phase: 'special', message: String(error?.message || error || 'error') });
                if (onError) {
                    try { onError('special', error); } catch (_) {}
                }
            }
        }
        if (includeWidgets) {
            try {
                await SlidesRenderer.mountWidgets(container, revealInstance);
            } catch (error) {
                errors.push({ phase: 'widgets', message: String(error?.message || error || 'error') });
                if (onError) {
                    try { onError('widgets', error); } catch (_) {}
                }
            }
        }
        return { ok: errors.length === 0, errors };
    }

    /**
     * Mount special elements (LaTeX, Mermaid, Timer, Quiz) that require JS libraries or interaction.
     * Delegates to OEISlidesSpecialRuntime.
     * @param {HTMLElement|Element} container
     * @returns {Promise<void>}
     */
    static async mountSpecialElements(container) {
        const runtime = window.OEISlidesSpecialRuntime;
        if (!runtime || typeof runtime.mountSpecialElements !== 'function') {
            throw new Error('OEISlidesSpecialRuntime.mountSpecialElements is required');
        }
        return runtime.mountSpecialElements({ container, SlidesRenderer });
    }

    /**
     * Make a quiz-live QR code div draggable and resizable.
     * Accounts for Reveal.js CSS transform scaling.
     */
    static _buildQrSrc(value, size = 300) {
        const safeValue = String(value || '');
        if (!safeValue) return '';
        if (typeof window !== 'undefined' && window.qrcode) {
            try {
                const qr = window.qrcode(0, 'M');
                qr.addData(safeValue);
                qr.make();
                const svg = qr.createSvgTag({ cellSize: Math.max(2, Math.floor(size / 42)), margin: 1, scalable: true });
                return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            } catch (_) {}
        }
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(safeValue)}`;
    }

    static _makeQrInteractive(qrEl) {
        if (!qrEl || qrEl.dataset.qrInteractive) return;
        qrEl.dataset.qrInteractive = '1';

        let dragging = false, resizing = false;
        let startX, startY, startLeft, startTop, startW, startH;

        // Convert from right-positioned to left-positioned on first interaction
        const ensureLeftPositioned = () => {
            if (qrEl.style.right && qrEl.style.right !== 'auto') {
                const parent = qrEl.offsetParent || qrEl.parentElement;
                if (parent) {
                    const pW = parent.clientWidth || parent.offsetWidth;
                    const elW = qrEl.offsetWidth;
                    const rightVal = parseInt(qrEl.style.right) || 0;
                    qrEl.style.left = (pW - elW - rightVal) + 'px';
                    qrEl.style.right = 'auto';
                }
            }
        };

        // Get transform scale factor from Reveal.js
        const getScale = () => {
            const slides = qrEl.closest('.slides') || document.querySelector('.reveal .slides');
            if (slides) {
                const rect = slides.getBoundingClientRect();
                return rect.width / (slides.offsetWidth || 1280);
            }
            return 1;
        };

        // ── Resize handle ──
        const handle = qrEl.querySelector('.sl-qr-resize-handle');
        if (handle) {
            handle.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                ensureLeftPositioned();
                resizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startW = qrEl.offsetWidth;
                startH = qrEl.offsetHeight;
                handle.setPointerCapture(e.pointerId);
            });
            handle.addEventListener('pointermove', (e) => {
                if (!resizing) return;
                const scale = getScale();
                const dx = (e.clientX - startX) / scale;
                const dy = (e.clientY - startY) / scale;
                // Keep square aspect ratio
                const delta = Math.max(dx, dy);
                const newSize = Math.max(80, startW + delta);
                qrEl.style.width = newSize + 'px';
                qrEl.style.height = newSize + 'px';
            });
            handle.addEventListener('pointerup', () => { resizing = false; });
            handle.addEventListener('pointercancel', () => { resizing = false; });
        }

        // ── Drag ──
        qrEl.addEventListener('pointerdown', (e) => {
            if (resizing || e.target.classList.contains('sl-qr-resize-handle')) return;
            e.stopPropagation();
            e.preventDefault();
            ensureLeftPositioned();
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = qrEl.offsetLeft;
            startTop = qrEl.offsetTop;
            qrEl.style.cursor = 'grabbing';
            qrEl.setPointerCapture(e.pointerId);
        });
        qrEl.addEventListener('pointermove', (e) => {
            if (!dragging || resizing) return;
            const scale = getScale();
            qrEl.style.left = (startLeft + (e.clientX - startX) / scale) + 'px';
            qrEl.style.top = (startTop + (e.clientY - startY) / scale) + 'px';
            qrEl.style.right = 'auto';
        });
        qrEl.addEventListener('pointerup', () => {
            if (dragging) { dragging = false; qrEl.style.cursor = 'grab'; }
        });
        qrEl.addEventListener('pointercancel', () => {
            if (dragging) { dragging = false; qrEl.style.cursor = 'grab'; }
        });
    }

    /* ── Canvas slide renderer (viewer) — délégué à slides-renderer-canvas.js (Lot 16C) ── */

    static _canvasSection(s, index, notes = '', opts = {}) {
        return window.OEISlidesRendererCanvas._canvasSection(s, index, notes, opts);
    }

    static _getAnchorPos(el, anchor) {
        return window.OEISlidesRendererCanvas._getAnchorPos(el, anchor);
    }

    static _anchorDir(anchor) {
        return window.OEISlidesRendererCanvas._anchorDir(anchor);
    }

    static _renderConnectors(connectors, elements) {
        return window.OEISlidesRendererCanvas._renderConnectors(connectors, elements);
    }

    static _canvasElement(el, slideIndex = 0, opts = {}) {
        return window.OEISlidesRendererCanvas._canvasElement(el, slideIndex, opts);
    }
}

window.SlidesRenderer = SlidesRenderer;
