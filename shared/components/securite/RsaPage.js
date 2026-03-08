class RsaPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector({
            lineIdBuilder: (block, idx) => `${block.name}-line${idx}`
        });
        this.cacheDom();
        this.bindEvents();
        this.randomExample();
        this.computeAll();
    }

    cacheDom() {
        this.pInput = document.getElementById('rsa-p');
        this.qInput = document.getElementById('rsa-q');
        this.eInput = document.getElementById('rsa-e');
        this.mInput = document.getElementById('rsa-m');
        this.statusEl = document.getElementById('rsa-status');

        this.nEl = document.getElementById('rsa-n');
        this.phiEl = document.getElementById('rsa-phi');
        this.dEl = document.getElementById('rsa-d');
        this.cipherEl = document.getElementById('rsa-cipher');
        this.plainEl = document.getElementById('rsa-plain');
        this.sigEl = document.getElementById('rsa-signature');
        this.verifyEl = document.getElementById('rsa-verify');
        this.pipelineEl = document.getElementById('rsa-pipeline');
    }

    bindEvents() {
        ['input', 'change'].forEach((evt) => {
            this.pInput.addEventListener(evt, () => this.computeAll());
            this.qInput.addEventListener(evt, () => this.computeAll());
            this.eInput.addEventListener(evt, () => this.computeAll());
            this.mInput.addEventListener(evt, () => this.computeAll());
        });

        document.getElementById('rsa-random').addEventListener('click', () => {
            this.randomExample();
            this.computeAll();
        });
    }

    randomExample() {
        const pick = () => this.primes[Math.floor(Math.random() * this.primes.length)];
        let p = pick();
        let q = pick();
        while (q === p) q = pick();

        const phi = (p - 1) * (q - 1);
        const eCandidates = [3, 5, 7, 11, 17, 19, 23];
        let e = eCandidates.find((x) => x < phi && this.gcd(x, phi) === 1) || 3;
        const n = p * q;
        const m = 2 + Math.floor(Math.random() * Math.max(2, n - 2));

        this.pInput.value = String(p);
        this.qInput.value = String(q);
        this.eInput.value = String(e);
        this.mInput.value = String(m);
    }

    gcd(a, b) {
        let x = Math.abs(a);
        let y = Math.abs(b);
        while (y !== 0) {
            const t = x % y;
            x = y;
            y = t;
        }
        return x;
    }

    egcd(a, b) {
        if (b === 0) return { g: a, x: 1, y: 0 };
        const r = this.egcd(b, a % b);
        return { g: r.g, x: r.y, y: r.x - Math.floor(a / b) * r.y };
    }

    modInverse(e, phi) {
        const r = this.egcd(e, phi);
        if (r.g !== 1) return null;
        return ((r.x % phi) + phi) % phi;
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

    setStatus(text, type) {
        this.statusEl.className = `status ${type}`;
        this.statusEl.textContent = text;
    }

    renderPipeline(steps, mode) {
        if (!this.pipelineEl) return;
        this.pipelineEl.innerHTML = steps.map((step, index) => {
            let cls = 'rsa-step';
            if (mode === 'ok') {
                cls += ' ok';
            } else if (mode === 'bad' && index === steps.length - 1) {
                cls += ' bad';
            } else {
                cls += ' active';
            }
            return `
                <div class="${cls}">
                    <div class="t">${step.title}</div>
                    <div class="v">${step.value}</div>
                </div>
            `;
        }).join('');
    }

    computeAll() {
        const p = parseInt(this.pInput.value, 10);
        const q = parseInt(this.qInput.value, 10);
        const e = parseInt(this.eInput.value, 10);
        const m = parseInt(this.mInput.value, 10);

        if (!Number.isFinite(p) || !Number.isFinite(q) || !Number.isFinite(e) || !Number.isFinite(m)) {
            this.setStatus('Entrées invalides.', 'status-bad');
            this.renderPipeline([{ title: 'Validation', value: 'Entrées invalides' }], 'bad');
            return;
        }

        const n = p * q;
        const phi = (p - 1) * (q - 1);
        this.nEl.textContent = String(n);
        this.phiEl.textContent = String(phi);

        if (p === q) {
            this.setStatus('Choisir p et q distincts.', 'status-bad');
            this.renderPipeline([{ title: 'Validation', value: 'p et q doivent être distincts' }], 'bad');
            return;
        }

        if (m <= 0 || m >= n) {
            this.setStatus(`Le message m doit vérifier 0 < m < n (n=${n}).`, 'status-bad');
            this.renderPipeline([{ title: 'Validation', value: `Message hors borne (0 < m < ${n})` }], 'bad');
            return;
        }

        if (e <= 1 || e >= phi || this.gcd(e, phi) !== 1) {
            this.setStatus(`e doit être copremier avec phi=${phi} et 1 < e < phi.`, 'status-bad');
            this.renderPipeline([{ title: 'Validation', value: `e invalide pour phi=${phi}` }], 'bad');
            return;
        }

        const d = this.modInverse(e, phi);
        if (d == null) {
            this.setStatus('Impossible de calculer d (inverse modulaire).', 'status-bad');
            this.renderPipeline([{ title: 'Inverse modulaire', value: 'Aucun d valide trouvé' }], 'bad');
            return;
        }

        const c = this.modPow(m, e, n);
        const m2 = this.modPow(c, d, n);
        const sig = this.modPow(m, d, n);
        const ver = this.modPow(sig, e, n);

        this.dEl.textContent = String(d);
        this.cipherEl.textContent = String(c);
        this.plainEl.textContent = String(m2);
        this.sigEl.textContent = String(sig);
        this.verifyEl.textContent = String(ver);

        if (ver === m && m2 === m) {
            this.setStatus('Clés valides: chiffrement/déchiffrement et signature OK.', 'status-ok');
            this.renderPipeline([
                { title: '1) KeyGen', value: `n=${n}, phi=${phi}, d=${d}` },
                { title: '2) Chiffrement', value: `c = ${c}` },
                { title: '3) Déchiffrement', value: `m' = ${m2}` },
                { title: '4) Signature', value: `s = ${sig}` },
                { title: '5) Vérification', value: `m'' = ${ver}` }
            ], 'ok');
        } else {
            this.setStatus('Calcul terminé avec incohérence: vérifier les paramètres.', 'status-bad');
            this.renderPipeline([
                { title: '1) KeyGen', value: `n=${n}, phi=${phi}, d=${d}` },
                { title: '2) Chiffrement', value: `c = ${c}` },
                { title: '3) Déchiffrement', value: `m' = ${m2}` },
                { title: '4) Signature', value: `s = ${sig}` },
                { title: '5) Vérification', value: `m'' = ${ver} (incohérent)` }
            ], 'bad');
        }
    }
}

if (typeof window !== 'undefined') {
    window.RsaPage = RsaPage;
}
