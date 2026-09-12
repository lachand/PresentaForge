// @ts-check
/* slides-canvas-inline-edit-runtime.js — runtime édition inline pour CanvasEditor */
(function initSlidesCanvasInlineEditRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasInlineEditRuntime) return;

    /**
     * Démarre l'édition inline d'un élément texte/heading avec toolbar rich text.
     * @param {{ editor: object, resolveElementFontSize: function, editableToPlainText: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     * @param {MouseEvent|null} [dblClickEvent]
     */
    const startInlineEdit = (ctx, div, el, dblClickEvent = null) => {
        const editor = ctx?.editor;
        const resolveElementFontSize = ctx?.resolveElementFontSize;
        const editableToPlainText = ctx?.editableToPlainText;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const base = resolveElementFontSize(el.type, s, editor.typography, 22);
        const editable = document.createElement('div');
        editable.contentEditable = 'true';
        editable.className = 'cel-text-content cel-inline-edit';
        editable.style.fontSize = `${base}px`;
        editable.style.fontWeight = String(s.fontWeight || 400);
        editable.style.color = s.color || 'var(--sl-text)';
        editable.style.textAlign = s.textAlign || 'left';
        editable.style.fontFamily = s.fontFamily || 'var(--sl-font-body)';
        editable.style.lineHeight = String(s.lineHeight || 1.35);
        if (s.fontStyle) editable.style.fontStyle = s.fontStyle;
        else editable.style.removeProperty('font-style');
        if (s.textTransform) editable.style.textTransform = s.textTransform;
        else editable.style.removeProperty('text-transform');
        if (s.letterSpacing) editable.style.letterSpacing = s.letterSpacing;
        else editable.style.removeProperty('letter-spacing');
        if (s.opacity != null) editable.style.opacity = String(s.opacity);
        else editable.style.removeProperty('opacity');
        // Use rich HTML if available, otherwise plain text
        if (el.data?.html) {
            editable.innerHTML = el.data.html;
        } else {
            editable.textContent = el.data?.text || '';
        }
        inner.innerHTML = '';
        inner.appendChild(editable);

        // ── Rich text formatting toolbar ──
        const toolbar = document.createElement('div');
        toolbar.className = 'cel-rich-toolbar';
        toolbar.innerHTML = `
            <button class="cel-rich-btn" data-cmd="bold" title="Gras (Ctrl+B)"><b>B</b></button>
            <button class="cel-rich-btn" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
            <button class="cel-rich-btn" data-cmd="underline" title="Souligné (Ctrl+U)"><u>U</u></button>
            <button class="cel-rich-btn" data-cmd="strikethrough" title="Barré"><s>S</s></button>
            <button class="cel-rich-btn" data-cmd="code" title="Code inline"><span style="font-family:monospace;font-size:11px">&lt;/&gt;</span></button>
            <span style="width:1px;height:18px;background:var(--border,#2d3347);margin:0 2px;"></span>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#818cf8" title="Couleur accent" style="color:#818cf8;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#f59e0b" title="Couleur jaune" style="color:#f59e0b;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#ef4444" title="Couleur rouge" style="color:#ef4444;">A</button>
            <button class="cel-rich-btn" data-cmd="foreColor" data-value="#22c55e" title="Couleur vert" style="color:#22c55e;">A</button>
            <span style="width:1px;height:18px;background:var(--border,#2d3347);margin:0 2px;"></span>
            <button class="cel-rich-btn" data-cmd="createLink" title="Insérer un lien"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L14 19"/></svg></button>
            <button class="cel-rich-btn" data-cmd="removeFormat" title="Effacer mise en forme">✕</button>
        `;
        toolbar.addEventListener('mousedown', e => {
            e.preventDefault(); // Don't steal focus from editable
            e.stopPropagation();
            const btn = e.target.closest('.cel-rich-btn');
            if (!btn) return;
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.value || null;
            if (cmd === 'code') {
                // Toggle <code> wrapping around selection
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                const parentCode = sel.anchorNode?.parentElement?.closest('code');
                if (parentCode) {
                    // Unwrap: replace <code> with its text content
                    const text = document.createTextNode(parentCode.textContent);
                    parentCode.replaceWith(text);
                    sel.removeAllRanges();
                    const r = document.createRange();
                    r.selectNodeContents(text);
                    sel.addRange(r);
                } else if (!range.collapsed) {
                    // Wrap selection in <code>
                    const code = document.createElement('code');
                    code.className = 'cel-inline-code';
                    range.surroundContents(code);
                }
            } else if (cmd === 'createLink') {
                const sel = window.getSelection();
                if (!sel.rangeCount || sel.isCollapsed) return;
                const url = prompt('URL du lien :', 'https://');
                if (url) document.execCommand('createLink', false, url);
            } else {
                document.execCommand(cmd, false, val);
            }
            updateToolbarState();
        });
        div.appendChild(toolbar);

        const updateToolbarState = () => {
            toolbar.querySelectorAll('.cel-rich-btn[data-cmd]').forEach(btn => {
                const cmd = btn.dataset.cmd;
                if (['bold','italic','underline','strikethrough'].includes(cmd)) {
                    btn.classList.toggle('active', document.queryCommandState(cmd));
                }
                if (cmd === 'code') {
                    const sel = window.getSelection();
                    const inCode = sel.anchorNode?.parentElement?.closest('code');
                    btn.classList.toggle('active', !!inCode);
                }
                if (cmd === 'createLink') {
                    const sel = window.getSelection();
                    const inLink = sel.anchorNode?.parentElement?.closest('a');
                    btn.classList.toggle('active', !!inLink);
                }
            });
        };

        editable.addEventListener('input', updateToolbarState);
        editable.addEventListener('mouseup', updateToolbarState);
        editable.addEventListener('keyup', updateToolbarState);

        editable.focus();
        // Position caret at the double-click point (after layout via rAF)
        if (dblClickEvent) {
            requestAnimationFrame(() => {
                const x = dblClickEvent.clientX, y = dblClickEvent.clientY;
                let range;
                if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(x, y);
                } else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(x, y);
                    if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); }
                }
                if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); }
                updateToolbarState();
            });
        }

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            committed = true;
            div.classList.remove('editing');
            toolbar.remove();
            const rawHtml = editable.innerHTML;
            // Extract text from contentEditable while preserving tabs + line breaks.
            const plainText = editableToPlainText(editable);
            // Store both html (rich) and text (plain fallback)
            const dataUpdate = { text: plainText };
            // Keep html only when real rich formatting is present.
            // Plain line wrappers (<div>/<br>) are discarded so text auto-formatting
            // can transform "- item" + tabulations into bullet rows at render time.
            const hasRichFormatting = /<(?:b|strong|i|em|u|s|strike|code|a|span|font|mark|sub|sup|ul|ol|li|blockquote|h[1-6])\b/i.test(rawHtml);
            if (hasRichFormatting) {
                dataUpdate.html = rawHtml;
            } else {
                dataUpdate.html = ''; // clear previous rich formatting
            }
            editor.updateData(el.id, { data: dataUpdate });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            toolbar.remove();
            editor._refreshDOM(el.id);
        };

        editable.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertText', false, '\t');
            }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); editable.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            e.stopPropagation(); // prevent editor keyboard shortcuts
        });

        editable.addEventListener('blur', e => {
            // Don't commit if clicking on the toolbar
            if (toolbar.contains(e.relatedTarget)) return;
            commit();
        });
    };

    /**
     * Calcule et applique à l'identique sur le <pre> surligné et le textarea la taille de
     * police/interligne réellement utilisées par le rendu statique de cet élément (même
     * formule que slides-renderer-canvas.js) — sans ça, le calage au pixel près de
     * mountLiveHighlight casse dès que la taille de base diffère du 13px codé en dur en CSS
     * (élément redimensionné, thème/typographie personnalisés…) : le curseur et la
     * sélection natifs du textarea ne tombent alors plus sur les bons caractères affichés.
     *
     * `screenScale` (= editor.scale, le zoom du canvas) : le portail d'édition (voir
     * mountCodeEditPortal) rend le code HORS du canvas zoomé, en pixels écran réels — un
     * <textarea> natif ne s'aligne pas de façon fiable avec un <pre> normal une fois sous
     * `transform: scale()` (confirmé par capture d'écran : dérive de couleur/position dès
     * que le canvas n'est pas à 100%). On compense donc ici en pixels réels plutôt que de
     * compter sur l'ancêtre transformé pour visuellement remettre à l'échelle.
     * @param {{ resolveElementFontSize?: function, computeCodeMetrics?: function }} ctx
     * @param {object} el
     * @param {HTMLElement} pre
     * @param {HTMLElement} textarea
     * @param {object} typography
     * @param {number} [screenScale=1]
     */
    const applyCodeFontMetrics = (ctx, el, pre, textarea, typography, screenScale = 1) => {
        const resolveElementFontSize = ctx?.resolveElementFontSize;
        const computeCodeMetrics = ctx?.computeCodeMetrics;
        const scale = Number.isFinite(screenScale) && screenScale > 0 ? screenScale : 1;
        const base = typeof resolveElementFontSize === 'function'
            ? resolveElementFontSize(el.type, el.style || {}, typography, 16)
            : 16;
        const metrics = typeof computeCodeMetrics === 'function'
            ? computeCodeMetrics(base)
            : { codeSize: Math.round(base * 0.82), codeLineHeight: 1.58 };
        pre.style.fontSize = textarea.style.fontSize = `${metrics.codeSize * scale}px`;
        pre.style.lineHeight = textarea.style.lineHeight = String(metrics.codeLineHeight);
        // 0.75rem/1rem (padding CSS d'origine) exprimés en px réels à l'échelle du portail.
        pre.style.padding = textarea.style.padding = `${12 * scale}px ${16 * scale}px`;
    };

    /**
     * Monte un portail d'édition hors de la hiérarchie zoomée du canvas (appendu à
     * document.body, position:fixed calée en pixels écran via getBoundingClientRect) : le
     * <textarea>/<select> y rendent nativement, sans passer sous le transform:scale() du
     * canvas — seul moyen fiable d'éviter la dérive pixel entre le <pre> surligné et le
     * curseur/la sélection natifs du textarea à un zoom canvas différent de 100 %.
     * @param {HTMLElement} anchorDiv - le .cel dont le portail doit occuper l'emplacement écran.
     * @returns {{ portal: HTMLElement, destroy: function }}
     */
    const mountCodeEditPortal = anchorDiv => {
        const portal = document.createElement('div');
        portal.className = 'cel-code-edit-portal';
        document.body.appendChild(portal);

        const reposition = () => {
            const rect = anchorDiv.getBoundingClientRect();
            portal.style.left = `${rect.left}px`;
            portal.style.top = `${rect.top}px`;
            portal.style.width = `${rect.width}px`;
            portal.style.height = `${rect.height}px`;
        };
        reposition();

        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);

        const destroy = () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
            portal.remove();
        };

        return { portal, destroy };
    };

    /**
     * Démarre l'édition inline d'un élément code : textarea transparent superposé à un
     * <pre> surligné hljs (mountLiveHighlight), remis à jour à chaque frappe.
     * @param {{ editor: object, mountLiveHighlight?: function, resolveElementFontSize?: function, computeCodeMetrics?: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditCode = (ctx, div, el) => {
        const editor = ctx?.editor;
        const mountLiveHighlight = ctx?.mountLiveHighlight;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');
        inner.innerHTML = '';

        const { portal, destroy: destroyPortal } = mountCodeEditPortal(div);

        const lang = el.data?.language || 'text';
        const wrap = document.createElement('div');
        wrap.className = 'cel-code-edit-wrap';

        const pre = document.createElement('pre');
        pre.className = 'cel-code-edit-highlight';
        pre.setAttribute('aria-hidden', 'true');
        const codeEl = document.createElement('code');
        pre.appendChild(codeEl);

        const textarea = document.createElement('textarea');
        textarea.className = 'cel-code-edit';
        textarea.value = el.data?.code || '';
        textarea.spellcheck = false;
        applyCodeFontMetrics(ctx, el, pre, textarea, editor.typography, editor.scale);

        wrap.appendChild(pre);
        wrap.appendChild(textarea);
        portal.appendChild(wrap);
        textarea.focus();

        const renderHighlight = typeof mountLiveHighlight === 'function'
            ? mountLiveHighlight({ textarea, pre, codeEl, getLanguage: () => lang })
            : null;

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            committed = true;
            div.classList.remove('editing');
            destroyPortal();
            editor.updateData(el.id, { data: { code: textarea.value } });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            destroyPortal();
            editor._refreshDOM(el.id);
        };

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart, end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                renderHighlight?.();
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); textarea.blur(); }
            e.stopPropagation();
        });

        textarea.addEventListener('blur', commit);
    };

    // Langages proposés — doit rester aligné avec le <select id="sp-hl-lang"> du panneau
    // de propriétés (editor-props-panel.js, case 'highlight').
    const HIGHLIGHT_LANGUAGES = [
        ['python', 'Python'],
        ['javascript', 'JavaScript'],
        ['java', 'Java'],
        ['c', 'C'],
        ['bash', 'Bash / Terminal'],
        ['html', 'HTML'],
        ['css', 'CSS'],
        ['sql', 'SQL'],
        ['yaml', 'YAML'],
        ['json', 'JSON'],
        ['text', 'Texte'],
    ];

    /**
     * Démarre l'édition inline d'un élément code surligné ("highlight") : code + langage,
     * textarea transparent superposé à un <pre> surligné hljs (mountLiveHighlight).
     * Les zones surlignées restent gérées dans le panneau de propriétés (trop complexe pour un overlay inline).
     * @param {{ editor: object, mountLiveHighlight?: function, resolveElementFontSize?: function, computeCodeMetrics?: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditHighlight = (ctx, div, el) => {
        const editor = ctx?.editor;
        const mountLiveHighlight = ctx?.mountLiveHighlight;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');
        inner.innerHTML = '';

        const { portal, destroy: destroyPortal } = mountCodeEditPortal(div);
        const scale = Number.isFinite(editor.scale) && editor.scale > 0 ? editor.scale : 1;

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-highlight-edit-wrap';

        const select = document.createElement('select');
        select.className = 'cel-hl-lang-select';
        select.style.fontSize = `${11 * scale}px`;
        select.style.padding = `${5.6 * scale}px ${12 * scale}px`;
        const currentLang = el.data?.language || 'python';
        HIGHLIGHT_LANGUAGES.forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (value === currentLang) opt.selected = true;
            select.appendChild(opt);
        });

        const codeWrap = document.createElement('div');
        codeWrap.className = 'cel-code-edit-wrap';

        const pre = document.createElement('pre');
        pre.className = 'cel-code-edit-highlight';
        pre.setAttribute('aria-hidden', 'true');
        const codeEl = document.createElement('code');
        pre.appendChild(codeEl);

        const textarea = document.createElement('textarea');
        textarea.className = 'cel-code-edit';
        textarea.value = el.data?.code || '';
        textarea.spellcheck = false;
        applyCodeFontMetrics(ctx, el, pre, textarea, editor.typography, scale);

        codeWrap.appendChild(pre);
        codeWrap.appendChild(textarea);
        wrapper.appendChild(select);
        wrapper.appendChild(codeWrap);
        portal.appendChild(wrapper);
        textarea.focus();

        const renderHighlight = typeof mountLiveHighlight === 'function'
            ? mountLiveHighlight({ textarea, pre, codeEl, getLanguage: () => select.value })
            : null;
        select.addEventListener('change', () => renderHighlight?.());

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                destroyPortal();
                editor.updateData(el.id, { data: { code: textarea.value, language: select.value } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            destroyPortal();
            editor._refreshDOM(el.id);
        };

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart, end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                renderHighlight?.();
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); textarea.blur(); }
            e.stopPropagation();
        });
        select.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            e.stopPropagation();
        });

        textarea.addEventListener('blur', commit);
        select.addEventListener('blur', commit);
    };

    /**
     * Construit un ensemble de champs "label + valeur" contentEditable, empilés
     * verticalement (cœur commun à définition/quote/callout-box/latex/... — voir
     * startInlineEditDefinition pour le cas d'origine à 3 champs). Ne gère ni le
     * commit ni le revert : l'appelant attache ses propres listeners `blur` sur les
     * `editables` retournés et route `onEscape` vers son propre revert, pour rester
     * libre de combiner plusieurs sous-éditeurs (ex. startInlineEditCard combine ceci
     * avec mountFlatItemsEditor sous un commit unique).
     * @param {{key: string, label: string|null, value: string, cls?: string}[]} fields
     * @param {() => void} onEscape
     * @returns {{ container: HTMLElement, editables: HTMLElement[] }}
     */
    const mountLabeledFieldsEditor = (fields, onEscape) => {
        const container = document.createElement('div');
        container.className = 'cel-def-content';
        container.style.cursor = 'text';

        const editables = [];
        fields.forEach(({ key, label, cls, value }) => {
            const row = document.createElement('div');
            row.style.marginBottom = '0.35rem';
            if (label) {
                const lbl = document.createElement('span');
                lbl.textContent = label + ' : ';
                lbl.className = 'cel-def-inline-label';
                row.appendChild(lbl);
            }
            const field = document.createElement('span');
            field.contentEditable = 'true';
            field.className = cls ? `${cls} cel-def-edit-field` : 'cel-def-edit-field';
            field.textContent = value;
            field.dataset.key = key;
            row.appendChild(field);
            container.appendChild(row);
            editables.push(field);
        });

        editables.forEach((field, i) => {
            field.addEventListener('keydown', e => {
                if (e.key === 'Tab' && editables.length > 1) {
                    e.preventDefault();
                    const next = editables[(i + (e.shiftKey ? editables.length - 1 : 1)) % editables.length];
                    next.focus();
                    const range = document.createRange();
                    range.selectNodeContents(next);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                if (e.key === 'Escape') { e.preventDefault(); onEscape(); }
                e.stopPropagation();
            });
        });

        return { container, editables };
    };

    /**
     * Construit une liste plate d'items contentEditable — Enter ajoute un item après
     * le courant, Backspace sur item vide fusionne avec le précédent, Escape délègue
     * à `onEscape`. Volontairement SANS sous-items/Tab-indent (voir startInlineEditList
     * pour cette variante) : card/smartart attendent un tableau de strings plates.
     * Ne gère pas le commit : chaque item text appelle `onBlur` à son blur, à
     * l'appelant de committer via `readItems()` (avec sa propre porte
     * requestAnimationFrame + contains(activeElement), potentiellement partagée avec
     * un autre sous-éditeur — voir startInlineEditCard).
     * @param {string[]} items
     * @param {{ onBlur: () => void, onEscape: () => void }} handlers
     * @returns {{ ul: HTMLElement, readItems: () => string[], focusFirst: () => void }}
     */
    const mountFlatItemsEditor = (items, { onBlur, onEscape }) => {
        const ul = document.createElement('ul');
        ul.className = 'cel-list-content';

        const focusEnd = textEl => {
            textEl.focus();
            const range = document.createRange();
            range.selectNodeContents(textEl);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        };

        const makeLi = (text = '') => {
            const li = document.createElement('li');
            const textEl = document.createElement('div');
            textEl.className = 'cel-li-text';
            textEl.contentEditable = 'true';
            textEl.textContent = text;
            textEl.addEventListener('blur', onBlur);
            li.appendChild(textEl);
            return li;
        };

        ul.addEventListener('keydown', e => {
            const textEl = e.target.closest('.cel-li-text');
            const li = e.target.closest('li');
            if (!textEl || !li) return;
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newLi = makeLi('');
                li.after(newLi);
                newLi.querySelector('.cel-li-text').focus();
                return;
            }
            if (e.key === 'Backspace' && textEl.textContent === '') {
                e.preventDefault();
                const prev = li.previousElementSibling;
                li.remove();
                if (prev) focusEnd(prev.querySelector('.cel-li-text'));
                return;
            }
            if (e.key === 'Escape') { e.preventDefault(); onEscape(); }
        });

        (items.length ? items : ['']).forEach(text => ul.appendChild(makeLi(typeof text === 'string' ? text : '')));

        return {
            ul,
            readItems: () => Array.from(ul.querySelectorAll(':scope > li > .cel-li-text')).map(t => t.textContent).filter(t => t !== ''),
            focusFirst: () => ul.querySelector('.cel-li-text')?.focus(),
        };
    };

    /**
     * Démarre l'édition inline d'un élément définition (terme / définition / exemple).
     * @param {{ editor: object }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditDefinition = (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        let committed = false;
        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        const { container, editables } = mountLabeledFieldsEditor([
            { key: 'term',       label: 'Terme',      cls: 'cel-def-term',    value: el.data?.term       || '' },
            { key: 'definition', label: 'Définition',  cls: 'cel-def-body',    value: el.data?.definition || '' },
            { key: 'example',    label: String(el.data?.exampleLabel || 'Exemple'), cls: 'cel-def-example', value: el.data?.example || '' },
        ], revert);

        inner.innerHTML = '';
        inner.appendChild(container);
        editables[0].focus();

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (container.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const patch = {};
                editables.forEach(f => { patch[f.dataset.key] = f.textContent; });
                editor.updateData(el.id, { data: patch });
            });
        };

        editables.forEach(field => field.addEventListener('blur', commit));
    };

    /**
     * Fabrique une fonction startInlineEditXxx pour un élément à champs texte simples
     * indépendants (pas d'interaction entre champs, pas de sous-éditeur combiné) —
     * factorise le commit/revert commun à quote/callout-box/latex/audience-roulette/
     * timer-label/prompt-field, qui ne diffèrent que par la liste de champs édités.
     * @param {(el: object) => {key: string, label: string|null, value: string}[]} getFields
     * @returns {(ctx: object, div: HTMLElement, el: object) => void}
     */
    const makeSimpleFieldsInlineEditor = getFields => (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        let committed = false;
        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        const { container, editables } = mountLabeledFieldsEditor(getFields(el), revert);

        inner.innerHTML = '';
        inner.appendChild(container);
        editables[0].focus();

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (container.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const patch = {};
                editables.forEach(f => { patch[f.dataset.key] = f.textContent; });
                editor.updateData(el.id, { data: patch });
            });
        };

        editables.forEach(field => field.addEventListener('blur', commit));
    };

    /** Démarre l'édition inline d'un élément citation (texte + auteur). */
    const startInlineEditQuote = makeSimpleFieldsInlineEditor(el => [
        { key: 'text', label: 'Citation', value: el.data?.text || '' },
        { key: 'author', label: 'Auteur', value: el.data?.author || '' },
    ]);

    /** Démarre l'édition inline d'un encadré callout-box (label + message). La teinte (tone) reste au panneau. */
    const startInlineEditCalloutBox = makeSimpleFieldsInlineEditor(el => [
        { key: 'label', label: 'Label', value: el.data?.label || '' },
        { key: 'text', label: 'Message', value: el.data?.text || '' },
    ]);

    /** Démarre l'édition inline d'un élément LaTeX (expression seule). */
    const startInlineEditLatex = makeSimpleFieldsInlineEditor(el => [
        { key: 'expression', label: 'Expression', value: el.data?.expression || '' },
    ]);

    /** Démarre l'édition inline d'un élément roulette (titre seul). */
    const startInlineEditAudienceRoulette = makeSimpleFieldsInlineEditor(el => [
        { key: 'title', label: 'Titre', value: el.data?.title || '' },
    ]);

    /** Démarre l'édition inline du label d'un minuteur — ne touche jamais data.duration (reste au panneau). */
    const startInlineEditTimerLabel = makeSimpleFieldsInlineEditor(el => [
        { key: 'label', label: 'Label', value: el.data?.label || '' },
    ]);

    /**
     * Démarre l'édition inline de la consigne (data.prompt) partagée par poll-likert,
     * debate-mode et postit-wall — un seul champ, sans label affiché (le contenu de
     * l'élément EST la consigne, un préfixe "Prompt :" serait redondant).
     */
    const startInlineEditPromptField = makeSimpleFieldsInlineEditor(el => [
        { key: 'prompt', label: null, value: el.data?.prompt || '' },
    ]);

    /**
     * Démarre l'édition inline d'une carte (card) : titre + items plats (pas de
     * sous-items). Combine mountLabeledFieldsEditor (titre) et mountFlatItemsEditor
     * (items) sous un commit unique, porté par le wrapper englobant les deux.
     * @param {{ editor: object }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditCard = (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-card-edit-wrap';

        let committed = false;
        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };
        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const items = list.readItems();
                editor.updateData(el.id, { data: { title: titleField.textContent, items: items.length ? items : [''] } });
            });
        };

        const { container: titleContainer, editables: [titleField] } = mountLabeledFieldsEditor(
            [{ key: 'title', label: 'Titre', value: el.data?.title || '' }], revert,
        );
        titleField.addEventListener('blur', commit);

        const list = mountFlatItemsEditor(el.data?.items || [''], { onBlur: commit, onEscape: revert });

        wrapper.appendChild(titleContainer);
        wrapper.appendChild(list.ul);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
        titleField.focus();
    };

    /**
     * Démarre l'édition inline d'un smartart : items plats seuls (pas de titre, pas
     * de sous-items). data.variant (layout) reste géré par le panneau de propriétés.
     * @param {{ editor: object }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditSmartArt = (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        let committed = false;
        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };
        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (list.ul.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const items = list.readItems();
                editor.updateData(el.id, { data: { items: items.length ? items : [''] } });
            });
        };

        const list = mountFlatItemsEditor(el.data?.items || [''], { onBlur: commit, onEscape: revert });

        inner.innerHTML = '';
        inner.appendChild(list.ul);
        list.focusFirst();
    };

    // Langages proposés pour terminal-session — doit rester aligné avec le
    // <select id="sp-term-lang"> du panneau de propriétés (editor-props-panel.js,
    // case 'terminal-session'). Volontairement distincte de HIGHLIGHT_LANGUAGES
    // (moins de langages, "Bash" au lieu de "Bash / Terminal").
    const TERMINAL_SESSION_LANGUAGES = [
        ['bash', 'Bash'],
        ['python', 'Python'],
        ['javascript', 'JavaScript'],
        ['yaml', 'YAML'],
        ['text', 'Texte'],
    ];

    /**
     * Démarre l'édition inline d'une session terminal : script + langage, calquée sur
     * startInlineEditHighlight (même moteur hljs via SlidesShared.codeTerminal côté
     * rendu statique → portail requis, cf. mountCodeEditPortal), sans zones surlignées.
     * @param {{ editor: object, mountLiveHighlight?: function, resolveElementFontSize?: function, computeCodeMetrics?: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditTerminalSession = (ctx, div, el) => {
        const editor = ctx?.editor;
        const mountLiveHighlight = ctx?.mountLiveHighlight;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');
        inner.innerHTML = '';

        const { portal, destroy: destroyPortal } = mountCodeEditPortal(div);
        const scale = Number.isFinite(editor.scale) && editor.scale > 0 ? editor.scale : 1;

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-highlight-edit-wrap';

        const select = document.createElement('select');
        select.className = 'cel-hl-lang-select';
        select.style.fontSize = `${11 * scale}px`;
        select.style.padding = `${5.6 * scale}px ${12 * scale}px`;
        const currentLang = el.data?.language || 'bash';
        TERMINAL_SESSION_LANGUAGES.forEach(([value, label]) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (value === currentLang) opt.selected = true;
            select.appendChild(opt);
        });

        const codeWrap = document.createElement('div');
        codeWrap.className = 'cel-code-edit-wrap';

        const pre = document.createElement('pre');
        pre.className = 'cel-code-edit-highlight';
        pre.setAttribute('aria-hidden', 'true');
        const codeEl = document.createElement('code');
        pre.appendChild(codeEl);

        const textarea = document.createElement('textarea');
        textarea.className = 'cel-code-edit';
        textarea.value = el.data?.script || '';
        textarea.spellcheck = false;
        applyCodeFontMetrics(ctx, el, pre, textarea, editor.typography, scale);

        codeWrap.appendChild(pre);
        codeWrap.appendChild(textarea);
        wrapper.appendChild(select);
        wrapper.appendChild(codeWrap);
        portal.appendChild(wrapper);
        textarea.focus();

        const renderHighlight = typeof mountLiveHighlight === 'function'
            ? mountLiveHighlight({ textarea, pre, codeEl, getLanguage: () => select.value })
            : null;
        select.addEventListener('change', () => renderHighlight?.());

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                destroyPortal();
                editor.updateData(el.id, { data: { script: textarea.value, language: select.value } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            destroyPortal();
            editor._refreshDOM(el.id);
        };

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart, end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
                renderHighlight?.();
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); textarea.blur(); }
            e.stopPropagation();
        });
        select.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            e.stopPropagation();
        });

        textarea.addEventListener('blur', commit);
        select.addEventListener('blur', commit);
    };

    /**
     * Démarre l'édition inline d'un diagramme Mermaid : textarea seule, sans calque de
     * coloration ni portail (pas d'aperçu live du diagramme pendant la frappe — se
     * re-rend au commit via editor._refreshDOM, comme tous les autres types). Un seul
     * calque transformé par le zoom canvas comme le reste du contenu : aucune dérive
     * pixel à compenser, contrairement à code/highlight/terminal-session.
     * @param {{ editor: object }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditMermaid = (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const wrap = document.createElement('div');
        wrap.className = 'cel-code-edit-wrap';
        const textarea = document.createElement('textarea');
        textarea.className = 'cel-code-edit cel-code-edit-plain';
        textarea.value = el.data?.code || '';
        textarea.spellcheck = false;
        wrap.appendChild(textarea);
        inner.innerHTML = '';
        inner.appendChild(wrap);
        textarea.focus();

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            committed = true;
            div.classList.remove('editing');
            editor.updateData(el.id, { data: { code: textarea.value } });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        textarea.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart, end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); }
            if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); textarea.blur(); }
            e.stopPropagation();
        });

        textarea.addEventListener('blur', commit);
    };

    /**
     * Démarre l'édition inline d'un élément code-example (label + texte descriptif).
     * @param {{ editor: object }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditCodeExample = (ctx, div, el) => {
        const editor = ctx?.editor;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-code-example-content';
        wrapper.style.cursor = 'text';

        const label = document.createElement('div');
        label.className = 'cel-code-example-label';
        label.textContent = String(el.data?.label ?? el.data?.blockTitle ?? 'Exemple').trim() || 'Exemple';

        const body = document.createElement('div');
        body.className = 'cel-code-example-text cel-def-edit-field';
        body.contentEditable = 'true';
        body.textContent = el.data?.text || '';

        const hint = document.createElement('div');
        hint.className = 'cel-codeexample-stepper-detail';
        hint.textContent = 'Le widget de code se règle dans le panneau de droite.';

        wrapper.appendChild(label);
        wrapper.appendChild(body);
        wrapper.appendChild(hint);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
        body.focus();

        let committed = false;

        const commit = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                editor.updateData(el.id, { data: { text: body.textContent } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        body.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                revert();
            }
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                body.blur();
            }
            e.stopPropagation();
        });
        body.addEventListener('blur', commit);
    };

    /**
     * Démarre l'édition inline d'un élément liste (items + un niveau de sous-items).
     * Modèle de données : items = (string | { text, sub: string[] })[] — profondeur plafonnée à 1
     * (un sous-item ne peut pas avoir lui-même des sous-items).
     * @param {{ editor: object, resolveElementFontSize: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditList = (ctx, div, el) => {
        const editor = ctx?.editor;
        const resolveElementFontSize = ctx?.resolveElementFontSize;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const base = resolveElementFontSize('list', s, editor.typography, 22);
        const ul = document.createElement('ul');
        ul.className = 'cel-list-content';
        ul.style.fontSize = `${base}px`;
        ul.style.color = s.color || 'var(--sl-text)';

        let committed = false;

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        const commitAll = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (ul.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                const items = Array.from(ul.querySelectorAll(':scope > li')).map(li => {
                    const text = li.querySelector(':scope > .cel-li-text')?.textContent || '';
                    const subUl = li.querySelector(':scope > ul');
                    if (!subUl) return text;
                    const sub = Array.from(subUl.querySelectorAll(':scope > li'))
                        .map(subLi => subLi.querySelector(':scope > .cel-li-text')?.textContent || '')
                        .filter(t => t !== '');
                    return { text, sub };
                }).filter(item => (typeof item === 'string' ? item !== '' : (item.text !== '' || item.sub.length > 0)));
                editor.updateData(el.id, { data: { items: items.length ? items : [''] } });
            });
        };

        const focusText = (textEl, atEnd = true) => {
            if (!textEl) return;
            textEl.focus();
            if (!atEnd) return;
            const range = document.createRange();
            range.selectNodeContents(textEl);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        };

        const makeLi = (text = '') => {
            const li = document.createElement('li');
            const textEl = document.createElement('div');
            textEl.className = 'cel-li-text';
            textEl.contentEditable = 'true';
            textEl.textContent = text;
            textEl.addEventListener('blur', commitAll);
            li.appendChild(textEl);
            return li;
        };

        // Handler délégué unique sur le ul racine — couvre les items racine et les sous-items
        ul.addEventListener('keydown', e => {
            const textEl = e.target.closest('.cel-li-text');
            const li = e.target.closest('li');
            if (!textEl || !li) return;
            e.stopPropagation();
            const isRoot = li.parentElement === ul;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newLi = makeLi('');
                li.after(newLi);
                focusText(newLi.querySelector('.cel-li-text'), false);
                return;
            }
            if (e.key === 'Backspace' && textEl.textContent === '') {
                e.preventDefault();
                if (li.querySelector(':scope > ul')) return; // a des sous-items : ne pas les perdre
                const prev = li.previousElementSibling;
                const parentLi = !isRoot ? li.parentElement.closest('li') : null;
                li.remove();
                if (prev) {
                    focusText(prev.querySelector(':scope > .cel-li-text'));
                } else if (parentLi) {
                    const subUl = parentLi.querySelector(':scope > ul');
                    if (subUl && !subUl.children.length) subUl.remove();
                    focusText(parentLi.querySelector(':scope > .cel-li-text'));
                }
                return;
            }
            if (e.key === 'Escape') { e.preventDefault(); revert(); return; }
            if (e.key === 'Tab' && !e.shiftKey) {
                // Indenter — seul un item racine sans sous-items propres peut devenir sous-item
                e.preventDefault();
                if (!isRoot || li.querySelector(':scope > ul')) return;
                const prev = li.previousElementSibling;
                if (!prev) return;
                let subUl = prev.querySelector(':scope > ul');
                if (!subUl) {
                    subUl = document.createElement('ul');
                    prev.appendChild(subUl);
                }
                li.remove();
                subUl.appendChild(li);
                focusText(li.querySelector('.cel-li-text'));
                return;
            }
            if (e.key === 'Tab' && e.shiftKey) {
                // Désindenter — remonte un sous-item au niveau racine, juste après son parent
                e.preventDefault();
                if (isRoot) return;
                const subUl = li.parentElement;
                const parentLi = subUl.closest('li');
                li.remove();
                parentLi.after(li);
                if (!subUl.children.length) subUl.remove();
                focusText(li.querySelector('.cel-li-text'));
                return;
            }
        });

        const buildLi = item => {
            if (item && typeof item === 'object' && Array.isArray(item.sub)) {
                const li = makeLi(item.text || '');
                if (item.sub.length) {
                    const subUl = document.createElement('ul');
                    item.sub.forEach(subText => subUl.appendChild(makeLi(subText)));
                    li.appendChild(subUl);
                }
                return li;
            }
            return makeLi(typeof item === 'string' ? item : '');
        };

        (el.data?.items || ['']).forEach(item => ul.appendChild(buildLi(item)));
        inner.innerHTML = '';
        inner.appendChild(ul);
        focusText(ul.querySelector('.cel-li-text'), false);
    };

    /**
     * Démarre l'édition inline d'un élément tableau (cellules th/td contentEditable).
     * @param {{ editor: object, resolveElementFontSize: function }} ctx
     * @param {HTMLElement} div
     * @param {object} el
     */
    const startInlineEditTable = (ctx, div, el) => {
        const editor = ctx?.editor;
        const resolveElementFontSize = ctx?.resolveElementFontSize;
        if (!editor || !div || !el) return;
        if (div.classList.contains('editing')) return;
        div.classList.add('editing');
        const inner = div.querySelector('.cel-inner');

        const s = el.style || {};
        const rows = JSON.parse(JSON.stringify(el.data?.rows || [['', ''], ['', '']]));
        const base = resolveElementFontSize('table', s, editor.typography, 18);
        const wrapper = document.createElement('div');
        wrapper.className = 'cel-table-content';
        wrapper.style.fontSize = `${base}px`;
        wrapper.style.color = s.color || 'var(--sl-text,#cbd5e1)';

        const table = document.createElement('table');
        let committed = false;

        const readRows = () => {
            const result = [];
            table.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('th, td').forEach(cell => row.push(cell.textContent));
                result.push(row);
            });
            return result;
        };

        const commitAll = () => {
            if (committed || !div.classList.contains('editing')) return;
            requestAnimationFrame(() => {
                if (wrapper.contains(document.activeElement)) return;
                committed = true;
                div.classList.remove('editing');
                editor.updateData(el.id, { data: { rows: readRows() } });
            });
        };

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        rows.forEach((row, ri) => {
            const tr = document.createElement('tr');
            (row || []).forEach(cellText => {
                const cell = document.createElement(ri === 0 ? 'th' : 'td');
                cell.contentEditable = 'true';
                cell.textContent = cellText;
                cell.addEventListener('keydown', e => {
                    e.stopPropagation();
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const next = e.shiftKey ? cell.previousElementSibling || cell.parentElement.previousElementSibling?.lastElementChild
                                                : cell.nextElementSibling || cell.parentElement.nextElementSibling?.firstElementChild;
                        if (next) next.focus();
                    }
                    if (e.key === 'Escape') { e.preventDefault(); revert(); }
                });
                cell.addEventListener('blur', commitAll);
                tr.appendChild(cell);
            });
            table.appendChild(tr);
        });

        wrapper.appendChild(table);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
        const firstCell = table.querySelector('th, td');
        if (firstCell) firstCell.focus();
    };

    root.OEISlidesCanvasInlineEditRuntime = Object.freeze({
        startInlineEdit,
        startInlineEditCode,
        startInlineEditHighlight,
        startInlineEditDefinition,
        startInlineEditCodeExample,
        startInlineEditList,
        startInlineEditTable,
        startInlineEditQuote,
        startInlineEditCalloutBox,
        startInlineEditLatex,
        startInlineEditAudienceRoulette,
        startInlineEditTimerLabel,
        startInlineEditPromptField,
        startInlineEditCard,
        startInlineEditSmartArt,
        startInlineEditTerminalSession,
        startInlineEditMermaid,
        testUtils: Object.freeze({
            startInlineEdit,
            startInlineEditCode,
            startInlineEditHighlight,
            startInlineEditDefinition,
            startInlineEditCodeExample,
            startInlineEditList,
            startInlineEditTable,
            startInlineEditQuote,
            startInlineEditCalloutBox,
            startInlineEditLatex,
            startInlineEditAudienceRoulette,
            startInlineEditTimerLabel,
            startInlineEditPromptField,
            startInlineEditCard,
            startInlineEditSmartArt,
            startInlineEditTerminalSession,
            startInlineEditMermaid,
            applyCodeFontMetrics,
            mountCodeEditPortal,
            mountLabeledFieldsEditor,
            mountFlatItemsEditor,
        }),
    });
})(window);
