/**
 * @module slides/editor-ai-review-ui
 * @internal Module Slides chargé côté navigateur.
 * @example
 * // Chargement navigateur (après editor-ai-passes.js):
 * // <script src="../shared/slides/editor-ai-review-ui.js"></script>
 */
/* editor-ai-review-ui.js — overlays de progression, modales de revue des passes et
   modale de réglages IA. Extrait de editor-ai-pipeline.js (chantier découpe pipeline IA éditeur). */
(function initEditorAIReviewUiModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const S = root.OEIEditorAIPipelineShared || null;
    if (!S) {
        throw new Error('OEIEditorAIPipelineShared indisponible: impossible de démarrer l\'UI de revue IA éditeur.');
    }
    const _editorAiSettings = root.OEIEditorAISettings || null;
    if (!_editorAiSettings) {
        throw new Error('OEIEditorAISettings indisponible: impossible de démarrer l\'UI de revue IA éditeur.');
    }
    const _passes = root.OEIEditorAIPasses || null;
    if (!_passes) {
        throw new Error('OEIEditorAIPasses indisponible: impossible de démarrer l\'UI de revue IA éditeur.');
    }
    const _quiz = root.OEIEditorAIQuiz || null;
    if (!_quiz) {
        throw new Error('OEIEditorAIQuiz indisponible: impossible de démarrer l\'UI de revue IA éditeur.');
    }

    const AI_IMAGE_GENERATION_ENABLED = _editorAiSettings.AI_IMAGE_GENERATION_ENABLED;
    const AI_PROMPT_DEFAULTS = _editorAiSettings.AI_PROMPT_DEFAULTS;
    const AI_IMPORT_PIPELINE_DEFAULTS = _editorAiSettings.AI_IMPORT_PIPELINE_DEFAULTS;
    const AI_GEMINI_MODELS = _editorAiSettings.AI_GEMINI_MODELS;
    const AI_GEMINI_IMAGE_MODELS = _editorAiSettings.AI_GEMINI_IMAGE_MODELS;
    const AI_GEMINI_DEFAULTS = _editorAiSettings.AI_GEMINI_DEFAULTS;
    const _sanitizeAIPromptTuningSettings = _editorAiSettings.sanitizeAIPromptTuningSettings;
    const _sanitizeAIImportPipelineSettings = _editorAiSettings.sanitizeAIImportPipelineSettings;
    const _sanitizeAIGeminiSettings = _editorAiSettings.sanitizeAIGeminiSettings;
    const getAIPromptTuningSettings = _editorAiSettings.getAIPromptTuningSettings;
    const setAIPromptTuningSettings = _editorAiSettings.setAIPromptTuningSettings;
    const getAIImportPipelineSettings = _editorAiSettings.getAIImportPipelineSettings;
    const setAIImportPipelineSettings = _editorAiSettings.setAIImportPipelineSettings;
    const getAIGeminiSettings = _editorAiSettings.getAIGeminiSettings;
    const setAIGeminiSettings = _editorAiSettings.setAIGeminiSettings;

    const notify = S.notify;
    const esc = S.esc;
    const _escapeHtmlAi = S.escapeHtmlAi;
    const _stripCodeFences = S.stripCodeFences;
    const _tryParseJsonLoose = S.tryParseJsonLoose;
    const _sanitizePreviewImageSrc = S.sanitizePreviewImageSrc;
    const _formatPassPreview = S.formatPassPreview;

    const _runGeminiFivePassFlow = _passes._runGeminiFivePassFlow;
    const _runGeminiQuizAugmentFlow = _quiz._runGeminiQuizAugmentFlow;

function _collectImageCandidatesFromPresentation(presentation, max = 8) {
    const out = [];
    const push = (src, label = '') => {
        const safeSrc = _sanitizePreviewImageSrc(src);
        if (!safeSrc) return;
        if (out.some((item) => item.src === safeSrc)) return;
        out.push({ src: safeSrc, label: String(label || '').slice(0, 80) });
    };
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    slides.forEach((slide, slideIdx) => {
        if (!slide || typeof slide !== 'object') return;
        if (typeof slide.src === 'string') push(slide.src, `Slide ${slideIdx + 1}`);
        if (slide?.data?.media?.type === 'image' && typeof slide?.data?.media?.src === 'string') {
            push(slide.data.media.src, `Slide ${slideIdx + 1}`);
        }
        if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
            slide.elements.forEach((el) => {
                if (!el || typeof el !== 'object') return;
                if (el.type === 'image' && typeof el?.data?.src === 'string') {
                    push(el.data.src, `Slide ${slideIdx + 1}`);
                }
            });
        }
    });
    return out.slice(0, Math.max(0, max | 0));
}

function _countSlideTypes(presentation) {
    const counts = {};
    const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
    slides.forEach((slide) => {
        const type = String(slide?.type || 'unknown');
        counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
}

function _renderPassSummaryHtml(pass, parsed, rawText) {
    if (!parsed?.ok) {
        return `
            <div class="ai-pass-review-parse-warning">
                JSON non parseable pour cette passe. Corrige le JSON ci-dessous ou relance avec une consigne.
            </div>
        `;
    }
    const payload = parsed.value;
    if (!payload || typeof payload !== 'object') {
        return `<div class="ai-pass-review-parse-warning">Le contenu n'est pas un objet JSON exploitable.</div>`;
    }

    if (pass === 1) {
        const title = String(payload?.title || payload?.course?.title || '').trim();
        const objectives = Array.isArray(payload?.learningObjectives) ? payload.learningObjectives : [];
        const plan = Array.isArray(payload?.plan) ? payload.plan : (Array.isArray(payload?.slidePlan) ? payload.slidePlan : []);
        const rows = plan.slice(0, 20).map((item, idx) => {
            const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : (idx + 1);
            const type = String(item?.type || '').trim();
            const label = String(item?.title || item?.goal || '').trim();
            const level = Number.isFinite(Number(item?.level)) ? Number(item.level) : '';
            return `<tr><td>${order}</td><td>${_escapeHtmlAi(type || '—')}</td><td>${_escapeHtmlAi(label || '—')}</td><td>${level || '—'}</td></tr>`;
        }).join('');
        return `
            <div class="ai-pass-review-grid">
                <div class="ai-pass-review-card"><strong>Titre</strong><div>${_escapeHtmlAi(title || 'Non défini')}</div></div>
                <div class="ai-pass-review-card"><strong>Slides planifiées</strong><div>${plan.length}</div></div>
                <div class="ai-pass-review-card"><strong>Objectifs</strong><div>${objectives.length}</div></div>
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Plan des slides</div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>#</th><th>Type</th><th>Titre / objectif</th><th>Niveau</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="4">Aucun item de plan</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    if (pass === 2) {
        const illustrations = Array.isArray(payload?.illustrations)
            ? payload.illustrations
            : (Array.isArray(payload?.illustrationPlan) ? payload.illustrationPlan : []);
        const componentPlan = Array.isArray(payload?.componentPlan) ? payload.componentPlan : [];
        const rows = illustrations.length
            ? illustrations.slice(0, 25).map((item, idx) => {
                const slide = Number.isFinite(Number(item?.slide)) ? Number(item.slide) : (Number.isFinite(Number(item?.slideIndex)) ? Number(item.slideIndex) + 1 : (idx + 1));
                const visualType = String(item?.visualType || '').trim();
                const intent = String(item?.intent || '').trim();
                const placement = String(item?.placement || '').trim();
                const assetHint = String(item?.assetHint || item?.src || '').trim();
                const safeSrc = _sanitizePreviewImageSrc(assetHint);
                const preview = safeSrc
                    ? `<img src="${_escapeHtmlAi(safeSrc)}" alt="Illustration ${slide}" loading="lazy">`
                    : `<span class="ai-pass-asset-hint">${_escapeHtmlAi(assetHint || 'asset://...')}</span>`;
                return `
                    <tr>
                        <td>${slide}</td>
                        <td>${_escapeHtmlAi(visualType || '—')}</td>
                        <td>${_escapeHtmlAi(intent || '—')}</td>
                        <td>${_escapeHtmlAi(placement || '—')}</td>
                        <td>${preview}</td>
                    </tr>
                `;
            }).join('')
            : componentPlan.slice(0, 25).map((item, idx) => {
                const slide = Number.isFinite(Number(item?.slide)) ? Number(item.slide) : (idx + 1);
                const componentType = String(item?.componentType || '').trim();
                const intent = String(item?.intent || '').trim();
                const placement = String(item?.placement || '').trim();
                const hint = String(item?.payloadHint || '').trim();
                return `
                    <tr>
                        <td>${slide}</td>
                        <td>${_escapeHtmlAi(componentType || '—')}</td>
                        <td>${_escapeHtmlAi(intent || '—')}</td>
                        <td>${_escapeHtmlAi(placement || '—')}</td>
                        <td><span class="ai-pass-asset-hint">${_escapeHtmlAi(hint || '—')}</span></td>
                    </tr>
                `;
            }).join('');
        return `
            <div class="ai-pass-review-grid">
                <div class="ai-pass-review-card"><strong>Illustrations prévues</strong><div>${illustrations.length}</div></div>
                <div class="ai-pass-review-card"><strong>Composants visuels</strong><div>${componentPlan.length}</div></div>
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">${illustrations.length ? 'Plan d’illustrations' : 'Plan de composants visuels'}</div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>Slide</th><th>Type</th><th>Intent</th><th>Placement</th><th>${illustrations.length ? 'Aperçu' : 'Payload hint'}</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="5">Aucun plan visuel</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const presentation = (payload?.presentation && typeof payload.presentation === 'object')
        ? payload.presentation
        : ((payload?.metadata && Array.isArray(payload?.slides)) ? payload : null);
    const slidesCount = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    const types = _countSlideTypes(presentation);
    const typeEntries = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const mediaReport = (payload?.mediaReport && typeof payload.mediaReport === 'object') ? payload.mediaReport : null;
    const validation = (payload?.validation && typeof payload.validation === 'object') ? payload.validation : null;
    const images = _collectImageCandidatesFromPresentation(presentation, 8);
    const typesHtml = typeEntries.map(([type, count]) => `<li><span>${_escapeHtmlAi(type)}</span><strong>${count}</strong></li>`).join('');
    const imagesHtml = images.map((item) => `<figure><img src="${_escapeHtmlAi(item.src)}" alt="${_escapeHtmlAi(item.label || 'Visuel')}"><figcaption>${_escapeHtmlAi(item.label || '')}</figcaption></figure>`).join('');
    const issues = Array.isArray(validation?.issues) ? validation.issues : [];
    const isValid = validation?.isValid === true;
    return `
        <div class="ai-pass-review-grid">
            <div class="ai-pass-review-card"><strong>Slides</strong><div>${slidesCount}</div></div>
            <div class="ai-pass-review-card"><strong>Types détectés</strong><div>${typeEntries.length}</div></div>
            ${mediaReport ? `<div class="ai-pass-review-card"><strong>Médias</strong><div>${pass === 3 ? (mediaReport.mode === 'placeholder-only' ? `placeholders: ${Number(mediaReport.placeholderCount || 0)}${Number(mediaReport.kept || 0) ? ` • gardés: ${Number(mediaReport.kept || 0)}` : ''}` : `prévues: ${Number(mediaReport.planned || 0)} • générées: ${Number(mediaReport.generated || 0)} • échecs: ${Number(mediaReport.failed || 0)}${Number(mediaReport.kept || 0) ? ` • gardées: ${Number(mediaReport.kept || 0)}` : ''}`) : `base64: ${Number(mediaReport.base64Count || 0)} • externes: ${Number(mediaReport.remoteUrlCount || 0)}`}</div></div>` : ''}
            ${validation ? `<div class="ai-pass-review-card"><strong>Validation</strong><div>${isValid ? 'OK' : 'À corriger'}${issues.length ? ` • ${issues.length} issue(s)` : ''}</div></div>` : ''}
        </div>
        <div class="ai-pass-review-columns">
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Répartition des types</div>
                <ul class="ai-pass-review-kv">${typesHtml || '<li><span>Aucune donnée</span><strong>0</strong></li>'}</ul>
                ${issues.length ? `<div class="ai-pass-review-issues"><strong>Issues:</strong><ul>${issues.map((it) => `<li>${_escapeHtmlAi(String(it || ''))}</li>`).join('')}</ul></div>` : ''}
            </div>
            <div class="ai-pass-review-block">
                <div class="ai-pass-review-block-title">Aperçu visuels</div>
                <div class="ai-pass-review-images">${imagesHtml || '<div class="ai-pass-review-empty">Aucun visuel détecté.</div>'}</div>
            </div>
        </div>
    `;
}

function _reviewPass2IllustrationsChoice(items) {
    if (!Array.isArray(items) || !items.length) return Promise.resolve({ ok: true, selectedIds: [] });
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        const rows = items.map((item) => {
            const previewSrc = _sanitizePreviewImageSrc(item.assetHint);
            const preview = previewSrc
                ? `<img src="${_escapeHtmlAi(previewSrc)}" alt="${_escapeHtmlAi(item.intent || item.slideTitle || 'Illustration')}" loading="lazy">`
                : `<span class="ai-pass-asset-hint">${_escapeHtmlAi(item.assetHint || 'asset://...')}</span>`;
            return `
                <tr data-ill-row="${_escapeHtmlAi(item.id)}">
                    <td><input type="checkbox" data-ill-check="${_escapeHtmlAi(item.id)}" checked></td>
                    <td>${item.slide}</td>
                    <td>${_escapeHtmlAi(item.visualType || '—')}</td>
                    <td>${_escapeHtmlAi(item.intent || item.slideTitle || '—')}</td>
                    <td>${preview}</td>
                </tr>
            `;
        }).join('');
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Sélection illustrations passe 2">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Étape intermédiaire — placeholders visuels</h3>
                    <div class="ai-pass-review-hint">Choisis les illustrations à transformer en placeholders en passe 3.</div>
                </div>
                <div class="ai-pass-review-actions ai-pass-review-actions-inline">
                    <button type="button" class="tb-btn ui-btn" data-ill-all>Aucune</button>
                    <button type="button" class="tb-btn ui-btn" data-ill-none>Toutes</button>
                </div>
                <div class="ai-pass-review-table-wrap">
                    <table class="ai-pass-review-table">
                        <thead><tr><th>OK</th><th>Slide</th><th>Type</th><th>Intent</th><th>Aperçu</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-ill-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ill-validate>Continuer</button>
                </div>
            </div>
        `;
        const getSelectedIds = () => items
            .filter((it) => overlay.querySelector(`[data-ill-check="${it.id}"]`)?.checked)
            .map((it) => it.id);
        const close = (ok) => {
            const selectedIds = getSelectedIds();
            overlay.remove();
            resolve({ ok, selectedIds });
        };
        overlay.querySelector('[data-ill-all]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-ill-check="${it.id}"]`);
                if (input) input.checked = false;
            });
        });
        overlay.querySelector('[data-ill-none]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-ill-check="${it.id}"]`);
                if (input) input.checked = true;
            });
        });
        overlay.querySelector('[data-ill-cancel]')?.addEventListener('click', () => close(false));
        overlay.querySelector('[data-ill-validate]')?.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false);
        });
        document.body.appendChild(overlay);
    });
}

function _reviewPass3GeneratedImagesChoice(items) {
    if (!Array.isArray(items) || !items.length) return Promise.resolve({ ok: true, keptIds: [] });
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        const cards = items.map((item) => `
            <label class="ai-pass-image-card">
                <input type="checkbox" data-gen-check="${_escapeHtmlAi(item.id)}" checked>
                <img src="${_escapeHtmlAi(item.afterSrc || '')}" alt="${_escapeHtmlAi(item.label || 'Illustration')}" loading="lazy">
                <div class="ai-pass-image-card-meta">
                    <strong>Slide ${item.slide + 1}</strong>
                    <span>${_escapeHtmlAi(item.label || 'Illustration')}</span>
                </div>
            </label>
        `).join('');
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Sélection finale visuels passe 3">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Étape finale passe 3 — visuels à conserver</h3>
                    <div class="ai-pass-review-hint">Décoche les visuels à retirer avant de continuer.</div>
                </div>
                <div class="ai-pass-review-actions ai-pass-review-actions-inline">
                    <button type="button" class="tb-btn ui-btn" data-gen-none>Aucune</button>
                    <button type="button" class="tb-btn ui-btn" data-gen-all>Toutes</button>
                </div>
                <div class="ai-pass-image-grid">${cards}</div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-gen-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-gen-validate>Valider les visuels</button>
                </div>
            </div>
        `;
        const getKeptIds = () => items
            .filter((it) => overlay.querySelector(`[data-gen-check="${it.id}"]`)?.checked)
            .map((it) => it.id);
        const close = (ok) => {
            const keptIds = getKeptIds();
            overlay.remove();
            resolve({ ok, keptIds });
        };
        overlay.querySelector('[data-gen-none]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-gen-check="${it.id}"]`);
                if (input) input.checked = false;
            });
        });
        overlay.querySelector('[data-gen-all]')?.addEventListener('click', () => {
            items.forEach((it) => {
                const input = overlay.querySelector(`[data-gen-check="${it.id}"]`);
                if (input) input.checked = true;
            });
        });
        overlay.querySelector('[data-gen-cancel]')?.addEventListener('click', () => close(false));
        overlay.querySelector('[data-gen-validate]')?.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false);
        });
        document.body.appendChild(overlay);
    });
}

function _createAIPassRunnerOverlay(total = 5) {
    const overlay = document.createElement('div');
    overlay.className = 'ai-pass-overlay';
    overlay.innerHTML = `
        <div class="ai-pass-modal" role="dialog" aria-modal="true" aria-label="Pipeline Gemini">
            <div class="ai-pass-head">
                <h3 class="ai-pass-title">Pipeline Gemini (5 passes)</h3>
                <div class="ai-pass-subtitle" data-ai-pass-status>Initialisation…</div>
            </div>
            <div class="ai-pass-steps" data-ai-pass-steps>
                ${Array.from({ length: total }).map((_, i) => `
                    <div class="ai-pass-step" data-pass-step="${i + 1}">
                        <span class="ai-pass-step-dot">${i + 1}</span>
                        <span class="ai-pass-step-label">Passe ${i + 1}</span>
                    </div>
                `).join('')}
            </div>
            <div class="ai-pass-skeleton" data-ai-pass-skeleton>
                <div class="ai-pass-skel-line w-80"></div>
                <div class="ai-pass-skel-line w-100"></div>
                <div class="ai-pass-skel-line w-60"></div>
            </div>
            <div class="ai-pass-media-strip" data-ai-pass-media-strip></div>
            <div class="ai-pass-preview" data-ai-pass-preview></div>
            <div class="ai-pass-actions" data-ai-pass-actions>
                <button type="button" class="tb-btn ui-btn" data-ai-pass-close>Fermer</button>
                <button type="button" class="tb-btn ui-btn" data-ai-pass-skip>Passer cette étape</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-pass-retry>Relancer cette étape</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const statusEl = overlay.querySelector('[data-ai-pass-status]');
    const previewEl = overlay.querySelector('[data-ai-pass-preview]');
    const skeletonEl = overlay.querySelector('[data-ai-pass-skeleton]');
    const mediaStripEl = overlay.querySelector('[data-ai-pass-media-strip]');
    const actionsEl = overlay.querySelector('[data-ai-pass-actions]');
    const retryBtn = overlay.querySelector('[data-ai-pass-retry]');
    const closeBtn = overlay.querySelector('[data-ai-pass-close]');
    const skipBtn = overlay.querySelector('[data-ai-pass-skip]');
    let decisionResolver = null;
    let previewLog = [];
    const setStepState = (idx, state) => {
        const el = overlay.querySelector(`[data-pass-step="${idx}"]`);
        if (!el) return;
        el.classList.remove('is-active', 'is-done', 'is-error');
        if (state) el.classList.add(state);
    };
    const appendPreviewLine = (line) => {
        if (!previewEl) return;
        const text = String(line || '').trim();
        if (!text) return;
        previewLog.push(text);
        if (previewLog.length > 10) previewLog = previewLog.slice(-10);
        previewEl.textContent = previewLog.join('\n');
    };
    const clearMediaStrip = () => {
        if (!mediaStripEl) return;
        mediaStripEl.innerHTML = '';
        mediaStripEl.classList.remove('is-visible');
    };
    const appendMediaThumb = (src, label = '') => {
        if (!mediaStripEl) return;
        const safeSrc = _sanitizePreviewImageSrc(src);
        if (!safeSrc) return;
        const card = document.createElement('div');
        card.className = 'ai-pass-media-item';
        const img = document.createElement('img');
        img.className = 'ai-pass-media-thumb';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = safeSrc;
        img.alt = String(label || 'Illustration générée');
        card.appendChild(img);
        if (label) {
            const cap = document.createElement('div');
            cap.className = 'ai-pass-media-caption';
            cap.textContent = String(label);
            card.appendChild(cap);
        }
        mediaStripEl.appendChild(card);
        mediaStripEl.classList.add('is-visible');
        mediaStripEl.scrollLeft = mediaStripEl.scrollWidth;
    };
    const hideActions = () => {
        if (actionsEl) actionsEl.classList.remove('is-visible');
    };
    const resolveDecision = (decision) => {
        if (!decisionResolver) return;
        const resolver = decisionResolver;
        decisionResolver = null;
        hideActions();
        resolver(decision);
    };
    retryBtn?.addEventListener('click', () => resolveDecision('retry'));
    closeBtn?.addEventListener('click', () => resolveDecision('close'));
    skipBtn?.addEventListener('click', () => resolveDecision('skip'));
    return {
        setWaiting(idx, label) {
            for (let i = 1; i <= total; i++) {
                if (i < idx) setStepState(i, 'is-done');
                else if (i === idx) setStepState(i, 'is-active');
                else setStepState(i, '');
            }
            if (statusEl) statusEl.textContent = `${label} — génération en cours…`;
            previewLog = [];
            if (previewEl) previewEl.textContent = '';
            clearMediaStrip();
            if (skeletonEl) skeletonEl.classList.add('is-visible');
            hideActions();
        },
        setProgress(idx, label, detail = '') {
            if (idx > 0) setStepState(idx, 'is-active');
            if (statusEl) statusEl.textContent = `${label} — génération en cours…`;
            if (skeletonEl) skeletonEl.classList.add('is-visible');
            appendPreviewLine(detail);
            hideActions();
        },
        setDone(idx, previewText) {
            setStepState(idx, 'is-done');
            if (statusEl) statusEl.textContent = `Passe ${idx} terminée`;
            previewLog = [];
            if (previewEl) previewEl.textContent = _formatPassPreview(previewText, 240);
            if (skeletonEl) skeletonEl.classList.remove('is-visible');
            hideActions();
        },
        setError(idx, message) {
            if (idx > 0) setStepState(idx, 'is-error');
            if (statusEl) statusEl.textContent = 'Erreur pipeline IA';
            previewLog = [];
            if (previewEl) previewEl.textContent = String(message || 'Erreur inconnue');
            if (skeletonEl) skeletonEl.classList.remove('is-visible');
        },
        pushImage(idx, src, label = '') {
            if (idx > 0) setStepState(idx, 'is-active');
            appendMediaThumb(src, label);
        },
        promptRetry(idx, message, options = null) {
            const allowSkip = options && options.allowSkip === true;
            this.setError(idx, message);
            if (skipBtn) skipBtn.style.display = allowSkip ? '' : 'none';
            if (actionsEl) actionsEl.classList.add('is-visible');
            return new Promise((resolve) => {
                decisionResolver = resolve;
            });
        },
        close() {
            if (decisionResolver) {
                const resolver = decisionResolver;
                decisionResolver = null;
                resolver('close');
            }
            overlay.remove();
        },
    };
}

function _reviewAIPassOutput({ pass, title, content, hint, onRerun }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'ai-pass-review-overlay';
        overlay.innerHTML = `
            <div class="ai-pass-review-modal" role="dialog" aria-modal="true" aria-label="Validation passe IA">
                <div class="ai-pass-review-head">
                    <h3 class="ai-pass-review-title">Validation — Passe ${pass}: ${_escapeHtmlAi(title)}</h3>
                    <div class="ai-pass-review-hint">${_escapeHtmlAi(hint || 'Vérifie le contenu puis valide pour passer à l’étape suivante.')}</div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-title">Lecture guidée</div>
                    <div class="ai-pass-review-summary" data-ai-pass-summary></div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-head">
                        <div class="ai-pass-review-block-title">JSON de la passe (modifiable)</div>
                        <button type="button" class="tb-btn ui-btn ai-pass-json-toggle" data-ai-pass-toggle-json>Afficher JSON</button>
                    </div>
                    <div class="ai-pass-review-json-wrap is-collapsed" data-ai-pass-json-wrap>
                        <textarea class="ai-pass-review-text" spellcheck="false" data-ai-pass-raw>${_escapeHtmlAi(_stripCodeFences(content || ''))}</textarea>
                    </div>
                </div>
                <div class="ai-pass-review-block">
                    <div class="ai-pass-review-block-title">Relance ciblée (optionnel)</div>
                    <textarea class="ai-pass-review-rerun" spellcheck="false" data-ai-pass-rerun-text placeholder="Ex: Réduis le texte des cartes, ajoute plus d'icônes SVG sur les slides 3 et 5, corrige les niveaux DigComp..."></textarea>
                    <div class="ai-pass-review-rerun-status" data-ai-pass-rerun-status></div>
                    <div class="ai-pass-skeleton ai-pass-review-skeleton" data-ai-pass-rerun-skeleton>
                        <div class="ai-pass-skel-line w-80"></div>
                        <div class="ai-pass-skel-line w-100"></div>
                        <div class="ai-pass-skel-line w-60"></div>
                    </div>
                </div>
                <div class="ai-pass-review-actions">
                    <button type="button" class="tb-btn ui-btn" data-ai-pass-cancel>Annuler pipeline</button>
                    <button type="button" class="tb-btn ui-btn" data-ai-pass-rerun-btn>Relancer cette passe</button>
                    <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-pass-validate>Valider la passe</button>
                </div>
            </div>
        `;
        const rawEl = overlay.querySelector('[data-ai-pass-raw]');
        const jsonWrapEl = overlay.querySelector('[data-ai-pass-json-wrap]');
        const toggleJsonBtn = overlay.querySelector('[data-ai-pass-toggle-json]');
        const summaryEl = overlay.querySelector('[data-ai-pass-summary]');
        const rerunEl = overlay.querySelector('[data-ai-pass-rerun-text]');
        const rerunStatusEl = overlay.querySelector('[data-ai-pass-rerun-status]');
        const rerunSkeletonEl = overlay.querySelector('[data-ai-pass-rerun-skeleton]');
        const rerunBtn = overlay.querySelector('[data-ai-pass-rerun-btn]');
        const validateBtn = overlay.querySelector('[data-ai-pass-validate]');
        const cancelBtn = overlay.querySelector('[data-ai-pass-cancel]');

        const setBusy = (busy) => {
            [rerunBtn, validateBtn, cancelBtn].forEach((btn) => {
                if (btn) btn.disabled = !!busy;
            });
            if (rerunSkeletonEl) rerunSkeletonEl.classList.toggle('is-visible', !!busy);
        };
        const setJsonCollapsed = (collapsed) => {
            if (jsonWrapEl) jsonWrapEl.classList.toggle('is-collapsed', !!collapsed);
            if (toggleJsonBtn) toggleJsonBtn.textContent = collapsed ? 'Afficher JSON' : 'Masquer JSON';
        };
        const refreshSummary = () => {
            if (!summaryEl || !rawEl) return;
            const parsed = _tryParseJsonLoose(rawEl.value);
            summaryEl.innerHTML = _renderPassSummaryHtml(pass, parsed, rawEl.value);
        };

        const close = (ok, text = '') => {
            overlay.remove();
            const parsed = _tryParseJsonLoose(text);
            resolve({ ok, text, parsed });
        };
        overlay.querySelector('[data-ai-pass-cancel]')?.addEventListener('click', () => close(false, ''));
        overlay.querySelector('[data-ai-pass-validate]')?.addEventListener('click', () => {
            const text = rawEl?.value || '';
            close(true, _stripCodeFences(text));
        });
        overlay.querySelector('[data-ai-pass-rerun-btn]')?.addEventListener('click', async () => {
            if (typeof onRerun !== 'function') return;
            const refinePrompt = String(rerunEl?.value || '').trim();
            if (!refinePrompt) {
                if (rerunStatusEl) rerunStatusEl.textContent = 'Ajoute une consigne pour relancer cette passe.';
                rerunEl?.focus();
                return;
            }
            try {
                if (rerunStatusEl) rerunStatusEl.textContent = 'Relance Gemini en cours…';
                setBusy(true);
                const next = await onRerun({
                    pass,
                    refinePrompt,
                    currentText: _stripCodeFences(rawEl?.value || ''),
                });
                if (rawEl) rawEl.value = _stripCodeFences(next || '');
                if (rerunStatusEl) rerunStatusEl.textContent = 'Relance terminée. Vérifie puis valide.';
                refreshSummary();
            } catch (err) {
                if (rerunStatusEl) rerunStatusEl.textContent = `Échec relance: ${err?.message || 'erreur inconnue'}`;
            } finally {
                setBusy(false);
            }
        });
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) close(false, '');
        });
        toggleJsonBtn?.addEventListener('click', () => {
            const collapsed = jsonWrapEl?.classList.contains('is-collapsed');
            setJsonCollapsed(!collapsed);
            if (collapsed) rawEl?.focus();
        });
        document.body.appendChild(overlay);
        setJsonCollapsed(true);
        refreshSummary();
        overlay.querySelector('[data-ai-pass-raw]')?.addEventListener('input', refreshSummary);
        overlay.querySelector('[data-ai-pass-rerun-text]')?.focus();
    });
}

function _openAIPromptTuningModal() {
    const tuning = getAIPromptTuningSettings();
    const pipeline = getAIImportPipelineSettings();
    const gemini = getAIGeminiSettings();
    const imageGenDisabled = !AI_IMAGE_GENERATION_ENABLED;
    const imageGenDisabledAttr = imageGenDisabled ? 'disabled' : '';
    const modelOptions = AI_GEMINI_MODELS
        .map((model) => `<option value="${model}" ${gemini.model === model ? 'selected' : ''}>${model}</option>`)
        .join('');
    const imageModelOptions = AI_GEMINI_IMAGE_MODELS
        .map((model) => `<option value="${model}" ${gemini.imageModel === model ? 'selected' : ''}>${model}</option>`)
        .join('');
    const overlay = document.createElement('div');
    overlay.className = 'ai-tuning-overlay';
    overlay.innerHTML = `
        <div class="ai-tuning-modal" role="dialog" aria-modal="true" aria-label="Réglages IA">
            <div class="ai-tuning-head">
                <div>
                    <h3 class="ai-tuning-title">Réglages IA</h3>
                    <p class="ai-tuning-subtitle">Tune les 5 passes (plan, placeholders visuels, JSON, base64, validation).</p>
                </div>
                <button type="button" class="ai-tuning-close" data-ai-close>✕</button>
            </div>
            <div class="ai-tuning-grid">
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-target-slides">Slides visés</label>
                    <input class="ai-tuning-input ui-input" id="ai-target-slides" type="number" min="4" max="120" value="${tuning.targetSlides}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-duration-minutes">Durée (min)</label>
                    <input class="ai-tuning-input ui-input" id="ai-duration-minutes" type="number" min="5" max="720" value="${tuning.durationMinutes}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-visual-density">Densité visuelle</label>
                    <select class="ai-tuning-select ui-select" id="ai-visual-density">
                        <option value="low" ${tuning.visualDensity === 'low' ? 'selected' : ''}>Faible</option>
                        <option value="balanced" ${tuning.visualDensity === 'balanced' ? 'selected' : ''}>Équilibrée</option>
                        <option value="high" ${tuning.visualDensity === 'high' ? 'selected' : ''}>Élevée</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-image-style">Style illustrations</label>
                    <select class="ai-tuning-select ui-select" id="ai-image-style">
                        <option value="mixte" ${tuning.imageStyle === 'mixte' ? 'selected' : ''}>Mixte</option>
                        <option value="icones" ${tuning.imageStyle === 'icones' ? 'selected' : ''}>Icônes SVG</option>
                        <option value="infographie" ${tuning.imageStyle === 'infographie' ? 'selected' : ''}>Infographie</option>
                        <option value="photo" ${tuning.imageStyle === 'photo' ? 'selected' : ''}>Photo</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-mode">Mode quiz interactifs</label>
                    <select class="ai-tuning-select ui-select" id="ai-quiz-mode">
                        <option value="auto-frequency" ${tuning.quizMode === 'auto-frequency' ? 'selected' : ''}>Auto (via fréquence)</option>
                        <option value="every-n" ${tuning.quizMode === 'every-n' ? 'selected' : ''}>Toutes les X diapos</option>
                        <option value="section-end" ${tuning.quizMode === 'section-end' ? 'selected' : ''}>Fin de chaque partie</option>
                        <option value="hybrid" ${tuning.quizMode === 'hybrid' ? 'selected' : ''}>Hybride (X + fin partie)</option>
                        <option value="none" ${tuning.quizMode === 'none' ? 'selected' : ''}>Désactivé</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-every">Quiz toutes les X slides</label>
                    <input class="ai-tuning-input ui-input" id="ai-quiz-every" type="number" min="2" max="20" value="${tuning.quizEverySlides}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-quiz-frequency">Fréquence quiz</label>
                    <select class="ai-tuning-select ui-select" id="ai-quiz-frequency">
                        <option value="none" ${tuning.quizFrequency === 'none' ? 'selected' : ''}>Aucun</option>
                        <option value="rare" ${tuning.quizFrequency === 'rare' ? 'selected' : ''}>Rare</option>
                        <option value="section" ${tuning.quizFrequency === 'section' ? 'selected' : ''}>Fin section</option>
                        <option value="regular" ${tuning.quizFrequency === 'regular' ? 'selected' : ''}>Régulier</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-course-type">Type de cours</label>
                    <select class="ai-tuning-select ui-select" id="ai-course-type">
                        <option value="CM" ${tuning.courseType === 'CM' ? 'selected' : ''}>CM</option>
                        <option value="TD" ${tuning.courseType === 'TD' ? 'selected' : ''}>TD</option>
                        <option value="TP" ${tuning.courseType === 'TP' ? 'selected' : ''}>TP</option>
                        <option value="Autre" ${tuning.courseType === 'Autre' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-audience">Public cible</label>
                    <input class="ai-tuning-input ui-input" id="ai-audience" type="text" maxlength="180" value="${esc(tuning.audience)}">
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-student-profile">Profil étudiants</label>
                    <input class="ai-tuning-input ui-input" id="ai-student-profile" type="text" maxlength="240" value="${esc(tuning.studentProfile)}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-base64-mode">Base64 local</label>
                    <select class="ai-tuning-select ui-select" id="ai-base64-mode">
                        <option value="none" ${pipeline.base64Mode === 'none' ? 'selected' : ''}>Désactivé</option>
                        <option value="icons-only" ${pipeline.base64Mode === 'icons-only' ? 'selected' : ''}>Icônes/SVG</option>
                        <option value="all" ${pipeline.base64Mode === 'all' ? 'selected' : ''}>Toutes images</option>
                    </select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-timeout-ms">Timeout média / images (ms)</label>
                    <input class="ai-tuning-input ui-input" id="ai-timeout-ms" type="number" min="1000" max="300000" value="${pipeline.timeoutMs}" ${imageGenDisabledAttr}>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-max-illustrations">Max illustrations auto</label>
                    <input class="ai-tuning-input ui-input" id="ai-max-illustrations" type="number" min="0" max="60" value="${pipeline.maxIllustrations}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Options pipeline</label>
                    <label class="ai-tuning-check"><input id="ai-auto-inject" type="checkbox" ${pipeline.autoInjectIllustrations ? 'checked' : ''}> Auto-injection d'illustrations</label>
                    <label class="ai-tuning-check"><input id="ai-force-images" type="checkbox" ${pipeline.forceImageGeneration ? 'checked' : ''} ${imageGenDisabledAttr}> Forcer génération d'images (test)</label>
                    ${imageGenDisabled ? '<div class="ai-tuning-help">La génération d’images est temporairement désactivée. Le pipeline insère des placeholders visuels adaptatifs.</div>' : ''}
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Options réseau</label>
                    <label class="ai-tuning-check"><input id="ai-fetch-remote" type="checkbox" ${pipeline.fetchRemoteImages ? 'checked' : ''}> Convertir les URLs HTTP(S)</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation par étape</label>
                    <label class="ai-tuning-check"><input id="ai-step-validation" type="checkbox" ${pipeline.stepValidation ? 'checked' : ''}> Confirmer chaque passe IA locale</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation</label>
                    <label class="ai-tuning-check"><input id="ai-strict-json" type="checkbox" ${tuning.strictJsonOnly ? 'checked' : ''}> JSON uniquement</label>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label">Validation schéma</label>
                    <label class="ai-tuning-check"><input id="ai-strict-schema" type="checkbox" ${tuning.strictSchema ? 'checked' : ''}> Schéma strict</label>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label">Gemini — connexion</label>
                    <div class="ai-tuning-help">La clé API est stockée localement sur cette machine (localStorage).</div>
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-gemini-key">Clé API Gemini</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-key" type="password" autocomplete="off" placeholder="AIza..." value="${esc(gemini.apiKey)}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-model">Modèle Gemini</label>
                    <select class="ai-tuning-select ui-select" id="ai-gemini-model">${modelOptions}</select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-image-model">Modèle Gemini (passe images/SVG)</label>
                    <select class="ai-tuning-select ui-select" id="ai-gemini-image-model" ${imageGenDisabledAttr}>${imageModelOptions}</select>
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-timeout">Timeout Gemini (ms)</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-timeout" type="number" min="5000" max="300000" value="${gemini.requestTimeoutMs}">
                </div>
                <div class="ai-tuning-field">
                    <label class="ai-tuning-label" for="ai-gemini-temperature">Température</label>
                    <input class="ai-tuning-input ui-input" id="ai-gemini-temperature" type="number" min="0" max="1.5" step="0.1" value="${gemini.temperature}">
                </div>
                <div class="ai-tuning-field ai-tuning-field-full">
                    <label class="ai-tuning-label" for="ai-gemini-brief">Brief de génération (pipeline 5 passes)</label>
                    <textarea class="ai-tuning-input ui-textarea ai-tuning-textarea" id="ai-gemini-brief" rows="5" placeholder="Sujet, public, objectifs, contraintes, style...">${esc(gemini.briefTemplate)}</textarea>
                    <div class="ai-tuning-help">Ce brief sera enrichi avec le contexte éditeur + règles de génération, puis envoyé à Gemini sur 5 passes avec validation humaine à chaque étape.</div>
                </div>
            </div>
            <div class="ai-tuning-actions">
                <button type="button" class="tb-btn ui-btn" data-ai-reset>Réinitialiser</button>
                <button type="button" class="tb-btn ui-btn" data-ai-cancel>Annuler</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-save>Enregistrer</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-run-quiz-augment>Ajouter des quiz aux slides courantes</button>
                <button type="button" class="tb-btn ui-btn tb-btn-lg" data-ai-run>Lancer pipeline Gemini (5 passes)</button>
            </div>
        </div>
    `;

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKeydown);
    };
    const onKeydown = ev => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });

    const syncQuizModeControls = () => {
        const modeEl = overlay.querySelector('#ai-quiz-mode');
        const freqEl = overlay.querySelector('#ai-quiz-frequency');
        const everyEl = overlay.querySelector('#ai-quiz-every');
        const mode = String(modeEl?.value || 'auto-frequency');
        if (freqEl) {
            const disableFreq = mode !== 'auto-frequency';
            freqEl.disabled = disableFreq;
            freqEl.style.opacity = disableFreq ? '0.65' : '1';
        }
        if (everyEl) {
            const disableEvery = !(mode === 'every-n' || mode === 'hybrid');
            everyEl.disabled = disableEvery;
            everyEl.style.opacity = disableEvery ? '0.65' : '1';
        }
    };
    overlay.querySelector('#ai-quiz-mode')?.addEventListener('change', syncQuizModeControls);
    syncQuizModeControls();

    const readValues = () => ({
        tuning: _sanitizeAIPromptTuningSettings({
            targetSlides: Number(overlay.querySelector('#ai-target-slides')?.value),
            durationMinutes: Number(overlay.querySelector('#ai-duration-minutes')?.value),
            visualDensity: overlay.querySelector('#ai-visual-density')?.value,
            imageStyle: overlay.querySelector('#ai-image-style')?.value,
            quizMode: overlay.querySelector('#ai-quiz-mode')?.value,
            quizEverySlides: Number(overlay.querySelector('#ai-quiz-every')?.value),
            quizFrequency: overlay.querySelector('#ai-quiz-frequency')?.value,
            courseType: overlay.querySelector('#ai-course-type')?.value,
            audience: overlay.querySelector('#ai-audience')?.value,
            studentProfile: overlay.querySelector('#ai-student-profile')?.value,
            strictJsonOnly: overlay.querySelector('#ai-strict-json')?.checked,
            strictSchema: overlay.querySelector('#ai-strict-schema')?.checked,
        }),
        pipeline: _sanitizeAIImportPipelineSettings({
            base64Mode: overlay.querySelector('#ai-base64-mode')?.value,
            timeoutMs: Number(overlay.querySelector('#ai-timeout-ms')?.value),
            maxIllustrations: Number(overlay.querySelector('#ai-max-illustrations')?.value),
            autoInjectIllustrations: overlay.querySelector('#ai-auto-inject')?.checked,
            forceImageGeneration: AI_IMAGE_GENERATION_ENABLED ? overlay.querySelector('#ai-force-images')?.checked : false,
            fetchRemoteImages: overlay.querySelector('#ai-fetch-remote')?.checked,
            stepValidation: overlay.querySelector('#ai-step-validation')?.checked,
        }),
        gemini: _sanitizeAIGeminiSettings({
            apiKey: overlay.querySelector('#ai-gemini-key')?.value,
            model: overlay.querySelector('#ai-gemini-model')?.value,
            imageModel: AI_IMAGE_GENERATION_ENABLED
                ? overlay.querySelector('#ai-gemini-image-model')?.value
                : (overlay.querySelector('#ai-gemini-model')?.value || gemini.model),
            requestTimeoutMs: Number(overlay.querySelector('#ai-gemini-timeout')?.value),
            temperature: Number(overlay.querySelector('#ai-gemini-temperature')?.value),
            briefTemplate: overlay.querySelector('#ai-gemini-brief')?.value,
        }),
    });

    overlay.querySelector('[data-ai-close]')?.addEventListener('click', close);
    overlay.querySelector('[data-ai-cancel]')?.addEventListener('click', close);
    overlay.querySelector('[data-ai-reset]')?.addEventListener('click', () => {
        setAIPromptTuningSettings(AI_PROMPT_DEFAULTS);
        setAIImportPipelineSettings(AI_IMPORT_PIPELINE_DEFAULTS);
        setAIGeminiSettings(AI_GEMINI_DEFAULTS);
        close();
        notify('Réglages IA réinitialisés', 'info');
    });
    overlay.querySelector('[data-ai-save]')?.addEventListener('click', () => {
        const values = readValues();
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        notify('Réglages IA enregistrés', 'success');
    });
    overlay.querySelector('[data-ai-run]')?.addEventListener('click', async () => {
        const values = readValues();
        if (!values.gemini.apiKey) {
            notify('Ajoute d’abord la clé API Gemini', 'warning');
            overlay.querySelector('#ai-gemini-key')?.focus();
            return;
        }
        if (!String(values.gemini.briefTemplate || '').trim()) {
            notify('Ajoute un brief de génération', 'warning');
            overlay.querySelector('#ai-gemini-brief')?.focus();
            return;
        }
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        await _runGeminiFivePassFlow({
            brief: values.gemini.briefTemplate,
            tuning: values.tuning,
            pipeline: values.pipeline,
            gemini: values.gemini,
        });
    });
    overlay.querySelector('[data-ai-run-quiz-augment]')?.addEventListener('click', async () => {
        const values = readValues();
        if (!values.gemini.apiKey) {
            notify('Ajoute d’abord la clé API Gemini', 'warning');
            overlay.querySelector('#ai-gemini-key')?.focus();
            return;
        }
        setAIPromptTuningSettings(values.tuning);
        setAIImportPipelineSettings(values.pipeline);
        setAIGeminiSettings(values.gemini);
        close();
        await _runGeminiQuizAugmentFlow({
            tuning: values.tuning,
            gemini: values.gemini,
        });
    });

    document.body.appendChild(overlay);
    overlay.querySelector('#ai-target-slides')?.focus();
}

    root.OEIEditorAIReviewUI = Object.freeze({
        openAIPromptTuningModal: _openAIPromptTuningModal,
        _openAIPromptTuningModal,
        _createAIPassRunnerOverlay,
        _reviewAIPassOutput,
        _reviewPass2IllustrationsChoice,
        _reviewPass3GeneratedImagesChoice,
        _renderPassSummaryHtml,
        testUtils: Object.freeze({
            renderPassSummaryHtml: _renderPassSummaryHtml,
            countSlideTypes: _countSlideTypes,
            collectImageCandidatesFromPresentation: _collectImageCandidatesFromPresentation,
        }),
    });
})(window);
