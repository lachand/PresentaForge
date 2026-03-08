class NormalizationPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
    (() => {
        'use strict';

        // ── Parse helpers ──
        function parseAttrs(str) {
            return str.split(',').map(s => s.trim()).filter(Boolean);
        }

        function parseFDs(str) {
            const fds = [];
            const lines = str.replace(/;/g, '\n').split('\n');
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                const parts = line.split(/\s*(?:->|→)\s*/);
                if (parts.length !== 2) continue;
                const lhs = parseAttrs(parts[0]);
                const rhs = parseAttrs(parts[1]);
                if (lhs.length && rhs.length) fds.push({ lhs, rhs });
            }
            return fds;
        }

        function setStr(s) { return '{' + [...s].sort().join(', ') + '}'; }
        function arrStr(a) { return a.sort().join(', '); }
        function fdStr(fd) { return arrStr(fd.lhs) + ' → ' + arrStr(fd.rhs); }

        // ── Closure computation ──
        function closure(attrs, fds) {
            const result = new Set(attrs);
            let changed = true;
            const steps = [{ step: 'Init', added: [...attrs], result: new Set(result) }];
            while (changed) {
                changed = false;
                for (const fd of fds) {
                    if (fd.lhs.every(a => result.has(a))) {
                        const newAttrs = fd.rhs.filter(a => !result.has(a));
                        if (newAttrs.length) {
                            newAttrs.forEach(a => result.add(a));
                            steps.push({ step: fdStr(fd), added: newAttrs, result: new Set(result) });
                            changed = true;
                        }
                    }
                }
            }
            return { closure: result, steps };
        }

        // ── Candidate keys ──
        function findCandidateKeys(allAttrs, fds) {
            // Attributes that never appear on RHS are always part of every key
            const allRHS = new Set();
            const allLHS = new Set();
            for (const fd of fds) {
                fd.rhs.forEach(a => allRHS.add(a));
                fd.lhs.forEach(a => allLHS.add(a));
            }
            const mustBeInKey = allAttrs.filter(a => !allRHS.has(a));
            const neverInKey = allAttrs.filter(a => !allLHS.has(a) && allRHS.has(a));
            const middle = allAttrs.filter(a => !mustBeInKey.includes(a) && !neverInKey.includes(a));

            const keys = [];
            // Try all subsets of middle combined with mustBeInKey
            const n = middle.length;
            for (let mask = 0; mask < (1 << n); mask++) {
                const candidate = [...mustBeInKey];
                for (let i = 0; i < n; i++) {
                    if (mask & (1 << i)) candidate.push(middle[i]);
                }
                const cl = closure(candidate, fds);
                if (allAttrs.every(a => cl.closure.has(a))) {
                    // Check minimality: no proper subset is a key
                    let isMinimal = true;
                    for (const existing of keys) {
                        if (existing.every(a => candidate.includes(a))) {
                            isMinimal = false; break;
                        }
                    }
                    if (isMinimal) {
                        // Remove existing keys that are supersets
                        for (let i = keys.length - 1; i >= 0; i--) {
                            if (candidate.every(a => keys[i].includes(a))) keys.splice(i, 1);
                        }
                        keys.push(candidate);
                    }
                }
            }
            return keys;
        }

        // ── Normal form check ──
        function isSuperkey(attrs, allAttrs, fds) {
            const cl = closure(attrs, fds);
            return allAttrs.every(a => cl.closure.has(a));
        }

        function checkNormalForm(allAttrs, fds, candidateKeys) {
            const primeAttrs = new Set();
            for (const key of candidateKeys) key.forEach(a => primeAttrs.add(a));

            const violations = { '2NF': [], '3NF': [], 'BCNF': [] };

            for (const fd of fds) {
                // Skip trivial FDs
                if (fd.rhs.every(a => fd.lhs.includes(a))) continue;

                const isSuper = isSuperkey(fd.lhs, allAttrs, fds);

                if (!isSuper) {
                    // BCNF violation
                    violations['BCNF'].push(fd);

                    // Check 3NF: every RHS attr must be prime
                    const nonPrimeRHS = fd.rhs.filter(a => !primeAttrs.has(a) && !fd.lhs.includes(a));
                    if (nonPrimeRHS.length > 0) {
                        violations['3NF'].push({ fd, nonPrimeRHS });

                        // Check 2NF: is LHS a proper subset of a candidate key?
                        for (const key of candidateKeys) {
                            if (fd.lhs.length < key.length &&
                                fd.lhs.every(a => key.includes(a))) {
                                violations['2NF'].push({ fd, key, nonPrimeRHS });
                                break;
                            }
                        }
                    }
                }
            }

            if (violations['BCNF'].length === 0) return { form: 'BCNF', violations };
            if (violations['3NF'].length === 0) return { form: '3NF', violations };
            if (violations['2NF'].length === 0) return { form: '2NF', violations };
            return { form: '1NF', violations };
        }

        // ── BCNF decomposition ──
        function decomposeBCNF(allAttrs, fds) {
            const relations = [{ attrs: [...allAttrs], fds: [...fds] }];
            const result = [];
            let safetyCounter = 0;

            while (relations.length > 0 && safetyCounter < 100) {
                safetyCounter++;
                const rel = relations.pop();

                // Project FDs onto this relation's attributes
                const projectedFDs = projectFDs(rel.attrs, fds);

                // Find a BCNF violation
                let violation = null;
                for (const fd of projectedFDs) {
                    if (fd.rhs.every(a => fd.lhs.includes(a))) continue;
                    if (!isSuperkey(fd.lhs, rel.attrs, projectedFDs)) {
                        violation = fd;
                        break;
                    }
                }

                if (!violation) {
                    const keys = findCandidateKeys(rel.attrs, projectedFDs);
                    result.push({ attrs: rel.attrs, fds: projectedFDs, keys });
                } else {
                    // Decompose: R1 = lhs ∪ rhs, R2 = R - rhs + lhs
                    const cl = closure(violation.lhs, projectedFDs);
                    const r1Attrs = [...cl.closure].filter(a => rel.attrs.includes(a));
                    const r2Attrs = [...new Set([...rel.attrs.filter(a => !cl.closure.has(a) || violation.lhs.includes(a))])];

                    if (r1Attrs.length > 0 && r1Attrs.length < rel.attrs.length) {
                        relations.push({ attrs: r1Attrs, fds: projectFDs(r1Attrs, fds) });
                    }
                    if (r2Attrs.length > 0 && r2Attrs.length < rel.attrs.length) {
                        relations.push({ attrs: r2Attrs, fds: projectFDs(r2Attrs, fds) });
                    }
                    if (r1Attrs.length >= rel.attrs.length && r2Attrs.length >= rel.attrs.length) {
                        // Cannot decompose further
                        const keys = findCandidateKeys(rel.attrs, projectedFDs);
                        result.push({ attrs: rel.attrs, fds: projectedFDs, keys });
                    }
                }
            }

            return result;
        }

        // ── 3NF synthesis decomposition ──
        function decompose3NF(allAttrs, fds) {
            // 1. Compute minimal cover
            const minCover = minimalCover(fds);

            // 2. Group FDs by LHS
            const groups = new Map();
            for (const fd of minCover) {
                const key = fd.lhs.sort().join(',');
                if (!groups.has(key)) groups.set(key, { lhs: fd.lhs, rhs: [] });
                fd.rhs.forEach(a => {
                    if (!groups.get(key).rhs.includes(a)) groups.get(key).rhs.push(a);
                });
            }

            // 3. Create relations
            const relations = [];
            for (const [, g] of groups) {
                const attrs = [...new Set([...g.lhs, ...g.rhs])];
                const projFDs = projectFDs(attrs, fds);
                const keys = findCandidateKeys(attrs, projFDs);
                relations.push({ attrs, fds: projFDs, keys });
            }

            // 4. Ensure a candidate key is preserved
            const candidateKeys = findCandidateKeys(allAttrs, fds);
            let keyPreserved = false;
            for (const key of candidateKeys) {
                for (const rel of relations) {
                    if (key.every(a => rel.attrs.includes(a))) {
                        keyPreserved = true; break;
                    }
                }
                if (keyPreserved) break;
            }
            if (!keyPreserved && candidateKeys.length > 0) {
                const key = candidateKeys[0];
                const projFDs = projectFDs(key, fds);
                relations.push({ attrs: [...key], fds: projFDs, keys: [key] });
            }

            return relations;
        }

        function minimalCover(fds) {
            // 1. Split RHS to singletons
            let result = [];
            for (const fd of fds) {
                for (const a of fd.rhs) {
                    result.push({ lhs: [...fd.lhs], rhs: [a] });
                }
            }

            // 2. Remove extraneous LHS attributes
            for (const fd of result) {
                for (let i = fd.lhs.length - 1; i >= 0; i--) {
                    if (fd.lhs.length <= 1) break;
                    const reduced = [...fd.lhs];
                    reduced.splice(i, 1);
                    const cl = closure(reduced, result);
                    if (fd.rhs.every(a => cl.closure.has(a))) {
                        fd.lhs = reduced;
                    }
                }
            }

            // 3. Remove redundant FDs
            for (let i = result.length - 1; i >= 0; i--) {
                const without = [...result.slice(0, i), ...result.slice(i + 1)];
                const cl = closure(result[i].lhs, without);
                if (result[i].rhs.every(a => cl.closure.has(a))) {
                    result.splice(i, 1);
                }
            }

            return result;
        }

        function projectFDs(attrs, allFDs) {
            const projected = [];
            const attrSet = new Set(attrs);

            // For all subsets of attrs, compute closure and derive FDs
            const n = attrs.length;
            for (let mask = 1; mask < (1 << n); mask++) {
                const subset = [];
                for (let i = 0; i < n; i++) {
                    if (mask & (1 << i)) subset.push(attrs[i]);
                }
                const cl = closure(subset, allFDs);
                const rhs = [...cl.closure].filter(a => attrSet.has(a) && !subset.includes(a));
                if (rhs.length) {
                    projected.push({ lhs: subset, rhs });
                }
            }

            // Minimize
            return minimalCover(projected);
        }

        // ── UI ──
        const attrsInput = document.getElementById('attrsInput');
        const fdsInput = document.getElementById('fdsInput');
        const btnAnalyze = document.getElementById('btnAnalyze');
        const resultArea = document.getElementById('resultArea');
        const closureInput = document.getElementById('closureInput');
        const btnClosure = document.getElementById('btnClosure');
        const closureResult = document.getElementById('closureResult');

        document.querySelectorAll('.example-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                attrsInput.value = chip.dataset.attrs;
                fdsInput.value = chip.dataset.fds;
                analyze();
            });
        });

        btnAnalyze.addEventListener('click', analyze);
        btnClosure.addEventListener('click', computeClosure);

        function analyze() {
            const allAttrs = parseAttrs(attrsInput.value);
            const fds = parseFDs(fdsInput.value);

            if (allAttrs.length === 0) {
                resultArea.innerHTML = '<div class="card" style="color:var(--danger);">Veuillez saisir au moins un attribut.</div>';
                return;
            }
            if (fds.length === 0) {
                resultArea.innerHTML = '<div class="card" style="color:var(--danger);">Veuillez saisir au moins une dépendance fonctionnelle.</div>';
                return;
            }

            const candidateKeys = findCandidateKeys(allAttrs, fds);
            const nfResult = checkNormalForm(allAttrs, fds, candidateKeys);

            let html = '';

            // ── Normal form result ──
            html += '<div class="card">';
            html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;">';
            html += `<span class="nf-badge nf-${nfResult.form.toLowerCase()}">${nfResult.form}</span>`;
            html += '<div>';
            html += `<div style="font-weight:700;font-size:1.1rem;">Le schéma est en ${nfResult.form}</div>`;
            const formDescriptions = {
                '1NF': 'Le schéma ne satisfait pas la 2NF : il existe des dépendances partielles.',
                '2NF': 'Le schéma satisfait la 2NF mais pas la 3NF : il existe des dépendances transitives.',
                '3NF': 'Le schéma satisfait la 3NF mais pas la BCNF : certains déterminants ne sont pas des super-clés.',
                'BCNF': 'Le schéma satisfait la forme normale de Boyce-Codd : tout déterminant est une super-clé.'
            };
            html += `<div class="text-muted text-sm">${formDescriptions[nfResult.form]}</div>`;
            html += '</div></div>';

            // Candidate keys
            html += '<h4 style="margin-bottom:0.5rem;">Clés candidates</h4>';
            if (candidateKeys.length === 0) {
                html += '<p class="text-muted">Aucune clé candidate trouvée (l\'ensemble de tous les attributs est la clé).</p>';
            } else {
                for (const key of candidateKeys) {
                    html += `<span class="set-display" style="margin-right:0.5rem;">{ ${key.join(', ')} }</span>`;
                }
            }

            // Minimal cover
            const minCov = minimalCover(fds);
            html += '<h4 style="margin:1rem 0 0.5rem;">Couverture minimale</h4>';
            html += '<ul class="fd-list">';
            for (const fd of minCov) {
                html += `<li class="ok-item">${fdStr(fd)}</li>`;
            }
            html += '</ul>';

            html += '</div>';

            // ── Violations detail ──
            if (nfResult.form !== 'BCNF') {
                html += '<details class="card fold-card">';
                html += '<summary>Détail des violations</summary>';
                html += '<div class="fold-body fold-scroll">';

                if (nfResult.violations['2NF'].length > 0) {
                    html += '<div class="step-card violation"><h4>Violations de la 2NF (dépendances partielles)</h4>';
                    html += '<ul class="fd-list">';
                    for (const v of nfResult.violations['2NF']) {
                        html += `<li class="violation-item">${fdStr(v.fd)} — LHS est un sous-ensemble propre de la clé { ${v.key.join(', ')} }</li>`;
                    }
                    html += '</ul></div>';
                }

                if (nfResult.violations['3NF'].length > 0) {
                    html += '<div class="step-card violation"><h4>Violations de la 3NF (dépendances transitives)</h4>';
                    html += '<ul class="fd-list">';
                    for (const v of nfResult.violations['3NF']) {
                        html += `<li class="violation-item">${fdStr(v.fd)} — ${v.nonPrimeRHS.join(', ')} non premier(s) et LHS n'est pas une super-clé</li>`;
                    }
                    html += '</ul></div>';
                }

                if (nfResult.violations['BCNF'].length > 0) {
                    html += '<div class="step-card violation"><h4>Violations de BCNF</h4>';
                    html += '<ul class="fd-list">';
                    for (const fd of nfResult.violations['BCNF']) {
                        html += `<li class="violation-item">${fdStr(fd)} — le déterminant { ${fd.lhs.join(', ')} } n'est pas une super-clé</li>`;
                    }
                    html += '</ul></div>';
                }
                html += '</div>';
                html += '</details>';
            }

            // ── Decomposition ──
            if (nfResult.form !== 'BCNF') {
                html += '<details class="card fold-card">';
                html += '<summary>Synthèse 3NF / Décomposition BCNF</summary>';
                html += '<div class="fold-body fold-scroll">';
                html += '<div class="tabs">';
                html += '<button class="tab-btn active" data-tab="tab3nf">Synthèse 3NF</button>';
                html += '<button class="tab-btn" data-tab="tabbcnf">Décomposition BCNF</button>';
                html += '</div>';

                // 3NF synthesis
                const decomp3NF = decompose3NF(allAttrs, fds);
                html += '<div class="tab-content active" id="tab3nf">';
                html += '<p class="text-muted text-sm mb-1">Décomposition par synthèse préservant les dépendances et sans perte.</p>';
                html += '<div class="decomposition-grid">';
                let idx = 1;
                for (const rel of decomp3NF) {
                    html += `<div class="relation-card">`;
                    html += `<h5>R${idx++}</h5>`;
                    html += `<div class="attrs">( ${rel.attrs.join(', ')} )</div>`;
                    if (rel.keys.length > 0) {
                        html += `<div class="key-label">Clé(s) :</div>`;
                        for (const k of rel.keys) {
                            html += `<div class="key-val">{ ${k.join(', ')} }</div>`;
                        }
                    }
                    if (rel.fds.length > 0) {
                        html += `<div class="fds">DF : ${rel.fds.map(fdStr).join(' ; ')}</div>`;
                    }
                    html += '</div>';
                }
                html += '</div></div>';

                // BCNF decomposition
                const decompBCNF = decomposeBCNF(allAttrs, fds);
                html += '<div class="tab-content" id="tabbcnf">';
                html += '<p class="text-muted text-sm mb-1">Décomposition sans perte (les dépendances ne sont pas toujours préservées).</p>';
                html += '<div class="decomposition-grid">';
                idx = 1;
                for (const rel of decompBCNF) {
                    html += `<div class="relation-card">`;
                    html += `<h5>R${idx++}</h5>`;
                    html += `<div class="attrs">( ${rel.attrs.join(', ')} )</div>`;
                    if (rel.keys.length > 0) {
                        html += `<div class="key-label">Clé(s) :</div>`;
                        for (const k of rel.keys) {
                            html += `<div class="key-val">{ ${k.join(', ')} }</div>`;
                        }
                    }
                    if (rel.fds.length > 0) {
                        html += `<div class="fds">DF : ${rel.fds.map(fdStr).join(' ; ')}</div>`;
                    }
                    html += '</div>';
                }
                html += '</div></div>';

                html += '</div>';
                html += '</details>';
            }

            resultArea.innerHTML = html;

            // Tab switching
            resultArea.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const parent = btn.closest('.card');
                    parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    parent.querySelector('#' + btn.dataset.tab).classList.add('active');
                });
            });
        }

        function computeClosure() {
            const allAttrs = parseAttrs(attrsInput.value);
            const fds = parseFDs(fdsInput.value);
            const target = parseAttrs(closureInput.value);

            if (target.length === 0) {
                closureResult.innerHTML = '<span class="text-muted">Veuillez saisir un ensemble d\'attributs.</span>';
                return;
            }

            const result = closure(target, fds);

            let html = '<div class="step-card ok">';
            html += `<h4>{ ${target.join(', ')} }<sup>+</sup> = ${setStr(result.closure)}</h4>`;
            html += '<div style="margin-top:0.75rem;">';

            for (let i = 0; i < result.steps.length; i++) {
                const s = result.steps[i];
                html += `<div style="font-size:0.85rem;margin-bottom:0.3rem;">`;
                if (i === 0) {
                    html += `<strong>Initialisation :</strong> ${setStr(s.result)}`;
                } else {
                    html += `<strong>Par ${s.step} :</strong> ajout de { ${s.added.join(', ')} } → ${setStr(s.result)}`;
                }
                html += '</div>';
            }

            // Is it a super key?
            if (allAttrs.every(a => result.closure.has(a))) {
                html += '<div style="margin-top:0.5rem;color:var(--accent);font-weight:600;font-size:0.85rem;">C\'est une super-clé (la fermeture contient tous les attributs).</div>';
            } else {
                html += `<div style="margin-top:0.5rem;color:var(--muted);font-size:0.85rem;">Attributs manquants pour être super-clé : { ${allAttrs.filter(a => !result.closure.has(a)).join(', ')} }</div>`;
            }

            html += '</div></div>';
            closureResult.innerHTML = html;
        }

        // Initial analysis
        analyze();
    })();
    }
}

if (typeof window !== 'undefined') {
    window.NormalizationPage = NormalizationPage;
}
