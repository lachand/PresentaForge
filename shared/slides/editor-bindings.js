/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-bindings
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-bindings.js"></script>
 */
/* editor-bindings.js — Toolbar, ribbon, and keyboard bindings */

function buildTypeButtons() {
    // No-op: emoji grid removed, slide type chooser modal used instead
}

function buildThemeSelect() {
    // No-op: theme-select dropdown removed, theme manager modal used instead
}

const _META_ASPECT_OPTIONS = ['16:9', '4:3', 'a4'];
let _metadataModalBound = false;

function _metadataToday() {
    return new Date().toISOString().slice(0, 10);
}

function _ensureMetadataModal() {
    let modal = document.getElementById('metadata-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'metadata-modal';
        modal.className = 'modal-overlay ui-modal-overlay';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal ui-modal metadata-modal-body">
                <div class="modal-header ui-modal-header">
                    <span class="modal-title ui-modal-title">Métadonnées de la présentation</span>
                    <button class="modal-close ui-modal-close" id="metadata-modal-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="metadata-grid">
                    <div class="field">
                        <label for="meta-title-input">Titre</label>
                        <input type="text" id="meta-title-input" placeholder="Titre de la présentation">
                    </div>
                    <div class="field">
                        <label for="meta-author-input">Auteur</label>
                        <input type="text" id="meta-author-input" placeholder="Nom de l’auteur">
                    </div>
                    <div class="field">
                        <label for="meta-level-input">Niveau</label>
                        <input type="text" id="meta-level-input" placeholder="ex: Licence 2, Master 1, Terminale">
                    </div>
                    <div class="field">
                        <label for="meta-institution-input">Établissement</label>
                        <input type="text" id="meta-institution-input" placeholder="ex: Université, Lycée, école">
                    </div>
                    <div class="field">
                        <label for="meta-id-input">Identifiant interne</label>
                        <input type="text" id="meta-id-input" placeholder="ex: cours-algo-l1">
                    </div>
                    <div class="field">
                        <label for="meta-aspect-input">Format</label>
                        <select id="meta-aspect-input" class="ribbon-select"></select>
                    </div>
                    <div class="field">
                        <label for="meta-created-input">Date de création</label>
                        <input type="date" id="meta-created-input">
                    </div>
                    <div class="field">
                        <label for="meta-modified-input">Dernière modification</label>
                        <input type="date" id="meta-modified-input" disabled>
                    </div>
                </div>
                <div class="field">
                    <label for="meta-description-input">Description</label>
                    <textarea id="meta-description-input" rows="3" placeholder="Résumé de la présentation, contexte, public cible..."></textarea>
                </div>
                <p class="metadata-hint">Ces métadonnées sont conservées dans le JSON et utilisées à l’export.</p>
                <div class="modal-actions ui-modal-actions">
                    <button class="tb-btn" id="metadata-modal-cancel">Annuler</button>
                    <button class="tb-btn primary" id="metadata-modal-save">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
}

function _setMetadataModalOpen(modal, isOpen) {
    if (!modal) return;
    modal.classList.toggle('is-open', !!isOpen);
    modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    modal.style.display = isOpen ? 'flex' : 'none';
}

function _populateMetadataModal(modal) {
    if (!modal || !editor.data) return;
    const meta = editor.data.metadata || {};
    const aspectSel = modal.querySelector('#meta-aspect-input');
    if (aspectSel && !aspectSel.options.length) {
        const dimsMap = (typeof ASPECT_DIMS === 'object' && ASPECT_DIMS) ? ASPECT_DIMS : { '16:9': [1280, 720], '4:3': [1024, 768], a4: [1123, 794] };
        aspectSel.innerHTML = _META_ASPECT_OPTIONS.map(id => {
            const dims = dimsMap[id];
            const dimsLabel = Array.isArray(dims) ? ` (${dims[0]}×${dims[1]})` : '';
            return `<option value="${id}">${id.toUpperCase()}${dimsLabel}</option>`;
        }).join('');
    }

    modal.querySelector('#meta-title-input').value = String(meta.title || '');
    modal.querySelector('#meta-author-input').value = String(meta.author || '');
    modal.querySelector('#meta-level-input').value = String(meta.level || '');
    modal.querySelector('#meta-institution-input').value = String(meta.institution || '');
    modal.querySelector('#meta-id-input').value = String(meta.id || '');
    modal.querySelector('#meta-description-input').value = String(meta.description || '');
    modal.querySelector('#meta-created-input').value = String(meta.created || _metadataToday());
    modal.querySelector('#meta-modified-input').value = String(meta.modified || _metadataToday());
    if (aspectSel) aspectSel.value = _META_ASPECT_OPTIONS.includes(meta.aspect) ? meta.aspect : '16:9';
}

function _saveMetadataFromModal(modal) {
    if (!modal || !editor.data) return false;
    const titleInput = modal.querySelector('#meta-title-input');
    const title = String(titleInput?.value || '').trim();
    if (!title) {
        notify('Le titre est requis', 'error');
        titleInput?.focus();
        return false;
    }
    const prevMeta = editor.data.metadata || {};
    const nextMeta = {
        ...prevMeta,
        title,
        author: String(modal.querySelector('#meta-author-input')?.value || '').trim(),
        level: String(modal.querySelector('#meta-level-input')?.value || '').trim(),
        institution: String(modal.querySelector('#meta-institution-input')?.value || '').trim(),
        description: String(modal.querySelector('#meta-description-input')?.value || '').trim(),
        created: String(modal.querySelector('#meta-created-input')?.value || '').trim() || String(prevMeta.created || _metadataToday()),
        modified: _metadataToday(),
    };
    const idValue = String(modal.querySelector('#meta-id-input')?.value || '').trim();
    if (idValue) nextMeta.id = idValue;
    else delete nextMeta.id;

    const aspectValue = String(modal.querySelector('#meta-aspect-input')?.value || '').trim();
    nextMeta.aspect = _META_ASPECT_OPTIONS.includes(aspectValue) ? aspectValue : (prevMeta.aspect || '16:9');

    editor.data.metadata = nextMeta;
    editor._push();
    editor.onUpdate('meta');
    return true;
}

function openMetadataModal() {
    if (!editor.data) return;
    const modal = _ensureMetadataModal();
    _populateMetadataModal(modal);

    if (!_metadataModalBound) {
        _metadataModalBound = true;
        modal.addEventListener('click', e => {
            if (e.target === modal) _setMetadataModalOpen(modal, false);
        });
        modal.querySelector('#metadata-modal-close')?.addEventListener('click', () => _setMetadataModalOpen(modal, false));
        modal.querySelector('#metadata-modal-cancel')?.addEventListener('click', () => _setMetadataModalOpen(modal, false));
        modal.querySelector('#metadata-modal-save')?.addEventListener('click', () => {
            if (_saveMetadataFromModal(modal)) {
                _setMetadataModalOpen(modal, false);
                notify('Métadonnées mises à jour', 'success');
            }
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) _setMetadataModalOpen(modal, false);
        });
    }

    _setMetadataModalOpen(modal, true);
}

function bindToolbar() {
    document.getElementById('btn-undo').addEventListener('click', () => editor.undo());
    document.getElementById('btn-redo').addEventListener('click', () => editor.redo());

    // Ribbon insertion tab: canvas element buttons
    document.querySelectorAll('#ribbon-insertion .el-type-btn[data-el]').forEach(btn => {
        btn.addEventListener('click', () => { if (canvasEditor) canvasEditor.add(btn.dataset.el); });
    });
    // Connector button: toggle connector creation mode
    document.getElementById('btn-add-connector').addEventListener('click', () => {
        if (!canvasEditor) return;
        canvasEditor.toggleConnectorMode();
        document.getElementById('btn-add-connector').classList.toggle('active', canvasEditor._connectorMode);
    });
    document.getElementById('btn-del-element').addEventListener('click', () => {
        if (canvasEditor && canvasEditor.selectedId) canvasEditor.remove(canvasEditor.selectedId);
    });
    document.getElementById('btn-convert-canvas').addEventListener('click', convertTemplateToCanvas);

    document.getElementById('pres-title').addEventListener('click', () => {
        const title = prompt('Nom de la présentation :', editor.data.metadata.title);
        if (title !== null) editor.setMetadata('title', title);
    });

    document.getElementById('btn-import').addEventListener('click', () => {
        openFromFile();
    });
    document.getElementById('btn-edit-metadata')?.addEventListener('click', openMetadataModal);

    // Import PowerPoint
    document.getElementById('btn-import-pptx')?.addEventListener('click', () => {
        importPowerPoint();
        document.getElementById('split-open-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-import-pdf')?.addEventListener('click', () => {
        importPDF();
        document.getElementById('split-open-menu')?.classList.add('hidden');
    });

    // Export buttons (in ribbon Affichage tab)
    document.getElementById('btn-export-json').addEventListener('click', () => {
        editor.exportJson(); notify('JSON téléchargé', 'success'); saveToRecent();
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    const _runExportWithMediaOptimization = async (fn, reason) => {
        if (typeof window.optimizeMediaForExport === 'function') {
            try {
                await window.optimizeMediaForExport({ reason, silent: true });
            } catch (err) {
                console.warn('Media optimization skipped:', err);
            }
        }
        await Promise.resolve(fn());
    };
    document.getElementById('btn-export-pdf').addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportPDF(), 'pdf');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-html').addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportHTML(), 'html');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-html-offline')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportHTMLOffline(), 'html-offline');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-png')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportPNG(), 'png');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-png-batch')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportPNGBatch(), 'png-batch');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-pptx')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportPPTX(), 'pptx');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-md')?.addEventListener('click', () => { exportMarkdown(); document.getElementById('split-export-menu')?.classList.add('hidden'); });
    document.getElementById('btn-print-notes')?.addEventListener('click', () => { printSpeakerNotes(); document.getElementById('split-export-menu')?.classList.add('hidden'); });
    document.getElementById('btn-qr-slide')?.addEventListener('click', () => { insertQRCodeSlide(); document.getElementById('split-export-menu')?.classList.add('hidden'); });
    document.getElementById('btn-export-student')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportStudentHTML(), 'student-html');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-export-course-pack')?.addEventListener('click', async () => {
        await _runExportWithMediaOptimization(() => exportCoursePack(), 'course-pack');
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });
    document.getElementById('btn-optimize-media')?.addEventListener('click', async () => {
        await window.optimizePresentationMedia?.({ force: true, reason: 'manual-action' });
        document.getElementById('split-export-menu')?.classList.add('hidden');
    });

    document.getElementById('btn-theme-manager').addEventListener('click', openThemeManager);
    document.getElementById('theme-modal-close').addEventListener('click', () => document.getElementById('theme-modal').style.display = 'none');
    document.getElementById('btn-import-theme').addEventListener('click', () => {
        SlidesThemes.importTheme()
            .then(t => { SlidesThemes.save(t); renderThemeGrid(); notify('Thème importé : ' + t.name, 'success'); })
            .catch(e => notify('Erreur : ' + e.message, 'error'));
    });
    document.getElementById('btn-new-theme').addEventListener('click', () => openThemeEditor(null));

    // Editor theme toggle
    document.getElementById('btn-toggle-theme').addEventListener('click', toggleEditorTheme);

    // Slide type chooser
    document.getElementById('btn-add-slide-big').addEventListener('click', openSlideTypeChooser);
    const closeSlideTypeChooser = () => {
        const chooser = document.getElementById('slide-type-chooser');
        if (!chooser) return;
        chooser.classList.remove('is-open');
        chooser.style.display = 'none';
    };
    document.getElementById('stc-close').addEventListener('click', closeSlideTypeChooser);
    document.getElementById('slide-type-chooser')?.addEventListener('click', e => {
        if (e.target === document.getElementById('slide-type-chooser')) closeSlideTypeChooser();
    });
}

/* ── Ribbon bindings ───────────────────────────────────── */

function bindRibbon() {
    // Tab switching
    document.querySelectorAll('.ribbon-tab').forEach(tab => {
        tab.addEventListener('click', () => switchRibbonTab(tab.dataset.ribbon));
    });

    // Accueil tab: slide management
    document.getElementById('btn-add-slide').addEventListener('click', openSlideTypeChooser);
    document.getElementById('btn-dup-slide').addEventListener('click', () => editor.duplicateSlide(editor.selectedIndex));
    document.getElementById('btn-del-slide').addEventListener('click', async () => {
        if (await OEIDialog.confirm('Supprimer ce slide ?', { danger: true })) editor.removeSlide(editor.selectedIndex);
    });

    // A5: Slide move up/down
    document.getElementById('btn-slide-up')?.addEventListener('click', () => slideMove(-1));
    document.getElementById('btn-slide-down')?.addEventListener('click', () => slideMove(1));

    // A6: Hide slide
    document.getElementById('btn-hide-slide')?.addEventListener('click', toggleHideSlide);

    // A1: Clipboard
    document.getElementById('btn-cut')?.addEventListener('click', clipboardCut);
    document.getElementById('btn-copy')?.addEventListener('click', clipboardCopy);
    document.getElementById('btn-paste')?.addEventListener('click', clipboardPaste);
    document.getElementById('btn-paste-format')?.addEventListener('click', () => {
        if (_clipboardStyle) clipboardPasteFormat();
        else copyFormat();
    });

    // Pipette mode
    document.getElementById('btn-pipette')?.addEventListener('click', togglePipetteMode);

    // Fit to content
    document.getElementById('btn-fit-content')?.addEventListener('click', () => {
        if (canvasEditor?.selectedId) canvasEditor.fitToContent();
    });

    // A7/A8: Select all / Group / Ungroup
    document.getElementById('btn-select-all')?.addEventListener('click', selectAll);
    document.getElementById('btn-group')?.addEventListener('click', groupSelected);
    document.getElementById('btn-ungroup')?.addEventListener('click', ungroupSelected);

    // A3-A4: Search
    document.getElementById('btn-search')?.addEventListener('click', openSearchDialog);

    // Conception tab: background color picker
    const bgPick = document.getElementById('ribbon-bg-pick');
    const bgText = document.getElementById('ribbon-bg-text');
    if (bgPick) bgPick.addEventListener('input', () => {
        if (bgText) bgText.value = bgPick.value;
        editor.updateSlide(editor.selectedIndex, { bg: bgPick.value });
    });
    if (bgText) bgText.addEventListener('input', () => {
        editor.updateSlide(editor.selectedIndex, { bg: bgText.value || '' });
    });

    // C5: BG Image
    document.getElementById('btn-bg-image')?.addEventListener('click', openBgImagePicker);

    // C6: Gradient
    document.getElementById('btn-gradient')?.addEventListener('click', openGradientPicker);

    // C7: Apply to all
    document.getElementById('btn-apply-all-bg')?.addEventListener('click', applyBgToAll);

    // Slide theme override
    ['heading', 'text', 'primary'].forEach(key => {
        const pick = document.getElementById('override-' + key);
        if (pick) pick.addEventListener('input', () => {
            const slide = editor.currentSlide;
            if (!slide) return;
            slide.themeOverride = slide.themeOverride || {};
            slide.themeOverride[key] = pick.value;
            editor._pushDebounced(); editor.onUpdate('slide-update');
        });
    });
    document.getElementById('btn-clear-override')?.addEventListener('click', () => {
        const slide = editor.currentSlide;
        if (!slide) return;
        delete slide.themeOverride;
        editor._push(); editor.onUpdate('slide-update');
        notify('Surcharges de thème supprimées', 'info');
    });

    // Affichage tab: grid + outline + checker
    document.getElementById('btn-toggle-grid')?.addEventListener('click', toggleGrid);
    document.getElementById('btn-toggle-outline')?.addEventListener('click', toggleOutlineMode);
    document.getElementById('btn-checker')?.addEventListener('click', runPresentationCheck);
    document.getElementById('btn-assets-manager')?.addEventListener('click', () => window.openAssetsManager?.());
    document.getElementById('btn-design-tokens')?.addEventListener('click', () => window.openDesignTokensManager?.());
    document.getElementById('btn-widget-plugins')?.addEventListener('click', () => window.openWidgetPluginsManager?.());

    // D1: Present
    document.getElementById('btn-presenter')?.addEventListener('click', () => launchPresentation());
    // Presenter dropdown menu
    const presMenu = document.getElementById('split-presenter-menu');
    const hidePresMenu = () => presMenu?.classList.add('hidden');
    document.getElementById('menu-present-normal')?.addEventListener('click', () => {
        hidePresMenu();
        launchPresentation();
    });
    document.getElementById('menu-present-current')?.addEventListener('click', () => {
        hidePresMenu();
        launchPresentation(undefined, true);
    });
    document.getElementById('menu-present-speaker')?.addEventListener('click', () => {
        hidePresMenu();
        launchPresentation('presenter');
    });

    // D3: Ruler
    document.getElementById('btn-ruler')?.addEventListener('click', toggleRuler);

    // D5: Sorter
    document.getElementById('btn-sorter')?.addEventListener('click', openSlideSorter);

    // D6: Theme toggle
    document.getElementById('btn-ribbon-theme-toggle')?.addEventListener('click', toggleEditorTheme);

    // B1: Shape gallery
    document.getElementById('btn-shape-gallery')?.addEventListener('click', toggleShapePicker);

    // B2: Table grid
    document.getElementById('btn-insert-table')?.addEventListener('click', () => {
        const picker = document.getElementById('table-grid-picker');
        if (picker) picker.classList.toggle('hidden');
    });

    // B3: Video
    document.getElementById('btn-insert-video')?.addEventListener('click', openVideoDialog);

    // B6: Callout
    document.getElementById('btn-insert-callout')?.addEventListener('click', insertCallout);

    // B7: SmartArt
    document.getElementById('btn-insert-smartart')?.addEventListener('click', insertSmartArt);

    // B8: Terminal
    document.getElementById('btn-insert-terminal')?.addEventListener('click', insertTerminal);

    // B9-B10: Slide number + Footer + Auto chapter numbering
    document.getElementById('btn-slide-number')?.addEventListener('click', insertSlideNumber);
    document.getElementById('btn-auto-chapter')?.addEventListener('click', toggleAutoNumberChapters);
    document.getElementById('btn-footer')?.addEventListener('click', insertFooter);

    // Layout presets
    document.getElementById('btn-layout-preset')?.addEventListener('click', openLayoutPicker);

    // Revision history
    document.getElementById('btn-revision-history')?.addEventListener('click', openRevisionHistory);

    // Markdown mode
    document.getElementById('btn-markdown-mode')?.addEventListener('click', toggleMarkdownMode);

    // Grid toggle
    document.getElementById('btn-toggle-grid')?.addEventListener('click', () => {
        if (!canvasEditor) return;
        const on = canvasEditor.toggleGrid();
        document.getElementById('btn-toggle-grid').classList.toggle('active', on);
    });

    initInsertionGroupFilter();
}

function initInsertionGroupFilter() {
    const host = document.querySelector('#ribbon-insert-elements .ribbon-group-content');
    if (!host || host.querySelector('.insert-categories-toolbar')) return;

    const icon = name => (typeof window.oeiIcon === 'function' ? window.oeiIcon(name) : '');
    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const groupMeta = [
        { id: 'content', label: 'Contenu', icon: 'text' },
        { id: 'media', label: 'Médias', icon: 'media' },
        { id: 'diagram', label: 'Diagrammes', icon: 'diagram' },
        { id: 'code', label: 'Code', icon: 'code' },
        { id: 'assessment', label: 'Assessment', icon: 'poll' },
        { id: 'activity', label: 'Activités', icon: 'activity' },
        { id: 'facilitation', label: 'Facilitation', icon: 'facilitation' },
        { id: 'integration', label: 'Intégrations', icon: 'integration' },
    ];
    const byElType = {
        heading: 'content',
        text: 'content',
        list: 'content',
        definition: 'content',
        quote: 'content',
        card: 'content',
        table: 'content',
        image: 'media',
        video: 'media',
        qrcode: 'media',
        'gallery-annotable': 'media',
        shape: 'diagram',
        smartart: 'diagram',
        mermaid: 'diagram',
        'decision-tree': 'diagram',
        'timeline-vertical': 'diagram',
        highlight: 'code',
        'code-live': 'code',
        'code-example': 'code',
        latex: 'code',
        'code-compare': 'code',
        'algo-stepper': 'code',
        'quiz-live': 'assessment',
        cloze: 'assessment',
        'mcq-single': 'assessment',
        'mcq-multi': 'assessment',
        'poll-likert': 'assessment',
        'debate-mode': 'assessment',
        'exit-ticket': 'assessment',
        'drag-drop': 'activity',
        'rank-order': 'activity',
        'kanban-mini': 'activity',
        'myth-reality': 'activity',
        'flashcards-auto': 'activity',
        timer: 'facilitation',
        'postit-wall': 'facilitation',
        'audience-roulette': 'facilitation',
        'room-stats': 'facilitation',
        'leaderboard-live': 'facilitation',
        'swot-grid': 'facilitation',
        iframe: 'integration',
        widget: 'integration',
    };
    const byId = {
        'btn-shape-gallery': 'diagram',
        'btn-add-connector': 'diagram',
        'btn-insert-table': 'content',
        'btn-insert-video': 'media',
        'btn-insert-callout': 'content',
    };
    const sourceNodes = Array.from(host.children).filter(node =>
        node.classList?.contains('el-type-btn') || node.classList?.contains('el-inline-wrap')
    );
    const itemsByGroup = new Map(groupMeta.map(g => [g.id, []]));
    const actionByKey = new Map();
    let idx = 0;
    const seenSource = new Set();

    sourceNodes.forEach(node => {
        const btn = node.classList.contains('el-inline-wrap') ? node.querySelector('.el-type-btn') : node;
        if (!btn) return;
        const elType = btn.dataset.el || '';
        const sourceId = btn.id || elType;
        if (!sourceId || seenSource.has(sourceId)) return;
        seenSource.add(sourceId);
        const grp = byElType[elType] || byId[btn.id] || 'content';
        const rawLabel = (btn.textContent || '').replace('▾', '').trim();
        const label = rawLabel || 'Élément';
        const iconHtml = btn.querySelector('.el-icon')?.innerHTML || icon(grp) || icon('text');

        const key = `ins-${idx++}`;
        actionByKey.set(key, () => {
            if (elType) {
                if (canvasEditor) canvasEditor.add(elType);
                return;
            }
            if (sourceId === 'btn-shape-gallery') {
                if (canvasEditor) canvasEditor.add('shape');
                return;
            }
            if (sourceId === 'btn-insert-table') {
                if (canvasEditor) canvasEditor.add('table');
                return;
            }
            if (sourceId === 'btn-insert-video') {
                openVideoDialog();
                return;
            }
            if (sourceId === 'btn-insert-callout') {
                insertCallout();
                return;
            }
            if (sourceId === 'btn-add-connector') {
                if (!canvasEditor) return;
                canvasEditor.toggleConnectorMode();
                document.getElementById('btn-add-connector')?.classList.toggle('active', canvasEditor._connectorMode);
                return;
            }
            btn.click();
        });

        const item = { key, label, iconHtml };
        if (!itemsByGroup.has(grp)) itemsByGroup.set(grp, []);
        itemsByGroup.get(grp).push(item);
    });

    sourceNodes.forEach(node => node.classList.add('insert-source-hidden'));
    document.getElementById('shape-picker')?.classList.add('hidden');
    document.getElementById('table-grid-picker')?.classList.add('hidden');

    const toolbar = document.createElement('div');
    toolbar.className = 'insert-categories-toolbar';
    toolbar.innerHTML = groupMeta.map(g => `
        <div class="split-btn insert-cat-split" data-group="${g.id}">
            <button type="button" class="insert-cat-main" data-group="${g.id}">
                <span class="insert-cat-icon">${icon(g.icon)}</span>
                <span class="insert-cat-label">${esc(g.label)}</span>
            </button>
            <button type="button" class="insert-cat-arrow" data-group="${g.id}" aria-label="Ouvrir ${esc(g.label)}">
                ${icon('chevron_down')}
            </button>
        </div>
    `).join('');

    const menu = document.createElement('div');
    menu.className = 'split-dropdown insert-category-menu hidden';
    menu.innerHTML = '<div class="insert-menu-empty">Aucun élément</div>';

    host.prepend(menu);
    host.prepend(toolbar);

    let openGroup = '';

    const closeMenu = () => {
        menu.classList.add('hidden');
        openGroup = '';
        toolbar.querySelectorAll('.insert-cat-main').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
    };

    const renderMenu = (groupId, anchorSplit) => {
        const entries = itemsByGroup.get(groupId) || [];
        menu.innerHTML = entries.length
            ? entries.map(entry => `
                <button type="button" class="tb-dropdown-item insert-menu-item" data-item-key="${entry.key}">
                    <span class="insert-menu-icon">${entry.iconHtml}</span>
                    <span>${esc(entry.label)}</span>
                </button>
            `).join('')
            : '<div class="insert-menu-empty">Aucun élément</div>';

        menu.querySelectorAll('.insert-menu-item').forEach(itemBtn => {
            itemBtn.addEventListener('click', () => {
                const key = itemBtn.dataset.itemKey || '';
                const action = actionByKey.get(key);
                if (typeof action === 'function') action();
                closeMenu();
            });
        });

        document.querySelectorAll('.split-dropdown').forEach(dropdown => {
            if (dropdown !== menu) dropdown.classList.add('hidden');
        });
        const hostRect = host.getBoundingClientRect();
        const splitRect = anchorSplit.getBoundingClientRect();
        const desiredLeft = splitRect.left - hostRect.left;
        const maxLeft = Math.max(0, host.clientWidth - 280);
        menu.style.left = `${Math.max(0, Math.min(maxLeft, desiredLeft))}px`;
        menu.style.top = `${toolbar.offsetHeight + 6}px`;
        menu.classList.remove('hidden');
        anchorSplit.querySelector('.insert-cat-main')?.setAttribute('aria-expanded', 'true');
    };

    toolbar.querySelectorAll('.insert-cat-split').forEach(split => {
        const groupId = split.dataset.group || groupMeta[0]?.id || '';
        const main = split.querySelector('.insert-cat-main');
        const arrow = split.querySelector('.insert-cat-arrow');
        const onToggle = e => {
            e.preventDefault();
            e.stopPropagation();
            if (!groupId) return;
            if (openGroup === groupId && !menu.classList.contains('hidden')) {
                closeMenu();
                return;
            }
            toolbar.querySelectorAll('.insert-cat-main').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
            openGroup = groupId;
            renderMenu(groupId, split);
        };
        main?.addEventListener('click', onToggle);
        arrow?.addEventListener('click', onToggle);
    });

    document.addEventListener('click', e => {
        if (!host.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenu();
    });
}

function updateToolbarState() {
    document.getElementById('btn-undo').disabled = !editor.canUndo;
    document.getElementById('btn-redo').disabled = !editor.canRedo;
}

function bindKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.target.isContentEditable) return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); editor.undo(); }
            if (e.key === 'z' && e.shiftKey) { e.preventDefault(); editor.redo(); }
            if (e.key === 'y') { e.preventDefault(); editor.redo(); }
            if (e.key === 's') { e.preventDefault(); saveToFile(); }
            if (e.key === 'k') { e.preventDefault(); openCommandPalette(); }
            if (e.key === 'f') { e.preventDefault(); openSearchDialog(); }
            if (e.key === 'x') { e.preventDefault(); clipboardCut(); }
            if (e.key === 'c') { e.preventDefault(); clipboardCopy(); }
            if (e.key === 'v') { e.preventDefault(); clipboardPaste(); }
            if (e.key === 'd') { e.preventDefault(); document.getElementById('fmt-duplicate')?.click(); }
            if (e.key === 'a') { e.preventDefault(); selectAll(); }
            if (e.key === 'g' && e.shiftKey) { e.preventDefault(); ungroupSelected(); }
            else if (e.key === 'g') { e.preventDefault(); groupSelected(); }
        }
        if (e.key === 'F5') { e.preventDefault(); launchPresentation(e.shiftKey ? 'presenter' : undefined); }
        // Arrow keys: nudge selected canvas elements, or navigate/reorder slides
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (canvasEditor && canvasEditor.selectedIds.size > 0) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                canvasEditor.nudge(dx, dy);
            } else {
                if (e.key === 'ArrowUp')   { e.preventDefault(); editor.moveSlide(editor.selectedIndex, editor.selectedIndex - 1); }
                if (e.key === 'ArrowDown') { e.preventDefault(); editor.moveSlide(editor.selectedIndex, editor.selectedIndex + 1); }
                if (e.key === 'ArrowLeft' && editor.selectedIndex > 0) { e.preventDefault(); editor.selectSlide(editor.selectedIndex - 1); }
                if (e.key === 'ArrowRight' && editor.selectedIndex < editor.data.slides.length - 1) { e.preventDefault(); editor.selectSlide(editor.selectedIndex + 1); }
            }
        }
        if (e.key === 'Delete' && e.shiftKey) { OEIDialog.confirm('Supprimer ce slide ?', { danger: true }).then(ok => { if (ok) editor.removeSlide(editor.selectedIndex); }); }
        if (e.key === 'Delete' && !e.shiftKey && canvasEditor?.selectedIds?.size > 0) canvasEditor.removeSelected();
        if (e.key === 'Delete' && !e.shiftKey && canvasEditor?._selectedConnectorId) canvasEditor.removeSelected();
        if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            openQuickInsert();
        }
        if (e.key === 'Escape') {
            // Exit connector mode if active
            if (canvasEditor?._connectorMode) {
                canvasEditor.exitConnectorMode();
                document.getElementById('btn-add-connector')?.classList.remove('active');
            }
            // Exit pipette mode
            if (typeof _pipetteMode !== 'undefined' && _pipetteMode) {
                togglePipetteMode();
            }
            closeCommandPalette();
            closeQuickInsert();
            document.getElementById('search-dialog')?.style.setProperty('display', 'none');
            closeContextMenu();
        }
    });
}
