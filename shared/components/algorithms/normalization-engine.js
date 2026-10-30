/**
 * normalization-engine.js - moteur PUR de normalisation : dépendances fonctionnelles,
 * fermeture d'attributs, clés candidates, forme normale, couverture minimale,
 * décomposition BCNF, synthèse 3NF, préservation des dépendances.
 * Aucune dépendance au DOM : NormalizationPage ne fait que l'afficher.
 *
 * Règles alignées sur le cours `bdd/normalisation` (relecture 2c, B4, NO-I2, NO-I3) :
 * - les attributs se séparent par des virgules ; quand toutes les lettres d'un mot collé sont
 *   des attributs de la relation, il est lu lettre par lettre (`AB -> C` vaut `A, B -> C`) ;
 * - un attribut inconnu dans une dépendance est signalé (`unknownAttributes`), pas ignoré ;
 * - la BCNF est toujours sans perte mais ne préserve pas toujours les dépendances ;
 *   la synthèse 3NF fait les deux (`preservesDependencies`).
 * Une dépendance : { lhs: string[], rhs: string[] }.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.NormalizationEngine = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // ── Lecture ──
    function parseAttrs(str, universe) {
        const tokens = String(str || '').split(/[,\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!universe) return tokens;
        const known = new Set(universe);
        const out = [];
        tokens.forEach(function (token) {
            const letters = token.split('');
            if (!known.has(token) && letters.length > 1 && letters.every(function (c) { return known.has(c); })) {
                letters.forEach(function (c) { out.push(c); });
            } else {
                out.push(token);
            }
        });
        return out;
    }

    function parseFDs(str, universe) {
        const fds = [];
        const lines = String(str || '').replace(/;/g, '\n').split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const parts = line.split(/\s*(?:->|→)\s*/);
            if (parts.length !== 2) continue;
            const lhs = parseAttrs(parts[0], universe);
            const rhs = parseAttrs(parts[1], universe);
            if (lhs.length && rhs.length) fds.push({ lhs: lhs, rhs: rhs });
        }
        return fds;
    }

    /** Attributs cités dans les dépendances mais absents de la relation. */
    function unknownAttributes(allAttrs, fds) {
        const known = new Set(allAttrs);
        const unknown = new Set();
        fds.forEach(function (fd) {
            fd.lhs.concat(fd.rhs).forEach(function (a) { if (!known.has(a)) unknown.add(a); });
        });
        return Array.from(unknown);
    }

    function setStr(s) { return '{' + Array.from(s).sort().join(', ') + '}'; }
    function arrStr(a) { return a.slice().sort().join(', '); }
    function fdStr(fd) { return arrStr(fd.lhs) + ' → ' + arrStr(fd.rhs); }

    // ── Fermeture ──
    function closure(attrs, fds) {
        const result = new Set(attrs);
        let changed = true;
        const steps = [{ step: 'Init', added: attrs.slice(), result: new Set(result) }];
        while (changed) {
            changed = false;
            for (const fd of fds) {
                if (fd.lhs.every(function (a) { return result.has(a); })) {
                    const newAttrs = fd.rhs.filter(function (a) { return !result.has(a); });
                    if (newAttrs.length) {
                        newAttrs.forEach(function (a) { result.add(a); });
                        steps.push({ step: fdStr(fd), added: newAttrs, result: new Set(result) });
                        changed = true;
                    }
                }
            }
        }
        return { closure: result, steps: steps };
    }

    function isSuperkey(attrs, allAttrs, fds) {
        const cl = closure(attrs, fds);
        return allAttrs.every(function (a) { return cl.closure.has(a); });
    }

    // ── Clés candidates ──
    function findCandidateKeys(allAttrs, fds) {
        const allRHS = new Set();
        const allLHS = new Set();
        for (const fd of fds) {
            fd.rhs.forEach(function (a) { allRHS.add(a); });
            fd.lhs.forEach(function (a) { allLHS.add(a); });
        }
        // Un attribut qui n'est jamais à droite est dans toutes les clés ; jamais à gauche et à droite : dans aucune.
        const mustBeInKey = allAttrs.filter(function (a) { return !allRHS.has(a); });
        const neverInKey = allAttrs.filter(function (a) { return !allLHS.has(a) && allRHS.has(a); });
        const middle = allAttrs.filter(function (a) { return mustBeInKey.indexOf(a) === -1 && neverInKey.indexOf(a) === -1; });

        const keys = [];
        const n = middle.length;
        for (let mask = 0; mask < (1 << n); mask++) {
            const candidate = mustBeInKey.slice();
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) candidate.push(middle[i]);
            }
            if (!isSuperkey(candidate, allAttrs, fds)) continue;
            let isMinimal = true;
            for (const existing of keys) {
                if (existing.every(function (a) { return candidate.indexOf(a) !== -1; })) { isMinimal = false; break; }
            }
            if (isMinimal) {
                for (let i = keys.length - 1; i >= 0; i--) {
                    if (candidate.every(function (a) { return keys[i].indexOf(a) !== -1; })) keys.splice(i, 1);
                }
                keys.push(candidate);
            }
        }
        return keys;
    }

    // ── Formes normales ──
    function checkNormalForm(allAttrs, fds, candidateKeys) {
        const primeAttrs = new Set();
        for (const key of candidateKeys) key.forEach(function (a) { primeAttrs.add(a); });
        const violations = { '2NF': [], '3NF': [], 'BCNF': [] };

        for (const fd of fds) {
            if (fd.rhs.every(function (a) { return fd.lhs.indexOf(a) !== -1; })) continue;
            if (isSuperkey(fd.lhs, allAttrs, fds)) continue;
            violations['BCNF'].push(fd);
            const nonPrimeRHS = fd.rhs.filter(function (a) { return !primeAttrs.has(a) && fd.lhs.indexOf(a) === -1; });
            if (nonPrimeRHS.length > 0) {
                violations['3NF'].push({ fd: fd, nonPrimeRHS: nonPrimeRHS });
                for (const key of candidateKeys) {
                    if (fd.lhs.length < key.length && fd.lhs.every(function (a) { return key.indexOf(a) !== -1; })) {
                        violations['2NF'].push({ fd: fd, key: key, nonPrimeRHS: nonPrimeRHS });
                        break;
                    }
                }
            }
        }
        // '1NF' signifie « au plus 1NF » : l'atomicité des valeurs ne se vérifie pas sur des dépendances.
        if (violations['BCNF'].length === 0) return { form: 'BCNF', violations: violations };
        if (violations['3NF'].length === 0) return { form: '3NF', violations: violations };
        if (violations['2NF'].length === 0) return { form: '2NF', violations: violations };
        return { form: '1NF', violations: violations };
    }

    // ── Couverture minimale et projection ──
    function minimalCover(fds) {
        const result = [];
        for (const fd of fds) {
            for (const a of fd.rhs) result.push({ lhs: fd.lhs.slice(), rhs: [a] });
        }
        for (const fd of result) {
            for (let i = fd.lhs.length - 1; i >= 0; i--) {
                if (fd.lhs.length <= 1) break;
                const reduced = fd.lhs.slice();
                reduced.splice(i, 1);
                const cl = closure(reduced, result);
                if (fd.rhs.every(function (a) { return cl.closure.has(a); })) fd.lhs = reduced;
            }
        }
        for (let i = result.length - 1; i >= 0; i--) {
            const without = result.slice(0, i).concat(result.slice(i + 1));
            const cl = closure(result[i].lhs, without);
            if (result[i].rhs.every(function (a) { return cl.closure.has(a); })) result.splice(i, 1);
        }
        return result;
    }

    function projectFDs(attrs, allFDs) {
        const projected = [];
        const attrSet = new Set(attrs);
        const n = attrs.length;
        for (let mask = 1; mask < (1 << n); mask++) {
            const subset = [];
            for (let i = 0; i < n; i++) {
                if (mask & (1 << i)) subset.push(attrs[i]);
            }
            const cl = closure(subset, allFDs);
            const rhs = Array.from(cl.closure).filter(function (a) { return attrSet.has(a) && subset.indexOf(a) === -1; });
            if (rhs.length) projected.push({ lhs: subset, rhs: rhs });
        }
        return minimalCover(projected);
    }

    // ── Décompositions ──
    function decomposeBCNF(allAttrs, fds) {
        const relations = [{ attrs: allAttrs.slice() }];
        const result = [];
        let safetyCounter = 0;
        while (relations.length > 0 && safetyCounter < 100) {
            safetyCounter++;
            const rel = relations.pop();
            const projectedFDs = projectFDs(rel.attrs, fds);
            let violation = null;
            for (const fd of projectedFDs) {
                if (fd.rhs.every(function (a) { return fd.lhs.indexOf(a) !== -1; })) continue;
                if (!isSuperkey(fd.lhs, rel.attrs, projectedFDs)) { violation = fd; break; }
            }
            if (!violation) {
                result.push({ attrs: rel.attrs, fds: projectedFDs, keys: findCandidateKeys(rel.attrs, projectedFDs) });
                continue;
            }
            // R1 = X⁺ ∩ R ; R2 = R privée de (X⁺ \ X)
            const cl = closure(violation.lhs, projectedFDs);
            const r1Attrs = Array.from(cl.closure).filter(function (a) { return rel.attrs.indexOf(a) !== -1; });
            const r2Attrs = rel.attrs.filter(function (a) { return !cl.closure.has(a) || violation.lhs.indexOf(a) !== -1; });
            relations.push({ attrs: r1Attrs });
            relations.push({ attrs: r2Attrs });
        }
        return result;
    }

    function decompose3NF(allAttrs, fds) {
        const minCover = minimalCover(fds);
        const groups = new Map();
        for (const fd of minCover) {
            const key = fd.lhs.slice().sort().join(',');
            if (!groups.has(key)) groups.set(key, { lhs: fd.lhs, rhs: [] });
            fd.rhs.forEach(function (a) {
                if (groups.get(key).rhs.indexOf(a) === -1) groups.get(key).rhs.push(a);
            });
        }
        let relations = [];
        groups.forEach(function (g) {
            const attrs = Array.from(new Set(g.lhs.concat(g.rhs)));
            const projFDs = projectFDs(attrs, fds);
            relations.push({ attrs: attrs, fds: projFDs, keys: findCandidateKeys(attrs, projFDs) });
        });
        // Une clé de la relation initiale doit figurer dans une relation (jointure sans perte).
        const candidateKeys = findCandidateKeys(allAttrs, fds);
        const keyPreserved = candidateKeys.some(function (key) {
            return relations.some(function (rel) { return key.every(function (a) { return rel.attrs.indexOf(a) !== -1; }); });
        });
        if (!keyPreserved && candidateKeys.length > 0) {
            const key = candidateKeys[0];
            relations.push({ attrs: key.slice(), fds: projectFDs(key, fds), keys: [key] });
        }
        // Une relation contenue dans une autre est redondante.
        relations = relations.filter(function (rel, i) {
            return !relations.some(function (other, j) {
                if (i === j) return false;
                const contained = rel.attrs.every(function (a) { return other.attrs.indexOf(a) !== -1; });
                return contained && (other.attrs.length > rel.attrs.length || j < i);
            });
        });
        return relations;
    }

    /**
     * Les dépendances de `fds` sont-elles retrouvables à partir des seules relations de la
     * décomposition ? Renvoie { preserved, lost } (`lost` : dépendances perdues).
     */
    function preservesDependencies(relations, fds) {
        const lost = [];
        for (const fd of fds) {
            let z = new Set(fd.lhs);
            let changed = true;
            while (changed) {
                changed = false;
                for (const rel of relations) {
                    const inter = Array.from(z).filter(function (a) { return rel.attrs.indexOf(a) !== -1; });
                    const cl = closure(inter, fds).closure;
                    cl.forEach(function (a) {
                        if (rel.attrs.indexOf(a) !== -1 && !z.has(a)) { z.add(a); changed = true; }
                    });
                }
            }
            if (!fd.rhs.every(function (a) { return z.has(a); })) lost.push(fd);
        }
        return { preserved: lost.length === 0, lost: lost };
    }

    return {
        normParseAttrs: parseAttrs,
        normParseFDs: parseFDs,
        normUnknownAttributes: unknownAttributes,
        normSetStr: setStr,
        normFdStr: fdStr,
        normClosure: closure,
        normIsSuperkey: isSuperkey,
        normFindCandidateKeys: findCandidateKeys,
        normCheckNormalForm: checkNormalForm,
        normMinimalCover: minimalCover,
        normProjectFDs: projectFDs,
        normDecomposeBCNF: decomposeBCNF,
        normDecompose3NF: decompose3NF,
        normPreservesDependencies: preservesDependencies
    };
});
