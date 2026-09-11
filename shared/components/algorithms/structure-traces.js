/**
 * structure-traces.js — générateurs de trace PURS pour pile (stack, LIFO) et
 * file (queue, FIFO).
 *
 * Contrairement aux familles tri/recherche, une pile/file n'exécute pas UN
 * algorithme du début à la fin : chaque clic (empiler/dépiler, enfiler/défiler)
 * est une OPÉRATION indépendante sur une structure qui persiste entre les
 * opérations. `buildAddTrace`/`buildRemoveTrace` génèrent donc la trace d'UNE
 * seule opération (2 à 4 pas), à partir de l'état courant ; l'adaptateur
 * rejoue cette trace puis fige `steps.at(-1).array` comme nouvel état courant
 * avant la prochaine opération.
 *
 * Les vérifications de précondition qui, dans le code d'origine, ne produisent
 * AUCUNE animation (valeur vide, capacité atteinte pour l'ajout) restent du
 * ressort de l'adaptateur — seules les branches réellement animées par
 * l'algorithme (pile/file vide au retrait) vivent ici.
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

    const STACK_ADD_LINES = { fn: 'empiler-line0', incr: 'empiler-line1', assign: 'empiler-line2' };
    const STACK_REMOVE_LINES = {
        fn: 'depiler-line0', checkEmpty: 'depiler-line1', error: 'depiler-line2',
        read: 'depiler-line3', commit: 'depiler-line4', ret: 'depiler-line5'
    };
    const QUEUE_ADD_LINES = { fn: 'enfiler-line0', assign: 'enfiler-line1', incr: 'enfiler-line2' };
    const QUEUE_REMOVE_LINES = {
        fn: 'defiler-line0', checkEmpty: 'defiler-line1', error: 'defiler-line2',
        read: 'defiler-line3', commit: 'defiler-line4', ret: 'defiler-line5'
    };

    function push(steps, o, structure) {
        const m = o.marks || {};
        steps.push({
            i: steps.length,
            line: o.line || '',
            phase: o.phase || '',
            caption: o.caption || '',
            array: structure.slice(),
            marks: {
                entering: Array.isArray(m.entering) ? m.entering.slice() : [],
                removing: Array.isArray(m.removing) ? m.removing.slice() : []
            },
            ok: o.ok !== false,
            delay: o.delay || 'normal',
            removedValue: Object.prototype.hasOwnProperty.call(o, 'removedValue') ? o.removedValue : null
        });
    }

    /**
     * Trace d'un ajout (empiler pour une pile, enfiler pour une file — même
     * opération array.push(value) au fond, seuls le pseudocode et le récit
     * diffèrent). Suppose que la précondition (valeur non vide, capacité
     * disponible) a déjà été validée par l'appelant.
     */
    function buildAddTrace(structure, value, opts) {
        const options = opts || {};
        const isQueue = options.structureType === 'queue';
        const L = isQueue ? QUEUE_ADD_LINES : STACK_ADD_LINES;
        const src = Array.isArray(structure) ? structure.slice() : [];
        const verb = isQueue ? 'enfiler' : 'empiler';
        const steps = [];

        push(steps, { line: L.fn, phase: 'enter', caption: `${verb}(${value}).` }, src);

        if (isQueue) {
            push(steps, { line: L.assign, phase: 'assign', caption: `file[fin] ← ${value}.` }, src);
            const next = [...src, value];
            push(steps, {
                line: L.incr, phase: 'commit', caption: `fin++ — ${value} enfilé.`,
                marks: { entering: [next.length - 1] }
            }, next);
        } else {
            push(steps, { line: L.incr, phase: 'incr', caption: 'sommet++.' }, src);
            const next = [...src, value];
            push(steps, {
                line: L.assign, phase: 'commit', caption: `pile[sommet] ← ${value} — ${value} empilé.`,
                marks: { entering: [next.length - 1] }
            }, next);
        }
        return steps;
    }

    /**
     * Trace d'un retrait (dépiler pour une pile — dernier élément ; défiler
     * pour une file — premier élément). Modélise aussi la branche « structure
     * vide » telle que le pseudocode la décrit (si vide : erreur).
     */
    function buildRemoveTrace(structure, opts) {
        const options = opts || {};
        const isQueue = options.structureType === 'queue';
        const L = isQueue ? QUEUE_REMOVE_LINES : STACK_REMOVE_LINES;
        const src = Array.isArray(structure) ? structure.slice() : [];
        const verb = isQueue ? 'defiler' : 'depiler';
        const nomStruct = isQueue ? 'File' : 'Pile';
        const steps = [];

        push(steps, { line: L.fn, phase: 'enter', caption: `${verb}().` }, src);

        if (src.length === 0) {
            push(steps, { line: L.checkEmpty, phase: 'check-empty', caption: `Test : structure vide ?` }, src);
            push(steps, { line: L.error, phase: 'error', caption: `Erreur : "${nomStruct} vide".`, ok: false }, src);
            return steps;
        }

        const removeIndex = isQueue ? 0 : src.length - 1;
        const removedValue = src[removeIndex];
        push(steps, {
            line: L.read, phase: 'read',
            caption: isQueue ? `valeur ← file[debut] = ${removedValue}.` : `valeur ← pile[sommet] = ${removedValue}.`,
            marks: { removing: [removeIndex] }
        }, src);

        const next = isQueue ? src.slice(1) : src.slice(0, -1);
        push(steps, {
            line: L.commit, phase: 'commit',
            caption: isQueue ? `debut++ — ${removedValue} défilé.` : `sommet-- — ${removedValue} dépilé.`
        }, next);
        push(steps, {
            line: L.ret, phase: 'return', caption: `Retourner ${removedValue}.`, removedValue
        }, next);

        return steps;
    }

    return {
        STRUCTURE_TRACE_LINES: {
            stackAdd: STACK_ADD_LINES, stackRemove: STACK_REMOVE_LINES,
            queueAdd: QUEUE_ADD_LINES, queueRemove: QUEUE_REMOVE_LINES
        },
        buildAddTrace,
        buildRemoveTrace
    };
});
