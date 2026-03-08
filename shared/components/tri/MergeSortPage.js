class MergeSortPage extends MergeSortVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.MergeSortPage = MergeSortPage;
}
