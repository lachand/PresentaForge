/**
 * ConditionalBayesPage - Probabilite conditionnelle et formule de Bayes.
 */
class ConditionalBayesPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.defaults = {
            prevalence: 1.0,
            sensitivity: 95.0,
            specificity: 90.0,
            population: 10000
        };
        this.params = { ...this.defaults };
        this.metrics = null;
        this.observed = null;
    }

    async init() {
        await super.init();
        this.bindInputs();
    }

    bindInputs() {
        ['prevSlider', 'sensSlider', 'specSlider', 'populationInput'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => this.recalculateFromControls());
            el.addEventListener('change', () => this.recalculateFromControls());
        });
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.defaults = {
            prevalence: Number.isFinite(cfg.defaultPrevalencePercent) ? cfg.defaultPrevalencePercent : 1.0,
            sensitivity: Number.isFinite(cfg.defaultSensitivityPercent) ? cfg.defaultSensitivityPercent : 95.0,
            specificity: Number.isFinite(cfg.defaultSpecificityPercent) ? cfg.defaultSpecificityPercent : 90.0,
            population: Number.isFinite(cfg.defaultPopulation) ? Math.max(100, Math.floor(cfg.defaultPopulation)) : 10000
        };
        this.params = { ...this.defaults };
        this.observed = null;
        this.syncControls();
        this.recalculate();
        this.clearHighlight();
        this.setStatus('Parametres reinitialises.', 'neutral');
    }

    syncControls() {
        const prev = document.getElementById('prevSlider');
        const sens = document.getElementById('sensSlider');
        const spec = document.getElementById('specSlider');
        const pop = document.getElementById('populationInput');
        if (prev) prev.value = String(this.params.prevalence);
        if (sens) sens.value = String(this.params.sensitivity);
        if (spec) spec.value = String(this.params.specificity);
        if (pop) pop.value = String(this.params.population);
    }

    recalculateFromControls() {
        const prev = Number(document.getElementById('prevSlider')?.value);
        const sens = Number(document.getElementById('sensSlider')?.value);
        const spec = Number(document.getElementById('specSlider')?.value);
        const pop = Number(document.getElementById('populationInput')?.value);

        this.params.prevalence = Number.isFinite(prev) ? Math.min(50, Math.max(0.1, prev)) : this.params.prevalence;
        this.params.sensitivity = Number.isFinite(sens) ? Math.min(99.9, Math.max(50, sens)) : this.params.sensitivity;
        this.params.specificity = Number.isFinite(spec) ? Math.min(99.9, Math.max(50, spec)) : this.params.specificity;
        this.params.population = Number.isFinite(pop) ? Math.min(500000, Math.max(100, Math.round(pop))) : this.params.population;
        this.observed = null;
        this.recalculate();
    }

    toProbability(percent) {
        return percent / 100;
    }

    computeMetrics() {
        const prevalence = this.toProbability(this.params.prevalence);
        const sensitivity = this.toProbability(this.params.sensitivity);
        const specificity = this.toProbability(this.params.specificity);
        const falsePositiveRate = 1 - specificity;

        const pPositive = (sensitivity * prevalence) + (falsePositiveRate * (1 - prevalence));
        const pNegative = 1 - pPositive;
        const pDiseaseGivenPositive = pPositive > 0 ? (sensitivity * prevalence) / pPositive : 0;
        const pDiseaseGivenNegative = pNegative > 0 ? ((1 - sensitivity) * prevalence) / pNegative : 0;

        const n = this.params.population;
        const expected = {
            tp: n * prevalence * sensitivity,
            fn: n * prevalence * (1 - sensitivity),
            fp: n * (1 - prevalence) * falsePositiveRate,
            tn: n * (1 - prevalence) * specificity
        };

        return {
            prevalence,
            sensitivity,
            specificity,
            falsePositiveRate,
            pPositive,
            pNegative,
            pDiseaseGivenPositive,
            pDiseaseGivenNegative,
            expected
        };
    }

    recalculate() {
        this.metrics = this.computeMetrics();
        this.render();
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('bayes-feedback');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    formatPercent(probability) {
        if (!Number.isFinite(probability)) return '--';
        return (probability * 100).toFixed(2) + '%';
    }

    formatCount(value) {
        if (!Number.isFinite(value)) return '--';
        return Math.round(value).toLocaleString('fr-FR');
    }

    updateSliderLabels() {
        this.updateInfo('prevValue', this.params.prevalence.toFixed(1) + '%');
        this.updateInfo('sensValue', this.params.sensitivity.toFixed(1) + '%');
        this.updateInfo('specValue', this.params.specificity.toFixed(1) + '%');
    }

    renderSummary() {
        this.updateSliderLabels();
        if (!this.metrics) return;
        this.updateInfo('bayes-prior', this.formatPercent(this.metrics.prevalence));
        this.updateInfo('bayes-positive', this.formatPercent(this.metrics.pPositive));
        this.updateInfo('bayes-posterior', this.formatPercent(this.metrics.pDiseaseGivenPositive));
        this.updateInfo('bayes-negative-posterior', this.formatPercent(this.metrics.pDiseaseGivenNegative));
    }

    renderExpectedMatrix() {
        if (!this.metrics) return;
        const expected = this.metrics.expected;
        this.updateInfo('bayes-tp', this.formatCount(expected.tp));
        this.updateInfo('bayes-fn', this.formatCount(expected.fn));
        this.updateInfo('bayes-fp', this.formatCount(expected.fp));
        this.updateInfo('bayes-tn', this.formatCount(expected.tn));
    }

    renderObservedMatrix() {
        this.updateInfo('bayes-obs-tp', this.observed ? this.formatCount(this.observed.tp) : '--');
        this.updateInfo('bayes-obs-fn', this.observed ? this.formatCount(this.observed.fn) : '--');
        this.updateInfo('bayes-obs-fp', this.observed ? this.formatCount(this.observed.fp) : '--');
        this.updateInfo('bayes-obs-tn', this.observed ? this.formatCount(this.observed.tn) : '--');
        this.updateInfo('bayes-obs-posterior', this.observed ? this.formatPercent(this.observed.posterior) : '--');
    }

    renderTree() {
        const svg = document.getElementById('bayes-tree');
        if (!svg || !this.metrics) return;

        const width = Math.max(620, svg.clientWidth || 720);
        const height = 250;
        const rootX = 90;
        const diseasedX = 280;
        const outcomeX = 520;
        const diseaseY = 80;
        const healthyY = 180;
        const positiveYTop = 50;
        const negativeYTop = 105;
        const positiveYBottom = 155;
        const negativeYBottom = 210;

        const pD = this.metrics.prevalence;
        const pNotD = 1 - pD;
        const pPosGivenD = this.metrics.sensitivity;
        const pNegGivenD = 1 - pPosGivenD;
        const pPosGivenNotD = this.metrics.falsePositiveRate;
        const pNegGivenNotD = this.metrics.specificity;

        const node = (x, y, label, cls = '') => {
            return `
                <g class="${cls}">
                    <circle cx="${x}" cy="${y}" r="20" fill="var(--card)" stroke="var(--primary)" stroke-width="2"></circle>
                    <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" fill="var(--text)">${label}</text>
                </g>
            `;
        };

        const edge = (x1, y1, x2, y2, label) => {
            return `
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="2"></line>
                <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${label}</text>
            `;
        };

        const html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            ${edge(rootX, 130, diseasedX, diseaseY, `P(D)=${this.formatPercent(pD)}`)}
            ${edge(rootX, 130, diseasedX, healthyY, `P(non D)=${this.formatPercent(pNotD)}`)}
            ${edge(diseasedX, diseaseY, outcomeX, positiveYTop, `P(+|D)=${this.formatPercent(pPosGivenD)}`)}
            ${edge(diseasedX, diseaseY, outcomeX, negativeYTop, `P(-|D)=${this.formatPercent(pNegGivenD)}`)}
            ${edge(diseasedX, healthyY, outcomeX, positiveYBottom, `P(+|non D)=${this.formatPercent(pPosGivenNotD)}`)}
            ${edge(diseasedX, healthyY, outcomeX, negativeYBottom, `P(-|non D)=${this.formatPercent(pNegGivenNotD)}`)}
            ${node(rootX, 130, 'Pop')}
            ${node(diseasedX, diseaseY, 'D')}
            ${node(diseasedX, healthyY, 'non D')}
            ${node(outcomeX, positiveYTop, '+')}
            ${node(outcomeX, negativeYTop, '-')}
            ${node(outcomeX, positiveYBottom, '+')}
            ${node(outcomeX, negativeYBottom, '-')}
            <text x="${width - 16}" y="20" text-anchor="end" font-size="12" fill="#b45309">P(D|+) = ${this.formatPercent(this.metrics.pDiseaseGivenPositive)}</text>
        `;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    async simulatePopulation() {
        if (this.state.running || !this.metrics) return;
        this.state.running = true;
        this.highlightLine('bayes-line0');
        await OEIUtils.sleep(120);
        this.highlightLine('bayes-line1');

        const n = this.params.population;
        const pD = this.metrics.prevalence;
        const pPosGivenD = this.metrics.sensitivity;
        const pPosGivenNotD = this.metrics.falsePositiveRate;

        let tp = 0;
        let fp = 0;
        let fn = 0;
        let tn = 0;

        const checkpoint = Math.max(1, Math.floor(n / 25));
        for (let i = 0; i < n; i += 1) {
            const diseased = Math.random() < pD;
            const positive = diseased
                ? Math.random() < pPosGivenD
                : Math.random() < pPosGivenNotD;

            if (diseased && positive) tp += 1;
            if (diseased && !positive) fn += 1;
            if (!diseased && positive) fp += 1;
            if (!diseased && !positive) tn += 1;

            if (i % checkpoint === 0 || i === n - 1) {
                this.highlightLine('bayes-line2');
                await OEIUtils.sleep(16);
            }
        }

        this.highlightLine('bayes-line4');
        const posterior = (tp + fp) > 0 ? tp / (tp + fp) : 0;
        this.observed = { tp, fn, fp, tn, posterior };
        this.renderObservedMatrix();
        this.setStatus(`Simulation terminee sur ${n.toLocaleString('fr-FR')} individus.`, 'success');
        await OEIUtils.sleep(110);
        this.clearHighlight();
        this.state.running = false;
    }

    render() {
        this.renderSummary();
        this.renderExpectedMatrix();
        this.renderObservedMatrix();
        this.renderTree();
    }
}

if (typeof window !== 'undefined') {
    window.ConditionalBayesPage = ConditionalBayesPage;
}
