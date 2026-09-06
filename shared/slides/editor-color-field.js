/**
 * editor-color-field.js — champ couleur « conscient du thème ».
 *
 * Un `<input type="color">` (affichage seul, alimenté par `colorToHex`) doublé
 * d'une rangée de pastilles de jetons `var(--sl-*)`. Cliquer une pastille stocke
 * la chaîne `var(--sl-x)` **telle quelle** — le lien au thème n'est jamais figé
 * en hexadécimal (contrairement à un `<input type=color>` seul).
 *
 * Chargé après editor-utils.js (dépend de `window.colorToHex`).
 */
(function (global) {
    'use strict';

    const TOKENS = [
        { v: 'var(--sl-primary)', label: 'Primaire', hex: '#4a7cff' },
        { v: 'var(--sl-accent)', label: 'Accent', hex: '#f59e0b' },
        { v: 'var(--sl-heading)', label: 'Titre', hex: '#f1f5f9' },
        { v: 'var(--sl-text)', label: 'Texte', hex: '#cbd5e1' },
        { v: 'var(--sl-muted)', label: 'Discret', hex: '#64748b' },
        { v: 'var(--sl-slide-bg)', label: 'Fond slide', hex: '#141620' },
        { v: 'var(--sl-border)', label: 'Bordure', hex: '#2d3347' },
        { v: 'var(--sl-success)', label: 'Succès', hex: '#34d399' },
        { v: 'var(--sl-warning)', label: 'Attention', hex: '#f59e0b' },
    ];

    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const toHex = v => {
        try { return (global.colorToHex ? global.colorToHex(v) : v) || '#818cf8'; }
        catch (_) { return '#818cf8'; }
    };

    /**
     * Valeur calculée réelle d'un jeton `var(--sl-x)` (thème injecté en :root par
     * l'éditeur) ; repli sur `fallbackHex` en contexte no-DOM / avant injection.
     */
    function resolveTokenColor(varExpr, fallbackHex) {
        try {
            const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(String(varExpr || ''));
            if (m && typeof getComputedStyle === 'function' && typeof document !== 'undefined') {
                const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
                if (v) return v;
            }
        } catch (_) { /* sandbox */ }
        return fallbackHex;
    }

    /**
     * @param {{ key:string, value:any }} opts
     * @returns {string} HTML — input natif + pastilles jetons + reset. Le champ utilise
     *   `data-el-style="<key>"` (input) et `data-cf-token="<key>"` (pastilles).
     */
    function renderColorField({ key, value }) {
        const raw = value != null && value !== '' ? String(value) : '';
        const isToken = /^var\(/.test(raw);
        const swatches = TOKENS.map(t => {
            const real = resolveTokenColor(t.v, t.hex);
            return `<button type="button" class="cf-token${raw === t.v ? ' active' : ''}" data-cf-token="${esc(key)}" data-cf-value="${esc(t.v)}" title="${esc(t.label)} — ${esc(t.v)}" style="width:16px;height:16px;border-radius:4px;border:1px solid var(--border);background:${esc(real)};cursor:pointer;padding:0;flex:0 0 auto"></button>`;
        }).join('');
        // Aperçu du champ natif : couleur RÉELLE quand la valeur est un jeton de thème.
        const seedHex = isToken ? toHex(resolveTokenColor(raw, '#818cf8')) : toHex(raw || '#818cf8');
        return `<div class="cf-wrap" style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:4px">
                <input type="color" data-el-style="${esc(key)}" value="${esc(seedHex)}"
                    style="width:34px;height:24px;padding:0;border:1px solid var(--border);border-radius:4px;background:none">
                <span style="font-size:0.6rem;color:var(--muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isToken ? esc(raw) : ''}</span>
                <button type="button" class="cf-clear" data-cf-clear="${esc(key)}" title="Réinitialiser" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem">↺</button>
            </div>
            <div style="display:flex;gap:3px;flex-wrap:wrap">${swatches}</div>
        </div>`;
    }

    /**
     * Attache les écouteurs pour tous les champs couleur d'un conteneur.
     * @param {HTMLElement} container
     * @param {(key:string, value:any)=>void} onChange — `value` peut être un `#hex` ou un `var(--sl-x)` ; `undefined` = reset.
     */
    function bindColorField(container, onChange) {
        if (!container) return;
        container.querySelectorAll('input[type="color"][data-el-style]').forEach(inp => {
            inp.addEventListener('input', () => onChange(inp.dataset.elStyle, inp.value));
        });
        container.querySelectorAll('[data-cf-token]').forEach(btn => {
            btn.addEventListener('click', () => onChange(btn.dataset.cfToken, btn.dataset.cfValue));
        });
        container.querySelectorAll('[data-cf-clear]').forEach(btn => {
            btn.addEventListener('click', () => onChange(btn.dataset.cfClear, undefined));
        });
    }

    global.OEIColorField = Object.freeze({ TOKENS, renderColorField, bindColorField, resolveTokenColor });
})(window);
