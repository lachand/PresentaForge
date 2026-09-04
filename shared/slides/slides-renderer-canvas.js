// @ts-check
/**
 * slides-renderer-canvas.js — Lot 16C
 * Méthodes canvas extraites de SlidesRenderer.
 * Dépendances : window.SlidesShared (résolu à l'appel — chargé avant via slides-core.js).
 * Doit être chargé après slides-core.js et slides-themes.js.
 */
(function(global) {
    'use strict';

    if (!global.SlidesShared) throw new Error('[SlidesRendererCanvas] slides-core.js doit être chargé avant slides-renderer-canvas.js');

    /** Helper local d'échappement HTML (identique à SlidesRenderer.esc) */
    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function _getAnchorPos(el, anchor) {
        switch (anchor) {
            case 'top':    return { x: el.x + el.w / 2, y: el.y };
            case 'right':  return { x: el.x + el.w,     y: el.y + el.h / 2 };
            case 'bottom': return { x: el.x + el.w / 2, y: el.y + el.h };
            case 'left':   return { x: el.x,             y: el.y + el.h / 2 };
            default:       return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
        }
    }

    function _anchorDir(anchor) {
        switch (anchor) {
            case 'top':    return { dx: 0, dy: -1 };
            case 'right':  return { dx: 1, dy: 0 };
            case 'bottom': return { dx: 0, dy: 1 };
            case 'left':   return { dx: -1, dy: 0 };
            default:       return { dx: 0, dy: 0 };
        }
    }

    function _renderConnectors(connectors, elements) {
        if (!connectors || connectors.length === 0) return '';
        let defs = '', paths = '';
        for (const conn of connectors) {
            const src = elements.find(e => e.id === conn.sourceId);
            const tgt = elements.find(e => e.id === conn.targetId);
            if (!src || !tgt) continue;
            const p1 = _getAnchorPos(src, conn.sourceAnchor);
            const p2 = _getAnchorPos(tgt, conn.targetAnchor);
            const s = conn.style || {};
            const stroke = s.stroke || '#818cf8';
            const sw = s.strokeWidth || 3;
            const opacity = s.opacity != null ? s.opacity : 1;
            const mkEnd = 'cme-' + Math.random().toString(36).slice(2, 7);
            const mkStart = 'cms-' + Math.random().toString(36).slice(2, 7);
            if (conn.arrowEnd) defs += `<marker id="${mkEnd}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="${stroke}"/></marker>`;
            if (conn.arrowStart) defs += `<marker id="${mkStart}" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="10 0,0 3.5,10 7" fill="${stroke}"/></marker>`;
            const me = conn.arrowEnd ? `marker-end="url(#${mkEnd})"` : '';
            const ms = conn.arrowStart ? `marker-start="url(#${mkStart})"` : '';
            let pathD;
            switch (conn.lineType) {
                case 'curve': {
                    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2, ddx = p2.x-p1.x, ddy = p2.y-p1.y;
                    pathD = `M${p1.x},${p1.y} Q${mx-ddy*0.3},${my+ddx*0.3} ${p2.x},${p2.y}`;
                    break;
                }
                case 'elbow': case 'rounded': {
                    const GAP = 30;
                    const d1 = _anchorDir(conn.sourceAnchor);
                    const d2 = _anchorDir(conn.targetAnchor);
                    const ext1 = { x: p1.x + d1.dx * GAP, y: p1.y + d1.dy * GAP };
                    const ext2 = { x: p2.x + d2.dx * GAP, y: p2.y + d2.dy * GAP };
                    const isH1 = d1.dx !== 0, isH2 = d2.dx !== 0;
                    let pts;
                    if (isH1 && isH2) { const mx = (ext1.x+ext2.x)/2; pts = [p1,ext1,{x:mx,y:ext1.y},{x:mx,y:ext2.y},ext2,p2]; }
                    else if (!isH1 && !isH2) { const my = (ext1.y+ext2.y)/2; pts = [p1,ext1,{x:ext1.x,y:my},{x:ext2.x,y:my},ext2,p2]; }
                    else if (isH1) { pts = [p1,ext1,{x:ext2.x,y:ext1.y},ext2,p2]; }
                    else { pts = [p1,ext1,{x:ext1.x,y:ext2.y},ext2,p2]; }
                    if (conn.lineType === 'rounded') {
                        const R = 12;
                        let d = `M${pts[0].x},${pts[0].y}`;
                        for (let i = 1; i < pts.length - 1; i++) {
                            const prev = pts[i-1], cur = pts[i], next = pts[i+1];
                            const d1x = cur.x-prev.x, d1y = cur.y-prev.y, d2x = next.x-cur.x, d2y = next.y-cur.y;
                            const len1 = Math.sqrt(d1x*d1x+d1y*d1y), len2 = Math.sqrt(d2x*d2x+d2y*d2y);
                            const r = Math.min(R, len1/2, len2/2);
                            if (r < 1) { d += ` L${cur.x},${cur.y}`; continue; }
                            d += ` L${cur.x-(d1x/len1)*r},${cur.y-(d1y/len1)*r} Q${cur.x},${cur.y} ${cur.x+(d2x/len2)*r},${cur.y+(d2y/len2)*r}`;
                        }
                        d += ` L${pts[pts.length-1].x},${pts[pts.length-1].y}`;
                        pathD = d;
                    } else {
                        pathD = 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
                    }
                    break;
                }
                default:
                    pathD = `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
            }
            const dashAttr = s.dashArray ? ` stroke-dasharray="${s.dashArray}"` : '';
            paths += `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dashAttr} ${me} ${ms}/>`;
            if (conn.label) {
                const lx = (p1.x+p2.x)/2, ly = (p1.y+p2.y)/2;
                paths += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" fill="${stroke}" font-size="14" font-family="var(--sl-font-body)">${esc(conn.label)}</text>`;
            }
        }
        return `<svg width="1280" height="720" viewBox="0 0 1280 720" style="position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:9000;"><defs>${defs}</defs>${paths}</svg>`;
    }

    function _canvasSection(s, index, notes = '', opts = {}) {
        const SlidesRenderer = global.SlidesRenderer;
        const bg = SlidesRenderer._slideBackground(s);
        const transitionAttr = s.transition ? ` data-transition="${esc(s.transition)}"` : '';
        const elements = [...(s.elements || [])].filter(e => e.type !== 'connector').sort((a, b) => (a.z || 0) - (b.z || 0));
        const els = elements.map(el => _canvasElement(el, index, opts)).join('');
        const connSvg = _renderConnectors(s.connectors || [], elements);
        const overlay = SlidesRenderer._slideOverlay(index, opts);
        const themeVars = SlidesRenderer._themeOverrideStyle(s);
        const combinedStyle = `${SlidesRenderer._typographyInlineStyle(opts)}${themeVars ? `${themeVars};` : ''}${bg.style}`;
        return `<section class="sl-canvas" data-slide-index="${index}"${bg.attrs}${transitionAttr} style="${combinedStyle}">
            <div style="position:absolute;inset:0;">${els}${connSvg}</div>
            ${overlay}${notes}
        </section>`;
    }

    function _canvasElement(el, slideIndex = 0, opts = {}) {
        const SlidesShared = global.SlidesShared;
        const rot = (el.style?.rotate) ? `transform:rotate(${el.style.rotate}deg);` : '';
        // Caption support — allow overflow for caption below element
        const hasCaption = !!el.data?.caption;
        // Animation support — map to Reveal.js fragment classes
        const anim = el.animation;
        let fragmentClass = '';
        let fragmentAttr = '';
        if (anim && anim.type && anim.type !== 'none') {
            const animMap = {
                'fade-in': 'fragment fade-in',
                'fade-up': 'fragment fade-up',
                'fade-down': 'fragment fade-down',
                'fade-left': 'fragment fade-left',
                'fade-right': 'fragment fade-right',
                'grow': 'fragment grow',
                'shrink': 'fragment shrink',
                'zoom-in': 'fragment zoom-in',
                'highlight-current-blue': 'fragment highlight-current-blue',
            };
            fragmentClass = animMap[anim.type] || 'fragment fade-in';
            if (anim.order != null) fragmentAttr = ` data-fragment-index="${anim.order}"`;
        }
        const cls = fragmentClass ? ` class="${fragmentClass}"` : '';
        const needsOverflow = hasCaption || el.type === 'timer' || el.type === 'latex' || el.type === 'code-live' || el.type === 'quiz-live';
        const elStyle = el.style || {};
        const fillBg = el.type !== 'shape' && elStyle.fill ? `background-color:${elStyle.fill};` : '';
        const css = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.z||1};overflow:${needsOverflow ? 'visible' : 'hidden'};box-sizing:border-box;${rot}${fillBg}`;
        const content = _canvasElementContent(el, slideIndex, opts);
        const captionHtml = SlidesShared.renderCaptionHtml(el, 'sl');
        const elementIdAttr = el?.id ? ` data-element-id="${esc(String(el.id))}"` : '';
        return `<div${cls}${fragmentAttr}${elementIdAttr} style="${css}">${content}${captionHtml}</div>`;
    }

    /**
     * Rendu du CONTENU interne d'un élément canvas (sans le wrapper positionné).
     * Source unique partagée entre le viewer (`_canvasElement`) et l'éditeur
     * (`OEISlidesCanvasContentRuntime`) — voir PRESENTAFORGE_PLAN_EXECUTION_2026-08 chantier 3.
     * @param {any} el @param {number} slideIndex @param {any} opts
     * @returns {string}
     */
    function _canvasElementContent(el, slideIndex = 0, opts = {}) {
        const SlidesShared = global.SlidesShared;
        const P = opts && opts.prefix === 'cel' ? 'cel' : 'sl';
        let content = '';
        switch (el.type) {
            case 'heading':
            case 'text': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize(el.type, s, opts.typography, 22);
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
                // Chantier 8 — `data.html` (HTML libre) assaini par liste blanche au rendu
                // (couvre les decks non passés par l'import : locaux / salle / Firebase).
                let body = el.data?.html
                    ? SlidesShared.sanitizeSlideHtml(el.data.html)
                    : SlidesShared.autoFormatText(el.data?.text || '');
                // Replace template variables
                body = body.replace(/\{\{slideNumber\}\}/g, String(slideIndex + 1));
                // Resolve cross-references
                if (opts.captionRegistry) body = SlidesShared.resolveRefs(body, opts.captionRegistry);
                content = `<div style="width:100%;height:100%;padding:8px 10px;font-size:${base}px;font-weight:${s.fontWeight||400};color:${s.color||'var(--sl-text)'};text-align:${s.textAlign||'left'};font-family:${s.fontFamily||'var(--sl-font-body)'};line-height:${s.lineHeight||1.35};white-space:pre-wrap;word-break:break-word;overflow:hidden;box-sizing:border-box;${vAlignCSS}${extras}">${body}</div>`;
                break;
            }
            case 'code': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code', s, opts.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = labelRaw;
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${esc(label)}</div>
                    <div style="flex:1;min-height:0;--sl-code-font-size:${codeSize}px;--sl-code-gutter-size:${codeSize}px;--sl-code-lang-size:${langSize}px;--sl-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(el.data?.code || '', el.data?.language || 'text', P)}</div>
                </div>`;
                break;
            }
            case 'list': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('list', s, opts.typography, 22);
                const liCls = el.data?.revealItems ? ' class="fragment"' : '';
                const items = (el.data?.items || []).map(i => `<li${liCls}>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                content = `<ul style="margin:0;padding:6px 0 6px 1.5em;font-size:${base}px;color:${s.color||'var(--sl-text)'};text-align:left;">${items}</ul>`;
                break;
            }
            case 'image': {
                content = el.data?.src
                    ? `<img src="${esc(el.data.src)}" alt="${esc(el.data?.alt||'')}" style="width:100%;height:100%;object-fit:contain;">`
                    : '';
                break;
            }
            case 'shape': {
                const base = SlidesShared.resolveElementFontSize('shape', el.style || {}, opts.typography, 16);
                const { svgInner, opacity, textHtml } = SlidesShared.shapeSVG(el, { escapeText: true, baseFontSize: base, typography: opts.typography });
                content = `<div style="position:relative;width:100%;height:100%;opacity:${opacity};"><svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">${svgInner}</svg>${textHtml}</div>`;
                break;
            }
            case 'widget': {
                const cfg = JSON.stringify(el.data?.config || {}).replace(/"/g, '&quot;');
                content = `<div class="${P}-sim-container" data-widget="${esc(el.data?.widget||'')}" data-config="${cfg}" style="width:100%;height:100%;"></div>`;
                break;
            }
            case 'definition': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('definition', s, opts.typography, 16);
                const labelRaw = String(el.data?.label ?? el.data?.blockLabel ?? 'Definition').trim() || 'Definition';
                const label = labelRaw;
                const exampleLabel = String(el.data?.exampleLabel ?? 'Exemple').trim() || 'Exemple';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const termSize = Math.round(base * 1.06);
                const bodySize = Math.round(base);
                const exampleSize = Math.round(base * 0.78);
                content = `<div style="width:100%;height:100%;background:${tone.strongBg};border-left:4px solid ${tone.accent};border:1px solid ${tone.border};border-left-width:4px;border-radius:0 8px 8px 0;padding:0.75rem 1rem;overflow:auto;box-sizing:border-box;">
                    <div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem;">${esc(label)}</div>
                    <div style="font-family:var(--sl-font-mono);font-weight:700;color:${tone.accent};margin-bottom:0.35rem;font-size:${termSize}px;">${esc(el.data?.term||'')}</div>
                    <div style="color:var(--sl-text);line-height:1.5;font-size:${bodySize}px;">${el.data?.definition||''}</div>
                    ${el.data?.example ? `<div style="margin-top:0.5rem;font-size:${exampleSize}px;color:var(--sl-muted);">${esc(exampleLabel)} : ${esc(el.data.example)}</div>` : ''}
                </div>`;
                break;
            }
            case 'callout-box': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('callout-box', s, opts.typography, 18);
                const labelRaw = String(el.data?.label || 'Info').trim() || 'Info';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                content = `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:5px solid ${tone.accent};border-radius:8px;padding:0.9rem 1rem;box-sizing:border-box;overflow:auto;">
                    <div style="font-size:${Math.round(base * 0.78)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.45rem;">${esc(labelRaw)}</div>
                    <div style="font-size:${base}px;line-height:1.5;color:${s.color || 'var(--sl-text)'};">${el.data?.text || ''}</div>
                </div>`;
                break;
            }
            case 'exercise-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('exercise-block', s, opts.typography, 18);
                const title = String(el.data?.title || 'Exercice').trim() || 'Exercice';
                const objective = String(el.data?.objective || '').trim();
                const instructions = Array.isArray(el.data?.instructions) ? el.data.instructions : [];
                const hints = Array.isArray(el.data?.hints) ? el.data.hints : [];
                const correction = String(el.data?.correction || '').trim();
                const showCorrection = !!el.data?.showCorrection;
                const liHtml = (items) => items.map((item) => `<li>${esc(item)}</li>`).join('');
                content = `<div style="width:100%;height:100%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 7%,var(--sl-slide-bg,#1a1d27));border:1px solid var(--sl-border,#2d3347);border-radius:10px;padding:0.85rem 1rem;box-sizing:border-box;overflow:auto;display:flex;flex-direction:column;gap:0.65rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${esc(title)}</div>
                    ${objective ? `<div style="font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;"><strong style="color:var(--sl-primary,#818cf8);">Objectif :</strong> ${esc(objective)}</div>` : ''}
                    ${instructions.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Consignes</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.85)}px;color:var(--sl-text,#cbd5e1);line-height:1.45;">${liHtml(instructions)}</ul></div>` : ''}
                    ${hints.length ? `<div><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-info,#38bdf8);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Indices</div><ul style="margin:0;padding-left:1.25em;font-size:${Math.round(base * 0.8)}px;color:var(--sl-muted,#94a3b8);line-height:1.4;">${liHtml(hints)}</ul></div>` : ''}
                    ${correction ? `<div style="margin-top:auto;border-top:1px dashed var(--sl-border,#2d3347);padding-top:0.5rem;"><div style="font-size:${Math.round(base * 0.72)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:0.2rem;">Correction</div><div style="font-size:${Math.round(base * 0.82)}px;color:${showCorrection ? 'var(--sl-text,#cbd5e1)' : 'var(--sl-muted,#94a3b8)'};line-height:1.4;">${showCorrection ? esc(correction) : 'Masquée (activez "Afficher la correction").'}</div></div>` : '' }
                </div>`;
                break;
            }
            case 'before-after': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('before-after', s, opts.typography, 17);
                const title = String(el.data?.title || 'Avant / Après').trim() || 'Avant / Après';
                const beforeLabel = String(el.data?.beforeLabel || 'Avant').trim() || 'Avant';
                const afterLabel = String(el.data?.afterLabel || 'Après').trim() || 'Après';
                const beforeText = String(el.data?.before || '').trim();
                const afterText = String(el.data?.after || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                content = `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.55rem;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${esc(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,${tone.accent} 34%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:var(--sl-code-bg,#0d1117);">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.03em;">${esc(beforeLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:var(--sl-code-text,#f8fafc);white-space:pre-wrap;">${esc(beforeText)}</div>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 36%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:var(--sl-code-bg,#0d1117);">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">${esc(afterLabel)}</div>
                            <div style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.82)}px;line-height:1.45;color:var(--sl-code-text,#f8fafc);white-space:pre-wrap;">${esc(afterText)}</div>
                        </div>
                    </div>
                </div>`;
                break;
            }
            case 'mistake-fix': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('mistake-fix', s, opts.typography, 17);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.78));
                const title = String(el.data?.title || 'Erreur fréquente vs correction').trim() || 'Erreur fréquente vs correction';
                const lang = String(el.data?.language || 'python').trim() || 'python';
                const mistake = String(el.data?.mistake || '').trim();
                const fix = String(el.data?.fix || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, title);
                content = `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;">
                    <div style="font-size:${Math.round(base * 0.92)}px;font-weight:700;color:var(--sl-heading,#f1f5f9);">${esc(title)}</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.55rem;min-height:0;flex:1;">
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-danger,#ef4444) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:var(--sl-code-bg,#0d1117);">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-danger,#ef4444);text-transform:uppercase;letter-spacing:0.03em;">Erreur fréquente</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:var(--sl-code-text,#f8fafc);white-space:pre-wrap;"><code class="language-${esc(lang)}">${esc(mistake)}</code></pre>
                        </div>
                        <div style="display:flex;flex-direction:column;min-height:0;border:1px solid color-mix(in srgb,var(--sl-success,#22c55e) 40%,var(--sl-border,#2d3347));border-radius:8px;overflow:hidden;background:var(--sl-code-bg,#0d1117);">
                            <div style="padding:5px 8px;font-size:${Math.round(base * 0.66)}px;font-weight:700;color:var(--sl-success,#22c55e);text-transform:uppercase;letter-spacing:0.03em;">Correction</div>
                            <pre style="margin:0;padding:8px 10px;flex:1;overflow:auto;font-size:${Math.round(base * 0.78)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono,monospace);color:var(--sl-code-text,#f8fafc);white-space:pre-wrap;"><code class="language-${esc(lang)}">${esc(fix)}</code></pre>
                        </div>
                    </div>
                </div>`;
                break;
            }
            case 'rubric-block':
            case 'rubrick-block': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('rubric-block', s, opts.typography, 16);
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
                    tableHtml += `<th style="padding:6px 8px;text-align:left;border:1px solid ${tone.border};background:color-mix(in srgb,${tone.accent} 20%,transparent);font-size:${cellSize}px;color:var(--sl-heading,#f1f5f9);">${esc(level)}</th>`;
                });
                tableHtml += `</tr>`;
                rows.forEach((row) => {
                    tableHtml += `<tr><td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;font-weight:600;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 86%,#000);">${esc(row.criterion)}</td>`;
                    safeLevels.forEach((_, idx) => {
                        const value = row.descriptors[idx] || '';
                        tableHtml += `<td style="padding:6px 8px;border:1px solid ${tone.border};font-size:${cellSize}px;line-height:1.35;color:${s.color || 'var(--sl-text,#cbd5e1)'};background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${esc(value)}</td>`;
                    });
                    tableHtml += `</tr>`;
                });
                if (!rows.length) {
                    tableHtml += `<tr><td colspan="${safeLevels.length + 1}" style="padding:10px;border:1px solid ${tone.border};font-size:${cellSize}px;color:var(--sl-muted,#94a3b8);text-align:center;">Ajoutez des critères dans le panneau de propriétés.</td></tr>`;
                }
                tableHtml += `</table>`;
                content = `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:4px solid ${tone.accent};border-radius:10px;padding:0.75rem 0.85rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.5rem;overflow:hidden;">
                    <div style="font-size:${Math.round(base * 0.9)}px;font-weight:700;color:${tone.accent};">${esc(title)}</div>
                    <div style="flex:1;min-height:0;overflow:auto;">${tableHtml}</div>
                </div>`;
                break;
            }
            case 'code-example': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('code-example', s, opts.typography, 16);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(Math.round(base * 0.82));
                const mode = ['terminal', 'live', 'stepper'].includes(el.data?.widgetType) ? el.data.widgetType : 'terminal';
                const labelRaw = String(el.data?.label ?? el.data?.blockTitle ?? 'Exemple').trim() || 'Exemple';
                const label = labelRaw;
                const lang = el.data?.language || 'python';
                const code = el.data?.code || '';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                let widget = `<div style="height:100%;--sl-code-font-size:${Math.round(base * 0.82)}px;--sl-code-gutter-size:${Math.round(base * 0.82)}px;--sl-code-lang-size:${Math.round(base * 0.64)}px;--sl-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(code, lang, P)}</div>`;
                if (mode === 'live') {
                    widget = `<div style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0;">
                        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid color-mix(in srgb,var(--sl-border,#2d3347) 45%,#cbd5e1 55%);background:color-mix(in srgb,var(--sl-code-bg,#0d1117) 60%,#000);font-size:${Math.round(base * 0.66)}px;">
                            <span style="font-family:var(--sl-font-mono);color:var(--sl-muted);text-transform:uppercase;">${esc(lang)}</span>
                            <span style="margin-left:auto;color:${tone.accent};font-weight:700;text-transform:uppercase;">Live</span>
                        </div>
                        <pre style="margin:0;padding:8px 10px;font-size:${Math.round(base * 0.82)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono);color:var(--sl-code-text,#f8fafc);background:var(--sl-code-bg,#0d1117);white-space:pre;overflow:auto;flex:1;"><code class="language-${esc(lang)}">${esc(code)}</code></pre>
                    </div>`;
                } else if (mode === 'stepper') {
                    const steps = Array.isArray(el.data?.stepperSteps) ? el.data.stepperSteps : [];
                    const first = steps[0] || {};
                    widget = `<div style="width:100%;height:100%;display:flex;flex-direction:column;min-height:0;">
                        <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid color-mix(in srgb,var(--sl-border,#2d3347) 45%,#cbd5e1 55%);background:color-mix(in srgb,var(--sl-code-bg,#0d1117) 60%,#000);font-size:${Math.round(base * 0.66)}px;">
                            <span>${esc(el.data?.stepperTitle || 'Exécution pas à pas')}</span>
                            <span style="margin-left:auto;color:${tone.accent};font-weight:700;text-transform:uppercase;">Stepper</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;min-height:0;overflow:auto;">
                            <div style="font-size:${Math.round(base * 0.74)}px;color:var(--sl-heading);font-weight:600;">${esc(first.title || 'Étape 1')}</div>
                            <div style="font-size:${Math.round(base * 0.69)}px;color:var(--sl-muted);">${esc(first.detail || '')}</div>
                            <pre style="margin:0;margin-top:auto;padding:7px 8px;border:1px solid color-mix(in srgb,var(--sl-border,#2d3347) 45%,#cbd5e1 55%);border-radius:7px;background:var(--sl-code-bg,#0d1117);font-size:${Math.round(base * 0.82)}px;line-height:${codeLineHeight};font-family:var(--sl-font-mono);color:var(--sl-code-text,#f8fafc);white-space:pre;overflow:auto;"><code class="language-${esc(lang)}">${esc(first.code || '')}</code></pre>
                        </div>
                    </div>`;
                }
                content = `<div style="width:100%;height:100%;background:${tone.strongBg};border-left:4px solid ${tone.accent};border:1px solid ${tone.border};border-left-width:4px;border-radius:0 8px 8px 0;padding:0.75rem 1rem;box-sizing:border-box;display:flex;flex-direction:column;gap:0.55rem;overflow:hidden;--ce-accent:${tone.accent};">
                    <div style="font-family:var(--sl-font-mono);font-weight:700;color:${tone.accent};font-size:${Math.round(base * 1.02)}px;text-transform:uppercase;letter-spacing:0.03em;">${esc(label)}</div>
                    <div style="color:var(--sl-text);font-size:${Math.round(base * 0.92)}px;line-height:1.45;max-height:36%;overflow:auto;">${el.data?.text || ''}</div>
                    <div style="flex:1;min-height:110px;border:1px solid color-mix(in srgb,var(--sl-border,#2d3347) 45%,#cbd5e1 55%);border-radius:8px;overflow:hidden;background:var(--sl-code-bg,#0d1117);">${widget}</div>
                </div>`;
                break;
            }
            case 'terminal-session': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('terminal-session', s, opts.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const labelRaw = String(el.data?.label ?? 'Session terminal').trim() || 'Session terminal';
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const script = String(el.data?.script || '').replace(/\r\n/g, '\n');
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
                    <div style="font-size:${Math.round(base * 0.66)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${esc(labelRaw)}</div>
                    <div style="flex:1;min-height:0;--sl-code-font-size:${codeSize}px;--sl-code-gutter-size:${codeSize}px;--sl-code-lang-size:${langSize}px;--sl-code-line-height:${codeLineHeight};">${SlidesShared.codeTerminal(script, el.data?.language || 'bash', P)}</div>
                </div>`;
                break;
            }
            case 'quote': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('quote', s, opts.typography, 26);
                const markSize = Math.round(base * 1.85);
                const authorSize = Math.round(base * 0.48);
                const author = el.data?.author
                    ? `<div style="margin-top:0.75rem;font-size:${authorSize}px;color:var(--sl-primary);font-weight:600;font-style:normal;">— ${esc(el.data.author)}</div>`
                    : '';
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1rem 1.5rem;box-sizing:border-box;overflow:hidden;">
                    <div style="font-size:${markSize}px;color:var(--sl-primary);opacity:0.4;line-height:0.7;margin-bottom:0.2rem;">"</div>
                    <div style="font-size:${base}px;font-style:italic;color:${s.color||'var(--sl-heading)'};line-height:1.5;font-family:var(--sl-font-body);">${el.data?.text||''}</div>
                    ${author}
                </div>`;
                break;
            }
            case 'card': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('card', s, opts.typography, 18);
                const titleSize = Math.round(base * 0.76);
                const titleRaw = String(el.data?.title || '').trim();
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, titleRaw);
                const cardTitle = el.data?.title
                    ? `<div style="font-size:${titleSize}px;font-weight:700;color:${s.titleColor||tone.accent};border-bottom:1px solid ${tone.border};padding-bottom:0.5rem;margin-bottom:0.75rem;">${esc(el.data.title)}</div>`
                    : '';
                const liCls = el.data?.revealItems ? ' class="fragment"' : '';
                const items = (el.data?.items || []).map(i => `<li${liCls}>${SlidesShared.formatInlineRichText(i)}</li>`).join('');
                content = `<div style="width:100%;height:100%;background:${tone.softBg};border:1px solid ${tone.border};border-left:3px solid ${tone.accent};border-radius:10px;padding:1rem 1.2rem;overflow:auto;box-sizing:border-box;">
                    ${cardTitle}
                    <ul style="margin:0;padding-left:1.4em;font-size:${base}px;color:${s.color||'var(--sl-text)'};text-align:left;">${items}</ul>
                </div>`;
                break;
            }
            case 'video': {
                const embedUrl = el.data?.embedUrl || '';
                const origUrl = el.data?.src || embedUrl;
                if (embedUrl) {
                    // Use youtube-nocookie for privacy; show fallback link for file:// contexts
                    const safeEmbed = embedUrl.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
                    const videoTitle = esc(el.data?.alt || el.data?.caption || 'Vidéo intégrée');
                    content = `<div style="width:100%;height:100%;background:#000;border-radius:8px;overflow:hidden;position:relative;">
                        <iframe src="${esc(safeEmbed)}" title="${videoTitle}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>
                        <a href="${esc(origUrl)}" target="_blank" rel="noopener" style="position:absolute;bottom:8px;right:12px;font-size:0.7rem;color:rgba(255,255,255,0.5);text-decoration:none;z-index:1;pointer-events:auto;">Ouvrir ↗</a>
                    </div>`;
                }
                break;
            }
            case 'table': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('table', s, opts.typography, 18);
                const rows = el.data?.rows || [];
                let tHtml = '<table style="width:100%;border-collapse:collapse;table-layout:fixed;">';
                rows.forEach((row, ri) => {
                    tHtml += '<tr>';
                    const tag = ri === 0 ? 'th' : 'td';
                    const bg = ri === 0
                        ? `background:color-mix(in srgb,var(--sl-primary) 60%,transparent);font-weight:700;color:#fff;`
                        : ri % 2 === 0
                            ? 'background:color-mix(in srgb,var(--sl-slide-bg) 70%,rgba(255,255,255,0.06));'
                            : 'background:color-mix(in srgb,var(--sl-slide-bg) 80%,rgba(255,255,255,0.03));';
                    (row || []).forEach(cell => {
                        tHtml += `<${tag} style="border:1px solid rgba(255,255,255,0.15);padding:6px 10px;text-align:left;${bg}">${SlidesShared.formatInlineRichText(cell)}</${tag}>`;
                    });
                    tHtml += '</tr>';
                });
                tHtml += '</table>';
                content = `<div style="width:100%;height:100%;overflow:auto;font-size:${base}px;color:${s.color||'var(--sl-text)'};text-align:left;">${tHtml}</div>`;
                break;
            }
            case 'mermaid': {
                const code = el.data?.code || '';
                content = `<div class="${P}-mermaid-pending" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><pre style="display:none">${esc(code)}</pre><div class="${P}-mermaid-render" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div></div>`;
                break;
            }
            case 'diagramme': {
                const s = el.style || {};
                content = SlidesShared.renderDiagrammeBlock(el.data || {}, s, opts.typography, {
                    prefix: P,
                    fallbackFontSize: 16,
                });
                break;
            }
            case 'latex': {
                const s = el.style || {};
                const expr = el.data?.expression || '';
                const base = SlidesShared.resolveElementFontSize('latex', s, opts.typography, 32);
                content = `<div class="${P}-latex-pending" data-latex="${esc(expr)}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:${base}px;color:${s.color||'var(--sl-text)'};"><span class="${P}-latex-render">${esc(expr)}</span></div>`;
                break;
            }
            case 'timer': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('timer', s, opts.typography, 48);
                const dur = el.data?.duration || 300;
                const label = el.data?.label || '';
                const mins = Math.floor(dur / 60);
                const secs = dur % 60;
                const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
                content = `<div class="${P}-timer-content" data-duration="${dur}" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;">
                    ${label ? `<div style="font-size:${Math.round(base * 0.4)}px;color:var(--sl-muted);font-weight:600;text-transform:uppercase;">${esc(label)}</div>` : ''}
                    <div class="${P}-timer-display" style="font-size:${base}px;color:${s.color||'var(--sl-heading)'};font-variant-numeric:tabular-nums;font-weight:700;font-family:var(--sl-font-mono,monospace);">${display}</div>
                    <div style="display:flex;gap:0.5rem;margin-top:0.3rem;">
                        <button class="${P}-timer-btn ${P}-timer-start" title="Démarrer" style="pointer-events:auto;">▶</button>
                        <button class="${P}-timer-btn ${P}-timer-pause" title="Pause" style="display:none;pointer-events:auto;">⏸</button>
                        <button class="${P}-timer-btn ${P}-timer-reset" title="Réinitialiser" style="pointer-events:auto;">↺</button>
                    </div>
                </div>`;
                break;
            }
            case 'iframe': {
                const url = el.data?.url;
                if (url) {
                    content = `<iframe src="${esc(url)}" style="width:100%;height:100%;border:none;border-radius:8px;" sandbox="allow-scripts allow-same-origin" title="${esc(el.data?.title||'')}"></iframe>`;
                }
                break;
            }
            case 'highlight': {
                const s = el.style || {};
                const base = SlidesShared.resolveElementFontSize('highlight', s, opts.typography, 16);
                const codeSize = Math.round(base * 0.82);
                const langSize = Math.round(base * 0.64);
                const codeLineHeight = SlidesShared.resolveCodeLineHeight(codeSize);
                const lang = esc(el.data?.language || 'python');
                const code = esc(el.data?.code || '');
                const labelRaw = String(el.data?.label ?? 'Code').trim() || 'Code';
                const label = esc(labelRaw);
                const tone = SlidesShared.tonePalette(el.data?.labelTone ?? el.data?.tone, labelRaw);
                const highlights = (el.data?.highlights || []).map(h => h.lines).join('|');
                // Use Reveal.js native <pre><code> (no code-terminal wrapper)
                // to avoid flex layout conflicts with Reveal's fragment cloning.
                // Wrap in .{P}-highlight-block to apply terminal-like styling.
                content = `<div class="${P}-highlight-block" style="--sl-code-font-size:${codeSize}px;--sl-code-gutter-size:${codeSize}px;--sl-code-lang-size:${langSize}px;--sl-code-line-height:${codeLineHeight};">
                    <div class="${P}-code-tbar"><div class="${P}-code-dot ${P}-code-dot-r"></div><div class="${P}-code-dot ${P}-code-dot-y"></div><div class="${P}-code-dot ${P}-code-dot-g"></div><span class="${P}-code-tbar-lang">${lang}</span><span style="margin-left:auto;font-size:${Math.round(base * 0.58)}px;font-weight:700;color:${tone.accent};text-transform:uppercase;letter-spacing:0.04em;">${label}</span></div>
                    <pre><code class="language-${lang}" data-line-numbers="${highlights}">${code}</code></pre>
                </div>`;
                break;
            }
            case 'qrcode': {
                const SlidesRenderer = global.SlidesRenderer;
                const val = el.data?.value || '';
                const label = el.data?.label || '';
                const isLink = /^https?:\/\//i.test(val);
                const qrAlt = esc(el.data?.alt || label || val || 'QR code');
                const imgTag = `<img src="${SlidesRenderer._buildQrSrc(val, 300)}" alt="${qrAlt}" style="width:80%;max-height:80%;aspect-ratio:1;object-fit:contain;border-radius:8px;">`;
                const labelHtml = label ? `<div style="font-size:14px;color:var(--sl-muted);text-align:center;">${esc(label)}</div>` : '';
                const isLink2 = isLink;
                const innerContent = isLink2
                    ? `<a href="${esc(val)}" target="_blank" rel="noopener" style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;text-decoration:none;pointer-events:auto;cursor:pointer;">${imgTag}${labelHtml}</a>`
                    : `${imgTag}${labelHtml}`;
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;">${innerContent}</div>`;
                break;
            }
            case 'smartart': {
                const variant = el.data?.variant || 'process';
                const items = SlidesShared.normalizeSmartArtItems(el.data?.items || [], []);
                const color = el.style?.color || 'var(--sl-primary)';
                const count = items.length || 1;
                // Simple HTML representation for Reveal.js
                if (variant === 'process') {
                    const steps = items.map((item, i) => {
                        const arrow = i < items.length - 1 ? `<span style="color:${color};font-size:24px;opacity:0.7;margin:0 4px;">→</span>` : '';
                        return `<span style="flex:1;padding:12px;border:2px solid ${color};border-radius:10px;text-align:center;background:color-mix(in srgb,${color} 8%,var(--sl-slide-bg));color:var(--sl-text);">${esc(item)}</span>${arrow}`;
                    }).join('');
                    content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;box-sizing:border-box;">${steps}</div>`;
                } else if (variant === 'pyramid') {
                    const rows = items.map((item, i) => {
                        const w = 30 + 70 * (i + 1) / count;
                        return `<div style="width:${w}%;padding:10px;border-radius:6px;text-align:center;color:var(--sl-text);background:color-mix(in srgb,${color} ${20+60*(count-i)/count}%,var(--sl-slide-bg));border:1px solid ${color};margin:0 auto;">${esc(item)}</div>`;
                    }).join('');
                    content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:12px;box-sizing:border-box;">${rows}</div>`;
                } else if (variant === 'matrix') {
                    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
                    const cells = items.map(item =>
                        `<div style="padding:12px;border:2px solid ${color};border-radius:8px;text-align:center;color:var(--sl-text);background:color-mix(in srgb,${color} 8%,var(--sl-slide-bg));display:flex;align-items:center;justify-content:center;">${esc(item)}</div>`
                    ).join('');
                    content = `<div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;padding:12px;box-sizing:border-box;align-items:center;">${cells}</div>`;
                } else {
                    // cycle / default — simple list
                    const steps = items.map(item => `<span style="padding:8px 14px;border:2px solid ${color};border-radius:20px;color:var(--sl-text);background:color-mix(in srgb,${color} 10%,var(--sl-slide-bg));">${esc(item)}</span>`).join(' → ');
                    content = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:12px;box-sizing:border-box;">${steps}</div>`;
                }
                break;
            }
            case 'code-live': {
                const lang = esc(el.data?.language || 'python');
                const code = esc(el.data?.code || '');
                const autoRun = el.data?.autoRun ? 'data-autorun="1"' : '';
                content = `<div class="${P}-codelive-pending" data-language="${lang}" ${autoRun} style="width:100%;height:100%;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;border:1px solid var(--sl-border,#2d3347);">
                    <div class="${P}-codelive-toolbar" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 90%,#000);border-bottom:1px solid var(--sl-border,#2d3347);">
                        <span style="font-size:0.75rem;color:var(--sl-muted,#64748b);font-family:var(--sl-font-mono,monospace);text-transform:uppercase;">${lang}</span>
                        <span style="flex:1"></span>
                        <button class="${P}-codelive-run" style="pointer-events:auto;padding:4px 14px;border-radius:6px;border:none;background:var(--sl-primary,#818cf8);color:#fff;font-size:0.75rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">▶ Exécuter</button>
                        <button class="${P}-codelive-clear" style="pointer-events:auto;padding:4px 10px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-muted,#64748b);font-size:0.7rem;cursor:pointer;">Effacer</button>
                    </div>
                    <div style="display:flex;flex:1;min-height:0;">
                        <div class="${P}-codelive-editor" style="flex:1;min-width:0;position:relative;overflow:hidden;"><textarea class="${P}-codelive-code" style="width:100%;height:100%;background:var(--sl-slide-bg,#141620);color:var(--sl-text,#cbd5e1);border:none;padding:12px;font-family:var(--sl-font-mono,monospace);font-size:14px;resize:none;outline:none;box-sizing:border-box;tab-size:4;">${code}</textarea></div>
                        <div class="${P}-codelive-output" style="flex:0 0 40%;border-left:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#141620) 80%,#000);display:flex;flex-direction:column;">
                            <div style="padding:4px 10px;font-size:0.65rem;color:var(--sl-muted,#64748b);text-transform:uppercase;border-bottom:1px solid var(--sl-border,#2d3347);">Sortie</div>
                            <pre class="${P}-codelive-console" style="flex:1;margin:0;padding:10px;font-size:13px;color:var(--sl-text,#cbd5e1);font-family:var(--sl-font-mono,monospace);overflow:auto;white-space:pre-wrap;"></pre>
                        </div>
                    </div>
                </div>`;
                break;
            }
            case 'quiz-live': {
                const question = SlidesShared.formatInlineRichText(el.data?.question || '');
                const quizOpts = el.data?.options || [];
                const answer = el.data?.answer ?? 0;
                const duration = el.data?.duration || 30;
                const label = esc(String(el.data?.label ?? 'Quiz').trim() || 'Quiz');
                const roomId = 'ql-' + (el.id || Math.random().toString(36).slice(2, 9));
                const optsHtml = quizOpts.map((o, i) =>
                    `<div class="${P}-quizlive-option" data-idx="${i}" style="padding:10px 16px;border:2px solid var(--sl-border,#2d3347);border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all 0.2s;pointer-events:auto;">
                        <span style="width:calc(var(--sl-quiz-marker-size,2rem) * 0.9);height:calc(var(--sl-quiz-marker-size,2rem) * 0.9);border-radius:50%;background:color-mix(in srgb,var(--sl-primary,#818cf8) 15%,var(--sl-slide-bg,#141620));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(var(--sl-quiz-option-size,1rem) * 0.62);color:var(--sl-primary,#818cf8);">${String.fromCharCode(65 + i)}</span>
                        <span style="color:var(--sl-text,#cbd5e1);font-size:var(--sl-quiz-option-size,1rem);line-height:1.4;">${SlidesShared.formatInlineRichText(o)}</span>
                    </div>`
                ).join('');
                content = `<div class="${P}-quizlive-pending" data-room="${esc(roomId)}" data-answer="${answer}" data-duration="${duration}" style="width:100%;height:100%;display:flex;flex-direction:column;padding:16px;box-sizing:border-box;gap:12px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-flex;width:18px;height:18px;color:var(--sl-primary,#818cf8);" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg></span>
                        <span style="font-size:var(--sl-label-size,0.8rem);font-weight:700;color:var(--sl-primary,#818cf8);text-transform:uppercase;letter-spacing:0.05em;line-height:1.3;">${label}</span>
                        <span style="flex:1"></span>
                        <span class="${P}-quizlive-timer" style="font-family:var(--sl-font-mono,monospace);font-size:var(--sl-note-size,1rem);color:var(--sl-muted,#64748b);">${duration}s</span>
                        <button class="${P}-quizlive-start" style="pointer-events:auto;padding:5px 14px;border-radius:6px;border:none;background:var(--sl-primary,#818cf8);color:#fff;font-size:var(--sl-label-size,0.75rem);font-weight:600;cursor:pointer;">Lancer</button>
                    </div>
                    <div class="${P}-quizlive-question" style="font-size:calc(var(--sl-text-size,22px) * 1.02);font-weight:600;color:var(--sl-heading,#f1f5f9);line-height:1.4;">${question}</div>
                    <div class="${P}-quizlive-options" style="display:flex;flex-direction:column;gap:8px;flex:1;">${optsHtml}</div>
                    <div class="${P}-quizlive-results" style="display:none;flex:1;"></div>
                    <div class="${P}-quizlive-qr" style="display:none;position:absolute;top:12px;right:12px;width:140px;height:140px;background:#fff;border-radius:8px;padding:6px;cursor:grab;z-index:20;box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:auto;"><div class="${P}-qr-resize-handle">⇲</div></div>
                    <div class="${P}-quizlive-status" style="font-size:var(--sl-quiz-meta-size,0.75rem);color:var(--sl-muted,#64748b);text-align:center;line-height:1.4;">Cliquez sur « Lancer » pour démarrer le quiz</div>
                </div>`;
                break;
            }
            case 'cloze': {
                const sentence = esc(el.data?.sentence || '');
                const blanks = JSON.stringify(el.data?.blanks || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-cloze-pending" data-sentence="${sentence}" data-blanks="${blanks}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:10px;padding:14px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,var(--sl-primary,#818cf8) 6%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--sl-primary,#818cf8);">Texte à trous</div>
                    <div class="${P}-cloze-body" style="font-size:1rem;line-height:1.5;color:var(--sl-text,#e2e8f0);"></div>
                    <button class="${P}-cloze-toggle" style="margin-top:auto;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:pointer;align-self:flex-start;">Afficher les réponses</button>
                </div>`;
                break;
            }
            case 'mcq-single': {
                const q = esc(el.data?.question || '');
                const mcqOpts = JSON.stringify(el.data?.options || []).replace(/"/g, '&quot;');
                const answer = Number(el.data?.answer ?? 0);
                const label = esc(String(el.data?.label ?? 'QCM simple').trim() || 'QCM simple');
                content = `<div class="${P}-mcqsingle-pending" data-options="${mcqOpts}" data-answer="${answer}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:var(--sl-label-size,0.75rem);font-weight:700;color:#8b5cf6;text-transform:uppercase;line-height:1.3;">${label}</div>
                    <div class="${P}-mcq-question" style="font-size:var(--sl-note-size,0.9rem);color:var(--sl-heading,#f1f5f9);line-height:1.4;">${q}</div>
                    <div class="${P}-mcqsingle-options" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="${P}-mcqsingle-check" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:var(--sl-primary,#818cf8);color:#fff;font-size:var(--sl-label-size,0.75rem);cursor:pointer;">Valider</button>
                        <button class="${P}-mcqsingle-end" style="display:none;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:var(--sl-label-size,0.75rem);cursor:pointer;">Terminer live</button>
                        <div class="${P}-mcqsingle-result" style="font-size:var(--sl-quiz-meta-size,0.75rem);color:var(--sl-muted,#64748b);align-self:center;"></div>
                    </div>
                </div>`;
                break;
            }
            case 'drag-drop': {
                const items = JSON.stringify(el.data?.items || []).replace(/"/g, '&quot;');
                const targets = JSON.stringify(el.data?.targets || []).replace(/"/g, '&quot;');
                const title = esc(el.data?.title || 'Classez les éléments');
                content = `<div class="${P}-dnd-pending" data-items="${items}" data-targets="${targets}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.85rem;font-weight:700;color:var(--sl-heading,#f1f5f9);">${title}</div>
                    <div class="${P}-dnd-items" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
                    <div class="${P}-dnd-targets" style="display:flex;gap:6px;flex:1;min-height:0;"></div>
                </div>`;
                break;
            }
            case 'mcq-multi': {
                const q = esc(el.data?.question || '');
                const mcqOpts = JSON.stringify(el.data?.options || []).replace(/"/g, '&quot;');
                const answers = JSON.stringify(el.data?.answers || []).replace(/"/g, '&quot;');
                const label = esc(String(el.data?.label ?? 'QCM multi').trim() || 'QCM multi');
                content = `<div class="${P}-mcqmulti-pending" data-options="${mcqOpts}" data-answers="${answers}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:var(--sl-label-size,0.75rem);font-weight:700;color:#8b5cf6;text-transform:uppercase;line-height:1.3;">${label}</div>
                    <div class="${P}-mcq-question" style="font-size:var(--sl-note-size,0.9rem);color:var(--sl-heading,#f1f5f9);line-height:1.4;">${q}</div>
                    <div class="${P}-mcqmulti-options" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="${P}-mcqmulti-check" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:var(--sl-primary,#818cf8);color:#fff;font-size:var(--sl-label-size,0.75rem);cursor:pointer;">Valider</button>
                        <button class="${P}-mcqmulti-end" style="display:none;pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:var(--sl-label-size,0.75rem);cursor:pointer;">Terminer live</button>
                        <div class="${P}-mcqmulti-result" style="font-size:var(--sl-quiz-meta-size,0.75rem);color:var(--sl-muted,#64748b);align-self:center;"></div>
                    </div>
                </div>`;
                break;
            }
            case 'poll-likert': {
                const prompt = esc(el.data?.prompt || 'Votre niveau de confiance (1 à 5) ?');
                content = `<div class="${P}-polllive-pending" data-poll-type="scale5" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 10%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:var(--sl-label-size,0.75rem);font-weight:700;text-transform:uppercase;color:#8b5cf6;line-height:1.3;">Likert live</div>
                    <div class="${P}-polllive-prompt" style="font-size:var(--sl-note-size,0.9rem);color:var(--sl-heading,#f1f5f9);line-height:1.4;">${prompt}</div>
                    <div class="${P}-polllive-results" style="display:flex;flex-direction:column;gap:6px;flex:1;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="${P}-polllive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Lancer</button>
                        <button class="${P}-polllive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'debate-mode': {
                const prompt = esc(el.data?.prompt || 'Pour ou contre ?');
                content = `<div class="${P}-polllive-pending" data-poll-type="thumbs" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;background:color-mix(in srgb,#8b5cf6 10%,var(--sl-slide-bg,#1a1d27));">
                    <div style="font-size:var(--sl-label-size,0.75rem);font-weight:700;text-transform:uppercase;color:#8b5cf6;line-height:1.3;">Débat live</div>
                    <div class="${P}-polllive-prompt" style="font-size:var(--sl-note-size,0.9rem);color:var(--sl-heading,#f1f5f9);line-height:1.4;">${prompt}</div>
                    <div class="${P}-polllive-results" style="display:flex;flex-direction:column;gap:6px;flex:1;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="${P}-polllive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Lancer</button>
                        <button class="${P}-polllive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'exit-ticket': {
                const title = esc(el.data?.title || 'Exit ticket');
                const prompts = Array.isArray(el.data?.prompts) ? el.data.prompts : [];
                const promptsJson = JSON.stringify(prompts).replace(/"/g, '&quot;');
                content = `<div class="${P}-exitticket-pending" data-title="${title}" data-prompts="${promptsJson}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:var(--sl-label-size,0.75rem);font-weight:700;text-transform:uppercase;color:#8b5cf6;line-height:1.3;">${title}</div>
                    <div class="${P}-exitticket-prompts" style="display:flex;flex-direction:column;gap:6px;overflow:auto;min-height:0;"></div>
                    <div class="${P}-exitticket-results" style="font-size:var(--sl-quiz-meta-size,0.72rem);color:var(--sl-muted,#64748b);min-height:1.2em;line-height:1.35;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="${P}-exitticket-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Lancer</button>
                        <button class="${P}-exitticket-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:var(--sl-label-size,0.74rem);cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'postit-wall': {
                const prompt = esc(el.data?.prompt || 'Partagez une idée clé');
                content = `<div class="${P}-postitlive-pending" data-prompt="${prompt}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">Mur Post-it live</div>
                    <div class="${P}-postitlive-prompt" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);">${prompt}</div>
                    <div class="${P}-postitlive-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;flex:1;min-height:0;overflow:auto;"></div>
                    <div style="display:flex;gap:8px;">
                        <button class="${P}-postitlive-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#14b8a6;color:#052e2b;font-size:0.74rem;font-weight:700;cursor:pointer;">Lancer</button>
                        <button class="${P}-postitlive-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'audience-roulette': {
                const title = esc(el.data?.title || 'Roulette participants');
                content = `<div class="${P}-roulette-pending" data-title="${title}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;align-items:center;justify-content:center;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">Roulette</div>
                    <div style="font-size:0.95rem;color:var(--sl-heading,#f1f5f9);text-align:center;">${title}</div>
                    <div class="${P}-roulette-picked" style="font-size:1.05rem;font-weight:700;color:#e2e8f0;min-height:1.4em;"></div>
                    <button class="${P}-roulette-pick" style="pointer-events:auto;padding:6px 12px;border-radius:8px;border:none;background:#14b8a6;color:#052e2b;font-size:0.75rem;font-weight:700;cursor:pointer;">Tirer au sort</button>
                </div>`;
                break;
            }
            case 'room-stats': {
                const title = esc(el.data?.title || 'Stats live');
                const metrics = JSON.stringify(Array.isArray(el.data?.metrics) ? el.data.metrics : ['students', 'hands', 'questions', 'feedback']).replace(/"/g, '&quot;');
                content = `<div class="${P}-roomstats-pending" data-title="${title}" data-metrics="${metrics}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">${title}</div>
                    <div class="${P}-roomstats-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1;min-height:0;"></div>
                    <div class="${P}-roomstats-foot" style="font-size:0.7rem;color:var(--sl-muted,#64748b);">Mode présentateur requis</div>
                </div>`;
                break;
            }
            case 'leaderboard-live': {
                const title = esc(el.data?.title || 'Leaderboard live');
                const limit = Math.max(3, Math.min(12, Number(el.data?.limit || 5)));
                content = `<div class="${P}-leaderboard-pending" data-title="${title}" data-limit="${limit}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#14b8a6;">${title}</div>
                    <div class="${P}-leaderboard-list" style="display:flex;flex-direction:column;gap:6px;overflow:auto;flex:1;min-height:0;"></div>
                    <div class="${P}-leaderboard-foot" style="font-size:0.7rem;color:var(--sl-muted,#64748b);">Classement live indisponible</div>
                </div>`;
                break;
            }
            case 'swot-grid': {
                const toList = arr => (Array.isArray(arr) ? arr : []).slice(0, 3).map(v => `<li>${esc(v)}</li>`).join('');
                content = `<div class="${P}-swot-pending" style="width:100%;height:100%;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;">
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(52,211,153,0.4);background:rgba(52,211,153,0.09);font-size:0.69rem;"><strong>Forces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.strength)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(248,113,113,0.4);background:rgba(248,113,113,0.09);font-size:0.69rem;"><strong>Faiblesses</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.weakness)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(14,165,233,0.4);background:rgba(14,165,233,0.09);font-size:0.69rem;"><strong>Opportunités</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.opportunity)}</ul></div>
                    <div style="padding:7px;border-radius:8px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.09);font-size:0.69rem;"><strong>Menaces</strong><ul style="margin:6px 0 0 16px;padding:0;line-height:1.35;">${toList(el.data?.threat)}</ul></div>
                </div>`;
                break;
            }
            case 'decision-tree': {
                const root = esc(el.data?.root || '');
                const branches = JSON.stringify(el.data?.branches || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-decisiontree-pending" data-root="${root}" data-branches="${branches}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#ec4899;">Arbre de décision</div>
                    <div class="${P}-dt-root" style="padding:8px;border:1px solid rgba(236,72,153,0.45);border-radius:8px;text-align:center;">${root}</div>
                    <div class="${P}-dt-branches" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;overflow:auto;"></div>
                </div>`;
                break;
            }
            case 'timeline-vertical': {
                const title = esc(el.data?.title || 'Timeline');
                const steps = (Array.isArray(el.data?.steps) ? el.data.steps : []).map((s, i) => `<div style="display:flex;gap:8px;align-items:flex-start;"><span style="width:16px;height:16px;border-radius:50%;border:1px solid #ec4899;color:#ec4899;display:inline-flex;align-items:center;justify-content:center;font-size:0.62rem;">${i+1}</span><span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${esc(s)}</span></div>`).join('');
                content = `<div style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#ec4899;">${title}</div>
                    <div style="display:flex;flex-direction:column;gap:7px;overflow:auto;">${steps}</div>
                </div>`;
                break;
            }
            case 'code-compare': {
                const lang = esc(el.data?.language || 'text');
                const before = esc(el.data?.before || '');
                const after = esc(el.data?.after || '');
                content = `<div class="${P}-codecompare-pending" data-language="${lang}" data-before="${before}" data-after="${after}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#22c55e;text-transform:uppercase;font-weight:700;">Comparateur de code (${lang})</div>
                    <div class="${P}-codecompare-view" style="position:relative;flex:1;min-height:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:hidden;"></div>
                    <input class="${P}-codecompare-range" type="range" min="0" max="100" value="50" style="pointer-events:auto;">
                </div>`;
                break;
            }
            case 'algo-stepper': {
                const title = esc(el.data?.title || 'Algo stepper');
                const steps = JSON.stringify(el.data?.steps || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-algostepper-pending" data-steps="${steps}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#22c55e;">${title}</div>
                    <div class="${P}-algostepper-step-title" style="font-size:0.9rem;color:var(--sl-heading,#f1f5f9);"></div>
                    <div class="${P}-algostepper-step-detail" style="font-size:0.78rem;color:var(--sl-muted,#64748b);"></div>
                    <pre class="${P}-algostepper-code" style="margin:0;flex:1;min-height:0;padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);font-size:0.7rem;font-family:var(--sl-font-mono,monospace);overflow:auto;"></pre>
                    <div style="display:flex;gap:8px;">
                        <button class="${P}-algostepper-prev" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.72rem;cursor:pointer;">Précédent</button>
                        <button class="${P}-algostepper-next" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:none;background:#22c55e;color:#052e16;font-size:0.72rem;font-weight:700;cursor:pointer;">Suivant</button>
                    </div>
                </div>`;
                break;
            }
            case 'gallery-annotable': {
                const src = esc(el.data?.src || '');
                const alt = esc(el.data?.alt || el.data?.caption || 'Image annotée');
                const notes = JSON.stringify(el.data?.notes || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-galleryanno-pending" data-src="${src}" data-alt="${alt}" data-notes="${notes}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:6px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#f43f5e;text-transform:uppercase;font-weight:700;">Gallery annotable</div>
                    <div class="${P}-galleryanno-stage" style="position:relative;flex:1;min-height:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);"></div>
                    <div class="${P}-galleryanno-caption" style="font-size:0.72rem;color:var(--sl-muted,#64748b);min-height:1.2em;"></div>
                </div>`;
                break;
            }
            case 'rank-order': {
                const title = esc(el.data?.title || 'Classement');
                const items = JSON.stringify(el.data?.items || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-rankorder-pending" data-title="${title}" data-items="${items}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="${P}-rankorder-list" style="display:flex;flex-direction:column;gap:6px;overflow:auto;"></div>
                    <div class="${P}-rankorder-results" style="font-size:0.7rem;color:var(--sl-muted,#64748b);min-height:1.2em;"></div>
                    <div style="display:flex;gap:8px;margin-top:auto;">
                        <button class="${P}-rankorder-start" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:none;background:#0ea5e9;color:#082f49;font-size:0.74rem;font-weight:700;cursor:pointer;">Lancer</button>
                        <button class="${P}-rankorder-end" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">Terminer</button>
                    </div>
                </div>`;
                break;
            }
            case 'kanban-mini': {
                const title = esc(el.data?.title || 'Kanban mini');
                const cols = JSON.stringify(el.data?.columns || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-kanban-pending" data-columns="${cols}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:10px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="${P}-kanban-cols" style="display:flex;gap:6px;flex:1;min-height:0;"></div>
                </div>`;
                break;
            }
            case 'myth-reality': {
                const myth = esc(el.data?.myth || '');
                const reality = esc(el.data?.reality || '');
                content = `<div class="${P}-myth-pending" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;">
                    <div class="${P}-flip-card ${P}-myth-card" style="width:86%;height:148px;pointer-events:auto;">
                        <div class="${P}-flip-card-inner">
                            <div class="${P}-flip-face ${P}-flip-front">
                                <div class="${P}-flip-face-label ${P}-flip-face-label-myth">Mythe</div>
                                ${myth}
                            </div>
                            <div class="${P}-flip-face ${P}-flip-back">
                                <div class="${P}-flip-face-label ${P}-flip-face-label-reality">Réalité</div>
                                ${reality}
                            </div>
                        </div>
                    </div>
                    <div class="${P}-flip-hint">Cliquer pour retourner la carte</div>
                </div>`;
                break;
            }
            case 'flashcards-auto': {
                const title = esc(el.data?.title || 'Flashcards');
                const cards = JSON.stringify(el.data?.cards || []).replace(/"/g, '&quot;');
                content = `<div class="${P}-flashcards-pending" data-cards="${cards}" style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border:1px solid var(--sl-border,#2d3347);border-radius:10px;align-items:center;">
                    <div style="font-size:0.72rem;color:#0ea5e9;text-transform:uppercase;font-weight:700;">${title}</div>
                    <div class="${P}-flip-card ${P}-flashcards-card" style="width:88%;height:148px;pointer-events:auto;">
                        <div class="${P}-flip-card-inner">
                            <div class="${P}-flip-face ${P}-flip-front ${P}-flashcards-front"></div>
                            <div class="${P}-flip-face ${P}-flip-back ${P}-flashcards-back"></div>
                        </div>
                    </div>
                    <div class="${P}-flip-hint">Cliquer pour voir le verso</div>
                    <div style="display:flex;gap:8px;">
                        <button class="${P}-flashcards-prev" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.72rem;cursor:pointer;">Précédent</button>
                        <button class="${P}-flashcards-next" style="pointer-events:auto;padding:5px 10px;border-radius:8px;border:none;background:#0ea5e9;color:#082f49;font-size:0.72rem;font-weight:700;cursor:pointer;">Suivant</button>
                    </div>
                </div>`;
                break;
            }
        }
        return content;
    }

    global.OEISlidesRendererCanvas = Object.freeze({
        _getAnchorPos,
        _anchorDir,
        _renderConnectors,
        _canvasSection,
        _canvasElement,
        _canvasElementContent,
        renderElementContent: _canvasElementContent,
    });
})(window);
