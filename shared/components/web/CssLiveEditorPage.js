class CssLiveEditorPage extends ConceptPage {
    async init() {
        await super.init();

        const htmlEditor = document.getElementById('html-code');
        const cssEditor = document.getElementById('css-code');
        const viewer = document.getElementById('viewer');
        const propertySelect = document.getElementById('cascade-property');
        const cascadeTarget = document.getElementById('cascade-target');
        const cascadeRules = document.getElementById('cascade-rules');
        const cascadeWinner = document.getElementById('cascade-winner');

        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        const splitSelectors = (selectorText) => {
            const out = [];
            let current = '';
            let depth = 0;
            for (let i = 0; i < selectorText.length; i += 1) {
                const ch = selectorText[i];
                if (ch === '(' || ch === '[') depth += 1;
                if (ch === ')' || ch === ']') depth -= 1;
                if (ch === ',' && depth === 0) {
                    if (current.trim()) out.push(current.trim());
                    current = '';
                    continue;
                }
                current += ch;
            }
            if (current.trim()) out.push(current.trim());
            return out;
        };

        const calcSpecificity = (selector) => {
            let a = 0;
            let b = 0;
            let c = 0;
            let s = selector || '';

            const ids = s.match(/#[\w-]+/g);
            if (ids) a += ids.length;
            s = s.replace(/#[\w-]+/g, '');

            const attrs = s.match(/\[[^\]]+\]/g);
            if (attrs) b += attrs.length;
            s = s.replace(/\[[^\]]+\]/g, '');

            const pseudoClasses = s.match(/:(?!:)[\w-]+(\([^)]*\))?/g);
            if (pseudoClasses) b += pseudoClasses.length;
            s = s.replace(/:(?!:)[\w-]+(\([^)]*\))?/g, '');

            const classes = s.match(/\.[\w-]+/g);
            if (classes) b += classes.length;
            s = s.replace(/\.[\w-]+/g, '');

            const pseudoElements = s.match(/::[\w-]+/g);
            if (pseudoElements) c += pseudoElements.length;
            s = s.replace(/::[\w-]+/g, '');

            const tags = s.match(/(^|[\s>+~])([a-zA-Z][\w-]*)/g);
            if (tags) c += tags.length;
            return { a, b, c };
        };

        const specificityText = (sp) => `(${sp.a}, ${sp.b}, ${sp.c})`;

        const parseCssRules = (cssText) => {
            const out = [];
            const regex = /([^{}]+)\{([^{}]*)\}/g;
            let match;
            let order = 0;
            while ((match = regex.exec(cssText)) !== null) {
                const selectors = splitSelectors(match[1]);
                const body = match[2] || '';
                const declarations = {};
                body.split(';').forEach((chunk) => {
                    const idx = chunk.indexOf(':');
                    if (idx === -1) return;
                    const property = chunk.slice(0, idx).trim().toLowerCase();
                    const rawValue = chunk.slice(idx + 1).trim();
                    if (!property || !rawValue) return;
                    const important = /\!important\s*$/i.test(rawValue);
                    const value = rawValue.replace(/\!important\s*$/i, '').trim();
                    declarations[property] = { value, important };
                });

                selectors.forEach((selector) => {
                    out.push({
                        selector,
                        declarations,
                        order: order++
                    });
                });
            }
            return out;
        };

        const compareRules = (left, right) => {
            if (left.important !== right.important) return left.important ? 1 : -1;
            const la = left.specificity;
            const ra = right.specificity;
            if (la.a !== ra.a) return la.a > ra.a ? 1 : -1;
            if (la.b !== ra.b) return la.b > ra.b ? 1 : -1;
            if (la.c !== ra.c) return la.c > ra.c ? 1 : -1;
            return left.order > right.order ? 1 : -1;
        };

        const updateViewer = () => {
            viewer.innerHTML = htmlEditor.value;
            const oldStyle = document.getElementById('dynamic-style');
            if (oldStyle) oldStyle.remove();
            const style = document.createElement('style');
            style.id = 'dynamic-style';
            style.textContent = cssEditor.value;
            viewer.appendChild(style);
        };

        const selectorAtCursor = () => {
            const cursorPosition = cssEditor.selectionStart;
            const cssContent = cssEditor.value;
            const lines = cssContent.split('\n');
            let charCount = 0;
            let selector = null;

            for (let i = 0; i < lines.length; i++) {
                charCount += lines[i].length + 1;
                if (cursorPosition <= charCount) {
                    const match = lines[i].match(/^[^{]+/);
                    selector = match ? match[0].trim() : null;
                    break;
                }
            }
            return selector;
        };

        const highlightActiveSelector = () => {
            const currentSelector = selectorAtCursor();
            viewer.querySelectorAll('.highlight-active').forEach((el) => el.classList.remove('highlight-active'));
            viewer.querySelectorAll('.highlight-cascade-target').forEach((el) => el.classList.remove('highlight-cascade-target'));

            if (currentSelector) {
                try {
                    viewer.querySelectorAll(currentSelector).forEach((el) => el.classList.add('highlight-active'));
                } catch (error) {
                    // Invalid selector typed by user.
                }
            }
            return currentSelector;
        };

        const describeElement = (el) => {
            if (!el) return '(aucune cible)';
            const id = el.id ? '#' + el.id : '';
            const cls = el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.') : '';
            return `<${el.tagName.toLowerCase()}>${id}${cls}`;
        };

        const updateCascadePanel = () => {
            const selectedProperty = (propertySelect?.value || 'color').toLowerCase();
            const currentSelector = highlightActiveSelector();
            if (!cascadeRules || !cascadeWinner || !cascadeTarget) return;

            cascadeRules.innerHTML = '';
            cascadeWinner.textContent = 'Aucune regle gagnante.';
            cascadeTarget.textContent = 'Cible: aucune';

            if (!currentSelector) {
                cascadeRules.innerHTML = '<div class="cascade-empty">Place le curseur dans un selecteur CSS.</div>';
                return;
            }

            let target = null;
            try {
                target = viewer.querySelector(currentSelector);
            } catch (error) {
                cascadeRules.innerHTML = '<div class="cascade-empty">Selecteur invalide.</div>';
                return;
            }

            if (!target) {
                cascadeRules.innerHTML = '<div class="cascade-empty">Aucune cible dans le HTML courant.</div>';
                return;
            }

            target.classList.add('highlight-cascade-target');
            cascadeTarget.textContent = 'Cible: ' + describeElement(target);

            const candidates = [];
            parseCssRules(cssEditor.value).forEach((rule) => {
                try {
                    if (!target.matches(rule.selector)) return;
                } catch (error) {
                    return;
                }
                const decl = rule.declarations[selectedProperty];
                if (!decl) return;
                candidates.push({
                    selector: rule.selector,
                    value: decl.value,
                    important: decl.important,
                    specificity: calcSpecificity(rule.selector),
                    order: rule.order
                });
            });

            if (!candidates.length) {
                cascadeRules.innerHTML = '<div class="cascade-empty">Aucune regle ne definit <code>' + escapeHtml(selectedProperty) + '</code> pour cette cible.</div>';
                return;
            }

            const winner = candidates.reduce((best, candidate) => {
                if (!best) return candidate;
                return compareRules(candidate, best) > 0 ? candidate : best;
            }, null);

            candidates
                .sort((a, b) => compareRules(a, b))
                .reverse()
                .forEach((row) => {
                    const isWinner = winner && row.order === winner.order && row.selector === winner.selector;
                    cascadeRules.innerHTML += '<div class="cascade-row ' + (isWinner ? 'winner' : '') + '">' +
                        '<div class="cascade-sel">' + escapeHtml(row.selector) + '</div>' +
                        '<div class="cascade-meta">' + escapeHtml(specificityText(row.specificity)) + (row.important ? ' !important' : '') + '</div>' +
                        '<div class="cascade-val">' + escapeHtml(row.value) + '</div>' +
                        '</div>';
                });

            cascadeWinner.textContent = 'Gagnant: ' + winner.selector + ' -> ' + selectedProperty + ': ' + winner.value + (winner.important ? ' !important' : '');
        };

        htmlEditor.addEventListener('input', () => {
            updateViewer();
            updateCascadePanel();
        });
        cssEditor.addEventListener('input', () => {
            updateViewer();
            updateCascadePanel();
        });
        cssEditor.addEventListener('click', updateCascadePanel);
        cssEditor.addEventListener('keyup', updateCascadePanel);
        propertySelect?.addEventListener('change', updateCascadePanel);

        htmlEditor.value = '<div class="box">Une boîte</div>\n<ul>\n    <li>Élément 1</li>\n    <li>Élément 2</li>\n</ul>';
        cssEditor.value = '.box {\n    background-color: #4f46e5;\n    color: white;\n    padding: 1rem;\n}\n\nul li:nth-child(2) {\n    color: red;\n}';

        updateViewer();
        updateCascadePanel();
    }
}

if (typeof window !== 'undefined') {
    window.CssLiveEditorPage = CssLiveEditorPage;
}
