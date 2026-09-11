class EventWidgets {
    static getExternalRegistry() {
        if (!this._externalRegistry) {
            this._externalRegistry = {
                'events-multi-listeners': {
                    globalName: 'EventMultiListenersWidget',
                    scriptName: 'event-widgets/multi-listeners.js'
                },
                'events-event-object': {
                    globalName: 'EventObjectWidget',
                    scriptName: 'event-widgets/event-object.js'
                },
                'events-propagation': {
                    globalName: 'EventPropagationWidget',
                    scriptName: 'event-widgets/propagation.js'
                },
                'events-delegation': {
                    globalName: 'EventDelegationWidget',
                    scriptName: 'event-widgets/delegation.js'
                },
                'events-flow-lab': {
                    globalName: 'EventFlowLabWidget',
                    scriptName: 'event-widgets/flow3d.js'
                },
                'events-delegation-standardiste': {
                    globalName: 'EventDelegationStandardisteWidget',
                    scriptName: 'event-widgets/delegation-standardiste.js'
                },
                'events-eventloop-restaurant': {
                    globalName: 'EventLoopRestaurantWidget',
                    scriptName: 'event-widgets/eventloop-restaurant.js'
                },
                'events-catalog': {
                    globalName: 'EventCatalogWidget',
                    scriptName: 'event-widgets/catalog.js'
                }
            };
        }
        return this._externalRegistry;
    }

    static listSupportedTypes() {
        return Object.keys(this.getExternalRegistry());
    }


    static async mount(container, config = {}) {
        if (!container) return null;

        const external = EventWidgets.getExternalRegistry()[config.type];
        if (external) {
            const ok = await EventWidgets.ensureExternalWidgetLoaded(external);
            if (ok && window[external.globalName] && typeof window[external.globalName].mount === 'function') {
                return window[external.globalName].mount(container, config);
            }
        }
        container.classList.add('event-widget');
        container.innerHTML = '<p>Widget d\'evenements non supporte: <code>' +
            EventWidgets.escape(config.type || 'inconnu') +
            '</code>. Types disponibles: ' +
            EventWidgets.listSupportedTypes().map((type) => '<code>' + EventWidgets.escape(type) + '</code>').join(', ') +
            '.</p>';
        return null;
    }

    static ensureExternalWidgetLoaded(external) {
        if (!external || !external.globalName || !external.scriptName) return Promise.resolve(false);
        if (typeof window !== 'undefined' && window[external.globalName]) return Promise.resolve(true);
        if (typeof document === 'undefined') return Promise.resolve(false);

        if (!EventWidgets._externalPromises) EventWidgets._externalPromises = {};
        const key = `${external.globalName}|${external.scriptName}`;
        if (EventWidgets._externalPromises[key]) return EventWidgets._externalPromises[key];

        EventWidgets._externalPromises[key] = new Promise((resolve) => {
            const existing = Array.from(document.scripts).find((s) => (s.src || '').includes(external.scriptName));
            if (existing) {
                if (window[external.globalName]) return resolve(true);
                existing.addEventListener('load', () => resolve(Boolean(window[external.globalName])), { once: true });
                existing.addEventListener('error', () => resolve(false), { once: true });
                return;
            }

            const selfScript = Array.from(document.scripts).find((s) => /shared\/components\/web\/EventWidgets\.js($|\?)/.test(s.src || ''));
            const src = selfScript
                ? selfScript.src.replace(/EventWidgets\.js($|\?.*)/, `${external.scriptName}$1`)
                : `../shared/components/web/${external.scriptName}`;

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve(Boolean(window[external.globalName]));
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });

        return EventWidgets._externalPromises[key];
    }

    static escape(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

}

if (typeof window !== 'undefined') {
    window.EventWidgets = EventWidgets;
}
