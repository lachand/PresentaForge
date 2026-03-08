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

    /**
     * Generate SVG inner markup for a shape element.
     * @returns {{ svgInner: string, opacity: number, textHtml: string }}
     */
    static shapeSVG(el, { escapeText = true } = {}) {
        const s = el.style || {};
        const d = el.data || {};
        const shapeType = d.shapeType || d.shape || 'rect';
        const fill = s.fill || 'var(--sl-primary)';
        const opacity = s.opacity ?? 0.25;
        const stroke = s.stroke || 'none';
        const sw = s.strokeWidth || 0;
        const text = d.text || '';
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
        const textHtml = text ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:${s.color||'var(--sl-text,#fff)'};font-size:${s.fontSize||16}px;font-weight:${s.fontWeight||'normal'};text-align:center;padding:8px;pointer-events:none;">${displayText}</div>` : '';
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

    /* ── Caption & Cross-reference system ──────────────── */

    static CAPTION_PREFIXES = {
        image: 'Figure', table: 'Tableau', code: 'Code', highlight: 'Code',
        mermaid: 'Diagramme', latex: 'Équation', video: 'Vidéo',
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
   THEMES
   ========================================================= */

class SlidesThemes {
    static BUILT_IN = {
        dark: {
            id: 'dark', name: 'Sombre',
            colors: {
                bg: '#0f1117', slideBg: '#1a1d27', heading: '#f1f5f9',
                text: '#cbd5e1', muted: '#64748b', primary: '#818cf8',
                accent: '#f472b6', codeBg: '#0d1117', codeText: '#e2e8f0',
                border: '#2d3347', success: '#4ade80', warning: '#fb923c',
                tag: 'rgba(129,140,248,0.15)', tagBorder: 'rgba(129,140,248,0.3)',
            },
            fonts: {
                heading: '"Inter", system-ui, sans-serif',
                body: '"Inter", system-ui, sans-serif',
                mono: '"Fira Code", "Cascadia Code", monospace',
            },
        },
        light: {
            id: 'light', name: 'Clair',
            colors: {
                bg: '#f8fafc', slideBg: '#ffffff', heading: '#0f172a',
                text: '#334155', muted: '#94a3b8', primary: '#3b82f6',
                accent: '#8b5cf6', codeBg: '#1e293b', codeText: '#e2e8f0',
                border: '#e2e8f0', success: '#22c55e', warning: '#f59e0b',
                tag: 'rgba(59,130,246,0.1)', tagBorder: 'rgba(59,130,246,0.25)',
            },
            fonts: {
                heading: '"Inter", system-ui, sans-serif',
                body: '"Inter", system-ui, sans-serif',
                mono: '"Fira Code", "Cascadia Code", monospace',
            },
        },
        academic: {
            id: 'academic', name: 'Académique',
            colors: {
                bg: '#1a2340', slideBg: '#1f2b50', heading: '#f0f4ff',
                text: '#c7d2e7', muted: '#7a8db0', primary: '#60a5fa',
                accent: '#f9a8d4', codeBg: '#111827', codeText: '#d1fae5',
                border: '#2e4070', success: '#34d399', warning: '#fbbf24',
                tag: 'rgba(96,165,250,0.15)', tagBorder: 'rgba(96,165,250,0.3)',
            },
            fonts: {
                heading: '"Georgia", "Times New Roman", serif',
                body: '"Inter", system-ui, sans-serif',
                mono: '"Fira Code", monospace',
            },
        },
        terminal: {
            id: 'terminal', name: 'Terminal',
            colors: {
                bg: '#0d0d0d', slideBg: '#111111', heading: '#00ff41',
                text: '#c8ffc8', muted: '#4a7c59', primary: '#00ff41',
                accent: '#ffff00', codeBg: '#000000', codeText: '#00ff41',
                border: '#1a4a1a', success: '#00ff41', warning: '#ffff00',
                tag: 'rgba(0,255,65,0.1)', tagBorder: 'rgba(0,255,65,0.3)',
            },
            fonts: {
                heading: '"Fira Code", monospace',
                body: '"Fira Code", monospace',
                mono: '"Fira Code", monospace',
            },
        },
        ocean: {
            id: 'ocean', name: 'Océan',
            colors: {
                bg: '#0c1821', slideBg: '#102030', heading: '#e0f2fe',
                text: '#bae6fd', muted: '#5d8aa8', primary: '#38bdf8',
                accent: '#67e8f9', codeBg: '#071019', codeText: '#cffafe',
                border: '#1e4060', success: '#6ee7b7', warning: '#fcd34d',
                tag: 'rgba(56,189,248,0.15)', tagBorder: 'rgba(56,189,248,0.3)',
            },
            fonts: {
                heading: '"Inter", system-ui, sans-serif',
                body: '"Inter", system-ui, sans-serif',
                mono: '"Fira Code", monospace',
            },
        },
        icom: {
            id: 'icom', name: 'ICOM Lyon 2',
            colors: {
                bg: '#f3edea', slideBg: '#ffffff', heading: '#333333',
                text: '#5d5d5d', muted: '#888888', primary: '#abbf15',
                accent: '#2869a9', codeBg: '#2b2b2b', codeText: '#d4e157',
                border: '#cfb7ab', success: '#6f7c0d', warning: '#e8a317',
                tag: 'rgba(171,191,21,0.12)', tagBorder: 'rgba(171,191,21,0.35)',
            },
            fonts: {
                heading: '"Barlow", "Inter", system-ui, sans-serif',
                body: '"Montserrat", "Inter", system-ui, sans-serif',
                mono: '"Fira Code", "Cascadia Code", monospace',
            },
        },
        lyon2: {
            id: 'lyon2', name: 'Université Lyon 2',
            colors: {
                bg: '#f3edea', slideBg: '#ffffff', heading: '#333333',
                text: '#5d5d5d', muted: '#888888', primary: '#e84141',
                accent: '#962a2a', codeBg: '#2b2b2b', codeText: '#ffb7b7',
                border: '#cfb7ab', success: '#1a936f', warning: '#e8a317',
                tag: 'rgba(232,65,65,0.10)', tagBorder: 'rgba(232,65,65,0.30)',
            },
            fonts: {
                heading: '"Barlow", "Inter", system-ui, sans-serif',
                body: '"Montserrat", "Inter", system-ui, sans-serif',
                mono: '"Fira Code", "Cascadia Code", monospace',
            },
        },
    };

    static apply(themeData, root = document.documentElement) {
        if (!themeData) return;
        const theme = typeof themeData === 'string'
            ? (SlidesThemes.BUILT_IN[themeData] || SlidesThemes.BUILT_IN.dark)
            : themeData;
        const c = theme.colors || {};
        const f = theme.fonts || {};
        const lt = theme.layoutTokens || {};
        const radius = Number.isFinite(+lt.radius) ? +lt.radius : 12;
        const contentPaddingX = Number.isFinite(+lt.contentPaddingX) ? +lt.contentPaddingX : 48;
        const contentPaddingY = Number.isFinite(+lt.contentPaddingY) ? +lt.contentPaddingY : 40;
        const bodyLineHeight = Number.isFinite(+lt.bodyLineHeight) ? +lt.bodyLineHeight : 1.45;
        const vars = {
            '--sl-bg':         c.bg || '#0f1117',
            '--sl-slide-bg':   c.slideBg || '#1a1d27',
            '--sl-heading':    c.heading || '#f1f5f9',
            '--sl-text':       c.text || '#cbd5e1',
            '--sl-muted':      c.muted || '#64748b',
            '--sl-primary':    c.primary || '#818cf8',
            '--sl-accent':     c.accent || '#f472b6',
            '--sl-code-bg':    c.codeBg || '#0d1117',
            '--sl-code-text':  c.codeText || '#e2e8f0',
            '--sl-border':     c.border || '#2d3347',
            '--sl-success':    c.success || '#4ade80',
            '--sl-warning':    c.warning || '#fb923c',
            '--sl-tag':        c.tag || 'rgba(129,140,248,0.15)',
            '--sl-tag-border': c.tagBorder || 'rgba(129,140,248,0.3)',
            '--sl-font-heading': f.heading || 'system-ui, sans-serif',
            '--sl-font-body':   f.body || 'system-ui, sans-serif',
            '--sl-font-mono':   f.mono || 'monospace',
            '--sl-radius': `${radius}px`,
            '--sl-content-padding-x': String(contentPaddingX),
            '--sl-content-padding-y': String(contentPaddingY),
            '--sl-body-line-height': String(bodyLineHeight),
        };
        for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    }

    static STORAGE_KEY = window.OEIStorage?.KEYS?.SLIDE_THEMES || 'oei-slide-themes';

    static list() {
        const custom = window.OEIStorage?.getJSON
            ? (window.OEIStorage.getJSON(SlidesThemes.STORAGE_KEY, {}) || {})
            : JSON.parse(localStorage.getItem(SlidesThemes.STORAGE_KEY) || '{}');
        return { ...SlidesThemes.BUILT_IN, ...custom };
    }

    static save(theme) {
        const all = window.OEIStorage?.getJSON
            ? (window.OEIStorage.getJSON(SlidesThemes.STORAGE_KEY, {}) || {})
            : JSON.parse(localStorage.getItem(SlidesThemes.STORAGE_KEY) || '{}');
        all[theme.id] = theme;
        if (window.OEIStorage?.setJSON) window.OEIStorage.setJSON(SlidesThemes.STORAGE_KEY, all);
        else localStorage.setItem(SlidesThemes.STORAGE_KEY, JSON.stringify(all));
    }

    static delete(id) {
        if (SlidesThemes.BUILT_IN[id]) return false;
        const all = window.OEIStorage?.getJSON
            ? (window.OEIStorage.getJSON(SlidesThemes.STORAGE_KEY, {}) || {})
            : JSON.parse(localStorage.getItem(SlidesThemes.STORAGE_KEY) || '{}');
        delete all[id];
        if (window.OEIStorage?.setJSON) window.OEIStorage.setJSON(SlidesThemes.STORAGE_KEY, all);
        else localStorage.setItem(SlidesThemes.STORAGE_KEY, JSON.stringify(all));
        return true;
    }

    static exportTheme(theme) {
        const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `theme-${theme.id || 'custom'}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    static importTheme() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = async e => {
                try {
                    const text = await e.target.files[0].text();
                    const theme = JSON.parse(text);
                    if (!theme.id || !theme.name || !theme.colors) throw new Error('Format de thème invalide');
                    resolve(theme);
                } catch(err) { reject(err); }
            };
            input.click();
        });
    }

    /** CSS scoped to .sl-thumb-inner for slide thumbnails in editor */
    static generateThumbnailCSS(themeData) {
        return SlidesThemes.generateCSS(themeData).replace(/\.reveal/g, '.sl-thumb-inner');
    }

    /** Generate a CSS :root override block for a specific theme */
    static generateThemeOverrideCSS(themeData) {
        if (!themeData) return '';
        const theme = typeof themeData === 'string'
            ? (SlidesThemes.BUILT_IN[themeData] || SlidesThemes.BUILT_IN.dark)
            : themeData;
        const c = theme.colors || {};
        const f = theme.fonts || {};
        const lt = theme.layoutTokens || {};
        const vars = [];
        if (c.bg)        vars.push(`--sl-bg:${c.bg}`);
        if (c.slideBg)   vars.push(`--sl-slide-bg:${c.slideBg}`);
        if (c.heading)   vars.push(`--sl-heading:${c.heading}`);
        if (c.text)      vars.push(`--sl-text:${c.text}`);
        if (c.muted)     vars.push(`--sl-muted:${c.muted}`);
        if (c.primary)   vars.push(`--sl-primary:${c.primary}`);
        if (c.accent)    vars.push(`--sl-accent:${c.accent}`);
        if (c.codeBg)    vars.push(`--sl-code-bg:${c.codeBg}`);
        if (c.codeText)  vars.push(`--sl-code-text:${c.codeText}`);
        if (c.border)    vars.push(`--sl-border:${c.border}`);
        if (c.success)   vars.push(`--sl-success:${c.success}`);
        if (c.warning)   vars.push(`--sl-warning:${c.warning}`);
        if (c.tag)       vars.push(`--sl-tag:${c.tag}`);
        if (c.tagBorder) vars.push(`--sl-tag-border:${c.tagBorder}`);
        if (f.heading)   vars.push(`--sl-font-heading:${f.heading}`);
        if (f.body)      vars.push(`--sl-font-body:${f.body}`);
        if (f.mono)      vars.push(`--sl-font-mono:${f.mono}`);
        if (Number.isFinite(+lt.radius)) vars.push(`--sl-radius:${+lt.radius}px`);
        if (Number.isFinite(+lt.contentPaddingX)) vars.push(`--sl-content-padding-x:${+lt.contentPaddingX}`);
        if (Number.isFinite(+lt.contentPaddingY)) vars.push(`--sl-content-padding-y:${+lt.contentPaddingY}`);
        if (Number.isFinite(+lt.bodyLineHeight)) vars.push(`--sl-body-line-height:${+lt.bodyLineHeight}`);
        return vars.length ? `:root{${vars.join(';')}}` : '';
    }

    /** Generate CSS string for the viewer <style> block.
     *  @param {string|object} [themeData] — theme id or object. Defaults to dark.
     */
    static generateCSS(themeData) {
        const _d = SlidesThemes.BUILT_IN.dark;
        let t = themeData;
        if (typeof t === 'string') t = SlidesThemes.BUILT_IN[t] || (SlidesThemes.list && SlidesThemes.list()[t]) || _d;
        if (!t || !t.colors) t = _d;
        const c = { ..._d.colors, ...t.colors };
        const f = { ..._d.fonts, ...t.fonts };
        const lt = t.layoutTokens || {};
        const radius = Number.isFinite(+lt.radius) ? +lt.radius : 12;
        const contentPaddingX = Number.isFinite(+lt.contentPaddingX) ? +lt.contentPaddingX : 48;
        const contentPaddingY = Number.isFinite(+lt.contentPaddingY) ? +lt.contentPaddingY : 40;
        const bodyLineHeight = Number.isFinite(+lt.bodyLineHeight) ? +lt.bodyLineHeight : 1.45;
        return `
:root {
    --sl-bg: ${c.bg}; --sl-slide-bg: ${c.slideBg}; --sl-heading: ${c.heading};
    --sl-text: ${c.text}; --sl-muted: ${c.muted}; --sl-primary: ${c.primary};
    --sl-accent: ${c.accent}; --sl-code-bg: ${c.codeBg}; --sl-code-text: ${c.codeText};
    --sl-border: ${c.border}; --sl-success: ${c.success}; --sl-warning: ${c.warning};
    --sl-tag: ${c.tag}; --sl-tag-border: ${c.tagBorder};
    --sl-font-heading: ${f.heading};
    --sl-font-body: ${f.body};
    --sl-font-mono: ${f.mono};
    --sl-radius: ${radius}px;
    --sl-content-padding-x: ${contentPaddingX};
    --sl-content-padding-y: ${contentPaddingY};
    --sl-body-line-height: ${bodyLineHeight};
}
body { background: var(--sl-bg); }
.reveal { font-family: var(--sl-font-body); color: var(--sl-text); line-height: var(--sl-body-line-height, 1.45); }
.reveal .slides { background: transparent; }
.reveal section {
    background: var(--sl-slide-bg);
    border-radius: var(--sl-radius, 12px);
    padding: calc(var(--sl-content-padding-y, 40) * 1px) calc(var(--sl-content-padding-x, 48) * 1px);
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.reveal h1, .reveal h2, .reveal h3 {
    font-family: var(--sl-font-heading);
    color: var(--sl-heading);
    margin: 0 0 0.5em;
    line-height: 1.15;
    text-transform: none;
    letter-spacing: -0.02em;
}
.reveal h1 { font-size: clamp(2rem,4vw,3rem); font-weight: 800; }
.reveal h2 { font-size: clamp(1.4rem,2.8vw,2rem); font-weight: 700; border-bottom: 2px solid var(--sl-primary); padding-bottom: 0.35em; margin-bottom: 0.7em; }
.reveal h3 { font-size: clamp(1rem,2vw,1.4rem); font-weight: 600; color: var(--sl-primary); }
.reveal p, .reveal li { font-size: clamp(0.9rem,1.8vw,1.15rem); line-height: 1.6; }
.reveal ul, .reveal ol { margin: 0; padding-left: 1.4em; text-align: left; }
.reveal li { margin-bottom: 0.5em; }
.reveal li::marker { color: var(--sl-primary); }
.reveal pre { width: 100%; margin: 0; background: var(--sl-code-bg); border-radius: 8px; border: 1px solid var(--sl-border); }
.reveal code { font-family: var(--sl-font-mono); font-size: 0.85em; }
.reveal pre code { font-size: clamp(0.65rem,1.4vw,0.9rem); padding: 1rem 1.2rem; line-height: 1.6; color: var(--sl-code-text); background: transparent; }
.reveal a { color: var(--sl-primary); }
.reveal .sl-muted { color: var(--sl-muted); font-size: 0.85em; }
.reveal .sl-accent { color: var(--sl-accent); }
.reveal .sl-tag {
    display: inline-block; background: var(--sl-tag); border: 1px solid var(--sl-tag-border);
    border-radius: 20px; padding: 0.1em 0.6em; font-size: 0.75em;
    font-family: var(--sl-font-mono); color: var(--sl-primary);
}

/* === SLIDE TYPES === */

/* Title */
.sl-title { text-align: center; align-items: center; }
.sl-title h1 { font-size: clamp(2.2rem,5vw,3.5rem); }
.sl-title-eyebrow { font-size: 0.8em; font-family: var(--sl-font-mono); color: var(--sl-primary); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
.sl-title-sub { font-size: clamp(1rem,2.2vw,1.4rem); color: var(--sl-muted); margin-top: 0.5rem; }
.sl-title-meta { display: flex; gap: 1.5rem; margin-top: 2rem; font-size: 0.8em; color: var(--sl-muted); justify-content: center; }

/* Chapter */
.sl-chapter { text-align: center; align-items: center; background: linear-gradient(135deg, var(--sl-slide-bg) 0%, color-mix(in srgb, var(--sl-primary) 15%, var(--sl-slide-bg)) 100%) !important; }
.sl-chapter-num { font-size: clamp(3rem,8vw,6rem); font-weight: 900; color: var(--sl-primary); opacity: 0.25; line-height: 1; font-family: var(--sl-font-heading); }
.sl-chapter h2 { border: none; font-size: clamp(1.8rem,4vw,3rem); margin-top: 0; }
.sl-chapter-sub { color: var(--sl-muted); font-size: 1.1em; }

/* Bullets */
.sl-bullets { text-align: left; }
.sl-bullets-layout { display: flex; gap: 2rem; flex: 1; align-items: flex-start; margin-top: 0.5rem; }
.sl-bullets-list { flex: 1; }
.sl-bullets-note { flex: 0 0 35%; background: color-mix(in srgb, var(--sl-primary) 8%, var(--sl-slide-bg)); border-left: 3px solid var(--sl-primary); border-radius: 0 8px 8px 0; padding: 1rem 1.2rem; font-size: 0.85em; color: var(--sl-muted); }

/* Code */
.sl-code { text-align: left; }
.sl-code-layout { display: flex; gap: 1.5rem; flex: 1; align-items: flex-start; }
.sl-code-pre { flex: 1; overflow: auto; }
.sl-code-expl { flex: 0 0 35%; font-size: 0.85em; color: var(--sl-muted); line-height: 1.6; padding-top: 0.5rem; }
.sl-code-expl p { margin: 0 0 0.5em; }

/* Split */
.sl-split { text-align: left; }
.sl-split-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex: 1; align-items: start; }
.sl-split-col { display: flex; flex-direction: column; gap: 0.75rem; }
.sl-split-label { font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sl-primary); margin-bottom: 0.25rem; }

/* Definition */
.sl-definition { text-align: left; }
.sl-def-box { background: color-mix(in srgb, var(--sl-primary) 8%, var(--sl-slide-bg)); border: 1px solid var(--sl-tag-border); border-left: 4px solid var(--sl-primary); border-radius: 0 10px 10px 0; padding: 1.2rem 1.5rem; margin: 0.75rem 0; }
.sl-def-term { font-family: var(--sl-font-mono); font-size: 1.1em; font-weight: 700; color: var(--sl-primary); margin-bottom: 0.5rem; }
.sl-def-body { color: var(--sl-text); line-height: 1.6; }
.sl-def-example { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--sl-border); font-size: 0.85em; color: var(--sl-muted); }
.sl-def-example strong { color: var(--sl-accent); }

/* Comparison */
.sl-comparison { text-align: left; }
.sl-cmp-layout { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; flex: 1; align-items: start; }
.sl-cmp-col { background: color-mix(in srgb, var(--sl-primary) 5%, var(--sl-slide-bg)); border: 1px solid var(--sl-border); border-radius: 10px; padding: 1rem 1.2rem; }
.sl-cmp-col-title { font-size: 0.85em; font-weight: 700; color: var(--sl-primary); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--sl-border); }
.sl-cmp-vs { display: flex; align-items: center; font-weight: 900; font-size: 1.2em; color: var(--sl-muted); padding: 0 0.5rem; }

/* Image */
.sl-image-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.sl-image-wrap img { max-width: 100%; max-height: 60vh; border-radius: 8px; object-fit: contain; }
.sl-image-caption { font-size: 0.8em; color: var(--sl-muted); font-style: italic; text-align: center; }

/* Quote */
.sl-quote { text-align: center; align-items: center; }
.sl-quote blockquote { border: none; margin: 0; padding: 0; background: transparent; font-size: clamp(1.1rem,2.5vw,1.6rem); font-style: italic; color: var(--sl-heading); line-height: 1.5; }
.sl-quote blockquote::before { content: '"'; font-size: 4em; color: var(--sl-primary); line-height: 0.5; vertical-align: -0.4em; opacity: 0.4; }
.sl-quote-author { margin-top: 1.5rem; font-size: 0.9em; color: var(--sl-primary); font-weight: 600; }
.sl-quote-author::before { content: '— '; }

/* Simulation */
.sl-sim-container { flex: 1; overflow: auto; border: 1px solid var(--sl-border); border-radius: 10px; padding: 0.75rem; background: color-mix(in srgb, var(--sl-primary) 4%, var(--sl-slide-bg));
  color: var(--sl-text);
  /* Remapping des variables OEI (style.css) vers les variables du thème slides.
     Permet aux widgets Phase 3B (ConcurrencyWidget, MemoryWidget, DnsWidget, PipelineWidget)
     d'hériter automatiquement du bon thème sans modifier leur CSS. */
  --primary: var(--sl-primary, #818cf8);
  --primary-hover: var(--sl-primary, #818cf8);
  --accent: var(--sl-accent, #f472b6);
  --bg: var(--sl-slide-bg, #1a1d27);
  --card: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 80%, var(--sl-text, #cbd5e1) 20%);
  --surface: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 80%, var(--sl-text, #cbd5e1) 20%);
  --surface2: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 90%, var(--sl-text, #cbd5e1) 10%);
  --surface-hover: color-mix(in srgb, var(--sl-slide-bg, #1a1d27) 70%, var(--sl-text, #cbd5e1) 30%);
  --text: var(--sl-text, #cbd5e1);
  --muted: var(--sl-muted, #64748b);
  --border: var(--sl-border, #2d3347);
  --border-focus: var(--sl-primary, #818cf8);
  --code-bg: var(--sl-code-bg, #0d1117);
  --code-text: var(--sl-code-text, #e2e8f0);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --danger: #ef4444;
  --warning: var(--sl-warning, #fb923c);
  --highlight: var(--sl-success, #4ade80);
  --radius-sm: 4px; --radius: 6px; --radius-md: 8px;
  --tone-cyan-bg: rgba(56,189,248,.22); --tone-cyan-border: rgba(103,232,249,.45); --tone-cyan-text: #bae6fd;
  --tone-success-bg: rgba(74,222,128,.2); --tone-success-text: #86efac;
  --tone-danger-bg: rgba(248,113,113,.22); --tone-danger-text: #fecaca;
  --tone-warning-bg: rgba(251,191,36,.22); --tone-warning-text: #fde68a;
  --tone-blue-bg: rgba(96,165,250,.22); --tone-blue-text: #bfdbfe;
  --tone-violet-bg: rgba(167,139,250,.22); --tone-violet-text: #ddd6fe;
  --tone-indigo-bg: rgba(129,140,248,.22); --tone-indigo-border: rgba(165,180,252,.5); --tone-indigo-text: #c7d2fe;
  --tone-purple-bg: rgba(167,139,250,.22); --tone-purple-border: rgba(196,181,253,.45); --tone-purple-text: #ddd6fe;
}

/* Adaptations event-widgets dans le contexte slides */
.sl-sim-container .event-widget { margin: 0; height: 100%; box-sizing: border-box; overflow: auto; }
.sl-sim-container .event-widget .deleg-building { min-height: 220px; }

/* BSTWidget : remplit le container et délègue le scroll au SVG wrap */
.sl-sim-container .bstw-root { height: 100%; }

/* Static widget fallback (PDF, raster export, student view) */
.sl-widget-static { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 0.5rem; opacity: 0.6; }
.sl-widget-static-icon { font-size: 2.5rem; line-height: 1; }
.sl-widget-static-name { font-size: 0.9rem; font-weight: 600; color: var(--sl-heading); }
.sl-widget-static-desc { font-size: 0.75rem; color: var(--sl-muted); text-align: center; }

/* Progress bar override */
.reveal .progress { height: 3px; background: var(--sl-border); }
.reveal .progress span { background: var(--sl-primary); }
.reveal .slide-number { color: var(--sl-muted); font-size: 0.7em; }

/* Canvas slides — standalone rule (PDF, thumbnails, presenter view) */
section.sl-canvas {
    position: relative;
    width: 1280px; height: 720px;
    padding: 0 !important;
    overflow: hidden !important;
    text-align: left !important;
    box-sizing: border-box;
}
/* Canvas slides — Reveal.js context (don't override position — Reveal needs absolute for slide stacking) */
.reveal section.sl-canvas {
    padding: 0 !important;
    justify-content: flex-start !important;
    overflow: hidden !important;
    text-align: left !important;
}
/* Canvas code terminal block (viewer) */
.sl-code-terminal { width:100%;height:100%;background:#0d1117;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #21262d; }
.sl-code-tbar { background:#161b22;display:flex;align-items:center;padding:0 12px;height:34px;gap:6px;flex-shrink:0;border-bottom:1px solid #21262d; }
.sl-code-dot { width:11px;height:11px;border-radius:50%;flex-shrink:0; }
.sl-code-dot-r{background:#ff5f57}.sl-code-dot-y{background:#febc2e}.sl-code-dot-g{background:#28c840}
.sl-code-tbar-lang { margin-left:auto;font-size:10px;color:#6e7681;font-family:var(--sl-font-mono,monospace);letter-spacing:0.04em; }
.sl-code-scroll { flex:1;overflow:auto;display:flex;min-height:0;position:relative; }
.sl-code-gutter { padding:0.65rem 0.6rem 0.65rem 0.85rem;color:#3d4451;font-size:13px;line-height:1.6;user-select:none;text-align:right;font-family:var(--sl-font-mono,monospace);white-space:pre;border-right:1px solid #21262d;min-width:2.2em;flex-shrink:0; }
.sl-code-scroll pre { flex:1;margin:0;padding:0.65rem 1rem;background:transparent!important;overflow:visible;min-width:0;border:none!important; }
.sl-code-scroll pre code { font-family:var(--sl-font-mono,monospace);font-size:13px;line-height:1.6;color:#e6edf3;background:transparent!important;white-space:pre;display:block;padding:0!important; }
/* Reveal.js highlight plugin: line-number table wrapper */
.sl-code-scroll .hljs-ln { width:100%; }
.sl-code-scroll .hljs-ln td { padding:0 4px; vertical-align:top; }
.sl-code-scroll .hljs-ln-numbers { user-select:none; color:#3d4451; text-align:right; width:2.2em; padding-right:0.6rem; border-right:1px solid #21262d; }
.reveal .sl-code-scroll pre { margin:0!important; }
.reveal .sl-code-scroll table { border-collapse:collapse; }
/* Reveal.js clones <code> as .fragment children of <pre> for each highlight step.
   Fragments use opacity:0/visibility:hidden (still in flow) which causes ghost stacking.
   Fix: overlay fragment codes on top of the first one via absolute positioning. */
.sl-code-scroll pre.code-wrapper { position:relative; }
.sl-code-scroll pre.code-wrapper > code.fragment { position:absolute; top:0; left:0; width:100%; height:100%; background:#0d1117!important; }
.sl-code-scroll .highlight-line { background:rgba(255,255,255,0.1); }

/* Highlight element – terminal-like wrapper that is fully compatible with Reveal.js
   fragment cloning for data-line-numbers step-through animation.
   Unlike sl-code-terminal, this does NOT use flex layout on the code area. */
.sl-highlight-block { width:100%;height:100%;background:#0d1117;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #21262d; }
.sl-highlight-block .sl-code-tbar { border-bottom:1px solid #21262d; }
.sl-highlight-block pre { flex:1;margin:0!important;padding:0!important;background:#0d1117!important;box-shadow:none!important;width:100%!important;border:none!important;position:relative;overflow:hidden; }
.sl-highlight-block pre code { font-family:var(--sl-font-mono,monospace)!important;font-size:13px!important;line-height:1.6!important;color:#e6edf3!important;padding:0.65rem 1rem!important;background:#0d1117!important;max-height:none!important;overflow:visible!important;text-align:left!important; }
.sl-highlight-block pre.code-wrapper > code.fragment { position:absolute;top:0;left:0;width:100%;height:100%;background:#0d1117!important;box-sizing:border-box; }
.sl-highlight-block .hljs-ln { width:100%;border-collapse:collapse; }
.sl-highlight-block .hljs-ln td { padding:0 4px;vertical-align:top; }
.sl-highlight-block .hljs-ln-numbers { user-select:none;color:#6e7681;text-align:right;width:2.2em;padding-right:0.6rem;border-right:1px solid #21262d; }
.sl-highlight-block .highlight-line { background:rgba(255,255,255,0.12); }
.sl-highlight-block .has-highlights tr:not(.highlight-line) { opacity:1; }
.sl-highlight-block .has-highlights .highlight-line .hljs-ln-numbers { color:#8b949e; }
/* Caption & cross-reference */
.sl-caption { position:absolute;top:100%;left:0;right:0;text-align:center;font-size:13px;color:var(--sl-muted,#94a3b8);font-style:italic;line-height:1.3;pointer-events:none;padding:4px 6px 0; }
.sl-caption b { font-style:normal;color:var(--sl-primary,#818cf8); }
.sl-ref { color:var(--sl-primary,#818cf8);border-bottom:1px dotted var(--sl-primary,#818cf8);cursor:default; }

/* Timer buttons (viewer/export) */
.sl-timer-btn { width:36px;height:36px;border-radius:50%;border:2px solid var(--sl-primary,#818cf8);background:transparent;color:var(--sl-primary,#818cf8);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s; }
.sl-timer-btn:hover { background:var(--sl-primary,#818cf8);color:var(--sl-slide-bg,#1a1d27); }
.sl-timer-display.sl-timer-ended { color:#f87171!important;animation:sl-timer-pulse 1s ease-in-out infinite; }
@keyframes sl-timer-pulse { 0%,100%{opacity:1}50%{opacity:0.4} }

/* Quiz — improved rendering */
.sl-quiz { align-items:center; text-align:center; }
.sl-quiz-title { margin-bottom:1.5rem; font-size:1.6em; }
.sl-quiz-question-icon { margin-bottom:0.5rem;opacity:0.55;display:inline-flex;align-items:center;justify-content:center;color:var(--sl-primary,#818cf8); }
.sl-quiz-options { display:flex;flex-direction:column;gap:0.75rem;width:80%;max-width:700px; }
.sl-quiz-options.sl-quiz-tf { flex-direction:row;gap:1.5rem;justify-content:center; }
.sl-quiz-option { display:flex;align-items:center;gap:1rem;padding:0.9rem 1.3rem;border-radius:10px;background:color-mix(in srgb,var(--sl-primary) 8%,var(--sl-slide-bg));border:2px solid color-mix(in srgb,var(--sl-primary) 20%,transparent);font-size:1.1em;color:var(--sl-text);transition:border-color .3s,background .3s,transform .15s;cursor:pointer;user-select:none; }
.sl-quiz-option:hover { border-color:var(--sl-primary);background:color-mix(in srgb,var(--sl-primary) 15%,var(--sl-slide-bg));transform:translateX(4px); }
.sl-quiz-option.sl-quiz-correct { border-color:var(--sl-success,#4ade80)!important;background:color-mix(in srgb,var(--sl-success,#4ade80) 15%,var(--sl-slide-bg))!important; }
.sl-quiz-option.sl-quiz-correct .sl-quiz-marker { background:var(--sl-success,#4ade80); }
.sl-quiz-option.sl-quiz-wrong { border-color:#f87171!important;background:color-mix(in srgb,#f87171 10%,var(--sl-slide-bg))!important;opacity:0.6; }
.sl-quiz-option.sl-quiz-wrong .sl-quiz-marker { background:#f87171; }
.sl-quiz-tf .sl-quiz-option { flex:1;justify-content:center;font-size:1.3em;padding:1.2rem; }
.sl-quiz-marker { display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:50%;background:var(--sl-primary);color:var(--sl-slide-bg);font-weight:700;font-size:0.9em;flex-shrink:0;transition:background .3s; }
.sl-quiz-explanation { margin-top:1.5rem;padding:1rem 1.5rem;border-radius:8px;background:color-mix(in srgb,var(--sl-success) 10%,var(--sl-slide-bg));border-left:4px solid var(--sl-success);color:var(--sl-text);font-size:0.95em;max-width:700px;text-align:left; }
.sl-quiz-open { width:80%;max-width:700px; }
.sl-quiz-open-placeholder { padding:1.5rem;border-radius:10px;font-size:1.1em;border:2px dashed color-mix(in srgb,var(--sl-muted) 40%,transparent);color:var(--sl-muted);text-align:center; }
.sl-quiz-answer-count { margin-top:0.8rem;font-size:0.75em;color:var(--sl-muted);opacity:0.6; }
.sl-codelive-pending textarea { pointer-events:auto; }
.sl-codelive-run:hover { filter:brightness(1.15); }
.sl-codelive-clear:hover { border-color:var(--sl-muted,#64748b); color:var(--sl-text,#cbd5e1); }
.sl-quizlive-option:hover { border-color:var(--sl-primary,#818cf8);background:color-mix(in srgb,var(--sl-primary,#818cf8) 10%,var(--sl-slide-bg,#141620));transform:translateX(4px); }
.sl-quizlive-start:hover { filter:brightness(1.15); }
.sl-quizlive-qr { transition:box-shadow 0.2s; }
.sl-quizlive-qr:hover { box-shadow:0 6px 24px rgba(0,0,0,0.6); }
.sl-quizlive-qr .sl-qr-resize-handle { position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;cursor:nwse-resize;background:var(--sl-primary,#818cf8);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;opacity:0;transition:opacity 0.2s;pointer-events:auto;z-index:5; }
.sl-quizlive-qr:hover .sl-qr-resize-handle { opacity:0.8; }
.sl-picked-inline-icon { display:inline-flex; width:14px; height:14px; vertical-align:middle; margin-right:6px; color:#14b8a6; }
.sl-flip-card { perspective: 1200px; cursor: pointer; }
.sl-flip-card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.48s cubic-bezier(0.2,0.8,0.2,1); transform-style: preserve-3d; }
.sl-flip-card.is-flipped .sl-flip-card-inner { transform: rotateY(180deg); }
.sl-flip-face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    border-radius: 10px;
    border: 1px solid var(--sl-border,#2d3347);
    background: color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);
    color: var(--sl-text,#e2e8f0);
    text-align: center;
    line-height: 1.35;
    backface-visibility: hidden;
    box-sizing: border-box;
}
.sl-flip-back { transform: rotateY(180deg); }
.sl-flip-face-label { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.sl-flip-face-label-myth { color: #fb923c; }
.sl-flip-face-label-reality { color: #34d399; }
.sl-flip-hint { font-size: 0.64rem; color: var(--sl-muted,#64748b); text-align: center; }
`;
    }
}
window.SlidesThemes = SlidesThemes;

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
        // Build caption registry for cross-references
        const captionRegistry = SlidesShared.buildCaptionRegistry(slides);
        // Auto-number chapter slides if enabled
        const chapterNumbers = SlidesRenderer._buildChapterNumbers(slides, data.autoNumberChapters);
        const opts = {
            showSlideNumber: data.showSlideNumber || false,
            footerText: data.footerText || null,
            footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
            metadata: (data && typeof data.metadata === 'object' && data.metadata) ? data.metadata : {},
            totalSlides: slides.length,
            captionRegistry,
            chapterNumbers,
        };
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
        const notes = slide.notes ? `<aside class="notes">${slide.notes}</aside>` : '';
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
        const combinedStyle = `${themeVars ? `${themeVars};` : ''}${bg.style}`;
        const styleAttr = combinedStyle ? ` style="${combinedStyle}"` : '';
        return `<section class="${typeClass}" data-slide-index="${index}"${bg.attrs}${transitionAttr}${styleAttr}>${inner}${overlay}${notes}</section>`;
    }

    static _title(s) {
        const eyebrow = s.eyebrow ? `<div class="sl-title-eyebrow">${SlidesRenderer.esc(s.eyebrow)}</div>` : '';
        const subtitle = s.subtitle ? `<p class="sl-title-sub">${s.subtitle}</p>` : '';
        const meta = (s.author || s.date)
            ? `<div class="sl-title-meta">${s.author ? `<span>${SlidesRenderer.esc(s.author)}</span>` : ''}${s.date ? `<span>${SlidesRenderer.esc(s.date)}</span>` : ''}</div>`
            : '';
        return `${eyebrow}<h1>${s.title || 'Sans titre'}</h1>${subtitle}${meta}`;
    }

    static _chapter(s, opts = {}, index = 0) {
        // Auto-number overrides manual number if chapterNumbers map is available
        const autoNum = opts.chapterNumbers?.get(index);
        const numVal = autoNum || s.number;
        const num = numVal ? `<div class="sl-chapter-num">${SlidesRenderer.esc(String(numVal))}</div>` : '';
        const sub = s.subtitle ? `<p class="sl-chapter-sub">${SlidesRenderer.esc(s.subtitle)}</p>` : '';
        return `${num}<h2>${SlidesRenderer.esc(s.title || 'Chapitre')}</h2>${sub}`;
    }

    static _bullets(s) {
        const items = (s.items || []).map(item => {
            if (typeof item === 'string') {
                return `<li class="fragment">${item}</li>`;
            }
            const subs = (item.sub || []).map(sub => `<li class="fragment">${sub}</li>`).join('');
            return `<li class="fragment">${item.text || item}${subs ? `<ul>${subs}</ul>` : ''}</li>`;
        }).join('');
        const listHtml = `<ul>${items}</ul>`;
        const note = s.note ? `<div class="sl-bullets-note"><strong>Note</strong><br>${s.note}</div>` : '';
        const layout = note
            ? `<div class="sl-bullets-layout"><div class="sl-bullets-list">${listHtml}</div>${note}</div>`
            : listHtml;
        return `<h2>${SlidesRenderer.esc(s.title || '')}</h2>${layout}`;
    }

    static _code(s) {
        const lang    = SlidesRenderer.esc(s.language || 'text');
        const rawCode = s.code || '';
        const gutter  = rawCode.split('\n').map((_, i) => i + 1).join('\n');
        const code    = SlidesRenderer.esc(rawCode);
        const terminal = `<div class="sl-code-terminal" style="flex:1;height:auto;min-height:0;">
            <div class="sl-code-tbar">
                <div class="sl-code-dot sl-code-dot-r"></div>
                <div class="sl-code-dot sl-code-dot-y"></div>
                <div class="sl-code-dot sl-code-dot-g"></div>
                <span class="sl-code-tbar-lang">${lang}</span>
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
                const items = (col.items || []).map(i => `<li class="fragment">${i}</li>`).join('');
                content = `<ul>${items}</ul>`;
            } else {
                // text type: accept col.text (string) or col.items (array, join as paragraphs)
                const txt = col.text || (Array.isArray(col.items) ? col.items.join('</p><p>') : '');
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
        const term = s.term ? `<div class="sl-def-term">${SlidesRenderer.esc(s.term)}</div>` : '';
        const body = s.definition ? `<div class="sl-def-body">${s.definition}</div>` : '';
        const example = s.example ? `<div class="sl-def-example"><strong>Exemple :</strong> ${s.example}</div>` : '';
        return `${title}<div class="sl-def-box">${term}${body}${example}</div>`;
    }

    static _comparison(s) {
        const title = s.title ? `<h2>${SlidesRenderer.esc(s.title)}</h2>` : '';
        const renderCol = (col) => {
            if (!col) return '';
            const items = (col.items || []).map(i => `<li class="fragment">${i}</li>`).join('');
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
            if (!reg) { slot.textContent = `Widget inconnu : ${widgetId}`; continue; }
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
                    slot.textContent = `Widget non disponible : ${widgetId}`;
                    continue;
                }
                const config = JSON.parse(slot.dataset.config || '{}');
                cls.mount(slot, Object.assign({}, config, { type: widgetId }));
                slot.dataset.mounted = '1';
            } catch(e) {
                slot.textContent = `Erreur chargement widget: ${e.message}`;
            }
        }
    }

    /**
     * Mount special elements (LaTeX, Mermaid, Timer, Quiz) that require JS libraries or interaction.
     * Call after Reveal.initialize() and on slidechanged events.
     * Works in viewer.html, exported HTML, and presenter preview.
     */
    static async mountSpecialElements(container) {
        const mode = (() => {
            try { return new URLSearchParams(window.location.search || '').get('mode') || ''; }
            catch (_) { return ''; }
        })();
        const fallbackAudienceReadOnly = mode === 'audience' || document.documentElement?.dataset?.oeiSlidesRole === 'audience';
        const audiencePolicy = (() => {
            const existing = window.OEIAudienceModePolicy;
            if (existing && typeof existing === 'object') return existing;
            const resolver = window.OEINetworkSession?.resolveAudiencePolicy;
            if (typeof resolver === 'function') {
                try {
                    return resolver(new URLSearchParams(window.location.search || ''), {
                        defaultMode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                        forceReadOnly: fallbackAudienceReadOnly ? true : null,
                    });
                } catch (_) {}
            }
            return {
                mode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                readOnly: fallbackAudienceReadOnly,
                allowAudienceActions: !fallbackAudienceReadOnly,
            };
        })();
        window.OEIAudienceModePolicy = audiencePolicy;
        const isAudienceReadOnly = !!audiencePolicy?.readOnly || fallbackAudienceReadOnly;
        const presenterSyncBridge = (mode === 'presenter' && window.OEIPresenterSyncBridge && typeof window.OEIPresenterSyncBridge.post === 'function')
            ? window.OEIPresenterSyncBridge
            : null;
        const audienceElementStore = (() => {
            const current = window.OEIAudienceElementState;
            if (current && typeof current === 'object') return current;
            const next = {};
            window.OEIAudienceElementState = next;
            return next;
        })();
        const toTrimmed = (value, maxLen = 120) => {
            if (typeof value !== 'string') return '';
            const out = value.trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        };
        const toInt = value => {
            const n = Number(value);
            return Number.isFinite(n) ? Math.trunc(n) : null;
        };
        const resolveSyncMeta = host => {
            const section = host?.closest?.('section[data-slide-index]');
            const owner = host?.closest?.('[data-element-id]');
            const slideIndex = toInt(section?.dataset?.slideIndex);
            const elementId = toTrimmed(owner?.dataset?.elementId || '', 160);
            return { slideIndex, elementId };
        };
        const elementStateKey = (elementType, slideIndex, elementId = '') => {
            const safeType = toTrimmed(String(elementType || ''), 80);
            const safeSlide = toInt(slideIndex);
            const safeId = toTrimmed(String(elementId || ''), 160);
            if (!safeType || safeSlide === null || safeSlide < 0) return '';
            return `${safeType}::${safeSlide}::${safeId}`;
        };
        const emitAudienceElementState = (host, elementType, state = {}) => {
            if (!presenterSyncBridge?.post || !presenterSyncBridge?.SYNC_MSG?.ELEMENT_STATE) return false;
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return false;
            const payloadState = (state && typeof state === 'object') ? state : {};
            return presenterSyncBridge.post({
                type: presenterSyncBridge.SYNC_MSG.ELEMENT_STATE,
                elementType: toTrimmed(String(elementType || ''), 80),
                slideIndex,
                elementId,
                state: payloadState,
            });
        };
        const subscribeAudienceElementState = (host, elementType, apply) => {
            if (!isAudienceReadOnly || typeof apply !== 'function') return () => {};
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return () => {};
            const safeType = toTrimmed(String(elementType || ''), 80);
            if (!safeType) return () => {};
            const exactKey = elementStateKey(safeType, slideIndex, elementId);
            const fallbackKey = elementStateKey(safeType, slideIndex, '');
            const bootstrap = exactKey
                ? audienceElementStore[exactKey]
                : (fallbackKey ? audienceElementStore[fallbackKey] : null);
            if (bootstrap && typeof bootstrap === 'object') {
                try { apply(bootstrap); } catch (_) {}
            }
            const onState = ev => {
                const detail = ev?.detail || {};
                if (toTrimmed(String(detail.elementType || ''), 80) !== safeType) return;
                const msgSlide = toInt(detail.slideIndex);
                if (msgSlide !== slideIndex) return;
                const msgElementId = toTrimmed(String(detail.elementId || ''), 160);
                if (elementId && msgElementId && msgElementId !== elementId) return;
                try {
                    apply((detail.state && typeof detail.state === 'object') ? detail.state : {});
                } catch (_) {}
            };
            window.addEventListener('oei:audience-element-state', onState);
            return () => window.removeEventListener('oei:audience-element-state', onState);
        };
        const disableInteractiveControls = root => {
            if (!root || typeof root.querySelectorAll !== 'function') return;
            root.querySelectorAll('button,input,select,textarea').forEach(ctrl => {
                try {
                    ctrl.disabled = true;
                    ctrl.style.pointerEvents = 'none';
                } catch (_) {}
            });
            root.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
        };

        // ── LaTeX (KaTeX) ──
        const latexEls = container.querySelectorAll('.sl-latex-pending');
        if (latexEls.length) {
            if (!window._slKatexLoaded) {
                window._slKatexLoaded = true;
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '../vendor/katex/0.16.11/katex.min.css';
                document.head.appendChild(link);
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '../vendor/katex/0.16.11/katex.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            if (window.katex) {
                latexEls.forEach(el => {
                    const target = el.querySelector('.sl-latex-render');
                    if (!target || target.dataset.rendered) return;
                    const expr = el.dataset.latex || '';
                    try {
                        target.innerHTML = window.katex.renderToString(expr, { displayMode: true, throwOnError: false });
                        target.dataset.rendered = '1';
                    } catch (e) {
                        target.innerHTML = `<span style="color:#f87171">${SlidesRenderer.esc(expr)}</span>`;
                    }
                });
            }
        }

        // ── Mermaid ──
        const mermaidEls = container.querySelectorAll('.sl-mermaid-pending');
        if (mermaidEls.length) {
            if (!window._slMermaidLoaded) {
                window._slMermaidLoaded = true;
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '../vendor/mermaid/10.9.1/mermaid.min.js';
                    s.onload = () => {
                        window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                        resolve();
                    };
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            if (window.mermaid) {
                for (const el of mermaidEls) {
                    const target = el.querySelector('.sl-mermaid-render');
                    const src = el.querySelector('pre');
                    if (!target || !src || target.dataset.rendered) continue;
                    try {
                        const id = 'sl-mm-' + Math.random().toString(36).slice(2, 9);
                        const { svg } = await window.mermaid.render(id, src.textContent);
                        target.innerHTML = svg;
                        // Scale SVG to fit container
                        const svgEl = target.querySelector('svg');
                        if (svgEl) {
                            svgEl.style.maxWidth = '100%';
                            svgEl.style.maxHeight = '100%';
                            svgEl.style.height = 'auto';
                        }
                        target.dataset.rendered = '1';
                    } catch (e) {
                        target.innerHTML = `<pre style="color:#f87171;font-size:12px;">${SlidesRenderer.esc(e.message || 'Erreur Mermaid')}</pre>`;
                    }
                }
            }
        }

        // ── Timer (interactive countdown) ──
        container.querySelectorAll('.sl-timer-content').forEach(el => {
            if (el.dataset.timerBound) return;
            el.dataset.timerBound = '1';
            const dur = parseInt(el.dataset.duration) || 300;
            let remaining = dur, interval = null, running = false;
            const display = el.querySelector('.sl-timer-display');
            const btnStart = el.querySelector('.sl-timer-start');
            const btnPause = el.querySelector('.sl-timer-pause');
            const btnReset = el.querySelector('.sl-timer-reset');
            if (!display || !btnStart) return;
            const fmt = (s) => {
                const m = String(Math.floor(s / 60)).padStart(2, '0');
                const ss = String(s % 60).padStart(2, '0');
                return `${m}:${ss}`;
            };
            const publishTimerState = (extraState = {}) => emitAudienceElementState(el, 'timer', Object.assign({
                remaining,
                running: !!running,
                ended: remaining <= 0,
                startVisible: !running,
                pauseVisible: !!running,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                btnStart.disabled = true;
                btnStart.style.pointerEvents = 'none';
                if (btnPause) { btnPause.disabled = true; btnPause.style.pointerEvents = 'none'; }
                if (btnReset) { btnReset.disabled = true; btnReset.style.pointerEvents = 'none'; }
                subscribeAudienceElementState(el, 'timer', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextRemaining = Number(sync.remaining);
                    if (Number.isFinite(nextRemaining)) {
                        remaining = Math.max(0, Math.trunc(nextRemaining));
                    }
                    running = !!sync.running;
                    display.textContent = fmt(remaining);
                    if (sync.ended === true || remaining <= 0) display.classList.add('sl-timer-ended');
                    else display.classList.remove('sl-timer-ended');
                    if (typeof sync.startVisible === 'boolean') btnStart.style.display = sync.startVisible ? '' : 'none';
                    if (btnPause && typeof sync.pauseVisible === 'boolean') btnPause.style.display = sync.pauseVisible ? '' : 'none';
                });
                display.textContent = fmt(remaining);
                return;
            }
            const tick = () => {
                remaining = Math.max(0, remaining - 1);
                display.textContent = fmt(remaining);
                publishTimerState();
                if (remaining <= 0) {
                    clearInterval(interval); running = false;
                    btnStart.style.display = ''; btnPause.style.display = 'none';
                    display.classList.add('sl-timer-ended');
                    publishTimerState({ ended: true, running: false });
                }
            };
            btnStart.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!running && remaining > 0) {
                    running = true; display.classList.remove('sl-timer-ended');
                    interval = setInterval(tick, 1000);
                    btnStart.style.display = 'none'; btnPause.style.display = '';
                    publishTimerState({ running: true });
                }
            });
            btnPause.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                clearInterval(interval); running = false;
                btnStart.style.display = ''; btnPause.style.display = 'none';
                publishTimerState({ running: false });
            });
            btnReset.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                clearInterval(interval); running = false;
                remaining = dur; display.textContent = fmt(dur);
                display.classList.remove('sl-timer-ended');
                btnStart.style.display = ''; btnPause.style.display = 'none';
                publishTimerState({ running: false, ended: false });
            });
            publishTimerState({ running: false, ended: false });
        });

        // ── Quiz interaction (click to reveal answer) ──
        container.querySelectorAll('.sl-quiz-options[data-answer]').forEach(optionsEl => {
            if (optionsEl.dataset.quizBound) return;
            optionsEl.dataset.quizBound = '1';
            const correctIdx = optionsEl.dataset.answer;
            if (correctIdx === '') return; // no answer defined
            const options = optionsEl.querySelectorAll('.sl-quiz-option');
            const applyQuizRevealState = state => {
                const sync = (state && typeof state === 'object') ? state : {};
                if (sync.answered !== true) return;
                optionsEl.dataset.quizAnswered = '1';
                options.forEach(o => {
                    if (o.dataset.idx === correctIdx) o.classList.add('sl-quiz-correct');
                    else o.classList.add('sl-quiz-wrong');
                });
                const section = optionsEl.closest('section');
                if (section) {
                    const expl = section.querySelector('.sl-quiz-explanation');
                    if (expl) { expl.style.display = ''; expl.classList.add('visible'); expl.style.opacity = '1'; }
                }
            };
            if (isAudienceReadOnly) {
                options.forEach(opt => { opt.style.pointerEvents = 'none'; opt.style.cursor = 'default'; });
                subscribeAudienceElementState(optionsEl, 'quiz-reveal', applyQuizRevealState);
                return;
            }
            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (optionsEl.dataset.quizAnswered) return;
                    optionsEl.dataset.quizAnswered = '1';
                    const idx = opt.dataset.idx;
                    applyQuizRevealState({ answered: true });
                    emitAudienceElementState(optionsEl, 'quiz-reveal', {
                        answered: true,
                        selectedIdx: idx,
                        correctIdx,
                    });
                });
            });
        });

        // ── Code Live (in-browser code execution) ──
        container.querySelectorAll('.sl-codelive-pending').forEach(el => {
            if (el.dataset.codeliveBound) return;
            el.dataset.codeliveBound = '1';
            const lang = el.dataset.language || 'python';
            const codeArea = el.querySelector('.sl-codelive-code');
            const consoleEl = el.querySelector('.sl-codelive-console');
            const btnRun = el.querySelector('.sl-codelive-run');
            const btnClear = el.querySelector('.sl-codelive-clear');
            if (!codeArea || !consoleEl || !btnRun) return;
            if (isAudienceReadOnly) {
                codeArea.readOnly = true;
                codeArea.style.pointerEvents = 'none';
                btnRun.disabled = true;
                btnRun.style.pointerEvents = 'none';
                if (btnClear) {
                    btnClear.disabled = true;
                    btnClear.style.pointerEvents = 'none';
                }
                const note = document.createElement('div');
                note.style.cssText = 'font-size:0.68rem;color:var(--sl-muted,#64748b);padding:6px 10px;border-top:1px solid var(--sl-border,#2d3347);';
                note.textContent = 'Exécution réservée au présentateur';
                consoleEl.parentElement?.appendChild(note);
                return;
            }

            // Tab key support in textarea
            codeArea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = codeArea.selectionStart, end = codeArea.selectionEnd;
                    codeArea.value = codeArea.value.substring(0, s) + '    ' + codeArea.value.substring(end);
                    codeArea.selectionStart = codeArea.selectionEnd = s + 4;
                }
            });

            const appendOutput = (text, color) => {
                const span = document.createElement('span');
                span.style.color = color || 'inherit';
                span.textContent = text;
                consoleEl.appendChild(span);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            };

            const runJS = async (code) => {
                consoleEl.textContent = '';
                if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || !URL?.createObjectURL) {
                    appendOutput('❌ Sandbox JavaScript indisponible dans ce navigateur\n', '#f87171');
                    return;
                }
                const workerSource = [
                    'const _s=(v)=>{if(typeof v==="string") return v; try{return JSON.stringify(v);}catch(_){return String(v);}};',
                    'const _logs=[];',
                    'const _push=(type,args)=>{_logs.push({type,text:Array.from(args||[]).map(_s).join(" ")});};',
                    'console.log=(...a)=>_push("log",a);',
                    'console.warn=(...a)=>_push("warn",a);',
                    'console.error=(...a)=>_push("error",a);',
                    'self.onmessage=async(ev)=>{',
                    '  const code=String(ev?.data?.code||"");',
                    '  try {',
                    '    let result=(0,eval)(code);',
                    '    if (result && typeof result.then==="function") result=await result;',
                    '    self.postMessage({ok:true,logs:_logs,result:result===undefined?"__oei_undefined__":_s(result)});',
                    '  } catch (err) {',
                    '    self.postMessage({ok:false,logs:_logs,error:err?.message||String(err)});',
                    '  }',
                    '};'
                ].join('\n');
                const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
                const worker = new Worker(workerUrl);
                let settled = false;
                const closeWorker = () => {
                    if (settled) return;
                    settled = true;
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                };
                const timeout = setTimeout(() => {
                    closeWorker();
                    appendOutput('❌ Exécution interrompue (timeout)\n', '#f87171');
                }, 2500);
                const colorForType = (type) => {
                    if (type === 'error') return '#f87171';
                    if (type === 'warn') return '#fbbf24';
                    return 'var(--sl-text,#cbd5e1)';
                };
                worker.onmessage = (event) => {
                    clearTimeout(timeout);
                    const payload = event?.data || {};
                    const logs = Array.isArray(payload.logs) ? payload.logs : [];
                    logs.forEach(log => appendOutput(`${String(log.text || '')}\n`, colorForType(log.type)));
                    if (payload.ok) {
                        if (payload.result !== '__oei_undefined__') appendOutput(`→ ${String(payload.result)}\n`, '#a5b4fc');
                    } else {
                        appendOutput(`❌ ${String(payload.error || 'Erreur JavaScript')}\n`, '#f87171');
                    }
                    closeWorker();
                };
                worker.onerror = (event) => {
                    clearTimeout(timeout);
                    closeWorker();
                    appendOutput(`❌ Sandbox JavaScript: ${String(event?.message || 'Erreur worker')}\n`, '#f87171');
                };
                worker.postMessage({ code: String(code || '') });
            };

            const runPython = async (code) => {
                consoleEl.textContent = '';
                appendOutput('⏳ Chargement de Python…\n', 'var(--sl-muted)');
                if (!window._slPyodideLoaded) {
                    window._slPyodideLoaded = true;
                    try {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                            s.onload = resolve; s.onerror = reject;
                            document.head.appendChild(s);
                        });
                        window._slPyodide = await loadPyodide();
                    } catch(e) {
                        appendOutput('❌ Impossible de charger Python: ' + e.message + '\n', '#f87171');
                        return;
                    }
                }
                // Wait for ongoing load
                while (!window._slPyodide && window._slPyodideLoaded) {
                    await new Promise(r => setTimeout(r, 200));
                }
                if (!window._slPyodide) return;
                consoleEl.textContent = '';
                try {
                    window._slPyodide.setStdout({ batched: (text) => appendOutput(text + '\n', 'var(--sl-text,#cbd5e1)') });
                    window._slPyodide.setStderr({ batched: (text) => appendOutput(text + '\n', '#f87171') });
                    const result = await window._slPyodide.runPythonAsync(code);
                    if (result !== undefined && result !== null) appendOutput('→ ' + String(result) + '\n', '#a5b4fc');
                } catch(err) {
                    appendOutput('❌ ' + (err.message || String(err)) + '\n', '#f87171');
                }
            };

            btnRun.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                const code = codeArea.value;
                if (lang === 'javascript' || lang === 'js') runJS(code);
                else runPython(code);
            });

            btnClear?.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                consoleEl.textContent = '';
            });

            // Auto-run if configured
            if (el.dataset.autorun === '1') {
                setTimeout(() => btnRun.click(), 500);
            }
        });

        // ── Quiz Live (interactive P2P quiz with PeerJS) ──
        container.querySelectorAll('.sl-quizlive-pending').forEach(el => {
            if (el.dataset.quizliveBound) return;
            el.dataset.quizliveBound = '1';
            const roomId = el.dataset.room || 'ql-' + Math.random().toString(36).slice(2, 9);
            const correctAnswer = parseInt(el.dataset.answer) || 0;
            const duration = parseInt(el.dataset.duration) || 30;
            const btnStart = el.querySelector('.sl-quizlive-start');
            const timerEl = el.querySelector('.sl-quizlive-timer');
            const statusEl = el.querySelector('.sl-quizlive-status');
            const resultsEl = el.querySelector('.sl-quizlive-results');
            const qrEl = el.querySelector('.sl-quizlive-qr');
            const optionsEls = el.querySelectorAll('.sl-quizlive-option');
            if (!btnStart) return;

            let peer = null, connections = [], responses = {}, timerInterval = null, remaining = duration, quizActive = false;
            const optLabels = Array.from(optionsEls).map(o => o.textContent.trim().slice(1).trim());
            const nOpts = optionsEls.length;
            const questionText = el.querySelector('.sl-quizlive-question')?.textContent || '';
            const computeCounts = () => {
                const counts = Array(nOpts).fill(0);
                const total = Object.keys(responses).length;
                Object.values(responses).forEach(r => { if (r >= 0 && r < nOpts) counts[r]++; });
                return { counts, total };
            };
            const publishQuizState = (extraState = {}) => {
                emitAudienceElementState(el, 'quiz-live', Object.assign({
                    active: !!quizActive,
                    question: questionText,
                    options: optLabels.slice(),
                    correctAnswer,
                    duration,
                    remaining: Math.max(0, Number(remaining) || 0),
                    counts: computeCounts().counts,
                    totalResponses: computeCounts().total,
                    statusText: String(statusEl?.textContent || ''),
                }, (extraState && typeof extraState === 'object') ? extraState : {}));
            };

            if (isAudienceReadOnly) {
                btnStart.disabled = true;
                btnStart.textContent = 'Piloté';
                btnStart.style.pointerEvents = 'none';
                optionsEls.forEach(opt => {
                    opt.style.pointerEvents = 'none';
                    opt.style.cursor = 'default';
                });
                if (qrEl) qrEl.style.display = 'none';
                if (statusEl) statusEl.textContent = 'Piloté par le présentateur';
                const renderAudienceQuiz = state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const labels = Array.isArray(sync.options) && sync.options.length ? sync.options : optLabels;
                    const counts = Array.isArray(sync.counts) ? sync.counts.map(v => Number(v) || 0) : labels.map(() => 0);
                    const total = Math.max(0, Number(sync.totalResponses) || counts.reduce((a, b) => a + b, 0));
                    const currentRemaining = Math.max(0, Number(sync.remaining) || 0);
                    const active = sync.active === true;
                    const resolvedCorrect = Number.isFinite(Number(sync.correctAnswer)) ? Number(sync.correctAnswer) : correctAnswer;
                    if (timerEl) timerEl.textContent = `${currentRemaining}s`;
                    if (statusEl) {
                        statusEl.textContent = toTrimmed(String(sync.statusText || ''), 220)
                            || (active ? `${total} réponse(s) — ${currentRemaining}s restantes` : 'Piloté par le présentateur');
                    }
                    if (!resultsEl) return;
                    const shouldShow = active || total > 0 || sync.ended === true;
                    resultsEl.style.display = shouldShow ? '' : 'none';
                    if (!shouldShow) return;
                    const maxCount = Math.max(1, ...counts);
                    let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                    counts.forEach((count, i) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isCorrect = i === resolvedCorrect;
                        const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                        html += `<div style="display:flex;align-items:center;gap:8px;">
                            <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                            <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                                <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${count})</span>
                            </div>
                        </div>`;
                    });
                    html += `</div>`;
                    resultsEl.innerHTML = html;
                };
                subscribeAudienceElementState(el, 'quiz-live', renderAudienceQuiz);
                return;
            }

            const updateResults = () => {
                const { counts, total } = computeCounts();
                const maxCount = Math.max(1, ...counts);
                let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                counts.forEach((c, i) => {
                    const pct = total > 0 ? Math.round(c / total * 100) : 0;
                    const isCorrect = i === correctAnswer;
                    const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                    html += `<div style="display:flex;align-items:center;gap:8px;">
                        <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                        <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                            <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${c})</span>
                        </div>
                    </div>`;
                });
                html += `</div>`;
                resultsEl.innerHTML = html;
                publishQuizState();
            };

            const startQuiz = async () => {
                if (quizActive) return;

                // ── If a global student room is active, use it ──────────────
                if (window._studentRoom?.active && window._studentRoomBroadcast) {
                    quizActive = true;
                    btnStart.disabled = true;
                    btnStart.textContent = '⏳';
                    statusEl.textContent = 'Diffusion via la salle étudiants…';
                    responses = {};

                    window._activeQuizHandler = (peerId, value) => {
                        if (!quizActive) return;
                        responses[peerId] = value;
                        window._lastQuizResponses = responses;
                        window._lastQuizOptions = optLabels;
                        updateResults();
                        const nStudents = Object.keys(window._studentRoom.students).length;
                        statusEl.textContent = `${Object.keys(responses).length}/${nStudents} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                    };

                    window._studentRoomBroadcast({
                        type: 'quiz:question',
                        quizId: roomId,
                        question: questionText,
                        options: optLabels,
                        duration: duration,
                    });

                    resultsEl.style.display = '';
                    updateResults();
                    remaining = duration;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                    btnStart.textContent = '⏹ Arrêter';
                    btnStart.disabled = false;
                    publishQuizState();

                    timerInterval = setInterval(() => {
                        remaining--;
                        timerEl.textContent = remaining + 's';
                        statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                        if (remaining <= 0) endQuiz();
                    }, 1000);

                    btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
                    return;
                }
                // ── Fallback: dedicated peer (original behaviour) ───────────

                quizActive = true;
                btnStart.disabled = true;
                btnStart.textContent = '⏳';
                statusEl.textContent = 'Connexion P2P en cours…';

                // Load PeerJS
                if (!window._slPeerLoaded) {
                    window._slPeerLoaded = true;
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = '../vendor/peerjs/1.5.5/peerjs.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }

                try {
                    peer = new Peer(roomId, { debug: 0 });
                    await new Promise((resolve, reject) => {
                        peer.on('open', resolve);
                        peer.on('error', (e) => {
                            // If ID taken, try with suffix
                            if (e.type === 'unavailable-id') {
                                const altId = roomId + '-' + Date.now().toString(36).slice(-4);
                                peer = new Peer(altId, { debug: 0 });
                                peer.on('open', resolve);
                                peer.on('error', reject);
                            } else reject(e);
                        });
                        setTimeout(() => reject(new Error('Timeout PeerJS')), 10000);
                    });
                } catch(e) {
                    statusEl.textContent = '❌ Erreur: ' + (e.message || e);
                    btnStart.textContent = 'Réessayer';
                    btnStart.disabled = false;
                    quizActive = false;
                    publishQuizState({ active: false, ended: true });
                    return;
                }

                const quizUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'quiz-student.html?room=' + encodeURIComponent(peer.id);

                // Show QR code
                qrEl.style.display = '';
                qrEl.innerHTML = `<img src="${SlidesRenderer._buildQrSrc(quizUrl, 200)}" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"><div class="sl-qr-resize-handle">⇲</div>`;
                SlidesRenderer._makeQrInteractive(qrEl);

                // Handle connections
                peer.on('connection', (conn) => {
                    connections.push(conn);
                    conn.on('data', (data) => {
                        if (data && data.type === 'answer' && quizActive) {
                            responses[conn.peer] = data.value;
                            updateResults();
                            statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                            publishQuizState();
                        }
                    });
                    conn.on('open', () => {
                        conn.send({ type: 'quiz', question: el.querySelector('.sl-quizlive-question')?.textContent || '', options: optLabels, duration: remaining, roomId: peer.id });
                    });
                });

                // Show results area
                resultsEl.style.display = '';
                updateResults();

                // Start timer
                remaining = duration;
                timerEl.textContent = remaining + 's';
                statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                btnStart.textContent = '⏹ Arrêter';
                btnStart.disabled = false;
                publishQuizState();

                timerInterval = setInterval(() => {
                    remaining--;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                    publishQuizState();
                    if (remaining <= 0) {
                        endQuiz();
                    }
                }, 1000);

                // Toggle stop
                btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
            };

            const endQuiz = () => {
                quizActive = false;
                clearInterval(timerInterval);
                // Notify students via room (if active) or direct connections
                if (window._studentRoom?.active && window._studentRoomBroadcast) {
                    window._studentRoomBroadcast({ type: 'quiz:end', quizId: roomId, correctAnswer });
                    window._activeQuizHandler = null;
                    window._lastQuizResponses = null;
                    window._lastQuizOptions = null;
                } else {
                    connections.forEach(c => { try { c.send({ type: 'end' }); } catch(e) {} });
                }
                // Highlight correct answer
                optionsEls.forEach((o, i) => {
                    if (i === correctAnswer) {
                        o.style.borderColor = '#34d399';
                        o.style.background = 'color-mix(in srgb, #34d399 15%, var(--sl-slide-bg,#141620))';
                    }
                });
                statusEl.textContent = `Terminé — ${Object.keys(responses).length} réponse(s)`;
                btnStart.textContent = 'Relancer';
                btnStart.disabled = false;
                publishQuizState({ active: false, ended: true });
                btnStart.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    responses = {};
                    connections = [];
                    window._activeQuizHandler = null;
                    if (peer) { peer.destroy(); peer = null; }
                    optionsEls.forEach(o => { o.style.borderColor = ''; o.style.background = ''; });
                    resultsEl.style.display = 'none';
                    qrEl.style.display = 'none';
                    btnStart.textContent = 'Lancer';
                    btnStart.onclick = (e2) => { e2.stopPropagation(); e2.preventDefault(); startQuiz(); };
                    statusEl.textContent = 'Cliquez sur « Lancer » pour démarrer le quiz';
                    publishQuizState({ active: false, ended: false, counts: [], totalResponses: 0 });
                };
                updateResults();
                // Close peer after a delay
                setTimeout(() => { if (peer && !quizActive) { peer.destroy(); peer = null; } }, 5000);
            };

            publishQuizState({ active: false, ended: false });
            btnStart.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); startQuiz(); });
        });

        const parseDataJson = (raw, fallback) => {
            try { return JSON.parse(raw || 'null') ?? fallback; } catch (_) { return fallback; }
        };

        container.querySelectorAll('.sl-cloze-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const sentence = String(el.dataset.sentence || '');
            const safeSentence = SlidesRenderer.esc(sentence);
            const blanks = parseDataJson(el.dataset.blanks, []);
            const body = el.querySelector('.sl-cloze-body');
            const btn = el.querySelector('.sl-cloze-toggle');
            if (!body || !btn) return;
            let shown = false;
            const publishClozeState = (extraState = {}) => emitAudienceElementState(el, 'cloze', Object.assign({
                shown: !!shown,
                buttonLabel: String(btn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const render = () => {
                let i = 0;
                body.innerHTML = safeSentence.replace(/____/g, () => {
                    const ans = SlidesRenderer.esc(blanks[i++] || '...');
                    return shown
                        ? `<span style="padding:0 6px;border-bottom:2px solid #22c55e;color:#22c55e;font-weight:700;">${ans}</span>`
                        : `<span style="padding:0 12px;border-bottom:2px dashed var(--sl-primary,#818cf8);color:transparent;">___</span>`;
                });
                btn.textContent = shown ? 'Masquer les réponses' : 'Afficher les réponses';
            };
            if (isAudienceReadOnly) {
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.textContent = 'Piloté';
                subscribeAudienceElementState(el, 'cloze', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    shown = sync.shown === true;
                    render();
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    if (typeof sync.buttonLabel === 'string' && sync.buttonLabel.trim()) btn.textContent = sync.buttonLabel;
                });
                render();
                return;
            }
            btn.addEventListener('click', e => {
                e.preventDefault();
                shown = !shown;
                render();
                publishClozeState();
            });
            render();
            publishClozeState();
        });

        container.querySelectorAll('.sl-dnd-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const items = parseDataJson(el.dataset.items, []);
            const targets = parseDataJson(el.dataset.targets, []);
            const itemsHost = el.querySelector('.sl-dnd-items');
            const targetsHost = el.querySelector('.sl-dnd-targets');
            if (!itemsHost || !targetsHost) return;
            const cards = Array.isArray(items) ? items : [];
            const cols = (Array.isArray(targets) && targets.length ? targets : ['Zone A', 'Zone B']).slice(0, 4);

            itemsHost.innerHTML = cards.map((label, i) => `<button class="sl-dnd-item" data-i="${i}" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:grab;" draggable="true">${SlidesRenderer.esc(label)}</button>`).join('');
            targetsHost.innerHTML = cols.map((c, i) => `<div class="sl-dnd-target" data-t="${i}" style="flex:1;min-width:0;border:1px dashed var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;"><div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;">${SlidesRenderer.esc(c)}</div></div>`).join('');
            const syncDndState = () => emitAudienceElementState(el, 'drag-drop', {
                itemsHtml: itemsHost.innerHTML,
                targetsHtml: targetsHost.innerHTML,
            });
            if (isAudienceReadOnly) {
                itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                const title = el.querySelector('div');
                if (title && title.textContent) title.textContent = `${title.textContent} (piloté par le présentateur)`;
                subscribeAudienceElementState(el, 'drag-drop', state => {
                    if (!state || typeof state !== 'object') return;
                    if (typeof state.itemsHtml === 'string') itemsHost.innerHTML = state.itemsHtml;
                    if (typeof state.targetsHtml === 'string') targetsHost.innerHTML = state.targetsHtml;
                    itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                    targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            syncDndState();
            let dragHtml = '';
            itemsHost.querySelectorAll('.sl-dnd-item').forEach(btn => {
                btn.addEventListener('dragstart', e => {
                    dragHtml = btn.outerHTML;
                    e.dataTransfer?.setData('text/plain', btn.dataset.i || '');
                });
            });
            targetsHost.querySelectorAll('.sl-dnd-target').forEach(zone => {
                zone.addEventListener('dragover', e => e.preventDefault());
                zone.addEventListener('drop', e => {
                    e.preventDefault();
                    if (!dragHtml) return;
                    const marker = document.createElement('div');
                    marker.innerHTML = dragHtml;
                    const card = marker.firstElementChild;
                    if (!card) return;
                    card.setAttribute('draggable', 'false');
                    card.style.cursor = 'default';
                    zone.appendChild(card);
                    syncDndState();
                });
            });
        });

        container.querySelectorAll('.sl-mcqmulti-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answers = new Set(parseDataJson(el.dataset.answers, []).map(v => Number(v)));
            const host = el.querySelector('.sl-mcqmulti-options');
            const checkBtn = el.querySelector('.sl-mcqmulti-check');
            const endBtn = el.querySelector('.sl-mcqmulti-end');
            const result = el.querySelector('.sl-mcqmulti-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqMultiState = (extraState = {}) => emitAudienceElementState(el, 'mcq-multi', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-multi', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:5px;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-multi'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const totalSelections = Number(snap.totalSelections || 0);
                    const denom = totalSelections || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} répondant(s) · ${totalSelections} sélections</div>`;
                    publishMcqMultiState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        totalSelections,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-multi',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: true,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqMultiState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqMultiState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="checkbox" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqMultiState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const chosen = new Set(Array.from(host.querySelectorAll('input[data-opt]:checked')).map(inp => Number(inp.dataset.opt)));
                let good = 0;
                answers.forEach(v => { if (chosen.has(v)) good++; });
                const isPerfect = chosen.size === answers.size && good === answers.size;
                result.textContent = isPerfect ? 'Correct' : `${good}/${answers.size} bonne(s) réponse(s)`;
                result.style.color = isPerfect ? '#22c55e' : 'var(--sl-warning,#f59e0b)';
                publishMcqMultiState({
                    mode: 'local',
                    active: false,
                    selected: Array.from(chosen).slice(0, 24),
                    good,
                    expected: answers.size,
                    perfect: isPerfect,
                });
            });
        });

        container.querySelectorAll('.sl-mcqsingle-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answer = Number(el.dataset.answer ?? 0);
            const host = el.querySelector('.sl-mcqsingle-options');
            const checkBtn = el.querySelector('.sl-mcqsingle-check');
            const endBtn = el.querySelector('.sl-mcqsingle-end');
            const result = el.querySelector('.sl-mcqsingle-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqSingleState = (extraState = {}) => emitAudienceElementState(el, 'mcq-single', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-single', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-single'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const denom = total || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} réponse(s)</div>`;
                    publishMcqSingleState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-single',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: false,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqSingleState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqSingleState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            const groupName = `mcq-single-${Math.random().toString(36).slice(2)}`;
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="radio" name="${groupName}" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqSingleState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const selected = host.querySelector('input[data-opt]:checked');
                if (!selected) {
                    result.textContent = 'Sélectionnez une réponse';
                    result.style.color = 'var(--sl-warning,#f59e0b)';
                    publishMcqSingleState({ mode: 'local', active: false, selected: -1, checked: false });
                    return;
                }
                const chosen = Number(selected.dataset.opt);
                const ok = chosen === answer;
                result.textContent = ok ? 'Correct' : 'Incorrect';
                result.style.color = ok ? '#22c55e' : '#f87171';
                publishMcqSingleState({
                    mode: 'local',
                    active: false,
                    selected: chosen,
                    checked: true,
                    correct: ok,
                });
            });
        });

        container.querySelectorAll('.sl-polllive-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pollType = el.dataset.pollType === 'thumbs' ? 'thumbs' : 'scale5';
            const prompt = String(el.dataset.prompt || '').trim();
            const startBtn = el.querySelector('.sl-polllive-start');
            const endBtn = el.querySelector('.sl-polllive-end');
            const resultsEl = el.querySelector('.sl-polllive-results');
            if (!startBtn || !endBtn || !resultsEl) return;
            const publishPollState = (extraState = {}) => emitAudienceElementState(el, 'poll-live', Object.assign({
                pollType,
                prompt,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));

            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                resultsEl.innerHTML = '<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>';
                subscribeAudienceElementState(el, 'poll-live', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }

            const renderPoll = snap => {
                if (!snap || !snap.active) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Sondage inactif</div>`;
                    publishPollState({ active: false });
                    return;
                }
                const fallback = snap.type === 'thumbs' ? ['Pour', 'Contre'] : ['1', '2', '3', '4', '5'];
                const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : fallback;
                const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                const total = Number(snap.total || 0);
                const totalSelections = Number(snap.totalSelections || 0);
                const denom = snap.multi ? (totalSelections || 1) : (total || 1);
                resultsEl.innerHTML = labels.map((l, i) => {
                    const c = counts[i] || 0;
                    const pct = denom > 0 ? Math.round((c / denom) * 100) : 0;
                    return `<div style="display:grid;grid-template-columns:56px 1fr 70px;gap:8px;align-items:center;font-size:0.74rem;">
                        <span>${SlidesRenderer.esc(l)}</span>
                        <div style="height:14px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#a78bfa);"></div></div>
                        <span>${c} (${pct}%)</span>
                    </div>`;
                }).join('') + `<div style="margin-top:4px;font-size:0.72rem;color:var(--sl-muted,#64748b);">${
                    snap.multi ? `${total} répondant(s) · ${totalSelections} sélections` : `${total} réponse(s)`
                }</div>`;
                publishPollState({
                    active: true,
                    counts: counts.slice(0, 32),
                    options: labels.slice(0, 16),
                    total,
                    totalSelections,
                    multi: !!snap.multi,
                });
            };

            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribePoll) {
                renderPoll({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPollState({ active: false, roomActive: false });
                return;
            }
            const unsub = bridge.subscribePoll(snap => {
                if (snap?.active && snap.type === pollType) renderPoll(snap);
                else if (!snap?.active) renderPoll({ active: false });
            });
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startPoll?.(pollType, prompt);
                if (!ok) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</div>`;
                    publishPollState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endPoll?.(); });
            renderPoll(bridge.getPollSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-exitticket-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Exit ticket';
            const promptsRaw = parseDataJson(el.dataset.prompts, []);
            const prompts = (Array.isArray(promptsRaw) ? promptsRaw : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 4);
            const safePrompts = prompts.length ? prompts : ['Ce que je retiens', 'Ce qui reste flou', 'Question finale'];
            const promptsEl = el.querySelector('.sl-exitticket-prompts');
            const resultsEl = el.querySelector('.sl-exitticket-results');
            const startBtn = el.querySelector('.sl-exitticket-start');
            const endBtn = el.querySelector('.sl-exitticket-end');
            if (!promptsEl || !resultsEl || !startBtn || !endBtn) return;
            const publishExitTicketState = (extraState = {}) => emitAudienceElementState(el, 'exit-ticket', Object.assign({
                promptsHtml: promptsEl.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPrompts = () => {
                promptsEl.innerHTML = safePrompts.map((prompt, idx) => (
                    `<div style="padding:7px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);font-size:0.74rem;"><strong>${idx + 1}.</strong> ${SlidesRenderer.esc(prompt)}</div>`
                )).join('');
            };
            renderPrompts();
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'exit-ticket', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.promptsHtml === 'string') promptsEl.innerHTML = sync.promptsHtml;
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribeExitTicket) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                resultsEl.textContent = 'Mode présentateur requis';
                publishExitTicketState({ active: false, roomActive: false });
                return;
            }
            let liveTicketId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveTicketId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveTicketId = '';
                    renderPrompts();
                    publishExitTicketState({ active: false, ticketId: '' });
                    return;
                }
                const snapPrompts = Array.isArray(snap.prompts) ? snap.prompts : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapPrompts) === JSON.stringify(safePrompts);
                if (!liveTicketId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                        publishExitTicketState({ active: false, conflict: true });
                        return;
                    }
                    liveTicketId = String(snap.ticketId || '');
                }
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                    publishExitTicketState({ active: false, conflict: true });
                    return;
                }
                const responses = Array.isArray(snap.responses) ? snap.responses : [];
                const top = responses.slice(0, 3);
                resultsEl.innerHTML = `<div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-bottom:4px;">${Number(snap.responsesCount || 0)} réponse(s)</div>`
                    + (top.length
                        ? top.map(entry => {
                            const pseudo = SlidesRenderer.esc(entry?.pseudo || 'Anonyme');
                            const answers = (Array.isArray(entry?.answers) ? entry.answers : []).filter(Boolean).slice(0, 2);
                            const preview = answers.map(v => SlidesRenderer.esc(v)).join(' · ');
                            return `<div style="font-size:0.68rem;padding:5px 6px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;margin-top:4px;"><strong>${pseudo}</strong>${preview ? `: ${preview}` : ''}</div>`;
                        }).join('')
                        : '<div style="font-size:0.68rem;color:var(--sl-muted,#64748b);">En attente de réponses…</div>');
                publishExitTicketState({
                    active: true,
                    ticketId: String(snap.ticketId || liveTicketId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeExitTicket(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startExitTicket?.({ title, prompts: safePrompts });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un exit ticket est déjà actif)</span>';
                    publishExitTicketState({ active: false, startError: true });
                    return;
                }
                liveTicketId = String(started);
                publishExitTicketState({ active: true, ticketId: liveTicketId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getExitTicketSnapshot?.();
                if (!snap?.active) return;
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) return;
                bridge.endExitTicket?.();
            });
            renderLive(bridge.getExitTicketSnapshot?.() || { active: false, responses: [] });
        });

        container.querySelectorAll('.sl-postitlive-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const prompt = String(el.dataset.prompt || '').trim();
            const grid = el.querySelector('.sl-postitlive-grid');
            const startBtn = el.querySelector('.sl-postitlive-start');
            const endBtn = el.querySelector('.sl-postitlive-end');
            if (!grid || !startBtn || !endBtn) return;
            const publishPostitState = (extraState = {}) => emitAudienceElementState(el, 'postit-wall', Object.assign({
                gridHtml: grid.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>`;
                subscribeAudienceElementState(el, 'postit-wall', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.gridHtml === 'string') grid.innerHTML = sync.gridHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            const renderNotes = snap => {
                if (!snap || !snap.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Mur inactif</div>`;
                    publishPostitState({ active: false });
                    return;
                }
                const palette = [
                    ['#fde68a', '#78350f'],
                    ['#bfdbfe', '#1e3a8a'],
                    ['#bbf7d0', '#14532d'],
                    ['#fecdd3', '#881337'],
                    ['#ddd6fe', '#4c1d95'],
                ];
                grid.innerHTML = (snap.words || []).slice(0, 18).map(([txt, count], i) => {
                    const [bg, fg] = palette[i % palette.length];
                    return `<div style="background:${bg};color:${fg};border-radius:8px;padding:6px;font-size:0.68rem;line-height:1.3;min-height:40px;position:relative;">
                        ${SlidesRenderer.esc(txt)}
                        <span style="position:absolute;right:6px;bottom:4px;font-size:0.62rem;opacity:0.75;">×${count}</span>
                    </div>`;
                }).join('');
                publishPostitState({
                    active: true,
                    wordsCount: Array.isArray(snap.words) ? snap.words.length : 0,
                });
            };
            if (!bridge?.subscribeWordCloud) {
                renderNotes({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPostitState({ active: false, roomActive: false });
                return;
            }
            bridge.subscribeWordCloud(snap => renderNotes(snap));
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startWordCloud?.(prompt);
                if (!ok) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un mur est déjà actif)</div>`;
                    publishPostitState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endWordCloud?.(); });
            renderNotes(bridge.getWordCloudSnapshot?.() || { active: false, words: [] });
        });

        container.querySelectorAll('.sl-roulette-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pickBtn = el.querySelector('.sl-roulette-pick');
            const pickedEl = el.querySelector('.sl-roulette-picked');
            if (!pickBtn || !pickedEl) return;
            const publishRouletteState = (extraState = {}) => emitAudienceElementState(el, 'roulette', Object.assign({
                pickedHtml: pickedEl.innerHTML,
                pickedText: String(pickedEl.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPick = pseudo => {
                if (!pseudo) {
                    pickedEl.textContent = '';
                    publishRouletteState({ pseudo: '' });
                    return;
                }
                pickedEl.innerHTML = `<span class="sl-picked-inline-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></span><span>${SlidesRenderer.esc(pseudo)}</span>`;
                publishRouletteState({ pseudo: String(pseudo || '') });
            };
            if (isAudienceReadOnly) {
                pickBtn.disabled = true;
                pickBtn.style.pointerEvents = 'none';
                pickBtn.style.display = 'none';
                subscribeAudienceElementState(el, 'roulette', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.pickedHtml === 'string') pickedEl.innerHTML = sync.pickedHtml;
                    else if (typeof sync.pickedText === 'string') pickedEl.textContent = sync.pickedText;
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.pickRandomStudent) {
                pickBtn.disabled = true;
                pickBtn.textContent = 'Salle inactive';
                publishRouletteState({ roomActive: false });
                return;
            }
            bridge.subscribeRoulette?.(payload => {
                renderPick(payload?.pseudo || '');
            });
            pickBtn.addEventListener('click', e => {
                e.preventDefault();
                const pick = bridge.pickRandomStudent();
                if (!pick?.pseudo) {
                    pickedEl.textContent = 'Aucun étudiant connecté';
                    return;
                }
                renderPick(pick.pseudo);
            });
        });

        container.querySelectorAll('.sl-roomstats-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const metrics = parseDataJson(el.dataset.metrics, ['students', 'hands', 'questions', 'feedback']);
            const grid = el.querySelector('.sl-roomstats-grid');
            const foot = el.querySelector('.sl-roomstats-foot');
            if (!grid) return;
            if (isAudienceReadOnly) {
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>`;
                if (foot) foot.textContent = 'Stats détaillées visibles côté présentateur';
                return;
            }
            const labels = {
                students: 'Connectés',
                hands: 'Mains levées',
                questions: 'Questions',
                feedback: 'Feedback 10 min',
                poll: 'Sondage actif',
                wordcloud: 'Nuage actif',
            };
            const bridge = window.OEIRoomBridge;
            const renderStats = snap => {
                if (!snap?.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Stats indisponibles (salle inactive)</div>`;
                    if (foot) foot.textContent = 'Ouvrez la salle dans le mode présentateur';
                    return;
                }
                const metricKeys = (Array.isArray(metrics) && metrics.length ? metrics : ['students', 'hands', 'questions', 'feedback']).slice(0, 6);
                const valueFor = key => {
                    if (key === 'students') return Number(snap.studentsCount || 0);
                    if (key === 'hands') return Number(snap.handsCount || 0);
                    if (key === 'questions') return Number(snap.questionsOpen || 0);
                    if (key === 'feedback') return Number(snap.feedback10m?.total || 0);
                    if (key === 'poll') return snap.pollActive ? 'Oui' : 'Non';
                    if (key === 'wordcloud') return snap.wordCloudActive ? 'Oui' : 'Non';
                    return '--';
                };
                grid.innerHTML = metricKeys.map(key => `
                    <div style="padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000);">
                        <div style="font-size:0.64rem;color:var(--sl-muted,#64748b);text-transform:uppercase;">${SlidesRenderer.esc(labels[key] || key)}</div>
                        <div style="font-size:1.05rem;color:var(--sl-heading,#f1f5f9);font-weight:700;margin-top:2px;">${SlidesRenderer.esc(valueFor(key))}</div>
                    </div>
                `).join('');
                if (foot) foot.textContent = `Transport: ${SlidesRenderer.esc(snap.transport || 'p2p')}`;
            };
            if (!bridge?.subscribeRoom) {
                renderStats({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderStats);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderStats(bridge.getRoomSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-leaderboard-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const listEl = el.querySelector('.sl-leaderboard-list');
            const foot = el.querySelector('.sl-leaderboard-foot');
            const limit = Math.max(1, Math.min(20, Number(el.dataset.limit || 5)));
            if (!listEl) return;
            if (isAudienceReadOnly) {
                listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>';
                if (foot) foot.textContent = 'Classement détaillé visible côté présentateur';
                return;
            }
            const bridge = window.OEIRoomBridge;
            const renderBoard = snap => {
                if (!snap?.active) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Leaderboard indisponible (salle inactive)</div>';
                    if (foot) foot.textContent = 'Ouvrez la salle pour activer le classement';
                    return;
                }
                const rows = Array.isArray(snap.students) ? snap.students : [];
                const sorted = rows.slice().sort((a, b) => {
                    const ds = Number(b.score || 0) - Number(a.score || 0);
                    if (ds !== 0) return ds;
                    return String(a.pseudo || '').localeCompare(String(b.pseudo || ''), 'fr', { sensitivity: 'base' });
                }).slice(0, limit);
                if (!sorted.length) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Aucun étudiant connecté</div>';
                    if (foot) foot.textContent = 'En attente de participants';
                    return;
                }
                listEl.innerHTML = sorted.map((row, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="width:22px;font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="flex:1;color:var(--sl-text,#e2e8f0);font-size:0.72rem;">${SlidesRenderer.esc(row.pseudo || 'Anonyme')}</span>
                        <span style="color:var(--sl-heading,#f1f5f9);font-weight:700;font-size:0.72rem;">${Number(row.score || 0).toLocaleString()}</span>
                    </div>
                `).join('');
                if (foot) foot.textContent = `${sorted.length} / ${Number(snap.studentsCount || 0)} affichés`;
            };
            if (!bridge?.subscribeRoom) {
                renderBoard({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderBoard);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderBoard(bridge.getRoomSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-decisiontree-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector('.sl-dt-branches');
            const branches = parseDataJson(el.dataset.branches, []);
            if (!host) return;
            host.innerHTML = (Array.isArray(branches) ? branches : []).slice(0, 8).map(b => `
                <button style="pointer-events:auto;text-align:left;padding:7px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">
                    <div style="font-weight:700;">${SlidesRenderer.esc(b?.label || 'Branche')}</div>
                    <div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-top:2px;">${SlidesRenderer.esc(b?.outcome || '')}</div>
                </button>`).join('');
            if (isAudienceReadOnly) disableInteractiveControls(host);
        });

        container.querySelectorAll('.sl-codecompare-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector('.sl-codecompare-view');
            const slider = el.querySelector('.sl-codecompare-range');
            const before = String(el.dataset.before || '');
            const after = String(el.dataset.after || '');
            if (!host || !slider) return;
            host.innerHTML = `<pre style="position:absolute;inset:0;margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#cbd5e1;background:#0b1020;">${before}</pre>
                <div class="sl-codecompare-after-wrap" style="position:absolute;inset:0;overflow:hidden;width:50%;border-right:2px solid rgba(167,139,250,0.9);">
                    <pre style="margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#e2e8f0;background:#0f172a;">${after}</pre>
                </div>`;
            const afterWrap = host.querySelector('.sl-codecompare-after-wrap');
            const publishCodeCompareState = (extraState = {}) => emitAudienceElementState(el, 'code-compare', Object.assign({
                value: Number(slider.value) || 50,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                slider.disabled = true;
                slider.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'code-compare', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextValue = Number(sync.value);
                    if (!Number.isFinite(nextValue)) return;
                    const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
                    slider.value = String(clamped);
                    if (afterWrap) afterWrap.style.width = `${clamped}%`;
                });
                return;
            }
            slider.addEventListener('input', () => {
                if (afterWrap) afterWrap.style.width = `${slider.value}%`;
                publishCodeCompareState();
            });
            publishCodeCompareState();
        });

        container.querySelectorAll('.sl-algostepper-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const steps = parseDataJson(el.dataset.steps, []);
            const ttl = el.querySelector('.sl-algostepper-step-title');
            const det = el.querySelector('.sl-algostepper-step-detail');
            const code = el.querySelector('.sl-algostepper-code');
            const prev = el.querySelector('.sl-algostepper-prev');
            const next = el.querySelector('.sl-algostepper-next');
            if (!ttl || !det || !code || !prev || !next) return;
            let idx = 0;
            const render = () => {
                const step = steps[idx] || {};
                ttl.textContent = step.title || `Étape ${idx + 1}`;
                det.textContent = step.detail || '';
                code.textContent = step.code || '';
                prev.disabled = idx <= 0;
                next.disabled = idx >= steps.length - 1;
            };
            const publishAlgoStepperState = (extraState = {}) => emitAudienceElementState(el, 'algo-stepper', Object.assign({
                index: idx,
                total: Array.isArray(steps) ? steps.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'algo-stepper', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.index);
                    if (!Number.isFinite(nextIdx)) return;
                    const max = Math.max(0, steps.length - 1);
                    idx = Math.max(0, Math.min(max, Math.trunc(nextIdx)));
                    render();
                    prev.disabled = true;
                    next.disabled = true;
                    prev.style.pointerEvents = 'none';
                    next.style.pointerEvents = 'none';
                });
                render();
                return;
            }
            prev.addEventListener('click', e => {
                e.preventDefault();
                if (idx > 0) { idx--; render(); publishAlgoStepperState(); }
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                if (idx < steps.length - 1) { idx++; render(); publishAlgoStepperState(); }
            });
            render();
            publishAlgoStepperState();
        });

        container.querySelectorAll('.sl-galleryanno-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const src = String(el.dataset.src || '');
            const alt = String(el.dataset.alt || 'Image annotée');
            const notes = parseDataJson(el.dataset.notes, []);
            const stage = el.querySelector('.sl-galleryanno-stage');
            const caption = el.querySelector('.sl-galleryanno-caption');
            if (!stage || !caption) return;
            stage.innerHTML = src ? `<img src="${src}" alt="${SlidesRenderer.esc(alt)}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#64748b);font-size:0.74rem;">Image non définie</div>`;
            let activeIndex = 0;
            const publishGalleryState = (extraState = {}) => emitAudienceElementState(el, 'gallery-annotable', Object.assign({
                activeIndex,
                caption: String(caption.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            (Array.isArray(notes) ? notes : []).slice(0, 20).forEach((n, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.style.cssText = `position:absolute;left:${Math.max(5, Math.min(95, Number(n.x)||0))}%;top:${Math.max(5, Math.min(95, Number(n.y)||0))}%;transform:translate(-50%,-50%);width:19px;height:19px;border-radius:50%;border:none;background:#f43f5e;color:#fff;font-size:0.62rem;pointer-events:auto;cursor:pointer;`;
                b.textContent = String(i + 1);
                b.addEventListener('click', () => {
                    activeIndex = i;
                    caption.textContent = n.text || '';
                    publishGalleryState();
                });
                stage.appendChild(b);
            });
            caption.textContent = (notes[0]?.text) || '';
            if (isAudienceReadOnly) {
                disableInteractiveControls(stage);
                subscribeAudienceElementState(el, 'gallery-annotable', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.caption === 'string') caption.textContent = sync.caption;
                });
                return;
            }
            publishGalleryState();
        });

        container.querySelectorAll('.sl-kanban-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cols = parseDataJson(el.dataset.columns, []);
            const host = el.querySelector('.sl-kanban-cols');
            if (!host) return;
            host.innerHTML = (Array.isArray(cols) ? cols : []).slice(0, 4).map(col => `<div class="sl-kb-col" style="flex:1;min-width:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;">
                <div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;text-transform:uppercase;">${SlidesRenderer.esc(col?.name || '')}</div>
                ${(Array.isArray(col?.cards) ? col.cards : []).slice(0, 6).map((c, i) => `<div class="sl-kb-card" draggable="true" data-card="${i}" style="pointer-events:auto;padding:5px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;font-size:0.68rem;cursor:grab;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${SlidesRenderer.esc(c)}</div>`).join('')}
            </div>`).join('');
            const publishKanbanState = (extraState = {}) => emitAudienceElementState(el, 'kanban-mini', Object.assign({
                hostHtml: host.innerHTML,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                disableInteractiveControls(host);
                host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                subscribeAudienceElementState(el, 'kanban-mini', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            let dragged = null;
            host.querySelectorAll('.sl-kb-card').forEach(card => {
                card.addEventListener('dragstart', () => { dragged = card; });
            });
            host.querySelectorAll('.sl-kb-col').forEach(col => {
                col.addEventListener('dragover', e => e.preventDefault());
                col.addEventListener('drop', e => {
                    e.preventDefault();
                    if (dragged) {
                        col.appendChild(dragged);
                        publishKanbanState();
                    }
                });
            });
            publishKanbanState();
        });

        container.querySelectorAll('.sl-rankorder-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Classement';
            const initialItems = parseDataJson(el.dataset.items, []);
            const host = el.querySelector('.sl-rankorder-list');
            const resultsEl = el.querySelector('.sl-rankorder-results');
            const startBtn = el.querySelector('.sl-rankorder-start');
            const endBtn = el.querySelector('.sl-rankorder-end');
            if (!host || !resultsEl || !startBtn || !endBtn) return;
            const items = (Array.isArray(initialItems) ? initialItems : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 8);
            const safeItems = items.length >= 2 ? items : ['Option A', 'Option B', 'Option C'];
            const publishRankOrderState = (extraState = {}) => emitAudienceElementState(el, 'rank-order', Object.assign({
                listHtml: host.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startVisible: startBtn.style.display !== 'none',
                endVisible: endBtn.style.display !== 'none',
                startLabel: String(startBtn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderEditable = () => {
                host.innerHTML = safeItems.map((item, i) => `
                    <div class="sl-rankorder-row" data-idx="${i}" style="display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        <span style="display:flex;gap:4px;">
                            <button type="button" class="sl-rank-up" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↑</button>
                            <button type="button" class="sl-rank-down" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↓</button>
                        </span>
                    </div>
                `).join('');
                host.querySelectorAll('.sl-rank-up').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i <= 0) return;
                        [safeItems[i - 1], safeItems[i]] = [safeItems[i], safeItems[i - 1]];
                        renderEditable();
                    });
                });
                host.querySelectorAll('.sl-rank-down').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i >= safeItems.length - 1) return;
                        [safeItems[i], safeItems[i + 1]] = [safeItems[i + 1], safeItems[i]];
                        renderEditable();
                    });
                });
                publishRankOrderState({
                    mode: 'local',
                    active: false,
                    order: safeItems.slice(0, 16),
                });
            };
            const renderRankRows = rows => {
                const src = Array.isArray(rows) ? rows : [];
                if (!src.length) {
                    host.innerHTML = safeItems.map((item, i) => `
                        <div style="display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                            <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                            <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        </div>
                    `).join('');
                    return;
                }
                host.innerHTML = src.map((row, i) => `
                    <div style="display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${SlidesRenderer.esc(row?.label || '')}</span>
                        <span style="font-size:0.68rem;color:var(--sl-muted,#64748b);">${Number(row?.score || 0)} pts</span>
                    </div>
                `).join('');
            };
            if (isAudienceReadOnly) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                disableInteractiveControls(host);
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'rank-order', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.listHtml === 'string') host.innerHTML = sync.listHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startVisible === 'boolean') startBtn.style.display = sync.startVisible ? '' : 'none';
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribeRankOrder) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                resultsEl.textContent = 'Réorganisez localement la liste';
                renderEditable();
                publishRankOrderState({ mode: 'local', active: false });
                return;
            }
            let liveRankId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveRankId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveRankId = '';
                    renderRankRows([]);
                    publishRankOrderState({ mode: 'live', active: false, rankId: '' });
                    return;
                }
                const snapItems = Array.isArray(snap.items) ? snap.items : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapItems) === JSON.stringify(safeItems);
                if (!liveRankId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                        publishRankOrderState({ mode: 'live', active: false, conflict: true });
                        return;
                    }
                    liveRankId = String(snap.rankId || '');
                }
                if (liveRankId && String(snap.rankId || '') !== liveRankId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                    publishRankOrderState({ mode: 'live', active: false, conflict: true });
                    return;
                }
                renderRankRows(snap.rows);
                resultsEl.innerHTML = `<span style="color:var(--sl-muted,#64748b);">${Number(snap.responsesCount || 0)} participant(s)</span>`;
                publishRankOrderState({
                    mode: 'live',
                    active: true,
                    rankId: String(snap.rankId || liveRankId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeRankOrder(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startRankOrder?.({ title, items: safeItems });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un classement est déjà actif)</span>';
                    publishRankOrderState({ mode: 'live', active: false, startError: true });
                    return;
                }
                liveRankId = String(started);
                publishRankOrderState({ mode: 'live', active: true, rankId: liveRankId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getRankOrderSnapshot?.();
                if (!snap?.active) return;
                if (liveRankId && String(snap.rankId || '') !== liveRankId) return;
                bridge.endRankOrder?.();
            });
            renderLive(bridge.getRankOrderSnapshot?.() || { active: false, rows: [] });
        });

        container.querySelectorAll('.sl-myth-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const card = el.querySelector('.sl-flip-card');
            if (!card) return;
            let flipped = false;
            const applyFlip = nextState => {
                flipped = !!nextState;
                card.classList.toggle('is-flipped', flipped);
            };
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'myth-reality', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    applyFlip(sync.flipped === true);
                });
                applyFlip(false);
                return;
            }
            card.addEventListener('click', () => {
                applyFlip(!flipped);
                emitAudienceElementState(el, 'myth-reality', { flipped });
            });
            emitAudienceElementState(el, 'myth-reality', { flipped: false });
        });

        container.querySelectorAll('.sl-flashcards-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cards = parseDataJson(el.dataset.cards, []);
            const card = el.querySelector('.sl-flashcards-card');
            const front = el.querySelector('.sl-flashcards-front');
            const back = el.querySelector('.sl-flashcards-back');
            const prev = el.querySelector('.sl-flashcards-prev');
            const next = el.querySelector('.sl-flashcards-next');
            if (!card || !front || !back || !prev || !next || !cards.length) return;
            let idx = 0;
            let flipped = false;
            const render = () => {
                const c = cards[idx] || {};
                front.innerHTML = `<div><div class="sl-flip-face-label">Question</div>${SlidesRenderer.esc(c.front || '')}</div>`;
                back.innerHTML = `<div><div class="sl-flip-face-label">Réponse</div>${SlidesRenderer.esc(c.back || '')}</div>`;
                card.classList.toggle('is-flipped', !!flipped);
            };
            const publishFlashcardsState = (extraState = {}) => emitAudienceElementState(el, 'flashcards', Object.assign({
                idx,
                flipped,
                total: Array.isArray(cards) ? cards.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'flashcards', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.idx);
                    if (Number.isFinite(nextIdx)) {
                        idx = ((Math.trunc(nextIdx) % cards.length) + cards.length) % cards.length;
                    }
                    flipped = !!sync.flipped;
                    render();
                });
                render();
                return;
            }
            card.addEventListener('click', () => {
                flipped = !flipped;
                render();
                publishFlashcardsState();
            });
            prev.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx - 1 + cards.length) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx + 1) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            render();
            publishFlashcardsState();
        });
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

    /* ── Canvas slide renderer (viewer) ── */

    static _canvasSection(s, index, notes = '', opts = {}) {
        const bg = SlidesRenderer._slideBackground(s);
        const transitionAttr = s.transition ? ` data-transition="${SlidesRenderer.esc(s.transition)}"` : '';
        const elements = [...(s.elements || [])].filter(e => e.type !== 'connector').sort((a, b) => (a.z || 0) - (b.z || 0));
        const els = elements.map(el => SlidesRenderer._canvasElement(el, index, opts)).join('');
        const connSvg = SlidesRenderer._renderConnectors(s.connectors || [], elements);
        const overlay = SlidesRenderer._slideOverlay(index, opts);
        const themeVars = SlidesRenderer._themeOverrideStyle(s);
        const combinedStyle = `${themeVars ? `${themeVars};` : ''}${bg.style}`;
        return `<section class="sl-canvas" data-slide-index="${index}"${bg.attrs}${transitionAttr} style="${combinedStyle}">
            <div style="position:absolute;inset:0;">${els}${connSvg}</div>
            ${overlay}${notes}
        </section>`;
    }

    static _getAnchorPos(el, anchor) {
        switch (anchor) {
            case 'top':    return { x: el.x + el.w / 2, y: el.y };
            case 'right':  return { x: el.x + el.w,     y: el.y + el.h / 2 };
            case 'bottom': return { x: el.x + el.w / 2, y: el.y + el.h };
            case 'left':   return { x: el.x,             y: el.y + el.h / 2 };
            default:       return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
        }
    }

    static _anchorDir(anchor) {
        switch (anchor) {
            case 'top':    return { dx: 0, dy: -1 };
            case 'right':  return { dx: 1, dy: 0 };
            case 'bottom': return { dx: 0, dy: 1 };
            case 'left':   return { dx: -1, dy: 0 };
            default:       return { dx: 0, dy: 0 };
        }
    }

    static _renderConnectors(connectors, elements) {
        if (!connectors || connectors.length === 0) return '';
        let defs = '', paths = '';
        for (const conn of connectors) {
            const src = elements.find(e => e.id === conn.sourceId);
            const tgt = elements.find(e => e.id === conn.targetId);
            if (!src || !tgt) continue;
            const p1 = SlidesRenderer._getAnchorPos(src, conn.sourceAnchor);
            const p2 = SlidesRenderer._getAnchorPos(tgt, conn.targetAnchor);
            const s = conn.style || {};
            const stroke = s.stroke || '#818cf8';
            const sw = s.strokeWidth || 3;
            const opacity = s.opacity != null ? s.opacity : 1;
            const mkEnd = 'cme-' + Math.random().toString(36).slice(2, 7);
            const mkStart = 'cms-' + Math.random().toString(36).slice(2, 7);
            if (conn.arrowEnd) defs += `<marker id="${mkEnd}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="${stroke}"/></marker>`;
            if (conn.arrowStart) defs += `<marker id="${mkStart}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="10 0,0 3.5,10 7" fill="${stroke}"/></marker>`;
            const me = conn.arrowEnd ? `marker-end="url(#${mkEnd})"` : '';
            const ms = conn.arrowStart ? `marker-start="url(#${mkStart})"` : '';
            let pathD;
            switch (conn.lineType) {
                case 'curve': {
                    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2, ddx = p2.x-p1.x, ddy = p2.y-p1.y;
                    pathD = `M${p1.x},${p1.y} Q${mx-ddy*0.3},${my+ddx*0.3} ${p2.x},${p2.y}`;
                    break;
                }
                case 'elbow': case 'rounded': {
                    const GAP = 30;
                    const d1 = SlidesRenderer._anchorDir(conn.sourceAnchor);
                    const d2 = SlidesRenderer._anchorDir(conn.targetAnchor);
                    const ext1 = { x: p1.x + d1.dx * GAP, y: p1.y + d1.dy * GAP };
                    const ext2 = { x: p2.x + d2.dx * GAP, y: p2.y + d2.dy * GAP };
                    const isH1 = d1.dx !== 0, isH2 = d2.dx !== 0;
                    let pts;
                    if (isH1 && isH2) { const mx = (ext1.x+ext2.x)/2; pts = [p1,ext1,{x:mx,y:ext1.y},{x:mx,y:ext2.y},ext2,p2]; }
                    else if (!isH1 && !isH2) { const my = (ext1.y+ext2.y)/2; pts = [p1,ext1,{x:ext1.x,y:my},{x:ext2.x,y:my},ext2,p2]; }
                    else if (isH1) { pts = [p1,ext1,{x:ext2.x,y:ext1.y},ext2,p2]; }
                    else { pts = [p1,ext1,{x:ext1.x,y:ext2.y},ext2,p2]; }
                    if (conn.lineType === 'rounded') {
                        const R = 12;
                        let d = `M${pts[0].x},${pts[0].y}`;
                        for (let i = 1; i < pts.length - 1; i++) {
                            const prev = pts[i-1], cur = pts[i], next = pts[i+1];
                            const d1x = cur.x-prev.x, d1y = cur.y-prev.y, d2x = next.x-cur.x, d2y = next.y-cur.y;
                            const len1 = Math.sqrt(d1x*d1x+d1y*d1y), len2 = Math.sqrt(d2x*d2x+d2y*d2y);
                            const r = Math.min(R, len1/2, len2/2);
                            if (r < 1) { d += ` L${cur.x},${cur.y}`; continue; }
                            d += ` L${cur.x-(d1x/len1)*r},${cur.y-(d1y/len1)*r} Q${cur.x},${cur.y} ${cur.x+(d2x/len2)*r},${cur.y+(d2y/len2)*r}`;
                        }
                        d += ` L${pts[pts.length-1].x},${pts[pts.length-1].y}`;
                        pathD = d;
                    } else {
                        pathD = 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
                    }
                    break;
                }
                default:
                    pathD = `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
            }
            const dashAttr = s.dashArray ? ` stroke-dasharray="${s.dashArray}"` : '';
            paths += `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dashAttr} ${me} ${ms}/>`;
            if (conn.label) {
                const lx = (p1.x+p2.x)/2, ly = (p1.y+p2.y)/2;
                paths += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="14" font-family="var(--sl-font-body)">${SlidesRenderer.esc(conn.label)}</text>`;
            }
        }
        return `<svg width="1280" height="720" viewBox="0 0 1280 720" style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:9000;"><defs>${defs}</defs>${paths}</svg>`;
    }

    static _canvasElement(el, slideIndex = 0, opts = {}) {
        const rot = (el.style?.rotate) ? `transform:rotate(${el.style.rotate}deg);` : '';
        // Caption support — allow overflow for caption below element
        const hasCaption = !!el.data?.caption;
        // Animation support — map to Reveal.js fragment classes
        const anim = el.animation;
        let fragmentClass = '';
        let fragmentAttr = '';
        if (anim && anim.type && anim.type !== 'none') {
            const animMap = {
                'fade-in': 'fragment fade-in',
                'fade-up': 'fragment fade-up',
                'fade-down': 'fragment fade-down',
                'fade-left': 'fragment fade-left',
                'fade-right': 'fragment fade-right',
                'grow': 'fragment grow',
                'shrink': 'fragment shrink',
                'zoom-in': 'fragment zoom-in',
                'highlight-current-blue': 'fragment highlight-current-blue',
            };
            fragmentClass = animMap[anim.type] || 'fragment fade-in';
            if (anim.order != null) fragmentAttr = ` data-fragment-index="${anim.order}"`;
        }
        const cls = fragmentClass ? ` class="${fragmentClass}"` : '';
        const needsOverflow = hasCaption || el.type === 'timer' || el.type === 'latex' || el.type === 'code-live' || el.type === 'quiz-live';
        const css = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.z||1};overflow:${needsOverflow ? 'visible' : 'hidden'};box-sizing:border-box;${rot}`;
        let content = '';
        switch (el.type) {
            case 'heading':
            case 'text': {
                const s = el.style || {};
                const vAlign = s.verticalAlign || 'top';
                const vAlignCSS = vAlign === 'middle' ? 'display:flex;flex-direction:column;justify-content:center;'
                    : vAlign === 'bottom' ? 'display:flex;flex-direction:column;justify-content:flex-end;'
                    : '';
                const extras = [
                    s.fontStyle     ? `font-style:${s.fontStyle};`         : '',
                    s.textTransform ? `text-transform:${s.textTransform};` : '',
                    s.letterSpacing ? `letter-spacing:${s.letterSpacing};` : '',
                    s.opacity != null ? `opacity:${s.opacity};`            : '',
                    s.background    ? `background:${s.background};`        : '',
                ].join('');
                let body = el.data?.html || SlidesShared.autoFormatText(el.data?.text || '');
                // Replace template variables
                body = body.replace(/\{\{slideNumber\}\}/g, String(slideIndex + 1));
                // Resolve cross-references
                if (opts.captionRegistry) body = SlidesShared.resolveRefs(body, opts.captionRegistry);
                content = `<div style="width:100%;height:100%;padding:8px 10px;font-size:${s.fontSize||22}px;font-weight:${s.fontWeight||400};color:${s.color||'var(--sl-text)'};text-align:${s.textAlign||'left'};font-family:${s.fontFamily||'var(--sl-font-body)'};line-height:${s.lineHeight||1.35};white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;${vAlignCSS}${extras}">${body}</div>`;
                break;
            }
            case 'code': {
                content = SlidesShared.codeTerminal(el.data?.code || '', el.data?.language || 'text', 'sl');
                break;
            }
            case 'list': {
                const s = el.style || {};
                const items = (el.data?.items || []).map(i => `<li class="fragment">${i}</li>`).join('');
                content = `<ul style="margin:0;padding:6px 0 6px 1.5em;font-size:${s.fontSize||22}px;color:${s.color||'var(--sl-text)'};text-align:left;">${items}</ul>`;
                break;
            }
            case 'image': {
                content = el.data?.src
                    ? `<img src="${SlidesRenderer.esc(el.data.src)}" alt="${SlidesRenderer.esc(el.data?.alt||'')}" style="width:100%;height:100%;object-fit:contain;">`
                    : '';
                break;
            }
            case 'shape': {
                const { svgInner, opacity, textHtml } = SlidesShared.shapeSVG(el, { escapeText: true });
                content = `<div style="position:relative;width:100%;height:100%;opacity:${opacity};"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgInner}</svg>${textHtml}</div>`;
                break;
            }
            case 'widget': {
                const cfg = JSON.stringify(el.data?.config || {}).replace(/"/g, '&quot;');
                content = `<div class="sl-sim-container" data-widget="${SlidesRenderer.esc(el.data?.widget||'')}" data-config="${cfg}" style="width:100%;height:100%;"></div>`;
                break;
            }
            case 'definition': {
                content = `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary) 8%,var(--sl-slide-bg));border-left:4px solid var(--sl-primary);border-radius:0 8px 8px 0;padding:0.75rem 1rem;overflow:auto;box-sizing:border-box;">
                    <div style="font-family:var(--sl-font-mono);font-weight:700;color:var(--sl-primary);margin-bottom:0.35rem;">${SlidesRenderer.esc(el.data?.term||'')}</div>
                    <div style="color:var(--sl-text);line-height:1.5;">${el.data?.definition||''}</div>
                    ${el.data?.example ? `<div style="margin-top:0.5rem;font-size:0.85em;color:var(--sl-muted);">Exemple : ${SlidesRenderer.esc(el.data.example)}</div>` : ''}
                </div>`;
                break;
            }
            case 'code-example': {
                const mode = ['terminal', 'live', 'stepper'].includes(el.data?.widgetType) ? el.data.widgetType : 'terminal';
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                let widget = SlidesShared.codeTerminal(code, lang, 'sl');
                if (mode === 'live') {
                    widget = `<div style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0;">
                        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--sl-border);background:color-mix(in srgb,var(--sl-surface) 88%,#000);font-size:0.66rem;">
                            <span style="font-family:var(--sl-font-mono);color:var(--sl-muted);text-transform:uppercase;">${SlidesRenderer.esc(lang)}</span>
                            <span style="margin-left:auto;color:var(--sl-primary);font-weight:700;text-transform:uppercase;">Live</span>
                        </div>
                        <pre style="margin:0;padding:8px 10px;font-size:0.72rem;font-family:var(--sl-font-mono);color:var(--sl-text);white-space:pre;overflow:auto;flex:1;"><code class="language-${SlidesRenderer.esc(lang)}">${SlidesRenderer.esc(code)}</code></pre>
                    </div>`;
                } else if (mode === 'stepper') {
                    const steps = Array.isArray(el.data?.stepperSteps) ? el.data.stepperSteps : [];
                    const first = steps[0] || {};
                    widget = `<div style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0;">
                        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--sl-border);background:color-mix(in srgb,var(--sl-surface) 88%,#000);font-size:0.66rem;">
                            <span>${SlidesRenderer.esc(el.data?.stepperTitle || 'Exécution pas à pas')}</span>
                            <span style="margin-left:auto;color:var(--sl-primary);font-weight:700;text-transform:uppercase;">Stepper</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;min-height:0;overflow:auto;">
                            <div style="font-size:0.74rem;color:var(--sl-heading);font-weight:600;">${SlidesRenderer.esc(first.title || 'Étape 1')}</div>
                            <div style="font-size:0.69rem;color:var(--sl-muted);">${SlidesRenderer.esc(first.detail || '')}</div>
                            <pre style="margin:0;margin-top:auto;padding:7px 8px;border:1px solid var(--sl-border);border-radius:7px;background:color-mix(in srgb,var(--sl-slide-bg) 80%,#000);font-size:0.66rem;font-family:var(--sl-font-mono);color:var(--sl-text);white-space:pre;overflow:auto;"><code class="language-${SlidesRenderer.esc(lang)}">${SlidesRenderer.esc(first.code || '')}</code></pre>
                        </div>
                    </div>`;
                }
                content = `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary) 8%,var(--sl-slide-bg));border-left:4px solid var(--sl-primary);border-radius:0 8px 8px 0;padding:0.75rem 1rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.55rem;overflow:hidden;">
                    <div style="font-family:var(--sl-font-mono);font-weight:700;color:var(--sl-primary);font-size:1em;text-transform:uppercase;letter-spacing:0.03em;">Exemple</div>
                    <div style="color:var(--sl-text);font-size:0.88em;line-height:1.45;max-height:36%;overflow:auto;">${el.data?.text || ''}</div>
                    <div style="flex:1;min-height:110px;border:1px solid var(--sl-border);border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-slide-bg) 82%,#000);">${widget}</div>
                </div>`;
                break;
            }
            case 'quote': {
                const s = el.style || {};
                const author = el.data?.author
                    ? `<div style="margin-top:0.75rem;font-size:0.78em;color:var(--sl-primary);font-weight:600;font-style:normal;">— ${SlidesRenderer.esc(el.data.author)}</div>`
                    : '';
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 1.5rem;box-sizing:border-box;overflow:hidden;">
                    <div style="font-size:3em;color:var(--sl-primary);opacity:0.4;line-height:0.7;margin-bottom:0.2rem;">"</div>
                    <div style="font-size:${s.fontSize||26}px;font-style:italic;color:${s.color||'var(--sl-heading)'};line-height:1.5;font-family:var(--sl-font-body);">${el.data?.text||''}</div>
                    ${author}
                </div>`;
                break;
            }
            case 'card': {
                const s = el.style || {};
                const cardTitle = el.data?.title
                    ? `<div style="font-size:0.85em;font-weight:700;color:${s.titleColor||'var(--sl-primary)'};border-bottom:1px solid var(--sl-border);padding-bottom:0.5rem;margin-bottom:0.75rem;">${SlidesRenderer.esc(el.data.title)}</div>`
                    : '';
                const items = (el.data?.items || []).map(i => `<li class="fragment">${SlidesRenderer.esc(i)}</li>`).join('');
                content = `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary) 5%,var(--sl-slide-bg));border:1px solid var(--sl-border);border-radius:10px;padding:1rem 1.2rem;overflow:auto;box-sizing:border-box;">
                    ${cardTitle}
                    <ul style="margin:0;padding-left:1.4em;font-size:${s.fontSize||18}px;color:${s.color||'var(--sl-text)'};text-align:left;">${items}</ul>
                </div>`;
                break;
            }
            case 'video': {
                const embedUrl = el.data?.embedUrl || '';
                const origUrl = el.data?.src || embedUrl;
                if (embedUrl) {
                    // Use youtube-nocookie for privacy; show fallback link for file:// contexts
                    const safeEmbed = embedUrl.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
                    const videoTitle = SlidesRenderer.esc(el.data?.alt || el.data?.caption || 'Vidéo intégrée');
                    content = `<div style="width:100%;height:100%;background:#000;border-radius:8px;overflow:hidden;position:relative;">
                        <iframe src="${SlidesRenderer.esc(safeEmbed)}" title="${videoTitle}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
                        <a href="${SlidesRenderer.esc(origUrl)}" target="_blank" rel="noopener" style="position:absolute;bottom:8px;right:12px;font-size:0.7rem;color:rgba(255,255,255,0.5);text-decoration:none;z-index:1;pointer-events:auto;">Ouvrir ↗</a>
                    </div>`;
                }
                break;
            }
            case 'table': {
                const s = el.style || {};
                const rows = el.data?.rows || [];
                let tHtml = '<table style="width:100%;border-collapse:collapse;table-layout:fixed;">';
                rows.forEach((row, ri) => {
                    tHtml += '<tr>';
                    const tag = ri === 0 ? 'th' : 'td';
                    const bg = ri === 0
                        ? `background:color-mix(in srgb,var(--sl-primary) 60%,transparent);font-weight:700;color:#fff;`
                        : ri % 2 === 0
                            ? 'background:color-mix(in srgb,var(--sl-slide-bg) 70%,rgba(255,255,255,0.06));'
                            : 'background:color-mix(in srgb,var(--sl-slide-bg) 80%,rgba(255,255,255,0.03));';
                    (row || []).forEach(cell => {
                        tHtml += `<${tag} style="border:1px solid rgba(255,255,255,0.15);padding:6px 10px;text-align:left;${bg}">${SlidesRenderer.esc(cell)}</${tag}>`;
                    });
                    tHtml += '</tr>';
                });
                tHtml += '</table>';
                content = `<div style="width:100%;height:100%;overflow:auto;font-size:${s.fontSize||18}px;color:${s.color||'var(--sl-text)'};text-align:left;">${tHtml}</div>`;
                break;
            }
            case 'mermaid': {
                const code = el.data?.code || '';
                content = `<div class="sl-mermaid-pending" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><pre style="display:none">${SlidesRenderer.esc(code)}</pre><div class="sl-mermaid-render" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div></div>`;
                break;
            }
            case 'latex': {
                const s = el.style || {};
                const expr = el.data?.expression || '';
                content = `<div class="sl-latex-pending" data-latex="${SlidesRenderer.esc(expr)}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:${s.fontSize||32}px;color:${s.color||'var(--sl-text)'};"><span class="sl-latex-render">${SlidesRenderer.esc(expr)}</span></div>`;
                break;
            }
            case 'timer': {
                const s = el.style || {};
                const dur = el.data?.duration || 300;
                const label = el.data?.label || '';
                const mins = Math.floor(dur / 60);
                const secs = dur % 60;
                const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
                content = `<div class="sl-timer-content" data-duration="${dur}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
                    ${label ? `<div style="font-size:${Math.round((s.fontSize||48)*0.4)}px;color:var(--sl-muted);font-weight:600;text-transform:uppercase;">${SlidesRenderer.esc(label)}</div>` : ''}
                    <div class="sl-timer-display" style="font-size:${s.fontSize||48}px;color:${s.color||'var(--sl-heading)'};font-variant-numeric:tabular-nums;font-weight:700;font-family:var(--sl-font-mono,monospace);">${display}</div>
                    <div style="display:flex;gap:0.5rem;margin-top:0.3rem;">
                        <button class="sl-timer-btn sl-timer-start" title="Démarrer" style="pointer-events:auto;">▶</button>
                        <button class="sl-timer-btn sl-timer-pause" title="Pause" style="display:none;pointer-events:auto;">⏸</button>
                        <button class="sl-timer-btn sl-timer-reset" title="Réinitialiser" style="pointer-events:auto;">↺</button>
                    </div>
                </div>`;
                break;
            }
            case 'iframe': {
                const url = el.data?.url;
                if (url) {
                    content = `<iframe src="${SlidesRenderer.esc(url)}" style="width:100%;height:100%;border:none;border-radius:8px;" sandbox="allow-scripts allow-same-origin" title="${SlidesRenderer.esc(el.data?.title||'')}"></iframe>`;
                }
                break;
            }
            case 'highlight': {
                const lang = SlidesRenderer.esc(el.data?.language || 'python');
                const code = SlidesRenderer.esc(el.data?.code || '');
                const highlights = (el.data?.highlights || []).map(h => h.lines).join('|');
                // Use Reveal.js native <pre><code> (no sl-code-terminal wrapper)
                // to avoid flex layout conflicts with Reveal's fragment cloning.
                // Wrap in .sl-highlight-block to apply terminal-like styling.
                content = `<div class="sl-highlight-block">
                    <div class="sl-code-tbar"><div class="sl-code-dot sl-code-dot-r"></div><div class="sl-code-dot sl-code-dot-y"></div><div class="sl-code-dot sl-code-dot-g"></div><span class="sl-code-tbar-lang">${lang}</span></div>
                    <pre><code class="language-${lang}" data-line-numbers="${highlights}">${code}</code></pre>
                </div>`;
                break;
            }
            case 'qrcode': {
                const val = el.data?.value || '';
                const label = el.data?.label || '';
                const isLink = /^https?:\/\//i.test(val);
                const qrAlt = SlidesRenderer.esc(el.data?.alt || label || val || 'QR code');
                const imgTag = `<img src="${SlidesRenderer._buildQrSrc(val, 300)}" alt="${qrAlt}" style="width:80%;max-height:80%;aspect-ratio:1;object-fit:contain;border-radius:8px;">`;
                const labelHtml = label ? `<div style="font-size:14px;color:var(--sl-muted);text-align:center;">${SlidesRenderer.esc(label)}</div>` : '';
                const innerContent = isLink
                    ? `<a href="${SlidesRenderer.esc(val)}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;text-decoration:none;pointer-events:auto;cursor:pointer;">${imgTag}${labelHtml}</a>`
                    : `${imgTag}${labelHtml}`;
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;">${innerContent}</div>`;
                break;
            }
            case 'smartart': {
                const variant = el.data?.variant || 'process';
                const items = el.data?.items || [];
                const color = el.style?.color || 'var(--sl-primary)';
                // Simple HTML representation for Reveal.js
                if (variant === 'process') {
                    const steps = items.map((item, i) => {
                        const arrow = i < items.length - 1 ? `<span style="color:${color};font-size:24px;opacity:0.7;margin:0 4px;">→</span>` : '';
                        return `<span style="flex:1;padding:12px;border:2px solid ${color};border-radius:10px;text-align:center;background:color-mix(in srgb,${color} 8%,var(--sl-slide-bg));color:var(--sl-text);">${SlidesRenderer.esc(item)}</span>${arrow}`;
                    }).join('');
                    content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;box-sizing:border-box;">${steps}</div>`;
                } else if (variant === 'pyramid') {
                    const rows = items.map((item, i) => {
                        const w = 30 + 70 * (i + 1) / items.length;
                        return `<div style="width:${w}%;padding:10px;border-radius:6px;text-align:center;color:var(--sl-text);background:color-mix(in srgb,${color} ${20+60*(items.length-i)/items.length}%,var(--sl-slide-bg));border:1px solid ${color};margin:0 auto;">${SlidesRenderer.esc(item)}</div>`;
                    }).join('');
                    content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:12px;box-sizing:border-box;">${rows}</div>`;
                } else if (variant === 'matrix') {
                    const cols = Math.ceil(Math.sqrt(items.length));
                    const cells = items.map(item =>
                        `<div style="padding:12px;border:2px solid ${color};border-radius:8px;text-align:center;color:var(--sl-text);background:color-mix(in srgb,${color} 8%,var(--sl-slide-bg));display:flex;align-items:center;justify-content:center;">${SlidesRenderer.esc(item)}</div>`
                    ).join('');
                    content = `<div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;padding:12px;box-sizing:border-box;align-items:center;">${cells}</div>`;
                } else {
                    // cycle / default — simple list
                    const steps = items.map(item => `<span style="padding:8px 14px;border:2px solid ${color};border-radius:20px;color:var(--sl-text);background:color-mix(in srgb,${color} 10%,var(--sl-slide-bg));">${SlidesRenderer.esc(item)}</span>`).join(' → ');
                    content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:12px;box-sizing:border-box;">${steps}</div>`;
                }
                break;
            }
            case 'code-live': {
                const lang = SlidesRenderer.esc(el.data?.language || 'python');
                const code = SlidesRenderer.esc(el.data?.code || '');
                const autoRun = el.data?.autoRun ? 'data-autorun="1"' : '';
                content = `<div class="sl-codelive-pending" data-language="${lang}" ${autoRun} style="width:100%;height:100%;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;border:1px solid var(--sl-border,#2d3347);">
                    <div class="sl-codelive-toolbar" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 90%,#000);border-bottom:1px solid var(--sl-border,#2d3347);">
                        <span style="font-size:0.75rem;color:var(--sl-muted,#64748b);font-family:var(--sl-font-mono,monospace);text-transform:uppercase;">${lang}</span>
                        <span style="flex:1"></span>
                        <button class="sl-codelive-run" style="pointer-events:auto;padding:4px 14px;border-radius:6px;border:none;background:var(--sl-primary,#818cf8);color:#fff;font-size:0.75rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">▶ Exécuter</button>
                        <button class="sl-codelive-clear" style="pointer-events:auto;padding:4px 10px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-muted,#64748b);font-size:0.7rem;cursor:pointer;">Effacer</button>
                    </div>
                    <div style="display:flex;flex:1;min-height:0;">
                        <div class="sl-codelive-editor" style="flex:1;min-width:0;position:relative;overflow:hidden;"><textarea class="sl-codelive-code" style="width:100%;height:100%;background:var(--sl-slide-bg,#141620);color:var(--sl-text,#cbd5e1);border:none;padding:12px;font-family:var(--sl-font-mono,monospace);font-size:14px;resize:none;outline:none;box-sizing:border-box;tab-size:4;">${code}</textarea></div>
                        <div class="sl-codelive-output" style="flex:0 0 40%;border-left:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#141620) 80%,#000);display:flex;flex-direction:column;">
                            <div style="padding:4px 10px;font-size:0.65rem;color:var(--sl-muted,#64748b);text-transform:uppercase;border-bottom:1px solid var(--sl-border,#2d3347);">Sortie</div>
                            <pre class="sl-codelive-console" style="flex:1;margin:0;padding:10px;font-size:13px;color:var(--sl-text,#cbd5e1);font-family:var(--sl-font-mono,monospace);overflow:auto;white-space:pre-wrap;"></pre>
                        </div>
                    </div>
                </div>`;
                break;
            }
            case 'quiz-live': {
                const question = SlidesRenderer.esc(el.data?.question || '');
                const opts = el.data?.options || [];
                const answer = el.data?.answer ?? 0;
                const duration = el.data?.duration || 30;
                const roomId = 'ql-' + (el.id || Math.random().toString(36).slice(2, 9));
                const optsHtml = opts.map((o, i) =>
                    `<div class="sl-quizlive-option" data-idx="${i}" style="padding:10px 16px;border:2px solid var(--sl-border,#2d3347);border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all 0.2s;pointer-events:auto;">
                        <span style="width:28px;height:28px;border-radius:50%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 15%,var(--sl-slide-bg,#141620));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:var(--sl-primary,#818cf8);">${String.fromCharCode(65 + i)}</span>
                        <span style="color:var(--sl-text,#cbd5e1);font-size:1rem;">${SlidesRenderer.esc(o)}</span>
                    </div>`
                ).join('');
                content = `<div class="sl-quizlive-pending" data-room="${SlidesRenderer.esc(roomId)}" data-answer="${answer}" data-duration="${duration}" style="width:100%;height:100%;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;gap:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-flex;width:18px;height:18px;color:var(--sl-primary,#818cf8);" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></span>
                        <span style="font-size:0.8rem;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;letter-spacing:0.05em;">Quiz</span>
                        <span style="flex:1"></span>
                        <span class="sl-quizlive-timer" style="font-family:var(--sl-font-mono,monospace);font-size:1rem;color:var(--sl-muted,#64748b);">${duration}s</span>
                        <button class="sl-quizlive-start" style="pointer-events:auto;padding:5px 14px;border-radius:6px;border:none;background:var(--sl-primary,#818cf8);color:#fff;font-size:0.75rem;font-weight:600;cursor:pointer;">Lancer</button>
                    </div>
                    <div class="sl-quizlive-question" style="font-size:1.2rem;font-weight:600;color:var(--sl-heading,#f1f5f9);line-height:1.4;">${question}</div>
                    <div class="sl-quizlive-options" style="display:flex;flex-direction:column;gap:8px;flex:1;">${optsHtml}</div>
                    <div class="sl-quizlive-results" style="display:none;flex:1;"></div>
                    <div class="sl-quizlive-qr" style="display:none;position:absolute;top:12px;right:12px;width:140px;height:140px;background:#fff;border-radius:8px;padding:6px;cursor:grab;z-index:20;box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:auto;"><div class="sl-qr-resize-handle">⇲</div></div>
                    <div class="sl-quizlive-status" style="font-size:0.75rem;color:var(--sl-muted,#64748b);text-align:center;">Cliquez sur « Lancer » pour démarrer le quiz</div>
                </div>`;
                break;
            }
            case 'cloze': {
                const sentence = SlidesRenderer.esc(el.data?.sentence || '');
                const blanks = JSON.stringify(el.data?.blanks || []).replace(/"/g, '&quot;');
                content = `<div class="sl-cloze-pending" data-sentence="${sentence}" data-blanks="${blanks}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:10px;padding:14px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,var(--sl-primary,#818cf8) 6%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--sl-primary,#818cf8);">Texte à trous</div>
                    <div class="sl-cloze-body" style="font-size:1rem;line-height:1.5;color:var(--sl-text,#e2e8f0);"></div>
                    <button class="sl-cloze-toggle" style="margin-top:auto;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:pointer;align-self:flex-start;">Afficher les réponses</button>
                </div>`;
                break;
            }
            case 'mcq-single': {
                const q = SlidesRenderer.esc(el.data?.question || '');
                const opts = JSON.stringify(el.data?.options || []).replace(/"/g, '&quot;');
                const answer = Number(el.data?.answer ?? 0);
                content = `<div class="sl-mcqsingle-pending" data-options="${opts}" data-answer="${answer}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">QCM simple</div>
                    <div class="sl-mcq-question" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${q}</div>
                    <div class="sl-mcqsingle-options" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="sl-mcqsingle-check" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:var(--sl-primary,#818cf8);color:#fff;font-size:0.75rem;cursor:pointer;">Valider</button>
                        <button class="sl-mcqsingle-end" style="display:none;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:pointer;">Terminer live</button>
                        <div class="sl-mcqsingle-result" style="font-size:0.75rem;color:var(--sl-muted,#64748b);align-self:center;"></div>
                    </div>
                </div>`;
                break;
            }
            case 'drag-drop': {
                const items = JSON.stringify(el.data?.items || []).replace(/"/g, '&quot;');
                const targets = JSON.stringify(el.data?.targets || []).replace(/"/g, '&quot;');
                const title = SlidesRenderer.esc(el.data?.title || 'Classez les éléments');
                content = `<div class="sl-dnd-pending" data-items="${items}" data-targets="${targets}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.85rem;font-weight:700;color:var(--sl-heading,#f1f5f9);">${title}</div>
                    <div class="sl-dnd-items" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
                    <div class="sl-dnd-targets" style="display:flex;gap:6px;flex:1;min-height:0;"></div>
                </div>`;
                break;
            }
            case 'mcq-multi': {
                const q = SlidesRenderer.esc(el.data?.question || '');
                const opts = JSON.stringify(el.data?.options || []).replace(/"/g, '&quot;');
                const answers = JSON.stringify(el.data?.answers || []).replace(/"/g, '&quot;');
                content = `<div class="sl-mcqmulti-pending" data-options="${opts}" data-answers="${answers}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">QCM multi</div>
                    <div class="sl-mcq-question" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${q}</div>
                    <div class="sl-mcqmulti-options" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="sl-mcqmulti-check" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:var(--sl-primary,#818cf8);color:#fff;font-size:0.75rem;cursor:pointer;">Valider</button>
                        <button class="sl-mcqmulti-end" style="display:none;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:pointer;">Terminer live</button>
                        <div class="sl-mcqmulti-result" style="font-size:0.75rem;color:var(--sl-muted,#64748b);align-self:center;"></div>
                    </div>
                </div>`;
                break;
            }
            case 'poll-likert': {
                const prompt = SlidesRenderer.esc(el.data?.prompt || 'Votre niveau de confiance (1 à 5) ?');
                content = `<div class="sl-polllive-pending" data-poll-type="scale5" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 10%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#8b5cf6;">Likert live</div>
                    <div class="sl-polllive-prompt" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${prompt}</div>
                    <div class="sl-polllive-results" style="display:flex;flex-direction:column;gap:6px;flex:1;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="sl-polllive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:0.74rem;cursor:pointer;">Lancer</button>
                        <button class="sl-polllive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'debate-mode': {
                const prompt = SlidesRenderer.esc(el.data?.prompt || 'Pour ou contre ?');
                content = `<div class="sl-polllive-pending" data-poll-type="thumbs" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 10%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#8b5cf6;">Débat live</div>
                    <div class="sl-polllive-prompt" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${prompt}</div>
                    <div class="sl-polllive-results" style="display:flex;flex-direction:column;gap:6px;flex:1;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="sl-polllive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:0.74rem;cursor:pointer;">Lancer</button>
                        <button class="sl-polllive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'exit-ticket': {
                const title = SlidesRenderer.esc(el.data?.title || 'Exit ticket');
                const prompts = Array.isArray(el.data?.prompts) ? el.data.prompts : [];
                const promptsJson = JSON.stringify(prompts).replace(/"/g, '&quot;');
                content = `<div class="sl-exitticket-pending" data-title="${title}" data-prompts="${promptsJson}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#8b5cf6;">${title}</div>
                    <div class="sl-exitticket-prompts" style="display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0;"></div>
                    <div class="sl-exitticket-results" style="font-size:0.72rem;color:var(--sl-muted,#64748b);min-height:1.2em;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="sl-exitticket-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:0.74rem;cursor:pointer;">Lancer</button>
                        <button class="sl-exitticket-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'postit-wall': {
                const prompt = SlidesRenderer.esc(el.data?.prompt || 'Partagez une idée clé');
                content = `<div class="sl-postitlive-pending" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">Mur Post-it live</div>
                    <div class="sl-postitlive-prompt" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${prompt}</div>
                    <div class="sl-postitlive-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:1;min-height:0;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="sl-postitlive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#14b8a6;color:#052e2b;font-size:0.74rem;font-weight:700;cursor:pointer;">Lancer</button>
                        <button class="sl-postitlive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'audience-roulette': {
                const title = SlidesRenderer.esc(el.data?.title || 'Roulette participants');
                content = `<div class="sl-roulette-pending" data-title="${title}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;align-items:center;justify-content:center;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">Roulette</div>
                    <div style="font-size:0.95rem;color:var(--sl-heading,#f1f5f9);text-align:center;">${title}</div>
                    <div class="sl-roulette-picked" style="font-size:1.05rem;font-weight:700;color:#e2e8f0;min-height:1.4em;"></div>
                    <button class="sl-roulette-pick" style="pointer-events:auto;padding:6px 12px;border-radius:8px;border:none;background:#14b8a6;color:#052e2b;font-size:0.75rem;font-weight:700;cursor:pointer;">Tirer au sort</button>
                </div>`;
                break;
            }
            case 'room-stats': {
                const title = SlidesRenderer.esc(el.data?.title || 'Stats live');
                const metrics = JSON.stringify(Array.isArray(el.data?.metrics) ? el.data.metrics : ['students', 'hands', 'questions', 'feedback']).replace(/"/g, '&quot;');
                content = `<div class="sl-roomstats-pending" data-title="${title}" data-metrics="${metrics}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">${title}</div>
                    <div class="sl-roomstats-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;min-height:0;"></div>
                    <div class="sl-roomstats-foot" style="font-size:0.7rem;color:var(--sl-muted,#64748b);">Mode présentateur requis</div>
                </div>`;
                break;
            }
            case 'leaderboard-live': {
                const title = SlidesRenderer.esc(el.data?.title || 'Leaderboard live');
                const limit = Math.max(3, Math.min(12, Number(el.data?.limit || 5)));
                content = `<div class="sl-leaderboard-pending" data-title="${title}" data-limit="${limit}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">${title}</div>
                    <div class="sl-leaderboard-list" style="display:flex;flex-direction:column;gap:6px;overflow:auto;flex:1;min-height:0;"></div>
                    <div class="sl-leaderboard-foot" style="font-size:0.7rem;color:var(--sl-muted,#64748b);">Classement live indisponible</div>
                </div>`;
                break;
            }
            case 'swot-grid': {
                const toList = arr => (Array.isArray(arr) ? arr : []).slice(0, 3).map(v => `<li>${SlidesRenderer.esc(v)}</li>`).join('');
                content = `<div class="sl-swot-pending" style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;">
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(52,211,153,0.09);font-size:0.69rem;"><strong>Forces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.strength)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(248,113,113,0.4);background:rgba(248,113,113,0.09);font-size:0.69rem;"><strong>Faiblesses</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.weakness)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(14,165,233,0.4);background:rgba(14,165,233,0.09);font-size:0.69rem;"><strong>Opportunités</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.opportunity)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.09);font-size:0.69rem;"><strong>Menaces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.threat)}</ul></div>
                </div>`;
                break;
            }
            case 'decision-tree': {
                const root = SlidesRenderer.esc(el.data?.root || '');
                const branches = JSON.stringify(el.data?.branches || []).replace(/"/g, '&quot;');
                content = `<div class="sl-decisiontree-pending" data-root="${root}" data-branches="${branches}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#ec4899;">Arbre de décision</div>
                    <div class="sl-dt-root" style="padding:8px;border:1px solid rgba(236,72,153,0.45);border-radius:8px;text-align:center;">${root}</div>
                    <div class="sl-dt-branches" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow:auto;"></div>
                </div>`;
                break;
            }
            case 'timeline-vertical': {
                const title = SlidesRenderer.esc(el.data?.title || 'Timeline');
                const steps = (Array.isArray(el.data?.steps) ? el.data.steps : []).map((s, i) => `<div style="display:flex;gap:8px;align-items:flex-start;"><span style="width:16px;height:16px;border-radius:50%;border:1px solid #ec4899;color:#ec4899;display:inline-flex;align-items:center;justify-content:center;font-size:0.62rem;">${i+1}</span><span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(s)}</span></div>`).join('');
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#ec4899;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:7px;overflow:auto;">${steps}</div>
                </div>`;
                break;
            }
            case 'code-compare': {
                const lang = SlidesRenderer.esc(el.data?.language || 'text');
                const before = SlidesRenderer.esc(el.data?.before || '');
                const after = SlidesRenderer.esc(el.data?.after || '');
                content = `<div class="sl-codecompare-pending" data-language="${lang}" data-before="${before}" data-after="${after}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#22c55e;text-transform:uppercase;font-weight:700;">Comparateur de code (${lang})</div>
                    <div class="sl-codecompare-view" style="position:relative;flex:1;min-height:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:hidden;"></div>
                    <input class="sl-codecompare-range" type="range" min="0" max="100" value="50" style="pointer-events:auto;">
                </div>`;
                break;
            }
            case 'algo-stepper': {
                const title = SlidesRenderer.esc(el.data?.title || 'Algo stepper');
                const steps = JSON.stringify(el.data?.steps || []).replace(/"/g, '&quot;');
                content = `<div class="sl-algostepper-pending" data-steps="${steps}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#22c55e;">${title}</div>
                    <div class="sl-algostepper-step-title" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);"></div>
                    <div class="sl-algostepper-step-detail" style="font-size:0.78rem;color:var(--sl-muted,#64748b);"></div>
                    <pre class="sl-algostepper-code" style="margin:0;flex:1;min-height:0;padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);font-size:0.7rem;font-family:var(--sl-font-mono,monospace);overflow:auto;"></pre>
                    <div style="display:flex;gap:8px;">
                        <button class="sl-algostepper-prev" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.72rem;cursor:pointer;">Précédent</button>
                        <button class="sl-algostepper-next" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:none;background:#22c55e;color:#052e16;font-size:0.72rem;font-weight:700;cursor:pointer;">Suivant</button>
                    </div>
                </div>`;
                break;
            }
            case 'gallery-annotable': {
                const src = SlidesRenderer.esc(el.data?.src || '');
                const alt = SlidesRenderer.esc(el.data?.alt || el.data?.caption || 'Image annotée');
                const notes = JSON.stringify(el.data?.notes || []).replace(/"/g, '&quot;');
                content = `<div class="sl-galleryanno-pending" data-src="${src}" data-alt="${alt}" data-notes="${notes}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#f43f5e;text-transform:uppercase;font-weight:700;">Gallery annotable</div>
                    <div class="sl-galleryanno-stage" style="position:relative;flex:1;min-height:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);"></div>
                    <div class="sl-galleryanno-caption" style="font-size:0.72rem;color:var(--sl-muted,#64748b);min-height:1.2em;"></div>
                </div>`;
                break;
            }
            case 'rank-order': {
                const title = SlidesRenderer.esc(el.data?.title || 'Classement');
                const items = JSON.stringify(el.data?.items || []).replace(/"/g, '&quot;');
                content = `<div class="sl-rankorder-pending" data-title="${title}" data-items="${items}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="sl-rankorder-list" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div class="sl-rankorder-results" style="font-size:0.7rem;color:var(--sl-muted,#64748b);min-height:1.2em;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="sl-rankorder-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#0ea5e9;color:#082f49;font-size:0.74rem;font-weight:700;cursor:pointer;">Lancer</button>
                        <button class="sl-rankorder-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'kanban-mini': {
                const title = SlidesRenderer.esc(el.data?.title || 'Kanban mini');
                const cols = JSON.stringify(el.data?.columns || []).replace(/"/g, '&quot;');
                content = `<div class="sl-kanban-pending" data-columns="${cols}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="sl-kanban-cols" style="display:flex;gap:6px;flex:1;min-height:0;"></div>
                </div>`;
                break;
            }
            case 'myth-reality': {
                const myth = SlidesRenderer.esc(el.data?.myth || '');
                const reality = SlidesRenderer.esc(el.data?.reality || '');
                content = `<div class="sl-myth-pending" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div class="sl-flip-card sl-myth-card" style="width:86%;height:148px;pointer-events:auto;">
                        <div class="sl-flip-card-inner">
                            <div class="sl-flip-face sl-flip-front">
                                <div class="sl-flip-face-label sl-flip-face-label-myth">Mythe</div>
                                ${myth}
                            </div>
                            <div class="sl-flip-face sl-flip-back">
                                <div class="sl-flip-face-label sl-flip-face-label-reality">Réalité</div>
                                ${reality}
                            </div>
                        </div>
                    </div>
                    <div class="sl-flip-hint">Cliquer pour retourner la carte</div>
                </div>`;
                break;
            }
            case 'flashcards-auto': {
                const title = SlidesRenderer.esc(el.data?.title || 'Flashcards');
                const cards = JSON.stringify(el.data?.cards || []).replace(/"/g, '&quot;');
                content = `<div class="sl-flashcards-pending" data-cards="${cards}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;align-items:center;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="sl-flip-card sl-flashcards-card" style="width:88%;height:148px;pointer-events:auto;">
                        <div class="sl-flip-card-inner">
                            <div class="sl-flip-face sl-flip-front sl-flashcards-front"></div>
                            <div class="sl-flip-face sl-flip-back sl-flashcards-back"></div>
                        </div>
                    </div>
                    <div class="sl-flip-hint">Cliquer pour voir le verso</div>
                    <div style="display:flex;gap:8px;">
                        <button class="sl-flashcards-prev" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.72rem;cursor:pointer;">Précédent</button>
                        <button class="sl-flashcards-next" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:none;background:#0ea5e9;color:#082f49;font-size:0.72rem;font-weight:700;cursor:pointer;">Suivant</button>
                    </div>
                </div>`;
                break;
            }
        }
        const captionHtml = SlidesShared.renderCaptionHtml(el, 'sl');
        const elementIdAttr = el?.id ? ` data-element-id="${SlidesRenderer.esc(String(el.id))}"` : '';
        return `<div${cls}${fragmentAttr}${elementIdAttr} style="${css}">${content}${captionHtml}</div>`;
    }
}
window.SlidesRenderer = SlidesRenderer;
