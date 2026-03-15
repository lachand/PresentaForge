// @ts-check

const _emptyIcon = () => '';

/**
 * @param {any} value
 * @returns {string}
 */
function escHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {{ roomActive: boolean, relayActive: boolean }} params
 * @returns {string}
 */
export function buildPresenterModeLabel({ roomActive, relayActive }) {
    if (!roomActive) return 'Salle fermée';
    return relayActive ? 'P2P + relay' : 'P2P';
}

/**
 * @param {{
 *   roomActive: boolean,
 *   relayActive: boolean,
 *   studentsCount: number,
 *   handsCount: number,
 *   questionsCount: number,
 *   feedbackUrgentCount: number,
 *   remoteSessions: number,
 *   currentView: string,
 * }} params
 * @returns {{
 *   modeLabel: string,
 *   activeView: string,
 *   views: Array<{ id: string, cls: string, icon: string, text: string }>,
 * }}
 */
export function buildPresenterMiniViews(params) {
    const modeLabel = buildPresenterModeLabel({
        roomActive: !!params?.roomActive,
        relayActive: !!params?.relayActive,
    });
    const studentsCount = Math.max(0, Number(params?.studentsCount) || 0);
    const handsCount = Math.max(0, Number(params?.handsCount) || 0);
    const questionsCount = Math.max(0, Number(params?.questionsCount) || 0);
    const feedbackUrgentCount = Math.max(0, Number(params?.feedbackUrgentCount) || 0);
    const remoteSessions = Math.max(0, Number(params?.remoteSessions) || 0);
    const views = [
        {
            id: 'status',
            cls: !!params?.roomActive ? 'ok' : '',
            icon: !!params?.roomActive ? 'check' : 'stop',
            text: modeLabel,
        },
        { id: 'users', cls: '', icon: 'users', text: String(studentsCount) },
        { id: 'hands', cls: '', icon: 'hand', text: String(handsCount) },
        { id: 'questions', cls: '', icon: 'question', text: String(questionsCount) },
    ];
    if (feedbackUrgentCount > 0) {
        views.push({ id: 'urgent', cls: 'warn', icon: 'feedback_unclear', text: String(feedbackUrgentCount) });
    }
    if (remoteSessions > 0) {
        views.push({ id: 'remote', cls: '', icon: 'remote', text: String(remoteSessions) });
    }
    const requested = String(params?.currentView || '').trim();
    const activeView = views.some((view) => view.id === requested) ? requested : 'status';
    return { modeLabel, activeView, views };
}

/**
 * @param {{
 *   views: Array<{ id: string, cls: string, icon: string, text: string }>,
 *   activeView: string,
 *   iconOnly?: (iconKey: string) => string,
 * }} params
 * @returns {string}
 */
export function renderPresenterRoomMiniHtml(params) {
    const iconOnly = typeof params?.iconOnly === 'function' ? params.iconOnly : _emptyIcon;
    const activeView = String(params?.activeView || 'status');
    const views = Array.isArray(params?.views) ? params.views : [];
    return views.map((view) => (
        `<button type="button" class="pv-room-mini-pill ${escHtml(view.cls || '')} ${activeView === view.id ? 'active' : ''}" data-pv-view="${escHtml(view.id)}">${iconOnly(view.icon || '')}<span>${escHtml(view.text || '')}</span></button>`
    )).join('');
}

/**
 * @param {{
 *   roomActive: boolean,
 *   modeLabel: string,
 *   studentsCount: number,
 *   handsCount: number,
 *   questionsCount: number,
 *   telemetryStaleCount: number,
 *   feedbackUrgentCount: number,
 *   remoteSessions: number,
 *   iconOnly?: (iconKey: string) => string,
 * }} params
 * @returns {string}
 */
export function renderPresenterRoomStatusBarHtml(params) {
    const iconOnly = typeof params?.iconOnly === 'function' ? params.iconOnly : _emptyIcon;
    const roomActive = !!params?.roomActive;
    const modeLabel = String(params?.modeLabel || buildPresenterModeLabel({ roomActive, relayActive: false }));
    const studentsCount = Math.max(0, Number(params?.studentsCount) || 0);
    const handsCount = Math.max(0, Number(params?.handsCount) || 0);
    const questionsCount = Math.max(0, Number(params?.questionsCount) || 0);
    const telemetryStaleCount = Math.max(0, Number(params?.telemetryStaleCount) || 0);
    const feedbackUrgentCount = Math.max(0, Number(params?.feedbackUrgentCount) || 0);
    const remoteSessions = Math.max(0, Number(params?.remoteSessions) || 0);
    const urgentLabel = feedbackUrgentCount > 0
        ? `<span class="pv-room-status-pill warn">${iconOnly('feedback_unclear')}<span>${feedbackUrgentCount} urgent</span></span>`
        : '';
    const remoteLabel = remoteSessions > 0
        ? `<span class="pv-room-status-pill">${iconOnly('remote')}<span>${remoteSessions} mobile</span></span>`
        : '';
    const telemetryLabel = telemetryStaleCount > 0
        ? `<span class="pv-room-status-pill warn">${iconOnly('question')}<span>${telemetryStaleCount} stale</span></span>`
        : '';
    return `<span class="pv-room-status-pill ${roomActive ? 'ok' : ''}">${iconOnly(roomActive ? 'check' : 'stop')}<span>${escHtml(modeLabel)}</span></span>
        <span class="pv-room-status-pill">${iconOnly('users')}<span>${studentsCount}</span></span>
        <span class="pv-room-status-pill">${iconOnly('hand')}<span>${handsCount}</span></span>
        <span class="pv-room-status-pill">${iconOnly('question')}<span>${questionsCount}</span></span>
        ${telemetryLabel}
        ${urgentLabel}
        ${remoteLabel}`;
}

/**
 * @param {{
 *   view: string,
 *   modeLabel: string,
 *   roomId: string,
 *   studentsCount: number,
 *   handsCount: number,
 *   questionsCount: number,
 *   feedbackUrgentCount: number,
 *   remoteSessions: number,
 *   students: string[],
 *   hands: string[],
 *   openQuestions: string[],
 *   stableUrl: string,
 *   iconOnly?: (iconKey: string) => string,
 * }} params
 * @returns {string}
 */
export function renderPresenterContextDynamicHtml(params) {
    const iconOnly = typeof params?.iconOnly === 'function' ? params.iconOnly : _emptyIcon;
    const view = String(params?.view || 'status').trim() || 'status';
    const modeLabel = String(params?.modeLabel || 'Salle fermée');
    const roomId = String(params?.roomId || '—') || '—';
    const studentsCount = Math.max(0, Number(params?.studentsCount) || 0);
    const handsCount = Math.max(0, Number(params?.handsCount) || 0);
    const questionsCount = Math.max(0, Number(params?.questionsCount) || 0);
    const feedbackUrgentCount = Math.max(0, Number(params?.feedbackUrgentCount) || 0);
    const remoteSessions = Math.max(0, Number(params?.remoteSessions) || 0);
    const students = Array.isArray(params?.students) ? params.students : [];
    const hands = Array.isArray(params?.hands) ? params.hands : [];
    const openQuestions = Array.isArray(params?.openQuestions) ? params.openQuestions : [];
    const stableUrl = String(params?.stableUrl || '');

    const renderList = (items, emptyLabel) => (
        items.length
            ? `<ul class="pv-context-dynamic-list">${items.map((item) => `<li>${escHtml(item)}</li>`).join('')}</ul>`
            : `<div class="pv-context-dynamic-meta">${emptyLabel}</div>`
    );

    if (view === 'users') {
        return `<div class="pv-context-dynamic-row"><strong>Connectés: ${studentsCount}</strong><span class="pv-context-dynamic-meta">${escHtml(modeLabel)}</span></div>${renderList(students, 'Aucun étudiant connecté.')}`;
    }
    if (view === 'hands') {
        return `<div class="pv-context-dynamic-row"><strong>Mains levées: ${handsCount}</strong><span class="pv-context-dynamic-meta">interventions</span></div>${renderList(hands, 'Aucune main levée.')}`;
    }
    if (view === 'questions') {
        return `<div class="pv-context-dynamic-row"><strong>Questions ouvertes: ${questionsCount}</strong><span class="pv-context-dynamic-meta">modération</span></div>${renderList(openQuestions, 'Aucune question ouverte.')}`;
    }
    if (view === 'urgent') {
        return `<div class="pv-context-dynamic-row"><strong>Alertes urgentes: ${feedbackUrgentCount}</strong><span class="pv-context-dynamic-meta">2 dernières minutes</span></div><div class="pv-context-dynamic-meta">Feedback rapide/non clair/pause.</div>`;
    }
    if (view === 'remote') {
        return `<div class="pv-context-dynamic-row"><strong>Mobiles actifs: ${remoteSessions}</strong><span class="pv-context-dynamic-meta">sessions contrôleur</span></div><div class="pv-context-dynamic-meta">Gestion complète dans Salle > Technique.</div>`;
    }
    return `<div class="pv-context-dynamic-row"><strong>${escHtml(modeLabel)}</strong><span class="pv-context-dynamic-meta">ID: ${escHtml(roomId)}</span></div>
        <div class="pv-context-dynamic-row">
            <button class="pv-context-action-btn" id="pv-context-copy-stable" ${stableUrl ? '' : 'disabled'}>${iconOnly('copy')}<span>Copier lien stable</span></button>
            <button class="pv-context-action-btn" id="pv-context-open-technique">${iconOnly('settings')}<span>Salle technique</span></button>
        </div>`;
}
