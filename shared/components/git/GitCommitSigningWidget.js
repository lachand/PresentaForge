/**
 * GitCommitSigningWidget — simulation du badge "Verified" GitHub.
 *
 * Compare côte à côte un commit non signé et un commit signé,
 * puis guide l'étudiant à travers les étapes de configuration de la signature SSH.
 */
class GitCommitSigningWidget {
    static mount(container, config = {}) {
        const STEPS = [
            {
                name: 'Format de signature SSH',
                cmd: 'git config --global gpg.format ssh',
                detail: 'Indique à Git d\'utiliser SSH (plutôt que GPG) pour signer.'
            },
            {
                name: 'Clé de signature',
                cmd: 'git config --global user.signingkey ~/.ssh/id_ed25519.pub',
                detail: 'Pointe vers votre clé SSH publique existante.'
            },
            {
                name: 'Signature automatique',
                cmd: 'git config --global commit.gpgsign true',
                detail: 'Tous les prochains commits seront automatiquement signés.'
            },
            {
                name: 'Ajouter comme Signing Key sur GitHub',
                cmd: 'Settings → SSH keys → New SSH key → type: Signing Key',
                detail: 'GitHub vérifie la signature avec cette clé et affiche "Verified".'
            }
        ];

        let currentStep = 0; // -1 = tous terminés

        const render = () => {
            const allDone = currentStep >= STEPS.length;

            const stepsHtml = STEPS.map((step, i) => {
                const state = allDone || i < currentStep ? 'done' : i === currentStep ? 'active' : 'pending';
                const icon = state === 'done' ? '✓' : i + 1;
                const showBtn = state === 'active';
                return `
<div class="gcsw-step ${state}">
    <div class="gcsw-step-num">${icon}</div>
    <div class="gcsw-step-body">
        <div class="gcsw-step-name">${step.name}</div>
        <div class="gcsw-step-cmd">${step.cmd}</div>
    </div>
    ${showBtn ? `<button class="gcsw-step-btn" data-step="${i}">Exécuter →</button>` : ''}
</div>`;
            }).join('');

            container.innerHTML = `
<div class="gcsw-root">
    <div class="gcsw-compare">
        <div class="gcsw-commit-card unsigned">
            <div class="gcsw-card-header">❌ Sans signature</div>
            <div class="gcsw-card-body">
                <div class="gcsw-commit-row">
                    <div class="gcsw-avatar">B</div>
                    <div class="gcsw-commit-info">
                        <div class="gcsw-commit-msg">feat: add user settings</div>
                        <div class="gcsw-commit-meta">bob · il y a 2h · <span class="gcsw-hash">a1b2c3f</span></div>
                    </div>
                </div>
                <div class="gcsw-badge-row">
                    <span class="gcsw-badge-unverified">Non vérifié</span>
                    <span style="font-size:0.72rem;color:var(--muted)">Identité non prouvée — n'importe qui peut configurer ce nom</span>
                </div>
            </div>
        </div>
        <div class="gcsw-commit-card signed">
            <div class="gcsw-card-header">✅ Avec signature SSH</div>
            <div class="gcsw-card-body">
                <div class="gcsw-commit-row">
                    <div class="gcsw-avatar" style="background:#16a34a">A</div>
                    <div class="gcsw-commit-info">
                        <div class="gcsw-commit-msg">feat: add user settings</div>
                        <div class="gcsw-commit-meta">alice · il y a 2h · <span class="gcsw-hash">d4e5f6a</span></div>
                    </div>
                </div>
                <div class="gcsw-badge-row">
                    <span class="gcsw-badge-verified">
                        ✓ Verified
                        <span class="gcsw-badge-tooltip">Ce commit a été signé avec la clé SSH d'alice. GitHub a vérifié que la clé privée correspondant à la clé publique enregistrée a été utilisée pour signer.</span>
                    </span>
                    <span style="font-size:0.72rem;color:#16a34a">Authenticité cryptographiquement prouvée</span>
                </div>
            </div>
        </div>
    </div>

    <div class="gcsw-steps-title">Configurer la signature SSH — pas à pas</div>
    <div class="gcsw-steps">${stepsHtml}</div>

    <div class="gcsw-result-box ${allDone ? 'visible' : ''}">
        <div class="gcsw-result-title">✅ Configuration complète</div>
        Tous vos prochains commits seront automatiquement signés. Le badge <strong>Verified</strong> apparaîtra sur GitHub dès que la clé publique SSH est enregistrée comme Signing Key sur votre compte.
        <br><br>
        <strong>Vérifier un commit signé :</strong> <code>git log --show-signature -1</code>
        <br>
        <button class="gcsw-restart-btn" id="gcsw-restart">↺ Recommencer</button>
    </div>
</div>`;

            container.querySelectorAll('[data-step]').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentStep++;
                    render();
                });
            });

            container.querySelector('#gcsw-restart')?.addEventListener('click', () => {
                currentStep = 0;
                render();
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitCommitSigningWidget = GitCommitSigningWidget;
