/**
 * @module slides/editor-export-pptx
 * @internal Module Slides charge cote navigateur.
 */
/* editor-export-pptx.js — Lot 18A
 * Export PowerPoint (PPTX) extrait de editor-export.js.
 * Dépendances globales : editor, notify, ASPECT_DIMS, SlidesThemes, _resolveExportTheme
 */

/* ── Export PPTX ────────────────────────────────────────────────────────── */

async function exportPPTX() {
    const data = editor.data;
    if (!data) return;

    notify('Génération PowerPoint en cours…', 'warning');
    try {
        // Load PptxGenJS from CDN
        if (!window.PptxGenJS) {
            const script = document.createElement('script');
            script.src = '../vendor/pptxgenjs/3.12.0/pptxgen.bundle.js';
            document.head.appendChild(script);
            await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });
        }

        const pptx = new PptxGenJS();
        const meta = data.metadata || {};
        const dims = ASPECT_DIMS[meta.aspect] || [1280, 720];
        const slideWIn = dims[0] / 96;  // px to inches (96 DPI)
        const slideHIn = dims[1] / 96;

        pptx.defineLayout({ name: 'OEI', width: slideWIn, height: slideHIn });
        pptx.layout = 'OEI';
        pptx.title = meta.title || 'Présentation';
        pptx.author = meta.author || '';
        pptx.subject = 'Slides export';

        // Resolve theme colors
        const themeData = _resolveExportTheme(data);
        const tc = { ...(SlidesThemes.BUILT_IN.dark.colors || {}), ...(themeData.colors || {}) };

        for (let si = 0; si < data.slides.length; si++) {
            const slideData = data.slides[si];
            if (slideData.hidden) continue;

            const pptSlide = pptx.addSlide();

            // Background
            if (slideData.bg) {
                const bgColor = _pptxExportColor(slideData.bg);
                if (bgColor) pptSlide.background = { color: bgColor };
            } else if (slideData.bgImage) {
                pptSlide.background = { data: slideData.bgImage };
            } else {
                const bg = _pptxExportColor(tc.slideBg || tc.bg);
                if (bg) pptSlide.background = { color: bg };
            }

            // Speaker notes
            if (slideData.notes) {
                pptSlide.addNotes(slideData.notes);
            }

            if (slideData.type === 'canvas') {
                _pptxExportCanvasSlide(pptSlide, slideData, dims, tc);
            } else {
                _pptxExportTemplateSlide(pptSlide, slideData, dims, tc);
            }
        }

        const filename = (meta.title || 'presentation').replace(/[^a-zA-Z0-9àéèùêîôâ _-]/g, '');
        await pptx.writeFile({ fileName: `${filename}.pptx` });
        notify(`PowerPoint exporté (${data.slides.length} slides)`, 'success');
    } catch (e) {
        console.error('PPTX export error:', e);
        notify('Erreur export PPTX : ' + e.message, 'error');
    }
}

function _pptxExportColor(cssColor) {
    if (!cssColor) return null;
    // Strip var() references
    if (cssColor.startsWith('var(')) return null;
    // hex
    const hex = cssColor.replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex;
    if (/^[0-9a-fA-F]{3}$/.test(hex)) return hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    // rgb()
    const rgb = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
        return [rgb[1], rgb[2], rgb[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return null;
}

function _pptxExportPt(px, dimPx) {
    // Convert px coordinate on canvas to inches for PptxGenJS
    return (px / dimPx) * (dimPx / 96);
}

function _pptxExportCanvasSlide(pptSlide, slideData, dims, tc) {
    const W = dims[0], H = dims[1];
    const toIn = (px) => px / 96;

    for (const el of (slideData.elements || [])) {
        const x = toIn(el.x || 0);
        const y = toIn(el.y || 0);
        const w = toIn(el.w || 100);
        const h = toIn(el.h || 50);
        const s = el.style || {};

        switch (el.type) {
            case 'heading':
            case 'text': {
                const text = el.data?.text || '';
                const opts = {
                    x, y, w, h,
                    fontSize: s.fontSize || (el.type === 'heading' ? 36 : 18),
                    fontFace: _pptxExportFont(s.fontFamily),
                    color: _pptxExportColor(s.color) || _pptxExportColor(el.type === 'heading' ? tc.heading : tc.text) || '333333',
                    bold: (s.fontWeight || 400) >= 700,
                    italic: s.fontStyle === 'italic',
                    align: s.textAlign || 'left',
                    valign: s.verticalAlign === 'middle' ? 'middle' : s.verticalAlign === 'bottom' ? 'bottom' : 'top',
                    wrap: true,
                };
                if (s.background) {
                    const bg = _pptxExportColor(s.background);
                    if (bg) opts.fill = { color: bg };
                }
                if (s.rotate) opts.rotate = s.rotate;
                pptSlide.addText(text, opts);
                break;
            }
            case 'list': {
                const items = el.data?.items || [];
                const textRows = items.map(item => ({
                    text: _mdStripHtml(item),
                    options: { bullet: true, fontSize: s.fontSize || 20, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333' }
                }));
                pptSlide.addText(textRows, { x, y, w, h, valign: 'top' });
                break;
            }
            case 'image': {
                const src = el.data?.src;
                if (src) {
                    const imgOpts = { x, y, w, h };
                    if (src.startsWith('data:')) {
                        imgOpts.data = src;
                    } else {
                        imgOpts.path = src;
                    }
                    if (s.rotate) imgOpts.rotate = s.rotate;
                    try { pptSlide.addImage(imgOpts); } catch(e) { /* skip broken images */ }
                }
                break;
            }
            case 'code':
            case 'highlight': {
                const code = el.data?.code || '';
                pptSlide.addText(code, {
                    x, y, w, h,
                    fontFace: 'Courier New',
                    fontSize: 13,
                    color: _pptxExportColor(tc.codeText) || 'E2E8F0',
                    fill: { color: _pptxExportColor(tc.codeBg) || '0D1117' },
                    valign: 'top',
                    wrap: true,
                });
                break;
            }
            case 'shape': {
                const shapeType = el.data?.shape || el.data?.shapeType || 'rect';
                const pptShape = _pptxMapShape(shapeType);
                const shapeOpts = { x, y, w, h };
                const fill = _pptxExportColor(s.fill);
                if (fill) shapeOpts.fill = { color: fill, transparency: Math.round((1 - (s.opacity ?? 0.25)) * 100) };
                if (s.stroke) {
                    const sc = _pptxExportColor(s.stroke);
                    if (sc) shapeOpts.line = { color: sc, width: s.strokeWidth || 2 };
                }
                if (s.rotate) shapeOpts.rotate = s.rotate;
                pptSlide.addShape(pptShape, shapeOpts);
                // Shape text
                if (el.data?.text) {
                    pptSlide.addText(el.data.text, {
                        x, y, w, h,
                        fontSize: 14, color: _pptxExportColor(tc.text) || '333333',
                        align: 'center', valign: 'middle',
                    });
                }
                break;
            }
            case 'table': {
                const rows = el.data?.rows || [];
                if (rows.length > 0) {
                    const tableRows = rows.map(row => row.map(cell => ({
                        text: cell,
                        options: { fontSize: s.fontSize || 14, color: _pptxExportColor(s.color) || '333333' }
                    })));
                    pptSlide.addTable(tableRows, {
                        x, y, w, h,
                        border: { pt: 1, color: '888888' },
                        colW: Array(rows[0].length).fill(w / rows[0].length),
                    });
                }
                break;
            }
            case 'definition': {
                const term = el.data?.term || '';
                const def = el.data?.definition || '';
                pptSlide.addText([
                    { text: term + '\n', options: { bold: true, fontSize: (s.fontSize || 22) + 4 } },
                    { text: def, options: { fontSize: s.fontSize || 18 } }
                ], { x, y, w, h, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333', valign: 'top', wrap: true });
                break;
            }
            case 'code-example': {
                const text = el.data?.text || '';
                const mode = el.data?.widgetType || 'terminal';
                let code = el.data?.code || '';
                if (mode === 'stepper') {
                    const steps = Array.isArray(el.data?.stepperSteps) ? el.data.stepperSteps : [];
                    code = steps[0]?.code || code;
                }
                const block = `Exemple\n\n${text}${code ? `\n\n${code}` : ''}`;
                pptSlide.addText(block, {
                    x, y, w, h,
                    fontSize: s.fontSize || 16,
                    color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333',
                    valign: 'top',
                    wrap: true,
                    fill: { color: 'F8FAFC', transparency: 12 },
                    line: { color: _pptxExportColor(tc.primary) || '4F46E5', pt: 1.25 },
                    margin: { left: 6, right: 6, top: 6, bottom: 6 },
                });
                break;
            }
            case 'quote': {
                const q = el.data?.text || '';
                const attr = el.data?.attribution || '';
                pptSlide.addText([
                    { text: `"${q}"`, options: { italic: true, fontSize: s.fontSize || 24 } },
                    ...(attr ? [{ text: `\n— ${attr}`, options: { fontSize: (s.fontSize || 24) - 6 } }] : [])
                ], { x, y, w, h, color: _pptxExportColor(s.color) || _pptxExportColor(tc.text) || '333333', align: 'center', valign: 'middle', wrap: true });
                break;
            }
            case 'video': {
                // Video as a placeholder text
                const url = el.data?.url || '';
                pptSlide.addText(`🎬 ${url}`, { x, y, w, h, fontSize: 14, color: '888888', align: 'center', valign: 'middle', fill: { color: 'F0F0F0' } });
                break;
            }
            default:
                break;
        }
    }
}

function _pptxExportTemplateSlide(pptSlide, slide, dims, tc) {
    const W = dims[0] / 96, H = dims[1] / 96;
    const pad = 0.5;

    switch (slide.type) {
        case 'title':
            pptSlide.addText(slide.title || '', {
                x: pad, y: H * 0.3, w: W - 2 * pad, h: 1.2,
                fontSize: 44, bold: true, align: 'center',
                color: _pptxExportColor(tc.heading) || 'FFFFFF',
            });
            if (slide.subtitle) {
                pptSlide.addText(slide.subtitle, {
                    x: pad, y: H * 0.3 + 1.4, w: W - 2 * pad, h: 0.8,
                    fontSize: 24, align: 'center',
                    color: _pptxExportColor(tc.muted) || 'AAAAAA',
                });
            }
            break;
        case 'chapter':
            pptSlide.addText(slide.title || '', {
                x: pad, y: H * 0.35, w: W - 2 * pad, h: 1,
                fontSize: 36, bold: true, align: 'center',
                color: _pptxExportColor(tc.heading) || 'FFFFFF',
            });
            break;
        case 'bullets':
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 32, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            if (Array.isArray(slide.items)) {
                const items = slide.items.map(it => ({
                    text: _mdStripHtml(it),
                    options: { bullet: true, fontSize: 22 }
                }));
                pptSlide.addText(items, {
                    x: pad, y: 1.3, w: W - 2 * pad, h: H - 2,
                    color: _pptxExportColor(tc.text) || 'CCCCCC',
                    valign: 'top',
                });
            }
            break;
        case 'code':
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 28, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            pptSlide.addText(slide.code || '', {
                x: pad, y: 1.2, w: W - 2 * pad, h: H - 1.8,
                fontFace: 'Courier New', fontSize: 14,
                color: _pptxExportColor(tc.codeText) || 'E2E8F0',
                fill: { color: _pptxExportColor(tc.codeBg) || '0D1117' },
                valign: 'top', wrap: true,
            });
            break;
        case 'quote':
            pptSlide.addText([
                { text: `"${slide.quote || ''}"`, options: { italic: true, fontSize: 28 } },
                ...(slide.attribution ? [{ text: `\n— ${slide.attribution}`, options: { fontSize: 18 } }] : [])
            ], {
                x: pad + 0.5, y: H * 0.25, w: W - 2 * pad - 1, h: H * 0.5,
                color: _pptxExportColor(tc.text) || 'CCCCCC',
                align: 'center', valign: 'middle', wrap: true,
            });
            break;
        default:
            if (slide.title) {
                pptSlide.addText(slide.title, {
                    x: pad, y: 0.3, w: W - 2 * pad, h: 0.8,
                    fontSize: 32, bold: true,
                    color: _pptxExportColor(tc.heading) || 'FFFFFF',
                });
            }
            break;
    }
}

function _pptxExportFont(cssFontFamily) {
    if (!cssFontFamily) return 'Arial';
    const first = cssFontFamily.split(',')[0].trim().replace(/["']/g, '');
    if (/mono|courier/i.test(first)) return 'Courier New';
    return first || 'Arial';
}

function _pptxMapShape(shapeType) {
    const PptxGenJS = window.PptxGenJS;
    if (!PptxGenJS) return 'rect';
    const map = {
        'rect': PptxGenJS.ShapeType.rect,
        'rounded-rect': PptxGenJS.ShapeType.roundRect,
        'ellipse': PptxGenJS.ShapeType.ellipse,
        'triangle': PptxGenJS.ShapeType.triangle,
        'diamond': PptxGenJS.ShapeType.diamond,
        'hexagon': PptxGenJS.ShapeType.hexagon,
        'star': PptxGenJS.ShapeType.star5,
        'arrow-right': PptxGenJS.ShapeType.rightArrow,
        'arrow-left': PptxGenJS.ShapeType.leftArrow,
        'arrow-up': PptxGenJS.ShapeType.upArrow,
        'arrow-down': PptxGenJS.ShapeType.downArrow,
    };
    return map[shapeType] || PptxGenJS.ShapeType.rect;
}

window.exportPPTX = exportPPTX;
