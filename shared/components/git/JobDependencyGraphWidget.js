class JobDependencyGraphWidget {
    static computeLevels(jobs) {
        const levels = {};
        jobs.forEach(j => levels[j.id] = 0);
        let changed = true;
        while (changed) {
            changed = false;
            jobs.forEach(j => {
                const max = Math.max(0, ...(j.needs || []).map(n => (levels[n] ?? 0) + 1));
                if (max > levels[j.id]) { levels[j.id] = max; changed = true; }
            });
        }
        return levels;
    }

    static mount(container, config = {}) {
        const SCENARIOS = [
            {
                name: 'CI basique (1 job)',
                jobs: [
                    { id: 'test', icon: 'flask', label: 'test', needs: [], runner: 'ubuntu-latest' }
                ]
            },
            {
                name: 'Test → Déploiement',
                jobs: [
                    { id: 'test',   icon: 'flask', label: 'test',   needs: [],       runner: 'ubuntu-latest' },
                    { id: 'deploy', icon: 'rocket', label: 'deploy', needs: ['test'], runner: 'ubuntu-latest', cond: "ref == 'main'" }
                ]
            },
            {
                name: 'Pipeline CI/CD complet',
                jobs: [
                    { id: 'lint',   icon: 'check', label: 'lint',   needs: [],              runner: 'ubuntu-latest' },
                    { id: 'test',   icon: 'flask', label: 'test',   needs: [],              runner: 'ubuntu-latest' },
                    { id: 'build',  icon: 'blocks', label: 'build',  needs: ['lint','test'], runner: 'ubuntu-latest' },
                    { id: 'deploy', icon: 'rocket', label: 'deploy', needs: ['build'],        runner: 'ubuntu-latest', cond: "ref == 'main'" }
                ]
            },
            {
                name: 'Multi-environnement',
                jobs: [
                    { id: 'test',    icon: 'flask', label: 'test',         needs: [],         runner: 'ubuntu-latest' },
                    { id: 'staging', icon: 'upload', label: 'deploy-staging', needs: ['test'],    runner: 'ubuntu-latest' },
                    { id: 'prod',    icon: 'rocket', label: 'deploy-prod',    needs: ['staging'], runner: 'ubuntu-latest', cond: 'approval requis' }
                ]
            }
        ];

        let scenarioIdx = 2;
        let jobStates = {};   // id → 'waiting'|'running'|'success'|'failed'|'blocked'
        let willFail = new Set();
        let simRunning = false;

        function resetJobStates(jobs) {
            jobStates = {};
            jobs.forEach(j => jobStates[j.id] = 'waiting');
        }

        const STATE_LABELS = { running: ['refresh', 'en cours...'], success: ['check', 'réussi'], failed: ['close', 'échoué'], blocked: ['ban', 'bloqué'] };
        function stateLabel(state) {
            return STATE_LABELS[state] || [null, ''];
        }
        function stateLabelHtml(state) {
            const [icon, text] = stateLabel(state);
            return (icon ? OEIIcons.render(icon) + ' ' : '') + text;
        }

        function updateJobEl(id) {
            const el = container.querySelector(`[data-job="${id}"]`);
            if (!el) return;
            const state = jobStates[id] || 'waiting';
            const wfClass = (!simRunning && willFail.has(id)) ? ' will-fail' : '';
            el.className = `jdg-job state-${state}${wfClass}`;
            const statusEl = el.querySelector('.jdg-job-status');
            if (statusEl) OEIIcons.setLabel(statusEl, stateLabel(state));
        }

        function appendLog(msg, cls = '', icon = null) {
            const logEl = container.querySelector('.jdg-log');
            if (!logEl) return;
            const line = document.createElement('div');
            line.className = `jdg-log-line ${cls}`;
            OEIIcons.setLabel(line, icon, msg);
            logEl.appendChild(line);
            logEl.scrollTop = logEl.scrollHeight;
        }

        function clearLog() {
            const logEl = container.querySelector('.jdg-log');
            if (logEl) logEl.innerHTML = '';
        }

        function drawConnections(connections) {
            const canvas = container.querySelector('.jdg-canvas');
            if (!canvas) return;
            let svg = canvas.querySelector('.jdg-svg-layer');
            if (!svg) {
                svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.classList.add('jdg-svg-layer');
                canvas.insertBefore(svg, canvas.firstChild);
            }
            const canvasRect = canvas.getBoundingClientRect();
            const defs = `<defs><marker id="jdg-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill="var(--ink-muted)"/></marker></defs>`;
            const paths = connections.map(({ from, to }) => {
                const fromEl = canvas.querySelector(`[data-job="${from}"]`);
                const toEl   = canvas.querySelector(`[data-job="${to}"]`);
                if (!fromEl || !toEl) return '';
                const fr = fromEl.getBoundingClientRect();
                const tr = toEl.getBoundingClientRect();
                const x1 = fr.right  - canvasRect.left;
                const y1 = fr.top    + fr.height / 2 - canvasRect.top;
                const x2 = tr.left   - canvasRect.left;
                const y2 = tr.top    + tr.height / 2 - canvasRect.top;
                const cx = (x1 + x2) / 2;
                return `<path d="M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}" stroke="var(--ink-muted)" stroke-width="1.5" fill="none" marker-end="url(#jdg-arrow)" stroke-dasharray="4 2"/>`;
            }).filter(Boolean).join('');
            svg.innerHTML = defs + paths;
        }

        function render() {
            const scenario = SCENARIOS[scenarioIdx];
            const jobs = scenario.jobs;
            const levels = JobDependencyGraphWidget.computeLevels(jobs);
            const maxLevel = Math.max(0, ...Object.values(levels));
            const cols = [];
            for (let l = 0; l <= maxLevel; l++) cols.push(jobs.filter(j => levels[j.id] === l));
            const connections = [];
            jobs.forEach(j => (j.needs || []).forEach(n => connections.push({ from: n, to: j.id })));

            container.innerHTML = `<div class="jdg widget-fit">
                <div class="jdg-toolbar widget-fit-header">
                    <span class="jdg-toolbar-label">Scénario :</span>
                    <select class="jdg-select">${SCENARIOS.map((s, i) =>
                        `<option value="${i}"${i === scenarioIdx ? ' selected' : ''}>${s.name}</option>`
                    ).join('')}</select>
                    <button class="jdg-btn jdg-btn-play">${OEIIcons.render('play')} Simuler</button>
                    <button class="jdg-btn jdg-btn-reset">${OEIIcons.render('refresh')} Réinitialiser</button>
                </div>
                <div class="widget-fit-body">
                    <div class="jdg-canvas">
                        ${cols.map(colJobs => `<div class="jdg-col">${colJobs.map(j => `
                            <div class="jdg-job state-${jobStates[j.id] || 'waiting'}${willFail.has(j.id) ? ' will-fail' : ''}" data-job="${j.id}">
                                <div class="jdg-job-name">${OEIIcons.render(j.icon)} ${j.label}</div>
                                <div class="jdg-job-runner">${j.runner}</div>
                                ${j.cond ? `<div class="jdg-job-cond">if: ${j.cond}</div>` : ''}
                                <div class="jdg-job-status">${stateLabelHtml(jobStates[j.id] || 'waiting')}</div>
                            </div>`).join('')}</div>`).join('')}
                    </div>
                    <div class="jdg-log"><div class="jdg-log-line">En attente : cliquez sur Simuler pour lancer le pipeline.</div></div>
                </div>
                <p class="jdg-hint widget-fit-footer">${OEIIcons.render('lightbulb')} Cliquez sur un job avant de simuler pour le forcer à échouer et observer les effets en cascade.</p>
            </div>`;

            requestAnimationFrame(() => drawConnections(connections));

            container.querySelector('.jdg-select').addEventListener('change', e => {
                scenarioIdx = +e.target.value;
                willFail = new Set();
                simRunning = false;
                resetJobStates(SCENARIOS[scenarioIdx].jobs);
                render();
            });

            container.querySelector('.jdg-btn-play').addEventListener('click', () => {
                simulate(cols, jobs);
            });

            container.querySelector('.jdg-btn-reset').addEventListener('click', () => {
                if (simRunning) return;
                willFail = new Set();
                resetJobStates(jobs);
                jobs.forEach(j => updateJobEl(j.id));
                clearLog();
                container.querySelector('.jdg-log').innerHTML =
                    '<div class="jdg-log-line">En attente : cliquez sur Simuler pour lancer le pipeline.</div>';
                const playBtn = container.querySelector('.jdg-btn-play');
                if (playBtn) playBtn.disabled = false;
            });

            container.querySelectorAll('.jdg-job').forEach(el => {
                el.addEventListener('click', () => {
                    if (simRunning) return;
                    const id = el.dataset.job;
                    if (willFail.has(id)) willFail.delete(id);
                    else willFail.add(id);
                    updateJobEl(id);
                    const forced = willFail.has(id);
                    clearLog();
                    appendLog(forced
                        ? `"${id}" forcé en échec : les jobs dépendants seront bloqués.`
                        : `"${id}" remis en réussite.`, '', forced ? 'warning' : 'check');
                });
            });
        }

        async function simulate(cols, jobs) {
            if (simRunning) return;
            simRunning = true;
            const playBtn = container.querySelector('.jdg-btn-play');
            if (playBtn) playBtn.disabled = true;

            resetJobStates(jobs);
            jobs.forEach(j => updateJobEl(j.id));
            clearLog();

            const failed  = new Set();
            const blocked = new Set();

            for (let l = 0; l < cols.length; l++) {
                const colJobs = cols[l];
                const toRun = [];
                for (const j of colJobs) {
                    const isBlocked = (j.needs || []).some(n => failed.has(n) || blocked.has(n));
                    if (isBlocked) {
                        blocked.add(j.id);
                        jobStates[j.id] = 'blocked';
                        updateJobEl(j.id);
                        appendLog(`"${j.id}" bloqué : une dépendance a échoué.`, 'skip', 'ban');
                    } else {
                        toRun.push(j);
                    }
                }

                if (toRun.length === 0) continue;

                toRun.forEach(j => {
                    jobStates[j.id] = 'running';
                    updateJobEl(j.id);
                    appendLog(`Démarrage de "${j.id}"…`, 'run', 'refresh');
                });
                await new Promise(r => setTimeout(r, 1100));

                for (const j of toRun) {
                    const state = willFail.has(j.id) ? 'failed' : 'success';
                    jobStates[j.id] = state;
                    if (state === 'failed') {
                        failed.add(j.id);
                        appendLog(`"${j.id}" a échoué !`, 'fail', 'close');
                    } else {
                        appendLog(`"${j.id}" réussi`, 'ok', 'check');
                    }
                    updateJobEl(j.id);
                }
                await new Promise(r => setTimeout(r, 350));
            }

            const anyFailed = failed.size > 0;
            appendLog(
                anyFailed
                    ? `Pipeline terminé avec ${failed.size} erreur(s). Les jobs bloqués n'ont pas été exécutés.`
                    : 'Pipeline complet : tous les jobs ont réussi !',
                anyFailed ? 'fail' : 'ok',
                anyFailed ? 'close' : 'check'
            );

            simRunning = false;
            if (playBtn) playBtn.disabled = false;
        }

        resetJobStates(SCENARIOS[scenarioIdx].jobs);
        render();
        return { destroy() {} };
    }
}
window.JobDependencyGraphWidget = JobDependencyGraphWidget;
