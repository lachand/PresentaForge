class EncryptionPage extends ConceptPage {
    async init() {
        await super.init();
    (() => {
        const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const FRENCH_FREQ = {
            A:8.15, B:0.97, C:3.15, D:3.73, E:17.39, F:1.12, G:0.97, H:0.85,
            I:7.31, J:0.45, K:0.02, L:5.69, M:2.87, N:7.12, O:5.28, P:2.80,
            Q:1.21, R:6.64, S:8.14, T:7.22, U:6.38, V:1.64, W:0.03, X:0.41,
            Y:0.28, Z:0.15
        };
        let mode = 'encrypt';
        let activeTab = 'cesar';

        // --- Tab / Mode switching ---
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('panel-' + activeTab).classList.add('active');
                update();
            });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                mode = btn.dataset.mode;
                updateLabels();
                update();
            });
        });

        function updateLabels() {
            const encrypt = mode === 'encrypt';
            document.querySelectorAll('.io-row').forEach(row => {
                const labels = row.querySelectorAll('label');
                if (labels.length >= 2) {
                    labels[0].textContent = encrypt ? 'Texte en clair' : 'Texte chiffré';
                    labels[1].textContent = encrypt ? 'Texte chiffré' : 'Texte déchiffré';
                }
            });
        }

        // --- César ---
        const cesarShift = document.getElementById('cesar-shift');
        const cesarShiftVal = document.getElementById('cesar-shift-val');
        const cesarPlain = document.getElementById('cesar-plain');
        const cesarCipher = document.getElementById('cesar-cipher');

        cesarShift.addEventListener('input', () => { cesarShiftVal.textContent = cesarShift.value; drawWheel(); update(); });
        cesarPlain.addEventListener('input', update);

        function cesarEncrypt(text, shift) {
            return text.split('').map(c => {
                const idx = ALPHA.indexOf(c.toUpperCase());
                if (idx === -1) return c;
                return ALPHA[(idx + shift) % 26];
            }).join('');
        }

        function cesarDecrypt(text, shift) {
            return cesarEncrypt(text, 26 - shift);
        }

        function drawWheel() {
            const svg = document.getElementById('cesar-wheel');
            const shift = parseInt(cesarShift.value);
            const cx = 140, cy = 140, rOuter = 120, rInner = 85;
            let html = `<circle cx="${cx}" cy="${cy}" r="${rOuter}" class="wheel-outer"/>`;
            html += `<circle cx="${cx}" cy="${cy}" r="${rInner}" class="wheel-inner"/>`;

            for (let i = 0; i < 26; i++) {
                const angle = (i * 360 / 26 - 90) * Math.PI / 180;
                const xo = cx + (rOuter - 15) * Math.cos(angle);
                const yo = cy + (rOuter - 15) * Math.sin(angle);
                html += `<text x="${xo}" y="${yo}" text-anchor="middle" dominant-baseline="central" class="wheel-letter-outer">${ALPHA[i]}</text>`;

                const xi = cx + (rInner - 15) * Math.cos(angle);
                const yi = cy + (rInner - 15) * Math.sin(angle);
                html += `<text x="${xi}" y="${yi}" text-anchor="middle" dominant-baseline="central" class="wheel-letter-inner">${ALPHA[(i + shift) % 26]}</text>`;
            }

            // Arrow connecting outer A to inner shifted A
            const arrowAngle = (-90) * Math.PI / 180;
            const ax1 = cx + (rOuter - 28) * Math.cos(arrowAngle);
            const ay1 = cy + (rOuter - 28) * Math.sin(arrowAngle);
            const ax2 = cx + (rInner + 2) * Math.cos(arrowAngle);
            const ay2 = cy + (rInner + 2) * Math.sin(arrowAngle);
            html += `<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="var(--warning)" stroke-width="2" marker-end="url(#arrowhead)"/>`;
            html += `<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--warning)"/></marker></defs>`;

            svg.innerHTML = html;
        }

        // --- Vigenère ---
        const vigenereKey = document.getElementById('vigenere-key');
        const vigenerePlain = document.getElementById('vigenere-plain');
        const vigenereCipher = document.getElementById('vigenere-cipher');

        vigenereKey.addEventListener('input', () => { vigenereKey.value = vigenereKey.value.toUpperCase().replace(/[^A-Z]/g, ''); update(); });
        vigenerePlain.addEventListener('input', update);

        function vigenereProcess(text, key, decrypt) {
            if (!key) return text;
            let ki = 0;
            return text.split('').map(c => {
                const idx = ALPHA.indexOf(c.toUpperCase());
                if (idx === -1) return c;
                const shift = ALPHA.indexOf(key[ki % key.length]);
                ki++;
                if (decrypt) return ALPHA[(idx - shift + 26) % 26];
                return ALPHA[(idx + shift) % 26];
            }).join('');
        }

        function buildTabulaRecta() {
            const table = document.getElementById('tabula-recta');
            let html = '<thead><tr><th></th>';
            for (let i = 0; i < 26; i++) html += `<th>${ALPHA[i]}</th>`;
            html += '</tr></thead><tbody>';
            for (let r = 0; r < 26; r++) {
                html += `<tr><th>${ALPHA[r]}</th>`;
                for (let c = 0; c < 26; c++) {
                    html += `<td data-row="${r}" data-col="${c}">${ALPHA[(r + c) % 26]}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
            table.innerHTML = html;
        }

        function highlightTabula(plainChar, keyChar) {
            document.querySelectorAll('.tabula-recta td').forEach(td => {
                td.classList.remove('highlight-row', 'highlight-col', 'highlight-cell');
            });
            if (!plainChar || !keyChar) return;
            const row = ALPHA.indexOf(keyChar);
            const col = ALPHA.indexOf(plainChar);
            if (row === -1 || col === -1) return;
            document.querySelectorAll('.tabula-recta td').forEach(td => {
                const r = parseInt(td.dataset.row);
                const c = parseInt(td.dataset.col);
                if (r === row) td.classList.add('highlight-row');
                if (c === col) td.classList.add('highlight-col');
                if (r === row && c === col) td.classList.add('highlight-cell');
            });
        }

        // --- XOR ---
        const xorKey = document.getElementById('xor-key');
        const xorPlain = document.getElementById('xor-plain');
        const xorCipher = document.getElementById('xor-cipher');

        xorKey.addEventListener('input', update);
        xorPlain.addEventListener('input', update);

        function xorProcess(text, key) {
            const result = [];
            for (let i = 0; i < text.length; i++) {
                const tc = text.charCodeAt(i);
                const kc = key.charCodeAt(i % key.length);
                result.push(tc ^ kc);
            }
            return result;
        }

        function buildXorVis(text, key) {
            const vis = document.getElementById('xor-vis');
            if (!key || !text) { vis.innerHTML = '<span style="color:var(--muted)">Entrez du texte et une clé</span>'; return; }
            let html = '';
            const maxShow = Math.min(text.length, 12);
            for (let i = 0; i < maxShow; i++) {
                const tc = text.charCodeAt(i);
                const kc = key.charCodeAt(i % key.length);
                const rc = tc ^ kc;
                const tbits = tc.toString(2).padStart(8, '0');
                const kbits = kc.toString(2).padStart(8, '0');
                const rbits = rc.toString(2).padStart(8, '0');

                html += `<div style="margin-bottom:0.75rem">`;
                html += `<div style="font-size:0.75rem;color:var(--muted);margin-bottom:4px">Caractère ${i + 1}: '${text[i]}' XOR '${key[i % key.length]}'</div>`;
                html += buildBitRow('Texte', tbits, null);
                html += buildBitRow('Clé', kbits, null);
                html += `<div class="xor-row"><span class="label" style="border-top:1px solid var(--muted);padding-top:2px">Résultat</span>`;
                for (let b = 0; b < 8; b++) {
                    const isDiff = tbits[b] !== kbits[b];
                    html += `<span class="xor-bit ${rbits[b] === '1' ? 'one' : 'zero'} ${isDiff ? 'diff' : ''}">${rbits[b]}</span>`;
                }
                html += `<span style="margin-left:8px;font-size:0.8rem">= 0x${rc.toString(16).toUpperCase().padStart(2, '0')}</span></div>`;
                html += `</div>`;
            }
            if (text.length > maxShow) html += `<span style="color:var(--muted)">... et ${text.length - maxShow} caractères de plus</span>`;
            vis.innerHTML = html;
        }

        function buildBitRow(label, bits, _) {
            let html = `<div class="xor-row"><span class="label">${label}</span>`;
            for (let b = 0; b < 8; b++) {
                html += `<span class="xor-bit ${bits[b] === '1' ? 'one' : 'zero'}">${bits[b]}</span>`;
            }
            html += `</div>`;
            return html;
        }

        // --- Transform visualization ---
        function buildTransformVis(container, input, output) {
            let html = '';
            for (let i = 0; i < input.length; i++) {
                const isSpace = input[i] === ' ';
                html += `<div class="letter-pair ${isSpace ? 'space' : ''}" style="animation-delay:${i * 20}ms">`;
                html += `<span class="src">${isSpace ? '&nbsp;' : input[i].toUpperCase()}</span>`;
                html += `<span class="arrow">&#x2193;</span>`;
                html += `<span class="dst">${isSpace ? '&nbsp;' : (output[i] || '?').toUpperCase()}</span>`;
                html += `</div>`;
            }
            container.innerHTML = html;
        }

        // --- Frequency analysis ---
        function computeFreq(text) {
            const counts = {};
            let total = 0;
            for (const c of text.toUpperCase()) {
                if (ALPHA.includes(c)) {
                    counts[c] = (counts[c] || 0) + 1;
                    total++;
                }
            }
            const freq = {};
            for (const c of ALPHA) freq[c] = total > 0 ? ((counts[c] || 0) / total) * 100 : 0;
            return freq;
        }

        function frenchScore(text) {
            const freq = computeFreq(text);
            let score = 0;
            for (const letter of ALPHA) {
                const expected = FRENCH_FREQ[letter] || 0.0001;
                const observed = freq[letter] || 0;
                const delta = observed - expected;
                score += (delta * delta) / expected;
            }
            return score;
        }

        function renderCesarAttack(cipherText) {
            const list = document.getElementById('cesar-attack-list');
            if (!list) return;

            const letterCount = cipherText.split('').filter(c => ALPHA.includes(c.toUpperCase())).length;
            if (letterCount < 3) {
                list.innerHTML = '<div class="text-muted text-sm">Entrez au moins quelques lettres pour tester les clés.</div>';
                return;
            }

            const attempts = [];
            for (let shift = 1; shift < 26; shift++) {
                const plain = cesarDecrypt(cipherText, shift);
                attempts.push({
                    shift: shift,
                    plain: plain,
                    score: frenchScore(plain)
                });
            }
            attempts.sort((a, b) => a.score - b.score);
            const top = attempts.slice(0, 5);

            list.innerHTML = top.map((attempt, idx) => `
                <div class="attack-item">
                    <div class="k">Clé ${attempt.shift}${idx === 0 ? ' (top)' : ''}</div>
                    <div class="p">${attempt.plain.replace(/</g, '&lt;')}</div>
                </div>
            `).join('');
        }

        function buildFreqChart(container, cipherText) {
            const freq = computeFreq(cipherText);
            const maxVal = Math.max(...Object.values(freq), ...Object.values(FRENCH_FREQ));
            let html = '';
            for (const letter of ALPHA) {
                const hActual = maxVal > 0 ? (freq[letter] / maxVal) * 140 : 0;
                const hExpected = maxVal > 0 ? (FRENCH_FREQ[letter] / maxVal) * 140 : 0;
                html += `<div class="freq-bar-group">`;
                html += `<div class="freq-bars">`;
                html += `<div class="freq-bar actual" style="height:${hActual}px" title="${letter}: ${freq[letter].toFixed(1)}%"></div>`;
                html += `<div class="freq-bar expected" style="height:${hExpected}px" title="${letter} (FR): ${FRENCH_FREQ[letter].toFixed(1)}%"></div>`;
                html += `</div>`;
                html += `<span class="freq-label">${letter}</span>`;
                html += `</div>`;
            }
            container.innerHTML = html;
        }

        // --- Main update ---
        function update() {
            if (activeTab === 'cesar') updateCesar();
            else if (activeTab === 'vigenere') updateVigenere();
            else if (activeTab === 'xor') updateXor();
        }

        function updateCesar() {
            const shift = parseInt(cesarShift.value);
            const input = cesarPlain.value;
            const output = mode === 'encrypt' ? cesarEncrypt(input, shift) : cesarDecrypt(input, shift);
            cesarCipher.value = output;
            buildTransformVis(document.getElementById('cesar-transform'), input, output);
            buildFreqChart(document.getElementById('cesar-freq'), mode === 'encrypt' ? output : input);
            renderCesarAttack(mode === 'encrypt' ? output : input);
        }

        function updateVigenere() {
            const key = vigenereKey.value.toUpperCase();
            const input = vigenerePlain.value;
            const decrypt = mode === 'decrypt';
            const output = vigenereProcess(input, key, decrypt);
            vigenereCipher.value = output;
            buildTransformVis(document.getElementById('vigenere-transform'), input, output);
            buildFreqChart(document.getElementById('vigenere-freq'), mode === 'encrypt' ? output : input);

            // Highlight tabula for first letter
            if (input.length > 0 && key.length > 0) {
                const firstLetter = input.toUpperCase().split('').find(c => ALPHA.includes(c));
                if (firstLetter) {
                    highlightTabula(firstLetter, key[0]);
                } else {
                    highlightTabula(null, null);
                }
            }
        }

        function updateXor() {
            const key = xorKey.value;
            const input = xorPlain.value;
            if (!key || !input) { xorCipher.value = ''; return; }

            if (mode === 'encrypt') {
                const result = xorProcess(input, key);
                xorCipher.value = result.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                buildXorVis(input, key);
                // For freq, count byte values mapped to A-Z range
                const mapped = result.map(b => String.fromCharCode(b)).join('');
                buildFreqChart(document.getElementById('xor-freq'), mapped);
            } else {
                // Decrypt: user enters hex in plain field
                const hexStr = input.replace(/\s/g, '');
                const bytes = [];
                for (let i = 0; i < hexStr.length; i += 2) {
                    bytes.push(parseInt(hexStr.substr(i, 2), 16));
                }
                const result = bytes.map((b, i) => String.fromCharCode(b ^ key.charCodeAt(i % key.length))).join('');
                xorCipher.value = result;
                buildXorVis(result, key);
                buildFreqChart(document.getElementById('xor-freq'), input);
            }
        }

        // --- Init ---
        drawWheel();
        buildTabulaRecta();
        update();
    })();
    }
}

if (typeof window !== 'undefined') {
    window.EncryptionPage = EncryptionPage;
}
