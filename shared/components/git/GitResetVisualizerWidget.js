/**
 * GitResetVisualizerWidget — visualisation interactive de git reset (--soft / --mixed / --hard)
 * et git revert.
 *
 * Affiche un historique de commits et trois zones (Working Dir, Staging Area, HEAD)
 * pour montrer l'impact de chaque mode de reset.
 */
class GitResetVisualizerWidget {
    static mount(container, config = {}) {
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
