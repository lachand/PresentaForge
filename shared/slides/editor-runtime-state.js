/**
 * @module slides/editor-runtime-state
 * Runtime state bridge for editor scripts.
 * Keeps legacy globals usable while exposing explicit state accessors.
 */
(function attachEditorRuntimeState(root) {
    'use strict';

    const RUNTIME_KEY = '__oeiEditorRuntime';

    const asFunction = value => (typeof value === 'function' ? value : null);
    const normalizeScale = (value, fallback = 1) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return fallback;
        return n;
    };

    /**
     * @param {Window & typeof globalThis} [globalObj]
     */
    function createEditorRuntimeState(globalObj = root) {
        const state = globalObj[RUNTIME_KEY] || (globalObj[RUNTIME_KEY] = {});
        const read = (key, fallback = null) => (state[key] !== undefined ? state[key] : fallback);
        const write = (key, value) => {
            state[key] = value;
            return value;
        };

        return {
            get editor() { return read('editor', null); },
            set editor(value) { write('editor', value || null); },

            get notify() { return asFunction(read('notify', null)); },
            set notify(value) { write('notify', asFunction(value)); },

            get esc() { return asFunction(read('esc', null)); },
            set esc(value) { write('esc', asFunction(value)); },

            setPreviewScale(value) {
                const next = normalizeScale(value, 1);
                write('previewScale', next);
                return next;
            },
            getPreviewScale() {
                const resolver = asFunction(read('previewScaleResolver', null));
                if (resolver) return normalizeScale(resolver(), 1);
                return normalizeScale(read('previewScale', 1), 1);
            },
            setPreviewScaleResolver(resolver) {
                write('previewScaleResolver', asFunction(resolver));
            },

            setCanvasEditor(value) {
                const next = value || null;
                write('canvasEditor', next);
                return next;
            },
            getCanvasEditor() {
                const resolver = asFunction(read('canvasEditorResolver', null));
                if (resolver) return resolver() || null;
                return read('canvasEditor', null) || null;
            },
            setCanvasEditorResolver(resolver) {
                write('canvasEditorResolver', asFunction(resolver));
            },

            bindLegacyGlobals(ctx = {}) {
                if (!ctx || typeof ctx !== 'object') return this.snapshot();
                if ('editor' in ctx) this.editor = ctx.editor;
                if ('notify' in ctx) this.notify = ctx.notify;
                if ('esc' in ctx) this.esc = ctx.esc;
                if ('previewScale' in ctx) this.setPreviewScale(ctx.previewScale);
                if ('getPreviewScale' in ctx) this.setPreviewScaleResolver(ctx.getPreviewScale);
                if ('canvasEditor' in ctx) this.setCanvasEditor(ctx.canvasEditor);
                if ('getCanvasEditor' in ctx) this.setCanvasEditorResolver(ctx.getCanvasEditor);
                return this.snapshot();
            },

            resolveContext(fallbacks = {}) {
                const safeFallbacks = (fallbacks && typeof fallbacks === 'object') ? fallbacks : {};
                return {
                    editor: this.editor || safeFallbacks.editor || null,
                    notify: this.notify || asFunction(safeFallbacks.notify),
                    esc: this.esc || asFunction(safeFallbacks.esc),
                    previewScale: this.getPreviewScale(),
                    canvasEditor: this.getCanvasEditor() || safeFallbacks.canvasEditor || null,
                };
            },

            snapshot() {
                return {
                    editor: this.editor,
                    hasNotify: typeof this.notify === 'function',
                    hasEsc: typeof this.esc === 'function',
                    previewScale: this.getPreviewScale(),
                    hasCanvasEditor: !!this.getCanvasEditor(),
                };
            },
        };
    }

    root.OEIEditorRuntimeState = Object.freeze({
        create: createEditorRuntimeState,
    });
})(window);
