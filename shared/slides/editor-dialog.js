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

    function _ensureStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.oed-overlay {
    position: fixed; inset: 0; z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    background: var(--ui-overlay, rgba(17,17,26,.45)); backdrop-filter: blur(4px);
    animation: oedFadeIn .12s ease;
}
@keyframes oedFadeIn { from { opacity:0 } to { opacity:1 } }
.oed-box {
    background: var(--surface-container-lowest, #fff);
    color: var(--on-surface, #1d1b21);
    border: 1px solid var(--outline-variant, #c5c5d3);
    border-radius: var(--radius-lg, 1rem); padding: 24px;
    width: min(900px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    display: flex; flex-direction: column;
    box-shadow: var(--shadow-overlay, 0 12px 32px rgba(17,17,26,.10));
    animation: oedSlideUp .15s ease;
}
@keyframes oedSlideUp { from { transform:translateY(8px); opacity:0 } to { transform:translateY(0); opacity:1 } }
.oed-title {
    font-family: var(--font-editorial, 'Manrope', sans-serif);
    font-size: 1rem; font-weight: 700;
    color: var(--on-surface, #1d1b21); margin: 0 0 12px;
}
.oed-body {
    font-size: .88rem; line-height: 1.6;
    color: var(--on-surface-variant, #444651); white-space: pre-wrap;
    overflow: auto;
    overflow-wrap: anywhere;
    max-height: min(64vh, calc(100vh - 220px));
}
.oed-actions {
    display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;
    flex-wrap: wrap;
}
.oed-btn {
    height: 32px; padding: 0 16px; border-radius: var(--radius-sm, .25rem);
    border: 1px solid var(--outline-variant, #c5c5d3);
    background: var(--surface-container-high, #e9e7ef); color: var(--on-surface-variant, #444651);
    font-size: .82rem; font-weight: 500; cursor: pointer;
    transition: background .15s, opacity .15s;
}
.oed-btn:hover { background: var(--surface-container-highest, #e3e1e9); color: var(--on-surface); }
.oed-btn:focus-visible { outline: 2px solid var(--focus-ring-color); outline-offset: 1px; }
.oed-btn.primary,
.oed-btn.ui-btn--primary {
    background: var(--primary, #1e3a8a); border-color: var(--primary, #1e3a8a); color: var(--on-primary, #fff);
}
.oed-btn.primary:hover,
.oed-btn.ui-btn--primary:hover { background: var(--primary-hover, #00236f); }
.oed-btn.danger,
.oed-btn.ui-btn--danger {
    background: var(--danger, #c62828); border-color: var(--danger, #c62828); color: #fff;
}
@media (max-width: 720px) {
    .oed-box {
        width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        padding: 16px;
    }
    .oed-body {
        max-height: min(70vh, calc(100vh - 180px));
    }
}
`;
        document.head.appendChild(s);
    }

    function _show({ title, body, buttons, focusLast = false }) {
        _ensureStyles();
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'oed-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="oed-box">
                    ${title ? `<div class="oed-title">${title}</div>` : ''}
                    <div class="oed-body">${body}</div>
                    <div class="oed-actions">
                        ${buttons.map((b, i) =>
                            `<button class="oed-btn ui-btn ${b.uiCls || ''} ${b.cls || ''}" data-idx="${i}">${b.label}</button>`
                        ).join('')}
                    </div>
                </div>
            `;

            const close = (value) => {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
                resolve(value);
            };

            overlay.querySelector('.oed-actions').addEventListener('click', e => {
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
