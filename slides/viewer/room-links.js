// @ts-check

/**
 * @param {unknown} value
 * @returns {string}
 */
function asTrimmed(value) {
    return String(value || '').trim();
}

/**
 * @param {string} currentHref
 * @returns {string}
 */
function resolveSlidesBase(currentHref) {
    const baseUrl = new URL(currentHref || 'http://localhost/slides/viewer.html');
    baseUrl.search = '';
    baseUrl.hash = '';
    baseUrl.pathname = baseUrl.pathname.replace(/[^/]*$/, '');
    return baseUrl.toString();
}

/**
 * @param {string} currentHref
 * @param {string} roomId
 */
export function buildRemoteRoomUrl(currentHref, roomId) {
    const base = resolveSlidesBase(currentHref);
    const url = new URL('remote.html', base);
    url.searchParams.set('room', asTrimmed(roomId));
    return url.toString();
}

/**
 * @param {unknown} mode
 * @returns {'auto' | 'relay' | 'p2p'}
 */
export function normalizeTransportMode(mode) {
    const raw = asTrimmed(mode).toLowerCase();
    if (raw === 'relay' || raw === 'p2p') return /** @type {'relay' | 'p2p'} */ (raw);
    return 'auto';
}

/**
 * @param {{
 *   currentHref: string,
 *   roomId: string,
 *   transportMode?: string,
 *   audienceMode?: string,
 *   networkSession?: { buildStudentUrl?: Function } | null,
 *   params?: URLSearchParams | null,
 *   peerOptions?: any,
 *   relayOptions?: any,
 * }} options
 */
export function buildStudentRoomUrl(options) {
    const currentHref = String(options?.currentHref || '');
    const roomId = asTrimmed(options?.roomId);
    const transportMode = normalizeTransportMode(options?.transportMode || 'auto');
    const audienceMode = asTrimmed(options?.audienceMode) || 'display';
    const base = new URL('student.html', resolveSlidesBase(currentHref)).toString();
    const networkSession = options?.networkSession || null;

    if (typeof networkSession?.buildStudentUrl === 'function') {
        return String(networkSession.buildStudentUrl(
            base,
            roomId,
            options?.params || null,
            options?.peerOptions,
            options?.relayOptions,
            { transportMode, audienceMode }
        ) || '');
    }

    const url = new URL(base);
    url.searchParams.set('room', roomId);
    if (transportMode === 'relay' || transportMode === 'p2p') {
        url.searchParams.set('transport', transportMode);
    }
    url.searchParams.set('audienceMode', audienceMode);
    return url.toString();
}

/**
 * Résout le deck d'un viewer ouvert avec `?file=__draft__`.
 *
 * Priorité au **stockage persistant** (`PRESENT_DATA`) : il est écrit juste avant
 * l'ouverture par le geste « Présenter » (éditeur ou accueil), donc frais par
 * construction. `window.opener.__oeiPresentDeck` n'est qu'un **repli** pour le cas
 * où l'écriture localStorage a échoué (gros deck / quota dépassé) — on ne le
 * préfère plus inconditionnellement car c'était une référence potentiellement
 * périmée (F5 du viewer, « Ouvrir depuis Firebase », 2ᵉ fenêtre Présenter :
 * `window.opener` pointe encore l'éditeur avec l'ancien deck).
 *
 * @param {{ openerDeck?: any, readStored?: () => any }} [options]
 * @returns {any|null}
 */
export function resolveDraftDeck(options = {}) {
    const readStored = options && typeof options.readStored === 'function' ? options.readStored : null;
    const stored = readStored ? readStored() : null;
    if (stored && Array.isArray(stored.slides) && stored.slides.length) return stored;

    const openerDeck = options && options.openerDeck;
    try {
        if (openerDeck && Array.isArray(openerDeck.slides) && openerDeck.slides.length) {
            return JSON.parse(JSON.stringify(openerDeck));
        }
    } catch (_) { /* opener cross-origin ou fermé */ }
    return stored || null;
}

/**
 * @param {{
 *   roomActive: boolean,
 *   relayActive: boolean,
 *   relayConfigured: boolean,
 *   relayReconnectAttempts?: number,
 * }} state
 */
export function computeRoomNetworkDiagnostics(state) {
    const roomActive = !!state?.roomActive;
    const relayActive = !!state?.relayActive;
    const relayConfigured = !!state?.relayConfigured;
    const relayAttempts = Math.max(0, Number(state?.relayReconnectAttempts) || 0);
    // Relais configuré mais toujours pas connecté après plusieurs tentatives, salle
    // ouverte → on considère qu'il est injoignable (app supprimée, URL erronée…) et
    // que la salle repose entièrement sur le P2P — souvent bloqué sur eduroam.
    const relayUnreachable = roomActive && relayConfigured && !relayActive && relayAttempts >= 3;

    const transportState = !roomActive ? 'Salle fermée' : (relayActive ? 'P2P + relay' : 'P2P');
    let relayState;
    if (!relayConfigured) relayState = 'Relay non configuré';
    else if (relayActive) relayState = 'Relay connecté';
    else if (relayUnreachable) relayState = 'Relais injoignable';
    else if (roomActive) relayState = 'Relay en reconnexion';
    else relayState = 'Relay prêt';

    let hintText;
    if (relayUnreachable) {
        hintText = 'P2P uniquement — peut échouer sur eduroam / réseau filtré. Redéploiement : docs/developer/RELAY_DEPLOY.md.';
    } else if (relayConfigured) {
        hintText = 'Si certains étudiants sont bloqués (ex: eduroam), partagez le lien "Forcer relay".';
    } else {
        hintText = 'Ajoutez relayWs pour offrir un fallback réseau en plus du P2P.';
    }

    return {
        transportState,
        relayState,
        statusText: relayUnreachable ? 'Relais injoignable — P2P uniquement' : `${transportState} · ${relayState}`,
        hintText,
        relayUnreachable,
    };
}
