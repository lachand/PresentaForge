class CountingRadixPage extends CountingRadixVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.CountingRadixPage = CountingRadixPage;
}
