/**
 * ProbabilityModelPage - Modele probabiliste sur univers fini.
 */
class ProbabilityModelPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.currentScenarioId = 'die';
        this.scenario = null;
        this.eventAId = null;
        this.eventBId = null;
        this.drawStats = {
            trials: 0,
            inA: 0,
            inB: 0,
            inAB: 0
        };
        this.lastDraws = [];
    }

    async init() {
        await super.init();
        this.bindControls();
    }

    bindControls() {
        const scenarioSelect = document.getElementById('model-scenario');
        const eventASelect = document.getElementById('model-event-a');
        const eventBSelect = document.getElementById('model-event-b');

        if (scenarioSelect) {
            scenarioSelect.addEventListener('change', () => this.changeScenario(scenarioSelect.value));
        }
        if (eventASelect) {
            eventASelect.addEventListener('change', () => this.changeEvent('A', eventASelect.value));
        }
        if (eventBSelect) {
            eventBSelect.addEventListener('change', () => this.changeEvent('B', eventBSelect.value));
        }
    }

    getCurrentDelay(multiplier = 1) {
        const base = this.speedCtrl ? this.speedCtrl.getDelay() : 500;
        return Math.max(0, Math.round(base * multiplier));
    }

    getScenarioMap() {
        const cards = [];
        const suits = [
            { id: 'coeur', label: 'Coeur', color: 'rouge' },
            { id: 'carreau', label: 'Carreau', color: 'rouge' },
            { id: 'trefle', label: 'Trefle', color: 'noir' },
            { id: 'pique', label: 'Pique', color: 'noir' }
        ];
        const ranks = [
            { id: 'as', label: 'As' },
            { id: 'roi', label: 'Roi' }
        ];
        suits.forEach((suit) => {
            ranks.forEach((rank) => {
                cards.push({
                    id: `${rank.id}-${suit.id}`,
                    label: `${rank.label} ${suit.label}`,
                    suit: suit.id,
                    color: suit.color,
                    rank: rank.id
                });
            });
        });

        return {
            coin: {
                id: 'coin',
                label: 'Piece',
                description: 'Univers Omega = {Pile, Face}.',
                outcomes: [
                    { id: 'pile', label: 'Pile' },
                    { id: 'face', label: 'Face' }
                ],
                events: [
                    { id: 'pile', label: 'A = {Pile}', predicate: (outcome) => outcome.id === 'pile' },
                    { id: 'face', label: 'B = {Face}', predicate: (outcome) => outcome.id === 'face' },
                    { id: 'certain', label: 'C = evenement certain', predicate: () => true },
                    { id: 'impossible', label: 'D = evenement impossible', predicate: () => false }
                ]
            },
            die: {
                id: 'die',
                label: 'De (1..6)',
                description: 'Univers equiprobable a 6 issues.',
                outcomes: Array.from({ length: 6 }, (_, i) => ({
                    id: String(i + 1),
                    value: i + 1,
                    label: String(i + 1)
                })),
                events: [
                    { id: 'even', label: 'A = pair', predicate: (outcome) => (outcome.value % 2) === 0 },
                    { id: 'high', label: 'B = >= 4', predicate: (outcome) => outcome.value >= 4 },
                    { id: 'prime', label: 'C = premier', predicate: (outcome) => [2, 3, 5].includes(outcome.value) },
                    { id: 'small', label: 'D = <= 2', predicate: (outcome) => outcome.value <= 2 }
                ]
            },
            cards: {
                id: 'cards',
                label: 'Mini-paquet (8 cartes)',
                description: 'Cartes {As, Roi} x {Coeur, Carreau, Trefle, Pique}.',
                outcomes: cards,
                events: [
                    { id: 'heart', label: 'A = Coeur', predicate: (outcome) => outcome.suit === 'coeur' },
                    { id: 'ace', label: 'B = As', predicate: (outcome) => outcome.rank === 'as' },
                    { id: 'black', label: 'C = carte noire', predicate: (outcome) => outcome.color === 'noir' },
                    { id: 'king', label: 'D = Roi', predicate: (outcome) => outcome.rank === 'roi' }
                ]
            }
        };
    }

    resolveScenario(id) {
        const map = this.getScenarioMap();
        return map[id] || map.die;
    }

    findEventById(id) {
        return this.scenario.events.find((eventDef) => eventDef.id === id) || null;
    }

    getCurrentEventA() {
        return this.findEventById(this.eventAId) || this.scenario.events[0];
    }

    getCurrentEventB() {
        return this.findEventById(this.eventBId) || this.scenario.events[Math.min(1, this.scenario.events.length - 1)];
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.currentScenarioId = typeof cfg.defaultScenario === 'string' ? cfg.defaultScenario : 'die';
        this.scenario = this.resolveScenario(this.currentScenarioId);
        this.eventAId = typeof cfg.defaultEventA === 'string' ? cfg.defaultEventA : this.scenario.events[0].id;
        this.eventBId = typeof cfg.defaultEventB === 'string'
            ? cfg.defaultEventB
            : this.scenario.events[Math.min(1, this.scenario.events.length - 1)].id;
        this.syncScenarioControl();
        this.populateEventControls();
        this.clearDraws(false);
        this.clearHighlight();
        this.setStatus('Selectionne deux evenements puis observe A inter B, A union B et A complementaire.', 'neutral');
    }

    syncScenarioControl() {
        const scenarioSelect = document.getElementById('model-scenario');
        if (!scenarioSelect) return;
        scenarioSelect.value = this.scenario.id;
    }

    populateEventControls() {
        const eventASelect = document.getElementById('model-event-a');
        const eventBSelect = document.getElementById('model-event-b');
        const events = this.scenario.events;

        const renderOptions = (select, selectedId) => {
            if (!select) return selectedId;
            select.innerHTML = events
                .map((eventDef) => `<option value="${this.escapeHtml(eventDef.id)}">${this.escapeHtml(eventDef.label)}</option>`)
                .join('');
            const exists = events.some((eventDef) => eventDef.id === selectedId);
            const resolved = exists ? selectedId : events[0].id;
            select.value = resolved;
            return resolved;
        };

        this.eventAId = renderOptions(eventASelect, this.eventAId);
        this.eventBId = renderOptions(eventBSelect, this.eventBId);
        this.render();
    }

    clearDraws(withStatus = true) {
        this.drawStats = {
            trials: 0,
            inA: 0,
            inB: 0,
            inAB: 0
        };
        this.lastDraws = [];
        this.render();
        if (withStatus) {
            this.setStatus('Echantillon observe vide: repartition theorique uniquement.', 'neutral');
        }
    }

    changeScenario(id) {
        this.currentScenarioId = id || 'die';
        this.scenario = this.resolveScenario(this.currentScenarioId);
        this.eventAId = this.scenario.events[0].id;
        this.eventBId = this.scenario.events[Math.min(1, this.scenario.events.length - 1)].id;
        this.populateEventControls();
        this.clearDraws(false);
        this.setStatus(`Scenario active: ${this.scenario.label}.`, 'neutral');
    }

    changeEvent(which, eventId) {
        if (which === 'A') this.eventAId = eventId;
        if (which === 'B') this.eventBId = eventId;
        this.render();
        this.setStatus('Evenements mis a jour.', 'neutral');
    }

    setStatus(message, tone = 'neutral') {
        const host = document.getElementById('model-feedback');
        if (!host) return;
        host.textContent = message;
        host.className = `feedback ${tone}`;
    }

    getCurrentSets() {
        const eventA = this.getCurrentEventA();
        const eventB = this.getCurrentEventB();
        const outcomes = this.scenario.outcomes;

        const inA = outcomes.filter((outcome) => eventA.predicate(outcome));
        const inB = outcomes.filter((outcome) => eventB.predicate(outcome));
        const inAB = outcomes.filter((outcome) => eventA.predicate(outcome) && eventB.predicate(outcome));
        const inAOnly = outcomes.filter((outcome) => eventA.predicate(outcome) && !eventB.predicate(outcome));
        const inBOnly = outcomes.filter((outcome) => !eventA.predicate(outcome) && eventB.predicate(outcome));
        const inNone = outcomes.filter((outcome) => !eventA.predicate(outcome) && !eventB.predicate(outcome));

        return {
            outcomes,
            eventA,
            eventB,
            inA,
            inB,
            inAB,
            inAOnly,
            inBOnly,
            inNone
        };
    }

    probabilityFromCount(count, total) {
        if (!Number.isFinite(total) || total <= 0) return 0;
        return count / total;
    }

    formatProbability(value) {
        if (!Number.isFinite(value)) return '--';
        return value.toFixed(3);
    }

    formatFraction(count, total) {
        return `${count}/${total} = ${this.formatProbability(this.probabilityFromCount(count, total))}`;
    }

    sampleOutcome() {
        const outcomes = this.scenario.outcomes;
        const index = Math.floor(Math.random() * outcomes.length);
        return outcomes[index];
    }

    sampleOne() {
        const sets = this.getCurrentSets();
        const eventA = sets.eventA;
        const eventB = sets.eventB;
        const outcome = this.sampleOutcome();
        const inA = eventA.predicate(outcome);
        const inB = eventB.predicate(outcome);

        this.drawStats.trials += 1;
        if (inA) this.drawStats.inA += 1;
        if (inB) this.drawStats.inB += 1;
        if (inA && inB) this.drawStats.inAB += 1;

        this.lastDraws.unshift({
            index: this.drawStats.trials,
            label: outcome.label,
            inA,
            inB
        });
        if (this.lastDraws.length > 15) {
            this.lastDraws = this.lastDraws.slice(0, 15);
        }
    }

    async runOnce() {
        if (this.state.running) return;
        this.state.running = true;
        this.highlightLine('model-line0');
        await OEIUtils.sleep(this.getCurrentDelay(0.15));
        this.highlightLine('model-line4');
        this.sampleOne();
        this.highlightLine('model-line8');
        this.render();
        await OEIUtils.sleep(this.getCurrentDelay(0.12));
        this.clearHighlight();
        this.state.running = false;
        const latest = this.lastDraws[0];
        if (latest) {
            this.setStatus(`Tirage #${latest.index}: ${latest.label}.`, 'success');
        }
    }

    async runBatch(count) {
        if (this.state.running) return;
        const batch = Number(count) || 0;
        if (batch <= 0) return;

        this.state.running = true;
        this.highlightLine('model-line3');
        this.setStatus(`Simulation de ${batch} tirages...`, 'neutral');

        const checkpoint = Math.max(1, Math.floor(batch / 20));
        for (let i = 0; i < batch; i += 1) {
            this.sampleOne();
            if (i % checkpoint === 0 || i === batch - 1) {
                this.highlightLine('model-line8');
                this.render();
                await OEIUtils.sleep(this.getCurrentDelay(0.05));
            }
        }

        this.clearHighlight();
        this.state.running = false;
        this.render();
        this.setStatus(`Termine: ${this.drawStats.trials} tirages observes.`, 'success');
    }

    renderScenarioInfo(sets) {
        this.updateInfo('model-scenario-label', this.scenario.label);
        this.updateInfo('model-scenario-description', this.scenario.description);
        this.updateInfo('model-event-a-label', sets.eventA.label);
        this.updateInfo('model-event-b-label', sets.eventB.label);
    }

    renderCoreMetrics(sets) {
        const cardU = sets.outcomes.length;
        const cardA = sets.inA.length;
        const cardB = sets.inB.length;
        const cardAB = sets.inAB.length;
        const cardAUnionB = cardA + cardB - cardAB;
        const cardAComplement = sets.inNone.length + sets.inBOnly.length;

        const pA = this.probabilityFromCount(cardA, cardU);
        const pB = this.probabilityFromCount(cardB, cardU);
        const pAB = this.probabilityFromCount(cardAB, cardU);
        const pAUnionB = this.probabilityFromCount(cardAUnionB, cardU);

        this.updateInfo('model-card-u', String(cardU));
        this.updateInfo('model-card-a', String(cardA));
        this.updateInfo('model-card-b', String(cardB));
        this.updateInfo('model-card-ab', String(cardAB));
        this.updateInfo('model-card-aub', String(cardAUnionB));
        this.updateInfo('model-card-ac', String(cardAComplement));

        this.updateInfo('model-pa', this.formatFraction(cardA, cardU));
        this.updateInfo('model-pb', this.formatFraction(cardB, cardU));
        this.updateInfo('model-pab', this.formatFraction(cardAB, cardU));
        this.updateInfo('model-paub', this.formatFraction(cardAUnionB, cardU));
        this.updateInfo('model-pa-rule', `${this.formatProbability(pA + pB - pAB)} (formule)`);
        this.updateInfo('model-identity', `${this.formatProbability(pA)} + ${this.formatProbability(this.probabilityFromCount(cardAComplement, cardU))}`);
    }

    renderObservedMetrics() {
        const trials = this.drawStats.trials;
        const pAObs = trials > 0 ? this.drawStats.inA / trials : null;
        const pBObs = trials > 0 ? this.drawStats.inB / trials : null;
        const pABObs = trials > 0 ? this.drawStats.inAB / trials : null;

        this.updateInfo('model-trials', String(trials));
        this.updateInfo('model-obs-a', trials > 0 ? this.formatProbability(pAObs) : '--');
        this.updateInfo('model-obs-b', trials > 0 ? this.formatProbability(pBObs) : '--');
        this.updateInfo('model-obs-ab', trials > 0 ? this.formatProbability(pABObs) : '--');
    }

    renderSampleSpace(sets) {
        const host = document.getElementById('model-sample-space');
        if (!host) return;
        host.innerHTML = sets.outcomes.map((outcome) => {
            const inA = sets.eventA.predicate(outcome);
            const inB = sets.eventB.predicate(outcome);
            let cls = 'model-chip model-chip-none';
            if (inA && inB) cls = 'model-chip model-chip-both';
            else if (inA) cls = 'model-chip model-chip-a';
            else if (inB) cls = 'model-chip model-chip-b';
            return `<span class="${cls}" title="${this.escapeHtml(outcome.label)}">${this.escapeHtml(outcome.label)}</span>`;
        }).join('');
    }

    renderOutcomeTable(sets) {
        const body = document.getElementById('model-outcome-body');
        if (!body) return;
        body.innerHTML = sets.outcomes.map((outcome) => {
            const inA = sets.eventA.predicate(outcome);
            const inB = sets.eventB.predicate(outcome);
            return `
                <tr>
                    <td>${this.escapeHtml(outcome.label)}</td>
                    <td>${inA ? 'Oui' : 'Non'}</td>
                    <td>${inB ? 'Oui' : 'Non'}</td>
                    <td>${inA && inB ? 'Oui' : 'Non'}</td>
                </tr>
            `;
        }).join('');
    }

    renderLastDraws() {
        const host = document.getElementById('model-last-draws');
        if (!host) return;
        if (!this.lastDraws.length) {
            host.innerHTML = '<li class="neutral">Aucun tirage.</li>';
            return;
        }
        host.innerHTML = this.lastDraws.slice(0, 10).map((draw) => {
            const tags = [];
            if (draw.inA) tags.push('A');
            if (draw.inB) tags.push('B');
            const cls = draw.inA && draw.inB ? 'success' : 'neutral';
            return `<li class="${cls}">#${draw.index} -> ${this.escapeHtml(draw.label)} ${tags.length ? `(${tags.join(',')})` : ''}</li>`;
        }).join('');
    }

    renderVenn(sets) {
        const svg = document.getElementById('model-venn');
        if (!svg) return;
        const width = Math.max(440, svg.clientWidth || 640);
        const height = 220;
        const cxA = width * 0.4;
        const cxB = width * 0.58;
        const cy = 106;
        const r = Math.min(74, Math.round(width * 0.16));

        const onlyA = sets.inAOnly.length;
        const onlyB = sets.inBOnly.length;
        const both = sets.inAB.length;
        const outside = sets.inNone.length;

        const html = `
            <rect x="0" y="0" width="${width}" height="${height}" fill="var(--card)"></rect>
            <rect x="16" y="16" width="${width - 32}" height="${height - 48}" fill="none" stroke="var(--border)" stroke-width="1.5"></rect>
            <text x="24" y="30" font-size="12" fill="var(--muted)">Omega</text>
            <circle cx="${cxA}" cy="${cy}" r="${r}" fill="rgba(59, 130, 246, 0.20)" stroke="#2563eb" stroke-width="2"></circle>
            <circle cx="${cxB}" cy="${cy}" r="${r}" fill="rgba(245, 158, 11, 0.22)" stroke="#d97706" stroke-width="2"></circle>

            <text x="${cxA - r * 0.45}" y="${cy + 5}" text-anchor="middle" font-size="14" fill="var(--text)">${onlyA}</text>
            <text x="${(cxA + cxB) / 2}" y="${cy + 5}" text-anchor="middle" font-size="14" fill="var(--text)">${both}</text>
            <text x="${cxB + r * 0.45}" y="${cy + 5}" text-anchor="middle" font-size="14" fill="var(--text)">${onlyB}</text>
            <text x="${width - 54}" y="${height - 66}" text-anchor="middle" font-size="14" fill="var(--text)">${outside}</text>

            <text x="${cxA - 34}" y="${cy - r - 10}" text-anchor="middle" font-size="12" fill="#1d4ed8">${this.escapeHtml(sets.eventA.label)}</text>
            <text x="${cxB + 34}" y="${cy - r - 10}" text-anchor="middle" font-size="12" fill="#b45309">${this.escapeHtml(sets.eventB.label)}</text>
        `;

        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.innerHTML = html;
    }

    render() {
        if (!this.scenario) return;
        const sets = this.getCurrentSets();
        this.renderScenarioInfo(sets);
        this.renderCoreMetrics(sets);
        this.renderObservedMetrics();
        this.renderSampleSpace(sets);
        this.renderOutcomeTable(sets);
        this.renderLastDraws();
        this.renderVenn(sets);
    }
}

if (typeof window !== 'undefined') {
    window.ProbabilityModelPage = ProbabilityModelPage;
}
