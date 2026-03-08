/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-zoom-view
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-zoom-view.js"></script>
 */
/* editor-zoom-view.js — Zoom controls, grid, outline, stats, ruler, slide sorter, canvas zoom */

/* ── H1: Zoom Controls ────────────────────────────────── */

let _zoomLevel = 100; // percentage override; 100 = fit

function initZoomControls() {
    const slider = document.getElementById('zoom-slider');
    const label = document.getElementById('zoom-label');

    document.getElementById('zoom-out')?.addEventListener('click', () => {
        _zoomLevel = Math.max(25, _zoomLevel - 10);
        slider.value = _zoomLevel;
        applyZoom();
    });
    document.getElementById('zoom-in')?.addEventListener('click', () => {
        _zoomLevel = Math.min(200, _zoomLevel + 10);
        slider.value = _zoomLevel;
        applyZoom();
    });
    document.getElementById('zoom-fit')?.addEventListener('click', () => {
        _zoomLevel = 100;
        slider.value = 100;
        applyZoom();
    });
    slider?.addEventListener('input', () => {
        _zoomLevel = +slider.value;
        applyZoom();
    });
}

function applyZoom() {
    const label = document.getElementById('zoom-label');
    if (label) label.textContent = _zoomLevel + '%';
    updatePreviewScale();
    updateMinimap();
}

/* ── H2: Grid Toggle ──────────────────────────────────── */

let _gridVisible = false;

function toggleGrid() {
    _gridVisible = !_gridVisible;
    const grid = document.getElementById('preview-grid');
    if (grid) grid.classList.toggle('visible', _gridVisible);
    const btn = document.getElementById('btn-toggle-grid');
    if (btn) btn.style.background = _gridVisible ? 'var(--primary-muted)' : '';
}

/* ── H3: Outline Mode ─────────────────────────────────── */

let _outlineMode = false;

function toggleOutlineMode() {
    _outlineMode = !_outlineMode;
    const slideItems = document.getElementById('slides-items');
    const btn = document.getElementById('btn-toggle-outline');
    if (btn) btn.style.background = _outlineMode ? 'var(--primary-muted)' : '';

    if (_outlineMode) {
        renderOutlineView();
    } else {
        renderSlideList();
    }
}

function renderOutlineView() {
    const container = document.getElementById('slides-items');
    if (!container || !_outlineMode) return;
    const slides = editor.data.slides;
    const typeMap = Object.fromEntries(SlidesEditor.SLIDE_TYPES.map(t => [t.id, t]));

    container.innerHTML = `<div class="outline-panel">${slides.map((slide, i) => {
        const meta = typeMap[slide.type] || { icon: '⬜', label: slide.type };
        const title = slide.title || slide.quote || slide.term || `Slide ${i + 1}`;
        const active = i === editor.selectedIndex ? ' active' : '';
        return `<div class="outline-item${active}" data-idx="${i}">
            <span class="outline-num">${i + 1}</span>
            <span class="outline-icon">${meta.icon}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</span>
        </div>`;
    }).join('')}</div>`;

    container.querySelectorAll('.outline-item').forEach(el => {
        el.addEventListener('click', () => {
            editor.selectSlide(+el.dataset.idx);
            renderOutlineView();
            renderPreview();
        });
    });
}

/* ── H4: Statistics ────────────────────────────────────── */

function updateStats() {
    if (!editor.data) return;
    const slides = editor.data.slides;
    const slideCount = slides.length;
    let wordCount = 0;
    for (const s of slides) {
        const texts = [s.title, s.subtitle, s.quote, s.code, s.term, s.definition, s.note, s.html, s.caption].filter(Boolean);
        if (Array.isArray(s.items)) texts.push(...s.items.map(i => typeof i === 'string' ? i : i.text || ''));
        if (s.elements) for (const el of s.elements) {
            if (el.data?.text) texts.push(el.data.text);
            if (el.data?.code) texts.push(el.data.code);
            if (el.data?.items) texts.push(...el.data.items);
        }
        wordCount += texts.join(' ').split(/\s+/).filter(w => w.length > 0).length;
    }
    const duration = Math.max(1, Math.round(slideCount * 1.5));

    const elSlides = document.getElementById('stat-slides');
    const elWords = document.getElementById('stat-words');
    const elDuration = document.getElementById('stat-duration');
    if (elSlides) elSlides.textContent = slideCount + ' slide' + (slideCount !== 1 ? 's' : '');
    if (elWords) elWords.textContent = wordCount + ' mot' + (wordCount !== 1 ? 's' : '');
    if (elDuration) elDuration.textContent = '~' + duration + ' min';
}

/* ── D3: Ruler ─────────────────────────────────────────── */

let _rulerVisible = false;

function toggleRuler() {
    _rulerVisible = !_rulerVisible;
    let rulerH = document.getElementById('ruler-h');
    let rulerV = document.getElementById('ruler-v');
    const btn = document.getElementById('btn-ruler');
    if (btn) btn.style.background = _rulerVisible ? 'var(--primary-muted)' : '';

    if (!_rulerVisible) {
        rulerH?.remove(); rulerV?.remove();
        return;
    }

    const wrap = document.getElementById('preview-wrap');
    if (!wrap) return;

    rulerH = document.createElement('div');
    rulerH.id = 'ruler-h'; rulerH.className = 'ruler-h';
    rulerV = document.createElement('div');
    rulerV.id = 'ruler-v'; rulerV.className = 'ruler-v';

    // Generate ticks
    for (let i = 0; i <= 1280; i += 50) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        tick.style.left = (i * previewScale) + 'px';
        tick.dataset.label = i;
        tick.textContent = i;
        rulerH.appendChild(tick);
    }
    for (let i = 0; i <= 720; i += 50) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        tick.style.top = (i * previewScale) + 'px';
        tick.dataset.label = i;
        tick.textContent = i;
        rulerV.appendChild(tick);
    }
    wrap.appendChild(rulerH);
    wrap.appendChild(rulerV);
}

/* ── D5: Slide Sorter ──────────────────────────────────── */

function openSlideSorter() {
    let overlay = document.getElementById('slide-sorter-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'slide-sorter-overlay';
        overlay.className = 'slide-sorter-overlay';
        overlay.innerHTML = `<div class="slide-sorter">
            <h2 style="margin:0 0 16px;font-size:1.1rem;color:var(--text);display:flex;justify-content:space-between;align-items:center">
                Trieuse de diapositives
                <button id="sorter-close" style="background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer">✕</button>
            </h2>
            <div class="slide-sorter-grid" id="sorter-grid"></div>
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('visible'); });
        document.getElementById('sorter-close').addEventListener('click', () => overlay.classList.remove('visible'));
    }
    overlay.classList.add('visible');
    renderSorterGrid();
}

function renderSorterGrid() {
    const grid = document.getElementById('sorter-grid');
    if (!grid) return;
    const thumbWidth = 240;
    const thumbHeight = 135;
    const thumbScale = thumbWidth / 1280;
    grid.innerHTML = editor.data.slides.map((slide, i) => {
        const thumbHtml = SlidesRenderer.renderSlide(slide, i, _slideRenderOpts());
        const active = i === editor.selectedIndex ? ' style="outline:2px solid var(--primary)"' : '';
        const hiddenStyle = slide.hidden ? ' opacity:0.4;' : '';
        const hiddenLabel = slide.hidden ? ' 👁' : '';
        return `<div class="sorter-thumb${slide.hidden ? ' hidden-slide' : ''}" data-idx="${i}"${active} draggable="true">
            <div class="sorter-thumb-stage" style="width:${thumbWidth}px;height:${thumbHeight}px;background:${slide.bg || 'var(--thumb-bg)'};${hiddenStyle}">
                <div class="sl-thumb-inner sorter-thumb-inner" style="transform:scale(${thumbScale})">${thumbHtml}</div>
            </div>
            <span class="sorter-thumb-label">${i + 1}. ${esc(slide.title || slide.type)}${hiddenLabel}</span>
        </div>`;
    }).join('');
    grid.querySelectorAll('.sorter-thumb').forEach(el => {
        el.addEventListener('click', () => {
            editor.selectSlide(+el.dataset.idx);
            renderSlideList(); renderPreview();
            document.getElementById('slide-sorter-overlay').classList.remove('visible');
        });
        // Drag and drop for reordering
        el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', el.dataset.idx));
        el.addEventListener('dragover', e => { e.preventDefault(); el.style.outline = '2px solid var(--primary)'; });
        el.addEventListener('dragleave', () => { el.style.outline = ''; });
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.style.outline = '';
            const from = +e.dataTransfer.getData('text/plain');
            const to = +el.dataset.idx;
            if (from === to) return;
            const slides = editor.data.slides;
            const [moved] = slides.splice(from, 1);
            slides.splice(to, 0, moved);
            editor.selectedIndex = to;
            editor._push();
            renderSorterGrid();
        });
    });
}

/* ── Canvas Zoom via Scroll Wheel ──────────────────────── */

function initCanvasZoom() {
    const wrap = document.getElementById('preview-wrap');
    if (!wrap) return;
    wrap.addEventListener('wheel', e => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        _zoomLevel = Math.max(25, Math.min(200, _zoomLevel + delta));
        const slider = document.getElementById('zoom-slider');
        if (slider) slider.value = _zoomLevel;
        applyZoom();
    }, { passive: false });

    // Update minimap on scroll
    wrap.addEventListener('scroll', () => updateMinimap());
}

/* ── Minimap ───────────────────────────────────────────── */

function _ensureMinimapDOM() {
    const wrap = document.getElementById('preview-wrap');
    if (!wrap) return null;
    let mm = document.getElementById('minimap');
    if (mm) return mm;

    mm = document.createElement('div');
    mm.id = 'minimap';
    mm.innerHTML = '<div class="minimap-slide"></div><div class="minimap-viewport"></div>';
    document.body.appendChild(mm);

    // Drag the viewport rectangle to scroll the main view
    const vp = mm.querySelector('.minimap-viewport');
    let dragging = false, startX, startY, startSL, startST;

    const onMouseDown = e => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startSL = wrap.scrollLeft; startST = wrap.scrollTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = e => {
        if (!dragging) return;
        const mmRect = mm.getBoundingClientRect();
        const mmW = mmRect.width, mmH = mmRect.height;
        if (!mmW || !mmH) return;
        const scaleX = wrap.scrollWidth / mmW;
        const scaleY = wrap.scrollHeight / mmH;
        wrap.scrollLeft = startSL + (e.clientX - startX) * scaleX;
        wrap.scrollTop  = startST + (e.clientY - startY) * scaleY;
    };

    const onMouseUp = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    vp.addEventListener('mousedown', onMouseDown);

    // Click on minimap background to jump
    mm.addEventListener('mousedown', e => {
        if (e.target === vp || vp.contains(e.target)) return;
        const mmRect = mm.getBoundingClientRect();
        const ratioX = (e.clientX - mmRect.left) / mmRect.width;
        const ratioY = (e.clientY - mmRect.top) / mmRect.height;
        const vpW = wrap.clientWidth / wrap.scrollWidth;
        const vpH = wrap.clientHeight / wrap.scrollHeight;
        wrap.scrollLeft = (ratioX - vpW / 2) * wrap.scrollWidth;
        wrap.scrollTop  = (ratioY - vpH / 2) * wrap.scrollHeight;
    });

    return mm;
}

function updateMinimap() {
    const wrap = document.getElementById('preview-wrap');
    if (!wrap) return;

    // Only show minimap when zoomed beyond fit (content overflows)
    const overflows = _zoomLevel > 100;
    let mm = document.getElementById('minimap');

    if (!overflows) {
        if (mm) mm.style.display = 'none';
        return;
    }

    mm = _ensureMinimapDOM();
    if (!mm) return;
    mm.style.display = '';

    // Position fixed bottom-left of the preview-wrap viewport
    const wrapRect = wrap.getBoundingClientRect();
    mm.style.left = (wrapRect.left + 12) + 'px';
    mm.style.top  = (wrapRect.bottom - 90 - 12) + 'px';

    // Update viewport rectangle position/size
    const sw = wrap.scrollWidth, sh = wrap.scrollHeight;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    if (!sw || !sh) return;

    const vp = mm.querySelector('.minimap-viewport');
    vp.style.left   = (wrap.scrollLeft / sw * 100) + '%';
    vp.style.top    = (wrap.scrollTop  / sh * 100) + '%';
    vp.style.width  = Math.min(100, cw / sw * 100) + '%';
    vp.style.height = Math.min(100, ch / sh * 100) + '%';
}
