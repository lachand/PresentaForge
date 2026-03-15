// @ts-check
/**
 * slides-canvas-content-runtime.js — Lot 15B
 *
 * Extraction du pipeline de rendu contenu éléments canvas :
 *   - renderContent(el, ctx)        — rebuild caption + inner HTML + caption HTML
 *   - updateCaptionEntry(el, ctx)   — recalcule _captionEntry et _captionRegistry
 *   - renderContentInner(el, ctx)   — switch type → HTML (ex-_renderContentInner)
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
     * Render the inner HTML for an element (the large switch over el.type).
     * @param {object} el
     * @param {{ typography: object|null, slideIndex: number, captionRegistry: object|null }} ctx
     * @returns {string}
     */
    function renderContentInner(el, ctx) {
        switch (el.type) {
            case 'heading':
            case 'text': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize(el.type, s, ctx.typography, 22);
                const vAlign = s.verticalAlign || 'top';
                const vAlignCSS = vAlign === 'middle' ? 'display:flex;flex-direction:column;justify-content:center;'
                    : vAlign === 'bottom' ? 'display:flex;flex-direction:column;justify-content:flex-end;'
                    : '';
                const extras = [
                    s.fontStyle     ? `font-style:${s.fontStyle};`         : '',
                    s.textTransform ? `text-transform:${s.textTransform};` : '',
                    s.letterSpacing ? `letter-spacing:${s.letterSpacing};` : '',
                    s.opacity != null ? `opacity:${s.opacity};`            : '',
                    s.background    ? `background:${s.background};`        : '',
                ].join('');
                let body = el.data?.html || SlidesShared.autoFormatText(el.data?.text || '');
                body = body.replace(/\{\{slideNumber\}\}/g, String((ctx.slideIndex || 0) + 1));
                if (ctx.captionRegistry) body = SlidesShared.resolveRefs(body, ctx.captionRegistry);
                return `<div class="cel-text-content" style="font-size:${base}px;font-weight:${s.fontWeight||400};color:${s.color||'var(--sl-text)'};text-align:${s.textAlign||'left'};font-family:${s.fontFamily||'var(--sl-font-body)'};line-height:${s.lineHeight||1.35};width:100%;height:100%;box-sizing:border-box;${vAlignCSS}${extras}">${body}</div>`;
            }
            case 'code': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code', s, ctx.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(label)}</div>
                    <div style="flex:1;min-height:0;--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(el.data?.code || '', el.data?.language || 'text', 'cel')}</div>
                </div>`;
            }
            case 'list': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('list', s, ctx.typography, 22);
                const items = (el.data?.items || []).map(i => `<li>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                return `<ul class="cel-list-content" style="font-size:${base}px;color:${s.color||'var(--sl-text)'};">${items}</ul>`;
            }
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
            case 'definition': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('definition', s, ctx.typography, 16);
                const blockLabelRaw = String(el.data?.label ?? el.data?.blockLabel ?? 'Definition').trim() || 'Definition';
                const blockLabel = blockLabelRaw;
                const exampleLabel = String(el.data?.exampleLabel ?? 'Exemple').trim() || 'Exemple';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, blockLabelRaw);
                const termSize = Math.round(base * 1.06);
                const bodySize = Math.round(base);
                const exampleSize = Math.round(base * 0.78);
                return `<div class="cel-def-content" style="background:${tone.strongBg};border-left-color:${tone.accent};border-color:${tone.border};">
                    <div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem;">${escHtml(blockLabel)}</div>
                    <div class="cel-def-term" style="font-size:${termSize}px;color:${tone.accent};">${escHtml(el.data?.term||'')}</div>
                    <div class="cel-def-body" style="font-size:${bodySize}px;">${el.data?.definition||''}</div>
                    ${el.data?.example ? `<div class="cel-def-example" style="font-size:${exampleSize}px;">${escHtml(exampleLabel)} : ${escHtml(el.data.example)}</div>` : ''}
                </div>`;
            }
            case 'callout-box': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('callout-box', s, ctx.typography, 18);
                const labelRaw = String(el.data?.label || 'Info').trim() || 'Info';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:5px solid ${tone.accent};border-radius:8px;padding:0.9rem 1rem;box-sizing:border-box;overflow:auto;">
                    <div style="font-size:${Math.round(base * 0.78)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.45rem;">${escHtml(labelRaw)}</div>
                    <div style="font-size:${base}px;line-height:1.5;color:${s.color || 'var(--sl-text)'};">${el.data?.text || ''}</div>
                </div>`;
            }
            case 'exercise-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('exercise-block', s, ctx.typography, 18);
                const title = String(el.data?.title || 'Exercice').trim() || 'Exercice';
                const objective = String(el.data?.objective || '').trim();
                const instructions = Array.isArray(el.data?.instructions) ? el.data.instructions : [];
                const hints = Array.isArray(el.data?.hints) ? el.data.hints : [];
                const correction = String(el.data?.correction || '').trim();
                const showCorrection = !!el.data?.showCorrection;
                const liHtml = (items) => items.map((item) => `<li>${escHtml(item)}</li>`).join('');
                return `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 7%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;padding:0.85rem 1rem;box-sizing:border-box;overflow:auto;display:flex;flex-direction:column;gap:0.65rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    ${objective ? `<div style="font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;"><strong style="color:var(--sl-primary,#818cf8);">Objectif :</strong> ${escHtml(objective)}</div>` : ''}
                    ${instructions.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Consignes</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;">${liHtml(instructions)}</ul></div>` : ''}
                    ${hints.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-info,#38bdf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Indices</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.8)}px;color:var(--sl-muted,#94a3b8);line-height:1.4;">${liHtml(hints)}</ul></div>` : ''}
                    ${correction ? `<div style="margin-top:auto;border-top:1px dashed var(--sl-border,#2d3347);padding-top:0.5rem;"><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Correction</div><div style="font-size:${Math.round(base * 0.82)}px;color:${showCorrection ? 'var(--sl-text,#cbd5e1)' : 'var(--sl-muted,#94a3b8)'};line-height:1.4;">${showCorrection ? escHtml(correction) : 'Masquée (activez "Afficher la correction").'}</div></div>` : '' }
                </div>`;
            }
            case 'before-after': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('before-after', s, ctx.typography, 17);
                const title = String(el.data?.title || 'Avant / Après').trim() || 'Avant / Après';
                const beforeLabel = String(el.data?.beforeLabel || 'Avant').trim() || 'Avant';
                const afterLabel = String(el.data?.afterLabel || 'Après').trim() || 'Après';
                const beforeText = String(el.data?.before || '').trim();
                const afterText = String(el.data?.after || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.55rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,${tone.accent} 34%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,${tone.accent} 10%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;">${escHtml(beforeLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;">${escHtml(beforeText)}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 36%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-success,#22c55e) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">${escHtml(afterLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;">${escHtml(afterText)}</div>
                        </div>
                    </div>
                </div>`;
            }
            case 'mistake-fix': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('mistake-fix', s, ctx.typography, 17);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.78));
                const title = String(el.data?.title || 'Erreur fréquente vs correction').trim() || 'Erreur fréquente vs correction';
                const lang = String(el.data?.language || 'python').trim() || 'python';
                const mistake = String(el.data?.mistake || '').trim();
                const fix = String(el.data?.fix || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;">
                    <div style="font-size:${Math.round(base * 0.92)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${escHtml(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-danger,#ef4444) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-danger,#ef4444) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-danger,#ef4444);text-transform:uppercase;letter-spacing:0.03em;">Erreur fréquente</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;"><code class="language-${escHtml(lang)}">${escHtml(mistake)}</code></pre>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-success,#22c55e) 9%,var(--sl-slide-bg,#1a1d27));">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">Correction</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:${s.color || 'var(--sl-text,#cbd5e1)'};white-space:pre-wrap;"><code class="language-${escHtml(lang)}">${escHtml(fix)}</code></pre>
                        </div>
                    </div>
                </div>`;
            }
            case 'rubric-block':
            case 'rubrick-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('rubric-block', s, ctx.typography, 16);
                const title = String(el.data?.title || 'Grille d\u2019évaluation').trim() || 'Grille d\u2019évaluation';
                const levels = (Array.isArray(el.data?.levels) ? el.data.levels : [])
                    .map((level) => String(level || '').trim())
                    .filter(Boolean)
                    .slice(0, 5);
                const rowsRaw = Array.isArray(el.data?.rows) ? el.data.rows : [];
                const rows = rowsRaw
                    .map((row) => {
                        const criterion = String(row?.criterion || '').trim();
                        const descriptors = (Array.isArray(row?.descriptors) ? row.descriptors : [])
                            .map((value) => String(value || '').trim())
                            .slice(0, levels.length || 3);
                        return { criterion, descriptors };
                    })
                    .filter((row) => row.criterion || row.descriptors.some(Boolean))
                    .slice(0, 8);
                const safeLevels = levels.length ? levels : ['Niveau 1', 'Niveau 2', 'Niveau 3'];
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                const cellSize = Math.round(base * 0.78);
                let tableHtml = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">`;
                tableHtml += `<tr><th style="padding:6px 8px;text-align:left;border:1px solid ${tone.border};background:color-mix(in srgb,${tone.accent} 20%,transparent);font-size:${cellSize}px;color:var(--sl-heading,#f1f5f9);">Critère</th>`;
                safeLevels.forEach((level) => {
                    tableHtml += `<th style="padding:6px 8px;text-align:left;border:1px solid ${tone.border};background:color-mix(in srgb,${tone.accent} 20%,transparent);font-size:${cellSize}px;color:var(--sl-heading,#f1f5f9);">${escHtml(level)}</th>`;
                });
                tableHtml += `</tr>`;
                rows.forEach((row) => {
                    tableHtml += `<tr><td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;font-weight:600;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 86%,#000);">${escHtml(row.criterion)}</td>`;
                    safeLevels.forEach((_, idx) => {
                        const value = row.descriptors[idx] || '';
                        tableHtml += `<td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;line-height:1.35;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${escHtml(value)}</td>`;
                    });
                    tableHtml += `</tr>`;
                });
                if (!rows.length) {
                    tableHtml += `<tr><td colspan="${safeLevels.length + 1}" style="padding:10px;border:1px solid ${tone.border};font-size:${cellSize}px;color:var(--sl-muted,#94a3b8);text-align:center;">Ajoutez des critères dans le panneau de propriétés.</td></tr>`;
                }
                tableHtml += `</table>`;
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:4px solid ${tone.accent};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;overflow:hidden;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:${tone.accent};">${escHtml(title)}</div>
                    <div style="flex:1;min-height:0;overflow:auto;">${tableHtml}</div>
                </div>`;
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
            case 'terminal-session': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('terminal-session', s, ctx.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Session terminal').trim() || 'Session terminal';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const script = String(el.data?.script || '').replace(/\r\n/g, '\n');
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(labelRaw)}</div>
                    <div style="flex:1;min-height:0;--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(script, el.data?.language || 'bash', 'cel')}</div>
                </div>`;
            }
            case 'quote': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('quote', s, ctx.typography, 26);
                const markSize = Math.round(base * 1.85);
                const authorSize = Math.round(base * 0.48);
                const author = el.data?.author
                    ? `<div style="margin-top:0.75rem;font-size:${authorSize}px;color:var(--sl-primary,#818cf8);font-weight:600;font-style:normal;">— ${escHtml(el.data.author)}</div>`
                    : '';
                return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 1.5rem;box-sizing:border-box;overflow:hidden;">
                    <div style="font-size:${markSize}px;color:var(--sl-primary,#818cf8);opacity:0.4;line-height:0.7;margin-bottom:0.2rem;">"</div>
                    <div style="font-size:${base}px;font-style:italic;color:${s.color||'var(--sl-heading,#f1f5f9)'};line-height:1.5;font-family:var(--sl-font-body,system-ui);">${escHtml(el.data?.text||'')}</div>
                    ${author}
                </div>`;
            }
            case 'card': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('card', s, ctx.typography, 18);
                const titleSize = Math.round(base * 0.76);
                const titleRaw = String(el.data?.title || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, titleRaw);
                const cardTitle = el.data?.title
                    ? `<div style="font-size:${titleSize}px;font-weight:700;color:${s.titleColor||tone.accent};border-bottom:1px solid ${tone.border};padding-bottom:0.5rem;margin-bottom:0.75rem;">${escHtml(el.data.title)}</div>`
                    : '';
                const items = (el.data?.items || []).map(i => `<li>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                return `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:3px solid ${tone.accent};border-radius:10px;padding:1rem 1.2rem;overflow:auto;box-sizing:border-box;">
                    ${cardTitle}
                    <ul style="margin:0;padding-left:1.4em;font-size:${base}px;color:${s.color||'var(--sl-text,#cbd5e1)'};">${items}</ul>
                </div>`;
            }
            case 'table': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('table', s, ctx.typography, 18);
                const rows = el.data?.rows || [];
                let html = `<div class="cel-table-content" style="font-size:${base}px;color:${s.color||'var(--sl-text,#cbd5e1)'};"><table>`;
                rows.forEach((row, ri) => {
                    html += '<tr>';
                    const tag = ri === 0 ? 'th' : 'td';
                    (row || []).forEach(cell => { html += `<${tag}>${SlidesShared.formatInlineRichText(cell)}</${tag}>`; });
                    html += '</tr>';
                });
                html += '</table></div>';
                return html;
            }
            case 'video': {
                if (el.data?.embedUrl) {
                    const videoTitle = escHtml(el.data?.alt || el.data?.caption || 'Vidéo intégrée');
                    return `<div style="width:100%;height:100%;background:#000;border-radius:8px;overflow:hidden;"><iframe src="${escHtml(el.data.embedUrl)}" title="${videoTitle}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
                }
                return `<div style="width:100%;height:100%;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.88rem;"><span>URL vidéo non définie</span></div>`;
            }
            case 'mermaid': {
                const code = el.data?.code || '';
                const mermaidId = 'mermaid-' + el.id;
                return `<div class="cel-mermaid-content" data-mermaid-id="${mermaidId}">
                    <div class="cel-mermaid-render" id="${mermaidId}"></div>
                    <pre class="cel-mermaid-src" style="display:none">${escHtml(code)}</pre>
                </div>`;
            }
            case 'diagramme': {
                const s = el.style || {};
                return SlidesShared.renderDiagrammeBlock(el.data || {}, s, ctx.typography, {
                    prefix: 'cel',
                    fallbackFontSize: 16,
                });
            }
            case 'latex': {
                const s = el.style || {};
                const expr = el.data?.expression || '';
                const base = SlidesShared.resolveElementFontSize('latex', s, ctx.typography, 32);
                return `<div class="cel-latex-content" style="font-size:${base}px;color:${s.color||'var(--sl-text)'};display:flex;align-items:center;justify-content:center;width:100%;height:100%;" data-latex="${escHtml(expr)}">
                    <span class="cel-latex-render">${escHtml(expr)}</span>
                </div>`;
            }
            case 'timer': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('timer', s, ctx.typography, 48);
                const dur = el.data?.duration || 300;
                const label = el.data?.label || '';
                const mins = Math.floor(dur / 60);
                const secs = dur % 60;
                const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
                return `<div class="cel-timer-content" data-duration="${dur}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
                    ${label ? `<div style="font-size:${Math.round(base * 0.4)}px;color:var(--sl-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escHtml(label)}</div>` : ''}
                    <div class="cel-timer-display" style="font-size:${base}px;color:${s.color||'var(--sl-heading)'};font-variant-numeric:tabular-nums;font-weight:700;font-family:var(--sl-font-mono,monospace);">${display}</div>
                    <div style="display:flex;gap:0.5rem;margin-top:0.3rem;">
                        <button class="cel-timer-btn cel-timer-start" title="Démarrer">▶</button>
                        <button class="cel-timer-btn cel-timer-pause" title="Pause" style="display:none">⏸</button>
                        <button class="cel-timer-btn cel-timer-reset" title="Réinitialiser">↺</button>
                    </div>
                </div>`;
            }
            case 'iframe': {
                const url = el.data?.url;
                const title = el.data?.title || 'Contenu embarqué';
                if (url) {
                    return `<div style="width:100%;height:100%;border-radius:8px;overflow:hidden;border:1px solid var(--sl-border);display:flex;flex-direction:column;">
                        <div style="background:var(--sl-surface);padding:4px 10px;font-size:12px;color:var(--sl-muted);display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--sl-border);">⧉ <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(url)}</span></div>
                        <iframe src="${escHtml(url)}" style="flex:1;border:none;background:#fff;" title="${escHtml(title)}" sandbox="allow-scripts allow-same-origin"></iframe>
                    </div>`;
                }
                return `<div style="width:100%;height:100%;border-radius:8px;border:2px dashed var(--sl-border);display:flex;align-items:center;justify-content:center;color:var(--sl-muted);font-size:1.1rem;flex-direction:column;gap:0.5rem;"><span style="font-size:2rem">⧉</span><span>URL non définie</span></div>`;
            }
            case 'highlight': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('highlight', s, ctx.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const highlights = el.data?.highlights || [];
                const lines = code.split('\n');
                let html = `<div class="cel-highlight-content"><div class="cel-code-terminal" style="--cel-code-font-size:${codeSize}px;--cel-code-gutter-size:${codeSize}px;--cel-code-lang-size:${langSize}px;--cel-code-line-height:${codeLineHeight};"><div class="cel-code-tbar"><div class="cel-code-dot cel-code-dot-r"></div><div class="cel-code-dot cel-code-dot-y"></div><div class="cel-code-dot cel-code-dot-g"></div><span class="cel-code-tbar-lang">${escHtml(lang)}</span><span style="margin-left:auto;font-size:${Math.round(base * 0.58)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${escHtml(label)}</span></div><div class="cel-code-scroll"><pre><code class="language-${escHtml(lang)}">`;
                lines.forEach((line, i) => {
                    const ln = i + 1;
                    const cls = highlights.some(h => window.CanvasEditor._lineInRange(ln, h.lines)) ? ' cel-hl-line' : '';
                    html += `<span class="cel-hl-wrap${cls}" data-line="${ln}">${escHtml(line)}\n</span>`;
                });
                html += `</code></pre></div></div>`;
                if (highlights.length > 0) {
                    html += `<div class="cel-hl-legend">`;
                    highlights.forEach((h, i) => {
                        html += `<span class="cel-hl-legend-item" data-hl="${i}">L${h.lines} ${h.label ? '— '+escHtml(h.label) : ''}</span>`;
                    });
                    html += `</div>`;
                }
                html += `</div>`;
                return html;
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
            case 'code-live': {
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                return `<div class="cel-codelive-content">
                    <div class="cel-codelive-header">
                        <span class="cel-codelive-lang">${escHtml(lang)}</span>
                        <span class="cel-codelive-label">▶ Code Live</span>
                    </div>
                    <div class="cel-codelive-body">
                        <div class="cel-codelive-editor"><pre><code>${escHtml(code)}</code></pre></div>
                        <div class="cel-codelive-output"><span class="cel-codelive-output-label">Sortie</span><pre class="cel-codelive-console"></pre></div>
                    </div>
                </div>`;
            }
            case 'quiz-live': {
                const q = el.data?.question || '';
                const opts = el.data?.options || [];
                const dur = el.data?.duration || 30;
                const label = String(el.data?.label ?? 'Quiz').trim() || 'Quiz';
                const optHtml = opts.map((o, i) => `<div class="cel-quizlive-option"><span class="cel-quizlive-letter">${String.fromCharCode(65 + i)}</span>${escHtml(o)}</div>`).join('');
                return `<div class="cel-quizlive-content">
                    <div class="cel-quizlive-header">
                        <span class="cel-quizlive-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></span>
                        <span>${escHtml(label)}</span>
                        <span class="cel-quizlive-timer">${dur}s</span>
                    </div>
                    <div class="cel-quizlive-question">${escHtml(q)}</div>
                    <div class="cel-quizlive-options">${optHtml}</div>
                    <div class="cel-quizlive-footer">Les étudiants répondent via QR code</div>
                </div>`;
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
            case 'swot-grid': {
                const toItems = list => (Array.isArray(list) ? list : []).slice(0, 3).map(it => `<li>${escHtml(it)}</li>`).join('');
                return `<div style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;">
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(52,211,153,0.09);font-size:0.68rem;"><strong>Forces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.strength)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(248,113,113,0.4);background:rgba(248,113,113,0.09);font-size:0.68rem;"><strong>Faiblesses</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.weakness)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(14,165,233,0.4);background:rgba(14,165,233,0.09);font-size:0.68rem;"><strong>Opportunités</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.opportunity)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.09);font-size:0.68rem;"><strong>Menaces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toItems(el.data?.threat)}</ul></div>
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
            case 'timeline-vertical': {
                const steps = Array.isArray(el.data?.steps) ? el.data.steps : [];
                const html = steps.slice(0, 6).map((s, i) => `<div style="display:flex;gap:8px;align-items:flex-start;">
                        <span style="width:16px;height:16px;border-radius:50%;background:color-mix(in srgb,#ec4899 20%,var(--sl-slide-bg,#1a1d27));border:1px solid #ec4899;display:inline-flex;align-items:center;justify-content:center;font-size:0.62rem;color:#ec4899;">${i+1}</span>
                        <span style="font-size:0.74rem;color:var(--sl-text,#e2e8f0);">${escHtml(s)}</span>
                    </div>`).join('');
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.74rem;font-weight:700;color:#ec4899;text-transform:uppercase;">Timeline verticale</div>
                    <div style="display:flex;flex-direction:column;gap:7px;overflow:auto;">${html}</div>
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
            case 'myth-reality': {
                return `<div style="width:100%;height:100%;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <div style="padding:8px;border:1px solid rgba(251,146,60,0.45);border-radius:8px;background:rgba(251,146,60,0.08);"><div style="font-size:0.65rem;color:#fb923c;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Mythe</div><div style="font-size:0.75rem;">${escHtml(el.data?.myth || '')}</div></div>
                    <div style="padding:8px;border:1px solid rgba(52,211,153,0.45);border-radius:8px;background:rgba(52,211,153,0.08);"><div style="font-size:0.65rem;color:#34d399;text-transform:uppercase;font-weight:700;margin-bottom:4px;">Réalité</div><div style="font-size:0.75rem;">${escHtml(el.data?.reality || '')}</div></div>
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
