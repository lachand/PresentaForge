/**
 * frame-decoder.js - décodeur PUR de trames Ethernet II / IPv4 / TCP, UDP, ICMP.
 * Aucune dépendance au DOM. Chaque trame d'exemple est écrite UNE seule fois, en octets (construite
 * par buildFrame) ; les champs affichés, les tailles, la longueur totale IP et la couche de chaque octet
 * du dump sont DÉRIVÉS par decodeFrame (relecture 3a, B2, TR-I1, TR-I4, décision (a)).
 *
 * - Ethernet : MAC destination, MAC source, EtherType ; étiquette 802.1Q (0x8100) lue sur 18 octets ;
 *   le FCS n'est pas dans une capture ordinaire (retiré par la carte), il est vérifié seulement si
 *   `opts.fcs` est vrai.
 * - IPv4 : IHL variable, drapeaux DF/MF, décalage de fragment : un fragment non initial n'a pas
 *   d'en-tête de transport.
 * - Transport : TCP (longueur d'en-tête variable), UDP, ICMP (écho) avec somme de contrôle vérifiée.
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

    const ETHERTYPES = { 0x0800: 'IPv4', 0x0806: 'ARP', 0x86DD: 'IPv6', 0x8100: '802.1Q (VLAN)' };
    const PROTOCOLS = { 1: 'ICMP', 6: 'TCP', 17: 'UDP' };
    const TCP_FLAGS = [['FIN', 0x01], ['SYN', 0x02], ['RST', 0x04], ['PSH', 0x08], ['ACK', 0x10], ['URG', 0x20]];

    function be16(n) { return [(n >> 8) & 255, n & 255]; }
    function be32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
    function rd16(b, i) { return (b[i] << 8) | b[i + 1]; }
    function rd32(b, i) { return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0; }
    function macBytes(s) { return s.split(':').map(function (h) { return parseInt(h, 16); }); }
    function ipBytes(s) { return s.split('.').map(Number); }
    function macStr(b, i) { return b.slice(i, i + 6).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(':'); }
    function ipStr(b, i) { return b.slice(i, i + 4).join('.'); }
    function hex(n, w) { return '0x' + n.toString(16).padStart(w, '0'); }
    function textBytes(s) { return Array.from(s).map(function (c) { return c.charCodeAt(0); }); }

    /** Somme de contrôle Internet (RFC 1071) : vaut 0 sur un bloc dont la somme est correcte. */
    function internetChecksum(bytes) {
        let sum = 0;
        for (let i = 0; i < bytes.length; i += 2) sum += (bytes[i] << 8) | (i + 1 < bytes.length ? bytes[i + 1] : 0);
        while (sum > 0xFFFF) sum = (sum & 0xFFFF) + (sum >>> 16);
        return (~sum) & 0xFFFF;
    }

    /** CRC-32 (polynôme Ethernet), utilisé pour le FCS. */
    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc ^= bytes[i];
            for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
        return (~crc) >>> 0;
    }

    function pseudoHeader(srcIp, dstIp, proto, length) {
        return srcIp.concat(dstIp, [0, proto], be16(length));
    }

    /** Construit les octets d'une trame à partir d'une description sémantique (sans FCS). */
    function buildFrame(spec) {
        const payload = spec.payload || [];
        let transport = [];
        let proto = 0;
        const src = ipBytes(spec.ip.src);
        const dst = ipBytes(spec.ip.dst);
        if (spec.tcp) {
            proto = 6;
            const t = spec.tcp;
            let flags = 0;
            TCP_FLAGS.forEach(function (f) { if (t.flags.indexOf(f[0]) !== -1) flags |= f[1]; });
            const head = [].concat(be16(t.srcPort), be16(t.dstPort), be32(t.seq), be32(t.ack), be16(0x5000 | flags), be16(t.window), [0, 0], be16(0));
            const seg = head.concat(payload);
            const sum = internetChecksum(pseudoHeader(src, dst, 6, seg.length).concat(seg));
            seg[16] = sum >> 8; seg[17] = sum & 255;
            transport = seg;
        } else if (spec.udp) {
            proto = 17;
            const u = spec.udp;
            const seg = [].concat(be16(u.srcPort), be16(u.dstPort), be16(8 + payload.length), [0, 0], payload);
            const sum = internetChecksum(pseudoHeader(src, dst, 17, seg.length).concat(seg)) || 0xFFFF;
            seg[6] = sum >> 8; seg[7] = sum & 255;
            transport = seg;
        } else if (spec.icmp) {
            proto = 1;
            const c = spec.icmp;
            const seg = [].concat([c.type, c.code || 0, 0, 0], be16(c.id), be16(c.seq), payload);
            const sum = internetChecksum(seg);
            seg[2] = sum >> 8; seg[3] = sum & 255;
            transport = seg;
        }
        const totalLength = 20 + transport.length;
        const ipHead = [].concat([0x45, 0], be16(totalLength), be16(spec.ip.id), be16(spec.ip.df ? 0x4000 : 0), [spec.ip.ttl, proto], [0, 0], src, dst);
        const ipSum = internetChecksum(ipHead);
        ipHead[10] = ipSum >> 8; ipHead[11] = ipSum & 255;
        let eth = [].concat(macBytes(spec.dst), macBytes(spec.src));
        if (spec.vlan) eth = eth.concat(be16(0x8100), be16((spec.vlan.pcp << 13) | spec.vlan.id));
        eth = eth.concat(be16(0x0800));
        return eth.concat(ipHead, transport);
    }

    function flagNames(flags) {
        return TCP_FLAGS.filter(function (f) { return flags & f[1]; }).map(function (f) { return f[0]; });
    }

    /**
     * Décode des octets de trame. Renvoie { total, layers, byteLayers, ethernet, vlan, ip, transport,
     * payload, fcs, unsupported } ; `layers` liste { layer, start, end } dans l'ordre, `byteLayers[i]`
     * donne la couche de l'octet i.
     */
    function decodeFrame(bytes, opts) {
        const o = opts || {};
        const end = o.fcs ? bytes.length - 4 : bytes.length;
        const layers = [];
        const eth = { dest: macStr(bytes, 0), src: macStr(bytes, 6), type: rd16(bytes, 12), size: 14 };
        let vlan = null;
        if (eth.type === 0x8100) {
            const tci = rd16(bytes, 14);
            vlan = { pcp: tci >> 13, id: tci & 0x0FFF };
            eth.tagged = true;
            eth.type = rd16(bytes, 16);
            eth.size = 18;
        }
        eth.typeName = ETHERTYPES[eth.type] || 'inconnu';
        layers.push({ layer: 'ethernet', start: 0, end: eth.size });
        const result = { total: bytes.length, layers: layers, ethernet: eth, vlan: vlan, ip: null, transport: null, payload: null, fcs: null, unsupported: null };

        if (eth.type !== 0x0800) {
            result.unsupported = 'EtherType ' + hex(eth.type, 4) + ' (' + eth.typeName + ') : décodage IPv4 non applicable';
            layers.push({ layer: 'data', start: eth.size, end: end });
        } else {
            const p = eth.size;
            const ihl = (bytes[p] & 15) * 4;
            const flagsFrag = rd16(bytes, p + 6);
            const ip = {
                version: bytes[p] >> 4, ihlBytes: ihl, tos: bytes[p + 1], totalLength: rd16(bytes, p + 2), id: rd16(bytes, p + 4),
                df: !!(flagsFrag & 0x4000), mf: !!(flagsFrag & 0x2000), fragOffset: (flagsFrag & 0x1FFF) * 8,
                ttl: bytes[p + 8], protocol: bytes[p + 9], checksum: rd16(bytes, p + 10), src: ipStr(bytes, p + 12), dest: ipStr(bytes, p + 16), size: ihl
            };
            ip.protocolName = PROTOCOLS[ip.protocol] || 'inconnu';
            ip.checksumOk = internetChecksum(bytes.slice(p, p + ihl)) === 0;
            result.ip = ip;
            layers.push({ layer: 'ip', start: p, end: p + ihl });
            const ipEnd = Math.min(end, p + ip.totalLength);
            const t = p + ihl;
            let payloadStart = t;
            if (ip.fragOffset > 0) {
                result.unsupported = 'Fragment IP non initial (décalage ' + ip.fragOffset + ' octets) : pas d\'en-tête de transport';
            } else if (ip.protocol === 6) {
                const hl = (bytes[t + 12] >> 4) * 4;
                const flags = bytes[t + 13];
                const seg = bytes.slice(t, ipEnd);
                result.transport = {
                    layer: 'tcp', srcPort: rd16(bytes, t), destPort: rd16(bytes, t + 2), seq: rd32(bytes, t + 4), ack: rd32(bytes, t + 8),
                    flags: flagNames(flags), window: rd16(bytes, t + 14), checksum: rd16(bytes, t + 16), urgent: rd16(bytes, t + 18), size: hl,
                    checksumOk: internetChecksum(pseudoHeader(ipBytes(ip.src), ipBytes(ip.dest), 6, seg.length).concat(seg)) === 0
                };
                payloadStart = t + hl;
            } else if (ip.protocol === 17) {
                const seg = bytes.slice(t, ipEnd);
                const sum = rd16(bytes, t + 6);
                result.transport = {
                    layer: 'udp', srcPort: rd16(bytes, t), destPort: rd16(bytes, t + 2), length: rd16(bytes, t + 4), checksum: sum, size: 8,
                    checksumOk: sum === 0 || internetChecksum(pseudoHeader(ipBytes(ip.src), ipBytes(ip.dest), 17, seg.length).concat(seg)) === 0
                };
                payloadStart = t + 8;
            } else if (ip.protocol === 1) {
                const seg = bytes.slice(t, ipEnd);
                const echo = bytes[t] === 8 || bytes[t] === 0;
                result.transport = {
                    layer: 'icmp', type: bytes[t], code: bytes[t + 1], checksum: rd16(bytes, t + 2), id: echo ? rd16(bytes, t + 4) : null,
                    seq: echo ? rd16(bytes, t + 6) : null, size: 8, checksumOk: internetChecksum(seg) === 0
                };
                payloadStart = t + 8;
            } else {
                result.unsupported = 'Protocole IP ' + ip.protocol + ' non décodé';
            }
            if (result.transport) layers.push({ layer: result.transport.layer, start: t, end: payloadStart });
            if (ipEnd > payloadStart) {
                result.payload = { bytes: bytes.slice(payloadStart, ipEnd), size: ipEnd - payloadStart };
                layers.push({ layer: 'data', start: payloadStart, end: ipEnd });
            }
        }
        if (o.fcs) {
            const got = rd32(bytes, end);
            const calc = crc32(bytes.slice(0, end));
            // Le FCS est transmis octet de poids faible en premier.
            const wire = ((calc & 255) << 24 | ((calc >>> 8) & 255) << 16 | ((calc >>> 16) & 255) << 8 | (calc >>> 24)) >>> 0;
            result.fcs = { value: got, ok: got === wire };
            layers.push({ layer: 'fcs', start: end, end: bytes.length });
        }
        result.byteLayers = new Array(bytes.length).fill('data');
        layers.forEach(function (l) { for (let i = l.start; i < l.end; i++) result.byteLayers[i] = l.layer; });
        return result;
    }

    function printable(b) { return b >= 32 && b < 127 ? String.fromCharCode(b) : '.'; }

    /** Dump hexadécimal : lignes de 16 octets { offset, bytes:[{hex, layer}], ascii }. */
    function hexDumpLines(bytes, byteLayers) {
        const lines = [];
        for (let i = 0; i < bytes.length; i += 16) {
            const chunk = bytes.slice(i, i + 16);
            lines.push({
                offset: i.toString(16).padStart(4, '0'),
                bytes: chunk.map(function (b, k) { return { hex: b.toString(16).padStart(2, '0'), layer: byteLayers[i + k] }; }),
                ascii: chunk.map(printable).join('')
            });
        }
        return lines;
    }

    function tcpPortName(p) { return p === 80 ? ' (HTTP)' : p === 443 ? ' (HTTPS)' : ''; }

    /** Couches prêtes à afficher : { id, title, size, fields:[{ name, value, highlight }] }. */
    function describeFrame(d) {
        const out = [];
        const e = d.ethernet;
        const ethFields = [
            { name: 'Adresse MAC destination', value: e.dest },
            { name: 'Adresse MAC source', value: e.src }
        ];
        if (d.vlan) {
            ethFields.push({ name: 'Étiquette 802.1Q', value: 'VLAN ' + d.vlan.id + ', priorité ' + d.vlan.pcp, highlight: true });
        }
        ethFields.push({ name: 'EtherType', value: hex(e.type, 4) + ' (' + e.typeName + ')' });
        out.push({ id: 'ethernet', title: 'Ethernet', size: e.size, fields: ethFields });
        if (d.ip) {
            const ip = d.ip;
            const flags = [ip.df ? 'DF (ne pas fragmenter)' : null, ip.mf ? 'MF (d\'autres fragments suivent)' : null].filter(Boolean).join(', ') || '0';
            out.push({
                id: 'ip', title: 'IP', size: ip.size, fields: [
                    { name: 'Version', value: String(ip.version) },
                    { name: 'IHL', value: ip.ihlBytes / 4 + ' (' + ip.ihlBytes + ' octets)' },
                    { name: 'Type de service', value: hex(ip.tos, 2) },
                    { name: 'Longueur totale', value: ip.totalLength + ' octets (en-tête IP + transport + données)' },
                    { name: 'Identification', value: hex(ip.id, 4) },
                    { name: 'Drapeaux', value: flags },
                    { name: 'Décalage de fragment', value: String(ip.fragOffset) },
                    { name: 'TTL', value: String(ip.ttl), highlight: true },
                    { name: 'Protocole', value: ip.protocol + ' (' + ip.protocolName + ')', highlight: true },
                    { name: 'Somme de contrôle', value: hex(ip.checksum, 4) + (ip.checksumOk ? ' (valide)' : ' (invalide)') },
                    { name: 'Adresse IP source', value: ip.src, highlight: true },
                    { name: 'Adresse IP destination', value: ip.dest, highlight: true }
                ]
            });
        }
        const t = d.transport;
        if (t && t.layer === 'tcp') {
            out.push({
                id: 'tcp', title: 'TCP', size: t.size, fields: [
                    { name: 'Port source', value: String(t.srcPort), highlight: true },
                    { name: 'Port destination', value: t.destPort + tcpPortName(t.destPort), highlight: true },
                    { name: 'Numéro de séquence', value: String(t.seq) },
                    { name: 'Numéro d\'acquittement', value: String(t.ack) },
                    { name: 'Drapeaux', value: t.flags.join(', ') || '-', highlight: true },
                    { name: 'Fenêtre', value: String(t.window) },
                    { name: 'Somme de contrôle', value: hex(t.checksum, 4) + (t.checksumOk ? ' (valide)' : ' (invalide)') },
                    { name: 'Pointeur urgent', value: String(t.urgent) }
                ]
            });
        } else if (t && t.layer === 'udp') {
            out.push({
                id: 'udp', title: 'UDP', size: t.size, fields: [
                    { name: 'Port source', value: String(t.srcPort), highlight: true },
                    { name: 'Port destination', value: t.destPort + (t.destPort === 53 ? ' (DNS)' : ''), highlight: true },
                    { name: 'Longueur', value: t.length + ' octets (en-tête UDP + données)' },
                    { name: 'Somme de contrôle', value: hex(t.checksum, 4) + (t.checksumOk ? ' (valide)' : ' (invalide)') }
                ]
            });
        } else if (t && t.layer === 'icmp') {
            const names = { 8: 'Echo Request (ping)', 0: 'Echo Reply' };
            out.push({
                id: 'icmp', title: 'ICMP', size: t.size, fields: [
                    { name: 'Type', value: t.type + ' (' + (names[t.type] || 'autre') + ')', highlight: true },
                    { name: 'Code', value: String(t.code) },
                    { name: 'Somme de contrôle', value: hex(t.checksum, 4) + (t.checksumOk ? ' (valide)' : ' (invalide)') },
                    { name: 'Identifiant', value: t.id === null ? '-' : String(t.id) },
                    { name: 'Numéro de séquence', value: t.seq === null ? '-' : String(t.seq) }
                ]
            });
        }
        if (d.payload) {
            const text = d.payload.bytes.map(printable).join('');
            out.push({ id: 'data', title: 'Données', size: d.payload.size, fields: [{ name: 'Contenu (ASCII)', value: text }] });
        }
        if (d.fcs) out.push({ id: 'fcs', title: 'FCS', size: 4, fields: [{ name: 'CRC-32', value: hex(d.fcs.value, 8) + (d.fcs.ok ? ' (valide)' : ' (invalide : la carte jetterait la trame)') }] });
        return out;
    }

    function dnsQuery(name) {
        const labels = name.split('.');
        const qname = [].concat.apply([], labels.map(function (l) { return [l.length].concat(textBytes(l)); })).concat([0]);
        return [].concat(be16(0x1234), be16(0x0100), be16(1), be16(0), be16(0), be16(0), qname, be16(1), be16(1));
    }

    const HOST = '00:00:5e:00:53:10';
    const ROUTER = '00:00:5e:00:53:01';
    const HTTP_REQUEST = textBytes('GET / HTTP/1.1\r\nHost: www.example.org\r\n\r\n');
    const HTTP_SPEC = {
        dst: ROUTER, src: HOST,
        ip: { src: '192.168.1.10', dst: '203.0.113.10', id: 0x1234, ttl: 64, df: true },
        tcp: { srcPort: 54321, dstPort: 80, seq: 1001, ack: 2001, flags: ['PSH', 'ACK'], window: 65535 },
        payload: HTTP_REQUEST
    };

    /** Trames d'exemple : { clé: { name, bytes } } ; les octets sont la seule source de vérité. */
    const FRAME_SAMPLES = {
        http: { name: 'Requête HTTP GET', bytes: buildFrame(HTTP_SPEC) },
        dns: {
            name: 'Requête DNS',
            bytes: buildFrame({
                dst: ROUTER, src: HOST,
                ip: { src: '192.168.1.10', dst: '198.51.100.53', id: 0x5678, ttl: 64, df: false },
                udp: { srcPort: 49152, dstPort: 53 },
                payload: dnsQuery('example.org')
            })
        },
        icmp: {
            name: 'Ping (ICMP Echo Request)',
            bytes: buildFrame({
                dst: ROUTER, src: HOST,
                ip: { src: '192.168.1.10', dst: '203.0.113.10', id: 0xabcd, ttl: 64, df: false },
                icmp: { type: 8, code: 0, id: 1234, seq: 1 },
                payload: textBytes('abcdefghijklmnopqrstuvwabcdefghi')
            })
        },
        vlan: {
            name: 'HTTP dans un VLAN (802.1Q)',
            bytes: buildFrame(Object.assign({}, HTTP_SPEC, { vlan: { id: 20, pcp: 0 } }))
        }
    };

    return {
        FRAME_SAMPLES: FRAME_SAMPLES,
        buildFrame: buildFrame,
        decodeFrame: decodeFrame,
        describeFrame: describeFrame,
        hexDumpLines: hexDumpLines,
        internetChecksum: internetChecksum,
        crc32: crc32
    };
});
