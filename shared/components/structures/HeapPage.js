class HeapPage extends HeapVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.HeapPage = HeapPage;
}
