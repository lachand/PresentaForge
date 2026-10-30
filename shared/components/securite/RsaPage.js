/**
 * RsaPage : tout le calcul (primalité, inverse modulaire, puissance modulaire en BigInt) est dans le
 * moteur pur `algorithms/rsa-engine.js` (relecture 3b, B5, RS-I1, RS-I3) ; ici, seulement l'affichage.
 */
class RsaPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector({
            lineIdBuilder: (block, idx) => `${block.name}-line${idx}`
        });
        this.cacheDom();
        this.bindEvents();
        this.setValues(61, 53, 17, 65);
        this.computeAll();
    }

    cacheDom() {
        this.inputs = {
            p: document.getElementById('rsa-p'),
            q: document.getElementById('rsa-q'),
            e: document.getElementById('rsa-e'),
            m: document.getElementById('rsa-m')
        };
        this.statusEl = document.getElementById('rsa-status');
        this.nEl = document.getElementById('rsa-n');
        this.phiEl = document.getElementById('rsa-phi');
        this.dEl = document.getElementById('rsa-d');
        this.cipherEl = document.getElementById('rsa-cipher');
        this.plainEl = document.getElementById('rsa-plain');
        this.sigEl = document.getElementById('rsa-signature');
        this.verifyEl = document.getElementById('rsa-verify');
        this.pipelineEl = document.getElementById('rsa-pipeline');
        this.euclidEl = document.getElementById('rsa-euclid');
    }

    bindEvents() {
        ['input', 'change'].forEach((evt) => {
            Object.values(this.inputs).forEach((el) => el.addEventListener(evt, () => this.computeAll()));
        });
        document.getElementById('rsa-random').addEventListener('click', () => {
            this.randomExample();
            this.computeAll();
        });
        document.getElementById('rsa-course').addEventListener('click', () => {
            this.setValues(61, 53, 17, 65);
            this.computeAll();
        });
    }

    setValues(p, q, e, m) {
        this.inputs.p.value = String(p);
        this.inputs.q.value = String(q);
        this.inputs.e.value = String(e);
        this.inputs.m.value = String(m);
    }

    randomExample() {
        const p = OEITrace.rsaRandomPrime(50, 1000);
        let q = OEITrace.rsaRandomPrime(50, 1000);
        while (q === p) q = OEITrace.rsaRandomPrime(50, 1000);
        const phi = (p - 1) * (q - 1);
        const e = OEITrace.rsaPickE(phi) || 3;
        const m = 2 + Math.floor(Math.random() * (p * q - 3));
        this.setValues(p, q, e, m);
    }

    setStatus(text, type) {
        this.statusEl.className = `status ${type}`;
        this.statusEl.textContent = text;
    }

    renderPipeline(steps, mode) {
        this.pipelineEl.innerHTML = '';
        steps.forEach((step, index) => {
            const box = document.createElement('div');
            box.className = 'rsa-step' + (mode === 'ok' ? ' ok' : mode === 'bad' && index === steps.length - 1 ? ' bad' : ' active');
            const t = document.createElement('div');
            t.className = 't';
            t.textContent = step.title;
            const v = document.createElement('div');
            v.className = 'v';
            v.textContent = step.value;
            box.append(t, v);
            this.pipelineEl.appendChild(box);
        });
    }

    renderEuclid(euclid, e, phi, d) {
        this.euclidEl.innerHTML = '';
        if (!euclid) return;
        const lines = euclid.rows.map((row, i) => {
            if (i === 0) return 'r = ' + row.r + ' (phi), t = ' + row.t;
            if (i === 1) return 'r = ' + row.r + ' (e), t = ' + row.t;
            return row.r === 0
                ? 'r = 0 : on s\'arrête (q = ' + row.q + ')'
                : 'r = ' + row.r + ' (q = ' + row.q + '), t = ' + row.t;
        });
        const pre = document.createElement('pre');
        pre.textContent = lines.join('\n') + (d !== null ? '\n\nd = t(r = 1) mod phi = ' + d + '   (vérification : ' + e + ' × ' + d + ' mod ' + phi + ' = ' + (BigInt(e) * BigInt(d) % BigInt(phi)) + ')' : '');
        this.euclidEl.appendChild(pre);
    }

    clearResults() {
        [this.nEl, this.phiEl, this.dEl, this.cipherEl, this.plainEl, this.sigEl, this.verifyEl].forEach((el) => { el.textContent = '-'; });
        this.euclidEl.innerHTML = '';
    }

    computeAll() {
        const read = (el) => (el.value.trim() === '' ? NaN : Number(el.value));
        const input = { p: read(this.inputs.p), q: read(this.inputs.q), e: read(this.inputs.e), m: read(this.inputs.m) };
        Object.values(this.inputs).forEach((el) => el.removeAttribute('aria-invalid'));
        const r = OEITrace.rsaCompute(input);
        if (!r.ok) {
            this.clearResults();
            if (r.n) this.nEl.textContent = String(r.n);
            if (r.phi) this.phiEl.textContent = String(r.phi);
            this.inputs[r.field].setAttribute('aria-invalid', 'true');
            this.setStatus(r.error, 'status-bad');
            this.renderPipeline([{ title: 'Validation', value: r.error }], 'bad');
            return;
        }
        this.nEl.textContent = String(r.n);
        this.phiEl.textContent = String(r.phi);
        this.dEl.textContent = String(r.d);
        this.cipherEl.textContent = String(r.c);
        this.plainEl.textContent = String(r.decrypted);
        this.sigEl.textContent = String(r.signature);
        this.verifyEl.textContent = String(r.verified);
        this.renderEuclid(r.euclid, input.e, r.phi, r.d);
        this.setStatus('Paramètres valides : p et q sont premiers, l\'aller-retour redonne m.', 'status-ok');
        this.renderPipeline([
            { title: '1) Clés', value: `n = ${r.n}, phi = ${r.phi}, d = ${r.d}` },
            { title: '2) Chiffrement', value: `c = ${r.c}` },
            { title: '3) Déchiffrement', value: `m = ${r.decrypted}` },
            { title: '4) Signature brute', value: `s = ${r.signature}` },
            { title: '5) Vérification', value: `m = ${r.verified}` }
        ], 'ok');
    }
}

if (typeof window !== 'undefined') {
    window.RsaPage = RsaPage;
}
