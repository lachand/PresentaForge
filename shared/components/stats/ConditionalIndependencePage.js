/**
 * ConditionalIndependencePage - Independance et probabilite conditionnelle.
 */
class ConditionalIndependencePage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.defaults = {
            pA: 45,
            pB: 40,
            coupling: 0,
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
        ['indep-pa', 'indep-pb', 'indep-coupling', 'indep-population'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => this.recalculateFromControls());
            el.addEventListener('change', () => this.recalculateFromControls());
        });
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.defaults = {
            pA: Number.isFinite(cfg.defaultPAPercent) ? cfg.defaultPAPercent : 45,
            pB: Number.isFinite(cfg.defaultPBPercent) ? cfg.defaultPBPercent : 40,
            coupling: Number.isFinite(cfg.defaultCoupling) ? cfg.defaultCoupling : 0,
            population: Number.isFinite(cfg.defaultPopulation) ? Math.max(200, Math.round(cfg.defaultPopulation)) : 10000
        };
        this.params = { ...this.defaults };
        this.observed = null;
        this.syncControls();
        this.recalculate();
        this.clearHighlight();
        this.setStatus('Ajuste P(A), P(B) et le couplage pour observer la dependance.', 'neutral');
    }

    syncControls() {
        const pA = document.getElementById('indep-pa');
        const pB = document.getElementById('indep-pb');
        const coupling = document.getElementById('indep-coupling');
        const population = document.getElementById('indep-population');
        if (pA) pA.value = String(this.params.pA);
        if (pB) pB.value = String(this.params.pB);
        if (coupling) coupling.value = String(this.params.coupling);
        if (population) population.value = String(this.params.population);
    }

    recalculateFromControls() {
        const pA = Number(document.getElementById('indep-pa')?.value);
        const pB = Number(document.getElementById('indep-pb')?.value);
        const coupling = Number(document.getElementById('indep-coupling')?.value);
        const population = Number(document.getElementById('indep-population')?.value);

        this.params.pA = Number.isFinite(pA) ? Math.max(5, Math.min(95, pA)) : this.params.pA;
        this.params.pB = Number.isFinite(pB) ? Math.max(5, Math.min(95, pB)) : this.params.pB;
        this.params.coupling = Number.isFinite(coupling) ? Math.max(-100, Math.min(100, coupling)) : this.params.coupling;
        this.params.population = Number.isFinite(population)
            ? Math.max(200, Math.min(500000, Math.round(population)))
            : this.params.population;
        this.observed = null;
        this.recalculate();
    }

    toProbability(percent) {
        return percent / 100;
    }

    computeMetrics() {
        const pA = this.toProbability(this.params.pA);
        const pB = this.toProbability(this.params.pB);
        const pABMin = Math.max(0, pA + pB - 1);
        const pABMax = Math.min(pA, pB);
        const pABIndependent = pA * pB;

        const coupling = this.params.coupling / 100;
        const pAB = coupling >= 0
            ? pABIndependent + (coupling * (pABMax - pABIndependent))
            : pABIndependent + (coupling * (pABIndependent - pABMin));

        const safePAB = Math.min(pABMax, Math.max(pABMin, pAB));
        const pAOnly = Math.max(0, pA - safePAB);
        const pBOnly = Math.max(0, pB - safePAB);
        const pNone = Math.max(0, 1 - (safePAB + pAOnly + pBOnly));
        const pAUnionB = safePAB + pAOnly + pBOnly;

        const pAGivenB = pB > 0 ? safePAB / pB : 0;
        const pAGivenNotB = (1 - pB) > 0 ? pAOnly / (1 - pB) : 0;
        const pBGivenA = pA > 0 ? safePAB / pA : 0;
        const delta = safePAB - pABIndependent;
        const lift = pABIndependent > 0 ? safePAB / pABIndependent : 0;
        const independent = Math.abs(delta) < 0.003;

        const n = this.params.population;
        const expected = {
            ab: n * safePAB,
            aOnly: n * pAOnly,
            bOnly: n * pBOnly,
            none: n * pNone
        };

        return {
            pA,
            pB,
            pAB: safePAB,
            pAOnly,
            pBOnly,
            pNone,
            pAUnionB,
            pABMin,
            pABMax,
            pABIndependent,
            pAGivenB,
            pAGivenNotB,
            pBGivenA,
            delta,
            lift,
            independent,
            expected
        };
    }

    recalculate() {
        this.metrics = this.computeMetrics();
        this.render();
    }

    setCouplingIndependent() {
        this.params.coupling = 0;
        this.syncControls();
        this.observed = null;
        this.recalculate();
        this.setStatus('Couplage remis a 0: modele independant.', 'success');
    }

    setStatus(message, tone = 'neutral') {
        const host = document.getElementById('indep-feedback');
        if (!host) return;
        host.textContent = message;
        host.className = `feedback ${tone}`;
    }

    formatProbability(value) {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(3);
    }

    formatPercent(value) {
        if (!Number.isFinite(value)) return '--';
        return `${(value * 100).toFixed(2)}%`;
    }

    formatCount(value) {
        if (!Number.isFinite(value)) return '--';
        return Math.round(value).toLocaleString('fr-FR');
    }

    renderControlLabels() {
        if (!this.metrics) return;
        this.updateInfo('indep-pa-value', `${this.params.pA.toFixed(1)}%`);
        this.updateInfo('indep-pb-value', `${this.params.pB.toFixed(1)}%`);
        this.updateInfo('indep-coupling-value', `${this.params.coupling.toFixed(0)}%`);
        this.updateInfo(
            'indep-pab-range',
            `[${this.formatPercent(this.metrics.pABMin)} ; ${this.formatPercent(this.metrics.pABMax)}]`
        );
    }

    renderSummary() {
        if (!this.metrics) return;

        this.updateInfo('indep-pab', this.formatPercent(this.metrics.pAB));
        this.updateInfo('indep-pa-times-pb', this.formatPercent(this.metrics.pABIndependent));
        this.updateInfo('indep-delta', this.formatPercent(this.metrics.delta));
        this.updateInfo('indep-pa-given-b', this.formatPercent(this.metrics.pAGivenB));
        this.updateInfo('indep-pa-given-not-b', this.formatPercent(this.metrics.pAGivenNotB));
        this.updateInfo('indep-pb-given-a', this.formatPercent(this.metrics.pBGivenA));
        this.updateInfo('indep-lift', this.formatProbability(this.metrics.lift));

        const badge = document.getElementById('indep-status-badge');
        if (badge) {
            if (this.metrics.independent) {
                badge.textContent = 'A et B independants';
                badge.className = 'indep-badge indep-badge-ok';
            } else {
                badge.textContent = this.metrics.delta > 0 ? 'Dependance positive' : 'Dependance negative';
                badge.className = 'indep-badge indep-badge-warn';
            }
        }
    }

    renderExpectedTable() {
        if (!this.metrics) return;
        this.updateInfo('indep-exp-ab', this.formatCount(this.metrics.expected.ab));
        this.updateInfo('indep-exp-aonly', this.formatCount(this.metrics.expected.aOnly));
        this.updateInfo('indep-exp-bonly', this.formatCount(this.metrics.expected.bOnly));
        this.updateInfo('indep-exp-none', this.formatCount(this.metrics.expected.none));
    }

    renderObservedTable() {
        if (!this.observed) {
            this.updateInfo('indep-obs-ab', '--');
            this.updateInfo('indep-obs-aonly', '--');
            this.updateInfo('indep-obs-bonly', '--');
            this.updateInfo('indep-obs-none', '--');
            this.updateInfo('indep-obs-pagivenb', '--');
            this.updateInfo('indep-obs-delta', '--');
            return;
        }

        const n = this.observed.total;
        const pAB = n > 0 ? this.observed.ab / n : 0;
        const pA = n > 0 ? (this.observed.ab + this.observed.aOnly) / n : 0;
        const pB = n > 0 ? (this.observed.ab + this.observed.bOnly) / n : 0;
        const pAGivenB = (this.observed.ab + this.observed.bOnly) > 0
            ? this.observed.ab / (this.observed.ab + this.observed.bOnly)
            : 0;
        const delta = pAB - (pA * pB);

        this.updateInfo('indep-obs-ab', this.formatCount(this.observed.ab));
        this.updateInfo('indep-obs-aonly', this.formatCount(this.observed.aOnly));
        this.updateInfo('indep-obs-bonly', this.formatCount(this.observed.bOnly));
        this.updateInfo('indep-obs-none', this.formatCount(this.observed.none));
        this.updateInfo('indep-obs-pagivenb', this.formatPercent(pAGivenB));
        this.updateInfo('indep-obs-delta', this.formatPercent(delta));
    }

    renderGrid() {
        const svg = document.getElementById('indep-grid');
        if (!svg || !this.metrics) return;
        const width = Math.max(520, svg.clientWidth || 680);
        const height = 270;
        const pad = 22;
        const gridX = pad + 70;
        const gridY = pad;
        const gridW = width - gridX - pad;
        const gridH = height - pad * 2;
        const xB = gridX + (this.metrics.pB * gridW);

        const pAIfB = this.metrics.pB > 0 ? this.metrics.pAB / this.metrics.pB : 0;
        const pAIfNotB = (1 - this.metrics.pB) > 0 ? this.metrics.pAOnly / (1 - this.metrics.pB) : 0;
        const yAB = gridY + (1 - pAIfB) * gridH;
        const yAOnly = gridY + (1 - pAIfNotB) * gridH;

        const abLabel = this.formatPercent(this.metrics.pAB);
        const aOnlyLabel = this.formatPercent(this.metrics.pAOnly);
        const bOnlyLabel = this.formatPercent(this.metrics.pBOnly);
        const noneLabel = this.formatPercent(this.metrics.pNone);

        const html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>

            <rect x="${gridX}" y="${gridY}" width="${xB - gridX}" height="${yAB - gridY}" fill="#1d4ed8" opacity="0.78"></rect>
            <rect x="${gridX}" y="${yAB}" width="${xB - gridX}" height="${gridY + gridH - yAB}" fill="#bfdbfe" opacity="0.88"></rect>
            <rect x="${xB}" y="${gridY}" width="${gridX + gridW - xB}" height="${yAOnly - gridY}" fill="#f59e0b" opacity="0.72"></rect>
            <rect x="${xB}" y="${yAOnly}" width="${gridX + gridW - xB}" height="${gridY + gridH - yAOnly}" fill="#fde68a" opacity="0.9"></rect>

            <rect x="${gridX}" y="${gridY}" width="${gridW}" height="${gridH}" fill="none" stroke="var(--border)" stroke-width="1.5"></rect>
            <line x1="${xB}" y1="${gridY}" x2="${xB}" y2="${gridY + gridH}" stroke="var(--border)" stroke-width="1.5"></line>
            <line x1="${gridX}" y1="${yAB}" x2="${xB}" y2="${yAB}" stroke="white" stroke-width="1.3"></line>
            <line x1="${xB}" y1="${yAOnly}" x2="${gridX + gridW}" y2="${yAOnly}" stroke="white" stroke-width="1.3"></line>

            <text x="${gridX - 38}" y="${gridY + 22}" font-size="12" fill="var(--muted)">A</text>
            <text x="${gridX - 46}" y="${gridY + gridH - 8}" font-size="12" fill="var(--muted)">non A</text>
            <text x="${gridX + 8}" y="${gridY + gridH + 18}" font-size="12" fill="var(--muted)">B</text>
            <text x="${xB + 8}" y="${gridY + gridH + 18}" font-size="12" fill="var(--muted)">non B</text>

            <text x="${gridX + (xB - gridX) / 2}" y="${gridY + 18}" text-anchor="middle" font-size="12" fill="white">A inter B: ${abLabel}</text>
            <text x="${gridX + (xB - gridX) / 2}" y="${gridY + gridH - 10}" text-anchor="middle" font-size="12" fill="var(--text)">non A et B: ${bOnlyLabel}</text>
            <text x="${xB + (gridX + gridW - xB) / 2}" y="${gridY + 18}" text-anchor="middle" font-size="12" fill="var(--text)">A et non B: ${aOnlyLabel}</text>
            <text x="${xB + (gridX + gridW - xB) / 2}" y="${gridY + gridH - 10}" text-anchor="middle" font-size="12" fill="var(--text)">hors A union B: ${noneLabel}</text>
        `;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    async simulatePopulation() {
        if (this.state.running || !this.metrics) return;
        this.state.running = true;
        this.highlightLine('indep-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.1));

        const n = this.params.population;
        const pAB = this.metrics.pAB;
        const pAOnly = this.metrics.pAOnly;
        const pBOnly = this.metrics.pBOnly;

        let ab = 0;
        let aOnly = 0;
        let bOnly = 0;
        let none = 0;

        const checkpoint = Math.max(1, Math.floor(n / 25));
        for (let i = 0; i < n; i += 1) {
            const r = Math.random();
            if (r < pAB) ab += 1;
            else if (r < pAB + pAOnly) aOnly += 1;
            else if (r < pAB + pAOnly + pBOnly) bOnly += 1;
            else none += 1;

            if (i % checkpoint === 0 || i === n - 1) {
                this.highlightLine('indep-line3');
                await OEIUtils.sleep(this.getCurrentDelay(0.015));
            }
        }

        this.highlightLine('indep-line5');
        this.observed = {
            total: n,
            ab,
            aOnly,
            bOnly,
            none
        };
        this.renderObservedTable();
        this.clearHighlight();
        this.state.running = false;
        this.setStatus(`Simulation terminee sur ${n.toLocaleString('fr-FR')} essais.`, 'success');
    }

    render() {
        this.renderControlLabels();
        this.renderSummary();
        this.renderExpectedTable();
        this.renderObservedTable();
        this.renderGrid();
    }
}

if (typeof window !== 'undefined') {
    window.ConditionalIndependencePage = ConditionalIndependencePage;
}
