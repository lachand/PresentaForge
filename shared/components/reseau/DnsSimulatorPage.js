class DnsSimulatorPage extends ConceptPage {
    async init() {
        await super.init();
        // ============================================
        // Speed Controller
        // ============================================
        const speedCtrl = new OEIUtils.SpeedController();

        // ============================================
        // DNS Database
        // ============================================
        const DNS_DB = {
            'www.example.com': {
                A: '93.184.216.34',
                AAAA: '2606:2800:220:1:248:1893:25c8:1946',
                CNAME: null,
                MX: 'mail.example.com (priorité 10)',
                NS: 'ns1.example.com',
                tld: '.com',
                auth: 'example.com',
                ttl: 3600
            },
            'mail.google.com': {
                A: '142.250.185.5',
                AAAA: '2a00:1450:4007:80e::2005',
                CNAME: 'googlemail.l.google.com',
                MX: 'alt1.gmail-smtp-in.l.google.com (priorité 5)',
                NS: 'ns1.google.com',
                tld: '.com',
                auth: 'google.com',
                ttl: 300
            },
            'fr.wikipedia.org': {
                A: '185.15.58.224',
                AAAA: '2a02:ec80:600:ed1a::1',
                CNAME: 'dyna.wikimedia.org',
                MX: 'mx-in.wikimedia.org (priorité 10)',
                NS: 'ns0.wikimedia.org',
                tld: '.org',
                auth: 'wikipedia.org',
                ttl: 600
            },
            'api.github.com': {
                A: '140.82.121.6',
                AAAA: '2606:50c0:8000::6',
                CNAME: null,
                MX: 'alt1.aspmx.l.google.com (priorité 5)',
                NS: 'ns-1707.awsdns-21.co.uk',
                tld: '.com',
                auth: 'github.com',
                ttl: 60
            },
            'cdn.jsdelivr.net': {
                A: '104.16.85.20',
                AAAA: '2606:4700::6810:5514',
                CNAME: 'jsdelivr.map.fastly.net',
                MX: null,
                NS: 'dns1.p05.nsone.net',
                tld: '.net',
                auth: 'jsdelivr.net',
                ttl: 300
            }
        };

        // Fallback for unknown domains
        function generateFakeRecord(domain) {
            const parts = domain.split('.');
            const tld = '.' + parts[parts.length - 1];
            const auth = parts.slice(-2).join('.');
            const o1 = 10 + (hashCode(domain) & 0xFF);
            const o2 = (hashCode(domain + 'a') & 0xFF);
            const o3 = (hashCode(domain + 'b') & 0xFF);
            const o4 = (hashCode(domain + 'c') & 0xFF) || 1;
            return {
                A: `${o1}.${o2}.${o3}.${o4}`,
                AAAA: `2001:db8::${o1.toString(16)}:${o2.toString(16)}`,
                CNAME: null,
                MX: `mail.${auth} (priorité 10)`,
                NS: `ns1.${auth}`,
                tld: tld,
                auth: auth,
                ttl: 3600
            };
        }

        function hashCode(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
            }
            return Math.abs(hash);
        }

        // ============================================
        // State
        // ============================================
        let selectedType = 'A';
        let isAnimating = false;
        let dnsCache = [];
        let stepCounter = 0;
        let stats = { resolves: 0, cacheHits: 0, queries: 0 };
        let cacheTimers = [];
        const EMPTY_STEP_LOG_HTML = '<div class="dns-log-empty">Entrez un domaine et cliquez sur "Résoudre" pour démarrer la simulation.</div>';
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
        function findInCache(domain, type) {
            return dnsCache.find(e => e.domain === domain && e.type === type);
        }

        function addToCache(domain, type, value, ttl) {
            const existing = findInCache(domain, type);
            if (existing) {
                existing.value = value;
                existing.ttl = ttl;
                existing.remaining = ttl;
            } else {
                dnsCache.push({ domain, type, value, ttl, remaining: ttl });
            }
            renderCache();
        }

        function clearCache() {
            dnsCache = [];
            cacheTimers.forEach(t => clearInterval(t));
            cacheTimers = [];
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
            const body = document.getElementById('cache-body');
            document.getElementById('cache-count').textContent = dnsCache.length + ' entrée' + (dnsCache.length !== 1 ? 's' : '');

            if (dnsCache.length === 0) {
                body.innerHTML = EMPTY_CACHE_ROW_HTML;
                renderTTLTimeline();
                return;
            }

            body.innerHTML = dnsCache.map(e => {
                const pct = Math.max(0, (e.remaining / e.ttl) * 100);
                return `<tr>
                    <td class="cache-domain">${e.domain}</td>
                    <td><span class="record-badge record-${e.type}">${e.type}</span></td>
                    <td class="cache-value">${e.value}</td>
                    <td class="cache-ttl-cell">
                        ${e.remaining}s
                        <div class="ttl-bar"><div class="ttl-fill" data-width-pct="${pct}"></div></div>
                    </td>
                </tr>`;
            }).join('');
            applyWidthFromDataset(body);

            renderTTLTimeline();
        }

        function renderTTLTimeline() {
            const timeline = document.getElementById('ttl-timeline');
            if (!timeline) return;

            if (dnsCache.length === 0) {
                timeline.innerHTML = '<div class="ttl-empty">Aucune entrée en cache.</div>';
                return;
            }

            timeline.innerHTML = dnsCache.map((e) => {
                const widthPct = Math.max(0, Math.min(100, (e.remaining / e.ttl) * 100));
                return `
                    <div class="ttl-row">
                        <div class="ttl-row-label">${e.domain}<span class="record-badge record-${e.type}">${e.type}</span></div>
                        <div class="ttl-row-track">
                            <div class="ttl-row-fill" data-width-pct="${widthPct}"></div>
                        </div>
                        <div class="ttl-row-time">${e.remaining}s</div>
                    </div>
                `;
            }).join('');
            applyWidthFromDataset(timeline);
        }

        function startCacheTTL() {
            const timer = setInterval(() => {
                let changed = false;
                dnsCache = dnsCache.filter(e => {
                    e.remaining--;
                    if (e.remaining <= 0) { changed = true; return false; }
                    changed = true;
                    return true;
                });
                if (changed) renderCache();
                if (dnsCache.length === 0) clearInterval(timer);
            }, 1000);
            cacheTimers.push(timer);
        }

        // ============================================
        // Update stats
        // ============================================
        function updateStats() {
            document.getElementById('stat-resolves').textContent = stats.resolves;
            document.getElementById('stat-cache-hits').textContent = stats.cacheHits;
            document.getElementById('stat-queries').textContent = stats.queries;
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

        async function startResolve() {
            if (isAnimating) return;
            isAnimating = true;

            const domain = document.getElementById('domain-input').value.trim().toLowerCase();
            const feedback = document.getElementById('feedback');

            if (!domain || !domain.includes('.')) {
                feedback.textContent = 'Veuillez entrer un nom de domaine valide (ex: www.example.com).';
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

            const record = DNS_DB[domain] || generateFakeRecord(domain);
            const type = selectedType;
            const value = record[type];

            // Update server labels
            document.getElementById('tld-label').textContent = record.tld;
            document.getElementById('auth-label').textContent = record.auth;
            drawConnections();

            stats.resolves++;
            stats.queries++;
            updateStats();

            // Step 1: Client to resolver
            document.getElementById('srv-client').classList.add('active');
            addStep(`Le client demande la résolution de <strong>${domain}</strong> (type <span class="record-badge record-${type}">${type}</span>) au résolveur local.`, false);
            await animateMessage('srv-client', 'srv-resolver', `Requête: ${domain} (${type})`, false);
            activateConnection(0, false);
            await OEIUtils.sleep(speedCtrl.getDelay());

            document.getElementById('srv-resolver').classList.add('active');
            document.getElementById('srv-client').classList.remove('active');

            // Check cache
            const cached = findInCache(domain, type);
            if (cached) {
                stats.cacheHits++;
                updateStats();
                addStep(`Le résolveur trouve <strong>${domain}</strong> dans son <strong>cache</strong> ! Valeur : <code>${cached.value}</code>`, true);
                await OEIUtils.sleep(speedCtrl.getDelay());

                addStep(`Le résolveur renvoie la réponse au client depuis le cache. Pas de requête supplémentaire.`, true);
                await animateMessage('srv-resolver', 'srv-client', `Réponse: ${cached.value}`, true);
                activateConnection(0, true);

                document.getElementById('srv-resolver').classList.add('resolved');
                document.getElementById('srv-client').classList.add('resolved');

                feedback.textContent = `Résolu depuis le cache : ${domain} -> ${cached.value}`;
                feedback.className = 'feedback success';
                isAnimating = false;
                return;
            }

            addStep(`Le résolveur ne trouve pas <strong>${domain}</strong> dans son cache. Il interroge le <strong>serveur racine</strong>.`, false);
            await OEIUtils.sleep(speedCtrl.getDelay());

            // Step 2: Resolver to Root
            stats.queries++;
            updateStats();
            await animateMessage('srv-resolver', 'srv-root', `Où est ${domain} ?`, false);
            activateConnection(1, false);
            document.getElementById('srv-root').classList.add('active');
            document.getElementById('srv-resolver').classList.remove('active');
            await OEIUtils.sleep(speedCtrl.getDelay());

            addStep(`Le serveur racine (.) ne connaît pas l'adresse, mais il oriente vers le <strong>serveur TLD</strong> pour <strong>${record.tld}</strong>.`, true);
            await animateMessage('srv-root', 'srv-resolver', `Essaie le serveur ${record.tld}`, true);
            activateConnection(1, true);
            document.getElementById('srv-root').classList.remove('active');
            document.getElementById('srv-root').classList.add('resolved');
            await OEIUtils.sleep(speedCtrl.getDelay());

            // Step 3: Resolver to TLD
            stats.queries++;
            updateStats();
            document.getElementById('srv-resolver').classList.add('active');
            addStep(`Le résolveur interroge le <strong>serveur TLD</strong> (${record.tld}) pour <strong>${domain}</strong>.`, false);
            await animateMessage('srv-resolver', 'srv-tld', `Où est ${domain} ?`, false);
            activateConnection(2, false);
            document.getElementById('srv-tld').classList.add('active');
            document.getElementById('srv-resolver').classList.remove('active');
            await OEIUtils.sleep(speedCtrl.getDelay());

            addStep(`Le serveur TLD (${record.tld}) oriente vers le <strong>serveur autoritaire</strong> de <strong>${record.auth}</strong>.`, true);
            await animateMessage('srv-tld', 'srv-resolver', `Essaie le serveur de ${record.auth}`, true);
            activateConnection(2, true);
            document.getElementById('srv-tld').classList.remove('active');
            document.getElementById('srv-tld').classList.add('resolved');
            await OEIUtils.sleep(speedCtrl.getDelay());

            // Step 4: Resolver to Authoritative
            stats.queries++;
            updateStats();
            document.getElementById('srv-resolver').classList.add('active');

            if (value) {
                addStep(`Le résolveur interroge le <strong>serveur autoritaire</strong> de <strong>${record.auth}</strong> pour l'enregistrement ${type} de <strong>${domain}</strong>.`, false);
                await animateMessage('srv-resolver', 'srv-auth', `${type} pour ${domain} ?`, false);
                activateConnection(3, false);
                document.getElementById('srv-auth').classList.add('active');
                document.getElementById('srv-resolver').classList.remove('active');
                await OEIUtils.sleep(speedCtrl.getDelay());

                addStep(`Le serveur autoritaire répond avec l'enregistrement <span class="record-badge record-${type}">${type}</span> : <code>${value}</code> (TTL : ${record.ttl}s).`, true);
                await animateMessage('srv-auth', 'srv-resolver', `${type}: ${value}`, true);
                activateConnection(3, true);
                document.getElementById('srv-auth').classList.remove('active');
                document.getElementById('srv-auth').classList.add('resolved');
                await OEIUtils.sleep(speedCtrl.getDelay());

                // Cache the result
                addToCache(domain, type, value, record.ttl);
                startCacheTTL();

                addStep(`Le résolveur <strong>met en cache</strong> le résultat (TTL : ${record.ttl}s) et le transmet au client.`, true);
                document.getElementById('srv-resolver').classList.add('resolved');
                await animateMessage('srv-resolver', 'srv-client', `${type}: ${value}`, true);
                activateConnection(0, true);
                document.getElementById('srv-client').classList.add('resolved');

                addStep(`Résolution terminée ! <strong>${domain}</strong> = <code>${value}</code>`, true);

                feedback.textContent = `Résolu : ${domain} -> ${value} (${type})`;
                feedback.className = 'feedback success';
            } else {
                addStep(`Le résolveur interroge le <strong>serveur autoritaire</strong> de <strong>${record.auth}</strong> pour l'enregistrement ${type}.`, false);
                await animateMessage('srv-resolver', 'srv-auth', `${type} pour ${domain} ?`, false);
                activateConnection(3, false);
                document.getElementById('srv-auth').classList.add('active');
                await OEIUtils.sleep(speedCtrl.getDelay());

                addStep(`Le serveur autoritaire ne possède <strong>pas d'enregistrement ${type}</strong> pour <strong>${domain}</strong>.`, true);
                await animateMessage('srv-auth', 'srv-resolver', `NXDOMAIN / pas de ${type}`, true);

                feedback.textContent = `Aucun enregistrement ${type} trouvé pour ${domain}.`;
                feedback.className = 'feedback error';
            }

            isAnimating = false;
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
    }
}

if (typeof window !== 'undefined') {
    window.DnsSimulatorPage = DnsSimulatorPage;
}

// ── Standalone widget ──────────────────────────────────────────
class DnsWidget {
    static _stylesInjected = false;

    static _DNS_DB = {
        'www.example.com':  { A: '93.184.216.34', AAAA: '2606:2800:220:1:248:1893:25c8:1946', CNAME: null, MX: 'mail.example.com (p.10)', NS: 'ns1.example.com', tld: '.com', auth: 'example.com', ttl: 3600 },
        'mail.google.com':  { A: '142.250.185.5', AAAA: '2a00:1450:4007:80e::2005', CNAME: 'googlemail.l.google.com', MX: 'alt1.gmail-smtp-in.l.google.com (p.5)', NS: 'ns1.google.com', tld: '.com', auth: 'google.com', ttl: 300 },
        'fr.wikipedia.org': { A: '185.15.58.224', AAAA: '2a02:ec80:600:ed1a::1', CNAME: 'dyna.wikimedia.org', MX: 'mx-in.wikimedia.org (p.10)', NS: 'ns0.wikimedia.org', tld: '.org', auth: 'wikipedia.org', ttl: 600 },
        'api.github.com':   { A: '140.82.121.6', AAAA: '2606:50c0:8000::6', CNAME: null, MX: 'alt1.aspmx.l.google.com (p.5)', NS: 'ns-1707.awsdns-21.co.uk', tld: '.com', auth: 'github.com', ttl: 60 },
        'cdn.jsdelivr.net': { A: '104.16.85.20', AAAA: '2606:4700::6810:5514', CNAME: 'jsdelivr.map.fastly.net', MX: null, NS: 'dns1.p05.nsone.net', tld: '.net', auth: 'jsdelivr.net', ttl: 300 }
    };

    static _hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    static _fakeRecord(domain) {
        const parts = domain.split('.');
        const tld = '.' + parts[parts.length - 1];
        const auth = parts.slice(-2).join('.');
        const h = DnsWidget._hash;
        const o1 = 10 + (h(domain) & 0xFF), o2 = h(domain + 'a') & 0xFF,
              o3 = h(domain + 'b') & 0xFF, o4 = (h(domain + 'c') & 0xFF) || 1;
        return { A: `${o1}.${o2}.${o3}.${o4}`, AAAA: `2001:db8::${o1.toString(16)}:${o2.toString(16)}`,
            CNAME: null, MX: `mail.${auth} (p.10)`, NS: `ns1.${auth}`, tld, auth, ttl: 3600 };
    }

    static ensureStyles() {
        if (DnsWidget._stylesInjected) return;
        DnsWidget._stylesInjected = true;
        const css = `
.dnw { font-family: inherit; display: flex; flex-direction: column; gap: 10px; }
.dnw-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.dnw-input { font-size: 0.85rem; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; background: var(--surface, #fff); color: var(--text, #222); flex: 1; min-width: 140px; }
.dnw-types { display: flex; gap: 4px; flex-wrap: wrap; }
.dnw-type { font-size: 0.75rem; padding: 3px 8px; border-radius: 10px; border: 1px solid var(--border, #ccc); background: transparent; cursor: pointer; color: var(--text, #222); font-weight: 600; }
.dnw-type.active { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.dnw-btn { font-size: 0.82rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--primary, #6366f1); background: var(--primary, #6366f1); color: #fff; cursor: pointer; }
.dnw-btn.sec { background: transparent; color: var(--text, #222); border-color: var(--border, #ccc); }
.dnw-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.dnw-chip { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: var(--surface2, #f0f0f0); border: 1px solid var(--border, #ccc); cursor: pointer; color: var(--text, #222); }
.dnw-chip:hover { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.dnw-diagram { display: flex; gap: 6px; align-items: stretch; flex-wrap: wrap; }
.dnw-srv { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 10px; border-radius: 8px; border: 2px solid var(--border, #ddd); background: var(--surface2, #f8f8f8); min-width: 72px; font-size: 0.78rem; font-weight: 700; transition: border-color 0.2s, background 0.2s; }
.dnw-srv-icon { font-size: 1.3rem; }
.dnw-srv-name { font-size: 0.7rem; color: var(--muted, #888); font-weight: 500; text-align: center; }
.dnw-srv.active { border-color: var(--primary, #6366f1); background: rgba(99,102,241,0.1); }
.dnw-srv.resolved { border-color: #22c55e; background: rgba(34,197,94,0.08); }
.dnw-srv.queried { border-color: #f59e0b; background: rgba(245,158,11,0.1); }
.dnw-steps { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow-y: auto; }
.dnw-step { display: flex; gap: 8px; align-items: flex-start; font-size: 0.82rem; }
.dnw-step-num { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; background: var(--primary, #6366f1); color: #fff; }
.dnw-step-num.resp { background: #22c55e; }
.dnw-step-text { flex: 1; line-height: 1.4; }
.dnw-cache table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.dnw-cache th { padding: 4px 8px; text-align: left; font-size: 0.75rem; color: var(--muted, #888); border-bottom: 1px solid var(--border, #ddd); }
.dnw-cache td { padding: 3px 8px; border-bottom: 1px solid var(--border, #eee); }
.dnw-badge { font-size: 0.7rem; padding: 1px 6px; border-radius: 8px; font-weight: 700; background: var(--primary, #6366f1); color: #fff; }
.dnw-empty { font-size: 0.8rem; color: var(--muted, #aaa); font-style: italic; padding: 4px 0; }
.dnw-feedback { font-size: 0.82rem; min-height: 1.3em; }
.dnw-feedback.ok { color: #16a34a; font-weight: 600; }
.dnw-feedback.err { color: #dc2626; font-weight: 600; }
.dnw-section-lbl { font-size: 0.78rem; font-weight: 700; color: var(--muted, #888); }
`;
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        DnsWidget.ensureStyles();
        if (container.dataset.dnw) return;
        container.dataset.dnw = '1';
        new DnsWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.type = 'A';
        this.cache = [];
        this.running = false;
    }

    init() {
        const domains = Object.keys(DnsWidget._DNS_DB);
        this.root.innerHTML = `<div class="dnw">
  <div class="dnw-toolbar">
    <input class="dnw-input" data-domain placeholder="www.example.com">
    <div class="dnw-types">
      ${['A','AAAA','CNAME','MX','NS'].map(t => `<button class="dnw-type${t==='A'?' active':''}" data-type="${t}">${t}</button>`).join('')}
    </div>
    <button class="dnw-btn" data-resolve>Résoudre</button>
    <button class="dnw-btn sec" data-reset-btn>↺</button>
  </div>
  <div class="dnw-chips">
    ${domains.map(d => `<button class="dnw-chip" data-chip="${d}">${d}</button>`).join('')}
  </div>
  <div class="dnw-section-lbl">Serveurs</div>
  <div class="dnw-diagram">
    <div class="dnw-srv" data-srv="client"><div class="dnw-srv-icon">💻</div>CLIENT<div class="dnw-srv-name">Votre machine</div></div>
    <div class="dnw-srv" data-srv="resolver"><div class="dnw-srv-icon">🔄</div>RÉSOLVEUR<div class="dnw-srv-name">FAI / local</div></div>
    <div class="dnw-srv" data-srv="root"><div class="dnw-srv-icon">🌍</div>RACINE<div class="dnw-srv-name">Root (.)</div></div>
    <div class="dnw-srv" data-srv="tld"><div class="dnw-srv-icon">🏷️</div>TLD<div class="dnw-srv-name" data-tld-lbl>.com/.org…</div></div>
    <div class="dnw-srv" data-srv="auth"><div class="dnw-srv-icon">📋</div>AUTORITAIRE<div class="dnw-srv-name" data-auth-lbl>domaine</div></div>
  </div>
  <div class="dnw-feedback" data-fb></div>
  <div class="dnw-section-lbl">Étapes de résolution</div>
  <div class="dnw-steps" data-steps><div class="dnw-empty">Entrez un domaine et cliquez sur Résoudre.</div></div>
  <div class="dnw-section-lbl">Cache du résolveur (<span data-cache-count>0</span> entrée<span data-cache-s></span>)</div>
  <div class="dnw-cache"><table><thead><tr><th>Domaine</th><th>Type</th><th>Valeur</th><th>TTL</th></tr></thead><tbody data-cache-body><tr><td colspan="4" class="dnw-empty">Cache vide</td></tr></tbody></table></div>
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
        this._q('[data-reset-btn]').addEventListener('click', () => this._resetView());
        this._q('[data-domain]').addEventListener('keydown', e => { if (e.key === 'Enter') this._resolve(); });
    }

    _srv(id) { return this.root.querySelector(`[data-srv="${id}"]`); }

    _setActive(id) { this._srv(id).classList.add('active'); }
    _setResolved(id) { this._srv(id).classList.remove('active'); this._srv(id).classList.add('resolved'); }
    _setQueried(id) { this._srv(id).classList.add('queried'); }
    _clearSrvState() {
        ['client','resolver','root','tld','auth'].forEach(id => {
            const el = this._srv(id);
            el.classList.remove('active','resolved','queried');
        });
    }

    _stepNum = 0;
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

    _resetView() {
        this.running = false;
        this._stepNum = 0;
        this._clearSrvState();
        this._q('[data-steps]').innerHTML = '<div class="dnw-empty">Entrez un domaine et cliquez sur Résoudre.</div>';
        this._q('[data-fb]').textContent = '';
        this._q('[data-fb]').className = 'dnw-feedback';
    }

    _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    _findInCache(domain, type) { return this.cache.find(e => e.domain === domain && e.type === type); }

    _addToCache(domain, type, value, ttl) {
        const existing = this._findInCache(domain, type);
        if (existing) { existing.value = value; existing.ttl = ttl; existing.remaining = ttl; }
        else this.cache.push({ domain, type, value, ttl, remaining: ttl });
        this._renderCache();
        // Start TTL countdown
        const timer = setInterval(() => {
            let any = false;
            this.cache = this.cache.filter(e => {
                e.remaining--;
                if (e.remaining <= 0) { any = true; return false; }
                any = true; return true;
            });
            this._renderCache();
            if (this.cache.length === 0) clearInterval(timer);
        }, 1000);
    }

    _renderCache() {
        const count = this.cache.length;
        this._q('[data-cache-count]').textContent = count;
        this._q('[data-cache-s]').textContent = count !== 1 ? 's' : '';
        const body = this._q('[data-cache-body]');
        if (count === 0) { body.innerHTML = '<tr><td colspan="4" class="dnw-empty">Cache vide</td></tr>'; return; }
        body.innerHTML = this.cache.map(e =>
            `<tr><td>${e.domain}</td><td><span class="dnw-badge">${e.type}</span></td><td style="font-size:0.75rem">${e.value}</td><td>${e.remaining}s</td></tr>`
        ).join('');
    }

    async _resolve() {
        if (this.running) return;
        const domain = this._q('[data-domain]').value.trim().toLowerCase();
        const fb = this._q('[data-fb]');
        if (!domain || !domain.includes('.')) {
            fb.textContent = 'Veuillez entrer un nom de domaine valide (ex: www.example.com).';
            fb.className = 'dnw-feedback err';
            return;
        }
        this.running = true;
        this._stepNum = 0;
        this._clearSrvState();
        this._q('[data-steps]').innerHTML = '';
        fb.textContent = '';
        fb.className = 'dnw-feedback';

        const rec = DnsWidget._DNS_DB[domain] || DnsWidget._fakeRecord(domain);
        const type = this.type;
        const value = rec[type];

        this._q('[data-tld-lbl]').textContent = rec.tld;
        this._q('[data-auth-lbl]').textContent = rec.auth;

        const DELAY = 700;

        // Step 1: client → resolver
        this._setActive('client');
        this._addStep(`Le client demande la résolution de <strong>${domain}</strong> (type <span class="dnw-badge">${type}</span>) au résolveur local.`, false);
        await this._sleep(DELAY);
        this._setResolved('client');
        this._setActive('resolver');

        // Check cache
        const cached = this._findInCache(domain, type);
        if (cached) {
            this._addStep(`Le résolveur trouve <strong>${domain}</strong> dans son <strong>cache</strong> ! Valeur : <code>${cached.value}</code>`, true);
            this._addStep(`Réponse renvoyée au client depuis le cache. Aucune requête supplémentaire.`, true);
            this._setResolved('resolver');
            fb.textContent = `Cache hit : ${domain} → ${cached.value}`;
            fb.className = 'dnw-feedback ok';
            this.running = false;
            return;
        }

        this._addStep(`Le résolveur ne trouve pas <strong>${domain}</strong> dans son cache. Il interroge le <strong>serveur racine</strong>.`, false);
        await this._sleep(DELAY);

        // Step 2: resolver → root
        this._setQueried('root');
        this._addStep(`Le serveur racine (<code>.</code>) ne connaît pas l'adresse, mais oriente vers le serveur TLD <strong>${rec.tld}</strong>.`, true);
        await this._sleep(DELAY);
        this._setResolved('root');

        // Step 3: resolver → TLD
        this._addStep(`Le résolveur interroge le serveur TLD (<strong>${rec.tld}</strong>) pour <strong>${domain}</strong>.`, false);
        await this._sleep(DELAY);
        this._setQueried('tld');
        this._addStep(`Le serveur TLD (${rec.tld}) oriente vers le serveur autoritaire de <strong>${rec.auth}</strong>.`, true);
        await this._sleep(DELAY);
        this._setResolved('tld');

        // Step 4: resolver → auth
        this._addStep(`Le résolveur interroge le serveur autoritaire de <strong>${rec.auth}</strong> pour l'enregistrement <span class="dnw-badge">${type}</span> de <strong>${domain}</strong>.`, false);
        await this._sleep(DELAY);
        this._setQueried('auth');

        if (value) {
            this._addStep(`Le serveur autoritaire répond : <span class="dnw-badge">${type}</span> = <code>${value}</code> (TTL : ${rec.ttl}s).`, true);
            await this._sleep(DELAY);
            this._setResolved('auth');

            this._addToCache(domain, type, value, rec.ttl);
            this._addStep(`Le résolveur <strong>met en cache</strong> le résultat (TTL : ${rec.ttl}s) et le transmet au client.`, true);
            this._setResolved('resolver');
            this._addStep(`Résolution terminée ! <strong>${domain}</strong> = <code>${value}</code>`, true);
            fb.textContent = `Résolu : ${domain} → ${value} (${type})`;
            fb.className = 'dnw-feedback ok';
        } else {
            this._addStep(`Le serveur autoritaire n'a <strong>pas d'enregistrement ${type}</strong> pour <strong>${domain}</strong>.`, true);
            fb.textContent = `Aucun enregistrement ${type} pour ${domain}.`;
            fb.className = 'dnw-feedback err';
        }

        this.running = false;
    }
}

if (typeof window !== 'undefined') {
    window.DnsWidget = DnsWidget;
}
