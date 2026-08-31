/*
 * slides-special-math-runtime.js — runtime LaTeX, Mermaid, Timer, Quiz statique
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 *
 * Les hooks de classe sont paramétrés par `ctx.prefix` ('sl' pour le viewer, 'cel' pour
 * l'éditeur canvas). Défaut : 'sl' → comportement identique au viewer historique.
 * Les chargeurs KaTeX / Mermaid sont exposés (`ensureKatexLoaded` / `ensureMermaidLoaded`)
 * pour être réutilisés par slides-canvas-special-runtime.js — une seule implémentation du
 * chargement (et un seul point d'init de Mermaid).
 */
(function(global){
    'use strict';

    /**
     * Monte les éléments math/timer/quiz-statique dans le container.
     * @param {Element} container
     * @param {{ prefix?: 'sl'|'cel', SlidesRenderer, isAudienceReadOnly, emitAudienceElementState, subscribeAudienceElementState }} ctx
     */
    const _esc = str => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    /** Choisit le thème Mermaid ('dark' / 'default') selon la luminance du fond de slide résolu. */
    function _mermaidThemeForSlide() {
        try {
            const cs = getComputedStyle(document.documentElement);
            const raw = (cs.getPropertyValue('--sl-slide-bg') || cs.getPropertyValue('--sl-bg') || '').trim();
            const m = raw.match(/^#?([0-9a-f]{6})$/i) || raw.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
            let r, g, b;
            if (m && m[1] && m[1].length === 6) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
            else if (m && m[3] !== undefined) { r = +m[1]; g = +m[2]; b = +m[3]; }
            if (r === undefined) return 'default';
            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            return lum < 0.5 ? 'dark' : 'default';
        } catch (_) { return 'default'; }
    }

    /**
     * Charge KaTeX (CSS + JS) une seule fois. Résout `true` si prêt, `false` si l'échec est
     * définitif (`global._slKatexFailed` est alors positionné).
     * @returns {Promise<boolean>}
     */
    function ensureKatexLoaded() {
        if (global._slKatexLoadPromise) return global._slKatexLoadPromise;
        global._slKatexLoadPromise = new Promise((resolve) => {
            if (global.katex) { resolve(true); return; }
            try {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '../vendor/katex/0.16.11/katex.min.css';
                document.head.appendChild(link);
            } catch (_) {}
            const s = document.createElement('script');
            s.src = '../vendor/katex/0.16.11/katex.min.js';
            s.onload = () => resolve(true);
            s.onerror = () => { global._slKatexFailed = true; resolve(false); };
            document.head.appendChild(s);
        });
        return global._slKatexLoadPromise;
    }

    /**
     * Charge Mermaid une seule fois et l'initialise (thème selon le fond de slide).
     * @returns {Promise<boolean>}
     */
    function ensureMermaidLoaded() {
        if (global._slMermaidLoadPromise) return global._slMermaidLoadPromise;
        global._slMermaidLoadPromise = new Promise((resolve) => {
            if (global.mermaid) { resolve(true); return; }
            const s = document.createElement('script');
            s.src = '../vendor/mermaid/10.9.1/mermaid.min.js';
            s.onload = () => {
                try {
                    global.mermaid.initialize({ startOnLoad: false, theme: _mermaidThemeForSlide(), securityLevel: 'loose' });
                } catch (_) {}
                resolve(true);
            };
            s.onerror = () => { global._slMermaidFailed = true; resolve(false); };
            document.head.appendChild(s);
        });
        return global._slMermaidLoadPromise;
    }

    const _renderError = (label, detail, source) => `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
            padding:12px 16px;border-radius:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);
            color:#f87171;font-size:0.78rem;font-family:var(--mono,monospace);text-align:left;max-width:100%;">
            <div style="font-weight:700;letter-spacing:.02em;">⚠ ${_esc(label)}</div>
            ${detail ? `<div style="opacity:.8;word-break:break-word;">${_esc(detail)}</div>` : ''}
            ${source ? `<pre style="margin:4px 0 0;padding:6px 8px;border-radius:4px;background:rgba(0,0,0,.25);
                white-space:pre-wrap;word-break:break-all;font-size:0.72rem;max-height:80px;overflow:auto;">${_esc(source)}</pre>` : ''}
        </div>`;

    async function mountMathElements(container, ctx) {
        const P = (ctx && ctx.prefix) || 'sl';
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitAudienceElementState = ctx?.emitAudienceElementState || (() => false);
        const subscribeAudienceElementState = ctx?.subscribeAudienceElementState || (() => () => {});

        // ── LaTeX (KaTeX) ──
        const latexEls = container.querySelectorAll(`.${P}-latex-pending`);
        if (latexEls.length) {
            await ensureKatexLoaded();
            latexEls.forEach(el => {
                const target = el.querySelector(`.${P}-latex-render`);
                if (!target || target.dataset.rendered) return;
                const expr = el.dataset.latex || '';
                if (global._slKatexFailed || !global.katex) {
                    target.innerHTML = _renderError('KaTeX introuvable', 'Impossible de charger le moteur LaTeX', expr);
                    return;
                }
                try {
                    target.innerHTML = global.katex.renderToString(expr, { displayMode: true, throwOnError: true });
                    target.dataset.rendered = '1';
                } catch (e) {
                    target.innerHTML = _renderError('Erreur LaTeX', e.message, expr);
                }
            });
        }

        // ── Mermaid ──
        const mermaidEls = container.querySelectorAll(`.${P}-mermaid-pending`);
        if (mermaidEls.length) {
            await ensureMermaidLoaded();
            for (const el of mermaidEls) {
                const target = el.querySelector(`.${P}-mermaid-render`);
                const src = el.querySelector('pre');
                if (!target || !src || target.dataset.rendered) continue;
                if (global._slMermaidFailed || !global.mermaid) {
                    target.innerHTML = _renderError('Mermaid introuvable', 'Impossible de charger le moteur de diagrammes', src.textContent.trim().slice(0, 80));
                    continue;
                }
                try {
                    const id = 'sl-mm-' + Math.random().toString(36).slice(2, 9);
                    const { svg } = await global.mermaid.render(id, src.textContent);
                    target.innerHTML = svg;
                    const svgEl = target.querySelector('svg');
                    if (svgEl) {
                        svgEl.style.maxWidth = '100%';
                        svgEl.style.maxHeight = '100%';
                        svgEl.style.height = 'auto';
                    }
                    target.dataset.rendered = '1';
                } catch (e) {
                    target.innerHTML = _renderError('Erreur Mermaid', e.message, src.textContent.trim().slice(0, 120));
                }
            }
        }

        // ── Timer (interactive countdown) ──
        container.querySelectorAll(`.${P}-timer-content`).forEach(el => {
            if (el.dataset.timerBound) return;
            el.dataset.timerBound = '1';
            const dur = parseInt(el.dataset.duration) || 300;
            let remaining = dur, interval = null, running = false;
            const display = el.querySelector(`.${P}-timer-display`);
            const btnStart = el.querySelector(`.${P}-timer-start`);
            const btnPause = el.querySelector(`.${P}-timer-pause`);
            const btnReset = el.querySelector(`.${P}-timer-reset`);
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
                    if (sync.ended === true || remaining <= 0) display.classList.add(`${P}-timer-ended`);
                    else display.classList.remove(`${P}-timer-ended`);
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
                    display.classList.add(`${P}-timer-ended`);
                    publishTimerState({ ended: true, running: false });
                }
            };
            btnStart.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                if (!running && remaining > 0) {
                    running = true; display.classList.remove(`${P}-timer-ended`);
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
                display.classList.remove(`${P}-timer-ended`);
                btnStart.style.display = ''; btnPause.style.display = 'none';
                publishTimerState({ running: false, ended: false });
            });
            publishTimerState({ running: false, ended: false });
        });

        // ── Quiz interaction (click to reveal answer) ──
        container.querySelectorAll(`.${P}-quiz-options[data-answer]`).forEach(optionsEl => {
            if (optionsEl.dataset.quizBound) return;
            optionsEl.dataset.quizBound = '1';
            const correctIdx = optionsEl.dataset.answer;
            if (correctIdx === '') return; // no answer defined
            const options = optionsEl.querySelectorAll(`.${P}-quiz-option`);
            const applyQuizRevealState = state => {
                const sync = (state && typeof state === 'object') ? state : {};
                if (sync.answered !== true) return;
                optionsEl.dataset.quizAnswered = '1';
                options.forEach(o => {
                    if (o.dataset.idx === correctIdx) o.classList.add(`${P}-quiz-correct`);
                    else o.classList.add(`${P}-quiz-wrong`);
                });
                const section = optionsEl.closest('section');
                if (section) {
                    const expl = section.querySelector(`.${P}-quiz-explanation`);
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

    global.OEISlidesSpecialMathRuntime = Object.freeze({ mountMathElements, ensureKatexLoaded, ensureMermaidLoaded });
})(typeof window !== 'undefined' ? window : globalThis);
