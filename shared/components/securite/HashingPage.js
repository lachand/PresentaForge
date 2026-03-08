class HashingPage extends ConceptPage {
    async init() {
        await super.init();
    (() => {
        let computeAlgo = 'SHA-256';
        let avalancheAlgo = 'SHA-256';
        let integrityAlgo = 'SHA-256';

        const ALGO_BITS = { 'SHA-1': 160, 'SHA-256': 256, 'SHA-512': 512 };
        const ALGO_HEX = { 'SHA-1': 40, 'SHA-256': 64, 'SHA-512': 128 };

        // --- Utility ---
        async function computeHash(text, algo) {
            const encoder = new TextEncoder();
            const data = encoder.encode(text);
            const hashBuffer = await crypto.subtle.digest(algo, data);
            const hashArray = new Uint8Array(hashBuffer);
            return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        function hexToBin(hex) {
            return hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
        }

        function countBitDiffs(binA, binB) {
            let count = 0;
            const len = Math.max(binA.length, binB.length);
            for (let i = 0; i < len; i++) {
                if ((binA[i] || '0') !== (binB[i] || '0')) count++;
            }
            return count;
        }

        // --- Tabs ---
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
            });
        });

        // --- Algo selectors ---
        function setupAlgoSelector(containerId, callback) {
            const container = document.getElementById(containerId);
            container.querySelectorAll('.algo-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    container.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    callback(btn.dataset.algo);
                });
            });
        }

        // --- Compute Tab ---
        const computeInput = document.getElementById('compute-input');
        const computeOutput = document.getElementById('compute-output').querySelector('.hash-text');

        async function updateCompute() {
            const text = computeInput.value;
            const t0 = performance.now();
            const hash = await computeHash(text, computeAlgo);
            const t1 = performance.now();
            computeOutput.textContent = hash;
            document.getElementById('stat-algo').textContent = computeAlgo;
            document.getElementById('stat-bits').textContent = ALGO_BITS[computeAlgo];
            document.getElementById('stat-hex').textContent = ALGO_HEX[computeAlgo];
            document.getElementById('stat-time').textContent = (t1 - t0).toFixed(2);
        }

        computeInput.addEventListener('input', updateCompute);
        setupAlgoSelector('compute-algo', algo => { computeAlgo = algo; updateCompute(); });

        document.getElementById('compute-copy').addEventListener('click', () => {
            navigator.clipboard.writeText(computeOutput.textContent);
            const btn = document.getElementById('compute-copy');
            btn.textContent = 'Copié !';
            setTimeout(() => btn.textContent = 'Copier', 1500);
        });

        // --- Avalanche Tab ---
        const avaInputA = document.getElementById('ava-input-a');
        const avaInputB = document.getElementById('ava-input-b');
        const avaHashA = document.getElementById('ava-hash-a').querySelector('.hash-text');
        const avaHashB = document.getElementById('ava-hash-b').querySelector('.hash-text');

        async function updateAvalanche() {
            const hashA = await computeHash(avaInputA.value, avalancheAlgo);
            const hashB = await computeHash(avaInputB.value, avalancheAlgo);
            avaHashA.textContent = hashA;
            avaHashB.textContent = hashB;

            const binA = hexToBin(hashA);
            const binB = hexToBin(hashB);
            const totalBits = ALGO_BITS[avalancheAlgo];
            const diffBits = countBitDiffs(binA, binB);
            const pct = ((diffBits / totalBits) * 100).toFixed(1);

            document.getElementById('ava-diff-bits').textContent = diffBits;
            document.getElementById('ava-diff-pct').textContent = pct + '%';
            document.getElementById('ava-total-bits').textContent = totalBits;

            const fill = document.getElementById('ava-bar-fill');
            fill.style.width = pct + '%';
            fill.textContent = pct + '%';
            const pctNum = parseFloat(pct);
            if (pctNum < 30) fill.style.background = 'var(--accent)';
            else if (pctNum < 60) fill.style.background = 'var(--warning)';
            else fill.style.background = 'var(--danger)';

            // Hex diff display
            let html = '';
            for (let i = 0; i < hashA.length; i++) {
                if (hashA[i] === hashB[i]) {
                    html += `<span class="same">${hashA[i]}</span>`;
                } else {
                    html += `<span class="diff">${hashA[i]}</span>`;
                }
            }
            html += '<br>';
            for (let i = 0; i < hashB.length; i++) {
                if (hashA[i] === hashB[i]) {
                    html += `<span class="same">${hashB[i]}</span>`;
                } else {
                    html += `<span class="diff">${hashB[i]}</span>`;
                }
            }
            document.getElementById('ava-hex-diff').innerHTML = html;
        }

        avaInputA.addEventListener('input', updateAvalanche);
        avaInputB.addEventListener('input', updateAvalanche);
        setupAlgoSelector('avalanche-algo', algo => { avalancheAlgo = algo; updateAvalanche(); });

        // --- Integrity Tab ---
        const integOriginal = document.getElementById('integ-original');
        const integExpected = document.getElementById('integ-expected');
        const integVerify = document.getElementById('integ-verify');
        const integComputed = document.getElementById('integ-computed').querySelector('.hash-text');
        const integStatus = document.getElementById('integ-status');

        document.getElementById('integ-gen-btn').addEventListener('click', async () => {
            const hash = await computeHash(integOriginal.value, integrityAlgo);
            integExpected.value = hash;
            integVerify.value = integOriginal.value;
            updateIntegrity();
        });

        async function updateIntegrity() {
            const hash = await computeHash(integVerify.value, integrityAlgo);
            integComputed.textContent = hash;

            const expected = integExpected.value.trim().toLowerCase();
            if (!expected) {
                integStatus.className = 'integrity-status pending';
                integStatus.innerHTML = '<span class="integrity-icon">&#9203;</span><span>Entrez un hash attendu pour vérifier l\'intégrité.</span>';
                return;
            }

            if (hash === expected) {
                integStatus.className = 'integrity-status valid';
                integStatus.innerHTML = '<span class="integrity-icon">&#10004;</span><span>Intégrité vérifiée : le hash correspond.</span>';
            } else {
                integStatus.className = 'integrity-status invalid';
                integStatus.innerHTML = '<span class="integrity-icon">&#10008;</span><span>Intégrité compromise : le hash ne correspond pas !</span>';
            }
        }

        integOriginal.addEventListener('input', updateIntegrity);
        integVerify.addEventListener('input', updateIntegrity);
        integExpected.addEventListener('input', updateIntegrity);
        setupAlgoSelector('integrity-algo', algo => { integrityAlgo = algo; updateIntegrity(); });

        // --- Init ---
        updateCompute();
        updateAvalanche();
        updateIntegrity();
    })();
    }
}

if (typeof window !== 'undefined') {
    window.HashingPage = HashingPage;
}
