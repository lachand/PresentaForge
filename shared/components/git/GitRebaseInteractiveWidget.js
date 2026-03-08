/**
 * GitRebaseInteractiveWidget — simulation du rebase interactif (git rebase -i).
 * L'étudiant choisit les actions (pick/squash/drop/reword) et voit le résultat.
 */
class GitRebaseInteractiveWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (GitRebaseInteractiveWidget._stylesInjected) return;
        GitRebaseInteractiveWidget._stylesInjected = true;
        const s = document.createElement('style');
        s.textContent = `
.grbi-root { font-family: var(--font); }
.grbi-info {
    background: #fffbeb; border: 1.5px solid #fcd34d;
    border-radius: var(--radius); padding: 0.65rem 0.85rem;
    font-size: 0.78rem; color: #92400e; margin-bottom: 0.75rem;
}
.grbi-info code { background: #fef3c7; padding: 0.1rem 0.3rem; border-radius: 3px; }
.grbi-list { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.75rem; }
.grbi-row {
    display: grid; grid-template-columns: auto 1fr auto;
    align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.65rem; border-radius: var(--radius-sm);
    border: 1.5px solid var(--border); background: var(--card);
    transition: all 0.2s;
}
.grbi-row.action-drop    { opacity: 0.4; border-style: dashed; }
.grbi-row.action-squash  { border-color: #a5b4fc; background: #eef2ff; }
.grbi-row.action-fixup   { border-color: #a5b4fc; background: #eef2ff; }
.grbi-row.action-reword  { border-color: #6ee7b7; background: #ecfdf5; }
.grbi-move { display: flex; flex-direction: column; gap: 0.1rem; }
.grbi-move button {
    background: none; border: none; cursor: pointer; padding: 0 0.2rem;
    font-size: 0.7rem; color: var(--muted); line-height: 1;
}
.grbi-move button:hover { color: var(--primary); }
.grbi-commit-info { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.grbi-hash { font-family: var(--font-mono); font-size: 0.72rem; color: var(--muted); flex-shrink: 0; }
.grbi-msg  { font-size: 0.82rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grbi-msg-input {
    font-size: 0.82rem; font-family: var(--font); border: 1px solid var(--border);
    border-radius: 3px; padding: 0.2rem 0.4rem; width: 100%; max-width: 280px;
    background: white; color: var(--text);
}
.grbi-action-select {
    font-size: 0.72rem; font-family: var(--font-mono); padding: 0.25rem 0.4rem;
    border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    background: var(--card); color: var(--text); cursor: pointer;
    min-width: 78px;
}
.grbi-controls { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.grbi-result {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;
}
@media (max-width: 640px) { .grbi-result { grid-template-columns: 1fr; } }
.grbi-result-col h4 {
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; color: var(--muted); margin-bottom: 0.4rem;
}
.grbi-commit-item {
    padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);
    font-size: 0.8rem; margin-bottom: 0.3rem; border: 1.5px solid;
    display: flex; align-items: center; gap: 0.4rem;
}
.grbi-commit-item.kept    { border-color: #10b981; background: #ecfdf5; color: #065f46; }
.grbi-commit-item.squashed { border-color: #a5b4fc; background: #eef2ff; color: #3730a3; }
.grbi-commit-item.dropped { border-color: #fca5a5; background: #fef2f2; color: #991b1b; text-decoration: line-through; opacity: 0.6; }
.grbi-legend {
    display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem;
    font-size: 0.72rem; color: var(--muted); margin-top: 0.5rem;
}
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        GitRebaseInteractiveWidget.ensureStyles();

        const ACTIONS = ['pick', 'reword', 'squash', 'fixup', 'drop'];
        const ACTION_LABELS = { pick: 'garder', reword: 'renommer', squash: 'fusionner', fixup: 'fusionner (silencieux)', drop: 'supprimer' };

        const initial = [
            { hash: 'f3a1b2', msg: 'wip: save progress', action: 'pick', newMsg: '' },
            { hash: 'e2d9c1', msg: 'fix typo in README', action: 'pick', newMsg: '' },
            { hash: 'd8f4a3', msg: 'add error handling to login', action: 'pick', newMsg: '' },
            { hash: 'c7e3b9', msg: 'wip: half-done feature', action: 'pick', newMsg: '' },
            { hash: 'b6d2a8', msg: 'implement login endpoint', action: 'pick', newMsg: '' },
            { hash: 'a5c1f7', msg: 'add user model', action: 'pick', newMsg: '' }
        ];

        let commits = initial.map(c => ({ ...c }));
        let applied = false;
        let result = null;

        const computeResult = () => {
            const out = [];
            let i = 0;
            while (i < commits.length) {
                const c = commits[i];
                if (c.action === 'drop') { i++; continue; }
                if (c.action === 'squash' || c.action === 'fixup') {
                    // squash/fixup merges with PREVIOUS kept commit
                    if (out.length > 0) {
                        const prev = out[out.length - 1];
                        if (c.action === 'squash') prev.msgs.push(c.msg);
                        prev.squashedFrom.push(c.hash);
                    }
                    i++;
                    continue;
                }
                const msg = c.action === 'reword' && c.newMsg.trim() ? c.newMsg.trim() : c.msg;
                out.push({ hash: c.hash, msg, msgs: [msg], squashedFrom: [], action: c.action });
                i++;
            }
            return out;
        };

        const render = () => {
            container.innerHTML = `
<div class="grbi-root">
  <div class="grbi-info">
    <code>git rebase -i HEAD~6</code> — Modifiez les actions ci-dessous, puis cliquez sur "Appliquer".
    <strong>Règle d'or : uniquement sur des commits locaux non encore poussés.</strong>
  </div>
  <div class="grbi-list" id="grbi-list">
    ${commits.map((c, i) => `
      <div class="grbi-row action-${c.action}" data-idx="${i}">
        <div class="grbi-move">
          <button data-move-up="${i}" title="Monter">▲</button>
          <button data-move-down="${i}" title="Descendre">▼</button>
        </div>
        <div class="grbi-commit-info">
          <span class="grbi-hash">${c.hash}</span>
          ${c.action === 'reword'
            ? `<input class="grbi-msg-input" data-reword="${i}" value="${c.newMsg || c.msg}" placeholder="${c.msg}">`
            : `<span class="grbi-msg">${c.msg}</span>`}
        </div>
        <select class="grbi-action-select" data-action-idx="${i}">
          ${ACTIONS.map(a => `<option value="${a}" ${c.action === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>`).join('')}
  </div>
  <div class="grbi-legend">
    ${Object.entries(ACTION_LABELS).map(([k, v]) => `<span><strong>${k}</strong> : ${v}</span>`).join(' · ')}
  </div>
  <div class="grbi-controls">
    <button class="btn btn-primary" id="grbi-apply">Appliquer le rebase</button>
    <button class="btn btn-secondary" id="grbi-reset">Réinitialiser</button>
  </div>
  ${applied && result ? `
  <div class="grbi-result">
    <div class="grbi-result-col">
      <h4>Avant (6 commits)</h4>
      ${initial.map(c => `<div class="grbi-commit-item kept"><span style="font-family:var(--font-mono);font-size:0.7rem">${c.hash}</span> ${c.msg}</div>`).join('')}
    </div>
    <div class="grbi-result-col">
      <h4>Après (${result.length} commit${result.length > 1 ? 's' : ''})</h4>
      ${commits.filter(c => c.action === 'drop').map(c => `<div class="grbi-commit-item dropped"><span style="font-family:var(--font-mono);font-size:0.7rem">${c.hash}</span> ${c.msg}</div>`).join('')}
      ${result.map(c => `<div class="grbi-commit-item ${c.squashedFrom.length > 0 ? 'squashed' : 'kept'}">
        <span style="font-family:var(--font-mono);font-size:0.7rem">${c.hash.substring(0,6)}</span>
        <span>${c.msg}${c.squashedFrom.length > 0 ? ` <span style="font-size:0.68rem;color:var(--muted)">(+ ${c.squashedFrom.length} squashé${c.squashedFrom.length > 1 ? 's' : ''})</span>` : ''}</span>
      </div>`).join('')}
    </div>
  </div>` : ''}
</div>`;

            // Bind select changes
            container.querySelectorAll('[data-action-idx]').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    commits[+sel.dataset.actionIdx].action = e.target.value;
                    applied = false; render();
                });
            });

            // Bind reword inputs
            container.querySelectorAll('[data-reword]').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    commits[+inp.dataset.reword].newMsg = e.target.value;
                });
            });

            // Move up/down
            container.querySelectorAll('[data-move-up]').forEach(btn => {
                const i = +btn.dataset.moveUp;
                if (i === 0) btn.disabled = true;
                btn.addEventListener('click', () => {
                    if (i <= 0) return;
                    [commits[i-1], commits[i]] = [commits[i], commits[i-1]];
                    applied = false; render();
                });
            });
            container.querySelectorAll('[data-move-down]').forEach(btn => {
                const i = +btn.dataset.moveDown;
                if (i === commits.length - 1) btn.disabled = true;
                btn.addEventListener('click', () => {
                    if (i >= commits.length - 1) return;
                    [commits[i], commits[i+1]] = [commits[i+1], commits[i]];
                    applied = false; render();
                });
            });

            container.querySelector('#grbi-apply')?.addEventListener('click', () => {
                result = computeResult();
                applied = true;
                render();
            });
            container.querySelector('#grbi-reset')?.addEventListener('click', () => {
                commits = initial.map(c => ({ ...c }));
                applied = false; result = null; render();
            });
        };

        render();
        return { destroy() { container.innerHTML = ''; } };
    }
}
window.GitRebaseInteractiveWidget = GitRebaseInteractiveWidget;
