class BubbleSortPage extends SortingVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.BubbleSortPage = BubbleSortPage;
}
