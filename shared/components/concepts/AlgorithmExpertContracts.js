/**
 * AlgorithmExpertContracts — inférence de contrats, génération de tests et estimation
 * de complexité pour AlgorithmExpertLab.
 *
 * Dépendances injectées via le constructeur :
 *   - getExpressionAst(expr)              : parseur d'expressions (fourni par AlgorithmExpertLab)
 *   - callFunction(name, args, rt, depth) : exécuteur de fonction (fourni par AlgorithmExpertLab)
 *   - getExecutionOptions()               : retourne l'objet executionOptions courant
 *
 * Aucune dépendance DOM.
 */
class AlgorithmExpertContracts {
    constructor({ getExpressionAst, callFunction, getExecutionOptions }) {
        this._getExpressionAst = getExpressionAst;
        this._callFunction = callFunction;
        this._getExecutionOptions = getExecutionOptions;
        this.seed = 0x12345678;
    }

    // ================================================================
    // Inférence du contrat d'entrée
    // ================================================================

    inferInputContract(program, seedInputs = {}) {
        const entry = program.order[0];
        if (!entry) return [];
        const entryDef = program.functions[entry];
        const paramsSet = new Set(entryDef.params);
        const specsByName = {};

        entryDef.params.forEach((name) => {
            specsByName[name] = {
                name,
                expectedType: 'unknown',
                usesNumeric: false,
                usesArray: false,
                usesBoolean: false,
                arrayItemNumeric: false,
                constraints: {
                    integer: false,
                    nonEmpty: false,
                    nonZero: false,
                    minInclusive: null,
                    minExclusive: null,
                    maxInclusive: null,
                    maxExclusive: null
                },
                seedType: this.detectSeedType(seedInputs[name])
            };
        });

        this.inspectStatementsForContract(entryDef.body, specsByName, paramsSet);

        return entryDef.params.map((name) => {
            const spec = specsByName[name];
            if (spec.usesArray) spec.expectedType = 'array';
            else if (spec.usesNumeric) spec.expectedType = 'number';
            else if (spec.usesBoolean) spec.expectedType = 'boolean';
            else if (spec.seedType !== 'unknown') spec.expectedType = spec.seedType;
            else spec.expectedType = 'number';
            return spec;
        });
    }

    detectSeedType(value) {
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'number' && Number.isFinite(value)) return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'string') return 'string';
        return 'unknown';
    }

    inspectStatementsForContract(statements, specsByName, paramsSet) {
        statements.forEach((statement) => {
            if (statement.type === 'assign') {
                if (statement.target && statement.target.kind === 'index' && specsByName[statement.target.name]) {
                    const spec = specsByName[statement.target.name];
                    spec.usesArray = true;
                    spec.constraints.nonEmpty = true;
                    this.inspectExpressionForContract(statement.target.indexExpression, specsByName, paramsSet, {
                        numeric: true,
                        integer: true
                    });
                }
                this.inspectExpressionForContract(statement.expression, specsByName, paramsSet, {});
                return;
            }

            if (statement.type === 'expr') {
                this.inspectExpressionForContract(statement.expression, specsByName, paramsSet, {});
                return;
            }

            if (statement.type === 'if') {
                statement.branches.forEach((branch) => {
                    this.inspectExpressionForContract(branch.condition, specsByName, paramsSet, {
                        condition: true,
                        boolean: true
                    });
                    this.inspectStatementsForContract(branch.body, specsByName, paramsSet);
                });
                if (statement.elseBody) {
                    this.inspectStatementsForContract(statement.elseBody, specsByName, paramsSet);
                }
                return;
            }

            if (statement.type === 'for') {
                statement.rangeArgs.forEach((expr) => {
                    this.inspectExpressionForContract(expr, specsByName, paramsSet, {
                        numeric: true,
                        integer: true,
                        range: true
                    });
                });
                this.inspectStatementsForContract(statement.body, specsByName, paramsSet);
                return;
            }

            if (statement.type === 'for_in' || statement.type === 'for_enumerate' || statement.type === 'for_items') {
                this.inspectExpressionForContract(statement.iterableExpression, specsByName, paramsSet, {
                    iterable: true
                });
                this.inspectStatementsForContract(statement.body, specsByName, paramsSet);
                return;
            }

            if (statement.type === 'while') {
                this.inspectExpressionForContract(statement.condition, specsByName, paramsSet, {
                    condition: true,
                    boolean: true
                });
                this.inspectStatementsForContract(statement.body, specsByName, paramsSet);
                return;
            }

            if (statement.type === 'return' && statement.expression) {
                this.inspectExpressionForContract(statement.expression, specsByName, paramsSet, {});
            }
        });
    }

    inspectExpressionForContract(expression, specsByName, paramsSet, context = {}) {
        let ast;
        try {
            ast = this._getExpressionAst(expression);
        } catch {
            return;
        }

        const asParamName = (node) => (
            node && node.type === 'name' && paramsSet.has(node.value) ? node.value : null
        );
        const asLiteralNumber = (node) => (node && node.type === 'number' ? Number(node.value) : null);
        const markDenominatorNonZero = (node) => {
            if (!node) return;
            if (node.type === 'name' && paramsSet.has(node.value) && specsByName[node.value]) {
                const spec = specsByName[node.value];
                spec.usesNumeric = true;
                spec.constraints.integer = true;
                spec.constraints.nonZero = true;
                return;
            }
            if (node.type === 'unary' && (node.op === '+' || node.op === '-')) {
                markDenominatorNonZero(node.arg);
            }
        };

        const applyComparisonConstraint = (paramName, op, literal, paramOnLeft) => {
            if (!paramName || literal == null || Number.isNaN(literal)) return;
            const spec = specsByName[paramName];
            if (!spec) return;
            spec.usesNumeric = true;
            spec.constraints.integer = true;

            const applyOnLeft = (operator) => {
                if (operator === '>=') {
                    spec.constraints.minInclusive = spec.constraints.minInclusive == null
                        ? literal
                        : Math.max(spec.constraints.minInclusive, literal);
                } else if (operator === '>') {
                    spec.constraints.minExclusive = spec.constraints.minExclusive == null
                        ? literal
                        : Math.max(spec.constraints.minExclusive, literal);
                } else if (operator === '<=') {
                    spec.constraints.maxInclusive = spec.constraints.maxInclusive == null
                        ? literal
                        : Math.min(spec.constraints.maxInclusive, literal);
                } else if (operator === '<') {
                    spec.constraints.maxExclusive = spec.constraints.maxExclusive == null
                        ? literal
                        : Math.min(spec.constraints.maxExclusive, literal);
                }
            };

            if (paramOnLeft) {
                applyOnLeft(op);
                return;
            }

            const reverse = {
                '>': '<',
                '>=': '<=',
                '<': '>',
                '<=': '>='
            };
            applyOnLeft(reverse[op] || op);
        };

        const visit = (node, ctx = {}) => {
            if (!node) return;

            if (node.type === 'name') {
                const spec = specsByName[node.value];
                if (!spec) return;
                if (ctx.numeric) spec.usesNumeric = true;
                if (ctx.integer) spec.constraints.integer = true;
                if (ctx.boolean || ctx.condition) spec.usesBoolean = true;
                if (ctx.iterable) spec.usesArray = true;
                return;
            }

            if (node.type === 'index') {
                const baseName = asParamName(node.base);
                if (baseName && specsByName[baseName]) {
                    const spec = specsByName[baseName];
                    spec.usesArray = true;
                    spec.constraints.nonEmpty = true;
                    if (ctx.numeric) spec.arrayItemNumeric = true;
                }
                visit(node.base, { ...ctx, indexBase: true });
                visit(node.index, { numeric: true, integer: true });
                return;
            }

            if (node.type === 'call') {
                if (node.callee && node.callee.type === 'name' && node.callee.value === 'len' && node.args.length) {
                    const first = node.args[0];
                    const firstName = asParamName(first);
                    if (firstName && specsByName[firstName]) {
                        const spec = specsByName[firstName];
                        spec.usesArray = true;
                    }
                }
                node.args.forEach((arg) => visit(arg, {}));
                return;
            }

            if (node.type === 'list') {
                node.items.forEach((item) => visit(item, {}));
                return;
            }

            if (node.type === 'unary') {
                if (node.op === 'not') visit(node.arg, { boolean: true, condition: true });
                else visit(node.arg, { numeric: true });
                return;
            }

            if (node.type === 'binary') {
                if (['+', '-', '*', '/', '//', '%'].includes(node.op)) {
                    visit(node.left, { numeric: true });
                    visit(node.right, { numeric: true });
                    if (['/', '//', '%'].includes(node.op)) {
                        markDenominatorNonZero(node.right);
                    }
                    return;
                }

                if (['and', 'or'].includes(node.op)) {
                    visit(node.left, { boolean: true, condition: true });
                    visit(node.right, { boolean: true, condition: true });
                    return;
                }

                if (['==', '!=', '<', '<=', '>', '>='].includes(node.op)) {
                    const rightNumber = asLiteralNumber(node.right);
                    const leftNumber = asLiteralNumber(node.left);
                    visit(node.left, { numeric: rightNumber != null });
                    visit(node.right, { numeric: leftNumber != null });
                    const leftName = asParamName(node.left);
                    const rightName = asParamName(node.right);
                    if (leftName && rightNumber != null) {
                        applyComparisonConstraint(leftName, node.op, rightNumber, true);
                    }
                    if (rightName && leftNumber != null) {
                        applyComparisonConstraint(rightName, node.op, leftNumber, false);
                    }
                    return;
                }
            }
        };

        visit(ast, context);
    }

    // ================================================================
    // Résolution de bornes et validation
    // ================================================================

    resolveNumericBounds(spec) {
        let min = spec.constraints.minInclusive;
        let max = spec.constraints.maxInclusive;

        if (spec.constraints.minExclusive != null) {
            const candidate = spec.constraints.integer
                ? spec.constraints.minExclusive + 1
                : spec.constraints.minExclusive + 0.001;
            min = min == null ? candidate : Math.max(min, candidate);
        }

        if (spec.constraints.maxExclusive != null) {
            const candidate = spec.constraints.integer
                ? spec.constraints.maxExclusive - 1
                : spec.constraints.maxExclusive - 0.001;
            max = max == null ? candidate : Math.min(max, candidate);
        }

        return { min, max };
    }

    validateInputsAgainstContract(inputValues, contract) {
        const errors = [];
        contract.forEach((spec) => {
            const key = spec.name;
            const exists = Object.prototype.hasOwnProperty.call(inputValues, key);
            const value = inputValues[key];

            if (!exists) {
                errors.push({
                    code: 'E_MISSING',
                    key,
                    message: `Entrée manquante: ${key}.`
                });
                return;
            }

            if (spec.expectedType === 'array') {
                if (!Array.isArray(value)) {
                    errors.push({
                        code: 'E_TYPE',
                        key,
                        message: `${key} doit être un tableau.`
                    });
                    return;
                }
                if (spec.constraints.nonEmpty && value.length === 0) {
                    errors.push({
                        code: 'E_RANGE',
                        key,
                        message: `${key} ne doit pas être vide pour cet algorithme.`
                    });
                }
                if (spec.arrayItemNumeric && value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
                    errors.push({
                        code: 'E_TYPE',
                        key,
                        message: `${key} doit contenir des valeurs numériques.`
                    });
                }
                return;
            }

            if (spec.expectedType === 'number') {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    errors.push({
                        code: 'E_TYPE',
                        key,
                        message: `${key} doit être un nombre.`
                    });
                    return;
                }
                if (spec.constraints.integer && !Number.isInteger(value)) {
                    errors.push({
                        code: 'E_TYPE',
                        key,
                        message: `${key} doit être un entier.`
                    });
                    return;
                }
                if (spec.constraints.nonZero && value === 0) {
                    errors.push({
                        code: 'E_NON_ZERO',
                        key,
                        message: `${key} ne peut pas valoir 0 (division/modulo).`
                    });
                    return;
                }

                const bounds = this.resolveNumericBounds(spec);
                if (bounds.min != null && value < bounds.min) {
                    errors.push({
                        code: 'E_RANGE',
                        key,
                        message: `${key} doit être >= ${bounds.min}.`
                    });
                }
                if (bounds.max != null && value > bounds.max) {
                    errors.push({
                        code: 'E_RANGE',
                        key,
                        message: `${key} doit être <= ${bounds.max}.`
                    });
                }
                return;
            }

            if (spec.expectedType === 'boolean' && typeof value !== 'boolean') {
                errors.push({
                    code: 'E_TYPE',
                    key,
                    message: `${key} doit être booléen (vrai/faux).`
                });
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    humanizeValidationErrors(errors) {
        if (!errors.length) return [];
        return errors.map((error) => `${error.code}: ${error.message}`);
    }

    // ================================================================
    // Génération de cas de test
    // ================================================================

    buildValidInputs(contract, seedInputs = {}) {
        const output = {};
        contract.forEach((spec) => {
            const seed = seedInputs[spec.name];
            if (spec.expectedType === 'array') {
                let value = Array.isArray(seed) ? this.deepClone(seed) : [3, 1, 4];
                if (spec.constraints.nonEmpty && value.length === 0) value = [1];
                if (spec.arrayItemNumeric) {
                    value = value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : 0));
                }
                output[spec.name] = value;
                return;
            }

            if (spec.expectedType === 'number') {
                let value = (typeof seed === 'number' && Number.isFinite(seed)) ? seed : 0;
                if (spec.constraints.integer) value = Math.trunc(value);
                const bounds = this.resolveNumericBounds(spec);
                if (bounds.min != null && value < bounds.min) value = bounds.min;
                if (bounds.max != null && value > bounds.max) value = bounds.max;
                if (spec.constraints.nonZero && value === 0) {
                    if (bounds.min != null && bounds.min > 0) value = bounds.min;
                    else if (bounds.max != null && bounds.max < 0) value = bounds.max;
                    else value = 1;
                }
                output[spec.name] = value;
                return;
            }

            if (spec.expectedType === 'boolean') {
                output[spec.name] = typeof seed === 'boolean' ? seed : true;
                return;
            }

            output[spec.name] = seed != null ? seed : 0;
        });
        return output;
    }

    classifyValidInputKind(inputValues, contract) {
        const isLimit = contract.some((spec) => {
            const value = inputValues[spec.name];
            if (spec.expectedType === 'array') {
                return Array.isArray(value) && value.length <= 1;
            }
            if (spec.expectedType === 'number') {
                const bounds = this.resolveNumericBounds(spec);
                if (bounds.min != null && value === bounds.min) return true;
                if (bounds.max != null && value === bounds.max) return true;
            }
            return false;
        });
        return isLimit ? 'limite' : 'nominal';
    }

    generateCategorizedTests(contract, inputValues) {
        const baseValid = this.buildValidInputs(contract, inputValues);
        const tests = [];

        tests.push({
            label: 'Nominal',
            category: 'nominal',
            reason: 'Entrées valides et représentatives du cas standard.',
            inputs: this.deepClone(baseValid),
            expected: 'success'
        });

        const limitCase = this.deepClone(baseValid);
        const limitSpec = contract.find((spec) => spec.expectedType === 'number' || spec.expectedType === 'array');
        if (limitSpec) {
            if (limitSpec.expectedType === 'array') {
                limitCase[limitSpec.name] = limitSpec.constraints.nonEmpty ? [1] : [];
            } else {
                const bounds = this.resolveNumericBounds(limitSpec);
                if (bounds.min != null) limitCase[limitSpec.name] = bounds.min;
                else if (bounds.max != null) limitCase[limitSpec.name] = bounds.max;
                else limitCase[limitSpec.name] = limitSpec.constraints.integer ? 0 : 0;
            }
        }
        tests.push({
            label: 'Limite',
            category: 'limite',
            reason: `Teste une borne de ${limitSpec ? limitSpec.name : "l'entr\xE9e principale"}.`,
            inputs: limitCase,
            expected: 'success'
        });

        const trapValidCase = this.deepClone(baseValid);
        const trapValidSpec = contract.find((spec) => spec.expectedType === 'array')
            || contract.find((spec) => spec.expectedType === 'number');
        if (trapValidSpec) {
            if (trapValidSpec.expectedType === 'array') {
                trapValidCase[trapValidSpec.name] = trapValidSpec.arrayItemNumeric
                    ? [0, -1, 0, 7, -3]
                    : ['a', 'a', 'b'];
            } else {
                let value = trapValidCase[trapValidSpec.name];
                const bounds = this.resolveNumericBounds(trapValidSpec);
                value = trapValidSpec.constraints.integer ? Math.trunc(value) : value;
                value = value - 1;
                if (bounds.min != null && value < bounds.min) value = bounds.min;
                if (bounds.max != null && value > bounds.max) value = bounds.max;
                trapValidCase[trapValidSpec.name] = value;
            }
        }
        tests.push({
            label: 'Piège valide',
            category: 'piege_valide',
            reason: 'Entrées valides mais contre-intuitives (doublons, négatifs, distribution atypique).',
            inputs: trapValidCase,
            expected: 'success'
        });

        const trapInvalidCase = this.deepClone(baseValid);
        let invalidReason = 'Contrainte d\'entrée violée.';
        let mutated = false;
        const nonZeroSpec = contract.find((spec) => spec.expectedType === 'number' && spec.constraints.nonZero);
        if (nonZeroSpec) {
            trapInvalidCase[nonZeroSpec.name] = 0;
            invalidReason = `${nonZeroSpec.name} vaut 0 alors qu'il est utilisé comme dénominateur.`;
            mutated = true;
        }

        if (!mutated) {
            for (const spec of contract) {
                if (spec.expectedType === 'array') {
                    trapInvalidCase[spec.name] = spec.constraints.nonEmpty ? [] : 'erreur-type';
                    invalidReason = spec.constraints.nonEmpty
                        ? `${spec.name} vide alors qu'un tableau non vide est attendu.`
                        : `${spec.name} n'est plus un tableau.`;
                    mutated = true;
                    break;
                }
                if (spec.expectedType === 'number') {
                    const bounds = this.resolveNumericBounds(spec);
                    if (bounds.min != null) {
                        trapInvalidCase[spec.name] = bounds.min - 1;
                        invalidReason = `${spec.name} est sous la borne minimale.`;
                    } else {
                        trapInvalidCase[spec.name] = 'erreur-type';
                        invalidReason = `${spec.name} n'est pas un nombre.`;
                    }
                    mutated = true;
                    break;
                }
                if (spec.expectedType === 'boolean') {
                    trapInvalidCase[spec.name] = 'vrai';
                    invalidReason = `${spec.name} n'est pas booléen.`;
                    mutated = true;
                    break;
                }
            }
        }
        if (!mutated && contract[0]) {
            delete trapInvalidCase[contract[0].name];
            invalidReason = `${contract[0].name} manquant.`;
        }

        const invalidValidation = this.validateInputsAgainstContract(trapInvalidCase, contract);
        tests.push({
            label: 'Piège invalide',
            category: 'piege_invalide',
            reason: invalidReason,
            inputs: trapInvalidCase,
            expected: 'error',
            expectedError: invalidValidation.errors[0]?.code || 'E_INVALID'
        });

        const fuzzSeed = this.seed;
        const fuzzInputs = this.buildSeededFuzzInputs(contract, baseValid, fuzzSeed);
        tests.push({
            label: `Fuzz nominal (seed ${fuzzSeed})`,
            category: 'nominal',
            reason: 'Cas pseudo-aléatoire reproductible (seed déterministe).',
            inputs: fuzzInputs,
            expected: 'success'
        });
        this.seed = this.nextSeed(fuzzSeed);

        return tests;
    }

    // ================================================================
    // Générateur pseudo-aléatoire déterministe (LCG)
    // ================================================================

    nextSeed(current) {
        return (current * 1664525 + 1013904223) >>> 0;
    }

    seededRandom(seedState) {
        const next = this.nextSeed(seedState.value);
        seedState.value = next;
        return next / 0x100000000;
    }

    buildSeededFuzzInputs(contract, fallbackInputs, seedValue) {
        const seedState = { value: seedValue >>> 0 };
        const output = {};
        contract.forEach((spec) => {
            if (spec.expectedType === 'number') {
                const bounds = this.resolveNumericBounds(spec);
                let min = bounds.min != null ? bounds.min : -9;
                let max = bounds.max != null ? bounds.max : 9;
                if (min > max) {
                    const tmp = min;
                    min = max;
                    max = tmp;
                }
                let value = min + Math.floor(this.seededRandom(seedState) * ((max - min) + 1));
                if (spec.constraints.integer) value = Math.trunc(value);
                if (spec.constraints.nonZero && value === 0) value = 1;
                output[spec.name] = value;
                return;
            }

            if (spec.expectedType === 'array') {
                const len = spec.constraints.nonEmpty
                    ? (1 + Math.floor(this.seededRandom(seedState) * 5))
                    : Math.floor(this.seededRandom(seedState) * 5);
                const values = [];
                for (let i = 0; i < len; i += 1) {
                    const raw = Math.floor(this.seededRandom(seedState) * 21) - 10;
                    values.push(spec.arrayItemNumeric ? raw : String(raw));
                }
                output[spec.name] = values;
                return;
            }

            if (spec.expectedType === 'boolean') {
                output[spec.name] = this.seededRandom(seedState) >= 0.5;
                return;
            }

            output[spec.name] = fallbackInputs[spec.name];
        });
        return output;
    }

    // ================================================================
    // Estimation de complexité empirique
    // ================================================================

    estimateComplexity(program, entryName, inputValues) {
        const entryDef = program.functions[entryName];
        const arrayParam = entryDef.params.find((param) => Array.isArray(inputValues[param]));
        if (!arrayParam) {
            return { guess: 'Indéterminée (pas de paramètre tableau)', points: [] };
        }

        const sizes = [4, 8, 16, 32];
        const points = [];
        const opts = this._getExecutionOptions();

        for (const size of sizes) {
            const generatedInput = this.deepClone(inputValues);
            generatedInput[arrayParam] = Array.from({ length: size }, (_, index) => ((index * 7) % 11) - 4);
            try {
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
                    strictTyping: Boolean(opts.strictTyping),
                    compatibilityMode: String(opts.compatibilityMode || 'pedagogique'),
                    activeCallSignatures: new Map()
                };
                const args = entryDef.params.map((param) => this.deepClone(generatedInput[param]));
                this._callFunction(entryName, args, runtime, 0);
                points.push({ size, ops: runtime.opCount });
            } catch {
                return { guess: 'Indéterminée (mesure interrompue)', points: [] };
            }
        }

        if (points.length < 2) {
            return { guess: 'Indéterminée', points };
        }

        const ratios = [];
        for (let i = 1; i < points.length; i += 1) {
            const prev = points[i - 1].ops || 1;
            ratios.push(points[i].ops / prev);
        }
        const avgRatio = ratios.reduce((sum, item) => sum + item, 0) / ratios.length;

        let guess = 'Complexité non claire';
        if (avgRatio < 1.35) guess = '≈ O(1)';
        else if (avgRatio < 2.7) guess = '≈ O(n)';
        else if (avgRatio < 5.8) guess = '≈ O(n²)';
        else guess = '≈ O(n³) ou plus';

        return { guess, points };
    }

    // ================================================================
    // Utilitaire interne
    // ================================================================

    deepClone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }
}

window.AlgorithmExpertContracts = AlgorithmExpertContracts;
