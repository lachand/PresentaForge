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
const _editorAiSettings = window.OEIEditorAISettings || null;
if (!_editorAiSettings) {
    throw new Error('OEIEditorAISettings indisponible: impossible de démarrer la configuration IA éditeur.');
}
const AI_IMAGE_GENERATION_ENABLED = _editorAiSettings.AI_IMAGE_GENERATION_ENABLED;
const AI_PROMPT_DEFAULTS = _editorAiSettings.AI_PROMPT_DEFAULTS;
const AI_IMPORT_PIPELINE_DEFAULTS = _editorAiSettings.AI_IMPORT_PIPELINE_DEFAULTS;
const AI_GEMINI_MODELS = _editorAiSettings.AI_GEMINI_MODELS;
const AI_GEMINI_IMAGE_MODELS = _editorAiSettings.AI_GEMINI_IMAGE_MODELS;
const AI_GEMINI_DEFAULTS = _editorAiSettings.AI_GEMINI_DEFAULTS;
const _sanitizeAIPromptTuningSettings = _editorAiSettings.sanitizeAIPromptTuningSettings;
const _sanitizeAIImportPipelineSettings = _editorAiSettings.sanitizeAIImportPipelineSettings;
const _sanitizeAIGeminiSettings = _editorAiSettings.sanitizeAIGeminiSettings;
const getAIPromptTuningSettings = _editorAiSettings.getAIPromptTuningSettings;
const setAIPromptTuningSettings = _editorAiSettings.setAIPromptTuningSettings;
const getAIImportPipelineSettings = _editorAiSettings.getAIImportPipelineSettings;
const setAIImportPipelineSettings = _editorAiSettings.setAIImportPipelineSettings;
const getAIGeminiSettings = _editorAiSettings.getAIGeminiSettings;
const setAIGeminiSettings = _editorAiSettings.setAIGeminiSettings;
const _editorThemeController = window.OEIThemeRuntime?.createController
    ? window.OEIThemeRuntime.createController({
        scope: 'editor',
        defaultMode: 'light',
        target: 'data-theme',
        rootElement: document.documentElement,
    })
    : null;
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
    const saved = _editorThemeController
        ? _editorThemeController.applyCurrent()
        : (_readTheme() || 'light');
    if (!_editorThemeController) document.documentElement.setAttribute('data-theme', saved);
    updateThemeToggleIcon(saved);
}
function toggleEditorTheme() {
    const next = _editorThemeController
        ? _editorThemeController.toggleMode()
        : (() => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const resolved = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', resolved);
            _writeTheme(resolved);
            return resolved;
        })();
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


const _editorAiPipeline = window.OEIEditorAIPipeline || null;
if (!_editorAiPipeline) {
    throw new Error('OEIEditorAIPipeline indisponible: impossible de démarrer les actions IA éditeur.');
}
const _editorRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
function _resolveEditorRuntimeContext() {
    const runtimeEditor = _editorRuntime?.editor || null;
    const runtimeNotify = _editorRuntime?.notify || null;
    const runtimeEsc = _editorRuntime?.esc || null;
    return {
        editor: runtimeEditor || editor,
        notify: runtimeNotify || notify,
        esc: runtimeEsc || esc,
    };
}

function _openAIPromptTuningModal() {
    const ctx = _resolveEditorRuntimeContext();
    return _editorAiPipeline.openAIPromptTuningModal({
        editor: ctx.editor,
        notify: ctx.notify,
        esc: ctx.esc,
    });
}

function _copyAIPromptToClipboard() {
    const ctx = _resolveEditorRuntimeContext();
    return _editorAiPipeline.copyPromptToClipboard({
        notify: ctx.notify,
    });
}

function _bindToolbarAIButtons() {
    const ctx = _resolveEditorRuntimeContext();
    return _editorAiPipeline.bindToolbarAIButtons({
        editor: ctx.editor,
        notify: ctx.notify,
        esc: ctx.esc,
    });
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

    // AI actions (copie prompt + modal tuning + pipeline) sont déléguées.
    _bindToolbarAIButtons();

    // B3: Import from clipboard
    document.getElementById('btn-open-clipboard')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (window.OEIImportPipeline?.importFromText) {
                notify('Import: exécution des passes IA (plan → placeholders visuels → base64 → validation)…', 'info');
                const result = await window.OEIImportPipeline.importFromText(text, {
                    pipelineSettings: getAIImportPipelineSettings(),
                });
                const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: 'Presse-papier' });
                if (!ok) return;
                editor.load(result.data);
                notify(
                    result.report?.fixes?.length
                        ? `Importé (${result.report.fixes.length} correction(s))`
                        : 'Importé depuis le presse-papier',
                    result.report?.fixes?.length ? 'warning' : 'success'
                );
                return;
            }
            const data = JSON.parse(_repairJsonText(text));
            editor.load(data);
            notify('Importé depuis le presse-papier', 'success');
        } catch (e) {
            const cancelCode = window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED';
            if (e?.code === cancelCode) {
                notify('Import annulé', 'info');
            } else {
                notify('Erreur : contenu invalide dans le presse-papier', 'error');
            }
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
    window.OEIRibbonUI?.initCollapsibleRibbon?.();
}

/* ── Collapsible Panels (Slide list + Notes) ───────────── */

function initCollapsiblePanels() {
    window.OEIRibbonUI?.initCollapsiblePanels?.({
        updatePreviewScale,
    });
}

/* ── F4: Tab Indicator Animation ───────────────────────── */

function updateTabIndicator() {
    window.OEIRibbonUI?.updateTabIndicator?.();
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
    window.OEIRibbonUI?.switchRibbonTab?.(tabId, {
        updateFormatTab,
        updateTabIndicator,
    });
}

function updateRibbonContext() {
    window.OEIRibbonUI?.updateRibbonContext?.(editor, {
        colorToHex,
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
