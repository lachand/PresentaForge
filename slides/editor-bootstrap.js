import { loadClassicScripts, reportBootstrapFailure } from '../shared/slides/legacy-bootstrap-loader.js';

const EDITOR_BOOTSTRAP_SCRIPTS = Object.freeze([
    '../shared/components/base/WidgetRegistry.js',
    '../vendor/qrcode-generator/1.4.4/qrcode.min.js',
    '../shared/slides/storage.js?v=2',
    '../shared/slides/theme-runtime.js?v=1',
    '../shared/slides/widget-plugins.js?v=2',
    '../shared/slides/design-tokens.js?v=2',
    '../shared/slides/background-utils.js?v=1',
    '../shared/slides/slides-special-runtime.js?v=1',
    '../shared/slides/slides-core.js?v=28',
    '../shared/slides/slides-editor.js?v=14',
    '../shared/slides/import-pipeline-bundle.js?v=2',
    '../shared/slides/import-pipeline.js?v=5',
    '../shared/slides/slides-canvas-helpers.js?v=1',
    '../shared/slides/slides-canvas.js?v=19',
    '../shared/slides/editor-dialog.js',
    '../shared/slides/editor-utils.js?v=8',
    '../shared/slides/editor-ribbon.js?v=1',
    '../shared/slides/editor-ai-settings.js?v=1',
    '../shared/slides/editor-runtime-state.js?v=1',
    '../shared/slides/editor-ai-pipeline.js?v=1',
    '../shared/slides/editor-ui.js?v=23',
    '../shared/slides/editor-clipboard.js?v=8',
    '../shared/slides/editor-search.js?v=8',
    '../shared/slides/editor-slide-ops.js?v=9',
    '../shared/slides/editor-command-palette.js?v=8',
    '../shared/slides/editor-theme-design.js?v=15',
    '../shared/slides/editor-slide-styling.js?v=8',
    '../shared/slides/editor-zoom-view.js?v=9',
    '../shared/slides/editor-widget-picker.js?v=2',
    '../shared/slides/editor-props-panel.js?v=20',
    '../shared/slides/editor-format-tab.js?v=12',
    '../shared/slides/editor-insert.js?v=10',
    '../shared/slides/editor-block-presets.js?v=4',
    '../shared/slides/editor-context-menu.js?v=9',
    '../shared/slides/editor-preview.js?v=13',
    '../shared/slides/editor-file-io.js?v=11',
    '../shared/slides/ui-icons.js?v=2',
    '../shared/slides/editor-review-comments.js?v=1',
    '../shared/slides/editor-save.js?v=11',
    '../shared/slides/editor-import-pptx.js?v=10',
    '../shared/slides/editor-import-pdf.js?v=1',
    '../shared/slides/editor-markdown.js?v=8',
    '../shared/slides/editor-narration.js?v=9',
    '../shared/slides/editor-export.js?v=14',
    '../shared/slides/editor-timeline.js?v=8',
    '../shared/slides/editor-quick-insert.js?v=12',
    '../shared/slides/editor-masters.js?v=10',
    '../shared/slides/editor-enhancements.js?v=3',
    '../shared/slides/editor-resize.js?v=10',
    '../shared/slides/editor-checker.js?v=12',
    '../shared/slides/editor-bindings.js?v=22',
    '../shared/slides/editor-main.js?v=1',
]);

loadClassicScripts(EDITOR_BOOTSTRAP_SCRIPTS, {
    onProgress(source) {
        window.dispatchEvent(new CustomEvent('oei:editor-bootstrap-progress', { detail: { source } }));
    },
}).then(() => {
    window.dispatchEvent(new CustomEvent('oei:editor-bootstrap-ready'));
}).catch((error) => {
    reportBootstrapFailure('editor-bootstrap', error);
});
