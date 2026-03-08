class BooleanSimplifierWidget {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.listeners = [];

        this.originalExpression = '';
        this.originalNode = null;
        this.steps = [];
        this.finalNode = null;
        this.cursor = 0;
        this.lastEquivalence = null;
    }

    static ensureStyles() {
        if (document.getElementById('boolean-simplifier-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'boolean-simplifier-widget-styles';
        style.textContent = `
            .boolean-simplifier-widget { display: grid; gap: 0.9rem; }
            .boolean-simplifier-toolbar {
                display: grid;
                gap: 0.6rem;
            }
            .boolean-simplifier-input-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                align-items: center;
            }
            .boolean-simplifier-input-row .input { flex: 1; min-width: 240px; }
            .boolean-simplifier-hint {
                margin: 0;
                color: var(--tone-indigo-text);
                font-size: 0.82rem;
                line-height: 1.45;
                border: 1px solid var(--tone-indigo-border);
                background: var(--tone-indigo-bg);
                border-radius: var(--radius-sm);
                padding: 0.45rem 0.55rem;
            }
            .boolean-simplifier-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 0.45rem;
            }
            .boolean-simplifier-actions .btn {
                min-width: 140px;
            }
            .boolean-simplifier-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
                gap: 0.8rem;
            }
            .boolean-simplifier-panel {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--bg);
                padding: 0.7rem;
                display: grid;
                gap: 0.5rem;
            }
            .boolean-simplifier-panel h4 {
                margin: 0;
                font-size: 0.88rem;
                color: var(--text);
            }
            .boolean-simplifier-line {
                display: grid;
                gap: 0.2rem;
            }
            .boolean-simplifier-line label {
                font-size: 0.74rem;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .boolean-simplifier-code {
                font-family: var(--font-mono);
                font-size: 0.82rem;
                color: var(--text);
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 0.45rem 0.5rem;
                word-break: break-word;
            }
            .boolean-simplifier-diff {
                border: 1px dashed var(--border);
                border-radius: 8px;
                background: var(--card);
                padding: 0.45rem 0.5rem;
                display: grid;
                gap: 0.28rem;
                font-family: var(--font-mono);
                font-size: 0.79rem;
                line-height: 1.45;
            }
            .boolean-simplifier-diff-line {
                margin: 0;
                word-break: break-word;
            }
            .boolean-simplifier-diff-tag {
                font-family: var(--font);
                font-size: 0.72rem;
                color: var(--muted);
                margin-right: 0.28rem;
            }
            .boolean-simplifier-diff-changed {
                background: var(--tone-warning-bg);
                border-radius: 4px;
                padding: 0 0.08rem;
            }
            .boolean-simplifier-error {
                color: var(--tone-danger-text);
                background: var(--tone-danger-bg);
                border: 1px solid var(--danger);
                border-radius: 8px;
                padding: 0.45rem 0.55rem;
                font-size: 0.82rem;
            }
            .boolean-simplifier-steps {
                margin: 0;
                padding-left: 1.1rem;
                display: grid;
                gap: 0.38rem;
                max-height: 340px;
                overflow: auto;
            }
            .boolean-simplifier-step {
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 0.42rem 0.5rem;
                background: var(--bg);
                font-size: 0.78rem;
                color: var(--text);
            }
            .boolean-simplifier-step.active {
                border-color: var(--primary);
                background: var(--tone-indigo-bg);
            }
            .boolean-simplifier-step.current {
                border-color: var(--primary);
                box-shadow: 0 0 0 2px rgba(67, 56, 202, 0.2);
            }
            .boolean-simplifier-rule {
                font-weight: 700;
                color: var(--primary);
            }
            .boolean-simplifier-meta {
                font-size: 0.78rem;
                color: var(--muted);
            }
            .boolean-simplifier-cue {
                margin-top: 0.18rem;
                font-size: 0.76rem;
                color: var(--tone-indigo-text);
                background: var(--tone-indigo-bg);
                border: 1px solid var(--tone-indigo-border);
                border-radius: 6px;
                padding: 0.25rem 0.35rem;
            }
            .boolean-simplifier-verdict {
                border-radius: 8px;
                padding: 0.45rem 0.55rem;
                font-size: 0.8rem;
                border: 1px solid var(--border);
                background: var(--bg);
                color: var(--text);
            }
            .boolean-simplifier-verdict.ok {
                color: var(--tone-success-text);
                border-color: var(--accent);
                background: var(--tone-success-bg);
            }
            .boolean-simplifier-verdict.bad {
                color: var(--tone-danger-text);
                border-color: var(--danger);
                background: var(--tone-danger-bg);
            }
            .boolean-simplifier-table-wrap {
                overflow-x: auto;
                border: 1px solid var(--border);
                border-radius: 8px;
            }
            .boolean-simplifier-table {
                width: 100%;
                border-collapse: collapse;
                font-family: var(--font-mono);
                font-size: 0.78rem;
            }
            .boolean-simplifier-table th,
            .boolean-simplifier-table td {
                border: 1px solid var(--border);
                padding: 0.32rem 0.42rem;
                text-align: center;
            }
            .boolean-simplifier-table th {
                background: var(--bg);
            }
            .boolean-simplifier-table tr.mismatch td {
                background: var(--tone-danger-bg);
                color: var(--tone-danger-text);
            }
            @media (max-width: 1000px) {
                .boolean-simplifier-grid { grid-template-columns: 1fr; }
            }
            @media (max-width: 640px) {
                .boolean-simplifier-actions {
                    display: grid;
                    grid-template-columns: 1fr;
                }
                .boolean-simplifier-actions .btn {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        BooleanSimplifierWidget.ensureStyles();
        const widget = new BooleanSimplifierWidget(container, config);
        widget.init();

        return {
            destroy: () => widget.destroy()
        };
    }

    init() {
        if (!this.container) return;

        const defaultExpression = this.config.defaultExpression || 'A OR (A AND B)';

        this.container.classList.add('boolean-simplifier-widget');
        this.container.innerHTML = `
            <div class="boolean-simplifier-toolbar">
                <div class="boolean-simplifier-input-row">
                    <input type="text" class="input" data-role="input" placeholder="Ex: NOT (A AND B) OR (A AND B)" value="${this.escapeHtml(defaultExpression)}">
                </div>
                <p class="boolean-simplifier-hint">
                    Mode d'emploi: 1) simplifie l'expression, 2) avance etape par etape, 3) verifie l'equivalence finale.
                </p>
                <div class="boolean-simplifier-actions">
                    <button type="button" class="btn btn-primary" data-role="run">Simplifier tout</button>
                    <button type="button" class="btn btn-secondary" data-role="step">Etape +1</button>
                    <button type="button" class="btn btn-secondary" data-role="reset">Retour debut</button>
                    <button type="button" class="btn btn-secondary" data-role="check">Verifier equivalence</button>
                </div>
                <div data-role="error"></div>
            </div>

            <div class="boolean-simplifier-grid">
                <div class="boolean-simplifier-panel">
                    <h4>Etat de simplification</h4>
                    <div class="boolean-simplifier-line">
                        <label>Expression originale</label>
                        <div class="boolean-simplifier-code" data-role="original">--</div>
                    </div>
                    <div class="boolean-simplifier-line">
                        <label>Expression courante</label>
                        <div class="boolean-simplifier-code" data-role="current">--</div>
                    </div>
                    <div class="boolean-simplifier-line">
                        <label>Expression finale</label>
                        <div class="boolean-simplifier-code" data-role="final">--</div>
                    </div>
                    <div class="boolean-simplifier-line">
                        <label>Transformation courante</label>
                        <div class="boolean-simplifier-diff" data-role="diff">Aucune etape appliquee.</div>
                    </div>
                    <div class="boolean-simplifier-meta" data-role="meta">0/0 etape appliquee</div>
                    <div class="boolean-simplifier-verdict" data-role="verdict">Lance une simplification puis valide l'equivalence.</div>
                </div>

                <div class="boolean-simplifier-panel">
                    <h4>Journal des transformations</h4>
                    <ol class="boolean-simplifier-steps" data-role="steps"></ol>
                </div>
            </div>

            <div class="boolean-simplifier-panel">
                <h4>Verification par table de verite</h4>
                <div class="boolean-simplifier-table-wrap" data-role="table"></div>
            </div>
        `;

        this.inputEl = this.container.querySelector('[data-role="input"]');
        this.runBtn = this.container.querySelector('[data-role="run"]');
        this.stepBtn = this.container.querySelector('[data-role="step"]');
        this.resetBtn = this.container.querySelector('[data-role="reset"]');
        this.checkBtn = this.container.querySelector('[data-role="check"]');

        this.errorEl = this.container.querySelector('[data-role="error"]');
        this.originalEl = this.container.querySelector('[data-role="original"]');
        this.currentEl = this.container.querySelector('[data-role="current"]');
        this.finalEl = this.container.querySelector('[data-role="final"]');
        this.diffEl = this.container.querySelector('[data-role="diff"]');
        this.metaEl = this.container.querySelector('[data-role="meta"]');
        this.stepsEl = this.container.querySelector('[data-role="steps"]');
        this.tableEl = this.container.querySelector('[data-role="table"]');
        this.verdictEl = this.container.querySelector('[data-role="verdict"]');

        this.listen(this.runBtn, 'click', () => {
            if (this.computeSimplification()) {
                this.cursor = this.steps.length;
                this.lastEquivalence = null;
                this.renderAll();
            }
        });

        this.listen(this.stepBtn, 'click', () => {
            if (!this.ensureSimplificationPrepared()) return;
            if (this.cursor < this.steps.length) {
                this.cursor += 1;
            }
            this.lastEquivalence = null;
            this.renderAll();
        });

        this.listen(this.resetBtn, 'click', () => {
            if (!this.ensureSimplificationPrepared()) return;
            this.cursor = 0;
            this.lastEquivalence = null;
            this.renderAll();
        });

        this.listen(this.checkBtn, 'click', () => {
            if (!this.ensureSimplificationPrepared()) return;

            const comparison = BooleanExpressionEngine.areEquivalent(this.originalNode, this.currentNode());
            this.lastEquivalence = comparison;
            this.renderVerdict();
        });

        this.listen(this.inputEl, 'keydown', (event) => {
            if (event.key === 'Enter') {
                this.runBtn.click();
            }
        });

        this.computeSimplification();
        this.renderAll();
    }

    ensureSimplificationPrepared() {
        const normalizedInput = String(this.inputEl.value || '').trim();
        const changed = normalizedInput !== this.originalExpression;

        if (changed || !this.originalNode) {
            const ok = this.computeSimplification();
            if (!ok) return false;
        }

        return true;
    }

    computeSimplification() {
        const expression = String(this.inputEl.value || '').trim();
        if (!expression) {
            this.showError('Saisissez une expression a simplifier.');
            return false;
        }

        try {
            const original = BooleanExpressionEngine.parse(expression);
            const simplification = BooleanExpressionEngine.simplify(original, 40);

            this.originalExpression = expression;
            this.originalNode = original;
            this.steps = simplification.steps;
            this.finalNode = simplification.node;
            this.cursor = 0;
            this.lastEquivalence = null;

            this.clearError();
            return true;
        } catch (error) {
            this.showError(error.message || String(error));
            return false;
        }
    }

    currentNode() {
        if (!this.originalNode) return null;
        if (this.cursor <= 0) return this.originalNode;
        return this.steps[this.cursor - 1]?.node || this.originalNode;
    }

    renderAll() {
        if (!this.originalNode) {
            this.originalEl.textContent = '--';
            this.currentEl.textContent = '--';
            this.finalEl.textContent = '--';
            this.diffEl.textContent = 'Aucune etape appliquee.';
            this.metaEl.textContent = '0/0 etape appliquee';
            this.stepsEl.innerHTML = '';
            this.tableEl.innerHTML = '';
            this.renderVerdict();
            return;
        }

        const originalExpr = BooleanExpressionEngine.nodeToExpression(this.originalNode);
        const currentExpr = BooleanExpressionEngine.nodeToExpression(this.currentNode());
        const finalExpr = BooleanExpressionEngine.nodeToExpression(this.finalNode || this.originalNode);

        this.originalEl.textContent = originalExpr || '--';
        this.currentEl.textContent = currentExpr || '--';
        this.finalEl.textContent = finalExpr || '--';
        this.metaEl.textContent = `${this.cursor}/${this.steps.length} etape(s) appliquee(s)`;

        this.renderCurrentDiff();
        this.renderSteps();
        this.renderComparisonTable();
        this.renderVerdict();
    }

    renderCurrentDiff() {
        if (!this.diffEl) return;
        if (!this.steps.length || this.cursor <= 0) {
            this.diffEl.textContent = 'Aucune etape appliquee.';
            return;
        }

        const step = this.steps[this.cursor - 1];
        if (!step) {
            this.diffEl.textContent = 'Aucune etape appliquee.';
            return;
        }

        this.diffEl.innerHTML = `
            <p class="boolean-simplifier-diff-line"><span class="boolean-simplifier-diff-tag">Avant</span>${this.diffHtml(step.before, step.after)}</p>
            <p class="boolean-simplifier-diff-line"><span class="boolean-simplifier-diff-tag">Apres</span>${this.diffHtml(step.after, step.before)}</p>
        `;
    }

    diffHtml(baseExpr, compareExpr) {
        const baseTokens = String(baseExpr || '').split(/\s+/).filter(Boolean);
        const compareTokens = String(compareExpr || '').split(/\s+/).filter(Boolean);
        return baseTokens.map((token, idx) => {
            const same = token === compareTokens[idx];
            const safe = this.escapeHtml(token);
            return same ? safe : `<span class="boolean-simplifier-diff-changed">${safe}</span>`;
        }).join(' ');
    }

    rulePedagogyCue(ruleName) {
        const key = String(ruleName || '').toLowerCase();
        if (key.includes('de morgan')) return 'Pense "inverse l operateur + nie chaque terme".';
        if (key.includes('absorption')) return 'Repere le motif X combine avec (X et/ou Y): le terme redondant disparait.';
        if (key.includes('double negation')) return 'Deux negations consecutives s annulent.';
        if (key.includes('domination')) return 'Un element dominant fige le resultat (OR avec 1, AND avec 0).';
        if (key.includes('element neutre')) return 'L element neutre ne modifie pas la valeur logique.';
        if (key.includes('idempotence')) return 'Dupliquer la meme variable ne change pas l expression.';
        if (key.includes('complementarite')) return 'X avec NOT X force soit 0 (AND), soit 1 (OR).';
        return 'Verifie la transformation ligne par ligne avant de passer a l etape suivante.';
    }

    renderSteps() {
        if (!this.steps.length) {
            this.stepsEl.innerHTML = '<li class="boolean-simplifier-step">Aucune simplification evidente: l\'expression est deja stable avec les regles disponibles.</li>';
            return;
        }

        this.stepsEl.innerHTML = this.steps.map((step, index) => {
            const active = index < this.cursor ? 'active' : '';
            const current = index === this.cursor - 1 ? 'current' : '';
            return `
                <li class="boolean-simplifier-step ${active} ${current}">
                    <div class="boolean-simplifier-rule">${index + 1}. ${this.escapeHtml(step.rule)}</div>
                    <div>${this.escapeHtml(step.before)} => <strong>${this.escapeHtml(step.after)}</strong></div>
                    <div class="boolean-simplifier-meta">${this.escapeHtml(step.description)}</div>
                    <div class="boolean-simplifier-cue">${this.escapeHtml(this.rulePedagogyCue(step.rule))}</div>
                </li>
            `;
        }).join('');
    }

    renderComparisonTable() {
        const left = this.originalNode;
        const right = this.currentNode();
        if (!left || !right) {
            this.tableEl.innerHTML = '';
            return;
        }

        const vars = BooleanExpressionEngine.normalizeVariables([
            ...BooleanExpressionEngine.collectVariables(left),
            ...BooleanExpressionEngine.collectVariables(right)
        ]);

        const rows = BooleanExpressionEngine.generateTruthTable(left, vars).rows;
        const html = rows.map((row) => {
            const assignment = row.assignment;
            const leftValue = BooleanExpressionEngine.evaluate(left, assignment);
            const rightValue = BooleanExpressionEngine.evaluate(right, assignment);
            const mismatch = leftValue !== rightValue ? 'mismatch' : '';

            const cells = vars.map((name) => `<td>${assignment[name]}</td>`).join('');
            return `<tr class="${mismatch}">${cells}<td>${leftValue}</td><td>${rightValue}</td></tr>`;
        }).join('');

        const head = vars.map((name) => `<th>${name}</th>`).join('');

        this.tableEl.innerHTML = `
            <table class="boolean-simplifier-table">
                <thead>
                    <tr>${head}<th>Orig</th><th>Courant</th></tr>
                </thead>
                <tbody>${html}</tbody>
            </table>
        `;
    }

    renderVerdict() {
        if (!this.lastEquivalence) {
            this.verdictEl.className = 'boolean-simplifier-verdict';
            this.verdictEl.textContent = 'Clique sur "Verifier equivalence" pour comparer l\'originale et l\'expression courante.';
            return;
        }

        if (this.lastEquivalence.equivalent) {
            this.verdictEl.className = 'boolean-simplifier-verdict ok';
            this.verdictEl.textContent = 'Equivalent: les deux expressions donnent le meme resultat pour toutes les affectations.';
            return;
        }

        const example = this.lastEquivalence.counterExample || {};
        const assign = Object.entries(example).map(([k, v]) => `${k}=${v}`).join(', ');
        this.verdictEl.className = 'boolean-simplifier-verdict bad';
        this.verdictEl.textContent = `Non equivalent: contre-exemple ${assign} (originale=${this.lastEquivalence.left}, courante=${this.lastEquivalence.right}).`;
    }

    showError(message) {
        this.errorEl.innerHTML = `<div class="boolean-simplifier-error">${this.escapeHtml(message)}</div>`;
    }

    clearError() {
        this.errorEl.innerHTML = '';
    }

    listen(target, eventName, handler) {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(eventName, handler);
        this.listeners.push(() => target.removeEventListener(eventName, handler));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    destroy() {
        this.listeners.forEach((off) => off());
        this.listeners = [];
    }
}

if (typeof window !== 'undefined') {
    window.BooleanSimplifierWidget = BooleanSimplifierWidget;
}
