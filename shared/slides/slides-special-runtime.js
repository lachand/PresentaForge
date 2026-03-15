/*
 * slides-special-runtime.js — orchestrateur des sous-runtimes "special elements"
 * Délègue à 4 sous-runtimes thématiques (lot 16A) :
 *   - slides-special-math-runtime.js  → LaTeX, Mermaid, Timer, Quiz statique
 *   - slides-special-code-runtime.js  → code-live
 *   - slides-special-quiz-runtime.js  → quiz-live P2P, cloze, drag-drop, mcq-multi, mcq-single
 *   - slides-special-live-runtime.js  → poll-live, exit-ticket, postit-wall, roulette,
 *                                        room-stats, leaderboard, decision-tree, code-compare,
 *                                        algo-stepper, gallery-annotable, kanban-mini,
 *                                        rank-order, myth-reality, flashcards
 */
(function(global){
    'use strict';

    if (!global.OEISlidesSpecialMathRuntime) throw new Error('[OEISlidesSpecialRuntime] slides-special-math-runtime.js manquant');
    if (!global.OEISlidesSpecialCodeRuntime) throw new Error('[OEISlidesSpecialRuntime] slides-special-code-runtime.js manquant');
    if (!global.OEISlidesSpecialQuizRuntime) throw new Error('[OEISlidesSpecialRuntime] slides-special-quiz-runtime.js manquant');
    if (!global.OEISlidesSpecialLiveRuntime) throw new Error('[OEISlidesSpecialRuntime] slides-special-live-runtime.js manquant');

    /**
     * Mount special interactive elements (latex, mermaid, timers, quiz/live widgets, etc).
     * @param {{ container: Element|HTMLElement, SlidesRenderer?: any }} context
     */
    async function mountSpecialElements(context = {}) {
        const container = context?.container;
        const SlidesRenderer = context?.SlidesRenderer || global.SlidesRenderer;
        if (!container || typeof container.querySelectorAll !== 'function') return;
        if (!SlidesRenderer) {
            throw new Error('SlidesRenderer is required for OEISlidesSpecialRuntime.mountSpecialElements');
        }
        const mode = (() => {
            try { return new URLSearchParams(window.location.search || '').get('mode') || ''; }
            catch (_) { return ''; }
        })();
        const fallbackAudienceReadOnly = mode === 'audience' || document.documentElement?.dataset?.oeiSlidesRole === 'audience';
        const audiencePolicy = (() => {
            const existing = global.OEIAudienceModePolicy;
            if (existing && typeof existing === 'object') return existing;
            const resolver = global.OEINetworkSession?.resolveAudiencePolicy;
            if (typeof resolver === 'function') {
                try {
                    return resolver(new URLSearchParams(window.location.search || ''), {
                        defaultMode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                        forceReadOnly: fallbackAudienceReadOnly ? true : null,
                    });
                } catch (_) {}
            }
            return {
                mode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                readOnly: fallbackAudienceReadOnly,
                allowAudienceActions: !fallbackAudienceReadOnly,
            };
        })();
        global.OEIAudienceModePolicy = audiencePolicy;
        const isAudienceReadOnly = !!audiencePolicy?.readOnly || fallbackAudienceReadOnly;
        const presenterSyncBridge = (mode === 'presenter' && global.OEIPresenterSyncBridge && typeof global.OEIPresenterSyncBridge.post === 'function')
            ? global.OEIPresenterSyncBridge
            : null;
        const audienceElementStore = (() => {
            const current = global.OEIAudienceElementState;
            if (current && typeof current === 'object') return current;
            const next = {};
            global.OEIAudienceElementState = next;
            return next;
        })();
        const toTrimmed = (value, maxLen = 120) => {
            if (typeof value !== 'string') return '';
            const out = value.trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        };
        const toInt = value => {
            const n = Number(value);
            return Number.isFinite(n) ? Math.trunc(n) : null;
        };
        const resolveSyncMeta = host => {
            const section = host?.closest?.('section[data-slide-index]');
            const owner = host?.closest?.('[data-element-id]');
            const slideIndex = toInt(section?.dataset?.slideIndex);
            const elementId = toTrimmed(owner?.dataset?.elementId || '', 160);
            return { slideIndex, elementId };
        };
        const elementStateKey = (elementType, slideIndex, elementId = '') => {
            const safeType = toTrimmed(String(elementType || ''), 80);
            const safeSlide = toInt(slideIndex);
            const safeId = toTrimmed(String(elementId || ''), 160);
            if (!safeType || safeSlide === null || safeSlide < 0) return '';
            return `${safeType}::${safeSlide}::${safeId}`;
        };
        const emitAudienceElementState = (host, elementType, state = {}) => {
            if (!presenterSyncBridge?.post || !presenterSyncBridge?.SYNC_MSG?.ELEMENT_STATE) return false;
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return false;
            const payloadState = (state && typeof state === 'object') ? state : {};
            return presenterSyncBridge.post({
                type: presenterSyncBridge.SYNC_MSG.ELEMENT_STATE,
                elementType: toTrimmed(String(elementType || ''), 80),
                slideIndex,
                elementId,
                state: payloadState,
            });
        };
        const subscribeAudienceElementState = (host, elementType, apply) => {
            if (!isAudienceReadOnly || typeof apply !== 'function') return () => {};
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return () => {};
            const safeType = toTrimmed(String(elementType || ''), 80);
            if (!safeType) return () => {};
            const exactKey = elementStateKey(safeType, slideIndex, elementId);
            const fallbackKey = elementStateKey(safeType, slideIndex, '');
            const bootstrap = exactKey
                ? audienceElementStore[exactKey]
                : (fallbackKey ? audienceElementStore[fallbackKey] : null);
            if (bootstrap && typeof bootstrap === 'object') {
                try { apply(bootstrap); } catch (_) {}
            }
            const onState = ev => {
                const detail = ev?.detail || {};
                if (toTrimmed(String(detail.elementType || ''), 80) !== safeType) return;
                const msgSlide = toInt(detail.slideIndex);
                if (msgSlide !== slideIndex) return;
                const msgElementId = toTrimmed(String(detail.elementId || ''), 160);
                if (elementId && msgElementId && msgElementId !== elementId) return;
                try {
                    apply((detail.state && typeof detail.state === 'object') ? detail.state : {});
                } catch (_) {}
            };
            window.addEventListener('oei:audience-element-state', onState);
            return () => window.removeEventListener('oei:audience-element-state', onState);
        };
        const disableInteractiveControls = root => {
            if (!root || typeof root.querySelectorAll !== 'function') return;
            root.querySelectorAll('button,input,select,textarea').forEach(ctrl => {
                try {
                    ctrl.disabled = true;
                    ctrl.style.pointerEvents = 'none';
                } catch (_) {}
            });
            root.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
        };

        // Build shared context object passed to all sub-runtimes
        const ctx = {
            SlidesRenderer,
            isAudienceReadOnly,
            audiencePolicy,
            presenterSyncBridge,
            audienceElementStore,
            emitAudienceElementState,
            subscribeAudienceElementState,
            disableInteractiveControls,
        };

        await global.OEISlidesSpecialMathRuntime.mountMathElements(container, ctx);
        await global.OEISlidesSpecialCodeRuntime.mountCodeElements(container, ctx);
        await global.OEISlidesSpecialQuizRuntime.mountQuizElements(container, ctx);
        await global.OEISlidesSpecialLiveRuntime.mountLiveElements(container, ctx);
    }

    const api = Object.freeze({
        mountSpecialElements,
    });

    global.OEISlidesSpecialRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);
