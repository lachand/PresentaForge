/**
 * EncryptionPage : César, Vigenère, XOR (octets UTF-8), réutilisation d'un flux et ECB contre CBC.
 * Tout le calcul est dans le moteur pur `algorithms/cipher-engine.js` (relecture 3b, B10, CH-I1) ;
 * ici, seulement l'affichage. Les chiffrements de flux et de blocs sont des jouets pédagogiques.
 */
class EncryptionPage extends ConceptPage {
    async init() {
        await super.init();
        this.mode = 'encrypt';
        this.activeTab = 'cesar';
        this.alpha = OEITrace.CIPHER_ALPHABET;
        this.$ = (id) => document.getElementById(id);
        this.bindTabs();
        this.bindInputs();
        this.drawWheel();
        this.buildTabulaRecta();
        this.update();
    }

    bindTabs() {
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTab = btn.dataset.tab;
                document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
                this.$('panel-' + this.activeTab).classList.add('active');
                document.querySelector('.mode-toggle').style.display = ['cesar', 'vigenere', 'xor'].includes(this.activeTab) ? '' : 'none';
                this.update();
            });
        });
        document.querySelectorAll('.mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                this.updateLabels();
                this.update();
            });
        });
    }

    bindInputs() {
        this.$('cesar-shift').addEventListener('input', () => { this.$('cesar-shift-val').textContent = this.$('cesar-shift').value; this.drawWheel(); this.update(); });
        this.$('cesar-plain').addEventListener('input', () => this.update());
        this.$('vigenere-key').addEventListener('input', () => this.update());
        this.$('vigenere-plain').addEventListener('input', () => this.update());
        this.$('xor-key').addEventListener('input', () => this.update());
        this.$('xor-plain').addEventListener('input', () => this.update());
        ['flux-p1', 'flux-p2', 'flux-key', 'flux-nonce1', 'flux-nonce2', 'flux-known'].forEach((id) => this.$(id).addEventListener('input', () => this.updateFlux()));
        this.$('flux-same').addEventListener('change', () => this.updateFlux());
        ['ecb-image', 'ecb-key'].forEach((id) => this.$(id).addEventListener('input', () => this.updateEcb()));
    }

    updateLabels() {
        const encrypt = this.mode === 'encrypt';
        document.querySelectorAll('#panel-cesar .io-row, #panel-vigenere .io-row, #panel-xor .io-row').forEach((row) => {
            const labels = row.querySelectorAll('label');
            if (labels.length >= 2) {
                const isXor = row.closest('#panel-xor');
                labels[0].textContent = encrypt ? 'Texte en clair' : (isXor ? 'Octets en hexadécimal' : 'Texte chiffré');
                labels[1].textContent = encrypt ? (isXor ? 'Résultat (hexadécimal)' : 'Texte chiffré') : (isXor ? 'Texte déchiffré' : 'Texte déchiffré');
            }
        });
    }

    update() {
        if (this.activeTab === 'cesar') this.updateCesar();
        else if (this.activeTab === 'vigenere') this.updateVigenere();
        else if (this.activeTab === 'xor') this.updateXor();
        else if (this.activeTab === 'flux') this.updateFlux();
        else if (this.activeTab === 'ecb') this.updateEcb();
    }

    // --- César ---
    drawWheel() {
        const svg = this.$('cesar-wheel');
        const shift = parseInt(this.$('cesar-shift').value, 10);
        const A = this.alpha;
        const cx = 140, cy = 140, rOuter = 120, rInner = 85;
        let html = `<circle cx="${cx}" cy="${cy}" r="${rOuter}" class="wheel-outer"/><circle cx="${cx}" cy="${cy}" r="${rInner}" class="wheel-inner"/>`;
        for (let i = 0; i < 26; i += 1) {
            const angle = (i * 360 / 26 - 90) * Math.PI / 180;
            html += `<text x="${cx + (rOuter - 15) * Math.cos(angle)}" y="${cy + (rOuter - 15) * Math.sin(angle)}" text-anchor="middle" dominant-baseline="central" class="wheel-letter-outer">${A[i]}</text>`;
            html += `<text x="${cx + (rInner - 15) * Math.cos(angle)}" y="${cy + (rInner - 15) * Math.sin(angle)}" text-anchor="middle" dominant-baseline="central" class="wheel-letter-inner">${A[(i + shift) % 26]}</text>`;
        }
        const a = -90 * Math.PI / 180;
        html += `<line x1="${cx + (rOuter - 28) * Math.cos(a)}" y1="${cy + (rOuter - 28) * Math.sin(a)}" x2="${cx + (rInner + 2) * Math.cos(a)}" y2="${cy + (rInner + 2) * Math.sin(a)}" stroke="var(--warning)" stroke-width="2" marker-end="url(#arrowhead)"/>`;
        html += '<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--warning)"/></marker></defs>';
        svg.innerHTML = html;
    }

    updateCesar() {
        const shift = parseInt(this.$('cesar-shift').value, 10);
        const input = this.$('cesar-plain').value;
        const decrypt = this.mode === 'decrypt';
        const output = OEITrace.caesarShift(input, shift, decrypt);
        this.$('cesar-cipher').value = output;
        this.buildTransformVis(this.$('cesar-transform'), OEITrace.cipherNormalize(input), output);
        const cipherText = decrypt ? input : output;
        this.buildFreqChart(this.$('cesar-freq'), cipherText);
        this.renderCesarAttack(cipherText);
    }

    renderCesarAttack(cipherText) {
        const list = this.$('cesar-attack-list');
        list.innerHTML = '';
        if (OEITrace.cipherLetterFreq(cipherText).total < 8) {
            const hint = document.createElement('div');
            hint.className = 'text-muted text-sm';
            hint.textContent = 'Écris au moins une phrase (une dizaine de lettres) pour que l\'attaque par fréquence ait un sens.';
            list.appendChild(hint);
            return;
        }
        OEITrace.caesarCandidates(cipherText).slice(0, 5).forEach((attempt, idx) => {
            const item = document.createElement('div');
            item.className = 'attack-item';
            const k = document.createElement('div');
            k.className = 'k';
            k.textContent = 'Clé ' + attempt.shift + (idx === 0 ? ' (la plus française)' : '');
            const p = document.createElement('div');
            p.className = 'p';
            p.textContent = attempt.plain;
            item.append(k, p);
            list.appendChild(item);
        });
    }

    // --- Vigenère ---
    updateVigenere() {
        const key = OEITrace.vigenereKey(this.$('vigenere-key').value);
        const input = this.$('vigenere-plain').value;
        const decrypt = this.mode === 'decrypt';
        const output = OEITrace.vigenereProcess(input, key, decrypt);
        this.$('vigenere-cipher').value = output;
        this.buildTransformVis(this.$('vigenere-transform'), OEITrace.cipherNormalize(input), output);
        this.buildFreqChart(this.$('vigenere-freq'), decrypt ? input : output);
        const first = OEITrace.cipherNormalize(input).split('').find((c) => this.alpha.includes(c));
        this.highlightTabula(first || null, key[0] || null);
    }

    buildTabulaRecta() {
        const A = this.alpha;
        let html = '<thead><tr><th></th>' + A.split('').map((l) => `<th>${l}</th>`).join('') + '</tr></thead><tbody>';
        for (let r = 0; r < 26; r += 1) {
            html += `<tr><th>${A[r]}</th>`;
            for (let c = 0; c < 26; c += 1) html += `<td data-row="${r}" data-col="${c}">${A[(r + c) % 26]}</td>`;
            html += '</tr>';
        }
        this.$('tabula-recta').innerHTML = html + '</tbody>';
    }

    highlightTabula(plainChar, keyChar) {
        const cells = document.querySelectorAll('.tabula-recta td');
        cells.forEach((td) => td.classList.remove('highlight-row', 'highlight-col', 'highlight-cell'));
        if (!plainChar || !keyChar) return;
        const row = this.alpha.indexOf(keyChar);
        const col = this.alpha.indexOf(plainChar);
        if (row === -1 || col === -1) return;
        cells.forEach((td) => {
            const r = parseInt(td.dataset.row, 10);
            const c = parseInt(td.dataset.col, 10);
            if (r === row) td.classList.add('highlight-row');
            if (c === col) td.classList.add('highlight-col');
            if (r === row && c === col) td.classList.add('highlight-cell');
        });
    }

    // --- XOR sur octets UTF-8 ---
    updateXor() {
        const key = this.$('xor-key').value;
        const input = this.$('xor-plain').value;
        const out = this.$('xor-cipher');
        const vis = this.$('xor-vis');
        vis.innerHTML = '';
        const note = (text) => { const s = document.createElement('span'); s.style.color = 'var(--muted)'; s.textContent = text; vis.appendChild(s); };
        if (this.mode === 'encrypt') {
            const r = OEITrace.xorEncrypt(input, key);
            if (!r.ok) { out.value = ''; note('Écris du texte et une clé.'); return; }
            out.value = input ? r.hex : '';
            this.buildXorVis(Array.from(new TextEncoder().encode(input)), Array.from(new TextEncoder().encode(key)), r.bytes);
        } else {
            const r = OEITrace.xorDecryptHex(input, key);
            if (!r.ok) { out.value = ''; note(r.error); return; }
            out.value = r.text;
            const bytes = OEITrace.xorParseHex(input).bytes;
            const k = Array.from(new TextEncoder().encode(key));
            this.buildXorVis(bytes, k, Array.from(new TextEncoder().encode(r.text)));
        }
    }

    buildXorVis(inBytes, keyBytes, resultBytes) {
        const vis = this.$('xor-vis');
        const bits = (v) => v.toString(2).padStart(8, '0');
        const hex = (v) => '0x' + v.toString(16).toUpperCase().padStart(2, '0');
        const show = Math.min(inBytes.length, 12);
        for (let i = 0; i < show; i += 1) {
            const kb = keyBytes[i % keyBytes.length];
            const block = document.createElement('div');
            block.style.marginBottom = '0.75rem';
            const title = document.createElement('div');
            title.style.cssText = 'font-size:0.75rem;color:var(--muted);margin-bottom:4px';
            title.textContent = 'Octet ' + (i + 1) + ' : ' + hex(inBytes[i]) + ' XOR ' + hex(kb);
            block.appendChild(title);
            [['Entrée', inBytes[i], null], ['Clé', kb, null], ['Résultat', resultBytes[i], [inBytes[i], kb]]].forEach(([label, value, ops]) => {
                const row = document.createElement('div');
                row.className = 'xor-row';
                const lbl = document.createElement('span');
                lbl.className = 'label';
                lbl.textContent = label;
                row.appendChild(lbl);
                const b = bits(value);
                for (let j = 0; j < 8; j += 1) {
                    const bit = document.createElement('span');
                    const diff = ops && bits(ops[0])[j] !== bits(ops[1])[j];
                    bit.className = 'xor-bit ' + (b[j] === '1' ? 'one' : 'zero') + (diff ? ' diff' : '');
                    bit.textContent = b[j];
                    row.appendChild(bit);
                }
                const h = document.createElement('span');
                h.style.cssText = 'margin-left:8px;font-size:0.8rem';
                h.textContent = hex(value);
                row.appendChild(h);
                block.appendChild(row);
            });
            vis.appendChild(block);
        }
        if (inBytes.length > show) {
            const more = document.createElement('span');
            more.style.color = 'var(--muted)';
            more.textContent = '... et ' + (inBytes.length - show) + ' octets de plus';
            vis.appendChild(more);
        }
    }

    // --- Réutilisation d'un flux ---
    updateFlux() {
        const same = this.$('flux-same').checked;
        const n1 = this.$('flux-nonce1').value;
        const n2Field = this.$('flux-nonce2');
        n2Field.disabled = same;
        if (same) n2Field.value = n1;
        else if (n2Field.value === n1) n2Field.value = n1 + '-bis';
        const r = OEITrace.streamReuseDemo(this.$('flux-p1').value, this.$('flux-p2').value, this.$('flux-key').value, n1, n2Field.value);
        const set = (id, bytes) => { this.$(id).textContent = OEITrace.cipherToHex(bytes); };
        set('flux-c1', r.c1);
        set('flux-c2', r.c2);
        set('flux-xc', r.xorCipher);
        set('flux-xp', r.xorPlain);
        const verdict = this.$('flux-verdict');
        verdict.textContent = r.sameNonce
            ? 'Même clé et même nonce : le XOR des deux chiffrés est égal au XOR des deux clairs. La clé a disparu du calcul : l\'attaquant n\'en a plus besoin.'
            : 'Nonces différents : le XOR des deux chiffrés ne vaut plus le XOR des clairs, il ne révèle rien d\'exploitable.';
        verdict.className = 'flux-verdict ' + (r.sameNonce ? 'bad' : 'ok');
        const known = this.$('flux-known').value;
        const recovered = r.sameNonce && known ? OEITrace.streamRecoverSecond(r.xorCipher, known) : '';
        this.$('flux-recovered').textContent = r.sameNonce
            ? (known ? 'L\'attaquant connaît le début du message 1 (« ' + known + ' ») : il lit le début du message 2 : « ' + recovered + ' ».' : 'Écris le début du message 1 que connaît l\'attaquant pour voir ce qu\'il en déduit du message 2.')
            : 'Avec des nonces différents, connaître le début du message 1 ne donne rien sur le message 2.';
    }

    // --- ECB contre CBC ---
    updateEcb() {
        const rows = OEITrace.cipherImageRows(OEITrace.CIPHER_IMAGES[this.$('ecb-image').value]);
        const key = this.$('ecb-key').value || 'clé';
        const ecb = OEITrace.ecbEncryptRows(rows, key);
        const cbc = OEITrace.cbcEncryptRows(rows, key, 'iv');
        this.drawGrid(this.$('ecb-clear'), rows);
        this.drawGrid(this.$('ecb-ecb'), ecb);
        this.drawGrid(this.$('ecb-cbc'), cbc);
        const rep = (r) => OEITrace.cipherRepeatedRows(r);
        this.$('ecb-stats').textContent = 'Blocs (lignes) répétés : ' + rep(rows) + ' dans le clair, ' + rep(ecb) + ' en ECB, ' + rep(cbc) + ' en CBC. Allonger la clé ne change rien au motif en ECB : deux blocs clairs égaux donnent deux blocs chiffrés égaux.';
    }

    drawGrid(container, rows) {
        container.innerHTML = '';
        rows.forEach((row) => {
            const line = document.createElement('div');
            line.className = 'ecb-row';
            row.forEach((v) => {
                const cell = document.createElement('span');
                cell.className = 'ecb-cell';
                cell.style.background = 'color-mix(in srgb, var(--ink) ' + Math.round((255 - v) / 255 * 100) + '%, var(--surface))';
                cell.title = String(v);
                line.appendChild(cell);
            });
            container.appendChild(line);
        });
    }

    // --- Visualisations lettres ---
    buildTransformVis(container, input, output) {
        container.innerHTML = '';
        input.split('').forEach((ch, i) => {
            const isSpace = ch === ' ';
            const pair = document.createElement('div');
            pair.className = 'letter-pair' + (isSpace ? ' space' : '');
            pair.style.animationDelay = (i * 20) + 'ms';
            const src = document.createElement('span');
            src.className = 'src';
            src.textContent = isSpace ? ' ' : ch;
            const arrow = document.createElement('span');
            arrow.className = 'arrow';
            arrow.textContent = '↓';
            const dst = document.createElement('span');
            dst.className = 'dst';
            dst.textContent = isSpace ? ' ' : (output[i] || '?');
            pair.append(src, arrow, dst);
            container.appendChild(pair);
        });
    }

    buildFreqChart(container, text) {
        const { freq } = OEITrace.cipherLetterFreq(text);
        const expected = OEITrace.CIPHER_FRENCH_FREQ;
        const maxVal = Math.max(...Object.values(freq), ...Object.values(expected));
        container.innerHTML = '';
        this.alpha.split('').forEach((letter) => {
            const group = document.createElement('div');
            group.className = 'freq-bar-group';
            const bars = document.createElement('div');
            bars.className = 'freq-bars';
            const actual = document.createElement('div');
            actual.className = 'freq-bar actual';
            actual.style.height = (maxVal > 0 ? freq[letter] / maxVal * 140 : 0) + 'px';
            actual.title = letter + ' : ' + freq[letter].toFixed(1) + ' %';
            const exp = document.createElement('div');
            exp.className = 'freq-bar expected';
            exp.style.height = (expected[letter] / maxVal * 140) + 'px';
            exp.title = letter + ' (français) : ' + expected[letter].toFixed(1) + ' %';
            bars.append(actual, exp);
            const lbl = document.createElement('span');
            lbl.className = 'freq-label';
            lbl.textContent = letter;
            group.append(bars, lbl);
            container.appendChild(group);
        });
    }
}

if (typeof window !== 'undefined') {
    window.EncryptionPage = EncryptionPage;
}
