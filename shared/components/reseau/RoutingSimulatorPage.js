class RoutingSimulatorPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        // ============================================
        // Topologies
        // ============================================
        const Routing = window.OEITrace;
        const TOPOLOGIES = Routing.ROUTING_TOPOLOGIES;

        // ============================================
        // State
        // ============================================
        let currentTopo = 'campus';
        let source = null;
        let dest = null;
        let selectMode = 'source'; // 'source' or 'dest'
        let cutLink = null; // [a, b] quand un lien est coupé

        // Topologie réellement utilisée par Dijkstra : sans le lien coupé, s'il y en a un
        function activeTopo() {
            const topo = TOPOLOGIES[currentTopo];
            return cutLink ? Routing.routingWithoutLink(topo, cutLink[0], cutLink[1]) : topo;
        }

        // Dijkstra state
        let dState = null; // { dist, prev, visited, pq, current, finished, pathEdges }

        // Speed controller
        let speedCtrl = null;

        // ============================================
        // SVG rendering
        // ============================================
        const NS = 'http://www.w3.org/2000/svg';

        function renderNetwork() {
            const svg = document.getElementById('network-svg');
            svg.innerHTML = '';
            const topo = TOPOLOGIES[currentTopo];

            // Scale coordinates to SVG viewBox
            const svgRect = svg.getBoundingClientRect();
            const w = svgRect.width || 800;
            const h = svgRect.height || 460;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            // Draw edges
            topo.edges.forEach((e, idx) => {
                const from = topo.nodes.find(n => n.id === e.from);
                const to = topo.nodes.find(n => n.id === e.to);
                const sx = from.x * w / 800;
                const sy = from.y * h / 460;
                const ex = to.x * w / 800;
                const ey = to.y * h / 460;

                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', sx);
                line.setAttribute('y1', sy);
                line.setAttribute('x2', ex);
                line.setAttribute('y2', ey);
                const isCut = cutLink && ((cutLink[0] === e.from && cutLink[1] === e.to) || (cutLink[0] === e.to && cutLink[1] === e.from));
                line.setAttribute('class', isCut ? 'edge-line down' : 'edge-line');
                line.setAttribute('id', `edge-${e.from}-${e.to}`);
                svg.appendChild(line);

                // Weight label background
                const mx = (sx + ex) / 2;
                const my = (sy + ey) / 2;
                const bg = document.createElementNS(NS, 'rect');
                bg.setAttribute('x', mx - 14);
                bg.setAttribute('y', my - 12);
                bg.setAttribute('width', 28);
                bg.setAttribute('height', 24);
                bg.setAttribute('class', 'edge-weight-bg');
                svg.appendChild(bg);

                // Weight label
                const wt = document.createElementNS(NS, 'text');
                wt.setAttribute('x', mx);
                wt.setAttribute('y', my);
                wt.setAttribute('class', 'edge-weight');
                wt.textContent = e.weight;
                svg.appendChild(wt);
            });

            // Draw nodes
            topo.nodes.forEach(n => {
                const cx = n.x * w / 800;
                const cy = n.y * h / 460;

                // Selection ring
                const ring = document.createElementNS(NS, 'circle');
                ring.setAttribute('cx', cx);
                ring.setAttribute('cy', cy);
                ring.setAttribute('r', 32);
                ring.setAttribute('class', 'select-ring');
                ring.setAttribute('id', `ring-${n.id}`);
                svg.appendChild(ring);

                // Router circle
                const circle = document.createElementNS(NS, 'circle');
                circle.setAttribute('cx', cx);
                circle.setAttribute('cy', cy);
                circle.setAttribute('r', 26);
                circle.setAttribute('class', 'router-circle router-default');
                circle.setAttribute('id', `node-${n.id}`);
                circle.addEventListener('click', () => onRouterClick(n.id));
                svg.appendChild(circle);

                // Label (R1, R2, ...)
                const label = document.createElementNS(NS, 'text');
                label.setAttribute('x', cx);
                label.setAttribute('y', cy);
                label.setAttribute('class', 'router-label');
                label.textContent = n.label;
                svg.appendChild(label);

                // Name
                const name = document.createElementNS(NS, 'text');
                name.setAttribute('x', cx);
                name.setAttribute('y', cy + 42);
                name.setAttribute('class', 'router-name');
                name.textContent = n.name;
                svg.appendChild(name);
            });

            updateNodeColors();
            buildRouteSelector();
        }

        function setTopology(t) {
            document.querySelectorAll('.topo-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.topo === t);
            });
            currentTopo = t;
            cutLink = null;
            source = null;
            dest = null;
            dState = null;
            buildLinkSelector();
            renderNetwork();
            resetAlgo();
            computeAllRoutingTables();
        }

        function buildLinkSelector() {
            const sel = document.getElementById('link-select');
            if (!sel) return;
            sel.innerHTML = TOPOLOGIES[currentTopo].edges
                .map((e) => `<option value="${e.from}-${e.to}">${e.from}-${e.to} (coût ${e.weight})</option>`)
                .join('');
            updateLinkButton();
        }

        function updateLinkButton() {
            const btn = document.getElementById('btn-cut-link');
            if (btn) btn.textContent = cutLink ? `Rétablir le lien ${cutLink[0]}-${cutLink[1]}` : 'Couper ce lien';
            const sel = document.getElementById('link-select');
            if (sel) sel.disabled = Boolean(cutLink);
        }

        function toggleLink() {
            if (cutLink) {
                cutLink = null;
            } else {
                const value = document.getElementById('link-select').value;
                cutLink = value.split('-');
            }
            dState = null;
            updateLinkButton();
            renderNetwork();
            resetAlgo();
            computeAllRoutingTables();
            const feedback = document.getElementById('feedback');
            if (cutLink) {
                feedback.textContent = `Le lien ${cutLink[0]}-${cutLink[1]} est coupé : chaque routeur relance Dijkstra sur la topologie restante. Compare les tables avant et après.`;
                feedback.className = 'feedback warning';
            } else {
                feedback.textContent = 'Lien rétabli : les tables reviennent à leur état d\'origine.';
                feedback.className = 'feedback';
            }
        }

        // ============================================
        // Router selection
        // ============================================
        function onRouterClick(id) {
            if (dState && dState.finished) return;
            if (dState && !dState.finished) return; // don't change during algo

            if (!source || (source && dest)) {
                source = id;
                dest = null;
                selectMode = 'dest';
            } else if (id !== source) {
                dest = id;
                selectMode = 'source';
            }

            updateNodeColors();
            updateSelectionDisplay();

            document.getElementById('btn-step').disabled = !(source && dest);
            document.getElementById('btn-auto').disabled = !(source && dest);
        }

        function updateSelectionDisplay() {
            const topo = TOPOLOGIES[currentTopo];
            const srcNode = source ? topo.nodes.find(n => n.id === source) : null;
            const dstNode = dest ? topo.nodes.find(n => n.id === dest) : null;
            document.getElementById('sel-source').textContent = srcNode ? `${srcNode.label} (${srcNode.name})` : 'Cliquer pour choisir';
            document.getElementById('sel-dest').textContent = dstNode ? `${dstNode.label} (${dstNode.name})` : 'Cliquer pour choisir';
        }

        function updateNodeColors() {
            const topo = TOPOLOGIES[currentTopo];
            topo.nodes.forEach(n => {
                const el = document.getElementById(`node-${n.id}`);
                const ring = document.getElementById(`ring-${n.id}`);
                if (!el) return;

                el.classList.remove('router-default', 'router-source', 'router-dest', 'router-current', 'router-visited', 'router-path');
                ring.classList.remove('visible');
                ring.style.stroke = '';

                if (dState) {
                    if (dState.pathNodes && dState.pathNodes.includes(n.id)) {
                        el.classList.add('router-path');
                    } else if (n.id === dState.current) {
                        el.classList.add('router-current');
                    } else if (dState.visited.has(n.id)) {
                        el.classList.add('router-visited');
                    } else if (n.id === source) {
                        el.classList.add('router-source');
                    } else if (n.id === dest) {
                        el.classList.add('router-dest');
                    } else {
                        el.classList.add('router-default');
                    }
                } else {
                    if (n.id === source) {
                        el.classList.add('router-source');
                        ring.classList.add('visible');
                        ring.style.stroke = 'var(--primary)';
                    } else if (n.id === dest) {
                        el.classList.add('router-dest');
                        ring.classList.add('visible');
                        ring.style.stroke = 'var(--stockage)';
                    } else {
                        el.classList.add('router-default');
                    }
                }
            });
        }

        function updateEdgeColors() {
            const topo = TOPOLOGIES[currentTopo];
            topo.edges.forEach(e => {
                const el = document.getElementById(`edge-${e.from}-${e.to}`);
                if (!el) return;
                el.classList.remove('visited', 'path');

                if (dState && dState.pathEdges) {
                    const isPath = dState.pathEdges.some(pe =>
                        (pe[0] === e.from && pe[1] === e.to) || (pe[0] === e.to && pe[1] === e.from)
                    );
                    if (isPath) {
                        el.classList.add('path');
                        return;
                    }
                }
                if (dState && dState.visitedEdges) {
                    const isVisited = dState.visitedEdges.some(ve =>
                        (ve[0] === e.from && ve[1] === e.to) || (ve[0] === e.to && ve[1] === e.from)
                    );
                    if (isVisited) {
                        el.classList.add('visited');
                    }
                }
            });
        }

        // ============================================
        // Dijkstra algorithm step-by-step
        // ============================================
        function initDijkstra() {
            if (!source || !dest) return;

            dState = Routing.dijkstraInit(activeTopo(), source);
            dState.pathNodes = null;
            dState.pathEdges = null;

            updatePQTable();
            updateDistTable();
            document.getElementById('step-desc').innerHTML = `Initialisation : distance de <strong>${source}</strong> = 0, toutes les autres = infini. File de priorité : [${source}].`;
        }

        function stepDijkstra() {
            if (!dState) {
                initDijkstra();
                return;
            }

            if (dState.finished) return;

            const stepDesc = document.getElementById('step-desc');
            const event = Routing.dijkstraStep(activeTopo(), dState, dest);

            if (event.type === 'empty') {
                stepDesc.innerHTML = `La file est vide : tous les routeurs atteignables ont été traités.`;
                buildPath();
                document.getElementById('btn-step').disabled = true;
                document.getElementById('btn-auto').disabled = true;
                return;
            }

            if (event.type === 'reached') {
                stepDesc.innerHTML = `<strong>Destination ${dest} atteinte !</strong> Distance totale : <strong>${dState.dist[dest]}</strong>. Arrêt anticipé : les routeurs encore dans la file ne peuvent plus améliorer ce chemin. Reconstruction du chemin...`;
                buildPath();
                updateNodeColors();
                updateEdgeColors();
                updatePQTable();
                updateDistTable();
                document.getElementById('btn-step').disabled = true;
                document.getElementById('btn-auto').disabled = true;
                return;
            }

            const relaxStr = event.relaxed.length > 0
                ? `Mise à jour : ${event.relaxed.map(r => `${r.node} (${r.dist})`).join(', ')}`
                : `Aucun voisin à mettre à jour.`;

            stepDesc.innerHTML = `Étape ${dState.stepCount} : Traitement de <strong>${event.node}</strong> (distance : ${dState.dist[event.node]}). ${relaxStr}`;

            updateNodeColors();
            updateEdgeColors();
            updatePQTable();
            updateDistTable();
        }

        function buildPath() {
            if (!dState || !dState.finished) return;
            const { prev, dist } = dState;

            if (dist[dest] === Infinity) {
                document.getElementById('step-desc').innerHTML = `Aucun chemin trouvé entre ${source} et ${dest}.`;
                return;
            }

            const path = [];
            let current = dest;
            while (current !== null) {
                path.unshift(current);
                current = prev[current];
            }

            dState.pathNodes = path;
            dState.pathEdges = [];
            for (let i = 0; i < path.length - 1; i++) {
                dState.pathEdges.push([path[i], path[i + 1]]);
            }

            document.getElementById('step-desc').innerHTML =
                `Chemin le plus court : <strong>${path.join(' &rarr; ')}</strong> (coût total : <strong>${dist[dest]}</strong>)`;

            updateNodeColors();
            updateEdgeColors();
        }

        async function autoRun() {
            if (!dState) initDijkstra();
            document.getElementById('btn-step').disabled = true;
            document.getElementById('btn-auto').disabled = true;

            while (dState && !dState.finished) {
                stepDijkstra();
                await OEIUtils.sleep(speedCtrl.getDelay());
            }
        }

        function resetAlgo() {
            dState = null;
            lastRouteSnapshot = null;
            document.getElementById('step-desc').textContent = 'Choisis un routeur source et un routeur destination, puis clique sur « Étape suivante » pour démarrer Dijkstra.';
            document.getElementById('pq-body').innerHTML = '<tr><td colspan="2" style="color:var(--muted);">En attente...</td></tr>';
            document.getElementById('pq-count').textContent = 'vide';
            document.getElementById('dist-body').innerHTML = '<tr><td colspan="4" style="color:var(--muted);">En attente...</td></tr>';
            document.getElementById('route-body').innerHTML = '<tr><td colspan="5" style="color:var(--muted);">Choisis un routeur ci-dessus pour voir sa table.</td></tr>';
            const diffCard = document.getElementById('route-diff-card');
            const diffBody = document.getElementById('route-diff-body');
            if (diffCard) diffCard.style.display = 'none';
            if (diffBody) {
                diffBody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Coupe un lien, ou choisis un autre routeur, pour comparer.</td></tr>';
            }
            document.getElementById('feedback').textContent = '';

            document.getElementById('btn-step').disabled = !(source && dest);
            document.getElementById('btn-auto').disabled = !(source && dest);

            renderNetwork();
            computeAllRoutingTables();
        }

        // ============================================
        // Table rendering
        // ============================================
        function updatePQTable() {
            if (!dState) return;
            const { pq, visited } = dState;
            const filtered = pq.filter(e => !visited.has(e.node));
            filtered.sort((a, b) => a.dist - b.dist);

            const body = document.getElementById('pq-body');
            document.getElementById('pq-count').textContent = filtered.length + ' noeud' + (filtered.length !== 1 ? 's' : '');

            if (filtered.length === 0) {
                body.innerHTML = '<tr><td colspan="2" style="color:var(--muted);">Vide</td></tr>';
                return;
            }

            body.innerHTML = filtered.map((e, i) => `
                <tr style="${i === 0 ? 'background:var(--tone-warning-bg); color:var(--tone-warning-text); font-weight:700;' : ''}">
                    <td>${e.node}</td>
                    <td>${e.dist}</td>
                </tr>
            `).join('');
        }

        function updateDistTable() {
            if (!dState) return;
            const topo = TOPOLOGIES[currentTopo];
            const { dist, prev, visited } = dState;
            const body = document.getElementById('dist-body');

            body.innerHTML = topo.nodes.map(n => {
                const d = dist[n.id];
                const p = prev[n.id] || '-';
                const fin = visited.has(n.id);
                const isCurrent = dState.current === n.id;
                const cls = fin ? 'finalized' : (isCurrent ? 'updated' : '');
                return `<tr>
                    <td class="${cls}">${n.id}</td>
                    <td class="${cls}">${d === Infinity ? '&infin;' : d}</td>
                    <td class="${cls}">${p}</td>
                    <td class="${cls}">${fin ? 'Oui' : 'Non'}</td>
                </tr>`;
            }).join('');
        }

        // ============================================
        // Routing tables (computed for all routers)
        // ============================================
        let allRoutingTables = {};
        let baselineTables = {};
        let lastRouteSnapshot = null;

        function computeAllRoutingTables() {
            const topo = TOPOLOGIES[currentTopo];
            allRoutingTables = Routing.routingTables(activeTopo());
            baselineTables = cutLink ? Routing.routingTables(topo) : allRoutingTables;
            lastRouteSnapshot = null;
            buildRouteSelector();
            showRouteTable(topo.nodes[0].id);
        }

        function buildRouteSelector() {
            const topo = TOPOLOGIES[currentTopo];
            const sel = document.getElementById('route-selector');
            sel.innerHTML = topo.nodes.map((n, i) =>
                `<button class="route-chip ${i === 0 ? 'active' : ''}" data-inline-onclick="showRouteTable('${n.id}')">${n.label}</button>`
            ).join('');
        }

        function showRouteTable(routerId) {
            document.querySelectorAll('.route-chip').forEach(c => {
                c.classList.toggle('active', c.textContent === routerId);
            });

            const table = allRoutingTables[routerId];
            const body = document.getElementById('route-body');

            if (!table) {
                body.innerHTML = '<tr><td colspan="5" style="color:var(--muted);">Choisis un routeur ci-dessus pour voir sa table.</td></tr>';
                return;
            }

            body.innerHTML = table.map(r => `
                <tr>
                    <td>${r.dest}</td>
                    <td style="font-family:var(--font-mono); font-size:0.78rem;">${r.prefix}</td>
                    <td>${r.nextHop}</td>
                    <td>${r.cost}</td>
                    <td style="font-family:var(--font-mono); font-size:0.78rem;">${r.iface}</td>
                </tr>
            `).join('');

            renderRouteDiff(routerId, table);
        }

        function routeSignature(entry) {
            return `${entry.nextHop}|${entry.cost}|${entry.iface}`;
        }

        function renderRouteDiff(routerId, currentTable) {
            const card = document.getElementById('route-diff-card');
            const title = document.getElementById('route-diff-title');
            const body = document.getElementById('route-diff-body');
            if (!card || !title || !body) return;

            card.style.display = 'block';

            if (cutLink && baselineTables[routerId]) {
                const rows = Routing.routingDiff(baselineTables[routerId], currentTable);
                const changed = rows.filter((r) => r.status !== 'same').length;
                title.textContent = `Panne ${cutLink[0]}-${cutLink[1]} : table de ${routerId} avant et après (${changed} changement${changed > 1 ? 's' : ''})`;
                const fmt = (e) => e ? `${e.nextHop} / ${e.cost} / ${e.iface}` : '-';
                body.innerHTML = rows.map((r) => `
                    <tr>
                        <td>${r.dest}</td>
                        <td style="font-family:var(--font-mono); font-size:0.77rem;">${fmt(r.before)}</td>
                        <td style="font-family:var(--font-mono); font-size:0.77rem;">${fmt(r.after)}</td>
                        <td><span class="diff-status ${r.status}">${r.status === 'same' ? 'Identique' : 'Modifié'}</span></td>
                    </tr>
                `).join('');
                return;
            }

            if (!currentTable || !lastRouteSnapshot) {
                title.textContent = `Diff des tables de routage (${routerId})`;
                body.innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Coupe un lien, ou choisis un autre routeur, pour comparer les changements.</td></tr>';
                lastRouteSnapshot = {
                    routerId,
                    table: currentTable ? currentTable.map((r) => ({ ...r })) : []
                };
                return;
            }

            const previousByDest = {};
            lastRouteSnapshot.table.forEach((r) => { previousByDest[r.dest] = r; });

            const rows = currentTable.map((current) => {
                const before = previousByDest[current.dest];
                if (!before) {
                    return {
                        dest: current.dest,
                        before: '-',
                        after: `${current.nextHop} / ${current.cost} / ${current.iface}`,
                        status: 'new',
                        label: 'Nouveau'
                    };
                }
                const same = routeSignature(before) === routeSignature(current);
                return {
                    dest: current.dest,
                    before: `${before.nextHop} / ${before.cost} / ${before.iface}`,
                    after: `${current.nextHop} / ${current.cost} / ${current.iface}`,
                    status: same ? 'same' : 'changed',
                    label: same ? 'Identique' : 'Modifié'
                };
            });

            const changedCount = rows.filter((r) => r.status !== 'same').length;
            title.textContent = `Diff ${lastRouteSnapshot.routerId} -> ${routerId} (${changedCount} changement${changedCount > 1 ? 's' : ''})`;
            body.innerHTML = rows.map((r) => `
                <tr>
                    <td>${r.dest}</td>
                    <td style="font-family:var(--font-mono); font-size:0.77rem;">${r.before}</td>
                    <td style="font-family:var(--font-mono); font-size:0.77rem;">${r.after}</td>
                    <td><span class="diff-status ${r.status}">${r.label}</span></td>
                </tr>
            `).join('');

            lastRouteSnapshot = {
                routerId,
                table: currentTable.map((r) => ({ ...r }))
            };
        }

        speedCtrl = new OEIUtils.SpeedController('speedSlider', 'speedLabel');
        renderNetwork();
        window.addEventListener('resize', renderNetwork);
        buildLinkSelector();
        computeAllRoutingTables();
        document.getElementById('btn-cut-link').addEventListener('click', toggleLink);

        window.setTopology = setTopology;
        window.stepDijkstra = stepDijkstra;
        window.autoRun = autoRun;
        window.resetAlgo = resetAlgo;
        window.showRouteTable = showRouteTable;
    }
}

if (typeof window !== 'undefined') {
    window.RoutingSimulatorPage = RoutingSimulatorPage;
}

// ── Standalone widget ──────────────────────────────────────────
// Version compacte du simulateur ci-dessus : mêmes 3 topologies et même Dijkstra
// pas-à-pas, mais sans l'inspecteur de pseudocode (page-scoped) ni la table de
// diff entre routeurs (fonctionnalité secondaire) - même principe de coupe que
// DnsWidget/HeapWidget vis-à-vis de leur page d'origine.
class RoutingSimulatorWidget {

    static get _TOPOLOGIES() {
        return window.OEITrace.ROUTING_TOPOLOGIES;
    }

    static _NS = 'http://www.w3.org/2000/svg';

    static mount(container, config = {}) {
        if (container.dataset.rsw) return;
        container.dataset.rsw = '1';
        const w = new RoutingSimulatorWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.topo = (config.topology && RoutingSimulatorWidget._TOPOLOGIES[config.topology]) ? config.topology : 'campus';
        this.source = null;
        this.dest = null;
        this.dState = null;
        this.allRoutingTables = {};
        this._autoTimer = null;
        this._destroyed = false;
    }

    init() {
        this.root.innerHTML = `<div class="rsw-container widget-fit">
            <div class="widget-fit-header">
                <div class="rsw-topo-row">
                    ${Object.keys(RoutingSimulatorWidget._TOPOLOGIES).map((t) => (
                        `<button class="rsw-topo-btn${t === this.topo ? ' active' : ''}" data-topo="${t}">${t.charAt(0).toUpperCase()}${t.slice(1)}</button>`
                    )).join('')}
                </div>
                <div class="rsw-selection">
                    <span>Source : <strong data-sel-source>Cliquer sur un routeur</strong></span>
                    <span>Destination : <strong data-sel-dest>Cliquer sur un routeur</strong></span>
                </div>
            </div>
            <div class="widget-fit-body">
                <div class="rsw-network">
                    <svg class="rsw-svg" viewBox="0 0 800 460" role="img" aria-label="Visualisation du réseau - parcours de Dijkstra"></svg>
                </div>
                <div class="rsw-tables">
                    <table class="rsw-table" aria-label="File de priorité">
                        <thead><tr><th>Routeur</th><th>Distance</th></tr></thead>
                        <tbody data-pq-body><tr><td colspan="2" class="rsw-muted">En attente…</td></tr></tbody>
                    </table>
                    <table class="rsw-table" aria-label="Table des distances">
                        <thead><tr><th>Routeur</th><th>Dist.</th><th>Préd.</th><th>Fin.</th></tr></thead>
                        <tbody data-dist-body><tr><td colspan="4" class="rsw-muted">En attente…</td></tr></tbody>
                    </table>
                </div>
                <div class="rsw-route-section">
                    <div class="rsw-route-selector" data-route-selector></div>
                    <table class="rsw-table" aria-label="Table de routage">
                        <thead><tr><th>Destination</th><th>Préfixe</th><th>Prochain saut</th><th>Coût</th><th>Interface</th></tr></thead>
                        <tbody data-route-body><tr><td colspan="5" class="rsw-muted">Termine l'algorithme pour voir la table de routage.</td></tr></tbody>
                    </table>
                </div>
            </div>
            <div class="widget-fit-footer">
                <div class="rsw-step-desc" data-step-desc>Choisis un routeur source puis un routeur destination.</div>
                <div class="rsw-controls">
                    <button class="rsw-btn rsw-btn-primary" data-btn-step disabled>Étape suivante</button>
                    <button class="rsw-btn rsw-btn-secondary" data-btn-auto disabled>Auto</button>
                    <button class="rsw-btn rsw-btn-secondary" data-btn-reset>${OEIIcons.render('refresh')} Réinitialiser</button>
                </div>
            </div>
        </div>`;

        this._bind();
        this._renderNetwork();
    }

    _q(sel) { return this.root.querySelector(sel); }
    _qa(sel) { return this.root.querySelectorAll(sel); }

    _bind() {
        this._qa('[data-topo]').forEach((btn) => {
            btn.addEventListener('click', () => this._setTopology(btn.dataset.topo));
        });
        this._q('[data-btn-step]').addEventListener('click', () => this._stepDijkstra());
        this._q('[data-btn-auto]').addEventListener('click', () => this._autoRun());
        this._q('[data-btn-reset]').addEventListener('click', () => this._resetAlgo());
    }

    _setTopology(t) {
        if (!RoutingSimulatorWidget._TOPOLOGIES[t]) return;
        this._qa('[data-topo]').forEach((b) => b.classList.toggle('active', b.dataset.topo === t));
        this.topo = t;
        this.source = null;
        this.dest = null;
        this.dState = null;
        this._renderNetwork();
        this._resetAlgo();
    }

    _neighbors(nodeId) {
        const neighbors = [];
        RoutingSimulatorWidget._TOPOLOGIES[this.topo].edges.forEach((e) => {
            if (e.from === nodeId) neighbors.push({ node: e.to, weight: e.weight });
            if (e.to === nodeId) neighbors.push({ node: e.from, weight: e.weight });
        });
        return neighbors;
    }

    _renderNetwork() {
        const svg = this._q('.rsw-svg');
        svg.innerHTML = '';
        const NS = RoutingSimulatorWidget._NS;
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];

        topo.edges.forEach((e) => {
            const from = topo.nodes.find((n) => n.id === e.from);
            const to = topo.nodes.find((n) => n.id === e.to);
            const line = document.createElementNS(NS, 'line');
            line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
            line.setAttribute('class', 'rsw-edge-line');
            line.setAttribute('data-edge', `${e.from}-${e.to}`);
            svg.appendChild(line);

            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const bg = document.createElementNS(NS, 'rect');
            bg.setAttribute('x', mx - 14); bg.setAttribute('y', my - 12);
            bg.setAttribute('width', 28); bg.setAttribute('height', 24);
            bg.setAttribute('class', 'rsw-edge-weight-bg');
            svg.appendChild(bg);

            const wt = document.createElementNS(NS, 'text');
            wt.setAttribute('x', mx); wt.setAttribute('y', my);
            wt.setAttribute('class', 'rsw-edge-weight');
            wt.textContent = e.weight;
            svg.appendChild(wt);
        });

        topo.nodes.forEach((n) => {
            const ring = document.createElementNS(NS, 'circle');
            ring.setAttribute('cx', n.x); ring.setAttribute('cy', n.y); ring.setAttribute('r', 32);
            ring.setAttribute('class', 'rsw-select-ring');
            ring.setAttribute('data-ring', n.id);
            svg.appendChild(ring);

            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', n.x); circle.setAttribute('cy', n.y); circle.setAttribute('r', 26);
            circle.setAttribute('class', 'rsw-router-circle rsw-router-default');
            circle.setAttribute('data-node', n.id);
            circle.setAttribute('tabindex', '0');
            circle.setAttribute('role', 'button');
            circle.setAttribute('aria-label', `Routeur ${n.label} - ${n.name}`);
            circle.addEventListener('click', () => this._onRouterClick(n.id));
            circle.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this._onRouterClick(n.id); }
            });
            svg.appendChild(circle);

            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', n.x); label.setAttribute('y', n.y);
            label.setAttribute('class', 'rsw-router-label');
            label.textContent = n.label;
            svg.appendChild(label);

            const name = document.createElementNS(NS, 'text');
            name.setAttribute('x', n.x); name.setAttribute('y', n.y + 42);
            name.setAttribute('class', 'rsw-router-name');
            name.textContent = n.name;
            svg.appendChild(name);
        });

        this._updateNodeColors();
        this._buildRouteSelector();
    }

    _onRouterClick(id) {
        // Bloque la sélection pendant que Dijkstra tourne ; une fois `finished`,
        // un nouveau clic redémarre une sélection (source/dest) sur un run neuf.
        if (this.dState && !this.dState.finished) return;

        if (!this.source || (this.source && this.dest)) {
            this.source = id;
            this.dest = null;
        } else if (id !== this.source) {
            this.dest = id;
        }

        this.dState = null;
        this._updateNodeColors();
        this._updateSelectionDisplay();
        this._q('[data-btn-step]').disabled = !(this.source && this.dest);
        this._q('[data-btn-auto]').disabled = !(this.source && this.dest);
    }

    _updateSelectionDisplay() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        const srcNode = this.source ? topo.nodes.find((n) => n.id === this.source) : null;
        const dstNode = this.dest ? topo.nodes.find((n) => n.id === this.dest) : null;
        this._q('[data-sel-source]').textContent = srcNode ? `${srcNode.label} (${srcNode.name})` : 'Cliquer sur un routeur';
        this._q('[data-sel-dest]').textContent = dstNode ? `${dstNode.label} (${dstNode.name})` : 'Cliquer sur un routeur';
    }

    _updateNodeColors() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        topo.nodes.forEach((n) => {
            const el = this._q(`[data-node="${n.id}"]`);
            const ring = this._q(`[data-ring="${n.id}"]`);
            if (!el) return;
            el.classList.remove('rsw-router-default', 'rsw-router-source', 'rsw-router-dest', 'rsw-router-current', 'rsw-router-visited', 'rsw-router-path');
            ring.classList.remove('visible');

            if (this.dState) {
                if (this.dState.pathNodes && this.dState.pathNodes.includes(n.id)) el.classList.add('rsw-router-path');
                else if (n.id === this.dState.current) el.classList.add('rsw-router-current');
                else if (this.dState.visited.has(n.id)) el.classList.add('rsw-router-visited');
                else if (n.id === this.source) el.classList.add('rsw-router-source');
                else if (n.id === this.dest) el.classList.add('rsw-router-dest');
                else el.classList.add('rsw-router-default');
            } else if (n.id === this.source) {
                el.classList.add('rsw-router-source');
                ring.classList.add('visible');
            } else if (n.id === this.dest) {
                el.classList.add('rsw-router-dest');
                ring.classList.add('visible');
            } else {
                el.classList.add('rsw-router-default');
            }
        });
    }

    _updateEdgeColors() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        topo.edges.forEach((e) => {
            const el = this._q(`[data-edge="${e.from}-${e.to}"]`);
            if (!el) return;
            el.classList.remove('visited', 'path');
            if (this.dState && this.dState.pathEdges) {
                const isPath = this.dState.pathEdges.some((pe) => (pe[0] === e.from && pe[1] === e.to) || (pe[0] === e.to && pe[1] === e.from));
                if (isPath) { el.classList.add('path'); return; }
            }
            if (this.dState && this.dState.visitedEdges) {
                const isVisited = this.dState.visitedEdges.some((ve) => (ve[0] === e.from && ve[1] === e.to) || (ve[0] === e.to && ve[1] === e.from));
                if (isVisited) el.classList.add('visited');
            }
        });
    }

    _initDijkstra() {
        if (!this.source || !this.dest) return;
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        this.dState = window.OEITrace.dijkstraInit(topo, this.source);
        this.dState.pathNodes = null;
        this.dState.pathEdges = null;
        this._updatePQTable();
        this._updateDistTable();
        this._q('[data-step-desc]').innerHTML = `Initialisation : distance de <strong>${this.source}</strong> = 0, toutes les autres = infini.`;
    }

    _stepDijkstra() {
        if (!this.dState) { this._initDijkstra(); return; }
        if (this.dState.finished) return;

        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        const stepDesc = this._q('[data-step-desc]');
        const event = window.OEITrace.dijkstraStep(topo, this.dState, this.dest);

        if (event.type === 'empty') {
            stepDesc.innerHTML = `La file est vide : tous les routeurs atteignables ont été traités.`;
            this._buildPath();
            this._q('[data-btn-step]').disabled = true;
            this._q('[data-btn-auto]').disabled = true;
            return;
        }

        if (event.type === 'reached') {
            stepDesc.innerHTML = `<strong>Destination ${this.dest} atteinte !</strong> Distance totale : <strong>${this.dState.dist[this.dest]}</strong>. Arrêt anticipé : la file ne peut plus améliorer ce chemin.`;
            this._buildPath();
            this._updateNodeColors();
            this._updateEdgeColors();
            this._updatePQTable();
            this._updateDistTable();
            this._q('[data-btn-step]').disabled = true;
            this._q('[data-btn-auto]').disabled = true;
            this._computeAllRoutingTables();
            return;
        }

        const relaxStr = event.relaxed.length > 0
            ? `Mise à jour : ${event.relaxed.map((r) => `${r.node} (${r.dist})`).join(', ')}`
            : `Aucun voisin à mettre à jour.`;
        stepDesc.innerHTML = `Étape ${this.dState.stepCount} : traitement de <strong>${event.node}</strong> (distance : ${this.dState.dist[event.node]}). ${relaxStr}`;
        this._updateNodeColors();
        this._updateEdgeColors();
        this._updatePQTable();
        this._updateDistTable();
    }

    _buildPath() {
        if (!this.dState || !this.dState.finished) return;
        const { prev, dist } = this.dState;
        if (dist[this.dest] === Infinity) {
            this._q('[data-step-desc]').innerHTML = `Aucun chemin trouvé entre ${this.source} et ${this.dest}.`;
            return;
        }
        const path = [];
        let current = this.dest;
        while (current !== null) { path.unshift(current); current = prev[current]; }
        this.dState.pathNodes = path;
        this.dState.pathEdges = [];
        for (let i = 0; i < path.length - 1; i += 1) this.dState.pathEdges.push([path[i], path[i + 1]]);
        this._q('[data-step-desc]').innerHTML = `Chemin le plus court : <strong>${path.join(' &rarr; ')}</strong> (coût total : <strong>${dist[this.dest]}</strong>)`;
        this._updateNodeColors();
        this._updateEdgeColors();
    }

    async _autoRun() {
        if (!this.dState) this._initDijkstra();
        this._q('[data-btn-step]').disabled = true;
        this._q('[data-btn-auto]').disabled = true;
        while (this.dState && !this.dState.finished && !this._destroyed) {
            this._stepDijkstra();
            await new Promise((resolve) => { this._autoTimer = setTimeout(resolve, 700); });
        }
        this._autoTimer = null;
    }

    _resetAlgo() {
        if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
        this.dState = null;
        this._q('[data-step-desc]').textContent = 'Choisis un routeur source et un routeur destination, puis clique sur « Étape suivante » pour démarrer Dijkstra.';
        this._q('[data-pq-body]').innerHTML = '<tr><td colspan="2" class="rsw-muted">En attente…</td></tr>';
        this._q('[data-dist-body]').innerHTML = '<tr><td colspan="4" class="rsw-muted">En attente…</td></tr>';
        this._q('[data-route-body]').innerHTML = '<tr><td colspan="5" class="rsw-muted">Termine l\'algorithme pour voir la table de routage.</td></tr>';
        this._q('[data-btn-step]').disabled = !(this.source && this.dest);
        this._q('[data-btn-auto]').disabled = !(this.source && this.dest);
        this._renderNetwork();
    }

    _updatePQTable() {
        if (!this.dState) return;
        const { pq, visited } = this.dState;
        const filtered = pq.filter((e) => !visited.has(e.node)).sort((a, b) => a.dist - b.dist);
        const body = this._q('[data-pq-body]');
        if (filtered.length === 0) { body.innerHTML = '<tr><td colspan="2" class="rsw-muted">Vide</td></tr>'; return; }
        body.innerHTML = filtered.map((e) => `<tr><td>${e.node}</td><td>${e.dist}</td></tr>`).join('');
    }

    _updateDistTable() {
        if (!this.dState) return;
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        const { dist, prev, visited } = this.dState;
        this._q('[data-dist-body]').innerHTML = topo.nodes.map((n) => {
            const d = dist[n.id];
            const p = prev[n.id] || '-';
            const fin = visited.has(n.id);
            const cls = fin ? 'finalized' : (this.dState.current === n.id ? 'updated' : '');
            return `<tr><td class="${cls}">${n.id}</td><td class="${cls}">${d === Infinity ? '&infin;' : d}</td><td class="${cls}">${p}</td><td class="${cls}">${fin ? 'Oui' : 'Non'}</td></tr>`;
        }).join('');
    }

    _computeAllRoutingTables() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        this.allRoutingTables = window.OEITrace.routingTables(topo);
        this._showRouteTable(topo.nodes[0].id);
    }

    _buildRouteSelector() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        this._q('[data-route-selector]').innerHTML = topo.nodes.map((n, i) => (
            `<button class="rsw-route-chip${i === 0 ? ' active' : ''}" data-route="${n.id}">${n.label}</button>`
        )).join('');
        this._qa('[data-route]').forEach((btn) => {
            btn.addEventListener('click', () => this._showRouteTable(btn.dataset.route));
        });
    }

    _showRouteTable(routerId) {
        this._qa('[data-route]').forEach((c) => c.classList.toggle('active', c.dataset.route === routerId));
        const table = this.allRoutingTables[routerId];
        const body = this._q('[data-route-body]');
        if (!table) {
            body.innerHTML = '<tr><td colspan="5" class="rsw-muted">Termine l\'algorithme pour voir la table de routage.</td></tr>';
            return;
        }
        body.innerHTML = table.map((r) => (
            `<tr><td>${r.dest}</td><td class="rsw-mono">${r.prefix}</td><td>${r.nextHop}</td><td>${r.cost}</td><td class="rsw-mono">${r.iface}</td></tr>`
        )).join('');
    }

    destroy() {
        this._destroyed = true;
        if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
        if (this.root) this.root.innerHTML = '';
    }
}

if (typeof window !== 'undefined') {
    window.RoutingSimulatorWidget = RoutingSimulatorWidget;
}
