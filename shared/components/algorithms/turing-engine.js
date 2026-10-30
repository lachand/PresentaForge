/**
 * turing-engine.js - moteur PUR de la machine de Turing déterministe à un ruban.
 * Aucune dépendance au DOM : la page ne fait que rejouer les pas.
 *
 * Modèle aligné sur le cours `automates/turing` (relecture 2c, B1, B2, TU-I1, TU-I2) :
 * - ruban infini des deux côtés, rempli de blancs (`_`) ; `origin` compte les cellules
 *   ajoutées à gauche, donc `head - origin` est la position relative à la première
 *   lettre de l'entrée ;
 * - l'arrivée dans un état d'acceptation ou de rejet arrête la machine ;
 * - convention des manuels : absence de transition = rejet implicite.
 *
 * Machine : { transitions: [{ from, read, to, write, dir }], acceptStates, rejectStates }.
 * Configuration : { tape, head, origin, state, steps, status, reason }
 *   status : 'running' | 'accepted' | 'rejected' ; reason : 'accept-state' |
 *   'reject-state' | 'no-transition' | null.
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

    const BLANK = '_';

    function transitionKey(state, symbol) {
        return state + ',' + symbol;
    }

    function indexTransitions(machine) {
        const index = {};
        machine.transitions.forEach(function (t, i) {
            const key = transitionKey(t.from, t.read);
            // La première règle d'une paire (état, symbole) fait foi.
            if (!(key in index)) index[key] = { transition: t, ruleIndex: i };
        });
        return index;
    }

    function haltedStatus(machine, state) {
        if (machine.acceptStates.indexOf(state) !== -1) return { status: 'accepted', reason: 'accept-state' };
        if (machine.rejectStates.indexOf(state) !== -1) return { status: 'rejected', reason: 'reject-state' };
        return { status: 'running', reason: null };
    }

    function initTuring(machine, input) {
        const tape = String(input || '').split('');
        if (!tape.length) tape.push(BLANK);
        const state = machine.startState || 'q0';
        const halted = haltedStatus(machine, state);
        return {
            tape: tape, head: 0, origin: 0, state: state, steps: 0,
            status: halted.status, reason: halted.reason, ruleIndex: -1
        };
    }

    /** Un pas. Ne modifie pas la configuration reçue. */
    function stepTuring(machine, config, index) {
        if (config.status !== 'running') return config;
        const rules = index || indexTransitions(machine);
        const symbol = config.tape[config.head] || BLANK;
        const hit = rules[transitionKey(config.state, symbol)];
        if (!hit) {
            return Object.assign({}, config, { status: 'rejected', reason: 'no-transition', ruleIndex: -1, lastRead: symbol });
        }
        const t = hit.transition;
        const tape = config.tape.slice();
        tape[config.head] = t.write;
        let head = config.head;
        let origin = config.origin;
        if (t.dir === 'R') head++;
        else if (t.dir === 'L') head--;
        if (head < 0) {
            tape.unshift(BLANK);
            head = 0;
            origin++;
        }
        if (head >= tape.length) tape.push(BLANK);
        const halted = haltedStatus(machine, t.to);
        return {
            tape: tape, head: head, origin: origin, state: t.to, steps: config.steps + 1,
            status: halted.status, reason: halted.reason, ruleIndex: hit.ruleIndex,
            lastRead: symbol, lastFromHead: config.head - config.origin
        };
    }

    /** Exécution complète, bornée par maxSteps. `limited` vaut true si la borne est atteinte. */
    function runTuring(machine, input, maxSteps) {
        const limit = maxSteps || 10000;
        const index = indexTransitions(machine);
        let config = initTuring(machine, input);
        while (config.status === 'running' && config.steps < limit) {
            config = stepTuring(machine, config, index);
        }
        return { config: config, steps: config.steps, limited: config.status === 'running' };
    }

    /** Contenu du ruban sans les blancs de bordure. */
    function tapeContent(config) {
        return config.tape.join('').replace(/^_+|_+$/g, '');
    }

    const EXAMPLES = {
        anbn: {
            label: '0ⁿ1ⁿ (autant de 0 puis autant de 1)',
            input: '0011',
            transitions: [
                { from: 'q0', read: '0', to: 'q1', write: 'X', dir: 'R' },
                { from: 'q0', read: 'Y', to: 'q3', write: 'Y', dir: 'R' },
                { from: 'q0', read: BLANK, to: 'q_acc', write: BLANK, dir: 'R' },
                { from: 'q1', read: '0', to: 'q1', write: '0', dir: 'R' },
                { from: 'q1', read: 'Y', to: 'q1', write: 'Y', dir: 'R' },
                { from: 'q1', read: '1', to: 'q2', write: 'Y', dir: 'L' },
                { from: 'q2', read: '0', to: 'q2', write: '0', dir: 'L' },
                { from: 'q2', read: 'Y', to: 'q2', write: 'Y', dir: 'L' },
                { from: 'q2', read: 'X', to: 'q0', write: 'X', dir: 'R' },
                { from: 'q3', read: 'Y', to: 'q3', write: 'Y', dir: 'R' },
                { from: 'q3', read: BLANK, to: 'q_acc', write: BLANK, dir: 'R' }
            ],
            acceptStates: ['q_acc'],
            rejectStates: ['q_rej']
        },
        increment: {
            label: 'Incrément binaire (calcule une fonction)',
            input: '1011',
            transitions: [
                { from: 'q0', read: '0', to: 'q0', write: '0', dir: 'R' },
                { from: 'q0', read: '1', to: 'q0', write: '1', dir: 'R' },
                { from: 'q0', read: BLANK, to: 'q1', write: BLANK, dir: 'L' },
                { from: 'q1', read: '0', to: 'q_acc', write: '1', dir: 'R' },
                { from: 'q1', read: '1', to: 'q1', write: '0', dir: 'L' },
                { from: 'q1', read: BLANK, to: 'q_acc', write: '1', dir: 'R' }
            ],
            acceptStates: ['q_acc'],
            rejectStates: ['q_rej']
        },
        palindrome: {
            label: 'Palindromes sur {a, b}',
            input: 'abba',
            transitions: [
                { from: 'q0', read: 'a', to: 'qa', write: BLANK, dir: 'R' },
                { from: 'q0', read: 'b', to: 'qb', write: BLANK, dir: 'R' },
                { from: 'q0', read: BLANK, to: 'q_acc', write: BLANK, dir: 'R' },
                { from: 'qa', read: 'a', to: 'qa', write: 'a', dir: 'R' },
                { from: 'qa', read: 'b', to: 'qa', write: 'b', dir: 'R' },
                { from: 'qa', read: BLANK, to: 'qa2', write: BLANK, dir: 'L' },
                { from: 'qa2', read: 'a', to: 'qback', write: BLANK, dir: 'L' },
                { from: 'qa2', read: 'b', to: 'q_rej', write: 'b', dir: 'R' },
                { from: 'qa2', read: BLANK, to: 'q_acc', write: BLANK, dir: 'R' },
                { from: 'qb', read: 'a', to: 'qb', write: 'a', dir: 'R' },
                { from: 'qb', read: 'b', to: 'qb', write: 'b', dir: 'R' },
                { from: 'qb', read: BLANK, to: 'qb2', write: BLANK, dir: 'L' },
                { from: 'qb2', read: 'b', to: 'qback', write: BLANK, dir: 'L' },
                { from: 'qb2', read: 'a', to: 'q_rej', write: 'a', dir: 'R' },
                { from: 'qb2', read: BLANK, to: 'q_acc', write: BLANK, dir: 'R' },
                { from: 'qback', read: 'a', to: 'qback', write: 'a', dir: 'L' },
                { from: 'qback', read: 'b', to: 'qback', write: 'b', dir: 'L' },
                { from: 'qback', read: BLANK, to: 'q0', write: BLANK, dir: 'R' }
            ],
            acceptStates: ['q_acc'],
            rejectStates: ['q_rej']
        },
        copy: {
            label: 'Copie un mot après le séparateur #',
            input: 'aaa#',
            transitions: [
                { from: 'q0', read: 'a', to: 'q1a', write: 'X', dir: 'R' },
                { from: 'q0', read: 'b', to: 'q1b', write: 'X', dir: 'R' },
                { from: 'q0', read: '#', to: 'q_acc', write: '#', dir: 'R' },
                { from: 'q1a', read: 'a', to: 'q1a', write: 'a', dir: 'R' },
                { from: 'q1a', read: 'b', to: 'q1a', write: 'b', dir: 'R' },
                { from: 'q1a', read: '#', to: 'q2a', write: '#', dir: 'R' },
                { from: 'q1b', read: 'a', to: 'q1b', write: 'a', dir: 'R' },
                { from: 'q1b', read: 'b', to: 'q1b', write: 'b', dir: 'R' },
                { from: 'q1b', read: '#', to: 'q2b', write: '#', dir: 'R' },
                { from: 'q2a', read: BLANK, to: 'q3', write: 'a', dir: 'L' },
                { from: 'q2a', read: 'a', to: 'q2a', write: 'a', dir: 'R' },
                { from: 'q2a', read: 'b', to: 'q2a', write: 'b', dir: 'R' },
                { from: 'q2b', read: BLANK, to: 'q3', write: 'b', dir: 'L' },
                { from: 'q2b', read: 'a', to: 'q2b', write: 'a', dir: 'R' },
                { from: 'q2b', read: 'b', to: 'q2b', write: 'b', dir: 'R' },
                { from: 'q3', read: 'a', to: 'q3', write: 'a', dir: 'L' },
                { from: 'q3', read: 'b', to: 'q3', write: 'b', dir: 'L' },
                { from: 'q3', read: '#', to: 'q4', write: '#', dir: 'L' },
                { from: 'q4', read: 'a', to: 'q4', write: 'a', dir: 'L' },
                { from: 'q4', read: 'b', to: 'q4', write: 'b', dir: 'L' },
                { from: 'q4', read: 'X', to: 'q0', write: 'X', dir: 'R' }
            ],
            acceptStates: ['q_acc'],
            rejectStates: ['q_rej']
        }
    };

    return {
        TURING_BLANK: BLANK,
        TURING_EXAMPLES: EXAMPLES,
        initTuring: initTuring,
        stepTuring: stepTuring,
        runTuring: runTuring,
        indexTuringTransitions: indexTransitions,
        tapeContent: tapeContent
    };
});
