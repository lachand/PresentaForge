// @ts-check

const ROOM_PRESENTER_MODES = ['live', 'interactions', 'technique'];
const ROOM_TABS = ['students', 'hands', 'questions', 'dashboard', 'tools'];
const ROOM_QUESTION_FILTERS = ['open', 'pinned', 'resolved', 'hidden', 'all'];

/**
 * Normalize a room id for URL/config usage.
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string}
 */
export function sanitizeRoomId(value, maxLen = 40) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9\-_]/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, Math.max(1, Number(maxLen) || 40));
}

/**
 * @param {unknown} value
 * @returns {'open'|'pinned'|'resolved'|'hidden'|'all'}
 */
export function normalizeRoomQuestionFilter(value) {
    const next = String(value || '').trim();
    return ROOM_QUESTION_FILTERS.includes(next) ? /** @type {'open'|'pinned'|'resolved'|'hidden'|'all'} */ (next) : 'open';
}

/**
 * @param {unknown} mode
 * @returns {'live'|'interactions'|'technique'}
 */
export function normalizeRoomPresenterMode(mode) {
    const next = String(mode || '').trim();
    return ROOM_PRESENTER_MODES.includes(next) ? /** @type {'live'|'interactions'|'technique'} */ (next) : 'live';
}

/**
 * @param {unknown} mode
 * @returns {{ mode: 'live'|'interactions'|'technique', allowedTabs: string[], defaultTab: string }}
 */
export function resolveRoomPresenterTabs(mode) {
    const safeMode = normalizeRoomPresenterMode(mode);
    if (safeMode === 'live') {
        return { mode: safeMode, allowedTabs: ['students', 'hands', 'questions'], defaultTab: 'questions' };
    }
    if (safeMode === 'interactions') {
        return { mode: safeMode, allowedTabs: ['dashboard', 'tools'], defaultTab: 'dashboard' };
    }
    return { mode: safeMode, allowedTabs: ['tools'], defaultTab: 'tools' };
}

/**
 * Room panel UI shell/controller (presenter tabs, modal, room id preview).
 * @param {{
 *   documentRef?: Document,
 *   toTrimmedString?: (value: unknown, maxLen?: number) => string,
 *   withIcon?: (key: string, label: string) => string,
 *   onRenderDashboard?: () => void,
 * }} context
 */
export function createRoomPanelController(context = {}) {
    const documentRef = context.documentRef || document;
    const toTrimmedString = typeof context.toTrimmedString === 'function'
        ? context.toTrimmedString
        : ((value, maxLen = 0) => {
            const out = String(value || '').trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        });
    const withIcon = typeof context.withIcon === 'function'
        ? context.withIcon
        : ((_key, label) => String(label || ''));
    const onRenderDashboard = typeof context.onRenderDashboard === 'function'
        ? context.onRenderDashboard
        : () => {};

    /**
     * @param {unknown} tab
     * @returns {'students'|'hands'|'questions'|'dashboard'|'tools'}
     */
    const switchTab = (tab) => {
        const tabValue = String(tab || '').trim();
        const safeTab = ROOM_TABS.includes(tabValue) ? /** @type {'students'|'hands'|'questions'|'dashboard'|'tools'} */ (tabValue) : 'students';
        documentRef.querySelectorAll('.rm-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === safeTab);
        });
        ROOM_TABS.forEach(name => {
            const panel = documentRef.getElementById(`rm-panel-${name}`);
            if (panel) {
                panel.style.display = name === safeTab ? '' : 'none';
                panel.classList.toggle('rm-panel-active', name === safeTab);
            }
        });
        if (safeTab === 'dashboard') onRenderDashboard();
        return safeTab;
    };

    /**
     * @param {unknown} mode
     * @param {boolean} forceSwitch
     * @returns {'live'|'interactions'|'technique'}
     */
    const switchPresenterMode = (mode, forceSwitch = false) => {
        const modeState = resolveRoomPresenterTabs(mode);
        const roomPanel = documentRef.getElementById('sl-room-panel');
        if (!roomPanel) return modeState.mode;

        roomPanel.classList.remove('rm-mode-live', 'rm-mode-interactions', 'rm-mode-technique');
        roomPanel.classList.add(`rm-mode-${modeState.mode}`);

        documentRef.querySelectorAll('#pv-room-mode-tabs .pv-room-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === modeState.mode);
        });

        let activeTab = '';
        documentRef.querySelectorAll('#rm-tabs .rm-tab').forEach(btn => {
            const tab = toTrimmedString(btn.dataset.tab, 24);
            const visible = modeState.allowedTabs.includes(tab);
            btn.style.display = visible ? '' : 'none';
            if (btn.classList.contains('active') && visible) activeTab = tab;
        });

        if (forceSwitch || !activeTab) switchTab(modeState.defaultTab);
        if (modeState.mode === 'technique') switchTab('tools');
        return modeState.mode;
    };

    const bindPresenterTabClicks = () => {
        documentRef.querySelectorAll('.rm-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(toTrimmedString(btn.dataset.tab, 24));
            });
        });
    };

    /**
     * @param {(next: 'open'|'pinned'|'resolved'|'hidden'|'all') => void} onChange
     */
    const bindQuestionFilter = (onChange) => {
        const filterEl = /** @type {HTMLSelectElement | null} */ (documentRef.getElementById('rm-question-filter'));
        if (!filterEl || typeof onChange !== 'function') return;
        filterEl.addEventListener('change', event => {
            const target = /** @type {HTMLSelectElement} */ (event.target);
            onChange(normalizeRoomQuestionFilter(target?.value));
        });
    };

    /**
     * @param {(open: boolean) => void} [onToggle]
     */
    const bindModalControls = (onToggle) => {
        const modal = documentRef.getElementById('sl-room-modal');
        documentRef.getElementById('btn-student-room')?.addEventListener('click', () => {
            if (!modal) return;
            modal.classList.toggle('open');
            if (typeof onToggle === 'function') onToggle(modal.classList.contains('open'));
        });
        documentRef.getElementById('sl-room-close-modal')?.addEventListener('click', () => {
            if (!modal) return;
            modal.classList.remove('open');
            if (typeof onToggle === 'function') onToggle(false);
        });
        modal?.addEventListener('click', event => {
            if (event.target !== modal) return;
            modal.classList.remove('open');
            if (typeof onToggle === 'function') onToggle(false);
        });
    };

    /**
     * @param {{
     *   isRoomActive: () => boolean,
     *   getRemoteRoomId: () => string,
     *   loadRemoteConfig: (roomId: string) => void,
     *   setRemoteRoomId: (roomId: string) => void,
     *   buildStudentUrl: (roomId: string) => string,
     *   setRoomPreviewUpdater: (fn: () => void) => void,
     *   storageGetRaw: (key: string) => string | null,
     *   lastRoomIdKey: string,
     *   generateRoomId: () => string,
     *   writeClipboard?: (text: string) => Promise<unknown>,
     * }} options
     */
    const initRoomIdPreviewInput = (options) => {
        const input = /** @type {HTMLInputElement | null} */ (documentRef.getElementById('rm-room-id-input'));
        const refresh = documentRef.getElementById('rm-room-id-refresh');
        const writeClipboard = typeof options?.writeClipboard === 'function'
            ? options.writeClipboard
            : (text => navigator.clipboard.writeText(text));

        const updateRoomPreview = () => {
            if (typeof options?.isRoomActive === 'function' && options.isRoomActive()) return;
            const id = sanitizeRoomId(input?.value || '', 40);
            const copyBtn = documentRef.getElementById('sl-room-copy');
            if (!id) {
                options?.setRemoteRoomId('');
                if (copyBtn) {
                    copyBtn.disabled = true;
                    copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                    copyBtn.onclick = null;
                }
                return;
            }
            if (options?.getRemoteRoomId() !== id) {
                options?.loadRemoteConfig(id);
            } else {
                options?.setRemoteRoomId(id);
            }
            const url = options?.buildStudentUrl(id) || '';
            if (copyBtn) {
                copyBtn.disabled = false;
                copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                copyBtn.onclick = () => {
                    writeClipboard(url).then(() => {
                        copyBtn.innerHTML = withIcon('check', 'Copié !');
                        setTimeout(() => {
                            copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                        }, 2000);
                    }).catch(() => {});
                };
            }
        };

        options?.setRoomPreviewUpdater(updateRoomPreview);

        if (input) {
            const saved = options?.storageGetRaw(options?.lastRoomIdKey || '');
            input.value = saved || options?.generateRoomId() || '';
            input.addEventListener('input', () => {
                const pos = input.selectionStart || 0;
                const clean = sanitizeRoomId(input.value || '', 40);
                if (clean !== input.value) {
                    input.value = clean;
                    if (typeof input.setSelectionRange === 'function') {
                        input.setSelectionRange(pos, pos);
                    }
                }
                updateRoomPreview();
            });
            updateRoomPreview();
        }
        if (refresh) {
            refresh.addEventListener('click', () => {
                if (!input || input.disabled) return;
                input.value = options?.generateRoomId() || '';
                updateRoomPreview();
            });
        }
        return updateRoomPreview;
    };

    return {
        switchTab,
        switchPresenterMode,
        bindPresenterTabClicks,
        bindQuestionFilter,
        bindModalControls,
        initRoomIdPreviewInput,
    };
}
