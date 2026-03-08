class BooleensPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.widgetInstances = [];
        this.widgetPlan = [
            {
                rootId: 'boole-gates-widget',
                runtimeName: 'BooleanGatesWidget',
                options: {}
            },
            {
                rootId: 'boole-expression-widget',
                runtimeName: 'BooleanExpressionPlaygroundWidget',
                options: {
                    variables: ['A', 'B', 'C'],
                    defaultExpression: '(A AND B) OR (NOT C)'
                }
            }
        ];
    }

    async init() {
        await super.init();
        this.mountSimulations();
    }

    mountSimulations() {
        this.destroySimulations();
        this.widgetPlan.forEach((entry) => this.mountWidgetFromConfig(entry));
    }

    mountWidgetFromConfig(entry) {
        if (!entry || !entry.rootId || !entry.runtimeName) return;
        const root = document.getElementById(entry.rootId);
        const runtime = typeof window !== 'undefined' ? window[entry.runtimeName] : null;
        if (!root || !runtime || typeof runtime.mount !== 'function') return;

        const instance = runtime.mount(root, entry.options || {});
        if (instance) this.widgetInstances.push(instance);
    }

    destroySimulations() {
        this.widgetInstances.forEach((widget) => {
            if (widget && typeof widget.destroy === 'function') {
                widget.destroy();
            }
        });
        this.widgetInstances = [];
    }

    destroy() {
        this.destroySimulations();
        if (typeof super.destroy === 'function') super.destroy();
    }
}

if (typeof window !== 'undefined') {
    window.BooleensPage = BooleensPage;
}
