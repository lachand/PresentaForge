/**
 * @module slides/bulk-actions-modal
 * @public
 * @internal Module Slides chargé côté navigateur.
 */
/* bulk-actions-modal.js — édition groupée de métadonnées (cours/niveau/tags) et export groupé
 * (HTML offline / PDF / PPTX, zippé si 2+ présentations) pour plusieurs présentations Firebase
 * sélectionnées depuis la page d'accueil (slides/index.html, section « Mes présentations
 * Firebase »). Chargé uniquement sur index.html, juste après banner-picker.js (même famille de
 * petit module modal réutilisable, mêmes classes ui-modal / ui-btn de ui-primitives.css).
 *
 * L'export groupé ne réimplémente PAS le pipeline d'export (exportPDF/exportHTMLOffline/
 * exportPPTX vivent dans shared/slides/editor-export*.js et dépendent de tout le graphe de
 * dépendances d'editor.html, notamment CanvasEditor.WIDGET_REGISTRY pour le rendu des slides à
 * widgets) : chaque présentation est exportée via shared/slides/batch-export-client.js
 * (iframe cachée same-origin editor.html?firebase=<id>&batchExport=<format>, résultat par
 * postMessage — module chargé AVANT ce fichier, partagé avec course-main.js).
 */
(function () {
    'use strict';

    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Édition groupée ──────────────────────────────────────────────────

    const EDIT_OVERLAY_ID = 'oei-bulk-edit-overlay';

    function _closeEdit() {
        const el = document.getElementById(EDIT_OVERLAY_ID);
        if (el) el.remove();
    }

    // Champs à remplacement simple "seulement si renseigné" (par opposition à tags, qui
    // s'ajoute, et à course/level déjà gérés à part pour la clarté du diff historique).
    const _SIMPLE_REPLACE_FIELDS = ['course', 'level', 'author', 'email', 'institution'];

    /**
     * Construit, pour UNE présentation, le patch à envoyer à updatePresentationMeta à partir
     * des valeurs saisies dans le formulaire groupé. Cours/niveau/auteur/email/institution :
     * remplacement SEULEMENT si le champ est renseigné (un champ vide dans le formulaire ne
     * touche pas la présentation). Tags : AJOUT/UNION avec les tags déjà présents sur CETTE
     * présentation (jamais un remplacement global — des présentations aux tags différents ne
     * doivent pas perdre les leurs). Fonction pure, exposée pour test (voir
     * __bulkActionsTestUtils en bas de fichier).
     * @param {{tags?: string[]}} deck
     * @param {{course?: string, level?: string, author?: string, email?: string, institution?: string, tags?: string}} values
     */
    function buildBulkEditPatch(deck, values = {}) {
        const patch = {};
        for (const field of _SIMPLE_REPLACE_FIELDS) {
            const value = String(values[field] || '').trim();
            if (value !== '') patch[field] = value;
        }
        const tagsInput = String(values.tags || '').trim();
        if (tagsInput !== '') {
            const added = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
            patch.tags = [...new Set([...(deck?.tags || []), ...added])];
        }
        return patch;
    }

    /**
     * @param {{
     *   items: Array<{id: string, title?: string, tags?: string[]}>,
     *   knownCourses?: string[],
     *   onDone?: (result: {succeeded: Array<{id:string,patch:object}>, failed: Array<{id:string,title:string,error:string}>}) => void,
     * }} opts
     */
    function openEdit(opts = {}) {
        _closeEdit();
        const items = Array.isArray(opts.items) ? opts.items : [];
        if (!items.length) return;
        const knownCourses = Array.isArray(opts.knownCourses) ? opts.knownCourses : [];
        const n = items.length;

        const overlay = document.createElement('div');
        overlay.id = EDIT_OVERLAY_ID;
        overlay.className = 'ui-modal-overlay is-open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="ui-modal ui-modal--sm">
                <div class="ui-modal-header">
                    <span class="ui-modal-title">Éditer ${n} présentation${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}</span>
                    <button class="ui-modal-close" id="bulk-edit-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ui-modal-body bulk-actions-body">
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-course">Cours <span class="bulk-actions-hint">(remplace si renseigné)</span></label>
                        <input type="text" id="bulk-edit-course" class="ui-input" list="bulk-edit-course-list" placeholder="Laisser vide pour ne pas changer">
                        <datalist id="bulk-edit-course-list">${knownCourses.map(c => `<option value="${_esc(c)}">`).join('')}</datalist>
                    </div>
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-level">Niveau <span class="bulk-actions-hint">(remplace si renseigné)</span></label>
                        <input type="text" id="bulk-edit-level" class="ui-input" placeholder="Laisser vide pour ne pas changer">
                    </div>
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-tags">Tags</label>
                        <input type="text" id="bulk-edit-tags" class="ui-input" placeholder="ex: TD, révision">
                        <p class="bulk-actions-note">Ces tags seront <strong>ajoutés</strong> aux tags existants de chaque présentation — pas de remplacement.</p>
                    </div>
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-author">Auteur <span class="bulk-actions-hint">(remplace si renseigné)</span></label>
                        <input type="text" id="bulk-edit-author" class="ui-input" placeholder="Laisser vide pour ne pas changer">
                    </div>
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-email">Email <span class="bulk-actions-hint">(remplace si renseigné)</span></label>
                        <input type="email" id="bulk-edit-email" class="ui-input" placeholder="Laisser vide pour ne pas changer">
                    </div>
                    <div class="bulk-actions-field">
                        <label for="bulk-edit-institution">Institution <span class="bulk-actions-hint">(remplace si renseigné)</span></label>
                        <input type="text" id="bulk-edit-institution" class="ui-input" placeholder="Laisser vide pour ne pas changer">
                    </div>
                    <div class="bulk-actions-status" id="bulk-edit-status"></div>
                </div>
                <div class="ui-modal-actions">
                    <button class="ui-btn" id="bulk-edit-cancel">Annuler</button>
                    <button class="ui-btn ui-btn--primary" id="bulk-edit-save">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const courseInput = overlay.querySelector('#bulk-edit-course');
        const levelInput = overlay.querySelector('#bulk-edit-level');
        const tagsInput = overlay.querySelector('#bulk-edit-tags');
        const authorInput = overlay.querySelector('#bulk-edit-author');
        const emailInput = overlay.querySelector('#bulk-edit-email');
        const institutionInput = overlay.querySelector('#bulk-edit-institution');
        const statusEl = overlay.querySelector('#bulk-edit-status');
        const saveBtn = overlay.querySelector('#bulk-edit-save');

        overlay.addEventListener('click', e => { if (e.target === overlay) _closeEdit(); });
        overlay.querySelector('#bulk-edit-close').onclick = _closeEdit;
        overlay.querySelector('#bulk-edit-cancel').onclick = _closeEdit;

        saveBtn.onclick = async () => {
            const fb = window.OEIFirebase;
            if (!fb || typeof fb.updatePresentationMeta !== 'function') {
                statusEl.textContent = 'Firebase indisponible.';
                return;
            }
            const values = {
                course: courseInput.value, level: levelInput.value, tags: tagsInput.value,
                author: authorInput.value, email: emailInput.value, institution: institutionInput.value,
            };
            if (Object.values(values).every(v => !v.trim())) {
                statusEl.textContent = 'Renseignez au moins un champ.';
                return;
            }
            saveBtn.disabled = true;
            statusEl.textContent = 'Enregistrement…';
            const results = await Promise.allSettled(items.map(async deck => {
                const patch = buildBulkEditPatch(deck, values);
                if (Object.keys(patch).length) await fb.updatePresentationMeta(deck.id, patch);
                return { id: deck.id, patch };
            }));
            const succeeded = [];
            const failed = [];
            results.forEach((r, i) => {
                if (r.status === 'fulfilled') succeeded.push(r.value);
                else failed.push({ id: items[i].id, title: items[i].title || items[i].id, error: String((r.reason && r.reason.message) || r.reason) });
            });
            _closeEdit();
            if (typeof opts.onDone === 'function') opts.onDone({ succeeded, failed });
        };
    }

    // ── Export groupé ─────────────────────────────────────────────────────

    const EXPORT_OVERLAY_ID = 'oei-bulk-export-overlay';
    const EXPORT_CONCURRENCY = 3;
    const EXPORT_TIMEOUT_MS = 120000;
    const EXPORT_FORMATS = [
        { value: 'html-offline', label: 'HTML autonome (offline)' },
        { value: 'pdf', label: 'PDF' },
        { value: 'pptx', label: 'PowerPoint (PPTX)' },
    ];

    function _closeExport() {
        const el = document.getElementById(EXPORT_OVERLAY_ID);
        if (el) el.remove();
    }

    /** Pool de concurrence générique : exécute `worker` sur chaque item, au plus `concurrency`
     * en parallèle, sans jamais laisser l'échec d'un item interrompre les autres. Exposé pour
     * test avec un worker factice (pas de vrais iframes/postMessage nécessaires). */
    function runPool(items, concurrency, worker) {
        const results = new Array(items.length);
        let next = 0;
        async function runOne() {
            while (next < items.length) {
                const i = next++;
                try {
                    results[i] = await worker(items[i], i);
                } catch (err) {
                    results[i] = { ok: false, error: String((err && err.message) || err) };
                }
            }
        }
        const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, runOne);
        return Promise.all(workers).then(() => results);
    }

    /** Exporte un deck PROPRIÉTAIRE (?firebase=<id>, authentifié) via le client partagé,
     * en réattachant `deck` au résultat (le pool de concurrence ci-dessous et le nommage
     * du zip en ont besoin, non porté par le client générique). */
    async function exportOneDeckViaIframe(deck, format, { timeoutMs = EXPORT_TIMEOUT_MS, onProgress } = {}) {
        const res = await window.OEIBatchExportClient.exportOneDeckViaIframe({
            urlParams: { firebase: deck.id },
            format,
            timeoutMs,
            onProgress,
        });
        return { ...res, deck };
    }

    async function _ensureJSZipLoaded() {
        if (window.JSZip) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '../vendor/jszip/3.10.1/jszip.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Impossible de charger JSZip'));
            document.head.appendChild(s);
        });
    }

    /**
     * @param {{items: Array<{id: string, title?: string}>}} opts
     */
    function openExport(opts = {}) {
        _closeExport();
        const items = Array.isArray(opts.items) ? opts.items : [];
        if (!items.length) return;
        const n = items.length;

        const overlay = document.createElement('div');
        overlay.id = EXPORT_OVERLAY_ID;
        overlay.className = 'ui-modal-overlay is-open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="ui-modal ui-modal--sm">
                <div class="ui-modal-header">
                    <span class="ui-modal-title">Exporter ${n} présentation${n > 1 ? 's' : ''}</span>
                    <button class="ui-modal-close" id="bulk-export-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ui-modal-body bulk-actions-body" id="bulk-export-body">
                    <div class="bulk-actions-field">
                        <label>Format</label>
                        <div class="bulk-export-format-list">
                            ${EXPORT_FORMATS.map((f, i) => `
                                <label class="bulk-export-format-opt">
                                    <input type="radio" name="bulk-export-format" value="${f.value}" ${i === 0 ? 'checked' : ''}>
                                    ${_esc(f.label)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="ui-modal-actions">
                    <button class="ui-btn" id="bulk-export-cancel">Annuler</button>
                    <button class="ui-btn ui-btn--primary" id="bulk-export-start">Exporter</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', e => { if (e.target === overlay) _closeExport(); });
        overlay.querySelector('#bulk-export-close').onclick = _closeExport;
        overlay.querySelector('#bulk-export-cancel').onclick = _closeExport;

        overlay.querySelector('#bulk-export-start').onclick = async () => {
            const formatInput = overlay.querySelector('input[name="bulk-export-format"]:checked');
            const format = formatInput ? formatInput.value : EXPORT_FORMATS[0].value;
            const body = overlay.querySelector('#bulk-export-body');
            const actions = overlay.querySelector('.ui-modal-actions');
            if (actions) actions.style.display = 'none';

            const rows = items.map(it => ({ id: it.id, title: it.title || it.id }));
            body.innerHTML = `
                <div class="bulk-export-progress" id="bulk-export-progress">0 / ${n}</div>
                <ul class="bulk-export-rows" id="bulk-export-rows">
                    ${rows.map(r => `<li class="bulk-export-row" data-row-id="${_esc(r.id)}"><span class="bulk-export-row-title">${_esc(r.title)}</span><span class="bulk-export-row-status">…</span></li>`).join('')}
                </ul>
            `;
            const progressEl = body.querySelector('#bulk-export-progress');
            const rowsEl = body.querySelector('#bulk-export-rows');
            let completed = 0;

            const results = await runPool(items, EXPORT_CONCURRENCY, async (deck) => {
                const rowEl = rowsEl && rowsEl.querySelector(`[data-row-id="${CSS && CSS.escape ? CSS.escape(deck.id) : deck.id}"]`);
                const statusEl = rowEl && rowEl.querySelector('.bulk-export-row-status');
                // Deck long (80-90 slides, PDF) : sans ce retour, la ligne reste bloquée sur
                // '…' pendant plusieurs minutes sans distinction entre "ça avance" et "c'est
                // planté" — le timeout d'inactivité de batch-export-client.js en dépend aussi.
                const res = await exportOneDeckViaIframe(deck, format, {
                    onProgress: (current, total) => { if (statusEl) statusEl.textContent = `${current}/${total}`; },
                });
                completed += 1;
                if (progressEl) progressEl.textContent = `${completed} / ${n}`;
                if (rowEl) {
                    if (res.ok) { rowEl.classList.add('ok'); if (statusEl) statusEl.textContent = '✓'; }
                    else { rowEl.classList.add('err'); if (statusEl) statusEl.textContent = '✗ ' + res.error; }
                }
                return res;
            });

            const succeeded = results.filter(r => r.ok);
            const failed = results.filter(r => !r.ok);

            if (succeeded.length === 1 && failed.length === 0) {
                window.OEIBatchExportClient.downloadBlobDirect(succeeded[0].blob, succeeded[0].fileName);
            } else if (succeeded.length) {
                try {
                    await _ensureJSZipLoaded();
                    const zip = new window.JSZip();
                    const usedNames = new Set();
                    succeeded.forEach(r => {
                        let name = r.fileName || `export-${r.deck.id}`;
                        if (usedNames.has(name)) {
                            const dot = name.lastIndexOf('.');
                            const suffix = r.deck.id.slice(0, 6);
                            name = dot > 0 ? `${name.slice(0, dot)}-${suffix}${name.slice(dot)}` : `${name}-${suffix}`;
                        }
                        usedNames.add(name);
                        zip.file(name, r.blob);
                    });
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    window.OEIBatchExportClient.downloadBlobDirect(zipBlob, `export_presentaforge_${new Date().toISOString().slice(0, 10)}.zip`);
                } catch (err) {
                    if (progressEl) progressEl.textContent = 'Erreur lors de la création du zip : ' + String((err && err.message) || err);
                }
            }

            if (progressEl) {
                progressEl.textContent = failed.length
                    ? `${succeeded.length}/${n} exportée${succeeded.length > 1 ? 's' : ''}, ${failed.length} échec${failed.length > 1 ? 's' : ''}`
                    : `${succeeded.length}/${n} exportée${succeeded.length > 1 ? 's' : ''}`;
            }
            if (actions) {
                actions.style.display = '';
                actions.innerHTML = '<button class="ui-btn ui-btn--primary" id="bulk-export-done">Fermer</button>';
                const doneBtn = actions.querySelector('#bulk-export-done');
                if (doneBtn) doneBtn.onclick = _closeExport;
            }
        };
    }

    window.OEIBulkEditModal = { open: openEdit };
    window.OEIBulkExportModal = { open: openExport };

    // Exposé pour test uniquement — logique pure (patch d'édition groupée, pool de concurrence)
    // testable sans DOM/iframe/postMessage réels, même esprit que testUtils de firebase-modal.js
    // et window.__firebaseGroupingTestUtils de slides/index-main.js.
    window.__bulkActionsTestUtils = { buildBulkEditPatch, runPool };
})();
