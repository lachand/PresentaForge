class AlgorithmImplementationPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);

        this.algorithmConfigs = AlgorithmImplementationConfigs.ALGORITHMS;
        this.levelProfiles = AlgorithmImplementationConfigs.LEVEL_PROFILES;

        this.speedCtrl = null;
        this.steps = [];
        this.stepIndex = -1;
        this.currentArray = [];
        this.currentTarget = 0;
        this.autoTimer = null;

        this.guidedMode = true;
        this.advancedMode = false;
        this.noTraceMode = false;
        this.codeRevealLevel = 0;
        this.sessionStats = this.createEmptySessionStats();
        this.predictionState = this.createEmptyPredictionState();
        this.categoryLabels = {
            initialisation: 'initialisation',
            bornes: 'bornes de boucle',
            condition: 'tests conditionnels',
            mise_a_jour: 'mise à jour des variables',
            break: 'gestion de break'
        };
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.populateAlgorithmOptions();
        this.bindEvents();
        this.updateDensityMode();
        this.applyExampleForCurrentAlgorithm();
        this.prepareSimulation();
        this.renderProgression();
    }

    cacheDom() {
        this.algorithmSelect = document.getElementById('algoimpl-algorithm');
        this.levelSelect = document.getElementById('algoimpl-level');
        this.arrayInput = document.getElementById('algoimpl-array-input');
        this.targetInput = document.getElementById('algoimpl-target');
        this.targetGroup = document.getElementById('algoimpl-target-group');

        this.exampleBtn = document.getElementById('algoimpl-example');
        this.prepareBtn = document.getElementById('algoimpl-prepare');
        this.stepBtn = document.getElementById('algoimpl-step');
        this.runBtn = document.getElementById('algoimpl-run');
        this.resetBtn = document.getElementById('algoimpl-reset');

        this.guidedToggle = document.getElementById('algoimpl-guided-toggle');
        this.advancedToggle = document.getElementById('algoimpl-advanced-toggle');
        this.tutorObjective = document.getElementById('algoimpl-tutor-objective');
        this.tutorWhy = document.getElementById('algoimpl-tutor-why');
        this.tutorPitfall = document.getElementById('algoimpl-tutor-pitfall');
        this.predictPanel = document.getElementById('algoimpl-predict-panel');
        this.predictQuestion = document.getElementById('algoimpl-predict-question');
        this.predictNumber = document.getElementById('algoimpl-predict-number');
        this.predictBool = document.getElementById('algoimpl-predict-bool');
        this.predictValidateBtn = document.getElementById('algoimpl-predict-validate');
        this.predictFeedback = document.getElementById('algoimpl-predict-feedback');

        this.feedback = document.getElementById('algoimpl-feedback');
        this.resultBadge = document.getElementById('algoimpl-result-badge');
        this.stepDesc = document.getElementById('algoimpl-step-desc');
        this.stepIndexOutput = document.getElementById('algoimpl-step-index');
        this.stepMaxOutput = document.getElementById('algoimpl-step-max');
        this.arraySizeOutput = document.getElementById('algoimpl-array-size');
        this.modeLabelOutput = document.getElementById('algoimpl-mode-label');
        this.progressOutput = document.getElementById('algoimpl-progress');
        this.progressLabelOutput = document.getElementById('algoimpl-progress-label');

        this.focusCueOutput = document.getElementById('algoimpl-focus-cue');
        this.testBadgeOutput = document.getElementById('algoimpl-test-badge');
        this.resultNoteOutput = document.getElementById('algoimpl-result-note');

        this.pseudocodeOutput = document.getElementById('algoimpl-pseudocode');
        this.variablesOutput = document.getElementById('algoimpl-vars');
        this.arrayView = document.getElementById('algoimpl-array-view');
        this.traceHead = document.getElementById('algoimpl-trace-head');
        this.traceBody = document.getElementById('algoimpl-trace-body');

        this.summaryBox = document.getElementById('algoimpl-summary');
        this.summaryGood = document.getElementById('algoimpl-summary-good');
        this.summaryWork = document.getElementById('algoimpl-summary-work');
        this.summaryReco = document.getElementById('algoimpl-summary-reco');

        this.bridgeOutput = document.getElementById('algoimpl-bridge');
        this.syntaxMapOutput = document.getElementById('algoimpl-syntax-map');
        this.pythonOutput = document.getElementById('algoimpl-python');
        this.jsOutput = document.getElementById('algoimpl-js');

        this.vocabButtons = Array.from(document.querySelectorAll('.algoimpl-vocab-term'));
        this.vocabDefinition = document.getElementById('algoimpl-vocab-definition');

        this.revealPythonBtn = document.getElementById('algoimpl-reveal-python');
        this.revealJsBtn = document.getElementById('algoimpl-reveal-js');
        this.pythonBlock = document.getElementById('algoimpl-python-block');
        this.jsBlock = document.getElementById('algoimpl-js-block');

        this.workspace = document.getElementById('algoimpl-workspace');
        this.layout = document.getElementById('algoimpl-layout');
        this.controlsNav = document.querySelector('.algoimpl-controls-nav');
        this.tutorBox = document.querySelector('.algoimpl-tutor-box');
        this.advancedBlocks = Array.from(document.querySelectorAll('.algoimpl-advanced-block'));

        this.observePanel = document.getElementById('algoimpl-observe-panel');
        this.observeText = document.getElementById('algoimpl-observe-text');

        this.randomBtn = document.getElementById('algoimpl-random-btn');
        this.randomSizeInput = document.getElementById('algoimpl-random-size');
        this.randomMinInput = document.getElementById('algoimpl-random-min');
        this.randomMaxInput = document.getElementById('algoimpl-random-max');
        this.noTraceToggle = document.getElementById('algoimpl-notrace-toggle');
        this.traceSection = document.getElementById('algoimpl-trace-section');
        this.progressionPanel = document.getElementById('algoimpl-progression-panel');
        this.progressionResetBtn = document.getElementById('algoimpl-progression-reset');
    }

    bindEvents() {
        this.algorithmSelect.addEventListener('change', () => {
            this.applyExampleForCurrentAlgorithm();
            this.prepareSimulation();
        });

        this.levelSelect.addEventListener('change', () => {
            this.applyExampleForCurrentAlgorithm();
            this.prepareSimulation();
        });

        this.exampleBtn.addEventListener('click', () => {
            this.applyExampleForCurrentAlgorithm();
            this.prepareSimulation();
        });

        this.prepareBtn.addEventListener('click', () => this.prepareSimulation());
        this.stepBtn.addEventListener('click', () => this.nextStep());
        this.runBtn.addEventListener('click', () => this.toggleAuto());
        this.resetBtn.addEventListener('click', () => this.resetStep());

        this.guidedToggle.addEventListener('change', () => {
            this.guidedMode = Boolean(this.guidedToggle.checked);
            this.setFeedback(
                this.guidedMode
                    ? 'Mode guidé activé: prédiction obligatoire avant chaque étape.'
                    : 'Mode guidé désactivé: progression libre.',
                'info'
            );
            this.preparePredictionForCurrentStep(true);
            this.render();
        });

        this.advancedToggle.addEventListener('change', () => {
            this.advancedMode = Boolean(this.advancedToggle.checked);
            this.updateDensityMode();
            this.render();
        });

        this.predictValidateBtn.addEventListener('click', () => this.validatePrediction());

        this.revealPythonBtn.addEventListener('click', () => {
            if (this.codeRevealLevel < 1) this.codeRevealLevel = 1;
            this.updateCodeRevealUI();
        });

        this.revealJsBtn.addEventListener('click', () => {
            if (this.codeRevealLevel < 1) {
                this.setFeedback('Affichez d’abord Python, puis JavaScript.', 'warning');
                return;
            }
            this.codeRevealLevel = 2;
            this.updateCodeRevealUI();
        });

        this.arrayInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.prepareSimulation();
        });

        this.targetInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.prepareSimulation();
        });

        this.predictNumber.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.validatePrediction();
        });

        this.vocabButtons.forEach((button) => {
            const handler = () => this.showVocabDefinition(button);
            button.addEventListener('click', handler);
            button.addEventListener('focus', handler);
            button.addEventListener('mouseenter', handler);
        });

        if (this.randomBtn) {
            this.randomBtn.addEventListener('click', () => this.applyRandomArray());
        }

        if (this.noTraceToggle) {
            this.noTraceToggle.addEventListener('change', () => {
                this.noTraceMode = Boolean(this.noTraceToggle.checked);
                if (this.traceSection) {
                    this.traceSection.classList.toggle('hidden', this.noTraceMode);
                }
                this.setFeedback(
                    this.noTraceMode
                        ? 'Mode sans trace activé: construisez la trace mentalement.'
                        : 'Mode avec trace activé.',
                    'info'
                );
            });
        }

        if (this.progressionResetBtn) {
            this.progressionResetBtn.addEventListener('click', () => {
                localStorage.removeItem('algoimpl-progression');
                this.renderProgression();
                this.setFeedback('Carnet de progression réinitialisé.', 'info');
            });
        }
    }

    generateRandomArray(size, min, max) {
        const result = [];
        for (let k = 0; k < size; k += 1) {
            result.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        return result;
    }

    applyRandomArray() {
        const size = Math.min(12, Math.max(3, Number(this.randomSizeInput?.value || 6)));
        const min = Number(this.randomMinInput?.value ?? -9);
        const max = Number(this.randomMaxInput?.value ?? 9);
        const safeMin = Math.min(min, max);
        const safeMax = Math.max(min, max);
        const arr = this.generateRandomArray(size, safeMin, safeMax);
        this.arrayInput.value = arr.join(',');
        this.prepareSimulation();
    }

    loadProgression() {
        try {
            return JSON.parse(localStorage.getItem('algoimpl-progression') || '{}');
        } catch {
            return {};
        }
    }

    saveProgression(algoId, level, ratio) {
        const key = `${algoId}-${level}`;
        const data = this.loadProgression();
        const existing = data[key];
        if (!existing || ratio > existing.score) {
            data[key] = { score: ratio, date: new Date().toLocaleDateString('fr-FR') };
        }
        try {
            localStorage.setItem('algoimpl-progression', JSON.stringify(data));
        } catch {
            // localStorage peut être indisponible (mode privé, quota)
        }
        this.renderProgression();
    }

    renderProgression() {
        if (!this.progressionPanel) return;
        const data = this.loadProgression();
        const keys = Object.keys(data);
        if (!keys.length) {
            this.progressionPanel.innerHTML = '<p class="text-muted" style="font-size:0.82rem;margin:0">Aucune simulation terminée pour le moment.</p>';
            return;
        }
        const rows = keys
            .sort()
            .map((key) => {
                const [algoId, level] = key.split('-');
                const config = this.algorithmConfigs[algoId];
                const label = config ? config.label : algoId;
                const { score, date } = data[key];
                const tone = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'bad';
                return `<span class="algoimpl-prog-entry">
                    <span class="algoimpl-prog-label">${this.escapeHtml(label)} — N${this.escapeHtml(String(level))}</span>
                    <span class="mod-status ${tone}" style="font-size:0.75rem">${score}%</span>
                    <span class="algoimpl-prog-date">${this.escapeHtml(date)}</span>
                </span>`;
            })
            .join('');
        this.progressionPanel.innerHTML = rows;
    }

    createEmptySessionStats() {
        return {
            predictionsAsked: 0,
            predictionsCorrect: 0,
            wrongAttempts: 0,
            askedStepKeys: new Set(),
            correctStepKeys: new Set(),
            byCategory: {
                initialisation: 0,
                bornes: 0,
                condition: 0,
                mise_a_jour: 0,
                break: 0
            }
        };
    }

    createEmptyPredictionState() {
        return {
            targetStepIndex: -1,
            required: false,
            validated: false,
            expectedType: 'number',
            expectedValue: null,
            question: '',
            pitfallCategory: 'condition'
        };
    }

    updateDensityMode() {
        const advanced = this.advancedMode;
        if (this.workspace) {
            this.workspace.classList.toggle('simple', !advanced);
            this.workspace.classList.toggle('advanced', advanced);
        }
        this.layout.classList.toggle('essential', !advanced);
        this.advancedBlocks.forEach((node) => node.classList.toggle('hidden', !advanced));
    }

    populateAlgorithmOptions() {
        const groups = [
            { label: 'Fondamentaux', difficulty: 1 },
            { label: 'Recherche et variantes', difficulty: 2 },
            { label: 'Tri', difficulty: 3 }
        ];
        this.algorithmSelect.innerHTML = groups
            .map(({ label, difficulty }) => {
                const options = Object.values(this.algorithmConfigs)
                    .filter((c) => (c.difficulty || 1) === difficulty)
                    .map((c) => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.label)}</option>`)
                    .join('');
                return options ? `<optgroup label="${this.escapeHtml(label)}">${options}</optgroup>` : '';
            })
            .join('');
    }

    activeAlgorithmConfig() {
        return this.algorithmConfigs[this.algorithmSelect.value] || this.algorithmConfigs.max;
    }

    activeLevelProfile() {
        const level = Number(this.levelSelect.value || 1);
        return this.levelProfiles[level] || this.levelProfiles[1];
    }

    setFeedback(message, type) {
        this.feedback.className = `feedback ${type || ''}`;
        this.feedback.textContent = message;
    }

    setPredictFeedback(message, type) {
        this.predictFeedback.className = `feedback ${type || ''}`;
        this.predictFeedback.textContent = message;
    }


    parseArrayInput(raw) {
        const tokens = String(raw || '')
            .split(',')
            .map((token) => token.trim())
            .filter(Boolean);

        if (!tokens.length) {
            throw new Error('Le tableau ne peut pas être vide.');
        }
        if (tokens.length > 24) {
            throw new Error('Limite pédagogique: 24 valeurs maximum.');
        }

        return tokens.map((token) => {
            if (!/^-?\d+$/.test(token)) {
                throw new Error(`Valeur invalide: ${token}`);
            }
            return Number(token);
        });
    }

    parseTargetValue() {
        const raw = String(this.targetInput.value || '').trim();
        if (!raw) {
            throw new Error('La valeur cible est obligatoire pour cet algorithme.');
        }
        if (!/^-?\d+$/.test(raw)) {
            throw new Error('La valeur cible doit être un entier.');
        }
        return Number(raw);
    }

    applyExampleForCurrentAlgorithm() {
        const config = this.activeAlgorithmConfig();
        const level = this.activeLevelProfile();
        const sample = level.examples[config.id] || level.examples.max;
        this.arrayInput.value = sample.array;
        this.targetInput.value = String(sample.target);
        this.currentTarget = sample.target;
        this.updateTargetVisibility();
        this.renderBridgeAndCode(config);
    }

    updateTargetVisibility() {
        const config = this.activeAlgorithmConfig();
        this.targetGroup.classList.toggle('hidden', !config.needsTarget);
    }

    resetCodeReveal() {
        this.codeRevealLevel = 0;
        this.updateCodeRevealUI();
    }

    updateCodeRevealUI() {
        const pythonVisible = this.codeRevealLevel >= 1;
        const jsVisible = this.codeRevealLevel >= 2;

        this.pythonBlock.classList.toggle('is-locked', !pythonVisible);
        this.jsBlock.classList.toggle('is-locked', !jsVisible);

        this.revealPythonBtn.textContent = pythonVisible ? 'Python visible' : 'Afficher Python';
        this.revealJsBtn.textContent = jsVisible ? 'JavaScript visible' : 'Afficher JavaScript';

        this.revealPythonBtn.disabled = pythonVisible;
        this.revealJsBtn.disabled = jsVisible;
    }

    prepareSimulation() {
        this.stopAuto();
        this.updateTargetVisibility();
        this.sessionStats = this.createEmptySessionStats();
        this.predictionState = this.createEmptyPredictionState();
        this.setPredictFeedback('', '');
        this.summaryBox.classList.add('hidden');
        this.hideObservePanel();
        this.resetCodeReveal();

        try {
            const config = this.activeAlgorithmConfig();
            const values = this.parseArrayInput(this.arrayInput.value);
            const target = config.needsTarget ? this.parseTargetValue() : Number(this.targetInput.value || 0);

            this.currentArray = values;
            this.currentTarget = target;
            this.steps = this.buildStepsForAlgorithm(config, values, target);
            this.stepIndex = -1;

            this.renderBridgeAndCode(config);
            this.preparePredictionForCurrentStep(true);
            this.render();
            this.controlsNav.classList.remove('hidden');
            this.tutorBox.classList.remove('hidden');
            this.layout.classList.remove('hidden');
            this.setFeedback(`Simulation prête (${this.activeLevelProfile().label}).`, 'ok');
        } catch (error) {
            this.steps = [];
            this.stepIndex = -1;
            this.currentArray = [];
            this.currentTarget = 0;
            this.render();
            this.setFeedback(error.message || 'Configuration invalide.', 'bad');
        }
    }

    buildStepsForAlgorithm(config, arrayValues, target) {
        if (config.id === 'max') return AlgorithmImplementationSteps.buildMaxSteps(arrayValues);
        if (config.id === 'count') return AlgorithmImplementationSteps.buildCountSteps(arrayValues, target);
        if (config.id === 'sorted') return AlgorithmImplementationSteps.buildSortedSteps(arrayValues);
        if (config.id === 'sum') return AlgorithmImplementationSteps.buildSumSteps(arrayValues);
        if (config.id === 'min') return AlgorithmImplementationSteps.buildMinSteps(arrayValues);
        if (config.id === 'linear_search') return AlgorithmImplementationSteps.buildLinearSearchSteps(arrayValues, target);
        if (config.id === 'max_abs') return AlgorithmImplementationSteps.buildMaxAbsSteps(arrayValues);
        if (config.id === 'min_max') return AlgorithmImplementationSteps.buildMinMaxSteps(arrayValues);
        if (config.id === 'duplicate_check') return AlgorithmImplementationSteps.buildDuplicateCheckSteps(arrayValues);
        if (config.id === 'bubble_sort') return AlgorithmImplementationSteps.buildBubbleSortSteps(arrayValues);
        return AlgorithmImplementationSteps.buildMaxSteps(arrayValues);
    }


    buildObserveMessage(prevVars, currentVars) {
        const changes = [];
        Object.entries(currentVars).forEach(([key, newVal]) => {
            const oldVal = prevVars[key];
            if (oldVal === undefined) return;
            const oldStr = this.formatValue(oldVal);
            const newStr = this.formatValue(newVal);
            if (oldStr !== newStr) {
                changes.push(`${key} : ${oldStr} → ${newStr}`);
            }
        });
        return changes.length ? `Observez : ${changes.join(' | ')}` : '';
    }

    showObservePanel(message) {
        if (!this.observePanel || !this.observeText) return;
        this.observeText.textContent = message;
        this.observePanel.classList.remove('hidden');
    }

    hideObservePanel() {
        if (!this.observePanel) return;
        this.observePanel.classList.add('hidden');
    }

    currentStepToExecuteIndex() {
        const index = this.stepIndex + 1;
        return index >= 0 && index < this.steps.length ? index : -1;
    }

    currentStepToExecute() {
        const index = this.currentStepToExecuteIndex();
        return index >= 0 ? this.steps[index] : null;
    }

    lastExecutedStep() {
        return this.stepIndex >= 0 ? this.steps[this.stepIndex] : null;
    }

    buildPredictionForCurrentStep(currentStep) {
        const config = this.activeAlgorithmConfig();

        if (config.id === 'max') {
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars.max),
                question: 'Après exécution de cette étape, quelle sera la valeur de max ?',
                pitfallCategory: currentStep.pitfallCategory || 'mise_a_jour'
            };
        }

        if (config.id === 'count') {
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars.compteur),
                question: 'Après exécution de cette étape, quelle sera la valeur de compteur ?',
                pitfallCategory: currentStep.pitfallCategory || 'mise_a_jour'
            };
        }

        if (config.id === 'sorted') {
            const expected = String(currentStep.vars['est_trié'] || '').toLowerCase();
            return {
                expectedType: 'bool',
                expectedValue: expected === 'vrai' ? 'vrai' : 'faux',
                question: 'Après exécution de cette étape, est_trié vaudra-t-il vrai ou faux ?',
                pitfallCategory: currentStep.pitfallCategory || 'condition'
            };
        }

        if (config.id === 'sum') {
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars.somme),
                question: 'Après exécution de cette étape, quelle sera la valeur de somme ?',
                pitfallCategory: currentStep.pitfallCategory || 'mise_a_jour'
            };
        }

        if (config.id === 'min') {
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars.min),
                question: 'Après exécution de cette étape, quelle sera la valeur de min ?',
                pitfallCategory: currentStep.pitfallCategory || 'mise_a_jour'
            };
        }

        if (config.id === 'linear_search') {
            const résultat = currentStep.vars['résultat'];
            return {
                expectedType: 'number',
                expectedValue: Number(résultat),
                question: 'Après exécution de cette étape, quelle sera la valeur de résultat (-1 si non trouvé) ?',
                pitfallCategory: currentStep.pitfallCategory || 'condition'
            };
        }

        if (config.id === 'max_abs') {
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars.max_abs),
                question: 'Après exécution de cette étape, quelle sera la valeur de max_abs ?',
                pitfallCategory: currentStep.pitfallCategory || 'mise_a_jour'
            };
        }

        if (config.id === 'min_max') {
            const predTarget = currentStep.predictionTarget || 'min';
            return {
                expectedType: 'number',
                expectedValue: Number(currentStep.vars[predTarget]),
                question: `Après exécution de cette étape, quelle sera la valeur de ${predTarget} ?`,
                pitfallCategory: currentStep.pitfallCategory || 'condition'
            };
        }

        if (config.id === 'duplicate_check') {
            const doublon = String(currentStep.vars['doublon'] || '').toLowerCase();
            return {
                expectedType: 'bool',
                expectedValue: doublon === 'vrai' ? 'vrai' : 'faux',
                question: 'Après exécution de cette étape, doublon vaudra-t-il vrai ou faux ?',
                pitfallCategory: currentStep.pitfallCategory || 'condition'
            };
        }

        if (config.id === 'bubble_sort') {
            const échangé = String(currentStep.vars['échangé'] || '').toLowerCase();
            const j = currentStep.vars.j;
            return {
                expectedType: 'bool',
                expectedValue: échangé === 'vrai' ? 'vrai' : 'faux',
                question: `Est-ce que T[${j}] et T[${Number(j) + 1}] vont être échangés ?`,
                pitfallCategory: currentStep.pitfallCategory || 'condition'
            };
        }

        return {
            expectedType: 'number',
            expectedValue: 0,
            question: 'Quelle sera la valeur de la variable principale après cette étape ?',
            pitfallCategory: currentStep.pitfallCategory || 'condition'
        };
    }

    preparePredictionForCurrentStep(force = false) {
        if (!this.guidedMode) {
            this.predictionState = this.createEmptyPredictionState();
            this.renderPredictionPanel();
            return;
        }

        const currentIndex = this.currentStepToExecuteIndex();
        if (currentIndex < 0) {
            this.predictionState = this.createEmptyPredictionState();
            this.renderPredictionPanel();
            return;
        }

        if (!force && this.predictionState.targetStepIndex === currentIndex) {
            this.renderPredictionPanel();
            return;
        }

        const currentStep = this.steps[currentIndex];
        if (currentStep.skipPrediction) {
            this.predictionState = { ...this.createEmptyPredictionState(), required: false };
            this.renderPredictionPanel();
            return;
        }
        const built = this.buildPredictionForCurrentStep(currentStep);
        this.predictionState = {
            targetStepIndex: currentIndex,
            required: true,
            validated: false,
            expectedType: built.expectedType,
            expectedValue: built.expectedValue,
            question: built.question,
            pitfallCategory: built.pitfallCategory
        };

        const stepKey = String(currentIndex);
        if (!this.sessionStats.askedStepKeys.has(stepKey)) {
            this.sessionStats.askedStepKeys.add(stepKey);
            this.sessionStats.predictionsAsked = this.sessionStats.askedStepKeys.size;
        }

        this.predictNumber.value = '';
        this.predictBool.value = '';
        this.setPredictFeedback('Faites une prédiction puis exécutez cette étape.', 'info');
        this.renderPredictionPanel();
    }

    validatePrediction() {
        if (!this.guidedMode || !this.predictionState.required) return;

        if (this.predictionState.validated) {
            this.setPredictFeedback('Prédiction déjà validée pour cette étape.', 'info');
            return;
        }

        let userValue;
        if (this.predictionState.expectedType === 'number') {
            const raw = String(this.predictNumber.value || '').trim();
            if (!raw.length) {
                this.setPredictFeedback('Entrez une valeur numérique.', 'warning');
                return;
            }
            if (!/^-?\d+$/.test(raw)) {
                this.setPredictFeedback('La prédiction doit être un entier.', 'bad');
                return;
            }
            userValue = Number(raw);
        } else {
            userValue = String(this.predictBool.value || '');
            if (!userValue) {
                this.setPredictFeedback('Choisissez vrai ou faux.', 'warning');
                return;
            }
        }

        const expected = this.predictionState.expectedValue;
        const isCorrect = userValue === expected;

        if (isCorrect) {
            this.predictionState.validated = true;
            const stepKey = String(this.predictionState.targetStepIndex);
            if (!this.sessionStats.correctStepKeys.has(stepKey)) {
                this.sessionStats.correctStepKeys.add(stepKey);
                this.sessionStats.predictionsCorrect = this.sessionStats.correctStepKeys.size;
            }
            this.setFeedback(`Bonne prédiction ! Avancement à l’étape suivante.`, "ok");
            this.nextStep();
            return;
        } else {
            this.sessionStats.wrongAttempts += 1;
            if (this.sessionStats.byCategory[this.predictionState.pitfallCategory] != null) {
                this.sessionStats.byCategory[this.predictionState.pitfallCategory] += 1;
            }
            const contextMessages = {
                initialisation: `Attention à l’initialisation ! La bonne valeur de départ est ${this.formatValue(expected)}, pas ${this.formatValue(userValue)}.`,
                bornes: `Vérifiez les indices ! Confondre i et i−1 est une erreur classique. La réponse attendue est ${this.formatValue(expected)}.`,
                condition: `Le test logique donne ${this.formatValue(expected)}, pas ${this.formatValue(userValue)}. Relisez la condition avec les valeurs actuelles du tableau.`,
                mise_a_jour: `La mise à jour de la variable donne ${this.formatValue(expected)}. Avez-vous appliqué la bonne formule ?`,
                break: `Après cette instruction, la valeur est ${this.formatValue(expected)}. Attention à ce qui se passe quand on sort de boucle.`
            };
            const contextMsg = contextMessages[this.predictionState.pitfallCategory]
                || `La bonne réponse est ${this.formatValue(expected)}.`;
            this.setPredictFeedback(`Incorrect. ${contextMsg} Réessayez.`, "bad");
            this.setFeedback(`Corrigez votre prédiction avant d’exécuter l’étape.`, "warning");
        }
        this.renderPredictionPanel();
    }

    renderPredictionPanel() {
        if (!this.guidedMode) {
            this.predictPanel.classList.add('disabled');
            this.predictQuestion.textContent = 'Mode guidé désactivé: aucune prédiction obligatoire.';
            this.predictNumber.classList.add('hidden');
            this.predictBool.classList.add('hidden');
            this.predictValidateBtn.disabled = true;
            this.predictNumber.disabled = true;
            this.predictBool.disabled = true;
            return;
        }

        this.predictPanel.classList.remove('disabled');

        if (!this.predictionState.required) {
            this.predictQuestion.textContent = 'Aucune prédiction requise (simulation terminée).';
            this.predictNumber.classList.add('hidden');
            this.predictBool.classList.add('hidden');
            this.predictValidateBtn.disabled = true;
            this.predictNumber.disabled = true;
            this.predictBool.disabled = true;
            return;
        }

        const currentStepNumber = this.predictionState.targetStepIndex + 1;
        this.predictQuestion.textContent = `Étape ${currentStepNumber}: ${this.predictionState.question}`;
        const isNumber = this.predictionState.expectedType === 'number';
        this.predictNumber.classList.toggle('hidden', !isNumber);
        this.predictBool.classList.toggle('hidden', isNumber);
        this.predictNumber.disabled = !isNumber || this.predictionState.validated;
        this.predictBool.disabled = isNumber || this.predictionState.validated;
        this.predictValidateBtn.disabled = this.predictionState.validated;
    }

    renderBridgeAndCode(config) {
        const code = config.codeFactory(this.currentTarget);
        this.bridgeOutput.innerHTML = config.bridge
            .map((item) => `<li>${this.escapeHtml(item)}</li>`)
            .join('');

        this.renderSyntaxMap(config.syntaxMap || []);
        this.pythonOutput.textContent = code.python.join('\n');
        this.jsOutput.textContent = code.javascript.join('\n');
    }

    renderSyntaxMap(entries) {
        this.syntaxMapOutput.innerHTML = entries
            .map((entry) => `
                <article class="algoimpl-syntax-card">
                    <div class="title">Pseudo-code</div>
                    <code>${this.escapeHtml(entry.pseudo)}</code>
                    <div class="title">Python</div>
                    <code>${this.escapeHtml(entry.python)}</code>
                    <div class="title">JavaScript</div>
                    <code>${this.escapeHtml(entry.javascript)}</code>
                </article>
            `)
            .join('');
    }

    showVocabDefinition(button) {
        this.vocabButtons.forEach((node) => node.classList.remove('active'));
        button.classList.add('active');
        this.vocabDefinition.textContent = `${button.textContent}: ${button.dataset.definition}`;
    }

    formatValue(value) {
        if (typeof value === 'boolean') return AlgorithmImplementationSteps.boolLabel(value);
        return String(value);
    }

    renderPseudocode(config, activeLine) {
        this.pseudocodeOutput.innerHTML = config.pseudocode
            .map((line, index) => {
                const lineNo = index + 1;
                const activeClass = lineNo === activeLine ? ' active' : '';
                return `<li class="algoimpl-line${activeClass}"><span class="line-no">${lineNo}</span><code>${this.escapeHtml(line)}</code></li>`;
            })
            .join('');
    }

    renderVariables(currentStep) {
        const entries = Object.entries(currentStep.vars || {});
        this.variablesOutput.innerHTML = entries
            .map(([key, value]) => `
                <span class="algoimpl-var">
                    <span class="name">${this.escapeHtml(key)}</span>
                    <span class="value">${this.escapeHtml(this.formatValue(value))}</span>
                </span>
            `)
            .join('');
    }

    renderArray(currentStep) {
        const pointers = new Set(currentStep.pointers || []);
        const changed = new Set(currentStep.changedIndices || []);
        const displayArray = currentStep.arrayState || this.currentArray;
        this.arrayView.innerHTML = displayArray
            .map((value, index) => {
                let cls = 'algoimpl-cell';
                if (pointers.has(index)) cls += ' pointer';
                if (changed.has(index)) cls += ' changed';
                return `<span class="${cls}">
                    <span class="idx">${index}</span>
                    <span class="val">${this.escapeHtml(String(value))}</span>
                </span>`;
            })
            .join('');
    }

    renderTraceTable(config) {
        const headers = config.traceColumns.map((col) => `<th>${this.escapeHtml(col.label)}</th>`).join('');
        this.traceHead.innerHTML = `<tr>${headers}</tr>`;

        const rows = [];
        for (let i = 0; i <= this.stepIndex; i += 1) {
            const step = this.steps[i];
            if (step && step.traceRow) rows.push(step.traceRow);
        }

        if (!rows.length) {
            this.traceBody.innerHTML = `<tr><td colspan="${config.traceColumns.length}" class="text-muted">Aucune ligne de trace pour le moment</td></tr>`;
            return;
        }

        const currentHasTrace = Boolean(this.steps[this.stepIndex] && this.steps[this.stepIndex].traceRow);

        this.traceBody.innerHTML = rows
            .map((row, rowIndex) => {
                const isActive = currentHasTrace && rowIndex === rows.length - 1;
                const cells = config.traceColumns
                    .map((col) => `<td>${this.escapeHtml(this.formatValue(row[col.key]))}</td>`)
                    .join('');
                return `<tr class="${isActive ? 'active-row' : ''}">${cells}</tr>`;
            })
            .join('');
    }

    renderProgress() {
        if (!this.steps.length) {
            this.progressOutput.value = 0;
            this.progressLabelOutput.textContent = '0%';
            return;
        }

        const executed = Math.max(this.stepIndex + 1, 0);
        const percent = Math.round((executed / this.steps.length) * 100);

        this.progressOutput.value = percent;
        this.progressLabelOutput.textContent = `${percent}%`;
    }

    renderStatus(executedStep, currentStep, config) {
        if (currentStep) {
            this.stepDesc.textContent = `Étape à exécuter: ${currentStep.objective || 'appliquer la ligne active.'}`;
            this.resultBadge.className = 'mod-status info';
            this.resultBadge.textContent = `Étape ${this.currentStepToExecuteIndex() + 1}`;
            this.resultNoteOutput.textContent = 'Prédisez l’état après cette étape, puis exécutez-la.';
            return;
        }

        if (executedStep && executedStep.final) {
            const isFalse = executedStep.result === false;
            this.stepDesc.textContent = executedStep.description || 'Simulation terminée.';
            this.resultBadge.className = `mod-status ${isFalse ? 'warn' : 'ok'}`;
            this.resultBadge.textContent = `Résultat: ${this.formatValue(executedStep.result)}`;
            this.resultNoteOutput.textContent = config.resultSentence(executedStep.result, this.currentTarget);
            return;
        }

        this.stepDesc.textContent = 'Préparez une simulation valide pour commencer.';
        this.resultBadge.className = 'mod-status info';
        this.resultBadge.textContent = 'En attente';
        this.resultNoteOutput.textContent = 'Lancez la première étape pour démarrer la trace.';
    }

    renderFocus(executedStep, currentStep) {
        if (currentStep) {
            this.focusCueOutput.textContent = currentStep.why || currentStep.objective || 'Analysez la ligne active.';
            this.testBadgeOutput.className = 'mod-status info';
            this.testBadgeOutput.textContent = 'À prédire';
            return;
        }

        const badge = (executedStep && executedStep.testBadge) || { tone: 'info', text: 'Aucun test' };
        this.focusCueOutput.textContent = (executedStep && (executedStep.cue || executedStep.description)) || 'Aucune explication disponible.';
        this.testBadgeOutput.className = `mod-status ${badge.tone || 'info'}`;
        this.testBadgeOutput.textContent = badge.text || 'Aucun test';
    }

    renderTutor(currentStep) {
        if (!this.guidedMode) {
            this.tutorObjective.textContent = 'Mode libre: vous pouvez avancer sans validation de prédiction.';
            this.tutorWhy.textContent = 'Le guidage détaillé est masqué pour réduire la contrainte.';
            this.tutorPitfall.textContent = 'Réactivez le mode guidé pour revoir les erreurs fréquentes.';
            return;
        }

        if (!currentStep) {
            this.tutorObjective.textContent = 'Préparez une simulation puis exécutez la première étape.';
            this.tutorWhy.textContent = 'Le guidage détaillé apparaîtra sur l’étape courante.';
            this.tutorPitfall.textContent = 'Vérifiez d’abord vos entrées (tableau, cible, niveau).';
            return;
        }

        this.tutorObjective.textContent = currentStep.objective || 'Suivre la logique de l’étape en cours.';
        this.tutorWhy.textContent = currentStep.why || 'Comprendre pourquoi la condition est évaluée ici.';
        this.tutorPitfall.textContent = currentStep.pitfall || 'Vérifiez les bornes, les conditions et les mises à jour.';
    }

    renderSummary(config) {
        this.summaryBox.classList.remove('hidden');

        const good = [];
        const work = [];
        const asked = this.sessionStats.askedStepKeys.size;
        const correct = Math.min(this.sessionStats.correctStepKeys.size, asked);
        const ratio = asked > 0 ? Math.min(100, Math.round((correct / asked) * 100)) : 0;
        this.saveProgression(config.id, Number(this.levelSelect.value), ratio);

        if (asked === 0) {
            good.push('Aucune prédiction demandée sur cette exécution.');
        } else if (ratio >= 80) {
            good.push(`Très bonne anticipation: ${correct}/${asked} prédictions correctes (${ratio}%).`);
        } else if (ratio >= 50) {
            good.push(`Anticipation correcte mais perfectible: ${correct}/${asked} (${ratio}%).`);
            work.push('Rejouer une fois en verbalisation: "je lis, je teste, je mets à jour".');
        } else {
            work.push(`Anticipation fragile: ${correct}/${asked} prédictions correctes (${ratio}%).`);
        }

        const difficultCategories = Object.entries(this.sessionStats.byCategory)
            .filter(([, value]) => value > 0)
            .sort((a, b) => b[1] - a[1]);

        if (!difficultCategories.length) {
            good.push('Aucune erreur récurrente détectée sur les points clés.');
        } else {
            difficultCategories.forEach(([key, value]) => {
                work.push(`${this.categoryLabels[key]}: ${value} erreur(s) de prédiction.`);
            });
        }

        if (!work.length) {
            good.push('Les fondamentaux (initialisation, test, mise à jour, retour) sont maîtrisés.');
        }

        this.summaryGood.innerHTML = good.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('');
        this.summaryWork.innerHTML = (work.length ? work : ['Aucun point bloquant sur cette simulation.'])
            .map((item) => `<li>${this.escapeHtml(item)}</li>`)
            .join('');

        const topCategory = difficultCategories[0]?.[0] || null;
        if (!topCategory) {
            this.summaryReco.textContent = `${this.activeLevelProfile().recommendation} Ensuite, testez un autre algorithme.`;
            return;
        }

        if (topCategory === 'bornes') {
            this.summaryReco.textContent = 'Recommandation: refaites "Vérifier si le tableau est trié" en niveau 2 puis 3, avec attention sur i et i-1.';
            return;
        }
        if (topCategory === 'condition') {
            this.summaryReco.textContent = 'Recommandation: refaites "Compter une valeur" en expliquant à voix haute chaque vrai/faux.';
            return;
        }
        if (topCategory === 'break') {
            this.summaryReco.textContent = 'Recommandation: retravaillez les cas où break intervient (algorithme trié, niveau 3).';
            return;
        }
        if (topCategory === 'initialisation') {
            this.summaryReco.textContent = 'Recommandation: insistez sur la première étape de chaque algorithme (initialisation des variables).';
            return;
        }
        this.summaryReco.textContent = `Recommandation: ${config.label}, niveau ${this.levelSelect.value}, en mode guidé avec prédiction.`;
    }

    render() {
        const config = this.activeAlgorithmConfig();
        const currentStep = this.currentStepToExecute();
        const executedStep = this.lastExecutedStep();
        const stepForLine = currentStep || executedStep || {
            line: 0,
            objective: 'Préparez une simulation valide pour commencer.',
            why: 'Le guidage apparaîtra après préparation.',
            pitfall: 'Commencez par choisir un algorithme et un niveau.',
            cue: 'Préparez une simulation valide pour commencer.',
            vars: {},
            pointers: [],
            testBadge: { tone: 'info', text: 'Aucun test' }
        };
        const stepForState = executedStep || {
            vars: {},
            pointers: []
        };

        this.renderPseudocode(config, stepForLine.line);
        this.renderVariables(stepForState);
        this.renderArray(stepForState);
        this.renderTraceTable(config);
        this.renderProgress();
        this.renderStatus(executedStep, currentStep, config);
        this.renderFocus(executedStep, currentStep);
        this.renderTutor(currentStep || executedStep);
        this.renderPredictionPanel();

        const currentIndex = this.currentStepToExecuteIndex();
        const totalSteps = this.steps.length;
        const shownStepNumber = currentIndex >= 0 ? currentIndex + 1 : totalSteps;
        this.stepIndexOutput.textContent = String(totalSteps ? shownStepNumber : 0);
        this.stepMaxOutput.textContent = String(totalSteps);
        this.arraySizeOutput.textContent = `${this.currentArray.length} élément${this.currentArray.length > 1 ? 's' : ''}`;
        this.modeLabelOutput.textContent = this.autoTimer ? 'Automatique' : 'Pas à pas';

        if (executedStep && executedStep.final && !currentStep) {
            this.renderSummary(config);
        } else {
            this.summaryBox.classList.add('hidden');
        }
    }

    canAdvanceToNextStep() {
        if (!this.guidedMode) return true;
        if (!this.predictionState.required) return true;
        if (this.predictionState.validated) return true;

        this.setFeedback('Validez d’abord la prédiction de l’étape courante.', 'warning');
        this.setPredictFeedback('Prédiction obligatoire avant de continuer.', 'warning');
        return false;
    }

    nextStep() {
        const currentIndex = this.currentStepToExecuteIndex();
        if (currentIndex < 0) {
            this.setFeedback('Dernière étape atteinte.', 'warning');
            return false;
        }

        if (!this.canAdvanceToNextStep()) {
            return false;
        }

        const prevVars = this.stepIndex >= 0
            ? (this.steps[this.stepIndex].vars || {})
            : {};

        this.stepIndex = currentIndex;

        const executedStep = this.steps[this.stepIndex];
        if (executedStep && !executedStep.final) {
            const observeMsg = this.buildObserveMessage(prevVars, executedStep.vars || {});
            if (observeMsg) {
                this.showObservePanel(observeMsg);
            } else {
                this.hideObservePanel();
            }
        } else {
            this.hideObservePanel();
        }

        this.preparePredictionForCurrentStep(true);
        this.render();
        return true;
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    toggleAuto() {
        if (this.autoTimer) {
            this.stopAuto();
            this.render();
            return;
        }

        if (!this.canAdvanceToNextStep()) {
            this.render();
            return;
        }

        this.runBtn.textContent = 'Pause';
        this.modeLabelOutput.textContent = 'Automatique';
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    autoLoop() {
        if (!this.autoTimer) return;
        const hasNext = this.nextStep();
        if (!hasNext) {
            this.stopAuto();
            this.render();
            return;
        }
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    stopAuto() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.runBtn.textContent = 'Lecture auto';
    }

    resetStep() {
        this.stopAuto();
        this.stepIndex = -1;
        this.predictionState = this.createEmptyPredictionState();
        this.sessionStats = this.createEmptySessionStats();
        this.preparePredictionForCurrentStep(true);
        this.summaryBox.classList.add('hidden');
        this.hideObservePanel();
        this.render();
        this.setFeedback('Retour avant la première étape.', 'info');
    }
}

if (typeof window !== 'undefined') {
    window.AlgorithmImplementationPage = AlgorithmImplementationPage;
}
