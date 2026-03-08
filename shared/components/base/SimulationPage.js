/**
 * SimulationPage - Classe de base pour toutes les pages de simulation
 *
 * Cette classe abstraite fournit les fonctionnalités communes :
 * - Chargement des données JSON
 * - Rendu du cours
 * - Génération des contrôles
 * - Génération du pseudocode
 * - Gestion du SpeedController
 * - Méthodes utilitaires (highlightLine, etc.)
 *
 * Les sous-classes doivent implémenter :
 * - reset() : Réinitialiser la simulation
 * - doStep() : Exécuter une étape (optionnel pour simulations pas-à-pas)
 * - render() : Mettre à jour l'affichage
 */
const SimulationPageBase = typeof ConceptPage !== 'undefined'
    ? ConceptPage
    : class {
        constructor(dataPath, options = {}) {
            this.dataPath = dataPath;
            this.courseContainerId = options.courseContainerId || 'course-container';
            this.pageTitleId = options.pageTitleId || null;
            this.pageTitlePrefix = options.pageTitlePrefix || '';
            this.strictLoading = options.strictLoading === true;
            this.data = null;
        }

        async loadData() {
            if (!this.dataPath) return;
            const response = await fetch(this.dataPath);
            if (!response.ok) {
                throw new Error('HTTP error ' + response.status);
            }
            this.data = await response.json();
        }

        applyMetadata() {
            if (!this.data || !this.data.metadata) return;

            if (this.data.metadata.title) {
                document.title = this.data.metadata.title + ' — Outils Enseignement';
            }

            if (this.pageTitleId && this.data.metadata.title) {
                const titleEl = document.getElementById(this.pageTitleId);
                if (titleEl) {
                    titleEl.textContent = this.pageTitlePrefix + this.data.metadata.title;
                }
            }
        }

        renderCourse() {
            if (!this.data || !this.data.course || typeof CourseRenderer === 'undefined') return;
            const container = document.getElementById(this.courseContainerId);
            if (!container) return;
            const renderer = new CourseRenderer(this.data.course);
            container.innerHTML = renderer.render();
        }
    };

class SimulationPage extends SimulationPageBase {
    /**
     * @param {string} dataPath - Chemin vers le fichier JSON de données
     */
    constructor(dataPath) {
        super(dataPath, {
            strictLoading: true,
            pageTitleId: 'page-title',
            pageTitlePrefix: 'Visualisation : '
        });
        this.dataPath = dataPath;
        this.state = {
            running: false,
            phase: 'idle',
            stepCount: 0
        };
        this.speedCtrl = null;
        this.lastHighlightedLineId = null;

        this.learning = {
            mounted: false,
            selectedLineId: null
        };
        this.fallbackInspectorController = null;
        this.supportInspectorContainerIds = [];
    }

    /**
     * Initialise la page de simulation
     * Charge les données, configure le cours, les contrôles, le pseudocode
     */
    async init() {
        try {
            this.destroy();
            await this.loadData();
            this.applyMetadata();
            await ConceptPage._loadKaTeX();
            await this.setupCourse();
            this._renderMath();
            this.setupControls();
            this.setupPseudocode();
            this.setupSpeedController();
            this.reset();
            this.setupLearningTools();
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            alert('Erreur lors du chargement de la page. Vérifiez la console pour plus de détails.');
        }
    }

    /**
     * Configure et affiche le cours depuis les données JSON
     */
    async setupCourse() {
        if (typeof this.renderUnifiedContent === 'function' && this.hasUnifiedContent()) {
            await this.renderUnifiedContent();
            return;
        }

        console.warn('Aucun contenu unifie disponible pour cette simulation.');
    }

    /**
     * Génère et affiche les contrôles depuis les données JSON
     */
    setupControls() {
        const hasJsonControls = Array.isArray(this.data?.controls) && this.data.controls.length > 0;
        const container = document.getElementById('controls-container');
        if (!container) {
            if (hasJsonControls) {
                console.warn('Conteneur controls-container introuvable');
            }
            return;
        }

        if (hasJsonControls) {
            container.innerHTML = this.generateControls();
        }
    }

    /**
     * Génère le HTML des contrôles
     * @returns {string} HTML des contrôles
     */
    generateControls() {
        let html = '<div class="controls">';

        this.data.controls.forEach(ctrl => {
            if (ctrl.type === 'button') {
                const style = ctrl.style || 'primary';
                const action = ctrl.action || '';
                html += `<button class="btn btn-${style}" onclick="page.${action}()">${ctrl.label}</button>`;
            } else if (ctrl.type === 'input') {
                html += `<input type="text" id="${ctrl.id}" placeholder="${ctrl.placeholder}" class="input">`;
            } else if (ctrl.type === 'select') {
                html += `<select id="${ctrl.id}" class="input">`;
                ctrl.options.forEach(opt => {
                    html += `<option value="${opt.value}">${opt.label}</option>`;
                });
                html += `</select>`;
            }
        });

        html += '</div>';

        // Ajouter le contrôle de vitesse
        html += `
        <div class="speed-control">
            <label for="speedSlider">Vitesse de simulation :</label>
            <input type="range" id="speedSlider" class="speed-slider"
                   min="1" max="5" value="3" step="1">
            <span class="speed-label" id="speedLabel">Normal</span>
        </div>`;

        return html;
    }

    /**
     * Configure le contrôleur de vitesse
     */
    setupSpeedController() {
        // Vérifier que le SpeedController existe dans OEIUtils
        if (typeof OEIUtils !== 'undefined' && OEIUtils.SpeedController) {
            this.speedCtrl = new OEIUtils.SpeedController();
        } else {
            console.warn('SpeedController non disponible');
        }
    }

    /**
     * Génère et affiche le pseudocode depuis les données JSON
     */
    setupPseudocode() {
        const container = document.getElementById('pseudocode-container');
        if (!container) {
            console.warn('Conteneur pseudocode-container introuvable');
            return;
        }

        if (typeof PseudocodeSupport !== 'undefined') {
            PseudocodeSupport.renderFromData(this.data, {
                containerId: 'pseudocode-container',
                lineIdBuilder: (func, idx) => `${func.name}-line${idx}`
            });
            return;
        }

        if (this.data.pseudocode && this.data.pseudocode.length > 0) {
            let html = '<div class="card algorithm-code">';
            this.data.pseudocode.forEach(func => {
                func.lines.forEach((line, idx) => {
                    const lineId = `${func.name}-line${idx}`;
                    html += `<span class="line" id="${lineId}">${line}</span>`;
                });
                if (this.data.pseudocode.length > 1) {
                    html += '<span class="line"></span>';
                }
            });
            html += '</div>';
            container.innerHTML = html;
        }
    }

    // ============================================
    // MÉTHODES ABSTRAITES (à surcharger)
    // ============================================

    /**
     * Réinitialise la simulation
     * DOIT être implémentée par les sous-classes
     */
    reset() {
        throw new Error('reset() doit être implémentée par la sous-classe');
    }

    /**
     * Exécute une étape de la simulation
     * Optionnel - pour les simulations pas-à-pas
     */
    async doStep() {
        console.warn('doStep() n\'est pas implémentée');
    }

    /**
     * Met à jour l'affichage de la simulation
     * DOIT être implémentée par les sous-classes
     */
    render() {
        throw new Error('render() doit être implémentée par la sous-classe');
    }

    // ============================================
    // MÉTHODES UTILITAIRES
    // ============================================

    /**
     * Exécute la simulation automatiquement
     */
    async runAuto() {
        this.state.running = true;

        while (this.state.running && this.state.phase !== 'done') {
            await this.doStep();
            this.render();

            if (this.speedCtrl) {
                await OEIUtils.sleep(this.speedCtrl.getDelay());
            } else {
                await OEIUtils.sleep(500);
            }
        }

        this.state.running = false;
    }

    /**
     * Arrête l'exécution automatique
     */
    stop() {
        this.state.running = false;
    }

    /**
     * Exécute une seule étape de la simulation
     */
    async stepOnce() {
        if (this.state.running) return;

        await this.doStep();
        this.render();
    }

    /**
     * Highlight une ligne de pseudocode
     * @param {string} lineId - ID de la ligne à highlighter
     */
    highlightLine(lineId) {
        // Retirer tous les highlights existants
        document.querySelectorAll('.algorithm-code .line').forEach(
            l => l.classList.remove('highlight')
        );

        // Ajouter le highlight à la ligne spécifiée
        const line = document.getElementById(lineId);
        if (line) {
            line.classList.add('highlight');
        }

        this.lastHighlightedLineId = lineId || null;
        this.updateLearningStepLabel();
    }

    /**
     * Retire tous les highlights du pseudocode
     */
    clearHighlight() {
        document.querySelectorAll('.algorithm-code .line').forEach(
            l => l.classList.remove('highlight')
        );
        this.lastHighlightedLineId = null;
        this.updateLearningStepLabel();
    }

    /**
     * Met à jour un élément d'information
     * @param {string} id - ID de l'élément à mettre à jour
     * @param {string} value - Nouvelle valeur
     */
    updateInfo(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // ============================================
    // OUTILS PEDAGOGIQUES TRANSVERSES
    // ============================================

    setupLearningTools() {
        if (this.learning.mounted) return;

        const host = this.findLearningToolsHost();
        if (!host) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'card learning-tools';
        wrapper.id = 'learning-tools';
        wrapper.innerHTML = `
            <h3>Outils pédagogiques</h3>
            <div class="learning-row">
                <span class="learning-step" id="learning-current-step">Ligne courante : --</span>
            </div>
            <div class="learning-step" id="learning-click-hint">Astuce: cliquez sur une ligne de pseudo-code pour obtenir "quoi" et "pourquoi".</div>
            <div class="learning-feedback" id="explain-output">Cliquez sur une ligne de pseudo-code pour afficher son explication.</div>
        `;

        host.appendChild(wrapper);

        this.learning.root = wrapper;
        this.learning.explainOutput = wrapper.querySelector('#explain-output');
        this.learning.currentStepLabel = wrapper.querySelector('#learning-current-step');
        this.bindPseudocodeLineInspector();
        this.updateLearningStepLabel();
        this.learning.mounted = true;
    }

    getInspectorContainerIds() {
        return ['pseudocode-container'];
    }

    findLearningToolsHost() {
        const ids = this.getInspectorContainerIds();
        for (const id of ids) {
            const pseudo = document.getElementById(id);
            if (pseudo && pseudo.parentElement) return pseudo.parentElement;
        }
        const pseudo = document.querySelector('.algorithm-code');
        if (pseudo && pseudo.parentElement) return pseudo.parentElement;
        const page = document.querySelector('.page');
        if (page) return page;
        return document.body;
    }

    updateLearningStepLabel() {
        if (!this.learning.currentStepLabel) return;
        if (!this.lastHighlightedLineId) {
            this.learning.currentStepLabel.textContent = 'Ligne courante : --';
            return;
        }
        const line = document.getElementById(this.lastHighlightedLineId);
        const text = line ? line.textContent.trim().replace(/\s+/g, ' ') : this.lastHighlightedLineId;
        this.learning.currentStepLabel.textContent = 'Ligne courante : ' + text;
    }

    explainCurrentStep() {
        if (!this.learning.explainOutput) return;

        const lineId = this.learning.selectedLineId;
        if (!lineId) {
            this.learning.explainOutput.textContent = 'Aucune ligne sélectionnée. Cliquez sur une ligne de pseudo-code.';
            return;
        }

        const line = document.getElementById(lineId);
        const lineText = line ? line.textContent.trim().replace(/\s+/g, ' ') : lineId;
        const explanation = typeof PseudocodeSupport !== 'undefined'
            ? PseudocodeSupport.resolveExplanation(this.data, lineId, lineText)
            : { what: lineText, why: 'Explication indisponible.' };

        const escape = typeof PseudocodeSupport !== 'undefined'
            ? PseudocodeSupport.escapeHtml.bind(PseudocodeSupport)
            : this.escapeHtml.bind(this);

        this.learning.explainOutput.innerHTML =
            '<strong>Quoi ?</strong> ' + escape(explanation.what) +
            '<br><strong>Pourquoi ?</strong> ' + escape(explanation.why);
    }

    bindPseudocodeLineInspector() {
        this.cleanupPseudocodeLineInspector();

        if (typeof PseudocodeSupport !== 'undefined') {
            const ids = this.getInspectorContainerIds();
            let bound = false;
            ids.forEach((containerId) => {
                const ok = PseudocodeSupport.bindLineInspector(this.data, {
                    containerId,
                    explainOutput: this.learning.explainOutput,
                    initializeEmpty: false,
                    renderExplanation: false,
                    onSelect: ({ lineId }) => this.selectExplainedLine(lineId)
                });
                bound = bound || ok;
            });
            if (bound) {
                this.supportInspectorContainerIds = ids;
                return;
            }
        }

        if (typeof AbortController !== 'undefined') {
            this.fallbackInspectorController = new AbortController();
        }
        const listenerOptions = this.fallbackInspectorController
            ? { signal: this.fallbackInspectorController.signal }
            : undefined;
        const lines = [...document.querySelectorAll('.algorithm-code .line[id]')];
        lines.forEach((line) => {
            line.classList.add('line-clickable');
            line.title = 'Cliquer pour voir quoi/pourquoi';
            line.addEventListener('click', () => this.selectExplainedLine(line.id), listenerOptions);
        });
    }

    cleanupPseudocodeLineInspector() {
        if (typeof PseudocodeSupport !== 'undefined' && typeof PseudocodeSupport.unbindLineInspector === 'function') {
            this.supportInspectorContainerIds.forEach((containerId) => {
                PseudocodeSupport.unbindLineInspector(containerId);
            });
        }
        this.supportInspectorContainerIds = [];

        if (this.fallbackInspectorController) {
            this.fallbackInspectorController.abort();
            this.fallbackInspectorController = null;
        }
    }

    teardownLearningTools() {
        this.cleanupPseudocodeLineInspector();
        if (this.learning.root && this.learning.root.parentElement) {
            this.learning.root.parentElement.removeChild(this.learning.root);
        }
        this.learning = {
            mounted: false,
            selectedLineId: null
        };
    }

    destroy() {
        this.stop();
        this.teardownLearningTools();
        if (typeof super.destroy === 'function') {
            super.destroy();
        }
    }

    selectExplainedLine(lineId) {
        this.learning.selectedLineId = lineId;
        document.querySelectorAll('.algorithm-code .line.inspected').forEach((l) => {
            l.classList.remove('inspected');
        });
        const line = document.getElementById(lineId);
        if (line) line.classList.add('inspected');
        if (this.learning.explainOutput) {
            this.explainCurrentStep();
        }
    }
}

// Export pour usage en tant que module ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationPage;
}

// Export global pour usage direct dans les pages HTML
if (typeof window !== 'undefined') {
    window.SimulationPage = SimulationPage;
}
