// @ts-check

/**
 * Bind presenter room-panel contextual controls (open room/network panel + quick room actions).
 * @param {{
 *   documentRef?: Document,
 *   switchRoomPresenterMode?: (mode: string, forceSwitch?: boolean) => void,
 *   roomUpdatePanel?: () => void,
 *   switchRoomTab?: (tab: string) => void,
 *   roomUpdateQrButtonsUI?: () => void,
 *   roomUpdateNetworkDiagnostics?: () => void,
 *   onRoomOpenPeer?: () => void,
 *   isRoomActive?: () => boolean,
 *   getPvQrVisible?: () => boolean,
 *   roomSetAudienceQrVisibility?: (show: boolean) => void,
 *   setPresenterSwitchTabNull?: () => void,
 * }} context
 */
export function bindPresenterRoomPanelControls(context = {}) {
    const documentRef = context.documentRef || document;
    const switchRoomPresenterMode = typeof context.switchRoomPresenterMode === 'function'
        ? context.switchRoomPresenterMode
        : () => {};
    const roomUpdatePanel = typeof context.roomUpdatePanel === 'function' ? context.roomUpdatePanel : () => {};
    const switchRoomTab = typeof context.switchRoomTab === 'function' ? context.switchRoomTab : () => {};
    const roomUpdateQrButtonsUI = typeof context.roomUpdateQrButtonsUI === 'function' ? context.roomUpdateQrButtonsUI : () => {};
    const roomUpdateNetworkDiagnostics = typeof context.roomUpdateNetworkDiagnostics === 'function' ? context.roomUpdateNetworkDiagnostics : () => {};
    const onRoomOpenPeer = typeof context.onRoomOpenPeer === 'function' ? context.onRoomOpenPeer : () => {};
    const isRoomActive = typeof context.isRoomActive === 'function' ? context.isRoomActive : () => false;
    const getPvQrVisible = typeof context.getPvQrVisible === 'function' ? context.getPvQrVisible : () => false;
    const roomSetAudienceQrVisibility = typeof context.roomSetAudienceQrVisibility === 'function'
        ? context.roomSetAudienceQrVisibility
        : () => {};

    const openPresenterRoomPanel = () => {
        const roomModal = documentRef.getElementById('sl-room-modal');
        if (!roomModal) return;
        switchRoomPresenterMode('live', true);
        roomModal.classList.add('open');
        roomUpdatePanel();
    };

    const openPresenterNetworkPanel = () => {
        openPresenterRoomPanel();
        switchRoomTab('tools');
        const diag = documentRef.getElementById('rm-network-diagnostics');
        if (diag && typeof diag.scrollIntoView === 'function') {
            diag.scrollIntoView({ block: 'nearest' });
        }
    };

    if (typeof context.setPresenterSwitchTabNull === 'function') {
        context.setPresenterSwitchTabNull();
    }

    documentRef.getElementById('pv-context-open-salle')?.addEventListener('click', openPresenterRoomPanel);

    // Keep room panel as modal in presenter, default to live mode to show students/hands/questions.
    const pvRoomPanelEl = documentRef.getElementById('sl-room-panel');
    if (pvRoomPanelEl) {
        const remoteSection = documentRef.getElementById('rm-remote-control');
        if (remoteSection) remoteSection.remove();
        switchRoomPresenterMode('live', true);
        roomUpdatePanel();
    }

    documentRef.getElementById('pv-btn-room')?.addEventListener('click', openPresenterRoomPanel);
    documentRef.getElementById('pv-btn-room-quick')?.addEventListener('click', () => {
        if (!isRoomActive()) {
            onRoomOpenPeer();
            return;
        }
        roomSetAudienceQrVisibility(!getPvQrVisible());
    });
    documentRef.getElementById('pv-btn-network')?.addEventListener('click', () => {
        if (!isRoomActive()) onRoomOpenPeer();
        openPresenterNetworkPanel();
    });
    roomUpdateQrButtonsUI();
    roomUpdateNetworkDiagnostics();

    return {
        openPresenterRoomPanel,
        openPresenterNetworkPanel,
    };
}

/**
 * Bind presenter toolbar action buttons.
 * @param {{
 *   documentRef?: Document,
 *   rootElement?: HTMLElement | null,
 *   toggleBlack?: () => void,
 *   toggleWhiteboard?: () => void,
 *   toggleAudienceLock?: () => void,
 *   toggleExerciseMode?: () => void,
 *   audienceLockBtn?: HTMLElement | null,
 *   exerciseModeBtn?: HTMLElement | null,
 *   sessionRec?: { active?: boolean, paused?: boolean },
 *   stopSessionRecording?: () => void,
 *   startSessionRecording?: () => Promise<void>,
 *   pauseSessionRecording?: () => void,
 *   resumeSessionRecording?: () => void,
 *   startReplaySession?: () => void,
 *   exportSessionRecording?: () => void,
 *   exportReplayStandalone?: () => Promise<void>,
 *   beforeNavigateToEditor?: () => void,
 *   navigateToEditor?: () => void,
 *   onSubtitleText?: (text: string) => void,
 *   onSubtitleActive?: (active: boolean) => void,
 * }} context
 */
export function bindPresenterToolbarButtons(context = {}) {
    const documentRef = context.documentRef || document;
    const rootElement = context.rootElement || document.documentElement;
    const toggleBlack = typeof context.toggleBlack === 'function' ? context.toggleBlack : () => {};
    const toggleWhiteboard = typeof context.toggleWhiteboard === 'function' ? context.toggleWhiteboard : () => {};
    const toggleAudienceLock = typeof context.toggleAudienceLock === 'function' ? context.toggleAudienceLock : () => {};
    const toggleExerciseMode = typeof context.toggleExerciseMode === 'function' ? context.toggleExerciseMode : () => {};
    const sessionRec = context.sessionRec || { active: false, paused: false };
    const stopSessionRecording = typeof context.stopSessionRecording === 'function' ? context.stopSessionRecording : () => {};
    const startSessionRecording = typeof context.startSessionRecording === 'function'
        ? context.startSessionRecording
        : (async () => {});
    const pauseSessionRecording = typeof context.pauseSessionRecording === 'function' ? context.pauseSessionRecording : () => {};
    const resumeSessionRecording = typeof context.resumeSessionRecording === 'function' ? context.resumeSessionRecording : () => {};
    const startReplaySession = typeof context.startReplaySession === 'function' ? context.startReplaySession : () => {};
    const exportSessionRecording = typeof context.exportSessionRecording === 'function' ? context.exportSessionRecording : () => {};
    const exportReplayStandalone = typeof context.exportReplayStandalone === 'function'
        ? context.exportReplayStandalone
        : (async () => {});
    const beforeNavigateToEditor = typeof context.beforeNavigateToEditor === 'function' ? context.beforeNavigateToEditor : () => {};
    const navigateToEditor = typeof context.navigateToEditor === 'function'
        ? context.navigateToEditor
        : () => { window.location.href = 'editor.html'; };
    const onSubtitleText = typeof context.onSubtitleText === 'function' ? context.onSubtitleText : () => {};
    const onSubtitleActive = typeof context.onSubtitleActive === 'function' ? context.onSubtitleActive : () => {};

    const audienceLockBtn = context.audienceLockBtn || null;
    const exerciseModeBtn = context.exerciseModeBtn || null;

    documentRef.getElementById('pv-btn-black')?.addEventListener('click', () => {
        toggleBlack();
    });
    documentRef.getElementById('pv-btn-whiteboard')?.addEventListener('click', () => {
        toggleWhiteboard();
    });
    const focusBtn = documentRef.getElementById('pv-btn-focus');
    focusBtn?.addEventListener('click', () => {
        const on = documentRef.getElementById('presenter-view')?.classList.toggle('is-focus');
        focusBtn.classList.toggle('active', !!on);
        focusBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    audienceLockBtn?.addEventListener('click', () => {
        toggleAudienceLock();
    });
    exerciseModeBtn?.addEventListener('click', () => {
        toggleExerciseMode();
    });
    documentRef.getElementById('pv-btn-fullscreen')?.addEventListener('click', () => {
        if (!document.fullscreenElement) rootElement?.requestFullscreen?.();
        else document.exitFullscreen?.();
    });
    documentRef.getElementById('pv-btn-rec')?.addEventListener('click', async () => {
        if (sessionRec.active) {
            stopSessionRecording();
            return;
        }
        await startSessionRecording();
    });
    documentRef.getElementById('pv-btn-rec-pause')?.addEventListener('click', () => {
        if (!sessionRec.active) return;
        if (sessionRec.paused) resumeSessionRecording();
        else pauseSessionRecording();
    });
    documentRef.getElementById('pv-btn-replay')?.addEventListener('click', () => {
        startReplaySession();
    });
    documentRef.getElementById('pv-btn-export-session')?.addEventListener('click', () => {
        exportSessionRecording();
    });
    documentRef.getElementById('pv-btn-export-replay')?.addEventListener('click', async () => {
        await exportReplayStandalone();
    });
    documentRef.getElementById('pv-btn-editor')?.addEventListener('click', () => {
        beforeNavigateToEditor();
        navigateToEditor();
    });

    // Live subtitle toggle — Web Speech API
    const _subtitleBtn = documentRef.getElementById('pv-btn-subtitle');
    const _subtitleOverlay = documentRef.getElementById('pv-subtitle-overlay');
    const _subtitleText = documentRef.getElementById('pv-subtitle-text');
    let _subtitleRecog = null;
    const _win = (typeof window !== 'undefined') ? window : {};
    const SpeechRecognition = _win.SpeechRecognition || _win.webkitSpeechRecognition;
    if (_subtitleBtn) {
        if (!SpeechRecognition) {
            _subtitleBtn.disabled = true;
            _subtitleBtn.title = 'Reconnaissance vocale non supportée par ce navigateur';
        } else {
            const _stopSubtitle = () => {
                const r = _subtitleRecog;
                _subtitleRecog = null;
                try { r?.stop(); } catch (_) {}
                _subtitleBtn.classList.remove('active');
                _subtitleOverlay?.classList.remove('active');
                onSubtitleActive(false);
            };
            const _startNewRecog = () => {
                const r = new SpeechRecognition();
                r.continuous = true;
                r.interimResults = true;
                r.lang = 'fr-FR';
                r.onresult = (e) => {
                    let text = '';
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        text += e.results[i][0].transcript;
                    }
                    if (_subtitleText) _subtitleText.textContent = text;
                    onSubtitleText(text);
                };
                // onend fires on silence/pause — create a fresh instance to continue
                r.onend = () => {
                    if (_subtitleRecog) {
                        try { _subtitleRecog = _startNewRecog(); } catch (_) { _stopSubtitle(); }
                    }
                };
                r.onerror = (e) => {
                    console.error('[Sous-titres] SpeechRecognition error', e.error, e);
                    const msg = {
                        'not-allowed':         'Microphone refusé — autorisez l\'accès dans les paramètres du navigateur',
                        'service-not-allowed': 'Service de reconnaissance vocale non autorisé (Chromium sans clé Google ?)',
                        'network':             'Erreur réseau — vérifiez que vous utilisez Google Chrome (pas Chromium/Brave)',
                        'audio-capture':       'Aucun microphone détecté',
                        'aborted':             'Reconnaissance interrompue',
                        'no-speech':           null,
                    }[e.error] ?? `Erreur reconnaissance vocale : ${e.error}`;
                    if (msg && _subtitleText) _subtitleText.textContent = `⚠ ${msg}`;
                    if (e.error !== 'no-speech') {
                        setTimeout(_stopSubtitle, 4000);
                    }
                };
                r.start();
                return r;
            };
            _subtitleBtn.addEventListener('click', () => {
                if (_subtitleRecog) {
                    _stopSubtitle();
                    onSubtitleActive(false);
                } else {
                    try {
                        _subtitleRecog = _startNewRecog();
                        _subtitleBtn.classList.add('active');
                        _subtitleOverlay?.classList.add('active');
                        onSubtitleActive(true);
                    } catch (_) {}
                }
            });
        }
    }
}
