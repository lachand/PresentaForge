/**
 * mutex-model.js - modèle PUR de deux threads qui incrémentent un compteur partagé (avec ou sans
 * verrou) et de deux threads qui prennent deux verrous (ordres opposés ou ordre global).
 * Aucune dépendance au DOM (relecture 3b, B7, CO-I1, CO-I2, décision (g)).
 *
 * Idée : le résultat d'une course dépend de l'ORDONNANCEMENT choisi, pas seulement de l'absence de
 * verrou. Trois façons de choisir le prochain thread :
 * - 'alternate'  : un pas de chaque thread à tour de rôle ;
 * - 'sequential' : T1 va jusqu'au bout, puis T2 ;
 * - choix manuel : l'appelant passe l'identifiant du thread à faire avancer.
 *
 * Un incrément = [acquire] read, add, write [release] ; les étapes entre crochets n'existent qu'avec
 * verrou. Un thread qui demande un verrou détenu par l'autre est BLOQUÉ : son pas est un tour perdu.
 *
 * Verrous multiples (deadlock) : chaque thread prend deux ressources dans son ordre puis les relâche ;
 * les quatre conditions de l'interblocage (exclusion mutuelle, détention et attente, pas de
 * préemption, attente circulaire) sont réunies quand les ordres sont opposés et les pas entrelacés.
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

    const THREADS = ['T1', 'T2'];
    const other = (id) => (id === 'T1' ? 'T2' : 'T1');

    // ── Compteur partagé ────────────────────────────────────────────────────

    function mutexPhases(withLock) {
        return withLock ? ['acquire', 'read', 'add', 'write', 'release'] : ['read', 'add', 'write'];
    }

    /** opts : { withLock = true, increments = 3 }. */
    function mutexNew(opts) {
        const o = Object.assign({ withLock: true, increments: 3 }, opts || {});
        const target = Math.max(1, Math.floor(o.increments) || 1);
        return {
            withLock: !!o.withLock,
            phases: mutexPhases(!!o.withLock),
            counter: 0,
            owner: null,
            turn: 'T1',
            steps: 0,
            lostTurns: 0,
            logs: [],
            threads: {
                T1: { phase: 0, local: null, done: 0, target: target },
                T2: { phase: 0, local: null, done: 0, target: target }
            }
        };
    }

    function mutexExpected(state) {
        return state.threads.T1.target + state.threads.T2.target;
    }

    function mutexThreadDone(state, id) {
        return state.threads[id].done >= state.threads[id].target;
    }

    function mutexIsDone(state) {
        return mutexThreadDone(state, 'T1') && mutexThreadDone(state, 'T2');
    }

    /** Vrai si le thread attend un verrou détenu par l'autre. */
    function mutexBlocked(state, id) {
        const t = state.threads[id];
        return state.withLock && state.phases[t.phase] === 'acquire' && state.owner !== null && state.owner !== id && !mutexThreadDone(state, id);
    }

    function pushLog(state, text) {
        state.logs.unshift(text);
        if (state.logs.length > 12) state.logs.length = 12;
    }

    /**
     * Fait avancer le thread `id` d'un pas. Retourne { thread, action, blocked }.
     * Un thread terminé ne fait rien ; un thread bloqué perd son tour.
     */
    function mutexStep(state, id) {
        const t = state.threads[id];
        if (mutexThreadDone(state, id)) return { thread: id, action: 'done', blocked: false };
        state.steps += 1;
        if (mutexBlocked(state, id)) {
            state.lostTurns += 1;
            pushLog(state, id + ' est bloqué (tour perdu) : le verrou est détenu par ' + state.owner + '.');
            return { thread: id, action: 'blocked', blocked: true };
        }
        const action = state.phases[t.phase];
        switch (action) {
            case 'acquire':
                state.owner = id;
                pushLog(state, id + ' prend le verrou.');
                break;
            case 'read':
                t.local = state.counter;
                pushLog(state, id + ' lit counter = ' + state.counter + '.');
                break;
            case 'add':
                t.local += 1;
                pushLog(state, id + ' calcule local = ' + t.local + '.');
                break;
            case 'write':
                state.counter = t.local;
                pushLog(state, id + ' écrit counter = ' + state.counter + '.');
                break;
            default:
                state.owner = null;
                pushLog(state, id + ' libère le verrou.');
        }
        t.phase += 1;
        if (t.phase >= state.phases.length) {
            t.phase = 0;
            t.local = null;
            t.done += 1;
        }
        return { thread: id, action: action, blocked: false };
    }

    /** Thread choisi par l'ordonnancement ('alternate' ou 'sequential'), sans l'exécuter. */
    function mutexPick(state, schedule) {
        if (schedule === 'sequential') return mutexThreadDone(state, 'T1') ? 'T2' : 'T1';
        const turn = state.turn;
        return mutexThreadDone(state, turn) ? other(turn) : turn;
    }

    /** Un pas selon l'ordonnancement ; en alternance, le tour passe à l'autre thread. */
    function mutexAdvance(state, schedule) {
        const id = mutexPick(state, schedule);
        const result = mutexStep(state, id);
        if (schedule !== 'sequential') state.turn = other(id);
        return result;
    }

    /**
     * Exécute tout le programme. opts : { withLock, increments, schedule = 'alternate'|'sequential'|'random', seed }.
     * Retourne { counter, expected, steps, lostTurns, lostUpdates }.
     */
    function mutexRunAll(opts) {
        const o = Object.assign({ schedule: 'alternate', seed: 1 }, opts || {});
        const state = mutexNew(o);
        let seed = o.seed >>> 0 || 1;
        const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        let guard = 0;
        while (!mutexIsDone(state) && guard < 5000000) {
            guard += 1;
            if (o.schedule === 'random') {
                const live = THREADS.filter((id) => !mutexThreadDone(state, id));
                mutexStep(state, live[Math.floor(rnd() * live.length)]);
            } else {
                mutexAdvance(state, o.schedule);
            }
        }
        const expected = mutexExpected(state);
        return { counter: state.counter, expected: expected, steps: state.steps, lostTurns: state.lostTurns, lostUpdates: expected - state.counter };
    }

    /** Résultats finals possibles sur TOUS les entrelacements (verrou : seuls les pas exécutables sont choisis). */
    function mutexEnumerate(opts) {
        const finals = new Set();
        const clone = (s) => JSON.parse(JSON.stringify(s));
        (function walk(state) {
            if (mutexIsDone(state)) { finals.add(state.counter); return; }
            THREADS.forEach((id) => {
                if (mutexThreadDone(state, id) || mutexBlocked(state, id)) return;
                const next = clone(state);
                mutexStep(next, id);
                walk(next);
            });
        })(mutexNew(opts));
        return finals;
    }

    // ── Deux verrous (interblocage) ─────────────────────────────────────────

    /** opts : { ordered = false } ; ordered : T2 prend R1 puis R2 comme T1 (ordre global). */
    function deadlockNew(opts) {
        const ordered = !!(opts && opts.ordered);
        return {
            ordered: ordered,
            owners: { R1: null, R2: null },
            turn: 'T1',
            deadlocked: false,
            done: false,
            logs: [],
            threads: {
                T1: { step: 0, waitingFor: null, order: ['R1', 'R2'] },
                T2: { step: 0, waitingFor: null, order: ordered ? ['R1', 'R2'] : ['R2', 'R1'] }
            }
        };
    }

    function dlPush(state, text) {
        state.logs.unshift(text);
        if (state.logs.length > 12) state.logs.length = 12;
    }

    function deadlockThreadDone(state, id) {
        return state.threads[id].step >= 3;
    }

    function dlDetect(state) {
        const a = state.threads.T1;
        const b = state.threads.T2;
        if (!a.waitingFor || !b.waitingFor) return false;
        return state.owners[a.waitingFor] === 'T2' && state.owners[b.waitingFor] === 'T1';
    }

    /** Un pas du thread `id` : prendre le premier verrou, le second, puis tout relâcher. */
    function deadlockStep(state, id) {
        if (state.done || state.deadlocked || deadlockThreadDone(state, id)) return { thread: id, blocked: false };
        const t = state.threads[id];
        let blocked = false;
        if (t.step < 2) {
            const res = t.order[t.step];
            const holder = state.owners[res];
            if (holder === null) {
                state.owners[res] = id;
                t.waitingFor = null;
                t.step += 1;
                dlPush(state, id + ' prend ' + res + '.');
            } else {
                t.waitingFor = res;
                blocked = true;
                dlPush(state, id + ' attend ' + res + ' (détenu par ' + holder + ', tour perdu).');
            }
        } else {
            ['R1', 'R2'].forEach((r) => { if (state.owners[r] === id) state.owners[r] = null; });
            t.waitingFor = null;
            t.step = 3;
            dlPush(state, id + ' relâche ses verrous.');
        }
        if (dlDetect(state)) {
            state.deadlocked = true;
            dlPush(state, 'Interblocage : T1 attend ce que T2 détient et T2 attend ce que T1 détient.');
        } else if (deadlockThreadDone(state, 'T1') && deadlockThreadDone(state, 'T2')) {
            state.done = true;
            dlPush(state, 'Terminé sans interblocage.');
        }
        return { thread: id, blocked: blocked };
    }

    function deadlockPick(state, schedule) {
        if (schedule === 'sequential') return deadlockThreadDone(state, 'T1') ? 'T2' : 'T1';
        return deadlockThreadDone(state, state.turn) ? other(state.turn) : state.turn;
    }

    /** Thread qui sera choisi par l'ordonnancement, pour l'affichage (« tour courant »). */
    function deadlockPickLabel(state, schedule) {
        return deadlockPick(state, schedule);
    }

    function deadlockAdvance(state, schedule) {
        const id = deadlockPick(state, schedule);
        const result = deadlockStep(state, id);
        if (schedule !== 'sequential') state.turn = other(id);
        return result;
    }

    /** Exécute jusqu'à la fin ou l'interblocage : { deadlocked, done, steps }. */
    function deadlockRunAll(opts) {
        const o = Object.assign({ schedule: 'alternate' }, opts || {});
        const state = deadlockNew(o);
        let steps = 0;
        while (!state.done && !state.deadlocked && steps < 1000) { deadlockAdvance(state, o.schedule); steps += 1; }
        return { deadlocked: state.deadlocked, done: state.done, steps: steps };
    }

    /** Vrai si le thread voudrait un verrou détenu par l'autre. */
    function deadlockBlocked(state, id) {
        const t = state.threads[id];
        if (t.step >= 2) return false;
        const holder = state.owners[t.order[t.step]];
        return holder !== null && holder !== id;
    }

    /** Vrai si au moins un entrelacement conduit à l'interblocage (exploration complète). */
    function deadlockPossible(opts) {
        const clone = (s) => JSON.parse(JSON.stringify(s));
        let found = false;
        (function walk(state) {
            if (found) return;
            if (state.deadlocked) { found = true; return; }
            if (state.done) return;
            const movable = THREADS.filter((id) => !deadlockThreadDone(state, id) && !deadlockBlocked(state, id));
            if (!movable.length) { found = true; return; }
            movable.forEach((id) => {
                const next = clone(state);
                deadlockStep(next, id);
                walk(next);
            });
        })(deadlockNew(opts));
        return found;
    }

    return {
        MUTEX_THREADS: THREADS,
        mutexNew: mutexNew,
        mutexExpected: mutexExpected,
        mutexIsDone: mutexIsDone,
        mutexThreadDone: mutexThreadDone,
        mutexBlocked: mutexBlocked,
        mutexStep: mutexStep,
        mutexAdvance: mutexAdvance,
        mutexPick: mutexPick,
        mutexRunAll: mutexRunAll,
        mutexEnumerate: mutexEnumerate,
        deadlockNew: deadlockNew,
        deadlockStep: deadlockStep,
        deadlockPickLabel: deadlockPickLabel,
        deadlockAdvance: deadlockAdvance,
        deadlockThreadDone: deadlockThreadDone,
        deadlockBlocked: deadlockBlocked,
        deadlockRunAll: deadlockRunAll,
        deadlockPossible: deadlockPossible
    };
});
