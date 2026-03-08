class EventDelegationStandardisteWidget {
    static ensureStyles() {
        // Délègue à EventWidgets si disponible, sinon injecte le CSS minimal nécessaire
        if (window.EventWidgets && typeof window.EventWidgets.ensureStyles === 'function') {
            window.EventWidgets.ensureStyles();
            return;
        }
        if (document.getElementById('event-widgets-styles')) return;
        const style = document.createElement('style');
        style.id = 'event-widgets-styles';
        style.textContent = `
.event-widget{border:1px solid var(--border,#e0e0e5);border-radius:8px;background:var(--card,#f9f9fb);padding:1rem;margin:1rem 0;color:var(--text,#1d1d1f);}
.event-widget h3{margin:0 0 .55rem;font-size:1rem;}
.event-widget p{margin:0 0 .6rem;color:var(--muted,#6b7280);font-size:.88rem;}
.event-widget .controls{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.55rem;align-items:center;}
.event-widget .btn{padding:.3rem .75rem;border:1px solid var(--border,#e0e0e5);border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:500;background:var(--card,#f9f9fb);color:var(--text,#1d1d1f);transition:opacity .15s;}
.event-widget .btn:hover{opacity:.8;}
.event-widget .btn-primary{background:var(--primary,#6366f1);border-color:var(--primary,#6366f1);color:#fff;}
.event-widget .btn-secondary{background:var(--card,#f9f9fb);color:var(--text,#1d1d1f);}
.event-widget .mini-log{min-height:110px;max-height:220px;overflow:auto;border:1px solid var(--border,#e0e0e5);border-radius:6px;background:var(--code-bg,#1e293b);color:var(--code-text,#e2e8f0);padding:.6rem;font-family:monospace;font-size:.8rem;white-space:pre-wrap;}
.event-widget .deleg-grid{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;align-items:start;}
.event-widget .deleg-building{position:relative;border:1px solid var(--border,#e0e0e5);border-radius:6px;background:var(--bg,#fff);padding:.7rem;min-height:340px;overflow:hidden;}
.event-widget .deleg-windows{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:.35rem;margin-bottom:.5rem;}
.event-widget .deleg-window{height:22px;border:1px solid var(--border,#e0e0e5);border-radius:5px;background:var(--card,#f9f9fb);cursor:pointer;font-size:.62rem;display:grid;place-items:center;color:var(--muted,#6b7280);transition:transform 120ms ease,border-color 120ms ease,background 120ms ease;}
.event-widget .deleg-window:hover{transform:translateY(-1px);border-color:var(--primary,#6366f1);}
.event-widget .deleg-window.targeted{border-color:#0ea5e9;background:rgba(14,165,233,.1);box-shadow:0 0 0 2px rgba(14,165,233,.2);}
.event-widget .deleg-guards{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:.35rem;}
.event-widget .deleg-guard{height:14px;border-radius:999px;background:rgba(239,68,68,.1);border:1px solid #ef4444;}
.event-widget .deleg-entrance{position:relative;margin-top:.6rem;border:1px dashed var(--border,#e0e0e5);border-radius:8px;padding:.5rem;background:var(--card,#f9f9fb);min-height:72px;}
.event-widget .deleg-main-guard{display:inline-flex;align-items:center;gap:.3rem;border:1px solid var(--accent,#16a34a);border-radius:999px;background:rgba(22,163,74,.1);padding:.22rem .5rem;font-size:.75rem;}
.event-widget .deleg-bubble{position:absolute;right:.5rem;top:.5rem;max-width:70%;border:1px solid #0ea5e9;border-radius:8px;background:rgba(14,165,233,.1);padding:.35rem .45rem;font-size:.75rem;color:var(--text,#1d1d1f);opacity:0;transform:translateY(-4px);transition:opacity 160ms ease,transform 160ms ease;}
.event-widget .deleg-bubble.visible{opacity:1;transform:translateY(0);}
.event-widget .deleg-svg{position:absolute;inset:0;pointer-events:none;}
.event-widget .deleg-path{stroke:var(--primary,#6366f1);stroke-width:2.5;fill:none;stroke-linecap:round;stroke-dasharray:7 7;animation:delegDash 750ms linear infinite;opacity:0;transition:opacity 150ms ease;}
.event-widget .deleg-path.visible{opacity:1;}
.event-widget .deleg-stats{display:grid;gap:.35rem;margin-top:.45rem;font-size:.8rem;}
@keyframes delegDash{to{stroke-dashoffset:-28;}}
@media(max-width:980px){.event-widget .deleg-grid{grid-template-columns:1fr;}}
`;
        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        EventDelegationStandardisteWidget.ensureStyles();
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'La métaphore du standardiste')}</h3>
            <p>${escapeHtml(config.description || 'Comparer 50 listeners individuels vs 1 listener délégué au parent.')}</p>
            <div class="controls">
                <button type="button" class="btn btn-secondary" data-role="mode-direct">Sans délégation</button>
                <button type="button" class="btn btn-primary" data-role="mode-deleg">Avec délégation</button>
                <button type="button" class="btn btn-secondary" data-role="add-window">Ajouter fenêtre dynamique</button>
                <button type="button" class="btn btn-secondary" data-role="reset">Réinitialiser</button>
            </div>
            <div class="deleg-grid">
                <div class="deleg-building" data-role="building">
                    <svg class="deleg-svg" data-role="svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path class="deleg-path" data-role="path"></path>
                    </svg>
                    <div class="deleg-windows" data-role="windows"></div>
                    <div class="deleg-guards" data-role="guards"></div>
                    <div class="deleg-entrance">
                        <div class="deleg-main-guard" data-role="main-guard">🧑‍💼 Standardiste (entrée)</div>
                        <div class="deleg-bubble" data-role="bubble">D'où vient ce signal ?</div>
                    </div>
                </div>
                <div>
                    <div class="mini-log" data-role="log"></div>
                    <div class="deleg-stats">
                        <div><strong>Mode:</strong> <span data-role="stat-mode">Avec délégation</span></div>
                        <div><strong>Listeners actifs:</strong> <span data-role="stat-listeners">1</span></div>
                        <div><strong>currentTarget:</strong> <span data-role="stat-current">ul#building</span></div>
                        <div><strong>target:</strong> <span data-role="stat-target">-</span></div>
                    </div>
                </div>
            </div>
        `;

        const windowsEl = container.querySelector('[data-role="windows"]');
        const guardsEl = container.querySelector('[data-role="guards"]');
        const building = container.querySelector('[data-role="building"]');
        const svg = container.querySelector('[data-role="svg"]');
        const mainGuard = container.querySelector('[data-role="main-guard"]');
        const bubble = container.querySelector('[data-role="bubble"]');
        const path = container.querySelector('[data-role="path"]');
        const logEl = container.querySelector('[data-role="log"]');
        const statMode = container.querySelector('[data-role="stat-mode"]');
        const statListeners = container.querySelector('[data-role="stat-listeners"]');
        const statCurrent = container.querySelector('[data-role="stat-current"]');
        const statTarget = container.querySelector('[data-role="stat-target"]');
        const modeDirectBtn = container.querySelector('[data-role="mode-direct"]');
        const modeDelegBtn = container.querySelector('[data-role="mode-deleg"]');
        const addWindowBtn = container.querySelector('[data-role="add-window"]');
        const resetBtn = container.querySelector('[data-role="reset"]');

        let mode = 'delegation';
        let windowCount = 50;
        let directListeners = [];
        let lastTargetWindow = null;

        const write = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };

        const clearSignal = () => {
            path.classList.remove('visible');
            bubble.classList.remove('visible');
            windowsEl.querySelectorAll('.deleg-window.targeted').forEach((w) => w.classList.remove('targeted'));
            lastTargetWindow = null;
        };

        const setStats = (targetLabel = '-') => {
            const listeners = mode === 'delegation' ? 1 : windowCount;
            statMode.textContent = mode === 'delegation' ? 'Avec délégation' : 'Sans délégation';
            statListeners.textContent = String(listeners);
            statCurrent.textContent = mode === 'delegation' ? 'ul#building' : 'li.window';
            statTarget.textContent = targetLabel;
        };

        const drawPathToWindow = (windowNode) => {
            if (!windowNode || !svg) return;
            const sRect = svg.getBoundingClientRect();
            if (sRect.width <= 0 || sRect.height <= 0) return;
            const gRect = mainGuard.getBoundingClientRect();
            const wRect = windowNode.getBoundingClientRect();
            const sx = ((gRect.left + (gRect.width / 2)) - sRect.left) / sRect.width * 100;
            const sy = ((gRect.top + (gRect.height / 2)) - sRect.top) / sRect.height * 100;
            const tx = ((wRect.left + (wRect.width / 2)) - sRect.left) / sRect.width * 100;
            const ty = ((wRect.top + (wRect.height / 2)) - sRect.top) / sRect.height * 100;
            const cx = (sx + tx) / 2;
            const cy = Math.min(sy, ty) - 10;
            path.setAttribute('d', `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`);
            path.classList.add('visible');
        };

        const redrawPathIfNeeded = () => {
            if (mode !== 'delegation') return;
            if (!lastTargetWindow || !lastTargetWindow.isConnected) return;
            drawPathToWindow(lastTargetWindow);
        };

        const onWindowSignal = (win) => {
            clearSignal();
            win.classList.add('targeted');
            const id = win.getAttribute('data-window');
            if (mode === 'delegation') {
                bubble.textContent = `D'où vient ce signal ? -> target: fenêtre #${id}`;
                bubble.classList.add('visible');
                lastTargetWindow = win;
                drawPathToWindow(win);
                write(`DÉLÉGATION | currentTarget=ul#building | target=li[data-window="${id}"]`);
            } else {
                write(`DIRECT | currentTarget=li[data-window="${id}"] | target=li[data-window="${id}"]`);
            }
            setStats(`fenêtre #${id}`);
        };

        const bindDirectListeners = () => {
            directListeners.forEach((off) => off());
            directListeners = [];
            windowsEl.querySelectorAll('.deleg-window').forEach((win) => {
                const handler = () => onWindowSignal(win);
                win.addEventListener('click', handler);
                directListeners.push(() => win.removeEventListener('click', handler));
            });
        };

        const renderBuilding = () => {
            clearSignal();
            windowsEl.innerHTML = '';
            guardsEl.innerHTML = '';
            for (let i = 1; i <= windowCount; i += 1) {
                const w = document.createElement('button');
                w.type = 'button';
                w.className = 'deleg-window';
                w.setAttribute('data-window', String(i));
                w.textContent = String(i);
                windowsEl.appendChild(w);

                const g = document.createElement('div');
                g.className = 'deleg-guard';
                guardsEl.appendChild(g);
            }

            if (mode === 'delegation') {
                guardsEl.style.opacity = '0.25';
                if (windowsEl._delegHandler) windowsEl.removeEventListener('click', windowsEl._delegHandler);
                const delegHandler = (event) => {
                    const win = event.target.closest('.deleg-window');
                    if (!win || !windowsEl.contains(win)) return;
                    onWindowSignal(win);
                };
                windowsEl._delegHandler = delegHandler;
                windowsEl.addEventListener('click', delegHandler);
                directListeners.forEach((off) => off());
                directListeners = [];
            } else {
                guardsEl.style.opacity = '1';
                if (windowsEl._delegHandler) {
                    windowsEl.removeEventListener('click', windowsEl._delegHandler);
                    windowsEl._delegHandler = null;
                }
                bindDirectListeners();
            }
            setStats('-');
        };

        const switchMode = (nextMode) => {
            mode = nextMode;
            modeDirectBtn.className = `btn ${mode === 'direct' ? 'btn-primary' : 'btn-secondary'}`;
            modeDelegBtn.className = `btn ${mode === 'delegation' ? 'btn-primary' : 'btn-secondary'}`;
            renderBuilding();
            write(mode === 'delegation'
                ? 'Mode délégation: 1 seul listener sur le parent (ul).'
                : `Mode direct: 1 listener par fenêtre (${windowCount} listeners).`);
        };

        const onModeDirect = () => switchMode('direct');
        const onModeDeleg = () => switchMode('delegation');
        const onAddWindow = () => {
            windowCount += 1;
            renderBuilding();
            write(`Fenêtre dynamique #${windowCount} ajoutée.`);
        };
        const onReset = () => {
            windowCount = 50;
            switchMode('delegation');
            logEl.textContent = '';
            setStats('-');
        };

        modeDirectBtn.addEventListener('click', onModeDirect);
        modeDelegBtn.addEventListener('click', onModeDeleg);
        addWindowBtn.addEventListener('click', onAddWindow);
        resetBtn.addEventListener('click', onReset);
        window.addEventListener('resize', redrawPathIfNeeded);
        window.addEventListener('scroll', redrawPathIfNeeded, true);

        switchMode('delegation');

        return {
            destroy: () => {
                if (windowsEl._delegHandler) windowsEl.removeEventListener('click', windowsEl._delegHandler);
                directListeners.forEach((off) => off());
                modeDirectBtn.removeEventListener('click', onModeDirect);
                modeDelegBtn.removeEventListener('click', onModeDeleg);
                addWindowBtn.removeEventListener('click', onAddWindow);
                resetBtn.removeEventListener('click', onReset);
                window.removeEventListener('resize', redrawPathIfNeeded);
                window.removeEventListener('scroll', redrawPathIfNeeded, true);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventDelegationStandardisteWidget = EventDelegationStandardisteWidget;
}
