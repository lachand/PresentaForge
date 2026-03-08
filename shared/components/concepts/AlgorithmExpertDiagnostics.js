/**
 * AlgorithmExpertDiagnostics — moteur d'analyse statique de AlgorithmExpertLab.
 *
 * Dépendances injectées via le constructeur :
 *   - getExpressionAst(expr)     : parseur d'expressions (fourni par AlgorithmExpertLab)
 *   - flattenStatements(stmts)   : aplatit l'AST en liste (fourni par AlgorithmExpertLab)
 *
 * Aucune dépendance DOM. Toutes les méthodes sont de la pure computation.
 */
class AlgorithmExpertDiagnostics {
    constructor({ getExpressionAst, flattenStatements }) {
        this._getExpressionAst = getExpressionAst;
        this._flattenStatements = flattenStatements;
    }

    // ================================================================
    // Création / normalisation de diagnostics
    // ================================================================

    createDiagnostic(partial = {}) {
        return {
            code: partial.code || 'DIAG_INFO',
            severity: partial.severity || 'info',
            category: partial.category || 'general',
            lineNo: Number.isInteger(partial.lineNo) ? partial.lineNo : null,
            message: partial.message || 'Diagnostic',
            suggestion: partial.suggestion || '',
            quickFix: partial.quickFix || '',
            danger: partial.danger || '',
            confidence: partial.confidence == null ? 0.7 : Math.max(0, Math.min(1, Number(partial.confidence))),
            example: partial.example || ''
        };
    }

    normalizeDiagnostics(diagnostics) {
        const list = Array.isArray(diagnostics) ? diagnostics : [];
        return list.map((item) => {
            if (typeof item === 'string') {
                const codeMatch = item.match(/^([A-Z_0-9]+):\s*(.*)$/);
                if (codeMatch) {
                    const code = codeMatch[1];
                    const message = codeMatch[2];
                    return this.createDiagnostic({
                        code,
                        severity: code.startsWith('E_') ? 'error' : 'warning',
                        message,
                        category: 'runtime',
                        confidence: 0.9
                    });
                }
                return this.createDiagnostic({
                    code: 'DIAG_INFO',
                    severity: 'info',
                    message: item,
                    confidence: 0.6
                });
            }
            return this.createDiagnostic(item || {});
        });
    }

    validationErrorsToDiagnostics(errors) {
        return (errors || []).map((error) => this.createDiagnostic({
            code: error.code || 'E_INPUT',
            severity: 'error',
            category: 'input',
            lineNo: null,
            message: error.message || 'Entrée invalide.',
            suggestion: 'Corriger la valeur dans les entrées JSON puis relancer l\'analyse.',
            quickFix: '"param": valeur_valide',
            danger: 'Le moteur ne peut pas exécuter le scénario tant que cette contrainte est violée.',
            confidence: 1
        }));
    }

    dedupeDiagnostics(diagnostics) {
        const unique = new Map();
        this.normalizeDiagnostics(diagnostics).forEach((diag) => {
            const key = `${diag.code}|${diag.lineNo || '-'}|${diag.message}`;
            if (!unique.has(key)) {
                unique.set(key, diag);
                return;
            }
            const existing = unique.get(key);
            if ((diag.confidence || 0) > (existing.confidence || 0)) {
                unique.set(key, diag);
            }
        });

        return Array.from(unique.values())
            .sort((a, b) => {
                const rank = { error: 0, warning: 1, info: 2 };
                const ar = rank[a.severity] ?? 9;
                const br = rank[b.severity] ?? 9;
                if (ar !== br) return ar - br;
                if ((a.lineNo || 0) !== (b.lineNo || 0)) return (a.lineNo || 0) - (b.lineNo || 0);
                return String(a.code).localeCompare(String(b.code));
            });
    }

    getDiagnosticCodeDescription(code) {
        const map = {
            E_INPUT: 'Entrée invalide',
            E_MISSING: 'Paramètre manquant',
            E_TYPE: 'Type non conforme',
            E_RANGE: 'Valeur hors bornes',
            E_NON_ZERO: 'Dénominateur nul interdit',
            E_ZERO_DIV: 'Division/modulo par zéro',
            E_INFINITE_LOOP: 'Non-terminaison détectée',
            E_VAR_BEFORE_ASSIGN: 'Variable lue avant affectation',
            W_LOOP_INFINITE_RISK: 'Risque de boucle infinie',
            W_OFF_BY_ONE: 'Risque off-by-one',
            W_FOR_DIRECTION: 'Sens de parcours incohérent',
            I_UNUSED_VAR: 'Variable non utilisée',
            W_COMPLEXITY_HIGH: 'Complexité potentiellement élevée',
            W_RECURSION_RISK: 'Récursion à surveiller',
            W_DEAD_CODE: 'Code non atteignable',
            W_RETURN_MISSING: 'Return manquant sur un chemin',
            I_AUGMENTED_ASSIGN_SUGGEST: 'Suggestion: opérateur augmenté',
            E_FN_UNSUPPORTED: 'Fonction intégrée non supportée',
            E_UNPACK: 'Décompression impossible',
            E_UNPACK_MISMATCH: 'Nombre de cibles incorrect',
            E_METHOD: 'Méthode de liste invalide',
            E_IN_TYPE: 'Type incompatible avec opérateur in'
        };
        return map[code] || 'Règle diagnostique.';
    }

    // ================================================================
    // Analyse statique principale
    // ================================================================

    runStaticAnalysis(program, entryDef, contract) {
        if (!entryDef) {
            return {
                diagnostics: [],
                cfg: null,
                ssa: null,
                intervals: null,
                invariants: [],
                ruleCoverage: []
            };
        }

        const diagnostics = [];
        diagnostics.push(...this.collectPotentialInfiniteLoopWarningsAsDiagnostics(entryDef.body));
        diagnostics.push(...this.detectDeadCodeDiagnostics(entryDef.body));
        diagnostics.push(...this.detectConstantConditionDiagnostics(entryDef.body));
        diagnostics.push(...this.detectUsedBeforeAssignedDiagnostics(entryDef, program));
        diagnostics.push(...this.detectUnusedVariableDiagnostics(entryDef, program));
        diagnostics.push(...this.detectLoopDirectionDiagnostics(entryDef.body));
        diagnostics.push(...this.detectRecursionRiskDiagnostics(program));
        diagnostics.push(...this.detectDivisionAndBoundsRisks(entryDef, contract));
        diagnostics.push(...this.detectComplexitySuspicionDiagnostics(entryDef));

        const cfg = this.buildControlFlowGraph(program);
        const ssa = this.buildSsaSummary(entryDef);
        const intervals = this.buildIntervalSummary(entryDef);
        const invariants = this.inferLoopInvariants(entryDef.body);
        const ruleCoverage = this.computeRuleCoverage(diagnostics);

        return {
            diagnostics: this.dedupeDiagnostics(diagnostics),
            cfg,
            ssa,
            intervals,
            invariants,
            ruleCoverage
        };
    }

    // ================================================================
    // Diagnostics post-exécution (nécessite la trace runtime)
    // ================================================================

    allPathsReturn(statements) {
        for (let i = statements.length - 1; i >= 0; i -= 1) {
            const stmt = statements[i];
            if (stmt.type === 'return') return true;
            if (stmt.type === 'if') {
                const allBranchesReturn = stmt.branches.every((b) => this.allPathsReturn(b.body));
                const elseReturns = stmt.elseBody && this.allPathsReturn(stmt.elseBody);
                if (allBranchesReturn && elseReturns) return true;
            }
        }
        return false;
    }

    buildDiagnostics(program, entryDef, events, runtimeError = null, contract = []) {
        const diagnostics = [];
        const bodyLines = this._flattenStatements(entryDef.body);
        const source = bodyLines.map((stmt) => stmt.source).join('\n');

        // P3: improved W_RETURN_MISSING — checks all branches, not just flat list
        const hasAnyReturn = bodyLines.some((stmt) => stmt.type === 'return');
        const allPathsHaveReturn = this.allPathsReturn(entryDef.body);
        if (!allPathsHaveReturn) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_RETURN_MISSING',
                severity: 'warning',
                category: 'control_flow',
                message: hasAnyReturn
                    ? 'Certains chemins d\'exécution n\'ont pas de return explicite (ex: branche else manquante).'
                    : 'La fonction principale ne contient pas de return explicite.',
                suggestion: 'Ajouter un return explicite sur tous les chemins d\'exécution.',
                quickFix: 'return resultat',
                danger: 'Le résultat devient null sur les chemins sans return.',
                confidence: 0.95
            }));
        }

        // P3: detect x = x + 1 pattern that could use +=
        if (/\b([A-Za-z_]\w*)\s*=\s*\1\s*[\+\-\*]/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'I_AUGMENTED_ASSIGN_SUGGEST',
                severity: 'info',
                category: 'style',
                message: 'Affectation de la forme "x = x + ..." détectée. Elle peut s\'écrire "x += ..." (assignation augmentée).',
                suggestion: 'Utiliser les opérateurs +=, -=, *= pour plus de lisibilité.',
                quickFix: 'x += 1',
                confidence: 0.8
            }));
        }

        if (/range\(len\([^)]+\)\)/.test(source) && /\[[A-Za-z_]\w*\s*\+\s*1\]/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_OFF_BY_ONE',
                severity: 'warning',
                category: 'bounds',
                message: 'Risque off-by-one: accès i+1 avec range(len(...)).',
                suggestion: 'Réduire la borne finale ou protéger i+1.',
                quickFix: 'for i in range(0, len(t)-1):',
                danger: 'Peut provoquer un accès hors limites en fin de tableau.',
                confidence: 0.92
            }));
        }

        if (/\[[0]\]/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_EMPTY_ARRAY_CASE',
                severity: 'warning',
                category: 'bounds',
                message: 'Accès direct [0] détecté: prévoir le cas tableau vide.',
                suggestion: 'Tester la longueur avant accès à l\'indice 0.',
                quickFix: 'if len(tableau) == 0: return ...',
                danger: 'Erreur d\'indice possible si entrée vide.',
                confidence: 0.88
            }));
        }

        const loopWarnings = this.collectPotentialInfiniteLoopWarningsAsDiagnostics(entryDef.body);
        diagnostics.push(...loopWarnings);

        const contractList = Array.isArray(contract) ? contract : [];
        const nonZeroParams = contractList
            .filter((spec) => spec.expectedType === 'number' && spec.constraints && spec.constraints.nonZero)
            .map((spec) => spec.name);
        if (nonZeroParams.length) {
            const guardedParams = nonZeroParams.filter((name) => (
                new RegExp(`\\b${name}\\s*!=\\s*0|0\\s*!=\\s*\\b${name}\\b`).test(source)
            ));
            const ungardedParams = nonZeroParams.filter((n) => !guardedParams.includes(n));
            if (guardedParams.length) {
                diagnostics.push(this.createDiagnostic({
                    code: 'I_DENOMINATOR_GUARDED',
                    severity: 'info',
                    category: 'input_contract',
                    message: `Division par ${guardedParams.join(', ')} protégée par un test \`!= 0\` — vérification correcte.`,
                    suggestion: 'Bonne pratique : tester le dénominateur avant division. Assurez-vous que la condition couvre bien tous les chemins d\'exécution.',
                    confidence: 0.9
                }));
            }
            if (ungardedParams.length) {
                diagnostics.push(this.createDiagnostic({
                    code: 'I_DENOMINATOR_PARAMS',
                    severity: 'info',
                    category: 'input_contract',
                    message: `Paramètre(s) utilisé(s) comme dénominateur: ${ungardedParams.join(', ')} (valeur 0 non testée).`,
                    suggestion: 'Ajouter un test != 0 avant la division ou valider l\'entrée.',
                    confidence: 0.95
                }));
            }
        }

        if (!events.length) {
            diagnostics.push(this.createDiagnostic({
                code: 'E_TRACE_EMPTY',
                severity: 'error',
                category: 'runtime',
                message: 'Aucune étape exécutée: le code ne produit pas de trace exploitable.',
                suggestion: 'Vérifier les entrées et les conditions d\'entrée dans la fonction.',
                danger: 'Impossible de fournir un tutorat pas à pas.',
                confidence: 1
            }));
        }

        if (runtimeError) {
            diagnostics.unshift(this.createDiagnostic({
                code: runtimeError.code || 'E_RUNTIME',
                severity: 'error',
                category: 'runtime',
                lineNo: runtimeError.lineNo || null,
                message: runtimeError.message || 'Erreur d\'exécution.',
                suggestion: 'Lire la ligne active et corriger la condition/affectation concernée.',
                danger: 'L\'exécution est interrompue avant la fin.',
                confidence: 1
            }));
        }

        // D1: redundant boolean comparison (x == True / x == False)
        if (/==\s*True\b|==\s*False\b/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'I_REDUNDANT_BOOL_CMP',
                severity: 'info',
                category: 'style',
                message: 'Comparaison redondante avec True/False: "x == True" s\'ecrit "x", "x == False" s\'ecrit "not x".',
                suggestion: 'Utiliser directement la variable booleenne ou "not x".',
                quickFix: 'if x:  # au lieu de if x == True:',
                confidence: 0.92
            }));
        }

        // D1b: double negation (not not x)
        if (/\bnot\s+not\s+\w/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'I_DOUBLE_NEGATION',
                severity: 'info',
                category: 'style',
                message: '"not not x" est redondant — equivalent a bool(x).',
                suggestion: 'Supprimer la double negation ou remplacer par bool(x) si besoin de conversion.',
                quickFix: 'x  # ou bool(x)',
                confidence: 0.95
            }));
        }

        // D2: for i in range(len(T)) where i is only used as T[i]
        const forLenRegex = /\bfor\s+(\w+)\s+in\s+range\s*\(\s*(?:\d+\s*,\s*)?len\s*\(\s*(\w+)\s*\)\s*\)/g;
        let forLenMatch;
        while ((forLenMatch = forLenRegex.exec(source)) !== null) {
            const loopVar = forLenMatch[1];
            const arr = forLenMatch[2];
            let stripped = source;
            stripped = stripped.replace(new RegExp(`\\bfor\\s+${loopVar}\\s+in\\b[^\n]*`, 'g'), '');
            stripped = stripped.replace(new RegExp(`\\b\\w+\\s*\\[\\s*${loopVar}(?:\\s*[+\\-]\\s*\\d+)?\\s*\\]`, 'g'), 'INDEXED');
            const stillUsed = new RegExp(`\\b${loopVar}\\b`).test(stripped);
            if (!stillUsed) {
                diagnostics.push(this.createDiagnostic({
                    code: 'I_FOR_IN_SUGGEST',
                    severity: 'info',
                    category: 'style',
                    message: `La variable "${loopVar}" n'est utilisee qu'en acces indexe sur "${arr}". Preferez "for element in ${arr}:" pour plus de lisibilite.`,
                    suggestion: `Remplacer "for ${loopVar} in range(len(${arr})):" par "for element in ${arr}:".`,
                    quickFix: `for element in ${arr}:`,
                    confidence: 0.8
                }));
            } else {
                // D7: i used both as T[i] and as standalone index value — suggest enumerate
                const indexedUsed = new RegExp(`\\b${arr}\\s*\\[\\s*${loopVar}\\b`).test(source);
                if (indexedUsed) {
                    diagnostics.push(this.createDiagnostic({
                        code: 'I_ENUMERATE_SUGGEST',
                        severity: 'info',
                        category: 'style',
                        message: `"${loopVar}" est utilise a la fois comme indice (${arr}[${loopVar}]) et comme valeur standalone. Preferez "for ${loopVar}, element in enumerate(${arr}):" pour eviter les acces indexes.`,
                        suggestion: `Remplacer "for ${loopVar} in range(len(${arr})):" par "for ${loopVar}, element in enumerate(${arr}):".`,
                        quickFix: `for ${loopVar}, element in enumerate(${arr}):`,
                        confidence: 0.75
                    }));
                }
            }
        }

        // D3: for-loop variable reassigned inside the loop body
        const checkLoopVarOverwrite = (stmts) => {
            stmts.forEach((stmt) => {
                if (stmt.type === 'for' || stmt.type === 'for_in' || stmt.type === 'for_enumerate' || stmt.type === 'for_items') {
                    const loopVar = stmt.iterator;
                    const bodyOverwrites = this._flattenStatements(stmt.body)
                        .filter((s) => s.type === 'assign' && s.target && s.target.kind === 'name' && s.target.name === loopVar);
                    if (bodyOverwrites.length) {
                        diagnostics.push(this.createDiagnostic({
                            code: 'W_LOOP_VAR_OVERWRITE',
                            severity: 'warning',
                            category: 'control_flow',
                            lineNo: bodyOverwrites[0].lineNo,
                            message: `La variable de boucle "${loopVar}" est reassignee dans le corps de la boucle. Cette modification n'affecte pas la progression de l'iteration.`,
                            suggestion: `Utiliser une variable temporaire differente a la place de "${loopVar}".`,
                            danger: 'Modifier la variable d\'iteration ne change pas les valeurs parcourues (comportement Python).',
                            confidence: 0.9
                        }));
                    }
                    checkLoopVarOverwrite(stmt.body);
                    return;
                }
                if (stmt.type === 'while') { checkLoopVarOverwrite(stmt.body); return; }
                if (stmt.type === 'if') {
                    stmt.branches.forEach((b) => checkLoopVarOverwrite(b.body));
                    if (stmt.elseBody) checkLoopVarOverwrite(stmt.elseBody);
                }
            });
        };
        checkLoopVarOverwrite(entryDef.body);

        // D6: W_SHADOWED_PARAM — a parameter is immediately overwritten before being read
        if (entryDef.params && entryDef.params.length) {
            const firstStatements = entryDef.body.slice(0, Math.min(5, entryDef.body.length));
            entryDef.params.forEach((param) => {
                const paramReadFirst = firstStatements.some((stmt) => {
                    if (stmt.type !== 'assign') return false;
                    const targetIsParam = stmt.target && stmt.target.kind === 'name' && stmt.target.name === param;
                    if (!targetIsParam) return false;
                    const rhsUsesParam = new RegExp(`\\b${param}\\b`).test(stmt.expression || '');
                    return !rhsUsesParam;
                });
                if (paramReadFirst) {
                    diagnostics.push(this.createDiagnostic({
                        code: 'W_SHADOWED_PARAM',
                        severity: 'warning',
                        category: 'control_flow',
                        message: `Le paramètre "${param}" est écrasé immédiatement sans être lu. Sa valeur d'entrée est donc ignorée.`,
                        suggestion: `Vérifiez si vous souhaitiez utiliser "${param}" dans l'expression, ou renommer la variable locale.`,
                        quickFix: `nouvelle_var = ...  # au lieu de ${param} = ...`,
                        confidence: 0.85
                    }));
                }
            });
        }

        // D8: I_DEAD_PASS — `pass` left in a body that has other real statements
        const checkDeadPass = (stmts) => {
            stmts.forEach((stmt) => {
                if (stmt.type === 'if') {
                    stmt.branches.forEach((b) => checkDeadPass(b.body));
                    if (stmt.elseBody) checkDeadPass(stmt.elseBody);
                } else if (stmt.type === 'for' || stmt.type === 'for_in' || stmt.type === 'for_enumerate' || stmt.type === 'for_items' || stmt.type === 'while') {
                    checkDeadPass(stmt.body);
                }
            });
            const hasPass = stmts.some((s) => s.type === 'expr' && (s.source || '').trim() === 'pass');
            const hasRealCode = stmts.some((s) => !(s.type === 'expr' && (s.source || '').trim() === 'pass'));
            if (hasPass && hasRealCode) {
                const passStmt = stmts.find((s) => s.type === 'expr' && (s.source || '').trim() === 'pass');
                diagnostics.push(this.createDiagnostic({
                    code: 'I_DEAD_PASS',
                    severity: 'info',
                    category: 'style',
                    lineNo: passStmt ? passStmt.lineNo : undefined,
                    message: '"pass" est present dans un bloc qui contient deja du code. Il est inutile et probablement un oubli.',
                    suggestion: 'Supprimer le "pass" superflu.',
                    quickFix: '# supprimer la ligne pass',
                    confidence: 0.98
                }));
            }
        };
        checkDeadPass(entryDef.body);

        // D9: W_CONSECUTIVE_ASSIGN — same variable assigned twice in a row without being read
        for (let i = 0; i < bodyLines.length - 1; i += 1) {
            const curr = bodyLines[i];
            const next = bodyLines[i + 1];
            if (curr.type === 'assign' && next.type === 'assign'
                && curr.target && next.target
                && curr.target.kind === 'name' && next.target.kind === 'name'
                && curr.target.name === next.target.name) {
                const varName = curr.target.name;
                const nextRhs = next.expression || '';
                if (!new RegExp(`\\b${varName}\\b`).test(nextRhs)) {
                    diagnostics.push(this.createDiagnostic({
                        code: 'W_CONSECUTIVE_ASSIGN',
                        severity: 'warning',
                        category: 'control_flow',
                        lineNo: next.lineNo,
                        message: `"${varName}" est assigne deux fois de suite (lignes ${curr.lineNo} et ${next.lineNo}) sans etre lu entre les deux. La premiere valeur est perdue.`,
                        suggestion: `Verifiez si la ligne ${curr.lineNo} est utile ou si elle doit etre supprimee.`,
                        quickFix: `# supprimer l'affectation redondante ligne ${curr.lineNo}`,
                        confidence: 0.88
                    }));
                }
            }
        }

        // D10: I_UNUSED_INIT — variable initialised to 0/[]/'' before a loop but never updated inside
        const topLevelAssigns = entryDef.body.filter((s) => s.type === 'assign' && s.target && s.target.kind === 'name');
        const loopStmts = entryDef.body.filter((s) => s.type === 'for' || s.type === 'for_in' || s.type === 'for_enumerate' || s.type === 'for_items' || s.type === 'while');
        topLevelAssigns.forEach((initStmt) => {
            const varName = initStmt.target.name;
            const initVal = (initStmt.expression || '').trim();
            const isDefaultInit = initVal === '0' || initVal === '0.0' || initVal === '[]' || initVal === '""' || initVal === "''";
            if (!isDefaultInit) return;
            const followingLoop = loopStmts.find((l) => l.lineNo > initStmt.lineNo);
            if (!followingLoop) return;
            const loopBodyFlat = this._flattenStatements(followingLoop.body);
            const updatedInLoop = loopBodyFlat.some((s) => {
                if (s.type === 'assign' && s.target && s.target.name === varName) return true;
                if (s.type === 'method_call' && s.obj === varName) return true;
                return false;
            });
            if (!updatedInLoop) {
                diagnostics.push(this.createDiagnostic({
                    code: 'I_UNUSED_INIT',
                    severity: 'info',
                    category: 'control_flow',
                    lineNo: initStmt.lineNo,
                    message: `"${varName}" est initialise a ${initVal} avant la boucle mais n'est jamais mis a jour a l'interieur. L'initialisation est peut-etre inutile ou la mise a jour manque.`,
                    suggestion: `Verifiez que "${varName}" est bien modifie dans le corps de la boucle.`,
                    confidence: 0.75
                }));
            }
        });

        return this.dedupeDiagnostics(diagnostics);
    }

    // ================================================================
    // Détecteurs statiques individuels
    // ================================================================

    collectPotentialInfiniteLoopWarnings(statements, output = []) {
        statements.forEach((statement) => {
            if (statement.type === 'while') {
                const analysis = this.analyzeConditionExpression(statement.condition);
                const writtenNames = this.collectWrittenVariableNames(statement.body);
                const hasBreak = this.blockHasBreakForCurrentLoop(statement.body);
                const conditionNames = Array.from(analysis.variableNames);
                const conditionUpdated = conditionNames.some((name) => writtenNames.has(name));

                if (analysis.isConstant && analysis.constantValue === true && !hasBreak) {
                    output.push(
                        `Boucle while ligne ${statement.lineNo}: condition constante vraie sans break direct (risque de boucle infinie).`
                    );
                } else if (!conditionNames.length && !hasBreak) {
                    output.push(
                        `Boucle while ligne ${statement.lineNo}: condition sans variable d'état et sans break direct (risque de boucle infinie).`
                    );
                } else if (conditionNames.length && !conditionUpdated && !hasBreak) {
                    output.push(
                        `Boucle while ligne ${statement.lineNo}: variables de condition non mises à jour dans la boucle (${conditionNames.join(', ')}).`
                    );
                }

                this.collectPotentialInfiniteLoopWarnings(statement.body, output);
                return;
            }

            if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                this.collectPotentialInfiniteLoopWarnings(statement.body, output);
                return;
            }

            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    this.collectPotentialInfiniteLoopWarnings(branch.body, output);
                });
                if (statement.elseBody) {
                    this.collectPotentialInfiniteLoopWarnings(statement.elseBody, output);
                }
            }
        });
        return output;
    }

    collectPotentialInfiniteLoopWarningsAsDiagnostics(statements) {
        const warnings = this.collectPotentialInfiniteLoopWarnings(statements);
        return warnings.map((message) => {
            const lineMatch = message.match(/ligne\s+(\d+)/i);
            return this.createDiagnostic({
                code: 'W_LOOP_INFINITE_RISK',
                severity: 'warning',
                category: 'termination',
                lineNo: lineMatch ? Number(lineMatch[1]) : null,
                message,
                suggestion: 'Vérifier la progression de la variable de condition et la présence d\'un cas d\'arrêt.',
                quickFix: 'Mettre à jour la variable de condition dans la boucle.',
                danger: 'Risque de blocage ou de dépassement des garde-fous.',
                confidence: 0.9
            });
        });
    }

    detectDeadCodeDiagnostics(statements, diagnostics = []) {
        let terminated = false;
        for (let i = 0; i < statements.length; i += 1) {
            const statement = statements[i];
            if (terminated) {
                diagnostics.push(this.createDiagnostic({
                    code: 'W_DEAD_CODE',
                    severity: 'warning',
                    category: 'control_flow',
                    lineNo: statement.lineNo,
                    message: `Code potentiellement mort après un return/break/continue (ligne ${statement.lineNo}).`,
                    suggestion: 'Déplacer ce bloc avant le return/break ou restructurer les conditions.',
                    danger: 'Le code devient trompeur: il ne sera jamais exécuté.',
                    confidence: 0.95
                }));
            }

            if (statement.type === 'return' || statement.type === 'break' || statement.type === 'continue') {
                terminated = true;
            }

            if (statement.type === 'if') {
                statement.branches.forEach((branch) => this.detectDeadCodeDiagnostics(branch.body, diagnostics));
                if (statement.elseBody) this.detectDeadCodeDiagnostics(statement.elseBody, diagnostics);
            } else if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items' || statement.type === 'while') {
                this.detectDeadCodeDiagnostics(statement.body, diagnostics);
            }
        }
        return diagnostics;
    }

    detectConstantConditionDiagnostics(statements, diagnostics = []) {
        statements.forEach((statement) => {
            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    const analysis = this.analyzeConditionExpression(branch.condition);
                    if (analysis.isConstant) {
                        diagnostics.push(this.createDiagnostic({
                            code: analysis.constantValue ? 'W_IF_ALWAYS_TRUE' : 'W_IF_ALWAYS_FALSE',
                            severity: 'warning',
                            category: 'logic',
                            lineNo: branch.lineNo,
                            message: `Condition constante ${analysis.constantValue ? 'vraie' : 'fausse'} (ligne ${branch.lineNo}).`,
                            suggestion: 'Vérifier la condition: elle ne dépend d\'aucune variable.',
                            quickFix: 'Remplacer la condition par une expression dépendante des entrées.',
                            danger: 'Branche inutile ou jamais atteinte.',
                            confidence: 0.85
                        }));
                    }
                    this.detectConstantConditionDiagnostics(branch.body, diagnostics);
                });
                if (statement.elseBody) this.detectConstantConditionDiagnostics(statement.elseBody, diagnostics);
                return;
            }

            if (statement.type === 'while') {
                const analysis = this.analyzeConditionExpression(statement.condition);
                if (analysis.isConstant) {
                    diagnostics.push(this.createDiagnostic({
                        code: analysis.constantValue ? 'W_WHILE_ALWAYS_TRUE' : 'I_WHILE_ALWAYS_FALSE',
                        severity: analysis.constantValue ? 'warning' : 'info',
                        category: 'logic',
                        lineNo: statement.lineNo,
                        message: `Condition de while constante ${analysis.constantValue ? 'vraie' : 'fausse'} (ligne ${statement.lineNo}).`,
                        suggestion: analysis.constantValue
                            ? 'Ajouter une condition d\'arrêt dépendante d\'une variable.'
                            : 'La boucle ne tournera jamais: vérifier l\'intention.',
                        danger: analysis.constantValue ? 'Risque de non-terminaison.' : 'Boucle inutile.',
                        confidence: 0.88
                    }));
                }
                this.detectConstantConditionDiagnostics(statement.body, diagnostics);
                return;
            }

            if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                this.detectConstantConditionDiagnostics(statement.body, diagnostics);
            }
        });
        return diagnostics;
    }

    detectUsedBeforeAssignedDiagnostics(entryDef, program = null) {
        const diagnostics = [];
        const walk = (statements, assigned) => {
            let localAssigned = new Set(assigned);
            statements.forEach((statement) => {
                if (statement.type === 'assign') {
                    const names = this.extractNamesFromExpression(statement.expression, entryDef, program);
                    names.forEach((name) => {
                        if (!localAssigned.has(name)) {
                            diagnostics.push(this.createDiagnostic({
                                code: 'E_VAR_BEFORE_ASSIGN',
                                severity: 'error',
                                category: 'data_flow',
                                lineNo: statement.lineNo,
                                message: `Variable '${name}' utilisée avant affectation (ligne ${statement.lineNo}).`,
                                suggestion: `Initialiser '${name}' avant son utilisation.`,
                                quickFix: `${name} = 0`,
                                danger: 'Le calcul dépend d\'une valeur non définie.',
                                confidence: 0.94
                            }));
                        }
                    });
                    localAssigned.add(statement.target.name);
                    return;
                }

                if (statement.type === 'expr') {
                    const names = this.extractNamesFromExpression(statement.expression, entryDef, program);
                    names.forEach((name) => {
                        if (!localAssigned.has(name)) {
                            diagnostics.push(this.createDiagnostic({
                                code: 'E_VAR_BEFORE_ASSIGN',
                                severity: 'error',
                                category: 'data_flow',
                                lineNo: statement.lineNo,
                                message: `Variable '${name}' utilisée avant affectation (ligne ${statement.lineNo}).`,
                                suggestion: `Définir '${name}' avant cet appel.`,
                                confidence: 0.9
                            }));
                        }
                    });
                    return;
                }

                if (statement.type === 'if') {
                    statement.branches.forEach((branch) => {
                        const names = this.extractNamesFromExpression(branch.condition, entryDef, program);
                        names.forEach((name) => {
                            if (!localAssigned.has(name)) {
                                diagnostics.push(this.createDiagnostic({
                                    code: 'E_VAR_BEFORE_ASSIGN',
                                    severity: 'error',
                                    category: 'data_flow',
                                    lineNo: branch.lineNo,
                                    message: `Variable '${name}' utilisée avant affectation (ligne ${branch.lineNo}).`,
                                    confidence: 0.9
                                }));
                            }
                        });
                        walk(branch.body, new Set(localAssigned));
                    });
                    if (statement.elseBody) walk(statement.elseBody, new Set(localAssigned));
                    return;
                }

                if (statement.type === 'for') {
                    statement.rangeArgs.forEach((expr) => {
                        const names = this.extractNamesFromExpression(expr, entryDef, program);
                        names.forEach((name) => {
                            if (!localAssigned.has(name)) {
                                diagnostics.push(this.createDiagnostic({
                                    code: 'E_VAR_BEFORE_ASSIGN',
                                    severity: 'error',
                                    category: 'data_flow',
                                    lineNo: statement.lineNo,
                                    message: `Variable '${name}' utilisée avant affectation (ligne ${statement.lineNo}).`,
                                    confidence: 0.9
                                }));
                            }
                        });
                    });
                    localAssigned.add(statement.iterator);
                    walk(statement.body, new Set(localAssigned));
                    return;
                }

                if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                    const names = this.extractNamesFromExpression(statement.iterableExpression, entryDef, program);
                    names.forEach((name) => {
                        if (!localAssigned.has(name)) {
                            diagnostics.push(this.createDiagnostic({
                                code: 'E_VAR_BEFORE_ASSIGN',
                                severity: 'error',
                                category: 'data_flow',
                                lineNo: statement.lineNo,
                                message: `Variable '${name}' utilisée avant affectation (ligne ${statement.lineNo}).`,
                                confidence: 0.9
                            }));
                        }
                    });
                    localAssigned.add(statement.iterator);
                    walk(statement.body, new Set(localAssigned));
                    return;
                }

                if (statement.type === 'while') {
                    const names = this.extractNamesFromExpression(statement.condition, entryDef, program);
                    names.forEach((name) => {
                        if (!localAssigned.has(name)) {
                            diagnostics.push(this.createDiagnostic({
                                code: 'E_VAR_BEFORE_ASSIGN',
                                severity: 'error',
                                category: 'data_flow',
                                lineNo: statement.lineNo,
                                message: `Variable '${name}' utilisée avant affectation (ligne ${statement.lineNo}).`,
                                confidence: 0.9
                            }));
                        }
                    });
                    walk(statement.body, new Set(localAssigned));
                    return;
                }

                if (statement.type === 'return' && statement.expression) {
                    const names = this.extractNamesFromExpression(statement.expression, entryDef, program);
                    names.forEach((name) => {
                        if (!localAssigned.has(name)) {
                            diagnostics.push(this.createDiagnostic({
                                code: 'E_VAR_BEFORE_ASSIGN',
                                severity: 'error',
                                category: 'data_flow',
                                lineNo: statement.lineNo,
                                message: `Variable '${name}' retournée avant affectation.`,
                                confidence: 0.9
                            }));
                        }
                    });
                }
            });
        };

        walk(entryDef.body, new Set(entryDef.params));
        return diagnostics;
    }

    detectUnusedVariableDiagnostics(entryDef, program = null) {
        const assigned = new Map();
        const used = new Map();

        const markAssigned = (name, lineNo) => {
            if (!assigned.has(name)) assigned.set(name, []);
            assigned.get(name).push(lineNo);
        };
        const markUsed = (name, lineNo) => {
            if (!used.has(name)) used.set(name, []);
            used.get(name).push(lineNo);
        };

        const walk = (statements) => {
            statements.forEach((statement) => {
                if (statement.type === 'assign') {
                    markAssigned(statement.target.name, statement.lineNo);
                    this.extractNamesFromExpression(statement.expression, entryDef, program).forEach((name) => markUsed(name, statement.lineNo));
                    return;
                }
                if (statement.type === 'expr') {
                    this.extractNamesFromExpression(statement.expression, entryDef, program).forEach((name) => markUsed(name, statement.lineNo));
                    return;
                }
                if (statement.type === 'if') {
                    statement.branches.forEach((branch) => {
                        this.extractNamesFromExpression(branch.condition, entryDef, program).forEach((name) => markUsed(name, branch.lineNo));
                        walk(branch.body);
                    });
                    if (statement.elseBody) walk(statement.elseBody);
                    return;
                }
                if (statement.type === 'for') {
                    markAssigned(statement.iterator, statement.lineNo);
                    statement.rangeArgs.forEach((expr) => this.extractNamesFromExpression(expr, entryDef, program).forEach((name) => markUsed(name, statement.lineNo)));
                    walk(statement.body);
                    return;
                }
                if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                    markAssigned(statement.iterator, statement.lineNo);
                    if (statement.valueVar) markAssigned(statement.valueVar, statement.lineNo);
                    this.extractNamesFromExpression(statement.iterableExpression, entryDef, program).forEach((name) => markUsed(name, statement.lineNo));
                    walk(statement.body);
                    return;
                }
                if (statement.type === 'while') {
                    this.extractNamesFromExpression(statement.condition, entryDef, program).forEach((name) => markUsed(name, statement.lineNo));
                    walk(statement.body);
                    return;
                }
                if (statement.type === 'return' && statement.expression) {
                    this.extractNamesFromExpression(statement.expression, entryDef, program).forEach((name) => markUsed(name, statement.lineNo));
                }
            });
        };
        walk(entryDef.body);

        const diagnostics = [];
        assigned.forEach((lines, name) => {
            if (used.has(name)) return;
            if (entryDef.params.includes(name)) return;
            diagnostics.push(this.createDiagnostic({
                code: 'I_UNUSED_VAR',
                severity: 'info',
                category: 'readability',
                lineNo: lines[0] || null,
                message: `Variable '${name}' affectée mais jamais lue.`,
                suggestion: 'Supprimer la variable ou l\'utiliser explicitement.',
                confidence: 0.8
            }));
        });
        return diagnostics;
    }

    detectLoopDirectionDiagnostics(statements, diagnostics = []) {
        statements.forEach((statement) => {
            if (statement.type === 'for' && statement.rangeArgs.length >= 2) {
                const values = statement.rangeArgs.map((expr) => this.tryEvaluateConstantExpression(expr));
                const start = values[0];
                const end = values[1];
                const step = values.length >= 3 ? values[2] : 1;

                if (start != null && end != null && step != null) {
                    if (step > 0 && start > end) {
                        diagnostics.push(this.createDiagnostic({
                            code: 'W_FOR_DIRECTION',
                            severity: 'warning',
                            category: 'bounds',
                            lineNo: statement.lineNo,
                            message: `Boucle for ligne ${statement.lineNo}: pas positif mais début > fin.`,
                            suggestion: 'Inverser les bornes ou utiliser un pas négatif.',
                            quickFix: `range(${start}, ${end}, -1)`,
                            confidence: 0.93
                        }));
                    }
                    if (step < 0 && start < end) {
                        diagnostics.push(this.createDiagnostic({
                            code: 'W_FOR_DIRECTION',
                            severity: 'warning',
                            category: 'bounds',
                            lineNo: statement.lineNo,
                            message: `Boucle for ligne ${statement.lineNo}: pas négatif mais début < fin.`,
                            suggestion: 'Adapter le sens de parcours.',
                            confidence: 0.93
                        }));
                    }
                }
                this.detectLoopDirectionDiagnostics(statement.body, diagnostics);
                return;
            }

            if (statement.type === 'if') {
                statement.branches.forEach((branch) => this.detectLoopDirectionDiagnostics(branch.body, diagnostics));
                if (statement.elseBody) this.detectLoopDirectionDiagnostics(statement.elseBody, diagnostics);
                return;
            }

            if (statement.type === 'while') {
                this.detectLoopDirectionDiagnostics(statement.body, diagnostics);
                return;
            }

            if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                this.detectLoopDirectionDiagnostics(statement.body, diagnostics);
            }
        });
        return diagnostics;
    }

    detectRecursionRiskDiagnostics(program) {
        const diagnostics = [];
        const callMap = new Map();
        program.order.forEach((name) => {
            const def = program.functions[name];
            const called = new Set();
            this.collectFunctionCalls(def.body, called);
            callMap.set(name, called);
        });

        program.order.forEach((name) => {
            const called = callMap.get(name) || new Set();
            if (called.has(name)) {
                const def = program.functions[name];
                const hasConditionalReturn = this._flattenStatements(def.body)
                    .some((stmt) => stmt.type === 'if' || stmt.type === 'return');
                diagnostics.push(this.createDiagnostic({
                    code: 'W_RECURSION_RISK',
                    severity: hasConditionalReturn ? 'warning' : 'error',
                    category: 'termination',
                    lineNo: def.lineNo,
                    message: `Récursion directe détectée dans ${name}. Vérifier le cas de base.`,
                    suggestion: 'Ajouter un cas de base strictement décroissant.',
                    quickFix: 'if n <= 0: return ...',
                    danger: 'Risque de dépassement de pile.',
                    confidence: hasConditionalReturn ? 0.7 : 0.9
                }));
            }
        });
        return diagnostics;
    }

    collectFunctionCalls(statements, output) {
        statements.forEach((statement) => {
            if (statement.type === 'assign' || statement.type === 'expr' || (statement.type === 'return' && statement.expression)) {
                const expression = statement.expression || '';
                let ast;
                try {
                    ast = this._getExpressionAst(expression);
                } catch {
                    ast = null;
                }
                if (ast) this.extractCalledFunctionsFromAst(ast, output);
            }
            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    let ast;
                    try {
                        ast = this._getExpressionAst(branch.condition);
                    } catch {
                        ast = null;
                    }
                    if (ast) this.extractCalledFunctionsFromAst(ast, output);
                    this.collectFunctionCalls(branch.body, output);
                });
                if (statement.elseBody) this.collectFunctionCalls(statement.elseBody, output);
            }
            if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items' || statement.type === 'while') {
                this.collectFunctionCalls(statement.body, output);
            }
        });
    }

    extractCalledFunctionsFromAst(node, output) {
        if (!node) return;
        if (node.type === 'call') {
            if (node.callee && node.callee.type === 'name') {
                const name = node.callee.value;
                if (name !== 'len') output.add(name);
            }
            (node.args || []).forEach((arg) => this.extractCalledFunctionsFromAst(arg, output));
            return;
        }
        if (node.type === 'binary') {
            this.extractCalledFunctionsFromAst(node.left, output);
            this.extractCalledFunctionsFromAst(node.right, output);
            return;
        }
        if (node.type === 'unary') {
            this.extractCalledFunctionsFromAst(node.arg, output);
            return;
        }
        if (node.type === 'index') {
            this.extractCalledFunctionsFromAst(node.base, output);
            this.extractCalledFunctionsFromAst(node.index, output);
            return;
        }
        if (node.type === 'list') {
            (node.items || []).forEach((item) => this.extractCalledFunctionsFromAst(item, output));
        }
    }

    detectDivisionAndBoundsRisks(entryDef, contract) {
        const diagnostics = [];
        const source = this._flattenStatements(entryDef.body).map((stmt) => stmt.source).join('\n');
        const contractList = contract || [];
        if (/[A-Za-z_]\w*\s*\/\s*[A-Za-z_]\w*/.test(source) && !contractList.some((spec) => spec.constraints.nonZero)) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_DIV_ZERO_STATIC',
                severity: 'warning',
                category: 'arithmetics',
                message: 'Division détectée sans contrainte non-zéro explicite sur le dénominateur.',
                suggestion: 'Ajouter une validation ou un test avant division.',
                quickFix: 'if denom == 0: raise ...',
                confidence: 0.72
            }));
        }
        if (/range\(len\([^)]+\)\)/.test(source) && /\[[A-Za-z_]\w*\s*-\s*1\]/.test(source)) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_NEGATIVE_INDEX_RISK',
                severity: 'warning',
                category: 'bounds',
                message: 'Risque d\'indice négatif dans accès tableau.',
                suggestion: 'Protéger le cas i == 0.',
                confidence: 0.78
            }));
        }
        return diagnostics;
    }

    detectComplexitySuspicionDiagnostics(entryDef) {
        const diagnostics = [];
        const flattened = this._flattenStatements(entryDef.body);
        const loopCount = flattened.filter((stmt) => stmt.type === 'for' || stmt.type === 'while').length;
        const nestedLoop = flattened.some((stmt) => (stmt.type === 'for' || stmt.type === 'while')
            && this._flattenStatements(stmt.body).some((sub) => sub.type === 'for' || sub.type === 'while'));
        if (nestedLoop || loopCount >= 3) {
            diagnostics.push(this.createDiagnostic({
                code: 'W_COMPLEXITY_HIGH',
                severity: 'warning',
                category: 'complexity',
                message: 'Boucles imbriquées détectées: complexité potentiellement quadratique ou plus.',
                suggestion: 'Chercher une structure de données réduisant les parcours imbriqués.',
                confidence: 0.8
            }));
        }
        return diagnostics;
    }

    // ================================================================
    // Artefacts avancés (CFG, SSA, intervalles, invariants)
    // ================================================================

    buildControlFlowGraph(program) {
        const nodes = [];
        const edges = [];
        program.order.forEach((functionName) => {
            const def = program.functions[functionName];
            const flat = this._flattenStatements(def.body);
            flat.forEach((statement, index) => {
                const nodeId = `${functionName}:L${statement.lineNo}`;
                nodes.push({ id: nodeId, type: statement.type, lineNo: statement.lineNo });
                if (index > 0) {
                    const prev = flat[index - 1];
                    edges.push({
                        from: `${functionName}:L${prev.lineNo}`,
                        to: nodeId
                    });
                }
            });
        });

        const lines = [];
        lines.push(`Nœuds: ${nodes.length}, arêtes: ${edges.length}`);
        edges.slice(0, 140).forEach((edge) => lines.push(`${edge.from} -> ${edge.to}`));
        if (edges.length > 140) lines.push('... (arêtes tronquées)');

        return {
            nodes,
            edges,
            text: lines.join('\n')
        };
    }

    buildSsaSummary(entryDef) {
        const versionByVar = {};
        const rows = [];
        const walk = (statements) => {
            statements.forEach((statement) => {
                if (statement.type === 'assign') {
                    const name = statement.target.name;
                    versionByVar[name] = (versionByVar[name] || 0) + 1;
                    rows.push(`L${statement.lineNo}: ${name}_${versionByVar[name]} = ${statement.expression}`);
                }
                if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                    const name = statement.iterator;
                    versionByVar[name] = (versionByVar[name] || 0) + 1;
                    rows.push(`L${statement.lineNo}: ${name}_${versionByVar[name]} <- itération de ${statement.iterableExpression}`);
                    if (statement.valueVar) {
                        versionByVar[statement.valueVar] = (versionByVar[statement.valueVar] || 0) + 1;
                        rows.push(`L${statement.lineNo}: ${statement.valueVar}_${versionByVar[statement.valueVar]} <- valeur de ${statement.iterableExpression}`);
                    }
                }
                if (statement.type === 'if') {
                    statement.branches.forEach((branch) => walk(branch.body));
                    if (statement.elseBody) walk(statement.elseBody);
                } else if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items' || statement.type === 'while') {
                    walk(statement.body);
                }
            });
        };
        walk(entryDef.body);

        const varsLine = Object.keys(versionByVar).length
            ? Object.entries(versionByVar).map(([name, version]) => `${name}->${version}`).join(', ')
            : 'Aucune affectation SSA';

        return {
            versions: versionByVar,
            rows,
            text: `Versions finales: ${varsLine}\n\n${rows.join('\n')}`
        };
    }

    buildIntervalSummary(entryDef) {
        const map = new Map();
        const record = (name, min, max, lineNo) => {
            if (!map.has(name)) {
                map.set(name, { name, min: null, max: null, lines: [] });
            }
            const entry = map.get(name);
            if (min != null) {
                entry.min = entry.min == null ? min : Math.max(entry.min, min);
            }
            if (max != null) {
                entry.max = entry.max == null ? max : Math.min(entry.max, max);
            }
            if (lineNo != null) entry.lines.push(lineNo);
        };

        const parseCondition = (expression, lineNo) => {
            let ast;
            try {
                ast = this._getExpressionAst(expression);
            } catch {
                return;
            }
            if (!ast || ast.type !== 'binary') return;
            const ops = ['<', '<=', '>', '>='];
            if (!ops.includes(ast.op)) return;
            if (ast.left.type === 'name' && ast.right.type === 'number') {
                const value = Number(ast.right.value);
                if (ast.op === '>' || ast.op === '>=') record(ast.left.value, ast.op === '>' ? value + 1 : value, null, lineNo);
                if (ast.op === '<' || ast.op === '<=') record(ast.left.value, null, ast.op === '<' ? value - 1 : value, lineNo);
            }
            if (ast.right.type === 'name' && ast.left.type === 'number') {
                const value = Number(ast.left.value);
                if (ast.op === '<' || ast.op === '<=') record(ast.right.value, ast.op === '<' ? value + 1 : value, null, lineNo);
                if (ast.op === '>' || ast.op === '>=') record(ast.right.value, null, ast.op === '>' ? value - 1 : value, lineNo);
            }
        };

        const walk = (statements) => {
            statements.forEach((statement) => {
                if (statement.type === 'if') {
                    statement.branches.forEach((branch) => {
                        parseCondition(branch.condition, branch.lineNo);
                        walk(branch.body);
                    });
                    if (statement.elseBody) walk(statement.elseBody);
                    return;
                }
                if (statement.type === 'while') {
                    parseCondition(statement.condition, statement.lineNo);
                    walk(statement.body);
                    return;
                }
                if (statement.type === 'for') {
                    if (statement.rangeArgs.length >= 2) {
                        const start = this.tryEvaluateConstantExpression(statement.rangeArgs[0]);
                        const end = this.tryEvaluateConstantExpression(statement.rangeArgs[1]);
                        if (start != null || end != null) record(statement.iterator, start, end != null ? end - 1 : null, statement.lineNo);
                    }
                    walk(statement.body);
                    return;
                }
                if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                    walk(statement.body);
                }
            });
        };

        walk(entryDef.body);
        return {
            entries: Array.from(map.values())
        };
    }

    inferLoopInvariants(statements, output = []) {
        statements.forEach((statement) => {
            if (statement.type === 'for') {
                const writes = Array.from(this.collectWrittenVariableNames(statement.body));
                output.push(`L${statement.lineNo}: l'itérateur ${statement.iterator} progresse selon range(...), vérifier que ${writes.join(', ') || 'aucune variable'} respecte l'invariant attendu.`);
                this.inferLoopInvariants(statement.body, output);
                return;
            }
            if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                const writes = Array.from(this.collectWrittenVariableNames(statement.body));
                output.push(`L${statement.lineNo}: invariant candidat -> ${statement.iterator} parcourt ${statement.iterableExpression}; vérifier l'effet sur ${writes.join(', ') || 'les variables de sortie'}.`);
                this.inferLoopInvariants(statement.body, output);
                return;
            }
            if (statement.type === 'while') {
                const analysis = this.analyzeConditionExpression(statement.condition);
                const names = Array.from(analysis.variableNames);
                output.push(`L${statement.lineNo}: invariant candidat -> relation de condition sur ${names.join(', ') || 'aucune variable explicite'}.`);
                this.inferLoopInvariants(statement.body, output);
                return;
            }
            if (statement.type === 'if') {
                statement.branches.forEach((branch) => this.inferLoopInvariants(branch.body, output));
                if (statement.elseBody) this.inferLoopInvariants(statement.elseBody, output);
            }
        });
        return output.slice(0, 40);
    }

    computeRuleCoverage(diagnostics) {
        const counts = new Map();
        diagnostics.forEach((diag) => {
            const code = diag.code || 'DIAG';
            counts.set(code, (counts.get(code) || 0) + 1);
        });
        return Array.from(counts.entries())
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    }

    // ================================================================
    // Utilitaires AST (partagés par les détecteurs)
    // ================================================================

    tryEvaluateConstantExpression(expression) {
        try {
            const ast = this._getExpressionAst(expression);
            const value = this.evaluateConstantAst(ast);
            if (typeof value === 'number' && Number.isFinite(value)) return value;
        } catch {
            return null;
        }
        return null;
    }

    extractNamesFromExpression(expression, entryDef = null, program = null) {
        let ast;
        try {
            ast = this._getExpressionAst(expression);
        } catch {
            return [];
        }
        const names = new Set();
        this.extractVariableNamesFromAst(ast, names);
        const filtered = Array.from(names).filter((name) => {
            if (name === 'len' || name === 'True' || name === 'False') return false;
            if (entryDef && program && program.functions[name]) return false;
            return true;
        });
        return filtered;
    }

    analyzeConditionExpression(expression) {
        let ast;
        try {
            ast = this._getExpressionAst(expression);
        } catch {
            return {
                variableNames: new Set(),
                isConstant: false,
                constantValue: false
            };
        }

        const variableNames = new Set();
        this.extractVariableNamesFromAst(ast, variableNames);

        try {
            const value = this.evaluateConstantAst(ast);
            return {
                variableNames,
                isConstant: true,
                constantValue: Boolean(value)
            };
        } catch {
            return {
                variableNames,
                isConstant: false,
                constantValue: false
            };
        }
    }

    extractVariableNamesFromAst(node, output) {
        if (!node) return;

        if (node.type === 'name') {
            output.add(node.value);
            return;
        }

        if (node.type === 'index') {
            this.extractVariableNamesFromAst(node.base, output);
            this.extractVariableNamesFromAst(node.index, output);
            return;
        }

        if (node.type === 'call') {
            if (node.callee && node.callee.type !== 'name') {
                this.extractVariableNamesFromAst(node.callee, output);
            }
            (node.args || []).forEach((arg) => this.extractVariableNamesFromAst(arg, output));
            return;
        }

        if (node.type === 'list') {
            (node.items || []).forEach((item) => this.extractVariableNamesFromAst(item, output));
            return;
        }

        if (node.type === 'unary') {
            this.extractVariableNamesFromAst(node.arg, output);
            return;
        }

        if (node.type === 'binary') {
            this.extractVariableNamesFromAst(node.left, output);
            this.extractVariableNamesFromAst(node.right, output);
        }
    }

    evaluateConstantAst(node) {
        const asNumber = (value, opLabel) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            throw new Error(`Constante invalide pour ${opLabel}.`);
        };

        if (!node) throw new Error('AST constant vide.');
        if (node.type === 'number' || node.type === 'boolean' || node.type === 'string' || node.type === 'null') return node.value;
        if (node.type === 'list') {
            return (node.items || []).map((item) => this.evaluateConstantAst(item));
        }

        if (node.type === 'name' || node.type === 'index' || node.type === 'call') {
            throw new Error('Expression non constante.');
        }

        if (node.type === 'unary') {
            const value = this.evaluateConstantAst(node.arg);
            if (node.op === 'not') return !Boolean(value);
            if (node.op === '-') return -asNumber(value, 'unaire -');
            if (node.op === '+') return asNumber(value, 'unaire +');
            throw new Error('Opérateur unaire non constant.');
        }

        if (node.type === 'binary') {
            if (node.op === 'and') {
                return Boolean(this.evaluateConstantAst(node.left))
                    && Boolean(this.evaluateConstantAst(node.right));
            }
            if (node.op === 'or') {
                return Boolean(this.evaluateConstantAst(node.left))
                    || Boolean(this.evaluateConstantAst(node.right));
            }

            const left = this.evaluateConstantAst(node.left);
            const right = this.evaluateConstantAst(node.right);

            if (node.op === '+') return asNumber(left, '+') + asNumber(right, '+');
            if (node.op === '-') return asNumber(left, '-') - asNumber(right, '-');
            if (node.op === '*') return asNumber(left, '*') * asNumber(right, '*');
            if (node.op === '/') {
                const denom = asNumber(right, '/');
                if (denom === 0) throw new Error('Division par zéro.');
                return asNumber(left, '/') / denom;
            }
            if (node.op === '//') {
                const denom = asNumber(right, '//');
                if (denom === 0) throw new Error('Division entière par zéro.');
                return Math.trunc(asNumber(left, '//') / denom);
            }
            if (node.op === '%') {
                const denom = asNumber(right, '%');
                if (denom === 0) throw new Error('Modulo par zéro.');
                return asNumber(left, '%') % denom;
            }
            if (node.op === '==') return left === right;
            if (node.op === '!=') return left !== right;
            if (node.op === '<') return left < right;
            if (node.op === '<=') return left <= right;
            if (node.op === '>') return left > right;
            if (node.op === '>=') return left >= right;
        }

        throw new Error('Expression constante non évaluée.');
    }

    collectWrittenVariableNames(statements, output = new Set()) {
        statements.forEach((statement) => {
            if (statement.type === 'assign') {
                output.add(statement.target.name);
                return;
            }

            if (statement.type === 'tuple_assign') {
                statement.targets.forEach((t) => output.add(t));
                return;
            }

            if (statement.type === 'method_call') {
                output.add(statement.obj);
                return;
            }

            if (statement.type === 'for') {
                output.add(statement.iterator);
                this.collectWrittenVariableNames(statement.body, output);
                return;
            }

            if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                output.add(statement.iterator);
                if (statement.valueVar) output.add(statement.valueVar);
                this.collectWrittenVariableNames(statement.body, output);
                return;
            }

            if (statement.type === 'while') {
                this.collectWrittenVariableNames(statement.body, output);
                return;
            }

            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    this.collectWrittenVariableNames(branch.body, output);
                });
                if (statement.elseBody) {
                    this.collectWrittenVariableNames(statement.elseBody, output);
                }
            }
        });
        return output;
    }

    blockHasBreakForCurrentLoop(statements) {
        for (const statement of statements) {
            if (statement.type === 'break') return true;
            if (statement.type === 'for' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items' || statement.type === 'while') continue;
            if (statement.type === 'if') {
                const branchHasBreak = statement.branches.some((branch) => this.blockHasBreakForCurrentLoop(branch.body));
                if (branchHasBreak) return true;
                if (statement.elseBody && this.blockHasBreakForCurrentLoop(statement.elseBody)) return true;
            }
        }
        return false;
    }
}

window.AlgorithmExpertDiagnostics = AlgorithmExpertDiagnostics;
