/**
 * HashingPage : empreintes SHA (crypto.subtle), effet avalanche mesuré par le module pur
 * `algorithms/hash-metrics.js` (relecture 3b, B8, HA-I1, HA-I3), sel, PBKDF2 et HMAC.
 * crypto.subtle n'existe que dans un contexte sécurisé (HTTPS, localhost) : sans lui, la page affiche
 * un message au lieu de planter.
 */
class HashingPage extends ConceptPage {
    static ALGO_BITS = { 'SHA-1': 160, 'SHA-256': 256, 'SHA-512': 512 };
    static ALGO_HEX = { 'SHA-1': 40, 'SHA-256': 64, 'SHA-512': 128 };

    async init() {
        await super.init();
        this.algo = { compute: 'SHA-256', avalanche: 'SHA-256', integrity: 'SHA-256' };
        this.hasSubtle = !!(window.crypto && window.crypto.subtle);
        this.$ = (id) => document.getElementById(id);
        this.bindTabs();
        if (!this.hasSubtle) {
            const warn = this.$('subtle-warning');
            warn.style.display = '';
            warn.textContent = 'Cette page a besoin de crypto.subtle, disponible seulement en HTTPS ou sur localhost. Ouvre-la depuis un serveur local ou en HTTPS pour calculer des empreintes.';
            return;
        }
        this.bindCompute();
        this.bindAvalanche();
        this.bindIntegrity();
        this.bindPassword();
        this.updateCompute();
        this.updateAvalanche();
        this.updateIntegrity();
        this.createAccounts();
        this.updateHmac();
    }

    // --- Utilitaires ---
    async digest(text, algo) {
        const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
        return HashingPage.toHex(new Uint8Array(buf));
    }

    static toHex(bytes) {
        return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    static randomHex(nBytes) {
        return HashingPage.toHex(crypto.getRandomValues(new Uint8Array(nBytes)));
    }

    async hmac(key, message) {
        const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
        return HashingPage.toHex(new Uint8Array(sig));
    }

    async pbkdf2(password, saltHex, iterations) {
        const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const salt = new TextEncoder().encode(saltHex);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' }, k, 256);
        return HashingPage.toHex(new Uint8Array(bits));
    }

    setupAlgoSelector(containerId, key, callback) {
        const container = this.$(containerId);
        container.querySelectorAll('.algo-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.algo-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.algo[key] = btn.dataset.algo;
                callback();
            });
        });
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
                this.$('panel-' + btn.dataset.tab).classList.add('active');
            });
        });
    }

    // --- Calcul ---
    bindCompute() {
        this.$('compute-input').addEventListener('input', () => this.updateCompute());
        this.setupAlgoSelector('compute-algo', 'compute', () => this.updateCompute());
        this.$('compute-copy').addEventListener('click', async () => {
            const btn = this.$('compute-copy');
            const text = this.$('compute-output').querySelector('.hash-text').textContent;
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = 'Copié !';
            } catch (err) {
                btn.textContent = 'Copie impossible ici';
            }
            setTimeout(() => { btn.textContent = 'Copier'; }, 1500);
        });
    }

    async updateCompute() {
        const algo = this.algo.compute;
        const t0 = performance.now();
        const hash = await this.digest(this.$('compute-input').value, algo);
        const t1 = performance.now();
        this.$('compute-output').querySelector('.hash-text').textContent = hash;
        this.$('stat-algo').textContent = algo;
        this.$('stat-bits').textContent = HashingPage.ALGO_BITS[algo];
        this.$('stat-hex').textContent = HashingPage.ALGO_HEX[algo];
        this.$('stat-time').textContent = (t1 - t0).toFixed(2);
        this.$('sha1-warning').style.display = algo === 'SHA-1' ? '' : 'none';
    }

    // --- Avalanche ---
    bindAvalanche() {
        this.$('ava-input-a').addEventListener('input', () => this.updateAvalanche());
        this.$('ava-input-b').addEventListener('input', () => this.updateAvalanche());
        this.setupAlgoSelector('avalanche-algo', 'avalanche', () => this.updateAvalanche());
        this.$('ava-trials').addEventListener('click', () => this.runTrials());
    }

    async updateAvalanche() {
        const algo = this.algo.avalanche;
        const hashA = await this.digest(this.$('ava-input-a').value, algo);
        const hashB = await this.digest(this.$('ava-input-b').value, algo);
        this.$('ava-hash-a').querySelector('.hash-text').textContent = hashA;
        this.$('ava-hash-b').querySelector('.hash-text').textContent = hashB;

        const { diff, total, pct } = OEITrace.hashBitDiff(hashA, hashB);
        const verdict = OEITrace.hashAvalancheVerdict(pct);
        this.$('ava-diff-bits').textContent = diff;
        this.$('ava-diff-pct').textContent = pct.toFixed(1) + ' %';
        this.$('ava-total-bits').textContent = total;
        const fill = this.$('ava-bar-fill');
        fill.style.width = pct + '%';
        fill.textContent = pct.toFixed(1) + ' %';
        fill.className = 'fill ava-zone-' + verdict.zone;
        this.$('ava-verdict').textContent = verdict.label;
        this.$('ava-verdict').className = 'ava-verdict ava-zone-text-' + verdict.zone;

        const diffRow = (src, other) => {
            const row = document.createElement('div');
            for (let i = 0; i < src.length; i += 1) {
                const span = document.createElement('span');
                span.className = src[i] === other[i] ? 'same' : 'diff';
                span.textContent = src[i];
                row.appendChild(span);
            }
            return row;
        };
        const box = this.$('ava-hex-diff');
        box.innerHTML = '';
        box.append(diffRow(hashA, hashB), diffRow(hashB, hashA));
    }

    async runTrials() {
        const algo = this.algo.avalanche;
        const out = this.$('ava-trials-out');
        out.textContent = 'Calcul en cours...';
        let seed = 12345;
        const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed; };
        const diffs = [];
        for (let k = 0; k < 1000; k += 1) {
            let text = '';
            for (let j = 0; j < 24; j += 1) text += String.fromCharCode(33 + (rnd() % 94));
            const flipped = OEITrace.hashFlipChar(text, rnd());
            const [a, b] = await Promise.all([this.digest(text, algo), this.digest(flipped, algo)]);
            diffs.push(OEITrace.hashBitDiff(a, b).pct);
        }
        out.textContent = '1 000 essais, un seul caractère modifié à chaque fois, ' + algo + ' : en moyenne ' + OEITrace.hashMean(diffs).toFixed(1) + ' % des bits de l\'empreinte changent (min ' + Math.min(...diffs).toFixed(1) + ' %, max ' + Math.max(...diffs).toFixed(1) + ' %).';
    }

    // --- Intégrité ---
    bindIntegrity() {
        this.$('integ-gen-btn').addEventListener('click', async () => {
            const hash = await this.digest(this.$('integ-original').value, this.algo.integrity);
            this.$('integ-expected').value = hash;
            this.$('integ-verify').value = this.$('integ-original').value;
            this.updateIntegrity();
        });
        ['integ-original', 'integ-verify', 'integ-expected'].forEach((id) => this.$(id).addEventListener('input', () => this.updateIntegrity()));
        this.setupAlgoSelector('integrity-algo', 'integrity', () => this.updateIntegrity());
    }

    async updateIntegrity() {
        const hash = await this.digest(this.$('integ-verify').value, this.algo.integrity);
        this.$('integ-computed').querySelector('.hash-text').textContent = hash;
        const expected = this.$('integ-expected').value.trim().toLowerCase();
        const status = this.$('integ-status');
        status.innerHTML = '';
        const msg = document.createElement('span');
        let iconName = null;
        if (!expected) {
            status.className = 'integrity-status pending';
            msg.textContent = 'Colle ou génère un hash attendu pour vérifier l\'intégrité.';
        } else if (hash === expected) {
            status.className = 'integrity-status valid';
            iconName = 'check';
            msg.textContent = 'Intégrité vérifiée : le hash correspond. Cela prouve que le texte n\'a pas changé depuis le calcul du hash, pas qui l\'a écrit.';
        } else {
            status.className = 'integrity-status invalid';
            iconName = 'ban';
            msg.textContent = 'Intégrité compromise : le hash ne correspond pas.';
        }
        if (iconName) {
            const icon = document.createElement('span');
            icon.className = 'integrity-icon';
            icon.innerHTML = OEIIcons.render(iconName);
            status.appendChild(icon);
        }
        status.appendChild(msg);
    }

    // --- Mot de passe, PBKDF2, HMAC ---
    bindPassword() {
        this.$('pw-create').addEventListener('click', () => this.createAccounts());
        this.$('pw-salt').addEventListener('change', () => this.createAccounts());
        this.$('pw-input').addEventListener('input', () => this.createAccounts());
        this.$('pw-bench').addEventListener('click', () => this.benchmark());
        ['hmac-message', 'hmac-key', 'hmac-forged'].forEach((id) => this.$(id).addEventListener('input', () => this.updateHmac()));
    }

    async createAccounts() {
        const salted = this.$('pw-salt').checked;
        const password = this.$('pw-input').value;
        const body = this.$('pw-table').querySelector('tbody');
        body.innerHTML = '';
        const rows = [];
        for (const name of ['alice', 'bob']) {
            const salt = salted ? HashingPage.randomHex(8) : '';
            const hash = await this.digest(salt + password, 'SHA-256');
            rows.push({ name: name, salt: salt, hash: hash });
            const tr = document.createElement('tr');
            [name, salt || '(aucun)', hash].forEach((t, i) => {
                const td = document.createElement('td');
                td.textContent = t;
                if (i === 2) td.className = 'u-mono-wrap';
                tr.appendChild(td);
            });
            body.appendChild(tr);
        }
        const same = rows[0].hash === rows[1].hash;
        this.$('pw-verdict').textContent = same
            ? 'Les deux empreintes sont identiques : celui qui lit la base voit que alice et bob ont le même mot de passe, et une seule table pré-calculée casse tous les comptes.'
            : 'Les empreintes diffèrent bien que le mot de passe soit le même : chaque compte demande son propre calcul, et une table pré-calculée ne sert plus.';
    }

    async benchmark() {
        const out = this.$('pw-bench-out');
        const iterations = parseInt(this.$('pw-iterations').value, 10);
        out.textContent = 'Mesure en cours (environ une seconde)...';
        const rate = async (fn) => {
            let count = 0;
            const t0 = performance.now();
            while (performance.now() - t0 < 500) { await fn(); count += 1; }
            return count / ((performance.now() - t0) / 1000);
        };
        const password = this.$('pw-input').value || 'azerty123';
        const plain = await rate(() => this.digest(password, 'SHA-256'));
        const slow = await rate(() => this.pbkdf2(password, 'sel-fixe', iterations));
        const fmt = (x) => Math.round(x).toLocaleString('fr-FR');
        out.textContent = 'Sur ta machine : SHA-256 simple, environ ' + fmt(plain) + ' essais par seconde ; PBKDF2-SHA-256 avec ' + iterations.toLocaleString('fr-FR') + ' itérations, environ ' + fmt(slow) + ' essais par seconde, soit ' + fmt(plain / slow) + ' fois moins. Un attaquant équipé de cartes graphiques fait beaucoup plus : le coût de dérivation sert à le ralentir dans la même proportion.';
    }

    async updateHmac() {
        const message = this.$('hmac-message').value;
        const key = this.$('hmac-key').value;
        const forged = this.$('hmac-forged').value;
        const [plain, tag, forgedPlain, forgedTag] = await Promise.all([
            this.digest(message, 'SHA-256'),
            this.hmac(key, message),
            this.digest(forged, 'SHA-256'),
            this.hmac('clé devinée par l\'attaquant', forged)
        ]);
        const set = (id, v) => { this.$(id).textContent = v; };
        set('hmac-plain', plain);
        set('hmac-tag', tag);
        set('hmac-forged-plain', forgedPlain);
        set('hmac-forged-tag', forgedTag);
        this.$('hmac-verdict').textContent = 'L\'attaquant peut recalculer SHA-256 du message modifié : un hash public ne prouve pas l\'origine. Il ne peut pas produire le HMAC attendu sans la clé : le HMAC de sa version ' + (forgedTag === tag ? 'est identique (message inchangé)' : 'diffère de celui du destinataire') + '.';
    }
}

if (typeof window !== 'undefined') {
    window.HashingPage = HashingPage;
}
