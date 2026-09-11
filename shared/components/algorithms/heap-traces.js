/**
 * heap-traces.js — générateurs de trace PURS pour le tas binaire (min/max).
 * Un tas y est un simple tableau `[v0, v1, …]` (indices 2i+1/2i+2 pour les
 * enfants) — jamais de classe. `mode` ('min'|'max') pilote le comparateur
 * partagé `cmp` : c'est le SEUL paramètre qui distingue min-heap et max-heap,
 * consommé identiquement par insertion, extraction ET heapsort.
 *
 * `buildHeapInsertTrace`/`buildHeapExtractTrace` sont consommés par LA PAGE
 * (animée, pseudocode ligne à ligne) ET LE WIDGET (instantané, ne lit que
 * `.at(-1)`) — même mécanique de sift-up/sift-down, aucune divergence.
 * `resetHeap()` (page) et `_insertSilent` (widget) réutilisent aussi
 * `buildHeapInsertTrace` pour semer le tas initial (silencieux) — plus
 * aucune 3ᵉ copie du sift-up.
 *
 * `buildHeapsortTrace` est PAGE UNIQUEMENT (pas de bouton Heapsort sur le
 * widget, comme CountingRadixWidget qui n'a pas de mode radix). Correctif de
 * revue inclus : le code d'origine construisait toujours un tas MAXIMUM et
 * codait `arr[l] > arr[largest]` en dur dans le heapify/sift-down de
 * heapsort, ignorant totalement `this.mode` — un tri par tas lancé en mode
 * min-heap produisait quand même un résultat croissant (construit sur un tas
 * max caché). Ici, heapify et sift-down utilisent `cmp(mode, …)` comme
 * partout ailleurs : mode 'max' construit un tas max et place le plus grand
 * élément restant en fin de zone non triée à chaque tour → résultat
 * CROISSANT (comportement observable inchangé). Mode 'min' construit un tas
 * min et place le plus PETIT élément restant en fin de zone non triée à
 * chaque tour → résultat DÉCROISSANT (le tri par tas en mode min-heap est
 * l'algorithme dual — cohérent avec le tas réellement affiché, corrige le bug).
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

    const INS_LINES = { start: 'pins1', push: 'pins2', initI: 'pins3', compare: 'pins4', swap: 'pins5', advance: 'pins6' };
    // pext6 (« tant que i a un enfant meilleur ») n'est jamais peint à l'écran dans le
    // code d'origine : aucun render()/sleep() ne suit son highlightLine avant que la
    // ligne suivante (pext7, ou l'épilogue si la boucle s'arrête) ne l'écrase dans le
    // même tick JS — volontairement absent des traces, il ne l'était déjà pas à l'écran.
    const EXT_LINES = { start: 'pext1', readRoot: 'pext2', moveLast: 'pext3', popLast: 'pext4', initI: 'pext5', compare: 'pext7', swap: 'pext8', advance: 'pext9' };

    function cmp(mode, a, b) {
        return mode === 'min' ? a < b : a > b;
    }
    function parent(i) { return Math.floor((i - 1) / 2); }
    function left(i) { return 2 * i + 1; }
    function right(i) { return 2 * i + 2; }

    function mk(heap, o) {
        const m = o.marks || {};
        return {
            i: 0,
            line: o.line || null,
            phase: o.phase || '',
            caption: o.caption || '',
            heap: heap.slice(),
            marks: {
                active: (m.active || []).slice(),
                swapping: (m.swapping || []).slice(),
                sorted: (m.sorted || []).slice()
            },
            removedValue: Object.prototype.hasOwnProperty.call(o, 'removedValue') ? o.removedValue : null,
            ok: o.ok !== false,
            delay: o.delay || 'normal'
        };
    }

    function finalize(steps) {
        steps.forEach((s, idx) => { s.i = idx; });
        return steps;
    }

    /** Insertion : ajoute en fin de tas puis remonte tant que la propriété de tas est violée (sift-up). */
    function buildHeapInsertTrace(heap, value, mode) {
        const work = heap.slice();
        const steps = [];

        steps.push(mk(work, { line: INS_LINES.start, phase: 'start', caption: `Insertion de ${value}.` }));

        work.push(value);
        const lastIdx = work.length - 1;
        steps.push(mk(work, {
            line: INS_LINES.push, phase: 'push', caption: `${value} ajouté en fin de tas (indice ${lastIdx}).`,
            marks: { active: [lastIdx] }, delay: 'grow'
        }));

        let i = lastIdx;
        steps.push(mk(work, {
            line: INS_LINES.initI, phase: 'init-i', caption: `i ← ${i}.`,
            marks: { active: [i] }, delay: 'settle'
        }));

        while (i > 0 && cmp(mode, work[i], work[parent(i)])) {
            const p = parent(i);
            steps.push(mk(work, {
                line: INS_LINES.compare, phase: 'compare',
                caption: `Comparer tas[${i}]=${work[i]} à son parent tas[${p}]=${work[p]}.`,
                marks: { active: [i, p] }
            }));
            steps.push(mk(work, {
                line: INS_LINES.swap, phase: 'swap-highlight',
                caption: `Échanger tas[${i}] et tas[${p}].`,
                marks: { swapping: [i, p] }, delay: 'swap'
            }));
            [work[i], work[p]] = [work[p], work[i]];
            steps.push(mk(work, {
                line: INS_LINES.swap, phase: 'swap-commit',
                caption: `tas[${i}] et tas[${p}] échangés.`,
                marks: { swapping: [i, p] }, delay: 'post-swap'
            }));
            i = p;
            steps.push(mk(work, {
                line: INS_LINES.advance, phase: 'advance', caption: `i ← ${i}.`,
                marks: { active: [i] }, delay: 'settle'
            }));
        }

        steps.push(mk(work, { phase: 'done', caption: `Valeur ${value} insérée.` }));
        return finalize(steps);
    }

    /** Extraction de la racine : la remplace par le dernier élément puis redescend (sift-down / heapify-down). */
    function buildHeapExtractTrace(heap, mode) {
        const work = heap.slice();
        const steps = [];

        steps.push(mk(work, { line: EXT_LINES.start, phase: 'start', caption: 'Extraction de la racine.' }));

        const root = work[0];
        steps.push(mk(work, {
            line: EXT_LINES.readRoot, phase: 'read-root', caption: `racine ← tas[0] = ${root}.`,
            marks: { active: [0] }, delay: 'grow'
        }));

        if (work.length === 1) {
            work.pop();
            steps.push(mk(work, { phase: 'done-single', caption: `Racine extraite : ${root}.`, removedValue: root }));
            return finalize(steps);
        }

        work[0] = work[work.length - 1];
        steps.push(mk(work, {
            line: EXT_LINES.moveLast, phase: 'move-last', caption: `tas[0] ← tas[dernier] = ${work[0]}.`,
            marks: { active: [0] }
        }));

        work.pop();
        steps.push(mk(work, {
            line: EXT_LINES.popLast, phase: 'pop-last', caption: 'Dernier élément retiré.',
            marks: { active: [0] }
        }));

        let i = 0;
        steps.push(mk(work, {
            line: EXT_LINES.initI, phase: 'init-i', caption: 'i ← 0.',
            marks: { active: [0] }, delay: 'settle'
        }));

        while (true) {
            let best = i;
            const l = left(i);
            const r = right(i);
            if (l < work.length && cmp(mode, work[l], work[best])) best = l;
            if (r < work.length && cmp(mode, work[r], work[best])) best = r;
            if (best === i) break;

            steps.push(mk(work, {
                line: EXT_LINES.compare, phase: 'compare',
                caption: `Meilleur enfant de tas[${i}] : tas[${best}]=${work[best]}.`,
                marks: { active: [i, best] }
            }));
            steps.push(mk(work, {
                line: EXT_LINES.swap, phase: 'swap-highlight',
                caption: `Échanger tas[${i}] et tas[${best}].`,
                marks: { swapping: [i, best] }, delay: 'swap'
            }));
            [work[i], work[best]] = [work[best], work[i]];
            steps.push(mk(work, {
                line: EXT_LINES.swap, phase: 'swap-commit',
                caption: `tas[${i}] et tas[${best}] échangés.`,
                marks: { swapping: [i, best] }, delay: 'post-swap'
            }));
            i = best;
            steps.push(mk(work, {
                line: EXT_LINES.advance, phase: 'advance', caption: `i ← ${i}.`,
                marks: { active: [i] }, delay: 'settle'
            }));
        }

        steps.push(mk(work, { phase: 'done', caption: `Racine extraite : ${root}.`, removedValue: root }));
        return finalize(steps);
    }

    /** Sift-down récursif utilisé UNIQUEMENT par le heapify initial de heapsort (mode-aware, cf. correctif ci-dessus). */
    function siftDownArr(arr, i, size, mode) {
        let best = i;
        const l = left(i);
        const r = right(i);
        if (l < size && cmp(mode, arr[l], arr[best])) best = l;
        if (r < size && cmp(mode, arr[r], arr[best])) best = r;
        if (best !== i) {
            [arr[i], arr[best]] = [arr[best], arr[i]];
            siftDownArr(arr, best, size, mode);
        }
    }

    /**
     * Heapsort. Pas de pseudocode dédié (comme dans le code d'origine — aucune ligne
     * surlignée). Le heapify initial n'est PAS animé pas-à-pas dans le code d'origine
     * (boucle synchrone sans render() intermédiaire) : un seul pas 'heapify' révèle le
     * tas construit d'un coup, puis chaque extraction-vers-la-fin s'anime normalement.
     */
    function buildHeapsortTrace(heap, mode) {
        const arr = heap.slice();
        const n = arr.length;
        const steps = [];

        for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) siftDownArr(arr, i, n, mode);
        steps.push(mk(arr, {
            phase: 'heapify',
            caption: `Tas ${mode === 'min' ? 'minimum' : 'maximum'} construit.`,
            delay: 'grow'
        }));

        for (let end = n - 1; end > 0; end -= 1) {
            // Indices déjà définitivement triés par les tours précédents (cumulatif,
            // comme `this.sortedIndices` — un Set qui ne fait jamais que grandir dans
            // le code d'origine) : [end+1, n). `end` lui-même n'y entre qu'après le
            // commit de ce tour, juste en dessous.
            const sortedBefore = [];
            for (let k = end + 1; k < n; k += 1) sortedBefore.push(k);
            steps.push(mk(arr, {
                phase: 'swap-root-highlight', caption: `Échanger tas[0] et tas[${end}].`,
                marks: { swapping: [0, end], sorted: sortedBefore }, delay: 'swap'
            }));
            [arr[0], arr[end]] = [arr[end], arr[0]];
            const sortedSoFar = [...sortedBefore, end];
            steps.push(mk(arr, {
                phase: 'swap-root-commit', caption: `${arr[end]} placé définitivement (indice ${end}).`,
                marks: { sorted: sortedSoFar }, delay: 'post-swap'
            }));

            let i = 0;
            const size = end;
            while (true) {
                let largest = i;
                const l = left(i);
                const r = right(i);
                if (l < size && cmp(mode, arr[l], arr[largest])) largest = l;
                if (r < size && cmp(mode, arr[r], arr[largest])) largest = r;
                if (largest === i) break;

                steps.push(mk(arr, {
                    phase: 'inner-compare', caption: `Comparer tas[${i}] à ses enfants.`,
                    marks: { active: [i, largest], sorted: sortedSoFar }, delay: 'quick'
                }));
                steps.push(mk(arr, {
                    phase: 'inner-swap-highlight', caption: `Échanger tas[${i}] et tas[${largest}].`,
                    marks: { swapping: [i, largest], sorted: sortedSoFar }, delay: 'swap'
                }));
                [arr[i], arr[largest]] = [arr[largest], arr[i]];
                steps.push(mk(arr, {
                    phase: 'inner-swap-commit', caption: `tas[${i}] et tas[${largest}] échangés.`,
                    marks: { swapping: [i, largest], sorted: sortedSoFar }, delay: 'post-swap'
                }));
                i = largest;
            }
        }

        const allSorted = Array.from({ length: n }, (_, k) => k);
        steps.push(mk(arr, {
            phase: 'done', caption: `Heapsort terminé ! Résultat : [${arr.join(', ')}].`,
            marks: { sorted: allSorted }
        }));
        return finalize(steps);
    }

    return {
        buildHeapInsertTrace,
        buildHeapExtractTrace,
        buildHeapsortTrace
    };
});
