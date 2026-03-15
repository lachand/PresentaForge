/* import-pipeline-bundle.js — bundled assets/runtime/normalization/layout helpers */

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


/* import-pipeline-runtime.js — Runtime helpers for illustration/media passes */
(function initImportPipelineRuntime(global) {
    'use strict';

    if (global.OEIImportPipelineRuntime) return;

    const localToStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.text === 'string') return value.text;
            if (typeof value.label === 'string') return value.label;
            if (typeof value.title === 'string') return value.title;
        }
        return fallback;
    };

    const withToStr = (deps, value, fallback = '') => {
        if (deps && typeof deps.toStr === 'function') return deps.toStr(value, fallback);
        return localToStr(value, fallback);
    };

    const callHook = (deps, hookName, report, path, message) => {
        const hook = deps && typeof deps[hookName] === 'function' ? deps[hookName] : null;
        if (!hook) return;
        hook(report, path, message);
    };

    const pushFix = (deps, report, path, message) => callHook(deps, 'pushFix', report, path, message);
    const pushWarn = (deps, report, path, message) => callHook(deps, 'pushWarn', report, path, message);
    const pushPass = (deps, report, name, details = '') => {
        const hook = deps && typeof deps.pushPass === 'function' ? deps.pushPass : null;
        if (!hook) return;
        hook(report, name, details);
    };

    const escXml = value => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const toBase64 = value => {
        const src = String(value == null ? '' : value);
        if (typeof global.btoa === 'function') {
            return global.btoa(unescape(encodeURIComponent(src)));
        }
        if (typeof global.Buffer !== 'undefined') {
            return global.Buffer.from(src, 'utf8').toString('base64');
        }
        throw new Error('Base64 non supporté dans cet environnement');
    };

    const importExportAssets = global.OEIImportExportAssets || null;

    const isDataAssetUrl = value => {
        if (importExportAssets?.isDataAssetUrl) return importExportAssets.isDataAssetUrl(value);
        return /^data:/i.test(String(value || '').trim());
    };

    const isRemoteAssetUrl = value => {
        if (importExportAssets?.isRemoteAssetUrl) return importExportAssets.isRemoteAssetUrl(value);
        return /^https?:\/\//i.test(String(value || '').trim());
    };

    const svgToDataUrl = svg => `data:image/svg+xml;base64,${toBase64(svg)}`;

    const iconMarkup = token => {
        switch (token) {
            case 'usb':
                return '<rect x="88" y="66" width="80" height="116" rx="16" fill="none" stroke="#fff" stroke-width="10"/><rect x="108" y="42" width="40" height="24" rx="6" fill="#fff"/><line x1="102" y1="114" x2="154" y2="114" stroke="#fff" stroke-width="10"/>';
            case 'hdd':
                return '<rect x="52" y="72" width="152" height="98" rx="16" fill="none" stroke="#fff" stroke-width="10"/><circle cx="90" cy="121" r="16" fill="none" stroke="#fff" stroke-width="9"/><line x1="124" y1="144" x2="174" y2="144" stroke="#fff" stroke-width="9"/>';
            case 'cloud':
                return '<path d="M82 158h84a28 28 0 0 0 0-56 46 46 0 0 0-88-12 30 30 0 0 0 4 68z" fill="none" stroke="#fff" stroke-width="10"/>';
            case 'security':
                return '<rect x="76" y="104" width="104" height="74" rx="10" fill="none" stroke="#fff" stroke-width="10"/><path d="M100 104V84a28 28 0 0 1 56 0v20" fill="none" stroke="#fff" stroke-width="10"/>';
            case 'network':
                return '<circle cx="60" cy="70" r="14" fill="#fff"/><circle cx="196" cy="70" r="14" fill="#fff"/><circle cx="128" cy="178" r="14" fill="#fff"/><line x1="74" y1="72" x2="182" y2="72" stroke="#fff" stroke-width="8"/><line x1="68" y1="82" x2="120" y2="166" stroke="#fff" stroke-width="8"/><line x1="188" y1="82" x2="136" y2="166" stroke="#fff" stroke-width="8"/>';
            case 'chart':
                return '<rect x="64" y="148" width="24" height="34" rx="4" fill="#fff"/><rect x="102" y="126" width="24" height="56" rx="4" fill="#fff"/><rect x="140" y="98" width="24" height="84" rx="4" fill="#fff"/><polyline points="66,112 102,88 138,102 176,70" fill="none" stroke="#fff" stroke-width="8"/>';
            case 'warning':
                return '<path d="M128 42 214 190H42z" fill="none" stroke="#fff" stroke-width="10"/><line x1="128" y1="92" x2="128" y2="140" stroke="#fff" stroke-width="10"/><circle cx="128" cy="164" r="6" fill="#fff"/>';
            case 'quiz':
                return '<circle cx="128" cy="120" r="70" fill="none" stroke="#fff" stroke-width="10"/><path d="M102 102a26 26 0 0 1 52 0c0 14-10 22-20 28v12" fill="none" stroke="#fff" stroke-width="10"/><circle cx="128" cy="164" r="7" fill="#fff"/>';
            case 'code':
                return '<polyline points="90,88 58,122 90,156" fill="none" stroke="#fff" stroke-width="10"/><polyline points="166,88 198,122 166,156" fill="none" stroke="#fff" stroke-width="10"/><line x1="142" y1="72" x2="114" y2="172" stroke="#fff" stroke-width="10"/>';
            default:
                return '<rect x="66" y="64" width="124" height="120" rx="14" fill="none" stroke="#fff" stroke-width="10"/><line x1="92" y1="100" x2="164" y2="100" stroke="#fff" stroke-width="8"/><line x1="92" y1="124" x2="154" y2="124" stroke="#fff" stroke-width="8"/><line x1="92" y1="148" x2="146" y2="148" stroke="#fff" stroke-width="8"/>';
        }
    };

    const generateAssetSvgDataUrl = ({ token, label }) => {
        const safeLabel = escXml(label || token || 'Illustration');
        const icon = iconMarkup(token || 'book');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="320" viewBox="0 0 256 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="256" height="160" rx="18" fill="url(#g)"/><g transform="translate(0,-6)">${icon}</g><rect x="18" y="124" width="220" height="24" rx="8" fill="rgba(0,0,0,0.28)"/><text x="128" y="141" fill="#ffffff" font-size="11" font-family="Inter,Arial,sans-serif" text-anchor="middle">${safeLabel}</text></svg>`;
        return svgToDataUrl(svg);
    };

    const detectIllustrationToken = text => {
        const src = String(text || '').toLowerCase();
        const map = [
            { token: 'usb', patterns: ['usb', 'clé usb', 'cle usb'] },
            { token: 'hdd', patterns: ['hdd', 'ssd', 'disque', 'storage', 'stockage'] },
            { token: 'cloud', patterns: ['cloud', 'nuage', 'drive', 'onedrive', 'google drive', 'dropbox', 'icloud'] },
            { token: 'security', patterns: ['sécurité', 'securite', 'rgpd', 'chiffrement', 'mot de passe', '2fa'] },
            { token: 'network', patterns: ['réseau', 'reseau', 'internet', 'serveur', 'server'] },
            { token: 'code', patterns: ['code', 'python', 'javascript', 'fonction', 'module', 'algorithme'] },
            { token: 'quiz', patterns: ['quiz', 'qcm', 'question', 'évaluation', 'evaluation'] },
            { token: 'warning', patterns: ['attention', 'risque', 'danger', 'erreur'] },
            { token: 'book', patterns: ['cours', 'chapitre', 'notion', 'définition', 'definition'] },
            { token: 'chart', patterns: ['données', 'donnees', 'graphique', 'statistique', 'métrique', 'mesure'] },
        ];
        for (const entry of map) {
            if (entry.patterns.some(pattern => src.includes(pattern))) return entry.token;
        }
        return 'book';
    };

    const collectSlideText = (slide, deps = {}) => {
        if (!slide || typeof slide !== 'object') return '';
        const chunks = [];
        ['title', 'subtitle', 'text', 'term', 'definition', 'quote', 'caption', 'author', 'notes'].forEach(key => {
            if (slide[key] != null) chunks.push(withToStr(deps, slide[key], ''));
        });
        if (Array.isArray(slide.items)) chunks.push(slide.items.map(item => withToStr(deps, item, '')).join(' '));
        if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
            slide.elements.forEach(el => {
                if (!el || typeof el !== 'object') return;
                if (!el.data || typeof el.data !== 'object') return;
                ['text', 'term', 'definition', 'question', 'title', 'label', 'alt'].forEach(key => {
                    if (el.data[key] != null) chunks.push(withToStr(deps, el.data[key], ''));
                });
                if (Array.isArray(el.data.items)) chunks.push(el.data.items.map(item => withToStr(deps, item, '')).join(' '));
            });
        }
        return chunks.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const slideHasVisual = (slide, deps = {}) => {
        if (!slide || typeof slide !== 'object') return false;
        if (slide.type === 'image') return !!withToStr(deps, slide.src, '').trim();
        if (slide.type === 'comparison' || slide.type === 'split') return true;
        if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
            return slide.elements.some(el => {
                const type = String(el?.type || '').toLowerCase();
                return ['image', 'smartart', 'diagramme', 'shape', 'mermaid', 'video', 'iframe'].includes(type);
            });
        }
        return false;
    };

    const getMaxIllustrations = settings => {
        const maxRaw = Number(settings?.maxIllustrations);
        if (!Number.isFinite(maxRaw)) return 14;
        return Math.max(0, Math.trunc(maxRaw));
    };

    const normalizeIllustrationPlan = (rawPlan, data, report, settings, deps = {}) => {
        const slides = Array.isArray(data?.slides) ? data.slides : [];
        const maxItems = getMaxIllustrations(settings);
        const autoInject = settings?.autoInjectIllustrations !== false;
        let list = Array.isArray(rawPlan) ? rawPlan : [];

        if (!list.length && autoInject) {
            list = slides.map((slide, idx) => {
                const text = collectSlideText(slide, deps);
                if (!text || slideHasVisual(slide, deps)) return null;
                const token = detectIllustrationToken(text);
                return {
                    slideIndex: idx,
                    intent: withToStr(deps, slide?.title, `Illustration slide ${idx + 1}`),
                    keywords: [token],
                    visualType: 'icon',
                    assetHint: `asset://icon/${token}?label=${encodeURIComponent(withToStr(deps, slide?.title, 'Illustration'))}`,
                    placement: 'right',
                    priority: 'normal',
                };
            }).filter(Boolean);
            if (list.length) pushFix(deps, report, 'illustrationPlan', `Pass 2: ${list.length} illustration(s) suggérée(s) automatiquement.`);
        }

        const sanitized = [];
        let truncated = false;
        list.forEach(entry => {
            if (!entry || typeof entry !== 'object') return;
            if (sanitized.length >= maxItems) {
                truncated = true;
                return;
            }
            const slideIndex = Math.trunc(Number(entry.slideIndex));
            if (!Number.isFinite(slideIndex) || slideIndex < 0 || slideIndex >= slides.length) return;
            const keywords = Array.isArray(entry.keywords)
                ? entry.keywords.map(v => withToStr(deps, v, '')).filter(Boolean)
                : [withToStr(deps, entry.keyword || entry.intent || '', '')].filter(Boolean);
            const token = detectIllustrationToken(`${keywords.join(' ')} ${withToStr(deps, entry.intent, '')}`);
            const visualType = ['icon', 'photo', 'diagramme', 'smartart', 'schema'].includes(withToStr(deps, entry.visualType, '').toLowerCase())
                ? withToStr(deps, entry.visualType, '').toLowerCase()
                : 'icon';
            sanitized.push({
                slideIndex,
                intent: withToStr(deps, entry.intent, `Illustration ${slideIndex + 1}`),
                keywords: keywords.length ? keywords : [token],
                visualType,
                assetHint: withToStr(deps, entry.assetHint, `asset://icon/${token}?label=${encodeURIComponent(withToStr(deps, entry.intent, `Slide ${slideIndex + 1}`))}`),
                placement: withToStr(deps, entry.placement, 'right'),
                priority: withToStr(deps, entry.priority, 'normal'),
            });
        });
        if (truncated) pushWarn(deps, report, 'illustrationPlan', 'Plan d’illustration tronqué (maxIllustrations atteint).');
        return sanitized.slice(0, maxItems);
    };

    const createFallbackElementId = usedIds => {
        let id = '';
        do {
            id = 'el_' + Math.random().toString(36).slice(2, 9);
        } while (usedIds.has(id));
        usedIds.add(id);
        return id;
    };

    const createElementId = (usedIds, deps = {}) => {
        if (deps && typeof deps.createElementId === 'function') return deps.createElementId(usedIds);
        return createFallbackElementId(usedIds);
    };

    const injectIllustrationOnSlide = (slide, plan, report, path, deps = {}) => {
        const assetSrc = withToStr(deps, plan?.assetHint, '');
        if (!assetSrc) return false;
        if (slide.type === 'image') {
            if (!withToStr(deps, slide.src, '').trim()) {
                slide.src = assetSrc;
                slide.alt = withToStr(deps, slide.alt, withToStr(deps, plan?.intent, 'Illustration'));
                pushFix(deps, report, `${path}.src`, 'Pass 2: image placeholder injecté.');
                return true;
            }
            return false;
        }
        if (slide.type !== 'canvas') return false;
        slide.elements = Array.isArray(slide.elements) ? slide.elements : [];
        const hasImage = slide.elements.some(el => String(el?.type || '').toLowerCase() === 'image');
        if (hasImage) return false;
        const usedIds = new Set(slide.elements.map(el => String(el?.id || '')).filter(Boolean));
        slide.elements.push({
            id: createElementId(usedIds, deps),
            type: 'image',
            x: 900,
            y: 140,
            w: 300,
            h: 240,
            z: 6,
            data: {
                src: assetSrc,
                alt: withToStr(deps, plan?.intent, 'Illustration'),
            },
            style: {
                objectFit: 'contain',
                borderRadius: '10px',
            },
        });
        pushFix(deps, report, `${path}.elements`, 'Pass 2: illustration injectée dans le canvas.');
        return true;
    };

    const applyIllustrationPlan = (data, report, settings, deps = {}) => {
        if (!data || typeof data !== 'object' || !Array.isArray(data.slides)) return [];
        const rawPlan = Array.isArray(data.illustrationPlan) ? data.illustrationPlan : [];
        const plan = normalizeIllustrationPlan(rawPlan, data, report, settings, deps);
        report.illustrationPlan = plan;
        let applied = 0;
        plan.forEach(entry => {
            const idx = entry.slideIndex;
            const slide = data.slides[idx];
            if (!slide) return;
            if (injectIllustrationOnSlide(slide, entry, report, `slides[${idx}]`, deps)) applied += 1;
        });
        if (Object.prototype.hasOwnProperty.call(data, 'illustrationPlan')) {
            delete data.illustrationPlan;
            pushFix(deps, report, 'illustrationPlan', 'illustrationPlan retiré de la sortie finale (schéma racine).');
        }
        pushPass(deps, report, 'pass-2-illustrations', `${plan.length} proposé(es), ${applied} injectée(s).`);
        return plan;
    };

    const parseAssetRef = (src, deps = {}) => {
        const value = withToStr(deps, src, '').trim();
        const match = value.match(/^asset:\/\/([^/?#]+)(?:\/([^?#]*))?(?:\?([\s\S]*))?$/i);
        if (!match) return null;
        const kind = withToStr(deps, match[1], '').toLowerCase();
        const token = decodeURIComponent(withToStr(deps, match[2], '').trim() || 'book').toLowerCase();
        const searchParams = new global.URLSearchParams(match[3] || '');
        return {
            raw: value,
            kind,
            token,
            label: withToStr(deps, searchParams.get('label'), '').trim(),
            src: withToStr(deps, searchParams.get('src'), '').trim(),
        };
    };

    const collectImageSlots = data => {
        const slots = [];
        if (!data || typeof data !== 'object' || !Array.isArray(data.slides)) return slots;
        data.slides.forEach((slide, slideIndex) => {
            if (!slide || typeof slide !== 'object') return;
            if (typeof slide.src === 'string') slots.push({ owner: slide, key: 'src', path: `slides[${slideIndex}].src` });
            if (typeof slide.bgImage === 'string') slots.push({ owner: slide, key: 'bgImage', path: `slides[${slideIndex}].bgImage` });
            if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
                slide.elements.forEach((el, elementIndex) => {
                    if (!el || typeof el !== 'object' || String(el.type || '').toLowerCase() !== 'image') return;
                    if (!el.data || typeof el.data !== 'object') el.data = {};
                    if (typeof el.data.src !== 'string') return;
                    slots.push({ owner: el.data, key: 'src', path: `slides[${slideIndex}].elements[${elementIndex}].data.src` });
                });
            }
        });
        return slots;
    };

    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        if (typeof global.FileReader === 'undefined') {
            reject(new Error('FileReader indisponible'));
            return;
        }
        const reader = new global.FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Lecture blob impossible'));
        reader.readAsDataURL(blob);
    });

    const fetchDataUrlWithTimeout = async (url, timeoutMs) => {
        if (typeof global.fetch !== 'function') throw new Error('fetch indisponible');
        const ctrl = typeof global.AbortController !== 'undefined' ? new global.AbortController() : null;
        const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
        try {
            const res = await global.fetch(url, { signal: ctrl?.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            return await blobToDataUrl(blob);
        } finally {
            if (timer) clearTimeout(timer);
        }
    };

    const materializeMediaAssets = async (data, report, settings, deps = {}) => {
        const slots = collectImageSlots(data);
        const cache = new Map();
        const base64Mode = withToStr(deps, settings?.base64Mode, 'icons-only').toLowerCase();
        const fetchRemoteImages = settings?.fetchRemoteImages === true;
        const timeoutMs = Number.isFinite(Number(settings?.timeoutMs)) ? Math.max(1000, Math.trunc(Number(settings.timeoutMs))) : 60000;
        for (const slot of slots) {
            const raw = withToStr(deps, slot.owner?.[slot.key], '').trim();
            if (!raw || isDataAssetUrl(raw)) continue;
            if (cache.has(raw)) {
                slot.owner[slot.key] = cache.get(raw);
                continue;
            }
            let next = raw;
            const asset = parseAssetRef(raw, deps);
            try {
                if (asset) {
                    if (base64Mode !== 'none' && (asset.kind === 'icon' || base64Mode === 'all')) {
                        const label = asset.label || asset.token || 'Illustration';
                        next = generateAssetSvgDataUrl({ token: asset.token, label });
                        report.media.generated += 1;
                        pushFix(deps, report, slot.path, `Pass 4: asset "${asset.raw}" converti en base64.`);
                    }
                } else if (isRemoteAssetUrl(raw) && fetchRemoteImages && base64Mode === 'all') {
                    next = await fetchDataUrlWithTimeout(raw, timeoutMs);
                    report.media.fetched += 1;
                    pushFix(deps, report, slot.path, 'Pass 4: URL distante convertie en base64.');
                }
            } catch (err) {
                report.media.failed += 1;
                pushWarn(deps, report, slot.path, `Pass 4: conversion média impossible (${err?.message || 'erreur inconnue'}).`);
                if (asset) {
                    next = generateAssetSvgDataUrl({ token: asset.token || 'warning', label: asset.label || 'Visuel indisponible' });
                    report.media.generated += 1;
                    pushFix(deps, report, slot.path, 'Pass 4: fallback SVG local appliqué.');
                }
            }
            cache.set(raw, next);
            slot.owner[slot.key] = next;
        }
        pushPass(deps, report, 'pass-4-base64', `generated=${report.media.generated}, fetched=${report.media.fetched}, failed=${report.media.failed}`);
    };

    const testUtils = Object.freeze({
        detectIllustrationToken,
        parseAssetRef,
        collectSlideText,
        slideHasVisual,
        normalizeIllustrationPlan,
        generateAssetSvgDataUrl,
    });

    global.OEIImportPipelineRuntime = Object.freeze({
        detectIllustrationToken,
        parseAssetRef,
        generateAssetSvgDataUrl,
        normalizeIllustrationPlan,
        applyIllustrationPlan,
        materializeMediaAssets,
        testUtils,
    });
})(typeof window !== 'undefined' ? window : globalThis);


// @ts-check
/* import-pipeline-normalization.js — helpers de normalisation partagés */
(function initImportPipelineNormalization(global) {
    'use strict';

    if (global.OEIImportPipelineNormalization) return;

    const toStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.text === 'string') return value.text;
            if (typeof value.label === 'string') return value.label;
            if (typeof value.title === 'string') return value.title;
        }
        return fallback;
    };

    const levelToArray = raw => {
        if (Array.isArray(raw)) return raw;
        if (Number.isFinite(Number(raw))) return [Number(raw)];
        return [];
    };

    const normalizeListItems = (items, fallback = []) => {
        const pickText = (value, depth = 0) => {
            if (value == null) return '';
            if (typeof value === 'string') return value;
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (typeof value !== 'object' || depth >= 2) return '';
            const keys = ['text', 'label', 'title', 'name', 'value', 'content'];
            for (const key of keys) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
                const candidate = pickText(value[key], depth + 1);
                if (candidate) return candidate;
            }
            for (const candidateValue of Object.values(value)) {
                if (candidateValue == null || typeof candidateValue === 'object') continue;
                const candidate = pickText(candidateValue, depth + 1);
                if (candidate) return candidate;
            }
            for (const candidateValue of Object.values(value)) {
                if (!candidateValue || typeof candidateValue !== 'object') continue;
                const candidate = pickText(candidateValue, depth + 1);
                if (candidate) return candidate;
            }
            return '';
        };
        if (!Array.isArray(items)) return fallback;
        const out = items
            .map(item => pickText(item))
            .map(v => v.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        return out.length ? out : fallback;
    };

    const decodeBasicEntities = text => String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'");

    const stripHtmlToText = value => decodeBasicEntities(String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, ''));

    const parseHtmlList = html => {
        const src = String(html || '');
        const liMatches = [...src.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1] || '');
        if (liMatches.length) {
            return liMatches
                .map(txt => txt.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
        }
        const plain = src
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return plain ? [plain] : [];
    };

    global.OEIImportPipelineNormalization = Object.freeze({
        toStr,
        levelToArray,
        normalizeListItems,
        stripHtmlToText,
        parseHtmlList,
        testUtils: Object.freeze({
            toStr,
            levelToArray,
            normalizeListItems,
            stripHtmlToText,
            parseHtmlList,
        }),
    });
})(window);


// @ts-check
/* import-pipeline-layout.js — helpers de layout pour import-pipeline */
(function initImportPipelineLayout(global) {
    'use strict';

    if (global.OEIImportPipelineLayout) return;

    const localToStr = (value, fallback = '') => {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.text === 'string') return value.text;
            if (typeof value.label === 'string') return value.label;
            if (typeof value.title === 'string') return value.title;
        }
        return fallback;
    };

    const localNormalizeListItems = (items, fallback = []) => {
        if (!Array.isArray(items)) return fallback;
        const out = items
            .map(item => localToStr(item, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        return out.length ? out : fallback;
    };

    const localStripHtmlToText = value => String(value || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '');

    const withToStr = (deps, value, fallback = '') => (
        deps && typeof deps.toStr === 'function'
            ? deps.toStr(value, fallback)
            : localToStr(value, fallback)
    );

    const withNormalizeListItems = (deps, items, fallback = []) => (
        deps && typeof deps.normalizeListItems === 'function'
            ? deps.normalizeListItems(items, fallback)
            : localNormalizeListItems(items, fallback)
    );

    const withStripHtmlToText = (deps, value) => (
        deps && typeof deps.stripHtmlToText === 'function'
            ? deps.stripHtmlToText(value)
            : localStripHtmlToText(value)
    );

    const clampNum = (value, min, max) => Math.max(min, Math.min(max, value));

    const toFiniteNumber = (value, fallback) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const estimateWrappedLines = (text, charsPerLine) => {
        const safeCharsPerLine = Math.max(10, Math.trunc(charsPerLine || 10));
        const parts = String(text || '')
            .replace(/\r/g, '')
            .split('\n')
            .map(part => part.trim())
            .filter(Boolean);
        if (!parts.length) return 0;
        return parts.reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / safeCharsPerLine)), 0);
    };

    const estimateCardLineLoad = (title, items, widthPx) => {
        const effective = Math.max(220, Number(widthPx) || 220);
        const charsPerLine = Math.max(16, Math.floor((effective - 88) / 9.5));
        let lines = estimateWrappedLines(title, charsPerLine);
        const list = Array.isArray(items) ? items : [];
        for (const item of list) lines += estimateWrappedLines(item, charsPerLine);
        return Math.max(1, lines);
    };

    const estimateTableLineLoad = (rows, widthPx, deps = {}) => {
        const safeRows = Array.isArray(rows) ? rows : [];
        if (!safeRows.length) return 2;
        let lines = 0;
        safeRows.forEach(row => {
            const cells = Array.isArray(row) ? row : [row];
            const cols = Math.max(1, cells.length);
            const charsPerLine = Math.max(8, Math.floor((Math.max(280, widthPx) - 56) / cols / 8.5));
            const rowLines = Math.max(1, ...cells.map(cell => estimateWrappedLines(withToStr(deps, cell, ''), charsPerLine)));
            lines += rowLines;
        });
        return Math.max(2, lines);
    };

    const estimateCodeLineLoad = (code, widthPx) => {
        const src = String(code || '').replace(/\r/g, '');
        if (!src.trim()) return 1;
        const charsPerLine = Math.max(16, Math.floor((Math.max(320, widthPx) - 44) / 8.2));
        return src.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    };

    const estimateElementLineLoad = (type, data, widthPx, deps = {}) => {
        const safeType = String(type || '').toLowerCase();
        const safeData = (data && typeof data === 'object') ? data : {};
        const charsPerLine = Math.max(14, Math.floor((Math.max(260, widthPx) - 60) / 9.4));
        const richSegments = [];

        if (safeType === 'table') {
            return estimateTableLineLoad(safeData.rows, widthPx, deps);
        }
        if (safeType === 'code' || safeType === 'highlight') {
            return estimateCodeLineLoad(safeData.code, widthPx);
        }
        if (safeType === 'terminal-session') {
            return estimateCodeLineLoad(safeData.script, widthPx);
        }
        if (safeType === 'code-example') {
            const narrative = [safeData.label, safeData.text]
                .map(v => withToStr(deps, v, '').trim())
                .filter(Boolean)
                .reduce((sum, txt) => sum + estimateWrappedLines(txt, charsPerLine), 0);
            const codeLines = estimateCodeLineLoad(safeData.code, widthPx);
            return Math.max(2, narrative + codeLines);
        }
        if (safeType === 'list') {
            const title = withToStr(deps, safeData.title, '').trim();
            const items = withNormalizeListItems(deps, safeData.items || [], []);
            return Math.max(2, estimateCardLineLoad(title, items, widthPx));
        }
        if (safeType === 'definition') {
            richSegments.push(safeData.label, safeData.term, safeData.definition, safeData.example);
        } else if (safeType === 'quote') {
            richSegments.push(safeData.text, safeData.author);
        } else if (safeType === 'callout-box') {
            richSegments.push(safeData.label, safeData.text);
        } else if (safeType === 'exercise-block') {
            richSegments.push(safeData.title, safeData.objective, safeData.correction);
            withNormalizeListItems(deps, safeData.instructions || [], []).forEach(v => richSegments.push(v));
            withNormalizeListItems(deps, safeData.hints || [], []).forEach(v => richSegments.push(v));
        } else if (safeType === 'before-after') {
            richSegments.push(safeData.title, safeData.beforeLabel, safeData.before, safeData.afterLabel, safeData.after);
        } else if (safeType === 'mistake-fix') {
            richSegments.push(safeData.title, safeData.mistakeLabel, safeData.mistake, safeData.fixLabel, safeData.fix);
        } else if (safeType === 'text' || safeType === 'heading') {
            richSegments.push(safeData.html ? withStripHtmlToText(deps, safeData.html) : safeData.text);
        }

        const lines = richSegments
            .map(v => withToStr(deps, v, '').trim())
            .filter(Boolean)
            .reduce((sum, txt) => sum + estimateWrappedLines(txt, charsPerLine), 0);
        return Math.max(1, lines || estimateWrappedLines(withToStr(deps, safeData.text, ''), charsPerLine) || 1);
    };

    const AUTO_EXPAND_LAYOUT = Object.freeze({
        text: { minW: 320, minH: 120, maxW: 1220, maxH: 700, lineHeight: 22, overhead: 34 },
        list: { minW: 340, minH: 170, maxW: 1120, maxH: 700, lineHeight: 23, overhead: 52 },
        table: { minW: 420, minH: 210, maxW: 1220, maxH: 700, lineHeight: 23, overhead: 42 },
        definition: { minW: 420, minH: 220, maxW: 1120, maxH: 700, lineHeight: 22, overhead: 96 },
        quote: { minW: 380, minH: 190, maxW: 1120, maxH: 680, lineHeight: 24, overhead: 72 },
        'callout-box': { minW: 420, minH: 190, maxW: 1120, maxH: 680, lineHeight: 22, overhead: 82 },
        'exercise-block': { minW: 560, minH: 280, maxW: 1180, maxH: 700, lineHeight: 21, overhead: 122 },
        'before-after': { minW: 560, minH: 250, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 106 },
        'mistake-fix': { minW: 560, minH: 250, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 106 },
        'code-example': { minW: 560, minH: 270, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 118 },
        'terminal-session': { minW: 560, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 98 },
        code: { minW: 520, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 90 },
        highlight: { minW: 520, minH: 230, maxW: 1180, maxH: 700, lineHeight: 20, overhead: 90 },
    });

    const callPushFix = (options, path, message) => {
        if (!options || typeof options.pushFix !== 'function') return;
        options.pushFix(options.report, path, message);
    };

    const applyAutoExpandSizing = (out, options = {}) => {
        const type = String(out?.type || '').toLowerCase();
        const cfg = AUTO_EXPAND_LAYOUT[type];
        if (!cfg) return;

        let x = Math.round(toFiniteNumber(out.x, 60));
        let y = Math.round(toFiniteNumber(out.y, 120));
        const minWCanvas = Math.min(cfg.minW, 1280);
        const minHCanvas = Math.min(cfg.minH, 720);
        x = clampNum(x, 0, Math.max(0, 1280 - minWCanvas));
        y = clampNum(y, 0, Math.max(0, 720 - minHCanvas));

        const maxW = Math.max(cfg.minW, Math.min(cfg.maxW, 1280 - x));
        const maxH = Math.max(cfg.minH, Math.min(cfg.maxH, 720 - y));
        let w = Math.round(clampNum(toFiniteNumber(out.w, cfg.minW), cfg.minW, maxW));
        let h = Math.round(clampNum(toFiniteNumber(out.h, cfg.minH), cfg.minH, maxH));
        const original = { x: out.x, y: out.y, w: out.w, h: out.h };

        const deps = {
            toStr: options.toStr,
            normalizeListItems: options.normalizeListItems,
            stripHtmlToText: options.stripHtmlToText,
        };
        const neededHeight = width => {
            const lines = estimateElementLineLoad(type, out.data || {}, width, deps);
            return cfg.overhead + lines * cfg.lineHeight + 14;
        };

        let need = neededHeight(w);
        if (need > h) h = Math.round(clampNum(Math.max(h, need), cfg.minH, maxH));

        if (neededHeight(w) > h) {
            for (let candidate = w + 40; candidate <= maxW; candidate += 40) {
                if (neededHeight(candidate) <= h || candidate >= maxW) {
                    w = candidate;
                    break;
                }
            }
        }

        need = neededHeight(w);
        if (need > h) h = Math.round(clampNum(Math.max(h, need), cfg.minH, maxH));

        out.x = x;
        out.y = y;
        out.w = Math.round(clampNum(w, cfg.minW, maxW));
        out.h = Math.round(clampNum(h, cfg.minH, maxH));

        if (
            Number(original.x) !== out.x
            || Number(original.y) !== out.y
            || Number(original.w) !== out.w
            || Number(original.h) !== out.h
        ) {
            const slidePath = String(options.slidePath || '');
            const index = Math.trunc(Number(options.index));
            callPushFix(options, `${slidePath}.elements[${Number.isFinite(index) ? index : 0}]`, `Dimensions ${type} ajustées pour limiter le défilement interne.`);
        }
    };

    const estimateHeadingOverflow = (headingEl, deps = {}) => {
        if (!headingEl || typeof headingEl !== 'object') return 0;
        const data = (headingEl.data && typeof headingEl.data === 'object') ? headingEl.data : {};
        const style = (headingEl.style && typeof headingEl.style === 'object') ? headingEl.style : {};
        const text = withToStr(deps, data.text, '').trim();
        if (!text) return 0;
        const fontSize = clampNum(toFiniteNumber(style.fontSize, 44), 16, 120);
        const width = Math.max(200, toFiniteNumber(headingEl.w, 1160));
        const charsPerLine = Math.max(8, Math.floor((width - 26) / Math.max(6.5, fontSize * 0.55)));
        const lineCount = Math.max(1, estimateWrappedLines(text, charsPerLine));
        const neededHeight = Math.round(20 + lineCount * (fontSize * 1.18));
        const currentHeight = Math.max(40, toFiniteNumber(headingEl.h, 80));
        return Math.max(0, neededHeight - currentHeight);
    };

    const applyHeadingFlowAdjustments = (elements, options = {}) => {
        if (!Array.isArray(elements) || !elements.length) return;
        const headings = elements
            .filter(el => String(el?.type || '').toLowerCase() === 'heading')
            .sort((a, b) => toFiniteNumber(a?.y, 0) - toFiniteNumber(b?.y, 0));
        if (!headings.length) return;
        const heading = headings[0];
        const overflow = estimateHeadingOverflow(heading, { toStr: options.toStr });
        if (overflow <= 0) return;
        const originalHeadingHeight = Math.max(40, toFiniteNumber(heading.h, 80));
        const headingY = clampNum(Math.round(toFiniteNumber(heading.y, 40)), 0, 719);
        heading.h = clampNum(Math.round(originalHeadingHeight + overflow), 40, Math.max(40, 720 - headingY));
        const shift = Math.max(14, Math.round(overflow + 10));
        const threshold = headingY + originalHeadingHeight - 4;
        let moved = 0;
        elements.forEach((el) => {
            if (!el || el === heading || !Number.isFinite(Number(el.y))) return;
            const y = Math.round(Number(el.y));
            if (y <= threshold) return;
            const h = Math.max(20, Math.round(toFiniteNumber(el.h, 80)));
            const maxY = Math.max(0, 720 - h);
            const nextY = clampNum(y + shift, 0, maxY);
            if (nextY !== y) {
                el.y = nextY;
                moved += 1;
            }
        });
        const slidePath = String(options.slidePath || '');
        callPushFix(options, `${slidePath}.elements`, `Titre long détecté: hauteur du heading ajustée et ${moved} élément(s) décalé(s) vers le bas.`);
    };

    global.OEIImportPipelineLayout = Object.freeze({
        clampNum,
        toFiniteNumber,
        estimateWrappedLines,
        estimateCardLineLoad,
        estimateTableLineLoad,
        estimateCodeLineLoad,
        estimateElementLineLoad,
        applyAutoExpandSizing,
        applyHeadingFlowAdjustments,
        testUtils: Object.freeze({
            clampNum,
            toFiniteNumber,
            estimateWrappedLines,
            estimateCardLineLoad,
            estimateTableLineLoad,
            estimateCodeLineLoad,
            estimateElementLineLoad,
            applyAutoExpandSizing,
            applyHeadingFlowAdjustments,
        }),
    });
})(window);
