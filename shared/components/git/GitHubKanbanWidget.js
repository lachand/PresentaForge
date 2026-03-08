/**
 * GitHubKanbanWidget — tableau Kanban simulant GitHub Projects.
 *
 * 4 colonnes : Backlog | En cours | En review | Terminé.
 * Les cartes peuvent être déplacées entre les colonnes.
 */
class GitHubKanbanWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitHubKanbanWidget._stylesInjected) return;
        GitHubKanbanWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gkw-root {
    font-family: var(--font);
    color: var(--text);
}
.gkw-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.75rem;
}
.gkw-btn {
    padding: 0.38rem 0.85rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    background: var(--card);
    color: var(--text);
    transition: background 0.15s;
}
.gkw-btn:hover { background: var(--bg); }
.gkw-board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    overflow-x: auto;
}
@media (max-width: 720px) {
    .gkw-board {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 480px) {
    .gkw-board {
        grid-template-columns: 1fr;
    }
}
.gkw-col {
    background: var(--bg);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.gkw-col-header {
    padding: 0.65rem 0.85rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
}
.gkw-col-name {
    font-size: 0.82rem;
    font-weight: 700;
    white-space: nowrap;
}
.gkw-col-count {
    background: var(--border);
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: 2rem;
    padding: 0.1rem 0.5rem;
}
.gkw-cards {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 60px;
}
.gkw-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.7rem;
    transition: box-shadow 0.2s, transform 0.15s;
    position: relative;
}
.gkw-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.gkw-card.moving {
    opacity: 0.4;
    transform: scale(0.97);
}
.gkw-card-num {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--muted);
    margin-bottom: 0.2rem;
}
.gkw-card-title {
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 0.45rem;
    line-height: 1.3;
}
.gkw-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.gkw-label-badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.12rem 0.45rem;
    border-radius: 2rem;
    color: #fff;
    white-space: nowrap;
}
.gkw-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--primary, #4f46e5);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
}
.gkw-avatar.empty { background: var(--border); }
.gkw-move-btns {
    display: flex;
    gap: 0.2rem;
    margin-top: 0.4rem;
}
.gkw-move-btn {
    padding: 0.15rem 0.4rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg);
    font-size: 0.72rem;
    cursor: pointer;
    color: var(--muted);
    transition: background 0.1s, color 0.1s;
}
.gkw-move-btn:hover { background: var(--primary, #4f46e5); color: #fff; border-color: transparent; }
.gkw-move-btn:disabled { opacity: 0.3; cursor: default; }
.gkw-move-btn:disabled:hover { background: var(--bg); color: var(--muted); border-color: var(--border); }
`;
        document.head.appendChild(style);
    }

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
        GitHubKanbanWidget.ensureStyles();

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
