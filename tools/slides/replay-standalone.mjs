#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SLIDES_CORE_PATH = path.join(REPO_ROOT, 'shared', 'slides', 'slides-core.js');
const DEFAULT_SLIDE_MS = 8000;
const LEVEL_VALUES = [1, 2, 3, 4];

const MIME_BY_EXT = {
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.mp4': 'audio/mp4',
    '.oga': 'audio/ogg',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
};

function parseNumeric(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function parseLevelValue(value) {
    const n = parseNumeric(value);
    if (n == null) return null;
    const int = Math.trunc(n);
    return LEVEL_VALUES.includes(int) ? int : null;
}

function appendLevelValues(target, value) {
    if (Array.isArray(value)) {
        value.forEach(item => appendLevelValues(target, item));
        return;
    }
    if (typeof value === 'string' && value.includes(',')) {
        value.split(',').forEach(part => appendLevelValues(target, part.trim()));
        return;
    }
    const parsed = parseLevelValue(value);
    if (parsed != null) target.push(parsed);
}

export function normalizeSlideLevels(slide) {
    if (!slide || typeof slide !== 'object') return [];
    const values = [];
    appendLevelValues(values, slide.levels);
    appendLevelValues(values, slide.level);
    if (slide.metadata && typeof slide.metadata === 'object') {
        appendLevelValues(values, slide.metadata.levels);
        appendLevelValues(values, slide.metadata.level);
    }
    return Array.from(new Set(values)).sort((a, b) => a - b);
}

function sanitizeSlideWithLevels(slide) {
    if (!slide || typeof slide !== 'object') return slide;
    const levels = normalizeSlideLevels(slide);
    const next = { ...slide };
    if (levels.length) {
        next.levels = levels.slice();
        delete next.level;
    } else {
        delete next.levels;
        delete next.level;
    }
    return next;
}

function sanitizeSlidesDataWithLevels(slidesData) {
    if (!slidesData || typeof slidesData !== 'object') return slidesData;
    const slides = Array.isArray(slidesData.slides) ? slidesData.slides : [];
    const sanitizedSlides = slides.map(slide => sanitizeSlideWithLevels(slide));
    return { ...slidesData, slides: sanitizedSlides };
}

function inferSlideTitle(slide, index) {
    if (!slide || typeof slide !== 'object') return `Slide ${index + 1}`;
    const direct = String(slide.title || '').trim();
    if (direct) return direct;
    const heading = String(slide.heading || '').trim();
    if (heading) return heading;
    if (Array.isArray(slide.items) && slide.items.length) {
        const first = String(slide.items[0] || '').trim();
        if (first) return first.slice(0, 80);
    }
    return `Slide ${index + 1}`;
}

function buildSlidesMeta(slides) {
    return slides.map((slide, index) => ({
        index,
        title: inferSlideTitle(slide, index),
        levels: normalizeSlideLevels(slide),
    }));
}

function parseClockToMs(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) return parseNumeric(raw);
    const clockMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!clockMatch) return null;
    const h = clockMatch[3] != null ? Number(clockMatch[1]) : 0;
    const m = clockMatch[3] != null ? Number(clockMatch[2]) : Number(clockMatch[1]);
    const s = clockMatch[3] != null ? Number(clockMatch[3]) : Number(clockMatch[2]);
    const msRaw = clockMatch[4] || '';
    const ms = msRaw ? Number(msRaw.padEnd(3, '0')) : 0;
    if (![h, m, s, ms].every(Number.isFinite)) return null;
    return (h * 3600 + m * 60 + s) * 1000 + ms;
}

export function parseTimeMs(value) {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const num = parseClockToMs(value);
        if (num != null) return num;
        const iso = Date.parse(value);
        if (Number.isFinite(iso)) return iso;
        return null;
    }
    return null;
}

function firstTimeCandidate(source) {
    if (!source || typeof source !== 'object') return null;
    const keys = ['at', 't', 'startMs', 'timestampMs', 'timeMs', 'timestamp', 'start', 'time'];
    for (const key of keys) {
        const parsed = parseTimeMs(source[key]);
        if (parsed != null) return parsed;
    }
    return null;
}

function firstSlideIndexCandidate(source, fallback = null) {
    if (!source || typeof source !== 'object') return fallback;
    const keys = ['slideIndex', 'index', 'slide'];
    for (const key of keys) {
        const n = parseNumeric(source[key]);
        if (n != null) return Math.trunc(n);
    }
    return fallback;
}

export function extractTimelineAnchors(slidesData) {
    const out = [];
    const timeline = Array.isArray(slidesData?.timeline) ? slidesData.timeline : [];
    for (const entry of timeline) {
        if (!entry || typeof entry !== 'object') continue;
        const at = firstTimeCandidate(entry);
        const index = firstSlideIndexCandidate(entry, null);
        if (at == null || index == null || index < 0) continue;
        out.push({ index, at: Math.max(0, at) });
    }

    if (out.length) {
        out.sort((a, b) => a.at - b.at || a.index - b.index);
        return dedupeAnchors(out);
    }

    const slides = Array.isArray(slidesData?.slides) ? slidesData.slides : [];
    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        let at = firstTimeCandidate(slide);
        if (at == null && slide?.recording && typeof slide.recording === 'object') {
            at = firstTimeCandidate(slide.recording);
        }
        if (at == null && slide?.metadata && typeof slide.metadata === 'object') {
            at = firstTimeCandidate(slide.metadata);
        }
        if (at == null) continue;
        out.push({ index: i, at: Math.max(0, at) });
    }

    out.sort((a, b) => a.at - b.at || a.index - b.index);
    return dedupeAnchors(out);
}

function dedupeAnchors(anchors) {
    const deduped = [];
    let prevKey = '';
    for (const anchor of anchors) {
        const key = `${anchor.index}:${anchor.at}`;
        if (key === prevKey) continue;
        deduped.push(anchor);
        prevKey = key;
    }
    return deduped;
}

function normalizeSessionEvents(events, slideCount) {
    if (!Array.isArray(events)) return [];
    const out = [];
    for (const entry of events) {
        if (!entry || typeof entry !== 'object') continue;
        const t = Math.max(0, parseNumeric(entry.t) ?? 0);
        const type = String(entry.type || '').trim();
        if (!type) continue;
        const payload = (entry.payload && typeof entry.payload === 'object') ? { ...entry.payload } : {};
        if ((type === 'goTo' || type === 'record:start') && payload.index != null) {
            const idx = Math.trunc(parseNumeric(payload.index) ?? -1);
            if (idx < 0 || idx >= slideCount) continue;
            payload.index = idx;
        }
        if (type === 'fragment' && payload.slideIndex != null) {
            const idx = Math.trunc(parseNumeric(payload.slideIndex) ?? -1);
            if (idx < 0 || idx >= slideCount) continue;
            payload.slideIndex = idx;
        }
        out.push({ type, t, payload });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
}

export function normalizeReplaySession({ slidesData, sessionData, defaultSlideMs = DEFAULT_SLIDE_MS }) {
    const slides = Array.isArray(slidesData?.slides) ? slidesData.slides : [];
    const slideCount = slides.length;

    if (slideCount === 0) {
        return {
            version: 2,
            durationMs: 0,
            events: [],
            captions: [],
            source: 'empty',
        };
    }

    if (sessionData && typeof sessionData === 'object' && Array.isArray(sessionData.events)) {
        const events = normalizeSessionEvents(sessionData.events, slideCount);
        const maxEventMs = events.reduce((acc, entry) => Math.max(acc, entry.t), 0);
        const durationMs = Math.max(
            0,
            parseNumeric(sessionData.durationMs) ?? 0,
            maxEventMs
        );
        return {
            ...sessionData,
            version: parseNumeric(sessionData.version) ?? 2,
            durationMs,
            events,
            captions: Array.isArray(sessionData.captions) ? sessionData.captions : [],
            source: 'session',
        };
    }

    let anchors = extractTimelineAnchors(slidesData);
    if (!anchors.length) {
        anchors = slides.map((_, index) => ({ index, at: index * Math.max(1000, defaultSlideMs) }));
    }

    const shift = anchors.length ? anchors[0].at : 0;
    const shifted = anchors.map(anchor => ({ index: anchor.index, at: Math.max(0, anchor.at - shift) }));
    shifted.sort((a, b) => a.at - b.at || a.index - b.index);

    const events = [];
    const first = shifted[0] || { index: 0, at: 0 };
    events.push({ type: 'record:start', t: first.at, payload: { index: first.index, fragmentIndex: -1 } });
    for (let i = 1; i < shifted.length; i++) {
        const anchor = shifted[i];
        events.push({ type: 'goTo', t: anchor.at, payload: { index: anchor.index } });
    }

    const fallbackTail = Math.max(1000, defaultSlideMs);
    const inferredDuration = shifted.length
        ? shifted[shifted.length - 1].at + fallbackTail
        : fallbackTail;

    return {
        version: 2,
        createdAt: new Date().toISOString(),
        durationMs: inferredDuration,
        events,
        captions: [],
        source: 'timestamps',
    };
}

function detectMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
}

async function fileToDataUrl(filePath) {
    const buf = await fs.readFile(filePath);
    const mime = detectMimeType(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
}

function buildAudioTracksLayout({
    audioFiles,
    audioStarts,
    anchors,
    durationMs,
}) {
    if (!audioFiles.length) return [];
    const starts = [];
    if (audioStarts.length === audioFiles.length) {
        for (const value of audioStarts) starts.push(Math.max(0, Math.trunc(Number(value) || 0)));
    } else if (audioFiles.length > 1 && anchors.length >= audioFiles.length) {
        for (let i = 0; i < audioFiles.length; i++) starts.push(Math.max(0, Math.trunc(Number(anchors[i]?.at || 0))));
    } else {
        starts.push(0);
        for (let i = 1; i < audioFiles.length; i++) starts.push(starts[i - 1] + 1);
    }

    const tracks = audioFiles.map((file, index) => ({
        file,
        label: path.basename(file),
        startMs: starts[index],
        endMs: null,
        offsetMs: 0,
    }));
    tracks.sort((a, b) => a.startMs - b.startMs);

    for (let i = 0; i < tracks.length; i++) {
        const next = tracks[i + 1];
        if (next) tracks[i].endMs = Math.max(tracks[i].startMs, next.startMs);
    }
    if (tracks.length && Number.isFinite(durationMs) && durationMs > 0) {
        tracks[tracks.length - 1].endMs = Math.max(tracks[tracks.length - 1].startMs, durationMs);
    }
    return tracks;
}

export function normalizeInlineAudioTracks(rawTracks, durationMs = 0) {
    if (!Array.isArray(rawTracks)) return [];
    const tracks = [];
    for (const raw of rawTracks) {
        if (!raw || typeof raw !== 'object') continue;
        const startMs = Math.max(0, Math.trunc(parseNumeric(raw.startMs) ?? 0));
        const endMsRaw = parseNumeric(raw.endMs);
        const endMs = endMsRaw == null ? null : Math.max(startMs, Math.trunc(endMsRaw));
        const offsetMs = Math.max(0, Math.trunc(parseNumeric(raw.offsetMs) ?? 0));
        const label = String(raw.label || '').trim();
        let dataUrl = String(raw.dataUrl || '').trim();
        if (!dataUrl && raw.base64) {
            const mime = String(raw.mimeType || 'audio/webm').trim() || 'audio/webm';
            dataUrl = `data:${mime};base64,${String(raw.base64).trim()}`;
        }
        if (!dataUrl.startsWith('data:')) continue;
        tracks.push({
            startMs,
            endMs,
            offsetMs,
            label: label || `audio-${tracks.length + 1}`,
            dataUrl,
        });
    }
    tracks.sort((a, b) => a.startMs - b.startMs);
    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].endMs != null) continue;
        const next = tracks[i + 1];
        tracks[i].endMs = next ? Math.max(tracks[i].startMs, next.startMs) : Math.max(tracks[i].startMs, durationMs);
    }
    return tracks;
}

export async function buildReplayPayload({
    slidesData,
    sessionData = null,
    audioFiles = [],
    audioStarts = [],
    inlineAudioTracks = [],
    defaultSlideMs = DEFAULT_SLIDE_MS,
    title = '',
}) {
    const normalizedSlidesData = sanitizeSlidesDataWithLevels(slidesData);
    const slides = Array.isArray(normalizedSlidesData?.slides) ? normalizedSlidesData.slides : [];
    const slidesMeta = buildSlidesMeta(slides);
    const session = normalizeReplaySession({ slidesData: normalizedSlidesData, sessionData, defaultSlideMs });
    const events = Array.isArray(session.events) ? session.events : [];
    const anchors = events
        .filter(entry => entry?.type === 'goTo' || entry?.type === 'record:start')
        .map(entry => ({ index: Math.trunc(Number(entry?.payload?.index || 0)), at: Math.max(0, Number(entry?.t || 0)) }))
        .sort((a, b) => a.at - b.at || a.index - b.index);

    const maxEventMs = events.reduce((acc, entry) => Math.max(acc, Number(entry?.t || 0)), 0);
    const durationMs = Math.max(0, Number(session.durationMs || 0), maxEventMs);

    let audioTracks = normalizeInlineAudioTracks(inlineAudioTracks, durationMs);
    if (!audioTracks.length) {
        const layout = buildAudioTracksLayout({
            audioFiles,
            audioStarts,
            anchors,
            durationMs,
        });
        for (const item of layout) {
            audioTracks.push({
                startMs: item.startMs,
                endMs: item.endMs,
                offsetMs: item.offsetMs,
                label: item.label,
                dataUrl: await fileToDataUrl(item.file),
            });
        }
    }

    return {
        title: String(title || normalizedSlidesData?.metadata?.title || 'Replay de session'),
        generatedAt: new Date().toISOString(),
        dimensions: { width: 1280, height: 720 },
        slidesData: normalizedSlidesData,
        slidesMeta,
        session: {
            ...session,
            durationMs: Math.max(durationMs, ...audioTracks.map(track => Number(track.endMs) || 0)),
        },
        audioTracks,
    };
}

function escHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function buildReplayStandaloneHtml(payload) {
    const slidesCoreCode = await fs.readFile(SLIDES_CORE_PATH, 'utf8');
    const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
    const safeTitle = escHtml(payload?.title || 'Replay de session');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0b1120;color:#e2e8f0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{min-height:100vh;display:flex;flex-direction:column}
.rp-app{width:min(1400px,100%);margin:0 auto;padding:16px 16px 18px;display:flex;flex-direction:column;gap:12px}
.rp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.rp-title{font-size:1rem;font-weight:700;line-height:1.2}
.rp-meta{font-size:.76rem;color:#94a3b8}
.rp-stage-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#020617;border:1px solid rgba(148,163,184,.35);border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(2,6,23,.45)}
.rp-reveal{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:top left}
.rp-reveal .slides{position:relative;width:100%;height:100%}
.rp-reveal .slides > section{position:absolute;inset:0}
.rp-black{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .16s}
.rp-black.active{opacity:1}
.rp-controls{display:grid;grid-template-columns:auto auto auto 1fr auto auto;gap:8px;align-items:center}
.rp-btn,.rp-select{height:34px;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:#0f172a;color:#e2e8f0;padding:0 10px;font-size:.78rem;cursor:pointer}
.rp-btn:hover,.rp-select:hover{background:#111c34}
.rp-btn svg{width:14px;height:14px;vertical-align:-2px}
.rp-btn.rp-play{min-width:98px}
.rp-time{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.74rem;color:#cbd5e1;min-width:124px;text-align:right}
.rp-timeline{width:100%;height:34px;accent-color:#38bdf8}
.rp-slide-count{font-size:.75rem;color:#94a3b8;text-align:right}
.rp-audio-note{font-size:.72rem;color:#94a3b8}
.rp-levels{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:.72rem;color:#cbd5e1}
.rp-level-label{color:#94a3b8}
.rp-level-badge{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:20px;padding:0 6px;border-radius:999px;border:1px solid rgba(56,189,248,.45);background:rgba(15,23,42,.92);font-weight:700;color:#67e8f9}
.fragment{opacity:0;visibility:hidden;transition:opacity .2s ease, transform .2s ease}
.fragment.visible{opacity:1;visibility:inherit}
@media (max-width:960px){
  .rp-app{padding:12px}
  .rp-controls{grid-template-columns:auto auto auto 1fr;grid-template-areas:'prev play next time' 'timeline timeline timeline timeline' 'speed restart count count'}
  #rp-prev{grid-area:prev}
  #rp-play{grid-area:play}
  #rp-next{grid-area:next}
  #rp-time{grid-area:time;text-align:right}
  #rp-timeline{grid-area:timeline}
  #rp-speed{grid-area:speed}
  #rp-restart{grid-area:restart}
  #rp-slide-count{grid-area:count}
}
</style>
<style id="rp-theme"></style>
</head>
<body>
<div class="rp-app">
  <div class="rp-head">
    <div>
      <div class="rp-title" id="rp-title"></div>
      <div class="rp-meta" id="rp-meta"></div>
      <div class="rp-levels" id="rp-levels" hidden><span class="rp-level-label">Niveaux:</span></div>
    </div>
    <div class="rp-audio-note" id="rp-audio-note"></div>
  </div>
  <div class="rp-stage-wrap" id="rp-stage-wrap">
    <div class="reveal rp-reveal" id="rp-reveal"><div class="slides" id="rp-slide-root"></div></div>
    <div class="rp-black" id="rp-black"></div>
  </div>
  <div class="rp-controls">
    <button class="rp-btn" id="rp-prev" type="button" title="Slide précédente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
    <button class="rp-btn rp-play" id="rp-play" type="button" title="Lecture / pause"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Lecture</button>
    <button class="rp-btn" id="rp-next" type="button" title="Slide suivante"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
    <input class="rp-timeline" id="rp-timeline" type="range" min="0" max="1000" step="10" value="0">
    <div class="rp-time" id="rp-time">00:00 / 00:00</div>
    <select class="rp-select" id="rp-speed" title="Vitesse de lecture"><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select>
    <button class="rp-btn" id="rp-restart" type="button" title="Revenir au début">Début</button>
    <div class="rp-slide-count" id="rp-slide-count"></div>
  </div>
</div>
<audio id="rp-audio" preload="auto" style="display:none"></audio>
<script>${slidesCoreCode}</script>
<script id="rp-data" type="application/json">${payloadJson}</script>
<script>
(function(){
  var payload;
  try { payload = JSON.parse((document.getElementById('rp-data') || {}).textContent || '{}'); }
  catch (_) { payload = {}; }

  var slidesData = payload.slidesData && typeof payload.slidesData === 'object' ? payload.slidesData : {};
  var slides = Array.isArray(slidesData.slides) ? slidesData.slides : [];
  var slidesMeta = Array.isArray(payload.slidesMeta) ? payload.slidesMeta : [];
  var session = payload.session && typeof payload.session === 'object' ? payload.session : {};
  var events = Array.isArray(session.events) ? session.events.slice() : [];
  events.sort(function(a,b){ return Number(a && a.t || 0) - Number(b && b.t || 0); });
  var tracks = Array.isArray(payload.audioTracks) ? payload.audioTracks.slice() : [];
  tracks.sort(function(a,b){ return Number(a && a.startMs || 0) - Number(b && b.startMs || 0); });

  var title = String(payload.title || slidesData?.metadata?.title || 'Replay de session');
  var totalSlides = slides.length;
  var maxEventMs = events.reduce(function(acc, e){ return Math.max(acc, Number(e && e.t || 0)); }, 0);
  var maxTrackEnd = tracks.reduce(function(acc, tr){ return Math.max(acc, Number(tr && tr.endMs || 0)); }, 0);
  var durationMs = Math.max(0, Number(session.durationMs || 0), maxEventMs, maxTrackEnd);

  var stageWrap = document.getElementById('rp-stage-wrap');
  var reveal = document.getElementById('rp-reveal');
  var slideRoot = document.getElementById('rp-slide-root');
  var blackEl = document.getElementById('rp-black');
  var playBtn = document.getElementById('rp-play');
  var prevBtn = document.getElementById('rp-prev');
  var nextBtn = document.getElementById('rp-next');
  var restartBtn = document.getElementById('rp-restart');
  var speedEl = document.getElementById('rp-speed');
  var timeline = document.getElementById('rp-timeline');
  var timeEl = document.getElementById('rp-time');
  var countEl = document.getElementById('rp-slide-count');
  var metaEl = document.getElementById('rp-meta');
  var levelsEl = document.getElementById('rp-levels');
  var audioNoteEl = document.getElementById('rp-audio-note');
  var audioEl = document.getElementById('rp-audio');
  var themeEl = document.getElementById('rp-theme');
  var titleEl = document.getElementById('rp-title');

  titleEl.textContent = title + ' — Replay';
  document.title = title + ' — Replay';

  var allThemes = (window.SlidesThemes && window.SlidesThemes.list) ? window.SlidesThemes.list() : (window.SlidesThemes && window.SlidesThemes.BUILT_IN ? window.SlidesThemes.BUILT_IN : {});
  var themeInput = (typeof slidesData.theme === 'string')
    ? (allThemes[slidesData.theme] || allThemes.dark || slidesData.theme)
    : (slidesData.theme || allThemes.dark || {});

  try {
    themeEl.textContent = (window.SlidesThemes && window.SlidesThemes.generateCSS)
      ? window.SlidesThemes.generateCSS(themeInput)
      : '';
  } catch (_) {
    themeEl.textContent = '';
  }

  var replayOpts = (window.SlidesShared && window.SlidesShared.buildRenderOptions)
    ? window.SlidesShared.buildRenderOptions(slidesData, { showSlideNumber: false, footerText: null })
    : {
      showSlideNumber: false,
      footerText: null,
      totalSlides: totalSlides,
      chapterNumbers: (window.SlidesRenderer && window.SlidesRenderer._buildChapterNumbers)
        ? window.SlidesRenderer._buildChapterNumbers(slides, !!slidesData.autoNumberChapters)
        : {},
      typography: (window.SlidesShared && window.SlidesShared.resolveTypographyDefaults)
        ? window.SlidesShared.resolveTypographyDefaults(slidesData.typography)
        : {},
    };

  var slideCache = new Map();
  function renderSlideHtml(index) {
    if (slideCache.has(index)) return slideCache.get(index);
    var html = '';
    try {
      if (window.SlidesRenderer && window.SlidesRenderer.renderSlide) {
        html = window.SlidesRenderer.renderSlide(slides[index] || {}, index, replayOpts);
      } else {
        html = '<section><h2>Slide ' + (index + 1) + '</h2></section>';
      }
    } catch (err) {
      html = '<section><h2>Slide ' + (index + 1) + '</h2><p>Erreur de rendu</p></section>';
    }
    slideCache.set(index, html);
    return html;
  }

  metaEl.textContent = totalSlides + ' slides · durée ' + fmtClock(durationMs);
  if (!tracks.length) audioNoteEl.textContent = 'Aucun audio (replay visuel uniquement)';
  else if (tracks.length === 1) audioNoteEl.textContent = 'Audio synchronisé intégré';
  else audioNoteEl.textContent = tracks.length + ' pistes audio synchronisées';

  timeline.max = String(Math.max(0, durationMs));
  timeline.step = '10';
  timeline.value = '0';

  var playbackRate = 1;
  var playheadMs = 0;
  var playing = false;
  var rafId = 0;
  var wallStartMs = 0;
  var lastRenderedSlide = -1;
  var manualSlideIndex = null;
  var activeTrackIndex = -1;
  var pendingSeekSeconds = null;

  audioEl.addEventListener('loadedmetadata', function(){
    if (pendingSeekSeconds == null) return;
    try { audioEl.currentTime = pendingSeekSeconds; } catch (_) {}
    pendingSeekSeconds = null;
    if (playing) audioEl.play().catch(function(){});
  });

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
  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
  function toInt(v){ var n=Number(v); return Number.isFinite(n)?Math.trunc(n):null; }
  function toSlideIndex(v,total){ var n=toInt(v); if(n==null||n<0||n>=total) return null; return n; }
  function getFragments(container){
    if(!container) return [];
    return Array.from(container.querySelectorAll('.fragment')).sort(function(a,b){
      var ia = a.dataset.fragmentIndex != null ? parseInt(a.dataset.fragmentIndex,10) : Number.POSITIVE_INFINITY;
      var ib = b.dataset.fragmentIndex != null ? parseInt(b.dataset.fragmentIndex,10) : Number.POSITIVE_INFINITY;
      if (ia !== ib) return ia - ib;
      return 0;
    });
  }

  function renderSlideLevels(index){
    if (!levelsEl) return;
    levelsEl.textContent = '';
    var label = document.createElement('span');
    label.className = 'rp-level-label';
    label.textContent = 'Niveaux:';
    levelsEl.appendChild(label);
    var meta = slidesMeta[index] && typeof slidesMeta[index] === 'object' ? slidesMeta[index] : {};
    var levels = Array.isArray(meta.levels) ? meta.levels : [];
    if (!levels.length) {
      var none = document.createElement('span');
      none.textContent = 'non défini';
      none.style.color = '#94a3b8';
      levelsEl.appendChild(none);
      levelsEl.hidden = false;
      return;
    }
    for (var i=0; i<levels.length; i++) {
      var badge = document.createElement('span');
      badge.className = 'rp-level-badge';
      badge.textContent = 'N' + String(levels[i]);
      levelsEl.appendChild(badge);
    }
    levelsEl.hidden = false;
  }

  function computeStateAt(ms){
    var state = { index:0, fragmentIndex:-1, black:false };
    for (var i=0;i<events.length;i++) {
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
      if (type === 'black') state.black = !!payload.on;
    }
    state.index = clamp(state.index, 0, Math.max(0, totalSlides - 1));
    return state;
  }

  function renderState(state){
    if (!state || !totalSlides) return;
    if (state.index !== lastRenderedSlide) {
      slideRoot.innerHTML = renderSlideHtml(state.index);
      var section = slideRoot.querySelector('section');
      if (section) {
        var notes = section.querySelector('aside.notes');
        if (notes) notes.remove();
      }
      lastRenderedSlide = state.index;
    }
    var frags = getFragments(slideRoot);
    for (var i=0;i<frags.length;i++) frags[i].classList.toggle('visible', i <= state.fragmentIndex);
    blackEl.classList.toggle('active', !!state.black);
    countEl.textContent = 'Slide ' + (state.index + 1) + ' / ' + totalSlides;
    renderSlideLevels(state.index);
    prevBtn.disabled = state.index <= 0;
    nextBtn.disabled = state.index >= (totalSlides - 1);
  }

  function updateTimeUi() {
    var ms = Math.max(0, Math.round(playheadMs));
    timeline.value = String(ms);
    timeEl.textContent = fmtClock(ms) + ' / ' + fmtClock(durationMs);
  }

  function findTrackForMs(ms) {
    if (!tracks.length) return -1;
    for (var i=0;i<tracks.length;i++) {
      var tr = tracks[i] || {};
      var start = Math.max(0, Number(tr.startMs || 0));
      var end = Number.isFinite(Number(tr.endMs)) ? Number(tr.endMs) : Number.POSITIVE_INFINITY;
      if (ms >= start && ms < end) return i;
    }
    if (ms >= 0) return tracks.length - 1;
    return -1;
  }

  function syncAudio(force) {
    if (!tracks.length) return;
    var idx = findTrackForMs(playheadMs);
    if (idx < 0) {
      try { audioEl.pause(); } catch (_) {}
      return;
    }
    var tr = tracks[idx] || {};
    var start = Math.max(0, Number(tr.startMs || 0));
    var offset = Math.max(0, Number(tr.offsetMs || 0));
    var target = Math.max(0, (playheadMs - start + offset) / 1000);

    if (idx !== activeTrackIndex) {
      activeTrackIndex = idx;
      audioEl.src = String(tr.dataUrl || '');
      pendingSeekSeconds = target;
      try { audioEl.load(); } catch (_) {}
    }

    try {
      if (force || Math.abs((audioEl.currentTime || 0) - target) > 0.25) audioEl.currentTime = target;
    } catch (_) {
      pendingSeekSeconds = target;
    }

    audioEl.playbackRate = playbackRate;
    if (playing) audioEl.play().catch(function(){});
    else audioEl.pause();
  }

  function seek(ms, forceAudio){
    playheadMs = clamp(Number(ms || 0), 0, durationMs);
    if (manualSlideIndex != null) manualSlideIndex = null;
    renderState(computeStateAt(playheadMs));
    updateTimeUi();
    syncAudio(!!forceAudio);
    if (playing) wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
  }

  function stopLoop(){ if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  function tick(){
    if (!playing) return;
    playheadMs = clamp((performance.now() - wallStartMs) * playbackRate, 0, durationMs);
    renderState(computeStateAt(playheadMs));
    updateTimeUi();
    syncAudio(false);
    if (playheadMs >= durationMs) { setPlaying(false); return; }
    rafId = requestAnimationFrame(tick);
  }

  function setPlayBtnLabel(isPlaying){
    if (isPlaying) {
      playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1"/><rect x="13.5" y="6" width="3.5" height="12" rx="1"/></svg>Pause';
      return;
    }
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Lecture';
  }

  function findNearestAnchorForSlide(targetIndex){
    var best = null;
    var bestDist = Number.POSITIVE_INFINITY;
    for (var i=0;i<slideAnchors.length;i++) {
      var a = slideAnchors[i];
      if (a.index !== targetIndex) continue;
      var d = Math.abs(a.t - playheadMs);
      if (d < bestDist) { bestDist = d; best = a.t; }
    }
    return best;
  }

  function setPlaying(next){
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

  function jumpSlide(delta){
    var baseState = manualSlideIndex != null
      ? { index: manualSlideIndex, fragmentIndex: -1, black: false }
      : computeStateAt(playheadMs);
    var target = clamp(baseState.index + delta, 0, Math.max(0, totalSlides - 1));
    if (target === baseState.index) return;
    setPlaying(false);
    var anchor = findNearestAnchorForSlide(target);
    if (anchor != null) { seek(anchor, true); return; }
    manualSlideIndex = target;
    renderState({ index: target, fragmentIndex: -1, black: false });
  }

  function scaleStage(){
    var w = stageWrap.clientWidth || 1;
    var h = stageWrap.clientHeight || 1;
    var sx = w / 1280;
    var sy = h / 720;
    var scale = Math.min(sx, sy);
    reveal.style.transform = 'scale(' + scale + ')';
  }

  playBtn.addEventListener('click', function(){ setPlaying(!playing); });
  prevBtn.addEventListener('click', function(){ jumpSlide(-1); });
  nextBtn.addEventListener('click', function(){ jumpSlide(1); });
  restartBtn.addEventListener('click', function(){ setPlaying(false); seek(0, true); });
  speedEl.addEventListener('change', function(){
    var v = Number(speedEl.value);
    playbackRate = Number.isFinite(v) ? clamp(v, 0.5, 2) : 1;
    if (playing) wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
    syncAudio(true);
  });
  timeline.addEventListener('input', function(){ seek(Number(timeline.value || 0), true); });
  window.addEventListener('resize', scaleStage);
  document.addEventListener('keydown', function(ev){
    if (ev.key === ' ' || ev.key === 'k' || ev.key === 'K') { ev.preventDefault(); setPlaying(!playing); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); jumpSlide(-1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); jumpSlide(1); }
    else if (ev.key === 'Home') { ev.preventDefault(); setPlaying(false); seek(0, true); }
  });

  setPlayBtnLabel(false);
  scaleStage();
  if (durationMs > 0) seek(0, true);
  else if (totalSlides > 0) {
    renderState({ index: 0, fragmentIndex: -1, black: false });
    updateTimeUi();
  }
})();
</script>
</body>
</html>`;
}

function printHelp() {
    console.log(`Usage:
  node tools/slides/replay-standalone.mjs --slides <fichier.json> --out <replay.html> [options]

Options:
  --session <fichier.json>        Session exportée (events + duration)
  --audio <fichier.audio>         Fichier audio (répéter pour plusieurs pistes)
  --audio-start <ms>              Start en ms de chaque piste audio (ordre des --audio)
  --title <texte>                 Titre forcé du replay
  --default-slide-ms <ms>         Durée fallback entre slides sans timestamps (défaut: 8000)
  --help                          Affiche cette aide

Champs niveaux supportés dans les slides:
  - level: 1|2|3|4
  - levels: [1,2,3,4]
  - metadata.level / metadata.levels

Exemples:
  node tools/slides/replay-standalone.mjs --slides data/slides/demo.json --audio cours.webm --out replay.html
  node tools/slides/replay-standalone.mjs --slides demo.json --session session.json --audio part1.webm --audio part2.webm --audio-start 0 --audio-start 240000 --out replay.html
`);
}

function parseArgs(argv) {
    const args = {
        slides: '',
        out: '',
        session: '',
        audio: [],
        audioStart: [],
        title: '',
        defaultSlideMs: DEFAULT_SLIDE_MS,
        help: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--help' || token === '-h') {
            args.help = true;
            continue;
        }
        if (token === '--slides') {
            args.slides = String(argv[++i] || '');
            continue;
        }
        if (token === '--out') {
            args.out = String(argv[++i] || '');
            continue;
        }
        if (token === '--session') {
            args.session = String(argv[++i] || '');
            continue;
        }
        if (token === '--audio') {
            const audioPath = String(argv[++i] || '');
            if (audioPath) args.audio.push(audioPath);
            continue;
        }
        if (token === '--audio-start') {
            const ms = parseNumeric(argv[++i]);
            if (ms != null) args.audioStart.push(ms);
            continue;
        }
        if (token === '--title') {
            args.title = String(argv[++i] || '');
            continue;
        }
        if (token === '--default-slide-ms') {
            const ms = parseNumeric(argv[++i]);
            if (ms != null && ms > 0) args.defaultSlideMs = ms;
            continue;
        }
        throw new Error(`Option inconnue: ${token}`);
    }

    return args;
}

async function loadJsonFile(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        printHelp();
        return;
    }
    if (!args.slides || !args.out) {
        printHelp();
        process.exitCode = 1;
        return;
    }

    const slidesPath = path.resolve(process.cwd(), args.slides);
    const outPath = path.resolve(process.cwd(), args.out);
    const sessionPath = args.session ? path.resolve(process.cwd(), args.session) : '';
    const audioPaths = args.audio.map(item => path.resolve(process.cwd(), item));

    const slidesData = await loadJsonFile(slidesPath);
    const sessionData = sessionPath ? await loadJsonFile(sessionPath) : null;

    const payload = await buildReplayPayload({
        slidesData,
        sessionData,
        audioFiles: audioPaths,
        audioStarts: args.audioStart,
        defaultSlideMs: args.defaultSlideMs,
        title: args.title,
    });

    const html = await buildReplayStandaloneHtml(payload);
    await fs.writeFile(outPath, html, 'utf8');

    console.log(`Replay HTML généré: ${outPath}`);
    console.log(`Slides: ${Array.isArray(payload.slidesData?.slides) ? payload.slidesData.slides.length : 0}`);
    console.log(`Événements timeline: ${Array.isArray(payload.session?.events) ? payload.session.events.length : 0}`);
    console.log(`Pistes audio: ${Array.isArray(payload.audioTracks) ? payload.audioTracks.length : 0}`);
}

const cliEntryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === cliEntryUrl) {
    main().catch(err => {
        console.error(err?.stack || err?.message || err);
        process.exitCode = 1;
    });
}
