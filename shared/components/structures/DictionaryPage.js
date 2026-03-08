class DictionaryPage extends DictionaryVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.DictionaryPage = DictionaryPage;
}
