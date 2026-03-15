/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-export
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-export.js"></script>
 */
/* editor-export.js — PNG, PDF, and HTML export with presenter mode; launchPresentation */
const _exportStorage = window.OEIStorage || null;
const _presentDataKey = _exportStorage?.KEYS?.PRESENT_DATA || 'oei-slide-present-data';
const _mediaPipelineSettingsKey = _exportStorage?.KEYS?.MEDIA_PIPELINE_SETTINGS || 'oei-media-pipeline-settings';
const _setStoredJson = (key, value) => {
    if (_exportStorage?.setJSON) return _exportStorage.setJSON(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
};

const _readStoredJson = (key, fallback = null) => {
    if (!key) return fallback;
    if (_exportStorage?.getJSON) return _exportStorage.getJSON(key, fallback);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
};

const _MEDIA_PIPELINE_PROFILE_PRESETS = Object.freeze({
    compact: Object.freeze({ maxBytes: 160000, maxDimension: 1366, maxPixels: 1400000, quality: 0.76, minGainBytes: 6000 }),
    balanced: Object.freeze({ maxBytes: 280000, maxDimension: 1920, maxPixels: 2400000, quality: 0.84, minGainBytes: 12000 }),
    high: Object.freeze({ maxBytes: 420000, maxDimension: 2560, maxPixels: 3600000, quality: 0.9, minGainBytes: 18000 }),
});
const _MEDIA_PIPELINE_DEFAULTS = Object.freeze({
    profile: 'balanced',
    tryWebpForPng: false,
    narrationBitrateKbps: 64,
    ..._MEDIA_PIPELINE_PROFILE_PRESETS.balanced,
});

let _mediaPipelineSettingsCache = null;

function _sanitizeMediaPipelineSettings(raw = {}) {
    const input = (raw && typeof raw === 'object') ? raw : {};
    const profile = Object.prototype.hasOwnProperty.call(_MEDIA_PIPELINE_PROFILE_PRESETS, input.profile)
        ? input.profile
        : _MEDIA_PIPELINE_DEFAULTS.profile;
    const preset = _MEDIA_PIPELINE_PROFILE_PRESETS[profile] || _MEDIA_PIPELINE_PROFILE_PRESETS.balanced;
    const toInt = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, Math.round(n)));
    };
    const toFloat = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    };
    return {
        profile,
        maxBytes: toInt(input.maxBytes, preset.maxBytes, 32000, 4_000_000),
        maxDimension: toInt(input.maxDimension, preset.maxDimension, 320, 8192),
        maxPixels: toInt(input.maxPixels, preset.maxPixels, 120000, 16_000_000),
        quality: toFloat(input.quality, preset.quality, 0.55, 0.98),
        minGainBytes: toInt(input.minGainBytes, preset.minGainBytes, 1024, 400000),
        tryWebpForPng: input.tryWebpForPng === true,
        narrationBitrateKbps: toInt(input.narrationBitrateKbps, _MEDIA_PIPELINE_DEFAULTS.narrationBitrateKbps, 16, 256),
    };
}

function getMediaPipelineSettings() {
    if (_mediaPipelineSettingsCache) return { ..._mediaPipelineSettingsCache };
    const raw = _readStoredJson(_mediaPipelineSettingsKey, _MEDIA_PIPELINE_DEFAULTS);
    _mediaPipelineSettingsCache = _sanitizeMediaPipelineSettings(raw);
    return { ..._mediaPipelineSettingsCache };
}

function setMediaPipelineSettings(patch = {}) {
    const current = getMediaPipelineSettings();
    const next = _sanitizeMediaPipelineSettings({ ...current, ...(patch || {}) });
    _mediaPipelineSettingsCache = next;
    _setStoredJson(_mediaPipelineSettingsKey, next);
    return { ...next };
}

window.getMediaPipelineSettings = getMediaPipelineSettings;
window.setMediaPipelineSettings = setMediaPipelineSettings;

const _importExportAssets = window.OEIImportExportAssets || null;

function _isDataImageUrl(value) {
    if (_importExportAssets?.isDataImageUrl) return _importExportAssets.isDataImageUrl(value);
    return typeof value === 'string' && value.startsWith('data:image/');
}

function _estimateDataUrlBytes(dataUrl) {
    if (_importExportAssets?.estimateDataUrlBytes) return _importExportAssets.estimateDataUrlBytes(dataUrl);
    if (!_isDataImageUrl(dataUrl)) return 0;
    const comma = dataUrl.indexOf(',');
    if (comma === -1) return 0;
    const payload = dataUrl.slice(comma + 1);
    return Math.max(0, Math.floor((payload.length * 3) / 4));
}

function _summarizeAssetUrls(urls = []) {
    if (_importExportAssets?.summarizeAssetUrls) return _importExportAssets.summarizeAssetUrls(urls);
    const list = Array.isArray(urls) ? urls : [];
    return {
        total: list.length,
        dataUri: list.filter(url => /^data:/i.test(url)).length,
        web: list.filter(url => /^https?:\/\//i.test(url)).length,
        local: list.filter(url => !/^https?:\/\//i.test(url) && !/^data:/i.test(url)).length,
    };
}

function _computeMediaSignature(slides) {
    let count = 0;
    let bytes = 0;
    const walk = node => {
        if (!node) return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (typeof node === 'object') {
            Object.values(node).forEach(walk);
            return;
        }
        if (_isDataImageUrl(node)) {
            count += 1;
            bytes += _estimateDataUrlBytes(node);
        }
    };
    walk(slides);
    return `${count}:${bytes}`;
}

async function _optimizeDataImageUrl(dataUrl, options = {}) {
    if (!_isDataImageUrl(dataUrl)) {
        return { changed: false, dataUrl, before: 0, after: 0 };
    }
    const before = _estimateDataUrlBytes(dataUrl);
    const maxBytes = Math.max(32_000, Number(options.maxBytes || 280_000));
    const maxDimension = Math.max(320, Number(options.maxDimension || 1920));
    const maxPixels = Math.max(200_000, Number(options.maxPixels || 2_400_000));
    const quality = Math.max(0.55, Math.min(0.95, Number(options.quality || 0.84)));
    const minGainBytes = Math.max(2_048, Number(options.minGainBytes || 12_000));
    const force = !!options.force;

    if (!force && before <= maxBytes) {
        return { changed: false, dataUrl, before, after: before };
    }

    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image-load-failed'));
        img.src = dataUrl;
    });

    const srcW = Math.max(1, Number(img.naturalWidth || img.width || 1));
    const srcH = Math.max(1, Number(img.naturalHeight || img.height || 1));

    let scale = Math.min(1, maxDimension / srcW, maxDimension / srcH);
    const scaledPixels = srcW * srcH * scale * scale;
    if (scaledPixels > maxPixels) {
        scale = Math.min(scale, Math.sqrt(maxPixels / (srcW * srcH)));
    }
    scale = Math.max(0.05, Math.min(1, scale));

    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));
    const mimeMatch = /^data:([^;,]+)/i.exec(dataUrl);
    const srcMime = String(mimeMatch?.[1] || 'image/png').toLowerCase();

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { changed: false, dataUrl, before, after: before };
    ctx.drawImage(img, 0, 0, outW, outH);

    let primaryMime = srcMime;
    if (!/image\/(png|jpe?g|webp)/.test(primaryMime)) {
        primaryMime = 'image/jpeg';
    }
    let optimized = canvas.toDataURL(primaryMime, quality);
    let after = _estimateDataUrlBytes(optimized);

    // Optionnel: conversion PNG -> WebP (désactivée par défaut pour compatibilité export PPTX).
    if (srcMime === 'image/png' && options.tryWebpForPng === true) {
        try {
            const webp = canvas.toDataURL('image/webp', Math.min(0.9, quality + 0.04));
            const webpBytes = _estimateDataUrlBytes(webp);
            if (webpBytes > 0 && webpBytes < after) {
                optimized = webp;
                after = webpBytes;
            }
        } catch (_) {}
    }

    const gain = before - after;
    if (!force && gain < minGainBytes) {
        return { changed: false, dataUrl, before, after: before };
    }
    return { changed: true, dataUrl: optimized, before, after };
}

async function optimizePresentationMedia(options = {}) {
    if (!editor?.data?.slides) return { changed: false, scanned: 0, optimized: 0, bytesSaved: 0 };
    const startedAt = Date.now();
    const stats = { scanned: 0, optimized: 0, bytesBefore: 0, bytesAfter: 0, slidesTouched: new Set() };

    const walk = async (node, slideIdx) => {
        if (!node) return;
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const value = node[i];
                if (_isDataImageUrl(value)) {
                    stats.scanned += 1;
                    const res = await _optimizeDataImageUrl(value, options);
                    stats.bytesBefore += res.before || 0;
                    stats.bytesAfter += res.changed ? (res.after || 0) : (res.before || 0);
                    if (res.changed) {
                        node[i] = res.dataUrl;
                        stats.optimized += 1;
                        stats.slidesTouched.add(slideIdx);
                    }
                } else if (value && typeof value === 'object') {
                    await walk(value, slideIdx);
                }
            }
            return;
        }
        if (typeof node === 'object') {
            const entries = Object.entries(node);
            for (const [key, value] of entries) {
                if (_isDataImageUrl(value)) {
                    stats.scanned += 1;
                    const res = await _optimizeDataImageUrl(value, options);
                    stats.bytesBefore += res.before || 0;
                    stats.bytesAfter += res.changed ? (res.after || 0) : (res.before || 0);
                    if (res.changed) {
                        node[key] = res.dataUrl;
                        stats.optimized += 1;
                        stats.slidesTouched.add(slideIdx);
                    }
                } else if (value && typeof value === 'object') {
                    await walk(value, slideIdx);
                }
            }
        }
    };

    for (let i = 0; i < editor.data.slides.length; i++) {
        await walk(editor.data.slides[i], i);
    }

    const changed = stats.optimized > 0;
    const bytesSaved = Math.max(0, stats.bytesBefore - stats.bytesAfter);
    if (changed) {
        editor.data.metadata = editor.data.metadata || {};
        editor.data.metadata._mediaOptimizeSig = _computeMediaSignature(editor.data.slides);
        editor.data.metadata.mediaOptimization = {
            lastRun: new Date().toISOString(),
            reason: String(options.reason || 'manual'),
            profile: String(options.profile || getMediaPipelineSettings().profile || 'balanced'),
            optimizedAssets: stats.optimized,
            scannedAssets: stats.scanned,
            bytesSaved,
            durationMs: Date.now() - startedAt,
        };
        editor._push();
        editor.onUpdate('slide-update');
    } else if (!editor.data.metadata?._mediaOptimizeSig) {
        editor.data.metadata = editor.data.metadata || {};
        editor.data.metadata._mediaOptimizeSig = _computeMediaSignature(editor.data.slides);
    }

    if (!options.silent) {
        if (changed) {
            const kb = Math.round(bytesSaved / 1024);
            notify(`Médias optimisés: ${stats.optimized} asset(s), ${kb} Ko gagnés`, 'success');
        } else {
            notify('Aucune optimisation utile détectée', 'info');
        }
    }
    return { changed, scanned: stats.scanned, optimized: stats.optimized, bytesSaved };
}

async function optimizeMediaForExport(options = {}) {
    if (!editor?.data?.slides) return { changed: false, skipped: true, reason: 'no-data' };
    const meta = editor.data.metadata || (editor.data.metadata = {});
    if (meta.autoOptimizeMedia === false && !options.force) {
        return { changed: false, skipped: true, reason: 'disabled' };
    }
    const pipeline = getMediaPipelineSettings();
    const signature = _computeMediaSignature(editor.data.slides);
    if (!options.force && signature && meta._mediaOptimizeSig === signature) {
        return { changed: false, skipped: true, reason: 'up-to-date' };
    }
    return optimizePresentationMedia({
        maxBytes: pipeline.maxBytes,
        maxDimension: pipeline.maxDimension,
        maxPixels: pipeline.maxPixels,
        quality: pipeline.quality,
        minGainBytes: pipeline.minGainBytes,
        tryWebpForPng: pipeline.tryWebpForPng,
        profile: pipeline.profile,
        ...options,
        silent: options.silent !== false,
        reason: options.reason || 'export',
    });
}

window.optimizeDataImageUrl = _optimizeDataImageUrl;
window.optimizePresentationMedia = optimizePresentationMedia;
window.optimizeMediaForExport = optimizeMediaForExport;

function _resolveExportTheme(data) {
    if (window.OEIDesignTokens?.resolvePresentationTheme) {
        return window.OEIDesignTokens.resolvePresentationTheme(data || {});
    }
    const all = (SlidesThemes.list ? SlidesThemes.list() : SlidesThemes.BUILT_IN);
    if (typeof data?.theme === 'string') return all[data.theme] || SlidesThemes.BUILT_IN.dark;
    return data?.theme || SlidesThemes.BUILT_IN.dark;
}

function launchPresentation(mode, fromCurrent) {
    _setStoredJson(_presentDataKey, editor.data);
    const modeParam = mode === 'presenter' ? '&mode=presenter' : '';
    let slideHash = '';
    if (fromCurrent && editor.selectedIndex != null) {
        // Compute visible slide index (skip hidden slides)
        const visIdx = editor.data.slides.slice(0, editor.selectedIndex + 1).filter(s => !s.hidden).length - 1;
        if (visIdx >= 0) slideHash = '#/' + visIdx;
    }
    window.open('viewer.html?file=__draft__' + modeParam + slideHash, '_blank');
}

async function exportPNG() {
    const frame = document.getElementById('preview-frame');
    if (!frame) return;
    notify('Capture en cours…', 'warning');
    try {
        // Use html2canvas if available, otherwise canvas screenshot
        if (!window.html2canvas) {
            const script = document.createElement('script');
            script.src = '../vendor/html2canvas/1.4.1/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }
        // Inject static fallbacks for unmounted widgets, then restore after capture
        const unmountedSlots = [...frame.querySelectorAll('.sl-sim-container[data-widget]:not([data-mounted])')];
        const savedHtml = unmountedSlots.map(s => s.innerHTML);
        _injectStaticFallbacks(frame);
        const canvas = await html2canvas(frame, {
            width: 1280, height: 720, scale: 2,
            backgroundColor: null,
            useCORS: true,
            logging: false,
        });
        unmountedSlots.forEach((s, i) => { s.innerHTML = savedHtml[i]; });
        const link = document.createElement('a');
        link.download = `slide-${editor.selectedIndex + 1}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        notify('PNG exporté', 'success');
    } catch(e) {
        notify('Erreur export PNG: ' + e.message, 'error');
    }
}

function collectUsedWidgets(slides) {
    const widgets = new Set();
    for (const slide of slides) {
        if (slide.type === 'simulation' && slide.widget) widgets.add(slide.widget);
        if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
            for (const el of slide.elements) {
                if (el.type === 'widget' && el.data?.widget) widgets.add(el.data.widget);
            }
        }
    }
    return widgets;
}

function getWidgetMountScript(usedWidgets, basePath) {
    if (usedWidgets.size === 0) return '';
    const registry = {};
    for (const id of usedWidgets) {
        const entry = CanvasEditor.WIDGET_REGISTRY[id];
        if (!entry) continue;
        const isAbsolute = typeof entry.script === 'string' && /^(https?:)?\/\//i.test(entry.script);
        registry[id] = { global: entry.global, script: isAbsolute ? entry.script : (basePath + entry.script) };
    }
    const regJSON = JSON.stringify(registry);
    return `<script>
(function() {
    var WREG = ${regJSON};
    // Stubs pour les classes de base nécessaires aux widgets Page-based
    if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
    if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
    if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;
    function _loadScript(src) {
        return new Promise(function(resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
            var el = document.createElement('script');
            el.src = src; el.onload = resolve; el.onerror = function() { reject(new Error('Script non chargé: ' + src)); };
            document.head.appendChild(el);
        });
    }
    window._mountOEIWidgets = async function() {
        var slots = document.querySelectorAll('.sl-sim-container[data-widget]');
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            if (slot.dataset.mounted) continue;
            var wid = slot.dataset.widget;
            if (!wid) { slot.textContent = 'Widget non configuré'; continue; }
            var reg = WREG[wid];
            if (!reg) { slot.textContent = 'Widget indisponible: ' + wid; continue; }
            try {
                if (!window[reg.global]) await _loadScript(reg.script);
                var cls = window[reg.global];
                if (!cls || typeof cls.mount !== 'function') { slot.textContent = 'Widget non chargé: ' + wid; continue; }
                var config = JSON.parse(slot.dataset.config || '{}');
                cls.mount(slot, Object.assign({}, config, { type: wid }));
                slot.dataset.mounted = '1';
            } catch(e) {
                slot.textContent = 'Erreur widget: ' + (e.message || String(e));
                console.error('Widget mount error:', wid, e);
            }
        }
    };
})();
<\/script>`;
}

/* ── Theme CSS helper (inline, no dependency on slides-core cache) ── */
function _buildThemeRootCSS(themeData) {
    const _d = SlidesThemes.BUILT_IN.dark;
    const _all = SlidesThemes.list ? SlidesThemes.list() : SlidesThemes.BUILT_IN;
    const t = (typeof themeData === 'string')
        ? (_all[themeData] || _d)
        : (themeData && themeData.colors ? themeData : _d);
    const c = { ..._d.colors, ...t.colors };
    const f = { ..._d.fonts, ...t.fonts };
    const lt = t.layoutTokens || {};
    const radius = Number.isFinite(+lt.radius) ? +lt.radius : 12;
    const contentPaddingX = Number.isFinite(+lt.contentPaddingX) ? +lt.contentPaddingX : 48;
    const contentPaddingY = Number.isFinite(+lt.contentPaddingY) ? +lt.contentPaddingY : 40;
    const bodyLineHeight = Number.isFinite(+lt.bodyLineHeight) ? +lt.bodyLineHeight : 1.45;
    return `:root{--sl-bg:${c.bg};--sl-slide-bg:${c.slideBg};--sl-heading:${c.heading};--sl-text:${c.text};--sl-muted:${c.muted};--sl-primary:${c.primary};--sl-accent:${c.accent};--sl-code-bg:${c.codeBg};--sl-code-text:${c.codeText};--sl-border:${c.border};--sl-success:${c.success};--sl-warning:${c.warning};--sl-tag:${c.tag};--sl-tag-border:${c.tagBorder};--sl-font-heading:${f.heading};--sl-font-body:${f.body};--sl-font-mono:${f.mono};--sl-radius:${radius}px;--sl-content-padding-x:${contentPaddingX};--sl-content-padding-y:${contentPaddingY};--sl-body-line-height:${bodyLineHeight}}`;
}

function _buildThemeFontLinks(themeData) {
    const _d = SlidesThemes.BUILT_IN.dark;
    const _all = SlidesThemes.list ? SlidesThemes.list() : SlidesThemes.BUILT_IN;
    const t = (typeof themeData === 'string')
        ? (_all[themeData] || _d)
        : (themeData && themeData.fonts ? themeData : _d);
    const f = { ..._d.fonts, ...t.fonts };
    // Extract font family names from CSS font stack strings
    const families = new Set();
    [f.heading, f.body].forEach(stack => {
        if (!stack) return;
        const m = stack.match(/"([^"]+)"/g);
        if (m) m.forEach(name => {
            const clean = name.replace(/"/g, '');
            if (!/system-ui|sans-serif|monospace|serif/i.test(clean)) families.add(clean);
        });
    });
    // Mono font
    if (f.mono) {
        const m = f.mono.match(/"([^"]+)"/g);
        if (m) m.forEach(name => {
            const clean = name.replace(/"/g, '');
            if (!/system-ui|sans-serif|monospace|serif/i.test(clean)) families.add(clean);
        });
    }
    if (families.size === 0) return '';
    const params = [...families].map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&');
    return `<link href="https://fonts.googleapis.com/css2?${params}&display=swap" rel="stylesheet">`;
}

/** Replace unmounted widget slots with their staticFallback HTML for raster capture */
function _injectStaticFallbacks(container) {
    const reg = (typeof CanvasEditor !== 'undefined' && CanvasEditor.WIDGET_REGISTRY) || window.OEI_WIDGET_REGISTRY || {};
    container.querySelectorAll('.sl-sim-container[data-widget]:not([data-mounted])').forEach(slot => {
        const wid = slot.dataset.widget;
        let cfg = {};
        try { cfg = JSON.parse(slot.dataset.config || '{}'); } catch (_) {}
        if (SlidesRenderer && typeof SlidesRenderer.renderWidgetStaticFallback === 'function') {
            slot.innerHTML = SlidesRenderer.renderWidgetStaticFallback(wid, cfg, reg);
            return;
        }
        const entry = reg[wid];
        if (entry && typeof entry.staticFallback === 'function') {
            try {
                slot.innerHTML = entry.staticFallback(cfg);
                return;
            } catch (_) {}
        }
        slot.innerHTML = `<div class="sl-widget-static"><div class="sl-widget-static-icon">⚙️</div><div class="sl-widget-static-name">${wid || 'Widget'}</div><div class="sl-widget-static-desc">Simulation interactive — disponible en présentation</div></div>`;
    });
}

async function exportPDF() {
    const data = editor.data;
    if (!data) return;
    const dims = ASPECT_DIMS[data.metadata?.aspect] || [1280, 720];

    notify('Génération PDF en cours…', 'warning');

    try {
        // Ensure jsPDF and html2canvas are loaded
        if (!window.jspdf) {
            const script = document.createElement('script');
            script.src = '../vendor/jspdf/2.5.2/jspdf.umd.min.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }
        if (!window.html2canvas) {
            const script = document.createElement('script');
            script.src = '../vendor/html2canvas/1.4.1/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }

        const { jsPDF } = window.jspdf;
        const orientation = dims[0] > dims[1] ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [dims[0], dims[1]], compress: true });

        // Create off-screen rendering container
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.zIndex = '-1';
        document.body.appendChild(container);

        const themeData = _resolveExportTheme(data);
        const themeCSS = SlidesThemes.generateCSS(themeData);
        const pdfOpts = {
            showSlideNumber: data.showSlideNumber || false,
            footerText: data.footerText || null,
            footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
            metadata: data.metadata || {},
            totalSlides: data.slides.length,
            chapterNumbers: SlidesRenderer._buildChapterNumbers(data.slides, data.autoNumberChapters),
            typography: SlidesShared.resolveTypographyDefaults(data.typography),
        };

        for (let i = 0; i < data.slides.length; i++) {
            const slide = data.slides[i];

            // Create a slide frame
            const frame = document.createElement('div');
            frame.style.width = `${dims[0]}px`;
            frame.style.height = `${dims[1]}px`;
            frame.style.overflow = 'hidden';
            frame.style.position = 'relative';
            frame.style.background = 'var(--sl-slide-bg,#1a1d27)';
            frame.innerHTML = `<style>${themeCSS}</style>` + SlidesRenderer.renderSlide(slide, i, pdfOpts);
            container.appendChild(frame);
            _injectStaticFallbacks(frame);

            // Wait for images/fonts
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(frame, {
                width: dims[0], height: dims[1], scale: 2,
                backgroundColor: null, useCORS: true, logging: false,
            });

            if (i > 0) pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, dims[0], dims[1]);
            container.removeChild(frame);
        }

        container.remove();

        // Set PDF metadata
        pdf.setProperties({
            title: data.metadata?.title || 'Présentation',
            author: data.metadata?.author || '',
            subject: 'Slides export',
            creator: 'OEI Slides Editor',
        });

        pdf.save(`${(data.metadata?.title || 'presentation').replace(/[^a-zA-Z0-9àéèùêîôâ _-]/g, '')}.pdf`);
        notify(`PDF exporté (${data.slides.length} slides)`, 'success');
    } catch (e) {
        console.error('PDF export error:', e);
        notify('Erreur export PDF: ' + e.message, 'error');
        // Fallback to print-based export
        _exportPDFPrint();
    }
}

/** Fallback: open print dialog */
function _exportPDFPrint() {
    const data = editor.data;
    if (!data) return;
    const dims = ASPECT_DIMS[data.metadata?.aspect] || [1280, 720];
    const w = window.open('', '_blank');
    const themeData = _resolveExportTheme(data);
    const _s = css => css.replace(/:root\s*\{[^}]*\}/g, '').replace(/body\s*\{[^}]*\}/g, '');
    const themeCSS = _s(SlidesThemes.generateCSS(themeData));
    const pdfOpts = {
        showSlideNumber: data.showSlideNumber || false,
        footerText: data.footerText || null,
        footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
        metadata: data.metadata || {},
        totalSlides: data.slides.length,
        chapterNumbers: SlidesRenderer._buildChapterNumbers(data.slides, data.autoNumberChapters),
        typography: SlidesShared.resolveTypographyDefaults(data.typography),
    };
    const slidesHTML = data.slides.map((slide, i) =>
        `<div class="pdf-slide">${SlidesRenderer.renderSlide(slide, i, pdfOpts)}</div>`
    ).join('');

    const usedWidgets = collectUsedWidgets(data.slides);
    const widgetScript = getWidgetMountScript(usedWidgets, '../shared/components/');
    const printScript = usedWidgets.size > 0
        ? `<script>window._mountOEIWidgets().then(function(){ setTimeout(function(){ window.print(); }, 1000); });<\/script>`
        : `<script>setTimeout(function(){ window.print(); }, 500);<\/script>`;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(data.metadata?.title || 'Présentation')} — PDF</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
${_buildThemeFontLinks(themeData)}
<style>
${_buildThemeRootCSS(themeData)}
body { margin: 0; padding: 0; background: var(--sl-bg); }
${themeCSS}
@page { size: landscape; margin: 0; }
.pdf-slide {
    width: ${dims[0]}px; height: ${dims[1]}px; page-break-after: always;
    overflow: hidden; position: relative;
    transform-origin: top left;
}
.pdf-slide section { width: ${dims[0]}px; height: ${dims[1]}px; padding: calc(var(--sl-content-padding-y, 40) * 1px) calc(var(--sl-content-padding-x, 48) * 1px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; line-height: var(--sl-body-line-height, 1.45); }
.pdf-slide section.sl-canvas { padding: 0 !important; position: relative !important; overflow: hidden !important; }
@media print {
    .pdf-slide { break-after: page; }
}
</style></head><body>${slidesHTML}
${widgetScript}
${printScript}
</body></html>`);
    w.document.close();
    notify('Fenêtre d\'impression ouverte', 'success');
}

/* ── Print Speaker Notes ───────────────────────────────── */

function printSpeakerNotes() {
    const data = editor.data;
    if (!data) return;
    const formatInlineRichText = (value) => {
        const formatter = window.SlidesShared?.formatInlineRichText;
        if (typeof formatter === 'function') return formatter(value ?? '');
        return esc(value).replace(/\r?\n/g, '<br>');
    };

    const slides = data.slides;
    const titleEsc = esc(data.metadata?.title || 'Présentation');

    const slidesWithNotes = slides.map((s, i) => ({
        index: i + 1,
        title: s.title || s.elements?.find(e => e.type === 'heading')?.data?.text || `Slide ${i + 1}`,
        notes: s.notes || ''
    }));

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Notes — ${titleEsc}</title>
<style>
@media print {
    @page { margin: 1.5cm; size: A4; }
    .no-print { display: none !important; }
    .notes-page-break { page-break-after: always; }
}
body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #1a1a2e; }
h1 { font-size: 1.3rem; border-bottom: 2px solid #6366f1; padding-bottom: 8px; margin-bottom: 24px; }
.slide-notes-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;
    page-break-inside: avoid;
}
.slide-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.slide-num { background: #6366f1; color: white; width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
.slide-title { font-weight: 600; font-size: 1rem; }
.slide-notes { font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; color: #374151; }
.no-notes { color: #9ca3af; font-style: italic; font-size: 0.85rem; }
.print-btn { position: fixed; top: 12px; right: 12px; padding: 8px 16px; background: #6366f1; color: white;
    border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.print-btn:hover { background: #4f46e5; }
.summary { font-size: 0.8rem; color: #6b7280; margin-bottom: 20px; }
</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Imprimer</button>
<h1>📝 Notes — ${titleEsc}</h1>
<div class="summary">${slides.length} slides · ${slidesWithNotes.filter(s => s.notes).length} avec notes · ${new Date().toLocaleDateString('fr-FR')}</div>
${slidesWithNotes.map(s => `
<div class="slide-notes-card">
    <div class="slide-header">
        <div class="slide-num">${s.index}</div>
        <div class="slide-title">${esc(s.title)}</div>
    </div>
    ${s.notes
        ? `<div class="slide-notes">${formatInlineRichText(s.notes)}</div>`
        : '<div class="no-notes">Pas de notes</div>'
    }
</div>`).join('\n')}
</body></html>`);
    w.document.close();
    notify('Fenêtre d\'impression des notes ouverte', 'success');
}

window.printSpeakerNotes = printSpeakerNotes;

/* ── Special elements mount script (shared by online & offline export) ── */
const _MOUNT_SPECIAL_SCRIPT = `
(function(){
var esc=function(t){return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
async function mountSpecial(container){
  if(!container)return;
  var latexEls=container.querySelectorAll('.sl-latex-pending');
  if(latexEls.length){
    if(!window._slKatexLoaded){window._slKatexLoaded=true;
      var lnk=document.createElement('link');lnk.rel='stylesheet';lnk.href='../vendor/katex/0.16.11/katex.min.css';document.head.appendChild(lnk);
      await new Promise(function(ok,ko){var s=document.createElement('script');s.src='../vendor/katex/0.16.11/katex.min.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s);});}
    if(window.katex){latexEls.forEach(function(el){var t=el.querySelector('.sl-latex-render');if(!t||t.dataset.rendered)return;var expr=el.dataset.latex||'';try{t.innerHTML=katex.renderToString(expr,{displayMode:true,throwOnError:false});t.dataset.rendered='1';}catch(e){t.innerHTML='<span style="color:#f87171">'+esc(expr)+'</span>';}});}}
  var mmEls=container.querySelectorAll('.sl-mermaid-pending');
  if(mmEls.length){
    if(!window._slMermaidLoaded){window._slMermaidLoaded=true;
      await new Promise(function(ok,ko){var s=document.createElement('script');s.src='../vendor/mermaid/10.9.1/mermaid.min.js';s.onload=function(){mermaid.initialize({startOnLoad:false,theme:'dark',securityLevel:'loose'});ok();};s.onerror=ko;document.head.appendChild(s);});}
    if(window.mermaid){for(var i=0;i<mmEls.length;i++){var el=mmEls[i],tgt=el.querySelector('.sl-mermaid-render'),src=el.querySelector('pre');if(!tgt||!src||tgt.dataset.rendered)continue;try{var id='sl-mm-'+Math.random().toString(36).slice(2,9);var r=await mermaid.render(id,src.textContent);tgt.innerHTML=r.svg;var svg=tgt.querySelector('svg');if(svg){svg.style.maxWidth='100%';svg.style.maxHeight='100%';svg.style.height='auto';}tgt.dataset.rendered='1';}catch(e){tgt.innerHTML='<pre style="color:#f87171;font-size:12px">'+esc(e.message||'Erreur Mermaid')+'</pre>';}}}}
  container.querySelectorAll('.sl-timer-content').forEach(function(el){if(el.dataset.timerBound)return;el.dataset.timerBound='1';var dur=parseInt(el.dataset.duration)||300;var remaining=dur,iv=null,running=false;var disp=el.querySelector('.sl-timer-display'),bs=el.querySelector('.sl-timer-start'),bp=el.querySelector('.sl-timer-pause'),br=el.querySelector('.sl-timer-reset');if(!disp||!bs)return;var fmt=function(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};var tick=function(){remaining=Math.max(0,remaining-1);disp.textContent=fmt(remaining);if(remaining<=0){clearInterval(iv);running=false;bs.style.display='';bp.style.display='none';disp.classList.add('sl-timer-ended');}};bs.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();if(!running&&remaining>0){running=true;disp.classList.remove('sl-timer-ended');iv=setInterval(tick,1000);bs.style.display='none';bp.style.display='';}});bp.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();clearInterval(iv);running=false;bs.style.display='';bp.style.display='none';});br.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();clearInterval(iv);running=false;remaining=dur;disp.textContent=fmt(dur);disp.classList.remove('sl-timer-ended');bs.style.display='';bp.style.display='none';});});
  container.querySelectorAll('.sl-quiz-options[data-answer]').forEach(function(optEl){if(optEl.dataset.quizBound)return;optEl.dataset.quizBound='1';var ci=optEl.dataset.answer;if(ci==='')return;var opts=optEl.querySelectorAll('.sl-quiz-option');opts.forEach(function(o){o.addEventListener('click',function(e){e.stopPropagation();if(optEl.dataset.quizAnswered)return;optEl.dataset.quizAnswered='1';opts.forEach(function(x){if(x.dataset.idx===ci)x.classList.add('sl-quiz-correct');else x.classList.add('sl-quiz-wrong');});var sec=optEl.closest('section');if(sec){var expl=sec.querySelector('.sl-quiz-explanation');if(expl){expl.style.display='';expl.classList.add('visible');expl.style.opacity='1';}}});});});
  container.querySelectorAll('.sl-codelive-pending').forEach(function(el){if(el.dataset.codeliveBound)return;el.dataset.codeliveBound='1';var lang=el.dataset.language||'python';var ta=el.querySelector('.sl-codelive-code'),con=el.querySelector('.sl-codelive-console'),br2=el.querySelector('.sl-codelive-run'),bc=el.querySelector('.sl-codelive-clear');if(!ta||!con||!br2)return;ta.addEventListener('keydown',function(e){if(e.key==='Tab'){e.preventDefault();var s=ta.selectionStart,end=ta.selectionEnd;ta.value=ta.value.substring(0,s)+'    '+ta.value.substring(end);ta.selectionStart=ta.selectionEnd=s+4;}});var app=function(t,c){var sp=document.createElement('span');sp.style.color=c||'inherit';sp.textContent=t;con.appendChild(sp);con.scrollTop=con.scrollHeight;};br2.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();var code=ta.value;if(lang==='javascript'||lang==='js'){con.textContent='';var ol=console.log,oe=console.error;var logs=[];console.log=function(){logs.push({t:[].slice.call(arguments).join(' ')+'\\n',c:'inherit'});};console.error=function(){logs.push({t:[].slice.call(arguments).join(' ')+'\\n',c:'#f87171'});};try{var r=new Function(code)();logs.forEach(function(l){app(l.t,l.c);});if(r!==undefined)app('→ '+String(r)+'\\n','#a5b4fc');}catch(err){logs.forEach(function(l){app(l.t,l.c);});app('❌ '+err.message+'\\n','#f87171');}finally{console.log=ol;console.error=oe;}}else{(async function(){con.textContent='';app('⏳ Python…\\n','#64748b');if(!window._slPyodideLoaded){window._slPyodideLoaded=true;try{await new Promise(function(ok,ko){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s);});window._slPyodide=await loadPyodide();}catch(e2){app('❌ '+e2.message+'\\n','#f87171');return;}}while(!window._slPyodide&&window._slPyodideLoaded)await new Promise(function(r2){setTimeout(r2,200);});if(!window._slPyodide)return;con.textContent='';try{window._slPyodide.setStdout({batched:function(t){app(t+'\\n','inherit');}});window._slPyodide.setStderr({batched:function(t){app(t+'\\n','#f87171');}});var r3=await window._slPyodide.runPythonAsync(code);if(r3!==undefined&&r3!==null)app('→ '+String(r3)+'\\n','#a5b4fc');}catch(err2){app('❌ '+(err2.message||String(err2))+'\\n','#f87171');}})();}});if(bc)bc.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();con.textContent='';});if(el.dataset.autorun==='1')setTimeout(function(){br2.click();},500);});
  container.querySelectorAll('.sl-quizlive-pending').forEach(function(el){if(el.dataset.quizliveBound)return;el.dataset.quizliveBound='1';var rmId=el.dataset.room,ca=parseInt(el.dataset.answer)||0,dur2=parseInt(el.dataset.duration)||30;var bs2=el.querySelector('.sl-quizlive-start'),te2=el.querySelector('.sl-quizlive-timer'),se2=el.querySelector('.sl-quizlive-status'),re2=el.querySelector('.sl-quizlive-results'),qr2=el.querySelector('.sl-quizlive-qr'),opts2=el.querySelectorAll('.sl-quizlive-option');if(!bs2)return;var nO=opts2.length,pr=null,cn=[],rsp={},iv2=null,rem2=dur2,act=false;var upd=function(){var cts=Array(nO).fill(0),tot=Object.keys(rsp).length;Object.values(rsp).forEach(function(r){if(r>=0&&r<nO)cts[r]++;});var h='<div style="font-size:0.75rem;color:#64748b;margin-bottom:8px">'+tot+' rép.</div><div style="display:flex;flex-direction:column;gap:6px">';cts.forEach(function(c,i){var p=tot>0?Math.round(c/tot*100):0;var cl=i===ca?'#34d399':'#818cf8';h+='<div style="display:flex;align-items:center;gap:8px"><span style="min-width:24px;font-weight:700;font-size:0.85rem;color:'+(i===ca?'#34d399':'#cbd5e1')+'">'+String.fromCharCode(65+i)+'</span><div style="flex:1;height:28px;background:rgba(30,33,48,0.8);border-radius:6px;overflow:hidden;position:relative"><div style="height:100%;width:'+p+'%;background:'+cl+';border-radius:6px;opacity:0.8"></div><span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600">'+p+'% ('+c+')</span></div></div>';});h+='</div>';re2.innerHTML=h;};bs2.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();if(act)return;act=true;bs2.disabled=true;bs2.textContent='⏳';se2.textContent='Connexion P2P…';(async function(){if(!window._slPeerLoaded){window._slPeerLoaded=true;await new Promise(function(ok,ko){var s=document.createElement('script');s.src='../vendor/peerjs/1.5.5/peerjs.min.js';s.onload=ok;s.onerror=ko;document.head.appendChild(s);});}try{pr=new Peer(rmId,{debug:0});await new Promise(function(ok,ko){pr.on('open',ok);pr.on('error',function(e3){if(e3.type==='unavailable-id'){var ai=rmId+'-'+Date.now().toString(36).slice(-4);pr=new Peer(ai,{debug:0});pr.on('open',ok);pr.on('error',ko);}else ko(e3);});setTimeout(function(){ko(new Error('Timeout'));},10000);});}catch(ex){se2.textContent='❌ '+ex.message;bs2.textContent='Réessayer';bs2.disabled=false;act=false;return;}var url=location.origin+location.pathname.replace(/[^\\/]*$/,'')+'quiz-student.html?room='+encodeURIComponent(pr.id);qr2.style.display='';qr2.innerHTML='<img src=\"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(url)+'\" style=\"width:100%;height:100%;object-fit:contain;border-radius:4px\">';pr.on('connection',function(conn){cn.push(conn);conn.on('data',function(d){if(d&&d.type==='answer'&&act){rsp[conn.peer]=d.value;upd();se2.textContent=Object.keys(rsp).length+' rép. — '+rem2+'s';}});conn.on('open',function(){var q=el.querySelector('.sl-quizlive-question');conn.send({type:'quiz',question:q?q.textContent:'',options:Array.from(opts2).map(function(o){return o.textContent.trim().slice(1).trim();}),duration:rem2,roomId:pr.id});});});re2.style.display='';upd();rem2=dur2;te2.textContent=rem2+'s';bs2.textContent='⏹ Stop';bs2.disabled=false;iv2=setInterval(function(){rem2--;te2.textContent=rem2+'s';se2.textContent=Object.keys(rsp).length+' rép. — '+rem2+'s';if(rem2<=0){clearInterval(iv2);act=false;cn.forEach(function(c){try{c.send({type:'end'});}catch(x){}});opts2.forEach(function(o,i){if(i===ca){o.style.borderColor='#34d399';o.style.background='rgba(52,211,153,0.15)';}});se2.textContent='Terminé — '+Object.keys(rsp).length+' rép.';bs2.textContent='🔄 Relancer';upd();}},1000);})();});});
}
  container.querySelectorAll('.sl-quizlive-qr').forEach(function(q){if(q.style.display!=='none'&&!q.dataset.qrInteractive)_slMakeQrDR(q);});
}
function _slMakeQrDR(qr){if(qr.dataset.qrInteractive)return;qr.dataset.qrInteractive='1';qr.style.cursor='grab';qr.style.zIndex='20';qr.style.boxShadow='0 4px 20px rgba(0,0,0,0.4)';qr.style.pointerEvents='auto';var h=qr.querySelector('.sl-qr-resize-handle');if(!h){h=document.createElement('div');h.className='sl-qr-resize-handle';h.textContent='\u21f2';h.style.position='absolute';h.style.right='-2px';h.style.bottom='-2px';h.style.width='16px';h.style.height='16px';h.style.cursor='nwse-resize';h.style.background='#818cf8';h.style.borderRadius='3px';h.style.display='flex';h.style.alignItems='center';h.style.justifyContent='center';h.style.fontSize='10px';h.style.color='#fff';h.style.opacity='0';h.style.transition='opacity 0.2s';h.style.pointerEvents='auto';h.style.zIndex='5';qr.appendChild(h);}qr.addEventListener('mouseenter',function(){h.style.opacity='0.8';});qr.addEventListener('mouseleave',function(){if(!dr)h.style.opacity='0';});var dr=false,rs=false,sx,sy,sl,st,sw,sh;var gs=function(){var s=qr.closest('.slides')||document.querySelector('.reveal .slides');if(s){var r=s.getBoundingClientRect();return r.width/(s.offsetWidth||1280);}return 1;};var elp=function(){if(qr.style.right&&qr.style.right!=='auto'){var p=qr.offsetParent||qr.parentElement;if(p){var pw=p.clientWidth||p.offsetWidth;qr.style.left=(pw-qr.offsetWidth-(parseInt(qr.style.right)||0))+'px';qr.style.right='auto';}}};h.addEventListener('pointerdown',function(e){e.stopPropagation();e.preventDefault();elp();rs=true;sx=e.clientX;sy=e.clientY;sw=qr.offsetWidth;sh=qr.offsetHeight;h.setPointerCapture(e.pointerId);});h.addEventListener('pointermove',function(e){if(!rs)return;var sc=gs(),d=Math.max((e.clientX-sx)/sc,(e.clientY-sy)/sc),ns=Math.max(80,sw+d);qr.style.width=ns+'px';qr.style.height=ns+'px';});h.addEventListener('pointerup',function(){rs=false;});h.addEventListener('pointercancel',function(){rs=false;});qr.addEventListener('pointerdown',function(e){if(rs||e.target===h)return;e.stopPropagation();e.preventDefault();elp();dr=true;sx=e.clientX;sy=e.clientY;sl=qr.offsetLeft;st=qr.offsetTop;qr.style.cursor='grabbing';qr.setPointerCapture(e.pointerId);});qr.addEventListener('pointermove',function(e){if(!dr||rs)return;var sc=gs();qr.style.left=(sl+(e.clientX-sx)/sc)+'px';qr.style.top=(st+(e.clientY-sy)/sc)+'px';qr.style.right='auto';});qr.addEventListener('pointerup',function(){if(dr){dr=false;qr.style.cursor='grab';}});qr.addEventListener('pointercancel',function(){if(dr){dr=false;qr.style.cursor='grab';}});}
window._mountSpecial=function(){mountSpecial(document.getElementById('reveal-root'));mountSpecial(document.getElementById('presenter-view'));};
window._mountSpecial();
if(typeof Reveal!=='undefined')Reveal.addEventListener('slidechanged',function(){window._mountSpecial();});
})();`;

/* ── Export HTML ────────────────────────────────────────── */

async function exportHTML() {
    const data = editor.data;
    if (!data) return;
    // Resolve theme data for export
    const themeData = _resolveExportTheme(data);
    const _stripRootBody = css => css.replace(/:root\s*\{[^}]*\}/g, '').replace(/body\s*\{[^}]*\}/g, '');
    const rawCSS = SlidesThemes.generateCSS(themeData);
    // Strip ALL :root/:body from generated CSS — we emit our own single :root block
    const themeCSS = _stripRootBody(rawCSS);
    const thumbCSS = _stripRootBody(SlidesThemes.generateThumbnailCSS(themeData));
    const pvScopedCSS = _stripRootBody(rawCSS.replace(/\.reveal/g, '.pv-current-frame')) + '\n' + _stripRootBody(rawCSS.replace(/\.reveal/g, '.pv-next-frame'));

    const visibleSlides = data.slides.filter(s => !s.hidden);
    const htmlOpts = {
        showSlideNumber: data.showSlideNumber || false,
        footerText: data.footerText || null,
        footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
        metadata: data.metadata || {},
        totalSlides: visibleSlides.length,
        chapterNumbers: SlidesRenderer._buildChapterNumbers(visibleSlides, data.autoNumberChapters),
        typography: SlidesShared.resolveTypographyDefaults(data.typography),
    };
    const slidesHTML = visibleSlides.map((slide, i) =>
        SlidesRenderer.renderSlide(slide, i, htmlOpts)
    ).join('\n');

    const usedWidgets = collectUsedWidgets(data.slides);

    // Inline widget scripts for standalone export
    let inlineWidgetScripts = '';
    let mountScript = '';
    if (usedWidgets.size > 0) {
        const scriptSet = new Set();
        const registry = {};
        for (const wid of usedWidgets) {
            const entry = CanvasEditor.WIDGET_REGISTRY[wid];
            if (entry) {
                scriptSet.add(entry.script);
                registry[wid] = { global: entry.global };
            }
        }
        // Stubs de base requis par les widgets Page-based (TcpHandshakePage, etc.)
        inlineWidgetScripts = `<script>if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;<\/script>\n`;
        for (const scriptPath of scriptSet) {
            try {
                const resp = await fetch('../shared/components/' + scriptPath);
                if (resp.ok) {
                    const code = await resp.text();
                    inlineWidgetScripts += `<script>/* widget: ${scriptPath} */\n${code}\n<\/script>\n`;
                }
            } catch(e) {
                console.warn('Could not inline widget script:', scriptPath, e);
            }
        }
        const regJSON = JSON.stringify(registry);
        mountScript = `<script>
(function() {
    var WREG = ${regJSON};
    window._mountOEIWidgets = function() {
        var slots = document.querySelectorAll('.sl-sim-container[data-widget]');
        for (var i = 0; i < slots.length; i++) {
            var slot = slots[i];
            if (slot.dataset.mounted) continue;
            var wid = slot.dataset.widget;
            if (!wid) continue;
            var reg = WREG[wid];
            if (!reg) { slot.textContent = 'Widget indisponible: ' + wid; continue; }
            try {
                var cls = window[reg.global];
                if (!cls || typeof cls.mount !== 'function') { slot.textContent = 'Widget non disponible: ' + wid; continue; }
                var config = JSON.parse(slot.dataset.config || '{}');
                cls.mount(slot, Object.assign({}, config, { type: wid }));
                slot.dataset.mounted = '1';
            } catch(e) {
                slot.textContent = 'Erreur widget: ' + (e.message || String(e));
            }
        }
    };
})();
<\/script>`;
    }

    const mountCall = usedWidgets.size > 0
        ? `\nReveal.addEventListener('slidechanged', function(){ window._mountOEIWidgets(); });\nwindow._mountOEIWidgets();`
        : '';

    // Mount special elements (LaTeX, Mermaid, Timer, Quiz interactivity)
    // Reuse the shared standalone script template to avoid drift between exports.
    const mountSpecialCall = _MOUNT_SPECIAL_SCRIPT;

    // Check whether any slide has notes
    const hasNotes = visibleSlides.some(s => s.notes);

    // Serialize visible slides data for presenter mode (minimal: only what presenter needs)
    const presenterSlidesData = JSON.stringify(visibleSlides.map(s => ({
        notes: s.notes || '',
        bg: s.bg || ''
    })));

    const dims = ASPECT_DIMS[editor.data?.metadata?.aspect || '16:9'] || [1280, 720];
    const titleEsc = esc(data.metadata?.title || 'Présentation');

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEsc}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/monokai.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
${_buildThemeFontLinks(themeData)}
<style>
/* ── Theme variables (single source of truth) ── */
${_buildThemeRootCSS(themeData)}
body { background: var(--sl-bg); }
${themeCSS}
${thumbCSS}
${pvScopedCSS}

/* ── Presenter toggle button ─────────────────────────── */
#pv-toggle-bar{position:fixed;bottom:12px;right:12px;z-index:9999;display:flex;gap:6px;opacity:0.35;transition:opacity .3s}
#pv-toggle-bar:hover,#pv-toggle-bar.show{opacity:1}
#pv-toggle-bar .pvt-btn{padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.7);color:#fff;cursor:pointer;font:500 .75rem/1 system-ui;backdrop-filter:blur(6px);transition:background .15s}
#pv-toggle-bar .pvt-btn:hover{background:rgba(0,0,0,.9)}

/* ── Presenter view ──────────────────────────────────── */
.pv-layout{display:none;width:100vw;height:100vh;background:#1a1a2e;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0;position:fixed;top:0;left:0;z-index:10000;--pv-notes-width:380px;--pv-current-height:60%;--pv-notes-font-size:1.1rem}
.pv-layout.active{display:grid;grid-template-columns:1fr 5px var(--pv-notes-width);grid-template-rows:1fr;gap:0}
.pv-slides-col{display:flex;flex-direction:column;background:#0f0f23;min-width:300px;overflow:hidden}
.pv-layout.active .pv-slides-col{padding-top:40px}
.pv-current{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;position:relative;height:var(--pv-current-height);min-height:120px;box-sizing:border-box}
.pv-current-frame{width:100%;flex:1;max-height:100%;border-radius:8px;overflow:hidden;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.1)}
.pv-current-inner{width:${dims[0]}px;height:${dims[1]}px;transform-origin:top left;pointer-events:none}
.pv-slide-counter{margin-top:8px;font-size:.8rem;color:rgba(255,255,255,.5);font-variant-numeric:tabular-nums;flex-shrink:0}
.pv-splitter-h{height:5px;cursor:row-resize;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0;position:relative;z-index:10}
.pv-splitter-h:hover,.pv-splitter-h.dragging{background:rgba(99,102,241,.5)}
.pv-splitter-h::after{content:'';height:3px;width:32px;border-radius:2px;background:rgba(255,255,255,.2)}
.pv-splitter-h:hover::after,.pv-splitter-h.dragging::after{background:rgba(255,255,255,.5)}
.pv-next{flex:1;display:flex;flex-direction:column;padding:8px 16px 12px;min-height:80px;box-sizing:border-box}
.pv-next-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);margin-bottom:6px;font-weight:600;flex-shrink:0}
.pv-next-frame{flex:1;border-radius:6px;overflow:hidden;background:#0f0f23;position:relative;border:1px solid rgba(255,255,255,.06)}
.pv-next-inner{width:${dims[0]}px;height:${dims[1]}px;transform-origin:top left;pointer-events:none}
.pv-next-empty{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.2);font-size:.85rem;font-style:italic}
.pv-splitter-v{width:5px;cursor:col-resize;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;transition:background .15s;position:relative;z-index:10}
.pv-splitter-v:hover,.pv-splitter-v.dragging{background:rgba(99,102,241,.5)}
.pv-splitter-v::after{content:'';width:3px;height:32px;border-radius:2px;background:rgba(255,255,255,.2)}
.pv-splitter-v:hover::after,.pv-splitter-v.dragging::after{background:rgba(255,255,255,.5)}
.pv-notes-col{display:flex;flex-direction:column;background:#16213e;min-width:200px;overflow:hidden}
.pv-layout.active .pv-notes-col{padding-top:40px}
.pv-notes-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 0;flex-shrink:0}
.pv-notes-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.4);font-weight:600}
.pv-font-controls{display:flex;align-items:center;gap:4px}
.pv-font-btn{width:26px;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;transition:background .15s;font-family:system-ui;line-height:1}
.pv-font-btn:hover{background:rgba(255,255,255,.15)}
.pv-font-size-label{font-size:.65rem;color:rgba(255,255,255,.35);min-width:28px;text-align:center;font-variant-numeric:tabular-nums}
.pv-notes-body{flex:1;overflow-y:auto;padding:8px 16px 16px}
.pv-notes-content{font-size:var(--pv-notes-font-size,1.1rem);line-height:1.7;color:#f1f5f9;white-space:pre-wrap;word-wrap:break-word}
.pv-notes-empty{color:rgba(255,255,255,.2);font-style:italic;font-size:.9rem}
.pv-controls{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;border-top:1px solid rgba(255,255,255,.08)}
.pv-timer-display{font-family:'SF Mono','Fira Code',monospace;font-size:1.6rem;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;user-select:none;letter-spacing:.05em;transition:color .2s}
.pv-timer-display.running{color:#4ade80}
.pv-timer-display:hover{color:rgba(255,255,255,.8)}
.pv-progress-badge{font-size:.85rem;color:rgba(255,255,255,.4);font-variant-numeric:tabular-nums;font-weight:500}
.pv-nav-btns{display:flex;gap:6px}
.pv-nav-btn{width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .15s}
.pv-nav-btn:hover{background:rgba(255,255,255,.12)}
.pv-nav-btn:disabled{opacity:.3;cursor:default}
.pv-toolbar{position:fixed;top:0;left:0;right:0;height:40px;z-index:10001;background:rgba(22,33,62,.95);backdrop-filter:blur(8px);display:flex;align-items:center;padding:0 16px;gap:12px;border-bottom:1px solid rgba(255,255,255,.08)}
.pv-toolbar-title{flex:1;font-size:.8rem;font-weight:600;color:#e2e8f0}
.pv-toolbar-btn{padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#e2e8f0;cursor:pointer;font-size:.72rem;font-family:system-ui;transition:background .15s}
.pv-toolbar-btn:hover{background:rgba(255,255,255,.15)}
.pv-layout.resizing,.pv-layout.resizing *{user-select:none!important;cursor:col-resize!important}
.pv-layout.resizing-h,.pv-layout.resizing-h *{user-select:none!important;cursor:row-resize!important}
.pv-shortcuts{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);font-size:.6rem;color:rgba(255,255,255,.25);font-family:monospace;pointer-events:none;white-space:nowrap;z-index:10001}

/* Responsive presenter */
@media(max-width:860px){.pv-layout.active{grid-template-columns:1fr;grid-template-rows:auto auto 1fr}.pv-splitter-v{display:none}.pv-slides-col{flex-direction:row;flex-wrap:wrap;max-height:50vh}.pv-current{flex:1;min-width:250px;height:auto;padding:8px}.pv-splitter-h{display:none}.pv-next{min-width:200px;padding:8px}.pv-notes-col{border-top:1px solid rgba(255,255,255,.08);padding-top:0!important}.pv-layout.active .pv-slides-col{padding:40px 0 0}.pv-slide-counter{font-size:.7rem}}
@media(max-width:600px){.pv-toolbar{padding:0 8px;gap:6px;height:36px}.pv-toolbar-title{font-size:.7rem}.pv-toolbar-btn{padding:3px 8px;font-size:.65rem}.pv-notes-content{font-size:.85rem!important;line-height:1.5}.pv-timer-display{font-size:1rem}.pv-nav-btn{width:32px;height:32px}.pv-shortcuts{display:none}}
</style>
</head><body>
<!-- Normal Reveal.js presentation -->
<div class="reveal" id="reveal-root"><div class="slides" id="slides-root">${slidesHTML}</div></div>

<!-- Presenter Mode Layout -->
<div class="pv-layout" id="presenter-view">
    <div class="pv-toolbar">
        <span class="pv-toolbar-title" id="pv-title">${titleEsc}</span>
        <button class="pv-toolbar-btn" id="pv-btn-black" title="Écran noir (B)">◼ Noir</button>
        <button class="pv-toolbar-btn" id="pv-btn-fullscreen" title="Plein écran (F)">⛶ Plein écran</button>
        <button class="pv-toolbar-btn" id="pv-btn-exit" title="Quitter le mode présentateur">✕ Quitter</button>
    </div>
    <div class="pv-slides-col" id="pv-slides-col">
        <div class="pv-current" id="pv-current-panel">
            <div class="pv-current-frame" id="pv-current-frame">
                <div class="pv-current-inner" id="pv-current-inner"></div>
            </div>
            <div class="pv-slide-counter" id="pv-counter"></div>
        </div>
        <div class="pv-splitter-h" id="pv-splitter-h" title="Glisser pour redimensionner"></div>
        <div class="pv-next">
            <div class="pv-next-label">Slide suivante</div>
            <div class="pv-next-frame" id="pv-next-frame">
                <div class="pv-next-inner" id="pv-next-inner"></div>
            </div>
        </div>
    </div>
    <div class="pv-splitter-v" id="pv-splitter-v" title="Glisser pour redimensionner"></div>
    <div class="pv-notes-col" id="pv-notes-col">
        <div class="pv-notes-header">
            <span class="pv-notes-label">📝 Notes</span>
            <div class="pv-font-controls">
                <button class="pv-font-btn" id="pv-font-down" title="Réduire la taille (−)">−</button>
                <span class="pv-font-size-label" id="pv-font-size-label">110%</span>
                <button class="pv-font-btn" id="pv-font-up" title="Augmenter la taille (+)">+</button>
            </div>
        </div>
        <div class="pv-notes-body">
            <div class="pv-notes-content" id="pv-notes"></div>
        </div>
        <div class="pv-controls">
            <div class="pv-timer-display" id="pv-timer" title="Clic: démarrer/pauser · Double-clic: reset">00:00</div>
            <div class="pv-progress-badge" id="pv-progress"></div>
            <div class="pv-nav-btns">
                <button class="pv-nav-btn" id="pv-prev" title="Précédent (←)">◀</button>
                <button class="pv-nav-btn" id="pv-next-btn" title="Suivant (→)">▶</button>
            </div>
        </div>
    </div>
    <div class="pv-shortcuts">← → Espace : naviguer · T minuteur · R reset · B noir · F plein écran · +/− taille notes</div>
</div>

<!-- Toggle bar -->
<div id="pv-toggle-bar">
    <button class="pvt-btn" id="pvt-presenter" title="Mode présentateur (P)">🎤 Présentateur</button>
</div>

${inlineWidgetScripts}
${mountScript}
<script>
// Embedded slide metadata for presenter mode
var _pvSlidesData = ${presenterSlidesData};
<\/script>
<script>
${mountSpecialCall}
<\/script>
<script type="module">
import Reveal from 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.esm.js';
import Highlight from 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.esm.js';

const DIMS = [${dims[0]}, ${dims[1]}];
const _slidesData = window._pvSlidesData;
let deck;
let presenterActive = false;

// ── Initialize Reveal.js ──────────────────────────────
deck = new Reveal(document.getElementById('reveal-root'), {
    hash: true, plugins: [Highlight], transition: 'slide',
    width: DIMS[0], height: DIMS[1],
    controls: false, progress: false, slideNumber: false
});
await deck.initialize();${mountCall}

// Show toggle bar briefly then on hover
const toggleBar = document.getElementById('pv-toggle-bar');
toggleBar.classList.add('show');
setTimeout(() => toggleBar.classList.remove('show'), 3000);
document.addEventListener('mousemove', e => {
    if (e.clientY > window.innerHeight - 60 && e.clientX > window.innerWidth - 200)
        toggleBar.classList.add('show');
    else if (!toggleBar.matches(':hover'))
        toggleBar.classList.remove('show');
});

// ── Presenter mode ────────────────────────────────────
let pvIndex = 0, pvBlack = false;
let pvTimerSec = 0, pvTimerRun = false, pvTimerInt = null;
const pvEl = document.getElementById('presenter-view');
const pvTimerEl = document.getElementById('pv-timer');
const CHANNEL_NAME = 'oei-slides-presenter-sync';
const SYNC_MSG = Object.freeze({ GO_TO: 'goTo', BLACK: 'black' });
const toIntOrNull = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};
let pvChannel = null;
let pvAudienceWin = null;

// Font size
const FONT_SIZES = [0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.5, 1.7, 2.0, 2.4];
let fontSizeIdx = 3;
function applyFontSize() {
    var sz = FONT_SIZES[fontSizeIdx];
    pvEl.style.setProperty('--pv-notes-font-size', sz + 'rem');
    document.getElementById('pv-font-size-label').textContent = Math.round(sz * 100) + '%';
}
applyFontSize();
document.getElementById('pv-font-up').addEventListener('click', function() {
    if (fontSizeIdx < FONT_SIZES.length - 1) { fontSizeIdx++; applyFontSize(); }
});
document.getElementById('pv-font-down').addEventListener('click', function() {
    if (fontSizeIdx > 0) { fontSizeIdx--; applyFontSize(); }
});

function pvTimerFmt(s) {
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return h > 0 ? h+':'+m+':'+sec : m+':'+sec;
}
function pvTimerToggle() {
    if (pvTimerRun) { clearInterval(pvTimerInt); pvTimerRun = false; pvTimerEl.classList.remove('running'); }
    else { pvTimerRun = true; pvTimerEl.classList.add('running'); pvTimerInt = setInterval(() => { pvTimerSec++; pvTimerEl.textContent = pvTimerFmt(pvTimerSec); }, 1000); }
}
function pvTimerReset() {
    clearInterval(pvTimerInt); pvTimerRun = false; pvTimerSec = 0;
    pvTimerEl.textContent = pvTimerFmt(0); pvTimerEl.classList.remove('running');
}
function pvFormatInline(value) {
    if (window.SlidesShared && typeof window.SlidesShared.formatInlineRichText === 'function') {
        return window.SlidesShared.formatInlineRichText(value || '');
    }
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\r?\n/g, '<br>');
}

function pvRenderSlide(sectionEl, container, frame) {
    if (!sectionEl) { container.innerHTML = '<div class="pv-next-empty">—</div>'; container.style.transform = ''; return; }
    container.innerHTML = sectionEl.outerHTML;
    const sec = container.querySelector('section');
    if (sec) {
        const aside = sec.querySelector('aside.notes');
        if (aside) aside.remove();
        var bg = sectionEl.dataset.backgroundColor || sectionEl.dataset.backgroundGradient || '';
        frame.style.background = bg;
        if (bg) sec.style.background = bg;
    }
    const fw = frame.clientWidth, fh = frame.clientHeight;
    const scale = Math.min(fw / DIMS[0], fh / DIMS[1]);
    container.style.transform = 'scale('+scale+')';
}

function pvRender() {
    const sections = document.querySelectorAll('#slides-root > section');
    const cur = sections[pvIndex];
    if (!cur) return;

    pvRenderSlide(cur, document.getElementById('pv-current-inner'), document.getElementById('pv-current-frame'));

    const nextSec = pvIndex + 1 < sections.length ? sections[pvIndex + 1] : null;
    if (nextSec) {
        pvRenderSlide(nextSec, document.getElementById('pv-next-inner'), document.getElementById('pv-next-frame'));
    } else {
        const ni = document.getElementById('pv-next-inner');
        ni.innerHTML = '<div class="pv-next-empty">Fin de la présentation</div>';
        ni.style.transform = '';
        document.getElementById('pv-next-frame').style.background = '';
    }

    const sd = _slidesData[pvIndex];
    const notesEl = document.getElementById('pv-notes');
    notesEl.innerHTML = sd && sd.notes
        ? '<div style="white-space:pre-wrap">'+pvFormatInline(sd.notes)+'</div>'
        : '<div class="pv-notes-empty">Pas de notes pour ce slide</div>';

    document.getElementById('pv-counter').textContent = 'Slide '+(pvIndex+1)+' / '+sections.length;
    document.getElementById('pv-progress').textContent = (pvIndex+1)+' / '+sections.length;
    document.getElementById('pv-prev').disabled = pvIndex === 0;
    document.getElementById('pv-next-btn').disabled = pvIndex >= sections.length - 1;
    document.getElementById('pv-current-frame').style.opacity = pvBlack ? '0' : '1';
    // Mount special elements in presenter frames
    if (window._mountSpecial) window._mountSpecial();
}

function pvGoTo(idx) {
    const total = document.querySelectorAll('#slides-root > section').length;
    if (idx < 0 || idx >= total) return;
    pvIndex = idx; pvBlack = false;
    deck.slide(pvIndex, 0, 0);
    pvRender();
    if (pvChannel) {
        pvChannel.postMessage({ type: SYNC_MSG.GO_TO, index: pvIndex });
        pvChannel.postMessage({ type: SYNC_MSG.BLACK, on: false });
    }
}
function pvToggleBlack() {
    pvBlack = !pvBlack;
    document.getElementById('pv-current-frame').style.opacity = pvBlack ? '0' : '1';
    if (pvChannel) pvChannel.postMessage({ type: SYNC_MSG.BLACK, on: pvBlack });
}

function enterPresenter() {
    presenterActive = true;
    pvIndex = deck.getState().indexh || 0;
    pvEl.classList.add('active');
    toggleBar.style.display = 'none';
    // Open audience window
    pvChannel = new BroadcastChannel(CHANNEL_NAME);
    var url = new URL(location.href);
    url.searchParams.set('mode', 'audience');
    pvAudienceWin = window.open(url.toString(), 'oei-audience');
    pvRender();
    pvTimerToggle();
    // Send initial state after audience loads
    setTimeout(function() {
        if (pvChannel) {
            pvChannel.postMessage({ type: SYNC_MSG.GO_TO, index: pvIndex });
            if (pvBlack) pvChannel.postMessage({ type: SYNC_MSG.BLACK, on: true });
        }
    }, 1500);
}
function exitPresenter() {
    presenterActive = false;
    pvEl.classList.remove('active');
    toggleBar.style.display = 'flex';
    if (pvTimerRun) pvTimerToggle();
    if (pvChannel) { pvChannel.close(); pvChannel = null; }
}

// Audience mode (when opened with ?mode=audience)
var urlParams = new URLSearchParams(location.search);
if (urlParams.get('mode') === 'audience') {
    // Hide presenter UI
    document.getElementById('presenter-view').style.display = 'none';
    document.getElementById('pv-toggle-bar').style.display = 'none';
    // Disable keyboard for audience
    deck.configure({ keyboard: false, touch: false, controls: false });
    // Fullscreen
    document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function(){});
    var tryFS = function() { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(function(){}); document.removeEventListener('click', tryFS); };
    document.addEventListener('click', tryFS);
    // Listen on channel
    var aCh = new BroadcastChannel(CHANNEL_NAME);
    aCh.onmessage = function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === SYNC_MSG.GO_TO) {
            var index = toIntOrNull(msg.index);
            if (index !== null) deck.slide(index, 0, 0);
        }
        if (msg.type === SYNC_MSG.BLACK) {
            var on = !!msg.on;
            document.querySelector('.reveal').style.opacity = on ? '0' : '1';
            document.body.style.background = on ? '#000' : '';
        }
    };
}

// Bind presenter controls
pvTimerEl.addEventListener('click', pvTimerToggle);
pvTimerEl.addEventListener('dblclick', pvTimerReset);
document.getElementById('pv-prev').addEventListener('click', () => pvGoTo(pvIndex - 1));
document.getElementById('pv-next-btn').addEventListener('click', () => pvGoTo(pvIndex + 1));
document.getElementById('pv-btn-black').addEventListener('click', pvToggleBlack);
document.getElementById('pv-btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});
document.getElementById('pv-btn-exit').addEventListener('click', exitPresenter);
document.getElementById('pvt-presenter').addEventListener('click', enterPresenter);

// Resize => re-render presenter
new ResizeObserver(() => { if (presenterActive) pvRender(); }).observe(document.getElementById('pv-current-frame'));
new ResizeObserver(() => { if (presenterActive) pvRender(); }).observe(document.getElementById('pv-next-frame'));

// ── Resizable splitters ──────────────────────────────
(function() {
    var splitterV = document.getElementById('pv-splitter-v');
    var splitterH = document.getElementById('pv-splitter-h');
    var pvLay = document.getElementById('presenter-view');
    var pvSlidesCol = document.getElementById('pv-slides-col');
    var pvNotesCol = document.getElementById('pv-notes-col');
    var pvCurPanel = document.getElementById('pv-current-panel');

    splitterV.addEventListener('mousedown', function(e) {
        e.preventDefault();
        splitterV.classList.add('dragging');
        pvLay.classList.add('resizing');
        var startX = e.clientX;
        var totalW = pvLay.getBoundingClientRect().width;
        var startNW = pvNotesCol.getBoundingClientRect().width;
        function onMove(ev) {
            var dx = startX - ev.clientX;
            var nw = Math.max(200, Math.min(totalW * 0.6, startNW + dx));
            pvLay.style.setProperty('--pv-notes-width', nw + 'px');
        }
        function onUp() {
            splitterV.classList.remove('dragging');
            pvLay.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (presenterActive) pvRender();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });

    splitterH.addEventListener('mousedown', function(e) {
        e.preventDefault();
        splitterH.classList.add('dragging');
        pvLay.classList.add('resizing-h');
        var startY = e.clientY;
        var colRect = pvSlidesCol.getBoundingClientRect();
        var startCH = pvCurPanel.getBoundingClientRect().height;
        var availH = colRect.height - 5;
        function onMove(ev) {
            var dy = ev.clientY - startY;
            var nh = Math.max(120, Math.min(availH - 80, startCH + dy));
            var pct = Math.round((nh / colRect.height) * 100);
            pvLay.style.setProperty('--pv-current-height', pct + '%');
        }
        function onUp() {
            splitterH.classList.remove('dragging');
            pvLay.classList.remove('resizing-h');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (presenterActive) pvRender();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
})();

// Keyboard
document.addEventListener('keydown', e => {
    if (presenterActive) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') { e.preventDefault(); pvGoTo(pvIndex + 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') { e.preventDefault(); pvGoTo(pvIndex - 1); }
        else if (e.key === 'Home') { e.preventDefault(); pvGoTo(0); }
        else if (e.key === 'End') { e.preventDefault(); pvGoTo(document.querySelectorAll('#slides-root > section').length - 1); }
        else if (e.key === 'b' || e.key === 'B' || e.key === '.') pvToggleBlack();
        else if (e.key === 'f' || e.key === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
        else if (e.key === 't' || e.key === 'T') pvTimerToggle();
        else if (e.key === 'r' || e.key === 'R') pvTimerReset();
        else if (e.key === '+' || e.key === '=') { if (fontSizeIdx < FONT_SIZES.length - 1) { fontSizeIdx++; applyFontSize(); } }
        else if (e.key === '-' || e.key === '_') { if (fontSizeIdx > 0) { fontSizeIdx--; applyFontSize(); } }
        else if (e.key === 'Escape') exitPresenter();
        else if (e.key === 'p' || e.key === 'P') exitPresenter();
        return;
    }
    // Normal mode
    if (e.key === 'p' || e.key === 'P') enterPresenter();
    if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    }
});
<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (data.metadata?.title || 'presentation').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    a.download = `${name}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify('HTML exporté avec mode présentateur', 'success');
}

/* ── Offline HTML Export (inline all CDN dependencies) ── */

const _OFFLINE_RESOURCES = {
    css: [
        '../vendor/revealjs/5.1.0/dist/reset.css',
        '../vendor/revealjs/5.1.0/dist/reveal.css',
        '../vendor/revealjs/5.1.0/plugin/highlight/monokai.css'
    ],
    js: [
        '../vendor/revealjs/5.1.0/dist/reveal.js',
        '../vendor/revealjs/5.1.0/plugin/highlight/highlight.js'
    ]
};

let _offlineCache = null;

async function _fetchOfflineResources() {
    if (_offlineCache) return _offlineCache;
    const results = { css: [], js: [] };

    for (const url of _OFFLINE_RESOURCES.css) {
        try {
            const resp = await fetch(url);
            if (resp.ok) results.css.push(await resp.text());
            else results.css.push(`/* Failed to fetch: ${url} */`);
        } catch { results.css.push(`/* Error fetching: ${url} */`); }
    }

    for (const url of _OFFLINE_RESOURCES.js) {
        try {
            const resp = await fetch(url);
            if (resp.ok) results.js.push(await resp.text());
            else results.js.push(`/* Failed to fetch: ${url} */`);
        } catch { results.js.push(`/* Error fetching: ${url} */`); }
    }

    _offlineCache = results;
    return results;
}

function _slugifyPresentationName(title, fallback = 'presentation') {
    return String(title || fallback)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        || fallback;
}

function _downloadBlob(blob, fileName) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

async function _fetchGoogleFontsCssForOffline() {
    try {
        const fontResp = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');
        if (fontResp.ok) return await fontResp.text();
    } catch (_) {}
    return '';
}

async function _buildOfflineExportDocument(data) {
    if (!data) throw new Error('Aucune présentation à exporter');
    const resources = await _fetchOfflineResources();
    const fontCSS = await _fetchGoogleFontsCssForOffline();

    const themeData = _resolveExportTheme(data);
    const _stripRootBody = css => css.replace(/:root\s*\{[^}]*\}/g, '').replace(/body\s*\{[^}]*\}/g, '');
    const rawCSS = SlidesThemes.generateCSS(themeData);
    const themeCSS = _stripRootBody(rawCSS);
    const thumbCSS = _stripRootBody(SlidesThemes.generateThumbnailCSS(themeData));
    const pvScopedCSS = _stripRootBody(rawCSS.replace(/\.reveal/g, '.pv-current-frame')) + '\n' + _stripRootBody(rawCSS.replace(/\.reveal/g, '.pv-next-frame'));

    const visibleSlides = data.slides.filter(s => !s.hidden);
    const htmlOpts = {
        showSlideNumber: data.showSlideNumber || false,
        footerText: data.footerText || null,
        footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
        metadata: data.metadata || {},
        totalSlides: visibleSlides.length,
        chapterNumbers: SlidesRenderer._buildChapterNumbers(visibleSlides, data.autoNumberChapters),
        typography: SlidesShared.resolveTypographyDefaults(data.typography),
    };
    const slidesHTML = visibleSlides.map((slide, i) =>
        SlidesRenderer.renderSlide(slide, i, htmlOpts)
    ).join('\n');

    const dims = ASPECT_DIMS[data?.metadata?.aspect || '16:9'] || [1280, 720];
    const titleEsc = esc(data.metadata?.title || 'Présentation');
    const presenterSlidesData = JSON.stringify(visibleSlides.map(s => ({
        notes: s.notes || '', bg: s.bg || ''
    })));
    const inlineCSS = resources.css.join('\n') + '\n' + fontCSS;

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEsc}</title>
<style>
/* ── Reveal.js CSS (inlined for offline use) ── */
${inlineCSS}
/* ── Theme ── */
${_buildThemeRootCSS(themeData)}
body { background: var(--sl-bg); }
${themeCSS}
${thumbCSS}
${pvScopedCSS}
</style>
</head><body>
<div class="reveal" id="reveal-root"><div class="slides" id="slides-root">${slidesHTML}</div></div>

<script>
var _pvSlidesData = ${presenterSlidesData};
<\/script>
<script>
${resources.js[0]}
<\/script>
<script>
${resources.js[1]}
<\/script>
<script>
var deck = new Reveal(document.getElementById('reveal-root'), {
    hash: true,
    plugins: [RevealHighlight],
    transition: 'slide',
    width: ${dims[0]}, height: ${dims[1]},
    controls: true, progress: true, slideNumber: true
});
deck.initialize();
<\/script>
<script>
${_MOUNT_SPECIAL_SCRIPT}
<\/script>
</body></html>`;

    const fileBase = _slugifyPresentationName(data.metadata?.title || 'presentation');
    return {
        html,
        fileBase,
        fileName: `${fileBase}-offline.html`,
    };
}

async function exportHTMLOffline() {
    notify('Export offline en cours (téléchargement des ressources)…', 'warning');

    try {
        const data = editor.data;
        if (!data) return;
        const offlineDoc = await _buildOfflineExportDocument(data);
        const blob = new Blob([offlineDoc.html], { type: 'text/html' });
        _downloadBlob(blob, offlineDoc.fileName);
        notify('HTML offline exporté (Reveal.js intégré)', 'success');
    } catch (err) {
        console.error('Offline export error:', err);
        notify('Erreur export offline : ' + err.message, 'error');
    }
}

window.exportHTMLOffline = exportHTMLOffline;

/* ── Batch PNG export (all slides as ZIP) ───────────────────────────────── */

async function exportPNGBatch() {
    const data = editor.data;
    if (!data || !data.slides.length) return;
    const dims = ASPECT_DIMS[data.metadata?.aspect] || [1280, 720];
    const total = data.slides.length;

    notify(`Export PNG de ${total} slides…`, 'warning');
    try {
        // Ensure html2canvas is loaded
        if (!window.html2canvas) {
            const script = document.createElement('script');
            script.src = '../vendor/html2canvas/1.4.1/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }
        // Ensure JSZip is loaded
        if (!window.JSZip) {
            const script = document.createElement('script');
            script.src = '../vendor/jszip/3.10.1/jszip.min.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }

        const zip = new JSZip();
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.zIndex = '-1';
        document.body.appendChild(container);

        const themeData = _resolveExportTheme(data);
        const themeCSS = SlidesThemes.generateCSS(themeData);
        const renderOpts = {
            showSlideNumber: data.showSlideNumber || false,
            footerText: data.footerText || null,
            footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
            metadata: data.metadata || {},
            totalSlides: total,
            chapterNumbers: SlidesRenderer._buildChapterNumbers(data.slides, data.autoNumberChapters),
            typography: SlidesShared.resolveTypographyDefaults(data.typography),
        };

        for (let i = 0; i < total; i++) {
            const slide = data.slides[i];
            const frame = document.createElement('div');
            frame.style.width = `${dims[0]}px`;
            frame.style.height = `${dims[1]}px`;
            frame.style.overflow = 'hidden';
            frame.style.position = 'relative';
            frame.style.background = 'var(--sl-slide-bg,#1a1d27)';
            frame.innerHTML = `<style>${themeCSS}</style>` + SlidesRenderer.renderSlide(slide, i, renderOpts);
            container.appendChild(frame);

            await new Promise(r => setTimeout(r, 80));

            const canvas = await html2canvas(frame, {
                width: dims[0], height: dims[1], scale: 2,
                backgroundColor: null, useCORS: true, logging: false,
            });

            // Convert to blob and add to zip
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
            const num = String(i + 1).padStart(String(total).length, '0');
            zip.file(`slide-${num}.png`, blob);
            container.removeChild(frame);
        }

        container.remove();

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        const name = (data.metadata?.title || 'presentation').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9àéèùêîôâ_-]/g, '');
        a.download = `${name}-slides.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        notify(`${total} PNGs exportés en ZIP`, 'success');
    } catch (e) {
        console.error('Batch PNG export error:', e);
        notify('Erreur export PNG batch : ' + e.message, 'error');
    }
}

/* ── Markdown export ────────────────────────────────────────────────────── */

function exportMarkdown() {
    const data = editor.data;
    if (!data) return;

    const lines = [];
    const meta = data.metadata || {};
    lines.push(`# ${meta.title || 'Présentation'}`);
    if (meta.author) lines.push(`**Auteur :** ${meta.author}`);
    lines.push('');

    for (let i = 0; i < data.slides.length; i++) {
        const slide = data.slides[i];
        lines.push(`---`);
        lines.push('');

        if (slide.type === 'canvas') {
            _mdCanvasSlide(slide, lines, i);
        } else {
            _mdTemplateSlide(slide, lines, i);
        }

        // Speaker notes
        if (slide.notes) {
            lines.push('');
            lines.push('> **Notes :** ' + slide.notes.replace(/\n/g, ' '));
        }
        lines.push('');
    }

    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const name = (meta.title || 'presentation').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9àéèùêîôâ_-]/g, '');
    a.download = `${name}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Markdown exporté', 'success');
}

function _mdTemplateSlide(slide, lines, idx) {
    switch (slide.type) {
        case 'title':
            if (slide.title) lines.push(`## ${slide.title}`);
            if (slide.subtitle) lines.push(`*${slide.subtitle}*`);
            break;
        case 'chapter':
            if (slide.title) lines.push(`## ${slide.title}`);
            if (slide.subtitle) lines.push(`${slide.subtitle}`);
            break;
        case 'bullets':
            if (slide.title) lines.push(`### ${slide.title}`);
            lines.push('');
            if (Array.isArray(slide.items)) {
                for (const item of slide.items) lines.push(`- ${_mdStripHtml(item)}`);
            }
            break;
        case 'code':
            if (slide.title) lines.push(`### ${slide.title}`);
            lines.push('');
            lines.push('```' + (slide.language || ''));
            lines.push(slide.code || '');
            lines.push('```');
            break;
        case 'split':
            if (slide.title) lines.push(`### ${slide.title}`);
            lines.push('');
            if (slide.left) lines.push(_mdStripHtml(slide.left));
            if (slide.right) { lines.push(''); lines.push(_mdStripHtml(slide.right)); }
            break;
        case 'definition':
            if (slide.term) { lines.push(`### ${slide.term}`); lines.push(''); }
            if (slide.definition) lines.push(`> ${_mdStripHtml(slide.definition)}`);
            break;
        case 'comparison':
            if (slide.title) lines.push(`### ${slide.title}`);
            lines.push('');
            if (slide.left) { lines.push(`**${slide.left.title || 'A'}**`); lines.push(_mdStripHtml(slide.left.content || '')); lines.push(''); }
            if (slide.right) { lines.push(`**${slide.right.title || 'B'}**`); lines.push(_mdStripHtml(slide.right.content || '')); }
            break;
        case 'image':
            if (slide.title) lines.push(`### ${slide.title}`);
            if (slide.src) lines.push(`![${slide.alt || ''}](${slide.src})`);
            break;
        case 'quote':
            if (slide.quote) lines.push(`> ${_mdStripHtml(slide.quote)}`);
            if (slide.attribution) lines.push(`> — *${slide.attribution}*`);
            break;
        case 'blank':
            lines.push(`*Slide ${idx + 1} (vide)*`);
            break;
        default:
            if (slide.title) lines.push(`### ${slide.title}`);
            break;
    }
}

function _mdCanvasSlide(slide, lines, idx) {
    const els = slide.elements || [];
    // Sort by vertical position then horizontal
    const sorted = [...els].sort((a, b) => (a.y - b.y) || (a.x - b.x));

    for (const el of sorted) {
        switch (el.type) {
            case 'heading':
                lines.push(`## ${_mdStripHtml(el.data?.html || el.data?.text || '')}`);
                break;
            case 'text':
                lines.push(_mdStripHtml(el.data?.html || el.data?.text || ''));
                break;
            case 'list':
                if (Array.isArray(el.data?.items)) {
                    for (const item of el.data.items) lines.push(`- ${_mdStripHtml(item)}`);
                }
                break;
            case 'code':
            case 'highlight':
                lines.push('```' + (el.data?.language || ''));
                lines.push(el.data?.code || '');
                lines.push('```');
                break;
            case 'image':
                lines.push(`![${el.data?.alt || ''}](${el.data?.src || ''})`);
                break;
            case 'definition':
                if (el.data?.term) lines.push(`**${el.data.term}**`);
                if (el.data?.definition) lines.push(`> ${_mdStripHtml(el.data.definition)}`);
                break;
            case 'code-example': {
                lines.push('**Exemple**');
                if (el.data?.text) lines.push(_mdStripHtml(el.data.text));
                if ((el.data?.widgetType || 'terminal') === 'stepper') {
                    const steps = Array.isArray(el.data?.stepperSteps) ? el.data.stepperSteps : [];
                    const first = steps[0] || {};
                    if (first.title) lines.push(`- ${_mdStripHtml(first.title)}`);
                    if (first.detail) lines.push(`  - ${_mdStripHtml(first.detail)}`);
                    if (first.code) {
                        lines.push('```' + (el.data?.language || ''));
                        lines.push(first.code);
                        lines.push('```');
                    }
                } else if (el.data?.code) {
                    lines.push('```' + (el.data?.language || ''));
                    lines.push(el.data.code || '');
                    lines.push('```');
                }
                break;
            }
            case 'quote':
                if (el.data?.text) lines.push(`> ${_mdStripHtml(el.data.text)}`);
                if (el.data?.attribution) lines.push(`> — *${el.data.attribution}*`);
                break;
            case 'table':
                _mdTable(el.data?.rows || [], lines);
                break;
            case 'mermaid':
                lines.push('```mermaid');
                lines.push(el.data?.code || '');
                lines.push('```');
                break;
            case 'latex':
                lines.push(`$$${el.data?.expression || ''}$$`);
                break;
            case 'video':
                if (el.data?.url) lines.push(`[Video](${el.data.url})`);
                break;
            case 'shape':
                if (el.data?.text) lines.push(`*${_mdStripHtml(el.data.text)}*`);
                break;
            default:
                break;
        }
        lines.push('');
    }
}

function _mdTable(rows, lines) {
    if (!rows.length) return;
    const header = rows[0];
    lines.push('| ' + header.map(c => _mdStripHtml(c)).join(' | ') + ' |');
    lines.push('| ' + header.map(() => '---').join(' | ') + ' |');
    for (let i = 1; i < rows.length; i++) {
        lines.push('| ' + rows[i].map(c => _mdStripHtml(c)).join(' | ') + ' |');
    }
}

function _mdStripHtml(text) {
    if (!text) return '';
    return text.replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(b|strong)>/gi, '**')
        .replace(/<\/?(i|em)>/gi, '*')
        .replace(/<\/?(u)>/gi, '')
        .replace(/<code>(.*?)<\/code>/gi, '`$1`')
        .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

/* ── Export PPTX ────────────────────────────────────────────────────────── */

async function exportPPTX() {
    const data = editor.data;
    if (!data) return;

    notify('Génération PowerPoint en cours…', 'warning');
    try {
        // Load PptxGenJS from CDN
        if (!window.PptxGenJS) {
            const script = document.createElement('script');
            script.src = '../vendor/pptxgenjs/3.12.0/pptxgen.bundle.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }

        const pptx = new PptxGenJS();
        const meta = data.metadata || {};
        const dims = ASPECT_DIMS[meta.aspect] || [1280, 720];
        const slideWIn = dims[0] / 96;  // px to inches (96 DPI)
        const slideHIn = dims[1] / 96;

        pptx.defineLayout({ name: 'OEI', width: slideWIn, height: slideHIn });
        pptx.layout = 'OEI';
        pptx.title = meta.title || 'Présentation';
        pptx.author = meta.author || '';
        pptx.subject = 'Slides export';

        // Resolve theme colors
        const themeData = _resolveExportTheme(data);
        const tc = { ...(SlidesThemes.BUILT_IN.dark.colors || {}), ...(themeData.colors || {}) };

        for (let si = 0; si < data.slides.length; si++) {
            const slideData = data.slides[si];
            if (slideData.hidden) continue;

            const pptSlide = pptx.addSlide();

            // Background
            if (slideData.bg) {
                const bgColor = _pptxExportColor(slideData.bg);
                if (bgColor) pptSlide.background = { color: bgColor };
            } else if (slideData.bgImage) {
                pptSlide.background = { data: slideData.bgImage };
            } else {
                const bg = _pptxExportColor(tc.slideBg || tc.bg);
                if (bg) pptSlide.background = { color: bg };
            }

            // Speaker notes
            if (slideData.notes) {
                pptSlide.addNotes(slideData.notes);
            }

            if (slideData.type === 'canvas') {
                _pptxExportCanvasSlide(pptSlide, slideData, dims, tc);
            } else {
                _pptxExportTemplateSlide(pptSlide, slideData, dims, tc);
            }
        }

        const filename = (meta.title || 'presentation').replace(/[^a-zA-Z0-9àéèùêîôâ _-]/g, '');
        await pptx.writeFile({ fileName: `${filename}.pptx` });
        notify(`PowerPoint exporté (${data.slides.length} slides)`, 'success');
    } catch (e) {
        console.error('PPTX export error:', e);
        notify('Erreur export PPTX : ' + e.message, 'error');
    }
}

function _pptxExportColor(cssColor) {
    if (!cssColor) return null;
    // Strip var() references
    if (cssColor.startsWith('var(')) return null;
    // hex
    const hex = cssColor.replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) return hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    // rgb()
    const rgb = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
        return [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return null;
}

function _pptxExportPt(px, dimPx) {
    // Convert px coordinate on canvas to inches for PptxGenJS
    return (px / dimPx) * (dimPx / 96);
}

function _pptxExportCanvasSlide(pptSlide, slideData, dims, tc) {
    const W = dims[0], H = dims[1];
    const toIn = (px) => px / 96;

    for (const el of (slideData.elements || [])) {
        const x = toIn(el.x || 0);
        const y = toIn(el.y || 0);
        const w = toIn(el.w || 100);
        const h = toIn(el.h || 50);
        const s = el.style || {};

        switch (el.type) {
            case 'heading':
            case 'text': {
                const text = el.data?.text || '';
                const opts = {
                    x, y, w, h,
                    fontSize: s.fontSize || (el.type === 'heading' ? 36 : 18),
                    fontFace: _pptxExportFont(s.fontFamily),
                    color: _pptxExportColor(s.color) || _pptxExportColor(el.type === 'heading' ? tc.heading : tc.text) || '333333',
                    bold: (s.fontWeight || 400) >= 700,
                    italic: s.fontStyle === 'italic',
                    align: s.textAlign || 'left',
                    valign: s.verticalAlign === 'middle' ? 'middle' : s.verticalAlign === 'bottom' ? 'bottom' : 'top',
                    wrap: true,
                };
                if (s.background) {
                    const bg = _pptxExportColor(s.background);
                    if (bg) opts.fill = { color: bg };
                }
                if (s.rotate) opts.rotate = s.rotate;
                pptSlide.addText(text, opts);
                break;
            }
            case 'list': {
                const items = el.data?.items || [];
                const textRows = items.map(item => ({
                    text: _mdStripHtml(item),
                    options: { bullet: true, fontSize: s.fontSize || 20, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333' }
                }));
                pptSlide.addText(textRows, { x, y, w, h, valign: 'top' });
                break;
            }
            case 'image': {
                const src = el.data?.src;
                if (src) {
                    const imgOpts = { x, y, w, h };
                    if (src.startsWith('data:')) {
                        imgOpts.data = src;
                    } else {
                        imgOpts.path = src;
                    }
                    if (s.rotate) imgOpts.rotate = s.rotate;
                    try { pptSlide.addImage(imgOpts); } catch(e) { /* skip broken images */ }
                }
                break;
            }
            case 'code':
            case 'highlight': {
                const code = el.data?.code || '';
                pptSlide.addText(code, {
                    x, y, w, h,
                    fontFace: 'Courier New',
                    fontSize: 13,
                    color: _pptxExportColor(tc.codeText) || 'E2E8F0',
                    fill: { color: _pptxExportColor(tc.codeBg) || '0D1117' },
                    valign: 'top',
                    wrap: true,
                });
                break;
            }
            case 'shape': {
                const shapeType = el.data?.shape || el.data?.shapeType || 'rect';
                const pptShape = _pptxMapShape(shapeType);
                const shapeOpts = { x, y, w, h };
                const fill = _pptxExportColor(s.fill);
                if (fill) shapeOpts.fill = { color: fill, transparency: Math.round((1 - (s.opacity ?? 0.25)) * 100) };
                if (s.stroke) {
                    const sc = _pptxExportColor(s.stroke);
                    if (sc) shapeOpts.line = { color: sc, width: s.strokeWidth || 2 };
                }
                if (s.rotate) shapeOpts.rotate = s.rotate;
                pptSlide.addShape(pptShape, shapeOpts);
                // Shape text
                if (el.data?.text) {
                    pptSlide.addText(el.data.text, {
                        x, y, w, h,
                        fontSize: 14, color: _pptxExportColor(tc.text) || '333333',
                        align: 'center', valign: 'middle',
                    });
                }
                break;
            }
            case 'table': {
                const rows = el.data?.rows || [];
                if (rows.length > 0) {
                    const tableRows = rows.map(row => row.map(cell => ({
                        text: cell,
                        options: { fontSize: s.fontSize || 14, color: _pptxExportColor(s.color) || '333333' }
                    })));
                    pptSlide.addTable(tableRows, {
                        x, y, w, h,
                        border: { pt: 1, color: '888888' },
                        colW: Array(rows[0].length).fill(w / rows[0].length),
                    });
                }
                break;
            }
            case 'definition': {
                const term = el.data?.term || '';
                const def = el.data?.definition || '';
                pptSlide.addText([
                    { text: term + '\n', options: { bold: true, fontSize: (s.fontSize || 22) + 4 } },
                    { text: def, options: { fontSize: s.fontSize || 18 } }
                ], { x, y, w, h, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333', valign: 'top', wrap: true });
                break;
            }
            case 'code-example': {
                const text = el.data?.text || '';
                const mode = el.data?.widgetType || 'terminal';
                let code = el.data?.code || '';
                if (mode === 'stepper') {
                    const steps = Array.isArray(el.data?.stepperSteps) ? el.data.stepperSteps : [];
                    code = steps[0]?.code || code;
                }
                const block = `Exemple\n\n${text}${code ? `\n\n${code}` : ''}`;
                pptSlide.addText(block, {
                    x, y, w, h,
                    fontSize: s.fontSize || 16,
                    color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333',
                    valign: 'top',
                    wrap: true,
                    fill: { color: 'F8FAFC', transparency: 12 },
                    line: { color: _pptxExportColor(tc.primary) || '4F46E5', pt: 1.25 },
                    margin: { left: 6, right: 6, top: 6, bottom: 6 },
                });
                break;
            }
            case 'quote': {
                const q = el.data?.text || '';
                const attr = el.data?.attribution || '';
                pptSlide.addText([
                    { text: `"${q}"`, options: { italic: true, fontSize: s.fontSize || 24 } },
                    ...(attr ? [{ text: `\n— ${attr}`, options: { fontSize: (s.fontSize || 24) - 6 } }] : [])
                ], { x, y, w, h, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333', align: 'center', valign: 'middle', wrap: true });
                break;
            }
            case 'video': {
                // Video as a placeholder text
                const url = el.data?.url || '';
                pptSlide.addText(`🎬 ${url}`, { x, y, w, h, fontSize: 14, color: '888888', align: 'center', valign: 'middle', fill: { color: 'F0F0F0' } });
                break;
            }
            default:
                break;
        }
    }
}

function _pptxExportTemplateSlide(pptSlide, slide, dims, tc) {
    const W = dims[0] / 96, H = dims[1] / 96;
    const pad = 0.5;

    switch (slide.type) {
        case 'title':
            pptSlide.addText(slide.title || '', {
                x: pad, y: H * 0.3, w: W - 2 * pad, h: 1.2,
                fontSize: 44, bold: true, align: 'center',
                color: _pptxExportColor(tc.heading) || 'FFFFFF',
            });
            if (slide.subtitle) {
                pptSlide.addText(slide.subtitle, {
                    x: pad, y: H * 0.3 + 1.4, w: W - 2 * pad, h: 0.8,
                    fontSize: 24, align: 'center',
                    color: _pptxExportColor(tc.muted) || 'AAAAAA',
                });
            }
            break;
        case 'chapter':
            pptSlide.addText(slide.title || '', {
                x: pad, y: H * 0.35, w: W - 2 * pad, h: 1,
                fontSize: 36, bold: true, align: 'center',
                color: _pptxExportColor(tc.heading) || 'FFFFFF',
            });
            break;
        case 'bullets':
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 32, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            if (Array.isArray(slide.items)) {
                const items = slide.items.map(it => ({
                    text: _mdStripHtml(it),
                    options: { bullet: true, fontSize: 22 }
                }));
                pptSlide.addText(items, {
                    x: pad, y: 1.3, w: W - 2 * pad, h: H - 2,
                    color: _pptxExportColor(tc.text) || 'CCCCCC',
                    valign: 'top',
                });
            }
            break;
        case 'code':
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 28, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            pptSlide.addText(slide.code || '', {
                x: pad, y: 1.2, w: W - 2 * pad, h: H - 1.8,
                fontFace: 'Courier New', fontSize: 14,
                color: _pptxExportColor(tc.codeText) || 'E2E8F0',
                fill: { color: _pptxExportColor(tc.codeBg) || '0D1117' },
                valign: 'top', wrap: true,
            });
            break;
        case 'quote':
            pptSlide.addText([
                { text: `"${slide.quote || ''}"`, options: { italic: true, fontSize: 28 } },
                ...(slide.attribution ? [{ text: `\n— ${slide.attribution}`, options: { fontSize: 18 } }] : [])
            ], {
                x: pad + 0.5, y: H * 0.25, w: W - 2 * pad - 1, h: H * 0.5,
                color: _pptxExportColor(tc.text) || 'CCCCCC',
                align: 'center', valign: 'middle', wrap: true,
            });
            break;
        default:
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 32, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            break;
    }
}

function _pptxExportFont(cssFontFamily) {
    if (!cssFontFamily) return 'Arial';
    const first = cssFontFamily.split(',')[0].trim().replace(/["']/g, '');
    if (/mono|courier/i.test(first)) return 'Courier New';
    return first || 'Arial';
}

function _pptxMapShape(shapeType) {
    const PptxGenJS = window.PptxGenJS;
    if (!PptxGenJS) return 'rect';
    const map = {
        'rect': PptxGenJS.ShapeType.rect,
        'rounded-rect': PptxGenJS.ShapeType.roundRect,
        'ellipse': PptxGenJS.ShapeType.ellipse,
        'triangle': PptxGenJS.ShapeType.triangle,
        'diamond': PptxGenJS.ShapeType.diamond,
        'hexagon': PptxGenJS.ShapeType.hexagon,
        'star': PptxGenJS.ShapeType.star5,
        'arrow-right': PptxGenJS.ShapeType.rightArrow,
        'arrow-left': PptxGenJS.ShapeType.leftArrow,
        'arrow-up': PptxGenJS.ShapeType.upArrow,
        'arrow-down': PptxGenJS.ShapeType.downArrow,
    };
    return map[shapeType] || PptxGenJS.ShapeType.rect;
}

window.exportPPTX = exportPPTX;
window.exportPNGBatch = exportPNGBatch;
window.exportMarkdown = exportMarkdown;

/* ── QR Code slide ─────────────────────────────────────────── */

/**
 * Generates a QR code slide (last slide) with a sharing link.
 * Uses a minimal QR encoder (alphanumeric mode, version auto).
 * Falls back to an API if the URL is too long.
 */
function insertQRCodeSlide() {
    const url = prompt('URL à partager via QR code :', window.location.href);
    if (!url) return;

    // Generate QR as SVG data URI using the QR API (lightweight, no lib needed)
    const qrSvg = generateQRSvg(url, 400);

    const slide = {
        type: 'canvas',
        transition: 'slide',
        elements: [
            {
                id: 'el_qr_bg', type: 'shape', shapeType: 'rectangle',
                x: 0, y: 0, w: 1280, h: 720, z: 0,
                style: { backgroundColor: '#ffffff' }
            },
            {
                id: 'el_qr_title', type: 'text',
                x: 140, y: 40, w: 1000, h: 60, z: 2,
                data: { text: '📱 Scannez pour accéder à la présentation' },
                style: { fontSize: 32, fontWeight: 700, color: '#1e293b', textAlign: 'center' }
            },
            {
                id: 'el_qr_img', type: 'image',
                x: 440, y: 130, w: 400, h: 400, z: 1,
                data: { src: qrSvg, alt: 'QR Code' },
                style: {}
            },
            {
                id: 'el_qr_url', type: 'text',
                x: 140, y: 560, w: 1000, h: 40, z: 3,
                data: { text: url },
                style: { fontSize: 18, color: '#64748b', textAlign: 'center', fontFamily: 'monospace' }
            }
        ],
        notes: 'Slide QR code généré automatiquement'
    };

    editor.data.slides.push(slide);
    editor.selectSlide(editor.data.slides.length - 1);
    editor.onChange();
    notify('Slide QR code ajouté en fin de présentation', 'success');
}

/**
 * Minimal QR Code SVG generator.
 * Uses a simple byte-mode QR encoder for short URLs.
 * For reliability, uses the qrcode.js approach with a fallback.
 */
function generateQRSvg(text, size) {
    // Use a lightweight QR matrix generator
    const modules = qrEncodeText(text);
    const n = modules.length;
    const cellSize = size / n;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="#fff"/>`;
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            if (modules[y][x]) {
                svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
            }
        }
    }
    svg += '</svg>';
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

/* ── Minimal QR Encoder (ISO 18004, byte mode, ECC-L) ──── */
function qrEncodeText(text) {
    const data = new TextEncoder().encode(text);
    // Determine version (1-10 only for simplicity)
    const capacities = [17,32,53,78,106,134,154,192,230,271]; // byte mode, ECC-L
    let version = 1;
    for (let i = 0; i < capacities.length; i++) {
        if (data.length <= capacities[i]) { version = i + 1; break; }
        if (i === capacities.length - 1) version = 10; // clamp
    }
    const size = version * 4 + 17;
    const matrix = Array.from({length: size}, () => Array(size).fill(null));
    const mask = Array.from({length: size}, () => Array(size).fill(false));

    // Place finder patterns
    function placeFinder(r, c) {
        for (let dy = -1; dy <= 7; dy++) {
            for (let dx = -1; dx <= 7; dx++) {
                const y = r + dy, x = c + dx;
                if (y < 0 || y >= size || x < 0 || x >= size) continue;
                const outer = dy === -1 || dy === 7 || dx === -1 || dx === 7;
                const ring = dy === 0 || dy === 6 || dx === 0 || dx === 6;
                const inner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
                matrix[y][x] = outer ? false : (ring || inner);
                mask[y][x] = true;
            }
        }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
        if (!mask[6][i]) { matrix[6][i] = i % 2 === 0; mask[6][i] = true; }
        if (!mask[i][6]) { matrix[i][6] = i % 2 === 0; mask[i][6] = true; }
    }

    // Alignment patterns (version >= 2)
    if (version >= 2) {
        const positions = _qrAlignmentPositions(version);
        for (const r of positions) {
            for (const c of positions) {
                if (mask[r]?.[c]) continue; // skip if overlapping finder
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const y = r + dy, x = c + dx;
                        if (y >= 0 && y < size && x >= 0 && x < size) {
                            matrix[y][x] = Math.abs(dy) === 2 || Math.abs(dx) === 2 || (dy === 0 && dx === 0);
                            mask[y][x] = true;
                        }
                    }
                }
            }
        }
    }

    // Reserve format info areas
    for (let i = 0; i < 8; i++) {
        if (!mask[8][i]) { mask[8][i] = true; matrix[8][i] = false; }
        if (!mask[i][8]) { mask[i][8] = true; matrix[i][8] = false; }
        if (!mask[8][size - 1 - i]) { mask[8][size - 1 - i] = true; matrix[8][size - 1 - i] = false; }
        if (!mask[size - 1 - i][8]) { mask[size - 1 - i][8] = true; matrix[size - 1 - i][8] = false; }
    }
    if (!mask[8][8]) { mask[8][8] = true; matrix[8][8] = false; }
    // Dark module
    matrix[size - 8][8] = true; mask[size - 8][8] = true;

    // Version info (version >= 7)
    if (version >= 7) {
        const vInfo = _qrVersionInfo(version);
        for (let i = 0; i < 18; i++) {
            const bit = (vInfo >> i) & 1;
            const r = Math.floor(i / 3), c = size - 11 + (i % 3);
            matrix[r][c] = !!bit; mask[r][c] = true;
            matrix[c][r] = !!bit; mask[c][r] = true;
        }
    }

    // Encode data
    const encoded = _qrEncodeData(data, version);

    // Place data bits
    let bitIdx = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5; // skip timing column
        const rows = upward ? _range(size - 1, -1) : _range(0, size);
        for (const row of rows) {
            for (const col of [right, right - 1]) {
                if (col < 0 || col >= size) continue;
                if (mask[row][col]) continue;
                matrix[row][col] = bitIdx < encoded.length ? !!encoded[bitIdx] : false;
                mask[row][col] = true;
                bitIdx++;
            }
        }
        upward = !upward;
    }

    // Apply mask pattern 0 (checkerboard: (row + col) % 2 === 0)
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (_qrIsFunction(r, c, size, version)) continue;
            if ((r + c) % 2 === 0) matrix[r][c] = !matrix[r][c];
        }
    }

    // Write format info (ECC-L = 01, mask 0 = 000 → 01000, with BCH)
    const formatBits = 0x77C4; // pre-computed for ECC-L, mask 0
    _qrPlaceFormatInfo(matrix, size, formatBits);

    // Add quiet zone (4 modules)
    const quiet = 4;
    const final = Array.from({length: size + 2 * quiet}, () => Array(size + 2 * quiet).fill(false));
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            final[r + quiet][c + quiet] = !!matrix[r][c];
        }
    }
    return final;
}

function _range(start, end) {
    const arr = [];
    if (start > end) { for (let i = start; i > end; i--) arr.push(i); }
    else { for (let i = start; i < end; i++) arr.push(i); }
    return arr;
}

function _qrAlignmentPositions(version) {
    if (version === 1) return [];
    const table = [[], [6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
    return table[version - 1] || table[9];
}

function _qrIsFunction(row, col, size, version) {
    // Finder + separator
    if (row <= 8 && col <= 8) return true;
    if (row <= 8 && col >= size - 8) return true;
    if (row >= size - 8 && col <= 8) return true;
    // Timing
    if (row === 6 || col === 6) return true;
    // Alignment
    if (version >= 2) {
        const positions = _qrAlignmentPositions(version);
        for (const r of positions) {
            for (const c of positions) {
                if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) return true;
            }
        }
    }
    // Dark module
    if (row === size - 8 && col === 8) return true;
    return false;
}

function _qrPlaceFormatInfo(matrix, size, info) {
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((info >> i) & 1);
    // Around top-left finder
    const positions1 = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
    for (let i = 0; i < 15; i++) {
        matrix[positions1[i][0]][positions1[i][1]] = !!bits[i];
    }
    // Along edges
    const positions2 = [[8,size-1],[8,size-2],[8,size-3],[8,size-4],[8,size-5],[8,size-6],[8,size-7],[8,size-8],
        [size-7,8],[size-6,8],[size-5,8],[size-4,8],[size-3,8],[size-2,8],[size-1,8]];
    for (let i = 0; i < 15; i++) {
        matrix[positions2[i][0]][positions2[i][1]] = !!bits[i];
    }
}

function _qrVersionInfo(version) {
    const table = [0,0,0,0,0,0,0x07C94,0x085BC,0x09A99,0x0A4D3];
    return table[version] || 0;
}

function _qrEncodeData(data, version) {
    const totalCodewords = _qrTotalCodewords(version);
    const eccCodewords = _qrEccCodewords(version);
    const dataCodewords = totalCodewords - eccCodewords;

    // Byte mode indicator (0100) + character count
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4); // byte mode
    const ccLen = version <= 9 ? 8 : 16;
    push(data.length, ccLen);
    for (const b of data) push(b, 8);

    // Terminator
    const totalBits = dataCodewords * 8;
    const termLen = Math.min(4, totalBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad bytes
    const pads = [0xEC, 0x11];
    let pi = 0;
    while (bits.length < totalBits) {
        push(pads[pi % 2], 8);
        pi++;
    }

    // Convert to codewords
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
        let val = 0;
        for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] || 0);
        codewords.push(val);
    }

    // RS error correction
    const eccCw = _rsEncode(codewords.slice(0, dataCodewords), eccCodewords);
    const allCw = [...codewords.slice(0, dataCodewords), ...eccCw];

    // Convert to bit array
    const result = [];
    for (const cw of allCw) {
        for (let i = 7; i >= 0; i--) result.push((cw >> i) & 1);
    }
    return result;
}

function _qrTotalCodewords(version) {
    const total = [26,44,70,100,134,172,196,242,292,346];
    return total[version - 1] || 346;
}

function _qrEccCodewords(version) {
    // ECC-L codewords count per version
    const ecc = [7,10,15,20,26,36,40,48,60,72];
    return ecc[version - 1] || 72;
}

/* ── Reed-Solomon encoder (GF(256), poly 0x11D) ────────── */
function _rsEncode(data, eccCount) {
    const gfExp = new Uint8Array(512);
    const gfLog = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
        gfExp[i] = x; gfLog[x] = i;
        x <<= 1;
        if (x >= 256) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];

    const gfMul = (a, b) => a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]];

    // Generator polynomial
    let gen = [1];
    for (let i = 0; i < eccCount; i++) {
        const ng = new Array(gen.length + 1).fill(0);
        for (let j = 0; j < gen.length; j++) {
            ng[j] ^= gen[j];
            ng[j + 1] ^= gfMul(gen[j], gfExp[i]);
        }
        gen = ng;
    }

    const msg = new Uint8Array(data.length + eccCount);
    msg.set(data);
    for (let i = 0; i < data.length; i++) {
        const coef = msg[i];
        if (coef !== 0) {
            for (let j = 0; j < gen.length; j++) {
                msg[i + j] ^= gfMul(gen[j], coef);
            }
        }
    }
    return Array.from(msg.slice(data.length));
}

/* ── Student Mode Export ──────────────────────────────────── */

/**
 * Exports a study-friendly HTML with:
 * - All slides rendered as a vertical scrollable page
 * - A sticky sidebar with slide index/navigation
 * - Notes displayed below each slide
 * - Print-optimized CSS
 */
function _buildStudentExportDocument(data) {
    if (!data) return null;
    const visibleSlides = (data.slides || []).filter(s => !s.hidden);
    if (!visibleSlides.length) return null;
    const themeData = _resolveExportTheme(data);
    const rawCSS = SlidesThemes.generateCSS(themeData);
    const _stripRootBody = css => css.replace(/:root\s*\{[^}]*\}/g, '').replace(/body\s*\{[^}]*\}/g, '');
    const themeCSS = _stripRootBody(rawCSS);

    const dims = ASPECT_DIMS[data.metadata?.aspect || '16:9'] || [1280, 720];
    const titleEsc = esc(data.metadata?.title || 'Présentation');

    // Build slide cards
    const htmlOpts = {
        showSlideNumber: true,
        footerText: data.footerText || null,
        footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
        metadata: data.metadata || {},
        totalSlides: visibleSlides.length,
        chapterNumbers: SlidesRenderer._buildChapterNumbers(visibleSlides, data.autoNumberChapters),
        typography: SlidesShared.resolveTypographyDefaults(data.typography),
    };
    let slideCards = '';
    let navItems = '';
    visibleSlides.forEach((slide, i) => {
        const num = i + 1;
        const slideHtml = SlidesRenderer.renderSlide(slide, i, htmlOpts);
        const title = slide.title || `Slide ${num}`;
        const titleClean = title.replace(/<[^>]*>/g, '').slice(0, 60);
        const notes = slide.notes ? `<div class="stu-notes"><strong>📝 Notes :</strong><div class="stu-notes-body">${SlidesShared.formatInlineRichText(slide.notes)}</div></div>` : '';

        slideCards += `<div class="stu-card" id="slide-${num}">
            <div class="stu-card-header"><span class="stu-num">${num}</span> ${esc(titleClean)}</div>
            <div class="stu-slide-wrap"><div class="stu-slide-inner reveal">${slideHtml}</div></div>
            ${notes}
        </div>\n`;

        navItems += `<a href="#slide-${num}" class="stu-nav-item"><span class="stu-nav-num">${num}</span>${esc(titleClean)}</a>\n`;
    });

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleEsc} — Mode étudiant</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
${_buildThemeFontLinks(themeData)}
<style>
${_buildThemeRootCSS(themeData)}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', system-ui, sans-serif; background: #f1f5f9; color: #1e293b; display: flex; min-height: 100vh; }

/* Sidebar */
.stu-sidebar { position: sticky; top: 0; left: 0; width: 260px; height: 100vh; background: #1e293b; color: #e2e8f0; overflow-y: auto; flex-shrink: 0; padding: 16px 0; z-index: 100; }
.stu-sidebar-title { padding: 0 16px 16px; font-size: 0.9rem; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px; }
.stu-nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; color: #94a3b8; text-decoration: none; font-size: 0.78rem; transition: background 0.15s, color 0.15s; border-left: 3px solid transparent; }
.stu-nav-item:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
.stu-nav-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: rgba(255,255,255,0.08); font-size: 0.7rem; font-weight: 600; flex-shrink: 0; }

/* Main */
.stu-main { flex: 1; padding: 32px; max-width: 960px; margin: 0 auto; }
.stu-header { text-align: center; margin-bottom: 32px; }
.stu-header h1 { font-size: 1.8rem; margin-bottom: 8px; }
.stu-header .stu-meta { color: #64748b; font-size: 0.85rem; }

/* Cards */
.stu-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px; overflow: hidden; scroll-margin-top: 16px; }
.stu-card-header { padding: 12px 16px; font-weight: 600; font-size: 0.85rem; border-bottom: 1px solid #e2e8f0; color: #475569; display: flex; align-items: center; gap: 8px; }
.stu-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: #6366f1; color: #fff; font-size: 0.7rem; font-weight: 700; flex-shrink: 0; }
.stu-slide-wrap { position: relative; width: 100%; padding-top: ${(dims[1] / dims[0] * 100).toFixed(2)}%; overflow: hidden; background: var(--sl-bg, #1a1a2e); }
.stu-slide-inner { position: absolute; top: 0; left: 0; width: ${dims[0]}px; height: ${dims[1]}px; transform-origin: top left; }
.stu-notes { padding: 12px 16px; background: #fffbeb; border-top: 1px solid #fde68a; font-size: 0.8rem; line-height: 1.6; }
.stu-notes strong { color: #92400e; }
.stu-notes-body { margin-top: 4px; color: #78350f; }

/* Slide rendering */
${themeCSS}
.reveal section { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

/* Responsive */
@media (max-width: 768px) {
    .stu-sidebar { display: none; }
    .stu-main { padding: 16px; }
}

/* Print */
@media print {
    .stu-sidebar { display: none; }
    body { background: #fff; }
    .stu-card { break-inside: avoid; box-shadow: none; border: 1px solid #e2e8f0; margin-bottom: 16px; }
    .stu-main { max-width: 100%; padding: 0; }
}
</style>
</head><body>
<nav class="stu-sidebar">
    <div class="stu-sidebar-title">📚 ${titleEsc}</div>
    ${navItems}
</nav>
<main class="stu-main">
    <div class="stu-header">
        <h1>${titleEsc}</h1>
        <div class="stu-meta">${visibleSlides.length} slides · Mode étudiant</div>
    </div>
    ${slideCards}
</main>
<script>
// Responsive slide scaling
function scaleSlides() {
    document.querySelectorAll('.stu-slide-wrap').forEach(wrap => {
        const inner = wrap.querySelector('.stu-slide-inner');
        if (!inner) return;
        const scale = wrap.offsetWidth / ${dims[0]};
        inner.style.transform = 'scale(' + scale + ')';
    });
}
window.addEventListener('resize', scaleSlides);
window.addEventListener('load', scaleSlides);
new ResizeObserver(scaleSlides).observe(document.querySelector('.stu-main'));

// Highlight sidebar on scroll
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            document.querySelectorAll('.stu-nav-item').forEach(a => a.style.borderLeftColor = 'transparent');
            const id = e.target.id;
            const link = document.querySelector('.stu-nav-item[href="#' + id + '"]');
            if (link) { link.style.borderLeftColor = '#6366f1'; link.style.color = '#e2e8f0'; }
        }
    });
}, { threshold: 0.3 });
document.querySelectorAll('.stu-card').forEach(card => observer.observe(card));
</script>
</body></html>`;
    return {
        html,
        visibleSlides,
        title: data.metadata?.title || 'presentation',
    };
}

function _collectCoursePackAssets(data) {
    if (_importExportAssets?.collectPresentationAssetUrls) {
        return _importExportAssets.collectPresentationAssetUrls(data);
    }
    const urls = new Set();
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    slides.forEach(slide => {
        if (typeof slide?.bgImage === 'string' && slide.bgImage.trim()) urls.add(slide.bgImage.trim());
        if (slide?.type === 'image' && typeof slide?.src === 'string' && slide.src.trim()) urls.add(slide.src.trim());
        if (slide?.type === 'canvas' && Array.isArray(slide.elements)) {
            slide.elements.forEach(el => {
                const src = typeof el?.data?.src === 'string' ? el.data.src.trim() : '';
                const embed = typeof el?.data?.embedUrl === 'string' ? el.data.embedUrl.trim() : '';
                const url = typeof el?.data?.url === 'string' ? el.data.url.trim() : '';
                if (src) urls.add(src);
                if (embed) urls.add(embed);
                if (url) urls.add(url);
            });
        }
    });
    return Array.from(urls.values());
}

function _buildCoursePackNotesMarkdown(data) {
    const title = data?.metadata?.title || 'Présentation';
    const visibleSlides = (data?.slides || []).filter(s => !s.hidden);
    let out = `# ${title}\n\n`;
    out += `- Généré le: ${new Date().toISOString()}\n`;
    out += `- Slides visibles: ${visibleSlides.length}\n\n`;
    visibleSlides.forEach((slide, idx) => {
        const slideTitle = String(slide?.title || `Slide ${idx + 1}`).replace(/\n/g, ' ').trim();
        out += `## Slide ${idx + 1} — ${slideTitle}\n\n`;
        const notes = String(slide?.notes || '').trim();
        out += notes ? `${notes}\n\n` : '_Aucune note_\n\n';
    });
    return out;
}

async function _ensureJSZipLoaded() {
    if (window.JSZip) return true;
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../vendor/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return !!window.JSZip;
}

async function exportStudentHTML() {
    const data = editor.data;
    if (!data) return;
    const built = _buildStudentExportDocument(data);
    if (!built) { notify('Aucun slide à exporter', 'warning'); return; }

    const blob = new Blob([built.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(built.title || 'presentation').replace(/[^a-zA-Z0-9_-]/g, '_') + '_etudiant.html';
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Export étudiant téléchargé', 'success');
}

async function exportCoursePack() {
    const data = editor.data;
    if (!data) return;
    const built = _buildStudentExportDocument(data);
    if (!built) { notify('Aucun slide à exporter', 'warning'); return; }
    try {
        await _ensureJSZipLoaded();
        if (!window.JSZip) throw new Error('JSZip indisponible');

        const packName = String(data.metadata?.title || 'presentation').replace(/[^a-zA-Z0-9_-]/g, '_');
        const jsonPayload = JSON.stringify(data, null, 2);
        const notesMd = _buildCoursePackNotesMarkdown(data);
        const assets = _collectCoursePackAssets(data);
        const assetsSummary = _summarizeAssetUrls(assets);
        let offlineHtml = '';
        try {
            const offlineDoc = await _buildOfflineExportDocument(data);
            offlineHtml = offlineDoc.html;
        } catch (offlineErr) {
            console.warn('Course pack: offline HTML skipped', offlineErr);
        }
        const files = [
            'manifest.json',
            'presentation.json',
            'student_mode.html',
            'notes.md',
            'assets-report.json',
            'README.md',
            'session-report-template.md',
        ];
        if (offlineHtml) files.splice(3, 0, 'presentation_offline.html');

        const manifest = {
            format: 'oei-course-pack-v1',
            generatedAt: new Date().toISOString(),
            title: data.metadata?.title || 'Présentation',
            aspect: data.metadata?.aspect || '16:9',
            slidesVisible: built.visibleSlides.length,
            assets: assetsSummary,
            files,
        };

        const zip = new window.JSZip();
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('presentation.json', jsonPayload);
        zip.file('student_mode.html', built.html);
        if (offlineHtml) zip.file('presentation_offline.html', offlineHtml);
        zip.file('notes.md', notesMd);
        zip.file('assets-report.json', JSON.stringify({ assets }, null, 2));
        zip.file('README.md', `# Pack cours\n\nCe pack contient:\n- la présentation source JSON\n- une version HTML étudiant${offlineHtml ? '\n- une version HTML offline (Reveal + plugins intégrés)' : ''}\n- des notes consolidées\n- un inventaire des assets\n\n## Replay\nLe replay temporel est exporté depuis le mode présentateur.\n`);
        zip.file('session-report-template.md', `# Rapport de session\n\n- Date:\n- Salle:\n- Nombre d'étudiants:\n- Interactions clés:\n- Ajustements pour la prochaine séance:\n`);

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${packName}_pack_cours.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        notify('Pack cours exporté', 'success');
    } catch (err) {
        console.error('Course pack export error:', err);
        notify('Erreur export pack cours: ' + (err?.message || 'inconnue'), 'error');
    }
}

window.insertQRCodeSlide = insertQRCodeSlide;
window.exportStudentHTML = exportStudentHTML;
window.exportCoursePack = exportCoursePack;
