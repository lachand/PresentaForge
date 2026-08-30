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
    static esc(t) { return String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
    /**
     * Render a tiny safe inline subset for text coming from data fields.
     * Allowed tags (no attributes): b, strong, i, em, u, code, sub, sup, br.
     */
    static formatInlineRichText(value) {
        const escaped = SlidesShared.esc(value);
        return escaped
            // Restore HTML named/numeric/hex entities escaped by esc() (e.g. &or; &#8744; &#x2228;)
            .replace(/&amp;([a-zA-Z][a-zA-Z0-9]*;|#[0-9]+;|#x[0-9a-fA-F]+;)/g, '&$1')
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

    /* ── Typography system — délégué à slides-typography.js (Lot 17B) ── */

    static get DEFAULT_TYPOGRAPHY() { return window.OEISlidesTypography.DEFAULT_TYPOGRAPHY; }
    static get FONT_BASE_MAP() { return window.OEISlidesTypography.FONT_BASE_MAP; }
    static resolveTypographyDefaults(raw) { return window.OEISlidesTypography.resolveTypographyDefaults(raw); }
    static resolveElementFontSize(type, style, typography, fallback) { return window.OEISlidesTypography.resolveElementFontSize(type, style, typography, fallback); }
    static resolveCodeLineHeight(fontSizePx, fallback) { return window.OEISlidesTypography.resolveCodeLineHeight(fontSizePx, fallback); }

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

    /* ── Tone system — délégué à slides-typography.js (Lot 17B) ── */

    static get LABEL_TONE_HINTS() { return window.OEISlidesTypography.LABEL_TONE_HINTS; }
    static normalizeLabelToken(value) { return window.OEISlidesTypography.normalizeLabelToken(value); }
    static normalizeTone(value) { return window.OEISlidesTypography.normalizeTone(value); }
    static resolveTone(rawTone, label) { return window.OEISlidesTypography.resolveTone(rawTone, label); }
    static tonePalette(rawTone, label) { return window.OEISlidesTypography.tonePalette(rawTone, label); }

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


    /* ── Diagram rendering — délégué à slides-diagram-renderer.js (Lot 17A) ── */

    static get DIAGRAM_PALETTE() { return window.OEISlideDiagramRenderer.DIAGRAM_PALETTE; }
    static _diagramColor(index) { return window.OEISlideDiagramRenderer._diagramColor(index); }
    static _diagramNumber(v) { return window.OEISlideDiagramRenderer._diagramNumber(v); }
    static _diagramRows(rows) { return window.OEISlideDiagramRenderer._diagramRows(rows); }
    static _diagramTransformMode(mode) { return window.OEISlideDiagramRenderer._diagramTransformMode(mode); }
    static _diagramSeriesStyles(ss, count, ct) { return window.OEISlideDiagramRenderer._diagramSeriesStyles(ss, count, ct); }
    static _diagramApplyTransform(series, mode) { return window.OEISlideDiagramRenderer._diagramApplyTransform(series, mode); }
    static _diagramDataset(data) { return window.OEISlideDiagramRenderer._diagramDataset(data); }
    static renderDiagrammeBlock(data, style, typography, options) { return window.OEISlideDiagramRenderer.renderDiagrammeBlock(data, style, typography, options); }


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
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Render all slides into a Reveal.js container (les slides masquées sont exclues, comme
     *  sur toutes les autres surfaces — présentateur, audience, review, export). */
    static renderToReveal(data, container) {
        const visible = (data.slides || []).filter(s => !s || !s.hidden);
        const opts = SlidesShared.buildRenderOptions({ ...data, slides: visible });
        container.innerHTML = visible.map((s, i) => SlidesRenderer.renderSlide(s, i, opts)).join('\n');
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
        // Les notes présentateur sont échappées puis rendues avec le sous-ensemble
        // inline sûr (gras/italique/br…) — cohérent avec la vue présentateur
        // (_pvFormatInline) et sans injection HTML brute dans les exports HTML.
        const notes = includeNotes && slide.notes
            ? `<aside class="notes">${SlidesShared.formatInlineRichText(slide.notes)}</aside>`
            : '';
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
        const emailHtml = s.email ? `<span><a href="mailto:${SlidesRenderer.esc(s.email)}" class="sl-title-meta-email">${SlidesRenderer.esc(s.email)}</a></span>` : '';
        const meta = (s.author || s.date || s.email)
            ? `<div class="sl-title-meta">${s.author ? `<span>${SlidesRenderer.esc(s.author)}</span>` : ''}${s.date ? `<span>${SlidesRenderer.esc(s.date)}</span>` : ''}${emailHtml}</div>`
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
        // Pipeline normalizes left/right into data.left/data.right — support both forms
        const leftData  = s.left  || s.data?.left;
        const rightData = s.right || s.data?.right;
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
        return `${title}<div class="sl-cmp-layout">${renderCol(leftData)}${vs}${renderCol(rightData)}</div>`;
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
