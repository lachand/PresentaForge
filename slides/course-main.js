/**
 * @module slides/course-main
 * Lien persistant de cours (slides/course.html) — résout ?u=<uid>&c=<courseSlug> via
 * shared/slides/firebase-storage.js (getCurrentPresentationPointer, non authentifié) et
 * redirige vers viewer.html?firebase=<uid>/<id>. Pensé pour un lien collé une fois en
 * ressource Moodle : la cible peut changer (dernière présentation "Présentée" pour ce
 * cours) sans jamais avoir à retoucher le lien Moodle.
 */
(function () {
    'use strict';

    const statusEl = document.getElementById('course-status');
    const textEl = statusEl ? statusEl.querySelector('.course-status-text') : null;

    function showError(message) {
        if (!statusEl) return;
        statusEl.classList.add('course-status--error');
        if (textEl) textEl.textContent = message;
        const spinner = statusEl.querySelector('.course-spinner');
        if (spinner) spinner.remove();
    }

    async function run() {
        const params = new URLSearchParams(location.search);
        const uid = params.get('u') || '';
        const slug = params.get('c') || '';

        if (!uid || !slug) {
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
            const pointer = await fb.getCurrentPresentationPointer(uid, slug);
            if (!pointer || !pointer.id) {
                showError('Aucune présentation n’a encore été ouverte pour ce cours. Revenez un peu plus tard, ou contactez l’enseignant.');
                return;
            }
            location.replace('viewer.html?firebase=' + encodeURIComponent(uid) + '/' + encodeURIComponent(pointer.id));
        } catch (e) {
            showError('Erreur : ' + (e && e.message ? e.message : String(e)));
        }
    }

    run();
})();
