/**
 * @module slides/multi-import-modal
 * @public
 * @internal Module Slides chargé côté navigateur.
 */
/* multi-import-modal.js — import de plusieurs decks JSON en une fois, regroupés sous un même
 * "cours" Firebase avec un numéro de séance par deck pour les ordonner correctement dans la
 * galerie (slides/index.html, bouton "Importer plusieurs decks…" de la section « Mes
 * présentations Firebase »). Chaque fichier a déjà été lu et passé par
 * window.OEIImportPipeline.importFromText (même pipeline que l'import mono-fichier de
 * index-main.js#onOpenFile) avant d'arriver ici — ce module ne fait que la revue (cours +
 * séance par fichier) et délègue la sauvegarde via `onImportOne`. Même famille de module que
 * bulk-actions-modal.js (mêmes classes ui-modal / ui-btn / bulk-actions-* de ui-primitives.css).
 */
(function () {
    'use strict';

    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const OVERLAY_ID = 'oei-multi-import-overlay';

    function _close() {
        const el = document.getElementById(OVERLAY_ID);
        if (el) el.remove();
    }

    /** Tri "naturel" sur le nom de fichier (td2 < td10) : des decks nommés td1, td2, …, td9,
     * td10 dans un tri alphabétique pur se retrouveraient dans le désordre (td1, td10, td2, …).
     * Fonction pure, exposée pour test. */
    function naturalFileCompare(a, b) {
        const re = /(\d+)|(\D+)/g;
        const aParts = String(a || '').match(re) || [];
        const bParts = String(b || '').match(re) || [];
        const len = Math.max(aParts.length, bParts.length);
        for (let i = 0; i < len; i++) {
            const ap = aParts[i] || '';
            const bp = bParts[i] || '';
            const an = Number(ap);
            const bn = Number(bp);
            if (ap !== '' && bp !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
                if (an !== bn) return an - bn;
            } else if (ap !== bp) {
                return ap < bp ? -1 : 1;
            }
        }
        return 0;
    }

    /** Numéros de séance par défaut pour `count` fichiers importés dans `course` : repart du
     * séance maximum déjà utilisé par ce cours (+1) si `course` existe déjà parmi
     * `existingDecks`, sinon 1..count. Fonction pure, exposée pour test. */
    function computeDefaultSeances(course, count, existingDecks = []) {
        const trimmed = String(course || '').trim();
        const base = existingDecks
            .filter(d => (d.course || '') === trimmed)
            .reduce((max, d) => (Number.isFinite(d.seance) && d.seance > max ? d.seance : max), 0);
        return Array.from({ length: count }, (_, i) => base + i + 1);
    }

    /**
     * @param {{
     *   items: Array<{fileName: string, ok: boolean, data?: object, error?: string, report?: {fixes?:Array,warnings?:Array}}>,
     *   knownCourses?: string[],
     *   existingDecks?: Array<{course?: string, seance?: number|null}>,
     *   defaultCourse?: string,
     *   onImportOne: (data: object, course: string, seance: number|null) => Promise<void>,
     *   onDone?: (result: {succeeded: string[], failed: Array<{fileName:string, error:string}>, course: string}) => void,
     * }} opts
     */
    function open(opts = {}) {
        _close();
        const items = (Array.isArray(opts.items) ? opts.items.slice() : [])
            .sort((a, b) => naturalFileCompare(a.fileName, b.fileName));
        if (!items.length) return;
        const knownCourses = Array.isArray(opts.knownCourses) ? opts.knownCourses : [];
        const existingDecks = Array.isArray(opts.existingDecks) ? opts.existingDecks : [];
        const validCount = items.filter(it => it.ok).length;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'ui-modal-overlay is-open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="ui-modal ui-modal--wide">
                <div class="ui-modal-header">
                    <span class="ui-modal-title">Importer ${String(items.length)} deck${items.length > 1 ? 's' : ''} dans un cours</span>
                    <button class="ui-modal-close" id="mim-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ui-modal-body bulk-actions-body">
                    <div class="bulk-actions-field">
                        <label for="mim-course">Cours</label>
                        <input type="text" id="mim-course" class="ui-input" list="mim-course-list" placeholder="ex: L1 Info, Algo S1" value="${_esc(opts.defaultCourse || '')}">
                        <datalist id="mim-course-list">${knownCourses.map(c => `<option value="${_esc(c)}">`).join('')}</datalist>
                    </div>
                    <div class="multi-import-list" id="mim-list"></div>
                    <div class="bulk-actions-status" id="mim-status"></div>
                </div>
                <div class="ui-modal-actions">
                    <button class="ui-btn" id="mim-cancel">Annuler</button>
                    <button class="ui-btn ui-btn--primary" id="mim-confirm">Importer${validCount ? ` (${String(validCount)})` : ''}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const listEl = overlay.querySelector('#mim-list');
        const courseInput = overlay.querySelector('#mim-course');
        const statusEl = overlay.querySelector('#mim-status');
        const confirmBtn = overlay.querySelector('#mim-confirm');
        if (!validCount) confirmBtn.disabled = true;

        const renderList = () => {
            const seances = computeDefaultSeances(courseInput.value, validCount, existingDecks);
            let vi = 0;
            listEl.innerHTML = items.map((it, idx) => {
                if (!it.ok) {
                    return `<div class="multi-import-row multi-import-row--error">
                        <span class="multi-import-file">${_esc(it.fileName)}</span>
                        <span class="multi-import-error">${_esc(it.error || 'Fichier invalide')}</span>
                    </div>`;
                }
                const seance = seances[vi++];
                const title = _esc(it.data?.metadata?.title || it.fileName);
                const fixCount = it.report?.fixes?.length || 0;
                const warnCount = it.report?.warnings?.length || 0;
                const hint = (fixCount || warnCount)
                    ? `<span class="multi-import-hint">${fixCount} correction(s), ${warnCount} avertissement(s)</span>` : '';
                return `<div class="multi-import-row" data-idx="${idx}">
                    <div class="multi-import-row-main">
                        <span class="multi-import-title">${title}</span>
                        <span class="multi-import-file">${_esc(it.fileName)}</span>
                        ${hint}
                    </div>
                    <label class="multi-import-seance-label">Séance
                        <input type="number" min="1" step="1" class="ui-input multi-import-seance" data-idx="${idx}" value="${seance}">
                    </label>
                </div>`;
            }).join('');
        };
        renderList();
        courseInput.addEventListener('input', renderList);

        overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
        overlay.querySelector('#mim-close').onclick = _close;
        overlay.querySelector('#mim-cancel').onclick = _close;

        confirmBtn.onclick = async () => {
            const course = courseInput.value.trim();
            confirmBtn.disabled = true;
            courseInput.disabled = true;
            const succeeded = [];
            const failed = [];
            let done = 0;
            // Séquentiel (pas Promise.all) : retour de progression lisible et pas de rafale
            // d'écritures Firestore (chaque savePresentation peut découper le deck en fragments).
            for (let idx = 0; idx < items.length; idx++) {
                const it = items[idx];
                if (!it.ok) continue;
                done++;
                statusEl.textContent = `Import ${done}/${validCount}…`;
                const seanceInput = listEl.querySelector(`.multi-import-seance[data-idx="${idx}"]`);
                const seanceRaw = Math.round(Number(seanceInput?.value));
                const seance = Number.isFinite(seanceRaw) && seanceRaw >= 1 ? seanceRaw : null;
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await opts.onImportOne(it.data, course, seance);
                    succeeded.push(it.fileName);
                } catch (e) {
                    failed.push({ fileName: it.fileName, error: String((e && e.message) || e) });
                }
            }
            statusEl.textContent = `Terminé : ${succeeded.length} importé(s)${failed.length ? `, ${failed.length} échec(s)` : ''}.`;
            _close();
            if (typeof opts.onDone === 'function') opts.onDone({ succeeded, failed, course });
        };
    }

    window.OEIMultiImportModal = Object.freeze({ open });

    window.__multiImportTestUtils = {
        naturalFileCompare,
        computeDefaultSeances,
    };
})();
