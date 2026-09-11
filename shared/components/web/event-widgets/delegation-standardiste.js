class EventDelegationStandardisteWidget {
    static mount(container, config = {}) {
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
