class StabilityComparatorPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.initialItems = [];
        this.stableTrace = [];
        this.unstableTrace = [];
        this.stepIndex = 0;
        this.autoTimer = null;
        this.speedCtrl = null;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.bindEvents();
        this.prepareFromInput();
    }

    cacheDom() {
        this.input = document.getElementById('stb-input');
        this.btnRandom = document.getElementById('stb-random');
        this.btnPrepare = document.getElementById('stb-prepare');
        this.btnStep = document.getElementById('stb-step');
        this.btnRun = document.getElementById('stb-run');
        this.btnReset = document.getElementById('stb-reset');

        this.feedback = document.getElementById('stb-feedback');
        this.stepIndexOutput = document.getElementById('stb-step-index');
        this.stepMaxOutput = document.getElementById('stb-step-max');

        this.stableStep = document.getElementById('stb-stable-step');
        this.unstableStep = document.getElementById('stb-unstable-step');
        this.stableArray = document.getElementById('stb-stable-array');
        this.unstableArray = document.getElementById('stb-unstable-array');
        this.stableOrder = document.getElementById('stb-stable-order');
        this.unstableOrder = document.getElementById('stb-unstable-order');
        this.summary = document.getElementById('stb-summary');

        this.stableBadge = document.getElementById('stb-stable-badge');
        this.unstableBadge = document.getElementById('stb-unstable-badge');
    }

    bindEvents() {
        this.btnRandom.addEventListener('click', () => {
            this.input.value = this.generateRandomDatasetString();
            this.prepareFromInput();
        });

        this.btnPrepare.addEventListener('click', () => this.prepareFromInput());
        this.btnStep.addEventListener('click', () => this.nextStep());
        this.btnRun.addEventListener('click', () => this.toggleAuto());
        this.btnReset.addEventListener('click', () => this.resetStep());

        this.input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            this.prepareFromInput();
        });
    }

    cloneItems(items) {
        return items.map((item) => ({ ...item }));
    }

    formatItem(item) {
        return `${item.value}${item.label}`;
    }

    parseInput(value) {
        const source = String(value || '').trim();
        if (!source) return [];

        const tokens = source.split(',').map((token) => token.trim()).filter(Boolean);
        const items = [];

        tokens.forEach((token, index) => {
            const match = token.match(/^(-?\d+)([A-Za-z0-9_]*)$/);
            if (!match) {
                throw new Error(`Token invalide: ${token}`);
            }
            const numeric = Number(match[1]);
            const label = match[2] || String.fromCharCode(65 + (index % 26));
            items.push({
                value: numeric,
                label,
                origin: index,
                uid: `${numeric}-${label}-${index}`
            });
        });

        if (items.length < 2) {
            throw new Error('Le comparateur attend au moins 2 elements.');
        }
        return items;
    }

    generateRandomDatasetString() {
        const count = 8;
        const values = [];
        for (let i = 0; i < count; i += 1) {
            values.push(1 + Math.floor(Math.random() * 5));
        }

        const perValueOccurrence = new Map();
        return values.map((value) => {
            const current = perValueOccurrence.get(value) || 0;
            perValueOccurrence.set(value, current + 1);
            const label = String.fromCharCode(65 + current);
            return `${value}${label}`;
        }).join(',');
    }

    buildInsertionTrace(items) {
        const arr = this.cloneItems(items);
        const trace = [{ array: this.cloneItems(arr), message: 'Etat initial.' }];

        for (let i = 1; i < arr.length; i += 1) {
            const current = arr[i];
            let j = i - 1;

            while (j >= 0 && arr[j].value > current.value) {
                arr[j + 1] = arr[j];
                j -= 1;
            }
            arr[j + 1] = current;
            trace.push({
                array: this.cloneItems(arr),
                message: `Passe ${i}: insertion de ${this.formatItem(current)}.`
            });
        }

        return trace;
    }

    buildSelectionTrace(items) {
        const arr = this.cloneItems(items);
        const trace = [{ array: this.cloneItems(arr), message: 'Etat initial.' }];

        for (let i = 0; i < arr.length - 1; i += 1) {
            let minIndex = i;
            for (let j = i + 1; j < arr.length; j += 1) {
                if (arr[j].value < arr[minIndex].value) {
                    minIndex = j;
                }
            }

            if (minIndex !== i) {
                const tmp = arr[i];
                arr[i] = arr[minIndex];
                arr[minIndex] = tmp;
            }

            trace.push({
                array: this.cloneItems(arr),
                message: `Passe ${i + 1}: min dans la zone [${i}..n-1] puis echange.`
            });
        }

        return trace;
    }

    orderMap(items) {
        const map = new Map();
        items.forEach((item) => {
            const key = String(item.value);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item.label);
        });
        return map;
    }

    isStableComparedToInitial(currentItems) {
        const expected = this.orderMap(this.initialItems);
        const current = this.orderMap(currentItems);

        for (const [valueKey, labels] of expected.entries()) {
            const now = current.get(valueKey) || [];
            if (labels.join('|') !== now.join('|')) return false;
        }
        return true;
    }

    tableRowsForOrder(currentItems) {
        const expected = this.orderMap(this.initialItems);
        const current = this.orderMap(currentItems);

        const rows = [];
        Array.from(expected.keys())
            .sort((a, b) => Number(a) - Number(b))
            .forEach((key) => {
                const start = expected.get(key) || [];
                const now = current.get(key) || [];
                const ok = start.join('|') === now.join('|');
                rows.push({
                    value: key,
                    start: start.join(' -> ') || '-',
                    now: now.join(' -> ') || '-',
                    ok
                });
            });

        return rows;
    }

    renderOrderTable(host, currentItems) {
        const rows = this.tableRowsForOrder(currentItems);
        host.innerHTML = rows.map((row) => {
            const statusClass = row.ok ? 'stb-order-ok' : 'stb-order-bad';
            const statusText = row.ok ? 'Conserve' : 'Inverse';
            return `
                <tr>
                    <td><code>${this.escapeHtml(row.value)}</code></td>
                    <td>${this.escapeHtml(row.start)}</td>
                    <td>${this.escapeHtml(row.now)}</td>
                    <td class="${statusClass}">${statusText}</td>
                </tr>
            `;
        }).join('');
    }

    changedStabilityLabels(currentItems) {
        const expected = this.orderMap(this.initialItems);
        const current = this.orderMap(currentItems);
        const changed = new Set();

        expected.forEach((labels, valueKey) => {
            const now = current.get(valueKey) || [];
            if (labels.join('|') !== now.join('|')) {
                now.forEach((label) => changed.add(`${valueKey}-${label}`));
            }
        });
        return changed;
    }

    renderArray(host, items, changedSet) {
        host.innerHTML = items.map((item) => {
            const key = `${item.value}-${item.label}`;
            const changed = changedSet.has(key) ? ' changed' : '';
            return `
                <span class="stb-item${changed}">
                    <span class="value">${this.escapeHtml(item.value)}</span>
                    <span class="label">${this.escapeHtml(item.label)}</span>
                </span>
            `;
        }).join('');
    }

    maxSteps() {
        return Math.max(this.stableTrace.length, this.unstableTrace.length);
    }

    currentState(trace) {
        if (!trace.length) return { array: [], message: '-' };
        const idx = Math.min(this.stepIndex, trace.length - 1);
        return trace[idx];
    }

    setFeedback(message, type) {
        this.feedback.className = `feedback ${type || ''}`;
        this.feedback.textContent = message;
    }

    resetStep() {
        this.stopAuto();
        this.stepIndex = 0;
        this.render();
    }

    prepareFromInput() {
        this.stopAuto();
        try {
            const items = this.parseInput(this.input.value);
            this.initialItems = this.cloneItems(items);
            this.stableTrace = this.buildInsertionTrace(items);
            this.unstableTrace = this.buildSelectionTrace(items);
            this.stepIndex = 0;
            this.render();
            this.setFeedback('Jeu charge. Avancez pas a pas pour comparer la stabilite.', 'ok');
        } catch (error) {
            this.setFeedback(error.message || 'Format invalide.', 'bad');
        }
    }

    nextStep() {
        const limit = this.maxSteps();
        if (limit <= 1 || this.stepIndex >= limit - 1) {
            this.setFeedback('Derniere etape atteinte.', 'warning');
            return false;
        }
        this.stepIndex += 1;
        this.render();
        return true;
    }

    toggleAuto() {
        if (this.autoTimer) {
            this.stopAuto();
            return;
        }
        this.btnRun.textContent = 'Pause';
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    autoLoop() {
        if (!this.autoTimer) return;
        const hasNext = this.nextStep();
        if (!hasNext) {
            this.stopAuto();
            return;
        }
        this.autoTimer = setTimeout(() => this.autoLoop(), this.currentDelay());
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    stopAuto() {
        if (this.autoTimer) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.btnRun.textContent = 'Lecture auto';
    }

    renderStabilityBadge(host, isStable) {
        host.className = `mod-status ${isStable ? 'ok' : 'bad'}`;
        host.textContent = isStable ? 'Ordre preserve' : 'Ordre casse';
    }

    render() {
        const stableState = this.currentState(this.stableTrace);
        const unstableState = this.currentState(this.unstableTrace);

        const stableChanged = this.changedStabilityLabels(stableState.array);
        const unstableChanged = this.changedStabilityLabels(unstableState.array);

        this.renderArray(this.stableArray, stableState.array, stableChanged);
        this.renderArray(this.unstableArray, unstableState.array, unstableChanged);

        this.stableStep.textContent = stableState.message;
        this.unstableStep.textContent = unstableState.message;

        this.renderOrderTable(this.stableOrder, stableState.array);
        this.renderOrderTable(this.unstableOrder, unstableState.array);

        this.stepIndexOutput.textContent = String(this.stepIndex);
        this.stepMaxOutput.textContent = String(Math.max(this.maxSteps() - 1, 0));

        const stableOk = this.isStableComparedToInitial(stableState.array);
        const unstableOk = this.isStableComparedToInitial(unstableState.array);
        this.renderStabilityBadge(this.stableBadge, stableOk);
        this.renderStabilityBadge(this.unstableBadge, unstableOk);

        if (stableOk && unstableOk) {
            this.summary.textContent = 'Les deux tris ont encore preserve l ordre relatif des doublons a cette etape.';
        } else if (stableOk && !unstableOk) {
            this.summary.textContent = 'Selection sort a inverse des doublons: bon exemple d instabilite, contrairement a insertion sort.';
        } else {
            this.summary.textContent = 'Comparez les lignes de statut par valeur pour identifier ou l ordre des doublons change.';
        }
    }
}

if (typeof window !== 'undefined') {
    window.StabilityComparatorPage = StabilityComparatorPage;
}
