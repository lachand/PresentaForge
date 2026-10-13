/*
 * slides-special-code-runtime.js — runtime code-live (exécution in-browser JS/Python)
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

    // ── Python (Pyodide) dans un Worker ───────────────────────────────────────────────────
    // Avant, Pyodide tournait sur le thread principal sans limite de temps : une boucle infinie
    // figeait le présentateur (navigation, salle, chrono). Désormais l'exécution a lieu dans un
    // worker : minuteur d'exécution (n'inclut pas le chargement de Pyodide), arrêt manuel, et
    // terminaison du worker si besoin (audit UX 2026-10, K1/K2). Le code utilisateur est transmis
    // par message à Pyodide : jamais évalué comme chaîne JS (CSP sans 'unsafe-eval' respectée).
    const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
    const PY_RUN_TIMEOUT_MS = 10000;
    const PY_LOAD_TIMEOUT_MS = 60000;

    const PYTHON_WORKER_SOURCE = [
        'importScripts(' + JSON.stringify(PYODIDE_URL) + ');',
        'let pyPromise = null;',
        'const post = (m) => self.postMessage(m);',
        'const getPy = () => { if (!pyPromise) pyPromise = loadPyodide(); return pyPromise; };',
        'self.onmessage = async (e) => {',
        '  const msg = e.data || {};',
        '  if (msg.type !== "run") return;',
        '  const id = msg.id;',
        '  let py;',
        '  post({ id, type: "loading" });',
        '  try { py = await getPy(); } catch (err) { pyPromise = null; post({ id, type: "load-error", message: String((err && err.message) || err) }); return; }',
        '  try {',
        '    py.setStdout({ batched: (t) => post({ id, type: "stdout", text: t }) });',
        '    py.setStderr({ batched: (t) => post({ id, type: "stderr", text: t }) });',
        '    post({ id, type: "started" });',
        '    const result = await py.runPythonAsync(String(msg.code || ""));',
        '    post({ id, type: "done", result: (result === undefined || result === null) ? null : String(result) });',
        '  } catch (err) { post({ id, type: "error", message: String((err && err.message) || err) }); }',
        '};',
    ].join('\n');

    /**
     * Exécuteur Python réutilisable (un worker « chaud », un seul run à la fois).
     * Dépendances injectables pour les tests (aucun accès global implicite).
     * @param {{ Worker?: any, Blob?: any, createObjectURL?: Function, revokeObjectURL?: Function,
     *   setTimeout?: Function, clearTimeout?: Function, runTimeoutMs?: number, loadTimeoutMs?: number }} [env]
     */
    function createPythonRunner(env = {}) {
        const WorkerCtor = env.Worker || (typeof Worker !== 'undefined' ? Worker : null);
        const BlobCtor = env.Blob || (typeof Blob !== 'undefined' ? Blob : null);
        const makeUrl = env.createObjectURL || (blob => URL.createObjectURL(blob));
        const revokeUrl = env.revokeObjectURL || (u => URL.revokeObjectURL(u));
        const setT = env.setTimeout || setTimeout;
        const clearT = env.clearTimeout || clearTimeout;
        const runTimeoutMs = env.runTimeoutMs || PY_RUN_TIMEOUT_MS;
        const loadTimeoutMs = env.loadTimeoutMs || PY_LOAD_TIMEOUT_MS;
        let worker = null;
        let workerUrl = null;
        let seq = 0;
        let current = null;

        const supported = () => !!(WorkerCtor && BlobCtor);
        const dispose = () => {
            if (worker) { try { worker.terminate(); } catch (_) { /* déjà arrêté */ } worker = null; }
            if (workerUrl) { try { revokeUrl(workerUrl); } catch (_) { /* ignoré */ } workerUrl = null; }
        };
        const ensureWorker = () => {
            if (worker) return worker;
            workerUrl = makeUrl(new BlobCtor([PYTHON_WORKER_SOURCE], { type: 'text/javascript' }));
            worker = new WorkerCtor(workerUrl);
            return worker;
        };

        /**
         * @param {string} code
         * @param {{ onLoading?: Function, onStdout?: Function, onStderr?: Function, onDone?: Function,
         *   onError?: Function, onLoadError?: Function, onTimeout?: Function, onCancel?: Function }} [h]
         * @returns {{ cancel: () => void }}
         */
        function run(code, h = {}) {
            if (current) current.cancel();
            const w = ensureWorker();
            const id = ++seq;
            let phase = 'loading';
            let finished = false;
            let timer = null;
            const arm = (ms) => { clearT(timer); timer = setT(onTimer, ms); };
            const finish = (disposeWorker) => {
                if (finished) return false;
                finished = true;
                clearT(timer);
                current = null;
                if (disposeWorker) dispose();
                return true;
            };
            const onTimer = () => {
                const wasRunning = phase === 'running';
                if (finish(true)) (wasRunning ? h.onTimeout : h.onLoadError)?.(wasRunning ? runTimeoutMs : 'Chargement de Python trop long');
            };
            w.onmessage = (event) => {
                const m = event && event.data ? event.data : {};
                if (m.id !== id || finished) return;
                switch (m.type) {
                    case 'loading': h.onLoading?.(); break;
                    case 'started': phase = 'running'; arm(runTimeoutMs); break;   // le minuteur ne compte que l'exécution
                    case 'stdout': h.onStdout?.(String(m.text ?? '')); break;
                    case 'stderr': h.onStderr?.(String(m.text ?? '')); break;
                    case 'done': if (finish(false)) h.onDone?.(m.result == null ? null : String(m.result)); break;
                    case 'error': if (finish(false)) h.onError?.(String(m.message || 'Erreur Python')); break;
                    case 'load-error': if (finish(true)) h.onLoadError?.(String(m.message || 'Pyodide indisponible')); break;
                    default: break;
                }
            };
            w.onerror = (event) => {
                event?.preventDefault?.();
                if (finish(true)) h.onLoadError?.(String(event?.message || 'Script Pyodide inaccessible (réseau bloqué ?)'));
            };
            arm(loadTimeoutMs);
            current = {
                cancel() { if (finish(true)) h.onCancel?.(); },
            };
            w.postMessage({ type: 'run', id, code: String(code || '') });
            return { cancel: () => current && current.cancel() };
        }

        return { run, dispose, supported, get busy() { return !!current; } };
    }

    let _pyRunner = null;
    const getPythonRunner = () => (_pyRunner || (_pyRunner = createPythonRunner()));

    /**
     * Monte les éléments code-live dans le container.
     * @param {Element} container
     * @param {{ prefix?: 'sl'|'cel', isAudienceReadOnly }} ctx
     */
    async function mountCodeElements(container, ctx) {
        const P = (ctx && ctx.prefix) || 'sl';
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitFn = typeof ctx?.emitAudienceElementState === 'function' ? ctx.emitAudienceElementState : null;
        const subscribeFn = typeof ctx?.subscribeAudienceElementState === 'function' ? ctx.subscribeAudienceElementState : null;

        // ── Code Live (in-browser code execution) ──
        container.querySelectorAll(`.${P}-codelive-pending`).forEach(el => {
            if (el.dataset.codeliveBound) return;
            el.dataset.codeliveBound = '1';
            const lang = el.dataset.language || 'python';
            const codeArea = el.querySelector(`.${P}-codelive-code`);
            const consoleEl = el.querySelector(`.${P}-codelive-console`);
            const btnRun = el.querySelector(`.${P}-codelive-run`);
            const btnClear = el.querySelector(`.${P}-codelive-clear`);
            if (!codeArea || !consoleEl || !btnRun) return;
            if (isAudienceReadOnly) {
                codeArea.readOnly = true;
                codeArea.style.pointerEvents = 'none';
                btnRun.disabled = true;
                btnRun.style.pointerEvents = 'none';
                if (btnClear) {
                    btnClear.disabled = true;
                    btnClear.style.pointerEvents = 'none';
                }
                const note = document.createElement('div');
                note.style.cssText = 'font-size:0.68rem;color:var(--sl-muted,#64748b);padding:6px 10px;border-top:1px solid var(--sl-border,#2d3347);';
                note.textContent = 'Exécution réservée au présentateur';
                consoleEl.parentElement?.appendChild(note);
                // Subscribe to output sync from presenter
                if (subscribeFn) {
                    subscribeFn(el, 'code', (state) => {
                        if (state.output != null) consoleEl.textContent = state.output;
                    });
                }
                return;
            }

            // Tab key support in textarea
            codeArea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const s = codeArea.selectionStart, end = codeArea.selectionEnd;
                    codeArea.value = codeArea.value.substring(0, s) + '    ' + codeArea.value.substring(end);
                    codeArea.selectionStart = codeArea.selectionEnd = s + 4;
                }
            });

            let _outputText = '';
            const appendOutput = (text, color) => {
                const span = document.createElement('span');
                span.style.color = color || 'inherit';
                span.textContent = text;
                consoleEl.appendChild(span);
                consoleEl.scrollTop = consoleEl.scrollHeight;
                _outputText += text;
            };
            const emitOutput = () => {
                if (emitFn) emitFn(el, 'code', { output: _outputText });
            };

            const runJS = async (code) => {
                consoleEl.textContent = '';
                _outputText = '';
                if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || !URL?.createObjectURL) {
                    appendOutput('❌ Sandbox JavaScript indisponible dans ce navigateur\n', '#f87171');
                    return;
                }
                // Le code utilisateur est *inliné* dans la source du worker (chargée via blob:),
                // il n'est jamais évalué comme une chaîne (pas de `eval` / `new Function`) :
                // compatible avec une CSP `script-src` sans `'unsafe-eval'` (`worker-src blob:` suffit).
                // Le worker isole l'exécution : thread séparé, pas de DOM, terminable sur timeout.
                const PREAMBLE =
                    'const __oeiS=(v)=>{if(typeof v==="string")return v;try{return JSON.stringify(v);}catch(_){return String(v);}};'
                    + 'const __oeiLogs=[];'
                    + 'const __oeiPush=(t,a)=>{__oeiLogs.push({type:t,text:Array.from(a||[]).map(__oeiS).join(" ")});};'
                    + 'console.log=(...a)=>__oeiPush("log",a);console.info=(...a)=>__oeiPush("log",a);'
                    + 'console.debug=(...a)=>__oeiPush("log",a);'
                    + 'console.warn=(...a)=>__oeiPush("warn",a);console.error=(...a)=>__oeiPush("error",a);'
                    + '(async()=>{try{';
                const EPILOGUE =
                    '\n;self.postMessage({ok:true,logs:__oeiLogs});'
                    + '}catch(err){self.postMessage({ok:false,logs:__oeiLogs,error:(err&&err.message)||String(err)});}})();';
                // Ligne 1 = préambule (une seule ligne) ; le code utilisateur commence ligne 2.
                const workerSource = PREAMBLE + '\n' + String(code || '') + EPILOGUE;
                const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
                let worker;
                try {
                    worker = new Worker(workerUrl);
                } catch (e) {
                    URL.revokeObjectURL(workerUrl);
                    appendOutput(`❌ ${String(e?.message || e)}\n`, '#f87171');
                    emitOutput();
                    return;
                }
                let settled = false;
                const closeWorker = () => {
                    if (settled) return;
                    settled = true;
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                };
                const timeout = setTimeout(() => {
                    closeWorker();
                    appendOutput('❌ Exécution interrompue (timeout 2.5 s — boucle infinie ?)\n', '#f87171');
                    emitOutput();
                }, 2500);
                const colorForType = (type) => {
                    if (type === 'error') return '#f87171';
                    if (type === 'warn') return '#fbbf24';
                    return 'var(--sl-code-text,#e2e8f0)';
                };
                worker.onmessage = (event) => {
                    clearTimeout(timeout);
                    const payload = event?.data || {};
                    const logs = Array.isArray(payload.logs) ? payload.logs : [];
                    logs.forEach(log => appendOutput(`${String(log.text || '')}\n`, colorForType(log.type)));
                    if (payload.ok) {
                        if (!_outputText) appendOutput('(aucune sortie — utilise console.log(...) pour afficher une valeur)\n', 'var(--sl-muted,#64748b)');
                    } else {
                        appendOutput(`❌ ${String(payload.error || 'Erreur JavaScript')}\n`, '#f87171');
                    }
                    closeWorker();
                    emitOutput();
                };
                worker.onerror = (event) => {
                    clearTimeout(timeout);
                    closeWorker();
                    event?.preventDefault?.();
                    const line = (event && Number.isFinite(event.lineno) && event.lineno > 1) ? ` (ligne ${event.lineno - 1})` : '';
                    appendOutput(`❌ ${String(event?.message || 'Erreur — vérifie la syntaxe')}${line}\n`, '#f87171');
                    emitOutput();
                };
            };

            // Repli (Worker/Blob indisponible) : ancien chemin sur le thread principal, sans limite de temps.
            const runPythonMainThread = async (code) => {
                consoleEl.textContent = '';
                _outputText = '';
                appendOutput('⏳ Chargement de Python…\n', 'var(--sl-muted)');
                if (!global._slPyodideLoaded) {
                    try {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = PYODIDE_URL;
                            s.onload = resolve; s.onerror = () => reject(new Error('script Pyodide inaccessible'));
                            document.head.appendChild(s);
                        });
                        global._slPyodide = await loadPyodide();
                        global._slPyodideLoaded = true;
                    } catch(e) {
                        appendOutput('❌ Impossible de charger Python: ' + e.message + '\n', '#f87171');
                        emitOutput();
                        return;
                    }
                }
                consoleEl.textContent = '';
                try {
                    global._slPyodide.setStdout({ batched: (text) => appendOutput(text + '\n', 'var(--sl-code-text,#e2e8f0)') });
                    global._slPyodide.setStderr({ batched: (text) => appendOutput(text + '\n', '#f87171') });
                    const result = await global._slPyodide.runPythonAsync(code);
                    if (result !== undefined && result !== null) appendOutput('→ ' + String(result) + '\n', '#a5b4fc');
                } catch(err) {
                    appendOutput('❌ ' + (err.message || String(err)) + '\n', '#f87171');
                }
                emitOutput();
            };

            const runLabel = btnRun.textContent;
            let activePyRun = null;
            const setRunning = (running) => {
                btnRun.textContent = running ? '■ Arrêter' : runLabel;
                btnRun.setAttribute('aria-pressed', running ? 'true' : 'false');
            };
            const endPyRun = () => { activePyRun = null; setRunning(false); emitOutput(); };

            const runPython = (code) => {
                const runner = getPythonRunner();
                if (!runner.supported()) return runPythonMainThread(code);
                consoleEl.textContent = '';
                _outputText = '';
                let loadingShown = false;
                try {
                    activePyRun = runner.run(code, {
                        onLoading: () => { if (!loadingShown) { loadingShown = true; appendOutput('⏳ Chargement de Python (première exécution)…\n', 'var(--sl-muted)'); } },
                        onStdout: (t) => appendOutput(t + '\n', 'var(--sl-code-text,#e2e8f0)'),
                        onStderr: (t) => appendOutput(t + '\n', '#f87171'),
                        onDone: (result) => { if (result !== null) appendOutput('→ ' + result + '\n', '#a5b4fc'); endPyRun(); },
                        onError: (message) => { appendOutput('❌ ' + message + '\n', '#f87171'); endPyRun(); },
                        onLoadError: (message) => { appendOutput('❌ Impossible de charger Python : ' + message + '\n', '#f87171'); endPyRun(); },
                        onTimeout: (ms) => { appendOutput('❌ Exécution interrompue après ' + Math.round(ms / 1000) + ' s (boucle infinie ?). Python sera rechargé au prochain essai.\n', '#f87171'); endPyRun(); },
                        onCancel: () => { appendOutput('■ Exécution arrêtée.\n', '#fbbf24'); endPyRun(); },
                    });
                    setRunning(true);
                } catch (e) {
                    // Création du worker refusée (CSP, navigateur) : repli sur le thread principal.
                    activePyRun = null;
                    return runPythonMainThread(code);
                }
            };

            btnRun.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                // Pendant une exécution Python, le même bouton arrête le calcul.
                if (activePyRun) { activePyRun.cancel(); return; }
                const code = codeArea.value;
                if (lang === 'javascript' || lang === 'js') runJS(code);
                else runPython(code);
            });

            btnClear?.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                consoleEl.textContent = '';
                _outputText = '';
                emitOutput();
            });

            // Auto-run if configured
            if (el.dataset.autorun === '1') {
                setTimeout(() => btnRun.click(), 500);
            }
        });
    }

    global.OEISlidesSpecialCodeRuntime = Object.freeze({ mountCodeElements, testUtils: Object.freeze({ createPythonRunner, PYTHON_WORKER_SOURCE }) });
})(typeof window !== 'undefined' ? window : globalThis);
