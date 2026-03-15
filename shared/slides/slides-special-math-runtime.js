/*
 * slides-special-math-runtime.js — runtime LaTeX, Mermaid, Timer, Quiz statique
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

    /**
     * Monte les éléments math/timer/quiz-statique dans le container.
     * @param {Element} container
     * @param {{ SlidesRenderer, isAudienceReadOnly, emitAudienceElementState, subscribeAudienceElementState }} ctx
     */
    async function mountMathElements(container, ctx) {
        const SlidesRenderer = ctx?.SlidesRenderer;
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitAudienceElementState = ctx?.emitAudienceElementState || (() => false);
        const subscribeAudienceElementState = ctx?.subscribeAudienceElementState || (() => () => {});

        // ── LaTeX (KaTeX) ──
        const latexEls = container.querySelectorAll('.sl-latex-pending');
        if (latexEls.length) {
            if (!global._slKatexLoaded) {
                global._slKatexLoaded = true;
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
            if (global.katex) {
                latexEls.forEach(el => {
                    const target = el.querySelector('.sl-latex-render');
                    if (!target || target.dataset.rendered) return;
                    const expr = el.dataset.latex || '';
                    try {
                        target.innerHTML = global.katex.renderToString(expr, { displayMode: true, throwOnError: false });
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
            if (!global._slMermaidLoaded) {
                global._slMermaidLoaded = true;
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '../vendor/mermaid/10.9.1/mermaid.min.js';
                    s.onload = () => {
                        global.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                        resolve();
                    };
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            if (global.mermaid) {
                for (const el of mermaidEls) {
                    const target = el.querySelector('.sl-mermaid-render');
                    const src = el.querySelector('pre');
                    if (!target || !src || target.dataset.rendered) continue;
                    try {
                        const id = 'sl-mm-' + Math.random().toString(36).slice(2, 9);
                        const { svg } = await global.mermaid.render(id, src.textContent);
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
    }

    global.OEISlidesSpecialMathRuntime = Object.freeze({ mountMathElements });
})(typeof window !== 'undefined' ? window : globalThis);
