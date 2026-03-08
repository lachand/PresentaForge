/**
 * GitHubActionsWidget — explorateur interactif d'un workflow GitHub Actions.
 *
 * Affiche un fichier YAML annoté. Cliquer sur une section met en évidence
 * la zone et affiche une explication détaillée.
 */
class GitHubActionsWidget {
    static _stylesInjected = false;

    static WORKFLOW = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Récupérer le code
        uses: actions/checkout@v4

      - name: Installer Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Installer les dépendances
        run: pip install -r requirements.txt

      - name: Lancer les tests
        run: pytest --tb=short -v

  lint:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install flake8
      - run: flake8 .

  deploy:
    runs-on: ubuntu-latest
    needs: [test, lint]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Déployer
        run: ./scripts/deploy.sh
        env:
          API_KEY: \${{ secrets.DEPLOY_API_KEY }}`;

    // Régions cliquables : { id, startLine, endLine (inclusif), title, explain, color }
    static REGIONS = [
        {
            id: 'name',
            lines: [0],
            title: 'name: — Nom du workflow',
            color: '#8b5cf6',
            explain: `Le champ <code>name:</code> définit le nom affiché dans l'onglet <em>Actions</em> de GitHub. Sans ce champ, GitHub utilise le chemin du fichier (<code>.github/workflows/ci.yml</code>). Choisissez un nom clair : <em>CI</em>, <em>Tests &amp; Lint</em>, <em>Deploy to Production</em>.`
        },
        {
            id: 'on',
            lines: [2, 3, 4, 5, 6],
            title: 'on: — Déclencheurs (events)',
            color: '#0ea5e9',
            explain: `Le bloc <code>on:</code> liste les événements qui déclenchent le workflow.<br><br>
<b>push → branches: [main]</b> : se déclenche à chaque push sur main.<br>
<b>pull_request → branches: [main]</b> : se déclenche quand une PR cible main (ouverture, mise à jour, réouverture).<br><br>
Autres déclencheurs utiles : <code>schedule</code> (cron), <code>workflow_dispatch</code> (manuel), <code>release</code>.`
        },
        {
            id: 'job-test',
            lines: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
            title: 'jobs.test — Job de tests',
            color: '#22c55e',
            explain: `Ce job <code>test</code> s'exécute en premier. Il installe Python, les dépendances, puis lance pytest.<br><br>
<b>runs-on: ubuntu-latest</b> — runner Ubuntu hébergé par GitHub (gratuit pour les dépôts publics).<br>
<b>actions/checkout@v4</b> — clone le dépôt sur le runner. Toujours la première step.<br>
<b>actions/setup-python@v5 + with: python-version</b> — installe Python 3.12 proprement.<br>
<b>run:</b> — exécute une commande shell directement sur le runner.`
        },
        {
            id: 'job-lint',
            lines: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34],
            title: 'jobs.lint — Job de linting',
            color: '#f59e0b',
            explain: `Le job <code>lint</code> vérifie la qualité du code avec flake8.<br><br>
<b>needs: test</b> — ce job ne démarre que si le job <code>test</code> a réussi. Sans <code>needs:</code>, tous les jobs s'exécutent en parallèle.<br><br>
Si <code>test</code> échoue, <code>lint</code> est automatiquement annulé (statut <em>Skipped</em>), ce qui économise des minutes de runner.`
        },
        {
            id: 'job-deploy',
            lines: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46],
            title: 'jobs.deploy — Job de déploiement',
            color: '#ef4444',
            explain: `Le job <code>deploy</code> ne s'exécute que si <code>test</code> ET <code>lint</code> ont réussi, ET seulement sur la branche main.<br><br>
<b>needs: [test, lint]</b> — attend les deux jobs.<br>
<b>if: github.ref == 'refs/heads/main'</b> — condition d'exécution. Sur une branche de feature, ce job est ignoré.<br>
<b>secrets.DEPLOY_API_KEY</b> — variable secrète définie dans <em>Settings → Secrets</em>, jamais visible dans les logs.`
        }
    ];

    static ensureStyles() {
        if (GitHubActionsWidget._stylesInjected) return;
        GitHubActionsWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gaw-root {
    font-family: var(--font);
    color: var(--text);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
}
@media (max-width: 700px) {
    .gaw-root { grid-template-columns: 1fr; }
}

/* Panneau YAML */
.gaw-yaml-panel {
    background: #1e293b;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid #334155;
}
.gaw-yaml-bar {
    background: #334155;
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    color: #94a3b8;
    font-family: var(--font-mono);
}
.gaw-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
}
.gaw-dot-r { background: #ef4444; }
.gaw-dot-y { background: #f59e0b; }
.gaw-dot-g { background: #22c55e; }
.gaw-yaml-body {
    padding: 0.75rem 0.5rem;
    overflow-y: auto;
    max-height: 480px;
}
.gaw-line {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.7;
    padding: 0 0.5rem;
    border-radius: 3px;
    cursor: default;
    white-space: pre;
    color: #cbd5e1;
    transition: background 0.15s;
}
.gaw-line.clickable {
    cursor: pointer;
}
.gaw-line.clickable:hover {
    filter: brightness(1.2);
}
.gaw-line.highlighted {
    font-weight: 600;
}

/* Panneau d'explication */
.gaw-explain-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}
.gaw-legend {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}
.gaw-legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 2px solid;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 600;
    transition: all 0.15s;
    background: var(--card);
}
.gaw-legend-item:hover { filter: brightness(0.97); }
.gaw-legend-item.active { color: #fff; }
.gaw-legend-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.gaw-explain-box {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-left: 4px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.85rem 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
    min-height: 120px;
}
.gaw-explain-title {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.85rem;
    margin-bottom: 0.4rem;
}
.gaw-hint {
    font-size: 0.75rem;
    color: var(--muted);
    font-style: italic;
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitHubActionsWidget.ensureStyles();

        let activeRegion = null;

        const lines = GitHubActionsWidget.WORKFLOW.split('\n');

        // Map line index → region
        const lineRegion = {};
        GitHubActionsWidget.REGIONS.forEach(r => {
            r.lines.forEach(l => { lineRegion[l] = r; });
        });

        const getRegionForLine = (idx) => lineRegion[idx] || null;

        const escHtml = (str) => String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const render = () => {
            const yamlHtml = lines.map((line, idx) => {
                const region = getRegionForLine(idx);
                const isActive = activeRegion && region && region.id === activeRegion.id;
                const isClickable = !!region;
                const bg = isClickable
                    ? (isActive ? region.color + '40' : region.color + '18')
                    : 'transparent';
                const border = isActive ? `border-left: 3px solid ${region.color}; padding-left: calc(0.5rem - 3px)` : '';
                return `<span class="gaw-line${isClickable ? ' clickable' : ''}${isActive ? ' highlighted' : ''}"
                    data-line="${idx}"
                    style="background:${bg};${border};color:${isActive ? '#f8fafc' : ''}"
                >${escHtml(line) || ' '}</span>`;
            }).join('');

            const legendHtml = GitHubActionsWidget.REGIONS.map(r => {
                const isActive = activeRegion && activeRegion.id === r.id;
                return `<div class="gaw-legend-item${isActive ? ' active' : ''}"
                    data-region="${r.id}"
                    style="border-color:${r.color};${isActive ? `background:${r.color}` : ''}"
                >
                    <span class="gaw-legend-dot" style="background:${r.color}"></span>
                    ${r.title}
                </div>`;
            }).join('');

            const explainHtml = activeRegion
                ? `<div class="gaw-explain-title">${activeRegion.title}</div>${activeRegion.explain}`
                : `<div class="gaw-hint">Cliquez sur une section colorée du YAML ou sur un élément de la légende pour voir son explication.</div>`;

            const borderColor = activeRegion ? activeRegion.color : 'var(--border)';

            container.innerHTML = `
<div class="gaw-root">
    <div class="gaw-yaml-panel">
        <div class="gaw-yaml-bar">
            <span class="gaw-dot gaw-dot-r"></span>
            <span class="gaw-dot gaw-dot-y"></span>
            <span class="gaw-dot gaw-dot-g"></span>
            .github/workflows/ci.yml
        </div>
        <div class="gaw-yaml-body" id="gaw-yaml">${yamlHtml}</div>
    </div>
    <div class="gaw-explain-panel">
        <div class="gaw-legend">${legendHtml}</div>
        <div class="gaw-explain-box" style="border-left-color:${borderColor}">
            ${explainHtml}
        </div>
    </div>
</div>`;

            // Click on YAML lines
            container.querySelector('#gaw-yaml')?.addEventListener('click', (e) => {
                const lineEl = e.target.closest('[data-line]');
                if (!lineEl) return;
                const idx = parseInt(lineEl.dataset.line, 10);
                const region = getRegionForLine(idx);
                if (!region) return;
                activeRegion = (activeRegion && activeRegion.id === region.id) ? null : region;
                render();
            });

            // Click on legend
            container.querySelectorAll('[data-region]').forEach(el => {
                el.addEventListener('click', () => {
                    const rid = el.dataset.region;
                    const region = GitHubActionsWidget.REGIONS.find(r => r.id === rid);
                    activeRegion = (activeRegion && activeRegion.id === rid) ? null : region;
                    render();
                    // Scroll to first line of region
                    if (activeRegion) {
                        const firstLineEl = container.querySelector(`[data-line="${activeRegion.lines[0]}"]`);
                        firstLineEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitHubActionsWidget = GitHubActionsWidget;
