class InsertionSortPage extends SortingVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.InsertionSortPage = InsertionSortPage;
}
