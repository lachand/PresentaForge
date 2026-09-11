class CODEOWNERSSimulatorWidget {
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
