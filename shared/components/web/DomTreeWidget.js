class DomTreeWidget {
    static ensureStyles() {
        if (document.getElementById('dom-tree-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'dom-tree-widget-styles';
        style.textContent = `
            .dom-widget { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.9rem; background: var(--card); margin: 0.9rem 0; }
            .dom-widget h3 { margin: 0 0 0.45rem; font-size: 0.95rem; }
            .dom-widget p { margin: 0 0 0.55rem; color: var(--muted); font-size: 0.86rem; }
            .dom-widget-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 0.7rem; }
            .dom-widget-editor { width: 100%; min-height: 180px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.6rem; font-family: var(--font-mono); font-size: 0.8rem; background: var(--code-bg); color: var(--code-text); resize: vertical; }
            .dom-widget-tree { min-height: 180px; max-height: 360px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); padding: 0.5rem; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; }
            .dom-widget-info { margin-top: 0.5rem; padding: 0.45rem 0.55rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); font-size: 0.8rem; color: var(--muted); }
            .dom-widget-diff {
                margin-top: 0.5rem;
                padding: 0.45rem 0.55rem;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg);
                font-size: 0.78rem;
                color: var(--text);
                display: grid;
                gap: 0.3rem;
            }
            .dom-widget-diff-title {
                font-weight: 700;
                color: var(--text);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
            }
            .dom-widget-diff-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.35rem;
            }
            .dom-widget-diff-pill {
                border: 1px solid var(--border);
                border-radius: 999px;
                background: var(--card);
                padding: 0.2rem 0.5rem;
                text-align: center;
                font-family: var(--font-mono);
            }
            .dom-widget-diff-pill .k { color: var(--muted); font-size: 0.7rem; }
            .dom-widget-diff-pill .v { font-weight: 700; color: var(--text); }
            .dom-widget-diff-list {
                font-family: var(--font-mono);
                font-size: 0.74rem;
                line-height: 1.45;
                color: var(--muted);
            }
            .dom-widget-diff-list .add { color: var(--tone-success-text); }
            .dom-widget-diff-list .remove { color: var(--tone-danger-text); }
            .dom-widget-node { margin-left: 1.1rem; }
            .dom-widget-node.root { margin-left: 0; }
            .dom-widget-line { display: inline-flex; gap: 0.32rem; align-items: center; padding: 2px 6px; border-radius: 4px; cursor: pointer; }
            .dom-widget-line:hover { background: rgba(79, 70, 229, 0.08); }
            .dom-widget-line.selected { outline: 2px solid var(--primary); background: rgba(79, 70, 229, 0.14); }
            .dom-widget-tag { color: var(--primary); font-weight: 700; }
            .dom-widget-attr { color: var(--tone-warning-text); }
            .dom-widget-value { color: var(--accent); }
            .dom-widget-text { color: var(--accent); font-style: italic; }
            .dom-widget-comment { color: var(--muted); font-style: italic; }
            .dom-widget-children.collapsed { display: none; }
            .dom-widget-toggle { width: 18px; height: 18px; border: none; border-radius: 4px; background: var(--bg); color: var(--muted); cursor: pointer; font-size: 0.72rem; }
            .dom-widget-toggle:hover { background: var(--border); }
            .dom-widget-toggle-placeholder { display: inline-block; width: 18px; }
            @media (max-width: 980px) { .dom-widget-grid { grid-template-columns: 1fr; } }
        `;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        if (!container) return null;
        DomTreeWidget.ensureStyles();

        const title = config.title || 'Visualiseur DOM';
        const description = config.description || 'Éditez du HTML et observez sa structure DOM en arbre.';
        const initialHtml = config.initialHtml || `<section id="demo">\n  <h2 class="title">Titre</h2>\n  <p>Texte <strong>important</strong></p>\n</section>`;
        const readOnly = config.readOnly === true;
        const showDiff = config.showDiff !== false;

        container.classList.add('dom-widget');
        container.innerHTML = `
            <h3>${DomTreeWidget.escape(title)}</h3>
            <p>${DomTreeWidget.escape(description)}</p>
            <div class="dom-widget-grid">
                <div>
                    <textarea class="dom-widget-editor" data-role="editor"></textarea>
                </div>
                <div>
                    <div class="dom-widget-tree" data-role="tree"></div>
                    <div class="dom-widget-info" data-role="info">Survolez ou cliquez un nœud pour afficher ses informations.</div>
                    ${showDiff ? `
                    <div class="dom-widget-diff" data-role="diff">
                        <div class="dom-widget-diff-title">
                            <span>Diff avant/apres</span>
                            <span data-role="diff-state">Initialisation</span>
                        </div>
                        <div class="dom-widget-diff-grid">
                            <div class="dom-widget-diff-pill"><div class="k">Ajouts</div><div class="v" data-role="diff-add">0</div></div>
                            <div class="dom-widget-diff-pill"><div class="k">Suppressions</div><div class="v" data-role="diff-remove">0</div></div>
                            <div class="dom-widget-diff-pill"><div class="k">Total</div><div class="v" data-role="diff-total">0</div></div>
                        </div>
                        <div class="dom-widget-diff-list" data-role="diff-list">Aucun changement detecte.</div>
                    </div>` : ''}
                </div>
            </div>
        `;

        const editor = container.querySelector('[data-role="editor"]');
        const tree = container.querySelector('[data-role="tree"]');
        const info = container.querySelector('[data-role="info"]');
        const diffBox = container.querySelector('[data-role="diff"]');
        const diffState = container.querySelector('[data-role="diff-state"]');
        const diffAdd = container.querySelector('[data-role="diff-add"]');
        const diffRemove = container.querySelector('[data-role="diff-remove"]');
        const diffTotal = container.querySelector('[data-role="diff-total"]');
        const diffList = container.querySelector('[data-role="diff-list"]');

        editor.value = initialHtml;
        if (readOnly) editor.setAttribute('readonly', 'readonly');

        const state = {
            debounce: null,
            nodeDataMap: new Map(),
            selectedLine: null,
            previousSignature: null
        };

        const clearSelection = () => {
            tree.querySelectorAll('.dom-widget-line.selected').forEach((el) => el.classList.remove('selected'));
        };

        const showInfo = (data) => {
            if (!data) {
                info.textContent = 'Survolez ou cliquez un nœud pour afficher ses informations.';
                return;
            }
            const attrs = data.attributes && data.attributes.length
                ? data.attributes.map((a) => `${a.name}="${a.value}"`).join(', ')
                : '(aucun)';
            info.textContent = `Type: ${data.type} | Nom: ${data.name} | Profondeur: ${data.depth} | Enfants: ${data.childrenCount} | Attributs: ${attrs}`;
        };

        const signatureFromBody = (body) => {
            const entries = [];
            const walk = (node, depth) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (!text) return;
                    entries.push(`text:${depth}:${text}`);
                    return;
                }
                if (node.nodeType === Node.COMMENT_NODE) {
                    const txt = node.textContent.trim();
                    entries.push(`comment:${depth}:${txt}`);
                    return;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) return;

                const attrs = Array.from(node.attributes || [])
                    .map((a) => `${a.name}=${a.value}`)
                    .sort()
                    .join('|');
                entries.push(`element:${depth}:${node.tagName.toLowerCase()}|${attrs}`);
                Array.from(node.childNodes).forEach((child) => walk(child, depth + 1));
            };

            Array.from(body.childNodes).forEach((child) => walk(child, 0));
            return entries;
        };

        const computeDiff = (before, after) => {
            const beforeMap = new Map();
            const afterMap = new Map();
            before.forEach((entry) => beforeMap.set(entry, (beforeMap.get(entry) || 0) + 1));
            after.forEach((entry) => afterMap.set(entry, (afterMap.get(entry) || 0) + 1));

            const added = [];
            const removed = [];
            const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

            allKeys.forEach((key) => {
                const a = beforeMap.get(key) || 0;
                const b = afterMap.get(key) || 0;
                if (b > a) {
                    for (let i = 0; i < b - a; i += 1) added.push(key);
                } else if (a > b) {
                    for (let i = 0; i < a - b; i += 1) removed.push(key);
                }
            });

            return { added, removed };
        };

        const formatSignatureLine = (entry) => {
            const parts = entry.split(':');
            const type = parts[0];
            const payload = parts.slice(2).join(':');
            if (type === 'element') return `+/- <${payload.split('|')[0]}>`;
            if (type === 'text') return `+/- text "${payload.slice(0, 30)}${payload.length > 30 ? '...' : ''}"`;
            if (type === 'comment') return `+/- <!-- ${payload.slice(0, 26)}${payload.length > 26 ? '...' : ''} -->`;
            return '+/- nœud';
        };

        const updateDiffPanel = (diff, initial = false) => {
            if (!diffBox) return;
            if (initial) {
                if (diffState) diffState.textContent = 'Baseline';
                if (diffAdd) diffAdd.textContent = '0';
                if (diffRemove) diffRemove.textContent = '0';
                if (diffTotal) diffTotal.textContent = String(state.previousSignature ? state.previousSignature.length : 0);
                if (diffList) diffList.textContent = 'Structure de reference enregistree.';
                return;
            }

            const addCount = diff.added.length;
            const removeCount = diff.removed.length;
            if (diffState) diffState.textContent = addCount || removeCount ? 'Mise a jour' : 'Aucun changement';
            if (diffAdd) diffAdd.textContent = String(addCount);
            if (diffRemove) diffRemove.textContent = String(removeCount);
            if (diffTotal) diffTotal.textContent = String((state.previousSignature || []).length);

            if (!diffList) return;
            if (!addCount && !removeCount) {
                diffList.textContent = 'Aucune difference detectee depuis la derniere version.';
                return;
            }

            const lines = [];
            diff.added.slice(0, 4).forEach((entry) => lines.push(`<div class="add">+ ${DomTreeWidget.escape(formatSignatureLine(entry).replace('+/- ', ''))}</div>`));
            diff.removed.slice(0, 4).forEach((entry) => lines.push(`<div class="remove">- ${DomTreeWidget.escape(formatSignatureLine(entry).replace('+/- ', ''))}</div>`));
            const hidden = addCount + removeCount - lines.length;
            if (hidden > 0) {
                lines.push(`<div>... ${hidden} changement(s) supplementaire(s)</div>`);
            }
            diffList.innerHTML = lines.join('');
        };

        const buildNodeTree = (node, depth = 0) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (!text) return null;
                const wrap = document.createElement('div');
                wrap.className = 'dom-widget-node' + (depth === 0 ? ' root' : '');
                const line = document.createElement('div');
                line.className = 'dom-widget-line';
                line.innerHTML = `<span class="dom-widget-toggle-placeholder"></span><span class="dom-widget-text">"${DomTreeWidget.escape(text.length > 70 ? text.slice(0, 70) + '...' : text)}"</span>`;
                state.nodeDataMap.set(line, { type: 'text', name: '#text', depth, childrenCount: 0, attributes: null });
                wrap.appendChild(line);
                return wrap;
            }

            if (node.nodeType === Node.COMMENT_NODE) {
                const txt = node.textContent.trim();
                const wrap = document.createElement('div');
                wrap.className = 'dom-widget-node' + (depth === 0 ? ' root' : '');
                const line = document.createElement('div');
                line.className = 'dom-widget-line';
                line.innerHTML = `<span class="dom-widget-toggle-placeholder"></span><span class="dom-widget-comment">&lt;!-- ${DomTreeWidget.escape(txt)} --&gt;</span>`;
                state.nodeDataMap.set(line, { type: 'comment', name: '#comment', depth, childrenCount: 0, attributes: null });
                wrap.appendChild(line);
                return wrap;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return null;

            const wrap = document.createElement('div');
            wrap.className = 'dom-widget-node' + (depth === 0 ? ' root' : '');
            const line = document.createElement('div');
            line.className = 'dom-widget-line';

            const children = Array.from(node.childNodes).filter((child) => {
                if (child.nodeType === Node.TEXT_NODE) return child.textContent.trim().length > 0;
                return child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.COMMENT_NODE;
            });
            const hasChildren = children.length > 0;

            const attrs = Array.from(node.attributes || []);
            const attrsHtml = attrs.map((a) => ` <span class="dom-widget-attr">${DomTreeWidget.escape(a.name)}</span>=<span class="dom-widget-value">"${DomTreeWidget.escape(a.value)}"</span>`).join('');

            line.innerHTML = `
                ${hasChildren ? `<button type="button" class="dom-widget-toggle" data-role="toggle">&#9660;</button>` : '<span class="dom-widget-toggle-placeholder"></span>'}
                <span>&lt;<span class="dom-widget-tag">${DomTreeWidget.escape(node.tagName.toLowerCase())}</span>${attrsHtml}&gt;</span>
            `;
            state.nodeDataMap.set(line, { type: 'element', name: node.tagName.toLowerCase(), depth, childrenCount: children.length, attributes: attrs });
            wrap.appendChild(line);

            if (hasChildren) {
                const childrenWrap = document.createElement('div');
                childrenWrap.className = 'dom-widget-children';
                children.forEach((child) => {
                    const subtree = buildNodeTree(child, depth + 1);
                    if (subtree) childrenWrap.appendChild(subtree);
                });
                wrap.appendChild(childrenWrap);
            }

            return wrap;
        };

        let currentHtml = initialHtml;
        const resolveHtml = () => {
            if (typeof config.getHtml === 'function') {
                const live = config.getHtml();
                if (typeof live === 'string' && live.trim()) currentHtml = live;
            } else if (editor) {
                currentHtml = editor.value;
            }
            if (editor && typeof config.getHtml === 'function') editor.value = currentHtml;
            return currentHtml;
        };

        const parseAndRender = () => {
            state.nodeDataMap = new Map();
            const parser = new DOMParser();
            const doc = parser.parseFromString(resolveHtml(), 'text/html');
            const body = doc.body;
            const currentSignature = signatureFromBody(body);
            const diff = state.previousSignature
                ? computeDiff(state.previousSignature, currentSignature)
                : { added: [], removed: [] };

            tree.innerHTML = '';
            clearSelection();
            state.selectedLine = null;
            showInfo(null);

            if (!body || !body.childNodes.length) {
                tree.textContent = 'Saisissez du HTML pour voir l\'arbre.';
                return;
            }

            const fragment = document.createDocumentFragment();
            Array.from(body.childNodes).forEach((child) => {
                const subtree = buildNodeTree(child, 0);
                if (subtree) fragment.appendChild(subtree);
            });
            if (!fragment.childNodes.length) {
                tree.textContent = 'Aucun nœud visualisable.';
                if (!state.previousSignature) {
                    state.previousSignature = currentSignature;
                    updateDiffPanel(diff, true);
                } else {
                    updateDiffPanel(diff, false);
                    state.previousSignature = currentSignature;
                }
                return;
            }
            tree.appendChild(fragment);
            if (!state.previousSignature) {
                state.previousSignature = currentSignature;
                updateDiffPanel(diff, true);
            } else {
                updateDiffPanel(diff, false);
                state.previousSignature = currentSignature;
            }
        };

        tree.addEventListener('click', (event) => {
            const toggle = event.target.closest('[data-role="toggle"]');
            if (toggle) {
                const parent = toggle.closest('.dom-widget-node');
                const block = parent ? parent.querySelector(':scope > .dom-widget-children') : null;
                if (!block) return;
                block.classList.toggle('collapsed');
                toggle.innerHTML = block.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
                return;
            }

            const line = event.target.closest('.dom-widget-line');
            if (!line || !state.nodeDataMap.has(line)) return;
            clearSelection();
            line.classList.add('selected');
            state.selectedLine = line;
            showInfo(state.nodeDataMap.get(line));
        });

        tree.addEventListener('mouseover', (event) => {
            const line = event.target.closest('.dom-widget-line');
            if (!line || !state.nodeDataMap.has(line)) return;
            showInfo(state.nodeDataMap.get(line));
        });

        tree.addEventListener('mouseleave', () => {
            if (state.selectedLine && state.nodeDataMap.has(state.selectedLine)) {
                showInfo(state.nodeDataMap.get(state.selectedLine));
            } else {
                showInfo(null);
            }
        });

        if (!readOnly || typeof config.getHtml !== 'function') {
            editor.addEventListener('input', () => {
                clearTimeout(state.debounce);
                state.debounce = setTimeout(parseAndRender, 220);
            });
        }

        parseAndRender();

        return {
            refresh: parseAndRender,
            setHtml: (html) => {
                currentHtml = String(html == null ? '' : html);
                if (editor) editor.value = currentHtml;
                parseAndRender();
            },
            destroy: () => {
                clearTimeout(state.debounce);
            }
        };
    }

    static escape(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
}

if (typeof window !== 'undefined') {
    window.DomTreeWidget = DomTreeWidget;
}
