/**
 * GitMergeComparisonWidget — comparaison côte à côte de 3 stratégies d'intégration :
 * Fast-forward merge | 3-way merge (merge commit) | Rebase + merge
 *
 * Montre le même point de départ (branche divergente) et le résultat de chaque stratégie.
 */
class GitMergeComparisonWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitMergeComparisonWidget._stylesInjected) return;
        GitMergeComparisonWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gmcw-root {
    font-family: var(--font);
    color: var(--text);
}

/* Situation de départ */
.gmcw-start {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem 1.1rem;
    margin-bottom: 1rem;
}
.gmcw-start-title {
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.6rem;
}
.gmcw-start-diagram {
    display: flex;
    align-items: center;
    gap: 0;
    flex-wrap: wrap;
    row-gap: 0.75rem;
}

/* Grille 3 colonnes */
.gmcw-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}
@media (max-width: 750px) {
    .gmcw-grid { grid-template-columns: 1fr; }
}

/* Carte de stratégie */
.gmcw-card {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
    cursor: pointer;
}
.gmcw-card:hover {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px #c7d2fe;
}
.gmcw-card.active {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px #c7d2fe;
}
.gmcw-card-header {
    padding: 0.65rem 0.85rem;
    font-weight: 700;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: #fff;
}
.gmcw-card-ff     .gmcw-card-header { background: #4f46e5; }
.gmcw-card-merge  .gmcw-card-header { background: #0891b2; }
.gmcw-card-rebase .gmcw-card-header { background: #059669; }

.gmcw-card-body {
    padding: 0.75rem 0.85rem;
    background: var(--card);
}
.gmcw-card-graph {
    margin-bottom: 0.6rem;
}
.gmcw-card-when {
    font-size: 0.72rem;
    color: var(--muted);
    border-top: 1px solid var(--border);
    padding-top: 0.45rem;
    margin-top: 0.45rem;
    line-height: 1.4;
}
.gmcw-card-when b { color: var(--text); }

/* SVG commit nodes */
.gmcw-svg {
    display: block;
    overflow: visible;
}

/* Panel d'explication */
.gmcw-detail {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
    min-height: 80px;
    border-left: 4px solid var(--primary);
}
.gmcw-detail-title {
    font-weight: 700;
    font-size: 0.88rem;
    margin-bottom: 0.4rem;
}
.gmcw-detail-pros {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.4rem;
}
.gmcw-detail-pro  { color: #16a34a; font-size: 0.8rem; }
.gmcw-detail-con  { color: #dc2626; font-size: 0.8rem; }
.gmcw-cmd {
    font-family: var(--font-mono);
    font-size: 0.77rem;
    background: #1e293b;
    color: #e2e8f0;
    border-radius: var(--radius-sm);
    padding: 0.45rem 0.7rem;
    margin-top: 0.5rem;
    white-space: pre;
    overflow-x: auto;
    display: block;
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitMergeComparisonWidget.ensureStyles();

        const STRATEGIES = {
            ff: {
                id: 'ff',
                cls: 'gmcw-card-ff',
                icon: '⚡',
                label: 'Fast-forward merge',
                cmd: 'git checkout main\ngit merge feature/login\n# → Fast-forward\n# main avance simplement au commit de feature',
                detail: `Le <b>fast-forward</b> se produit quand la branche cible (<code>main</code>) n'a pas avancé depuis la création de <code>feature</code>. Git se contente de déplacer le pointeur <code>main</code> vers le dernier commit de <code>feature</code> — aucun commit de merge n'est créé. L'historique reste parfaitement linéaire.`,
                pros: [
                    '✅ Historique linéaire, lisible comme une ligne droite',
                    '✅ Aucun commit parasite dans git log',
                    '❌ Impossible si main a avancé (divergence)',
                    '❌ La feature devient indiscernable dans l\'historique global'
                ],
                svgFn: (doc) => {
                    // AVANT : C1 - C2(main) \ C3 - C4(feature)
                    // APRÈS : C1 - C2 - C3 - C4 (main=feature)
                    return `<svg class="gmcw-svg" width="220" height="100" viewBox="0 0 220 100">
  <defs>
    <marker id="gmcw-arr-ff" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Ligne principale -->
  <line x1="30" y1="35" x2="185" y2="35" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#gmcw-arr-ff)"/>
  <!-- Commits -->
  <circle cx="30"  cy="35" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="30"  y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C1</text>
  <circle cx="80"  cy="35" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="80"  y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C2</text>
  <circle cx="130" cy="35" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="130" y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C3</text>
  <circle cx="180" cy="35" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="180" y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C4</text>
  <!-- Labels -->
  <rect x="62"  y="50" width="36" height="14" rx="3" fill="#ede9fe"/>
  <text x="80"  y="61" text-anchor="middle" font-size="8" fill="#4f46e5" font-weight="bold">main</text>
  <rect x="110" y="50" width="46" height="14" rx="3" fill="#d1fae5"/>
  <text x="133" y="61" text-anchor="middle" font-size="8" fill="#059669" font-weight="bold">feature</text>
  <!-- Flèche main → C4 -->
  <line x1="80" y1="50" x2="148" y2="38" stroke="#4f46e5" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#gmcw-arr-ff)"/>
  <text x="110" y="88" text-anchor="middle" font-size="9" fill="#6b7280">→ main avance vers C4</text>
</svg>`;
                }
            },
            merge: {
                id: 'merge',
                cls: 'gmcw-card-merge',
                icon: '🔀',
                label: '3-way merge commit',
                cmd: 'git checkout main\ngit merge feature/login --no-ff\n# → Merge commit M créé\n# main avance, feature conservée',
                detail: `Le <b>3-way merge</b> crée un nouveau <b>commit de merge</b> (M) qui a deux parents : le dernier commit de <code>main</code> et le dernier commit de <code>feature</code>. Git calcule l'état final en comparant l'ancêtre commun (C2), la pointe de main (C5) et la pointe de feature (C4). L'historique branché reste visible.`,
                pros: [
                    '✅ Préserve l\'historique complet des branches',
                    '✅ La PR reste identifiable comme unité atomique',
                    '❌ L\'historique devient non-linéaire (branches multiples)',
                    '❌ Commits de merge "parasites" sur des petites features'
                ],
                svgFn: (doc) => {
                    return `<svg class="gmcw-svg" width="220" height="110" viewBox="0 0 220 110">
  <defs>
    <marker id="gmcw-arr-merge" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Branche main -->
  <line x1="30" y1="30" x2="100" y2="30" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="100" y1="30" x2="180" y2="30" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#gmcw-arr-merge)"/>
  <!-- Branche feature -->
  <line x1="80" y1="30" x2="80" y2="75" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="80" y1="75" x2="140" y2="75" stroke="#94a3b8" stroke-width="1.5"/>
  <line x1="140" y1="75" x2="180" y2="31" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- Commits main -->
  <circle cx="30"  cy="30" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="30"  y="34" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C1</text>
  <circle cx="80"  cy="30" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="80"  y="34" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C2</text>
  <circle cx="130" cy="30" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="130" y="34" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C5</text>
  <circle cx="180" cy="30" r="10" fill="#0891b2" stroke="#fff" stroke-width="2"/>
  <text x="180" y="34" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">M</text>
  <!-- Commits feature -->
  <circle cx="100" cy="75" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="100" y="79" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C3</text>
  <circle cx="145" cy="75" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="145" y="79" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C4</text>
  <!-- Labels -->
  <rect x="112" y="15" width="36" height="12" rx="3" fill="#ede9fe"/>
  <text x="130" y="25" text-anchor="middle" font-size="8" fill="#4f46e5" font-weight="bold">main</text>
  <text x="110" y="100" text-anchor="middle" font-size="9" fill="#6b7280">→ commit de merge M (2 parents)</text>
</svg>`;
                }
            },
            rebase: {
                id: 'rebase',
                cls: 'gmcw-card-rebase',
                icon: '📏',
                label: 'Rebase + fast-forward',
                cmd: 'git checkout feature/login\ngit rebase main\n# C3\' et C4\' réécrits sur main\ngit checkout main\ngit merge feature/login\n# → Fast-forward',
                detail: `Le <b>rebase</b> réécrit les commits de <code>feature</code> comme s'ils avaient été créés à partir de la pointe actuelle de <code>main</code>. Les commits C3 et C4 deviennent C3' et C4' — mêmes changements, nouveaux hashs. Le merge final est un fast-forward : l'historique résultant est parfaitement linéaire.`,
                pros: [
                    '✅ Historique linéaire et propre',
                    '✅ Chaque commit est autonome et lisible',
                    '❌ Réécrit l\'historique (nouveaux hashs)',
                    '❌ Ne jamais rebaser des branches publiques partagées'
                ],
                svgFn: (doc) => {
                    return `<svg class="gmcw-svg" width="220" height="100" viewBox="0 0 220 100">
  <defs>
    <marker id="gmcw-arr-rb" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Ligne principale -->
  <line x1="20" y1="35" x2="200" y2="35" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#gmcw-arr-rb)"/>
  <!-- Commits originaux (grisés, barrés) -->
  <circle cx="100" cy="65" r="9" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="100" y="69" text-anchor="middle" font-size="7" fill="#94a3b8">C3</text>
  <circle cx="130" cy="65" r="9" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="130" y="69" text-anchor="middle" font-size="7" fill="#94a3b8">C4</text>
  <line x1="90"  y1="58" x2="110" y2="72" stroke="#f87171" stroke-width="1.5"/>
  <line x1="110" y1="58" x2="90"  y2="72" stroke="#f87171" stroke-width="1.5"/>
  <line x1="120" y1="58" x2="140" y2="72" stroke="#f87171" stroke-width="1.5"/>
  <line x1="140" y1="58" x2="120" y2="72" stroke="#f87171" stroke-width="1.5"/>
  <!-- Commits réécrits sur main -->
  <circle cx="20"  cy="35" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="20"  y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C1</text>
  <circle cx="65"  cy="35" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="65"  y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C2</text>
  <circle cx="110" cy="35" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
  <text x="110" y="39" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C5</text>
  <circle cx="155" cy="35" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="155" y="39" text-anchor="middle" font-size="7" fill="#fff" font-weight="bold">C3'</text>
  <circle cx="200" cy="35" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
  <text x="200" y="39" text-anchor="middle" font-size="7" fill="#fff" font-weight="bold">C4'</text>
  <!-- Labels -->
  <rect x="94" y="15" width="36" height="12" rx="3" fill="#ede9fe"/>
  <text x="112" y="25" text-anchor="middle" font-size="8" fill="#4f46e5" font-weight="bold">main</text>
  <text x="110" y="92" text-anchor="middle" font-size="9" fill="#6b7280">C3, C4 réécrits → C3', C4' (nouveaux hash)</text>
</svg>`;
                }
            }
        };

        let active = null;

        const render = () => {
            const stratHtml = Object.values(STRATEGIES).map(s => `
<div class="gmcw-card ${s.cls}${active === s.id ? ' active' : ''}" data-strat="${s.id}">
    <div class="gmcw-card-header">${s.icon} ${s.label}</div>
    <div class="gmcw-card-body">
        <div class="gmcw-card-graph">${s.svgFn()}</div>
        <div class="gmcw-card-when">
            ${s.pros.slice(0, 2).map(p => `<div>${p}</div>`).join('')}
        </div>
    </div>
</div>`).join('');

            const activeStrat = active ? STRATEGIES[active] : null;

            const detailHtml = activeStrat ? `
<div class="gmcw-detail">
    <div class="gmcw-detail-title">${activeStrat.icon} ${activeStrat.label}</div>
    <div>${activeStrat.detail}</div>
    <div class="gmcw-detail-pros">${activeStrat.pros.map(p => `<div class="${p.startsWith('✅') ? 'gmcw-detail-pro' : 'gmcw-detail-con'}">${p}</div>`).join('')}</div>
    <code class="gmcw-cmd">${activeStrat.cmd}</code>
</div>` : `
<div class="gmcw-detail" style="border-left-color:var(--border)">
    <span style="color:var(--muted);font-style:italic">Cliquez sur une carte pour voir les détails, avantages/inconvénients et commandes.</span>
</div>`;

            container.innerHTML = `
<div class="gmcw-root">
    <div class="gmcw-start">
        <div class="gmcw-start-title">Situation de départ — même pour les 3 stratégies</div>
        <svg class="gmcw-svg" width="300" height="85" viewBox="0 0 300 85">
            <defs>
                <marker id="gmcw-arr-s" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8"/>
                </marker>
            </defs>
            <!-- main -->
            <line x1="30" y1="25" x2="140" y2="25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#gmcw-arr-s)"/>
            <!-- feature diverge -->
            <line x1="80" y1="25" x2="80" y2="65" stroke="#94a3b8" stroke-width="1.5"/>
            <line x1="80" y1="65" x2="200" y2="65" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#gmcw-arr-s)"/>
            <!-- Commits main -->
            <circle cx="30"  cy="25" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
            <text x="30"  y="29" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C1</text>
            <circle cx="80"  cy="25" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
            <text x="80"  y="29" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C2</text>
            <circle cx="130" cy="25" r="10" fill="#6366f1" stroke="#fff" stroke-width="2"/>
            <text x="130" y="29" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C5</text>
            <!-- Commits feature -->
            <circle cx="120" cy="65" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
            <text x="120" y="69" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C3</text>
            <circle cx="165" cy="65" r="10" fill="#059669" stroke="#fff" stroke-width="2"/>
            <text x="165" y="69" text-anchor="middle" font-size="8" fill="#fff" font-weight="bold">C4</text>
            <!-- Labels branches -->
            <rect x="110" y="10" width="40" height="12" rx="3" fill="#ede9fe"/>
            <text x="130" y="20" text-anchor="middle" font-size="8" fill="#4f46e5" font-weight="bold">main</text>
            <rect x="145" y="50" width="54" height="12" rx="3" fill="#d1fae5"/>
            <text x="172" y="60" text-anchor="middle" font-size="8" fill="#059669" font-weight="bold">feature/login</text>
            <text x="155" y="82" text-anchor="middle" font-size="9" fill="#6b7280">main a avancé (C5) depuis la création de feature</text>
        </svg>
    </div>
    <div class="gmcw-grid">${stratHtml}</div>
    ${detailHtml}
</div>`;

            container.querySelectorAll('[data-strat]').forEach(el => {
                el.addEventListener('click', () => {
                    const sid = el.dataset.strat;
                    active = (active === sid) ? null : sid;
                    render();
                });
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitMergeComparisonWidget = GitMergeComparisonWidget;
