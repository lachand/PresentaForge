/**
 * CLTPage - Loi normale et theoreme central limite.
 */
class CLTPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.distribution = 'die';
        this.sampleSize = 10;
        this.bernoulliP = 0.3;
        this.sampleMeans = [];
        this.lastSample = [];
        this.maxStoredMeans = 12000;
        this.summary = null;
    }

    async init() {
        await super.init();
        this.bindControls();
    }

    bindControls() {
        const dist = document.getElementById('clt-distribution');
        const n = document.getElementById('clt-sample-size');
        const p = document.getElementById('clt-bernoulli-p');
        if (dist) dist.addEventListener('change', () => this.applyControls());
        if (n) n.addEventListener('input', () => this.applyControls());
        if (p) p.addEventListener('input', () => this.applyControls());
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.distribution = cfg.defaultDistribution || 'die';
        this.sampleSize = Number.isFinite(cfg.defaultSampleSize) ? Math.max(1, Math.floor(cfg.defaultSampleSize)) : 10;
        this.bernoulliP = Number.isFinite(cfg.defaultBernoulliP) ? cfg.defaultBernoulliP : 0.3;
        this.sampleMeans = [];
        this.lastSample = [];
        this.syncControls();
        this.recalculateSummary();
        this.render();
        this.clearHighlight();
        this.setStatus('Parametres reinitialises.', 'neutral');
    }

    syncControls() {
        const dist = document.getElementById('clt-distribution');
        const n = document.getElementById('clt-sample-size');
        const p = document.getElementById('clt-bernoulli-p');
        if (dist) dist.value = this.distribution;
        if (n) n.value = String(this.sampleSize);
        if (p) p.value = String(this.bernoulliP);
        this.updateControlLabels();
    }

    updateControlLabels() {
        this.updateInfo('clt-sample-size-value', String(this.sampleSize));
        this.updateInfo('clt-bernoulli-p-value', this.bernoulliP.toFixed(2));

        const pRow = document.getElementById('clt-bernoulli-row');
        const pInput = document.getElementById('clt-bernoulli-p');
        const pValue = document.getElementById('clt-bernoulli-p-value');
        const visible = this.distribution === 'bernoulli';
        if (pRow) pRow.style.display = visible ? '' : 'none';
        if (pInput) pInput.style.display = visible ? '' : 'none';
        if (pValue) pValue.style.display = visible ? '' : 'none';
    }

    applyControls() {
        const dist = document.getElementById('clt-distribution')?.value || this.distribution;
        const n = Number(document.getElementById('clt-sample-size')?.value);
        const p = Number(document.getElementById('clt-bernoulli-p')?.value);

        this.distribution = dist;
        this.sampleSize = Number.isFinite(n) ? Math.max(1, Math.min(200, Math.floor(n))) : this.sampleSize;
        this.bernoulliP = Number.isFinite(p) ? Math.max(0.01, Math.min(0.99, p)) : this.bernoulliP;

        this.updateControlLabels();
        this.recalculateSummary();
        this.render();
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('clt-feedback');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    getDistributionSpec() {
        if (this.distribution === 'bernoulli') {
            const p = this.bernoulliP;
            return {
                label: `Bernoulli(p=${p.toFixed(2)})`,
                draw: () => (Math.random() < p ? 1 : 0),
                theoreticalMean: p,
                theoreticalVariance: p * (1 - p),
                support: [
                    { x: 0, p: 1 - p },
                    { x: 1, p }
                ]
            };
        }

        if (this.distribution === 'uniform') {
            return {
                label: 'Uniforme U[0,1]',
                draw: () => Math.random(),
                theoreticalMean: 0.5,
                theoreticalVariance: 1 / 12,
                support: [
                    { x: 0.1, p: 0.2 },
                    { x: 0.3, p: 0.2 },
                    { x: 0.5, p: 0.2 },
                    { x: 0.7, p: 0.2 },
                    { x: 0.9, p: 0.2 }
                ]
            };
        }

        return {
            label: 'De equilibre (1..6)',
            draw: () => Math.floor(Math.random() * 6) + 1,
            theoreticalMean: 3.5,
            theoreticalVariance: 35 / 12,
            support: [
                { x: 1, p: 1 / 6 },
                { x: 2, p: 1 / 6 },
                { x: 3, p: 1 / 6 },
                { x: 4, p: 1 / 6 },
                { x: 5, p: 1 / 6 },
                { x: 6, p: 1 / 6 }
            ]
        };
    }

    recalculateSummary() {
        const spec = this.getDistributionSpec();
        const sigma = Math.sqrt(spec.theoreticalVariance);
        const sigmaMean = sigma / Math.sqrt(this.sampleSize);

        let empiricalMean = null;
        let empiricalStd = null;
        if (this.sampleMeans.length > 0) {
            const sum = this.sampleMeans.reduce((acc, value) => acc + value, 0);
            empiricalMean = sum / this.sampleMeans.length;
            const variance = this.sampleMeans.reduce((acc, value) => {
                const d = value - empiricalMean;
                return acc + (d * d);
            }, 0) / this.sampleMeans.length;
            empiricalStd = Math.sqrt(Math.max(variance, 0));
        }

        this.summary = {
            spec,
            mu: spec.theoreticalMean,
            sigma,
            sigmaMean,
            empiricalMean,
            empiricalStd
        };
    }

    normalPdf(x, mu, sigma) {
        if (!Number.isFinite(sigma) || sigma <= 0) return 0;
        const z = (x - mu) / sigma;
        return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
    }

    async simulateBatch(count) {
        if (this.state.running) return;
        const batch = Number(count) || 0;
        if (batch <= 0) return;

        this.state.running = true;
        this.highlightLine('clt-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.1));

        const spec = this.getDistributionSpec();
        const checkpoint = Math.max(1, Math.floor(batch / 30));

        for (let i = 0; i < batch; i += 1) {
            this.highlightLine('clt-line1');
            let sum = 0;
            const sample = [];
            for (let j = 0; j < this.sampleSize; j += 1) {
                const value = spec.draw();
                sum += value;
                sample.push(value);
            }
            this.highlightLine('clt-line2');
            const mean = sum / this.sampleSize;
            this.sampleMeans.push(mean);
            if (this.sampleMeans.length > this.maxStoredMeans) {
                this.sampleMeans = this.sampleMeans.slice(this.sampleMeans.length - this.maxStoredMeans);
            }
            this.lastSample = sample.slice(0, 25);

            if (i % checkpoint === 0 || i === batch - 1) {
                this.highlightLine('clt-line3');
                this.recalculateSummary();
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.04));
            }
        }

        this.highlightLine('clt-line4');
        this.recalculateSummary();
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(0.05));
        this.clearHighlight();
        this.state.running = false;
        this.setStatus(`Simulation terminee: ${batch} moyennes ajoutees.`, 'success');
    }

    clearSimulatedMeans() {
        this.sampleMeans = [];
        this.lastSample = [];
        this.recalculateSummary();
        this.render();
        this.setStatus('Moyennes simulees effacees.', 'neutral');
    }

    renderMetrics() {
        if (!this.summary) return;
        this.updateInfo('clt-distribution-label', this.summary.spec.label);
        this.updateInfo('clt-mu', this.summary.mu.toFixed(4));
        this.updateInfo('clt-sigma', this.summary.sigma.toFixed(4));
        this.updateInfo('clt-sigma-mean', this.summary.sigmaMean.toFixed(4));
        this.updateInfo('clt-mean-count', String(this.sampleMeans.length));
        this.updateInfo('clt-empirical-mean', this.summary.empiricalMean == null ? '--' : this.summary.empiricalMean.toFixed(4));
        this.updateInfo('clt-empirical-std', this.summary.empiricalStd == null ? '--' : this.summary.empiricalStd.toFixed(4));

        const host = document.getElementById('clt-last-sample');
        if (host) {
            if (this.lastSample.length === 0) {
                host.innerHTML = '<span class="text-sm text-muted">Aucun echantillon tire.</span>';
            } else {
                host.innerHTML = this.lastSample
                    .map((value) => `<span class="clt-chip">${Number(value).toFixed(2)}</span>`)
                    .join('');
            }
        }
    }

    renderSourceDistribution() {
        const svg = document.getElementById('clt-source-chart');
        if (!svg || !this.summary) return;
        const support = this.summary.spec.support;
        const width = Math.max(440, svg.clientWidth || 560);
        const height = 170;
        const padding = { left: 38, right: 16, top: 14, bottom: 28 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const barWidth = plotWidth / Math.max(1, support.length);
        const maxP = Math.max(0.0001, ...support.map((s) => s.p));

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        support.forEach((entry, idx) => {
            const h = (entry.p / maxP) * (plotHeight - 2);
            const x = padding.left + idx * barWidth + 4;
            const y = height - padding.bottom - h;
            const w = Math.max(8, barWidth - 8);
            html += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--primary)" opacity="0.8"></rect>`;
            html += `<text x="${x + (w / 2)}" y="${height - 11}" text-anchor="middle" font-size="11" fill="var(--muted)">${entry.x.toFixed(2)}</text>`;
        });

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    renderMeansHistogram() {
        const svg = document.getElementById('clt-means-chart');
        if (!svg || !this.summary) return;

        const width = Math.max(620, svg.clientWidth || 760);
        const height = 290;
        const padding = { left: 46, right: 18, top: 16, bottom: 36 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        if (this.sampleMeans.length === 0) {
            html += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="13" fill="var(--muted)">Aucune moyenne simulee</text>`;
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            svg.innerHTML = html;
            return;
        }

        const mu = this.summary.mu;
        const sigmaMean = this.summary.sigmaMean;
        const minData = Math.min(...this.sampleMeans);
        const maxData = Math.max(...this.sampleMeans);
        const minX = Math.min(minData, mu - (4 * sigmaMean));
        const maxX = Math.max(maxData, mu + (4 * sigmaMean));
        const span = Math.max(1e-6, maxX - minX);
        const binCount = 28;
        const binWidth = span / binCount;
        const bins = Array.from({ length: binCount }, (_, idx) => ({
            x0: minX + idx * binWidth,
            x1: minX + (idx + 1) * binWidth,
            count: 0
        }));

        this.sampleMeans.forEach((value) => {
            const idx = Math.min(binCount - 1, Math.max(0, Math.floor((value - minX) / binWidth)));
            bins[idx].count += 1;
        });

        const total = this.sampleMeans.length;
        const maxDensity = Math.max(...bins.map((b) => (b.count / total) / binWidth), 1e-6);
        const xToPx = (x) => padding.left + ((x - minX) / span) * plotWidth;
        const yToPx = (density) => padding.top + (1 - (density / maxDensity)) * plotHeight;

        bins.forEach((bin) => {
            const density = (bin.count / total) / binWidth;
            const x = xToPx(bin.x0);
            const w = Math.max(1, xToPx(bin.x1) - x);
            const y = yToPx(density);
            const h = (height - padding.bottom) - y;
            html += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--primary)" opacity="0.72"></rect>`;
        });

        const pathPoints = [];
        const curveSteps = 120;
        for (let i = 0; i <= curveSteps; i += 1) {
            const xValue = minX + (i / curveSteps) * span;
            const density = this.normalPdf(xValue, mu, sigmaMean);
            pathPoints.push(`${xToPx(xValue)},${yToPx(density)}`);
        }
        html += `<polyline points="${pathPoints.join(' ')}" fill="none" stroke="#f59e0b" stroke-width="2.4"></polyline>`;

        const muX = xToPx(mu);
        html += `<line x1="${muX}" y1="${padding.top}" x2="${muX}" y2="${height - padding.bottom}" stroke="var(--accent)" stroke-dasharray="6 4" stroke-width="2"></line>`;
        html += `<text x="${muX + 4}" y="${padding.top + 14}" font-size="11" fill="var(--accent)">mu=${mu.toFixed(3)}</text>`;
        html += `<text x="${padding.left}" y="${height - 10}" font-size="11" fill="var(--muted)">min ${minX.toFixed(2)}</text>`;
        html += `<text x="${width - padding.right}" y="${height - 10}" text-anchor="end" font-size="11" fill="var(--muted)">max ${maxX.toFixed(2)}</text>`;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        this.renderMetrics();
        this.renderSourceDistribution();
        this.renderMeansHistogram();
    }
}

if (typeof window !== 'undefined') {
    window.CLTPage = CLTPage;
}
