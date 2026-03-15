// @ts-check

/**
 * Bind room panel action handlers (questions, hands, poll/cloud/nudges, network, remote control).
 * @param {{
 *   documentRef?: Document,
 *   roomQuestions?: Array<any>,
 *   markAllQuestionsHidden?: (questions: Array<any>) => void,
 *   roomFeedback?: { events: Array<any>, lastByPeer: Map<any, any> },
 *   onRoomUpdatePanel?: () => void,
 *   roomHands?: Array<any>,
 *   room?: { active?: boolean, connections?: Array<any>, students?: Record<string, any>, peer?: { id?: string } | null },
 *   roomMsg?: { HAND_LOWER?: string },
 *   clearAllRaisedHands?: (hands: Array<any>, students: Record<string, any>) => void,
 *   viewerCommandBus?: { dispatch?: (name: string, payload?: any, source?: string) => boolean },
 *   getActivePoll?: () => any,
 *   getActiveWordCloud?: () => any,
 *   relayOptions?: { enabled?: boolean, wsUrl?: string },
 *   relayRoom?: { roomId?: string },
 *   relayOpen?: (roomId: string) => void,
 *   roomSetStatus?: (text: string, tone?: string) => void,
 *   toTrimmedString?: (value: unknown, maxLen?: number) => string,
 *   remoteControl?: { roomId?: string, enabled?: boolean },
 *   remoteSetStatus?: (text: string, tone?: string) => void,
 *   remoteEnableFromPassword?: () => Promise<void>,
 *   remoteRevokeAll?: (reason?: string) => void,
 *   remoteBuildUrl?: (roomId: string) => string,
 *   withIcon?: (key: string, label: string) => string,
 *   writeClipboard?: (text: string) => Promise<unknown>,
 * }} context
 */
export function bindRoomPanelActions(context = {}) {
    const documentRef = context.documentRef || document;
    const roomQuestions = Array.isArray(context.roomQuestions) ? context.roomQuestions : [];
    const markAllQuestionsHidden = typeof context.markAllQuestionsHidden === 'function'
        ? context.markAllQuestionsHidden
        : () => {};
    const roomFeedback = context.roomFeedback || { events: [], lastByPeer: new Map() };
    const onRoomUpdatePanel = typeof context.onRoomUpdatePanel === 'function'
        ? context.onRoomUpdatePanel
        : () => {};
    const roomHands = Array.isArray(context.roomHands) ? context.roomHands : [];
    const room = context.room || { active: false, connections: [], students: {}, peer: null };
    const roomMsg = context.roomMsg || {};
    const clearAllRaisedHands = typeof context.clearAllRaisedHands === 'function'
        ? context.clearAllRaisedHands
        : () => {};
    const viewerCommandBus = context.viewerCommandBus || {};
    const getActivePoll = typeof context.getActivePoll === 'function' ? context.getActivePoll : () => null;
    const getActiveWordCloud = typeof context.getActiveWordCloud === 'function' ? context.getActiveWordCloud : () => null;
    const relayOptions = context.relayOptions || { enabled: false, wsUrl: '' };
    const relayRoom = context.relayRoom || { roomId: '' };
    const relayOpen = typeof context.relayOpen === 'function' ? context.relayOpen : () => {};
    const roomSetStatus = typeof context.roomSetStatus === 'function' ? context.roomSetStatus : () => {};
    const toTrimmedString = typeof context.toTrimmedString === 'function'
        ? context.toTrimmedString
        : ((value, maxLen = 0) => {
            const out = String(value || '').trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        });
    const remoteControl = context.remoteControl || { roomId: '', enabled: false };
    const remoteSetStatus = typeof context.remoteSetStatus === 'function' ? context.remoteSetStatus : () => {};
    const remoteEnableFromPassword = typeof context.remoteEnableFromPassword === 'function'
        ? context.remoteEnableFromPassword
        : (async () => {});
    const remoteRevokeAll = typeof context.remoteRevokeAll === 'function' ? context.remoteRevokeAll : () => {};
    const remoteBuildUrl = typeof context.remoteBuildUrl === 'function' ? context.remoteBuildUrl : () => '';
    const withIcon = typeof context.withIcon === 'function' ? context.withIcon : (_key, label) => String(label || '');
    const writeClipboard = typeof context.writeClipboard === 'function'
        ? context.writeClipboard
        : (text => navigator.clipboard.writeText(text));

    const dispatchCommand = (name, payload = null) => {
        if (typeof viewerCommandBus.dispatch !== 'function') return false;
        return !!viewerCommandBus.dispatch(name, payload, 'ui');
    };
    const setNudgeFeedback = text => {
        const feedback = documentRef.getElementById('rm-nudge-feedback');
        if (feedback) feedback.textContent = text;
    };

    documentRef.getElementById('rm-question-mark-all')?.addEventListener('click', () => {
        markAllQuestionsHidden(roomQuestions);
        onRoomUpdatePanel();
    });
    documentRef.getElementById('rm-feedback-reset')?.addEventListener('click', () => {
        roomFeedback.events.length = 0;
        roomFeedback.lastByPeer?.clear?.();
        onRoomUpdatePanel();
    });
    documentRef.getElementById('rm-lower-all')?.addEventListener('click', () => {
        roomHands.forEach(hand => {
            const conn = room.connections?.find?.(entry => entry.peer === hand.peerId && entry.open);
            if (!conn) return;
            try { conn.send({ type: roomMsg.HAND_LOWER }); } catch (_) {}
        });
        clearAllRaisedHands(roomHands, room.students || {});
        onRoomUpdatePanel();
    });

    documentRef.getElementById('rm-poll-start')?.addEventListener('click', () => {
        const type = /** @type {HTMLInputElement|null} */ (documentRef.getElementById('rm-poll-type'))?.value || 'thumbs';
        const prompt = /** @type {HTMLInputElement|null} */ (documentRef.getElementById('rm-poll-prompt'))?.value?.trim?.() || '';
        if (!dispatchCommand('room.poll.start', { typeOrConfig: type, prompt })) {
            setNudgeFeedback('Ouvrez la salle pour lancer un sondage.');
        }
    });
    documentRef.getElementById('rm-poll-end')?.addEventListener('click', () => {
        dispatchCommand('room.poll.end');
    });
    documentRef.getElementById('rm-cloud-start')?.addEventListener('click', () => {
        const prompt = /** @type {HTMLInputElement|null} */ (documentRef.getElementById('rm-cloud-prompt'))?.value?.trim?.() || '';
        if (!dispatchCommand('room.cloud.start', { prompt })) {
            setNudgeFeedback('Ouvrez la salle pour lancer un nuage.');
        }
    });
    documentRef.getElementById('rm-cloud-show')?.addEventListener('click', () => {
        const wcOverlay = documentRef.getElementById('sl-wordcloud-presenter');
        if (wcOverlay) wcOverlay.style.display = 'flex';
    });
    documentRef.getElementById('rm-cloud-end')?.addEventListener('click', () => {
        dispatchCommand('room.cloud.end');
    });
    documentRef.getElementById('sl-wc-close-presenter')?.addEventListener('click', () => {
        const wcOverlay = documentRef.getElementById('sl-wordcloud-presenter');
        if (wcOverlay) wcOverlay.style.display = 'none';
    });
    documentRef.getElementById('rm-nudge-question')?.addEventListener('click', () => {
        dispatchCommand('room.nudge.send', { kind: 'question', text: 'Avez-vous une question a poser ?' });
    });
    documentRef.getElementById('rm-nudge-hand')?.addEventListener('click', () => {
        dispatchCommand('room.nudge.send', { kind: 'hand', text: 'Levez la main si vous voulez revenir sur ce point.' });
    });
    documentRef.getElementById('rm-nudge-poll')?.addEventListener('click', () => {
        if (getActivePoll()) {
            dispatchCommand('room.nudge.send', {
                kind: 'poll',
                text: 'Un sondage est en cours, pensez a voter.',
            });
            return;
        }
        if (!dispatchCommand('room.poll.start', { typeOrConfig: 'thumbs', prompt: 'Avez-vous compris ce point ?' })) {
            dispatchCommand('room.nudge.send', { kind: 'poll', text: 'Pensez a voter.' });
        }
    });
    documentRef.getElementById('rm-nudge-cloud')?.addEventListener('click', () => {
        if (getActiveWordCloud()) {
            dispatchCommand('room.nudge.send', {
                kind: 'cloud',
                text: 'Nuage de mots en cours, proposez un mot.',
            });
            return;
        }
        if (!dispatchCommand('room.cloud.start', { prompt: 'Un mot pour resumer ce slide ?' })) {
            dispatchCommand('room.nudge.send', { kind: 'cloud', text: 'Proposez un mot.' });
        }
    });

    documentRef.getElementById('rm-network-retry-relay')?.addEventListener('click', () => {
        const roomId = toTrimmedString(
            room.peer?.id || relayRoom.roomId || documentRef.getElementById('rm-room-id-input')?.value,
            80
        );
        if (!room.active || !roomId) return;
        if (!(relayOptions.enabled && relayOptions.wsUrl)) return;
        relayOpen(roomId);
        roomSetStatus('Reconnexion relay forcée…', 'warn');
        onRoomUpdatePanel();
    });

    documentRef.getElementById('rm-remote-enable')?.addEventListener('click', async () => {
        if (!remoteControl.roomId) {
            remoteSetStatus('Définissez un ID de salle valide.', 'error');
            return;
        }
        await remoteEnableFromPassword();
    });
    documentRef.getElementById('rm-remote-revoke')?.addEventListener('click', () => {
        remoteRevokeAll('Contrôle mobile révoqué.');
    });
    documentRef.getElementById('rm-remote-copy')?.addEventListener('click', () => {
        if (!remoteControl.roomId || !remoteControl.enabled) return;
        const url = remoteBuildUrl(remoteControl.roomId);
        writeClipboard(url).then(() => {
            const btn = documentRef.getElementById('rm-remote-copy');
            if (!btn) return;
            btn.innerHTML = withIcon('check', 'Lien copié');
            setTimeout(() => {
                const nextBtn = documentRef.getElementById('rm-remote-copy');
                if (nextBtn) nextBtn.innerHTML = withIcon('copy', 'Copier le lien de contrôle');
            }, 1600);
        }).catch(() => {});
    });
    documentRef.getElementById('rm-remote-password')?.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        documentRef.getElementById('rm-remote-enable')?.click();
    });
}
