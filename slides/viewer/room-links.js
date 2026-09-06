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
 * Priorité au deck vivant exposé par la fenêtre parente
 * (`window.opener.__oeiPresentDeck`) : toujours à jour et sans la limite de taille
 * de localStorage — les gros decks (images en base64) débordaient silencieusement
 * le quota, si bien que « Présenter » ouvrait un ancien deck ou rien. Repli sur le
 * stockage persistant.
 *
 * @param {{ openerDeck?: any, readStored?: () => any }} [options]
 * @returns {any|null}
 */
export function resolveDraftDeck(options = {}) {
    const openerDeck = options && options.openerDeck;
    try {
        if (openerDeck && Array.isArray(openerDeck.slides)) {
            return JSON.parse(JSON.stringify(openerDeck));
        }
    } catch (_) { /* opener cross-origin ou fermé */ }
    const readStored = options && typeof options.readStored === 'function' ? options.readStored : null;
    return readStored ? readStored() : null;
}

/**
 * @param {{
 *   roomActive: boolean,
 *   relayActive: boolean,
 *   relayConfigured: boolean,
 * }} state
 */
export function computeRoomNetworkDiagnostics(state) {
    const roomActive = !!state?.roomActive;
    const relayActive = !!state?.relayActive;
    const relayConfigured = !!state?.relayConfigured;
    const transportState = !roomActive ? 'Salle fermée' : (relayActive ? 'P2P + relay' : 'P2P');
    const relayState = !relayConfigured
        ? 'Relay non configuré'
        : (relayActive ? 'Relay connecté' : (roomActive ? 'Relay en reconnexion' : 'Relay prêt'));
    const hintText = relayConfigured
        ? 'Si certains étudiants sont bloqués (ex: eduroam), partagez le lien "Forcer relay".'
        : 'Ajoutez relayWs pour offrir un fallback réseau en plus du P2P.';
    return {
        transportState,
        relayState,
        statusText: `${transportState} · ${relayState}`,
        hintText,
    };
}
