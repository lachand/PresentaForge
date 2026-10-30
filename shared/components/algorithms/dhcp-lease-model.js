/**
 * dhcp-lease-model.js - modèle PUR du bail DHCP avec horloge simulée.
 * Aucune dépendance au DOM : la page affiche les événements produits.
 *
 * Alignement sur le cours `reseau/dhcp` (relecture 3a, DH-I1, DH-I2, décision (c)) :
 * - bail de 8 h ; T1 = 50 % (REQUEST en unicast au serveur d'origine), T2 = 87,5 % (REQUEST en broadcast) ;
 * - un renouvellement réussi repart d'un bail complet ; sans réponse jusqu'à la fin du bail, le client
 *   abandonne l'adresse et retombe en APIPA (169.254.x.y) ;
 * - un DISCOVER en broadcast ne franchit pas un routeur sans agent de relais ;
 * - un pool épuisé se traduit par un silence du serveur (pas de DHCPNAK en réponse à un DISCOVER).
 *
 * Bail : { ip, leaseSeconds, grantedAt, state } avec state 'bound' | 'renewing' | 'rebinding' | 'apipa'.
 * Événement : { at, type, detail } avec type 'T1' | 'T2' | 'RENEWED' | 'EXPIRED'.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.OEITrace = Object.assign(window.OEITrace || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DHCP_LEASE_SECONDS = 8 * 3600;

    /** Échéances d'un bail, en secondes depuis son attribution. */
    function dhcpTimers(leaseSeconds) {
        return { t1: Math.round(leaseSeconds * 0.5), t2: Math.round(leaseSeconds * 0.875) };
    }

    /** 3600 -> "1 h 00", 5400 -> "1 h 30". */
    function dhcpFormatDuration(seconds) {
        const s = Math.max(0, Math.round(seconds));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h + ' h ' + String(m).padStart(2, '0');
    }

    /** Adresse APIPA déterministe pour le n-ième poste (169.254.1.0/24 à 169.254.254.255 autorisés). */
    function dhcpApipaAddress(index) {
        return '169.254.' + (10 + (index % 200)) + '.' + (20 + ((index * 37) % 200));
    }

    /** Issue d'un DHCPDISCOVER selon la topologie (serveur d'un autre sous-réseau, joint via un relais). */
    function dhcpDiscoverOutcome(opts) {
        if (opts.rogue) return { result: 'offer', from: 'rogue' };
        if (!opts.relay) return { result: 'timeout', reason: 'no-relay' };
        if (!opts.serverUp) return { result: 'timeout', reason: 'server-down' };
        if (!opts.poolFree) return { result: 'timeout', reason: 'pool-empty' };
        return { result: 'offer', from: 'server' };
    }

    function renewed(lease, at, events, via) {
        lease.grantedAt = at;
        lease.state = 'bound';
        events.push({ at: at, type: 'RENEWED', detail: via });
    }

    /**
     * Fait avancer un bail jusqu'à l'instant `now` (secondes de l'horloge simulée).
     * `serverUp` décrit l'état du serveur pendant tout l'intervalle. Renvoie { lease, events }.
     */
    function dhcpAdvanceLease(lease, now, serverUp) {
        const l = Object.assign({}, lease);
        const events = [];
        for (let guard = 0; guard < 200 && l.state !== 'apipa'; guard++) {
            const t = dhcpTimers(l.leaseSeconds);
            const t1At = l.grantedAt + t.t1;
            const t2At = l.grantedAt + t.t2;
            const endAt = l.grantedAt + l.leaseSeconds;
            if (l.state === 'bound' && now >= t1At) {
                events.push({ at: t1At, type: 'T1', detail: 'unicast' });
                if (serverUp) renewed(l, t1At, events, 'unicast');
                else l.state = 'renewing';
            } else if (l.state === 'renewing' && serverUp) {
                renewed(l, Math.max(now, t1At), events, 'unicast');
            } else if (l.state === 'renewing' && now >= t2At) {
                events.push({ at: t2At, type: 'T2', detail: 'broadcast' });
                l.state = 'rebinding';
            } else if (l.state === 'rebinding' && serverUp) {
                renewed(l, Math.max(now, t2At), events, 'broadcast');
            } else if (l.state === 'rebinding' && now >= endAt) {
                events.push({ at: endAt, type: 'EXPIRED', detail: l.ip });
                l.state = 'apipa';
            } else {
                break;
            }
        }
        return { lease: l, events: events };
    }

    /** Prochaine échéance (T1, T2 ou fin) strictement après `now`, ou null. */
    function dhcpNextDeadline(lease, now) {
        if (lease.state === 'apipa') return null;
        const t = dhcpTimers(lease.leaseSeconds);
        const marks = [lease.grantedAt + t.t1, lease.grantedAt + t.t2, lease.grantedAt + lease.leaseSeconds];
        const next = marks.filter(function (m) { return m > now; });
        return next.length ? Math.min.apply(null, next) : null;
    }

    return {
        DHCP_LEASE_SECONDS: DHCP_LEASE_SECONDS,
        dhcpTimers: dhcpTimers,
        dhcpFormatDuration: dhcpFormatDuration,
        dhcpApipaAddress: dhcpApipaAddress,
        dhcpDiscoverOutcome: dhcpDiscoverOutcome,
        dhcpAdvanceLease: dhcpAdvanceLease,
        dhcpNextDeadline: dhcpNextDeadline
    };
});
