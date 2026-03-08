class ConcurrencyPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.autoTimer = null;
        this.autoDelay = 650;
        this.mutex = null;
        this.deadlock = null;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector({
            lineIdBuilder: (block, idx) => `${block.name}-line${idx}`
        });
        this.bindTabs();
        this.bindMutexControls();
        this.bindDeadlockControls();
        this.resetMutex();
        this.resetDeadlock();
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const target = btn.dataset.tab;
                document.querySelectorAll('.tab-panel').forEach((panel) => {
                    panel.classList.toggle('active', panel.id === `panel-${target}`);
                });
            });
        });
    }

    bindMutexControls() {
        document.getElementById('mutex-step').addEventListener('click', () => this.stepMutex());
        document.getElementById('mutex-reset').addEventListener('click', () => this.resetMutex());
        document.getElementById('mutex-run').addEventListener('click', () => this.toggleMutexAuto());
        document.getElementById('mutex-lock').addEventListener('change', () => this.resetMutex());
    }

    bindDeadlockControls() {
        document.getElementById('deadlock-step').addEventListener('click', () => this.stepDeadlock());
        document.getElementById('deadlock-reset').addEventListener('click', () => this.resetDeadlock());
        document.getElementById('deadlock-run').addEventListener('click', () => this.toggleDeadlockAuto());
        document.getElementById('deadlock-order').addEventListener('change', () => this.resetDeadlock());
    }

    stopAuto() {
        if (this.autoTimer) {
            clearInterval(this.autoTimer);
            this.autoTimer = null;
        }
        const runBtns = ['mutex-run', 'deadlock-run'];
        runBtns.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = 'Lecture auto';
        });
    }

    resetMutex() {
        this.stopAuto();
        const withLock = document.getElementById('mutex-lock').checked;
        this.mutex = {
            withLock,
            counter: 0,
            lockOwner: null,
            turn: 'T1',
            done: false,
            threads: {
                T1: { phase: 0, local: null, writes: 0, target: 3 },
                T2: { phase: 0, local: null, writes: 0, target: 3 }
            },
            logs: []
        };
        this.addMutexLog(`Réinitialisation. Mode ${withLock ? 'avec mutex' : 'sans mutex'}.`);
        this.renderMutex();
    }

    phaseLabel(phase) {
        const map = ['enter', 'read', 'local+1', 'write', 'exit'];
        return map[phase] || 'done';
    }

    addMutexLog(msg) {
        this.mutex.logs.unshift(msg);
        this.mutex.logs = this.mutex.logs.slice(0, 10);
    }

    stepMutex() {
        if (this.mutex.done) return;
        const id = this.mutex.turn;
        const other = id === 'T1' ? 'T2' : 'T1';
        const t = this.mutex.threads[id];

        if (t.writes >= t.target) {
            this.mutex.turn = other;
            if (this.mutex.threads[other].writes >= this.mutex.threads[other].target) {
                this.mutex.done = true;
            }
            this.renderMutex();
            return;
        }

        if (this.mutex.withLock && t.phase === 0 && this.mutex.lockOwner && this.mutex.lockOwner !== id) {
            this.addMutexLog(`${id} bloqué: mutex détenu par ${this.mutex.lockOwner}.`);
            this.mutex.turn = other;
            this.renderMutex();
            return;
        }

        switch (t.phase) {
            case 0:
                if (this.mutex.withLock) {
                    this.mutex.lockOwner = id;
                    this.addMutexLog(`${id} acquiert le mutex.`);
                } else {
                    this.addMutexLog(`${id} entre en section critique sans protection.`);
                }
                t.phase = 1;
                break;
            case 1:
                t.local = this.mutex.counter;
                this.addMutexLog(`${id} lit counter=${this.mutex.counter}.`);
                t.phase = 2;
                break;
            case 2:
                t.local += 1;
                this.addMutexLog(`${id} calcule local=${t.local}.`);
                t.phase = 3;
                break;
            case 3:
                this.mutex.counter = t.local;
                t.writes += 1;
                this.addMutexLog(`${id} écrit counter=${this.mutex.counter}.`);
                t.phase = 4;
                break;
            case 4:
                if (this.mutex.withLock && this.mutex.lockOwner === id) {
                    this.mutex.lockOwner = null;
                    this.addMutexLog(`${id} libère le mutex.`);
                } else {
                    this.addMutexLog(`${id} sort.`);
                }
                t.local = null;
                t.phase = 0;
                break;
            default:
                break;
        }

        this.mutex.turn = other;
        if (this.mutex.threads.T1.writes >= this.mutex.threads.T1.target &&
            this.mutex.threads.T2.writes >= this.mutex.threads.T2.target) {
            this.mutex.done = true;
            this.addMutexLog(`Terminé. Résultat final counter=${this.mutex.counter}. Attendu=6.`);
            this.stopAuto();
        }
        this.renderMutex();
    }

    toggleMutexAuto() {
        const btn = document.getElementById('mutex-run');
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }
        btn.textContent = 'Pause';
        this.autoTimer = setInterval(() => {
            if (this.mutex.done) {
                this.stopAuto();
                return;
            }
            this.stepMutex();
        }, this.autoDelay);
    }

    renderMutex() {
        document.getElementById('mutex-counter').textContent = this.mutex.counter;
        document.getElementById('mutex-owner').textContent = this.mutex.lockOwner || 'libre';
        document.getElementById('mutex-expected').textContent = '6';
        document.getElementById('mutex-turn').textContent = this.mutex.turn;

        ['T1', 'T2'].forEach((id) => {
            const t = this.mutex.threads[id];
            document.getElementById(`mx-${id}-phase`).textContent = this.phaseLabel(t.phase);
            document.getElementById(`mx-${id}-local`).textContent = t.local == null ? '-' : String(t.local);
            document.getElementById(`mx-${id}-writes`).textContent = `${t.writes}/${t.target}`;
        });

        const ul = document.getElementById('mutex-log');
        ul.innerHTML = this.mutex.logs.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    }

    resetDeadlock() {
        this.stopAuto();
        const ordered = document.getElementById('deadlock-order').checked;
        const orderT1 = ['R1', 'R2'];
        const orderT2 = ordered ? ['R1', 'R2'] : ['R2', 'R1'];
        this.deadlock = {
            ordered,
            owners: { R1: null, R2: null },
            turn: 'T1',
            deadlocked: false,
            done: false,
            logs: [],
            threads: {
                T1: { step: 0, waitingFor: null, order: orderT1 },
                T2: { step: 0, waitingFor: null, order: orderT2 }
            }
        };
        this.addDeadlockLog(`Réinitialisation. ${ordered ? 'Ordre global activé (pas de deadlock attendu).' : 'Ordres opposés (deadlock possible).'}`);
        this.renderDeadlock();
    }

    addDeadlockLog(msg) {
        this.deadlock.logs.unshift(msg);
        this.deadlock.logs = this.deadlock.logs.slice(0, 12);
    }

    acquireResource(threadId, resource) {
        const holder = this.deadlock.owners[resource];
        const t = this.deadlock.threads[threadId];
        if (!holder) {
            this.deadlock.owners[resource] = threadId;
            t.waitingFor = null;
            this.addDeadlockLog(`${threadId} acquiert ${resource}.`);
            return true;
        }
        if (holder === threadId) return true;
        t.waitingFor = resource;
        this.addDeadlockLog(`${threadId} attend ${resource} (détenu par ${holder}).`);
        return false;
    }

    releaseAll(threadId) {
        ['R1', 'R2'].forEach((r) => {
            if (this.deadlock.owners[r] === threadId) this.deadlock.owners[r] = null;
        });
        this.addDeadlockLog(`${threadId} libère ses ressources.`);
    }

    checkDeadlock() {
        const t1 = this.deadlock.threads.T1;
        const t2 = this.deadlock.threads.T2;
        if (!t1.waitingFor || !t2.waitingFor) return false;
        const h1 = this.deadlock.owners[t1.waitingFor];
        const h2 = this.deadlock.owners[t2.waitingFor];
        return h1 === 'T2' && h2 === 'T1';
    }

    stepDeadlock() {
        if (this.deadlock.done || this.deadlock.deadlocked) return;
        const id = this.deadlock.turn;
        const other = id === 'T1' ? 'T2' : 'T1';
        const t = this.deadlock.threads[id];

        if (t.step === 0) {
            const ok = this.acquireResource(id, t.order[0]);
            if (ok) t.step = 1;
        } else if (t.step === 1) {
            const ok = this.acquireResource(id, t.order[1]);
            if (ok) t.step = 2;
        } else if (t.step === 2) {
            this.releaseAll(id);
            t.step = 3;
        }

        if (this.checkDeadlock()) {
            this.deadlock.deadlocked = true;
            this.addDeadlockLog('Deadlock détecté: attente circulaire T1 <-> T2.');
            this.stopAuto();
        }

        if (this.deadlock.threads.T1.step >= 3 && this.deadlock.threads.T2.step >= 3) {
            this.deadlock.done = true;
            this.addDeadlockLog('Terminé sans interblocage.');
            this.stopAuto();
        }

        this.deadlock.turn = other;
        this.renderDeadlock();
    }

    toggleDeadlockAuto() {
        const btn = document.getElementById('deadlock-run');
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }
        btn.textContent = 'Pause';
        this.autoTimer = setInterval(() => {
            if (this.deadlock.done || this.deadlock.deadlocked) {
                this.stopAuto();
                return;
            }
            this.stepDeadlock();
        }, this.autoDelay);
    }

    renderDeadlock() {
        document.getElementById('dl-r1').textContent = this.deadlock.owners.R1 || 'libre';
        document.getElementById('dl-r2').textContent = this.deadlock.owners.R2 || 'libre';
        document.getElementById('dl-turn').textContent = this.deadlock.turn;

        ['T1', 'T2'].forEach((id) => {
            const t = this.deadlock.threads[id];
            const phase = t.step === 0 ? `acq ${t.order[0]}` :
                t.step === 1 ? `acq ${t.order[1]}` :
                    t.step === 2 ? 'release' : 'done';
            document.getElementById(`dl-${id}-phase`).textContent = phase;
            document.getElementById(`dl-${id}-wait`).textContent = t.waitingFor || '-';
            document.getElementById(`dl-${id}-order`).textContent = `${t.order[0]} -> ${t.order[1]}`;
        });

        const status = document.getElementById('deadlock-status');
        if (this.deadlock.deadlocked) {
            status.className = 'status status-bad';
            status.textContent = 'Deadlock détecté';
        } else if (this.deadlock.done) {
            status.className = 'status status-ok';
            status.textContent = 'Terminé sans deadlock';
        } else {
            status.className = 'status status-pending';
            status.textContent = 'En exécution';
        }

        const ul = document.getElementById('deadlock-log');
        ul.innerHTML = this.deadlock.logs.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    }
}

if (typeof window !== 'undefined') {
    window.ConcurrencyPage = ConcurrencyPage;
}

// ── Standalone widget ──────────────────────────────────────────
class ConcurrencyWidget {
    static _stylesInjected = false;

    static ensureStyles() {
        if (ConcurrencyWidget._stylesInjected) return;
        ConcurrencyWidget._stylesInjected = true;
        const css = `
.cnw { font-family: inherit; display: flex; flex-direction: column; gap: 10px; }
.cnw-tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border, #ddd); }
.cnw-tab { font-size: 0.82rem; padding: 6px 16px; border: none; background: transparent; cursor: pointer; color: var(--muted, #888); font-weight: 600; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.cnw-tab.active { color: var(--primary, #6366f1); border-bottom-color: var(--primary, #6366f1); }
.cnw-panel { display: none; flex-direction: column; gap: 8px; }
.cnw-panel.active { display: flex; }
.cnw-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cnw-opt { display: flex; align-items: center; gap: 5px; font-size: 0.82rem; cursor: pointer; }
.cnw-btns { display: flex; gap: 6px; margin-left: auto; }
.cnw-btn { font-size: 0.82rem; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--surface, #f5f5f5); color: var(--text, #222); cursor: pointer; }
.cnw-btn.primary { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
.cnw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cnw-card { border: 1px solid var(--border, #ddd); border-radius: 8px; padding: 10px; background: var(--surface2, #f8f8f8); }
.cnw-card-title { font-size: 0.8rem; font-weight: 700; margin-bottom: 6px; color: var(--muted, #666); }
.cnw-kv { display: flex; justify-content: space-between; font-size: 0.82rem; padding: 2px 0; border-bottom: 1px solid var(--border, #eee); }
.cnw-kv:last-child { border-bottom: none; }
.cnw-kv-key { color: var(--muted, #888); }
.cnw-kv-val { font-weight: 700; }
.cnw-counter-big { font-size: 2.2rem; font-weight: 800; text-align: center; color: var(--primary, #6366f1); padding: 6px 0; }
.cnw-expected { font-size: 0.78rem; text-align: center; color: var(--muted, #888); }
.cnw-log { font-size: 0.78rem; max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.cnw-log-item { padding: 2px 6px; border-radius: 4px; background: var(--surface2, #f0f0f0); }
.cnw-status { font-size: 0.82rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; text-align: center; }
.cnw-status.ok { background: rgba(34,197,94,0.12); color: #16a34a; }
.cnw-status.bad { background: rgba(239,68,68,0.12); color: #dc2626; }
.cnw-status.pending { background: rgba(99,102,241,0.1); color: var(--primary, #6366f1); }
.cnw-section-lbl { font-size: 0.78rem; font-weight: 700; color: var(--muted, #888); }
.cnw-res-grid { display: flex; gap: 10px; }
.cnw-res-box { flex: 1; border: 2px solid var(--border, #ddd); border-radius: 8px; padding: 8px; text-align: center; font-size: 0.82rem; }
.cnw-res-box .res-name { font-weight: 700; font-size: 0.9rem; }
.cnw-res-box .res-owner { color: var(--muted, #888); font-size: 0.78rem; margin-top: 2px; }
.cnw-res-box.owned { border-color: var(--primary, #6366f1); background: rgba(99,102,241,0.08); }
.cnw-res-box.deadlocked { border-color: #ef4444; background: rgba(239,68,68,0.08); }
`;
        const s = document.createElement('style');
        s.textContent = css;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        ConcurrencyWidget.ensureStyles();
        if (container.dataset.cnw) return;
        container.dataset.cnw = '1';
        new ConcurrencyWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.autoTimer = null;
        this.mutex = null;
        this.deadlock = null;
    }

    init() {
        this.root.innerHTML = `<div class="cnw">
  <div class="cnw-tabs">
    <button class="cnw-tab active" data-tab="mutex">🔒 Mutex</button>
    <button class="cnw-tab" data-tab="deadlock">⛔ Deadlock</button>
  </div>

  <!-- MUTEX PANEL -->
  <div class="cnw-panel active" data-panel="mutex">
    <div class="cnw-toolbar">
      <label class="cnw-opt"><input type="checkbox" data-mx-lock checked> Avec mutex</label>
      <div class="cnw-btns">
        <button class="cnw-btn" data-mx-step>Étape</button>
        <button class="cnw-btn primary" data-mx-run>▶ Auto</button>
        <button class="cnw-btn" data-mx-reset>↺ Reset</button>
      </div>
    </div>
    <div class="cnw-counter-big" data-mx-counter>0</div>
    <div class="cnw-expected">Résultat attendu : 6 (T1 et T2 incrémentent 3× chacun)</div>
    <div class="cnw-grid">
      <div class="cnw-card">
        <div class="cnw-card-title">Fil T1</div>
        <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-mx-t1-phase>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Valeur locale</span><span class="cnw-kv-val" data-mx-t1-local>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Écritures</span><span class="cnw-kv-val" data-mx-t1-writes>0/3</span></div>
      </div>
      <div class="cnw-card">
        <div class="cnw-card-title">Fil T2</div>
        <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-mx-t2-phase>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Valeur locale</span><span class="cnw-kv-val" data-mx-t2-local>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Écritures</span><span class="cnw-kv-val" data-mx-t2-writes>0/3</span></div>
      </div>
    </div>
    <div class="cnw-grid">
      <div class="cnw-card">
        <div class="cnw-kv"><span class="cnw-kv-key">Tour actuel</span><span class="cnw-kv-val" data-mx-turn>T1</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Détenteur mutex</span><span class="cnw-kv-val" data-mx-owner>libre</span></div>
      </div>
    </div>
    <div class="cnw-section-lbl">Journal</div>
    <ul class="cnw-log" data-mx-log></ul>
  </div>

  <!-- DEADLOCK PANEL -->
  <div class="cnw-panel" data-panel="deadlock">
    <div class="cnw-toolbar">
      <label class="cnw-opt"><input type="checkbox" data-dl-order> Ordre global (T1 et T2 acquièrent R1 avant R2)</label>
      <div class="cnw-btns">
        <button class="cnw-btn" data-dl-step>Étape</button>
        <button class="cnw-btn primary" data-dl-run>▶ Auto</button>
        <button class="cnw-btn" data-dl-reset>↺ Reset</button>
      </div>
    </div>
    <div class="cnw-status pending" data-dl-status>En exécution</div>
    <div class="cnw-res-grid">
      <div class="cnw-res-box" data-dl-r1-box><div class="res-name">R1</div><div class="res-owner" data-dl-r1>libre</div></div>
      <div class="cnw-res-box" data-dl-r2-box><div class="res-name">R2</div><div class="res-owner" data-dl-r2>libre</div></div>
    </div>
    <div class="cnw-grid">
      <div class="cnw-card">
        <div class="cnw-card-title">Fil T1</div>
        <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-dl-t1-phase>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Attend</span><span class="cnw-kv-val" data-dl-t1-wait>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Ordre</span><span class="cnw-kv-val" data-dl-t1-order>—</span></div>
      </div>
      <div class="cnw-card">
        <div class="cnw-card-title">Fil T2</div>
        <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-dl-t2-phase>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Attend</span><span class="cnw-kv-val" data-dl-t2-wait>—</span></div>
        <div class="cnw-kv"><span class="cnw-kv-key">Ordre</span><span class="cnw-kv-val" data-dl-t2-order>—</span></div>
      </div>
    </div>
    <div class="cnw-section-lbl">Journal</div>
    <ul class="cnw-log" data-dl-log></ul>
  </div>
</div>`;
        this._bindTabs();
        this._bindMutex();
        this._bindDeadlock();
        this._resetMutex();
        this._resetDeadlock();
    }

    _q(s) { return this.root.querySelector(s); }
    _qa(s) { return this.root.querySelectorAll(s); }

    _bindTabs() {
        this._qa('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._qa('[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const t = btn.dataset.tab;
                this._qa('[data-panel]').forEach(p => p.classList.toggle('active', p.dataset.panel === t));
            });
        });
    }

    _bindMutex() {
        this._q('[data-mx-lock]').addEventListener('change', () => this._resetMutex());
        this._q('[data-mx-step]').addEventListener('click', () => this._stepMutex());
        this._q('[data-mx-run]').addEventListener('click', () => this._toggleMutexAuto());
        this._q('[data-mx-reset]').addEventListener('click', () => this._resetMutex());
    }

    _bindDeadlock() {
        this._q('[data-dl-order]').addEventListener('change', () => this._resetDeadlock());
        this._q('[data-dl-step]').addEventListener('click', () => this._stepDeadlock());
        this._q('[data-dl-run]').addEventListener('click', () => this._toggleDeadlockAuto());
        this._q('[data-dl-reset]').addEventListener('click', () => this._resetDeadlock());
    }

    _stopAuto() {
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        this._q('[data-mx-run]').textContent = '▶ Auto';
        this._q('[data-dl-run]').textContent = '▶ Auto';
    }

    // ── Mutex ──
    _resetMutex() {
        this._stopAuto();
        const withLock = this._q('[data-mx-lock]').checked;
        this.mutex = { withLock, counter: 0, lockOwner: null, turn: 'T1', done: false,
            threads: { T1: { phase: 0, local: null, writes: 0, target: 3 }, T2: { phase: 0, local: null, writes: 0, target: 3 } },
            logs: [] };
        this._mxLog(`Reset. Mode ${withLock ? 'avec mutex' : 'sans mutex'}.`);
        this._renderMutex();
    }

    _mxPhaseLabel(p) { return ['enter', 'read', 'local+1', 'write', 'exit'][p] || 'done'; }

    _mxLog(msg) { this.mutex.logs.unshift(msg); this.mutex.logs = this.mutex.logs.slice(0, 10); }

    _stepMutex() {
        if (this.mutex.done) return;
        const id = this.mutex.turn, other = id === 'T1' ? 'T2' : 'T1';
        const t = this.mutex.threads[id];

        if (t.writes >= t.target) {
            this.mutex.turn = other;
            if (this.mutex.threads[other].writes >= this.mutex.threads[other].target) this.mutex.done = true;
            this._renderMutex(); return;
        }
        if (this.mutex.withLock && t.phase === 0 && this.mutex.lockOwner && this.mutex.lockOwner !== id) {
            this._mxLog(`${id} bloqué : mutex détenu par ${this.mutex.lockOwner}.`);
            this.mutex.turn = other; this._renderMutex(); return;
        }
        switch (t.phase) {
            case 0: if (this.mutex.withLock) { this.mutex.lockOwner = id; this._mxLog(`${id} acquiert le mutex.`); }
                    else this._mxLog(`${id} entre en section critique sans protection.`);
                    t.phase = 1; break;
            case 1: t.local = this.mutex.counter; this._mxLog(`${id} lit counter=${this.mutex.counter}.`); t.phase = 2; break;
            case 2: t.local += 1; this._mxLog(`${id} calcule local=${t.local}.`); t.phase = 3; break;
            case 3: this.mutex.counter = t.local; t.writes++; this._mxLog(`${id} écrit counter=${this.mutex.counter}.`); t.phase = 4; break;
            case 4: if (this.mutex.withLock && this.mutex.lockOwner === id) { this.mutex.lockOwner = null; this._mxLog(`${id} libère le mutex.`); }
                    else this._mxLog(`${id} sort.`);
                    t.local = null; t.phase = 0; break;
        }
        this.mutex.turn = other;
        if (this.mutex.threads.T1.writes >= 3 && this.mutex.threads.T2.writes >= 3) {
            this.mutex.done = true;
            this._mxLog(`Terminé. counter=${this.mutex.counter}. Attendu=6.`);
            this._stopAuto();
        }
        this._renderMutex();
    }

    _toggleMutexAuto() {
        if (this.autoTimer) { this._stopAuto(); return; }
        this._q('[data-mx-run]').textContent = '⏸ Pause';
        this.autoTimer = setInterval(() => {
            if (this.mutex.done) { this._stopAuto(); return; }
            this._stepMutex();
        }, 650);
    }

    _renderMutex() {
        this._q('[data-mx-counter]').textContent = this.mutex.counter;
        this._q('[data-mx-turn]').textContent = this.mutex.turn;
        this._q('[data-mx-owner]').textContent = this.mutex.lockOwner || 'libre';
        ['T1','T2'].forEach(id => {
            const t = this.mutex.threads[id];
            this._q(`[data-mx-${id.toLowerCase()}-phase]`).textContent = this._mxPhaseLabel(t.phase);
            this._q(`[data-mx-${id.toLowerCase()}-local]`).textContent = t.local == null ? '—' : String(t.local);
            this._q(`[data-mx-${id.toLowerCase()}-writes]`).textContent = `${t.writes}/${t.target}`;
        });
        this._q('[data-mx-log]').innerHTML = this.mutex.logs.map(l => `<li class="cnw-log-item">${l}</li>`).join('');
    }

    // ── Deadlock ──
    _resetDeadlock() {
        this._stopAuto();
        const ordered = this._q('[data-dl-order]').checked;
        this.deadlock = {
            ordered, owners: { R1: null, R2: null }, turn: 'T1', deadlocked: false, done: false, logs: [],
            threads: {
                T1: { step: 0, waitingFor: null, order: ['R1','R2'] },
                T2: { step: 0, waitingFor: null, order: ordered ? ['R1','R2'] : ['R2','R1'] }
            }
        };
        this._dlLog(`Reset. ${ordered ? 'Ordre global : pas de deadlock attendu.' : 'Ordres opposés : deadlock possible.'}`);
        this._renderDeadlock();
    }

    _dlLog(msg) { this.deadlock.logs.unshift(msg); this.deadlock.logs = this.deadlock.logs.slice(0, 12); }

    _dlAcquire(id, res) {
        const holder = this.deadlock.owners[res];
        const t = this.deadlock.threads[id];
        if (!holder) { this.deadlock.owners[res] = id; t.waitingFor = null; this._dlLog(`${id} acquiert ${res}.`); return true; }
        if (holder === id) return true;
        t.waitingFor = res; this._dlLog(`${id} attend ${res} (détenu par ${holder}).`); return false;
    }

    _dlRelease(id) {
        ['R1','R2'].forEach(r => { if (this.deadlock.owners[r] === id) this.deadlock.owners[r] = null; });
        this.deadlock.threads[id].waitingFor = null;
        this._dlLog(`${id} libère ses ressources.`);
    }

    _checkDeadlock() {
        const t1 = this.deadlock.threads.T1, t2 = this.deadlock.threads.T2;
        if (!t1.waitingFor || !t2.waitingFor) return false;
        return this.deadlock.owners[t1.waitingFor] === 'T2' && this.deadlock.owners[t2.waitingFor] === 'T1';
    }

    _stepDeadlock() {
        if (this.deadlock.done || this.deadlock.deadlocked) return;
        const id = this.deadlock.turn, other = id === 'T1' ? 'T2' : 'T1';
        const t = this.deadlock.threads[id];
        if (t.step === 0) { if (this._dlAcquire(id, t.order[0])) t.step = 1; }
        else if (t.step === 1) { if (this._dlAcquire(id, t.order[1])) t.step = 2; }
        else if (t.step === 2) { this._dlRelease(id); t.step = 3; }

        if (this._checkDeadlock()) { this.deadlock.deadlocked = true; this._dlLog('Deadlock : attente circulaire T1 ↔ T2.'); this._stopAuto(); }
        if (this.deadlock.threads.T1.step >= 3 && this.deadlock.threads.T2.step >= 3) {
            this.deadlock.done = true; this._dlLog('Terminé sans interblocage.'); this._stopAuto();
        }
        this.deadlock.turn = other;
        this._renderDeadlock();
    }

    _toggleDeadlockAuto() {
        if (this.autoTimer) { this._stopAuto(); return; }
        this._q('[data-dl-run]').textContent = '⏸ Pause';
        this.autoTimer = setInterval(() => {
            if (this.deadlock.done || this.deadlock.deadlocked) { this._stopAuto(); return; }
            this._stepDeadlock();
        }, 650);
    }

    _renderDeadlock() {
        ['R1','R2'].forEach(r => {
            const owner = this.deadlock.owners[r];
            this._q(`[data-dl-${r.toLowerCase()}]`).textContent = owner || 'libre';
            const box = this._q(`[data-dl-${r.toLowerCase()}-box]`);
            box.classList.toggle('owned', !!owner && !this.deadlock.deadlocked);
            box.classList.toggle('deadlocked', !!owner && this.deadlock.deadlocked);
        });
        this._q('[data-dl-turn]') && (this._q('[data-dl-turn]').textContent = this.deadlock.turn);
        ['T1','T2'].forEach(id => {
            const t = this.deadlock.threads[id];
            const phase = t.step === 0 ? `acq ${t.order[0]}` : t.step === 1 ? `acq ${t.order[1]}` : t.step === 2 ? 'release' : 'done';
            const lc = id.toLowerCase();
            this._q(`[data-dl-${lc}-phase]`).textContent = phase;
            this._q(`[data-dl-${lc}-wait]`).textContent = t.waitingFor || '—';
            this._q(`[data-dl-${lc}-order]`).textContent = `${t.order[0]} → ${t.order[1]}`;
        });
        const st = this._q('[data-dl-status]');
        if (this.deadlock.deadlocked) { st.className = 'cnw-status bad'; st.textContent = '⛔ Deadlock détecté'; }
        else if (this.deadlock.done) { st.className = 'cnw-status ok'; st.textContent = '✓ Terminé sans deadlock'; }
        else { st.className = 'cnw-status pending'; st.textContent = 'En exécution…'; }
        this._q('[data-dl-log]').innerHTML = this.deadlock.logs.map(l => `<li class="cnw-log-item">${l}</li>`).join('');
    }
}

if (typeof window !== 'undefined') {
    window.ConcurrencyWidget = ConcurrencyWidget;
}
