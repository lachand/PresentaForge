/**
 * search-traces.js — générateurs de trace PURS pour la famille « recherche ».
 *
 * `buildSequentialSearchTrace` / `buildBinarySearchTrace` renvoient un `Step[]`
 * sérialisable en JSON, SANS accès DOM. Générique sur le type des valeurs : les
 * comparaisons `<` / `===` / `>` fonctionnent nativement sur des nombres OU des
 * chaînes (recherche dichotomique page = mots FR, widget slide = entiers — même
 * générateur, aucune coercition de type ici, chaque adaptateur fournit ses
 * propres données déjà triées pour la dichotomie).
 *
 * Forme d'un Step :
 * {
 *   i, line, phase, caption,
 *   array:  <valeurs inchangées — la recherche ne mute rien>,
 *   marks:  { current:number[], found:number[], checked:number[],
 *             eliminatedLeft:number[], eliminatedRight:number[], range:[lo,hi]|null },
 *   vars:   { currentIdx, low, high, mid },
 *   delay:  'normal'|'quick',
 *   stats:  { comparisons, cost }   // cost === comparisons dans cette implémentation
 * }
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

    const SEQUENTIAL_LINES = { loop: 'line2', compare: 'line3', found: 'line4', notFound: 'line5' };
    const BINARY_LINES = {
        loopCheck: 'line4', mid: 'line5', compareEq: 'line6', found: 'line7',
        compareLt: 'line8', goRight: 'line9', compareGt: 'line10', goLeft: 'line11', notFound: 'line12'
    };

    function range(lo, hi) {
        const out = [];
        for (let k = lo; k <= hi; k += 1) out.push(k);
        return out;
    }

    function numOrNull(v) {
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }

    /** Accumulateur commun : fige un pas + porte les stats cumulées. */
    class TraceBuilder {
        constructor(values) {
            this.values = values;
            this.steps = [];
            this._stats = { comparisons: 0, cost: 0 };
        }

        bump(patch) {
            const next = Object.assign({}, this._stats);
            Object.keys(patch).forEach((k) => { next[k] = (next[k] || 0) + patch[k]; });
            this._stats = next;
        }

        push(step) {
            const m = step.marks || {};
            const v = step.vars || {};
            const idxArr = (x) => (Array.isArray(x) ? x.slice() : []);
            this.steps.push({
                i: this.steps.length,
                line: step.line || '',
                phase: step.phase || '',
                caption: step.caption || '',
                array: this.values.slice(),
                marks: {
                    current: idxArr(m.current),
                    found: idxArr(m.found),
                    checked: idxArr(m.checked),
                    eliminatedLeft: idxArr(m.eliminatedLeft),
                    eliminatedRight: idxArr(m.eliminatedRight),
                    range: (Array.isArray(m.range) && m.range.length === 2) ? [m.range[0], m.range[1]] : null
                },
                vars: {
                    currentIdx: numOrNull(v.currentIdx),
                    low: numOrNull(v.low),
                    high: numOrNull(v.high),
                    mid: numOrNull(v.mid)
                },
                delay: step.delay || 'normal',
                stats: Object.assign({}, this._stats)
            });
        }

        build() {
            return this.steps;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recherche séquentielle
    // ─────────────────────────────────────────────────────────────────────────
    function buildSequentialSearchTrace(values, target) {
        const a = Array.isArray(values) ? values.slice() : [];
        const n = a.length;
        const t = new TraceBuilder(a);

        t.push({
            line: '', phase: 'start',
            caption: n === 0
                ? 'Tableau vide : rien à chercher.'
                : `Démarrage de la recherche séquentielle (scan de gauche à droite) — cible = ${target}.`
        });

        for (let i = 0; i < n; i += 1) {
            const checked = range(0, i - 1);
            t.push({
                line: SEQUENTIAL_LINES.loop, phase: 'loop',
                caption: `Avancer à l'indice i=${i}.`,
                marks: { current: [i], checked }, vars: { currentIdx: i }
            });

            t.bump({ comparisons: 1, cost: 1 });
            const equal = a[i] === target;
            t.push({
                line: SEQUENTIAL_LINES.compare, phase: 'compare',
                caption: equal
                    ? `Comparer A[${i}]=${a[i]} à la cible=${target} : égalité.`
                    : `Comparer A[${i}]=${a[i]} à la cible=${target} : pas d'égalité, continuer.`,
                marks: { current: [i], checked }, vars: { currentIdx: i }
            });

            if (equal) {
                t.push({
                    line: SEQUENTIAL_LINES.found, phase: 'found',
                    caption: `A[${i}] = cible : trouvé à l'indice ${i}.`,
                    marks: { found: [i], checked }, vars: { currentIdx: i }
                });
                return t.build();
            }
        }

        t.push({
            line: SEQUENTIAL_LINES.notFound, phase: 'not-found',
            caption: 'Fin du tableau atteinte : la cible est absente.',
            marks: { checked: range(0, n - 1) }, vars: { currentIdx: n }
        });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Recherche dichotomique — suppose `values` déjà trié dans l'ordre croissant
    // (numérique ou lexicographique — comparaisons génériques <, ===, >).
    // ─────────────────────────────────────────────────────────────────────────
    function buildBinarySearchTrace(values, target) {
        const a = Array.isArray(values) ? values.slice() : [];
        const n = a.length;
        const t = new TraceBuilder(a);

        let low = 0;
        let high = n - 1;
        const eliminatedLeft = [];
        const eliminatedRight = [];

        t.push({
            line: '', phase: 'start',
            caption: n === 0
                ? 'Tableau vide : rien à chercher.'
                : `Démarrage de la dichotomie : intervalle initial [0..${n - 1}] — cible = ${target}.`,
            vars: { low, high }
        });

        while (low <= high) {
            t.push({
                line: BINARY_LINES.loopCheck, phase: 'loop-check',
                caption: `Intervalle [${low}..${high}] non vide : on continue.`,
                marks: { range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                vars: { low, high }, delay: 'quick'
            });

            const mid = Math.floor((low + high) / 2);
            t.bump({ comparisons: 1, cost: 1 });
            t.push({
                line: BINARY_LINES.mid, phase: 'mid',
                caption: `Calcul du milieu : mid=${mid}, A[mid]=${a[mid]}.`,
                marks: { current: [mid], range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                vars: { low, high, mid }
            });

            t.push({
                line: BINARY_LINES.compareEq, phase: 'compare-eq',
                caption: `Comparer A[mid]=${a[mid]} à la cible=${target}.`,
                marks: { current: [mid], range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                vars: { low, high, mid }
            });

            if (a[mid] === target) {
                t.push({
                    line: BINARY_LINES.found, phase: 'found',
                    caption: `A[mid] = cible : trouvé à l'indice ${mid}.`,
                    marks: { found: [mid], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                    vars: { low, high, mid }
                });
                return t.build();
            }

            if (a[mid] < target) {
                t.push({
                    line: BINARY_LINES.compareLt, phase: 'compare-lt',
                    caption: `A[mid]=${a[mid]} < cible=${target} : la cible est à droite.`,
                    marks: { current: [mid], range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                    vars: { low, high, mid }, delay: 'quick'
                });
                for (let k = low; k <= mid; k += 1) eliminatedLeft.push(k);
                const oldLow = low;
                low = mid + 1;
                t.push({
                    line: BINARY_LINES.goRight, phase: 'go-right',
                    caption: `bas ← ${low}. Exclusion de [${oldLow}..${mid}] ; nouvel intervalle [${low}..${high}].`,
                    marks: { range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                    vars: { low, high }
                });
            } else {
                t.push({
                    line: BINARY_LINES.compareGt, phase: 'compare-gt',
                    caption: `A[mid]=${a[mid]} > cible=${target} : la cible est à gauche.`,
                    marks: { current: [mid], range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                    vars: { low, high, mid }, delay: 'quick'
                });
                for (let k = mid; k <= high; k += 1) eliminatedRight.push(k);
                const oldHigh = high;
                high = mid - 1;
                t.push({
                    line: BINARY_LINES.goLeft, phase: 'go-left',
                    caption: `haut ← ${high}. Exclusion de [${mid}..${oldHigh}] ; nouvel intervalle [${low}..${high}].`,
                    marks: { range: [low, high], eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
                    vars: { low, high }
                });
            }
        }

        t.push({
            line: BINARY_LINES.notFound, phase: 'not-found',
            caption: 'bas > haut : intervalle vide, la cible est absente.',
            marks: { eliminatedLeft: eliminatedLeft.slice(), eliminatedRight: eliminatedRight.slice() },
            vars: { low, high }
        });
        return t.build();
    }

    return {
        SEARCH_TRACE_LINES: { sequential: SEQUENTIAL_LINES, binary: BINARY_LINES },
        buildSequentialSearchTrace,
        buildBinarySearchTrace
    };
});
