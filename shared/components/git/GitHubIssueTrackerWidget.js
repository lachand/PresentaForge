/**
 * GitHubIssueTrackerWidget — simulation d'un tracker d'issues GitHub.
 *
 * Liste d'issues pré-remplie avec filtres, création d'issue et progression milestones.
 */
class GitHubIssueTrackerWidget {
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
