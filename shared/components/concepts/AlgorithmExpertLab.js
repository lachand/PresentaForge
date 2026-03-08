class AlgorithmExpertLab {
    constructor(containerId) {
        this.containerId = containerId;

        this.contract = null;
        this.program = null;
        this.execution = null;
        this.events = [];
        this.executionIndex = -1;
        this.autoTimer = null;

        this.predictionState = this.createEmptyPredictionState();
        this.sessionStats = this.createEmptySessionStats();
        this.generatedTests = [];
        this.diagnostics = [];
        this.analysisArtifacts = {
            cfg: null,
            ssa: null,
            intervals: null,
            invariants: [],
            ruleCoverage: []
        };
        this.analysisReport = null;
        this.executionOptions = {
            strictTyping: true,
            compatibilityMode: 'pedagogique',
            tutorMode: 'td',
            hintLevel: 1
        };
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistoryEntries = 80;
        this.predictionHistory = [];
        this.favorites = [];
        this.xapiLog = [];
        this.traceSearchTerm = '';
        this.seed = 1337;
        this.selectedTimelineVar = null; // V1: variable timeline
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.engine = new AlgorithmExpertEngine({
            getExecutionOptions: () => this.executionOptions,
            buildDiagnostics: (p, e, ev, err, c) => this.diag.buildDiagnostics(p, e, ev, err, c),
            estimateComplexity: (p, n, iv) => this.contracts.estimateComplexity(p, n, iv)
        });
        this.diag = new AlgorithmExpertDiagnostics({
            getExpressionAst: (expr) => this.engine.getExpressionAst(expr),
            flattenStatements: (stmts) => this.engine.flattenStatements(stmts)
        });
        this.contracts = new AlgorithmExpertContracts({
            getExpressionAst: (expr) => this.engine.getExpressionAst(expr),
            callFunction: (name, args, rt, depth) => this.engine.callFunction(name, args, rt, depth),
            getExecutionOptions: () => this.executionOptions
        });
        this.cacheDom();
        this.bindEvents();
        this.loadDefaults();
        this.loadPersistedState();
        this.readScenarioFromUrl();
        this.applyEmbedModeFromUrl();
        this.refreshFavoritesUi();
        this.renderHistoryUi();
        this.applyDensityFromControl();
        this.initWelcome();
        this.attachPublicApi();
        this.updateVersionPanels();
        this.initTabs();        // P3: tab switching moved from inline HTML
        this.renderPythonSubset(); // P4: subset reference generated from JS config
        this.analyzeCode();
    }

    initWelcome() {
        const key = 'algoexpert:welcomed';
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
        const banner = document.createElement('div');
        banner.className = 'algoexpert-welcome-banner';
        banner.innerHTML = [
            '<strong>Bienvenue !</strong>',
            ' Un exemple est pré-chargé. Sélectionnez un autre algorithme dans la liste <em>Exemples &amp; favoris</em>,',
            ' modifiez le code et cliquez sur <strong>Analyser (F9)</strong> pour visualiser la trace pas à pas.',
            '<button class="algoexpert-welcome-close" aria-label="Fermer">&times;</button>'
        ].join('');
        banner.querySelector('.algoexpert-welcome-close').addEventListener('click', () => banner.remove());
        this.container.insertBefore(banner, this.container.firstChild);
    }

    cacheDom() {
        this.codeInput = document.getElementById('algoexpert-code');
        this.inputsInput = document.getElementById('algoexpert-inputs');

        this.analyzeBtn = document.getElementById('algoexpert-analyze');
        this.resetBtn = document.getElementById('algoexpert-reset');
        this.undoBtn = document.getElementById('algoexpert-undo');
        this.redoBtn = document.getElementById('algoexpert-redo');
        this.importPyBtn = document.getElementById('algoexpert-import-py');
        this.importPyFileInput = document.getElementById('algoexpert-import-py-file');
        this.exportJsonBtn = document.getElementById('algoexpert-export-json');
        this.exportMdBtn = document.getElementById('algoexpert-export-md');
        this.exportPackBtn = document.getElementById('algoexpert-export-pack');
        this.importPackBtn = document.getElementById('algoexpert-import-pack');
        this.importPackFileInput = document.getElementById('algoexpert-import-pack-file');
        this.shareBtn = document.getElementById('algoexpert-share');
        this.printBtn = document.getElementById('algoexpert-print');
        this.fullscreenBtn = document.getElementById('algoexpert-fullscreen');
        this.saveFavoriteBtn = document.getElementById('algoexpert-save-favorite');
        this.loadFavoriteBtn = document.getElementById('algoexpert-load-favorite');
        this.favoritesSelect = document.getElementById('algoexpert-favorites');

        this.feedback = document.getElementById('algoexpert-feedback');
        this.stepIndicator = document.getElementById('algoexpert-step-indicator');
        this.codeLinesOutput = document.getElementById('algoexpert-code-lines');
        this.varsOutput = document.getElementById('algoexpert-vars');
        this.traceBody = document.getElementById('algoexpert-trace-body');
        this.traceSearchInput = document.getElementById('algoexpert-trace-search');

        this.tutorObjective = document.getElementById('algoexpert-tutor-objective');
        this.tutorWhy = document.getElementById('algoexpert-tutor-why');
        this.tutorPitfall = document.getElementById('algoexpert-tutor-pitfall');
        this.tutorModeSelect = document.getElementById('algoexpert-tutor-mode');
        this.hintLevelSelect = document.getElementById('algoexpert-hint-level');
        this.sessionObjective = document.getElementById('algoexpert-session-objective');
        this.confusionOutput = document.getElementById('algoexpert-confusion');
        this.miniQuizQuestion = document.getElementById('algoexpert-miniquiz-question');
        this.miniQuizChoices = document.getElementById('algoexpert-miniquiz-choices');
        this.miniQuizFeedback = document.getElementById('algoexpert-miniquiz-feedback');
        this.notionProgressOutput = document.getElementById('algoexpert-notion-progress');
        this.exercisesOutput = document.getElementById('algoexpert-exercises');
        this.predictionHistoryOutput = document.getElementById('algoexpert-prediction-history');

        this.predictPanel = document.getElementById('algoexpert-predict-panel');
        this.predictQuestion = document.getElementById('algoexpert-predict-question');
        this.predictNumber = document.getElementById('algoexpert-predict-number');
        this.predictBool = document.getElementById('algoexpert-predict-bool');
        this.predictText = document.getElementById('algoexpert-predict-text');
        this.predictValidateBtn = document.getElementById('algoexpert-predict-validate');
        this.predictFeedback = document.getElementById('algoexpert-predict-feedback');

        this.summaryBox = document.getElementById('algoexpert-summary');
        this.summaryText = document.getElementById('algoexpert-summary-text');

        this.callStackOutput = document.getElementById('algoexpert-callstack'); // M2
        this.timelineOutput = document.getElementById('algoexpert-timeline'); // V1
        this.callTreeOutput = document.getElementById('algoexpert-calltree'); // V2

        this.v2Panel = document.getElementById('algoexpert-v2-panel');
        this.diagnosticsOutput = document.getElementById('algoexpert-diagnostics');
        this.testsOutput = document.getElementById('algoexpert-tests');
        this.diagShowInfo = document.getElementById('algoexpert-diag-show-info');
        this.diagShowWarning = document.getElementById('algoexpert-diag-show-warning');
        this.diagShowError = document.getElementById('algoexpert-diag-show-error');

        this.v3Panel = document.getElementById('algoexpert-v3-panel');
        this.coverageOutput = document.getElementById('algoexpert-coverage');
        this.callCountOutput = document.getElementById('algoexpert-callcount');
        this.maxDepthOutput = document.getElementById('algoexpert-maxdepth');
        this.complexityGuessOutput = document.getElementById('algoexpert-complexity-guess');
        this.jsOutput = document.getElementById('algoexpert-js-output');
        this.complexityBody = document.getElementById('algoexpert-complexity-body');
        this.cfgOutput = document.getElementById('algoexpert-cfg-output');
        this.ssaOutput = document.getElementById('algoexpert-ssa-output');
        this.invariantsOutput = document.getElementById('algoexpert-invariants');
        this.ruleCoverageOutput = document.getElementById('algoexpert-rule-coverage');

        this.strictModeToggle = document.getElementById('algoexpert-strict-mode');
        this.compatModeSelect = document.getElementById('algoexpert-compat-mode');
        this.densitySelect = document.getElementById('algoexpert-density');
        this.autosaveToggle = document.getElementById('algoexpert-autosave');
        this.blindModeToggle = document.getElementById('algoexpert-blind-mode');
    }

    bindEvents() {
        this.analyzeBtn.addEventListener('click', () => this.analyzeCode());
        this.resetBtn.addEventListener('click', () => this.resetExecution());
        this.undoBtn.addEventListener('click', () => this.undoEdit());
        this.redoBtn.addEventListener('click', () => this.redoEdit());
        this.importPyBtn.addEventListener('click', () => this.importPyFileInput.click());
        this.importPyFileInput.addEventListener('change', () => this.handleImportPythonFile());
        this.exportJsonBtn.addEventListener('click', () => this.exportJsonReport());
        const exportPyBtn = document.getElementById('algoexpert-export-py');
        if (exportPyBtn) exportPyBtn.addEventListener('click', () => this.exportPythonFile());
        const prevStepBtn = document.getElementById('algoexpert-prev-step');
        if (prevStepBtn) prevStepBtn.addEventListener('click', () => this.prevStep());
        const autoPlayBtn = document.getElementById('algoexpert-autoplay');
        if (autoPlayBtn) autoPlayBtn.addEventListener('click', () => this.toggleAutoPlay());
        const snippetSelect = document.getElementById('algoexpert-snippets');
        if (snippetSelect) {
            snippetSelect.innerHTML = '<option value="">Snippets</option>'
                + AlgorithmExpertLab.SNIPPETS.map((s) => `<option value="${s.id}">${this.escapeHtml(s.label)}</option>`).join('');
            snippetSelect.addEventListener('change', () => { this.insertSnippet(snippetSelect.value); snippetSelect.value = ''; });
        }
        if (this.exportMdBtn) this.exportMdBtn.addEventListener('click', () => this.exportMarkdownReport());
        if (this.exportPackBtn) this.exportPackBtn.addEventListener('click', () => this.exportScenarioPack());
        if (this.importPackBtn) this.importPackBtn.addEventListener('click', () => this.importPackFileInput.click());
        if (this.importPackFileInput) this.importPackFileInput.addEventListener('change', () => this.importScenarioPack());
        this.shareBtn.addEventListener('click', () => this.shareScenario());
        this.printBtn.addEventListener('click', () => this.printCurrentReport());
        if (this.fullscreenBtn) this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.saveFavoriteBtn.addEventListener('click', () => this.saveCurrentFavorite());
        this.loadFavoriteBtn.addEventListener('click', () => this.loadFavoriteFromSelect());

        this.codeInput.addEventListener('keydown', (event) => this.handleEditorShortcuts(event, 'code'));
        this.inputsInput.addEventListener('keydown', (event) => this.handleEditorShortcuts(event, 'inputs'));
        this.codeInput.addEventListener('input', () => this.onEditorChanged('code'));
        this.inputsInput.addEventListener('input', () => this.onEditorChanged('inputs'));

        if (this.traceSearchInput) this.traceSearchInput.addEventListener('input', () => this.applyTraceSearch());
        this.favoritesSelect.addEventListener('change', () => this.loadFavoriteFromSelect(false));

        this.predictValidateBtn.addEventListener('click', () => this.validatePrediction());
        this.predictNumber.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.validatePrediction();
        });
        this.predictText.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.validatePrediction();
        });

        this.testsOutput.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-case-index]');
            if (!button) return;
            const index = Number(button.dataset.caseIndex);
            this.applyTestCase(index);
        });
        this.miniQuizChoices.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-choice-index]');
            if (!button) return;
            this.answerMiniQuiz(Number(button.dataset.choiceIndex));
        });

        this.compatModeSelect.addEventListener('change', () => this.onOptionsChanged());
        this.strictModeToggle.addEventListener('change', () => this.onOptionsChanged());
        this.tutorModeSelect.addEventListener('change', () => this.onOptionsChanged());
        this.hintLevelSelect.addEventListener('change', () => this.onOptionsChanged());
        this.densitySelect.addEventListener('change', () => this.applyDensityFromControl());
        this.autosaveToggle.addEventListener('change', () => this.persistStateSnapshot());

        [this.diagShowInfo, this.diagShowWarning, this.diagShowError].forEach((node) => {
            node.addEventListener('change', () => this.renderDiagnostics(this.diagnostics));
        });

        document.addEventListener('keydown', (event) => this.handleGlobalShortcuts(event));

        // Composant SpeedController partagé (OEIUtils)
        this.speedCtrl = window.OEIUtils
            ? new OEIUtils.SpeedController('algoexpert-speed-slider', 'algoexpert-speed-label')
            : null;

        // I3: persistance de l'état des <details> secondaires
        this._initDetailsPersistence();
    }

    _initDetailsPersistence() {
        const STORAGE_KEY = 'algoexpert:details-state';
        let state = {};
        try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { state = {}; }

        const details = this.container.querySelectorAll('[data-persist-key]');
        details.forEach((el) => {
            const key = el.dataset.persistKey;
            if (!key) return;
            // Restaurer l'état sauvegardé
            if (state[key] === true) el.open = true;
            else if (state[key] === false) el.open = false;
            // Sauvegarder à chaque changement
            el.addEventListener('toggle', () => {
                state[key] = el.open;
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
            });
        });
    }

    loadDefaults() {
        this.codeInput.value = [
            'def compter_occurrences(tableau, cible):',
            '    compteur = 0',
            '    for i in range(0, len(tableau)):',
            '        if tableau[i] == cible:',
            '            compteur = compteur + 1',
            '    return compteur'
        ].join('\n');

        this.inputsInput.value = JSON.stringify({
            tableau: [7, 3, 9, 3, 5, 2],
            cible: 3
        }, null, 2);

        this.strictModeToggle.checked = true;
        this.compatModeSelect.value = 'pedagogique';
        this.tutorModeSelect.value = 'td';
        this.hintLevelSelect.value = '1';
        this.densitySelect.value = 'dense';
        this.autosaveToggle.checked = true;

        this.captureEditorSnapshot('init');
    }

    createEmptyPredictionState() {
        return {
            eventIndex: -1,
            required: false,
            validated: false,
            expectedType: 'number',
            expectedValue: null,
            question: '',
            pitfallCategory: 'condition'
        };
    }

    createEmptySessionStats() {
        return {
            askedSteps: new Set(),
            correctSteps: new Set(),
            wrongAttempts: 0,
            byCategory: {
                initialisation: 0,
                bornes: 0,
                condition: 0,
                mise_a_jour: 0,
                retour: 0
            }
        };
    }

    updateVersionPanels() {
        if (this.v2Panel) this.v2Panel.classList.remove('hidden');
        if (this.v3Panel) this.v3Panel.classList.remove('hidden');
    }

    setFeedback(message, tone) {
        this.feedback.className = `feedback ${tone || ''}`;
        this.feedback.textContent = message;
    }

    setPredictFeedback(message, tone) {
        this.predictFeedback.className = `feedback ${tone || ''}`;
        this.predictFeedback.textContent = message;
    }

    onOptionsChanged() {
        this.executionOptions.strictTyping = Boolean(this.strictModeToggle.checked);
        this.executionOptions.compatibilityMode = String(this.compatModeSelect.value || 'pedagogique');
        this.executionOptions.tutorMode = String(this.tutorModeSelect.value || 'td');
        this.executionOptions.hintLevel = Math.max(1, Math.min(3, Number(this.hintLevelSelect.value || 1)));
        this.persistStateSnapshot();
        this.renderTutor();
    }

    handleGlobalShortcuts(event) {
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
            return;
        }

        if (event.key === 'F9') {
            event.preventDefault();
            this.analyzeCode();
            return;
        }

        if (event.key === 'F8') {
            event.preventDefault();
            this.resetExecution();
            return;
        }

        if (event.key === 'F7') {
            event.preventDefault();
            this.toggleFullscreen();
            return;
        }

        // P2: arrow keys for step navigation
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.nextStep();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.prevStep();
            return;
        }

        // P6: Space = toggle auto-play
        if (event.key === ' ') {
            event.preventDefault();
            this.toggleAutoPlay();
        }
    }

    handleEditorShortcuts(event, source) {
        if (event.key === 'Tab') {
            event.preventDefault();
            const ta = event.target;
            const val = ta.value;
            const selStart = ta.selectionStart;
            const selEnd = ta.selectionEnd;

            // E4: multi-line indent/unindent when selection spans more than one line
            if (selEnd > selStart && val.slice(selStart, selEnd).includes('\n')) {
                const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
                const lineEndRaw = val.indexOf('\n', selEnd - 1);
                const lineEnd = lineEndRaw === -1 ? val.length : lineEndRaw;
                const block = val.slice(lineStart, lineEnd);
                const lines = block.split('\n');
                let toggled;
                if (event.shiftKey) {
                    // Unindent: remove up to 4 leading spaces per line
                    toggled = lines.map((l) => l.replace(/^    /, '').replace(/^( {1,3})/, ''));
                } else {
                    // Indent: add 4 spaces at the start of each line
                    toggled = lines.map((l) => `    ${l}`);
                }
                const newBlock = toggled.join('\n');
                ta.value = val.slice(0, lineStart) + newBlock + val.slice(lineEnd);
                // Restore selection covering the indented block
                ta.selectionStart = lineStart;
                ta.selectionEnd = lineStart + newBlock.length;
            } else if (event.shiftKey) {
                // Shift+Tab on single line: unindent
                const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
                const linePrefix = val.slice(lineStart, selStart);
                const spaces = linePrefix.match(/^( {1,4})/);
                if (spaces) {
                    ta.value = val.slice(0, lineStart) + val.slice(lineStart + spaces[1].length);
                    const newPos = Math.max(lineStart, selStart - spaces[1].length);
                    ta.selectionStart = newPos;
                    ta.selectionEnd = newPos;
                }
            } else {
                this.insertSpacesAtCaret(ta, 4);
            }
            this.onEditorChanged(source);
            return;
        }

        // E1: smart Enter — preserve indentation, add extra indent after ':'
        if (event.key === 'Enter' && source === 'code') {
            const textarea = event.target;
            const pos = textarea.selectionStart;
            const value = textarea.value;
            const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
            const currentLine = value.slice(lineStart, pos);
            const indent = currentLine.match(/^(\s*)/)[1];
            const extraIndent = currentLine.trimEnd().endsWith(':') ? '    ' : '';
            if (indent || extraIndent) {
                event.preventDefault();
                const inserted = '\n' + indent + extraIndent;
                textarea.value = value.slice(0, pos) + inserted + value.slice(textarea.selectionEnd);
                const newPos = pos + inserted.length;
                textarea.selectionStart = newPos;
                textarea.selectionEnd = newPos;
                this.onEditorChanged(source);
                return;
            }
        }

        // E3: auto-complete matching brackets and quotes in the code editor
        if (source === 'code') {
            const OPEN_PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
            const ALL_CLOSING = new Set([')', ']', '}', '"', "'"]);
            const ta = event.target;
            const selStart = ta.selectionStart;
            const selEnd = ta.selectionEnd;
            const val = ta.value;

            if (Object.prototype.hasOwnProperty.call(OPEN_PAIRS, event.key)) {
                const closing = OPEN_PAIRS[event.key];
                // For quotes: if cursor is on the matching closing quote and no selection, skip over it
                if ((event.key === '"' || event.key === "'") && selStart === selEnd && val[selStart] === closing) {
                    event.preventDefault();
                    ta.selectionStart = selStart + 1;
                    ta.selectionEnd = selStart + 1;
                    return;
                }
                event.preventDefault();
                const selected = val.slice(selStart, selEnd);
                ta.value = val.slice(0, selStart) + event.key + selected + closing + val.slice(selEnd);
                const newPos = selStart + 1;
                ta.selectionStart = newPos;
                ta.selectionEnd = newPos + selected.length;
                this.onEditorChanged(source);
                return;
            }

            // Skip over a closing bracket if the next char is already that bracket
            if (ALL_CLOSING.has(event.key) && selStart === selEnd && val[selStart] === event.key) {
                event.preventDefault();
                ta.selectionStart = selStart + 1;
                ta.selectionEnd = selStart + 1;
                return;
            }

            // Backspace: delete the pair if cursor is between an open/close pair
            if (event.key === 'Backspace' && selStart === selEnd && selStart > 0) {
                const before = val[selStart - 1];
                const after = val[selStart];
                if (OPEN_PAIRS[before] === after) {
                    event.preventDefault();
                    ta.value = val.slice(0, selStart - 1) + val.slice(selStart + 1);
                    ta.selectionStart = selStart - 1;
                    ta.selectionEnd = selStart - 1;
                    this.onEditorChanged(source);
                    return;
                }
            }
        }

        const platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
        const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
        const ctrlOrMeta = isMac ? event.metaKey : event.ctrlKey;
        if (!ctrlOrMeta) return;

        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.undoEdit();
            return;
        }

        if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
            event.preventDefault();
            this.redoEdit();
            return;
        }

        // E2: Ctrl+/ — toggle # comment on selected line(s)
        if (event.key === '/') {
            event.preventDefault();
            const ta = event.target;
            const val = ta.value;
            const selStart = ta.selectionStart;
            const selEnd = ta.selectionEnd;
            // Expand selection to cover full lines
            const lineStart = val.lastIndexOf('\n', selStart - 1) + 1;
            const lineEndRaw = val.indexOf('\n', selEnd);
            const lineEnd = lineEndRaw === -1 ? val.length : lineEndRaw;
            const block = val.slice(lineStart, lineEnd);
            const lines = block.split('\n');
            // If ALL lines already start with '#', uncomment; otherwise comment
            const allCommented = lines.every((l) => /^(\s*)#/.test(l));
            const toggled = lines.map((l) => {
                if (allCommented) {
                    // Remove the first '#' after leading whitespace
                    return l.replace(/^(\s*)#\s?/, '$1');
                }
                const indentMatch = l.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : '';
                return `${indent}# ${l.slice(indent.length)}`;
            }).join('\n');
            ta.value = val.slice(0, lineStart) + toggled + val.slice(lineEnd);
            // Restore a sensible selection covering the toggled block
            ta.selectionStart = lineStart;
            ta.selectionEnd = lineStart + toggled.length;
            this.onEditorChanged(source);
        }
    }

    insertSpacesAtCaret(textarea, count) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const spaces = ' '.repeat(count);
        const value = textarea.value;
        textarea.value = `${value.slice(0, start)}${spaces}${value.slice(end)}`;
        textarea.selectionStart = start + count;
        textarea.selectionEnd = start + count;
    }

    // P4: insert a code snippet at the cursor position in the code editor
    static get SNIPPETS() {
        return [
            { id: 'for-range', label: 'for i in range(n)', code: 'for i in range(0, n):\n    ' },
            { id: 'for-len', label: 'for i in range(len(T))', code: 'for i in range(0, len(tableau)):\n    ' },
            { id: 'for-in', label: 'for x in liste', code: 'for x in tableau:\n    ' },
            { id: 'while', label: 'while condition:', code: 'while condition:\n    ' },
            { id: 'if-else', label: 'if / else', code: 'if condition:\n    \nelse:\n    ' },
            { id: 'def', label: 'def f(params):', code: 'def ma_fonction(tableau):\n    \n    return resultat' },
            { id: 'swap', label: 'échange a, b', code: 'a, b = b, a' },
            { id: 'append', label: 'T.append(x)', code: 'resultat.append(x)' }
        ];
    }

    insertSnippet(id) {
        const snippet = AlgorithmExpertLab.SNIPPETS.find((s) => s.id === id);
        if (!snippet) return;
        const textarea = this.codeInput;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const newText = before + snippet.code + after;
        textarea.value = newText;
        const cursor = start + snippet.code.length;
        textarea.selectionStart = cursor;
        textarea.selectionEnd = cursor;
        textarea.focus();
        this.onEditorChanged('code');
    }

    // P5: session history — store last 5 analyses in localStorage
    saveToHistory() {
        const code = this.codeInput.value || '';
        if (!code.trim()) return;
        const key = 'algoexpert:history';
        let history = [];
        try { history = JSON.parse(localStorage.getItem(key) || '[]'); } catch { history = []; }
        const entry = {
            ts: Date.now(),
            code,
            inputs: this.inputsInput.value || ''
        };
        history = [entry, ...history.filter((h) => h.code !== code)].slice(0, 5);
        try { localStorage.setItem(key, JSON.stringify(history)); } catch { /* quota */ }
        this.renderHistoryUi();
    }

    renderHistoryUi() {
        const select = document.getElementById('algoexpert-history-select');
        if (!select) return;
        let history = [];
        try { history = JSON.parse(localStorage.getItem('algoexpert:history') || '[]'); } catch { history = []; }
        const first = '<option value="">Historique</option>';
        const options = history.map((h, idx) => {
            const date = new Date(h.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const preview = h.code.split('\n')[0].slice(0, 40);
            return `<option value="${idx}">${date} — ${this.escapeHtml(preview)}</option>`;
        });
        select.innerHTML = first + options.join('');
        select.onchange = () => {
            if (select.value === '') return;
            let hist = [];
            try { hist = JSON.parse(localStorage.getItem('algoexpert:history') || '[]'); } catch { hist = []; }
            const entry = hist[Number(select.value)];
            if (entry) {
                this.codeInput.value = entry.code;
                this.inputsInput.value = entry.inputs;
                this.onEditorChanged('code');
                this.setFeedback('Code restauré depuis l\'historique.', 'ok');
            }
            select.value = '';
        };
    }

    getCurrentEditorState() {
        return {
            code: String(this.codeInput.value || ''),
            inputs: String(this.inputsInput.value || ''),
            options: {
                strictTyping: Boolean(this.strictModeToggle.checked),
                compatibilityMode: String(this.compatModeSelect.value || 'pedagogique'),
                tutorMode: String(this.tutorModeSelect.value || 'td'),
                hintLevel: Number(this.hintLevelSelect.value || 1),
                density: String(this.densitySelect.value || 'dense'),
                autosave: Boolean(this.autosaveToggle.checked)
            }
        };
    }

    applyEditorState(state, fromHistory = false) {
        if (!state) return;
        if (typeof state.code === 'string') this.codeInput.value = state.code;
        if (typeof state.inputs === 'string') this.inputsInput.value = state.inputs;

        if (state.options) {
            this.strictModeToggle.checked = Boolean(state.options.strictTyping);
            this.compatModeSelect.value = state.options.compatibilityMode || 'pedagogique';
            this.tutorModeSelect.value = state.options.tutorMode || 'td';
            this.hintLevelSelect.value = String(state.options.hintLevel || 1);
            this.densitySelect.value = state.options.density || 'dense';
            this.autosaveToggle.checked = state.options.autosave !== false;
        }

        this.onOptionsChanged();
        this.applyDensityFromControl();
        if (!fromHistory) {
            this.captureEditorSnapshot('apply_state');
        }
    }

    captureEditorSnapshot(reason = 'edit') {
        const snapshot = this.getCurrentEditorState();
        const last = this.undoStack[this.undoStack.length - 1];
        const serialized = JSON.stringify(snapshot);
        const lastSerialized = last ? JSON.stringify(last) : '';
        if (serialized === lastSerialized) return;

        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxHistoryEntries) {
            this.undoStack.shift();
        }
        if (reason !== 'redo' && reason !== 'undo') {
            this.redoStack = [];
        }
    }

    onEditorChanged(source) {
        this.captureEditorSnapshot(source);
        this.persistStateSnapshot();
    }

    undoEdit() {
        if (this.undoStack.length <= 1) return;
        const current = this.undoStack.pop();
        if (current) this.redoStack.push(current);
        const previous = this.undoStack[this.undoStack.length - 1];
        this.applyEditorState(previous, true);
        this.setFeedback('Annulation appliquée.', 'info');
    }

    redoEdit() {
        const next = this.redoStack.pop();
        if (!next) return;
        this.applyEditorState(next, true);
        this.undoStack.push(this.getCurrentEditorState());
        this.setFeedback('Rétablissement appliqué.', 'info');
    }

    persistStateSnapshot() {
        if (!this.autosaveToggle.checked) return;
        const payload = {
            state: this.getCurrentEditorState(),
            favorites: this.favorites,
            ts: Date.now()
        };
        try {
            localStorage.setItem('algoexpert:last-state', JSON.stringify(payload));
        } catch {
            // storage unavailable
        }
    }

    loadPersistedState() {
        try {
            const raw = localStorage.getItem('algoexpert:last-state');
            if (!raw) return;
            const payload = JSON.parse(raw);
            if (payload && payload.state) {
                this.applyEditorState(payload.state, true);
            }
            if (payload && Array.isArray(payload.favorites)) {
                this.favorites = payload.favorites.slice(0, 30);
            }
            this.captureEditorSnapshot('restore');
        } catch {
            // ignore malformed persistence
        }
    }

    readScenarioFromUrl() {
        // Q8: support hash-based sharing (#code=<base64>) as well as query param
        let encoded = new URLSearchParams(window.location.search).get('algoexpert');
        if (!encoded && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.slice(1));
            encoded = hashParams.get('code');
        }
        if (!encoded) return;
        try {
            const payload = this.decodePayloadFromBase64(encoded);
            this.applyScenarioPayload(payload, true);
            this.captureEditorSnapshot('url');
        } catch {
            // ignore invalid shared payload
        }
    }

    applyEmbedModeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const embedVal = params.get('embed');
        if (!embedVal) return;
        const nav = document.querySelector('.nav-bar');
        if (nav) nav.classList.add('hidden');
        const pageHead = document.querySelector('.algoexpert-page-head');
        if (pageHead) pageHead.classList.add('hidden');
        document.body.classList.add('algoexpert-embed');
        if (embedVal === 'mini') {
            document.body.classList.add('algoexpert-embed-mini');
        }
    }

    getScenarioPayload() {
        return {
            version: 1,
            code: String(this.codeInput.value || ''),
            inputs: String(this.inputsInput.value || ''),
            options: {
                strictTyping: Boolean(this.strictModeToggle.checked),
                compatibilityMode: String(this.compatModeSelect.value || 'pedagogique'),
                tutorMode: String(this.tutorModeSelect.value || 'td'),
                hintLevel: Number(this.hintLevelSelect.value || 1),
                density: String(this.densitySelect.value || 'dense')
            },
            metadata: {
                generatedAt: new Date().toISOString()
            }
        };
    }

    applyScenarioPayload(payload, silent = false) {
        if (!payload || typeof payload !== 'object') return false;
        this.codeInput.value = String(payload.code || this.codeInput.value || '');
        this.inputsInput.value = String(payload.inputs || this.inputsInput.value || '');
        if (payload.options && typeof payload.options === 'object') {
            if (payload.options.strictTyping != null) this.strictModeToggle.checked = Boolean(payload.options.strictTyping);
            if (payload.options.compatibilityMode) this.compatModeSelect.value = payload.options.compatibilityMode;
            if (payload.options.tutorMode) this.tutorModeSelect.value = payload.options.tutorMode;
            if (payload.options.hintLevel != null) this.hintLevelSelect.value = String(payload.options.hintLevel);
            if (payload.options.density) this.densitySelect.value = payload.options.density;
        }
        this.onOptionsChanged();
        this.applyDensityFromControl();
        if (!silent) {
            this.setFeedback('Scénario importé.', 'ok');
        }
        return true;
    }

    shareScenario() {
        const payload = this.getScenarioPayload();
        const encoded = this.encodePayloadToBase64(payload);
        // Q8: use URL hash for sharing (cleaner URL, no server-side leakage)
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = `code=${encoded}`;
        navigator.clipboard.writeText(url.toString())
            .then(() => this.setFeedback('Lien de partage copié dans le presse-papiers.', 'ok'))
            .catch(() => this.setFeedback(`Lien de partage : ${url.toString()}`, 'info'));
    }

    encodePayloadToBase64(payload) {
        const json = JSON.stringify(payload);
        try {
            const bytes = new TextEncoder().encode(json);
            let binary = '';
            bytes.forEach((byte) => {
                binary += String.fromCharCode(byte);
            });
            return btoa(binary);
        } catch {
            return btoa(json);
        }
    }

    decodePayloadFromBase64(encoded) {
        const binary = atob(encoded);
        try {
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch {
            return JSON.parse(binary);
        }
    }

    // D4: export current code as .py file
    exportPythonFile() {
        const code = this.codeInput.value || '';
        if (!code.trim()) { this.setFeedback('Aucun code à exporter.', 'warning'); return; }
        this.downloadText('algorithme.py', code, 'text/x-python');
    }

    exportJsonReport() {
        const report = this.buildAnalysisReport();
        this.downloadText(
            `algoexpert-report-${Date.now()}.json`,
            JSON.stringify(report, null, 2),
            'application/json'
        );
    }

    exportMarkdownReport() {
        const report = this.buildAnalysisReport();
        const lines = [];
        lines.push('# Rapport Mode Expert');
        lines.push('');
        lines.push(`- Date: ${new Date(report.generatedAt).toLocaleString('fr-FR')}`);
        lines.push(`- Étapes: ${report.trace.stepCount}`);
        lines.push(`- Couverture: ${report.metrics.coverage}`);
        lines.push(`- Complexité: ${report.metrics.complexity}`);
        lines.push('');
        lines.push('## Diagnostics');
        if (!report.diagnostics.length) {
            lines.push('- Aucun diagnostic.');
        } else {
            report.diagnostics.forEach((diag) => {
                lines.push(`- [${diag.severity}] ${diag.code} ${diag.lineNo ? `(ligne ${diag.lineNo})` : ''}: ${diag.message}`);
            });
        }
        lines.push('');
        lines.push('## Trace (extrait)');
        report.trace.events.slice(0, 25).forEach((event) => {
            lines.push(`- #${event.step} L${event.lineNo} ${event.type}: ${event.details}`);
        });
        this.downloadText(
            `algoexpert-report-${Date.now()}.md`,
            lines.join('\n'),
            'text/markdown'
        );
    }

    exportScenarioPack() {
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            scenario: this.getScenarioPayload(),
            favorites: this.favorites
        };
        this.downloadText(
            `algoexpert-pack-${Date.now()}.json`,
            JSON.stringify(payload, null, 2),
            'application/json'
        );
    }

    importScenarioPack() {
        const file = this.importPackFileInput && this.importPackFileInput.files && this.importPackFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const payload = JSON.parse(String(reader.result || '{}'));
                if (payload.scenario) {
                    this.applyScenarioPayload(payload.scenario, true);
                }
                if (Array.isArray(payload.favorites)) {
                    this.favorites = payload.favorites.slice(0, 30);
                    this.refreshFavoritesUi();
                }
                this.captureEditorSnapshot('pack');
                this.persistStateSnapshot();
                this.setFeedback('Pack importé avec succès.', 'ok');
            } catch {
                this.setFeedback('Import de pack impossible (JSON invalide).', 'bad');
            } finally {
                if (this.importPackFileInput) this.importPackFileInput.value = '';
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    handleImportPythonFile() {
        const file = this.importPyFileInput.files && this.importPyFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.codeInput.value = String(reader.result || '');
            this.captureEditorSnapshot('import_py');
            this.persistStateSnapshot();
            this.setFeedback(`Code importé depuis ${file.name}.`, 'ok');
            this.importPyFileInput.value = '';
        };
        reader.readAsText(file, 'utf-8');
    }

    printCurrentReport() {
        window.print();
    }

    saveCurrentFavorite() {
        const name = window.prompt('Nom du favori:', `Scénario ${this.favorites.length + 1}`);
        if (!name) return;
        const entry = {
            id: `fav-${Date.now()}`,
            name: name.trim(),
            scenario: this.getScenarioPayload()
        };
        this.favorites.unshift(entry);
        this.favorites = this.favorites.slice(0, 30);
        this.refreshFavoritesUi();
        this.persistStateSnapshot();
        this.setFeedback('Favori enregistré.', 'ok');
    }

    loadFavoriteFromSelect(showMessage = true) {
        const id = this.favoritesSelect.value;
        if (!id) return;
        let entry = this.favorites.find((item) => item.id === id);
        if (!entry) entry = AlgorithmExpertLab.BUILTIN_EXAMPLES.find((item) => item.id === id);
        if (!entry) return;
        this.applyScenarioPayload(entry.scenario, !showMessage);
        this.captureEditorSnapshot('favorite');
        if (showMessage) {
            this.setFeedback(`Chargé : ${entry.name}.`, 'ok');
        }
    }

    refreshFavoritesUi() {
        if (!this.favoritesSelect) return;
        const first = '<option value="">Exemples &amp; favoris</option>';
        const builtins = AlgorithmExpertLab.BUILTIN_EXAMPLES.map((e) => (
            `<option value="${this.escapeHtml(e.id)}">${this.escapeHtml(e.name)}</option>`
        ));
        const builtinGroup = `<optgroup label="Exemples de démarrage">${builtins.join('')}</optgroup>`;
        const userOptions = this.favorites.map((e) => (
            `<option value="${this.escapeHtml(e.id)}">${this.escapeHtml(e.name)}</option>`
        ));
        const userGroup = userOptions.length > 0
            ? `<optgroup label="Mes favoris">${userOptions.join('')}</optgroup>`
            : '';
        this.favoritesSelect.innerHTML = [first, builtinGroup, userGroup].join('');
    }

    applyDensityFromControl() {
        this.container.classList.remove('dense', 'comfortable');
        const mode = String(this.densitySelect.value || 'dense');
        this.container.classList.add(mode === 'comfortable' ? 'comfortable' : 'dense');
        this.persistStateSnapshot();
    }

    toggleFullscreen() {
        this.container.classList.toggle('is-fullscreen');
        if (this.fullscreenBtn) {
            this.fullscreenBtn.textContent = this.container.classList.contains('is-fullscreen')
                ? 'Quitter plein écran' : 'Plein écran';
        }
    }

    applyTraceSearch() {
        this.traceSearchTerm = this.traceSearchInput
            ? String(this.traceSearchInput.value || '').trim().toLowerCase()
            : '';
        this.renderTrace();
    }

    downloadText(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    emitLearningEvent(type, payload = {}) {
        const eventPayload = {
            type,
            payload,
            ts: Date.now()
        };
        this.xapiLog.push(eventPayload);
        this.xapiLog = this.xapiLog.slice(-400);
        window.dispatchEvent(new CustomEvent('algoexpert:event', { detail: eventPayload }));
    }

    attachPublicApi() {
        window.AlgorithmExpertAPI = {
            analyze: () => this.analyzeCode(),
            reset: () => this.resetExecution(),
            getReport: () => this.buildAnalysisReport(),
            getTrace: () => this.events.map((event) => this.deepClone(event)),
            loadScenario: (payload) => this.applyScenarioPayload(payload),
            exportScenario: () => this.getScenarioPayload()
        };
    }

    // P3: Tab switching logic — moved from inline <script> in HTML
    initTabs() {
        const tabs = this.container.querySelectorAll('.algoexpert-tab');
        const panels = this.container.querySelectorAll('.algoexpert-tabpanel');
        if (!tabs.length) return;
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach((t) => {
                    t.classList.toggle('active', t === tab);
                    t.setAttribute('aria-selected', String(t === tab));
                });
                panels.forEach((panel) => {
                    panel.classList.toggle('hidden', panel.dataset.tabpanel !== target);
                });
            });
        });
    }

    // P4: Python subset reference — generated from JS config, inserted into #algoexpert-subset-grid
    renderPythonSubset() {
        const target = document.getElementById('algoexpert-subset-grid');
        if (!target) return;

        const col1 = [
            { title: 'Structures de contrôle', items: [
                '<code>def f(params):</code> — définition de fonction',
                '<code>return expr</code> — valeur de retour',
                '<code>if / elif / else</code> — branchements',
                '<code>for i in range(n)</code> — boucle numérique',
                '<code>for x in liste</code> — boucle sur itérable',
                '<code>for i, x in enumerate(liste)</code> — indice + valeur',
                '<code>for k, v in d.items():</code> — paires dict',
                '<code>while condition:</code> — boucle while',
                '<code>break</code> — sortie de boucle',
                '<code>continue</code> — itération suivante'
            ]},
            { title: 'Affectations', items: [
                '<code>x = expr</code> — affectation simple',
                '<code>x += 1</code> &nbsp;<code>-=</code> &nbsp;<code>*=</code> &nbsp;<code>//=</code> &nbsp;<code>/=</code> &nbsp;<code>%=</code>',
                '<code>d[k] += 1</code> — augmenté sur dict/liste',
                '<code>a, b = b, a</code> — déstructuration / échange',
                '<code>liste[i] = val</code> &nbsp;<code>d[k] = val</code> — affectation indexée'
            ]}
        ];

        const col2 = [
            { title: 'Types &amp; opérateurs', items: [
                'Entiers, flottants, booléens (<code>True/False</code>), <code>None</code>',
                'Chaînes : littéraux, <code>f"texte {x}"</code>, concaténation <code>+</code>, répétition <code>"x"*3</code>',
                'Listes : <code>[1, 2]</code>, accès <code>T[i]</code>, <code>T[-1]</code>, slice <code>T[1:3]</code> <code>T[::2]</code>',
                'Opérateurs : <code>+, -, *, //, /, %</code>',
                'Comparaisons : <code>==, !=, &lt;, &gt;, &lt;=, &gt;=</code>',
                'Appartenance : <code>x in T</code>, <code>x not in T</code>',
                'Logiques : <code>and, or, not</code>',
                'Concat. listes : <code>[1,2] + [3,4]</code>, répétition <code>[0]*n</code>'
            ]},
            { title: 'Fonctions intégrées', items: [
                '<code>len(x)</code> &nbsp;<code>range(n)</code> &nbsp;<code>range(a, b)</code> &nbsp;<code>range(a, b, pas)</code>',
                '<code>abs(x)</code> &nbsp;<code>min(a, b)</code> &nbsp;<code>max(a, b)</code> &nbsp;<code>sum(liste)</code>',
                '<code>min(liste)</code> &nbsp;<code>max(liste)</code>',
                '<code>sorted(liste)</code> — copie triée &nbsp;<code>reversed(liste)</code> — copie inversée',
                '<code>int(x)</code> &nbsp;<code>float(x)</code> &nbsp;<code>str(x)</code> &nbsp;<code>bool(x)</code> — conversions',
                '<code>print(x)</code> — capturé en trace'
            ]},
            { title: 'Méthodes de liste', items: [
                '<code>T.append(x)</code> — ajout en fin',
                '<code>T.pop()</code> — suppression en fin',
                '<code>T.sort()</code> — tri en place',
                '<code>T.count(x)</code> &nbsp;<code>T.index(x)</code> — en expression'
            ]},
            { title: 'Méthodes de chaîne', items: [
                '<code>s.upper()</code> &nbsp;<code>s.lower()</code> &nbsp;<code>s.strip()</code>',
                '<code>s.replace(a, b)</code> &nbsp;<code>s.split(sep)</code>',
                '<code>s.startswith(p)</code> &nbsp;<code>s.endswith(p)</code>',
                '<code>s.find(sub)</code> &nbsp;<code>s.count(sub)</code> &nbsp;<code>sep.join(liste)</code>'
            ]},
            { title: 'Dictionnaires', items: [
                '<code>d = {"a": 1}</code> — littéral',
                '<code>d[k]</code> &nbsp;<code>d[k] = v</code> &nbsp;<code>d[k] += n</code>',
                '<code>d.get(k, défaut)</code> &nbsp;<code>d.keys()</code> &nbsp;<code>d.values()</code> &nbsp;<code>d.items()</code>',
                '<code>for k in d:</code> &nbsp;<code>for k, v in d.items():</code>'
            ]},
            { title: 'Non supporté', cls: ' algoexpert-subset-unsupported', items: [
                'Classes, lambda, compréhensions de liste',
                '<code>import</code>, <code>try/except</code>, <code>with</code>'
            ]}
        ];

        const renderCol = (groups) => groups.map(({ title, cls = '', items }) =>
            `<h4>${title}</h4><ul class="algoexpert-subset-list${cls}">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
        ).join('');

        target.innerHTML = `<div class="algoexpert-subset-col">${renderCol(col1)}</div><div class="algoexpert-subset-col">${renderCol(col2)}</div>`;
    }


    deepClone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }

    parseInputs() {
        const raw = String(this.inputsInput.value || '').trim();
        if (!raw) return {};
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            throw new Error('Entrées JSON invalides.');
        }
        if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Les entrées doivent être un objet JSON clé/valeur.');
        }
        return parsed;
    }

    analyzeCode() {
        this.stopAuto();
        this.engine.expressionCache.clear();
        this.contract = null;
        this.predictionState = this.createEmptyPredictionState();
        this.sessionStats = this.createEmptySessionStats();
        this.summaryBox.classList.add('hidden');
        this.setPredictFeedback('', '');
        this.onOptionsChanged();
        this.captureEditorSnapshot('analyze');
        this.persistStateSnapshot();

        try {
            const source = String(this.codeInput.value || '');
            const inputValues = this.parseInputs();
            const program = this.engine.parseProgram(source);
            const entry = program.order[0];
            const entryDef = entry ? program.functions[entry] : null;
            const contract = this.contracts.inferInputContract(program, inputValues);
            const validation = this.contracts.validateInputsAgainstContract(inputValues, contract);
            const generatedTests = this.contracts.generateCategorizedTests(contract, inputValues);

            this.program = program;
            this.contract = contract;
            this.generatedTests = generatedTests;
            const staticAnalysis = this.diag.runStaticAnalysis(program, entryDef, contract);
            this.analysisArtifacts = {
                cfg: staticAnalysis.cfg,
                ssa: staticAnalysis.ssa,
                intervals: staticAnalysis.intervals,
                invariants: staticAnalysis.invariants,
                ruleCoverage: staticAnalysis.ruleCoverage
            };

            if (!validation.valid) {
                this.execution = null;
                this.events = [];
                this.executionIndex = -1;

                const diagnostics = this.diag.dedupeDiagnostics([
                    ...staticAnalysis.diagnostics,
                    ...this.diag.validationErrorsToDiagnostics(validation.errors)
                ]);
                this.diagnostics = diagnostics;
                this.renderDiagnostics(diagnostics);
                this.renderTests(this.generatedTests);
                this.renderV3(null);
                this.renderAdvancedArtifacts();

                this.preparePredictionForCurrentEvent(true);
                this.render();
                this.analysisReport = this.buildAnalysisReport();
                this.setFeedback(`Entrées invalides détectées (${validation.errors.length}). Consultez les diagnostics détaillés.`, 'bad');
                this.emitLearningEvent('analysis_failed_validation', {
                    errorCount: validation.errors.length
                });
                return;
            }

            const execution = this.engine.executeProgram(program, inputValues, contract);
            this.execution = execution;
            this.events = execution.events;
            this.executionIndex = -1;

            const diagnostics = this.diag.dedupeDiagnostics([
                ...staticAnalysis.diagnostics,
                ...this.diag.validationErrorsToDiagnostics(validation.errors),
                ...(execution.diagnostics || [])
            ]);
            this.diagnostics = diagnostics;
            this.renderDiagnostics(diagnostics);
            this.renderTests(this.generatedTests);
            this.renderV3(execution);
            this.renderAdvancedArtifacts();

            this.preparePredictionForCurrentEvent(true);
            this.render();
            const kind = this.contracts.classifyValidInputKind(inputValues, contract);
            if (execution.runtimeError) {
                this.setFeedback(
                    `Analyse partielle: ${this.events.length} étape(s) jusqu'à interruption. Entrées: ${kind}. ${this.engine.describeRuntimeError(execution.runtimeError)}`,
                    'warning'
                );
            } else {
                this.setFeedback(`Analyse réussie: ${this.events.length} étape(s) générée(s). Entrées: ${kind}.`, 'ok');
            }
            this.analysisReport = this.buildAnalysisReport();
            this.saveToHistory();
            this.emitLearningEvent('analysis_ok', {
                steps: this.events.length,
                diagnostics: diagnostics.length
            });
        } catch (error) {
            this.contract = null;
            this.program = null;
            this.execution = null;
            this.events = [];
            this.executionIndex = -1;
            this.generatedTests = [];
            this.diagnostics = [];
            this.analysisArtifacts = {
                cfg: null,
                ssa: null,
                intervals: null,
                invariants: [],
                ruleCoverage: []
            };
            this.renderDiagnostics([]);
            this.renderTests([]);
            this.renderV3(null);
            this.renderAdvancedArtifacts();
            this.render();
            this.setFeedback(error.message || 'Analyse impossible.', 'bad');
            this.emitLearningEvent('analysis_error', {
                message: error.message || 'unknown'
            });
        }
    }

    resetExecution() {
        this.stopAuto();
        this.executionIndex = -1;
        this.predictionState = this.createEmptyPredictionState();
        this.sessionStats = this.createEmptySessionStats();
        this.predictionHistory = [];
        this.summaryBox.classList.add('hidden');
        this.preparePredictionForCurrentEvent(true);
        this.render();
        this.setFeedback('Retour avant la première étape.', 'info');
        this.emitLearningEvent('reset', {});
    }

    currentEventIndex() {
        const index = this.executionIndex + 1;
        return index >= 0 && index < this.events.length ? index : -1;
    }

    currentEvent() {
        const index = this.currentEventIndex();
        return index >= 0 ? this.events[index] : null;
    }

    lastExecutedEvent() {
        return this.executionIndex >= 0 ? this.events[this.executionIndex] : null;
    }

    preparePredictionForCurrentEvent(force = false) {
        const currentIndex = this.currentEventIndex();
        if (currentIndex < 0) {
            this.predictionState = this.createEmptyPredictionState();
            this.renderPredictionPanel();
            return;
        }

        if (!force && this.predictionState.eventIndex === currentIndex) {
            this.renderPredictionPanel();
            return;
        }

        const event = this.events[currentIndex];
        const prediction = this.buildPredictionForEvent(event);
        this.predictionState = {
            eventIndex: currentIndex,
            required: prediction.required,
            validated: false,
            expectedType: prediction.expectedType,
            expectedValue: prediction.expectedValue,
            question: prediction.question,
            pitfallCategory: prediction.pitfallCategory || 'condition'
        };

        const stepKey = String(currentIndex);
        if (!this.sessionStats.askedSteps.has(stepKey) && prediction.required) {
            this.sessionStats.askedSteps.add(stepKey);
        }

        this.predictNumber.value = '';
        this.predictBool.value = '';
        this.predictText.value = '';

        if (prediction.required) {
            this.setPredictFeedback('Faites une prédiction puis validez.', 'info');
        } else {
            this.setPredictFeedback('Cette étape ne nécessite pas de prédiction explicite.', 'info');
        }

        this.renderPredictionPanel();
    }

    buildPredictionForEvent(event) {
        const base = {
            required: true,
            expectedType: 'number',
            expectedValue: 0,
            question: 'Quelle valeur est attendue ?',
            pitfallCategory: event.pitfallCategory || 'condition'
        };

        if (event.type === 'if' || event.type === 'while') {
            return {
                ...base,
                expectedType: 'bool',
                expectedValue: event.conditionResult ? 'vrai' : 'faux',
                question: 'La condition évaluée sera-t-elle vraie ou fausse ?'
            };
        }

        if (event.arrayUpdate) {
            return {
                ...base,
                expectedType: typeof event.arrayUpdate.value === 'number' ? 'number' : 'text',
                expectedValue: event.arrayUpdate.value,
                question: `Après cette ligne, quelle est la valeur de ${event.arrayUpdate.name}[${event.arrayUpdate.index}] ?`
            };
        }

        const changed = event.changedKeys || [];
        const scalarChange = changed.find((key) => {
            const value = event.after[key];
            return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string';
        });

        if (scalarChange) {
            const expected = event.after[scalarChange];
            return {
                ...base,
                expectedType: typeof expected === 'number' ? 'number' : (typeof expected === 'boolean' ? 'bool' : 'text'),
                expectedValue: typeof expected === 'boolean' ? (expected ? 'vrai' : 'faux') : expected,
                question: `Après cette ligne, quelle est la valeur de ${scalarChange} ?`
            };
        }

        if (event.type === 'return') {
            const expected = event.returnValue;
            return {
                ...base,
                expectedType: typeof expected === 'number' ? 'number' : (typeof expected === 'boolean' ? 'bool' : 'text'),
                expectedValue: typeof expected === 'boolean' ? (expected ? 'vrai' : 'faux') : expected,
                question: 'Quelle est la valeur retournée par cette ligne ?'
            };
        }

        return {
            ...base,
            required: true,
            expectedType: 'text',
            expectedValue: event.type,
            question: 'Quel type d\'action est exécuté (assign, if, for, while, break, return) ?'
        };
    }

    validatePrediction() {
        if (!this.predictionState.required) return;
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
            if (!/^-?\d+(?:\.\d+)?$/.test(raw)) {
                this.setPredictFeedback('La prédiction numérique est invalide.', 'bad');
                return;
            }
            userValue = Number(raw);
        } else if (this.predictionState.expectedType === 'bool') {
            userValue = String(this.predictBool.value || '');
            if (!userValue) {
                this.setPredictFeedback('Choisissez vrai ou faux.', 'warning');
                return;
            }
        } else {
            userValue = String(this.predictText.value || '').trim();
            if (!userValue.length) {
                this.setPredictFeedback('Entrez une valeur texte.', 'warning');
                return;
            }
        }

        const expected = this.predictionState.expectedValue;
        const isCorrect = String(userValue) === String(expected);
        const historyEntry = {
            step: this.predictionState.eventIndex + 1,
            question: this.predictionState.question,
            userValue,
            expected,
            correct: isCorrect,
            category: this.predictionState.pitfallCategory || 'condition',
            ts: Date.now()
        };
        this.predictionHistory.unshift(historyEntry);
        this.predictionHistory = this.predictionHistory.slice(0, 120);

        if (isCorrect) {
            this.predictionState.validated = true;
            this.sessionStats.correctSteps.add(String(this.predictionState.eventIndex));
            this.setPredictFeedback('Prédiction correcte. Passage à l\'étape suivante.', 'ok');
            this.setFeedback('Bonne anticipation.', 'ok');
            this.confusionOutput.textContent = 'Aucune confusion détectée sur cette étape.';
            this.emitLearningEvent('prediction_ok', {
                step: historyEntry.step,
                category: historyEntry.category
            });
            this.updateMiniQuiz();
            this.renderPredictionHistory();
            this.nextStep();
            return;
        } else {
            this.sessionStats.wrongAttempts += 1;
            const category = this.predictionState.pitfallCategory || 'condition';
            if (this.sessionStats.byCategory[category] != null) {
                this.sessionStats.byCategory[category] += 1;
            }
            this.setPredictFeedback(`Prédiction incorrecte. Attendu: ${expected}.`, 'bad');
            this.setFeedback('Corrigez la prédiction avant de continuer.', 'warning');
            this.confusionOutput.textContent = this.guessConfusionMessage(historyEntry);
            this.emitLearningEvent('prediction_wrong', {
                step: historyEntry.step,
                category
            });
        }

        this.renderPredictionHistory();
        this.updateMiniQuiz();
        this.renderPredictionPanel();
    }

    canExecuteCurrentEvent() {
        if (!this.predictionState.required) return true;
        if (this.predictionState.validated) return true;
        this.setFeedback('Validez la prédiction de l\'étape courante.', 'warning');
        this.setPredictFeedback('Prédiction obligatoire avant exécution.', 'warning');
        return false;
    }

    nextStep() {
        const currentIndex = this.currentEventIndex();
        if (currentIndex < 0) {
            this.setFeedback('Dernière étape atteinte.', 'warning');
            return false;
        }

        if (!this.canExecuteCurrentEvent()) return false;

        this.executionIndex = currentIndex;
        this.preparePredictionForCurrentEvent(true);
        this.render();
        this.emitLearningEvent('step', { step: this.executionIndex + 1 });
        return true;
    }

    // P2: navigate backwards in the trace
    prevStep() {
        if (this.executionIndex < 0) {
            this.setFeedback('Déjà à la première étape.', 'info');
            return false;
        }
        this.executionIndex -= 1;
        this.preparePredictionForCurrentEvent(true);
        this.render();
        this.emitLearningEvent('step_back', { step: this.executionIndex + 1 });
        return true;
    }

    stopAuto() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.updateAutoPlayBtn();
    }

    // P6: force-advance one step bypassing prediction requirement (used by auto-play)
    forceStep() {
        const currentIndex = this.currentEventIndex();
        if (currentIndex < 0) { this.stopAuto(); return false; }
        this.executionIndex = currentIndex;
        this.preparePredictionForCurrentEvent(true);
        this.render();
        return true;
    }

    // P6: start auto-play loop at given speed (ms per step)
    startAuto(delayMs = 1200) {
        this.stopAuto();
        if (!this.events.length) { this.setFeedback('Analysez le code avant de lancer la lecture.', 'warning'); return; }
        const step = () => {
            if (!this.forceStep()) return;
            this.autoTimer = setTimeout(step, delayMs);
            this.updateAutoPlayBtn();
        };
        step();
        this.updateAutoPlayBtn();
    }

    // P6: toggle auto-play on/off
    toggleAutoPlay() {
        if (this.autoTimer) {
            this.stopAuto();
        } else {
            const delay = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
            this.startAuto(delay);
        }
    }

    updateAutoPlayBtn() {
        const btn = document.getElementById('algoexpert-autoplay');
        if (!btn) return;
        if (this.autoTimer) {
            btn.textContent = '⏸ Pause';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-secondary');
        } else {
            btn.textContent = '▶ Lecture';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        }
    }

    renderPredictionPanel() {
        if (!this.predictionState.required) {
            this.predictQuestion.textContent = 'Aucune prédiction requise pour cette étape.';
            this.predictNumber.classList.add('hidden');
            this.predictBool.classList.add('hidden');
            this.predictText.classList.add('hidden');
            this.predictValidateBtn.disabled = true;
            return;
        }

        const stepNumber = this.predictionState.eventIndex + 1;
        this.predictQuestion.textContent = `Étape ${stepNumber}: ${this.predictionState.question}`;

        const type = this.predictionState.expectedType;
        this.predictNumber.classList.toggle('hidden', type !== 'number');
        this.predictBool.classList.toggle('hidden', type !== 'bool');
        this.predictText.classList.toggle('hidden', type !== 'text');

        this.predictNumber.disabled = type !== 'number' || this.predictionState.validated;
        this.predictBool.disabled = type !== 'bool' || this.predictionState.validated;
        this.predictText.disabled = type !== 'text' || this.predictionState.validated;
        this.predictValidateBtn.disabled = this.predictionState.validated;
    }

    render() {
        this.renderCodeLines();
        this.renderVariables();
        this.renderCallStack(); // M2
        this.renderCallTree();  // V2
        this.renderTrace();
        this.renderTutor();
        this.renderPredictionPanel();
        this.renderSummary();
        this.renderPredictionHistory();
        this.renderNotionProgress();
        this.updateMiniQuiz();
    }

    renderCodeLines() {
        const sourceLines = (this.program && this.program.displayLines) || [];
        const current = this.currentEvent();
        const fallback = this.lastExecutedEvent();
        const activeLine = (current && current.lineNo) || (fallback && fallback.lineNo) || -1;

        if (!sourceLines.length) {
            this.codeLinesOutput.innerHTML = '<li class="text-muted">Aucun code analysé.</li>';
            return;
        }

        this.codeLinesOutput.innerHTML = sourceLines
            .map((line) => {
                const activeClass = line.lineNo === activeLine ? ' active' : '';
                return `<li class="algoexpert-code-line${activeClass}"><span class="line-no">${line.lineNo}</span><code>${this.escapeHtml(line.text || '')}</code></li>`;
            })
            .join('');

        const currentIndex = this.currentEventIndex();
        const total = this.events.length;
        const shown = currentIndex >= 0 ? (currentIndex + 1) : total;
        this.stepIndicator.textContent = `${total ? shown : 0} / ${total}`;
        // P7: update visual progress bar
        const progressBar = document.getElementById('algoexpert-step-progress');
        if (progressBar && total > 0) {
            const pct = Math.round(((shown) / total) * 100);
            progressBar.value = shown;
            progressBar.max = total;
            progressBar.title = `${pct}%`;
        }
    }

    renderVariables() {
        // P8: blind mode — hide variables while a prediction is pending (not yet validated)
        const blindMode = this.blindModeToggle && this.blindModeToggle.checked;
        if (blindMode && this.currentEvent()) {
            this.varsOutput.innerHTML = '<span class="algoexpert-blind-hint">Variables masquées — faites votre prédiction, puis validez pour les révéler.</span>';
            return;
        }

        const current = this.currentEvent();
        const executed = this.lastExecutedEvent();
        const vars = current ? current.before : (executed ? executed.after : {});
        const prevEvent = this.executionIndex >= 1 ? this.events[this.executionIndex - 1] : null;
        const prevVars = prevEvent ? prevEvent.after : {};
        // Highlighted cells from arrayUpdate on the last executed event
        const arrayUpdate = executed ? executed.arrayUpdate : null;
        const entries = Object.entries(vars || {});
        if (!entries.length) {
            this.varsOutput.innerHTML = '<span class="text-muted">Aucune variable pour le moment.</span>';
            return;
        }
        // P1: render arrays as visual cell grid, scalars as badges
        const parts = entries.map(([key, value]) => {
            if (Array.isArray(value)) {
                const prevArr = Array.isArray(prevVars[key]) ? prevVars[key] : null;
                const cells = value.map((item, idx) => {
                    let cls = 'algoexpert-arr-cell';
                    if (arrayUpdate && arrayUpdate.name === key && arrayUpdate.index === idx) {
                        cls += ' changed';
                    } else if (prevArr && JSON.stringify(prevArr[idx]) !== JSON.stringify(item)) {
                        cls += ' changed';
                    }
                    return `<span class="${cls}" title="${this.escapeHtml(key)}[${idx}]">${this.escapeHtml(this.stringifyShort(item))}</span>`;
                });
                const label = `<span class="algoexpert-arr-label">${this.escapeHtml(key)}</span>`;
                return `<div class="algoexpert-arr-row">${label}<span class="algoexpert-arr-bracket">[</span>${cells.join('')}<span class="algoexpert-arr-bracket">]</span></div>`;
            }
            const changed = JSON.stringify(prevVars[key]) !== JSON.stringify(value);
            const isNumeric = typeof value === 'number';
            const isActive = this.selectedTimelineVar === key;
            return `<span class="algoexpert-var${changed ? ' changed' : ''}${isActive ? ' timeline-active' : ''}"${isNumeric ? ` data-varname="${this.escapeHtml(key)}" title="Cliquer pour voir l'historique"` : ''}>${this.escapeHtml(key)} = ${this.escapeHtml(this.stringifyShort(value))}</span>`;
        });
        this.varsOutput.innerHTML = parts.join('');

        // V1: bind click handlers for timeline
        this.varsOutput.querySelectorAll('[data-varname]').forEach((el) => {
            el.addEventListener('click', () => {
                const v = el.dataset.varname;
                this.selectedTimelineVar = (this.selectedTimelineVar === v) ? null : v;
                this.renderTimeline();
                this.renderVariables();
            });
        });
        this.renderTimeline();
    }

    // M2: Call stack display
    renderCallStack() {
        if (!this.callStackOutput) return;
        const event = this.currentEvent() || this.lastExecutedEvent();
        const stack = (event && event.callStack) ? event.callStack : [];
        if (stack.length <= 1) {
            this.callStackOutput.classList.add('hidden');
            return;
        }
        this.callStackOutput.classList.remove('hidden');
        const frames = stack.map((f, i) => {
            const isActive = i === stack.length - 1;
            return `<span class="algoexpert-cs-frame${isActive ? ' cs-active' : ''}">${this.escapeHtml(f.name)}(${this.escapeHtml(f.args || '')})</span>`;
        }).join('<span class="algoexpert-cs-arrow"> → </span>');
        this.callStackOutput.innerHTML = `<span class="algoexpert-cs-label">Pile :</span>${frames}`;
    }

    // V1: Variable numeric timeline (sparkline)
    renderTimeline() {
        if (!this.timelineOutput) return;
        const varName = this.selectedTimelineVar;
        if (!varName) { this.timelineOutput.classList.add('hidden'); return; }

        const maxIdx = this.executionIndex >= 0 ? this.executionIndex : -1;
        const history = [];
        for (let i = 0; i <= maxIdx; i++) {
            const ev = this.events[i];
            if (ev && ev.after && Object.prototype.hasOwnProperty.call(ev.after, varName)) {
                const val = ev.after[varName];
                if (typeof val === 'number') history.push({ step: i + 1, value: val });
            }
        }

        this.timelineOutput.classList.remove('hidden');
        if (history.length < 2) {
            this.timelineOutput.innerHTML = `<span class="algoexpert-timeline-label">${this.escapeHtml(varName)}</span><span class="text-muted" style="font-size:0.8rem"> — pas assez d'historique numérique</span><button class="algoexpert-timeline-close" title="Fermer">×</button>`;
        } else {
            const W = 280; const H = 52; const PAD = 6;
            const values = history.map((h) => h.value);
            const minV = Math.min(...values);
            const maxV = Math.max(...values);
            const rangeV = maxV === minV ? 1 : maxV - minV;
            const x = (idx) => PAD + (idx / (history.length - 1)) * (W - 2 * PAD);
            const y = (v) => H - PAD - ((v - minV) / rangeV) * (H - 2 * PAD);
            const pts = history.map((h, i) => `${x(i)},${y(h.value)}`).join(' ');
            const dots = history.map((h, i) => `<circle cx="${x(i)}" cy="${y(h.value)}" r="2.5" fill="var(--primary)"/>`).join('');
            const svg = `<svg width="${W}" height="${H}" class="algoexpert-sparkline" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--primary)" stroke-width="1.5"/>${dots}<text x="${PAD}" y="${H}" font-size="9" fill="var(--muted)">${minV}</text><text x="${W - PAD}" y="${H}" text-anchor="end" font-size="9" fill="var(--muted)">${maxV}</text></svg>`;
            this.timelineOutput.innerHTML = `<span class="algoexpert-timeline-label">${this.escapeHtml(varName)}</span>${svg}<button class="algoexpert-timeline-close" title="Fermer">×</button>`;
        }
        this.timelineOutput.querySelector('.algoexpert-timeline-close').addEventListener('click', () => {
            this.selectedTimelineVar = null;
            this.renderTimeline();
            this.renderVariables();
        });
    }

    // V2: Call tree SVG (rendered in Avancé tab)
    renderCallTree() {
        if (!this.callTreeOutput) return;
        // Only re-render when execution object changes (not on every step)
        if (this._lastCallTreeExecution === this.execution) return;
        this._lastCallTreeExecution = this.execution;
        const tree = this.execution ? this.execution.callTree : null;
        if (!tree || !tree.children || tree.children.length === 0) {
            this.callTreeOutput.innerHTML = '<span class="text-muted">Aucun appel récursif détecté.</span>';
            return;
        }

        // Assign left positions using DFS (Reingold-Tilford simplified)
        let leafIndex = 0;
        const NODE_W = 130; const NODE_H = 36; const H_GAP = 8; const V_GAP = 48;
        let nodeCount = 0;

        const assignPos = (node, depth) => {
            node._depth = depth;
            nodeCount++;
            if (nodeCount > 120) { node._x = 0; return; } // cap
            if (!node.children.length) {
                node._x = leafIndex * (NODE_W + H_GAP);
                leafIndex++;
            } else {
                node.children.forEach((c) => assignPos(c, depth + 1));
                const first = node.children[0]._x;
                const last = node.children[node.children.length - 1]._x;
                node._x = (first + last) / 2;
            }
        };
        assignPos(tree, 0);

        const maxDepth = (() => { const d = (n) => n.children.length ? 1 + Math.max(...n.children.map(d)) : 0; return d(tree); })();
        const svgW = Math.max(leafIndex * (NODE_W + H_GAP) + H_GAP, NODE_W + 2 * H_GAP);
        const svgH = (maxDepth + 1) * (NODE_H + V_GAP) + V_GAP;
        const nx = (n) => n._x + NODE_W / 2;
        const ny = (n) => V_GAP / 2 + n._depth * (NODE_H + V_GAP);

        let edges = ''; let nodes = '';
        const drawEdges = (n) => {
            if (nodeCount > 120) return;
            n.children.forEach((c) => {
                edges += `<line x1="${nx(n)}" y1="${ny(n) + NODE_H}" x2="${nx(c)}" y2="${ny(c)}" class="algoexpert-tree-edge"/>`;
                drawEdges(c);
            });
        };
        const drawNodes = (n) => {
            const label = `${n.name}(${n.args})`;
            const shortLabel = label.length > 20 ? label.slice(0, 18) + '…' : label;
            const ret = n.returnValue !== null && n.returnValue !== undefined ? this.escapeHtml(this.stringifyShort(n.returnValue)) : '';
            const isLeaf = !n.children.length;
            nodes += `<rect x="${n._x}" y="${ny(n)}" width="${NODE_W}" height="${NODE_H}" rx="4" class="algoexpert-tree-node${isLeaf ? ' tree-leaf' : ''}"/>`;
            nodes += `<text x="${nx(n)}" y="${ny(n) + 14}" text-anchor="middle" class="algoexpert-tree-text">${this.escapeHtml(shortLabel)}</text>`;
            if (ret) nodes += `<text x="${nx(n)}" y="${ny(n) + 28}" text-anchor="middle" class="algoexpert-tree-ret">→ ${ret}</text>`;
            n.children.forEach(drawNodes);
        };
        drawEdges(tree);
        drawNodes(tree);

        const warning = nodeCount > 120 ? '<p class="text-muted" style="font-size:0.8rem">Arbre tronqué (> 120 appels)</p>' : '';
        this.callTreeOutput.innerHTML = `${warning}<div class="algoexpert-calltree-wrap"><svg width="${svgW}" height="${svgH}" class="algoexpert-calltree-svg">${edges}${nodes}</svg></div>`;
    }

    renderTrace() {
        if (!this.events.length) {
            this.traceBody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucune trace générée.</td></tr>';
            return;
        }

        if (this.executionIndex < 0) {
            this.traceBody.innerHTML = '<tr><td colspan="5" class="text-muted">Validez la première prédiction pour lancer la trace.</td></tr>';
            return;
        }

        const rows = [];
        for (let i = 0; i <= this.executionIndex; i += 1) {
            rows.push(this.events[i]);
        }

        this.traceBody.innerHTML = rows
            .map((event, index) => {
                const active = index === rows.length - 1 ? 'active-row' : '';
                const lineMatch = this.traceSearchTerm
                    && `${event.lineNo} ${event.type} ${event.details} ${this.stringifyShort(event.after)}`.toLowerCase().includes(this.traceSearchTerm);
                const rowClass = [active, lineMatch ? 'trace-match' : ''].filter(Boolean).join(' ');
                return `<tr class="${rowClass}">
                    <td>${index + 1}</td>
                    <td>${event.lineNo}</td>
                    <td>${this.escapeHtml(event.type)}</td>
                    <td>${this.escapeHtml(event.details)}</td>
                    <td>${this.escapeHtml(this.stringifyShort(event.after))}</td>
                </tr>`;
            })
            .join('');
    }

    renderTutor() {
        const current = this.currentEvent();
        const executed = this.lastExecutedEvent();
        const event = current || executed;
        const hintLevel = this.executionOptions.hintLevel || 1;
        const tutorMode = this.executionOptions.tutorMode || 'td';

        if (!event) {
            this.tutorObjective.textContent = 'Analysez un code pour démarrer.';
            this.tutorWhy.textContent = 'Le guidage apparaîtra étape par étape.';
            this.tutorPitfall.textContent = 'Commencez avec une fonction Python simple.';
            this.sessionObjective.textContent = 'Objectif de session: atteindre 80% de prédictions correctes.';
            this.renderNotionProgress();
            return;
        }

        const objective = current
            ? (event.objective || 'Prévoir l\'effet de la ligne courante.')
            : 'Simulation terminée.';
        const why = event.why || 'Raison pédagogique non disponible.';
        const pitfall = event.pitfall || 'Vérifiez bornes, conditions et mises à jour.';

        if (tutorMode === 'exam') {
            this.tutorObjective.textContent = `[Examen] ${objective}`;
            this.tutorWhy.textContent = hintLevel >= 2
                ? 'Indice réduit: identifiez seul la règle en jeu.'
                : why;
            this.tutorPitfall.textContent = hintLevel >= 3
                ? 'Aucun piège explicité (mode examen).'
                : pitfall;
        } else {
            this.tutorObjective.textContent = objective;
            if (hintLevel === 1) {
                this.tutorWhy.textContent = why;
                this.tutorPitfall.textContent = pitfall;
            } else if (hintLevel === 2) {
                this.tutorWhy.textContent = `${why} (version condensée)`;
                this.tutorPitfall.textContent = `Attention: ${pitfall}`;
            } else {
                this.tutorWhy.textContent = 'Indice minimal: observez la variable qui change.';
                this.tutorPitfall.textContent = 'Indice minimal: vérifiez bornes et condition.';
            }
        }

        const asked = this.sessionStats.askedSteps.size;
        const correct = this.sessionStats.correctSteps.size;
        const ratio = asked ? Math.round((correct / asked) * 100) : 0;
        this.sessionObjective.textContent = tutorMode === 'exam'
            ? `Objectif examen: >= 85% de prédictions justes. Actuel: ${ratio}% (${correct}/${asked || 0}).`
            : `Objectif TD: >= 80% de prédictions justes. Actuel: ${ratio}% (${correct}/${asked || 0}).`;
        this.renderNotionProgress();
    }

    renderSummary() {
        const done = this.currentEventIndex() < 0 && this.events.length > 0;
        if (!done) {
            this.summaryBox.classList.add('hidden');
            this.renderPredictionHistory();
            return;
        }

        const asked = this.sessionStats.askedSteps.size;
        const correct = Math.min(this.sessionStats.correctSteps.size, asked);
        const ratio = asked > 0 ? Math.min(100, Math.round((correct / asked) * 100)) : 0;
        const hardest = Object.entries(this.sessionStats.byCategory)
            .sort((a, b) => b[1] - a[1])[0];

        this.summaryText.textContent = asked === 0
            ? 'Aucune prédiction demandée sur cette exécution.'
            : `Prédictions correctes: ${correct}/${asked} (${ratio}%). Point à retravailler: ${hardest[0]} (${hardest[1]}).`;

        this.summaryBox.classList.remove('hidden');
        this.renderPredictionHistory();
    }

    isDiagnosticVisible(diag) {
        const severity = (diag.severity || 'info').toLowerCase();
        if (severity === 'error') return this.diagShowError ? this.diagShowError.checked : true;
        if (severity === 'warning') return this.diagShowWarning ? this.diagShowWarning.checked : true;
        return this.diagShowInfo ? this.diagShowInfo.checked : true;
    }

    renderDiagnostics(diagnostics) {
        const normalized = this.diag.normalizeDiagnostics(diagnostics);
        this.diagnostics = normalized;
        const filtered = normalized.filter((diag) => this.isDiagnosticVisible(diag));

        if (!filtered.length) {
            this.diagnosticsOutput.innerHTML = '<li>Aucun point critique détecté sur les règles V2.</li>';
            return;
        }

        this.diagnosticsOutput.innerHTML = filtered
            .map((diag) => {
                const severityClass = this.escapeHtml(diag.severity || 'info');
                const lineLabel = diag.lineNo != null ? `ligne ${diag.lineNo}` : 'globale';
                const confidenceLabel = diag.confidence != null ? `${Math.round(diag.confidence * 100)}%` : '-';
                const exampleLine = diag.example ? `<div class="algoexpert-diag-meta"><span>Exemple:</span><code>${this.escapeHtml(diag.example)}</code></div>` : '';
                const suggestionLine = diag.suggestion ? `<div class="algoexpert-diag-meta"><span>Suggestion:</span><span>${this.escapeHtml(diag.suggestion)}</span></div>` : '';
                const fixLine = diag.quickFix ? `<div class="algoexpert-diag-meta"><span>Fix 1 ligne:</span><code>${this.escapeHtml(diag.quickFix)}</code></div>` : '';
                return `
                    <li>
                        <article class="algoexpert-diagnostic-card ${severityClass}">
                            <div class="algoexpert-diag-head">
                                <strong>${this.escapeHtml(diag.code || 'DIAG')}</strong>
                                <span class="mod-status ${severityClass === 'error' ? 'bad' : (severityClass === 'warning' ? 'warn' : 'info')}">${this.escapeHtml(severityClass)}</span>
                            </div>
                            <div>${this.escapeHtml(diag.message || 'Diagnostic')}</div>
                            <div class="algoexpert-diag-meta">
                                <span>Ligne: ${this.escapeHtml(lineLabel)}</span>
                                <span>Confiance: ${this.escapeHtml(confidenceLabel)}</span>
                                <span>Catégorie: ${this.escapeHtml(diag.category || 'général')}</span>
                            </div>
                            ${diag.danger ? `<div class="algoexpert-diag-meta"><span>Risque:</span><span>${this.escapeHtml(diag.danger)}</span></div>` : ''}
                            ${suggestionLine}
                            ${fixLine}
                            ${exampleLine}
                        </article>
                    </li>
                `;
            })
            .join('');
    }


    renderAdvancedArtifacts() {
        const cfg = this.analysisArtifacts.cfg;
        const ssa = this.analysisArtifacts.ssa;
        const intervals = this.analysisArtifacts.intervals;
        const invariants = this.analysisArtifacts.invariants || [];
        const ruleCoverage = this.analysisArtifacts.ruleCoverage || [];

        this.cfgOutput.textContent = cfg ? cfg.text : 'CFG non disponible.';
        if (ssa || intervals) {
            const blocks = [];
            if (ssa) blocks.push(ssa.text);
            if (intervals) {
                const intervalLines = intervals.entries.length
                    ? intervals.entries.map((entry) => `${entry.name}: [${entry.min ?? '-∞'}, ${entry.max ?? '+∞'}] (source lignes ${entry.lines.join(', ')})`).join('\n')
                    : 'Aucun intervalle inféré.';
                blocks.push(`Intervalles:\n${intervalLines}`);
            }
            this.ssaOutput.textContent = blocks.join('\n\n');
        } else {
            this.ssaOutput.textContent = 'SSA / intervalles non disponibles.';
        }

        if (!invariants.length) {
            this.invariantsOutput.innerHTML = '<li>Aucun invariant explicite inféré.</li>';
        } else {
            this.invariantsOutput.innerHTML = invariants
                .map((item) => `<li>${this.escapeHtml(item)}</li>`)
                .join('');
        }

        if (!ruleCoverage.length) {
            this.ruleCoverageOutput.innerHTML = '<li>Aucune règle déclenchée.</li>';
        } else {
            this.ruleCoverageOutput.innerHTML = ruleCoverage
                .map((item) => {
                    const description = this.diag.getDiagnosticCodeDescription(item.code);
                    return `<li><strong>${this.escapeHtml(item.code)}</strong> : ${item.count} occurrence(s) — ${this.escapeHtml(description)}</li>`;
                })
                .join('');
        }
    }

    renderPredictionHistory() {
        if (!this.predictionHistory.length) {
            this.predictionHistoryOutput.innerHTML = '<div class="text-muted">Aucune prédiction enregistrée.</div>';
            return;
        }
        this.predictionHistoryOutput.innerHTML = this.predictionHistory
            .slice(0, 40)
            .map((item) => {
                const tone = item.correct ? 'ok' : 'bad';
                return `
                    <article class="algoexpert-history-item">
                        <div><strong>Étape ${item.step}</strong> <span class="mod-status ${tone}">${item.correct ? 'juste' : 'faux'}</span></div>
                        <div class="text-muted">${this.escapeHtml(item.question)}</div>
                        <div>Réponse: <code>${this.escapeHtml(String(item.userValue))}</code> | Attendu: <code>${this.escapeHtml(String(item.expected))}</code></div>
                    </article>
                `;
            })
            .join('');
    }

    renderNotionProgress() {
        const categories = this.sessionStats.byCategory || {};
        const totalAsked = this.sessionStats.askedSteps.size || 0;
        const totalCorrect = this.sessionStats.correctSteps.size || 0;
        const entries = Object.entries(categories);
        if (!entries.length) {
            this.notionProgressOutput.innerHTML = '<li>Progression non disponible.</li>';
            return;
        }

        const ratio = totalAsked ? Math.round((totalCorrect / totalAsked) * 100) : 0;
        const rows = entries.map(([key, misses]) => {
            const mastery = Math.max(0, 100 - (misses * 12));
            return `<li>${this.escapeHtml(key)}: maîtrise ${Math.round(mastery)}% (erreurs ${misses})</li>`;
        });
        rows.unshift(`<li>Global: ${ratio}% (${totalCorrect}/${totalAsked})</li>`);
        this.notionProgressOutput.innerHTML = rows.join('');
        this.renderExercisesPlan(entries);
    }

    renderExercisesPlan(entries) {
        if (!this.exercisesOutput) return;
        const sorted = [...entries].sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 3);
        if (!top.length) {
            this.exercisesOutput.innerHTML = '<li>Aucun exercice recommandé pour le moment.</li>';
            return;
        }

        const map = {
            bornes: 'Exercice: corriger 3 boucles for avec erreurs de bornes.',
            condition: 'Exercice: prédire 10 conditions booléennes (vrai/faux).',
            mise_a_jour: 'Exercice: tracer les variables sur 5 itérations.',
            retour: 'Exercice: identifier la bonne variable de retour dans 6 fonctions.',
            initialisation: 'Exercice: compléter les initialisations manquantes.'
        };
        this.exercisesOutput.innerHTML = top
            .map(([key, misses]) => `<li>${this.escapeHtml(map[key] || `Exercice ciblé sur ${key}.`)} (priorité ${misses})</li>`)
            .join('');
    }

    guessConfusionMessage(historyEntry) {
        const category = historyEntry.category || 'condition';
        if (category === 'bornes') {
            return 'Confusion probable: lecture des bornes de boucle (début/fin/pas).';
        }
        if (category === 'mise_a_jour') {
            return 'Confusion probable: oubli de mise à jour de variable ou écrasement trop tôt.';
        }
        if (category === 'retour') {
            return 'Confusion probable: variable retournée différente de la variable calculée.';
        }
        return 'Confusion probable: inversion vrai/faux ou test logique mal interprété.';
    }

    updateMiniQuiz() {
        const attempts = this.predictionHistory.length;
        if (!attempts) {
            this.miniQuizQuestion.textContent = 'Le mini quiz apparaîtra après quelques étapes.';
            this.miniQuizChoices.innerHTML = '';
            this.miniQuizFeedback.textContent = '';
            return;
        }

        if (this.currentMiniQuiz && !this.currentMiniQuiz.answered) return;
        if (attempts % 3 !== 0) return;

        const hardest = Object.entries(this.sessionStats.byCategory).sort((a, b) => b[1] - a[1])[0] || ['condition', 0];
        const topic = hardest[0];
        let question = 'Dans une boucle while, quelle règle évite une boucle infinie ?';
        let choices = [
            'Faire évoluer une variable de condition à chaque itération',
            'Toujours ajouter un print()',
            'Retirer toutes les conditions'
        ];
        let correctIndex = 0;

        if (topic === 'bornes') {
            question = 'Quel piège provoque souvent un off-by-one ?';
            choices = [
                'Utiliser <= au lieu de < dans la borne finale',
                'Déclarer la variable avant la boucle',
                'Ajouter un commentaire'
            ];
            correctIndex = 0;
        } else if (topic === 'retour') {
            question = 'Pour sécuriser un return, il faut vérifier en priorité...';
            choices = [
                'la variable effectivement mise à jour par l\'algorithme',
                'la longueur du nom de variable',
                'la couleur de la sortie console'
            ];
            correctIndex = 0;
        }

        this.currentMiniQuiz = {
            question,
            choices,
            correctIndex,
            answered: false
        };
        this.miniQuizQuestion.textContent = question;
        this.miniQuizChoices.innerHTML = choices
            .map((choice, index) => `<button class="btn btn-secondary" data-choice-index="${index}">${this.escapeHtml(choice)}</button>`)
            .join('');
        this.miniQuizFeedback.className = 'feedback';
        this.miniQuizFeedback.textContent = '';
    }

    answerMiniQuiz(choiceIndex) {
        if (!this.currentMiniQuiz || this.currentMiniQuiz.answered) return;
        const correct = choiceIndex === this.currentMiniQuiz.correctIndex;
        this.currentMiniQuiz.answered = true;
        if (correct) {
            this.miniQuizFeedback.className = 'feedback ok';
            this.miniQuizFeedback.textContent = 'Bonne réponse.';
        } else {
            this.miniQuizFeedback.className = 'feedback bad';
            const expected = this.currentMiniQuiz.choices[this.currentMiniQuiz.correctIndex];
            this.miniQuizFeedback.textContent = `Réponse incorrecte. Attendu: ${expected}.`;
        }
        this.emitLearningEvent('mini_quiz', { correct });
    }

    buildAnalysisReport() {
        const traceEvents = (this.events || []).map((event, index) => ({
            step: index + 1,
            lineNo: event.lineNo,
            type: event.type,
            details: event.details,
            after: this.deepClone(event.after)
        }));

        return {
            generatedAt: new Date().toISOString(),
            options: this.deepClone(this.executionOptions),
            code: String(this.codeInput.value || ''),
            inputs: this.parseInputsSafe(),
            diagnostics: this.deepClone(this.diagnostics),
            trace: {
                stepCount: traceEvents.length,
                events: traceEvents
            },
            metrics: {
                coverage: this.coverageOutput ? this.coverageOutput.textContent : '-',
                callCount: this.callCountOutput ? this.callCountOutput.textContent : '-',
                maxDepth: this.maxDepthOutput ? this.maxDepthOutput.textContent : '-',
                complexity: this.complexityGuessOutput ? this.complexityGuessOutput.textContent : '-'
            },
            artifacts: {
                cfg: this.analysisArtifacts.cfg,
                ssa: this.analysisArtifacts.ssa,
                intervals: this.analysisArtifacts.intervals,
                invariants: this.analysisArtifacts.invariants,
                ruleCoverage: this.analysisArtifacts.ruleCoverage
            },
            pedagogy: {
                sessionStats: {
                    asked: this.sessionStats.askedSteps.size,
                    correct: this.sessionStats.correctSteps.size,
                    wrongAttempts: this.sessionStats.wrongAttempts,
                    byCategory: this.deepClone(this.sessionStats.byCategory)
                },
                predictionHistory: this.deepClone(this.predictionHistory),
                miniQuiz: this.currentMiniQuiz ? this.deepClone(this.currentMiniQuiz) : null
            },
            interop: {
                xapiEvents: this.deepClone(this.xapiLog)
            }
        };
    }

    parseInputsSafe() {
        try {
            return this.parseInputs();
        } catch {
            return {};
        }
    }

    renderTests(tests) {
        if (!tests.length) {
            this.testsOutput.innerHTML = '<p class="text-muted">Aucun test généré.</p>';
            return;
        }
        this.testsOutput.innerHTML = tests
            .map((test, index) => {
                const tone = test.category === 'nominal'
                    ? 'ok'
                    : (test.category === 'limite' ? 'warn' : (test.category === 'piege_invalide' ? 'bad' : 'info'));
                const categoryLabel = test.category === 'nominal'
                    ? 'Nominal'
                    : (test.category === 'limite' ? 'Limite' : (test.category === 'piege_valide' ? 'Piège valide' : 'Piège invalide'));
                const expectedText = test.expected === 'success'
                    ? 'Attendu: exécution valide'
                    : `Attendu: erreur ${this.escapeHtml(test.expectedError || 'E_INVALID')}`;
                return `
                    <article class="algoexpert-test">
                        <div class="algoexpert-test-head">
                            <strong>${this.escapeHtml(test.label)}</strong>
                            <button class="btn btn-secondary" data-case-index="${index}">Charger ce test</button>
                        </div>
                        <div class="algoexpert-test-meta">
                            <span class="mod-status ${tone}">${categoryLabel}</span>
                            <span class="text-muted">${this.escapeHtml(test.reason || '')}</span>
                        </div>
                        <div class="algoexpert-test-meta">
                            <span class="text-muted">${expectedText}</span>
                        </div>
                        <pre>${this.escapeHtml(JSON.stringify(test.inputs, null, 2))}</pre>
                    </article>
                `;
            })
            .join('');
    }

    applyTestCase(index) {
        const test = this.generatedTests[index];
        if (!test) return;
        this.inputsInput.value = JSON.stringify(test.inputs, null, 2);
        this.captureEditorSnapshot('test_case');
        this.persistStateSnapshot();
        this.analyzeCode();
    }

    renderV3(execution) {
        if (!execution) {
            this.coverageOutput.textContent = '-';
            this.callCountOutput.textContent = '-';
            this.maxDepthOutput.textContent = '-';
            this.complexityGuessOutput.textContent = '-';
            this.jsOutput.textContent = '';
            this.complexityBody.innerHTML = '<tr><td colspan="2" class="text-muted">Aucune mesure.</td></tr>';
            return;
        }

        this.coverageOutput.textContent = execution.coverage.label;
        this.callCountOutput.textContent = String(execution.meta.callCount);
        this.maxDepthOutput.textContent = String(execution.meta.maxDepth);
        this.complexityGuessOutput.textContent = execution.complexity.guess;
        this.jsOutput.textContent = execution.jsTranslation;

        if (!execution.complexity.points.length) {
            this.complexityBody.innerHTML = '<tr><td colspan="2" class="text-muted">Mesure non disponible.</td></tr>';
        } else {
            this.complexityBody.innerHTML = execution.complexity.points
                .map((point) => `<tr><td>${point.size}</td><td>${point.ops}</td></tr>`)
                .join('');
        }
    }


    stringifyShort(value) {
        if (value == null) return 'null';
        if (typeof value === 'boolean') return value ? 'vrai' : 'faux';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return `[${value.map((item) => this.stringifyShort(item)).join(', ')}]`;
        if (value instanceof Set) {
            const items = Array.from(value).slice(0, 6).map((item) => this.stringifyShort(item));
            return `{${items.join(', ')}${value.size > items.length ? ', ...' : ''}}`;
        }
        const entries = Object.entries(value).slice(0, 6);
        const body = entries.map(([key, item]) => `${key}: ${this.stringifyShort(item)}`).join(', ');
        return `{${body}${Object.keys(value).length > entries.length ? ', ...' : ''}}`;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static get BUILTIN_EXAMPLES() {
        const opts = { strictTyping: true, compatibilityMode: 'pedagogique', tutorMode: 'td', hintLevel: '1', density: 'dense' };
        return [
            {
                id: 'builtin-max',
                name: 'Maximum d\'une liste',
                scenario: {
                    version: 1,
                    code: [
                        'def maximum(tableau):',
                        '    max_val = tableau[0]',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] > max_val:',
                        '            max_val = tableau[i]',
                        '    return max_val'
                    ].join('\n'),
                    inputs: JSON.stringify({ tableau: [3, 7, 2, 9, 1] }, null, 2),
                    options: opts
                }
            },
            {
                id: 'builtin-search',
                name: 'Recherche linéaire',
                scenario: {
                    version: 1,
                    code: [
                        'def recherche(tableau, cible):',
                        '    for i in range(0, len(tableau)):',
                        '        if tableau[i] == cible:',
                        '            return i',
                        '    return -1'
                    ].join('\n'),
                    inputs: JSON.stringify({ tableau: [4, 2, 8, 5, 1], cible: 8 }, null, 2),
                    options: opts
                }
            },
            {
                id: 'builtin-sum',
                name: 'Somme d\'une liste',
                scenario: {
                    version: 1,
                    code: [
                        'def somme(tableau):',
                        '    total = 0',
                        '    for i in range(0, len(tableau)):',
                        '        total = total + tableau[i]',
                        '    return total'
                    ].join('\n'),
                    inputs: JSON.stringify({ tableau: [1, 2, 3, 4, 5] }, null, 2),
                    options: opts
                }
            },
            {
                id: 'builtin-bubble',
                name: 'Tri à bulles',
                scenario: {
                    version: 1,
                    code: [
                        'def tri_bulles(tableau):',
                        '    n = len(tableau)',
                        '    for i in range(0, n - 1):',
                        '        for j in range(0, n - 1 - i):',
                        '            if tableau[j] > tableau[j + 1]:',
                        '                a, b = tableau[j], tableau[j + 1]',
                        '                tableau[j] = b',
                        '                tableau[j + 1] = a',
                        '    return tableau'
                    ].join('\n'),
                    inputs: JSON.stringify({ tableau: [5, 3, 8, 1, 9, 2] }, null, 2),
                    options: opts
                }
            }
        ];
    }
}

if (typeof window !== 'undefined') {
    window.AlgorithmExpertLab = AlgorithmExpertLab;
}
