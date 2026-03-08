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
