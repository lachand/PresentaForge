/**
 * cipher-engine.js - moteur PUR des chiffrements du simulateur : César, Vigenère, XOR sur octets UTF-8,
 * réutilisation d'un flux (même clé et même nonce) et mode ECB contre CBC sur une petite image.
 * Aucune dépendance au DOM (relecture 3b, B10, CH-I1, décision (d)).
 *
 * ATTENTION : le générateur de flux et le chiffrement par blocs sont des JOUETS pédagogiques, pas de la
 * cryptographie. Ils reproduisent seulement les propriétés qu'on veut montrer :
 * - un flux qui ne dépend que de (clé, nonce) : même clé et même nonce, même flux ;
 * - un chiffrement par blocs déterministe : en ECB, deux blocs clairs égaux donnent deux blocs chiffrés égaux.
 * César et Vigenère normalisent d'abord les lettres accentuées (é devient E) ; les autres caractères
 * restent tels quels.
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

    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // Fréquences du français : E, A, S, I, N... Les lettres accentuées (é, è, ê) sont comptées dans E.
    const FRENCH_FREQ = {
        A: 8.15, B: 0.97, C: 3.15, D: 3.73, E: 17.39, F: 1.12, G: 0.97, H: 0.85, I: 7.31, J: 0.45, K: 0.02, L: 5.69, M: 2.87,
        N: 7.12, O: 5.28, P: 2.80, Q: 1.21, R: 6.64, S: 8.14, T: 7.22, U: 6.38, V: 1.64, W: 0.03, X: 0.41, Y: 0.28, Z: 0.15
    };

    // ── Lettres : César, Vigenère ──────────────────────────────────────────

    /** Majuscules sans accents ; ligatures usuelles développées. */
    function cipherNormalize(text) {
        return String(text).replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
            .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    }

    function caesarShift(text, shift, decrypt) {
        const k = ((decrypt ? -shift : shift) % 26 + 26) % 26;
        return cipherNormalize(text).split('').map((c) => {
            const idx = ALPHA.indexOf(c);
            return idx === -1 ? c : ALPHA[(idx + k) % 26];
        }).join('');
    }

    /** Clé réduite à ses lettres A-Z (accents retirés). */
    function vigenereKey(key) {
        return cipherNormalize(key).replace(/[^A-Z]/g, '');
    }

    function vigenereProcess(text, key, decrypt) {
        const k = vigenereKey(key);
        const plain = cipherNormalize(text);
        if (!k) return plain;
        let ki = 0;
        return plain.split('').map((c) => {
            const idx = ALPHA.indexOf(c);
            if (idx === -1) return c;
            const shift = ALPHA.indexOf(k[ki % k.length]);
            ki += 1;
            return ALPHA[(idx + (decrypt ? 26 - shift : shift)) % 26];
        }).join('');
    }

    function cipherLetterFreq(text) {
        const counts = {};
        let total = 0;
        for (const c of cipherNormalize(text)) {
            if (ALPHA.includes(c)) { counts[c] = (counts[c] || 0) + 1; total += 1; }
        }
        const freq = {};
        for (const c of ALPHA) freq[c] = total ? (counts[c] || 0) / total * 100 : 0;
        return { freq: freq, total: total };
    }

    /** Écart au français (khi-deux) : plus c'est petit, plus le texte ressemble à du français. */
    function cipherFrenchScore(text) {
        const { freq } = cipherLetterFreq(text);
        return ALPHA.split('').reduce((acc, l) => {
            const e = FRENCH_FREQ[l] || 0.0001;
            const d = freq[l] - e;
            return acc + d * d / e;
        }, 0);
    }

    /** Les décalages 1 à 25 triés du plus au moins français. */
    function caesarCandidates(cipherText) {
        const rows = [];
        for (let shift = 1; shift < 26; shift += 1) {
            const plain = caesarShift(cipherText, shift, true);
            rows.push({ shift: shift, plain: plain, score: cipherFrenchScore(plain) });
        }
        return rows.sort((a, b) => a.score - b.score);
    }

    // ── XOR sur octets UTF-8 ───────────────────────────────────────────────

    const enc = (s) => Array.from(new TextEncoder().encode(s));

    function toHex(bytes) {
        return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }

    /** { ok, bytes, hex } ; la clé répétée est lue en octets UTF-8. */
    function xorEncrypt(text, key) {
        const k = enc(key);
        if (!k.length) return { ok: false, error: 'La clé est vide.' };
        const bytes = enc(text).map((b, i) => b ^ k[i % k.length]);
        return { ok: true, bytes: bytes, hex: toHex(bytes) };
    }

    /** Analyse "1F 2a 03" ; retourne { ok, bytes } ou { ok: false, error }. */
    function xorParseHex(hex) {
        const compact = String(hex).replace(/\s+/g, '');
        if (!compact) return { ok: false, error: 'Saisis des octets en hexadécimal, par exemple 1F 2A.' };
        if (!/^[0-9a-fA-F]+$/.test(compact)) return { ok: false, error: 'Caractère invalide : seuls 0-9 et A-F sont admis.' };
        if (compact.length % 2) return { ok: false, error: 'Nombre impair de chiffres hexadécimaux : un octet en demande deux.' };
        const bytes = [];
        for (let i = 0; i < compact.length; i += 2) bytes.push(parseInt(compact.slice(i, i + 2), 16));
        return { ok: true, bytes: bytes };
    }

    function xorDecryptHex(hex, key) {
        const k = enc(key);
        if (!k.length) return { ok: false, error: 'La clé est vide.' };
        const parsed = xorParseHex(hex);
        if (!parsed.ok) return parsed;
        const raw = parsed.bytes.map((b, i) => b ^ k[i % k.length]);
        try {
            return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(raw)) };
        } catch (e) {
            return { ok: false, error: 'Le résultat n\'est pas du texte UTF-8 valide : la clé est probablement incorrecte.' };
        }
    }

    // ── Réutilisation d'un flux ────────────────────────────────────────────

    /** Flux d'octets déterministe issu de (clé, nonce) : générateur JOUET (FNV-1a puis xorshift32). */
    function toyKeystream(key, nonce, length) {
        let h = 0x811c9dc5;
        enc(String(key) + '|' + String(nonce)).forEach((b) => { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; });
        let x = h || 1;
        const out = [];
        for (let i = 0; i < length; i += 1) {
            x ^= x << 13; x >>>= 0;
            x ^= x >>> 17;
            x ^= x << 5; x >>>= 0;
            out.push((x >>> 8) & 255);
        }
        return out;
    }

    function streamEncrypt(plainBytes, key, nonce) {
        const ks = toyKeystream(key, nonce, plainBytes.length);
        return plainBytes.map((b, i) => b ^ ks[i]);
    }

    /**
     * Chiffre deux messages avec (clé, nonce1) et (clé, nonce2).
     * Retourne { c1, c2, xorCipher, xorPlain, sameNonce, keyDisappears } : si les nonces sont égaux, le XOR des
     * deux chiffrés vaut le XOR des deux clairs (le flux, donc la clé, a disparu).
     */
    function streamReuseDemo(p1, p2, key, nonce1, nonce2) {
        const b1 = enc(p1);
        const b2 = enc(p2);
        const c1 = streamEncrypt(b1, key, nonce1);
        const c2 = streamEncrypt(b2, key, nonce2);
        const n = Math.min(c1.length, c2.length);
        const xorCipher = Array.from({ length: n }, (_, i) => c1[i] ^ c2[i]);
        const xorPlain = Array.from({ length: n }, (_, i) => b1[i] ^ b2[i]);
        return {
            c1: c1, c2: c2, xorCipher: xorCipher, xorPlain: xorPlain,
            sameNonce: String(nonce1) === String(nonce2),
            keyDisappears: xorCipher.every((v, i) => v === xorPlain[i])
        };
    }

    /** Attaquant qui connaît le début du message 1 : récupère le début correspondant du message 2. */
    function streamRecoverSecond(xorBytes, knownStartOfFirst) {
        const known = enc(knownStartOfFirst);
        const n = Math.min(known.length, xorBytes.length);
        const bytes = Array.from({ length: n }, (_, i) => xorBytes[i] ^ known[i]);
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
        } catch (e) {
            return Array.from(bytes).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '?')).join('');
        }
    }

    // ── ECB contre CBC sur une petite image ────────────────────────────────

    const BLOCK = 8;

    /** Images de 8 colonnes : une ligne = un bloc de 8 octets (0 ou 255). */
    const CIPHER_IMAGES = {
        carre: ['11111111', '10000001', '10000001', '10000001', '10000001', '10000001', '10000001', '11111111'],
        croix: ['10000001', '01000010', '00100100', '00011000', '00011000', '00100100', '01000010', '10000001'],
        T: ['11111111', '11111111', '00011000', '00011000', '00011000', '00011000', '00011000', '00011000']
    };

    function imageToRows(pattern) {
        return pattern.map((line) => line.split('').map((c) => (c === '1' ? 255 : 0)));
    }

    /** Bloc chiffré par un chiffrement par blocs JOUET (déterministe, dépend de la clé). */
    function toyBlockEncrypt(block, key) {
        const ks = toyKeystream(key, 'bloc', BLOCK * 4);
        let b = block.slice();
        for (let round = 0; round < 4; round += 1) {
            b = b.map((v, i) => (v ^ ks[round * BLOCK + i]) & 255);
            b = b.map((v, i) => (v + b[(i + 1) % BLOCK] * 7 + round) & 255);
        }
        return b;
    }

    function ecbEncryptRows(rows, key) {
        return rows.map((block) => toyBlockEncrypt(block, key));
    }

    function cbcEncryptRows(rows, key, iv) {
        let prev = toyKeystream(key, 'iv-' + iv, BLOCK);
        return rows.map((block) => {
            const mixed = block.map((v, i) => v ^ prev[i]);
            prev = toyBlockEncrypt(mixed, key);
            return prev;
        });
    }

    /** Nombre de blocs (lignes) identiques à un bloc précédent. */
    function cipherRepeatedRows(rows) {
        const seen = new Set();
        let repeats = 0;
        rows.forEach((r) => {
            const k = r.join(',');
            if (seen.has(k)) repeats += 1; else seen.add(k);
        });
        return repeats;
    }

    return {
        CIPHER_ALPHABET: ALPHA,
        CIPHER_FRENCH_FREQ: FRENCH_FREQ,
        CIPHER_IMAGES: CIPHER_IMAGES,
        cipherNormalize: cipherNormalize,
        caesarShift: caesarShift,
        vigenereKey: vigenereKey,
        vigenereProcess: vigenereProcess,
        cipherLetterFreq: cipherLetterFreq,
        cipherFrenchScore: cipherFrenchScore,
        caesarCandidates: caesarCandidates,
        cipherToHex: toHex,
        xorEncrypt: xorEncrypt,
        xorParseHex: xorParseHex,
        xorDecryptHex: xorDecryptHex,
        toyKeystream: toyKeystream,
        streamEncrypt: streamEncrypt,
        streamReuseDemo: streamReuseDemo,
        streamRecoverSecond: streamRecoverSecond,
        cipherImageRows: imageToRows,
        ecbEncryptRows: ecbEncryptRows,
        cbcEncryptRows: cbcEncryptRows,
        cipherRepeatedRows: cipherRepeatedRows
    };
});
