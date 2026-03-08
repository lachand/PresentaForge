class RegexPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.RegexPage = RegexPage;
}
