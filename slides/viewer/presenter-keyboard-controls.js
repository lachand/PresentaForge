// @ts-check

/**
 * Bind presenter keyboard shortcuts.
 * @param {{
 *   documentRef?: Document,
 *   rootElement?: HTMLElement | null,
 *   goNext?: () => void,
 *   goPrev?: () => void,
 *   goTo?: (index: number) => void,
 *   getSlideCount?: () => number,
 *   toggleBlack?: () => void,
 *   toggleWhiteboard?: () => void,
 *   timerToggle?: () => void,
 *   timerReset?: () => void,
 *   toggleAudienceLock?: () => void,
 *   toggleExerciseMode?: () => void,
 *   sessionRec?: { active?: boolean, paused?: boolean },
 *   pauseSessionRecording?: () => void,
 *   resumeSessionRecording?: () => void,
 *   openPresenterRoomPanel?: () => void,
 *   increaseFontSize?: () => void,
 *   decreaseFontSize?: () => void,
 * }} context
 */
export function bindPresenterKeyboardShortcuts(context = {}) {
    const documentRef = context.documentRef || (typeof document !== 'undefined' ? document : null);
    const rootElement = context.rootElement || documentRef?.documentElement || null;
    const goNext = typeof context.goNext === 'function' ? context.goNext : () => {};
    const goPrev = typeof context.goPrev === 'function' ? context.goPrev : () => {};
    const goTo = typeof context.goTo === 'function' ? context.goTo : () => {};
    const getSlideCount = typeof context.getSlideCount === 'function' ? context.getSlideCount : () => 0;
    const toggleBlack = typeof context.toggleBlack === 'function' ? context.toggleBlack : () => {};
    const toggleWhiteboard = typeof context.toggleWhiteboard === 'function' ? context.toggleWhiteboard : () => {};
    const timerToggle = typeof context.timerToggle === 'function' ? context.timerToggle : () => {};
    const timerReset = typeof context.timerReset === 'function' ? context.timerReset : () => {};
    const toggleAudienceLock = typeof context.toggleAudienceLock === 'function' ? context.toggleAudienceLock : () => {};
    const toggleExerciseMode = typeof context.toggleExerciseMode === 'function' ? context.toggleExerciseMode : () => {};
    const sessionRec = context.sessionRec || { active: false, paused: false };
    const pauseSessionRecording = typeof context.pauseSessionRecording === 'function' ? context.pauseSessionRecording : () => {};
    const resumeSessionRecording = typeof context.resumeSessionRecording === 'function' ? context.resumeSessionRecording : () => {};
    const openPresenterRoomPanel = typeof context.openPresenterRoomPanel === 'function' ? context.openPresenterRoomPanel : () => {};
    const increaseFontSize = typeof context.increaseFontSize === 'function' ? context.increaseFontSize : () => {};
    const decreaseFontSize = typeof context.decreaseFontSize === 'function' ? context.decreaseFontSize : () => {};

    const handler = event => {
        if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter' || event.key === 'PageDown') {
            event.preventDefault();
            goNext();
        }
        if (event.key === 'ArrowLeft' || event.key === 'Backspace' || event.key === 'PageUp') {
            event.preventDefault();
            goPrev();
        }
        if (event.key === 'Home') {
            event.preventDefault();
            goTo(0);
        }
        if (event.key === 'End') {
            event.preventDefault();
            goTo(Math.max(0, getSlideCount() - 1));
        }
        if (event.key === 'b' || event.key === 'B' || event.key === '.') toggleBlack();
        if (event.key === 'w' || event.key === 'W') {
            event.preventDefault();
            toggleWhiteboard();
        }
        if (event.key === 'f' || event.key === 'F') {
            if (!documentRef?.fullscreenElement) rootElement?.requestFullscreen?.();
            else documentRef?.exitFullscreen?.();
        }
        if (event.key === 't' || event.key === 'T') timerToggle();
        if (event.key === 'r' || event.key === 'R') timerReset();
        if (event.key === 'l' || event.key === 'L') {
            event.preventDefault();
            toggleAudienceLock();
        }
        if (event.key === 'x' || event.key === 'X') {
            event.preventDefault();
            toggleExerciseMode();
        }
        if ((event.key === 'p' || event.key === 'P') && sessionRec.active) {
            event.preventDefault();
            if (sessionRec.paused) resumeSessionRecording();
            else pauseSessionRecording();
        }
        if (event.key === 's' || event.key === 'S') openPresenterRoomPanel();
        if (event.key === 'Escape') {
            if (documentRef?.fullscreenElement) documentRef?.exitFullscreen?.();
        }
        if (event.key === '+' || event.key === '=') increaseFontSize();
        if (event.key === '-' || event.key === '_') decreaseFontSize();
        if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.altKey) {
            const idx = parseInt(event.key, 10) - 1;
            if (idx < getSlideCount()) goTo(idx);
        }
    };

    if (documentRef && typeof documentRef.addEventListener === 'function') {
        documentRef.addEventListener('keydown', handler);
    }
    return { handler };
}
