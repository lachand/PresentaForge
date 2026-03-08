class SequentialSearchPage extends SearchVisualizer {
    constructor(dataPath) {
        super(dataPath);
        this.algorithm = 'sequential';
    }
}

if (typeof window !== 'undefined') {
    window.SequentialSearchPage = SequentialSearchPage;
}
