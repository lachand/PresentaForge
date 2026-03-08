class LayoutEngine {
    constructor(container, layoutConfig) {
        this.container = container;
        this.layout = LayoutEngine.normalizeLayout(layoutConfig);
        this.activeBreakpoint = null;
        this._onResize = null;
    }

    static normalizeLayout(layoutConfig) {
        if (!layoutConfig || typeof layoutConfig !== 'object') {
            throw new Error('LayoutEngine: invalid layout config');
        }

        const normalized = {
            version: layoutConfig.version || 1,
            pageId: layoutConfig.pageId || '',
            containerSelector: layoutConfig.containerSelector || '',
            breakpoints: {}
        };

        const sourceBreakpoints = layoutConfig.breakpoints || {};
        Object.keys(sourceBreakpoints).forEach((name) => {
            const bp = sourceBreakpoints[name] || {};
            const columns = Array.isArray(bp.columns) ? bp.columns.filter(Boolean) : [];
            const blocks = (bp.blocks && typeof bp.blocks === 'object') ? bp.blocks : {};
            normalized.breakpoints[name] = {
                minWidth: Number.isFinite(bp.minWidth) ? bp.minWidth : 0,
                columns: columns.length > 0 ? columns : ['1fr'],
                gap: typeof bp.gap === 'string' && bp.gap.trim() ? bp.gap.trim() : '1rem',
                blocks
            };
        });

        return normalized;
    }

    static async fetchLayout(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('LayoutEngine: unable to load layout: ' + url);
        }
        return response.json();
    }

    static readLocalLayout(pageId) {
        if (!pageId || typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem('oei-layout:' + pageId);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn('LayoutEngine: invalid local layout override for', pageId, e);
            return null;
        }
    }

    static writeLocalLayout(pageId, layoutObject) {
        if (!pageId || typeof localStorage === 'undefined') return;
        localStorage.setItem('oei-layout:' + pageId, JSON.stringify(layoutObject));
    }

    static clearLocalLayout(pageId) {
        if (!pageId || typeof localStorage === 'undefined') return;
        localStorage.removeItem('oei-layout:' + pageId);
    }

    static async mountFromUrl(options) {
        const opts = options || {};
        const container = (typeof opts.container === 'string')
            ? document.querySelector(opts.container)
            : opts.container;
        if (!container) return null;

        const pageId = opts.pageId || '';
        const useLocalPreview = !!opts.useLocalPreview;
        let layout = null;

        if (useLocalPreview && pageId) {
            layout = LayoutEngine.readLocalLayout(pageId);
        }
        if (!layout && opts.url) {
            layout = await LayoutEngine.fetchLayout(opts.url);
        }
        if (!layout) return null;

        const engine = new LayoutEngine(container, layout);
        engine.start();
        return engine;
    }

    getBreakpointsSorted() {
        return Object.entries(this.layout.breakpoints)
            .sort((a, b) => (b[1].minWidth || 0) - (a[1].minWidth || 0));
    }

    resolveBreakpoint(widthPx) {
        const ordered = this.getBreakpointsSorted();
        for (let i = 0; i < ordered.length; i++) {
            const [name, cfg] = ordered[i];
            if (widthPx >= (cfg.minWidth || 0)) return name;
        }
        return ordered.length > 0 ? ordered[ordered.length - 1][0] : null;
    }

    applyBreakpoint(name) {
        const bp = this.layout.breakpoints[name];
        if (!bp) return;

        this.container.style.display = 'grid';
        this.container.style.gridTemplateColumns = bp.columns.join(' ');
        this.container.style.gap = bp.gap || '1rem';

        const blockElements = this.container.querySelectorAll('[data-layout-block]');
        blockElements.forEach((el) => {
            const blockId = el.getAttribute('data-layout-block');
            const blockCfg = bp.blocks[blockId] || {};

            if (Number.isFinite(blockCfg.order)) {
                el.style.order = String(blockCfg.order);
            } else {
                el.style.removeProperty('order');
            }

            const spanValue = parseInt(blockCfg.span, 10);
            if (Number.isFinite(spanValue) && spanValue > 0) {
                el.style.gridColumn = 'span ' + spanValue;
            } else {
                el.style.removeProperty('grid-column');
            }
        });

        this.activeBreakpoint = name;
    }

    applyCurrent() {
        const bpName = this.resolveBreakpoint(window.innerWidth);
        if (!bpName) return;
        if (bpName !== this.activeBreakpoint) {
            this.applyBreakpoint(bpName);
        }
    }

    updateLayout(nextLayoutConfig) {
        this.layout = LayoutEngine.normalizeLayout(nextLayoutConfig);
        this.activeBreakpoint = null;
        this.applyCurrent();
    }

    start() {
        this.applyCurrent();
        this._onResize = () => this.applyCurrent();
        window.addEventListener('resize', this._onResize);
    }

    destroy() {
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.LayoutEngine = LayoutEngine;
}
