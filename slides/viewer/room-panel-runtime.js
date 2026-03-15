// @ts-check

/**
 * Update room modal/presenter panel UI from runtime state.
 * @param {Record<string, any>} context
 * @returns {{ _pvContextView: string }}
 */
export function updateRoomPanelRuntime(context = {}) {
    const {
        _room = { active: false, students: {}, connections: [] },
        _relayRoom = { active: false },
        _roomHands = [],
        _roomQuestions = [],
        _roomQuestionFilter = 'open',
        _roomFeedback = { events: [] },
        _activePoll = null,
        _activeWordCloud = null,
        _pvContextView: initialContextView = 'status',
        ROOM_MSG = {},
        UI_ICONS = {},
        clearNode,
        el,
        appendAll,
        clearRaisedHandForPeer,
        toggleQuestionHidden,
        archiveQuestion,
        toggleQuestionPinned,
        toggleQuestionResolved,
        buildQuestionRowClass,
        formatQuestionAgeLabel,
        getQuestionEmptyLabel,
        renderPollResultsHtml,
        summarizeWordCloud,
        formatWordCloudCountLabel,
        roomFeedbackMeta,
        renderFeedbackSummaryHtml,
        renderFeedbackListHtml,
        roomQuestionStats,
        roomTelemetryStats,
        roomFeedbackStats,
        roomFilteredQuestions,
        roomStudentTelemetryLabel,
        _roomBridgeSnapshotPoll,
        _roomBridgeSnapshotRoom,
        _roomBridgeEmit,
        _remoteActiveSessionsCount,
        _remoteUpdateUI,
        roomAudienceQrUrl,
        roomUpdateQrButtonsUI,
        roomUpdateNetworkDiagnostics,
        buildPresenterMiniViews,
        renderPresenterRoomStatusBarHtml,
        renderPresenterRoomMiniHtml,
        renderPresenterContextDynamicHtml,
        iconOnly,
        withIcon,
        _roomEsc,
        toTrimmedString,
        switchRoomPresenterMode,
        onRoomUpdatePanel,
    } = context;

    let _pvContextView = String(initialContextView || 'status');
    const students = Object.values(_room.students);
    const n = students.length;
    const handsN = _roomHands.length;
    const qStats = roomQuestionStats();
    const questionsN = qStats.open;
    const telemetryStats = roomTelemetryStats();
    const feedbackStats10m = roomFeedbackStats(10 * 60 * 1000);
    const feedbackStats2m = roomFeedbackStats(2 * 60 * 1000);
    const feedbackUrgentN = feedbackStats2m.counts.fast + feedbackStats2m.counts.unclear + feedbackStats2m.counts.pause;

    // Mise à jour badges tabs
    const setCnt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setCnt('rm-cnt-students', n);
    setCnt('rm-cnt-hands', handsN);
    setCnt('rm-cnt-questions', questionsN);

    // Tabs visibles uniquement si salle active
    const tabs = document.getElementById('rm-tabs');
    if (tabs) tabs.style.display = _room.active ? '' : 'none';

    // ── Onglet Étudiants ─────────────────────────────
    const studentsEl = document.getElementById('sl-room-students');
    if (studentsEl) {
        clearNode(studentsEl);
        if (n === 0) {
            studentsEl.appendChild(el('span', { className: 'rm-empty-text', text: 'En attente d\'étudiants…' }));
        } else {
            const sorted = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));
            const hasScores = sorted.some(s => s.score > 0);
            const medals = ['🥇','🥈','🥉'];
            const summary = el('div', { className: 'rm-students-summary' });
            const dot = el('span');
            dot.innerHTML = UI_ICONS.dot;
            summary.appendChild(dot);
            summary.appendChild(document.createTextNode(`${n} étudiant(s) connecté(s)`));

            const list = el('div', { className: 'rm-student-list' });
            sorted.forEach((s, i) => {
                const medal = medals[i] || `${i+1}.`;
                const row = el('div', { className: 'rm-student-row' });
                row.appendChild(el('span', { className: 'rm-student-rank', text: medal }));
                const name = el('span', { className: 'rm-student-name' });
                if (s.handRaised) {
                    const hand = el('span', { className: 'rm-hand-mark' });
                    hand.innerHTML = UI_ICONS.hand;
                    name.appendChild(hand);
                }
                name.appendChild(document.createTextNode(String(s.pseudo || 'Anonyme')));
                row.appendChild(name);
                const telemetryLabel = roomStudentTelemetryLabel(s);
                const rightParts = [];
                if (hasScores) rightParts.push(`${(s.score || 0).toLocaleString()} pts`);
                if (telemetryLabel) rightParts.push(telemetryLabel);
                if (rightParts.length) row.appendChild(el('span', { className: 'rm-student-score', text: rightParts.join(' · ') }));
                list.appendChild(row);
            });
            appendAll(studentsEl, [summary, list]);
        }
    }

    // ── Onglet Mains ─────────────────────────────────
    const handsList = document.getElementById('rm-hands-list');
    const lowerAll = document.getElementById('rm-lower-all');
    if (handsList) {
        clearNode(handsList);
        if (handsN === 0) {
            handsList.appendChild(el('span', { className: 'rm-empty-text', text: 'Aucune main levée.' }));
        } else {
            _roomHands.forEach(h => {
                const row = el('div', { className: 'rm-hand-row' });
                const handIcon = el('span', { className: 'rm-hand-icon' });
                handIcon.innerHTML = UI_ICONS.hand;
                const name = el('span', { className: 'rm-student-name', text: String(h.pseudo || 'Anonyme') });
                const btn = el('button', { className: 'rm-lower-btn', text: 'Baisser' });
                btn.dataset.peer = h.peerId;
                appendAll(row, [handIcon, name, btn]);
                handsList.appendChild(row);
            });
            handsList.querySelectorAll('.rm-lower-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const peerId = btn.dataset.peer;
                    const conn = _room.connections.find(c => c.peer === peerId && c.open);
                    if (conn) { try { conn.send({ type: ROOM_MSG.HAND_LOWER }); } catch(e) {} }
                    clearRaisedHandForPeer(_roomHands, _room.students, peerId);
                    onRoomUpdatePanel();
                });
            });
        }
        if (lowerAll) lowerAll.style.display = handsN > 1 ? '' : 'none';
    }

    // ── Onglet Questions ──────────────────────────────
    const questionsList = document.getElementById('rm-questions-list');
    const questionFilterEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('rm-question-filter'));
    const questionMarkAllBtn = document.getElementById('rm-question-mark-all');
    if (questionFilterEl) questionFilterEl.value = _roomQuestionFilter;
    if (questionMarkAllBtn) questionMarkAllBtn.disabled = qStats.total === 0;
    if (questionsList) {
        const visible = roomFilteredQuestions();
        clearNode(questionsList);
        if (visible.length === 0) {
            questionsList.appendChild(el('span', {
                className: 'rm-empty-text',
                text: getQuestionEmptyLabel(_roomQuestionFilter),
            }));
        } else {
            const nowTs = Date.now();
            visible.forEach(q => {
                const agoStr = formatQuestionAgeLabel(nowTs, q.time);
                const row = el('div', { className: buildQuestionRowClass(q) });
                const head = el('div', { className: 'rm-question-head' });
                const text = el('div', { className: 'rm-question-text', text: String(q.text || '') });
                const dismissBtn = el('button', { className: 'rm-question-dismiss', text: q.hidden ? 'Restaurer' : 'Masquer' });
                head.appendChild(text);
                head.appendChild(dismissBtn);
                row.appendChild(head);
                const meta = el('div', { className: 'rm-question-meta' });
                meta.appendChild(el('span', { className: 'rm-question-time', text: agoStr }));
                meta.appendChild(el('span', { className: 'rm-question-pill', text: `${q.votes || 1} vote(s)` }));
                if (q.pinned) meta.appendChild(el('span', { className: 'rm-question-pill pinned', text: 'Épinglée' }));
                if (q.resolved) meta.appendChild(el('span', { className: 'rm-question-pill resolved', text: 'Résolue' }));
                if (q.hidden) meta.appendChild(el('span', { className: 'rm-question-pill hidden', text: 'Masquée' }));
                row.appendChild(meta);

                const actions = el('div', { className: 'rm-question-actions' });
                const hideBtn = el('button', { className: `rm-question-mini${q.hidden ? ' active' : ''}`, text: q.hidden ? 'Restaurer' : 'Masquer' });
                const pinBtn = el('button', { className: `rm-question-mini${q.pinned ? ' active' : ''}`, text: q.pinned ? 'Désépingler' : 'Épingler' });
                const resolveBtn = el('button', { className: `rm-question-mini${q.resolved ? ' active' : ''}`, text: q.resolved ? 'Rouvrir' : 'Résoudre' });
                const archiveBtn = el('button', { className: 'rm-question-mini', text: 'Archiver' });
                if (q.hidden) {
                    pinBtn.disabled = true;
                    resolveBtn.disabled = true;
                }
                appendAll(actions, [hideBtn, pinBtn, resolveBtn, archiveBtn]);
                row.appendChild(actions);

                dismissBtn.addEventListener('click', () => {
                    if (toggleQuestionHidden(q)) onRoomUpdatePanel();
                });
                hideBtn.addEventListener('click', () => {
                    if (toggleQuestionHidden(q)) onRoomUpdatePanel();
                });
                archiveBtn.addEventListener('click', () => {
                    if (archiveQuestion(q)) onRoomUpdatePanel();
                });
                pinBtn.addEventListener('click', () => {
                    if (toggleQuestionPinned(q)) onRoomUpdatePanel();
                });
                resolveBtn.addEventListener('click', () => {
                    if (toggleQuestionResolved(q)) onRoomUpdatePanel();
                });
                questionsList.appendChild(row);
            });
        }
    }

    // ── Onglet Outils: résultats sondage en direct ────
    if (_activePoll) {
        const pollResults = document.getElementById('rm-poll-results');
        if (pollResults) {
            pollResults.innerHTML = renderPollResultsHtml(_roomBridgeSnapshotPoll(), { escHtml: _roomEsc });
        }
    }

    // ── Nuage: compteur ────────────────────────────────
    if (_activeWordCloud) {
        const countEl = document.getElementById('rm-cloud-count');
        if (countEl) {
            const summary = summarizeWordCloud(_activeWordCloud.words);
            countEl.textContent = formatWordCloudCountLabel(summary);
        }
    }

    // ── Outils: feedback discret ───────────────────────
    const feedbackMetaByKind = {
        fast: roomFeedbackMeta('fast'),
        unclear: roomFeedbackMeta('unclear'),
        pause: roomFeedbackMeta('pause'),
        clear: roomFeedbackMeta('clear'),
    };
    const feedbackSummary = document.getElementById('rm-feedback-summary');
    if (feedbackSummary) {
        feedbackSummary.innerHTML = renderFeedbackSummaryHtml({
            counts: feedbackStats10m.counts,
            metasByKind: feedbackMetaByKind,
            iconOnly,
        });
    }
    const feedbackList = document.getElementById('rm-feedback-list');
    if (feedbackList) {
        feedbackList.innerHTML = renderFeedbackListHtml({
            events: _roomFeedback.events,
            nowTs: Date.now(),
            limit: 8,
            metasByKind: feedbackMetaByKind,
            iconOnly,
            escHtml: _roomEsc,
            trimText: toTrimmedString,
        });
    }
    const feedbackResetBtn = document.getElementById('rm-feedback-reset');
    if (feedbackResetBtn) feedbackResetBtn.disabled = feedbackStats10m.total === 0;

    // ── Bouton toolbar ────────────────────────────────
    const btn = document.getElementById('btn-student-room');
    if (btn) {
        const handBadge = handsN > 0 ? `<span class="rm-toolbar-badge">${UI_ICONS.hand}<span>${handsN}</span></span>` : '';
        const qBadge = questionsN > 0 ? `<span class="rm-toolbar-badge">${UI_ICONS.question}<span>${questionsN}</span></span>` : '';
        btn.innerHTML = _room.active
            ? `${UI_ICONS.users}<span>${n}</span>${handBadge}${qBadge}`
            : withIcon('users', 'Salle');
        btn.classList.toggle('active', _room.active);
    }
    roomUpdateQrButtonsUI();
    roomUpdateNetworkDiagnostics();
    const remoteSessions = _remoteActiveSessionsCount();
    const miniState = buildPresenterMiniViews({
        roomActive: _room.active,
        relayActive: _relayRoom.active,
        studentsCount: n,
        handsCount: handsN,
        questionsCount: questionsN,
        feedbackUrgentCount: feedbackUrgentN,
        remoteSessions,
        currentView: _pvContextView,
    });
    const modeLabel = miniState.modeLabel;
    _pvContextView = miniState.activeView;
    const pvRoomStatusBar = document.getElementById('pv-room-status-bar');
    if (pvRoomStatusBar) {
        pvRoomStatusBar.innerHTML = renderPresenterRoomStatusBarHtml({
            roomActive: _room.active,
            modeLabel,
            studentsCount: n,
            handsCount: handsN,
            questionsCount: questionsN,
            telemetryStaleCount: telemetryStats.stale,
            feedbackUrgentCount: feedbackUrgentN,
            remoteSessions,
            iconOnly,
        });
    }
    const pvRoomMini = document.getElementById('pv-room-mini');
    if (pvRoomMini) {
        pvRoomMini.innerHTML = renderPresenterRoomMiniHtml({
            views: miniState.views,
            activeView: _pvContextView,
            iconOnly,
        });
        pvRoomMini.querySelectorAll('[data-pv-view]').forEach(btnEl => {
            btnEl.addEventListener('click', () => {
                const nextView = toTrimmedString(btnEl.getAttribute('data-pv-view'), 24);
                if (nextView && nextView !== _pvContextView) {
                    _pvContextView = nextView;
                    onRoomUpdatePanel();
                }
            });
        });
    }
    const pvContextDynamic = document.getElementById('pv-context-dynamic');
    if (pvContextDynamic) {
        const roomId = toTrimmedString(document.getElementById('rm-room-id-input')?.value || '', 80) || '—';
        const stableUrl = roomAudienceQrUrl();
        const handsList = _roomHands.slice(0, 4).map(h => String(h.pseudo || h.peerId || 'Étudiant'));
        const openQuestions = _roomQuestions
            .filter(q => !q.read && !q.hidden && !q.resolved)
            .slice(0, 3)
            .map(q => toTrimmedString(q.text, 120));
        const studentsList = Object.values(_room.students)
            .slice(0, 5)
            .map(s => String(s?.pseudo || 'Étudiant'));
        pvContextDynamic.innerHTML = renderPresenterContextDynamicHtml({
            view: _pvContextView,
            modeLabel,
            roomId,
            studentsCount: n,
            handsCount: handsN,
            questionsCount: questionsN,
            feedbackUrgentCount: feedbackUrgentN,
            remoteSessions,
            students: studentsList,
            hands: handsList,
            openQuestions,
            stableUrl,
            iconOnly,
        });
        if (_pvContextView === 'status') {
            document.getElementById('pv-context-copy-stable')?.addEventListener('click', () => {
                if (!stableUrl) return;
                navigator.clipboard.writeText(stableUrl).then(() => {
                    const btnCopy = document.getElementById('pv-context-copy-stable');
                    if (!btnCopy) return;
                    btnCopy.innerHTML = `${iconOnly('check')}<span>Copié</span>`;
                    setTimeout(() => {
                        const freshBtn = document.getElementById('pv-context-copy-stable');
                        if (freshBtn) freshBtn.innerHTML = `${iconOnly('copy')}<span>Copier lien stable</span>`;
                    }, 1200);
                });
            });
            document.getElementById('pv-context-open-technique')?.addEventListener('click', () => {
                const roomModal = document.getElementById('sl-room-modal');
                if (!roomModal) return;
                switchRoomPresenterMode('technique', true);
                roomModal.classList.add('open');
                onRoomUpdatePanel();
            });
        }
    }

    _roomBridgeEmit('room', _roomBridgeSnapshotRoom());
    _remoteUpdateUI();

    return { _pvContextView };
}
