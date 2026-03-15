/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-enhancements
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-enhancements.js"></script>
 */
/* editor-enhancements.js — Assets manager, design tokens, widget plugins manager */
const _enhRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
const _enhReadLegacyCanvasEditor = () => {
    try {
        return typeof canvasEditor !== 'undefined' ? canvasEditor : null;
    } catch (_) {
        return null;
    }
};
const _enhCtx = () => {
    if (_enhRuntime?.resolveContext) {
        return _enhRuntime.resolveContext({
            editor,
            notify,
            esc,
            canvasEditor: window.canvasEditor || _enhReadLegacyCanvasEditor(),
        });
    }
    return {
        editor,
        notify,
        esc,
        canvasEditor: window.canvasEditor || _enhReadLegacyCanvasEditor(),
    };
};
const _enhEditor = () => _enhCtx().editor;
const _enhNotify = (message, type = '') => {
    const fn = _enhCtx().notify;
    if (typeof fn === 'function') fn(message, type);
};
const _enhEsc = value => {
    const fn = _enhCtx().esc;
    if (typeof fn === 'function') return fn(value);
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
const _enhEscAttr = value => _enhEsc(value).replace(/"/g, '&quot;');

function _eeCollectAssets(data) {
    const assets = [];
    const slides = data?.slides || [];
    const push = entry => assets.push({ id: `a${assets.length + 1}`, ...entry });
    slides.forEach((slide, slideIndex) => {
        const slideNo = slideIndex + 1;
        if (typeof slide?.bgImage === 'string' && slide.bgImage.trim()) {
            push({ kind: 'bgImage', slideIndex, label: `Slide ${slideNo} — fond`, url: slide.bgImage.trim() });
        }
        if (slide?.type === 'image' && typeof slide?.src === 'string' && slide.src.trim()) {
            push({ kind: 'slideImage', slideIndex, label: `Slide ${slideNo} — image`, url: slide.src.trim() });
        }
        if (slide?.type === 'canvas' && Array.isArray(slide.elements)) {
            for (const el of slide.elements) {
                if (!el) continue;
                if (el.type === 'image' && typeof el.data?.src === 'string' && el.data.src.trim()) {
                    push({ kind: 'canvasImage', slideIndex, elementId: el.id, label: `Slide ${slideNo} — image canvas`, url: el.data.src.trim() });
                }
                if (el.type === 'video') {
                    const src = typeof el.data?.src === 'string' ? el.data.src.trim() : '';
                    const embedUrl = typeof el.data?.embedUrl === 'string' ? el.data.embedUrl.trim() : '';
                    if (src) push({ kind: 'videoSrc', slideIndex, elementId: el.id, label: `Slide ${slideNo} — vidéo`, url: src });
                    if (embedUrl) push({ kind: 'videoEmbed', slideIndex, elementId: el.id, label: `Slide ${slideNo} — vidéo embed`, url: embedUrl });
                }
                if (el.type === 'iframe' && typeof el.data?.url === 'string' && el.data.url.trim()) {
                    push({ kind: 'iframe', slideIndex, elementId: el.id, label: `Slide ${slideNo} — iframe`, url: el.data.url.trim() });
                }
            }
        }
    });
    return assets;
}

function _eeSetAssetUrl(asset, nextUrl, activeEditor = _enhEditor()) {
    const slide = activeEditor?.data?.slides?.[asset.slideIndex];
    if (!slide) return false;
    const clean = String(nextUrl || '').trim();
    if (!clean) return false;
    if (asset.kind === 'bgImage') { slide.bgImage = clean; return true; }
    if (asset.kind === 'slideImage') { slide.src = clean; return true; }
    const el = (slide.elements || []).find(e => e.id === asset.elementId);
    if (!el) return false;
    if (asset.kind === 'canvasImage') { el.data = el.data || {}; el.data.src = clean; return true; }
    if (asset.kind === 'videoSrc') { el.data = el.data || {}; el.data.src = clean; return true; }
    if (asset.kind === 'videoEmbed') { el.data = el.data || {}; el.data.embedUrl = clean; return true; }
    if (asset.kind === 'iframe') { el.data = el.data || {}; el.data.url = clean; return true; }
    return false;
}

function _eeReplaceAssetUrlEverywhere(data, previousUrl, nextUrl) {
    const from = String(previousUrl || '').trim();
    const to = String(nextUrl || '').trim();
    if (!from || !to || from === to) return 0;
    const assets = _eeCollectAssets(data);
    let changed = 0;
    assets.forEach(asset => {
        if (asset.url !== from) return;
        if (_eeSetAssetUrl(asset, to)) changed += 1;
    });
    return changed;
}

function _eeEstimateAssetBytes(url) {
    const val = String(url || '');
    if (!val) return 0;
    if (/^data:/i.test(val)) {
        const idx = val.indexOf(',');
        if (idx === -1) return val.length;
        const b64 = val.slice(idx + 1);
        return Math.floor((b64.length * 3) / 4);
    }
    return val.length;
}

function _eeFormatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
    return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

async function _eeOptimizeDataImageUrl(url, options = {}) {
    const source = String(url || '');
    if (!/^data:image\//i.test(source)) return null;
    const maxSide = Math.max(320, Number(options.maxSide) || 1920);
    const quality = Math.max(0.5, Math.min(0.95, Number(options.quality) || 0.82));
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image data URI invalide'));
        img.src = source;
    });
    const srcW = Math.max(1, img.naturalWidth || img.width || 1);
    const srcH = Math.max(1, img.naturalHeight || img.height || 1);
    const ratio = Math.min(1, maxSide / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * ratio));
    const dstH = Math.max(1, Math.round(srcH * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const webp = canvas.toDataURL('image/webp', quality);
    const jpeg = canvas.toDataURL('image/jpeg', Math.min(0.9, quality + 0.05));
    const best = [webp, jpeg].sort((a, b) => a.length - b.length)[0] || '';
    if (!best || best.length >= source.length) return null;
    return best;
}

async function _eeFetchUrlAsDataUrl(url) {
    const src = String(url || '').trim();
    if (!/^https?:\/\//i.test(src)) throw new Error('URL web attendue (http/https)');
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(new Error('Conversion data URI impossible'));
        fr.readAsDataURL(blob);
    });
}

function openAssetsManager() {
    const activeEditor = _enhEditor();
    if (!activeEditor?.data) return;
    let modal = document.getElementById('assets-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'assets-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal" style="max-width:980px;max-height:86vh;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px">
                <span class="modal-title" style="margin:0;flex:1">Gestionnaire d’assets</span>
                <button class="modal-close" data-ee-close>✕</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <input id="assets-search" type="text" placeholder="Filtrer URL/type/slide" style="flex:1;min-width:240px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:7px 10px;font-size:0.8rem">
                <button class="tb-btn ui-btn" id="assets-refresh" style="height:32px">Actualiser</button>
                <button class="tb-btn ui-btn" id="assets-duplicates" style="height:32px">Doublons</button>
                <button class="tb-btn ui-btn" id="assets-compress-data" style="height:32px">Optimiser data URI</button>
                <button class="tb-btn ui-btn" id="assets-embed-http" style="height:32px">Intégrer URL web</button>
                <button class="tb-btn ui-btn" id="assets-add-svg-url" style="height:32px">Ajouter SVG URL</button>
            </div>
            <div id="assets-stats" style="font-size:0.75rem;color:var(--muted)"></div>
            <div id="assets-table" style="border:1px solid var(--border);border-radius:8px;overflow:auto;max-height:58vh"></div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal || e.target?.dataset?.eeClose !== undefined) modal.style.display = 'none'; });
    }

    const state = { assets: _eeCollectAssets(activeEditor.data), search: '', onlyDuplicates: false };
    const elSearch = modal.querySelector('#assets-search');
    const elStats = modal.querySelector('#assets-stats');
    const elTable = modal.querySelector('#assets-table');

    const render = () => {
        const q = state.search.trim().toLowerCase();
        const duplicateCountMap = new Map();
        state.assets.forEach(asset => {
            duplicateCountMap.set(asset.url, (duplicateCountMap.get(asset.url) || 0) + 1);
        });
        const duplicateUrlSet = new Set([...duplicateCountMap.entries()].filter(([, n]) => n > 1).map(([url]) => url));
        const rows = state.assets.filter(asset => {
            if (state.onlyDuplicates && !duplicateUrlSet.has(asset.url)) return false;
            if (!q) return true;
            return (`${asset.kind} ${asset.label} ${asset.url}`).toLowerCase().includes(q);
        });
        const dataUriCount = rows.filter(a => String(a.url).startsWith('data:')).length;
        const httpCount = rows.filter(a => /^https?:\/\//i.test(a.url)).length;
        const localCount = rows.length - dataUriCount - httpCount;
        const totalBytes = rows.reduce((sum, asset) => sum + _eeEstimateAssetBytes(asset.url), 0);
        const duplicateAssetsCount = rows.filter(asset => duplicateUrlSet.has(asset.url)).length;
        const mode = state.onlyDuplicates ? ' · filtre doublons' : '';
        elStats.textContent = `${rows.length} assets${mode} • ${httpCount} URL web • ${localCount} locaux • ${dataUriCount} data URI • ${duplicateAssetsCount} doublons • ${_eeFormatBytes(totalBytes)} approx`;
        if (!rows.length) {
            elTable.innerHTML = '<div style="padding:16px;color:var(--muted)">Aucun asset trouvé</div>';
            return;
        }
        elTable.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.76rem">
            <thead style="position:sticky;top:0;background:var(--panel);z-index:1">
                <tr>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Slide</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Type</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Taille</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">URL</th>
                    <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(a => `<tr data-asset-id="${a.id}">
                    <td style="padding:8px;border-bottom:1px solid var(--border-subtle)">#${a.slideIndex + 1}</td>
                    <td style="padding:8px;border-bottom:1px solid var(--border-subtle)">${a.kind}</td>
                    <td style="padding:8px;border-bottom:1px solid var(--border-subtle);white-space:nowrap">${_eeFormatBytes(_eeEstimateAssetBytes(a.url))}</td>
                    <td style="padding:8px;border-bottom:1px solid var(--border-subtle);max-width:460px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${_enhEscAttr(a.url)}">${_enhEsc(a.url)}</td>
                    <td style="padding:8px;border-bottom:1px solid var(--border-subtle);display:flex;gap:6px;flex-wrap:wrap">
                        <button class="tb-btn ui-btn" data-act="goto" style="height:26px;padding:0 8px;font-size:0.7rem">Aller</button>
                        <button class="tb-btn ui-btn" data-act="copy" style="height:26px;padding:0 8px;font-size:0.7rem">Copier</button>
                        <button class="tb-btn ui-btn" data-act="replace" style="height:26px;padding:0 8px;font-size:0.7rem">Remplacer</button>
                        <button class="tb-btn ui-btn" data-act="replace-all" style="height:26px;padding:0 8px;font-size:0.7rem">Partout</button>
                        ${/^https?:\/\//i.test(a.url) ? '<button class="tb-btn ui-btn" data-act="embed" style="height:26px;padding:0 8px;font-size:0.7rem">Intégrer</button>' : ''}
                        ${/^data:image\//i.test(a.url) ? '<button class="tb-btn ui-btn" data-act="optimize" style="height:26px;padding:0 8px;font-size:0.7rem">Optimiser</button>' : ''}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;
        elTable.querySelectorAll('tr[data-asset-id]').forEach(row => {
            const asset = rows.find(a => a.id === row.dataset.assetId);
            if (!asset) return;
            row.querySelector('[data-act="goto"]')?.addEventListener('click', () => activeEditor.selectSlide(asset.slideIndex));
            row.querySelector('[data-act="copy"]')?.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(asset.url);
                    _enhNotify('URL copiée', 'success');
                } catch (_) {
                    _enhNotify('Impossible de copier l’URL', 'error');
                }
            });
            row.querySelector('[data-act="replace"]')?.addEventListener('click', () => {
                const next = prompt('Nouvelle URL de l’asset :', asset.url);
                if (!next || next === asset.url) return;
                if (_eeSetAssetUrl(asset, next, activeEditor)) {
                    activeEditor._push();
                    onUpdate('slide-update');
                    state.assets = _eeCollectAssets(activeEditor.data);
                    render();
                    _enhNotify('Asset mis à jour', 'success');
                } else {
                    _enhNotify('Mise à jour impossible', 'error');
                }
            });
            row.querySelector('[data-act="replace-all"]')?.addEventListener('click', () => {
                const next = prompt('Remplacer toutes les occurrences de cette URL par :', asset.url);
                if (!next || next === asset.url) return;
                const changed = _eeReplaceAssetUrlEverywhere(activeEditor.data, asset.url, next);
                if (changed > 0) {
                    activeEditor._push();
                    onUpdate('slide-update');
                    state.assets = _eeCollectAssets(activeEditor.data);
                    render();
                    _enhNotify(`${changed} occurrence(s) mises à jour`, 'success');
                } else {
                    _enhNotify('Aucune occurrence remplacée', 'info');
                }
            });
            row.querySelector('[data-act="embed"]')?.addEventListener('click', async () => {
                try {
                    const dataUrl = await _eeFetchUrlAsDataUrl(asset.url);
                    if (!dataUrl) throw new Error('Conversion vide');
                    if (_eeSetAssetUrl(asset, dataUrl, activeEditor)) {
                        activeEditor._push();
                        onUpdate('slide-update');
                        state.assets = _eeCollectAssets(activeEditor.data);
                        render();
                        _enhNotify('Asset intégré en data URI', 'success');
                    }
                } catch (err) {
                    _enhNotify(`Intégration impossible: ${err?.message || 'erreur réseau/CORS'}`, 'error');
                }
            });
            row.querySelector('[data-act="optimize"]')?.addEventListener('click', async () => {
                try {
                    const optimized = await _eeOptimizeDataImageUrl(asset.url);
                    if (!optimized || optimized === asset.url) {
                        _enhNotify('Aucun gain détecté pour cet asset', 'info');
                        return;
                    }
                    if (_eeSetAssetUrl(asset, optimized, activeEditor)) {
                        activeEditor._push();
                        onUpdate('slide-update');
                        state.assets = _eeCollectAssets(activeEditor.data);
                        render();
                        _enhNotify('Asset optimisé', 'success');
                    }
                } catch (err) {
                    _enhNotify(`Optimisation impossible: ${err?.message || 'erreur'}`, 'error');
                }
            });
        });
    };

    const refreshBtn = modal.querySelector('#assets-refresh');
    if (refreshBtn) refreshBtn.onclick = () => {
        state.assets = _eeCollectAssets(activeEditor.data);
        render();
    };
    const dupBtn = modal.querySelector('#assets-duplicates');
    if (dupBtn) dupBtn.onclick = () => {
        state.onlyDuplicates = !state.onlyDuplicates;
        dupBtn.textContent = state.onlyDuplicates ? 'Tous assets' : 'Doublons';
        render();
    };
    const optimizeBtn = modal.querySelector('#assets-compress-data');
    if (optimizeBtn) optimizeBtn.onclick = async () => {
        const candidates = state.assets.filter(asset => /^data:image\//i.test(String(asset.url || '')));
        if (!candidates.length) {
            _enhNotify('Aucun asset data URI image à optimiser', 'info');
            return;
        }
        let changed = 0;
        for (const asset of candidates) {
            try {
                const optimized = await _eeOptimizeDataImageUrl(asset.url);
                if (!optimized || optimized === asset.url) continue;
                if (_eeSetAssetUrl(asset, optimized, activeEditor)) changed += 1;
            } catch (_) {}
        }
        if (changed > 0) {
            activeEditor._push();
            onUpdate('slide-update');
            state.assets = _eeCollectAssets(activeEditor.data);
            render();
            _enhNotify(`Optimisation terminée: ${changed} asset(s)`, 'success');
        } else {
            _enhNotify('Optimisation terminée: aucun gain mesurable', 'info');
        }
    };
    const embedBtn = modal.querySelector('#assets-embed-http');
    if (embedBtn) embedBtn.onclick = async () => {
        const candidates = state.assets.filter(asset => /^https?:\/\//i.test(String(asset.url || '')));
        if (!candidates.length) {
            _enhNotify('Aucune URL web à intégrer', 'info');
            return;
        }
        let changed = 0;
        for (const asset of candidates) {
            try {
                const dataUrl = await _eeFetchUrlAsDataUrl(asset.url);
                if (!dataUrl) continue;
                if (_eeSetAssetUrl(asset, dataUrl, activeEditor)) changed += 1;
            } catch (_) {}
        }
        if (changed > 0) {
            activeEditor._push();
            onUpdate('slide-update');
            state.assets = _eeCollectAssets(activeEditor.data);
            render();
            _enhNotify(`Intégration URL web: ${changed} asset(s)`, 'success');
        } else {
            _enhNotify('Intégration URL web: aucun asset converti', 'warning');
        }
    };
    const addSvgBtn = modal.querySelector('#assets-add-svg-url');
    if (addSvgBtn) addSvgBtn.onclick = async () => {
        const url = prompt('URL SVG à importer dans le slide canvas courant :', 'https://');
        if (!url || !/^https?:\/\//i.test(url.trim())) return;
        const runtimeCanvasEditor = _enhCtx().canvasEditor;
        if (activeEditor.currentSlide?.type !== 'canvas' || !runtimeCanvasEditor) {
            _enhNotify('Passez sur un slide canvas pour insérer un SVG', 'warning');
            return;
        }
        try {
            const dataUrl = await _eeFetchUrlAsDataUrl(url.trim());
            const alt = prompt('Texte alternatif (accessibilité) :', 'Icône SVG') || 'Icône SVG';
            const el = runtimeCanvasEditor.add('image');
            runtimeCanvasEditor.updateData(el.id, { data: { src: dataUrl, alt } });
            _enhNotify('SVG intégré au canvas courant', 'success');
        } catch (err) {
            _enhNotify(`Import SVG impossible: ${err?.message || 'erreur réseau/CORS'}`, 'error');
        }
    };
    if (elSearch) elSearch.oninput = () => {
        state.search = elSearch.value;
        render();
    };

    modal.style.display = 'flex';
    render();
}

function openDesignTokensManager() {
    const activeEditor = _enhEditor();
    if (!activeEditor?.data) return;
    let modal = document.getElementById('design-tokens-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'design-tokens-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal" style="max-width:760px;max-height:86vh;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px">
                <span class="modal-title" style="margin:0;flex:1">Design Tokens Globaux</span>
                <button class="modal-close" data-dt-close>✕</button>
            </div>
            <div id="dt-form" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
                <button class="tb-btn ui-btn" id="dt-reset">Réinitialiser</button>
                <button class="tb-btn ui-btn primary ui-btn--primary" id="dt-save">Sauvegarder</button>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal || e.target?.dataset?.dtClose !== undefined) modal.style.display = 'none'; });
    }

    const norm = window.OEIDesignTokens?.normalize
        ? window.OEIDesignTokens.normalize(activeEditor.data?.designTokens || {})
        : { colors: {}, fonts: {}, layout: { radius: 12, contentPaddingX: 48, contentPaddingY: 40, bodyLineHeight: 1.45 } };

    const form = modal.querySelector('#dt-form');
    form.innerHTML = `
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Couleurs</div>
            ${['primary', 'accent', 'heading', 'text', 'slideBg', 'bg'].map(key => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
                <label style="width:82px;font-size:0.72rem;color:var(--muted)">${key}</label>
                <input type="text" data-dt-color="${key}" value="${_enhEscAttr(norm.colors[key] || '')}" placeholder="vide = thème" style="flex:1;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:0.74rem">
            </div>`).join('')}
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Polices</div>
            ${['heading', 'body', 'mono'].map(key => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
                <label style="width:82px;font-size:0.72rem;color:var(--muted)">${key}</label>
                <input type="text" data-dt-font="${key}" value="${_enhEscAttr(norm.fonts[key] || '')}" placeholder="pile CSS" style="flex:1;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:0.74rem">
            </div>`).join('')}
        </div>
        <div style="grid-column:1/-1;border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Layout global</div>
            <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
                <div><label style="display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px">Rayon (px)</label><input type="number" data-dt-layout="radius" value="${norm.layout.radius}" min="0" max="80" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:.74rem"></div>
                <div><label style="display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px">Padding X</label><input type="number" data-dt-layout="contentPaddingX" value="${norm.layout.contentPaddingX}" min="0" max="180" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:.74rem"></div>
                <div><label style="display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px">Padding Y</label><input type="number" data-dt-layout="contentPaddingY" value="${norm.layout.contentPaddingY}" min="0" max="140" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:.74rem"></div>
                <div><label style="display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px">Interligne</label><input type="number" step="0.05" data-dt-layout="bodyLineHeight" value="${norm.layout.bodyLineHeight}" min="1.1" max="2.2" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:.74rem"></div>
            </div>
        </div>`;

    const saveBtn = modal.querySelector('#dt-save');
    if (saveBtn) saveBtn.onclick = () => {
        const draft = { colors: {}, fonts: {}, layout: {} };
        modal.querySelectorAll('[data-dt-color]').forEach(inp => {
            const key = inp.dataset.dtColor;
            const val = String(inp.value || '').trim();
            if (val) draft.colors[key] = val;
        });
        modal.querySelectorAll('[data-dt-font]').forEach(inp => {
            const key = inp.dataset.dtFont;
            const val = String(inp.value || '').trim();
            if (val) draft.fonts[key] = val;
        });
        modal.querySelectorAll('[data-dt-layout]').forEach(inp => {
            const key = inp.dataset.dtLayout;
            draft.layout[key] = Number(inp.value);
        });
        activeEditor.data.designTokens = window.OEIDesignTokens?.normalize
            ? window.OEIDesignTokens.normalize(draft)
            : draft;
        activeEditor._push();
        onUpdate('slide-update');
        modal.style.display = 'none';
        _enhNotify('Design tokens sauvegardés', 'success');
    };
    const resetBtn = modal.querySelector('#dt-reset');
    if (resetBtn) resetBtn.onclick = () => {
        delete activeEditor.data.designTokens;
        activeEditor._push();
        onUpdate('slide-update');
        modal.style.display = 'none';
        _enhNotify('Design tokens réinitialisés', 'info');
    };

    modal.style.display = 'flex';
}

function openWidgetPluginsManager() {
    let modal = document.getElementById('widget-plugins-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'widget-plugins-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal" style="max-width:900px;max-height:86vh;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px">
                <span class="modal-title" style="margin:0;flex:1">Plugins Widgets</span>
                <button class="modal-close" data-plug-close>✕</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;min-height:0">
                <div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px">
                    <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Installer un manifest JSON</div>
                    <textarea id="plugin-manifest-input" placeholder='{"id":"my-plugin","name":"Mon plugin","widgets":[...]}' style="min-height:220px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px;font-size:0.74rem;font-family:var(--mono)"></textarea>
                    <div style="display:flex;gap:8px;justify-content:flex-end">
                        <button class="tb-btn ui-btn" id="plugin-manifest-file">Importer fichier</button>
                        <button class="tb-btn ui-btn primary ui-btn--primary" id="plugin-install">Installer / Mettre à jour</button>
                    </div>
                </div>
                <div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:0">
                    <div style="border:1px solid var(--border-subtle);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:7px">
                        <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Politique de confiance</div>
                        <label style="font-size:0.74rem;color:var(--text);display:flex;align-items:center;gap:6px">
                            <input type="checkbox" id="plugin-policy-allow-remote">
                            Autoriser les scripts distants
                        </label>
                        <textarea id="plugin-policy-origins" placeholder="https://cdn.example.org" style="min-height:58px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:0.72rem;font-family:var(--mono)"></textarea>
                        <div style="display:flex;justify-content:flex-end;gap:8px">
                            <button class="tb-btn ui-btn" id="plugin-policy-save">Appliquer</button>
                        </div>
                        <div id="plugin-policy-state" style="font-size:0.7rem;color:var(--muted)"></div>
                    </div>
                    <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Plugins installés</div>
                    <div id="plugin-list" style="overflow:auto;min-height:220px"></div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal || e.target?.dataset?.plugClose !== undefined) modal.style.display = 'none'; });
    }

    const renderList = () => {
        const host = modal.querySelector('#plugin-list');
        const policyState = modal.querySelector('#plugin-policy-state');
        const policyAllow = modal.querySelector('#plugin-policy-allow-remote');
        const policyOrigins = modal.querySelector('#plugin-policy-origins');
        const inspect = window.OEIWidgetPlugins?.inspect ? window.OEIWidgetPlugins.inspect() : null;
        const plugins = inspect?.plugins || (window.OEIWidgetPlugins?.list ? window.OEIWidgetPlugins.list() : []);
        const policy = inspect?.policy || (window.OEIWidgetPlugins?.getPolicy ? window.OEIWidgetPlugins.getPolicy() : { allowRemoteScripts: false, trustedOrigins: [] });

        if (policyAllow) policyAllow.checked = policy.allowRemoteScripts === true;
        if (policyOrigins) policyOrigins.value = Array.isArray(policy.trustedOrigins) ? policy.trustedOrigins.join('\n') : '';
        if (policyState) {
            const originsCount = Array.isArray(policy.trustedOrigins) ? policy.trustedOrigins.length : 0;
            policyState.textContent = policy.allowRemoteScripts
                ? `Scripts distants autorisés (${originsCount} origine(s) approuvée(s))`
                : 'Scripts distants bloqués (mode recommandé)';
        }

        if (!plugins.length) {
            host.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;padding:6px 4px">Aucun plugin installé</div>';
            return;
        }

        const statusMeta = (status) => {
            if (status === 'blocked') return { label: 'Bloqué', fg: '#ef4444', bg: 'rgba(239,68,68,0.12)', bd: 'rgba(239,68,68,0.32)' };
            if (status === 'disabled') return { label: 'Désactivé', fg: 'var(--muted)', bg: 'transparent', bd: 'var(--border)' };
            return { label: 'Autorisé', fg: '#22c55e', bg: 'rgba(34,197,94,0.1)', bd: 'rgba(34,197,94,0.3)' };
        };

        host.innerHTML = plugins.map(p => {
            const status = String(p.runtimeStatus || (p.enabled === false ? 'disabled' : 'allowed'));
            const meta = statusMeta(status);
            const blocked = Array.isArray(p.runtimeBlockedWidgets) ? p.runtimeBlockedWidgets : [];
            const blockedText = blocked.length ? ` · ${blocked.length} bloqué(s)` : '';
            const allowedCount = Number.isFinite(p.runtimeAllowedWidgets) ? p.runtimeAllowedWidgets : (p.widgets || []).length;
            const blockedReason = blocked[0]?.message ? `<div style="margin-top:6px;font-size:0.69rem;color:#ef4444">Blocage: ${_enhEsc(blocked[0].message)}</div>` : '';
            return `<div data-plugin-id="${p.id}" style="border:1px solid var(--border-subtle);border-radius:8px;padding:8px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <strong style="font-size:0.8rem;flex:1">${_enhEsc(p.name)} <span style="color:var(--muted);font-weight:400">(${_enhEsc(p.id)}@${_enhEsc(p.version || '1.0.0')})</span></strong>
                <label style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:4px"><input type="checkbox" data-plug-enabled ${p.enabled !== false ? 'checked' : ''}> actif</label>
                <span style="font-size:0.67rem;padding:2px 7px;border-radius:999px;border:1px solid ${meta.bd};background:${meta.bg};color:${meta.fg};font-weight:600">${meta.label}</span>
            </div>
            <div style="font-size:0.72rem;color:var(--muted);margin:6px 0">${(p.widgets || []).length} widget(s) · ${allowedCount} actif(s)${blockedText}</div>
            ${blockedReason}
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="tb-btn ui-btn" data-plug-export style="height:26px;padding:0 8px;font-size:0.7rem">Exporter</button>
                <button class="tb-btn ui-btn danger ui-btn--danger" data-plug-remove style="height:26px;padding:0 8px;font-size:0.7rem">Supprimer</button>
            </div>
        </div>`;
        }).join('');

        host.querySelectorAll('[data-plugin-id]').forEach(box => {
            const pluginId = box.dataset.pluginId;
            box.querySelector('[data-plug-enabled]')?.addEventListener('change', e => {
                window.OEIWidgetPlugins?.setEnabled?.(pluginId, !!e.target.checked);
                _enhNotify('Plugin mis à jour', 'success');
                renderList();
            });
            box.querySelector('[data-plug-export]')?.addEventListener('click', () => {
                window.OEIWidgetPlugins?.exportManifest?.(pluginId);
            });
            box.querySelector('[data-plug-remove]')?.addEventListener('click', async () => {
                const ok = await OEIDialog.confirm(`Supprimer le plugin "${pluginId}" ?`, { danger: true });
                if (!ok) return;
                window.OEIWidgetPlugins?.remove?.(pluginId);
                _enhNotify('Plugin supprimé', 'info');
                renderList();
            });
        });
    };

    const manifestFileBtn = modal.querySelector('#plugin-manifest-file');
    if (manifestFileBtn) manifestFileBtn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const txt = await f.text();
            modal.querySelector('#plugin-manifest-input').value = txt;
        };
        input.click();
    };
    const installBtn = modal.querySelector('#plugin-install');
    if (installBtn) installBtn.onclick = () => {
        const raw = modal.querySelector('#plugin-manifest-input').value.trim();
        if (!raw) return _enhNotify('Manifest vide', 'warning');
        try {
            const res = window.OEIWidgetPlugins?.install?.(raw);
            const warns = res?.warnings || [];
            if (warns.length) _enhNotify(`Plugin installé avec ${warns.length} avertissement(s)`, 'warning');
            else _enhNotify('Plugin installé', 'success');
            renderList();
        } catch (err) {
            _enhNotify(`Erreur plugin: ${err.message}`, 'error');
        }
    };
    const policySaveBtn = modal.querySelector('#plugin-policy-save');
    if (policySaveBtn) policySaveBtn.onclick = () => {
        const allowRemote = !!modal.querySelector('#plugin-policy-allow-remote')?.checked;
        const trustedOrigins = String(modal.querySelector('#plugin-policy-origins')?.value || '')
            .split('\n')
            .map(v => v.trim())
            .filter(Boolean);
        const res = window.OEIWidgetPlugins?.setPolicy?.({ allowRemoteScripts: allowRemote, trustedOrigins });
        const warns = res?.warnings || [];
        if (warns.length) _enhNotify(`Politique appliquée avec ${warns.length} avertissement(s)`, 'warning');
        else _enhNotify('Politique plugin appliquée', 'success');
        renderList();
    };

    modal.style.display = 'flex';
    renderList();
}

window.openAssetsManager = openAssetsManager;
window.openDesignTokensManager = openDesignTokensManager;
window.openWidgetPluginsManager = openWidgetPluginsManager;
