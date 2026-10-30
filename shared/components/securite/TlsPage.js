/**
 * TlsPage : handshake TLS 1.3 simplifié. L'ordre des messages, le Diffie-Hellman jouet, la validation du
 * certificat et l'attaquant au milieu viennent du modèle pur `algorithms/tls-handshake-model.js`
 * (relecture 3b, B9, TL-I1, TL-I2) ; ici, seulement l'affichage.
 */
class TlsPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.state = null;
        this.autoTimer = null;
        this.autoDelay = 800;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector({ lineIdBuilder: (block, idx) => `${block.name}-line${idx}` });
        this.$ = (id) => document.getElementById(id);
        this.bindControls();
        this.reset();
    }

    bindControls() {
        this.$('tls-step').addEventListener('click', () => this.step());
        this.$('tls-run').addEventListener('click', () => this.toggleRun());
        this.$('tls-reset').addEventListener('click', () => this.reset());
        ['tls-validate', 'tls-mitm', 'tls-cert'].forEach((id) => this.$(id).addEventListener('change', () => this.reset()));
        this.$('tls-random').addEventListener('click', () => this.reset(true));
    }

    randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    reset(randomize) {
        this.stopAuto();
        const mitm = this.$('tls-mitm').checked;
        this.$('tls-cert').disabled = mitm;
        const secrets = randomize || !this.secrets
            ? { clientPriv: this.randomInt(2, 20), serverPriv: this.randomInt(2, 20), attackerPriv1: this.randomInt(2, 20), attackerPriv2: this.randomInt(2, 20) }
            : this.secrets;
        this.secrets = secrets;
        this.state = OEITrace.tlsNew(Object.assign({}, secrets, { validate: this.$('tls-validate').checked, mitm: mitm, cert: this.$('tls-cert').value }));
        this.state.logs.unshift('Handshake prêt : ' + (mitm ? 'un attaquant M est placé entre le client et le serveur.' : 'client et serveur communiquent directement.'));
        this.render();
    }

    step() {
        if (this.state.done || this.state.aborted) return;
        OEITrace.tlsStep(this.state);
        if (this.state.done || this.state.aborted) this.stopAuto();
        this.render();
    }

    toggleRun() {
        if (this.autoTimer) { this.stopAuto(); return; }
        this.$('tls-run').textContent = 'Pause';
        this.autoTimer = setInterval(() => {
            if (this.state.done || this.state.aborted) { this.stopAuto(); return; }
            this.step();
        }, this.autoDelay);
    }

    stopAuto() {
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        const btn = this.$('tls-run');
        if (btn) btn.textContent = 'Lecture auto';
    }

    renderTimeline() {
        const s = this.state;
        const container = this.$('tls-timeline');
        container.innerHTML = '';
        OEITrace.TLS_MESSAGES.forEach((m, idx) => {
            const row = document.createElement('div');
            let cls = 'tl-step';
            if (idx < s.step) cls += ' done';
            else if (s.aborted) cls += ' aborted';
            else if (idx === s.step && !s.done) cls += ' current';
            row.className = cls;
            const n = document.createElement('span');
            n.className = 'idx';
            n.textContent = idx + 1;
            const label = document.createElement('span');
            label.textContent = m.id + ' (' + m.from + ' vers ' + m.to + (m.encrypted ? ', chiffré' : '') + ')';
            label.title = m.note;
            row.append(n, label);
            container.appendChild(row);
        });
    }

    renderChecks() {
        const box = this.$('tls-checks');
        box.innerHTML = '';
        const s = this.state;
        if (!s.checks) {
            box.textContent = 'Le certificat n\'est pas encore arrivé (message 3).';
            return;
        }
        const ul = document.createElement('ul');
        s.checks.forEach((c) => {
            const li = document.createElement('li');
            li.textContent = (c.ok ? 'Réussi : ' : 'Échec : ') + c.label + (s.validate ? '' : ' (non contrôlé par ce client)');
            ul.appendChild(li);
        });
        box.appendChild(ul);
    }

    render() {
        const s = this.state;
        this.renderTimeline();
        this.renderChecks();
        const set = (id, v) => { this.$(id).textContent = v == null ? '-' : String(v); };
        set('tls-p', s.p);
        set('tls-g', s.g);
        set('tls-a', s.clientPriv);
        set('tls-b', s.serverPriv);
        set('tls-A', s.clientShare);
        set('tls-B', s.serverShare);
        set('tls-sc', s.clientSecret);
        set('tls-ss', s.serverSecret);
        set('tls-key', s.clientKey && s.serverKey ? (s.clientKey === s.serverKey ? s.clientKey : 'client ' + s.clientKey + ' / serveur ' + s.serverKey) : null);
        const mitmBox = this.$('tls-mitm-box');
        mitmBox.style.display = s.mitm ? '' : 'none';
        set('tls-m1', s.attackerShareToClient);
        set('tls-m2', s.attackerShareToServer);
        set('tls-msc', s.attackerSecretClient);
        set('tls-mss', s.attackerSecretServer);

        const status = this.$('tls-status');
        if (s.aborted) {
            status.className = 'status status-bad';
            status.textContent = 'Handshake interrompu : certificat refusé';
        } else if (s.done && s.compromised) {
            status.className = 'status status-bad';
            status.textContent = 'Canal établi, mais l\'attaquant lit tout';
        } else if (s.done) {
            status.className = 'status status-ok';
            status.textContent = 'Canal TLS établi';
        } else {
            status.className = 'status status-pending';
            status.textContent = 'Handshake en cours';
        }
        const ul = this.$('tls-log');
        ul.innerHTML = '';
        s.logs.forEach((line) => {
            const li = document.createElement('li');
            li.textContent = line;
            ul.appendChild(li);
        });
    }
}

if (typeof window !== 'undefined') {
    window.TlsPage = TlsPage;
}
