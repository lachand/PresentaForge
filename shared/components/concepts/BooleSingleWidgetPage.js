class BooleSingleWidgetPage extends ConceptPage {
    constructor(dataPath, widgetConfig = {}) {
        super(dataPath);
        this.widgetConfig = {
            rootId: widgetConfig.rootId || '',
            runtimeName: widgetConfig.runtimeName || '',
            options: widgetConfig.options || {}
        };
        this.widgetInstance = null;
    }

    async init() {
        await super.init();
        this.mountSimulation();
    }

    mountSimulation() {
        this.destroySimulation();

        const { rootId, runtimeName, options } = this.widgetConfig;
        if (!rootId || !runtimeName) return;

        const root = document.getElementById(rootId);
        const runtime = typeof window !== 'undefined' ? window[runtimeName] : null;
        if (!root || !runtime || typeof runtime.mount !== 'function') return;

        this.widgetInstance = runtime.mount(root, options || {});
    }

    destroySimulation() {
        if (this.widgetInstance && typeof this.widgetInstance.destroy === 'function') {
            this.widgetInstance.destroy();
        }
        this.widgetInstance = null;
    }

    destroy() {
        this.destroySimulation();
        if (typeof super.destroy === 'function') super.destroy();
    }
}

if (typeof window !== 'undefined') {
    window.BooleSingleWidgetPage = BooleSingleWidgetPage;
}
