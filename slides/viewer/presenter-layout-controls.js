// @ts-check

/**
 * Initialize presenter layout controls (font size, scenes, splitters).
 * @param {{
 *   documentRef?: Document,
 *   windowRef?: Window & typeof globalThis,
 *   presenterLayoutKey?: string,
 *   storageGetJSON?: (key: string, fallback?: any) => any,
 *   storageSetJSON?: (key: string, value: any) => boolean,
 *   toTrimmedString?: (value: unknown, maxLen?: number) => string,
 *   toNumberOr?: (value: unknown, fallback?: number) => number,
 *   clampNumber?: (value: number, min: number, max: number) => number,
 *   renderCurrentSlide?: () => void,
 * }} context
 */
export function initPresenterLayoutControls(context = {}) {
    const documentRef = context.documentRef || document;
    const windowRef = context.windowRef || window;
    const presenterLayoutKey = String(context.presenterLayoutKey || 'oei-presenter-layout');
    const storageGetJSON = typeof context.storageGetJSON === 'function'
        ? context.storageGetJSON
        : ((_key, fallback = null) => fallback);
    const storageSetJSON = typeof context.storageSetJSON === 'function'
        ? context.storageSetJSON
        : (() => false);
    const toTrimmedString = typeof context.toTrimmedString === 'function'
        ? context.toTrimmedString
        : ((value, maxLen = 0) => {
            const out = String(value || '').trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        });
    const toNumberOr = typeof context.toNumberOr === 'function'
        ? context.toNumberOr
        : ((value, fallback = 0) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        });
    const clampNumber = typeof context.clampNumber === 'function'
        ? context.clampNumber
        : ((value, min, max) => Math.max(min, Math.min(max, value)));
    const renderCurrentSlide = typeof context.renderCurrentSlide === 'function'
        ? context.renderCurrentSlide
        : () => {};

    const FONT_SIZES = [0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.5, 1.7, 2.0, 2.4];
    let fontSizeIdx = 3; // default 1.05rem
    const pvLayout = documentRef.getElementById('presenter-view');
    if (!pvLayout) {
        return {
            increaseFontSize() {},
            decreaseFontSize() {},
            applyFontSize() {},
            saveLayout() {},
            getFontSizeIndex: () => fontSizeIdx,
            getFontSizes: () => FONT_SIZES.slice(),
        };
    }

    let sceneId = 'balanced';
    let customScene = null;

    try {
        const saved = storageGetJSON(presenterLayoutKey, null);
        if (saved?.notesWidth) {
            pvLayout.style.setProperty('--pv-notes-width', `${saved.notesWidth}px`);
        }
        if (saved?.currentHeight && documentRef.getElementById('pv-splitter-h')) {
            pvLayout.style.setProperty('--pv-current-height', `${saved.currentHeight}%`);
        }
        if (saved?.fontSizeIdx !== undefined) {
            fontSizeIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, saved.fontSizeIdx));
        }
        if (saved?.sceneId) {
            sceneId = toTrimmedString(saved.sceneId, 24) || 'balanced';
        }
        if (saved?.customScene && typeof saved.customScene === 'object') {
            customScene = {
                notesWidth: toNumberOr(saved.customScene.notesWidth, 420),
                fontSizeIdx: Math.max(0, Math.min(FONT_SIZES.length - 1, Math.trunc(toNumberOr(saved.customScene.fontSizeIdx, 3)))),
            };
            if (saved.customScene?.currentHeight != null) {
                customScene.currentHeight = toNumberOr(saved.customScene.currentHeight, 60);
            }
        }
    } catch (_) {}

    const applyFontSize = () => {
        const sz = FONT_SIZES[fontSizeIdx];
        pvLayout.style.setProperty('--pv-notes-font-size', `${sz}rem`);
        const label = documentRef.getElementById('pv-font-size-label');
        if (label) label.textContent = `${Math.round(sz * 100)}%`;
    };
    applyFontSize();

    const saveLayout = () => {
        const notesCol = documentRef.getElementById('pv-notes-col');
        if (!notesCol || typeof notesCol.getBoundingClientRect !== 'function') return;
        const payload = {
            notesWidth: Math.round(notesCol.getBoundingClientRect().width),
            fontSizeIdx,
            sceneId,
        };
        if (customScene) payload.customScene = customScene;
        if (documentRef.getElementById('pv-splitter-h')) {
            const currentPanel = documentRef.getElementById('pv-current-panel');
            const slidesCol = documentRef.getElementById('pv-slides-col');
            if (currentPanel && slidesCol && currentPanel.getBoundingClientRect && slidesCol.getBoundingClientRect) {
                const sh = slidesCol.getBoundingClientRect().height;
                const ch = currentPanel.getBoundingClientRect().height;
                payload.currentHeight = sh > 0 ? Math.round((ch / sh) * 100) : 60;
            }
        }
        storageSetJSON(presenterLayoutKey, payload);
    };

    const increaseFontSize = () => {
        if (fontSizeIdx >= FONT_SIZES.length - 1) return false;
        fontSizeIdx += 1;
        applyFontSize();
        saveLayout();
        return true;
    };
    const decreaseFontSize = () => {
        if (fontSizeIdx <= 0) return false;
        fontSizeIdx -= 1;
        applyFontSize();
        saveLayout();
        return true;
    };

    documentRef.getElementById('pv-font-up')?.addEventListener('click', () => {
        increaseFontSize();
    });
    documentRef.getElementById('pv-font-down')?.addEventListener('click', () => {
        decreaseFontSize();
    });

    // Resizable splitters
    const pvMain = documentRef.getElementById('pv-main');
    const pvSlidesCol = documentRef.getElementById('pv-slides-col');
    const pvNotesCol = documentRef.getElementById('pv-notes-col');
    const pvCurrentPanel = documentRef.getElementById('pv-current-panel');
    const pvSplitterV = documentRef.getElementById('pv-splitter-v');
    const clampNotesWidth = (targetPx = null) => {
        if (!pvNotesCol || typeof pvNotesCol.getBoundingClientRect !== 'function') return;
        const totalW = (pvMain?.getBoundingClientRect?.().width || pvLayout.getBoundingClientRect().width || 0);
        const minW = 280;
        const minSlidesW = Math.max(340, Math.round(totalW * 0.34));
        const splitterW = pvSplitterV?.getBoundingClientRect?.().width || 8;
        const maxRatio = totalW > 0 ? (totalW * 0.62) : 620;
        const maxBySpace = totalW > 0 ? (totalW - minSlidesW - splitterW) : 760;
        const maxW = Math.max(minW, Math.min(860, maxRatio, maxBySpace));
        const fallback = pvNotesCol.getBoundingClientRect().width || 420;
        const fromCssVar = parseFloat(String(pvLayout.style.getPropertyValue('--pv-notes-width') || ''));
        const raw = Number.isFinite(targetPx) ? Number(targetPx) : (Number.isFinite(fromCssVar) ? fromCssVar : fallback);
        const clamped = Math.round(clampNumber(raw, minW, maxW));
        pvLayout.style.setProperty('--pv-notes-width', `${clamped}px`);
    };
    clampNotesWidth();

    const SCENE_PRESETS = {
        balanced: { notesWidth: 420, fontSizeIdx: 3 },
        slide: { notesWidth: 340, fontSizeIdx: 2 },
        notes: { notesWidth: 560, fontSizeIdx: 5 },
    };
    const updateSceneButtons = () => {
        documentRef.getElementById('pv-scene-balanced')?.classList.toggle('active', sceneId === 'balanced');
        documentRef.getElementById('pv-scene-slide')?.classList.toggle('active', sceneId === 'slide');
        documentRef.getElementById('pv-scene-notes')?.classList.toggle('active', sceneId === 'notes');
        documentRef.getElementById('pv-scene-custom')?.classList.toggle('active', sceneId === 'custom');
        documentRef.getElementById('pv-scene-custom')?.toggleAttribute('disabled', !customScene);
    };
    const captureCurrentScene = () => {
        const out = {
            notesWidth: Math.round(pvNotesCol?.getBoundingClientRect?.().width || 420),
            fontSizeIdx,
        };
        if (documentRef.getElementById('pv-splitter-h')) {
            const slidesCol = documentRef.getElementById('pv-slides-col');
            const currentPanel = documentRef.getElementById('pv-current-panel');
            const sh = slidesCol?.getBoundingClientRect?.().height || 0;
            const ch = currentPanel?.getBoundingClientRect?.().height || 0;
            if (sh > 0 && ch > 0) out.currentHeight = Math.round((ch / sh) * 100);
        }
        return out;
    };
    const applyScene = (scene, nextSceneId = '', persist = true) => {
        if (!scene || typeof scene !== 'object') return;
        if (Number.isFinite(Number(scene.notesWidth))) {
            clampNotesWidth(toNumberOr(scene.notesWidth, 420));
        }
        if (scene.currentHeight != null && documentRef.getElementById('pv-splitter-h')) {
            const pct = clampNumber(toNumberOr(scene.currentHeight, 60), 28, 82);
            pvLayout.style.setProperty('--pv-current-height', `${Math.round(pct)}%`);
        }
        if (scene.fontSizeIdx != null) {
            fontSizeIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, Math.trunc(toNumberOr(scene.fontSizeIdx, fontSizeIdx))));
            applyFontSize();
        }
        if (nextSceneId) sceneId = nextSceneId;
        updateSceneButtons();
        renderCurrentSlide();
        if (persist) saveLayout();
    };
    const applyScenePreset = targetSceneId => {
        const preset = SCENE_PRESETS[targetSceneId];
        if (!preset) return;
        applyScene(preset, targetSceneId, true);
    };
    documentRef.getElementById('pv-scene-balanced')?.addEventListener('click', () => applyScenePreset('balanced'));
    documentRef.getElementById('pv-scene-slide')?.addEventListener('click', () => applyScenePreset('slide'));
    documentRef.getElementById('pv-scene-notes')?.addEventListener('click', () => applyScenePreset('notes'));
    documentRef.getElementById('pv-scene-save')?.addEventListener('click', () => {
        customScene = captureCurrentScene();
        sceneId = 'custom';
        updateSceneButtons();
        saveLayout();
    });
    documentRef.getElementById('pv-scene-custom')?.addEventListener('click', () => {
        if (!customScene) return;
        applyScene(customScene, 'custom', true);
    });
    if (sceneId === 'custom' && customScene) {
        applyScene(customScene, 'custom', false);
    } else if (SCENE_PRESETS[sceneId]) {
        applyScene(SCENE_PRESETS[sceneId], sceneId, false);
    } else {
        sceneId = 'balanced';
        updateSceneButtons();
    }

    // Vertical splitter (notes column width)
    if (pvSplitterV && pvNotesCol) {
        pvSplitterV.addEventListener('pointerdown', e => {
            e.preventDefault();
            const pointerId = e.pointerId;
            pvSplitterV.classList.add('dragging');
            pvLayout.classList.add('resizing');
            const startX = e.clientX;
            const startNotesW = pvNotesCol.getBoundingClientRect().width;
            const onMove = ev => {
                if (ev.pointerId !== pointerId) return;
                const dx = startX - ev.clientX;
                const newW = startNotesW + dx;
                clampNotesWidth(newW);
                renderCurrentSlide();
            };
            const onUp = ev => {
                if (ev.pointerId !== pointerId) return;
                pvSplitterV.classList.remove('dragging');
                pvLayout.classList.remove('resizing');
                pvSplitterV.removeEventListener('pointermove', onMove);
                pvSplitterV.removeEventListener('pointerup', onUp);
                pvSplitterV.removeEventListener('pointercancel', onUp);
                try { pvSplitterV.releasePointerCapture(pointerId); } catch (_) {}
                saveLayout();
                renderCurrentSlide();
            };
            try { pvSplitterV.setPointerCapture(pointerId); } catch (_) {}
            pvSplitterV.addEventListener('pointermove', onMove);
            pvSplitterV.addEventListener('pointerup', onUp);
            pvSplitterV.addEventListener('pointercancel', onUp);
        });
    }

    let resizeRaf = 0;
    windowRef.addEventListener('resize', () => {
        if (resizeRaf) windowRef.cancelAnimationFrame(resizeRaf);
        resizeRaf = windowRef.requestAnimationFrame(() => {
            clampNotesWidth();
            renderCurrentSlide();
        });
    });

    // Horizontal splitter (current slide / next slide split)
    const splitterH = documentRef.getElementById('pv-splitter-h');
    if (splitterH && pvSlidesCol && pvCurrentPanel) {
        splitterH.addEventListener('pointerdown', e => {
            e.preventDefault();
            const pointerId = e.pointerId;
            splitterH.classList.add('dragging');
            pvLayout.classList.add('resizing-h');
            const startY = e.clientY;
            const colRect = pvSlidesCol.getBoundingClientRect();
            const startCurH = pvCurrentPanel.getBoundingClientRect().height;
            const availH = colRect.height - 5;
            const onMove = ev => {
                if (ev.pointerId !== pointerId) return;
                const dy = ev.clientY - startY;
                const newH = clampNumber(startCurH + dy, 120, availH - 80);
                const pct = Math.round((newH / colRect.height) * 100);
                pvLayout.style.setProperty('--pv-current-height', `${pct}%`);
                renderCurrentSlide();
            };
            const onUp = ev => {
                if (ev.pointerId !== pointerId) return;
                splitterH.classList.remove('dragging');
                pvLayout.classList.remove('resizing-h');
                splitterH.removeEventListener('pointermove', onMove);
                splitterH.removeEventListener('pointerup', onUp);
                splitterH.removeEventListener('pointercancel', onUp);
                try { splitterH.releasePointerCapture(pointerId); } catch (_) {}
                saveLayout();
                renderCurrentSlide();
            };
            try { splitterH.setPointerCapture(pointerId); } catch (_) {}
            splitterH.addEventListener('pointermove', onMove);
            splitterH.addEventListener('pointerup', onUp);
            splitterH.addEventListener('pointercancel', onUp);
        });
    }

    return {
        increaseFontSize,
        decreaseFontSize,
        applyFontSize,
        saveLayout,
        getFontSizeIndex: () => fontSizeIdx,
        getFontSizes: () => FONT_SIZES.slice(),
    };
}

/**
 * Initialize mobile tab bar (Context / Notes toggle) for presenter view on small screens.
 * @param {{ documentRef?: Document }} context
 */
export function initMobilePresenterTabs(context = {}) {
    const documentRef = context.documentRef || document;
    const tabCtx = documentRef.getElementById('pv-mobile-tab-ctx');
    const tabNotes = documentRef.getElementById('pv-mobile-tab-notes');
    // L'élément porte class="pv-layout" mais id="presenter-view".
    const pvLayout = documentRef.getElementById('presenter-view') || documentRef.querySelector('.pv-layout');
    if (!tabCtx || !tabNotes || !pvLayout) return;

    const setActive = (showNotes) => {
        tabCtx.classList.toggle('active', !showNotes);
        tabCtx.setAttribute('aria-selected', String(!showNotes));
        tabNotes.classList.toggle('active', showNotes);
        tabNotes.setAttribute('aria-selected', String(showNotes));
        pvLayout.classList.toggle('pv-notes-active', showNotes);
    };

    tabCtx.addEventListener('click', () => setActive(false));
    tabNotes.addEventListener('click', () => setActive(true));
}
