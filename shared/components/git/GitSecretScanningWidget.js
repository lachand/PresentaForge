/**
 * GitSecretScanningWidget — simulation interactive de la push protection GitHub.
 *
 * L'étudiant tente de pousser un commit contenant un secret (clé AWS).
 * GitHub bloque le push. Trois choix s'offrent à lui : supprimer le secret,
 * utiliser un gestionnaire de secrets, ou demander un bypass (dangereux).
 */
class GitSecretScanningWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitSecretScanningWidget._stylesInjected) return;
        GitSecretScanningWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gssw-root { font-family: var(--font); color: var(--text); }

/* Terminal */
.gssw-terminal {
    background: #0f172a;
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1rem;
    border: 1px solid #1e293b;
}
.gssw-terminal-bar {
    background: #1e293b;
    padding: 0.4rem 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.gssw-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.gssw-dot-r { background: #ef4444; }
.gssw-dot-y { background: #f59e0b; }
.gssw-dot-g { background: #22c55e; }
.gssw-term-title { font-family: var(--font-mono); font-size: 0.72rem; color: #64748b; margin-left: 0.25rem; }

.gssw-term-body {
    padding: 0.85rem 1rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    line-height: 1.7;
    min-height: 120px;
}
.gssw-line { display: block; }
.gssw-line.prompt  { color: #4ade80; }
.gssw-line.output  { color: #94a3b8; }
.gssw-line.error   { color: #f87171; }
.gssw-line.warning { color: #fbbf24; }
.gssw-line.success { color: #4ade80; }
.gssw-line.url     { color: #60a5fa; text-decoration: underline; }
.gssw-line.blank   { color: transparent; user-select: none; }

/* Secret dans le diff */
.gssw-secret-highlight {
    background: #7f1d1d;
    color: #fca5a5;
    border-radius: 2px;
    padding: 0 2px;
}

/* Phase badge */
.gssw-phase {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.7rem;
    border-radius: 999px;
    margin-bottom: 0.85rem;
}
.gssw-phase.blocked  { background: #fef2f2; color: #dc2626; border: 1.5px solid #fca5a5; }
.gssw-phase.resolved { background: #f0fdf4; color: #16a34a; border: 1.5px solid #86efac; }
.gssw-phase.warning  { background: #fffbeb; color: #d97706; border: 1.5px solid #fcd34d; }
.gssw-phase.initial  { background: #f8fafc; color: var(--muted); border: 1.5px solid var(--border); }

/* Choix de résolution */
.gssw-choices {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 0.85rem;
}
.gssw-choice-btn {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    cursor: pointer;
    text-align: left;
    font-family: var(--font);
    transition: all 0.18s;
    width: 100%;
}
.gssw-choice-btn:hover { border-color: var(--primary); background: #eef2ff; }
.gssw-choice-btn.danger:hover { border-color: #dc2626; background: #fef2f2; }
.gssw-choice-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 0.05rem; }
.gssw-choice-body {}
.gssw-choice-title { font-size: 0.83rem; font-weight: 700; color: var(--text); }
.gssw-choice-desc  { font-size: 0.75rem; color: var(--muted); margin-top: 0.15rem; line-height: 1.4; }

/* Résultat */
.gssw-result {
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
    border: 2px solid;
}
.gssw-result.good    { background: #f0fdf4; border-color: #22c55e; }
.gssw-result.bad     { background: #fef2f2; border-color: #ef4444; }
.gssw-result.warning { background: #fffbeb; border-color: #f59e0b; }
.gssw-result-title { font-weight: 700; font-size: 0.88rem; margin-bottom: 0.35rem; }
.gssw-result.good    .gssw-result-title { color: #15803d; }
.gssw-result.bad     .gssw-result-title { color: #dc2626; }
.gssw-result.warning .gssw-result-title { color: #92400e; }

.gssw-restart-btn {
    font-family: var(--font); font-size: 0.78rem; font-weight: 600;
    padding: 0.35rem 0.75rem; margin-top: 0.7rem;
    border: 2px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card); color: var(--muted); cursor: pointer;
    transition: all 0.15s;
}
.gssw-restart-btn:hover { border-color: var(--text); color: var(--text); }

@keyframes gssw-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.gssw-cursor { animation: gssw-blink 1s infinite; color: #4ade80; }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitSecretScanningWidget.ensureStyles();

        // States: 'initial' → 'pushing' → 'blocked' → 'choice' → 'resolve-good'/'resolve-bad'/'resolve-warn'
        let phase = 'initial';
        let pushInterval = null;

        const PUSH_LINES = [
            { cls: 'prompt',  text: '~/monprojet (main) $ git push origin main' },
            { cls: 'output',  text: 'Enumerating objects: 5, done.' },
            { cls: 'output',  text: 'Counting objects: 100% (5/5), done.' },
            { cls: 'output',  text: 'Delta compression using up to 8 threads' },
            { cls: 'output',  text: 'Compressing objects: 100% (3/3), done.' },
            { cls: 'output',  text: '' },
            { cls: 'error',   text: 'remote: error: GH013: Repository rule violations found for refs/heads/main.' },
            { cls: 'error',   text: 'remote:' },
            { cls: 'error',   text: 'remote: - PUSH PROTECTION' },
            { cls: 'error',   text: 'remote:   ——————————————————————————————————' },
            { cls: 'error',   text: 'remote:   Resolve the following secrets before pushing:' },
            { cls: 'error',   text: 'remote:' },
            { cls: 'warning', text: 'remote:   (1) AWS Access Key ID' },
            { cls: 'warning', text: 'remote:       aws_access_key_id: AKIA[...]EXAMPLE' },
            { cls: 'warning', text: '                                   ^^^^ Détecté dans config/secrets.py (ligne 3)' },
            { cls: 'error',   text: 'remote:' },
            { cls: 'url',     text: 'remote:   Résoudre : https://github.com/alice/monprojet/security/secret-scanning/push-protection' },
            { cls: 'error',   text: 'remote:' },
            { cls: 'error',   text: 'To github.com:alice/monprojet.git' },
            { cls: 'error',   text: ' ! [remote rejected] main -> main (push declined due to repository rule violations)' },
            { cls: 'error',   text: 'error: failed to push some refs to \'github.com:alice/monprojet.git\'' },
        ];

        const RESULTS = {
            'remove': {
                cls: 'good',
                title: '✅ Bonne pratique — secret supprimé et révoqué',
                body: `<strong>Étapes suivies :</strong>
<ol style="margin:0.4rem 0 0 1.2rem;line-height:1.7">
<li>Révocation immédiate de la clé AWS dans la console IAM</li>
<li>Suppression du secret du code et du fichier ajouté dans <code>.gitignore</code></li>
<li>Réécriture de l'historique : <code>git filter-repo --invert-paths --path config/secrets.py</code></li>
<li>Utilisation d'une variable d'environnement ou d'AWS Secrets Manager à la place</li>
<li><code>git push --force-with-lease</code></li>
</ol>
<br>La clé révoquée ne peut plus être utilisée, même si elle a été visible quelques secondes dans l'historique local.`
            },
            'manager': {
                cls: 'good',
                title: '✅ Bonne pratique — gestionnaire de secrets',
                body: `<strong>Refactoring vers un gestionnaire de secrets :</strong>
<pre style="background:#1e293b;color:#e2e8f0;padding:0.6rem;border-radius:6px;font-size:0.74rem;margin:0.5rem 0">
# Avant (dangereux)
AWS_KEY = "AKIAIOSFODNN7EXAMPLE"

# Après (sûr) — variable d'environnement
import os
AWS_KEY = os.environ.get("AWS_ACCESS_KEY_ID")

# Ou via AWS Secrets Manager / HashiCorp Vault
</pre>
Ajoutez <code>config/secrets.py</code> et <code>.env*</code> à votre <code>.gitignore</code> puis révoquez et regenerez la clé AWS.`
            },
            'bypass': {
                cls: 'bad',
                title: '⛔ Action dangereuse — bypass activé',
                body: `Le bypass de la push protection est autorisé pour les propriétaires du dépôt dans des cas <em>exceptionnels</em> (faux positif avéré, clé de test sans valeur réelle).<br><br>
<strong>Dans ce cas-ci, la clé AWS est réelle — le bypass est une faute grave :</strong>
<ul style="margin:0.4rem 0 0 1.2rem;line-height:1.7">
<li>Le secret est maintenant public dans l'historique Git</li>
<li>Des bots scannent GitHub en temps réel — la clé peut être exploitée en <strong>moins de 30 secondes</strong></li>
<li>Conséquences possibles : factures AWS frauduleuses, exfiltration de données, atteinte à la réputation</li>
</ul>
<br><strong>Action corrective immédiate :</strong> révoquer la clé AWS puis <a href="https://docs.github.com/fr/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository" style="color:var(--primary)">réécrire l'historique</a>.`
            }
        };

        const renderInitial = () => `
<div class="gssw-phase initial">🔄 Prêt à pousser</div>
<div class="gssw-terminal">
    <div class="gssw-terminal-bar">
        <span class="gssw-dot gssw-dot-r"></span>
        <span class="gssw-dot gssw-dot-y"></span>
        <span class="gssw-dot gssw-dot-g"></span>
        <span class="gssw-term-title">bash — ~/monprojet</span>
    </div>
    <div class="gssw-term-body">
        <span class="gssw-line output">Vous venez d'ajouter une clé AWS dans config/secrets.py :</span>
        <span class="gssw-line blank"> </span>
        <span class="gssw-line output">  # config/secrets.py</span>
        <span class="gssw-line output">  aws_access_key_id = <span class="gssw-secret-highlight">"AKIAIOSFODNN7EXAMPLE"</span></span>
        <span class="gssw-line output">  aws_secret_access_key = <span class="gssw-secret-highlight">"wJalrXUtnFEMI/K7MDENG/bPxRfiCY"</span></span>
        <span class="gssw-line blank"> </span>
        <span class="gssw-line output">Vous avez commité ce fichier et tentez de pousser sur GitHub...</span>
        <span class="gssw-line blank"> </span>
        <span class="gssw-line prompt">~/monprojet (main) $ <span class="gssw-cursor">▌</span></span>
    </div>
</div>
<div style="text-align:center">
    <button class="btn btn-primary" id="gssw-push-btn">▶ git push origin main</button>
</div>`;

        const renderPushing = (lines) => `
<div class="gssw-phase blocked">⛔ Push bloqué par GitHub Push Protection</div>
<div class="gssw-terminal">
    <div class="gssw-terminal-bar">
        <span class="gssw-dot gssw-dot-r"></span>
        <span class="gssw-dot gssw-dot-y"></span>
        <span class="gssw-dot gssw-dot-g"></span>
        <span class="gssw-term-title">bash — ~/monprojet</span>
    </div>
    <div class="gssw-term-body" id="gssw-term-body">
        ${lines.map(l => `<span class="gssw-line ${l.cls}">${l.text}</span>`).join('')}
    </div>
</div>`;

        const renderChoice = () => `
<div class="gssw-phase blocked">⛔ Push bloqué — que faites-vous ?</div>
<div class="gssw-terminal">
    <div class="gssw-terminal-bar">
        <span class="gssw-dot gssw-dot-r"></span>
        <span class="gssw-dot gssw-dot-y"></span>
        <span class="gssw-dot gssw-dot-g"></span>
        <span class="gssw-term-title">bash — ~/monprojet</span>
    </div>
    <div class="gssw-term-body">
        ${PUSH_LINES.map(l => `<span class="gssw-line ${l.cls}">${l.text}</span>`).join('')}
    </div>
</div>
<div class="gssw-choices">
    <button class="gssw-choice-btn" data-choice="remove">
        <span class="gssw-choice-icon">🗑️</span>
        <div class="gssw-choice-body">
            <div class="gssw-choice-title">Supprimer le secret et réécrire l'historique</div>
            <div class="gssw-choice-desc">Révoquer la clé chez AWS, retirer le fichier, réécrire l'historique git avec filter-repo, puis forcer le push.</div>
        </div>
    </button>
    <button class="gssw-choice-btn" data-choice="manager">
        <span class="gssw-choice-icon">🔐</span>
        <div class="gssw-choice-body">
            <div class="gssw-choice-title">Passer à un gestionnaire de secrets</div>
            <div class="gssw-choice-desc">Remplacer la valeur en dur par une variable d'environnement ou AWS Secrets Manager. Ne jamais commiter de secrets.</div>
        </div>
    </button>
    <button class="gssw-choice-btn danger" data-choice="bypass">
        <span class="gssw-choice-icon">⚠️</span>
        <div class="gssw-choice-body">
            <div class="gssw-choice-title">Demander un bypass (ignorer l'alerte)</div>
            <div class="gssw-choice-desc">Justifier à GitHub que c'est un faux positif et forcer le push malgré la détection.</div>
        </div>
    </button>
</div>`;

        const renderResult = (key) => {
            const r = RESULTS[key];
            return `
<div class="gssw-phase ${key === 'bypass' ? 'warning' : 'resolved'}">${key === 'bypass' ? '⚠️ Bypass activé' : '✅ Résolu correctement'}</div>
<div class="gssw-result ${r.cls}">
    <div class="gssw-result-title">${r.title}</div>
    ${r.body}
</div>
<button class="gssw-restart-btn" id="gssw-restart">↺ Recommencer</button>`;
        };

        const render = () => {
            let html = '';
            if (phase === 'initial') html = renderInitial();
            else if (phase === 'pushing') html = renderPushing([]);
            else if (phase === 'blocked') html = renderChoice();
            else html = renderResult(phase);

            container.innerHTML = `<div class="gssw-root">${html}</div>`;
            bindEvents();
        };

        const animatePush = () => {
            phase = 'pushing';
            render();
            let lineIdx = 0;
            pushInterval = setInterval(() => {
                if (lineIdx >= PUSH_LINES.length) {
                    clearInterval(pushInterval);
                    setTimeout(() => {
                        phase = 'blocked';
                        render();
                    }, 400);
                    return;
                }
                const body = container.querySelector('#gssw-term-body');
                if (body) {
                    const span = document.createElement('span');
                    span.className = `gssw-line ${PUSH_LINES[lineIdx].cls}`;
                    span.textContent = PUSH_LINES[lineIdx].text;
                    body.appendChild(span);
                    body.scrollTop = body.scrollHeight;
                }
                lineIdx++;
            }, 80);
        };

        const bindEvents = () => {
            container.querySelector('#gssw-push-btn')?.addEventListener('click', animatePush);

            container.querySelectorAll('[data-choice]').forEach(btn => {
                btn.addEventListener('click', () => {
                    phase = btn.dataset.choice;
                    render();
                });
            });

            container.querySelector('#gssw-restart')?.addEventListener('click', () => {
                if (pushInterval) clearInterval(pushInterval);
                phase = 'initial';
                render();
            });
        };

        render();
        return {
            destroy() {
                if (pushInterval) clearInterval(pushInterval);
                container.innerHTML = '';
            }
        };
    }
}
window.GitSecretScanningWidget = GitSecretScanningWidget;
