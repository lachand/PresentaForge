/**
 * GitResetVisualizerWidget — visualisation interactive de git reset (--soft / --mixed / --hard)
 * et git revert.
 *
 * Affiche un historique de commits et trois zones (Working Dir, Staging Area, HEAD)
 * pour montrer l'impact de chaque mode de reset.
 */
class GitResetVisualizerWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitResetVisualizerWidget._stylesInjected) return;
        GitResetVisualizerWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.grv-root {
    font-family: var(--font);
    color: var(--text);
    user-select: none;
}

/* Timeline commits */
.grv-timeline {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 1.25rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
}
.grv-commit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
}
.grv-commit-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2.5px solid var(--border);
    background: var(--card);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text);
    transition: all 0.25s;
    position: relative;
    z-index: 1;
}
.grv-commit-dot.head {
    border-color: var(--primary);
    background: var(--primary);
    color: #fff;
    box-shadow: 0 0 0 3px #c7d2fe;
}
.grv-commit-dot.new-commit {
    border-color: #22c55e;
    background: #dcfce7;
    color: #15803d;
    box-shadow: 0 0 0 3px #bbf7d0;
}
.grv-commit-dot.faded {
    opacity: 0.3;
    border-style: dashed;
}
.grv-commit-hash {
    font-size: 0.65rem;
    font-family: var(--font-mono);
    color: var(--muted);
}
.grv-commit-msg {
    font-size: 0.68rem;
    color: var(--text-secondary, var(--muted));
    max-width: 68px;
    text-align: center;
    line-height: 1.2;
}
.grv-commit-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.35rem;
    border-radius: 99px;
    background: #ede9fe;
    color: var(--primary);
}
.grv-arrow {
    width: 30px;
    height: 2px;
    background: var(--border);
    flex-shrink: 0;
    position: relative;
    top: -18px;
}
.grv-arrow::after {
    content: '';
    position: absolute;
    right: -1px;
    top: -4px;
    border-left: 7px solid var(--border);
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
}

/* Zones */
.grv-zones {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
}
@media (max-width: 600px) {
    .grv-zones { grid-template-columns: 1fr; }
}
.grv-zone {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem;
    transition: all 0.3s;
    min-height: 110px;
}
.grv-zone-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
    font-size: 0.78rem;
    font-weight: 700;
}
.grv-zone-icon {
    font-size: 1rem;
}
.grv-zone-title { color: var(--text); }
.grv-zone-items {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-height: 50px;
}
.grv-file-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    padding: 0.2rem 0.5rem;
    border-radius: var(--radius-sm);
    border: 1.5px solid;
    transition: all 0.3s;
}
.grv-file-chip.modified {
    background: #fffbeb;
    border-color: #fbbf24;
    color: #92400e;
}
.grv-file-chip.staged {
    background: #eff6ff;
    border-color: #60a5fa;
    color: #1e40af;
}
.grv-file-chip.committed {
    background: #f0fdf4;
    border-color: #4ade80;
    color: #166534;
}
.grv-zone-empty {
    font-size: 0.72rem;
    color: var(--muted);
    font-style: italic;
    padding: 0.25rem 0;
}

/* Zone highlights */
.grv-zone.highlight-kept {
    border-color: #4ade80;
    background: #f0fdf4;
}
.grv-zone.highlight-lost {
    border-color: #f87171;
    background: #fef2f2;
}
.grv-zone.highlight-neutral {
    border-color: var(--primary);
    background: #eef2ff;
}

/* Boutons d'action */
.grv-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}
.grv-btn {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.45rem 0.85rem;
    border-radius: var(--radius-sm);
    border: 2px solid;
    cursor: pointer;
    transition: all 0.18s;
}
.grv-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.grv-btn-soft {
    background: #ede9fe;
    border-color: var(--primary);
    color: var(--primary);
}
.grv-btn-soft:hover:not(:disabled) {
    background: var(--primary);
    color: #fff;
}
.grv-btn-mixed {
    background: #fefce8;
    border-color: #ca8a04;
    color: #854d0e;
}
.grv-btn-mixed:hover:not(:disabled) {
    background: #ca8a04;
    color: #fff;
}
.grv-btn-hard {
    background: #fef2f2;
    border-color: #dc2626;
    color: #dc2626;
}
.grv-btn-hard:hover:not(:disabled) {
    background: #dc2626;
    color: #fff;
}
.grv-btn-revert {
    background: #f0fdf4;
    border-color: #16a34a;
    color: #16a34a;
}
.grv-btn-revert:hover:not(:disabled) {
    background: #16a34a;
    color: #fff;
}
.grv-btn-reset-ui {
    background: var(--card);
    border-color: var(--border);
    color: var(--muted);
    font-family: var(--font);
    font-size: 0.78rem;
}
.grv-btn-reset-ui:hover {
    border-color: var(--text);
    color: var(--text);
}

/* Panel d'explication */
.grv-explain {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-left: 4px solid var(--primary);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
}
.grv-explain-title {
    font-weight: 700;
    font-family: var(--font-mono);
    margin-bottom: 0.35rem;
    font-size: 0.85rem;
}
.grv-explain.soft  { border-left-color: var(--primary); }
.grv-explain.mixed { border-left-color: #ca8a04; }
.grv-explain.hard  { border-left-color: #dc2626; }
.grv-explain.revert { border-left-color: #16a34a; }
.grv-explain.initial { border-left-color: var(--border); }

@keyframes grv-pop {
    0%   { transform: scale(0.8); opacity: 0; }
    60%  { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
}
.grv-pop { animation: grv-pop 0.3s ease-out; }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitResetVisualizerWidget.ensureStyles();

        // Historique de commits : C1 → C2 → C3 → C4 (HEAD)
        const BASE_COMMITS = [
            { hash: 'a1b2c3', msg: 'Initial commit', files: [] },
            { hash: 'b2c3d4', msg: 'feat: login', files: ['auth.py'] },
            { hash: 'c3d4e5', msg: 'feat: dashboard', files: ['dashboard.py'] },
            { hash: 'd4e5f6', msg: 'fix: null check', files: ['utils.py', 'auth.py'] }
        ];

        // State courant
        let headIdx = 3;           // indice du commit HEAD dans commits[]
        let commits = [...BASE_COMMITS];
        let stagingFiles = [];     // fichiers dans la staging area
        let workingFiles = [];     // fichiers modifiés dans le WD
        let mode = 'initial';      // 'initial' | 'soft' | 'mixed' | 'hard' | 'revert'

        const EXPLAIN = {
            initial: {
                title: 'État initial',
                text: 'HEAD pointe sur le commit <code>d4e5f6</code> (fix: null check). Le working directory et la staging area sont propres — aucune modification en cours.',
                cls: 'initial'
            },
            soft: {
                title: 'git reset --soft HEAD~1',
                text: '<b>HEAD recule</b> d\'un commit. La staging area et le working directory sont <b>inchangés</b> : les modifications du commit annulé (utils.py, auth.py) se retrouvent <b>indexées</b>, prêtes à recommitter. Utile pour reformuler un message de commit ou fusionner plusieurs commits.',
                cls: 'soft'
            },
            mixed: {
                title: 'git reset --mixed HEAD~1 (défaut)',
                text: '<b>HEAD et la staging area reculent</b>. Le working directory reste intact. Les modifications du commit annulé sont <b>désindexées</b> (unstaged) mais présentes dans les fichiers. Vous devez refaire un <code>git add</code> avant de recommitter.',
                cls: 'mixed'
            },
            hard: {
                title: 'git reset --hard HEAD~1',
                text: '<b>HEAD, staging area ET working directory reculent</b>. Les modifications du commit annulé sont <b>définitivement perdues</b>. Aucun <code>git restore</code> ne peut les récupérer (sauf via <code>git reflog</code> si le commit existait). À utiliser uniquement en local.',
                cls: 'hard'
            },
            revert: {
                title: 'git revert d4e5f6',
                text: 'Un <b>nouveau commit</b> (e5f6a7) est créé, qui inverse les effets de <code>d4e5f6</code>. L\'historique <b>n\'est pas réécrit</b> — on voit les deux commits. C\'est la méthode sûre pour annuler un commit déjà publié sur un remote partagé.',
                cls: 'revert'
            }
        };

        const applyMode = (m) => {
            mode = m;
            commits = [...BASE_COMMITS];
            headIdx = 3;
            stagingFiles = [];
            workingFiles = [];

            if (m === 'soft') {
                headIdx = 2;
                stagingFiles = ['utils.py', 'auth.py']; // du commit annulé
            } else if (m === 'mixed') {
                headIdx = 2;
                workingFiles = ['utils.py', 'auth.py'];
            } else if (m === 'hard') {
                headIdx = 2;
                // tout perdu
            } else if (m === 'revert') {
                commits = [
                    ...BASE_COMMITS,
                    { hash: 'e5f6a7', msg: 'Revert "fix: null check"', files: [] }
                ];
                headIdx = 4;
            }
            render();
        };

        const render = () => {
            const exp = EXPLAIN[mode];
            const headHash = commits[headIdx].hash;

            const timelineHtml = commits.map((c, i) => {
                const isHead = i === headIdx;
                const isNew = mode === 'revert' && i === 4;
                const isFaded = mode !== 'initial' && mode !== 'revert' && i > headIdx;
                return `
<div class="grv-commit">
    <div class="grv-commit-dot${isHead ? ' head' : ''}${isNew ? ' new-commit' : ''}${isFaded ? ' faded' : ''}">
        ${isHead ? 'HEAD' : c.hash.slice(0, 3)}
    </div>
    <div class="grv-commit-hash">${c.hash.slice(0, 6)}</div>
    <div class="grv-commit-msg">${c.msg}</div>
    ${isNew ? '<div class="grv-commit-label">revert</div>' : ''}
</div>
${i < commits.length - 1 ? '<div class="grv-arrow"></div>' : ''}`;
            }).join('');

            const zoneClass = (zone) => {
                if (mode === 'initial') return '';
                if (mode === 'revert')  return 'highlight-neutral';
                if (zone === 'wd')      return mode === 'hard' ? 'highlight-lost' : 'highlight-kept';
                if (zone === 'stage')   return mode === 'soft' ? 'highlight-kept' : 'highlight-lost';
                if (zone === 'head')    return 'highlight-lost';
                return '';
            };

            const chipHtml = (files, kind) => {
                if (!files.length) return '<span class="grv-zone-empty">— aucune modification</span>';
                return files.map(f => `<span class="grv-file-chip ${kind} grv-pop">📄 ${f}</span>`).join('');
            };

            container.innerHTML = `
<div class="grv-root">
    <div class="grv-timeline">${timelineHtml}</div>
    <div class="grv-zones">
        <div class="grv-zone ${zoneClass('wd')}">
            <div class="grv-zone-header">
                <span class="grv-zone-icon">📁</span>
                <span class="grv-zone-title">Working Directory</span>
            </div>
            <div class="grv-zone-items">${chipHtml(workingFiles, 'modified')}</div>
        </div>
        <div class="grv-zone ${zoneClass('stage')}">
            <div class="grv-zone-header">
                <span class="grv-zone-icon">📋</span>
                <span class="grv-zone-title">Staging Area (Index)</span>
            </div>
            <div class="grv-zone-items">${chipHtml(stagingFiles, 'staged')}</div>
        </div>
        <div class="grv-zone ${zoneClass('head')}">
            <div class="grv-zone-header">
                <span class="grv-zone-icon">💾</span>
                <span class="grv-zone-title">HEAD (Repository)</span>
            </div>
            <div class="grv-zone-items">
                <span class="grv-file-chip committed grv-pop">🔖 ${headHash} — ${commits[headIdx].msg}</span>
            </div>
        </div>
    </div>
    <div class="grv-actions">
        <button class="grv-btn grv-btn-soft"  id="grv-soft">reset --soft HEAD~1</button>
        <button class="grv-btn grv-btn-mixed" id="grv-mixed">reset --mixed HEAD~1</button>
        <button class="grv-btn grv-btn-hard"  id="grv-hard">reset --hard HEAD~1</button>
        <button class="grv-btn grv-btn-revert" id="grv-revert">revert ${BASE_COMMITS[3].hash.slice(0,6)}</button>
        <button class="grv-btn grv-btn-reset-ui" id="grv-init">↺ Reset</button>
    </div>
    <div class="grv-explain ${exp.cls}">
        <div class="grv-explain-title">${exp.title}</div>
        ${exp.text}
    </div>
</div>`;

            container.querySelector('#grv-soft')?.addEventListener('click',   () => applyMode('soft'));
            container.querySelector('#grv-mixed')?.addEventListener('click',  () => applyMode('mixed'));
            container.querySelector('#grv-hard')?.addEventListener('click',   () => applyMode('hard'));
            container.querySelector('#grv-revert')?.addEventListener('click', () => applyMode('revert'));
            container.querySelector('#grv-init')?.addEventListener('click',   () => applyMode('initial'));
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitResetVisualizerWidget = GitResetVisualizerWidget;
