// @ts-check
/**
 * slides-themes.js — Lot 16B
 *
 * SlidesThemes extracted from slides-core.js.
 * Dépendance : window.SlidesShared (défini dans slides-core.js).
 * Doit être chargé après slides-core.js.
 */

/* =========================================================
   THEMES
   ========================================================= */

if (!window.SlidesShared) {
    throw new Error('[SlidesThemes] Module manquant: charger slides-core.js avant slides-themes.js.');
}

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
        const typo = SlidesShared.resolveTypographyDefaults(null);
        const codeSize = SlidesShared.resolveElementFontSize('code', {}, typo, 16);
        const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
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
    --sl-heading-size: ${typo.heading}px;
    --sl-text-size: ${typo.text}px;
    --sl-code-size: ${codeSize}px;
    --sl-code-line-height: ${codeLineHeight};
}
body { background: var(--sl-bg); }
.reveal { font-family: var(--sl-font-body); color: var(--sl-text); line-height: var(--sl-body-line-height, 1.45); }
.reveal .slides { background: transparent; }
.reveal section {
    background: var(--sl-slide-bg);
    border-radius: var(--sl-radius, 12px);
    padding: calc(var(--sl-content-padding-y, 40) * 1px) calc(var(--sl-content-padding-x, 48) * 1px);
    --sl-code-font-size: var(--sl-code-size, 16px);
    --sl-code-gutter-size: var(--sl-code-size, 16px);
    --sl-code-lang-size: calc(var(--sl-code-size, 16px) * 0.8);
    --sl-text-xs: clamp(10px, calc(var(--sl-text-size, 22px) - 8px), 112px);
    --sl-text-sm: clamp(10px, calc(var(--sl-text-size, 22px) - 4px), 116px);
    --sl-text-md: var(--sl-text-size, 22px);
    --sl-text-lg: clamp(12px, calc(var(--sl-text-size, 22px) + 2px), 124px);
    --sl-text-xl: clamp(14px, calc(var(--sl-text-size, 22px) + 6px), 130px);
    --sl-title-size: clamp(42px, calc(var(--sl-heading-size, 52px) * 1.26), 190px);
    --sl-title-sub-size: var(--sl-text-lg);
    --sl-title-meta-size: var(--sl-text-sm);
    --sl-label-size: var(--sl-text-xs);
    --sl-note-size: var(--sl-text-sm);
    --sl-def-label-size: var(--sl-text-xs);
    --sl-def-body-size: var(--sl-text-lg);
    --sl-def-example-size: var(--sl-text-sm);
    --sl-quiz-title-size: clamp(24px, calc(var(--sl-heading-size, 52px) * 0.7), 100px);
    --sl-quiz-option-size: clamp(10px, calc(var(--sl-text-size, 22px) - 4px), 118px);
    --sl-quiz-meta-size: var(--sl-text-xs);
    --sl-quiz-marker-size: clamp(16px, calc(var(--sl-quiz-option-size, 20px) + 2px), 58px);
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
.reveal h1 { font-size: var(--sl-heading-size, 52px); font-weight: 800; }
.reveal h2 { font-size: calc(var(--sl-heading-size, 52px) * 0.62); font-weight: 700; border-bottom: 2px solid var(--sl-primary); padding-bottom: 0.35em; margin-bottom: 0.7em; }
.reveal h3 { font-size: calc(var(--sl-heading-size, 52px) * 0.46); font-weight: 600; color: var(--sl-primary); }
.reveal p, .reveal li { font-size: var(--sl-text-size, 22px); line-height: 1.6; }
.reveal strong, .reveal b { font-weight: 700; }
.reveal ul, .reveal ol { margin: 0; padding-left: 1.4em; text-align: left; }
.reveal li { margin-bottom: 0.5em; }
.reveal li::marker { color: var(--sl-primary); }
.reveal aside.notes { font-size: var(--sl-note-size, 18px); line-height: 1.5; }
.reveal pre {
    width: 100%;
    margin: 0;
    background: color-mix(in srgb, var(--sl-code-bg, #0d1117) 35%, #000 65%);
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--sl-border, #2d3347) 45%, #cbd5e1 55%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}
.reveal code { font-family: var(--sl-font-mono); font-size: 0.85em; }
.reveal pre code {
    font-size: var(--sl-code-size, 16px);
    padding: 1rem 1.2rem;
    line-height: 1.6;
    color: color-mix(in srgb, var(--sl-code-text, #e2e8f0) 70%, #fff 30%);
    background: transparent;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}
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
.sl-title { text-align: center; align-items: center; justify-content: center; min-height: 100%; }
.sl-title-content { width: min(100%, 1040px); margin: auto; display: flex; flex-direction: column; align-items: center; }
.sl-title h1 { font-size: var(--sl-title-size, calc(var(--sl-heading-size, 52px) * 1.26)); }
.sl-title-eyebrow { font-size: var(--sl-label-size, 0.8em); font-family: var(--sl-font-mono); color: var(--sl-primary); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
.sl-title-sub { font-size: var(--sl-title-sub-size, clamp(1rem,2.2vw,1.4rem)); color: var(--sl-muted); margin-top: 0.5rem; line-height: 1.35; }
.sl-title-meta { display: flex; gap: 1.5rem; margin-top: 2rem; font-size: var(--sl-title-meta-size, 0.8em); color: var(--sl-muted); justify-content: center; }

/* Chapter */
.sl-chapter { text-align: center; align-items: center; justify-content: center; min-height: 100%; background: linear-gradient(135deg, var(--sl-slide-bg) 0%, color-mix(in srgb, var(--sl-primary) 15%, var(--sl-slide-bg)) 100%) !important; }
.sl-chapter-content { width: min(100%, 1040px); margin: auto; display: flex; flex-direction: column; align-items: center; }
.sl-chapter-num { font-size: clamp(3rem,8vw,6rem); font-weight: 900; color: var(--sl-primary); opacity: 0.25; line-height: 1; font-family: var(--sl-font-heading); }
.sl-chapter h2 { border: none; font-size: calc(var(--sl-heading-size, 52px) * 1.05); margin-top: 0; }
.sl-chapter-sub { color: var(--sl-muted); font-size: 1.1em; }

/* Bullets */
.sl-bullets { text-align: left; }
.sl-bullets-layout { display: flex; gap: 2rem; flex: 1; align-items: flex-start; margin-top: 0.5rem; }
.sl-bullets-list { flex: 1; }
.sl-bullets-note { flex: 0 0 35%; background: color-mix(in srgb, var(--sl-primary) 8%, var(--sl-slide-bg)); border-left: 3px solid var(--sl-primary); border-radius: 0 8px 8px 0; padding: 1rem 1.2rem; font-size: var(--sl-note-size, 0.85em); color: var(--sl-muted); }
.sl-bullets-note-label { display: inline-block; font-weight: 800; color: var(--sl-heading); margin-bottom: 0.2rem; }

/* Code */
.sl-code { text-align: left; }
.sl-code-layout { display: flex; gap: 1.5rem; flex: 1; align-items: flex-start; }
.sl-code-pre { flex: 1; overflow: auto; }
.sl-code-expl { flex: 0 0 35%; font-size: var(--sl-note-size, 0.85em); color: var(--sl-muted); line-height: 1.6; padding-top: 0.5rem; }
.sl-code-expl p { margin: 0 0 0.5em; }

/* Split */
.sl-split { text-align: left; }
.sl-split-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex: 1; align-items: start; }
.sl-split-col { display: flex; flex-direction: column; gap: 0.75rem; }
.sl-split-label { font-size: var(--sl-label-size, 0.7em); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sl-primary); margin-bottom: 0.25rem; line-height: 1.35; }

/* Definition */
.sl-definition { text-align: left; }
.sl-def-box { background: color-mix(in srgb, var(--sl-primary) 8%, var(--sl-slide-bg)); border: 1px solid var(--sl-tag-border); border-left: 4px solid var(--sl-primary); border-radius: 0 10px 10px 0; padding: 1.2rem 1.5rem; margin: 0.75rem 0; }
.sl-def-term { font-family: var(--sl-font-mono); font-size: 1.1em; font-weight: 700; color: var(--sl-primary); margin-bottom: 0.5rem; }
.sl-def-body { color: var(--sl-text); line-height: 1.6; font-size: var(--sl-def-body-size, var(--sl-text-lg)); }
.sl-def-example { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--sl-border); font-size: var(--sl-def-example-size, 0.85em); color: var(--sl-muted); line-height: 1.5; }
.sl-def-example strong { color: var(--sl-accent); }

/* Comparison */
.sl-comparison { text-align: left; }
.sl-cmp-layout { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; flex: 1; align-items: start; }
.sl-cmp-col { background: color-mix(in srgb, var(--sl-primary) 5%, var(--sl-slide-bg)); border: 1px solid var(--sl-border); border-radius: 10px; padding: 1rem 1.2rem; }
.sl-cmp-col-title { font-size: var(--sl-label-size, 0.85em); font-weight: 700; color: var(--sl-primary); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--sl-border); }
.sl-cmp-vs { display: flex; align-items: center; font-weight: 900; font-size: 1.2em; color: var(--sl-muted); padding: 0 0.5rem; }

/* Image */
.sl-image-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.sl-image-wrap img { max-width: 100%; max-height: 60vh; border-radius: 8px; object-fit: contain; }
.sl-image-caption { font-size: var(--sl-note-size, 0.8em); color: var(--sl-muted); font-style: italic; text-align: center; }

/* Quote */
.sl-quote { text-align: center; align-items: center; }
.sl-quote blockquote { border: none; margin: 0; padding: 0; background: transparent; font-size: calc(var(--sl-text-size, 22px) * 1.2); font-style: italic; color: var(--sl-heading); line-height: 1.5; }
.sl-quote blockquote::before { content: '"'; font-size: 4em; color: var(--sl-primary); line-height: 0.5; vertical-align: -0.4em; opacity: 0.4; }
.sl-quote-author { margin-top: 1.5rem; font-size: var(--sl-note-size, 0.9em); color: var(--sl-primary); font-weight: 600; }
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
.sl-code-terminal { width:100%;height:100%;background:#020617;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #334155; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03); }
.sl-code-tbar { background:#0b1220;display:flex;align-items:center;padding:0 12px;height:34px;gap:6px;flex-shrink:0;border-bottom:1px solid #334155; }
.sl-code-dot { width:11px;height:11px;border-radius:50%;flex-shrink:0; }
.sl-code-dot-r{background:#ff5f57}.sl-code-dot-y{background:#febc2e}.sl-code-dot-g{background:#28c840}
.sl-code-tbar-lang { margin-left:auto;font-size:var(--sl-code-lang-size,10px);color:#cbd5e1;font-family:var(--sl-font-mono,monospace);letter-spacing:0.04em; }
.sl-code-scroll { flex:1;overflow:auto;display:flex;min-height:0;position:relative; }
.sl-code-gutter { padding:0.65rem 0.6rem 0.65rem 0.85rem;color:#94a3b8;font-size:var(--sl-code-gutter-size,13px);line-height:var(--sl-code-line-height,1.58);user-select:none;text-align:right;font-family:var(--sl-font-mono,monospace);white-space:pre;border-right:1px solid #334155;min-width:2.2em;flex-shrink:0;background:#0b1220; }
.sl-code-scroll pre { flex:1;margin:0;padding:0.65rem 1rem;background:transparent!important;overflow:visible;min-width:0;border:none!important; }
.sl-code-scroll pre code { font-family:var(--sl-font-mono,monospace);font-size:var(--sl-code-font-size,13px);line-height:var(--sl-code-line-height,1.58);color:#f8fafc;background:transparent!important;white-space:pre;display:block;padding:0!important;text-shadow:0 1px 0 rgba(0,0,0,0.35); }
/* Reveal.js highlight plugin: line-number table wrapper */
.sl-code-scroll .hljs-ln { width:100%; }
.sl-code-scroll .hljs-ln td { padding:0 4px; vertical-align:top; line-height:var(--sl-code-line-height,1.58); }
.sl-code-scroll .hljs-ln-numbers { user-select:none; color:#94a3b8; text-align:right; width:2.2em; padding-right:0.6rem; border-right:1px solid #334155; }
.reveal .sl-code-scroll pre { margin:0!important; }
.reveal .sl-code-scroll table { border-collapse:collapse; }
/* Reveal.js clones <code> as .fragment children of <pre> for each highlight step.
   Fragments use opacity:0/visibility:hidden (still in flow) which causes ghost stacking.
   Fix: overlay fragment codes on top of the first one via absolute positioning. */
.sl-code-scroll pre.code-wrapper { position:relative; }
.sl-code-scroll pre.code-wrapper > code.fragment { position:absolute; top:0; left:0; width:100%; height:100%; background:#020617!important; }
.sl-code-scroll .highlight-line { background:rgba(248,250,252,0.16); }

/* Highlight element – terminal-like wrapper that is fully compatible with Reveal.js
   fragment cloning for data-line-numbers step-through animation.
   Unlike sl-code-terminal, this does NOT use flex layout on the code area. */
.sl-highlight-block { width:100%;height:100%;background:#020617;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;border:1px solid #334155; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03); }
.sl-highlight-block .sl-code-tbar { border-bottom:1px solid #334155; }
.sl-highlight-block pre { flex:1;margin:0!important;padding:0!important;background:#020617!important;box-shadow:none!important;width:100%!important;border:none!important;position:relative;overflow:hidden; }
.sl-highlight-block pre code { font-family:var(--sl-font-mono,monospace)!important;font-size:var(--sl-code-font-size,13px)!important;line-height:var(--sl-code-line-height,1.58)!important;color:#f8fafc!important;padding:0.65rem 1rem!important;background:#020617!important;max-height:none!important;overflow:visible!important;text-align:left!important;text-shadow:0 1px 0 rgba(0,0,0,0.35); }
.sl-highlight-block pre.code-wrapper > code.fragment { position:absolute;top:0;left:0;width:100%;height:100%;background:#020617!important;box-sizing:border-box; }
.sl-highlight-block .hljs-ln { width:100%;border-collapse:collapse; }
.sl-highlight-block .hljs-ln td { padding:0 4px;vertical-align:top;line-height:var(--sl-code-line-height,1.58); }
.sl-highlight-block .hljs-ln-numbers { user-select:none;color:#94a3b8;text-align:right;width:2.2em;padding-right:0.6rem;border-right:1px solid #334155;font-size:var(--sl-code-gutter-size,13px); }
.sl-highlight-block .highlight-line { background:rgba(248,250,252,0.16); }
.sl-highlight-block .has-highlights tr:not(.highlight-line) { opacity:1; }
.sl-highlight-block .has-highlights .highlight-line .hljs-ln-numbers { color:#e2e8f0; }
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
.sl-quiz-title { margin-bottom:1.5rem; font-size:var(--sl-quiz-title-size,1.6em); line-height:1.25; }
.sl-quiz-question-icon { margin-bottom:0.5rem;opacity:0.55;display:inline-flex;align-items:center;justify-content:center;color:var(--sl-primary,#818cf8); }
.sl-quiz-options { display:flex;flex-direction:column;gap:0.75rem;width:80%;max-width:700px; }
.sl-quiz-options.sl-quiz-tf { flex-direction:row;gap:1.5rem;justify-content:center; }
.sl-quiz-option { display:flex;align-items:center;gap:1rem;padding:0.9rem 1.3rem;border-radius:10px;background:color-mix(in srgb,var(--sl-primary) 8%,var(--sl-slide-bg));border:2px solid color-mix(in srgb,var(--sl-primary) 20%,transparent);font-size:var(--sl-quiz-option-size,1.1em);color:var(--sl-text);transition:border-color .3s,background .3s,transform .15s;cursor:pointer;user-select:none; line-height:1.4; }
.sl-quiz-option:hover { border-color:var(--sl-primary);background:color-mix(in srgb,var(--sl-primary) 15%,var(--sl-slide-bg));transform:translateX(4px); }
.sl-quiz-option.sl-quiz-correct { border-color:var(--sl-success,#4ade80)!important;background:color-mix(in srgb,var(--sl-success,#4ade80) 15%,var(--sl-slide-bg))!important; }
.sl-quiz-option.sl-quiz-correct .sl-quiz-marker { background:var(--sl-success,#4ade80); }
.sl-quiz-option.sl-quiz-wrong { border-color:#f87171!important;background:color-mix(in srgb,#f87171 10%,var(--sl-slide-bg))!important;opacity:0.6; }
.sl-quiz-option.sl-quiz-wrong .sl-quiz-marker { background:#f87171; }
.sl-quiz-tf .sl-quiz-option { flex:1;justify-content:center;font-size:calc(var(--sl-quiz-option-size,1.1em) * 1.18);padding:1.2rem; }
.sl-quiz-marker { display:flex;align-items:center;justify-content:center;width:var(--sl-quiz-marker-size,2rem);height:var(--sl-quiz-marker-size,2rem);border-radius:50%;background:var(--sl-primary);color:var(--sl-slide-bg);font-weight:700;font-size:calc(var(--sl-quiz-option-size,1.1em) * 0.62);flex-shrink:0;transition:background .3s; }
.sl-quiz-explanation { margin-top:1.5rem;padding:1rem 1.5rem;border-radius:8px;background:color-mix(in srgb,var(--sl-success) 10%,var(--sl-slide-bg));border-left:4px solid var(--sl-success);color:var(--sl-text);font-size:var(--sl-note-size,0.95em);max-width:700px;text-align:left;line-height:1.5; }
.sl-quiz-open { width:80%;max-width:700px; }
.sl-quiz-open-placeholder { padding:1.5rem;border-radius:10px;font-size:var(--sl-quiz-option-size,1.1em);border:2px dashed color-mix(in srgb,var(--sl-muted) 40%,transparent);color:var(--sl-muted);text-align:center; }
.sl-quiz-answer-count { margin-top:0.8rem;font-size:var(--sl-quiz-meta-size,0.75em);color:var(--sl-muted);opacity:0.75; }
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
