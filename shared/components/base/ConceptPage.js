/**
 * ConceptPage - Base class for concept pages with JSON course loading.
 */
// Widget registry: use shared OEI_WIDGET_REGISTRY (loaded via WidgetRegistry.js).
// If not present, lazy-load it. No more inline fallback copy.
let _widgetRegistryPromise = null;
function _ensureWidgetRegistry() {
    if (typeof OEI_WIDGET_REGISTRY !== 'undefined' && window.OEI_WIDGET_REGISTRY) {
        return Promise.resolve(window.OEI_WIDGET_REGISTRY);
    }
    if (!_widgetRegistryPromise) {
        _widgetRegistryPromise = new Promise((resolve) => {
            const script = document.createElement('script');
            // Resolve path: find any script whose src contains ConceptPage.js → same directory
            const cpScript = Array.from(document.scripts).find(s => s.src && /ConceptPage\.js/i.test(s.src));
            if (cpScript) {
                script.src = cpScript.src.replace(/ConceptPage\.js(\?.*)?$/i, 'WidgetRegistry.js');
            } else {
                script.src = 'shared/components/base/WidgetRegistry.js';
            }
            script.onload = () => resolve(window.OEI_WIDGET_REGISTRY || {});
            script.onerror = () => {
                console.warn('WidgetRegistry.js could not be loaded — widgets will be unavailable');
                resolve({});
            };
            document.head.appendChild(script);
        });
    }
    return _widgetRegistryPromise;
}
function _getWidgetRegistry() {
    return (typeof OEI_WIDGET_REGISTRY !== 'undefined') ? OEI_WIDGET_REGISTRY : {};
}

// Cache-buster unique par chargement de page (invalide le cache navigateur des widgets
// chargés dynamiquement). Actif uniquement en développement local (file:// ou localhost).
const _OEI_DEV = (typeof location !== 'undefined') &&
    (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? Date.now() : null;

class ConceptPage {
    constructor(dataPath, options = {}) {
        this.dataPath = dataPath;
        this.courseContainerId = options.courseContainerId || 'course-container';
        this.pageTitleId = options.pageTitleId || null;
        this.pageTitlePrefix = options.pageTitlePrefix || '';
        this.strictLoading = options.strictLoading === true;
        this.autoRenderExercises = options.autoRenderExercises !== false;
        this.data = null;
        this.inlineExerciseWidget = null;
        this.widgetInstances = [];
    }

    getEmbedConfig() {
        if (typeof window === 'undefined') return {};
        if (window.OEIEmbedConfig && typeof window.OEIEmbedConfig === 'object') {
            return window.OEIEmbedConfig;
        }
        if (window.OEIAppState && typeof window.OEIAppState.getEmbedConfig === 'function') {
            return window.OEIAppState.getEmbedConfig() || {};
        }
        return {};
    }

    async init() {
        this.destroy();
        await this.loadData();
        this.applyMetadata();
        // Ensure widget registry is available (lazy-load if needed)
        _ensureWidgetRegistry();
        await ConceptPage._loadKaTeX();
        await this.renderUnifiedContent();
        this._renderMath();
    }

    static _resolveProjectRootUrl() {
        if (typeof document === 'undefined') return null;
        const current = document.currentScript;
        const fallback = Array.from(document.scripts).find((s) => /shared\/components\/base\/ConceptPage\.js($|\?)/.test(s.src || ''));
        const source = current && current.src ? current.src : (fallback ? fallback.src : '');
        if (!source) return null;
        try {
            return new URL(source.replace(/shared\/components\/base\/ConceptPage\.js($|\?.*)/, ''), window.location.href);
        } catch (error) {
            return null;
        }
    }

    static async _loadKaTeX() {
        if (typeof window === 'undefined') return;
        if (window.renderMathInElement) return;
        if (!ConceptPage._katexPromise) {
            ConceptPage._katexPromise = (async () => {
                const rootUrl = ConceptPage._resolveProjectRootUrl();
                const cssUrl = rootUrl ? new URL('shared/vendor/katex/katex.min.css', rootUrl).toString() : 'shared/vendor/katex/katex.min.css';
                const coreJsUrl = rootUrl ? new URL('shared/vendor/katex/katex.min.js', rootUrl).toString() : 'shared/vendor/katex/katex.min.js';
                const autoRenderJsUrl = rootUrl ? new URL('shared/vendor/katex/auto-render.min.js', rootUrl).toString() : 'shared/vendor/katex/auto-render.min.js';

                if (!document.querySelector('link[data-katex-core]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.setAttribute('data-katex-core', '1');
                    link.href = cssUrl;
                    document.head.appendChild(link);
                }
                await new Promise((resolve) => {
                    if (window.katex) {
                        resolve();
                        return;
                    }
                    const existing = document.querySelector('script[data-katex-core]');
                    if (existing) {
                        existing.addEventListener('load', () => resolve(), { once: true });
                        existing.addEventListener('error', () => resolve(), { once: true });
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = coreJsUrl;
                    script.setAttribute('data-katex-core', '1');
                    script.onload = resolve;
                    script.onerror = () => {
                        console.warn('KaTeX core failed to load');
                        resolve();
                    };
                    document.head.appendChild(script);
                });
                await new Promise((resolve) => {
                    if (window.renderMathInElement) {
                        resolve();
                        return;
                    }
                    const existing = document.querySelector('script[data-katex-autorender]');
                    if (existing) {
                        existing.addEventListener('load', () => resolve(), { once: true });
                        existing.addEventListener('error', () => resolve(), { once: true });
                        return;
                    }

                    const script = document.createElement('script');
                    script.src = autoRenderJsUrl;
                    script.setAttribute('data-katex-autorender', '1');
                    script.onload = resolve;
                    script.onerror = () => {
                        console.warn('KaTeX auto-render failed to load');
                        resolve();
                    };
                    document.head.appendChild(script);
                });
            })();
        }
        return ConceptPage._katexPromise;
    }

    _renderMath() {
        const container = document.getElementById(this.courseContainerId);
        if (!container || !window.renderMathInElement) return;
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$',  right: '$',  display: false }
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            throwOnError: false
        });
    }

    async loadData() {
        if (!this.dataPath) return;
        try {
            const response = await fetch(this.dataPath);
            if (!response.ok) {
                throw new Error('HTTP error ' + response.status);
            }
            this.data = await response.json();
        } catch (error) {
            console.warn('Course JSON load failed:', error);
            if (this.strictLoading) throw error;
        }
    }

    applyMetadata() {
        if (!this.data || !this.data.metadata) return;

        if (this.data.metadata.title) {
            document.title = this.data.metadata.title + ' — Outils Enseignement';
        }

        if (this.pageTitleId && this.data.metadata.title) {
            const titleEl = document.getElementById(this.pageTitleId);
            if (titleEl) {
                titleEl.textContent = this.pageTitlePrefix + this.data.metadata.title;
            }
        }
    }

    hasUnifiedContent() {
        return Array.isArray(this.data?.content) && this.data.content.length > 0;
    }

    async renderUnifiedContent() {
        this.cleanupRuntimeArtifacts();
        const container = document.getElementById(this.courseContainerId);
        if (!container) return;
        const embed = this.getEmbedConfig();
        const showCourse = embed.showCourse !== false;
        const showSimulation = embed.showSimulation !== false;
        const showExercice = embed.showExercice !== false;

        if (!this.hasUnifiedContent()) {
            container.innerHTML = '<p class="section-description">Aucun contenu pedagogique (format unifie) n\'est disponible.</p>';
            return;
        }
        container.innerHTML = '';
        if (showCourse) {
            this.renderLearningObjectives(container);
        }

        for (const block of this.data.content) {
            if (!block || block.visible === false) continue;

            if (block.type === 'course') {
                if (!showCourse) continue;
                if (typeof CourseRenderer === 'undefined') continue;
                const tagged = this.createTaggedBlock(block.label || 'Cours', 'course');
                const courseData = Object.assign({}, block, {
                    sections: Array.isArray(block.sections) ? block.sections : []
                });
                const renderer = new CourseRenderer(
                    courseData,
                    { collapsible: block.collapsible !== false }
                );
                tagged.insertAdjacentHTML('beforeend', renderer.render());
                container.appendChild(tagged);
                continue;
            }

            if (block.type === 'chapters') {
                if (!showCourse) continue;
                this.renderUnifiedChaptersBlock(block, container);
                continue;
            }

            if (block.type === 'widget') {
                if (!showSimulation) continue;
                await this.renderUnifiedWidgetBlock(block, container);
                continue;
            }

            if (block.type === 'tabs') {
                if (!showSimulation && !showCourse) continue;
                await this.renderUnifiedTabsBlock(block, container, { showCourse, showSimulation, showExercice });
                continue;
            }

            if (block.type === 'pedagogy') {
                if (!showCourse) continue;
                await this.renderUnifiedPedagogyBlock(block, container);
                continue;
            }

            if (block.type === 'exercises') {
                if (!showExercice) continue;
                await this.renderUnifiedExercisesBlock(block, container);
            }
        }
    }

    renderLearningObjectives(container) {
        const objectives = Array.isArray(this.data?.metadata?.learningObjectives)
            ? this.data.metadata.learningObjectives.filter((item) => typeof item === 'string' && item.trim())
            : [];
        const skills = Array.isArray(this.data?.metadata?.skills)
            ? this.data.metadata.skills.filter((item) => typeof item === 'string' && item.trim())
            : [];

        if (!objectives.length && !skills.length) return;

        const tagged = this.createTaggedBlock('Objectifs', 'goals');
        const panel = document.createElement('div');
        panel.className = 'course-section course-section--open learning-goals-panel';

        let html = '<h3 class="course-title">Objectifs d\'apprentissage</h3>';
        if (objectives.length) {
            html += `<ul class="learning-goals-list">${objectives.map((item) => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>`;
        }
        if (skills.length) {
            html += `
                <div class="learning-skills">
                    <strong>Competences cibles:</strong>
                    <div class="learning-skills-row">${skills.map((item) => `<span class="learning-skill-chip">${this.escapeHtml(item)}</span>`).join('')}</div>
                </div>
            `;
        }

        panel.innerHTML = html;
        tagged.appendChild(panel);
        container.appendChild(tagged);
    }

    renderUnifiedChaptersBlock(block, container) {
        const chapters = Array.isArray(block.chapters) ? block.chapters : [];
        if (!chapters.length) return;
        if (typeof CourseRenderer === 'undefined') return;

        const tagged = this.createTaggedBlock(block.label || 'Cours', 'course');
        const root = document.createElement('div');
        root.className = 'chapters-block';

        chapters.forEach((chapter, i) => {
            const item = document.createElement('div');
            item.className = 'chapters-item';

            const header = document.createElement('button');
            header.className = 'chapters-header';
            header.type = 'button';
            header.innerHTML = `
                <span class="chapters-num">${String(i + 1).padStart(2, '0')}</span>
                <span class="chapters-title">${chapter.title || `Chapitre ${i + 1}`}</span>
                <svg class="chapters-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"/></svg>
            `;

            const body = document.createElement('div');
            body.className = 'chapters-body';

            if (Array.isArray(chapter.sections) && chapter.sections.length) {
                const renderer = new CourseRenderer(
                    { sections: chapter.sections },
                    { collapsible: false }
                );
                body.insertAdjacentHTML('beforeend', renderer.render());
            }

            const isOpen = chapter.open === true || i === 0;
            if (isOpen) item.classList.add('open');

            header.addEventListener('click', () => item.classList.toggle('open'));

            item.appendChild(header);
            item.appendChild(body);
            root.appendChild(item);
        });

        tagged.appendChild(root);
        container.appendChild(tagged);
    }

    async renderUnifiedWidgetBlock(block, container, { inTab = false } = {}) {
        if (!block.widget) return;

        const loaded = await this.ensureWidgetSupportLoaded(block.widget);
        if (!loaded) return;

        let mountParent;
        if (inTab) {
            // Dans un onglet : pas de tag ni de titre, mais on garde la description
            mountParent = container;
            if (block.description) {
                const desc = document.createElement('p');
                desc.className = 'section-description';
                desc.style.margin = '0 0 0.75rem';
                desc.innerHTML = block.description;
                container.appendChild(desc);
            }
        } else {
            const widgetLabel = block.label || 'Simulation';
            const tagged = this.createTaggedBlock(widgetLabel, 'widget');
            if (block.title || block.description) {
                const head = document.createElement('div');
                head.className = 'widget-block-head';
                if (block.title) {
                    const title = document.createElement('h4');
                    title.className = 'widget-block-title';
                    title.textContent = block.title;
                    head.appendChild(title);
                }
                if (block.description) {
                    const desc = document.createElement('p');
                    desc.className = 'section-description';
                    desc.innerHTML = block.description;
                    head.appendChild(desc);
                }
                tagged.appendChild(head);
            }
            container.appendChild(tagged);
            mountParent = tagged;
        }

        const mount = document.createElement('div');
        mount.className = 'course-widget-mount';
        mountParent.appendChild(mount);

        const mounted = await this.mountWidgetRuntime(block.widget, mount, block);
        if (mounted) this.widgetInstances.push(mounted);
    }

    async renderUnifiedTabsBlock(block, container, visibility = {}) {
        const panels = Array.isArray(block.tabs) ? block.tabs : [];
        if (!panels.length) return;

        const tabsLabel = block.label || 'Simulation';
        const tagged = this.createTaggedBlock(tabsLabel, 'widget');

        // Conteneur principal
        const tabsRoot = document.createElement('div');
        tabsRoot.className = 'content-tabs-block';

        // Barre d'onglets
        const bar = document.createElement('div');
        bar.className = 'content-tabs-bar';
        panels.forEach((panel, i) => {
            const btn = document.createElement('button');
            btn.className = 'content-tab-btn' + (i === 0 ? ' active' : '');
            btn.textContent = panel.tab || `Onglet ${i + 1}`;
            btn.dataset.tabIdx = i;
            bar.appendChild(btn);
        });
        tabsRoot.appendChild(bar);

        // Panneaux de contenu (DOM créé, widgets montés à la demande)
        const panelsContainer = document.createElement('div');
        panelsContainer.className = 'content-tab-panels';

        const panelEls = panels.map((panel, i) => {
            const el = document.createElement('div');
            el.className = 'content-tab-panel' + (i === 0 ? ' active' : '');
            el.dataset.tabIdx = i;
            panelsContainer.appendChild(el);
            return el;
        });
        tabsRoot.appendChild(panelsContainer);
        tagged.appendChild(tabsRoot);
        container.appendChild(tagged);

        // Monter le premier onglet immédiatement
        const mounted = new Set();
        const mountPanel = async (idx) => {
            if (mounted.has(idx)) return;
            mounted.add(idx);
            const panelData = panels[idx];
            const panelEl = panelEls[idx];
            const blocks = Array.isArray(panelData.blocks) ? panelData.blocks : [];
            for (const subBlock of blocks) {
                if (!subBlock || subBlock.visible === false) continue;
                if (subBlock.type === 'widget' && visibility.showSimulation !== false) {
                    await this.renderUnifiedWidgetBlock(subBlock, panelEl, { inTab: true });
                } else if (subBlock.type === 'course' && visibility.showCourse !== false) {
                    if (typeof CourseRenderer === 'undefined') continue;
                    const subTagged = this.createTaggedBlock(subBlock.label || 'Cours', 'course');
                    const renderer = new CourseRenderer(subBlock, { collapsible: subBlock.collapsible !== false });
                    subTagged.insertAdjacentHTML('beforeend', renderer.render());
                    panelEl.appendChild(subTagged);
                } else if (subBlock.type === 'exercises' && visibility.showExercice !== false) {
                    await this.renderUnifiedExercisesBlock(subBlock, panelEl);
                }
            }
        };

        await mountPanel(0);

        // Gestion des clics sur les onglets
        bar.addEventListener('click', async (e) => {
            const btn = e.target.closest('.content-tab-btn');
            if (!btn) return;
            const idx = parseInt(btn.dataset.tabIdx, 10);

            bar.querySelectorAll('.content-tab-btn').forEach((b, i) => {
                b.classList.toggle('active', i === idx);
            });
            panelEls.forEach((p, i) => {
                p.classList.toggle('active', i === idx);
            });

            await mountPanel(idx);
        });
    }

    async renderUnifiedExercisesBlock(block, container) {
        if (!this.autoRenderExercises) return;
        if (!Array.isArray(block.questions) || block.questions.length === 0) return;

        if (document.getElementById('chapter-select') && document.getElementById('question-container') && document.getElementById('exercise-feedback')) {
            return;
        }

        const loaded = await this.ensureExerciseTypesLoaded();
        if (!loaded || typeof window.ExerciseQuestionTypes === 'undefined') return;

        const mount = document.createElement(block.collapsible === false ? 'div' : 'details');
        if (block.collapsible === false) {
            mount.className = 'exercise-auto-mount';
        } else {
            mount.className = 'course-section exercise-auto-mount';
            mount.innerHTML = `<summary class="course-title">📝 ${this.escapeHtml(block.title || 'Exercices')}</summary>`;
        }

        const panel = document.createElement('div');
        panel.className = 'card exercise-panel';
        panel.innerHTML = `
            <div class="exercise-stats">
                <span data-role="progress">Question 1/1</span>
                <span data-role="score">Score: 0/1</span>
            </div>
            <div data-role="question"></div>
            <div class="exercise-actions">
                <button class="btn btn-secondary" data-role="prev">Précédente</button>
                <button class="btn btn-primary" data-role="submit">Valider</button>
                <button class="btn btn-secondary" data-role="next">Suivante</button>
                <button class="btn btn-secondary" data-role="reset">Réinitialiser</button>
            </div>
            <div class="feedback" data-role="feedback"></div>
        `;
        mount.appendChild(panel);

        const tagged = this.createTaggedBlock(block.label || 'Exercices', 'exercises');
        tagged.appendChild(mount);
        container.appendChild(tagged);

        if (this.inlineExerciseWidget && typeof this.inlineExerciseWidget.destroy === 'function') {
            this.inlineExerciseWidget.destroy();
        }
        this.inlineExerciseWidget = new InlineExerciseWidget(mount, { title: block.title || 'Exercices', questions: block.questions });
        this.inlineExerciseWidget.init();
    }

    async renderUnifiedPedagogyBlock(block, container) {
        const loaded = await this.ensurePedagogyWidgetLoaded();
        if (!loaded || typeof window.PedagogyPathWidget === 'undefined') return;

        const tagged = this.createPedagogyTaggedBlock(block);
        if (!tagged) return;
        container.appendChild(tagged);
    }

    createPedagogyTaggedBlock(block) {
        const tagged = this.createTaggedBlock(block.label || 'Parcours', 'pedagogy');

        const collapsible = block.collapsible !== false;
        const title = this.escapeHtml(block.title || 'Cheminement pedagogique');
        const badge = this.renderPedagogyBadge(block);
        const widget = new window.PedagogyPathWidget(block, {
            escapeHtml: (text) => this.escapeHtml(String(text))
        });

        if (collapsible) {
            const details = document.createElement('details');
            details.className = 'course-section pedagogy-tile';
            details.innerHTML = `<summary class="course-title pedagogy-tile__summary"><span>${title}</span>${badge}</summary><div class="pedagogy-tile__body">${widget.render()}</div>`;
            tagged.appendChild(details);
        } else {
            const panel = document.createElement('div');
            panel.className = 'course-section course-section--open pedagogy-tile';
            panel.innerHTML = `<div class="pedagogy-tile__header"><h3 class="pedagogy-tile__title">${title}</h3>${badge}</div><div class="pedagogy-tile__body">${widget.render()}</div>`;
            tagged.appendChild(panel);
        }

        return tagged;
    }

    renderPedagogyBadge(block) {
        if (block.show_badge === false) return '';
        const required = Array.isArray(block.prerequis_obligatoires) ? block.prerequis_obligatoires.length : 0;
        const recommended = Array.isArray(block.prerequis_recommandes) ? block.prerequis_recommandes.length : 0;
        const next = Array.isArray(block.suite_recommandee) ? block.suite_recommandee.length : 0;
        const label = `${required} obligatoires · ${recommended} recommandes · ${next} suites`;
        return `<span class="pedagogy-badge">${this.escapeHtml(label)}</span>`;
    }

    async mountWidgetRuntime(widgetType, mount, config) {
        if (widgetType === 'dom-fragment') {
            this.mountDomFragment(config, mount);
            return { destroy() {} };
        }

        const runtimeDef = _getWidgetRegistry()[widgetType];
        const runtime = runtimeDef && typeof window !== 'undefined'
            ? window[runtimeDef.global]
            : null;
        if (runtime && typeof runtime.mount === 'function') {
            return runtime.mount(mount, Object.assign({}, config, { type: widgetType }));
        }
        mount.innerHTML = '<p class="section-description">Widget non supporté.</p>';
        return null;
    }

    mountDomFragment(config, mount) {
        const selector = config?.selector || (config?.elementId ? `#${config.elementId}` : null);
        if (!selector) {
            mount.innerHTML = '<p class="section-description">Widget dom-fragment: `selector` manquant.</p>';
            return;
        }
        const tryAttach = () => {
            const source = document.querySelector(selector);
            if (!source) return false;
            if (source === mount || mount.contains(source)) return true;
            mount.appendChild(source);
            source.style.display = '';
            return true;
        };

        if (tryAttach()) return;

        // Some pages build/move their simulation markup right around init().
        // Retry once on the next frame before showing an error.
        const showNotFound = () => {
            mount.innerHTML = `<p class="section-description">Widget dom-fragment: aucun élément trouvé pour <code>${this.escapeHtml(selector)}</code>.</p>`;
        };

        const retry = () => {
            if (!tryAttach()) showNotFound();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(retry), { once: true });
            return;
        }

        requestAnimationFrame(retry);
    }

    createTaggedBlock(label, type) {
        const block = document.createElement('div');
        block.className = `content-block content-block--${type}`;

        if (label) {
            const badge = document.createElement('div');
            badge.className = 'content-block-label';
            badge.textContent = label;
            block.appendChild(badge);
        }

        return block;
    }

    async ensureWidgetSupportLoaded(type) {
        if (type === 'dom-fragment') return true;

        const runtimeDef = _getWidgetRegistry()[type];
        if (!runtimeDef) return false;

        return this.ensureGlobalLoaded({
            cacheKey: `widget_${type}`,
            globalName: runtimeDef.global,
            scriptPath: runtimeDef.script
        });
    }

    async ensureExerciseTypesLoaded() {
        return this.ensureGlobalLoaded({
            cacheKey: 'base_exercise_types',
            globalName: 'ExerciseQuestionTypes',
            scriptPath: 'base/ExerciseQuestionTypes.js'
        });
    }

    async ensurePedagogyWidgetLoaded() {
        return this.ensureGlobalLoaded({
            cacheKey: 'base_pedagogy_widget',
            globalName: 'PedagogyPathWidget',
            scriptPath: 'base/PedagogyPathWidget.js'
        });
    }

    async ensureGlobalLoaded({ cacheKey, globalName, scriptPath }) {
        if (!cacheKey || !globalName || !scriptPath) return false;
        if (typeof window !== 'undefined' && window[globalName]) return true;
        if (typeof document === 'undefined') return false;

        if (!ConceptPage._assetPromises) ConceptPage._assetPromises = {};
        if (ConceptPage._assetPromises[cacheKey]) return ConceptPage._assetPromises[cacheKey];

        const scriptName = scriptPath.split('/').pop();
        ConceptPage._assetPromises[cacheKey] = new Promise((resolve) => {
            const existing = Array.from(document.scripts).find((s) => (s.src || '').includes(scriptName));
            if (existing) {
                if (window[globalName]) {
                    resolve(true);
                    return;
                }
                existing.addEventListener('load', () => resolve(Boolean(window[globalName])), { once: true });
                existing.addEventListener('error', () => resolve(false), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = this.resolveSharedScriptPath(scriptPath);
            script.onload = () => resolve(Boolean(window[globalName]));
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        });

        return ConceptPage._assetPromises[cacheKey];
    }

    resolveSharedScriptPath(scriptPath) {
        const conceptScript = Array.from(document.scripts).find((s) => /shared\/components\/base\/ConceptPage\.js($|\?)/.test(s.src || ''));
        let url;
        if (conceptScript) {
            url = conceptScript.src.replace(/base\/ConceptPage\.js($|\?.*)/, `${scriptPath}$1`);
        } else {
            url = `../shared/components/${scriptPath}`;
        }
        // En développement local, invalide le cache à chaque rechargement de page.
        if (_OEI_DEV) {
            url += (url.includes('?') ? '&' : '?') + '_dev=' + _OEI_DEV;
        }
        return url;
    }

    createSpeedController(sliderId = 'speedSlider', labelId = 'speedLabel') {
        if (typeof OEIUtils === 'undefined' || !OEIUtils.SpeedController) {
            return null;
        }
        return new OEIUtils.SpeedController(sliderId, labelId);
    }

    mountPseudocodeInspector(options = {}) {
        if (typeof PseudocodeSupport === 'undefined') {
            return false;
        }
        return PseudocodeSupport.mountFromData(this.data, options);
    }

    cleanupRuntimeArtifacts() {
        if (this.inlineExerciseWidget && typeof this.inlineExerciseWidget.destroy === 'function') {
            this.inlineExerciseWidget.destroy();
        }
        this.inlineExerciseWidget = null;

        this.widgetInstances.forEach((instance) => {
            if (instance && typeof instance.destroy === 'function') {
                try {
                    instance.destroy();
                } catch (error) {
                    console.warn('Widget destroy failed:', error);
                }
            }
        });
        this.widgetInstances = [];
    }

    destroy() {
        this.cleanupRuntimeArtifacts();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConceptPage;
}

if (typeof window !== 'undefined') {
    window.ConceptPage = ConceptPage;
}

class InlineExerciseWidget {
    constructor(root, exercisesData) {
        this.root = root;
        this.exercises = exercisesData;
        this.state = {
            index: 0,
            score: 0,
            answers: {}
        };
        this.questionEl = null;
        this.progressEl = null;
        this.scoreEl = null;
        this.feedbackEl = null;
        this.controls = {};
        this.handlers = {};
        this.questionBindController = null;
    }

    init() {
        this.questionEl = this.root.querySelector('[data-role="question"]');
        this.progressEl = this.root.querySelector('[data-role="progress"]');
        this.scoreEl = this.root.querySelector('[data-role="score"]');
        this.feedbackEl = this.root.querySelector('[data-role="feedback"]');
        this.controls.prev = this.root.querySelector('[data-role="prev"]');
        this.controls.next = this.root.querySelector('[data-role="next"]');
        this.controls.submit = this.root.querySelector('[data-role="submit"]');
        this.controls.reset = this.root.querySelector('[data-role="reset"]');

        this.handlers.prev = () => this.navigate(-1);
        this.handlers.next = () => this.navigate(1);
        this.handlers.submit = () => this.submit();
        this.handlers.reset = () => this.reset();

        this.controls.prev?.addEventListener('click', this.handlers.prev);
        this.controls.next?.addEventListener('click', this.handlers.next);
        this.controls.submit?.addEventListener('click', this.handlers.submit);
        this.controls.reset?.addEventListener('click', this.handlers.reset);
        this.render();
    }

    questions() {
        return Array.isArray(this.exercises?.questions) ? this.exercises.questions : [];
    }

    currentQuestion() {
        return this.questions()[this.state.index] || null;
    }

    getStored() {
        return this.state.answers[String(this.state.index)];
    }

    setStored(value) {
        this.state.answers[String(this.state.index)] = value;
    }

    component(question) {
        return window.ExerciseQuestionTypes ? window.ExerciseQuestionTypes.get(question.type) : null;
    }

    render() {
        const q = this.currentQuestion();
        this.cleanupQuestionBindings();
        if (!q || !this.questionEl) {
            if (this.questionEl) this.questionEl.innerHTML = '<p class="section-description">Aucun exercice disponible.</p>';
            return;
        }
        const comp = this.component(q);
        this.questionEl.innerHTML = comp ? comp.render(q, this.getStored()) : '<p class="section-description">Type d’exercice non supporté.</p>';
        if (comp && typeof comp.bind === 'function') {
            const bindContext = {};
            if (typeof AbortController !== 'undefined') {
                this.questionBindController = new AbortController();
                bindContext.signal = this.questionBindController.signal;
            }
            comp.bind(this.questionEl, q, bindContext);
        }
        this.renderQuestionPedagogyMeta(q);
        this.feedback('');
        this.renderHeader();
    }

    renderQuestionPedagogyMeta(question) {
        if (!this.questionEl || !question) return;
        const chips = [];
        if (question.difficulty) chips.push({ kind: 'difficulty', value: question.difficulty });
        if (question.competency) chips.push({ kind: 'competency', value: question.competency });
        const hintText = this.resolveQuestionHint(question);
        if (!chips.length && !question.learningGoal && !hintText) return;

        const container = document.createElement('div');
        container.className = 'exercise-question-meta';

        if (chips.length) {
            const chipsRow = document.createElement('div');
            chipsRow.className = 'exercise-pills';
            chips.forEach((chip) => {
                const span = document.createElement('span');
                span.className = `exercise-pill exercise-pill--${chip.kind}`;
                span.textContent = chip.value;
                chipsRow.appendChild(span);
            });
            container.appendChild(chipsRow);
        }

        if (question.learningGoal) {
            const goal = document.createElement('div');
            goal.className = 'exercise-goal';
            goal.textContent = `But: ${question.learningGoal}`;
            container.appendChild(goal);
        }

        if (hintText) {
            const hintDetails = document.createElement('details');
            hintDetails.className = 'exercise-hint';
            const summary = document.createElement('summary');
            summary.textContent = 'Indice';
            const hintBody = document.createElement('div');
            hintBody.className = 'exercise-hint-body';
            hintBody.textContent = hintText;
            hintDetails.appendChild(summary);
            hintDetails.appendChild(hintBody);
            container.appendChild(hintDetails);
        }

        this.questionEl.appendChild(container);
    }

    resolveQuestionHint(question) {
        if (!question || typeof question !== 'object') return '';
        const inlineHint = this.sanitizeHintText(question.hint);
        if (inlineHint) return inlineHint;
        const incorrectHint = this.sanitizeHintText(question.hintIncorrect);
        if (incorrectHint) return incorrectHint;
        const goal = typeof question.learningGoal === 'string' ? question.learningGoal.trim() : '';
        if (!goal) return '';
        return `Reviens a l'objectif de la question: ${goal}`;
    }

    sanitizeHintText(value) {
        if (typeof value !== 'string') return '';
        let text = value.trim();
        if (!text) return '';

        const leakTokens = [
            ' Indice lexical:',
            ' Debut attendu:',
            ' Fin attendue:',
            " Point d'ancrage:",
            ' Cible:',
            ' Champs prioritaires:',
            ' Appui utile:',
            ' Ecarte la piste ',
            ' Nombre de reponses correctes attendu:'
        ];
        leakTokens.forEach((token) => {
            const idx = text.indexOf(token);
            if (idx !== -1) text = text.slice(0, idx).trim();
        });

        const firstSentence = text.match(/^.*?[.!?](?:\s|$)/);
        if (firstSentence && firstSentence[0]) {
            text = firstSentence[0].trim();
        }
        return text;
    }

    renderHeader() {
        const total = this.questions().length;
        if (this.progressEl) this.progressEl.textContent = `Question ${this.state.index + 1}/${total}`;
        if (this.scoreEl) this.scoreEl.textContent = `Score: ${this.state.score}/${total}`;
        const prev = this.root.querySelector('[data-role="prev"]');
        const next = this.root.querySelector('[data-role="next"]');
        if (prev) prev.disabled = this.state.index <= 0;
        if (next) next.disabled = this.state.index >= total - 1;
    }

    navigate(delta) {
        const n = this.state.index + delta;
        if (n < 0 || n >= this.questions().length) return;
        this.state.index = n;
        this.render();
    }

    feedback(text, type = '') {
        if (!this.feedbackEl) return;
        this.feedbackEl.textContent = text || '';
        this.feedbackEl.className = `feedback${type ? ` ${type}` : ''}`;
    }

    submit() {
        const q = this.currentQuestion();
        if (!q) return;
        const comp = this.component(q);
        if (!comp) {
            this.feedback('Type non supporté.', 'warning');
            return;
        }
        const read = comp.read(this.questionEl, q);
        if (!read.ok) {
            this.feedback(read.error || 'Réponse invalide.', 'warning');
            return;
        }
        this.setStored(read.value);
        const verdict = comp.evaluate(q, read.value) || { ok: false };
        const scoredKey = `scored_${this.state.index}`;
        if (verdict.ok && !this.state.answers[scoredKey]) {
            this.state.score += 1;
            this.state.answers[scoredKey] = true;
        }
        const explain = q.explanation ? ` ${q.explanation}` : '';
        if (verdict.ok) {
            this.feedback(`Correct.${explain}`, 'ok');
        } else {
            const expected = verdict.expectedText ? ` Réponse attendue: ${verdict.expectedText}.` : '';
            const hint = this.resolveQuestionHint(q) || this.sanitizeHintText(verdict.hint || '');
            const hintSentence = hint ? hint.replace(/[.!?]+$/, '') : '';
            const hintText = hintSentence ? ` Piste: ${hintSentence}.` : '';
            const remediation = q.remediation ? ` ${q.remediation}` : '';
            this.feedback(`Incorrect.${expected}${hintText}${explain}${remediation}`, 'bad');
        }
        this.renderHeader();
    }

    reset() {
        this.state = { index: 0, score: 0, answers: {} };
        this.render();
    }

    cleanupQuestionBindings() {
        if (!this.questionBindController) return;
        this.questionBindController.abort();
        this.questionBindController = null;
    }

    detachControlHandlers() {
        this.controls.prev?.removeEventListener('click', this.handlers.prev);
        this.controls.next?.removeEventListener('click', this.handlers.next);
        this.controls.submit?.removeEventListener('click', this.handlers.submit);
        this.controls.reset?.removeEventListener('click', this.handlers.reset);
    }

    destroy() {
        this.cleanupQuestionBindings();
        this.detachControlHandlers();
        this.controls = {};
        this.handlers = {};
        this.questionEl = null;
        this.progressEl = null;
        this.scoreEl = null;
        this.feedbackEl = null;
    }
}
