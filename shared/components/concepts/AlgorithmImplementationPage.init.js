document.addEventListener('DOMContentLoaded', () => {
    const page = new AlgorithmImplementationPage('../data/content/concepts/algorithmie-implementation.json');
    page.init();

    // P2: Lazy-load embedded expert lab iframe (moved from inline HTML script)
    const details = document.querySelector('.algoimpl-python-embed');
    if (details) {
        let loaded = false;
        details.addEventListener('toggle', () => {
            if (!details.open || loaded) return;
            loaded = true;
            const host = document.getElementById('algoimpl-my-python-host');
            const iframe = document.createElement('iframe');
            iframe.src = 'algorithmie-expert.html?embed=mini';
            iframe.style.cssText = 'width:100%;height:680px;border:none;border-radius:var(--radius);';
            iframe.title = 'Éditeur Python';
            host.appendChild(iframe);
        });
    }
});
