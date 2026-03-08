/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-ui
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-ui.js"></script>
 */
/* editor-ui.js — UI infrastructure for slide editor */
const _editorUiStorage = window.OEIStorage || null;
const EDITOR_THEME_KEY = _editorUiStorage?.KEYS?.EDITOR_THEME || 'oei-editor-theme';
const _readTheme = () => {
    if (_editorUiStorage?.getRaw) return _editorUiStorage.getRaw(EDITOR_THEME_KEY);
    return localStorage.getItem(EDITOR_THEME_KEY);
};
const _writeTheme = theme => {
    if (_editorUiStorage?.setRaw) return _editorUiStorage.setRaw(EDITOR_THEME_KEY, theme);
    localStorage.setItem(EDITOR_THEME_KEY, theme);
    return true;
};

/* ── Editor Theme (light/dark) ─────────────────────────── */

function initEditorTheme() {
    const saved = _readTheme() || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeToggleIcon(saved);
}
function toggleEditorTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    _writeTheme(next);
    updateThemeToggleIcon(next);
}
function updateThemeToggleIcon(theme) {
    document.getElementById('icon-sun').style.display = theme === 'dark' ? 'block' : 'none';
    document.getElementById('icon-moon').style.display = theme === 'light' ? 'block' : 'none';
}

/* ── F3: Rich Tooltip System ───────────────────────────── */

let _tooltipEl = null;
let _tooltipTimer = null;

function initRichTooltips() {
    _tooltipEl = document.createElement('div');
    _tooltipEl.className = 'rich-tooltip';
    document.body.appendChild(_tooltipEl);

    document.addEventListener('mouseover', e => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) { hideTooltip(); return; }
        clearTimeout(_tooltipTimer);
        _tooltipTimer = setTimeout(() => showTooltip(target), 400);
    });
    document.addEventListener('mouseout', e => {
        const target = e.target.closest('[data-tooltip]');
        if (target) hideTooltip();
    });
    document.addEventListener('mousedown', () => hideTooltip());
}

function showTooltip(target) {
    const raw = target.dataset.tooltip;
    const shortcut = target.dataset.shortcut || '';
    const [title, desc] = raw.includes('|') ? raw.split('|') : [raw, ''];
    let html = `<div class="rich-tooltip-title">${esc(title)}</div>`;
    if (desc) html += `<div class="rich-tooltip-desc">${esc(desc)}</div>`;
    if (shortcut) html += `<span class="rich-tooltip-key">${esc(shortcut)}</span>`;
    _tooltipEl.innerHTML = html;
    _tooltipEl.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const ttRect = _tooltipEl.getBoundingClientRect();
    let left = rect.left + (rect.width - ttRect.width) / 2;
    let top = rect.bottom + 8;
    if (left < 8) left = 8;
    if (left + ttRect.width > window.innerWidth - 8) left = window.innerWidth - ttRect.width - 8;
    if (top + ttRect.height > window.innerHeight - 8) top = rect.top - ttRect.height - 8;
    _tooltipEl.style.left = left + 'px';
    _tooltipEl.style.top = top + 'px';
}

function hideTooltip() {
    clearTimeout(_tooltipTimer);
    if (_tooltipEl) _tooltipEl.classList.remove('visible');
}

/* ── B: Split Button Dropdowns ─────────────────────────── */

function initSplitButtons() {
    const toggleSplitMenu = (menuId, onOpen) => {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        document.querySelectorAll('.split-dropdown').forEach(d => {
            if (d !== menu) d.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden') && typeof onOpen === 'function') onOpen();
    };
    const bindSplitDropdown = (arrowId, menuId, onOpen) => {
        document.getElementById(arrowId)?.addEventListener('click', e => {
            e.stopPropagation();
            toggleSplitMenu(menuId, onOpen);
        });
    };

    // Close any open dropdown when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('.split-btn') && !e.target.closest('.insert-categories-toolbar') && !e.target.closest('.insert-category-menu')) {
            document.querySelectorAll('.split-dropdown').forEach(d => d.classList.add('hidden'));
        }
        // Close shape picker
        if (!e.target.closest('#btn-shape-gallery') && !e.target.closest('#shape-picker')) {
            document.getElementById('shape-picker')?.classList.add('hidden');
        }
        // Close table grid picker
        if (!e.target.closest('#btn-insert-table') && !e.target.closest('#table-grid-picker')) {
            document.getElementById('table-grid-picker')?.classList.add('hidden');
        }
    });

    // Split buttons
    bindSplitDropdown('split-add-arrow', 'split-add-menu', populateAddSlideMenu);
    bindSplitDropdown('split-export-arrow', 'split-export-menu');
    bindSplitDropdown('split-presenter-arrow', 'split-presenter-menu');
    bindSplitDropdown('split-open-arrow', 'split-open-menu', renderRecentFiles);

    // B5: New presentation
    document.getElementById('btn-open-new')?.addEventListener('click', async () => {
        if (await OEIDialog.confirm('Créer une nouvelle présentation ? Les modifications non sauvegardées seront perdues.')) {
            editor.new();
            notify('Nouvelle présentation', 'success');
        }
        document.getElementById('split-open-menu').classList.add('hidden');
    });

    // AI prompt copy button
    document.getElementById('btn-ai-prompt')?.addEventListener('click', async () => {
        try {
            const res = await fetch('../slides/PROMPT_GENERATION_SLIDES.md');
            const md = await res.text();
            const match = md.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
            const prompt = match ? match[1].trim() : md;
            await navigator.clipboard.writeText(prompt);
            notify('Prompt IA copié dans le presse-papier !', 'success');
        } catch (e) {
            notify('Erreur lors de la copie du prompt', 'error');
        }
    });

    // B3: Import from clipboard
    document.getElementById('btn-open-clipboard')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(_repairJsonText(text));
            editor.load(data);
            notify('Importé depuis le presse-papier', 'success');
        } catch (e) {
            notify('Erreur : contenu invalide dans le presse-papier', 'error');
        }
        document.getElementById('split-open-menu').classList.add('hidden');
    });
}

function populateAddSlideMenu() {
    const menu = document.getElementById('split-add-menu');
    menu.innerHTML = SlidesEditor.SLIDE_TYPES.map(t =>
        `<button class="tb-dropdown-item" data-type="${t.id}">
            <span style="display:flex;align-items:center;color:var(--primary)">${t.icon}</span> ${t.label}
        </button>`
    ).join('');
    menu.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            editor.addSlide(btn.dataset.type, editor.selectedIndex);
            menu.classList.add('hidden');
        });
    });
}

/* ── F2: Collapsible Ribbon ────────────────────────────── */

function initCollapsibleRibbon() {
    document.querySelectorAll('.ribbon-tab').forEach(tab => {
        tab.addEventListener('dblclick', () => {
            const ribbon = document.getElementById('ribbon');
            ribbon.classList.toggle('ribbon-collapsed');
        });
    });
}

/* ── Collapsible Panels (Slide list + Notes) ───────────── */

function initCollapsiblePanels() {
    const slideList = document.getElementById('slide-list');
    const expandBtn = document.getElementById('btn-expand-slides');
    const syncSlideListControls = () => {
        if (!slideList || !expandBtn) return;
        expandBtn.style.display = slideList.classList.contains('collapsed') ? '' : 'none';
    };
    window._syncSlideListControls = syncSlideListControls;

    // Slide list collapse/expand
    document.getElementById('btn-collapse-slides')?.addEventListener('click', () => {
        slideList?.classList.add('collapsed');
        syncSlideListControls();
        requestAnimationFrame(() => updatePreviewScale());
    });
    document.getElementById('btn-expand-slides')?.addEventListener('click', () => {
        if (!slideList) return;
        slideList.classList.remove('collapsed');
        const currentWidth = parseFloat(slideList.style.width || '0');
        if (!Number.isFinite(currentWidth) || currentWidth < 140) slideList.style.width = '240px';
        syncSlideListControls();
        requestAnimationFrame(() => updatePreviewScale());
    });
    syncSlideListControls();

    // Notes panel collapse/expand
    const notesBtn = document.getElementById('btn-toggle-notes');
    const notesHandle = document.getElementById('resize-handle-notes');
    notesBtn?.addEventListener('click', () => {
        const panel = document.getElementById('notes-panel');
        const willCollapse = !panel.classList.contains('collapsed');
        if (willCollapse) {
            // Save current height (may be set by resize handle) before collapsing
            panel._savedHeight = panel.style.height || '';
            panel.style.height = '';
            panel.classList.add('collapsed');
        } else {
            panel.classList.remove('collapsed');
            // Restore saved height from resize handle
            if (panel._savedHeight) panel.style.height = panel._savedHeight;
        }
        notesBtn.classList.toggle('rotated', willCollapse);
        notesBtn.title = willCollapse ? 'Afficher les notes' : 'Réduire les notes';
        if (notesHandle) notesHandle.classList.toggle('hidden', willCollapse);
        requestAnimationFrame(() => updatePreviewScale());
    });

    // Props/content panel collapse/expand
    const propsPanel = document.getElementById('props-panel');
    const propsCollapseBtn = document.getElementById('btn-collapse-props');
    const rightHandle = document.getElementById('resize-handle-right');
    propsCollapseBtn?.addEventListener('click', () => {
        const isCollapsed = propsPanel.classList.toggle('collapsed');
        propsPanel._userCollapsed = isCollapsed;
        if (rightHandle) rightHandle.classList.toggle('hidden', isCollapsed);
        requestAnimationFrame(() => updatePreviewScale());
    });
    // Start collapsed
    if (propsPanel) {
        propsPanel.classList.add('collapsed');
        propsPanel._userCollapsed = false;
        if (rightHandle) rightHandle.classList.add('hidden');
    }
}

/* ── F4: Tab Indicator Animation ───────────────────────── */

function updateTabIndicator() {
    const activeTab = document.querySelector('.ribbon-tab.active');
    const indicator = document.getElementById('ribbon-tab-indicator');
    if (!activeTab || !indicator) return;
    const tabsRect = document.getElementById('ribbon-tabs').getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    indicator.style.left = (tabRect.left - tabsRect.left) + 'px';
    indicator.style.width = tabRect.width + 'px';
    indicator.style.opacity = '1';
}

/* ── I3: Auto-save Indicator ───────────────────────────── */

let _savedState = true;

function updateSaveIndicator(saved) {
    _savedState = saved;
    const dot = document.getElementById('save-dot');
    const text = document.getElementById('save-text');
    if (dot) { dot.className = 'save-dot ' + (saved ? 'saved' : 'unsaved'); }
    if (text) text.textContent = saved ? 'Brouillon sauvé' : 'Non sauvegardé';
}

/* ── I4: Breadcrumb ────────────────────────────────────── */

function updateBreadcrumb() {
    // Breadcrumb removed
}

/* ── Ribbon tab switching & context ────────────────────── */

function switchRibbonTab(tabId) {
    document.querySelectorAll('.ribbon-tab').forEach(t => t.classList.toggle('active', t.dataset.ribbon === tabId));
    document.querySelectorAll('.ribbon-panel').forEach(p => p.classList.toggle('active', p.id === 'ribbon-' + tabId));
    // If ribbon was collapsed and we click a tab, expand it
    const ribbon = document.getElementById('ribbon');
    if (ribbon.classList.contains('ribbon-collapsed')) ribbon.classList.remove('ribbon-collapsed');
    requestAnimationFrame(() => updateTabIndicator());
}

function updateRibbonContext() {
    const slide = editor.currentSlide;
    const isCanvas = slide?.type === 'canvas';
    const hasSlide = !!slide;

    // Insertion tab: show/hide canvas element buttons
    const elBtns = document.getElementById('ribbon-insert-elements');
    const elSep = document.getElementById('ribbon-insert-sep');
    const elActions = document.getElementById('ribbon-insert-actions');
    const msg = document.getElementById('ribbon-insert-msg');

    if (elBtns) elBtns.style.display = isCanvas ? '' : 'none';
    if (elSep) elSep.style.display = hasSlide ? '' : 'none';
    if (elActions) elActions.style.display = hasSlide ? '' : 'none';

    document.getElementById('btn-del-element').style.display = isCanvas ? '' : 'none';
    document.getElementById('btn-convert-canvas').style.display = (hasSlide && !isCanvas) ? '' : 'none';

    if (msg) {
        msg.textContent = !hasSlide
            ? 'Aucun slide sélectionné.'
            : !isCanvas
            ? 'Convertissez en canvas pour insérer des éléments librement.'
            : '';
    }

    // Conception tab: update background picker
    const bgPick = document.getElementById('ribbon-bg-pick');
    const bgText = document.getElementById('ribbon-bg-text');
    if (bgPick && slide) bgPick.value = colorToHex(slide.bg || '');
    if (bgText && slide) bgText.value = slide.bg || '';

    // Hide slide button state
    const hideBtn = document.getElementById('btn-hide-slide');
    if (hideBtn && slide) hideBtn.style.background = slide.hidden ? 'var(--primary-muted)' : '';

    // Slide theme override pickers
    const ov = slide?.themeOverride || {};
    const resolvedTheme = window.OEIDesignTokens?.resolvePresentationTheme
        ? window.OEIDesignTokens.resolvePresentationTheme(editor.data)
        : (typeof editor.data?.theme === 'string'
            ? ((typeof SlidesThemes.list === 'function' ? SlidesThemes.list() : SlidesThemes.BUILT_IN)[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
            : (editor.data?.theme || SlidesThemes.BUILT_IN.dark));
    const tc = resolvedTheme?.colors || {};
    ['heading', 'text', 'primary'].forEach(key => {
        const pick = document.getElementById('override-' + key);
        if (!pick) return;
        pick.value = colorToHex(ov[key] || tc[key] || '#000000');
    });
}

/* ── Slide Type Chooser ────────────────────────────────── */

function openSlideTypeChooser() {
    const el = document.getElementById('slide-type-chooser');
    if (!el) return;
    el.classList.add('is-open');
    el.style.display = 'flex';
    const grid = document.getElementById('stc-grid');
    grid.innerHTML = SlidesEditor.SLIDE_TYPES.map(t =>
        `<button class="slide-type-card" data-type="${t.id}">
            <span class="stc-icon">${t.icon}</span>
            <span class="stc-label">${t.label}</span>
        </button>`
    ).join('');
    grid.querySelectorAll('.slide-type-card').forEach(card => {
        card.addEventListener('click', () => {
            editor.addSlide(card.dataset.type, editor.selectedIndex);
            el.classList.remove('is-open');
            el.style.display = 'none';
        });
    });
}
