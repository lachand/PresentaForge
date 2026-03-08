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
                tr.innerHTML = `<td>${n}</td><td>${pow.toLocaleString('fr-FR')}</td><td>${n >= 2 ? (pow - 2).toLocaleString('fr-FR') : '—'}</td>`;
                tbody.appendChild(tr);
            }
        })();

        let currentIP = null;
        let currentMask = null;

        function parseIPCIDR(input) {
            input = input.trim();
            const parts = input.split('/');
            if (parts.length !== 2) return null;
            const ipStr = parts[0];
            const cidr = parseInt(parts[1]);
            if (isNaN(cidr) || cidr < 0 || cidr > 32) return null;

            const octets = ipStr.split('.');
            if (octets.length !== 4) return null;

            const ipNum = [];
            for (let o of octets) {
                const n = parseInt(o);
                if (isNaN(n) || n < 0 || n > 255) return null;
                ipNum.push(n);
            }

            return { octets: ipNum, cidr: cidr };
        }

        function ipToInt(octets) {
            return ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
        }

        function intToIP(num) {
            return [(num >>> 24) & 0xFF, (num >>> 16) & 0xFF, (num >>> 8) & 0xFF, num & 0xFF];
        }

        function ipToString(octets) {
            return octets.join('.');
        }

        function maskFromCIDR(cidr) {
            if (cidr === 0) return 0;
            return (0xFFFFFFFF << (32 - cidr)) >>> 0;
        }

        function toBinaryStr(num, bits) {
            return num.toString(2).padStart(bits, '0');
        }

        function getClass(firstOctet) {
            if (firstOctet < 128) return 'A';
            if (firstOctet < 192) return 'B';
            if (firstOctet < 224) return 'C';
            if (firstOctet < 240) return 'D';
            return 'E';
        }

        function isPrivate(octets) {
            if (octets[0] === 10) return true;
            if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
            if (octets[0] === 192 && octets[1] === 168) return true;
            return false;
        }

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

        function calculate() {
            const input = document.getElementById('ip-input').value;
            const parsed = parseIPCIDR(input);
            const feedback = document.getElementById('feedback');

            if (!parsed) {
                feedback.textContent = 'Format invalide. Utilisez le format : 192.168.1.0/24';
                feedback.className = 'feedback error';
                document.getElementById('binary-card').style.display = 'none';
                document.getElementById('subnet-section').style.display = 'none';
                return;
            }

            feedback.textContent = '';
            feedback.className = 'feedback';

            const { octets, cidr } = parsed;
            currentIP = octets;
            currentMask = cidr;

            const ipInt = ipToInt(octets);
            const maskInt = maskFromCIDR(cidr);
            const networkInt = (ipInt & maskInt) >>> 0;
            const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
            const networkOctets = intToIP(networkInt);
            const broadcastOctets = intToIP(broadcastInt);
            const maskOctets = intToIP(maskInt);
            const wildcardInt = (~maskInt) >>> 0;
            const wildcardOctets = intToIP(wildcardInt);
            const firstHostInt = networkInt + 1;
            const lastHostInt = broadcastInt - 1;
            const firstHostOctets = intToIP(firstHostInt);
            const lastHostOctets = intToIP(lastHostInt);
            const hostBits = 32 - cidr;
            const totalHosts = hostBits >= 2 ? Math.pow(2, hostBits) - 2 : (hostBits === 1 ? 0 : 1);

            // Binary grid
            const grid = document.getElementById('binary-grid');
            let html = '';
            html += renderBinaryRow('Adresse IP', octets, cidr, true);
            html += renderBinaryRow('Masque', maskOctets, cidr, false);
            html += renderBinaryRow('Adresse réseau', networkOctets, cidr, true);
            html += renderBinaryRow('Broadcast', broadcastOctets, cidr, true);
            if (totalHosts > 0) {
                html += renderBinaryRow('Premier hôte', firstHostOctets, cidr, true);
                html += renderBinaryRow('Dernier hôte', lastHostOctets, cidr, true);
            }
            html += renderBinaryRow('Wildcard', wildcardOctets, cidr, false);
            grid.innerHTML = html;

            // Summary
            const ipClass = getClass(octets[0]);
            const priv = isPrivate(octets);
            const summaryGrid = document.getElementById('summary-grid');
            summaryGrid.innerHTML = `
                <div class="summary-item">
                    <div class="label">Adresse réseau</div>
                    <div class="value">${ipToString(networkOctets)}/${cidr}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Broadcast</div>
                    <div class="value">${ipToString(broadcastOctets)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Masque</div>
                    <div class="value">${ipToString(maskOctets)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Wildcard</div>
                    <div class="value">${ipToString(wildcardOctets)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Hôtes disponibles</div>
                    <div class="value">${totalHosts.toLocaleString('fr-FR')}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Bits réseau / hôte</div>
                    <div class="value">${cidr} / ${hostBits}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Classe</div>
                    <div class="value">Classe ${ipClass} ${priv ? '<span class="class-badge" style="background:var(--accent);">Privée</span>' : '<span class="class-badge" style="background:var(--warning);">Publique</span>'}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Plage d'hôtes</div>
                    <div class="value" style="font-size:0.75rem;">${totalHosts > 0 ? ipToString(firstHostOctets) + ' — ' + ipToString(lastHostOctets) : 'Aucun hôte'}</div>
                </div>
            `;

            document.getElementById('binary-card').style.display = 'block';
            document.getElementById('subnet-section').style.display = 'block';

            // Update subnet count options
            updateSubnetOptions();
        }

        function updateSubnetOptions() {
            const select = document.getElementById('subnet-count');
            const hostBits = 32 - currentMask;
            select.innerHTML = '';
            for (let i = 1; i <= hostBits - 1; i++) {
                const n = Math.pow(2, i);
                const opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                select.appendChild(opt);
            }
        }

        function calculateSubnets() {
            if (!currentIP || currentMask === null) return;
            const n = parseInt(document.getElementById('subnet-count').value);
            const extraBits = Math.log2(n);
            const newCidr = currentMask + extraBits;
            if (newCidr > 30) {
                document.getElementById('subnet-table-wrap').innerHTML = '<p class="feedback error">Trop de sous-réseaux pour ce masque.</p>';
                return;
            }

            const networkInt = (ipToInt(currentIP) & maskFromCIDR(currentMask)) >>> 0;
            const newMask = maskFromCIDR(newCidr);
            const newMaskOctets = intToIP(newMask);
            const subnetSize = Math.pow(2, 32 - newCidr);
            const hostsPerSubnet = subnetSize - 2;

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

            for (let i = 0; i < n; i++) {
                const subnetStart = (networkInt + i * subnetSize) >>> 0;
                const subnetBroadcast = (subnetStart + subnetSize - 1) >>> 0;
                const firstHost = (subnetStart + 1) >>> 0;
                const lastHost = (subnetBroadcast - 1) >>> 0;

                html += `<tr>
                    <td>${i + 1}</td>
                    <td>${ipToString(intToIP(subnetStart))}/${newCidr}</td>
                    <td>${ipToString(intToIP(firstHost))}</td>
                    <td>${ipToString(intToIP(lastHost))}</td>
                    <td>${ipToString(intToIP(subnetBroadcast))}</td>
                    <td>${ipToString(newMaskOctets)}</td>
                    <td>${hostsPerSubnet.toLocaleString('fr-FR')}</td>
                </tr>`;
            }

            html += '</tbody></table>';
            html += `<p class="text-sm text-muted mt-1">Nouveau masque : /${newCidr} (${ipToString(newMaskOctets)}) — ${hostsPerSubnet.toLocaleString('fr-FR')} hôtes par sous-réseau — ${extraBits} bits empruntés</p>`;
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
// IpSubnetWidget — Widget autonome pour intégration dans les slides
// Usage : IpSubnetWidget.mount(container, { ip: '192.168.1.0/24' })
// ─────────────────────────────────────────────────────────────────────────────
class IpSubnetWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (IpSubnetWidget._stylesInjected) return;
        IpSubnetWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.ipw-container{display:flex;flex-direction:column;gap:8px;padding:16px;height:100%;box-sizing:border-box;font-family:var(--sl-font-body,sans-serif);color:var(--sl-text,#e2e8f0);}
.ipw-header{font-size:.8rem;font-weight:600;color:var(--sl-muted,#94a3b8);}
.ipw-input-row{display:flex;gap:8px;align-items:center;}
.ipw-input{flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:6px 10px;font-size:.8rem;color:var(--sl-text,#e2e8f0);font-family:monospace;}
.ipw-input:focus{outline:none;border-color:var(--sl-primary,#6366f1);}
.ipw-btn{padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:.72rem;font-weight:500;background:var(--sl-primary,#6366f1);color:#fff;transition:opacity .15s;white-space:nowrap;}
.ipw-btn:hover{opacity:.8;}
.ipw-btn-secondary{background:rgba(255,255,255,.08);color:var(--sl-text,#e2e8f0);}
.ipw-error{font-size:.72rem;color:#ef4444;min-height:16px;}
.ipw-summary{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
.ipw-item{background:rgba(255,255,255,.05);border-radius:6px;padding:5px 8px;}
.ipw-item-label{font-size:.62rem;color:var(--sl-muted,#94a3b8);text-transform:uppercase;letter-spacing:.04em;}
.ipw-item-value{font-size:.78rem;font-weight:600;font-family:monospace;color:var(--sl-text,#e2e8f0);}
.ipw-item.highlight .ipw-item-value{color:var(--sl-accent,#f97316);}
.ipw-binary{display:flex;flex-direction:column;gap:3px;overflow:auto;}
.ipw-bin-row{display:flex;align-items:center;gap:4px;font-size:.62rem;font-family:monospace;}
.ipw-bin-label{width:80px;color:var(--sl-muted,#94a3b8);text-align:right;flex-shrink:0;}
.ipw-bits{display:flex;gap:1px;flex-wrap:nowrap;}
.ipw-bit{width:13px;height:13px;display:flex;align-items:center;justify-content:center;border-radius:2px;font-size:.62rem;}
.ipw-bit.net{background:rgba(99,102,241,.45);color:#e2e8f0;}
.ipw-bit.host{background:rgba(249,115,22,.3);color:#e2e8f0;}
.ipw-bit.plain{background:rgba(255,255,255,.1);color:#94a3b8;}
.ipw-sep{color:rgba(255,255,255,.2);padding:0 1px;}
`;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        IpSubnetWidget.ensureStyles();
        const w = new IpSubnetWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this._defaultIp = config.ip || '192.168.1.0/24';
    }

    // Pure IP math helpers
    static _parse(input) {
        const parts = input.trim().split('/');
        if (parts.length !== 2) return null;
        const cidr = parseInt(parts[1]);
        if (isNaN(cidr) || cidr < 0 || cidr > 32) return null;
        const octs = parts[0].split('.');
        if (octs.length !== 4) return null;
        const nums = octs.map(o => parseInt(o));
        if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
        return { octets: nums, cidr };
    }
    static _toInt(o) { return ((o[0]<<24)|(o[1]<<16)|(o[2]<<8)|o[3])>>>0; }
    static _toOcts(n) { return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]; }
    static _mask(c) { return c===0?0:((0xFFFFFFFF<<(32-c))>>>0); }
    static _ipStr(o) { return o.join('.'); }
    static _cls(f) { return f<128?'A':f<192?'B':f<224?'C':'D/E'; }
    static _priv(o) {
        if (o[0]===10) return true;
        if (o[0]===172&&o[1]>=16&&o[1]<=31) return true;
        if (o[0]===192&&o[1]===168) return true;
        return false;
    }
    static _calc(input) {
        const p = IpSubnetWidget._parse(input);
        if (!p) return null;
        const { octets, cidr } = p;
        const ipInt = IpSubnetWidget._toInt(octets);
        const maskInt = IpSubnetWidget._mask(cidr);
        const netInt = (ipInt & maskInt)>>>0;
        const bcastInt = (netInt|(~maskInt>>>0))>>>0;
        const hostBits = 32 - cidr;
        const hosts = hostBits >= 2 ? Math.pow(2, hostBits) - 2 : 0;
        return {
            octets, cidr, hosts,
            network: IpSubnetWidget._toOcts(netInt),
            broadcast: IpSubnetWidget._toOcts(bcastInt),
            mask: IpSubnetWidget._toOcts(maskInt),
            wildcard: IpSubnetWidget._toOcts((~maskInt)>>>0),
            first: IpSubnetWidget._toOcts(netInt+1),
            last: IpSubnetWidget._toOcts(bcastInt-1),
            cls: IpSubnetWidget._cls(octets[0]),
            priv: IpSubnetWidget._priv(octets)
        };
    }

    init() {
        this.root.innerHTML = `<div class="ipw-container">
            <div class="ipw-header">Calculateur de sous-reseau IP</div>
            <div class="ipw-input-row">
                <input class="ipw-input ipw-ip-input" type="text" placeholder="192.168.1.0/24" value="${this._defaultIp}" spellcheck="false">
                <button class="ipw-btn ipw-btn-calc">Calculer</button>
                <button class="ipw-btn ipw-btn-rand ipw-btn-secondary">&#127922; Aleatoire</button>
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
            errEl.textContent = 'Format invalide — utilisez 192.168.1.0/24';
            summary.style.display = 'none';
            binary.style.display = 'none';
            return;
        }
        errEl.textContent = '';
        const s = IpSubnetWidget._ipStr;
        summary.innerHTML = [
            ['Adresse reseau', `${s(r.network)}/${r.cidr}`, true],
            ['Broadcast', s(r.broadcast), false],
            ['Masque', s(r.mask), false],
            ['Wildcard', s(r.wildcard), false],
            ['Hotes disponibles', r.hosts.toLocaleString('fr-FR'), true],
            ['Bits reseau/hote', `${r.cidr} / ${32-r.cidr}`, false],
            ['Classe', `${r.cls} — ${r.priv?'Privee':'Publique'}`, false],
            ['Plage hotes', r.hosts > 0 ? `${s(r.first)} — ${s(r.last)}` : 'Aucun', false]
        ].map(([lbl, val, hl]) =>
            `<div class="ipw-item ${hl?'highlight':''}"><div class="ipw-item-label">${lbl}</div><div class="ipw-item-value">${val}</div></div>`
        ).join('');
        summary.style.display = 'grid';

        binary.innerHTML = [
            ['IP', r.octets, true],
            ['Masque', r.mask, false],
            ['Reseau', r.network, true],
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
