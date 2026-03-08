/**
 * GitBisectWidget — simulation interactive de git bisect.
 * L'étudiant marque good/bad pour trouver le commit coupable par dichotomie.
 */
class GitBisectWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitBisectWidget._stylesInjected) return;
        GitBisectWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gbw-root { font-family: var(--font); }
.gbw-info {
    font-size: 0.82rem; padding: 0.65rem 0.85rem;
    border-radius: var(--radius); margin-bottom: 0.75rem;
    border: 1.5px solid; line-height: 1.5;
}
.gbw-info.neutral { background: #eef2ff; border-color: #a5b4fc; color: #3730a3; }
.gbw-info.found   { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
.gbw-timeline {
    display: flex; align-items: center; gap: 0;
    overflow-x: auto; padding: 1rem 0.5rem;
    background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius); margin-bottom: 0.75rem;
}
.gbw-commit {
    display: flex; flex-direction: column; align-items: center;
    cursor: default; flex-shrink: 0; width: 40px;
}
.gbw-circle {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2.5px solid #d1d5db; background: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 700; color: #6b7280;
    transition: all 0.3s; position: relative; z-index: 1;
}
.gbw-commit.excluded .gbw-circle { opacity: 0.25; }
.gbw-commit.good .gbw-circle     { border-color: #10b981; background: #ecfdf5; color: #065f46; }
.gbw-commit.bad  .gbw-circle     { border-color: #ef4444; background: #fef2f2; color: #991b1b; }
.gbw-commit.current .gbw-circle  { border-color: #f59e0b; background: #fffbeb; color: #92400e; box-shadow: 0 0 0 3px rgba(245,158,11,0.25); width: 34px; height: 34px; font-size: 0.75rem; }
.gbw-commit.culprit .gbw-circle  { border-color: #ef4444; background: #ef4444; color: white; width: 34px; height: 34px; font-size: 0.85rem; box-shadow: 0 0 0 4px rgba(239,68,68,0.3); }
.gbw-label {
    font-size: 0.6rem; color: var(--muted); margin-top: 0.2rem;
    white-space: nowrap; text-align: center; max-width: 40px;
    overflow: hidden; text-overflow: ellipsis;
}
.gbw-connector {
    flex: 0 0 8px; height: 2px; background: #e5e7eb;
    margin-top: -8px; flex-shrink: 0;
}
.gbw-connector.active { background: #4f46e5; }
.gbw-actions {
    display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;
    align-items: center;
}
.gbw-step-info { font-size: 0.8rem; color: var(--muted); flex: 1; }
.gbw-log {
    font-size: 0.75rem; font-family: var(--font-mono); color: var(--muted);
    background: #1e293b; color: #94a3b8; padding: 0.6rem 0.75rem;
    border-radius: var(--radius-sm); max-height: 120px; overflow-y: auto;
    line-height: 1.6; margin-bottom: 0.5rem;
}
.gbw-log .good-line  { color: #4ade80; }
.gbw-log .bad-line   { color: #f87171; }
.gbw-log .found-line { color: #fbbf24; font-weight: 700; }
.gbw-scenario {
    font-size: 0.82rem; padding: 0.65rem 0.85rem;
    background: #fef3c7; border: 1.5px solid #f59e0b;
    border-radius: var(--radius); margin-bottom: 0.75rem;
    line-height: 1.5; color: #78350f;
}
.gbw-scenario code {
    background: rgba(0,0,0,0.07); padding: 0.1rem 0.3rem;
    border-radius: 3px; font-family: var(--font-mono); font-size: 0.85em;
}
.gbw-test-output {
    font-family: var(--font-mono); font-size: 0.78rem;
    padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);
    border: 1.5px solid; margin-bottom: 0.6rem; line-height: 1.6;
}
.gbw-test-output.good { background: #f0fdf4; border-color: #86efac; color: #14532d; }
.gbw-test-output.bad  { background: #fef2f2; border-color: #fca5a5; color: #7f1d1d; }
.gbw-test-cmd  { color: #6b7280; margin-bottom: 0.2rem; }
.gbw-test-result-line { font-weight: 700; }
.gbw-caption {
    font-size: 0.75rem; color: var(--muted); text-align: center;
    padding-top: 0.5rem; border-top: 1px solid var(--border);
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitBisectWidget.ensureStyles();

        const N = 16;
        const CULPRIT = 10; // commit #10 introduced the bug (1-indexed)

        // Labels pour les commits-clés (affichés sous le cercle)
        const COMMIT_LABELS = {
            1: 'v1.0', 5: 'feat:sort', 8: 'fix:null',
            10: 'refactor', 13: 'test:cov', 16: 'HEAD'
        };

        let goodBound = 1;
        let badBound = N;
        let current = null;
        let found = false;
        let steps = 0;
        let log = [];
        let commitStates = {}; // 'good' | 'bad' | 'current' | 'culprit' | 'excluded' | ''

        const isBad = (n) => n >= CULPRIT;

        const initState = () => {
            goodBound = 1;
            badBound = N;
            found = false;
            steps = 0;
            log = [];
            for (let i = 1; i <= N; i++) commitStates[i] = '';
            commitStates[1] = 'good';
            commitStates[N] = 'bad';
            current = null;
            log.push(`$ git bisect start`);
            log.push(`$ git bisect bad HEAD    # commit #${N} est mauvais`);
            log.push(`$ git bisect good v1.0   # commit #1 était bon`);
        };

        const nextMid = () => Math.floor((goodBound + badBound) / 2);

        const startBisect = () => {
            current = nextMid();
            for (let i = 1; i <= N; i++) {
                if (i < goodBound || i > badBound) commitStates[i] = 'excluded';
                else if (i === 1) commitStates[i] = 'good';
                else if (i === N) commitStates[i] = 'bad';
                else if (i === current) commitStates[i] = 'current';
                else commitStates[i] = '';
            }
            log.push(`# → Bisecting: ${badBound - goodBound - 1} revisions left (~${Math.ceil(Math.log2(badBound - goodBound))} steps)`);
            log.push(`# Git checkout le commit #${current} — testez-le maintenant`);
        };

        const markGood = () => {
            if (found || current === null) return;
            log.push(`$ git bisect good   # commit #${current} est bon`);
            commitStates[current] = 'good';
            goodBound = current;
            steps++;
            checkDone();
        };

        const markBad = () => {
            if (found || current === null) return;
            log.push(`$ git bisect bad    # commit #${current} est mauvais`);
            commitStates[current] = 'bad';
            badBound = current;
            steps++;
            checkDone();
        };

        const checkDone = () => {
            if (badBound - goodBound <= 1) {
                found = true;
                current = null;
                commitStates[CULPRIT] = 'culprit';
                log.push(`# 🎯 ${CULPRIT === badBound ? badBound : CULPRIT} est le premier commit mauvais !`);
                log.push(`# Author: Bob <bob@example.com>`);
                log.push(`# refactor: optimisation de la boucle principale`);
                log.push(`$ git bisect reset`);
            } else {
                startBisect();
            }
            render();
        };

        const stepsLeft = () => Math.ceil(Math.log2(badBound - goodBound + 1));

        // Sortie mock du test pour un commit donné
        const mockTestOutput = (n) => {
            const bad = isBad(n);
            return `
<div class="gbw-test-output ${bad ? 'bad' : 'good'}">
  <div class="gbw-test-cmd">$ python -c "from app import calculate_sum; print(calculate_sum([1, 2, 3]))"</div>
  <div class="gbw-test-result-line">${bad ? '7   ← résultat incorrect (attendu : 6) ❌' : '6   ← résultat correct ✓'}</div>
  ${bad ? '<div style="margin-top:0.2rem;font-size:0.72rem;opacity:0.8">Ce commit contient le bug → marquer <strong>bad</strong></div>'
         : '<div style="margin-top:0.2rem;font-size:0.72rem;opacity:0.8">Ce commit fonctionne correctement → marquer <strong>good</strong></div>'}
</div>`;
        };

        const render = () => {
            container.innerHTML = `
<div class="gbw-root">
  <div class="gbw-scenario">
    🐛 <strong>Scénario :</strong> La fonction <code>calculate_sum([1, 2, 3])</code> retourne <code>7</code> au lieu de <code>6</code>.
    Le bug n'existait pas dans la version <strong>#1 (v1.0)</strong> mais est présent dans <strong>#${N} (HEAD)</strong>.
    Utilisez <code>git bisect</code> pour trouver le commit coupable en testant la fonction à chaque étape.
  </div>
  <div class="gbw-info ${found ? 'found' : 'neutral'}">
    ${found
      ? `🎯 <strong>Commit coupable : #${CULPRIT} — "refactor: optimisation de la boucle principale"</strong> par Bob. Trouvé en <strong>${steps} étape(s)</strong> au lieu de ${N-1} tests manuels. <code>git bisect reset</code> restaure HEAD.`
      : current !== null
        ? `Commit <strong>#${current}</strong> en cours de test. Exécutez la fonction, observez le résultat ci-dessous et marquez le commit. Espace de recherche : #${goodBound}–#${badBound} (~${stepsLeft()} étape(s) restante(s)).`
        : `Cliquez sur <strong>Démarrer git bisect</strong>. Git va checkout automatiquement le commit du milieu pour que vous le testiez.`}
  </div>
  ${current !== null && !found ? mockTestOutput(current) : ''}
  <div class="gbw-timeline">
    ${Array.from({length: N}, (_, i) => {
        const n = i + 1;
        const state = commitStates[n] || '';
        const isActive = n > goodBound && n < badBound && !found;
        const lbl = COMMIT_LABELS[n] || '#'+n;
        return `
        ${n > 1 ? `<div class="gbw-connector ${isActive ? 'active' : ''}"></div>` : ''}
        <div class="gbw-commit ${state}">
          <div class="gbw-circle">${state === 'culprit' ? '🎯' : state === 'good' ? '✓' : state === 'bad' ? '✗' : state === 'current' ? '?' : n}</div>
          <div class="gbw-label">${state === 'culprit' ? 'coupable' : state === 'good' ? 'bon' : state === 'bad' ? 'mauvais' : state === 'current' ? 'test?' : lbl}</div>
        </div>`;
    }).join('')}
  </div>
  <div class="gbw-actions">
    ${!found && current === null
      ? `<button class="btn btn-primary" id="gbw-start">Démarrer git bisect</button>`
      : found
        ? `<button class="btn btn-secondary" id="gbw-restart">Recommencer</button>`
        : `<button class="btn btn-secondary" id="gbw-good" style="border-color:#10b981;color:#065f46">✅ Bon — good</button>
           <button class="btn btn-secondary" id="gbw-bad" style="border-color:#ef4444;color:#991b1b">❌ Mauvais — bad</button>
           <span class="gbw-step-info">Étape ${steps + 1} — ~${stepsLeft()} restante(s)</span>`}
  </div>
  <div class="gbw-log">${log.map(l => `<div class="${l.startsWith('$ git bisect good') ? 'good-line' : l.startsWith('$ git bisect bad') ? 'bad-line' : l.includes('🎯') ? 'found-line' : ''}">${l}</div>`).join('')}</div>
  <div class="gbw-caption">
    git bisect utilise une recherche dichotomique : pour ${N} commits, ⌈log₂(${N})⌉ = <strong>4 étapes maximum</strong> au lieu de ${N-1} tests manuels.
  </div>
</div>`;

            container.querySelector('#gbw-start')?.addEventListener('click', () => { startBisect(); render(); });
            container.querySelector('#gbw-good')?.addEventListener('click', markGood);
            container.querySelector('#gbw-bad')?.addEventListener('click', markBad);
            container.querySelector('#gbw-restart')?.addEventListener('click', () => { initState(); render(); });
        };

        initState();
        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitBisectWidget = GitBisectWidget;
