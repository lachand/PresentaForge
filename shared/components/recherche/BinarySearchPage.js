class BinarySearchPage extends SearchVisualizer {
    constructor(dataPath) {
        super(dataPath);
        this.algorithm = 'binary';
    }
}

if (typeof window !== 'undefined') {
    window.BinarySearchPage = BinarySearchPage;
}
