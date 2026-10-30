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
        this.evalSteps = OEITrace.buildRpnEvalTrace(this.rpnInput.value).steps;
        this.evalStep = -1;
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
        } else if (step.type === 'error') {
            this.resultDisplay.textContent = 'Erreur';
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
        this.convSteps = OEITrace.buildInfixToPostfixTrace(this.infixInput.value).steps;
        this.convStep = -1;
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

        if (this.convResultDisplay) {
            if (step.type === 'done') this.convResultDisplay.textContent = step.result;
            else if (step.type === 'error') this.convResultDisplay.textContent = 'Erreur';
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
        const trace = OEITrace.buildInfixToPostfixTrace(expr);

        this.treeInfix.textContent = expr;
        if (trace.error) {
            this.treePostfix.textContent = trace.error;
            this.treeContainer.innerHTML = '';
            return;
        }
        const postfix = trace.output;
        const tree = this.postfixToTree(postfix);
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
        return OEITrace.rpnIsNumber(token);
    }

    isOperator(token) {
        return OEITrace.rpnIsOperator(token);
    }
}

if (typeof window !== 'undefined') {
    window.RPNPage = RPNPage;
}
