/**
 * pipeline-engine.js - moteur PUR du pipeline RISC à cinq étages (IF, ID, EX, MEM, WB).
 * Aucune dépendance au DOM : la page et le widget de slides ne font qu'afficher la trace.
 *
 * Modèle de référence (relecture 3b, B2, décision (a)) :
 * - une instruction par cycle au mieux, cycles numérotés à partir de 1, ordre du programme respecté ;
 * - le fichier de registres est écrit en première moitié de cycle (WB) et lu en seconde (ID) :
 *   un consommateur peut donc lire en ID pendant le cycle WB de son producteur ;
 * - sans forwarding : le consommateur attend que le producteur ait écrit (2 stalls à distance 1,
 *   1 stall à distance 2, aucun à distance 3) ;
 * - avec forwarding (EX/MEM et MEM/WB vers l'entrée d'EX) : un résultat ALU est disponible à la fin
 *   d'EX (aucun stall), un résultat de LOAD à la fin de MEM (1 stall load-use) ;
 * - la donnée à écrire d'un STORE n'est lue qu'en MEM, son registre de base en EX ;
 * - un branchement est résolu en EX : bien prédit, aucun coût ; mal prédit, les deux instructions
 *   du mauvais chemin déjà chargées sont annulées (flush de 2 cycles).
 *
 * Un stall retient l'instruction dépendante en ID ET retient les suivantes en IF : les bulles se
 * propagent, c'est ce qui allonge le nombre total de cycles.
 *
 * Cellules d'une ligne : 'IF' | 'ID' | 'EX' | 'MEM' | 'WB' | 'STALL' (bulle en ID) | 'WAIT'
 * (instruction retenue en IF derrière un stall) | 'FLUSH' (chargement annulé, mauvais chemin) | null.
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

    const BRANCH_OPS = ['BEQ', 'BNE'];
    const LOAD_OPS = ['LOAD', 'LW'];
    const STORE_OPS = ['STORE', 'SW'];

    /**
     * Analyse une instruction : { text, op, dest, srcs: [{reg, stage}], isLoad, isStore, isBranch }.
     * `stage` dit à quel étage la valeur du registre est lue : 'EX' (opérande ALU, base d'adresse,
     * comparaison de branchement) ou 'MEM' (donnée écrite par un STORE).
     */
    function pipelineParse(text) {
        const raw = String(text).trim();
        const op = (raw.split(/\s+/)[0] || '').toUpperCase();
        const regs = raw.match(/R\d+/gi) || [];
        const upper = regs.map((r) => r.toUpperCase());
        const isLoad = LOAD_OPS.indexOf(op) !== -1;
        const isStore = STORE_OPS.indexOf(op) !== -1;
        const isBranch = BRANCH_OPS.indexOf(op) !== -1;
        let dest = null;
        let srcs = [];
        if (isStore) {
            srcs = upper.map((r, i) => ({ reg: r, stage: i === 0 ? 'MEM' : 'EX' }));
        } else if (isBranch) {
            srcs = upper.map((r) => ({ reg: r, stage: 'EX' }));
        } else {
            dest = upper.length ? upper[0] : null;
            srcs = upper.slice(1).map((r) => ({ reg: r, stage: 'EX' }));
        }
        return { text: raw, op: op, dest: dest, srcs: srcs, isLoad: isLoad, isStore: isStore, isBranch: isBranch };
    }

    /**
     * Simule le programme.
     * options : { detectHazards = true, forwarding = true, mispredict = false }
     *   detectHazards faux : le processeur ignore les dépendances (lectures périmées comptées dans `stale`).
     *   mispredict vrai : tous les branchements sont mal prédits (flush de 2 cycles).
     * Retourne { rows, totalCycles, stalls, forwarded, flushes, stale, hazards, cpi, idealCycles }.
     */
    function pipelineSimulate(instructions, options) {
        const opts = Object.assign({ detectHazards: true, forwarding: true, mispredict: false }, options || {});
        const n = instructions.length;
        const rows = [];
        const hazards = [];
        let stalls = 0;
        let forwarded = 0;
        let flushes = 0;
        let stale = 0;
        const parsed = instructions.map(pipelineParse);

        for (let i = 0; i < n; i += 1) {
            const ins = parsed[i];
            const prev = i > 0 ? rows[i - 1] : null;
            const prevParsed = i > 0 ? parsed[i - 1] : null;

            // Début de chargement : dès que l'instruction précédente quitte IF, sauf branchement mal prédit.
            let ifStart = 1;
            if (prev) {
                ifStart = prev.idStart;
                if (prevParsed.isBranch && opts.mispredict) {
                    ifStart = prev.ex + 1;
                }
            }
            const idStart = prev ? Math.max(ifStart + 1, prev.idEnd + 1) : 2;

            // Attente imposée par chaque dépendance RAW avec le dernier producteur du registre.
            let idEnd = idStart;
            const deps = [];
            ins.srcs.forEach((src) => {
                let p = -1;
                for (let j = i - 1; j >= 0; j -= 1) {
                    if (parsed[j].dest === src.reg) { p = j; break; }
                }
                if (p === -1) return;
                const prod = rows[p];
                let needEnd;
                if (opts.forwarding) {
                    const avail = parsed[p].isLoad ? prod.mem : prod.ex;
                    needEnd = src.stage === 'MEM' ? avail - 1 : avail;
                } else {
                    needEnd = prod.wb;
                }
                deps.push({ producer: p, reg: src.reg, needEnd: needEnd, wb: prod.wb, isLoad: parsed[p].isLoad });
            });
            const baseEnd = idStart;
            if (opts.detectHazards) {
                deps.forEach((d) => { idEnd = Math.max(idEnd, d.needEnd); });
            }
            const ex = idEnd + 1;
            const mem = ex + 1;
            const wb = mem + 1;
            const rowStalls = idEnd - idStart;
            stalls += rowStalls;

            deps.forEach((d) => {
                const distance = i - d.producer;
                const info = { consumer: i, producer: d.producer, reg: d.reg, distance: distance, loadUse: d.isLoad && distance === 1 };
                const need = Math.max(0, d.needEnd - baseEnd);
                if (!opts.detectHazards) {
                    if (baseEnd < d.wb) {
                        stale += 1;
                        hazards.push(Object.assign(info, { kind: 'stale', stalls: 0, cycle: baseEnd }));
                    }
                } else if (need > 0) {
                    hazards.push(Object.assign(info, { kind: 'stall', stalls: need, cycle: baseEnd }));
                } else if (opts.forwarding && idEnd < d.wb) {
                    forwarded += 1;
                    hazards.push(Object.assign(info, { kind: 'forwarded', stalls: 0, cycle: ex }));
                }
            });

            if (ins.isBranch && opts.mispredict && i < n - 1) flushes += ex - idEnd + 1;

            rows.push({ inst: ins.text, parsed: ins, ifStart: ifStart, idStart: idStart, idEnd: idEnd, ex: ex, mem: mem, wb: wb, stalls: rowStalls, cells: [] });
        }

        const totalCycles = n ? rows[n - 1].wb : 0;
        rows.forEach((r, i) => {
            const cells = new Array(totalCycles + 1).fill(null); // index = numéro de cycle
            const prev = i > 0 ? rows[i - 1] : null;
            if (prev && prev.parsed.isBranch && opts.mispredict) {
                for (let c = prev.idEnd; c <= prev.ex; c += 1) cells[c] = 'FLUSH';
            }
            cells[r.ifStart] = 'IF';
            for (let c = r.ifStart + 1; c < r.idStart; c += 1) cells[c] = 'WAIT';
            for (let c = r.idStart; c < r.idEnd; c += 1) cells[c] = 'STALL';
            cells[r.idEnd] = 'ID';
            cells[r.ex] = 'EX';
            cells[r.mem] = 'MEM';
            cells[r.wb] = 'WB';
            r.cells = cells.slice(1); // cells[0] = cycle 1
        });

        return {
            rows: rows,
            totalCycles: totalCycles,
            stalls: stalls,
            forwarded: forwarded,
            flushes: flushes,
            stale: stale,
            hazards: hazards,
            idealCycles: n ? n + 4 : 0,
            cpi: n ? totalCycles / n : null
        };
    }

    /** Cycles pour n instructions sans aléa dans un pipeline à `stages` étages : n + stages - 1. */
    function pipelineIdealCycles(n, stages) {
        return n > 0 ? n + (stages || 5) - 1 : 0;
    }

    /** CPI effectif : CPI idéal + somme des (fréquence × pénalité en cycles). */
    function pipelineEffectiveCpi(base, penalties) {
        return (penalties || []).reduce((acc, p) => acc + p.frequency * p.cycles, base == null ? 1 : base);
    }

    /** Phrase d'explication d'un aléa de la liste `hazards` (texte brut, sans HTML). */
    function pipelineHazardMessage(result, h) {
        const cons = result.rows[h.consumer].inst;
        const prod = result.rows[h.producer].inst;
        const dist = h.distance === 1 ? 'distance 1' : 'distance ' + h.distance;
        const base = 'Cycle ' + h.cycle + ' : "' + cons + '" lit ' + h.reg + ' écrit par "' + prod + '" (' + dist + ')';
        if (h.kind === 'stall') {
            const label = h.loadUse ? ' (load-use)' : '';
            return base + label + ' -> ' + h.stalls + (h.stalls > 1 ? ' stalls.' : ' stall.');
        }
        if (h.kind === 'forwarded') return base + ' -> valeur reçue par forwarding, aucun stall.';
        return base + ' -> lecture périmée : le résultat serait faux.';
    }

    return {
        pipelineParse: pipelineParse,
        pipelineHazardMessage: pipelineHazardMessage,
        pipelineSimulate: pipelineSimulate,
        pipelineIdealCycles: pipelineIdealCycles,
        pipelineEffectiveCpi: pipelineEffectiveCpi
    };
});
