class DynamiquePage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.DynamiquePage = DynamiquePage;
}
