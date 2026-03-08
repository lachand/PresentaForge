// @ts-check
/**
 * @param {HTMLElement | null | undefined} node
 */
export function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * @param {string} tag
 * @param {{ className?: string, text?: string }=} opts
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.text !== undefined) node.textContent = opts.text;
    return node;
}

/**
 * @param {HTMLElement | null | undefined} parent
 * @param {Array<HTMLElement | null | undefined>} children
 */
export function appendAll(parent, children) {
    if (!parent) return;
    children.forEach(child => { if (child) parent.appendChild(child); });
}
