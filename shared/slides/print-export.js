/**
 * @module slides/print-export
 * @public
 * @internal Module Slides chargé côté navigateur.
 */
/* print-export.js — impression PDF native EN PLACE (aucune fenêtre/onglet ouvert, donc
 * aucun risque de blocage pop-up). Injecte le contenu imprimable d'un deck comme overlay
 * caché dans la page COURANTE, une feuille @media print masque tout le reste pendant
 * l'impression, window.print() se déclenche, puis l'overlay est retiré.
 *
 * Extrait de shared/slides/editor-export.js (_exportPDFPrint) pour être utilisable sans
 * charger tout editor-bootstrap.js (~50 scripts, toute l'UI de l'éditeur) — dépendances
 * volontairement minimales : slides-typography.js, slides-core.js, slides-themes.js,
 * slides-renderer-canvas.js (slides canvas), shared/components/base/WidgetRegistry.js
 * (widgets, uniquement si le deck en utilise). Utilisé par shared/slides/editor-export.js
 * (bouton "Export PDF" de l'éditeur, sans quitter la session d'édition en cours) et
 * slides/course-main.js (bouton PDF du catalogue public d'un cours, sans jamais charger
 * editor.html).
 */
(function () {
    'use strict';

    function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    const ASPECT_DIMS = { '16:9': [1280, 720], '4:3': [1024, 768], 'a4': [1123, 794] };

    function _resolveExportTheme(data) {
        const Themes = window.SlidesThemes;
        if (window.OEIDesignTokens?.resolvePresentationTheme) {
            return window.OEIDesignTokens.resolvePresentationTheme(data || {});
        }
        const all = (Themes.list ? Themes.list() : Themes.BUILT_IN);
        if (typeof data?.theme === 'string') return all[data.theme] || Themes.BUILT_IN.dark;
        return data?.theme || Themes.BUILT_IN.dark;
    }

    function _buildThemeFontLinkHref(themeData) {
        const Themes = window.SlidesThemes;
        const _d = Themes.BUILT_IN.dark;
        const _all = Themes.list ? Themes.list() : Themes.BUILT_IN;
        const t = (typeof themeData === 'string') ? (_all[themeData] || _d) : (themeData && themeData.fonts ? themeData : _d);
        const f = { ..._d.fonts, ...t.fonts };
        const families = new Set();
        [f.heading, f.body, f.mono].forEach(stack => {
            if (!stack) return;
            const m = stack.match(/"([^"]+)"/g);
            if (m) m.forEach(name => {
                const clean = name.replace(/"/g, '');
                if (!/system-ui|sans-serif|monospace|serif/i.test(clean)) families.add(clean);
            });
        });
        if (families.size === 0) return null;
        const params = [...families].map(f => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`).join('&');
        return `https://fonts.googleapis.com/css2?${params}&display=swap`;
    }

    function _collectUsedWidgets(slides) {
        const widgets = new Set();
        for (const slide of slides) {
            if (slide.type === 'simulation' && slide.widget) widgets.add(slide.widget);
            if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
                for (const el of slide.elements) {
                    if (el.type === 'widget' && el.data?.widget) widgets.add(el.data.widget);
                }
            }
        }
        return widgets;
    }

    let _widgetCssCache = null;
    async function _fetchWidgetCss() {
        if (_widgetCssCache != null) return _widgetCssCache;
        try {
            const r = await fetch('../shared/components/widgets.css');
            _widgetCssCache = r.ok ? await r.text() : '';
            if (!r.ok) console.warn('[OEI] widgets.css non disponible (HTTP ' + r.status + ')');
        } catch (e) {
            console.warn('[OEI] Could not inline widgets.css:', e);
            _widgetCssCache = '';
        }
        return _widgetCssCache;
    }

    function _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('Script non chargé: ' + src));
            document.head.appendChild(el);
        });
    }

    /**
     * Monte les widgets DIRECTEMENT (pas de génération de <script> à écrire dans un
     * document.write — on est déjà dans un contexte JS vivant) — utilise
     * window.OEI_WIDGET_REGISTRY directement (pas CanvasEditor.WIDGET_REGISTRY, qui n'en
     * est qu'un alias, cf. shared/slides/slides-canvas.js) pour éviter de charger tout le
     * graphe de dépendances de l'éditeur canvas.
     */
    async function _mountWidgetsInPlace(container, usedWidgets) {
        if (usedWidgets.size === 0) return;
        const reg = window.OEI_WIDGET_REGISTRY || {};
        if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
        if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
        if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;

        const slots = container.querySelectorAll('.sl-sim-container[data-widget]');
        for (const slot of slots) {
            if (slot.dataset.mounted) continue;
            const wid = slot.dataset.widget;
            if (!wid) { slot.textContent = 'Widget non configuré'; continue; }
            const entry = reg[wid];
            if (!entry) { slot.textContent = 'Widget indisponible: ' + wid; continue; }
            try {
                if (!window[entry.global]) {
                    const isAbsolute = typeof entry.script === 'string' && /^(https?:)?\/\//i.test(entry.script);
                    await _loadScript(isAbsolute ? entry.script : ('../shared/components/' + entry.script));
                }
                const cls = window[entry.global];
                if (!cls || typeof cls.mount !== 'function') { slot.textContent = 'Widget non chargé: ' + wid; continue; }
                const config = JSON.parse(slot.dataset.config || '{}');
                cls.mount(slot, Object.assign({}, config, { type: wid }));
                slot.dataset.mounted = '1';
            } catch (e) {
                slot.textContent = 'Erreur widget: ' + (e.message || String(e));
                console.error('[OEI] Widget mount error:', wid, e);
            }
        }
    }

    /**
     * Imprime un deck DIRECTEMENT dans la page courante — aucune fenêtre/onglet ouvert.
     * @param {object} data Deck complet (metadata + slides), comme editor.data.
     */
    async function printDeckInPlace(data) {
        if (!data || !Array.isArray(data.slides)) throw new Error('Présentation invalide — impossible d’imprimer');
        const Renderer = window.SlidesRenderer;
        const Shared = window.SlidesShared;
        const Themes = window.SlidesThemes;
        if (!Renderer || !Shared || !Themes) throw new Error('Moteur de rendu des slides non chargé');

        const dims = ASPECT_DIMS[data.metadata?.aspect] || [1280, 720];
        const themeData = _resolveExportTheme(data);
        const themeCSS = Themes.generateCSS(themeData);
        const pdfOpts = {
            showSlideNumber: data.showSlideNumber || false,
            footerText: data.footerText || null,
            footerConfig: (data && typeof data.footerConfig === 'object' && data.footerConfig) ? data.footerConfig : null,
            metadata: data.metadata || {},
            totalSlides: data.slides.length,
            chapterNumbers: Renderer._buildChapterNumbers(data.slides, data.autoNumberChapters),
            typography: Shared.resolveTypographyDefaults(data.typography),
            includeNotes: false, // Vue étudiant : pas de notes présentateur
        };
        const slidesHTML = data.slides.map((slide, i) =>
            `<div class="pdf-slide">${Renderer.renderSlide(slide, i, pdfOpts)}</div>`
        ).join('');

        const usedWidgets = _collectUsedWidgets(data.slides);
        const widgetCss = usedWidgets.size > 0 ? await _fetchWidgetCss() : '';

        const fontHref = _buildThemeFontLinkHref(themeData);
        let fontLink = null;
        if (fontHref) {
            fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = fontHref;
            document.head.appendChild(fontLink);
            // Silencieux si bloqué par la CSP de la page (ex. course.html volontairement
            // minimal) : simple repli sur les polices système, pas d'erreur.
        }

        const overlay = document.createElement('div');
        overlay.id = 'oei-print-overlay';
        overlay.innerHTML = `<style>
${themeCSS}
${widgetCss}
.pdf-slide {
    width: ${dims[0]}px; height: ${dims[1]}px; page-break-after: always;
    overflow: hidden; position: relative;
}
.pdf-slide section { width: ${dims[0]}px; height: ${dims[1]}px; padding: calc(var(--sl-content-padding-y, 40) * 1px) calc(var(--sl-content-padding-x, 48) * 1px); box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; line-height: var(--sl-body-line-height, 1.45); }
.pdf-slide section.sl-canvas { padding: 0 !important; position: relative !important; overflow: hidden !important; }
</style>${slidesHTML}`;
        document.body.appendChild(overlay);

        // Feuille d'impression GLOBALE (hors overlay — doit masquer TOUT le reste du
        // document pendant l'impression, pas seulement son propre contenu).
        const printStyle = document.createElement('style');
        printStyle.id = 'oei-print-style';
        printStyle.textContent = `
@media print {
    body > *:not(#oei-print-overlay) { display: none !important; }
    #oei-print-overlay { display: block !important; }
    @page { size: ${dims[0] > dims[1] ? 'landscape' : 'portrait'}; margin: 0; }
}
@media screen { #oei-print-overlay { display: none; } }
`;
        document.head.appendChild(printStyle);

        let cleaned = false;
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            overlay.remove();
            printStyle.remove();
            if (fontLink) fontLink.remove();
            window.removeEventListener('afterprint', cleanup);
            clearTimeout(safetyTimer); // sinon le minuteur (5 min) reste pendant même après
            // un cleanup déclenché par afterprint, retardant la fin du event loop pour rien.
        };
        window.addEventListener('afterprint', cleanup);
        // Filet de sécurité : si `afterprint` ne se déclenche jamais (certains navigateurs
        // mobiles, ou fenêtre d'impression annulée d'une façon qui échappe à l'évènement),
        // l'overlay ne doit pas rester bloqué indéfiniment sur la page.
        const safetyTimer = setTimeout(cleanup, 5 * 60 * 1000);

        await _mountWidgetsInPlace(overlay, usedWidgets);
        // Laisse le temps aux dernières polices web / au layout de se stabiliser avant la
        // capture d'impression du navigateur.
        await new Promise(r => setTimeout(r, usedWidgets.size > 0 ? 400 : 150));
        window.print();
    }

    window.OEIPrintExport = Object.freeze({ printDeckInPlace });
})();
