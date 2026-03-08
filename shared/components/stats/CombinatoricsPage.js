/**
 * CombinatoricsPage - Comptage: permutations, arrangements, combinaisons.
 */
class CombinatoricsPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.mode = 'arrangement';
        this.n = 6;
        this.k = 3;
        this.withRepetition = false;
        this.result = 0n;
        this.samples = [];
    }

    async init() {
        await super.init();
    }

    reset() {
        const cfg = this.data?.visualization?.config || {};
        this.mode = cfg.defaultMode || 'arrangement';
        this.n = Number.isFinite(cfg.defaultN) ? Math.max(1, Math.floor(cfg.defaultN)) : 6;
        this.k = Number.isFinite(cfg.defaultK) ? Math.max(1, Math.floor(cfg.defaultK)) : 3;
        this.withRepetition = cfg.defaultWithRepetition === true;
        this.syncControls();
        this.recalculate();
        this.clearHighlight();
        this.setStatus('Parametres reinitialises.', 'neutral');
    }

    syncControls() {
        const modeSelect = document.getElementById('comb-mode');
        const nInput = document.getElementById('comb-n');
        const kInput = document.getElementById('comb-k');
        const repInput = document.getElementById('comb-repeat');
        if (modeSelect) modeSelect.value = this.mode;
        if (nInput) nInput.value = String(this.n);
        if (kInput) kInput.value = String(this.k);
        if (repInput) repInput.checked = this.withRepetition;
        this.updateControlState();
    }

    updateControlState() {
        const kInput = document.getElementById('comb-k');
        const repInput = document.getElementById('comb-repeat');
        const kRow = document.getElementById('comb-k-row');
        const repRow = document.getElementById('comb-rep-row');
        const repControl = document.getElementById('comb-rep-control');
        if (this.mode === 'permutation') {
            if (kRow) kRow.style.display = 'none';
            if (kInput) kInput.style.display = 'none';
            if (repRow) repRow.style.display = 'none';
            if (repControl) repControl.style.display = 'none';
            if (kInput) kInput.disabled = true;
            if (repInput) repInput.disabled = true;
        } else {
            if (kRow) kRow.style.display = '';
            if (kInput) kInput.style.display = '';
            if (repRow) repRow.style.display = '';
            if (repControl) repControl.style.display = 'flex';
            if (kInput) kInput.disabled = false;
            if (repInput) repInput.disabled = false;
        }
    }

    setStatus(message, tone = 'neutral') {
        const el = document.getElementById('comb-feedback');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback ${tone}`;
    }

    formatBigInt(value) {
        const str = String(value || 0n);
        return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    factorial(n) {
        let out = 1n;
        for (let i = 2; i <= n; i += 1) out *= BigInt(i);
        return out;
    }

    permutationsCount(n, k) {
        if (k > n) return 0n;
        let out = 1n;
        for (let i = 0; i < k; i += 1) {
            out *= BigInt(n - i);
        }
        return out;
    }

    combinationsCount(n, k) {
        if (k < 0 || k > n) return 0n;
        const kk = Math.min(k, n - k);
        let num = 1n;
        let den = 1n;
        for (let i = 1; i <= kk; i += 1) {
            num *= BigInt(n - kk + i);
            den *= BigInt(i);
        }
        return den === 0n ? 0n : (num / den);
    }

    power(base, exp) {
        let out = 1n;
        for (let i = 0; i < exp; i += 1) out *= BigInt(base);
        return out;
    }

    parseControls() {
        const mode = document.getElementById('comb-mode')?.value || this.mode;
        const n = Number(document.getElementById('comb-n')?.value);
        const k = Number(document.getElementById('comb-k')?.value);
        const withRepetition = document.getElementById('comb-repeat')?.checked === true;

        this.mode = mode;
        this.n = Number.isFinite(n) ? Math.max(1, Math.min(26, Math.floor(n))) : this.n;
        this.k = Number.isFinite(k) ? Math.max(1, Math.min(10, Math.floor(k))) : this.k;
        this.withRepetition = withRepetition;

        if (this.mode === 'permutation') {
            this.k = this.n;
            this.withRepetition = false;
        } else if (!this.withRepetition && this.k > this.n) {
            this.k = this.n;
        }

        this.syncControls();
    }

    computeFormulaAndCount() {
        const n = this.n;
        const k = this.mode === 'permutation' ? this.n : this.k;
        const rep = this.withRepetition;

        if (this.mode === 'permutation') {
            return {
                label: `Permutations de ${n} elements`,
                formula: `${n}!`,
                factors: Array.from({ length: n }, (_, i) => String(n - i)),
                count: this.factorial(n)
            };
        }

        if (this.mode === 'arrangement') {
            if (rep) {
                return {
                    label: `Arrangements avec repetition A_rep(${n}, ${k})`,
                    formula: `${n}^${k}`,
                    factors: Array.from({ length: k }, () => String(n)),
                    count: this.power(n, k)
                };
            }
            return {
                label: `Arrangements sans repetition A(${n}, ${k})`,
                formula: `${n}! / (${n}-${k})!`,
                factors: Array.from({ length: k }, (_, i) => String(n - i)),
                count: this.permutationsCount(n, k)
            };
        }

        if (rep) {
            const top = n + k - 1;
            return {
                label: `Combinaisons avec repetition C(${n}+${k}-1, ${k})`,
                formula: `C(${top}, ${k})`,
                factors: [`${top}!`, `${k}!`, `${top - k}!`],
                count: this.combinationsCount(top, k)
            };
        }

        return {
            label: `Combinaisons sans repetition C(${n}, ${k})`,
            formula: `${n}! / (${k}!(${n}-${k})!)`,
            factors: [`${n}!`, `${k}!`, `${n - k}!`],
            count: this.combinationsCount(n, k)
        };
    }

    alphabetForN() {
        const letters = [];
        for (let i = 0; i < this.n; i += 1) {
            if (i < 26) letters.push(String.fromCharCode(65 + i));
            else letters.push(`X${i + 1}`);
        }
        return letters;
    }

    generateSamples(limit = 60) {
        const symbols = this.alphabetForN();
        const out = [];
        const maxLen = this.mode === 'permutation' ? this.n : this.k;

        const pushTuple = (arr) => {
            out.push('[' + arr.join(', ') + ']');
        };

        if (this.mode === 'combinaison') {
            const dfsComb = (start, depth, path) => {
                if (out.length >= limit) return;
                if (depth === maxLen) {
                    pushTuple(path.slice());
                    return;
                }
                for (let i = start; i < symbols.length; i += 1) {
                    path.push(symbols[i]);
                    dfsComb(this.withRepetition ? i : i + 1, depth + 1, path);
                    path.pop();
                    if (out.length >= limit) return;
                }
            };
            if ((this.withRepetition && maxLen >= 1) || (!this.withRepetition && maxLen <= symbols.length)) {
                dfsComb(0, 0, []);
            }
            return out;
        }

        const dfsSeq = (depth, path, used) => {
            if (out.length >= limit) return;
            if (depth === maxLen) {
                pushTuple(path.slice());
                return;
            }
            for (let i = 0; i < symbols.length; i += 1) {
                if (!this.withRepetition && used[i]) continue;
                path.push(symbols[i]);
                if (!this.withRepetition) used[i] = true;
                dfsSeq(depth + 1, path, used);
                if (!this.withRepetition) used[i] = false;
                path.pop();
                if (out.length >= limit) return;
            }
        };

        if ((this.withRepetition && maxLen >= 1) || (!this.withRepetition && maxLen <= symbols.length)) {
            dfsSeq(0, [], Array.from({ length: symbols.length }, () => false));
        }
        return out;
    }

    renderFactors(factors) {
        const host = document.getElementById('comb-factors');
        if (!host) return;
        host.innerHTML = factors.map((f) => `<span class="comb-chip">${this.escapeHtml(f)}</span>`).join('');
    }

    renderSamples() {
        const host = document.getElementById('comb-samples');
        if (!host) return;
        if (this.samples.length === 0) {
            host.innerHTML = '<span class="text-sm text-muted">Aucun exemple avec ces parametres.</span>';
            return;
        }
        host.innerHTML = this.samples.map((entry) => `<span class="comb-chip comb-chip-soft">${this.escapeHtml(entry)}</span>`).join('');
    }

    renderPascal() {
        const container = document.getElementById('comb-pascal');
        const card = document.getElementById('comb-pascal-card');
        if (!container || !card) return;

        if (this.mode !== 'combinaison') {
            card.style.display = 'none';
            return;
        }
        card.style.display = '';

        const targetN = this.withRepetition ? this.n + this.k - 1 : this.n;
        const targetK = this.k;
        const maxRow = Math.min(12, Math.max(targetN, 6));

        let html = '<table class="comb-pascal-table"><tbody>';
        for (let row = 0; row <= maxRow; row += 1) {
            html += '<tr>';
            for (let col = 0; col <= row; col += 1) {
                const value = this.combinationsCount(row, col);
                const highlight = row === targetN && col === targetK ? ' class="hit"' : '';
                html += `<td${highlight}>${this.formatBigInt(value)}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    async applyParameters() {
        this.parseControls();
        this.highlightLine('count-line0');
        await OEIUtils.sleep(70);
        this.highlightLine('count-line1');
        await OEIUtils.sleep(70);
        this.recalculate();
        this.highlightLine('count-line4');
        await OEIUtils.sleep(70);
        this.clearHighlight();
        this.setStatus('Comptage mis a jour.', 'success');
    }

    recalculate() {
        const summary = this.computeFormulaAndCount();
        this.result = summary.count;
        this.samples = this.generateSamples(60);

        this.updateInfo('comb-mode-label', summary.label);
        this.updateInfo('comb-formula', summary.formula);
        this.updateInfo('comb-result', this.formatBigInt(summary.count));
        this.updateInfo('comb-sample-count', String(this.samples.length));
        this.renderFactors(summary.factors);
        this.renderSamples();
        this.renderPascal();
    }

    render() {
        this.recalculate();
    }
}

if (typeof window !== 'undefined') {
    window.CombinatoricsPage = CombinatoricsPage;
}
