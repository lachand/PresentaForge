class GitFilterRepoWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitFilterRepoWidget._stylesInjected) return;
        GitFilterRepoWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
        .gfr-widget { font-family: var(--font-sans, sans-serif); display: flex; flex-direction: column; gap: 0.9rem; }
        .gfr-progress { display: flex; align-items: center; gap: 0; margin-bottom: 0.25rem; }
        .gfr-progress-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--border, #e2e8f0); border: 2px solid var(--border, #e2e8f0); flex-shrink: 0; transition: all 0.25s; }
        .gfr-progress-dot.active { background: var(--primary, #6366f1); border-color: var(--primary, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        .gfr-progress-dot.done { background: #16a34a; border-color: #16a34a; }
        .gfr-progress-line { flex: 1; height: 2px; background: var(--border, #e2e8f0); }
        .gfr-progress-line.done { background: #16a34a; }
        .gfr-step-header { display: flex; flex-direction: column; gap: 0.15rem; }
        .gfr-step-num { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted, #94a3b8); }
        .gfr-step-title { font-size: 0.95rem; font-weight: 700; color: var(--heading, #1e293b); }
        .gfr-terminal { border-radius: 8px; overflow: hidden; background: #1e1e2e; }
        .gfr-terminal-bar { display: flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem; background: #181825; }
        .gfr-td { width: 10px; height: 10px; border-radius: 50%; }
        .gfr-td-red { background: #ff5f57; }
        .gfr-td-yellow { background: #febc2e; }
        .gfr-td-green { background: #28c840; }
        .gfr-terminal-label { margin-left: auto; font-size: 0.68rem; color: #585b70; font-family: monospace; }
        .gfr-terminal-body { padding: 0.7rem 1rem; }
        .gfr-cmd { font-family: monospace; font-size: 0.8rem; color: #a6e3a1; white-space: pre-wrap; line-height: 1.6; }
        .gfr-cmd-prompt { color: #89b4fa; }
        .gfr-output { font-family: monospace; font-size: 0.77rem; color: #cdd6f4; margin-top: 0.5rem; white-space: pre-wrap; line-height: 1.65; border-top: 1px solid #313244; padding-top: 0.5rem; }
        .gfr-note { padding: 0.6rem 0.8rem; background: #eff6ff; border: 1px solid #bfdbfe; border-left: 3px solid #3b82f6; border-radius: 6px; font-size: 0.81rem; color: #1e40af; line-height: 1.55; }
        .gfr-warning { padding: 0.75rem 0.9rem; background: #fef2f2; border: 1px solid #fca5a5; border-left: 3px solid #dc2626; border-radius: 6px; font-size: 0.82rem; line-height: 1.55; }
        .gfr-warning-title { font-weight: 700; color: #dc2626; margin-bottom: 0.5rem; font-size: 0.88rem; }
        .gfr-checklist { display: flex; flex-direction: column; gap: 0.35rem; }
        .gfr-check-item { display: flex; gap: 0.6rem; font-size: 0.82rem; color: #1e293b; padding: 0.2rem 0; }
        .gfr-check-item span:first-child { flex-shrink: 0; }
        .gfr-force-warn { padding: 0.65rem 0.8rem; background: #fff7ed; border: 1px solid #fed7aa; border-left: 3px solid #f97316; border-radius: 6px; font-size: 0.81rem; color: #9a3412; line-height: 1.55; }
        .gfr-nav { display: flex; gap: 0.6rem; margin-top: 0.25rem; }
        .gfr-btn { padding: 0.4rem 1rem; border-radius: 6px; border: 1.5px solid var(--border, #e2e8f0); background: var(--bg, #fff); cursor: pointer; font-size: 0.82rem; font-weight: 500; transition: all 0.15s; color: var(--text, #1e293b); }
        .gfr-btn:not([disabled]):hover { background: var(--primary, #6366f1); color: white; border-color: var(--primary, #6366f1); }
        .gfr-btn[disabled] { opacity: 0.35; cursor: not-allowed; }
        `;
        document.head.appendChild(s);
    }

    static STEPS = [
        {
            title: 'État initial — identifier le problème',
            cmd: 'git log --oneline',
            output: `a7f3b21 Ajouter la validation des formulaires
c9d4e82 Mettre à jour le README
<span style="background:#fef2f2;color:#dc2626;border-radius:3px;padding:0 3px">3f8a1c5 Ajouter la configuration API  ← ⚠ .env commité ici</span>
b2e9f17 Initialisation du projet`,
            note: 'Le commit <code>3f8a1c5</code> a ajouté un fichier <code>.env</code> contenant des clés API. Même si ce fichier a été supprimé dans un commit ultérieur, il reste accessible dans l\'historique Git complet.',
        },
        {
            title: 'Trouver tous les commits qui touchent le fichier',
            cmd: 'git log --all --full-history -- .env',
            output: `commit 3f8a1c5
Author: Alice Dupont &lt;alice@example.com&gt;
Date:   Thu Jan 15 14:32:07 2024

    Ajouter la configuration API

    diff --git a/.env b/.env
    new file mode 100644
    <span style="color:#a6e3a1">+DB_PASSWORD=<span style="color:#f38ba8">super_secret_123</span></span>
    <span style="color:#a6e3a1">+STRIPE_KEY=<span style="color:#f38ba8">sk-prod-xK9mL2pQ8rT...</span></span>`,
            note: 'Cette commande révèle <strong>tous</strong> les commits qui ont créé, modifié ou supprimé le fichier — y compris si celui-ci a été supprimé par la suite. Les secrets sont toujours dans l\'historique.',
        },
        {
            title: '🚨 PRIORITÉ : Révoquer le secret immédiatement',
            isRevoke: true,
            checklist: [
                { icon: '🔑', text: 'GitHub → Settings → Developer Settings → Personal access tokens → Révoquer le token compromis' },
                { icon: '🗄️', text: 'Changer le mot de passe de la base de données dans votre console d\'hébergement' },
                { icon: '💳', text: 'Révoquer toutes les autres credentials exposées (Stripe, AWS, SendGrid, etc.)' },
                { icon: '👥', text: 'Informer votre équipe : la fenêtre de compromission est ouverte' },
            ],
            note: 'Ne commencez pas la réécriture de l\'historique avant d\'avoir révoqué le secret. La suppression du commit ne rend pas le secret inutilisable — des bots ont déjà pu le capturer.',
        },
        {
            title: 'Installer git-filter-repo',
            cmd: 'pip install git-filter-repo',
            output: `Collecting git-filter-repo
  Downloading git_filter_repo-2.38.0-py3-none-any.whl (145 kB)
Installing collected packages: git-filter-repo
<span style="color:#a6e3a1">Successfully installed git-filter-repo-2.38.0</span>`,
            note: '<code>git-filter-repo</code> est l\'outil officiellement recommandé par le projet Git pour réécrire l\'historique. Il remplace <code>git filter-branch</code> (déprécié, 40× plus lent).',
        },
        {
            title: 'Supprimer le fichier de tout l\'historique',
            cmd: 'git filter-repo --invert-paths --path .env',
            output: `Parsed 4 commits
New history written in 0.09 seconds; now repacking/cleaning...
Enumerating objects: 12, done.
Delta compression using up to 8 threads
Compressing objects: 100% (9/9), done.
<span style="color:#a6e3a1">Writing objects: 100% (12/12), done.
Filtering complete.</span>`,
            note: 'Git réécrit tous les commits concernés. Les identifiants SHA <strong>changent</strong> pour tous les commits qui suivent le commit modifié. L\'historique est maintenant propre <em>localement</em>.',
        },
        {
            title: 'Vérifier que le fichier a disparu',
            cmd: 'git log --oneline\ngit log --all -- .env',
            output: `<span style="color:#89dceb">f2e9c14</span> Ajouter la validation des formulaires
<span style="color:#89dceb">d7b3a21</span> Mettre à jour le README
<span style="color:#89dceb">8c4f2b0</span> Ajouter la configuration API
<span style="color:#89dceb">a1d5e93</span> Initialisation du projet

<span style="color:#a6e3a1">(aucun résultat — .env n'apparaît dans aucun commit)</span>`,
            note: 'Les SHA ont changé (nouvel historique). La commande <code>git log --all -- .env</code> ne renvoie aucun résultat : le fichier <code>.env</code> n\'existe plus dans aucun commit de l\'historique.',
        },
        {
            title: 'Forcer le push vers le dépôt distant',
            cmd: 'git push --force --all\ngit push --force --tags',
            output: `Enumerating objects: 12, done.
Counting objects: 100% (12/12), done.
Compressing objects: 100% (5/5), done.
Writing objects: 100% (12/12), 1.23 KiB | 1.23 MiB/s, done.
To github.com:monorg/monrepo.git
<span style="color:#f38ba8"> + a7f3b21...f2e9c14 main -> main (forced update)</span>`,
            note: null,
            forceWarn: '⚠️ Le <code>--force</code> réécrit l\'historique distant. <strong>Toute l\'équipe doit supprimer son clone local et re-cloner</strong> (<code>git clone</code>). Les branches et PRs en cours seront désynchronisées. Coordonnez impérativement avant de pousser.',
        },
    ];

    static mount(container, config = {}) {
        GitFilterRepoWidget.ensureStyles();
        let step = 0;
        const total = GitFilterRepoWidget.STEPS.length;

        const render = () => {
            const s = GitFilterRepoWidget.STEPS[step];
            const progressItems = GitFilterRepoWidget.STEPS.map((_, i) => {
                const dotClass = i === step ? 'active' : i < step ? 'done' : '';
                const lineClass = i < step ? 'done' : '';
                return (i < total - 1)
                    ? `<div class="gfr-progress-dot ${dotClass}"></div><div class="gfr-progress-line ${lineClass}"></div>`
                    : `<div class="gfr-progress-dot ${dotClass}"></div>`;
            }).join('');

            const cmdHtml = s.cmd ? `<div class="gfr-terminal">
                <div class="gfr-terminal-bar">
                    <div class="gfr-td gfr-td-red"></div>
                    <div class="gfr-td gfr-td-yellow"></div>
                    <div class="gfr-td gfr-td-green"></div>
                    <span class="gfr-terminal-label">terminal</span>
                </div>
                <div class="gfr-terminal-body">
                    <div class="gfr-cmd">${s.cmd.split('\n').map(l => `<span class="gfr-cmd-prompt">$ </span>${l}`).join('\n')}</div>
                    ${s.output ? `<div class="gfr-output">${s.output}</div>` : ''}
                </div>
            </div>` : '';

            const revokeHtml = s.isRevoke ? `<div class="gfr-warning">
                <div class="gfr-warning-title">🚨 Faites ceci AVANT toute manipulation Git</div>
                <div class="gfr-checklist">
                    ${s.checklist.map(item => `<div class="gfr-check-item"><span>${item.icon}</span><span>${item.text}</span></div>`).join('')}
                </div>
            </div>` : '';

            const noteHtml = s.note ? `<div class="gfr-note">${s.note}</div>` : '';
            const forceHtml = s.forceWarn ? `<div class="gfr-force-warn">${s.forceWarn}</div>` : '';

            container.innerHTML = `<div class="gfr-widget">
                <div class="gfr-progress">${progressItems}</div>
                <div class="gfr-step-header">
                    <span class="gfr-step-num">Étape ${step + 1} / ${total}</span>
                    <span class="gfr-step-title">${s.title}</span>
                </div>
                ${revokeHtml}
                ${cmdHtml}
                ${noteHtml}
                ${forceHtml}
                <div class="gfr-nav">
                    <button class="gfr-btn gfr-btn-prev" ${step === 0 ? 'disabled' : ''}>← Précédent</button>
                    <button class="gfr-btn gfr-btn-next" ${step === total - 1 ? 'disabled' : ''}>Suivant →</button>
                </div>
            </div>`;

            container.querySelector('.gfr-btn-prev').addEventListener('click', () => { if (step > 0) { step--; render(); } });
            container.querySelector('.gfr-btn-next').addEventListener('click', () => { if (step < total - 1) { step++; render(); } });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitFilterRepoWidget = GitFilterRepoWidget;
