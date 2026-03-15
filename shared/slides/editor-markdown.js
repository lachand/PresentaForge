/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-markdown
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-markdown.js"></script>
 */
/* editor-markdown.js — Markdown draft mode: write slides as Markdown with --- separators */

let _mdMode = false;

/**
 * Toggle Markdown draft mode.
 * Replaces the slide panel + preview with a full-width Markdown editor.
 */
function toggleMarkdownMode() {
    _mdMode = !_mdMode;
    const btn = document.getElementById('btn-markdown-mode');
    if (btn) btn.classList.toggle('active', _mdMode);

    if (_mdMode) {
        _openMarkdownEditor();
    } else {
        _closeMarkdownEditor();
    }
}

function _openMarkdownEditor() {
    // Create overlay
    let overlay = document.getElementById('md-editor-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'md-editor-overlay';
    overlay.innerHTML = `
        <div class="md-editor-header">
            <span class="md-title">📝 Brouillon Markdown</span>
            <span class="md-hint">Séparez les slides par <code>---</code> · Syntaxe Markdown standard</span>
            <div style="flex:1"></div>
            <button class="tb-btn ui-btn md-apply-btn" id="md-apply">Appliquer aux slides</button>
            <button class="tb-btn ui-btn" id="md-close">✕ Fermer</button>
        </div>
        <div class="md-editor-body">
            <textarea id="md-textarea" spellcheck="false" placeholder="# Titre du slide\n\nContenu...\n\n---\n\n# Slide suivant\n\n- Point 1\n- Point 2"></textarea>
            <div class="md-preview" id="md-preview"></div>
        </div>
        <div class="md-statusbar">
            <span id="md-slide-count">0 slides</span>
            <span id="md-char-count">0 caractères</span>
        </div>`;
    document.body.appendChild(overlay);

    // Populate from current slides
    const md = _slidesToMarkdown(editor.data.slides);
    const textarea = document.getElementById('md-textarea');
    textarea.value = md;

    // Live preview on input
    textarea.addEventListener('input', _onMdInput);
    _onMdInput();

    // Buttons
    document.getElementById('md-apply').addEventListener('click', _applyMarkdown);
    document.getElementById('md-close').addEventListener('click', toggleMarkdownMode);

    // Tab key support
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(textarea.selectionEnd);
            textarea.selectionStart = textarea.selectionEnd = start + 4;
        }
    });
}

function _closeMarkdownEditor() {
    const overlay = document.getElementById('md-editor-overlay');
    if (overlay) overlay.remove();
    _mdMode = false;
    document.getElementById('btn-markdown-mode')?.classList.remove('active');
}

function _onMdInput() {
    const text = document.getElementById('md-textarea').value;
    const slides = text.split(/\n---\n/);
    document.getElementById('md-slide-count').textContent = slides.length + ' slide' + (slides.length > 1 ? 's' : '');
    document.getElementById('md-char-count').textContent = text.length + ' caractères';

    // Render preview
    const preview = document.getElementById('md-preview');
    preview.innerHTML = slides.map((s, i) =>
        `<div class="md-slide-preview">
            <div class="md-slide-num">${i + 1}</div>
            <div class="md-slide-content">${_mdToHtml(s.trim())}</div>
        </div>`
    ).join('');
}

/**
 * Convert current slides to Markdown text.
 */
function _slidesToMarkdown(slides) {
    return slides.map(slide => {
        const parts = [];

        if (slide.type === 'title') {
            if (slide.eyebrow) parts.push(`*${slide.eyebrow}*`);
            if (slide.title) parts.push(`# ${slide.title}`);
            if (slide.subtitle) parts.push(`*${slide.subtitle}*`);
            if (slide.author) parts.push(`> ${slide.author}`);
        } else if (slide.type === 'chapter') {
            if (slide.number) parts.push(`### ${slide.number}`);
            if (slide.title) parts.push(`# ${slide.title}`);
            if (slide.subtitle) parts.push(`*${slide.subtitle}*`);
        } else if (slide.type === 'bullets') {
            if (slide.title) parts.push(`## ${slide.title}`);
            if (slide.items) {
                slide.items.forEach(item => {
                    if (typeof item === 'string') parts.push(`- ${item}`);
                    else if (item?.text) parts.push(`- ${item.text}`);
                });
            }
        } else if (slide.type === 'code') {
            if (slide.title) parts.push(`## ${slide.title}`);
            if (slide.code) parts.push('```' + (slide.language || '') + '\n' + slide.code + '\n```');
        } else if (slide.type === 'canvas') {
            // Extract text from canvas elements
            if (slide.elements) {
                for (const el of slide.elements) {
                    if (el.type === 'heading') {
                        const level = el.data?.level === 1 ? '#' : '##';
                        parts.push(`${level} ${el.data?.text || ''}`);
                    } else if (el.type === 'text') {
                        parts.push(el.data?.text || '');
                    } else if (el.type === 'code') {
                        parts.push('```' + (el.data?.language || '') + '\n' + (el.data?.code || '') + '\n```');
                    } else if (el.type === 'list') {
                        (el.data?.items || []).forEach(item => parts.push(`- ${item}`));
                    } else if (el.type === 'image') {
                        parts.push(`![${el.data?.alt || 'image'}](${el.data?.src || ''})`);
                    }
                }
            }
        } else if (slide.type === 'definition') {
            if (slide.title) parts.push(`## ${slide.title}`);
            if (slide.definition) parts.push(slide.definition);
        } else if (slide.type === 'quote') {
            if (slide.text) parts.push(`> ${slide.text}`);
            if (slide.author) parts.push(`— ${slide.author}`);
        } else if (slide.type === 'split') {
            if (slide.title) parts.push(`## ${slide.title}`);
            if (slide.left) parts.push(slide.left);
            if (slide.right) parts.push(slide.right);
        } else {
            // Fallback: dump any text-like properties
            if (slide.title) parts.push(`## ${slide.title}`);
        }

        // Notes
        if (slide.notes) parts.push(`\n<!-- notes: ${slide.notes} -->`);

        return parts.join('\n\n') || '<!-- slide vide -->';
    }).join('\n\n---\n\n');
}

/**
 * Parse Markdown text back into slides (canvas type with text elements).
 */
function _markdownToSlides(md) {
    const sections = md.split(/\n---\n/);
    return sections.map(section => {
        const text = section.trim();
        if (!text || text === '<!-- slide vide -->') {
            return { type: 'canvas', elements: [] };
        }

        const elements = [];
        let y = 30;
        const lines = text.split('\n');
        let i = 0;

        // Extract notes
        let notes = '';
        const notesMatch = text.match(/<!--\s*notes:\s*([\s\S]*?)\s*-->/);
        if (notesMatch) notes = notesMatch[1].trim();

        while (i < lines.length) {
            const line = lines[i];

            // Skip HTML comments
            if (line.trim().startsWith('<!--')) {
                while (i < lines.length && !lines[i].includes('-->')) i++;
                i++;
                continue;
            }

            // Heading
            const hMatch = line.match(/^(#{1,3})\s+(.+)/);
            if (hMatch) {
                const level = hMatch[1].length;
                elements.push({
                    id: _mdUid(), type: 'heading',
                    x: 40, y, w: 880, h: level === 1 ? 60 : 40,
                    data: { text: hMatch[2], level: Math.min(level, 3) }
                });
                y += level === 1 ? 80 : 55;
                i++;
                continue;
            }

            // Code block
            if (line.trim().startsWith('```')) {
                const lang = line.trim().slice(3);
                const codeLines = [];
                i++;
                while (i < lines.length && !lines[i].trim().startsWith('```')) {
                    codeLines.push(lines[i]);
                    i++;
                }
                i++; // skip closing ```
                elements.push({
                    id: _mdUid(), type: 'code',
                    x: 40, y, w: 880, h: Math.max(60, codeLines.length * 22 + 30),
                    data: { code: codeLines.join('\n'), language: lang || 'javascript' }
                });
                y += Math.max(80, codeLines.length * 22 + 50);
                continue;
            }

            // List items
            if (line.trim().match(/^[-*+]\s/)) {
                const items = [];
                while (i < lines.length && lines[i].trim().match(/^[-*+]\s/)) {
                    items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
                    i++;
                }
                elements.push({
                    id: _mdUid(), type: 'list',
                    x: 40, y, w: 880, h: Math.max(40, items.length * 28 + 10),
                    data: { items, ordered: false }
                });
                y += Math.max(60, items.length * 28 + 30);
                continue;
            }

            // Blockquote
            if (line.trim().startsWith('>')) {
                const quote = line.trim().replace(/^>\s*/, '');
                elements.push({
                    id: _mdUid(), type: 'text',
                    x: 60, y, w: 840, h: 50,
                    data: { text: quote, fontSize: 18, fontStyle: 'italic' }
                });
                y += 65;
                i++;
                continue;
            }

            // Image
            const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)/);
            if (imgMatch) {
                elements.push({
                    id: _mdUid(), type: 'image',
                    x: 40, y, w: 400, h: 250,
                    data: { alt: imgMatch[1], src: imgMatch[2] }
                });
                y += 270;
                i++;
                continue;
            }

            // Emphasis paragraph (italics)
            if (line.trim().startsWith('*') && line.trim().endsWith('*') && !line.trim().startsWith('**')) {
                const emText = line.trim().replace(/^\*|\*$/g, '');
                elements.push({
                    id: _mdUid(), type: 'text',
                    x: 40, y, w: 880, h: 30,
                    data: { text: emText, fontSize: 14, fontStyle: 'italic' }
                });
                y += 40;
                i++;
                continue;
            }

            // Regular paragraph
            if (line.trim()) {
                elements.push({
                    id: _mdUid(), type: 'text',
                    x: 40, y, w: 880, h: 30,
                    data: { text: line.trim(), fontSize: 16 }
                });
                y += 40;
            }
            i++;
        }

        return { type: 'canvas', elements, notes: notes || undefined };
    });
}

async function _applyMarkdown() {
    const md = document.getElementById('md-textarea').value;
    const slides = _markdownToSlides(md);
    if (slides.length === 0) {
        notify('Aucun slide détecté', 'warning');
        return;
    }
    if (!await OEIDialog.confirm(`Remplacer les ${editor.data.slides.length} slides actuels par ${slides.length} slides depuis le Markdown ?`)) return;

    editor.data.slides = slides;
    editor.selectedIndex = 0;
    editor._push();
    _closeMarkdownEditor();
    notify(`${slides.length} slides importés depuis Markdown`, 'success');
}

/**
 * Minimal Markdown → HTML for preview (no external library).
 */
function _mdToHtml(md) {
    let html = md
        // Escape HTML
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Headings
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // Bold & italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Lists
        .replace(/^[-*+] (.+)$/gm, '<li>$1</li>')
        // Blockquotes
        .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;max-height:80px">')
        // Paragraphs (blank lines)
        .replace(/\n{2,}/g, '<br><br>')
        .replace(/\n/g, '<br>')
        // HTML comments (notes)
        .replace(/&lt;!-- .+? --&gt;/g, '');

    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, m => '<ul>' + m.replace(/<br>/g, '') + '</ul>');
    return html;
}

let _mdUidCounter = 0;
function _mdUid() {
    return 'md_' + Date.now().toString(36) + '_' + (++_mdUidCounter).toString(36);
}

window.toggleMarkdownMode = toggleMarkdownMode;
