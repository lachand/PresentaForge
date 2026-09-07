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
 * Résout le deck d'un viewer `?file=__draft__`, IndexedDB inclus (gros decks).
 *
 * Le presenter écrit un « stamp » (`<draftKey>-stamp`, minuscule) disant où est le
 * deck frais : `src:'idb'` → deck-blob-store (aucune limite de taille, survit au
 * F5 du viewer / à l'ouverture depuis une autre fenêtre). Repli : `PRESENT_DATA`
 * puis `window.opener.__oeiPresentDeck` (cf. resolveDraftDeck).
 *
 * @param {{
 *   storageGetJSON: (key: string, fallback?: any) => any,
 *   draftKey: string,
 *   blobStore?: { available: () => boolean, get: (id: string) => Promise<any> } | null,
 *   presentBlobId?: string,
 * }} options
 * @returns {Promise<any|null>}
 */
export async function resolveDraftView(options = {}) {
    const getJSON = typeof options?.storageGetJSON === 'function' ? options.storageGetJSON : (() => null);
    const draftKey = String(options?.draftKey || '');
    const blobStore = options?.blobStore || null;
    const blobId = options?.presentBlobId || '__present__';

    let openerDeck = null;
    try { openerDeck = window.opener && window.opener.__oeiPresentDeck; } catch (_) { /* cross-origin */ }
    const openerUsable = openerDeck && Array.isArray(openerDeck.slides) && openerDeck.slides.length;
    const cloneOpener = () => { try { return JSON.parse(JSON.stringify(openerDeck)); } catch (_) { return null; } };

    const stamp = draftKey ? getJSON(`${draftKey}-stamp`, null) : null;
    if (stamp && stamp.src === 'idb' && blobStore && typeof blobStore.available === 'function' && blobStore.available()) {
        try {
            const deck = await blobStore.get(blobId);
            if (deck && Array.isArray(deck.slides) && deck.slides.length) return deck;
        } catch (_) { /* IDB illisible → repli */ }
    }
    // stamp 'opener' : PRESENT_DATA n'a PAS pu être écrit (quota) et le blob n'est
    // pas encore prêt → le deck vivant de la fenêtre parente prime sur un
    // PRESENT_DATA potentiellement périmé.
    if (stamp && stamp.src === 'opener' && openerUsable) {
        const clone = cloneOpener();
        if (clone) return clone;
    }
    return resolveDraftDeck({ openerDeck, readStored: () => (draftKey ? getJSON(draftKey, null) : null) });
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
