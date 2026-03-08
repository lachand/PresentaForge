class CorsPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.scenarios = [
            {
                id: 'simple-get',
                label: 'GET simple autorise',
                request: {
                    origin: 'https://app.example.com',
                    method: 'GET',
                    endpoint: '/api/public',
                    auth: false,
                    json: false,
                    credentials: false
                },
                policy: {
                    allowOrigin: '*',
                    allowGet: true,
                    allowPost: true,
                    allowPut: false,
                    allowDelete: false,
                    allowAuth: false,
                    allowJson: true,
                    allowCredentials: false
                }
            },
            {
                id: 'preflight-ok',
                label: 'POST + Authorization (preflight OK)',
                request: {
                    origin: 'https://app.example.com',
                    method: 'POST',
                    endpoint: '/api/orders',
                    auth: true,
                    json: true,
                    credentials: true
                },
                policy: {
                    allowOrigin: 'https://app.example.com',
                    allowGet: true,
                    allowPost: true,
                    allowPut: false,
                    allowDelete: false,
                    allowAuth: true,
                    allowJson: true,
                    allowCredentials: true
                }
            },
            {
                id: 'blocked-credentials',
                label: 'Credentials bloquees par *',
                request: {
                    origin: 'https://admin.example.com',
                    method: 'GET',
                    endpoint: '/api/admin',
                    auth: false,
                    json: false,
                    credentials: true
                },
                policy: {
                    allowOrigin: '*',
                    allowGet: true,
                    allowPost: false,
                    allowPut: false,
                    allowDelete: false,
                    allowAuth: false,
                    allowJson: true,
                    allowCredentials: false
                }
            }
        ];

        this.speedCtrl = null;
        this.animationRun = 0;
    }

    async init() {
        await super.init();
        this.speedCtrl = this.createSpeedController('speedSlider', 'speedLabel');
        this.cacheDom();
        this.bindEvents();
        this.populateScenarios();
        this.applyScenarioById(this.scenarios[0].id);
        this.runSimulation();
    }

    cacheDom() {
        this.scenarioSelect = document.getElementById('cors-scenario');
        this.runBtn = document.getElementById('cors-run');

        this.originInput = document.getElementById('cors-origin');
        this.methodSelect = document.getElementById('cors-method');
        this.endpointInput = document.getElementById('cors-endpoint');
        this.authCheckbox = document.getElementById('cors-header-auth');
        this.jsonCheckbox = document.getElementById('cors-content-type-json');
        this.credentialsCheckbox = document.getElementById('cors-with-credentials');

        this.allowOriginSelect = document.getElementById('srv-allow-origin');
        this.allowGet = document.getElementById('srv-allow-get');
        this.allowPost = document.getElementById('srv-allow-post');
        this.allowPut = document.getElementById('srv-allow-put');
        this.allowDelete = document.getElementById('srv-allow-delete');
        this.allowAuth = document.getElementById('srv-allow-auth-header');
        this.allowJson = document.getElementById('srv-allow-json');
        this.allowCredentials = document.getElementById('srv-allow-credentials');

        this.preflightNeededOutput = document.getElementById('cors-preflight-needed');
        this.requestFlowOutput = document.getElementById('cors-flow-request');
        this.responseFlowOutput = document.getElementById('cors-flow-response');
        this.resultBadge = document.getElementById('cors-result-badge');
        this.decisionOutput = document.getElementById('cors-decision');
        this.timeline = document.getElementById('cors-timeline');

        this.lanePreflightStatus = document.getElementById('cors-lane-preflight-status');
        this.laneRequestStatus = document.getElementById('cors-lane-request-status');
        this.gatewayNode = document.getElementById('cors-gateway-node');
        this.preflightPacket = document.getElementById('cors-preflight-packet');
        this.requestPacket = document.getElementById('cors-request-packet');
        this.rulesList = document.getElementById('cors-rules-list');
        this.matrixBody = document.getElementById('cors-matrix-body');
    }

    bindEvents() {
        if (this.scenarioSelect) {
            this.scenarioSelect.addEventListener('change', () => {
                this.applyScenarioById(this.scenarioSelect.value);
                this.runSimulation();
            });
        }

        if (this.runBtn) {
            this.runBtn.addEventListener('click', () => this.runSimulation());
        }

        [
            this.originInput,
            this.methodSelect,
            this.endpointInput,
            this.authCheckbox,
            this.jsonCheckbox,
            this.credentialsCheckbox,
            this.allowOriginSelect,
            this.allowGet,
            this.allowPost,
            this.allowPut,
            this.allowDelete,
            this.allowAuth,
            this.allowJson,
            this.allowCredentials
        ].forEach((node) => {
            if (!node) return;
            node.addEventListener('change', () => this.runSimulation());
            node.addEventListener('input', () => this.runSimulation());
        });
    }

    populateScenarios() {
        if (!this.scenarioSelect) return;
        this.scenarioSelect.innerHTML = this.scenarios
            .map((scenario) => `<option value="${this.escapeHtml(scenario.id)}">${this.escapeHtml(scenario.label)}</option>`)
            .join('');
    }

    applyScenarioById(scenarioId) {
        const scenario = this.scenarios.find((item) => item.id === scenarioId);
        if (!scenario) return;

        this.originInput.value = scenario.request.origin;
        this.methodSelect.value = scenario.request.method;
        this.endpointInput.value = scenario.request.endpoint;
        this.authCheckbox.checked = scenario.request.auth;
        this.jsonCheckbox.checked = scenario.request.json;
        this.credentialsCheckbox.checked = scenario.request.credentials;

        this.allowOriginSelect.value = scenario.policy.allowOrigin;
        this.allowGet.checked = scenario.policy.allowGet;
        this.allowPost.checked = scenario.policy.allowPost;
        this.allowPut.checked = scenario.policy.allowPut;
        this.allowDelete.checked = scenario.policy.allowDelete;
        this.allowAuth.checked = scenario.policy.allowAuth;
        this.allowJson.checked = scenario.policy.allowJson;
        this.allowCredentials.checked = scenario.policy.allowCredentials;
    }

    readRequest() {
        return {
            origin: this.originInput.value.trim() || 'https://app.example.com',
            method: this.methodSelect.value,
            endpoint: this.endpointInput.value.trim() || '/',
            auth: Boolean(this.authCheckbox.checked),
            json: Boolean(this.jsonCheckbox.checked),
            credentials: Boolean(this.credentialsCheckbox.checked)
        };
    }

    readPolicy(request) {
        const rawAllowOrigin = this.allowOriginSelect.value;
        return {
            allowOrigin: rawAllowOrigin === 'echo' ? request.origin : rawAllowOrigin,
            allowMethod: {
                GET: Boolean(this.allowGet.checked),
                POST: Boolean(this.allowPost.checked),
                PUT: Boolean(this.allowPut.checked),
                DELETE: Boolean(this.allowDelete.checked)
            },
            allowAuth: Boolean(this.allowAuth.checked),
            allowJson: Boolean(this.allowJson.checked),
            allowCredentials: Boolean(this.allowCredentials.checked)
        };
    }

    isPreflightNeeded(request) {
        const simpleMethod = request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST';
        return !simpleMethod || request.auth || request.json;
    }

    isOriginAllowed(request, policy) {
        if (policy.allowOrigin === '*') return true;
        return policy.allowOrigin === request.origin;
    }

    computeChecks(request, policy) {
        const preflightNeeded = this.isPreflightNeeded(request);
        const checks = [
            {
                id: 'origin',
                label: 'Origin autorisee',
                scope: 'response',
                ok: this.isOriginAllowed(request, policy),
                fail: 'Origin non autorisee dans Access-Control-Allow-Origin.'
            },
            {
                id: 'method',
                label: `Methode ${request.method} autorisee`,
                scope: 'preflight',
                required: preflightNeeded,
                ok: Boolean(policy.allowMethod[request.method]),
                fail: `Methode ${request.method} absente de Access-Control-Allow-Methods.`
            },
            {
                id: 'auth',
                label: 'Header Authorization autorise',
                scope: 'preflight',
                required: preflightNeeded && request.auth,
                ok: !request.auth || policy.allowAuth,
                fail: 'Header Authorization absent de Access-Control-Allow-Headers.'
            },
            {
                id: 'json',
                label: 'Content-Type JSON autorise',
                scope: 'preflight',
                required: preflightNeeded && request.json,
                ok: !request.json || policy.allowJson,
                fail: 'Content-Type application/json non autorise.'
            },
            {
                id: 'credentials',
                label: 'Credentials compatibles',
                scope: 'response',
                required: request.credentials,
                ok: !request.credentials || (policy.allowCredentials && policy.allowOrigin !== '*'),
                fail: 'Credentials exigent Allow-Credentials=true et un origin explicite.'
            }
        ];

        checks.forEach((check) => {
            if (check.required === false) {
                check.state = 'skip';
                return;
            }
            check.state = check.ok ? 'ok' : 'bad';
        });

        return checks;
    }

    evaluate(request, policy) {
        const timeline = [];
        const preflightNeeded = this.isPreflightNeeded(request);
        const checks = this.computeChecks(request, policy);

        timeline.push({
            type: 'info',
            text: `Script lance ${request.method} ${request.endpoint} depuis ${request.origin}.`
        });

        if (preflightNeeded) {
            timeline.push({
                type: 'warn',
                text: 'Preflight OPTIONS envoyee (verification methodes/headers).'
            });

            const failedPreflight = checks.find((check) => check.scope === 'preflight' && check.state === 'bad');
            if (failedPreflight) {
                timeline.push({
                    type: 'bad',
                    text: `Preflight refusee: ${failedPreflight.fail}`
                });
                return {
                    ok: false,
                    blockedAt: 'preflight',
                    reason: failedPreflight.fail,
                    preflightNeeded,
                    timeline,
                    checks
                };
            }

            timeline.push({
                type: 'ok',
                text: 'Preflight acceptee: la requete metier peut partir.'
            });
        }

        timeline.push({
            type: 'info',
            text: `Requete ${request.method} envoyee au serveur.`
        });

        const failedResponse = checks.find((check) => check.scope === 'response' && check.state === 'bad');
        if (failedResponse) {
            timeline.push({
                type: 'bad',
                text: `Reponse recue mais bloquee cote navigateur: ${failedResponse.fail}`
            });
            return {
                ok: false,
                blockedAt: 'response',
                reason: failedResponse.fail,
                preflightNeeded,
                timeline,
                checks
            };
        }

        timeline.push({
            type: 'ok',
            text: 'La reponse est exposee au JavaScript: CORS valide.'
        });

        return {
            ok: true,
            blockedAt: null,
            reason: 'Politique CORS coherente avec la requete.',
            preflightNeeded,
            timeline,
            checks
        };
    }

    renderTimeline(entries) {
        if (!this.timeline) return;
        this.timeline.innerHTML = entries
            .map((entry) => `<li class="mod-log-item ${this.escapeHtml(entry.type)}">${this.escapeHtml(entry.text)}</li>`)
            .join('');
    }

    renderDecision(result) {
        this.preflightNeededOutput.textContent = result.preflightNeeded ? 'Oui' : 'Non';

        if (result.preflightNeeded) {
            this.requestFlowOutput.textContent = 'OPTIONS puis requete metier';
        } else {
            this.requestFlowOutput.textContent = 'Requete directe';
        }

        if (result.ok) {
            this.resultBadge.className = 'mod-status ok';
            this.resultBadge.textContent = 'Autorisee';
            this.decisionOutput.textContent = 'Le script peut lire la reponse HTTP.';
            this.responseFlowOutput.textContent = 'Visible au JavaScript';
            return;
        }

        if (result.blockedAt === 'preflight') {
            this.resultBadge.className = 'mod-status bad';
            this.resultBadge.textContent = 'Bloquee (preflight)';
            this.decisionOutput.textContent = result.reason;
            this.responseFlowOutput.textContent = 'Requete metier non envoyee';
            return;
        }

        this.resultBadge.className = 'mod-status warn';
        this.resultBadge.textContent = 'Bloquee (reponse)';
        this.decisionOutput.textContent = result.reason;
        this.responseFlowOutput.textContent = 'Serveur repond mais JS ne voit pas';
    }

    renderRules(checks) {
        if (!this.rulesList) return;
        this.rulesList.innerHTML = checks
            .map((check) => {
                const state = check.state || 'skip';
                const stateLabel = state === 'ok' ? 'OK' : (state === 'bad' ? 'Refuse' : 'N/A');
                return `
                    <li class="cors-rule-item ${state}">
                        <span class="cors-rule-title">${this.escapeHtml(check.label)}</span>
                        <span class="cors-rule-state">${this.escapeHtml(stateLabel)}</span>
                    </li>
                `;
            })
            .join('');
    }

    renderMatrix(policy, request) {
        const origins = [
            'https://app.example.com',
            'https://admin.example.com'
        ];

        const scenarios = [
            { label: 'GET', request: { method: 'GET', auth: false, json: false, credentials: false } },
            { label: 'POST+JSON', request: { method: 'POST', auth: false, json: true, credentials: false } },
            { label: 'GET+cred', request: { method: 'GET', auth: false, json: false, credentials: true } }
        ];

        const rows = origins.map((origin) => {
            const outcomes = scenarios.map((scenario) => {
                const sample = {
                    ...request,
                    origin,
                    method: scenario.request.method,
                    auth: scenario.request.auth,
                    json: scenario.request.json,
                    credentials: scenario.request.credentials
                };
                const res = this.evaluate(sample, policy);
                return res.ok;
            });
            return { origin, outcomes };
        });

        this.matrixBody.innerHTML = rows
            .map((row) => {
                const cells = row.outcomes.map((ok) => `<td class="${ok ? 'ok' : 'bad'}">${ok ? 'Oui' : 'Non'}</td>`).join('');
                return `<tr><td><code>${this.escapeHtml(row.origin)}</code></td>${cells}</tr>`;
            })
            .join('');
    }

    resetVisual() {
        this.gatewayNode.classList.remove('ok', 'warn', 'bad', 'pending');
        this.gatewayNode.classList.add('pending');

        this.preflightPacket.classList.add('hidden');
        this.requestPacket.classList.add('hidden');
        this.preflightPacket.dataset.pos = 'client';
        this.requestPacket.dataset.pos = 'client';

        this.lanePreflightStatus.className = 'mod-status info';
        this.lanePreflightStatus.textContent = 'En attente';
        this.laneRequestStatus.className = 'mod-status info';
        this.laneRequestStatus.textContent = 'En attente';
    }

    setPacketPosition(packet, position) {
        packet.dataset.pos = position;
    }

    sleep(ms) {
        if (typeof OEIUtils !== 'undefined' && typeof OEIUtils.sleep === 'function') {
            return OEIUtils.sleep(ms);
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    currentDelay() {
        return this.speedCtrl ? this.speedCtrl.getDelay() : 500;
    }

    packetStartDelay() {
        return Math.max(70, Math.round(this.currentDelay() * 0.22));
    }

    packetHopDelay() {
        return Math.max(170, Math.round(this.currentDelay() * 0.7));
    }

    async animatePacket(packet, path, runId) {
        packet.classList.remove('hidden');
        this.setPacketPosition(packet, path[0]);
        await this.sleep(this.packetStartDelay());

        for (let i = 1; i < path.length; i += 1) {
            if (runId !== this.animationRun) return false;
            this.setPacketPosition(packet, path[i]);
            await this.sleep(this.packetHopDelay());
        }
        return runId === this.animationRun;
    }

    async renderVisual(result) {
        const runId = ++this.animationRun;
        this.resetVisual();

        if (result.preflightNeeded) {
            this.lanePreflightStatus.className = 'mod-status warn';
            this.lanePreflightStatus.textContent = 'Requis';
            await this.animatePacket(this.preflightPacket, ['client', 'gateway'], runId);

            if (runId !== this.animationRun) return;
            if (result.blockedAt === 'preflight') {
                this.gatewayNode.classList.remove('pending');
                this.gatewayNode.classList.add('bad');
                this.lanePreflightStatus.className = 'mod-status bad';
                this.lanePreflightStatus.textContent = 'Refuse';
                this.laneRequestStatus.className = 'mod-status bad';
                this.laneRequestStatus.textContent = 'Annulee';
                return;
            }

            await this.animatePacket(this.preflightPacket, ['gateway', 'server', 'gateway', 'client'], runId);
            if (runId !== this.animationRun) return;
            this.lanePreflightStatus.className = 'mod-status ok';
            this.lanePreflightStatus.textContent = 'Valide';
        } else {
            this.lanePreflightStatus.className = 'mod-status info';
            this.lanePreflightStatus.textContent = 'Non requis';
        }

        this.laneRequestStatus.className = 'mod-status warn';
        this.laneRequestStatus.textContent = 'En transit';

        await this.animatePacket(this.requestPacket, ['client', 'gateway', 'server'], runId);
        if (runId !== this.animationRun) return;

        if (result.ok) {
            await this.animatePacket(this.requestPacket, ['server', 'gateway', 'client'], runId);
            if (runId !== this.animationRun) return;
            this.gatewayNode.classList.remove('pending');
            this.gatewayNode.classList.add('ok');
            this.laneRequestStatus.className = 'mod-status ok';
            this.laneRequestStatus.textContent = 'Visible JS';
            return;
        }

        await this.animatePacket(this.requestPacket, ['server', 'gateway'], runId);
        if (runId !== this.animationRun) return;
        this.gatewayNode.classList.remove('pending');
        this.gatewayNode.classList.add('warn');
        this.laneRequestStatus.className = 'mod-status warn';
        this.laneRequestStatus.textContent = 'Bloquee au retour';
    }

    async runSimulation() {
        const request = this.readRequest();
        const policy = this.readPolicy(request);
        const result = this.evaluate(request, policy);

        this.renderDecision(result);
        this.renderRules(result.checks || []);
        this.renderTimeline(result.timeline || []);
        this.renderMatrix(policy, request);
        await this.renderVisual(result);
    }
}

if (typeof window !== 'undefined') {
    window.CorsPage = CorsPage;
}
