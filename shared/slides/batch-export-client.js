/**
 * @module slides/batch-export-client
 * @public
 * @internal Module Slides chargé côté navigateur.
 */
/* batch-export-client.js — client générique pour déclencher un export (PDF/HTML offline/
 * PPTX) d'une présentation via une iframe cachée same-origin chargeant
 * editor.html?batchExport=<format>&batchToken=<token>(&...urlParams), qui renvoie le
 * résultat par postMessage('oei-batch-export-result'). Extrait de bulk-actions-modal.js
 * (export groupé depuis slides/index.html) pour être réutilisé aussi par
 * slides/course-main.js (bouton export PDF par deck sur le catalogue public d'un cours,
 * ?firebasePublic=<uid>/<id> au lieu de ?firebase=<id>) — un seul endroit à auditer pour
 * la vérification postMessage/origin plutôt que deux implémentations parallèles.
 *
 * Chargé AVANT bulk-actions-modal.js (index.html) et course-main.js (course.html).
 */
(function () {
    'use strict';

    const EXPORT_MESSAGE_TYPE = 'oei-batch-export-result';
    const DEFAULT_TIMEOUT_MS = 120000;

    /**
     * Lance un export dans une iframe cachée pointant `editor.html` en mode batch, et
     * résout avec le résultat reçu par postMessage — jamais de téléchargement déclenché
     * ici (voir `downloadBlobDirect`). Dimensionnée (jamais display:none/0×0) car certains
     * calculs de mise à l'échelle de l'éditeur divisent par les dimensions du cadre.
     * @param {{urlParams: Record<string,string>, format: 'pdf'|'html-offline'|'pptx', timeoutMs?: number}} opts
     *   `urlParams` : paramètres d'identification du deck à fusionner dans l'URL de
     *   l'iframe (ex. `{firebase: id}` pour un deck propriétaire, `{firebasePublic: uid+'/'+id}`
     *   pour un deck public) — jamais `batchExport`/`batchToken`, réservés à cette fonction.
     * @returns {Promise<{ok: true, blob: Blob, fileName: string} | {ok: false, error: string}>}
     */
    function exportOneDeckViaIframe({ urlParams = {}, format, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
        return new Promise(resolve => {
            const token = 'bx-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:800px;border:0;';
            let done = false;
            const cleanup = () => {
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                if (iframe.parentNode) iframe.remove();
            };
            const finish = (result) => {
                if (done) return;
                done = true;
                cleanup();
                resolve(result);
            };
            const timer = setTimeout(() => finish({ ok: false, error: 'Délai dépassé' }), timeoutMs);
            function onMessage(e) {
                if (e.origin !== location.origin) return;
                if (e.source !== iframe.contentWindow) return;
                const data = e.data;
                if (!data || data.type !== EXPORT_MESSAGE_TYPE || data.token !== token) return;
                if (data.ok) finish({ ok: true, blob: data.blob, fileName: data.fileName });
                else finish({ ok: false, error: data.error || 'Erreur inconnue' });
            }
            window.addEventListener('message', onMessage);
            const qs = new URLSearchParams({ ...urlParams, batchExport: format, batchToken: token });
            iframe.src = `editor.html?${qs.toString()}`;
            document.body.appendChild(iframe);
        });
    }

    /** Déclenche le téléchargement direct d'un Blob (résultat d'un export). */
    function downloadBlobDirect(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    window.OEIBatchExportClient = Object.freeze({
        EXPORT_MESSAGE_TYPE,
        DEFAULT_TIMEOUT_MS,
        exportOneDeckViaIframe,
        downloadBlobDirect,
    });
})();
