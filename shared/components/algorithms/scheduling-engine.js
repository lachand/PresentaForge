/**
 * scheduling-engine.js - moteur PUR d'ordonnancement CPU (FCFS, SJF, SRTF, Round Robin, priorité
 * avec vieillissement). Aucune dépendance au DOM : la page et le widget de slides affichent ce
 * que ce moteur calcule (relecture 3b, B3, OR-I1, OR-I2, décision (b)).
 *
 * Conventions (communes à la page, au widget et au cours) :
 * - temps entier ; un processus : { name, arrival, burst, priority } ;
 * - départage : arrivée la plus ancienne, puis ordre de saisie ;
 * - un nombre de priorité plus petit signifie une priorité plus forte (0 est la plus forte) ;
 * - Round Robin : un processus qui arrive pendant une tranche est placé dans la file AVANT le
 *   processus préempté à la fin de cette tranche ;
 * - vieillissement (aging) : la priorité effective gagne un cran (valeur - 1, plancher 0) toutes
 *   les `agingEvery` unités passées à attendre depuis l'arrivée ;
 * - SJF et priorité sont non préemptifs ; SRTF est la version préemptive de SJF (décision à
 *   chaque unité de temps).
 *
 * schedulerRun(procs, opts) retourne { slices, processes, avgWait, avgTurnaround, avgResponse,
 *   cpuUtil, contextSwitches, makespan }. Une tranche : { id, name, start, end, idle }.
 *   Les tranches consécutives d'un même processus (quantum épuisé alors qu'il est seul) restent
 *   séparées ; contextSwitches ne compte que les passages d'un processus à un AUTRE processus.
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

    const ALGORITHMS = ['fcfs', 'sjf', 'srtf', 'rr', 'priority'];

    const COURSE_EXAMPLE = [
        { name: 'P1', arrival: 0, burst: 8, priority: 2 },
        { name: 'P2', arrival: 0, burst: 4, priority: 1 },
        { name: 'P3', arrival: 0, burst: 2, priority: 3 }
    ];

    /** Arrivées décalées : met en évidence la préemption de SRTF (attente moyenne 2,67 contre 5,00 en SJF). */
    const STAGGERED_EXAMPLE = [
        { name: 'P1', arrival: 0, burst: 8, priority: 2 },
        { name: 'P2', arrival: 1, burst: 4, priority: 1 },
        { name: 'P3', arrival: 2, burst: 2, priority: 3 }
    ];

    function normalize(procs) {
        return procs.map((p, i) => ({
            id: i,
            name: p.name || ('P' + (i + 1)),
            arrival: Math.max(0, Math.floor(Number(p.arrival) || 0)),
            burst: Math.max(1, Math.floor(Number(p.burst) || 1)),
            priority: Math.max(0, Math.floor(Number(p.priority) || 0))
        }));
    }

    function byTie(a, b) {
        return a.arrival - b.arrival || a.id - b.id;
    }

    function effectivePriority(p, t, opts) {
        if (!opts.aging) return p.priority;
        const every = Math.max(1, opts.agingEvery || 5);
        return Math.max(0, p.priority - Math.floor(Math.max(0, t - p.arrival) / every));
    }

    function pushSlice(slices, id, name, start, end, idle, merge) {
        const last = slices[slices.length - 1];
        if (merge && last && !idle && !last.idle && last.id === id && last.end === start) {
            last.end = end;
            return;
        }
        slices.push({ id: id, name: name, start: start, end: end, idle: !!idle });
    }

    function nextArrival(procs, rem, t) {
        let next = Infinity;
        procs.forEach((p) => { if (rem[p.id] > 0 && p.arrival > t) next = Math.min(next, p.arrival); });
        return next;
    }

    /** Ordonnancement par choix à la fin de chaque exécution (FCFS, SJF, priorité) ou à chaque unité (SRTF). */
    function runSelection(procs, algo, opts) {
        const rem = procs.map((p) => p.burst);
        const slices = [];
        const completion = {};
        const firstRun = {};
        let t = 0;
        let left = procs.length;
        const preemptive = algo === 'srtf';
        while (left > 0) {
            const ready = procs.filter((p) => rem[p.id] > 0 && p.arrival <= t);
            if (!ready.length) {
                const nx = nextArrival(procs, rem, t);
                pushSlice(slices, -1, 'Idle', t, nx, true, false);
                t = nx;
                continue;
            }
            let chosen;
            if (algo === 'fcfs') {
                chosen = ready.slice().sort(byTie)[0];
            } else if (algo === 'sjf') {
                chosen = ready.slice().sort((a, b) => a.burst - b.burst || byTie(a, b))[0];
            } else if (algo === 'srtf') {
                chosen = ready.slice().sort((a, b) => rem[a.id] - rem[b.id] || byTie(a, b))[0];
            } else {
                chosen = ready.slice().sort((a, b) => effectivePriority(a, t, opts) - effectivePriority(b, t, opts) || byTie(a, b))[0];
            }
            const run = preemptive ? 1 : rem[chosen.id];
            if (firstRun[chosen.id] === undefined) firstRun[chosen.id] = t;
            pushSlice(slices, chosen.id, chosen.name, t, t + run, false, preemptive);
            t += run;
            rem[chosen.id] -= run;
            if (rem[chosen.id] === 0) { completion[chosen.id] = t; left -= 1; }
        }
        return { slices: slices, completion: completion, firstRun: firstRun };
    }

    function runRoundRobin(procs, quantum) {
        const q = Math.max(1, Math.floor(Number(quantum) || 1));
        const order = procs.slice().sort(byTie);
        const rem = procs.map((p) => p.burst);
        const slices = [];
        const completion = {};
        const firstRun = {};
        const queue = [];
        let idx = 0;
        let t = 0;
        let left = procs.length;
        const admit = () => {
            while (idx < order.length && order[idx].arrival <= t) { queue.push(order[idx]); idx += 1; }
        };
        admit();
        while (left > 0) {
            if (!queue.length) {
                const nx = order[idx].arrival;
                pushSlice(slices, -1, 'Idle', t, nx, true, false);
                t = nx;
                admit();
                continue;
            }
            const cur = queue.shift();
            const run = Math.min(q, rem[cur.id]);
            if (firstRun[cur.id] === undefined) firstRun[cur.id] = t;
            pushSlice(slices, cur.id, cur.name, t, t + run, false, false);
            t += run;
            rem[cur.id] -= run;
            admit();
            if (rem[cur.id] > 0) queue.push(cur);
            else { completion[cur.id] = t; left -= 1; }
        }
        return { slices: slices, completion: completion, firstRun: firstRun };
    }

    function countContextSwitches(slices) {
        let prev = -1;
        let n = 0;
        slices.forEach((s) => {
            if (s.idle) return;
            if (prev !== -1 && s.id !== prev) n += 1;
            prev = s.id;
        });
        return n;
    }

    /**
     * opts : { algo = 'fcfs', quantum = 2, aging = false, agingEvery = 5 }.
     */
    function schedulerRun(inputProcs, options) {
        const opts = Object.assign({ algo: 'fcfs', quantum: 2, aging: false, agingEvery: 5 }, options || {});
        const procs = normalize(inputProcs);
        if (!procs.length) {
            return { slices: [], processes: [], avgWait: 0, avgTurnaround: 0, avgResponse: 0, cpuUtil: 0, contextSwitches: 0, makespan: 0 };
        }
        const run = opts.algo === 'rr' ? runRoundRobin(procs, opts.quantum) : runSelection(procs, ALGORITHMS.indexOf(opts.algo) === -1 ? 'fcfs' : opts.algo, opts);
        let tw = 0;
        let tt = 0;
        let tr = 0;
        let burstTotal = 0;
        let makespan = 0;
        const processes = procs.map((p) => {
            const completion = run.completion[p.id];
            const turnaround = completion - p.arrival;
            const waiting = turnaround - p.burst;
            const response = run.firstRun[p.id] - p.arrival;
            tw += waiting; tt += turnaround; tr += response; burstTotal += p.burst;
            makespan = Math.max(makespan, completion);
            return { id: p.id, name: p.name, arrival: p.arrival, burst: p.burst, priority: p.priority, completion: completion, turnaround: turnaround, waiting: waiting, response: response };
        });
        const n = procs.length;
        return {
            slices: run.slices,
            processes: processes,
            avgWait: tw / n,
            avgTurnaround: tt / n,
            avgResponse: tr / n,
            cpuUtil: makespan > 0 ? burstTotal / makespan : 0,
            contextSwitches: countContextSwitches(run.slices),
            makespan: makespan
        };
    }

    return {
        SCHEDULER_ALGORITHMS: ALGORITHMS,
        SCHEDULER_COURSE_EXAMPLE: COURSE_EXAMPLE,
        SCHEDULER_STAGGERED_EXAMPLE: STAGGERED_EXAMPLE,
        schedulerRun: schedulerRun
    };
});
