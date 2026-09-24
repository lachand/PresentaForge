class RoutingSimulatorPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        // ============================================
        // Topologies
        // ============================================
        const TOPOLOGIES = {
            campus: {
                nodes: [
                    { id: 'R1', label: 'R1', name: 'Bâtiment A', x: 120, y: 80 },
                    { id: 'R2', label: 'R2', name: 'Bâtiment B', x: 380, y: 60 },
                    { id: 'R3', label: 'R3', name: 'Serveurs', x: 650, y: 100 },
                    { id: 'R4', label: 'R4', name: 'Bâtiment C', x: 120, y: 340 },
                    { id: 'R5', label: 'R5', name: 'Coeur réseau', x: 380, y: 230 },
                    { id: 'R6', label: 'R6', name: 'Bâtiment D', x: 650, y: 350 },
                    { id: 'R7', label: 'R7', name: 'Passerelle', x: 380, y: 400 }
                ],
                edges: [
                    { from: 'R1', to: 'R2', weight: 4 },
                    { from: 'R1', to: 'R4', weight: 2 },
                    { from: 'R1', to: 'R5', weight: 5 },
                    { from: 'R2', to: 'R3', weight: 3 },
                    { from: 'R2', to: 'R5', weight: 1 },
                    { from: 'R3', to: 'R6', weight: 6 },
                    { from: 'R4', to: 'R5', weight: 3 },
                    { from: 'R4', to: 'R7', weight: 4 },
                    { from: 'R5', to: 'R6', weight: 2 },
                    { from: 'R5', to: 'R7', weight: 3 },
                    { from: 'R6', to: 'R7', weight: 5 }
                ]
            },
            entreprise: {
                nodes: [
                    { id: 'R1', label: 'R1', name: 'Accueil', x: 100, y: 200 },
                    { id: 'R2', label: 'R2', name: 'Étage 1', x: 280, y: 80 },
                    { id: 'R3', label: 'R3', name: 'Étage 2', x: 280, y: 340 },
                    { id: 'R4', label: 'R4', name: 'Data Center', x: 500, y: 80 },
                    { id: 'R5', label: 'R5', name: 'DMZ', x: 500, y: 340 },
                    { id: 'R6', label: 'R6', name: 'Firewall', x: 700, y: 200 }
                ],
                edges: [
                    { from: 'R1', to: 'R2', weight: 2 },
                    { from: 'R1', to: 'R3', weight: 3 },
                    { from: 'R2', to: 'R3', weight: 5 },
                    { from: 'R2', to: 'R4', weight: 1 },
                    { from: 'R3', to: 'R5', weight: 2 },
                    { from: 'R4', to: 'R5', weight: 4 },
                    { from: 'R4', to: 'R6', weight: 3 },
                    { from: 'R5', to: 'R6', weight: 1 },
                    { from: 'R1', to: 'R6', weight: 10 }
                ]
            },
            internet: {
                nodes: [
                    { id: 'R1', label: 'R1', name: 'Paris', x: 180, y: 120 },
                    { id: 'R2', label: 'R2', name: 'Londres', x: 120, y: 300 },
                    { id: 'R3', label: 'R3', name: 'Berlin', x: 440, y: 60 },
                    { id: 'R4', label: 'R4', name: 'Madrid', x: 350, y: 350 },
                    { id: 'R5', label: 'R5', name: 'Rome', x: 600, y: 280 },
                    { id: 'R6', label: 'R6', name: 'Amsterdam', x: 350, y: 180 },
                    { id: 'R7', label: 'R7', name: 'Zurich', x: 650, y: 100 }
                ],
                edges: [
                    { from: 'R1', to: 'R2', weight: 3 },
                    { from: 'R1', to: 'R6', weight: 2 },
                    { from: 'R1', to: 'R3', weight: 7 },
                    { from: 'R2', to: 'R4', weight: 8 },
                    { from: 'R2', to: 'R6', weight: 4 },
                    { from: 'R3', to: 'R6', weight: 3 },
                    { from: 'R3', to: 'R7', weight: 2 },
                    { from: 'R4', to: 'R5', weight: 5 },
                    { from: 'R4', to: 'R6', weight: 6 },
                    { from: 'R5', to: 'R7', weight: 3 },
                    { from: 'R5', to: 'R6', weight: 4 },
                    { from: 'R6', to: 'R7', weight: 5 }
                ]
            }
        };

        // ============================================
        // State
        // ============================================
        let currentTopo = 'campus';
        let source = null;
        let dest = null;
        let selectMode = 'source'; // 'source' or 'dest'

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
                line.setAttribute('class', 'edge-line');
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
            source = null;
            dest = null;
            dState = null;
            renderNetwork();
            resetAlgo();
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
                        ring.style.stroke = '#be185d';
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
        function getNeighbors(nodeId) {
            const topo = TOPOLOGIES[currentTopo];
            const neighbors = [];
            topo.edges.forEach(e => {
                if (e.from === nodeId) neighbors.push({ node: e.to, weight: e.weight });
                if (e.to === nodeId) neighbors.push({ node: e.from, weight: e.weight });
            });
            return neighbors;
        }

        function initDijkstra() {
            if (!source || !dest) return;

            const topo = TOPOLOGIES[currentTopo];
            const dist = {};
            const prev = {};
            const visited = new Set();
            const pq = [];
            const visitedEdges = [];

            topo.nodes.forEach(n => {
                dist[n.id] = Infinity;
                prev[n.id] = null;
            });
            dist[source] = 0;
            pq.push({ node: source, dist: 0 });

            dState = {
                dist, prev, visited, pq, visitedEdges,
                current: null, finished: false,
                pathNodes: null, pathEdges: null,
                stepCount: 0
            };

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

            const { dist, prev, visited, pq, visitedEdges } = dState;
            const stepDesc = document.getElementById('step-desc');

            // Find min in PQ
            if (pq.length === 0) {
                dState.finished = true;
                stepDesc.innerHTML = `L'algorithme est terminé. Aucun chemin supplémentaire à explorer.`;
                buildPath();
                document.getElementById('btn-step').disabled = true;
                document.getElementById('btn-auto').disabled = true;
                return;
            }

            // Sort PQ and extract min
            pq.sort((a, b) => a.dist - b.dist);
            const current = pq.shift();

            if (visited.has(current.node)) {
                // Skip already visited
                stepDijkstra();
                return;
            }

            dState.current = current.node;
            visited.add(current.node);
            dState.stepCount++;

            // Check if we reached destination
            if (current.node === dest) {
                dState.finished = true;
                stepDesc.innerHTML = `<strong>Destination ${dest} atteinte !</strong> Distance totale : <strong>${dist[dest]}</strong>. Reconstruction du chemin...`;
                buildPath();
                updateNodeColors();
                updateEdgeColors();
                updatePQTable();
                updateDistTable();
                document.getElementById('btn-step').disabled = true;
                document.getElementById('btn-auto').disabled = true;
                computeAllRoutingTables();
                return;
            }

            // Relax neighbors
            const neighbors = getNeighbors(current.node);
            let relaxedInfo = [];

            neighbors.forEach(nb => {
                if (visited.has(nb.node)) return;
                const newDist = dist[current.node] + nb.weight;
                visitedEdges.push([current.node, nb.node]);
                if (newDist < dist[nb.node]) {
                    dist[nb.node] = newDist;
                    prev[nb.node] = current.node;
                    pq.push({ node: nb.node, dist: newDist });
                    relaxedInfo.push(`${nb.node} (${newDist})`);
                }
            });

            const relaxStr = relaxedInfo.length > 0
                ? `Mise à jour : ${relaxedInfo.join(', ')}`
                : `Aucun voisin à mettre à jour.`;

            stepDesc.innerHTML = `Étape ${dState.stepCount} : Traitement de <strong>${current.node}</strong> (distance : ${dist[current.node]}). ${relaxStr}`;

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
            document.getElementById('step-desc').textContent = 'Sélectionnez un routeur source et un routeur destination, puis cliquez sur "Etape suivante" pour démarrer Dijkstra.';
            document.getElementById('pq-body').innerHTML = '<tr><td colspan="2" style="color:var(--muted);">En attente...</td></tr>';
            document.getElementById('pq-count').textContent = 'vide';
            document.getElementById('dist-body').innerHTML = '<tr><td colspan="4" style="color:var(--muted);">En attente...</td></tr>';
            document.getElementById('route-body').innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Terminez l\'algorithme pour voir les tables de routage.</td></tr>';
            const diffCard = document.getElementById('route-diff-card');
            const diffBody = document.getElementById('route-diff-body');
            if (diffCard) diffCard.style.display = 'none';
            if (diffBody) {
                diffBody.innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Sélectionnez un autre routeur pour comparer.</td></tr>';
            }
            document.getElementById('feedback').textContent = '';

            document.getElementById('btn-step').disabled = !(source && dest);
            document.getElementById('btn-auto').disabled = !(source && dest);

            renderNetwork();
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
        function dijkstraFull(srcId) {
            const topo = TOPOLOGIES[currentTopo];
            const dist = {};
            const prev = {};
            const visited = new Set();
            const pq = [];

            topo.nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
            dist[srcId] = 0;
            pq.push({ node: srcId, dist: 0 });

            while (pq.length > 0) {
                pq.sort((a, b) => a.dist - b.dist);
                const current = pq.shift();
                if (visited.has(current.node)) continue;
                visited.add(current.node);

                getNeighbors(current.node).forEach(nb => {
                    if (visited.has(nb.node)) return;
                    const newDist = dist[current.node] + nb.weight;
                    if (newDist < dist[nb.node]) {
                        dist[nb.node] = newDist;
                        prev[nb.node] = current.node;
                        pq.push({ node: nb.node, dist: newDist });
                    }
                });
            }

            return { dist, prev };
        }

        let allRoutingTables = {};
        let lastRouteSnapshot = null;

        function computeAllRoutingTables() {
            const topo = TOPOLOGIES[currentTopo];
            allRoutingTables = {};
            lastRouteSnapshot = null;
            topo.nodes.forEach(n => {
                const result = dijkstraFull(n.id);
                const table = [];
                topo.nodes.forEach(dest => {
                    if (dest.id === n.id) return;
                    // Determine next hop
                    let path = [];
                    let cur = dest.id;
                    while (cur !== null) {
                        path.unshift(cur);
                        cur = result.prev[cur];
                    }
                    const nextHop = path.length >= 2 ? path[1] : '-';
                    table.push({
                        dest: dest.id,
                        nextHop: nextHop,
                        cost: result.dist[dest.id] === Infinity ? '-' : result.dist[dest.id],
                        iface: nextHop !== '-' ? `eth-${nextHop.toLowerCase()}` : '-'
                    });
                });
                allRoutingTables[n.id] = table;
            });

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
                body.innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Terminez l\'algorithme pour voir les tables de routage.</td></tr>';
                return;
            }

            body.innerHTML = table.map(r => `
                <tr>
                    <td>${r.dest}</td>
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

            if (!currentTable || !lastRouteSnapshot) {
                title.textContent = `Diff des tables de routage (${routerId})`;
                body.innerHTML = '<tr><td colspan="4" style="color:var(--muted);">Sélectionnez un autre routeur pour comparer les changements.</td></tr>';
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
                        before: '—',
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
// diff entre routeurs (fonctionnalité secondaire) — même principe de coupe que
// DnsWidget/HeapWidget vis-à-vis de leur page d'origine.
class RoutingSimulatorWidget {

    static _TOPOLOGIES = {
        campus: {
            nodes: [
                { id: 'R1', label: 'R1', name: 'Bâtiment A', x: 120, y: 80 },
                { id: 'R2', label: 'R2', name: 'Bâtiment B', x: 380, y: 60 },
                { id: 'R3', label: 'R3', name: 'Serveurs', x: 650, y: 100 },
                { id: 'R4', label: 'R4', name: 'Bâtiment C', x: 120, y: 340 },
                { id: 'R5', label: 'R5', name: 'Coeur réseau', x: 380, y: 230 },
                { id: 'R6', label: 'R6', name: 'Bâtiment D', x: 650, y: 350 },
                { id: 'R7', label: 'R7', name: 'Passerelle', x: 380, y: 400 }
            ],
            edges: [
                { from: 'R1', to: 'R2', weight: 4 }, { from: 'R1', to: 'R4', weight: 2 },
                { from: 'R1', to: 'R5', weight: 5 }, { from: 'R2', to: 'R3', weight: 3 },
                { from: 'R2', to: 'R5', weight: 1 }, { from: 'R3', to: 'R6', weight: 6 },
                { from: 'R4', to: 'R5', weight: 3 }, { from: 'R4', to: 'R7', weight: 4 },
                { from: 'R5', to: 'R6', weight: 2 }, { from: 'R5', to: 'R7', weight: 3 },
                { from: 'R6', to: 'R7', weight: 5 }
            ]
        },
        entreprise: {
            nodes: [
                { id: 'R1', label: 'R1', name: 'Accueil', x: 100, y: 200 },
                { id: 'R2', label: 'R2', name: 'Étage 1', x: 280, y: 80 },
                { id: 'R3', label: 'R3', name: 'Étage 2', x: 280, y: 340 },
                { id: 'R4', label: 'R4', name: 'Data Center', x: 500, y: 80 },
                { id: 'R5', label: 'R5', name: 'DMZ', x: 500, y: 340 },
                { id: 'R6', label: 'R6', name: 'Firewall', x: 700, y: 200 }
            ],
            edges: [
                { from: 'R1', to: 'R2', weight: 2 }, { from: 'R1', to: 'R3', weight: 3 },
                { from: 'R2', to: 'R3', weight: 5 }, { from: 'R2', to: 'R4', weight: 1 },
                { from: 'R3', to: 'R5', weight: 2 }, { from: 'R4', to: 'R5', weight: 4 },
                { from: 'R4', to: 'R6', weight: 3 }, { from: 'R5', to: 'R6', weight: 1 },
                { from: 'R1', to: 'R6', weight: 10 }
            ]
        },
        internet: {
            nodes: [
                { id: 'R1', label: 'R1', name: 'Paris', x: 180, y: 120 },
                { id: 'R2', label: 'R2', name: 'Londres', x: 120, y: 300 },
                { id: 'R3', label: 'R3', name: 'Berlin', x: 440, y: 60 },
                { id: 'R4', label: 'R4', name: 'Madrid', x: 350, y: 350 },
                { id: 'R5', label: 'R5', name: 'Rome', x: 600, y: 280 },
                { id: 'R6', label: 'R6', name: 'Amsterdam', x: 350, y: 180 },
                { id: 'R7', label: 'R7', name: 'Zurich', x: 650, y: 100 }
            ],
            edges: [
                { from: 'R1', to: 'R2', weight: 3 }, { from: 'R1', to: 'R6', weight: 2 },
                { from: 'R1', to: 'R3', weight: 7 }, { from: 'R2', to: 'R4', weight: 8 },
                { from: 'R2', to: 'R6', weight: 4 }, { from: 'R3', to: 'R6', weight: 3 },
                { from: 'R3', to: 'R7', weight: 2 }, { from: 'R4', to: 'R5', weight: 5 },
                { from: 'R4', to: 'R6', weight: 6 }, { from: 'R5', to: 'R7', weight: 3 },
                { from: 'R5', to: 'R6', weight: 4 }, { from: 'R6', to: 'R7', weight: 5 }
            ]
        }
    };

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
        this.root.innerHTML = `<div class="rsw-container">
            <div class="rsw-topo-row">
                ${Object.keys(RoutingSimulatorWidget._TOPOLOGIES).map((t) => (
                    `<button class="rsw-topo-btn${t === this.topo ? ' active' : ''}" data-topo="${t}">${t.charAt(0).toUpperCase()}${t.slice(1)}</button>`
                )).join('')}
            </div>
            <div class="rsw-selection">
                <span>Source : <strong data-sel-source>Cliquer sur un routeur</strong></span>
                <span>Destination : <strong data-sel-dest>Cliquer sur un routeur</strong></span>
            </div>
            <div class="rsw-network">
                <svg class="rsw-svg" viewBox="0 0 800 460" role="img" aria-label="Visualisation du réseau — parcours de Dijkstra"></svg>
            </div>
            <div class="rsw-step-desc" data-step-desc>Sélectionnez un routeur source puis un routeur destination.</div>
            <div class="rsw-controls">
                <button class="rsw-btn rsw-btn-primary" data-btn-step disabled>Étape suivante</button>
                <button class="rsw-btn rsw-btn-secondary" data-btn-auto disabled>Auto</button>
                <button class="rsw-btn rsw-btn-secondary" data-btn-reset>↺ Réinitialiser</button>
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
                    <thead><tr><th>Destination</th><th>Prochain saut</th><th>Coût</th><th>Interface</th></tr></thead>
                    <tbody data-route-body><tr><td colspan="4" class="rsw-muted">Terminez l'algorithme pour voir la table de routage.</td></tr></tbody>
                </table>
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
            circle.setAttribute('aria-label', `Routeur ${n.label} — ${n.name}`);
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
        const dist = {}; const prev = {};
        topo.nodes.forEach((n) => { dist[n.id] = Infinity; prev[n.id] = null; });
        dist[this.source] = 0;

        this.dState = {
            dist, prev, visited: new Set(), pq: [{ node: this.source, dist: 0 }], visitedEdges: [],
            current: null, finished: false, pathNodes: null, pathEdges: null, stepCount: 0
        };
        this._updatePQTable();
        this._updateDistTable();
        this._q('[data-step-desc]').innerHTML = `Initialisation : distance de <strong>${this.source}</strong> = 0, toutes les autres = infini.`;
    }

    _stepDijkstra() {
        if (!this.dState) { this._initDijkstra(); return; }
        if (this.dState.finished) return;

        const { dist, prev, visited, pq, visitedEdges } = this.dState;
        const stepDesc = this._q('[data-step-desc]');

        if (pq.length === 0) {
            this.dState.finished = true;
            stepDesc.innerHTML = `L'algorithme est terminé. Aucun chemin supplémentaire à explorer.`;
            this._buildPath();
            this._q('[data-btn-step]').disabled = true;
            this._q('[data-btn-auto]').disabled = true;
            return;
        }

        pq.sort((a, b) => a.dist - b.dist);
        const current = pq.shift();
        if (visited.has(current.node)) { this._stepDijkstra(); return; }

        this.dState.current = current.node;
        visited.add(current.node);
        this.dState.stepCount += 1;

        if (current.node === this.dest) {
            this.dState.finished = true;
            stepDesc.innerHTML = `<strong>Destination ${this.dest} atteinte !</strong> Distance totale : <strong>${dist[this.dest]}</strong>.`;
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

        const relaxed = [];
        this._neighbors(current.node).forEach((nb) => {
            if (visited.has(nb.node)) return;
            const newDist = dist[current.node] + nb.weight;
            visitedEdges.push([current.node, nb.node]);
            if (newDist < dist[nb.node]) {
                dist[nb.node] = newDist;
                prev[nb.node] = current.node;
                pq.push({ node: nb.node, dist: newDist });
                relaxed.push(`${nb.node} (${newDist})`);
            }
        });

        const relaxStr = relaxed.length > 0 ? `Mise à jour : ${relaxed.join(', ')}` : `Aucun voisin à mettre à jour.`;
        stepDesc.innerHTML = `Étape ${this.dState.stepCount} : traitement de <strong>${current.node}</strong> (distance : ${dist[current.node]}). ${relaxStr}`;
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
        this._q('[data-step-desc]').textContent = 'Sélectionnez un routeur source et un routeur destination, puis cliquez sur "Étape suivante" pour démarrer Dijkstra.';
        this._q('[data-pq-body]').innerHTML = '<tr><td colspan="2" class="rsw-muted">En attente…</td></tr>';
        this._q('[data-dist-body]').innerHTML = '<tr><td colspan="4" class="rsw-muted">En attente…</td></tr>';
        this._q('[data-route-body]').innerHTML = '<tr><td colspan="4" class="rsw-muted">Terminez l\'algorithme pour voir la table de routage.</td></tr>';
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

    _dijkstraFull(srcId) {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        const dist = {}; const prev = {}; const visited = new Set(); const pq = [];
        topo.nodes.forEach((n) => { dist[n.id] = Infinity; prev[n.id] = null; });
        dist[srcId] = 0;
        pq.push({ node: srcId, dist: 0 });
        while (pq.length > 0) {
            pq.sort((a, b) => a.dist - b.dist);
            const current = pq.shift();
            if (visited.has(current.node)) continue;
            visited.add(current.node);
            this._neighbors(current.node).forEach((nb) => {
                if (visited.has(nb.node)) return;
                const newDist = dist[current.node] + nb.weight;
                if (newDist < dist[nb.node]) { dist[nb.node] = newDist; prev[nb.node] = current.node; pq.push({ node: nb.node, dist: newDist }); }
            });
        }
        return { dist, prev };
    }

    _computeAllRoutingTables() {
        const topo = RoutingSimulatorWidget._TOPOLOGIES[this.topo];
        this.allRoutingTables = {};
        topo.nodes.forEach((n) => {
            const result = this._dijkstraFull(n.id);
            const table = [];
            topo.nodes.forEach((d) => {
                if (d.id === n.id) return;
                const path = [];
                let cur = d.id;
                while (cur !== null) { path.unshift(cur); cur = result.prev[cur]; }
                const nextHop = path.length >= 2 ? path[1] : '-';
                table.push({
                    dest: d.id, nextHop,
                    cost: result.dist[d.id] === Infinity ? '-' : result.dist[d.id],
                    iface: nextHop !== '-' ? `eth-${nextHop.toLowerCase()}` : '-'
                });
            });
            this.allRoutingTables[n.id] = table;
        });
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
            body.innerHTML = '<tr><td colspan="4" class="rsw-muted">Terminez l\'algorithme pour voir la table de routage.</td></tr>';
            return;
        }
        body.innerHTML = table.map((r) => (
            `<tr><td>${r.dest}</td><td>${r.nextHop}</td><td>${r.cost}</td><td class="rsw-mono">${r.iface}</td></tr>`
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
