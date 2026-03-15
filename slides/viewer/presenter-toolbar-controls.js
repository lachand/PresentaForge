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
        switchRoomPresenterMode('technique', true);
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

    // Keep room panel as modal in presenter, force technique mode for a focused workflow.
    const pvRoomPanelEl = documentRef.getElementById('sl-room-panel');
    if (pvRoomPanelEl) {
        const remoteSection = documentRef.getElementById('rm-remote-control');
        if (remoteSection) remoteSection.remove();
        switchRoomPresenterMode('technique', true);
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

    const audienceLockBtn = context.audienceLockBtn || null;
    const exerciseModeBtn = context.exerciseModeBtn || null;

    documentRef.getElementById('pv-btn-black')?.addEventListener('click', () => {
        toggleBlack();
    });
    documentRef.getElementById('pv-btn-whiteboard')?.addEventListener('click', () => {
        toggleWhiteboard();
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
}
