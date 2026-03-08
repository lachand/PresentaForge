class RepresentationPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.bitViz = new BitVisualizer(8);
        this.c2Bits = 8;
        this.c2Direction = 'dec2bin';
        this.baseUpdating = false;
    }

    async init() {
        await super.init();

        this.bindTabs();
        this.initComplementTab();
        this.initIeeeTab();
        this.initBaseTab();
        this.initPowersTab();
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById('tab-' + btn.dataset.tab);
                if (panel) panel.classList.add('active');
            });
        });
    }

    initComplementTab() {
        document.querySelectorAll('.size-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.c2Bits = parseInt(btn.dataset.bits, 10);
                this.updateC2Range();
                if (this.c2Direction === 'dec2bin') this.convertC2Dec2Bin();
                else this.convertC2Bin2Dec();
            });
        });

        const dirDec = document.getElementById('c2-dir-dec');
        const dirBin = document.getElementById('c2-dir-bin');
        dirDec.addEventListener('click', () => {
            this.c2Direction = 'dec2bin';
            dirDec.className = 'btn btn-primary';
            dirBin.className = 'btn btn-secondary';
            document.getElementById('c2-dec-input').style.display = '';
            document.getElementById('c2-bin-input').style.display = 'none';
            this.convertC2Dec2Bin();
        });

        dirBin.addEventListener('click', () => {
            this.c2Direction = 'bin2dec';
            dirBin.className = 'btn btn-primary';
            dirDec.className = 'btn btn-secondary';
            document.getElementById('c2-dec-input').style.display = 'none';
            document.getElementById('c2-bin-input').style.display = '';
            this.convertC2Bin2Dec();
        });

        document.getElementById('c2-decimal').addEventListener('input', () => {
            if (this.c2Direction === 'dec2bin') this.convertC2Dec2Bin();
        });

        document.getElementById('c2-binary-in').addEventListener('input', () => {
            if (this.c2Direction === 'bin2dec') this.convertC2Bin2Dec();
        });

        this.updateC2Range();
        this.convertC2Dec2Bin();
    }

    updateC2Range() {
        const min = -(2 ** (this.c2Bits - 1));
        const max = (2 ** (this.c2Bits - 1)) - 1;
        document.getElementById('c2-range').innerHTML = 'Plage : <strong>' + min + '</strong> à <strong>' + max + '</strong> (' + this.c2Bits + ' bits)';
    }

    decToTwosComplement(num, bits) {
        const min = -(2 ** (bits - 1));
        const max = (2 ** (bits - 1)) - 1;
        if (num < min || num > max) return null;

        if (num >= 0) return num.toString(2).padStart(bits, '0');

        const pos = Math.abs(num).toString(2).padStart(bits, '0');
        const inverted = pos.split('').map((b) => (b === '0' ? '1' : '0')).join('');
        let carry = 1;
        const result = inverted.split('');

        for (let i = result.length - 1; i >= 0 && carry; i--) {
            const sum = parseInt(result[i], 10) + carry;
            result[i] = (sum % 2).toString();
            carry = Math.floor(sum / 2);
        }

        return result.join('');
    }

    twosComplementToDec(bin, bits) {
        if (bin.length !== bits) return null;
        if (bin[0] === '0') return parseInt(bin, 2);

        const inverted = bin.split('').map((b) => (b === '0' ? '1' : '0')).join('');
        const val = parseInt(inverted, 2) + 1;
        return -val;
    }

    convertC2Dec2Bin() {
        const input = document.getElementById('c2-decimal').value.trim();
        const fb = document.getElementById('c2-feedback');
        const stepsEl = document.getElementById('c2-steps');
        const resultEl = document.getElementById('c2-result');

        const num = parseInt(input, 10);
        if (isNaN(num)) {
            fb.className = 'feedback error';
            fb.textContent = 'Veuillez entrer un nombre entier valide.';
            document.getElementById('c2-bits').innerHTML = '';
            document.getElementById('c2-bit-labels').innerHTML = '';
            stepsEl.textContent = '';
            resultEl.textContent = '';
            return;
        }

        const min = -(2 ** (this.c2Bits - 1));
        const max = (2 ** (this.c2Bits - 1)) - 1;
        if (num < min || num > max) {
            fb.className = 'feedback error';
            fb.textContent = 'Hors plage ! Le nombre doit être entre ' + min + ' et ' + max + ' pour ' + this.c2Bits + ' bits.';
            return;
        }

        fb.className = 'feedback success';
        fb.textContent = '';

        const binary = this.decToTwosComplement(num, this.c2Bits);
        this.bitViz.renderBitLine('c2-bit-labels', 'c2-bits', binary, {
            labelClass: 'bit-label',
            cellClass: 'bit-cell',
            negativeClass: 'negative',
            isNegative: num < 0
        });

        resultEl.innerHTML = 'Binaire (complément à 2) : <span style="font-family:var(--font-mono); color:var(--primary);">' + binary + '</span>';

        let steps = '';
        if (num >= 0) {
            steps += '<span class="step-comment">// Nombre positif : conversion directe</span>\n';
            steps += num + ' en binaire = ' + num.toString(2) + '\n';
            steps += 'Complété à ' + this.c2Bits + ' bits : ' + binary + '\n';
            steps += '<span class="step-comment">// Bit de signe = 0 (positif)</span>';
        } else {
            const absVal = Math.abs(num);
            const posBin = absVal.toString(2).padStart(this.c2Bits, '0');
            const inverted = posBin.split('').map((b) => (b === '0' ? '1' : '0')).join('');
            steps += '<span class="step-comment">// Nombre négatif : méthode du complément à 2</span>\n\n';
            steps += '<span class="step-highlight">Étape 1</span> : Valeur absolue |' + num + '| = ' + absVal + '\n';
            steps += absVal + ' en binaire (' + this.c2Bits + ' bits) : ' + posBin + '\n\n';
            steps += '<span class="step-highlight">Étape 2</span> : Inverser tous les bits (complément à 1)\n';
            steps += posBin + '\n' + inverted + '  (bits inversés)\n\n';
            steps += '<span class="step-highlight">Étape 3</span> : Ajouter 1\n';
            steps += '  ' + inverted + '\n';
            steps += '+ ' + '0'.repeat(this.c2Bits - 1) + '1\n';
            steps += '= ' + binary + '\n\n';
            steps += '<span class="step-comment">// Bit de signe = 1 (négatif)</span>';
        }
        stepsEl.innerHTML = steps;
    }

    convertC2Bin2Dec() {
        const input = document.getElementById('c2-binary-in').value.trim();
        const fb = document.getElementById('c2-feedback');
        const stepsEl = document.getElementById('c2-steps');
        const resultEl = document.getElementById('c2-result');

        if (!/^[01]+$/.test(input)) {
            fb.className = 'feedback error';
            fb.textContent = 'Veuillez entrer uniquement des 0 et des 1.';
            stepsEl.textContent = '';
            resultEl.textContent = '';
            document.getElementById('c2-bits').innerHTML = '';
            document.getElementById('c2-bit-labels').innerHTML = '';
            return;
        }

        let bin = input;
        if (bin.length < this.c2Bits) bin = bin.padStart(this.c2Bits, '0');
        if (bin.length > this.c2Bits) bin = bin.slice(bin.length - this.c2Bits);

        fb.className = 'feedback success';
        fb.textContent = '';

        const isNeg = bin[0] === '1';
        const dec = this.twosComplementToDec(bin, this.c2Bits);

        this.bitViz.renderBitLine('c2-bit-labels', 'c2-bits', bin, {
            labelClass: 'bit-label',
            cellClass: 'bit-cell',
            negativeClass: 'negative',
            isNegative: isNeg
        });

        resultEl.innerHTML = 'Valeur décimale : <span style="font-family:var(--font-mono); color:var(--primary);">' + dec + '</span>';

        let steps = '';
        if (!isNeg) {
            steps += '<span class="step-comment">// Bit de signe = 0 : nombre positif</span>\n\n';
            steps += 'Conversion binaire directe :\n';
            const parts = [];
            for (let i = 0; i < bin.length; i++) {
                if (bin[i] === '1') {
                    parts.push(bin[i] + ' × 2^' + (bin.length - 1 - i) + ' = ' + (2 ** (bin.length - 1 - i)));
                }
            }
            steps += parts.join('\n') + '\n\n';
            steps += 'Somme = <span class="step-highlight">' + dec + '</span>';
        } else {
            const inverted = bin.split('').map((b) => (b === '0' ? '1' : '0')).join('');
            const posVal = parseInt(inverted, 2) + 1;
            steps += '<span class="step-comment">// Bit de signe = 1 : nombre négatif</span>\n\n';
            steps += '<span class="step-highlight">Étape 1</span> : Inverser tous les bits\n';
            steps += bin + '  →  ' + inverted + '\n\n';
            steps += '<span class="step-highlight">Étape 2</span> : Ajouter 1\n';
            steps += inverted + ' + 1 = ' + posVal.toString(2).padStart(this.c2Bits, '0') + '\n\n';
            steps += '<span class="step-highlight">Étape 3</span> : Appliquer le signe négatif\n';
            steps += 'Magnitude = ' + posVal + ', donc valeur = <span class="step-highlight">-' + posVal + '</span>';
        }

        stepsEl.innerHTML = steps;
    }

    initIeeeTab() {
        document.getElementById('ieee-decimal').addEventListener('input', () => this.convertIEEE());

        document.querySelectorAll('.special-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('ieee-decimal').value = btn.dataset.val;
                this.convertIEEE();
            });
        });

        this.convertIEEE();
    }

    floatToBits(value) {
        const buf = new ArrayBuffer(4);
        new Float32Array(buf)[0] = value;
        const intVal = new Uint32Array(buf)[0];
        return intVal.toString(2).padStart(32, '0');
    }

    convertIEEE() {
        const input = document.getElementById('ieee-decimal').value.trim();
        const fb = document.getElementById('ieee-feedback');
        const stepsEl = document.getElementById('ieee-steps');
        const bitsEl = document.getElementById('ieee-bits');
        const labelsEl = document.getElementById('ieee-bit-labels');
        const hexEl = document.getElementById('ieee-hex');

        let num;
        if (input.toLowerCase() === 'nan') num = NaN;
        else if (input === '+Infinity' || input === 'Infinity' || input === 'inf') num = Infinity;
        else if (input === '-Infinity' || input === '-inf') num = -Infinity;
        else num = parseFloat(input);

        if (input === '' || (isNaN(num) && input.toLowerCase() !== 'nan')) {
            fb.className = 'feedback error';
            fb.textContent = 'Veuillez entrer un nombre valide.';
            bitsEl.innerHTML = '';
            labelsEl.innerHTML = '';
            stepsEl.textContent = '';
            hexEl.textContent = '';
            return;
        }

        fb.className = 'feedback';
        fb.textContent = '';

        const bits = this.floatToBits(num);
        const sign = bits[0];
        const exponent = bits.substring(1, 9);
        const mantissa = bits.substring(9, 32);
        const expVal = parseInt(exponent, 2);
        const bias = 127;

        this.bitViz.renderBitLine('ieee-bit-labels', 'ieee-bits', bits, {
            labelClass: 'bit-label',
            cellClass: 'bit-cell',
            segmentClassForIndex: (index) => {
                if (index === 0) return 'sign';
                if (index < 9) return 'exponent';
                return 'mantissa';
            }
        });

        const hexVal = parseInt(bits, 2).toString(16).toUpperCase().padStart(8, '0');
        hexEl.textContent = 'Hexadécimal : 0x' + hexVal;

        let steps = '';
        steps += 'Valeur : ' + (Object.is(num, -0) ? '-0' : num) + '\n\n';
        steps += '<span class="step-highlight">Signe</span> (bit 31) : ' + sign + ' → ' + (sign === '0' ? 'positif (+)' : 'négatif (-)') + '\n';
        steps += '<span class="step-highlight">Exposant</span> (bits 30-23) : ' + exponent + ' = ' + expVal + '\n';

        if (expVal === 0 && mantissa === '0'.repeat(23)) {
            steps += '<span class="step-highlight">Mantisse</span> (bits 22-0) : ' + mantissa + '\n\n';
            steps += '<span class="step-comment">// Exposant = 0 et mantisse = 0 → ' + (sign === '0' ? '+0' : '-0') + '</span>';
            fb.className = 'feedback info';
            fb.textContent = sign === '0' ? 'Valeur spéciale : +0' : 'Valeur spéciale : -0';
        } else if (expVal === 0) {
            const mantVal = parseInt(mantissa, 2) / (2 ** 23);
            const realExp = 1 - bias;
            steps += '<span class="step-comment">// Exposant = 0 → nombre dénormalisé</span>\n';
            steps += 'Exposant réel = 1 - ' + bias + ' = ' + realExp + '\n';
            steps += '<span class="step-highlight">Mantisse</span> : 0.' + mantissa + '\n';
            steps += 'Fraction = ' + mantVal + '\n\n';
            steps += 'Valeur = (-1)^' + sign + ' × ' + mantVal + ' × 2^(' + realExp + ')\n';
            steps += '       = ' + num;
            fb.className = 'feedback info';
            fb.textContent = 'Nombre dénormalisé (exposant = 0)';
        } else if (expVal === 255 && mantissa === '0'.repeat(23)) {
            steps += '<span class="step-highlight">Mantisse</span> (bits 22-0) : ' + mantissa + '\n\n';
            steps += '<span class="step-comment">// Exposant = 255 et mantisse = 0 → ' + (sign === '0' ? '+∞' : '-∞') + '</span>';
            fb.className = 'feedback info';
            fb.textContent = sign === '0' ? 'Valeur spéciale : +∞ (infini positif)' : 'Valeur spéciale : -∞ (infini négatif)';
        } else if (expVal === 255) {
            steps += '<span class="step-highlight">Mantisse</span> (bits 22-0) : ' + mantissa + '\n\n';
            steps += '<span class="step-comment">// Exposant = 255 et mantisse ≠ 0 → NaN (Not a Number)</span>';
            fb.className = 'feedback info';
            fb.textContent = 'Valeur spéciale : NaN (Not a Number)';
        } else {
            const realExp = expVal - bias;
            const mantBits = '1.' + mantissa;
            let mantVal = 1;
            for (let i = 0; i < 23; i++) {
                if (mantissa[i] === '1') mantVal += 2 ** -(i + 1);
            }

            steps += 'Exposant biaisé = ' + expVal + ', biais = ' + bias + '\n';
            steps += 'Exposant réel = ' + expVal + ' - ' + bias + ' = <span class="step-highlight">' + realExp + '</span>\n\n';
            steps += '<span class="step-highlight">Mantisse</span> (bits 22-0) : ' + mantissa + '\n';
            steps += 'Mantisse avec bit implicite = ' + mantBits + '\n';
            steps += 'Valeur mantisse = ' + mantVal + '\n\n';
            steps += '<span class="step-highlight">Calcul final :</span>\n';
            steps += '(-1)^' + sign + ' × ' + mantVal + ' × 2^(' + realExp + ')\n';
            steps += '= ' + (sign === '1' ? '-' : '') + mantVal + ' × ' + (2 ** realExp) + '\n';
            steps += '= ' + num;
        }

        stepsEl.innerHTML = steps;
    }

    initBaseTab() {
        document.getElementById('base-dec').addEventListener('input', () => this.updateFromDec());
        document.getElementById('base-bin').addEventListener('input', () => this.updateFromBase('base-bin', 2));
        document.getElementById('base-oct').addEventListener('input', () => this.updateFromBase('base-oct', 8));
        document.getElementById('base-hex').addEventListener('input', () => this.updateFromBase('base-hex', 16));

        this.updateFromDec();
    }

    decToBase(decStr, base) {
        const num = parseFloat(decStr);
        if (isNaN(num)) return '';

        const intPart = Math.trunc(num);
        const fracPart = Math.abs(num - intPart);
        const sign = num < 0 ? '-' : '';

        const intResult = Math.abs(intPart).toString(base).toUpperCase();
        let fracResult = '';

        if (fracPart > 1e-10) {
            fracResult = '.';
            let frac = fracPart;
            for (let i = 0; i < 20 && frac > 1e-10; i++) {
                frac *= base;
                const digit = Math.floor(frac);
                fracResult += digit.toString(base).toUpperCase();
                frac -= digit;
            }
        }

        return sign + intResult + fracResult;
    }

    baseToDec(str, base) {
        let value = str.trim().toUpperCase();
        const negative = value.startsWith('-');
        if (negative) value = value.substring(1);

        const parts = value.split('.');
        const intPart = parseInt(parts[0] || '0', base);
        if (isNaN(intPart)) return NaN;

        let fracPart = 0;
        if (parts[1]) {
            for (let i = 0; i < parts[1].length; i++) {
                const d = parseInt(parts[1][i], base);
                if (isNaN(d)) return NaN;
                fracPart += d * Math.pow(base, -(i + 1));
            }
        }

        const result = intPart + fracPart;
        return negative ? -result : result;
    }

    buildDivisionSteps(decVal) {
        let steps = '';
        const num = parseFloat(decVal);
        if (isNaN(num)) return '';

        const intPart = Math.abs(Math.trunc(num));
        const fracPart = Math.abs(num - Math.trunc(num));
        const sign = num < 0 ? '-' : '';

        if (intPart > 0 || fracPart < 1e-10) {
            steps += '<span class="step-highlight">Partie entière : ' + sign + intPart + ' → binaire</span>\n';
            steps += 'Méthode des divisions successives par 2 :\n\n';
            let val = intPart;
            const rows = [];
            if (val === 0) {
                rows.push({ q: 0, r: 0 });
            } else {
                while (val > 0) {
                    rows.push({ q: Math.floor(val / 2), r: val % 2, v: val });
                    val = Math.floor(val / 2);
                }
            }
            rows.forEach((row) => {
                if (row.v !== undefined) {
                    steps += '  ' + row.v + ' ÷ 2 = ' + row.q + '  reste <span class="step-highlight">' + row.r + '</span>\n';
                }
            });
            const binInt = rows.map((r) => r.r).reverse().join('');
            steps += '\nLecture des restes de bas en haut : <span class="step-highlight">' + sign + binInt + '</span>\n';
        }

        if (fracPart > 1e-10) {
            steps += '\n<span class="step-highlight">Partie fractionnaire : ' + fracPart.toFixed(10).replace(/0+$/, '') + ' → binaire</span>\n';
            steps += 'Méthode des multiplications successives par 2 :\n\n';
            let frac = fracPart;
            const fracBits = [];
            for (let i = 0; i < 20 && frac > 1e-10; i++) {
                frac *= 2;
                const bit = Math.floor(frac);
                fracBits.push(bit);
                steps += '  ' + (frac / 2).toFixed(6) + ' × 2 = ' + frac.toFixed(6) + ' → partie entière = <span class="step-highlight">' + bit + '</span>\n';
                frac -= bit;
            }
            steps += '\nPartie fractionnaire binaire : .' + fracBits.join('') + '\n';
        }

        return steps;
    }

    updateFromDec() {
        if (this.baseUpdating) return;
        this.baseUpdating = true;

        const val = document.getElementById('base-dec').value.trim();
        const fb = document.getElementById('base-feedback');
        const stepsEl = document.getElementById('base-steps');

        const num = parseFloat(val);
        if (val === '' || isNaN(num)) {
            fb.className = 'feedback error';
            fb.textContent = val === '' ? '' : 'Nombre décimal invalide.';
            document.getElementById('base-bin').value = '';
            document.getElementById('base-oct').value = '';
            document.getElementById('base-hex').value = '';
            stepsEl.innerHTML = '';
            this.baseUpdating = false;
            return;
        }

        fb.className = 'feedback';
        fb.textContent = '';

        document.getElementById('base-bin').value = this.decToBase(val, 2);
        document.getElementById('base-oct').value = this.decToBase(val, 8);
        document.getElementById('base-hex').value = this.decToBase(val, 16);
        stepsEl.innerHTML = this.buildDivisionSteps(val);

        this.baseUpdating = false;
    }

    updateFromBase(inputId, base) {
        if (this.baseUpdating) return;
        this.baseUpdating = true;

        const val = document.getElementById(inputId).value.trim();
        const fb = document.getElementById('base-feedback');
        const stepsEl = document.getElementById('base-steps');

        if (val === '') {
            document.getElementById('base-dec').value = '';
            document.getElementById('base-bin').value = '';
            document.getElementById('base-oct').value = '';
            document.getElementById('base-hex').value = '';
            stepsEl.innerHTML = '';
            fb.textContent = '';
            this.baseUpdating = false;
            return;
        }

        const dec = this.baseToDec(val, base);
        if (isNaN(dec)) {
            fb.className = 'feedback error';
            fb.textContent = 'Valeur invalide pour la base ' + base + '.';
            this.baseUpdating = false;
            return;
        }

        fb.className = 'feedback';
        fb.textContent = '';

        const hasFrac = val.includes('.');
        const decStr = hasFrac ? dec.toString() : Math.trunc(dec).toString();

        document.getElementById('base-dec').value = decStr;
        if (inputId !== 'base-bin') document.getElementById('base-bin').value = this.decToBase(decStr, 2);
        if (inputId !== 'base-oct') document.getElementById('base-oct').value = this.decToBase(decStr, 8);
        if (inputId !== 'base-hex') document.getElementById('base-hex').value = this.decToBase(decStr, 16);

        stepsEl.innerHTML = this.buildDivisionSteps(decStr);
        this.baseUpdating = false;
    }

    initPowersTab() {
        const sizes = {
            8: '256 valeurs (1 octet)',
            10: '1 Kio',
            16: '64 Kio (2 octets)',
            20: '1 Mio',
            24: '16 Mio',
            30: '1 Gio',
            32: '4 Gio (espace adressage 32 bits)',
            40: '1 Tio',
            50: '1 Pio',
            60: '1 Eio',
            64: '16 Eio (espace adressage 64 bits)'
        };

        this.bitViz.buildExtendedPowersTable('#powers-table tbody', 0, 64, sizes);
    }
}

if (typeof window !== 'undefined') {
    window.RepresentationPage = RepresentationPage;
}
