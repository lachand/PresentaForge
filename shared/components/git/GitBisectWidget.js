/**
 * GitBisectWidget — simulation interactive de git bisect.
 * L'étudiant marque good/bad pour trouver le commit coupable par dichotomie.
 */
class GitBisectWidget {
    static mount(container, config = {}) {
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
