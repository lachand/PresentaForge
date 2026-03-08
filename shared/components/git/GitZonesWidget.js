/**
 * GitZonesWidget — visualisation interactive des trois zones Git.
 *
 * Montre comment git add et git commit font transiter les fichiers
 * entre le répertoire de travail, la staging area et le dépôt.
 */
class GitZonesWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitZonesWidget._stylesInjected) return;
        GitZonesWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gzw-root {
    font-family: var(--font);
    color: var(--text);
}
.gzw-zones {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
}
@media (max-width: 900px) {
    .gzw-zones { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 500px) {
    .gzw-zones { grid-template-columns: 1fr; }
}
.gzw-zone-remote {
    border-style: dashed;
    background: #f0f9ff;
}
.gzw-zone-remote .gzw-commit {
    border-color: #7dd3fc;
    background: #f0f9ff;
}
.gzw-zone-remote .gzw-commit-hash { color: #0369a1; }
.gzw-zone {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 0.75rem;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: border-color 0.25s;
}
.gzw-zone.highlight {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
}
.gzw-zone-title {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.gzw-zone-subtitle {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--muted);
    font-weight: 400;
}
.gzw-files {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 1;
}
.gzw-file {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: var(--card);
    font-size: 0.82rem;
    font-family: var(--font-mono);
    font-weight: 500;
    transition: all 0.3s ease;
    cursor: default;
}
.gzw-file.entering {
    animation: gzwSlideIn 0.3s ease-out;
}
.gzw-file.leaving {
    animation: gzwSlideOut 0.25s ease-in forwards;
}
.gzw-file-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.gzw-file.state-untracked .gzw-file-dot { background: #9ca3af; }
.gzw-file.state-modified  .gzw-file-dot { background: #f59e0b; }
.gzw-file.state-staged    .gzw-file-dot { background: #4f46e5; }
.gzw-file.state-committed .gzw-file-dot { background: #10b981; }

.gzw-file.state-untracked { border-color: #d1d5db; color: var(--muted); }
.gzw-file.state-modified  { border-color: #fcd34d; background: #fffbeb; }
.gzw-file.state-staged    { border-color: #a5b4fc; background: #eef2ff; color: #4f46e5; }
.gzw-file.state-committed { border-color: #6ee7b7; background: #ecfdf5; color: #065f46; }

.gzw-file-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.gzw-file-badge {
    font-size: 0.65rem;
    font-family: var(--font);
    font-weight: 600;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    white-space: nowrap;
}
.state-untracked .gzw-file-badge { background: #f3f4f6; color: #6b7280; }
.state-modified  .gzw-file-badge { background: #fef3c7; color: #92400e; }
.state-staged    .gzw-file-badge { background: #e0e7ff; color: #3730a3; }
.state-committed .gzw-file-badge { background: #d1fae5; color: #065f46; }

.gzw-commits {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.gzw-commit {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background: var(--card);
    border: 1.5px solid #6ee7b7;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    animation: gzwSlideIn 0.3s ease-out;
}
.gzw-commit-hash {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: #065f46;
    font-weight: 700;
    flex-shrink: 0;
}
.gzw-commit-msg {
    color: var(--muted);
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.gzw-arrows {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
    text-align: center;
}
.gzw-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.75rem;
}
.gzw-arrow-line {
    flex: 1;
    height: 1px;
    background: var(--border);
}
@media (max-width: 680px) {
    .gzw-arrows { grid-template-columns: 1fr; }
}

.gzw-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}
.gzw-cmd {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    padding: 0.45rem 0.85rem;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.18s;
}
.gzw-cmd:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
    background: #eef2ff;
}
.gzw-cmd:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.gzw-cmd.danger:hover:not(:disabled) {
    border-color: #ef4444;
    color: #ef4444;
    background: #fef2f2;
}
.gzw-feedback {
    font-size: 0.82rem;
    min-height: 1.4em;
    padding: 0.4rem 0.6rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
}
.gzw-feedback.ok  { background: #ecfdf5; color: #065f46; }
.gzw-feedback.bad { background: #fef2f2; color: #991b1b; }
.gzw-feedback.info{ background: #eef2ff; color: #3730a3; }

@keyframes gzwSlideIn {
    from { transform: translateY(-8px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
}
@keyframes gzwSlideOut {
    from { transform: translateX(0);  opacity: 1; }
    to   { transform: translateX(20px); opacity: 0; }
}
        `;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        GitZonesWidget.ensureStyles();

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
