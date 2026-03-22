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
  <p class="fbm-desc">Connectez-vous avec votre compte Firebase (email/mot de passe).</p>
  ${savedUser ? `<div class="fbm-saved-user">Dernier compte : <strong>${_esc(savedUser.email)}</strong></div>` : ''}
  <div class="fbm-field">
    <label class="fbm-label">Email</label>
    <input class="fbm-input" id="fbm-email" type="email" placeholder="vous@exemple.com" value="${_esc(savedUser ? savedUser.email : '')}">
  </div>
  <div class="fbm-field">
    <label class="fbm-label">Mot de passe</label>
    <input class="fbm-input" id="fbm-password" type="password" placeholder="••••••••">
  </div>
  <div class="fbm-error" id="fbm-auth-error" style="display:none"></div>
  <div class="fbm-actions">
    <button class="fbm-btn fbm-btn-primary" id="fbm-signin">Se connecter</button>
  </div>
</div>`);

        overlay.querySelector('#fbm-close').onclick = _close;
        overlay.querySelector('#fbm-back').onclick  = () => _viewConfig(ctx);

        const doSignIn = async () => {
            const email    = overlay.querySelector('#fbm-email').value.trim();
            const password = overlay.querySelector('#fbm-password').value;
            if (!email || !password) { _showError('fbm-auth-error', 'Veuillez remplir email et mot de passe.'); return; }
            const btn = overlay.querySelector('#fbm-signin');
            btn.disabled = true; btn.textContent = 'Connexion…';
            try {
                await window.OEIFirebase.signIn(email, password);
                _viewList(ctx);
            } catch (e) {
                btn.disabled = false; btn.textContent = 'Se connecter';
                _showError('fbm-auth-error', _authError(e.code));
            }
        };

        overlay.querySelector('#fbm-signin').onclick = doSignIn;
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
  <div class="fbm-list-area" id="fbm-list-area">
    <div class="fbm-loading">Chargement…</div>
  </div>
  ${isSave ? `
  <div class="fbm-save-bar">
    <span class="fbm-save-title-label">Titre :</span>
    <input class="fbm-input fbm-save-title-input" id="fbm-save-title" type="text" placeholder="Nom de la présentation…">
    <input class="fbm-input" id="fbm-save-course" type="text" placeholder="Cours (ex: L1 Info, Algo…)" style="max-width:180px">
    <label class="fbm-save-public-label" title="Toute personne disposant du lien peut voir la présentation">
      <input type="checkbox" id="fbm-save-public"> Partage public
    </label>
    <button class="fbm-btn fbm-btn-primary" id="fbm-do-save">Sauvegarder</button>
  </div>` : ''}
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
        try {
            presentations = await window.OEIFirebase.listPresentations();
            _renderList(overlay, presentations, ctx);
        } catch (e) {
            overlay.querySelector('#fbm-list-area').innerHTML = `<div class="fbm-empty">Erreur : ${_esc(e.message)}</div>`;
        }

        // Pre-fill save title + course
        if (isSave) {
            const meta = ctx.currentData && ctx.currentData.metadata;
            overlay.querySelector('#fbm-save-title').value = meta?.title || '';
            overlay.querySelector('#fbm-save-course').value = meta?.course || '';

            overlay.querySelector('#fbm-do-save').onclick = async () => {
                const inputTitle  = overlay.querySelector('#fbm-save-title').value.trim();
                const inputCourse = overlay.querySelector('#fbm-save-course').value.trim();
                const isPublic    = overlay.querySelector('#fbm-save-public').checked;
                const dataToSave  = ctx.currentData || {};
                if (dataToSave.metadata) {
                    if (inputTitle)  dataToSave.metadata.title  = inputTitle;
                    if (inputCourse) dataToSave.metadata.course = inputCourse;
                }

                // Check if overwriting existing
                const existing = presentations.find(p => p.title === inputTitle);
                const existingId = existing ? existing.id : null;

                const btn = overlay.querySelector('#fbm-do-save');
                btn.disabled = true; btn.textContent = 'Sauvegarde…';
                try {
                    const id = await window.OEIFirebase.savePresentation(dataToSave, existingId || undefined, { public: isPublic, course: inputCourse });
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

    function _renderList(overlay, presentations, ctx) {
        const isSave = ctx.mode === 'save';
        const area   = overlay.querySelector('#fbm-list-area');

        if (presentations.length === 0) {
            area.innerHTML = '<div class="fbm-empty">Aucune présentation sauvegardée.</div>';
            return;
        }

        const html = presentations.map(p => `
<div class="fbm-pres-row" data-id="${_esc(p.id)}">
  <div class="fbm-pres-info">
    <span class="fbm-pres-title">${_esc(p.title)}</span>
    <span class="fbm-pres-date">${_fmt(p.modified)}</span>
  </div>
  <div class="fbm-pres-actions">
    ${!isSave ? `<button class="fbm-btn fbm-btn-primary fbm-btn-sm fbm-open-btn" data-id="${_esc(p.id)}">Ouvrir</button>` : `<button class="fbm-btn fbm-btn-secondary fbm-btn-sm fbm-overwrite-btn" data-id="${_esc(p.id)}" data-title="${_esc(p.title)}">Écraser</button>`}
    <button class="fbm-btn fbm-btn-danger fbm-btn-sm fbm-delete-btn" data-id="${_esc(p.id)}">&#x1F5D1;</button>
  </div>
</div>`).join('');
        area.innerHTML = html;

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
            'auth/user-not-found':             'Aucun compte avec cet email.',
            'auth/wrong-password':             'Mot de passe incorrect.',
            'auth/too-many-requests':          'Trop de tentatives. Réessayez plus tard.',
            'auth/invalid-email':              'Email invalide.',
            'auth/network-request-failed':     'Erreur réseau. Vérifiez votre connexion.',
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

    window.OEIFirebaseModal = { open };
})();
