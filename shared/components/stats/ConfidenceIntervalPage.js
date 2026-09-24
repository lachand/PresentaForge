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

// ── Standalone widget ──────────────────────────────────────────
// Meme moteur que ConfidenceIntervalPage, sans controleur de vitesse partage
// ni inspecteur de pseudocode — delai fixe local, historique plus court.
class ConfidenceIntervalWidget {
    static mount(container, config = {}) {
        if (container.dataset.ciw) return;
        container.dataset.ciw = '1';
        const w = new ConfidenceIntervalWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.params = {
            trueMean: Number.isFinite(config.trueMean) ? config.trueMean : 50,
            trueSigma: Number.isFinite(config.trueSigma) ? Math.max(1, config.trueSigma) : 12,
            sampleSize: Number.isFinite(config.sampleSize) ? Math.max(5, Math.round(config.sampleSize)) : 25,
            confidenceLevel: [90, 95, 99].includes(config.confidenceLevel) ? config.confidenceLevel : 95
        };
        this.intervals = [];
        this.maxIntervals = 80;
        this.running = false;
        this._destroyed = false;
    }

    init() {
        const p = this.params;
        this.root.innerHTML = `<div class="ciw-container">
            <div class="ciw-controls-row">
                <label class="ciw-inline-label">μ <input type="range" class="ciw-range" data-true-mean min="-20" max="120" step="0.5" value="${p.trueMean}"><span data-true-mean-value>${p.trueMean.toFixed(1)}</span></label>
                <label class="ciw-inline-label">σ <input type="range" class="ciw-range" data-true-sigma min="1" max="40" step="0.5" value="${p.trueSigma}"><span data-true-sigma-value>${p.trueSigma.toFixed(1)}</span></label>
            </div>
            <div class="ciw-controls-row">
                <label class="ciw-inline-label">n <input type="range" class="ciw-range" data-sample-size min="5" max="200" step="1" value="${p.sampleSize}"><span data-sample-size-value>${p.sampleSize}</span></label>
                <label class="ciw-inline-label">Confiance
                    <select class="ciw-select" data-confidence>
                        <option value="90">90%</option>
                        <option value="95">95%</option>
                        <option value="99">99%</option>
                    </select>
                </label>
            </div>
            <div class="ciw-controls-row">
                <button class="ciw-btn ciw-btn-primary" data-run="1">1 échantillon</button>
                <button class="ciw-btn ciw-btn-secondary" data-run="25">+25</button>
                <button class="ciw-btn ciw-btn-secondary" data-run="100">+100</button>
                <button class="ciw-btn ciw-btn-secondary" data-clear>Vider</button>
                <button class="ciw-btn ciw-btn-secondary" data-reset>↺ Reset</button>
            </div>
            <svg class="ciw-svg" data-chart viewBox="0 0 400 220" role="img" aria-label="Intervalles de confiance observés"></svg>
            <div class="ciw-metrics">
                <div class="ciw-metric"><span class="ciw-metric-label">Simulés</span><span data-total>0</span></div>
                <div class="ciw-metric"><span class="ciw-metric-label">Couvrants</span><span data-covered>0</span></div>
                <div class="ciw-metric"><span class="ciw-metric-label">Couverture obs.</span><span data-rate>--</span></div>
                <div class="ciw-metric"><span class="ciw-metric-label">Cible</span><span data-target>${p.confidenceLevel}%</span></div>
            </div>
            <div class="ciw-feedback" data-feedback>Lance des échantillons pour observer la couverture.</div>
        </div>`;

        this._q('[data-confidence]').value = String(p.confidenceLevel);
        this._bind();
        this._render();
    }

    _q(sel) { return this.root.querySelector(sel); }

    _bind() {
        this._q('[data-true-mean]').addEventListener('input', () => this._applyControls());
        this._q('[data-true-sigma]').addEventListener('input', () => this._applyControls());
        this._q('[data-sample-size]').addEventListener('input', () => this._applyControls());
        this._q('[data-confidence]').addEventListener('change', () => this._applyControls());
        this._q('[data-run="1"]').addEventListener('click', () => this._runBatch(1));
        this._q('[data-run="25"]').addEventListener('click', () => this._runBatch(25));
        this._q('[data-run="100"]').addEventListener('click', () => this._runBatch(100));
        this._q('[data-clear]').addEventListener('click', () => { this.intervals = []; this._render(); this._q('[data-feedback]').textContent = 'Historique vidé.'; });
        this._q('[data-reset]').addEventListener('click', () => { this.intervals = []; this._render(); this._q('[data-feedback]').textContent = 'Paramètres réinitialisés.'; });
    }

    _applyControls() {
        const p = this.params;
        const mean = Number(this._q('[data-true-mean]').value);
        const sigma = Number(this._q('[data-true-sigma]').value);
        const n = Number(this._q('[data-sample-size]').value);
        const level = Number(this._q('[data-confidence]').value);
        p.trueMean = Number.isFinite(mean) ? mean : p.trueMean;
        p.trueSigma = Number.isFinite(sigma) ? Math.max(1, sigma) : p.trueSigma;
        p.sampleSize = Number.isFinite(n) ? Math.max(5, Math.round(n)) : p.sampleSize;
        p.confidenceLevel = Number.isFinite(level) ? level : p.confidenceLevel;
        this._q('[data-true-mean-value]').textContent = p.trueMean.toFixed(1);
        this._q('[data-true-sigma-value]').textContent = p.trueSigma.toFixed(1);
        this._q('[data-sample-size-value]').textContent = String(p.sampleSize);
        this._q('[data-target]').textContent = `${p.confidenceLevel}%`;
        this._render();
    }

    _getZForConfidence(level) {
        if (Math.abs(level - 90) < 0.01) return 1.6448536269514722;
        if (Math.abs(level - 99) < 0.01) return 2.5758293035489004;
        return 1.959963984540054;
    }

    _sampleStandardNormal() {
        let u = 0; let v = 0;
        while (u <= Number.EPSILON) u = Math.random();
        while (v <= Number.EPSILON) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    _sampleMean() {
        let sum = 0;
        for (let i = 0; i < this.params.sampleSize; i += 1) {
            sum += this.params.trueMean + (this.params.trueSigma * this._sampleStandardNormal());
        }
        return sum / this.params.sampleSize;
    }

    _createInterval() {
        const z = this._getZForConfidence(this.params.confidenceLevel);
        const mean = this._sampleMean();
        const margin = z * this.params.trueSigma / Math.sqrt(this.params.sampleSize);
        const lower = mean - margin;
        const upper = mean + margin;
        return { id: this.intervals.length + 1, mean, lower, upper, margin, covers: lower <= this.params.trueMean && this.params.trueMean <= upper };
    }

    _sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

    async _runBatch(count) {
        if (this.running) return;
        this.running = true;
        const checkpoint = Math.max(1, Math.floor(count / 10));
        for (let i = 0; i < count && !this._destroyed; i += 1) {
            const interval = this._createInterval();
            this.intervals.unshift(interval);
            if (this.intervals.length > this.maxIntervals) this.intervals = this.intervals.slice(0, this.maxIntervals);
            if (i % checkpoint === 0 || i === count - 1) {
                this._render();
                await this._sleep(20);
            }
        }
        if (this._destroyed) return;
        this.running = false;
        const { rate } = this._computeCoverage();
        this._q('[data-feedback]').textContent = `Terminé. Couverture observée : ${(rate * 100).toFixed(1)}%.`;
    }

    _computeCoverage() {
        const total = this.intervals.length;
        const covered = this.intervals.filter((it) => it.covers).length;
        return { total, covered, rate: total > 0 ? covered / total : 0 };
    }

    _renderMetrics() {
        const { total, covered, rate } = this._computeCoverage();
        this._q('[data-total]').textContent = String(total);
        this._q('[data-covered]').textContent = String(covered);
        this._q('[data-rate]').textContent = total ? `${(rate * 100).toFixed(2)}%` : '--';
    }

    _renderChart() {
        const svg = this._q('[data-chart]');
        const width = 400;
        const rows = this.intervals.slice(0, 24);
        const height = Math.max(140, 30 + rows.length * 8);
        const padding = { left: 38, right: 12, top: 14, bottom: 20 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        let minX = this.params.trueMean - (3.8 * this.params.trueSigma);
        let maxX = this.params.trueMean + (3.8 * this.params.trueSigma);
        rows.forEach((it) => { minX = Math.min(minX, it.lower); maxX = Math.max(maxX, it.upper); });
        const span = Math.max(1e-6, maxX - minX);
        const xToPx = (v) => padding.left + ((v - minX) / span) * plotWidth;
        const rowHeight = rows.length > 0 ? plotHeight / rows.length : plotHeight;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        if (!rows.length) {
            svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="var(--muted, #888)">Aucun intervalle simulé</text>`;
            return;
        }

        const trueMeanX = xToPx(this.params.trueMean);
        let html = `<line x1="${trueMeanX}" y1="${padding.top}" x2="${trueMeanX}" y2="${height - padding.bottom}" stroke="#dc2626" stroke-width="1.6"></line>`;
        rows.forEach((it, idx) => {
            const y = padding.top + (idx + 0.5) * rowHeight;
            const stroke = it.covers ? '#0f766e' : '#b91c1c';
            html += `<line x1="${xToPx(it.lower)}" y1="${y}" x2="${xToPx(it.upper)}" y2="${y}" stroke="${stroke}" stroke-width="1.8"></line>`;
            html += `<circle cx="${xToPx(it.mean)}" cy="${y}" r="2.2" fill="${stroke}"></circle>`;
        });
        svg.innerHTML = html;
    }

    _render() {
        this._renderMetrics();
        this._renderChart();
    }

    destroy() {
        this._destroyed = true;
        if (this.root) this.root.innerHTML = '';
    }
}

if (typeof window !== 'undefined') {
    window.ConfidenceIntervalWidget = ConfidenceIntervalWidget;
}
