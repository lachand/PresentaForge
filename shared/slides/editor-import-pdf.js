/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-import-pdf
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-import-pdf.js"></script>
 */
/* editor-import-pdf.js — Import PDF into the editor
 *
 *  Converts each PDF page into a canvas slide with one image element.
 *  - Keeps page aspect ratio and centers content in 1280x720.
 *  - Works from a local file without backend.
 */

const _PDF_CANVAS_W = 1280;
const _PDF_CANVAS_H = 720;
let _pdfJsLoadPromise = null;

async function _ensurePdfJsLib() {
    if (window.pdfjsLib?.getDocument) return window.pdfjsLib;
    if (_pdfJsLoadPromise) return _pdfJsLoadPromise;

    const sources = [
        {
            script: '../vendor/pdfjs/3.11.174/pdf.min.js',
            worker: '../vendor/pdfjs/3.11.174/pdf.worker.min.js',
        },
        {
            script: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
            worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
        },
        {
            script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
        },
    ];

    const loadScript = src => new Promise((resolve, reject) => {
        const existing = Array.from(document.scripts).find(s => s.src === src);
        if (existing && window.pdfjsLib?.getDocument) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Chargement échoué: ${src}`));
        document.head.appendChild(script);
    });

    _pdfJsLoadPromise = (async () => {
        let lastError = null;
        for (const source of sources) {
            try {
                await loadScript(source.script);
                if (!window.pdfjsLib?.getDocument) throw new Error('API pdfjsLib indisponible');
                if (window.pdfjsLib.GlobalWorkerOptions) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = source.worker;
                }
                return window.pdfjsLib;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('Impossible de charger PDF.js');
    })();

    try {
        return await _pdfJsLoadPromise;
    } finally {
        _pdfJsLoadPromise = null;
    }
}

function _pdfSlideId(pageNum) {
    return `pdf_${Date.now().toString(36)}_${pageNum.toString(36)}`;
}

async function _parsePdfToSlides(file, pdfjsLib) {
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buf),
        useWorkerFetch: true,
        isEvalSupported: false,
    });
    const pdfDoc = await loadingTask.promise;
    const pageCount = Number(pdfDoc.numPages || 0);
    if (!pageCount) throw new Error('Le fichier PDF ne contient aucune page exploitable.');

    if (pageCount > 80) {
        const msg = `Ce PDF contient ${pageCount} pages. Continuer l'import ?`;
        const ok = window.OEIDialog?.confirm
            ? await window.OEIDialog.confirm(msg)
            : window.confirm(msg);
        if (!ok) throw new Error('Import PDF annulé');
    }

    const slides = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        if (pageNum === 1 || pageNum === pageCount || pageNum % 5 === 0) {
            notify(`Import PDF: page ${pageNum}/${pageCount}…`, 'warning');
        }

        const page = await pdfDoc.getPage(pageNum);
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(_PDF_CANVAS_W / baseViewport.width, _PDF_CANVAS_H / baseViewport.height);
        const renderScale = Math.max(0.2, Math.min(fitScale, 2));
        const viewport = page.getViewport({ scale: renderScale });

        const width = Math.max(1, Math.round(viewport.width));
        const height = Math.max(1, Math.round(viewport.height));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx2d = canvas.getContext('2d', { alpha: false });
        await page.render({ canvasContext: ctx2d, viewport, background: '#ffffff' }).promise;

        const src = canvas.toDataURL('image/jpeg', 0.92);
        const x = Math.round((_PDF_CANVAS_W - width) / 2);
        const y = Math.round((_PDF_CANVAS_H - height) / 2);
        slides.push({
            type: 'canvas',
            elements: [{
                id: _pdfSlideId(pageNum),
                type: 'image',
                x,
                y,
                w: width,
                h: height,
                z: 1,
                data: {
                    src,
                    alt: `Page ${pageNum} — ${file.name}`,
                },
                style: {},
            }],
            notes: `Import PDF — page ${pageNum}/${pageCount}`,
        });
    }

    const now = new Date().toISOString().slice(0, 10);
    const baseTitle = file.name.replace(/\.pdf$/i, '') || 'Import PDF';
    return {
        metadata: {
            title: baseTitle,
            author: '',
            aspect: '16:9',
            created: now,
            modified: now,
            version: '1.0',
        },
        theme: editor?.data?.theme || 'dark',
        slides,
    };
}

async function importPDF() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,application/pdf';

    return new Promise(resolve => {
        input.onchange = async event => {
            const file = event.target.files?.[0];
            if (!file) return resolve(false);

            notify('Import PDF en cours…', 'warning');
            try {
                const pdfjsLib = await _ensurePdfJsLib();
                const data = await _parsePdfToSlides(file, pdfjsLib);
                editor.load(data);
                notify(`Importé : ${data.slides.length} slides depuis ${file.name}`, 'success');
                resolve(true);
            } catch (err) {
                console.error('PDF import error:', err);
                notify(`Erreur import PDF : ${err?.message || err}`, 'error');
                resolve(false);
            }
        };
        input.click();
    });
}
