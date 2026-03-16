// @ts-check
/**
 * slides-typography.js — Lot 17B
 * Typography system + Tone system extraits de SlidesShared (slides-core.js).
 * Aucune dépendance externe.
 * Doit être chargé avant slides-core.js (utilisé par SlidesShared.resolveTypographyDefaults).
 */
(function(global) {
    'use strict';

    /** Helper local d'échappement HTML */
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const DEFAULT_TYPOGRAPHY = Object.freeze({ heading: 52, text: 22 });
    const FONT_BASE_MAP = Object.freeze({
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

    function resolveTypographyDefaults(raw = null) {
        const source = raw && typeof raw === 'object' ? raw : {};
        const heading = Number(source.heading);
        const text = Number(source.text);
        return {
            heading: Number.isFinite(heading)
                ? Math.max(12, Math.min(160, Math.round(heading)))
                : DEFAULT_TYPOGRAPHY.heading,
            text: Number.isFinite(text)
                ? Math.max(10, Math.min(120, Math.round(text)))
                : DEFAULT_TYPOGRAPHY.text,
        };
    }

    function resolveElementFontSize(type = '', style = {}, typography = null, fallback = 16) {
        const raw = style?.fontSize;
        const explicit = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
        if (Number.isFinite(explicit)) return Math.max(8, explicit);
        const t = resolveTypographyDefaults(typography);
        const map = FONT_BASE_MAP[type];
        if (map) {
            const source = map.source === 'heading' ? t.heading : t.text;
            return Math.max(8, Math.round(source * map.ratio));
        }
        const fb = Number(fallback);
        return Number.isFinite(fb) ? Math.max(8, Math.round(fb)) : t.text;
    }

    function resolveCodeLineHeight(fontSizePx, fallback = 1.58) {
        const n = Number(fontSizePx);
        if (!Number.isFinite(n)) return fallback;
        const size = Math.max(8, Math.min(96, n));
        const computed = 1.44 + ((size - 12) / 120);
        return Math.round(Math.max(1.45, Math.min(1.78, computed)) * 100) / 100;
    }

    /* ── Tone system ── */

    const LABEL_TONE_HINTS = Object.freeze({
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

    function normalizeLabelToken(value = '') {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function normalizeTone(value = '') {
        const tone = String(value || '').trim().toLowerCase();
        if (['primary', 'accent', 'info', 'success', 'warning', 'danger'].includes(tone)) return tone;
        return 'auto';
    }

    function resolveTone(rawTone = '', label = '') {
        const tone = normalizeTone(rawTone);
        if (tone !== 'auto') return tone;
        const token = normalizeLabelToken(label);
        return LABEL_TONE_HINTS[token] || 'primary';
    }

    function tonePalette(rawTone = '', label = '') {
        const tone = resolveTone(rawTone, label);
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

    global.OEISlidesTypography = Object.freeze({
        DEFAULT_TYPOGRAPHY,
        FONT_BASE_MAP,
        resolveTypographyDefaults,
        resolveElementFontSize,
        resolveCodeLineHeight,
        LABEL_TONE_HINTS,
        normalizeLabelToken,
        normalizeTone,
        resolveTone,
        tonePalette,
    });
})(window);
