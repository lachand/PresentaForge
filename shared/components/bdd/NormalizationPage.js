class NormalizationPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
    (() => {
        'use strict';

        // Moteur pur : shared/components/algorithms/normalization-engine.js
        const E = window.NormalizationEngine;
        const parseAttrs = E.normParseAttrs;
        const setStr = E.normSetStr;
        const fdStr = E.normFdStr;
        const closure = E.normClosure;
        const findCandidateKeys = E.normFindCandidateKeys;
        const checkNormalForm = E.normCheckNormalForm;
        const decomposeBCNF = E.normDecomposeBCNF;
        const decompose3NF = E.normDecompose3NF;
        const minimalCover = E.normMinimalCover;

        // Les attributs de la relation servent à lire `AB -> C` comme `A, B -> C`.
        function readInputs() {
            const allAttrs = parseAttrs(attrsInput.value);
            return { allAttrs, fds: E.normParseFDs(fdsInput.value, allAttrs) };
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
            const { allAttrs, fds } = readInputs();

            if (allAttrs.length === 0) {
                resultArea.innerHTML = '<div class="card" style="color:var(--danger);">Saisis au moins un attribut.</div>';
                return;
            }
            if (fds.length === 0) {
                resultArea.innerHTML = '<div class="card" style="color:var(--danger);">Saisis au moins une dépendance fonctionnelle (ex. A -> B, C).</div>';
                return;
            }
            const unknown = E.normUnknownAttributes(allAttrs, fds);
            if (unknown.length) {
                resultArea.innerHTML = '<div class="card" style="color:var(--danger);">Attribut inconnu dans les dépendances : ' +
                    unknown.map(a => '<code>' + a.replace(/[<>&]/g, '') + '</code>').join(', ') +
                    '. Sépare les attributs par des virgules, ou déclare-les dans la liste des attributs.</div>';
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
            const formLabel = nfResult.form === '1NF' ? 'au plus en 1NF' : 'en ' + nfResult.form;
            html += `<div style="font-weight:700;font-size:1.1rem;">Le schéma est ${formLabel}</div>`;
            const formDescriptions = {
                '1NF': 'Le schéma ne satisfait pas la 2NF : il existe des dépendances partielles. (La 1NF elle-même, des valeurs atomiques, ne se vérifie pas avec des dépendances.)',
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
                        html += `<li class="violation-item">${fdStr(v.fd)} - LHS est un sous-ensemble propre de la clé { ${v.key.join(', ')} }</li>`;
                    }
                    html += '</ul></div>';
                }

                if (nfResult.violations['3NF'].length > 0) {
                    html += '<div class="step-card violation"><h4>Violations de la 3NF (dépendances transitives)</h4>';
                    html += '<ul class="fd-list">';
                    for (const v of nfResult.violations['3NF']) {
                        html += `<li class="violation-item">${fdStr(v.fd)} - ${v.nonPrimeRHS.join(', ')} non premier(s) et LHS n'est pas une super-clé</li>`;
                    }
                    html += '</ul></div>';
                }

                if (nfResult.violations['BCNF'].length > 0) {
                    html += '<div class="step-card violation"><h4>Violations de BCNF</h4>';
                    html += '<ul class="fd-list">';
                    for (const fd of nfResult.violations['BCNF']) {
                        html += `<li class="violation-item">${fdStr(fd)} - le déterminant { ${fd.lhs.join(', ')} } n'est pas une super-clé</li>`;
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
                html += '<p class="text-muted text-sm mb-1">Décomposition par synthèse : sans perte ET qui préserve les dépendances.</p>';
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
                const bcnfPres = E.normPreservesDependencies(decompBCNF, fds);
                html += '<p class="text-muted text-sm mb-1">Décomposition sans perte. Les dépendances ne sont pas toujours préservées : ' +
                    (bcnfPres.preserved
                        ? 'ici, elles le sont.'
                        : 'ici, <b>' + bcnfPres.lost.map(fdStr).join(' ; ') + '</b> n\'est plus vérifiable dans une seule table (voir la synthèse 3NF).') +
                    '</p>';
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
            const { allAttrs, fds } = readInputs();
            const target = parseAttrs(closureInput.value, allAttrs);

            if (target.length === 0) {
                closureResult.innerHTML = '<span class="text-muted">Saisis un ensemble d\'attributs.</span>';
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
                html += '<div style="margin-top:0.5rem;color:var(--ok);font-weight:600;font-size:0.85rem;">C\'est une super-clé (la fermeture contient tous les attributs).</div>';
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
