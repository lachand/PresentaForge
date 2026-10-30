/**
 * ip-subnet-engine.js - moteur PUR du calcul CIDR (adresse réseau, broadcast, plage d'hôtes).
 * Aucune dépendance au DOM : la page et le widget de slides ne font qu'afficher le résultat.
 *
 * Cas limites alignés sur le cours `reseau/ip` (relecture 3a, B7, décision (e)) :
 * - /32 : une seule adresse, pas de plage d'hôtes ;
 * - /31 : liaison point à point (RFC 3021), les deux adresses sont des hôtes ;
 * - /30 et en deçà : 2^(32-n) - 2 hôtes, première et dernière adresses réservées.
 *
 * Résultat de ipSubnetAnalyze : { octets, cidr, mask, wildcard, network, broadcast, first, last,
 *   hosts, kind, category } où kind vaut 'standard' | 'point-to-point' | 'single' et first/last
 *   valent null quand il n'y a pas de plage d'hôtes (/32). Les adresses sont des tableaux de 4 octets.
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

    function ipToInt(o) {
        return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
    }

    function intToIp(n) {
        return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    }

    function maskFromCidr(cidr) {
        return cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
    }

    /** "a.b.c.d/n" -> { octets, cidr } ou null si le format est invalide. */
    function ipSubnetParse(input) {
        const parts = String(input).trim().split('/');
        if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1].trim())) return null;
        const cidr = parseInt(parts[1], 10);
        if (cidr < 0 || cidr > 32) return null;
        const octs = parts[0].trim().split('.');
        if (octs.length !== 4) return null;
        const octets = [];
        for (const o of octs) {
            if (!/^\d{1,3}$/.test(o)) return null;
            const n = parseInt(o, 10);
            if (n > 255) return null;
            octets.push(n);
        }
        return { octets: octets, cidr: cidr };
    }

    function inBlock(octets, base, bits) {
        const mask = maskFromCidr(bits);
        return (ipToInt(octets) & mask) >>> 0 === (ipToInt(base) & mask) >>> 0;
    }

    /** Nature de l'adresse : { id, label }. Les plages de documentation sont reconnues à part. */
    function ipAddressCategory(octets) {
        if (inBlock(octets, [10, 0, 0, 0], 8)) return { id: 'private', label: 'Privée (RFC 1918)' };
        if (inBlock(octets, [172, 16, 0, 0], 12)) return { id: 'private', label: 'Privée (RFC 1918)' };
        if (inBlock(octets, [192, 168, 0, 0], 16)) return { id: 'private', label: 'Privée (RFC 1918)' };
        if (inBlock(octets, [127, 0, 0, 0], 8)) return { id: 'loopback', label: 'Bouclage (127.0.0.0/8)' };
        if (inBlock(octets, [169, 254, 0, 0], 16)) return { id: 'link-local', label: 'Lien local (169.254.0.0/16)' };
        if (inBlock(octets, [100, 64, 0, 0], 10)) return { id: 'cgnat', label: 'Partagée, CGNAT (100.64.0.0/10)' };
        if (inBlock(octets, [192, 0, 2, 0], 24) || inBlock(octets, [198, 51, 100, 0], 24) ||
            inBlock(octets, [203, 0, 113, 0], 24)) {
            return { id: 'documentation', label: 'Documentation (réservée aux exemples)' };
        }
        if (inBlock(octets, [224, 0, 0, 0], 4)) return { id: 'multicast', label: 'Multicast (224.0.0.0/4)' };
        if (inBlock(octets, [240, 0, 0, 0], 4)) return { id: 'reserved', label: 'Réservée (240.0.0.0/4)' };
        if (inBlock(octets, [0, 0, 0, 0], 8)) return { id: 'this-network', label: 'Réseau local « ce réseau » (0.0.0.0/8)' };
        return { id: 'public', label: 'Publique' };
    }

    function hostCount(cidr) {
        const hostBits = 32 - cidr;
        if (hostBits === 0) return 1;
        if (hostBits === 1) return 2;
        return Math.pow(2, hostBits) - 2;
    }

    /** Analyse "a.b.c.d/n" (chaîne) ou { octets, cidr } ; null si le format est invalide. */
    function ipSubnetAnalyze(input) {
        const p = typeof input === 'string' ? ipSubnetParse(input) : input;
        if (!p) return null;
        const octets = p.octets;
        const cidr = p.cidr;
        const maskInt = maskFromCidr(cidr);
        const netInt = (ipToInt(octets) & maskInt) >>> 0;
        const bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;
        const hostBits = 32 - cidr;
        let kind = 'standard';
        let first = intToIp(netInt + 1);
        let last = intToIp(bcastInt - 1);
        if (hostBits === 0) {
            kind = 'single';
            first = null;
            last = null;
        } else if (hostBits === 1) {
            kind = 'point-to-point';
            first = intToIp(netInt);
            last = intToIp(bcastInt);
        }
        return {
            octets: octets,
            cidr: cidr,
            mask: intToIp(maskInt),
            wildcard: intToIp((~maskInt) >>> 0),
            network: intToIp(netInt),
            broadcast: intToIp(bcastInt),
            first: first,
            last: last,
            hosts: hostCount(cidr),
            kind: kind,
            category: ipAddressCategory(octets)
        };
    }

    /** Nombres de sous-réseaux proposés (puissances de 2) pour un préfixe : on s'arrête à /30. */
    function ipSubnetCountOptions(cidr) {
        const options = [];
        for (let extra = 1; cidr + extra <= 30; extra++) options.push(Math.pow(2, extra));
        return options;
    }

    /** Découpe le réseau de `input` en n sous-réseaux égaux (n puissance de 2) ; null si impossible. */
    function ipSubnetSplit(input, n) {
        const p = typeof input === 'string' ? ipSubnetParse(input) : input;
        if (!p || !(n >= 2) || (n & (n - 1)) !== 0) return null;
        const newCidr = p.cidr + Math.log2(n);
        if (newCidr > 30) return null;
        const netInt = (ipToInt(p.octets) & maskFromCidr(p.cidr)) >>> 0;
        const size = Math.pow(2, 32 - newCidr);
        const subnets = [];
        for (let i = 0; i < n; i++) {
            const start = (netInt + i * size) >>> 0;
            const end = (start + size - 1) >>> 0;
            subnets.push({
                network: intToIp(start),
                broadcast: intToIp(end),
                first: intToIp(start + 1),
                last: intToIp(end - 1),
                cidr: newCidr
            });
        }
        return { cidr: newCidr, mask: intToIp(maskFromCidr(newCidr)), hostsPerSubnet: size - 2, subnets: subnets };
    }

    return {
        ipToInt: ipToInt,
        intToIp: intToIp,
        ipSubnetParse: ipSubnetParse,
        ipSubnetAnalyze: ipSubnetAnalyze,
        ipAddressCategory: ipAddressCategory,
        ipSubnetCountOptions: ipSubnetCountOptions,
        ipSubnetSplit: ipSubnetSplit
    };
});
