/*
 * slides-special-code-runtime.js — runtime code-live (exécution in-browser JS/Python)
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

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

            const runPython = async (code) => {
                consoleEl.textContent = '';
                _outputText = '';
                appendOutput('⏳ Chargement de Python…\n', 'var(--sl-muted)');
                if (!global._slPyodideLoaded) {
                    global._slPyodideLoaded = true;
                    try {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                            s.onload = resolve; s.onerror = reject;
                            document.head.appendChild(s);
                        });
                        global._slPyodide = await loadPyodide();
                    } catch(e) {
                        appendOutput('❌ Impossible de charger Python: ' + e.message + '\n', '#f87171');
                        return;
                    }
                }
                // Wait for ongoing load
                while (!global._slPyodide && global._slPyodideLoaded) {
                    await new Promise(r => setTimeout(r, 200));
                }
                if (!global._slPyodide) return;
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

            btnRun.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
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

    global.OEISlidesSpecialCodeRuntime = Object.freeze({ mountCodeElements });
})(typeof window !== 'undefined' ? window : globalThis);
