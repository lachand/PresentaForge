/**
 * SlidesEmbed — Viewer de slides intégrable dans les pages de cours OEI.
 *
 * Utilisation :
 *   SlidesEmbed.mount(container, { file: 'data/slides/mon-cours.json', height: 480 });
 *
 * Le chemin `file` est résolu relativement à la page courante, puis passé
 * comme URL absolue à slides/viewer.html?mode=embed.
 */
class SlidesEmbed {
    static mount(container, config = {}) {
        const file = String(config.file || '');
        const height = Math.max(200, Number(config.height) || 480);
        const titleAttr = SlidesEmbed._esc(config.title || 'Présentation intégrée');

        // Resolve file path relative to current page → root-absolute path
        let resolvedPath = file;
        if (file && !file.startsWith('http')) {
            try {
                resolvedPath = new URL(file, window.location.href).pathname;
            } catch (_) { /* keep as-is */ }
        }

        // Compute relative URL to slides/viewer.html from the current page
        const currentPath = window.location.pathname;
        const parts = currentPath.split('/').filter(Boolean);
        // Remove the filename (last segment if it contains a dot)
        if (parts.length > 0 && parts[parts.length - 1].includes('.')) parts.pop();
        const prefix = parts.length > 0 ? '../'.repeat(parts.length) : './';
        const viewerUrl = `${prefix}slides/viewer.html?file=${encodeURIComponent(resolvedPath)}&mode=embed`;

        container.innerHTML = `
<div class="sl-embed-wrap" style="height:${height}px">
    <div class="sl-embed-loading" aria-live="polite">Chargement de la présentation…</div>
    <iframe src="${SlidesEmbed._esc(viewerUrl)}"
            allow="fullscreen"
            loading="lazy"
            title="${titleAttr}"></iframe>
</div>`;

        const iframe = container.querySelector('iframe');
        const loading = container.querySelector('.sl-embed-loading');
        if (iframe && loading) {
            iframe.addEventListener('load', () => loading.classList.add('loaded'));
        }
    }

    static _esc(s) {
        return String(s || '').replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }
}

if (typeof window !== 'undefined') window.SlidesEmbed = SlidesEmbed;
