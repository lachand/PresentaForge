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
     * @param {{ resolveElementFontSize?: function, computeCodeMetrics?: function }} ctx
     * @param {object} el
     * @param {HTMLElement} pre
     * @param {HTMLElement} textarea
     * @param {object} typography
     */
    const applyCodeFontMetrics = (ctx, el, pre, textarea, typography) => {
        const resolveElementFontSize = ctx?.resolveElementFontSize;
        const computeCodeMetrics = ctx?.computeCodeMetrics;
        const base = typeof resolveElementFontSize === 'function'
            ? resolveElementFontSize(el.type, el.style || {}, typography, 16)
            : 16;
        const metrics = typeof computeCodeMetrics === 'function'
            ? computeCodeMetrics(base)
            : { codeSize: Math.round(base * 0.82), codeLineHeight: 1.58 };
        pre.style.fontSize = textarea.style.fontSize = `${metrics.codeSize}px`;
        pre.style.lineHeight = textarea.style.lineHeight = String(metrics.codeLineHeight);
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
        applyCodeFontMetrics(ctx, el, pre, textarea, editor.typography);

        wrap.appendChild(pre);
        wrap.appendChild(textarea);
        inner.innerHTML = '';
        inner.appendChild(wrap);
        textarea.focus();

        const renderHighlight = typeof mountLiveHighlight === 'function'
            ? mountLiveHighlight({ textarea, pre, codeEl, getLanguage: () => lang })
            : null;

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

        const wrapper = document.createElement('div');
        wrapper.className = 'cel-highlight-edit-wrap';

        const select = document.createElement('select');
        select.className = 'cel-hl-lang-select';
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
        applyCodeFontMetrics(ctx, el, pre, textarea, editor.typography);

        codeWrap.appendChild(pre);
        codeWrap.appendChild(textarea);
        wrapper.appendChild(select);
        wrapper.appendChild(codeWrap);
        inner.innerHTML = '';
        inner.appendChild(wrapper);
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
                editor.updateData(el.id, { data: { code: textarea.value, language: select.value } });
            });
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

        const container = document.createElement('div');
        container.className = 'cel-def-content';
        container.style.cursor = 'text';

        const fields = [
            { key: 'term',       label: 'Terme',      cls: 'cel-def-term',    value: el.data?.term       || '' },
            { key: 'definition', label: 'Définition',  cls: 'cel-def-body',    value: el.data?.definition || '' },
            { key: 'example',    label: String(el.data?.exampleLabel || 'Exemple'), cls: 'cel-def-example', value: el.data?.example || '' },
        ];

        const editables = [];
        fields.forEach(({ key, label, cls, value }) => {
            const row = document.createElement('div');
            row.style.marginBottom = '0.35rem';
            const lbl = document.createElement('span');
            lbl.textContent = label + ' : ';
            lbl.className = 'cel-def-inline-label';
            const field = document.createElement('span');
            field.contentEditable = 'true';
            field.className = cls + ' cel-def-edit-field';
            field.textContent = value;
            field.dataset.key = key;
            row.appendChild(lbl);
            row.appendChild(field);
            container.appendChild(row);
            editables.push(field);
        });

        inner.innerHTML = '';
        inner.appendChild(container);
        editables[0].focus();

        let committed = false;

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

        const revert = () => {
            if (committed) return;
            committed = true;
            div.classList.remove('editing');
            editor._refreshDOM(el.id);
        };

        editables.forEach((field, i) => {
            field.addEventListener('keydown', e => {
                if (e.key === 'Tab') {
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
                if (e.key === 'Escape') { e.preventDefault(); revert(); }
                e.stopPropagation();
            });
            field.addEventListener('blur', commit);
        });
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
        testUtils: Object.freeze({
            startInlineEdit,
            startInlineEditCode,
            startInlineEditHighlight,
            startInlineEditDefinition,
            startInlineEditCodeExample,
            startInlineEditList,
            startInlineEditTable,
        }),
    });
})(window);
