class DnsSimulatorPage extends ConceptPage {
    async init() {
        await super.init();
        // ============================================
        // Speed Controller
        // ============================================
        const speedCtrl = new OEIUtils.SpeedController();

        const Dns = window.OEITrace;
        const NAME_PATTERN = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
        const OLD_WWW = '203.0.113.10';
        const NEW_WWW = '203.0.113.20';

        // ============================================
        // State
        // ============================================
        let world = Dns.dnsCreateWorld();
        let resolverId = 'A';
        let selectedType = 'A';
        let isAnimating = false;
        let stepCounter = 0;
        const EMPTY_STEP_LOG_HTML = '<div class="dns-log-empty">Saisis un domaine et clique sur « Résoudre » pour démarrer la simulation.</div>';
        const EMPTY_CACHE_ROW_HTML = '<tr><td colspan="4" class="cache-empty-cell">Cache vide</td></tr>';

        // ============================================
        // Record type buttons
        // ============================================
        document.querySelectorAll('.record-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.record-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedType = btn.dataset.type;
            });
        });

        function setDomain(d) {
            document.getElementById('domain-input').value = d;
        }

        // ============================================
        // Drawing arrows on the SVG
        // ============================================
        function getServerCenter(id) {
            const el = document.getElementById(id);
            const diagram = document.getElementById('dns-diagram');
            const dr = diagram.getBoundingClientRect();
            const er = el.getBoundingClientRect();
            return {
                x: er.left - dr.left + er.width / 2,
                y: er.top - dr.top + er.height / 2
            };
        }

        const connections = [
            ['srv-client', 'srv-resolver'],
            ['srv-resolver', 'srv-root'],
            ['srv-resolver', 'srv-tld'],
            ['srv-resolver', 'srv-auth']
        ];

        function drawConnections() {
            const svg = document.getElementById('dns-svg');
            svg.innerHTML = '';
            const ns = 'http://www.w3.org/2000/svg';
            connections.forEach(([fromId, toId], idx) => {
                const from = getServerCenter(fromId);
                const to = getServerCenter(toId);
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', from.x);
                line.setAttribute('y1', from.y);
                line.setAttribute('x2', to.x);
                line.setAttribute('y2', to.y);
                line.setAttribute('class', 'arrow-line');
                line.setAttribute('id', `conn-${idx}`);
                svg.appendChild(line);
            });
        }

        function activateConnection(idx, isResponse) {
            const line = document.getElementById(`conn-${idx}`);
            if (line) {
                line.classList.add(isResponse ? 'response' : 'active');
            }
        }

        function resetConnections() {
            document.querySelectorAll('.arrow-line').forEach(l => {
                l.classList.remove('active', 'response');
            });
        }

        // ============================================
        // Message animation
        // ============================================
        function animateMessage(fromId, toId, text, isResponse) {
            return new Promise(resolve => {
                const msg = document.getElementById('dns-msg');
                const from = getServerCenter(fromId);
                const to = getServerCenter(toId);

                msg.textContent = text;
                msg.className = 'dns-message' + (isResponse ? ' response' : '');
                msg.style.left = from.x + 'px';
                msg.style.top = (from.y - 30) + 'px';
                msg.style.transform = 'translate(-50%, -50%)';

                requestAnimationFrame(() => {
                    msg.classList.add('visible');
                    requestAnimationFrame(() => {
                        msg.style.left = to.x + 'px';
                        msg.style.top = (to.y - 30) + 'px';
                    });
                });

                setTimeout(() => {
                    msg.classList.remove('visible');
                    resolve();
                }, 800);
            });
        }

        // ============================================
        // Step logging
        // ============================================
        function addStep(text, isResponse) {
            stepCounter++;
            const log = document.getElementById('step-log');
            if (stepCounter === 1) log.innerHTML = '';

            const entry = document.createElement('div');
            entry.className = 'step-entry';
            entry.innerHTML = `
                <div class="step-num ${isResponse ? 'response' : ''}">${stepCounter}</div>
                <div class="step-text">${text}</div>
            `;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
            document.getElementById('step-count').textContent = stepCounter + ' étape' + (stepCounter > 1 ? 's' : '');
        }

        // ============================================
        // Cache management
        // ============================================
        function clearCache() {
            world.resolvers[resolverId].cache = [];
            world.resolvers[resolverId].delegations = {};
            renderCache();
        }

        function applyWidthFromDataset(root) {
            if (!root) return;
            root.querySelectorAll('[data-width-pct]').forEach((node) => {
                const value = Number(node.dataset.widthPct);
                if (!Number.isFinite(value)) {
                    node.style.width = '0%';
                    return;
                }
                const clamped = Math.max(0, Math.min(100, value));
                node.style.width = `${clamped}%`;
            });
        }

        function renderCache() {
            const entries = Dns.dnsCacheView(world, resolverId);
            const body = document.getElementById('cache-body');
            document.getElementById('cache-count').textContent = entries.length + ' entrée' + (entries.length !== 1 ? 's' : '');

            if (entries.length === 0) {
                body.innerHTML = EMPTY_CACHE_ROW_HTML;
                renderTTLTimeline(entries);
                return;
            }

            body.innerHTML = entries.map(e => {
                const pct = Math.max(0, (e.remaining / e.ttl) * 100);
                return `<tr>
                    <td class="cache-domain">${e.name}</td>
                    <td><span class="record-badge record-${e.type}">${e.type}</span></td>
                    <td class="cache-value">${e.value}</td>
                    <td class="cache-ttl-cell">
                        ${Dns.dnsFormatDuration(e.remaining)}
                        <div class="ttl-bar"><div class="ttl-fill" data-width-pct="${pct}"></div></div>
                    </td>
                </tr>`;
            }).join('');
            applyWidthFromDataset(body);

            renderTTLTimeline(entries);
        }

        function renderTTLTimeline(entries) {
            const timeline = document.getElementById('ttl-timeline');
            if (!timeline) return;

            if (entries.length === 0) {
                timeline.innerHTML = '<div class="ttl-empty">Aucune entrée en cache.</div>';
                return;
            }

            timeline.innerHTML = entries.map((e) => {
                const widthPct = Math.max(0, Math.min(100, (e.remaining / e.ttl) * 100));
                return `
                    <div class="ttl-row">
                        <div class="ttl-row-label">${e.name}<span class="record-badge record-${e.type}">${e.type}</span></div>
                        <div class="ttl-row-track">
                            <div class="ttl-row-fill" data-width-pct="${widthPct}"></div>
                        </div>
                        <div class="ttl-row-time">${Dns.dnsFormatDuration(e.remaining)}</div>
                    </div>
                `;
            }).join('');
            applyWidthFromDataset(timeline);
        }

        // ============================================
        // Update stats
        // ============================================
        function updateStats() {
            const stats = world.resolvers[resolverId].stats;
            document.getElementById('stat-resolves').textContent = stats.resolves;
            document.getElementById('stat-cache-hits').textContent = stats.cacheHits;
            document.getElementById('stat-queries').textContent = stats.queries;
            const clock = document.getElementById('dns-clock');
            if (clock) clock.textContent = '+' + (world.now ? Dns.dnsFormatDuration(world.now) : '0 s');
        }

        // ============================================
        // Main resolution
        // ============================================
        function resetServers() {
            document.querySelectorAll('.dns-server').forEach(s => s.classList.remove('active', 'resolved'));
            resetConnections();
        }

        function resetAll() {
            isAnimating = false;
            stepCounter = 0;
            resetServers();
            document.getElementById('step-log').innerHTML = EMPTY_STEP_LOG_HTML;
            document.getElementById('step-count').textContent = '0 étapes';
            document.getElementById('feedback').textContent = '';
            document.getElementById('dns-msg').classList.remove('visible');
        }

        const SERVER_PAIRS = { 'client-resolver': 0, 'resolver-root': 1, 'resolver-tld': 2, 'resolver-auth': 3 };

        async function playStep(step) {
            addStep(step.text, step.response);
            if (step.internal) {
                document.getElementById('srv-resolver').classList.add('active');
                await OEIUtils.sleep(speedCtrl.getDelay());
                return;
            }
            const pair = step.response ? step.to + '-' + step.from : step.from + '-' + step.to;
            document.getElementById('srv-' + step.from).classList.add('active');
            await animateMessage('srv-' + step.from, 'srv-' + step.to, step.label, step.response);
            if (SERVER_PAIRS[pair] !== undefined) activateConnection(SERVER_PAIRS[pair], step.response);
            document.getElementById('srv-' + step.from).classList.remove('active');
            if (step.response && ['root', 'tld', 'auth'].includes(step.from)) {
                document.getElementById('srv-' + step.from).classList.add('resolved');
            }
            document.getElementById('srv-' + step.to).classList.add('active');
            await OEIUtils.sleep(speedCtrl.getDelay());
        }

        async function startResolve() {
            if (isAnimating) return;
            isAnimating = true;

            const domain = document.getElementById('domain-input').value.trim().toLowerCase().replace(/\.$/, '');
            const feedback = document.getElementById('feedback');

            if (!domain || !domain.includes('.') || !NAME_PATTERN.test(domain)) {
                feedback.textContent = 'Saisis un nom de domaine valide (ex : www.example.org), avec lettres, chiffres, tirets et points.';
                feedback.className = 'feedback error';
                isAnimating = false;
                return;
            }

            feedback.textContent = '';
            feedback.className = 'feedback';
            stepCounter = 0;
            resetServers();
            document.getElementById('step-log').innerHTML = '';
            document.getElementById('step-count').textContent = '0 étapes';

            const labels = domain.split('.');
            document.getElementById('tld-label').textContent = '.' + labels[labels.length - 1];
            document.getElementById('auth-label').textContent = labels.slice(-2).join('.');
            drawConnections();

            const type = selectedType;
            const result = Dns.dnsResolve(world, resolverId, domain, type);

            for (const step of result.steps) {
                await playStep(step);
                updateStats();
            }
            document.getElementById('srv-resolver').classList.add('resolved');
            document.getElementById('srv-client').classList.add('resolved');
            renderCache();
            updateStats();

            if (result.rcode === 'NOERROR' && result.answers.length) {
                feedback.textContent = (result.fromCache ? 'Résolu depuis le cache : ' : 'Résolu : ') + domain + ' -> ' + result.answers.join(', ') + ' (' + type + ')';
                feedback.className = 'feedback success';
            } else if (result.nodata) {
                feedback.textContent = 'NODATA : ' + domain + ' existe, mais n\'a pas d\'enregistrement ' + type + '.';
                feedback.className = 'feedback warning';
            } else {
                feedback.textContent = result.rcode + ' : ' + (result.rcode === 'NXDOMAIN' ? domain + ' n\'existe pas.' : 'la résolution a échoué.');
                feedback.className = 'feedback error';
            }

            isAnimating = false;
        }

        function advanceTime(seconds) {
            Dns.dnsAdvance(world, seconds);
            renderCache();
            updateStats();
            const feedback = document.getElementById('feedback');
            feedback.textContent = 'L\'horloge avance de ' + Dns.dnsFormatDuration(seconds) + ' : les TTL du cache baissent d\'autant, les entrées expirées disparaissent.';
            feedback.className = 'feedback';
        }

        function migrate() {
            const current = world.zones['example.org'].names['www.example.org'].A.values[0];
            const next = current === OLD_WWW ? NEW_WWW : OLD_WWW;
            Dns.dnsSetRecord(world, 'www.example.org', 'A', [next]);
            const feedback = document.getElementById('feedback');
            feedback.textContent = 'Migration : le serveur autoritaire sert maintenant www.example.org = ' + next + '. Un résolveur qui a encore l\'ancienne réponse en cache ne le sait pas avant l\'expiration du TTL.';
            feedback.className = 'feedback warning';
            document.getElementById('btn-migrate').textContent = next === NEW_WWW ? 'Revenir à ' + OLD_WWW : 'Migrer www.example.org vers ' + NEW_WWW;
        }

        function resetWorld() {
            world = Dns.dnsCreateWorld();
            document.getElementById('btn-migrate').textContent = 'Migrer www.example.org vers ' + NEW_WWW;
            resetAll();
            renderCache();
            updateStats();
        }

        document.getElementById('domain-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') startResolve();
        });

        const resolveBtn = document.getElementById('btn-resolve');
        if (resolveBtn) {
            resolveBtn.addEventListener('click', () => {
                startResolve();
            });
        }

        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                resetAll();
            });
        }

        document.getElementById('resolver-select').addEventListener('change', (e) => {
            resolverId = e.target.value;
            renderCache();
            updateStats();
        });
        document.querySelectorAll('[data-dns-advance]').forEach((btn) => {
            btn.addEventListener('click', () => advanceTime(Number(btn.dataset.dnsAdvance)));
        });
        document.getElementById('btn-migrate').addEventListener('click', migrate);
        document.getElementById('btn-reset-world').addEventListener('click', resetWorld);

        const clearCacheBtn = document.getElementById('btn-clear-cache');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                clearCache();
            });
        }

        document.querySelectorAll('.domain-chip[data-domain]').forEach((chip) => {
            chip.addEventListener('click', () => {
                const domain = String(chip.dataset.domain || '').trim();
                if (domain) setDomain(domain);
            });
        });

        drawConnections();
        window.addEventListener('resize', drawConnections);
        renderCache();
        updateStats();
    }
}

if (typeof window !== 'undefined') {
    window.DnsSimulatorPage = DnsSimulatorPage;
}

// ── Standalone widget ──────────────────────────────────────────
class DnsWidget {

    static mount(container, config = {}) {
        if (container.dataset.dnw) return;
        container.dataset.dnw = '1';
        new DnsWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.type = 'A';
        this.rid = 'A';
        this.running = false;
        this._stepNum = 0;
        this.defaultDomain = config.domain || 'www.example.org';
    }

    get dns() {
        return window.OEITrace;
    }

    init() {
        this.world = this.dns.dnsCreateWorld();
        const chips = ['www.example.org', 'mail.example.org', 'shop.example.org', 'api.example.org', 'lb.example.net', 'wwww.example.org'];
        this.root.innerHTML = `<div class="dnw widget-fit">
  <div class="widget-fit-header">
    <div class="dnw-toolbar">
      <input class="dnw-input" data-domain placeholder="www.example.org" value="${this.defaultDomain}">
      <div class="dnw-types">
        ${['A','AAAA','CNAME','MX','NS','TXT'].map(t => `<button class="dnw-type${t==='A'?' active':''}" data-type="${t}">${t}</button>`).join('')}
      </div>
      <button class="dnw-btn" data-resolve>Résoudre</button>
      <button class="dnw-btn sec" data-reset-btn>${OEIIcons.render('refresh')}</button>
    </div>
    <div class="dnw-chips">
      ${chips.map(d => `<button class="dnw-chip" data-chip="${d}">${d}</button>`).join('')}
    </div>
    <div class="dnw-toolbar">
      <select class="dnw-select" data-resolver aria-label="Résolveur"><option value="A">Résolveur A</option><option value="B">Résolveur B</option></select>
      <button class="dnw-btn sec" data-advance="600">+10 min</button>
      <button class="dnw-btn sec" data-advance="3600">+1 h</button>
      <span class="dnw-clock">Horloge : <strong data-clock>+0 s</strong></span>
      <button class="dnw-btn sec" data-migrate>Migrer www.example.org vers 203.0.113.20</button>
    </div>
  </div>
  <div class="widget-fit-body">
    <div class="dnw-section-lbl">Serveurs</div>
    <div class="dnw-diagram">
      <div class="dnw-srv" data-srv="client"><div class="dnw-srv-icon">${OEIIcons.render('laptop')}</div>CLIENT<div class="dnw-srv-name">Ta machine</div></div>
      <div class="dnw-srv" data-srv="resolver"><div class="dnw-srv-icon">${OEIIcons.render('refresh')}</div>RÉSOLVEUR<div class="dnw-srv-name">FAI / local</div></div>
      <div class="dnw-srv" data-srv="root"><div class="dnw-srv-icon">${OEIIcons.render('globe')}</div>RACINE<div class="dnw-srv-name">Root (.)</div></div>
      <div class="dnw-srv" data-srv="tld"><div class="dnw-srv-icon">${OEIIcons.render('tag')}</div>TLD<div class="dnw-srv-name" data-tld-lbl>.org / .net</div></div>
      <div class="dnw-srv" data-srv="auth"><div class="dnw-srv-icon">${OEIIcons.render('clipboard')}</div>AUTORITAIRE<div class="dnw-srv-name" data-auth-lbl>domaine</div></div>
    </div>
    <div class="dnw-feedback" data-fb></div>
    <div class="dnw-section-lbl">Étapes de résolution</div>
    <div class="dnw-steps" data-steps><div class="dnw-empty">Saisis un domaine et clique sur Résoudre.</div></div>
    <div class="dnw-section-lbl">Cache du résolveur (<span data-cache-count>0</span> entrée<span data-cache-s></span>)</div>
    <div class="dnw-cache"><table><thead><tr><th>Domaine</th><th>Type</th><th>Valeur</th><th>TTL restant</th></tr></thead><tbody data-cache-body><tr><td colspan="4" class="dnw-empty">Cache vide</td></tr></tbody></table></div>
  </div>
</div>`;
        this._bind();
    }

    _q(s) { return this.root.querySelector(s); }
    _qa(s) { return this.root.querySelectorAll(s); }

    _bind() {
        this._qa('[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._qa('[data-type]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.type = btn.dataset.type;
            });
        });
        this._qa('[data-chip]').forEach(chip => {
            chip.addEventListener('click', () => { this._q('[data-domain]').value = chip.dataset.chip; });
        });
        this._q('[data-resolve]').addEventListener('click', () => this._resolve());
        this._q('[data-reset-btn]').addEventListener('click', () => this._resetWorld());
        this._q('[data-domain]').addEventListener('keydown', e => { if (e.key === 'Enter') this._resolve(); });
        this._q('[data-resolver]').addEventListener('change', e => { this.rid = e.target.value; this._renderCache(); });
        this._qa('[data-advance]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.dns.dnsAdvance(this.world, Number(btn.dataset.advance));
                this._renderCache();
                this._setFeedback('L\'horloge avance : les TTL du cache baissent, les entrées expirées disparaissent.', '');
            });
        });
        this._q('[data-migrate]').addEventListener('click', () => this._migrate());
    }

    _srv(id) { return this.root.querySelector(`[data-srv="${id}"]`); }

    _clearSrvState() {
        ['client','resolver','root','tld','auth'].forEach(id => {
            this._srv(id).classList.remove('active','resolved','queried');
        });
    }

    _addStep(html, isResp) {
        this._stepNum++;
        const area = this._q('[data-steps]');
        if (this._stepNum === 1) area.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'dnw-step';
        div.innerHTML = `<div class="dnw-step-num${isResp ? ' resp' : ''}">${this._stepNum}</div><div class="dnw-step-text">${html}</div>`;
        area.appendChild(div);
        area.scrollTop = area.scrollHeight;
    }

    _setFeedback(text, cls) {
        const fb = this._q('[data-fb]');
        fb.textContent = text;
        fb.className = 'dnw-feedback' + (cls ? ' ' + cls : '');
    }

    _resetWorld() {
        this.running = false;
        this._stepNum = 0;
        this.world = this.dns.dnsCreateWorld();
        this._clearSrvState();
        this._q('[data-steps]').innerHTML = '<div class="dnw-empty">Saisis un domaine et clique sur Résoudre.</div>';
        this._q('[data-migrate]').textContent = 'Migrer www.example.org vers 203.0.113.20';
        this._setFeedback('', '');
        this._renderCache();
    }

    _migrate() {
        const current = this.world.zones['example.org'].names['www.example.org'].A.values[0];
        const next = current === '203.0.113.10' ? '203.0.113.20' : '203.0.113.10';
        this.dns.dnsSetRecord(this.world, 'www.example.org', 'A', [next]);
        this._q('[data-migrate]').textContent = next === '203.0.113.20' ? 'Revenir à 203.0.113.10' : 'Migrer www.example.org vers 203.0.113.20';
        this._setFeedback(`Migration : www.example.org vaut maintenant ${next} chez le serveur autoritaire. Un cache qui a l'ancienne réponse ne le sait pas avant la fin du TTL.`, '');
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    _renderCache() {
        const entries = this.dns.dnsCacheView(this.world, this.rid);
        this._q('[data-cache-count]').textContent = entries.length;
        this._q('[data-cache-s]').textContent = entries.length !== 1 ? 's' : '';
        this._q('[data-clock]').textContent = '+' + (this.world.now ? this.dns.dnsFormatDuration(this.world.now) : '0 s');
        const body = this._q('[data-cache-body]');
        if (!entries.length) { body.innerHTML = '<tr><td colspan="4" class="dnw-empty">Cache vide</td></tr>'; return; }
        body.innerHTML = entries.map(e =>
            `<tr><td>${e.name}</td><td><span class="dnw-badge">${e.type}</span></td><td style="font-size:0.75rem">${e.value}</td><td>${this.dns.dnsFormatDuration(e.remaining)}</td></tr>`
        ).join('');
    }

    async _resolve() {
        if (this.running) return;
        const domain = this._q('[data-domain]').value.trim().toLowerCase().replace(/\.$/, '');
        if (!domain || !domain.includes('.') || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(domain)) {
            this._setFeedback('Saisis un nom de domaine valide (ex : www.example.org).', 'err');
            return;
        }
        this.running = true;
        this._stepNum = 0;
        this._clearSrvState();
        this._q('[data-steps]').innerHTML = '';
        this._setFeedback('', '');

        const labels = domain.split('.');
        this._q('[data-tld-lbl]').textContent = '.' + labels[labels.length - 1];
        this._q('[data-auth-lbl]').textContent = labels.slice(-2).join('.');

        const type = this.type;
        const result = this.dns.dnsResolve(this.world, this.rid, domain, type);
        for (const step of result.steps) {
            this._addStep(step.text, step.response);
            this._srv(step.from).classList.add('active');
            await this._sleep(step.internal ? 350 : 650);
            this._srv(step.from).classList.remove('active');
            if (step.response && ['root', 'tld', 'auth'].includes(step.from)) this._srv(step.from).classList.add('resolved');
        }
        this._srv('resolver').classList.add('resolved');
        this._srv('client').classList.add('resolved');
        this._renderCache();

        if (result.rcode === 'NOERROR' && result.answers.length) {
            this._setFeedback(`${result.fromCache ? 'Depuis le cache' : 'Résolu'} : ${domain} → ${result.answers.join(', ')} (${type})`, 'ok');
        } else if (result.nodata) {
            this._setFeedback(`NODATA : ${domain} existe, mais n'a pas d'enregistrement ${type}.`, 'err');
        } else {
            this._setFeedback(`${result.rcode} : ${domain} n'existe pas.`, 'err');
        }
        this.running = false;
    }
}

if (typeof window !== 'undefined') {
    window.DnsWidget = DnsWidget;
}
