/**
 * GitConflictEditorWidget — éditeur interactif de résolution de conflits Git à 3 voies.
 *
 * Présente des scénarios de conflits réels avec une interface permettant
 * de choisir quelle version conserver pour chaque section conflictuelle.
 */
class GitConflictEditorWidget {
    static SCENARIOS = [
        {
            key: 'login-py',
            label: 'login.py — paramètres de connexion',
            filename: 'login.py',
            conflicts: [
                {
                    id: 'func-sig',
                    context_before: '',
                    ours: 'def login(username, password):\n    user = db.find_user(username)\n    return user.check_password(password)',
                    base: 'def login(user, password):\n    return db.authenticate(user, password)',
                    theirs: 'def login(email, password):\n    user = db.find_user_by_email(email)\n    return user.check_password(password)',
                    context_after: ''
                }
            ],
            surrounding: 'import db\n\n<<<CONFLICT_0>>>\n\ndef logout(user):\n    db.invalidate_session(user)\n    return True'
        },
        {
            key: 'rebase-utils',
            label: 'utils.py — conflit lors d\'un rebase',
            filename: 'utils.py',
            context: 'rebase',
            contextNote: '⚡ Contexte rebase — HEAD = commit de main, "theirs" = votre commit rejoué. Attention : dans un rebase, la terminologie est inversée par rapport à un merge !',
            conflicts: [
                {
                    id: 'format-date',
                    context_before: '',
                    ours: 'def format_date(dt):\n    return dt.strftime("%Y-%m-%d")',
                    base: 'def format_date(d):\n    return str(d)',
                    theirs: 'def format_date(dt, locale="fr"):\n    return dt.strftime("%d/%m/%Y") if locale == "fr" else dt.strftime("%Y-%m-%d")',
                    context_after: ''
                },
                {
                    id: 'validate',
                    context_before: '',
                    ours: 'def validate(data):\n    return bool(data and data.get("id"))',
                    base: 'def validate(data):\n    return data is not None',
                    theirs: 'def validate(data, strict=True):\n    if strict:\n        return bool(data and data.get("id") and data.get("type"))\n    return bool(data)',
                    context_after: ''
                }
            ],
            surrounding: 'import datetime\n\n<<<CONFLICT_0>>>\n\n<<<CONFLICT_1>>>\n\ndef sanitize(s):\n    return s.strip().lower()'
        },
        {
            key: 'config-json',
            label: 'config.json — paramètres serveur',
            filename: 'config.json',
            conflicts: [
                {
                    id: 'port',
                    context_before: '',
                    ours: '  "port": 8080',
                    base: '  "port": 3000',
                    theirs: '  "port": 4000,\n  "debug": true',
                    context_after: ''
                },
                {
                    id: 'host',
                    context_before: '',
                    ours: '  "host": "0.0.0.0",\n  "timeout": 60',
                    base: '  "host": "localhost"',
                    theirs: '  "host": "0.0.0.0",\n  "timeout": 30',
                    context_after: ''
                }
            ],
            surrounding: '{\n<<<CONFLICT_0>>>,\n<<<CONFLICT_1>>>,\n  "db": "mongodb://localhost/app"\n}'
        }
    ];


    static mount(container, config = {}) {
        const defaultKey = config.defaultScenario;
        let scenarioIndex = defaultKey
            ? Math.max(0, GitConflictEditorWidget.SCENARIOS.findIndex(s => s.key === defaultKey))
            : 0;
        // resolutions: map from conflict index -> 'ours' | 'theirs' | 'both' | null
        let resolutions = {};

        const esc = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const getScenario = () => GitConflictEditorWidget.SCENARIOS[scenarioIndex];

        const buildResultText = (sc) => {
            let result = sc.surrounding;
            sc.conflicts.forEach((conf, idx) => {
                const res = resolutions[idx];
                let replacement;
                if (!res) {
                    replacement = `<<<<<<< HEAD\n${conf.ours}\n=======\n${conf.theirs}\n>>>>>>> feature/branch`;
                } else if (res === 'ours') {
                    replacement = conf.ours;
                } else if (res === 'theirs') {
                    replacement = conf.theirs;
                } else {
                    replacement = conf.ours + '\n' + conf.theirs;
                }
                result = result.replace(`<<<CONFLICT_${idx}>>>`, replacement);
            });
            return result;
        };

        const renderRawConflict = (conf, idx) => {
            const res = resolutions[idx];
            const isResolved = res !== undefined && res !== null;
            const lines = [];
            const branchName = 'feature/auth';

            if (!isResolved) {
                lines.push({ text: `<<<<<<< HEAD`, cls: 'marker-ours' });
                conf.ours.split('\n').forEach(l => lines.push({ text: l, cls: 'ours-line' }));
                lines.push({ text: `=======`, cls: 'marker-sep' });
                conf.theirs.split('\n').forEach(l => lines.push({ text: l, cls: 'theirs-line' }));
                lines.push({ text: `>>>>>>> ${branchName}`, cls: 'marker-theirs' });
            } else {
                const chosen = res === 'ours' ? conf.ours : res === 'theirs' ? conf.theirs : conf.ours + '\n' + conf.theirs;
                chosen.split('\n').forEach(l => lines.push({ text: l, cls: '' }));
            }

            const linesHtml = lines.map((l, i) =>
                `<div class="gcew-raw-line"><span class="gcew-raw-ln">${i + 1}</span><span class="gcew-raw-text ${l.cls}">${esc(l.text)}</span></div>`
            ).join('');

            const activeOurs   = res === 'ours'   ? 'active-ours'   : '';
            const activeTheirs = res === 'theirs' ? 'active-theirs' : '';
            const activeBoth   = res === 'both'   ? 'active-both'   : '';

            return `
<div class="gcew-conflict-block" data-conflict="${idx}">
    <div class="gcew-conflict-header${isResolved ? ' resolved' : ''}">
        ${isResolved ? '✓ Conflit résolu' : '⚠ Conflit à résoudre'}
        <span class="gcew-conflict-id">section ${idx + 1}/${getScenario().conflicts.length}</span>
    </div>
    <div class="gcew-raw-view">${linesHtml}</div>
    <div class="gcew-actions">
        <button class="gcew-btn-action ${activeOurs}"  data-conflict="${idx}" data-choice="ours">Garder le nôtre</button>
        <button class="gcew-btn-action ${activeTheirs}" data-conflict="${idx}" data-choice="theirs">Garder le leur</button>
        <button class="gcew-btn-action ${activeBoth}"  data-conflict="${idx}" data-choice="both">Garder les deux</button>
    </div>
</div>`;
        };

        const render = () => {
            const sc = getScenario();
            resolutions = {};

            const scenarioOptions = GitConflictEditorWidget.SCENARIOS.map((s, i) =>
                `<option value="${i}" ${i === scenarioIndex ? 'selected' : ''}>${s.label}</option>`
            ).join('');

            const oursHtml   = sc.conflicts.map(c => esc(c.ours)).join('\n---\n');
            const baseHtml   = sc.conflicts.map(c => esc(c.base)).join('\n---\n');
            const theirsHtml = sc.conflicts.map(c => esc(c.theirs)).join('\n---\n');

            container.innerHTML = `
<div class="gcew-root">
    <div class="gcew-top-bar">
        <span class="gcew-top-label">Scénario :</span>
        <select class="gcew-select" id="gcew-scenario">${scenarioOptions}</select>
        <span class="gcew-filename">${sc.filename}</span>
    </div>
    ${sc.contextNote ? `<div style="background:#fefce8;border:1.5px solid #fbbf24;border-radius:var(--radius-sm);padding:0.55rem 0.85rem;margin-bottom:0.75rem;font-size:0.8rem;color:#92400e;line-height:1.4">${sc.contextNote}</div>` : ''}

    <div class="gcew-columns">
        <div class="gcew-col ours">
            <div class="gcew-col-header">Notre version (HEAD)</div>
            <div class="gcew-col-body">${oursHtml}</div>
        </div>
        <div class="gcew-col base">
            <div class="gcew-col-header">Base commune</div>
            <div class="gcew-col-body">${baseHtml}</div>
        </div>
        <div class="gcew-col theirs">
            <div class="gcew-col-header">Leur version (incoming)</div>
            <div class="gcew-col-body">${theirsHtml}</div>
        </div>
    </div>

    <div id="gcew-conflicts">
        ${sc.conflicts.map((c, i) => renderRawConflict(c, i)).join('')}
    </div>

    <div class="gcew-result-section">
        <div class="gcew-result-header">Résultat (fichier résolu)</div>
        <div class="gcew-result-body" id="gcew-result">${esc(buildResultText(sc))}</div>
    </div>

    <div class="gcew-validate-row">
        <button class="gcew-btn-validate" id="gcew-validate">Valider la résolution</button>
        <div class="gcew-feedback" id="gcew-feedback" style="display:none"></div>
    </div>
</div>`;

            bindEvents();
        };

        const rerenderConflicts = () => {
            const sc = getScenario();
            const conflictsEl = container.querySelector('#gcew-conflicts');
            if (conflictsEl) {
                conflictsEl.innerHTML = sc.conflicts.map((c, i) => renderRawConflict(c, i)).join('');
                bindConflictButtons();
            }
            const resultEl = container.querySelector('#gcew-result');
            if (resultEl) {
                resultEl.textContent = buildResultText(sc);
                resultEl.classList.add('flash');
                setTimeout(() => resultEl.classList.remove('flash'), 500);
            }
        };

        const bindConflictButtons = () => {
            container.querySelectorAll('.gcew-btn-action[data-conflict]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.conflict, 10);
                    const choice = btn.dataset.choice;
                    resolutions[idx] = choice;
                    rerenderConflicts();
                });
            });
        };

        const bindEvents = () => {
            container.querySelector('#gcew-scenario')?.addEventListener('change', (e) => {
                scenarioIndex = parseInt(e.target.value, 10);
                render();
            });

            bindConflictButtons();

            container.querySelector('#gcew-validate')?.addEventListener('click', () => {
                const sc = getScenario();
                const totalConflicts = sc.conflicts.length;
                const resolvedCount = sc.conflicts.filter((_, i) => resolutions[i] !== undefined).length;
                const feedbackEl = container.querySelector('#gcew-feedback');

                feedbackEl.style.display = '';
                if (resolvedCount < totalConflicts) {
                    const remaining = totalConflicts - resolvedCount;
                    feedbackEl.className = 'gcew-feedback bad';
                    feedbackEl.textContent = `Il reste ${remaining} section(s) en conflit à résoudre.`;
                } else {
                    feedbackEl.className = 'gcew-feedback ok';
                    feedbackEl.textContent = `Tous les conflits sont résolus. Exécutez : git add ${sc.filename} puis git commit`;
                }
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitConflictEditorWidget = GitConflictEditorWidget;
