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

    static ensureStyles() {
        if (document.getElementById('event-widgets-styles')) return;
        const style = document.createElement('style');
        style.id = 'event-widgets-styles';
        style.textContent = `
            .event-widget { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--card); padding: 1rem; margin: 1rem 0; }
            .event-widget h3 { margin: 0 0 0.55rem; font-size: 1rem; }
            .event-widget p { margin: 0 0 0.6rem; color: var(--muted); font-size: 0.88rem; }
            .event-widget-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
            .event-widget .panel { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; }
            .event-widget .controls { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.55rem; align-items: center; }
            .event-widget .mini-log {
                min-height: 110px;
                max-height: 220px;
                overflow: auto;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--code-bg);
                color: var(--code-text);
                padding: 0.6rem;
                font-family: var(--font-mono);
                font-size: 0.8rem;
                white-space: pre-wrap;
            }
            .event-widget .badge-counter {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 2.2rem;
                height: 1.8rem;
                padding: 0 0.45rem;
                border-radius: 999px;
                border: 1px solid var(--border);
                background: var(--bg);
                font-family: var(--font-mono);
                font-size: 0.85rem;
                font-weight: 700;
            }
            .event-widget .nested {
                display: grid;
                place-items: center;
                min-height: 220px;
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 1rem;
            }
            .event-widget .box {
                width: 100%;
                max-width: 360px;
                border: 2px solid var(--border);
                border-radius: 10px;
                padding: 0.8rem;
                text-align: center;
            }
            .event-widget .box.parent { background: var(--tone-blue-bg); }
            .event-widget .box.child { background: var(--tone-cyan-bg); margin-top: 0.6rem; }
            .event-widget .box.grandchild { background: var(--tone-success-bg); margin-top: 0.6rem; cursor: pointer; font-weight: 700; }
            .event-widget .probe-zone {
                border: 2px dashed var(--border);
                border-radius: var(--radius-sm);
                padding: 0.8rem;
                min-height: 88px;
                display: grid;
                place-items: center;
                color: var(--muted);
            }
            .event-widget .event-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
            .event-widget .event-table th, .event-widget .event-table td { border: 1px solid var(--border); padding: 0.45rem 0.5rem; text-align: left; }
            .event-widget .event-table th { background: var(--bg); }
            .event-widget .flow-lab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
            .event-widget .flow-scene {
                position: relative;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg);
                min-height: 320px;
                padding: 0.75rem;
            }
            .event-widget .flow-stack { display: grid; gap: 0.45rem; }
            .event-widget .flow-node {
                border: 2px solid var(--border);
                border-radius: 10px;
                padding: 0.55rem 0.7rem;
                background: var(--card);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
            }
            .event-widget .flow-node[data-node="document"] { background: var(--tone-blue-bg); }
            .event-widget .flow-node[data-node="section"] { background: var(--tone-violet-bg); }
            .event-widget .flow-node[data-node="card"] { background: var(--tone-cyan-bg); }
            .event-widget .flow-node[data-node="target"] { background: var(--tone-success-bg); cursor: pointer; }
            .event-widget .flow-node.active {
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.18);
                transform: translateX(4px);
            }
            .event-widget .flow-arrow {
                text-align: center;
                font-size: 0.75rem;
                color: var(--muted);
                font-family: var(--font-mono);
            }
            .event-widget .flow-token {
                position: absolute;
                width: 16px;
                height: 16px;
                border-radius: 999px;
                background: var(--primary);
                box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.2);
                transition: left 180ms ease, top 180ms ease, opacity 120ms ease;
                opacity: 0;
                pointer-events: none;
            }
            .event-widget .flow-route {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg);
                padding: 0.5rem;
                display: grid;
                gap: 0.35rem;
                min-height: 132px;
            }
            .event-widget .flow-step {
                display: grid;
                grid-template-columns: auto auto 1fr;
                gap: 0.5rem;
                align-items: center;
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 0.35rem 0.45rem;
                font-size: 0.8rem;
                background: var(--card);
            }
            .event-widget .flow-step.pending { opacity: 0.8; }
            .event-widget .flow-step.hit { border-color: var(--accent); background: var(--tone-success-bg); }
            .event-widget .flow-step.blocked { border-color: var(--danger); background: var(--tone-danger-bg); text-decoration: line-through; }
            .event-widget .flow-step.stopped { border-color: var(--danger); background: var(--tone-danger-bg); box-shadow: inset 0 0 0 2px rgba(220, 38, 38, 0.18); }
            .event-widget .flow-states { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.55rem 0; }
            .event-widget .flow-state {
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 0.2rem 0.55rem;
                font-size: 0.78rem;
                background: var(--card);
            }
            .event-widget .flow-state.on { border-color: var(--accent); background: var(--tone-success-bg); }
            .event-widget .flow-state.off { border-color: var(--border); background: var(--bg); }
            .event-widget .flow3d-scene {
                position: relative;
                height: 360px;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: radial-gradient(circle at 25% 20%, var(--bg) 0%, var(--card) 45%, var(--bg) 100%);
                overflow: hidden;
                perspective: 900px;
            }
            .event-widget .flow3d-world {
                position: absolute;
                inset: 0;
                transform-style: preserve-3d;
                transform: rotateX(58deg) rotateZ(-26deg);
            }
            .event-widget .flow3d-layer {
                position: absolute;
                left: 50%;
                transform-style: preserve-3d;
                transform: translateX(-50%);
                height: 52px;
                border-radius: 10px;
                border: 2px solid var(--border);
                background: var(--card);
                box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 0.75rem;
                color: var(--text);
                font-size: 0.82rem;
                transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
            }
            .event-widget .flow3d-layer[data-node="document"] { width: 260px; top: 42px; }
            .event-widget .flow3d-layer[data-node="section"] { width: 220px; top: 114px; }
            .event-widget .flow3d-layer[data-node="card"] { width: 185px; top: 186px; }
            .event-widget .flow3d-layer[data-node="target"] { width: 140px; top: 258px; }
            .event-widget .flow3d-layer.capture-hit { border-color: var(--tone-cyan-border); box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.25), 0 8px 16px rgba(15, 23, 42, 0.12); background: var(--tone-cyan-bg); }
            .event-widget .flow3d-layer.bubble-hit { border-color: var(--warning); box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2), 0 8px 16px rgba(15, 23, 42, 0.12); background: var(--tone-warning-bg); }
            .event-widget .flow3d-layer.target-hit { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.22), 0 8px 16px rgba(15, 23, 42, 0.12); background: var(--tone-success-bg); }
            .event-widget .flow3d-layer.stopped { border-color: var(--danger); box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.22), 0 8px 16px rgba(15, 23, 42, 0.12); background: var(--tone-danger-bg); }
            .event-widget .flow3d-layer.blocked { opacity: 0.38; filter: grayscale(0.2); }
            .event-widget .flow3d-beam {
                position: absolute;
                left: 50%;
                top: 16px;
                transform: translateX(-50%);
                width: 6px;
                height: 328px;
                border-radius: 999px;
                background: linear-gradient(to bottom, rgba(59,130,246,0.22), rgba(147,197,253,0.15), rgba(56,189,248,0.2));
            }
            .event-widget .flow3d-beam.capture { background: linear-gradient(to bottom, rgba(14,165,233,0.45), rgba(56,189,248,0.16)); }
            .event-widget .flow3d-beam.bubble { background: linear-gradient(to top, rgba(249,115,22,0.5), rgba(251,146,60,0.16)); }
            .event-widget .flow3d-pulse {
                position: absolute;
                left: 50%;
                top: 18px;
                width: 16px;
                height: 16px;
                transform: translate(-50%, -50%);
                border-radius: 999px;
                background: var(--tone-cyan-text);
                box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.24);
                transition: top 220ms ease, background 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
                opacity: 0;
            }
            .event-widget .flow3d-pulse.capture { background: var(--tone-cyan-text); box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.24); }
            .event-widget .flow3d-pulse.bubble { background: var(--tone-warning-text); box-shadow: 0 0 0 6px rgba(249, 115, 22, 0.24); }
            .event-widget .flow3d-legend {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem;
                margin-top: 0.55rem;
            }
            .event-widget .flow3d-legend .dot {
                width: 11px;
                height: 11px;
                border-radius: 999px;
                display: inline-block;
                margin-right: 0.25rem;
                vertical-align: -1px;
            }
            .event-widget .flow3d-badge {
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 0.2rem 0.55rem;
                font-size: 0.77rem;
                background: var(--card);
            }
            .event-widget .flow3d-badge.ok { border-color: var(--accent); background: var(--tone-success-bg); }
            .event-widget .flow3d-badge.warn { border-color: var(--danger); background: var(--tone-danger-bg); }
            .event-widget .deleg-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.85rem;
                align-items: start;
            }
            .event-widget .deleg-building {
                position: relative;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: linear-gradient(180deg, var(--bg) 0%, var(--card) 100%);
                padding: 0.7rem;
                min-height: 340px;
                overflow: hidden;
            }
            .event-widget .deleg-windows {
                display: grid;
                grid-template-columns: repeat(10, minmax(0, 1fr));
                gap: 0.35rem;
                margin-bottom: 0.5rem;
            }
            .event-widget .deleg-window {
                height: 22px;
                border: 1px solid var(--border);
                border-radius: 5px;
                background: var(--card);
                cursor: pointer;
                font-size: 0.62rem;
                display: grid;
                place-items: center;
                color: var(--muted);
                transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
            }
            .event-widget .deleg-window:hover {
                transform: translateY(-1px);
                border-color: var(--primary);
            }
            .event-widget .deleg-window.targeted {
                border-color: var(--tone-cyan-border);
                background: var(--tone-cyan-bg);
                box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
            }
            .event-widget .deleg-guards {
                display: grid;
                grid-template-columns: repeat(10, minmax(0, 1fr));
                gap: 0.35rem;
            }
            .event-widget .deleg-guard {
                height: 14px;
                border-radius: 999px;
                background: var(--tone-danger-bg);
                border: 1px solid var(--danger);
            }
            .event-widget .deleg-entrance {
                position: relative;
                margin-top: 0.6rem;
                border: 1px dashed var(--border);
                border-radius: 8px;
                padding: 0.5rem;
                background: var(--card);
                min-height: 72px;
            }
            .event-widget .deleg-main-guard {
                display: inline-flex;
                align-items: center;
                gap: 0.3rem;
                border: 1px solid var(--accent);
                border-radius: 999px;
                background: var(--tone-success-bg);
                padding: 0.22rem 0.5rem;
                font-size: 0.75rem;
            }
            .event-widget .deleg-bubble {
                position: absolute;
                right: 0.5rem;
                top: 0.5rem;
                max-width: 70%;
                border: 1px solid var(--tone-cyan-border);
                border-radius: 8px;
                background: var(--tone-cyan-bg);
                padding: 0.35rem 0.45rem;
                font-size: 0.75rem;
                color: var(--text);
                opacity: 0;
                transform: translateY(-4px);
                transition: opacity 160ms ease, transform 160ms ease;
            }
            .event-widget .deleg-bubble.visible {
                opacity: 1;
                transform: translateY(0);
            }
            .event-widget .deleg-svg {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }
            .event-widget .deleg-path {
                stroke: var(--primary);
                stroke-width: 2.5;
                fill: none;
                stroke-linecap: round;
                stroke-dasharray: 7 7;
                animation: delegDash 750ms linear infinite;
                opacity: 0;
                transition: opacity 150ms ease;
            }
            .event-widget .deleg-path.visible { opacity: 1; }
            .event-widget .deleg-stats {
                display: grid;
                gap: 0.35rem;
                margin-top: 0.45rem;
                font-size: 0.8rem;
            }
            .event-widget .loop-grid {
                display: grid;
                grid-template-columns: 1.2fr 0.8fr;
                gap: 0.85rem;
            }
            .event-widget .restaurant {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: linear-gradient(180deg, var(--bg) 0%, var(--card) 100%);
                min-height: 360px;
                padding: 0.65rem;
                position: relative;
                overflow: hidden;
            }
            .event-widget .restaurant.freeze {
                background: linear-gradient(180deg, var(--tone-danger-bg) 0%, rgba(239, 68, 68, 0.22) 100%);
            }
            .event-widget .restaurant-layout {
                display: grid;
                grid-template-columns: 1.15fr 0.75fr 1.1fr;
                grid-template-rows: 1fr auto;
                gap: 0.6rem;
            }
            .event-widget .zone {
                border: 1px dashed var(--border);
                border-radius: 8px;
                background: var(--card);
                padding: 0.45rem;
                min-height: 150px;
            }
            .event-widget .zone h4 {
                margin: 0 0 0.35rem;
                font-size: 0.78rem;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.03em;
            }
            .event-widget .zone.salle { grid-column: 1; grid-row: 1; }
            .event-widget .zone.server { grid-column: 2; grid-row: 1; min-height: 150px; display: grid; place-items: center; }
            .event-widget .zone.kitchen { grid-column: 3; grid-row: 1; }
            .event-widget .zone.pass { grid-column: 1 / -1; grid-row: 2; min-height: 96px; }
            .event-widget .chips {
                display: flex;
                flex-wrap: wrap;
                gap: 0.35rem;
            }
            .event-widget .chip {
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 0.16rem 0.46rem;
                font-size: 0.72rem;
                background: var(--card);
                color: var(--text);
            }
            .event-widget .chip.active {
                border-color: var(--primary);
                background: var(--tone-blue-bg);
                font-weight: 700;
            }
            .event-widget .waiter-area {
                position: relative;
                border: 1px solid var(--border);
                border-radius: 10px;
                background: var(--card);
                min-height: 120px;
                width: 100%;
            }
            .event-widget .waiter {
                position: absolute;
                left: 50%;
                top: 52%;
                transform: translate(-50%, -50%);
                width: 38px;
                height: 38px;
                border-radius: 999px;
                border: 2px solid var(--text);
                background: var(--tone-warning-bg);
                display: grid;
                place-items: center;
                font-size: 1rem;
                transition: transform 280ms ease, border-color 180ms ease, box-shadow 180ms ease;
            }
            .event-widget .waiter.busy {
                transform: translate(-50%, -50%) scale(1.08);
                border-color: var(--danger);
                box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.16);
            }
            .event-widget .waiter.at-salle { transform: translate(-160%, -50%); }
            .event-widget .waiter.at-kitchen { transform: translate(60%, -50%); }
            .event-widget .waiter.at-pass { transform: translate(-50%, 44%); }
            .event-widget .waiter.at-center { transform: translate(-50%, -50%); }
            .event-widget .kitchen-bell {
                display: inline-flex;
                align-items: center;
                gap: 0.3rem;
                border: 1px solid var(--warning);
                border-radius: 999px;
                background: var(--tone-warning-bg);
                padding: 0.2rem 0.5rem;
                font-size: 0.73rem;
                color: var(--tone-warning-text);
            }
            .event-widget .kitchen-bell.on {
                background: var(--tone-warning-bg);
                box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
            }
            .event-widget .loop-stats {
                display: grid;
                gap: 0.35rem;
                font-size: 0.8rem;
                margin-top: 0.45rem;
            }
            .event-widget .loop-stat {
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--card);
                padding: 0.3rem 0.45rem;
            }
            .event-widget .loop-stat.warn {
                border-color: var(--danger);
                background: var(--tone-danger-bg);
            }
            .event-widget .loop-stat.info {
                border-color: var(--tone-cyan-border);
                background: var(--tone-cyan-bg);
            }
            @keyframes delegDash {
                to { stroke-dashoffset: -28; }
            }
            @media (max-width: 980px) {
                .event-widget-grid { grid-template-columns: 1fr; }
                .event-widget .flow-lab-grid { grid-template-columns: 1fr; }
                .event-widget .deleg-grid { grid-template-columns: 1fr; }
                .event-widget .loop-grid { grid-template-columns: 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    static async mount(container, config = {}) {
        if (!container) return null;
        EventWidgets.ensureStyles();

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
