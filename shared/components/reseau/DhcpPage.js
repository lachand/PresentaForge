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
        this.roguePool = ['192.168.10.250'];
        this.leases = [];
        this.clock = 0;
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
        this.rogueToggle = document.getElementById('dhcp-rogue');
        this.clockOutput = document.getElementById('dhcp-clock');
        this.timeButtons = Array.from(document.querySelectorAll('[data-dhcp-advance]'));

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
            this.setFeedback(this.relayEnabled()
                ? "Agent de relais activé (appliqué à la prochaine étape)."
                : "Agent de relais retiré : le serveur est dans un autre sous-réseau, la diffusion s'arrêtera au routeur.", 'warning');
        });

        this.serverDownToggle.addEventListener('change', () => {
            if (this.serverDownToggle.checked) {
                this.setFeedback('Serveur DHCP simulé indisponible.', 'warning');
            } else {
                this.setFeedback('Serveur DHCP de nouveau opérationnel.', 'info');
            }
        });

        this.rogueToggle.addEventListener('change', () => {
            this.setFeedback(this.rogueToggle.checked
                ? 'Un serveur pirate est branché sur le segment : il répondra au DISCOVER avant le vrai serveur.'
                : 'Le serveur pirate est débranché.', 'warning');
        });

        this.timeButtons.forEach((button) => {
            button.addEventListener('click', () => {
                const kind = button.dataset.dhcpAdvance;
                if (kind === 'next') this.advanceToNextDeadline();
                else this.advanceClock(Number(kind) * 3600);
            });
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
        const note = this.nodeRelay.querySelector('small');
        if (note) note.textContent = relayOn ? 'Agent de relais (option 82)' : "Sans relais : la diffusion s'arrête ici";

        if (!this.transaction) {
            const route = relayOn ? ['client', 'switch', 'relay', 'server'] : ['client', 'switch', 'relay'];
            this.pathLabel.textContent = this.readablePath(route);
        }
    }

    get model() {
        return window.OEITrace;
    }

    activeLeases() {
        return this.leases.filter((lease) => lease.state !== 'apipa' && lease.source !== 'rogue');
    }

    getLeaseByMac(mac) {
        return this.leases.find((lease) => lease.mac === mac) || null;
    }

    getFirstFreeIp() {
        const used = new Set(this.activeLeases().map((lease) => lease.ip));
        return this.pool.find((ip) => !used.has(ip)) || null;
    }

    getOfferIp(client) {
        const existing = this.getLeaseByMac(client.mac);
        if (existing && existing.state !== 'apipa' && existing.source !== 'rogue') return existing.ip;
        return this.getFirstFreeIp();
    }

    phaseText() {
        if (!this.transaction) return 'Idle';
        if (this.transaction.done && this.transaction.failed) {
            return `Échec (${this.transaction.failStage || 'offer'})`;
        }
        if (this.transaction.done) return 'Terminé (ACK)';

        switch (this.transaction.phase) {
        case 0: return 'Prêt pour DISCOVER';
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
        if (key === 'relay') return 'Routeur';
        if (key === 'server') return 'Serveur';
        return key;
    }

    readablePath(keys) {
        return keys.map((key) => this.readableNode(key)).join(' -> ');
    }

    routeOut() {
        if (this.transaction && this.transaction.rogue) return ['client', 'switch'];
        return this.relayEnabled()
            ? ['client', 'switch', 'relay', 'server']
            : ['client', 'switch', 'relay'];
    }

    routeBack() {
        if (this.transaction && this.transaction.rogue) return ['switch', 'client'];
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
            rogue: false,
            done: false,
            failed: false,
            failStage: null
        };

        this.clientLabel.textContent = `${client.label} / ${client.mac}`;
        this.currentIpOutput.textContent = '-';
        this.hidePacket();
        this.highlightNodes([]);

        this.setFeedback(`Transaction initialisée pour ${client.label}.`, 'info');
        this.addLog(`Nouvelle transaction pour ${client.label} (${client.mac}).`, 'info');
        this.renderAll();
    }

    commitLease(client, ip, source) {
        const lease = {
            clientId: client.id,
            clientLabel: client.label,
            mac: client.mac,
            ip,
            leaseSeconds: this.model.DHCP_LEASE_SECONDS,
            grantedAt: this.clock,
            state: 'bound',
            source: source || 'server'
        };
        const index = this.leases.findIndex((l) => l.mac === client.mac);
        if (index >= 0) this.leases[index] = lease;
        else this.leases.push(lease);
    }

    setApipa(client) {
        const index = this.clients.indexOf(client);
        const ip = this.model.dhcpApipaAddress(index < 0 ? 0 : index);
        const lease = {
            clientId: client.id,
            clientLabel: client.label,
            mac: client.mac,
            ip,
            leaseSeconds: this.model.DHCP_LEASE_SECONDS,
            grantedAt: this.clock,
            state: 'apipa',
            source: 'apipa'
        };
        const at = this.leases.findIndex((l) => l.mac === client.mac);
        if (at >= 0) this.leases[at] = lease;
        else this.leases.push(lease);
        return ip;
    }

    failTransaction(tx, message, feedback) {
        tx.done = true;
        tx.failed = true;
        tx.failStage = 'offer';
        this.hidePacket();
        this.highlightNodes([]);
        const apipa = this.setApipa(tx.client);
        this.addLog(message, 'bad');
        this.addLog(`Après plusieurs DISCOVER sans réponse, ${tx.client.label} s'auto-attribue ${apipa} (APIPA).`, 'warn');
        this.setFeedback(feedback, 'bad');
        this.renderAll();
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
                tx.outcome = this.model.dhcpDiscoverOutcome({
                    relay: this.relayEnabled(),
                    serverUp: !this.serverDownToggle.checked,
                    poolFree: this.pool.length - this.activeLeases().filter((l) => this.pool.includes(l.ip) && l.mac !== tx.client.mac).length,
                    rogue: this.rogueToggle.checked
                });
                tx.rogue = tx.outcome.from === 'rogue';
                await this.animateRoute(this.routeOut(), 'DISCOVER', 'from-client');
                this.addLog(`${tx.client.label} diffuse DHCPDISCOVER.`, 'warn');
                if (tx.outcome.reason === 'no-relay') {
                    this.addLog("Le routeur ne transmet pas les diffusions : le DISCOVER s'arrête ici (pas d'agent de relais).", 'bad');
                }
                this.setFeedback('Le client cherche un serveur DHCP.', 'info');
                tx.phase = 1;
                this.renderAll();
                return;
            }

            if (tx.phase === 1) {
                const outcome = tx.outcome;
                if (outcome.result === 'timeout') {
                    const reasons = {
                        'no-relay': ["Aucune réponse : la diffusion n'a pas franchi le routeur.", 'Délai dépassé : sans agent de relais, le DISCOVER ne rejoint jamais le serveur.'],
                        'server-down': ['Aucune réponse du serveur DHCP (indisponible).', 'Délai dépassé : aucun DHCPOFFER reçu.'],
                        'pool-empty': ["Le pool est épuisé : le serveur n'a plus d'adresse à offrir et ne répond pas.", 'Délai dépassé : le pool est vide, le serveur reste silencieux.']
                    };
                    const [log, feedback] = reasons[outcome.reason];
                    this.failTransaction(tx, log, feedback);
                    return;
                }

                tx.offeredIp = tx.rogue ? this.roguePool[0] : this.getOfferIp(tx.client);
                this.currentIpOutput.textContent = tx.offeredIp;
                await this.animateRoute(this.routeBack(), `OFFER ${tx.offeredIp}${tx.rogue ? ' (pirate)' : ''}`, tx.rogue ? 'from-server bad' : 'from-server');
                if (tx.rogue) {
                    this.addLog(`Un serveur pirate répond le premier et propose ${tx.offeredIp} avec sa propre passerelle.`, 'bad');
                    this.setFeedback('Le client prend la première offre reçue : il ne sait pas que ce serveur est illégitime.', 'warning');
                } else {
                    this.addLog(`Serveur propose ${tx.offeredIp} via DHCPOFFER.`, 'ok');
                    this.setFeedback('Le serveur réserve provisoirement une IP.', 'info');
                }
                tx.phase = 2;
                this.renderAll();
                return;
            }

            if (tx.phase === 2) {
                await this.animateRoute(this.routeOut(), `REQUEST ${tx.offeredIp}`, 'from-client');
                this.addLog(`${tx.client.label} demande officiellement ${tx.offeredIp}.`, 'warn');
                this.setFeedback("Le client confirme l'offre retenue.", 'info');
                tx.phase = 3;
                this.renderAll();
                return;
            }

            if (tx.phase === 3) {
                this.commitLease(tx.client, tx.offeredIp, tx.rogue ? 'rogue' : 'server');
                await this.animateRoute(this.routeBack(), `ACK ${tx.offeredIp}`, 'from-server');
                tx.done = true;
                tx.failed = false;

                if (tx.rogue) {
                    this.addLog(`Le serveur pirate valide le bail : DHCPACK ${tx.offeredIp}.`, 'bad');
                    this.setFeedback('Bail établi, mais avec un serveur pirate : sa passerelle et ses DNS sont ceux de l\'attaquant.', 'warning');
                } else {
                    this.addLog(`Serveur valide le bail : DHCPACK ${tx.offeredIp}, durée 8 h.`, 'ok');
                    this.setFeedback('Bail établi. Avance l\'horloge pour voir T1 et T2.', 'ok');
                }
                this.stopAuto();
                this.renderAll();
            }
        } finally {
            this.isStepBusy = false;
        }
    }

    leaseStateLabel(lease) {
        const labels = {
            bound: 'Lié',
            renewing: 'Renouvellement (T1 passé)',
            rebinding: 'Rebinding (T2 passé)',
            apipa: 'APIPA : aucun serveur'
        };
        return labels[lease.state] || lease.state;
    }

    renderLeases() {
        if (!this.leases.length) {
            this.leasesBody.innerHTML = '<tr><td colspan="6" class="text-muted">Aucun bail actif</td></tr>';
            return;
        }

        const fmt = (seconds) => this.model.dhcpFormatDuration(seconds);
        this.leasesBody.innerHTML = this.leases
            .map((lease) => {
                const timers = this.model.dhcpTimers(lease.leaseSeconds);
                const pirate = lease.source === 'rogue' ? ' (pirate)' : '';
                const marks = lease.state === 'apipa'
                    ? '-'
                    : `T1 ${fmt(lease.grantedAt + timers.t1)} / T2 ${fmt(lease.grantedAt + timers.t2)}`;
                const left = lease.state === 'apipa' ? '-' : fmt(lease.grantedAt + lease.leaseSeconds - this.clock);
                return `
                    <tr>
                        <td>${this.escapeHtml(lease.clientLabel)}</td>
                        <td class="mono">${this.escapeHtml(lease.mac)}</td>
                        <td class="mono">${this.escapeHtml(lease.ip + pirate)}</td>
                        <td>${this.escapeHtml(this.leaseStateLabel(lease))}</td>
                        <td>${this.escapeHtml(marks)}</td>
                        <td>${this.escapeHtml(left)}</td>
                    </tr>
                `;
            })
            .join('');
    }

    renderPoolGrid() {
        const leasedByIp = new Map(this.activeLeases().map((lease) => [lease.ip, lease]));
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
        const used = new Set(this.activeLeases().map((lease) => lease.ip));
        this.leaseCountOutput.textContent = String(used.size);
        this.poolFreeOutput.textContent = String(this.pool.length - used.size);
        if (this.clockOutput) this.clockOutput.textContent = '+' + this.model.dhcpFormatDuration(this.clock);

        this.phaseOutput.textContent = this.phaseText();
    }

    renderAll() {
        this.renderMetrics();
        this.renderPoolGrid();
        this.renderTimeline();
        this.renderLeases();
        this.updateTopologyMode();
    }

    advanceClock(seconds) {
        if (seconds <= 0) return;
        this.clock += seconds;
        const serverUp = !this.serverDownToggle.checked;
        const events = [];
        this.leases.forEach((lease, index) => {
            if (lease.state === 'apipa' || lease.source === 'rogue') return;
            const result = this.model.dhcpAdvanceLease(lease, this.clock, serverUp);
            result.events.forEach((event) => events.push({ ...event, lease: result.lease }));
            this.leases[index] = result.lease;
            if (result.lease.state === 'apipa') {
                const client = this.clients.find((c) => c.mac === lease.mac);
                result.lease.ip = this.model.dhcpApipaAddress(this.clients.indexOf(client));
                result.lease.source = 'apipa';
            }
        });
        events.sort((a, b) => a.at - b.at);
        events.forEach((event) => this.logLeaseEvent(event));
        if (!events.length) {
            this.addLog(`Horloge : +${this.model.dhcpFormatDuration(this.clock)}. Aucune échéance franchie.`, 'info');
        }
        this.setFeedback(events.length ? 'Des échéances de bail ont été franchies : lis le journal.' : 'Aucune échéance franchie.', events.length ? 'warning' : 'info');
        this.renderAll();
    }

    advanceToNextDeadline() {
        const deadlines = this.leases
            .map((lease) => this.model.dhcpNextDeadline(lease, this.clock))
            .filter((value) => value !== null);
        if (!deadlines.length) {
            this.setFeedback('Aucun bail avec une échéance à venir.', 'info');
            return;
        }
        this.advanceClock(Math.min(...deadlines) - this.clock);
    }

    logLeaseEvent(event) {
        const label = event.lease.clientLabel;
        const at = '+' + this.model.dhcpFormatDuration(event.at);
        const server = '192.168.10.1';
        if (event.type === 'T1') {
            this.addLog(`${at} - T1 (50 %) : ${label} envoie un DHCPREQUEST en unicast à ${server}.`, 'warn');
        } else if (event.type === 'T2') {
            this.addLog(`${at} - T2 (87,5 %) : toujours sans réponse, ${label} diffuse un DHCPREQUEST en broadcast.`, 'warn');
        } else if (event.type === 'RENEWED') {
            this.addLog(`${at} - DHCPACK : le bail de ${label} repart pour 8 h, T1 et T2 sont recalculés.`, 'ok');
        } else if (event.type === 'EXPIRED') {
            this.addLog(`${at} - Fin du bail : ${label} abandonne ${event.detail} et s'auto-attribue une adresse APIPA.`, 'bad');
        }
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
        this.clock = 0;
        this.logOutput.innerHTML = '';

        this.highlightNodes([]);
        this.hidePacket();

        const client = this.getSelectedClient();
        this.clientLabel.textContent = client ? `${client.label} / ${client.mac}` : '-';
        this.currentIpOutput.textContent = '-';

        this.setFeedback('Réseau réinitialisé. Aucun bail actif.', 'info');
        this.renderAll();
    }
}

if (typeof window !== 'undefined') {
    window.DhcpPage = DhcpPage;
}
