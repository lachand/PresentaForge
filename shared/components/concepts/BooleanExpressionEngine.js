/**
 * BooleanExpressionEngine
 * - Parse expressions with AND/OR/NOT/XOR/NAND/NOR, &&/||/!/^, parentheses, constants 0/1.
 * - Evaluate an AST for a variable assignment.
 * - Generate truth tables and equivalence checks.
 * - Apply basic algebraic simplification rules step by step.
 */
class BooleanExpressionEngine {
    static get OPERATORS() {
        return new Set(['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR']);
    }

    static tokenize(expression) {
        const src = String(expression == null ? '' : expression);
        const tokens = [];
        let index = 0;

        while (index < src.length) {
            const ch = src[index];

            if (/\s/.test(ch)) {
                index += 1;
                continue;
            }

            if (ch === '(') {
                tokens.push({ type: 'LPAREN', value: ch });
                index += 1;
                continue;
            }

            if (ch === ')') {
                tokens.push({ type: 'RPAREN', value: ch });
                index += 1;
                continue;
            }

            if (ch === '&' && src[index + 1] === '&') {
                tokens.push({ type: 'OP', value: 'AND' });
                index += 2;
                continue;
            }

            if (ch === '|' && src[index + 1] === '|') {
                tokens.push({ type: 'OP', value: 'OR' });
                index += 2;
                continue;
            }

            if (ch === '!') {
                tokens.push({ type: 'OP', value: 'NOT' });
                index += 1;
                continue;
            }

            if (ch === '^') {
                tokens.push({ type: 'OP', value: 'XOR' });
                index += 1;
                continue;
            }

            if (ch === '0' || ch === '1') {
                tokens.push({ type: 'CONST', value: Number(ch) });
                index += 1;
                continue;
            }

            if (/[A-Za-z_]/.test(ch)) {
                let end = index + 1;
                while (end < src.length && /[A-Za-z0-9_]/.test(src[end])) {
                    end += 1;
                }

                const raw = src.slice(index, end);
                const upper = raw.toUpperCase();

                if (BooleanExpressionEngine.OPERATORS.has(upper)) {
                    tokens.push({ type: 'OP', value: upper });
                } else {
                    tokens.push({ type: 'VAR', value: upper });
                }

                index = end;
                continue;
            }

            throw new Error(`Caractere non autorise: ${ch}`);
        }

        tokens.push({ type: 'EOF', value: '' });
        return tokens;
    }

    static parse(expression) {
        const tokens = BooleanExpressionEngine.tokenize(expression);
        return BooleanExpressionEngine.parseTokens(tokens);
    }

    static parseTokens(tokens) {
        const source = Array.isArray(tokens) ? tokens : [];
        let pos = 0;

        const peek = () => source[pos];

        const consume = (type, value) => {
            const token = source[pos];
            if (!token || token.type !== type || (typeof value !== 'undefined' && token.value !== value)) {
                const found = token ? `${token.type}(${token.value})` : 'fin de sequence';
                throw new Error(`Syntaxe invalide. Attendu ${type}${value ? `:${value}` : ''}, trouve ${found}.`);
            }
            pos += 1;
            return token;
        };

        const matchOp = (...names) => {
            const token = peek();
            if (token && token.type === 'OP' && names.includes(token.value)) {
                pos += 1;
                return token.value;
            }
            return null;
        };

        const parseExpressionOr = () => {
            let node = parseExpressionXor();
            let op = matchOp('OR', 'NOR');
            while (op) {
                const right = parseExpressionXor();
                node = { type: op, left: node, right };
                op = matchOp('OR', 'NOR');
            }
            return node;
        };

        const parseExpressionXor = () => {
            let node = parseExpressionAnd();
            let op = matchOp('XOR');
            while (op) {
                const right = parseExpressionAnd();
                node = { type: op, left: node, right };
                op = matchOp('XOR');
            }
            return node;
        };

        const parseExpressionAnd = () => {
            let node = parseExpressionUnary();
            let op = matchOp('AND', 'NAND');
            while (op) {
                const right = parseExpressionUnary();
                node = { type: op, left: node, right };
                op = matchOp('AND', 'NAND');
            }
            return node;
        };

        const parseExpressionUnary = () => {
            const unary = matchOp('NOT');
            if (unary) {
                return { type: 'NOT', arg: parseExpressionUnary() };
            }

            const token = peek();
            if (!token) {
                throw new Error('Expression incomplète.');
            }

            if (token.type === 'LPAREN') {
                consume('LPAREN');
                const node = parseExpressionOr();
                consume('RPAREN');
                return node;
            }

            if (token.type === 'CONST') {
                return { type: 'CONST', value: consume('CONST').value ? 1 : 0 };
            }

            if (token.type === 'VAR') {
                return { type: 'VAR', name: consume('VAR').value };
            }

            throw new Error(`Token inattendu: ${token.value || token.type}`);
        };

        const ast = parseExpressionOr();
        if (peek().type !== 'EOF') {
            throw new Error(`Expression invalide pres de: ${peek().value}`);
        }

        return ast;
    }

    static evaluate(node, context = {}) {
        return BooleanExpressionEngine.evaluateAst(node, BooleanExpressionEngine.normalizeContext(context));
    }

    static normalizeContext(context = {}) {
        const normalized = {};
        if (!context || typeof context !== 'object') return normalized;
        Object.keys(context).forEach((key) => {
            normalized[String(key).toUpperCase()] = context[key];
        });
        return normalized;
    }

    static coerceToBit(value) {
        if (value === true) return 1;
        if (value === false) return 0;
        if (value === 1 || value === '1') return 1;
        if (value === 0 || value === '0') return 0;
        return value ? 1 : 0;
    }

    static evaluateAst(node, normalizedContext = {}) {
        if (!node || typeof node !== 'object') {
            return 0;
        }

        switch (node.type) {
            case 'CONST':
                return node.value ? 1 : 0;
            case 'VAR': {
                const name = String(node.name || '').toUpperCase();
                const raw = Object.prototype.hasOwnProperty.call(normalizedContext, name)
                    ? normalizedContext[name]
                    : undefined;
                return BooleanExpressionEngine.coerceToBit(raw);
            }
            case 'NOT':
                return BooleanExpressionEngine.evaluateAst(node.arg, normalizedContext) ? 0 : 1;
            case 'AND':
                return (BooleanExpressionEngine.evaluateAst(node.left, normalizedContext) && BooleanExpressionEngine.evaluateAst(node.right, normalizedContext)) ? 1 : 0;
            case 'OR':
                return (BooleanExpressionEngine.evaluateAst(node.left, normalizedContext) || BooleanExpressionEngine.evaluateAst(node.right, normalizedContext)) ? 1 : 0;
            case 'XOR':
                return (BooleanExpressionEngine.evaluateAst(node.left, normalizedContext) ^ BooleanExpressionEngine.evaluateAst(node.right, normalizedContext)) ? 1 : 0;
            case 'NAND':
                return (BooleanExpressionEngine.evaluateAst(node.left, normalizedContext) && BooleanExpressionEngine.evaluateAst(node.right, normalizedContext)) ? 0 : 1;
            case 'NOR':
                return (BooleanExpressionEngine.evaluateAst(node.left, normalizedContext) || BooleanExpressionEngine.evaluateAst(node.right, normalizedContext)) ? 0 : 1;
            default:
                return 0;
        }
    }

    static parseAndEvaluate(expression, context = {}) {
        const ast = BooleanExpressionEngine.parse(expression);
        return BooleanExpressionEngine.evaluate(ast, context);
    }

    static normalizeExpression(expressionOrNode) {
        const node = typeof expressionOrNode === 'string'
            ? BooleanExpressionEngine.parse(expressionOrNode)
            : expressionOrNode;
        return BooleanExpressionEngine.nodeToExpression(node);
    }

    static analyze(expressionOrNode, variables = null) {
        const node = typeof expressionOrNode === 'string'
            ? BooleanExpressionEngine.parse(expressionOrNode)
            : BooleanExpressionEngine.cloneNode(expressionOrNode);
        const table = BooleanExpressionEngine.generateTruthTable(node, variables);
        return {
            ast: node,
            variables: table.variables,
            normalizedExpression: BooleanExpressionEngine.nodeToExpression(node),
            table
        };
    }

    static collectVariables(node, out = new Set()) {
        if (!node || typeof node !== 'object') return out;

        if (node.type === 'VAR') {
            out.add(String(node.name || '').toUpperCase());
            return out;
        }

        if (node.type === 'NOT') {
            BooleanExpressionEngine.collectVariables(node.arg, out);
            return out;
        }

        if (BooleanExpressionEngine.isBinaryType(node.type)) {
            BooleanExpressionEngine.collectVariables(node.left, out);
            BooleanExpressionEngine.collectVariables(node.right, out);
        }

        return out;
    }

    static normalizeVariables(vars) {
        const list = (Array.isArray(vars) ? vars : [])
            .map((name) => String(name || '').toUpperCase())
            .filter((name) => /^[A-Z_][A-Z0-9_]*$/.test(name));

        return [...new Set(list)].sort((a, b) => a.localeCompare(b));
    }

    static generateTruthTable(node, variables = null) {
        const vars = BooleanExpressionEngine.normalizeVariables(
            variables || [...BooleanExpressionEngine.collectVariables(node)]
        );

        const rows = [];

        if (vars.length === 0) {
            rows.push({ index: 0, assignment: {}, result: BooleanExpressionEngine.evaluate(node, {}) });
            return { variables: vars, rows };
        }

        const total = 2 ** vars.length;

        for (let index = 0; index < total; index += 1) {
            const assignment = {};
            for (let i = 0; i < vars.length; i += 1) {
                const bit = (index >> (vars.length - 1 - i)) & 1;
                assignment[vars[i]] = bit;
            }

            rows.push({
                index,
                assignment,
                result: BooleanExpressionEngine.evaluate(node, assignment)
            });
        }

        return { variables: vars, rows };
    }

    static areEquivalent(exprA, exprB) {
        const left = typeof exprA === 'string' ? BooleanExpressionEngine.parse(exprA) : exprA;
        const right = typeof exprB === 'string' ? BooleanExpressionEngine.parse(exprB) : exprB;

        const vars = BooleanExpressionEngine.normalizeVariables([
            ...BooleanExpressionEngine.collectVariables(left),
            ...BooleanExpressionEngine.collectVariables(right)
        ]);

        const total = 2 ** vars.length;

        for (let index = 0; index < total; index += 1) {
            const assignment = {};
            for (let i = 0; i < vars.length; i += 1) {
                assignment[vars[i]] = (index >> (vars.length - 1 - i)) & 1;
            }

            const a = BooleanExpressionEngine.evaluate(left, assignment);
            const b = BooleanExpressionEngine.evaluate(right, assignment);
            if (a !== b) {
                return {
                    equivalent: false,
                    counterExample: assignment,
                    left: a,
                    right: b,
                    variables: vars
                };
            }
        }

        return { equivalent: true, variables: vars };
    }

    static isBinaryType(type) {
        return type === 'AND' || type === 'OR' || type === 'XOR' || type === 'NAND' || type === 'NOR';
    }

    static cloneNode(node) {
        if (!node || typeof node !== 'object') return node;

        if (node.type === 'VAR') {
            return { type: 'VAR', name: node.name };
        }

        if (node.type === 'CONST') {
            return { type: 'CONST', value: node.value ? 1 : 0 };
        }

        if (node.type === 'NOT') {
            return { type: 'NOT', arg: BooleanExpressionEngine.cloneNode(node.arg) };
        }

        if (BooleanExpressionEngine.isBinaryType(node.type)) {
            return {
                type: node.type,
                left: BooleanExpressionEngine.cloneNode(node.left),
                right: BooleanExpressionEngine.cloneNode(node.right)
            };
        }

        return JSON.parse(JSON.stringify(node));
    }

    static nodeEquals(a, b) {
        if (!a || !b || a.type !== b.type) return false;

        switch (a.type) {
            case 'CONST':
                return (a.value ? 1 : 0) === (b.value ? 1 : 0);
            case 'VAR':
                return String(a.name || '').toUpperCase() === String(b.name || '').toUpperCase();
            case 'NOT':
                return BooleanExpressionEngine.nodeEquals(a.arg, b.arg);
            default:
                if (!BooleanExpressionEngine.isBinaryType(a.type)) return false;
                return BooleanExpressionEngine.nodeEquals(a.left, b.left)
                    && BooleanExpressionEngine.nodeEquals(a.right, b.right);
        }
    }

    static getPrecedence(type) {
        switch (type) {
            case 'OR':
            case 'NOR':
                return 1;
            case 'XOR':
                return 2;
            case 'AND':
            case 'NAND':
                return 3;
            case 'NOT':
                return 4;
            default:
                return 5;
        }
    }

    static nodeToExpression(node, parentPrecedence = 0, isRightChild = false) {
        if (!node || typeof node !== 'object') return '';

        if (node.type === 'CONST') {
            return node.value ? '1' : '0';
        }

        if (node.type === 'VAR') {
            return String(node.name || '').toUpperCase();
        }

        if (node.type === 'NOT') {
            const arg = node.arg;
            const argExpr = BooleanExpressionEngine.nodeToExpression(arg, BooleanExpressionEngine.getPrecedence('NOT'));
            const needParens = arg && (BooleanExpressionEngine.isBinaryType(arg.type) || arg.type === 'NOT');
            const body = needParens ? `(${argExpr})` : argExpr;
            const expr = `NOT ${body}`;
            const ownPrec = BooleanExpressionEngine.getPrecedence('NOT');
            if (ownPrec < parentPrecedence) return `(${expr})`;
            return expr;
        }

        if (BooleanExpressionEngine.isBinaryType(node.type)) {
            const ownPrec = BooleanExpressionEngine.getPrecedence(node.type);
            const leftPrec = BooleanExpressionEngine.getPrecedence(node.left?.type);
            const rightPrec = BooleanExpressionEngine.getPrecedence(node.right?.type);

            const leftExprRaw = BooleanExpressionEngine.nodeToExpression(node.left, ownPrec, false);
            const rightExprRaw = BooleanExpressionEngine.nodeToExpression(node.right, ownPrec, true);

            const leftNeedParens = leftPrec < ownPrec;
            const rightNeedParens = rightPrec < ownPrec || (rightPrec === ownPrec && isRightChild && node.right?.type !== node.type);

            const leftExpr = leftNeedParens ? `(${leftExprRaw})` : leftExprRaw;
            const rightExpr = rightNeedParens ? `(${rightExprRaw})` : rightExprRaw;

            const expr = `${leftExpr} ${node.type} ${rightExpr}`;
            if (ownPrec < parentPrecedence) return `(${expr})`;
            return expr;
        }

        return '';
    }

    static isConst(node, value) {
        return node && node.type === 'CONST' && (node.value ? 1 : 0) === value;
    }

    static isNegationOf(node, target) {
        return node && node.type === 'NOT' && BooleanExpressionEngine.nodeEquals(node.arg, target);
    }

    static applyRuleAtNode(node) {
        if (!node || typeof node !== 'object') {
            return { changed: false, node };
        }

        if (node.type === 'NAND') {
            return {
                changed: true,
                node: {
                    type: 'NOT',
                    arg: {
                        type: 'AND',
                        left: BooleanExpressionEngine.cloneNode(node.left),
                        right: BooleanExpressionEngine.cloneNode(node.right)
                    }
                },
                rule: {
                    name: 'Reecriture NAND',
                    description: 'NAND(X, Y) devient NOT (X AND Y).'
                }
            };
        }

        if (node.type === 'NOR') {
            return {
                changed: true,
                node: {
                    type: 'NOT',
                    arg: {
                        type: 'OR',
                        left: BooleanExpressionEngine.cloneNode(node.left),
                        right: BooleanExpressionEngine.cloneNode(node.right)
                    }
                },
                rule: {
                    name: 'Reecriture NOR',
                    description: 'NOR(X, Y) devient NOT (X OR Y).'
                }
            };
        }

        if (node.type === 'NOT' && BooleanExpressionEngine.isConst(node.arg, 0)) {
            return {
                changed: true,
                node: { type: 'CONST', value: 1 },
                rule: {
                    name: 'Negation constante',
                    description: 'NOT 0 = 1.'
                }
            };
        }

        if (node.type === 'NOT' && BooleanExpressionEngine.isConst(node.arg, 1)) {
            return {
                changed: true,
                node: { type: 'CONST', value: 0 },
                rule: {
                    name: 'Negation constante',
                    description: 'NOT 1 = 0.'
                }
            };
        }

        if (node.type === 'NOT' && node.arg && node.arg.type === 'NOT') {
            return {
                changed: true,
                node: BooleanExpressionEngine.cloneNode(node.arg.arg),
                rule: {
                    name: 'Double negation',
                    description: 'NOT (NOT X) = X.'
                }
            };
        }

        if (node.type === 'NOT' && node.arg && node.arg.type === 'AND') {
            return {
                changed: true,
                node: {
                    type: 'OR',
                    left: { type: 'NOT', arg: BooleanExpressionEngine.cloneNode(node.arg.left) },
                    right: { type: 'NOT', arg: BooleanExpressionEngine.cloneNode(node.arg.right) }
                },
                rule: {
                    name: 'De Morgan',
                    description: 'NOT (A AND B) = (NOT A) OR (NOT B).'
                }
            };
        }

        if (node.type === 'NOT' && node.arg && node.arg.type === 'OR') {
            return {
                changed: true,
                node: {
                    type: 'AND',
                    left: { type: 'NOT', arg: BooleanExpressionEngine.cloneNode(node.arg.left) },
                    right: { type: 'NOT', arg: BooleanExpressionEngine.cloneNode(node.arg.right) }
                },
                rule: {
                    name: 'De Morgan',
                    description: 'NOT (A OR B) = (NOT A) AND (NOT B).'
                }
            };
        }

        if (!BooleanExpressionEngine.isBinaryType(node.type)) {
            return { changed: false, node };
        }

        const left = node.left;
        const right = node.right;

        if ((node.type === 'AND' || node.type === 'OR') && BooleanExpressionEngine.nodeEquals(left, right)) {
            return {
                changed: true,
                node: BooleanExpressionEngine.cloneNode(left),
                rule: {
                    name: 'Idempotence',
                    description: node.type === 'AND' ? 'X AND X = X.' : 'X OR X = X.'
                }
            };
        }

        if (node.type === 'AND' && (BooleanExpressionEngine.isNegationOf(left, right) || BooleanExpressionEngine.isNegationOf(right, left))) {
            return {
                changed: true,
                node: { type: 'CONST', value: 0 },
                rule: {
                    name: 'Complementarite',
                    description: 'X AND (NOT X) = 0.'
                }
            };
        }

        if (node.type === 'OR' && (BooleanExpressionEngine.isNegationOf(left, right) || BooleanExpressionEngine.isNegationOf(right, left))) {
            return {
                changed: true,
                node: { type: 'CONST', value: 1 },
                rule: {
                    name: 'Complementarite',
                    description: 'X OR (NOT X) = 1.'
                }
            };
        }

        if (node.type === 'AND') {
            if (BooleanExpressionEngine.isConst(left, 0) || BooleanExpressionEngine.isConst(right, 0)) {
                return {
                    changed: true,
                    node: { type: 'CONST', value: 0 },
                    rule: {
                        name: 'Domination',
                        description: 'X AND 0 = 0.'
                    }
                };
            }

            if (BooleanExpressionEngine.isConst(left, 1)) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(right),
                    rule: {
                        name: 'Element neutre',
                        description: '1 AND X = X.'
                    }
                };
            }

            if (BooleanExpressionEngine.isConst(right, 1)) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(left),
                    rule: {
                        name: 'Element neutre',
                        description: 'X AND 1 = X.'
                    }
                };
            }

            if (left && left.type === 'OR' && (BooleanExpressionEngine.nodeEquals(left.left, right) || BooleanExpressionEngine.nodeEquals(left.right, right))) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(right),
                    rule: {
                        name: 'Absorption',
                        description: '(X OR Y) AND X = X.'
                    }
                };
            }

            if (right && right.type === 'OR' && (BooleanExpressionEngine.nodeEquals(right.left, left) || BooleanExpressionEngine.nodeEquals(right.right, left))) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(left),
                    rule: {
                        name: 'Absorption',
                        description: 'X AND (X OR Y) = X.'
                    }
                };
            }
        }

        if (node.type === 'OR') {
            if (BooleanExpressionEngine.isConst(left, 1) || BooleanExpressionEngine.isConst(right, 1)) {
                return {
                    changed: true,
                    node: { type: 'CONST', value: 1 },
                    rule: {
                        name: 'Domination',
                        description: 'X OR 1 = 1.'
                    }
                };
            }

            if (BooleanExpressionEngine.isConst(left, 0)) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(right),
                    rule: {
                        name: 'Element neutre',
                        description: '0 OR X = X.'
                    }
                };
            }

            if (BooleanExpressionEngine.isConst(right, 0)) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(left),
                    rule: {
                        name: 'Element neutre',
                        description: 'X OR 0 = X.'
                    }
                };
            }

            if (left && left.type === 'AND' && (BooleanExpressionEngine.nodeEquals(left.left, right) || BooleanExpressionEngine.nodeEquals(left.right, right))) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(right),
                    rule: {
                        name: 'Absorption',
                        description: '(X AND Y) OR X = X.'
                    }
                };
            }

            if (right && right.type === 'AND' && (BooleanExpressionEngine.nodeEquals(right.left, left) || BooleanExpressionEngine.nodeEquals(right.right, left))) {
                return {
                    changed: true,
                    node: BooleanExpressionEngine.cloneNode(left),
                    rule: {
                        name: 'Absorption',
                        description: 'X OR (X AND Y) = X.'
                    }
                };
            }
        }

        return { changed: false, node };
    }

    static applySingleRewrite(node) {
        const direct = BooleanExpressionEngine.applyRuleAtNode(node);
        if (direct.changed) {
            return direct;
        }

        if (node && node.type === 'NOT') {
            const child = BooleanExpressionEngine.applySingleRewrite(node.arg);
            if (child.changed) {
                return {
                    changed: true,
                    node: { type: 'NOT', arg: child.node },
                    rule: child.rule
                };
            }
        }

        if (node && BooleanExpressionEngine.isBinaryType(node.type)) {
            const left = BooleanExpressionEngine.applySingleRewrite(node.left);
            if (left.changed) {
                return {
                    changed: true,
                    node: {
                        type: node.type,
                        left: left.node,
                        right: BooleanExpressionEngine.cloneNode(node.right)
                    },
                    rule: left.rule
                };
            }

            const right = BooleanExpressionEngine.applySingleRewrite(node.right);
            if (right.changed) {
                return {
                    changed: true,
                    node: {
                        type: node.type,
                        left: BooleanExpressionEngine.cloneNode(node.left),
                        right: right.node
                    },
                    rule: right.rule
                };
            }
        }

        return { changed: false, node };
    }

    static simplify(expressionOrNode, maxSteps = 24) {
        let current = typeof expressionOrNode === 'string'
            ? BooleanExpressionEngine.parse(expressionOrNode)
            : BooleanExpressionEngine.cloneNode(expressionOrNode);

        const steps = [];

        for (let i = 0; i < maxSteps; i += 1) {
            const before = BooleanExpressionEngine.nodeToExpression(current);
            const rewrite = BooleanExpressionEngine.applySingleRewrite(current);
            if (!rewrite.changed) {
                break;
            }

            const nextNode = rewrite.node;
            const after = BooleanExpressionEngine.nodeToExpression(nextNode);

            steps.push({
                rule: rewrite.rule?.name || 'Transformation',
                description: rewrite.rule?.description || 'Regle appliquee.',
                before,
                after,
                node: BooleanExpressionEngine.cloneNode(nextNode)
            });

            current = nextNode;
        }

        return {
            node: current,
            expression: BooleanExpressionEngine.nodeToExpression(current),
            steps
        };
    }

    static selfCheckSuite() {
        const equivalenceCases = [
            ['NOT (A AND B)', '(NOT A) OR (NOT B)'],
            ['NOT (A OR B)', '(NOT A) AND (NOT B)'],
            ['A OR (A AND B)', 'A'],
            ['A AND (A OR B)', 'A'],
            ['A XOR B', '(A AND NOT B) OR (NOT A AND B)']
        ];
        const nonEquivalenceCases = [
            ['A OR B', 'A AND B'],
            ['A XOR B', 'A OR B'],
            ['NOT (A OR B)', '(NOT A) OR (NOT B)']
        ];

        const passed = [];
        const failed = [];

        equivalenceCases.forEach(([left, right]) => {
            const verdict = BooleanExpressionEngine.areEquivalent(left, right);
            if (verdict.equivalent) passed.push({ type: 'equivalent', left, right });
            else failed.push({ type: 'equivalent', left, right, verdict });
        });

        nonEquivalenceCases.forEach(([left, right]) => {
            const verdict = BooleanExpressionEngine.areEquivalent(left, right);
            if (!verdict.equivalent) passed.push({ type: 'non-equivalent', left, right });
            else failed.push({ type: 'non-equivalent', left, right, verdict });
        });

        return {
            ok: failed.length === 0,
            passed,
            failed
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BooleanExpressionEngine;
}

if (typeof window !== 'undefined') {
    window.BooleanExpressionEngine = BooleanExpressionEngine;
}
