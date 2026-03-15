/**
 * Load legacy classic scripts sequentially to preserve execution order.
 * @param {readonly string[]} sources
 * @param {{ parent?: HTMLElement | null, onProgress?: (source: string) => void }} [options]
 * @returns {Promise<void>}
 */
export async function loadClassicScripts(sources, options = {}) {
    const parent = options.parent || document.body || document.head;
    if (!parent) {
        throw new Error('Impossible de charger les scripts: document indisponible');
    }
    for (const source of sources) {
        await _loadClassicScript(parent, source);
        if (typeof options.onProgress === 'function') {
            options.onProgress(source);
        }
    }
}

/**
 * @param {string} scope
 * @param {unknown} error
 */
export function reportBootstrapFailure(scope, error) {
    const details = error instanceof Error ? error.message : String(error);
    const message = `[${scope}] Échec du chargement des scripts: ${details}`;
    console.error(message, error);
    try {
        const host = document.getElementById('notif') || document.body;
        if (!host) return;
        const banner = document.createElement('div');
        banner.className = 'bootstrap-error-banner';
        banner.setAttribute('role', 'alert');
        banner.textContent = message;
        banner.style.cssText = [
            'position:fixed',
            'left:12px',
            'right:12px',
            'bottom:12px',
            'z-index:99999',
            'padding:10px 12px',
            'border-radius:10px',
            'font:600 13px/1.35 Inter, system-ui, sans-serif',
            'background:#fee2e2',
            'color:#7f1d1d',
            'border:1px solid #fecaca',
            'box-shadow:0 12px 32px rgba(0,0,0,.18)',
        ].join(';');
        host.appendChild(banner);
    } catch (_err) {
        // No-op fallback: console already contains the failure.
    }
}

/**
 * @param {HTMLElement} parent
 * @param {string} source
 * @returns {Promise<void>}
 */
function _loadClassicScript(parent, source) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = source;
        script.async = false;
        script.defer = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Échec chargement: ${source}`));
        parent.appendChild(script);
    });
}
