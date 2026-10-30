/**
 * structure-traces.js - générateurs de trace PURS pour pile (stack, LIFO) et
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
 * AUCUNE animation (valeur vide, capacité atteinte pour l'ajout à la pile)
 * restent du ressort de l'adaptateur - seules les branches réellement animées par
 * l'algorithme (pile vide au retrait ; file pleine ou vide) vivent ici.
 *
 * La FILE est un tableau circulaire de capacité fixe (`createCircularQueue`,
 * `buildCircularEnqueueTrace`, `buildCircularDequeueTrace`) : deux indices
 * `debut` et `fin` avancent modulo la capacité et un compteur `taille`
 * distingue file pleine et file vide. Un pas porte alors `slots` (toutes les
 * cases, `null` si libre) et `vars` ({ debut, fin, taille, capacite }) en plus
 * de `array` (contenu logique, du plus ancien au plus récent).
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
    const QUEUE_ADD_LINES = {
        fn: 'enfiler-line0', checkFull: 'enfiler-line1', error: 'enfiler-line2',
        assign: 'enfiler-line3', advance: 'enfiler-line4', count: 'enfiler-line5'
    };
    const QUEUE_REMOVE_LINES = {
        fn: 'defiler-line0', checkEmpty: 'defiler-line1', error: 'defiler-line2',
        read: 'defiler-line3', advance: 'defiler-line4', count: 'defiler-line5', ret: 'defiler-line6'
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
     * Trace d'un ajout (empiler pour une pile, enfiler pour une file - même
     * opération array.push(value) au fond, seuls le pseudocode et le récit
     * diffèrent). Suppose que la précondition (valeur non vide, capacité
     * disponible) a déjà été validée par l'appelant.
     */
    function buildAddTrace(structure, value, opts) {
        const options = opts || {};
        assertStack(options);
        const L = STACK_ADD_LINES;
        const src = Array.isArray(structure) ? structure.slice() : [];
        const steps = [];

        push(steps, { line: L.fn, phase: 'enter', caption: `empiler(${value}).` }, src);
        push(steps, { line: L.incr, phase: 'incr', caption: 'sommet++.' }, src);
        const next = [...src, value];
        push(steps, {
            line: L.assign, phase: 'commit', caption: `pile[sommet] ← ${value} - ${value} empilé.`,
            marks: { entering: [next.length - 1] }
        }, next);
        return steps;
    }

    /**
     * Trace d'un retrait (dépiler pour une pile - dernier élément ; défiler
     * pour une file - premier élément). Modélise aussi la branche « structure
     * vide » telle que le pseudocode la décrit (si vide : erreur).
     */
    function buildRemoveTrace(structure, opts) {
        const options = opts || {};
        assertStack(options);
        const L = STACK_REMOVE_LINES;
        const src = Array.isArray(structure) ? structure.slice() : [];
        const steps = [];

        push(steps, { line: L.fn, phase: 'enter', caption: 'depiler().' }, src);

        if (src.length === 0) {
            push(steps, { line: L.checkEmpty, phase: 'check-empty', caption: 'Test : pile vide ?' }, src);
            push(steps, { line: L.error, phase: 'error', caption: 'Erreur : "Pile vide".', ok: false }, src);
            return steps;
        }

        const removeIndex = src.length - 1;
        const removedValue = src[removeIndex];
        push(steps, {
            line: L.read, phase: 'read',
            caption: `valeur ← pile[sommet] = ${removedValue}.`,
            marks: { removing: [removeIndex] }
        }, src);

        const next = src.slice(0, -1);
        push(steps, {
            line: L.commit, phase: 'commit',
            caption: `sommet-- - ${removedValue} dépilé.`
        }, next);
        push(steps, {
            line: L.ret, phase: 'return', caption: `Retourner ${removedValue}.`, removedValue
        }, next);

        return steps;
    }

    function assertStack(options) {
        if (options.structureType === 'queue') {
            throw new Error('La file est un tableau circulaire : utiliser buildCircularEnqueueTrace / buildCircularDequeueTrace.');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // File circulaire (capacité fixe, `taille` distingue plein et vide)
    // ─────────────────────────────────────────────────────────────────────────

    function createCircularQueue(capacite) {
        const cap = Math.max(1, Number(capacite) || 1);
        return { slots: new Array(cap).fill(null), debut: 0, fin: 0, taille: 0, capacite: cap };
    }

    function cloneQueue(q) {
        return { slots: q.slots.slice(), debut: q.debut, fin: q.fin, taille: q.taille, capacite: q.capacite };
    }

    /** Contenu logique (du plus ancien au plus récent) d'un état de file circulaire. */
    function queueContent(q) {
        const out = [];
        for (let k = 0; k < q.taille; k += 1) out.push(q.slots[(q.debut + k) % q.capacite]);
        return out;
    }

    function pushQueue(steps, q, o) {
        const m = o.marks || {};
        steps.push({
            i: steps.length,
            line: o.line || '',
            phase: o.phase || '',
            caption: o.caption || '',
            array: queueContent(q),
            slots: q.slots.slice(),
            vars: { debut: q.debut, fin: q.fin, taille: q.taille, capacite: q.capacite },
            marks: {
                entering: Array.isArray(m.entering) ? m.entering.slice() : [],
                removing: Array.isArray(m.removing) ? m.removing.slice() : []
            },
            ok: o.ok !== false,
            delay: o.delay || 'normal',
            removedValue: Object.prototype.hasOwnProperty.call(o, 'removedValue') ? o.removedValue : null
        });
    }

    /** État de file à reprendre après une trace (dernier pas). */
    function queueStateFromStep(step) {
        return { slots: step.slots.slice(), debut: step.vars.debut, fin: step.vars.fin, taille: step.vars.taille, capacite: step.vars.capacite };
    }

    function buildCircularEnqueueTrace(queue, value) {
        const L = QUEUE_ADD_LINES;
        const q = cloneQueue(queue);
        const steps = [];

        pushQueue(steps, q, { line: L.fn, phase: 'enter', caption: `enfiler(${value}).` });
        pushQueue(steps, q, {
            line: L.checkFull, phase: 'check-full',
            caption: `Test : file pleine ? taille = ${q.taille}, capacité = ${q.capacite}.`
        });
        if (q.taille === q.capacite) {
            pushQueue(steps, q, { line: L.error, phase: 'error', caption: 'Erreur : "File pleine".', ok: false });
            return steps;
        }

        const slot = q.fin;
        q.slots[slot] = value;
        pushQueue(steps, q, {
            line: L.assign, phase: 'assign', caption: `file[${slot}] ← ${value}.`, marks: { entering: [slot] }
        });
        q.fin = (q.fin + 1) % q.capacite;
        pushQueue(steps, q, {
            line: L.advance, phase: 'advance',
            caption: `fin ← (${slot} + 1) % ${q.capacite} = ${q.fin}.`, marks: { entering: [slot] }
        });
        q.taille += 1;
        pushQueue(steps, q, {
            line: L.count, phase: 'commit', caption: `taille++ → ${q.taille}. ${value} enfilé.`, marks: { entering: [slot] }
        });
        return steps;
    }

    function buildCircularDequeueTrace(queue) {
        const L = QUEUE_REMOVE_LINES;
        const q = cloneQueue(queue);
        const steps = [];

        pushQueue(steps, q, { line: L.fn, phase: 'enter', caption: 'defiler().' });
        pushQueue(steps, q, {
            line: L.checkEmpty, phase: 'check-empty', caption: `Test : file vide ? taille = ${q.taille}.`
        });
        if (q.taille === 0) {
            pushQueue(steps, q, { line: L.error, phase: 'error', caption: 'Erreur : "File vide".', ok: false });
            return steps;
        }

        const slot = q.debut;
        const removedValue = q.slots[slot];
        pushQueue(steps, q, {
            line: L.read, phase: 'read', caption: `valeur ← file[${slot}] = ${removedValue}.`, marks: { removing: [slot] }
        });
        q.slots[slot] = null;
        q.debut = (q.debut + 1) % q.capacite;
        pushQueue(steps, q, {
            line: L.advance, phase: 'advance',
            caption: `debut ← (${slot} + 1) % ${q.capacite} = ${q.debut}.`, marks: { removing: [slot] }
        });
        q.taille -= 1;
        pushQueue(steps, q, { line: L.count, phase: 'commit', caption: `taille-- → ${q.taille}.` });
        pushQueue(steps, q, { line: L.ret, phase: 'return', caption: `Retourner ${removedValue}.`, removedValue });
        return steps;
    }


    return {
        STRUCTURE_TRACE_LINES: {
            stackAdd: STACK_ADD_LINES, stackRemove: STACK_REMOVE_LINES,
            queueAdd: QUEUE_ADD_LINES, queueRemove: QUEUE_REMOVE_LINES
        },
        buildAddTrace,
        buildRemoveTrace,
        createCircularQueue,
        queueContent,
        queueStateFromStep,
        buildCircularEnqueueTrace,
        buildCircularDequeueTrace
    };
});
