// @ts-check
import { buildReplayStandalonePayload } from '../../shared/slides/replay-contract.mjs';

const _pvEsc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Build standalone replay HTML document from presenter runtime inputs.
 * This keeps viewer-main thin while preserving the existing replay UX.
 */
export function buildReplayStandaloneHtml({
    title = '',
    slides = [],
    data = {},
    session = null,
    audioDataUrl = '',
    themeCss = '',
    slidesRenderer = null,
    slidesShared = null,
} = {}) {
    if (!slidesRenderer || typeof slidesRenderer.renderSlide !== 'function' || typeof slidesRenderer._buildChapterNumbers !== 'function') {
        throw new Error('buildReplayStandaloneHtml: slidesRenderer invalide');
    }
    if (!slidesShared || typeof slidesShared.resolveTypographyDefaults !== 'function') {
        throw new Error('buildReplayStandaloneHtml: slidesShared invalide');
    }
    const replayOpts = {
        showSlideNumber: false,
        footerText: null,
        totalSlides: slides.length,
        chapterNumbers: slidesRenderer._buildChapterNumbers(slides, data.autoNumberChapters),
        typography: slidesShared.resolveTypographyDefaults(data.typography),
    };
    const payload = buildReplayStandalonePayload({
        title,
        generatedAt: new Date().toISOString(),
        dimensions: { width: 1280, height: 720 },
        slidesHtml: slides.map((slide, i) => slidesRenderer.renderSlide(slide, i, replayOpts)),
        themeCss: themeCss || '',
        session,
        audioDataUrl: audioDataUrl || '',
    });
    const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${_pvEsc(title)} — Replay</title>
    <style>
*{box-sizing:border-box}
:root{
    --rp-bg:#0b1120;
    --rp-text:#e2e8f0;
    --rp-muted:#94a3b8;
    --rp-surface:#0f172a;
    --rp-surface-hover:#111c34;
    --rp-surface-soft:#111c34;
    --rp-border:rgba(148,163,184,.4);
    --rp-stage-bg:#020617;
    --rp-black:rgba(0,0,0,.92);
}
html,body{margin:0;padding:0;height:100%;overflow:hidden;background:var(--rp-bg);color:var(--rp-text);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{height:100dvh;display:flex;flex-direction:column}
body.rp-light{
    --rp-bg:#f4f7fb;
    --rp-text:#0f172a;
    --rp-muted:#475569;
    --rp-surface:#ffffff;
    --rp-surface-hover:#eef3ff;
    --rp-surface-soft:#e2e8f0;
    --rp-border:rgba(15,23,42,.2);
    --rp-stage-bg:#dbe4f5;
    --rp-black:rgba(15,23,42,.58);
}
.rp-app{width:min(1460px,100%);height:100%;margin:0 auto;padding:12px;display:grid;grid-template-rows:auto 1fr auto;gap:10px}
.rp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.rp-title{font-size:1rem;font-weight:700;line-height:1.2}
.rp-meta{font-size:.76rem;color:var(--rp-muted)}
.rp-stage-wrap{position:relative;width:100%;height:100%;min-height:0;background:var(--rp-stage-bg);border:1px solid var(--rp-border);border-radius:12px;overflow:hidden;box-shadow:0 12px 32px rgba(2,6,23,.20)}
.rp-reveal{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:top left}
.rp-reveal .slides{position:relative;width:100%;height:100%}
.rp-reveal .slides > section{position:absolute;inset:0}
.rp-black{position:absolute;inset:0;background:var(--rp-black);opacity:0;pointer-events:none;transition:opacity .16s}
.rp-black.active{opacity:1}
.rp-controls{display:grid;grid-template-columns:auto auto auto auto auto minmax(140px,1fr) auto auto;gap:8px;align-items:center}
.rp-btn,.rp-select{height:32px;border-radius:8px;border:1px solid var(--rp-border);background:var(--rp-surface);color:var(--rp-text);padding:0 10px;font-size:.76rem;cursor:pointer}
.rp-btn:hover,.rp-select:hover{background:var(--rp-surface-hover)}
.rp-btn svg{width:14px;height:14px;vertical-align:-2px}
.rp-btn.rp-play{min-width:90px}
.rp-time{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.74rem;color:var(--rp-text);min-width:124px;text-align:right}
.rp-progress{position:relative;width:100%;height:12px;border:1px solid var(--rp-border);border-radius:999px;background:var(--rp-surface-soft);padding:0;cursor:pointer}
.rp-progress:hover{background:var(--rp-surface-hover)}
.rp-progress:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
.rp-progress[disabled]{cursor:default;opacity:.5}
.rp-progress-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:999px;background:linear-gradient(90deg,#0ea5e9,#22d3ee)}
.rp-slide-count{font-size:.75rem;color:var(--rp-muted);text-align:right}
.rp-audio-note{font-size:.72rem;color:var(--rp-muted)}
.fragment{opacity:0;visibility:hidden;transition:opacity .2s ease, transform .2s ease}
.fragment.visible{opacity:1;visibility:inherit}
@media (max-width:1080px){
    .rp-app{padding:10px}
    .rp-controls{grid-template-columns:auto auto auto auto auto;grid-template-areas:"prev play next restart speed" "progress progress progress time count"}
    #rp-prev{grid-area:prev}
    #rp-play{grid-area:play}
    #rp-next{grid-area:next}
    #rp-restart{grid-area:restart}
    #rp-speed{grid-area:speed}
    #rp-progress{grid-area:progress}
    #rp-time{grid-area:time;text-align:right}
    #rp-slide-count{grid-area:count}
}
    </style>
    <style id="rp-theme"></style>
</head>
<body>
    <div class="rp-app">
        <div class="rp-head">
<div>
    <div class="rp-title">${_pvEsc(title)} — Replay</div>
    <div class="rp-meta" id="rp-meta"></div>
</div>
<div class="rp-audio-note" id="rp-audio-note"></div>
        </div>
        <div class="rp-stage-wrap" id="rp-stage-wrap">
<div class="reveal rp-reveal" id="rp-reveal">
    <div class="slides" id="rp-slide-root"></div>
</div>
<div class="rp-black" id="rp-black"></div>
        </div>
        <div class="rp-controls">
<button class="rp-btn" id="rp-prev" type="button" title="Slide précédente">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
</button>
<button class="rp-btn rp-play" id="rp-play" type="button" title="Lecture / pause">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>
    Lecture
</button>
<button class="rp-btn" id="rp-next" type="button" title="Slide suivante">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
</button>
<button class="rp-progress" id="rp-progress" type="button" title="Aller à un instant" aria-label="Progression du replay">
    <span class="rp-progress-fill" id="rp-progress-fill"></span>
</button>
<div class="rp-time" id="rp-time">00:00 / 00:00</div>
<select class="rp-select" id="rp-speed" title="Vitesse de lecture">
    <option value="0.75">0.75x</option>
    <option value="1" selected>1x</option>
    <option value="1.25">1.25x</option>
    <option value="1.5">1.5x</option>
    <option value="2">2x</option>
</select>
<button class="rp-btn" id="rp-restart" type="button" title="Revenir au début">Début</button>
<div class="rp-slide-count" id="rp-slide-count"></div>
        </div>
    </div>
    <audio id="rp-audio" preload="auto" style="display:none"></audio>
    <script id="rp-data" type="application/json">${payloadJson}</script>
    <script>
(function() {
    var payload;
    try {
        payload = JSON.parse((document.getElementById('rp-data') || {}).textContent || '{}');
    } catch (_) {
        payload = {};
    }
    var slides = Array.isArray(payload.slidesHtml) ? payload.slidesHtml : [];
    var session = payload.session && typeof payload.session === 'object' ? payload.session : {};
    var events = Array.isArray(session.events) ? session.events.slice() : [];
    events.sort(function(a, b) { return (Number(a && a.t || 0) - Number(b && b.t || 0)); });
    var totalSlides = slides.length;
    var durationMs = Math.max(0, Number(session.durationMs || 0));
    var audioUrl = String(payload.audioDataUrl || '');
    var themeCss = String(payload.themeCss || '');

    var stageWrap = document.getElementById('rp-stage-wrap');
    var reveal = document.getElementById('rp-reveal');
    var slideRoot = document.getElementById('rp-slide-root');
    var blackEl = document.getElementById('rp-black');
    var playBtn = document.getElementById('rp-play');
    var prevBtn = document.getElementById('rp-prev');
    var nextBtn = document.getElementById('rp-next');
    var restartBtn = document.getElementById('rp-restart');
    var speedEl = document.getElementById('rp-speed');
    var progressEl = document.getElementById('rp-progress');
    var progressFillEl = document.getElementById('rp-progress-fill');
    var timeEl = document.getElementById('rp-time');
    var countEl = document.getElementById('rp-slide-count');
    var metaEl = document.getElementById('rp-meta');
    var audioNoteEl = document.getElementById('rp-audio-note');
    var audioEl = document.getElementById('rp-audio');
    var themeEl = document.getElementById('rp-theme');

    themeEl.textContent = themeCss;
    function parseRgbColor(value) {
        var src = String(value || '').trim();
        if (!src) return null;
        var rgbMatch = src.match(/^rgba?\(([^)]+)\)$/i);
        if (rgbMatch) {
var parts = rgbMatch[1].split(',').map(function(part) { return Number(String(part || '').trim()); });
if (parts.length >= 3 && parts.slice(0, 3).every(function(n) { return Number.isFinite(n); })) {
    return parts.slice(0, 3).map(function(n) { return clamp(Math.round(n), 0, 255); });
}
return null;
        }
        var hex = src.replace('#', '');
        if (hex.length === 3 || hex.length === 4) {
var expanded = hex.split('').map(function(ch) { return ch + ch; }).join('');
hex = expanded.slice(0, 6);
        }
        if (hex.length === 6 && /^[0-9a-f]+$/i.test(hex)) {
return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
];
        }
        return null;
    }
    function applyReplayUiTheme() {
        var style = window.getComputedStyle(document.documentElement);
        var bgCandidate = String(style.getPropertyValue('--sl-bg') || style.getPropertyValue('--sl-slide-bg') || '').trim();
        var rgb = parseRgbColor(bgCandidate);
        var isLight = false;
        if (rgb) {
var luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
isLight = luminance >= 0.58;
        } else if (window.matchMedia) {
isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        document.body.classList.toggle('rp-light', !!isLight);
    }
    applyReplayUiTheme();
    metaEl.textContent = totalSlides + ' slides · durée ' + fmtClock(durationMs);

    if (audioUrl) {
        audioEl.src = audioUrl;
        audioNoteEl.textContent = 'Audio synchronisé intégré';
    } else {
        audioEl.removeAttribute('src');
        audioNoteEl.textContent = 'Aucun audio (replay visuel uniquement)';
    }

    if (progressEl) progressEl.disabled = !(durationMs > 0);

    var playbackRate = 1;
    var playheadMs = 0;
    var playing = false;
    var rafId = 0;
    var wallStartMs = 0;
    var lastRenderedSlide = -1;
    var manualSlideIndex = null;

    var slideAnchors = [];
    for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var tp = String(ev && ev.type || '');
        var p = ev && ev.payload && typeof ev.payload === 'object' ? ev.payload : {};
        if (tp === 'record:start' || tp === 'goTo') {
var idx = toSlideIndex(p.index, totalSlides);
if (idx !== null) slideAnchors.push({ t: Math.max(0, Number(ev.t || 0)), index: idx });
        }
    }
    if (!slideAnchors.length && totalSlides > 0) slideAnchors.push({ t: 0, index: 0 });

    function fmtClock(ms) {
        var total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
        var min = String(Math.floor(total / 60)).padStart(2, '0');
        var sec = String(total % 60).padStart(2, '0');
        return min + ':' + sec;
    }
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    function toInt(v) {
        var n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    function toSlideIndex(v, total) {
        var n = toInt(v);
        if (n === null) return null;
        if (n < 0 || n >= total) return null;
        return n;
    }
    function getFragments(container) {
        if (!container) return [];
        return Array.from(container.querySelectorAll('.fragment')).sort(function(a, b) {
var ia = a.dataset.fragmentIndex != null ? parseInt(a.dataset.fragmentIndex, 10) : Number.POSITIVE_INFINITY;
var ib = b.dataset.fragmentIndex != null ? parseInt(b.dataset.fragmentIndex, 10) : Number.POSITIVE_INFINITY;
if (ia !== ib) return ia - ib;
return 0;
        });
    }
    function computeStateAt(ms) {
        var state = { index: 0, fragmentIndex: -1, black: false };
        for (var i = 0; i < events.length; i++) {
var entry = events[i];
var t = Math.max(0, Number(entry && entry.t || 0));
if (t > ms) break;
var type = String(entry && entry.type || '');
var payload = entry && entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
if (type === 'record:start') {
    var rIdx = toSlideIndex(payload.index, totalSlides);
    if (rIdx !== null) state.index = rIdx;
    var rFrag = toInt(payload.fragmentIndex);
    state.fragmentIndex = rFrag !== null ? rFrag : -1;
    state.black = false;
    continue;
}
if (type === 'goTo') {
    var nextIdx = toSlideIndex(payload.index, totalSlides);
    if (nextIdx !== null) {
        state.index = nextIdx;
        state.fragmentIndex = -1;
        state.black = false;
    }
    continue;
}
if (type === 'fragment') {
    var slideIdx = toSlideIndex(payload.slideIndex, totalSlides);
    if (slideIdx !== null && slideIdx !== state.index) continue;
    var frag = toInt(payload.fragmentIndex);
    if (frag === null) continue;
    if (payload.hidden) state.fragmentIndex = Math.min(state.fragmentIndex, frag - 1);
    else state.fragmentIndex = Math.max(state.fragmentIndex, frag);
    continue;
}
if (type === 'black') {
    state.black = !!payload.on;
}
        }
        state.index = clamp(state.index, 0, Math.max(0, totalSlides - 1));
        return state;
    }
    function renderState(state) {
        if (!state || !totalSlides) return;
        if (state.index !== lastRenderedSlide) {
slideRoot.innerHTML = slides[state.index] || '';
var section = slideRoot.querySelector('section');
if (section) {
    var notes = section.querySelector('aside.notes');
    if (notes) notes.remove();
}
lastRenderedSlide = state.index;
        }
        var frags = getFragments(slideRoot);
        for (var i = 0; i < frags.length; i++) {
frags[i].classList.toggle('visible', i <= state.fragmentIndex);
        }
        blackEl.classList.toggle('active', !!state.black);
        countEl.textContent = 'Slide ' + (state.index + 1) + ' / ' + totalSlides;
        prevBtn.disabled = state.index <= 0;
        nextBtn.disabled = state.index >= (totalSlides - 1);
    }
    function updateTimeUi() {
        var ms = Math.max(0, Math.round(playheadMs));
        if (progressFillEl) {
var ratio = durationMs > 0 ? clamp(ms / durationMs, 0, 1) : 0;
progressFillEl.style.width = (ratio * 100).toFixed(3) + '%';
        }
        timeEl.textContent = fmtClock(ms) + ' / ' + fmtClock(durationMs);
    }
    function syncAudio(force) {
        if (!audioUrl) return;
        var target = Math.max(0, playheadMs / 1000);
        try {
if (force || Math.abs((audioEl.currentTime || 0) - target) > 0.2) audioEl.currentTime = target;
audioEl.playbackRate = playbackRate;
if (playing && audioEl.paused) audioEl.play().catch(function() {});
if (!playing && !audioEl.paused) audioEl.pause();
        } catch (_) {}
    }
    function seek(ms, forceAudio) {
        playheadMs = clamp(Number(ms || 0), 0, durationMs);
        if (manualSlideIndex != null) manualSlideIndex = null;
        renderState(computeStateAt(playheadMs));
        updateTimeUi();
        syncAudio(!!forceAudio);
        if (playing) {
wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        }
    }
    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    }
    function tick() {
        if (!playing) return;
        playheadMs = clamp((performance.now() - wallStartMs) * playbackRate, 0, durationMs);
        renderState(computeStateAt(playheadMs));
        updateTimeUi();
        syncAudio(false);
        if (playheadMs >= durationMs) {
setPlaying(false);
return;
        }
        rafId = requestAnimationFrame(tick);
    }
    function setPlayBtnLabel(isPlaying) {
        if (isPlaying) {
playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1"/><rect x="13.5" y="6" width="3.5" height="12" rx="1"/></svg>Pause';
return;
        }
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Lecture';
    }
    function findNearestAnchorForSlide(targetIndex) {
        var best = null;
        var bestDist = Number.POSITIVE_INFINITY;
        for (var i = 0; i < slideAnchors.length; i++) {
var a = slideAnchors[i];
if (a.index !== targetIndex) continue;
var d = Math.abs(a.t - playheadMs);
if (d < bestDist) {
    bestDist = d;
    best = a.t;
}
        }
        return best;
    }
    function setPlaying(next) {
        if (!!next === playing) return;
        playing = !!next;
        setPlayBtnLabel(playing);
        if (!playing) {
stopLoop();
syncAudio(false);
return;
        }
        if (manualSlideIndex != null) {
var anchor = findNearestAnchorForSlide(manualSlideIndex);
manualSlideIndex = null;
if (anchor != null) seek(anchor, true);
        }
        if (playheadMs >= durationMs) seek(0, true);
        wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        syncAudio(true);
        tick();
    }
    function jumpSlide(delta) {
        var baseState = manualSlideIndex != null
? { index: manualSlideIndex, fragmentIndex: -1, black: false }
: computeStateAt(playheadMs);
        var target = clamp(baseState.index + delta, 0, Math.max(0, totalSlides - 1));
        if (target === baseState.index) return;
        setPlaying(false);
        var anchor = findNearestAnchorForSlide(target);
        if (anchor != null) {
seek(anchor, true);
return;
        }
        manualSlideIndex = target;
        renderState({ index: target, fragmentIndex: -1, black: false });
    }
    function scaleStage() {
        var w = stageWrap.clientWidth || 1;
        var h = stageWrap.clientHeight || 1;
        var sx = w / 1280;
        var sy = h / 720;
        var scale = Math.min(sx, sy);
        var scaledW = 1280 * scale;
        var scaledH = 720 * scale;
        var offsetX = Math.round((w - scaledW) / 2);
        var offsetY = Math.round((h - scaledH) / 2);
        reveal.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
    }

    playBtn.addEventListener('click', function() { setPlaying(!playing); });
    prevBtn.addEventListener('click', function() { jumpSlide(-1); });
    nextBtn.addEventListener('click', function() { jumpSlide(1); });
    restartBtn.addEventListener('click', function() {
        setPlaying(false);
        seek(0, true);
    });
    speedEl.addEventListener('change', function() {
        var v = Number(speedEl.value);
        playbackRate = Number.isFinite(v) ? clamp(v, 0.5, 2) : 1;
        if (playing) wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        syncAudio(true);
    });
    if (progressEl) {
        progressEl.addEventListener('click', function(ev) {
if (durationMs <= 0) return;
var rect = progressEl.getBoundingClientRect();
if (!rect || !rect.width) return;
var ratio = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
seek(ratio * durationMs, true);
        });
        progressEl.addEventListener('keydown', function(ev) {
if (durationMs <= 0) return;
if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Home' || ev.key === 'End') {
    ev.preventDefault();
}
if (ev.key === 'ArrowLeft') {
    seek(playheadMs - 5000, true);
} else if (ev.key === 'ArrowRight') {
    seek(playheadMs + 5000, true);
} else if (ev.key === 'Home') {
    seek(0, true);
} else if (ev.key === 'End') {
    seek(durationMs, true);
}
        });
    }
    window.addEventListener('resize', scaleStage);
    document.addEventListener('keydown', function(ev) {
        if (ev.key === ' ' || ev.key === 'k' || ev.key === 'K') {
ev.preventDefault();
setPlaying(!playing);
        } else if (ev.key === 'ArrowLeft') {
ev.preventDefault();
jumpSlide(-1);
        } else if (ev.key === 'ArrowRight') {
ev.preventDefault();
jumpSlide(1);
        } else if (ev.key === 'Home') {
ev.preventDefault();
setPlaying(false);
seek(0, true);
        }
    });

    setPlayBtnLabel(false);
    scaleStage();
    if (durationMs > 0) {
        seek(0, true);
    } else if (totalSlides > 0) {
        renderState({ index: 0, fragmentIndex: -1, black: false });
        updateTimeUi();
    }
})();
    </script>
</body>
</html>`;
}
