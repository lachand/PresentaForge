class BooleSimplificationPage extends BooleSingleWidgetPage {
    constructor(dataPath) {
        super(dataPath, {
            rootId: 'boole-simplifier-widget',
            runtimeName: 'BooleanSimplifierWidget',
            options: {
            defaultExpression: 'A OR (A AND B)'
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.BooleSimplificationPage = BooleSimplificationPage;
}
