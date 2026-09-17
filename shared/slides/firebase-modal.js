/**
 * OEIFirebaseModal — Modal Firebase pour PresentaForge
 *
 * 3 vues : config → auth → liste de présentations
 *
 * Usage :
 *   OEIFirebaseModal.open({ mode: 'open', onLoad: (data) => {} });
 *   OEIFirebaseModal.open({ mode: 'save', currentData: {...} });
 */
(function () {
    'use strict';

    const MODAL_ID = 'oei-fbm-overlay';

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _loadStorageScript() {
        return new Promise((resolve, reject) => {
            if (window.OEIFirebase) { resolve(); return; }
            // Try to find the base URL relative to this script
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const self    = scripts.find(s => s.src.includes('firebase-modal'));
            const base    = self ? self.src.replace('firebase-modal.js', '') : '../shared/slides/';
            const src     = base + 'firebase-storage.js';
            const s       = document.createElement('script');
            s.src   = src;
            s.onload  = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _fmt(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    }

    function _close() {
        const el = document.getElementById(MODAL_ID);
        if (el) el.remove();
    }

    // Nom de groupe affiché pour les présentations sans cours renseigné.
    const NO_COURSE_LABEL = 'Sans cours';

    /** Liste triée des cours distincts (non vides), pour l'auto-complétion (datalist). */
    function _distinctCourses(presentations) {
        const set = new Set();
        (presentations || []).forEach(p => {
            const c = String(p?.course || '').trim();
            if (c) set.add(c);
        });
        return [...set].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    }

    /**
     * Groupe les présentations par cours (clé exacte, tronquée). Les groupes sont triés
     * alphabétiquement ; le groupe "Sans cours" (course vide) est toujours placé en dernier.
     * L'ordre des présentations à l'intérieur d'un groupe est conservé (déjà trié par date
     * de modification par listPresentations()).
     * @returns {{ course: string, label: string, items: object[] }[]}
     */
    function _groupByCourse(presentations) {
        const groups = new Map(); // course trimmée ('' = sans cours) -> items
        (presentations || []).forEach(p => {
            const key = String(p?.course || '').trim();
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        });
        const entries = [...groups.entries()].map(([course, items]) => ({
            course,
            label: course || NO_COURSE_LABEL,
            items,
        }));
        entries.sort((a, b) => {
            if (!a.course && b.course) return 1;
            if (a.course && !b.course) return -1;
            return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
        });
        return entries;
    }

    /** Filtre par titre OU cours (insensible à la casse/accents), avant regroupement. */
    function _filterPresentations(presentations, query) {
        const q = String(query || '').trim().toLocaleLowerCase('fr');
        if (!q) return presentations || [];
        return (presentations || []).filter(p => {
            const title = String(p?.title || '').toLocaleLowerCase('fr');
            const course = String(p?.course || '').toLocaleLowerCase('fr');
            return title.includes(q) || course.includes(q);
        });
    }

    // Une couleur de bandeau vient de Firestore (donnée non fiable par principe, même si elle
    // ne peut normalement provenir que d'un <input type="color">) et atterrit dans un attribut
    // style="…" : même regex de validation que slides/index-main.js (_colorFromTitle/thumbBg).
    function _safeCssColor(value) {
        return (typeof value === 'string' && /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d%,.\s/]+\)|[a-z-]+|(linear|radial)-gradient\([^"'<>]+\))$/i.test(value.trim()))
            ? value.trim() : null;
    }

    /** Bandeau propre à la présentation, sinon bandeau par défaut de son cours, sinon rien. */
    function _resolveBanner(p, courseBanners) {
        const own = p?.banner && (p.banner.color || p.banner.icon || p.banner.image) ? p.banner : null;
        if (own) return own;
        const course = p?.course;
        return (course && courseBanners && courseBanners[course]) || null;
    }

    function _overlay(content) {
        _close();
        const div       = document.createElement('div');
        div.id          = MODAL_ID;
        div.className   = 'fbm-overlay';
        div.innerHTML   = content;
        div.addEventListener('click', (e) => { if (e.target === div) _close(); });
        document.body.appendChild(div);
        return div;
    }

    // ── View 1 : Configuration Firebase ──────────────────────────────────────

    function _viewConfig(ctx) {
        const cfg = (window.OEIFirebase && window.OEIFirebase.getConfig()) || {};
        const overlay = _overlay(`
<div class="fbm-modal">
  <div class="fbm-header">
    <span class="fbm-icon">&#x1F525;</span>
    <h2 class="fbm-title">Connexion Firebase</h2>
    <button class="fbm-close" id="fbm-close">&#x2715;</button>
  </div>
  <p class="fbm-desc">Entrez la configuration de votre projet Firebase. Ces informations sont stockées uniquement dans votre navigateur.</p>
  <div class="fbm-field">
    <label class="fbm-label">API Key</label>
    <input class="fbm-input" id="fbm-apiKey" type="text" placeholder="AIzaSy..." value="${_esc(cfg.apiKey || '')}">
  </div>
  <div class="fbm-field">
    <label class="fbm-label">Auth Domain</label>
    <input class="fbm-input" id="fbm-authDomain" type="text" placeholder="mon-projet.firebaseapp.com" value="${_esc(cfg.authDomain || '')}">
  </div>
  <div class="fbm-field">
    <label class="fbm-label">Project ID</label>
    <input class="fbm-input" id="fbm-projectId" type="text" placeholder="mon-projet" value="${_esc(cfg.projectId || '')}">
  </div>
  <details class="fbm-advanced">
    <summary class="fbm-advanced-toggle">Paramètres avancés (optionnels)</summary>
    <div class="fbm-field">
      <label class="fbm-label">Storage Bucket</label>
      <input class="fbm-input" id="fbm-storageBucket" type="text" placeholder="mon-projet.appspot.com" value="${_esc(cfg.storageBucket || '')}">
    </div>
    <div class="fbm-field">
      <label class="fbm-label">Messaging Sender ID</label>
      <input class="fbm-input" id="fbm-messagingSenderId" type="text" placeholder="123456789" value="${_esc(cfg.messagingSenderId || '')}">
    </div>
    <div class="fbm-field">
      <label class="fbm-label">App ID</label>
      <input class="fbm-input" id="fbm-appId" type="text" placeholder="1:123:web:abc" value="${_esc(cfg.appId || '')}">
    </div>
  </details>
  <div class="fbm-error" id="fbm-config-error" style="display:none"></div>
  <div class="fbm-actions">
    <button class="fbm-btn fbm-btn-secondary" id="fbm-clear-config">Effacer la config</button>
    <button class="fbm-btn fbm-btn-primary" id="fbm-config-next">Suivant &rarr;</button>
  </div>
</div>`);

        overlay.querySelector('#fbm-close').onclick = _close;
        overlay.querySelector('#fbm-clear-config').onclick = () => {
            if (window.OEIFirebase) window.OEIFirebase.clearConfig();
            _viewConfig(ctx);
        };
        overlay.querySelector('#fbm-config-next').onclick = async () => {
            const config = {
                apiKey:            overlay.querySelector('#fbm-apiKey').value.trim(),
                authDomain:        overlay.querySelector('#fbm-authDomain').value.trim(),
                projectId:         overlay.querySelector('#fbm-projectId').value.trim(),
                storageBucket:     overlay.querySelector('#fbm-storageBucket').value.trim(),
                messagingSenderId: overlay.querySelector('#fbm-messagingSenderId').value.trim(),
                appId:             overlay.querySelector('#fbm-appId').value.trim(),
            };
            if (!config.apiKey || !config.authDomain || !config.projectId) {
                _showError('fbm-config-error', 'Veuillez remplir API Key, Auth Domain et Project ID.');
                return;
            }
            const btn = overlay.querySelector('#fbm-config-next');
            btn.disabled = true; btn.textContent = 'Connexion…';
            try {
                await _loadStorageScript();
                await window.OEIFirebase.init(config);
                window.OEIFirebase.saveConfig(config);
                _viewAuth(ctx);
            } catch (e) {
                btn.disabled = false; btn.textContent = 'Suivant →';
                _showError('fbm-config-error', 'Erreur : ' + (e.message || e));
            }
        };
    }

    // ── View 2 : Authentification ─────────────────────────────────────────────

    function _viewAuth(ctx) {
        const savedUser = (() => {
            try { return JSON.parse(localStorage.getItem('oei-firebase-user') || 'null'); } catch { return null; }
        })();

        const overlay = _overlay(`
<div class="fbm-modal">
  <div class="fbm-header">
    <button class="fbm-back" id="fbm-back">&#x2190;</button>
    <span class="fbm-icon">&#x1F511;</span>
    <h2 class="fbm-title">Connexion</h2>
    <button class="fbm-close" id="fbm-close">&#x2715;</button>
  </div>
  <p class="fbm-desc">Connectez-vous avec votre compte Firebase.</p>
  ${(() => { const ie = window.OEIFirebase && window.OEIFirebase.getInitError && window.OEIFirebase.getInitError(); return ie ? `<div class="fbm-error" style="display:block">SDK Firebase non chargé (${_esc(ie)}). Un bloqueur de pub ou un réseau filtré empêche l'accès à <code>gstatic.com</code> — désactivez-le sur ce site puis rechargez la page.</div>` : ''; })()}
  ${savedUser ? `<div class="fbm-saved-user">Dernier compte : <strong>${_esc(savedUser.email)}</strong></div>` : ''}
  <button class="fbm-btn fbm-btn-google" id="fbm-google">
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.6 0 6.4 5.4 2.6 13.2l7.9 6.2C12.3 13.7 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/><path fill="#FBBC05" d="M10.5 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .8-4.4l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.6l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.3-4.5 2.1-8.8 2.1-6.4 0-11.7-4.2-13.5-9.9l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/></svg>
    Se connecter avec Google
  </button>
  <div class="fbm-divider"><span>ou</span></div>
  <div class="fbm-field">
    <label class="fbm-label">Email</label>
    <input class="fbm-input" id="fbm-email" type="email" placeholder="vous@exemple.com" value="${_esc(savedUser ? savedUser.email : '')}">
  </div>
  <div class="fbm-field">
    <label class="fbm-label">Mot de passe</label>
    <input class="fbm-input" id="fbm-password" type="password" placeholder="••••••••">
  </div>
  <div class="fbm-error" id="fbm-auth-error" style="display:none"></div>
  <div class="fbm-success" id="fbm-auth-info" style="display:none"></div>
  <div class="fbm-actions">
    <button class="fbm-btn fbm-btn-ghost fbm-btn-sm" id="fbm-forgot">Mot de passe oublié ?</button>
    <button class="fbm-btn fbm-btn-primary" id="fbm-signin">Se connecter</button>
  </div>
</div>`);

        overlay.querySelector('#fbm-close').onclick = _close;
        overlay.querySelector('#fbm-back').onclick  = () => _viewConfig(ctx);

        // Identifiant Google en attente de liaison à un compte e-mail/mot de passe
        // (erreur auth/account-exists-with-different-credential).
        let _pendingGoogleCred = null;

        const doSignIn = async () => {
            const email    = overlay.querySelector('#fbm-email').value.trim();
            const password = overlay.querySelector('#fbm-password').value;
            if (!email || !password) { _showError('fbm-auth-error', 'Veuillez remplir email et mot de passe.'); return; }
            const btn = overlay.querySelector('#fbm-signin');
            btn.disabled = true; btn.textContent = 'Connexion…';
            try {
                if (_pendingGoogleCred) {
                    await window.OEIFirebase.linkGoogleToPassword(email, password, _pendingGoogleCred);
                    _pendingGoogleCred = null;
                } else {
                    await window.OEIFirebase.signIn(email, password);
                }
                _viewList(ctx);
            } catch (e) {
                btn.disabled = false; btn.textContent = 'Se connecter';
                _showError('fbm-auth-error', _authError(e.code));
            }
        };

        const doGoogle = async () => {
            const btn = overlay.querySelector('#fbm-google');
            btn.disabled = true;
            _hide('fbm-auth-error'); _hide('fbm-auth-info');
            try {
                const u = await window.OEIFirebase.signInWithGoogle();
                if (u) { _viewList(ctx); return; }
                // u === null → redirection en cours, la page va naviguer.
                btn.disabled = false;
            } catch (e) {
                btn.disabled = false;
                if (e && e.code === 'auth/account-exists-with-different-credential') {
                    _pendingGoogleCred = e.credential || null;
                    const em = (e.email || (e.customData && e.customData.email) || '').trim();
                    if (em) overlay.querySelector('#fbm-email').value = em;
                    _showInfo(overlay, 'Un compte e-mail/mot de passe existe déjà pour cette adresse. Saisissez votre mot de passe puis « Se connecter » pour lier Google (une seule fois).');
                    setTimeout(() => overlay.querySelector('#fbm-password').focus(), 50);
                    return;
                }
                _showError('fbm-auth-error', _authError(e.code));
            }
        };

        const doForgot = async () => {
            const email = overlay.querySelector('#fbm-email').value.trim();
            if (!email) { _showError('fbm-auth-error', 'Saisissez d\'abord votre email, puis cliquez « Mot de passe oublié ? ».'); return; }
            const btn = overlay.querySelector('#fbm-forgot');
            btn.disabled = true;
            _hide('fbm-auth-error');
            try {
                await window.OEIFirebase.sendPasswordReset(email);
                _showInfo(overlay, 'Email de réinitialisation envoyé à ' + email + ' (pensez à vérifier les spams). Suivez le lien pour définir un nouveau mot de passe, puis reconnectez-vous ici.');
            } catch (e) {
                btn.disabled = false;
                _showError('fbm-auth-error', _authError(e.code));
            }
        };

        overlay.querySelector('#fbm-signin').onclick = doSignIn;
        overlay.querySelector('#fbm-google').onclick = doGoogle;
        overlay.querySelector('#fbm-forgot').onclick = doForgot;
        overlay.querySelector('#fbm-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSignIn();
        });
        // Auto-focus password if email pre-filled
        if (savedUser) setTimeout(() => overlay.querySelector('#fbm-password').focus(), 50);
        else setTimeout(() => overlay.querySelector('#fbm-email').focus(), 50);
    }

    // ── View 3 : Liste des présentations ──────────────────────────────────────

    async function _viewList(ctx) {
        const user    = window.OEIFirebase.getUser();
        const isSave  = ctx.mode === 'save';
        const overlay = _overlay(`
<div class="fbm-modal fbm-modal--wide">
  <div class="fbm-header">
    <span class="fbm-icon">&#x2601;</span>
    <h2 class="fbm-title">${isSave ? 'Sauvegarder sur Firebase' : 'Ouvrir depuis Firebase'}</h2>
    <div class="fbm-user-badge">${_esc(user ? user.email : '')}</div>
    <button class="fbm-close" id="fbm-close">&#x2715;</button>
  </div>
  <div class="fbm-list-toolbar">
    <input class="fbm-input fbm-filter-input" id="fbm-filter" type="search" placeholder="Rechercher un titre ou un cours…">
  </div>
  <div class="fbm-list-area" id="fbm-list-area">
    <div class="fbm-loading">Chargement…</div>
  </div>
  ${isSave ? `
  <div class="fbm-save-bar">
    <span class="fbm-save-title-label">Titre :</span>
    <input class="fbm-input fbm-save-title-input" id="fbm-save-title" type="text" placeholder="Nom de la présentation…">
    <input class="fbm-input" id="fbm-save-course" type="text" placeholder="Cours (ex: L1 Info, Algo…)" style="max-width:180px" list="fbm-course-list">
    <button class="fbm-btn fbm-btn-ghost" id="fbm-save-banner-btn" title="Bandeau de la présentation">&#x1F3F7; Bandeau</button>
    <label class="fbm-save-public-label" title="Toute personne disposant du lien peut voir la présentation">
      <input type="checkbox" id="fbm-save-public"> Partage public
    </label>
    <button class="fbm-btn fbm-btn-primary" id="fbm-do-save">Sauvegarder</button>
  </div>` : ''}
  <datalist id="fbm-course-list"></datalist>
  <div class="fbm-list-footer">
    <button class="fbm-btn fbm-btn-ghost" id="fbm-signout">Se déconnecter</button>
  </div>
  <div class="fbm-error" id="fbm-list-error" style="display:none"></div>
</div>`);

        overlay.querySelector('#fbm-close').onclick   = _close;
        overlay.querySelector('#fbm-signout').onclick = async () => {
            await window.OEIFirebase.signOut();
            _viewAuth(ctx);
        };

        // Load list
        let presentations = [];
        let courseBanners = {};
        const refreshCourseList = () => {
            const dl = overlay.querySelector('#fbm-course-list');
            if (dl) dl.innerHTML = _distinctCourses(presentations).map(c => `<option value="${_esc(c)}">`).join('');
        };
        try {
            const [decks, banners] = await Promise.all([
                window.OEIFirebase.listPresentations(),
                window.OEIFirebase.listCourseBanners().catch(() => ({})),
            ]);
            presentations = decks;
            courseBanners = banners;
            refreshCourseList();
            _renderList(overlay, presentations, ctx, '', courseBanners);
        } catch (e) {
            overlay.querySelector('#fbm-list-area').innerHTML = `<div class="fbm-empty">Erreur : ${_esc(e.message)}</div>`;
        }

        overlay.querySelector('#fbm-filter').addEventListener('input', (e) => {
            _renderList(overlay, presentations, ctx, e.target.value, courseBanners);
        });

        // Pre-fill save title + course
        if (isSave) {
            const meta = ctx.currentData && ctx.currentData.metadata;
            overlay.querySelector('#fbm-save-title').value = meta?.title || '';
            overlay.querySelector('#fbm-save-course').value = meta?.course || '';
            let pendingBanner = (meta?.banner && (meta.banner.color || meta.banner.icon || meta.banner.image)) ? { ...meta.banner } : null;

            overlay.querySelector('#fbm-save-banner-btn').onclick = () => {
                if (!window.OEIBannerPicker) return;
                window.OEIBannerPicker.open({
                    title: 'Bandeau de la présentation',
                    initial: pendingBanner || {},
                    onSave: b => { pendingBanner = b; },
                    onClear: () => { pendingBanner = null; },
                });
            };

            overlay.querySelector('#fbm-do-save').onclick = async () => {
                const inputTitle  = overlay.querySelector('#fbm-save-title').value.trim();
                const inputCourse = overlay.querySelector('#fbm-save-course').value.trim();
                const isPublic    = overlay.querySelector('#fbm-save-public').checked;
                const dataToSave  = ctx.currentData || {};
                if (dataToSave.metadata) {
                    if (inputTitle)  dataToSave.metadata.title  = inputTitle;
                    if (inputCourse) dataToSave.metadata.course = inputCourse;
                    if (pendingBanner) dataToSave.metadata.banner = { ...pendingBanner };
                    else delete dataToSave.metadata.banner;
                }

                // Check if overwriting existing
                const existing = presentations.find(p => p.title === inputTitle);
                const existingId = existing ? existing.id : null;

                const btn = overlay.querySelector('#fbm-do-save');
                btn.disabled = true; btn.textContent = 'Sauvegarde…';
                try {
                    const id = await window.OEIFirebase.savePresentation(dataToSave, existingId || undefined, { public: isPublic, course: inputCourse, banner: pendingBanner });
                    _showSuccess(overlay, '&#x2714; Sauvegardé avec succès !');
                    setTimeout(_close, 1200);
                    if (ctx.onSave) ctx.onSave(id);
                } catch (e) {
                    btn.disabled = false; btn.textContent = 'Sauvegarder';
                    _showError('fbm-list-error', 'Erreur lors de la sauvegarde : ' + e.message);
                }
            };
        }
    }

    function _renderList(overlay, presentations, ctx, query = '', courseBanners = {}) {
        const isSave = ctx.mode === 'save';
        const area   = overlay.querySelector('#fbm-list-area');

        if (presentations.length === 0) {
            area.innerHTML = '<div class="fbm-empty">Aucune présentation sauvegardée.</div>';
            return;
        }

        const visible = _filterPresentations(presentations, query);
        if (visible.length === 0) {
            area.innerHTML = '<div class="fbm-empty">Aucun résultat pour cette recherche.</div>';
            return;
        }

        const renderRow = p => {
            const banner = _resolveBanner(p, courseBanners);
            const safeColor = banner ? _safeCssColor(banner.color) : null;
            const dotStyle = safeColor ? ` style="background:${safeColor}"` : '';
            const dot = banner ? `<span class="fbm-banner-dot"${dotStyle}>${_esc(banner.icon || '')}</span>` : '';
            return `
<div class="fbm-pres-row" data-id="${_esc(p.id)}">
  <div class="fbm-pres-info">
    <div class="fbm-pres-title-row">${dot}<span class="fbm-pres-title">${_esc(p.title)}</span></div>
    <span class="fbm-pres-date">${_fmt(p.modified)}</span>
  </div>
  <div class="fbm-pres-actions">
    <button class="fbm-btn fbm-btn-ghost fbm-btn-sm fbm-course-btn" data-id="${_esc(p.id)}" title="Changer de cours">&#x1F3F7;</button>
    ${!isSave ? `<button class="fbm-btn fbm-btn-primary fbm-btn-sm fbm-open-btn" data-id="${_esc(p.id)}">Ouvrir</button>` : `<button class="fbm-btn fbm-btn-secondary fbm-btn-sm fbm-overwrite-btn" data-id="${_esc(p.id)}" data-title="${_esc(p.title)}">Écraser</button>`}
    <button class="fbm-btn fbm-btn-danger fbm-btn-sm fbm-delete-btn" data-id="${_esc(p.id)}">&#x1F5D1;</button>
  </div>
</div>`;
        };

        const groups = _groupByCourse(visible);
        const html = groups.map(g => `
<details class="fbm-group" open>
  <summary class="fbm-group-header">
    <span>${_esc(g.label)} <span class="fbm-group-count">(${g.items.length})</span></span>
  </summary>
  <div class="fbm-group-body">${g.items.map(renderRow).join('')}</div>
</details>`).join('');
        area.innerHTML = html;

        // Rename/move a single presentation to another course (mise à jour légère,
        // sans re-télécharger le JSON de la présentation).
        area.querySelectorAll('.fbm-course-btn').forEach(btn => {
            btn.onclick = async () => {
                const p = presentations.find(x => x.id === btn.dataset.id);
                if (!p) return;
                const known = _distinctCourses(presentations);
                const hint = known.length ? `\n\nCours existants : ${known.join(', ')}` : '';
                const next = window.prompt(`Cours pour « ${p.title} » (vide = sans cours) :${hint}`, p.course || '');
                if (next === null) return; // annulé
                const trimmed = next.trim();
                if (trimmed === (p.course || '')) return;
                btn.disabled = true;
                try {
                    await window.OEIFirebase.updatePresentationCourse(p.id, trimmed);
                    p.course = trimmed;
                    const dl = overlay.querySelector('#fbm-course-list');
                    if (dl) dl.innerHTML = _distinctCourses(presentations).map(c => `<option value="${_esc(c)}">`).join('');
                    _renderList(overlay, presentations, ctx, overlay.querySelector('#fbm-filter')?.value || '', courseBanners);
                } catch (e) {
                    btn.disabled = false;
                    _showError('fbm-list-error', 'Erreur : ' + e.message);
                }
            };
        });

        // Open buttons
        area.querySelectorAll('.fbm-open-btn').forEach(btn => {
            btn.onclick = async () => {
                btn.disabled = true; btn.textContent = '…';
                try {
                    const data = await window.OEIFirebase.loadPresentation(btn.dataset.id);
                    _close();
                    if (ctx.onLoad) ctx.onLoad(data, btn.dataset.id);
                } catch (e) {
                    btn.disabled = false; btn.textContent = 'Ouvrir';
                    _showError('fbm-list-error', 'Erreur : ' + e.message);
                }
            };
        });

        // Overwrite buttons (save mode)
        area.querySelectorAll('.fbm-overwrite-btn').forEach(btn => {
            btn.onclick = async () => {
                const title = btn.dataset.title;
                if (!confirm(`Écraser "${title}" ?`)) return;
                btn.disabled = true; btn.textContent = '…';
                const dataToSave = ctx.currentData || {};
                const inputCourse = overlay.querySelector('#fbm-save-course')?.value.trim() || '';
                const isPublic    = overlay.querySelector('#fbm-save-public')?.checked || false;
                if (dataToSave.metadata && inputCourse) dataToSave.metadata.course = inputCourse;
                try {
                    await window.OEIFirebase.savePresentation(dataToSave, btn.dataset.id, { public: isPublic, course: inputCourse });
                    _showSuccess(overlay, '&#x2714; Écrasé avec succès !');
                    setTimeout(_close, 1200);
                    if (ctx.onSave) ctx.onSave(btn.dataset.id);
                } catch (e) {
                    btn.disabled = false; btn.textContent = 'Écraser';
                    _showError('fbm-list-error', 'Erreur : ' + e.message);
                }
            };
        });

        // Delete buttons
        area.querySelectorAll('.fbm-delete-btn').forEach(btn => {
            btn.onclick = async () => {
                const row   = btn.closest('.fbm-pres-row');
                const title = row.querySelector('.fbm-pres-title').textContent;
                if (!confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
                try {
                    await window.OEIFirebase.deletePresentation(btn.dataset.id);
                    row.remove();
                    if (!area.querySelector('.fbm-pres-row')) {
                        area.innerHTML = '<div class="fbm-empty">Aucune présentation sauvegardée.</div>';
                    }
                } catch (e) {
                    _showError('fbm-list-error', 'Erreur : ' + e.message);
                }
            };
        });
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    function _showError(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function _hide(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    // Message d'information non bloquant (lié / reset envoyé…), rendu dans #fbm-auth-info.
    function _showInfo(overlay, msg) {
        const el = overlay.querySelector('#fbm-auth-info');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function _showSuccess(overlay, html) {
        let el = overlay.querySelector('.fbm-success');
        if (!el) {
            el = document.createElement('div');
            el.className = 'fbm-success';
            overlay.querySelector('.fbm-modal').appendChild(el);
        }
        el.innerHTML = html;
        el.style.display = 'block';
    }

    function _authError(code) {
        const map = {
            'auth/invalid-credential':         'Email ou mot de passe incorrect.',
            'auth/invalid-login-credentials':  'Email ou mot de passe incorrect.',
            'auth/user-not-found':             'Aucun compte avec cet email.',
            'auth/wrong-password':             'Mot de passe incorrect.',
            'auth/too-many-requests':          'Trop de tentatives. Réessayez plus tard.',
            'auth/invalid-email':              'Email invalide.',
            'auth/user-disabled':              'Ce compte est désactivé.',
            'auth/operation-not-allowed':      'Connexion e-mail/mot de passe désactivée sur le projet Firebase.',
            'auth/network-request-failed':     'Erreur réseau. Vérifiez votre connexion (VPN, proxy, bloqueur de pub ?).',
            'auth/timeout':                    'Firebase n\'a pas répondu — réseau bloqué, navigation privée, ou stockage du navigateur désactivé. Réessayez, ou dans une fenêtre normale.',
            'auth/sdk-unavailable':            'Le SDK Firebase ne s\'est pas chargé (gstatic.com bloqué par un bloqueur de pub / réseau filtré, ou hors-ligne). Désactivez le bloqueur sur ce site puis rechargez.',
            'auth/popup-blocked':              'La fenêtre Google a été bloquée par le navigateur. Autorisez les pop-ups pour ce site, ou réessayez (on bascule alors en redirection).',
            'auth/popup-closed-by-user':       'Fenêtre Google fermée avant la fin de la connexion.',
            'auth/cancelled-popup-request':    'Une autre fenêtre de connexion est déjà ouverte.',
            'auth/account-exists-with-different-credential': 'Un compte e-mail/mot de passe existe déjà pour cette adresse. Connectez-vous avec le mot de passe (ou réinitialisez-le) pour lier Google.',
            'auth/unauthorized-domain':        'Ce domaine n\'est pas autorisé pour la connexion Google dans la console Firebase (Authentication → Settings → Authorized domains).',
            'auth/missing-email':              'Saisissez d\'abord votre email.',
        };
        return map[code] || 'Erreur de connexion (' + (code || 'inconnue') + ').';
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * @param {Object} ctx
     * @param {'open'|'save'} ctx.mode
     * @param {Function}  [ctx.onLoad]      — appelé avec (data) quand une pres. est ouverte
     * @param {Function}  [ctx.onSave]      — appelé avec (id) après sauvegarde
     * @param {Object}    [ctx.currentData] — données courantes (mode save)
     */
    async function open(ctx) {
        const fb = window.OEIFirebase;
        if (!fb) { alert('Firebase non disponible (firebase-storage.js manquant)'); return; }

        // Attendre que l'état auth soit résolu (SDK chargé + session restaurée ou non)
        await fb.ready();

        if (fb.isReady()) {
            _viewList(ctx);
        } else {
            _viewAuth(ctx);
        }
    }

    window.OEIFirebaseModal = {
        open,
        testUtils: { groupByCourse: _groupByCourse, filterPresentations: _filterPresentations, distinctCourses: _distinctCourses },
    };
})();
