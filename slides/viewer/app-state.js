// @ts-check

/**
 * AppState bridge for viewer runtime.
 * Keeps compatibility with legacy window._* keys while offering explicit getters/setters.
 * @param {Window & typeof globalThis} globalObj
 */
export function createViewerAppState(globalObj = window) {
    const state = globalObj.__oeiViewerRuntime || (globalObj.__oeiViewerRuntime = {});
    const read = (key, legacy, fallback = null) => (state[key] !== undefined ? state[key] : (globalObj[legacy] ?? fallback));
    const write = (key, legacy, value) => {
        state[key] = value;
        globalObj[legacy] = value;
    };

    return {
        get activeQuizHandler() { return read('activeQuizHandler', '_activeQuizHandler', null); },
        set activeQuizHandler(fn) { write('activeQuizHandler', '_activeQuizHandler', fn || null); },
        get lastQuizResponses() { return read('lastQuizResponses', '_lastQuizResponses', null); },
        set lastQuizResponses(v) { write('lastQuizResponses', '_lastQuizResponses', v || null); },
        get lastQuizOptions() { return read('lastQuizOptions', '_lastQuizOptions', null); },
        set lastQuizOptions(v) { write('lastQuizOptions', '_lastQuizOptions', v || null); },
        get studentRoom() { return read('studentRoom', '_studentRoom', null); },
        set studentRoom(v) { write('studentRoom', '_studentRoom', v || null); },
        get studentRoomBroadcast() { return read('studentRoomBroadcast', '_studentRoomBroadcast', null); },
        set studentRoomBroadcast(fn) { write('studentRoomBroadcast', '_studentRoomBroadcast', fn || null); },
        get revealDeck() { return read('revealDeck', '_revealDeck', null); },
        set revealDeck(deck) { write('revealDeck', '_revealDeck', deck || null); },
        get presenterCurrentIndex() { return read('presenterCurrentIndex', '_presenterCurrentIndex', 0) || 0; },
        set presenterCurrentIndex(idx) { write('presenterCurrentIndex', '_presenterCurrentIndex', Number(idx) || 0); },
        get presenterCurrentFragment() { return read('presenterCurrentFragment', '_presenterCurrentFragment', -1); },
        set presenterCurrentFragment(idx) {
            const n = Number(idx);
            write('presenterCurrentFragment', '_presenterCurrentFragment', Number.isFinite(n) ? Math.trunc(n) : -1);
        },
        isPeerScriptLoaded() { return !!read('peerScriptLoaded', '_slPeerLoaded', false); },
        markPeerScriptLoaded() { write('peerScriptLoaded', '_slPeerLoaded', true); },
        setRoomPreviewUpdater(fn) { write('roomPreviewUpdater', '_updateRoomPreview', fn || null); },
        runRoomPreviewUpdater() {
            const fn = read('roomPreviewUpdater', '_updateRoomPreview', null);
            if (typeof fn === 'function') fn();
        },
        clearRoomRuntime() {
            this.studentRoom = null;
            this.studentRoomBroadcast = null;
            this.activeQuizHandler = null;
            this.lastQuizResponses = null;
            this.lastQuizOptions = null;
        },
    };
}
