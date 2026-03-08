/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-import-pptx
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-import-pptx.js"></script>
 */
/* editor-import-pptx.js — Import PowerPoint (.pptx) files into the editor
 *
 *  Parses the OOXML package and converts to our canvas-based slide JSON format.
 *  Supports:
 *    - Slide size detection + scaling to 1280×720
 *    - Theme colors / fonts extraction → custom OEI theme
 *    - Master slide & layout default styles
 *    - Rich text (bold, italic, underline, color, fontSize, fontFamily, alignment)
 *    - Bullet / numbered lists → list elements
 *    - Tables (a:tbl) → table elements
 *    - Shapes (rectangles, ellipses, etc.) → shape elements
 *    - Group shapes (p:grpSp) — flattened with offset
 *    - Images (embedded) → image elements (base64 data-URL)
 *    - Slide backgrounds (solid fill, gradient, image)
 *    - Rotation (a:xfrm @rot)
 *    - Speaker notes
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const _PPTX_CANVAS_W = 1280;
const _PPTX_CANVAS_H = 720;
const _PPTX_EMU_PER_PT = 12700;
const _PPTX_EMU_TO_PX = 96 / 914400;

// Map common PowerPoint fonts → web-safe / Google equivalents
const _PPTX_FONT_MAP = {
    'calibri': '"Inter", system-ui, sans-serif',
    'arial': 'Arial, sans-serif',
    'arial black': '"Arial Black", sans-serif',
    'times new roman': '"Times New Roman", serif',
    'georgia': 'Georgia, serif',
    'courier new': '"Courier New", monospace',
    'consolas': '"Fira Code", "Consolas", monospace',
    'verdana': 'Verdana, sans-serif',
    'tahoma': 'Tahoma, sans-serif',
    'trebuchet ms': '"Trebuchet MS", sans-serif',
    'comic sans ms': '"Comic Sans MS", cursive',
    'impact': 'Impact, sans-serif',
    'segoe ui': '"Inter", system-ui, sans-serif',
    'aptos': '"Inter", system-ui, sans-serif',
    'century gothic': '"Century Gothic", sans-serif',
    'garamond': 'Garamond, serif',
    'palatino linotype': '"Palatino Linotype", serif',
    'candara': '"Candara", sans-serif',
    'corbel': '"Corbel", sans-serif',
    'cambria': '"Cambria", serif',
    'source sans pro': '"Source Sans Pro", sans-serif',
    'source code pro': '"Source Code Pro", monospace',
};

let _pptxUidCounter = 0;
function _pptxUid() { return 'pptx_' + Date.now().toString(36) + '_' + (++_pptxUidCounter).toString(36); }

// ─── Public entry point ───────────────────────────────────────────────────────

async function importPowerPoint() {
    // Lazy-load JSZip
    if (!window.JSZip) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '../vendor/jszip/3.10.1/jszip.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('JSZip non chargé'));
            document.head.appendChild(s);
        });
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pptx';

    return new Promise((resolve) => {
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return resolve(false);
            notify('Import PPTX en cours…', 'warning');
            try {
                const data = await _pptxParse(file);
                editor.load(data);
                notify(`Importé : ${data.slides.length} slides depuis ${file.name}`, 'success');
                resolve(true);
            } catch (err) {
                console.error('PPTX import error:', err);
                notify('Erreur import PPTX : ' + err.message, 'error');
                resolve(false);
            }
        };
        input.click();
    });
}

// ─── Main parser orchestrator ──────────────────────────────────────────────────

async function _pptxParse(file) {
    const zip = await JSZip.loadAsync(file);
    const ctx = { zip, imageCache: {}, themeColors: {}, themeFonts: {}, defaultTextStyle: {} };

    // 1. Read presentation.xml — slide size + slide order
    const presXml = await _pptxReadXml(zip, 'ppt/presentation.xml');
    const { slideRefs, slideWidth, slideHeight } = _pptxReadPresentation(presXml);
    ctx.srcW = slideWidth;
    ctx.srcH = slideHeight;
    ctx.scaleX = _PPTX_CANVAS_W / slideWidth;
    ctx.scaleY = _PPTX_CANVAS_H / slideHeight;

    // 2. Build rId → target mapping from presentation.xml.rels
    const relsXml = await _pptxReadXml(zip, 'ppt/_rels/presentation.xml.rels');
    const presRels = _pptxReadRels(relsXml);

    // 3. Parse theme (colors + fonts)
    const themeTarget = Object.values(presRels).find(t => t.includes('theme'));
    if (themeTarget) {
        const themePath = 'ppt/' + themeTarget;
        const themeXml = await _pptxReadXml(zip, themePath);
        if (themeXml) _pptxParseTheme(themeXml, ctx);
    }

    // 4. Parse slide masters for default text styles
    const masterTargets = Object.values(presRels).filter(t => t.includes('slideMaster'));
    for (const mt of masterTargets) {
        const masterXml = await _pptxReadXml(zip, 'ppt/' + mt);
        if (masterXml) _pptxParseMasterDefaults(masterXml, ctx);
    }

    // 5. Determine slide paths in order
    let slidePaths = slideRefs
        .map(rId => presRels[rId])
        .filter(Boolean)
        .map(t => 'ppt/' + t);

    if (slidePaths.length === 0) {
        slidePaths = Object.keys(zip.files)
            .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
            .sort((a, b) => {
                const na = parseInt(a.match(/slide(\d+)/)[1]);
                const nb = parseInt(b.match(/slide(\d+)/)[1]);
                return na - nb;
            });
    }

    // 6. Parse each slide
    const slides = [];
    for (const slidePath of slidePaths) {
        const slideXml = await _pptxReadXml(zip, slidePath);
        if (!slideXml) continue;

        const slideRelsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        const slideRels = _pptxReadRels(await _pptxReadXml(zip, slideRelsPath));

        // Optionally read slide layout for inherited styles
        const layoutEntry = Object.entries(slideRels)
            .find(([, t]) => t.includes('slideLayout'));
        let layoutXml = null;
        if (layoutEntry) {
            layoutXml = await _pptxReadXml(zip, 'ppt/slides/' + layoutEntry[1]);
        }

        const slide = await _pptxParseSlide(slideXml, slidePath, slideRels, layoutXml, ctx);
        slides.push(slide);
    }

    // 7. Extract metadata
    const coreXml = await _pptxReadXml(zip, 'docProps/core.xml');
    let title = file.name.replace(/\.pptx$/i, '');
    let author = '';
    if (coreXml) {
        const titleEl = coreXml.getElementsByTagName('dc:title')[0];
        if (titleEl?.textContent) title = titleEl.textContent;
        const authorEl = coreXml.getElementsByTagName('dc:creator')[0];
        if (authorEl?.textContent) author = authorEl.textContent;
    }

    // 8. Build theme object from extracted colors
    const theme = _pptxBuildOEITheme(ctx);

    return {
        metadata: {
            title,
            author,
            aspect: _pptxDetectAspect(slideWidth, slideHeight),
            created: new Date().toISOString().slice(0, 10),
            modified: new Date().toISOString().slice(0, 10),
            version: '1.0',
        },
        theme,
        slides: slides.length > 0 ? slides : [{ type: 'canvas', elements: [] }],
    };
}

// ─── Presentation.xml: slide size + ordering ─────────────────────────────────

function _pptxReadPresentation(presXml) {
    const slideRefs = [];
    let slideWidth = 960, slideHeight = 540;   // safe default in px

    if (!presXml) return { slideRefs, slideWidth, slideHeight };

    // Slide size
    const sldSz = presXml.getElementsByTagName('p:sldSz')[0];
    if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx'));
        const cy = parseInt(sldSz.getAttribute('cy'));
        if (cx) slideWidth = Math.round(cx * _PPTX_EMU_TO_PX);
        if (cy) slideHeight = Math.round(cy * _PPTX_EMU_TO_PX);
    }

    // Slide order
    const sldIdLst = presXml.getElementsByTagName('p:sldIdLst')[0];
    if (sldIdLst) {
        for (const sld of sldIdLst.getElementsByTagName('p:sldId')) {
            const rId = sld.getAttribute('r:id');
            if (rId) slideRefs.push(rId);
        }
    }

    return { slideRefs, slideWidth, slideHeight };
}

function _pptxDetectAspect(w, h) {
    const ratio = w / h;
    if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
    if (Math.abs(ratio - 16 / 10) < 0.05) return '16:10';
    if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
    return '16:9';
}

// ─── Relationships ────────────────────────────────────────────────────────────

function _pptxReadRels(relsXml) {
    const map = {};
    if (!relsXml) return map;
    for (const rel of relsXml.getElementsByTagName('Relationship')) {
        map[rel.getAttribute('Id')] = rel.getAttribute('Target');
    }
    return map;
}

// ─── Theme parsing (colors + fonts) ──────────────────────────────────────────

function _pptxParseTheme(themeXml, ctx) {
    // Color scheme
    const clrScheme = themeXml.getElementsByTagName('a:clrScheme')[0];
    if (clrScheme) {
        const colorNames = ['dk1','dk2','lt1','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
        for (const name of colorNames) {
            const el = clrScheme.getElementsByTagName('a:' + name)[0];
            if (el) {
                const srgb = el.getElementsByTagName('a:srgbClr')[0];
                const sys = el.getElementsByTagName('a:sysClr')[0];
                if (srgb) {
                    ctx.themeColors[name] = '#' + srgb.getAttribute('val');
                } else if (sys) {
                    ctx.themeColors[name] = '#' + (sys.getAttribute('lastClr') || sys.getAttribute('val') || '000000');
                }
            }
        }
    }

    // Font scheme
    const fontScheme = themeXml.getElementsByTagName('a:fontScheme')[0];
    if (fontScheme) {
        const majorFont = fontScheme.getElementsByTagName('a:majorFont')[0];
        const minorFont = fontScheme.getElementsByTagName('a:minorFont')[0];
        if (majorFont) {
            const latin = majorFont.getElementsByTagName('a:latin')[0];
            if (latin) ctx.themeFonts.heading = latin.getAttribute('typeface');
        }
        if (minorFont) {
            const latin = minorFont.getElementsByTagName('a:latin')[0];
            if (latin) ctx.themeFonts.body = latin.getAttribute('typeface');
        }
    }
}

// ─── Master slide defaults ───────────────────────────────────────────────────

function _pptxParseMasterDefaults(masterXml, ctx) {
    const txStyles = masterXml.getElementsByTagName('p:txStyles')[0];
    if (!txStyles) return;

    const titleStyle = txStyles.getElementsByTagName('p:titleStyle')[0];
    if (titleStyle) {
        const lvl1 = titleStyle.getElementsByTagName('a:lvl1pPr')[0];
        if (lvl1) {
            const defRPr = lvl1.getElementsByTagName('a:defRPr')[0];
            if (defRPr) {
                ctx.defaultTextStyle.titleFontSize = _pptxParseSize(defRPr.getAttribute('sz'));
                ctx.defaultTextStyle.titleBold = defRPr.getAttribute('b') === '1';
                ctx.defaultTextStyle.titleColor = _pptxExtractColor(defRPr, ctx);
            }
        }
    }

    const bodyStyle = txStyles.getElementsByTagName('p:bodyStyle')[0];
    if (bodyStyle) {
        const lvl1 = bodyStyle.getElementsByTagName('a:lvl1pPr')[0];
        if (lvl1) {
            const defRPr = lvl1.getElementsByTagName('a:defRPr')[0];
            if (defRPr) {
                ctx.defaultTextStyle.bodyFontSize = _pptxParseSize(defRPr.getAttribute('sz'));
                ctx.defaultTextStyle.bodyColor = _pptxExtractColor(defRPr, ctx);
            }
        }
    }
}

// ─── Build OEI theme from extracted PPTX theme ──────────────────────────────

function _pptxBuildOEITheme(ctx) {
    const tc = ctx.themeColors;
    const tf = ctx.themeFonts;

    // If we didn't extract enough, fall back
    if (!tc.dk1 && !tc.accent1) return 'dark';

    const bg = tc.dk1 || '#0f1117';
    const slideBg = tc.dk2 || _pptxLighten(bg, 0.08);
    const heading = tc.lt1 || '#f1f5f9';
    const text = tc.lt2 || _pptxLighten(heading, -0.15);
    const primary = tc.accent1 || '#818cf8';
    const accent = tc.accent2 || tc.accent3 || '#f472b6';
    const muted = _pptxMixColor(text, bg, 0.5);

    // Detect light vs dark theme
    const bgLum = _pptxLuminance(bg);
    const isLight = bgLum > 0.4;

    return {
        id: 'pptx-import',
        name: 'Import PPTX',
        colors: {
            bg:      isLight ? (tc.lt1 || '#f8fafc') : bg,
            slideBg: isLight ? (tc.lt2 || '#ffffff') : slideBg,
            heading: isLight ? (tc.dk1 || '#0f172a') : heading,
            text:    isLight ? (tc.dk2 || '#334155') : text,
            muted,
            primary,
            accent,
            codeBg:    isLight ? '#1e293b' : _pptxDarken(bg, 0.05),
            codeText:  isLight ? '#e2e8f0' : text,
            border:    _pptxMixColor(primary, isLight ? '#e2e8f0' : bg, 0.3),
            success:   tc.accent4 || '#4ade80',
            warning:   tc.accent5 || '#fb923c',
            tag:       _pptxAlphaColor(primary, 0.15),
            tagBorder: _pptxAlphaColor(primary, 0.3),
        },
        fonts: {
            heading: _pptxMapFont(tf.heading) || '"Inter", system-ui, sans-serif',
            body:    _pptxMapFont(tf.body)    || '"Inter", system-ui, sans-serif',
            mono:    '"Fira Code", "Cascadia Code", monospace',
        },
    };
}

// ─── Slide parser ────────────────────────────────────────────────────────────

async function _pptxParseSlide(slideXml, slidePath, slideRels, layoutXml, ctx) {
    const elements = [];
    const pptxIdMap = {};      // PPTX shape id → our element id
    const rawConnectors = [];  // raw p:cxnSp nodes for post-processing

    // Image relationship map
    const rIdToImage = {};
    for (const [rId, target] of Object.entries(slideRels)) {
        if (/image|media/i.test(target)) rIdToImage[rId] = target;
    }

    // Parse slide background
    let bg = undefined;
    let bgImage = undefined, bgSize = undefined;
    const bgEl = slideXml.getElementsByTagName('p:bg')[0];
    if (bgEl) {
        bg = _pptxParseBackground(bgEl, ctx);
        if (!bg) {
            const imgBg = await _pptxParseBackgroundImage(bgEl, slideRels, ctx);
            if (imgBg) { bgImage = imgBg.bgImage; bgSize = imgBg.bgSize; }
        }
    }

    // Walk shape tree
    const spTree = slideXml.getElementsByTagName('p:cSld')[0]?.getElementsByTagName('p:spTree')[0];
    if (spTree) {
        await _pptxWalkShapeTree(spTree, elements, rIdToImage, ctx, 0, 0, pptxIdMap, rawConnectors, slideRels);
    }

    // Resolve connectors using the PPTX ID → our element ID map
    const connectors = _pptxResolveConnectors(rawConnectors, pptxIdMap, ctx);

    // Speaker notes
    let notes = '';
    const notesPath = slidePath.replace('/slides/', '/notesSlides/').replace(/slide(\d+)/, 'notesSlide$1');
    const notesXml = await _pptxReadXml(ctx.zip, notesPath);
    if (notesXml) {
        const parts = [];
        for (const t of notesXml.getElementsByTagName('a:t')) {
            if (t.textContent) parts.push(t.textContent);
        }
        notes = parts.join(' ').trim();
    }

    return {
        type: 'canvas',
        elements,
        connectors,
        bg: bg || undefined,
        ...(bgImage ? { bgImage, bgSize } : {}),
        notes: notes || undefined,
    };
}

// ─── Shape tree walker (handles groups recursively) ──────────────────────────

async function _pptxWalkShapeTree(node, elements, rIdToImage, ctx, offsetX, offsetY, pptxIdMap, rawConnectors, slideRels) {
    for (const child of node.children) {
        const tag = child.tagName || child.nodeName;

        if (tag === 'p:sp') {
            const el = _pptxParseShape(child, ctx, offsetX, offsetY, slideRels);
            if (el) {
                elements.push(el);
                // Record PPTX shape id → our element id mapping
                const cNvPr = child.getElementsByTagName('p:cNvPr')[0] || child.querySelector('[id]');
                const pptxId = cNvPr?.getAttribute('id');
                if (pptxId) pptxIdMap[pptxId] = el.id;
            }
        } else if (tag === 'p:pic') {
            const el = await _pptxParsePicture(child, rIdToImage, ctx, offsetX, offsetY);
            if (el) {
                elements.push(el);
                const cNvPr = child.getElementsByTagName('p:cNvPr')[0];
                const pptxId = cNvPr?.getAttribute('id');
                if (pptxId) pptxIdMap[pptxId] = el.id;
            }
        } else if (tag === 'p:graphicFrame') {
            const el = _pptxParseGraphicFrame(child, ctx, offsetX, offsetY);
            if (el) {
                elements.push(el);
                const cNvPr = child.getElementsByTagName('p:cNvPr')[0];
                const pptxId = cNvPr?.getAttribute('id');
                if (pptxId) pptxIdMap[pptxId] = el.id;
            }
        } else if (tag === 'p:cxnSp') {
            // Connector shape — collect for post-processing
            rawConnectors.push({ node: child, offsetX, offsetY });
        } else if (tag === 'p:grpSp') {
            // Group shapes — flatten with offset
            const grpXfrm = child.getElementsByTagName('p:grpSpPr')[0]?.getElementsByTagName('a:xfrm')[0];
            let gx = offsetX, gy = offsetY;
            if (grpXfrm) {
                const off = grpXfrm.getElementsByTagName('a:off')[0];
                const chOff = grpXfrm.getElementsByTagName('a:chOff')[0];
                if (off && chOff) {
                    const grpX = parseInt(off.getAttribute('x') || 0);
                    const grpY = parseInt(off.getAttribute('y') || 0);
                    const chX  = parseInt(chOff.getAttribute('x') || 0);
                    const chY  = parseInt(chOff.getAttribute('y') || 0);
                    gx = offsetX + grpX - chX;
                    gy = offsetY + grpY - chY;
                }
            }
            await _pptxWalkShapeTree(child, elements, rIdToImage, ctx, gx, gy, pptxIdMap, rawConnectors, slideRels);
        }
    }
}

// ─── Connector resolver ──────────────────────────────────────────────────────

function _pptxResolveConnectors(rawConnectors, pptxIdMap, ctx) {
    const connectors = [];
    const anchorMap = { 0: 'top', 1: 'right', 2: 'bottom', 3: 'left' };

    for (const { node } of rawConnectors) {
        const cNvCxnSpPr = node.getElementsByTagName('p:cNvCxnSpPr')[0];
        const stCxn = cNvCxnSpPr?.getElementsByTagName('a:stCxn')[0];
        const endCxn = cNvCxnSpPr?.getElementsByTagName('a:endCxn')[0];
        if (!stCxn || !endCxn) continue;  // skip unconnected lines

        const srcPptxId = stCxn.getAttribute('id');
        const srcIdx    = parseInt(stCxn.getAttribute('idx') || '0');
        const tgtPptxId = endCxn.getAttribute('id');
        const tgtIdx    = parseInt(endCxn.getAttribute('idx') || '0');

        const sourceId = pptxIdMap[srcPptxId];
        const targetId = pptxIdMap[tgtPptxId];
        if (!sourceId || !targetId) continue;  // referenced shapes not found

        // Line type from preset geometry
        const spPr = node.getElementsByTagName('p:spPr')[0];
        const prstGeom = spPr?.getElementsByTagName('a:prstGeom')[0];
        const prst = prstGeom?.getAttribute('prst') || '';
        let lineType = 'straight';
        if (/curved/i.test(prst))  lineType = 'curve';
        if (/bent|elbow/i.test(prst)) lineType = 'elbow';

        // Arrow heads
        const ln = spPr?.getElementsByTagName('a:ln')[0];
        const headEnd = ln?.getElementsByTagName('a:headEnd')[0];
        const tailEnd = ln?.getElementsByTagName('a:tailEnd')[0];
        const arrowStart = headEnd && headEnd.getAttribute('type') && headEnd.getAttribute('type') !== 'none';
        const arrowEnd   = !tailEnd || !tailEnd.getAttribute('type') || tailEnd.getAttribute('type') !== 'none';

        // Line style
        const stroke = _pptxExtractShapeStroke(spPr, ctx);

        // Label (connector text)
        const txBody = node.getElementsByTagName('p:txBody')[0];
        let label = '';
        if (txBody) {
            const texts = [];
            for (const t of txBody.getElementsByTagName('a:t')) {
                if (t.textContent?.trim()) texts.push(t.textContent.trim());
            }
            label = texts.join(' ');
        }

        connectors.push({
            id: 'conn_' + _pptxUid(),
            sourceId,
            sourceAnchor: anchorMap[srcIdx % 4] || 'right',
            targetId,
            targetAnchor: anchorMap[tgtIdx % 4] || 'left',
            lineType,
            arrowStart: !!arrowStart,
            arrowEnd: arrowEnd !== false,
            label: label || '',
            style: {
                stroke: stroke?.color || '#818cf8',
                strokeWidth: stroke?.width || 3,
                opacity: 1,
            },
        });
    }
    return connectors;
}

// ─── Shape parser (text, shapes, lists) ──────────────────────────────────────

function _pptxParseShape(sp, ctx, offsetX, offsetY, slideRels) {
    const xfrm = _pptxFindDirectChild(sp.getElementsByTagName('p:spPr')[0], 'a:xfrm')
        || sp.getElementsByTagName('a:xfrm')[0];
    if (!xfrm) return null;

    const { x, y, w, h, rotate } = _pptxReadXfrm(xfrm, ctx, offsetX, offsetY);
    if (w < 5 || h < 5) return null;

    const txBody = sp.getElementsByTagName('p:txBody')[0];
    const hasText = txBody && _pptxHasVisibleText(txBody);

    const spPr = sp.getElementsByTagName('p:spPr')[0];
    const hasFill = _pptxHasShapeFill(spPr);
    const hasStroke = _pptxHasShapeStroke(spPr);
    const prstGeom = spPr?.getElementsByTagName('a:prstGeom')[0];
    const geomType = prstGeom?.getAttribute('prst') || '';

    if (hasText) {
        const { paragraphs, isList, listItems, isTitle } = _pptxParseTxBody(txBody, ctx, slideRels);

        // List detection
        if (isList && listItems.length > 0) {
            return {
                id: _pptxUid(), type: 'list',
                x, y, w, h, z: 1,
                data: { items: listItems },
                style: {
                    fontSize: paragraphs[0]?.fontSize || 22,
                    color: paragraphs[0]?.color || 'var(--sl-text)',
                    ...(rotate ? { rotate } : {}),
                },
            };
        }

        // Heading vs text
        const type = isTitle ? 'heading' : 'text';
        const richHtml = _pptxParagraphsToHtml(paragraphs);
        const plainText = paragraphs.map(p => p.text).join('\n');
        const firstPara = paragraphs[0] || {};

        const style = {
            fontSize: firstPara.fontSize || (isTitle ? 44 : 22),
            fontWeight: firstPara.bold ? 700 : 400,
            color: firstPara.color || (isTitle ? 'var(--sl-heading)' : 'var(--sl-text)'),
            textAlign: firstPara.align || 'left',
            ...(firstPara.fontFamily ? { fontFamily: firstPara.fontFamily } : {}),
            ...(firstPara.italic ? { fontStyle: 'italic' } : {}),
            ...(rotate ? { rotate } : {}),
        };

        // Vertical alignment from a:bodyPr anchor
        const bodyPr = txBody.getElementsByTagName('a:bodyPr')[0];
        const anchor = bodyPr?.getAttribute('anchor');
        if (anchor === 'ctr') style.verticalAlign = 'middle';
        else if (anchor === 'b') style.verticalAlign = 'bottom';

        // Shape with fill → add background
        if (hasFill && !isTitle) {
            const fill = _pptxExtractShapeFill(spPr, ctx);
            if (fill) style.background = fill;
        }

        return {
            id: _pptxUid(), type,
            x, y, w, h, z: 1,
            data: { text: plainText, html: richHtml },
            style,
        };
    }

    // Non-text shape with fill or border
    if (hasFill || hasStroke || geomType) {
        const fill = _pptxExtractShapeFill(spPr, ctx) || 'var(--sl-primary)';
        const opacity = _pptxExtractShapeOpacity(spPr);
        const shapeType = _pptxMapGeometry(geomType);
        const stroke = _pptxExtractShapeStroke(spPr, ctx);

        return {
            id: _pptxUid(), type: 'shape',
            x, y, w, h, z: 1,
            data: { shape: shapeType, shapeType, text: '' },
            style: {
                fill,
                opacity: opacity ?? 0.25,
                ...(stroke ? { stroke: stroke.color, strokeWidth: stroke.width } : {}),
                ...(rotate ? { rotate } : {}),
            },
        };
    }

    return null;
}

// ─── Table parser (graphicFrame with a:tbl) ──────────────────────────────────

function _pptxParseGraphicFrame(frame, ctx, offsetX, offsetY) {
    const xfrm = frame.getElementsByTagName('a:xfrm')[0]
        || frame.getElementsByTagName('p:xfrm')[0];
    if (!xfrm) return null;

    const { x, y, w, h } = _pptxReadXfrm(xfrm, ctx, offsetX, offsetY);

    // Table handling
    const tbl = frame.getElementsByTagName('a:tbl')[0];
    if (tbl) {
        const rows = [];
        for (const tr of tbl.getElementsByTagName('a:tr')) {
            const row = [];
            for (const tc of tr.getElementsByTagName('a:tc')) {
                const parts = [];
                for (const t of tc.getElementsByTagName('a:t')) {
                    if (t.textContent) parts.push(t.textContent);
                }
                row.push(parts.join(''));
            }
            if (row.length > 0) rows.push(row);
        }

        if (rows.length === 0) return null;

        const firstCellRPr = tbl.getElementsByTagName('a:rPr')[0];
        const fontSize = firstCellRPr ? _pptxParseSize(firstCellRPr.getAttribute('sz')) : 18;

        return {
            id: _pptxUid(), type: 'table',
            x, y, w, h, z: 1,
            data: { rows },
            style: { fontSize: fontSize || 18, color: 'var(--sl-text)' },
        };
    }

    // Chart detection — produce a labeled placeholder shape
    const graphicData = frame.getElementsByTagName('a:graphicData')[0];
    const chartRef = graphicData?.getElementsByTagName('c:chart')[0]
        || graphicData?.getElementsByTagName('cx:chart')[0];
    if (chartRef) {
        // Determine chart type hint from relationship
        const chartLabel = '📊 Chart (non importé)';
        return {
            id: _pptxUid(), type: 'shape',
            x, y, w, h, z: 1,
            data: { shape: 'rect', shapeType: 'rect', text: chartLabel },
            style: {
                fill: 'rgba(99,102,241,0.08)',
                opacity: 1,
                stroke: '#818cf8',
                strokeWidth: 2,
            },
        };
    }

    return null;
}

// ─── Image parser ────────────────────────────────────────────────────────────

async function _pptxParsePicture(pic, rIdToImage, ctx, offsetX, offsetY) {
    const xfrm = pic.getElementsByTagName('a:xfrm')[0];
    if (!xfrm) return null;

    const { x, y, w, h, rotate } = _pptxReadXfrm(xfrm, ctx, offsetX, offsetY);

    const blip = pic.getElementsByTagName('a:blip')[0];
    if (!blip) return null;

    const embedId = blip.getAttribute('r:embed');
    if (!embedId || !rIdToImage[embedId]) return null;

    const imgTarget = rIdToImage[embedId];
    const imgPath = _pptxResolveRelPath('ppt/slides/', imgTarget);

    if (ctx.imageCache[imgPath]) {
        return {
            id: _pptxUid(), type: 'image',
            x, y, w, h, z: 1,
            ...(rotate ? { style: { rotate } } : {}),
            data: { src: ctx.imageCache[imgPath], alt: imgPath.split('/').pop() },
        };
    }

    const imgFile = ctx.zip.file(imgPath);
    if (!imgFile) return null;

    try {
        const blob = await imgFile.async('base64');
        const ext = imgPath.split('.').pop().toLowerCase();
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', emf: 'image/x-emf', wmf: 'image/x-wmf', tif: 'image/tiff', tiff: 'image/tiff' };
        const mime = mimeMap[ext] || 'image/png';
        const dataUrl = `data:${mime};base64,${blob}`;
        ctx.imageCache[imgPath] = dataUrl;

        return {
            id: _pptxUid(), type: 'image',
            x, y, w, h, z: 1,
            ...(rotate ? { style: { rotate } } : {}),
            data: { src: dataUrl, alt: imgPath.split('/').pop() },
        };
    } catch {
        return null;
    }
}

// ─── Text body parser ────────────────────────────────────────────────────────

function _pptxParseTxBody(txBody, ctx, slideRels) {
    const paragraphs = [];
    let isList = false;
    const listItems = [];
    let isTitle = false;

    for (const p of txBody.getElementsByTagName('a:p')) {
        const pPr = _pptxFindDirectChild(p, 'a:pPr');

        // Bullet detection
        let hasBullet = false;
        if (pPr) {
            const buChar    = pPr.getElementsByTagName('a:buChar')[0];
            const buAutoNum = pPr.getElementsByTagName('a:buAutoNum')[0];
            const buFont    = pPr.getElementsByTagName('a:buFont')[0];
            const buNone    = pPr.getElementsByTagName('a:buNone')[0];
            if ((buChar || buAutoNum || buFont) && !buNone) hasBullet = true;
            const lvl = parseInt(pPr.getAttribute('lvl') || '0');
            if (lvl >= 1) hasBullet = true;
        }

        // Parse runs
        const runs = [];
        let paraFontSize = null, paraBold = false, paraItalic = false;
        let paraColor = null, paraFontFamily = null, paraAlign = null;

        if (pPr) {
            paraAlign = _pptxMapAlignment(pPr.getAttribute('algn'));
            const defRPr = pPr.getElementsByTagName('a:defRPr')[0];
            if (defRPr) {
                paraFontSize = _pptxParseSize(defRPr.getAttribute('sz')) || paraFontSize;
                paraBold = defRPr.getAttribute('b') === '1' || paraBold;
                paraColor = _pptxExtractColor(defRPr, ctx) || paraColor;
            }
        }

        for (const r of p.getElementsByTagName('a:r')) {
            const rPr = r.getElementsByTagName('a:rPr')[0];
            const t = r.getElementsByTagName('a:t')[0];
            if (!t?.textContent) continue;

            let bold = paraBold, italic = paraItalic, underline = false;
            let color = paraColor, fontSize = paraFontSize, fontFamily = paraFontFamily;

            if (rPr) {
                const sz = rPr.getAttribute('sz');
                if (sz) fontSize = _pptxParseSize(sz);
                if (rPr.getAttribute('b') === '1') bold = true;
                if (rPr.getAttribute('i') === '1') italic = true;
                if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') underline = true;
                const c = _pptxExtractColor(rPr, ctx);
                if (c) color = c;
                const latin = rPr.getElementsByTagName('a:latin')[0];
                if (latin) {
                    const tf = latin.getAttribute('typeface');
                    if (tf && !tf.startsWith('+')) fontFamily = _pptxMapFont(tf) || tf;
                }
            }

            // Hyperlink extraction
            let href = null;
            const hlinkClick = (rPr || r).getElementsByTagName('a:hlinkClick')[0];
            if (hlinkClick) {
                const hRid = hlinkClick.getAttribute('r:id');
                if (hRid && slideRels && slideRels[hRid]) {
                    href = slideRels[hRid];
                }
            }

            runs.push({ text: t.textContent, bold, italic, underline, color, fontSize, fontFamily, href });

            if (!paraFontSize && fontSize) paraFontSize = fontSize;
            if (bold) paraBold = true;
            if (italic) paraItalic = true;
            if (!paraColor && color) paraColor = color;
            if (!paraFontFamily && fontFamily) paraFontFamily = fontFamily;
        }

        const fullText = runs.map(r => r.text).join('');
        if (!fullText.trim()) continue;

        // Title heuristic
        if ((paraFontSize && paraFontSize >= 28) || (paraBold && paraFontSize >= 22)) {
            isTitle = true;
        }

        if (hasBullet) {
            isList = true;
            listItems.push(fullText.trim());
        }

        paragraphs.push({
            text: fullText, runs,
            fontSize: paraFontSize, bold: paraBold, italic: paraItalic,
            color: paraColor, fontFamily: paraFontFamily,
            align: paraAlign, isBullet: hasBullet,
        });
    }

    if (paragraphs.length > 0 && paragraphs.every(p => p.isBullet)) {
        isList = true;
    }

    return { paragraphs, isList, listItems, isTitle };
}

function _pptxParagraphsToHtml(paragraphs) {
    return paragraphs.map(p => {
        return p.runs.map(r => {
            let html = _pptxEscHtml(r.text);
            if (r.bold)      html = `<b>${html}</b>`;
            if (r.italic)    html = `<i>${html}</i>`;
            if (r.underline) html = `<u>${html}</u>`;
            if (r.color && !r.color.startsWith('var(')) {
                html = `<span style="color:${r.color}">${html}</span>`;
            }
            if (r.href) {
                html = `<a href="${_pptxEscHtml(r.href)}" target="_blank" rel="noopener">${html}</a>`;
            }
            return html;
        }).join('');
    }).join('<br>');
}

// ─── Background parser ──────────────────────────────────────────────────────

function _pptxParseBackground(bgEl, ctx) {
    const solidFill = bgEl.getElementsByTagName('a:solidFill')[0];
    if (solidFill) return _pptxExtractFillColor(solidFill, ctx) || undefined;

    const gradFill = bgEl.getElementsByTagName('a:gradFill')[0];
    if (gradFill) {
        const stops = [];
        for (const gs of gradFill.getElementsByTagName('a:gs')) {
            const pos = Math.round(parseInt(gs.getAttribute('pos') || '0') / 1000);
            const color = _pptxExtractFillColor(gs, ctx);
            if (color) stops.push(`${color} ${pos}%`);
        }
        if (stops.length >= 2) return `linear-gradient(135deg, ${stops.join(', ')})`;
    }

    return undefined;
}

async function _pptxParseBackgroundImage(bgEl, slideRels, ctx) {
    // Look for blip fill in p:bgPr
    const bgPr = bgEl.getElementsByTagName('p:bgPr')[0];
    if (!bgPr) return null;
    const blipFill = bgPr.getElementsByTagName('a:blipFill')[0];
    if (!blipFill) return null;
    const blip = blipFill.getElementsByTagName('a:blip')[0];
    if (!blip) return null;
    const embedId = blip.getAttribute('r:embed');
    if (!embedId || !slideRels[embedId]) return null;

    const imgTarget = slideRels[embedId];
    const imgPath = _pptxResolveRelPath('ppt/slides/', imgTarget);

    // Check cache
    if (ctx.imageCache[imgPath]) {
        return { bgImage: ctx.imageCache[imgPath], bgSize: 'cover' };
    }

    const imgFile = ctx.zip.file(imgPath);
    if (!imgFile) return null;

    try {
        const blob = await imgFile.async('base64');
        const ext = imgPath.split('.').pop().toLowerCase();
        const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
        const mime = mimeMap[ext] || 'image/png';
        const dataUrl = `data:${mime};base64,${blob}`;
        ctx.imageCache[imgPath] = dataUrl;

        // Determine sizing from stretch/tile
        let bgSize = 'cover';
        const stretch = blipFill.getElementsByTagName('a:stretch')[0];
        const tile = blipFill.getElementsByTagName('a:tile')[0];
        if (stretch) bgSize = 'cover';
        else if (tile) bgSize = 'contain';

        return { bgImage: dataUrl, bgSize };
    } catch {
        return null;
    }
}

// ─── Transform reader ────────────────────────────────────────────────────────

function _pptxReadXfrm(xfrm, ctx, offsetX, offsetY) {
    const off = xfrm.getElementsByTagName('a:off')[0];
    const ext = xfrm.getElementsByTagName('a:ext')[0];
    if (!off || !ext) return { x: 0, y: 0, w: 100, h: 50, rotate: 0 };

    const rawX = parseInt(off.getAttribute('x') || 0) + offsetX;
    const rawY = parseInt(off.getAttribute('y') || 0) + offsetY;
    const rawW = parseInt(ext.getAttribute('cx') || 0);
    const rawH = parseInt(ext.getAttribute('cy') || 0);

    let x = Math.round(rawX * _PPTX_EMU_TO_PX * ctx.scaleX);
    let y = Math.round(rawY * _PPTX_EMU_TO_PX * ctx.scaleY);
    let w = Math.round(rawW * _PPTX_EMU_TO_PX * ctx.scaleX);
    let h = Math.round(rawH * _PPTX_EMU_TO_PX * ctx.scaleY);

    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.max(20, Math.min(w, _PPTX_CANVAS_W - x));
    h = Math.max(10, Math.min(h, _PPTX_CANVAS_H - y));

    // Rotation (60,000ths of a degree → degrees)
    let rotate = 0;
    const rot = xfrm.getAttribute('rot');
    if (rot) {
        rotate = Math.round(parseInt(rot) / 60000);
        if (rotate === 360) rotate = 0;
    }

    return { x, y, w, h, rotate };
}

// ─── Color extraction ────────────────────────────────────────────────────────

function _pptxExtractColor(rPr, ctx) {
    if (!rPr) return null;
    const solidFill = rPr.getElementsByTagName('a:solidFill')[0];
    if (solidFill) return _pptxExtractFillColor(solidFill, ctx);
    return null;
}

function _pptxExtractFillColor(fillNode, ctx) {
    const srgb = fillNode.getElementsByTagName('a:srgbClr')[0];
    if (srgb) {
        let color = '#' + srgb.getAttribute('val');
        const tint  = srgb.getElementsByTagName('a:tint')[0];
        const shade = srgb.getElementsByTagName('a:shade')[0];
        const alpha = srgb.getElementsByTagName('a:alpha')[0];
        if (tint)  color = _pptxApplyTint(color, parseInt(tint.getAttribute('val') || '100000') / 100000);
        if (shade) color = _pptxApplyShade(color, parseInt(shade.getAttribute('val') || '100000') / 100000);
        if (alpha) {
            const a = parseInt(alpha.getAttribute('val') || '100000') / 100000;
            return _pptxHexToRgba(color, a);
        }
        return color;
    }

    const schemeClr = fillNode.getElementsByTagName('a:schemeClr')[0];
    if (schemeClr) {
        const val = schemeClr.getAttribute('val');
        const mapped = _pptxMapSchemeColor(val, ctx);
        if (mapped) {
            let color = mapped;
            const tint  = schemeClr.getElementsByTagName('a:tint')[0];
            const shade = schemeClr.getElementsByTagName('a:shade')[0];
            const alpha = schemeClr.getElementsByTagName('a:alpha')[0];
            if (tint)  color = _pptxApplyTint(color, parseInt(tint.getAttribute('val') || '100000') / 100000);
            if (shade) color = _pptxApplyShade(color, parseInt(shade.getAttribute('val') || '100000') / 100000);
            if (alpha) {
                const a = parseInt(alpha.getAttribute('val') || '100000') / 100000;
                return _pptxHexToRgba(color, a);
            }
            return color;
        }
    }

    return null;
}

function _pptxMapSchemeColor(val, ctx) {
    const map = {
        'tx1': ctx.themeColors.dk1, 'tx2': ctx.themeColors.dk2,
        'bg1': ctx.themeColors.lt1, 'bg2': ctx.themeColors.lt2,
        'dk1': ctx.themeColors.dk1, 'dk2': ctx.themeColors.dk2,
        'lt1': ctx.themeColors.lt1, 'lt2': ctx.themeColors.lt2,
        'accent1': ctx.themeColors.accent1, 'accent2': ctx.themeColors.accent2,
        'accent3': ctx.themeColors.accent3, 'accent4': ctx.themeColors.accent4,
        'accent5': ctx.themeColors.accent5, 'accent6': ctx.themeColors.accent6,
        'hlink': ctx.themeColors.hlink, 'folHlink': ctx.themeColors.folHlink,
    };
    return map[val] || null;
}

// ─── Shape fill/stroke extraction ────────────────────────────────────────────

function _pptxHasShapeFill(spPr) {
    if (!spPr) return false;
    if (spPr.getElementsByTagName('a:noFill')[0]) return false;
    return !!(spPr.getElementsByTagName('a:solidFill')[0]
        || spPr.getElementsByTagName('a:gradFill')[0]
        || spPr.getElementsByTagName('a:pattFill')[0]);
}

function _pptxHasShapeStroke(spPr) {
    if (!spPr) return false;
    const ln = spPr.getElementsByTagName('a:ln')[0];
    if (!ln) return false;
    return !ln.getElementsByTagName('a:noFill')[0];
}

function _pptxExtractShapeFill(spPr, ctx) {
    if (!spPr) return null;
    const solidFill = spPr.getElementsByTagName('a:solidFill')[0];
    if (solidFill) return _pptxExtractFillColor(solidFill, ctx);
    return null;
}

function _pptxExtractShapeOpacity(spPr) {
    if (!spPr) return null;
    const solidFill = spPr.getElementsByTagName('a:solidFill')[0];
    if (!solidFill) return null;
    const clrNode = solidFill.getElementsByTagName('a:srgbClr')[0] || solidFill.getElementsByTagName('a:schemeClr')[0];
    if (!clrNode) return null;
    const alpha = clrNode.getElementsByTagName('a:alpha')[0];
    if (alpha) return parseInt(alpha.getAttribute('val') || '100000') / 100000;
    return null;
}

function _pptxExtractShapeStroke(spPr, ctx) {
    if (!spPr) return null;
    const ln = spPr.getElementsByTagName('a:ln')[0];
    if (!ln || ln.getElementsByTagName('a:noFill')[0]) return null;
    const w = parseInt(ln.getAttribute('w') || '12700');
    const widthPx = Math.max(1, Math.round(w / _PPTX_EMU_PER_PT));
    const solidFill = ln.getElementsByTagName('a:solidFill')[0];
    const color = solidFill ? _pptxExtractFillColor(solidFill, ctx) : null;
    return { color: color || '#888888', width: widthPx };
}

// ─── Geometry mapping ────────────────────────────────────────────────────────

function _pptxMapGeometry(prst) {
    const map = {
        'rect': 'rect', 'roundRect': 'rounded-rect',
        'ellipse': 'ellipse', 'triangle': 'triangle',
        'diamond': 'diamond', 'hexagon': 'hexagon',
        'star5': 'star', 'star4': 'star', 'star6': 'star', 'star8': 'star',
        'rightArrow': 'arrow-right', 'leftArrow': 'arrow-left',
        'upArrow': 'arrow-up', 'downArrow': 'arrow-down',
        'flowChartProcess': 'rect', 'flowChartDecision': 'diamond',
        'flowChartTerminator': 'rounded-rect', 'flowChartConnector': 'ellipse',
    };
    return map[prst] || 'rect';
}

// ─── Helper utilities ────────────────────────────────────────────────────────

function _pptxHasVisibleText(txBody) {
    for (const t of txBody.getElementsByTagName('a:t')) {
        if (t.textContent?.trim()) return true;
    }
    return false;
}

function _pptxFindDirectChild(parent, tagName) {
    if (!parent) return null;
    for (const child of parent.children) {
        if (child.tagName === tagName || child.nodeName === tagName) return child;
    }
    return null;
}

function _pptxParseSize(sz) {
    if (!sz) return null;
    return Math.round(parseInt(sz) / 100);
}

function _pptxMapFont(typeface) {
    if (!typeface) return null;
    return _PPTX_FONT_MAP[typeface.toLowerCase()] || null;
}

function _pptxMapAlignment(algn) {
    if (!algn) return null;
    const map = { 'l': 'left', 'ctr': 'center', 'r': 'right', 'just': 'justify' };
    return map[algn] || null;
}

function _pptxResolveRelPath(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const combined = base + target;
    const parts = combined.split('/');
    const resolved = [];
    for (const p of parts) {
        if (p === '..') resolved.pop();
        else if (p !== '.') resolved.push(p);
    }
    return resolved.join('/');
}

function _pptxEscHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function _pptxReadXml(zip, path) {
    const file = zip.file(path);
    if (!file) return null;
    try {
        const text = await file.async('string');
        return new DOMParser().parseFromString(text, 'application/xml');
    } catch {
        return null;
    }
}

// ─── Color utilities ─────────────────────────────────────────────────────────

function _pptxHexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
    };
}

function _pptxRgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function _pptxHexToRgba(hex, alpha) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

function _pptxLuminance(hex) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function _pptxLighten(hex, amount) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return _pptxRgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function _pptxDarken(hex, amount) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return _pptxRgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function _pptxMixColor(hex1, hex2, ratio) {
    const c1 = _pptxHexToRgb(hex1);
    const c2 = _pptxHexToRgb(hex2);
    return _pptxRgbToHex(
        c1.r * (1 - ratio) + c2.r * ratio,
        c1.g * (1 - ratio) + c2.g * ratio,
        c1.b * (1 - ratio) + c2.b * ratio,
    );
}

function _pptxAlphaColor(hex, alpha) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

function _pptxApplyTint(hex, factor) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return _pptxRgbToHex(
        r + (255 - r) * (1 - factor),
        g + (255 - g) * (1 - factor),
        b + (255 - b) * (1 - factor),
    );
}

function _pptxApplyShade(hex, factor) {
    const { r, g, b } = _pptxHexToRgb(hex);
    return _pptxRgbToHex(r * factor, g * factor, b * factor);
}

window.importPowerPoint = importPowerPoint;
