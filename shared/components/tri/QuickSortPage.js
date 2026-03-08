class QuickSortPage extends QuickSortVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.QuickSortPage = QuickSortPage;
}
