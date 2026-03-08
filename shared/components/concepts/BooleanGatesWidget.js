class BooleanTruthTableView {
    static computeRows(gate) {
        const rows = [];
        if (!gate) return rows;

        if (gate.inputs.length === 1) {
            for (let a = 0; a <= 1; a += 1) {
                rows.push({ A: a, B: 0, result: gate.compute(a) });
            }
            return rows;
        }

        for (let a = 0; a <= 1; a += 1) {
            for (let b = 0; b <= 1; b += 1) {
                rows.push({ A: a, B: b, result: gate.compute(a, b) });
            }
        }
        return rows;
    }

    static render(gate, state = { A: 0, B: 0 }) {
        const rows = BooleanTruthTableView.computeRows(gate);
        const header = gate.inputs.length === 1
            ? `<tr><th>A</th><th>${gate.name}</th></tr>`
            : `<tr><th>A</th><th>B</th><th>${gate.name}</th></tr>`;

        const body = rows.map((row) => {
            const current = gate.inputs.length === 1
                ? row.A === state.A
                : row.A === state.A && row.B === state.B;
            const rowClass = current ? 'boolean-truth-row-current' : '';
            const resultClass = row.result ? 'boolean-result-one' : 'boolean-result-zero';
            if (gate.inputs.length === 1) {
                return `<tr class="${rowClass}"><td>${row.A}</td><td class="${resultClass}">${row.result}</td></tr>`;
            }
            return `<tr class="${rowClass}"><td>${row.A}</td><td>${row.B}</td><td class="${resultClass}">${row.result}</td></tr>`;
        }).join('');

        return `
            <table class="boolean-truth-table">
                <thead>${header}</thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }
}

class BooleanGatesWidget {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.listeners = [];
        this.gateUi = new Map();
        this.gateStates = {};

        this.gates = [
            {
                name: 'AND',
                label: 'ET',
                symbol: 'A AND B',
                inputs: ['A', 'B'],
                compute: (a, b) => (a && b) ? 1 : 0
            },
            {
                name: 'OR',
                label: 'OU',
                symbol: 'A OR B',
                inputs: ['A', 'B'],
                compute: (a, b) => (a || b) ? 1 : 0
            },
            {
                name: 'NOT',
                label: 'NON',
                symbol: 'NOT A',
                inputs: ['A'],
                compute: (a) => a ? 0 : 1
            },
            {
                name: 'XOR',
                label: 'OU exclusif',
                symbol: 'A XOR B',
                inputs: ['A', 'B'],
                compute: (a, b) => (a ^ b) ? 1 : 0
            },
            {
                name: 'NAND',
                label: 'NON-ET',
                symbol: 'NOT (A AND B)',
                inputs: ['A', 'B'],
                compute: (a, b) => (a && b) ? 0 : 1
            },
            {
                name: 'NOR',
                label: 'NON-OU',
                symbol: 'NOT (A OR B)',
                inputs: ['A', 'B'],
                compute: (a, b) => (a || b) ? 0 : 1
            }
        ];

        this.gates.forEach((gate) => {
            this.gateStates[gate.name] = { A: 0, B: 0 };
        });
    }

    static ensureStyles() {
        if (document.getElementById('boolean-gates-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'boolean-gates-widget-styles';
        style.textContent = `
            .boolean-gates-widget { display: grid; gap: 1rem; }
            .boolean-gates-intro {
                border: 1px solid var(--tone-indigo-border);
                background: var(--tone-indigo-bg);
                color: var(--tone-indigo-text);
                border-radius: var(--radius-sm);
                padding: 0.55rem 0.65rem;
                font-size: 0.84rem;
                line-height: 1.45;
            }
            .boolean-gates-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
                gap: 0.8rem;
            }
            .boolean-gate-card {
                position: relative;
                perspective: 1200px;
                min-height: 306px;
                cursor: pointer;
            }
            .boolean-gate-card:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
            .boolean-gate-card-inner {
                position: relative;
                width: 100%;
                min-height: 306px;
                transform-style: preserve-3d;
                transition: transform 280ms ease;
            }
            .boolean-gate-card[data-flipped="1"] .boolean-gate-card-inner {
                transform: rotateY(180deg);
            }
            .boolean-gate-face {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.75rem;
                background: var(--card);
                display: grid;
                gap: 0.55rem;
                min-height: 306px;
                backface-visibility: hidden;
                -webkit-backface-visibility: hidden;
            }
            .boolean-gate-face-back {
                position: absolute;
                inset: 0;
                transform: rotateY(180deg);
                background: var(--bg);
            }
            .boolean-gate-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
            .boolean-gate-name { margin: 0; font-size: 0.92rem; color: var(--primary); }
            .boolean-gate-label { margin: 0; font-size: 0.76rem; color: var(--muted); }
            .boolean-gate-card-hint {
                margin: 0;
                font-size: 0.74rem;
                color: var(--muted);
            }
            .boolean-gate-symbol {
                margin: 0;
                font-family: var(--font-mono);
                font-size: 0.78rem;
                color: var(--muted);
            }
            .boolean-gate-visual {
                display: grid;
                grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center;
                gap: 0.5rem;
                min-height: 88px;
            }
            .boolean-gate-inputs {
                display: grid;
                gap: 0.42rem;
            }
            .boolean-gate-input-row {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 0.35rem;
            }
            .boolean-gate-input-row label {
                font-size: 0.74rem;
                color: var(--muted);
                font-weight: 600;
                width: 14px;
                text-align: center;
            }
            .boolean-toggle {
                width: 26px;
                height: 26px;
                border-radius: 999px;
                border: 1px solid var(--border);
                background: var(--card);
                color: var(--muted);
                font-weight: 700;
                font-family: var(--font-mono);
                cursor: pointer;
            }
            .boolean-toggle:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
            .boolean-toggle[data-value="1"] {
                background: var(--primary);
                border-color: var(--primary);
                color: #fff;
            }
            .boolean-gate-svg-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 88px;
            }
            .boolean-gate-svg-panel {
                border: 1px solid var(--border);
                border-radius: 10px;
                background: var(--bg);
                padding: 0.2rem 0.3rem;
                display: grid;
                justify-items: center;
                gap: 0.15rem;
                transition: border-color 120ms ease, box-shadow 120ms ease;
            }
            .boolean-gate-svg-panel.signal-0 {
                border-color: var(--danger);
            }
            .boolean-gate-svg-panel.signal-1 {
                border-color: var(--accent);
            }
            .boolean-gate-svg-panel.signal-pulse {
                animation: booleanSignalPulse 280ms ease;
            }
            .boolean-gate-svg-label {
                font-size: 0.72rem;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .boolean-gate-svg {
                width: 124px;
                height: 74px;
                display: block;
                color: var(--text);
            }
            .boolean-gate-svg path,
            .boolean-gate-svg line,
            .boolean-gate-svg circle,
            .boolean-gate-svg rect {
                stroke: currentColor;
                stroke-width: 2.2;
                vector-effect: non-scaling-stroke;
                fill: none;
            }
            .boolean-gate-svg .gate-bubble {
                fill: var(--card);
            }
            .boolean-output-wrap {
                display: grid;
                justify-items: center;
                gap: 0.2rem;
            }
            .boolean-output-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
            }
            .boolean-output-label { font-size: 0.76rem; color: var(--muted); }
            .boolean-output-value {
                min-width: 30px;
                text-align: center;
                border-radius: 999px;
                border: 1px solid var(--border);
                padding: 0.15rem 0.5rem;
                font-family: var(--font-mono);
                font-weight: 700;
                color: var(--text);
                background: var(--card);
            }
            .boolean-output-value[data-value="1"] {
                background: var(--tone-success-bg);
                color: var(--tone-success-text);
                border-color: var(--accent);
            }
            .boolean-gate-formula {
                font-family: var(--font-mono);
                font-size: 0.76rem;
                color: var(--text);
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 0.2rem 0.5rem;
                background: var(--card);
                justify-self: start;
            }
            .boolean-gate-table-meta {
                margin: 0;
                font-size: 0.78rem;
                color: var(--text);
                font-weight: 600;
            }
            .boolean-gate-back-table {
                overflow: auto;
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--card);
            }
            .boolean-truth-hint {
                margin: 0 0 0.55rem;
                font-size: 0.78rem;
                color: var(--muted);
            }
            .boolean-truth-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.82rem; }
            .boolean-truth-table th,
            .boolean-truth-table td {
                border: 1px solid var(--border);
                padding: 0.36rem 0.45rem;
                text-align: center;
            }
            .boolean-truth-table th { background: var(--bg); color: var(--text); }
            .boolean-truth-row-current td { background: var(--tone-indigo-bg); }
            .boolean-result-one { color: var(--tone-success-text); font-weight: 700; }
            .boolean-result-zero { color: var(--tone-danger-text); font-weight: 700; }
            @keyframes booleanSignalPulse {
                0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45); }
                100% { box-shadow: 0 0 0 11px rgba(59, 130, 246, 0); }
            }
            @media (max-width: 900px) {
                .boolean-gates-grid {
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                }
            }
            @media (max-width: 640px) {
                .boolean-gate-visual {
                    grid-template-columns: 1fr;
                    justify-items: center;
                    gap: 0.42rem;
                }
                .boolean-gate-inputs {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .boolean-gate-input-row {
                    justify-content: center;
                }
                .boolean-output-wrap {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        BooleanGatesWidget.ensureStyles();
        const widget = new BooleanGatesWidget(container, config);
        widget.init();

        return {
            destroy: () => widget.destroy()
        };
    }

    init() {
        if (!this.container) return;

        this.container.classList.add('boolean-gates-widget');
        this.container.innerHTML = `
            <div class="boolean-gates-intro">
                <strong>Mode d'emploi:</strong> bascule A/B sur chaque porte pour observer la sortie instantanee, puis clique sur la carte (hors boutons d'entree) pour la retourner et afficher sa table de verite.
            </div>
            <div class="boolean-gates-grid" data-role="grid"></div>
        `;

        this.gridEl = this.container.querySelector('[data-role="grid"]');

        this.gates.forEach((gate) => {
            this.renderGateCard(gate);
            this.updateGateOutput(gate.name);
            this.renderTruthTableForGate(gate.name);
        });
    }

    renderGateCard(gate) {
        const tableId = `boolean-truth-${gate.name.toLowerCase()}`;
        const card = document.createElement('div');
        card.className = 'boolean-gate-card';
        card.dataset.flipped = '0';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-pressed', 'false');
        card.setAttribute('aria-expanded', 'false');
        card.setAttribute('aria-label', `Afficher la table de verite de ${gate.name}`);
        card.setAttribute('aria-controls', tableId);

        const cardInner = document.createElement('div');
        cardInner.className = 'boolean-gate-card-inner';

        const front = document.createElement('div');
        front.className = 'boolean-gate-face boolean-gate-face-front';

        const back = document.createElement('div');
        back.className = 'boolean-gate-face boolean-gate-face-back';

        const head = document.createElement('div');
        head.className = 'boolean-gate-head';
        head.innerHTML = `
            <h3 class="boolean-gate-name">${gate.name}</h3>
            <p class="boolean-gate-label">${gate.label}</p>
        `;

        const symbol = document.createElement('p');
        symbol.className = 'boolean-gate-symbol';
        symbol.textContent = gate.symbol;

        const visual = document.createElement('div');
        visual.className = 'boolean-gate-visual';

        const inputs = document.createElement('div');
        inputs.className = 'boolean-gate-inputs';

        const inputButtons = {};
        gate.inputs.forEach((inputName) => {
            const row = document.createElement('div');
            row.className = 'boolean-gate-input-row';
            row.innerHTML = `<label>${inputName}</label>`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'boolean-toggle';
            btn.dataset.value = '0';
            btn.textContent = '0';
            btn.setAttribute('aria-label', `Entree ${inputName} pour ${gate.name}`);
            btn.title = `Basculer l'entree ${inputName}`;

            this.listen(btn, 'click', () => {
                this.gateStates[gate.name][inputName] = this.gateStates[gate.name][inputName] ? 0 : 1;
                btn.dataset.value = String(this.gateStates[gate.name][inputName]);
                btn.textContent = String(this.gateStates[gate.name][inputName]);
                this.updateGateOutput(gate.name);
                this.renderTruthTableForGate(gate.name);
            });

            row.appendChild(btn);
            inputs.appendChild(row);
            inputButtons[inputName] = btn;
        });

        const svgWrap = document.createElement('div');
        svgWrap.className = 'boolean-gate-svg-wrap';
        svgWrap.innerHTML = `
            <div class="boolean-gate-svg-panel">
                ${this.gateSvgMarkup(gate.name)}
                <span class="boolean-gate-svg-label">${gate.label}</span>
            </div>
        `;

        const outputWrap = document.createElement('div');
        outputWrap.className = 'boolean-output-wrap';
        outputWrap.innerHTML = `<span class="boolean-output-label">S</span>`;

        const outputValue = document.createElement('span');
        outputValue.className = 'boolean-output-value';
        outputValue.dataset.value = '0';
        outputValue.textContent = '0';
        outputValue.setAttribute('aria-live', 'polite');
        outputWrap.appendChild(outputValue);

        visual.appendChild(inputs);
        visual.appendChild(svgWrap);
        visual.appendChild(outputWrap);

        const outputRow = document.createElement('div');
        outputRow.className = 'boolean-output-row';
        outputRow.innerHTML = `<span class="boolean-output-label">Sortie courante</span>`;
        outputRow.appendChild(outputValue.cloneNode(true));

        const formula = document.createElement('div');
        formula.className = 'boolean-gate-formula';
        formula.textContent = gate.symbol;

        const flipHint = document.createElement('p');
        flipHint.className = 'boolean-gate-card-hint';
        flipHint.textContent = 'Clique sur la carte pour afficher la table de verite.';

        front.appendChild(head);
        front.appendChild(symbol);
        front.appendChild(visual);
        front.appendChild(formula);
        front.appendChild(outputRow);
        front.appendChild(flipHint);

        back.innerHTML = `
            <div class="boolean-gate-head">
                <h3 class="boolean-gate-name">Table de verite</h3>
                <p class="boolean-gate-label">${gate.name} (${gate.label})</p>
            </div>
            <p class="boolean-gate-table-meta">Table visualisee: ${gate.name} (${gate.label})</p>
            <p class="boolean-truth-hint">La ligne surlignee correspond aux entrees actuellement selectionnees.</p>
            <div class="boolean-gate-back-table" id="${tableId}" data-role="truth-table"></div>
            <p class="boolean-gate-card-hint">Clique de nouveau sur la carte pour revenir a la porte.</p>
        `;

        cardInner.appendChild(front);
        cardInner.appendChild(back);
        card.appendChild(cardInner);

        this.listen(card, 'click', (event) => {
            if (event.target.closest('.boolean-gate-inputs')) return;
            this.toggleGateCard(gate.name);
        });
        this.listen(card, 'keydown', (event) => {
            if (event.target !== card) return;
            if (event.key === 'Escape') {
                if (card.dataset.flipped === '1') {
                    event.preventDefault();
                    this.toggleGateCard(gate.name, false);
                }
                return;
            }
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            this.toggleGateCard(gate.name);
        });

        this.gridEl.appendChild(card);
        this.gateUi.set(gate.name, {
            card,
            svgPanel: svgWrap.querySelector('.boolean-gate-svg-panel'),
            outputValue,
            outputValueInline: outputRow.querySelector('.boolean-output-value'),
            inputButtons,
            truthTableEl: back.querySelector('[data-role="truth-table"]')
        });
    }

    gateSvgMarkup(gateName) {
        switch (gateName) {
            case 'AND':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M30,8 L58,8 A27,27 0 0,1 58,62 L30,62 Z"/>
                        <line x1="4" y1="20" x2="30" y2="20"/>
                        <line x1="4" y1="50" x2="30" y2="50"/>
                        <line x1="84" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            case 'NAND':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M30,8 L58,8 A27,27 0 0,1 58,62 L30,62 Z"/>
                        <circle class="gate-bubble" cx="89" cy="35" r="5.5"/>
                        <line x1="4" y1="20" x2="30" y2="20"/>
                        <line x1="4" y1="50" x2="30" y2="50"/>
                        <line x1="95" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            case 'OR':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M30,8 Q45,35 30,62 Q63,62 85,35 Q63,8 30,8 Z"/>
                        <line x1="4" y1="20" x2="32" y2="20"/>
                        <line x1="4" y1="50" x2="32" y2="50"/>
                        <line x1="85" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            case 'NOR':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M30,8 Q45,35 30,62 Q63,62 85,35 Q63,8 30,8 Z"/>
                        <circle class="gate-bubble" cx="90" cy="35" r="5.5"/>
                        <line x1="4" y1="20" x2="32" y2="20"/>
                        <line x1="4" y1="50" x2="32" y2="50"/>
                        <line x1="96" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            case 'XOR':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M36,8 Q51,35 36,62 Q69,62 91,35 Q69,8 36,8 Z"/>
                        <path d="M25,8 Q40,35 25,62"/>
                        <line x1="4" y1="20" x2="27" y2="20"/>
                        <line x1="4" y1="50" x2="27" y2="50"/>
                        <line x1="91" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            case 'NOT':
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M32,14 L76,35 L32,56 Z"/>
                        <circle class="gate-bubble" cx="82" cy="35" r="5.5"/>
                        <line x1="4" y1="35" x2="32" y2="35"/>
                        <line x1="88" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
            default:
                return `
                    <svg class="boolean-gate-svg" viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="30" y="15" width="56" height="40" rx="6"/>
                        <line x1="4" y1="20" x2="30" y2="20"/>
                        <line x1="4" y1="50" x2="30" y2="50"/>
                        <line x1="86" y1="35" x2="116" y2="35"/>
                    </svg>
                `;
        }
    }

    findGate(name) {
        return this.gates.find((gate) => gate.name === name) || null;
    }

    computeGateOutput(gateName) {
        const gate = this.findGate(gateName);
        if (!gate) return 0;

        const state = this.gateStates[gateName] || { A: 0, B: 0 };
        const a = state.A ? 1 : 0;
        const b = state.B ? 1 : 0;
        return gate.inputs.length === 1 ? gate.compute(a) : gate.compute(a, b);
    }

    updateGateOutput(gateName) {
        const result = this.computeGateOutput(gateName);
        const ui = this.gateUi.get(gateName);
        if (!ui) return;

        ui.outputValue.dataset.value = String(result);
        ui.outputValue.textContent = String(result);
        if (ui.outputValueInline) {
            ui.outputValueInline.dataset.value = String(result);
            ui.outputValueInline.textContent = String(result);
        }
        if (ui.svgPanel) {
            ui.svgPanel.classList.remove('signal-0', 'signal-1', 'signal-pulse');
            ui.svgPanel.classList.add(result ? 'signal-1' : 'signal-0');
            void ui.svgPanel.offsetWidth;
            ui.svgPanel.classList.add('signal-pulse');
        }
    }

    renderTruthTableForGate(gateName) {
        const gate = this.findGate(gateName);
        const ui = this.gateUi.get(gateName);
        if (!gate || !ui || !ui.truthTableEl) return;
        const state = this.gateStates[gate.name] || { A: 0, B: 0 };
        ui.truthTableEl.innerHTML = BooleanTruthTableView.render(gate, state);
    }

    toggleGateCard(gateName, forceState = null) {
        const ui = this.gateUi.get(gateName);
        if (!ui || !ui.card) return;

        const isFlipped = ui.card.dataset.flipped === '1';
        const nextState = forceState == null
            ? (isFlipped ? '0' : '1')
            : (forceState ? '1' : '0');
        ui.card.dataset.flipped = nextState;
        ui.card.setAttribute('aria-pressed', nextState === '1' ? 'true' : 'false');
        ui.card.setAttribute('aria-expanded', nextState === '1' ? 'true' : 'false');
        ui.card.setAttribute('aria-label', nextState === '1'
            ? `Afficher la porte ${gateName}`
            : `Afficher la table de verite de ${gateName}`);
    }

    listen(target, eventName, handler) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(eventName, handler);
        this.listeners.push(() => target.removeEventListener(eventName, handler));
    }

    destroy() {
        this.listeners.forEach((off) => off());
        this.listeners = [];
    }
}

class BooleanExpressionPlaygroundWidget {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.listeners = [];
        this.variables = (Array.isArray(config.variables) && config.variables.length
            ? config.variables
            : ['A', 'B', 'C'])
            .map((name) => String(name).toUpperCase());

        this.variableValues = {};
        this.variables.forEach((name) => {
            this.variableValues[name] = 0;
        });

        this.currentAst = null;
        this.currentExpression = config.defaultExpression || '(A AND B) OR (NOT C)';
        this.inputDebounceHandle = null;
    }

    static ensureStyles() {
        if (document.getElementById('boolean-expression-playground-styles')) return;

        const style = document.createElement('style');
        style.id = 'boolean-expression-playground-styles';
        style.textContent = `
            .boolean-expression-widget { display: grid; gap: 0.75rem; }
            .boolean-expression-input-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.55rem;
                align-items: center;
            }
            .boolean-expression-input-row .input { flex: 1; min-width: 260px; }
            .boolean-expression-input-row .btn { min-width: 116px; }
            .boolean-expression-legend { color: var(--muted); font-size: 0.82rem; margin: 0; }
            .boolean-expression-note {
                color: var(--tone-indigo-text);
                background: var(--tone-indigo-bg);
                border: 1px solid var(--tone-indigo-border);
                border-radius: var(--radius-sm);
                font-size: 0.8rem;
                padding: 0.4rem 0.5rem;
                margin: 0;
            }
            .boolean-expression-vars {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }
            .boolean-expression-var {
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 0.2rem 0.5rem;
                background: var(--card);
            }
            .boolean-expression-var label { font-size: 0.78rem; color: var(--muted); }
            .boolean-expression-var button {
                width: 26px;
                height: 26px;
                border-radius: 999px;
                border: 1px solid var(--border);
                font-family: var(--font-mono);
                font-weight: 700;
                background: var(--card);
                color: var(--text);
                cursor: pointer;
            }
            .boolean-expression-var button:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
            .boolean-expression-var button[data-value="1"] {
                background: var(--primary);
                border-color: var(--primary);
                color: #fff;
            }
            .boolean-expression-result {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 0.55rem 0.65rem;
                background: var(--bg);
                display: grid;
                gap: 0.35rem;
            }
            .boolean-expression-result-line {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.6rem;
                flex-wrap: wrap;
            }
            .boolean-expression-badge {
                display: inline-block;
                min-width: 34px;
                text-align: center;
                border-radius: 999px;
                border: 1px solid var(--border);
                padding: 0.15rem 0.55rem;
                font-family: var(--font-mono);
                font-weight: 700;
                color: var(--muted);
                background: var(--card);
            }
            .boolean-expression-badge[data-value="1"] {
                color: var(--tone-success-text);
                border-color: var(--accent);
                background: var(--tone-success-bg);
            }
            .boolean-expression-error {
                color: var(--tone-danger-text);
                background: var(--tone-danger-bg);
                border: 1px solid var(--danger);
                border-radius: var(--radius-sm);
                padding: 0.45rem 0.55rem;
                font-size: 0.82rem;
            }
            .boolean-expression-table-wrap { overflow-x: auto; }
            .boolean-expression-table {
                width: 100%;
                border-collapse: collapse;
                font-family: var(--font-mono);
                font-size: 0.8rem;
            }
            .boolean-expression-table th,
            .boolean-expression-table td {
                border: 1px solid var(--border);
                padding: 0.34rem 0.45rem;
                text-align: center;
            }
            .boolean-expression-table th { background: var(--bg); }
            .boolean-expression-table tr.current td { background: var(--tone-indigo-bg); }
            @media (max-width: 640px) {
                .boolean-expression-input-row {
                    display: grid;
                    grid-template-columns: 1fr;
                }
                .boolean-expression-input-row .input {
                    min-width: 100%;
                }
                .boolean-expression-input-row .btn {
                    width: 100%;
                }
                .boolean-expression-result-line {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        BooleanExpressionPlaygroundWidget.ensureStyles();
        const widget = new BooleanExpressionPlaygroundWidget(container, config);
        widget.init();

        return {
            destroy: () => widget.destroy()
        };
    }

    init() {
        if (!this.container) return;

        this.container.classList.add('boolean-expression-widget');
        this.container.innerHTML = `
            <div class="boolean-expression-input-row">
                <input type="text" class="input" data-role="input" placeholder="Ex: (A AND B) OR (NOT C)">
                <button type="button" class="btn btn-primary" data-role="evaluate">Evaluer</button>
            </div>
            <p class="boolean-expression-legend">
                Operateurs supportes: AND, OR, NOT, XOR, NAND, NOR, parentheses, constantes 0/1.
            </p>
            <p class="boolean-expression-note">
                Astuce: modifie les variables A/B/C pour verifier un cas precis, puis controle la ligne surlignee dans la table.
            </p>
            <div class="boolean-expression-vars" data-role="vars"></div>
            <div class="boolean-expression-result">
                <div class="boolean-expression-result-line"><strong>Expression normalisee:</strong> <span data-role="normalized"></span></div>
                <div class="boolean-expression-result-line"><strong>Resultat courant:</strong> <span class="boolean-expression-badge" data-role="result" data-value="0">0</span></div>
            </div>
            <div data-role="error"></div>
            <div class="boolean-expression-table-wrap" data-role="table"></div>
        `;

        this.inputEl = this.container.querySelector('[data-role="input"]');
        this.evalBtn = this.container.querySelector('[data-role="evaluate"]');
        this.varsEl = this.container.querySelector('[data-role="vars"]');
        this.normalizedEl = this.container.querySelector('[data-role="normalized"]');
        this.resultEl = this.container.querySelector('[data-role="result"]');
        this.errorEl = this.container.querySelector('[data-role="error"]');
        this.tableEl = this.container.querySelector('[data-role="table"]');

        this.inputEl.value = this.currentExpression;
        this.renderVariableToggles();

        this.listen(this.evalBtn, 'click', () => this.evaluateExpression());
        this.listen(this.inputEl, 'keydown', (event) => {
            if (event.key === 'Enter') {
                this.evaluateExpression();
            }
        });

        this.listen(this.inputEl, 'input', () => {
            clearTimeout(this.inputDebounceHandle);
            this.inputDebounceHandle = setTimeout(() => this.evaluateExpression(), 250);
        });

        this.evaluateExpression();
    }

    renderVariableToggles() {
        this.varsEl.innerHTML = '';

        this.variables.forEach((name) => {
            const wrap = document.createElement('div');
            wrap.className = 'boolean-expression-var';
            wrap.innerHTML = `<label>${name}</label>`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.value = String(this.variableValues[name] || 0);
            btn.textContent = String(this.variableValues[name] || 0);

            this.listen(btn, 'click', () => {
                this.variableValues[name] = this.variableValues[name] ? 0 : 1;
                btn.dataset.value = String(this.variableValues[name]);
                btn.textContent = String(this.variableValues[name]);
                this.updateCurrentResult();
                this.renderTruthTable();
            });

            wrap.appendChild(btn);
            this.varsEl.appendChild(wrap);
        });
    }

    ensureVariables(names) {
        const missing = names.filter((name) => !this.variables.includes(name));
        if (!missing.length) return;

        missing.forEach((name) => {
            this.variables.push(name);
            this.variableValues[name] = 0;
        });

        this.variables.sort((a, b) => a.localeCompare(b));
        this.renderVariableToggles();
    }

    evaluateExpression() {
        const expr = String(this.inputEl.value || '').trim();
        if (!expr) {
            this.currentAst = null;
            this.currentExpression = '';
            this.normalizedEl.textContent = '--';
            this.errorEl.innerHTML = '<div class="boolean-expression-error">Saisissez une expression.</div>';
            this.resultEl.textContent = '0';
            this.resultEl.dataset.value = '0';
            this.tableEl.innerHTML = '';
            return;
        }

        try {
            const ast = BooleanExpressionEngine.parse(expr);
            const used = [...BooleanExpressionEngine.collectVariables(ast)];
            this.ensureVariables(used);

            this.currentAst = ast;
            this.currentExpression = expr;
            this.normalizedEl.textContent = BooleanExpressionEngine.nodeToExpression(ast) || '--';
            this.errorEl.innerHTML = '';

            this.updateCurrentResult();
            this.renderTruthTable();
        } catch (error) {
            this.currentAst = null;
            this.normalizedEl.textContent = '--';
            this.tableEl.innerHTML = '';
            this.resultEl.textContent = '0';
            this.resultEl.dataset.value = '0';
            this.errorEl.innerHTML = `<div class="boolean-expression-error">${this.escapeHtml(error.message || String(error))}</div>`;
        }
    }

    currentAssignment() {
        const assignment = {};
        this.variables.forEach((name) => {
            assignment[name] = this.variableValues[name] ? 1 : 0;
        });
        return assignment;
    }

    updateCurrentResult() {
        if (!this.currentAst) return;

        const result = BooleanExpressionEngine.evaluate(this.currentAst, this.currentAssignment());
        this.resultEl.dataset.value = String(result);
        this.resultEl.textContent = String(result);
    }

    renderTruthTable() {
        if (!this.currentAst) {
            this.tableEl.innerHTML = '';
            return;
        }

        const used = BooleanExpressionEngine.normalizeVariables([...BooleanExpressionEngine.collectVariables(this.currentAst)]);
        const table = BooleanExpressionEngine.generateTruthTable(this.currentAst, used);
        const current = this.currentAssignment();

        const head = table.variables.map((name) => `<th>${name}</th>`).join('') + '<th>R</th>';
        const body = table.rows.map((row) => {
            const isCurrent = table.variables.every((name) => Number(row.assignment[name]) === Number(current[name] || 0));
            const cls = isCurrent ? 'current' : '';
            const values = table.variables.map((name) => `<td>${row.assignment[name]}</td>`).join('');
            const resultClass = row.result ? 'boolean-result-one' : 'boolean-result-zero';
            return `<tr class="${cls}">${values}<td class="${resultClass}">${row.result}</td></tr>`;
        }).join('');

        this.tableEl.innerHTML = `
            <table class="boolean-expression-table">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    listen(target, eventName, handler) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(eventName, handler);
        this.listeners.push(() => target.removeEventListener(eventName, handler));
    }

    destroy() {
        clearTimeout(this.inputDebounceHandle);
        this.inputDebounceHandle = null;
        this.listeners.forEach((off) => off());
        this.listeners = [];
    }
}

if (typeof window !== 'undefined') {
    window.BooleanGatesWidget = BooleanGatesWidget;
    window.BooleanExpressionPlaygroundWidget = BooleanExpressionPlaygroundWidget;
}
