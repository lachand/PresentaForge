class BinaryTreePage extends BinaryTreeVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }
}

if (typeof window !== 'undefined') {
    window.BinaryTreePage = BinaryTreePage;
}
