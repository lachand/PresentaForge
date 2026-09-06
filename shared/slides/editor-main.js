/* =========================================================
   EDITOR CONTROLLER — Shared state & orchestration
   Modules loaded via <script> tags above:
     editor-utils, editor-runtime-state, editor-ai-pipeline, editor-ui, editor-clipboard, editor-search,
     editor-slide-ops, editor-command-palette, editor-theme-design,
     editor-slide-styling, editor-zoom-view, editor-props-panel,
     editor-format-tab, editor-insert, editor-context-menu,
     editor-preview, editor-file-io, editor-export, editor-bindings
   ========================================================= */

/* ── Shared globals (accessed by multiple modules) ───── */
const editor = new SlidesEditor(onUpdate);
let previewScale = 1;
let canvasEditor = null;
let _thumbCssInjected = false;
let _onUpdateDebounceTimer = null;
const EditorRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
if (EditorRuntime?.bindLegacyGlobals) {
    EditorRuntime.bindLegacyGlobals({
        editor,
        notify,
        esc,
        getPreviewScale: () => previewScale,
        getCanvasEditor: () => canvasEditor,
    });
}

/* ── init() — Bootstrap the editor ─────────────────────── */

/**
 * Résout la source du deck initial et le charge, dans un ORDRE strict, chaîne
 * unique `await`ée (pas de fetch parallèle qui ré-écraserait tardivement) :
 *   ?file=X  >  ?firebase=id / sessionStorage (contenu RÉELLEMENT rechargé)  >
 *   brouillon SLIDE_DRAFT (hand-off tableau de bord + autosave)  >  démo  >  vide.
 * `editor._loadGen` est incrémenté par `editor.load()` : si une action utilisateur
 * charge un deck pendant qu'une étape asynchrone est en vol, on abandonne.
 */
async function resolveInitialDeck(params) {
    const fileParam = params.get('file');
    const fbId = params.get('firebase')
        || (() => { try { return sessionStorage.getItem('oei-firebase-open-id'); } catch { return null; } })();
    const startGen = editor._loadGen || 0;
    const superseded = () => (editor._loadGen || 0) !== startGen;

    // Synchroniser sessionStorage + URL (comportement historique).
    if (fbId) {
        try { sessionStorage.setItem('oei-firebase-open-id', fbId); } catch {}
        if (!params.get('firebase')) { try { history.replaceState({}, '', '?firebase=' + encodeURIComponent(fbId)); } catch {} }
    }

    // 1. ?file=X (X ≠ __draft__)
    if (fileParam && fileParam !== '__draft__') {
        try {
            const r = await fetch(fileParam);
            if (!r.ok) throw new Error(String(r.status));
            const data = await r.json();
            if (superseded()) return;
            editor.load(data);
            return;
        } catch {
            notify('Erreur chargement fichier', 'error');
        }
    }

    // 2. Firebase : recharger réellement le contenu (pas seulement armer le badge).
    if (!superseded() && fbId) {
        try {
            await window.OEIFirebase?.ready?.();
            if (!window.OEIFirebase?.isReady?.()) throw new Error('Firebase indisponible');
            const data = await window.OEIFirebase.loadPresentation(fbId);
            if (superseded()) return;
            editor.load(data);
            window.OEIFirebase.setCurrentId(fbId);
            window.OEIFirebase.markLoaded(fbId);
            window.updateFirebaseCloudBadge?.('saved');
            return;
        } catch {
            try { window.OEIFirebase?.clearCurrentId?.(); } catch {}
            try { sessionStorage.removeItem('oei-firebase-open-id'); } catch {}
            try { history.replaceState({}, '', location.pathname); } catch {}
            window.updateFirebaseCloudBadge?.('hidden');
            notify('Impossible de recharger la présentation Firebase — ouverture du brouillon local', 'error');
        }
    }

    // 3. Brouillon local (SLIDE_DRAFT).
    if (!superseded() && editor.loadDraft()) return;

    // 4. Démo par défaut, sinon deck vide.
    if (!superseded()) {
        try {
            const r = await fetch('../data/slides/demo-complete.json');
            if (!r.ok) throw new Error(String(r.status));
            const data = await r.json();
            if (superseded()) return;
            editor.load(data);
        } catch {
            if (!superseded()) editor.new();
        }
    }
}

function init() {
    initEditorTheme();
    const params = new URLSearchParams(location.search);

    resolveInitialDeck(params).catch(err => {
        console.error('[editor] resolveInitialDeck', err);
        if (!(editor._loadGen > 0)) editor.new();
    });

    buildThemeSelect();
    bindToolbar();
    bindRibbon();
    bindKeyboard();
    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);

    // Enhanced ribbon features
    initRichTooltips();
    initSplitButtons();
    initCollapsibleRibbon();
    initCollapsiblePanels();
    initResizablePanels();
    initZoomControls();
    initFontSelector();
    initAspectRatio();
    initTransitions();
    initSlidePadding();
    initBodyFont();
    initTypographyDefaultsControls();
    initTableGridPicker();
    bindFormatTab();
    bindFormatTabEnhanced();
    bindContextMenu();
    bindAlignButtons();
    initFileDrop();
    initCanvasZoom();
    bindBreadcrumb();
    renderThemeMiniGallery();
    renderThemeColorGrid();
    renderQuickPalette();
    renderLayoutGallery();
    initBlockPresetsModal();
    renderShapePicker();
    initTimeline();
    startAutoRevisions();
    initNarration();
    document.fonts.ready.then(() => requestAnimationFrame(() => updateTabIndicator()));
    window.addEventListener('resize', () => updateTabIndicator());

    // Notes textarea handler (debounced)
    let _notesSaveTimer;
    document.getElementById('notes-textarea')?.addEventListener('input', e => {
        clearTimeout(_notesSaveTimer);
        _notesSaveTimer = setTimeout(() => {
            if (editor.currentSlide) {
                editor.data.slides[editor.selectedIndex].notes = e.target.value;
                editor._push();
                const thumbWrap = document.querySelector(`.sl-thumb-wrap[data-idx="${editor.selectedIndex}"]`);
                if (thumbWrap) {
                    const info = thumbWrap.querySelector('.sl-thumb-info');
                    const existing = info?.querySelector('.sl-thumb-notes-dot');
                    if (e.target.value && !existing) {
                        info?.insertAdjacentHTML('beforeend', '<span class="sl-thumb-notes-dot" title="Contient des notes"></span>');
                    } else if (!e.target.value && existing) {
                        existing.remove();
                    }
                }
            }
        }, 600);
    });

    // Per-slide duration (presenter countdown) — debounced
    let _durSaveTimer;
    document.getElementById('slide-duration-input')?.addEventListener('input', e => {
        clearTimeout(_durSaveTimer);
        _durSaveTimer = setTimeout(() => {
            if (editor.currentSlide) {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                    editor.data.slides[editor.selectedIndex].duration = val;
                } else {
                    delete editor.data.slides[editor.selectedIndex].duration;
                }
                editor._push();
            }
        }, 600);
    });

    // Keypoints textarea handler (debounced) — one point per line
    let _kpSaveTimer;
    document.getElementById('keypoints-textarea')?.addEventListener('input', e => {
        clearTimeout(_kpSaveTimer);
        _kpSaveTimer = setTimeout(() => {
            if (editor.currentSlide) {
                const points = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
                editor.data.slides[editor.selectedIndex].keypoints = points;
                editor._push();
            }
        }, 600);
    });

    // Le lien Firebase (?firebase= / sessionStorage) est désormais résolu dans
    // resolveInitialDeck() : le contenu est réellement rechargé depuis Firestore
    // avant d'armer le badge « saved » et l'autosave cloud.

    // Command palette input events
    // Chantier 8 — l'overlay fermait via onclick="closeCommandPalette()" inline (bloqué
    // par la CSP script-src sans 'unsafe-inline') → binding explicite.
    document.getElementById('cmd-overlay')?.addEventListener('click', () => closeCommandPalette());
    document.getElementById('cmd-input')?.addEventListener('input', e => renderCommandResults(e.target.value));
    document.getElementById('cmd-input')?.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeCommandPalette(); return; }
        const items = document.querySelectorAll('#cmd-results .command-palette-item');
        const active = document.querySelector('#cmd-results .command-palette-item.active');
        const activeIdx = [...items].indexOf(active);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[activeIdx]?.classList.remove('active');
            items[Math.min(activeIdx + 1, items.length - 1)]?.classList.add('active');
            items[Math.min(activeIdx + 1, items.length - 1)]?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[activeIdx]?.classList.remove('active');
            items[Math.max(activeIdx - 1, 0)]?.classList.add('active');
            items[Math.max(activeIdx - 1, 0)]?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            document.querySelector('#cmd-results .command-palette-item.active')?.click();
        }
    });
}

/* ── updatePreviewScale() ──────────────────────────────── */

function updatePreviewScale() {
    const wrap = document.getElementById('preview-wrap');
    const { width, height } = wrap.getBoundingClientRect();
    const scaleW = (width - 48) / 1280;
    const scaleH = (height - 48) / 720;
    const fitScale = Math.min(scaleW, scaleH, 1);
    previewScale = fitScale * (_zoomLevel / 100);
    if (EditorRuntime?.setPreviewScale) EditorRuntime.setPreviewScale(previewScale);
    const frame = document.getElementById('preview-frame');
    frame.style.transform = `scale(${previewScale})`;
    const scaler = document.getElementById('preview-scaler');
    scaler.style.width  = Math.round(1280 * previewScale) + 'px';
    scaler.style.height = Math.round(720 * previewScale) + 'px';
    // Enable scrolling when zoomed beyond fit
    const overflows = _zoomLevel > 100;
    wrap.style.overflow = overflows ? 'auto' : 'hidden';
    wrap.style.alignItems = overflows ? 'flex-start' : 'center';
    wrap.style.justifyContent = overflows ? 'flex-start' : 'center';
    if (canvasEditor) canvasEditor.setScale(previewScale);
}

/* ── onUpdate callback (called by SlidesEditor on changes) ── */

function _onUpdateHeavy(reason, skipPropsPanel) {
    renderSlideList();
    renderPreview();
    restoreAspectRatio();
    if (!skipPropsPanel) updatePropsPanel();
    updateTimeline();
    updateNarrationUI();
    if (_outlineMode) renderOutlineView();
}

function onUpdate(reason) {
    if (!editor.data) return;

    // For slide-update while user is interacting with an input (slider, text, color…),
    // debounce heavy DOM work to avoid destroying the active input mid-interaction
    const _ae = document.activeElement;
    const isInteractiveInput = _ae &&
        (_ae.type === 'range' || ((_ae.tagName === 'INPUT' || _ae.tagName === 'TEXTAREA' || _ae.tagName === 'SELECT')
            && _ae.closest('#props-panel, #format-tab-content, .fmt-section, #content-popover')));
    const isDragging = reason === 'slide-update' && isInteractiveInput;

    if (!isDragging) {
        closeContentPopover();
    }

    // Heavy operations: debounce when interacting with inputs
    // Skip updatePropsPanel entirely while editing inside it to avoid destroying the active input
    if (isDragging) {
        const skipProps = _ae && !!_ae.closest('#props-panel');
        clearTimeout(_onUpdateDebounceTimer);
        _onUpdateDebounceTimer = setTimeout(() => {
            // Re-check: if user is still focused inside props-panel, skip its rebuild
            const stillInProps = document.activeElement && document.activeElement.closest('#props-panel');
            _onUpdateHeavy(reason, skipProps || stillInProps);
        }, 150);
    } else {
        clearTimeout(_onUpdateDebounceTimer);
        _onUpdateHeavy(reason, false);
    }

    // Lightweight operations always run
    updateToolbarState();
    const _themeMiniContainer = document.getElementById('theme-mini-gallery');
    const _shouldRefreshThemeRibbons = reason === 'load' || reason === 'new' || reason === 'theme' || (_themeMiniContainer && _themeMiniContainer.childElementCount === 0);
    if (_shouldRefreshThemeRibbons) {
        renderThemeMiniGallery();
        renderThemeColorGrid();
        renderQuickPalette();
    }
    const checkerBadgeUpdater = window.updateCheckerLiveBadge;
    if (typeof checkerBadgeUpdater === 'function') checkerBadgeUpdater();
    const reviewCommentsBadgeUpdater = window.updateReviewCommentsBadge;
    if (typeof reviewCommentsBadgeUpdater === 'function') reviewCommentsBadgeUpdater();
    document.getElementById('pres-title').textContent = editor.data.metadata?.title || 'Sans titre';
    document.getElementById('slide-count').textContent = `(${editor.data.slides.length})`;
    const themeData = window.OEIDesignTokens?.resolvePresentationTheme
        ? window.OEIDesignTokens.resolvePresentationTheme(editor.data)
        : (typeof editor.data.theme === 'string'
            ? (SlidesThemes.BUILT_IN[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
            : (editor.data.theme || SlidesThemes.BUILT_IN.dark));
    const _css = SlidesThemes.generateCSS(themeData);
    // Alias `.cel-*` (préfixe de l'éditeur canvas) = scope de `.sl-*` (viewer) sous #preview-frame.
    // Le rendu d'atome canvas délègue à OEISlidesRendererCanvas.renderElementContent(prefix:'cel')
    // — voir PRESENTAFORGE_PLAN_EXECUTION_2026-08 chantier 3. Les `--sl-*` (tokens de thème)
    // ne sont pas réécrits : l'alias `.cel-*` référence toujours `var(--sl-*)`.
    const _celAlias = _css.replace(/\.reveal/g, '#preview-frame').replace(/\.sl-/g, '.cel-');
    document.getElementById('sl-preview-theme').textContent =
        _css + '\n' + _css.replace(/\.reveal/g, '#preview-frame') + '\n' + _celAlias;
    SlidesThemes.apply(themeData);
    if (!_thumbCssInjected) {
        document.getElementById('sl-thumb-css').textContent = SlidesThemes.generateThumbnailCSS();
        _thumbCssInjected = true;
    }

    // Enhanced ribbon features
    updateRibbonContext();

    // Enhanced ribbon features
    updateBreadcrumb();
    updateStats();
    updateFormatTab();
    updateTransitionUI();
    updateSlidePadding();
    syncTypographyDefaultsControls();
    // Update save indicator based on actual autosave result
    const _lastSaveOk = editor._lastSaveOk !== false;
    updateSaveIndicator(_lastSaveOk);
    if (!_lastSaveOk) {
        notify('Sauvegarde échouée — espace de stockage insuffisant', 'error');
    }
}

/* ── Start ─────────────────────────────────────────────── */
init();
