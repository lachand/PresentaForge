class DomExplorerPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.nodeDataMap = new Map();
        this.selectedNodeEl = null;
        this.debounceTimer = null;
        this.previousSignature = null;
        this.mutationHistory = [];
        this.maxMutationHistory = 14;
        this.presets = {
            simple: `<div class="page">
  <header>
    <h1>Mon Site Web</h1>
    <nav>
      <a href="#">Accueil</a>
      <a href="#">A propos</a>
      <a href="#">Contact</a>
    </nav>
  </header>
  <main>
    <h2>Bienvenue</h2>
    <p>Ceci est un <strong>paragraphe</strong> avec du <em>texte formate</em>.</p>
    <!-- Ceci est un commentaire -->
    <p>Un deuxieme paragraphe.</p>
  </main>
  <footer>
    <p>Copyright 2025</p>
  </footer>
</div>`,
            list: `<section>
  <h2>Mes listes</h2>
  <!-- Liste non ordonnee -->
  <ul class="fruits">
    <li>Pomme</li>
    <li>Banane</li>
    <li>Cerise</li>
  </ul>
  <!-- Liste ordonnee -->
  <ol class="etapes">
    <li>Premiere etape</li>
    <li>Deuxieme etape</li>
    <li>Troisieme etape</li>
  </ol>
  <!-- Liste de definition -->
  <dl>
    <dt>HTML</dt>
    <dd>Langage de balisage</dd>
    <dt>CSS</dt>
    <dd>Feuilles de style</dd>
  </dl>
</section>`,
            form: `<form id="inscription" action="#" method="post">
  <fieldset>
    <legend>Inscription</legend>
    <div class="champ">
      <label for="nom">Nom :</label>
      <input type="text" id="nom" name="nom" required>
    </div>
    <div class="champ">
      <label for="email">Email :</label>
      <input type="email" id="email" name="email">
    </div>
    <div class="champ">
      <label for="pays">Pays :</label>
      <select id="pays" name="pays">
        <option value="fr">France</option>
        <option value="be">Belgique</option>
        <option value="ch">Suisse</option>
      </select>
    </div>
    <div class="champ">
      <label>
        <input type="checkbox" name="cgu"> J'accepte les CGU
      </label>
    </div>
    <button type="submit">Envoyer</button>
  </fieldset>
</form>`,
            table: `<table>
  <caption>Notes des etudiants</caption>
  <thead>
    <tr>
      <th>Nom</th>
      <th>Maths</th>
      <th>Info</th>
      <th>Moyenne</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alice</td>
      <td>15</td>
      <td>18</td>
      <td><strong>16.5</strong></td>
    </tr>
    <tr>
      <td>Bob</td>
      <td>12</td>
      <td>14</td>
      <td><strong>13</strong></td>
    </tr>
    <!-- Ajoutez d'autres lignes -->
  </tbody>
  <tfoot>
    <tr>
      <td colspan="4">Fin du tableau</td>
    </tr>
  </tfoot>
</table>`
        };
    }

    async init() {
        await super.init();

        this.editor = document.getElementById('html-editor');
        this.domTree = document.getElementById('dom-tree');
        this.parseError = document.getElementById('parse-error');
        this.diffSummary = document.getElementById('dom-diff-summary');
        this.timelineList = document.getElementById('dom-mutation-timeline');

        this.infoType = document.getElementById('info-type');
        this.infoTag = document.getElementById('info-tag');
        this.infoAttrs = document.getElementById('info-attrs');
        this.infoText = document.getElementById('info-text');
        this.infoChildren = document.getElementById('info-children');
        this.infoDepth = document.getElementById('info-depth');

        this.bindEvents();
        this.editor.value = this.presets.simple;
        this.parseAndBuild('initial');
    }

    bindEvents() {
        this.domTree.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.toggle-btn');
            if (toggleBtn) {
                const targetId = toggleBtn.dataset.target;
                const container = document.getElementById(targetId);
                if (container) {
                    container.classList.toggle('collapsed');
                    toggleBtn.innerHTML = container.classList.contains('collapsed') ? '&#9654;' : '&#9660;';
                }
                return;
            }

            const line = e.target.closest('.node-line:not(.closing-tag)');
            if (line && this.nodeDataMap.has(line)) this.selectNode(line);
        });

        this.domTree.addEventListener('mouseover', (e) => {
            const line = e.target.closest('.node-line:not(.closing-tag)');
            if (!line || !this.nodeDataMap.has(line)) return;
            this.domTree.querySelectorAll('.hovered-node').forEach((el) => el.classList.remove('hovered-node'));
            line.classList.add('hovered-node');
            this.showNodeInfo(this.nodeDataMap.get(line));
        });

        this.domTree.addEventListener('mouseleave', () => {
            this.domTree.querySelectorAll('.hovered-node').forEach((el) => el.classList.remove('hovered-node'));
            if (this.selectedNodeEl && this.nodeDataMap.has(this.selectedNodeEl)) {
                this.showNodeInfo(this.nodeDataMap.get(this.selectedNodeEl));
            } else {
                this.clearInfo();
            }
        });

        this.editor.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.parseAndBuild('saisie'), 200);
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            this.editor.value = this.editor.value.substring(0, start) + '  ' + this.editor.value.substring(end);
            this.editor.selectionStart = this.editor.selectionEnd = start + 2;
            this.parseAndBuild('saisie');
        });

        document.querySelectorAll('[data-preset]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.preset;
                if (!this.presets[key]) return;
                this.editor.value = this.presets[key];
                this.parseAndBuild('preset:' + key);
            });
        });
    }

    signatureFromBody(body) {
        const out = [];
        const walk = (node, depth) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (!text) return;
                out.push(`text:${depth}:${text}`);
                return;
            }
            if (node.nodeType === Node.COMMENT_NODE) {
                out.push(`comment:${depth}:${node.textContent.trim()}`);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const attrs = Array.from(node.attributes || [])
                .map((a) => `${a.name}=${a.value}`)
                .sort()
                .join('|');
            out.push(`element:${depth}:${node.tagName.toLowerCase()}|${attrs}`);
            Array.from(node.childNodes).forEach((child) => walk(child, depth + 1));
        };
        Array.from(body.childNodes).forEach((child) => walk(child, 0));
        return out;
    }

    computeSignatureDiff(previous, next) {
        const prevMap = new Map();
        const nextMap = new Map();
        previous.forEach((entry) => prevMap.set(entry, (prevMap.get(entry) || 0) + 1));
        next.forEach((entry) => nextMap.set(entry, (nextMap.get(entry) || 0) + 1));

        const added = [];
        const removed = [];
        const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);

        keys.forEach((key) => {
            const a = prevMap.get(key) || 0;
            const b = nextMap.get(key) || 0;
            if (b > a) {
                for (let i = 0; i < b - a; i += 1) added.push(key);
            } else if (a > b) {
                for (let i = 0; i < a - b; i += 1) removed.push(key);
            }
        });
        return { added, removed };
    }

    summarizeEntry(signature) {
        const parts = signature.split(':');
        const kind = parts[0];
        const payload = parts.slice(2).join(':');
        if (kind === 'element') return '<' + payload.split('|')[0] + '>';
        if (kind === 'text') return 'text:' + payload.slice(0, 24);
        if (kind === 'comment') return '<!-- -->';
        return 'node';
    }

    renderMutationInsights(diff, source, baselineSize) {
        if (this.diffSummary) {
            const addCount = diff.added.length;
            const removeCount = diff.removed.length;
            this.diffSummary.innerHTML = '' +
                '<strong>Derniere mutation</strong> - source: ' + this.escapeHtml(source) +
                ' | + ' + addCount + ' / - ' + removeCount +
                ' | noeuds suivis: ' + baselineSize;
        }

        if (!this.timelineList) return;
        const addCount = diff.added.length;
        const removeCount = diff.removed.length;

        const entry = {
            source,
            added: addCount,
            removed: removeCount,
            details: [
                ...diff.added.slice(0, 2).map((sig) => '+ ' + this.summarizeEntry(sig)),
                ...diff.removed.slice(0, 2).map((sig) => '- ' + this.summarizeEntry(sig))
            ],
            at: new Date().toLocaleTimeString()
        };

        if (source === 'initial') {
            this.mutationHistory = [{
                source: 'initial',
                added: 0,
                removed: 0,
                details: ['Baseline capturee'],
                at: entry.at
            }];
        } else {
            this.mutationHistory.push(entry);
            if (this.mutationHistory.length > this.maxMutationHistory) {
                this.mutationHistory.shift();
            }
        }

        this.timelineList.innerHTML = this.mutationHistory
            .slice()
            .reverse()
            .map((row) => {
                const tone = row.added || row.removed ? 'active' : 'idle';
                return '<div class="dom-mutation-row ' + tone + '">' +
                    '<div class="dom-mutation-head">' + this.escapeHtml(row.at + ' - ' + row.source) + '</div>' +
                    '<div class="dom-mutation-meta">+ ' + row.added + ' / - ' + row.removed + '</div>' +
                    '<div class="dom-mutation-detail">' + this.escapeHtml(row.details.join(' | ')) + '</div>' +
                    '</div>';
            })
            .join('');
    }

    parseAndBuild(source = 'saisie') {
        const html = this.editor.value;
        this.parseError.classList.remove('visible');

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            this.parseError.textContent = 'Erreur de syntaxe dans le HTML.';
            this.parseError.classList.add('visible');
        }

        this.nodeDataMap = new Map();
        const body = doc.body;
        const currentSignature = this.signatureFromBody(body);
        const diff = this.previousSignature
            ? this.computeSignatureDiff(this.previousSignature, currentSignature)
            : { added: [], removed: [] };
        const baselineSize = currentSignature.length;
        const effectiveSource = source || 'saisie';

        if (!body || !body.childNodes.length) {
            this.domTree.innerHTML = '<span style="color:var(--muted); font-style:italic;">Tapez du HTML pour voir l\'arbre DOM...</span>';
            this.clearInfo();
            this.renderMutationInsights(diff, effectiveSource, baselineSize);
            this.previousSignature = currentSignature;
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const child of body.childNodes) {
            const treeEl = this.buildNodeTree(child, 0);
            if (treeEl) fragment.appendChild(treeEl);
        }

        this.domTree.innerHTML = '';
        this.domTree.appendChild(fragment);
        this.renderMutationInsights(diff, effectiveSource, baselineSize);
        this.previousSignature = currentSignature;
    }

    buildNodeTree(node, depth) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (!text) return null;

            const container = document.createElement('div');
            container.className = 'tree-node' + (depth === 0 ? ' tree-root' : '');

            const line = document.createElement('div');
            line.className = 'node-line';
            line.innerHTML = `<span class="toggle-placeholder"></span><span class="node-text-icon"></span><span class="node-text">"${this.escapeHtml(text.length > 60 ? text.substring(0, 60) + '...' : text)}"</span>`;

            this.nodeDataMap.set(line, {
                type: 'text',
                textContent: text,
                depth,
                childrenCount: 0,
                tagName: '#text',
                attributes: null,
                node
            });

            container.appendChild(line);
            return container;
        }

        if (node.nodeType === Node.COMMENT_NODE) {
            const container = document.createElement('div');
            container.className = 'tree-node' + (depth === 0 ? ' tree-root' : '');

            const line = document.createElement('div');
            line.className = 'node-line';
            const commentText = node.textContent.trim();
            line.innerHTML = `<span class="toggle-placeholder"></span><span class="node-comment-icon"></span><span class="node-comment">&lt;!-- ${this.escapeHtml(commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText)} --&gt;</span>`;

            this.nodeDataMap.set(line, {
                type: 'comment',
                textContent: commentText,
                depth,
                childrenCount: 0,
                tagName: '#comment',
                attributes: null,
                node
            });

            container.appendChild(line);
            return container;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return null;

        const container = document.createElement('div');
        container.className = 'tree-node' + (depth === 0 ? ' tree-root' : '');
        const tag = node.tagName.toLowerCase();

        const meaningfulChildren = [];
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && !child.textContent.trim()) continue;
            meaningfulChildren.push(child);
        }

        const hasChildren = meaningfulChildren.length > 0;

        let attrsHTML = '';
        const attrsArray = [];
        for (const attr of node.attributes) {
            attrsHTML += ` <span class="attr-name">${this.escapeHtml(attr.name)}</span>=<span class="attr-value">"${this.escapeHtml(attr.value)}"</span>`;
            attrsArray.push(`${attr.name}="${attr.value}"`);
        }

        const line = document.createElement('div');
        line.className = 'node-line node-element';

        const toggleId = 'ch-' + Math.random().toString(36).substring(2, 8);
        if (hasChildren) {
            line.innerHTML = `<button class="toggle-btn" data-target="${toggleId}" title="Replier/deplier">&#9660;</button><span class="node-element-icon"></span><span class="tag-bracket">&lt;</span><span class="tag-name">${tag}</span>${attrsHTML}<span class="tag-bracket">&gt;</span>`;
        } else {
            line.innerHTML = `<span class="toggle-placeholder"></span><span class="node-element-icon"></span><span class="tag-bracket">&lt;</span><span class="tag-name">${tag}</span>${attrsHTML}<span class="tag-bracket">&gt;&lt;/</span><span class="tag-name">${tag}</span><span class="tag-bracket">&gt;</span>`;
        }

        this.nodeDataMap.set(line, {
            type: 'element',
            textContent: node.textContent.trim().substring(0, 100),
            depth,
            childrenCount: meaningfulChildren.length,
            tagName: tag,
            attributes: attrsArray.length > 0 ? attrsArray.join(', ') : null,
            node
        });

        container.appendChild(line);

        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'children-container';
            childrenContainer.id = toggleId;

            for (const child of meaningfulChildren) {
                const childTree = this.buildNodeTree(child, depth + 1);
                if (childTree) childrenContainer.appendChild(childTree);
            }

            container.appendChild(childrenContainer);

            const closeLine = document.createElement('div');
            closeLine.className = 'node-line node-element closing-tag';
            closeLine.innerHTML = `<span class="toggle-placeholder"></span><span class="tag-bracket">&lt;/</span><span class="tag-name">${tag}</span><span class="tag-bracket">&gt;</span>`;
            container.appendChild(closeLine);
        }

        return container;
    }

    selectNode(line) {
        this.domTree.querySelectorAll('.selected-node').forEach((el) => el.classList.remove('selected-node'));
        line.classList.add('selected-node');
        this.selectedNodeEl = line;
        this.showNodeInfo(this.nodeDataMap.get(line));
    }

    showNodeInfo(data) {
        if (!data) {
            this.clearInfo();
            return;
        }

        const typeMap = { element: 'Element', text: 'Texte', comment: 'Commentaire' };
        const typeClass = 'type-' + data.type;

        this.infoType.textContent = typeMap[data.type] || data.type;
        this.infoType.className = 'info-value ' + typeClass;

        this.infoTag.textContent = data.tagName;
        this.infoTag.className = 'info-value ' + typeClass;

        this.infoAttrs.textContent = data.attributes || 'Aucun';
        this.infoText.textContent = data.textContent
            ? data.textContent.substring(0, 80) + (data.textContent.length > 80 ? '...' : '')
            : '(vide)';
        this.infoChildren.textContent = data.childrenCount;
        this.infoDepth.textContent = data.depth;
    }

    clearInfo() {
        this.infoType.textContent = '—';
        this.infoType.className = 'info-value';
        this.infoTag.textContent = '—';
        this.infoTag.className = 'info-value';
        this.infoAttrs.textContent = '—';
        this.infoText.textContent = '—';
        this.infoChildren.textContent = '—';
        this.infoDepth.textContent = '—';
    }

}

if (typeof window !== 'undefined') {
    window.DomExplorerPage = DomExplorerPage;
}
