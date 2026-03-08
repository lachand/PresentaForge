class DependabotAlertWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (DependabotAlertWidget._stylesInjected) return;
        DependabotAlertWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
        .dep-widget { font-family: var(--font-sans, sans-serif); display: flex; flex-direction: column; gap: 1rem; }
        .dep-selector { display: flex; gap: 0.4rem; flex-wrap: wrap; }
        .dep-sel-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; border: 1.5px solid var(--border, #e2e8f0); border-radius: 6px; background: var(--bg, #fff); cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: all 0.15s; color: var(--text, #1e293b); }
        .dep-sel-btn:hover { border-color: var(--sel-color, #6366f1); color: var(--sel-color, #6366f1); }
        .dep-sel-btn.active { border-color: var(--sel-color, #6366f1); background: color-mix(in srgb, var(--sel-color, #6366f1) 10%, white); color: var(--sel-color, #6366f1); font-weight: 700; }
        .dep-sel-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dep-card { border: 1px solid var(--border, #e2e8f0); border-radius: 10px; overflow: hidden; }
        .dep-card-header { padding: 0.9rem 1rem; background: var(--bg-alt, #f8fafc); border-bottom: 1px solid var(--border, #e2e8f0); display: flex; flex-direction: column; gap: 0.3rem; }
        .dep-severity-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; width: fit-content; }
        .dep-card-title { font-weight: 700; font-size: 0.95rem; color: var(--heading, #1e293b); }
        .dep-card-sub { font-size: 0.78rem; color: var(--muted, #64748b); }
        .dep-card-body { padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .dep-meta { display: flex; gap: 1rem; flex-wrap: wrap; }
        .dep-meta-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
        .dep-meta-label { color: var(--muted, #64748b); }
        .dep-cvss { color: white; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
        .dep-desc { font-size: 0.82rem; color: var(--muted, #475569); line-height: 1.55; margin: 0; }
        .dep-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .dep-action-btn { padding: 0.4rem 0.85rem; border-radius: 6px; border: 1.5px solid var(--border, #e2e8f0); background: var(--bg, #fff); cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: all 0.15s; color: var(--text, #1e293b); }
        .dep-action-btn:hover { background: var(--bg-alt, #f1f5f9); }
        .dep-action-btn.active { border-color: var(--primary, #6366f1); background: #eef2ff; color: var(--primary, #6366f1); font-weight: 700; }
        .dep-panel { padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border, #e2e8f0); font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .dep-panel-title { font-weight: 700; font-size: 0.85rem; }
        .dep-panel-merge { background: #f0fdf4; border-color: #86efac; }
        .dep-panel-dismiss { background: #fef2f2; border-color: #fca5a5; }
        .dep-panel-cve { background: var(--bg-alt, #f8fafc); }
        .dep-pr-card { background: white; border: 1px solid #86efac; border-radius: 6px; padding: 0.6rem 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; }
        .dep-pr-header { display: flex; gap: 0.6rem; align-items: flex-start; }
        .dep-pr-icon { font-size: 1rem; flex-shrink: 0; }
        .dep-pr-title { font-weight: 600; font-size: 0.82rem; color: #166534; }
        .dep-pr-sub { font-size: 0.73rem; color: #4b5563; }
        .dep-pr-checks { display: flex; flex-direction: column; gap: 0.15rem; padding-left: 1.6rem; }
        .dep-pr-check { font-size: 0.75rem; color: #374151; }
        .dep-panel-tip { background: #dcfce7; border-radius: 4px; padding: 0.4rem 0.6rem; font-size: 0.77rem; color: #166534; }
        .dep-dismiss-options { display: flex; flex-direction: column; gap: 0.4rem; }
        .dep-dismiss-opt { display: flex; gap: 0.6rem; padding: 0.5rem 0.6rem; border-radius: 6px; background: white; border: 1px solid var(--border, #e2e8f0); align-items: flex-start; }
        .dep-dismiss-opt-warn { border-color: #fde68a; background: #fefce8; }
        .dep-dismiss-opt-danger { border-color: #fca5a5; background: #fef2f2; }
        .dep-dismiss-opt span { font-size: 1rem; flex-shrink: 0; }
        .dep-dismiss-opt div { font-size: 0.78rem; line-height: 1.45; color: #374151; }
        .dep-cve-table { width: 100%; border-collapse: collapse; }
        .dep-cve-table td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--border, #e2e8f0); vertical-align: top; }
        .dep-cve-table td:first-child { color: var(--muted, #64748b); width: 38%; font-size: 0.77rem; }
        .dep-cve-table td:last-child { font-size: 0.8rem; }
        `;
        document.head.appendChild(s);
    }

    static ALERTS = [
        {
            severity: 'critical', severityLabel: 'Critique', severityColor: '#dc2626',
            ecosystem: 'npm', ecosystemIcon: '📦', package: 'minimist',
            affected: '< 1.2.6', fixed: '1.2.6',
            cve: 'CVE-2021-44906', cvss: 9.8, cvssLabel: 'Critique',
            title: 'Prototype Pollution in minimist',
            desc: 'La fonction minimist() est vulnérable à la pollution de prototype. Un attaquant peut modifier Object.prototype via des arguments malformés, affectant l\'ensemble des objets JavaScript dans le processus Node.js.',
            impact: 'Exécution de code arbitraire, contournement de la logique applicative, élévation de privilèges.',
            prTitle: 'Bump minimist from 1.2.5 to 1.2.6',
            prFiles: 'package.json, package-lock.json',
            prChecks: ['✅ Tests : 142 passed', '✅ Security scan : clean', '✅ Lint : no issues'],
        },
        {
            severity: 'high', severityLabel: 'Élevé', severityColor: '#ea580c',
            ecosystem: 'npm', ecosystemIcon: '📦', package: 'lodash',
            affected: '< 4.17.21', fixed: '4.17.21',
            cve: 'CVE-2021-23337', cvss: 7.2, cvssLabel: 'Élevé',
            title: 'Command Injection via _.template()',
            desc: 'La méthode _.template() de Lodash est vulnérable à l\'injection de commandes via le paramètre sourceURL, permettant l\'exécution de code arbitraire si des entrées utilisateur non filtrées y sont passées.',
            impact: 'Exécution de code côté serveur si des données utilisateur atteignent _.template().',
            prTitle: 'Bump lodash from 4.17.20 to 4.17.21',
            prFiles: 'package.json, package-lock.json',
            prChecks: ['✅ Tests : 318 passed', '✅ Lint : passed', '⚠ 1 minor deprecation warning'],
        },
        {
            severity: 'medium', severityLabel: 'Moyen', severityColor: '#d97706',
            ecosystem: 'pip', ecosystemIcon: '🐍', package: 'Pillow',
            affected: '< 10.0.1', fixed: '10.0.1',
            cve: 'CVE-2023-44271', cvss: 5.5, cvssLabel: 'Moyen',
            title: 'Uncontrolled Resource Consumption (DoS)',
            desc: 'Pillow accepte des fichiers TIFF malformés contenant des données EXIF excessivement volumineuses, provoquant une consommation mémoire non contrôlée pouvant mener à un déni de service.',
            impact: 'Un attaquant peut crasher votre service en envoyant une image TIFF spécialement forgée.',
            prTitle: 'Bump Pillow from 9.5.0 to 10.0.1',
            prFiles: 'requirements.txt',
            prChecks: ['✅ Tests : 94 passed', '⚠ 2 breaking changes dans le changelog (voir CHANGES.rst)'],
        },
    ];

    static mount(container, config = {}) {
        DependabotAlertWidget.ensureStyles();

        let currentAlert = 0;
        let currentAction = null;

        const render = () => {
            const a = DependabotAlertWidget.ALERTS[currentAlert];
            container.innerHTML = `<div class="dep-widget">
                <div class="dep-selector">
                    ${DependabotAlertWidget.ALERTS.map((al, i) => `
                    <button class="dep-sel-btn ${i === currentAlert ? 'active' : ''}" data-idx="${i}" style="--sel-color:${al.severityColor}">
                        <span class="dep-sel-dot" style="background:${al.severityColor}"></span>
                        ${al.severityLabel} · ${al.package}
                    </button>`).join('')}
                </div>
                <div class="dep-card">
                    <div class="dep-card-header">
                        <div class="dep-severity-badge" style="background:${a.severityColor}18;color:${a.severityColor};border:1px solid ${a.severityColor}50">
                            ⚠ Sévérité ${a.severityLabel}
                        </div>
                        <div class="dep-card-title">${a.title}</div>
                        <div class="dep-card-sub">${a.ecosystemIcon} ${a.ecosystem} · <strong>${a.package}</strong> · versions affectées : <code>${a.affected}</code></div>
                    </div>
                    <div class="dep-card-body">
                        <div class="dep-meta">
                            <div class="dep-meta-item">
                                <span class="dep-meta-label">CVE</span>
                                <code>${a.cve}</code>
                            </div>
                            <div class="dep-meta-item">
                                <span class="dep-meta-label">CVSS</span>
                                <span class="dep-cvss" style="background:${a.severityColor}">${a.cvss} / 10 — ${a.cvssLabel}</span>
                            </div>
                            <div class="dep-meta-item">
                                <span class="dep-meta-label">Correction disponible</span>
                                <code>≥ ${a.fixed}</code>
                            </div>
                        </div>
                        <p class="dep-desc">${a.desc}</p>
                        <div class="dep-actions">
                            <button class="dep-action-btn ${currentAction === 'merge' ? 'active' : ''}" data-action="merge">🔀 Voir la PR Dependabot</button>
                            <button class="dep-action-btn ${currentAction === 'dismiss' ? 'active' : ''}" data-action="dismiss">🚫 Ignorer l'alerte</button>
                            <button class="dep-action-btn ${currentAction === 'cve' ? 'active' : ''}" data-action="cve">📋 Détails CVE</button>
                        </div>
                        <div class="dep-result-panel">
                            ${currentAction === 'merge' ? DependabotAlertWidget.renderMergePanel(a) : ''}
                            ${currentAction === 'dismiss' ? DependabotAlertWidget.renderDismissPanel(a) : ''}
                            ${currentAction === 'cve' ? DependabotAlertWidget.renderCVEPanel(a) : ''}
                        </div>
                    </div>
                </div>
            </div>`;

            container.querySelectorAll('.dep-sel-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentAlert = parseInt(btn.dataset.idx);
                    currentAction = null;
                    render();
                });
            });
            container.querySelectorAll('.dep-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentAction = btn.dataset.action;
                    render();
                });
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }

    static renderMergePanel(a) {
        return `<div class="dep-panel dep-panel-merge">
            <div class="dep-panel-title">🔀 PR créée automatiquement par Dependabot</div>
            <div class="dep-pr-card">
                <div class="dep-pr-header">
                    <span class="dep-pr-icon">🟢</span>
                    <div>
                        <div class="dep-pr-title">${a.prTitle}</div>
                        <div class="dep-pr-sub">by dependabot[bot] · Fichiers : ${a.prFiles}</div>
                    </div>
                </div>
                <div class="dep-pr-checks">${a.prChecks.map(c => `<div class="dep-pr-check">${c}</div>`).join('')}</div>
            </div>
            <div class="dep-panel-tip">✅ <strong>Bonne pratique :</strong> Lisez le changelog avant de merger. Si la mise à jour est majeure, testez localement et vérifiez les breaking changes signalés.</div>
        </div>`;
    }

    static renderDismissPanel(a) {
        return `<div class="dep-panel dep-panel-dismiss">
            <div class="dep-panel-title">⚠️ Ignorer cette alerte — êtes-vous sûr ?</div>
            <p style="font-size:0.8rem;margin:0;color:#374151">GitHub vous demandera une justification. Voici les 3 options :</p>
            <div class="dep-dismiss-options">
                <div class="dep-dismiss-opt">
                    <span>🔍</span>
                    <div><strong>Fausse détection</strong> — le code vulnérable n'est pas accessible dans votre contexte d'exécution. Justifiable et acceptable si vous avez analysé l'impact réel.</div>
                </div>
                <div class="dep-dismiss-opt dep-dismiss-opt-warn">
                    <span>⏳</span>
                    <div><strong>Reporter</strong> — vous avez conscience de la vulnérabilité et planifiez une correction. Risqué si la CVE est exploitée activement (CVSS ${a.cvss}/10).</div>
                </div>
                <div class="dep-dismiss-opt dep-dismiss-opt-danger">
                    <span>❌</span>
                    <div><strong>Ignorer sans raison valable</strong> — avec un score CVSS de ${a.cvss}/10, cette vulnérabilité représente un risque réel. Fortement déconseillé.</div>
                </div>
            </div>
        </div>`;
    }

    static renderCVEPanel(a) {
        return `<div class="dep-panel dep-panel-cve">
            <div class="dep-panel-title">📋 Fiche ${a.cve}</div>
            <table class="dep-cve-table">
                <tr><td>Identifiant</td><td><code>${a.cve}</code></td></tr>
                <tr><td>Score CVSS v3</td><td><span class="dep-cvss" style="background:${a.severityColor}">${a.cvss} / 10 — ${a.cvssLabel}</span></td></tr>
                <tr><td>Package</td><td><code>${a.package}</code> (${a.ecosystem})</td></tr>
                <tr><td>Versions affectées</td><td><code>${a.affected}</code></td></tr>
                <tr><td>Version corrigée</td><td><code>≥ ${a.fixed}</code></td></tr>
                <tr><td>Impact</td><td>${a.impact}</td></tr>
            </table>
        </div>`;
    }
}
window.DependabotAlertWidget = DependabotAlertWidget;
