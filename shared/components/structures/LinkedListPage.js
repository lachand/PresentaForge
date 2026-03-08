class LinkedListPage extends LinkedListVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.LinkedListPage = LinkedListPage;
}
