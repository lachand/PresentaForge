/**
 * CICDPipelineWidget — simulation visuelle d'un pipeline CI/CD.
 * Déclenché par un push/PR, montre les étapes Lint → Tests → Build → Deploy.
 */
class CICDPipelineWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (CICDPipelineWidget._stylesInjected) return;
        CICDPipelineWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.cicd-root { font-family: var(--font); }
.cicd-trigger {
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: 0.75rem 1rem; background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 1rem;
}
.cicd-trigger label { font-size: 0.82rem; font-weight: 600; color: var(--text); }
.cicd-trigger select {
    font-family: var(--font); font-size: 0.82rem; padding: 0.35rem 0.6rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card); color: var(--text);
}
.cicd-pipeline {
    display: flex; align-items: center; gap: 0; margin-bottom: 1rem;
    overflow-x: auto; padding: 0.5rem 0;
}
@media (max-width: 640px) {
    .cicd-pipeline { flex-direction: column; align-items: stretch; gap: 0.25rem; }
    .cicd-arrow { transform: rotate(90deg); }
}
.cicd-stage {
    flex: 1; min-width: 100px; text-align: center;
    padding: 0.75rem 0.5rem; border-radius: var(--radius);
    border: 2px solid var(--border); background: var(--card);
    transition: all 0.3s ease;
}
.cicd-stage.running { border-color: #f59e0b; background: #fffbeb; }
.cicd-stage.success { border-color: #10b981; background: #ecfdf5; }
.cicd-stage.failure { border-color: #ef4444; background: #fef2f2; }
.cicd-stage.blocked { border-color: var(--border); background: var(--bg); opacity: 0.5; }
.cicd-stage-icon { font-size: 1.3rem; margin-bottom: 0.25rem; }
.cicd-stage-name { font-size: 0.78rem; font-weight: 700; color: var(--text); }
.cicd-stage-status {
    font-size: 0.7rem; margin-top: 0.2rem; min-height: 1.2em;
    color: var(--muted); font-family: var(--font-mono);
}
.cicd-arrow { color: var(--border); font-size: 1.2rem; padding: 0 0.25rem; flex-shrink: 0; }
.cicd-result {
    padding: 0.75rem 1rem; border-radius: var(--radius);
    font-size: 0.85rem; font-weight: 600; text-align: center; min-height: 2.5rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    transition: all 0.3s;
}
.cicd-result.idle { background: var(--bg); border: 1px solid var(--border); color: var(--muted); }
.cicd-result.running { background: #fffbeb; border: 1px solid #f59e0b; color: #92400e; }
.cicd-result.success { background: #ecfdf5; border: 1px solid #10b981; color: #065f46; }
.cicd-result.failure { background: #fef2f2; border: 1px solid #ef4444; color: #991b1b; }
.cicd-stage-subdesc {
    font-size: 0.65rem; color: var(--muted); margin-top: 0.15rem;
    font-family: var(--font); line-height: 1.2;
}
.cicd-stage.running .cicd-stage-subdesc,
.cicd-stage.success .cicd-stage-subdesc { color: inherit; opacity: 0.7; }
.cicd-detail {
    margin-bottom: 0.75rem; border-radius: var(--radius);
    border: 1.5px solid var(--border); overflow: hidden;
}
.cicd-detail-head {
    padding: 0.5rem 0.85rem; font-size: 0.82rem; font-weight: 600;
    background: var(--card); border-bottom: 1px solid var(--border);
    color: var(--text);
}
.cicd-detail-head.running { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
.cicd-detail-head.failure { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.cicd-detail-desc {
    padding: 0.5rem 0.85rem; font-size: 0.8rem; color: var(--muted);
    background: var(--bg); line-height: 1.5;
}
.cicd-error-term {
    margin: 0; padding: 0.6rem 0.85rem;
    background: #1e293b; font-family: var(--font-mono);
    font-size: 0.73rem; line-height: 1.7; color: #94a3b8;
    max-height: 160px; overflow-y: auto;
}
.cicd-error-term .t-cmd  { color: #e2e8f0; }
.cicd-error-term .t-err  { color: #f87171; }
.cicd-error-term .t-warn { color: #fbbf24; }
.cicd-info {
    margin-top: 0.75rem; font-size: 0.75rem; color: var(--muted);
    padding: 0.5rem 0.75rem; background: var(--bg); border-radius: var(--radius-sm);
    border-left: 3px solid var(--primary);
}
@keyframes cicdSpin {
    from { content: "⏳"; }
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        CICDPipelineWidget.ensureStyles();

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
