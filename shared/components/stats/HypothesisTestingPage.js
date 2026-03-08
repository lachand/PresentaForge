/**
 * HypothesisTestingPage - Test z un echantillon sur la moyenne.
 */
class HypothesisTestingPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.defaults = {
            mu0: 50,
            trueMu: 53,
            sigma: 12,
            sampleSize: 25,
            alpha: 5,
            alternative: 'two-sided'
        };
        this.params = { ...this.defaults };
        this.history = [];
        this.maxHistory = 220;
    }

    async init() {
        await super.init();
        this.bindInputs();
    }

    bindInputs() {
        ['test-mu0', 'test-true-mu', 'test-sigma', 'test-sample-size', 'test-alpha', 'test-alternative'].forEach((id) => {
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
            mu0: Number.isFinite(cfg.defaultMu0) ? cfg.defaultMu0 : 50,
            trueMu: Number.isFinite(cfg.defaultTrueMu) ? cfg.defaultTrueMu : 53,
            sigma: Number.isFinite(cfg.defaultSigma) ? cfg.defaultSigma : 12,
            sampleSize: Number.isFinite(cfg.defaultSampleSize) ? Math.max(5, Math.round(cfg.defaultSampleSize)) : 25,
            alpha: Number.isFinite(cfg.defaultAlphaPercent) ? cfg.defaultAlphaPercent : 5,
            alternative: typeof cfg.defaultAlternative === 'string' ? cfg.defaultAlternative : 'two-sided'
        };
        this.params = { ...this.defaults };
        this.history = [];
        this.syncControls();
        this.render();
        this.clearHighlight();
        this.setStatus('Parametres reinitialises. Lance un echantillon pour tester H0.', 'neutral');
    }

    syncControls() {
        const assign = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = String(value);
        };
        assign('test-mu0', this.params.mu0);
        assign('test-true-mu', this.params.trueMu);
        assign('test-sigma', this.params.sigma);
        assign('test-sample-size', this.params.sampleSize);
        assign('test-alpha', this.params.alpha);
        assign('test-alternative', this.params.alternative);
    }

    applyControls() {
        const mu0 = Number(document.getElementById('test-mu0')?.value);
        const trueMu = Number(document.getElementById('test-true-mu')?.value);
        const sigma = Number(document.getElementById('test-sigma')?.value);
        const n = Number(document.getElementById('test-sample-size')?.value);
        const alpha = Number(document.getElementById('test-alpha')?.value);
        const alt = document.getElementById('test-alternative')?.value || this.params.alternative;

        this.params.mu0 = Number.isFinite(mu0) ? Math.max(-50, Math.min(150, mu0)) : this.params.mu0;
        this.params.trueMu = Number.isFinite(trueMu) ? Math.max(-50, Math.min(150, trueMu)) : this.params.trueMu;
        this.params.sigma = Number.isFinite(sigma) ? Math.max(1, Math.min(80, sigma)) : this.params.sigma;
        this.params.sampleSize = Number.isFinite(n) ? Math.max(5, Math.min(400, Math.round(n))) : this.params.sampleSize;
        this.params.alpha = Number.isFinite(alpha) ? Math.max(0.1, Math.min(20, alpha)) : this.params.alpha;
        this.params.alternative = ['two-sided', 'greater', 'less'].includes(alt) ? alt : 'two-sided';

        this.render();
    }

    clearHistory() {
        this.history = [];
        this.render();
        this.setStatus('Historique des tests vide.', 'neutral');
    }

    setStatus(message, tone = 'neutral') {
        const host = document.getElementById('test-feedback');
        if (!host) return;
        host.textContent = message;
        host.className = `feedback ${tone}`;
    }

    formatNumber(value, digits = 3) {
        if (!Number.isFinite(value)) return '--';
        return Number(value).toFixed(digits);
    }

    sampleStandardNormal() {
        let u = 0;
        let v = 0;
        while (u <= Number.EPSILON) u = Math.random();
        while (v <= Number.EPSILON) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    erf(x) {
        const sign = x >= 0 ? 1 : -1;
        const ax = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * ax);
        const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
        return sign * y;
    }

    normalCdf(x) {
        return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
    }

    inverseNormal(probability) {
        const p = Math.max(1e-9, Math.min(1 - 1e-9, probability));
        let lo = -8;
        let hi = 8;
        for (let i = 0; i < 90; i += 1) {
            const mid = (lo + hi) / 2;
            if (this.normalCdf(mid) < p) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    }

    sampleMean() {
        let sum = 0;
        for (let i = 0; i < this.params.sampleSize; i += 1) {
            const z = this.sampleStandardNormal();
            const x = this.params.trueMu + (this.params.sigma * z);
            sum += x;
        }
        return sum / this.params.sampleSize;
    }

    computePValue(z) {
        const phi = this.normalCdf(z);
        if (this.params.alternative === 'greater') {
            return 1 - phi;
        }
        if (this.params.alternative === 'less') {
            return phi;
        }
        return 2 * (1 - this.normalCdf(Math.abs(z)));
    }

    getAlternativeLabel() {
        if (this.params.alternative === 'greater') return 'H1: mu > mu0';
        if (this.params.alternative === 'less') return 'H1: mu < mu0';
        return 'H1: mu != mu0';
    }

    computeCriticalValues() {
        const alpha = this.params.alpha / 100;
        if (this.params.alternative === 'greater') {
            return { left: null, right: this.inverseNormal(1 - alpha) };
        }
        if (this.params.alternative === 'less') {
            return { left: this.inverseNormal(alpha), right: null };
        }
        const k = this.inverseNormal(1 - (alpha / 2));
        return { left: -k, right: k };
    }

    createTestResult() {
        const xbar = this.sampleMean();
        const se = this.params.sigma / Math.sqrt(this.params.sampleSize);
        const z = (xbar - this.params.mu0) / se;
        const pValue = this.computePValue(z);
        const alpha = this.params.alpha / 100;
        const reject = pValue <= alpha;
        const id = this.history.length + 1;

        return {
            id,
            xbar,
            se,
            z,
            pValue,
            reject
        };
    }

    async runOnce() {
        if (this.state.running) return;
        this.state.running = true;
        this.highlightLine('test-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.12));
        this.highlightLine('test-line2');

        const result = this.createTestResult();
        this.history.unshift(result);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }

        this.highlightLine('test-line5');
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(0.1));
        this.clearHighlight();
        this.state.running = false;

        this.setStatus(
            `Test #${result.id}: p-value=${this.formatNumber(result.pValue, 4)} (${result.reject ? 'rejet H0' : 'non rejet H0'})`,
            result.reject ? 'success' : 'neutral'
        );
    }

    async runBatch(count) {
        if (this.state.running) return;
        const batch = Number(count) || 0;
        if (batch <= 0) return;

        this.state.running = true;
        this.highlightLine('test-line1');
        this.setStatus(`Simulation de ${batch} tests en cours...`, 'neutral');

        const checkpoint = Math.max(1, Math.floor(batch / 25));
        for (let i = 0; i < batch; i += 1) {
            const result = this.createTestResult();
            this.history.unshift(result);
            if (this.history.length > this.maxHistory) {
                this.history = this.history.slice(0, this.maxHistory);
            }

            if (i % checkpoint === 0 || i === batch - 1) {
                this.highlightLine('test-line4');
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.03));
            }
        }

        this.clearHighlight();
        this.state.running = false;
        this.render();
        const rejectRate = this.computeRejectRate();
        this.setStatus(`Batch termine. Taux de rejet observe: ${this.formatNumber(rejectRate * 100, 2)}%.`, 'success');
    }

    computeRejectRate() {
        if (!this.history.length) return 0;
        const rejects = this.history.filter((r) => r.reject).length;
        return rejects / this.history.length;
    }

    renderLabels() {
        this.updateInfo('test-mu0-value', this.formatNumber(this.params.mu0, 1));
        this.updateInfo('test-true-mu-value', this.formatNumber(this.params.trueMu, 1));
        this.updateInfo('test-sigma-value', this.formatNumber(this.params.sigma, 1));
        this.updateInfo('test-sample-size-value', String(this.params.sampleSize));
        this.updateInfo('test-alpha-value', `${this.formatNumber(this.params.alpha, 1)}%`);
    }

    renderSummary() {
        const last = this.history[0] || null;
        const rejectRate = this.computeRejectRate();
        const alpha = this.params.alpha / 100;
        const approxPowerSignal = Math.abs(this.params.trueMu - this.params.mu0);

        this.updateInfo('test-alt-label', this.getAlternativeLabel());
        this.updateInfo('test-history-size', String(this.history.length));
        this.updateInfo('test-reject-rate', this.history.length ? `${this.formatNumber(rejectRate * 100, 2)}%` : '--');
        this.updateInfo('test-alpha-target', `${this.formatNumber(alpha * 100, 2)}%`);
        this.updateInfo(
            'test-interpretation',
            approxPowerSignal < 0.25
                ? 'mu reel proche de mu0: le taux de rejet devrait etre proche de alpha.'
                : 'mu reel eloigne de mu0: le taux de rejet devrait augmenter (puissance plus forte).'
        );

        this.updateInfo('test-last-xbar', last ? this.formatNumber(last.xbar, 3) : '--');
        this.updateInfo('test-last-z', last ? this.formatNumber(last.z, 3) : '--');
        this.updateInfo('test-last-p', last ? this.formatNumber(last.pValue, 4) : '--');
        this.updateInfo('test-last-decision', last ? (last.reject ? 'Rejet H0' : 'Non rejet H0') : '--');
    }

    renderHistoryTable() {
        const body = document.getElementById('test-history-body');
        if (!body) return;
        if (!this.history.length) {
            body.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun test effectue.</td></tr>';
            return;
        }
        body.innerHTML = this.history.slice(0, 12).map((item) => `
            <tr>
                <td>#${item.id}</td>
                <td>${this.formatNumber(item.xbar, 2)}</td>
                <td>${this.formatNumber(item.z, 3)}</td>
                <td>${this.formatNumber(item.pValue, 4)}</td>
                <td>${item.reject ? 'Rejet' : 'Non rejet'}</td>
            </tr>
        `).join('');
    }

    renderChart() {
        const svg = document.getElementById('test-chart');
        if (!svg) return;

        const width = Math.max(620, svg.clientWidth || 760);
        const height = 260;
        const padding = { left: 46, right: 18, top: 16, bottom: 34 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const xMin = -4;
        const xMax = 4;
        const span = xMax - xMin;
        const xToPx = (x) => padding.left + ((x - xMin) / span) * plotWidth;
        const yMax = 0.42;
        const yToPx = (y) => padding.top + (1 - (y / yMax)) * plotHeight;
        const critical = this.computeCriticalValues();
        const last = this.history[0] || null;

        const normalPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        const shadeRect = (from, to) => {
            const x1 = xToPx(Math.max(xMin, from));
            const x2 = xToPx(Math.min(xMax, to));
            html += `<rect x="${Math.min(x1, x2)}" y="${padding.top}" width="${Math.abs(x2 - x1)}" height="${plotHeight}" fill="#fee2e2" opacity="0.75"></rect>`;
        };
        if (critical.left != null) shadeRect(xMin, critical.left);
        if (critical.right != null) shadeRect(critical.right, xMax);

        if (critical.left != null) {
            const x = xToPx(critical.left);
            html += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#b91c1c" stroke-dasharray="4 3"></line>`;
        }
        if (critical.right != null) {
            const x = xToPx(critical.right);
            html += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#b91c1c" stroke-dasharray="4 3"></line>`;
        }

        let path = '';
        const steps = 180;
        for (let i = 0; i <= steps; i += 1) {
            const xValue = xMin + (i / steps) * span;
            const yValue = normalPdf(xValue);
            const px = xToPx(xValue);
            const py = yToPx(yValue);
            path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`;
        }
        html += `<path d="${path}" fill="none" stroke="var(--primary)" stroke-width="2"></path>`;

        if (last) {
            const xObs = xToPx(Math.max(xMin, Math.min(xMax, last.z)));
            html += `<line x1="${xObs}" y1="${padding.top}" x2="${xObs}" y2="${height - padding.bottom}" stroke="#0f766e" stroke-width="2"></line>`;
            html += `<text x="${xObs + 6}" y="${padding.top + 14}" font-size="11" fill="#0f766e">z observe</text>`;
        }

        [-4, -3, -2, -1, 0, 1, 2, 3, 4].forEach((tick) => {
            const x = xToPx(tick);
            html += `<line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 5}" stroke="var(--border)"></line>`;
            html += `<text x="${x}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${tick}</text>`;
        });

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        this.renderLabels();
        this.renderSummary();
        this.renderHistoryTable();
        this.renderChart();
    }
}

if (typeof window !== 'undefined') {
    window.HypothesisTestingPage = HypothesisTestingPage;
}
