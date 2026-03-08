/**
 * ConfidenceIntervalPage - Simulation d intervalles de confiance sur moyenne.
 */
class ConfidenceIntervalPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.defaults = {
            trueMean: 50,
            trueSigma: 12,
            sampleSize: 25,
            confidenceLevel: 95
        };
        this.params = { ...this.defaults };
        this.intervals = [];
        this.maxIntervals = 180;
    }

    async init() {
        await super.init();
        this.bindInputs();
    }

    bindInputs() {
        ['ci-true-mean', 'ci-true-sigma', 'ci-sample-size', 'ci-confidence'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => this.applyControls());
            el.addEventListener('change', () => this.applyControls());
        });
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.defaults = {
            trueMean: Number.isFinite(cfg.defaultTrueMean) ? cfg.defaultTrueMean : 50,
            trueSigma: Number.isFinite(cfg.defaultTrueSigma) ? cfg.defaultTrueSigma : 12,
            sampleSize: Number.isFinite(cfg.defaultSampleSize) ? Math.max(5, Math.round(cfg.defaultSampleSize)) : 25,
            confidenceLevel: Number.isFinite(cfg.defaultConfidenceLevel) ? cfg.defaultConfidenceLevel : 95
        };
        this.params = { ...this.defaults };
        this.intervals = [];
        this.syncControls();
        this.render();
        this.clearHighlight();
        this.setStatus('Parametres reinitialises. Lance des echantillons pour observer la couverture.', 'neutral');
    }

    syncControls() {
        const mean = document.getElementById('ci-true-mean');
        const sigma = document.getElementById('ci-true-sigma');
        const n = document.getElementById('ci-sample-size');
        const level = document.getElementById('ci-confidence');

        if (mean) mean.value = String(this.params.trueMean);
        if (sigma) sigma.value = String(this.params.trueSigma);
        if (n) n.value = String(this.params.sampleSize);
        if (level) level.value = String(this.params.confidenceLevel);
    }

    applyControls() {
        const mean = Number(document.getElementById('ci-true-mean')?.value);
        const sigma = Number(document.getElementById('ci-true-sigma')?.value);
        const n = Number(document.getElementById('ci-sample-size')?.value);
        const level = Number(document.getElementById('ci-confidence')?.value);

        this.params.trueMean = Number.isFinite(mean) ? Math.max(-50, Math.min(150, mean)) : this.params.trueMean;
        this.params.trueSigma = Number.isFinite(sigma) ? Math.max(1, Math.min(60, sigma)) : this.params.trueSigma;
        this.params.sampleSize = Number.isFinite(n) ? Math.max(5, Math.min(400, Math.round(n))) : this.params.sampleSize;
        this.params.confidenceLevel = Number.isFinite(level) ? level : this.params.confidenceLevel;

        this.render();
    }

    clearIntervals() {
        this.intervals = [];
        this.render();
        this.setStatus('Historique des intervalles vide.', 'neutral');
    }

    setStatus(message, tone = 'neutral') {
        const host = document.getElementById('ci-feedback');
        if (!host) return;
        host.textContent = message;
        host.className = `feedback ${tone}`;
    }

    formatNumber(value, digits = 3) {
        if (!Number.isFinite(value)) return '--';
        return Number(value).toFixed(digits);
    }

    getZForConfidence(level) {
        const value = Number(level);
        if (Math.abs(value - 90) < 0.01) return 1.6448536269514722;
        if (Math.abs(value - 95) < 0.01) return 1.959963984540054;
        if (Math.abs(value - 99) < 0.01) return 2.5758293035489004;
        return 1.959963984540054;
    }

    sampleStandardNormal() {
        let u = 0;
        let v = 0;
        while (u <= Number.EPSILON) u = Math.random();
        while (v <= Number.EPSILON) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    sampleMean() {
        let sum = 0;
        for (let i = 0; i < this.params.sampleSize; i += 1) {
            const z = this.sampleStandardNormal();
            const x = this.params.trueMean + (this.params.trueSigma * z);
            sum += x;
        }
        return sum / this.params.sampleSize;
    }

    createInterval() {
        const z = this.getZForConfidence(this.params.confidenceLevel);
        const mean = this.sampleMean();
        const margin = z * this.params.trueSigma / Math.sqrt(this.params.sampleSize);
        const lower = mean - margin;
        const upper = mean + margin;
        const covers = lower <= this.params.trueMean && this.params.trueMean <= upper;
        return {
            id: this.intervals.length + 1,
            mean,
            lower,
            upper,
            margin,
            covers
        };
    }

    async runOnce() {
        if (this.state.running) return;
        this.state.running = true;
        this.highlightLine('ci-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.15));
        this.highlightLine('ci-line2');

        const interval = this.createInterval();
        this.intervals.unshift(interval);
        if (this.intervals.length > this.maxIntervals) {
            this.intervals = this.intervals.slice(0, this.maxIntervals);
        }

        this.highlightLine('ci-line5');
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(0.12));
        this.clearHighlight();
        this.state.running = false;

        this.setStatus(
            `IC #${interval.id}: [${this.formatNumber(interval.lower, 2)} ; ${this.formatNumber(interval.upper, 2)}]`,
            interval.covers ? 'success' : 'error'
        );
    }

    async runBatch(count) {
        if (this.state.running) return;
        const batch = Number(count) || 0;
        if (batch <= 0) return;

        this.state.running = true;
        this.highlightLine('ci-line1');
        this.setStatus(`Simulation de ${batch} intervalles en cours...`, 'neutral');

        const checkpoint = Math.max(1, Math.floor(batch / 24));
        for (let i = 0; i < batch; i += 1) {
            const interval = this.createInterval();
            this.intervals.unshift(interval);
            if (this.intervals.length > this.maxIntervals) {
                this.intervals = this.intervals.slice(0, this.maxIntervals);
            }

            if (i % checkpoint === 0 || i === batch - 1) {
                this.highlightLine('ci-line4');
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.04));
            }
        }

        this.clearHighlight();
        this.state.running = false;
        this.render();
        const coverage = this.computeCoverage().rate;
        this.setStatus(`Batch termine. Couverture observee: ${this.formatNumber(coverage * 100, 1)}%.`, 'success');
    }

    computeCoverage() {
        const total = this.intervals.length;
        const covered = this.intervals.filter((it) => it.covers).length;
        const rate = total > 0 ? covered / total : 0;
        return { total, covered, rate };
    }

    renderLabels() {
        this.updateInfo('ci-true-mean-value', this.formatNumber(this.params.trueMean, 1));
        this.updateInfo('ci-true-sigma-value', this.formatNumber(this.params.trueSigma, 1));
        this.updateInfo('ci-sample-size-value', String(this.params.sampleSize));
        this.updateInfo('ci-confidence-value', `${this.params.confidenceLevel}%`);
    }

    renderSummary() {
        const { total, covered, rate } = this.computeCoverage();
        const target = this.params.confidenceLevel / 100;
        const last = this.intervals[0] || null;

        this.updateInfo('ci-total', String(total));
        this.updateInfo('ci-covered', String(covered));
        this.updateInfo('ci-rate', total ? `${this.formatNumber(rate * 100, 2)}%` : '--');
        this.updateInfo('ci-target', `${this.params.confidenceLevel}%`);
        this.updateInfo('ci-gap', total ? `${this.formatNumber((rate - target) * 100, 2)} pts` : '--');
        this.updateInfo('ci-last-mean', last ? this.formatNumber(last.mean, 3) : '--');
        this.updateInfo(
            'ci-last-interval',
            last ? `[${this.formatNumber(last.lower, 3)} ; ${this.formatNumber(last.upper, 3)}]` : '--'
        );
        this.updateInfo('ci-last-margin', last ? this.formatNumber(last.margin, 3) : '--');
        this.updateInfo('ci-last-cover', last ? (last.covers ? 'Oui' : 'Non') : '--');
    }

    renderIntervalsTable() {
        const body = document.getElementById('ci-interval-body');
        if (!body) return;
        if (!this.intervals.length) {
            body.innerHTML = '<tr><td colspan="4" class="text-muted">Aucun intervalle simule.</td></tr>';
            return;
        }
        body.innerHTML = this.intervals.slice(0, 12).map((interval) => `
            <tr>
                <td>#${interval.id}</td>
                <td>[${this.formatNumber(interval.lower, 2)} ; ${this.formatNumber(interval.upper, 2)}]</td>
                <td>${this.formatNumber(interval.mean, 2)}</td>
                <td>${interval.covers ? 'Oui' : 'Non'}</td>
            </tr>
        `).join('');
    }

    renderChart() {
        const svg = document.getElementById('ci-chart');
        if (!svg) return;

        const width = Math.max(620, svg.clientWidth || 760);
        const maxRows = 36;
        const rows = this.intervals.slice(0, maxRows);
        const height = Math.max(220, 42 + rows.length * 14);
        const padding = { left: 52, right: 22, top: 18, bottom: 32 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        let minX = this.params.trueMean - (3.8 * this.params.trueSigma);
        let maxX = this.params.trueMean + (3.8 * this.params.trueSigma);
        rows.forEach((interval) => {
            minX = Math.min(minX, interval.lower);
            maxX = Math.max(maxX, interval.upper);
        });
        const span = Math.max(1e-6, maxX - minX);
        const xToPx = (value) => padding.left + ((value - minX) / span) * plotWidth;
        const rowHeight = rows.length > 0 ? plotHeight / rows.length : plotHeight;

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        const trueMeanX = xToPx(this.params.trueMean);
        html += `<line x1="${trueMeanX}" y1="${padding.top}" x2="${trueMeanX}" y2="${height - padding.bottom}" stroke="#dc2626" stroke-width="2"></line>`;
        html += `<text x="${trueMeanX + 6}" y="${padding.top + 12}" font-size="11" fill="#b91c1c">mu reel</text>`;

        rows.forEach((interval, idx) => {
            const y = padding.top + (idx + 0.5) * rowHeight;
            const x1 = xToPx(interval.lower);
            const x2 = xToPx(interval.upper);
            const xm = xToPx(interval.mean);
            const stroke = interval.covers ? '#0f766e' : '#b91c1c';

            html += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}" stroke-width="2.1"></line>`;
            html += `<circle cx="${xm}" cy="${y}" r="2.9" fill="${stroke}"></circle>`;
        });

        [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
            const value = minX + t * span;
            const x = xToPx(value);
            html += `<line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 5}" stroke="var(--border)"></line>`;
            html += `<text x="${x}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${this.formatNumber(value, 1)}</text>`;
        });

        if (!rows.length) {
            html += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="13" fill="var(--muted)">Aucun intervalle simule</text>`;
        }

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        this.renderLabels();
        this.renderSummary();
        this.renderIntervalsTable();
        this.renderChart();
    }
}

if (typeof window !== 'undefined') {
    window.ConfidenceIntervalPage = ConfidenceIntervalPage;
}
