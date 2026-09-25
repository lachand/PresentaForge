/**
 * @module slides/course-main
 * Catalogue de cours (slides/course.html) — résout ?u=<uid>&course=<nom exact, encodé> via
 * shared/slides/firebase-storage.js (listPublicPresentationsForCourse, non authentifié) et
 * affiche la liste des présentations de ce cours marquées "visible des étudiants". Lien
 * Moodle stable : coller une fois, l'enseignant choisit ensuite quels decks apparaissent
 * (badge 👁 Public / 🔒 Privé sur le tableau de bord) sans jamais retoucher le lien.
 */
(function () {
    'use strict';

    const statusEl = document.getElementById('course-status');
    const catalogEl = document.getElementById('course-catalog');
    const titleEl = document.getElementById('course-catalog-title');
    const listEl = document.getElementById('course-catalog-list');

    function esc(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showError(message) {
        if (!statusEl) return;
        statusEl.classList.add('course-status--error');
        const textEl = statusEl.querySelector('.course-status-text');
        if (textEl) textEl.textContent = message;
        const spinner = statusEl.querySelector('.course-spinner');
        if (spinner) spinner.remove();
    }

    function buildCatalogListHtml(presentations, uid) {
        if (!presentations.length) {
            return '<li class="course-catalog-empty">Aucune présentation disponible pour l’instant. Revenez plus tard, ou contactez l’enseignant.</li>';
        }
        return presentations.map(p => {
            const url = 'viewer.html?firebase=' + encodeURIComponent(uid) + '/' + encodeURIComponent(p.id);
            const badge = p.seance != null ? `<span class="course-catalog-badge">Séance ${esc(p.seance)}</span>` : '';
            // Les boutons d'action sont des frères de l'<a>, jamais imbriqués dedans (un
            // <button> dans un <a> est invalide en HTML et casse le focus clavier).
            return `<li class="course-catalog-row">
                <a class="course-catalog-item" href="${esc(url)}">${badge}<span class="course-catalog-item-title">${esc(p.title)}</span></a>
                <div class="course-catalog-actions">
                    <button type="button" class="course-catalog-action" data-action="download-json" data-uid="${esc(uid)}" data-id="${esc(p.id)}">📥 JSON de révision</button>
                    <button type="button" class="course-catalog-action" data-action="export-pdf" data-uid="${esc(uid)}" data-id="${esc(p.id)}">📄 PDF</button>
                    <span class="course-catalog-action-status" aria-live="polite"></span>
                </div>
            </li>`;
        }).join('');
    }

    function setRowStatus(li, message, isError) {
        const el = li && li.querySelector('.course-catalog-action-status');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('course-catalog-action-status--error', !!isError);
    }

    function setRowBusy(li, busy) {
        if (!li) return;
        li.querySelectorAll('.course-catalog-action').forEach(btn => { btn.disabled = busy; });
    }

    /**
     * Télécharge un JSON de révision "vierge" (favoris/notes/progression vides) pour ce
     * deck — importable tel quel via le bouton "Importer une révision" de student.html,
     * sans que l'élève ait besoin d'avoir déjà assisté à une séance live sur ce cours.
     */
    async function handleDownloadJson(li, uid, id) {
        if (!window.OEIStudentStorage || !window.OEIFirebase) {
            setRowStatus(li, 'Module de révision indisponible.', true);
            return;
        }
        setRowBusy(li, true);
        setRowStatus(li, 'Préparation…', false);
        try {
            const deck = await window.OEIFirebase.loadPublicPresentation(uid, id);
            const bundle = window.OEIStudentStorage.buildBlankReviseBundle(deck, {
                title: deck && deck.metadata && deck.metadata.title,
                author: deck && deck.metadata && deck.metadata.author,
            });
            const fileName = `revision-${window.OEIStudentStorage.slugify(bundle.course.title || 'cours') || 'cours'}.json`;
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            setRowStatus(li, 'Téléchargé ✓', false);
        } catch (e) {
            setRowStatus(li, 'Erreur : ' + (e && e.message ? e.message : String(e)), true);
        } finally {
            setRowBusy(li, false);
        }
    }

    /**
     * Imprime ce deck EN PLACE (shared/slides/print-export.js) — aucune fenêtre/onglet
     * ouvert, aucun risque de blocage pop-up, et surtout : jamais editor.html (2026-09-24,
     * la première version rouvrait tout l'éditeur avant de pouvoir imprimer, beaucoup trop
     * lourd/perceptible pour un étudiant qui veut juste un PDF depuis ce catalogue). Charge
     * le deck via l'API publique déjà utilisée par le bouton JSON (loadPublicPresentation,
     * aucune authentification requise).
     */
    async function handleExportPdf(li, uid, id) {
        if (!window.OEIFirebase || !window.OEIPrintExport) {
            setRowStatus(li, 'Module d’impression indisponible.', true);
            return;
        }
        setRowBusy(li, true);
        setRowStatus(li, 'Préparation de l’impression…', false);
        try {
            const deck = await window.OEIFirebase.loadPublicPresentation(uid, id);
            await window.OEIPrintExport.printDeckInPlace(deck);
            setRowStatus(li, '', false);
        } catch (e) {
            setRowStatus(li, 'Erreur : ' + (e && e.message ? e.message : String(e)), true);
        } finally {
            setRowBusy(li, false);
        }
    }

    if (listEl) {
        // Délégation d'événement (jamais d'attribut onclick inline — audit sécurité
        // tools/security/inline-expression-audit.mjs) : un seul listener, valable même
        // après que renderCatalog() ait remplacé listEl.innerHTML.
        listEl.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const li = btn.closest('li');
            const uid = btn.dataset.uid;
            const id = btn.dataset.id;
            if (!uid || !id || !li) return;
            if (btn.dataset.action === 'download-json') handleDownloadJson(li, uid, id);
            else if (btn.dataset.action === 'export-pdf') handleExportPdf(li, uid, id);
        });
    }

    function renderCatalog(course, presentations, uid) {
        if (statusEl) statusEl.hidden = true;
        if (titleEl) titleEl.textContent = course;
        if (listEl) listEl.innerHTML = buildCatalogListHtml(presentations, uid);
        if (catalogEl) catalogEl.hidden = false;
    }

    async function run() {
        const params = new URLSearchParams(location.search);
        const uid = params.get('u') || '';
        const course = params.get('course') || '';

        if (!uid || !course) {
            showError('Lien incomplet : ce lien de cours est mal formé (paramètres manquants).');
            return;
        }

        const fb = window.OEIFirebase;
        if (!fb) {
            showError('Firebase indisponible. Réessayez dans quelques instants.');
            return;
        }

        try {
            await fb.ready();
            const presentations = await fb.listPublicPresentationsForCourse(uid, course);
            renderCatalog(course, presentations, uid);
        } catch (e) {
            showError('Erreur : ' + (e && e.message ? e.message : String(e)));
        }
    }

    run();
})();
