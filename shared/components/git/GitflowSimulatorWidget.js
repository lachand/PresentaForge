/**
 * GitflowSimulatorWidget — simulation pas-à-pas du workflow Gitflow.
 * Montre l'évolution des branches sur un graphe SVG.
 */
class GitflowSimulatorWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitflowSimulatorWidget._stylesInjected) return;
        GitflowSimulatorWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gflow-root { font-family: var(--font); }
.gflow-step-card {
    background: #eef2ff; border: 1.5px solid #a5b4fc;
    border-radius: var(--radius); padding: 0.75rem 1rem;
    margin-bottom: 0.75rem; font-size: 0.88rem; color: #3730a3;
}
.gflow-step-num { font-weight: 700; margin-bottom: 0.2rem; font-size: 0.75rem; text-transform: uppercase; }
.gflow-step-desc { font-size: 0.9rem; color: var(--text); font-weight: 500; }
.gflow-step-detail { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }
.gflow-svg-wrap {
    overflow-x: auto; border: 1px solid var(--border);
    border-radius: var(--radius); background: var(--bg); padding: 1rem;
    margin-bottom: 0.75rem;
}
.gflow-nav {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.5rem;
}
.gflow-nav-center { font-size: 0.82rem; color: var(--muted); font-weight: 600; }
.gflow-legend {
    display: flex; flex-wrap: wrap; gap: 0.5rem 1rem;
    margin-top: 0.5rem; font-size: 0.75rem;
}
.gflow-legend-item { display: flex; align-items: center; gap: 0.3rem; }
.gflow-legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitflowSimulatorWidget.ensureStyles();

        // Coordonnées fixes par branche
        const BRANCHES = {
            main:     { y: 30,  color: '#4f46e5', label: 'main' },
            develop:  { y: 80,  color: '#0ea5e9', label: 'develop' },
            feature1: { y: 130, color: '#10b981', label: 'feature/login' },
            feature2: { y: 180, color: '#14b8a6', label: 'feature/cart' },
            release:  { y: 230, color: '#f59e0b', label: 'release/1.0' },
            hotfix:   { y: 280, color: '#ef4444', label: 'hotfix/fix' }
        };

        // Définition des étapes
        // Chaque étape ajoute des éléments visuels (commits, branches, merges)
        const STEPS = [
            {
                desc: "Initialisation : la branche develop est créée depuis main",
                detail: "Dans Gitflow, le développement ne se fait jamais directement sur main. develop est la branche d'intégration.",
                elements: [
                    { type: 'branch-line', branch: 'main',    x1: 0, x2: 520 },
                    { type: 'branch-line', branch: 'develop', x1: 60, x2: 520 },
                    { type: 'commit', branch: 'main',    x: 40, label: 'init' },
                    { type: 'merge-line', from: 'main', to: 'develop', x: 60 }
                ]
            },
            {
                desc: "Alice crée feature/login depuis develop",
                detail: "Chaque fonctionnalité vit sur sa propre branche feature, créée depuis develop.",
                elements: [
                    { type: 'branch-line', branch: 'feature1', x1: 90, x2: 280 },
                    { type: 'merge-line', from: 'develop', to: 'feature1', x: 90 }
                ]
            },
            {
                desc: "Alice fait 2 commits sur feature/login",
                detail: "Les commits de feature restent sur la branche feature jusqu'à la PR.",
                elements: [
                    { type: 'commit', branch: 'feature1', x: 130, label: 'login #1' },
                    { type: 'commit', branch: 'feature1', x: 200, label: 'login #2' }
                ]
            },
            {
                desc: "Bob crée feature/cart depuis develop et fait 3 commits",
                detail: "Plusieurs features peuvent être développées en parallèle.",
                elements: [
                    { type: 'branch-line', branch: 'feature2', x1: 90, x2: 320 },
                    { type: 'merge-line', from: 'develop', to: 'feature2', x: 90 },
                    { type: 'commit', branch: 'feature2', x: 140, label: 'cart #1' },
                    { type: 'commit', branch: 'feature2', x: 200, label: 'cart #2' },
                    { type: 'commit', branch: 'feature2', x: 260, label: 'cart #3' }
                ]
            },
            {
                desc: "Alice merge feature/login → develop (PR fusionnée)",
                detail: "Une fois la feature terminée et reviewée, elle est mergée dans develop.",
                elements: [
                    { type: 'commit', branch: 'develop', x: 280, label: 'merge login' },
                    { type: 'merge-line', from: 'feature1', to: 'develop', x: 280 }
                ]
            },
            {
                desc: "Création de release/1.0 depuis develop",
                detail: "La branche release isole la préparation de la version : corrections mineures, numéro de version, tests.",
                elements: [
                    { type: 'commit', branch: 'develop', x: 320, label: 'merge cart' },
                    { type: 'merge-line', from: 'feature2', to: 'develop', x: 320 },
                    { type: 'branch-line', branch: 'release', x1: 340, x2: 430 },
                    { type: 'merge-line', from: 'develop', to: 'release', x: 340 }
                ]
            },
            {
                desc: "Correction d'un bug mineur sur release/1.0",
                detail: "Seuls des bugfixes (pas de nouvelles fonctionnalités) sont autorisés sur la branche release.",
                elements: [
                    { type: 'commit', branch: 'release', x: 390, label: 'bugfix' }
                ]
            },
            {
                desc: "Merge release/1.0 → main (tag v1.0.0) ET → develop",
                detail: "La release est mergée dans DEUX branches : main pour la prod, et develop pour récupérer les bugfixes.",
                elements: [
                    { type: 'commit', branch: 'main',    x: 430, label: 'v1.0.0', tag: true },
                    { type: 'commit', branch: 'develop', x: 430, label: 'sync release' },
                    { type: 'merge-line', from: 'release', to: 'main',    x: 430 },
                    { type: 'merge-line', from: 'release', to: 'develop', x: 430 }
                ]
            },
            {
                desc: "Un bug critique est découvert en production",
                detail: "Le hotfix branche directement depuis main (la prod), sans passer par develop.",
                elements: [
                    { type: 'branch-line', branch: 'hotfix', x1: 460, x2: 520 },
                    { type: 'merge-line', from: 'main', to: 'hotfix', x: 460 },
                    { type: 'commit', branch: 'hotfix', x: 490, label: 'patch' }
                ]
            },
            {
                desc: "Merge hotfix → main (tag v1.0.1) ET → develop",
                detail: "Comme la release, le hotfix est mergé dans main ET develop pour que la correction soit partout.",
                elements: [
                    { type: 'commit', branch: 'main',    x: 520, label: 'v1.0.1', tag: true },
                    { type: 'commit', branch: 'develop', x: 520, label: 'sync hotfix' },
                    { type: 'merge-line', from: 'hotfix', to: 'main',    x: 520 },
                    { type: 'merge-line', from: 'hotfix', to: 'develop', x: 520 }
                ]
            }
        ];

        let currentStep = 0;

        const buildSVG = (upToStep) => {
            const W = 580, H = 320;
            let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;min-width:${W}px">`;

            // Collect all elements up to this step
            const allElements = [];
            for (let i = 0; i <= upToStep; i++) {
                STEPS[i].elements.forEach(el => allElements.push(el));
            }

            // Branch lines
            allElements.filter(e => e.type === 'branch-line').forEach(e => {
                const b = BRANCHES[e.branch];
                svg += `<line x1="${e.x1}" y1="${b.y}" x2="${e.x2}" y2="${b.y}" stroke="${b.color}" stroke-width="3" stroke-linecap="round"/>`;
                // Label at start
                svg += `<text x="${e.x1 - 2}" y="${b.y - 8}" font-size="9" fill="${b.color}" font-weight="700" font-family="monospace">${b.label}</text>`;
            });

            // Merge lines (diagonal)
            allElements.filter(e => e.type === 'merge-line').forEach(e => {
                const from = BRANCHES[e.from], to = BRANCHES[e.to];
                svg += `<line x1="${e.x}" y1="${from.y}" x2="${e.x}" y2="${to.y}" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="4,2"/>`;
            });

            // Commits
            allElements.filter(e => e.type === 'commit').forEach(e => {
                const b = BRANCHES[e.branch];
                const r = e.tag ? 10 : 7;
                svg += `<circle cx="${e.x}" cy="${b.y}" r="${r}" fill="${e.tag ? b.color : 'white'}" stroke="${b.color}" stroke-width="2.5"/>`;
                if (e.tag) {
                    svg += `<text x="${e.x}" y="${b.y + 4}" font-size="8" fill="white" text-anchor="middle" font-weight="700" font-family="monospace">${e.label.includes('v1.0.1') ? '1.0.1' : '1.0.0'}</text>`;
                }
                if (e.label && !e.tag) {
                    svg += `<text x="${e.x}" y="${b.y + 20}" font-size="8" fill="${b.color}" text-anchor="middle" font-family="monospace">${e.label}</text>`;
                }
            });

            svg += '</svg>';
            return svg;
        };

        const render = () => {
            const step = STEPS[currentStep];
            container.innerHTML = `
<div class="gflow-root">
  <div class="gflow-step-card">
    <div class="gflow-step-num">Étape ${currentStep + 1} / ${STEPS.length}</div>
    <div class="gflow-step-desc">${step.desc}</div>
    <div class="gflow-step-detail">${step.detail}</div>
  </div>
  <div class="gflow-svg-wrap">${buildSVG(currentStep)}</div>
  <div class="gflow-nav">
    <button class="btn btn-secondary" id="gflow-prev" ${currentStep === 0 ? 'disabled' : ''}>← Précédent</button>
    <span class="gflow-nav-center">Étape ${currentStep + 1} / ${STEPS.length}</span>
    <button class="btn btn-primary" id="gflow-next" ${currentStep === STEPS.length - 1 ? 'disabled' : ''}>Suivant →</button>
  </div>
  <div class="gflow-legend">
    ${Object.values(BRANCHES).map(b => `
      <div class="gflow-legend-item">
        <div class="gflow-legend-dot" style="background:${b.color}"></div>
        <span>${b.label}</span>
      </div>`).join('')}
  </div>
</div>`;
            container.querySelector('#gflow-prev')?.addEventListener('click', () => { if (currentStep > 0) { currentStep--; render(); } });
            container.querySelector('#gflow-next')?.addEventListener('click', () => { if (currentStep < STEPS.length - 1) { currentStep++; render(); } });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitflowSimulatorWidget = GitflowSimulatorWidget;
