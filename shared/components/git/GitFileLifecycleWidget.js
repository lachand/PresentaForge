/**
 * GitFileLifecycleWidget — machine à états visuelle du cycle de vie d'un fichier Git.
 *
 * Montre les 4 états d'un fichier (non suivi, modifié, indexé, commis)
 * et les transitions possibles via les commandes Git.
 */
class GitFileLifecycleWidget {
    static mount(container, config = {}) {
        const filename = config.filename || 'app.py';

        const STATES = {
            untracked: {
                badge: 'Non suivi',
                desc: 'Le fichier existe dans le répertoire de travail mais Git ne le connaît pas encore. Il ne sera pas inclus dans les commits.',
                transitions: [
                    { label: 'git add', next: 'staged' }
                ]
            },
            modified: {
                badge: 'Modifié',
                desc: 'Le fichier est connu de Git et a été modifié depuis le dernier commit. Les modifications ne sont pas encore enregistrées.',
                transitions: [
                    { label: 'git add', next: 'staged' },
                    { label: 'git checkout -- .', next: 'committed', danger: true }
                ]
            },
            staged: {
                badge: 'Indexé',
                desc: 'Le fichier est dans la staging area (index). Il sera inclus dans le prochain commit.',
                transitions: [
                    { label: 'git commit', next: 'committed' },
                    { label: 'git restore --staged', next: 'modified', danger: true }
                ]
            },
            committed: {
                badge: 'Commis',
                desc: 'Le fichier est enregistré dans le dépôt Git. Le snapshot est permanent et fait partie de l\'historique du projet.',
                transitions: [
                    { label: 'git push', next: 'pushed' },
                    { label: 'Éditer le fichier', next: 'modified' }
                ]
            },
            pushed: {
                badge: 'Poussé (origin)',
                desc: 'Le commit a été envoyé au dépôt distant (origin). Les collaborateurs peuvent maintenant récupérer ce commit via git pull/fetch.',
                transitions: [
                    { label: 'git pull (collaborateur)', next: 'committed' },
                    { label: 'Éditer le fichier', next: 'modified' }
                ]
            }
        };

        let currentState = 'untracked';
        let history = [];

        const addHistory = (cmd) => {
            history.unshift(cmd);
            if (history.length > 6) history.pop();
        };

        const render = () => {
            const st = STATES[currentState];
            const actionsHtml = st.transitions.map(t =>
                `<button class="gflw-btn${t.danger ? ' danger' : ''}" data-next="${t.next}" data-label="${t.label}">${t.label}</button>`
            ).join('');
            const historyHtml = history.length === 0
                ? `<div class="gflw-history-empty">Aucune commande exécutée.</div>`
                : `<ul class="gflw-history-list">${history.map(h =>
                    `<li><span class="gflw-history-prompt">$</span><span class="gflw-history-cmd">${h}</span></li>`
                ).join('')}</ul>`;

            container.innerHTML = `
<div class="gflw-root">
    <div class="gflw-diagram">
        ${GitFileLifecycleWidget._buildDiagram(currentState)}
    </div>
    <div class="gflw-file-card state-${currentState}">
        <div class="gflw-file-icon">📄</div>
        <div class="gflw-file-info">
            <div class="gflw-file-name">${filename}</div>
            <span class="gflw-state-badge">${st.badge}</span>
            <div class="gflw-state-desc">${st.desc}</div>
        </div>
    </div>
    <div class="gflw-actions">
        ${actionsHtml}
        <button class="gflw-btn-reset" id="gflw-reset">Réinitialiser</button>
    </div>
    <div class="gflw-history">
        <div class="gflw-history-header">Historique des commandes</div>
        ${historyHtml}
    </div>
</div>`;

            container.querySelectorAll('.gflw-btn[data-next]').forEach(btn => {
                btn.addEventListener('click', () => {
                    addHistory(btn.dataset.label);
                    currentState = btn.dataset.next;
                    render();
                });
            });
            container.querySelector('#gflw-reset')?.addEventListener('click', () => {
                currentState = 'untracked';
                history = [];
                render();
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }

    /**
     * SVG du diagramme d'états.
     *
     * Layout (horizontal) :
     *   [Non suivi]  [Modifié]  [Indexé]  [Commis]
     *
     * Flèches AVANT (au-dessus des boîtes) :
     *   - untracked → staged  (git add, arc au-dessus de Modifié)
     *   - modified  → staged  (git add, ligne droite)
     *   - staged    → committed (git commit, ligne droite)
     *
     * Flèches RETOUR (en-dessous des boîtes) :
     *   - committed → modified  (éditer, grand arc)
     *   - staged    → modified  (git restore --staged, arc court)
     */
    static _buildDiagram(activeState) {
        // Layout — 5 états, BW=90, gaps=55px
        const W = 710, H = 190;
        const BW = 90, BH = 42, BY = 64;   // boîtes : y=64 → y=106
        const CY = BY + BH / 2;             // y=85 : centre vertical
        const BB = BY + BH;                 // y=106 : bas des boîtes

        const states = [
            { id: 'untracked', label: 'Non suivi',  cx: 55,  color: '#9ca3af', bg: '#f9fafb', dashBorder: false },
            { id: 'modified',  label: 'Modifié',    cx: 200, color: '#f59e0b', bg: '#fffbeb', dashBorder: false },
            { id: 'staged',    label: 'Indexé',     cx: 345, color: '#4f46e5', bg: '#eef2ff', dashBorder: false },
            { id: 'committed', label: 'Commis',     cx: 490, color: '#10b981', bg: '#ecfdf5', dashBorder: false },
            { id: 'pushed',    label: 'Distant',    cx: 635, color: '#0ea5e9', bg: '#f0f9ff', dashBorder: true  },
        ];
        // Extents : 10-100 | 155-245 | 300-390 | 445-535 | 590-680  (55px de gap)

        const ARROW_FWD  = '#6b7280';
        const ARROW_BACK = '#c4b5fd';
        const ARROW_PUSH = '#0ea5e9';  // bleu ciel pour push/pull réseau

        const defs = `
  <defs>
    <marker id="gflw-fwd"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="${ARROW_FWD}"/>
    </marker>
    <marker id="gflw-back" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="${ARROW_BACK}"/>
    </marker>
    <marker id="gflw-push" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="${ARROW_PUSH}"/>
    </marker>
  </defs>`;

        // ── Boîtes ──────────────────────────────────────────────────
        const boxes = states.map(s => {
            const isActive = s.id === activeState;
            const bx = s.cx - BW / 2;
            const stroke = isActive ? s.color : '#d1d5db';
            const fill   = isActive ? s.bg    : '#fafafa';
            const sw     = isActive ? 2.5 : 1.5;
            const textColor = isActive ? s.color : '#6b7280';
            const dashAttr = s.dashBorder ? ' stroke-dasharray="6,3"' : '';
            return `
  <rect x="${bx}" y="${BY}" width="${BW}" height="${BH}" rx="7" ry="7"
        fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dashAttr}/>
  <text x="${s.cx}" y="${CY + 5}" text-anchor="middle"
        font-size="11" font-family="var(--font)" fill="${textColor}"
        font-weight="${isActive ? '700' : '500'}">${s.label}</text>`;
        }).join('');

        // ── Flèches avant (dans les gaps à hauteur CY) ──────────────
        const fwdArrows = `
  <!-- modified(245) → staged(300) -->
  <line x1="247" y1="${CY}" x2="297" y2="${CY}"
        stroke="${ARROW_FWD}" stroke-width="1.5" marker-end="url(#gflw-fwd)"/>
  <text x="272" y="${CY - 9}" text-anchor="middle" font-size="8.5"
        font-family="var(--font-mono)" fill="${ARROW_FWD}">git add</text>

  <!-- staged(390) → committed(445) -->
  <line x1="392" y1="${CY}" x2="442" y2="${CY}"
        stroke="${ARROW_FWD}" stroke-width="1.5" marker-end="url(#gflw-fwd)"/>
  <text x="417" y="${CY - 9}" text-anchor="middle" font-size="8.5"
        font-family="var(--font-mono)" fill="${ARROW_FWD}">git commit</text>

  <!-- committed(535) → pushed(590) : git push (réseau, en pointillés) -->
  <line x1="537" y1="${CY}" x2="587" y2="${CY}"
        stroke="${ARROW_PUSH}" stroke-width="1.5" stroke-dasharray="5,3"
        marker-end="url(#gflw-push)"/>
  <text x="562" y="${CY - 9}" text-anchor="middle" font-size="8.5"
        font-family="var(--font-mono)" fill="${ARROW_PUSH}">git push</text>

  <!-- untracked(100) → staged(300) : arc au-dessus -->
  <path d="M 100,${BY} C 100,16 300,16 300,${BY}"
        fill="none" stroke="${ARROW_FWD}" stroke-width="1.5"
        stroke-dasharray="5,3" marker-end="url(#gflw-fwd)"/>
  <text x="200" y="10" text-anchor="middle" font-size="8.5"
        font-family="var(--font-mono)" fill="${ARROW_FWD}">git add (nouveau fichier)</text>`;

        // ── Flèches retour (chemins en L sous les boîtes) ───────────
        // Voie 1 (y=124) : staged → modified      git restore --staged
        // Voie 2 (y=150) : committed → modified   éditer le fichier
        // Voie 3 (y=168) : pushed → committed     git pull (réseau)
        const backArrows = `
  <!-- staged(345) → modified(200) : voie 1 -->
  <path d="M 345,${BB} L 345,${BB + 18} L 200,${BB + 18} L 200,${BB}"
        fill="none" stroke="${ARROW_BACK}" stroke-width="1.5"
        marker-end="url(#gflw-back)"/>
  <text x="272" y="${BB + 32}" text-anchor="middle" font-size="8"
        font-family="var(--font-mono)" fill="${ARROW_BACK}">git restore --staged</text>

  <!-- committed(490) → modified(200) : voie 2 -->
  <path d="M 490,${BB} L 490,${BB + 44} L 200,${BB + 44} L 200,${BB}"
        fill="none" stroke="${ARROW_BACK}" stroke-width="1.5" stroke-dasharray="5,3"
        marker-end="url(#gflw-back)"/>
  <text x="345" y="${BB + 58}" text-anchor="middle" font-size="8"
        font-family="var(--font-mono)" fill="${ARROW_BACK}">éditer le fichier</text>

  <!-- pushed(635) → committed(490) : voie 3, git pull (réseau) -->
  <path d="M 635,${BB} L 635,${BB + 64} L 490,${BB + 64} L 490,${BB}"
        fill="none" stroke="${ARROW_PUSH}" stroke-width="1.5" stroke-dasharray="5,3"
        marker-end="url(#gflw-push)"/>
  <text x="562" y="${BB + 78}" text-anchor="middle" font-size="8"
        font-family="var(--font-mono)" fill="${ARROW_PUSH}">git pull</text>`;

        return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
     overflow="visible" xmlns="http://www.w3.org/2000/svg">
  ${defs}
  ${boxes}
  ${fwdArrows}
  ${backArrows}
</svg>`;
    }
}
window.GitFileLifecycleWidget = GitFileLifecycleWidget;
