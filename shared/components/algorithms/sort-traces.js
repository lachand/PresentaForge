/**
 * sort-traces.js — générateurs de trace PURS pour la famille « tri ».
 *
 * Chaque `buildXxxTrace(input, opts)` renvoie un `Step[]` sérialisable en JSON,
 * SANS aucun accès DOM. La même trace alimente l'adaptateur page
 * (SimulationPage + TracePlayer) et l'adaptateur slide (*Widget). La génération
 * de tableau aléatoire vit dans l'adaptateur : ces fonctions sont déterministes.
 *
 * Forme d'un Step :
 * {
 *   i:        number,                 // index du pas (0-based)
 *   line:     string,                 // lineId symbolique = une valeur de pseudocode[].lineIds
 *   phase:    string,                 // libellé machine (compare|swap-fly|swap-settle|shift|…)
 *   caption:  string,                 // narration FR complète
 *   array:    number[],               // instantané du tableau APRÈS la mutation du pas
 *   marks:    { compare:number[], swap:number[], sorted:number[], active:number[] },
 *   vars:     { i:number|null, j:number|null, minIndex:number|null, key:number|null },
 *   delay:    'normal'|'swap'|'postswap'|'half',   // indice de temporisation pour l'adaptateur
 *   anim:     'swap'|null,            // l'adaptateur page joue l'animation CSS de permutation
 *   insertion:{ key:number, targetIndex:number }|null,   // puce « key= » du tri par insertion
 *   stats:    { comparisons:number, writes:number, swaps:number }   // cumulés, monotones
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

    // ── Identifiants de lignes pseudocode (doivent exister dans data/content/tri/*.json) ──
    const BUBBLE_LINES = {
        outer: 'bubble-line0',
        innerFor: 'bubble-line1',
        compare: 'bubble-line2',
        swap: 'bubble-line3',
        innerEnd: 'bubble-line5',
        done: 'bubble-line6'
    };
    const INSERTION_LINES = {
        outer: 'insertion-line0',
        takeKey: 'insertion-line1',
        initJ: 'insertion-line2',
        whileCond: 'insertion-line3',
        shift: 'insertion-line4',
        decrJ: 'insertion-line5',
        place: 'insertion-line7',
        done: 'insertion-line8'
    };
    const SELECTION_LINES = {
        outer: 'selection-line0',
        initMin: 'selection-line1',
        inner: 'selection-line2',
        compare: 'selection-line3',
        newMin: 'selection-line4',
        swapCond: 'selection-line7',
        swap: 'selection-line8',
        done: 'selection-line10'
    };

    function range(lo, hi) {
        const out = [];
        for (let k = lo; k < hi; k += 1) out.push(k);
        return out;
    }

    function numOrNull(v) {
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }

    /** Accumulateur : fige un instantané du tableau vivant à chaque pas + porte les stats. */
    class TraceBuilder {
        constructor(liveArray) {
            this.a = liveArray;
            this.steps = [];
            this._stats = { comparisons: 0, writes: 0, swaps: 0 };
        }

        bump(patch) {
            const next = Object.assign({}, this._stats);
            Object.keys(patch).forEach((k) => { next[k] = (next[k] || 0) + patch[k]; });
            this._stats = next;
        }

        setStat(key, value) {
            if (this._stats[key] !== value) {
                this._stats = Object.assign({}, this._stats, { [key]: value });
            }
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
                array: (step.array || this.a).slice(),
                marks: {
                    compare: idxArr(m.compare),
                    swap: idxArr(m.swap),
                    sorted: idxArr(m.sorted),
                    active: idxArr(m.active),
                    pivot: idxArr(m.pivot),
                    range: (Array.isArray(m.range) && m.range.length === 2)
                        ? [m.range[0], m.range[1]] : null
                },
                vars: {
                    i: numOrNull(v.i),
                    j: numOrNull(v.j),
                    minIndex: numOrNull(v.minIndex),
                    key: numOrNull(v.key)
                },
                view: step.view ? JSON.parse(JSON.stringify(step.view)) : null,
                delay: step.delay || 'normal',
                anim: step.anim || null,
                insertion: step.insertion
                    ? { key: Number(step.insertion.key), targetIndex: Number(step.insertion.targetIndex) }
                    : null,
                stats: Object.assign({}, this._stats)
            });
        }

        build() {
            return this.steps;
        }
    }

    function toNumbers(input) {
        return (Array.isArray(input) ? input : []).map(Number).filter((n) => Number.isFinite(n));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri à bulles
    // ─────────────────────────────────────────────────────────────────────────
    function buildBubbleTrace(input) {
        const a = toNumbers(input);
        const n = a.length;
        const t = new TraceBuilder(a);
        const suffixSorted = (i) => range(n - i, n);

        t.push({
            line: '', phase: 'start',
            caption: n < 2 ? 'Tableau déjà trié (0 ou 1 élément).' : 'Démarrage du tri à bulles.',
            marks: { sorted: n < 2 ? range(0, n) : [] }
        });

        for (let i = 0; i < n - 1; i += 1) {
            const sorted = suffixSorted(i);
            t.push({
                line: BUBBLE_LINES.outer, phase: 'pass',
                caption: `Passe ${i + 1} : le plus grand élément de la zone non triée va remonter en fin.`,
                marks: { sorted }, vars: { i }
            });

            for (let j = 0; j < n - i - 1; j += 1) {
                t.bump({ comparisons: 1 });
                const willSwap = a[j] > a[j + 1];
                t.push({
                    line: BUBBLE_LINES.compare, phase: 'compare',
                    caption: willSwap
                        ? `Comparer a[${j}]=${a[j]} et a[${j + 1}]=${a[j + 1]} : ${a[j]} > ${a[j + 1]}, il faut échanger.`
                        : `Comparer a[${j}]=${a[j]} et a[${j + 1}]=${a[j + 1]} : ${a[j]} ≤ ${a[j + 1]}, rien à faire.`,
                    marks: { compare: [j, j + 1], sorted }, vars: { i, j }
                });

                if (willSwap) {
                    t.push({
                        line: BUBBLE_LINES.swap, phase: 'swap-fly',
                        caption: `Échanger a[${j}]=${a[j]} et a[${j + 1}]=${a[j + 1]}.`,
                        marks: { swap: [j, j + 1], sorted }, vars: { i, j },
                        anim: 'swap', delay: 'swap'
                    });
                    const tmp = a[j]; a[j] = a[j + 1]; a[j + 1] = tmp;
                    t.bump({ writes: 2, swaps: 1 });
                    t.push({
                        line: BUBBLE_LINES.swap, phase: 'swap-settle',
                        caption: `a[${j}] et a[${j + 1}] sont échangés.`,
                        marks: { sorted }, vars: { i, j },
                        delay: 'postswap'
                    });
                }
            }

            t.push({
                line: BUBBLE_LINES.innerEnd, phase: 'pass-end',
                caption: `Fin de la passe ${i + 1} : l'indice ${n - i - 1} est définitivement placé.`,
                marks: { sorted: suffixSorted(i + 1) }, vars: { i }
            });
        }

        t.push({
            line: '', phase: 'done',
            caption: 'Tri terminé : toutes les cases sont ordonnées.',
            marks: { sorted: range(0, n) }
        });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri par insertion
    // ─────────────────────────────────────────────────────────────────────────
    function buildInsertionTrace(input) {
        const a = toNumbers(input);
        const n = a.length;
        const t = new TraceBuilder(a);

        t.push({
            line: '', phase: 'start',
            caption: n < 2 ? 'Tableau déjà trié (0 ou 1 élément).' : 'Démarrage du tri par insertion.',
            marks: { sorted: n < 2 ? range(0, n) : [0] }
        });

        // Variante « key visible dans le trou » : quand un élément est décalé à
        // droite, la case libérée reçoit tout de suite `key`. Le tableau reste
        // ainsi une permutation de l'entrée à CHAQUE pas (pas de doublon transitoire),
        // et la carte `key=` matérialise la valeur mise de côté.
        for (let i = 1; i < n; i += 1) {
            const prefix = range(0, i);
            const key = a[i];
            t.push({
                line: INSERTION_LINES.outer, phase: 'enter',
                caption: `Itération i=${i} : insérer a[${i}]=${key} dans le préfixe déjà trié.`,
                marks: { active: [i], sorted: prefix }, vars: { i }
            });
            t.push({
                line: INSERTION_LINES.takeKey, phase: 'take-key',
                caption: `key ← a[${i}] = ${key} (valeur mise de côté).`,
                marks: { active: [i], sorted: prefix }, vars: { i, key },
                insertion: { key, targetIndex: i }
            });

            let j = i - 1;
            t.push({
                line: INSERTION_LINES.initJ, phase: 'init-j',
                caption: `j ← ${j}. On compare key aux éléments du préfixe, de droite à gauche.`,
                marks: { sorted: prefix }, vars: { i, j, key },
                insertion: { key, targetIndex: j + 1 }
            });

            while (j >= 0) {
                t.bump({ comparisons: 1 });
                const shift = a[j] > key;
                t.push({
                    line: INSERTION_LINES.whileCond, phase: 'compare',
                    caption: shift
                        ? `a[${j}]=${a[j]} > key=${key} : on décale a[${j}] d'un cran à droite.`
                        : `a[${j}]=${a[j]} ≤ key=${key} : la place de key est trouvée.`,
                    marks: { compare: [j], active: [j + 1], sorted: prefix }, vars: { i, j, key },
                    insertion: { key, targetIndex: j + 1 }
                });
                if (!shift) break;

                a[j + 1] = a[j];
                a[j] = key;
                t.bump({ writes: 1, swaps: 1 });
                t.push({
                    line: INSERTION_LINES.shift, phase: 'shift',
                    caption: `Décalage : a[${j + 1}] ← ${a[j + 1]} ; key occupe provisoirement a[${j}].`,
                    marks: { swap: [j, j + 1], sorted: prefix }, vars: { i, j, key },
                    insertion: { key, targetIndex: j }
                });

                j -= 1;
                if (j >= 0) {
                    t.push({
                        line: INSERTION_LINES.decrJ, phase: 'decr-j',
                        caption: `j ← ${j}.`,
                        marks: { sorted: prefix }, vars: { i, j, key },
                        insertion: { key, targetIndex: j + 1 }, delay: 'half'
                    });
                }
            }

            // key est déjà dans a[j+1] (dernier trou creusé, ou a[i] si aucun décalage).
            a[j + 1] = key;
            t.bump({ writes: 1 });
            t.push({
                line: INSERTION_LINES.place, phase: 'place',
                caption: `key = ${key} est à sa place définitive en a[${j + 1}]. Préfixe 0..${i} trié.`,
                marks: { swap: [j + 1], sorted: range(0, i + 1) }, vars: { i, j, key }
            });
        }

        t.push({
            line: '', phase: 'done',
            caption: 'Tri terminé : toutes les insertions sont effectuées.',
            marks: { sorted: range(0, n) }
        });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri par sélection
    // ─────────────────────────────────────────────────────────────────────────
    function buildSelectionTrace(input) {
        const a = toNumbers(input);
        const n = a.length;
        const t = new TraceBuilder(a);

        t.push({
            line: '', phase: 'start',
            caption: n < 2 ? 'Tableau déjà trié (0 ou 1 élément).' : 'Démarrage du tri par sélection.',
            marks: { sorted: n < 2 ? range(0, n) : [] }
        });

        for (let i = 0; i < n - 1; i += 1) {
            const prefix = range(0, i);
            let minIndex = i;
            t.push({
                line: SELECTION_LINES.initMin, phase: 'init-min',
                caption: `Passe i=${i} : minimum provisoire à l'indice ${minIndex} (valeur ${a[minIndex]}).`,
                marks: { active: [i], sorted: prefix }, vars: { i, minIndex }
            });

            for (let j = i + 1; j < n; j += 1) {
                t.bump({ comparisons: 1 });
                const better = a[j] < a[minIndex];
                t.push({
                    line: SELECTION_LINES.compare, phase: 'compare',
                    caption: better
                        ? `a[${j}]=${a[j]} < a[${minIndex}]=${a[minIndex]} : nouveau minimum provisoire.`
                        : `a[${j}]=${a[j]} ≥ a[${minIndex}]=${a[minIndex]} : le minimum ne change pas.`,
                    marks: { compare: [j, minIndex], sorted: prefix }, vars: { i, j, minIndex }
                });
                if (better) {
                    minIndex = j;
                    t.push({
                        line: SELECTION_LINES.newMin, phase: 'new-min',
                        caption: `minIndex ← ${minIndex} (valeur ${a[minIndex]}).`,
                        marks: { active: [minIndex], sorted: prefix }, vars: { i, j, minIndex },
                        delay: 'half'
                    });
                }
            }

            if (minIndex !== i) {
                t.push({
                    line: SELECTION_LINES.swap, phase: 'swap-fly',
                    caption: `Permuter a[${i}]=${a[i]} et a[${minIndex}]=${a[minIndex]}.`,
                    marks: { swap: [i, minIndex], sorted: prefix }, vars: { i, minIndex },
                    anim: 'swap', delay: 'swap'
                });
                const tmp = a[i]; a[i] = a[minIndex]; a[minIndex] = tmp;
                t.bump({ writes: 2, swaps: 1 });
                t.push({
                    line: SELECTION_LINES.swap, phase: 'swap-settle',
                    caption: `a[${i}] et a[${minIndex}] sont permutés.`,
                    marks: { sorted: range(0, i + 1) }, vars: { i, minIndex },
                    delay: 'postswap'
                });
            } else {
                t.push({
                    line: SELECTION_LINES.swapCond, phase: 'no-swap',
                    caption: `Le minimum est déjà à l'indice ${i} : pas de permutation.`,
                    marks: { active: [i], sorted: range(0, i + 1) }, vars: { i, minIndex }
                });
            }
        }

        t.push({
            line: '', phase: 'done',
            caption: 'Tri terminé : tous les minimums successifs sont placés.',
            marks: { sorted: range(0, n) }
        });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri rapide (Lomuto, pivot = dernier élément), récursion simulée par pile
    // ─────────────────────────────────────────────────────────────────────────
    const QUICK_LINES = {
        ifLowHigh: 'if-low-high',
        partitionCall: 'partition-call',
        recLeft: 'recursion-left',
        recRight: 'recursion-right',
        pivotSetup: 'pivot-setup',
        indexSetup: 'index-setup',
        forLoop: 'for-loop',
        ifCond: 'if-condition',
        incrI: 'increment-i',
        swapEls: 'swap-elements',
        finalSwap: 'final-swap',
        returnPivot: 'return-pivot'
    };

    function buildQuickSortTrace(input) {
        const a = toNumbers(input);
        const n = a.length;
        const t = new TraceBuilder(a);
        const sorted = new Set();
        const pivotHistory = [];
        let maxDepth = 0;

        // Pile d'appels : chaque cadre reproduit quickSort(a, lo, hi, depth).
        const frames = [{ lo: 0, hi: n - 1, depth: 1, phase: 'enter', pivotFinal: -1 }];

        const activeFrames = () => frames
            .filter((f) => f.lo < f.hi && f.phase !== 'enter')
            .map((f) => ({ low: f.lo, high: f.hi, depth: f.depth }));

        const view = (extra) => Object.assign({
            stack: activeFrames(),
            pivotHistory: pivotHistory.slice(-8),
            maxDepth
        }, extra || {});

        const emit = (o) => {
            t.setStat('maxDepth', maxDepth);
            t.push(o);
        };

        emit({ line: '', phase: 'start',
            caption: n < 2 ? 'Tableau déjà trié (0 ou 1 élément).' : 'Démarrage du tri rapide (partition de Lomuto).',
            marks: { sorted: [] }, view: view() });

        if (n < 2) {
            for (let k = 0; k < n; k += 1) sorted.add(k);
            emit({ line: '', phase: 'done', caption: 'Tableau déjà trié (0 ou 1 élément).',
                marks: { sorted: [...sorted] }, view: view() });
            return t.build();
        }

        while (frames.length) {
            const f = frames[frames.length - 1];

            if (f.phase === 'enter') {
                maxDepth = Math.max(maxDepth, f.depth);
                if (f.lo < f.hi) {
                    emit({ line: QUICK_LINES.ifLowHigh, phase: 'call',
                        caption: `triRapide(A, ${f.lo}, ${f.hi}) — profondeur ${f.depth}.`,
                        marks: { range: [f.lo, f.hi], sorted: [...sorted] },
                        vars: { i: f.lo, j: f.hi },
                        view: view({ range: { low: f.lo, high: f.hi, pivotIndex: -1, pivotValue: null, splitIndex: -1, depth: f.depth } }) });
                    f.phase = 'partition';
                } else {
                    if (f.lo === f.hi) sorted.add(f.lo);
                    frames.pop();
                }
                continue;
            }

            if (f.phase === 'partition') {
                emit({ line: QUICK_LINES.partitionCall, phase: 'partition-call',
                    caption: `Partitionner le segment [${f.lo}..${f.hi}].`,
                    marks: { range: [f.lo, f.hi], sorted: [...sorted] },
                    view: view({ range: { low: f.lo, high: f.hi, pivotIndex: f.hi, pivotValue: a[f.hi], splitIndex: -1, depth: f.depth } }) });

                const lo = f.lo; const hi = f.hi;
                const pivot = a[hi];
                t.bump({ partitions: 1 });
                emit({ line: QUICK_LINES.pivotSetup, phase: 'pivot',
                    caption: `pivot ← A[${hi}] = ${pivot}.`,
                    marks: { pivot: [hi], range: [lo, hi], sorted: [...sorted] },
                    view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: -1, depth: f.depth } }) });

                let iBound = lo - 1;
                emit({ line: QUICK_LINES.indexSetup, phase: 'index',
                    caption: `i ← ${iBound} (frontière des éléments ≤ pivot).`,
                    marks: { pivot: [hi], range: [lo, hi], sorted: [...sorted] }, vars: { i: iBound },
                    view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: iBound, depth: f.depth } }) });

                for (let j = lo; j < hi; j += 1) {
                    t.bump({ comparisons: 1 });
                    const le = a[j] <= pivot;
                    emit({ line: QUICK_LINES.ifCond, phase: 'compare',
                        caption: le
                            ? `A[${j}]=${a[j]} ≤ pivot=${pivot} : à ranger à gauche.`
                            : `A[${j}]=${a[j]} > pivot=${pivot} : reste à droite.`,
                        marks: { compare: [j], pivot: [hi], range: [lo, hi], sorted: [...sorted] }, vars: { i: iBound, j },
                        view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: iBound, depth: f.depth } }) });

                    if (le) {
                        iBound += 1;
                        if (iBound !== j) {
                            emit({ line: QUICK_LINES.swapEls, phase: 'swap-fly',
                                caption: `i ← ${iBound} ; échanger A[${iBound}]=${a[iBound]} et A[${j}]=${a[j]}.`,
                                marks: { swap: [iBound, j], pivot: [hi], range: [lo, hi], sorted: [...sorted] }, vars: { i: iBound, j },
                                anim: 'swap', delay: 'swap',
                                view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: iBound, depth: f.depth } }) });
                            const tmp = a[iBound]; a[iBound] = a[j]; a[j] = tmp;
                            t.bump({ swaps: 1, writes: 2 });
                            emit({ line: QUICK_LINES.swapEls, phase: 'swap-settle',
                                caption: `A[${iBound}] et A[${j}] sont échangés.`,
                                marks: { pivot: [hi], range: [lo, hi], sorted: [...sorted] }, vars: { i: iBound, j },
                                delay: 'postswap',
                                view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: iBound, depth: f.depth } }) });
                        } else {
                            emit({ line: QUICK_LINES.incrI, phase: 'incr-i',
                                caption: `i ← ${iBound} (A[${j}] déjà du bon côté).`,
                                marks: { active: [iBound], pivot: [hi], range: [lo, hi], sorted: [...sorted] }, vars: { i: iBound, j },
                                delay: 'half',
                                view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: iBound, depth: f.depth } }) });
                        }
                    }
                }

                const pivotFinal = iBound + 1;
                if (pivotFinal !== hi) {
                    emit({ line: QUICK_LINES.finalSwap, phase: 'swap-fly',
                        caption: `Placer le pivot : échanger A[${pivotFinal}]=${a[pivotFinal]} et A[${hi}]=${a[hi]}.`,
                        marks: { swap: [pivotFinal, hi], range: [lo, hi], sorted: [...sorted] },
                        anim: 'swap', delay: 'swap',
                        view: view({ range: { low: lo, high: hi, pivotIndex: hi, pivotValue: pivot, splitIndex: pivotFinal, depth: f.depth } }) });
                    const tmp = a[pivotFinal]; a[pivotFinal] = a[hi]; a[hi] = tmp;
                    t.bump({ swaps: 1, writes: 2 });
                }
                sorted.add(pivotFinal);
                pivotHistory.push({ low: lo, high: hi, value: pivot, finalIndex: pivotFinal });
                emit({ line: QUICK_LINES.returnPivot, phase: 'place-pivot',
                    caption: `Pivot ${pivot} placé définitivement en A[${pivotFinal}].`,
                    marks: { pivot: [pivotFinal], sorted: [...sorted] },
                    delay: 'postswap',
                    view: view({ range: { low: lo, high: hi, pivotIndex: pivotFinal, pivotValue: pivot, splitIndex: pivotFinal, depth: f.depth } }) });

                f.pivotFinal = pivotFinal;
                f.phase = 'left';
                continue;
            }

            if (f.phase === 'left') {
                emit({ line: QUICK_LINES.recLeft, phase: 'recurse-left',
                    caption: `Récursion à gauche : [${f.lo}..${f.pivotFinal - 1}].`,
                    marks: { range: [f.lo, Math.max(f.lo, f.pivotFinal - 1)], sorted: [...sorted] },
                    view: view() });
                f.phase = 'right';
                frames.push({ lo: f.lo, hi: f.pivotFinal - 1, depth: f.depth + 1, phase: 'enter', pivotFinal: -1 });
                continue;
            }

            if (f.phase === 'right') {
                emit({ line: QUICK_LINES.recRight, phase: 'recurse-right',
                    caption: `Récursion à droite : [${f.pivotFinal + 1}..${f.hi}].`,
                    marks: { range: [Math.min(f.hi, f.pivotFinal + 1), f.hi], sorted: [...sorted] },
                    view: view() });
                f.phase = 'done';
                frames.push({ lo: f.pivotFinal + 1, hi: f.hi, depth: f.depth + 1, phase: 'enter', pivotFinal: -1 });
                continue;
            }

            frames.pop();
        }

        for (let k = 0; k < n; k += 1) sorted.add(k);
        emit({ line: '', phase: 'done', caption: 'Tri terminé : le tableau est ordonné.',
            marks: { sorted: [...sorted] }, view: view() });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri fusion — TOP-DOWN récursif avec arbre d'appels (canon retenu, 3G).
    // Reproduit la visualisation historique de la page : arbre qui se déploie
    // (division) puis se replie (fusion) + tableau linéaire progressif + runs triés.
    // ─────────────────────────────────────────────────────────────────────────
    const MERGE_LINES = {
        fnMergeSort: 'line-fn-merge-sort',
        baseCase: 'line-base-case',
        returnBase: 'line-return-base',
        mid: 'line-mid',
        splitLeft: 'line-split-left',
        splitRight: 'line-split-right',
        returnMerge: 'line-return-merge',
        fnMerge: 'line-fn-merge',
        initResult: 'line-init-result',
        whileLoop: 'line-while',
        compare: 'line-compare',
        takeLeft: 'line-take-left',
        elseBranch: 'line-else',
        takeRight: 'line-take-right',
        concat: 'line-concat',
        returnResult: 'line-return-result'
    };

    function buildMergeSortTrace(input, opts) {
        const options = opts || {};
        if (options.variant && options.variant !== 'top-down') {
            throw new Error('buildMergeSortTrace : seule la variante "top-down" est supportée (3G).');
        }
        const original = toNumbers(input);
        const n = original.length;
        const t = new TraceBuilder(original.slice());

        // état visuel reproduit à l'identique de MergeSortVisualizer (sans DOM)
        const linear = original.slice();
        const linearState = {};
        let linearRange = null;
        let linearPreview = null;
        let sortedRuns = [];
        let treeState = [];       // [{ direction, subs:[{values, highlight, elementStates, isSorted}] }]
        const splitLevels = {};   // depth -> subs[]
        let splitCount = 0;
        let mergeCount = 0;
        let compareCount = 0;

        const cloneSub = (s) => ({
            values: s.values.slice(),
            highlight: s.highlight || null,
            elementStates: Object.assign({}, s.elementStates),
            isSorted: Boolean(s.isSorted)
        });
        const setTreeLevel = (depth, subs, direction) => {
            while (treeState.length <= depth) treeState.push({ direction: direction || 'down', subs: [] });
            treeState[depth] = { direction: direction || 'down', subs: subs.map(cloneSub) };
        };
        const clearTreeFromDepth = (depth) => { treeState = treeState.slice(0, depth); };
        const arraysEqual = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

        const recordSortedRun = (start, values) => {
            if (!values.length) return;
            const snap = { start, end: start + values.length - 1, values: values.slice() };
            const i = sortedRuns.findIndex((r) => r.start === snap.start && r.end === snap.end);
            if (i >= 0) sortedRuns[i] = snap; else sortedRuns.unshift(snap);
            if (sortedRuns.length > 20) sortedRuns = sortedRuns.slice(0, 20);
        };
        const setLinearRange = (start, end, phase) => {
            linearRange = { start, end, phase };
            if (phase !== 'merge') linearPreview = null;
        };
        const commitLinear = (start, values, phase) => {
            linearPreview = null;
            values.forEach((v, k) => { linear[start + k] = v; linearState[start + k] = phase || 'merge'; });
            linearRange = { start, end: start + values.length - 1, phase: phase || 'merge' };
        };

        let phaseLabel = '';
        const emit = (o) => {
            t.setStat('splits', splitCount);
            t.setStat('merges', mergeCount);
            t.setStat('comparisons', compareCount);
            t.push({
                line: o.line || '',
                phase: o.phase || '',
                caption: o.caption || '',
                array: linear.slice(),
                marks: { sorted: o.sorted || [], compare: o.compare || [], range: o.range || null },
                delay: o.delay || 'normal',
                view: {
                    tree: treeState.map((lvl) => ({ direction: lvl.direction, subs: lvl.subs.map(cloneSub) })),
                    linear: {
                        values: linear.slice(),
                        state: Object.assign({}, linearState),
                        range: linearRange ? Object.assign({}, linearRange) : null,
                        preview: linearPreview ? {
                            start: linearPreview.start, end: linearPreview.end, values: linearPreview.values.slice()
                        } : null
                    },
                    sortedRuns: sortedRuns.map((r) => ({ start: r.start, end: r.end, values: r.values.slice() })),
                    bands: o.bands || null,
                    phaseLabel
                }
            });
        };

        function merge(left, right, depth, startIndex) {
            const mergeEnd = startIndex + left.length + right.length - 1;
            const leftBand = range(startIndex, startIndex + left.length);
            const rightBand = range(startIndex + left.length, mergeEnd + 1);
            setLinearRange(startIndex, mergeEnd, 'merge');
            linearPreview = { start: startIndex, end: mergeEnd, values: [] };

            emit({ line: MERGE_LINES.fnMerge, phase: 'merge-enter', delay: 'quick',
                caption: `Fusion de [${left.join(', ')}] et [${right.join(', ')}].`,
                bands: { left: leftBand, right: rightBand, merged: [] } });
            emit({ line: MERGE_LINES.initResult, phase: 'merge-init', delay: 'quick',
                caption: 'Initialiser le tableau résultat.',
                bands: { left: leftBand, right: rightBand, merged: [] } });

            const mergeDepth = treeState.length;
            const result = [];
            let li = 0;
            let ri = 0;

            const workingLevel = () => {
                const subs = [];
                if (result.length) {
                    subs.push({ values: result, highlight: 'merge',
                        elementStates: Object.fromEntries(result.map((_, i) => [i, 'placed'])), isSorted: false });
                }
                subs.push({ values: left, highlight: 'merge', elementStates: { [li]: 'comparing' }, isSorted: true });
                subs.push({ values: right, highlight: 'merge', elementStates: { [ri]: 'comparing' }, isSorted: true });
                return subs;
            };

            while (li < left.length && ri < right.length) {
                setTreeLevel(mergeDepth, workingLevel(), 'up');
                compareCount += 1;
                emit({ line: MERGE_LINES.compare, phase: 'merge-compare',
                    caption: `Comparaison : ${left[li]} vs ${right[ri]}.`,
                    compare: [startIndex + li, startIndex + left.length + ri],
                    bands: { left: leftBand, right: rightBand, merged: range(startIndex, startIndex + result.length) } });

                if (left[li] <= right[ri]) {
                    result.push(left[li]);
                    li += 1;
                    linearPreview = { start: startIndex, end: mergeEnd, values: result.slice() };
                    emit({ line: MERGE_LINES.takeLeft, phase: 'merge-take', delay: 'half',
                        caption: `${result[result.length - 1]} vient du sous-tableau gauche.`,
                        bands: { left: leftBand, right: rightBand, merged: range(startIndex, startIndex + result.length) } });
                } else {
                    result.push(right[ri]);
                    ri += 1;
                    linearPreview = { start: startIndex, end: mergeEnd, values: result.slice() };
                    emit({ line: MERGE_LINES.takeRight, phase: 'merge-take', delay: 'half',
                        caption: `${result[result.length - 1]} vient du sous-tableau droit.`,
                        bands: { left: leftBand, right: rightBand, merged: range(startIndex, startIndex + result.length) } });
                }
            }

            while (li < left.length) result.push(left[li++]);
            while (ri < right.length) result.push(right[ri++]);
            linearPreview = { start: startIndex, end: mergeEnd, values: result.slice() };
            emit({ line: MERGE_LINES.concat, phase: 'merge-concat',
                caption: 'Recopier le reliquat du sous-tableau non épuisé.',
                bands: { left: leftBand, right: rightBand, merged: range(startIndex, mergeEnd + 1) } });

            setTreeLevel(mergeDepth, [{
                values: result, highlight: 'merge',
                elementStates: Object.fromEntries(result.map((_, i) => [i, 'placed'])), isSorted: true
            }], 'up');
            mergeCount += 1;
            recordSortedRun(startIndex, result);
            commitLinear(startIndex, result, 'merge');
            emit({ line: MERGE_LINES.returnResult, phase: 'merge-done',
                caption: `Résultat de la fusion : [${result.join(', ')}].`,
                sorted: range(startIndex, mergeEnd + 1),
                bands: { left: [], right: [], merged: range(startIndex, mergeEnd + 1) } });

            // remonter le résultat dans le niveau parent (splice de la paire)
            if (depth >= 0 && depth < treeState.length) {
                const lvl = treeState[depth].subs;
                for (let i = 0; i < lvl.length - 1; i += 1) {
                    if (arraysEqual(lvl[i].values, left) && arraysEqual(lvl[i + 1].values, right)) {
                        lvl.splice(i, 2, {
                            values: result.slice(), highlight: 'sorted',
                            elementStates: Object.fromEntries(result.map((_, k) => [k, 'sorted'])), isSorted: true
                        });
                        break;
                    }
                }
            }
            if (splitLevels[depth]) {
                const sl = splitLevels[depth];
                for (let i = 0; i < sl.length - 1; i += 1) {
                    if (arraysEqual(sl[i].values, left) && arraysEqual(sl[i + 1].values, right)) {
                        sl.splice(i, 2, { values: result.slice(), highlight: 'sorted',
                            elementStates: {}, isSorted: true });
                        break;
                    }
                }
            }
            clearTreeFromDepth(mergeDepth);
            emit({ line: MERGE_LINES.returnResult, phase: 'merge-collapse',
                caption: `Le segment [${startIndex}..${mergeEnd}] est trié.`,
                sorted: range(startIndex, mergeEnd + 1), delay: 'half',
                bands: { left: [], right: [], merged: range(startIndex, mergeEnd + 1) } });
            return result;
        }

        function msort(arr, depth, startIndex) {
            if (arr.length <= 1) {
                emit({ line: MERGE_LINES.baseCase, phase: 'base-case', delay: 'quick',
                    caption: arr.length === 1
                        ? `Cas de base : le segment [${arr[0]}] est déjà trié.`
                        : 'Cas de base : segment vide.',
                    range: arr.length === 1 ? [startIndex, startIndex] : null });
                emit({ line: MERGE_LINES.returnBase, phase: 'return-base', delay: 'quick',
                    caption: 'On renvoie le segment tel quel.',
                    range: arr.length === 1 ? [startIndex, startIndex] : null });
                return arr.slice();
            }

            phaseLabel = 'Phase de division';
            setLinearRange(startIndex, startIndex + arr.length - 1, 'split');
            const mid = Math.floor(arr.length / 2);
            const left = arr.slice(0, mid);
            const right = arr.slice(mid);
            splitCount += 1;
            emit({ line: MERGE_LINES.mid, phase: 'split',
                caption: `Division de [${arr.join(', ')}] en [${left.join(', ')}] et [${right.join(', ')}].`,
                range: [startIndex, startIndex + arr.length - 1] });

            if (!splitLevels[depth + 1]) splitLevels[depth + 1] = [];
            splitLevels[depth + 1].push({ values: left.slice(), highlight: 'split', elementStates: {}, isSorted: false });
            splitLevels[depth + 1].push({ values: right.slice(), highlight: 'split', elementStates: {}, isSorted: false });
            setTreeLevel(depth + 1, splitLevels[depth + 1], 'down');
            emit({ line: MERGE_LINES.splitLeft, phase: 'recurse-left', delay: 'quick',
                caption: 'Tri récursif de la moitié gauche.',
                range: [startIndex, startIndex + mid - 1] });

            const sortedLeft = msort(left, depth + 1, startIndex);

            emit({ line: MERGE_LINES.splitRight, phase: 'recurse-right', delay: 'quick',
                caption: 'Tri récursif de la moitié droite.',
                range: [startIndex + mid, startIndex + arr.length - 1] });
            const sortedRight = msort(right, depth + 1, startIndex + mid);

            phaseLabel = 'Phase de fusion';
            emit({ line: MERGE_LINES.returnMerge, phase: 'merge-call', delay: 'quick',
                caption: 'Fusion des deux moitiés triées.',
                range: [startIndex, startIndex + arr.length - 1] });
            return merge(sortedLeft, sortedRight, depth, startIndex);
        }

        setTreeLevel(0, [{ values: original.slice(), highlight: 'split', elementStates: {}, isSorted: false }], 'down');
        emit({ line: '', phase: 'start', caption: 'Démarrage du tri fusion (diviser pour régner).' });

        if (n <= 1) {
            for (let k = 0; k < n; k += 1) linearState[k] = 'sorted';
            emit({ line: '', phase: 'done', caption: 'Tableau déjà trié.', sorted: range(0, n) });
            return t.build();
        }

        const sorted = msort(original.slice(), 0, 0);
        treeState = [{ direction: 'down', subs: [{
            values: sorted.slice(), highlight: null,
            elementStates: Object.fromEntries(sorted.map((_, i) => [i, 'sorted'])), isSorted: true
        }] }];
        sorted.forEach((v, i) => { linear[i] = v; linearState[i] = 'sorted'; });
        linearRange = null;
        linearPreview = null;
        phaseLabel = '';
        emit({ line: '', phase: 'done', caption: 'Tri terminé ! Le tableau est trié.',
            sorted: range(0, n), bands: { left: [], right: [], merged: range(0, n) } });
        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tri par comptage (counting sort) — histogramme / cumul / placement stable
    // ─────────────────────────────────────────────────────────────────────────
    const COUNTING_LINES = {
        init: 'cline2', countLoop: 'cline3', count: 'cline4',
        cumulLoop: 'cline5', cumul: 'cline6', outputInit: 'cline7',
        placeLoop: 'cline8', place: 'cline10', decr: 'cline11', done: 'cline12'
    };

    function buildCountingSortTrace(input) {
        const src = toNumbers(input).filter((v) => Number.isInteger(v) && v >= 0);
        const t = new TraceBuilder(src.slice());
        const steps = [];
        const cMax = src.length ? Math.max(...src) : 0;
        const count = new Array(cMax + 1).fill(0);
        const output = new Array(src.length).fill(null);
        const stabilityLog = [];
        let stepCount = 0;

        const emit = (o) => {
            stepCount += 1;
            steps.push(o);
            t.push({
                line: o.line || '', phase: o.phase || '', caption: o.caption || '',
                array: (o.arrayView || src).slice(),
                marks: { sorted: o.sorted || [] },
                delay: o.delay || 'normal',
                view: {
                    mode: 'counting',
                    input: src.slice(), count: count.slice(), output: output.slice(),
                    cMax, cPhase: o.cPhase || 'idle', cumulated: Boolean(o.cumulated),
                    activeInput: o.activeInput == null ? -1 : o.activeInput,
                    activeCount: o.activeCount == null ? -1 : o.activeCount,
                    activeOutput: o.activeOutput == null ? -1 : o.activeOutput,
                    stabilityLog: stabilityLog.slice(-8), stepCount
                }
            });
        };

        stabilityLog.push('Initialisation du tri par comptage sur ' + src.length + ' éléments.');
        emit({ line: COUNTING_LINES.init, phase: 'init', cPhase: 'counting',
            caption: `Initialisation du tableau de comptage C (taille ${cMax + 1}, indices 0..${cMax}).` });

        for (let i = 0; i < src.length; i += 1) {
            count[src[i]] += 1;
            emit({ line: COUNTING_LINES.count, phase: 'count', cPhase: 'counting',
                caption: `Comptage : A[${i}] = ${src[i]} → C[${src[i]}] = ${count[src[i]]}.`,
                activeInput: i, activeCount: src[i] });
        }

        emit({ line: COUNTING_LINES.cumulLoop, phase: 'count-done', cPhase: 'cumulating',
            caption: 'Phase de comptage terminée. Passage à la somme cumulée.' });
        for (let j = 1; j <= cMax; j += 1) {
            count[j] += count[j - 1];
            emit({ line: COUNTING_LINES.cumul, phase: 'cumul', cPhase: 'cumulating', cumulated: true,
                caption: `Cumul : C[${j}] = C[${j}] + C[${j - 1}] = ${count[j]}.`,
                activeCount: j });
        }

        stabilityLog.push('Placement de droite à gauche : garantit la stabilité.');
        emit({ line: COUNTING_LINES.placeLoop, phase: 'cumul-done', cPhase: 'placing', cumulated: true,
            caption: 'Somme cumulée terminée. Placement des éléments, de droite à gauche.' });

        for (let i = src.length - 1; i >= 0; i -= 1) {
            const val = src[i];
            count[val] -= 1;
            const pos = count[val];
            output[pos] = val;
            stabilityLog.push(`v=${val} : A[${i}] → B[${pos}]`);
            emit({ line: COUNTING_LINES.place, phase: 'place', cPhase: 'placing', cumulated: true,
                caption: `Placement : A[${i}] = ${val} → B[${pos}] ; C[${val}] passe à ${count[val]}.`,
                activeInput: i, activeCount: val, activeOutput: pos,
                arrayView: output.map((v) => (v == null ? 0 : v)) });
        }

        stabilityLog.push('Fin du comptage : ordre relatif des doublons préservé.');
        emit({ line: COUNTING_LINES.done, phase: 'done', cPhase: 'done', cumulated: true,
            caption: 'Tri par comptage terminé !', sorted: range(0, src.length),
            arrayView: output.map((v) => (v == null ? 0 : v)) });

        return t.build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Radix sort (LSD, base 10) — distribution dans 10 seaux puis collecte
    // ─────────────────────────────────────────────────────────────────────────
    const RADIX_LINES = {
        init: 'rline2', bucketReset: 'rline3', distribLoop: 'rline4',
        distrib: 'rline6', collect: 'rline7', done: 'rline8'
    };
    const PASS_NAMES = ['unités', 'dizaines', 'centaines', 'milliers', 'dizaines de milliers'];

    function digitAt(num, pos) {
        return Math.floor(num / Math.pow(10, pos)) % 10;
    }

    function buildRadixSortTrace(input) {
        const src = toNumbers(input).filter((v) => Number.isInteger(v) && v >= 0);
        const t = new TraceBuilder(src.slice());
        let tagged = src.map((value, origin) => ({ value, origin }));
        const mx = src.length ? Math.max(...src) : 0;
        const maxDigits = mx === 0 ? 1 : Math.floor(Math.log10(mx)) + 1;
        let buckets = Array.from({ length: 10 }, () => []);
        const stabilityLog = [];
        let stepCount = 0;

        const emit = (o) => {
            stepCount += 1;
            t.push({
                line: o.line || '', phase: o.phase || '', caption: o.caption || '',
                array: tagged.map((e) => e.value),
                marks: { sorted: o.sorted || [] },
                delay: o.delay || 'normal',
                view: {
                    mode: 'radix',
                    tagged: tagged.map((e) => ({ value: e.value, origin: e.origin })),
                    buckets: buckets.map((b) => b.map((e) => ({ value: e.value, origin: e.origin }))),
                    pass: o.pass == null ? 0 : o.pass,
                    maxDigits,
                    passName: PASS_NAMES[o.pass == null ? 0 : o.pass] || ('position ' + (o.pass == null ? 0 : o.pass)),
                    rPhase: o.rPhase || 'idle',
                    activeIndex: o.activeIndex == null ? -1 : o.activeIndex,
                    activeBucket: o.activeBucket == null ? -1 : o.activeBucket,
                    stabilityLog: stabilityLog.slice(-8), stepCount
                }
            });
        };

        stabilityLog.push(`Initialisation radix : ${maxDigits} passe(s) prévue(s).`);
        emit({ line: RADIX_LINES.init, phase: 'init', rPhase: 'distributing', pass: 0,
            caption: `Initialisation du tri radix : ${maxDigits} passe(s) (chiffres des ${PASS_NAMES.slice(0, maxDigits).join(', ')}).` });

        for (let pass = 0; pass < maxDigits; pass += 1) {
            if (pass > 0) {
                buckets = Array.from({ length: 10 }, () => []);
                emit({ line: RADIX_LINES.bucketReset, phase: 'bucket-reset', rPhase: 'distributing', pass,
                    delay: 'quick',
                    caption: `Passe ${pass + 1} (chiffre des ${PASS_NAMES[pass] || pass}) : réinitialisation des 10 seaux.` });
            }

            for (let i = 0; i < tagged.length; i += 1) {
                const d = digitAt(tagged[i].value, pass);
                buckets[d].push(tagged[i]);
                emit({ line: RADIX_LINES.distrib, phase: 'distribute', rPhase: 'distributing', pass,
                    caption: `Distribution : ${tagged[i].value} (origine #${tagged[i].origin}) → seau ${d} (chiffre des ${PASS_NAMES[pass] || pass}).`,
                    activeIndex: i, activeBucket: d });
            }

            for (let b = 0; b < 10; b += 1) {
                if (buckets[b].length) {
                    stabilityLog.push(`Passe ${pass + 1}, seau ${b} : ` + buckets[b].map((e) => '#' + e.origin).join(', '));
                }
            }
            const collected = [];
            for (let b = 0; b < 10; b += 1) collected.push(...buckets[b]);
            tagged = collected;
            emit({ line: pass + 1 >= maxDigits ? RADIX_LINES.done : RADIX_LINES.collect,
                phase: pass + 1 >= maxDigits ? 'done' : 'collect',
                rPhase: pass + 1 >= maxDigits ? 'done' : 'distributing',
                pass: Math.min(pass + 1, maxDigits - 1),
                sorted: pass + 1 >= maxDigits ? range(0, tagged.length) : [],
                caption: pass + 1 >= maxDigits
                    ? 'Tri radix terminé ! Le tableau est trié.'
                    : `Concaténation des seaux 0→9. Fin de la passe ${pass + 1}.` });
        }

        return t.build();
    }

    return {
        SORT_TRACE_LINES: {
            bubble: BUBBLE_LINES,
            insertion: INSERTION_LINES,
            selection: SELECTION_LINES,
            quick: QUICK_LINES,
            merge: MERGE_LINES,
            counting: COUNTING_LINES,
            radix: RADIX_LINES
        },
        buildBubbleTrace,
        buildInsertionTrace,
        buildSelectionTrace,
        buildQuickSortTrace,
        buildMergeSortTrace,
        buildCountingSortTrace,
        buildRadixSortTrace
    };
});
