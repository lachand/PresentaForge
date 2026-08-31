// @ts-check
/**
 * slides-canvas-content-runtime.js — Lot 15B
 *
 * Extraction du pipeline de rendu contenu éléments canvas :
 *   - renderContent(el, ctx)        — rebuild caption + inner HTML + caption HTML
 *   - updateCaptionEntry(el, ctx)   — recalcule _captionEntry et _captionRegistry
 *   - renderContentInner(el, ctx)   — délègue à OEISlidesRendererCanvas.renderElementContent
 *                                     (prefix 'cel') sauf pour les types spécifiques à l'édition
 *
 * ctx = { typography, slideIndex, captionRegistry, elements }
 *
 * Dépendances globales attendues au moment des appels (pas au chargement) :
 *   window.SlidesShared, window.CanvasEditor
 */
(function (global) {
    if (global.OEISlidesCanvasContentRuntime) return;

    function escHtml(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Recompute _captionEntry for a single element based on current elements order.
     * @param {object} el
     * @param {{ elements: object[], captionRegistry: object|null }} ctx
     */
    function updateCaptionEntry(el, ctx) {
        if (!el.data?.caption && !el.data?.refLabel) { delete el._captionEntry; return; }
        const prefix = SlidesShared.CAPTION_PREFIXES[el.type] || '';
        let number = null;
        if (prefix && el.data?.caption) {
            number = 0;
            for (const e of ctx.elements) {
                const p = SlidesShared.CAPTION_PREFIXES[e.type] || '';
                if (p === prefix && e.data?.caption) {
                    number++;
                    if (e.id === el.id) break;
                }
            }
        }
        el._captionEntry = { prefix, number, caption: el.data.caption || '', elementId: el.id };
        if (el.data?.refLabel && ctx.captionRegistry) {
            ctx.captionRegistry[el.data.refLabel] = el._captionEntry;
        }
    }

    /**
     * Types dont le rendu canvas reste spécifique à l'édition (placeholder, texte riche
     * éditable, montage de widget, légende interactive…). Tous les autres délèguent à
     * `OEISlidesRendererCanvas.renderElementContent` — source unique partagée avec le viewer
     * (voir PRESENTAFORGE_PLAN_EXECUTION_2026-08 — chantier 3).
     */
    const EDITOR_SPECIFIC_TYPES = new Set([
        'image',        // placeholder « URL de l'image » quand pas de src
        'shape',        // texte riche éditable (escapeText:false)
        'widget',       // placeholder de chargement — montage réel via _mountWidget
        'code-example', // sélecteur de widget + _renderCodeExampleWidget
        'smartart',     // _renderSmartArt (layouts cycle absolus)
        'qrcode',       // rendu paresseux hors-ligne via _renderQRElements
        // Widgets « live » : leur markup viewer (`.sl-*-pending`) a des conteneurs vides
        // peuplés par mountQuizElements/mountLiveElements — non montés en preview éditeur
        // (passif). L'éditeur garde donc une maquette statique peuplée (WYSIWYG).
        'cloze', 'mcq-single', 'mcq-multi', 'drag-drop', 'poll-likert', 'debate-mode',
        'exit-ticket', 'postit-wall', 'audience-roulette', 'room-stats', 'leaderboard-live',
        'decision-tree', 'code-compare', 'algo-stepper', 'gallery-annotable', 'rank-order',
        'kanban-mini', 'flashcards-auto',
    ]);

    /**
     * Render the inner HTML for an element.
     * Délègue à `OEISlidesRendererCanvas.renderElementContent(el, slideIndex, { prefix: 'cel' })`
     * sauf pour les types listés dans EDITOR_SPECIFIC_TYPES, rendus ci-dessous.
     * @param {object} el
     * @param {{ typography: object|null, slideIndex: number, captionRegistry: object|null }} ctx
     * @returns {string}
     */
    function renderContentInner(el, ctx) {
        if (!EDITOR_SPECIFIC_TYPES.has(el.type)) {
            const canvasRenderer = (typeof window !== 'undefined' && window.OEISlidesRendererCanvas) || global.OEISlidesRendererCanvas;
            if (canvasRenderer && typeof canvasRenderer.renderElementContent === 'function') {
                return canvasRenderer.renderElementContent(el, ctx.slideIndex || 0, {
                    typography: ctx.typography,
                    captionRegistry: ctx.captionRegistry,
                    prefix: 'cel',
                });
            }
        }
        switch (el.type) {
            case 'image': {
                if (el.data?.src) {
                    return `<img src="${escHtml(el.data.src)}" alt="${escHtml(el.data?.alt||'')}" style="width:100%;height:100%;object-fit:contain;">`;
                }
                return `<div class="cel-image-placeholder">
                    <span class="cel-image-placeholder-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><polyline points="21 16 15 10 6 19"/></svg>
                    </span>
                    <span>URL de l'image</span>
                </div>`;
            }
            case 'shape': {
                return window.CanvasEditor._renderShapeSVG(el, ctx.typography);
            }
            case 'widget': {
                return `<div class="cel-widget-loading"><span style="font-size:0.75rem;font-weight:700">WIDGET</span><span>Chargement…</span></div>`;
            }
            case 'code-example': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code-example', s, ctx.typography, 16);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.82));
                const data = el.data || {};
                const labelRaw = String(data.label ?? data.blockTitle ?? 'Exemple').trim() || 'Exemple';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(data.labelTone ?? data.tone, labelRaw);
                const body = data.text || '';
                const widgetMode = data.widgetType || 'terminal';
                const widgetHtml = window.CanvasEditor._renderCodeExampleWidget(data, widgetMode, s, base);
                return `<div class="cel-code-example-content" style="font-size:${base}px;background:${tone.strongBg};border-left-color:${tone.accent};border-color:${tone.border};--ce-accent:${tone.accent};">
                    <div class="cel-code-example-label" style="font-size:${Math.round(base * 1.02)}px;color:${tone.accent};">${escHtml(label)}</div>
                    <div class="cel-code-example-text" style="font-size:${Math.round(base * 0.92)}px;">${body}</div>
                    <div class="cel-code-example-widget" style="--ce-code-font-size:${Math.round(base * 0.82)}px;--ce-code-gutter-size:${Math.round(base * 0.82)}px;--ce-code-lang-size:${Math.round(base * 0.64)}px;--ce-code-line-height:${codeLineHeight};">${widgetHtml}</div>
                </div>`;
            }
            case 'qrcode': {
                const val = el.data?.value || '';
                const label = el.data?.label || '';
                const alt = escHtml(el.data?.alt || label || val || 'QR code');
                return `<div class="cel-qrcode-content" data-qr-value="${escHtml(val)}" role="img" aria-label="${alt}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;">
                    <div class="cel-qr-render" style="width:80%;aspect-ratio:1;max-height:80%;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;padding:8px;"></div>
                    ${label ? `<div style="font-size:14px;color:var(--sl-muted);text-align:center;">${escHtml(label)}</div>` : ''}
                </div>`;
            }
            case 'smartart': {
                const variant = el.data?.variant || 'process';
                const items = el.data?.items || [];
                const color = el.style?.color || 'var(--sl-primary)';
                return window.CanvasEditor._renderSmartArt(variant, items, color);
            }
            case 'cloze': {
                const sentence = String(el.data?.sentence || '');
                const safeSentence = escHtml(sentence);
                const rendered = safeSentence.includes('____')
                    ? safeSentence.replace(/____/g, '<span style="border-bottom:2px dashed var(--sl-primary,#818cf8);padding:0 10px;color:transparent">___</span>')
                    : safeSentence;
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;background:color-mix(in srgb,var(--sl-primary,#818cf8) 6%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;">Texte à trous</div>
                    <div style="font-size:1rem;line-height:1.45;color:var(--sl-text,#e2e8f0);">${rendered}</div>
                    <div style="margin-top:auto;font-size:0.68rem;color:var(--sl-muted,#64748b);">Interaction en présentation</div>
                </div>`;
            }
            case 'mcq-single': {
                const q = el.data?.question || '';
                const opts = Array.isArray(el.data?.options) ? el.data.options : [];
                const label = String(el.data?.label ?? 'QCM simple').trim() || 'QCM simple';
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:50%;"></span>${escHtml(o || `Option ${i + 1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${escHtml(label)}</div>
                    <div style="font-size:0.85rem;color:var(--sl-heading,#f1f5f9);">${escHtml(q)}</div>
                    <div style="display:flex;flex-direction:column;gap:5px;overflow:auto;">${optHtml}</div>
                </div>`;
            }
            case 'drag-drop': {
                const items = Array.isArray(el.data?.items) ? el.data.items : [];
                const targets = Array.isArray(el.data?.targets) ? el.data.targets : [];
                const itemHtml = items.slice(0, 4).map(i => `<div style="padding:5px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 75%,#000);font-size:0.72rem;">${escHtml(i)}</div>`).join('');
                const targetHtml = targets.slice(0, 3).map(t => `<div style="flex:1;min-height:52px;border:1px dashed var(--sl-border,#2d3347);border-radius:8px;padding:6px;font-size:0.68rem;color:var(--sl-muted,#64748b);">${escHtml(t)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Drag &amp; Drop</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">${itemHtml}</div>
                    <div style="display:flex;gap:6px;min-height:0;flex:1;">${targetHtml}</div>
                </div>`;
            }
            case 'mcq-multi': {
                const q = el.data?.question || '';
                const opts = Array.isArray(el.data?.options) ? el.data.options : [];
                const label = String(el.data?.label ?? 'QCM multi').trim() || 'QCM multi';
                const optHtml = opts.slice(0, 5).map((o, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.75rem;"><span style="width:14px;height:14px;border:1px solid var(--sl-border,#2d3347);border-radius:3px;"></span>${escHtml(o || `Option ${i+1}`)}</div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${escHtml(label)}</div>
                    <div style="font-size:0.85rem;color:var(--sl-heading,#f1f5f9);">${escHtml(q)}</div>
                    <div style="display:flex;flex-direction:column;gap:5px;overflow:auto;">${optHtml}</div>
                </div>`;
            }
            case 'poll-likert': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 9%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">Likert live (1-5)</div>
                    <div style="font-size:0.9rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:auto;">${[1,2,3,4,5].map(n => `<div style="padding:7px 0;border:1px solid var(--sl-border,#2d3347);border-radius:7px;text-align:center;font-weight:700;color:var(--sl-muted,#64748b);">${n}</div>`).join('')}</div>
                </div>`;
            }
            case 'debate-mode': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 9%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">Débat live</div>
                    <div style="font-size:0.9rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:auto;">
                        <div style="padding:8px;border:1px solid rgba(52,211,153,0.45);border-radius:8px;text-align:center;color:#34d399;font-weight:700;">Pour</div>
                        <div style="padding:8px;border:1px solid rgba(248,113,113,0.45);border-radius:8px;text-align:center;color:#f87171;font-weight:700;">Contre</div>
                    </div>
                </div>`;
            }
            case 'exit-ticket': {
                const title = escHtml(el.data?.title || 'Exit ticket');
                const prompts = Array.isArray(el.data?.prompts) ? el.data.prompts : [];
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#8b5cf6;text-transform:uppercase;">${title}</div>
                    ${(prompts.slice(0, 4).map((p, i) => `<div style="padding:7px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);font-size:0.72rem;"><strong>${i + 1}.</strong> ${escHtml(p)}</div>`).join(''))}
                </div>`;
            }
            case 'postit-wall': {
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">Mur Post-it live</div>
                    <div style="font-size:0.86rem;color:var(--sl-text,#e2e8f0);">${escHtml(el.data?.prompt || '')}</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:1;">
                        <div style="background:#fde68a;color:#78350f;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 1</div>
                        <div style="background:#bfdbfe;color:#1e3a8a;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 2</div>
                        <div style="background:#bbf7d0;color:#14532d;border-radius:7px;padding:6px;font-size:0.67rem;">Idée 3</div>
                    </div>
                </div>`;
            }
            case 'audience-roulette': {
                return `<div style="width:100%;height:100%;padding:14px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">Roulette audience</div>
                    <div style="font-size:1rem;color:var(--sl-heading,#f1f5f9);text-align:center;">${escHtml(el.data?.title || 'Roulette participants')}</div>
                    <div style="font-size:0.72rem;color:var(--sl-muted,#64748b);">Tirage aléatoire pendant la présentation</div>
                </div>`;
            }
            case 'room-stats': {
                const metrics = Array.isArray(el.data?.metrics) ? el.data.metrics : ['students', 'hands', 'questions', 'feedback'];
                const labels = {
                    students: 'Connectés',
                    hands: 'Mains levées',
                    questions: 'Questions',
                    feedback: 'Feedback 10min',
                    poll: 'Sondage actif',
                    wordcloud: 'Nuage actif',
                };
                const cards = metrics.slice(0, 6).map(key => `
                    <div style="padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000);">
                        <div style="font-size:0.64rem;color:var(--sl-muted,#64748b);text-transform:uppercase;">${escHtml(labels[key] || key)}</div>
                        <div style="font-size:1.05rem;color:var(--sl-heading,#f1f5f9);font-weight:700;margin-top:2px;">--</div>
                    </div>
                `).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">${escHtml(el.data?.title || 'Stats live')}</div>
                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;min-height:0;">${cards}</div>
                    <div style="font-size:0.66rem;color:var(--sl-muted,#64748b);">Mis à jour en mode présentateur</div>
                </div>`;
            }
            case 'leaderboard-live': {
                const title = escHtml(el.data?.title || 'Leaderboard live');
                const limit = Math.max(3, Math.min(10, Number(el.data?.limit || 5)));
                const rows = Array.from({ length: limit }).map((_, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="width:22px;font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="flex:1;color:var(--sl-text,#e2e8f0);font-size:0.72rem;">Étudiant</span>
                        <span style="color:var(--sl-heading,#f1f5f9);font-weight:700;font-size:0.72rem;">0</span>
                    </div>
                `).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#14b8a6;text-transform:uppercase;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;overflow:auto;">${rows}</div>
                </div>`;
            }
            case 'decision-tree': {
                const root = escHtml(el.data?.root || '');
                const branches = Array.isArray(el.data?.branches) ? el.data.branches : [];
                const bHtml = branches.slice(0, 4).map(b => `<div style="padding:6px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;font-size:0.7rem;"><strong>${escHtml(b.label || 'Branche')}</strong><div style="color:var(--sl-muted,#64748b);margin-top:2px;">${escHtml(b.outcome || '')}</div></div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#ec4899;text-transform:uppercase;">Arbre de décision</div>
                    <div style="padding:8px;border:1px solid rgba(236,72,153,0.45);border-radius:8px;text-align:center;font-size:0.84rem;">${root}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow:auto;">${bHtml}</div>
                </div>`;
            }
            case 'code-compare': {
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:auto;"><div style="padding:4px 8px;font-size:0.66rem;color:var(--sl-muted,#64748b);border-bottom:1px solid var(--sl-border,#2d3347);">Avant</div><pre style="margin:0;padding:8px;font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(el.data?.before || '')}</pre></div>
                    <div style="border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:auto;"><div style="padding:4px 8px;font-size:0.66rem;color:var(--sl-muted,#64748b);border-bottom:1px solid var(--sl-border,#2d3347);">Après</div><pre style="margin:0;padding:8px;font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(el.data?.after || '')}</pre></div>
                </div>`;
            }
            case 'algo-stepper': {
                const steps = Array.isArray(el.data?.steps) ? el.data.steps : [];
                const first = steps[0] || {};
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#22c55e;text-transform:uppercase;">Algo stepper</div>
                    <div style="font-size:0.83rem;color:var(--sl-heading,#f1f5f9);">${escHtml(first.title || 'Étape 1')}</div>
                    <div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">${escHtml(first.detail || '')}</div>
                    <pre style="margin:0;margin-top:auto;padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);font-size:0.66rem;font-family:var(--sl-font-mono,monospace);">${escHtml(first.code || '')}</pre>
                </div>`;
            }
            case 'gallery-annotable': {
                const src = String(el.data?.src || '').trim();
                const alt = escHtml(el.data?.alt || el.data?.caption || 'Image annotée');
                const notes = Array.isArray(el.data?.notes) ? el.data.notes : [];
                const points = notes.slice(0, 8).map((n, i) => `<span style="position:absolute;left:${Math.max(5, Math.min(95, Number(n.x)||0))}%;top:${Math.max(5, Math.min(95, Number(n.y)||0))}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#f43f5e;color:#fff;font-size:0.62rem;display:flex;align-items:center;justify-content:center;">${i+1}</span>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:6px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#f43f5e;text-transform:uppercase;">Gallery annotable</div>
                    <div style="position:relative;flex:1;min-height:0;border-radius:8px;overflow:hidden;border:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">
                        ${src ? `<img src="${escHtml(src)}" alt="${alt}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#64748b);font-size:0.74rem;">Image non définie</div>`}
                        ${points}
                    </div>
                </div>`;
            }
            case 'rank-order': {
                const title = escHtml(el.data?.title || 'Classement');
                const items = Array.isArray(el.data?.items) ? el.data.items : [];
                const rows = items.slice(0, 6).map((it, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.73rem;"><span style="font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);min-width:20px;">${i + 1}.</span><span>${escHtml(it)}</span></div>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;overflow:auto;">${rows}</div>
                </div>`;
            }
            case 'kanban-mini': {
                const cols = Array.isArray(el.data?.columns) ? el.data.columns : [];
                const colHtml = cols.slice(0, 3).map(col => `<div style="flex:1;min-width:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:5px;">
                    <div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;text-transform:uppercase;">${escHtml(col.name || '')}</div>
                    ${(Array.isArray(col.cards) ? col.cards : []).slice(0, 3).map(c => `<div style="padding:5px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;font-size:0.66rem;">${escHtml(c)}</div>`).join('')}
                </div>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Kanban mini</div>
                    <div style="display:flex;gap:6px;flex:1;min-height:0;">${colHtml}</div>
                </div>`;
            }
            case 'flashcards-auto': {
                const cards = Array.isArray(el.data?.cards) ? el.data.cards : [];
                const first = cards[0] || {};
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;">
                    <div style="font-size:0.74rem;font-weight:700;color:#0ea5e9;text-transform:uppercase;">Flashcards</div>
                    <div style="width:86%;min-height:110px;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:0.8rem;">
                        ${escHtml(first.front || 'Question')}
                    </div>
                    <div style="font-size:0.66rem;color:var(--sl-muted,#64748b);">${cards.length} carte(s)</div>
                </div>`;
            }
            default:
                return `<div style="padding:8px;color:var(--sl-muted)">${escHtml(el.type)}</div>`;
        }
    }

    /**
     * Full render pipeline: update caption entry, render inner HTML, append caption HTML.
     * @param {object} el
     * @param {{ typography: object|null, slideIndex: number, captionRegistry: object|null, elements: object[] }} ctx
     * @returns {string}
     */
    function renderContent(el, ctx) {
        updateCaptionEntry(el, { elements: ctx.elements, captionRegistry: ctx.captionRegistry });
        const body = renderContentInner(el, ctx);
        const caption = SlidesShared.renderCaptionHtml(el, 'cel');
        return body + caption;
    }

    global.OEISlidesCanvasContentRuntime = Object.freeze({
        renderContent,
        updateCaptionEntry,
        renderContentInner,
        testUtils: Object.freeze({}),
    });
})(window);
