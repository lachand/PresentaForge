/**
 * DescriptiveStatsPage - Analyse descriptive de jeux de donnees.
 */
class DescriptiveStatsPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.defaultData = [12, 18, 19, 21, 22, 24, 24, 25, 27, 28, 30, 33, 34, 35, 37, 38];
        this.values = [];
        this.summary = null;
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    reset() {
        const defaultData = this.data?.visualization?.config?.defaultData;
        if (Array.isArray(defaultData) && defaultData.length > 0) {
            this.defaultData = defaultData.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v));
        }
        this.values = this.defaultData.slice();
        this.summary = this.computeSummary(this.values);
        this.syncInputWithValues();
        this.render();
        this.clearHighlight();
        this.setStatus('Echantillon de depart charge.', 'neutral');
    }

    syncInputWithValues() {
        const input = document.getElementById('stats-data-input');
        if (!input) return;
        input.value = this.values.join(', ');
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('stats-feedback');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    parseInputValues() {
        const input = document.getElementById('stats-data-input');
        const raw = input ? input.value : '';
        const parsed = String(raw || '')
            .split(/[\s,;]+/)
            .map((token) => Number(token))
            .filter((value) => Number.isFinite(value));

        if (parsed.length < 5) {
            return {
                ok: false,
                error: 'Entrez au moins 5 valeurs numeriques.'
            };
        }
        return { ok: true, values: parsed };
    }

    async analyzeData() {
        if (this.state.running) return;
        const parsed = this.parseInputValues();
        if (!parsed.ok) {
            this.setStatus(parsed.error, 'error');
            return;
        }

        this.state.running = true;
        this.highlightLine('analyse-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.15));

        this.highlightLine('analyse-line1');
        this.values = parsed.values.slice();
        await OEIUtils.sleep(this.getCurrentDelay(0.15));

        this.highlightLine('analyse-line2');
        this.summary = this.computeSummary(this.values);
        await OEIUtils.sleep(this.getCurrentDelay(0.15));

        this.highlightLine('analyse-line6');
        this.render();
        this.setStatus(`Analyse terminee sur ${this.values.length} valeurs.`, 'success');
        await OEIUtils.sleep(this.getCurrentDelay(0.1));
        this.clearHighlight();
        this.state.running = false;
    }

    addOutlier() {
        if (!this.summary) return;
        const max = this.summary.max;
        const iqr = this.summary.iqr;
        const fallback = this.summary.range > 0 ? this.summary.range : Math.abs(max || 10);
        const outlier = Math.round((max + Math.max(6, iqr * 2.2 || fallback * 0.8)) * 10) / 10;
        this.values.push(outlier);
        this.syncInputWithValues();
        this.summary = this.computeSummary(this.values);
        this.render();
        this.setStatus(`Outlier ajoute: ${outlier}.`, 'neutral');
    }

    medianOf(sorted) {
        const n = sorted.length;
        if (!n) return 0;
        const mid = Math.floor(n / 2);
        if (n % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
        return sorted[mid];
    }

    computeSummary(values) {
        const sorted = values.slice().sort((a, b) => a - b);
        const n = sorted.length;
        if (!n) {
            return {
                sorted: [],
                n: 0
            };
        }

        const min = sorted[0];
        const max = sorted[n - 1];
        const range = max - min;
        const sum = sorted.reduce((acc, value) => acc + value, 0);
        const mean = sum / n;
        const variance = sorted.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / n;
        const std = Math.sqrt(variance);
        const median = this.medianOf(sorted);

        const lower = n % 2 === 0 ? sorted.slice(0, n / 2) : sorted.slice(0, Math.floor(n / 2));
        const upper = n % 2 === 0 ? sorted.slice(n / 2) : sorted.slice(Math.floor(n / 2) + 1);
        const q1 = this.medianOf(lower.length ? lower : [min]);
        const q3 = this.medianOf(upper.length ? upper : [max]);
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const outliers = sorted.filter((value) => value < lowerFence || value > upperFence);
        const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
        const whiskerMin = inliers.length ? inliers[0] : min;
        const whiskerMax = inliers.length ? inliers[inliers.length - 1] : max;

        const histogram = this.computeHistogram(sorted);

        return {
            sorted,
            n,
            min,
            max,
            range,
            mean,
            median,
            q1,
            q3,
            iqr,
            variance,
            std,
            lowerFence,
            upperFence,
            outliers,
            whiskerMin,
            whiskerMax,
            histogram
        };
    }

    computeHistogram(sortedValues) {
        const n = sortedValues.length;
        if (!n) return [];
        const min = sortedValues[0];
        const max = sortedValues[n - 1];
        if (min === max) {
            return [{
                start: min,
                end: max,
                count: n
            }];
        }

        const binCount = Math.max(4, Math.min(10, Math.round(Math.sqrt(n))));
        const width = (max - min) / binCount;
        const bins = Array.from({ length: binCount }, (_, index) => ({
            start: min + index * width,
            end: index === binCount - 1 ? max : min + (index + 1) * width,
            count: 0
        }));

        sortedValues.forEach((value) => {
            const idx = Math.min(binCount - 1, Math.floor((value - min) / width));
            bins[idx].count += 1;
        });
        return bins;
    }

    format(value) {
        if (!Number.isFinite(value)) return '--';
        return Number(value).toFixed(2);
    }

    renderSummary() {
        if (!this.summary || this.summary.n === 0) return;
        this.updateInfo('stats-n', String(this.summary.n));
        this.updateInfo('stats-mean', this.format(this.summary.mean));
        this.updateInfo('stats-median', this.format(this.summary.median));
        this.updateInfo('stats-q1', this.format(this.summary.q1));
        this.updateInfo('stats-q3', this.format(this.summary.q3));
        this.updateInfo('stats-iqr', this.format(this.summary.iqr));
        this.updateInfo('stats-minmax', `${this.format(this.summary.min)} / ${this.format(this.summary.max)}`);
        this.updateInfo('stats-std', this.format(this.summary.std));
        this.updateInfo('stats-fence', `[${this.format(this.summary.lowerFence)} ; ${this.format(this.summary.upperFence)}]`);
    }

    renderSortedValues() {
        const host = document.getElementById('stats-sorted-values');
        if (!host || !this.summary) return;
        host.innerHTML = this.summary.sorted
            .map((value) => `<span class="stats-chip">${this.format(value)}</span>`)
            .join('');
    }

    renderOutliers() {
        const host = document.getElementById('stats-outliers');
        if (!host || !this.summary) return;
        if (!this.summary.outliers.length) {
            host.innerHTML = '<span class="text-sm text-muted">Aucun outlier detecte.</span>';
            return;
        }
        host.innerHTML = this.summary.outliers
            .map((value) => `<span class="stats-chip stats-chip-alert">${this.format(value)}</span>`)
            .join('');
    }

    renderHistogram() {
        const svg = document.getElementById('stats-histogram');
        if (!svg || !this.summary) return;

        const bins = this.summary.histogram || [];
        const width = Math.max(520, svg.clientWidth || 720);
        const height = 240;
        const padding = { left: 44, right: 16, top: 16, bottom: 34 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const maxCount = Math.max(1, ...bins.map((bin) => bin.count));
        const barWidth = bins.length > 0 ? plotWidth / bins.length : plotWidth;

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        bins.forEach((bin, index) => {
            const barHeight = (bin.count / maxCount) * (plotHeight - 2);
            const x = padding.left + index * barWidth + 2;
            const y = height - padding.bottom - barHeight;
            const w = Math.max(8, barWidth - 4);
            html += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="var(--primary)" opacity="0.82"></rect>`;
            html += `<text x="${x + (w / 2)}" y="${y - 4}" text-anchor="middle" font-size="11" fill="var(--text)">${bin.count}</text>`;
        });

        if (bins.length) {
            html += `<text x="${padding.left}" y="${height - 10}" text-anchor="start" font-size="11" fill="var(--muted)">${this.format(this.summary.min)}</text>`;
            html += `<text x="${width - padding.right}" y="${height - 10}" text-anchor="end" font-size="11" fill="var(--muted)">${this.format(this.summary.max)}</text>`;
        }

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    renderBoxplot() {
        const svg = document.getElementById('stats-boxplot');
        if (!svg || !this.summary || this.summary.n === 0) return;

        const width = Math.max(520, svg.clientWidth || 720);
        const height = 118;
        const padding = { left: 44, right: 16, top: 18, bottom: 30 };
        const y = 48;
        const min = this.summary.min;
        const max = this.summary.max;
        const span = max - min || 1;

        const project = (value) => {
            return padding.left + ((value - min) / span) * (width - padding.left - padding.right);
        };

        const xMin = project(this.summary.whiskerMin);
        const xMax = project(this.summary.whiskerMax);
        const xQ1 = project(this.summary.q1);
        const xQ3 = project(this.summary.q3);
        const xMedian = project(this.summary.median);
        const xMean = project(this.summary.mean);

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${xMin}" y1="${y}" x2="${xMax}" y2="${y}" stroke="var(--border)" stroke-width="2"></line>
            <rect x="${xQ1}" y="${y - 18}" width="${Math.max(4, xQ3 - xQ1)}" height="36" fill="rgba(79,70,229,0.2)" stroke="var(--primary)"></rect>
            <line x1="${xMedian}" y1="${y - 20}" x2="${xMedian}" y2="${y + 20}" stroke="var(--accent)" stroke-width="3"></line>
            <line x1="${xMin}" y1="${y - 12}" x2="${xMin}" y2="${y + 12}" stroke="var(--border)" stroke-width="2"></line>
            <line x1="${xMax}" y1="${y - 12}" x2="${xMax}" y2="${y + 12}" stroke="var(--border)" stroke-width="2"></line>
            <circle cx="${xMean}" cy="${y}" r="5" fill="#f59e0b"></circle>
        `;

        this.summary.outliers.forEach((value) => {
            const ox = project(value);
            html += `<circle cx="${ox}" cy="${y}" r="4.2" fill="#ef4444"></circle>`;
        });

        html += `
            <text x="${padding.left}" y="${height - 10}" text-anchor="start" font-size="11" fill="var(--muted)">min ${this.format(min)}</text>
            <text x="${width - padding.right}" y="${height - 10}" text-anchor="end" font-size="11" fill="var(--muted)">max ${this.format(max)}</text>
            <text x="${xMedian}" y="${y - 26}" text-anchor="middle" font-size="11" fill="var(--accent)">mediane ${this.format(this.summary.median)}</text>
            <text x="${xMean}" y="${y + 30}" text-anchor="middle" font-size="11" fill="#b45309">moyenne ${this.format(this.summary.mean)}</text>
        `;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        this.renderSummary();
        this.renderSortedValues();
        this.renderOutliers();
        this.renderHistogram();
        this.renderBoxplot();
    }
}

if (typeof window !== 'undefined') {
    window.DescriptiveStatsPage = DescriptiveStatsPage;
}
