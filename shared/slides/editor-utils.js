/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-utils
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-utils.js"></script>
 */
/* editor-utils.js — Utility functions for slide editor */

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

function notify(msg, type = '') {
    const icons = { success: '✓', error: '✕', warning: '⚠' };
    const el = document.createElement('div');
    el.className = `notif-item ${type}`;
    el.innerHTML = type && icons[type] ? `<span class="notif-icon">${icons[type]}</span>${esc(msg)}` : esc(msg);
    document.getElementById('notif').appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function colorToHex(color) {
    if (!color) return '#000000';
    // 6-digit hex
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    // 3-digit hex → 6-digit
    if (/^#[0-9a-f]{3}$/i.test(color)) {
        return '#' + color[1]+color[1] + color[2]+color[2] + color[3]+color[3];
    }
    // 8-digit hex (with alpha) → 6-digit
    if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(0, 7);
    // rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Number(c))).toString(16).padStart(2, '0')).join('');
    }
    // hsl(h, s%, l%) or hsla(h, s%, l%, a)
    const hslMatch = color.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
    if (hslMatch) {
        let [, h, s, l] = hslMatch.map(Number);
        s /= 100; l /= 100;
        const a2 = s * Math.min(l, 1 - l);
        const f = n => { const k = (n + h / 30) % 12; return l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
        return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    }
    // CSS named colors (common subset)
    const named = {
        white:'#ffffff', black:'#000000', red:'#ff0000', green:'#008000', blue:'#0000ff',
        yellow:'#ffff00', cyan:'#00ffff', magenta:'#ff00ff', orange:'#ffa500', purple:'#800080',
        gray:'#808080', grey:'#808080', pink:'#ffc0cb', brown:'#a52a2a', navy:'#000080',
        teal:'#008080', lime:'#00ff00', aqua:'#00ffff', maroon:'#800000', olive:'#808000',
        silver:'#c0c0c0', coral:'#ff7f50', salmon:'#fa8072', gold:'#ffd700', indigo:'#4b0082',
        violet:'#ee82ee', khaki:'#f0e68c', crimson:'#dc143c', turquoise:'#40e0d0',
        transparent:'#000000',
    };
    const lower = color.toLowerCase().trim();
    if (named[lower]) return named[lower];
    // CSS var() — can't resolve, use fallback
    const varMatch = color.match(/var\([^,]+,\s*([^)]+)\)/);
    if (varMatch) return colorToHex(varMatch[1].trim());
    return '#818cf8';
}
