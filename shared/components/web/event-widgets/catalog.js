class EventCatalogWidget {
    static mount(container, config = {}) {
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        };

        container.classList.add('event-widget');
        container.innerHTML = `
            <h3>${escapeHtml(config.title || 'Catalogue des evenements courants')}</h3>
            <p>${escapeHtml(config.description || 'Selectionne une categorie, puis declenche des actions dans la zone de test.')}</p>
            <div class="controls">
                <select data-role="category" class="input" style="max-width:240px;">
                    <option value="mouse">Souris</option>
                    <option value="keyboard">Clavier</option>
                    <option value="form">Formulaire</option>
                    <option value="window">Document/Fenetre</option>
                </select>
                <button type="button" class="btn btn-secondary" data-role="clear">Effacer logs</button>
            </div>
            <div class="event-widget-grid" style="margin-top:0.6rem;">
                <div>
                    <table class="event-table">
                        <thead><tr><th>Evenement</th><th>Description</th></tr></thead>
                        <tbody data-role="body"></tbody>
                    </table>
                </div>
                <div>
                    <div class="probe-zone" data-role="zone" tabindex="0">Zone de test: clique, tape au clavier, modifie les champs ci-dessous.</div>
                    <div class="controls" style="margin-top:0.6rem;">
                        <input data-role="input" class="input" placeholder="Champ input (input/change/focus/blur)">
                        <form data-role="form" style="display:inline-flex; gap:0.5rem; align-items:center;">
                            <button class="btn btn-primary" type="submit">Submit form</button>
                        </form>
                    </div>
                    <div class="mini-log" data-role="log" style="margin-top:0.6rem;"></div>
                </div>
            </div>
        `;

        const byCategory = {
            mouse: [
                { event: 'click', description: 'Clic simple souris' },
                { event: 'dblclick', description: 'Double-clic souris' },
                { event: 'mousedown', description: 'Bouton souris enfonce' },
                { event: 'mouseup', description: 'Bouton souris relache' },
                { event: 'mouseover', description: 'Survol entree' },
                { event: 'mouseout', description: 'Survol sortie' }
            ],
            keyboard: [
                { event: 'keydown', description: 'Touche pressee' },
                { event: 'keyup', description: 'Touche relachee' }
            ],
            form: [
                { event: 'input', description: 'Valeur modifiee en direct' },
                { event: 'change', description: 'Valeur validee/champ quitte' },
                { event: 'focus', description: 'Champ recoit le focus' },
                { event: 'blur', description: 'Champ perd le focus' },
                { event: 'submit', description: 'Soumission formulaire' }
            ],
            window: [
                { event: 'DOMContentLoaded', description: 'DOM pret' },
                { event: 'load', description: 'Ressources chargees' },
                { event: 'scroll', description: 'Defilement' },
                { event: 'resize', description: 'Redimensionnement fenetre' }
            ]
        };

        const category = container.querySelector('[data-role="category"]');
        const body = container.querySelector('[data-role="body"]');
        const clear = container.querySelector('[data-role="clear"]');
        const logEl = container.querySelector('[data-role="log"]');
        const zone = container.querySelector('[data-role="zone"]');
        const input = container.querySelector('[data-role="input"]');
        const form = container.querySelector('[data-role="form"]');

        const log = (msg) => {
            logEl.textContent += msg + '\n';
            logEl.scrollTop = logEl.scrollHeight;
        };
        const renderTable = () => {
            const rows = byCategory[category.value] || [];
            body.innerHTML = rows.map((r) => `<tr><td><code>${escapeHtml(r.event)}</code></td><td>${escapeHtml(r.description)}</td></tr>`).join('');
        };

        const listeners = [
            [zone, 'click', (e) => log(`probeZone click | type=${e.type}`)],
            [zone, 'dblclick', (e) => log(`probeZone dblclick | type=${e.type}`)],
            [zone, 'mouseover', (e) => log(`probeZone mouseover | type=${e.type}`)],
            [zone, 'mouseout', (e) => log(`probeZone mouseout | type=${e.type}`)],
            [zone, 'mousedown', (e) => log(`probeZone mousedown | button=${e.button}`)],
            [zone, 'mouseup', (e) => log(`probeZone mouseup | button=${e.button}`)],
            [zone, 'keydown', (e) => log(`probeZone keydown | key=${e.key} | code=${e.code}`)],
            [zone, 'keyup', (e) => log(`probeZone keyup | key=${e.key} | code=${e.code}`)],
            [input, 'input', (e) => log(`input | value='${e.target.value}'`)],
            [input, 'change', (e) => log(`change | value='${e.target.value}'`)],
            [input, 'focus', () => log('focus sur input')],
            [input, 'blur', () => log('blur sur input')],
            [form, 'submit', (e) => { e.preventDefault(); log('submit intercepte (preventDefault)'); }],
            [window, 'resize', () => log(`window resize | ${window.innerWidth}x${window.innerHeight}`)],
            [category, 'change', renderTable],
            [clear, 'click', () => { logEl.textContent = ''; }]
        ];

        listeners.forEach(([target, event, handler]) => target.addEventListener(event, handler));
        renderTable();
        log('Sonde prete: clique la zone, donne-lui le focus puis tape au clavier.');

        return {
            destroy: () => {
                listeners.forEach(([target, event, handler]) => target.removeEventListener(event, handler));
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.EventCatalogWidget = EventCatalogWidget;
}
