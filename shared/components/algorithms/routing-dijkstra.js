/**
 * routing-dijkstra.js - moteur PUR du routage à état de liens : Dijkstra pas à pas, tables de routage,
 * panne de lien, recherche du plus long préfixe. Aucune dépendance au DOM.
 *
 * Alignement sur le cours `reseau/routage` (relecture 3a, B5, RO-I2, RO-I3, décision (d)) :
 * - les trois topologies du simulateur vivent ici, avec un préfixe LAN par routeur ;
 * - Dijkstra s'arrête dès que la destination est extraite de la file (arrêt anticipé, annoncé dans
 *   le pseudo-code) ; sans destination il va jusqu'à la file vide pour construire les tables ;
 * - les coûts sont positifs ; une panne de lien retire l'arête puis relance le calcul ;
 * - à égalité de longueur de préfixe, la route de plus petite métrique l'emporte.
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

    function node(id, name, x, y) {
        const n = parseInt(id.slice(1), 10);
        return { id: id, label: id, name: name, x: x, y: y, prefix: '10.0.' + n + '.0/24' };
    }

    function edge(from, to, weight) {
        return { from: from, to: to, weight: weight };
    }

    const ROUTING_TOPOLOGIES = {
        campus: {
            nodes: [
                node('R1', 'Bâtiment A', 120, 80), node('R2', 'Bâtiment B', 380, 60), node('R3', 'Serveurs', 650, 100),
                node('R4', 'Bâtiment C', 120, 340), node('R5', 'Coeur réseau', 380, 230), node('R6', 'Bâtiment D', 650, 350),
                node('R7', 'Passerelle', 380, 400)
            ],
            edges: [
                edge('R1', 'R2', 4), edge('R1', 'R4', 2), edge('R1', 'R5', 5), edge('R2', 'R3', 3), edge('R2', 'R5', 1),
                edge('R3', 'R6', 6), edge('R4', 'R5', 3), edge('R4', 'R7', 4), edge('R5', 'R6', 2), edge('R5', 'R7', 3),
                edge('R6', 'R7', 5)
            ]
        },
        entreprise: {
            nodes: [
                node('R1', 'Accueil', 100, 200), node('R2', 'Étage 1', 280, 80), node('R3', 'Étage 2', 280, 340),
                node('R4', 'Data Center', 500, 80), node('R5', 'DMZ', 500, 340), node('R6', 'Firewall', 700, 200)
            ],
            edges: [
                edge('R1', 'R2', 2), edge('R1', 'R3', 3), edge('R2', 'R3', 5), edge('R2', 'R4', 1), edge('R3', 'R5', 2),
                edge('R4', 'R5', 4), edge('R4', 'R6', 3), edge('R5', 'R6', 1), edge('R1', 'R6', 10)
            ]
        },
        internet: {
            nodes: [
                node('R1', 'Paris', 180, 120), node('R2', 'Londres', 120, 300), node('R3', 'Berlin', 440, 60),
                node('R4', 'Madrid', 350, 350), node('R5', 'Rome', 600, 280), node('R6', 'Amsterdam', 350, 180),
                node('R7', 'Zurich', 650, 100)
            ],
            edges: [
                edge('R1', 'R2', 3), edge('R1', 'R6', 2), edge('R1', 'R3', 7), edge('R2', 'R4', 8), edge('R2', 'R6', 4),
                edge('R3', 'R6', 3), edge('R3', 'R7', 2), edge('R4', 'R5', 5), edge('R4', 'R6', 6), edge('R5', 'R7', 3),
                edge('R5', 'R6', 4), edge('R6', 'R7', 5)
            ]
        }
    };

    function routingNeighbors(topo, id) {
        const out = [];
        topo.edges.forEach(function (e) {
            if (e.from === id) out.push({ node: e.to, weight: e.weight });
            if (e.to === id) out.push({ node: e.from, weight: e.weight });
        });
        return out;
    }

    /** Topologie sans le lien a-b (panne) ; la topologie d'origine n'est pas modifiée. */
    function routingWithoutLink(topo, a, b) {
        return {
            nodes: topo.nodes,
            edges: topo.edges.filter(function (e) {
                return !((e.from === a && e.to === b) || (e.from === b && e.to === a));
            })
        };
    }

    function dijkstraInit(topo, source) {
        const dist = {};
        const prev = {};
        topo.nodes.forEach(function (n) { dist[n.id] = Infinity; prev[n.id] = null; });
        dist[source] = 0;
        return {
            source: source, dist: dist, prev: prev, visited: new Set(), pq: [{ node: source, dist: 0 }],
            visitedEdges: [], current: null, finished: false, stepCount: 0
        };
    }

    /**
     * Une étape : extrait le routeur de plus petite distance de la file et relâche ses voisins.
     * Renvoie { type: 'empty' | 'reached' | 'processed', node, relaxed:[{node, dist}] } et fait
     * avancer `state`. Avec `dest` donné, s'arrête dès que `dest` est extrait (arrêt anticipé).
     */
    function dijkstraStep(topo, state, dest) {
        if (state.finished) return { type: 'empty', node: null, relaxed: [] };
        for (;;) {
            if (state.pq.length === 0) {
                state.finished = true;
                return { type: 'empty', node: null, relaxed: [] };
            }
            state.pq.sort(function (a, b) { return a.dist - b.dist; });
            const current = state.pq.shift();
            if (state.visited.has(current.node)) continue;
            state.current = current.node;
            state.visited.add(current.node);
            state.stepCount += 1;
            if (dest && current.node === dest) {
                state.finished = true;
                return { type: 'reached', node: current.node, relaxed: [] };
            }
            const relaxed = [];
            routingNeighbors(topo, current.node).forEach(function (nb) {
                if (state.visited.has(nb.node)) return;
                const nd = state.dist[current.node] + nb.weight;
                state.visitedEdges.push([current.node, nb.node]);
                if (nd < state.dist[nb.node]) {
                    state.dist[nb.node] = nd;
                    state.prev[nb.node] = current.node;
                    state.pq.push({ node: nb.node, dist: nd });
                    relaxed.push({ node: nb.node, dist: nd });
                }
            });
            return { type: 'processed', node: current.node, relaxed: relaxed };
        }
    }

    /** Chemin source -> dest d'après `state.prev`, ou null si dest est inatteignable. */
    function dijkstraPath(state, dest) {
        if (state.dist[dest] === Infinity) return null;
        const path = [];
        let cur = dest;
        while (cur !== null) { path.unshift(cur); cur = state.prev[cur]; }
        return path;
    }

    /** Dijkstra complet (jusqu'à la file vide) depuis `source`. */
    function dijkstraAll(topo, source) {
        const state = dijkstraInit(topo, source);
        while (!state.finished) dijkstraStep(topo, state, null);
        return state;
    }

    /** Tables de routage de tous les routeurs : { R1: [{ dest, prefix, nextHop, cost, iface }], ... }. */
    function routingTables(topo) {
        const tables = {};
        topo.nodes.forEach(function (n) {
            const state = dijkstraAll(topo, n.id);
            tables[n.id] = topo.nodes.filter(function (d) { return d.id !== n.id; }).map(function (d) {
                const path = dijkstraPath(state, d.id);
                const nextHop = path && path.length >= 2 ? path[1] : '-';
                return {
                    dest: d.id,
                    prefix: d.prefix,
                    nextHop: nextHop,
                    cost: state.dist[d.id] === Infinity ? '-' : state.dist[d.id],
                    iface: nextHop !== '-' ? 'eth-' + nextHop.toLowerCase() : '-'
                };
            });
        });
        return tables;
    }

    /** Compare deux tables d'un même routeur : statut 'same' | 'changed'. */
    function routingDiff(before, after) {
        const byDest = {};
        before.forEach(function (r) { byDest[r.dest] = r; });
        return after.map(function (r) {
            const b = byDest[r.dest] || null;
            const same = b && b.nextHop === r.nextHop && b.cost === r.cost && b.iface === r.iface;
            return { dest: r.dest, prefix: r.prefix, before: b, after: r, status: !b ? 'new' : (same ? 'same' : 'changed') };
        });
    }

    function parseIp(ip) {
        const p = String(ip).split('.').map(Number);
        return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
    }

    /**
     * Recherche du plus long préfixe : routes = [{ prefix: '10.1.0.0/16', nextHop, metric }], ip = 'a.b.c.d'.
     * Renvoie la route retenue ou null ; à longueur égale, la plus petite métrique l'emporte.
     * La route par défaut 0.0.0.0/0 couvre toute adresse mais perd contre tout préfixe plus long.
     */
    function lpmLookup(routes, ip) {
        const target = parseIp(ip);
        let best = null;
        let bestLen = -1;
        routes.forEach(function (route) {
            const parts = route.prefix.split('/');
            const len = parseInt(parts[1], 10);
            const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
            if (((parseIp(parts[0]) & mask) >>> 0) !== ((target & mask) >>> 0)) return;
            const metric = route.metric === undefined ? 0 : route.metric;
            if (len > bestLen || (len === bestLen && metric < (best.metric === undefined ? 0 : best.metric))) {
                best = route;
                bestLen = len;
            }
        });
        return best;
    }

    return {
        ROUTING_TOPOLOGIES: ROUTING_TOPOLOGIES,
        routingNeighbors: routingNeighbors,
        routingWithoutLink: routingWithoutLink,
        dijkstraInit: dijkstraInit,
        dijkstraStep: dijkstraStep,
        dijkstraPath: dijkstraPath,
        dijkstraAll: dijkstraAll,
        routingTables: routingTables,
        routingDiff: routingDiff,
        lpmLookup: lpmLookup
    };
});
