/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-theme-design
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-theme-design.js"></script>
 */
/* editor-theme-design.js — Theme gallery, color grid, palettes, layout gallery, fonts, and theme manager */

/* ── C1: Theme Mini Gallery ────────────────────────────── */

let _themeHoverRestore = null;

function _applyThemeWithTokens(themeLike) {
    if (!window.OEIDesignTokens?.mergeTheme) {
        SlidesThemes.apply(themeLike);
        return;
    }
    const all = (typeof SlidesThemes.list === 'function') ? SlidesThemes.list() : SlidesThemes.BUILT_IN;
    const base = typeof themeLike === 'string'
        ? (all[themeLike] || SlidesThemes.BUILT_IN.dark)
        : (themeLike || SlidesThemes.BUILT_IN.dark);
    const merged = window.OEIDesignTokens.mergeTheme(base, editor.data?.designTokens || {});
    SlidesThemes.apply(merged);
}

function _themeFromEditorData() {
    const all = (typeof SlidesThemes.list === 'function') ? SlidesThemes.list() : SlidesThemes.BUILT_IN;
    return typeof editor.data.theme === 'string'
        ? (all[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
        : (editor.data.theme || SlidesThemes.BUILT_IN.dark);
}

function _resolvedThemeColors() {
    const fallbackTheme = _themeFromEditorData();
    const resolved = window.OEIDesignTokens?.resolvePresentationTheme
        ? window.OEIDesignTokens.resolvePresentationTheme(editor.data)
        : fallbackTheme;
    return resolved?.colors || fallbackTheme?.colors || {};
}

function renderThemeMiniGallery() {
    const container = document.getElementById('theme-mini-gallery');
    if (!container || !editor.data) return;
    const themes = SlidesThemes.list();
    const quickIds = ['dark', 'light', 'academic', 'terminal', 'ocean', 'icom', 'lyon2'];
    const current = typeof editor.data.theme === 'string' ? editor.data.theme : editor.data.theme?.id;
    const currentColors = _resolvedThemeColors();

    container.innerHTML = quickIds.map(id => themes[id]).filter(Boolean).map(t => {
        const isActive = t.id === current;
        const themePrimary = t.colors?.primary || '#3b82f6';
        const themeSecondary = t.colors?.accent || t.colors?.heading || '#f59e0b';
        const swatchPrimary = isActive
            ? (currentColors.primary || themePrimary)
            : themePrimary;
        const swatchSecondary = isActive
            ? (currentColors.accent || currentColors.heading || themeSecondary)
            : themeSecondary;
        return `<button class="theme-mini-swatch${isActive ? ' active' : ''}"
            type="button"
            data-theme-id="${escAttr(t.id)}"
            title="${escAttr(t.name)}"
            data-tooltip="${escAttr(t.name)}"
            aria-label="${escAttr(t.name)}"
            style="--swatch-primary:${escAttr(swatchPrimary)};--swatch-secondary:${escAttr(swatchSecondary)}"></button>`;
    }).join('');

    container.querySelectorAll('.theme-mini-swatch').forEach(swatch => {
        // G2: Preview on hover
        swatch.addEventListener('mouseenter', () => {
            _themeHoverRestore = typeof editor.data.theme === 'string' ? editor.data.theme : JSON.parse(JSON.stringify(editor.data.theme));
            _applyThemeWithTokens(swatch.dataset.themeId);
            _thumbCssInjected = false;
        });
        swatch.addEventListener('mouseleave', () => {
            if (_themeHoverRestore !== null) {
                _applyThemeWithTokens(_themeHoverRestore);
                _thumbCssInjected = false;
                _themeHoverRestore = null;
            }
        });
        swatch.addEventListener('click', () => {
            _themeHoverRestore = null;
            editor.setTheme(swatch.dataset.themeId);
            buildThemeSelect();
            renderThemeMiniGallery();
            renderThemeColorGrid();
            renderQuickPalette();
        });
    });
}

function renderThemeDuoQuick() {
    // Conservé pour compatibilité: les thèmes rapides sont désormais intégrés à renderThemeMiniGallery().
}

/* ── G3: Theme Color Grid ──────────────────────────────── */

function renderThemeColorGrid() {
    if (!editor.data) return;
    const container = document.getElementById('theme-color-grid');
    if (!container) return;
    const themeData = typeof editor.data.theme === 'string'
        ? (SlidesThemes.BUILT_IN[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
        : (editor.data.theme || SlidesThemes.BUILT_IN.dark);
    const c = themeData.colors || {};
    const keys = ['primary', 'accent', 'heading', 'text', 'slideBg', 'bg'];
    container.innerHTML = keys.map(k =>
        `<div class="theme-color-chip" style="background:${c[k]}" title="${k}: ${c[k]}" data-color-key="${k}" data-color="${c[k]}"></div>`
    ).join('');
    container.querySelectorAll('.theme-color-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const color = chip.dataset.color;
            // Apply as slide background
            const slide = editor.currentSlide;
            if (slide) {
                editor.updateSlide(editor.selectedIndex, { bg: color });
                const bgPick = document.getElementById('ribbon-bg-pick');
                const bgText = document.getElementById('ribbon-bg-text');
                if (bgPick) bgPick.value = colorToHex(color);
                if (bgText) bgText.value = color;
            }
        });
    });
}

/* ── C3: Quick Palette ─────────────────────────────────── */

function renderQuickPalette() {
    const container = document.getElementById('quick-palette');
    if (!container || !editor.data) return;
    const themeData = typeof editor.data.theme === 'string'
        ? (SlidesThemes.BUILT_IN[editor.data.theme] || SlidesThemes.BUILT_IN.dark)
        : (editor.data.theme || SlidesThemes.BUILT_IN.dark);
    const c = themeData.colors || {};
    const colors = [c.slideBg, c.primary, c.accent, c.heading, c.bg].filter(Boolean);
    container.innerHTML = colors.map(col =>
        `<div class="quick-palette-dot" style="background:${col}" title="${col}" data-color="${col}"></div>`
    ).join('');
    container.querySelectorAll('.quick-palette-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const slide = editor.currentSlide;
            if (slide) {
                editor.updateSlide(editor.selectedIndex, { bg: dot.dataset.color });
                const bgPick = document.getElementById('ribbon-bg-pick');
                const bgText = document.getElementById('ribbon-bg-text');
                if (bgPick) bgPick.value = colorToHex(dot.dataset.color);
                if (bgText) bgText.value = dot.dataset.color;
            }
        });
    });
}

/* ── C2: Layout Gallery ────────────────────────────────── */

function renderLayoutGallery() {
    const container = document.getElementById('layout-gallery');
    if (!container) return;
    const layouts = [
        { id: 'title', label: 'Titre', html: '<div class="lt-bar" style="margin:auto;width:70%;height:4px;background:var(--primary)"></div>' },
        { id: 'bullets', label: 'Puces', html: '<div class="lt-bar title"></div><div class="lt-bar" style="width:80%"></div><div class="lt-bar" style="width:60%"></div><div class="lt-bar" style="width:70%"></div>' },
        { id: 'split', label: 'Split', html: '<div class="lt-bar title"></div><div class="lt-cols"><div class="lt-col"></div><div class="lt-col"></div></div>' },
        { id: 'code', label: 'Code', html: '<div class="lt-bar title" style="width:40%"></div><div style="flex:1;background:color-mix(in srgb, var(--muted) 20%, transparent);border-radius:1px;margin-top:1px"></div>' },
        { id: 'canvas', label: 'Canvas', html: '<div style="flex:1;border:1px dashed var(--muted);border-radius:1px;margin:1px"></div>' },
    ];
    container.innerHTML = layouts.map(l =>
        `<div class="layout-thumb" title="${l.label}" data-layout="${l.id}" data-tooltip="${l.label}">${l.html}</div>`
    ).join('');
    container.querySelectorAll('.layout-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
            editor.addSlide(thumb.dataset.layout, editor.selectedIndex);
        });
    });
}

/* ── G1: Font Selector ─────────────────────────────────── */

function initFontSelector() {
    const sel = document.getElementById('ribbon-font-heading');
    if (!sel) return;
    sel.addEventListener('change', () => {
        if (!sel.value) return;
        // Update the current theme's heading font
        const themeData = typeof editor.data.theme === 'string'
            ? { ...SlidesThemes.BUILT_IN[editor.data.theme] }
            : { ...(editor.data.theme || SlidesThemes.BUILT_IN.dark) };
        themeData.fonts = { ...themeData.fonts, heading: sel.value };
        themeData.id = themeData.id || 'custom';
        _applyThemeWithTokens(themeData);
        _thumbCssInjected = false;
    });
}

/* ── G4: Aspect Ratio ──────────────────────────────────── */

const ASPECT_DIMS = { '16:9': [1280, 720], '4:3': [1024, 768], 'a4': [1123, 794] };

function initAspectRatio() {
    document.querySelectorAll('#aspect-select .aspect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#aspect-select .aspect-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const aspect = btn.dataset.aspect;
            const dims = ASPECT_DIMS[aspect] || [1280, 720];
            // Persist aspect ratio to data model
            editor.setMetadata('aspect', aspect);
            applyAspectDims(dims);
        });
    });
}

function applyAspectDims(dims) {
    const frame = document.getElementById('preview-frame');
    if (frame) { frame.style.width = dims[0] + 'px'; frame.style.height = dims[1] + 'px'; }
    const inner = document.querySelectorAll('.sl-thumb-inner');
    inner.forEach(el => { el.style.width = dims[0] + 'px'; el.style.height = dims[1] + 'px'; });
    updatePreviewScale();
}

function restoreAspectRatio() {
    const aspect = editor.data?.metadata?.aspect || '16:9';
    const dims = ASPECT_DIMS[aspect] || [1280, 720];
    document.querySelectorAll('#aspect-select .aspect-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.aspect === aspect);
    });
    applyAspectDims(dims);
}

/* ── C8: Body font ─────────────────────────────────────── */

function initBodyFont() {
    const sel = document.getElementById('ribbon-font-body');
    if (!sel) return;
    sel.addEventListener('change', () => {
        if (!sel.value) return;
        const themeData = typeof editor.data.theme === 'string'
            ? { ...SlidesThemes.BUILT_IN[editor.data.theme] }
            : { ...(editor.data.theme || SlidesThemes.BUILT_IN.dark) };
        themeData.fonts = { ...themeData.fonts, body: sel.value };
        themeData.id = themeData.id || 'custom';
        _applyThemeWithTokens(themeData);
        _thumbCssInjected = false;
    });
}

function _resolveTypographyForUi() {
    const raw = (editor.data && typeof editor.data.typography === 'object' && editor.data.typography)
        ? editor.data.typography
        : {};
    const heading = Number(raw.heading);
    const text = Number(raw.text);
    return {
        heading: Number.isFinite(heading) ? Math.max(12, Math.min(160, Math.round(heading))) : 52,
        text: Number.isFinite(text) ? Math.max(10, Math.min(120, Math.round(text))) : 22,
    };
}

function syncTypographyDefaultsControls() {
    const headingInput = document.getElementById('ribbon-size-heading-global');
    const textInput = document.getElementById('ribbon-size-text-global');
    if (!headingInput || !textInput || !editor.data) return;
    const typography = _resolveTypographyForUi();
    if (document.activeElement !== headingInput) headingInput.value = String(typography.heading);
    if (document.activeElement !== textInput) textInput.value = String(typography.text);
}

function initTypographyDefaultsControls() {
    const headingInput = document.getElementById('ribbon-size-heading-global');
    const textInput = document.getElementById('ribbon-size-text-global');
    if (!headingInput || !textInput) return;
    let timer = null;
    const scheduleCommit = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            editor.setTypographyDefaults({
                heading: headingInput.value,
                text: textInput.value,
            });
        }, 90);
    };
    headingInput.addEventListener('input', scheduleCommit);
    textInput.addEventListener('input', scheduleCommit);
    headingInput.addEventListener('change', scheduleCommit);
    textInput.addEventListener('change', scheduleCommit);
    syncTypographyDefaultsControls();
}

/* ── Theme manager ─────────────────────────────────────── */

function openThemeManager() {
    document.getElementById('theme-modal').style.display = 'flex';
    document.getElementById('theme-editor').style.display = 'none';
    renderThemeGrid();
}

function renderThemeGrid() {
    const grid = document.getElementById('theme-grid');
    const themes = SlidesThemes.list();
    const current = typeof editor.data.theme === 'string' ? editor.data.theme : editor.data.theme?.id;
    const isBuiltIn = id => !!SlidesThemes.BUILT_IN[id];

    grid.innerHTML = Object.values(themes).map(t => {
        const c = t.colors;
        return `<div class="theme-card${t.id === current ? ' active' : ''}" data-theme-id="${t.id}">
            <div class="theme-preview" style="background:${c.slideBg};color:${c.heading}">
                <span style="color:${c.primary}">Aa</span>
            </div>
            <div class="theme-name">${t.name}</div>
            ${!isBuiltIn(t.id) ? `<div style="display:flex;gap:4px;justify-content:center;margin-top:4px">
                <button class="tb-btn" style="padding:2px 6px;font-size:0.65rem" data-theme-edit="${t.id}">✏️</button>
                <button class="tb-btn" style="padding:2px 6px;font-size:0.65rem" data-theme-export="${t.id}">↓</button>
                <button class="tb-btn" style="padding:2px 6px;font-size:0.65rem;color:var(--danger)" data-theme-del="${t.id}">✕</button>
            </div>` : ''}
        </div>`;
    }).join('');

    grid.querySelectorAll('.theme-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('[data-theme-edit],[data-theme-export],[data-theme-del]')) return;
            editor.setTheme(card.dataset.themeId);
            buildThemeSelect();
            renderThemeGrid();
            renderThemeMiniGallery();
            renderThemeDuoQuick();
            renderThemeColorGrid();
            renderQuickPalette();
        });
    });
    grid.querySelectorAll('[data-theme-edit]').forEach(btn => {
        btn.addEventListener('click', () => openThemeEditor(SlidesThemes.list()[btn.dataset.themeEdit]));
    });
    grid.querySelectorAll('[data-theme-export]').forEach(btn => {
        btn.addEventListener('click', () => SlidesThemes.exportTheme(SlidesThemes.list()[btn.dataset.themeExport]));
    });
    grid.querySelectorAll('[data-theme-del]').forEach(btn => {
        btn.addEventListener('click', () => { OEIDialog.confirm('Supprimer ce thème ?', { danger: true }).then(ok => { if (ok) { SlidesThemes.delete(btn.dataset.themeDel); buildThemeSelect(); renderThemeGrid(); } }); });
    });
}

function openThemeEditor(existingTheme) {
    const editorEl = document.getElementById('theme-editor');
    editorEl.style.display = 'block';
    const theme = existingTheme ? JSON.parse(JSON.stringify(existingTheme)) : {
        id: 'custom-' + Date.now(), name: 'Mon thème',
        colors: { ...SlidesThemes.BUILT_IN.dark.colors },
        fonts: { ...SlidesThemes.BUILT_IN.dark.fonts },
    };
    const colorFields = [
        ['bg', 'Fond principal'], ['slideBg', 'Fond slide'], ['heading', 'Titres'],
        ['text', 'Texte'], ['muted', 'Discret'], ['primary', 'Primaire'],
        ['accent', 'Accent'], ['codeBg', 'Fond code'], ['codeText', 'Texte code'],
        ['border', 'Bordure'],
    ];

    editorEl.innerHTML = `
        <p class="props-section-title">Éditeur de thème</p>
        <div class="field"><label>Identifiant</label><input type="text" id="theme-id" value="${escAttr(theme.id)}"></div>
        <div class="field"><label>Nom</label><input type="text" id="theme-name" value="${escAttr(theme.name)}"></div>
        <p class="props-section-title">Couleurs</p>
        <div class="color-grid">
            ${colorFields.map(([key, label]) => `
                <div class="color-row">
                    <label>${label}</label>
                    <input type="color" id="col-${key}" value="${theme.colors[key] || '#000000'}">
                    <input type="text" id="coltxt-${key}" value="${theme.colors[key] || ''}">
                </div>
            `).join('')}
        </div>
        <p class="props-section-title">Polices</p>
        <div class="field"><label>Titres</label><input type="text" id="font-heading" value="${escAttr(theme.fonts.heading || '')}"></div>
        <div class="field"><label>Corps</label><input type="text" id="font-body" value="${escAttr(theme.fonts.body || '')}"></div>
        <div class="field"><label>Code</label><input type="text" id="font-mono" value="${escAttr(theme.fonts.mono || '')}"></div>
        <div class="modal-actions">
            <button class="tb-btn primary" id="save-theme-btn">Sauvegarder</button>
            <button class="tb-btn" id="cancel-theme-btn">Annuler</button>
        </div>`;

    colorFields.forEach(([key]) => {
        const picker = editorEl.querySelector(`#col-${key}`);
        const text = editorEl.querySelector(`#coltxt-${key}`);
        picker.addEventListener('input', () => { text.value = picker.value; theme.colors[key] = picker.value; });
        text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) { picker.value = text.value; theme.colors[key] = text.value; } });
    });

    editorEl.querySelector('#save-theme-btn').addEventListener('click', () => {
        theme.id = editorEl.querySelector('#theme-id').value.trim() || theme.id;
        theme.name = editorEl.querySelector('#theme-name').value.trim() || 'Thème';
        theme.fonts.heading = editorEl.querySelector('#font-heading').value;
        theme.fonts.body = editorEl.querySelector('#font-body').value;
        theme.fonts.mono = editorEl.querySelector('#font-mono').value;
        SlidesThemes.save(theme);
        editor.setTheme(theme.id);
        buildThemeSelect();
        renderThemeGrid();
        renderThemeMiniGallery();
        renderThemeDuoQuick();
        renderThemeColorGrid();
        renderQuickPalette();
        editorEl.style.display = 'none';
        notify('Thème sauvegardé : ' + theme.name, 'success');
    });
    editorEl.querySelector('#cancel-theme-btn').addEventListener('click', () => editorEl.style.display = 'none');
}
