class SelectionSortPage extends SortingVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.SelectionSortPage = SelectionSortPage;
}
