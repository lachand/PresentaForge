class AutomateFiniPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.simulationObserver = null;
    }

    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        this.mountSimulationInspector();
    }

    mountSimulationInspector() {
        const panel = document.querySelector('.automaton-layout .panel');
        const modeIndicator = document.getElementById('mode-indicator');
        const editorHelp = document.getElementById('editor-help');
        const wordDisplay = document.getElementById('word-display');
        const resultMsg = document.getElementById('result-msg');
        if (!panel || !modeIndicator || !editorHelp || !wordDisplay || !resultMsg) return;
        if (document.getElementById('dfa-sim-inspector')) return;

        const section = document.createElement('div');
        section.id = 'dfa-sim-inspector';
        section.className = 'panel-section';
        section.innerHTML = `
            <h3>Trace de simulation</h3>
            <p class="info-text"><strong>Mode :</strong> <span id="dfaInspectorMode"></span></p>
            <p class="info-text"><strong>Aide active :</strong> <span id="dfaInspectorHelp"></span></p>
            <p class="info-text"><strong>Progression :</strong> <span id="dfaInspectorProgress"></span></p>
            <p class="info-text"><strong>Statut :</strong> <span id="dfaInspectorStatus"></span></p>
        `;
        panel.appendChild(section);

        const modeEl = section.querySelector('#dfaInspectorMode');
        const helpEl = section.querySelector('#dfaInspectorHelp');
        const progressEl = section.querySelector('#dfaInspectorProgress');
        const statusEl = section.querySelector('#dfaInspectorStatus');

        const refreshInspector = () => {
            const modeText = modeIndicator.classList.contains('visible')
                ? (modeIndicator.textContent.trim() || 'Mode actif')
                : 'Navigation libre (aucun outil de création actif)';
            modeEl.textContent = modeText;

            const helpText = editorHelp.textContent.trim();
            helpEl.textContent = helpText || 'Aucune consigne';

            const chars = Array.from(wordDisplay.querySelectorAll('.word-char'));
            const readCount = chars.filter(ch => ch.classList.contains('read')).length;
            const total = chars.length;
            if (total > 0) {
                progressEl.textContent = `${readCount}/${total} symbole(s) consommé(s)`;
            } else {
                progressEl.textContent = 'Aucun mot en cours';
            }

            const statusText = resultMsg.textContent.trim();
            statusEl.textContent = statusText || 'En attente';
        };

        if (this.simulationObserver) {
            this.simulationObserver.disconnect();
        }
        this.simulationObserver = new MutationObserver(refreshInspector);
        this.simulationObserver.observe(modeIndicator, { childList: true, subtree: true, characterData: true, attributes: true });
        this.simulationObserver.observe(editorHelp, { childList: true, subtree: true, characterData: true });
        this.simulationObserver.observe(wordDisplay, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        this.simulationObserver.observe(resultMsg, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });

        refreshInspector();
    }
}

if (typeof window !== 'undefined') {
    window.AutomateFiniPage = AutomateFiniPage;
}
