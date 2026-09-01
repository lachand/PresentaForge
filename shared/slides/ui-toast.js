/**
 * @module slides/ui-toast
 * @public
 * @internal Module Slides chargé côté navigateur.
 */
/* ui-toast.js — notifications éphémères unifiées (window.OEIToast)
 *
 * Remplace #notif (éditeur) / statuts épars. Vanilla, sans dépendance.
 * Le style vit dans shared/slides/ui-primitives.css (.ui-toast*).
 *
 *   OEIToast.show('Enregistré', { type: 'success' });
 *   OEIToast.show('Slide supprimée', {
 *     type: 'warning',
 *     action: { label: 'Annuler', onClick: () => restore() },
 *     duration: 6000,
 *   });
 *
 * → renvoie { dismiss() }.
 */
(function initOEIToast(global) {
    'use strict';
    if (!global || global.OEIToast) return;

    const MAX_VISIBLE = 4;
    const DEFAULT_DURATION = 3500;

    // Chemins SVG (données constantes internes — jamais de contenu externe).
    const ICON_PATHS = {
        info:    ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16v-4', 'M12 8h.01'],
        success: ['M20 6 9 17l-5-5'],
        warning: ['M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01'],
        error:   ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm15 9-6 6', 'm9 9 6 6'],
        close:   ['m6 6 12 12', 'm18 6-12 12'],
    };
    const SVGNS = 'http://www.w3.org/2000/svg';
    function makeIcon(key) {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        (ICON_PATHS[key] || []).forEach(d => {
            const p = document.createElementNS(SVGNS, 'path');
            p.setAttribute('d', d);
            svg.appendChild(p);
        });
        return svg;
    }

    let root = null;

    function ensureRoot() {
        if (root && root.isConnected) return root;
        root = document.createElement('div');
        root.className = 'ui-toast-root';
        root.setAttribute('role', 'status');
        root.setAttribute('aria-live', 'polite');
        root.setAttribute('aria-atomic', 'false');
        document.body.appendChild(root);
        return root;
    }

    function trim() {
        while (root && root.children.length > MAX_VISIBLE) {
            root.firstElementChild?.remove();
        }
    }

    function show(message, opts = {}) {
        const type = ICON_PATHS[opts.type] ? opts.type : 'info';
        const duration = Number.isFinite(opts.duration) ? opts.duration : DEFAULT_DURATION;
        const host = ensureRoot();

        const el = document.createElement('div');
        el.className = 'ui-toast ui-toast--' + type;

        const icon = document.createElement('span');
        icon.className = 'ui-toast__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.appendChild(makeIcon(type));

        const msg = document.createElement('span');
        msg.className = 'ui-toast__msg';
        msg.textContent = String(message ?? '');

        el.append(icon, msg);

        let done = false;
        let timer = null;
        const dismiss = () => {
            if (done) return;
            done = true;
            if (timer) clearTimeout(timer);
            el.classList.add('is-leaving');
            el.addEventListener('transitionend', () => el.remove(), { once: true });
            setTimeout(() => el.remove(), 260);
        };

        if (opts.action && typeof opts.action.onClick === 'function') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ui-toast__action';
            btn.textContent = opts.action.label || 'Annuler';
            btn.addEventListener('click', () => {
                try { opts.action.onClick(); } finally { dismiss(); }
            });
            el.appendChild(btn);
        }

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'ui-toast__close';
        close.setAttribute('aria-label', 'Fermer');
        close.appendChild(makeIcon('close'));
        close.addEventListener('click', dismiss);
        el.appendChild(close);

        host.appendChild(el);
        trim();

        if (duration > 0) {
            el.style.setProperty('--ui-toast-duration', duration + 'ms');
            el.classList.add('has-timer');
            timer = setTimeout(dismiss, duration);
            el.addEventListener('mouseenter', () => { if (timer) { clearTimeout(timer); el.classList.add('is-paused'); } });
            el.addEventListener('mouseleave', () => {
                if (done) return;
                el.classList.remove('is-paused');
                timer = setTimeout(dismiss, 1200);
            });
        }

        return { dismiss };
    }

    global.OEIToast = Object.freeze({
        show,
        info:    (m, o) => show(m, { ...o, type: 'info' }),
        success: (m, o) => show(m, { ...o, type: 'success' }),
        warning: (m, o) => show(m, { ...o, type: 'warning' }),
        error:   (m, o) => show(m, { ...o, type: 'error' }),
    });
})(typeof window !== 'undefined' ? window : this);
