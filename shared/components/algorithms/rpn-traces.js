/**
 * rpn-traces.js - moteur PUR de la notation polonaise inverse : évaluation d'une
 * expression postfixe à la pile et conversion infixe → postfixe (Shunting-yard).
 * Aucune dépendance au DOM : RPNPage ne fait que rejouer les pas.
 *
 * Règles alignées sur le cours `concepts/rpn` (relecture 2b, B6 et B7) :
 * - `^` est associatif à droite, les autres opérateurs à gauche ; on dépile tant que
 *   le sommet est strictement plus prioritaire, ou de même priorité si le nouvel
 *   opérateur est associatif à gauche ;
 * - une erreur (pas assez d'opérandes, token invalide, division par zéro, parenthèse
 *   orpheline, valeurs restantes) ARRÊTE la trace : plus de pas `done` après une erreur ;
 * - le moins unaire n'est pas géré : il est signalé au lieu d'être converti de travers.
 *
 * Forme d'un pas : { type, token, index, stack | output + opStack, info, result? }.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.OEITrace = Object.assign(window.OEITrace || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const OPERATORS = ['+', '-', '*', '/', '^'];

    function isNumber(token) {
        return !isNaN(parseFloat(token)) && isFinite(token);
    }

    function isOperator(token) {
        return OPERATORS.indexOf(token) !== -1;
    }

    function precedence(op) {
        if (op === '+' || op === '-') return 1;
        if (op === '*' || op === '/') return 2;
        if (op === '^') return 3;
        return 0;
    }

    function isRightAssociative(op) {
        return op === '^';
    }

    function applyOp(op, a, b) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return a / b;
            case '^': return Math.pow(a, b);
            default: return 0;
        }
    }

    function tokenizeInfix(expr) {
        const tokens = [];
        let current = '';
        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            if (/\s/.test(char)) {
                if (current) { tokens.push(current); current = ''; }
            } else if ('+-*/^()'.indexOf(char) !== -1) {
                if (current) { tokens.push(current); current = ''; }
                tokens.push(char);
            } else {
                current += char;
            }
        }
        if (current) tokens.push(current);
        return tokens;
    }

    function tokenizePostfix(expr) {
        const trimmed = String(expr == null ? '' : expr).trim();
        return trimmed ? trimmed.split(/\s+/) : [];
    }

    /** Évalue une expression RPN ; la trace s'arrête à la première erreur. */
    function buildRpnEvalTrace(expr) {
        const tokens = tokenizePostfix(expr);
        const steps = [];
        const stack = [];

        const fail = (token, index, info) => {
            steps.push({ type: 'error', token, index, stack: stack.slice(), info });
            return { steps, tokens, error: info, result: null };
        };

        if (tokens.length === 0) {
            return fail(null, 0, 'Erreur : expression vide');
        }

        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            if (isNumber(token)) {
                steps.push({
                    type: 'push', token, index, stack: stack.slice(), info: 'Empiler ' + token
                });
                stack.push(parseFloat(token));
            } else if (isOperator(token)) {
                if (stack.length < 2) {
                    return fail(token, index, 'Erreur : pas assez d\'opérandes pour ' + token
                        + ' (' + stack.length + ' valeur' + (stack.length > 1 ? 's' : '') + ' en pile)');
                }
                const b = stack.pop();
                const a = stack.pop();
                if (token === '/' && b === 0) {
                    stack.push(a, b);
                    return fail(token, index, 'Erreur : division par zéro (' + a + ' / 0)');
                }
                const result = applyOp(token, a, b);
                steps.push({
                    type: 'op', token, index, a, b, result, stack: stack.slice(),
                    info: 'Calculer ' + a + ' ' + token + ' ' + b + ' = ' + result
                });
                stack.push(result);
            } else {
                return fail(token, index, 'Erreur : token invalide « ' + token + ' » (ni nombre ni opérateur)');
            }
        }

        if (stack.length !== 1) {
            return fail(null, tokens.length, 'Erreur : il reste ' + stack.length
                + ' valeurs en pile à la fin (trop d\'opérandes)');
        }
        steps.push({
            type: 'done', token: null, index: tokens.length, stack: stack.slice(), result: stack[0],
            info: 'Résultat final : ' + stack[0]
        });
        return { steps, tokens, error: null, result: stack[0] };
    }

    /** Vérifie qu'une sortie postfixe est bien formée (chaque opérateur trouve 2 opérandes). */
    function validatePostfix(output) {
        let depth = 0;
        for (const token of output) {
            if (isOperator(token)) {
                if (depth < 2) return 'expression infixe mal formée (opérande manquant)';
                depth -= 1;
            } else {
                depth += 1;
            }
        }
        return depth === 1 ? null : 'expression infixe mal formée (opérateur manquant)';
    }

    /** Convertit une expression infixe en postfixe (Shunting-yard), pas à pas. */
    function buildInfixToPostfixTrace(expr) {
        const tokens = tokenizeInfix(String(expr == null ? '' : expr));
        const steps = [];
        const output = [];
        const opStack = [];

        const snapshot = (type, token, index, info) => {
            steps.push({ type, token, index, output: output.slice(), opStack: opStack.slice(), info });
        };
        const fail = (token, index, info) => {
            snapshot('error', token, index, info);
            return { steps, tokens, output, error: info, result: null };
        };

        if (tokens.length === 0) {
            return fail(null, 0, 'Erreur : expression vide');
        }

        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];

            if (isNumber(token)) {
                output.push(token);
                snapshot('number', token, index, 'Nombre ' + token + ' → sortie');
            } else if (token === '(') {
                opStack.push(token);
                snapshot('paren_open', token, index, 'Parenthèse ouvrante → pile');
            } else if (token === ')') {
                while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
                    const op = opStack.pop();
                    output.push(op);
                    snapshot('paren_close_pop', op, index, 'Dépiler ' + op + ' → sortie');
                }
                if (opStack.length === 0) {
                    return fail(token, index, 'Erreur : parenthèse fermante sans ouvrante');
                }
                opStack.pop();
                snapshot('paren_close', token, index, 'Parenthèse fermante : dépiler jusqu\'à (');
            } else if (isOperator(token)) {
                const prev = index > 0 ? tokens[index - 1] : null;
                if (prev === null || isOperator(prev) || prev === '(') {
                    return fail(token, index, token === '-'
                        ? 'Erreur : le moins unaire n\'est pas géré ici, écris (0 - x) à la place'
                        : 'Erreur : opérande manquant avant ' + token);
                }
                while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
                    const top = opStack[opStack.length - 1];
                    const higher = precedence(top) > precedence(token);
                    const samePrecLeft = precedence(top) === precedence(token) && !isRightAssociative(token);
                    if (!higher && !samePrecLeft) break;
                    opStack.pop();
                    output.push(top);
                    snapshot('op_pop', top, index, 'Dépiler ' + top + ' ('
                        + (higher ? 'priorité supérieure à ' + token : 'même priorité que ' + token + ', associatif à gauche')
                        + ') → sortie');
                }
                opStack.push(token);
                const top = opStack.length > 1 ? opStack[opStack.length - 2] : null;
                const keptRight = isRightAssociative(token) && top === token;
                snapshot('op_push', token, index, 'Opérateur ' + token
                    + (keptRight ? ' (associatif à droite : on n\'dépile pas le ' + top + ')' : '') + ' → pile');
            } else {
                return fail(token, index, 'Erreur : token invalide « ' + token + ' » (ni nombre ni opérateur)');
            }
        }

        const last = tokens[tokens.length - 1];
        if (isOperator(last)) {
            return fail(last, tokens.length - 1, 'Erreur : opérande manquant après ' + last);
        }

        while (opStack.length > 0) {
            const op = opStack.pop();
            if (op === '(') {
                return fail(op, tokens.length, 'Erreur : parenthèse ouvrante sans fermante');
            }
            output.push(op);
            snapshot('final_pop', op, tokens.length, 'Dépiler ' + op + ' → sortie');
        }

        const invalid = validatePostfix(output);
        if (invalid) {
            return fail(null, tokens.length, 'Erreur : ' + invalid);
        }
        steps.push({
            type: 'done', token: null, index: tokens.length, output: output.slice(), opStack: [],
            result: output.join(' '), info: 'Conversion terminée : ' + output.join(' ')
        });
        return { steps, tokens, output, error: null, result: output.join(' ') };
    }

    return {
        RPN_OPERATORS: OPERATORS,
        rpnIsNumber: isNumber,
        rpnIsOperator: isOperator,
        rpnPrecedence: precedence,
        rpnIsRightAssociative: isRightAssociative,
        rpnApplyOp: applyOp,
        tokenizeInfix,
        tokenizePostfix,
        buildRpnEvalTrace,
        buildInfixToPostfixTrace
    };
});
