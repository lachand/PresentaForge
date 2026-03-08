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
    background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
    animation: oedFadeIn .12s ease;
}
@keyframes oedFadeIn { from { opacity:0 } to { opacity:1 } }
.oed-box {
    background: var(--panel, #fff);
    color: var(--text, #1d1d1f);
    border: 1px solid var(--border, #e0e0e5);
    border-radius: 12px; padding: 24px;
    width: min(420px, 95vw);
    box-shadow: 0 24px 80px rgba(0,0,0,.25);
    animation: oedSlideUp .15s ease;
}
@keyframes oedSlideUp { from { transform:translateY(8px); opacity:0 } to { transform:translateY(0); opacity:1 } }
[data-theme="dark"] .oed-box {
    background: var(--panel, #1a1d27);
    color: var(--text, #cbd5e1);
    border-color: var(--border, #2d3347);
    box-shadow: 0 24px 80px rgba(0,0,0,.6);
}
.oed-title {
    font-size: .95rem; font-weight: 700;
    color: var(--heading, #1d1d1f); margin: 0 0 12px;
}
[data-theme="dark"] .oed-title { color: var(--heading, #f1f5f9); }
.oed-body {
    font-size: .88rem; line-height: 1.6;
    color: var(--text, #374151); white-space: pre-wrap;
}
[data-theme="dark"] .oed-body { color: var(--text, #cbd5e1); }
.oed-actions {
    display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;
}
.oed-btn {
    height: 32px; padding: 0 16px; border-radius: 6px;
    border: 1px solid var(--border, #e0e0e5);
    background: var(--card, #f0f0f2); color: var(--text, #1d1d1f);
    font-size: .82rem; font-weight: 500; cursor: pointer;
    transition: opacity .15s;
}
.oed-btn:hover { opacity: .8; }
[data-theme="dark"] .oed-btn {
    background: var(--card, #222635); color: var(--text, #cbd5e1);
    border-color: var(--border, #2d3347);
}
.oed-btn.primary {
    background: var(--primary, #6366f1); border-color: var(--primary, #6366f1); color: #fff;
}
.oed-btn.danger {
    background: var(--danger, #ef4444); border-color: var(--danger, #ef4444); color: #fff;
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
                            `<button class="oed-btn ${b.cls || ''}" data-idx="${i}">${b.label}</button>`
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
                buttons: [{ label: 'OK', value: undefined, cls: 'primary', default: true }],
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
                    { label: confirmLabel, value: true,  default: true, cls: danger ? 'danger' : 'primary' },
                ],
                focusLast: true,
            });
        },
    };
})();

window.OEIDialog = OEIDialog;
