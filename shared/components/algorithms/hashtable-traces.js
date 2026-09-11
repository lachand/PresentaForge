/**
 * hashtable-traces.js — générateurs de trace PURS pour la table de hachage à
 * chaînage séparé. Une table y est `Bucket[]` (un `Bucket` = `{key,value}[]`),
 * jamais une classe — la mécanique de chaînage (sonder/comparer/insérer/
 * mettre à jour/supprimer) est strictement la même quel que soit le type de
 * clé ; c'est l'ADAPTATEUR qui calcule la valeur brute à hacher (`raw`) :
 *   - page  : hash polynomial d'une clé texte (`polynomialHash`) + méthode
 *             modulo OU multiplication au choix de l'utilisateur, mode 'map'
 *             (une clé déjà présente met à jour sa valeur, jamais de doublon).
 *   - slide : clé numérique directe (`raw = clé`), méthode modulo uniquement,
 *             mode 'multiset' (pas de recherche de doublon — comportement
 *             d'origine du widget, qui traite les entrées comme un sac de
 *             valeurs, pas un dictionnaire).
 * `computeHashInfo` est le point de réduction PARTAGÉ (mod signé-sûr, donc
 * correct pour une clé numérique négative comme pour un hash de chaîne
 * toujours positif) ; les 3 builders ne connaissent que la mécanique de
 * bucket, jamais le calcul du hash lui-même (fourni déjà calculé).
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

    const INSERT_LINES = {
        start: 'ins1', hash: 'ins2', mod: 'ins3', probe: 'ins4', compare: 'ins5',
        update: 'ins6', updateDone: 'ins7', insert: 'ins8', insertDone: 'ins9'
    };
    const SEARCH_LINES = {
        start: 'src1', hash: 'src2', mod: 'src3', probe: 'src4', compare: 'src5',
        found: 'src6', notFound: 'src7'
    };

    /** Hash polynomial d'une clé texte (méthode d'origine : numKey = numKey*31 + charCode). */
    function polynomialHash(key) {
        const s = String(key);
        let numKey = 0;
        for (let i = 0; i < s.length; i += 1) numKey = numKey * 31 + s.charCodeAt(i);
        return numKey;
    }

    /**
     * Réduit une valeur brute à un indice de bucket. `raw` peut être négatif
     * (clé numérique du widget) — la réduction modulo est signée-sûre
     * (`((raw % m) + m) % m`), correcte que `raw` soit déjà positif (page,
     * qui applique `Math.abs` avant d'appeler) ou signé (widget).
     */
    function computeHashInfo(raw, opts = {}) {
        const numBuckets = opts.numBuckets;
        const method = opts.method === 'multiplication' ? 'multiplication' : 'modulo';
        if (method === 'multiplication') {
            const A = 0.6180339887;
            const frac = (Math.abs(raw) * A) % 1;
            return { raw, hash: Math.floor(frac * numBuckets), method, A, frac };
        }
        const hash = ((raw % numBuckets) + numBuckets) % numBuckets;
        return { raw, hash, method };
    }

    function cloneTable(table) {
        return table.map((bucket) => bucket.map((e) => ({ key: e.key, value: e.value })));
    }

    function mk(table, o) {
        const m = o.marks || {};
        return {
            i: 0,
            line: o.line || null,
            phase: o.phase || '',
            caption: o.caption || '',
            key: Object.prototype.hasOwnProperty.call(o, 'key') ? o.key : null,
            table: cloneTable(table),
            marks: {
                activeBucket: m.activeBucket ?? -1,
                indices: (m.indices || []).slice(),
                cls: m.cls || ''
            },
            info: o.info || null,
            ok: o.ok !== false,
            collision: Boolean(o.collision),
            updated: Boolean(o.updated),
            removedValue: Object.prototype.hasOwnProperty.call(o, 'removedValue') ? o.removedValue : null,
            delay: o.delay || 'normal'
        };
    }

    function finalize(steps) {
        steps.forEach((s, idx) => { s.i = idx; });
        return steps;
    }

    /**
     * Insertion. `hashInfo` = `computeHashInfo(raw, {method, numBuckets})` déjà
     * calculé par l'adaptateur. `opts.mode` :
     *   - 'map' (défaut, page)      : sonde le bucket, met à jour si la clé existe.
     *   - 'multiset' (slide)        : n'examine jamais le bucket, insère toujours
     *                                 (comportement d'origine du widget).
     */
    function buildHashInsertTrace(table, key, value, hashInfo, opts = {}) {
        const mode = opts.mode === 'multiset' ? 'multiset' : 'map';
        const work = cloneTable(table);
        const { hash } = hashInfo;
        const steps = [];

        steps.push(mk(work, {
            line: INSERT_LINES.start, phase: 'start', key,
            caption: `Insertion de la clé "${key}".`
        }));
        steps.push(mk(work, {
            line: INSERT_LINES.hash, phase: 'hash', key, info: hashInfo,
            caption: `Hachage("${key}") = ${hashInfo.raw}.`
        }));
        steps.push(mk(work, {
            line: INSERT_LINES.mod, phase: 'mod', key, info: hashInfo,
            caption: `Indice de bucket : ${hash}.`,
            marks: { activeBucket: hash }
        }));

        const bucket = work[hash];
        let matchIndex = -1;
        if (mode === 'map') {
            for (let bi = 0; bi < bucket.length; bi += 1) {
                steps.push(mk(work, {
                    line: INSERT_LINES.probe, phase: 'probe', key, info: hashInfo,
                    caption: `On examine le nœud ${bi + 1} du bucket ${hash}.`,
                    marks: { activeBucket: hash, indices: [bi], cls: 'probe-node' }
                }));
                steps.push(mk(work, {
                    line: INSERT_LINES.compare, phase: 'compare', key, info: hashInfo,
                    caption: `Comparaison avec la clé "${bucket[bi].key}".`,
                    marks: { activeBucket: hash, indices: [bi], cls: 'probe-node' }
                }));
                if (bucket[bi].key === key) { matchIndex = bi; break; }
            }
        }

        if (matchIndex !== -1) {
            bucket[matchIndex].value = value;
            steps.push(mk(work, {
                line: INSERT_LINES.update, phase: 'update', key, info: hashInfo, updated: true,
                caption: `Clé "${key}" déjà présente : mise à jour de la valeur.`,
                marks: { activeBucket: hash, indices: [matchIndex], cls: 'highlight-node' }
            }));
            steps.push(mk(work, {
                line: INSERT_LINES.updateDone, phase: 'update-done', key, info: hashInfo, updated: true,
                caption: `Clé "${key}" mise à jour avec la valeur "${value}".`,
                marks: { activeBucket: hash, indices: [matchIndex], cls: 'highlight-node' }
            }));
        } else {
            const collision = bucket.length > 0;
            bucket.push({ key, value });
            const idx = bucket.length - 1;
            steps.push(mk(work, {
                line: INSERT_LINES.insert, phase: 'insert', key, info: hashInfo, collision, delay: 'quick',
                caption: collision
                    ? `Collision : la clé "${key}" est chaînée dans le bucket ${hash}.`
                    : `Bucket ${hash} libre : insertion de la clé "${key}".`,
                marks: { activeBucket: hash, indices: [idx], cls: 'insert-node' }
            }));
            steps.push(mk(work, {
                line: INSERT_LINES.insertDone, phase: 'insert-done', key, info: hashInfo, collision,
                caption: `Clé "${key}" insérée dans le bucket ${hash}.`,
                marks: { activeBucket: hash, indices: [idx], cls: 'insert-node' }
            }));
        }
        return finalize(steps);
    }

    /** Recherche. `hashInfo` déjà calculé — sonde le bucket nœud par nœud, comme l'insertion en mode 'map'. */
    function buildHashSearchTrace(table, key, hashInfo) {
        const work = cloneTable(table);
        const { hash } = hashInfo;
        const steps = [];

        steps.push(mk(work, {
            line: SEARCH_LINES.start, phase: 'start', key,
            caption: `Recherche de la clé "${key}".`
        }));
        steps.push(mk(work, {
            line: SEARCH_LINES.hash, phase: 'hash', key, info: hashInfo,
            caption: `Hachage("${key}") = ${hashInfo.raw}.`
        }));
        steps.push(mk(work, {
            line: SEARCH_LINES.mod, phase: 'mod', key, info: hashInfo,
            caption: `Indice de bucket : ${hash}.`,
            marks: { activeBucket: hash }
        }));

        const bucket = work[hash];
        for (let bi = 0; bi < bucket.length; bi += 1) {
            steps.push(mk(work, {
                line: SEARCH_LINES.probe, phase: 'probe', key, info: hashInfo,
                caption: `On examine le nœud ${bi + 1} du bucket ${hash}.`,
                marks: { activeBucket: hash, indices: [bi], cls: 'probe-node' }
            }));
            steps.push(mk(work, {
                line: SEARCH_LINES.compare, phase: 'compare', key, info: hashInfo,
                caption: `Comparaison avec la clé "${bucket[bi].key}".`,
                marks: { activeBucket: hash, indices: [bi], cls: 'probe-node' }
            }));
            if (bucket[bi].key === key) {
                steps.push(mk(work, {
                    line: SEARCH_LINES.found, phase: 'found', key, info: hashInfo,
                    caption: `Clé "${key}" trouvée ! Valeur : "${bucket[bi].value}".`,
                    marks: { activeBucket: hash, indices: [bi], cls: 'highlight-node' }
                }));
                return finalize(steps);
            }
        }
        steps.push(mk(work, {
            line: SEARCH_LINES.notFound, phase: 'not-found', key, info: hashInfo, ok: false,
            caption: `Clé "${key}" non trouvée.`,
            marks: { activeBucket: hash }
        }));
        return finalize(steps);
    }

    /** Suppression. Pas de pseudocode dédié dans le cours d'origine (aucune ligne surlignée). */
    function buildHashDeleteTrace(table, key, hashInfo) {
        const work = cloneTable(table);
        const { hash } = hashInfo;
        const steps = [];

        steps.push(mk(work, {
            phase: 'start', key, info: hashInfo,
            caption: `Suppression de la clé "${key}".`,
            marks: { activeBucket: hash }
        }));

        const bucket = work[hash];
        for (let bi = 0; bi < bucket.length; bi += 1) {
            steps.push(mk(work, {
                phase: 'probe', key, info: hashInfo,
                caption: `On examine le nœud ${bi + 1} du bucket ${hash}.`,
                marks: { activeBucket: hash, indices: [bi], cls: 'probe-node' }
            }));
            if (bucket[bi].key === key) {
                const removedValue = bucket[bi].value;
                steps.push(mk(work, {
                    phase: 'delete-preview', key, info: hashInfo, delay: 'quick',
                    caption: `Clé "${key}" trouvée : suppression du nœud.`,
                    marks: { activeBucket: hash, indices: [bi], cls: 'delete-node' }
                }));
                bucket.splice(bi, 1);
                steps.push(mk(work, {
                    phase: 'deleted', key, info: hashInfo, removedValue,
                    caption: `Clé "${key}" supprimée.`,
                    marks: { activeBucket: hash }
                }));
                return finalize(steps);
            }
        }
        steps.push(mk(work, {
            phase: 'not-found', key, info: hashInfo, ok: false,
            caption: `Clé "${key}" non trouvée.`,
            marks: { activeBucket: hash }
        }));
        return finalize(steps);
    }

    return {
        polynomialHash,
        computeHashInfo,
        buildHashInsertTrace,
        buildHashSearchTrace,
        buildHashDeleteTrace
    };
});
