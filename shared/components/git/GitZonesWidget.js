/**
 * GitZonesWidget — visualisation interactive des trois zones Git.
 *
 * Montre comment git add et git commit font transiter les fichiers
 * entre le répertoire de travail, la staging area et le dépôt.
 */
class GitZonesWidget {
    static mount(container, config = {}) {
        // --- État initial ---
        const INITIAL_REMOTE = [{ hash: 'a4f2d1', msg: 'Initial project setup (origin)' }];
        const state = {
            wd: [
                { name: 'README.md',  status: 'untracked' },
                { name: 'index.js',   status: 'modified'  },
                { name: 'style.css',  status: 'modified'  }
            ],
            staging: [],
            commits: [],
            remote: [{ hash: 'a4f2d1', msg: 'Initial project setup (origin)' }]
        };

        const render = () => {
            const mkFile = (f, zone) => {
                const stClass = `state-${f.status}`;
                const labels = { untracked: 'non suivi', modified: 'modifié', staged: 'indexé', committed: 'commis' };
                return `
                <div class="gzw-file ${stClass}" data-name="${f.name}" data-zone="${zone}">
                    <span class="gzw-file-dot"></span>
                    <span class="gzw-file-label">${f.name}</span>
                    <span class="gzw-file-badge">${labels[f.status] || f.status}</span>
                </div>`;
            };
            const mkCommit = (c) => `
                <div class="gzw-commit">
                    <span class="gzw-commit-hash">${c.hash}</span>
                    <span class="gzw-commit-msg">${c.msg}</span>
                </div>`;

            const canAdd      = state.wd.some(f => f.status === 'modified' || f.status === 'untracked');
            const canCommit   = state.staging.length > 0;
            const canReset    = state.staging.length > 0;
            const canCheckout = state.wd.some(f => f.status === 'modified');
            const canPush     = state.commits.some(c => !state.remote.find(r => r.hash === c.hash));
            const canPull     = state.remote.some(r => !state.commits.find(c => c.hash === r.hash));

            container.innerHTML = `
<div class="gzw-root">
  <div class="gzw-controls">
    <button class="gzw-cmd" id="gzw-add-all"    ${canAdd      ? '' : 'disabled'}>git add .</button>
    <button class="gzw-cmd" id="gzw-add-one"    ${canAdd      ? '' : 'disabled'}>git add index.js</button>
    <button class="gzw-cmd" id="gzw-commit"     ${canCommit   ? '' : 'disabled'}>git commit</button>
    <button class="gzw-cmd" id="gzw-push"       ${canPush     ? '' : 'disabled'}>git push</button>
    <button class="gzw-cmd" id="gzw-pull"       ${canPull     ? '' : 'disabled'}>git pull</button>
    <button class="gzw-cmd danger" id="gzw-reset"  ${canReset  ? '' : 'disabled'}>git reset HEAD</button>
    <button class="gzw-cmd danger" id="gzw-checkout" ${canCheckout ? '' : 'disabled'}>git checkout -- .</button>
    <button class="gzw-cmd" id="gzw-reset-all">Réinitialiser</button>
  </div>
  <div class="gzw-zones">
    <div class="gzw-zone" id="gzw-zone-wd">
      <div class="gzw-zone-title">📁 Répertoire de travail <span class="gzw-zone-subtitle">(working directory)</span></div>
      <div class="gzw-files" id="gzw-wd">${state.wd.map(f => mkFile(f, 'wd')).join('')}</div>
    </div>
    <div class="gzw-zone" id="gzw-zone-staging">
      <div class="gzw-zone-title">📋 Staging area <span class="gzw-zone-subtitle">(index)</span></div>
      <div class="gzw-files" id="gzw-staging">${state.staging.map(f => mkFile(f, 'staging')).join('')}</div>
    </div>
    <div class="gzw-zone" id="gzw-zone-repo">
      <div class="gzw-zone-title">🗄️ Dépôt local <span class="gzw-zone-subtitle">(.git/)</span></div>
      <div class="gzw-commits" id="gzw-commits">${state.commits.map(mkCommit).join('')}</div>
    </div>
    <div class="gzw-zone gzw-zone-remote" id="gzw-zone-remote">
      <div class="gzw-zone-title">🌐 Dépôt distant <span class="gzw-zone-subtitle">(origin)</span></div>
      <div class="gzw-commits" id="gzw-remote">${state.remote.map(mkCommit).join('')}</div>
    </div>
  </div>
  <div class="gzw-feedback info" id="gzw-fb">Utilisez les commandes ci-dessus pour observer les transitions.</div>
</div>`;
            bindEvents();
        };

        const feedback = (msg, type = 'info') => {
            const el = container.querySelector('#gzw-fb');
            if (el) { el.textContent = msg; el.className = `gzw-feedback ${type}`; }
        };

        const highlight = (zoneId) => {
            container.querySelectorAll('.gzw-zone').forEach(z => z.classList.remove('highlight'));
            const z = container.querySelector(`#gzw-zone-${zoneId}`);
            if (z) {
                z.classList.add('highlight');
                setTimeout(() => z.classList.remove('highlight'), 900);
            }
        };

        const hashOf = (n) => (Math.abs(n * 0x9e3779b9) & 0xffffff).toString(16).padStart(6, '0');
        let commitCount = 0;

        const bindEvents = () => {
            container.querySelector('#gzw-add-all')?.addEventListener('click', () => {
                const moved = state.wd.filter(f => f.status !== 'committed');
                if (!moved.length) return;
                moved.forEach(f => {
                    state.wd = state.wd.filter(x => x.name !== f.name);
                    if (!state.staging.find(x => x.name === f.name))
                        state.staging.push({ name: f.name, status: 'staged' });
                    else {
                        const ex = state.staging.find(x => x.name === f.name);
                        if (ex) ex.status = 'staged';
                    }
                });
                highlight('staging');
                feedback(`git add . → ${moved.length} fichier(s) indexé(s)`, 'info');
                render();
            });

            container.querySelector('#gzw-add-one')?.addEventListener('click', () => {
                const f = state.wd.find(x => x.name === 'index.js');
                if (!f) { feedback('index.js est déjà indexé ou commis.', 'bad'); return; }
                state.wd = state.wd.filter(x => x.name !== 'index.js');
                state.staging.push({ name: 'index.js', status: 'staged' });
                highlight('staging');
                feedback('git add index.js → index.js déplacé dans la staging area', 'info');
                render();
            });

            container.querySelector('#gzw-commit')?.addEventListener('click', () => {
                if (!state.staging.length) { feedback('Rien à committer (staging area vide).', 'bad'); return; }
                commitCount++;
                const hash = hashOf(commitCount * 31 + 7);
                const names = state.staging.map(f => f.name).join(', ');
                state.commits.unshift({ hash, msg: `commit #${commitCount} — ${names}` });
                state.staging = [];
                highlight('repo');
                feedback(`git commit → commit ${hash} créé avec ${names}`, 'ok');
                render();
            });

            container.querySelector('#gzw-reset')?.addEventListener('click', () => {
                if (!state.staging.length) return;
                const names = state.staging.map(f => f.name);
                state.staging.forEach(f => state.wd.push({ name: f.name, status: 'modified' }));
                state.staging = [];
                highlight('wd');
                feedback(`git reset HEAD → ${names.join(', ')} désindexé(s), retour dans le répertoire de travail`, 'info');
                render();
            });

            container.querySelector('#gzw-checkout')?.addEventListener('click', () => {
                const modified = state.wd.filter(f => f.status === 'modified');
                if (!modified.length) return;
                state.wd = state.wd.filter(f => f.status !== 'modified');
                highlight('wd');
                feedback(`git checkout -- . → ${modified.length} modification(s) annulée(s) (perte des changements !)`, 'bad');
                render();
            });

            container.querySelector('#gzw-push')?.addEventListener('click', () => {
                const newCommits = state.commits.filter(c => !state.remote.find(r => r.hash === c.hash));
                if (!newCommits.length) { feedback('Dépôt distant déjà à jour.', 'info'); return; }
                newCommits.forEach(c => state.remote.unshift(c));
                highlight('remote');
                feedback(`git push → ${newCommits.length} commit(s) envoyé(s) vers origin`, 'ok');
                render();
            });

            container.querySelector('#gzw-pull')?.addEventListener('click', () => {
                const newCommits = state.remote.filter(r => !state.commits.find(c => c.hash === r.hash));
                if (!newCommits.length) { feedback('Dépôt local déjà à jour.', 'info'); return; }
                newCommits.forEach(c => state.commits.unshift(c));
                highlight('repo');
                feedback(`git pull → ${newCommits.length} commit(s) récupéré(s) depuis origin`, 'ok');
                render();
            });

            container.querySelector('#gzw-reset-all')?.addEventListener('click', () => {
                state.wd = [
                    { name: 'README.md', status: 'untracked' },
                    { name: 'index.js',  status: 'modified'  },
                    { name: 'style.css', status: 'modified'  }
                ];
                state.staging = [];
                state.commits = [];
                state.remote = [{ hash: 'a4f2d1', msg: 'Initial project setup (origin)' }];
                commitCount = 0;
                feedback('État réinitialisé.', 'info');
                render();
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitZonesWidget = GitZonesWidget;
