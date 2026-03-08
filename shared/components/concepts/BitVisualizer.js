/**
 * BitVisualizer - reusable helpers for binary/hex displays and bit grids.
 */
class BitVisualizer {
    constructor(bits = 8) {
        this.bits = bits;
        this.value = 0;
        this.bitBoxes = [];
        this.onValueChange = null;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    toBin(value, bits = this.bits) {
        return value.toString(2).padStart(bits, '0');
    }

    toHex(value, digits = 2) {
        return value.toString(16).toUpperCase().padStart(digits, '0');
    }

    setValue(value, source) {
        this.value = this.clamp(value, 0, (2 ** this.bits) - 1);
        this.renderInteractiveBits();
        if (typeof this.onValueChange === 'function') {
            this.onValueChange(this.value, source);
        }
    }

    mountInteractiveRow(rowId, options = {}) {
        const row = document.getElementById(rowId);
        if (!row) return;

        const showIndex = options.showIndex !== false;
        const showWeight = options.showWeight !== false;
        const enableToggle = options.enableToggle !== false;
        row.innerHTML = '';
        this.bitBoxes = [];

        for (let idx = 0; idx < this.bits; idx++) {
            const cell = document.createElement('div');
            cell.className = 'bit-cell';

            if (showIndex) {
                const index = document.createElement('span');
                index.className = 'bit-index';
                index.textContent = 'bit ' + (this.bits - 1 - idx);
                cell.appendChild(index);
            }

            const box = document.createElement('div');
            box.className = 'bit-box';
            box.textContent = '0';
            cell.appendChild(box);

            if (showWeight) {
                const weight = document.createElement('span');
                weight.className = 'bit-weight';
                weight.textContent = 2 ** (this.bits - 1 - idx);
                cell.appendChild(weight);
            }

            if (enableToggle) {
                cell.addEventListener('click', () => {
                    const bitPos = this.bits - 1 - idx;
                    this.value ^= (1 << bitPos);
                    this.renderInteractiveBits();
                    if (typeof this.onValueChange === 'function') {
                        this.onValueChange(this.value, 'bits');
                    }

                    box.classList.remove('pulse');
                    void box.offsetWidth;
                    box.classList.add('pulse');
                });
            }

            row.appendChild(cell);
            this.bitBoxes.push(box);
        }

        this.renderInteractiveBits();
    }

    renderInteractiveBits() {
        if (!this.bitBoxes || this.bitBoxes.length === 0) return;
        for (let i = 0; i < this.bits; i++) {
            const bitVal = (this.value >> (this.bits - 1 - i)) & 1;
            const box = this.bitBoxes[i];
            box.textContent = bitVal;
            box.classList.toggle('active', bitVal === 1);
        }
    }

    renderBitLine(labelsId, bitsId, binary, options = {}) {
        const labelsEl = document.getElementById(labelsId);
        const bitsEl = document.getElementById(bitsId);
        if (!labelsEl || !bitsEl) return;

        const bitCount = binary.length;
        const isNegative = !!options.isNegative;
        const segmentClassForIndex = options.segmentClassForIndex || null;

        labelsEl.innerHTML = '';
        bitsEl.innerHTML = '';

        for (let i = 0; i < bitCount; i++) {
            const lbl = document.createElement('span');
            lbl.className = options.labelClass || 'bit-label';
            lbl.textContent = bitCount - 1 - i;
            labelsEl.appendChild(lbl);

            const cell = document.createElement('span');
            cell.className = options.cellClass || 'bit-cell';

            if (segmentClassForIndex) {
                const extraClass = segmentClassForIndex(i, bitCount);
                if (extraClass) cell.classList.add(extraClass);
            }
            if (i === 0 && isNegative && options.negativeClass) {
                cell.classList.add(options.negativeClass);
            }

            cell.textContent = binary[i];
            bitsEl.appendChild(cell);
        }
    }

    buildPowersTable(tableId, ranges) {
        const table = document.getElementById(tableId);
        if (!table) return;

        table.innerHTML = '';
        ranges.forEach((range) => {
            const trExp = document.createElement('tr');
            const trVal = document.createElement('tr');

            const thExp = document.createElement('th');
            thExp.textContent = 'Exposant';
            trExp.appendChild(thExp);

            const thVal = document.createElement('th');
            thVal.textContent = 'Valeur';
            trVal.appendChild(thVal);

            for (let n = range[0]; n <= range[1]; n++) {
                const tdE = document.createElement('td');
                tdE.innerHTML = '2<sup>' + n + '</sup>';
                trExp.appendChild(tdE);

                const tdV = document.createElement('td');
                tdV.textContent = (2 ** n).toLocaleString('fr-FR');
                trVal.appendChild(tdV);
            }

            table.appendChild(trExp);
            table.appendChild(trVal);
        });
    }

    buildExtendedPowersTable(tbodySelector, from, to, sizes = {}) {
        const tbody = document.querySelector(tbodySelector);
        if (!tbody) return;
        tbody.innerHTML = '';

        for (let n = from; n <= to; n++) {
            const tr = document.createElement('tr');
            const val = BigInt(2) ** BigInt(n);
            tr.innerHTML = '<td>' + n + '</td><td>' + val.toLocaleString() + '</td><td>' + (sizes[n] || '') + '</td>';
            tbody.appendChild(tr);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BitVisualizer;
}

if (typeof window !== 'undefined') {
    window.BitVisualizer = BitVisualizer;
}
