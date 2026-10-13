// @ts-check

/**
 * presenter-session-guards.js — garde-fous de la séance côté présentateur
 * (audit UX 2026-10, sprint 1 : docs/developer/PRESENTAFORGE_AUDIT_UX_2026-10.md).
 * Sans accès global implicite : document / window / toast sont injectés.
 *
 *  - openAudienceWindow      P-A1 fenêtre projecteur bloquée → toast + réouverture sur clic
 *  - createSessionParticipantLog  G5 étudiants déconnectés conservés pour le Bilan
 *  - bindRoomOpenCloseButtons     R-C1/R-C2 ouvrir / fermer la salle (fermeture en 2 temps)
 *  - bindLeaveGuard               R-D6 confirmation avant de quitter avec la salle active
 */

/**
 * @typedef {{ show: (msg: string, opts?: any) => unknown }} ToastApi
 */

/**
 * Ouvre la fenêtre projecteur. L'ouverture a lieu après le chargement du deck, hors
 * geste utilisateur : le navigateur la bloque souvent. On le signale par un toast
 * persistant dont l'action rouvre la fenêtre (cette fois dans un geste utilisateur).
 * @param {string} url
 * @param {{ windowRef?: Window, toast?: ToastApi | null, name?: string }} [opts]
 * @returns {Window | null}
 */
export function openAudienceWindow(url, opts = {}) {
    const win = opts.windowRef || window;
    const name = opts.name || 'oei-audience';
    const open = () => win.open(url, name);
    const first = open();
    if (first && !first.closed) return first;
    opts.toast?.show('Le navigateur a bloqué la fenêtre de l\'écran projeté.', {
        type: 'warning',
        duration: 0,
        action: {
            label: 'Ouvrir l\'écran projeté',
            onClick: () => {
                const retry = open();
                if (!retry || retry.closed) {
                    opts.toast?.show('Fenêtre toujours bloquée : autorisez les fenêtres pop-up pour ce site, puis réessayez.', { type: 'error', duration: 10000 });
                }
            },
        },
    });
    return null;
}

/**
 * Journal des étudiants passés par la salle. Garde des RÉFÉRENCES aux records de
 * `room.students` (les scores y sont mis à jour en place) : un étudiant déconnecté
 * disparaît de `room.students` mais reste dans le Bilan et le classement.
 * Reconnexion = nouveau peerId pour le même prénom : on garde le record le plus avancé.
 */
export function createSessionParticipantLog() {
    /** @type {Map<string, any>} */
    const byPeer = new Map();
    return {
        /** @param {string} peerId @param {any} record */
        track(peerId, record) {
            if (peerId && record && typeof record === 'object') byPeer.set(String(peerId), record);
        },
        /** @returns {any[]} */
        list() {
            /** @type {Map<string, any>} */
            const byName = new Map();
            for (const rec of byPeer.values()) {
                const key = String(rec?.pseudo || '').trim().toLowerCase() || `#${byName.size}`;
                const prev = byName.get(key);
                if (!prev || (Number(rec.quizCount) || 0) >= (Number(prev.quizCount) || 0)) byName.set(key, rec);
            }
            return [...byName.values()];
        },
        get size() { return byPeer.size; },
    };
}

/**
 * Boutons « Ouvrir la salle » / « Fermer la salle » de la modale salle (tous modes).
 * Fermeture en 2 temps : 1er clic → « Confirmer… » pendant `confirmMs`.
 * @param {{
 *   documentRef?: Document,
 *   isActive: () => boolean,
 *   isConnecting: () => boolean,
 *   getStudentCount: () => number,
 *   onOpen: () => unknown,
 *   onClose: () => void,
 *   confirmMs?: number,
 * }} ctx
 */
export function bindRoomOpenCloseButtons(ctx) {
    const doc = ctx.documentRef || document;
    const openBtn = doc.getElementById('rm-room-open');
    const closeBtn = doc.getElementById('rm-room-close');
    const confirmMs = Number.isFinite(ctx.confirmMs) ? Number(ctx.confirmMs) : 4000;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;
    const resetClose = () => {
        if (!closeBtn) return;
        delete closeBtn.dataset.confirm;
        closeBtn.textContent = 'Fermer la salle';
    };
    openBtn?.addEventListener('click', () => {
        if (ctx.isActive() || ctx.isConnecting()) return;
        ctx.onOpen();
    });
    closeBtn?.addEventListener('click', () => {
        if (!ctx.isActive()) return;
        if (closeBtn.dataset.confirm !== '1') {
            const n = Math.max(0, Number(ctx.getStudentCount()) || 0);
            closeBtn.dataset.confirm = '1';
            closeBtn.textContent = n > 0 ? `Confirmer : déconnecter ${n} étudiant${n > 1 ? 's' : ''}` : 'Confirmer la fermeture';
            if (timer) clearTimeout(timer);
            timer = setTimeout(resetClose, confirmMs);
            return;
        }
        if (timer) clearTimeout(timer);
        resetClose();
        ctx.onClose();
    });
}

/**
 * Confirmation navigateur avant F5 / fermeture de l'onglet présentateur quand
 * `shouldWarn()` (salle active) — questions, mains levées et scores seraient perdus.
 * @param {{ windowRef?: Window, shouldWarn: () => boolean }} ctx
 * @returns {{ allowExit: () => void }} — à appeler avant une sortie volontaire
 */
export function bindLeaveGuard(ctx) {
    const win = ctx.windowRef || window;
    let allowed = false;
    win.addEventListener('beforeunload', (ev) => {
        if (allowed || !ctx.shouldWarn()) return;
        ev.preventDefault();
        ev.returnValue = '';
    });
    return { allowExit: () => { allowed = true; } };
}
