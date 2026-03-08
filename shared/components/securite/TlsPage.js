class TlsPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.state = null;
        this.autoTimer = null;
        this.autoDelay = 700;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector({
            lineIdBuilder: (block, idx) => `${block.name}-line${idx}`
        });
        this.bindControls();
        this.reset();
    }

    bindControls() {
        document.getElementById('tls-step').addEventListener('click', () => this.step());
        document.getElementById('tls-run').addEventListener('click', () => this.toggleRun());
        document.getElementById('tls-reset').addEventListener('click', () => this.reset());
        document.getElementById('tls-tamper').addEventListener('change', () => this.reset());
        document.getElementById('tls-random').addEventListener('click', () => this.randomizeSecrets());
    }

    modPow(base, exp, mod) {
        let b = base % mod;
        let e = exp;
        let result = 1;
        while (e > 0) {
            if (e & 1) result = (result * b) % mod;
            b = (b * b) % mod;
            e >>= 1;
        }
        return result;
    }

    deriveKey(secret) {
        const v = (secret * 1103515245 + 12345) >>> 0;
        return v.toString(16).padStart(8, '0');
    }

    randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    randomizeSecrets() {
        this.state.clientPriv = this.randomInt(2, 10);
        this.state.serverPriv = this.randomInt(2, 10);
        this.state.clientPub = this.modPow(this.state.g, this.state.clientPriv, this.state.p);
        this.state.serverPub = this.modPow(this.state.g, this.state.serverPriv, this.state.p);
        this.state.sharedClient = null;
        this.state.sharedServer = null;
        this.state.sessionKey = null;
        this.state.step = 0;
        this.state.aborted = false;
        this.state.done = false;
        this.state.logs = [];
        this.addLog('Secrets régénérés.');
        this.render();
    }

    reset() {
        this.stopAuto();
        this.state = {
            p: 23,
            g: 5,
            clientPriv: this.randomInt(2, 10),
            serverPriv: this.randomInt(2, 10),
            clientPub: null,
            serverPub: null,
            sharedClient: null,
            sharedServer: null,
            sessionKey: null,
            step: 0,
            done: false,
            aborted: false,
            logs: []
        };
        this.state.clientPub = this.modPow(this.state.g, this.state.clientPriv, this.state.p);
        this.state.serverPub = this.modPow(this.state.g, this.state.serverPriv, this.state.p);
        this.addLog('Nouveau handshake prêt.');
        this.render();
    }

    addLog(msg) {
        this.state.logs.unshift(msg);
        this.state.logs = this.state.logs.slice(0, 12);
    }

    step() {
        if (this.state.done || this.state.aborted) return;
        const tampered = document.getElementById('tls-tamper').checked;

        switch (this.state.step) {
            case 0:
                this.addLog(`1) ClientHello envoyé (A=${this.state.clientPub}).`);
                break;
            case 1:
                this.addLog(`2) ServerHello + Certificate (B=${this.state.serverPub}).`);
                break;
            case 2:
                if (tampered) {
                    this.state.aborted = true;
                    this.addLog('3) Certificat invalide: handshake interrompu.');
                    this.stopAuto();
                    this.render();
                    return;
                }
                this.state.sharedClient = this.modPow(this.state.serverPub, this.state.clientPriv, this.state.p);
                this.addLog(`3) Client valide le certificat et calcule le secret partagé (${this.state.sharedClient}).`);
                break;
            case 3:
                this.state.sharedServer = this.modPow(this.state.clientPub, this.state.serverPriv, this.state.p);
                this.addLog(`4) Serveur calcule le secret partagé (${this.state.sharedServer}) et envoie Finished.`);
                break;
            case 4:
                if (this.state.sharedClient === this.state.sharedServer) {
                    this.state.sessionKey = this.deriveKey(this.state.sharedClient);
                    this.state.done = true;
                    this.addLog(`5) Client Finished. Session sécurisée (key=${this.state.sessionKey}).`);
                } else {
                    this.state.aborted = true;
                    this.addLog('5) Secrets divergents: handshake annulé.');
                }
                this.stopAuto();
                break;
            default:
                break;
        }

        this.state.step += 1;
        this.render();
    }

    toggleRun() {
        const btn = document.getElementById('tls-run');
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }
        btn.textContent = 'Pause';
        this.autoTimer = setInterval(() => {
            if (this.state.done || this.state.aborted) {
                this.stopAuto();
                return;
            }
            this.step();
        }, this.autoDelay);
    }

    stopAuto() {
        if (this.autoTimer) {
            clearInterval(this.autoTimer);
            this.autoTimer = null;
        }
        const btn = document.getElementById('tls-run');
        if (btn) btn.textContent = 'Lecture auto';
    }

    renderTimeline() {
        const steps = [
            'ClientHello',
            'ServerHello + Certificate',
            'Certificate Verify (client)',
            'Finished (server)',
            'Finished (client)'
        ];

        const container = document.getElementById('tls-timeline');
        container.innerHTML = steps.map((label, idx) => {
            let cls = 'tl-step';
            if (idx < this.state.step) cls += ' done';
            if (idx === this.state.step && !this.state.done && !this.state.aborted) cls += ' current';
            if (this.state.aborted && idx >= 2) cls += ' aborted';
            return `<div class="${cls}"><span class="idx">${idx + 1}</span><span>${this.escapeHtml(label)}</span></div>`;
        }).join('');
    }

    render() {
        this.renderTimeline();
        document.getElementById('tls-p').textContent = String(this.state.p);
        document.getElementById('tls-g').textContent = String(this.state.g);
        document.getElementById('tls-a').textContent = String(this.state.clientPriv);
        document.getElementById('tls-b').textContent = String(this.state.serverPriv);
        document.getElementById('tls-A').textContent = String(this.state.clientPub);
        document.getElementById('tls-B').textContent = String(this.state.serverPub);
        document.getElementById('tls-sc').textContent = this.state.sharedClient == null ? '-' : String(this.state.sharedClient);
        document.getElementById('tls-ss').textContent = this.state.sharedServer == null ? '-' : String(this.state.sharedServer);
        document.getElementById('tls-key').textContent = this.state.sessionKey || '-';

        const status = document.getElementById('tls-status');
        if (this.state.aborted) {
            status.className = 'status status-bad';
            status.textContent = 'Handshake échoué';
        } else if (this.state.done) {
            status.className = 'status status-ok';
            status.textContent = 'Canal TLS établi';
        } else {
            status.className = 'status status-pending';
            status.textContent = 'Handshake en cours';
        }

        const ul = document.getElementById('tls-log');
        ul.innerHTML = this.state.logs.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    }
}

if (typeof window !== 'undefined') {
    window.TlsPage = TlsPage;
}
