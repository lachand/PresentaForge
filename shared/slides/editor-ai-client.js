/**
 * @module slides/editor-ai-client
 * @internal Module Slides chargé côté navigateur.
 * @example
 * // Chargement navigateur (après editor-ai-pipeline.js):
 * // <script src="../shared/slides/editor-ai-client.js"></script>
 */
/* editor-ai-client.js — appels Gemini (texte + image) et extraction des réponses.
   Extrait de editor-ai-pipeline.js (chantier découpe pipeline IA éditeur). */
(function initEditorAIClientModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const S = root.OEIEditorAIPipelineShared || null;
    if (!S) {
        throw new Error('OEIEditorAIPipelineShared indisponible: impossible de démarrer le client IA éditeur.');
    }
    const _stripCodeFences = S.stripCodeFences;
    const _tryParseJsonLoose = S.tryParseJsonLoose;

function _extractGeminiText(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const parts = [];
    candidates.forEach((candidate) => {
        const cParts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        cParts.forEach((part) => {
            if (typeof part?.text === 'string') parts.push(part.text);
        });
    });
    return parts.join('\n').trim();
}

function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Lecture blob image impossible'));
            reader.readAsDataURL(blob);
        } catch (err) {
            reject(err);
        }
    });
}

function _extractGeminiPartImageData(part) {
    if (!part || typeof part !== 'object') return null;
    const inline = part.inlineData || part.inline_data || null;
    if (inline && typeof inline === 'object') {
        const mimeType = String(inline.mimeType || inline.mime_type || '').trim().toLowerCase();
        const data = String(inline.data || '').trim();
        if (data) {
            const mime = mimeType.startsWith('image/') ? mimeType : 'image/png';
            return { kind: 'inline', dataUrl: `data:${mime};base64,${data}` };
        }
    }
    const fileData = part.fileData || part.file_data || null;
    if (fileData && typeof fileData === 'object') {
        const fileUri = String(fileData.fileUri || fileData.file_uri || '').trim();
        const mimeType = String(fileData.mimeType || fileData.mime_type || '').trim().toLowerCase();
        if (fileUri) return { kind: 'file', fileUri, mimeType };
    }
    return null;
}

async function _extractGeminiInlineImage(payload, timeoutMs = 20000) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), Math.max(2000, Math.min(90000, Number(timeoutMs) || 20000))) : null;
    for (let ci = 0; ci < candidates.length; ci++) {
        const parts = Array.isArray(candidates[ci]?.content?.parts) ? candidates[ci].content.parts : [];
        for (let pi = 0; pi < parts.length; pi++) {
            const info = _extractGeminiPartImageData(parts[pi]);
            if (!info) continue;
            if (info.kind === 'inline' && info.dataUrl) {
                if (timer) clearTimeout(timer);
                return info.dataUrl;
            }
            if (info.kind === 'file') {
                const uri = String(info.fileUri || '').trim();
                if (!uri) continue;
                if (/^data:image\//i.test(uri)) {
                    if (timer) clearTimeout(timer);
                    return uri;
                }
                if (/^https?:\/\//i.test(uri)) {
                    try {
                        const res = await fetch(uri, { signal: controller?.signal });
                        if (!res.ok) continue;
                        const blob = await res.blob();
                        const blobType = String(blob?.type || info.mimeType || '').toLowerCase();
                        if (!blobType.startsWith('image/')) continue;
                        const dataUrl = await _blobToDataUrl(blob);
                        if (dataUrl) {
                            if (timer) clearTimeout(timer);
                            return dataUrl;
                        }
                    } catch (_) {
                        continue;
                    }
                }
            }
        }
    }
    if (timer) clearTimeout(timer);
    return '';
}

function _summarizeGeminiCandidateParts(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const kinds = [];
    candidates.forEach((candidate) => {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        parts.forEach((part) => {
            if (part?.text) kinds.push('text');
            if (part?.inlineData || part?.inline_data) kinds.push('inlineData');
            if (part?.fileData || part?.file_data) kinds.push('fileData');
        });
    });
    return [...new Set(kinds)].join(', ') || 'none';
}

async function _callGeminiGenerate({ apiKey, model, prompt, temperature, timeoutMs }) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller?.signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
                generationConfig: {
                    temperature,
                },
            }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = String(payload?.error?.message || `HTTP ${res.status}`).trim();
            throw new Error(msg || 'Erreur Gemini');
        }
        const text = _extractGeminiText(payload);
        if (!text) {
            const blockReason = String(payload?.promptFeedback?.blockReason || '').trim();
            throw new Error(blockReason ? `Réponse vide (blocage: ${blockReason})` : 'Réponse Gemini vide');
        }
        return _stripCodeFences(text);
    } catch (err) {
        if (err?.name === 'AbortError') {
            const timeoutLabel = Number.isFinite(Number(timeoutMs)) ? `${Math.trunc(Number(timeoutMs))} ms` : 'délai imparti';
            throw new Error(`Timeout Gemini (${timeoutLabel})`);
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function _callGeminiGenerateImage({ apiKey, model, prompt, temperature, timeoutMs }) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const normalizedModel = String(model || '').trim().toLowerCase();
        const isFlashImageModel = normalizedModel.includes('flash-image');
        const generationConfig = {
            temperature,
        };
        if (!isFlashImageModel) {
            generationConfig.responseModalities = ['IMAGE', 'TEXT'];
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller?.signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
                generationConfig,
            }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = String(payload?.error?.message || `HTTP ${res.status}`).trim();
            throw new Error(msg || 'Erreur Gemini image');
        }
        const dataUrl = await _extractGeminiInlineImage(payload, Math.max(8000, Math.min(60000, Number(timeoutMs) || 20000)));
        if (!dataUrl) {
            const textHint = _extractGeminiText(payload);
            const blockReason = String(payload?.promptFeedback?.blockReason || '').trim();
            const partsInfo = _summarizeGeminiCandidateParts(payload);
            throw new Error(blockReason
                ? `Image bloquée (${blockReason})`
                : (textHint
                    ? `Aucune image retournée (parts: ${partsInfo}) (${textHint.slice(0, 120)})`
                    : `Aucune image retournée (parts: ${partsInfo})`));
        }
        return {
            dataUrl,
            textHint: _extractGeminiText(payload),
        };
    } catch (err) {
        if (err?.name === 'AbortError') {
            const timeoutLabel = Number.isFinite(Number(timeoutMs)) ? `${Math.trunc(Number(timeoutMs))} ms` : 'délai imparti';
            throw new Error(`Timeout Gemini image (${timeoutLabel})`);
        }
        throw err;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function _supportsNativeGeminiImageModel(model) {
    const normalized = String(model || '').trim().toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('flash-image')
        || normalized.includes('image-generation')
        || normalized.includes('image-preview')
    );
}

function _toBase64Utf8(text) {
    try {
        const enc = new TextEncoder();
        const bytes = enc.encode(String(text || ''));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    } catch (_) {
        try {
            return btoa(unescape(encodeURIComponent(String(text || ''))));
        } catch (_err) {
            return '';
        }
    }
}

function _svgToDataUrl(svg) {
    const b64 = _toBase64Utf8(svg);
    return b64 ? `data:image/svg+xml;base64,${b64}` : '';
}

function _extractImageResultFromGemini(rawText) {
    const parsed = _tryParseJsonLoose(rawText);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object') {
        const v = parsed.value;
        if (typeof v.dataUrl === 'string' && /^data:image\//i.test(v.dataUrl)) return { dataUrl: v.dataUrl, alt: String(v.alt || '').trim() };
        if (typeof v.src === 'string' && (/^https?:\/\//i.test(v.src) || /^data:image\//i.test(v.src))) {
            return { dataUrl: v.src, alt: String(v.alt || '').trim() };
        }
        if (typeof v.url === 'string' && (/^https?:\/\//i.test(v.url) || /^data:image\//i.test(v.url))) {
            return { dataUrl: v.url, alt: String(v.alt || '').trim() };
        }
        if (typeof v.svg === 'string' && v.svg.includes('<svg')) {
            const dataUrl = _svgToDataUrl(v.svg);
            if (dataUrl) return { dataUrl, alt: String(v.alt || '').trim() };
        }
    }
    const raw = String(rawText || '');
    const svgStart = raw.indexOf('<svg');
    const svgEnd = raw.lastIndexOf('</svg>');
    if (svgStart >= 0 && svgEnd > svgStart) {
        const svg = raw.slice(svgStart, svgEnd + 6);
        const dataUrl = _svgToDataUrl(svg);
        if (dataUrl) return { dataUrl, alt: '' };
    }
    return null;
}

function _buildGeminiSingleImagePrompt({ brief, entry, slideIndex, tuning }) {
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords.filter(Boolean).slice(0, 10).join(', ') : '';
    return [
        'Génère UNE illustration pédagogique (SVG URL ou dataUrl).',
        'Retourne uniquement un JSON valide sans markdown.',
        'Schéma strict:',
        '{"src":"https://...svg","dataUrl":"data:image/svg+xml;base64,...","alt":"..."}',
        'Contraintes:',
        '- Priorité: si le concept est simple (HDD, SSD, clé USB, document, dossier, réseau, base de données), utiliser un SVG externe pertinent (ex: The Noun Project) via `src` HTTPS.',
        '- Sinon, renvoyer un `dataUrl` SVG propre et lisible.',
        '- Pas de texte long dans le dessin (max 3 mots).',
        '- Pas de contenu sensible ou marque déposée.',
        '- Ne pas renvoyer de placeholder décoratif générique.',
        `- Style demandé: ${tuning.imageStyle}`,
        `Contexte slide: index ${slideIndex + 1}`,
        `Intent: ${String(entry?.intent || '').trim() || 'Illustration pédagogique'}`,
        `Type visuel: ${String(entry?.visualType || '').trim() || 'icon'}`,
        `Mots-clés: ${keywords || 'aucun'}`,
        `Brief global: ${brief}`,
    ].join('\n');
}

function _buildGeminiSingleRasterImagePrompt({ brief, entry, slideIndex, tuning }) {
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords.filter(Boolean).slice(0, 12).join(', ') : '';
    const visualType = String(entry?.visualType || '').trim() || 'illustration';
    const style = String(tuning?.imageStyle || 'mixte').trim().toLowerCase();
    const styleHints = style === 'photo'
        ? 'Style photo réaliste, lumière naturelle, composition claire.'
        : (style === 'infographie'
            ? 'Style infographie pédagogique moderne, hiérarchie visuelle nette, pictogrammes lisibles, 16:9.'
            : (style === 'icones'
                ? 'Style illustration vectorielle propre, formes lisibles, couleurs contrastées.'
                : 'Style éditorial pédagogique moderne, riche visuellement, pas uniquement des icônes.'));
    return [
        'Tu dois générer UNE image pédagogique (pas du SVG texte).',
        'Priorité: image finale exploitable dans une slide 16:9.',
        'Contraintes strictes:',
        '- Générer une image raster (PNG/JPEG) avec bon niveau de détail.',
        '- Pas de watermark, pas de logo de marque, pas de texte long.',
        '- Si du texte apparaît dans l’image, il doit être très court (max 6 mots).',
        '- L’image doit illustrer explicitement l’intention pédagogique.',
        styleHints,
        `Contexte slide: ${slideIndex + 1}`,
        `Intent pédagogique: ${String(entry?.intent || '').trim() || 'Illustration pédagogique'}`,
        `Type visuel attendu: ${visualType}`,
        `Mots-clés: ${keywords || 'aucun'}`,
        `Brief global du cours: ${brief}`,
    ].join('\n');
}

function _describeGeminiImageError(err, timeoutMs) {
    const msg = String(err?.message || err || '').trim();
    if (!msg) return 'Erreur inconnue.';
    const lowered = msg.toLowerCase();
    if (lowered.includes('timeout') || lowered.includes('abort')) {
        return `Timeout de génération (${Math.trunc(Number(timeoutMs) || 0)} ms).`;
    }
    if (lowered.includes('429') || lowered.includes('quota') || lowered.includes('rate')) {
        return `Quota/rate limit Gemini: ${msg}`;
    }
    if (lowered.includes('401') || lowered.includes('403') || lowered.includes('api key') || lowered.includes('forbidden') || lowered.includes('unauthorized')) {
        return `Clé API ou permissions Gemini invalides: ${msg}`;
    }
    if (lowered.includes('modality') || lowered.includes('responsemodalities') || lowered.includes('not support') || lowered.includes('unsupported')) {
        return `Modèle non compatible génération d'image: ${msg}`;
    }
    if (lowered.includes('block') || lowered.includes('safety')) {
        return `Contenu bloqué par les règles de sécurité Gemini: ${msg}`;
    }
    if (lowered.includes('response') && lowered.includes('vide')) {
        return `Gemini a renvoyé une réponse vide: ${msg}`;
    }
    return msg;
}

    root.OEIEditorAIClient = Object.freeze({
        _extractGeminiText,
        _blobToDataUrl,
        _extractGeminiPartImageData,
        _extractGeminiInlineImage,
        _summarizeGeminiCandidateParts,
        _callGeminiGenerate,
        _callGeminiGenerateImage,
        _supportsNativeGeminiImageModel,
        _toBase64Utf8,
        _svgToDataUrl,
        _extractImageResultFromGemini,
        _buildGeminiSingleImagePrompt,
        _buildGeminiSingleRasterImagePrompt,
        _describeGeminiImageError,
        testUtils: Object.freeze({
            extractGeminiText: _extractGeminiText,
            summarizeGeminiCandidateParts: _summarizeGeminiCandidateParts,
            supportsNativeGeminiImageModel: _supportsNativeGeminiImageModel,
            svgToDataUrl: _svgToDataUrl,
            extractImageResultFromGemini: _extractImageResultFromGemini,
            describeGeminiImageError: _describeGeminiImageError,
        }),
    });
})(window);
