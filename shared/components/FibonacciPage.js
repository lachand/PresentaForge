class FibonacciPage extends SimulationPage {
    constructor(dataPath) {
        super(dataPath);
        this.visualizer = null;
        this.currentMode = 'fib-recursif';
    }

    async init() {
        console.log('FibonacciPage: init start');
        await super.init();
        console.log('FibonacciPage: super.init() finished');
        this.visualizer = new FibonacciVisualizer(document.getElementById('fib-visualization-container'));
        console.log('FibonacciPage: visualizer created');
        this.setMode(this.currentMode); // Set initial mode
        console.log('FibonacciPage: initial setMode called');
    }

    setupControls() {
        console.log('FibonacciPage: setupControls start');
        const container = document.getElementById('controls-container');
        if (!container) {
            console.warn('Controls container not found');
            return;
        }

        container.innerHTML = `
            <div class="controls fib-controls">
                <div class="control-group">
                    <label for="fib-n">Valeur de n :</label>
                    <input type="number" id="fib-n" class="input" min="0" max="12" value="5">
                </div>
                 <div id="fib-mode-switcher" class="control-group">
                    <button id="fib-mode-fib-recursif" class="btn btn-sm active" data-mode="fib-recursif">Approche Récursive</button>
                    <button id="fib-mode-fib-iteratif" class="btn btn-sm" data-mode="fib-iteratif">Approche Itérative</button>
                </div>
                <button id="btn-run" class="btn btn-primary">Lancer</button>
                <button id="btn-reset" class="btn btn-secondary">Réinitialiser</button>
            </div>`;
            
        this.nInput = document.getElementById('fib-n');
        this.runBtn = document.getElementById('btn-run');
        this.resetBtn = document.getElementById('btn-reset');
        this.modeSwitchContainer = document.getElementById('fib-mode-switcher');
        console.log('FibonacciPage: modeSwitchContainer is', this.modeSwitchContainer);


        this.runBtn.addEventListener('click', this.run.bind(this));
        this.resetBtn.addEventListener('click', this.reset.bind(this));
        
        if (this.modeSwitchContainer) {
            this.modeSwitchContainer.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => this.setMode(e.target.dataset.mode));
            });
        }
        console.log('FibonacciPage: setupControls end');
    }

    setupPseudocode() {
        // Override parent method to prevent double rendering.
    }

    setMode(mode) {
        console.log('FibonacciPage: setMode called with', mode);
        if (!mode) return;
        this.currentMode = mode;

        if (!this.modeSwitchContainer) {
            console.error('setMode called but modeSwitchContainer is null!');
            return;
        }
        this.modeSwitchContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        const pseudocodeForMode = this.data.pseudocode.find(p => p.name === mode);
        if (window.PseudocodeSupport && pseudocodeForMode) {
            const dataForRenderer = {
                pseudocode: [pseudocodeForMode],
                explanations: this.data.explanations,
            };
            const options = {
                containerId: 'pseudocode-container',
                explainId: 'explain-output',
                lineIdBuilder: (block, lineIndex) => `${mode}-line${lineIndex}`,
            };
            PseudocodeSupport.mountFromData(dataForRenderer, options);
        }

        this.reset();
    }

    reset() {
        if (this.visualizer) {
            this.visualizer.clear();
        }
        this._setCalculating(false);
    }
    
    _setCalculating(state) {
        this.state.running = state;
        if(this.nInput) this.nInput.disabled = state;
        if(this.runBtn) this.runBtn.disabled = state;
        if(this.modeSwitchContainer) {
            this.modeSwitchContainer.querySelectorAll('button').forEach(btn => btn.disabled = state);
        }
    }

    async run() {
        if (this.state.running) return;
        
        const n = parseInt(this.nInput.value, 10);
        if (isNaN(n) || n < 0 || n > 12) {
            alert("Veuillez entrer un nombre entre 0 et 12 pour une visualisation optimale.");
            return;
        }

        this._setCalculating(true);
        this.visualizer.clear();

        if (this.currentMode === 'fib-recursif') {
            await this.runRecursiveCalculation(n);
        } else if (this.currentMode === 'fib-iteratif') {
            await this.runLinearCalculation(n);
        }

        this._setCalculating(false);
    }
    
    async runLinearCalculation(n) {
        await this.visualizer.runLinearVisualization(n, this.currentMode, (lineId) => this.highlightLine(lineId));
    }

    async runRecursiveCalculation(n) {
        this.nodeCounter = 0;
        const treeData = this._buildFibTree(n);
        this.visualizer.runRecursiveVisualization(treeData, this.currentMode);
        await this._animateRecursiveCalculation(treeData);
    }
    
    _buildFibTree(n) {
        if (n <= 1) {
            return { id: this.nodeCounter++, n: n, children: [], result: n, isBaseCase: true, lineRef: 2 };
        }

        const leftChild = this._buildFibTree(n - 1);
        const rightChild = this._buildFibTree(n - 2);
        
        const result = leftChild.result + rightChild.result;
        return { 
            id: this.nodeCounter++, 
            n: n, 
            children: [leftChild, rightChild],
            result: result,
            isBaseCase: false,
            lineRef: 6 
        };
    }

    async _animateRecursiveCalculation(node) {
        if (!node) return;
        
        const baseLineId = `${this.currentMode}-line`;
        await this.highlightLine(baseLineId + (node.isBaseCase ? 1 : 4));
        
        if (node.isBaseCase) {
             await OEIUtils.sleep(this.speedCtrl.getDelay());
        }

        if (node.children && node.children.length > 0) {
            await this._animateRecursiveCalculation(node.children[0]);
            await this.highlightLine(baseLineId + 5);
            await OEIUtils.sleep(this.speedCtrl.getDelay());
            await this._animateRecursiveCalculation(node.children[1]);
        }
        
        await this.highlightLine(baseLineId + node.lineRef);
        await OEIUtils.sleep(this.speedCtrl.getDelay());
        await this.visualizer.highlightNode(node.id, node.result);
    }
}
