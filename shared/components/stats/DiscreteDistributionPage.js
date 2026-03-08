/**
 * DiscreteDistributionPage - Variable aleatoire discrete, esperance et variance.
 */
class DiscreteDistributionPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.values = [0, 1, 2, 3];
        this.probabilities = [0.1, 0.2, 0.3, 0.4];
        this.summary = null;
        this.sampledCounts = [];
        this.sampledTotal = 0;
        this.sampledMean = 0;
    }

    async init() {
        await super.init();
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        if (Array.isArray(cfg.defaultValues) && Array.isArray(cfg.defaultProbabilities)) {
            this.values = cfg.defaultValues.map((v) => Number(v)).filter((v) => Number.isFinite(v));
            this.probabilities = cfg.defaultProbabilities.map((p) => Number(p)).filter((p) => Number.isFinite(p));
        } else {
            this.values = [0, 1, 2, 3];
            this.probabilities = [0.1, 0.2, 0.3, 0.4];
        }

        if (this.values.length !== this.probabilities.length || this.values.length === 0) {
            this.values = [0, 1, 2, 3];
            this.probabilities = [0.1, 0.2, 0.3, 0.4];
        }

        this.normalizeProbabilities();
        this.sampledCounts = Array.from({ length: this.values.length }, () => 0);
        this.sampledTotal = 0;
        this.sampledMean = 0;
        this.syncInputs();
        this.recalculate();
        this.clearHighlight();
        this.setStatus('Distribution reinitialisee.', 'neutral');
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('discrete-feedback');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    syncInputs() {
        const valueInput = document.getElementById('discrete-values-input');
        const probaInput = document.getElementById('discrete-proba-input');
        if (valueInput) valueInput.value = this.values.join(', ');
        if (probaInput) probaInput.value = this.probabilities.map((p) => p.toFixed(3)).join(', ');
    }

    normalizeProbabilities() {
        const total = this.probabilities.reduce((acc, p) => acc + p, 0);
        if (total <= 0) {
            const uniform = 1 / this.probabilities.length;
            this.probabilities = this.probabilities.map(() => uniform);
            return;
        }
        this.probabilities = this.probabilities.map((p) => p / total);
    }

    parseInputList(raw) {
        return String(raw || '')
            .split(/[\s,;]+/)
            .map((token) => Number(token))
            .filter((value) => Number.isFinite(value));
    }

    async applyFromInputs() {
        const valuesRaw = document.getElementById('discrete-values-input')?.value;
        const probaRaw = document.getElementById('discrete-proba-input')?.value;
        const values = this.parseInputList(valuesRaw);
        const probs = this.parseInputList(probaRaw);

        if (values.length < 2 || probs.length < 2 || values.length !== probs.length) {
            this.setStatus('Les listes x et p doivent avoir la meme taille (au moins 2).', 'error');
            return;
        }
        if (probs.some((p) => p < 0)) {
            this.setStatus('Les probabilites doivent etre positives.', 'error');
            return;
        }

        this.highlightLine('esperance-line0');
        await OEIUtils.sleep(80);
        this.values = values;
        this.probabilities = probs;
        this.normalizeProbabilities();
        this.highlightLine('esperance-line1');
        await OEIUtils.sleep(80);

        this.sampledCounts = Array.from({ length: this.values.length }, () => 0);
        this.sampledTotal = 0;
        this.sampledMean = 0;
        this.syncInputs();
        this.recalculate();
        this.highlightLine('esperance-line4');
        await OEIUtils.sleep(80);
        this.clearHighlight();
        this.setStatus('Distribution mise a jour et normalisee.', 'success');
    }

    applyPreset(name) {
        if (name === 'die') {
            this.values = [1, 2, 3, 4, 5, 6];
            this.probabilities = [1, 1, 1, 1, 1, 1];
        } else if (name === 'bernoulli') {
            this.values = [0, 1];
            this.probabilities = [0.7, 0.3];
        } else if (name === 'skewed') {
            this.values = [0, 1, 2, 3, 4];
            this.probabilities = [0.45, 0.25, 0.16, 0.10, 0.04];
        } else {
            this.values = [0, 1, 2, 3];
            this.probabilities = [0.1, 0.2, 0.3, 0.4];
        }
        this.normalizeProbabilities();
        this.sampledCounts = Array.from({ length: this.values.length }, () => 0);
        this.sampledTotal = 0;
        this.sampledMean = 0;
        this.syncInputs();
        this.recalculate();
        this.setStatus('Preset charge.', 'neutral');
    }

    computeSummary() {
        const expected = this.values.reduce((acc, x, idx) => acc + (x * this.probabilities[idx]), 0);
        const variance = this.values.reduce((acc, x, idx) => {
            const diff = x - expected;
            return acc + (diff * diff * this.probabilities[idx]);
        }, 0);
        const std = Math.sqrt(Math.max(variance, 0));
        const rows = this.values.map((x, idx) => {
            const p = this.probabilities[idx];
            const xp = x * p;
            const varTerm = ((x - expected) ** 2) * p;
            return { x, p, xp, varTerm };
        });
        return {
            expected,
            variance,
            std,
            rows
        };
    }

    recalculate() {
        this.summary = this.computeSummary();
        this.render();
    }

    format(value, digits = 3) {
        if (!Number.isFinite(value)) return '--';
        return Number(value).toFixed(digits);
    }

    renderSummary() {
        if (!this.summary) return;
        this.updateInfo('discrete-mu', this.format(this.summary.expected, 4));
        this.updateInfo('discrete-var', this.format(this.summary.variance, 4));
        this.updateInfo('discrete-std', this.format(this.summary.std, 4));
        this.updateInfo('discrete-sample-n', String(this.sampledTotal));
        this.updateInfo('discrete-sample-mean', this.sampledTotal > 0 ? this.format(this.sampledMean, 4) : '--');
    }

    renderTable() {
        const body = document.getElementById('discrete-table-body');
        if (!body || !this.summary) return;
        body.innerHTML = this.summary.rows.map((row) => `
            <tr>
                <td>${this.format(row.x, 3)}</td>
                <td>${this.format(row.p, 4)}</td>
                <td>${this.format(row.xp, 4)}</td>
                <td>${this.format(row.varTerm, 4)}</td>
            </tr>
        `).join('');
    }

    renderChart() {
        const svg = document.getElementById('discrete-chart');
        if (!svg || !this.summary) return;

        const width = Math.max(620, svg.clientWidth || 760);
        const height = 270;
        const padding = { left: 48, right: 16, top: 16, bottom: 42 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const n = this.values.length;
        const barGroupWidth = n > 0 ? plotWidth / n : plotWidth;
        const maxY = Math.max(
            0.0001,
            ...this.probabilities,
            ...this.sampledCounts.map((count) => this.sampledTotal > 0 ? count / this.sampledTotal : 0)
        );

        const y = (value) => padding.top + (1 - (value / maxY)) * plotHeight;

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        this.values.forEach((xVal, idx) => {
            const x0 = padding.left + idx * barGroupWidth;
            const barWidth = Math.max(8, (barGroupWidth - 14) / 2);

            const pTheo = this.probabilities[idx];
            const pObs = this.sampledTotal > 0 ? this.sampledCounts[idx] / this.sampledTotal : 0;

            const theoHeight = (pTheo / maxY) * plotHeight;
            const obsHeight = (pObs / maxY) * plotHeight;

            const theoX = x0 + 4;
            const obsX = theoX + barWidth + 4;
            const theoY = height - padding.bottom - theoHeight;
            const obsY = height - padding.bottom - obsHeight;

            html += `<rect x="${theoX}" y="${theoY}" width="${barWidth}" height="${theoHeight}" fill="var(--primary)" opacity="0.82"></rect>`;
            html += `<rect x="${obsX}" y="${obsY}" width="${barWidth}" height="${obsHeight}" fill="var(--accent)" opacity="0.68"></rect>`;
            html += `<text x="${x0 + (barGroupWidth / 2)}" y="${height - 20}" text-anchor="middle" font-size="11" fill="var(--muted)">x=${this.format(xVal, 2)}</text>`;
        });

        html += `
            <rect x="${padding.left}" y="${height - 16}" width="11" height="11" fill="var(--primary)" opacity="0.82"></rect>
            <text x="${padding.left + 16}" y="${height - 7}" font-size="11" fill="var(--muted)">P theorique</text>
            <rect x="${padding.left + 116}" y="${height - 16}" width="11" height="11" fill="var(--accent)" opacity="0.68"></rect>
            <text x="${padding.left + 132}" y="${height - 7}" font-size="11" fill="var(--muted)">Frequence observee</text>
        `;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    sampleOne() {
        const r = Math.random();
        let acc = 0;
        for (let i = 0; i < this.probabilities.length; i += 1) {
            acc += this.probabilities[i];
            if (r <= acc || i === this.probabilities.length - 1) {
                return i;
            }
        }
        return this.probabilities.length - 1;
    }

    async simulateSamples(count) {
        if (this.state.running || !this.summary) return;
        const n = Number(count) || 0;
        if (n <= 0) return;
        this.state.running = true;
        this.highlightLine('esperance-line2');

        const checkpoint = Math.max(1, Math.floor(n / 20));
        for (let i = 0; i < n; i += 1) {
            const idx = this.sampleOne();
            this.sampledCounts[idx] += 1;
            this.sampledTotal += 1;

            const sampledSum = this.sampledCounts.reduce((acc, c, j) => acc + (c * this.values[j]), 0);
            this.sampledMean = sampledSum / this.sampledTotal;

            if (i % checkpoint === 0 || i === n - 1) {
                this.highlightLine('esperance-line3');
                this.render();
                await OEIUtils.sleep(20);
            }
        }

        this.highlightLine('esperance-line4');
        this.render();
        this.setStatus(`Simulation de ${n} tirages terminee.`, 'success');
        await OEIUtils.sleep(80);
        this.clearHighlight();
        this.state.running = false;
    }

    render() {
        this.renderSummary();
        this.renderTable();
        this.renderChart();
    }
}

if (typeof window !== 'undefined') {
    window.DiscreteDistributionPage = DiscreteDistributionPage;
}
