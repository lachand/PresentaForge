/**
 * BranchProtectionWidget — PR bloquée par des règles de protection.
 * L'étudiant débloque chaque règle pour autoriser le merge.
 */
class BranchProtectionWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (BranchProtectionWidget._stylesInjected) return;
        BranchProtectionWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.bpw-root { font-family: var(--font); }
.bpw-pr-header {
    background: var(--card); border: 1.5px solid var(--border);
    border-radius: var(--radius); padding: 0.75rem 1rem; margin-bottom: 0.75rem;
    display: flex; align-items: center; gap: 0.75rem;
}
.bpw-pr-badge {
    background: #7c3aed; color: white; font-size: 0.72rem; font-weight: 700;
    padding: 0.2rem 0.5rem; border-radius: 999px; white-space: nowrap;
}
.bpw-pr-title { font-weight: 600; font-size: 0.9rem; color: var(--text); }
.bpw-rules { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
.bpw-rule {
    display: grid; grid-template-columns: 1.5rem 1fr auto;
    align-items: center; gap: 0.75rem;
    padding: 0.65rem 0.85rem; border-radius: var(--radius);
    border: 1.5px solid var(--border); background: var(--card);
    transition: all 0.3s;
}
.bpw-rule.ok    { border-color: #10b981; background: #ecfdf5; }
.bpw-rule.fail  { border-color: #ef4444; background: #fef2f2; }
.bpw-rule.running { border-color: #f59e0b; background: #fffbeb; }
.bpw-rule-icon  { font-size: 1rem; text-align: center; }
.bpw-rule-body  {}
.bpw-rule-name  { font-size: 0.82rem; font-weight: 700; color: var(--text); }
.bpw-rule-detail { font-size: 0.72rem; color: var(--muted); margin-top: 0.1rem; }
.bpw-rule-action {}
.bpw-merge-btn {
    width: 100%; padding: 0.75rem; border-radius: var(--radius);
    font-size: 0.9rem; font-weight: 700; border: none; cursor: pointer;
    transition: all 0.3s; margin-bottom: 0.75rem;
}
.bpw-merge-btn.locked   { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
.bpw-merge-btn.unlocked { background: #10b981; color: white; cursor: pointer; }
.bpw-info {
    font-size: 0.78rem; color: var(--muted); padding: 0.6rem 0.85rem;
    background: var(--bg); border-radius: var(--radius-sm);
    border-left: 3px solid var(--primary); line-height: 1.5;
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        BranchProtectionWidget.ensureStyles();

        const rules = [
            {
                id: 'pr',
                name: 'Pull Request requise',
                detail: 'Les commits directs sur main sont interdits.',
                status: 'ok',
                action: null
            },
            {
                id: 'approvals',
                name: 'Approbation requise (minimum 1)',
                detail: 'Au moins un reviewer doit approuver avant le merge.',
                status: 'fail',
                actionLabel: 'Simuler une approbation',
                actionDetail: null,
                running: false
            },
            {
                id: 'ci',
                name: 'Status checks CI requis',
                detail: 'Le pipeline lint + tests + build doit être vert.',
                status: 'fail',
                actionLabel: 'Lancer les checks CI',
                actionDetail: null,
                running: false
            },
            {
                id: 'uptodate',
                name: 'Branche à jour avec main',
                detail: 'La branche doit être rebasée sur le dernier commit de main.',
                status: 'fail',
                actionLabel: 'git pull --rebase origin main',
                actionDetail: null,
                running: false
            },
            {
                id: 'nopush',
                name: 'Push direct sur main interdit',
                detail: 'Seuls les merges via PR sont autorisés.',
                status: 'ok',
                action: null
            }
        ];

        const isAllOk = () => rules.every(r => r.status === 'ok');

        const render = () => {
            const allOk = isAllOk();
            container.innerHTML = `
<div class="bpw-root">
  <div class="bpw-pr-header">
    <span class="bpw-pr-badge">PR #47</span>
    <span class="bpw-pr-title">feat: ajout du mode sombre</span>
  </div>
  <div class="bpw-rules">
    ${rules.map(r => `
      <div class="bpw-rule ${r.running ? 'running' : r.status}">
        <div class="bpw-rule-icon">${r.running ? '⏳' : r.status === 'ok' ? '✅' : '❌'}</div>
        <div class="bpw-rule-body">
          <div class="bpw-rule-name">${r.name}</div>
          <div class="bpw-rule-detail">${r.actionDetail || r.detail}</div>
        </div>
        <div class="bpw-rule-action">
          ${r.status !== 'ok' && r.actionLabel && !r.running
            ? `<button class="btn btn-secondary" style="font-size:0.75rem;padding:0.3rem 0.6rem" data-rule="${r.id}">${r.actionLabel}</button>`
            : r.running ? '<span style="font-size:0.75rem;color:#92400e">En cours…</span>' : ''}
        </div>
      </div>`).join('')}
  </div>
  <button class="bpw-merge-btn ${allOk ? 'unlocked' : 'locked'}" id="bpw-merge" ${allOk ? '' : 'disabled'}>
    ${allOk ? '✅ Merge pull request' : '🔒 Merge bloqué — ' + rules.filter(r => r.status !== 'ok').length + ' règle(s) non satisfaite(s)'}
  </button>
  ${allOk ? `<div class="bpw-info"><strong>Toutes les règles sont satisfaites.</strong> Ces protections garantissent que seul du code relu, testé et synchronisé atteint la branche principale.</div>` : `<div class="bpw-info">Les <strong>branch protection rules</strong> sont configurées dans Settings → Branches de votre dépôt GitHub. Elles automatisent la qualité sans dépendre de la discipline individuelle.</div>`}
</div>`;

            container.querySelectorAll('[data-rule]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.rule;
                    const rule = rules.find(r => r.id === id);
                    if (!rule || rule.running) return;
                    rule.running = true;
                    render();
                    const delay = id === 'ci' ? 2200 : 900;
                    setTimeout(() => {
                        rule.running = false;
                        rule.status = 'ok';
                        const msgs = {
                            approvals: '✅ 1/1 approbation reçue (Alice)',
                            ci: '✅ lint · tests · build — tous les checks passent',
                            uptodate: '✅ Branche rebasée sur main (ahead by 2, behind by 0)'
                        };
                        rule.actionDetail = msgs[id] || null;
                        render();
                    }, delay);
                });
            });

            container.querySelector('#bpw-merge')?.addEventListener('click', () => {
                if (!isAllOk()) return;
                container.querySelector('.bpw-merge-btn').textContent = '🎉 Mergé avec succès !';
                container.querySelector('.bpw-merge-btn').style.background = '#7c3aed';
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.BranchProtectionWidget = BranchProtectionWidget;
