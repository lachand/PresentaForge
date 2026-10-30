/**
 * dns-resolver-model.js - modèle PUR d'un résolveur DNS avec cache et horloge simulée.
 * Aucune dépendance au DOM : la page et le widget rejouent les étapes renvoyées.
 *
 * Alignement sur le cours `reseau/dns` (relecture 3a, B4, DN-I1, DN-I2, T3, décisions (b) et (c)) :
 * - zone fictive en plages de documentation (example.org, example.net, 192.0.2.0/24, 198.51.100.0/24,
 *   203.0.113.0/24, 2001:db8::/32) : aucun enregistrement réel ni périmé ;
 * - NXDOMAIN = le nom n'existe pas ; NODATA = le nom existe mais pas le type demandé ;
 * - un CNAME est seul sur son nom ; NS et MX appartiennent au domaine, pas à un hôte ;
 * - le TTL s'écoule avec l'horloge simulée, une seule fois par seconde simulée (plus de minuteurs réels) ;
 * - le cache mémorise aussi les délégations (NS du TLD, NS du domaine) : un deuxième nom du même
 *   domaine ne repasse ni par la racine ni par le TLD.
 *
 * Étape : { from, to, label, text, response, internal } où from/to valent 'client' | 'resolver' |
 * 'root' | 'tld' | 'auth'.
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

    const ROOT_DELEGATION_TTL = 172800;
    const MAX_CNAME_DEPTH = 5;

    function set(ttl, values) {
        return { ttl: ttl, values: values };
    }

    /** Zones fictives : un domaine par zone, enregistrements rattachés au bon nom. */
    function dnsDefaultZones() {
        return {
            'example.org': {
                tld: 'org',
                auth: 'ns1.example.org',
                delegationTtl: 86400,
                names: {
                    'example.org': {
                        A: set(3600, ['192.0.2.10']),
                        AAAA: set(3600, ['2001:db8::10']),
                        MX: set(3600, ['10 mail.example.org']),
                        NS: set(86400, ['ns1.example.org']),
                        TXT: set(3600, ['v=spf1 mx -all'])
                    },
                    'www.example.org': {
                        A: set(3600, ['203.0.113.10']),
                        AAAA: set(3600, ['2001:db8:0:1::10'])
                    },
                    'mail.example.org': { A: set(600, ['192.0.2.25']) },
                    'api.example.org': { A: set(60, ['203.0.113.50']) },
                    'shop.example.org': { CNAME: set(300, ['lb.example.net']) }
                }
            },
            'example.net': {
                tld: 'net',
                auth: 'ns1.example.net',
                delegationTtl: 86400,
                names: {
                    'example.net': {
                        A: set(3600, ['198.51.100.10']),
                        NS: set(86400, ['ns1.example.net'])
                    },
                    'lb.example.net': { A: set(300, ['198.51.100.20']) }
                }
            }
        };
    }

    function dnsCreateWorld() {
        return {
            now: 0,
            zones: dnsDefaultZones(),
            resolvers: {
                A: { cache: [], delegations: {}, stats: { resolves: 0, cacheHits: 0, queries: 0 } },
                B: { cache: [], delegations: {}, stats: { resolves: 0, cacheHits: 0, queries: 0 } }
            }
        };
    }

    function purge(world) {
        Object.keys(world.resolvers).forEach(function (id) {
            const r = world.resolvers[id];
            r.cache = r.cache.filter(function (e) { return e.storedAt + e.ttl > world.now; });
            Object.keys(r.delegations).forEach(function (k) {
                if (r.delegations[k] <= world.now) delete r.delegations[k];
            });
        });
    }

    /** Fait avancer l'horloge simulée ; le TTL baisse une seule fois par seconde simulée. */
    function dnsAdvance(world, seconds) {
        world.now += Math.max(0, seconds);
        purge(world);
    }

    function cacheGet(world, r, name, type) {
        return r.cache.find(function (e) {
            return e.name === name && e.type === type && e.storedAt + e.ttl > world.now;
        }) || null;
    }

    function cachePut(world, r, name, type, ttl, values) {
        r.cache = r.cache.filter(function (e) { return !(e.name === name && e.type === type); });
        r.cache.push({ name: name, type: type, ttl: ttl, values: values.slice(), storedAt: world.now });
    }

    /** Remplace un jeu d'enregistrements dans la zone (scénario de migration). */
    function dnsSetRecord(world, name, type, values) {
        const zoneName = name.split('.').slice(-2).join('.');
        const rrset = world.zones[zoneName].names[name][type];
        rrset.values = values.slice();
    }

    function tldExists(world, tld) {
        return Object.keys(world.zones).some(function (z) { return world.zones[z].tld === tld; });
    }

    function badge(type) {
        return '<span class="record-badge record-' + type + '">' + type + '</span>';
    }

    function lookup(world, rid, name, type, steps, depth, ctx) {
        const r = world.resolvers[rid];
        if (depth > MAX_CNAME_DEPTH) {
            steps.push({ from: 'resolver', to: 'resolver', internal: true, response: true, label: 'SERVFAIL', text: 'Trop d\'alias à la suite : le résolveur abandonne (<strong>SERVFAIL</strong>).' });
            return { rcode: 'SERVFAIL', answers: [], cached: false };
        }

        const hit = cacheGet(world, r, name, type);
        if (hit) {
            steps.push({ from: 'resolver', to: 'resolver', internal: true, response: true, label: 'cache', text: 'Le résolveur trouve <strong>' + name + '</strong> (' + badge(type) + ') dans son <strong>cache</strong> : <code>' + hit.values.join(', ') + '</code> (TTL restant : ' + (hit.storedAt + hit.ttl - world.now) + ' s).' });
            return { rcode: 'NOERROR', answers: hit.values, cached: true };
        }
        if (type !== 'CNAME') {
            const alias = cacheGet(world, r, name, 'CNAME');
            if (alias) {
                steps.push({ from: 'resolver', to: 'resolver', internal: true, response: true, label: 'cache', text: 'Le cache sait que <strong>' + name + '</strong> est un alias de <code>' + alias.values[0] + '</code>.' });
                return lookup(world, rid, alias.values[0], type, steps, depth + 1, ctx);
            }
        }

        const labels = name.split('.');
        const tld = labels[labels.length - 1];
        const zoneName = labels.slice(-2).join('.');

        function ask(server, label, text) {
            ctx.queries += 1;
            r.stats.queries += 1;
            steps.push({ from: 'resolver', to: server, label: label, text: text, response: false });
        }
        function reply(server, label, text) {
            steps.push({ from: server, to: 'resolver', label: label, text: text, response: true });
        }

        if (!r.delegations[zoneName]) {
            if (!r.delegations['.' + tld]) {
                ask('root', name + ' ?', 'Le résolveur ne connaît aucun serveur pour <strong>' + name + '</strong> : il interroge le <strong>serveur racine</strong>.');
                if (!tldExists(world, tld)) {
                    reply('root', 'NXDOMAIN', 'Le serveur racine ne connaît pas le TLD <code>.' + tld + '</code> : réponse <strong>NXDOMAIN</strong> (le nom n\'existe pas).');
                    return { rcode: 'NXDOMAIN', answers: [], cached: false };
                }
                r.delegations['.' + tld] = world.now + ROOT_DELEGATION_TTL;
                reply('root', 'voir .' + tld, 'Le serveur racine ne connaît pas l\'adresse, mais il oriente vers le <strong>serveur TLD</strong> de <code>.' + tld + '</code>. Le résolveur garde cette délégation en cache.');
            } else {
                steps.push({ from: 'resolver', to: 'resolver', internal: true, response: true, label: 'cache', text: 'Le résolveur connaît déjà le serveur du TLD <code>.' + tld + '</code> : il saute la racine.' });
            }
            ask('tld', name + ' ?', 'Le résolveur interroge le <strong>serveur TLD</strong> (<code>.' + tld + '</code>) pour <strong>' + name + '</strong>.');
            const zone = world.zones[zoneName];
            if (!zone || zone.tld !== tld) {
                reply('tld', 'NXDOMAIN', 'Le serveur TLD ne connaît pas le domaine <code>' + zoneName + '</code> : réponse <strong>NXDOMAIN</strong>.');
                return { rcode: 'NXDOMAIN', answers: [], cached: false };
            }
            r.delegations[zoneName] = world.now + zone.delegationTtl;
            reply('tld', 'voir ' + zone.auth, 'Le serveur TLD oriente vers le <strong>serveur autoritaire</strong> de <code>' + zoneName + '</code> (<code>' + zone.auth + '</code>).');
        } else {
            steps.push({ from: 'resolver', to: 'resolver', internal: true, response: true, label: 'cache', text: 'Le résolveur connaît déjà le serveur autoritaire de <code>' + zoneName + '</code> : il saute la racine et le TLD.' });
        }

        const zoneData = world.zones[zoneName];
        ask('auth', type + ' ' + name + ' ?', 'Le résolveur interroge le <strong>serveur autoritaire</strong> de <code>' + zoneName + '</code> pour ' + badge(type) + ' de <strong>' + name + '</strong>.');
        const sets = zoneData.names[name];
        if (!sets) {
            reply('auth', 'NXDOMAIN', 'Le serveur autoritaire ne connaît aucun nom <code>' + name + '</code> : <strong>NXDOMAIN</strong>. Une faute de frappe donne cette réponse.');
            return { rcode: 'NXDOMAIN', answers: [], cached: false };
        }
        if (sets.CNAME && type !== 'CNAME') {
            const target = sets.CNAME.values[0];
            cachePut(world, r, name, 'CNAME', sets.CNAME.ttl, sets.CNAME.values);
            reply('auth', 'CNAME ' + target, '<strong>' + name + '</strong> est un <strong>alias</strong> (' + badge('CNAME') + ') de <code>' + target + '</code> (TTL : ' + sets.CNAME.ttl + ' s). Le résolveur doit maintenant résoudre la cible.');
            return lookup(world, rid, target, type, steps, depth + 1, ctx);
        }
        if (!sets[type]) {
            reply('auth', 'NODATA', 'Le nom <strong>' + name + '</strong> existe, mais n\'a <strong>pas d\'enregistrement ' + type + '</strong> : réponse vide, <strong>NODATA</strong> (ce n\'est pas un NXDOMAIN).');
            return { rcode: 'NOERROR', answers: [], cached: false, nodata: true };
        }
        const rr = sets[type];
        cachePut(world, r, name, type, rr.ttl, rr.values);
        reply('auth', type + ': ' + rr.values[0], 'Le serveur autoritaire répond ' + badge(type) + ' = <code>' + rr.values.join(', ') + '</code> (TTL : ' + rr.ttl + ' s). Le résolveur le met en cache.');
        return { rcode: 'NOERROR', answers: rr.values, cached: false };
    }

    /**
     * Résout `name`/`type` pour le résolveur `rid` ('A' ou 'B').
     * Renvoie { rcode, answers, nodata, fromCache, upstream, steps }.
     */
    function dnsResolve(world, rid, name, type) {
        purge(world);
        const r = world.resolvers[rid];
        const q = String(name).trim().toLowerCase().replace(/\.$/, '');
        const steps = [{ from: 'client', to: 'resolver', label: q + ' ' + type + ' ?', response: false,
            text: 'Le client demande la résolution de <strong>' + q + '</strong> (type ' + badge(type) + ') au résolveur local, en posant une question <strong>récursive</strong> : « débrouille-toi pour me répondre ».' }];
        r.stats.resolves += 1;
        const ctx = { queries: 0 };
        const out = lookup(world, rid, q, type, steps, 0, ctx);
        const fromCache = ctx.queries === 0 && out.rcode === 'NOERROR' && !out.nodata;
        if (fromCache) r.stats.cacheHits += 1;
        let label = out.answers.length ? out.answers[0] : (out.nodata ? 'NODATA' : out.rcode);
        let text;
        if (out.rcode === 'NOERROR' && out.answers.length) text = 'Le résolveur répond au client : <strong>' + q + '</strong> = <code>' + out.answers.join(', ') + '</code>' + (fromCache ? ' (depuis le cache, aucune requête envoyée).' : '.');
        else if (out.nodata) text = 'Le résolveur répond au client : le nom existe, mais pas de ' + type + ' (NODATA).';
        else text = 'Le résolveur répond au client : <strong>' + out.rcode + '</strong>.';
        steps.push({ from: 'resolver', to: 'client', label: label, text: text, response: true });
        return { rcode: out.rcode, answers: out.answers, nodata: !!out.nodata, fromCache: fromCache, upstream: ctx.queries, steps: steps };
    }

    /** Contenu du cache du résolveur `rid`, avec le TTL restant calculé sur l'horloge simulée. */
    function dnsCacheView(world, rid) {
        purge(world);
        return world.resolvers[rid].cache.map(function (e) {
            return { name: e.name, type: e.type, value: e.values.join(', '), ttl: e.ttl, remaining: e.storedAt + e.ttl - world.now };
        });
    }

    /** Durée lisible : 90 -> "1 min 30 s", 3600 -> "1 h". */
    function dnsFormatDuration(seconds) {
        const s = Math.max(0, Math.round(seconds));
        if (s < 60) return s + ' s';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const rest = s % 60;
        const parts = [];
        if (h) parts.push(h + ' h');
        if (m) parts.push(m + ' min');
        if (rest) parts.push(rest + ' s');
        return parts.join(' ');
    }

    return {
        dnsDefaultZones: dnsDefaultZones,
        dnsCreateWorld: dnsCreateWorld,
        dnsAdvance: dnsAdvance,
        dnsSetRecord: dnsSetRecord,
        dnsResolve: dnsResolve,
        dnsCacheView: dnsCacheView,
        dnsFormatDuration: dnsFormatDuration
    };
});
