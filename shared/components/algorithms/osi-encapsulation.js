/**
 * osi-encapsulation.js - moteur PUR de l'encapsulation / décapsulation (modèle TCP/IP vu par les 7 couches OSI).
 * Aucune dépendance au DOM : la page rejoue les étapes.
 *
 * Alignement sur le cours `reseau/osi` (relecture 3a, B3, OS-I3, OS-I4) :
 * - chaque étape de l'émetteur montre la pile APRÈS le travail de sa couche : l'en-tête annoncé par le
 *   message de l'étape figure donc dans la pile de la même étape ;
 * - les couches 7, 6 et 5 n'ajoutent pas d'en-tête propre dans TCP/IP (le protocole applicatif fournit les siens) ;
 * - la couche 2 ajoute l'en-tête Ethernet ET le FCS de fin ; la couche 1 convertit en bits sans rien ajouter ;
 * - la décapsulation montre la pile APRÈS le retrait fait par la couche courante.
 *
 * Étape : { layer, message, adds, removes, stack, bytes, bits } où stack liste les identifiants de
 * parties de l'extérieur vers l'intérieur ('eth', 'ip', 'tcp', 'data', 'fcs').
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

    // Taille en octets d'un en-tête sans options (TCP 20, IP 20, Ethernet 14) et du FCS (4).
    const OSI_HEADER_BYTES = { tcp: 20, ip: 20, eth: 14, fcs: 4 };

    const OSI_PARTS = {
        data: { cls: 'packet-data', label: 'Données' },
        tcp: { cls: 'packet-l4', label: 'TCP' },
        ip: { cls: 'packet-l3', label: 'IP' },
        eth: { cls: 'packet-l2', label: 'ETH' },
        fcs: { cls: 'packet-trail', label: 'FCS' }
    };

    function bytesOf(stack, payload) {
        return stack.reduce(function (n, id) {
            return n + (id === 'data' ? payload : (OSI_HEADER_BYTES[id] || 0));
        }, 0);
    }

    /** Taille sur le câble d'un message de `payload` octets (sans options, sans étiquette VLAN). */
    function osiWireSize(payload) {
        return bytesOf(['eth', 'ip', 'tcp', 'data', 'fcs'], payload);
    }

    function stage(layer, message, stack, payload, extra) {
        return Object.assign({ layer: layer, message: message, adds: [], removes: [], stack: stack, bytes: bytesOf(stack, payload), bits: false }, extra || {});
    }

    function osiEncapsulationStages(payload) {
        const size = payload === undefined ? 100 : payload;
        const full = ['eth', 'ip', 'tcp', 'data', 'fcs'];
        const sender = [
            stage(7, 'Couche Application : les données sont prêtes (HTTP fournit ses propres en-têtes dans les données)', ['data'], size),
            stage(6, 'Couche Présentation : encodage ou chiffrement des données, sans en-tête propre dans TCP/IP', ['data'], size),
            stage(5, 'Couche Session : gestion du dialogue, sans en-tête propre dans TCP/IP', ['data'], size),
            stage(4, 'Couche Transport : ajout de l\'en-tête TCP (ports, séquence)', ['tcp', 'data'], size, { adds: ['tcp'] }),
            stage(3, 'Couche Réseau : ajout de l\'en-tête IP (adresses)', ['ip', 'tcp', 'data'], size, { adds: ['ip'] }),
            stage(2, 'Couche Liaison : ajout de l\'en-tête Ethernet (MAC) et du FCS de fin', full, size, { adds: ['eth', 'fcs'] }),
            stage(1, 'Couche Physique : conversion de la trame en bits, sans rien ajouter', full, size, { bits: true })
        ];
        const receiver = [
            stage(1, 'Couche Physique : réception des bits, reconstitution de la trame', full, size, { bits: true }),
            stage(2, 'Couche Liaison : vérification du FCS, retrait de l\'en-tête Ethernet et du FCS', ['ip', 'tcp', 'data'], size, { removes: ['eth', 'fcs'] }),
            stage(3, 'Couche Réseau : vérification de l\'adresse de destination, retrait de l\'en-tête IP', ['tcp', 'data'], size, { removes: ['ip'] }),
            stage(4, 'Couche Transport : retrait de l\'en-tête TCP, réassemblage', ['data'], size, { removes: ['tcp'] }),
            stage(5, 'Couche Session : gestion du dialogue, rien à retirer', ['data'], size),
            stage(6, 'Couche Présentation : déchiffrement ou décodage, rien à retirer', ['data'], size),
            stage(7, 'Couche Application : les données sont livrées à l\'application', ['data'], size)
        ];
        return { sender: sender, receiver: receiver, wireBytes: osiWireSize(size) };
    }

    /** Pile d'identifiants -> parties affichables { cls, label }. */
    function osiStackParts(stack) {
        return stack.map(function (id) { return OSI_PARTS[id]; });
    }

    return {
        OSI_HEADER_BYTES: OSI_HEADER_BYTES,
        osiWireSize: osiWireSize,
        osiEncapsulationStages: osiEncapsulationStages,
        osiStackParts: osiStackParts
    };
});
