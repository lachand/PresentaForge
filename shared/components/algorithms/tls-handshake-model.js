/**
 * tls-handshake-model.js - modèle PUR d'un handshake TLS 1.3 SIMPLIFIÉ, fidèle à l'ordre réel des
 * messages, avec validation du certificat et mode « attaquant au milieu ».
 * Aucune dépendance au DOM (relecture 3b, B9, TL-I1, TL-I2, décision (e)).
 *
 * Ordre des messages (TLS 1.3) :
 *  1. ClientHello (client -> serveur) : la part d'échange de clés du client (A = g^a mod p) y figure ;
 *  2. ServerHello (serveur -> client) : la part du serveur (B = g^b mod p) ; le secret partagé est
 *     calculé des deux côtés à ce moment, la suite du handshake est CHIFFRÉE ;
 *  3. Certificate (serveur -> client, chiffré) : le certificat du serveur ;
 *  4. CertificateVerify (serveur -> client, chiffré) : signature du transcript avec la clé privée du
 *     certificat, qui prouve que le serveur la possède ;
 *  5. Finished (serveur -> client) puis 6. Finished (client -> serveur) : MAC du transcript.
 * Le client valide le certificat à la réception du message 3 (chaîne de confiance, dates, nom).
 *
 * Mode attaquant : M remplace les parts d'échange de clés et fait DEUX échanges Diffie-Hellman
 * distincts. Si le client ne valide pas le certificat, M lit tout. Sinon, le client interrompt à
 * l'étape 3. Paramètres JOUETS (p = 23) : un attaquant essaie les 22 secrets possibles instantanément.
 * La « dérivation » de clé est un hachage jouet du transcript, pas HKDF.
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

    const REQUESTED_NAME = 'example.org';
    const CERT_KINDS = ['valid', 'expired', 'untrusted', 'wrong-name'];

    const MESSAGES = [
        { id: 'ClientHello', from: 'client', to: 'serveur', encrypted: false, note: 'contient la part d\'échange de clés du client' },
        { id: 'ServerHello', from: 'serveur', to: 'client', encrypted: false, note: 'contient la part du serveur ; le secret partagé est calculé, la suite est chiffrée' },
        { id: 'Certificate', from: 'serveur', to: 'client', encrypted: true, note: 'le certificat du serveur, que le client doit valider' },
        { id: 'CertificateVerify', from: 'serveur', to: 'client', encrypted: true, note: 'signature du transcript avec la clé privée du certificat' },
        { id: 'Finished (serveur)', from: 'serveur', to: 'client', encrypted: true, note: 'MAC du transcript' },
        { id: 'Finished (client)', from: 'client', to: 'serveur', encrypted: true, note: 'MAC du transcript' }
    ];

    function modPow(base, exp, mod) {
        const m = BigInt(mod);
        let b = BigInt(base) % m;
        let e = BigInt(exp);
        let r = 1n;
        while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
        return Number(r);
    }

    /** Clé de session jouet : hachage FNV-1a du transcript et du secret. */
    function deriveKey(secret, transcript) {
        let h = 0x811c9dc5;
        const s = transcript + '|' + secret;
        for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return h.toString(16).padStart(8, '0');
    }

    /** Contrôles faits par le client sur un certificat : [{ id, label, ok }]. */
    function tlsCheckCertificate(cert) {
        return [
            { id: 'chain', label: 'Signé par une autorité de confiance (chaîne jusqu\'à une racine connue du navigateur)', ok: cert.trusted },
            { id: 'dates', label: 'Dates de validité respectées', ok: !cert.expired },
            { id: 'name', label: 'Le nom demandé (' + REQUESTED_NAME + ') figure dans le certificat (le certificat porte ' + cert.subject + ')', ok: cert.subject === REQUESTED_NAME }
        ];
    }

    function certFor(kind) {
        switch (kind) {
            case 'expired': return { subject: REQUESTED_NAME, issuer: 'AC Exemple', trusted: true, expired: true };
            case 'untrusted': return { subject: REQUESTED_NAME, issuer: 'lui-même (auto-signé)', trusted: false, expired: false };
            case 'wrong-name': return { subject: 'autre-site.example', issuer: 'AC Exemple', trusted: true, expired: false };
            default: return { subject: REQUESTED_NAME, issuer: 'AC Exemple', trusted: true, expired: false };
        }
    }

    /**
     * opts : { p = 23, g = 5, clientPriv, serverPriv, attackerPriv1, attackerPriv2, validate = true, mitm = false, cert = 'valid' }.
     * Avec mitm, le certificat présenté au client est celui de l'attaquant : il prétend être example.org mais
     * ne peut pas être signé par une autorité de confiance (cert « untrusted »).
     */
    function tlsNew(opts) {
        const o = Object.assign({ p: 23, g: 5, clientPriv: 6, serverPriv: 15, attackerPriv1: 4, attackerPriv2: 9, validate: true, mitm: false, cert: 'valid' }, opts || {});
        const cert = certFor(o.mitm ? 'untrusted' : o.cert);
        const s = {
            p: o.p, g: o.g, validate: !!o.validate, mitm: !!o.mitm,
            clientPriv: o.clientPriv, serverPriv: o.serverPriv, attackerPriv1: o.attackerPriv1, attackerPriv2: o.attackerPriv2,
            cert: cert, certKind: o.mitm ? 'untrusted' : o.cert,
            step: 0, done: false, aborted: false, abortReason: null, checks: null,
            clientShare: modPow(o.g, o.clientPriv, o.p),
            serverShare: modPow(o.g, o.serverPriv, o.p),
            attackerShareToClient: o.mitm ? modPow(o.g, o.attackerPriv1, o.p) : null,
            attackerShareToServer: o.mitm ? modPow(o.g, o.attackerPriv2, o.p) : null,
            seenByClient: null, seenByServer: null,
            clientSecret: null, serverSecret: null, attackerSecretClient: null, attackerSecretServer: null,
            clientKey: null, serverKey: null, compromised: false, logs: []
        };
        s.seenByServer = o.mitm ? s.attackerShareToServer : s.clientShare;
        s.seenByClient = o.mitm ? s.attackerShareToClient : s.serverShare;
        return s;
    }

    function log(s, text) {
        s.logs.unshift(text);
        if (s.logs.length > 14) s.logs.length = 14;
    }

    function abort(s, reason, text) {
        s.aborted = true;
        s.abortReason = reason;
        log(s, text);
    }

    /** Exécute le message suivant. Retourne le message traité ou null. */
    function tlsStep(s) {
        if (s.done || s.aborted || s.step >= MESSAGES.length) return null;
        const msg = MESSAGES[s.step];
        const via = s.mitm ? ' (intercepté par M)' : '';
        switch (s.step) {
            case 0:
                log(s, '1) ClientHello' + via + ' : part du client A = ' + s.clientShare + (s.mitm ? ' ; M la remplace par A\' = ' + s.attackerShareToServer + ' avant de la transmettre au serveur.' : '.'));
                s.serverSecret = modPow(s.seenByServer, s.serverPriv, s.p);
                if (s.mitm) s.attackerSecretServer = modPow(s.serverShare, s.attackerPriv2, s.p);
                break;
            case 1:
                log(s, '2) ServerHello' + via + ' : part du serveur B = ' + s.serverShare + (s.mitm ? ' ; M la remplace par B\' = ' + s.attackerShareToClient + ' pour le client.' : '.') + ' Le secret partagé est calculé de chaque côté ; la suite est chiffrée.');
                s.clientSecret = modPow(s.seenByClient, s.clientPriv, s.p);
                if (s.mitm) s.attackerSecretClient = modPow(s.clientShare, s.attackerPriv1, s.p);
                break;
            case 2: {
                s.checks = tlsCheckCertificate(s.cert);
                const bad = s.checks.find((c) => !c.ok);
                log(s, '3) Certificate' + via + ' : le serveur présente un certificat pour ' + s.cert.subject + ', émis par ' + s.cert.issuer + '.');
                if (s.validate && bad) {
                    abort(s, bad.id, 'Le client valide le certificat et refuse : ' + bad.label + '. Handshake interrompu, aucune donnée applicative n\'est envoyée.');
                    return msg;
                }
                log(s, s.validate ? 'Le client valide le certificat : les trois contrôles réussissent.' : 'Le client ne valide pas le certificat : il accepte n\'importe lequel.');
                break;
            }
            case 3:
                log(s, '4) CertificateVerify : le serveur signe le transcript avec la clé privée de son certificat. ' + (s.mitm ? 'C\'est la clé de M : la signature est valide pour le certificat de M, mais le client n\'a pas vérifié que ce certificat est celui de ' + REQUESTED_NAME + '.' : 'Le client vérifie la signature : seul le propriétaire du certificat a pu la produire.'));
                break;
            case 4:
                log(s, '5) Finished (serveur) : MAC du transcript avec la clé de handshake.');
                break;
            default:
                s.clientKey = deriveKey(s.clientSecret, 'CH:' + s.clientShare + '|SH:' + s.seenByClient);
                s.serverKey = deriveKey(s.serverSecret, 'CH:' + s.seenByServer + '|SH:' + s.serverShare);
                s.done = true;
                s.compromised = s.mitm;
                log(s, '6) Finished (client). Canal établi.' + (s.mitm
                    ? ' Mais le client et le serveur n\'ont pas la même clé (' + s.clientKey + ' et ' + s.serverKey + ') : M les a toutes les deux, déchiffre et relaie tout.'
                    : ' Les deux côtés ont la même clé de session (' + s.clientKey + ').'));
        }
        s.step += 1;
        return msg;
    }

    /** Exécute jusqu'au bout. */
    function tlsRun(opts) {
        const s = tlsNew(opts);
        while (tlsStep(s)) { /* continue */ }
        return s;
    }

    /** Nombre d'exposants secrets possibles (2 à p - 1) : 21 pour p = 23, donc un essai exhaustif est instantané. */
    function tlsSecretSpace(p) {
        return Math.max(0, p - 2);
    }

    /** Un attaquant passif retrouve le secret du client a à partir de A par essai exhaustif (valable pour p jouet). */
    function tlsBruteForceSecret(g, p, share) {
        for (let a = 1; a < p; a += 1) if (modPow(g, a, p) === share) return a;
        return null;
    }

    return {
        TLS_MESSAGES: MESSAGES,
        TLS_REQUESTED_NAME: REQUESTED_NAME,
        TLS_CERT_KINDS: CERT_KINDS,
        tlsNew: tlsNew,
        tlsStep: tlsStep,
        tlsRun: tlsRun,
        tlsCheckCertificate: tlsCheckCertificate,
        tlsSecretSpace: tlsSecretSpace,
        tlsBruteForceSecret: tlsBruteForceSecret,
        tlsModPow: modPow
    };
});
