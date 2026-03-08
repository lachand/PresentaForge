/**
 * GitDAGWidget — visualisation SVG d'un graphe de commits Git.
 *
 * Reçoit la définition du DAG via la config JSON (passée depuis le bloc widget).
 * Réutilisable sur toutes les pages de la série Git.
 *
 * Config attendue (depuis le JSON) :
 *   commits   : [{ id, message, parents[] }]
 *   branches  : [{ name, commit, color }]
 *   head      : nom de branche ou hash de commit
 */
class GitDAGWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitDAGWidget._stylesInjected) return;
        GitDAGWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gdw-root { font-family: var(--font); }
.gdw-svg-wrap {
    overflow-x: auto;
    overflow-y: hidden;
    border-radius: var(--radius);
    background: var(--bg);
    border: 1px solid var(--border);
    padding: 1rem 1.5rem;
}
.gdw-svg { display: block; margin: 0 auto; }
.gdw-commit-circle {
    fill: var(--card);
    stroke-width: 2.5;
    cursor: pointer;
    transition: r 0.15s;
}
.gdw-commit-circle:hover { r: 18; }
.gdw-commit-hash {
    font-family: var(--font-mono);
    font-size: 10px;
    fill: #6b7280;
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
}
.gdw-commit-msg {
    font-size: 11px;
    fill: var(--text, #1f2937);
    text-anchor: middle;
    pointer-events: none;
    user-select: none;
}
.gdw-edge {
    fill: none;
    stroke-width: 2;
    stroke: #d1d5db;
}
.gdw-branch-label {
    font-size: 11px;
    font-weight: 700;
    pointer-events: none;
    user-select: none;
}
.gdw-head-label {
    font-size: 10px;
    font-weight: 700;
    fill: #dc2626;
    pointer-events: none;
    user-select: none;
}
.gdw-tooltip {
    position: absolute;
    background: var(--card, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.78rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    pointer-events: none;
    max-width: 260px;
    z-index: 100;
    transition: opacity 0.15s;
}
.gdw-tooltip-hash { font-family: var(--font-mono); font-weight: 700; color: var(--primary, #4f46e5); }
.gdw-tooltip-msg  { color: var(--text); margin-top: 0.2rem; }
.gdw-tooltip-parents { font-size: 0.72rem; color: var(--muted); margin-top: 0.2rem; }
.gdw-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-top: 0.75rem;
    font-size: 0.78rem;
}
.gdw-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.gdw-legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
}
        `;
        document.head.appendChild(style);
    }

    /* Calcule les positions X/Y de chaque commit (layout topologique gauche→droite). */
    static _layout(commits) {
        // Construire une map id → commit
        const byId = {};
        commits.forEach(c => { byId[c.id] = c; });

        // Tri topologique (Kahn)
        const inDegree = {};
        commits.forEach(c => { inDegree[c.id] = 0; });
        commits.forEach(c => c.parents.forEach(p => { if (byId[p]) inDegree[c.id]++; }));

        const queue = commits.filter(c => inDegree[c.id] === 0).map(c => c.id);
        const order = [];
        const children = {};
        commits.forEach(c => { children[c.id] = []; });
        commits.forEach(c => c.parents.forEach(p => { if (byId[p]) children[p].push(c.id); }));

        while (queue.length) {
            const id = queue.shift();
            order.push(id);
            children[id].forEach(child => {
                inDegree[child]--;
                if (inDegree[child] === 0) queue.push(child);
            });
        }

        // Assigner les colonnes (x) : colonne = max(colonne parent) + 1
        const col = {};
        order.forEach(id => {
            const c = byId[id];
            col[id] = c.parents.length === 0 ? 0
                : Math.max(...c.parents.filter(p => byId[p]).map(p => col[p])) + 1;
        });

        // Assigner les lignes (y) par colonne, en essayant de minimiser les croisements
        const rowByCol = {};
        const row = {};
        order.forEach(id => {
            const c = col[id];
            if (rowByCol[c] === undefined) rowByCol[c] = 0;
            row[id] = rowByCol[c]++;
        });

        // Dimensionner
        const CX = 140, CY = 70, PAD_X = 60, PAD_Y = 50;
        const positions = {};
        order.forEach(id => {
            positions[id] = {
                x: PAD_X + col[id] * CX,
                y: PAD_Y + row[id] * CY
            };
        });

        const maxX = Math.max(...Object.values(positions).map(p => p.x)) + PAD_X + 20;
        const maxY = Math.max(...Object.values(positions).map(p => p.y)) + PAD_Y + 20;

        return { positions, width: Math.max(maxX, 300), height: Math.max(maxY, 120) };
    }

    static mount(container, config = {}) {
        GitDAGWidget.ensureStyles();

        const commits  = Array.isArray(config.commits)  ? config.commits  : [];
        const branches = Array.isArray(config.branches) ? config.branches : [];
        const headRef  = config.head || null;

        if (!commits.length) {
            container.innerHTML = '<p class="section-description">GitDAGWidget : aucun commit fourni.</p>';
            return { destroy() {} };
        }

        const { positions, width, height } = GitDAGWidget._layout(commits);
        const byId = {};
        commits.forEach(c => { byId[c.id] = c; });

        // Branche → couleur
        const branchColor = {};
        branches.forEach(b => { branchColor[b.name] = b.color || '#4f46e5'; });

        // Commit → branches qui pointent dessus
        const commitBranches = {};
        branches.forEach(b => {
            if (!commitBranches[b.commit]) commitBranches[b.commit] = [];
            commitBranches[b.commit].push(b);
        });

        // HEAD résolu
        let headCommitId = null;
        if (headRef) {
            const matchBranch = branches.find(b => b.name === headRef);
            headCommitId = matchBranch ? matchBranch.commit : headRef;
        }

        const R = 16; // rayon des cercles commit

        // Couleur d'un commit : couleur de la première branche qui pointe dessus, sinon gris
        const commitColor = (id) => {
            if (commitBranches[id]?.length) return commitBranches[id][0].color || '#4f46e5';
            // Héritage de couleur depuis les enfants
            return '#6b7280';
        };

        // Construire le SVG
        let svgContent = '';

        // Arêtes
        commits.forEach(c => {
            const pos = positions[c.id];
            if (!pos) return;
            c.parents.forEach(pid => {
                const ppos = positions[pid];
                if (!ppos) return;
                // Courbe de Bézier si les lignes sont sur des rangées différentes
                const dx = pos.x - ppos.x;
                const dy = pos.y - ppos.y;
                if (dy === 0) {
                    svgContent += `<line class="gdw-edge" x1="${ppos.x + R}" y1="${ppos.y}" x2="${pos.x - R}" y2="${pos.y}"/>`;
                } else {
                    const mx = (ppos.x + pos.x) / 2;
                    svgContent += `<path class="gdw-edge" d="M${ppos.x + R},${ppos.y} C${mx},${ppos.y} ${mx},${pos.y} ${pos.x - R},${pos.y}"/>`;
                }
            });
        });

        // Nœuds commits
        commits.forEach(c => {
            const pos = positions[c.id];
            if (!pos) return;
            const color = commitColor(c.id);
            const isHead = c.id === headCommitId;
            svgContent += `
            <g class="gdw-commit-node" data-id="${c.id}" style="cursor:pointer">
                <circle class="gdw-commit-circle"
                    cx="${pos.x}" cy="${pos.y}" r="${R}"
                    stroke="${color}"
                    ${isHead ? `fill="#fef2f2"` : ''}/>
                <text class="gdw-commit-hash" x="${pos.x}" y="${pos.y + 4}">${c.id.substring(0, 6)}</text>
            </g>`;

            // Message sous le nœud
            svgContent += `<text class="gdw-commit-msg" x="${pos.x}" y="${pos.y + R + 14}">${GitDAGWidget._truncate(c.message, 20)}</text>`;
        });

        // Labels de branches
        branches.forEach(b => {
            const pos = positions[b.commit];
            if (!pos) return;
            const isHead = b.name === headRef;
            const yOff = pos.y - R - (isHead ? 28 : 14);
            svgContent += `<text class="gdw-branch-label" x="${pos.x}" y="${yOff}"
                text-anchor="middle" fill="${b.color || '#4f46e5'}">${b.name}</text>`;
            if (isHead) {
                svgContent += `<text class="gdw-head-label" x="${pos.x}" y="${yOff - 12}" text-anchor="middle">HEAD →</text>`;
            }
        });

        // Légende
        const legendItems = branches.map(b =>
            `<div class="gdw-legend-item">
                <div class="gdw-legend-dot" style="background:${b.color};border-color:${b.color}"></div>
                <span>${b.name}</span>
            </div>`
        ).join('');

        container.innerHTML = `
<div class="gdw-root">
  <div class="gdw-svg-wrap" style="position:relative">
    <svg class="gdw-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${svgContent}
    </svg>
    <div class="gdw-tooltip" id="gdw-tip" style="opacity:0;top:0;left:0"></div>
  </div>
  ${legendItems ? `<div class="gdw-legend">${legendItems}</div>` : ''}
</div>`;

        // Tooltip au survol
        const tooltip = container.querySelector('#gdw-tip');
        container.querySelectorAll('.gdw-commit-node').forEach(node => {
            const id = node.dataset.id;
            const c = byId[id];
            if (!c || !tooltip) return;
            node.addEventListener('mouseenter', (e) => {
                const parentNames = c.parents.map(p => byId[p]?.id?.substring(0, 6) || p).join(', ') || '—';
                tooltip.innerHTML = `
                    <div class="gdw-tooltip-hash">${c.id.substring(0, 6)}</div>
                    <div class="gdw-tooltip-msg">${c.message}</div>
                    <div class="gdw-tooltip-parents">Parents : ${parentNames}</div>`;
                tooltip.style.opacity = '1';
                const rect = container.querySelector('.gdw-svg-wrap').getBoundingClientRect();
                const nr = node.getBoundingClientRect();
                tooltip.style.left = (nr.left - rect.left + 20) + 'px';
                tooltip.style.top  = (nr.top  - rect.top  - 10) + 'px';
            });
            node.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
        });

        return { destroy() { container.innerHTML = ''; } };
    }

    static _truncate(str, max) {
        return str.length <= max ? str : str.substring(0, max - 1) + '…';
    }
}
window.GitDAGWidget = GitDAGWidget;
