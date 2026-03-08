document.addEventListener('DOMContentLoaded', async () => {
    if (typeof AlgorithmExpertLab === 'undefined') return;
    const lab = new AlgorithmExpertLab('algoexpert-fragment');
    lab.init();

    try {
        const res = await fetch('../data/content/concepts/algorithmie-mon-algo.json');
        const data = await res.json();
        if (data.guidedExercises) {
            renderGuidedExercises(data.guidedExercises);
        }
    } catch {
        // JSON unavailable — skip silently
    }
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderGuidedExercises(exercises) {
    const container = document.getElementById('algoexpert-guided-exercises');
    if (!container || !Array.isArray(exercises)) return;
    container.innerHTML = '';
    exercises.forEach((ex) => {
        const card = document.createElement('article');
        card.className = 'algoexpert-guided-card';
        card.innerHTML = `
            <div class="algoexpert-guided-header">
                <span class="algoexpert-guided-title">${escapeHtml(ex.title)}</span>
                <span class="algoexpert-guided-badge">${escapeHtml(ex.difficulty)}</span>
            </div>
            <p class="algoexpert-guided-objective">${escapeHtml(ex.objective)}</p>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-primary algoexpert-guided-load">Charger</button>
                <button class="btn btn-secondary algoexpert-guided-verify">Vérifier</button>
            </div>
            <div class="algoexpert-guided-feedback"></div>
        `;
        const feedbackEl = card.querySelector('.algoexpert-guided-feedback');
        card.querySelector('.algoexpert-guided-load').addEventListener('click', () => {
            const api = window.AlgorithmExpertAPI;
            if (api) {
                api.loadScenario({ code: ex.code, inputs: ex.inputs });
                document.getElementById('algoexpert-fragment').scrollIntoView({ behavior: 'smooth' });
            }
        });
        card.querySelector('.algoexpert-guided-verify').addEventListener('click', () => {
            verifyGuidedExercise(ex, feedbackEl);
            document.getElementById('algoexpert-fragment').scrollIntoView({ behavior: 'smooth' });
        });
        container.appendChild(card);
    });
}

function verifyGuidedExercise(ex, feedbackEl) {
    const api = window.AlgorithmExpertAPI;
    if (!api) {
        feedbackEl.textContent = 'API non disponible.';
        feedbackEl.className = 'algoexpert-guided-feedback bad';
        return;
    }
    api.loadScenario({ inputs: ex.inputs });
    api.analyze();
    const trace = api.getTrace();
    const returnEvent = trace.slice().reverse().find((e) => e.type === 'return');
    if (!returnEvent) {
        feedbackEl.textContent = 'Aucune valeur retournée. Vérifiez que votre fonction contient un return.';
        feedbackEl.className = 'algoexpert-guided-feedback bad';
        return;
    }
    const got = returnEvent.returnValue;
    if (JSON.stringify(got) === JSON.stringify(ex.expected)) {
        feedbackEl.textContent = `Correct ! ${ex.hint}`;
        feedbackEl.className = 'algoexpert-guided-feedback ok';
    } else {
        feedbackEl.textContent = `Résultat incorrect. Obtenu\u00a0: ${JSON.stringify(got)} — Attendu\u00a0: ${JSON.stringify(ex.expected)}.`;
        feedbackEl.className = 'algoexpert-guided-feedback bad';
    }
}
