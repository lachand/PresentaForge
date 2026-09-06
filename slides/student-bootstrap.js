import { loadClassicScripts, reportBootstrapFailure } from '../shared/slides/legacy-bootstrap-loader.js';

const STUDENT_BOOTSTRAP_SCRIPTS = Object.freeze([
    '../shared/components/base/WidgetRegistry.js',
    '../shared/slides/storage.js?v=2',
    '../shared/slides/theme-runtime.js?v=1',
    '../shared/slides/design-tokens.js?v=2',
    '../shared/slides/realtime-contract.js?v=7',
    '../shared/slides/network-session.js?v=2',
    '../shared/slides/relay-config.js?v=1',
    '../shared/slides/background-utils.js?v=1',
    // Sécurité (chantier 8) — DOMPurify vendored + wrapper liste blanche, chargés avant
    // slides-core.js (formatInlineRichText) et le rendu du deck.
    '../vendor/dompurify/3.4.14/purify.min.js',
    '../shared/slides/html-sanitizer.js?v=1',
    // Rendering stack — student renders the deck locally (Lot 20) via SlidesRenderer /
    // SlidesThemes / OEISlidesSpecialRuntime instead of receiving pre-rendered HTML.
    '../shared/slides/slides-special-math-runtime.js?v=1',
    '../shared/slides/slides-special-code-runtime.js?v=1',
    '../shared/slides/slides-special-quiz-runtime.js?v=1',
    '../shared/slides/slides-special-live-runtime.js?v=1',
    '../shared/slides/slides-special-runtime.js?v=1',
    '../shared/slides/slides-typography.js?v=1',
    '../shared/slides/element-style-schema.js?v=1',
    '../shared/slides/slides-core.js?v=33',
    '../shared/slides/slides-themes.js?v=1',
    '../shared/slides/slides-diagram-renderer.js?v=1',
    '../shared/slides/slides-renderer-canvas.js?v=3',
    '../shared/slides/ui-icons.js?v=2',
    '../shared/slides/student-runtime-bundle.js?v=1',
    // Student app modules (Lot 20 découpe de student-main.js)
    '../shared/slides/student-storage.js?v=2',
    '../shared/slides/student-render.js?v=4',
    '../shared/slides/student-revision.js?v=6',
    '../shared/slides/student-quiz.js?v=2',
    '../shared/slides/student-transport.js?v=2',
    '../vendor/qrcode-generator/1.4.4/qrcode.min.js',
    '../vendor/peerjs/1.5.5/peerjs.min.js',
    'student-main.js?v=8',
]);

loadClassicScripts(STUDENT_BOOTSTRAP_SCRIPTS, {
    onProgress(source) {
        window.dispatchEvent(new CustomEvent('oei:student-bootstrap-progress', { detail: { source } }));
    },
}).then(() => {
    window.dispatchEvent(new CustomEvent('oei:student-bootstrap-ready'));
}).catch((error) => {
    reportBootstrapFailure('student-bootstrap', error);
});
