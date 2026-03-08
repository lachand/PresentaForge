class BooleEvaluationPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.summaryRoot = null;
        this.summaryListeners = [];
    }

    static ensureStyles() {
        if (document.getElementById('boole-eval-summary-styles')) return;
        const style = document.createElement('style');
        style.id = 'boole-eval-summary-styles';
        style.textContent = `
            .boole-eval-summary {
                margin-top: 1rem;
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--card);
                padding: 0.8rem;
                display: grid;
                gap: 0.55rem;
            }
            .boole-eval-summary h3 {
                margin: 0;
                color: var(--primary);
                font-size: 0.95rem;
            }
            .boole-eval-summary-note {
                margin: 0;
                font-size: 0.8rem;
                color: var(--muted);
                line-height: 1.4;
            }
            .boole-eval-summary-list {
                margin: 0;
                padding: 0;
                list-style: none;
                display: grid;
                gap: 0.45rem;
            }
            .boole-eval-summary-item {
                border: 1px solid var(--border);
                border-radius: 8px;
                background: var(--bg);
                padding: 0.45rem 0.55rem;
                display: grid;
                gap: 0.28rem;
            }
            .boole-eval-summary-head {
                display: flex;
                justify-content: space-between;
                gap: 0.5rem;
                align-items: baseline;
                font-size: 0.8rem;
                color: var(--text);
            }
            .boole-eval-summary-bar {
                width: 100%;
                height: 7px;
                border-radius: 999px;
                background: var(--border);
                overflow: hidden;
            }
            .boole-eval-summary-bar span {
                display: block;
                height: 100%;
                width: 0;
                border-radius: inherit;
                background: linear-gradient(90deg, var(--primary), var(--accent));
            }
            .boole-eval-summary-remediation {
                margin: 0;
                font-size: 0.8rem;
                color: var(--tone-indigo-text);
                background: var(--tone-indigo-bg);
                border: 1px solid var(--tone-indigo-border);
                border-radius: 8px;
                padding: 0.45rem 0.55rem;
            }
        `;
        document.head.appendChild(style);
    }

    async init() {
        await super.init();
        this.mountCompetencySummary();
    }

    getExercisesBlock() {
        const blocks = Array.isArray(this.data?.content) ? this.data.content : [];
        return blocks.find((block) => block && block.type === 'exercises') || null;
    }

    getQuestions() {
        const exerciseBlock = this.getExercisesBlock();
        return Array.isArray(exerciseBlock?.questions) ? exerciseBlock.questions : [];
    }

    mountCompetencySummary() {
        BooleEvaluationPage.ensureStyles();
        this.unbindSummaryListeners();

        const container = document.getElementById(this.courseContainerId);
        if (!container) return;

        this.summaryRoot = document.createElement('section');
        this.summaryRoot.className = 'boole-eval-summary';
        this.summaryRoot.innerHTML = `
            <h3>Bilan par competence</h3>
            <p class="boole-eval-summary-note">Le bilan se met a jour a chaque validation. Il aide a cibler la remediation avant de relancer une tentative.</p>
            <ul class="boole-eval-summary-list" data-role="summary-list"></ul>
            <p class="boole-eval-summary-remediation" data-role="summary-remediation">Valide quelques questions pour faire apparaitre une recommandation ciblee.</p>
        `;

        container.appendChild(this.summaryRoot);

        const exerciseBlock = container.querySelector('.content-block--exercises');
        if (exerciseBlock) {
            this.bindSummaryListener(exerciseBlock, 'click', (event) => {
                if (event.target.closest('[data-role="submit"], [data-role="next"], [data-role="prev"], [data-role="reset"]')) {
                    this.renderCompetencySummary();
                }
            });
            this.bindSummaryListener(exerciseBlock, 'change', () => {
                this.renderCompetencySummary();
            });
        }

        this.renderCompetencySummary();
    }

    bindSummaryListener(target, eventName, handler) {
        if (!target) return;
        target.addEventListener(eventName, handler);
        this.summaryListeners.push(() => target.removeEventListener(eventName, handler));
    }

    unbindSummaryListeners() {
        this.summaryListeners.forEach((off) => off());
        this.summaryListeners = [];
    }

    buildCompetencyStats() {
        const widget = this.inlineExerciseWidget;
        const state = widget?.state || { answers: {} };
        const answers = state.answers || {};
        const questions = this.getQuestions();
        const statsByCompetency = new Map();

        questions.forEach((question, index) => {
            const competency = String(question?.competency || 'General').trim() || 'General';
            if (!statsByCompetency.has(competency)) {
                statsByCompetency.set(competency, { competency, total: 0, answered: 0, correct: 0 });
            }

            const stats = statsByCompetency.get(competency);
            stats.total += 1;

            const answerKey = String(index);
            const scoreKey = `scored_${index}`;
            if (Object.prototype.hasOwnProperty.call(answers, answerKey)) {
                stats.answered += 1;
            }
            if (answers[scoreKey]) {
                stats.correct += 1;
            }
        });

        return [...statsByCompetency.values()];
    }

    formatPercent(value, total) {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    }

    remediationFor(competency) {
        const key = String(competency || '').toLowerCase();
        if (key.includes('karnaugh')) {
            return 'Revois le module Karnaugh: taille des groupes (puissance de 2), adjacence des bords, exclusion des 0.';
        }
        if (key.includes('equivalence') || key.includes('simplification')) {
            return 'Reprends les lois de De Morgan/absorption puis verifie chaque transformation par table de verite.';
        }
        if (key.includes('priorite') || key.includes('operateur')) {
            return 'Repasse sur les priorites AND/OR et ajoute des parentheses explicites sur les cas ambigus.';
        }
        return 'Reprends la section de cours associee puis refais 2-3 exercices similaires avant une nouvelle tentative.';
    }

    renderCompetencySummary() {
        if (!this.summaryRoot) return;
        const listEl = this.summaryRoot.querySelector('[data-role="summary-list"]');
        const remediationEl = this.summaryRoot.querySelector('[data-role="summary-remediation"]');
        if (!listEl || !remediationEl) return;

        const stats = this.buildCompetencyStats();
        if (!stats.length) {
            listEl.innerHTML = '<li class="boole-eval-summary-item">Aucune donnee de competence disponible.</li>';
            remediationEl.textContent = 'Valide quelques questions pour faire apparaitre une recommandation ciblee.';
            return;
        }

        listEl.innerHTML = stats.map((item) => {
            const percent = this.formatPercent(item.correct, item.total);
            return `
                <li class="boole-eval-summary-item">
                    <div class="boole-eval-summary-head">
                        <strong>${this.escapeHtml(item.competency)}</strong>
                        <span>${item.correct}/${item.total} (${percent}%) · repondues ${item.answered}/${item.total}</span>
                    </div>
                    <div class="boole-eval-summary-bar"><span style="width:${percent}%;"></span></div>
                </li>
            `;
        }).join('');

        const weakest = [...stats].sort((a, b) => {
            const aRatio = a.total ? a.correct / a.total : 1;
            const bRatio = b.total ? b.correct / b.total : 1;
            return aRatio - bRatio;
        })[0];

        remediationEl.textContent = `Priorite de remediation: ${weakest.competency}. ${this.remediationFor(weakest.competency)}`;
    }

    destroy() {
        this.unbindSummaryListeners();
        if (this.summaryRoot && this.summaryRoot.parentElement) {
            this.summaryRoot.parentElement.removeChild(this.summaryRoot);
        }
        this.summaryRoot = null;
        if (typeof super.destroy === 'function') super.destroy();
    }
}

if (typeof window !== 'undefined') {
    window.BooleEvaluationPage = BooleEvaluationPage;
}
