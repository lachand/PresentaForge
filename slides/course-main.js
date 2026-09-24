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
            return `<li><a class="course-catalog-item" href="${esc(url)}">${badge}<span class="course-catalog-item-title">${esc(p.title)}</span></a></li>`;
        }).join('');
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
