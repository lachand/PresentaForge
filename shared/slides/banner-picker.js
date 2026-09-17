/**
 * @module slides/banner-picker
 * @public
 * @internal Module Slides charge cote navigateur.
 */
/* banner-picker.js — mini-formulaire réutilisable pour régler un bandeau (couleur + emoji +
 * image/gif) au niveau d'un cours ou d'une présentation Firebase. Chargé sur editor.html ET
 * index.html (les deux chargent aussi editor-export-media.js pour la compression d'image, et
 * ui-primitives.css pour .ui-modal/.ui-btn/.ui-input, réutilisés tels quels ici).
 */
(function () {
    'use strict';

    const OVERLAY_ID = 'oei-bp-overlay';

    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _close() {
        const el = document.getElementById(OVERLAY_ID);
        if (el) el.remove();
    }

    /**
     * @param {{
     *   title?: string,
     *   initial?: { color?: string, icon?: string, image?: string },
     *   onSave: (banner: { color: string, icon: string, image: string }) => void,
     *   onClear?: () => void,
     *   maxImageBytes?: number,
     * }} opts
     */
    function open(opts = {}) {
        _close();
        const initial = opts.initial || {};
        const maxImageBytes = Number(opts.maxImageBytes) > 0 ? Number(opts.maxImageBytes) : 150000;
        let pendingImage = String(initial.image || '');

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'ui-modal-overlay is-open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="ui-modal ui-modal--sm bp-modal">
                <div class="ui-modal-header">
                    <span class="ui-modal-title">${_esc(opts.title || 'Bandeau personnalisé')}</span>
                    <button class="ui-modal-close" id="bp-close" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="ui-modal-body bp-body">
                    <div class="bp-preview" id="bp-preview"></div>
                    <div class="bp-field">
                        <label for="bp-color">Couleur</label>
                        <input type="color" id="bp-color" value="${_esc(initial.color || '#00508d')}">
                    </div>
                    <div class="bp-field">
                        <label for="bp-icon">Icône (emoji)</label>
                        <input type="text" id="bp-icon" class="ui-input" maxlength="4" placeholder="📖" value="${_esc(initial.icon || '')}">
                    </div>
                    <div class="bp-field">
                        <label for="bp-image">Image / gif</label>
                        <input type="file" id="bp-image" accept="image/*">
                        <span class="bp-image-status" id="bp-image-status"></span>
                    </div>
                </div>
                <div class="ui-modal-actions">
                    <button class="ui-btn" id="bp-clear">Effacer le bandeau</button>
                    <button class="ui-btn" id="bp-cancel">Annuler</button>
                    <button class="ui-btn ui-btn--primary" id="bp-save">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const colorInput = overlay.querySelector('#bp-color');
        const iconInput = overlay.querySelector('#bp-icon');
        const imageInput = overlay.querySelector('#bp-image');
        const imageStatus = overlay.querySelector('#bp-image-status');
        const preview = overlay.querySelector('#bp-preview');

        const renderPreview = () => {
            const color = colorInput.value || '#00508d';
            const icon = iconInput.value.trim();
            preview.style.background = pendingImage
                ? `center/cover no-repeat url("${pendingImage}"), ${color}`
                : color;
            preview.textContent = pendingImage ? '' : icon;
        };
        renderPreview();
        colorInput.addEventListener('input', renderPreview);
        iconInput.addEventListener('input', renderPreview);

        imageInput.addEventListener('change', () => {
            const file = imageInput.files && imageInput.files[0];
            if (!file) return;
            imageStatus.textContent = 'Traitement…';
            const reader = new FileReader();
            reader.onload = async () => {
                let src = String(reader.result || '');
                const optimize = window.optimizeDataImageUrl;
                if (src.startsWith('data:image/') && typeof optimize === 'function') {
                    try {
                        const res = await optimize(src, { maxBytes: maxImageBytes, reason: 'banner-image' });
                        if (res && res.dataUrl) src = res.dataUrl;
                    } catch (_) { /* garde l'original, filet côté serveur (taille du document) inchangé */ }
                }
                pendingImage = src;
                imageStatus.textContent = `Image intégrée (${Math.round(src.length * 0.75 / 1024)} Ko environ)`;
                renderPreview();
            };
            reader.onerror = () => { imageStatus.textContent = 'Lecture du fichier impossible'; };
            reader.readAsDataURL(file);
        });

        overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
        overlay.querySelector('#bp-close').onclick = _close;
        overlay.querySelector('#bp-cancel').onclick = _close;
        overlay.querySelector('#bp-clear').onclick = () => {
            _close();
            if (typeof opts.onClear === 'function') opts.onClear();
        };
        overlay.querySelector('#bp-save').onclick = () => {
            const banner = { color: colorInput.value || '', icon: iconInput.value.trim(), image: pendingImage };
            _close();
            if (typeof opts.onSave === 'function') opts.onSave(banner);
        };
    }

    window.OEIBannerPicker = { open };
})();
