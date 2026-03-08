class BooleanKarnaughWidget {
    constructor(container, config = {}) {
        this.container = container;
        this.config = config;
        this.listeners = [];

        this.baseVarNames = ['A', 'B', 'C', 'D'];
        this.varsCount = this.clampVarCount(Number(config.variables || 4));
        this.values = [];
        this.analysis = null;
        this.selectedImplicantIndex = -1;
        this.helpLevel = 0;
        this.helpMessages = [
            'Indice 1/3: cible d abord les plus grands blocs de 1 (8, puis 4, puis 2).',
            'Indice 2/3: n oublie pas l adjacence torique: bord gauche et bord droit sont voisins, idem haut et bas.',
            'Indice 3/3: un groupe valide ne doit jamais couvrir un 0; les X servent seulement a agrandir un groupe.'
        ];
        this.resetValues(0);
    }

    static ensureStyles() {
        if (document.getElementById('boolean-karnaugh-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'boolean-karnaugh-widget-styles';
        style.textContent = `
            .boolean-kmap-widget { display: grid; gap: 0.85rem; }
            .boolean-kmap-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                align-items: center;
            }
            .boolean-kmap-controls .input,
            .boolean-kmap-controls select { max-width: 360px; }
            .boolean-kmap-hint {
                margin: 0;
                color: var(--tone-indigo-text);
                font-size: 0.82rem;
                line-height: 1.45;
                background: var(--tone-indigo-bg);
                border: 1px solid var(--tone-indigo-border);
                border-radius: var(--radius-sm);
                padding: 0.45rem 0.55rem;
            }
            .boolean-kmap-help {
                border: 1px dashed var(--border);
                border-radius: 8px;
                background: var(--bg);
                padding: 0.5rem 0.55rem;
                display: grid;
                gap: 0.35rem;
            }
            .boolean-kmap-help-text {
                margin: 0;
                font-size: 0.78rem;
                color: var(--muted);
                line-height: 1.4;
            }
            .boolean-kmap-status {
                border-radius: 8px;
                border: 1px solid var(--border);
                background: var(--bg);
                color: var(--text);
                padding: 0.45rem 0.55rem;
                font-size: 0.8rem;
            }
            .boolean-kmap-status.ok {
                border-color: var(--accent);
                background: var(--tone-success-bg);
                color: var(--tone-success-text);
            }
            .boolean-kmap-status.error {
                border-color: var(--danger);
                background: var(--tone-danger-bg);
                color: var(--tone-danger-text);
            }
            .boolean-kmap-grid-wrap { overflow-x: auto; }
            .boolean-kmap-table {
                border-collapse: collapse;
                font-family: var(--font-mono);
                min-width: 420px;
            }
            .boolean-kmap-table th,
            .boolean-kmap-table td {
                border: 1px solid var(--border);
                text-align: center;
                padding: 0.38rem 0.46rem;
                font-size: 0.78rem;
            }
            .boolean-kmap-table th {
                background: var(--bg);
                color: var(--text);
                font-weight: 700;
            }
            .boolean-kmap-cell {
                min-width: 38px;
                min-height: 32px;
                cursor: pointer;
                font-weight: 700;
                transition: background 120ms ease, border-color 120ms ease;
                user-select: none;
            }
            .boolean-kmap-cell:focus-visible {
                outline: 2px solid var(--primary);
                outline-offset: -2px;
            }
            .boolean-kmap-cell.v0 { background: var(--card); color: var(--text); }
            .boolean-kmap-cell.v1 { background: var(--tone-success-bg); color: var(--tone-success-text); }
            .boolean-kmap-cell.vx { background: var(--tone-warning-bg); color: var(--tone-warning-text); }
            .boolean-kmap-cell.covered {
                box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.55);
            }
            .boolean-kmap-cell.focus-group {
                box-shadow: inset 0 0 0 3px rgba(79, 70, 229, 0.95);
                background-image: linear-gradient(135deg, rgba(129, 140, 248, 0.28), rgba(79, 70, 229, 0.18));
            }
            .boolean-kmap-output {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: var(--card);
                padding: 0.7rem;
                display: grid;
                gap: 0.48rem;
            }
            .boolean-kmap-output-row {
                display: grid;
                gap: 0.2rem;
            }
            .boolean-kmap-output-row label {
                font-size: 0.74rem;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .boolean-kmap-code {
                font-family: var(--font-mono);
                font-size: 0.8rem;
                border: 1px solid var(--border);
                background: var(--bg);
                border-radius: 8px;
                padding: 0.4rem 0.5rem;
                word-break: break-word;
            }
            .boolean-kmap-implicants {
                margin: 0;
                padding-left: 1.05rem;
                display: grid;
                gap: 0.32rem;
                max-height: 170px;
                overflow: auto;
            }
            .boolean-kmap-implicants li { font-size: 0.78rem; color: var(--text); }
            .boolean-kmap-imp-btn {
                width: 100%;
                text-align: left;
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 0.35rem 0.45rem;
                background: var(--bg);
                color: var(--text);
                font-family: inherit;
                font-size: 0.78rem;
                cursor: pointer;
            }
            .boolean-kmap-imp-btn.active {
                border-color: var(--primary);
                background: var(--tone-indigo-bg);
            }
            .boolean-kmap-imp-summary {
                margin: 0;
                font-size: 0.78rem;
                color: var(--muted);
            }
            @media (max-width: 740px) {
                .boolean-kmap-controls {
                    display: grid;
                    grid-template-columns: 1fr;
                }
                .boolean-kmap-controls .input,
                .boolean-kmap-controls select,
                .boolean-kmap-controls .btn {
                    width: 100%;
                    max-width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    static mount(container, config = {}) {
        BooleanKarnaughWidget.ensureStyles();
        const widget = new BooleanKarnaughWidget(container, config);
        widget.init();

        return {
            destroy: () => widget.destroy()
        };
    }

    init() {
        if (!this.container) return;

        const defaultExpr = this.config.defaultExpression || '(A AND B) OR (NOT C AND D)';

        this.container.classList.add('boolean-kmap-widget');
        this.container.innerHTML = `
            <div class="boolean-kmap-controls">
                <label for="kmap-vars">Variables</label>
                <select id="kmap-vars" class="input" data-role="vars">
                    <option value="2">2 (A,B)</option>
                    <option value="3">3 (A,B,C)</option>
                    <option value="4">4 (A,B,C,D)</option>
                </select>
                <input type="text" class="input" data-role="expr" placeholder="Ex: (A AND B) OR (NOT C)" value="${this.escapeHtml(defaultExpr)}">
                <button type="button" class="btn btn-primary" data-role="apply">Appliquer expression</button>
                <button type="button" class="btn btn-secondary" data-role="reset">Reinitialiser</button>
            </div>
            <p class="boolean-kmap-hint">
                Clique (ou touche Entree/Espace) sur une cellule pour changer son etat: 0 -> 1 -> X (don't care) -> 0.
            </p>
            <div class="boolean-kmap-help">
                <button type="button" class="btn btn-secondary" data-role="help">Indice progressif</button>
                <p class="boolean-kmap-help-text" data-role="help-text">Clique sur "Indice progressif" si tu bloques sur les groupements.</p>
            </div>
            <div class="boolean-kmap-status" data-role="status">Pret. Charge une expression ou modifie la carte manuellement.</div>
            <div class="boolean-kmap-grid-wrap" data-role="grid"></div>
            <div class="boolean-kmap-output">
                <div class="boolean-kmap-output-row">
                    <label>Minterms (1)</label>
                    <div class="boolean-kmap-code" data-role="minterms">--</div>
                </div>
                <div class="boolean-kmap-output-row">
                    <label>Don't care (X)</label>
                    <div class="boolean-kmap-code" data-role="dontcares">--</div>
                </div>
                <div class="boolean-kmap-output-row">
                    <label>Forme canonique SOP</label>
                    <div class="boolean-kmap-code" data-role="canonical">--</div>
                </div>
                <div class="boolean-kmap-output-row">
                    <label>Forme simplifiee SOP</label>
                    <div class="boolean-kmap-code" data-role="minimized">--</div>
                </div>
                <div class="boolean-kmap-output-row">
                    <label>Groupes (implicants)</label>
                    <p class="boolean-kmap-imp-summary" data-role="imp-summary">Clique un groupe pour le surligner dans la carte.</p>
                    <ol class="boolean-kmap-implicants" data-role="implicants"></ol>
                </div>
            </div>
        `;

        this.varsSelectEl = this.container.querySelector('[data-role="vars"]');
        this.exprInputEl = this.container.querySelector('[data-role="expr"]');
        this.applyBtn = this.container.querySelector('[data-role="apply"]');
        this.resetBtn = this.container.querySelector('[data-role="reset"]');
        this.helpBtn = this.container.querySelector('[data-role="help"]');
        this.helpTextEl = this.container.querySelector('[data-role="help-text"]');
        this.statusEl = this.container.querySelector('[data-role="status"]');
        this.gridEl = this.container.querySelector('[data-role="grid"]');
        this.mintermsEl = this.container.querySelector('[data-role="minterms"]');
        this.dontCaresEl = this.container.querySelector('[data-role="dontcares"]');
        this.canonicalEl = this.container.querySelector('[data-role="canonical"]');
        this.minimizedEl = this.container.querySelector('[data-role="minimized"]');
        this.impSummaryEl = this.container.querySelector('[data-role="imp-summary"]');
        this.implicantsEl = this.container.querySelector('[data-role="implicants"]');

        this.varsSelectEl.value = String(this.varsCount);

        this.listen(this.varsSelectEl, 'change', () => {
            this.varsCount = this.clampVarCount(Number(this.varsSelectEl.value));
            this.resetValues(0);
            this.selectedImplicantIndex = -1;
            this.setStatus(`Mode ${this.varsCount} variables.`, false);
            this.recompute();
        });

        this.listen(this.applyBtn, 'click', () => {
            this.applyExpression();
        });

        this.listen(this.resetBtn, 'click', () => {
            this.resetValues(0);
            this.selectedImplicantIndex = -1;
            this.setStatus('Carte reinitialisee a 0.', false);
            this.recompute();
        });

        this.listen(this.helpBtn, 'click', () => {
            this.helpLevel = (this.helpLevel + 1) % this.helpMessages.length;
            this.helpTextEl.textContent = this.helpMessages[this.helpLevel];
        });

        this.listen(this.gridEl, 'click', (event) => {
            const cell = event.target.closest('.boolean-kmap-cell');
            if (!cell || !this.gridEl.contains(cell)) return;

            const index = Number(cell.dataset.index);
            this.cycleCellValue(index);
            this.selectedImplicantIndex = -1;
            this.setStatus(`Cellule m${index} mise a jour.`, false);
            this.recompute();
        });

        this.listen(this.gridEl, 'keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const cell = event.target.closest('.boolean-kmap-cell');
            if (!cell || !this.gridEl.contains(cell)) return;
            event.preventDefault();
            const index = Number(cell.dataset.index);
            this.cycleCellValue(index);
            this.selectedImplicantIndex = -1;
            this.setStatus(`Cellule m${index} mise a jour.`, false);
            this.recompute();
        });

        this.listen(this.exprInputEl, 'keydown', (event) => {
            if (event.key === 'Enter') {
                this.applyExpression();
            }
        });

        this.listen(this.implicantsEl, 'click', (event) => {
            const button = event.target.closest('[data-imp-index]');
            if (!button) return;
            const idx = Number(button.dataset.impIndex);
            this.selectedImplicantIndex = this.selectedImplicantIndex === idx ? -1 : idx;
            this.renderMap();
            this.renderOutputs();
        });

        this.applyExpression();
    }

    clampVarCount(value) {
        if (value <= 2) return 2;
        if (value >= 4) return 4;
        return 3;
    }

    activeVarNames() {
        return this.baseVarNames.slice(0, this.varsCount);
    }

    resetValues(defaultValue) {
        const total = 2 ** this.varsCount;
        this.values = Array.from({ length: total }, () => defaultValue);
    }

    setStatus(message, isError) {
        this.statusEl.textContent = message;
        this.statusEl.classList.toggle('ok', !isError);
        this.statusEl.classList.toggle('error', Boolean(isError));
    }

    cycleCellValue(index) {
        const current = this.values[index];
        if (current === 0) this.values[index] = 1;
        else if (current === 1) this.values[index] = 'X';
        else this.values[index] = 0;
    }

    applyExpression() {
        const expr = String(this.exprInputEl.value || '').trim();
        if (!expr) {
            this.setStatus('Saisissez une expression avant de l\'appliquer.', true);
            return;
        }

        try {
            const ast = BooleanExpressionEngine.parse(expr);
            const vars = this.activeVarNames();
            const total = 2 ** vars.length;

            for (let index = 0; index < total; index += 1) {
                const assignment = {};
                for (let i = 0; i < vars.length; i += 1) {
                    assignment[vars[i]] = (index >> (vars.length - 1 - i)) & 1;
                }

                this.values[index] = BooleanExpressionEngine.evaluate(ast, assignment) ? 1 : 0;
            }

            this.selectedImplicantIndex = -1;
            this.setStatus('Expression appliquee avec succes.', false);
            this.recompute();
        } catch (error) {
            this.setStatus(error.message || String(error), true);
        }
    }

    recompute() {
        this.analysis = this.analyzeValues();
        this.renderMap();
        this.renderOutputs();
    }

    analyzeValues() {
        const ones = [];
        const dontCares = [];
        const zeros = [];

        this.values.forEach((value, index) => {
            if (value === 1) ones.push(index);
            else if (value === 'X') dontCares.push(index);
            else zeros.push(index);
        });

        const vars = this.activeVarNames();
        const canonical = this.buildCanonicalSop(ones, vars);

        let minimized = '0';
        let implicants = [];

        if (ones.length === 0) {
            minimized = '0';
            implicants = [];
        } else if (zeros.length === 0) {
            minimized = '1';
            implicants = [{ pattern: '-'.repeat(this.varsCount), term: '1', coveredOnes: [...ones], literals: 0 }];
        } else {
            const solution = this.minimizeSop(ones, vars);
            minimized = solution.expression;
            implicants = solution.implicants;
        }

        return {
            ones,
            dontCares,
            canonical,
            minimized,
            implicants
        };
    }

    buildCanonicalSop(ones, vars) {
        if (!ones.length) return '0';
        return ones.map((index) => this.mintermToTerm(index, vars.length, vars)).join(' OR ');
    }

    minimizeSop(ones, vars) {
        const candidates = this.buildCandidates(ones, vars.length);

        if (!candidates.length) {
            const fallbackTerms = ones.map((index) => {
                const pattern = this.indexToPattern(index, vars.length);
                return {
                    pattern,
                    term: this.patternToTerm(pattern, vars),
                    coveredOnes: [index],
                    literals: vars.length,
                    coverMask: 1 << ones.indexOf(index)
                };
            });

            return {
                expression: fallbackTerms.map((term) => term.term).join(' OR '),
                implicants: fallbackTerms
            };
        }

        const targetMask = (1 << ones.length) - 1;
        const bitToCandidates = Array.from({ length: ones.length }, () => []);

        candidates.forEach((candidate, idx) => {
            for (let bit = 0; bit < ones.length; bit += 1) {
                if ((candidate.coverMask >> bit) & 1) {
                    bitToCandidates[bit].push(idx);
                }
            }
        });

        bitToCandidates.forEach((arr) => {
            arr.sort((aIdx, bIdx) => {
                const a = candidates[aIdx];
                const b = candidates[bIdx];
                const coverDiff = this.popCount(b.coverMask) - this.popCount(a.coverMask);
                if (coverDiff !== 0) return coverDiff;
                if (a.literals !== b.literals) return a.literals - b.literals;
                return a.pattern.localeCompare(b.pattern);
            });
        });

        let best = null;

        const chooseFirstUnsetBit = (mask) => {
            for (let bit = 0; bit < ones.length; bit += 1) {
                if (((mask >> bit) & 1) === 0) return bit;
            }
            return -1;
        };

        const search = (mask, chosen, literalSum) => {
            if (mask === targetMask) {
                if (!best
                    || literalSum < best.literalSum
                    || (literalSum === best.literalSum && chosen.length < best.termCount)) {
                    best = {
                        literalSum,
                        termCount: chosen.length,
                        chosen: [...chosen]
                    };
                }
                return;
            }

            if (best) {
                if (literalSum > best.literalSum) return;
                if (literalSum === best.literalSum && chosen.length >= best.termCount) return;
            }

            const bit = chooseFirstUnsetBit(mask);
            if (bit < 0) return;

            const options = bitToCandidates[bit];
            for (let i = 0; i < options.length; i += 1) {
                const idx = options[i];
                const candidate = candidates[idx];
                const nextMask = mask | candidate.coverMask;
                if (nextMask === mask) continue;

                const nextLiteralSum = literalSum + candidate.literals;
                const nextTermCount = chosen.length + 1;

                if (best) {
                    if (nextLiteralSum > best.literalSum) continue;
                    if (nextLiteralSum === best.literalSum && nextTermCount >= best.termCount) continue;
                }

                chosen.push(idx);
                search(nextMask, chosen, nextLiteralSum);
                chosen.pop();
            }
        };

        search(0, [], 0);

        const selected = (best ? best.chosen : []).map((idx) => candidates[idx]);
        selected.sort((a, b) => {
            if (a.literals !== b.literals) return a.literals - b.literals;
            return a.pattern.localeCompare(b.pattern);
        });

        const expression = selected.length
            ? selected.map((item) => item.term).join(' OR ')
            : '0';

        return {
            expression,
            implicants: selected
        };
    }

    buildCandidates(ones, varCount) {
        const oneBitByIndex = new Map();
        ones.forEach((index, bit) => {
            oneBitByIndex.set(index, 1 << bit);
        });

        const patterns = [];
        const walk = (prefix, depth) => {
            if (depth === varCount) {
                patterns.push(prefix);
                return;
            }
            walk(`${prefix}0`, depth + 1);
            walk(`${prefix}1`, depth + 1);
            walk(`${prefix}-`, depth + 1);
        };
        walk('', 0);

        const candidates = [];
        const total = 2 ** varCount;

        patterns.forEach((pattern) => {
            let valid = true;
            let coverMask = 0;
            const coveredOnes = [];

            for (let index = 0; index < total; index += 1) {
                if (!this.patternCoversIndex(pattern, index, varCount)) continue;

                const value = this.values[index];
                if (value === 0) {
                    valid = false;
                    break;
                }

                if (value === 1) {
                    coverMask |= oneBitByIndex.get(index) || 0;
                    coveredOnes.push(index);
                }
            }

            if (!valid || coverMask === 0) return;

            candidates.push({
                pattern,
                coverMask,
                coveredOnes,
                literals: pattern.split('').filter((ch) => ch !== '-').length,
                term: this.patternToTerm(pattern, this.activeVarNames())
            });
        });

        return candidates.filter((candidate, idx) => {
            for (let j = 0; j < candidates.length; j += 1) {
                if (j === idx) continue;
                const other = candidates[j];
                const candidateSubset = (candidate.coverMask & other.coverMask) === candidate.coverMask;
                if (!candidateSubset) continue;

                const strictlyBetter = other.literals < candidate.literals
                    || (other.literals === candidate.literals && this.popCount(other.coverMask) > this.popCount(candidate.coverMask));

                if (strictlyBetter) {
                    return false;
                }
            }
            return true;
        });
    }

    patternCoversIndex(pattern, index, varCount) {
        const bits = this.indexToPattern(index, varCount);
        for (let i = 0; i < varCount; i += 1) {
            if (pattern[i] === '-') continue;
            if (pattern[i] !== bits[i]) return false;
        }
        return true;
    }

    indexToPattern(index, varCount) {
        let bits = index.toString(2);
        while (bits.length < varCount) bits = `0${bits}`;
        return bits;
    }

    patternToTerm(pattern, vars) {
        if (/^-+$/.test(pattern)) return '1';

        const literals = [];
        for (let i = 0; i < pattern.length; i += 1) {
            if (pattern[i] === '-') continue;
            if (pattern[i] === '1') literals.push(vars[i]);
            else literals.push(`NOT ${vars[i]}`);
        }

        if (!literals.length) return '1';
        return literals.join(' AND ');
    }

    mintermToTerm(index, varCount, vars) {
        const bits = this.indexToPattern(index, varCount);
        const literals = [];
        for (let i = 0; i < bits.length; i += 1) {
            literals.push(bits[i] === '1' ? vars[i] : `NOT ${vars[i]}`);
        }
        return literals.join(' AND ');
    }

    grayCodes(bits) {
        if (bits <= 0) return [''];
        if (bits === 1) return ['0', '1'];

        const prev = this.grayCodes(bits - 1);
        const left = prev.map((code) => `0${code}`);
        const right = [...prev].reverse().map((code) => `1${code}`);
        return left.concat(right);
    }

    selectedImplicantCoveredSet() {
        const implicants = this.analysis?.implicants || [];
        const selected = implicants[this.selectedImplicantIndex];
        if (!selected || !Array.isArray(selected.coveredOnes)) return new Set();
        return new Set(selected.coveredOnes);
    }

    renderMap() {
        const varNames = this.activeVarNames();
        const rowBits = Math.floor(this.varsCount / 2);
        const colBits = this.varsCount - rowBits;

        const rowCodes = this.grayCodes(rowBits);
        const colCodes = this.grayCodes(colBits);

        const rowLabel = rowBits ? varNames.slice(0, rowBits).join('') : ' '; 
        const colLabel = colBits ? varNames.slice(rowBits).join('') : ' '; 

        const coveredSet = new Set();
        (this.analysis?.implicants || []).forEach((item) => {
            (item.coveredOnes || []).forEach((idx) => coveredSet.add(idx));
        });
        const selectedCoveredSet = this.selectedImplicantCoveredSet();

        const headCells = colCodes.map((code) => `<th>${this.escapeHtml(code || '0')}</th>`).join('');

        const rowsHtml = rowCodes.map((rowCode) => {
            const cells = colCodes.map((colCode) => {
                const bits = `${rowCode}${colCode}`;
                const index = bits ? parseInt(bits, 2) : 0;
                const value = this.values[index];
                const valueLabel = value === 'X' ? 'X' : String(value);
                const valueClass = value === 'X' ? 'vx' : (value ? 'v1' : 'v0');
                const coveredClass = coveredSet.has(index) ? 'covered' : '';
                const selectedClass = selectedCoveredSet.has(index) ? 'focus-group' : '';
                return `<td class="boolean-kmap-cell ${valueClass} ${coveredClass} ${selectedClass}" data-index="${index}" tabindex="0" role="button" aria-label="Cellule m${index}, valeur ${valueLabel}" title="m${index} (${bits || '0'})">${valueLabel}</td>`;
            }).join('');

            return `<tr><th>${this.escapeHtml(rowCode || '0')}</th>${cells}</tr>`;
        }).join('');

        this.gridEl.innerHTML = `
            <table class="boolean-kmap-table">
                <thead>
                    <tr>
                        <th>${this.escapeHtml(`${rowLabel}\\${colLabel}`)}</th>
                        ${headCells}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }

    renderOutputs() {
        if (!this.analysis) return;

        const mintermsText = this.analysis.ones.length
            ? `m(${this.analysis.ones.join(', ')})`
            : 'Aucun minterm actif';

        const dontCareText = this.analysis.dontCares.length
            ? `d(${this.analysis.dontCares.join(', ')})`
            : 'Aucun';

        this.mintermsEl.textContent = mintermsText;
        this.dontCaresEl.textContent = dontCareText;
        this.canonicalEl.textContent = this.analysis.canonical;
        this.minimizedEl.textContent = this.analysis.minimized;

        if (!this.analysis.implicants.length) {
            this.implicantsEl.innerHTML = '<li>Aucun groupe.</li>';
            if (this.impSummaryEl) {
                this.impSummaryEl.textContent = 'Aucun groupe detecte: verifie les minterms actifs.';
            }
            return;
        }

        if (this.impSummaryEl) {
            const count = this.analysis.implicants.length;
            const selectedLabel = this.selectedImplicantIndex >= 0
                ? ` Groupe ${this.selectedImplicantIndex + 1} surligne dans la carte.`
                : '';
            this.impSummaryEl.textContent = `${count} groupe(s) propose(s). Clique un groupe pour le visualiser.${selectedLabel}`;
        }

        this.implicantsEl.innerHTML = this.analysis.implicants.map((item, index) => {
            const covered = (item.coveredOnes || []).length
                ? `m(${item.coveredOnes.join(', ')})`
                : 'aucun minterm 1';
            const active = this.selectedImplicantIndex === index ? 'active' : '';
            return `
                <li>
                    <button type="button" class="boolean-kmap-imp-btn ${active}" data-imp-index="${index}">
                        <strong>Groupe ${index + 1}</strong>: <code>${this.escapeHtml(item.pattern)}</code> => ${this.escapeHtml(item.term)} (couvre ${covered})
                    </button>
                </li>
            `;
        }).join('');
    }

    popCount(mask) {
        let n = mask >>> 0;
        let count = 0;
        while (n > 0) {
            count += n & 1;
            n >>>= 1;
        }
        return count;
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
    window.BooleanKarnaughWidget = BooleanKarnaughWidget;
}
