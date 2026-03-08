/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-widget-picker
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-widget-picker.js"></script>
 */
/**
 * WidgetPickerModal — Modale de sélection de widgets OEI
 * Lecture depuis window.OEI_WIDGET_REGISTRY, aperçu live, config JSON.
 */
class WidgetPickerModal {
    static _stylesInjected = false;

    static ensureStyles() {
        if (WidgetPickerModal._stylesInjected) return;
        WidgetPickerModal._stylesInjected = true;
        const css = `
/* ── Modal ────────────────────────────────────────────────────── */
.wpm-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9998; }
.wpm-modal { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9999;
  width:min(920px,95vw); max-height:88vh; display:flex; flex-direction:column;
  background:var(--panel,#1a1d27); border:1px solid var(--border,#2d3347); border-radius:12px;
  box-shadow:var(--shadow-overlay,0 20px 60px rgba(0,0,0,0.6)); overflow:hidden;
  color:var(--text,#cbd5e1); font-family:inherit; font-size:14px; }
.wpm-header { padding:14px 16px 10px; border-bottom:1px solid var(--border,#2d3347);
  display:flex; align-items:center; gap:8px; flex-shrink:0; }
.wpm-header-title { font-size:1rem; font-weight:700; flex:1; }
.wpm-close { background:none; border:none; font-size:1.3rem; cursor:pointer;
  color:var(--muted,#64748b); line-height:1; padding:2px 6px; border-radius:4px; }
.wpm-close:hover { background:var(--card,#222635); }
/* ── Body 2-col ──────────────────────────────────────────────── */
.wpm-body { display:flex; flex:1; overflow:hidden; min-height:0; }
/* ── Left: filters + list ────────────────────────────────────── */
.wpm-left { width:50%; display:flex; flex-direction:column; border-right:1px solid var(--border,#2d3347); min-height:0; overflow:hidden; }
.wpm-filters { padding:10px 12px 6px; flex-shrink:0; display:flex; flex-direction:column; gap:6px; }
.wpm-search { width:100%; padding:5px 10px; font-size:0.82rem;
  background:var(--card,#222635); border:1px solid var(--border,#2d3347);
  border-radius:6px; color:var(--text,#cbd5e1); font-family:inherit; box-sizing:border-box; }
.wpm-search:focus { outline:none; border-color:var(--primary,#818cf8); }
.wpm-cats { display:flex; flex-wrap:wrap; gap:4px; }
.wpm-cat { font-size:0.7rem; padding:2px 9px; border-radius:10px;
  border:1px solid var(--border,#2d3347); background:transparent; color:var(--muted,#64748b);
  cursor:pointer; font-family:inherit; transition:background 0.1s; }
.wpm-cat:hover { background:var(--card-hover,#2a2e3f); }
.wpm-cat.active { background:var(--primary,#818cf8); color:#fff; border-color:var(--primary,#818cf8); }
.wpm-count { font-size:0.68rem; color:var(--muted,#64748b); }
.wpm-list { flex:1; overflow-y:auto; padding:4px 8px 8px; display:flex; flex-direction:column; gap:1px; min-height:0; }
.wpm-sep { font-size:0.63rem; font-weight:700; color:var(--muted,#64748b);
  text-transform:uppercase; letter-spacing:0.05em; padding:8px 4px 3px;
  border-bottom:1px solid var(--border,#2d3347); margin-bottom:2px; }
.wpm-card { display:flex; align-items:center; gap:8px; padding:7px 10px;
  border-radius:7px; cursor:pointer; border:1.5px solid transparent; transition:background 0.1s; }
.wpm-card:hover { background:var(--card-hover,#2a2e3f); }
.wpm-card.active { background:var(--primary-muted,rgba(129,140,248,0.12)); border-color:var(--primary,#818cf8); }
.wpm-card-ico { font-size:1.1rem; width:26px; text-align:center; flex-shrink:0; }
.wpm-card-body { flex:1; min-width:0; }
.wpm-card-name { font-size:0.82rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wpm-card-desc { font-size:0.67rem; color:var(--muted,#64748b); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.wpm-card-badges { display:flex; gap:3px; flex-shrink:0; align-items:center; }
.wpm-badge { font-size:0.6rem; padding:1px 5px; border-radius:5px; font-weight:600; white-space:nowrap; }
.wpm-badge-level { background:var(--primary-muted,rgba(129,140,248,0.2)); color:var(--primary,#818cf8); }
.wpm-none { font-size:0.8rem; color:var(--muted,#64748b); font-style:italic; padding:20px 4px; text-align:center; }
/* ── Right: preview ──────────────────────────────────────────── */
.wpm-right { flex:1; display:flex; flex-direction:column; overflow:hidden; min-height:0; }
.wpm-preview-wrap { flex:1; padding:12px; display:flex; flex-direction:column; gap:8px; overflow-y:auto; }
.wpm-preview-lbl { font-size:0.7rem; font-weight:700; color:var(--muted,#64748b); text-transform:uppercase; letter-spacing:0.04em; }
.wpm-preview-box { border:1px solid var(--border,#2d3347); border-radius:8px;
  overflow:auto; min-height:170px; max-height:320px; padding:10px;
  background:var(--bg,#0f1117); position:relative; }
.wpm-preview-ph { display:flex; flex-direction:column; align-items:center;
  justify-content:center; height:150px; color:var(--muted,#64748b); gap:8px; text-align:center; }
.wpm-preview-ph-ico { font-size:2rem; }
.wpm-preview-ph-txt { font-size:0.8rem; }
.wpm-preview-spinner { position:absolute; inset:0; display:flex; align-items:center;
  justify-content:center; background:rgba(0,0,0,0.35); font-size:0.82rem;
  color:var(--muted,#64748b); border-radius:8px; }
.wpm-preview-err { font-size:0.78rem; color:#f87171; padding:8px; }
.wpm-meta { flex-direction:column; gap:4px; }
.wpm-meta-name { font-size:0.9rem; font-weight:700; }
.wpm-meta-desc { font-size:0.75rem; color:var(--muted,#64748b); line-height:1.5; }
.wpm-meta-tags { display:flex; flex-wrap:wrap; gap:3px; }
.wpm-meta-tag { font-size:0.6rem; padding:1px 6px; border-radius:5px; background:var(--primary-muted,rgba(129,140,248,0.12)); color:var(--primary,#818cf8); }
.wpm-cfg-section { flex-direction:column; gap:4px; }
.wpm-config-lbl { font-size:0.7rem; font-weight:700; color:var(--muted,#64748b); }
.wpm-config-ta { width:100%; padding:6px 8px; font-size:0.72rem; font-family:var(--mono,monospace);
  background:var(--card,#222635); border:1px solid var(--border,#2d3347); border-radius:6px;
  color:var(--text,#cbd5e1); resize:vertical; min-height:60px; max-height:100px; box-sizing:border-box; }
.wpm-config-ta:focus { outline:none; border-color:var(--primary,#818cf8); }
.wpm-config-err { font-size:0.7rem; color:#f87171; margin-top:2px; }
/* ── Footer ──────────────────────────────────────────────────── */
.wpm-footer { padding:10px 14px; border-top:1px solid var(--border,#2d3347);
  display:flex; align-items:center; gap:8px; flex-shrink:0; }
.wpm-footer-sel { flex:1; font-size:0.78rem; color:var(--muted,#64748b); }
.wpm-footer-sel strong { color:var(--text,#cbd5e1); }
.wpm-fbtn { font-size:0.84rem; padding:6px 16px; border-radius:7px;
  border:1px solid var(--border,#2d3347); cursor:pointer; font-family:inherit; }
.wpm-fbtn-cancel { background:transparent; color:var(--muted,#64748b); }
.wpm-fbtn-cancel:hover { background:var(--card-hover,#2a2e3f); }
.wpm-fbtn-confirm { background:var(--primary,#818cf8); color:#fff; border-color:var(--primary,#818cf8); font-weight:600; }
.wpm-fbtn-confirm:disabled { opacity:0.35; cursor:not-allowed; }
/* ── Trigger button (used outside modal) ────────────────────── */
.wpm-trigger-btn { width:100%; text-align:left; padding:5px 10px;
  background:var(--card,#222635); border:1px solid var(--border,#2d3347);
  color:var(--text,#cbd5e1); border-radius:6px; font-size:0.82rem; cursor:pointer;
  font-family:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  transition:border-color 0.15s; }
.wpm-trigger-btn:hover { border-color:var(--primary,#818cf8); }
`;
        const el = document.createElement('style');
        el.textContent = css;
        document.head.appendChild(el);
    }

    static open({ currentId = null, onSelect }) {
        document.querySelectorAll('.wpm-backdrop').forEach(e => e.remove());
        WidgetPickerModal.ensureStyles();
        new WidgetPickerModal(currentId, onSelect)._show();
    }

    constructor(currentId, onSelect) {
        this.currentId = currentId;
        this.onSelect = onSelect;
        this.selectedId = currentId;
        this.filterCat = 'all';
        this.filterQ = '';
        this._previewTimer = null;
        this._configTimer = null;
        this._el = null;
    }

    // ── Registry helpers ────────────────────────────────────────
    _reg() { return window.OEI_WIDGET_REGISTRY || {}; }

    _allWidgets() {
        return Object.entries(this._reg()).filter(([, r]) => r.label && r.category);
    }

    _categories() {
        const seen = new Set(), cats = [];
        for (const [, r] of this._allWidgets()) {
            if (!seen.has(r.category)) { seen.add(r.category); cats.push(r.category); }
        }
        return cats;
    }

    _filtered() {
        const q = this.filterQ.toLowerCase().trim();
        return this._allWidgets().filter(([, r]) => {
            if (this.filterCat !== 'all' && r.category !== this.filterCat) return false;
            if (q) {
                const hay = `${r.label} ${r.description || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    _iconOf(id) {
        const r = this._reg()[id];
        if (!r?.staticFallback) return '⚙️';
        // staticFallback peut être une fonction (cfg) => html ou une string
        const html = typeof r.staticFallback === 'function' ? r.staticFallback({}) : String(r.staticFallback);
        return html.match(/<span class="sl-sim-icon">([^<]+)<\/span>/)?.[1] || '⚙️';
    }

    _e(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Build + show modal ──────────────────────────────────────
    _show() {
        const cats = this._categories();
        const backdrop = document.createElement('div');
        backdrop.className = 'wpm-backdrop';
        backdrop.addEventListener('click', e => { if (e.target === backdrop) this._close(); });

        const modal = document.createElement('div');
        modal.className = 'wpm-modal';
        modal.innerHTML = `
<div class="wpm-header">
  <span class="wpm-header-title">🧩 Choisir un widget</span>
  <button class="wpm-close" data-close>✕</button>
</div>
<div class="wpm-body">
  <div class="wpm-left">
    <div class="wpm-filters">
      <input class="wpm-search" data-search placeholder="🔍 Rechercher…" autocomplete="off">
      <div class="wpm-cats">
        <button class="wpm-cat active" data-cat="all">Tous</button>
        ${cats.map(c => `<button class="wpm-cat" data-cat="${this._e(c)}">${this._e(c)}</button>`).join('')}
      </div>
      <div class="wpm-count" data-count></div>
    </div>
    <div class="wpm-list" data-list></div>
  </div>
  <div class="wpm-right">
    <div class="wpm-preview-wrap">
      <div class="wpm-preview-lbl">Aperçu</div>
      <div class="wpm-preview-box" data-preview>
        <div class="wpm-preview-ph">
          <div class="wpm-preview-ph-ico">🧩</div>
          <div class="wpm-preview-ph-txt">Sélectionnez un widget pour voir l'aperçu</div>
        </div>
      </div>
      <div class="wpm-meta" data-meta style="display:none">
        <div class="wpm-meta-name" data-meta-name></div>
        <div class="wpm-meta-desc" data-meta-desc></div>
        <div class="wpm-meta-tags" data-meta-tags></div>
      </div>
      <div class="wpm-cfg-section" data-cfg-section style="display:none">
        <div class="wpm-config-lbl">Configuration (JSON)</div>
        <textarea class="wpm-config-ta" data-cfg rows="3"></textarea>
        <div class="wpm-config-err" data-cfg-err style="display:none"></div>
      </div>
    </div>
  </div>
</div>
<div class="wpm-footer">
  <div class="wpm-footer-sel" data-footer-sel>Aucun widget sélectionné</div>
  <button class="wpm-fbtn wpm-fbtn-cancel" data-close>Annuler</button>
  <button class="wpm-fbtn wpm-fbtn-confirm" data-confirm ${this.selectedId ? '' : 'disabled'}>Insérer le widget</button>
</div>`;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        this._el = backdrop;

        // Close buttons
        modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this._close()));

        // Confirm
        modal.querySelector('[data-confirm]').addEventListener('click', () => this._confirm());

        // Search
        modal.querySelector('[data-search]').addEventListener('input', e => {
            this.filterQ = e.target.value;
            this._renderCards();
        });

        // Category pills
        modal.querySelectorAll('[data-cat]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterCat = btn.dataset.cat;
                modal.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderCards();
            });
        });

        // Config textarea (debounced remount)
        modal.querySelector('[data-cfg]').addEventListener('input', () => {
            clearTimeout(this._configTimer);
            this._configTimer = setTimeout(() => { if (this.selectedId) this._loadPreview(this.selectedId); }, 700);
        });

        // Initial render
        this._renderCards();

        // Scroll to + preview current selection
        if (this.selectedId) {
            setTimeout(() => {
                const card = modal.querySelector(`[data-wid="${this.selectedId}"]`);
                card?.scrollIntoView({ block: 'nearest' });
                this._selectCard(this.selectedId, false); // false = no preview auto-load yet
                // Trigger preview after small delay
                this._previewTimer = setTimeout(() => this._loadPreview(this.selectedId), 200);
            }, 80);
        }
    }

    _q(sel) { return this._el?.querySelector(sel); }

    // ── Card list ───────────────────────────────────────────────
    _renderCards() {
        const list = this._q('[data-list]');
        const countEl = this._q('[data-count]');
        if (!list) return;

        const filtered = this._filtered();
        if (countEl) countEl.textContent = `${filtered.length} widget${filtered.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            list.innerHTML = `<div class="wpm-none">Aucun widget trouvé pour cette recherche.</div>`;
            return;
        }

        // Group by category
        const groups = new Map();
        for (const [id, r] of filtered) {
            if (!groups.has(r.category)) groups.set(r.category, []);
            groups.get(r.category).push([id, r]);
        }

        const showSeps = groups.size > 1;
        list.innerHTML = '';

        for (const [cat, widgets] of groups) {
            if (showSeps) {
                const sep = document.createElement('div');
                sep.className = 'wpm-sep';
                sep.textContent = cat;
                list.appendChild(sep);
            }
            for (const [id, r] of widgets) {
                const card = document.createElement('div');
                card.className = 'wpm-card' + (id === this.selectedId ? ' active' : '');
                card.dataset.wid = id;
                card.innerHTML = `
  <div class="wpm-card-ico">${this._iconOf(id)}</div>
  <div class="wpm-card-body">
    <div class="wpm-card-name">${this._e(r.label)}</div>
    ${r.description ? `<div class="wpm-card-desc">${this._e(r.description)}</div>` : ''}
  </div>
  <div class="wpm-card-badges">
    ${r.level ? `<span class="wpm-badge wpm-badge-level">${this._e(r.level)}</span>` : ''}
  </div>`;
                card.addEventListener('click', () => this._selectCard(id));
                list.appendChild(card);
            }
        }
    }

    // ── Select a card ───────────────────────────────────────────
    _selectCard(id, triggerPreview = true) {
        this.selectedId = id;
        const r = this._reg()[id] || {};

        // Highlight cards
        this._el?.querySelectorAll('[data-wid]').forEach(c => c.classList.toggle('active', c.dataset.wid === id));

        // Footer
        const footerSel = this._q('[data-footer-sel]');
        if (footerSel) footerSel.innerHTML = `Sélectionné : <strong>${this._e(r.label || id)}</strong>`;
        const confirmBtn = this._q('[data-confirm]');
        if (confirmBtn) confirmBtn.disabled = false;

        // Meta section
        const metaEl = this._q('[data-meta]');
        if (metaEl) {
            metaEl.style.display = 'flex';
            this._q('[data-meta-name]').textContent = r.label || id;
            this._q('[data-meta-desc]').textContent = r.description || '';
            const tagsEl = this._q('[data-meta-tags]');
            if (tagsEl) tagsEl.innerHTML = (r.tags || []).slice(0, 6).map(t => `<span class="wpm-meta-tag">${this._e(t)}</span>`).join('');
        }

        // Config textarea
        const cfgSection = this._q('[data-cfg-section]');
        const cfgTa = this._q('[data-cfg]');
        if (cfgSection && cfgTa) {
            cfgSection.style.display = 'flex';
            if (cfgTa.dataset.lastId !== id) {
                const cfg = r.defaultConfig || {};
                cfgTa.value = Object.keys(cfg).length ? JSON.stringify(cfg, null, 2) : '{}';
                cfgTa.dataset.lastId = id;
            }
        }

        // Trigger preview
        if (triggerPreview) {
            clearTimeout(this._previewTimer);
            this._previewTimer = setTimeout(() => this._loadPreview(id), 80);
        }
    }

    // ── Config JSON ─────────────────────────────────────────────
    _getConfig() {
        const ta = this._q('[data-cfg]');
        const errEl = this._q('[data-cfg-err]');
        try {
            const cfg = ta?.value?.trim() ? JSON.parse(ta.value) : {};
            if (errEl) errEl.style.display = 'none';
            return cfg;
        } catch (e) {
            if (errEl) { errEl.textContent = 'JSON invalide : ' + e.message; errEl.style.display = ''; }
            return null;
        }
    }

    // ── Preview ─────────────────────────────────────────────────
    async _loadPreview(id) {
        const box = this._q('[data-preview]');
        if (!box) return;

        const r = this._reg()[id];
        if (!r) { box.innerHTML = `<div class="wpm-preview-err">Widget introuvable dans le registre.</div>`; return; }

        // Spinner
        const spinner = document.createElement('div');
        spinner.className = 'wpm-preview-spinner';
        spinner.textContent = 'Chargement…';
        box.innerHTML = '';
        box.appendChild(spinner);

        try {
            // Stubs minimalistes pour les classes de base (toujours définis avant le chargement)
            if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
            if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
            if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;
            if (!window[r.global]) {
                // Clé de version par session : force un rechargement fresh même si le navigateur a
                // une version ancienne en cache (ex: avant l'ajout d'une classe standalone en Phase 2).
                if (!WidgetPickerModal._sv) WidgetPickerModal._sv = Date.now();
                const scriptSrc = `../shared/components/${r.script}`;
                // Retire tout tag existant pour ce script (avec ou sans paramètre version)
                document.querySelectorAll(`script[src^="${scriptSrc}"]`).forEach(t => t.remove());
                await this._loadScript(`${scriptSrc}?v=${WidgetPickerModal._sv}`);
            }
            const Cls = window[r.global];
            if (!Cls || typeof Cls.mount !== 'function') {
                throw new Error(`${r.global}.mount() introuvable — vérifie que la classe expose static mount().`);
            }
            const cfg = this._getConfig() ?? (r.defaultConfig || {});
            box.innerHTML = '';
            const mountEl = document.createElement('div');
            box.appendChild(mountEl);
            Cls.mount(mountEl, cfg);
        } catch (err) {
            box.innerHTML = `<div class="wpm-preview-err">⚠️ ${this._e(err.message)}</div>`;
        }
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error(`Impossible de charger : ${src}`));
            document.head.appendChild(el);
        });
    }

    // ── Close / Confirm ─────────────────────────────────────────
    _close() {
        clearTimeout(this._previewTimer);
        clearTimeout(this._configTimer);
        this._el?.remove();
        this._el = null;
    }

    _confirm() {
        if (!this.selectedId) return;
        const id = this.selectedId;
        this._close();
        this.onSelect(id);
    }
}

// Inject trigger button styles immediately on load
if (typeof document !== 'undefined') {
    WidgetPickerModal.ensureStyles();
}

if (typeof window !== 'undefined') {
    window.WidgetPickerModal = WidgetPickerModal;
}
