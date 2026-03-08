class SecretLeakTimelineWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (SecretLeakTimelineWidget._stylesInjected) return;
        SecretLeakTimelineWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
        .slt-widget { font-family: var(--font-sans, sans-serif); }
        .slt-controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .slt-btn { padding: 0.45rem 1.1rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: opacity 0.15s, transform 0.1s; }
        .slt-btn:active { transform: scale(0.97); }
        .slt-btn-play { background: var(--primary, #6366f1); color: white; }
        .slt-btn-reset { background: var(--bg-alt, #f1f5f9); color: var(--text, #1e293b); border: 1px solid var(--border, #e2e8f0); }
        .slt-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .slt-timer { font-family: monospace; font-size: 0.8rem; color: var(--muted, #94a3b8); }
        .slt-timeline { position: relative; padding-left: 2.25rem; display: flex; flex-direction: column; gap: 0; }
        .slt-step { position: relative; padding-bottom: 1.1rem; opacity: 0; transform: translateY(6px); transition: opacity 0.35s, transform 0.35s; }
        .slt-step.visible { opacity: 1; transform: translateY(0); }
        .slt-step:last-child { padding-bottom: 0; }
        .slt-dot { position: absolute; left: -2.1rem; top: 0.55rem; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; flex-shrink: 0; box-shadow: 0 0 0 2px; }
        .slt-connector { position: absolute; left: -1.65rem; top: 1.3rem; width: 2px; bottom: 0; }
        .slt-step:last-child .slt-connector { display: none; }
        .slt-step-inner { background: var(--card, #fff); border: 1px solid var(--border, #e2e8f0); border-left: 3px solid; border-radius: 8px; padding: 0.65rem 0.9rem; }
        .slt-step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem; flex-wrap: wrap; }
        .slt-step-icon { font-size: 1rem; flex-shrink: 0; }
        .slt-step-time { font-family: monospace; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px; color: white; white-space: nowrap; }
        .slt-step-label { font-weight: 600; font-size: 0.85rem; color: var(--heading, #1e293b); }
        .slt-step-desc { font-size: 0.8rem; color: var(--muted, #64748b); line-height: 1.55; }
        .slt-moral { margin-top: 1rem; padding: 0.8rem 1rem; background: #fefce8; border: 1px solid #fbbf24; border-radius: 8px; font-size: 0.83rem; line-height: 1.55; opacity: 0; transition: opacity 0.4s; }
        .slt-moral.visible { opacity: 1; }
        .slt-moral strong { color: #92400e; }
        `;
        document.head.appendChild(s);
    }

    static STEPS = [
        {
            timeStr: 'T + 0 s', icon: '💻', label: 'git push origin main',
            desc: 'Vous exécutez git push. Le commit contenant votre clé API est envoyé vers GitHub. Le dépôt est public.',
            color: '#3b82f6'
        },
        {
            timeStr: 'T + 3 s', icon: '☁️', label: 'GitHub reçoit le commit',
            desc: 'Le code est désormais accessible publiquement. GitHub indexe le contenu et déclenche les analyses automatiques de sécurité.',
            color: '#3b82f6'
        },
        {
            timeStr: 'T + 8 s', icon: '🔍', label: 'Secret Scanning détecte la clé',
            desc: 'GitHub Secret Scanning identifie un pattern connu : GITHUB_TOKEN=ghp_... La clé est valide et active. Une alerte interne est générée.',
            color: '#eab308'
        },
        {
            timeStr: 'T + 15 s', icon: '🤖', label: 'Bot tiers archive le secret',
            desc: 'Des bots spécialisés (GitGuardian, truffleHog, scanners malveillants) scrutent GitHub en temps réel. Votre token est capturé dans leur base — même si vous supprimez le commit ensuite.',
            color: '#f97316'
        },
        {
            timeStr: 'T + 45 s', icon: '⚠️', label: 'Premier test d\'utilisation',
            desc: 'Une requête GET /user est envoyée à l\'API GitHub avec votre token. Réponse : 200 OK. L\'accès est confirmé, les repos privés sont listés.',
            color: '#ef4444'
        },
        {
            timeStr: 'T + 60 s', icon: '🚨', label: 'Accès non autorisé confirmé',
            desc: 'Le bot peut lire vos dépôts privés, exfiltrer du code source, créer des webhooks ou pousser des commits en votre nom. La compromission est réelle et active.',
            color: '#dc2626'
        },
        {
            timeStr: 'T + 2 min', icon: '📧', label: 'GitHub vous alerte (trop tard)',
            desc: 'GitHub envoie un email de notification à votre adresse. Mais le secret est compromis depuis 2 minutes. La révocation immédiate reste l\'action prioritaire.',
            color: '#b91c1c'
        },
    ];

    static mount(container, config = {}) {
        SecretLeakTimelineWidget.ensureStyles();

        container.innerHTML = `<div class="slt-widget">
            <div class="slt-controls">
                <button class="slt-btn slt-btn-play">▶ Lancer la simulation</button>
                <button class="slt-btn slt-btn-reset">↺ Recommencer</button>
                <span class="slt-timer"></span>
            </div>
            <div class="slt-timeline">
                ${SecretLeakTimelineWidget.STEPS.map((step, i) => `
                <div class="slt-step" data-idx="${i}">
                    <span class="slt-dot" style="background:${step.color};box-shadow:0 0 0 2px ${step.color}"></span>
                    <div class="slt-connector" style="background:linear-gradient(to bottom,${step.color},${SecretLeakTimelineWidget.STEPS[i + 1]?.color || step.color})"></div>
                    <div class="slt-step-inner" style="border-left-color:${step.color}">
                        <div class="slt-step-header">
                            <span class="slt-step-icon">${step.icon}</span>
                            <span class="slt-step-time" style="background:${step.color}">${step.timeStr}</span>
                            <span class="slt-step-label">${step.label}</span>
                        </div>
                        <div class="slt-step-desc">${step.desc}</div>
                    </div>
                </div>`).join('')}
            </div>
            <div class="slt-moral">
                🔑 <strong>Règle fondamentale :</strong> Si vous exposez un secret, <strong>révoquez-le immédiatement</strong> chez le fournisseur (GitHub, AWS, Stripe…) — <em>avant</em> de supprimer le commit. La suppression de l'historique ne sert à rien si le secret est déjà capturé par un bot.
            </div>
        </div>`;

        const playBtn = container.querySelector('.slt-btn-play');
        const resetBtn = container.querySelector('.slt-btn-reset');
        const timerEl = container.querySelector('.slt-timer');
        const steps = container.querySelectorAll('.slt-step');
        const moral = container.querySelector('.slt-moral');
        let timer = null;

        const reset = () => {
            clearTimeout(timer);
            steps.forEach(s => s.classList.remove('visible'));
            moral.classList.remove('visible');
            timerEl.textContent = '';
            playBtn.disabled = false;
        };

        const play = () => {
            playBtn.disabled = true;
            let idx = 0;
            const revealNext = () => {
                if (idx >= steps.length) {
                    moral.classList.add('visible');
                    timerEl.textContent = '✓ Simulation terminée';
                    return;
                }
                steps[idx].classList.add('visible');
                timerEl.textContent = `En cours… ${SecretLeakTimelineWidget.STEPS[idx].timeStr}`;
                idx++;
                timer = setTimeout(revealNext, 1350);
            };
            revealNext();
        };

        playBtn.addEventListener('click', play);
        resetBtn.addEventListener('click', reset);

        return { destroy() { clearTimeout(timer); container.innerHTML = ''; } };
    }
}
window.SecretLeakTimelineWidget = SecretLeakTimelineWidget;
