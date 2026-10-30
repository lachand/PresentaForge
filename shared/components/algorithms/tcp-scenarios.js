/**
 * tcp-scenarios.js - scénarios TCP PURS (données, sans DOM) partagés par la page et le widget de slides.
 *
 * Chaque étape décrit un segment : { from, label, seq, ack, len, lost, clientState, serverState,
 * title, info, final }. `detail` se dérive des nombres avec tcpDetail() : ainsi les numéros affichés et
 * les numéros vérifiés par le test viennent de la même source (relecture 3a, B6, TC-I1, TC-I3).
 *
 * Conventions : `ack = n` signifie « j'attends l'octet n » (RES-09) ; un SYN ou un FIN consomme un
 * numéro de séquence ; états écrits à la manière des RFC (SYN_SENT, TIME_WAIT...). Le côté qui ferme
 * en premier garde TIME_WAIT. `init.next[x]` donne l'octet que x attend au début du scénario.
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

    function step(from, label, nums, states, text, extra) {
        return Object.assign({
            from: from,
            label: label,
            seq: nums.seq === undefined ? null : nums.seq,
            ack: nums.ack === undefined ? null : nums.ack,
            len: nums.len || 0,
            clientState: states[0],
            serverState: states[1],
            title: text[0],
            info: text[1]
        }, extra || {});
    }

    const HANDSHAKE = [
        step('client', 'SYN', { seq: 1000 }, ['SYN_SENT', 'LISTEN'],
            ['Étape 1', 'Le client envoie un SYN avec son numéro de séquence initial (seq=1000) pour demander une connexion.']),
        step('server', 'SYN+ACK', { seq: 2000, ack: 1001 }, ['SYN_SENT', 'SYN_RCVD'],
            ['Étape 2', 'Le serveur répond SYN+ACK avec son propre numéro (seq=2000). ack=1001 veut dire « j\'attends l\'octet 1001 » : le SYN du client a consommé le numéro 1000.']),
        step('client', 'ACK', { ack: 2001 }, ['ESTABLISHED', 'ESTABLISHED'],
            ['Étape 3', 'Le client confirme (ack=2001). La connexion est établie des deux côtés.'], { final: 'ÉTABLIE' })
    ];

    const SCENARIOS = {
        normal: {
            label: 'Connexion normale',
            steps: HANDSHAKE
        },
        data: {
            label: 'Transfert de données',
            steps: HANDSHAKE.slice(0, 2).concat([
                Object.assign({}, HANDSHAKE[2], { title: 'Étape 3', info: 'Connexion établie : le client peut envoyer des données.', final: undefined }),
                step('client', 'DATA', { seq: 1001, len: 512 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Données', 'Le client envoie 512 octets : les octets 1001 à 1512.']),
                step('server', 'ACK', { ack: 1513 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Accusé de réception', 'Le serveur attend maintenant l\'octet 1513 (= 1001 + 512) : tout ce qui précède est reçu.'],
                    { final: 'DONNÉES TRANSFÉRÉES' })
            ])
        },
        close: {
            label: 'Fermeture',
            init: { next: { client: 2001, server: 1513 } },
            steps: [
                step('client', 'FIN', { seq: 1513 }, ['FIN_WAIT_1', 'ESTABLISHED'],
                    ['Fermeture initiée', 'Le client n\'a plus rien à envoyer : il envoie FIN. Il fermera en premier, donc c\'est lui qui gardera TIME_WAIT.']),
                step('server', 'ACK', { ack: 1514 }, ['FIN_WAIT_2', 'CLOSE_WAIT'],
                    ['ACK du FIN', 'Le serveur accuse le FIN (le FIN consomme un numéro : ack=1514). Il peut encore envoyer des données.']),
                step('server', 'FIN', { seq: 2001 }, ['FIN_WAIT_2', 'LAST_ACK'],
                    ['FIN du serveur', 'Le serveur ferme à son tour son sens de communication.']),
                step('client', 'ACK', { ack: 2002 }, ['TIME_WAIT', 'CLOSED'],
                    ['ACK final', 'Le client confirme. Il reste en TIME_WAIT un moment, au cas où cet ACK se perdrait ou qu\'un vieux segment arriverait.'],
                    { final: 'FERMÉE' })
            ]
        },
        lost: {
            label: 'Perte de SYN',
            steps: [
                step('client', 'SYN', { seq: 1000 }, ['SYN_SENT', 'LISTEN'],
                    ['SYN perdu', 'Le premier SYN est perdu sur le réseau : le serveur ne le reçoit jamais.'], { lost: true }),
                step('client', 'SYN (retrans.)', { seq: 1000 }, ['SYN_SENT', 'LISTEN'],
                    ['Retransmission', 'Après un timeout, le client renvoie le SYN avec le même numéro.']),
                step('server', 'SYN+ACK', { seq: 2000, ack: 1001 }, ['SYN_SENT', 'SYN_RCVD'],
                    ['SYN+ACK', 'Le serveur répond au SYN retransmis.']),
                step('client', 'ACK', { ack: 2001 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Connexion établie', 'Malgré la perte initiale, la connexion s\'établit grâce à la retransmission.'],
                    { final: 'ÉTABLIE (après retrans.)' })
            ]
        },
        dataloss: {
            label: 'Perte de données',
            init: { next: { client: 2001, server: 1001 } },
            steps: [
                step('client', 'DATA', { seq: 1001, len: 300 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Segment 1 perdu', 'Le client envoie 1200 octets en quatre segments de 300. Le premier (octets 1001 à 1300) est perdu.'], { lost: true }),
                step('client', 'DATA', { seq: 1301, len: 300 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Segment 2', 'Le serveur reçoit les octets 1301 à 1600, mais il lui manque toujours l\'octet 1001.']),
                step('server', 'ACK', { ack: 1001 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['ACK dupliqué n°1', 'Le serveur répond ack=1001 : il attend toujours l\'octet 1001, il ne confirme rien de plus.']),
                step('client', 'DATA', { seq: 1601, len: 300 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Segment 3', 'Octets 1601 à 1900, reçus eux aussi hors ordre.']),
                step('server', 'ACK', { ack: 1001 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['ACK dupliqué n°2', 'Même réponse : ack=1001.']),
                step('client', 'DATA', { seq: 1901, len: 300 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Segment 4', 'Octets 1901 à 2200, toujours hors ordre.']),
                step('server', 'ACK', { ack: 1001 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['ACK dupliqué n°3', 'Trois ACK identiques à la suite : le client en déduit que le segment 1 est perdu.']),
                step('client', 'DATA (retrans.)', { seq: 1001, len: 300 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['Retransmission rapide', 'Le client renvoie les octets 1001 à 1300 sans attendre le timeout.']),
                step('server', 'ACK', { ack: 2201 }, ['ESTABLISHED', 'ESTABLISHED'],
                    ['ACK cumulatif', 'Le trou est comblé : le serveur peut confirmer d\'un coup jusqu\'à l\'octet 2200 et attend maintenant le 2201.'],
                    { final: 'DONNÉES REÇUES' })
            ]
        }
    };

    /** Texte « seq=..., ack=..., N octets » dérivé des nombres du segment. */
    function tcpDetail(s) {
        const parts = [];
        if (s.seq !== null && s.seq !== undefined) parts.push('seq=' + s.seq);
        if (s.ack !== null && s.ack !== undefined) parts.push('ack=' + s.ack);
        if (s.len) parts.push(s.len + ' octets');
        return parts.join(', ');
    }

    /**
     * Rejoue un scénario avec un récepteur TCP simple et renvoie les écarts : le champ `ack` de chaque
     * segment doit valoir l'octet que son émetteur attend de l'autre côté, et le récepteur ne confirme
     * que des octets contigus : un segment hors ordre est mis de côté et l'`ack` reste bloqué (ACK dupliqué).
     */
    function tcpCheckScenario(scenario) {
        const errors = [];
        const next = Object.assign({}, scenario.init ? scenario.init.next : {});
        const buffered = { client: {}, server: {} };
        scenario.steps.forEach(function (s, i) {
            const sender = s.from;
            const receiver = sender === 'client' ? 'server' : 'client';
            if (s.ack !== null && s.ack !== undefined && next[sender] !== undefined && s.ack !== next[sender]) {
                errors.push('étape ' + (i + 1) + ' : ack=' + s.ack + ' au lieu de ' + next[sender]);
            }
            if (s.lost) return;
            const isSyn = /^SYN/.test(s.label) && s.label.indexOf('ACK') === -1 || s.label === 'SYN+ACK';
            if (isSyn) { next[receiver] = s.seq + 1; return; }
            if (s.seq === null || s.seq === undefined) return;
            const consumed = s.len || (s.label.indexOf('FIN') === 0 ? 1 : 0);
            if (!consumed) return;
            if (s.seq === next[receiver]) {
                next[receiver] += consumed;
                // Les segments reçus hors ordre et mis de côté sont absorbés dès que le trou est comblé.
                while (buffered[receiver][next[receiver]]) {
                    const len = buffered[receiver][next[receiver]];
                    delete buffered[receiver][next[receiver]];
                    next[receiver] += len;
                }
            } else if (s.seq > next[receiver]) {
                buffered[receiver][s.seq] = consumed;
            }
        });
        return errors;
    }

    return {
        TCP_SCENARIOS: SCENARIOS,
        tcpDetail: tcpDetail,
        tcpCheckScenario: tcpCheckScenario
    };
});
