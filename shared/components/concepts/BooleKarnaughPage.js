class BooleKarnaughPage extends BooleSingleWidgetPage {
    constructor(dataPath) {
        super(dataPath, {
            rootId: 'boole-karnaugh-widget',
            runtimeName: 'BooleanKarnaughWidget',
            options: {
            variables: 4,
            defaultExpression: '(A AND B) OR (NOT C AND D)'
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.BooleKarnaughPage = BooleKarnaughPage;
}
