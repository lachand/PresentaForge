class ExerciseRunnerPage extends ConceptPage {
    constructor(config) {
        super(null);
        if (typeof config === 'string') {
            this.exerciseDataPath = config;
            this.contentPaths = null;
            this.exerciseData = null;
            this.ui = {};
        } else {
            this.exerciseDataPath = config?.exerciseDataPath || null;
            this.contentPaths = Array.isArray(config?.contentPaths) ? config.contentPaths : null;
            this.exerciseData = config?.exerciseData || null;
            this.ui = config?.ui || {};
        }
        this.state = {
            chapterId: null,
            index: 0,
            submitted: false,
            score: 0,
            answers: {}
        };
        this.questionContainer = null;
        this.uiListeners = [];
        this.questionBindController = null;
    }

    async init() {
        await this.loadDataSource();
        this.bindUI();
        this.initializeState();
        this.render();
    }

    async loadDataSource() {
        if (this.exerciseData && Array.isArray(this.exerciseData.chapters)) {
            return;
        }
        if (this.contentPaths && this.contentPaths.length) {
            await this.loadFromContentFiles();
            return;
        }
        await this.loadExercises();
    }

    async loadExercises() {
        const response = await fetch(this.exerciseDataPath);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while loading exercises`);
        }
        this.exerciseData = await response.json();
    }

    async loadFromContentFiles() {
        const chapters = [];
        for (const p of this.contentPaths) {
            const response = await fetch(p);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while loading ${p}`);
            }
            const data = await response.json();
            const meta = data.metadata || {};
            let ex = data.exercises || {};
            if ((!ex.questions || !ex.questions.length) && Array.isArray(data.content)) {
                const exBlock = data.content.find(b => b.type === 'exercises');
                if (exBlock) ex = exBlock;
            }
            if (!Array.isArray(ex.questions) || ex.questions.length === 0) continue;
            chapters.push({
                id: meta.id || p,
                title: ex.title || meta.title || p,
                questions: ex.questions
            });
        }
        this.exerciseData = {
            title: 'Exercices guidés',
            chapters
        };
    }

    bindUI() {
        this.cleanupUiListeners();

        const id = (key, fallback) => this.ui[key] || fallback;
        this.chapterSelect = document.getElementById(id('chapterSelectId', 'chapter-select'));
        this.progressEl = document.getElementById(id('progressId', 'exercise-progress'));
        this.scoreEl = document.getElementById(id('scoreId', 'exercise-score'));
        this.questionContainer = document.getElementById(id('questionContainerId', 'question-container'));
        this.feedbackEl = document.getElementById(id('feedbackId', 'exercise-feedback'));

        this.btnPrev = document.getElementById(id('prevButtonId', 'btn-prev'));
        this.btnNext = document.getElementById(id('nextButtonId', 'btn-next'));
        this.btnSubmit = document.getElementById(id('submitButtonId', 'btn-submit'));
        this.btnReset = document.getElementById(id('resetButtonId', 'btn-reset-chapter'));

        if (!this.chapterSelect || !this.questionContainer || !this.feedbackEl) {
            throw new Error('ExerciseRunnerPage UI elements introuvables.');
        }

        this.addUiListener(this.chapterSelect, 'change', () => {
            this.state.chapterId = this.chapterSelect.value;
            this.state.index = 0;
            this.state.submitted = false;
            this.render();
        });

        this.addUiListener(this.btnPrev, 'click', () => this.navigate(-1));
        this.addUiListener(this.btnNext, 'click', () => this.navigate(1));
        this.addUiListener(this.btnSubmit, 'click', () => this.submitAnswer());
        this.addUiListener(this.btnReset, 'click', () => this.resetChapter());
    }

    addUiListener(target, type, handler) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(type, handler);
        this.uiListeners.push({ target, type, handler });
    }

    cleanupUiListeners() {
        this.uiListeners.forEach(({ target, type, handler }) => {
            target?.removeEventListener?.(type, handler);
        });
        this.uiListeners = [];
    }

    cleanupQuestionBinding() {
        if (!this.questionBindController) return;
        this.questionBindController.abort();
        this.questionBindController = null;
    }

    destroy() {
        this.cleanupQuestionBinding();
        this.cleanupUiListeners();
    }

    initializeState() {
        const chapters = this.exerciseData?.chapters || [];
        this.chapterSelect.innerHTML = chapters
            .map((c) => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.title)}</option>`)
            .join('');
        this.state.chapterId = chapters[0]?.id || null;
    }

    getChapter() {
        return (this.exerciseData?.chapters || []).find((c) => c.id === this.state.chapterId) || null;
    }

    getQuestion() {
        const chapter = this.getChapter();
        if (!chapter) return null;
        return chapter.questions[this.state.index] || null;
    }

    answerKey() {
        return `${this.state.chapterId}::${this.state.index}`;
    }

    navigate(delta) {
        const chapter = this.getChapter();
        if (!chapter) return;
        const next = this.state.index + delta;
        if (next < 0 || next >= chapter.questions.length) return;
        this.state.index = next;
        this.state.submitted = false;
        this.feedbackEl.textContent = '';
        this.render();
    }

    resetChapter() {
        const prefix = `${this.state.chapterId}::`;
        Object.keys(this.state.answers).forEach((k) => {
            if (k.startsWith(prefix)) delete this.state.answers[k];
        });
        this.state.index = 0;
        this.state.submitted = false;
        this.feedbackEl.textContent = '';
        this.render();
    }

    getStoredAnswer() {
        return this.state.answers[this.answerKey()];
    }

    setStoredAnswer(value) {
        this.state.answers[this.answerKey()] = value;
    }

    renderQuestion(question) {
        if (!question) {
            return '<p class="section-description">Aucune question disponible.</p>';
        }
        const component = this.getQuestionComponent(question.type);
        if (!component) return '<p class="section-description">Type de question non supporté.</p>';
        return component.render(question, this.getStoredAnswer(), this);
    }

    getQuestionComponent(type) {
        if (typeof window !== 'undefined' && window.ExerciseQuestionTypes) {
            return window.ExerciseQuestionTypes.get(type);
        }
        return null;
    }

    bindQuestion(question) {
        if (!question) return;
        this.cleanupQuestionBinding();
        const component = this.getQuestionComponent(question.type);
        if (component && typeof component.bind === 'function') {
            const bindContext = {};
            if (typeof AbortController !== 'undefined') {
                this.questionBindController = new AbortController();
                bindContext.signal = this.questionBindController.signal;
            }
            component.bind(this.questionContainer, question, this, bindContext);
        }
    }

    chapterKeyPrefix(chapterId = this.state.chapterId) {
        return `${chapterId}::`;
    }

    chapterScore(chapter) {
        if (!chapter) return 0;
        const prefix = this.chapterKeyPrefix(chapter.id);
        return chapter.questions.reduce((acc, _q, index) => {
            const scoredKey = `${prefix}${index}::scored`;
            return this.state.answers[scoredKey] ? acc + 1 : acc;
        }, 0);
    }

    chapterAnsweredCount(chapter) {
        if (!chapter) return 0;
        const prefix = this.chapterKeyPrefix(chapter.id);
        return chapter.questions.reduce((acc, _q, index) => {
            const key = `${prefix}${index}`;
            return Object.prototype.hasOwnProperty.call(this.state.answers, key) ? acc + 1 : acc;
        }, 0);
    }

    collectAnswer(question) {
        const component = this.getQuestionComponent(question.type);
        if (!component || typeof component.read !== 'function') {
            return { ok: false, error: 'Type de question non supporté.' };
        }
        return component.read(this.questionContainer, question, this);
    }

    evaluate(question, answer) {
        const component = this.getQuestionComponent(question.type);
        if (!component || typeof component.evaluate !== 'function') {
            return { ok: false, expectedText: '' };
        }
        return component.evaluate(question, answer, this);
    }

    resolveQuestionHint(question) {
        if (!question || typeof question !== 'object') return '';
        const inlineHint = this.sanitizeHintText(question.hint);
        if (inlineHint) return inlineHint;
        const incorrectHint = this.sanitizeHintText(question.hintIncorrect);
        if (incorrectHint) return incorrectHint;
        const goal = typeof question.learningGoal === 'string' ? question.learningGoal.trim() : '';
        if (!goal) return '';
        return `Reviens a l'objectif de la question: ${goal}`;
    }

    sanitizeHintText(value) {
        if (typeof value !== 'string') return '';
        let text = value.trim();
        if (!text) return '';

        const leakTokens = [
            ' Indice lexical:',
            ' Debut attendu:',
            ' Fin attendue:',
            " Point d'ancrage:",
            ' Cible:',
            ' Champs prioritaires:',
            ' Appui utile:',
            ' Ecarte la piste ',
            ' Nombre de reponses correctes attendu:'
        ];
        leakTokens.forEach((token) => {
            const idx = text.indexOf(token);
            if (idx !== -1) text = text.slice(0, idx).trim();
        });

        const firstSentence = text.match(/^.*?[.!?](?:\s|$)/);
        if (firstSentence && firstSentence[0]) {
            text = firstSentence[0].trim();
        }
        return text;
    }

    submitAnswer() {
        const chapter = this.getChapter();
        const question = this.getQuestion();
        if (!chapter || !question) return;

        const read = this.collectAnswer(question);
        if (!read.ok) {
            this.feedbackEl.textContent = read.error || 'Réponse invalide.';
            this.feedbackEl.className = 'feedback warning';
            return;
        }
        const answer = read.value;

        this.setStoredAnswer(answer);
        const verdict = this.evaluate(question, answer);
        const ok = Boolean(verdict && verdict.ok);
        const key = `${this.answerKey()}::scored`;
        if (ok && !this.state.answers[key]) {
            this.state.answers[key] = true;
        }
        this.state.submitted = true;

        const explain = question.explanation ? ` ${question.explanation}` : '';
        const expected = verdict && verdict.expectedText ? verdict.expectedText : '';
        const expectedSuffix = expected ? ` Réponse attendue: ${expected}.` : '';
        if (ok) {
            this.feedbackEl.textContent = `Correct.${explain}`;
            this.feedbackEl.className = 'feedback ok';
        } else {
            const hintValue = this.resolveQuestionHint(question) || this.sanitizeHintText((verdict && verdict.hint) || '');
            const hintSentence = hintValue ? hintValue.replace(/[.!?]+$/, '') : '';
            const hint = hintSentence ? ` Piste: ${hintSentence}.` : '';
            const remediation = question.remediation ? ` ${question.remediation}` : '';
            this.feedbackEl.textContent = `Incorrect.${expectedSuffix}${hint}${explain}${remediation}`;
            this.feedbackEl.className = 'feedback bad';
        }
        this.renderHeader();
    }

    renderHeader() {
        const chapter = this.getChapter();
        if (!chapter) return;
        const total = chapter.questions.length;
        const score = this.chapterScore(chapter);
        const answered = this.chapterAnsweredCount(chapter);
        if (this.progressEl) this.progressEl.textContent = `Question ${this.state.index + 1} / ${total} · Répondues: ${answered}/${total}`;
        if (this.scoreEl) this.scoreEl.textContent = `Score chapitre: ${score} / ${total}`;
        if (this.btnPrev) this.btnPrev.disabled = this.state.index <= 0;
        if (this.btnNext) this.btnNext.disabled = this.state.index >= total - 1;
    }

    render() {
        const chapter = this.getChapter();
        const question = this.getQuestion();
        if (!chapter) {
            this.cleanupQuestionBinding();
            this.questionContainer.innerHTML = '<p class="section-description">Aucun chapitre chargé.</p>';
            return;
        }

        this.chapterSelect.value = chapter.id;
        this.questionContainer.innerHTML = this.renderQuestion(question);
        this.bindQuestion(question);
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'feedback';
        this.renderHeader();
    }
}

if (typeof window !== 'undefined') {
    window.ExerciseRunnerPage = ExerciseRunnerPage;
}
