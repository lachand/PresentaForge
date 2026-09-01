/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-dialog
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-dialog.js"></script>
 */
/* editor-dialog.js — Async alert / confirm modals (remplace window.alert / window.confirm)
 * Autonome : injecte son propre CSS, fonctionne sur toute page.
 * Respecte [data-theme="light"|"dark"] si présent sur <html>.
 */

const OEIDialog = (() => {

    let _stylesInjected = false;

    /* Le dialog compose désormais la primitive .ui-modal (ui-primitives.css).
     * Ce bloc ne couvre que les spécificités alert/confirm : élévation z-index
     * au-dessus des autres modales, corps en texte pré-formaté, repli hors
     * contexte où ui-primitives.css n'est pas chargé (tests isolés). */
    function _ensureStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.oed-overlay.ui-modal-overlay { z-index: 99999; }
.oed-overlay .ui-modal { display: flex; flex-direction: column; }
.oed-body { white-space: pre-wrap; overflow-wrap: anywhere; }
`;
        document.head.appendChild(s);
    }

    function _show({ title, body, buttons, focusLast = false }) {
        _ensureStyles();
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'oed-overlay ui-modal-overlay is-open';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="ui-modal ui-modal--sm">
                    ${title ? `<div class="ui-modal-header"><h2 class="ui-modal-title">${title}</h2></div>` : ''}
                    <div class="ui-modal-body oed-body">${body}</div>
                    <div class="ui-modal-actions">
                        ${buttons.map((b, i) =>
                            `<button class="ui-btn ${b.uiCls || ''} ${b.cls || ''}" data-idx="${i}">${b.label}</button>`
                        ).join('')}
                    </div>
                </div>
            `;

            const close = (value) => {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
                resolve(value);
            };

            overlay.querySelector('.ui-modal-actions').addEventListener('click', e => {
                const btn = e.target.closest('[data-idx]');
                if (!btn) return;
                close(buttons[+btn.dataset.idx].value);
            });

            const onKey = e => {
                if (e.key === 'Escape') {
                    const cancelBtn = buttons.find(b => b.cancel);
                    close(cancelBtn ? cancelBtn.value : undefined);
                } else if (e.key === 'Enter') {
                    const defaultBtn = buttons.find(b => b.default);
                    if (defaultBtn) close(defaultBtn.value);
                }
            };
            document.addEventListener('keydown', onKey);

            document.body.appendChild(overlay);
            const btns = overlay.querySelectorAll('[data-idx]');
            (focusLast ? btns[btns.length - 1] : btns[0])?.focus();
        });
    }

    return {
        /**
         * Remplace alert(). Retourne une Promise<void>.
         * @param {string} message — HTML autorisé
         * @param {{ title?: string }} [opts]
         */
        alert(message, { title = '' } = {}) {
            return _show({
                title,
                body: message,
                buttons: [{ label: 'OK', value: undefined, cls: 'primary', uiCls: 'ui-btn--primary', default: true }],
                focusLast: true,
            });
        },

        /**
         * Remplace confirm(). Retourne une Promise<boolean>.
         * @param {string} message — HTML autorisé
         * @param {{ title?: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} [opts]
         */
        confirm(message, {
            title = '',
            confirmLabel = 'Confirmer',
            cancelLabel = 'Annuler',
            danger = false,
        } = {}) {
            return _show({
                title,
                body: message,
                buttons: [
                    { label: cancelLabel,  value: false, cancel: true  },
                    {
                        label: confirmLabel,
                        value: true,
                        default: true,
                        cls: danger ? 'danger' : 'primary',
                        uiCls: danger ? 'ui-btn--danger' : 'ui-btn--primary',
                    },
                ],
                focusLast: true,
            });
        },
    };
})();

window.OEIDialog = OEIDialog;
