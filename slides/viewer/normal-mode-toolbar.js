// @ts-check

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatToolbarTimer(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.trunc(seconds)) : 0;
    const m = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `⏱ ${m}:${sec}`;
}

/**
 * Initialize viewer toolbar controls in normal (reveal) mode.
 * @param {{
 *   viewerRuntime?: { revealDeck?: { toggleOverview?: () => void } },
 *   wbToggle?: () => void,
 *   openPresenterView?: () => void,
 *   openEditor?: () => void,
 *   documentRef?: Document,
 *   rootElement?: HTMLElement | null,
 *   setIntervalFn?: typeof setInterval,
 *   clearIntervalFn?: typeof clearInterval,
 * }} context
 */
export function initNormalModeToolbar(context = {}) {
    const documentRef = context.documentRef || document;
    const rootElement = context.rootElement || document.documentElement;
    const viewerRuntime = context.viewerRuntime || {};
    const wbToggle = typeof context.wbToggle === 'function' ? context.wbToggle : () => {};
    const openPresenterView = typeof context.openPresenterView === 'function' ? context.openPresenterView : () => {};
    const openEditor = typeof context.openEditor === 'function' ? context.openEditor : () => {};
    const setIntervalFn = typeof context.setIntervalFn === 'function' ? context.setIntervalFn : setInterval;
    const clearIntervalFn = typeof context.clearIntervalFn === 'function' ? context.clearIntervalFn : clearInterval;

    const btnFullscreen = documentRef.getElementById('btn-fullscreen');
    const btnOverview = documentRef.getElementById('btn-overview');
    const btnNotes = documentRef.getElementById('btn-notes');
    const btnEditor = documentRef.getElementById('btn-editor');
    const timerEl = documentRef.getElementById('sl-timer');

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) rootElement?.requestFullscreen?.();
        else document.exitFullscreen?.();
    };

    btnFullscreen?.addEventListener('click', toggleFullscreen);
    btnOverview?.addEventListener('click', () => {
        viewerRuntime.revealDeck?.toggleOverview?.();
    });
    btnNotes?.addEventListener('click', () => {
        openPresenterView();
    });
    btnEditor?.addEventListener('click', () => {
        openEditor();
    });

    let timerSeconds = 0;
    let timerRunning = false;
    let timerInterval = null;

    const timerToggle = () => {
        if (!timerEl) return;
        if (timerRunning) {
            if (timerInterval) clearIntervalFn(timerInterval);
            timerRunning = false;
            timerEl.classList.remove('running');
            timerEl.classList.add('paused');
            return;
        }
        timerRunning = true;
        timerEl.classList.remove('paused');
        timerEl.classList.add('running');
        timerInterval = setIntervalFn(() => {
            timerSeconds += 1;
            timerEl.textContent = formatToolbarTimer(timerSeconds);
        }, 1000);
    };

    const timerReset = () => {
        if (!timerEl) return;
        if (timerInterval) clearIntervalFn(timerInterval);
        timerRunning = false;
        timerSeconds = 0;
        timerEl.textContent = formatToolbarTimer(0);
        timerEl.classList.remove('running');
        timerEl.classList.add('paused');
    };

    timerEl?.addEventListener('click', timerToggle);
    if (timerEl && !timerEl.textContent) timerEl.textContent = formatToolbarTimer(0);

    documentRef.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            const tb = documentRef.getElementById('sl-toolbar');
            tb?.classList.toggle('force-show');
            event.preventDefault();
            return;
        }
        if (event.key === 'f' || event.key === 'F') toggleFullscreen();
        if (event.key === 'p' || event.key === 'P') openPresenterView();
        if (event.key === 't' || event.key === 'T') timerToggle();
        if (event.key === 'r' || event.key === 'R') timerReset();
        if (event.key === 'w' || event.key === 'W') wbToggle();
        if (event.key === 's' || event.key === 'S') openPresenterView();
    });

    return {
        timerToggle,
        timerReset,
        timerFmt: formatToolbarTimer,
    };
}
