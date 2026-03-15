import { loadClassicScripts, reportBootstrapFailure } from '../shared/slides/legacy-bootstrap-loader.js';

const STUDENT_BOOTSTRAP_SCRIPTS = Object.freeze([
    '../shared/components/base/WidgetRegistry.js',
    '../shared/slides/storage.js?v=2',
    '../shared/slides/theme-runtime.js?v=1',
    '../shared/slides/realtime-contract.js?v=3',
    '../shared/slides/network-session.js?v=2',
    '../shared/slides/ui-icons.js?v=2',
    '../shared/slides/student-runtime-bundle.js?v=1',
    '../vendor/peerjs/1.5.5/peerjs.min.js',
    'student-main.js?v=2',
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
