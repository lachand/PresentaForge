class RecursionPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.stackViz = new StackVisualizer();
        this.treeViz = new ExpressionTreeVisualizer();

        this.pseudocodes = {
            factorial: [
                { text: 'fonction factorielle(n):', keyword: 'fonction' },
                { text: '    si n <= 1:', keyword: 'si' },
                { text: '        retourner 1', keyword: 'retourner' },
                { text: '    retourner n × factorielle(n - 1)', keyword: 'retourner' }
            ],
            fibonacci: [
                { text: 'fonction fibonacci(n):', keyword: 'fonction' },
                { text: '    si n <= 1:', keyword: 'si' },
                { text: '        retourner n', keyword: 'retourner' },
                { text: '    retourner fibonacci(n-1) + fibonacci(n-2)', keyword: 'retourner' }
            ],
            power: [
                { text: 'fonction puissance(base, exp):', keyword: 'fonction' },
                { text: '    si exp == 0:', keyword: 'si' },
                { text: '        retourner 1', keyword: 'retourner' },
                { text: '    retourner base × puissance(base, exp-1)', keyword: 'retourner' }
            ]
        };

        this.steps = [];
        this.currentStep = -1;
        this.isPlaying = false;
        this.playAbort = false;
        this.treeRoot = null;
        this.totalCalls = 0;
        this.maxDepth = 0;
        this.stackState = [];
        this.treeBuildId = 0;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');

        this.cacheDom();
        this.bindEvents();
        this.onFuncChange();
        this.renderPseudocode();
        this.bindPseudocodeInspector();
        this.setButtonStates('idle');
    }

    cacheDom() {
        this.funcSelect = document.getElementById('funcSelect');
        this.paramSingle = document.getElementById('paramSingle');
        this.paramPower = document.getElementById('paramPower');
        this.paramN = document.getElementById('paramN');
        this.paramBase = document.getElementById('paramBase');
        this.paramExp = document.getElementById('paramExp');

        this.btnStart = document.getElementById('btnStart');
        this.btnStep = document.getElementById('btnStep');
        this.btnReset = document.getElementById('btnReset');

        this.stepCounter = document.getElementById('stepCounter');
        this.stackZone = document.getElementById('stackZone');
        this.stackEmpty = document.getElementById('stackEmpty');
        this.pseudocodeEl = document.getElementById('pseudocode');
        this.treeContainer = document.getElementById('treeContainer');

        this.statCalls = document.getElementById('statCalls');
        this.statDepth = document.getElementById('statDepth');
        this.statResult = document.getElementById('statResult');
    }

    bindEvents() {
        this.funcSelect.addEventListener('change', () => this.onFuncChange());
        this.btnStart.addEventListener('click', () => this.onStart());
        this.btnStep.addEventListener('click', () => this.onStepNext());
        this.btnReset.addEventListener('click', () => this.onReset());
    }

    onFuncChange() {
        const fn = this.funcSelect.value;

        if (fn === 'power') {
            this.paramSingle.classList.add('hidden');
            this.paramPower.classList.remove('hidden');
        } else {
            this.paramSingle.classList.remove('hidden');
            this.paramPower.classList.add('hidden');
        }

        if (fn === 'fibonacci') {
            this.paramN.max = 8;
            this.paramN.min = 0;
            if (parseInt(this.paramN.value, 10) > 8) this.paramN.value = 8;
        } else {
            this.paramN.max = 10;
            this.paramN.min = 0;
        }

        this.renderPseudocode();
        this.onReset();
    }

    renderPseudocode(highlightLine) {
        const fn = this.funcSelect.value;
        const lines = this.pseudocodes[fn] || [];

        this.pseudocodeEl.innerHTML = lines.map((line, index) => {
            const cls = (highlightLine === index) ? 'line highlight' : 'line';
            const lineId = 'recline' + (index + 1);
            let html = this.escapeHtml(line.text);
            if (line.keyword) {
                html = html.replace(line.keyword, '<span class="keyword">' + line.keyword + '</span>');
            }
            return '<span class="' + cls + '" id="' + lineId + '">' + html + '</span>';
        }).join('');

        this.bindPseudocodeInspector();
    }

    bindPseudocodeInspector() {
        if (typeof PseudocodeSupport === 'undefined') return;
        const explainOutput = document.getElementById('explain-output');
        PseudocodeSupport.bindLineInspector(this.data, {
            containerId: 'pseudocode-container',
            explainOutput,
            clickTitle: 'Cliquer pour expliquer cette ligne'
        });
    }

    escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    clampParam(value, min, max) {
        if (isNaN(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    computeSteps() {
        this.steps = [];
        this.treeRoot = null;
        this.totalCalls = 0;
        this.maxDepth = 0;

        let nodeIdCounter = 0;
        const fn = this.funcSelect.value;

        const record = (action, label, depth, nodeId, returnValue, activeLine) => {
            this.steps.push({ action, label, depth, nodeId, returnValue, activeLine });
        };

        if (fn === 'factorial') {
            const nVal = this.clampParam(parseInt(this.paramN.value, 10), 0, 10);
            this.treeRoot = this.buildTreeFactorial(nVal);

            const runFact = (n, depth) => {
                const nodeId = nodeIdCounter++;
                const label = 'fact(' + n + ')';
                this.totalCalls++;
                if (depth + 1 > this.maxDepth) this.maxDepth = depth + 1;

                record('call', label, depth, nodeId, null, 0);

                let result;
                if (n <= 1) {
                    record('check', label, depth, nodeId, null, 1);
                    result = 1;
                    record('return', label, depth, nodeId, result, 2);
                } else {
                    record('check', label, depth, nodeId, null, 1);
                    record('recurse', label, depth, nodeId, null, 3);
                    const sub = runFact(n - 1, depth + 1);
                    result = n * sub;
                    record('return', label, depth, nodeId, result, 3);
                }
                return result;
            };

            runFact(nVal, 0);
            return;
        }

        if (fn === 'fibonacci') {
            const nVal = this.clampParam(parseInt(this.paramN.value, 10), 0, 8);
            this.treeRoot = this.buildTreeFib(nVal);

            const runFib = (n, depth) => {
                const nodeId = nodeIdCounter++;
                const label = 'fib(' + n + ')';
                this.totalCalls++;
                if (depth + 1 > this.maxDepth) this.maxDepth = depth + 1;

                record('call', label, depth, nodeId, null, 0);

                let result;
                if (n <= 1) {
                    record('check', label, depth, nodeId, null, 1);
                    result = n;
                    record('return', label, depth, nodeId, result, 2);
                } else {
                    record('check', label, depth, nodeId, null, 1);
                    record('recurse', label, depth, nodeId, null, 3);
                    const a = runFib(n - 1, depth + 1);
                    const b = runFib(n - 2, depth + 1);
                    result = a + b;
                    record('return', label, depth, nodeId, result, 3);
                }
                return result;
            };

            runFib(nVal, 0);
            return;
        }

        const baseVal = this.clampParam(parseInt(this.paramBase.value, 10), 1, 10);
        const expVal = this.clampParam(parseInt(this.paramExp.value, 10), 0, 10);
        this.treeRoot = this.buildTreePower(baseVal, expVal);

        const runPow = (base, exp, depth) => {
            const nodeId = nodeIdCounter++;
            const label = 'puis(' + base + ',' + exp + ')';
            this.totalCalls++;
            if (depth + 1 > this.maxDepth) this.maxDepth = depth + 1;

            record('call', label, depth, nodeId, null, 0);

            let result;
            if (exp === 0) {
                record('check', label, depth, nodeId, null, 1);
                result = 1;
                record('return', label, depth, nodeId, result, 2);
            } else {
                record('check', label, depth, nodeId, null, 1);
                record('recurse', label, depth, nodeId, null, 3);
                const sub = runPow(base, exp - 1, depth + 1);
                result = base * sub;
                record('return', label, depth, nodeId, result, 3);
            }
            return result;
        };

        runPow(baseVal, expVal, 0);
    }

    buildTreeFactorial(n) {
        this.treeBuildId = 0;
        const build = (value) => {
            const node = { label: 'fact(' + value + ')', id: this.treeBuildId++, children: [], result: null };
            if (value > 1) node.children.push(build(value - 1));
            return node;
        };
        return build(n);
    }

    buildTreeFib(n) {
        this.treeBuildId = 0;
        const build = (value) => {
            const node = { label: 'fib(' + value + ')', id: this.treeBuildId++, children: [], result: null };
            if (value > 1) {
                node.children.push(build(value - 1));
                node.children.push(build(value - 2));
            }
            return node;
        };
        return build(n);
    }

    buildTreePower(base, exp) {
        this.treeBuildId = 0;
        const build = (currentExp) => {
            const node = { label: 'puis(' + base + ',' + currentExp + ')', id: this.treeBuildId++, children: [], result: null };
            if (currentExp > 0) node.children.push(build(currentExp - 1));
            return node;
        };
        return build(exp);
    }

    renderTree() {
        this.treeViz.render(this.treeContainer, this.treeRoot, {
            connectorClass: 'tree-node-connector',
            nodeWrapperClass: 'tree-node',
            nodeLabelClass: 'tree-node-label',
            childrenClass: 'tree-children',
            singleChildrenClass: 'single',
            getLabel: (node) => node.label,
            getChildren: (node) => node.children || [],
            getId: (node) => node.id,
            getNodeTypeClass: () => 'pending'
        });
    }

    updateTreeNode(nodeId, state, value) {
        const el = this.treeViz.getNodeElement(nodeId);
        if (!el) return;

        el.className = 'tree-node-label ' + state;
        if (state === 'resolved' && value !== null && value !== undefined) {
            const baseLabel = el.textContent.split(' =')[0];
            el.textContent = baseLabel + ' = ' + value;
        }
    }

    findTreeNode(node, id) {
        if (!node) return null;
        if (node.id === id) return node;

        for (let i = 0; i < node.children.length; i++) {
            const found = this.findTreeNode(node.children[i], id);
            if (found) return found;
        }

        return null;
    }

    renderStack() {
        this.stackViz.renderFrames(this.stackZone, this.stackState, {
            frameClass: 'stack-frame',
            emptyElement: this.stackEmpty,
            formatter: (frame) => {
                if (frame.status === 'resolved') return frame.label + ' = ' + frame.returnValue;
                return frame.label + (frame.status === 'active' ? '  En cours...' : '');
            }
        });
    }

    applyStep(index) {
        if (index < 0 || index >= this.steps.length) return;
        const step = this.steps[index];

        if (step.action === 'call') {
            this.stackState.push({ label: step.label, status: 'active', returnValue: null });
            for (let i = 0; i < this.stackState.length - 1; i++) {
                if (this.stackState[i].status === 'active') this.stackState[i].status = 'waiting';
            }
            this.updateTreeNode(step.nodeId, 'active', null);
        } else if (step.action === 'check') {
            if (this.stackState.length > 0) {
                this.stackState[this.stackState.length - 1].status = 'active';
            }
        } else if (step.action === 'return') {
            if (this.stackState.length > 0) {
                const top = this.stackState[this.stackState.length - 1];
                top.status = 'resolved';
                top.returnValue = step.returnValue;
            }
            this.updateTreeNode(step.nodeId, 'resolved', step.returnValue);
            const treeNode = this.findTreeNode(this.treeRoot, step.nodeId);
            if (treeNode) treeNode.result = step.returnValue;
        }

        this.renderPseudocode(step.activeLine);
        this.renderStack();
        this.updateStats(index);
        this.updateStepCounter(index);
    }

    popResolvedTop() {
        if (this.stackState.length > 0 && this.stackState[this.stackState.length - 1].status === 'resolved') {
            this.stackState.pop();
            if (this.stackState.length > 0) {
                this.stackState[this.stackState.length - 1].status = 'active';
            }
            this.renderStack();
        }
    }

    updateStats(upToIndex) {
        let calls = 0;
        let depth = 0;
        let currentDepth = 0;
        let lastReturn = null;

        for (let i = 0; i <= upToIndex; i++) {
            const step = this.steps[i];
            if (step.action === 'call') {
                calls++;
                currentDepth = step.depth + 1;
                if (currentDepth > depth) depth = currentDepth;
            }
            if (step.action === 'return') {
                lastReturn = step.returnValue;
            }
        }

        this.statCalls.textContent = calls;
        this.statDepth.textContent = depth;
        this.statResult.textContent = lastReturn !== null ? lastReturn : '--';
    }

    updateStepCounter(index) {
        this.stepCounter.textContent = 'Étape ' + (index + 1) + ' / ' + this.steps.length;
    }

    onReset() {
        this.playAbort = true;
        this.isPlaying = false;
        this.steps = [];
        this.currentStep = -1;
        this.stackState = [];
        this.treeRoot = null;

        this.renderStack();
        this.renderPseudocode();
        this.treeContainer.innerHTML = '';

        this.stepCounter.textContent = '';
        this.statCalls.textContent = '0';
        this.statDepth.textContent = '0';
        this.statResult.textContent = '--';

        this.stackEmpty.classList.remove('hidden');
        this.setButtonStates('idle');
    }

    onStart() {
        if (this.isPlaying) {
            this.playAbort = true;
            this.isPlaying = false;
            this.setButtonStates('paused');
            return;
        }

        if (this.currentStep === -1) {
            this.initExecution();
        }

        this.isPlaying = true;
        this.playAbort = false;
        this.setButtonStates('playing');
        this.autoPlay();
    }

    async autoPlay() {
        while (!this.playAbort && this.currentStep < this.steps.length - 1) {
            this.popResolvedTop();
            await OEIUtils.sleep((this.speedCtrl ? this.speedCtrl.getDelay() : 500) / 2);
            if (this.playAbort) break;

            this.currentStep++;
            this.applyStep(this.currentStep);
            await OEIUtils.sleep(this.speedCtrl ? this.speedCtrl.getDelay() : 500);
        }

        if (!this.playAbort && this.currentStep >= this.steps.length - 1) {
            this.isPlaying = false;
            this.setButtonStates('done');
        }
    }

    onStepNext() {
        if (this.isPlaying) return;

        if (this.currentStep === -1) {
            this.initExecution();
        }

        if (this.currentStep >= this.steps.length - 1) return;

        this.popResolvedTop();
        this.currentStep++;
        this.applyStep(this.currentStep);

        if (this.currentStep >= this.steps.length - 1) this.setButtonStates('done');
        else this.setButtonStates('paused');
    }

    initExecution() {
        this.computeSteps();
        this.renderTree();
        this.currentStep = -1;
        this.stackState = [];
        this.renderStack();
    }

    setButtonStates(mode) {
        if (mode === 'idle') {
            this.btnStart.textContent = 'Démarrer';
            this.btnStart.disabled = false;
            this.btnStep.disabled = false;
            this.btnReset.disabled = false;
            this.funcSelect.disabled = false;
            this.paramN.disabled = false;
            this.paramBase.disabled = false;
            this.paramExp.disabled = false;
            return;
        }

        if (mode === 'playing') {
            this.btnStart.textContent = 'Pause';
            this.btnStart.disabled = false;
            this.btnStep.disabled = true;
            this.btnReset.disabled = false;
            this.funcSelect.disabled = true;
            this.paramN.disabled = true;
            this.paramBase.disabled = true;
            this.paramExp.disabled = true;
            return;
        }

        if (mode === 'paused') {
            this.btnStart.textContent = 'Reprendre';
            this.btnStart.disabled = false;
            this.btnStep.disabled = false;
            this.btnReset.disabled = false;
            this.funcSelect.disabled = true;
            this.paramN.disabled = true;
            this.paramBase.disabled = true;
            this.paramExp.disabled = true;
            return;
        }

        this.btnStart.textContent = 'Terminé';
        this.btnStart.disabled = true;
        this.btnStep.disabled = true;
        this.btnReset.disabled = false;
        this.funcSelect.disabled = false;
        this.paramN.disabled = false;
        this.paramBase.disabled = false;
        this.paramExp.disabled = false;
    }
}

if (typeof window !== 'undefined') {
    window.RecursionPage = RecursionPage;
}
