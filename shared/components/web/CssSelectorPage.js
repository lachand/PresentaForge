class CssSelectorPage extends ConceptPage {
    async init() {
        await super.init();

        const sampleHTML = `
<div id="page">
    <header class="header">
        <h1>Mon Site</h1>
        <nav id="nav-main" class="navigation">
            <ul class="menu">
                <li class="menu-item active"><a href="#">Accueil</a></li>
                <li class="menu-item"><a href="#">Articles</a></li>
                <li class="menu-item"><a href="#" class="special">Contact</a></li>
            </ul>
        </nav>
    </header>
    <main id="contenu" class="main-content">
        <article class="card featured">
            <h2 class="card-title">Premier article</h2>
            <p class="card-text">Ceci est un <span class="important">paragraphe</span> avec du texte.</p>
            <div class="card-footer">
                <span class="tag">HTML</span>
                <span class="tag">CSS</span>
            </div>
        </article>
        <article class="card">
            <h2 class="card-title">Deuxieme article</h2>
            <p class="card-text">Un autre paragraphe de texte.</p>
            <ul class="tags-list">
                <li data-level="1">Debutant</li>
                <li data-level="2">Intermediaire</li>
                <li data-level="3" class="advanced">Avance</li>
            </ul>
        </article>
        <aside class="sidebar">
            <h3>Liens utiles</h3>
            <p>Visitez <a href="#" id="lien-mdn">MDN</a> pour en savoir plus.</p>
        </aside>
    </main>
    <footer class="footer">
        <p>&copy; 2025 Mon Site</p>
    </footer>
</div>`;

        const examples = [
            { selector: 'h1', label: 'Element simple' },
            { selector: '.card', label: 'Classe' },
            { selector: '#nav-main', label: 'ID' },
            { selector: '.menu-item a', label: 'Descendant' },
            { selector: '.card > h2', label: 'Enfant direct' },
            { selector: 'li + li', label: 'Frere adjacent' },
            { selector: 'li ~ li', label: 'Freres generaux' },
            { selector: '.card-title, .card-text', label: 'Groupement' },
            { selector: 'article.card.featured', label: 'Multi-classes' },
            { selector: '[data-level]', label: 'Attribut' },
            { selector: '[data-level="2"]', label: 'Attribut = valeur' },
            { selector: 'li:first-child', label: 'Pseudo-classe' },
            { selector: 'li:nth-child(2)', label: 'nth-child' },
            { selector: 'li:last-child', label: 'last-child' },
            { selector: '.card:not(.featured)', label: ':not()' },
            { selector: '.menu-item.active > a', label: 'Combine' },
            { selector: '#contenu article p span', label: 'Profondeur' },
            { selector: '*', label: 'Universel' }
        ];

        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.display = 'none';
        document.body.appendChild(hiddenContainer);
        hiddenContainer.innerHTML = sampleHTML;

        const domTreeEl = document.getElementById('dom-tree');
        const selectorInput = document.getElementById('selector-input');
        const matchCountEl = document.getElementById('match-count');
        const specDisplay = document.getElementById('specificity-display');
        const errorMsgEl = document.getElementById('error-msg');
        const examplesListEl = document.getElementById('examples-list');

        const nodeToLineMap = new Map();

        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        const buildTreeHTML = (node, depth) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (!text) return '';
                const escaped = text.length > 50 ? text.substring(0, 50) + '...' : text;
                return `<div class="tree-node${depth === 0 ? ' tree-root' : ''}">
                    <div class="node-line">
                        <span class="toggle-placeholder"></span>
                        <span class="text-content">"${escapeHtml(escaped)}"</span>
                    </div>
                </div>`;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const hasElementChildren = Array.from(node.childNodes).some(
                (c) => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent.trim())
            );

            let attrsHTML = '';
            for (const attr of node.attributes) {
                attrsHTML += ` <span class="attr-name">${escapeHtml(attr.name)}</span>=<span class="attr-value">\"${escapeHtml(attr.value)}\"</span>`;
            }

            const nodeId = 'node-' + Math.random().toString(36).substring(2, 10);

            let childrenHTML = '';
            if (hasElementChildren) {
                const childParts = [];
                for (const child of node.childNodes) {
                    const childHTML = buildTreeHTML(child, depth + 1);
                    if (childHTML) childParts.push(childHTML);
                }
                childrenHTML = childParts.join('');
            }

            const toggleHTML = hasElementChildren
                ? `<button class="toggle-btn" data-target="${nodeId}-children" title="Replier/deplier">&#9660;</button>`
                : '<span class="toggle-placeholder"></span>';

            const openTag = `<span class="tag-bracket">&lt;</span><span class="tag-name">${tag}</span>${attrsHTML}<span class="tag-bracket">&gt;</span>`;

            let html = `<div class="tree-node${depth === 0 ? ' tree-root' : ''}">
                <div class="node-line" data-node-id="${nodeId}">
                    ${toggleHTML}
                    ${openTag}
                </div>`;

            if (hasElementChildren) {
                html += `<div class="children-container" id="${nodeId}-children">${childrenHTML}</div>`;
                html += `<div class="node-line closing-tag">
                    <span class="toggle-placeholder"></span>
                    <span class="tag-bracket">&lt;/</span><span class="tag-name">${tag}</span><span class="tag-bracket">&gt;</span>
                </div>`;
            }

            html += '</div>';

            setTimeout(() => {
                const lineEl = document.querySelector(`[data-node-id="${nodeId}"]`);
                if (lineEl) nodeToLineMap.set(node, lineEl);
            }, 0);

            return html;
        };

        const rootEl = hiddenContainer.firstElementChild;
        domTreeEl.innerHTML = buildTreeHTML(rootEl, 0);

        domTreeEl.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.toggle-btn');
            if (!toggleBtn) return;
            const targetId = toggleBtn.dataset.target;
            const container = document.getElementById(targetId);
            if (!container) return;
            container.classList.toggle('collapsed');
            toggleBtn.innerHTML = container.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
        });

        const expandToNode = (lineEl) => {
            let parent = lineEl.parentElement;
            while (parent && parent !== domTreeEl) {
                if (parent.classList.contains('children-container') && parent.classList.contains('collapsed')) {
                    parent.classList.remove('collapsed');
                    const prevSibling = parent.previousElementSibling;
                    if (prevSibling) {
                        const btn = prevSibling.querySelector('.toggle-btn');
                        if (btn) btn.innerHTML = '&#9660;';
                    }
                }
                parent = parent.parentElement;
            }
        };

        const splitSelectors = (str) => {
            const result = [];
            let depth = 0;
            let current = '';
            for (let i = 0; i < str.length; i++) {
                const ch = str[i];
                if (ch === '(' || ch === '[') depth++;
                else if (ch === ')' || ch === ']') depth--;
                else if (ch === ',' && depth === 0) {
                    result.push(current);
                    current = '';
                    continue;
                }
                current += ch;
            }
            if (current.trim()) result.push(current);
            return result;
        };

        const calcSingleSpecificity = (sel) => {
            let a = 0;
            let b = 0;
            let c = 0;
            let s = sel;

            s = s.replace(/:not\(([^)]+)\)/g, (match, inner) => {
                const innerSpec = calcSingleSpecificity(inner);
                a += innerSpec.a;
                b += innerSpec.b;
                c += innerSpec.c;
                return '';
            });

            const ids = s.match(/#[a-zA-Z_-][\w-]*/g);
            if (ids) a += ids.length;
            s = s.replace(/#[a-zA-Z_-][\w-]*/g, '');

            const attrs = s.match(/\[[^\]]+\]/g);
            if (attrs) b += attrs.length;
            s = s.replace(/\[[^\]]+\]/g, '');

            const pseudoClasses = s.match(/:(?!:)[a-zA-Z-]+(\([^)]*\))?/g);
            if (pseudoClasses) b += pseudoClasses.length;
            s = s.replace(/:(?!:)[a-zA-Z-]+(\([^)]*\))?/g, '');

            const classes = s.match(/\.[a-zA-Z_-][\w-]*/g);
            if (classes) b += classes.length;
            s = s.replace(/\.[a-zA-Z_-][\w-]*/g, '');

            const pseudoElements = s.match(/::[a-zA-Z-]+/g);
            if (pseudoElements) c += pseudoElements.length;
            s = s.replace(/::[a-zA-Z-]+/g, '');

            const elements = s.match(/(?:^|[\s>+~])([a-zA-Z][a-zA-Z0-9]*)/g);
            if (elements) c += elements.length;

            return { a, b, c };
        };

        const calculateSpecificity = (selectorStr) => {
            const parts = splitSelectors(selectorStr);
            let maxA = 0;
            let maxB = 0;
            let maxC = 0;

            for (const part of parts) {
                const spec = calcSingleSpecificity(part.trim());
                if (spec.a > maxA || (spec.a === maxA && spec.b > maxB) || (spec.a === maxA && spec.b === maxB && spec.c > maxC)) {
                    maxA = spec.a;
                    maxB = spec.b;
                    maxC = spec.c;
                }
            }
            return { a: maxA, b: maxB, c: maxC };
        };

        const updateSpecificity = (a, b, c) => {
            const parts = specDisplay.querySelectorAll('.spec-part');
            parts[0].textContent = a;
            parts[1].textContent = b;
            parts[2].textContent = c;
        };

        const applySelector = () => {
            const selector = selectorInput.value.trim();
            errorMsgEl.textContent = '';

            domTreeEl.querySelectorAll('.node-line.matched').forEach((el) => el.classList.remove('matched'));

            if (!selector) {
                matchCountEl.textContent = '0';
                updateSpecificity(0, 0, 0);
                return;
            }

            try {
                const matched = hiddenContainer.querySelectorAll(selector);
                let count = 0;

                matched.forEach((node) => {
                    const lineEl = nodeToLineMap.get(node);
                    if (lineEl) {
                        lineEl.classList.add('matched');
                        expandToNode(lineEl);
                        count++;
                    }
                });

                matchCountEl.textContent = count;
                const spec = calculateSpecificity(selector);
                updateSpecificity(spec.a, spec.b, spec.c);
            } catch (err) {
                errorMsgEl.textContent = 'Selecteur invalide';
                matchCountEl.textContent = '0';
                updateSpecificity(0, 0, 0);
            }
        };

        selectorInput.addEventListener('input', applySelector);

        examples.forEach((ex) => {
            const btn = document.createElement('button');
            btn.className = 'example-btn';
            btn.innerHTML = `<span><code>${escapeHtml(ex.selector)}</code><span class="example-label">${escapeHtml(ex.label)}</span></span>`;
            btn.addEventListener('click', () => {
                selectorInput.value = ex.selector;
                applySelector();
                selectorInput.focus();
            });
            examplesListEl.appendChild(btn);
        });

        selectorInput.value = '.card';
        applySelector();
    }
}

if (typeof window !== 'undefined') {
    window.CssSelectorPage = CssSelectorPage;
}
