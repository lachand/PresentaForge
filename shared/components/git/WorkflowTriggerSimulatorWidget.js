class WorkflowTriggerSimulatorWidget {
    static ensureStyles() {
        if (document.getElementById('wts-styles')) return;
        const s = document.createElement('style');
        s.id = 'wts-styles';
        s.textContent = `
.wts { font-family: var(--font); }
.wts-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 1rem; }
@media (max-width: 640px) { .wts-grid { grid-template-columns: 1fr; } }
.wts-panel { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
.wts-panel-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 0.75rem; }
.wts-event-btns { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.85rem; }
.wts-event-btn { padding: 0.28rem 0.65rem; border: 1.5px solid var(--border); border-radius: 20px; background: transparent; cursor: pointer; font-size: 0.76rem; font-family: var(--font); color: var(--text); transition: all 0.15s; white-space: nowrap; }
.wts-event-btn:hover { border-color: var(--primary); color: var(--primary); }
.wts-event-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.wts-field { margin-bottom: 0.6rem; }
.wts-field label { display: block; font-size: 0.73rem; color: var(--muted); margin-bottom: 0.2rem; }
.wts-field input { width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-family: monospace; font-size: 0.82rem; box-sizing: border-box; outline: none; }
.wts-field input:focus { border-color: var(--primary); }
.wts-note { font-size: 0.75rem; color: var(--muted); font-style: italic; margin: 0; }
.wts-wf { border: 1.5px solid var(--border); border-radius: 8px; padding: 0.6rem 0.8rem; margin-bottom: 0.5rem; transition: all 0.2s; }
.wts-wf:last-child { margin-bottom: 0; }
.wts-wf.triggered { border-color: #22c55e; background: color-mix(in srgb, #22c55e 7%, var(--card)); }
.wts-wf.blocked { opacity: 0.45; }
.wts-wf-top { display: flex; align-items: center; gap: 0.5rem; }
.wts-wf-name { font-family: monospace; font-size: 0.83rem; font-weight: 600; color: var(--heading); flex: 1; }
.wts-badge { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 20px; }
.wts-badge.yes { background: #22c55e; color: #fff; }
.wts-badge.no { background: var(--hover); color: var(--muted); border: 1px solid var(--border); }
.wts-wf-on { margin-top: 0.35rem; font-family: monospace; font-size: 0.71rem; color: var(--muted); line-height: 1.7; }
.wts-wf-match { color: #22c55e; font-weight: 700; }
.wts-wf-reason { font-size: 0.71rem; color: #22c55e; margin-top: 0.2rem; }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        WorkflowTriggerSimulatorWidget.ensureStyles();

        const WORKFLOWS = [
            { name: 'ci.yml',      on: { push: { branches: ['main', 'develop'] }, pull_request: { branches: ['main'] } } },
            { name: 'deploy.yml',  on: { push: { branches: ['main'] }, workflow_dispatch: {} } },
            { name: 'nightly.yml', on: { schedule: [{ cron: '0 2 * * *' }] } },
            { name: 'release.yml', on: { push: { tags: ['v*'] }, workflow_call: {} } }
        ];

        const EVENTS = [
            { id: 'push_branch',      label: '📤 push (branche)' },
            { id: 'push_tag',         label: '🏷️ push (tag)' },
            { id: 'pull_request',     label: '🔀 pull_request' },
            { id: 'schedule',         label: '⏰ schedule' },
            { id: 'workflow_dispatch',label: '▶️ dispatch' },
            { id: 'workflow_call',    label: '🔗 call' }
        ];

        let state = { event: 'push_branch', branch: 'feature/my-feature', tag: 'v1.0.0' };

        function globMatch(pattern, value) {
            const re = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
            return re.test(value);
        }

        function evaluate(wf) {
            const on = wf.on;
            const ev = state.event;
            if (ev === 'push_branch') {
                if (!on.push || !on.push.branches) return { ok: false, match: null };
                const hit = on.push.branches.find(b => globMatch(b, state.branch));
                return hit ? { ok: true, match: `push.branches: "${hit}"` } : { ok: false, match: null };
            }
            if (ev === 'push_tag') {
                if (!on.push || !on.push.tags) return { ok: false, match: null };
                const hit = on.push.tags.find(t => globMatch(t, state.tag));
                return hit ? { ok: true, match: `push.tags: "${hit}"` } : { ok: false, match: null };
            }
            if (ev === 'pull_request') {
                if (!on.pull_request) return { ok: false, match: null };
                const branches = on.pull_request.branches;
                if (!branches) return { ok: true, match: 'pull_request (toutes branches)' };
                const hit = branches.find(b => globMatch(b, state.branch));
                return hit ? { ok: true, match: `pull_request.branches: "${hit}"` } : { ok: false, match: null };
            }
            if (ev === 'schedule')         return on.schedule         ? { ok: true, match: `schedule: '${on.schedule[0].cron}'` }       : { ok: false, match: null };
            if (ev === 'workflow_dispatch') return on.workflow_dispatch !== undefined ? { ok: true, match: 'workflow_dispatch' }         : { ok: false, match: null };
            if (ev === 'workflow_call')     return on.workflow_call    !== undefined ? { ok: true, match: 'workflow_call' }              : { ok: false, match: null };
            return { ok: false, match: null };
        }

        function formatOn(wf, match) {
            return Object.entries(wf.on).map(([k, v]) => {
                let line = '';
                if (k === 'push') {
                    const parts = [];
                    if (v.branches) parts.push(`branches: [${v.branches.map(b => `"${b}"`).join(', ')}]`);
                    if (v.tags)     parts.push(`tags: [${v.tags.map(t => `"${t}"`).join(', ')}]`);
                    line = `push → ${parts.join(', ')}`;
                } else if (k === 'pull_request') {
                    line = v.branches ? `pull_request → branches: [${v.branches.map(b => `"${b}"`).join(', ')}]` : 'pull_request';
                } else if (k === 'schedule') {
                    line = `schedule → cron: '${v[0].cron}'`;
                } else {
                    line = k;
                }
                const isMatch = match && line.toLowerCase().includes(match.split(':')[0].toLowerCase());
                return isMatch ? `<span class="wts-wf-match">${line}</span>` : `<span>${line}</span>`;
            }).join('<br>');
        }

        function renderDetails(root) {
            const det = root.querySelector('.wts-details');
            const ev = state.event;
            if (ev === 'push_branch' || ev === 'pull_request') {
                det.innerHTML = `<div class="wts-field"><label>Branche</label><input type="text" value="${state.branch}" placeholder="main"/></div>`;
                det.querySelector('input').addEventListener('input', e => { state.branch = e.target.value; renderWorkflows(root); });
            } else if (ev === 'push_tag') {
                det.innerHTML = `<div class="wts-field"><label>Tag</label><input type="text" value="${state.tag}" placeholder="v1.0.0"/></div>`;
                det.querySelector('input').addEventListener('input', e => { state.tag = e.target.value; renderWorkflows(root); });
            } else {
                det.innerHTML = `<p class="wts-note">Aucun paramètre requis pour cet événement.</p>`;
            }
        }

        function renderWorkflows(root) {
            const res = root.querySelector('.wts-results');
            res.innerHTML = WORKFLOWS.map(wf => {
                const { ok, match } = evaluate(wf);
                return `<div class="wts-wf ${ok ? 'triggered' : 'blocked'}">
                    <div class="wts-wf-top">
                        <span class="wts-wf-name">${wf.name}</span>
                        <span class="wts-badge ${ok ? 'yes' : 'no'}">${ok ? '✓ déclenché' : '✗ ignoré'}</span>
                    </div>
                    <div class="wts-wf-on">${formatOn(wf, match)}</div>
                    ${ok && match ? `<div class="wts-wf-reason">→ correspondance : ${match}</div>` : ''}
                </div>`;
            }).join('');
        }

        container.innerHTML = `<div class="wts">
            <div class="wts-grid">
                <div class="wts-panel">
                    <p class="wts-panel-title">Événement git</p>
                    <div class="wts-event-btns">${EVENTS.map(e =>
                        `<button class="wts-event-btn${e.id === state.event ? ' active' : ''}" data-ev="${e.id}">${e.label}</button>`
                    ).join('')}</div>
                    <div class="wts-details"></div>
                </div>
                <div class="wts-panel">
                    <p class="wts-panel-title">Workflows déclenchés</p>
                    <div class="wts-results"></div>
                </div>
            </div>
        </div>`;

        const root = container.querySelector('.wts');
        root.querySelectorAll('.wts-event-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.event = btn.dataset.ev;
                root.querySelectorAll('.wts-event-btn').forEach(b => b.classList.toggle('active', b === btn));
                renderDetails(root);
                renderWorkflows(root);
            });
        });

        renderDetails(root);
        renderWorkflows(root);
        return { destroy() {} };
    }
}
window.WorkflowTriggerSimulatorWidget = WorkflowTriggerSimulatorWidget;
