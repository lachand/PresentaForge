class AlgorithmExpertEngine {
    constructor({ getExecutionOptions, buildDiagnostics, estimateComplexity }) {
        this._getExecutionOptions = getExecutionOptions;
        this._buildDiagnostics = buildDiagnostics;
        this._estimateComplexity = estimateComplexity;
        this.expressionCache = new Map();
    }

    createExpertError(code, message, runtime = null, lineNo = null, source = '') {
        const error = new Error(message);
        error.code = code || 'E_RUNTIME';
        if (lineNo != null) {
            error.lineNo = lineNo;
        } else if (runtime && Number.isInteger(runtime.currentLineNo)) {
            error.lineNo = runtime.currentLineNo;
        }
        const sourceLine = source || (runtime ? runtime.currentSource : '') || '';
        if (sourceLine) error.source = sourceLine;
        return error;
    }

    normalizeRuntimeError(error, runtime = null) {
        if (error && error.code && String(error.code).startsWith('E_')) {
            if (runtime && error.lineNo == null && Number.isInteger(runtime.currentLineNo)) {
                error.lineNo = runtime.currentLineNo;
            }
            if (runtime && !error.source && runtime.currentSource) {
                error.source = runtime.currentSource;
            }
            return error;
        }
        return this.createExpertError(
            'E_RUNTIME',
            (error && error.message) ? error.message : 'Erreur d\'exécution.',
            runtime
        );
    }

    describeRuntimeError(error) {
        if (!error) return '';
        const code = error.code || 'E_RUNTIME';
        const lineLabel = Number.isInteger(error.lineNo) ? `ligne ${error.lineNo}` : 'ligne inconnue';
        return `${code} (${lineLabel}): ${error.message || "Erreur d'ex\xE9cution."}`;
    }

    boolLabel(value) {
        return value ? 'vrai' : 'faux';
    }

    deepClone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }

    executeProgram(program, inputValues, contract = []) {
        const entry = program.order[0];
        if (!entry) throw new Error('Aucune fonction détectée.');
        const entryDef = program.functions[entry];

        const runtime = {
            program,
            events: [],
            callCount: 0,
            maxDepth: 0,
            opCount: 0,
            branchStats: {},
            currentLineNo: null,
            currentSource: '',
            memoryBytes: 0,
            maxMemoryBytes: 2_500_000,
            strictTyping: Boolean(this._getExecutionOptions().strictTyping),
            compatibilityMode: String(this._getExecutionOptions().compatibilityMode || 'pedagogique'),
            activeCallSignatures: new Map(),
            callStack: [],    // M2: current call frames
            callTree: null,   // V2: root call tree node
            _treeStack: []    // V2: internal tree building stack
        };

        const args = entryDef.params.map((param) => {
            if (Object.prototype.hasOwnProperty.call(inputValues, param)) {
                return this.deepClone(inputValues[param]);
            }
            return 0;
        });

        let result = null;
        let runtimeError = null;
        try {
            result = this.callFunction(entry, args, runtime, 0);
        } catch (error) {
            runtimeError = this.normalizeRuntimeError(error, runtime);
        }
        const coverage = this.computeCoverage(runtime.branchStats);
        const diagnostics = this._buildDiagnostics(program, entryDef, runtime.events, runtimeError, contract);
        const complexity = this._estimateComplexity(program, entry, inputValues);
        const jsTranslation = this.translateProgramToJavaScript(program);

        return {
            result,
            events: runtime.events,
            meta: {
                callCount: runtime.callCount,
                maxDepth: runtime.maxDepth,
                opCount: runtime.opCount
            },
            diagnostics,
            runtimeError,
            coverage,
            complexity,
            jsTranslation,
            callTree: runtime.callTree // V2
        };
    }

    callFunction(name, args, runtime, depth) {
        const def = runtime.program.functions[name];
        if (!def) {
            // P2.4: contextual error message
            const supported = ['len', 'abs', 'min', 'max', 'sum', 'print', 'range', 'sorted', 'reversed', 'int', 'float', 'str', 'bool'];
            const unsupported = ['enumerate', 'zip', 'list', 'type', 'isinstance', 'map', 'filter'];
            if (supported.includes(name)) {
                throw this.createExpertError('E_FN_UNKNOWN', `'${name}' est une fonction intégrée — vérifiez la syntaxe d'appel (ex: ${name}(valeur)).`, runtime);
            }
            if (unsupported.includes(name)) {
                throw this.createExpertError('E_FN_UNSUPPORTED', `'${name}' n'est pas supporté dans ce sous-ensemble Python. Fonctions disponibles: ${supported.join(', ')}.`, runtime);
            }
            throw this.createExpertError('E_FN_UNKNOWN', `Fonction non définie: '${name}'. Définissez-la avec def ou vérifiez l'orthographe.`, runtime);
        }
        if (depth > 40) throw this.createExpertError('E_DEPTH', 'Profondeur d\'appel trop grande (garde-fou).', runtime);

        const signature = `${name}::${JSON.stringify(args)}`;
        const activeCount = runtime.activeCallSignatures.get(signature) || 0;
        runtime.activeCallSignatures.set(signature, activeCount + 1);
        if (activeCount + 1 > 12) {
            throw this.createExpertError(
                'E_RECURSION_LOOP',
                `Appels répétés sans progrès détecté pour ${name}.`,
                runtime
            );
        }

        runtime.callCount += 1;
        runtime.maxDepth = Math.max(runtime.maxDepth, depth + 1);

        const frame = {
            functionName: name,
            locals: {}
        };

        def.params.forEach((param, index) => {
            frame.locals[param] = this.deepClone(args[index]);
        });

        // M2: push to visible call stack
        const stackFrame = { name, depth, args: args.map((a) => this.stringifyShort(a)).join(', ') };
        runtime.callStack.push(stackFrame);

        // V2: build call tree node
        const treeNode = { name, args: args.map((a) => this.stringifyShort(a)).join(', '), children: [], returnValue: null };
        if (depth === 0) {
            runtime.callTree = treeNode;
        } else if (runtime._treeStack.length > 0) {
            runtime._treeStack[runtime._treeStack.length - 1].children.push(treeNode);
        }
        runtime._treeStack.push(treeNode);

        try {
            const control = this.executeBlock(def.body, frame, runtime, depth);
            const retVal = (control && control.type === 'return') ? control.value : null;
            treeNode.returnValue = retVal;
            return retVal;
        } finally {
            runtime.callStack.pop();
            runtime._treeStack.pop();
            const remaining = (runtime.activeCallSignatures.get(signature) || 1) - 1;
            if (remaining <= 0) runtime.activeCallSignatures.delete(signature);
            else runtime.activeCallSignatures.set(signature, remaining);
        }
    }

    executeBlock(statements, frame, runtime, depth) {
        for (const statement of statements) {
            const control = this.executeStatement(statement, frame, runtime, depth);
            if (control && (control.type === 'break' || control.type === 'return' || control.type === 'continue')) {
                return control;
            }
        }
        return null;
    }

    executeStatement(statement, frame, runtime, depth) {
        runtime.currentLineNo = statement.lineNo;
        runtime.currentSource = statement.source || '';
        const before = this.deepClone(frame.locals);

        if (statement.type === 'assign') {
            const value = this.evaluateExpression(statement.expression, frame, runtime, depth);
            const arrayUpdate = this.applyAssignmentTarget(statement.target, value, frame, runtime, depth);
            const after = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'assign',
                lineNo: statement.lineNo,
                source: statement.source,
                details: `${statement.target.raw} = ${this.stringifyShort(value)}`,
                before,
                after,
                arrayUpdate,
                ...this.tutorHintsForType('assign')
            });
            return null;
        }

        if (statement.type === 'expr') {
            runtime.lastPrintOutput = null;
            const value = this.evaluateExpression(statement.expression, frame, runtime, depth);
            const after = this.deepClone(frame.locals);
            const isPrint = runtime.lastPrintOutput !== null;
            this.pushTraceEvent(runtime, {
                type: isPrint ? 'print' : 'expr',
                lineNo: statement.lineNo,
                source: statement.source,
                details: isPrint ? `print → "${runtime.lastPrintOutput}"` : `Expression évaluée → ${this.stringifyShort(value)}`,
                before,
                after,
                ...this.tutorHintsForType('assign')
            });
            runtime.lastPrintOutput = null;
            return null;
        }

        if (statement.type === 'if') {
            let branchExecuted = false;
            let chosenBody = null;
            let lastConditionValue = false;

            for (let i = 0; i < statement.branches.length; i += 1) {
                const branch = statement.branches[i];
                runtime.currentLineNo = branch.lineNo;
                runtime.currentSource = branch.source || '';
                const conditionValue = this.toTruthValue(this.evaluateExpression(branch.condition, frame, runtime, depth));
                lastConditionValue = conditionValue;
                this.recordBranch(runtime, `if:${branch.lineNo}`, conditionValue);
                this.pushTraceEvent(runtime, {
                    type: 'if',
                    lineNo: branch.lineNo,
                    source: branch.source,
                    details: `Condition -> ${this.boolLabel(conditionValue)}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    conditionResult: conditionValue,
                    ...this.tutorHintsForType('condition')
                });
                if (conditionValue) {
                    chosenBody = branch.body;
                    branchExecuted = true;
                    break;
                }
            }

            if (!branchExecuted && statement.elseBody) {
                runtime.currentLineNo = statement.lineNo;
                runtime.currentSource = statement.source || '';
                chosenBody = statement.elseBody;
                this.pushTraceEvent(runtime, {
                    type: 'if',
                    lineNo: statement.lineNo,
                    source: 'else:',
                    details: 'Branche else exécutée.',
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    conditionResult: !lastConditionValue,
                    ...this.tutorHintsForType('condition')
                });
            }

            if (chosenBody) {
                const control = this.executeBlock(chosenBody, frame, runtime, depth);
                if (control) return control;
            }
            return null;
        }

        if (statement.type === 'for') {
            const rangeValues = statement.rangeArgs.map((expr) => Number(this.evaluateExpression(expr, frame, runtime, depth)));
            let start = 0;
            let end = 0;
            let step = 1;

            if (rangeValues.length === 1) {
                [end] = rangeValues;
            } else if (rangeValues.length === 2) {
                [start, end] = rangeValues;
            } else if (rangeValues.length === 3) {
                [start, end, step] = rangeValues;
            } else {
                throw this.createExpertError(
                    'E_RANGE',
                    `range invalide à la ligne ${statement.lineNo}.`,
                    runtime,
                    statement.lineNo,
                    statement.source
                );
            }

            if (step === 0) {
                throw this.createExpertError(
                    'E_RANGE_STEP_ZERO',
                    `range avec pas nul à la ligne ${statement.lineNo}.`,
                    runtime,
                    statement.lineNo,
                    statement.source
                );
            }

            const limitGuard = 500; // P4: reduced guard (500 iterations max per loop)
            let iterations = 0;
            for (let i = start; (step > 0 ? i < end : i > end); i += step) {
                frame.locals[statement.iterator] = i;
                this.pushTraceEvent(runtime, {
                    type: 'for',
                    lineNo: statement.lineNo,
                    source: statement.source,
                    details: `Itération ${statement.iterator} = ${i}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    ...this.tutorHintsForType('bornes')
                });

                const control = this.executeBlock(statement.body, frame, runtime, depth);
                if (control && control.type === 'return') return control;
                if (control && control.type === 'break') break;

                iterations += 1;
                if (iterations > limitGuard) {
                    throw this.createExpertError(
                        'E_LOOP_GUARD',
                        `Trop d'itérations (garde-fou) à la ligne ${statement.lineNo}.`,
                        runtime,
                        statement.lineNo,
                        statement.source
                    );
                }
            }
            return null;
        }

        if (statement.type === 'for_in') {
            const iterable = this.evaluateExpression(statement.iterableExpression, frame, runtime, depth);
            // M1: support iteration over dict keys
            let iterItems;
            if (Array.isArray(iterable) || typeof iterable === 'string') {
                iterItems = typeof iterable === 'string' ? [...iterable] : iterable;
            } else if (iterable && typeof iterable === 'object' && !(iterable instanceof Set)) {
                iterItems = Object.keys(iterable);
            } else {
                throw this.createExpertError(
                    'E_FOR_IN_TYPE',
                    `for ... in attend un tableau, une chaîne ou un dictionnaire (ligne ${statement.lineNo}).`,
                    runtime,
                    statement.lineNo,
                    statement.source
                );
            }

            const limitGuard = 500; // P4: reduced guard (500 iterations max per loop)
            let iterations = 0;
            for (let i = 0; i < iterItems.length; i += 1) {
                frame.locals[statement.iterator] = this.deepClone(iterItems[i]);
                this.pushTraceEvent(runtime, {
                    type: 'for_in',
                    lineNo: statement.lineNo,
                    source: statement.source,
                    details: `Itération ${statement.iterator} = ${this.stringifyShort(iterItems[i])}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    ...this.tutorHintsForType('bornes')
                });

                const control = this.executeBlock(statement.body, frame, runtime, depth);
                if (control && control.type === 'return') return control;
                if (control && control.type === 'break') break;

                iterations += 1;
                if (iterations > limitGuard) {
                    throw this.createExpertError(
                        'E_INFINITE_LOOP',
                        `Boucle for_in interrompue par garde-fou à la ligne ${statement.lineNo}.`,
                        runtime,
                        statement.lineNo,
                        statement.source
                    );
                }
            }
            return null;
        }

        // L4: for i, val in enumerate(iterable):
        if (statement.type === 'for_enumerate') {
            const iterable = this.evaluateExpression(statement.iterableExpression, frame, runtime, depth);
            if (!Array.isArray(iterable) && typeof iterable !== 'string') {
                throw this.createExpertError(
                    'E_FOR_IN_TYPE',
                    `enumerate() attend un tableau ou une chaîne (ligne ${statement.lineNo}).`,
                    runtime, statement.lineNo, statement.source
                );
            }
            const limitGuard = 500;
            let iterations = 0;
            for (let i = 0; i < iterable.length; i += 1) {
                frame.locals[statement.indexVar] = i;
                frame.locals[statement.valueVar] = this.deepClone(iterable[i]);
                this.pushTraceEvent(runtime, {
                    type: 'for_in',
                    lineNo: statement.lineNo,
                    source: statement.source,
                    details: `enumerate: ${statement.indexVar}=${i}, ${statement.valueVar}=${this.stringifyShort(iterable[i])}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    ...this.tutorHintsForType('bornes')
                });
                const control = this.executeBlock(statement.body, frame, runtime, depth);
                if (control && control.type === 'return') return control;
                if (control && control.type === 'break') break;
                iterations += 1;
                if (iterations > limitGuard) {
                    throw this.createExpertError('E_INFINITE_LOOP', `Boucle enumerate interrompue par garde-fou à la ligne ${statement.lineNo}.`, runtime, statement.lineNo, statement.source);
                }
            }
            return null;
        }

        // M1: for k, v in expr — déstructuration en paires (d.items(), liste de tuples)
        if (statement.type === 'for_items') {
            const iterable = this.evaluateExpression(statement.iterableExpression, frame, runtime, depth);
            let pairs;
            if (Array.isArray(iterable)) {
                pairs = iterable;
            } else if (iterable && typeof iterable === 'object' && !(iterable instanceof Set)) {
                pairs = Object.entries(iterable);
            } else {
                throw this.createExpertError(
                    'E_FOR_ITEMS_TYPE',
                    `for ${statement.keyVar}, ${statement.valueVar} in ... attend une liste de paires ou un dictionnaire (ligne ${statement.lineNo}).`,
                    runtime, statement.lineNo, statement.source
                );
            }
            const limitGuard = 500;
            let iterations = 0;
            for (const pair of pairs) {
                const [kVal, vVal] = Array.isArray(pair) ? pair : [pair, pair];
                frame.locals[statement.keyVar] = this.deepClone(kVal);
                frame.locals[statement.valueVar] = this.deepClone(vVal);
                this.pushTraceEvent(runtime, {
                    type: 'for_in',
                    lineNo: statement.lineNo,
                    source: statement.source,
                    details: `${statement.keyVar}=${this.stringifyShort(kVal)}, ${statement.valueVar}=${this.stringifyShort(vVal)}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    ...this.tutorHintsForType('bornes')
                });
                const control = this.executeBlock(statement.body, frame, runtime, depth);
                if (control && control.type === 'return') return control;
                if (control && control.type === 'break') break;
                iterations += 1;
                if (iterations > limitGuard) {
                    throw this.createExpertError('E_INFINITE_LOOP', `Boucle for_items interrompue par garde-fou à la ligne ${statement.lineNo}.`, runtime, statement.lineNo, statement.source);
                }
            }
            return null;
        }

        if (statement.type === 'while') {
            let iterations = 0;
            const limitGuard = 500; // P4: reduced guard (500 iterations max per loop)

            while (true) {
                const conditionValue = this.toTruthValue(this.evaluateExpression(statement.condition, frame, runtime, depth));
                this.recordBranch(runtime, `while:${statement.lineNo}`, conditionValue);
                this.pushTraceEvent(runtime, {
                    type: 'while',
                    lineNo: statement.lineNo,
                    source: statement.source,
                    details: `Condition while -> ${this.boolLabel(conditionValue)}`,
                    before: this.deepClone(frame.locals),
                    after: this.deepClone(frame.locals),
                    conditionResult: conditionValue,
                    ...this.tutorHintsForType('condition')
                });

                if (!conditionValue) break;

                const beforeBodySnapshot = JSON.stringify(frame.locals);
                const control = this.executeBlock(statement.body, frame, runtime, depth);
                if (control && control.type === 'return') return control;
                if (control && control.type === 'break') break;
                const afterBodySnapshot = JSON.stringify(frame.locals);

                if (beforeBodySnapshot === afterBodySnapshot) {
                    throw this.createExpertError(
                        'E_INFINITE_LOOP',
                        `Boucle while potentiellement infinie à la ligne ${statement.lineNo}: la condition reste vraie et aucun état n'évolue.`,
                        runtime,
                        statement.lineNo,
                        statement.source
                    );
                }

                iterations += 1;
                if (iterations > limitGuard) {
                    throw this.createExpertError(
                        'E_INFINITE_LOOP',
                        `Boucle while interrompue par garde-fou à la ligne ${statement.lineNo} (suspicion de boucle infinie).`,
                        runtime,
                        statement.lineNo,
                        statement.source
                    );
                }
            }
            return null;
        }

        if (statement.type === 'break') {
            const after = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'break',
                lineNo: statement.lineNo,
                source: statement.source,
                details: 'Sortie de boucle (break).',
                before,
                after,
                ...this.tutorHintsForType('bornes')
            });
            return { type: 'break' };
        }

        // P1.3: continue
        if (statement.type === 'continue') {
            const after = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'continue',
                lineNo: statement.lineNo,
                source: statement.source,
                details: 'Passage à l\'itération suivante (continue).',
                before,
                after,
                ...this.tutorHintsForType('bornes')
            });
            return { type: 'continue' };
        }

        // P2.1: Tuple destructuring  a, b = b, a
        if (statement.type === 'tuple_assign') {
            // Evaluate all expressions first (handles swap: a, b = b, a)
            let values;
            if (statement.expressions.length === statement.targets.length) {
                values = statement.expressions.map((expr) => this.evaluateExpression(expr, frame, runtime, depth));
            } else if (statement.expressions.length === 1) {
                const single = this.evaluateExpression(statement.expressions[0], frame, runtime, depth);
                if (Array.isArray(single)) {
                    values = single;
                } else {
                    throw this.createExpertError('E_UNPACK', 'Impossible de décompresser une valeur non-liste.', runtime, statement.lineNo, statement.source);
                }
            } else {
                throw this.createExpertError('E_UNPACK_MISMATCH', `Nombre de valeurs (${statement.expressions.length}) incompatible avec les cibles (${statement.targets.length}).`, runtime, statement.lineNo, statement.source);
            }
            if (values.length < statement.targets.length) {
                throw this.createExpertError('E_UNPACK_MISMATCH', `Trop peu de valeurs pour décompresser (${values.length} pour ${statement.targets.length} cibles).`, runtime, statement.lineNo, statement.source);
            }
            statement.targets.forEach((target, i) => {
                frame.locals[target] = this.deepClone(values[i]);
            });
            const afterTuple = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'assign',
                lineNo: statement.lineNo,
                source: statement.source,
                details: `${statement.targets.join(', ')} = ${values.slice(0, statement.targets.length).map((v) => this.stringifyShort(v)).join(', ')}`,
                before,
                after: afterTuple,
                ...this.tutorHintsForType('assign')
            });
            return null;
        }

        // P2.2: Method call statement  T.append(x), T.pop(), T.sort()
        if (statement.type === 'method_call') {
            const objValue = frame.locals[statement.obj];
            if (objValue === undefined) {
                throw this.createExpertError('E_NAME', `Variable non définie: ${statement.obj}`, runtime, statement.lineNo, statement.source);
            }
            const argExprs = statement.argsText
                ? this.splitTopLevel(statement.argsText, ',').map((s) => s.trim()).filter(Boolean)
                : [];
            const args = argExprs.map((expr) => this.evaluateExpression(expr, frame, runtime, depth));
            let methodDetails;
            if (Array.isArray(objValue)) {
                if (statement.method === 'append') {
                    if (args.length !== 1) throw this.createExpertError('E_METHOD', 'append() attend exactement un argument.', runtime, statement.lineNo, statement.source);
                    objValue.push(this.deepClone(args[0]));
                    methodDetails = `${statement.obj}.append(${this.stringifyShort(args[0])})`;
                } else if (statement.method === 'pop') {
                    if (!objValue.length) throw this.createExpertError('E_METHOD', 'pop() sur liste vide.', runtime, statement.lineNo, statement.source);
                    const popped = objValue.pop();
                    methodDetails = `${statement.obj}.pop() → ${this.stringifyShort(popped)}`;
                } else if (statement.method === 'sort') {
                    objValue.sort((a, b) => {
                        if (typeof a === 'number' && typeof b === 'number') return a - b;
                        return String(a).localeCompare(String(b));
                    });
                    methodDetails = `${statement.obj}.sort()`;
                } else {
                    throw this.createExpertError('E_METHOD', `Méthode inconnue sur liste: .${statement.method}(). Méthodes supportées: append, pop, sort.`, runtime, statement.lineNo, statement.source);
                }
                frame.locals[statement.obj] = objValue;
            } else {
                throw this.createExpertError('E_METHOD', `Méthode .${statement.method}() non supportée sur ce type (${typeof objValue}).`, runtime, statement.lineNo, statement.source);
            }
            const afterMethod = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'assign',
                lineNo: statement.lineNo,
                source: statement.source,
                details: methodDetails,
                before,
                after: afterMethod,
                ...this.tutorHintsForType('assign')
            });
            return null;
        }

        if (statement.type === 'return') {
            const value = statement.expression
                ? this.evaluateExpression(statement.expression, frame, runtime, depth)
                : null;
            const after = this.deepClone(frame.locals);
            this.pushTraceEvent(runtime, {
                type: 'return',
                lineNo: statement.lineNo,
                source: statement.source,
                details: `Retour: ${this.stringifyShort(value)}`,
                before,
                after,
                returnValue: value,
                ...this.tutorHintsForType('retour')
            });
            return { type: 'return', value };
        }

        throw this.createExpertError(
            'E_STMT_UNSUPPORTED',
            `Type d'instruction non géré: ${statement.type}`,
            runtime,
            statement.lineNo,
            statement.source
        );
    }

    tutorHintsForType(type) {
        if (type === 'assign') {
            return {
                objective: 'Mettre à jour correctement l\'état du programme.',
                why: 'Chaque affectation change la valeur de référence pour les étapes suivantes.',
                pitfall: 'Erreur classique: écraser une variable utile trop tôt.',
                pitfallCategory: 'mise_a_jour'
            };
        }
        if (type === 'bornes') {
            return {
                objective: 'Vérifier les bornes et la progression de boucle.',
                why: 'Des bornes incorrectes provoquent erreurs d\'indice ou boucles infinies.',
                pitfall: 'Erreur classique: oublier un cas limite sur début/fin.',
                pitfallCategory: 'bornes'
            };
        }
        if (type === 'retour') {
            return {
                objective: 'Conclure avec la bonne valeur de retour.',
                why: 'Le résultat final doit refléter le calcul précédent.',
                pitfall: 'Erreur classique: retourner la mauvaise variable.',
                pitfallCategory: 'retour'
            };
        }
        return {
            objective: 'Évaluer la condition logique courante.',
            why: 'La condition décide du chemin d\'exécution.',
            pitfall: 'Erreur classique: inverser vrai/faux ou la comparaison.',
            pitfallCategory: 'condition'
        };
    }

    applyAssignmentTarget(target, value, frame, runtime, depth) {
        if (target.kind === 'name') {
            frame.locals[target.name] = this.deepClone(value);
            return null;
        }

        const baseValue = frame.locals[target.name];

        // M1: dict key assignment  d[key] = value
        if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) && !(baseValue instanceof Set)) {
            const rawKey = this.evaluateExpression(target.indexExpression, frame, runtime, depth);
            const key = this.normalizeDictKey(rawKey, runtime);
            baseValue[key] = this.deepClone(value);
            frame.locals[target.name] = baseValue;
            return { name: target.name, key, value };
        }

        if (!Array.isArray(baseValue)) {
            throw this.createExpertError(
                'E_TARGET_ARRAY',
                `La cible ${target.name} n'est pas un tableau ni un dictionnaire (ligne ${target.lineNo}).`,
                runtime,
                target.lineNo
            );
        }

        let index = Number(this.evaluateExpression(target.indexExpression, frame, runtime, depth));
        if (!Number.isInteger(index)) {
            throw this.createExpertError(
                'E_INDEX_TYPE',
                `Indice non entier pour ${target.name} (ligne ${target.lineNo}).`,
                runtime,
                target.lineNo
            );
        }
        // P2.5: negative indices always supported
        if (index < 0) {
            index = baseValue.length + index;
        }
        if (index < 0 || index >= baseValue.length) {
            throw this.createExpertError(
                'E_INDEX_RANGE',
                `Indice hors limites pour ${target.name}[${index}] (ligne ${target.lineNo}).`,
                runtime,
                target.lineNo
            );
        }
        baseValue[index] = this.deepClone(value);
        frame.locals[target.name] = baseValue;
        return { name: target.name, index, value };
    }

    pushTraceEvent(runtime, event) {
        const changedKeys = this.computeChangedKeys(event.before, event.after);
        runtime.opCount += 1;
        const payload = {
            id: runtime.events.length + 1,
            ...event,
            changedKeys,
            callStack: runtime.callStack.length > 0 ? [...runtime.callStack] : [] // M2
        };
        runtime.memoryBytes += JSON.stringify(payload).length;
        if (runtime.memoryBytes > runtime.maxMemoryBytes) {
            throw this.createExpertError(
                'E_MEMORY',
                `Limite mémoire trace dépassée (~${Math.round(runtime.memoryBytes / 1024)} Ko).`,
                runtime
            );
        }
        runtime.events.push(payload);
    }

    computeChangedKeys(before, after) {
        const keys = new Set([
            ...Object.keys(before || {}),
            ...Object.keys(after || {})
        ]);
        const changed = [];
        keys.forEach((key) => {
            const left = JSON.stringify(before ? before[key] : undefined);
            const right = JSON.stringify(after ? after[key] : undefined);
            if (left !== right) changed.push(key);
        });
        return changed;
    }

    recordBranch(runtime, branchId, conditionValue) {
        if (!runtime.branchStats[branchId]) {
            runtime.branchStats[branchId] = { true: false, false: false };
        }
        runtime.branchStats[branchId][conditionValue ? 'true' : 'false'] = true;
    }

    computeCoverage(branchStats) {
        const branchEntries = Object.values(branchStats);
        if (!branchEntries.length) {
            return { percent: 100, label: '100% (aucune branche)' };
        }
        let seen = 0;
        branchEntries.forEach((entry) => {
            if (entry.true) seen += 1;
            if (entry.false) seen += 1;
        });
        const total = branchEntries.length * 2;
        const percent = Math.round((seen / total) * 100);
        return { percent, label: `${percent}% (${seen}/${total})` };
    }

    // P3: check if every execution path through `statements` ends with a return

    translateProgramToJavaScript(program) {
        const blocks = program.order.map((name) => this.translateFunction(program.functions[name]));
        return blocks.join('\n\n');
    }

    translateFunction(definition) {
        const header = `function ${definition.name}(${definition.params.join(', ')}) {`;
        const body = this.translateBlock(definition.body, 1);
        return `${header}\n${body}\n}`;
    }

    translateBlock(statements, indentLevel) {
        const indent = '  '.repeat(indentLevel);
        const lines = [];
        statements.forEach((statement) => {
            if (statement.type === 'assign') {
                if (statement.target.kind === 'name') {
                    lines.push(`${indent}let ${statement.target.name} = ${this.translateExpression(statement.expression)};`);
                } else {
                    lines.push(`${indent}${statement.target.name}[${this.translateExpression(statement.target.indexExpression)}] = ${this.translateExpression(statement.expression)};`);
                }
                return;
            }
            if (statement.type === 'expr') {
                lines.push(`${indent}${this.translateExpression(statement.expression)};`);
                return;
            }
            if (statement.type === 'if') {
                statement.branches.forEach((branch, index) => {
                    const keyword = index === 0 ? 'if' : 'else if';
                    lines.push(`${indent}${keyword} (${this.translateExpression(branch.condition)}) {`);
                    lines.push(this.translateBlock(branch.body, indentLevel + 1));
                    lines.push(`${indent}}`);
                });
                if (statement.elseBody) {
                    lines.push(`${indent}else {`);
                    lines.push(this.translateBlock(statement.elseBody, indentLevel + 1));
                    lines.push(`${indent}}`);
                }
                return;
            }
            if (statement.type === 'for') {
                const range = statement.rangeArgs.map((expr) => this.translateExpression(expr));
                let start = '0';
                let end = '0';
                let step = '1';
                if (range.length === 1) {
                    [end] = range;
                } else if (range.length === 2) {
                    [start, end] = range;
                } else if (range.length === 3) {
                    [start, end, step] = range;
                }
                lines.push(`${indent}for (let ${statement.iterator} = ${start}; (${step}) > 0 ? ${statement.iterator} < ${end} : ${statement.iterator} > ${end}; ${statement.iterator} += ${step}) {`);
                lines.push(this.translateBlock(statement.body, indentLevel + 1));
                lines.push(`${indent}}`);
                return;
            }
            if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                if (statement.valueVar) {
                    lines.push(`${indent}for (let ${statement.iterator} = 0; ${statement.iterator} < ${this.translateExpression(statement.iterableExpression)}.length; ${statement.iterator}++) {`);
                    lines.push(`${indent}    const ${statement.valueVar} = ${this.translateExpression(statement.iterableExpression)}[${statement.iterator}];`);
                } else {
                    lines.push(`${indent}for (const ${statement.iterator} of ${this.translateExpression(statement.iterableExpression)}) {`);
                }
                lines.push(this.translateBlock(statement.body, indentLevel + 1));
                lines.push(`${indent}}`);
                return;
            }
            if (statement.type === 'while') {
                lines.push(`${indent}while (${this.translateExpression(statement.condition)}) {`);
                lines.push(this.translateBlock(statement.body, indentLevel + 1));
                lines.push(`${indent}}`);
                return;
            }
            if (statement.type === 'break') {
                lines.push(`${indent}break;`);
                return;
            }
            if (statement.type === 'continue') {
                lines.push(`${indent}continue;`);
                return;
            }
            if (statement.type === 'tuple_assign') {
                const vals = statement.expressions.map((e) => this.translateExpression(e)).join(', ');
                lines.push(`${indent}[${statement.targets.join(', ')}] = [${vals}];`);
                return;
            }
            if (statement.type === 'method_call') {
                const argsStr = statement.argsText ? statement.argsText : '';
                lines.push(`${indent}${statement.obj}.${statement.method}(${argsStr});`);
                return;
            }
            if (statement.type === 'return') {
                if (statement.expression) {
                    lines.push(`${indent}return ${this.translateExpression(statement.expression)};`);
                } else {
                    lines.push(`${indent}return;`);
                }
            }
        });
        return lines.join('\n');
    }

    translateExpression(expression) {
        return String(expression || '')
            .replace(/\band\b/g, '&&')
            .replace(/\bor\b/g, '||')
            .replace(/\bnot\b/g, '!')
            .replace(/\bTrue\b/g, 'true')
            .replace(/\bFalse\b/g, 'false')
            .replace(/\bNone\b/g, 'null')
            .replace(/\blen\(([^()]+)\)/g, '$1.length');
    }

    flattenStatements(statements) {
        const output = [];
        statements.forEach((statement) => {
            output.push(statement);
            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    output.push(...this.flattenStatements(branch.body));
                });
                if (statement.elseBody) output.push(...this.flattenStatements(statement.elseBody));
            }
            if (statement.type === 'for' || statement.type === 'while' || statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                output.push(...this.flattenStatements(statement.body));
            }
        });
        return output;
    }

    parseProgram(source) {
        const rawLines = String(source || '').replace(/\t/g, '    ').split('\n');
        const displayLines = rawLines.map((line, index) => ({ lineNo: index + 1, text: line }));

        const semanticLines = [];
        rawLines.forEach((raw, index) => {
            const lineNo = index + 1;
            const noComment = this.stripComments(raw);
            const trimmedRight = noComment.replace(/\s+$/, '');
            if (!trimmedRight.trim()) return;
            const indent = trimmedRight.match(/^\s*/)[0].length;
            if (indent % 4 !== 0) {
                throw new Error(`Indentation invalide ligne ${lineNo}: utilisez des multiples de 4 espaces.`);
            }
            semanticLines.push({
                lineNo,
                indent,
                text: trimmedRight.trim(),
                source: rawLines[index]
            });
        });

        if (!semanticLines.length) throw new Error('Code vide.');

        let cursor = 0;
        const functions = {};
        const order = [];

        const parseBlock = (expectedIndent) => {
            const block = [];
            while (cursor < semanticLines.length) {
                const line = semanticLines[cursor];
                if (line.indent < expectedIndent) break;
                if (line.indent > expectedIndent) {
                    throw new Error(`Indentation inattendue ligne ${line.lineNo}.`);
                }
                block.push(parseStatement(expectedIndent));
            }
            return block;
        };

        const parseIf = (line, expectedIndent) => {
            const match = line.text.match(/^if\s+(.+):$/);
            if (!match) throw new Error(`if invalide ligne ${line.lineNo}.`);
            cursor += 1;
            const branches = [{
                condition: match[1].trim(),
                body: parseBlock(expectedIndent + 4),
                lineNo: line.lineNo,
                source: line.source
            }];

            while (cursor < semanticLines.length) {
                const next = semanticLines[cursor];
                if (next.indent !== expectedIndent) break;
                const elifMatch = next.text.match(/^elif\s+(.+):$/);
                if (!elifMatch) break;
                cursor += 1;
                branches.push({
                    condition: elifMatch[1].trim(),
                    body: parseBlock(expectedIndent + 4),
                    lineNo: next.lineNo,
                    source: next.source
                });
            }

            let elseBody = null;
            if (cursor < semanticLines.length) {
                const maybeElse = semanticLines[cursor];
                if (maybeElse.indent === expectedIndent && maybeElse.text === 'else:') {
                    cursor += 1;
                    elseBody = parseBlock(expectedIndent + 4);
                }
            }

            return {
                type: 'if',
                lineNo: line.lineNo,
                source: line.source,
                branches,
                elseBody
            };
        };

        const parseStatement = (expectedIndent) => {
            const line = semanticLines[cursor];

            if (/^for\s+/.test(line.text)) {
                const rangeMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s+in\s+range\((.*)\):$/);
                if (rangeMatch) {
                    cursor += 1;
                    const body = parseBlock(expectedIndent + 4);
                    return {
                        type: 'for',
                        lineNo: line.lineNo,
                        source: line.source,
                        iterator: rangeMatch[1],
                        rangeArgs: this.splitTopLevel(rangeMatch[2], ',').map((item) => item.trim()).filter(Boolean),
                        body
                    };
                }

                // L4: for i, val in enumerate(expr):
                const enumMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s+in\s+enumerate\((.+)\):$/);

                if (enumMatch) {
                    cursor += 1;
                    return {
                        type: 'for_enumerate',
                        lineNo: line.lineNo,
                        source: line.source,
                        iterator: enumMatch[1],   // compat alias for analyses
                        indexVar: enumMatch[1],
                        valueVar: enumMatch[2],
                        iterableExpression: enumMatch[3].trim(),
                        body: parseBlock(expectedIndent + 4)
                    };
                }

                // M1: for k, v in expr (déstructuration en paire : d.items(), liste de tuples...)
                const itemsMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s+in\s+(.+):$/);
                if (itemsMatch) {
                    cursor += 1;
                    return {
                        type: 'for_items',
                        lineNo: line.lineNo,
                        source: line.source,
                        iterator: itemsMatch[1],   // alias compat analyses (= keyVar)
                        keyVar: itemsMatch[1],
                        valueVar: itemsMatch[2],
                        iterableExpression: itemsMatch[3].trim(),
                        body: parseBlock(expectedIndent + 4)
                    };
                }

                const iterableMatch = line.text.match(/^for\s+([A-Za-z_]\w*)\s+in\s+(.+):$/);
                if (!iterableMatch) throw new Error(`for invalide ligne ${line.lineNo}.`);
                cursor += 1;
                return {
                    type: 'for_in',
                    lineNo: line.lineNo,
                    source: line.source,
                    iterator: iterableMatch[1],
                    iterableExpression: iterableMatch[2].trim(),
                    body: parseBlock(expectedIndent + 4)
                };
            }

            if (/^while\s+/.test(line.text)) {
                const match = line.text.match(/^while\s+(.+):$/);
                if (!match) throw new Error(`while invalide ligne ${line.lineNo}.`);
                cursor += 1;
                return {
                    type: 'while',
                    lineNo: line.lineNo,
                    source: line.source,
                    condition: match[1].trim(),
                    body: parseBlock(expectedIndent + 4)
                };
            }

            if (/^if\s+/.test(line.text)) {
                return parseIf(line, expectedIndent);
            }

            if (line.text === 'break') {
                cursor += 1;
                return {
                    type: 'break',
                    lineNo: line.lineNo,
                    source: line.source
                };
            }

            // P1.3: continue
            if (line.text === 'continue') {
                cursor += 1;
                return {
                    type: 'continue',
                    lineNo: line.lineNo,
                    source: line.source
                };
            }

            if (/^return\b/.test(line.text)) {
                const match = line.text.match(/^return(?:\s+(.+))?$/);
                cursor += 1;
                return {
                    type: 'return',
                    lineNo: line.lineNo,
                    source: line.source,
                    expression: match[1] ? match[1].trim() : ''
                };
            }

            // P2.1: Tuple destructuring  a, b = b, a
            const tupleAssignMatch = line.text.match(/^([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)+)\s*=\s*(.+)$/);
            if (tupleAssignMatch) {
                cursor += 1;
                const targets = tupleAssignMatch[1].split(',').map((s) => s.trim());
                const expressions = this.splitTopLevel(tupleAssignMatch[2].trim(), ',').map((s) => s.trim()).filter(Boolean);
                return {
                    type: 'tuple_assign',
                    lineNo: line.lineNo,
                    source: line.source,
                    targets,
                    expressions
                };
            }

            // P1.1: Augmented assignments +=, -=, *=, //=, /=, %=
            const augAssign = line.text.match(/^([A-Za-z_]\w*(?:\[[^\]]+\])?)\s*(\+=|-=|\*=|\/\/=|\/=|%=)\s*(.+)$/);
            if (augAssign) {
                cursor += 1;
                const rawTarget = augAssign[1];
                const augOp = augAssign[2].slice(0, -1); // strip trailing '='
                const expanded = `${rawTarget} ${augOp} (${augAssign[3].trim()})`;
                return {
                    type: 'assign',
                    lineNo: line.lineNo,
                    source: line.source,
                    target: this.parseAssignmentTarget(rawTarget, line.lineNo),
                    expression: expanded,
                    augmented: augAssign[2]
                };
            }

            const assign = line.text.match(/^([A-Za-z_]\w*(?:\[[^\]]+\])?)\s*=\s*(.+)$/);
            if (assign) {
                cursor += 1;
                return {
                    type: 'assign',
                    lineNo: line.lineNo,
                    source: line.source,
                    target: this.parseAssignmentTarget(assign[1], line.lineNo),
                    expression: assign[2].trim()
                };
            }

            // P2.2: Method call statement  T.append(x), T.pop(), T.sort()
            const methodCallMatch = line.text.match(/^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\((.*)\)$/);
            if (methodCallMatch) {
                cursor += 1;
                return {
                    type: 'method_call',
                    lineNo: line.lineNo,
                    source: line.source,
                    obj: methodCallMatch[1],
                    method: methodCallMatch[2],
                    argsText: methodCallMatch[3].trim()
                };
            }

            const exprCall = line.text.match(/^[A-Za-z_]\w*\s*\(.*\)$/);
            if (exprCall) {
                cursor += 1;
                return {
                    type: 'expr',
                    lineNo: line.lineNo,
                    source: line.source,
                    expression: line.text
                };
            }

            throw new Error(`Instruction non supportée ligne ${line.lineNo}: ${line.text}`);
        };

        while (cursor < semanticLines.length) {
            const line = semanticLines[cursor];
            if (line.indent !== 0) {
                throw new Error(`Seules les définitions def sont acceptées au niveau racine (ligne ${line.lineNo}).`);
            }

            const def = line.text.match(/^def\s+([A-Za-z_]\w*)\(([^)]*)\):$/);
            if (!def) {
                throw new Error(`Instruction racine non supportée ligne ${line.lineNo}: ${line.text}`);
            }

            const name = def[1];
            const params = this.splitTopLevel(def[2], ',')
                .map((param) => param.trim())
                .filter(Boolean);
            cursor += 1;
            const body = parseBlock(4);
            if (!body.length) {
                throw new Error(`La fonction ${name} est vide (ligne ${line.lineNo}).`);
            }
            functions[name] = {
                type: 'function',
                lineNo: line.lineNo,
                name,
                params,
                body
            };
            order.push(name);
        }

        return { functions, order, displayLines };
    }

    parseAssignmentTarget(raw, lineNo) {
        const indexed = raw.match(/^([A-Za-z_]\w*)\[(.+)\]$/);
        if (indexed) {
            return {
                kind: 'index',
                raw,
                lineNo,
                name: indexed[1],
                indexExpression: indexed[2].trim()
            };
        }
        return {
            kind: 'name',
            raw,
            lineNo,
            name: raw.trim()
        };
    }

    splitTopLevel(text, separator) {
        const output = [];
        let current = '';
        let depthParen = 0;
        let depthBracket = 0;
        let depthBrace = 0;
        let stringQuote = null;
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            const prev = i > 0 ? text[i - 1] : '';
            if (stringQuote) {
                current += char;
                if (char === stringQuote && prev !== '\\') {
                    stringQuote = null;
                }
                continue;
            }
            if (char === '"' || char === '\'') {
                stringQuote = char;
                current += char;
                continue;
            }
            if (char === '(') depthParen += 1;
            if (char === ')') depthParen -= 1;
            if (char === '[') depthBracket += 1;
            if (char === ']') depthBracket -= 1;
            if (char === '{') depthBrace += 1;
            if (char === '}') depthBrace -= 1;
            if (char === separator && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
                output.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        if (current.length || !output.length) output.push(current);
        return output;
    }

    stripComments(line) {
        const index = line.indexOf('#');
        if (index < 0) return line;
        return line.slice(0, index);
    }

    evaluateExpression(expression, frame, runtime, depth) {
        const ast = this.getExpressionAst(expression);
        return this.evaluateAst(ast, frame, runtime, depth);
    }

    getExpressionAst(expression) {
        const key = String(expression || '').trim();
        // P4: LRU cache — move to end on hit
        if (this.expressionCache.has(key)) {
            const val = this.expressionCache.get(key);
            this.expressionCache.delete(key);
            this.expressionCache.set(key, val);
            return val;
        }
        const tokens = this.tokenizeExpression(key);
        let index = 0;

        const peek = () => tokens[index];
        const consume = () => {
            const token = tokens[index];
            index += 1;
            return token;
        };
        const matchValue = (value) => {
            if (peek().value === value) {
                consume();
                return true;
            }
            return false;
        };
        const expectValue = (value) => {
            if (!matchValue(value)) {
                throw new Error(`Expression invalide: '${expression}'.`);
            }
        };

        const parsePrimary = () => {
            const token = peek();
            let node;
            if (token.type === 'number') {
                consume();
                node = { type: 'number', value: token.value };
            } else if (token.type === 'boolean') {
                consume();
                node = { type: 'boolean', value: token.value };
            } else if (token.type === 'null') {
                consume();
                node = { type: 'null', value: null };
            } else if (token.type === 'string') {
                consume();
                node = { type: 'string', value: token.value };
            } else if (token.type === 'fstring') {
                consume();
                node = { type: 'fstring', parts: token.parts }; // M4
            } else if (token.value === '[') {
                consume();
                const items = [];
                if (!matchValue(']')) {
                    do {
                        items.push(parseOr());
                    } while (matchValue(','));
                    expectValue(']');
                }
                node = { type: 'list', items };
            } else if (token.value === '{') {
                consume();
                if (matchValue('}')) {
                    node = { type: 'dict', entries: [] };
                } else {
                    const first = parseOr();
                    if (matchValue(':')) {
                        const entries = [{
                            key: first,
                            value: parseOr()
                        }];
                        while (matchValue(',')) {
                            if (peek().value === '}') break;
                            const key = parseOr();
                            expectValue(':');
                            const value = parseOr();
                            entries.push({ key, value });
                        }
                        expectValue('}');
                        node = { type: 'dict', entries };
                    } else {
                        const items = [first];
                        while (matchValue(',')) {
                            if (peek().value === '}') break;
                            items.push(parseOr());
                        }
                        expectValue('}');
                        node = { type: 'set', items };
                    }
                }
            } else if (token.value === '(') {
                consume();
                if (matchValue(')')) {
                    node = { type: 'tuple', items: [] };
                } else {
                    const first = parseOr();
                    if (matchValue(',')) {
                        const items = [first];
                        while (peek().value !== ')') {
                            items.push(parseOr());
                            if (!matchValue(',')) break;
                        }
                        expectValue(')');
                        node = { type: 'tuple', items };
                    } else {
                        node = first;
                        expectValue(')');
                    }
                }
            } else if (token.type === 'identifier') {
                consume();
                node = { type: 'name', value: token.value };
            } else {
                throw new Error(`Expression non supportée: '${expression}'.`);
            }

            while (true) {
                if (matchValue('(')) {
                    const args = [];
                    if (!matchValue(')')) {
                        do {
                            args.push(parseOr());
                        } while (matchValue(','));
                        expectValue(')');
                    }
                    node = { type: 'call', callee: node, args };
                    continue;
                }
                // L3: method call expression — obj.method(args)
                if (matchValue('.')) {
                    const methodToken = peek();
                    if (methodToken.type !== 'identifier') throw new Error(`Expression invalide: '${expression}'.`);
                    consume();
                    const methodName = methodToken.value;
                    expectValue('(');
                    const margs = [];
                    if (!matchValue(')')) {
                        do {
                            margs.push(parseOr());
                        } while (matchValue(','));
                        expectValue(')');
                    }
                    node = { type: 'method_call_expr', obj: node, method: methodName, args: margs };
                    continue;
                }
                if (matchValue('[')) {
                    // Q3: detect slice T[start:stop] or T[start:stop:step]
                    let startNode = null;
                    if (peek().value !== ':' && peek().value !== ']') {
                        startNode = parseOr();
                    }
                    if (matchValue(':')) {
                        let stopNode = null;
                        let stepNode = null;
                        if (peek().value !== ':' && peek().value !== ']') {
                            stopNode = parseOr();
                        }
                        if (matchValue(':')) {
                            if (peek().value !== ']') stepNode = parseOr();
                        }
                        expectValue(']');
                        node = { type: 'slice', base: node, start: startNode, stop: stopNode, step: stepNode };
                    } else {
                        expectValue(']');
                        node = { type: 'index', base: node, index: startNode };
                    }
                    continue;
                }
                break;
            }

            return node;
        };

        const parseUnary = () => {
            if (matchValue('not')) {
                return { type: 'unary', op: 'not', arg: parseUnary() };
            }
            if (matchValue('-')) {
                return { type: 'unary', op: '-', arg: parseUnary() };
            }
            if (matchValue('+')) {
                return { type: 'unary', op: '+', arg: parseUnary() };
            }
            return parsePrimary();
        };

        const parseMul = () => {
            let node = parseUnary();
            while (['*', '/', '%', '//'].includes(peek().value)) {
                const op = consume().value;
                node = { type: 'binary', op, left: node, right: parseUnary() };
            }
            return node;
        };

        const parseAdd = () => {
            let node = parseMul();
            while (['+', '-'].includes(peek().value)) {
                const op = consume().value;
                node = { type: 'binary', op, left: node, right: parseMul() };
            }
            return node;
        };

        const parseCmp = () => {
            let node = parseAdd();
            while (true) {
                const t = peek();
                if (['==', '!=', '<', '<=', '>', '>='].includes(t.value)) {
                    const op = consume().value;
                    node = { type: 'binary', op, left: node, right: parseAdd() };
                // P1.4: not in
                } else if (t.value === 'not' && tokens[index + 1] && tokens[index + 1].value === 'in') {
                    consume(); consume(); // 'not', 'in'
                    node = { type: 'binary', op: 'not_in', left: node, right: parseAdd() };
                // P1.4: in
                } else if (t.value === 'in') {
                    consume();
                    node = { type: 'binary', op: 'in', left: node, right: parseAdd() };
                } else {
                    break;
                }
            }
            return node;
        };

        const parseAnd = () => {
            let node = parseCmp();
            while (matchValue('and')) {
                node = { type: 'binary', op: 'and', left: node, right: parseCmp() };
            }
            return node;
        };

        const parseOr = () => {
            let node = parseAnd();
            while (matchValue('or')) {
                node = { type: 'binary', op: 'or', left: node, right: parseAnd() };
            }
            return node;
        };

        const ast = parseOr();
        if (peek().type !== 'eof') {
            throw new Error(`Expression invalide: '${expression}'.`);
        }
        // P4: evict oldest entry when cache exceeds 200 entries
        if (this.expressionCache.size >= 200) {
            const oldest = this.expressionCache.keys().next().value;
            this.expressionCache.delete(oldest);
        }
        this.expressionCache.set(key, ast);
        return ast;
    }

    tokenizeExpression(expression) {
        const tokens = [];
        let i = 0;
        const src = String(expression || '');

        const isDigit = (char) => /[0-9]/.test(char);
        const isIdentStart = (char) => /[A-Za-z_]/.test(char);
        const isIdentPart = (char) => /[A-Za-z0-9_]/.test(char);

        while (i < src.length) {
            const char = src[i];
            if (/\s/.test(char)) {
                i += 1;
                continue;
            }

            if (isDigit(char)) {
                let j = i + 1;
                while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
                const number = Number(src.slice(i, j));
                if (Number.isNaN(number)) {
                    throw new Error(`Nombre invalide dans l'expression: ${expression}`);
                }
                tokens.push({ type: 'number', value: number });
                i = j;
                continue;
            }

            if (char === '"' || char === '\'') {
                const quote = char;
                let j = i + 1;
                let value = '';
                while (j < src.length) {
                    const current = src[j];
                    if (current === '\\') {
                        const next = src[j + 1];
                        if (next === 'n') value += '\n';
                        else if (next === 't') value += '\t';
                        else value += next || '';
                        j += 2;
                        continue;
                    }
                    if (current === quote) break;
                    value += current;
                    j += 1;
                }
                if (j >= src.length || src[j] !== quote) {
                    throw new Error(`Chaîne non fermée dans l'expression: ${expression}`);
                }
                tokens.push({ type: 'string', value });
                i = j + 1;
                continue;
            }

            if (isIdentStart(char)) {
                let j = i + 1;
                while (j < src.length && isIdentPart(src[j])) j += 1;
                const word = src.slice(i, j);

                // M4: f-string  f"..." or f'...'
                if (word === 'f' && j < src.length && (src[j] === '"' || src[j] === "'")) {
                    const quote = src[j];
                    let k = j + 1;
                    let raw = '';
                    while (k < src.length) {
                        const ch = src[k];
                        if (ch === '\\') {
                            const next = src[k + 1];
                            if (next === 'n') raw += '\n';
                            else if (next === 't') raw += '\t';
                            else raw += next || '';
                            k += 2;
                            continue;
                        }
                        if (ch === quote) break;
                        raw += ch;
                        k += 1;
                    }
                    if (k >= src.length || src[k] !== quote) {
                        throw new Error('F-string non fermée.');
                    }
                    const parts = [];
                    let buf = '';
                    let m = 0;
                    while (m < raw.length) {
                        if (raw[m] === '{') {
                            if (raw[m + 1] === '{') { buf += '{'; m += 2; continue; }
                            if (buf.length) { parts.push({ kind: 'literal', value: buf }); buf = ''; }
                            let braceDepth = 1;
                            let end = m + 1;
                            while (end < raw.length && braceDepth > 0) {
                                if (raw[end] === '{') braceDepth++;
                                else if (raw[end] === '}') braceDepth--;
                                end++;
                            }
                            parts.push({ kind: 'expr', expr: raw.slice(m + 1, end - 1).trim() });
                            m = end;
                        } else if (raw[m] === '}' && raw[m + 1] === '}') {
                            buf += '}'; m += 2;
                        } else {
                            buf += raw[m]; m++;
                        }
                    }
                    if (buf.length) parts.push({ kind: 'literal', value: buf });
                    tokens.push({ type: 'fstring', parts });
                    i = k + 1;
                    continue;
                }

                if (word === 'True' || word === 'False') {
                    tokens.push({ type: 'boolean', value: word === 'True' });
                } else if (word === 'None') {
                    tokens.push({ type: 'null', value: null });
                } else {
                    tokens.push({ type: 'identifier', value: word });
                }
                i = j;
                continue;
            }

            const twoChars = src.slice(i, i + 2);
            if (['==', '!=', '<=', '>=', '//'].includes(twoChars)) {
                tokens.push({ type: 'operator', value: twoChars });
                i += 2;
                continue;
            }

            if ('+-*/%()[]{}<>,:'.includes(char)) {
                tokens.push({ type: 'operator', value: char });
                i += 1;
                continue;
            }

            // L3: dot operator for method access (e.g. s.upper())
            if (char === '.') {
                tokens.push({ type: 'operator', value: '.' });
                i += 1;
                continue;
            }

            throw new Error(`Caractère non supporté dans expression: '${char}'`);
        }

        tokens.push({ type: 'eof', value: '<eof>' });
        return tokens;
    }

    evaluateAst(node, frame, runtime, depth) {
        if (node.type === 'number' || node.type === 'boolean' || node.type === 'string' || node.type === 'null') return node.value;

        // M4: f-string interpolation
        if (node.type === 'fstring') {
            return (node.parts || []).map((part) => {
                if (part.kind === 'literal') return part.value;
                const val = this.evaluateExpression(part.expr, frame, runtime, depth);
                return this.stringifyShort(val);
            }).join('');
        }

        if (node.type === 'list') {
            return (node.items || []).map((item) => this.evaluateAst(item, frame, runtime, depth));
        }
        if (node.type === 'tuple') {
            return (node.items || []).map((item) => this.evaluateAst(item, frame, runtime, depth));
        }
        if (node.type === 'dict') {
            const output = {};
            (node.entries || []).forEach((entry) => {
                const keyValue = this.evaluateAst(entry.key, frame, runtime, depth);
                const key = this.normalizeDictKey(keyValue, runtime);
                output[key] = this.evaluateAst(entry.value, frame, runtime, depth);
            });
            return output;
        }
        if (node.type === 'set') {
            const set = new Set();
            (node.items || []).forEach((item) => {
                set.add(this.evaluateAst(item, frame, runtime, depth));
            });
            return set;
        }

        if (node.type === 'name') {
            if (Object.prototype.hasOwnProperty.call(frame.locals, node.value)) {
                return frame.locals[node.value];
            }
            // P1.2: built-in sentinels
            if (node.value === 'len') return '__builtin_len__';
            if (node.value === 'abs') return '__builtin_abs__';
            if (node.value === 'min') return '__builtin_min__';
            if (node.value === 'max') return '__builtin_max__';
            if (node.value === 'sum') return '__builtin_sum__';
            if (node.value === 'print') return '__builtin_print__';
            if (runtime.program.functions[node.value]) return `__fn__:${node.value}`;
            throw this.createExpertError('E_NAME', `Variable non définie: '${node.value}'. Vérifiez l'orthographe ou déclarez la variable.`, runtime);
        }

        // Q3: slice T[start:stop] or T[start:stop:step]
        if (node.type === 'slice') {
            const base = this.evaluateAst(node.base, frame, runtime, depth);
            if (!Array.isArray(base) && typeof base !== 'string') {
                throw this.createExpertError('E_SLICE_TYPE', 'Le slicing n\'est supporté que sur les listes et les chaînes.', runtime);
            }
            const len = base.length;
            const evalIdx = (n) => (n === null ? null : Math.trunc(Number(this.evaluateAst(n, frame, runtime, depth))));
            const step = evalIdx(node.step) ?? 1;
            if (step === 0) throw this.createExpertError('E_SLICE_STEP', 'Le pas du slicing ne peut pas être nul.', runtime);
            const normalize = (v, def, isStop) => {
                if (v === null) return def;
                const n = v < 0 ? v + len : v;
                if (step > 0) return isStop ? Math.min(n, len) : Math.max(0, Math.min(n, len - 1));
                return isStop ? Math.max(n, -1) : Math.max(0, Math.min(n, len - 1));
            };
            const startRaw = evalIdx(node.start);
            const stopRaw = evalIdx(node.stop);
            const start = normalize(startRaw, step > 0 ? 0 : len - 1, false);
            const stop = normalize(stopRaw, step > 0 ? len : -1, true);
            const result = [];
            if (step > 0) {
                for (let i = start; i < stop && i < len; i += step) result.push(base[i]);
            } else {
                for (let i = start; i > stop && i >= 0; i += step) result.push(base[i]);
            }
            if (typeof base === 'string') return result.join('');
            return result.map((item) => this.deepClone(item));
        }

        if (node.type === 'index') {
            const base = this.evaluateAst(node.base, frame, runtime, depth);
            const rawIndex = this.evaluateAst(node.index, frame, runtime, depth);

            if (Array.isArray(base) || typeof base === 'string') {
                let index = Number(rawIndex);
                if (!Number.isInteger(index)) {
                    throw this.createExpertError('E_INDEX_TYPE', 'Indice non entier.', runtime);
                }
                // P2.5: negative indices always supported (T[-1] = T[n-1])
                if (index < 0) {
                    const positive = base.length + index;
                    if (positive < 0) {
                        throw this.createExpertError('E_INDEX_RANGE', `Indice négatif ${index} hors limites (taille ${base.length}: le plus petit indice valide est ${-base.length}).`, runtime);
                    }
                    index = positive;
                }
                if (index >= base.length) {
                    throw this.createExpertError('E_INDEX_RANGE', `Indice ${Number(rawIndex)} hors limites (taille: ${base.length}, indices valides: 0 à ${base.length - 1}).`, runtime);
                }
                return base[index];
            }

            if (base && typeof base === 'object' && !Array.isArray(base) && !(base instanceof Set)) {
                const key = this.normalizeDictKey(rawIndex, runtime);
                if (!Object.prototype.hasOwnProperty.call(base, key)) {
                    throw this.createExpertError('E_KEY', `Clé inexistante: ${key}.`, runtime);
                }
                return base[key];
            }

            throw this.createExpertError('E_INDEX_TYPE', 'Indexation sur un type non indexable.', runtime);
        }

        // L3: method call expression — obj.method(args)
        if (node.type === 'method_call_expr') {
            const objVal = this.evaluateAst(node.obj, frame, runtime, depth);
            const margs = node.args.map((a) => this.evaluateAst(a, frame, runtime, depth));
            const m = node.method;
            if (typeof objVal === 'string') {
                if (m === 'upper') return objVal.toUpperCase();
                if (m === 'lower') return objVal.toLowerCase();
                if (m === 'strip') return objVal.trim();
                if (m === 'lstrip') return objVal.trimStart();
                if (m === 'rstrip') return objVal.trimEnd();
                if (m === 'replace') {
                    if (margs.length < 2) throw this.createExpertError('E_METHOD', 'replace() attend 2 arguments (ancien, nouveau).', runtime);
                    return objVal.split(String(margs[0])).join(String(margs[1]));
                }
                if (m === 'split') {
                    const sep = margs.length >= 1 ? String(margs[0]) : null;
                    return sep !== null ? objVal.split(sep) : objVal.split(/\s+/).filter(Boolean);
                }
                if (m === 'startswith') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'startswith() attend 1 argument.', runtime);
                    return objVal.startsWith(String(margs[0]));
                }
                if (m === 'endswith') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'endswith() attend 1 argument.', runtime);
                    return objVal.endsWith(String(margs[0]));
                }
                if (m === 'find') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'find() attend 1 argument.', runtime);
                    return objVal.indexOf(String(margs[0]));
                }
                if (m === 'count') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'count() attend 1 argument.', runtime);
                    const sub = String(margs[0]);
                    let cnt = 0; let pos = 0;
                    while ((pos = objVal.indexOf(sub, pos)) !== -1) { cnt += 1; pos += sub.length; }
                    return cnt;
                }
                if (m === 'join') {
                    if (margs.length < 1 || !Array.isArray(margs[0])) throw this.createExpertError('E_METHOD', 'join() attend une liste.', runtime);
                    return margs[0].map(String).join(objVal);
                }
                throw this.createExpertError('E_METHOD', `Méthode de chaîne inconnue: .${m}(). Méthodes supportées: upper, lower, strip, replace, split, startswith, endswith, find, count, join.`, runtime);
            }
            if (Array.isArray(objVal)) {
                if (m === 'count') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'count() attend 1 argument.', runtime);
                    return objVal.filter((x) => JSON.stringify(x) === JSON.stringify(margs[0])).length;
                }
                if (m === 'index') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'index() attend 1 argument.', runtime);
                    const idx = objVal.findIndex((x) => JSON.stringify(x) === JSON.stringify(margs[0]));
                    if (idx === -1) throw this.createExpertError('E_METHOD', `index(): valeur ${this.stringifyShort(margs[0])} absente de la liste.`, runtime);
                    return idx;
                }
                throw this.createExpertError('E_METHOD', `Méthode de liste inconnue en expression: .${m}(). Méthodes supportées en expression: count, index.`, runtime);
            }
            // M1: méthodes de dictionnaire
            if (objVal && typeof objVal === 'object' && !(objVal instanceof Set)) {
                if (m === 'get') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'dict.get() attend au moins 1 argument.', runtime);
                    const key = this.normalizeDictKey(margs[0], runtime);
                    return Object.prototype.hasOwnProperty.call(objVal, key) ? objVal[key] : (margs.length >= 2 ? margs[1] : null);
                }
                if (m === 'keys') return Object.keys(objVal);
                if (m === 'values') return Object.values(objVal);
                if (m === 'items') return Object.entries(objVal).map(([k, v]) => [k, v]);
                if (m === 'pop') {
                    if (margs.length < 1) throw this.createExpertError('E_METHOD', 'dict.pop() attend au moins 1 argument.', runtime);
                    const key = this.normalizeDictKey(margs[0], runtime);
                    if (!Object.prototype.hasOwnProperty.call(objVal, key)) {
                        if (margs.length >= 2) return margs[1];
                        throw this.createExpertError('E_KEY', `Clé inexistante pour pop(): ${key}.`, runtime);
                    }
                    const val = objVal[key];
                    delete objVal[key];
                    return val;
                }
                throw this.createExpertError('E_METHOD', `Méthode de dictionnaire inconnue: .${m}(). Méthodes supportées: get, keys, values, items, pop.`, runtime);
            }
            throw this.createExpertError('E_METHOD', `Méthode .${m}() non supportée sur ce type (${typeof objVal}).`, runtime);
        }

        if (node.type === 'call') {
            if (!node.callee || node.callee.type !== 'name') {
                throw this.createExpertError('E_CALL', 'Appel de fonction non supporté.', runtime);
            }
            const args = node.args.map((item) => this.evaluateAst(item, frame, runtime, depth));
            const fnName = node.callee.value;
            if (fnName === 'len') {
                const target = args[0];
                if (Array.isArray(target) || typeof target === 'string') return target.length;
                // M1: len(dict)
                if (target && typeof target === 'object' && !(target instanceof Set)) return Object.keys(target).length;
                throw this.createExpertError('E_LEN_TYPE', 'len() attend un tableau, une chaîne ou un dictionnaire.', runtime);
            }
            // P1.2: abs, min, max, sum, print
            if (fnName === 'abs') {
                if (args.length !== 1) throw this.createExpertError('E_ABS_ARGS', 'abs() attend un seul argument numérique.', runtime);
                return Math.abs(this.asFiniteNumber(args[0], runtime, 'abs'));
            }
            if (fnName === 'min') {
                if (args.length === 1 && Array.isArray(args[0])) {
                    if (!args[0].length) throw this.createExpertError('E_MIN_EMPTY', 'min() sur séquence vide.', runtime);
                    return Math.min(...args[0]);
                }
                if (args.length >= 2) return Math.min(...args);
                throw this.createExpertError('E_MIN_ARGS', 'min() attend au moins un argument ou une liste.', runtime);
            }
            if (fnName === 'max') {
                if (args.length === 1 && Array.isArray(args[0])) {
                    if (!args[0].length) throw this.createExpertError('E_MAX_EMPTY', 'max() sur séquence vide.', runtime);
                    return Math.max(...args[0]);
                }
                if (args.length >= 2) return Math.max(...args);
                throw this.createExpertError('E_MAX_ARGS', 'max() attend au moins un argument ou une liste.', runtime);
            }
            if (fnName === 'sum') {
                const items = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
                if (!items.every((x) => typeof x === 'number' && Number.isFinite(x))) {
                    throw this.createExpertError('E_SUM_TYPE', 'sum() attend une liste de nombres.', runtime);
                }
                return items.reduce((acc, x) => acc + x, 0);
            }
            if (fnName === 'print') {
                const text = args.map((a) => this.stringifyShort(a)).join(' ');
                runtime.lastPrintOutput = text;
                return null;
            }
            // L2: type conversion builtins
            if (fnName === 'int') {
                if (args.length !== 1) throw this.createExpertError('E_INT_ARGS', 'int() attend exactement un argument.', runtime);
                const v = args[0];
                if (typeof v === 'number') return Math.trunc(v);
                if (typeof v === 'boolean') return v ? 1 : 0;
                if (typeof v === 'string') {
                    const n = parseInt(v, 10);
                    if (Number.isNaN(n)) throw this.createExpertError('E_INT_CONV', `int(): impossible de convertir "${v}" en entier.`, runtime);
                    return n;
                }
                throw this.createExpertError('E_INT_TYPE', `int() ne supporte pas le type ${typeof v}.`, runtime);
            }
            if (fnName === 'float') {
                if (args.length !== 1) throw this.createExpertError('E_FLOAT_ARGS', 'float() attend exactement un argument.', runtime);
                const v = args[0];
                if (typeof v === 'number') return v;
                if (typeof v === 'boolean') return v ? 1.0 : 0.0;
                if (typeof v === 'string') {
                    const n = parseFloat(v);
                    if (Number.isNaN(n)) throw this.createExpertError('E_FLOAT_CONV', `float(): impossible de convertir "${v}" en nombre.`, runtime);
                    return n;
                }
                throw this.createExpertError('E_FLOAT_TYPE', `float() ne supporte pas le type ${typeof v}.`, runtime);
            }
            if (fnName === 'str') {
                if (args.length !== 1) throw this.createExpertError('E_STR_ARGS', 'str() attend exactement un argument.', runtime);
                const v = args[0];
                if (v === null) return 'None';
                if (typeof v === 'boolean') return v ? 'True' : 'False';
                if (Array.isArray(v)) return `[${v.map((x) => this.stringifyShort(x)).join(', ')}]`;
                return String(v);
            }
            if (fnName === 'bool') {
                if (args.length !== 1) throw this.createExpertError('E_BOOL_ARGS', 'bool() attend exactement un argument.', runtime);
                return this.toTruthValue(args[0]);
            }
            // L1: sorted(T) — returns a new sorted copy (ascending)
            if (fnName === 'sorted') {
                if (args.length < 1) throw this.createExpertError('E_SORTED_ARGS', 'sorted() attend au moins un argument.', runtime);
                const src = args[0];
                if (!Array.isArray(src) && typeof src !== 'string') {
                    throw this.createExpertError('E_SORTED_TYPE', 'sorted() attend une liste ou une chaîne.', runtime);
                }
                const copy = Array.isArray(src) ? src.map((x) => this.deepClone(x)) : [...src];
                copy.sort((a, b) => {
                    if (typeof a === 'number' && typeof b === 'number') return a - b;
                    return String(a).localeCompare(String(b));
                });
                return copy;
            }
            // L1: reversed(T) — returns a new reversed copy
            if (fnName === 'reversed') {
                if (args.length !== 1) throw this.createExpertError('E_REVERSED_ARGS', 'reversed() attend exactement un argument.', runtime);
                const src = args[0];
                if (!Array.isArray(src) && typeof src !== 'string') {
                    throw this.createExpertError('E_REVERSED_TYPE', 'reversed() attend une liste ou une chaîne.', runtime);
                }
                const copy = Array.isArray(src) ? src.map((x) => this.deepClone(x)).reverse() : [...src].reverse();
                return Array.isArray(src) ? copy : copy.join('');
            }
            // Q4: range() as expression → returns a list
            if (fnName === 'range') {
                let rStart = 0, rEnd = 0, rStep = 1;
                if (args.length === 1) {
                    rEnd = Math.trunc(this.asFiniteNumber(args[0], runtime, 'range'));
                } else if (args.length === 2) {
                    rStart = Math.trunc(this.asFiniteNumber(args[0], runtime, 'range'));
                    rEnd = Math.trunc(this.asFiniteNumber(args[1], runtime, 'range'));
                } else if (args.length === 3) {
                    rStart = Math.trunc(this.asFiniteNumber(args[0], runtime, 'range'));
                    rEnd = Math.trunc(this.asFiniteNumber(args[1], runtime, 'range'));
                    rStep = Math.trunc(this.asFiniteNumber(args[2], runtime, 'range'));
                } else {
                    throw this.createExpertError('E_RANGE_ARGS', 'range() attend 1 à 3 arguments.', runtime);
                }
                if (rStep === 0) throw this.createExpertError('E_RANGE_STEP', 'range() : le pas ne peut pas être nul.', runtime);
                const rangeResult = [];
                const guard = 2000;
                if (rStep > 0) {
                    for (let i = rStart; i < rEnd && rangeResult.length < guard; i += rStep) rangeResult.push(i);
                } else {
                    for (let i = rStart; i > rEnd && rangeResult.length < guard; i += rStep) rangeResult.push(i);
                }
                return rangeResult;
            }
            return this.callFunction(fnName, args, runtime, depth + 1);
        }

        if (node.type === 'unary') {
            const value = this.evaluateAst(node.arg, frame, runtime, depth);
            if (node.op === 'not') return !this.toTruthValue(value);
            if (node.op === '-') return -this.asFiniteNumber(value, runtime, 'unaire -');
            if (node.op === '+') return this.asFiniteNumber(value, runtime, 'unaire +');
        }

        if (node.type === 'binary') {
            if (node.op === 'and') {
                const left = this.evaluateAst(node.left, frame, runtime, depth);
                if (!this.toTruthValue(left)) return false;
                const right = this.evaluateAst(node.right, frame, runtime, depth);
                return this.toTruthValue(right);
            }
            if (node.op === 'or') {
                const left = this.evaluateAst(node.left, frame, runtime, depth);
                if (this.toTruthValue(left)) return true;
                const right = this.evaluateAst(node.right, frame, runtime, depth);
                return this.toTruthValue(right);
            }

            const left = this.evaluateAst(node.left, frame, runtime, depth);
            const right = this.evaluateAst(node.right, frame, runtime, depth);

            if (node.op === '+') {
                if (typeof left === 'number' && Number.isFinite(left) && typeof right === 'number' && Number.isFinite(right)) {
                    return left + right;
                }
                if (typeof left === 'string' && typeof right === 'string') {
                    return left + right;
                }
                // P2.3: list concatenation
                if (Array.isArray(left) && Array.isArray(right)) {
                    return [...left.map((item) => this.deepClone(item)), ...right.map((item) => this.deepClone(item))];
                }
                throw this.createExpertError(
                    'E_OP_TYPE',
                    `Opération '+' invalide entre ${Array.isArray(left) ? 'liste' : typeof left} et ${Array.isArray(right) ? 'liste' : typeof right}. Seules les combinaisons nombre+nombre, chaîne+chaîne et liste+liste sont supportées.`,
                    runtime
                );
            }

            if (node.op === '-') {
                const leftNum = this.asFiniteNumber(left, runtime, '-');
                const rightNum = this.asFiniteNumber(right, runtime, '-');
                return leftNum - rightNum;
            }

            if (node.op === '*') {
                // P2.3: string * number and list * number
                if (typeof left === 'string' && typeof right === 'number' && Number.isInteger(right)) {
                    return left.repeat(Math.max(0, right));
                }
                if (typeof left === 'number' && Number.isInteger(left) && typeof right === 'string') {
                    return right.repeat(Math.max(0, left));
                }
                if (Array.isArray(left) && typeof right === 'number' && Number.isInteger(right)) {
                    const result = [];
                    for (let k = 0; k < Math.max(0, right); k += 1) left.forEach((item) => result.push(this.deepClone(item)));
                    return result;
                }
                if (typeof left === 'number' && Number.isInteger(left) && Array.isArray(right)) {
                    const result = [];
                    for (let k = 0; k < Math.max(0, left); k += 1) right.forEach((item) => result.push(this.deepClone(item)));
                    return result;
                }
                const leftNum = this.asFiniteNumber(left, runtime, '*');
                const rightNum = this.asFiniteNumber(right, runtime, '*');
                return leftNum * rightNum;
            }

            if (node.op === '/') {
                const leftNum = this.asFiniteNumber(left, runtime, '/');
                const rightNum = this.asFiniteNumber(right, runtime, '/');
                if (rightNum === 0) {
                    throw this.createExpertError('E_ZERO_DIV', 'Division par zéro interdite.', runtime);
                }
                return leftNum / rightNum;
            }

            if (node.op === '//') {
                const leftNum = this.asFiniteNumber(left, runtime, '//');
                const rightNum = this.asFiniteNumber(right, runtime, '//');
                if (rightNum === 0) {
                    throw this.createExpertError('E_ZERO_DIV', 'Division entière par zéro interdite.', runtime);
                }
                return Math.trunc(leftNum / rightNum);
            }

            if (node.op === '%') {
                const leftNum = this.asFiniteNumber(left, runtime, '%');
                const rightNum = this.asFiniteNumber(right, runtime, '%');
                if (rightNum === 0) {
                    throw this.createExpertError('E_ZERO_DIV', 'Modulo par zéro interdit.', runtime);
                }
                return leftNum % rightNum;
            }

            if (node.op === '==') return left === right;
            if (node.op === '!=') return left !== right;
            if (['<', '<=', '>', '>='].includes(node.op) && runtime.strictTyping) {
                if (typeof left !== typeof right) {
                    throw this.createExpertError(
                        'E_STRICT_COMPARE',
                        `Comparaison stricte invalide entre ${typeof left} et ${typeof right}.`,
                        runtime
                    );
                }
            }
            if (node.op === '<') return left < right;
            if (node.op === '<=') return left <= right;
            if (node.op === '>') return left > right;
            if (node.op === '>=') return left >= right;

            // P1.4: in / not in
            if (node.op === 'in') {
                if (Array.isArray(right)) return right.some((item) => item === left);
                if (typeof right === 'string') return typeof left === 'string' && right.includes(left);
                if (right && typeof right === 'object' && !(right instanceof Set)) return Object.prototype.hasOwnProperty.call(right, String(left));
                throw this.createExpertError('E_IN_TYPE', 'Opérateur in: le membre droit doit être une liste, chaîne ou dictionnaire.', runtime);
            }
            if (node.op === 'not_in') {
                if (Array.isArray(right)) return !right.some((item) => item === left);
                if (typeof right === 'string') return !(typeof left === 'string' && right.includes(left));
                if (right && typeof right === 'object' && !(right instanceof Set)) return !Object.prototype.hasOwnProperty.call(right, String(left));
                throw this.createExpertError('E_IN_TYPE', 'Opérateur not in: le membre droit doit être une liste, chaîne ou dictionnaire.', runtime);
            }
        }

        throw this.createExpertError('E_EXPR', 'Expression non évaluée.', runtime);
    }

    asFiniteNumber(value, runtime, operator) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        throw this.createExpertError(
            'E_OP_TYPE',
            `Opération '${operator}' attend des nombres finis.`,
            runtime
        );
    }

    normalizeDictKey(value, runtime) {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (typeof value === 'boolean') return value ? 'True' : 'False';
        if (value == null) return 'None';
        throw this.createExpertError(
            'E_DICT_KEY',
            'Clé de dictionnaire non supportée (types autorisés: string/number/boolean/None).',
            runtime
        );
    }

    toTruthValue(value) {
        if (value == null) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (value instanceof Set || value instanceof Map) return value.size > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return Boolean(value);
    }

    stringifyShort(value) {
        if (value == null) return 'null';
        if (typeof value === 'boolean') return value ? 'vrai' : 'faux';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return `[${value.map((item) => this.stringifyShort(item)).join(', ')}]`;
        if (value instanceof Set) {
            const items = Array.from(value).slice(0, 6).map((item) => this.stringifyShort(item));
            return `{${items.join(', ')}${value.size > items.length ? ', ...' : ''}}`;
        }
        const entries = Object.entries(value).slice(0, 6);
        const body = entries.map(([key, item]) => `${key}: ${this.stringifyShort(item)}`).join(', ');
        return `{${body}${Object.keys(value).length > entries.length ? ', ...' : ''}}`;
    }
}

if (typeof window !== 'undefined') {
    window.AlgorithmExpertEngine = AlgorithmExpertEngine;
}
