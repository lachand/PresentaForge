/**
 * rsa-engine.js - moteur PUR du RSA « de manuel » : primalité par division d'essai, inverse modulaire
 * par Euclide étendu (avec ses lignes), puissance modulaire en BigInt. Aucune dépendance au DOM
 * (relecture 3b, B5, RS-I1, RS-I3, décision (f)).
 *
 * Bornes : p et q premiers, distincts, entre 2 et 10^6 (donc n < 10^12, qui tient dans un Number ;
 * seules les multiplications intermédiaires de la puissance modulaire passent par BigInt).
 * La signature calculée ici est la signature BRUTE du manuel (m^d mod n), sans hachage ni padding :
 * en pratique on signe l'empreinte du message avec un remplissage PSS.
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

    const RSA_MAX_PRIME = 1000000;

    function gcd(a, b) {
        let x = Math.abs(a);
        let y = Math.abs(b);
        while (y !== 0) { const t = x % y; x = y; y = t; }
        return x;
    }

    /** { prime: true } ou { prime: false, divisor } (n < 2 : divisor = null). */
    function rsaIsPrime(n) {
        if (!Number.isInteger(n) || n < 2) return { prime: false, divisor: null };
        if (n < 4) return { prime: true };
        if (n % 2 === 0) return { prime: false, divisor: 2 };
        for (let d = 3; d * d <= n; d += 2) {
            if (n % d === 0) return { prime: false, divisor: d };
        }
        return { prime: true };
    }

    /** base^exp mod mod, en BigInt ; retourne un Number (résultat < mod <= 10^12). */
    function rsaModPow(base, exp, mod) {
        const m = BigInt(mod);
        let b = BigInt(base) % m;
        let e = BigInt(exp);
        let result = 1n % m;
        while (e > 0n) {
            if (e & 1n) result = (result * b) % m;
            b = (b * b) % m;
            e >>= 1n;
        }
        return Number(result);
    }

    /**
     * Inverse de e modulo phi par Euclide étendu. Retourne { d, gcd, rows } ;
     * rows = [{ r, q, t }] (reste, quotient de la division qui l'a produit, coefficient) ; d = null si gcd != 1.
     */
    function rsaModInverse(e, phi) {
        const rows = [{ r: phi, q: null, t: 0 }, { r: e, q: null, t: 1 }];
        let r0 = phi; let r1 = e; let t0 = 0; let t1 = 1;
        while (r1 !== 0) {
            const q = Math.floor(r0 / r1);
            const r2 = r0 - q * r1;
            const t2 = t0 - q * t1;
            rows.push({ r: r2, q: q, t: t2 });
            r0 = r1; r1 = r2; t0 = t1; t1 = t2;
        }
        return { gcd: r0, d: r0 === 1 ? ((t0 % phi) + phi) % phi : null, rows: rows };
    }

    /** Plus petit exposant usuel copremier avec phi et inférieur à phi. */
    function rsaPickE(phi) {
        const candidates = [65537, 17, 5, 3, 7, 11, 13, 19, 23, 29, 31, 37];
        const e = candidates.find((x) => x < phi && gcd(x, phi) === 1);
        return e || null;
    }

    function check(name, v) {
        if (!Number.isInteger(v)) return name + ' doit être un entier.';
        if (v < 2 || v > RSA_MAX_PRIME) return name + ' doit être compris entre 2 et ' + RSA_MAX_PRIME + '.';
        const pr = rsaIsPrime(v);
        if (!pr.prime) return name + ' = ' + v + ' n\'est pas premier : ' + pr.divisor + ' le divise (' + v + ' = ' + pr.divisor + ' × ' + (v / pr.divisor) + ').';
        return null;
    }

    /**
     * Calcule toute la chaîne. Entrées : { p, q, e, m } (entiers).
     * Retourne { ok: false, field, error } ou { ok: true, n, phi, d, c, decrypted, signature, verified, euclid, roundTrip }.
     */
    function rsaCompute(input) {
        const { p, q, e, m } = input;
        for (const [name, field, v] of [['p', 'p', p], ['q', 'q', q]]) {
            const err = check(name, v);
            if (err) return { ok: false, field: field, error: err };
        }
        if (p === q) return { ok: false, field: 'q', error: 'p et q doivent être distincts.' };
        const n = p * q;
        const phi = (p - 1) * (q - 1);
        if (!Number.isInteger(e) || e <= 1 || e >= phi) return { ok: false, field: 'e', error: 'e doit vérifier 1 < e < phi = ' + phi + '.', n: n, phi: phi };
        if (gcd(e, phi) !== 1) return { ok: false, field: 'e', error: 'e = ' + e + ' n\'est pas copremier avec phi = ' + phi + ' (pgcd = ' + gcd(e, phi) + ').', n: n, phi: phi };
        if (!Number.isInteger(m) || m <= 0 || m >= n) return { ok: false, field: 'm', error: 'Le message m doit vérifier 0 < m < n = ' + n + '.', n: n, phi: phi };
        const euclid = rsaModInverse(e, phi);
        const d = euclid.d;
        const c = rsaModPow(m, e, n);
        const decrypted = rsaModPow(c, d, n);
        const signature = rsaModPow(m, d, n);
        const verified = rsaModPow(signature, e, n);
        return { ok: true, n: n, phi: phi, d: d, c: c, decrypted: decrypted, signature: signature, verified: verified, euclid: euclid, roundTrip: decrypted === m && verified === m };
    }

    /** Premier aléatoire dans [min, max] (rnd() renvoie un réel dans [0, 1)). */
    function rsaRandomPrime(min, max, rnd) {
        const r = rnd || Math.random;
        for (let i = 0; i < 10000; i += 1) {
            const v = min + Math.floor(r() * (max - min + 1));
            if (rsaIsPrime(v).prime) return v;
        }
        return null;
    }

    return {
        RSA_MAX_PRIME: RSA_MAX_PRIME,
        rsaIsPrime: rsaIsPrime,
        rsaModPow: rsaModPow,
        rsaModInverse: rsaModInverse,
        rsaPickE: rsaPickE,
        rsaCompute: rsaCompute,
        rsaRandomPrime: rsaRandomPrime
    };
});
