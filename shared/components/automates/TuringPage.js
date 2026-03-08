class TuringPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.TuringPage = TuringPage;
}
