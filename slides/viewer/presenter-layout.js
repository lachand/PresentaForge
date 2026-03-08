// @ts-check

/**
 * Clamp a numeric value in range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
