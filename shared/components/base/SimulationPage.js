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
// SimulationPage étend toujours ConceptPage. Toutes les pages HTML chargent
// ConceptPage.js avant SimulationPage.js ; l'ancien repli anonyme (jamais atteint)
// a été retiré au profit d'une erreur explicite si la dépendance manque.
if (typeof ConceptPage === 'undefined') {
    throw new Error('SimulationPage requiert ConceptPage.js — à charger avant SimulationPage.js');
}
const SimulationPageBase = ConceptPage;

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

        // Lecture pilotée par trace (TracePlayer) — activée si la sous-classe
        // fournit buildTrace() + renderStep(). Reste null pour les pages qui
        // gardent leur boucle async maison.
        this.player = null;
        this._trace = null;

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
            // Attendre le registre de widgets avant tout rendu de contenu unifié
            // (fonction globale déclarée par ConceptPage.js, chargé avant ce fichier).
            if (typeof _ensureWidgetRegistry === 'function') {
                await _ensureWidgetRegistry();
            }
            await ConceptPage._loadKaTeX();
            await this.setupCourse();
            this._renderMath();
            this.setupControls();
            this.setupPseudocode();
            this.setupSpeedController();
            await this._ensureTraceGenerators();
            this.setupTracePlayer();
            this.reset();
            this.setupLearningTools();
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            const msg = 'Impossible de charger cette page de simulation. Réessayez ou consultez la console pour le détail.';
            if (typeof OEIUtils !== 'undefined' && typeof OEIUtils.showPageError === 'function') {
                OEIUtils.showPageError(msg);
            } else {
                console.warn(msg);
            }
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
        const esc = (v) => (typeof HtmlSafe !== 'undefined' ? HtmlSafe.escape(v) : String(v == null ? '' : v));
        const ident = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '');
        let html = '<div class="controls">';

        this.data.controls.forEach(ctrl => {
            if (ctrl.type === 'button') {
                const style = ident(ctrl.style || 'primary');
                const action = ident(ctrl.action);
                // pont data-inline-on* (pas d'onclick inline — compatible CSP stricte)
                html += `<button class="btn btn-${style}" data-inline-onclick="page.${action}()">${esc(ctrl.label)}</button>`;
            } else if (ctrl.type === 'input') {
                html += `<input type="text" id="${esc(ctrl.id)}" placeholder="${esc(ctrl.placeholder)}" class="input">`;
            } else if (ctrl.type === 'select') {
                html += `<select id="${esc(ctrl.id)}" class="input">`;
                ctrl.options.forEach(opt => {
                    html += `<option value="${esc(opt.value)}">${esc(opt.label)}</option>`;
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
        // Libérer l'instance précédente pour éviter d'empiler des écouteurs sur le slider
        if (this.speedCtrl && typeof this.speedCtrl.destroy === 'function') {
            this.speedCtrl.destroy();
        }
        this.speedCtrl = null;

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

        // PseudocodeSupport est toujours chargé par les pages de simulation.
        PseudocodeSupport.renderFromData(this.data, {
            containerId: 'pseudocode-container',
            lineIdBuilder: (func, idx) => `${func.name}-line${idx}`
        });
    }

    // ============================================
    // LECTURE PILOTÉE PAR TRACE (TracePlayer)
    // ============================================

    /**
     * Chemins (relatifs à shared/components/) des générateurs de trace requis par
     * cette page. Les sous-classes pilotées par trace la surchargent, ex. :
     *   traceGeneratorScripts() { return ['algorithms/sort-traces.js']; }
     * @returns {string[]}
     */
    traceGeneratorScripts() {
        return [];
    }

    /**
     * Charge (idempotent) le moteur TracePlayer + les générateurs de trace
     * déclarés par la sous-classe. Aucune balise <script> à ajouter aux pages :
     * tout est chargé paresseusement via OEIUtils.loadScript (patron §C7).
     */
    async _ensureTraceGenerators() {
        const scripts = this.traceGeneratorScripts();
        if (!Array.isArray(scripts) || scripts.length === 0) return;
        if (typeof document === 'undefined' || typeof OEIUtils === 'undefined') return;
        for (const rel of ['base/TracePlayer.js', ...scripts]) {
            try {
                await OEIUtils.loadScript(this.resolveSharedScriptPath(rel));
            } catch (error) {
                console.warn('Générateur de trace indisponible :', rel, error);
            }
        }
    }

    /**
     * Instancie le TracePlayer si la sous-classe fournit le contrat trace :
     *   buildTrace() → Step[]   (pur, sans DOM)
     *   renderStep(step)        → rendu DOM du pas
     * Sinon, la page garde sa boucle async historique et `this.player` reste null.
     */
    setupTracePlayer() {
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy();
        }
        this.player = null;
        this._trace = null;

        if (typeof this.buildTrace !== 'function' || typeof this.renderStep !== 'function') return;
        if (typeof TracePlayer === 'undefined') {
            console.warn('TracePlayer.js non chargé — lecture pas-à-pas indisponible');
            return;
        }

        this.player = new TracePlayer({
            getSteps: () => {
                if (!this._trace) this._trace = this.buildTrace();
                return this._trace;
            },
            render: (step, ctx) => this.renderStep(step, ctx),
            onLine: (lineId) => this.highlightLine(lineId ? this.resolveLineId(lineId) : null),
            getDelay: () => {
                const p = this.player;
                const step = (p && Array.isArray(p.steps)) ? p.steps[p.cursor] : null;
                return this.stepDelay(step);
            },
            onStateChange: (state) => {
                if (typeof this.onPlayerState === 'function') this.onPlayerState(state);
            }
        });
    }

    /**
     * Durée (ms) pendant laquelle le pas courant reste affiché avant l'avance
     * automatique. Par défaut = `getCurrentDelay()` ; les sous-classes peuvent
     * moduler selon `step.delay` (ex. animation de permutation plus courte).
     */
    stepDelay(_step) {
        return this.getCurrentDelay();
    }

    /**
     * Traduit un lineId symbolique (émis par le générateur) vers l'id présent dans
     * le DOM du pseudocode. Identité par défaut ; surchargé quand la page héberge
     * plusieurs blocs de pseudocode.
     */
    resolveLineId(symbolic) {
        return symbolic;
    }

    /** Régénère la trace au prochain accès (après changement d'entrée). */
    invalidateTrace() {
        this._trace = null;
    }

    /** Contrôle « Démarrer / Pause » des pages pilotées par trace. */
    startSort() {
        if (this.player) this.player.toggle();
    }

    /** Contrôle « Étape suivante » des pages pilotées par trace. */
    nextStep() {
        if (this.player) this.player.stepForward();
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
        if (this.player) {
            this.player.play();
            return;
        }

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
        if (this.player) this.player.pause();
        this.state.running = false;
    }

    /**
     * Délai courant (ms) selon le SpeedController, éventuellement multiplié.
     * Mutualisé depuis les 16 visualiseurs qui le recopiaient (revue §C1).
     * @param {number} [multiplier=1]
     * @returns {number}
     */
    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    /**
     * Bascule « mode expert » (masque les aides). Case #pedagogyModeToggle facultative.
     * Mutualisé depuis SortingVisualizer / SearchVisualizer (revue §C1).
     */
    bindPedagogyModeToggle() {
        const toggle = document.getElementById('pedagogyModeToggle');
        if (!toggle || typeof window === 'undefined') return;

        const storageKey = 'oei_pedagogy_mode_' + window.location.pathname;
        const applyMode = (expert) => {
            document.body.classList.toggle('mode-expert', expert);
            try {
                localStorage.setItem(storageKey, expert ? 'expert' : 'novice');
            } catch (error) {
                // stockage indisponible (navigation privée) — sans conséquence
            }
        };

        try {
            toggle.checked = localStorage.getItem(storageKey) === 'expert';
        } catch (error) {
            toggle.checked = false;
        }

        applyMode(toggle.checked);
        toggle.addEventListener('change', () => applyMode(toggle.checked));
    }

    /**
     * Exécute une seule étape de la simulation
     */
    async stepOnce() {
        if (this.player) {
            this.player.stepForward();
            return;
        }
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
            <div class="learning-feedback" id="explain-output" role="status" aria-live="polite">Cliquez sur une ligne de pseudo-code pour afficher son explication.</div>
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
            line.setAttribute('role', 'button');
            line.setAttribute('tabindex', '0');
            const trigger = () => this.selectExplainedLine(line.id);
            line.addEventListener('click', trigger, listenerOptions);
            line.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); }
            }, listenerOptions);
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
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy();
        }
        this.player = null;
        this._trace = null;
        this.teardownLearningTools();
        if (this.speedCtrl && typeof this.speedCtrl.destroy === 'function') {
            this.speedCtrl.destroy();
        }
        this.speedCtrl = null;
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
