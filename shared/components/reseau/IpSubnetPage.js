class IpSubnetPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        // Fill powers of 2 table
        (function() {
            const tbody = document.getElementById('powers-tbody');
            for (let n = 0; n <= 16; n++) {
                const tr = document.createElement('tr');
                const pow = Math.pow(2, n);
                tr.innerHTML = `<td>${n}</td><td>${pow.toLocaleString('fr-FR')}</td><td>${n >= 2 ? (pow - 2).toLocaleString('fr-FR') : '-'}</td>`;
                tbody.appendChild(tr);
            }
        })();

        const Engine = window.OEITrace;
        let currentIP = null;
        let currentMask = null;

        const ipToString = (octets) => octets.join('.');
        const toBinaryStr = (num, bits) => num.toString(2).padStart(bits, '0');

        function renderBinaryRow(label, octets, cidr, isAddress) {
            const fullBin = octets.map(o => toBinaryStr(o, 8)).join('');
            let html = `<div class="binary-row"><div class="binary-label">${label}</div><div class="binary-bits">`;
            for (let i = 0; i < 32; i++) {
                if (i > 0 && i % 8 === 0) {
                    html += `<div class="bit-separator">.</div>`;
                }
                const cls = i < cidr ? 'network' : 'host';
                html += `<div class="bit ${isAddress ? cls : ''}">${fullBin[i]}</div>`;
            }
            html += `</div><div class="decimal-value">${ipToString(octets)}</div></div>`;
            return html;
        }

        function categoryBadge(category) {
            const color = category.id === 'public' ? 'var(--warning)' : category.id === 'private' ? 'var(--ok)' : 'var(--info, var(--muted))';
            return `<span class="class-badge" style="background:${color};">${category.label}</span>`;
        }

        function hostRangeText(r) {
            if (r.kind === 'single') return 'Aucune plage : une seule adresse';
            return ipToString(r.first) + ' - ' + ipToString(r.last);
        }

        function calculate() {
            const input = document.getElementById('ip-input').value;
            const r = Engine.ipSubnetAnalyze(input);
            const feedback = document.getElementById('feedback');

            if (!r) {
                feedback.textContent = 'Format attendu : 192.168.1.0/24 (adresse, barre oblique, nombre de bits réseau)';
                feedback.className = 'feedback error';
                document.getElementById('binary-card').style.display = 'none';
                document.getElementById('subnet-section').style.display = 'none';
                return;
            }

            feedback.textContent = '';
            feedback.className = 'feedback';

            const { octets, cidr } = r;
            currentIP = octets;
            currentMask = cidr;
            const hostBits = 32 - cidr;

            // Binary grid
            const grid = document.getElementById('binary-grid');
            let html = '';
            html += renderBinaryRow('Adresse IP', octets, cidr, true);
            html += renderBinaryRow('Masque', r.mask, cidr, false);
            html += renderBinaryRow('Adresse réseau', r.network, cidr, true);
            html += renderBinaryRow('Broadcast', r.broadcast, cidr, true);
            if (r.first) {
                html += renderBinaryRow('Premier hôte', r.first, cidr, true);
                html += renderBinaryRow('Dernier hôte', r.last, cidr, true);
            }
            html += renderBinaryRow('Wildcard', r.wildcard, cidr, false);
            grid.innerHTML = html;

            // Summary
            const summaryGrid = document.getElementById('summary-grid');
            summaryGrid.innerHTML = `
                <div class="summary-item">
                    <div class="label">Adresse réseau</div>
                    <div class="value">${ipToString(r.network)}/${cidr}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Broadcast</div>
                    <div class="value">${ipToString(r.broadcast)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Masque</div>
                    <div class="value">${ipToString(r.mask)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Wildcard</div>
                    <div class="value">${ipToString(r.wildcard)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Hôtes disponibles</div>
                    <div class="value">${r.hosts.toLocaleString('fr-FR')}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Bits réseau / hôte</div>
                    <div class="value">${cidr} / ${hostBits}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Nature de l'adresse</div>
                    <div class="value">${categoryBadge(r.category)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Plage d'hôtes</div>
                    <div class="value" style="font-size:0.75rem;">${hostRangeText(r)}${r.kind === 'point-to-point' ? ' (liaison point à point, RFC 3021)' : ''}</div>
                </div>
            `;

            document.getElementById('binary-card').style.display = 'block';
            document.getElementById('subnet-section').style.display = 'block';

            // Update subnet count options
            updateSubnetOptions();
        }

        function updateSubnetOptions() {
            const select = document.getElementById('subnet-count');
            select.innerHTML = '';
            const counts = Engine.ipSubnetCountOptions(currentMask);
            counts.forEach((n) => {
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                select.appendChild(opt);
            });
            const note = document.getElementById('subnet-table-wrap');
            if (!counts.length) note.innerHTML = '<p class="text-sm text-muted">Un /' + currentMask + ' ne se découpe plus en sous-réseaux d\'hôtes (le plus petit utile est un /30).</p>';
        }

        function calculateSubnets() {
            if (!currentIP || currentMask === null) return;
            const n = parseInt(document.getElementById('subnet-count').value, 10);
            const split = Engine.ipSubnetSplit({ octets: currentIP, cidr: currentMask }, n);
            if (!split) {
                document.getElementById('subnet-table-wrap').innerHTML = '<p class="feedback error">Découpage impossible pour ce masque.</p>';
                return;
            }
            const extraBits = split.cidr - currentMask;

            let html = `<table class="subnet-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Adresse réseau</th>
                        <th>Premier hôte</th>
                        <th>Dernier hôte</th>
                        <th>Broadcast</th>
                        <th>Masque</th>
                        <th>Hôtes</th>
                    </tr>
                </thead>
                <tbody>`;

            split.subnets.forEach((sn, i) => {
                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${ipToString(sn.network)}/${split.cidr}</td>
                    <td>${ipToString(sn.first)}</td>
                    <td>${ipToString(sn.last)}</td>
                    <td>${ipToString(sn.broadcast)}</td>
                    <td>${ipToString(split.mask)}</td>
                    <td>${split.hostsPerSubnet.toLocaleString('fr-FR')}</td>
                </tr>`;
            });

            html += '</tbody></table>';
            html += `<p class="text-sm text-muted mt-1">Nouveau masque : /${split.cidr} (${ipToString(split.mask)}) - ${split.hostsPerSubnet.toLocaleString('fr-FR')} hôtes par sous-réseau - ${extraBits} bits empruntés</p>`;
            document.getElementById('subnet-table-wrap').innerHTML = html;
        }

        function randomIP() {
            const classes = [
                { first: [10], mask: [8, 16, 24, 25, 26, 27, 28] },
                { first: [172], mask: [12, 16, 20, 24, 25, 26] },
                { first: [192], mask: [16, 24, 25, 26, 27, 28] }
            ];
            const cls = classes[Math.floor(Math.random() * classes.length)];
            let ip;
            const mask = cls.mask[Math.floor(Math.random() * cls.mask.length)];
            if (cls.first[0] === 10) {
                ip = `10.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`;
            } else if (cls.first[0] === 172) {
                ip = `172.${16+Math.floor(Math.random()*16)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`;
            } else {
                ip = `192.168.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*254)+1}`;
            }
            document.getElementById('ip-input').value = `${ip}/${mask}`;
            calculate();
        }

        // Initial calculation
        calculate();
        window.calculate = calculate;
        window.randomIP = randomIP;
        window.calculateSubnets = calculateSubnets;
    }
}

if (typeof window !== 'undefined') {
    window.IpSubnetPage = IpSubnetPage;
}

// ─────────────────────────────────────────────────────────────────────────────
// IpSubnetWidget - Widget autonome pour intégration dans les slides
// Usage : IpSubnetWidget.mount(container, { ip: '192.168.1.0/24' })
// ─────────────────────────────────────────────────────────────────────────────
class IpSubnetWidget {
    static mount(container, config = {}) {
        const w = new IpSubnetWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._defaultIp = config.ip || '192.168.1.0/24';
    }

    static _calc(input) {
        return window.OEITrace.ipSubnetAnalyze(input);
    }

    init() {
        this.root.innerHTML = `<div class="ipw-container">
            <div class="ipw-header">Calculateur de sous-réseau IP</div>
            <div class="ipw-input-row">
                <input class="ipw-input ipw-ip-input" type="text" placeholder="192.168.1.0/24" value="${this._defaultIp}" spellcheck="false">
                <button class="ipw-btn ipw-btn-calc">Calculer</button>
                <button class="ipw-btn ipw-btn-rand ipw-btn-secondary">Aléatoire</button>
            </div>
            <div class="ipw-error ipw-error-msg"></div>
            <div class="ipw-summary ipw-result-summary" style="display:none"></div>
            <div class="ipw-binary ipw-result-binary" style="display:none"></div>
        </div>`;
        this._bindControls();
        this._calculate();
    }

    _renderBits(octets, cidr, colorNet) {
        const full = octets.map(o => o.toString(2).padStart(8,'0')).join('');
        let html = '';
        for (let i = 0; i < 32; i++) {
            if (i > 0 && i % 8 === 0) html += `<span class="ipw-sep">.</span>`;
            const cls = !colorNet ? 'plain' : (i < cidr ? 'net' : 'host');
            html += `<span class="ipw-bit ${cls}">${full[i]}</span>`;
        }
        return `<div class="ipw-bits">${html}</div>`;
    }

    _calculate() {
        const input = this.root.querySelector('.ipw-ip-input').value;
        const errEl = this.root.querySelector('.ipw-error-msg');
        const summary = this.root.querySelector('.ipw-result-summary');
        const binary = this.root.querySelector('.ipw-result-binary');
        const r = IpSubnetWidget._calc(input);
        if (!r) {
            errEl.textContent = 'Format attendu : 192.168.1.0/24 (adresse, barre oblique, bits réseau)';
            summary.style.display = 'none';
            binary.style.display = 'none';
            return;
        }
        errEl.textContent = '';
        const s = (o) => o.join('.');
        summary.innerHTML = [
            ['Adresse réseau', `${s(r.network)}/${r.cidr}`, true],
            ['Broadcast', s(r.broadcast), false],
            ['Masque', s(r.mask), false],
            ['Wildcard', s(r.wildcard), false],
            ['Hôtes disponibles', r.hosts.toLocaleString('fr-FR'), true],
            ['Bits réseau / hôte', `${r.cidr} / ${32-r.cidr}`, false],
            ['Nature', r.category.label, false],
            ['Plage d\'hôtes', r.kind === 'single' ? 'Aucune : une seule adresse' : `${s(r.first)} - ${s(r.last)}`, false]
        ].map(([lbl, val, hl]) =>
            `<div class="ipw-item ${hl?'highlight':''}"><div class="ipw-item-label">${lbl}</div><div class="ipw-item-value">${val}</div></div>`
        ).join('');
        summary.style.display = 'grid';

        binary.innerHTML = [
            ['IP', r.octets, true],
            ['Masque', r.mask, false],
            ['Réseau', r.network, true],
            ['Broadcast', r.broadcast, true]
        ].map(([lbl, octs, net]) =>
            `<div class="ipw-bin-row"><span class="ipw-bin-label">${lbl}</span>${this._renderBits(octs, r.cidr, net)}<span style="font-size:.62rem;color:var(--sl-muted,#94a3b8);padding-left:4px;">${s(octs)}</span></div>`
        ).join('');
        binary.style.display = 'flex';
    }

    _bindControls() {
        this.root.querySelector('.ipw-btn-calc')?.addEventListener('click', () => this._calculate());
        this.root.querySelector('.ipw-ip-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._calculate();
        });
        this.root.querySelector('.ipw-btn-rand')?.addEventListener('click', () => {
            const pools = [
                () => `10.${r(256)}.${r(256)}.${r(254)+1}/${pick([8,16,24,25])}`,
                () => `172.${16+r(16)}.${r(256)}.${r(254)+1}/${pick([16,20,24])}`,
                () => `192.168.${r(256)}.${r(254)+1}/${pick([24,25,26,27])}`
            ];
            const r = n => Math.floor(Math.random()*n);
            const pick = a => a[r(a.length)];
            const gen = pools[r(pools.length)];
            this.root.querySelector('.ipw-ip-input').value = gen();
            this._calculate();
        });
    }
}

if (typeof window !== 'undefined') {
    window.IpSubnetWidget = IpSubnetWidget;
}
