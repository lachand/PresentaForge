/**
 * hash-metrics.js - mesures PURES sur des empreintes : différence bit à bit, verdict de l'effet
 * avalanche, modification d'un seul caractère. Aucune dépendance au DOM ni à crypto.subtle : la page
 * calcule les empreintes, ce module les compare (relecture 3b, B8, T6).
 *
 * Effet avalanche : pour une bonne fonction de hachage, changer un seul bit de l'entrée fait changer
 * environ la moitié des bits de l'empreinte. La zone attendue est donc autour de 50 % (ici 40 à 60 %) ;
 * 0 % veut dire aucune diffusion (empreintes identiques), et un pourcentage trop éloigné de 50 % est
 * suspect pour une fonction de hachage.
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

    function hashHexToBits(hex) {
        return String(hex).split('').map((h) => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
    }

    /** { diff, total, pct } : bits différents entre deux empreintes hexadécimales de même longueur. */
    function hashBitDiff(hexA, hexB) {
        const a = hashHexToBits(hexA);
        const b = hashHexToBits(hexB);
        const total = Math.max(a.length, b.length);
        let diff = 0;
        for (let i = 0; i < total; i += 1) {
            if ((a[i] || '0') !== (b[i] || '0')) diff += 1;
        }
        return { diff: diff, total: total, pct: total ? diff / total * 100 : 0 };
    }

    /** Verdict { zone, label } : 'none' (0 %), 'low' (< 40 %), 'expected' (40 à 60 %), 'high' (> 60 %). */
    function hashAvalancheVerdict(pct) {
        if (pct === 0) return { zone: 'none', label: 'Aucune diffusion : les deux empreintes sont identiques.' };
        if (pct < 40) return { zone: 'low', label: 'Trop peu de bits changent : la diffusion est insuffisante.' };
        if (pct <= 60) return { zone: 'expected', label: 'Attendu : environ la moitié des bits change (effet avalanche).' };
        return { zone: 'high', label: 'Plus de la moitié des bits change : inattendu pour une bonne fonction.' };
    }

    /** Remplace le caractère d'indice `index` par le suivant dans l'alphabet imprimable (un seul caractère modifié). */
    function hashFlipChar(text, index) {
        const i = ((index % text.length) + text.length) % text.length;
        const next = String.fromCharCode(33 + ((text.charCodeAt(i) - 33 + 1) % 94));
        return text.slice(0, i) + next + text.slice(i + 1);
    }

    function hashMean(values) {
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    return {
        hashHexToBits: hashHexToBits,
        hashBitDiff: hashBitDiff,
        hashAvalancheVerdict: hashAvalancheVerdict,
        hashFlipChar: hashFlipChar,
        hashMean: hashMean
    };
});
