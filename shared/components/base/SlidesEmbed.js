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

    static ensureStyles() {
        if (document.getElementById('slides-embed-css')) return;
        const style = document.createElement('style');
        style.id = 'slides-embed-css';
        style.textContent = `
.sl-embed-wrap {
    position: relative;
    width: 100%;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 20px rgba(0,0,0,0.22);
    background: #111;
}
.sl-embed-wrap iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
}
.sl-embed-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.45);
    font-size: 0.85rem;
    pointer-events: none;
    font-family: system-ui, sans-serif;
    background: #111;
    transition: opacity 0.3s;
}
.sl-embed-loading.loaded { opacity: 0; pointer-events: none; }
`;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        SlidesEmbed.ensureStyles();

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
