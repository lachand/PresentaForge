class RPNPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.stackViz = new StackVisualizer();
        this.treeViz = new ExpressionTreeVisualizer();

        this.evalSteps = [];
        this.evalStep = -1;
        this.evalPlaying = false;

        this.convSteps = [];
        this.convStep = -1;
        this.convPlaying = false;
    }

    async init() {
        await super.init();

        this.speedCtrlEval = this.createSpeedController('speedSliderEval', 'speedLabelEval');
        this.speedCtrlConv = this.createSpeedController('speedSliderConv', 'speedLabelConv');

        this.cacheDom();
        this.bindEvents();
    }

    cacheDom() {
        this.modeSelect = document.getElementById('modeSelect');
        this.evaluateMode = document.getElementById('evaluateMode');
        this.convertMode = document.getElementById('convertMode');
        this.treeMode = document.getElementById('treeMode');

        this.rpnInput = document.getElementById('rpnInput');
        this.btnEvaluate = document.getElementById('btnEvaluate');
        this.btnStepEval = document.getElementById('btnStepEval');
        this.btnResetEval = document.getElementById('btnResetEval');
        this.exprDisplay = document.getElementById('exprDisplay');
        this.stackZone = document.getElementById('stackZone');
        this.stepInfoEval = document.getElementById('stepInfoEval');
        this.resultDisplay = document.getElementById('resultDisplay');

        this.infixInput = document.getElementById('infixInput');
        this.btnConvert = document.getElementById('btnConvert');
        this.btnStepConv = document.getElementById('btnStepConv');
        this.btnResetConv = document.getElementById('btnResetConv');
        this.outputDisplay = document.getElementById('outputDisplay');
        this.opStackZone = document.getElementById('opStackZone');
        this.stepInfoConv = document.getElementById('stepInfoConv');
        this.convResultDisplay = document.getElementById('convResultDisplay');

        this.treeInput = document.getElementById('treeInput');
        this.btnBuildTree = document.getElementById('btnBuildTree');
        this.treeContainer = document.getElementById('treeContainer');
        this.treeInfix = document.getElementById('treeInfix');
        this.treePostfix = document.getElementById('treePostfix');
    }

    bindEvents() {
        this.modeSelect.addEventListener('change', () => {
            const mode = this.modeSelect.value;
            this.evaluateMode.classList.toggle('hidden', mode !== 'evaluate');
            this.convertMode.classList.toggle('hidden', mode !== 'convert');
            this.treeMode.classList.toggle('hidden', mode !== 'tree');
        });

        this.btnEvaluate.addEventListener('click', () => {
            if (this.evalPlaying) return;
            this.initEval();
            this.evalPlaying = true;
            this.autoPlayEval();
        });

        this.btnStepEval.addEventListener('click', () => {
            if (this.evalPlaying) return;
            if (this.evalStep === -1) this.initEval();
            if (this.evalStep >= this.evalSteps.length - 1) return;
            this.evalStep++;
            this.applyEvalStep(this.evalStep);
        });

        this.btnResetEval.addEventListener('click', () => this.resetEval());

        this.btnConvert.addEventListener('click', () => {
            if (this.convPlaying) return;
            this.initConv();
            this.convPlaying = true;
            this.autoPlayConv();
        });

        this.btnStepConv.addEventListener('click', () => {
            if (this.convPlaying) return;
            if (this.convStep === -1) this.initConv();
            if (this.convStep >= this.convSteps.length - 1) return;
            this.convStep++;
            this.applyConvStep(this.convStep);
        });

        this.btnResetConv.addEventListener('click', () => this.resetConv());
        this.btnBuildTree.addEventListener('click', () => this.buildTree());

        document.querySelectorAll('.example-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const expr = btn.dataset.expr;
                const mode = this.modeSelect.value;
                if (mode === 'evaluate') this.rpnInput.value = expr;
                else if (mode === 'convert') this.infixInput.value = expr;
                else if (mode === 'tree') this.treeInput.value = expr;
            });
        });
    }

    initEval() {
        const expr = this.rpnInput.value.trim();
        const tokens = expr.split(/\s+/);
        this.evalSteps = [];
        this.evalStep = -1;

        const stack = [];

        tokens.forEach((token, index) => {
            if (this.isNumber(token)) {
                this.evalSteps.push({
                    type: 'push',
                    token,
                    index,
                    stack: stack.slice(),
                    info: 'Empiler ' + token
                });
                stack.push(parseFloat(token));
            } else if (this.isOperator(token)) {
                if (stack.length < 2) {
                    this.evalSteps.push({
                        type: 'error',
                        token,
                        index,
                        stack: stack.slice(),
                        info: 'Erreur : pas assez d\'opérandes'
                    });
                    return;
                }
                const b = stack.pop();
                const a = stack.pop();
                const result = this.applyOp(token, a, b);
                this.evalSteps.push({
                    type: 'op',
                    token,
                    index,
                    a,
                    b,
                    result,
                    stack: stack.slice(),
                    info: 'Calculer ' + a + ' ' + token + ' ' + b + ' = ' + result
                });
                stack.push(result);
            }
        });

        if (stack.length === 1) {
            this.evalSteps.push({
                type: 'done',
                token: null,
                index: tokens.length,
                stack: stack.slice(),
                result: stack[0],
                info: 'Résultat final : ' + stack[0]
            });
        } else {
            this.evalSteps.push({
                type: 'error',
                token: null,
                index: tokens.length,
                stack: stack.slice(),
                info: 'Erreur : expression invalide'
            });
        }
    }

    applyEvalStep(stepIndex) {
        const step = this.evalSteps[stepIndex];
        const tokens = this.rpnInput.value.trim().split(/\s+/);

        this.exprDisplay.innerHTML = tokens.map((token, index) => {
            let cls = 'token';
            if (index === step.index) cls += ' current';
            if (this.isOperator(token)) cls += ' operator';
            if (this.isNumber(token)) cls += ' number';
            return '<span class="' + cls + '">' + token + '</span>';
        }).join(' ');

        this.stackViz.renderItems(this.stackZone, step.stack, { itemClass: 'stack-item' });
        this.stepInfoEval.textContent = step.info;

        if (step.type === 'done') {
            this.resultDisplay.textContent = step.result;
        }
    }

    async autoPlayEval() {
        while (this.evalStep < this.evalSteps.length - 1) {
            this.evalStep++;
            this.applyEvalStep(this.evalStep);
            await OEIUtils.sleep(this.speedCtrlEval ? this.speedCtrlEval.getDelay() : 500);
        }
        this.evalPlaying = false;
    }

    resetEval() {
        this.evalSteps = [];
        this.evalStep = -1;
        this.evalPlaying = false;
        this.exprDisplay.innerHTML = '';
        this.stackZone.innerHTML = '<h3>Pile d\'évaluation</h3>';
        this.stepInfoEval.textContent = 'Cliquez sur "Évaluer" ou "Étape suivante"';
        this.resultDisplay.textContent = '--';
    }

    initConv() {
        const tokens = this.tokenizeInfix(this.infixInput.value.trim());
        this.convSteps = [];
        this.convStep = -1;

        const output = [];
        const opStack = [];

        tokens.forEach((token, index) => {
            if (this.isNumber(token)) {
                output.push(token);
                this.convSteps.push({
                    type: 'number',
                    token,
                    index,
                    output: output.slice(),
                    opStack: opStack.slice(),
                    info: 'Nombre ' + token + ' → sortie'
                });
                return;
            }

            if (token === '(') {
                opStack.push(token);
                this.convSteps.push({
                    type: 'paren_open',
                    token,
                    index,
                    output: output.slice(),
                    opStack: opStack.slice(),
                    info: 'Parenthèse ouvrante → pile'
                });
                return;
            }

            if (token === ')') {
                while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
                    const op = opStack.pop();
                    output.push(op);
                    this.convSteps.push({
                        type: 'paren_close_pop',
                        token: op,
                        index,
                        output: output.slice(),
                        opStack: opStack.slice(),
                        info: 'Dépiler ' + op + ' → sortie'
                    });
                }
                if (opStack.length > 0) opStack.pop();
                this.convSteps.push({
                    type: 'paren_close',
                    token,
                    index,
                    output: output.slice(),
                    opStack: opStack.slice(),
                    info: 'Parenthèse fermante : dépiler jusqu\'à ('
                });
                return;
            }

            if (this.isOperator(token)) {
                while (
                    opStack.length > 0
                    && opStack[opStack.length - 1] !== '('
                    && this.precedence(opStack[opStack.length - 1]) >= this.precedence(token)
                ) {
                    const op = opStack.pop();
                    output.push(op);
                    this.convSteps.push({
                        type: 'op_pop',
                        token: op,
                        index,
                        output: output.slice(),
                        opStack: opStack.slice(),
                        info: 'Dépiler ' + op + ' (priorité ≥) → sortie'
                    });
                }

                opStack.push(token);
                this.convSteps.push({
                    type: 'op_push',
                    token,
                    index,
                    output: output.slice(),
                    opStack: opStack.slice(),
                    info: 'Opérateur ' + token + ' → pile'
                });
            }
        });

        while (opStack.length > 0) {
            const op = opStack.pop();
            output.push(op);
            this.convSteps.push({
                type: 'final_pop',
                token: op,
                index: tokens.length,
                output: output.slice(),
                opStack: opStack.slice(),
                info: 'Dépiler ' + op + ' → sortie'
            });
        }

        this.convSteps.push({
            type: 'done',
            token: null,
            index: tokens.length,
            output: output.slice(),
            opStack: [],
            result: output.join(' '),
            info: 'Conversion terminée : ' + output.join(' ')
        });
    }

    applyConvStep(stepIndex) {
        const step = this.convSteps[stepIndex];

        this.outputDisplay.innerHTML = step.output.map((token) => {
            let cls = 'token';
            if (this.isOperator(token)) cls += ' operator';
            if (this.isNumber(token)) cls += ' number';
            return '<span class="' + cls + '">' + token + '</span>';
        }).join(' ');

        this.stackViz.renderItems(this.opStackZone, step.opStack, { itemClass: 'stack-item' });
        this.stepInfoConv.textContent = step.info;

        if (step.type === 'done' && this.convResultDisplay) {
            this.convResultDisplay.textContent = step.result;
        }
    }

    async autoPlayConv() {
        while (this.convStep < this.convSteps.length - 1) {
            this.convStep++;
            this.applyConvStep(this.convStep);
            await OEIUtils.sleep(this.speedCtrlConv ? this.speedCtrlConv.getDelay() : 500);
        }
        this.convPlaying = false;
    }

    resetConv() {
        this.convSteps = [];
        this.convStep = -1;
        this.convPlaying = false;
        this.outputDisplay.innerHTML = '';
        this.opStackZone.innerHTML = '<h3>Pile d\'opérateurs</h3>';
        this.stepInfoConv.textContent = 'Cliquez sur "Convertir" ou "Étape suivante"';
        if (this.convResultDisplay) this.convResultDisplay.textContent = '--';
    }

    buildTree() {
        const expr = this.treeInput.value.trim();
        const postfix = this.infixToPostfix(expr);
        const tree = this.postfixToTree(postfix);

        this.treeInfix.textContent = expr;
        this.treePostfix.textContent = postfix.join(' ');

        this.treeViz.render(this.treeContainer, tree, {
            connectorClass: 'tree-connector',
            nodeWrapperClass: 'tree-node',
            nodeLabelClass: 'tree-node-label',
            childrenClass: 'tree-children',
            getLabel: (node) => node.value,
            getChildren: (node) => {
                const children = [];
                if (node.left) children.push(node.left);
                if (node.right) children.push(node.right);
                return children;
            },
            getNodeTypeClass: (node) => (this.isOperator(node.value) ? 'operator' : 'number')
        });
    }

    postfixToTree(postfix) {
        const stack = [];

        postfix.forEach((token) => {
            if (this.isNumber(token)) {
                stack.push({ value: token, left: null, right: null });
            } else if (this.isOperator(token)) {
                const right = stack.pop();
                const left = stack.pop();
                stack.push({ value: token, left, right });
            }
        });

        return stack.length > 0 ? stack[0] : null;
    }

    isNumber(token) {
        return !isNaN(parseFloat(token)) && isFinite(token);
    }

    isOperator(token) {
        return ['+', '-', '*', '/', '^'].indexOf(token) !== -1;
    }

    precedence(op) {
        if (op === '+' || op === '-') return 1;
        if (op === '*' || op === '/') return 2;
        if (op === '^') return 3;
        return 0;
    }

    applyOp(op, a, b) {
        switch (op) {
            case '+': return a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return a / b;
            case '^': return Math.pow(a, b);
            default: return 0;
        }
    }

    tokenizeInfix(expr) {
        const tokens = [];
        let current = '';

        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            if (char === ' ') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else if ('+-*/^()'.indexOf(char) !== -1) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push(char);
            } else {
                current += char;
            }
        }

        if (current) tokens.push(current);
        return tokens;
    }

    infixToPostfix(expr) {
        const tokens = this.tokenizeInfix(expr);
        const output = [];
        const opStack = [];

        tokens.forEach((token) => {
            if (this.isNumber(token)) {
                output.push(token);
            } else if (token === '(') {
                opStack.push(token);
            } else if (token === ')') {
                while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
                    output.push(opStack.pop());
                }
                if (opStack.length > 0) opStack.pop();
            } else if (this.isOperator(token)) {
                while (
                    opStack.length > 0
                    && opStack[opStack.length - 1] !== '('
                    && this.precedence(opStack[opStack.length - 1]) >= this.precedence(token)
                ) {
                    output.push(opStack.pop());
                }
                opStack.push(token);
            }
        });

        while (opStack.length > 0) output.push(opStack.pop());
        return output;
    }
}

if (typeof window !== 'undefined') {
    window.RPNPage = RPNPage;
}
