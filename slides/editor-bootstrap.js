import { loadClassicScriptGroups, reportBootstrapFailure } from '../shared/slides/legacy-bootstrap-loader.js';

// Scripts are organized in groups: scripts within a group are loaded in parallel (network + inject),
// groups are sequential (each group waits for the previous to complete).
// Rule: scripts within a group must have no inter-dependencies.
const EDITOR_BOOTSTRAP_GROUPS = Object.freeze([
    // Group 1: standalone vendor/registry — no inter-dependencies
    [
        '../shared/components/base/WidgetRegistry.js',
        '../vendor/qrcode-generator/1.4.4/qrcode.min.js',
        '../shared/slides/storage.js?v=2',
    ],
    // Storage-dependent infrastructure (sequential)
    ['../shared/slides/theme-runtime.js?v=1'],
    ['../shared/slides/widget-plugins.js?v=2'],
    ['../shared/slides/design-tokens.js?v=2'],
    ['../shared/slides/background-utils.js?v=1'],
    // Group 2: special sub-runtimes — each registers itself independently, no cross-deps
    [
        '../shared/slides/slides-special-math-runtime.js?v=1',
        '../shared/slides/slides-special-code-runtime.js?v=1',
        '../shared/slides/slides-special-quiz-runtime.js?v=1',
        '../shared/slides/slides-special-live-runtime.js?v=1',
    ],
    // Orchestrator (depends on all 4 sub-runtimes above)
    ['../shared/slides/slides-special-runtime.js?v=1'],
    ['../shared/slides/slides-typography.js?v=1'],
    ['../shared/slides/slides-core.js?v=31'],
    ['../shared/slides/slides-themes.js?v=1'],
    ['../shared/slides/slides-diagram-renderer.js?v=1'],
    ['../shared/slides/slides-renderer-canvas.js?v=1'],
    ['../shared/slides/slides-editor.js?v=14'],
    ['../shared/slides/import-pipeline-bundle.js?v=2'],
    ['../shared/slides/import-pipeline.js?v=5'],
    // Group 3: canvas sub-runtimes — each registers itself on window.OEISlidesCanvas*,
    // consumed only by slides-canvas.js below. No cross-dependencies between them.
    [
        '../shared/slides/slides-canvas-helpers.js?v=1',
        '../shared/slides/slides-canvas-code-runtime.js?v=1',
        '../shared/slides/slides-canvas-guides.js?v=1',
        '../shared/slides/slides-canvas-widget-runtime.js?v=1',
        '../shared/slides/slides-canvas-overflow-runtime.js?v=1',
        '../shared/slides/slides-canvas-connectors-runtime.js?v=1',
        '../shared/slides/slides-canvas-dom-runtime.js?v=1',
        '../shared/slides/slides-canvas-selection-runtime.js?v=1',
        '../shared/slides/slides-canvas-render-runtime.js?v=1',
        '../shared/slides/slides-canvas-events-runtime.js?v=1',
        '../shared/slides/slides-canvas-transform-runtime.js?v=1',
        '../shared/slides/slides-canvas-special-runtime.js?v=1',
        '../shared/slides/slides-canvas-inline-edit-runtime.js?v=1',
        '../shared/slides/slides-canvas-content-runtime.js?v=1',
    ],
    // CanvasEditor class (depends on all sub-runtimes above)
    ['../shared/slides/slides-canvas.js?v=21'],
    // Editor modules (mostly sequential — each may depend on previously registered globals)
    ['../shared/slides/editor-dialog.js'],
    ['../shared/slides/editor-utils.js?v=8'],
    ['../shared/slides/editor-ribbon.js?v=1'],
    ['../shared/slides/editor-ai-settings.js?v=1'],
    ['../shared/slides/editor-runtime-state.js?v=1'],
    ['../shared/slides/editor-ai-pipeline.js?v=1'],
    ['../shared/slides/editor-ui.js?v=23'],
    ['../shared/slides/editor-clipboard.js?v=8'],
    ['../shared/slides/editor-search.js?v=8'],
    ['../shared/slides/editor-slide-ops.js?v=9'],
    ['../shared/slides/editor-command-palette.js?v=8'],
    ['../shared/slides/editor-theme-design.js?v=15'],
    ['../shared/slides/editor-slide-styling.js?v=8'],
    ['../shared/slides/editor-zoom-view.js?v=9'],
    ['../shared/slides/editor-widget-picker.js?v=2'],
    ['../shared/slides/editor-diagram-panel.js?v=1'],
    ['../shared/slides/editor-props-panel.js?v=21'],
    ['../shared/slides/editor-format-tab.js?v=12'],
    ['../shared/slides/editor-insert.js?v=10'],
    ['../shared/slides/editor-block-presets.js?v=4'],
    ['../shared/slides/editor-context-menu.js?v=9'],
    ['../shared/slides/editor-preview.js?v=13'],
    ['../shared/slides/editor-file-io.js?v=11'],
    ['../shared/slides/ui-icons.js?v=2'],
    ['../shared/slides/editor-review-comments.js?v=1'],
    ['../shared/slides/editor-save.js?v=11'],
    // Group 4: import handlers — each registers itself independently, no cross-deps
    [
        '../shared/slides/editor-import-pptx.js?v=10',
        '../shared/slides/editor-import-pdf.js?v=1',
        '../shared/slides/editor-markdown.js?v=8',
        '../shared/slides/editor-narration.js?v=9',
    ],
    // Export pipeline (sequential: media → main → pptx+qr)
    ['../shared/slides/editor-export-media.js?v=1'],
    ['../shared/slides/editor-export.js?v=15'],
    // Group 5: export siblings — both depend on export.js, not on each other
    [
        '../shared/slides/editor-export-pptx.js?v=1',
        '../shared/slides/editor-export-qr.js?v=1',
    ],
    ['../shared/slides/editor-timeline.js?v=8'],
    ['../shared/slides/editor-quick-insert.js?v=12'],
    ['../shared/slides/editor-masters.js?v=10'],
    ['../shared/slides/editor-enhancements.js?v=3'],
    ['../shared/slides/editor-resize.js?v=10'],
    ['../shared/slides/editor-checker.js?v=12'],
    ['../shared/slides/editor-bindings.js?v=22'],
    ['../shared/slides/editor-main.js?v=1'],
]);

loadClassicScriptGroups(EDITOR_BOOTSTRAP_GROUPS, {
    onProgress(source) {
        window.dispatchEvent(new CustomEvent('oei:editor-bootstrap-progress', { detail: { source } }));
    },
}).then(() => {
    window.dispatchEvent(new CustomEvent('oei:editor-bootstrap-ready'));
}).catch((error) => {
    reportBootstrapFailure('editor-bootstrap', error);
});
