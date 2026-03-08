class EventFlowLabWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Event Flow Lab 3D')}</h3>
            <p>${escapeHtml(config.description || 'Le DOM est représenté en calques 3D: le rayon descend (capture), touche la cible, puis l\'impulsion remonte (bubble).')}</p>
            <div class="panel">
                <div class="controls">
                    <label><input type="checkbox" data-role="enable-capture" checked> Capture</label>
                    <label><input type="checkbox" data-role="enable-bubble" checked> Bubble</label>
                    <label><input type="checkbox" data-role="prevent-default"> preventDefault()</label>
                    <label><input type="checkbox" data-role="passive"> passive=true</label>
                    <label>stopPropagation sur
                        <select data-role="stop-layer" class="input" style="min-width:150px;">
                            <option value="none">aucun</option>
                            <option value="card">div.card (milieu)</option>
                            <option value="section">section#app</option>
                            <option value="document">document</option>
                            <option value="target">button.target</option>
                        </select>
                    </label>
                </div>
                <div class="controls">
                    <button type="button" class="btn btn-primary" data-role="trigger">Simuler un clic</button>
                    <button type="button" class="btn btn-secondary" data-role="clear">Réinitialiser</button>
                    <span class="badge-counter" data-role="listener-count">0</span>
                    <span class="flow3d-badge" data-role="state-default">defaultPrevented: non</span>
                    <span class="flow3d-badge" data-role="state-stop">propagation stoppée: non</span>
                </div>
                <div class="flow-lab-grid">
                    <div>
                        <div class="flow3d-scene">
                            <div class="flow3d-world">
                                <div class="flow3d-layer" data-node="document"><strong>document</strong><span>racine</span></div>
                                <div class="flow3d-layer" data-node="section"><strong>section#app</strong><span>parent</span></div>
                                <div class="flow3d-layer" data-node="card"><strong>div.card</strong><span>milieu</span></div>
                                <div class="flow3d-layer" data-node="target"><strong>button.target</strong><span>cible</span></div>
                            </div>
                            <div class="flow3d-beam" data-role="beam"></div>
                            <div class="flow3d-pulse" data-role="pulse"></div>
                        </div>
                        <div class="flow3d-legend">
                            <span class="flow3d-badge"><span class="dot" style="background:var(--tone-cyan-text);"></span>capture</span>
                            <span class="flow3d-badge"><span class="dot" style="background:var(--tone-success-text);"></span>cible</span>
                            <span class="flow3d-badge"><span class="dot" style="background:var(--tone-warning-text);"></span>bubble</span>
                            <span class="flow3d-badge warn"><span class="dot" style="background:var(--tone-danger-text);"></span>stopPropagation</span>
                        </div>
                    </div>
                    <div class="mini-log" data-role="timeline"></div>
                </div>
            </div>
        `;

        const timeline = container.querySelector('[data-role="timeline"]');
        const beam = container.querySelector('[data-role="beam"]');
        const pulse = container.querySelector('[data-role="pulse"]');
        const listenerCount = container.querySelector('[data-role="listener-count"]');
        const stateDefault = container.querySelector('[data-role="state-default"]');
        const stateStop = container.querySelector('[data-role="state-stop"]');
        const enableCapture = container.querySelector('[data-role="enable-capture"]');
        const enableBubble = container.querySelector('[data-role="enable-bubble"]');
        const preventDefault = container.querySelector('[data-role="prevent-default"]');
        const passive = container.querySelector('[data-role="passive"]');
        const stopLayer = container.querySelector('[data-role="stop-layer"]');
        const trigger = container.querySelector('[data-role="trigger"]');
        const clear = container.querySelector('[data-role="clear"]');

        const layers = {
            document: container.querySelector('.flow3d-layer[data-node="document"]'),
            section: container.querySelector('.flow3d-layer[data-node="section"]'),
            card: container.querySelector('.flow3d-layer[data-node="card"]'),
            target: container.querySelector('.flow3d-layer[data-node="target"]')
        };
        const nodeKeyToLabel = {
            document: 'document',
            section: 'section#app',
            card: 'div.card',
            target: 'button.target'
        };

        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        let runToken = 0;
        let stopped = false;
        let defaultPrevented = false;

        const resetLayerClasses = () => {
            Object.values(layers).forEach((layer) => {
                layer.classList.remove('capture-hit', 'bubble-hit', 'target-hit', 'stopped', 'blocked');
            });
            beam.classList.remove('capture', 'bubble');
            pulse.classList.remove('capture', 'bubble');
            pulse.style.opacity = '0';
        };

        const write = (msg) => {
            timeline.textContent += msg + '\n';
            timeline.scrollTop = timeline.scrollHeight;
        };

        const topFor = (key) => {
            const rect = layers[key].getBoundingClientRect();
            const scene = layers[key].closest('.flow3d-scene').getBoundingClientRect();
            return Math.round(rect.top - scene.top + rect.height / 2);
        };

        const movePulseTo = (key, phase) => {
            pulse.classList.remove('capture', 'bubble');
            pulse.classList.add(phase);
            pulse.style.opacity = '1';
            pulse.style.top = `${topFor(key)}px`;
        };

        const setStates = () => {
            stateDefault.textContent = `defaultPrevented: ${defaultPrevented ? 'oui' : 'non'}`;
            stateStop.textContent = `propagation stoppée: ${stopped ? 'oui' : 'non'}`;
            stateDefault.className = `flow3d-badge ${defaultPrevented ? 'ok' : ''}`.trim();
            stateStop.className = `flow3d-badge ${stopped ? 'warn' : ''}`.trim();
        };

        const buildRoute = () => {
            const route = [];
            if (enableCapture.checked) route.push({ phase: 'capture', nodes: ['document', 'section', 'card', 'target'] });
            route.push({ phase: 'target', nodes: ['target'] });
            if (enableBubble.checked) route.push({ phase: 'bubble', nodes: ['card', 'section', 'document'] });
            return route;
        };

        const resetView = () => {
            runToken += 1;
            stopped = false;
            defaultPrevented = false;
            resetLayerClasses();
            timeline.textContent = '';
            const route = buildRoute();
            const listeners = route.reduce((sum, segment) => sum + segment.nodes.length, 0);
            listenerCount.textContent = String(listeners);
            setStates();
            return route;
        };

        const markBlockedAbove = (key) => {
            const order = ['target', 'card', 'section', 'document'];
            const i = order.indexOf(key);
            if (i < 0) return;
            for (let idx = i + 1; idx < order.length; idx += 1) {
                layers[order[idx]].classList.add('blocked');
            }
        };

        const animate = async () => {
            const route = resetView();
            const thisRun = runToken;
            const stopOn = stopLayer.value;

            for (const segment of route) {
                if (thisRun !== runToken) return;
                beam.classList.remove('capture', 'bubble');
                if (segment.phase === 'capture') beam.classList.add('capture');
                if (segment.phase === 'bubble') beam.classList.add('bubble');

                for (const node of segment.nodes) {
                    if (thisRun !== runToken) return;
                    if (stopped) return;

                    movePulseTo(node, segment.phase === 'bubble' ? 'bubble' : 'capture');
                    const layer = layers[node];
                    if (segment.phase === 'capture') layer.classList.add('capture-hit');
                    if (segment.phase === 'target') layer.classList.add('target-hit');
                    if (segment.phase === 'bubble') layer.classList.add('bubble-hit');

                    if (segment.phase === 'target' && preventDefault.checked && !passive.checked) {
                        defaultPrevented = true;
                    }
                    setStates();

                    write(`${segment.phase.toUpperCase()} -> ${nodeKeyToLabel[node]}`);

                    if (segment.phase === 'bubble' && stopOn !== 'none' && node === stopOn) {
                        stopped = true;
                        layer.classList.add('stopped');
                        markBlockedAbove(node);
                        setStates();
                        write(`STOP PROPAGATION sur ${nodeKeyToLabel[node]}: la remontée est interrompue.`);
                        return;
                    }

                    await sleep(250);
                }
            }

            pulse.style.opacity = '0';
            if (defaultPrevented) write('Effet: action par défaut annulée (preventDefault).');
            else write('Effet: action par défaut non annulée.');
        };

        const onTrigger = () => {
            animate();
        };
        const onClear = () => {
            resetView();
        };
        const onConfigChange = () => {
            resetView();
        };

        trigger.addEventListener('click', onTrigger);
        clear.addEventListener('click', onClear);
        enableCapture.addEventListener('change', onConfigChange);
        enableBubble.addEventListener('change', onConfigChange);
        preventDefault.addEventListener('change', onConfigChange);
        passive.addEventListener('change', onConfigChange);
        stopLayer.addEventListener('change', onConfigChange);

        resetView();

        return {
            destroy: () => {
                trigger.removeEventListener('click', onTrigger);
                clear.removeEventListener('click', onClear);
                enableCapture.removeEventListener('change', onConfigChange);
                enableBubble.removeEventListener('change', onConfigChange);
                preventDefault.removeEventListener('change', onConfigChange);
                passive.removeEventListener('change', onConfigChange);
                stopLayer.removeEventListener('change', onConfigChange);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventFlowLabWidget = EventFlowLabWidget;
}
