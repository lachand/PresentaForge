class StackPage extends StructureVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.StackPage = StackPage;
}
