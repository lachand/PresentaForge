// @ts-check
/* editor-drawio-modal.js — modale plein écran hébergeant draw.io (Embed Mode) */
(function initEditorDrawioModal(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEIDrawioModal) return;

    const Protocol = root.OEIDrawioProtocol;
    if (!Protocol) {
        throw new Error('[OEIDrawioModal] Module manquant: charger drawio-embed-protocol.js avant editor-drawio-modal.js.');
    }

    let stylesInjected = false;
    const ensureStyles = documentRef => {
        if (stylesInjected) return;
        stylesInjected = true;
        const style = documentRef.createElement('style');
        style.textContent = `
.drm-backdrop { position:fixed; inset:0; background:var(--ui-overlay,rgba(17,17,26,.55)); z-index:9998; }
.drm-modal { position:fixed; inset:16px; z-index:9999; display:flex; flex-direction:column;
  background:var(--panel,#1a1d27); border:1px solid var(--outline-variant,#c5c5d3); border-radius:var(--radius-lg,1rem);
  box-shadow:var(--shadow-overlay,0 20px 60px rgba(0,0,0,0.6)); overflow:hidden; }
.drm-header { padding:10px 14px; border-bottom:1px solid var(--border,#2d3347);
  display:flex; align-items:center; gap:8px; flex-shrink:0; color:var(--text,#cbd5e1); font-family:inherit; }
.drm-header-title { font-size:0.95rem; font-weight:700; flex:1; }
.drm-cancel { background:none; border:1px solid var(--border,#2d3347); border-radius:6px; cursor:pointer;
  color:var(--text,#cbd5e1); font-size:0.8rem; padding:4px 10px; }
.drm-cancel:hover { background:var(--card,#222635); }
.drm-body { flex:1; min-height:0; }
.drm-body iframe { width:100%; height:100%; border:0; display:block; }
`;
        documentRef.head.appendChild(style);
    };

    /**
     * Ouvre la modale d'édition draw.io.
     * @param {{ xml?: string, documentRef?: Document }} options
     * @returns {Promise<{xml:string, svg:string}|null>} null si fermé sans enregistrer.
     */
    const open = (options = {}) => {
        const documentRef = options.documentRef || root.document;
        const initialXml = options.xml || '';
        ensureStyles(documentRef);

        return new Promise(resolve => {
            let settled = false;
            let savedXml = null;

            const backdrop = documentRef.createElement('div');
            backdrop.className = 'drm-backdrop';
            const modal = documentRef.createElement('div');
            modal.className = 'drm-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.innerHTML = `
                <div class="drm-header">
                    <span class="drm-header-title">Éditeur de diagramme (draw.io)</span>
                    <button type="button" class="drm-cancel" data-drm-cancel>Annuler</button>
                </div>
                <div class="drm-body"><iframe src="${String(Protocol.buildEmbedSrc())}"></iframe></div>
            `;
            documentRef.body.appendChild(backdrop);
            documentRef.body.appendChild(modal);

            const iframe = modal.querySelector('iframe');

            const teardown = () => {
                root.removeEventListener('message', onMessage);
                documentRef.removeEventListener('keydown', onKey);
                backdrop.remove();
                modal.remove();
            };

            const finish = value => {
                if (settled) return;
                settled = true;
                teardown();
                resolve(value);
            };

            const requestClose = async () => {
                const dialog = root.OEIDialog;
                const ok = dialog?.confirm
                    ? await dialog.confirm('Fermer sans enregistrer le diagramme ?')
                    : root.confirm?.('Fermer sans enregistrer le diagramme ?');
                if (!ok) return;
                finish(null);
            };

            const onMessage = event => {
                if (!Protocol.isTrustedOrigin(event.origin)) return;
                const msg = Protocol.parseMessage(event.data);
                if (!msg || typeof msg !== 'object') return;

                if (msg.event === 'init') {
                    iframe.contentWindow?.postMessage(Protocol.buildLoadAction(initialXml), '*');
                    return;
                }
                if (msg.event === 'save') {
                    savedXml = msg.xml || '';
                    iframe.contentWindow?.postMessage(Protocol.buildExportAction('svg'), '*');
                    return;
                }
                if (msg.event === 'export' && msg.format === 'svg') {
                    const svg = Protocol.decodeSvgDataUri(msg.data);
                    finish({ xml: savedXml || initialXml, svg });
                }
            };

            const onKey = e => {
                if (e.key === 'Escape') requestClose();
            };

            root.addEventListener('message', onMessage);
            documentRef.addEventListener('keydown', onKey);
            backdrop.addEventListener('click', requestClose);
            modal.querySelector('[data-drm-cancel]')?.addEventListener('click', requestClose);
        });
    };

    root.OEIDrawioModal = Object.freeze({
        open,
        testUtils: Object.freeze({ ensureStyles, open }),
    });
})(window);
