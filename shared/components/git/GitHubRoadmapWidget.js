/**
 * GitHubRoadmapWidget — frise chronologique des milestones GitHub.
 *
 * Affiche 4 milestones sur un axe temporel horizontal (Jan 2025 → Jan 2026)
 * avec marqueur "aujourd'hui", tooltips et panneau détail.
 */
class GitHubRoadmapWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitHubRoadmapWidget._stylesInjected) return;
        GitHubRoadmapWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.grw-root {
    font-family: var(--font);
    color: var(--text);
}
.grw-timeline-wrap {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    padding: 1rem 1.25rem;
    overflow-x: auto;
    margin-bottom: 1rem;
    position: relative;
}
.grw-svg {
    display: block;
}
.grw-legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.78rem;
    margin-bottom: 0.75rem;
    align-items: center;
}
.grw-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}
.grw-legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}
.grw-tooltip {
    position: fixed;
    background: var(--card, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: var(--radius-sm);
    padding: 0.6rem 0.85rem;
    font-size: 0.8rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    pointer-events: none;
    z-index: 9999;
    max-width: 220px;
    display: none;
}
.grw-tooltip.visible { display: block; }
.grw-tooltip-name {
    font-weight: 700;
    margin-bottom: 0.25rem;
}
.grw-tooltip-row { color: var(--muted); margin-bottom: 0.15rem; }
.grw-tooltip-pct {
    font-weight: 700;
    margin-top: 0.2rem;
}
.grw-detail {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--card);
    padding: 0.85rem 1rem;
}
.grw-detail-hidden { display: none; }
.grw-detail-title {
    font-size: 0.95rem;
    font-weight: 700;
    margin-bottom: 0.6rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.grw-detail-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}
.grw-issue-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.grw-issue-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
}
.grw-issue-icon { font-size: 0.75rem; }
.grw-issue-closed { text-decoration: line-through; color: var(--muted); }
`;
        document.head.appendChild(style);
    }

    static MILESTONES = [
        {
            id: 'v1.0',
            label: 'v1.0',
            status: 'closed',
            color: '#10b981',
            startMonth: 0,  // Jan 2025
            endMonth: 1,    // Feb 2025
            pct: 100,
            totalIssues: 5,
            closedIssues: 5,
            issues: [
                { title: 'Mise en place de la base de données', closed: true },
                { title: 'Authentification utilisateur', closed: true },
                { title: 'Page d\'accueil', closed: true },
                { title: 'Tests unitaires de base', closed: true },
                { title: 'Déploiement en staging', closed: true },
            ],
        },
        {
            id: 'v1.1',
            label: 'v1.1',
            status: 'in_progress',
            color: '#4f46e5',
            startMonth: 2,  // Mar 2025
            endMonth: 3,    // Apr 2025
            pct: 60,
            totalIssues: 5,
            closedIssues: 3,
            issues: [
                { title: 'Crash au démarrage sur Windows', closed: true },
                { title: 'Erreur 404 sur la page profil', closed: true },
                { title: 'Timeout sur les requêtes lentes', closed: true },
                { title: 'Amélioration des performances', closed: false },
                { title: 'Mise à jour des dépendances', closed: false },
            ],
        },
        {
            id: 'v2.0',
            label: 'v2.0',
            status: 'planned',
            color: '#f59e0b',
            startMonth: 4,  // May 2025
            endMonth: 7,    // Aug 2025
            pct: 10,
            totalIssues: 8,
            closedIssues: 1,
            issues: [
                { title: 'Ajouter le mode sombre', closed: false },
                { title: 'Intégration Google OAuth', closed: false },
                { title: 'API REST pour les exports', closed: false },
                { title: 'Refonte de l\'interface mobile', closed: false },
                { title: 'Notifications en temps réel', closed: false },
                { title: 'Tableau de bord analytique', closed: false },
                { title: 'Documentation API complète', closed: false },
                { title: 'Prototype initial du mode sombre', closed: true },
            ],
        },
        {
            id: 'v3.0',
            label: 'v3.0',
            status: 'future',
            color: '#9ca3af',
            startMonth: 8,  // Sep 2025
            endMonth: 12,   // Jan 2026
            pct: 0,
            totalIssues: 4,
            closedIssues: 0,
            issues: [
                { title: 'Intelligence artificielle intégrée', closed: false },
                { title: 'Application mobile native', closed: false },
                { title: 'Internationalisation complète', closed: false },
                { title: 'Marketplace de plugins', closed: false },
            ],
        },
    ];

    static MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan'];
    static STATUS_LABELS = {
        closed: 'Fermé',
        in_progress: 'En cours',
        planned: 'Planifié',
        future: 'Futur',
    };

    static mount(container, config = {}) {
        GitHubRoadmapWidget.ensureStyles();

        let activeMs = null;
        const TOTAL_MONTHS = 13; // Jan 2025 to Jan 2026
        const SVG_W = 620;
        const SVG_H = 160;
        const MARGIN_LEFT = 30;
        const MARGIN_TOP = 28;
        const MARGIN_RIGHT = 10;
        const TIMELINE_W = SVG_W - MARGIN_LEFT - MARGIN_RIGHT;
        const BAR_H = 22;
        const BAR_GAP = 8;
        const ROWS_TOP = MARGIN_TOP + 14;

        // Current date: Feb 2026 = month 13 of Jan2025 axis  → index 13
        // But axis goes 0..12 (Jan 2025 to Jan 2026 = 13 labels for 12 intervals)
        // Feb 2026 is beyond the axis: clamp at 12
        const TODAY_MONTH = 13; // Feb 2026, clamped to end

        function monthToX(m) {
            return MARGIN_LEFT + (m / 12) * TIMELINE_W;
        }

        function buildSVG() {
            const MS = GitHubRoadmapWidget.MILESTONES;
            const LABELS = GitHubRoadmapWidget.MONTH_LABELS;

            // Axis ticks
            let axisHtml = '';
            for (let m = 0; m <= 12; m++) {
                const x = monthToX(m);
                axisHtml += `<line x1="${x.toFixed(1)}" y1="${MARGIN_TOP}" x2="${x.toFixed(1)}" y2="${SVG_H - 10}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>`;
                axisHtml += `<text x="${x.toFixed(1)}" y="${MARGIN_TOP - 4}" text-anchor="middle" font-size="10" fill="var(--muted)">${LABELS[m]}</text>`;
            }

            // Year labels
            axisHtml += `<text x="${monthToX(6).toFixed(1)}" y="12" text-anchor="middle" font-size="10" fill="var(--muted)" font-weight="600">2025</text>`;

            // Today marker (clamped)
            const todayX = monthToX(Math.min(TODAY_MONTH, 12));
            axisHtml += `<line x1="${todayX.toFixed(1)}" y1="${MARGIN_TOP - 8}" x2="${todayX.toFixed(1)}" y2="${SVG_H - 10}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3"/>`;
            axisHtml += `<text x="${todayX.toFixed(1)}" y="${MARGIN_TOP - 10}" text-anchor="middle" font-size="9" fill="#ef4444" font-weight="700">Aujourd'hui</text>`;

            // Milestone bars
            let barsHtml = '';
            MS.forEach((ms, i) => {
                const x1 = monthToX(ms.startMonth);
                const x2 = monthToX(ms.endMonth);
                const y = ROWS_TOP + i * (BAR_H + BAR_GAP);
                const barW = x2 - x1;
                const isActive = activeMs === ms.id;

                barsHtml += `<g class="grw-ms-bar" data-ms="${ms.id}" style="cursor:pointer">
                    <rect x="${x1.toFixed(1)}" y="${y}" width="${barW.toFixed(1)}" height="${BAR_H}" rx="4" ry="4"
                        fill="${ms.color}" opacity="${isActive ? 1 : 0.75}" stroke="${isActive ? ms.color : 'transparent'}" stroke-width="2"/>`;

                // Progress fill
                const fillW = Math.max(0, (ms.pct / 100) * barW);
                if (ms.pct > 0 && ms.pct < 100) {
                    barsHtml += `<rect x="${x1.toFixed(1)}" y="${y}" width="${fillW.toFixed(1)}" height="${BAR_H}" rx="4" ry="4" fill="${ms.color}" opacity="1"/>`;
                }

                // Label
                const labelX = x1 + barW / 2;
                const labelY = y + BAR_H / 2 + 4;
                barsHtml += `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" pointer-events="none">${ms.label} — ${ms.pct}%</text>`;

                barsHtml += `</g>`;
            });

            return `<svg class="grw-svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}">
${axisHtml}
${barsHtml}
</svg>`;
        }

        function buildDetail() {
            if (!activeMs) return `<div class="grw-detail grw-detail-hidden"></div>`;
            const ms = GitHubRoadmapWidget.MILESTONES.find(m => m.id === activeMs);
            if (!ms) return '';
            const statusLabel = GitHubRoadmapWidget.STATUS_LABELS[ms.status] || ms.status;
            const issueRows = ms.issues.map(iss =>
                `<li class="grw-issue-item">
                    <span class="grw-issue-icon">${iss.closed ? '&#10003;' : '&#9675;'}</span>
                    <span class="${iss.closed ? 'grw-issue-closed' : ''}">${iss.title}</span>
                </li>`
            ).join('');
            return `<div class="grw-detail">
                <div class="grw-detail-title">
                    <div class="grw-detail-dot" style="background:${ms.color}"></div>
                    ${ms.label} — ${statusLabel} — ${ms.pct}% complet
                </div>
                <div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.5rem">${ms.closedIssues} / ${ms.totalIssues} issues fermées</div>
                <ul class="grw-issue-list">${issueRows}</ul>
            </div>`;
        }

        function render() {
            const MS = GitHubRoadmapWidget.MILESTONES;
            const legendHtml = [
                { color: '#10b981', label: 'Fermé' },
                { color: '#4f46e5', label: 'En cours' },
                { color: '#f59e0b', label: 'Planifié' },
                { color: '#9ca3af', label: 'Futur' },
            ].map(l => `<div class="grw-legend-item">
                <div class="grw-legend-dot" style="background:${l.color}"></div>
                <span>${l.label}</span>
            </div>`).join('');

            container.innerHTML = `
<div class="grw-root">
  <div class="grw-legend">${legendHtml}</div>
  <div class="grw-timeline-wrap">
    ${buildSVG()}
  </div>
  ${buildDetail()}
  <div class="grw-tooltip" id="grw-tooltip"></div>
</div>`;

            const tooltip = container.querySelector('#grw-tooltip');

            container.querySelectorAll('.grw-ms-bar').forEach(bar => {
                const msId = bar.dataset.ms;
                const ms = MS.find(m => m.id === msId);
                if (!ms) return;

                bar.addEventListener('click', () => {
                    activeMs = activeMs === msId ? null : msId;
                    render();
                });

                bar.addEventListener('mouseenter', (e) => {
                    const statusLabel = GitHubRoadmapWidget.STATUS_LABELS[ms.status] || ms.status;
                    const startLabel = GitHubRoadmapWidget.MONTH_LABELS[ms.startMonth];
                    const endLabel = GitHubRoadmapWidget.MONTH_LABELS[ms.endMonth];
                    const year = '2025';
                    tooltip.innerHTML = `
<div class="grw-tooltip-name">${ms.label}</div>
<div class="grw-tooltip-row">Statut : ${statusLabel}</div>
<div class="grw-tooltip-row">Période : ${startLabel} – ${endLabel} ${year}</div>
<div class="grw-tooltip-row">Issues : ${ms.closedIssues} / ${ms.totalIssues} fermées</div>
<div class="grw-tooltip-pct" style="color:${ms.color}">${ms.pct}% complet</div>
<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem">Cliquez pour voir le détail</div>`;
                    tooltip.classList.add('visible');
                });

                bar.addEventListener('mousemove', (e) => {
                    const x = e.clientX + 12;
                    const y = e.clientY - 10;
                    tooltip.style.left = x + 'px';
                    tooltip.style.top = y + 'px';
                });

                bar.addEventListener('mouseleave', () => {
                    tooltip.classList.remove('visible');
                });
            });
        }

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}

window.GitHubRoadmapWidget = GitHubRoadmapWidget;
