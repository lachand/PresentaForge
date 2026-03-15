/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-search
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-search.js"></script>
 */
/* editor-search.js — Search and replace functions for slide editor */
const _searchRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
const _searchCtx = () => {
    if (_searchRuntime?.resolveContext) {
        return _searchRuntime.resolveContext({
            editor,
            notify,
        });
    }
    return { editor, notify };
};

function openSearchDialog() {
    let dlg = document.getElementById('search-dialog');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'search-dialog';
        dlg.className = 'search-dialog';
        dlg.innerHTML = `
            <input type="text" id="search-input" placeholder="Rechercher…" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:0.8rem">
            <input type="text" id="replace-input" placeholder="Remplacer…" style="width:120px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--text);font-size:0.8rem">
            <button id="btn-search-next" style="padding:4px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--primary);color:white;cursor:pointer;font-size:0.7rem">Suivant</button>
            <button id="btn-replace-one" style="padding:4px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:0.7rem">Remplacer</button>
            <button id="btn-replace-all" style="padding:4px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:0.7rem">Tout</button>
            <button id="btn-search-close" style="padding:4px 8px;border:none;background:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>`;
        document.body.appendChild(dlg);
        document.getElementById('btn-search-close').addEventListener('click', () => dlg.style.display = 'none');
        document.getElementById('btn-search-next').addEventListener('click', searchNext);
        document.getElementById('btn-replace-one').addEventListener('click', replaceOne);
        document.getElementById('btn-replace-all').addEventListener('click', replaceAll);
        document.getElementById('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchNext(); if (e.key === 'Escape') dlg.style.display = 'none'; });
    }
    dlg.style.display = 'flex';
    document.getElementById('search-input').focus();
}

let _searchCursor = { slideIdx: 0, fieldIdx: 0 };
function _getSearchableFields(slide) {
    const fields = [];
    const push = (obj, key) => { if (obj && typeof obj[key] === 'string') fields.push({ obj, key }); };
    push(slide, 'title'); push(slide, 'subtitle'); push(slide, 'html'); push(slide, 'quote');
    push(slide, 'code'); push(slide, 'term'); push(slide, 'definition'); push(slide, 'note');
    if (slide.items) slide.items.forEach((item, i) => { if (typeof item === 'string') fields.push({ obj: slide.items, key: i }); });
    if (slide.elements) slide.elements.forEach(el => {
        if (el.data) { push(el.data, 'text'); push(el.data, 'code'); push(el.data, 'title'); }
    });
    return fields;
}
function searchNext() {
    const ctx = _searchCtx();
    const q = document.getElementById('search-input')?.value;
    if (!q) return;
    const slides = Array.isArray(ctx.editor?.data?.slides) ? ctx.editor.data.slides : [];
    for (let si = _searchCursor.slideIdx; si < slides.length; si++) {
        const fields = _getSearchableFields(slides[si]);
        const startFi = si === _searchCursor.slideIdx ? _searchCursor.fieldIdx : 0;
        for (let fi = startFi; fi < fields.length; fi++) {
            const val = String(fields[fi].obj[fields[fi].key]);
            if (val.toLowerCase().includes(q.toLowerCase())) {
                ctx.editor?.selectSlide(si);
                renderSlideList(); renderPreview();
                _searchCursor = { slideIdx: si, fieldIdx: fi + 1 };
                highlightSearchTerm(q);
                if (typeof ctx.notify === 'function') ctx.notify(`Trouvé slide ${si + 1}`, 'success');
                return;
            }
        }
    }
    _searchCursor = { slideIdx: 0, fieldIdx: 0 };
    if (typeof ctx.notify === 'function') ctx.notify('Aucun résultat (rebouclé)', 'warning');
}
function replaceOne() {
    const ctx = _searchCtx();
    const q = document.getElementById('search-input')?.value;
    const r = document.getElementById('replace-input')?.value ?? '';
    if (!q) return;
    const slide = ctx.editor?.currentSlide;
    if (!slide) return;
    const fields = _getSearchableFields(slide);
    for (const f of fields) {
        const val = String(f.obj[f.key]);
        if (val.toLowerCase().includes(q.toLowerCase())) {
            f.obj[f.key] = val.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), r);
            ctx.editor?._push();
            if (typeof ctx.notify === 'function') ctx.notify('Remplacé', 'success');
            return;
        }
    }
}
function replaceAll() {
    const ctx = _searchCtx();
    const q = document.getElementById('search-input')?.value;
    const r = document.getElementById('replace-input')?.value ?? '';
    if (!q) return;
    let count = 0;
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const slides = Array.isArray(ctx.editor?.data?.slides) ? ctx.editor.data.slides : [];
    for (const slide of slides) {
        for (const f of _getSearchableFields(slide)) {
            const val = String(f.obj[f.key]);
            if (re.test(val)) { f.obj[f.key] = val.replace(re, r); count++; }
            re.lastIndex = 0;
        }
    }
    if (count) {
        ctx.editor?._push();
        if (typeof ctx.notify === 'function') ctx.notify(`${count} remplacement(s)`, 'success');
    } else if (typeof ctx.notify === 'function') {
        ctx.notify('Aucun résultat', 'warning');
    }
}

function highlightSearchTerm(term) {
    // Highlight matching text in the preview
    const preview = document.getElementById('slide-preview');
    if (!preview || !term) return;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escapedTerm})`, 'gi');
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
    const matches = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (re.test(node.textContent)) {
            re.lastIndex = 0;
            matches.push(node);
        }
    }
    matches.forEach(node => {
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(re, '<mark class="search-hl" style="background:#facc15;color:#000;border-radius:2px;padding:0 1px;">$1</mark>');
        node.parentNode.replaceChild(span, node);
    });
    // Scroll first highlight into view
    const firstHl = preview.querySelector('.search-hl');
    if (firstHl) firstHl.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
