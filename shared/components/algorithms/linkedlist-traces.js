/**
 * linkedlist-traces.js — générateurs de trace PURS pour la liste chaînée
 * simple. Une liste y est un simple tableau de valeurs `[v0, v1, …]` (jamais
 * une classe Noeud/ListeChainee à pointeurs) : la sémantique « pointeurs »
 * (prev/current/next) est un fait de VISUALISATION porté par `marks`, pas une
 * structure de données séparée — la valeur pédagogique du pointeur-chasing
 * est dans l'animation, pas dans la représentation mémoire du générateur.
 *
 * Les opérations en O(1) au point d'insertion (ajouter en queue / à une
 * position) restent, comme dans le code d'origine, un commit en un seul pas
 * (pas d'animation de parcours visible) ; ajouter en tête et supprimer
 * gardent leur granularité fine existante (pseudocode ligne à ligne / un pas
 * par nœud parcouru).
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

    function findIndex(values, target) {
        for (let i = 0; i < values.length; i += 1) {
            if (String(values[i]) === String(target)) return i;
        }
        return -1;
    }

    function mk(values, o) {
        const m = o.marks || {};
        const idxArr = (x) => (Array.isArray(x) ? x.slice() : []);
        return {
            i: 0,
            line: o.line || '',
            phase: o.phase || '',
            caption: o.caption || '',
            array: values.slice(),
            marks: {
                current: idxArr(m.current), prev: idxArr(m.prev), next: idxArr(m.next),
                found: idxArr(m.found), entering: idxArr(m.entering), removing: idxArr(m.removing)
            },
            ok: o.ok !== false,
            delay: o.delay || 'normal',
            removedValue: Object.prototype.hasOwnProperty.call(o, 'removedValue') ? o.removedValue : null,
            removedIndex: Object.prototype.hasOwnProperty.call(o, 'removedIndex') ? o.removedIndex : -1
        };
    }

    function finalize(steps) {
        steps.forEach((s, idx) => { s.i = idx; });
        return steps;
    }

    // ── ajouts ───────────────────────────────────────────────────────────────
    function buildListInsertHeadTrace(values, value) {
        const src = values.slice();
        const steps = [];
        steps.push(mk(src, { line: 'ajouterEnTete-line0', phase: 'enter', caption: `ajouterEnTete(liste, ${value}).` }));
        steps.push(mk(src, { line: 'ajouterEnTete-line1', phase: 'create', caption: `nouveau ← créerNœud(${value}).` }));
        steps.push(mk(src, { line: 'ajouterEnTete-line2', phase: 'link', caption: 'nouveau.suivant ← liste.tête.' }));
        const next = [value, ...src];
        steps.push(mk(next, {
            line: 'ajouterEnTete-line3', phase: 'commit',
            caption: `liste.tête ← nouveau — "${value}" ajouté en tête.`,
            marks: { entering: [0], current: [0], next: next.length > 1 ? [1] : [] }
        }));
        return finalize(steps);
    }

    function buildListInsertTailTrace(values, value) {
        const next = values.concat([value]);
        return finalize([mk(next, {
            phase: 'commit', caption: `"${value}" ajouté en queue de liste.`,
            marks: { entering: [next.length - 1] }
        })]);
    }

    function buildListInsertAtTrace(values, value, position) {
        if (!Number.isInteger(position) || position < 0 || position > values.length) {
            return finalize([mk(values, {
                phase: 'invalid', caption: `Position invalide. Choisissez entre 0 et ${values.length}.`, ok: false
            })]);
        }
        const next = values.slice(0, position).concat([value], values.slice(position));
        return finalize([mk(next, {
            phase: 'commit', caption: `"${value}" ajouté à la position ${position}.`,
            marks: { entering: [position] }
        })]);
    }

    // ── suppression (parcours prev/current/next + pseudocode) ────────────────
    function buildListRemoveTrace(values, target) {
        const src = values.slice();
        const idx = findIndex(src, target);
        if (idx === -1) {
            return finalize([mk(src, { phase: 'not-found', caption: `"${target}" non trouvé dans la liste.`, ok: false })]);
        }

        const steps = [];
        steps.push(mk(src, { line: 'supprimer-line1', phase: 'enter', caption: `supprimer(liste, ${target}).` }));

        for (let hop = 0; hop < idx; hop += 1) {
            steps.push(mk(src, {
                line: hop === 0 ? 'supprimer-line6' : 'supprimer-line7', phase: 'hop',
                caption: `Avancer : courant à la position ${hop}.`,
                marks: {
                    current: [hop], prev: hop > 0 ? [hop - 1] : [],
                    next: hop + 1 < src.length ? [hop + 1] : []
                }
            }));
        }

        steps.push(mk(src, {
            line: idx === 0 ? 'supprimer-line3' : 'supprimer-line8', phase: 'commit-preview',
            caption: `Retirer le nœud à la position ${idx} (valeur ${src[idx]}).`,
            marks: {
                removing: [idx], current: [idx],
                prev: idx > 0 ? [idx - 1] : [], next: idx + 1 < src.length ? [idx + 1] : []
            }
        }));

        const removedValue = src[idx];
        const next = src.slice(0, idx).concat(src.slice(idx + 1));
        steps.push(mk(next, {
            line: idx === 0 ? 'supprimer-line4' : 'supprimer-line9', phase: 'return',
            caption: `"${removedValue}" supprimé de la liste (position ${idx}).`,
            removedValue, removedIndex: idx
        }));
        return finalize(steps);
    }

    // ── recherche (parcours prev/current/next, pas de pseudocode dédié) ──────
    function buildListSearchTrace(values, target) {
        const src = values.slice();
        const steps = [];
        for (let i = 0; i < src.length; i += 1) {
            steps.push(mk(src, {
                phase: 'hop', caption: `Comparer courant (position ${i}, valeur ${src[i]}) à "${target}".`,
                marks: { current: [i], prev: i > 0 ? [i - 1] : [], next: i + 1 < src.length ? [i + 1] : [] }
            }));
            if (String(src[i]) === String(target)) {
                steps.push(mk(src, { phase: 'found', caption: `"${target}" trouvé à la position ${i}.`, marks: { found: [i] } }));
                return finalize(steps);
            }
        }
        steps.push(mk(src, { phase: 'not-found', caption: `"${target}" non trouvé dans la liste.`, ok: false }));
        return finalize(steps);
    }

    return {
        buildListInsertHeadTrace,
        buildListInsertTailTrace,
        buildListInsertAtTrace,
        buildListRemoveTrace,
        buildListSearchTrace
    };
});
