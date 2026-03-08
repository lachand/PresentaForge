/**
 * PedagogyPathWidget - Render prerequis / suite blocks for a course.
 *
 * Supported schema:
 * {
 *   prerequis_obligatoires: [string|{id,title,path,why}],
 *   prerequis_recommandes: [string|{id,title,path,why}],
 *   suite_recommandee: [string|{id,title,path,why}]
 * }
 */
class PedagogyPathWidget {
    constructor(pedagogyData, options = {}) {
        this.data = pedagogyData || {};
        this.escape = typeof options.escapeHtml === 'function'
            ? options.escapeHtml
            : this.escapeHtml;
    }

    render() {
        const hasAnyList = this.hasItems(this.data.prerequis_obligatoires) ||
            this.hasItems(this.data.prerequis_recommandes) ||
            this.hasItems(this.data.suite_recommandee);

        if (!hasAnyList) return '';

        let html = '<section class="pedagogy-path">';
        html += '<div class="pedagogy-path__grid">';
        html += '<div class="pedagogy-path__column">';
        html += '<h5 class="pedagogy-path__subtitle">Avant ce cours</h5>';
        html += this.renderGroup('Prerequis obligatoires', this.data.prerequis_obligatoires, 'required');
        html += this.renderGroup('Prerequis recommandes', this.data.prerequis_recommandes, 'recommended');
        html += '</div>';

        html += '<div class="pedagogy-path__column">';
        html += '<h5 class="pedagogy-path__subtitle">Apres ce cours</h5>';
        html += this.renderGroup('Suite recommandee', this.data.suite_recommandee, 'next');
        html += '</div>';
        html += '</div>';
        html += '</section>';
        return html;
    }

    hasItems(value) {
        return Array.isArray(value) && value.length > 0;
    }

    renderGroup(label, list, variant) {
        const normalizedList = this.normalizeList(list);
        if (!this.hasItems(normalizedList)) {
            return '<p class="pedagogy-path__empty">Aucun element.</p>';
        }

        let html = `<div class="pedagogy-path__group pedagogy-path__group--${this.escape(variant)}">`;
        html += `<div class="pedagogy-path__group-label">${this.escape(label)}</div>`;
        html += '<ul class="pedagogy-path__list">';
        normalizedList.forEach((entry) => {
            html += this.renderItem(entry);
        });
        html += '</ul>';
        html += '</div>';
        return html;
    }

    renderItem(entry) {
        const normalized = this.normalizeEntry(entry);
        if (!normalized.title) return '';

        const statusClass = normalized.status ? ` pedagogy-path__item--${this.escape(normalized.status)}` : '';
        let html = `<li class="pedagogy-path__item${statusClass}">`;
        if (normalized.path) {
            html += `<a class="pedagogy-path__link" href="${this.escape(normalized.path)}">${this.escape(normalized.title)}</a>`;
        } else {
            html += `<span class="pedagogy-path__text">${this.escape(normalized.title)}</span>`;
        }
        if (normalized.statusLabel) {
            html += `<span class="pedagogy-path__status">${this.escape(normalized.statusLabel)}</span>`;
        }
        if (normalized.why) {
            html += `<div class="pedagogy-path__why">${this.escape(normalized.why)}</div>`;
        }
        html += '</li>';
        return html;
    }

    normalizeList(list) {
        if (!Array.isArray(list)) return [];
        const dedupe = new Set();
        const result = [];
        list.forEach((entry) => {
            const normalized = this.normalizeEntry(entry);
            if (!normalized.title) return;
            const key = `${normalized.title}::${normalized.path}`;
            if (dedupe.has(key)) return;
            dedupe.add(key);
            result.push(normalized);
        });
        return result;
    }

    normalizeEntry(entry) {
        if (typeof entry === 'string') {
            return { title: entry, path: '', why: '', status: '', statusLabel: '' };
        }
        if (!entry || typeof entry !== 'object') {
            return { title: '', path: '', why: '', status: '', statusLabel: '' };
        }
        const title = entry.title || entry.label || entry.id || '';
        const path = typeof entry.path === 'string' ? entry.path : '';
        const why = typeof entry.why === 'string' ? entry.why : '';
        const status = this.resolveStatus(entry);
        const statusLabel = status === 'done'
            ? 'Fait'
            : status === 'todo'
                ? 'A faire'
                : '';
        return { title, path, why, status, statusLabel };
    }

    resolveStatus(entry) {
        if (entry.completed === true) return 'done';
        if (entry.completed === false || entry.missing === true) return 'todo';
        if (typeof entry.status === 'string') {
            const status = entry.status.trim().toLowerCase();
            if (status === 'done' || status === 'todo') return status;
            if (status === 'complete') return 'done';
            if (status === 'pending' || status === 'missing') return 'todo';
        }
        return '';
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PedagogyPathWidget;
}

if (typeof window !== 'undefined') {
    window.PedagogyPathWidget = PedagogyPathWidget;
}
