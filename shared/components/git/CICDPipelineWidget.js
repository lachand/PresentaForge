/**
 * CICDPipelineWidget — simulation visuelle d'un pipeline CI/CD.
 * Déclenché par un push/PR, montre les étapes Lint → Tests → Build → Deploy.
 */
class CICDPipelineWidget {
    static mount(container, config = {}) {
        const STAGES = [
            {
                id: 'checkout', icon: '📥', name: 'Checkout', duration: 600,
                subdesc: 'Clone & setup',
                desc: 'Clone le dépôt et checkout le commit cible. Prépare l\'environnement du runner CI (variables, cache…).',
                errors: [
                    { t: 'cmd', v: '$ git clone https://github.com/org/repo.git' },
                    { t: 'err', v: 'fatal: repository not found' },
                    { t: 'err', v: 'Error: Process completed with exit code 128.' }
                ]
            },
            {
                id: 'lint', icon: '🔍', name: 'Lint', duration: 1200,
                subdesc: 'ESLint / Flake8…',
                desc: 'Analyse statique du code : respect des conventions de style, détection des erreurs communes, formatage (ESLint, Flake8, Prettier…).',
                errors: [
                    { t: 'cmd', v: '$ eslint src/' },
                    { t: '',    v: 'src/api/auth.js' },
                    { t: 'err', v: '  42:5  error  \'result\' is defined but never used  no-unused-vars' },
                    { t: 'err', v: '  67:3  error  Expected \'===\' instead of \'==\'    eqeqeq' },
                    { t: 'warn', v: '✖ 2 problems (2 errors, 0 warnings)' },
                    { t: 'err', v: 'Error: Process completed with exit code 1.' }
                ]
            },
            {
                id: 'tests', icon: '🧪', name: 'Tests', duration: 1800,
                subdesc: 'Jest / pytest…',
                desc: 'Exécute les tests unitaires et d\'intégration. Un seul test qui échoue fait échouer l\'étape et bloque les suivantes.',
                errors: [
                    { t: 'cmd',  v: '$ jest --ci' },
                    { t: 'err',  v: 'FAIL src/auth.test.js' },
                    { t: '',     v: '  ● AuthService › login › valid credentials' },
                    { t: 'err',  v: '    Expected: 200' },
                    { t: 'err',  v: '    Received: 401' },
                    { t: 'warn', v: 'Tests: 1 failed, 18 passed, 19 total' },
                    { t: 'err',  v: 'Error: Process completed with exit code 1.' }
                ]
            },
            {
                id: 'build', icon: '🏗️', name: 'Build', duration: 1400,
                subdesc: 'webpack / tsc…',
                desc: 'Compile et bundle l\'application (TypeScript, webpack, Gradle…). Génère les artefacts déployables (image Docker, .jar, bundle JS…).',
                errors: [
                    { t: 'cmd', v: '$ tsc --noEmit' },
                    { t: 'err', v: 'src/models/User.ts:15:5 - error TS2339:' },
                    { t: 'err', v: '  Property \'email\' does not exist on type \'UserBase\'.' },
                    { t: '',    v: '15     this.email = email;' },
                    { t: '',    v: '       ~~~~~' },
                    { t: 'warn', v: 'Found 1 error in src/models/User.ts:15' },
                    { t: 'err', v: 'Error: Process completed with exit code 2.' }
                ]
            },
            {
                id: 'deploy', icon: '🚀', name: 'Deploy staging', duration: 1000,
                subdesc: 'Docker / K8s…',
                desc: 'Déploie l\'artefact sur l\'environnement de staging (Kubernetes, Heroku, Fly.io…). Si les tests de smoke passent, la PR est prête pour review.',
                errors: [
                    { t: 'cmd', v: '$ kubectl rollout status deployment/app' },
                    { t: '',    v: 'Waiting for deployment "app" rollout to finish...' },
                    { t: 'err', v: 'error: container "api" in pod "app-7d9b4c6f8" is waiting:' },
                    { t: 'err', v: '  OOMKilled (container exceeded memory limit 256Mi)' },
                    { t: 'err', v: 'Error: Deployment did not complete within timeout.' },
                    { t: 'err', v: 'Error: Process completed with exit code 1.' }
                ]
            }
        ];

        const SPEED_MAP = {
            1: { label: 'Très lent',   mult: 4.0 },
            2: { label: 'Lent',        mult: 2.0 },
            3: { label: 'Normal',      mult: 1.0 },
            4: { label: 'Rapide',      mult: 0.35 },
            5: { label: 'Très rapide', mult: 0.08 }
        };

        let running = false;
        let paused  = false;
        let speedLevel = 3;
        let stageStates = {};
        let failAt = 'none';
        let currentRunId = 0;
        let pauseResolve = null;

        const resetStates = () => {
            STAGES.forEach(s => { stageStates[s.id] = 'idle'; });
        };
        resetStates();

        const waitIfPaused = () => new Promise(resolve => {
            if (!paused) { resolve(); return; }
            pauseResolve = resolve;
        });

        const doResume = () => {
            if (pauseResolve) { pauseResolve(); pauseResolve = null; }
        };

        const render = () => {
            const failedStage  = STAGES.find(s => stageStates[s.id] === 'failure');
            const runningStage = STAGES.find(s => stageStates[s.id] === 'running');
            const detailStage  = failedStage || runningStage;
            const isFailed     = !!failedStage;

            const detailPanel = detailStage ? `
<div class="cicd-detail">
  <div class="cicd-detail-head ${isFailed ? 'failure' : 'running'}">
    ${detailStage.icon} <strong>${detailStage.name}</strong> — ${isFailed ? '❌ Échec' : '⏳ En cours…'}
  </div>
  <div class="cicd-detail-desc">${detailStage.desc}</div>
  ${isFailed ? `<div class="cicd-error-term">${detailStage.errors.map(l =>
      `<div class="${l.t === 'cmd' ? 't-cmd' : l.t === 'err' ? 't-err' : l.t === 'warn' ? 't-warn' : ''}">${l.v}</div>`
  ).join('')}</div>` : ''}
</div>` : '';

            container.innerHTML = `
<div class="cicd-root">
  <div class="cicd-trigger">
    <label>Panne à l'étape :</label>
    <select id="cicd-fail-select">
      <option value="none">Aucune (tout réussit)</option>
      ${STAGES.map(s => `<option value="${s.id}" ${failAt === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>
    <button class="btn btn-primary" id="cicd-run" ${running ? 'disabled' : ''}>▶ Déclencher</button>
    <button class="btn btn-secondary" id="cicd-reset">Réinitialiser</button>
    <label style="margin-left:0.25rem">Vitesse :</label>
    <input type="range" id="cicd-speed" min="1" max="5" value="${speedLevel}" style="width:70px;accent-color:var(--primary);cursor:pointer;vertical-align:middle;">
    <span id="cicd-speed-label" style="font-size:0.75rem;color:var(--muted);min-width:5rem">${SPEED_MAP[speedLevel].label}</span>
    ${running ? `<button class="btn btn-secondary" id="cicd-pause" style="min-width:7.5rem">${paused ? '▶ Reprendre' : '⏸ Pause'}</button>` : ''}
  </div>
  <div class="cicd-pipeline">
    ${STAGES.map((s, i) => `
      <div class="cicd-stage ${stageStates[s.id]}" id="cicd-stage-${s.id}">
        <div class="cicd-stage-icon">${stageStates[s.id] === 'running' ? '⏳' : stageStates[s.id] === 'success' ? '✅' : stageStates[s.id] === 'failure' ? '❌' : stageStates[s.id] === 'blocked' ? '⛔' : s.icon}</div>
        <div class="cicd-stage-name">${s.name}</div>
        <div class="cicd-stage-subdesc">${s.subdesc}</div>
        <div class="cicd-stage-status">${stageStates[s.id] === 'running' ? 'En cours…' : stageStates[s.id] === 'success' ? 'Passé ✓' : stageStates[s.id] === 'failure' ? 'Échec' : stageStates[s.id] === 'blocked' ? 'Bloqué' : '—'}</div>
      </div>
      ${i < STAGES.length - 1 ? '<div class="cicd-arrow">→</div>' : ''}
    `).join('')}
  </div>
  ${detailPanel}
  <div class="cicd-result ${running ? 'running' : stageStates[STAGES[STAGES.length-1].id] === 'success' ? 'success' : Object.values(stageStates).includes('failure') ? 'failure' : 'idle'}" id="cicd-result">
    ${running
      ? (paused ? '⏸ Pipeline en pause — cliquez sur Reprendre.' : '⏳ Pipeline en cours d\'exécution…')
      : Object.values(stageStates).includes('failure')
        ? `❌ Pipeline échoué à l'étape <strong>${STAGES.find(s => stageStates[s.id] === 'failure')?.name}</strong>. Les étapes suivantes sont bloquées — la PR ne peut pas être mergée.`
        : stageStates[STAGES[STAGES.length-1].id] === 'success'
          ? '✅ Tous les checks sont passés. La PR peut être mergée.'
          : 'Cliquez sur "Déclencher" pour simuler un push.'}
  </div>
  <div class="cicd-info">
    Ce pipeline correspond à un fichier <code>.github/workflows/ci.yml</code> déclenché sur l'événement <code>pull_request</code>. Les status checks échoués bloquent le merge si la branch protection est activée.
  </div>
</div>`;

            container.querySelector('#cicd-fail-select')?.addEventListener('change', (e) => { failAt = e.target.value; });

            container.querySelector('#cicd-speed')?.addEventListener('input', (e) => {
                speedLevel = parseInt(e.target.value);
                const lbl = container.querySelector('#cicd-speed-label');
                if (lbl) lbl.textContent = SPEED_MAP[speedLevel].label;
            });

            container.querySelector('#cicd-pause')?.addEventListener('click', () => {
                if (!running) return;
                if (paused) {
                    paused = false;
                    doResume();
                } else {
                    paused = true;
                }
                render();
            });

            container.querySelector('#cicd-reset')?.addEventListener('click', () => {
                currentRunId++;
                running = false;
                paused = false;
                doResume();
                resetStates();
                render();
            });

            container.querySelector('#cicd-run')?.addEventListener('click', () => {
                if (running) return;
                running = true;
                paused = false;
                resetStates();
                const runId = ++currentRunId;
                render();
                runPipeline(runId);
            });
        };

        const runPipeline = async (runId) => {
            for (const stage of STAGES) {
                if (currentRunId !== runId) return;
                stageStates[stage.id] = 'running';
                render();
                await waitIfPaused();
                if (currentRunId !== runId) return;
                const delay = Math.round(stage.duration * SPEED_MAP[speedLevel].mult);
                await new Promise(r => setTimeout(r, delay));
                if (currentRunId !== runId) return;
                await waitIfPaused();
                if (currentRunId !== runId) return;
                if (failAt === stage.id) {
                    stageStates[stage.id] = 'failure';
                    STAGES.slice(STAGES.indexOf(stage) + 1).forEach(s => { stageStates[s.id] = 'blocked'; });
                    running = false;
                    paused = false;
                    render();
                    return;
                }
                stageStates[stage.id] = 'success';
            }
            running = false;
            paused = false;
            render();
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.CICDPipelineWidget = CICDPipelineWidget;
