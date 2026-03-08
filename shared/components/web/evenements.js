class EvenementsPage extends ConceptPage {
    async init() {
        await super.init();
        this.postRenderDiagnostics();
    }

    postRenderDiagnostics() {
        const expectedWidgets = Array.isArray(this.data?.content)
            ? this.data.content.filter((block) => block?.type === 'widget' && typeof block.widget === 'string')
            : [];
        if (!expectedWidgets.length) return;

        const mounted = Array.isArray(this.widgetInstances) ? this.widgetInstances.length : 0;
        if (mounted >= expectedWidgets.length) return;

        const container = document.getElementById(this.courseContainerId || 'course-container');
        if (!container) return;
        const note = document.createElement('div');
        note.className = 'card';
        note.innerHTML = '<p class="section-description">Attention: certains widgets d\'evenements ne se sont pas montes correctement. Verifiez la console ou rechargez la page.</p>';
        container.prepend(note);
    }
}

if (typeof window !== 'undefined') {
    window.EvenementsPage = EvenementsPage;
}
