class HttpInspectorPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.users = [
            { id: 1, nom: 'Alice Dupont', email: 'alice@example.com', role: 'admin' },
            { id: 2, nom: 'Bob Martin', email: 'bob@example.com', role: 'utilisateur' },
            { id: 3, nom: 'Claire Leroy', email: 'claire@example.com', role: 'utilisateur' },
            { id: 4, nom: 'David Moreau', email: 'david@example.com', role: 'moderateur' }
        ];

        this.products = [
            { id: 42, nom: 'Clavier mecanique', prix: 89.99, stock: 15, categorie: 'Peripheriques' },
            { id: 43, nom: 'Souris ergonomique', prix: 45.5, stock: 32, categorie: 'Peripheriques' },
            { id: 44, nom: 'Ecran 27 pouces', prix: 349.0, stock: 8, categorie: 'Ecrans' },
            { id: 45, nom: 'Cable USB-C', prix: 12.99, stock: 120, categorie: 'Accessoires' }
        ];

        this.nextUserId = 5;
        this.speedCtrl = null;
        this.scenarios = [
            {
                id: 'users-list',
                label: 'GET /api/users -> 200 + tableau',
                method: 'GET',
                url: '/api/users',
                body: '',
                checks: [
                    { type: 'status', equals: 200 },
                    { type: 'bodyType', equals: 'array' },
                    { type: 'arrayMinLength', min: 1 }
                ]
            },
            {
                id: 'users-not-found',
                label: 'GET /api/users/999 -> 404',
                method: 'GET',
                url: '/api/users/999',
                body: '',
                checks: [
                    { type: 'status', equals: 404 },
                    { type: 'bodyPathExists', path: 'erreur' }
                ]
            },
            {
                id: 'users-create',
                label: 'POST /api/users -> 201 + Location',
                method: 'POST',
                url: '/api/users',
                body: '{"nom":"Nouveau","email":"nouveau@example.com"}',
                checks: [
                    { type: 'status', equals: 201 },
                    { type: 'bodyPathExists', path: 'id' },
                    { type: 'headerExists', key: 'Location' }
                ]
            },
            {
                id: 'products-one',
                label: 'GET /api/products/42 -> 200 + objet',
                method: 'GET',
                url: '/api/products/42',
                body: '',
                checks: [
                    { type: 'status', equals: 200 },
                    { type: 'bodyPathEquals', path: 'id', equals: 42 },
                    { type: 'bodyPathExists', path: 'categorie' }
                ]
            }
        ];
    }

    async init() {
        await super.init();

        this.methodSelect = document.getElementById('method-select');
        this.urlInput = document.getElementById('url-input');
        this.bodySection = document.getElementById('body-section');
        this.requestBody = document.getElementById('request-body');
        this.btnSend = document.getElementById('btn-send');
        this.requestHeaders = document.getElementById('request-headers');
        this.scenarioSelect = document.getElementById('scenario-select');
        this.btnRunScenario = document.getElementById('btn-run-scenario');
        this.assertionResults = document.getElementById('assertion-results');

        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');

        this.bindInlineCompatibility();
        this.initScenarios();
        this.bindEvents();
        this.updateBodyVisibility();
    }

    bindInlineCompatibility() {
        window.addHeader = this.addHeader.bind(this);
        window.removeHeader = this.removeHeader.bind(this);
        window.sendRequest = this.sendRequest.bind(this);
        window.runScenario = this.runScenario.bind(this);
    }

    initScenarios() {
        if (!this.scenarioSelect) return;
        this.scenarioSelect.innerHTML = this.scenarios
            .map((scenario) => '<option value="' + this.escapeHtml(scenario.id) + '">' + this.escapeHtml(scenario.label) + '</option>')
            .join('');
    }

    bindEvents() {
        this.methodSelect.addEventListener('change', () => this.updateBodyVisibility());

        document.querySelectorAll('.endpoint-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.methodSelect.value = btn.dataset.method;
                this.urlInput.value = btn.dataset.url;
                this.updateBodyVisibility();
                if (btn.dataset.method === 'POST') {
                    this.requestBody.value = '{"nom": "Alice", "email": "alice@example.com"}';
                } else if (btn.dataset.method === 'PUT') {
                    this.requestBody.value = '{"nom": "Alice (modifie)", "role": "admin"}';
                }
            });
        });

        if (this.btnRunScenario) {
            this.btnRunScenario.addEventListener('click', () => this.runScenario());
        }
    }

    updateBodyVisibility() {
        const method = this.methodSelect.value;
        this.bodySection.style.display = method === 'POST' || method === 'PUT' ? 'block' : 'none';
    }

    addHeader() {
        const row = document.createElement('div');
        row.className = 'header-row';
        row.innerHTML = '<input type="text" class="input" placeholder="Cle"><input type="text" class="input" placeholder="Valeur"><button class="btn-remove" onclick="removeHeader(this)">&times;</button>';
        this.requestHeaders.appendChild(row);
    }

    removeHeader(btn) {
        if (!btn || !btn.parentElement) return;
        btn.parentElement.remove();
    }

    getRequestHeaders() {
        const rows = document.querySelectorAll('#request-headers .header-row');
        const headers = {};
        rows.forEach((row) => {
            const inputs = row.querySelectorAll('input');
            const key = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (key) headers[key] = value;
        });
        return headers;
    }

    getScenarioById(id) {
        return this.scenarios.find((scenario) => scenario.id === id) || null;
    }

    setRequestFromScenario(scenario) {
        if (!scenario) return;
        this.methodSelect.value = scenario.method;
        this.urlInput.value = scenario.url;
        this.requestBody.value = scenario.body || '';
        this.updateBodyVisibility();
    }

    readPath(source, path) {
        if (!path) return undefined;
        return String(path)
            .split('.')
            .reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), source);
    }

    evaluateCheck(summary, check) {
        switch (check.type) {
        case 'status':
            return {
                ok: summary.status === check.equals,
                text: 'Status attendu ' + check.equals + ', obtenu ' + summary.status
            };
        case 'bodyType': {
            const actual = Array.isArray(summary.body) ? 'array' : typeof summary.body;
            return {
                ok: actual === check.equals,
                text: 'Type corps attendu ' + check.equals + ', obtenu ' + actual
            };
        }
        case 'arrayMinLength':
            return {
                ok: Array.isArray(summary.body) && summary.body.length >= check.min,
                text: 'Taille tableau >= ' + check.min + ' (' + (Array.isArray(summary.body) ? summary.body.length : 'non-tableau') + ')'
            };
        case 'bodyPathExists': {
            const value = this.readPath(summary.body, check.path);
            return {
                ok: value !== undefined,
                text: 'Champ corps `' + check.path + '` present'
            };
        }
        case 'bodyPathEquals': {
            const value = this.readPath(summary.body, check.path);
            return {
                ok: value === check.equals,
                text: 'Champ `' + check.path + '` attendu ' + check.equals + ', obtenu ' + value
            };
        }
        case 'headerExists':
            return {
                ok: Object.prototype.hasOwnProperty.call(summary.responseHeaders || {}, check.key),
                text: 'Header de reponse `' + check.key + '` present'
            };
        default:
            return { ok: false, text: 'Check non gere: ' + check.type };
        }
    }

    renderAssertions(scenario, results) {
        if (!this.assertionResults) return;
        const passed = results.filter((item) => item.ok).length;
        const failed = results.length - passed;
        this.assertionResults.innerHTML = '' +
            '<div class="assertion-summary ' + (failed ? 'bad' : 'ok') + '">' +
                this.escapeHtml('Scenario: ' + scenario.label + ' | ' + passed + '/' + results.length + ' checks OK') +
            '</div>' +
            '<div class="assertion-list">' +
                results.map((item) => '<div class="assertion-row ' + (item.ok ? 'ok' : 'bad') + '">' + (item.ok ? '&#10003; ' : '&#10007; ') + this.escapeHtml(item.text) + '</div>').join('') +
            '</div>';
    }

    async runScenario() {
        const scenarioId = this.scenarioSelect ? this.scenarioSelect.value : '';
        const scenario = this.getScenarioById(scenarioId);
        if (!scenario) return;

        if (this.btnRunScenario) {
            this.btnRunScenario.disabled = true;
            this.btnRunScenario.textContent = 'Scenario en cours...';
        }

        this.setRequestFromScenario(scenario);
        const summary = await this.sendRequest({ fromScenario: true });
        const results = scenario.checks.map((check) => this.evaluateCheck(summary, check));
        this.renderAssertions(scenario, results);

        if (this.btnRunScenario) {
            this.btnRunScenario.disabled = false;
            this.btnRunScenario.textContent = 'Executer le scenario';
        }
    }

    routeRequest(method, url, body) {
        const parts = url.replace(/^\//, '').split('/');

        if (parts[0] === 'api' && parts[1] === 'users') {
            const id = parts[2] ? parseInt(parts[2], 10) : null;

            if (method === 'GET' && !id) {
                return { status: 200, statusText: 'OK', body: this.users };
            }
            if (method === 'GET' && id) {
                const user = this.users.find((u) => u.id === id);
                if (user) return { status: 200, statusText: 'OK', body: user };
                return { status: 404, statusText: 'Not Found', body: { erreur: 'Utilisateur non trouve', id } };
            }
            if (method === 'POST') {
                let parsed = {};
                try {
                    parsed = JSON.parse(body || '{}');
                } catch (e) {
                    return { status: 400, statusText: 'Bad Request', body: { erreur: 'JSON invalide dans le corps de la requete' } };
                }

                const newUser = {
                    id: this.nextUserId++,
                    nom: parsed.nom || 'Inconnu',
                    email: parsed.email || '',
                    role: 'utilisateur'
                };
                this.users.push(newUser);
                return { status: 201, statusText: 'Created', body: newUser, headers: { Location: '/api/users/' + newUser.id } };
            }
            if (method === 'PUT' && id) {
                const user = this.users.find((u) => u.id === id);
                if (!user) return { status: 404, statusText: 'Not Found', body: { erreur: 'Utilisateur non trouve' } };

                let parsed = {};
                try {
                    parsed = JSON.parse(body || '{}');
                } catch (e) {
                    return { status: 400, statusText: 'Bad Request', body: { erreur: 'JSON invalide' } };
                }

                if (parsed.nom) user.nom = parsed.nom;
                if (parsed.email) user.email = parsed.email;
                if (parsed.role) user.role = parsed.role;
                return { status: 200, statusText: 'OK', body: user };
            }
            if (method === 'DELETE' && id) {
                const idx = this.users.findIndex((u) => u.id === id);
                if (idx === -1) return { status: 404, statusText: 'Not Found', body: { erreur: 'Utilisateur non trouve' } };
                this.users.splice(idx, 1);
                return { status: 204, statusText: 'No Content', body: null };
            }
        }

        if (parts[0] === 'api' && parts[1] === 'products') {
            const id = parts[2] ? parseInt(parts[2], 10) : null;
            if (method === 'GET' && !id) {
                return { status: 200, statusText: 'OK', body: this.products };
            }
            if (method === 'GET' && id) {
                const product = this.products.find((p) => p.id === id);
                if (product) return { status: 200, statusText: 'OK', body: product };
                return { status: 404, statusText: 'Not Found', body: { erreur: 'Produit non trouve', id } };
            }
        }

        return { status: 404, statusText: 'Not Found', body: { erreur: 'Endpoint inconnu : ' + url } };
    }

    async sendRequest(options = {}) {
        const method = this.methodSelect.value;
        const url = this.urlInput.value.trim() || '/';
        const body = this.requestBody.value;
        const requestHeaders = this.getRequestHeaders();

        if (!options.fromScenario && this.assertionResults) {
            this.assertionResults.innerHTML = '<div class="assertion-summary">Executer un scenario pour valider des assertions automatiques.</div>';
        }

        const animDelay = this.speedCtrl ? this.speedCtrl.getDelay() : 400;
        const latency = animDelay * 2;

        this.btnSend.disabled = true;
        this.btnSend.textContent = 'Envoi en cours...';

        const packetReq = document.getElementById('packet-req');
        const packetRes = document.getElementById('packet-res');
        const timingInfo = document.getElementById('timing-info');

        packetReq.className = 'arrow-packet request';
        packetRes.className = 'arrow-packet response';
        timingInfo.innerHTML = 'Envoi de la requete...';

        await OEIUtils.sleep(50);
        packetReq.classList.add('animating-down');
        packetReq.textContent = method.substring(0, 3);

        await OEIUtils.sleep(animDelay);
        timingInfo.innerHTML = 'Traitement par le serveur...';

        await OEIUtils.sleep(animDelay);
        const result = this.routeRequest(method, url, body, requestHeaders);

        const statusClass = 'status-' + String(result.status).charAt(0) + 'xx';
        packetRes.textContent = String(result.status);
        packetRes.classList.add('animating-up');

        await OEIUtils.sleep(animDelay);

        const totalTime = animDelay * 3;
        timingInfo.innerHTML =
            'Latence : <span class="time-value">' + latency.toFixed(0) + ' ms</span><br>' +
            'Total : <span class="time-value">' + totalTime.toFixed(0) + ' ms</span>';

        const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().substring(0, 8)
            : Math.random().toString(36).substring(2, 10);

        const respHeaders = {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Request-Id': requestId,
            Date: new Date().toUTCString(),
            Server: 'SimulatedServer/1.0',
            'X-Response-Time': latency.toFixed(0) + 'ms',
            ...(result.headers || {})
        };

        if (result.body === null) delete respHeaders['Content-Type'];

        document.getElementById('empty-response').style.display = 'none';
        document.getElementById('response-content').style.display = 'block';

        const badge = document.getElementById('status-badge');
        badge.textContent = String(result.status);
        badge.className = 'status-badge ' + statusClass;
        document.getElementById('status-text').textContent = result.statusText;

        document.getElementById('response-headers').innerHTML = Object.entries(respHeaders)
            .map(([k, v]) => '<div class="header-line"><span class="header-key">' + this.escapeHtml(k) + ':</span><span class="header-val">' + this.escapeHtml(String(v)) + '</span></div>')
            .join('');

        const responseBody = document.getElementById('response-body');
        if (result.body !== null) {
            responseBody.textContent = JSON.stringify(result.body, null, 2);
        } else {
            responseBody.textContent = '(Aucun corps de reponse)';
        }
        responseBody.style.display = 'block';

        this.btnSend.disabled = false;
        this.btnSend.textContent = 'Envoyer la requete';

        return {
            method,
            url,
            requestHeaders,
            bodyRaw: body,
            status: result.status,
            statusText: result.statusText,
            body: result.body,
            responseHeaders: respHeaders
        };
    }

}

if (typeof window !== 'undefined') {
    window.HttpInspectorPage = HttpInspectorPage;
}
