class HashTablePage extends HashTableVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.HashTablePage = HashTablePage;
}
