class CODEOWNERSSimulatorWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (CODEOWNERSSimulatorWidget._stylesInjected) return;
        CODEOWNERSSimulatorWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
        .codeow-widget { display: flex; flex-direction: column; gap: 1rem; font-family: var(--font-sans, sans-serif); }
        .codeow-main { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 680px) { .codeow-main { grid-template-columns: 1fr; } }
        .codeow-editor { display: flex; flex-direction: column; }
        .codeow-file-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.75rem; background: #2a2a3e; border: 1px solid #3f3f5c; border-bottom: none; border-radius: 6px 6px 0 0; font-family: monospace; font-size: 0.78rem; color: #a6adc8; }
        .codeow-textarea { width: 100%; min-height: 200px; padding: 0.75rem; font-family: monospace; font-size: 0.78rem; border: 1px solid #3f3f5c; border-radius: 0 0 6px 6px; background: #1e1e2e; color: #cdd6f4; resize: vertical; line-height: 1.7; outline: none; box-sizing: border-box; tab-size: 4; }
        .codeow-textarea:focus { border-color: var(--primary, #6366f1); }
        .codeow-tester { display: flex; flex-direction: column; gap: 0.75rem; }
        .codeow-tester h4 { margin: 0; font-size: 0.9rem; color: var(--heading, #1e293b); }
        .codeow-input-row { display: flex; align-items: stretch; border: 1.5px solid var(--border, #e2e8f0); border-radius: 6px; overflow: hidden; background: var(--bg, #fff); transition: border-color 0.15s; }
        .codeow-input-row:focus-within { border-color: var(--primary, #6366f1); }
        .codeow-slash { display: flex; align-items: center; padding: 0 0.5rem 0 0.75rem; color: var(--muted, #94a3b8); font-family: monospace; background: var(--bg-alt, #f8fafc); border-right: 1px solid var(--border, #e2e8f0); font-size: 0.9rem; }
        .codeow-path-input { flex: 1; border: none; padding: 0.5rem 0.75rem; font-family: monospace; font-size: 0.83rem; outline: none; background: transparent; color: var(--text, #1e293b); }
        .codeow-result { min-height: 90px; }
        .codeow-empty { color: var(--muted, #94a3b8); font-size: 0.83rem; padding: 0.5rem 0; }
        .codeow-no-match { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 0.83rem; }
        .codeow-match { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; }
        .codeow-match-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.83rem; }
        .codeow-reviewers { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.83rem; color: #166534; }
        .codeow-owner-badge { background: var(--primary, #6366f1); color: white; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.73rem; font-family: monospace; white-space: nowrap; }
        .codeow-all-matches { margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid #86efac; display: flex; flex-direction: column; gap: 0.2rem; }
        .codeow-all-matches small { color: #4b5563; font-size: 0.75rem; }
        .codeow-match-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0.4rem; border-radius: 4px; opacity: 0.55; font-size: 0.78rem; }
        .codeow-match-row.winner { opacity: 1; background: rgba(34,197,94,0.12); font-weight: 600; }
        .codeow-match-owners { color: #4b5563; font-family: monospace; flex: 1; }
        .codeow-winner-badge { color: #15803d; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
        .codeow-examples { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; font-size: 0.78rem; padding-top: 0.25rem; }
        .codeow-examples-label { color: var(--muted, #94a3b8); }
        .codeow-example-btn { padding: 0.2rem 0.5rem; border: 1px solid var(--border, #e2e8f0); border-radius: 4px; background: var(--bg, #fff); cursor: pointer; font-family: monospace; font-size: 0.73rem; color: var(--text, #334155); transition: all 0.15s; }
        .codeow-example-btn:hover { background: var(--primary, #6366f1); color: white; border-color: var(--primary, #6366f1); }
        `;
        document.head.appendChild(s);
    }

    static parseRules(text) {
        return text.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'))
            .map(l => {
                const parts = l.split(/\s+/);
                return { pattern: parts[0], owners: parts.slice(1) };
            });
    }

    static matchesPattern(pattern, filePath) {
        const fp = filePath.replace(/^\//, '');
        // Directory pattern (ends with /)
        if (pattern.endsWith('/')) {
            const dir = pattern.replace(/^\//, '');
            return fp.startsWith(dir);
        }
        const anchored = pattern.startsWith('/');
        const p = pattern.replace(/^\//, '');
        // Convert glob to regex
        const regexStr = p
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '\x00')
            .replace(/\*/g, '[^/]*')
            .replace(/\x00/g, '.*');
        const re = anchored
            ? new RegExp(`^${regexStr}$`)
            : new RegExp(`(^|/)${regexStr}$`);
        return re.test(fp);
    }

    static findOwners(rules, filePath) {
        const allMatches = [];
        let matched = null;
        for (const rule of rules) {
            if (CODEOWNERSSimulatorWidget.matchesPattern(rule.pattern, filePath)) {
                allMatches.push(rule);
                matched = rule;
            }
        }
        return { matched, allMatches };
    }

    static renderResult(matched, allMatches, filePath) {
        if (!matched) {
            return `<div class="codeow-no-match">
                <span style="font-size:1.1rem">❌</span>
                <div><strong>Aucune règle</strong> ne correspond à <code>${filePath}</code>.<br>
                <span style="color:#6b7280;font-size:0.8rem">Ce fichier n'a pas de reviewer défini (ni de règle globale <code>*</code>).</span></div>
            </div>`;
        }
        const ownerBadges = matched.owners.length
            ? matched.owners.map(o => `<span class="codeow-owner-badge">${o}</span>`).join('')
            : `<span style="color:#9ca3af;font-size:0.8rem">aucun owner défini</span>`;
        let allMatchesHtml = '';
        if (allMatches.length > 1) {
            allMatchesHtml = `<div class="codeow-all-matches">
                <small>Toutes les règles correspondantes (la <strong>dernière</strong> l'emporte) :</small>
                ${allMatches.map(r => `<div class="codeow-match-row ${r === matched ? 'winner' : ''}">
                    <code style="white-space:nowrap">${r.pattern}</code>
                    <span class="codeow-match-owners">${r.owners.join(' ') || '—'}</span>
                    ${r === matched ? '<span class="codeow-winner-badge">✓ gagnante</span>' : ''}
                </div>`).join('')}
            </div>`;
        }
        return `<div class="codeow-match">
            <div class="codeow-match-header">
                <span style="font-size:1.1rem">✅</span>
                <div>Règle correspondante : <code>${matched.pattern}</code></div>
            </div>
            <div class="codeow-reviewers">👥 Reviewers requis : ${ownerBadges}</div>
            ${allMatchesHtml}
        </div>`;
    }

    static mount(container, config = {}) {
        CODEOWNERSSimulatorWidget.ensureStyles();

        const DEFAULT = `# Propriétaire global par défaut
*                   @alice

# L'équipe backend est responsable de l'API
src/api/            @monorg/backend-team

# Bob gère la CI/CD
.github/workflows/  @bob

# L'équipe sécurité supervise le module auth
src/auth/           @monorg/security-team @alice

# DevOps pour les dépendances
package-lock.json   @monorg/devops`;

        const EXAMPLES = [
            'src/api/users.py',
            'src/auth/login.js',
            '.github/workflows/ci.yml',
            'package-lock.json',
            'README.md',
            'src/utils/helpers.py',
        ];

        container.innerHTML = `<div class="codeow-widget">
            <div class="codeow-main">
                <div class="codeow-editor">
                    <div class="codeow-file-header">📄 .github/CODEOWNERS</div>
                    <textarea class="codeow-textarea" spellcheck="false">${DEFAULT}</textarea>
                </div>
                <div class="codeow-tester">
                    <h4>🔍 Tester un chemin de fichier</h4>
                    <div class="codeow-input-row">
                        <span class="codeow-slash">/</span>
                        <input type="text" class="codeow-path-input" placeholder="src/api/users.py" value="src/api/users.py">
                    </div>
                    <div class="codeow-result"><p class="codeow-empty">Entrez un chemin pour voir le résultat.</p></div>
                </div>
            </div>
            <div class="codeow-examples">
                <span class="codeow-examples-label">Essayer :</span>
                ${EXAMPLES.map(p => `<button class="codeow-example-btn" data-path="${p}">${p}</button>`).join('')}
            </div>
        </div>`;

        const textarea = container.querySelector('.codeow-textarea');
        const input = container.querySelector('.codeow-path-input');
        const result = container.querySelector('.codeow-result');

        const update = () => {
            const rules = CODEOWNERSSimulatorWidget.parseRules(textarea.value);
            const fp = input.value.trim();
            if (!fp) { result.innerHTML = '<p class="codeow-empty">Entrez un chemin pour voir le résultat.</p>'; return; }
            const { matched, allMatches } = CODEOWNERSSimulatorWidget.findOwners(rules, fp);
            result.innerHTML = CODEOWNERSSimulatorWidget.renderResult(matched, allMatches, fp);
        };

        textarea.addEventListener('input', update);
        input.addEventListener('input', update);
        container.querySelectorAll('.codeow-example-btn').forEach(btn => {
            btn.addEventListener('click', () => { input.value = btn.dataset.path; update(); });
        });

        update();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.CODEOWNERSSimulatorWidget = CODEOWNERSSimulatorWidget;
