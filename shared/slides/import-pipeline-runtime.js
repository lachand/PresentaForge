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
