class OsiModelPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        // Layer data
        const osiLayers = {
            7: {
                name: 'Couche 7 - Application',
                role: 'Interface entre l\'utilisateur et le réseau. Fournit les services réseau aux applications (navigation web, courrier électronique, transfert de fichiers).',
                pdu: 'Données',
                protocols: ['HTTP', 'HTTPS', 'FTP', 'SMTP', 'POP3', 'IMAP', 'DNS', 'DHCP', 'SSH', 'Telnet', 'SNMP']
            },
            6: {
                name: 'Couche 6 - Présentation',
                role: 'Traduit les données entre le format réseau et le format compréhensible par l\'application. Gère le chiffrement, la compression et la conversion de format. Dans TCP/IP, cette couche n\'a pas d\'en-tête propre : TLS est un protocole applicatif posé au-dessus de TCP.',
                pdu: 'Données',
                protocols: ['SSL/TLS', 'JPEG', 'GIF', 'PNG', 'MPEG', 'ASCII', 'Unicode', 'MIME']
            },
            5: {
                name: 'Couche 5 - Session',
                role: 'Établit, maintient et termine les sessions de communication entre les applications. Gère la synchronisation et le contrôle du dialogue. Dans TCP/IP, c\'est l\'application qui s\'en charge : il n\'y a pas d\'en-tête de session.',
                pdu: 'Données',
                protocols: ['NetBIOS', 'RPC', 'PPTP', 'SAP', 'SDP', 'NFS']
            },
            4: {
                name: 'Couche 4 - Transport',
                role: 'Assure le transfert fiable (ou non) des données de bout en bout. Segmentation, contrôle de flux, correction d\'erreurs et multiplexage des connexions.',
                pdu: 'Segment (TCP) / Datagramme (UDP)',
                protocols: ['TCP', 'UDP', 'SCTP', 'DCCP', 'SPX']
            },
            3: {
                name: 'Couche 3 - Réseau',
                role: 'Gère l\'adressage logique (IP) et le routage des paquets à travers différents réseaux. Détermine le meilleur chemin pour acheminer les données. Les protocoles de routage (OSPF, BGP, RIP) sont classés ici par convention ; dans la pile TCP/IP ils s\'appuient sur IP, UDP ou TCP.',
                pdu: 'Paquet',
                protocols: ['IP (IPv4/IPv6)', 'ICMP', 'ARP', 'OSPF', 'BGP', 'RIP', 'EIGRP', 'IPsec']
            },
            2: {
                name: 'Couche 2 - Liaison de données',
                role: 'Assure le transfert fiable de trames entre deux nœuds directement connectés. Gère l\'adressage physique (MAC), la détection d\'erreurs et le contrôle d\'accès au média.',
                pdu: 'Trame',
                protocols: ['Ethernet', 'Wi-Fi (802.11)', 'PPP', 'HDLC', 'Frame Relay', 'STP', 'VLAN (802.1Q)']
            },
            1: {
                name: 'Couche 1 - Physique',
                role: 'Transmet les bits bruts sur le support physique (câble, fibre optique, ondes radio). Définit les caractéristiques électriques, mécaniques et fonctionnelles.',
                pdu: 'Bits',
                protocols: ['Ethernet physique', 'USB', 'Bluetooth', 'DSL', 'ISDN', 'RS-232', 'Fibre optique', 'Wi-Fi (radio)']
            }
        };

        const tcpipLayers = {
            application: {
                name: 'Couche Application (TCP/IP)',
                role: 'Regroupe les fonctions des couches 5, 6 et 7 du modèle OSI. Fournit directement les services réseau aux applications utilisateur.',
                pdu: 'Données / Messages',
                protocols: ['HTTP', 'HTTPS', 'FTP', 'SMTP', 'DNS', 'DHCP', 'SSH', 'SNMP', 'POP3', 'IMAP']
            },
            transport: {
                name: 'Couche Transport (TCP/IP)',
                role: 'Identique à la couche 4 OSI. Assure la communication de bout en bout avec contrôle de flux et fiabilité (TCP) ou rapidité (UDP).',
                pdu: 'Segment / Datagramme',
                protocols: ['TCP', 'UDP', 'SCTP']
            },
            internet: {
                name: 'Couche Internet (TCP/IP)',
                role: 'Correspond à la couche 3 OSI. Gère l\'adressage IP et le routage des paquets entre réseaux différents.',
                pdu: 'Paquet / Datagramme IP',
                protocols: ['IPv4', 'IPv6', 'ICMP', 'ARP', 'IGMP', 'IPsec']
            },
            access: {
                name: 'Couche Accès réseau (TCP/IP)',
                role: 'Regroupe les couches 1 et 2 du modèle OSI. Gère la transmission physique et le cadrage des données sur le réseau local.',
                pdu: 'Trame / Bits',
                protocols: ['Ethernet', 'Wi-Fi', 'PPP', 'ARP (parfois placé ici)', 'Token Ring']
            }
        };

        const osiToTcpip = {
            7: 'application',
            6: 'application',
            5: 'application',
            4: 'transport',
            3: 'internet',
            2: 'access',
            1: 'access'
        };
        const tcpipToOsi = {
            application: [7, 6, 5],
            transport: [4],
            internet: [3],
            access: [2, 1]
        };

        function clearModelHighlights() {
            document.querySelectorAll('.osi-layer, .tcpip-layer').forEach((el) => {
                el.classList.remove('active', 'mapped');
            });
        }

        function showDetail(layer) {
            const data = osiLayers[layer];
            document.getElementById('detail-title').textContent = data.name;
            document.getElementById('detail-role').textContent = data.role;
            document.getElementById('detail-pdu').innerHTML = '<span style="font-weight:600; font-size:0.85rem;">PDU : </span><span class="badge badge-primary">' + data.pdu + '</span>';
            const protoDiv = document.getElementById('detail-protocols');
            protoDiv.innerHTML = data.protocols.map(p => '<span class="proto-tag">' + p + '</span>').join('');

            clearModelHighlights();
            const osiEl = document.querySelector(`.osi-layer[data-layer="${layer}"]`);
            const tcpipKey = osiToTcpip[layer];
            const tcpipEl = tcpipKey ? document.querySelector(`.tcpip-layer[data-tcpip="${tcpipKey}"]`) : null;
            if (osiEl) osiEl.classList.add('active');
            if (tcpipEl) tcpipEl.classList.add('mapped');
        }

        function showTcpipDetail(layer) {
            const data = tcpipLayers[layer];
            document.getElementById('detail-title').textContent = data.name;
            document.getElementById('detail-role').textContent = data.role;
            document.getElementById('detail-pdu').innerHTML = '<span style="font-weight:600; font-size:0.85rem;">PDU : </span><span class="badge badge-primary">' + data.pdu + '</span>';
            const protoDiv = document.getElementById('detail-protocols');
            protoDiv.innerHTML = data.protocols.map(p => '<span class="proto-tag">' + p + '</span>').join('');

            clearModelHighlights();
            const tcpipEl = document.querySelector(`.tcpip-layer[data-tcpip="${layer}"]`);
            const osiLayersToMark = tcpipToOsi[layer] || [];
            if (tcpipEl) tcpipEl.classList.add('active');
            osiLayersToMark.forEach((osiLayer) => {
                const osiEl = document.querySelector(`.osi-layer[data-layer="${osiLayer}"]`);
                if (osiEl) osiEl.classList.add('mapped');
            });
        }

        // Animation
        let animRunning = false;
        let speedCtrl;

        // Speed controller is initialized at component startup.

        function resetAnimation() {
            animRunning = false;
            document.querySelectorAll('.anim-layer').forEach(el => {
                el.classList.remove('visited', 'current');
            });
            document.getElementById('packet-visual').innerHTML = '';
            const size = document.getElementById('packet-size');
            if (size) size.textContent = '';
            document.getElementById('anim-status').textContent = 'Clique sur « Envoyer un paquet » pour démarrer l\'animation.';
            const mp = document.getElementById('medium-packet');
            mp.style.display = 'none';
            mp.style.left = '0px';
        }

        function updatePacket(parts, bytes, bits) {
            const pv = document.getElementById('packet-visual');
            pv.innerHTML = '';
            parts.forEach(p => {
                const div = document.createElement('div');
                div.className = 'packet-part ' + p.cls;
                div.textContent = p.label;
                pv.appendChild(div);
            });
            const size = document.getElementById('packet-size');
            if (size) {
                size.textContent = bytes ? bytes + ' octets pour 100 octets de données' + (bits ? ' (envoyés bit par bit)' : '') : '';
            }
        }

        async function startAnimation() {
            if (animRunning) return;
            animRunning = true;
            resetAnimation();
            animRunning = true;

            const status = document.getElementById('anim-status');
            const Osi = window.OEITrace;
            const plan = Osi.osiEncapsulationStages(100);
            const showStage = (st) => updatePacket(Osi.osiStackParts(st.stack), st.bytes, st.bits);

            // Encapsulation (sender, top to bottom)
            for (const st of plan.sender) {
                if (!animRunning) return;
                const el = document.getElementById('s-l' + st.layer);
                document.querySelectorAll('.anim-layer').forEach(e => e.classList.remove('current'));
                el.classList.add('visited', 'current');
                status.textContent = 'Encapsulation : ' + st.message;
                showStage(st);
                await OEIUtils.sleep(speedCtrl.getDelay());
            }

            // Transmission across medium
            if (!animRunning) return;
            status.textContent = 'Transmission sur le support physique...';
            const mp = document.getElementById('medium-packet');
            const medium = document.getElementById('anim-medium');
            mp.style.display = 'block';
            mp.style.left = '0px';
            mp.style.transition = 'left 1.5s ease-in-out';
            await OEIUtils.sleep(50);
            mp.style.left = (medium.offsetWidth - 40) + 'px';
            await OEIUtils.sleep(1600);
            mp.style.display = 'none';

            // Decapsulation (receiver, bottom to top)
            for (const st of plan.receiver) {
                if (!animRunning) return;
                const el = document.getElementById('r-l' + st.layer);
                document.querySelectorAll('.anim-layer').forEach(e => e.classList.remove('current'));
                el.classList.add('visited', 'current');
                status.textContent = 'Décapsulation : ' + st.message;
                showStage(st);
                await OEIUtils.sleep(speedCtrl.getDelay());
            }

            if (!animRunning) return;
            status.textContent = 'Transmission terminée ! Les données ont été livrées au récepteur.';
            status.style.color = 'var(--ok)';
            setTimeout(() => { status.style.color = ''; }, 3000);
            animRunning = false;
        }
        speedCtrl = new OEIUtils.SpeedController('speedSlider', 'speedLabel');

        document.querySelectorAll('.osi-layer[data-layer]').forEach((button) => {
            button.addEventListener('click', () => {
                const layer = Number(button.dataset.layer);
                if (Number.isFinite(layer) && layer >= 1 && layer <= 7) {
                    showDetail(layer);
                }
            });
        });

        document.querySelectorAll('.tcpip-layer[data-tcpip]').forEach((button) => {
            button.addEventListener('click', () => {
                const layer = String(button.dataset.tcpip || '').trim();
                if (layer) showTcpipDetail(layer);
            });
        });

        const startBtn = document.getElementById('btn-start-animation');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                startAnimation();
            });
        }

        const resetBtn = document.getElementById('btn-reset-animation');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetAnimation();
            });
        }

        showDetail(7);
    }
}

if (typeof window !== 'undefined') {
    window.OsiModelPage = OsiModelPage;
}
