/**
 * ProbabilityFrequencyPage - Simulateur probabilites/frequences.
 */
class ProbabilityFrequencyPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.currentScenarioId = 'coin';
        this.scenario = null;
        this.trials = 0;
        this.successes = 0;
        this.outcomeCounts = {};
        this.frequencyHistory = [];
        this.lastOutcomes = [];
        this.maxHistoryPoints = 300;
    }

    async init() {
        await super.init();
        this.bindScenarioSelect();
    }

    bindScenarioSelect() {
        const select = document.getElementById('scenarioSelect');
        if (!select) return;
        if (!select.value) {
            select.value = this.currentScenarioId;
        }
        select.addEventListener('change', () => this.changeScenario(select.value));
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    getScenarioMap() {
        const scenarioConfig = this.data?.visualization?.config?.scenarios || {};
        const coinHeadProbability = Number.isFinite(scenarioConfig.coin?.headProbability)
            ? scenarioConfig.coin.headProbability
            : 0.5;
        const urnRed = Number.isFinite(scenarioConfig.urn?.red) ? Math.max(1, Math.floor(scenarioConfig.urn.red)) : 3;
        const urnBlue = Number.isFinite(scenarioConfig.urn?.blue) ? Math.max(1, Math.floor(scenarioConfig.urn.blue)) : 2;
        const urnTheoretical = urnRed / (urnRed + urnBlue);

        return {
            coin: {
                id: 'coin',
                label: 'Piece (Pile)',
                eventLabel: 'Obtenir Pile',
                theoreticalProbability: coinHeadProbability,
                outcomes: ['Pile', 'Face'],
                draw: () => (Math.random() < coinHeadProbability ? 'Pile' : 'Face'),
                isSuccess: (outcome) => outcome === 'Pile',
                description: 'Simulation de lancers de piece biaisee ou equilibree.'
            },
            die: {
                id: 'die',
                label: 'De (>= 5)',
                eventLabel: 'Obtenir 5 ou 6',
                theoreticalProbability: 2 / 6,
                outcomes: ['1', '2', '3', '4', '5', '6'],
                draw: () => String(Math.floor(Math.random() * 6) + 1),
                isSuccess: (outcome) => Number(outcome) >= 5,
                description: 'Simulation de lancers de de a 6 faces.'
            },
            urn: {
                id: 'urn',
                label: `Urne (${urnRed}R/${urnBlue}B)`,
                eventLabel: 'Tirer une boule rouge',
                theoreticalProbability: urnTheoretical,
                outcomes: ['Rouge', 'Bleu'],
                draw: () => (Math.random() < urnTheoretical ? 'Rouge' : 'Bleu'),
                isSuccess: (outcome) => outcome === 'Rouge',
                description: 'Tirages independants avec remise dans une urne.'
            }
        };
    }

    resolveScenario(id) {
        const map = this.getScenarioMap();
        return map[id] || map.coin;
    }

    reset() {
        const defaultScenario = this.data?.visualization?.config?.defaultScenario || 'coin';
        const select = document.getElementById('scenarioSelect');
        const selected = select && select.value ? select.value : defaultScenario;
        this.currentScenarioId = selected;
        if (select) select.value = selected;

        this.scenario = this.resolveScenario(this.currentScenarioId);
        this.trials = 0;
        this.successes = 0;
        this.outcomeCounts = {};
        this.frequencyHistory = [];
        this.lastOutcomes = [];
        this.scenario.outcomes.forEach((outcome) => {
            this.outcomeCounts[outcome] = 0;
        });

        this.render();
        this.clearHighlight();
        this.setStatus('Pret a lancer la simulation.', 'neutral');
    }

    changeScenario(id) {
        this.currentScenarioId = id || 'coin';
        this.reset();
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('freq-status');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    formatProbability(value) {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(3);
    }

    sampleOne() {
        this.highlightLine('simulation-line2');
        const outcome = this.scenario.draw();

        this.highlightLine('simulation-line3');
        const success = this.scenario.isSuccess(outcome);

        this.highlightLine('simulation-line4');
        this.trials += 1;
        if (success) this.successes += 1;
        this.outcomeCounts[outcome] = (this.outcomeCounts[outcome] || 0) + 1;

        this.highlightLine('simulation-line5');
        const freq = this.successes / this.trials;
        this.frequencyHistory.push({ trial: this.trials, frequency: freq });
        if (this.frequencyHistory.length > this.maxHistoryPoints) {
            this.frequencyHistory.shift();
        }

        this.lastOutcomes.unshift({
            trial: this.trials,
            outcome,
            success
        });
        if (this.lastOutcomes.length > 20) {
            this.lastOutcomes = this.lastOutcomes.slice(0, 20);
        }
    }

    async runOnce() {
        if (this.state.running) return;
        this.state.running = true;
        this.highlightLine('simulation-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.2));
        this.sampleOne();
        this.render();
        this.setStatus(`Essai ${this.trials}: ${this.lastOutcomes[0].outcome}.`, 'success');
        await OEIUtils.sleep(this.getCurrentDelay(0.2));
        this.clearHighlight();
        this.state.running = false;
    }

    async runBatch(count) {
        if (this.state.running) return;
        const batch = Number(count) || 0;
        if (batch <= 0) return;

        this.state.running = true;
        this.highlightLine('simulation-line1');
        this.setStatus(`Simulation de ${batch} essais en cours...`, 'neutral');

        const checkpoint = Math.max(1, Math.floor(batch / 18));
        for (let i = 0; i < batch; i += 1) {
            this.sampleOne();

            const shouldRender = batch <= 20 || i === batch - 1 || i % checkpoint === 0;
            if (shouldRender) {
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.08));
            }
        }

        this.render();
        this.setStatus(
            `Termine: frequence observee ${this.formatProbability(this.successes / Math.max(1, this.trials))}.`,
            'success'
        );
        this.clearHighlight();
        this.state.running = false;
    }

    renderSummary() {
        const observed = this.trials > 0 ? this.successes / this.trials : 0;
        const expected = this.scenario.theoreticalProbability;
        const error = Math.abs(observed - expected);

        this.updateInfo('freq-trials', String(this.trials));
        this.updateInfo('freq-successes', String(this.successes));
        this.updateInfo('freq-frequency', this.formatProbability(observed));
        this.updateInfo('freq-theoretical', this.formatProbability(expected));
        this.updateInfo('freq-error', this.formatProbability(error));
        this.updateInfo('freq-event-label', this.scenario.eventLabel);
        this.updateInfo('freq-scenario-label', this.scenario.label);
        this.updateInfo('freq-scenario-description', this.scenario.description);
    }

    renderOutcomeTable() {
        const body = document.getElementById('freq-outcome-body');
        if (!body) return;
        const rows = this.scenario.outcomes.map((outcome) => {
            const count = this.outcomeCounts[outcome] || 0;
            const freq = this.trials > 0 ? count / this.trials : 0;
            return `
                <tr>
                    <td>${this.escapeHtml(outcome)}</td>
                    <td>${count}</td>
                    <td>${this.formatProbability(freq)}</td>
                </tr>
            `;
        }).join('');
        body.innerHTML = rows;
    }

    renderHistory() {
        const list = document.getElementById('freq-last-draws');
        if (!list) return;
        if (!this.lastOutcomes.length) {
            list.innerHTML = '<li class="text-sm text-muted">Aucun tirage pour le moment.</li>';
            return;
        }
        list.innerHTML = this.lastOutcomes.slice(0, 10).map((entry) => {
            const cls = entry.success ? 'success' : 'neutral';
            return `<li class="${cls}">#${entry.trial} -> ${this.escapeHtml(entry.outcome)}</li>`;
        }).join('');
    }

    renderChart() {
        const svg = document.getElementById('freq-chart');
        if (!svg) return;

        const width = Math.max(420, svg.clientWidth || 680);
        const height = 240;
        const padding = { left: 44, right: 16, top: 14, bottom: 30 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const expected = this.scenario.theoreticalProbability;

        const y = (value) => padding.top + (1 - value) * plotHeight;
        const x = (trial, maxTrial) => padding.left + ((trial - 1) / Math.max(1, maxTrial - 1)) * plotWidth;

        let html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
            <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--border)"></line>
        `;

        [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
            const py = y(tick);
            html += `<line x1="${padding.left}" y1="${py}" x2="${width - padding.right}" y2="${py}" stroke="rgba(148,163,184,0.22)"></line>`;
            html += `<text x="${padding.left - 8}" y="${py + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${tick.toFixed(2)}</text>`;
        });

        const expectedY = y(expected);
        html += `
            <line x1="${padding.left}" y1="${expectedY}" x2="${width - padding.right}" y2="${expectedY}" stroke="#f59e0b" stroke-dasharray="6 4" stroke-width="2"></line>
            <text x="${width - padding.right - 4}" y="${expectedY - 6}" text-anchor="end" font-size="11" fill="#b45309">p theorique ${this.formatProbability(expected)}</text>
        `;

        if (this.frequencyHistory.length > 0) {
            const maxTrial = this.frequencyHistory[this.frequencyHistory.length - 1].trial;
            const step = Math.max(1, Math.floor(this.frequencyHistory.length / 220));
            const sampled = [];
            for (let i = 0; i < this.frequencyHistory.length; i += step) {
                sampled.push(this.frequencyHistory[i]);
            }
            if (sampled[sampled.length - 1]?.trial !== this.frequencyHistory[this.frequencyHistory.length - 1].trial) {
                sampled.push(this.frequencyHistory[this.frequencyHistory.length - 1]);
            }

            const points = sampled.map((p) => `${x(p.trial, maxTrial)},${y(p.frequency)}`).join(' ');
            const last = this.frequencyHistory[this.frequencyHistory.length - 1];
            html += `<polyline points="${points}" fill="none" stroke="var(--primary)" stroke-width="2.4"></polyline>`;
            html += `<circle cx="${x(last.trial, maxTrial)}" cy="${y(last.frequency)}" r="3.6" fill="var(--accent)"></circle>`;
            html += `<text x="${x(last.trial, maxTrial)}" y="${y(last.frequency) - 10}" text-anchor="middle" font-size="11" fill="var(--text)">f=${this.formatProbability(last.frequency)}</text>`;
            html += `<text x="${width - padding.right}" y="${height - 8}" text-anchor="end" font-size="11" fill="var(--muted)">n=${last.trial}</text>`;
        } else {
            html += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="13" fill="var(--muted)">Aucun essai pour le moment</text>`;
        }

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        this.renderSummary();
        this.renderOutcomeTable();
        this.renderHistory();
        this.renderChart();
    }
}

if (typeof window !== 'undefined') {
    window.ProbabilityFrequencyPage = ProbabilityFrequencyPage;
}
