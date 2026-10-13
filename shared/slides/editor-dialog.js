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
.oed-prompt-label { display: block; margin-bottom: 8px; overflow-wrap: anywhere; }
.oed-prompt-input { width: 100%; box-sizing: border-box; }
.oed-prompt-input[aria-invalid="true"] { border-color: var(--danger, #c62828); }
.oed-prompt-error { min-height: 1.2em; margin-top: 6px; font-size: 0.8rem; color: var(--danger, #c62828); }
`;
        document.head.appendChild(s);
    }

    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    /**
     * Piège de focus d'une modale (audit UX 2026-10, T2) : Tab et Maj+Tab restent dans le
     * conteneur, Échap appelle `onEscape`, et le focus est **rendu à l'élément qui avait le
     * focus à l'ouverture** quand on libère. Réutilisable par toute modale de l'application.
     * @param {HTMLElement} container
     * @param {{ onEscape?: () => void }} [opts]
     * @returns {() => void} fonction de libération (retire l'écouteur, restaure le focus)
     */
    function trapFocus(container, { onEscape } = {}) {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const onKeydown = e => {
            if (e.key === 'Tab') {
                const items = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
                if (!items.length) { e.preventDefault(); return; }
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
            } else if (e.key === 'Escape' && typeof onEscape === 'function') {
                // Une seule modale réagit : celle qui est au-dessus ne laisse pas l'Échap aux autres.
                e.stopPropagation();
                onEscape();
            }
        };
        document.addEventListener('keydown', onKeydown, true);
        return () => {
            document.removeEventListener('keydown', onKeydown, true);
            if (previous && previous.isConnected) { try { previous.focus(); } catch (_) { /* ignoré */ } }
        };
    }

    let _dialogSeq = 0;

    function _show({ title, body, buttons, focusLast = false }) {
        _ensureStyles();
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'oed-overlay ui-modal-overlay is-open';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            const titleId = `oed-title-${++_dialogSeq}`;
            if (title) overlay.setAttribute('aria-labelledby', titleId);
            overlay.innerHTML = `
                <div class="ui-modal ui-modal--sm">
                    ${title ? `<div class="ui-modal-header"><h2 class="ui-modal-title" id="${titleId}">${title}</h2></div>` : ''}
                    <div class="ui-modal-body oed-body">${body}</div>
                    <div class="ui-modal-actions">
                        ${buttons.map((b, i) =>
                            `<button class="ui-btn ${b.uiCls || ''} ${b.cls || ''}" data-idx="${i}">${b.label}</button>`
                        ).join('')}
                    </div>
                </div>
            `;

            let release = () => {};
            const close = (value) => {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
                release();
                resolve(value);
            };

            overlay.querySelector('.ui-modal-actions').addEventListener('click', e => {
                const btn = e.target.closest('[data-idx]');
                if (!btn) return;
                close(buttons[+btn.dataset.idx].value);
            });

            const cancelBtn = buttons.find(b => b.cancel);
            const onKey = e => {
                // Entrée valide uniquement le bouton par défaut ; une action destructrice n'en a pas.
                // Quand le focus est sur un bouton, Entrée l'active nativement : on ne double pas.
                if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON') {
                    const defaultBtn = buttons.find(b => b.default);
                    if (defaultBtn) close(defaultBtn.value);
                }
            };
            document.addEventListener('keydown', onKey);
            release = trapFocus(overlay, { onEscape: () => close(cancelBtn ? cancelBtn.value : undefined) });

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
                        default: !danger,   // Entrée ne valide jamais une action destructrice
                        cls: danger ? 'danger' : 'primary',
                        uiCls: danger ? 'ui-btn--danger' : 'ui-btn--primary',
                    },
                ],
                focusLast: !danger,         // action destructrice : le focus part sur « Annuler »
            });
        },

        /**
         * Choix parmi plusieurs actions (ex. import : « Ajouter à la fin » / « Remplacer »).
         * Retourne une Promise de la `value` choisie, ou null si annulé (Échap / Annuler).
         * Le focus initial va sur le premier choix NON destructif.
         * @param {string} message — HTML autorisé
         * @param {{ title?: string, cancelLabel?: string,
         *   choices: Array<{ value: string, label: string, primary?: boolean, danger?: boolean }> }} opts
         */
        choose(message, { title = '', cancelLabel = 'Annuler', choices = [] } = {}) {
            return _show({
                title,
                body: message,
                buttons: [
                    { label: cancelLabel, value: null, cancel: true },
                    ...choices.map(c => ({
                        label: c.label,
                        value: c.value,
                        default: !!c.primary && !c.danger,
                        uiCls: c.danger ? 'ui-btn--danger' : (c.primary ? 'ui-btn--primary' : ''),
                    })),
                ],
                focusLast: false,
            });
        },

        /**
         * Sélection dans une liste existante, avec option "nouveau" en texte libre.
         * Remplace un prompt() texte libre (typos/doublons non détectés) par un menu
         * déroulant des valeurs déjà connues. Retourne une Promise<string|null>
         * (null si annulé, chaîne vide si "emptyLabel" choisi).
         * @param {{
         *   title?: string, message?: string, options: string[], value?: string,
         *   emptyLabel?: string, newLabel?: string, newPlaceholder?: string,
         * }} opts
         */
        selectOrCreate({
            title = '',
            message = '',
            options = [],
            value = '',
            emptyLabel = '— Aucun —',
            newLabel = '+ Nouveau…',
            newPlaceholder = '',
        } = {}) {
            _ensureStyles();
            const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const NEW_VALUE = '__oed_new__';
            const hasValueInOptions = value !== '' && options.includes(value);
            const isCustomValue = value !== '' && !hasValueInOptions;
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'oed-overlay ui-modal-overlay is-open';
                overlay.setAttribute('role', 'dialog');
                overlay.setAttribute('aria-modal', 'true');
                const selTitleId = `oed-title-${++_dialogSeq}`;
                if (title) overlay.setAttribute('aria-labelledby', selTitleId);
                overlay.innerHTML = `
                    <div class="ui-modal ui-modal--sm">
                        ${title ? `<div class="ui-modal-header"><h2 class="ui-modal-title" id="${selTitleId}">${esc(title)}</h2></div>` : ''}
                        <div class="ui-modal-body oed-body">
                            ${message ? `<p>${esc(message)}</p>` : ''}
                            <select class="ui-select oed-select">
                                <option value=""${!value ? ' selected' : ''}>${esc(emptyLabel)}</option>
                                ${options.map(o => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}
                                <option value="${String(NEW_VALUE)}"${isCustomValue ? ' selected' : ''}>${esc(newLabel)}</option>
                            </select>
                            <input type="text" class="ui-input oed-new-input" placeholder="${esc(newPlaceholder)}"
                                style="margin-top:8px;${isCustomValue ? '' : 'display:none;'}" value="${String(isCustomValue ? esc(value) : '')}">
                        </div>
                        <div class="ui-modal-actions">
                            <button class="ui-btn" data-idx="0">Annuler</button>
                            <button class="ui-btn ui-btn--primary" data-idx="1">Valider</button>
                        </div>
                    </div>
                `;
                const selectEl = /** @type {HTMLSelectElement} */ (overlay.querySelector('.oed-select'));
                const newInput = /** @type {HTMLInputElement} */ (overlay.querySelector('.oed-new-input'));
                selectEl.addEventListener('change', () => {
                    const isNew = selectEl.value === NEW_VALUE;
                    newInput.style.display = isNew ? '' : 'none';
                    if (isNew) newInput.focus();
                });

                const readValue = () => (selectEl.value === NEW_VALUE ? newInput.value.trim() : selectEl.value);
                let release = () => {};
                const close = val => {
                    overlay.remove();
                    document.removeEventListener('keydown', onKey);
                    release();
                    resolve(val);
                };
                overlay.querySelector('.ui-modal-actions').addEventListener('click', e => {
                    const btn = e.target.closest('[data-idx]');
                    if (!btn) return;
                    close(btn.dataset.idx === '1' ? readValue() : null);
                });
                const onKey = e => {
                    if (e.key === 'Enter' && e.target?.tagName !== 'BUTTON') close(readValue());
                };
                document.addEventListener('keydown', onKey);
                release = trapFocus(overlay, { onEscape: () => close(null) });

                document.body.appendChild(overlay);
                (isCustomValue ? newInput : selectEl).focus();
            });
        },

        /**
         * Remplace prompt() (audit UX 2026-10, T1) : saisie d'une ligne de texte dans une
         * vraie boîte de dialogue (thème, focus piégé, Échap, Entrée). Retourne une
         * Promise<string|null> : le texte saisi (non vide), ou `null` si annulé.
         * @param {string} message — texte brut (échappé)
         * @param {{ title?: string, value?: string, placeholder?: string, confirmLabel?: string,
         *   cancelLabel?: string, allowEmpty?: boolean, validate?: (v: string) => string }} [opts]
         *   `validate` renvoie un message d'erreur (chaîne non vide) ou '' si la valeur est valide.
         */
        prompt(message, { title = '', value = '', placeholder = '', confirmLabel = 'Valider', cancelLabel = 'Annuler', allowEmpty = false, validate } = {}) {
            _ensureStyles();
            const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            return new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.className = 'oed-overlay ui-modal-overlay is-open';
                overlay.setAttribute('role', 'dialog');
                overlay.setAttribute('aria-modal', 'true');
                const pid = ++_dialogSeq;
                const msgId = `oed-msg-${pid}`;
                if (title) overlay.setAttribute('aria-labelledby', `oed-title-${pid}`);
                overlay.innerHTML = `
                    <div class="ui-modal ui-modal--sm">
                        ${title ? `<div class="ui-modal-header"><h2 class="ui-modal-title" id="oed-title-${pid}">${esc(title)}</h2></div>` : ''}
                        <div class="ui-modal-body">
                            <label class="oed-prompt-label" id="${msgId}" for="oed-input-${pid}">${esc(message)}</label>
                            <input type="text" id="oed-input-${pid}" class="ui-input oed-prompt-input" placeholder="${esc(placeholder)}" value="${esc(value)}" aria-describedby="oed-err-${pid}" autocomplete="off" spellcheck="false">
                            <div class="oed-prompt-error" id="oed-err-${pid}" role="alert"></div>
                        </div>
                        <div class="ui-modal-actions">
                            <button class="ui-btn" type="button" data-idx="0">${esc(cancelLabel)}</button>
                            <button class="ui-btn ui-btn--primary" type="button" data-idx="1">${esc(confirmLabel)}</button>
                        </div>
                    </div>`;
                const input = /** @type {HTMLInputElement} */ (overlay.querySelector('.oed-prompt-input'));
                const errEl = overlay.querySelector('.oed-prompt-error');
                let release = () => {};
                const close = val => { overlay.remove(); release(); resolve(val); };
                const submit = () => {
                    const v = input.value.trim();
                    if (!v && !allowEmpty) { errEl.textContent = 'Saisissez une valeur.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
                    const problem = typeof validate === 'function' ? validate(v) : '';
                    if (problem) { errEl.textContent = problem; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
                    close(v);
                };
                overlay.querySelector('.ui-modal-actions').addEventListener('click', e => {
                    const btn = e.target.closest('[data-idx]');
                    if (!btn) return;
                    if (btn.dataset.idx === '1') submit(); else close(null);
                });
                input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
                release = trapFocus(overlay, { onEscape: () => close(null) });
                document.body.appendChild(overlay);
                input.focus();
                input.select();
            });
        },

        trapFocus,
    };
})();

window.OEIDialog = OEIDialog;
