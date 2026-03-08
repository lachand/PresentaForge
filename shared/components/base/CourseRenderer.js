/**
 * CourseRenderer - Génère le HTML d'un cours depuis un format JSON
 *
 * Format JSON attendu :
 * {
 *   "sections": [
 *     {
 *       "emoji": "📚",
 *       "title": "Définition",
 *       "content": [
 *         { "type": "paragraph", "text": "..." },
 *         { "type": "list", "items": ["...", "..."] },
 *         { "type": "heading", "level": 3, "text": "..." }
 *       ]
 *     }
 *   ]
 * }
 */
class CourseRenderer {
    constructor(courseData, options = {}) {
        this.courseData = courseData;
        this.collapsible = options.collapsible !== false;
        this.renderCache = new Map();
        this.cacheSignature = '';
    }

    /**
     * Génère le HTML complet du cours
     * @returns {string} HTML du cours
     */
    render() {
        if (!this.courseData || !this.courseData.sections) {
            return '<p class="section-description">Aucun contenu de cours disponible.</p>';
        }

        this.refreshCacheIfNeeded();

        let html = '';

        if (this.collapsible) {
            html += '<details class="course-section">';
            html += '<summary class="course-title">📖 Cours : ' + this.escapeHtml(this.courseData.title || 'Contenu') + '</summary>';
            html += '<div>';
        } else {
            html += '<div class="course-section course-section--open">';
        }

        html += this.renderSections();
        html += this.renderCached('pedagogyExtras', () => this.renderPedagogyExtras());

        if (this.collapsible) {
            html += '</div>';
            html += '</details>';
        } else {
            html += '</div>';
        }

        return html;
    }

    renderSections() {
        return this.courseData.sections
            .map((section, idx) => this.renderCached(`section:${idx}`, () => this.renderSection(section, idx)))
            .join('');
    }

    renderCached(key, renderer) {
        if (this.renderCache.has(key)) {
            return this.renderCache.get(key);
        }
        const html = renderer();
        this.renderCache.set(key, html);
        return html;
    }

    refreshCacheIfNeeded() {
        const signature = this.safeStringify({
            title: this.courseData?.title || '',
            sections: this.courseData?.sections || [],
            extras: {
                exercise: this.courseData?._exercice_application,
                simulation: this.courseData?._simulation_desc,
                network: this.courseData?._reseau_cognitif
            },
            collapsible: this.collapsible
        });
        if (signature !== this.cacheSignature) {
            this.renderCache.clear();
            this.cacheSignature = signature;
        }
    }

    safeStringify(value) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return '[unserializable]';
        }
    }

    renderPedagogyExtras() {
        let html = '';

        const exercise = this.courseData._exercice_application;
        const simulation = this.courseData._simulation_desc;
        const network = this.courseData._reseau_cognitif;

        if (exercise) {
            html += '<section class="pedago-extra">';
            html += '<h4 class="pedago-extra__title">Exercice d\'application immédiate</h4>';
            html += this.renderFlexibleExtra(exercise);
            html += '</section>';
        }

        if (simulation) {
            html += '<section class="pedago-extra">';
            html += '<h4 class="pedago-extra__title">Simulation guidée</h4>';
            html += this.renderFlexibleExtra(simulation);
            html += '</section>';
        }

        if (Array.isArray(network) && network.length > 0) {
            html += '<section class="pedago-extra">';
            html += '<h4 class="pedago-extra__title">Réseau cognitif</h4>';
            html += '<ul class="pedago-network">';
            network.forEach(link => {
                if (!link) return;
                const relation = this.escapeHtml(link.relation || 'Lié à');
                const concept = this.escapeHtml(link.concept || link.id || 'Concept');
                const path = typeof link.path === 'string' ? link.path : '';
                const href = path ? this.escapeHtml(path) : '';
                const why = link.why ? this.escapeHtml(link.why) : '';
                html += '<li>';
                html += `<span class="pedago-chip">${relation}</span> `;
                if (href) {
                    html += `<a href="${href}" class="pedago-link">${concept}</a>`;
                } else {
                    html += `<span class="pedago-link">${concept}</span>`;
                }
                if (why) {
                    html += `<div class="pedago-why">${why}</div>`;
                }
                html += '</li>';
            });
            html += '</ul>';
            html += '</section>';
        }

        return html;
    }

    renderFlexibleExtra(value) {
        if (typeof value === 'string') {
            return `<p class="section-description">${value}</p>`;
        }

        if (Array.isArray(value)) {
            let html = '<ul class="pedago-list">';
            value.forEach(item => {
                if (!item) return;
                html += `<li>${this.renderFlexibleListItem(item)}</li>`;
            });
            html += '</ul>';
            return html;
        }

        if (value && typeof value === 'object') {
            if (Array.isArray(value.etapes) && value.etapes.length > 0) {
                let html = '';
                if (value.contexte) html += `<p class="section-description">${value.contexte}</p>`;
                html += '<ol class="pedago-list pedago-list--ordered">';
                value.etapes.forEach(step => {
                    html += `<li>${this.renderFlexibleListItem(step)}</li>`;
                });
                html += '</ol>';
                if (value.validation) html += `<p class="section-description"><strong>Validation:</strong> ${value.validation}</p>`;
                return html;
            }

            const parts = [];
            Object.entries(value).forEach(([k, v]) => {
                if (v === null || typeof v === 'undefined' || v === '') return;
                parts.push(`<strong>${this.escapeHtml(k)}:</strong> ${this.renderInlineValue(v)}`);
            });
            return parts.length ? `<div class="section-description">${parts.join('<br>')}</div>` : '';
        }

        return '';
    }

    renderFlexibleListItem(item) {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            const entries = [];
            Object.entries(item).forEach(([k, v]) => {
                if (v === null || typeof v === 'undefined' || v === '') return;
                entries.push(`<strong>${this.escapeHtml(k)}:</strong> ${this.renderInlineValue(v)}`);
            });
            return entries.join(' | ');
        }
        return String(item);
    }

    renderInlineValue(value) {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.map(v => this.renderInlineValue(v)).join(', ');
        if (value && typeof value === 'object') {
            return Object.entries(value)
                .map(([k, v]) => `${this.escapeHtml(k)}=${this.renderInlineValue(v)}`)
                .join(', ');
        }
        return String(value);
    }

    /**
     * Génère le HTML d'une section
     * @param {Object} section - Données de la section
     * @returns {string} HTML de la section
     */
    renderSection(section, sectionIndex = 0) {
        if (!section || typeof section !== 'object') return '';
        let html = '';

        // Titre de la section avec emoji
        if (section.title) {
            const emoji = section.emoji || '';
            html += `<h3 style="color:var(--primary);margin-top:${sectionIndex === 0 ? '0' : '1.5rem'};">`;
            html += `${emoji} ${section.title}</h3>`;
        }

        // Contenu de la section
        if (section.content && Array.isArray(section.content)) {
            section.content.forEach(item => {
                html += this.renderContentItem(item);
            });
        }

        return html;
    }

    /**
     * Génère le HTML d'un élément de contenu
     * @param {Object} item - Élément de contenu
     * @returns {string} HTML de l'élément
     */
    renderContentItem(item) {
        switch (item.type) {
            case 'paragraph':
                return `<p class="section-description">${item.text}</p>`;

            case 'list':
                return this.renderList(item);

            case 'heading':
                const level = item.level || 3;
                const style = level === 3 ? 'style="color:var(--primary);margin-top:1.5rem;"' : '';
                return `<h${level} ${style}>${item.text}</h${level}>`;

            case 'code':
                return this.renderCode(item);

            case 'example':
                return this.renderExample(item);

            case 'math':
                return `<div class="math-display">$$${item.tex}$$</div>`;

            default:
                console.warn(`Type de contenu inconnu : ${item.type}`);
                return '';
        }
    }

    /**
     * Génère une liste (ordonnée ou non)
     * @param {Object} item - Données de la liste
     * @returns {string} HTML de la liste
     */
    renderList(item) {
        const tag = item.ordered ? 'ol' : 'ul';
        let html = `<${tag} style="text-align:left; margin-bottom:1.2rem; line-height:1.8; padding-left: 3em;">`;

        item.items.forEach(listItem => {
            html += `<li>${listItem}</li>`;
        });

        html += `</${tag}>`;
        return html;
    }

    /**
     * Génère un bloc de code
     * @param {Object} item - Données du code
     * @returns {string} HTML du code
     */
    renderCode(item) {
        const language = item.language || '';
        return `<pre><code class="language-${language}">${this.escapeHtml(item.code)}</code></pre>`;
    }

    /**
     * Génère un exemple
     * @param {Object} item - Données de l'exemple
     * @returns {string} HTML de l'exemple
     */
    renderExample(item) {
        let html = '<div class="example-box" style="background:var(--bg);padding:1rem;border-left:3px solid var(--primary);margin:1rem 0;">';

        if (item.title) {
            html += `<strong>${item.title}</strong><br>`;
        }

        html += item.content;
        html += '</div>';

        return html;
    }

    /**
     * Échappe les caractères HTML spéciaux
     * @param {string} text - Texte à échapper
     * @returns {string} Texte échappé
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text == null ? '' : text).replace(/[&<>"']/g, m => map[m]);
    }
}

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CourseRenderer;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.CourseRenderer = CourseRenderer;
}
