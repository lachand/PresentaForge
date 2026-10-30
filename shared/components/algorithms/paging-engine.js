/**
 * paging-engine.js - moteur PUR de la mémoire paginée : remplacement de pages (FIFO, LRU, Optimal,
 * Clock), courbe des défauts selon le nombre de cadres, traduction d'adresse virtuelle avec table
 * des pages et TLB. Aucune dépendance au DOM (relecture 3b, B4, ME-I2, décision (c)).
 *
 * Conventions :
 * - un nouveau défaut utilise d'abord le premier cadre vide (plus petit indice) ;
 * - FIFO : la victime est la page chargée depuis le plus longtemps ;
 * - LRU : la victime est la page dont le dernier accès est le plus ancien (un hit compte comme accès) ;
 * - Optimal : la victime est la page réutilisée le plus tard ; entre deux pages jamais réutilisées,
 *   le plus petit indice de cadre l'emporte ;
 * - Clock : une aiguille parcourt les cadres en cercle. Un hit met le bit de référence à 1, une page
 *   chargée y arrive avec 1. Pour évincer, l'aiguille remet à 0 chaque bit à 1 qu'elle croise et
 *   évince le premier cadre dont le bit vaut déjà 0 ; si tous valent 1, elle fait un tour complet
 *   et évince le cadre où elle avait commencé. Après une éviction, elle avance d'un cadre ;
 * - traduction : adresse = numéro de page (poids forts) + déplacement (12 bits pour des pages de
 *   4 Kio). La TLB est consultée d'abord ; sur un échec elle est remplie depuis la table des pages
 *   (remplacement FIFO) ; une page absente de la table provoque un défaut de page.
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

    const PAGING_ALGORITHMS = ['fifo', 'lru', 'optimal', 'clock'];

    /**
     * Simule une chaîne de références. Retourne { steps, hits, faults, hitRate } ;
     * step = { page, type: 'hit'|'fault', frame, victim, victimFrame, frames, refBits, hand, note }.
     */
    function pagingSimulate(sequence, numFrames, algo) {
        const n = Math.max(1, Math.floor(numFrames) || 1);
        const frames = new Array(n).fill(null);
        const loadedAt = new Array(n).fill(0);
        const refBits = new Array(n).fill(0);
        const lastUse = {};
        let hand = 0;
        let clock = 0;
        let hits = 0;
        let faults = 0;
        const steps = [];

        sequence.forEach((page, i) => {
            const hitFrame = frames.indexOf(page);
            lastUse[page] = i;
            if (hitFrame !== -1) {
                hits += 1;
                refBits[hitFrame] = 1;
                steps.push({ page: page, type: 'hit', frame: hitFrame, victim: null, victimFrame: -1, frames: frames.slice(), refBits: refBits.slice(), hand: hand, note: '' });
                return;
            }
            faults += 1;
            clock += 1;
            const empty = frames.indexOf(null);
            let target;
            let victim = null;
            let note = '';
            if (empty !== -1) {
                target = empty;
                if (algo === 'clock') hand = (empty + 1) % n;
            } else if (algo === 'lru') {
                target = 0;
                frames.forEach((p, f) => { if (lastUse[p] < lastUse[frames[target]]) target = f; });
                victim = frames[target];
            } else if (algo === 'optimal') {
                target = 0;
                let farthest = -1;
                frames.forEach((p, f) => {
                    let next = Infinity;
                    for (let j = i + 1; j < sequence.length; j += 1) { if (sequence[j] === p) { next = j; break; } }
                    if (next > farthest) { farthest = next; target = f; }
                });
                victim = frames[target];
                if (farthest === Infinity) note = 'jamais réutilisée';
            } else if (algo === 'clock') {
                let turned = 0;
                while (refBits[hand] === 1) { refBits[hand] = 0; hand = (hand + 1) % n; turned += 1; }
                target = hand;
                victim = frames[target];
                hand = (hand + 1) % n;
                if (turned >= n) note = 'tour complet : tous les bits étaient à 1';
            } else {
                target = 0;
                frames.forEach((p, f) => { if (loadedAt[f] < loadedAt[target]) target = f; });
                victim = frames[target];
            }
            frames[target] = page;
            loadedAt[target] = clock;
            refBits[target] = 1;
            steps.push({ page: page, type: 'fault', frame: target, victim: victim, victimFrame: victim === null ? -1 : target, frames: frames.slice(), refBits: refBits.slice(), hand: hand, note: note });
        });

        const total = hits + faults;
        return { steps: steps, hits: hits, faults: faults, hitRate: total ? hits / total : 0 };
    }

    /** Défauts de page pour 1..maxFrames cadres : [{ frames, faults }]. */
    function pagingFaultCurve(sequence, algo, maxFrames) {
        const out = [];
        for (let f = 1; f <= Math.max(1, maxFrames || 8); f += 1) {
            out.push({ frames: f, faults: pagingSimulate(sequence, f, algo).faults });
        }
        return out;
    }

    /** Vrai si le nombre de défauts augmente quand on ajoute un cadre (anomalie de Belady). */
    function pagingHasBelady(curve) {
        for (let i = 1; i < curve.length; i += 1) if (curve[i].faults > curve[i - 1].faults) return true;
        return false;
    }

    /** "0x1F" ou "31" -> 31 ; null si invalide ou négatif. */
    function pagingParseNumber(text) {
        const s = String(text).trim();
        if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
        if (/^\d+$/.test(s)) return parseInt(s, 10);
        return null;
    }

    function pagingHex(n, width) {
        return '0x' + n.toString(16).toUpperCase().padStart(width || 1, '0');
    }

    /** Sépare une adresse en numéro de page et déplacement. pageBits = 12 pour 4 Kio. */
    function pagingSplit(vaddr, pageBits) {
        const bits = pageBits || 12;
        const size = Math.pow(2, bits);
        return { page: Math.floor(vaddr / size), offset: vaddr % size, pageSize: size };
    }

    /**
     * Traduit une liste d'adresses virtuelles. pageTable : { [page]: frame } ; tlbSize : entrées de TLB.
     * Retourne [{ vaddr, page, offset, tlb: 'hit'|'miss', fault, frame, paddr }] avec l'état de la TLB
     * conservé d'une adresse à l'autre.
     */
    function pagingTranslateAll(vaddrs, pageTable, tlbSize, pageBits) {
        const size = Math.max(0, Math.floor(tlbSize) || 0);
        const tlb = [];
        return vaddrs.map((vaddr) => {
            const { page, offset, pageSize } = pagingSplit(vaddr, pageBits);
            const cached = tlb.find((e) => e.page === page);
            if (cached) {
                return { vaddr: vaddr, page: page, offset: offset, tlb: 'hit', fault: false, frame: cached.frame, paddr: cached.frame * pageSize + offset };
            }
            const frame = Object.prototype.hasOwnProperty.call(pageTable, page) ? pageTable[page] : null;
            if (frame === null) {
                return { vaddr: vaddr, page: page, offset: offset, tlb: 'miss', fault: true, frame: null, paddr: null };
            }
            if (size > 0) {
                if (tlb.length >= size) tlb.shift();
                tlb.push({ page: page, frame: frame });
            }
            return { vaddr: vaddr, page: page, offset: offset, tlb: 'miss', fault: false, frame: frame, paddr: frame * pageSize + offset };
        });
    }

    return {
        PAGING_ALGORITHMS: PAGING_ALGORITHMS,
        pagingSimulate: pagingSimulate,
        pagingFaultCurve: pagingFaultCurve,
        pagingHasBelady: pagingHasBelady,
        pagingParseNumber: pagingParseNumber,
        pagingHex: pagingHex,
        pagingSplit: pagingSplit,
        pagingTranslateAll: pagingTranslateAll
    };
});
