/**
 * GitHubKanbanWidget — tableau Kanban simulant GitHub Projects.
 *
 * 4 colonnes : Backlog | En cours | En review | Terminé.
 * Les cartes peuvent être déplacées entre les colonnes.
 */
class GitHubKanbanWidget {
    static LABEL_COLORS = {
        'bug': '#ef4444',
        'feature': '#4f46e5',
        'docs': '#0ea5e9',
        'good-first-issue': '#10b981',
    };

    static COLUMNS = ['Backlog', 'En cours', 'En review', 'Terminé'];

    static INITIAL_CARDS = [
        { id: 8,  col: 0, num: '#8',  title: 'API REST pour les exports',    label: 'feature',          assignee: '' },
        { id: 6,  col: 0, num: '#6',  title: 'Corriger les typos',           label: 'good-first-issue', assignee: '' },
        { id: 4,  col: 0, num: '#4',  title: 'Mettre à jour README',         label: 'docs',             assignee: 'Charlie' },
        { id: 5,  col: 1, num: '#5',  title: 'Google OAuth',                 label: 'feature',          assignee: 'Alice' },
        { id: 7,  col: 1, num: '#7',  title: 'Timeout requêtes',             label: 'bug',              assignee: 'Bob' },
        { id: 1,  col: 2, num: '#1',  title: 'Crash Windows',                label: 'bug',              assignee: 'Alice' },
        { id: 3,  col: 3, num: '#3',  title: 'Erreur 404 profil',            label: 'bug',              assignee: 'Bob' },
        { id: 2,  col: 3, num: '#2',  title: 'Mode sombre',                  label: 'feature',          assignee: 'Bob' },
    ];

    static mount(container, config = {}) {
        let cards = JSON.parse(JSON.stringify(GitHubKanbanWidget.INITIAL_CARDS));

        function render() {
            const COLS = GitHubKanbanWidget.COLUMNS;
            const COLORS = GitHubKanbanWidget.LABEL_COLORS;

            const colsHtml = COLS.map((colName, colIdx) => {
                const colCards = cards.filter(c => c.col === colIdx);
                const cardsHtml = colCards.map(card => {
                    const color = COLORS[card.label] || '#6b7280';
                    const initials = card.assignee ? card.assignee.slice(0, 2).toUpperCase() : '';
                    const canLeft = colIdx > 0;
                    const canRight = colIdx < COLS.length - 1;
                    return `<div class="gkw-card" data-card="${card.id}">
                        <div class="gkw-card-num">${card.num}</div>
                        <div class="gkw-card-title">${card.title}</div>
                        <div class="gkw-card-footer">
                            <span class="gkw-label-badge" style="background:${color}">${card.label}</span>
                            ${card.assignee
                                ? `<div class="gkw-avatar" title="${card.assignee}">${initials}</div>`
                                : `<div class="gkw-avatar empty"></div>`
                            }
                        </div>
                        <div class="gkw-move-btns">
                            <button class="gkw-move-btn" data-move-left="${card.id}" ${!canLeft ? 'disabled' : ''} title="Déplacer à gauche">&#8592; Préc.</button>
                            <button class="gkw-move-btn" data-move-right="${card.id}" ${!canRight ? 'disabled' : ''} title="Déplacer à droite">Suiv. &#8594;</button>
                        </div>
                    </div>`;
                }).join('') || `<div style="text-align:center;padding:0.8rem;color:var(--muted);font-size:0.78rem">Vide</div>`;

                return `<div class="gkw-col">
                    <div class="gkw-col-header">
                        <span class="gkw-col-name">${colName}</span>
                        <span class="gkw-col-count">${colCards.length}</span>
                    </div>
                    <div class="gkw-cards">${cardsHtml}</div>
                </div>`;
            }).join('');

            container.innerHTML = `
<div class="gkw-root">
  <div class="gkw-toolbar">
    <button class="gkw-btn" id="gkw-reset">&#8635; Réinitialiser</button>
  </div>
  <div class="gkw-board">${colsHtml}</div>
</div>`;

            container.querySelector('#gkw-reset')?.addEventListener('click', () => {
                cards = JSON.parse(JSON.stringify(GitHubKanbanWidget.INITIAL_CARDS));
                render();
            });

            container.querySelectorAll('[data-move-left]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.moveLeft);
                    const card = cards.find(c => c.id === id);
                    if (card && card.col > 0) {
                        const cardEl = container.querySelector(`[data-card="${id}"]`);
                        if (cardEl) { cardEl.classList.add('moving'); }
                        setTimeout(() => { card.col--; render(); }, 150);
                    }
                });
            });

            container.querySelectorAll('[data-move-right]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.moveRight);
                    const card = cards.find(c => c.id === id);
                    if (card && card.col < GitHubKanbanWidget.COLUMNS.length - 1) {
                        const cardEl = container.querySelector(`[data-card="${id}"]`);
                        if (cardEl) { cardEl.classList.add('moving'); }
                        setTimeout(() => { card.col++; render(); }, 150);
                    }
                });
            });
        }

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}

window.GitHubKanbanWidget = GitHubKanbanWidget;
