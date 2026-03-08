/**
 * GitCommitSigningWidget — simulation du badge "Verified" GitHub.
 *
 * Compare côte à côte un commit non signé et un commit signé,
 * puis guide l'étudiant à travers les étapes de configuration de la signature SSH.
 */
class GitCommitSigningWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitCommitSigningWidget._stylesInjected) return;
        GitCommitSigningWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.gcsw-root { font-family: var(--font); color: var(--text); }

/* Comparaison non signé / signé */
.gcsw-compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
}
@media (max-width: 560px) { .gcsw-compare { grid-template-columns: 1fr; } }

.gcsw-commit-card {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
}
.gcsw-commit-card.unsigned { border-color: #e5e7eb; }
.gcsw-commit-card.signed   { border-color: #22c55e; }

.gcsw-card-header {
    padding: 0.5rem 0.85rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.gcsw-commit-card.unsigned .gcsw-card-header { background: #f9fafb; color: var(--muted); }
.gcsw-commit-card.signed   .gcsw-card-header { background: #f0fdf4; color: #16a34a; }

.gcsw-card-body { padding: 0.75rem 0.85rem; background: var(--card); }

/* Ligne de commit style GitHub */
.gcsw-commit-row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
}
.gcsw-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: #7c3aed;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
}
.gcsw-commit-info { flex: 1; min-width: 0; }
.gcsw-commit-msg {
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.gcsw-commit-meta {
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 0.15rem;
}

/* Badge Verified */
.gcsw-badge-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.gcsw-badge-verified {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    border: 1.5px solid #22c55e;
    background: #dcfce7;
    color: #166534;
    cursor: pointer;
    position: relative;
}
.gcsw-badge-unverified {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    border: 1.5px solid var(--border);
    background: var(--hover);
    color: var(--muted);
}
.gcsw-badge-tooltip {
    position: absolute;
    left: 50%; top: calc(100% + 6px);
    transform: translateX(-50%);
    background: #1e293b;
    color: #e2e8f0;
    font-size: 0.7rem;
    font-weight: 400;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    width: 220px;
    white-space: normal;
    z-index: 10;
    pointer-events: none;
    line-height: 1.4;
    display: none;
}
.gcsw-badge-verified:hover .gcsw-badge-tooltip { display: block; }

.gcsw-hash {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #4f46e5;
    background: #eef2ff;
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
}

/* Étapes de configuration */
.gcsw-steps-title {
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
}
.gcsw-steps { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }

.gcsw-step {
    display: grid;
    grid-template-columns: 2rem 1fr auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.85rem;
    border: 2px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    transition: all 0.3s;
}
.gcsw-step.done    { border-color: #22c55e; background: #f0fdf4; }
.gcsw-step.active  { border-color: var(--primary); background: #eef2ff; }
.gcsw-step.pending { opacity: 0.55; }

.gcsw-step-num {
    width: 28px; height: 28px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700;
    background: var(--border); color: var(--muted);
    flex-shrink: 0;
    transition: all 0.3s;
}
.gcsw-step.done  .gcsw-step-num  { background: #22c55e; color: #fff; }
.gcsw-step.active .gcsw-step-num { background: var(--primary); color: #fff; }

.gcsw-step-body { min-width: 0; }
.gcsw-step-name { font-size: 0.82rem; font-weight: 600; }
.gcsw-step-cmd  {
    font-family: var(--font-mono); font-size: 0.72rem;
    color: var(--muted); margin-top: 0.15rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gcsw-step.done .gcsw-step-cmd { color: #16a34a; }

.gcsw-step-btn {
    font-family: var(--font); font-size: 0.75rem; font-weight: 600;
    padding: 0.3rem 0.65rem;
    border: 2px solid var(--primary); border-radius: var(--radius-sm);
    background: var(--card); color: var(--primary); cursor: pointer;
    white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
}
.gcsw-step-btn:hover { background: var(--primary); color: #fff; }

.gcsw-result-box {
    background: #f0fdf4;
    border: 2px solid #22c55e;
    border-radius: var(--radius);
    padding: 0.85rem 1rem;
    font-size: 0.82rem;
    line-height: 1.55;
    display: none;
}
.gcsw-result-box.visible { display: block; }
.gcsw-result-title { font-weight: 700; color: #15803d; margin-bottom: 0.35rem; font-size: 0.88rem; }

.gcsw-restart-btn {
    font-family: var(--font); font-size: 0.78rem; font-weight: 600;
    padding: 0.35rem 0.75rem;
    border: 2px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card); color: var(--muted); cursor: pointer;
    transition: all 0.15s; margin-top: 0.6rem;
}
.gcsw-restart-btn:hover { border-color: var(--text); color: var(--text); }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitCommitSigningWidget.ensureStyles();

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
