class SelectorMagicExample {
    constructor(config) {
        this.config = config;
        this.controller = new AbortController();
    }

    init() {
        const { input, btn, root, result, onRefresh } = this.config;
        if (!input || !btn || !root || !result) return;

        const clearHighlights = () => {
            root.querySelectorAll('.magic-highlight').forEach((node) => node.classList.remove('magic-highlight'));
        };

        const describe = (el) => {
            if (!el) return '(null)';
            const id = el.id ? `#${el.id}` : '';
            const cls = el.className ? `.${String(el.className).trim().replace(/\s+/g, '.')}` : '';
            return `<${el.tagName.toLowerCase()}>${id}${cls}`;
        };

        btn.addEventListener('click', () => {
            clearHighlights();
            const selector = input.value.trim();
            if (!selector) {
                result.textContent = 'Saisis un sélecteur CSS.';
                result.className = 'feedback warning';
                return;
            }

            try {
                const found = root.querySelector(selector);
                if (!found) {
                    result.textContent = `Aucun élément trouvé pour: ${selector}`;
                    result.className = 'feedback warning';
                    return;
                }
                found.classList.add('magic-highlight');
                result.textContent = `Trouvé: ${describe(found)}`;
                result.className = 'feedback ok';
                onRefresh();
            } catch (error) {
                result.textContent = `Sélecteur invalide: ${error.message}`;
                result.className = 'feedback bad';
                onRefresh();
            }
        }, { signal: this.controller.signal });
    }

    destroy() {
        this.controller.abort();
    }
}

class ProfileCustomizerExample {
    constructor(config) {
        this.config = config;
        this.controller = new AbortController();
        this.names = ['Alice', 'Karim', 'Louise', 'Mehdi', 'Ines'];
        this.idx = 0;
        this.size = 16;
    }

    init() {
        const { nameNode, card, desc, btnName, btnTheme, btnSize, reset, onRefresh } = this.config;
        if (!nameNode || !card || !desc || !btnName || !btnTheme || !btnSize || !reset) return;

        btnName.addEventListener('click', () => {
            this.idx = (this.idx + 1) % this.names.length;
            nameNode.textContent = this.names[this.idx];
            onRefresh();
        }, { signal: this.controller.signal });

        btnTheme.addEventListener('click', () => {
            card.classList.toggle('dark-mode');
            onRefresh();
        }, { signal: this.controller.signal });

        btnSize.addEventListener('click', () => {
            this.size += 2;
            if (this.size > 24) this.size = 16;
            desc.style.fontSize = `${this.size}px`;
            onRefresh();
        }, { signal: this.controller.signal });

        reset.addEventListener('click', () => {
            this.idx = 0;
            this.size = 16;
            nameNode.textContent = this.names[this.idx];
            desc.style.fontSize = `${this.size}px`;
            card.classList.remove('dark-mode');
            onRefresh();
        }, { signal: this.controller.signal });
    }

    destroy() {
        this.controller.abort();
    }
}

class ClickCounterExample {
    constructor(config) {
        this.config = config;
        this.controller = new AbortController();
        this.count = 0;
    }

    init() {
        const { btn, out, reset, onRefresh } = this.config;
        if (!btn || !out || !reset) return;

        btn.addEventListener('click', () => {
            this.count += 1;
            out.textContent = String(this.count);
            onRefresh();
        }, { signal: this.controller.signal });

        reset.addEventListener('click', () => {
            this.count = 0;
            out.textContent = '0';
            onRefresh();
        }, { signal: this.controller.signal });
    }

    destroy() {
        this.controller.abort();
    }
}

class DomInitiationPage extends ConceptPage {
    async init() {
        await super.init();
        this.exampleVisualizers = {};
        this.exampleControllers = [];
        this.initExampleDomVisualizers();
        this.mountExampleControllers();
    }

    initExampleDomVisualizers() {
        if (typeof window.DomTreeWidget === 'undefined') return;

        const mount = (mountId, targetId, title) => {
            const mountEl = document.getElementById(mountId);
            const targetEl = document.getElementById(targetId);
            if (!mountEl || !targetEl) return null;
            return window.DomTreeWidget.mount(mountEl, {
                title,
                description: 'Snapshot DOM en temps réel de cet exemple interactif.',
                readOnly: true,
                getHtml: () => targetEl.outerHTML
            });
        };

        this.exampleVisualizers.selector = mount('magic-dom-visualizer', 'magic-dom-sample', 'Visualiseur DOM - Exemple 1');
        this.exampleVisualizers.profile = mount('profile-dom-visualizer', 'profile-card', 'Visualiseur DOM - Exemple 2');
        this.exampleVisualizers.counter = mount('counter-dom-visualizer', 'counter-box-root', 'Visualiseur DOM - Exemple 3');
    }

    refreshVisualizer(key) {
        const widget = this.exampleVisualizers ? this.exampleVisualizers[key] : null;
        if (widget && typeof widget.refresh === 'function') widget.refresh();
    }

    mountExampleControllers() {
        this.exampleControllers.forEach((ctrl) => ctrl.destroy?.());
        this.exampleControllers = [];

        const selectorController = this.createSelectorMagicExample();
        const profileController = this.createProfileCustomizerExample();
        const counterController = this.createClickCounterExample();

        [selectorController, profileController, counterController].forEach((ctrl) => {
            if (!ctrl) return;
            ctrl.init();
            this.exampleControllers.push(ctrl);
        });
    }

    createSelectorMagicExample() {
        const input = document.getElementById('magic-selector-input');
        const btn = document.getElementById('magic-find-btn');
        const root = document.getElementById('magic-dom-sample');
        const result = document.getElementById('magic-result');
        if (!input || !btn || !root || !result) return null;

        return new SelectorMagicExample({
            input,
            btn,
            root,
            result,
            onRefresh: () => this.refreshVisualizer('selector')
        });
    }

    createProfileCustomizerExample() {
        const nameNode = document.getElementById('profile-name');
        const card = document.getElementById('profile-card');
        const desc = document.getElementById('profile-desc');
        const btnName = document.getElementById('btn-change-name');
        const btnTheme = document.getElementById('btn-toggle-night');
        const btnSize = document.getElementById('btn-grow-text');
        const reset = document.getElementById('btn-profile-reset');
        if (!nameNode || !card || !desc || !btnName || !btnTheme || !btnSize || !reset) return null;

        return new ProfileCustomizerExample({
            nameNode,
            card,
            desc,
            btnName,
            btnTheme,
            btnSize,
            reset,
            onRefresh: () => this.refreshVisualizer('profile')
        });
    }

    createClickCounterExample() {
        const btn = document.getElementById('counter-btn');
        const out = document.getElementById('counter-value');
        const reset = document.getElementById('counter-reset');
        if (!btn || !out || !reset) return null;

        return new ClickCounterExample({
            btn,
            out,
            reset,
            onRefresh: () => this.refreshVisualizer('counter')
        });
    }

    destroy() {
        if (this.exampleControllers) {
            this.exampleControllers.forEach((ctrl) => ctrl.destroy?.());
            this.exampleControllers = [];
        }
        if (this.exampleVisualizers) {
            Object.values(this.exampleVisualizers).forEach((viz) => viz?.destroy?.());
            this.exampleVisualizers = {};
        }
        super.destroy();
    }
}

if (typeof window !== 'undefined') {
    window.DomInitiationPage = DomInitiationPage;
}
