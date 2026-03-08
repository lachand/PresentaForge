class QueuePage extends StructureVisualizer {
    constructor(dataPath) {
        super(dataPath);
    }

    updateInfo() {
        super.updateInfo();
        const firstEl = document.getElementById('first');
        const lastEl = document.getElementById('last');

        if (firstEl) {
            firstEl.textContent = this.structure.length > 0 ? this.structure[0] : 'aucun';
        }
        if (lastEl) {
            lastEl.textContent = this.structure.length > 0 ? this.structure[this.structure.length - 1] : 'aucun';
        }
    }
}

if (typeof window !== 'undefined') {
    window.QueuePage = QueuePage;
}
