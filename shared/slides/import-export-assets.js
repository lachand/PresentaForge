/* import-export-assets.js — shared asset helpers for import/export/reporting */
(function initImportExportAssets(global) {
    'use strict';

    if (global.OEIImportExportAssets) return;

    const toStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return fallback;
    };

    const normalizeUrl = value => toStr(value, '').trim();

    const isDataAssetUrl = value => /^data:/i.test(normalizeUrl(value));
    const isDataImageUrl = value => /^data:image\//i.test(normalizeUrl(value));
    const isRemoteAssetUrl = value => /^https?:\/\//i.test(normalizeUrl(value));

    const classifyAssetUrl = value => {
        const url = normalizeUrl(value);
        if (!url) return 'empty';
        if (isDataAssetUrl(url)) return 'data';
        if (isRemoteAssetUrl(url)) return 'web';
        return 'local';
    };

    const estimateDataUrlBytes = dataUrl => {
        if (!isDataImageUrl(dataUrl)) return 0;
        const raw = normalizeUrl(dataUrl);
        const comma = raw.indexOf(',');
        if (comma === -1) return 0;
        const payload = raw.slice(comma + 1);
        return Math.max(0, Math.floor((payload.length * 3) / 4));
    };

    const collectPresentationAssetUrls = data => {
        const urls = new Set();
        const slides = Array.isArray(data?.slides) ? data.slides : [];

        slides.forEach(slide => {
            const bgImage = normalizeUrl(slide?.bgImage);
            const src = normalizeUrl(slide?.src);
            if (bgImage) urls.add(bgImage);
            if (src && String(slide?.type || '').toLowerCase() === 'image') urls.add(src);

            if (String(slide?.type || '').toLowerCase() !== 'canvas' || !Array.isArray(slide?.elements)) return;

            slide.elements.forEach(el => {
                const imageSrc = normalizeUrl(el?.data?.src);
                const embedUrl = normalizeUrl(el?.data?.embedUrl);
                const rawUrl = normalizeUrl(el?.data?.url);
                if (imageSrc) urls.add(imageSrc);
                if (embedUrl) urls.add(embedUrl);
                if (rawUrl) urls.add(rawUrl);
            });
        });

        return Array.from(urls.values());
    };

    const summarizeAssetUrls = urls => {
        const list = Array.isArray(urls) ? urls.map(normalizeUrl).filter(Boolean) : [];
        let dataUri = 0;
        let web = 0;
        let local = 0;
        list.forEach(url => {
            const kind = classifyAssetUrl(url);
            if (kind === 'data') dataUri += 1;
            else if (kind === 'web') web += 1;
            else if (kind === 'local') local += 1;
        });
        return {
            total: list.length,
            dataUri,
            web,
            local,
        };
    };

    Object.defineProperty(global, 'OEIImportExportAssets', {
        value: Object.freeze({
            classifyAssetUrl,
            collectPresentationAssetUrls,
            estimateDataUrlBytes,
            isDataAssetUrl,
            isDataImageUrl,
            isRemoteAssetUrl,
            summarizeAssetUrls,
        }),
        configurable: true,
        writable: false,
        enumerable: false,
    });
})(typeof window !== 'undefined' ? window : globalThis);
