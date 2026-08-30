/* editor-export-media.js — Fonctions pures de media pipeline (compression, estimation, signature)
 * Chargé avant editor-export.js par editor-bootstrap.js.
 * Toutes les fonctions sont globales (window.*) pour être accessibles depuis editor-export.js.
 */

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
