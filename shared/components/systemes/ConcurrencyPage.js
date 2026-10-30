/**
 * ConcurrencyPage / ConcurrencyWidget : l'état et les pas viennent du modèle pur
 * `algorithms/mutex-model.js` (relecture 3b, B7, CO-I2) ; ici, seulement de l'affichage et des
 * commandes. L'ordonnancement est choisi : alternance, un thread après l'autre, ou choix manuel.
 */
class ConcurrencyPage extends ConceptPage {
    static PHASE_LABELS = { acquire: 'prendre le verrou', read: 'lire counter', add: 'ajouter 1', write: 'écrire counter', release: 'libérer le verrou' };
    static SCHEDULES = { alternate: 'Alternance (un pas chacun)', sequential: 'Un thread après l\'autre', manual: 'Choix manuel' };

    constructor(dataPath) {
        super(dataPath);
        this.autoTimer = null;
        this.autoDelay = 650;
        this.mutex = null;
        this.deadlock = null;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector({ lineIdBuilder: (block, idx) => `${block.name}-line${idx}` });
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
        const el = (id) => document.getElementById(id);
        el('mutex-step').addEventListener('click', () => this.stepMutex());
        el('mutex-t1').addEventListener('click', () => this.stepMutex('T1'));
        el('mutex-t2').addEventListener('click', () => this.stepMutex('T2'));
        el('mutex-reset').addEventListener('click', () => this.resetMutex());
        el('mutex-run').addEventListener('click', () => this.toggleAuto('mutex'));
        el('mutex-quick').addEventListener('click', () => this.quickRun());
        ['mutex-lock', 'mutex-schedule', 'mutex-increments'].forEach((id) => el(id).addEventListener('change', () => this.resetMutex()));
    }

    bindDeadlockControls() {
        const el = (id) => document.getElementById(id);
        el('deadlock-step').addEventListener('click', () => this.stepDeadlock());
        el('deadlock-t1').addEventListener('click', () => this.stepDeadlock('T1'));
        el('deadlock-t2').addEventListener('click', () => this.stepDeadlock('T2'));
        el('deadlock-reset').addEventListener('click', () => this.resetDeadlock());
        el('deadlock-run').addEventListener('click', () => this.toggleAuto('deadlock'));
        ['deadlock-order', 'deadlock-schedule'].forEach((id) => el(id).addEventListener('change', () => this.resetDeadlock()));
    }

    stopAuto() {
        if (this.autoTimer) {
            clearInterval(this.autoTimer);
            this.autoTimer = null;
        }
        ['mutex-run', 'deadlock-run'].forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = 'Lecture auto';
        });
    }

    toggleAuto(which) {
        if (this.autoTimer) { this.stopAuto(); return; }
        document.getElementById(`${which}-run`).textContent = 'Pause';
        this.autoTimer = setInterval(() => {
            if (which === 'mutex') {
                if (OEITrace.mutexIsDone(this.mutex)) { this.stopAuto(); return; }
                this.stepMutex();
            } else {
                if (this.deadlock.done || this.deadlock.deadlocked) { this.stopAuto(); return; }
                this.stepDeadlock();
            }
        }, this.autoDelay);
    }

    schedule(which) {
        return document.getElementById(`${which}-schedule`).value;
    }

    toggleManual(which) {
        const manual = this.schedule(which) === 'manual';
        const show = (id, on) => { document.getElementById(id).style.display = on ? '' : 'none'; };
        show(`${which}-step`, !manual);
        show(`${which}-run`, !manual);
        show(`${which}-t1`, manual);
        show(`${which}-t2`, manual);
    }

    // ── Compteur partagé ──
    resetMutex() {
        this.stopAuto();
        const withLock = document.getElementById('mutex-lock').checked;
        const increments = Math.min(1000, Math.max(1, parseInt(document.getElementById('mutex-increments').value, 10) || 3));
        this.mutex = OEITrace.mutexNew({ withLock: withLock, increments: increments });
        this.toggleManual('mutex');
        this.mutex.logs.unshift('Réinitialisation : ' + (withLock ? 'avec' : 'sans') + ' mutex, ' + increments + ' incréments par thread.');
        document.getElementById('mutex-quick-out').textContent = '';
        this.renderMutex();
    }

    stepMutex(id) {
        if (OEITrace.mutexIsDone(this.mutex)) return;
        if (id) {
            OEITrace.mutexStep(this.mutex, id);
        } else {
            OEITrace.mutexAdvance(this.mutex, this.schedule('mutex'));
        }
        if (OEITrace.mutexIsDone(this.mutex)) this.stopAuto();
        this.renderMutex();
    }

    quickRun() {
        const withLock = document.getElementById('mutex-lock').checked;
        const rows = [['alternate', 'alternance'], ['sequential', 'un thread après l\'autre'], ['random', 'ordonnancement aléatoire']]
            .map(([schedule, label]) => {
                const r = OEITrace.mutexRunAll({ withLock: withLock, increments: 1000, schedule: schedule, seed: 7 });
                return label + ' : counter = ' + r.counter + ' (attendu ' + r.expected + ')';
            });
        document.getElementById('mutex-quick-out').textContent = (withLock ? 'Avec mutex, ' : 'Sans mutex, ') + '1000 incréments par thread : ' + rows.join(' ; ') + '.';
    }

    renderMutex() {
        const m = this.mutex;
        const set = (id, v) => { document.getElementById(id).textContent = v; };
        const done = OEITrace.mutexIsDone(m);
        set('mutex-counter', m.counter);
        set('mutex-owner', m.owner || 'libre');
        set('mutex-expected', OEITrace.mutexExpected(m));
        set('mutex-turn', this.schedule('mutex') === 'manual' ? 'au choix' : OEITrace.mutexPick(m, this.schedule('mutex')));
        OEITrace.MUTEX_THREADS.forEach((id) => {
            const t = m.threads[id];
            const label = OEITrace.mutexThreadDone(m, id) ? 'terminé' : (OEITrace.mutexBlocked(m, id) ? 'bloqué' : ConcurrencyPage.PHASE_LABELS[m.phases[t.phase]]);
            set(`mx-${id}-phase`, label);
            set(`mx-${id}-local`, t.local == null ? '-' : String(t.local));
            set(`mx-${id}-writes`, `${t.done}/${t.target}`);
        });
        const verdict = document.getElementById('mutex-verdict');
        if (done) {
            const lost = OEITrace.mutexExpected(m) - m.counter;
            verdict.textContent = lost === 0 ? 'Terminé : counter = ' + m.counter + ', aucune mise à jour perdue.' : 'Terminé : counter = ' + m.counter + ' au lieu de ' + OEITrace.mutexExpected(m) + ' : ' + lost + ' mises à jour perdues.';
            verdict.className = 'status ' + (lost === 0 ? 'status-ok' : 'status-bad');
        } else {
            verdict.textContent = 'En exécution (' + m.lostTurns + ' tours perdus à attendre le verrou).';
            verdict.className = 'status status-pending';
        }
        const ul = document.getElementById('mutex-log');
        ul.innerHTML = m.logs.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    }

    // ── Deux verrous ──
    resetDeadlock() {
        this.stopAuto();
        const ordered = document.getElementById('deadlock-order').checked;
        this.deadlock = OEITrace.deadlockNew({ ordered: ordered });
        this.toggleManual('deadlock');
        this.deadlock.logs.unshift('Réinitialisation. ' + (ordered ? 'Ordre global : T1 et T2 prennent R1 puis R2.' : 'Ordres opposés : T1 prend R1 puis R2, T2 prend R2 puis R1.'));
        this.renderDeadlock();
    }

    stepDeadlock(id) {
        if (this.deadlock.done || this.deadlock.deadlocked) return;
        if (id) OEITrace.deadlockStep(this.deadlock, id);
        else OEITrace.deadlockAdvance(this.deadlock, this.schedule('deadlock'));
        if (this.deadlock.done || this.deadlock.deadlocked) this.stopAuto();
        this.renderDeadlock();
    }

    renderDeadlock() {
        const d = this.deadlock;
        const set = (id, v) => { document.getElementById(id).textContent = v; };
        set('dl-r1', d.owners.R1 || 'libre');
        set('dl-r2', d.owners.R2 || 'libre');
        set('dl-turn', this.schedule('deadlock') === 'manual' ? 'au choix' : OEITrace.deadlockPickLabel(d, this.schedule('deadlock')));
        OEITrace.MUTEX_THREADS.forEach((id) => {
            const t = d.threads[id];
            const phase = t.step === 0 ? `prendre ${t.order[0]}` : t.step === 1 ? `prendre ${t.order[1]}` : t.step === 2 ? 'relâcher' : 'terminé';
            set(`dl-${id}-phase`, phase);
            set(`dl-${id}-wait`, t.waitingFor || '-');
            set(`dl-${id}-order`, `${t.order[0]} puis ${t.order[1]}`);
        });
        const status = document.getElementById('deadlock-status');
        if (d.deadlocked) { status.className = 'status status-bad'; status.textContent = 'Interblocage : chaque thread attend ce que l\'autre détient'; }
        else if (d.done) { status.className = 'status status-ok'; status.textContent = 'Terminé sans interblocage'; }
        else { status.className = 'status status-pending'; status.textContent = 'En exécution'; }
        document.getElementById('deadlock-log').innerHTML = d.logs.map((line) => `<li>${this.escapeHtml(line)}</li>`).join('');
    }
}

if (typeof window !== 'undefined') {
    window.ConcurrencyPage = ConcurrencyPage;
}

// ── Standalone widget ──────────────────────────────────────────
class ConcurrencyWidget {
    static mount(container, config = {}) {
        if (container.dataset.cnw) return;
        container.dataset.cnw = '1';
        new ConcurrencyWidget(container, config).init();
    }

    constructor(container, config = {}) {
        this.root = container;
        this.config = config;
        this.autoTimer = null;
        this.mutex = null;
        this.deadlock = null;
    }

    init() {
        const scheduleOptions = Object.entries(ConcurrencyPage.SCHEDULES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        this.root.innerHTML = `<div class="cnw widget-fit">
  <div class="cnw-tabs widget-fit-header">
    <button class="cnw-tab active" data-tab="mutex">${OEIIcons.render('lock')} Compteur partagé</button>
    <button class="cnw-tab" data-tab="deadlock">${OEIIcons.render('ban')} Interblocage</button>
  </div>
  <div class="widget-fit-body">

  <div class="cnw-panel active widget-fit" data-panel="mutex">
    <div class="cnw-toolbar widget-fit-header">
      <label class="cnw-opt"><input type="checkbox" data-mx-lock${this.config.withLock === false ? '' : ' checked'}> Avec mutex</label>
      <label class="cnw-opt">Ordonnancement <select data-mx-schedule>${scheduleOptions}</select></label>
      <div class="cnw-btns">
        <button class="cnw-btn" data-mx-step>Étape</button>
        <button class="cnw-btn" data-mx-t1 style="display:none">Pas de T1</button>
        <button class="cnw-btn" data-mx-t2 style="display:none">Pas de T2</button>
        <button class="cnw-btn primary" data-mx-run>${OEIIcons.render('play')} Auto</button>
        <button class="cnw-btn" data-mx-reset>${OEIIcons.render('refresh')} Reset</button>
      </div>
    </div>
    <div class="widget-fit-body">
      <div class="cnw-counter-big" data-mx-counter>0</div>
      <div class="cnw-expected" data-mx-expected></div>
      <div class="cnw-grid">
        <div class="cnw-card">
          <div class="cnw-card-title">Thread T1</div>
          <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-mx-t1-phase>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Valeur locale</span><span class="cnw-kv-val" data-mx-t1-local>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Incréments</span><span class="cnw-kv-val" data-mx-t1-writes>0/3</span></div>
        </div>
        <div class="cnw-card">
          <div class="cnw-card-title">Thread T2</div>
          <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-mx-t2-phase>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Valeur locale</span><span class="cnw-kv-val" data-mx-t2-local>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Incréments</span><span class="cnw-kv-val" data-mx-t2-writes>0/3</span></div>
        </div>
      </div>
      <div class="cnw-kv"><span class="cnw-kv-key">Détenteur du mutex</span><span class="cnw-kv-val" data-mx-owner>libre</span></div>
      <div class="cnw-status pending" data-mx-verdict></div>
      <div class="cnw-section-lbl">Journal</div>
      <ul class="cnw-log" data-mx-log></ul>
    </div>
  </div>

  <div class="cnw-panel widget-fit" data-panel="deadlock">
    <div class="cnw-toolbar widget-fit-header">
      <label class="cnw-opt"><input type="checkbox" data-dl-order> Ordre global (R1 puis R2 pour les deux)</label>
      <label class="cnw-opt">Ordonnancement <select data-dl-schedule>${scheduleOptions}</select></label>
      <div class="cnw-btns">
        <button class="cnw-btn" data-dl-step>Étape</button>
        <button class="cnw-btn" data-dl-t1 style="display:none">Pas de T1</button>
        <button class="cnw-btn" data-dl-t2 style="display:none">Pas de T2</button>
        <button class="cnw-btn primary" data-dl-run>${OEIIcons.render('play')} Auto</button>
        <button class="cnw-btn" data-dl-reset>${OEIIcons.render('refresh')} Reset</button>
      </div>
    </div>
    <div class="widget-fit-body">
      <div class="cnw-status pending" data-dl-status>En exécution</div>
      <div class="cnw-res-grid">
        <div class="cnw-res-box" data-dl-r1-box><div class="res-name">R1</div><div class="res-owner" data-dl-r1>libre</div></div>
        <div class="cnw-res-box" data-dl-r2-box><div class="res-name">R2</div><div class="res-owner" data-dl-r2>libre</div></div>
      </div>
      <div class="cnw-grid">
        <div class="cnw-card">
          <div class="cnw-card-title">Thread T1</div>
          <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-dl-t1-phase>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Attend</span><span class="cnw-kv-val" data-dl-t1-wait>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Ordre</span><span class="cnw-kv-val" data-dl-t1-order>-</span></div>
        </div>
        <div class="cnw-card">
          <div class="cnw-card-title">Thread T2</div>
          <div class="cnw-kv"><span class="cnw-kv-key">Phase</span><span class="cnw-kv-val" data-dl-t2-phase>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Attend</span><span class="cnw-kv-val" data-dl-t2-wait>-</span></div>
          <div class="cnw-kv"><span class="cnw-kv-key">Ordre</span><span class="cnw-kv-val" data-dl-t2-order>-</span></div>
        </div>
      </div>
      <div class="cnw-section-lbl">Journal</div>
      <ul class="cnw-log" data-dl-log></ul>
    </div>
  </div>
  </div>
</div>`;
        this._bind();
        this._resetMutex();
        this._resetDeadlock();
    }

    _q(s) { return this.root.querySelector(s); }
    _qa(s) { return this.root.querySelectorAll(s); }

    _bind() {
        this._qa('[data-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this._qa('[data-tab]').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const t = btn.dataset.tab;
                this._qa('[data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === t));
            });
        });
        this._q('[data-mx-lock]').addEventListener('change', () => this._resetMutex());
        this._q('[data-mx-schedule]').addEventListener('change', () => this._resetMutex());
        this._q('[data-mx-step]').addEventListener('click', () => this._stepMutex());
        this._q('[data-mx-t1]').addEventListener('click', () => this._stepMutex('T1'));
        this._q('[data-mx-t2]').addEventListener('click', () => this._stepMutex('T2'));
        this._q('[data-mx-run]').addEventListener('click', () => this._toggleAuto('mx'));
        this._q('[data-mx-reset]').addEventListener('click', () => this._resetMutex());
        this._q('[data-dl-order]').addEventListener('change', () => this._resetDeadlock());
        this._q('[data-dl-schedule]').addEventListener('change', () => this._resetDeadlock());
        this._q('[data-dl-step]').addEventListener('click', () => this._stepDeadlock());
        this._q('[data-dl-t1]').addEventListener('click', () => this._stepDeadlock('T1'));
        this._q('[data-dl-t2]').addEventListener('click', () => this._stepDeadlock('T2'));
        this._q('[data-dl-run]').addEventListener('click', () => this._toggleAuto('dl'));
        this._q('[data-dl-reset]').addEventListener('click', () => this._resetDeadlock());
    }

    _stopAuto() {
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
        OEIIcons.setLabel(this._q('[data-mx-run]'), 'play', 'Auto');
        OEIIcons.setLabel(this._q('[data-dl-run]'), 'play', 'Auto');
    }

    _toggleAuto(which) {
        if (this.autoTimer) { this._stopAuto(); return; }
        OEIIcons.setLabel(this._q(`[data-${which}-run]`), 'pause', 'Pause');
        this.autoTimer = setInterval(() => {
            if (which === 'mx') {
                if (OEITrace.mutexIsDone(this.mutex)) { this._stopAuto(); return; }
                this._stepMutex();
            } else {
                if (this.deadlock.done || this.deadlock.deadlocked) { this._stopAuto(); return; }
                this._stepDeadlock();
            }
        }, 650);
    }

    _manual(which) {
        const manual = this._q(`[data-${which}-schedule]`).value === 'manual';
        this._q(`[data-${which}-step]`).style.display = manual ? 'none' : '';
        this._q(`[data-${which}-run]`).style.display = manual ? 'none' : '';
        this._q(`[data-${which}-t1]`).style.display = manual ? '' : 'none';
        this._q(`[data-${which}-t2]`).style.display = manual ? '' : 'none';
        return manual;
    }

    _resetMutex() {
        this._stopAuto();
        this.mutex = OEITrace.mutexNew({ withLock: this._q('[data-mx-lock]').checked, increments: 3 });
        this._manual('mx');
        this._renderMutex();
    }

    _stepMutex(id) {
        if (OEITrace.mutexIsDone(this.mutex)) return;
        if (id) OEITrace.mutexStep(this.mutex, id);
        else OEITrace.mutexAdvance(this.mutex, this._q('[data-mx-schedule]').value);
        if (OEITrace.mutexIsDone(this.mutex)) this._stopAuto();
        this._renderMutex();
    }

    _renderMutex() {
        const m = this.mutex;
        const set = (sel, v) => { this._q(sel).textContent = v; };
        const expected = OEITrace.mutexExpected(m);
        set('[data-mx-counter]', m.counter);
        set('[data-mx-expected]', 'Résultat attendu : ' + expected + ' (chaque thread incrémente ' + m.threads.T1.target + ' fois)');
        set('[data-mx-owner]', m.owner || 'libre');
        OEITrace.MUTEX_THREADS.forEach((id) => {
            const t = m.threads[id];
            const lc = id.toLowerCase();
            set(`[data-mx-${lc}-phase]`, OEITrace.mutexThreadDone(m, id) ? 'terminé' : (OEITrace.mutexBlocked(m, id) ? 'bloqué' : ConcurrencyPage.PHASE_LABELS[m.phases[t.phase]]));
            set(`[data-mx-${lc}-local]`, t.local == null ? '-' : String(t.local));
            set(`[data-mx-${lc}-writes]`, `${t.done}/${t.target}`);
        });
        const verdict = this._q('[data-mx-verdict]');
        if (OEITrace.mutexIsDone(m)) {
            const lost = expected - m.counter;
            verdict.className = 'cnw-status ' + (lost === 0 ? 'ok' : 'bad');
            verdict.textContent = lost === 0 ? 'Terminé : counter = ' + m.counter + ', aucune mise à jour perdue.' : 'Terminé : counter = ' + m.counter + ' au lieu de ' + expected + ' (' + lost + ' mises à jour perdues).';
        } else {
            verdict.className = 'cnw-status pending';
            verdict.textContent = 'En exécution (' + m.lostTurns + ' tours perdus à attendre le verrou).';
        }
        this._fillLog('[data-mx-log]', m.logs);
    }

    _fillLog(sel, logs) {
        const ul = this._q(sel);
        ul.innerHTML = '';
        logs.forEach((line) => {
            const li = document.createElement('li');
            li.className = 'cnw-log-item';
            li.textContent = line;
            ul.appendChild(li);
        });
    }

    _resetDeadlock() {
        this._stopAuto();
        this.deadlock = OEITrace.deadlockNew({ ordered: this._q('[data-dl-order]').checked });
        this._manual('dl');
        this._renderDeadlock();
    }

    _stepDeadlock(id) {
        if (this.deadlock.done || this.deadlock.deadlocked) return;
        if (id) OEITrace.deadlockStep(this.deadlock, id);
        else OEITrace.deadlockAdvance(this.deadlock, this._q('[data-dl-schedule]').value);
        if (this.deadlock.done || this.deadlock.deadlocked) this._stopAuto();
        this._renderDeadlock();
    }

    _renderDeadlock() {
        const d = this.deadlock;
        ['R1', 'R2'].forEach((r) => {
            const owner = d.owners[r];
            this._q(`[data-dl-${r.toLowerCase()}]`).textContent = owner || 'libre';
            const box = this._q(`[data-dl-${r.toLowerCase()}-box]`);
            box.classList.toggle('owned', !!owner && !d.deadlocked);
            box.classList.toggle('deadlocked', !!owner && d.deadlocked);
        });
        OEITrace.MUTEX_THREADS.forEach((id) => {
            const t = d.threads[id];
            const lc = id.toLowerCase();
            this._q(`[data-dl-${lc}-phase]`).textContent = t.step === 0 ? `prendre ${t.order[0]}` : t.step === 1 ? `prendre ${t.order[1]}` : t.step === 2 ? 'relâcher' : 'terminé';
            this._q(`[data-dl-${lc}-wait]`).textContent = t.waitingFor || '-';
            this._q(`[data-dl-${lc}-order]`).textContent = `${t.order[0]} puis ${t.order[1]}`;
        });
        const st = this._q('[data-dl-status]');
        if (d.deadlocked) { st.className = 'cnw-status bad'; OEIIcons.setLabel(st, 'ban', 'Interblocage : chacun attend ce que l\'autre détient'); }
        else if (d.done) { st.className = 'cnw-status ok'; OEIIcons.setLabel(st, 'check', 'Terminé sans interblocage'); }
        else { st.className = 'cnw-status pending'; st.textContent = 'En exécution'; }
        this._fillLog('[data-dl-log]', d.logs);
    }
}

if (typeof window !== 'undefined') {
    window.ConcurrencyWidget = ConcurrencyWidget;
}
