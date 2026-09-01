// @ts-check

/**
 * Apply text + tone class to a status element.
 * @param {HTMLElement | null} el
 * @param {string} baseClass
 * @param {string} text
 * @param {string} tone
 */
export function applyStatusState(el, baseClass, text, tone = '') {
    if (!el) return;
    el.textContent = String(text || '');
    el.className = `${baseClass} ${String(tone || '').trim()}`.trim();
}

const REACTION_EMOJI = ['👍', '😕', '❓', '🎉', '👏', '🤔', '🔥'];

/**
 * Fait flotter une réaction emoji au-dessus de la scène présentateur.
 * Construction 100 % DOM (pas d'innerHTML).
 * @param {string} emoji
 * @param {string} [pseudo]
 * @param {{ documentRef?: Document }} [opts]
 */
export function showFloatingReaction(emoji, pseudo, opts = {}) {
    const doc = opts.documentRef || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.body) return;
    const safe = REACTION_EMOJI.includes(emoji) ? emoji : '❓';
    const el = doc.createElement('div');
    el.className = 'sl-reaction';
    el.style.left = `${10 + Math.random() * 80}vw`;
    el.textContent = safe;
    if (pseudo) {
        const label = doc.createElement('div');
        label.className = 'sl-reaction-label';
        label.textContent = String(pseudo).slice(0, 12);
        el.appendChild(label);
    }
    doc.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}
