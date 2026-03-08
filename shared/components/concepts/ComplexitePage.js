class ComplexitePage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.complexitiesOrder = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(2^n)'];
        this.complexityIds = {
            'O(1)': 'o1',
            'O(log n)': 'ologn',
            'O(n)': 'on',
            'O(n log n)': 'onlogn',
            'O(n²)': 'on2',
            'O(2^n)': 'o2n'
        };
        this.complexityChart = null;
        this.isSimulating = false;
        this.animationFrameId = null;
        this.duration = 10;
        this.ctx = null;
        this.nRange = null;
        this.nValue = null;
        this.durationRange = null;
        this.durationValue = null;
        this.simulateBtn = null;
        this.progressLabel = null;
    }

    async init() {
        await super.init();
        this.mountComplexitySimulator();
    }

    mountComplexitySimulator() {
        this.nRange = document.getElementById('n-range');
        this.nValue = document.getElementById('n-value');
        this.durationRange = document.getElementById('n-duration');
        this.durationValue = document.getElementById('n-duration-value');
        this.simulateBtn = document.getElementById('simulate-btn');
        this.progressLabel = document.getElementById('progress-label');
        const canvas = document.getElementById('complexityChart');
        this.ctx = canvas ? canvas.getContext('2d') : null;

        if (!this.nRange || !this.nValue || !this.durationRange || !this.durationValue || !this.simulateBtn || !this.ctx) {
            return;
        }

        this.duration = parseInt(this.durationRange.value, 10) || 10;

        const initialN = parseInt(this.nRange.value, 10) || 10;
        this.nValue.textContent = String(initialN);
        this.durationValue.textContent = String(this.duration);
        const initialComplexities = this.calculateComplexities(initialN);
        this.updateComplexityValues(initialComplexities);
        this.createChart(initialComplexities);

        this.nRange.addEventListener('input', (event) => {
            const n = parseInt(event.target.value, 10) || 1;
            this.nValue.textContent = String(n);
            const complexities = this.calculateComplexities(n);
            this.updateComplexityValues(complexities);
            this.createChart(complexities);
            if (this.progressLabel) this.progressLabel.textContent = '';
        });

        this.durationRange.addEventListener('input', (event) => {
            this.duration = parseInt(event.target.value, 10) || 10;
            this.durationValue.textContent = String(this.duration);
        });

        this.simulateBtn.addEventListener('click', () => {
            this.simulateExecution();
        });
    }

    calculateComplexities(n) {
        const safeN = Math.max(1, Number(n) || 1);
        return {
            'O(1)': 1,
            'O(log n)': Math.log2(safeN),
            'O(n)': safeN,
            'O(n log n)': safeN * Math.log2(safeN),
            'O(n²)': safeN * safeN,
            'O(2^n)': Math.pow(2, safeN)
        };
    }

    updateComplexityValues(values) {
        this.complexitiesOrder.forEach((label) => {
            const target = document.getElementById(this.complexityIds[label]);
            if (!target) return;
            const value = Number(values[label] || 0);
            target.textContent = value.toFixed(2);
        });
    }

    createChart(values) {
        if (!this.ctx || typeof Chart === 'undefined') return;
        const n = parseInt(this.nRange?.value || '1', 10) || 1;

        if (this.complexityChart) {
            this.complexityChart.destroy();
        }

        this.complexityChart = new Chart(this.ctx, {
            type: 'bar',
            data: {
                labels: this.complexitiesOrder,
                datasets: [{
                    label: `Comparaison pour n = ${n}`,
                    data: this.complexitiesOrder.map((label) => Number(values[label] || 0)),
                    backgroundColor: 'rgba(79,70,229,0.6)',
                    borderColor: 'rgba(79,70,229,1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Nombre d'opérations"
                        }
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Comparaison des Complexités' }
                },
                animation: { duration: 0 }
            }
        });
    }

    simulateExecution() {
        if (this.isSimulating) return;
        if (!this.nRange || !this.simulateBtn) return;

        this.isSimulating = true;
        this.simulateBtn.disabled = true;
        this.nRange.disabled = true;
        if (this.progressLabel) this.progressLabel.textContent = 'Simulation en cours...';

        const n = parseInt(this.nRange.value, 10) || 1;
        const targets = this.calculateComplexities(n);
        const durations = {};
        this.complexitiesOrder.forEach((label) => {
            durations[label] = Math.max(200, Number(targets[label] || 0) * this.duration);
        });
        const start = performance.now();

        const step = (now) => {
            const elapsed = now - start;
            const current = {};
            let done = true;

            this.complexitiesOrder.forEach((label) => {
                const targetValue = Number(targets[label] || 0);
                const duration = durations[label];
                const progress = Math.min(1, duration > 0 ? elapsed / duration : 1);
                current[label] = targetValue * progress;
                if (progress < 1) done = false;
            });

            this.updateComplexityValues(current);
            if (this.complexityChart) {
                this.complexityChart.data.datasets[0].data = this.complexitiesOrder.map((label) => current[label]);
                this.complexityChart.update();
            }

            if (!done) {
                this.animationFrameId = requestAnimationFrame(step);
                return;
            }

            this.isSimulating = false;
            this.simulateBtn.disabled = false;
            this.nRange.disabled = false;
            if (this.progressLabel) this.progressLabel.textContent = 'Simulation terminée';
            this.animationFrameId = null;
        };

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.animationFrameId = requestAnimationFrame(step);
    }
}

if (typeof window !== 'undefined') {
    window.ComplexitePage = ComplexitePage;
}
