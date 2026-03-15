// @ts-check

const EMPTY_BY_FILTER = Object.freeze({
    open: 'Aucune question ouverte.',
    pinned: 'Aucune question épinglée.',
    resolved: 'Aucune question résolue.',
    hidden: 'Aucune question masquée.',
    all: 'Aucune question.',
});

/**
 * @param {string} filter
 * @returns {string}
 */
export function getQuestionEmptyLabel(filter) {
    const key = String(filter || '').trim().toLowerCase();
    return EMPTY_BY_FILTER[key] || EMPTY_BY_FILTER.all;
}

/**
 * @param {number} nowTs
 * @param {number} eventTs
 * @returns {string}
 */
export function formatQuestionAgeLabel(nowTs, eventTs) {
    const ago = Math.max(0, Math.round((Number(nowTs) - Number(eventTs || 0)) / 1000));
    return ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}min`;
}

/**
 * @param {{ pinned?: boolean, resolved?: boolean, hidden?: boolean }} question
 * @returns {string}
 */
export function buildQuestionRowClass(question) {
    const q = question && typeof question === 'object' ? question : {};
    return `rm-question-row${q.pinned ? ' pinned' : ''}${q.resolved ? ' resolved' : ''}${q.hidden ? ' hidden' : ''}`;
}

/**
 * @param {any} question
 * @returns {boolean}
 */
export function toggleQuestionHidden(question) {
    if (!question || typeof question !== 'object') return false;
    question.hidden = !question.hidden;
    if (question.hidden) {
        question.pinned = false;
        question.resolved = false;
    }
    return true;
}

/**
 * @param {any} question
 * @returns {boolean}
 */
export function toggleQuestionPinned(question) {
    if (!question || typeof question !== 'object' || question.hidden) return false;
    question.pinned = !question.pinned;
    return true;
}

/**
 * @param {any} question
 * @returns {boolean}
 */
export function toggleQuestionResolved(question) {
    if (!question || typeof question !== 'object' || question.hidden) return false;
    question.resolved = !question.resolved;
    if (question.resolved) question.pinned = false;
    return true;
}

/**
 * @param {any} question
 * @returns {boolean}
 */
export function archiveQuestion(question) {
    if (!question || typeof question !== 'object') return false;
    question.read = true;
    return true;
}

/**
 * @param {any[]} questions
 * @returns {number}
 */
export function markAllQuestionsHidden(questions) {
    if (!Array.isArray(questions)) return 0;
    let updated = 0;
    questions.forEach((question) => {
        if (!question || typeof question !== 'object' || question.read) return;
        question.hidden = true;
        question.pinned = false;
        question.resolved = false;
        updated += 1;
    });
    return updated;
}
