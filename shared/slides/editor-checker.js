/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-checker
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-checker.js"></script>
 */
/* editor-checker.js — Presentation quality + accessibility checker */

function _checkerThemeData(data) {
    const all = (typeof SlidesThemes?.list === 'function') ? SlidesThemes.list() : (SlidesThemes?.BUILT_IN || {});
    if (typeof data?.theme === 'string') return all[data.theme] || SlidesThemes?.BUILT_IN?.dark || {};
    return data?.theme || SlidesThemes?.BUILT_IN?.dark || {};
}

function _checkerSlideBg(slide, data) {
    if (slide?.bg) return slide.bg;
    const theme = _checkerThemeData(data);
    return theme?.colors?.slideBg || '#1a1d27';
}

function _checkerHexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
    };
}

function _checkerLuminance({ r, g, b }) {
    const toLin = v => {
        const s = v / 255;
        return s <= 0.03928 ? (s / 12.92) : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function _checkerContrastRatio(fgColor, bgColor) {
    const fgHex = colorToHex(fgColor || '#000000');
    const bgHex = colorToHex(bgColor || '#ffffff');
    const fg = _checkerHexToRgb(fgHex);
    const bg = _checkerHexToRgb(bgHex);
    if (!fg || !bg) return null;
    const l1 = _checkerLuminance(fg);
    const l2 = _checkerLuminance(bg);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
}

function _checkerIsLargeText(px, fontWeight) {
    const size = Number(px) || 0;
    const weight = Number(fontWeight) || 400;
    return size >= 24 || (size >= 18.66 && weight >= 700);
}

function _checkerEsc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function _checkerEscAttr(value) {
    return _checkerEsc(value).replace(/"/g, '&quot;');
}

function _checkerElementA11yIssues(el, slideBg) {
    const issues = [];
    if (!el || typeof el !== 'object') return issues;
    const type = String(el.type || '');
    const alt = String(el.data?.alt || '').trim();
    const title = String(el.data?.title || '').trim();

    if (['image', 'qrcode', 'gallery-annotable'].includes(type) && !alt) {
        issues.push({ level: 'warning', msg: `${type === 'image' ? 'Image' : 'Média'} sans texte alternatif`, fix: 'add-alt' });
    }

    if ((type === 'video' || type === 'iframe') && !title) {
        issues.push({ level: 'info', msg: `${type === 'video' ? 'Vidéo' : 'Iframe'} sans titre explicite`, fix: 'add-title' });
    }

    if (['text', 'list', 'definition', 'quote'].includes(type)) {
        const fontSize = Number(el.style?.fontSize) || 0;
        if (fontSize > 0 && fontSize < 16) {
            issues.push({ level: 'warning', msg: `Texte trop petit (${fontSize}px)`, fix: 'bump-font-size' });
        }
    }

    if (['heading', 'text', 'list', 'definition', 'quote', 'card'].includes(type)) {
        const fg = el.style?.color || 'var(--sl-text)';
        const ratio = _checkerContrastRatio(fg, slideBg);
        if (ratio != null) {
            const isLarge = _checkerIsLargeText(el.style?.fontSize, el.style?.fontWeight);
            const minRatio = isLarge ? 3 : 4.5;
            if (ratio < 3) {
                issues.push({ level: 'error', msg: `Contraste insuffisant (${ratio.toFixed(2)}:1)`, fix: 'improve-contrast' });
            } else if (ratio < minRatio) {
                issues.push({ level: 'warning', msg: `Contraste limite (${ratio.toFixed(2)}:1, cible ${minRatio}:1)`, fix: 'improve-contrast' });
            }
        }
    }

    return issues;
}

function _checkerSlideA11yFindings(slide, data) {
    const findings = [];
    if (!slide || typeof slide !== 'object') return findings;
    const type = String(slide.type || '');
    if (type === 'image' && !String(slide.alt || '').trim()) {
        findings.push({ level: 'warning', msg: 'Image sans texte alternatif' });
    }
    if (type === 'bullets' && Array.isArray(slide.items)) {
        for (const item of slide.items) {
            if (String(item || '').trim().length > 140) {
                findings.push({ level: 'info', msg: 'Point très long — privilégier des phrases plus courtes' });
                break;
            }
        }
    }
    if (type !== 'canvas' || !Array.isArray(slide.elements)) return findings;
    const slideBg = _checkerSlideBg(slide, data);
    for (const el of slide.elements) {
        _checkerElementA11yIssues(el, slideBg).forEach(issue => findings.push(issue));
    }
    return findings;
}

function _checkerCurrentSlideA11yCount() {
    const slide = editor?.currentSlide;
    if (!slide) return 0;
    return _checkerSlideA11yFindings(slide, editor?.data || {}).length;
}

function _checkerBestContrastColor(bgColor) {
    const dark = '#111827';
    const light = '#ffffff';
    const darkRatio = _checkerContrastRatio(dark, bgColor) || 0;
    const lightRatio = _checkerContrastRatio(light, bgColor) || 0;
    return darkRatio >= lightRatio ? dark : light;
}

function _checkerApplyElementFix(el, fixId) {
    if (!el?.id || !canvasEditor || !editor?.currentSlide) return false;
    const id = el.id;
    const type = String(el.type || '');
    const slideBg = _checkerSlideBg(editor.currentSlide, editor.data || {});
    if (fixId === 'add-alt') {
        const defaults = {
            image: 'Description de l’image',
            qrcode: 'Description de la destination du QR code',
            'gallery-annotable': 'Description de l’image annotée',
        };
        canvasEditor.updateData(id, { data: { alt: defaults[type] || 'Description du média' } });
        return true;
    }
    if (fixId === 'add-title') {
        canvasEditor.updateData(id, { data: { title: type === 'iframe' ? 'Contenu intégré' : 'Vidéo' } });
        return true;
    }
    if (fixId === 'bump-font-size') {
        const current = Number(el.style?.fontSize) || 14;
        canvasEditor.updateData(id, { style: { fontSize: Math.max(16, current) } });
        return true;
    }
    if (fixId === 'improve-contrast') {
        const nextColor = _checkerBestContrastColor(slideBg);
        canvasEditor.updateData(id, { style: { color: nextColor } });
        return true;
    }
    return false;
}

function updateCheckerLiveBadge() {
    const btn = document.getElementById('btn-checker');
    if (!btn) return;
    const count = _checkerCurrentSlideA11yCount();
    let badge = btn.querySelector('.tb-badge');
    if (count <= 0) {
        if (badge) badge.remove();
        return;
    }
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tb-badge';
        btn.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('warning', count > 0 && count < 3);
    badge.classList.toggle('danger', count >= 3);
    badge.title = `${count} signalement(s) A11y sur ce slide`;
}

function renderA11yElementHints(el, panel) {
    if (!panel || !el || editor?.currentSlide?.type !== 'canvas') return;
    const old = panel.querySelector('.checker-live-section');
    if (old) old.remove();
    const issues = _checkerElementA11yIssues(el, _checkerSlideBg(editor.currentSlide, editor.data || {}));
    if (!issues.length) {
        updateCheckerLiveBadge();
        return;
    }

    const levelRank = { error: 0, warning: 1, info: 2 };
    const sorted = [...issues].sort((a, b) => (levelRank[a.level] || 9) - (levelRank[b.level] || 9));
    const fixes = [];
    sorted.forEach(issue => {
        if (!issue.fix) return;
        if (!fixes.find(item => item.fix === issue.fix)) fixes.push(issue);
    });

    const section = document.createElement('div');
    section.className = 'props-section checker-live-section';
    section.innerHTML = `
        <div class="props-section-title">Accessibilité live</div>
        <div class="checker-live-list">
            ${sorted.map(issue => `<div class="checker-live-item checker-live-${_checkerEscAttr(issue.level)}">${_checkerEsc(issue.msg)}</div>`).join('')}
        </div>
        ${fixes.length ? `<div class="checker-live-actions">
            ${fixes.map(issue => `<button class="tb-btn checker-live-fix" data-checker-fix="${_checkerEscAttr(issue.fix)}">
                ${issue.fix === 'add-alt' ? 'Ajouter alt' : issue.fix === 'add-title' ? 'Ajouter titre' : issue.fix === 'bump-font-size' ? 'Passer à 16px' : 'Corriger contraste'}
            </button>`).join('')}
        </div>` : ''}
    `;
    panel.appendChild(section);
    section.querySelectorAll('[data-checker-fix]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fixId = String(btn.dataset.checkerFix || '');
            if (!fixId) return;
            if (_checkerApplyElementFix(el, fixId)) {
                if (typeof notify === 'function') notify('Correction A11y appliquée', 'success');
                if (typeof updatePropsPanel === 'function') updatePropsPanel();
                updateCheckerLiveBadge();
            }
        });
    });
    updateCheckerLiveBadge();
}

function runPresentationCheck() {
    const data = editor.data;
    if (!data || !data.slides.length) { notify('Aucun slide à vérifier', 'warning'); return; }

    const findings = [];
    const slides = data.slides;
    const add = item => findings.push(item);

    slides.forEach((slide, i) => {
        const num = i + 1;
        const type = slide.type || 'unknown';
        const slideBg = _checkerSlideBg(slide, data);

        if (!slide.notes || !slide.notes.trim()) {
            add({ slide: num, level: 'info', kind: 'content', msg: 'Pas de notes orateur' });
        }

        if (type === 'canvas' && slide.elements && slide.elements.length > 12) {
            add({ slide: num, level: 'warning', kind: 'content', msg: `Trop d'éléments (${slide.elements.length}) — risque de surcharge visuelle` });
        }

        if (type === 'canvas' && (!slide.elements || slide.elements.length === 0)) {
            add({ slide: num, level: 'warning', kind: 'content', msg: 'Slide canvas vide' });
        }
        if (type === 'bullets' && (!slide.items || slide.items.length === 0)) {
            add({ slide: num, level: 'warning', kind: 'content', msg: 'Liste de points vide' });
        }
        if (type === 'blank' && !slide.html) {
            add({ slide: num, level: 'warning', kind: 'content', msg: 'Slide libre sans contenu' });
        }

        if (type === 'bullets' && slide.items && slide.items.length > 7) {
            add({ slide: num, level: 'warning', kind: 'content', msg: `Trop de points (${slide.items.length}) — limiter à 5-7` });
        }
        if (type === 'bullets' && Array.isArray(slide.items)) {
            for (const item of slide.items) {
                if (String(item || '').trim().length > 140) {
                    add({ slide: num, level: 'info', kind: 'a11y', msg: '[A11y] Point très long — privilégier des phrases plus courtes' });
                    break;
                }
            }
        }

        if (['bullets', 'code', 'definition', 'comparison', 'split', 'quiz'].includes(type) && !slide.title) {
            add({ slide: num, level: 'info', kind: 'content', msg: 'Pas de titre' });
        }

        if (slide.hidden) {
            add({ slide: num, level: 'info', kind: 'content', msg: 'Slide masqué (ne sera pas présenté)' });
        }

        if (type === 'image' && (!slide.alt || !String(slide.alt).trim())) {
            add({ slide: num, level: 'warning', kind: 'a11y', msg: '[A11y] Image sans texte alternatif' });
        }

        if (type === 'canvas' && Array.isArray(slide.elements)) {
            for (const el of slide.elements) {
                _checkerElementA11yIssues(el, slideBg).forEach(issue => {
                    add({ slide: num, level: issue.level, kind: 'a11y', msg: `[A11y] ${issue.msg}` });
                });
            }

            if (slide.elements.length > 1) {
                const els = slide.elements;
                for (let a = 0; a < els.length; a++) {
                    for (let b = a + 1; b < els.length; b++) {
                        const ea = els[a], eb = els[b];
                        const overlapX = ea.x < eb.x + eb.w && ea.x + ea.w > eb.x;
                        const overlapY = ea.y < eb.y + eb.h && ea.y + ea.h > eb.y;
                        if (overlapX && overlapY) {
                            const overlapW = Math.min(ea.x + ea.w, eb.x + eb.w) - Math.max(ea.x, eb.x);
                            const overlapH = Math.min(ea.y + ea.h, eb.y + eb.h) - Math.max(ea.y, eb.y);
                            const overlapArea = overlapW * overlapH;
                            const smallerArea = Math.min(ea.w * ea.h, eb.w * eb.h);
                            if (smallerArea > 0 && overlapArea / smallerArea > 0.5) {
                                add({ slide: num, level: 'info', kind: 'content', msg: 'Éléments fortement superposés' });
                                a = els.length;
                                break;
                            }
                        }
                    }
                }
            }
        }
    });

    if (slides.length > 40) {
        add({ slide: 0, level: 'warning', kind: 'content', msg: `Présentation longue (${slides.length} slides) — envisager de diviser` });
    }

    if (!data.metadata?.title || data.metadata.title === 'Nouvelle présentation') {
        add({ slide: 0, level: 'info', kind: 'content', msg: 'La présentation n\'a pas de titre personnalisé' });
    }

    showCheckerResults(findings);
    updateCheckerLiveBadge();
}

function showCheckerResults(findings) {
    let modal = document.getElementById('checker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checker-modal';
        modal.className = 'checker-modal-overlay';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    const levelOrder = { error: 0, warning: 1, info: 2 };
    const levelColor = { error: 'var(--danger,#ef4444)', warning: 'var(--warning,#f59e0b)', info: 'var(--muted,#64748b)' };
    const levelLabel = { error: 'Erreur', warning: 'Avertissement', info: 'Info' };
    const sorted = [...findings].sort((a, b) => (levelOrder[a.level] - levelOrder[b.level]) || (a.slide - b.slide));

    const stats = {
        error: sorted.filter(f => f.level === 'error').length,
        warning: sorted.filter(f => f.level === 'warning').length,
        info: sorted.filter(f => f.level === 'info').length,
        a11y: sorted.filter(f => f.kind === 'a11y').length,
    };

    let mode = 'all';
    const renderBody = () => {
        const active = mode === 'a11y'
            ? sorted.filter(f => f.kind === 'a11y')
            : sorted;
        const listHtml = active.length === 0
            ? '<div class="checker-empty">Aucun problème détecté</div>'
            : active.map(f => `<div class="checker-item" data-slide="${f.slide}" style="--checker-level:${levelColor[f.level]}">
                <span class="checker-level-pill">${levelLabel[f.level]}</span>
                <div class="checker-item-main">
                    <span class="checker-item-slide">${f.slide > 0 ? 'Slide ' + f.slide : 'Général'}</span>
                    <div class="checker-item-msg">${f.msg}</div>
                </div>
            </div>`).join('');
        const host = modal.querySelector('[data-checker-results]');
        if (host) host.innerHTML = listHtml;
        modal.querySelectorAll('.checker-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.slide, 10) - 1;
                if (idx >= 0 && idx < editor.data.slides.length) {
                    editor.selectSlide(idx);
                    modal.style.display = 'none';
                }
            });
        });
    };

    modal.innerHTML = `<div class="checker-modal-panel">
        <div class="checker-modal-head">
            <h3 class="checker-modal-title">Vérification de la présentation</h3>
            <button id="checker-close" class="checker-close-btn">✕</button>
        </div>
        <div class="checker-toolbar">
            <div class="checker-stats">
                <span>${editor.data.slides.length} slides</span>
                <span class="checker-stat-error">${stats.error} erreurs</span>
                <span class="checker-stat-warning">${stats.warning} avertissements</span>
                <span>${stats.info} infos</span>
                <span class="checker-stat-a11y">${stats.a11y} signaux A11y</span>
            </div>
            <div class="checker-mode-switch">
                <button id="checker-mode-all" class="tb-btn checker-mode-btn">Tout</button>
                <button id="checker-mode-a11y" class="tb-btn checker-mode-btn">A11y</button>
            </div>
        </div>
        <div data-checker-results class="checker-results"></div>
    </div>`;

    modal.querySelector('#checker-close')?.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    modal.querySelector('#checker-mode-all')?.addEventListener('click', () => { mode = 'all'; renderBody(); });
    modal.querySelector('#checker-mode-a11y')?.addEventListener('click', () => { mode = 'a11y'; renderBody(); });

    renderBody();
}

window.updateCheckerLiveBadge = updateCheckerLiveBadge;
window.renderA11yElementHints = renderA11yElementHints;
