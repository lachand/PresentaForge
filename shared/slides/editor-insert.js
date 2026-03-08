/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-insert
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-insert.js"></script>
 */
/* editor-insert.js — Shape picker, table grid, video embed, callout, SmartArt, terminal, slide number, footer */

const SHAPES = [
    { id: 'rect', label: 'Rectangle', svg: '<rect x="2" y="2" width="20" height="20" rx="2"/>' },
    { id: 'ellipse', label: 'Ellipse', svg: '<ellipse cx="12" cy="12" rx="10" ry="8"/>' },
    { id: 'triangle', label: 'Triangle', svg: '<polygon points="12,2 22,22 2,22"/>' },
    { id: 'diamond', label: 'Losange', svg: '<polygon points="12,2 22,12 12,22 2,12"/>' },
    { id: 'hexagon', label: 'Hexagone', svg: '<polygon points="6,2 18,2 23,12 18,22 6,22 1,12"/>' },
    { id: 'star', label: 'Étoile', svg: '<polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9"/>' },
    { id: 'arrow-right', label: 'Flèche →', svg: '<polygon points="2,8 16,8 16,3 22,12 16,21 16,16 2,16"/>' },
    { id: 'rounded-rect', label: 'Rect arrondi', svg: '<rect x="2" y="4" width="20" height="16" rx="8"/>' },
];
const FOOTER_TEMPLATE_DEFAULT = '{{title}} · {{author}} · {{year}}';
let _footerConfigModalBound = false;

function renderShapePicker() {
    const picker = document.getElementById('shape-picker');
    if (!picker) return;
    picker.innerHTML = SHAPES.map(s =>
        `<div class="shape-pick-item" data-shape="${s.id}" title="${s.label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">${s.svg}</svg></div>`
    ).join('');
    picker.querySelectorAll('.shape-pick-item').forEach(el => {
        el.addEventListener('click', () => {
            if (!canvasEditor) return;
            const shape = el.dataset.shape;
            canvasEditor.add('shape');
            // Update newly added shape's data
            const slide = editor.currentSlide;
            if (slide?.elements?.length) {
                const last = slide.elements[slide.elements.length - 1];
                last.data = { ...last.data, shapeType: shape };
                last.style = { ...last.style, fill: '#818cf8' };
                editor._push();
            }
            picker.classList.add('hidden');
        });
    });
}

function toggleShapePicker() {
    const picker = document.getElementById('shape-picker');
    if (!picker) return;
    picker.classList.toggle('hidden');
    if (!picker.classList.contains('hidden') && !picker.children.length) renderShapePicker();
}

/* ── B2: Table Grid Picker ─────────────────────────────── */

function initTableGridPicker() {
    const grid = document.getElementById('table-grid');
    const label = document.getElementById('table-grid-label');
    if (!grid) return;
    // Create 6x6 grid
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = document.createElement('div');
            cell.className = 'table-grid-cell';
            cell.dataset.row = r; cell.dataset.col = c;
            cell.addEventListener('mouseenter', () => {
                grid.querySelectorAll('.table-grid-cell').forEach(cl => {
                    cl.classList.toggle('active', +cl.dataset.row <= r && +cl.dataset.col <= c);
                });
                label.textContent = `${c + 1} × ${r + 1}`;
            });
            cell.addEventListener('click', () => {
                insertTable(r + 1, c + 1);
                document.getElementById('table-grid-picker').classList.add('hidden');
            });
            grid.appendChild(cell);
        }
    }
}

function insertTable(rows, cols) {
    if (!canvasEditor) return;
    const tableRows = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push(r === 0 ? `En-tête ${c + 1}` : 'Cellule');
        }
        tableRows.push(row);
    }
    const el = canvasEditor.add('table');
    if (!el) return;
    canvasEditor.updateData(el.id, {
        w: Math.max(400, cols * 150),
        h: Math.max(180, rows * 44 + 10),
        data: { rows: tableRows }
    });
}

/* ── B3: Video Embed ───────────────────────────────────── */

function openVideoDialog() {
    let dlg = document.getElementById('embed-dialog');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'embed-dialog';
        dlg.className = 'embed-dialog';
        dlg.innerHTML = `
            <h3 style="margin:0 0 12px;font-size:0.9rem;color:var(--text)">Intégrer une vidéo</h3>
            <input type="text" id="video-url-input" placeholder="URL YouTube ou Vimeo" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:0.8rem;margin-bottom:12px;box-sizing:border-box">
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="btn-video-cancel" style="padding:6px 16px;border-radius:var(--radius);border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer">Annuler</button>
                <button id="btn-video-ok" style="padding:6px 16px;border-radius:var(--radius);border:none;background:var(--primary);color:white;cursor:pointer">Insérer</button>
            </div>`;
        document.body.appendChild(dlg);
        document.getElementById('btn-video-cancel').addEventListener('click', () => dlg.style.display = 'none');
        document.getElementById('btn-video-ok').addEventListener('click', () => {
            const url = document.getElementById('video-url-input').value.trim();
            if (!url) return;
            insertVideoElement(url);
            dlg.style.display = 'none';
        });
    }
    dlg.style.display = 'flex';
    document.getElementById('video-url-input').value = '';
    document.getElementById('video-url-input').focus();
}

function insertVideoElement(url) {
    if (!canvasEditor) return;
    let embedUrl = url;
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    const el = canvasEditor.add('video');
    if (el) {
        canvasEditor.updateData(el.id, { data: { src: url, embedUrl } });
    }
}

/* ── B6: Callout ───────────────────────────────────────── */

function insertCallout() {
    if (!canvasEditor) return;
    canvasEditor.add('card');
    const slide = editor.currentSlide;
    if (slide?.elements?.length) {
        const last = slide.elements[slide.elements.length - 1];
        last.data = { ...last.data, title: 'ℹ️ Info', text: 'Texte du callout…' };
        last.style = { ...last.style, fill: 'rgba(59, 130, 246, 0.15)', borderLeft: '4px solid #3b82f6', borderRadius: '0 8px 8px 0' };
        editor._push();
    }
}

/* ── B7: SmartArt ──────────────────────────────────────── */

function insertSmartArt() {
    if (!canvasEditor) return;
    // Insert 3 connected shapes
    const colors = ['#818cf8', '#34d399', '#f97316'];
    const labels = ['Étape 1', 'Étape 2', 'Étape 3'];
    const slide = editor.currentSlide;
    if (!slide || slide.type !== 'canvas') return;
    slide.elements = slide.elements || [];
    for (let i = 0; i < 3; i++) {
        slide.elements.push({
            id: 'el-' + Date.now() + '-' + i,
            type: 'shape', x: 100 + i * 350, y: 280, w: 280, h: 140, z: 10 + i,
            data: { text: labels[i], shapeType: 'rounded-rect' },
            style: { fill: colors[i], color: '#ffffff', fontSize: 22, fontWeight: 600, textAlign: 'center' }
        });
    }
    editor._push();
}

/* ── B8: Terminal ──────────────────────────────────────── */

function insertTerminal() {
    if (!canvasEditor) return;
    canvasEditor.add('highlight');
    const slide = editor.currentSlide;
    if (slide?.elements?.length) {
        const last = slide.elements[slide.elements.length - 1];
        last.data = { ...last.data, code: '$ echo "Hello World"\nHello World\n$ _', language: 'bash', highlights: [] };
        last.w = 620; last.h = 280;
        editor._push();
    }
}

/* ── B9-B10: Slide number & Footer ─────────────────────── */

function insertSlideNumber() {
    if (!editor.data) return;
    editor.data.showSlideNumber = !editor.data.showSlideNumber;
    if (editor.data.showSlideNumber) {
        notify('N° de slide activés', 'success');
    } else {
        notify('N° de slide désactivés', 'info');
    }
    editor._push();
    renderSlideList(); renderPreview();
}

function toggleAutoNumberChapters() {
    if (!editor.data) return;
    editor.data.autoNumberChapters = !editor.data.autoNumberChapters;
    if (editor.data.autoNumberChapters) {
        notify('Numérotation auto des chapitres activée (01, 02…)', 'success');
    } else {
        notify('Numérotation auto des chapitres désactivée', 'info');
    }
    editor._push();
    renderSlideList(); renderPreview();
}

function _normalizeFooterConfigFromData(data) {
    const source = (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : {};
    const nowYear = String(new Date().getFullYear());
    return {
        enabled: source.enabled != null ? !!source.enabled : !!data?.footerText,
        template: (typeof source.template === 'string' && source.template.trim())
            ? source.template
            : ((typeof data?.footerText === 'string' && data.footerText.trim()) ? data.footerText : FOOTER_TEMPLATE_DEFAULT),
        title: typeof source.title === 'string' ? source.title : '',
        author: typeof source.author === 'string' ? source.author : '',
        year: (typeof source.year === 'string' && source.year.trim()) ? source.year : '',
        date: typeof source.date === 'string' ? source.date : '',
        line1: typeof source.line1 === 'string' ? source.line1 : '',
    };
}

function _buildFooterTemplateValues(data, cfg, slideIndex, totalSlides) {
    const metadata = (data && typeof data.metadata === 'object' && data.metadata) ? data.metadata : {};
    const title = String(cfg?.title || metadata.title || '').trim();
    const author = String(cfg?.author || metadata.author || '').trim();
    const year = String(cfg?.year || new Date().getFullYear()).trim();
    const date = String(cfg?.date || metadata.modified || metadata.created || '').trim();
    const line1 = String(cfg?.line1 || '').trim();
    return {
        title,
        author,
        year,
        date,
        line1,
        slideNumber: String((Number(slideIndex) || 0) + 1),
        totalSlides: String(Math.max(1, Number(totalSlides) || 1)),
    };
}

function _renderFooterTemplate(template, values) {
    return String(template || '')
        .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
            if (Object.prototype.hasOwnProperty.call(values, key)) return String(values[key] ?? '');
            return '';
        })
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function _ensureFooterConfigModal() {
    let modal = document.getElementById('footer-config-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'footer-config-modal';
        modal.className = 'modal-overlay ui-modal-overlay';
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal ui-modal footer-config-modal-body">
                <div class="modal-header ui-modal-header">
                    <span class="modal-title ui-modal-title">Configurer le pied de page</span>
                    <button class="modal-close ui-modal-close" id="footer-config-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="field footer-field-inline">
                    <label class="footer-inline-check">
                        <input type="checkbox" id="footer-enabled">
                        Activer le pied de page sur toutes les diapositives
                    </label>
                </div>
                <div class="field">
                    <label for="footer-template-input">Modèle</label>
                    <textarea id="footer-template-input" rows="2" placeholder="{{title}} · {{author}} · {{year}}"></textarea>
                </div>
                <div class="footer-token-hint">Variables: <code>{{title}}</code> <code>{{author}}</code> <code>{{year}}</code> <code>{{date}}</code> <code>{{line1}}</code> <code>{{slideNumber}}</code> <code>{{totalSlides}}</code></div>
                <div class="field">
                    <label for="footer-line1-input">Ligne libre (optionnelle)</label>
                    <input type="text" id="footer-line1-input" placeholder="Ex: Cours INFO-101">
                </div>
                <div class="footer-grid-2">
                    <div class="field">
                        <label for="footer-title-input">Titre (optionnel, sinon metadata.title)</label>
                        <input type="text" id="footer-title-input" placeholder="">
                    </div>
                    <div class="field">
                        <label for="footer-author-input">Auteur (optionnel, sinon metadata.author)</label>
                        <input type="text" id="footer-author-input" placeholder="">
                    </div>
                    <div class="field">
                        <label for="footer-year-input">Année</label>
                        <input type="text" id="footer-year-input" placeholder="">
                    </div>
                    <div class="field">
                        <label for="footer-date-input">Date (optionnelle)</label>
                        <input type="text" id="footer-date-input" placeholder="">
                    </div>
                </div>
                <div class="field">
                    <label>Aperçu</label>
                    <div class="footer-preview-box" id="footer-preview-box"></div>
                </div>
                <div class="modal-actions ui-modal-actions">
                    <button class="tb-btn" id="footer-config-disable">Désactiver</button>
                    <button class="tb-btn" id="footer-config-cancel">Annuler</button>
                    <button class="tb-btn primary" id="footer-config-save">Appliquer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
}

function _setFooterModalOpen(modal, isOpen) {
    if (!modal) return;
    modal.classList.toggle('is-open', !!isOpen);
    modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    modal.style.display = isOpen ? 'flex' : 'none';
}

function _readFooterConfigFromModal(modal) {
    return {
        enabled: !!modal.querySelector('#footer-enabled')?.checked,
        template: String(modal.querySelector('#footer-template-input')?.value || '').trim(),
        title: String(modal.querySelector('#footer-title-input')?.value || '').trim(),
        author: String(modal.querySelector('#footer-author-input')?.value || '').trim(),
        year: String(modal.querySelector('#footer-year-input')?.value || '').trim(),
        date: String(modal.querySelector('#footer-date-input')?.value || '').trim(),
        line1: String(modal.querySelector('#footer-line1-input')?.value || '').trim(),
    };
}

function _writeFooterConfigToModal(modal, cfg, data) {
    const metadata = data?.metadata || {};
    const nowYear = String(new Date().getFullYear());
    const safe = {
        enabled: !!cfg.enabled,
        template: cfg.template || FOOTER_TEMPLATE_DEFAULT,
        title: cfg.title || '',
        author: cfg.author || '',
        year: cfg.year || nowYear,
        date: cfg.date || '',
        line1: cfg.line1 || '',
    };
    const titleInput = modal.querySelector('#footer-title-input');
    const authorInput = modal.querySelector('#footer-author-input');
    const yearInput = modal.querySelector('#footer-year-input');
    const dateInput = modal.querySelector('#footer-date-input');

    modal.querySelector('#footer-enabled').checked = safe.enabled;
    modal.querySelector('#footer-template-input').value = safe.template;
    if (titleInput) {
        titleInput.value = safe.title;
        titleInput.placeholder = String(metadata.title || 'Titre de la présentation');
    }
    if (authorInput) {
        authorInput.value = safe.author;
        authorInput.placeholder = String(metadata.author || 'Nom de l’auteur');
    }
    if (yearInput) {
        yearInput.value = safe.year;
        yearInput.placeholder = nowYear;
    }
    if (dateInput) {
        dateInput.value = safe.date;
        dateInput.placeholder = String(metadata.modified || metadata.created || '');
    }
    modal.querySelector('#footer-line1-input').value = safe.line1;
}

function _updateFooterConfigPreview(modal, data) {
    const preview = modal.querySelector('#footer-preview-box');
    if (!preview) return;
    const cfg = _readFooterConfigFromModal(modal);
    if (!cfg.enabled) {
        preview.textContent = 'Pied de page désactivé.';
        return;
    }
    const values = _buildFooterTemplateValues(data, cfg, 0, (data?.slides || []).length || 1);
    const rendered = _renderFooterTemplate(cfg.template || FOOTER_TEMPLATE_DEFAULT, values);
    preview.textContent = rendered || '(vide)';
}

function _saveFooterConfigFromModal(modal, { forceDisable = false } = {}) {
    if (!editor.data) return;
    const cfg = _readFooterConfigFromModal(modal);
    const finalCfg = {
        ...cfg,
        enabled: forceDisable ? false : cfg.enabled,
        template: cfg.template || FOOTER_TEMPLATE_DEFAULT,
    };
    editor.data.footerConfig = finalCfg;
    editor.data.footerText = finalCfg.enabled ? finalCfg.template : null;
    editor._push();
    renderSlideList();
    renderPreview();
    if (finalCfg.enabled) notify('Pied de page mis à jour', 'success');
    else notify('Pied de page désactivé', 'info');
}

function insertFooter() {
    if (!editor.data) return;
    const modal = _ensureFooterConfigModal();
    const cfg = _normalizeFooterConfigFromData(editor.data);
    _writeFooterConfigToModal(modal, cfg, editor.data);
    _updateFooterConfigPreview(modal, editor.data);

    if (!_footerConfigModalBound) {
        _footerConfigModalBound = true;
        modal.addEventListener('click', e => {
            if (e.target === modal) _setFooterModalOpen(modal, false);
        });
        modal.querySelector('#footer-config-close')?.addEventListener('click', () => _setFooterModalOpen(modal, false));
        modal.querySelector('#footer-config-cancel')?.addEventListener('click', () => _setFooterModalOpen(modal, false));
        modal.querySelector('#footer-config-save')?.addEventListener('click', () => {
            _saveFooterConfigFromModal(modal);
            _setFooterModalOpen(modal, false);
        });
        modal.querySelector('#footer-config-disable')?.addEventListener('click', () => {
            _saveFooterConfigFromModal(modal, { forceDisable: true });
            _setFooterModalOpen(modal, false);
        });
        ['#footer-enabled', '#footer-template-input', '#footer-title-input', '#footer-author-input', '#footer-year-input', '#footer-date-input', '#footer-line1-input']
            .forEach(sel => modal.querySelector(sel)?.addEventListener('input', () => _updateFooterConfigPreview(modal, editor.data)));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) _setFooterModalOpen(modal, false);
        });
    }
    _setFooterModalOpen(modal, true);
}

/* ── Layout presets — now handled by editor-masters.js (openLayoutPicker / openMastersModal) ── */
