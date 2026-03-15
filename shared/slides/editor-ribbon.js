/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-ribbon
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-ribbon.js"></script>
 */
/* editor-ribbon.js — Ribbon/tabs/context orchestration for slide editor */
(function initEditorRibbonModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const DEFAULT_IDS = Object.freeze({
        ribbon: 'ribbon',
        tabs: 'ribbon-tabs',
        indicator: 'ribbon-tab-indicator',
        insertElements: 'ribbon-insert-elements',
        insertSeparator: 'ribbon-insert-sep',
        insertActions: 'ribbon-insert-actions',
        insertMessage: 'ribbon-insert-msg',
        deleteElementButton: 'btn-del-element',
        convertCanvasButton: 'btn-convert-canvas',
        backgroundPicker: 'ribbon-bg-pick',
        backgroundText: 'ribbon-bg-text',
        hideSlideButton: 'btn-hide-slide',
    });

    function _resolveTheme(editorData) {
        if (root.OEIDesignTokens?.resolvePresentationTheme) {
            return root.OEIDesignTokens.resolvePresentationTheme(editorData);
        }

        const themes = root.SlidesThemes;
        const builtIn = themes?.BUILT_IN || {};
        const fallbackTheme = builtIn.dark || null;
        if (typeof editorData?.theme === 'string') {
            const listedThemes = typeof themes?.list === 'function' ? themes.list() : builtIn;
            return listedThemes?.[editorData.theme] || fallbackTheme;
        }
        return editorData?.theme || fallbackTheme;
    }

    function initCollapsibleRibbon(options = {}) {
        const tabSelector = options.tabSelector || '.ribbon-tab';
        const ribbonId = options.ribbonId || DEFAULT_IDS.ribbon;
        document.querySelectorAll(tabSelector).forEach(tab => {
            if (tab.dataset.oeiRibbonBound === '1') return;
            tab.dataset.oeiRibbonBound = '1';
            tab.addEventListener('dblclick', () => {
                const ribbon = document.getElementById(ribbonId);
                if (!ribbon) return;
                ribbon.classList.toggle('ribbon-collapsed');
            });
        });
    }

    function initCollapsiblePanels(options = {}) {
        const updatePreviewScale = typeof options.updatePreviewScale === 'function'
            ? options.updatePreviewScale
            : (() => {});
        const slideList = document.getElementById(options.slideListId || 'slide-list');
        const expandBtn = document.getElementById(options.expandSlidesButtonId || 'btn-expand-slides');
        const syncSlideListControls = () => {
            if (!slideList || !expandBtn) return;
            expandBtn.style.display = slideList.classList.contains('collapsed') ? '' : 'none';
        };
        root._syncSlideListControls = syncSlideListControls;

        document.getElementById(options.collapseSlidesButtonId || 'btn-collapse-slides')?.addEventListener('click', () => {
            slideList?.classList.add('collapsed');
            syncSlideListControls();
            requestAnimationFrame(() => updatePreviewScale());
        });
        document.getElementById(options.expandSlidesButtonId || 'btn-expand-slides')?.addEventListener('click', () => {
            if (!slideList) return;
            slideList.classList.remove('collapsed');
            const currentWidth = parseFloat(slideList.style.width || '0');
            if (!Number.isFinite(currentWidth) || currentWidth < 140) slideList.style.width = '240px';
            syncSlideListControls();
            requestAnimationFrame(() => updatePreviewScale());
        });
        syncSlideListControls();

        const notesBtn = document.getElementById(options.toggleNotesButtonId || 'btn-toggle-notes');
        const notesHandle = document.getElementById(options.notesResizeHandleId || 'resize-handle-notes');
        notesBtn?.addEventListener('click', () => {
            const panel = document.getElementById(options.notesPanelId || 'notes-panel');
            if (!panel) return;
            const willCollapse = !panel.classList.contains('collapsed');
            if (willCollapse) {
                panel._savedHeight = panel.style.height || '';
                panel.style.height = '';
                panel.classList.add('collapsed');
            } else {
                panel.classList.remove('collapsed');
                if (panel._savedHeight) panel.style.height = panel._savedHeight;
            }
            notesBtn.classList.toggle('rotated', willCollapse);
            notesBtn.title = willCollapse ? 'Afficher les notes' : 'Réduire les notes';
            if (notesHandle) notesHandle.classList.toggle('hidden', willCollapse);
            requestAnimationFrame(() => updatePreviewScale());
        });

        const propsPanel = document.getElementById(options.propsPanelId || 'props-panel');
        const propsCollapseBtn = document.getElementById(options.collapsePropsButtonId || 'btn-collapse-props');
        const rightHandle = document.getElementById(options.rightResizeHandleId || 'resize-handle-right');
        propsCollapseBtn?.addEventListener('click', () => {
            if (!propsPanel) return;
            const isCollapsed = propsPanel.classList.toggle('collapsed');
            propsPanel._userCollapsed = isCollapsed;
            if (rightHandle) rightHandle.classList.toggle('hidden', isCollapsed);
            requestAnimationFrame(() => updatePreviewScale());
        });

        if (propsPanel) {
            propsPanel.classList.add('collapsed');
            // Start in sticky-collapsed mode: opening the panel must be an explicit user action.
            propsPanel._userCollapsed = true;
            if (rightHandle) rightHandle.classList.add('hidden');
        }
    }

    function updateTabIndicator(options = {}) {
        const activeTabSelector = options.activeTabSelector || '.ribbon-tab.active';
        const indicatorId = options.indicatorId || DEFAULT_IDS.indicator;
        const tabsId = options.tabsId || DEFAULT_IDS.tabs;
        const activeTab = document.querySelector(activeTabSelector);
        const indicator = document.getElementById(indicatorId);
        const tabs = document.getElementById(tabsId);
        if (!activeTab || !indicator || !tabs) return;
        const tabsRect = tabs.getBoundingClientRect();
        const tabRect = activeTab.getBoundingClientRect();
        indicator.style.left = (tabRect.left - tabsRect.left) + 'px';
        indicator.style.width = tabRect.width + 'px';
        indicator.style.opacity = '1';
    }

    function switchRibbonTab(tabId, options = {}) {
        const normalizedTabId = String(tabId || '').trim();
        if (!normalizedTabId) return;
        const tabSelector = options.tabSelector || '.ribbon-tab';
        const panelSelector = options.panelSelector || '.ribbon-panel';
        const ribbonId = options.ribbonId || DEFAULT_IDS.ribbon;

        document.querySelectorAll(tabSelector).forEach(tab => {
            tab.classList.toggle('active', tab.dataset.ribbon === normalizedTabId);
        });
        document.querySelectorAll(panelSelector).forEach(panel => {
            panel.classList.toggle('active', panel.id === 'ribbon-' + normalizedTabId);
        });

        const ribbon = document.getElementById(ribbonId);
        if (ribbon?.classList.contains('ribbon-collapsed')) {
            ribbon.classList.remove('ribbon-collapsed');
        }
        if (normalizedTabId === 'format' && typeof options.updateFormatTab === 'function') {
            options.updateFormatTab();
        }

        const indicatorUpdater = typeof options.updateTabIndicator === 'function'
            ? options.updateTabIndicator
            : () => updateTabIndicator(options);
        requestAnimationFrame(() => indicatorUpdater());
    }

    function updateRibbonContext(editor, options = {}) {
        const slide = editor?.currentSlide;
        const isCanvas = slide?.type === 'canvas';
        const hasSlide = !!slide;
        const colorToHex = typeof options.colorToHex === 'function'
            ? options.colorToHex
            : (value => String(value || ''));

        const elBtns = document.getElementById(options.insertElementsId || DEFAULT_IDS.insertElements);
        const elSep = document.getElementById(options.insertSeparatorId || DEFAULT_IDS.insertSeparator);
        const elActions = document.getElementById(options.insertActionsId || DEFAULT_IDS.insertActions);
        const msg = document.getElementById(options.insertMessageId || DEFAULT_IDS.insertMessage);

        if (elBtns) elBtns.style.display = isCanvas ? '' : 'none';
        if (elSep) elSep.style.display = hasSlide ? '' : 'none';
        if (elActions) elActions.style.display = hasSlide ? '' : 'none';

        const delElementBtn = document.getElementById(options.deleteElementButtonId || DEFAULT_IDS.deleteElementButton);
        const convertCanvasBtn = document.getElementById(options.convertCanvasButtonId || DEFAULT_IDS.convertCanvasButton);
        if (delElementBtn) delElementBtn.style.display = isCanvas ? '' : 'none';
        if (convertCanvasBtn) convertCanvasBtn.style.display = (hasSlide && !isCanvas) ? '' : 'none';

        if (msg) {
            msg.textContent = !hasSlide
                ? 'Aucun slide sélectionné.'
                : !isCanvas
                ? 'Convertissez en canvas pour insérer des éléments librement.'
                : '';
        }

        const bgPick = document.getElementById(options.backgroundPickerId || DEFAULT_IDS.backgroundPicker);
        const bgText = document.getElementById(options.backgroundTextId || DEFAULT_IDS.backgroundText);
        if (bgPick && slide) bgPick.value = colorToHex(slide.bg || '');
        if (bgText && slide) bgText.value = slide.bg || '';

        const hideBtn = document.getElementById(options.hideSlideButtonId || DEFAULT_IDS.hideSlideButton);
        if (hideBtn && slide) hideBtn.style.background = slide.hidden ? 'var(--primary-muted)' : '';

        const ov = slide?.themeOverride || {};
        const resolvedTheme = _resolveTheme(editor?.data);
        const tc = resolvedTheme?.colors || {};
        ['heading', 'text', 'primary'].forEach(key => {
            const pick = document.getElementById('override-' + key);
            if (!pick) return;
            pick.value = colorToHex(ov[key] || tc[key] || '#000000');
        });
    }

    root.OEIRibbonUI = Object.freeze({
        initCollapsibleRibbon,
        initCollapsiblePanels,
        updateTabIndicator,
        switchRibbonTab,
        updateRibbonContext,
    });
})(window);
