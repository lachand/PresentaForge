class EventLoopRestaurantWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const uid = `loopSpeed_${Math.random().toString(36).slice(2, 9)}`;
        const speedSliderId = `${uid}_slider`;
        const speedLabelId = `${uid}_label`;

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'La métaphore du serveur de restaurant')}</h3>
            <p>${escapeHtml(config.description || 'Le serveur (thread) ne fait qu\'une chose à la fois. Il ne prend un plat au passe-plat (Callback Queue) que si la salle (Call Stack) est vide.')}</p>
            <div class="controls">
                <button type="button" class="btn btn-secondary" data-role="scenario-sync">Scénario 1: Synchrone</button>
                <button type="button" class="btn btn-secondary" data-role="scenario-block">Incident: while(true)</button>
                <button type="button" class="btn btn-primary" data-role="scenario-async">Scénario 2: setTimeout(5000)</button>
                <button type="button" class="btn btn-secondary" data-role="scenario-timeout0">Scénario 3: setTimeout(fn, 0)</button>
                <button type="button" class="btn btn-secondary" data-role="reset">Réinitialiser</button>
            </div>
            <div class="controls">
                <label for="${speedSliderId}">Vitesse de simulation :</label>
                <input type="range" id="${speedSliderId}" class="speed-slider" min="1" max="5" step="1" value="3">
                <span class="speed-label" id="${speedLabelId}">Normal</span>
            </div>
            <div class="loop-grid">
                <div class="restaurant" data-role="restaurant">
                    <div class="restaurant-layout">
                        <div class="zone salle">
                            <h4>Salle (Code / Call Stack)</h4>
                            <div class="chips" data-role="salle"></div>
                        </div>
                        <div class="zone server">
                            <h4>Serveur (Main Thread)</h4>
                            <div class="waiter-area">
                                <div class="waiter at-center" data-role="waiter">🧑‍🍳</div>
                            </div>
                        </div>
                        <div class="zone kitchen">
                            <h4>Cuisine (Web APIs)</h4>
                            <div class="chips" data-role="kitchen"></div>
                            <div style="margin-top:.35rem;" class="kitchen-bell" data-role="bell">🔔 Cloche</div>
                        </div>
                        <div class="zone pass">
                            <h4>Passe-plat (Callback Queue)</h4>
                            <div class="chips" data-role="queue"></div>
                        </div>
                    </div>
                </div>
                <div>
                    <div class="mini-log" data-role="log"></div>
                    <div class="loop-stats">
                        <div class="loop-stat" data-role="stat-ui">UI: fluide</div>
                        <div class="loop-stat" data-role="stat-server">Serveur: libre</div>
                        <div class="loop-stat" data-role="stat-rule">Règle d'or: Queue lue uniquement si Stack vide.</div>
                        <div class="loop-stat" data-role="stat-barrier">Barrière: inactive</div>
                    </div>
                </div>
            </div>
        `;

        const restaurant = container.querySelector('[data-role="restaurant"]');
        const salleEl = container.querySelector('[data-role="salle"]');
        const kitchenEl = container.querySelector('[data-role="kitchen"]');
        const queueEl = container.querySelector('[data-role="queue"]');
        const waiterEl = container.querySelector('[data-role="waiter"]');
        const bellEl = container.querySelector('[data-role="bell"]');
        const logEl = container.querySelector('[data-role="log"]');
        const statUi = container.querySelector('[data-role="stat-ui"]');
        const statServer = container.querySelector('[data-role="stat-server"]');
        const statRule = container.querySelector('[data-role="stat-rule"]');
        const statBarrier = container.querySelector('[data-role="stat-barrier"]');

        const btnSync = container.querySelector('[data-role="scenario-sync"]');
        const btnBlock = container.querySelector('[data-role="scenario-block"]');
        const btnAsync = container.querySelector('[data-role="scenario-async"]');
        const btnTimeout0 = container.querySelector('[data-role="scenario-timeout0"]');
        const btnReset = container.querySelector('[data-role="reset"]');
        const speedCtrl = (typeof OEIUtils !== 'undefined' && OEIUtils.SpeedController)
            ? new OEIUtils.SpeedController(speedSliderId, speedLabelId)
            : null;

        let runToken = 0;
        const state = {
            salle: [],
            kitchen: [],
            queue: [],
            bell: false,
            freeze: false,
            barrier: false,
            busy: false,
            serverPos: 'center'
        };
        const getBaseDelay = () => speedCtrl ? speedCtrl.getDelay() : 500;
        const wait = (factor = 1, min = 80) => sleep(Math.max(min, Math.round(getBaseDelay() * factor)));

        const chip = (text, active = false) => `<span class="chip${active ? ' active' : ''}">${escapeHtml(text)}</span>`;

        const write = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };

        const setServerPos = (pos) => {
            waiterEl.classList.remove('at-salle', 'at-center', 'at-kitchen', 'at-pass');
            waiterEl.classList.add(`at-${pos}`);
            state.serverPos = pos;
        };

        const setBusy = (on) => {
            state.busy = on;
            waiterEl.classList.toggle('busy', on);
        };

        const render = () => {
            salleEl.innerHTML = state.salle.map((c, i) => chip(c, i === 0)).join('');
            kitchenEl.innerHTML = state.kitchen.map((k) => chip(k)).join('');
            queueEl.innerHTML = state.queue.map((q) => chip(q)).join('');
            bellEl.classList.toggle('on', state.bell);

            restaurant.classList.toggle('freeze', state.freeze);
            statUi.textContent = state.freeze ? 'UI: figée (thread bloqué)' : 'UI: fluide';
            statUi.className = `loop-stat ${state.freeze ? 'warn' : ''}`.trim();

            if (state.busy) {
                statServer.textContent = `Serveur: occupé (${state.serverPos})`;
            } else {
                statServer.textContent = 'Serveur: libre';
            }

            if (state.barrier) {
                statBarrier.textContent = 'Barrière: active (Stack non vide -> Queue bloquée)';
                statBarrier.className = 'loop-stat warn';
            } else {
                statBarrier.textContent = 'Barrière: inactive';
                statBarrier.className = 'loop-stat';
            }
        };

        const reset = () => {
            runToken += 1;
            state.salle = [];
            state.kitchen = [];
            state.queue = [];
            state.bell = false;
            state.freeze = false;
            state.barrier = false;
            setServerPos('center');
            setBusy(false);
            logEl.textContent = '';
            statRule.textContent = 'Règle d\'or: Queue lue uniquement si Stack vide.';
            render();
            write('Restaurant prêt.');
        };

        const serveSyncClient = async (runId, label, output) => {
            state.salle.push(label);
            render();
            await wait(0.52, 90);
            if (runId !== runToken) return false;

            setServerPos('salle');
            setBusy(true);
            render();
            write(`${label} -> ${output}`);
            await wait(0.72, 110);
            if (runId !== runToken) return false;

            state.salle.shift();
            setBusy(false);
            setServerPos('center');
            render();
            await wait(0.36, 80);
            return runId === runToken;
        };

        const scenarioSync = async () => {
            reset();
            const runId = runToken;
            write('Scénario 1: Code synchrone (3 console.log).');
            if (!await serveSyncClient(runId, 'Client A', 'Bonjour')) return;
            if (!await serveSyncClient(runId, 'Client B', 'Bonjour')) return;
            if (!await serveSyncClient(runId, 'Client C', 'Bonjour')) return;
            write('Fin du script synchrone: tout est exécuté dans l\'ordre.');
        };

        const scenarioBlock = async () => {
            reset();
            const runId = runToken;
            write('Incident: while(true). Le serveur reste bloqué sur un seul client.');
            state.salle = ['Client infini: while(true)'];
            state.freeze = true;
            state.barrier = true;
            setServerPos('salle');
            setBusy(true);
            render();
            await wait(1.04, 140);
            if (runId !== runToken) return;

            state.salle.push('click bouton', 'scroll', 'input clavier', 'resize');
            render();
            write('La file grossit, UI grisée: plus rien ne répond.');
            await wait(2.4, 260);
            if (runId !== runToken) return;

            state.salle = [];
            state.freeze = false;
            state.barrier = false;
            setBusy(false);
            setServerPos('center');
            render();
            write('Le blocage est levé: le serveur peut reprendre.');
        };

        const scenarioAsync = async () => {
            reset();
            const runId = runToken;
            write('Scénario 2: setTimeout(..., 5000). Délégation vers la cuisine.');

            state.salle.push('Client: setTimeout(Burger, 5000)');
            render();
            await wait(0.52, 90);
            if (runId !== runToken) return;

            setServerPos('salle'); setBusy(true); render();
            await wait(0.44, 90);
            if (runId !== runToken) return;

            setServerPos('kitchen'); render();
            state.kitchen.push('Ticket Burger (5s)');
            await wait(0.52, 90);
            if (runId !== runToken) return;

            state.salle.shift();
            setBusy(false);
            setServerPos('center');
            render();
            write('Ticket remis à la cuisine. Serveur libre immédiatement.');

            state.salle.push('Client suivant #1', 'Client suivant #2');
            render();
            await wait(0.48, 90);
            if (runId !== runToken) return;

            await serveSyncClient(runId, state.salle[0], 'Traitement rapide');
            if (runId !== runToken) return;
            await serveSyncClient(runId, state.salle[0], 'Traitement rapide');
            if (runId !== runToken) return;

            state.kitchen = [];
            state.queue.push('Callback Burger prêt');
            state.bell = true;
            render();
            write('Ding! Le plat est posé sur le passe-plat (Callback Queue).');
            await wait(1, 140);
            if (runId !== runToken) return;

            state.bell = false;
            state.barrier = false;
            setServerPos('pass'); setBusy(true); render();
            write('Salle vide -> le serveur prend la callback en queue.');
            await wait(0.72, 110);
            if (runId !== runToken) return;

            state.queue.shift();
            setBusy(false);
            setServerPos('center');
            render();
            write('Callback exécutée. Cycle terminé sans freeze.');
        };

        const scenarioTimeout0 = async () => {
            reset();
            const runId = runToken;
            write('Scénario 3: A, setTimeout(B, 0), C');

            if (!await serveSyncClient(runId, 'Ligne A', 'Commande Eau')) return;

            state.salle.push('Ligne B: setTimeout(Eau servie, 0)', 'Ligne C: L\'addition');
            render();
            await wait(0.48, 90);
            if (runId !== runToken) return;

            setServerPos('salle'); setBusy(true); render();
            await wait(0.36, 80);
            if (runId !== runToken) return;

            setServerPos('kitchen'); render();
            state.kitchen.push('Ticket Eau (0s)');
            await wait(0.36, 80);
            if (runId !== runToken) return;

            state.salle.shift();
            state.kitchen = [];
            state.queue.push('B: Eau servie');
            state.bell = true;
            state.barrier = true;
            setServerPos('salle');
            render();
            write('Ding instantané. Le plateau est prêt mais la ligne C est encore en cours.');
            statRule.textContent = 'Barrière active: tant que la Stack n\'est pas vide, la Queue attend.';
            await wait(0.72, 110);
            if (runId !== runToken) return;

            await serveSyncClient(runId, state.salle[0], 'L\'addition');
            if (runId !== runToken) return;

            state.bell = false;
            state.barrier = false;
            setServerPos('pass'); setBusy(true); render();
            write('Salle vide: le serveur peut enfin prendre B au passe-plat.');
            await wait(0.72, 110);
            if (runId !== runToken) return;

            state.queue.shift();
            setBusy(false);
            setServerPos('center');
            render();
            write('Ordre final observé: A puis C puis B.');
            statRule.textContent = 'setTimeout(fn, 0) = exécuter dès que le serveur est libre.';
        };

        const onSync = () => scenarioSync();
        const onBlock = () => scenarioBlock();
        const onAsync = () => scenarioAsync();
        const onTimeout0 = () => scenarioTimeout0();
        const onReset = () => reset();

        btnSync.addEventListener('click', onSync);
        btnBlock.addEventListener('click', onBlock);
        btnAsync.addEventListener('click', onAsync);
        btnTimeout0.addEventListener('click', onTimeout0);
        btnReset.addEventListener('click', onReset);

        reset();

        return {
            destroy: () => {
                btnSync.removeEventListener('click', onSync);
                btnBlock.removeEventListener('click', onBlock);
                btnAsync.removeEventListener('click', onAsync);
                btnTimeout0.removeEventListener('click', onTimeout0);
                btnReset.removeEventListener('click', onReset);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventLoopRestaurantWidget = EventLoopRestaurantWidget;
}
