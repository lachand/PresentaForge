/*
 * slides-special-runtime.js — runtime binder for special interactive slide elements
 * Extracted from SlidesRenderer.mountSpecialElements to keep slides-core lean.
 */
(function(global){
    'use strict';

    /**
     * Mount special interactive elements (latex, mermaid, timers, quiz/live widgets, etc).
     * @param {{ container: Element|HTMLElement, SlidesRenderer?: any }} context
     */
    async function mountSpecialElements(context = {}) {
        const container = context?.container;
        const SlidesRenderer = context?.SlidesRenderer || global.SlidesRenderer;
        if (!container || typeof container.querySelectorAll !== 'function') return;
        if (!SlidesRenderer) {
            throw new Error('SlidesRenderer is required for OEISlidesSpecialRuntime.mountSpecialElements');
        }
        const mode = (() => {
            try { return new URLSearchParams(window.location.search || '').get('mode') || ''; }
            catch (_) { return ''; }
        })();
        const fallbackAudienceReadOnly = mode === 'audience' || document.documentElement?.dataset?.oeiSlidesRole === 'audience';
        const audiencePolicy = (() => {
            const existing = window.OEIAudienceModePolicy;
            if (existing && typeof existing === 'object') return existing;
            const resolver = window.OEINetworkSession?.resolveAudiencePolicy;
            if (typeof resolver === 'function') {
                try {
                    return resolver(new URLSearchParams(window.location.search || ''), {
                        defaultMode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                        forceReadOnly: fallbackAudienceReadOnly ? true : null,
                    });
                } catch (_) {}
            }
            return {
                mode: fallbackAudienceReadOnly ? 'display' : 'interactive',
                readOnly: fallbackAudienceReadOnly,
                allowAudienceActions: !fallbackAudienceReadOnly,
            };
        })();
        window.OEIAudienceModePolicy = audiencePolicy;
        const isAudienceReadOnly = !!audiencePolicy?.readOnly || fallbackAudienceReadOnly;
        const presenterSyncBridge = (mode === 'presenter' && window.OEIPresenterSyncBridge && typeof window.OEIPresenterSyncBridge.post === 'function')
            ? window.OEIPresenterSyncBridge
            : null;
        const audienceElementStore = (() => {
            const current = window.OEIAudienceElementState;
            if (current && typeof current === 'object') return current;
            const next = {};
            window.OEIAudienceElementState = next;
            return next;
        })();
        const toTrimmed = (value, maxLen = 120) => {
            if (typeof value !== 'string') return '';
            const out = value.trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        };
        const toInt = value => {
            const n = Number(value);
            return Number.isFinite(n) ? Math.trunc(n) : null;
        };
        const resolveSyncMeta = host => {
            const section = host?.closest?.('section[data-slide-index]');
            const owner = host?.closest?.('[data-element-id]');
            const slideIndex = toInt(section?.dataset?.slideIndex);
            const elementId = toTrimmed(owner?.dataset?.elementId || '', 160);
            return { slideIndex, elementId };
        };
        const elementStateKey = (elementType, slideIndex, elementId = '') => {
            const safeType = toTrimmed(String(elementType || ''), 80);
            const safeSlide = toInt(slideIndex);
            const safeId = toTrimmed(String(elementId || ''), 160);
            if (!safeType || safeSlide === null || safeSlide < 0) return '';
            return `${safeType}::${safeSlide}::${safeId}`;
        };
        const emitAudienceElementState = (host, elementType, state = {}) => {
            if (!presenterSyncBridge?.post || !presenterSyncBridge?.SYNC_MSG?.ELEMENT_STATE) return false;
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return false;
            const payloadState = (state && typeof state === 'object') ? state : {};
            return presenterSyncBridge.post({
                type: presenterSyncBridge.SYNC_MSG.ELEMENT_STATE,
                elementType: toTrimmed(String(elementType || ''), 80),
                slideIndex,
                elementId,
                state: payloadState,
            });
        };
        const subscribeAudienceElementState = (host, elementType, apply) => {
            if (!isAudienceReadOnly || typeof apply !== 'function') return () => {};
            const { slideIndex, elementId } = resolveSyncMeta(host);
            if (slideIndex === null || slideIndex < 0) return () => {};
            const safeType = toTrimmed(String(elementType || ''), 80);
            if (!safeType) return () => {};
            const exactKey = elementStateKey(safeType, slideIndex, elementId);
            const fallbackKey = elementStateKey(safeType, slideIndex, '');
            const bootstrap = exactKey
                ? audienceElementStore[exactKey]
                : (fallbackKey ? audienceElementStore[fallbackKey] : null);
            if (bootstrap && typeof bootstrap === 'object') {
                try { apply(bootstrap); } catch (_) {}
            }
            const onState = ev => {
                const detail = ev?.detail || {};
                if (toTrimmed(String(detail.elementType || ''), 80) !== safeType) return;
                const msgSlide = toInt(detail.slideIndex);
                if (msgSlide !== slideIndex) return;
                const msgElementId = toTrimmed(String(detail.elementId || ''), 160);
                if (elementId && msgElementId && msgElementId !== elementId) return;
                try {
                    apply((detail.state && typeof detail.state === 'object') ? detail.state : {});
                } catch (_) {}
            };
            window.addEventListener('oei:audience-element-state', onState);
            return () => window.removeEventListener('oei:audience-element-state', onState);
        };
        const disableInteractiveControls = root => {
            if (!root || typeof root.querySelectorAll !== 'function') return;
            root.querySelectorAll('button,input,select,textarea').forEach(ctrl => {
                try {
                    ctrl.disabled = true;
                    ctrl.style.pointerEvents = 'none';
                } catch (_) {}
            });
            root.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
        };

        // ── LaTeX (KaTeX) ──
        const latexEls = container.querySelectorAll('.sl-latex-pending');
        if (latexEls.length) {
            if (!window._slKatexLoaded) {
                window._slKatexLoaded = true;
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '../vendor/katex/0.16.11/katex.min.css';
                document.head.appendChild(link);
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '../vendor/katex/0.16.11/katex.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            if (window.katex) {
                latexEls.forEach(el => {
                    const target = el.querySelector('.sl-latex-render');
                    if (!target || target.dataset.rendered) return;
                    const expr = el.dataset.latex || '';
                    try {
                        target.innerHTML = window.katex.renderToString(expr, { displayMode: true, throwOnError: false });
                        target.dataset.rendered = '1';
                    } catch (e) {
                        target.innerHTML = `<span style="color:#f87171">${SlidesRenderer.esc(expr)}</span>`;
                    }
                });
            }
        }

        // ── Mermaid ──
        const mermaidEls = container.querySelectorAll('.sl-mermaid-pending');
        if (mermaidEls.length) {
            if (!window._slMermaidLoaded) {
                window._slMermaidLoaded = true;
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '../vendor/mermaid/10.9.1/mermaid.min.js';
                    s.onload = () => {
                        window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                        resolve();
                    };
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            if (window.mermaid) {
                for (const el of mermaidEls) {
                    const target = el.querySelector('.sl-mermaid-render');
                    const src = el.querySelector('pre');
                    if (!target || !src || target.dataset.rendered) continue;
                    try {
                        const id = 'sl-mm-' + Math.random().toString(36).slice(2, 9);
                        const { svg } = await window.mermaid.render(id, src.textContent);
                        target.innerHTML = svg;
                        // Scale SVG to fit container
                        const svgEl = target.querySelector('svg');
                        if (svgEl) {
                            svgEl.style.maxWidth = '100%';
                            svgEl.style.maxHeight = '100%';
                            svgEl.style.height = 'auto';
                        }
                        target.dataset.rendered = '1';
                    } catch (e) {
                        target.innerHTML = `<pre style="color:#f87171;font-size:12px;">${SlidesRenderer.esc(e.message || 'Erreur Mermaid')}</pre>`;
                    }
                }
            }
        }

        // ── Timer (interactive countdown) ──
        container.querySelectorAll('.sl-timer-content').forEach(el => {
            if (el.dataset.timerBound) return;
            el.dataset.timerBound = '1';
            const dur = parseInt(el.dataset.duration) || 300;
            let remaining = dur, interval = null, running = false;
            const display = el.querySelector('.sl-timer-display');
            const btnStart = el.querySelector('.sl-timer-start');
            const btnPause = el.querySelector('.sl-timer-pause');
            const btnReset = el.querySelector('.sl-timer-reset');
            if (!display || !btnStart) return;
            const fmt = (s) => {
                const m = String(Math.floor(s / 60)).padStart(2, '0');
                const ss = String(s % 60).padStart(2, '0');
                return `${m}:${ss}`;
            };
            const publishTimerState = (extraState = {}) => emitAudienceElementState(el, 'timer', Object.assign({
                remaining,
                running: !!running,
                ended: remaining <= 0,
                startVisible: !running,
                pauseVisible: !!running,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                btnStart.disabled = true;
                btnStart.style.pointerEvents = 'none';
                if (btnPause) { btnPause.disabled = true; btnPause.style.pointerEvents = 'none'; }
                if (btnReset) { btnReset.disabled = true; btnReset.style.pointerEvents = 'none'; }
                subscribeAudienceElementState(el, 'timer', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextRemaining = Number(sync.remaining);
                    if (Number.isFinite(nextRemaining)) {
                        remaining = Math.max(0, Math.trunc(nextRemaining));
                    }
                    running = !!sync.running;
                    display.textContent = fmt(remaining);
                    if (sync.ended === true || remaining <= 0) display.classList.add('sl-timer-ended');
                    else display.classList.remove('sl-timer-ended');
                    if (typeof sync.startVisible === 'boolean') btnStart.style.display = sync.startVisible ? '' : 'none';
                    if (btnPause && typeof sync.pauseVisible === 'boolean') btnPause.style.display = sync.pauseVisible ? '' : 'none';
                });
                display.textContent = fmt(remaining);
                return;
            }
            const tick = () => {
                remaining = Math.max(0, remaining - 1);
                display.textContent = fmt(remaining);
                publishTimerState();
                if (remaining <= 0) {
                    clearInterval(interval); running = false;
                    btnStart.style.display = ''; btnPause.style.display = 'none';
                    display.classList.add('sl-timer-ended');
                    publishTimerState({ ended: true, running: false });
                }
            };
            btnStart.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!running && remaining > 0) {
                    running = true; display.classList.remove('sl-timer-ended');
                    interval = setInterval(tick, 1000);
                    btnStart.style.display = 'none'; btnPause.style.display = '';
                    publishTimerState({ running: true });
                }
            });
            btnPause.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                clearInterval(interval); running = false;
                btnStart.style.display = ''; btnPause.style.display = 'none';
                publishTimerState({ running: false });
            });
            btnReset.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                clearInterval(interval); running = false;
                remaining = dur; display.textContent = fmt(dur);
                display.classList.remove('sl-timer-ended');
                btnStart.style.display = ''; btnPause.style.display = 'none';
                publishTimerState({ running: false, ended: false });
            });
            publishTimerState({ running: false, ended: false });
        });

        // ── Quiz interaction (click to reveal answer) ──
        container.querySelectorAll('.sl-quiz-options[data-answer]').forEach(optionsEl => {
            if (optionsEl.dataset.quizBound) return;
            optionsEl.dataset.quizBound = '1';
            const correctIdx = optionsEl.dataset.answer;
            if (correctIdx === '') return; // no answer defined
            const options = optionsEl.querySelectorAll('.sl-quiz-option');
            const applyQuizRevealState = state => {
                const sync = (state && typeof state === 'object') ? state : {};
                if (sync.answered !== true) return;
                optionsEl.dataset.quizAnswered = '1';
                options.forEach(o => {
                    if (o.dataset.idx === correctIdx) o.classList.add('sl-quiz-correct');
                    else o.classList.add('sl-quiz-wrong');
                });
                const section = optionsEl.closest('section');
                if (section) {
                    const expl = section.querySelector('.sl-quiz-explanation');
                    if (expl) { expl.style.display = ''; expl.classList.add('visible'); expl.style.opacity = '1'; }
                }
            };
            if (isAudienceReadOnly) {
                options.forEach(opt => { opt.style.pointerEvents = 'none'; opt.style.cursor = 'default'; });
                subscribeAudienceElementState(optionsEl, 'quiz-reveal', applyQuizRevealState);
                return;
            }
            options.forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (optionsEl.dataset.quizAnswered) return;
                    optionsEl.dataset.quizAnswered = '1';
                    const idx = opt.dataset.idx;
                    applyQuizRevealState({ answered: true });
                    emitAudienceElementState(optionsEl, 'quiz-reveal', {
                        answered: true,
                        selectedIdx: idx,
                        correctIdx,
                    });
                });
            });
        });

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

            const appendOutput = (text, color) => {
                const span = document.createElement('span');
                span.style.color = color || 'inherit';
                span.textContent = text;
                consoleEl.appendChild(span);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            };

            const runJS = async (code) => {
                consoleEl.textContent = '';
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
                };
                worker.onerror = (event) => {
                    clearTimeout(timeout);
                    closeWorker();
                    appendOutput(`❌ Sandbox JavaScript: ${String(event?.message || 'Erreur worker')}\n`, '#f87171');
                };
                worker.postMessage({ code: String(code || '') });
            };

            const runPython = async (code) => {
                consoleEl.textContent = '';
                appendOutput('⏳ Chargement de Python…\n', 'var(--sl-muted)');
                if (!window._slPyodideLoaded) {
                    window._slPyodideLoaded = true;
                    try {
                        await new Promise((resolve, reject) => {
                            const s = document.createElement('script');
                            s.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                            s.onload = resolve; s.onerror = reject;
                            document.head.appendChild(s);
                        });
                        window._slPyodide = await loadPyodide();
                    } catch(e) {
                        appendOutput('❌ Impossible de charger Python: ' + e.message + '\n', '#f87171');
                        return;
                    }
                }
                // Wait for ongoing load
                while (!window._slPyodide && window._slPyodideLoaded) {
                    await new Promise(r => setTimeout(r, 200));
                }
                if (!window._slPyodide) return;
                consoleEl.textContent = '';
                try {
                    window._slPyodide.setStdout({ batched: (text) => appendOutput(text + '\n', 'var(--sl-text,#cbd5e1)') });
                    window._slPyodide.setStderr({ batched: (text) => appendOutput(text + '\n', '#f87171') });
                    const result = await window._slPyodide.runPythonAsync(code);
                    if (result !== undefined && result !== null) appendOutput('→ ' + String(result) + '\n', '#a5b4fc');
                } catch(err) {
                    appendOutput('❌ ' + (err.message || String(err)) + '\n', '#f87171');
                }
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
            });

            // Auto-run if configured
            if (el.dataset.autorun === '1') {
                setTimeout(() => btnRun.click(), 500);
            }
        });

        // ── Quiz Live (interactive P2P quiz with PeerJS) ──
        container.querySelectorAll('.sl-quizlive-pending').forEach(el => {
            if (el.dataset.quizliveBound) return;
            el.dataset.quizliveBound = '1';
            const roomId = el.dataset.room || 'ql-' + Math.random().toString(36).slice(2, 9);
            const correctAnswer = parseInt(el.dataset.answer) || 0;
            const duration = parseInt(el.dataset.duration) || 30;
            const btnStart = el.querySelector('.sl-quizlive-start');
            const timerEl = el.querySelector('.sl-quizlive-timer');
            const statusEl = el.querySelector('.sl-quizlive-status');
            const resultsEl = el.querySelector('.sl-quizlive-results');
            const qrEl = el.querySelector('.sl-quizlive-qr');
            const optionsEls = el.querySelectorAll('.sl-quizlive-option');
            if (!btnStart) return;

            let peer = null, connections = [], responses = {}, timerInterval = null, remaining = duration, quizActive = false;
            const optLabels = Array.from(optionsEls).map(o => o.textContent.trim().slice(1).trim());
            const nOpts = optionsEls.length;
            const questionText = el.querySelector('.sl-quizlive-question')?.textContent || '';
            const computeCounts = () => {
                const counts = Array(nOpts).fill(0);
                const total = Object.keys(responses).length;
                Object.values(responses).forEach(r => { if (r >= 0 && r < nOpts) counts[r]++; });
                return { counts, total };
            };
            const publishQuizState = (extraState = {}) => {
                const mergedState = Object.assign({
                    active: !!quizActive,
                    ended: false,
                    question: questionText,
                    options: optLabels.slice(),
                    correctAnswer: null,
                    duration,
                    remaining: Math.max(0, Number(remaining) || 0),
                    counts: computeCounts().counts,
                    totalResponses: computeCounts().total,
                    statusText: String(statusEl?.textContent || ''),
                }, (extraState && typeof extraState === 'object') ? extraState : {});
                if (mergedState.ended === true) mergedState.correctAnswer = correctAnswer;
                emitAudienceElementState(el, 'quiz-live', mergedState);
            };

            if (isAudienceReadOnly) {
                btnStart.disabled = true;
                btnStart.textContent = 'Piloté';
                btnStart.style.pointerEvents = 'none';
                optionsEls.forEach(opt => {
                    opt.style.pointerEvents = 'none';
                    opt.style.cursor = 'default';
                });
                if (qrEl) qrEl.style.display = 'none';
                if (statusEl) statusEl.textContent = 'Piloté par le présentateur';
                const renderAudienceQuiz = state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const labels = Array.isArray(sync.options) && sync.options.length ? sync.options : optLabels;
                    const counts = Array.isArray(sync.counts) ? sync.counts.map(v => Number(v) || 0) : labels.map(() => 0);
                    const total = Math.max(0, Number(sync.totalResponses) || counts.reduce((a, b) => a + b, 0));
                    const currentRemaining = Math.max(0, Number(sync.remaining) || 0);
                    const active = sync.active === true;
                    const revealCorrect = sync.ended === true;
                    const resolvedCorrect = revealCorrect && Number.isFinite(Number(sync.correctAnswer))
                        ? Number(sync.correctAnswer)
                        : null;
                    if (timerEl) timerEl.textContent = `${currentRemaining}s`;
                    if (statusEl) {
                        statusEl.textContent = toTrimmed(String(sync.statusText || ''), 220)
                            || (active ? `${total} réponse(s) — ${currentRemaining}s restantes` : 'Piloté par le présentateur');
                    }
                    if (!resultsEl) return;
                    const shouldShow = active || total > 0 || sync.ended === true;
                    resultsEl.style.display = shouldShow ? '' : 'none';
                    if (!shouldShow) return;
                    const maxCount = Math.max(1, ...counts);
                    let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                    counts.forEach((count, i) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isCorrect = revealCorrect && i === resolvedCorrect;
                        const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                        html += `<div style="display:flex;align-items:center;gap:8px;">
                            <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                            <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                                <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${count})</span>
                            </div>
                        </div>`;
                    });
                    html += `</div>`;
                    resultsEl.innerHTML = html;
                };
                subscribeAudienceElementState(el, 'quiz-live', renderAudienceQuiz);
                return;
            }

            const updateResults = ({ ended = false } = {}) => {
                const { counts, total } = computeCounts();
                const maxCount = Math.max(1, ...counts);
                let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                counts.forEach((c, i) => {
                    const pct = total > 0 ? Math.round(c / total * 100) : 0;
                    const isCorrect = ended === true && i === correctAnswer;
                    const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                    html += `<div style="display:flex;align-items:center;gap:8px;">
                        <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                        <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                            <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${c})</span>
                        </div>
                    </div>`;
                });
                html += `</div>`;
                resultsEl.innerHTML = html;
                publishQuizState({ ended: ended === true });
            };

            const startQuiz = async () => {
                if (quizActive) return;

                // ── If a global student room is active, use it ──────────────
                if (window._studentRoom?.active && window._studentRoomBroadcast) {
                    quizActive = true;
                    btnStart.disabled = true;
                    btnStart.textContent = '⏳';
                    statusEl.textContent = 'Diffusion via la salle étudiants…';
                    responses = {};

                    window._activeQuizHandler = (peerId, value) => {
                        if (!quizActive) return;
                        responses[peerId] = value;
                        window._lastQuizResponses = responses;
                        window._lastQuizOptions = optLabels;
                        updateResults({ ended: false });
                        const nStudents = Object.keys(window._studentRoom.students).length;
                        statusEl.textContent = `${Object.keys(responses).length}/${nStudents} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                    };

                    window._studentRoomBroadcast({
                        type: 'quiz:question',
                        quizId: roomId,
                        question: questionText,
                        options: optLabels,
                        duration: duration,
                    });

                    resultsEl.style.display = '';
                    updateResults({ ended: false });
                    remaining = duration;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                    btnStart.textContent = '⏹ Arrêter';
                    btnStart.disabled = false;
                    publishQuizState();

                    timerInterval = setInterval(() => {
                        remaining--;
                        timerEl.textContent = remaining + 's';
                        statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                        if (remaining <= 0) endQuiz();
                    }, 1000);

                    btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
                    return;
                }
                // ── Fallback: dedicated peer (original behaviour) ───────────

                quizActive = true;
                btnStart.disabled = true;
                btnStart.textContent = '⏳';
                statusEl.textContent = 'Connexion P2P en cours…';

                // Load PeerJS
                if (!window._slPeerLoaded) {
                    window._slPeerLoaded = true;
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = '../vendor/peerjs/1.5.5/peerjs.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }

                try {
                    peer = new Peer(roomId, { debug: 0 });
                    await new Promise((resolve, reject) => {
                        peer.on('open', resolve);
                        peer.on('error', (e) => {
                            // If ID taken, try with suffix
                            if (e.type === 'unavailable-id') {
                                const altId = roomId + '-' + Date.now().toString(36).slice(-4);
                                peer = new Peer(altId, { debug: 0 });
                                peer.on('open', resolve);
                                peer.on('error', reject);
                            } else reject(e);
                        });
                        setTimeout(() => reject(new Error('Timeout PeerJS')), 10000);
                    });
                } catch(e) {
                    statusEl.textContent = '❌ Erreur: ' + (e.message || e);
                    btnStart.textContent = 'Réessayer';
                    btnStart.disabled = false;
                    quizActive = false;
                    publishQuizState({ active: false, ended: true });
                    return;
                }

                const quizUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'quiz-student.html?room=' + encodeURIComponent(peer.id);

                // Show QR code
                qrEl.style.display = '';
                qrEl.innerHTML = `<img src="${SlidesRenderer._buildQrSrc(quizUrl, 200)}" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"><div class="sl-qr-resize-handle">⇲</div>`;
                SlidesRenderer._makeQrInteractive(qrEl);

                // Handle connections
                peer.on('connection', (conn) => {
                    connections.push(conn);
                    conn.on('data', (data) => {
                        if (data && data.type === 'answer' && quizActive) {
                            responses[conn.peer] = data.value;
                            updateResults({ ended: false });
                            statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                            publishQuizState();
                        }
                    });
                    conn.on('open', () => {
                        conn.send({ type: 'quiz', question: el.querySelector('.sl-quizlive-question')?.textContent || '', options: optLabels, duration: remaining, roomId: peer.id });
                    });
                });

                // Show results area
                resultsEl.style.display = '';
                updateResults({ ended: false });

                // Start timer
                remaining = duration;
                timerEl.textContent = remaining + 's';
                statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                btnStart.textContent = '⏹ Arrêter';
                btnStart.disabled = false;
                publishQuizState();

                timerInterval = setInterval(() => {
                    remaining--;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                    publishQuizState();
                    if (remaining <= 0) {
                        endQuiz();
                    }
                }, 1000);

                // Toggle stop
                btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
            };

            const endQuiz = () => {
                quizActive = false;
                clearInterval(timerInterval);
                // Notify students via room (if active) or direct connections
                if (window._studentRoom?.active && window._studentRoomBroadcast) {
                    window._studentRoomBroadcast({ type: 'quiz:end', quizId: roomId, correctAnswer });
                    window._activeQuizHandler = null;
                    window._lastQuizResponses = null;
                    window._lastQuizOptions = null;
                } else {
                    connections.forEach(c => { try { c.send({ type: 'end' }); } catch(e) {} });
                }
                // Highlight correct answer
                optionsEls.forEach((o, i) => {
                    if (i === correctAnswer) {
                        o.style.borderColor = '#34d399';
                        o.style.background = 'color-mix(in srgb, #34d399 15%, var(--sl-slide-bg,#141620))';
                    }
                });
                statusEl.textContent = `Terminé — ${Object.keys(responses).length} réponse(s)`;
                btnStart.textContent = 'Relancer';
                btnStart.disabled = false;
                publishQuizState({ active: false, ended: true });
                btnStart.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    responses = {};
                    connections = [];
                    window._activeQuizHandler = null;
                    if (peer) { peer.destroy(); peer = null; }
                    optionsEls.forEach(o => { o.style.borderColor = ''; o.style.background = ''; });
                    resultsEl.style.display = 'none';
                    qrEl.style.display = 'none';
                    btnStart.textContent = 'Lancer';
                    btnStart.onclick = (e2) => { e2.stopPropagation(); e2.preventDefault(); startQuiz(); };
                    statusEl.textContent = 'Cliquez sur « Lancer » pour démarrer le quiz';
                    publishQuizState({ active: false, ended: false, counts: [], totalResponses: 0 });
                };
                updateResults({ ended: true });
                // Close peer after a delay
                setTimeout(() => { if (peer && !quizActive) { peer.destroy(); peer = null; } }, 5000);
            };

            publishQuizState({ active: false, ended: false });
            btnStart.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); startQuiz(); });
        });

        const parseDataJson = (raw, fallback) => {
            try { return JSON.parse(raw || 'null') ?? fallback; } catch (_) { return fallback; }
        };

        container.querySelectorAll('.sl-cloze-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const sentence = String(el.dataset.sentence || '');
            const safeSentence = SlidesRenderer.esc(sentence);
            const blanks = parseDataJson(el.dataset.blanks, []);
            const body = el.querySelector('.sl-cloze-body');
            const btn = el.querySelector('.sl-cloze-toggle');
            if (!body || !btn) return;
            let shown = false;
            const publishClozeState = (extraState = {}) => emitAudienceElementState(el, 'cloze', Object.assign({
                shown: !!shown,
                buttonLabel: String(btn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const render = () => {
                let i = 0;
                body.innerHTML = safeSentence.replace(/____/g, () => {
                    const ans = SlidesRenderer.esc(blanks[i++] || '...');
                    return shown
                        ? `<span style="padding:0 6px;border-bottom:2px solid #22c55e;color:#22c55e;font-weight:700;">${ans}</span>`
                        : `<span style="padding:0 12px;border-bottom:2px dashed var(--sl-primary,#818cf8);color:transparent;">___</span>`;
                });
                btn.textContent = shown ? 'Masquer les réponses' : 'Afficher les réponses';
            };
            if (isAudienceReadOnly) {
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.textContent = 'Piloté';
                subscribeAudienceElementState(el, 'cloze', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    shown = sync.shown === true;
                    render();
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    if (typeof sync.buttonLabel === 'string' && sync.buttonLabel.trim()) btn.textContent = sync.buttonLabel;
                });
                render();
                return;
            }
            btn.addEventListener('click', e => {
                e.preventDefault();
                shown = !shown;
                render();
                publishClozeState();
            });
            render();
            publishClozeState();
        });

        container.querySelectorAll('.sl-dnd-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const items = parseDataJson(el.dataset.items, []);
            const targets = parseDataJson(el.dataset.targets, []);
            const itemsHost = el.querySelector('.sl-dnd-items');
            const targetsHost = el.querySelector('.sl-dnd-targets');
            if (!itemsHost || !targetsHost) return;
            const cards = Array.isArray(items) ? items : [];
            const cols = (Array.isArray(targets) && targets.length ? targets : ['Zone A', 'Zone B']).slice(0, 4);

            itemsHost.innerHTML = cards.map((label, i) => `<button class="sl-dnd-item" data-i="${i}" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:grab;" draggable="true">${SlidesRenderer.esc(label)}</button>`).join('');
            targetsHost.innerHTML = cols.map((c, i) => `<div class="sl-dnd-target" data-t="${i}" style="flex:1;min-width:0;border:1px dashed var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;"><div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;">${SlidesRenderer.esc(c)}</div></div>`).join('');
            const syncDndState = () => emitAudienceElementState(el, 'drag-drop', {
                itemsHtml: itemsHost.innerHTML,
                targetsHtml: targetsHost.innerHTML,
            });
            if (isAudienceReadOnly) {
                itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                const title = el.querySelector('div');
                if (title && title.textContent) title.textContent = `${title.textContent} (piloté par le présentateur)`;
                subscribeAudienceElementState(el, 'drag-drop', state => {
                    if (!state || typeof state !== 'object') return;
                    if (typeof state.itemsHtml === 'string') itemsHost.innerHTML = state.itemsHtml;
                    if (typeof state.targetsHtml === 'string') targetsHost.innerHTML = state.targetsHtml;
                    itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                    targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            syncDndState();
            let dragHtml = '';
            itemsHost.querySelectorAll('.sl-dnd-item').forEach(btn => {
                btn.addEventListener('dragstart', e => {
                    dragHtml = btn.outerHTML;
                    e.dataTransfer?.setData('text/plain', btn.dataset.i || '');
                });
            });
            targetsHost.querySelectorAll('.sl-dnd-target').forEach(zone => {
                zone.addEventListener('dragover', e => e.preventDefault());
                zone.addEventListener('drop', e => {
                    e.preventDefault();
                    if (!dragHtml) return;
                    const marker = document.createElement('div');
                    marker.innerHTML = dragHtml;
                    const card = marker.firstElementChild;
                    if (!card) return;
                    card.setAttribute('draggable', 'false');
                    card.style.cursor = 'default';
                    zone.appendChild(card);
                    syncDndState();
                });
            });
        });

        container.querySelectorAll('.sl-mcqmulti-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answers = new Set(parseDataJson(el.dataset.answers, []).map(v => Number(v)));
            const host = el.querySelector('.sl-mcqmulti-options');
            const checkBtn = el.querySelector('.sl-mcqmulti-check');
            const endBtn = el.querySelector('.sl-mcqmulti-end');
            const result = el.querySelector('.sl-mcqmulti-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqMultiState = (extraState = {}) => emitAudienceElementState(el, 'mcq-multi', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-multi', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:5px;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-multi'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const totalSelections = Number(snap.totalSelections || 0);
                    const denom = totalSelections || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} répondant(s) · ${totalSelections} sélections</div>`;
                    publishMcqMultiState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        totalSelections,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-multi',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: true,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqMultiState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqMultiState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="checkbox" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqMultiState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const chosen = new Set(Array.from(host.querySelectorAll('input[data-opt]:checked')).map(inp => Number(inp.dataset.opt)));
                let good = 0;
                answers.forEach(v => { if (chosen.has(v)) good++; });
                const isPerfect = chosen.size === answers.size && good === answers.size;
                result.textContent = isPerfect ? 'Correct' : `${good}/${answers.size} bonne(s) réponse(s)`;
                result.style.color = isPerfect ? '#22c55e' : 'var(--sl-warning,#f59e0b)';
                publishMcqMultiState({
                    mode: 'local',
                    active: false,
                    selected: Array.from(chosen).slice(0, 24),
                    good,
                    expected: answers.size,
                    perfect: isPerfect,
                });
            });
        });

        container.querySelectorAll('.sl-mcqsingle-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answer = Number(el.dataset.answer ?? 0);
            const host = el.querySelector('.sl-mcqsingle-options');
            const checkBtn = el.querySelector('.sl-mcqsingle-check');
            const endBtn = el.querySelector('.sl-mcqsingle-end');
            const result = el.querySelector('.sl-mcqsingle-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqSingleState = (extraState = {}) => emitAudienceElementState(el, 'mcq-single', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-single', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-single'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const denom = total || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} réponse(s)</div>`;
                    publishMcqSingleState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-single',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: false,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqSingleState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqSingleState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            const groupName = `mcq-single-${Math.random().toString(36).slice(2)}`;
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="radio" name="${groupName}" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqSingleState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const selected = host.querySelector('input[data-opt]:checked');
                if (!selected) {
                    result.textContent = 'Sélectionnez une réponse';
                    result.style.color = 'var(--sl-warning,#f59e0b)';
                    publishMcqSingleState({ mode: 'local', active: false, selected: -1, checked: false });
                    return;
                }
                const chosen = Number(selected.dataset.opt);
                const ok = chosen === answer;
                result.textContent = ok ? 'Correct' : 'Incorrect';
                result.style.color = ok ? '#22c55e' : '#f87171';
                publishMcqSingleState({
                    mode: 'local',
                    active: false,
                    selected: chosen,
                    checked: true,
                    correct: ok,
                });
            });
        });

        container.querySelectorAll('.sl-polllive-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pollType = el.dataset.pollType === 'thumbs' ? 'thumbs' : 'scale5';
            const prompt = String(el.dataset.prompt || '').trim();
            const startBtn = el.querySelector('.sl-polllive-start');
            const endBtn = el.querySelector('.sl-polllive-end');
            const resultsEl = el.querySelector('.sl-polllive-results');
            if (!startBtn || !endBtn || !resultsEl) return;
            const publishPollState = (extraState = {}) => emitAudienceElementState(el, 'poll-live', Object.assign({
                pollType,
                prompt,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));

            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                resultsEl.innerHTML = '<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>';
                subscribeAudienceElementState(el, 'poll-live', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }

            const renderPoll = snap => {
                if (!snap || !snap.active) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Sondage inactif</div>`;
                    publishPollState({ active: false });
                    return;
                }
                const fallback = snap.type === 'thumbs' ? ['Pour', 'Contre'] : ['1', '2', '3', '4', '5'];
                const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : fallback;
                const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                const total = Number(snap.total || 0);
                const totalSelections = Number(snap.totalSelections || 0);
                const denom = snap.multi ? (totalSelections || 1) : (total || 1);
                resultsEl.innerHTML = labels.map((l, i) => {
                    const c = counts[i] || 0;
                    const pct = denom > 0 ? Math.round((c / denom) * 100) : 0;
                    return `<div style="display:grid;grid-template-columns:56px 1fr 70px;gap:8px;align-items:center;font-size:0.74rem;">
                        <span>${SlidesRenderer.esc(l)}</span>
                        <div style="height:14px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#a78bfa);"></div></div>
                        <span>${c} (${pct}%)</span>
                    </div>`;
                }).join('') + `<div style="margin-top:4px;font-size:0.72rem;color:var(--sl-muted,#64748b);">${
                    snap.multi ? `${total} répondant(s) · ${totalSelections} sélections` : `${total} réponse(s)`
                }</div>`;
                publishPollState({
                    active: true,
                    counts: counts.slice(0, 32),
                    options: labels.slice(0, 16),
                    total,
                    totalSelections,
                    multi: !!snap.multi,
                });
            };

            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribePoll) {
                renderPoll({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPollState({ active: false, roomActive: false });
                return;
            }
            const unsub = bridge.subscribePoll(snap => {
                if (snap?.active && snap.type === pollType) renderPoll(snap);
                else if (!snap?.active) renderPoll({ active: false });
            });
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startPoll?.(pollType, prompt);
                if (!ok) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</div>`;
                    publishPollState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endPoll?.(); });
            renderPoll(bridge.getPollSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-exitticket-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Exit ticket';
            const promptsRaw = parseDataJson(el.dataset.prompts, []);
            const prompts = (Array.isArray(promptsRaw) ? promptsRaw : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 4);
            const safePrompts = prompts.length ? prompts : ['Ce que je retiens', 'Ce qui reste flou', 'Question finale'];
            const promptsEl = el.querySelector('.sl-exitticket-prompts');
            const resultsEl = el.querySelector('.sl-exitticket-results');
            const startBtn = el.querySelector('.sl-exitticket-start');
            const endBtn = el.querySelector('.sl-exitticket-end');
            if (!promptsEl || !resultsEl || !startBtn || !endBtn) return;
            const publishExitTicketState = (extraState = {}) => emitAudienceElementState(el, 'exit-ticket', Object.assign({
                promptsHtml: promptsEl.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPrompts = () => {
                promptsEl.innerHTML = safePrompts.map((prompt, idx) => (
                    `<div style="padding:7px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);font-size:0.74rem;"><strong>${idx + 1}.</strong> ${SlidesRenderer.esc(prompt)}</div>`
                )).join('');
            };
            renderPrompts();
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'exit-ticket', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.promptsHtml === 'string') promptsEl.innerHTML = sync.promptsHtml;
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribeExitTicket) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                resultsEl.textContent = 'Mode présentateur requis';
                publishExitTicketState({ active: false, roomActive: false });
                return;
            }
            let liveTicketId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveTicketId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveTicketId = '';
                    renderPrompts();
                    publishExitTicketState({ active: false, ticketId: '' });
                    return;
                }
                const snapPrompts = Array.isArray(snap.prompts) ? snap.prompts : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapPrompts) === JSON.stringify(safePrompts);
                if (!liveTicketId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                        publishExitTicketState({ active: false, conflict: true });
                        return;
                    }
                    liveTicketId = String(snap.ticketId || '');
                }
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                    publishExitTicketState({ active: false, conflict: true });
                    return;
                }
                const responses = Array.isArray(snap.responses) ? snap.responses : [];
                const top = responses.slice(0, 3);
                resultsEl.innerHTML = `<div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-bottom:4px;">${Number(snap.responsesCount || 0)} réponse(s)</div>`
                    + (top.length
                        ? top.map(entry => {
                            const pseudo = SlidesRenderer.esc(entry?.pseudo || 'Anonyme');
                            const answers = (Array.isArray(entry?.answers) ? entry.answers : []).filter(Boolean).slice(0, 2);
                            const preview = answers.map(v => SlidesRenderer.esc(v)).join(' · ');
                            return `<div style="font-size:0.68rem;padding:5px 6px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;margin-top:4px;"><strong>${pseudo}</strong>${preview ? `: ${preview}` : ''}</div>`;
                        }).join('')
                        : '<div style="font-size:0.68rem;color:var(--sl-muted,#64748b);">En attente de réponses…</div>');
                publishExitTicketState({
                    active: true,
                    ticketId: String(snap.ticketId || liveTicketId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeExitTicket(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startExitTicket?.({ title, prompts: safePrompts });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un exit ticket est déjà actif)</span>';
                    publishExitTicketState({ active: false, startError: true });
                    return;
                }
                liveTicketId = String(started);
                publishExitTicketState({ active: true, ticketId: liveTicketId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getExitTicketSnapshot?.();
                if (!snap?.active) return;
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) return;
                bridge.endExitTicket?.();
            });
            renderLive(bridge.getExitTicketSnapshot?.() || { active: false, responses: [] });
        });

        container.querySelectorAll('.sl-postitlive-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const prompt = String(el.dataset.prompt || '').trim();
            const grid = el.querySelector('.sl-postitlive-grid');
            const startBtn = el.querySelector('.sl-postitlive-start');
            const endBtn = el.querySelector('.sl-postitlive-end');
            if (!grid || !startBtn || !endBtn) return;
            const publishPostitState = (extraState = {}) => emitAudienceElementState(el, 'postit-wall', Object.assign({
                gridHtml: grid.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>`;
                subscribeAudienceElementState(el, 'postit-wall', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.gridHtml === 'string') grid.innerHTML = sync.gridHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            const renderNotes = snap => {
                if (!snap || !snap.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Mur inactif</div>`;
                    publishPostitState({ active: false });
                    return;
                }
                const palette = [
                    ['#fde68a', '#78350f'],
                    ['#bfdbfe', '#1e3a8a'],
                    ['#bbf7d0', '#14532d'],
                    ['#fecdd3', '#881337'],
                    ['#ddd6fe', '#4c1d95'],
                ];
                grid.innerHTML = (snap.words || []).slice(0, 18).map(([txt, count], i) => {
                    const [bg, fg] = palette[i % palette.length];
                    return `<div style="background:${bg};color:${fg};border-radius:8px;padding:6px;font-size:0.68rem;line-height:1.3;min-height:40px;position:relative;">
                        ${SlidesRenderer.esc(txt)}
                        <span style="position:absolute;right:6px;bottom:4px;font-size:0.62rem;opacity:0.75;">×${count}</span>
                    </div>`;
                }).join('');
                publishPostitState({
                    active: true,
                    wordsCount: Array.isArray(snap.words) ? snap.words.length : 0,
                });
            };
            if (!bridge?.subscribeWordCloud) {
                renderNotes({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPostitState({ active: false, roomActive: false });
                return;
            }
            bridge.subscribeWordCloud(snap => renderNotes(snap));
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startWordCloud?.(prompt);
                if (!ok) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un mur est déjà actif)</div>`;
                    publishPostitState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endWordCloud?.(); });
            renderNotes(bridge.getWordCloudSnapshot?.() || { active: false, words: [] });
        });

        container.querySelectorAll('.sl-roulette-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pickBtn = el.querySelector('.sl-roulette-pick');
            const pickedEl = el.querySelector('.sl-roulette-picked');
            if (!pickBtn || !pickedEl) return;
            const publishRouletteState = (extraState = {}) => emitAudienceElementState(el, 'roulette', Object.assign({
                pickedHtml: pickedEl.innerHTML,
                pickedText: String(pickedEl.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPick = pseudo => {
                if (!pseudo) {
                    pickedEl.textContent = '';
                    publishRouletteState({ pseudo: '' });
                    return;
                }
                pickedEl.innerHTML = `<span class="sl-picked-inline-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></span><span>${SlidesRenderer.esc(pseudo)}</span>`;
                publishRouletteState({ pseudo: String(pseudo || '') });
            };
            if (isAudienceReadOnly) {
                pickBtn.disabled = true;
                pickBtn.style.pointerEvents = 'none';
                pickBtn.style.display = 'none';
                subscribeAudienceElementState(el, 'roulette', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.pickedHtml === 'string') pickedEl.innerHTML = sync.pickedHtml;
                    else if (typeof sync.pickedText === 'string') pickedEl.textContent = sync.pickedText;
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.pickRandomStudent) {
                pickBtn.disabled = true;
                pickBtn.textContent = 'Salle inactive';
                publishRouletteState({ roomActive: false });
                return;
            }
            bridge.subscribeRoulette?.(payload => {
                renderPick(payload?.pseudo || '');
            });
            pickBtn.addEventListener('click', e => {
                e.preventDefault();
                const pick = bridge.pickRandomStudent();
                if (!pick?.pseudo) {
                    pickedEl.textContent = 'Aucun étudiant connecté';
                    return;
                }
                renderPick(pick.pseudo);
            });
        });

        container.querySelectorAll('.sl-roomstats-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const metrics = parseDataJson(el.dataset.metrics, ['students', 'hands', 'questions', 'feedback']);
            const grid = el.querySelector('.sl-roomstats-grid');
            const foot = el.querySelector('.sl-roomstats-foot');
            if (!grid) return;
            if (isAudienceReadOnly) {
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>`;
                if (foot) foot.textContent = 'Stats détaillées visibles côté présentateur';
                return;
            }
            const labels = {
                students: 'Connectés',
                hands: 'Mains levées',
                questions: 'Questions',
                feedback: 'Feedback 10 min',
                poll: 'Sondage actif',
                wordcloud: 'Nuage actif',
            };
            const bridge = window.OEIRoomBridge;
            const renderStats = snap => {
                if (!snap?.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Stats indisponibles (salle inactive)</div>`;
                    if (foot) foot.textContent = 'Ouvrez la salle dans le mode présentateur';
                    return;
                }
                const metricKeys = (Array.isArray(metrics) && metrics.length ? metrics : ['students', 'hands', 'questions', 'feedback']).slice(0, 6);
                const valueFor = key => {
                    if (key === 'students') return Number(snap.studentsCount || 0);
                    if (key === 'hands') return Number(snap.handsCount || 0);
                    if (key === 'questions') return Number(snap.questionsOpen || 0);
                    if (key === 'feedback') return Number(snap.feedback10m?.total || 0);
                    if (key === 'poll') return snap.pollActive ? 'Oui' : 'Non';
                    if (key === 'wordcloud') return snap.wordCloudActive ? 'Oui' : 'Non';
                    return '--';
                };
                grid.innerHTML = metricKeys.map(key => `
                    <div style="padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000);">
                        <div style="font-size:0.64rem;color:var(--sl-muted,#64748b);text-transform:uppercase;">${SlidesRenderer.esc(labels[key] || key)}</div>
                        <div style="font-size:1.05rem;color:var(--sl-heading,#f1f5f9);font-weight:700;margin-top:2px;">${SlidesRenderer.esc(valueFor(key))}</div>
                    </div>
                `).join('');
                if (foot) foot.textContent = `Transport: ${SlidesRenderer.esc(snap.transport || 'p2p')}`;
            };
            if (!bridge?.subscribeRoom) {
                renderStats({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderStats);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderStats(bridge.getRoomSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-leaderboard-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const listEl = el.querySelector('.sl-leaderboard-list');
            const foot = el.querySelector('.sl-leaderboard-foot');
            const limit = Math.max(1, Math.min(20, Number(el.dataset.limit || 5)));
            if (!listEl) return;
            if (isAudienceReadOnly) {
                listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>';
                if (foot) foot.textContent = 'Classement détaillé visible côté présentateur';
                return;
            }
            const bridge = window.OEIRoomBridge;
            const renderBoard = snap => {
                if (!snap?.active) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Leaderboard indisponible (salle inactive)</div>';
                    if (foot) foot.textContent = 'Ouvrez la salle pour activer le classement';
                    return;
                }
                const rows = Array.isArray(snap.students) ? snap.students : [];
                const sorted = rows.slice().sort((a, b) => {
                    const ds = Number(b.score || 0) - Number(a.score || 0);
                    if (ds !== 0) return ds;
                    return String(a.pseudo || '').localeCompare(String(b.pseudo || ''), 'fr', { sensitivity: 'base' });
                }).slice(0, limit);
                if (!sorted.length) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Aucun étudiant connecté</div>';
                    if (foot) foot.textContent = 'En attente de participants';
                    return;
                }
                listEl.innerHTML = sorted.map((row, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="width:22px;font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="flex:1;color:var(--sl-text,#e2e8f0);font-size:0.72rem;">${SlidesRenderer.esc(row.pseudo || 'Anonyme')}</span>
                        <span style="color:var(--sl-heading,#f1f5f9);font-weight:700;font-size:0.72rem;">${Number(row.score || 0).toLocaleString()}</span>
                    </div>
                `).join('');
                if (foot) foot.textContent = `${sorted.length} / ${Number(snap.studentsCount || 0)} affichés`;
            };
            if (!bridge?.subscribeRoom) {
                renderBoard({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderBoard);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderBoard(bridge.getRoomSnapshot?.() || { active: false });
        });

        container.querySelectorAll('.sl-decisiontree-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector('.sl-dt-branches');
            const branches = parseDataJson(el.dataset.branches, []);
            if (!host) return;
            host.innerHTML = (Array.isArray(branches) ? branches : []).slice(0, 8).map(b => `
                <button style="pointer-events:auto;text-align:left;padding:7px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">
                    <div style="font-weight:700;">${SlidesRenderer.esc(b?.label || 'Branche')}</div>
                    <div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-top:2px;">${SlidesRenderer.esc(b?.outcome || '')}</div>
                </button>`).join('');
            if (isAudienceReadOnly) disableInteractiveControls(host);
        });

        container.querySelectorAll('.sl-codecompare-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector('.sl-codecompare-view');
            const slider = el.querySelector('.sl-codecompare-range');
            const before = String(el.dataset.before || '');
            const after = String(el.dataset.after || '');
            if (!host || !slider) return;
            host.innerHTML = `<pre style="position:absolute;inset:0;margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#cbd5e1;background:#0b1020;">${before}</pre>
                <div class="sl-codecompare-after-wrap" style="position:absolute;inset:0;overflow:hidden;width:50%;border-right:2px solid rgba(167,139,250,0.9);">
                    <pre style="margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#e2e8f0;background:#0f172a;">${after}</pre>
                </div>`;
            const afterWrap = host.querySelector('.sl-codecompare-after-wrap');
            const publishCodeCompareState = (extraState = {}) => emitAudienceElementState(el, 'code-compare', Object.assign({
                value: Number(slider.value) || 50,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                slider.disabled = true;
                slider.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'code-compare', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextValue = Number(sync.value);
                    if (!Number.isFinite(nextValue)) return;
                    const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
                    slider.value = String(clamped);
                    if (afterWrap) afterWrap.style.width = `${clamped}%`;
                });
                return;
            }
            slider.addEventListener('input', () => {
                if (afterWrap) afterWrap.style.width = `${slider.value}%`;
                publishCodeCompareState();
            });
            publishCodeCompareState();
        });

        container.querySelectorAll('.sl-algostepper-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const steps = parseDataJson(el.dataset.steps, []);
            const ttl = el.querySelector('.sl-algostepper-step-title');
            const det = el.querySelector('.sl-algostepper-step-detail');
            const code = el.querySelector('.sl-algostepper-code');
            const prev = el.querySelector('.sl-algostepper-prev');
            const next = el.querySelector('.sl-algostepper-next');
            if (!ttl || !det || !code || !prev || !next) return;
            let idx = 0;
            const render = () => {
                const step = steps[idx] || {};
                ttl.textContent = step.title || `Étape ${idx + 1}`;
                det.textContent = step.detail || '';
                code.textContent = step.code || '';
                prev.disabled = idx <= 0;
                next.disabled = idx >= steps.length - 1;
            };
            const publishAlgoStepperState = (extraState = {}) => emitAudienceElementState(el, 'algo-stepper', Object.assign({
                index: idx,
                total: Array.isArray(steps) ? steps.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'algo-stepper', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.index);
                    if (!Number.isFinite(nextIdx)) return;
                    const max = Math.max(0, steps.length - 1);
                    idx = Math.max(0, Math.min(max, Math.trunc(nextIdx)));
                    render();
                    prev.disabled = true;
                    next.disabled = true;
                    prev.style.pointerEvents = 'none';
                    next.style.pointerEvents = 'none';
                });
                render();
                return;
            }
            prev.addEventListener('click', e => {
                e.preventDefault();
                if (idx > 0) { idx--; render(); publishAlgoStepperState(); }
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                if (idx < steps.length - 1) { idx++; render(); publishAlgoStepperState(); }
            });
            render();
            publishAlgoStepperState();
        });

        container.querySelectorAll('.sl-galleryanno-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const src = String(el.dataset.src || '');
            const alt = String(el.dataset.alt || 'Image annotée');
            const notes = parseDataJson(el.dataset.notes, []);
            const stage = el.querySelector('.sl-galleryanno-stage');
            const caption = el.querySelector('.sl-galleryanno-caption');
            if (!stage || !caption) return;
            stage.innerHTML = src ? `<img src="${src}" alt="${SlidesRenderer.esc(alt)}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#64748b);font-size:0.74rem;">Image non définie</div>`;
            let activeIndex = 0;
            const publishGalleryState = (extraState = {}) => emitAudienceElementState(el, 'gallery-annotable', Object.assign({
                activeIndex,
                caption: String(caption.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            (Array.isArray(notes) ? notes : []).slice(0, 20).forEach((n, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.style.cssText = `position:absolute;left:${Math.max(5, Math.min(95, Number(n.x)||0))}%;top:${Math.max(5, Math.min(95, Number(n.y)||0))}%;transform:translate(-50%,-50%);width:19px;height:19px;border-radius:50%;border:none;background:#f43f5e;color:#fff;font-size:0.62rem;pointer-events:auto;cursor:pointer;`;
                b.textContent = String(i + 1);
                b.addEventListener('click', () => {
                    activeIndex = i;
                    caption.textContent = n.text || '';
                    publishGalleryState();
                });
                stage.appendChild(b);
            });
            caption.textContent = (notes[0]?.text) || '';
            if (isAudienceReadOnly) {
                disableInteractiveControls(stage);
                subscribeAudienceElementState(el, 'gallery-annotable', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.caption === 'string') caption.textContent = sync.caption;
                });
                return;
            }
            publishGalleryState();
        });

        container.querySelectorAll('.sl-kanban-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cols = parseDataJson(el.dataset.columns, []);
            const host = el.querySelector('.sl-kanban-cols');
            if (!host) return;
            host.innerHTML = (Array.isArray(cols) ? cols : []).slice(0, 4).map(col => `<div class="sl-kb-col" style="flex:1;min-width:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;">
                <div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;text-transform:uppercase;">${SlidesRenderer.esc(col?.name || '')}</div>
                ${(Array.isArray(col?.cards) ? col.cards : []).slice(0, 6).map((c, i) => `<div class="sl-kb-card" draggable="true" data-card="${i}" style="pointer-events:auto;padding:5px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;font-size:0.68rem;cursor:grab;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${SlidesRenderer.esc(c)}</div>`).join('')}
            </div>`).join('');
            const publishKanbanState = (extraState = {}) => emitAudienceElementState(el, 'kanban-mini', Object.assign({
                hostHtml: host.innerHTML,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                disableInteractiveControls(host);
                host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                subscribeAudienceElementState(el, 'kanban-mini', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            let dragged = null;
            host.querySelectorAll('.sl-kb-card').forEach(card => {
                card.addEventListener('dragstart', () => { dragged = card; });
            });
            host.querySelectorAll('.sl-kb-col').forEach(col => {
                col.addEventListener('dragover', e => e.preventDefault());
                col.addEventListener('drop', e => {
                    e.preventDefault();
                    if (dragged) {
                        col.appendChild(dragged);
                        publishKanbanState();
                    }
                });
            });
            publishKanbanState();
        });

        container.querySelectorAll('.sl-rankorder-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Classement';
            const initialItems = parseDataJson(el.dataset.items, []);
            const host = el.querySelector('.sl-rankorder-list');
            const resultsEl = el.querySelector('.sl-rankorder-results');
            const startBtn = el.querySelector('.sl-rankorder-start');
            const endBtn = el.querySelector('.sl-rankorder-end');
            if (!host || !resultsEl || !startBtn || !endBtn) return;
            const items = (Array.isArray(initialItems) ? initialItems : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 8);
            const safeItems = items.length >= 2 ? items : ['Option A', 'Option B', 'Option C'];
            const publishRankOrderState = (extraState = {}) => emitAudienceElementState(el, 'rank-order', Object.assign({
                listHtml: host.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startVisible: startBtn.style.display !== 'none',
                endVisible: endBtn.style.display !== 'none',
                startLabel: String(startBtn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderEditable = () => {
                host.innerHTML = safeItems.map((item, i) => `
                    <div class="sl-rankorder-row" data-idx="${i}" style="display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        <span style="display:flex;gap:4px;">
                            <button type="button" class="sl-rank-up" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↑</button>
                            <button type="button" class="sl-rank-down" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↓</button>
                        </span>
                    </div>
                `).join('');
                host.querySelectorAll('.sl-rank-up').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i <= 0) return;
                        [safeItems[i - 1], safeItems[i]] = [safeItems[i], safeItems[i - 1]];
                        renderEditable();
                    });
                });
                host.querySelectorAll('.sl-rank-down').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i >= safeItems.length - 1) return;
                        [safeItems[i], safeItems[i + 1]] = [safeItems[i + 1], safeItems[i]];
                        renderEditable();
                    });
                });
                publishRankOrderState({
                    mode: 'local',
                    active: false,
                    order: safeItems.slice(0, 16),
                });
            };
            const renderRankRows = rows => {
                const src = Array.isArray(rows) ? rows : [];
                if (!src.length) {
                    host.innerHTML = safeItems.map((item, i) => `
                        <div style="display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                            <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                            <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        </div>
                    `).join('');
                    return;
                }
                host.innerHTML = src.map((row, i) => `
                    <div style="display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${SlidesRenderer.esc(row?.label || '')}</span>
                        <span style="font-size:0.68rem;color:var(--sl-muted,#64748b);">${Number(row?.score || 0)} pts</span>
                    </div>
                `).join('');
            };
            if (isAudienceReadOnly) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                disableInteractiveControls(host);
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'rank-order', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.listHtml === 'string') host.innerHTML = sync.listHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startVisible === 'boolean') startBtn.style.display = sync.startVisible ? '' : 'none';
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = window.OEIRoomBridge;
            if (!bridge?.subscribeRankOrder) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                resultsEl.textContent = 'Réorganisez localement la liste';
                renderEditable();
                publishRankOrderState({ mode: 'local', active: false });
                return;
            }
            let liveRankId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveRankId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveRankId = '';
                    renderRankRows([]);
                    publishRankOrderState({ mode: 'live', active: false, rankId: '' });
                    return;
                }
                const snapItems = Array.isArray(snap.items) ? snap.items : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapItems) === JSON.stringify(safeItems);
                if (!liveRankId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                        publishRankOrderState({ mode: 'live', active: false, conflict: true });
                        return;
                    }
                    liveRankId = String(snap.rankId || '');
                }
                if (liveRankId && String(snap.rankId || '') !== liveRankId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                    publishRankOrderState({ mode: 'live', active: false, conflict: true });
                    return;
                }
                renderRankRows(snap.rows);
                resultsEl.innerHTML = `<span style="color:var(--sl-muted,#64748b);">${Number(snap.responsesCount || 0)} participant(s)</span>`;
                publishRankOrderState({
                    mode: 'live',
                    active: true,
                    rankId: String(snap.rankId || liveRankId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeRankOrder(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startRankOrder?.({ title, items: safeItems });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un classement est déjà actif)</span>';
                    publishRankOrderState({ mode: 'live', active: false, startError: true });
                    return;
                }
                liveRankId = String(started);
                publishRankOrderState({ mode: 'live', active: true, rankId: liveRankId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getRankOrderSnapshot?.();
                if (!snap?.active) return;
                if (liveRankId && String(snap.rankId || '') !== liveRankId) return;
                bridge.endRankOrder?.();
            });
            renderLive(bridge.getRankOrderSnapshot?.() || { active: false, rows: [] });
        });

        container.querySelectorAll('.sl-myth-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const card = el.querySelector('.sl-flip-card');
            if (!card) return;
            let flipped = false;
            const applyFlip = nextState => {
                flipped = !!nextState;
                card.classList.toggle('is-flipped', flipped);
            };
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'myth-reality', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    applyFlip(sync.flipped === true);
                });
                applyFlip(false);
                return;
            }
            card.addEventListener('click', () => {
                applyFlip(!flipped);
                emitAudienceElementState(el, 'myth-reality', { flipped });
            });
            emitAudienceElementState(el, 'myth-reality', { flipped: false });
        });

        container.querySelectorAll('.sl-flashcards-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cards = parseDataJson(el.dataset.cards, []);
            const card = el.querySelector('.sl-flashcards-card');
            const front = el.querySelector('.sl-flashcards-front');
            const back = el.querySelector('.sl-flashcards-back');
            const prev = el.querySelector('.sl-flashcards-prev');
            const next = el.querySelector('.sl-flashcards-next');
            if (!card || !front || !back || !prev || !next || !cards.length) return;
            let idx = 0;
            let flipped = false;
            const render = () => {
                const c = cards[idx] || {};
                front.innerHTML = `<div><div class="sl-flip-face-label">Question</div>${SlidesRenderer.esc(c.front || '')}</div>`;
                back.innerHTML = `<div><div class="sl-flip-face-label">Réponse</div>${SlidesRenderer.esc(c.back || '')}</div>`;
                card.classList.toggle('is-flipped', !!flipped);
            };
            const publishFlashcardsState = (extraState = {}) => emitAudienceElementState(el, 'flashcards', Object.assign({
                idx,
                flipped,
                total: Array.isArray(cards) ? cards.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'flashcards', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.idx);
                    if (Number.isFinite(nextIdx)) {
                        idx = ((Math.trunc(nextIdx) % cards.length) + cards.length) % cards.length;
                    }
                    flipped = !!sync.flipped;
                    render();
                });
                render();
                return;
            }
            card.addEventListener('click', () => {
                flipped = !flipped;
                render();
                publishFlashcardsState();
            });
            prev.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx - 1 + cards.length) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx + 1) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            render();
            publishFlashcardsState();
        });
    }

    const api = Object.freeze({
        mountSpecialElements,
    });

    global.OEISlidesSpecialRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis);
