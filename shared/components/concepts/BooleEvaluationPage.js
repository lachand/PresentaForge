class BooleEvaluationPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.summaryRoot = null;
        this.summaryListeners = [];
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
        this.unbindSummaryListeners();

        const container = document.getElementById(this.courseContainerId);
        if (!container) return;

        this.summaryRoot = document.createElement('section');
        this.summaryRoot.className = 'boole-eval-summary';
        this.summaryRoot.innerHTML = `
            <h3>Bilan par compétence</h3>
            <p class="boole-eval-summary-note">Le bilan se met à jour à chaque validation. Il aide à cibler la remédiation avant de relancer une tentative.</p>
            <ul class="boole-eval-summary-list" data-role="summary-list"></ul>
            <p class="boole-eval-summary-remediation" data-role="summary-remediation">Valide quelques questions pour faire apparaître une recommandation ciblée.</p>
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
        const statsBySkill = new Map();

        questions.forEach((question, index) => {
            const skill = String(question?.skill || '').trim() || 'general';
            if (!statsBySkill.has(skill)) {
                statsBySkill.set(skill, { skill, competency: BooleEvaluationPage.SKILL_LABELS[skill] || 'Autres compétences', total: 0, answered: 0, correct: 0 });
            }

            const stats = statsBySkill.get(skill);
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

        return [...statsBySkill.values()];
    }

    formatPercent(value, total) {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    }

    remediationFor(skill) {
        return BooleEvaluationPage.REMEDIATION[skill]
            || 'Reprends la section de cours associée puis refais 2 ou 3 exercices similaires avant une nouvelle tentative.';
    }

    renderCompetencySummary() {
        if (!this.summaryRoot) return;
        const listEl = this.summaryRoot.querySelector('[data-role="summary-list"]');
        const remediationEl = this.summaryRoot.querySelector('[data-role="summary-remediation"]');
        if (!listEl || !remediationEl) return;

        const stats = this.buildCompetencyStats();
        if (!stats.length) {
            listEl.innerHTML = '<li class="boole-eval-summary-item">Aucune donnée de compétence disponible.</li>';
            remediationEl.textContent = 'Valide quelques questions pour faire apparaître une recommandation ciblée.';
            return;
        }

        listEl.innerHTML = stats.map((item) => {
            const percent = this.formatPercent(item.correct, item.total);
            return `
                <li class="boole-eval-summary-item">
                    <div class="boole-eval-summary-head">
                        <strong>${this.escapeHtml(item.competency)}</strong>
                        <span>${item.correct}/${item.total} (${percent}%) · répondues ${item.answered}/${item.total}</span>
                    </div>
                    <div class="boole-eval-summary-bar"><span style="width:${percent}%;"></span></div>
                </li>
            `;
        }).join('');

        const answeredStats = stats.filter((item) => item.answered > 0);
        if (!answeredStats.length) {
            remediationEl.textContent = 'Valide quelques questions pour faire apparaître une recommandation ciblée.';
            return;
        }
        const weakest = [...answeredStats].sort((a, b) => (a.correct / a.answered) - (b.correct / b.answered))[0];

        remediationEl.textContent = `Priorité de remédiation : ${weakest.competency}. ${this.remediationFor(weakest.skill)}`;
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

BooleEvaluationPage.SKILL_LABELS = {
    lecture: 'Lecture des expressions (priorités, tables de vérité)',
    simplification: 'Simplification et équivalence',
    karnaugh: 'Minimisation par Karnaugh'
};

BooleEvaluationPage.REMEDIATION = {
    lecture: 'Repasse sur les priorités NOT, AND, OR et ajoute des parenthèses explicites sur les cas ambigus ; refais les tables de vérité de XOR et de AND/OR.',
    simplification: 'Reprends les lois de De Morgan et d\'absorption, puis vérifie chaque transformation par une table de vérité.',
    karnaugh: 'Revois le module Karnaugh : taille des groupes (puissance de 2), adjacence des bords, exclusion des 0.'
};

if (typeof window !== 'undefined') {
    window.BooleEvaluationPage = BooleEvaluationPage;
}
