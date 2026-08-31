/**
 * @module slides/editor-ai-passes
 * @internal Module Slides chargé côté navigateur.
 * @example
 * // Chargement navigateur (après editor-ai-quiz.js):
 * // <script src="../shared/slides/editor-ai-passes.js"></script>
 */
/* editor-ai-passes.js — pipeline Gemini 5 passes + plan/placeholders d'illustrations (passe 3).
   Extrait de editor-ai-pipeline.js (chantier découpe pipeline IA éditeur). */
(function initEditorAIPassesModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const S = root.OEIEditorAIPipelineShared || null;
    if (!S) {
        throw new Error('OEIEditorAIPipelineShared indisponible: impossible de démarrer le pipeline 5 passes IA éditeur.');
    }
    const _client = root.OEIEditorAIClient || null;
    if (!_client) {
        throw new Error('OEIEditorAIClient indisponible: impossible de démarrer le pipeline 5 passes IA éditeur.');
    }
    const _editorAiSettings = root.OEIEditorAISettings || null;
    if (!_editorAiSettings) {
        throw new Error('OEIEditorAISettings indisponible: impossible de démarrer le pipeline 5 passes IA éditeur.');
    }
    const AI_IMAGE_GENERATION_ENABLED = _editorAiSettings.AI_IMAGE_GENERATION_ENABLED;
    const AI_GEMINI_MODELS = _editorAiSettings.AI_GEMINI_MODELS;
    const AI_GEMINI_IMAGE_MODELS = _editorAiSettings.AI_GEMINI_IMAGE_MODELS;

    const editor = S.editor;
    const notify = S.notify;
    const _tryParseJsonLoose = S.tryParseJsonLoose;
    const _stringifyPrettyJson = S.stringifyPrettyJson;
    const _fetchAIPromptTemplate = S.fetchAIPromptTemplate;
    const _formatRunnerPreview = S.formatRunnerPreview;
    const _extractPresentationFromPass = S.extractPresentationFromPass;
    const _buildAIPromptContext = S.buildAIPromptContext;
    const _buildAIPromptQualityGate = S.buildAIPromptQualityGate;
    const _buildAIAdaptiveBalanceRules = S.buildAIAdaptiveBalanceRules;
    const _buildAISensitiveComponentRules = S.buildAISensitiveComponentRules;
    const _computeAIQuizTarget = S.computeAIQuizTarget;

    const _callGeminiGenerate = _client._callGeminiGenerate;
    const _callGeminiGenerateImage = _client._callGeminiGenerateImage;
    const _supportsNativeGeminiImageModel = _client._supportsNativeGeminiImageModel;
    const _extractImageResultFromGemini = _client._extractImageResultFromGemini;
    const _svgToDataUrl = _client._svgToDataUrl;
    const _buildGeminiSingleImagePrompt = _client._buildGeminiSingleImagePrompt;
    const _buildGeminiSingleRasterImagePrompt = _client._buildGeminiSingleRasterImagePrompt;
    const _describeGeminiImageError = _client._describeGeminiImageError;

    // La couche UI (overlays / modales) est chargée après ce module: résolution paresseuse.
    function _reviewUiModule() {
        const ns = root.OEIEditorAIReviewUI;
        if (!ns) {
            throw new Error('OEIEditorAIReviewUI indisponible: pipeline IA éditeur incomplet.');
        }
        return ns;
    }
    const _createAIPassRunnerOverlay = (total) => _reviewUiModule()._createAIPassRunnerOverlay(total);
    const _reviewAIPassOutput = (args) => _reviewUiModule()._reviewAIPassOutput(args);
    const _reviewPass2IllustrationsChoice = (items) => _reviewUiModule()._reviewPass2IllustrationsChoice(items);
    const _reviewPass3GeneratedImagesChoice = (items) => _reviewUiModule()._reviewPass3GeneratedImagesChoice(items);

const _AI_PASS_CANCELLED_CODE = 'OEI_AI_PASS_CANCELLED';

function _makeAIPassCancelledError(step = '') {
    const err = new Error(step ? `Pipeline IA annulé (${step}).` : 'Pipeline IA annulé.');
    err.code = _AI_PASS_CANCELLED_CODE;
    err.step = step;
    return err;
}

function _createRuntimeElementId(used = new Set()) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let attempt = 0; attempt < 120; attempt++) {
        let suffix = '';
        for (let i = 0; i < 7; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
        const id = `el_${suffix}`;
        if (!used.has(id)) {
            used.add(id);
            return id;
        }
    }
    return `el_${Date.now().toString(36).slice(-7)}`;
}

function _escapeSvgText(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function _normalizePlacementForPlaceholder(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'full' || raw === 'center' || raw === 'left' || raw === 'right' || raw === 'top') return raw;
    if (raw.includes('full')) return 'full';
    if (raw.includes('left')) return 'left';
    if (raw.includes('right')) return 'right';
    if (raw.includes('top')) return 'top';
    return 'right';
}

function _estimateCanvasTopOffset(slide) {
    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    let maxBottom = 120;
    elements.forEach((el) => {
        if (!el || typeof el !== 'object') return;
        const type = String(el.type || '').toLowerCase();
        if (!['heading', 'text', 'list', 'card', 'definition', 'quote', 'highlight'].includes(type)) return;
        const x = Number(el.x);
        const y = Number(el.y);
        const w = Number(el.w);
        const h = Number(el.h);
        if (!Number.isFinite(y) || !Number.isFinite(h)) return;
        if (Number.isFinite(x) && Number.isFinite(w)) {
            if ((x + w) < 680) return;
        }
        if (y > 320) return;
        maxBottom = Math.max(maxBottom, y + h + 18);
    });
    return Math.max(120, Math.min(300, Math.trunc(maxBottom)));
}

function _computePlaceholderBox(entry, slide) {
    const placement = _normalizePlacementForPlaceholder(entry?.placement);
    const visualType = String(entry?.visualType || '').trim().toLowerCase();
    const top = _estimateCanvasTopOffset(slide);
    let w = 520;
    let h = 300;

    if (visualType.includes('photo')) { w = 560; h = 320; }
    if (visualType.includes('infograph')) { w = 600; h = 350; }
    if (visualType.includes('schema') || visualType.includes('diagram')) { w = 580; h = 330; }
    if (visualType.includes('icon')) { w = 420; h = 280; }
    if (placement === 'full') { w = 1120; h = Math.max(280, Math.min(420, 720 - top - 60)); }
    if (placement === 'top') { w = 900; h = Math.max(230, Math.min(320, 720 - top - 120)); }

    w = Math.max(320, Math.min(1120, Math.trunc(w)));
    h = Math.max(210, Math.min(460, Math.trunc(h)));

    let x = 80;
    let y = top;
    if (placement === 'right') x = 1280 - 80 - w;
    if (placement === 'center') x = Math.max(80, Math.trunc((1280 - w) / 2));
    if (placement === 'full') x = 80;
    if (placement === 'top') {
        x = Math.max(80, Math.trunc((1280 - w) / 2));
        y = Math.max(108, top - 10);
    }

    if (y + h > 700) {
        h = Math.max(200, 700 - y);
    }
    return { x, y, w, h };
}

function _buildIllustrationPlaceholderDataUrl(entry, box, slideIndex = 0) {
    const intent = String(entry?.intent || '').trim() || 'Illustration à insérer';
    const visualType = String(entry?.visualType || '').trim() || 'illustration';
    const keywords = Array.isArray(entry?.keywords)
        ? entry.keywords.filter(Boolean).slice(0, 4).join(', ')
        : '';
    const hintRaw = String(entry?.assetHint || '').trim();
    const hint = hintRaw ? hintRaw.slice(0, 120) : '';
    const w = Math.max(320, Math.trunc(Number(box?.w) || 520));
    const h = Math.max(210, Math.trunc(Number(box?.h) || 300));
    const title = _escapeSvgText(`Placeholder visuel — slide ${slideIndex + 1}`);
    const l1 = _escapeSvgText(intent.slice(0, 96));
    const l2 = _escapeSvgText(`Type: ${visualType}`);
    const l3 = _escapeSvgText(keywords ? `Mots-clés: ${keywords}` : 'Mots-clés: à définir');
    const l4 = _escapeSvgText(hint ? `Suggestion: ${hint}` : 'Suggestion: ajouter une illustration pertinente');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="phg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ecfeff"/><stop offset="100%" stop-color="#f5f3ff"/></linearGradient></defs><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="16" fill="url(#phg)" stroke="#8b5cf6" stroke-width="3" stroke-dasharray="12 8"/><rect x="18" y="16" width="${Math.max(180, w - 36)}" height="28" rx="8" fill="#111827"/><text x="${Math.trunc(w / 2)}" y="35" text-anchor="middle" fill="#ffffff" font-size="14" font-family="Inter,Arial,sans-serif">${title}</text><text x="22" y="78" fill="#111827" font-size="18" font-weight="700" font-family="Inter,Arial,sans-serif">${l1}</text><text x="22" y="108" fill="#334155" font-size="14" font-family="Inter,Arial,sans-serif">${l2}</text><text x="22" y="132" fill="#475569" font-size="13" font-family="Inter,Arial,sans-serif">${l3}</text><text x="22" y="156" fill="#64748b" font-size="12" font-family="Inter,Arial,sans-serif">${l4}</text></svg>`;
    return _svgToDataUrl(svg);
}

function _extractIllustrationsFromPass2(rawPass2) {
    const parsed = _tryParseJsonLoose(rawPass2);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') return [];
    const payload = parsed.value;
    const list = Array.isArray(payload.illustrations)
        ? payload.illustrations
        : (Array.isArray(payload.illustrationPlan) ? payload.illustrationPlan : []);
    return list.slice(0, 60);
}

function _normalizePass2Illustrations(rawPass2) {
    const list = _extractIllustrationsFromPass2(rawPass2);
    return list.map((entry, idx) => {
        const slide = Number.isFinite(Number(entry?.slide))
            ? Math.max(1, Math.trunc(Number(entry.slide)))
            : (Number.isFinite(Number(entry?.slideIndex)) ? Math.max(1, Math.trunc(Number(entry.slideIndex)) + 1) : (idx + 1));
        return {
            id: `ill_${idx + 1}`,
            index: idx,
            slide,
            slideIndex: slide - 1,
            slideTitle: String(entry?.slideTitle || '').trim(),
            intent: String(entry?.intent || '').trim(),
            visualType: String(entry?.visualType || '').trim(),
            assetHint: String(entry?.assetHint || entry?.src || '').trim(),
            placement: String(entry?.placement || '').trim(),
            raw: entry || {},
        };
    });
}

function _findOrCreateImageSlot(presentation, slideIndex, entry = null) {
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    const slide = slides[slideIndex];
    if (!slide || typeof slide !== 'object') return null;
    if (slide.type === 'image') {
        if (typeof slide.src !== 'string') slide.src = '';
        if (typeof slide.alt !== 'string') slide.alt = '';
        return { owner: slide, key: 'src', altOwner: slide, altKey: 'alt', path: `slides[${slideIndex}].src`, slide, created: false };
    }
    if (slide.type === 'split') {
        if (!slide.data || typeof slide.data !== 'object') slide.data = {};
        if (!slide.data.media || typeof slide.data.media !== 'object') slide.data.media = { type: 'image', src: '', alt: '' };
        if (String(slide.data.media.type || '').toLowerCase() === 'image') {
            if (typeof slide.data.media.src !== 'string') slide.data.media.src = '';
            if (typeof slide.data.media.alt !== 'string') slide.data.media.alt = '';
            return { owner: slide.data.media, key: 'src', altOwner: slide.data.media, altKey: 'alt', path: `slides[${slideIndex}].data.media.src`, slide, created: false };
        }
    }
    if (slide.type === 'canvas') {
        slide.elements = Array.isArray(slide.elements) ? slide.elements : [];
        let imageEl = null;
        let imageIdx = -1;
        let created = false;
        slide.elements.forEach((el, idx) => {
            if (imageEl) return;
            if (el && typeof el === 'object' && String(el.type || '').toLowerCase() === 'image') {
                imageEl = el;
                imageIdx = idx;
            }
        });
        if (!imageEl) {
            const box = _computePlaceholderBox(entry, slide);
            const used = new Set(slide.elements.map((el) => String(el?.id || '')).filter(Boolean));
            imageEl = {
                id: _createRuntimeElementId(used),
                type: 'image',
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                z: 6,
                data: { src: '', alt: '' },
                style: { objectFit: 'contain', borderRadius: '14px' },
            };
            slide.elements.push(imageEl);
            imageIdx = slide.elements.length - 1;
            created = true;
        } else if (entry && typeof imageEl === 'object') {
            const box = _computePlaceholderBox(entry, slide);
            imageEl.x = box.x;
            imageEl.y = box.y;
            imageEl.w = box.w;
            imageEl.h = box.h;
        }
        if (!imageEl.data || typeof imageEl.data !== 'object') imageEl.data = {};
        if (typeof imageEl.data.src !== 'string') imageEl.data.src = '';
        if (typeof imageEl.data.alt !== 'string') imageEl.data.alt = '';
        return {
            owner: imageEl.data,
            key: 'src',
            altOwner: imageEl.data,
            altKey: 'alt',
            path: `slides[${slideIndex}].elements[${imageIdx}].data.src`,
            slide,
            created,
            imageIndex: imageIdx,
            imageElement: imageEl,
        };
    }
    return null;
}

function _collectPass3ImageTargets(presentation, pass2Illustrations, maxItems = 20, strictSelection = false, imageStyle = 'mixte') {
    const out = [];
    const seen = new Set();
    const push = (slot, entry) => {
        if (!slot?.path || seen.has(slot.path)) return;
        seen.add(slot.path);
        out.push({ slot, entry });
    };
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    const max = Math.max(0, Math.min(80, Number(maxItems) || 0));
    pass2Illustrations.forEach((entry, idx) => {
        let slideIndex = Number.isFinite(Number(entry?.slideIndex))
            ? Number(entry.slideIndex)
            : (Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) - 1 : idx);
        slideIndex = Math.max(0, Math.trunc(slideIndex));
        if (slideIndex >= slides.length) return;
        const slot = _findOrCreateImageSlot(presentation, slideIndex, entry || {});
        if (!slot) return;
        const raw = String(slot.owner?.[slot.key] || '').trim();
        if (raw && !raw.startsWith('asset://') && !raw.startsWith('placeholder://')) return;
        push(slot, entry || {});
    });
    if (!strictSelection) {
        const fallbackVisualType = imageStyle === 'infographie'
            ? 'infographic'
            : (imageStyle === 'photo' ? 'photo' : (imageStyle === 'icones' ? 'icon' : 'illustration'));
        for (let i = 0; i < slides.length && out.length < max; i++) {
            const fallbackEntry = { slideIndex: i, visualType: fallbackVisualType, intent: 'Illustration pédagogique', keywords: [], placement: 'right' };
            const slot = _findOrCreateImageSlot(presentation, i, fallbackEntry);
            if (!slot) continue;
            const raw = String(slot.owner?.[slot.key] || '').trim();
            if (!raw || raw.startsWith('asset://') || raw.startsWith('placeholder://')) {
                push(slot, fallbackEntry);
            }
        }
    }
    return out.slice(0, max);
}

async function _materializePass3ImagesOneByOne({
    outputText,
    pass2Illustrations = [],
    brief,
    tuning,
    pipeline,
    gemini,
    runner,
    pass = 3,
    strictSelection = false,
}) {
    const parsed = _tryParseJsonLoose(outputText);
    if (!parsed.ok || !parsed.value || typeof parsed.value !== 'object') {
        return { text: outputText, payload: null, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };
    }
    const payload = parsed.value;
    const presentation = (payload?.presentation && typeof payload.presentation === 'object')
        ? payload.presentation
        : ((payload?.metadata && Array.isArray(payload?.slides)) ? payload : null);
    if (!presentation) return { text: outputText, payload: null, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };

    const targets = _collectPass3ImageTargets(
        presentation,
        Array.isArray(pass2Illustrations) ? pass2Illustrations : [],
        pipeline?.maxIllustrations || 14,
        strictSelection,
        tuning?.imageStyle || 'mixte'
    );
    if (!targets.length) {
        const nextPayload = { ...payload, mediaReport: { planned: 0, generated: 0, failed: 0 }, presentation };
        const text = _stringifyPrettyJson(nextPayload);
        return { text: text || outputText, payload: nextPayload, mediaReport: { planned: 0, generated: 0, failed: 0 }, generatedItems: [] };
    }

    if (!AI_IMAGE_GENERATION_ENABLED) {
        let placeholderCount = 0;
        let generatedId = 0;
        const generatedItems = [];
        runner?.setWaiting?.(pass, `Passe 3 — placeholders visuels (${targets.length})`);
        for (let i = 0; i < targets.length; i++) {
            const { slot, entry } = targets[i];
            const beforeSrc = String(slot.owner?.[slot.key] || '');
            const beforeAlt = String(slot.altOwner?.[slot.altKey] || '');
            const slideIdx = Number.isFinite(Number(entry?.slideIndex))
                ? Number(entry.slideIndex)
                : (Number.isFinite(Number(entry?.slide)) ? Math.max(0, Number(entry.slide) - 1) : i);
            let box = { w: 720, h: 340 };
            if (slot.slide && String(slot.slide.type || '').toLowerCase() === 'canvas') {
                box = _computePlaceholderBox(entry, slot.slide);
                if (slot.imageElement && typeof slot.imageElement === 'object') {
                    slot.imageElement.x = box.x;
                    slot.imageElement.y = box.y;
                    slot.imageElement.w = box.w;
                    slot.imageElement.h = box.h;
                    slot.imageElement.style = {
                        ...(slot.imageElement.style && typeof slot.imageElement.style === 'object' ? slot.imageElement.style : {}),
                        objectFit: 'contain',
                        borderRadius: '14px',
                    };
                }
            }
            const dataUrl = _buildIllustrationPlaceholderDataUrl(entry, box, slideIdx);
            slot.owner[slot.key] = dataUrl || '';
            if (slot.altOwner && slot.altKey) {
                slot.altOwner[slot.altKey] = String(entry?.intent || entry?.slideTitle || 'Placeholder illustration');
            }
            placeholderCount += 1;
            runner?.setProgress?.(
                pass,
                `Passe 3 — placeholder ${i + 1}/${targets.length}`,
                `Slide ${slideIdx + 1} • ${String(entry?.visualType || 'illustration')}`
            );
            runner?.pushImage?.(
                pass,
                slot.owner[slot.key],
                `S${slideIdx + 1} · placeholder · ${String(entry?.visualType || 'illustration')}`
            );
            generatedId += 1;
            generatedItems.push({
                id: `gen_${generatedId}`,
                slide: slideIdx,
                label: String(entry?.intent || entry?.slideTitle || '').trim() || 'Placeholder visuel',
                beforeSrc,
                beforeAlt,
                afterSrc: String(slot.owner?.[slot.key] || ''),
                afterAlt: String(slot.altOwner?.[slot.altKey] || ''),
                slot,
            });
        }
        const mediaReport = {
            planned: targets.length,
            generated: 0,
            failed: 0,
            placeholderCount,
            mode: 'placeholder-only',
        };
        const nextPayload = { ...payload, mediaReport, presentation };
        const text = _stringifyPrettyJson(nextPayload);
        return { text: text || outputText, payload: nextPayload, mediaReport, generatedItems };
    }

    let generated = 0;
    let failed = 0;
    let generatedId = 0;
    const generatedItems = [];
    const perImageTimeout = Math.max(
        8000,
        Math.min(
            240000,
            Math.trunc(Number(pipeline?.timeoutMs) || Number(gemini?.requestTimeoutMs) || 60000)
        )
    );
    runner?.setWaiting?.(pass, `Passe 3 — génération images (0/${targets.length})`);

    for (let i = 0; i < targets.length; i++) {
        const { slot, entry } = targets[i];
        const beforeSrc = String(slot.owner?.[slot.key] || '');
        const beforeAlt = String(slot.altOwner?.[slot.altKey] || '');
        runner?.setProgress?.(
            pass,
            `Passe 3 — génération image ${i + 1}/${targets.length}`,
            `Slide ${Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) : (i + 1)} • ${String(entry?.intent || 'Illustration pédagogique')}`
        );
        const rasterPrompt = _buildGeminiSingleRasterImagePrompt({
            brief,
            entry,
            slideIndex: Number.isFinite(Number(entry?.slideIndex)) ? Number(entry.slideIndex) : i,
            tuning,
        });
        const svgPrompt = _buildGeminiSingleImagePrompt({
            brief,
            entry,
            slideIndex: Number.isFinite(Number(entry?.slideIndex)) ? Number(entry.slideIndex) : i,
            tuning,
        });
        const preferredImageModel = String(gemini?.imageModel || '').trim();
        const imageModelCandidates = [
            preferredImageModel,
            ...AI_GEMINI_IMAGE_MODELS,
        ].map(v => String(v || '').trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx);
        let dataUrl = '';
        let alt = '';
        let failureReason = '';
        let imageSource = '';
        const attemptedModels = [];
        try {
            let lastErr = null;
            const nativeImageModelCandidates = imageModelCandidates.filter(_supportsNativeGeminiImageModel);
            if (!nativeImageModelCandidates.length) {
                runner?.setProgress?.(
                    pass,
                    `Passe 3 — image ${i + 1}/${targets.length}: modèle textuel`,
                    'Aucun modèle image natif sélectionné, passage direct en génération SVG/base64.'
                );
            }
            for (let mi = 0; mi < nativeImageModelCandidates.length; mi++) {
                const modelCandidate = nativeImageModelCandidates[mi];
                attemptedModels.push(modelCandidate);
                runner?.setProgress?.(
                    pass,
                    `Passe 3 — image ${i + 1}/${targets.length}: tentative image réelle`,
                    `Modèle: ${modelCandidate} (${mi + 1}/${nativeImageModelCandidates.length})`
                );
                try {
                    const imageResult = await _callGeminiGenerateImage({
                        apiKey: gemini.apiKey,
                        model: modelCandidate,
                        prompt: rasterPrompt,
                        temperature: Math.max(0.2, Math.min(1.2, Number(gemini.temperature) || 0.5)),
                        timeoutMs: perImageTimeout,
                    });
                    dataUrl = String(imageResult?.dataUrl || '').trim();
                    alt = String(entry?.intent || entry?.slideTitle || '').trim()
                        || String(imageResult?.textHint || '').trim()
                        || 'Illustration pédagogique';
                    if (dataUrl) imageSource = 'gemini-image';
                    if (dataUrl) break;
                } catch (errModel) {
                    lastErr = errModel;
                    const msg = String(errModel?.message || '').toLowerCase();
                    const maybeModelIssue = (
                        msg.includes('not support')
                        || msg.includes('unsupported')
                        || msg.includes('unknown model')
                        || msg.includes('not found')
                        || msg.includes('404')
                        || msg.includes('modality')
                        || msg.includes('responsemodalities')
                        || msg.includes('model')
                    );
                    if (!maybeModelIssue) break;
                }
            }
            if (!dataUrl && lastErr) throw lastErr;
        } catch (err) {
            failureReason = _describeGeminiImageError(err, perImageTimeout);
            if (attemptedModels.length) {
                failureReason = `${failureReason} | Modèles testés: ${attemptedModels.join(', ')}`;
            }
            runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: échec image réelle`, failureReason);
        }
        if (!dataUrl) {
            try {
                const svgModelCandidates = [
                    preferredImageModel,
                    gemini.model,
                    ...AI_GEMINI_MODELS,
                ].map(v => String(v || '').trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx);
                let svgErr = null;
                for (let si = 0; si < svgModelCandidates.length; si++) {
                    const svgModel = svgModelCandidates[si];
                    runner?.setProgress?.(
                        pass,
                        `Passe 3 — image ${i + 1}/${targets.length}: tentative SVG Gemini`,
                        `Modèle: ${svgModel} (${si + 1}/${svgModelCandidates.length})`
                    );
                    try {
                        const raw = await _callGeminiGenerate({
                            apiKey: gemini.apiKey,
                            model: svgModel,
                            prompt: svgPrompt,
                            temperature: Math.max(0.1, Math.min(1.2, Number(gemini.temperature) || 0.3)),
                            timeoutMs: perImageTimeout,
                        });
                        const extracted = _extractImageResultFromGemini(raw);
                        if (extracted?.dataUrl) {
                            dataUrl = extracted.dataUrl;
                            alt = extracted.alt || alt;
                            imageSource = 'gemini-svg';
                            break;
                        }
                        svgErr = new Error('Réponse Gemini reçue mais format image invalide (dataUrl manquant).');
                    } catch (errSvgModel) {
                        svgErr = errSvgModel;
                    }
                }
                if (!dataUrl && svgErr) {
                    const reason = _describeGeminiImageError(svgErr, perImageTimeout);
                    failureReason = failureReason ? `${failureReason} | ${reason}` : reason;
                }
            } catch (err2) {
                const reason = _describeGeminiImageError(err2, perImageTimeout);
                failureReason = failureReason ? `${failureReason} | ${reason}` : reason;
            }
        }
        if (!dataUrl) {
            failed += 1;
            runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: échec`, failureReason || 'Image non générée.');
            const currentSrc = String(slot.owner?.[slot.key] || '').trim();
            const shouldClear =
                !currentSrc
                || currentSrc.startsWith('asset://')
                || currentSrc.startsWith('placeholder://')
                || beforeSrc.trim().startsWith('asset://')
                || beforeSrc.trim().startsWith('placeholder://');
            if (shouldClear) {
                slot.owner[slot.key] = '';
                if (slot.altOwner && slot.altKey) slot.altOwner[slot.altKey] = '';
                if (
                    slot.created
                    && slot.slide
                    && String(slot.slide.type || '').toLowerCase() === 'canvas'
                    && Array.isArray(slot.slide.elements)
                    && Number.isInteger(slot.imageIndex)
                    && slot.imageIndex >= 0
                    && slot.slide.elements[slot.imageIndex] === slot.imageElement
                ) {
                    slot.slide.elements.splice(slot.imageIndex, 1);
                }
            }
            runner?.setProgress?.(
                pass,
                `Passe 3 — image ${i + 1}/${targets.length}: ignorée`,
                'Aucune image conservée pour cette slide.'
            );
            continue;
        }
        generated += 1;
        runner?.setProgress?.(pass, `Passe 3 — image ${i + 1}/${targets.length}: OK`, 'Image générée via Gemini.');
        runner?.pushImage?.(
            pass,
            dataUrl,
            `S${Number.isFinite(Number(entry?.slide)) ? Number(entry.slide) : (i + 1)} · ${String(entry?.visualType || 'illustration')} · ${imageSource || 'unknown'}`
        );
        slot.owner[slot.key] = dataUrl;
        if (slot.altOwner && slot.altKey) {
            slot.altOwner[slot.altKey] = String(alt || entry?.intent || entry?.slideTitle || 'Illustration');
        }
        generatedId += 1;
        generatedItems.push({
            id: `gen_${generatedId}`,
            slide: Number.isFinite(Number(entry?.slideIndex))
                ? Number(entry.slideIndex)
                : (Number.isFinite(Number(entry?.slide)) ? Math.max(0, Number(entry.slide) - 1) : 0),
            label: String(entry?.intent || entry?.slideTitle || '').trim() || 'Illustration',
            beforeSrc,
            beforeAlt,
            afterSrc: String(slot.owner?.[slot.key] || ''),
            afterAlt: String(slot.altOwner?.[slot.altKey] || ''),
            slot,
        });
    }

    const mediaReport = {
        planned: targets.length,
        generated,
        failed,
    };
    const nextPayload = { ...payload, mediaReport, presentation };
    const text = _stringifyPrettyJson(nextPayload);
    return { text: text || outputText, payload: nextPayload, mediaReport, generatedItems };
}

function _buildGeminiPassPrompt(pass, { brief, tuning, pipeline, previous, promptTemplate, refinePrompt = '', currentDraft = '' }) {
    const baseContext = _buildAIPromptContext(tuning, pipeline);
    const qualityGate = _buildAIPromptQualityGate(tuning, pipeline);
    const adaptiveRules = _buildAIAdaptiveBalanceRules(tuning);
    const sensitiveComponentRules = _buildAISensitiveComponentRules();
    const quizTarget = _computeAIQuizTarget(tuning);
    const relanceBlock = String(refinePrompt || '').trim()
        ? [
            'MODE RELANCE UTILISATEUR',
            '- Applique précisément la consigne suivante.',
            '- Conserve le schéma de la passe.',
            `Consigne de relance: ${refinePrompt}`,
            String(currentDraft || '').trim() ? `Brouillon actuel à corriger:\n${currentDraft}` : '',
        ].filter(Boolean).join('\n')
        : '';
    if (pass === 1) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 1 (Plan pédagogique).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":1,"title":"...","learningObjectives":["..."],"plan":[{"order":1,"title":"...","type":"title|chapter|bullets|code|split|definition|comparison|quote|blank|quiz|canvas","objective":"...","keyPoints":["..."],"level":1}],"risks":["..."]}',
            'Consignes: privilégie des slides compatibles avec des composants natifs riches (canvas + smartart/diagramme/card/definition/code-example/quiz), sans dépendance image.',
            'Règles d’équilibre obligatoires:',
            ...adaptiveRules,
            quizTarget > 0
                ? `- Dans le plan, marquer explicitement ~${quizTarget} slide(s) de checkpoint interactif.`
                : '- Aucun checkpoint quiz imposé dans le plan.',
            baseContext,
            `Brief utilisateur: ${brief}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 2) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 2 (Plan de composants visuels et illustrations).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":2,"illustrations":[{"slide":1,"slideTitle":"...","visualType":"icon|infographic|diagram|photo|schema","intent":"...","placement":"left|right|full","keywords":["..."],"assetHint":"..."}],"componentPlan":[{"slide":1,"componentType":"smartart|diagramme|card|definition|code-example|highlight|table|mermaid|quiz-live|mcq-single|mcq-multi|poll-likert|exit-ticket|postit-wall|rank-order|flashcards-auto|algo-stepper|code-compare|list|quote|shape","intent":"...","placement":"left|right|full","priority":"high|normal|low","payloadHint":"..."}]}',
            `Consignes: produire au plus ${Math.max(0, Math.min(60, Number(pipeline?.maxIllustrations) || 0))} illustrations ciblées et réellement utiles.`,
            `Style attendu prioritaire: ${tuning.imageStyle}. Évite de proposer uniquement des icons si des infographies/photos sont pertinentes.`,
            '- La génération d’image est désactivée: proposer des placeholders descriptifs précis.',
            '- Pour les objets simples (HDD/SSD/clé USB/document/dossier), proposer si pertinent des SVG externes de The Noun Project dans `assetHint`.',
            '- Si aucune illustration utile n’est nécessaire, renvoyer `illustrations: []`.',
            quizTarget > 0
                ? `- Prévoir dans componentPlan environ ${quizTarget} composant(s) interactif(s) de checkpoint (quiz/poll/mcq/exit-ticket).`
                : '- Fréquence quiz = none: pas d’obligation de composant interactif.',
            'Règles de format des composants sensibles:',
            ...sensitiveComponentRules,
            'Interdit: composant `columns` (non supporté).',
            baseContext,
            `Brief utilisateur: ${brief}`,
            `Résultat PASS 1:\n${previous.pass1 || ''}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 3) {
        const selectedIlluBlock = String(previous.pass2Selected || '').trim()
            ? `Illustrations validées par l'utilisateur (à prioriser):\n${previous.pass2Selected}`
            : '';
        return [
            'Tu exécutes UNIQUEMENT la PASS 3 (Génération JSON complet).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":3,"summary":{"slideCount":0,"mainTheme":"..."},"presentation":{"metadata":{},"theme":"icom","showSlideNumber":false,"footerText":null,"autoNumberChapters":false,"slides":[]}}',
            'Contraintes:',
            '- Utiliser les illustrations validées en PASS 2 si elles sont pertinentes.',
            '- Génération d’images désactivée: insérer des placeholders visuels explicites.',
            '- Les emplacements image doivent utiliser `placeholder://...` ou `asset://...` descriptifs.',
            '- Pour les pictogrammes simples, autorisé: URL SVG externe (ex: The Noun Project) dans `assetHint` et/ou `src`.',
            '- Le placeholder doit préciser l’intention visuelle (pas un bloc générique).',
            '- Préfère les composants natifs visuels (smartart, diagramme, card, definition, highlight, code-example, quiz, algo-stepper).',
            'Règles d’équilibre obligatoires:',
            ...adaptiveRules,
            quizTarget > 0
                ? `- Vérifie qu’il y a environ ${quizTarget} slide(s) interactives réparties dans le deck.`
                : '- Ne pas ajouter de quiz interactif si non justifié.',
            'Formats sensibles à respecter exactement:',
            ...sensitiveComponentRules,
            '- Interdit: composant canvas `columns`.',
            baseContext,
            qualityGate,
            `Brief utilisateur: ${brief}`,
            `Résultat PASS 1:\n${previous.pass1 || ''}`,
            `Résultat PASS 2:\n${previous.pass2 || ''}`,
            selectedIlluBlock,
            `Template de référence:\n${promptTemplate}`,
            relanceBlock,
        ].join('\n\n');
    }
    if (pass === 4) {
        return [
            'Tu exécutes UNIQUEMENT la PASS 4 (Composants + lisibilité).',
            'Réponds uniquement avec un JSON valide, sans markdown.',
            'Schéma JSON strict:',
            '{"pass":4,"componentReport":{"componentRichness":"high","imageCount":0},"presentation":{...}}',
            'Contraintes: conserver la structure PresentaForge, renforcer les composants natifs et garder uniquement les images pédagogiquement utiles.',
            baseContext,
            `Brief utilisateur: ${brief}`,
            `JSON PASS 3:\n${previous.pass3 || ''}`,
            relanceBlock,
        ].join('\n\n');
    }
    return [
        'Tu exécutes UNIQUEMENT la PASS 5 (Validation finale).',
        'Réponds uniquement avec un JSON valide, sans markdown.',
        'Schéma JSON strict:',
        '{"pass":5,"validation":{"isValid":true,"issues":[]},"presentation":{...}}',
        'Checklist finale: JSON parseable, types supportés, pas de [object Object], formats sensibles conformes, équilibre visuel respecté.',
        quizTarget > 0
            ? `- Vérifier la présence d’environ ${quizTarget} checkpoint(s) interactif(s) dans la présentation finale.`
            : '- Vérifier que la présentation reste cohérente sans checkpoint quiz forcé.',
        baseContext,
        qualityGate,
        `Brief utilisateur: ${brief}`,
        `JSON PASS 4:\n${previous.pass4 || ''}`,
        relanceBlock,
    ].join('\n\n');
}

async function _runGeminiFivePassFlow({ brief, tuning, pipeline, gemini }) {
    if (!gemini?.apiKey) {
        notify('Clé API Gemini manquante', 'error');
        return;
    }
    if (!String(brief || '').trim()) {
        notify('Ajoute un brief pour lancer le pipeline IA', 'warning');
        return;
    }

    const runner = _createAIPassRunnerOverlay(5);
    const passNames = {
        1: 'Plan pédagogique',
        2: 'Composants visuels',
        3: 'JSON complet',
        4: 'Composants et lisibilité',
        5: 'Validation finale',
    };
    const isCancelledError = (err) => (
        err?.code === _AI_PASS_CANCELLED_CODE
        || err?.code === (window.OEIImportPipeline?.IMPORT_CANCELLED_CODE || 'OEI_IMPORT_CANCELLED')
    );
    try {
        const promptTemplate = await _fetchAIPromptTemplate();
        const previous = {};
        let pass2SelectionMode = false;
        let pass2SelectedIllustrations = [];
        const runPass = async (pass, opts = {}) => {
            const prompt = _buildGeminiPassPrompt(pass, {
                brief,
                tuning,
                pipeline,
                previous,
                promptTemplate,
                refinePrompt: opts.refinePrompt || '',
                currentDraft: opts.currentDraft || '',
            });
            return _callGeminiGenerate({
                apiKey: gemini.apiKey,
                model: gemini.model,
                prompt,
                temperature: gemini.temperature,
                timeoutMs: gemini.requestTimeoutMs,
            });
        };
        const applyPass3MediaWithRecovery = async (jsonText) => {
            let draft = jsonText;
            while (true) {
                try {
                    const forceImageGeneration = AI_IMAGE_GENERATION_ENABLED && pipeline?.forceImageGeneration === true;
                    const forceAutoTargets = forceImageGeneration && pass2SelectionMode && !pass2SelectedIllustrations.length;
                    if (pass2SelectionMode && !pass2SelectedIllustrations.length && !forceImageGeneration) {
                        return draft;
                    }
                    const pass2Pool = pass2SelectionMode
                        ? pass2SelectedIllustrations
                        : _normalizePass2Illustrations(previous.pass2 || '').map((it) => ({ ...it.raw, slide: it.slide, slideIndex: it.slideIndex }));
                    const mediaRes = await _materializePass3ImagesOneByOne({
                        outputText: draft,
                        pass2Illustrations: pass2Pool,
                        brief,
                        tuning,
                        pipeline,
                        gemini,
                        runner,
                        pass: 3,
                        strictSelection: pass2SelectionMode && !forceAutoTargets,
                    });
                    if (Array.isArray(mediaRes.generatedItems) && mediaRes.generatedItems.length) {
                        const keep = await _reviewPass3GeneratedImagesChoice(mediaRes.generatedItems);
                        if (!keep.ok) throw _makeAIPassCancelledError('pass-3-keep-selection');
                        const kept = new Set(keep.keptIds || []);
                        mediaRes.generatedItems.forEach((item) => {
                            if (!kept.has(item.id)) {
                                item.slot.owner[item.slot.key] = item.beforeSrc;
                                if (item.slot.altOwner && item.slot.altKey) item.slot.altOwner[item.slot.altKey] = item.beforeAlt;
                            }
                        });
                        if (mediaRes.payload?.mediaReport && typeof mediaRes.payload.mediaReport === 'object') {
                            mediaRes.payload.mediaReport.kept = kept.size;
                        }
                    }
                    return mediaRes.payload
                        ? (_stringifyPrettyJson(mediaRes.payload) || mediaRes.text || draft)
                        : (mediaRes.text || draft);
                } catch (err) {
                    if (err?.code === _AI_PASS_CANCELLED_CODE) throw err;
                    const action = await runner.promptRetry(3, `Erreur passe 3 (placeholders visuels): ${err?.message || 'erreur inconnue'}`, { allowSkip: true });
                    if (action === 'retry') {
                        notify('Relance de la génération des placeholders…', 'info');
                        continue;
                    }
                    if (action === 'skip') {
                        notify('Génération des placeholders ignorée pour cette passe', 'warning');
                        return draft;
                    }
                    throw _makeAIPassCancelledError('pass-3-media-closed');
                }
            }
        };

        for (let pass = 1; pass <= 5; pass++) {
            const passTitle = passNames[pass] || `Passe ${pass}`;
            let done = false;
            while (!done) {
                try {
                    runner.setWaiting(pass, passTitle);
                    let output = await runPass(pass);
                    if (pass === 3) {
                        output = await applyPass3MediaWithRecovery(output);
                    }
                    runner.setDone(pass, _formatRunnerPreview(pass, output));
                    const review = await _reviewAIPassOutput({
                        pass,
                        title: passTitle,
                        content: output,
                        hint: pass >= 3 ? 'Le contenu doit rester du JSON valide.' : 'Tu peux ajuster le contenu avant de poursuivre.',
                        onRerun: async ({ refinePrompt, currentText }) => {
                            runner.setWaiting(pass, `${passTitle} (relance)`);
                            let next = await runPass(pass, { refinePrompt, currentDraft: currentText });
                            if (pass === 3) {
                                next = await applyPass3MediaWithRecovery(next);
                            }
                            runner.setDone(pass, _formatRunnerPreview(pass, next));
                            return next;
                        },
                    });
                    if (!review.ok) throw _makeAIPassCancelledError(`pass-${pass}`);
                    previous[`pass${pass}`] = review.text;
                    if (pass === 2) {
                        const items = _normalizePass2Illustrations(review.text);
                        if (items.length) {
                            const choice = await _reviewPass2IllustrationsChoice(items);
                            if (!choice.ok) throw _makeAIPassCancelledError('pass-2-selection');
                            const selected = new Set(choice.selectedIds || []);
                            pass2SelectionMode = true;
                            pass2SelectedIllustrations = items
                                .filter((it) => selected.has(it.id))
                                .map((it) => ({ ...it.raw, slide: it.slide, slideIndex: it.slideIndex }));
                            previous.pass2Selected = _stringifyPrettyJson({ illustrations: pass2SelectedIllustrations });
                            notify(`Illustrations sélectionnées pour placeholders: ${pass2SelectedIllustrations.length}/${items.length}`, 'info');
                        } else {
                            pass2SelectionMode = true;
                            pass2SelectedIllustrations = [];
                            previous.pass2Selected = _stringifyPrettyJson({ illustrations: [] });
                            notify('Aucune image prévue: aucun placeholder ajouté en passe 3.', 'info');
                        }
                    }
                    done = true;
                } catch (err) {
                    if (isCancelledError(err)) {
                        notify('Pipeline IA annulé', 'info');
                        return;
                    }
                    const message = `Erreur passe ${pass}: ${err?.message || 'erreur inconnue'}`;
                    console.error('[AI Gemini] pass failed', { pass, err });
                    const action = await runner.promptRetry(pass, message);
                    if (action === 'retry') {
                        notify(`Relance de la passe ${pass}…`, 'info');
                        continue;
                    }
                    notify(message, 'error');
                    return;
                }
            }
        }

        while (true) {
            try {
                runner.setWaiting(5, 'Préparation import');
                let finalJson = _extractPresentationFromPass(5, previous.pass5 || '');
                if (!finalJson) finalJson = _extractPresentationFromPass(4, previous.pass4 || '');
                if (!finalJson) finalJson = _extractPresentationFromPass(3, previous.pass3 || '');
                if (!finalJson) throw new Error('Impossible d’extraire un JSON PresentaForge depuis les passes 3/4/5.');

                runner.setWaiting(5, 'Import local');
                if (!window.OEIImportPipeline?.importFromText) throw new Error('Pipeline d’import local indisponible');
                const result = await window.OEIImportPipeline.importFromText(finalJson, {
                    pipelineSettings: {
                        ...pipeline,
                        // Les 5 passes Gemini sont déjà validées côté utilisateur.
                        // On évite de réouvrir une seconde série de modales de validation.
                        stepValidation: false,
                    },
                });
                const ok = await window.OEIImportPipeline.confirmImport(result, { sourceLabel: `Gemini ${gemini.model}` });
                if (!ok) throw _makeAIPassCancelledError('import-final');
                editor.load(result.data);
                notify(`Pipeline Gemini terminé (${gemini.model})`, 'success');
                break;
            } catch (err) {
                if (isCancelledError(err)) {
                    notify('Pipeline IA annulé', 'info');
                    return;
                }
                const message = `Erreur import final: ${err?.message || 'erreur inconnue'}`;
                console.error('[AI Gemini] import failed', err);
                const action = await runner.promptRetry(5, message);
                if (action === 'retry') {
                    notify('Relance de l’import final…', 'info');
                    continue;
                }
                notify(message, 'error');
                return;
            }
        }
    } finally {
        runner.close();
    }
}

    root.OEIEditorAIPasses = Object.freeze({
        _runGeminiFivePassFlow,
        _buildGeminiPassPrompt,
        _materializePass3ImagesOneByOne,
        _collectPass3ImageTargets,
        _findOrCreateImageSlot,
        _normalizePass2Illustrations,
        _buildIllustrationPlaceholderDataUrl,
        _computePlaceholderBox,
        testUtils: Object.freeze({
            extractPresentationFromPass: _extractPresentationFromPass,
            buildGeminiPassPrompt: _buildGeminiPassPrompt,
            normalizePass2Illustrations: _normalizePass2Illustrations,
            collectPass3ImageTargets: _collectPass3ImageTargets,
            computePlaceholderBox: _computePlaceholderBox,
        }),
    });
})(window);
