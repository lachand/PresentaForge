/**
 * GitHubPRLifecycleWidget — diagramme d'états du cycle de vie d'une Pull Request GitHub.
 *
 * Affiche l'état courant de la PR, les transitions disponibles, un historique
 * et un graphe SVG lisible de tous les états.
 */
class GitHubPRLifecycleWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitHubPRLifecycleWidget._stylesInjected) return;
        GitHubPRLifecycleWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.prlw-root {
    font-family: var(--font);
    color: var(--text);
}
.prlw-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 1.25rem;
    align-items: start;
}
@media (max-width: 720px) {
    .prlw-layout { grid-template-columns: 1fr; }
}
.prlw-state-card {
    border-radius: var(--radius);
    padding: 1.25rem 1.5rem;
    text-align: center;
    margin-bottom: 1rem;
    border: 2px solid transparent;
    transition: background 0.3s, border-color 0.3s;
}
.prlw-state-badge {
    display: inline-block;
    font-size: 1.2rem;
    font-weight: 800;
    padding: 0.35rem 1.1rem;
    border-radius: 2rem;
    color: #fff;
    letter-spacing: 0.03em;
    margin-bottom: 0.65rem;
}
.prlw-state-desc {
    font-size: 0.87rem;
    color: var(--muted);
    line-height: 1.5;
}
.prlw-actions { margin-bottom: 1rem; }
.prlw-actions-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.55rem;
}
.prlw-actions-btns { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.prlw-btn {
    padding: 0.42rem 0.95rem;
    border-radius: var(--radius-sm);
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    background: var(--primary, #4f46e5);
    color: #fff;
    transition: opacity 0.15s, transform 0.1s;
}
.prlw-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.prlw-btn-danger { background: #ef4444; }
.prlw-btn-reset {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    font-size: 0.78rem;
    padding: 0.32rem 0.75rem;
    margin-top: 0.5rem;
}
.prlw-success-msg {
    background: #ecfdf5;
    border: 1.5px solid #10b981;
    border-radius: var(--radius-sm);
    padding: 0.85rem 1.1rem;
    color: #065f46;
    font-size: 0.87rem;
    font-weight: 600;
    text-align: center;
}
.prlw-timeline {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 0.7rem 0.9rem;
    max-height: 175px;
    overflow-y: auto;
}
.prlw-timeline-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.45rem;
}
.prlw-tl-item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.28rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.8rem;
}
.prlw-tl-item:last-child { border-bottom: none; }
.prlw-tl-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.prlw-tl-time { font-size: 0.7rem; color: var(--muted); font-family: var(--font-mono); white-space: nowrap; }
.prlw-graph-panel {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 0.75rem 0.5rem 0.5rem;
}
.prlw-graph-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.5rem;
    text-align: center;
}
.prlw-graph-svg { display: block; margin: 0 auto; overflow: visible; }
`;
        document.head.appendChild(style);
    }

    static STATES = {
        brouillon: {
            id: 'brouillon',
            label: 'Brouillon',
            color: '#6b7280',
            desc: 'La PR est en cours de rédaction (Draft), pas encore prête pour review.',
        },
        ouverte: {
            id: 'ouverte',
            label: 'Ouverte',
            color: '#4f46e5',
            desc: 'La PR est soumise et attend des reviewers.',
        },
        en_revision: {
            id: 'en_revision',
            label: 'En révision',
            color: '#f59e0b',
            desc: 'Un ou plusieurs reviewers examinent le code.',
        },
        modifs_demandees: {
            id: 'modifs_demandees',
            label: 'Modifications demandées',
            color: '#ef4444',
            desc: 'Le reviewer a demandé des changements. L\'auteur doit modifier le code.',
        },
        approuvee: {
            id: 'approuvee',
            label: 'Approuvée',
            color: '#10b981',
            desc: 'Au moins un reviewer a approuvé. Prête à merger.',
        },
        mergee: {
            id: 'mergee',
            label: 'Mergée',
            color: '#7c3aed',
            desc: 'La branche a été fusionnée. PR fermée avec succès.',
        },
        fermee: {
            id: 'fermee',
            label: 'Fermée',
            color: '#374151',
            desc: 'La PR a été fermée sans merger (abandon, refus).',
        },
    };

    static TRANSITIONS = {
        brouillon:        [{ label: 'Marquer comme prête', to: 'ouverte' }],
        ouverte:          [
            { label: 'Demander une review', to: 'en_revision' },
            { label: 'Fermer la PR', to: 'fermee', danger: true },
        ],
        en_revision:      [
            { label: 'Approuver', to: 'approuvee' },
            { label: 'Demander des modifications', to: 'modifs_demandees', danger: true },
            { label: 'Fermer', to: 'fermee', danger: true },
        ],
        modifs_demandees: [{ label: 'Repousser les corrections', to: 'en_revision' }],
        approuvee:        [
            { label: 'Merger (Merge commit)', to: 'mergee' },
            { label: 'Merger (Squash)', to: 'mergee' },
            { label: 'Fermer sans merger', to: 'fermee', danger: true },
        ],
        mergee:           [],
        fermee:           [{ label: 'Rouvrir la PR', to: 'ouverte' }],
    };

    // Positions des nœuds dans le SVG
    // Layout vertical : brouillon → ouverte → en_revision → approuvee → mergee
    //                                       ↕ modifs_demandees (droite)
    //                                                        → fermee (droite)
    static SVG_POSITIONS = {
        brouillon:        { x: 148, y: 28  },
        ouverte:          { x: 148, y: 96  },
        en_revision:      { x: 148, y: 166 },
        modifs_demandees: { x: 268, y: 166 },
        approuvee:        { x: 148, y: 236 },
        mergee:           { x: 55,  y: 236 },
        fermee:           { x: 268, y: 236 },
    };

    static SVG_EDGES = [
        ['brouillon',        'ouverte'],
        ['ouverte',          'en_revision'],
        ['ouverte',          'fermee'],
        ['en_revision',      'approuvee'],
        ['en_revision',      'modifs_demandees'],
        ['en_revision',      'fermee'],
        ['modifs_demandees', 'en_revision'],
        ['approuvee',        'mergee'],
        ['approuvee',        'fermee'],
        ['fermee',           'ouverte'],
    ];

    // Labels courts pour le SVG (lisibles dans un cercle R=22)
    static SVG_LABELS = {
        brouillon:        ['Draft'],
        ouverte:          ['Ouverte'],
        en_revision:      ['En', 'révision'],
        modifs_demandees: ['Modifs.', 'req.'],
        approuvee:        ['Approuvée'],
        mergee:           ['Mergée'],
        fermee:           ['Fermée'],
    };

    static mount(container, config = {}) {
        GitHubPRLifecycleWidget.ensureStyles();

        let currentState = 'brouillon';
        let timeline = [{ state: 'brouillon', time: GitHubPRLifecycleWidget._fakeTime(0) }];
        let stepOffset = 0;

        function render() {
            const S = GitHubPRLifecycleWidget.STATES;
            const T = GitHubPRLifecycleWidget.TRANSITIONS;
            const state = S[currentState];
            const transitions = T[currentState];

            const actionsHtml = transitions.length === 0
                ? (currentState === 'mergee'
                    ? `<div class="prlw-success-msg">✓ La PR a été fusionnée avec succès. C'est la fin de son cycle de vie.</div>`
                    : '')
                : `<div class="prlw-actions-title">Actions disponibles</div>
                   <div class="prlw-actions-btns">
                     ${transitions.map(tr =>
                         `<button class="prlw-btn ${tr.danger ? 'prlw-btn-danger' : ''}" data-to="${tr.to}">${tr.label}</button>`
                     ).join('')}
                   </div>`;

            const tlHtml = [...timeline].reverse().map(item => {
                const st = S[item.state];
                return `<div class="prlw-tl-item">
                    <div class="prlw-tl-dot" style="background:${st.color}"></div>
                    <span style="flex:1">${st.label}</span>
                    <span class="prlw-tl-time">${item.time}</span>
                </div>`;
            }).join('');

            container.innerHTML = `
<div class="prlw-root">
  <div class="prlw-layout">
    <div class="prlw-main">
      <div class="prlw-state-card" style="background:${state.color}18; border-color:${state.color}44;">
        <div class="prlw-state-badge" style="background:${state.color}">${state.label}</div>
        <div class="prlw-state-desc">${state.desc}</div>
      </div>
      <div class="prlw-actions">${actionsHtml}</div>
      <div class="prlw-timeline">
        <div class="prlw-timeline-title">Historique des transitions</div>
        ${tlHtml}
      </div>
      <div style="text-align:right;">
        <button class="prlw-btn prlw-btn-reset" id="prlw-reset">↺ Réinitialiser</button>
      </div>
    </div>
    <div class="prlw-graph-panel">
      <div class="prlw-graph-title">Graphe d'états</div>
      ${GitHubPRLifecycleWidget._buildSVG(currentState)}
    </div>
  </div>
</div>`;

            container.querySelectorAll('[data-to]').forEach(btn => {
                btn.addEventListener('click', () => {
                    stepOffset++;
                    timeline.push({ state: btn.dataset.to, time: GitHubPRLifecycleWidget._fakeTime(stepOffset) });
                    currentState = btn.dataset.to;
                    render();
                });
            });

            container.querySelector('#prlw-reset')?.addEventListener('click', () => {
                currentState = 'brouillon';
                stepOffset = 0;
                timeline = [{ state: 'brouillon', time: GitHubPRLifecycleWidget._fakeTime(0) }];
                render();
            });
        }

        render();
        return { destroy() { container.innerHTML = ''; } };
    }

    static _fakeTime(offset) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (20 - offset * 3));
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    static _buildSVG(currentStateId) {
        const POS    = GitHubPRLifecycleWidget.SVG_POSITIONS;
        const S      = GitHubPRLifecycleWidget.STATES;
        const EDGES  = GitHubPRLifecycleWidget.SVG_EDGES;
        const LABELS = GitHubPRLifecycleWidget.SVG_LABELS;
        const R = 22;
        const W = 310, H = 272;

        // Paire bidirectionnelle en_revision ↔ modifs_demandees :
        // on décale légèrement pour éviter la superposition.
        const BIDI = new Set(['en_revision→modifs_demandees', 'modifs_demandees→en_revision']);

        const edgesHtml = EDGES.map(([from, to]) => {
            const f = POS[from], t = POS[to];
            const key = `${from}→${to}`;

            if (BIDI.has(key)) {
                // Arc courbe léger pour séparer les deux sens
                const up = key === 'en_revision→modifs_demandees';
                const offset = up ? -18 : 18;
                const x1 = f.x + R, y1 = f.y + (up ? -3 : 3);
                const x2 = t.x - R, y2 = t.y + (up ? -3 : 3);
                const mx = (x1 + x2) / 2;
                return `<path d="M ${x1},${y1} Q ${mx},${f.y + offset} ${x2},${y2}"
                    fill="none" stroke="#d1d5db" stroke-width="1.5"
                    marker-end="url(#prlw-arrow)" opacity="0.9"/>`;
            }

            // Flèche droite standard
            const dx = t.x - f.x, dy = t.y - f.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return '';
            const ux = dx / len, uy = dy / len;
            const x1 = f.x + ux * R, y1 = f.y + uy * R;
            const x2 = t.x - ux * R, y2 = t.y - uy * R;
            return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
                x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                stroke="#d1d5db" stroke-width="1.5"
                marker-end="url(#prlw-arrow)" opacity="0.9"/>`;
        }).join('\n');

        const nodesHtml = Object.values(S).map(st => {
            const p = POS[st.id];
            const isCurrent = st.id === currentStateId;
            const strokeW = isCurrent ? 3 : 1.5;
            const strokeColor = isCurrent ? st.color : '#d1d5db';
            const fillColor   = isCurrent ? st.color + '2a' : 'white';
            const textColor   = isCurrent ? st.color : '#6b7280';
            const lines = LABELS[st.id] || [st.label];

            // Label : une ou deux lignes centrées
            let labelHtml;
            if (lines.length === 1) {
                labelHtml = `<text x="${p.x}" y="${p.y + 3.5}" text-anchor="middle"
                    dominant-baseline="middle" font-size="8.5"
                    fill="${textColor}" font-weight="${isCurrent ? '700' : '500'}"
                    font-family="var(--font)">${lines[0]}</text>`;
            } else {
                labelHtml = `<text text-anchor="middle" font-size="8"
                    fill="${textColor}" font-weight="${isCurrent ? '700' : '500'}"
                    font-family="var(--font)">
                    <tspan x="${p.x}" dy="${p.y - 4}">${lines[0]}</tspan>
                    <tspan x="${p.x}" dy="10">${lines[1]}</tspan>
                  </text>`;
            }

            return `
<circle cx="${p.x}" cy="${p.y}" r="${R}"
    fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}"/>
${labelHtml}`;
        }).join('');

        return `<svg class="prlw-graph-svg" width="${W}" height="${H}"
     viewBox="0 0 ${W} ${H}" overflow="visible">
  <defs>
    <marker id="prlw-arrow" markerWidth="8" markerHeight="7"
        refX="6" refY="3.5" orient="auto">
      <path d="M0,0 L0,7 L8,3.5 Z" fill="#c4c4cc"/>
    </marker>
  </defs>
  ${edgesHtml}
  ${nodesHtml}
</svg>`;
    }
}

window.GitHubPRLifecycleWidget = GitHubPRLifecycleWidget;
