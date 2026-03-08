class EventDelegationWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Exemple 4 - Delegation d\'evenements')}</h3>
            <p>${escapeHtml(config.description || 'Un listener unique sur le parent gere aussi les elements ajoutes dynamiquement.')}</p>
            <div class="panel">
                <div class="controls">
                    <button type="button" class="btn btn-secondary" data-role="add">Ajouter un element</button>
                    <button type="button" class="btn btn-secondary" data-role="reset">Reinitialiser</button>
                </div>
                <ul data-role="list" class="card" style="list-style:none; padding:0.5rem; margin:0;"></ul>
                <div class="mini-log" data-role="log" style="margin-top:0.6rem;"></div>
            </div>
        `;

        const list = container.querySelector('[data-role="list"]');
        const add = container.querySelector('[data-role="add"]');
        const reset = container.querySelector('[data-role="reset"]');
        const logEl = container.querySelector('[data-role="log"]');

        let seq = 1;
        const log = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };

        const addItem = () => {
            const li = document.createElement('li');
            li.style.padding = '0.45rem 0.5rem';
            li.style.borderBottom = '1px solid var(--border)';
            li.innerHTML = `<button class="btn btn-secondary" data-role="item" style="min-width:auto;">Item dynamique #${seq++}</button>`;
            list.appendChild(li);
        };

        const onListClick = (event) => {
            const btn = event.target.closest('[data-role="item"]');
            if (!btn || !list.contains(btn)) return;
            list.querySelectorAll('[data-role="item"]').forEach((n) => {
                n.style.outline = 'none';
                n.style.opacity = '0.85';
            });
            btn.style.outline = '2px solid var(--primary)';
            btn.style.opacity = '1';
            log(`Clic traite par delegation sur: ${btn.textContent.trim()}`);
        };
        const onAdd = () => addItem();
        const onReset = () => {
            seq = 1;
            list.innerHTML = '';
            logEl.textContent = '';
            addItem();
            addItem();
        };

        list.addEventListener('click', onListClick);
        add.addEventListener('click', onAdd);
        reset.addEventListener('click', onReset);
        addItem();
        addItem();

        return {
            destroy: () => {
                list.removeEventListener('click', onListClick);
                add.removeEventListener('click', onAdd);
                reset.removeEventListener('click', onReset);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventDelegationWidget = EventDelegationWidget;
}
