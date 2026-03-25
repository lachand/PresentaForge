/*
 * slides-special-code-runtime.js — runtime code-live (exécution in-browser JS/Python)
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

    /**
     * Monte les éléments code-live dans le container.
     * @param {Element} container
     * @param {{ isAudienceReadOnly }} ctx
     */
    async function mountCodeElements(container, ctx) {
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitFn = typeof ctx?.emitAudienceElementState === 'function' ? ctx.emitAudienceElementState : null;
        const subscribeFn = typeof ctx?.subscribeAudienceElementState === 'function' ? ctx.subscribeAudienceElementState : null;

        // ── Code Live (in-browser code execution) ──
        container.querySelectorAll('.sl-codelive-pending').forEach(el => {
            if (el.dataset.codeliveBound) return;
            el.dataset.codeliveBound = '1';
            const lang = el.dataset.language || 'python';
            const codeArea = el.querySelector('.sl-codelive-code');
            const consoleEl = el.querySelector('.sl-codelive-console');
            const btnRun = el.querySelector('.sl-codelive-run');
            const btnClear = el.querySelector('.sl-codelive-clear');
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
                const workerSource = [
                    'const _s=(v)=>{if(typeof v==="string") return v; try{return JSON.stringify(v);}catch(_){return String(v);}};',
                    'const _logs=[];',
                    'const _push=(type,args)=>{_logs.push({type,text:Array.from(args||[]).map(_s).join(" ")});};',
                    'console.log=(...a)=>_push("log",a);',
                    'console.warn=(...a)=>_push("warn",a);',
                    'console.error=(...a)=>_push("error",a);',
                    'self.onmessage=async(ev)=>{',
                    '  const code=String(ev?.data?.code||"");',
                    '  try {',
                    '    let result=(0,eval)(code);',
                    '    if (result && typeof result.then==="function") result=await result;',
                    '    self.postMessage({ok:true,logs:_logs,result:result===undefined?"__oei_undefined__":_s(result)});',
                    '  } catch (err) {',
                    '    self.postMessage({ok:false,logs:_logs,error:err?.message||String(err)});',
                    '  }',
                    '};'
                ].join('\n');
                const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
                const worker = new Worker(workerUrl);
                let settled = false;
                const closeWorker = () => {
                    if (settled) return;
                    settled = true;
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                };
                const timeout = setTimeout(() => {
                    closeWorker();
                    appendOutput('❌ Exécution interrompue (timeout)\n', '#f87171');
                }, 2500);
                const colorForType = (type) => {
                    if (type === 'error') return '#f87171';
                    if (type === 'warn') return '#fbbf24';
                    return 'var(--sl-text,#cbd5e1)';
                };
                worker.onmessage = (event) => {
                    clearTimeout(timeout);
                    const payload = event?.data || {};
                    const logs = Array.isArray(payload.logs) ? payload.logs : [];
                    logs.forEach(log => appendOutput(`${String(log.text || '')}\n`, colorForType(log.type)));
                    if (payload.ok) {
                        if (payload.result !== '__oei_undefined__') appendOutput(`→ ${String(payload.result)}\n`, '#a5b4fc');
                    } else {
                        appendOutput(`❌ ${String(payload.error || 'Erreur JavaScript')}\n`, '#f87171');
                    }
                    closeWorker();
                    emitOutput();
                };
                worker.onerror = (event) => {
                    clearTimeout(timeout);
                    closeWorker();
                    appendOutput(`❌ Sandbox JavaScript: ${String(event?.message || 'Erreur worker')}\n`, '#f87171');
                    emitOutput();
                };
                worker.postMessage({ code: String(code || '') });
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
                    global._slPyodide.setStdout({ batched: (text) => appendOutput(text + '\n', 'var(--sl-text,#cbd5e1)') });
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
