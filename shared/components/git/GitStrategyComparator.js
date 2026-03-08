/**
 * GitStrategyComparator — comparateur visuel de 4 stratégies de branchement Git.
 *
 * Présente Trunk-Based, GitHub Flow, Gitflow et GitLab Flow avec des
 * timelines SVG lisibles et des fiches avantages/inconvénients.
 */
class GitStrategyComparator {
    static _stylesInjected = false;

    static COLORS = {
        main:    '#4f46e5',
        develop: '#0ea5e9',
        feature: '#10b981',
        release: '#f59e0b',
        hotfix:  '#ef4444',
        staging: '#8b5cf6',
        prod:    '#f97316',
    };

    static STRATEGIES = {
        'trunk': {
            label: 'Trunk-Based',
            desc: 'Tout le monde commit sur main fréquemment. Les feature flags masquent le code inachevé. Requiert une forte culture CI/CD.',
            pros: ['Intégration continue réelle', 'Pas de branches longues à maintenir'],
            cons: ['Requiert des feature flags', 'Nécessite une excellente couverture de tests'],
            render: (colors) => GitStrategyComparator._renderTrunk(colors)
        },
        'github': {
            label: 'GitHub Flow',
            desc: 'Une branche par fonctionnalité + Pull Request. Simple et adapté au déploiement continu.',
            pros: ['Simple à comprendre et pratiquer', 'Déploiement possible après chaque merge'],
            cons: ['Pas de gestion explicite des releases', 'Difficile avec plusieurs versions en production'],
            render: (colors) => GitStrategyComparator._renderGithubFlow(colors)
        },
        'gitflow': {
            label: 'Gitflow',
            desc: 'Structure rigoureuse avec branches dédiées par type. Idéal pour les releases planifiées.',
            pros: ['Isolation claire des phases', 'Hotfixes traçables et indépendants'],
            cons: ['Complexité élevée', 'Branches souvent longues = risque de conflits'],
            render: (colors) => GitStrategyComparator._renderGitflow(colors)
        },
        'gitlab': {
            label: 'GitLab Flow',
            desc: 'Les branches représentent des environnements (staging, prod). Simple et aligné sur le déploiement.',
            pros: ['Traçabilité deploy par environnement', 'Plus simple que Gitflow'],
            cons: ['Moins standard que GitHub Flow', 'Peut créer de la confusion sur la branche "vraie"'],
            render: (colors) => GitStrategyComparator._renderGitlabFlow(colors)
        }
    };

    static ensureStyles() {
        if (GitStrategyComparator._stylesInjected) return;
        GitStrategyComparator._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gsc-root {
    font-family: var(--font);
    color: var(--text);
}
.gsc-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--border);
    margin-bottom: 1rem;
    overflow-x: auto;
}
.gsc-tab {
    font-family: var(--font);
    font-size: 0.83rem;
    font-weight: 600;
    padding: 0.55rem 1.1rem;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    white-space: nowrap;
    transition: color 0.18s, border-color 0.18s;
}
.gsc-tab:hover { color: var(--text); }
.gsc-tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
}
.gsc-diagram-wrap {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 0;
    margin-bottom: 1rem;
    overflow-x: auto;
}
.gsc-diagram-wrap svg {
    display: block;
    margin: 0 auto;
    overflow: visible;
}
.gsc-info-card {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--card);
}
.gsc-info-header {
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text);
}
.gsc-info-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
}
@media (max-width: 520px) {
    .gsc-info-cols { grid-template-columns: 1fr; }
}
.gsc-pros, .gsc-cons {
    padding: 0.75rem 1rem;
}
.gsc-pros { border-right: 1px solid var(--border); }
@media (max-width: 520px) {
    .gsc-pros { border-right: none; border-bottom: 1px solid var(--border); }
}
.gsc-col-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
}
.gsc-pros .gsc-col-title { color: #10b981; }
.gsc-cons .gsc-col-title { color: #ef4444; }
.gsc-list {
    list-style: none;
    margin: 0; padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}
.gsc-list li {
    font-size: 0.82rem;
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    color: var(--text);
    line-height: 1.4;
}
.gsc-pros .gsc-list li::before { content: '+'; color: #10b981; font-weight: 700; flex-shrink: 0; }
.gsc-cons .gsc-list li::before { content: '-'; color: #ef4444; font-weight: 700; flex-shrink: 0; }
.gsc-legend {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border);
}
.gsc-legend-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: var(--muted);
}
.gsc-legend-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}
        `;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        GitStrategyComparator.ensureStyles();
        let activeKey = config.strategy || 'trunk';

        const render = () => {
            const keys = Object.keys(GitStrategyComparator.STRATEGIES);
            const tabsHtml = keys.map(k => {
                const s = GitStrategyComparator.STRATEGIES[k];
                return `<button class="gsc-tab${k === activeKey ? ' active' : ''}" data-key="${k}">${s.label}</button>`;
            }).join('');

            const active = GitStrategyComparator.STRATEGIES[activeKey];
            const colors = GitStrategyComparator.COLORS;
            const svgHtml = active.render(colors);
            const legendKeys = activeKey === 'trunk'   ? ['main', 'feature']
                             : activeKey === 'github'  ? ['main', 'feature']
                             : activeKey === 'gitflow' ? ['main', 'develop', 'feature', 'release', 'hotfix']
                             : ['main', 'feature', 'staging', 'prod'];
            const legendHtml = legendKeys.map(k =>
                `<span class="gsc-legend-item"><span class="gsc-legend-dot" style="background:${colors[k]}"></span>${k}</span>`
            ).join('');

            container.innerHTML = `
<div class="gsc-root">
    <div class="gsc-tabs">${tabsHtml}</div>
    <div class="gsc-diagram-wrap">${svgHtml}</div>
    <div class="gsc-info-card">
        <div class="gsc-info-header">${active.desc}</div>
        <div class="gsc-info-cols">
            <div class="gsc-pros">
                <div class="gsc-col-title">Avantages</div>
                <ul class="gsc-list">${active.pros.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
            <div class="gsc-cons">
                <div class="gsc-col-title">Inconvénients</div>
                <ul class="gsc-list">${active.cons.map(c => `<li>${c}</li>`).join('')}</ul>
            </div>
        </div>
        <div class="gsc-legend">${legendHtml}</div>
    </div>
</div>`;

            container.querySelectorAll('.gsc-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    activeKey = btn.dataset.key;
                    render();
                });
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }

    // --- SVG helpers ---

    static _circle(cx, cy, r, fill, stroke, label, labelPos = 'top') {
        const ly = labelPos === 'top' ? cy - r - 4 : cy + r + 11;
        return `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  ${label ? `<text x="${cx}" y="${ly}" text-anchor="middle" font-size="8" font-family="var(--font-mono)" fill="${stroke}">${label}</text>` : ''}`;
    }

    static _line(x1, y1, x2, y2, color, dashed = false, w = 3) {
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${dashed ? ' stroke-dasharray="5,3"' : ''}/>`;
    }

    static _tag(x, y, label, color) {
        const pad = 6;
        const w = label.length * 5.5 + pad * 2;
        return `
  <rect x="${x - w/2}" y="${y - 9}" width="${w}" height="17" rx="3" fill="${color}22" stroke="${color}" stroke-width="1.2"/>
  <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="8" font-family="var(--font-mono)" fill="${color}" font-weight="700">${label}</text>`;
    }

    static _branchLabel(x, y, label, color, anchor = 'start') {
        return `<text x="${x}" y="${y}" font-size="9" font-family="var(--font-mono)" fill="${color}" font-weight="700" text-anchor="${anchor}">${label}</text>`;
    }

    // --- Trunk-Based Development ---
    static _renderTrunk(c) {
        const W = 570, H = 148;
        const mainY = 82, featureY = 30;

        let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">`;

        // Main line
        svg += GitStrategyComparator._line(90, mainY, 548, mainY, c.main);
        svg += GitStrategyComparator._branchLabel(8, mainY + 4, 'main', c.main);

        // Main commits
        [110, 160, 210, 265, 330, 390, 448, 505].forEach((x, i) => {
            svg += GitStrategyComparator._circle(x, mainY, 5, '#fff', c.main, '');
            if (i === 3) svg += GitStrategyComparator._tag(x, mainY + 26, 'v1.0', c.main);
            if (i === 7) svg += GitStrategyComparator._tag(x, mainY + 26, 'v1.1', c.main);
        });

        // Two short feature branches (merge quickly)
        const features = [[145, 175], [310, 350]];
        features.forEach(([bx, mx]) => {
            svg += GitStrategyComparator._line(bx, mainY, bx, featureY, c.feature, false, 2);
            svg += GitStrategyComparator._line(bx, featureY, mx, featureY, c.feature, false, 2);
            svg += GitStrategyComparator._line(mx, featureY, mx, mainY, c.feature, false, 2);
            svg += GitStrategyComparator._circle(bx + (mx - bx) / 2, featureY, 4, '#fff', c.feature, '');
            svg += GitStrategyComparator._circle(mx, mainY, 6, c.feature, c.feature, '');
        });
        svg += GitStrategyComparator._branchLabel(148, featureY - 7, 'feature (courte durée)', c.feature);

        svg += '</svg>';
        return svg;
    }

    // --- GitHub Flow ---
    static _renderGithubFlow(c) {
        const W = 570, H = 170;
        const mainY = 88, f1Y = 35, f2Y = 142;

        let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">`;

        svg += GitStrategyComparator._line(90, mainY, 548, mainY, c.main);
        svg += GitStrategyComparator._branchLabel(8, mainY + 4, 'main', c.main);

        // Main commits (merge points)
        [110, 225, 390, 530].forEach(x => {
            svg += GitStrategyComparator._circle(x, mainY, 5, '#fff', c.main, '');
        });

        // feature/login: branches from commit 1, merges at commit 2
        svg += GitStrategyComparator._line(110, mainY, 120, f1Y, c.feature, false, 2);
        svg += GitStrategyComparator._line(120, f1Y, 215, f1Y, c.feature, false, 2);
        [148, 185].forEach(x => svg += GitStrategyComparator._circle(x, f1Y, 4, '#fff', c.feature, ''));
        svg += GitStrategyComparator._line(215, f1Y, 225, mainY, c.feature, false, 2);
        svg += GitStrategyComparator._branchLabel(122, f1Y - 8, 'feature/login', c.feature);
        svg += GitStrategyComparator._tag(225, mainY - 24, 'PR merge', c.feature);

        // feature/cart: branches from commit 2, merges at commit 3
        const c2 = '#0d9488';
        svg += GitStrategyComparator._line(225, mainY, 238, f2Y, c2, false, 2);
        svg += GitStrategyComparator._line(238, f2Y, 380, f2Y, c2, false, 2);
        [272, 318, 355].forEach(x => svg += GitStrategyComparator._circle(x, f2Y, 4, '#fff', c2, ''));
        svg += GitStrategyComparator._line(380, f2Y, 390, mainY, c2, false, 2);
        svg += GitStrategyComparator._branchLabel(240, f2Y + 15, 'feature/cart', c2);
        svg += GitStrategyComparator._tag(390, mainY - 24, 'PR merge', c2);

        svg += '</svg>';
        return svg;
    }

    // --- Gitflow ---
    // Layout (top → bottom): hotfix | main | release | develop | feature
    static _renderGitflow(c) {
        const W = 590, H = 262;
        const hotfixY = 18, mainY = 55, releaseY = 92, devY = 132, featY = 185;

        let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">`;

        // ── MAIN ──────────────────────────────────────────────────
        svg += GitStrategyComparator._line(22, mainY, 572, mainY, c.main, false, 3);
        svg += GitStrategyComparator._branchLabel(5, mainY - 7, 'main', c.main);
        // Commits: init, v1.0 (from release), v1.1 (from hotfix)
        [48, 315, 545].forEach(x => svg += GitStrategyComparator._circle(x, mainY, 6, '#fff', c.main, ''));
        svg += GitStrategyComparator._tag(48,  mainY + 24, 'v0.1', c.main);
        svg += GitStrategyComparator._tag(315, mainY + 24, 'v1.0', c.main);
        svg += GitStrategyComparator._tag(545, mainY + 24, 'v1.1', c.main);

        // ── HOTFIX (above main) ────────────────────────────────────
        // Branch from main at x=425, merge back to main at x=545 + sync to develop
        svg += GitStrategyComparator._line(425, mainY, 430, hotfixY, c.hotfix, false, 2);
        svg += GitStrategyComparator._line(430, hotfixY, 538, hotfixY, c.hotfix, false, 2);
        svg += GitStrategyComparator._circle(484, hotfixY, 4, '#fff', c.hotfix, '');
        svg += GitStrategyComparator._line(538, hotfixY, 545, mainY, c.hotfix, false, 2);
        // Dashed sync to develop
        svg += GitStrategyComparator._line(540, hotfixY, 550, devY, c.hotfix, true, 1.5);
        svg += GitStrategyComparator._branchLabel(433, hotfixY - 5, 'hotfix/x', c.hotfix);

        // ── DEVELOP ────────────────────────────────────────────────
        // Branches from first main commit, ends near hotfix sync
        svg += GitStrategyComparator._line(48, mainY, 55, devY, c.develop, false, 2.5);
        svg += GitStrategyComparator._line(55, devY, 562, devY, c.develop, false, 2.5);
        svg += GitStrategyComparator._branchLabel(5, devY - 7, 'develop', c.develop);
        [78, 148, 215, 325, 370, 438, 498, 552].forEach(x =>
            svg += GitStrategyComparator._circle(x, devY, 4, '#fff', c.develop, ''));

        // ── FEATURE (below develop) ────────────────────────────────
        svg += GitStrategyComparator._line(78, devY, 85, featY, c.feature, false, 2);
        svg += GitStrategyComparator._line(85, featY, 205, featY, c.feature, false, 2);
        [122, 168].forEach(x => svg += GitStrategyComparator._circle(x, featY, 4, '#fff', c.feature, ''));
        svg += GitStrategyComparator._line(205, featY, 215, devY, c.feature, false, 2);
        svg += GitStrategyComparator._branchLabel(88, featY + 14, 'feature/x', c.feature);

        // ── RELEASE (between main and develop) ────────────────────
        // Branch from develop at x=220, 80px long, merge to main at x=315 + to develop
        svg += GitStrategyComparator._line(220, devY, 228, releaseY, c.release, false, 2);
        svg += GitStrategyComparator._line(228, releaseY, 307, releaseY, c.release, false, 2);
        svg += GitStrategyComparator._circle(268, releaseY, 4, '#fff', c.release, '');
        svg += GitStrategyComparator._line(307, releaseY, 315, mainY, c.release, false, 2);
        // Dashed sync to develop
        svg += GitStrategyComparator._line(308, releaseY, 325, devY, c.release, true, 1.5);
        svg += GitStrategyComparator._branchLabel(230, releaseY - 7, 'release/1.0', c.release);

        svg += '</svg>';
        return svg;
    }

    // --- GitLab Flow ---
    // Layout: feature/x | main | staging | production
    static _renderGitlabFlow(c) {
        const W = 570, H = 178;
        const featY = 15, mainY = 45, stagY = 98, prodY = 152;

        const defs = `<defs>
  <marker id="gsc-arr-stag" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
    <path d="M0,0 L7,3 L0,6 Z" fill="${c.staging}"/>
  </marker>
  <marker id="gsc-arr-prod" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
    <path d="M0,0 L7,3 L0,6 Z" fill="${c.prod}"/>
  </marker>
</defs>`;

        let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="visible" xmlns="http://www.w3.org/2000/svg">
${defs}`;

        // ── MAIN ──
        svg += GitStrategyComparator._line(90, mainY, 548, mainY, c.main, false, 3);
        svg += GitStrategyComparator._branchLabel(8, mainY - 7, 'main', c.main);
        [110, 188, 268, 348, 428, 505].forEach(x =>
            svg += GitStrategyComparator._circle(x, mainY, 5, '#fff', c.main, ''));

        // ── FEATURE (above main, short branch) ──
        svg += GitStrategyComparator._line(110, mainY, 116, featY, c.feature, false, 2);
        svg += GitStrategyComparator._line(116, featY, 258, featY, c.feature, false, 2);
        svg += GitStrategyComparator._circle(188, featY, 4, '#fff', c.feature, '');
        svg += GitStrategyComparator._line(258, featY, 268, mainY, c.feature, false, 2);
        svg += GitStrategyComparator._branchLabel(118, featY - 4, 'feature/x', c.feature);

        // ── STAGING ──
        svg += GitStrategyComparator._line(90, stagY, 548, stagY, c.staging, false, 2.5);
        svg += GitStrategyComparator._branchLabel(8, stagY - 7, 'staging', c.staging);
        [148, 228, 308, 388, 468].forEach(x =>
            svg += GitStrategyComparator._circle(x, stagY, 4, '#fff', c.staging, ''));

        // ── PRODUCTION ──
        svg += GitStrategyComparator._line(90, prodY, 548, prodY, c.prod, false, 2.5);
        svg += GitStrategyComparator._branchLabel(8, prodY - 7, 'production', c.prod);
        [228, 388].forEach(x =>
            svg += GitStrategyComparator._circle(x, prodY, 4, '#fff', c.prod, ''));

        // ── Deploy arrows: main → staging ──
        [110, 268, 428].forEach(mx => {
            const tx = mx + 38;
            svg += `<line x1="${mx}" y1="${mainY + 5}" x2="${tx}" y2="${stagY - 5}" stroke="${c.staging}" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#gsc-arr-stag)"/>`;
        });

        // ── Deploy arrows: staging → production ──
        [148, 308].forEach(sx => {
            const tx = sx + 80;
            svg += `<line x1="${sx}" y1="${stagY + 5}" x2="${tx}" y2="${prodY - 5}" stroke="${c.prod}" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#gsc-arr-prod)"/>`;
        });

        svg += '</svg>';
        return svg;
    }
}
window.GitStrategyComparator = GitStrategyComparator;
