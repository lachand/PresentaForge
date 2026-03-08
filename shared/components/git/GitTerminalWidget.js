/**
 * GitTerminalWidget — terminal simulé montrant des scénarios Git pas à pas.
 *
 * Affiche une série de commandes et leurs sorties avec des explications
 * pédagogiques en français.
 */
class GitTerminalWidget {
    static _stylesInjected = false;

    static SCENARIOS = {
        'basic-workflow': {
            title: 'Flux de travail de base',
            prompt: '~/monprojet',
            steps: [
                {
                    cmd: 'mkdir monprojet && cd monprojet',
                    out: '# Vous êtes maintenant dans ~/monprojet',
                    desc: 'Crée un nouveau répertoire pour le projet et s\'y déplace. Toutes les commandes suivantes s\'exécuteront dans ce dossier.'
                },
                {
                    cmd: 'git init',
                    out: 'Initialized empty Git repository in ~/monprojet/.git/',
                    desc: 'Initialise un dépôt Git vide. Le dossier .git/ est créé avec la structure du dépôt (objets, références, config).'
                },
                {
                    cmd: 'touch README.md app.py',
                    out: '',
                    desc: 'Crée deux fichiers vides. Ils sont pour l\'instant non suivis (untracked) par Git — Git les voit mais ne les enregistre pas.'
                },
                {
                    cmd: 'git status',
                    out: 'On branch main\n\nNo commits yet\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tREADME.md\n\tapp.py\n\nnothing added to commit but untracked files present',
                    desc: 'git status montre l\'état du répertoire de travail et de la staging area. Les fichiers en rouge sont non suivis et ne seront pas commis.'
                },
                {
                    cmd: 'git add .',
                    out: '',
                    desc: 'Indexe TOUS les fichiers du répertoire courant. Les deux fichiers passent dans la staging area (état Staged). L\'absence de sortie est normale.'
                },
                {
                    cmd: 'git status',
                    out: 'On branch main\n\nNo commits yet\n\nChanges to be committed:\n  (use "git rm --cached <file>..." to unstage)\n\tnew file:   README.md\n\tnew file:   app.py',
                    desc: 'Après git add, les fichiers apparaissent en vert sous "Changes to be committed" : ils sont prêts à être commis.'
                },
                {
                    cmd: 'git commit -m "Initial commit"',
                    out: '[main (root-commit) a1b2c3] Initial commit\n 2 files changed, 0 insertions(+), 0 deletions(-)\n create mode 100644 README.md\n create mode 100644 app.py',
                    desc: 'Enregistre un snapshot permanent de la staging area dans le dépôt. Le hash court du commit (a1b2c3) est affiché — il identifie ce commit de façon unique.'
                },
                {
                    cmd: 'git log --oneline',
                    out: 'a1b2c3 (HEAD -> main) Initial commit',
                    desc: 'Affiche l\'historique compact. On voit notre seul commit avec HEAD pointant sur main. HEAD indique le commit courant.'
                }
            ]
        },
        'git-config-setup': {
            title: 'Configuration initiale de Git',
            prompt: '~',
            steps: [
                {
                    cmd: 'git --version',
                    out: 'git version 2.43.0',
                    desc: 'Vérifie que Git est installé et affiche sa version. Git 2.28+ est recommandé pour disposer de init.defaultBranch et Git 2.34+ pour la signature SSH.'
                },
                {
                    cmd: 'git config --global user.name "Alice Dupont"',
                    out: '',
                    desc: 'Définit votre nom d\'auteur au niveau global (dans ~/.gitconfig). Ce nom apparaîtra dans tous vos commits futurs, sur tous vos dépôts.'
                },
                {
                    cmd: 'git config --global user.email "alice@example.com"',
                    out: '',
                    desc: 'Définit votre email d\'auteur. Utilisez le même email que votre compte GitHub pour que vos commits soient associés à votre profil et que les contributions soient comptabilisées.'
                },
                {
                    cmd: 'git config --global init.defaultBranch main',
                    out: '',
                    desc: 'Définit "main" comme nom de branche par défaut lors d\'un git init (plutôt que "master"). GitHub utilise "main" par défaut depuis 2020.'
                },
                {
                    cmd: 'git config --global core.editor "nano"',
                    out: '',
                    desc: 'Définit nano comme éditeur par défaut pour les messages de commit longs et le rebase interactif. Autres options : vim, emacs, "code --wait" pour VS Code.'
                },
                {
                    cmd: 'git config --list --show-origin',
                    out: 'file:/home/alice/.gitconfig\tuser.name=Alice Dupont\nfile:/home/alice/.gitconfig\tuser.email=alice@example.com\nfile:/home/alice/.gitconfig\tinit.defaultBranch=main\nfile:/home/alice/.gitconfig\tcore.editor=nano',
                    desc: 'Affiche toute la configuration effective avec l\'origine de chaque valeur. Idéal pour déboguer et vérifier que tout est correct. On voit ici que nos 4 paramètres sont dans ~/.gitconfig.'
                },
                {
                    cmd: 'ssh-keygen -t ed25519 -C "alice@example.com"',
                    out: 'Generating public/private ed25519 key pair.\nEnter file in which to save the key (/home/alice/.ssh/id_ed25519): \nEnter passphrase (empty for no passphrase): \nYour identification has been saved in /home/alice/.ssh/id_ed25519\nYour public key has been saved in /home/alice/.ssh/id_ed25519.pub\nThe key fingerprint is:\nSHA256:abc123XYZdef456 alice@example.com',
                    desc: 'Génère une paire de clés SSH Ed25519 (algorithme moderne, plus sûr que RSA). Le commentaire (-C) est optionnel mais aide à identifier la clé. Entrez une passphrase solide pour protéger la clé privée.'
                },
                {
                    cmd: 'cat ~/.ssh/id_ed25519.pub',
                    out: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILmGpxyz+AbC12dEfGhIjKlMnOpQrStUvWxYz123456 alice@example.com',
                    desc: 'Affiche la clé PUBLIQUE à copier sur GitHub (Settings → SSH and GPG keys → New SSH key). Ne partagez jamais id_ed25519 (sans .pub) — c\'est la clé privée.'
                },
                {
                    cmd: 'ssh -T git@github.com',
                    out: 'Hi alice! You\'ve successfully authenticated, but GitHub does not provide shell access.',
                    desc: 'Teste la connexion SSH à GitHub. Si vous voyez ce message, la clé SSH est correctement enregistrée sur GitHub et tout est prêt. Vous pouvez maintenant utiliser les URLs git@ pour clone/push/pull.'
                }
            ]
        },
        'branch-workflow': {
            title: 'Flux avec branches',
            prompt: '~/monprojet',
            steps: [
                {
                    cmd: 'git checkout -b feature/login',
                    out: 'Switched to a new branch \'feature/login\'',
                    desc: 'Crée et bascule sur une nouvelle branche feature/login. Cette branche partira du commit actuel de main. Toute modification sera isolée ici.'
                },
                {
                    cmd: 'echo "def login(): pass" > auth.py',
                    out: '',
                    desc: 'Crée un fichier auth.py avec une implémentation minimale. Cette modification n\'existe que dans notre branche feature/login.'
                },
                {
                    cmd: 'git add auth.py',
                    out: '',
                    desc: 'Indexe le nouveau fichier auth.py dans la staging area. Il est prêt à être commis.'
                },
                {
                    cmd: 'git commit -m "feat: add login function"',
                    out: '[feature/login d4e5f6] feat: add login function\n 1 file changed, 1 insertion(+)\n create mode 100644 auth.py',
                    desc: 'Enregistre le commit dans la branche feature/login. La branche main reste intacte — ce commit n\'y est pas encore visible.'
                },
                {
                    cmd: 'git push origin feature/login',
                    out: 'Enumerating objects: 4, done.\nCounting objects: 100% (4/4), done.\nDelta compression using up to 8 threads\nCompressing objects: 100% (2/2), done.\nWriting objects: 100% (3/3), 312 bytes | 312.00 KiB/s, done.\nTotal 3 (delta 0), reused 0 (delta 0)\nTo github.com:alice/monprojet.git\n * [new branch]      feature/login -> feature/login',
                    desc: 'Envoie la branche sur le dépôt distant (GitHub). Cela crée la branche côté serveur et permet d\'ouvrir une Pull Request pour la revue de code.'
                },
                {
                    cmd: 'git checkout main',
                    out: 'Switched to branch \'main\'\nYour branch is up to date with \'origin/main\'.',
                    desc: 'Revient sur la branche main. Le fichier auth.py disparaît du répertoire de travail — il n\'existe que dans feature/login pour l\'instant.'
                },
                {
                    cmd: 'git merge feature/login',
                    out: 'Updating a1b2c3..d4e5f6\nFast-forward\n auth.py | 1 +\n 1 file changed, 1 insertion(+)\n create mode 100644 auth.py',
                    desc: 'Intègre les commits de feature/login dans main. Ici un "Fast-forward" signifie qu\'il n\'y avait pas de divergence : Git a juste avancé le pointeur de main.'
                },
                {
                    cmd: 'git log --oneline --graph',
                    out: '* d4e5f6 (HEAD -> main, origin/main, feature/login) feat: add login function\n* a1b2c3 Initial commit',
                    desc: 'L\'historique en arbre montre les deux commits. Les deux branches pointent maintenant sur le même commit après le fast-forward merge.'
                }
            ]
        }
    };

    static ensureStyles() {
        if (GitTerminalWidget._stylesInjected) return;
        GitTerminalWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gtw-root {
    font-family: var(--font);
    color: var(--text);
}
.gtw-top-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
}
.gtw-scenario-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
}
.gtw-scenario-select {
    font-family: var(--font);
    font-size: 0.82rem;
    padding: 0.35rem 0.6rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
}
.gtw-counter {
    margin-left: auto;
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 600;
}

/* Fenêtre terminal */
.gtw-terminal {
    background: #1e293b;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 0.75rem;
    border: 1px solid #334155;
}
.gtw-terminal-bar {
    background: #334155;
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.gtw-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
.gtw-dot-red   { background: #ef4444; }
.gtw-dot-amber { background: #f59e0b; }
.gtw-dot-green { background: #22c55e; }
.gtw-terminal-title {
    font-size: 0.75rem;
    color: #94a3b8;
    font-family: var(--font-mono);
    margin-left: 0.25rem;
}
.gtw-terminal-body {
    padding: 0.85rem 1rem;
    min-height: 160px;
    max-height: 280px;
    overflow-y: auto;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.6;
}
.gtw-line {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    margin-bottom: 0.25rem;
    animation: gtwFadeIn 0.2s ease-out;
}
.gtw-prompt {
    color: #4ade80;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
}
.gtw-cmd-text {
    color: #f8fafc;
    white-space: pre-wrap;
    word-break: break-all;
}
.gtw-output {
    color: #94a3b8;
    white-space: pre-wrap;
    font-size: 0.78rem;
    margin-left: 0;
    margin-bottom: 0.5rem;
    display: block;
    animation: gtwFadeIn 0.3s ease-out;
}
.gtw-output.comment { color: #64748b; font-style: italic; }

/* Description pédagogique */
.gtw-desc-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--primary);
    border-radius: var(--radius-sm);
    padding: 0.7rem 0.9rem;
    font-size: 0.83rem;
    color: var(--text);
    line-height: 1.5;
    margin-bottom: 0.75rem;
    min-height: 2.5rem;
}
.gtw-desc-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--primary);
    margin-bottom: 0.25rem;
}

/* Contrôles */
.gtw-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.gtw-btn {
    font-family: var(--font);
    font-size: 0.82rem;
    font-weight: 600;
    padding: 0.45rem 1rem;
    border-radius: var(--radius-sm);
    border: 2px solid var(--border);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
    transition: all 0.18s;
}
.gtw-btn:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
    background: #eef2ff;
}
.gtw-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.gtw-btn-primary {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
}
.gtw-btn-primary:hover:not(:disabled) {
    background: #4338ca;
    border-color: #4338ca;
    color: #fff;
}

@keyframes gtwFadeIn {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
}
        `;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        GitTerminalWidget.ensureStyles();

        const scenarioKey = config.scenario || 'basic-workflow';
        let scenario = GitTerminalWidget.SCENARIOS[scenarioKey] || GitTerminalWidget.SCENARIOS['basic-workflow'];
        let currentStep = 0; // index of LAST revealed step (-1 = none)
        let revealedSteps = []; // steps shown in terminal

        const getScenario = (key) => GitTerminalWidget.SCENARIOS[key] || scenario;

        const render = () => {
            const totalSteps = scenario.steps.length;
            const hasPrev = currentStep > 0;
            const hasNext = currentStep < totalSteps;
            const currentDesc = currentStep > 0 ? scenario.steps[currentStep - 1].desc : 'Sélectionnez un scénario et cliquez sur "Étape suivante" pour commencer.';

            const terminalLines = revealedSteps.map((step) => {
                const outLines = step.out
                    ? `<span class="gtw-output${step.out.startsWith('#') ? ' comment' : ''}">${escHtml(step.out)}</span>`
                    : '';
                return `
<div class="gtw-line">
    <span class="gtw-prompt">${escHtml(scenario.prompt)} $</span>
    <span class="gtw-cmd-text">${escHtml(step.cmd)}</span>
</div>
${outLines}`;
            }).join('');

            const scenarioOptions = Object.entries(GitTerminalWidget.SCENARIOS).map(([key, sc]) =>
                `<option value="${key}" ${key === Object.keys(GitTerminalWidget.SCENARIOS).find(k => GitTerminalWidget.SCENARIOS[k] === scenario) ? 'selected' : ''}>${sc.title}</option>`
            ).join('');

            container.innerHTML = `
<div class="gtw-root">
    <div class="gtw-top-bar">
        <span class="gtw-scenario-label">Scénario :</span>
        <select class="gtw-scenario-select" id="gtw-scenario">${scenarioOptions}</select>
        <span class="gtw-counter">${currentStep > 0 ? `Étape ${currentStep}/${totalSteps}` : `${totalSteps} étapes`}</span>
    </div>
    <div class="gtw-terminal">
        <div class="gtw-terminal-bar">
            <span class="gtw-dot gtw-dot-red"></span>
            <span class="gtw-dot gtw-dot-amber"></span>
            <span class="gtw-dot gtw-dot-green"></span>
            <span class="gtw-terminal-title">bash — ${scenario.prompt}</span>
        </div>
        <div class="gtw-terminal-body" id="gtw-body">
            ${currentStep === 0
                ? '<span style="color:#475569;font-size:0.8rem;font-family:var(--font-mono)">Appuyez sur "Étape suivante" pour démarrer le scénario...</span>'
                : terminalLines}
        </div>
    </div>
    <div class="gtw-desc-box">
        <div class="gtw-desc-label">Explication</div>
        ${escHtml(currentDesc)}
    </div>
    <div class="gtw-controls">
        <button class="gtw-btn" id="gtw-prev" ${hasPrev ? '' : 'disabled'}>Précédente</button>
        <button class="gtw-btn gtw-btn-primary" id="gtw-next" ${hasNext ? '' : 'disabled'}>
            ${currentStep === 0 ? 'Commencer' : currentStep >= totalSteps ? 'Terminé' : 'Étape suivante'}
        </button>
        <button class="gtw-btn" id="gtw-restart">Recommencer</button>
    </div>
</div>`;

            container.querySelector('#gtw-scenario')?.addEventListener('change', (e) => {
                scenario = getScenario(e.target.value);
                currentStep = 0;
                revealedSteps = [];
                render();
            });

            container.querySelector('#gtw-next')?.addEventListener('click', () => {
                if (currentStep < scenario.steps.length) {
                    revealedSteps.push(scenario.steps[currentStep]);
                    currentStep++;
                    render();
                    // Scroll terminal to bottom
                    const body = container.querySelector('#gtw-body');
                    if (body) body.scrollTop = body.scrollHeight;
                }
            });

            container.querySelector('#gtw-prev')?.addEventListener('click', () => {
                if (currentStep > 0) {
                    revealedSteps.pop();
                    currentStep--;
                    render();
                }
            });

            container.querySelector('#gtw-restart')?.addEventListener('click', () => {
                currentStep = 0;
                revealedSteps = [];
                render();
            });
        };

        function escHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitTerminalWidget = GitTerminalWidget;
