class EventPropagationWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Exemple 3 - Propagation capture/bulles')}</h3>
            <p>${escapeHtml(config.description || 'Clique la boite interne et observe l\'ordre d\'execution.')}</p>
            <div class="panel">
                <div class="controls">
                    <label><input type="checkbox" data-role="capture"> Activer listeners en capture</label>
                    <button type="button" class="btn btn-secondary" data-role="rebind">Rebind listeners</button>
                    <button type="button" class="btn btn-secondary" data-role="clear">Effacer log</button>
                </div>
                <div class="nested" data-role="host"></div>
                <div class="mini-log" data-role="log" style="margin-top:0.6rem;"></div>
            </div>
        `;

        const capture = container.querySelector('[data-role="capture"]');
        const rebind = container.querySelector('[data-role="rebind"]');
        const clear = container.querySelector('[data-role="clear"]');
        const host = container.querySelector('[data-role="host"]');
        const logEl = container.querySelector('[data-role="log"]');

        const log = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };

        let cleanup = [];
        const bind = () => {
            cleanup.forEach((fn) => fn());
            cleanup = [];

            const useCapture = capture.checked;
            host.innerHTML = `
                <div data-role="parent" class="box parent">Parent
                    <div data-role="child" class="box child">Enfant
                        <div data-role="grand" class="box grandchild">Petit-enfant (clique)</div>
                    </div>
                </div>
            `;

            const parent = host.querySelector('[data-role="parent"]');
            const child = host.querySelector('[data-role="child"]');
            const grand = host.querySelector('[data-role="grand"]');

            const mk = (name) => (event) => {
                log(`${useCapture ? 'CAPTURE' : 'BUBBLE'} -> ${name} | target=${event.target.getAttribute('data-role')}`);
            };
            const onParent = mk('parent');
            const onChild = mk('child');
            const onGrand = mk('grandchild');

            parent.addEventListener('click', onParent, useCapture);
            child.addEventListener('click', onChild, useCapture);
            grand.addEventListener('click', onGrand, useCapture);

            cleanup.push(() => parent.removeEventListener('click', onParent, useCapture));
            cleanup.push(() => child.removeEventListener('click', onChild, useCapture));
            cleanup.push(() => grand.removeEventListener('click', onGrand, useCapture));

            log(`Listeners rebind en mode ${useCapture ? 'capture' : 'bubbles'}\n`);
        };

        const onRebind = () => bind();
        const onCaptureChange = () => bind();
        const onClear = () => { logEl.textContent = ''; };

        rebind.addEventListener('click', onRebind);
        capture.addEventListener('change', onCaptureChange);
        clear.addEventListener('click', onClear);
        bind();

        return {
            destroy: () => {
                cleanup.forEach((fn) => fn());
                rebind.removeEventListener('click', onRebind);
                capture.removeEventListener('change', onCaptureChange);
                clear.removeEventListener('click', onClear);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventPropagationWidget = EventPropagationWidget;
}
