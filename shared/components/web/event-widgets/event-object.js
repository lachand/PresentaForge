class EventObjectWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Exemple 2 - Objet Event')}</h3>
            <p>${escapeHtml(config.description || 'Observe target/currentTarget et teste preventDefault/stopPropagation.')}</p>
            <div class="panel">
                <div class="panel" data-role="wrap" style="margin-bottom:0.6rem;">
                    <a href="https://example.com" target="_blank" rel="noreferrer" data-role="link">Lien de test (example.com)</a>
                </div>
                <div class="controls">
                    <label><input type="checkbox" data-role="prevent"> Activer preventDefault()</label>
                    <label><input type="checkbox" data-role="stop"> Activer stopPropagation()</label>
                    <button type="button" class="btn btn-secondary" data-role="clear">Effacer log</button>
                </div>
                <div class="mini-log" data-role="log"></div>
            </div>
        `;

        const wrap = container.querySelector('[data-role="wrap"]');
        const link = container.querySelector('[data-role="link"]');
        const prevent = container.querySelector('[data-role="prevent"]');
        const stop = container.querySelector('[data-role="stop"]');
        const clear = container.querySelector('[data-role="clear"]');
        const logEl = container.querySelector('[data-role="log"]');

        const log = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };

        const onLinkClick = (event) => {
            log(`[LINK] type=${event.type} target=${event.target.tagName} currentTarget=${event.currentTarget.tagName}`);
            if (prevent.checked) {
                event.preventDefault();
                log(' -> preventDefault() applique');
            }
            if (stop.checked) {
                event.stopPropagation();
                log(' -> stopPropagation() applique');
            }
        };
        const onWrapClick = (event) => {
            log(`[WRAP] type=${event.type} target=${event.target.tagName} currentTarget=${event.currentTarget.tagName}`);
        };
        const onClear = () => {
            logEl.textContent = '';
        };

        link.addEventListener('click', onLinkClick);
        wrap.addEventListener('click', onWrapClick);
        clear.addEventListener('click', onClear);

        return {
            destroy: () => {
                link.removeEventListener('click', onLinkClick);
                wrap.removeEventListener('click', onWrapClick);
                clear.removeEventListener('click', onClear);
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventObjectWidget = EventObjectWidget;
}
