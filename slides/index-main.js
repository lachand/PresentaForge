/* index-main.js — application du tableau de bord (index.html).
   Extrait de index.html (chantier 8 : plus de <script> inline → CSP script-src 'self'). */
    const Storage = window.OEIStorage || null;

    const storageGetRaw = key => {
        if (!key) return null;
        if (Storage?.getRaw) return Storage.getRaw(key);
        try { return localStorage.getItem(key); } catch (e) { return null; }
    };
    const storageSetRaw = (key, value) => {
        if (!key) return false;
        if (Storage?.setRaw) return Storage.setRaw(key, value);
        try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
    };
    const storageRemove = key => {
        if (!key) return;
        if (Storage?.remove) Storage.remove(key);
        else localStorage.removeItem(key);
    };
    const storageGetJSON = (key, fallback = []) => {
        if (!key) return fallback;
        if (Storage?.getJSON) return Storage.getJSON(key, fallback);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    };
    const storageSetJSON = (key, value) => {
        if (!key) return false;
        if (Storage?.setJSON) return Storage.setJSON(key, value);
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    };

    // Deux canaux de hand-off distincts : l'éditeur restaure SLIDE_DRAFT (via
    // SlidesEditor.loadDraft) ; le viewer lit PRESENT_DATA pour ?file=__draft__.
    // Historiquement une seule constante (PRESENT_DATA) servait aux deux → l'éditeur
    // ne voyait jamais le deck fraîchement choisi.
    const EDITOR_HANDOFF_KEY = Storage?.KEYS?.SLIDE_DRAFT || 'oei-v2-slide-draft';
    const VIEWER_PRESENT_KEY = Storage?.KEYS?.PRESENT_DATA || 'oei-v2-slide-present-data';
    const LOCAL_KEY = Storage?.KEYS?.SLIDE_LIBRARY || 'oei-slide-library';
    const WORKDOCS_KEY = Storage?.KEYS?.SLIDE_WORKDOCS || 'oei-slide-workdocs';
    const RECENT_KEY = Storage?.KEYS?.RECENT_PRESENTATIONS || 'oei-recent-presentations';

    const EXAMPLES = [
        { file: '../data/slides/exemple-git.json', title: 'GitHub Actions — Introduction', slides: 10, theme: 'dark', topic: 'CI/CD', icon: 'flow' },
        { file: '../data/slides/demo-complete.json', title: 'Démo complète — Tous les types', slides: 24, theme: 'icom', topic: 'Complet', icon: 'lab' },
    ];

    let _localDecks = [];
    const _localFilters = { search: '', sort: 'updated-desc', tag: '' };

    function icon(name) {
        const icons = {
            flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="6" height="4" rx="1"/><rect x="15" y="4" width="6" height="4" rx="1"/><rect x="9" y="16" width="6" height="4" rx="1"/><path d="M6 8v4h12V8"/><path d="M12 12v4"/></svg>',
            lab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v6l-5 8a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 16l-5-8V2"/><path d="M8 12h8"/></svg>',
            slide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>',
            play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="9 7 17 12 9 17 9 7"/></svg>',
            edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
            count: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="7" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="21" y2="12"/><line x1="7" y1="18" x2="21" y2="18"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
            draft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
        };
        return icons[name] || icons.slide;
    }

    function themeColor(id) {
        const fallback = '#4f6df5';
        const builtIn = (window.SlidesThemes?.BUILT_IN || {})[id] || (window.SlidesThemes?.BUILT_IN || {}).dark;
        return builtIn?.colors?.slideBg || fallback;
    }

    function _toTimestamp(value, fallback = 0) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
        const t = Date.parse(String(value || ''));
        return Number.isFinite(t) ? t : fallback;
    }

    // Parse rawData JSON and return the first slide object (for HTML thumbnail)
    function _firstSlide(rawData) {
        try { return JSON.parse(String(rawData || ''))?.slides?.[0] || null; } catch { return null; }
    }

    // Inject thumbnail theme CSS once (dark theme scoped to .pres-slide-mini-inner)
    let _thumbThemeCssInjected = false;
    function _ensureThumbThemeCss() {
        if (_thumbThemeCssInjected || !window.SlidesThemes) return;
        _thumbThemeCssInjected = true;
        const s = document.createElement('style');
        s.textContent = SlidesThemes.generateCSS(SlidesThemes.BUILT_IN.dark)
            .replace(/\.reveal/g, '.pres-slide-mini-inner');
        document.head.appendChild(s);
    }

    // Extract thumbnail info from parsed presentation data (first slide)
    function _slideThumb(data) {
        const slide = data?.slides?.[0];
        if (!slide) return null;
        // Background: use slide.bg if it's not a data URL (too large)
        let bg = null;
        if (typeof slide.bg === 'string' && slide.bg && !slide.bg.startsWith('data:')) {
            bg = slide.bg;
        }
        // Text: prefer slide title, fallback to presentation title
        const text = String(slide.title || data?.metadata?.title || '').replace(/<[^>]*>/g, '').slice(0, 80);
        return { bg, text };
    }

    // Build the inline style for the pres-cover div from thumb info
    function _thumbCoverStyle(thumb) {
        if (thumb?.bg) return `background:${thumb.bg}`;
        return null; // use default CSS gradient
    }

    // Derive a deterministic dark background color from a title string
    function _colorFromTitle(title) {
        let h = 0;
        for (let i = 0; i < title.length; i++) h = ((h << 5) - h + title.charCodeAt(i)) | 0;
        const hue = Math.abs(h) % 360;
        return `hsl(${hue},45%,22%)`;
    }

    function _extractDeckMeta(rawData) {
        try {
            const parsed = JSON.parse(String(rawData || '{}'));
            const metadata = parsed?.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {};
            const theme = typeof parsed?.theme === 'string' ? parsed.theme : '';
            const tags = [];
            if (theme) tags.push(`theme:${theme}`);
            if (metadata.level) tags.push(`niveau:${String(metadata.level)}`);
            if (metadata.institution) tags.push(String(metadata.institution));
            return {
                title: String(metadata.title || ''),
                theme,
                tags: [...new Set(tags.filter(Boolean))],
                thumb: _slideThumb(parsed),
            };
        } catch (_) {
            return { title: '', theme: '', tags: [], thumb: null };
        }
    }

    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const escAttr = value => esc(value).replace(/\"/g, '&quot;');

    function readRecentDecks() {
        const recents = storageGetJSON(RECENT_KEY, []);
        if (!Array.isArray(recents)) return [];
        return recents
            .filter(r => r && typeof r.data === 'string' && r.data.trim())
            .map((r, idx) => {
                const rawData = String(r.data || '');
                const meta = _extractDeckMeta(rawData);
                const updatedAt = _toTimestamp(r.lastAccessAt || r.updatedAt || r.date, Date.now() - idx);
                return {
                    source: 'recent',
                    sourceIndex: idx,
                    sourceLabel: 'Récente',
                    title: String(r.title || meta.title || 'Présentation sans titre'),
                    date: String(r.date || ''),
                    updatedAt,
                    lastAccessAt: _toTimestamp(r.lastAccessAt, 0),
                    slideCount: Number(r.slideCount) || 0,
                    tags: [...new Set(['recent', ...meta.tags])],
                    thumb: meta.thumb,
                    rawData,
                };
            });
    }

    function readLibraryDecks() {
        const library = storageGetJSON(LOCAL_KEY, []);
        if (!Array.isArray(library)) return [];
        return library
            .map((r, idx) => {
                if (!r) return null;
                const rawData = typeof r.data === 'string'
                    ? r.data
                    : (r.deck ? JSON.stringify(r.deck) : '');
                if (!rawData) return null;
                const meta = _extractDeckMeta(rawData);
                const title = String(r.title || r.metadata?.title || 'Présentation locale');
                const date = String(r.date || r.modified || '');
                const slideCount = Number(r.slideCount) || Number(r.metadata?.slides) || 0;
                const updatedAt = _toTimestamp(r.lastAccessAt || r.updatedAt || date, Date.now() - idx - 2000);
                return {
                    source: 'library',
                    sourceIndex: idx,
                    sourceLabel: 'Bibliothèque',
                    title,
                    date,
                    updatedAt,
                    lastAccessAt: _toTimestamp(r.lastAccessAt, 0),
                    slideCount,
                    tags: [...new Set(['library', ...meta.tags])],
                    thumb: meta.thumb,
                    rawData,
                };
            })
            .filter(Boolean);
    }

    function readWorkdocs() {
        const docs = storageGetJSON(WORKDOCS_KEY, []);
        if (!Array.isArray(docs)) return [];
        return docs
            .filter(r => r && typeof r.data === 'string' && r.data.trim())
            .map((r, idx) => {
                const rawData = String(r.data || '');
                const meta = _extractDeckMeta(rawData);
                const updatedAt = _toTimestamp(r.updatedAt || r.lastAccessAt, Date.now() - idx - 4000);
                const title = String(r.title || meta.title || 'Document en cours');
                const date = new Date(updatedAt).toLocaleDateString('fr-FR');
                return {
                    source: 'workdoc',
                    sourceIndex: idx,
                    sourceLabel: 'En cours',
                    workdocId: String(r.id || ''),
                    title,
                    date,
                    updatedAt,
                    lastAccessAt: _toTimestamp(r.lastAccessAt, 0),
                    slideCount: Number(r.slideCount) || 0,
                    timelineCount: Number(r.timelineCount) || (Array.isArray(r.timeline) ? r.timeline.length : 0),
                    lastTimelineAt: _toTimestamp(r.lastTimelineAt, 0),
                    tags: [...new Set(['workdoc', ...(Array.isArray(r.tags) ? r.tags : []), ...meta.tags])],
                    thumb: meta.thumb,
                    rawData,
                };
            });
    }

    function loadLocalDecks() {
        const seen = new Set();
        const merged = [];
        const add = entry => {
            const key = `${entry.source}:${entry.title}::${entry.slideCount}`;
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(entry);
        };
        readRecentDecks().forEach(add);
        readLibraryDecks().forEach(add);
        readWorkdocs().forEach(add);
        return merged;
    }

    function _syncLocalTagOptions() {
        const select = document.getElementById('local-tag');
        if (!select) return;
        const tags = [...new Set(_localDecks.flatMap(deck => Array.isArray(deck.tags) ? deck.tags : []))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        const prev = _localFilters.tag;
        select.innerHTML = `<option value="">Tous les tags</option>${tags.map(tag => `<option value="${escAttr(tag)}">${esc(tag)}</option>`).join('')}`;
        if (prev && tags.includes(prev)) select.value = prev;
        else _localFilters.tag = '';
    }

    function _applyLocalFilters() {
        const q = String(_localFilters.search || '').trim().toLowerCase();
        const tag = String(_localFilters.tag || '').trim();
        const sort = String(_localFilters.sort || 'updated-desc');
        const filtered = _localDecks.filter(deck => {
            if (tag && !(Array.isArray(deck.tags) && deck.tags.includes(tag))) return false;
            if (!q) return true;
            const haystack = `${deck.title} ${deck.sourceLabel || ''} ${(deck.tags || []).join(' ')}`.toLowerCase();
            return haystack.includes(q);
        });
        filtered.sort((a, b) => {
            if (sort === 'updated-asc') return (a.updatedAt || 0) - (b.updatedAt || 0);
            if (sort === 'title-asc') return String(a.title || '').localeCompare(String(b.title || ''), 'fr', { sensitivity: 'base' });
            if (sort === 'slides-desc') return (b.slideCount || 0) - (a.slideCount || 0);
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return filtered;
    }

    function _touchDeckAccess(deck) {
        if (!deck) return;
        const now = Date.now();
        if (deck.source === 'recent') {
            const recents = storageGetJSON(RECENT_KEY, []);
            if (Array.isArray(recents) && recents[deck.sourceIndex]) {
                recents[deck.sourceIndex].lastAccessAt = now;
                recents[deck.sourceIndex].updatedAt = now;
                storageSetJSON(RECENT_KEY, recents);
            }
            return;
        }
        if (deck.source === 'library') {
            const library = storageGetJSON(LOCAL_KEY, []);
            if (Array.isArray(library) && library[deck.sourceIndex]) {
                library[deck.sourceIndex].lastAccessAt = now;
                library[deck.sourceIndex].updatedAt = now;
                storageSetJSON(LOCAL_KEY, library);
            }
            return;
        }
        if (deck.source === 'workdoc') {
            const docs = storageGetJSON(WORKDOCS_KEY, []);
            if (Array.isArray(docs) && docs[deck.sourceIndex]) {
                docs[deck.sourceIndex].lastAccessAt = now;
                docs[deck.sourceIndex].updatedAt = now;
                storageSetJSON(WORKDOCS_KEY, docs);
            }
        }
    }

    function openViewerFile(file) {
        window.open('viewer.html?file=' + encodeURIComponent(file), '_blank');
    }

    function openEditorFile(file) {
        location.href = 'editor.html?file=' + encodeURIComponent(file);
    }

    function openDeckFromLocal(idx, mode) {
        const deck = _localDecks[idx];
        if (!deck || !deck.rawData) return;
        _touchDeckAccess(deck);
        if (mode === 'viewer') {
            storageSetRaw(VIEWER_PRESENT_KEY, deck.rawData);
            window.open('viewer.html?file=__draft__', '_blank');
            _localDecks = loadLocalDecks();
            renderLocalDecks();
            return;
        }
        storageSetRaw(EDITOR_HANDOFF_KEY, deck.rawData);
        _localDecks = loadLocalDecks();
        renderLocalDecks();
        location.href = 'editor.html';
    }

    async function removeLocalDeck(idx) {
        const deck = _localDecks[idx];
        if (!deck) return;
        const ok = await OEIDialog.confirm('Retirer cette entrée locale ?', { danger: true });
        if (!ok) return;

        if (deck.source === 'recent') {
            const recents = storageGetJSON(RECENT_KEY, []);
            if (Array.isArray(recents) && recents[deck.sourceIndex]) {
                recents.splice(deck.sourceIndex, 1);
                storageSetJSON(RECENT_KEY, recents);
            }
        } else if (deck.source === 'library') {
            const library = storageGetJSON(LOCAL_KEY, []);
            if (Array.isArray(library) && library[deck.sourceIndex]) {
                library.splice(deck.sourceIndex, 1);
                storageSetJSON(LOCAL_KEY, library);
            }
        } else if (deck.source === 'workdoc') {
            const docs = storageGetJSON(WORKDOCS_KEY, []);
            if (Array.isArray(docs) && docs[deck.sourceIndex]) {
                docs.splice(deck.sourceIndex, 1);
                storageSetJSON(WORKDOCS_KEY, docs);
            }
        }

        _localDecks = loadLocalDecks();
        renderLocalDecks();
    }

    function renderExamples() {
        const grid = document.getElementById('examples-grid');
        document.getElementById('examples-count').textContent = `${EXAMPLES.length} exemple${EXAMPLES.length > 1 ? 's' : ''}`;
        grid.innerHTML = EXAMPLES.map((p, idx) => `
            <article class="pres-card">
                <div class="pres-cover" style="--cover:${themeColor(p.theme)}">
                    <span class="cover-kicker">${p.topic}</span>
                    <span class="cover-icon" aria-hidden="true">${icon(p.icon)}</span>
                </div>
                <div class="pres-content">
                    <h3 class="pres-title">${p.title}</h3>
                    <div class="pres-meta">
                        <span class="chip">${icon('count')} ${p.slides} slides</span>
                        <span class="chip">${icon('slide')} ${p.theme}</span>
                    </div>
                    <div class="pres-actions">
                        <button type="button" class="card-btn primary" data-action="present-example" data-example-index="${idx}">${icon('play')} Présenter</button>
                        <button type="button" class="card-btn" data-action="edit-example" data-example-index="${idx}">${icon('edit')} Éditer</button>
                    </div>
                </div>
            </article>
        `).join('');
    }

    const TEMPLATES = [
        { file: '../data/slides/templates/cours-magistral.json', name: 'Cours magistral', desc: 'Titre, chapitres, bullets, code + quiz', emoji: '📖', color: '#00508d' },
        { file: '../data/slides/templates/tp-guide.json',        name: 'TP guidé',        desc: 'Étapes numérotées, code, quiz', emoji: '🔬', color: '#1a7a40' },
        { file: '../data/slides/templates/projet.json',          name: 'Présentation projet', desc: 'Intro, plan, architecture, bilan', emoji: '🚀', color: '#5c35a8' },
        { file: '../data/slides/templates/quiz-rapide.json',     name: 'Quiz rapide',     desc: '5 questions live en 5 slides', emoji: '❓', color: '#c0680a' },
    ];

    function renderTemplates() {
        const grid = document.getElementById('templates-grid');
        if (!grid) return;
        grid.innerHTML = TEMPLATES.map((t, idx) => `
            <button type="button" class="template-card" data-action="open-template" data-template-index="${idx}" aria-label="Démarrer avec le modèle : ${t.name}">
                <div class="template-card-cover" style="background:${t.color};">${t.emoji}</div>
                <div class="template-card-body">
                    <div class="template-card-name">${t.name}</div>
                    <div class="template-card-desc">${t.desc}</div>
                </div>
            </button>
        `).join('');
    }

    function renderDraftNotice() {
        const raw = storageGetRaw(EDITOR_HANDOFF_KEY);
        const host = document.getElementById('draft-notice');
        if (!raw) {
            host.innerHTML = '';
            return;
        }
        try {
            const data = JSON.parse(raw);
            const title = esc(data.metadata?.title || 'Présentation sans titre');
            const modified = esc(data.metadata?.modified || '');
            const slideCount = Number(data.slides?.length) || 0;
            host.innerHTML = `
                <div class="draft-banner">
                    <span class="draft-text">${icon('draft')} Brouillon actif: <strong>${title}</strong> (${slideCount} slides)${modified ? ` — ${modified}` : ''}</span>
                    <div class="draft-actions">
                        <button type="button" class="card-btn" data-action="resume-draft">${icon('edit')} Reprendre</button>
                        <button type="button" class="card-btn warn" data-action="drop-draft">${icon('trash')} Supprimer</button>
                    </div>
                </div>
            `;
        } catch (e) {
            host.innerHTML = '';
        }
    }

    function renderLocalDecks() {
        const host = document.getElementById('local-grid');
        _syncLocalTagOptions();
        const rows = _applyLocalFilters();
        document.getElementById('local-count').textContent = rows.length === _localDecks.length
            ? `${rows.length} entrée${rows.length > 1 ? 's' : ''}`
            : `${rows.length}/${_localDecks.length} entrées`;

        if (!rows.length) {
            host.innerHTML = `
                <div class="empty-state">
                    <strong>Aucune présentation locale</strong>
                    Ajuste les filtres ou crée/importe une présentation.
                </div>
            `;
            return;
        }

        _ensureThumbThemeCss();
        host.innerHTML = `<div class="pres-grid">${rows.map((deck, idx) => {
            const titleText = deck.thumb?.text || deck.title || '';
            // Chantier 8 — thumbBg va dans un attribut style="…" : n'accepter qu'une couleur CSS simple.
            const rawBg = deck.thumb?.bg || (titleText ? _colorFromTitle(titleText) : null);
            const thumbBg = (typeof rawBg === 'string' && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d%,.\s/]+\)|[a-z-]+|(linear|radial)-gradient\([^"'<>]+\))$/i.test(rawBg.trim())) ? rawBg.trim() : null;
            const coverStyle = thumbBg ? `background:${thumbBg}` : `--cover:${themeColor('dark')}`;
            const firstSlide = deck.rawData ? _firstSlide(deck.rawData) : null;
            const miniHtml = firstSlide && window.SlidesRenderer
                ? SlidesRenderer.renderSlide(firstSlide, 0, { includeNotes: false })
                : '';
            return `
            <article class="pres-card">
                <div class="pres-cover" style="${esc(coverStyle)}">
                    ${miniHtml ? `<div class="pres-slide-mini-outer"><div class="pres-slide-mini-inner">${miniHtml}</div></div>` : ''}
                    <span class="cover-kicker">${esc(deck.sourceLabel || (deck.source === 'recent' ? 'Récente' : 'Bibliothèque'))}</span>
                    ${titleText ? `<span class="pres-thumb-title">${esc(titleText)}</span>` : `<span class="cover-icon" aria-hidden="true">${icon('slide')}</span>`}
                </div>
                <div class="pres-content">
                    <h3 class="pres-title">${esc(deck.title)}</h3>
                    <div class="pres-meta">
                        <span class="chip">${icon('count')} ${Number(deck.slideCount) || '?'} slides</span>
                        <span class="chip">${icon('clock')} ${deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString('fr-FR') : esc(deck.date || 'date inconnue')}</span>
                        ${deck.timelineCount ? `<span class="chip">${icon('draft')} ${deck.timelineCount} snapshot${deck.timelineCount > 1 ? 's' : ''}</span>` : ''}
                    </div>
                    ${(deck.tags || []).length
                        ? `<div class="pres-meta">${deck.tags.slice(0, 2).map(tag => `<span class="chip">${esc(tag)}</span>`).join('')}</div>`
                        : ''}
                    <div class="pres-actions">
                        <button type="button" class="card-btn primary" data-action="present-local" data-local-id="${escAttr(deck.source + ':' + deck.sourceIndex)}">${icon('play')} Présenter</button>
                        <button type="button" class="card-btn" data-action="edit-local" data-local-id="${escAttr(deck.source + ':' + deck.sourceIndex)}">${icon('edit')} Éditer</button>
                    </div>
                    <div class="pres-actions pres-actions-single">
                        <button type="button" class="card-btn warn" data-action="remove-local" data-local-id="${escAttr(deck.source + ':' + deck.sourceIndex)}">${icon('trash')} Retirer de la liste</button>
                    </div>
                </div>
            </article>
        `; }).join('')}</div>`;
    }

    async function discardDraft() {
        const ok = await OEIDialog.confirm('Supprimer le brouillon ?', { danger: true });
        if (!ok) return;
        storageRemove(EDITOR_HANDOFF_KEY);
        renderDraftNotice();
    }

    function onOpenFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async e => {
            try {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                if (window.OEIImportPipeline?.importFromText) {
                    const result = await window.OEIImportPipeline.importFromText(text);
                    const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: file.name || 'Fichier JSON' });
                    if (!ok) return;
                    storageSetRaw(EDITOR_HANDOFF_KEY, JSON.stringify(result.data));
                } else {
                    const data = JSON.parse(text);
                    if (!Array.isArray(data.slides)) throw new Error('Format invalide');
                    storageSetRaw(EDITOR_HANDOFF_KEY, text);
                }
                // Import = nouveau deck : couper tout lien Firebase de la session précédente.
                try { sessionStorage.removeItem('oei-firebase-open-id'); } catch {}
                location.href = 'editor.html';
            } catch (err) {
                const cancelCode = window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED';
                if (err?.code === cancelCode) return;
                await OEIDialog.alert('Erreur : ' + (err?.message || 'fichier invalide'));
            }
        };
        input.click();
    }

    document.getElementById('btn-open-file')?.addEventListener('click', onOpenFile);
    document.getElementById('btn-open-file-card')?.addEventListener('click', onOpenFile);
    document.getElementById('local-search')?.addEventListener('input', e => {
        _localFilters.search = String(e.target.value || '');
        renderLocalDecks();
    });
    document.getElementById('local-sort')?.addEventListener('change', e => {
        _localFilters.sort = String(e.target.value || 'updated-desc');
        renderLocalDecks();
    });
    document.getElementById('local-tag')?.addEventListener('change', e => {
        _localFilters.tag = String(e.target.value || '');
        renderLocalDecks();
    });

    document.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const exampleIdx = Number(target.dataset.exampleIndex);
        const templateIdx = Number(target.dataset.templateIndex);
        const localId = String(target.dataset.localId || '');
        const localIdx = localId
            ? _localDecks.findIndex(deck => `${deck.source}:${deck.sourceIndex}` === localId)
            : Number(target.dataset.localIndex);

        if (action === 'open-template' && Number.isFinite(templateIdx) && TEMPLATES[templateIdx]) {
            openEditorFile(TEMPLATES[templateIdx].file);
            return;
        }
        if (action === 'present-example' && Number.isFinite(exampleIdx) && EXAMPLES[exampleIdx]) {
            openViewerFile(EXAMPLES[exampleIdx].file);
            return;
        }
        if (action === 'edit-example' && Number.isFinite(exampleIdx) && EXAMPLES[exampleIdx]) {
            openEditorFile(EXAMPLES[exampleIdx].file);
            return;
        }
        if (action === 'present-local' && Number.isFinite(localIdx)) {
            openDeckFromLocal(localIdx, 'viewer');
            return;
        }
        if (action === 'edit-local' && Number.isFinite(localIdx)) {
            openDeckFromLocal(localIdx, 'editor');
            return;
        }
        if (action === 'remove-local' && Number.isFinite(localIdx)) {
            removeLocalDeck(localIdx);
            return;
        }
        if (action === 'resume-draft') {
            location.href = 'editor.html';
            return;
        }
        if (action === 'drop-draft') {
            discardDraft();
        }
    });

    renderTemplates();
    renderExamples();
    renderDraftNotice();
    _localDecks = loadLocalDecks();
    renderLocalDecks();

    // ── Badge "En présentation" via BroadcastChannel ──────────────────────────
    (function() {
        try {
            const channel = new BroadcastChannel('oei-slides-presenter-sync');
            let _liveTimer = null;
            const _showLiveBanner = () => {
                let banner = document.getElementById('live-banner');
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'live-banner';
                    banner.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#16a34a;color:#fff;border-radius:8px;padding:8px 16px;font-size:0.8rem;font-weight:600;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,0.18);z-index:9999;transition:opacity 0.4s;';
                    banner.innerHTML = '<span style="width:8px;height:8px;background:#fff;border-radius:50%;animation:livePulse 1.2s ease-in-out infinite;"></span> Présentation en cours dans un autre onglet';
                    document.body.appendChild(banner);
                    const style = document.createElement('style');
                    style.textContent = '@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}';
                    document.head.appendChild(style);
                }
                banner.style.opacity = '1';
                clearTimeout(_liveTimer);
                _liveTimer = setTimeout(() => { if (banner) banner.style.opacity = '0'; }, 8000);
            };
            channel.onmessage = () => _showLiveBanner();
        } catch (_) {}
    })();

    // ── Firebase section ──────────────────────────────────────────────────────

    let _firebaseDecks = [];

    function _fmtDate(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return iso; }
    }

    function _updateFirebaseBentoState() {
        const fb = window.OEIFirebase;
        const card = document.getElementById('btn-firebase-bento');
        const label = document.getElementById('firebase-bento-label');
        const sub = document.getElementById('firebase-bento-sub');
        if (!card || !label || !sub) return;
        if (fb && fb.isReady()) {
            const user = fb.getUser();
            card.classList.add('connected');
            label.textContent = 'Firebase connecté';
            sub.textContent = user ? user.email : '';
        } else {
            card.classList.remove('connected');
            label.textContent = 'Firebase';
            sub.textContent = 'Connecter un projet Firebase';
        }
    }

    function _updateFirebaseSectionHeader() {
        const fb = window.OEIFirebase;
        const badge = document.getElementById('firebase-user-badge');
        const btn = document.getElementById('btn-firebase-connect');
        if (!badge || !btn) return;
        if (fb && fb.isReady()) {
            const user = fb.getUser();
            badge.textContent = user ? user.email : '';
            badge.style.display = 'inline';
            btn.textContent = 'Déconnecter';
            btn.classList.remove('primary');
        } else {
            badge.style.display = 'none';
            btn.textContent = 'Se connecter';
            btn.classList.add('primary');
        }
    }

    function _buildShareUrl(uid, id) {
        const base = location.href.replace(/\/[^/]*$/, '/');
        return `${base}viewer.html?firebase=${encodeURIComponent(uid)}/${encodeURIComponent(id)}`;
    }

    function renderFirebaseDecks() {
        const host = document.getElementById('firebase-grid');
        const countEl = document.getElementById('firebase-count');
        if (!host) return;

        if (!_firebaseDecks.length) {
            host.innerHTML = '<div class="firebase-empty">Aucune présentation Firebase. Sauvegardez depuis l\'éditeur pour commencer.</div>';
            if (countEl) countEl.textContent = '';
            return;
        }

        if (countEl) countEl.textContent = `${_firebaseDecks.length} présentation${_firebaseDecks.length > 1 ? 's' : ''}`;

        const uid = window.OEIFirebase?.getUser()?.uid || '';

        // Group by course
        const courses = {};
        _firebaseDecks.forEach((p, idx) => {
            const key = p.course || '';
            if (!courses[key]) courses[key] = [];
            courses[key].push({ p, idx });
        });

        const sections = Object.keys(courses).sort((a, b) => {
            if (!a) return 1; if (!b) return -1;
            return a.localeCompare(b, 'fr');
        });

        const renderCard = ({ p, idx }) => {
            const titleText = p.thumb?.text || p.title || '';
            const thumbBg   = p.thumb?.bg || (titleText ? _colorFromTitle(titleText) : null);
            const coverStyle = thumbBg ? `background:${thumbBg}` : '--cover:#00508d';
            return `
            <article class="pres-card">
                <div class="pres-cover" style="${coverStyle}">
                    ${p.public ? '<span class="cover-kicker cover-kicker--public">Public</span>' : '<span class="cover-kicker">Firebase</span>'}
                    ${titleText ? `<span class="pres-thumb-title">${esc(titleText)}</span>` : `<span class="cover-icon" aria-hidden="true">${icon('slide')}</span>`}
                </div>
                <div class="pres-content">
                    <h3 class="pres-title">${esc(p.title)}</h3>
                    <div class="pres-meta">
                        <span class="chip">${icon('clock')} ${_fmtDate(p.modified)}</span>
                        ${p.course ? `<span class="chip chip--course">${esc(p.course)}</span>` : ''}
                    </div>
                    <div class="pres-actions">
                        <button type="button" class="card-btn primary" data-action="present-firebase" data-fb-idx="${idx}">${icon('play')} Présenter</button>
                        <button type="button" class="card-btn" data-action="edit-firebase" data-fb-idx="${idx}">${icon('edit')} Éditer</button>
                        ${p.public && uid ? `<button type="button" class="card-btn" data-action="copy-link-firebase" data-fb-uid="${esc(uid)}" data-fb-id="${esc(p.id)}" title="Copier le lien de partage">🔗 Lien</button>` : ''}
                    </div>
                    <div class="pres-actions pres-actions-single">
                        <button type="button" class="card-btn warn" data-action="delete-firebase" data-fb-idx="${idx}">${icon('trash')} Supprimer</button>
                    </div>
                </div>
            </article>`;
        };

        host.innerHTML = sections.map(course => `
            ${course ? `<h4 class="firebase-course-heading">${esc(course)}</h4>` : ''}
            <div class="pres-grid">${courses[course].map(renderCard).join('')}</div>
        `).join('');
    }

    async function loadFirebaseDecks() {
        const host = document.getElementById('firebase-grid');
        if (!host) return;
        if (!window.OEIFirebase || !window.OEIFirebase.isReady()) {
            host.innerHTML = '';
            return;
        }
        host.innerHTML = '<div class="firebase-loading">Chargement depuis Firebase…</div>';
        try {
            _firebaseDecks = await window.OEIFirebase.listPresentations();
            renderFirebaseDecks();
        } catch (e) {
            host.innerHTML = `<div class="firebase-empty">Erreur : ${esc(e.message)}</div>`;
        }
    }

    async function openFirebaseDeck(idx, mode) {
        const p = _firebaseDecks[idx];
        if (!p) return;
        try {
            const data = await window.OEIFirebase.loadPresentation(p.id);
            if (mode === 'viewer') {
                storageSetRaw(VIEWER_PRESENT_KEY, JSON.stringify(data));
                window.open('viewer.html?file=__draft__', '_blank');
            } else {
                // Passer l'ID Firebase à l'éditeur : il rechargera le contenu depuis
                // Firestore, mais on écrit aussi SLIDE_DRAFT comme repli hors-ligne.
                storageSetRaw(EDITOR_HANDOFF_KEY, JSON.stringify(data));
                try { sessionStorage.setItem('oei-firebase-open-id', p.id); } catch {}
                location.href = 'editor.html';
            }
        } catch (e) {
            await OEIDialog.alert('Erreur lors du chargement : ' + e.message);
        }
    }

    async function deleteFirebaseDeck(idx) {
        const p = _firebaseDecks[idx];
        if (!p) return;
        const ok = await OEIDialog.confirm(`Supprimer "${p.title}" depuis Firebase ? Cette action est irréversible.`, { danger: true });
        if (!ok) return;
        try {
            await window.OEIFirebase.deletePresentation(p.id);
            _firebaseDecks.splice(idx, 1);
            renderFirebaseDecks();
        } catch (e) {
            await OEIDialog.alert('Erreur : ' + e.message);
        }
    }

    // Handle Firebase action clicks (delegated)
    document.addEventListener('click', e => {
        const target = e.target.closest('[data-action^="present-firebase"],[data-action^="edit-firebase"],[data-action^="delete-firebase"],[data-action^="copy-link-firebase"]');
        if (!target) return;
        const action = target.dataset.action;
        const idx = Number(target.dataset.fbIdx);
        if (action === 'present-firebase') openFirebaseDeck(idx, 'viewer');
        else if (action === 'edit-firebase') openFirebaseDeck(idx, 'editor');
        else if (action === 'delete-firebase') deleteFirebaseDeck(idx);
        else if (action === 'copy-link-firebase') {
            const uid = target.dataset.fbUid;
            const id  = target.dataset.fbId;
            const url = _buildShareUrl(uid, id);
            navigator.clipboard?.writeText(url).then(() => {
                const orig = target.textContent;
                target.textContent = '✓ Copié !';
                setTimeout(() => { target.textContent = orig; }, 2000);
            }).catch(() => prompt('Lien de partage :', url));
        }
    });

    function _openFirebaseModal() {
        if (!window.OEIFirebaseModal) return;
        window.OEIFirebaseModal.open({
            mode: 'open',
            onLoad: (data, id) => {
                storageSetRaw(EDITOR_HANDOFF_KEY, JSON.stringify(data));
                if (id) { try { sessionStorage.setItem('oei-firebase-open-id', id); } catch {} }
                location.href = 'editor.html';
            },
        });
        // After modal closes, refresh the section
        const origClose = window.OEIFirebaseModal._afterClose;
        const refresh = () => {
            _updateFirebaseBentoState();
            _updateFirebaseSectionHeader();
            loadFirebaseDecks();
        };
        // Poll for modal removal to detect close (simple approach)
        const pollClose = setInterval(() => {
            if (!document.getElementById('oei-fbm-overlay')) {
                clearInterval(pollClose);
                refresh();
            }
        }, 300);
    }

    document.getElementById('btn-firebase-connect')?.addEventListener('click', async () => {
        const fb = window.OEIFirebase;
        if (fb && fb.isReady()) {
            const ok = await OEIDialog.confirm('Se déconnecter de Firebase ?');
            if (!ok) return;
            await fb.signOut();
            _firebaseDecks = [];
            renderFirebaseDecks();
            _updateFirebaseBentoState();
            _updateFirebaseSectionHeader();
        } else {
            _openFirebaseModal();
        }
    });

    document.getElementById('btn-firebase-bento')?.addEventListener('click', _openFirebaseModal);

    // Auto-init Firebase on page load
    (async () => {
        const fb = window.OEIFirebase;
        if (!fb) return;
        const ok = await fb.ready();
        _updateFirebaseBentoState();
        _updateFirebaseSectionHeader();
        if (ok) await loadFirebaseDecks();
    })();

    // ── Hamburger sidebar toggle (mobile ≤ 860px) ────────────────
    (function() {
        const btn = document.getElementById('btn-sidebar-toggle');
        const nav = document.getElementById('side-nav');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!btn || !nav) return;

        function openSidebar() {
            nav.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
            if (backdrop) backdrop.classList.add('visible');
        }
        function closeSidebar() {
            nav.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
            if (backdrop) backdrop.classList.remove('visible');
        }

        btn.addEventListener('click', () => {
            nav.classList.contains('open') ? closeSidebar() : openSidebar();
        });
        if (backdrop) backdrop.addEventListener('click', closeSidebar);
        nav.querySelectorAll('a, button').forEach(el => {
            el.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 860px)').matches) closeSidebar();
            });
        });
    })();

    // ── BroadcastChannel: badge "Présentation en cours" ──────────
    (function() {
        try {
            const channel = new BroadcastChannel('oei-slides-presenter-sync');
            let _liveTimer = null;
            const _showLiveBanner = () => {
                let banner = document.getElementById('live-banner');
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'live-banner';
                    banner.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#16a34a;color:#fff;border-radius:8px;padding:10px 18px;font-size:0.8125rem;font-weight:600;display:flex;align-items:center;gap:8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,0.25);transition:opacity 0.4s;';
                    banner.innerHTML = '<svg style="width:15px;height:15px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M2 12S5 5 12 5s10 7 10 7-3 7-10 7S2 12 2 12z"/></svg> Présentation en cours dans un autre onglet';
                    document.body.appendChild(banner);
                }
                banner.style.opacity = '1';
                clearTimeout(_liveTimer);
                _liveTimer = setTimeout(() => { if (banner) banner.style.opacity = '0'; }, 8000);
            };
            channel.onmessage = () => _showLiveBanner();
        } catch (_) {}
    })();
