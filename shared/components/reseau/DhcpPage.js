class DhcpPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.clients = [
            { id: 'pc-01', label: 'Poste-01', mac: '02:01:AA:10:00:01' },
            { id: 'pc-02', label: 'Poste-02', mac: '02:01:AA:10:00:02' },
            { id: 'pc-03', label: 'Poste-03', mac: '02:01:AA:10:00:03' },
            { id: 'pc-04', label: 'Poste-04', mac: '02:01:AA:10:00:04' }
        ];

        this.pool = this.buildPool('192.168.10.', 20, 35);
        this.leases = [];
        this.transaction = null;

        this.autoTimer = null;
        this.speedCtrl = null;
        this.isStepBusy = false;

        this.nodeOrder = {
            client: 12,
            switch: 37,
            relay: 62,
            server: 87
        };
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.bindEvents();
        this.renderClientOptions();
        this.updateTopologyMode();
        this.resetNetwork();
    }

    cacheDom() {
        this.clientSelect = document.getElementById('dhcp-client-select');
        this.startBtn = document.getElementById('dhcp-start');
        this.stepBtn = document.getElementById('dhcp-step');
        this.autoBtn = document.getElementById('dhcp-auto');
        this.resetBtn = document.getElementById('dhcp-reset');
        this.relayToggle = document.getElementById('dhcp-relay-toggle');
        this.serverDownToggle = document.getElementById('dhcp-server-down');

        this.clientLabel = document.getElementById('dhcp-client-label');
        this.nodeClient = document.getElementById('dhcp-node-client');
        this.nodeSwitch = document.getElementById('dhcp-node-switch');
        this.nodeRelay = document.getElementById('dhcp-node-relay');
        this.nodeServer = document.getElementById('dhcp-node-server');
        this.topology = document.getElementById('dhcp-topology');
        this.packet = document.getElementById('dhcp-packet');
        this.pathLabel = document.getElementById('dhcp-path-label');

        this.timeline = document.getElementById('dhcp-dora-timeline');

        this.phaseOutput = document.getElementById('dhcp-phase-label');
        this.currentIpOutput = document.getElementById('dhcp-current-ip');
        this.leaseCountOutput = document.getElementById('dhcp-lease-count');
        this.poolFreeOutput = document.getElementById('dhcp-pool-free');

        this.poolGrid = document.getElementById('dhcp-pool-grid');

        this.logOutput = document.getElementById('dhcp-log');
        this.leasesBody = document.getElementById('dhcp-leases-body');
        this.feedback = document.getElementById('dhcp-feedback');

        this.nodesByKey = {
            client: this.nodeClient,
            switch: this.nodeSwitch,
            relay: this.nodeRelay,
            server: this.nodeServer
        };
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => {
            this.stopAuto();
            this.startTransaction();
        });

        this.stepBtn.addEventListener('click', () => this.stepTransaction());
        this.autoBtn.addEventListener('click', () => this.toggleAuto());
        this.resetBtn.addEventListener('click', () => this.resetNetwork());

        this.clientSelect.addEventListener('change', () => {
            const client = this.getSelectedClient();
            this.clientLabel.textContent = client ? `${client.label} / ${client.mac}` : '-';
        });

        this.relayToggle.addEventListener('change', () => {
            this.updateTopologyMode();
            this.setFeedback('Mode de transit modifie (applique a la prochaine etape).', 'warning');
        });

        this.serverDownToggle.addEventListener('change', () => {
            if (this.serverDownToggle.checked) {
                this.setFeedback('Serveur DHCP simule indisponible.', 'warning');
            } else {
                this.setFeedback('Serveur DHCP de nouveau operationnel.', 'info');
            }
        });
    }

    buildPool(prefix, from, to) {
        const result = [];
        for (let i = from; i <= to; i += 1) {
            result.push(`${prefix}${i}`);
        }
        return result;
    }

    renderClientOptions() {
        this.clientSelect.innerHTML = this.clients
            .map((client) => `<option value="${this.escapeHtml(client.id)}">${this.escapeHtml(client.label)} (${this.escapeHtml(client.mac)})</option>`)
            .join('');
    }

    getSelectedClient() {
        const id = this.clientSelect.value;
        return this.clients.find((client) => client.id === id) || this.clients[0];
    }

    relayEnabled() {
        return Boolean(this.relayToggle.checked);
    }

    updateTopologyMode() {
        const relayOn = this.relayEnabled();
        this.topology.classList.toggle('relay-on', relayOn);
        this.topology.classList.toggle('relay-off', !relayOn);
        this.nodeRelay.classList.toggle('disabled', !relayOn);

        if (!this.transaction) {
            const route = relayOn ? ['client', 'switch', 'relay', 'server'] : ['client', 'switch', 'server'];
            this.pathLabel.textContent = this.readablePath(route);
        }
    }

    getLeaseByMac(mac) {
        return this.leases.find((lease) => lease.mac === mac) || null;
    }

    getFirstFreeIp() {
        const used = new Set(this.leases.map((lease) => lease.ip));
        return this.pool.find((ip) => !used.has(ip)) || null;
    }

    getOfferIp(client) {
        const existing = this.getLeaseByMac(client.mac);
        if (existing) return existing.ip;
        return this.getFirstFreeIp();
    }

    phaseText() {
        if (!this.transaction) return 'Idle';
        if (this.transaction.done && this.transaction.failed) {
            return `Echec (${this.transaction.failStage || 'offer'})`;
        }
        if (this.transaction.done) return 'Termine (ACK)';

        switch (this.transaction.phase) {
        case 0: return 'Pret DISCOVER';
        case 1: return 'Attente OFFER';
        case 2: return 'Attente REQUEST';
        case 3: return 'Attente ACK';
        default: return 'Idle';
        }
    }

    setFeedback(message, type) {
        this.feedback.className = `feedback ${type || ''}`;
        this.feedback.textContent = message;
    }

    addLog(text, type = 'info') {
        const item = document.createElement('li');
        item.className = `mod-log-item ${type}`;
        item.textContent = text;
        this.logOutput.prepend(item);
    }

    sleep(ms) {
        if (typeof OEIUtils !== 'undefined' && typeof OEIUtils.sleep === 'function') {
            return OEIUtils.sleep(ms);
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    setPacket(label, tone) {
        this.packet.textContent = label;
        this.packet.className = `dhcp-packet ${tone || ''}`;
    }

    hidePacket() {
        this.packet.className = 'dhcp-packet hidden';
        this.packet.dataset.pos = 'client';
    }

    highlightNodes(keys) {
        Object.values(this.nodesByKey).forEach((node) => node.classList.remove('active'));
        keys.forEach((key) => {
            if (!this.nodesByKey[key]) return;
            this.nodesByKey[key].classList.add('active');
        });
    }

    readableNode(key) {
        if (key === 'client') return 'Client';
        if (key === 'switch') return 'Switch';
        if (key === 'relay') return 'Relay';
        if (key === 'server') return 'Serveur';
        return key;
    }

    readablePath(keys) {
        return keys.map((key) => this.readableNode(key)).join(' -> ');
    }

    routeOut() {
        return this.relayEnabled()
            ? ['client', 'switch', 'relay', 'server']
            : ['client', 'switch', 'server'];
    }

    routeBack() {
        return this.routeOut().slice().reverse();
    }

    async animateRoute(keys, label, tone) {
        this.pathLabel.textContent = this.readablePath(keys);
        this.setPacket(label, tone);
        this.packet.dataset.pos = keys[0];
        const baseDelay = this.currentDelay();
        const startPause = Math.max(120, Math.round(baseDelay * 0.25));
        const hopPause = Math.max(220, Math.round(baseDelay * 0.65));
        await this.sleep(startPause);

        for (let i = 0; i < keys.length; i += 1) {
            const key = keys[i];
            this.packet.dataset.pos = key;
            this.highlightNodes([key]);
            await this.sleep(hopPause);
        }
    }

    startTransaction() {
        const client = this.getSelectedClient();
        if (!client) return;

        this.transaction = {
            client,
            phase: 0,
            offeredIp: null,
            done: false,
            failed: false,
            failStage: null
        };

        this.clientLabel.textContent = `${client.label} / ${client.mac}`;
        this.currentIpOutput.textContent = '-';
        this.hidePacket();
        this.highlightNodes([]);

        this.setFeedback(`Transaction initialisee pour ${client.label}.`, 'info');
        this.addLog(`Nouvelle transaction pour ${client.label} (${client.mac}).`, 'info');
        this.renderAll();
    }

    commitLease(client, ip) {
        const expiry = new Date(Date.now() + 60 * 60 * 1000);
        const existing = this.getLeaseByMac(client.mac);
        if (existing) {
            existing.ip = ip;
            existing.expiresAt = expiry;
            return;
        }
        this.leases.push({
            clientId: client.id,
            clientLabel: client.label,
            mac: client.mac,
            ip,
            expiresAt: expiry
        });
    }

    async stepTransaction() {
        if (this.isStepBusy) return;
        this.isStepBusy = true;

        try {
            if (!this.transaction || this.transaction.done) {
                this.startTransaction();
                return;
            }

            const tx = this.transaction;

            if (tx.phase === 0) {
                await this.animateRoute(this.routeOut(), 'DISCOVER', 'from-client');
                this.addLog(`${tx.client.label} diffuse DHCPDISCOVER.`, 'warn');
                this.setFeedback('Le client cherche un serveur DHCP.', 'info');
                tx.phase = 1;
                this.renderAll();
                return;
            }

            if (tx.phase === 1) {
                if (this.serverDownToggle.checked) {
                    tx.done = true;
                    tx.failed = true;
                    tx.failStage = 'offer';
                    this.hidePacket();
                    this.highlightNodes([]);
                    this.addLog('Aucune reponse du serveur DHCP (indisponible).', 'bad');
                    this.setFeedback('Timeout: aucun DHCPOFFER recu.', 'bad');
                    this.renderAll();
                    return;
                }

                tx.offeredIp = this.getOfferIp(tx.client);

                if (!tx.offeredIp) {
                    tx.done = true;
                    tx.failed = true;
                    tx.failStage = 'offer';
                    await this.animateRoute(this.routeBack(), 'NAK (POOL VIDE)', 'from-server bad');
                    this.addLog('Serveur: aucun bail disponible, DHCPNAK.', 'bad');
                    this.setFeedback('Echec: pool DHCP vide.', 'bad');
                    this.renderAll();
                    return;
                }

                this.currentIpOutput.textContent = tx.offeredIp;
                await this.animateRoute(this.routeBack(), `OFFER ${tx.offeredIp}`, 'from-server');
                this.addLog(`Serveur propose ${tx.offeredIp} via DHCPOFFER.`, 'ok');
                this.setFeedback('Le serveur reserve provisoirement une IP.', 'info');
                tx.phase = 2;
                this.renderAll();
                return;
            }

            if (tx.phase === 2) {
                await this.animateRoute(this.routeOut(), `REQUEST ${tx.offeredIp}`, 'from-client');
                this.addLog(`${tx.client.label} demande officiellement ${tx.offeredIp}.`, 'warn');
                this.setFeedback('Le client confirme l offre retenue.', 'info');
                tx.phase = 3;
                this.renderAll();
                return;
            }

            if (tx.phase === 3) {
                this.commitLease(tx.client, tx.offeredIp);
                await this.animateRoute(this.routeBack(), `ACK ${tx.offeredIp}`, 'from-server');
                tx.done = true;
                tx.failed = false;

                this.addLog(`Serveur valide le bail: DHCPACK ${tx.offeredIp}.`, 'ok');
                this.setFeedback('Bail etabli avec succes.', 'ok');
                this.stopAuto();
                this.renderAll();
            }
        } finally {
            this.isStepBusy = false;
        }
    }

    renderLeases() {
        if (!this.leases.length) {
            this.leasesBody.innerHTML = '<tr><td colspan="4" class="text-muted">Aucun bail actif</td></tr>';
            return;
        }

        this.leasesBody.innerHTML = this.leases
            .map((lease) => {
                const exp = lease.expiresAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                return `
                    <tr>
                        <td>${this.escapeHtml(lease.clientLabel)}</td>
                        <td class="mono">${this.escapeHtml(lease.mac)}</td>
                        <td class="mono">${this.escapeHtml(lease.ip)}</td>
                        <td>${this.escapeHtml(exp)}</td>
                    </tr>
                `;
            })
            .join('');
    }

    renderPoolGrid() {
        const leasedByIp = new Map(this.leases.map((lease) => [lease.ip, lease]));
        const offeredIp = (this.transaction && !this.transaction.done) ? this.transaction.offeredIp : null;

        this.poolGrid.innerHTML = this.pool
            .map((ip) => {
                const lease = leasedByIp.get(ip);
                const suffix = ip.split('.').pop();

                let state = 'free';
                let extra = 'Libre';
                if (lease) {
                    state = 'leased';
                    extra = lease.clientLabel;
                } else if (offeredIp === ip) {
                    state = 'offered';
                    extra = 'Offerte';
                }

                return `
                    <div class="dhcp-pool-cell ${state}" title="${this.escapeHtml(ip)} - ${this.escapeHtml(extra)}">
                        <div class="ip">.${this.escapeHtml(suffix)}</div>
                        <div class="meta">${this.escapeHtml(extra)}</div>
                    </div>
                `;
            })
            .join('');
    }

    renderTimeline() {
        const steps = Array.from(this.timeline.querySelectorAll('.dhcp-dora-step'));
        steps.forEach((step) => step.classList.remove('active', 'done', 'fail'));

        if (!this.transaction) return;
        const tx = this.transaction;

        const mark = {
            discover: steps[0],
            offer: steps[1],
            request: steps[2],
            ack: steps[3]
        };

        if (tx.done && tx.failed) {
            mark.discover.classList.add('done');
            if (tx.failStage === 'offer') {
                mark.offer.classList.add('fail');
            } else if (tx.failStage === 'ack') {
                mark.offer.classList.add('done');
                mark.request.classList.add('done');
                mark.ack.classList.add('fail');
            }
            return;
        }

        if (tx.done) {
            steps.forEach((step) => step.classList.add('done'));
            return;
        }

        if (tx.phase === 0) {
            mark.discover.classList.add('active');
        }
        if (tx.phase === 1) {
            mark.discover.classList.add('done');
            mark.offer.classList.add('active');
        }
        if (tx.phase === 2) {
            mark.discover.classList.add('done');
            mark.offer.classList.add('done');
            mark.request.classList.add('active');
        }
        if (tx.phase === 3) {
            mark.discover.classList.add('done');
            mark.offer.classList.add('done');
            mark.request.classList.add('done');
            mark.ack.classList.add('active');
        }
    }

    renderMetrics() {
        const used = new Set(this.leases.map((lease) => lease.ip));
        this.leaseCountOutput.textContent = String(this.leases.length);
        this.poolFreeOutput.textContent = String(this.pool.length - used.size);

        this.phaseOutput.textContent = this.phaseText();
    }

    renderAll() {
        this.renderMetrics();
        this.renderPoolGrid();
        this.renderTimeline();
        this.renderLeases();
        this.updateTopologyMode();
    }

    toggleAuto() {
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }
        this.autoBtn.textContent = 'Pause';
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    async autoLoop() {
        if (!this.autoTimer) return;
        await this.stepTransaction();

        if (this.transaction && this.transaction.done) {
            this.stopAuto();
            return;
        }
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    stopAuto() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.autoBtn.textContent = 'Lecture auto';
    }

    resetNetwork() {
        this.stopAuto();
        this.transaction = null;
        this.leases = [];
        this.logOutput.innerHTML = '';

        this.highlightNodes([]);
        this.hidePacket();

        const client = this.getSelectedClient();
        this.clientLabel.textContent = client ? `${client.label} / ${client.mac}` : '-';
        this.currentIpOutput.textContent = '-';

        this.setFeedback('Reseau reinitialise. Aucun bail actif.', 'info');
        this.renderAll();
    }
}

if (typeof window !== 'undefined') {
    window.DhcpPage = DhcpPage;
}
