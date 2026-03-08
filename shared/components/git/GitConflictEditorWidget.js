/**
 * GitConflictEditorWidget — éditeur interactif de résolution de conflits Git à 3 voies.
 *
 * Présente des scénarios de conflits réels avec une interface permettant
 * de choisir quelle version conserver pour chaque section conflictuelle.
 */
class GitConflictEditorWidget {
    static _stylesInjected = false;

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

    static ensureStyles() {
        if (GitConflictEditorWidget._stylesInjected) return;
        GitConflictEditorWidget._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.gcew-root {
    font-family: var(--font);
    color: var(--text);
}
.gcew-top-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
}
.gcew-top-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
}
.gcew-select {
    font-family: var(--font);
    font-size: 0.82rem;
    padding: 0.35rem 0.6rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--text);
    cursor: pointer;
}
.gcew-filename {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--muted);
    margin-left: auto;
}

/* 3-column view */
.gcew-columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
}
@media (max-width: 700px) {
    .gcew-columns { grid-template-columns: 1fr; }
}
.gcew-col {
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.gcew-col-header {
    padding: 0.4rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.gcew-col.ours .gcew-col-header   { background: #dbeafe; color: #1e40af; border-bottom: 1.5px solid #93c5fd; }
.gcew-col.base .gcew-col-header   { background: #f3f4f6; color: #6b7280; border-bottom: 1.5px solid var(--border); }
.gcew-col.theirs .gcew-col-header { background: #d1fae5; color: #065f46; border-bottom: 1.5px solid #6ee7b7; }

.gcew-col-body {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    padding: 0.5rem 0.6rem;
    flex: 1;
    background: var(--bg);
    overflow-x: auto;
    white-space: pre;
}

/* Conflict blocks */
.gcew-conflict-block {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1rem;
}
.gcew-conflict-header {
    background: #fef3c7;
    border-bottom: 1px solid #fcd34d;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: #92400e;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.gcew-conflict-header.resolved {
    background: #d1fae5;
    border-bottom-color: #6ee7b7;
    color: #065f46;
}
.gcew-conflict-id {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 400;
    color: inherit;
    opacity: 0.7;
}
.gcew-raw-view {
    background: #1e293b;
    font-family: var(--font-mono);
    font-size: 0.73rem;
    line-height: 1.55;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
}
.gcew-raw-line { display: flex; gap: 0.5rem; }
.gcew-raw-ln   { color: #475569; min-width: 1.5rem; text-align: right; user-select: none; flex-shrink: 0; }
.gcew-raw-text { color: #94a3b8; white-space: pre; }
.gcew-raw-text.marker-ours    { color: #60a5fa; font-weight: 700; }
.gcew-raw-text.marker-sep     { color: #9ca3af; }
.gcew-raw-text.marker-theirs  { color: #4ade80; font-weight: 700; }
.gcew-raw-text.ours-line      { color: #bfdbfe; background: #1e3a5f40; }
.gcew-raw-text.theirs-line    { color: #bbf7d0; background: #06402540; }

.gcew-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: var(--card);
    flex-wrap: wrap;
    align-items: center;
}
.gcew-btn-action {
    font-family: var(--font);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.35rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    transition: all 0.18s;
}
.gcew-btn-action:hover { border-color: var(--primary); color: var(--primary); background: #eef2ff; }
.gcew-btn-action.active-ours   { border-color: #3b82f6; background: #dbeafe; color: #1e40af; }
.gcew-btn-action.active-theirs { border-color: #10b981; background: #d1fae5; color: #065f46; }
.gcew-btn-action.active-both   { border-color: #f59e0b; background: #fef3c7; color: #92400e; }

/* Result area */
.gcew-result-section {
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 1rem;
}
.gcew-result-header {
    background: var(--card);
    border-bottom: 1px solid var(--border);
    padding: 0.45rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.gcew-result-body {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1.6;
    padding: 0.6rem 0.75rem;
    background: var(--bg);
    white-space: pre;
    overflow-x: auto;
    min-height: 3rem;
}
.gcew-result-chunk {
    display: block;
    padding: 0.1rem 0.25rem;
    border-radius: 2px;
    transition: background 0.3s;
}
.gcew-result-chunk.pending   { color: #9ca3af; font-style: italic; }
.gcew-result-chunk.resolved  { background: #d1fae520; color: var(--text); }
.gcew-result-chunk.context   { color: var(--muted); }
.gcew-result-chunk.flash     { animation: gcewFlash 0.5s ease-out; }

@keyframes gcewFlash {
    0%   { background: #bbf7d060; }
    100% { background: #d1fae520; }
}

/* Validate button + feedback */
.gcew-validate-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}
.gcew-btn-validate {
    font-family: var(--font);
    font-size: 0.85rem;
    font-weight: 700;
    padding: 0.55rem 1.2rem;
    border-radius: var(--radius-sm);
    border: 2px solid var(--primary);
    background: var(--primary);
    color: #fff;
    cursor: pointer;
    transition: all 0.18s;
}
.gcew-btn-validate:hover { background: #4338ca; border-color: #4338ca; }
.gcew-feedback {
    font-size: 0.82rem;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-sm);
    flex: 1;
}
.gcew-feedback.ok  { background: #d1fae5; color: #065f46; }
.gcew-feedback.bad { background: #fef3c7; color: #92400e; }
        `;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        GitConflictEditorWidget.ensureStyles();

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
