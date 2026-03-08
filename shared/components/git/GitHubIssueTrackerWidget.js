/**
 * GitHubIssueTrackerWidget — simulation d'un tracker d'issues GitHub.
 *
 * Liste d'issues pré-remplie avec filtres, création d'issue et progression milestones.
 */
class GitHubIssueTrackerWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitHubIssueTrackerWidget._stylesInjected) return;
        GitHubIssueTrackerWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gitw-root {
    font-family: var(--font);
    color: var(--text);
}
.gitw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}
.gitw-title {
    font-size: 1rem;
    font-weight: 700;
}
.gitw-btn {
    padding: 0.4rem 0.9rem;
    border-radius: var(--radius-sm);
    border: none;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    background: var(--accent, #10b981);
    color: #fff;
    transition: opacity 0.15s;
}
.gitw-btn:hover { opacity: 0.85; }
.gitw-btn-secondary {
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--border);
}
.gitw-btn-danger {
    background: #ef4444;
}
.gitw-filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
}
.gitw-select {
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    background: var(--card);
    color: var(--text);
    cursor: pointer;
}
.gitw-issue-list {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 0.75rem;
}
.gitw-issue-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.85rem;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    transition: background 0.15s;
}
.gitw-issue-row:last-child { border-bottom: none; }
.gitw-issue-row:hover { background: var(--bg); }
.gitw-issue-row.closed {
    opacity: 0.55;
}
.gitw-issue-row.closed .gitw-issue-title {
    text-decoration: line-through;
}
.gitw-cb {
    width: 15px;
    height: 15px;
    cursor: pointer;
    flex-shrink: 0;
    accent-color: var(--primary, #4f46e5);
}
.gitw-issue-num {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--muted);
    flex-shrink: 0;
    min-width: 28px;
}
.gitw-label-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 2rem;
    color: #fff;
    white-space: nowrap;
    flex-shrink: 0;
}
.gitw-issue-title {
    flex: 1;
    font-size: 0.85rem;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.gitw-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--primary, #4f46e5);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.gitw-avatar.empty { background: var(--border); }
.gitw-milestone-tag {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 2rem;
    padding: 0.1rem 0.45rem;
    white-space: nowrap;
    flex-shrink: 0;
}
.gitw-empty {
    text-align: center;
    padding: 1.5rem;
    color: var(--muted);
    font-size: 0.85rem;
}
.gitw-bulk-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.85rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: var(--radius-sm);
    margin-bottom: 0.75rem;
    font-size: 0.82rem;
}
.gitw-milestones {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
}
.gitw-ms-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    margin-bottom: 0.6rem;
}
.gitw-ms-row {
    margin-bottom: 0.55rem;
}
.gitw-ms-row:last-child { margin-bottom: 0; }
.gitw-ms-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    margin-bottom: 0.2rem;
}
.gitw-ms-name { font-weight: 600; }
.gitw-ms-count { color: var(--muted); }
.gitw-ms-bar-bg {
    background: var(--border);
    border-radius: 2rem;
    height: 8px;
    overflow: hidden;
}
.gitw-ms-bar-fill {
    height: 100%;
    border-radius: 2rem;
    background: var(--accent, #10b981);
    transition: width 0.3s;
}
.gitw-create-form {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 0.85rem 1rem;
    margin-bottom: 0.75rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: flex-end;
}
.gitw-form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.gitw-form-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.gitw-input {
    padding: 0.38rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    background: var(--card);
    color: var(--text);
    min-width: 180px;
}
.gitw-input:focus {
    outline: 2px solid var(--primary, #4f46e5);
    outline-offset: 1px;
    border-color: transparent;
}
`;
        document.head.appendChild(style);
    }

    static LABEL_COLORS = {
        'bug': '#ef4444',
        'feature': '#4f46e5',
        'documentation': '#0ea5e9',
        'good-first-issue': '#10b981',
    };

    static INITIAL_ISSUES = [
        { id: 1, label: 'bug',             title: 'Crash au démarrage sur Windows',    assignee: 'Alice',   milestone: 'v1.1', closed: false, selected: false },
        { id: 2, label: 'feature',         title: 'Ajouter le mode sombre',            assignee: 'Bob',     milestone: 'v2.0', closed: false, selected: false },
        { id: 3, label: 'bug',             title: 'Erreur 404 sur la page profil',     assignee: '',        milestone: 'v1.1', closed: false, selected: false },
        { id: 4, label: 'documentation',   title: 'Mettre à jour le README',           assignee: 'Charlie', milestone: '',     closed: false, selected: false },
        { id: 5, label: 'feature',         title: 'Intégration Google OAuth',          assignee: 'Alice',   milestone: 'v2.0', closed: false, selected: false },
        { id: 6, label: 'good-first-issue',title: 'Corriger les fautes de typo',       assignee: '',        milestone: '',     closed: false, selected: false },
        { id: 7, label: 'bug',             title: 'Timeout sur les requêtes lentes',   assignee: 'Bob',     milestone: 'v1.1', closed: false, selected: false },
        { id: 8, label: 'feature',         title: 'API REST pour les exports',         assignee: '',        milestone: 'v2.0', closed: false, selected: false },
    ];

    static mount(container, config = {}) {
        GitHubIssueTrackerWidget.ensureStyles();

        let issues = JSON.parse(JSON.stringify(GitHubIssueTrackerWidget.INITIAL_ISSUES));
        let nextId = 9;
        let filterLabel = '';
        let filterMilestone = '';
        let showForm = false;

        function getFiltered() {
            return issues.filter(i => {
                if (filterLabel && i.label !== filterLabel) return false;
                if (filterMilestone && i.milestone !== filterMilestone) return false;
                return true;
            });
        }

        function getMilestoneStats(ms) {
            const msIssues = issues.filter(i => i.milestone === ms);
            const closed = msIssues.filter(i => i.closed).length;
            return { total: msIssues.length, closed };
        }

        function selectedFiltered() {
            return getFiltered().filter(i => i.selected && !i.closed);
        }

        function render() {
            const filtered = getFiltered();
            const openCount = filtered.filter(i => !i.closed).length;
            const closedCount = filtered.filter(i => i.closed).length;
            const selCount = selectedFiltered().length;

            const ms11 = getMilestoneStats('v1.1');
            const ms20 = getMilestoneStats('v2.0');

            const issueRows = filtered.map(issue => {
                const color = GitHubIssueTrackerWidget.LABEL_COLORS[issue.label] || '#6b7280';
                const initials = issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : '';
                return `<div class="gitw-issue-row${issue.closed ? ' closed' : ''}" data-id="${issue.id}">
                    <input type="checkbox" class="gitw-cb" data-cb="${issue.id}" ${issue.selected ? 'checked' : ''} ${issue.closed ? 'disabled' : ''}/>
                    <span class="gitw-issue-num">#${issue.id}</span>
                    <span class="gitw-label-badge" style="background:${color}">${issue.label}</span>
                    <span class="gitw-issue-title">${issue.title}</span>
                    ${issue.assignee
                        ? `<div class="gitw-avatar" title="${issue.assignee}">${initials}</div>`
                        : `<div class="gitw-avatar empty" title="Non assigné"></div>`
                    }
                    ${issue.milestone
                        ? `<span class="gitw-milestone-tag">${issue.milestone}</span>`
                        : `<span style="width:42px"></span>`
                    }
                </div>`;
            }).join('') || `<div class="gitw-empty">Aucune issue ne correspond aux filtres sélectionnés.</div>`;

            const formHtml = showForm ? `
<div class="gitw-create-form">
  <div class="gitw-form-group" style="flex:1;min-width:180px">
    <label class="gitw-form-label">Titre</label>
    <input class="gitw-input" id="gitw-new-title" placeholder="Description de l'issue..." />
  </div>
  <div class="gitw-form-group">
    <label class="gitw-form-label">Label</label>
    <select class="gitw-select" id="gitw-new-label">
      <option value="bug">bug</option>
      <option value="feature">feature</option>
      <option value="documentation">documentation</option>
      <option value="good-first-issue">good-first-issue</option>
    </select>
  </div>
  <div class="gitw-form-group">
    <label class="gitw-form-label">Milestone</label>
    <select class="gitw-select" id="gitw-new-milestone">
      <option value="">Aucun</option>
      <option value="v1.1">v1.1</option>
      <option value="v2.0">v2.0</option>
    </select>
  </div>
  <button class="gitw-btn" id="gitw-submit-issue">Créer l'issue</button>
  <button class="gitw-btn gitw-btn-secondary" id="gitw-cancel-issue">Annuler</button>
</div>` : '';

            const pct11 = ms11.total ? Math.round(ms11.closed / ms11.total * 100) : 0;
            const pct20 = ms20.total ? Math.round(ms20.closed / ms20.total * 100) : 0;

            container.innerHTML = `
<div class="gitw-root">
  <div class="gitw-header">
    <span class="gitw-title">Issues ouvertes (${openCount}) &nbsp;·&nbsp; <span style="color:var(--muted);font-weight:400;font-size:0.88rem">${closedCount} fermée${closedCount > 1 ? 's' : ''}</span></span>
    <button class="gitw-btn" id="gitw-open-form">+ Créer une issue</button>
  </div>
  ${formHtml}
  <div class="gitw-filters">
    <select class="gitw-select" id="gitw-filter-label">
      <option value="">Tous les labels</option>
      <option value="bug" ${filterLabel === 'bug' ? 'selected' : ''}>bug</option>
      <option value="feature" ${filterLabel === 'feature' ? 'selected' : ''}>feature</option>
      <option value="documentation" ${filterLabel === 'documentation' ? 'selected' : ''}>documentation</option>
      <option value="good-first-issue" ${filterLabel === 'good-first-issue' ? 'selected' : ''}>good-first-issue</option>
    </select>
    <select class="gitw-select" id="gitw-filter-ms">
      <option value="">Tous les milestones</option>
      <option value="v1.1" ${filterMilestone === 'v1.1' ? 'selected' : ''}>v1.1</option>
      <option value="v2.0" ${filterMilestone === 'v2.0' ? 'selected' : ''}>v2.0</option>
    </select>
  </div>
  ${selCount > 0 ? `<div class="gitw-bulk-bar">
    <span>${selCount} issue${selCount > 1 ? 's' : ''} sélectionnée${selCount > 1 ? 's' : ''}</span>
    <button class="gitw-btn gitw-btn-danger" id="gitw-close-sel" style="font-size:0.78rem;padding:0.3rem 0.75rem">Fermer les issues sélectionnées</button>
  </div>` : ''}
  <div class="gitw-issue-list">${issueRows}</div>
  <div class="gitw-milestones">
    <div class="gitw-ms-title">Progression des milestones</div>
    <div class="gitw-ms-row">
      <div class="gitw-ms-header"><span class="gitw-ms-name">v1.1</span><span class="gitw-ms-count">${ms11.closed}/${ms11.total} fermées — ${pct11}%</span></div>
      <div class="gitw-ms-bar-bg"><div class="gitw-ms-bar-fill" style="width:${pct11}%"></div></div>
    </div>
    <div class="gitw-ms-row">
      <div class="gitw-ms-header"><span class="gitw-ms-name">v2.0</span><span class="gitw-ms-count">${ms20.closed}/${ms20.total} fermées — ${pct20}%</span></div>
      <div class="gitw-ms-bar-bg"><div class="gitw-ms-bar-fill" style="width:${pct20}%;background:var(--primary,#4f46e5)"></div></div>
    </div>
  </div>
</div>`;

            // Bind events
            container.querySelector('#gitw-open-form')?.addEventListener('click', () => {
                showForm = !showForm;
                render();
            });
            container.querySelector('#gitw-cancel-issue')?.addEventListener('click', () => {
                showForm = false;
                render();
            });
            container.querySelector('#gitw-submit-issue')?.addEventListener('click', () => {
                const titleEl = container.querySelector('#gitw-new-title');
                const labelEl = container.querySelector('#gitw-new-label');
                const msEl = container.querySelector('#gitw-new-milestone');
                const title = titleEl?.value.trim();
                if (!title) { titleEl?.focus(); return; }
                issues.push({
                    id: nextId++,
                    label: labelEl?.value || 'bug',
                    title,
                    assignee: '',
                    milestone: msEl?.value || '',
                    closed: false,
                    selected: false,
                });
                showForm = false;
                render();
            });
            container.querySelectorAll('[data-cb]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const id = parseInt(cb.dataset.cb);
                    const issue = issues.find(i => i.id === id);
                    if (issue) { issue.selected = cb.checked; render(); }
                });
            });
            container.querySelector('#gitw-close-sel')?.addEventListener('click', () => {
                selectedFiltered().forEach(i => { i.closed = true; i.selected = false; });
                render();
            });
            container.querySelector('#gitw-filter-label')?.addEventListener('change', e => {
                filterLabel = e.target.value;
                render();
            });
            container.querySelector('#gitw-filter-ms')?.addEventListener('change', e => {
                filterMilestone = e.target.value;
                render();
            });
        }

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}

window.GitHubIssueTrackerWidget = GitHubIssueTrackerWidget;
