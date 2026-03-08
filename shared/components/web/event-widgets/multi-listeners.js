class EventMultiListenersWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Exemple 1 - Plusieurs listeners')}</h3>
            <p>${escapeHtml(config.description || 'Un clic déclenche plusieurs handlers distincts.')}</p>
            <div class="panel">
                <div class="controls">
                    <button type="button" class="btn btn-primary" data-role="click">Cliquer</button>
                    <button type="button" class="btn btn-secondary" data-role="reset">Réinitialiser</button>
                </div>
                <div class="controls" style="justify-content:flex-start;">
                    <span>Listener A <span data-role="a" class="badge-counter">0</span></span>
                    <span>Listener B <span data-role="b" class="badge-counter">0</span></span>
                    <span>Listener C <span data-role="c" class="badge-counter">0</span></span>
                </div>
            </div>
        `;

        const btn = container.querySelector('[data-role="click"]');
        const reset = container.querySelector('[data-role="reset"]');
        const a = container.querySelector('[data-role="a"]');
        const b = container.querySelector('[data-role="b"]');
        const c = container.querySelector('[data-role="c"]');

        const inc = (el) => () => { el.textContent = String(Number(el.textContent) + 1); };
        const onA = inc(a);
        const onB = inc(b);
        const onC = inc(c);
        btn.addEventListener('click', onA);
        btn.addEventListener('click', onB);
        btn.addEventListener('click', onC);

        const onReset = () => {
            a.textContent = '0';
            b.textContent = '0';
            c.textContent = '0';
        };
        reset.addEventListener('click', onReset);

        return {
            destroy: () => {
                btn.removeEventListener('click', onA);
                btn.removeEventListener('click', onB);
                btn.removeEventListener('click', onC);
                reset.removeEventListener('click', onReset);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventMultiListenersWidget = EventMultiListenersWidget;
}
