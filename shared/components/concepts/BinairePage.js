class BinairePage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.bitViz = new BitVisualizer(8);
        this.currentOp = null;
    }

    async init() {
        await super.init();

        this.decInput = document.getElementById('decInput');
        this.binInput = document.getElementById('binInput');
        this.hexInput = document.getElementById('hexInput');
        this.bitsDecimalEl = document.getElementById('bitsDecimal');
        this.converterFeedback = document.getElementById('converterFeedback');

        this.opA = document.getElementById('opA');
        this.opB = document.getElementById('opB');
        this.opBinaryRepr = document.getElementById('opBinaryRepr');
        this.bitwiseVisual = document.getElementById('bitwiseVisual');

        this.bitViz.onValueChange = (value, source) => this.syncAll(value, source);
        this.bitViz.mountInteractiveRow('bitsRow', {
            showIndex: true,
            showWeight: true,
            enableToggle: true
        });

        this.bindConverterEvents();
        this.bindBitwiseEvents();

        this.bitViz.buildPowersTable('powersTable', [[0, 7], [8, 15]]);
        this.bitViz.setValue(0, 'dec');
        this.updateOpRepr();
    }

    setFeedback(message, type) {
        if (!this.converterFeedback) return;
        this.converterFeedback.textContent = message;
        this.converterFeedback.className = 'feedback text-center mt-1' + (type ? ' ' + type : '');
    }

    syncAll(value, source) {
        const bin = this.bitViz.toBin(value, 8);
        const hex = this.bitViz.toHex(value, 2);

        if (source !== 'dec' && this.decInput) this.decInput.value = value;
        if (source !== 'bin' && this.binInput) this.binInput.value = bin;
        if (source !== 'hex' && this.hexInput) this.hexInput.value = hex;

        if (this.bitsDecimalEl) this.bitsDecimalEl.textContent = value;
        this.setFeedback('', '');
    }

    bindConverterEvents() {
        this.decInput.addEventListener('input', () => {
            const raw = parseInt(this.decInput.value, 10);
            if (isNaN(raw)) {
                this.setFeedback('Entrez un nombre valide.', 'error');
                return;
            }
            if (raw < 0 || raw > 255) {
                this.setFeedback('La valeur doit être entre 0 et 255.', 'error');
                return;
            }
            this.bitViz.setValue(raw, 'dec');
        });

        this.binInput.addEventListener('input', () => {
            const value = this.binInput.value;
            if (!/^[01]*$/.test(value)) {
                this.setFeedback('Seuls les caractères 0 et 1 sont autorisés.', 'error');
                return;
            }
            if (value.length > 8) {
                this.setFeedback('8 bits maximum.', 'error');
                return;
            }
            const number = value.length > 0 ? parseInt(value, 2) : 0;
            this.bitViz.setValue(number, 'bin');
        });

        this.hexInput.addEventListener('input', () => {
            const value = this.hexInput.value.toUpperCase();
            this.hexInput.value = value;
            if (!/^[0-9A-F]*$/.test(value)) {
                this.setFeedback('Seuls les caractères 0-9 et A-F sont autorisés.', 'error');
                return;
            }
            if (value.length > 2) {
                this.setFeedback('2 caractères hexadécimaux maximum.', 'error');
                return;
            }
            const number = value.length > 0 ? parseInt(value, 16) : 0;
            this.bitViz.setValue(this.bitViz.clamp(number, 0, 255), 'hex');
        });
    }

    bindBitwiseEvents() {
        this.opA.addEventListener('input', () => this.updateOpRepr());
        this.opB.addEventListener('input', () => this.updateOpRepr());

        document.querySelectorAll('.bitwise-buttons .btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.currentOp = btn.getAttribute('data-op');

                document.querySelectorAll('.bitwise-buttons .btn').forEach((b) => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');

                this.renderBitwiseResult();
            });
        });
    }

    updateOpRepr() {
        const a = this.bitViz.clamp(parseInt(this.opA.value, 10) || 0, 0, 255);
        const b = this.bitViz.clamp(parseInt(this.opB.value, 10) || 0, 0, 255);
        this.opBinaryRepr.innerHTML = 'A = ' + this.bitViz.toBin(a, 8) + ' &nbsp;&nbsp; B = ' + this.bitViz.toBin(b, 8);

        if (this.currentOp) {
            this.renderBitwiseResult();
        }
    }

    renderBitwiseResult() {
        if (!this.currentOp) return;

        const a = this.bitViz.clamp(parseInt(this.opA.value, 10) || 0, 0, 255);
        const b = this.bitViz.clamp(parseInt(this.opB.value, 10) || 0, 0, 255);

        let result = 0;
        let opSymbol = '';

        switch (this.currentOp) {
            case 'and':
                result = a & b;
                opSymbol = 'AND';
                break;
            case 'or':
                result = a | b;
                opSymbol = 'OR';
                break;
            case 'xor':
                result = a ^ b;
                opSymbol = 'XOR';
                break;
            case 'not':
                result = (~a) & 0xFF;
                opSymbol = 'NOT A';
                break;
            default:
                return;
        }

        const bitsA = this.bitViz.toBin(a, 8);
        const bitsB = this.bitViz.toBin(b, 8);
        const bitsR = this.bitViz.toBin(result, 8);

        let html = '';
        html += '<div class="op-row"><span class="op-label">A</span>';
        for (let i = 0; i < 8; i++) html += '<span class="op-bit">' + bitsA[i] + '</span>';
        html += '</div>';

        if (this.currentOp !== 'not') {
            html += '<div class="op-row"><span class="op-label">B</span>';
            for (let i = 0; i < 8; i++) html += '<span class="op-bit">' + bitsB[i] + '</span>';
            html += '</div>';
        }

        html += '<div class="op-row" style="font-weight:700; color:var(--muted); font-size:0.85rem;">';
        html += '<span class="op-label">' + opSymbol + '</span><span style="width:' + (8 * 36 + 7 * 3.5) + 'px"></span></div>';

        html += '<div class="op-row op-equals"><span class="op-label">Résultat</span>';
        for (let i = 0; i < 8; i++) {
            const cls = this.currentOp === 'not'
                ? (bitsA[i] !== bitsR[i] ? 'differ' : 'match')
                : (bitsA[i] === bitsB[i] ? 'match' : 'differ');
            html += '<span class="op-bit ' + cls + '">' + bitsR[i] + '</span>';
        }
        html += '</div>';

        html += '<div class="bitwise-result-text">Résultat : <strong>' + bitsR + '</strong> = <strong>' + result + '</strong> en décimal</div>';
        this.bitwiseVisual.innerHTML = html;
    }
}

if (typeof window !== 'undefined') {
    window.BinairePage = BinairePage;
}
