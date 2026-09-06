// @ts-check

/**
 * @param {number} seconds
 * @returns {string}
 */
export function formatToolbarTimer(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.trunc(seconds)) : 0;
    const m = String(Math.floor(safe / 60)).padStart(2, '0');
    const sec = String(safe % 60).padStart(2, '0');
    return `⏱ ${m}:${sec}`;
}

/**
 * Initialize viewer toolbar controls in normal (reveal) mode.
 * @param {{
 *   viewerRuntime?: { revealDeck?: { toggleOverview?: () => void } },
 *   wbToggle?: () => void,
 *   openPresenterView?: () => void,
 *   openEditor?: () => void,
 *   documentRef?: Document,
 *   rootElement?: HTMLElement | null,
 *   setIntervalFn?: typeof setInterval,
 *   clearIntervalFn?: typeof clearInterval,
 * }} context
 */
export function initNormalModeToolbar(context = {}) {
    const documentRef = context.documentRef || document;
    const rootElement = context.rootElement || document.documentElement;
    const viewerRuntime = context.viewerRuntime || {};
    const wbToggle = typeof context.wbToggle === 'function' ? context.wbToggle : () => {};
    const openPresenterView = typeof context.openPresenterView === 'function' ? context.openPresenterView : () => {};
    const openEditor = typeof context.openEditor === 'function' ? context.openEditor : () => {};
    const setIntervalFn = typeof context.setIntervalFn === 'function' ? context.setIntervalFn : setInterval;
    const clearIntervalFn = typeof context.clearIntervalFn === 'function' ? context.clearIntervalFn : clearInterval;

    const btnFullscreen = documentRef.getElementById('btn-fullscreen');
    const btnClicker = documentRef.getElementById('btn-clicker');
    const btnOverview = documentRef.getElementById('btn-overview');
    const btnNotes = documentRef.getElementById('btn-notes');
    const btnEditor = documentRef.getElementById('btn-editor');
    const btnFirebase = documentRef.getElementById('btn-firebase');
    const timerEl = documentRef.getElementById('sl-timer');

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) rootElement?.requestFullscreen?.();
        else document.exitFullscreen?.();
    };

    btnFullscreen?.addEventListener('click', toggleFullscreen);

    btnClicker?.addEventListener('click', () => {
        // Get the room peer ID from the presenter panel (populated when room is open)
        const roomId = documentRef.getElementById('rm-room-id-input')?.value.trim() || '';
        const base = new URL('remote.html', location.href).href;
        const remoteUrl = roomId ? `${base}?room=${encodeURIComponent(roomId)}&auto=1` : null;

        // Remove any existing clicker modal
        documentRef.getElementById('sl-clicker-modal')?.remove();

        const modal = documentRef.createElement('div');
        modal.id = 'sl-clicker-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Clicker mobile');
        modal.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)';

        const panel = documentRef.createElement('div');
        panel.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px 28px;max-width:360px;width:90%;color:#e2e8f0;font-family:system-ui,sans-serif;text-align:center;position:relative';

        const close = () => modal.remove();

        if (!roomId) {
            panel.innerHTML = `
                <div style="font-size:1.5rem;margin-bottom:8px;">📱</div>
                <div style="font-weight:700;font-size:1rem;margin-bottom:8px;">Clicker mobile</div>
                <p style="font-size:0.82rem;color:#94a3b8;margin:0 0 16px">Pour utiliser votre téléphone comme télécommande, démarrez d'abord une <strong>Salle étudiants</strong> (bouton Salle dans la toolbar).</p>
                <button id="sl-clicker-close" style="padding:8px 20px;border-radius:6px;background:#3b82f6;border:none;color:#fff;font-weight:600;cursor:pointer">Compris</button>`;
        } else {
            panel.innerHTML = `
                <div style="font-weight:700;font-size:1rem;margin-bottom:4px;">📱 Clicker mobile</div>
                <p style="font-size:0.78rem;color:#94a3b8;margin:0 0 12px">Scannez le QR code avec votre téléphone pour contrôler la présentation.</p>
                <div id="sl-clicker-qr" style="margin:0 auto 12px;width:160px;height:160px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;"></div>
                <a href="${remoteUrl}" target="_blank" style="display:block;font-size:0.72rem;color:#60a5fa;word-break:break-all;margin-bottom:14px;text-decoration:underline">Ouvrir le lien manuellement</a>
                <button id="sl-clicker-close" style="padding:8px 20px;border-radius:6px;background:#475569;border:none;color:#fff;font-weight:600;cursor:pointer">Fermer</button>`;
        }
        modal.appendChild(panel);
        documentRef.body.appendChild(modal);
        documentRef.getElementById('sl-clicker-close')?.addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });

        // Generate QR code if room available
        if (remoteUrl) {
            const qrEl = documentRef.getElementById('sl-clicker-qr');
            if (qrEl && typeof window.qrcode === 'function') {
                const qr = window.qrcode(0, 'M');
                qr.addData(remoteUrl);
                qr.make();
                qrEl.innerHTML = qr.createImgTag(3, 4);
            }
        }
    });
    btnOverview?.addEventListener('click', () => {
        viewerRuntime.revealDeck?.toggleOverview?.();
    });
    btnNotes?.addEventListener('click', () => {
        openPresenterView();
    });
    btnEditor?.addEventListener('click', () => {
        openEditor();
    });
    btnFirebase?.addEventListener('click', () => {
        if (!window.OEIFirebaseModal) return;
        window.OEIFirebaseModal.open({
            mode: 'open',
            onLoad: (data) => {
                try {
                    // Écrire la clé v2 : sinon getRaw (qui ne retombe sur la legacy que si
                    // la clé v2 est null) sert une valeur v2 périmée par-dessus.
                    const json = JSON.stringify(data);
                    if (window.OEIStorage?.setRaw && window.OEIStorage?.KEYS?.PRESENT_DATA) {
                        window.OEIStorage.setRaw(window.OEIStorage.KEYS.PRESENT_DATA, json);
                    } else {
                        localStorage.setItem('oei-v2-slide-present-data', json);
                    }
                    window.location.href = window.location.pathname + '?file=__draft__';
                } catch (e) {
                    alert('Erreur lors du chargement : ' + e.message);
                }
            },
        });
    });

    let timerSeconds = 0;
    let timerRunning = false;
    let timerInterval = null;

    const timerToggle = () => {
        if (!timerEl) return;
        if (timerRunning) {
            if (timerInterval) clearIntervalFn(timerInterval);
            timerRunning = false;
            timerEl.classList.remove('running');
            timerEl.classList.add('paused');
            return;
        }
        timerRunning = true;
        timerEl.classList.remove('paused');
        timerEl.classList.add('running');
        timerInterval = setIntervalFn(() => {
            timerSeconds += 1;
            timerEl.textContent = formatToolbarTimer(timerSeconds);
        }, 1000);
    };

    const timerReset = () => {
        if (!timerEl) return;
        if (timerInterval) clearIntervalFn(timerInterval);
        timerRunning = false;
        timerSeconds = 0;
        timerEl.textContent = formatToolbarTimer(0);
        timerEl.classList.remove('running');
        timerEl.classList.add('paused');
    };

    timerEl?.addEventListener('click', timerToggle);
    if (timerEl && !timerEl.textContent) timerEl.textContent = formatToolbarTimer(0);

    // Modale raccourcis clavier
    const _openShortcutsModal = () => {
        const m = documentRef.getElementById('sl-shortcuts-modal');
        if (m) { m.style.display = 'flex'; }
    };
    const _closeShortcutsModal = () => {
        const m = documentRef.getElementById('sl-shortcuts-modal');
        if (m) { m.style.display = 'none'; }
    };
    documentRef.getElementById('btn-shortcuts-help')?.addEventListener('click', _openShortcutsModal);
    documentRef.getElementById('sl-shortcuts-close')?.addEventListener('click', _closeShortcutsModal);
    documentRef.getElementById('sl-shortcuts-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeShortcutsModal();
    });

    documentRef.addEventListener('keydown', event => {
        const _tag = (event.target?.tagName || '').toLowerCase();
        if (_tag === 'input' || _tag === 'textarea' || _tag === 'select' || event.target?.isContentEditable) return;
        if (event.key === 'Escape') {
            const tb = documentRef.getElementById('sl-toolbar');
            tb?.classList.toggle('force-show');
            _closeShortcutsModal();
            event.preventDefault();
            return;
        }
        if (event.key === '?') { _openShortcutsModal(); return; }
        if (event.key === 'f' || event.key === 'F') toggleFullscreen();
        if (event.key === 'p' || event.key === 'P') openPresenterView();
        if (event.key === 't' || event.key === 'T') timerToggle();
        if (event.key === 'r' || event.key === 'R') timerReset();
        if (event.key === 'w' || event.key === 'W') wbToggle();
        if (event.key === 's' || event.key === 'S') openPresenterView();
    });

    return {
        timerToggle,
        timerReset,
        timerFmt: formatToolbarTimer,
    };
}
