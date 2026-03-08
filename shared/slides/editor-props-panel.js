/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-props-panel
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-props-panel.js"></script>
 */
/* editor-props-panel.js — Properties panel for canvas element and connector editing */

const CODE_EXAMPLE_LABEL_PRESETS = ['Exemple', 'Correction', 'Solution', 'Astuce', 'Bonnes pratiques', 'Erreur frequente', 'Demo', 'Synthese'];
const CODE_LABEL_PRESETS = ['Code', 'Snippet', 'API', 'Debug', 'Performance', 'Bonnes pratiques', 'Correction', 'Erreur frequente', 'Analyse'];
const DEFINITION_LABEL_PRESETS = ['Definition', 'Notion', 'Rappel', 'Theoreme', 'Propriete', 'Attention', 'Erreur frequente', 'A retenir', 'Vocabulaire'];
const DEFINITION_EXAMPLE_LABEL_PRESETS = ['Exemple', 'Application', 'Contre-exemple', 'Cas limite', 'Remarque'];
const CARD_TITLE_PRESETS = ['Objectif', 'Consigne', 'Correction', 'Astuce', 'Erreur frequente', 'Checklist', 'A retenir'];
const CALLOUT_LABEL_PRESETS = ['Info', 'Attention', 'Important', 'Astuce', 'A retenir', 'Erreur frequente'];
const EXERCISE_TITLE_PRESETS = ['Exercice guide', 'Mise en pratique', 'Atelier', 'Challenge', 'Correction guidee'];
const BEFORE_AFTER_TITLE_PRESETS = ['Avant / Après', 'État initial / cible', 'Problème / solution', 'Comparaison'];
const MISTAKE_TITLE_PRESETS = ['Erreur frequente vs correction', 'Piege classique', 'Mauvaise approche vs bonne approche'];
const RUBRIC_TITLE_PRESETS = ['Grille d’évaluation', 'Barème', 'Critères de réussite'];
const TERMINAL_LABEL_PRESETS = ['Session terminal', 'Commandes', 'Sortie terminal', 'Debug CLI', 'Trace execution'];
const ASSESSMENT_LABEL_PRESETS = ['Quiz', 'Exercice', 'Evaluation', 'Correction'];
const LABEL_TONE_PRESETS = [
    { value: 'auto', label: 'Auto (selon label)' },
    { value: 'primary', label: 'Primaire' },
    { value: 'accent', label: 'Accent' },
    { value: 'info', label: 'Info (bleu)' },
    { value: 'success', label: 'Succes (vert)' },
    { value: 'warning', label: 'Attention (orange)' },
    { value: 'danger', label: 'Danger (rouge)' },
];

function _normalizeTonePreset(value) {
    const tone = String(value || '').trim().toLowerCase();
    return LABEL_TONE_PRESETS.some((item) => item.value === tone) ? tone : 'auto';
}

function _toneOptionsHtml(selectedTone = 'auto') {
    const current = _normalizeTonePreset(selectedTone);
    return LABEL_TONE_PRESETS
        .map((item) => `<option value="${escAttr(item.value)}"${item.value === current ? ' selected' : ''}>${esc(item.label)}</option>`)
        .join('');
}

function updatePropsPanel() {
    const panel = document.getElementById('props-content');
    const propsPanel = document.getElementById('props-panel');
    if (!panel || !propsPanel) return;
    const isCanvas = editor.currentSlide?.type === 'canvas';
    const el = isCanvas && canvasEditor?.getSelected();

    if (!el) {
        // Check for connector selection
        const conn = isCanvas && canvasEditor?.getSelectedConnector();
        if (conn) {
            if (!propsPanel._userCollapsed) {
                propsPanel.classList.remove('collapsed');
                const rh = document.getElementById('resize-handle-right');
                if (rh) rh.classList.remove('hidden');
            }
            const titleEl = document.getElementById('props-title');
            if (titleEl) titleEl.textContent = 'Connecteur';
            _renderConnectorProps(panel, conn);
            _bindConnectorProps(conn);
            return;
        }
        // Collapse sidebar when nothing selected
        propsPanel.classList.add('collapsed');
        const rh = document.getElementById('resize-handle-right');
        if (rh) rh.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    // Expand sidebar when element selected (unless user manually collapsed)
    if (!propsPanel._userCollapsed) {
        propsPanel.classList.remove('collapsed');
        const rh = document.getElementById('resize-handle-right');
        if (rh) rh.classList.remove('hidden');
    }

    const type = el.type || 'text';
    const d = el.data || {};
    const typeLabels = {
        text: 'Texte',
        heading: 'Titre',
        code: 'Code',
        image: 'Image',
        shape: 'Forme',
        icon: 'Icône',
        table: 'Tableau',
        card: 'Carte',
        quote: 'Citation',
        widget: 'Widget',
        list: 'Liste',
        definition: 'Définition',
        'callout-box': 'Callout box',
        'exercise-block': 'Exercice',
        'before-after': 'Before / After',
        'mistake-fix': 'Erreur / Correction',
        'rubric-block': 'Rubric block',
        'rubrick-block': 'Rubric block',
        'code-example': 'Exemple code',
        'terminal-session': 'Session terminal',
        video: 'Vidéo',
        mermaid: 'Diagramme',
        diagramme: 'Diagramme',
        latex: 'Équation',
        timer: 'Minuteur',
        iframe: 'Iframe',
        highlight: 'Code',
        qrcode: 'QR Code',
        smartart: 'SmartArt',
        'code-live': 'Code Live',
        'quiz-live': 'Quiz',
        cloze: 'Texte à trous',
        'mcq-single': 'QCM simple',
        'drag-drop': 'Drag & Drop',
        'mcq-multi': 'QCM multi',
        'poll-likert': 'Likert live',
        'debate-mode': 'Débat live',
        'exit-ticket': 'Exit ticket',
        'postit-wall': 'Mur Post-it',
        'audience-roulette': 'Roulette',
        'room-stats': 'Stats live',
        'leaderboard-live': 'Leaderboard live',
        'swot-grid': 'SWOT',
        'decision-tree': 'Arbre de décision',
        'timeline-vertical': 'Timeline verticale',
        'code-compare': 'Code compare',
        'algo-stepper': 'Algo stepper',
        'gallery-annotable': 'Gallery annotable',
        'rank-order': 'Classement',
        'kanban-mini': 'Kanban mini',
        'myth-reality': 'Mythe / Réalité',
        'flashcards-auto': 'Flashcards',
    };
    const typeLabel = typeLabels[type] || type;

    // Update header title
    const titleEl = document.getElementById('props-title');
    if (titleEl) titleEl.textContent = `Contenu — ${typeLabel}`;

    let html = '';

    switch (type) {
        case 'text':
        case 'heading':
        case 'list':
            html = `<div class="props-empty" style="gap:6px;padding:16px">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Éditez directement<br>sur le canvas</span>
            </div>`;
            break;

        case 'definition': {
            const blockLabel = String(d.label ?? d.blockLabel ?? 'Definition').trim() || 'Definition';
            const exampleLabel = String(d.exampleLabel ?? 'Exemple').trim() || 'Exemple';
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto');
            const selectedBlockPreset = DEFINITION_LABEL_PRESETS.includes(blockLabel) ? blockLabel : '__custom__';
            const selectedExamplePreset = DEFINITION_EXAMPLE_LABEL_PRESETS.includes(exampleLabel) ? exampleLabel : '__custom__';
            const blockOptions = DEFINITION_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedBlockPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const exampleOptions = DEFINITION_EXAMPLE_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedExamplePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Definition</div>
                <div class="props-row"><label>Label bloc</label><select id="sp-def-label-preset">${blockOptions}<option value="__custom__"${selectedBlockPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte bloc</label><input type="text" id="sp-def-label" value="${escAttr(blockLabel)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-def-tone">${toneOptions}</select></div>
                <div class="props-row" style="margin-top:6px"><label>Label exemple</label><select id="sp-def-example-label-preset">${exampleOptions}<option value="__custom__"${selectedExamplePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte exemple</label><input type="text" id="sp-def-example-label" value="${escAttr(exampleLabel)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:6px;line-height:1.4">Le terme, la definition et l'exemple se modifient directement sur le canvas.</div>
            </div>`;
            break;
        }

        case 'callout-box': {
            const labelValue = String(d.label ?? 'Info').trim() || 'Info';
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto');
            const selectedPreset = CALLOUT_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = CALLOUT_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Callout box</div>
                <div class="props-row"><label>Label</label><select id="sp-callout-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-callout-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-callout-tone">${toneOptions}</select></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Message</label>
                <textarea id="sp-callout-text" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.text || '')}</textarea>
            </div>`;
            break;
        }

        case 'exercise-block': {
            const titleValue = String(d.title ?? 'Exercice guide').trim() || 'Exercice guide';
            const selectedTitlePreset = EXERCISE_TITLE_PRESETS.includes(titleValue) ? titleValue : '__custom__';
            const titleOptions = EXERCISE_TITLE_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedTitlePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const instructions = Array.isArray(d.instructions) ? d.instructions : [];
            const hints = Array.isArray(d.hints) ? d.hints : [];
            html = `<div class="props-section">
                <div class="props-section-title">Exercice</div>
                <div class="props-row"><label>Titre</label><select id="sp-ex-title-preset">${titleOptions}<option value="__custom__"${selectedTitlePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte titre</label><input type="text" id="sp-ex-title" value="${escAttr(titleValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Objectif</label>
                <textarea id="sp-ex-objective" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.objective || '')}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Contenu</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Consignes (1 par ligne)</label>
                <textarea id="sp-ex-instructions" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(instructions.join('\n'))}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Indices (1 par ligne)</label>
                <textarea id="sp-ex-hints" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(hints.join('\n'))}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Correction</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Texte correction</label>
                <textarea id="sp-ex-correction" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.correction || '')}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Afficher la correction</label><input type="checkbox" id="sp-ex-show-correction"${d.showCorrection ? ' checked' : ''}></div>
            </div>`;
            break;
        }

        case 'before-after': {
            const titleValue = String(d.title ?? 'Avant / Après').trim() || 'Avant / Après';
            const selectedTitlePreset = BEFORE_AFTER_TITLE_PRESETS.includes(titleValue) ? titleValue : '__custom__';
            const titleOptions = BEFORE_AFTER_TITLE_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedTitlePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'info');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Before / After</div>
                <div class="props-row"><label>Titre</label><select id="sp-ba-title-preset">${titleOptions}<option value="__custom__"${selectedTitlePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte titre</label><input type="text" id="sp-ba-title" value="${escAttr(titleValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-ba-tone">${toneOptions}</select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Avant</div>
                <div class="props-row"><label>Label</label><input type="text" id="sp-ba-before-label" value="${escAttr(d.beforeLabel || 'Avant')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <textarea id="sp-ba-before" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.before || '')}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Après</div>
                <div class="props-row"><label>Label</label><input type="text" id="sp-ba-after-label" value="${escAttr(d.afterLabel || 'Après')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <textarea id="sp-ba-after" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.after || '')}</textarea>
            </div>`;
            break;
        }

        case 'mistake-fix': {
            const titleValue = String(d.title ?? 'Erreur frequente vs correction').trim() || 'Erreur frequente vs correction';
            const selectedTitlePreset = MISTAKE_TITLE_PRESETS.includes(titleValue) ? titleValue : '__custom__';
            const titleOptions = MISTAKE_TITLE_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedTitlePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'danger');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Erreur / Correction</div>
                <div class="props-row"><label>Titre</label><select id="sp-mf-title-preset">${titleOptions}<option value="__custom__"${selectedTitlePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte titre</label><input type="text" id="sp-mf-title" value="${escAttr(titleValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-mf-tone">${toneOptions}</select></div>
                <div class="props-row"><label>Langage</label><select id="sp-mf-lang"><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JavaScript</option><option value="bash"${d.language === 'bash' ? ' selected' : ''}>Bash</option><option value="java"${d.language === 'java' ? ' selected' : ''}>Java</option><option value="c"${d.language === 'c' ? ' selected' : ''}>C</option><option value="html"${d.language === 'html' ? ' selected' : ''}>HTML</option><option value="css"${d.language === 'css' ? ' selected' : ''}>CSS</option><option value="sql"${d.language === 'sql' ? ' selected' : ''}>SQL</option><option value="text"${d.language === 'text' ? ' selected' : ''}>Texte</option></select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Erreur frequente</div>
                <textarea id="sp-mf-mistake" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.mistake || '')}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Correction</div>
                <textarea id="sp-mf-fix" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.fix || '')}</textarea>
            </div>`;
            break;
        }

        case 'rubric-block':
        case 'rubrick-block': {
            const titleValue = String(d.title ?? 'Grille d’évaluation').trim() || 'Grille d’évaluation';
            const selectedTitlePreset = RUBRIC_TITLE_PRESETS.includes(titleValue) ? titleValue : '__custom__';
            const titleOptions = RUBRIC_TITLE_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedTitlePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'primary');
            const toneOptions = _toneOptionsHtml(toneValue);
            const levels = Array.isArray(d.levels) ? d.levels : [];
            const rows = Array.isArray(d.rows) ? d.rows : [];
            html = `<div class="props-section">
                <div class="props-section-title">Rubric block</div>
                <div class="props-row"><label>Titre</label><select id="sp-rb-title-preset">${titleOptions}<option value="__custom__"${selectedTitlePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte titre</label><input type="text" id="sp-rb-title" value="${escAttr(titleValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-rb-tone">${toneOptions}</select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Niveaux</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Un niveau par ligne</label>
                <textarea id="sp-rb-levels" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(levels.join('\n'))}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Critères (JSON)</div>
                <textarea id="sp-rb-rows" rows="10" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(rows, null, 2))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"criterion":"…","descriptors":["…","…","…"]}]</div>
            </div>`;
            break;
        }

        case 'terminal-session': {
            const labelValue = String(d.label ?? 'Session terminal').trim() || 'Session terminal';
            const selectedPreset = TERMINAL_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = TERMINAL_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'info');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Session terminal</div>
                <div class="props-row"><label>Label</label><select id="sp-term-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-term-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-term-tone">${toneOptions}</select></div>
                <div class="props-row"><label>Langage</label><select id="sp-term-lang"><option value="bash"${d.language === 'bash' ? ' selected' : ''}>Bash</option><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JavaScript</option><option value="text"${d.language === 'text' ? ' selected' : ''}>Texte</option></select></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Session</label>
                <textarea id="sp-term-script" rows="10" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.script || '')}</textarea>
            </div>`;
            break;
        }

        case 'code-example': {
            const mode = ['terminal', 'live', 'stepper'].includes(d.widgetType) ? d.widgetType : 'terminal';
            const steps = Array.isArray(d.stepperSteps) ? d.stepperSteps : [];
            const labelValue = String(d.label ?? d.blockTitle ?? 'Exemple').trim() || 'Exemple';
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto');
            const selectedPreset = CODE_EXAMPLE_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = CODE_EXAMPLE_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Exemple</div>
                <div class="props-row"><label>Titre</label><select id="sp-ce-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte titre</label><input type="text" id="sp-ce-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-ce-tone">${toneOptions}</select></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Texte</label>
                <textarea id="sp-ce-text" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.text || '')}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Widget</label><select id="sp-ce-mode"><option value="terminal"${mode === 'terminal' ? ' selected' : ''}>Code/Terminal</option><option value="live"${mode === 'live' ? ' selected' : ''}>Code Live</option><option value="stepper"${mode === 'stepper' ? ' selected' : ''}>Algo stepper</option></select></div>
            </div>`;
            if (mode === 'stepper') {
                html += `<div class="props-section">
                    <div class="props-section-title">Stepper</div>
                    <div class="props-row"><label>Titre</label><input type="text" id="sp-ce-stepper-title" value="${escAttr(d.stepperTitle || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                    <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Étapes JSON</label>
                    <textarea id="sp-ce-stepper-steps" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(steps, null, 2))}</textarea>
                    <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"title":"...","detail":"...","code":"..."}]</div>
                </div>`;
            } else {
                html += `<div class="props-section">
                    <div class="props-section-title">${mode === 'live' ? 'Code Live' : 'Code / Terminal'}</div>
                    <div class="props-row"><label>Langage</label><select id="sp-ce-lang"><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JavaScript</option><option value="bash"${d.language === 'bash' ? ' selected' : ''}>Bash</option><option value="java"${d.language === 'java' ? ' selected' : ''}>Java</option><option value="c"${d.language === 'c' ? ' selected' : ''}>C</option><option value="html"${d.language === 'html' ? ' selected' : ''}>HTML</option><option value="css"${d.language === 'css' ? ' selected' : ''}>CSS</option><option value="sql"${d.language === 'sql' ? ' selected' : ''}>SQL</option><option value="text"${d.language === 'text' ? ' selected' : ''}>Texte</option></select></div>
                    <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Code</label>
                    <textarea id="sp-ce-code" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.code || '')}</textarea>
                </div>`;
            }
            break;
        }

        case 'image':
            html = `<div class="props-section">
                <div class="props-section-title">Image</div>
                <div class="props-row"><label>URL</label><input type="text" id="sp-img-src" value="${escAttr(d.src || '')}" placeholder="../images/..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Texte alt</label><input type="text" id="sp-img-alt" value="${escAttr(d.alt || '')}" placeholder="Description utile pour lecteur d'écran" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'code': {
            const labelValue = String(d.label ?? 'Code').trim() || 'Code';
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto');
            const selectedPreset = CODE_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = CODE_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Code</div>
                <div class="props-row"><label>Label</label><select id="sp-code-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-code-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-code-tone">${toneOptions}</select></div>
                <div class="props-row"><label>Lang</label><select id="sp-code-lang"><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JS</option><option value="java"${d.language === 'java' ? ' selected' : ''}>Java</option><option value="c"${d.language === 'c' ? ' selected' : ''}>C</option><option value="html"${d.language === 'html' ? ' selected' : ''}>HTML</option><option value="css"${d.language === 'css' ? ' selected' : ''}>CSS</option><option value="sql"${d.language === 'sql' ? ' selected' : ''}>SQL</option><option value="bash"${d.language === 'bash' ? ' selected' : ''}>Bash</option><option value="text"${d.language === 'text' ? ' selected' : ''}>Texte</option></select></div>
            </div>`;
            break;
        }

        case 'widget': {
            const currentLabel = (window.OEI_WIDGET_REGISTRY?.[d.widget]?.label) || SlidesEditor.WIDGET_OPTIONS.find(w => w.id === d.widget)?.label || d.widget || '—';
            html = `<div class="props-section">
                <div class="props-section-title">Widget</div>
                <button type="button" id="sp-widget-open" class="wpm-trigger-btn" style="width:100%">
                    <span id="sp-widget-label">${currentLabel}</span>
                </button>
            </div>`;
            break;
        }

        case 'quote':
            html = `<div class="props-section">
                <div class="props-section-title">Citation</div>
                <div style="margin-bottom:6px"><label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Texte</label><textarea id="sp-quote-text" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.text || '')}</textarea></div>
                <div class="props-row"><label>Par</label><input type="text" id="sp-quote-author" value="${escAttr(d.author || '')}" placeholder="Auteur" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'card': {
            const cardItems = d.items || [];
            const titleValue = String(d.title || '').trim();
            const selectedTitlePreset = CARD_TITLE_PRESETS.includes(titleValue) ? titleValue : '__custom__';
            const titleOptions = CARD_TITLE_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedTitlePreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(_normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto'));
            html = `<div class="props-section">
                <div class="props-section-title">Carte</div>
                <div class="props-row"><label>Preset titre</label><select id="sp-card-title-preset">${titleOptions}<option value="__custom__"${selectedTitlePreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-card-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-card-tone">${toneOptions}</select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Points</div>
                <div id="sp-card-items">
                    ${cardItems.map((item, idx) => `<div class="props-row" style="margin-bottom:3px">
                        <input type="text" value="${escAttr(item)}" data-card-idx="${idx}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem">
                        <button class="tb-btn" data-del-card="${idx}" style="padding:2px 5px;color:var(--danger);font-size:0.65rem">✕</button>
                    </div>`).join('')}
                </div>
                <button class="tb-btn" id="sp-card-add" style="width:100%;justify-content:center;font-size:0.68rem;margin-top:4px;border-style:dashed">+ Ajouter</button>
            </div>`;
            break;
        }

        case 'shape':
            html = `<div class="props-section">
                <div class="props-section-title">Forme</div>
                <div class="props-row"><label>Type</label><select id="sp-shape-type"><option value="rect"${(d.shapeType || d.shape) === 'rect' ? ' selected' : ''}>Rectangle</option><option value="ellipse"${(d.shapeType || d.shape) === 'ellipse' ? ' selected' : ''}>Ellipse</option><option value="triangle"${(d.shapeType || d.shape) === 'triangle' ? ' selected' : ''}>Triangle</option><option value="diamond"${(d.shapeType || d.shape) === 'diamond' ? ' selected' : ''}>Losange</option><option value="hexagon"${(d.shapeType || d.shape) === 'hexagon' ? ' selected' : ''}>Hexagone</option></select></div>
            </div>`;
            break;

        case 'table':
            html = `<div class="props-section">
                <div class="props-section-title">Structure</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                    <button class="tb-btn" id="sp-table-add-row" style="font-size:0.68rem;justify-content:center">+ Ligne</button>
                    <button class="tb-btn" id="sp-table-add-col" style="font-size:0.68rem;justify-content:center">+ Colonne</button>
                    <button class="tb-btn" id="sp-table-del-row" style="font-size:0.68rem;justify-content:center">− Ligne</button>
                    <button class="tb-btn" id="sp-table-del-col" style="font-size:0.68rem;justify-content:center">− Colonne</button>
                </div>
                <div style="font-size:0.65rem;color:var(--muted);margin-top:6px">${d.rows?.length || 0} lignes × ${d.rows?.[0]?.length || 0} colonnes</div>
            </div>`;
            break;

        case 'video':
            html = `<div class="props-section">
                <div class="props-section-title">Vidéo</div>
                <div class="props-row"><label>URL</label><input type="text" id="sp-video-src" value="${escAttr(d.src || '')}" placeholder="URL YouTube ou Vimeo" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Texte alt</label><input type="text" id="sp-video-alt" value="${escAttr(d.alt || '')}" placeholder="Description du contenu vidéo" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                ${d.embedUrl ? `<div style="font-size:0.65rem;color:var(--muted);margin-top:6px;word-break:break-all">Embed : ${esc(d.embedUrl)}</div>` : ''}
            </div>`;
            break;

        case 'mermaid':
            html = `<div class="props-section">
                <div class="props-section-title">Diagramme Mermaid</div>
                <textarea id="sp-mermaid-code" rows="10" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.code || '')}</textarea>
                <div style="font-size:0.62rem;color:var(--muted);margin-top:4px">Syntaxe <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank" style="color:var(--primary)">Mermaid</a></div>
            </div>`;
            break;

        case 'diagramme': {
            const rawRows = Array.isArray(d.rows) ? d.rows : [];
            const colCount = Math.max(2, rawRows.reduce((max, row) => {
                if (!Array.isArray(row)) return max;
                return Math.max(max, row.length);
            }, 0));
            const normalizedRows = rawRows.length
                ? rawRows
                    .filter((row) => Array.isArray(row))
                    .map((row) => {
                        const next = row.slice(0, colCount).map((cell) => String(cell ?? ''));
                        while (next.length < colCount) next.push('');
                        return next;
                    })
                : [
                    ['Catégorie', 'Série A', 'Série B'],
                    ['A', '12', '8'],
                    ['B', '18', '11'],
                    ['C', '9', '14'],
                ];
            const rowCount = Math.max(2, normalizedRows.length);
            while (normalizedRows.length < rowCount) normalizedRows.push(Array(colCount).fill(''));
            const chartType = ['bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'combo', 'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall', 'funnel', 'radar', 'pie', 'donut', 'heatmap', 'treemap', 'sankey', 'gantt', 'radial-gauge'].includes(String(d.chartType || '').toLowerCase())
                ? String(d.chartType).toLowerCase()
                : 'bar';
            const gridHtml = normalizedRows.map((row, ri) => `<tr>
                ${row.map((cell, ci) => {
                    const isHeader = ri === 0 || ci === 0;
                    const cellClasses = `sp-diag-cell${isHeader ? ' is-header' : ''}`;
                    const inputClasses = `sp-diag-input${isHeader ? ' is-header' : ''}`;
                    const placeholder = ri === 0
                        ? (ci === 0 ? 'Catégorie' : `Série ${ci}`)
                        : (ci === 0 ? `Cat. ${ri}` : '0');
                    return `<td class="${cellClasses}">
                        <input class="${inputClasses}" type="text" data-diag-r="${ri}" data-diag-c="${ci}" value="${escAttr(cell)}" placeholder="${escAttr(placeholder)}" style="min-width:${ci === 0 ? 90 : 72}px;">
                    </td>`;
                }).join('')}
            </tr>`).join('');
            html = `<div class="props-section">
                <div class="props-section-title">Diagramme</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-diag-title" value="${escAttr(d.title || 'Diagramme')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Type</label><select id="sp-diag-type"><option value="bar"${chartType === 'bar' ? ' selected' : ''}>Barres</option><option value="stacked-bar"${chartType === 'stacked-bar' ? ' selected' : ''}>Barres empilées</option><option value="stacked-100"${chartType === 'stacked-100' ? ' selected' : ''}>Barres empilées 100%</option><option value="line"${chartType === 'line' ? ' selected' : ''}>Lignes</option><option value="area"${chartType === 'area' ? ' selected' : ''}>Aires</option><option value="combo"${chartType === 'combo' ? ' selected' : ''}>Combo barres + ligne</option><option value="scatter"${chartType === 'scatter' ? ' selected' : ''}>Nuage (X,Y)</option><option value="bubble"${chartType === 'bubble' ? ' selected' : ''}>Bulles (X,Y,Taille)</option><option value="histogram"${chartType === 'histogram' ? ' selected' : ''}>Histogramme</option><option value="boxplot"${chartType === 'boxplot' ? ' selected' : ''}>Boîte à moustaches</option><option value="waterfall"${chartType === 'waterfall' ? ' selected' : ''}>Waterfall</option><option value="funnel"${chartType === 'funnel' ? ' selected' : ''}>Entonnoir</option><option value="radar"${chartType === 'radar' ? ' selected' : ''}>Radar</option><option value="pie"${chartType === 'pie' ? ' selected' : ''}>Camembert</option><option value="donut"${chartType === 'donut' ? ' selected' : ''}>Anneau</option><option value="heatmap"${chartType === 'heatmap' ? ' selected' : ''}>Heatmap</option><option value="treemap"${chartType === 'treemap' ? ' selected' : ''}>Treemap</option><option value="sankey"${chartType === 'sankey' ? ' selected' : ''}>Sankey</option><option value="gantt"${chartType === 'gantt' ? ' selected' : ''}>Gantt</option><option value="radial-gauge"${chartType === 'radial-gauge' ? ' selected' : ''}>Jauge radiale</option></select></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px">
                    <button class="tb-btn" id="sp-diag-add-row" style="font-size:0.68rem;justify-content:center">+ Ligne</button>
                    <button class="tb-btn" id="sp-diag-add-col" style="font-size:0.68rem;justify-content:center">+ Colonne</button>
                    <button class="tb-btn" id="sp-diag-del-row" style="font-size:0.68rem;justify-content:center">− Ligne</button>
                    <button class="tb-btn" id="sp-diag-del-col" style="font-size:0.68rem;justify-content:center">− Colonne</button>
                </div>
                <div style="font-size:0.64rem;color:var(--muted);margin-top:6px">${normalizedRows.length} ligne(s) × ${colCount} colonne(s)</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Données (tableau)</label>
                <div class="sp-diag-grid-wrap">
                    <table class="sp-diag-grid">
                        ${gridHtml}
                    </table>
                </div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px;line-height:1.4">Ligne 1: en-têtes de séries. Colonne 1: catégories. Exemples: Scatter=Série A(X)+Série B(Y), Bubble + Série C(taille), Boxplot=Min/Q1/Médiane/Q3/Max, Sankey=Source/Cible/Valeur, Gantt=Tâche/Début/Fin.</div>
            </div>`;
            break;
        }

        case 'latex':
            html = `<div class="props-section">
                <div class="props-section-title">Équation LaTeX</div>
                <textarea id="sp-latex-expr" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(d.expression || '')}</textarea>
                <div style="font-size:0.62rem;color:var(--muted);margin-top:4px">Syntaxe KaTeX (LaTeX)</div>
            </div>`;
            break;

        case 'timer':
            html = `<div class="props-section">
                <div class="props-section-title">Minuteur</div>
                <div class="props-row"><label>Durée (s)</label><input type="number" id="sp-timer-dur" value="${d.duration || 300}" min="1" max="7200" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Label</label><input type="text" id="sp-timer-label" value="${escAttr(d.label || '')}" placeholder="Timer" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'iframe':
            html = `<div class="props-section">
                <div class="props-section-title">Contenu embarqué</div>
                <div class="props-row"><label>URL</label><input type="text" id="sp-iframe-url" value="${escAttr(d.url || '')}" placeholder="https://..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-iframe-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'highlight': {
            const hls = d.highlights || [];
            const labelValue = String(d.label ?? 'Code').trim() || 'Code';
            const toneValue = _normalizeTonePreset(d.tone ?? d.labelTone ?? 'auto');
            const selectedPreset = CODE_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = CODE_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            const toneOptions = _toneOptionsHtml(toneValue);
            html = `<div class="props-section">
                <div class="props-section-title">Code</div>
                <div class="props-row"><label>Label</label><select id="sp-hl-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-hl-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Couleur</label><select id="sp-hl-tone">${toneOptions}</select></div>
                <div class="props-row"><label>Lang</label><select id="sp-hl-lang"><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JavaScript</option><option value="java"${d.language === 'java' ? ' selected' : ''}>Java</option><option value="c"${d.language === 'c' ? ' selected' : ''}>C</option><option value="bash"${d.language === 'bash' ? ' selected' : ''}>Bash / Terminal</option><option value="html"${d.language === 'html' ? ' selected' : ''}>HTML</option><option value="css"${d.language === 'css' ? ' selected' : ''}>CSS</option><option value="sql"${d.language === 'sql' ? ' selected' : ''}>SQL</option><option value="yaml"${d.language === 'yaml' ? ' selected' : ''}>YAML</option><option value="json"${d.language === 'json' ? ' selected' : ''}>JSON</option><option value="text"${d.language === 'text' ? ' selected' : ''}>Texte</option></select></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Code</label>
                <textarea id="sp-hl-code" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.code || '')}</textarea>
            </div>
            <div class="props-section">
                <div class="props-section-title">Zones surlignées</div>
                <div id="sp-hl-items">
                    ${hls.map((h, i) => `<div class="props-row" style="margin-bottom:3px">
                        <input type="text" value="${escAttr(h.lines||'')}" data-hl-lines="${i}" placeholder="1-3" style="width:50px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem">
                        <input type="text" value="${escAttr(h.label||'')}" data-hl-label="${i}" placeholder="Label" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem">
                        <button class="tb-btn" data-del-hl="${i}" style="padding:2px 5px;color:var(--danger);font-size:0.65rem">✕</button>
                    </div>`).join('')}
                </div>
                <button class="tb-btn" id="sp-hl-add" style="width:100%;justify-content:center;font-size:0.68rem;margin-top:4px;border-style:dashed">+ Zone</button>
            </div>`;
            break;
        }

        case 'qrcode':
            html = `<div class="props-section">
                <div class="props-section-title">QR Code</div>
                <div class="props-row"><label>Valeur</label><input type="text" id="sp-qr-value" value="${escAttr(d.value || '')}" placeholder="https://..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Label</label><input type="text" id="sp-qr-label" value="${escAttr(d.label || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Texte alt</label><input type="text" id="sp-qr-alt" value="${escAttr(d.alt || '')}" placeholder="Description de la destination du QR code" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'smartart': {
            const saItems = d.items || [];
            html = `<div class="props-section">
                <div class="props-section-title">SmartArt</div>
                <div class="props-row"><label>Variante</label><select id="sp-sa-variant"><option value="process"${d.variant === 'process' ? ' selected' : ''}>Processus →</option><option value="cycle"${d.variant === 'cycle' ? ' selected' : ''}>Cycle ↻</option><option value="pyramid"${d.variant === 'pyramid' ? ' selected' : ''}>Pyramide △</option><option value="matrix"${d.variant === 'matrix' ? ' selected' : ''}>Matrice ⊞</option></select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Éléments</div>
                <div id="sp-sa-items">
                    ${saItems.map((item, i) => `<div class="props-row" style="margin-bottom:3px">
                        <input type="text" value="${escAttr(item)}" data-sa-idx="${i}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem">
                        <button class="tb-btn" data-del-sa="${i}" style="padding:2px 5px;color:var(--danger);font-size:0.65rem">✕</button>
                    </div>`).join('')}
                </div>
                <button class="tb-btn" id="sp-sa-add" style="width:100%;justify-content:center;font-size:0.68rem;margin-top:4px;border-style:dashed">+ Ajouter</button>
            </div>`;
            break;
        }

        case 'code-live':
            html = `<div class="props-section">
                <div class="props-section-title">Code Live</div>
                <div class="props-row"><label>Langage</label><select id="sp-cl-lang"><option value="python"${d.language === 'python' ? ' selected' : ''}>Python</option><option value="javascript"${d.language === 'javascript' ? ' selected' : ''}>JavaScript</option></select></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Code initial</label>
                <textarea id="sp-cl-code" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box;tab-size:4">${esc(d.code || '')}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Auto-run</label><input type="checkbox" id="sp-cl-autorun"${d.autoRun ? ' checked' : ''}></div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:6px;line-height:1.4">Python : exécuté via <a href="https://pyodide.org" target="_blank" style="color:var(--primary)">Pyodide</a> (WASM)<br>JS : exécuté dans le navigateur</div>
            </div>`;
            break;

        case 'quiz-live': {
            const qlOpts = d.options || [];
            const labelValue = String(d.label ?? 'Quiz').trim() || 'Quiz';
            const selectedPreset = ASSESSMENT_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = ASSESSMENT_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            html = `<div class="props-section">
                <div class="props-section-title">Quiz</div>
                <div class="props-row"><label>Label</label><select id="sp-ql-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-ql-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Question</label>
                <textarea id="sp-ql-question" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.question || '')}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Durée (s)</label><input type="number" id="sp-ql-duration" value="${d.duration || 30}" min="5" max="300" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row" style="margin-top:4px"><label>Bonne rép.</label><select id="sp-ql-answer">${qlOpts.map((_, i) => `<option value="${i}"${d.answer === i ? ' selected' : ''}>${String.fromCharCode(65 + i)}</option>`).join('')}</select></div>
            </div>
            <div class="props-section">
                <div class="props-section-title">Options</div>
                <div id="sp-ql-items">
                    ${qlOpts.map((item, i) => `<div class="props-row" style="margin-bottom:3px">
                        <span style="min-width:18px;font-weight:700;font-size:0.7rem;color:var(--primary)">${String.fromCharCode(65 + i)}</span>
                        <input type="text" value="${escAttr(item)}" data-ql-idx="${i}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem">
                        <button class="tb-btn" data-del-ql="${i}" style="padding:2px 5px;color:var(--danger);font-size:0.65rem">✕</button>
                    </div>`).join('')}
                </div>
                <button class="tb-btn" id="sp-ql-add" style="width:100%;justify-content:center;font-size:0.68rem;margin-top:4px;border-style:dashed">+ Option</button>
            </div>
            <div style="font-size:0.6rem;color:var(--muted);padding:0 4px;line-height:1.4">Quiz interactif : les étudiants répondent via QR code (P2P, aucun serveur). La durée limite le temps de réponse.</div>`;
            break;
        }

        case 'cloze':
            html = `<div class="props-section">
                <div class="props-section-title">Texte à trous</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Phrase (utiliser ____ pour chaque trou)</label>
                <textarea id="sp-cloze-sentence" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.sentence || '')}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Réponses</label><input type="text" id="sp-cloze-blanks" value="${escAttr((d.blanks || []).join(', '))}" placeholder="TCP, UDP" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Séparer les réponses par des virgules.</div>
            </div>`;
            break;

        case 'mcq-single': {
            const labelValue = String(d.label ?? 'QCM simple').trim() || 'QCM simple';
            const selectedPreset = ASSESSMENT_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = ASSESSMENT_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            html = `<div class="props-section">
                <div class="props-section-title">QCM simple</div>
                <div class="props-row"><label>Label</label><select id="sp-mcqs-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-mcqs-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Question</label>
                <textarea id="sp-mcqs-question" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.question || '')}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Options (1 par ligne)</label>
                <textarea id="sp-mcqs-options" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.options || []).join('\n'))}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Bonne rép.</label><input type="number" id="sp-mcqs-answer" value="${Number(d.answer ?? 0)}" min="0" style="width:80px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Index de la bonne réponse (0 = première option).</div>
            </div>`;
            break;
        }

        case 'drag-drop':
            html = `<div class="props-section">
                <div class="props-section-title">Drag & Drop</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-dnd-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Cartes (1 par ligne)</label>
                <textarea id="sp-dnd-items" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.items || []).join('\n'))}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Zones (1 par ligne)</label>
                <textarea id="sp-dnd-targets" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.targets || []).join('\n'))}</textarea>
            </div>`;
            break;

        case 'mcq-multi': {
            const labelValue = String(d.label ?? 'QCM multi').trim() || 'QCM multi';
            const selectedPreset = ASSESSMENT_LABEL_PRESETS.includes(labelValue) ? labelValue : '__custom__';
            const labelOptions = ASSESSMENT_LABEL_PRESETS
                .map((preset) => `<option value="${escAttr(preset)}"${selectedPreset === preset ? ' selected' : ''}>${esc(preset)}</option>`)
                .join('');
            html = `<div class="props-section">
                <div class="props-section-title">QCM multi</div>
                <div class="props-row"><label>Label</label><select id="sp-mcqm-label-preset">${labelOptions}<option value="__custom__"${selectedPreset === '__custom__' ? ' selected' : ''}>Personnalise</option></select></div>
                <div class="props-row"><label>Texte label</label><input type="text" id="sp-mcqm-label" value="${escAttr(labelValue)}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Question</label>
                <textarea id="sp-mcqm-question" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.question || '')}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Options (1 par ligne)</label>
                <textarea id="sp-mcqm-options" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.options || []).join('\n'))}</textarea>
                <div class="props-row" style="margin-top:6px"><label>Bonnes rép.</label><input type="text" id="sp-mcqm-answers" value="${escAttr((d.answers || []).join(', '))}" placeholder="0, 2" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Indices des réponses correctes, à partir de 0.</div>
            </div>`;
            break;
        }

        case 'poll-likert':
        case 'debate-mode':
        case 'postit-wall':
            html = `<div class="props-section">
                <div class="props-section-title">Interaction live</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Prompt</label>
                <textarea id="sp-live-prompt" rows="4" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.prompt || '')}</textarea>
            </div>`;
            break;

        case 'exit-ticket':
            html = `<div class="props-section">
                <div class="props-section-title">Exit ticket</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-et-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Prompts (1 par ligne)</label>
                <textarea id="sp-et-prompts" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.prompts || []).join('\n'))}</textarea>
            </div>`;
            break;

        case 'audience-roulette':
            html = `<div class="props-section">
                <div class="props-section-title">Roulette</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-roulette-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'room-stats':
            html = `<div class="props-section">
                <div class="props-section-title">Stats live</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-rs-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Métriques (1 par ligne)</label>
                <textarea id="sp-rs-metrics" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.metrics || ['students', 'hands', 'questions', 'feedback']).join('\n'))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Valeurs possibles: students, hands, questions, feedback, poll, wordcloud.</div>
            </div>`;
            break;

        case 'leaderboard-live':
            html = `<div class="props-section">
                <div class="props-section-title">Leaderboard live</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-lb-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Top</label><input type="number" id="sp-lb-limit" value="${Math.max(1, Number(d.limit || 5))}" min="1" max="20" style="width:80px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
            </div>`;
            break;

        case 'swot-grid':
            html = `<div class="props-section">
                <div class="props-section-title">SWOT</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Forces (1 par ligne)</label>
                <textarea id="sp-swot-strength" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.strength || []).join('\n'))}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Faiblesses (1 par ligne)</label>
                <textarea id="sp-swot-weakness" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.weakness || []).join('\n'))}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Opportunités (1 par ligne)</label>
                <textarea id="sp-swot-opportunity" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.opportunity || []).join('\n'))}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Menaces (1 par ligne)</label>
                <textarea id="sp-swot-threat" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.threat || []).join('\n'))}</textarea>
            </div>`;
            break;

        case 'decision-tree':
            html = `<div class="props-section">
                <div class="props-section-title">Arbre de décision</div>
                <div class="props-row"><label>Racine</label><input type="text" id="sp-dt-root" value="${escAttr(d.root || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Branches (format: label => outcome)</label>
                <textarea id="sp-dt-branches" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.branches || []).map(b => `${b?.label || ''} => ${b?.outcome || ''}`).join('\n'))}</textarea>
            </div>`;
            break;

        case 'timeline-vertical':
            html = `<div class="props-section">
                <div class="props-section-title">Timeline verticale</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-tv-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Étapes (1 par ligne)</label>
                <textarea id="sp-tv-steps" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.steps || []).join('\n'))}</textarea>
            </div>`;
            break;

        case 'code-compare':
            html = `<div class="props-section">
                <div class="props-section-title">Comparateur de code</div>
                <div class="props-row"><label>Lang</label><input type="text" id="sp-cc-lang" value="${escAttr(d.language || 'text')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Avant</label>
                <textarea id="sp-cc-before" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(d.before || '')}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Après</label>
                <textarea id="sp-cc-after" rows="5" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(d.after || '')}</textarea>
            </div>`;
            break;

        case 'algo-stepper':
            html = `<div class="props-section">
                <div class="props-section-title">Algo stepper</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-as-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Étapes JSON</label>
                <textarea id="sp-as-steps" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(d.steps || [], null, 2))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"title":"","detail":"","code":""}]</div>
            </div>`;
            break;

        case 'gallery-annotable':
            html = `<div class="props-section">
                <div class="props-section-title">Gallery annotable</div>
                <div class="props-row"><label>Image</label><input type="text" id="sp-ga-src" value="${escAttr(d.src || '')}" placeholder="../images/..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <div class="props-row"><label>Texte alt</label><input type="text" id="sp-ga-alt" value="${escAttr(d.alt || '')}" placeholder="Description de l'image annotée" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Notes JSON</label>
                <textarea id="sp-ga-notes" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(d.notes || [], null, 2))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"x":25,"y":40,"text":"..."}]</div>
            </div>`;
            break;

        case 'rank-order':
            html = `<div class="props-section">
                <div class="props-section-title">Classement</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-rank-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Éléments (1 par ligne)</label>
                <textarea id="sp-rank-items" rows="6" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc((d.items || []).join('\n'))}</textarea>
            </div>`;
            break;

        case 'kanban-mini':
            html = `<div class="props-section">
                <div class="props-section-title">Kanban mini</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-kb-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Colonnes JSON</label>
                <textarea id="sp-kb-columns" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(d.columns || [], null, 2))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"name":"À faire","cards":["..."]}]</div>
            </div>`;
            break;

        case 'myth-reality':
            html = `<div class="props-section">
                <div class="props-section-title">Mythe / Réalité</div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin-bottom:3px">Mythe</label>
                <textarea id="sp-mr-myth" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.myth || '')}</textarea>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Réalité</label>
                <textarea id="sp-mr-reality" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.72rem;resize:vertical;box-sizing:border-box">${esc(d.reality || '')}</textarea>
            </div>`;
            break;

        case 'flashcards-auto':
            html = `<div class="props-section">
                <div class="props-section-title">Flashcards</div>
                <div class="props-row"><label>Titre</label><input type="text" id="sp-fc-title" value="${escAttr(d.title || '')}" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
                <label style="display:block;color:var(--muted);font-size:0.65rem;margin:6px 0 3px">Cartes JSON</label>
                <textarea id="sp-fc-cards" rows="8" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:6px;font-size:0.7rem;font-family:var(--font-mono,monospace);resize:vertical;box-sizing:border-box">${esc(JSON.stringify(d.cards || [], null, 2))}</textarea>
                <div style="font-size:0.6rem;color:var(--muted);margin-top:4px">Format: [{"front":"...","back":"..."}]</div>
            </div>`;
            break;

        default:
            html = `<div class="props-empty"><span>Pas de propriétés de contenu</span></div>`;
    }

    // ── Common section: Label (renvoi) & Légende (caption) ──
    html += `<div class="props-section" style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
        <div class="props-section-title">Référencement</div>
        <div class="props-row"><label>Légende</label><input type="text" id="sp-caption" value="${escAttr(d.caption || '')}" placeholder="Légende visible sous l'élément" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
        <div class="props-row"><label>Label</label><input type="text" id="sp-label" value="${escAttr(d.refLabel || '')}" placeholder="ex: fig:archi (pour {{ref:…}})" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem"></div>
        <div style="font-size:0.6rem;color:var(--muted);margin-top:4px;line-height:1.4">Renvoi : <code style="font-size:0.6rem">{{ref:label}}</code> dans un texte</div>
    </div>`;

    panel.innerHTML = html;
    _bindPropsPanel(el);
    if (typeof window.renderA11yElementHints === 'function') {
        try { window.renderA11yElementHints(el, panel); } catch (_) {}
    }
}

function _bindPropsPanel(el) {
    const id = el.id;
    const type = el.type;
    const bind = (spId, fn) => {
        const input = document.getElementById(spId);
        if (input) input.addEventListener('input', () => fn(input));
    };
    const bindChange = (spId, fn) => {
        const input = document.getElementById(spId);
        if (input) input.addEventListener('change', () => fn(input));
    };
    const parseLines = value => String(value || '')
        .split('\n')
        .map(v => v.trim())
        .filter(Boolean);
    const parseCsvNumbers = value => String(value || '')
        .split(',')
        .map(v => Number(v.trim()))
        .filter(v => Number.isFinite(v));
    const parseJsonArrayOr = (value, fallback) => {
        try {
            const parsed = JSON.parse(String(value || '[]'));
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    };

    switch (type) {
        case 'definition':
            bind('sp-def-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-def-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Definition';
                    presetSelect.value = DEFINITION_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-def-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-def-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-def-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-def-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bind('sp-def-example-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { exampleLabel: value } });
                const presetSelect = document.getElementById('sp-def-example-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Exemple';
                    presetSelect.value = DEFINITION_EXAMPLE_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-def-example-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-def-example-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-def-example-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { exampleLabel: inp.value } });
            });
            break;

        case 'callout-box':
            bind('sp-callout-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-callout-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Info';
                    presetSelect.value = CALLOUT_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-callout-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-callout-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-callout-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-callout-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bind('sp-callout-text', inp => canvasEditor.updateData(id, { data: { text: inp.value } }));
            break;

        case 'exercise-block':
            bind('sp-ex-title', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { title: value } });
                const presetSelect = document.getElementById('sp-ex-title-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Exercice guide';
                    presetSelect.value = EXERCISE_TITLE_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-ex-title-preset', inp => {
                if (inp.value === '__custom__') {
                    const titleInput = document.getElementById('sp-ex-title');
                    if (titleInput) titleInput.focus();
                    return;
                }
                const titleInput = document.getElementById('sp-ex-title');
                if (titleInput) titleInput.value = inp.value;
                canvasEditor.updateData(id, { data: { title: inp.value } });
            });
            bind('sp-ex-objective', inp => canvasEditor.updateData(id, { data: { objective: inp.value } }));
            bind('sp-ex-instructions', inp => canvasEditor.updateData(id, { data: { instructions: parseLines(inp.value) } }));
            bind('sp-ex-hints', inp => canvasEditor.updateData(id, { data: { hints: parseLines(inp.value) } }));
            bind('sp-ex-correction', inp => canvasEditor.updateData(id, { data: { correction: inp.value } }));
            document.getElementById('sp-ex-show-correction')?.addEventListener('change', function() {
                canvasEditor.updateData(id, { data: { showCorrection: !!this.checked } });
            });
            break;

        case 'before-after':
            bind('sp-ba-title', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { title: value } });
                const presetSelect = document.getElementById('sp-ba-title-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Avant / Après';
                    presetSelect.value = BEFORE_AFTER_TITLE_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-ba-title-preset', inp => {
                if (inp.value === '__custom__') {
                    const titleInput = document.getElementById('sp-ba-title');
                    if (titleInput) titleInput.focus();
                    return;
                }
                const titleInput = document.getElementById('sp-ba-title');
                if (titleInput) titleInput.value = inp.value;
                canvasEditor.updateData(id, { data: { title: inp.value } });
            });
            bindChange('sp-ba-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bind('sp-ba-before-label', inp => canvasEditor.updateData(id, { data: { beforeLabel: inp.value } }));
            bind('sp-ba-before', inp => canvasEditor.updateData(id, { data: { before: inp.value } }));
            bind('sp-ba-after-label', inp => canvasEditor.updateData(id, { data: { afterLabel: inp.value } }));
            bind('sp-ba-after', inp => canvasEditor.updateData(id, { data: { after: inp.value } }));
            break;

        case 'mistake-fix':
            bind('sp-mf-title', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { title: value } });
                const presetSelect = document.getElementById('sp-mf-title-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Erreur frequente vs correction';
                    presetSelect.value = MISTAKE_TITLE_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-mf-title-preset', inp => {
                if (inp.value === '__custom__') {
                    const titleInput = document.getElementById('sp-mf-title');
                    if (titleInput) titleInput.focus();
                    return;
                }
                const titleInput = document.getElementById('sp-mf-title');
                if (titleInput) titleInput.value = inp.value;
                canvasEditor.updateData(id, { data: { title: inp.value } });
            });
            bindChange('sp-mf-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bindChange('sp-mf-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-mf-mistake', inp => canvasEditor.updateData(id, { data: { mistake: inp.value } }));
            bind('sp-mf-fix', inp => canvasEditor.updateData(id, { data: { fix: inp.value } }));
            break;

        case 'rubric-block':
        case 'rubrick-block':
            bind('sp-rb-title', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { title: value } });
                const presetSelect = document.getElementById('sp-rb-title-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Grille d’évaluation';
                    presetSelect.value = RUBRIC_TITLE_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-rb-title-preset', inp => {
                if (inp.value === '__custom__') {
                    const titleInput = document.getElementById('sp-rb-title');
                    if (titleInput) titleInput.focus();
                    return;
                }
                const titleInput = document.getElementById('sp-rb-title');
                if (titleInput) titleInput.value = inp.value;
                canvasEditor.updateData(id, { data: { title: inp.value } });
            });
            bindChange('sp-rb-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bind('sp-rb-levels', inp => canvasEditor.updateData(id, { data: { levels: parseLines(inp.value) } }));
            bind('sp-rb-rows', inp => {
                const fallback = canvasEditor.getSelected()?.data?.rows || [];
                const rows = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { rows } });
            });
            break;

        case 'terminal-session':
            bind('sp-term-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-term-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Session terminal';
                    presetSelect.value = TERMINAL_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-term-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-term-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-term-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-term-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bindChange('sp-term-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-term-script', inp => canvasEditor.updateData(id, { data: { script: inp.value } }));
            break;

        case 'image':
            bind('sp-img-src', inp => canvasEditor.updateData(id, { data: { src: inp.value } }));
            bind('sp-img-alt', inp => canvasEditor.updateData(id, { data: { alt: inp.value } }));
            break;

        case 'code':
            bind('sp-code-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-code-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Code';
                    presetSelect.value = CODE_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-code-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-code-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-code-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-code-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bindChange('sp-code-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            break;

        case 'widget': {
            const btn = document.getElementById('sp-widget-open');
            const labelEl = document.getElementById('sp-widget-label');
            if (btn) btn.addEventListener('click', () => {
                WidgetPickerModal.open({
                    currentId: el.data?.widget || null,
                    onSelect: (widgetId) => {
                        const reg = window.OEI_WIDGET_REGISTRY || {};
                        if (labelEl) labelEl.textContent = reg[widgetId]?.label || widgetId;
                        canvasEditor.updateData(id, { data: { widget: widgetId } });
                    }
                });
            });
            break;
        }

        case 'quote':
            bind('sp-quote-text', inp => canvasEditor.updateData(id, { data: { text: inp.value } }));
            bind('sp-quote-author', inp => canvasEditor.updateData(id, { data: { author: inp.value } }));
            break;

        case 'card': {
            bind('sp-card-title', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { title: value } });
                const presetSelect = document.getElementById('sp-card-title-preset');
                if (presetSelect) {
                    const normalized = value.trim();
                    presetSelect.value = CARD_TITLE_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-card-title-preset', inp => {
                if (inp.value === '__custom__') {
                    const titleInput = document.getElementById('sp-card-title');
                    if (titleInput) titleInput.focus();
                    return;
                }
                const titleInput = document.getElementById('sp-card-title');
                if (titleInput) titleInput.value = inp.value;
                canvasEditor.updateData(id, { data: { title: inp.value } });
            });
            bindChange('sp-card-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            const getItems = () => Array.from(document.querySelectorAll('[data-card-idx]')).map(i => i.value);
            document.querySelectorAll('[data-card-idx]').forEach(input => {
                input.addEventListener('input', () => canvasEditor.updateData(id, { data: { items: getItems() } }));
            });
            document.querySelectorAll('[data-del-card]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const items = getItems();
                    items.splice(+btn.dataset.delCard, 1);
                    canvasEditor.updateData(id, { data: { items } });
                    updatePropsPanel();
                });
            });
            document.getElementById('sp-card-add')?.addEventListener('click', () => {
                const items = getItems();
                items.push('');
                canvasEditor.updateData(id, { data: { items } });
                updatePropsPanel();
            });
            break;
        }

        case 'shape':
            bindChange('sp-shape-type', inp => canvasEditor.updateData(id, { data: { shapeType: inp.value } }));
            break;

        case 'table':
            document.getElementById('sp-table-add-row')?.addEventListener('click', () => {
                const s = canvasEditor.getSelected();
                if (!s?.data?.rows?.length) return;
                const cols = s.data.rows[0].length;
                const newRows = s.data.rows.map(r => [...r]);
                newRows.push(Array(cols).fill(''));
                canvasEditor.updateData(id, { data: { rows: newRows }, h: s.h + 44 });
                updatePropsPanel();
            });
            document.getElementById('sp-table-add-col')?.addEventListener('click', () => {
                const s = canvasEditor.getSelected();
                if (!s?.data?.rows?.length) return;
                const newRows = s.data.rows.map(r => [...r, '']);
                canvasEditor.updateData(id, { data: { rows: newRows }, w: s.w + 150 });
                updatePropsPanel();
            });
            document.getElementById('sp-table-del-row')?.addEventListener('click', () => {
                const s = canvasEditor.getSelected();
                if (!s?.data?.rows || s.data.rows.length <= 1) return;
                const newRows = s.data.rows.slice(0, -1);
                canvasEditor.updateData(id, { data: { rows: newRows }, h: s.h - 44 });
                updatePropsPanel();
            });
            document.getElementById('sp-table-del-col')?.addEventListener('click', () => {
                const s = canvasEditor.getSelected();
                if (!s?.data?.rows || s.data.rows[0].length <= 1) return;
                const newRows = s.data.rows.map(r => r.slice(0, -1));
                canvasEditor.updateData(id, { data: { rows: newRows }, w: s.w - 150 });
                updatePropsPanel();
            });
            break;

        case 'video':
            bind('sp-video-src', inp => {
                let embedUrl = inp.value.trim();
                const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
                const vimeoMatch = inp.value.match(/vimeo\.com\/(\d+)/);
                if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                canvasEditor.updateData(id, { data: { src: inp.value, embedUrl } });
            });
            bind('sp-video-alt', inp => canvasEditor.updateData(id, { data: { alt: inp.value } }));
            break;

        case 'mermaid':
            bind('sp-mermaid-code', inp => canvasEditor.updateData(id, { data: { code: inp.value } }));
            break;

        case 'diagramme':
            bind('sp-diag-title', inp => canvasEditor.updateData(id, { data: { title: inp.value || 'Diagramme' } }));
            bindChange('sp-diag-type', inp => {
                const chartType = ['bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'combo', 'scatter', 'bubble', 'histogram', 'boxplot', 'waterfall', 'funnel', 'radar', 'pie', 'donut', 'heatmap', 'treemap', 'sankey', 'gantt', 'radial-gauge'].includes(String(inp.value || '').toLowerCase())
                    ? String(inp.value).toLowerCase()
                    : 'bar';
                canvasEditor.updateData(id, { data: { chartType } });
            });
            const getDiagRows = () => {
                const inputs = Array.from(document.querySelectorAll('[data-diag-r][data-diag-c]'));
                if (!inputs.length) {
                    const fallbackRows = canvasEditor.getSelected()?.data?.rows;
                    if (Array.isArray(fallbackRows) && fallbackRows.length) return fallbackRows;
                    return [
                        ['Catégorie', 'Série A', 'Série B'],
                        ['A', '12', '8'],
                        ['B', '18', '11'],
                    ];
                }
                const maxRow = inputs.reduce((max, input) => Math.max(max, Number(input.dataset.diagR) || 0), 0);
                const maxCol = inputs.reduce((max, input) => Math.max(max, Number(input.dataset.diagC) || 0), 0);
                const rows = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(''));
                inputs.forEach((input) => {
                    const r = Number(input.dataset.diagR) || 0;
                    const c = Number(input.dataset.diagC) || 0;
                    rows[r][c] = String(input.value ?? '');
                });
                return rows;
            };
            const applyDiagRows = (rows) => {
                if (!Array.isArray(rows) || !rows.length) return;
                canvasEditor.updateData(id, { data: { rows } });
            };
            document.querySelectorAll('[data-diag-r][data-diag-c]').forEach((input) => {
                input.addEventListener('input', () => applyDiagRows(getDiagRows()));
            });
            document.getElementById('sp-diag-add-row')?.addEventListener('click', () => {
                const rows = getDiagRows();
                const colCount = Math.max(2, rows[0]?.length || 0);
                const next = rows.map((row) => {
                    const clone = Array.isArray(row) ? row.slice(0, colCount) : [];
                    while (clone.length < colCount) clone.push('');
                    return clone;
                });
                const newRow = Array(colCount).fill('');
                newRow[0] = `Cat. ${Math.max(1, next.length)}`;
                next.push(newRow);
                applyDiagRows(next);
                updatePropsPanel();
            });
            document.getElementById('sp-diag-del-row')?.addEventListener('click', () => {
                const rows = getDiagRows();
                if (rows.length <= 2) return;
                rows.pop();
                applyDiagRows(rows);
                updatePropsPanel();
            });
            document.getElementById('sp-diag-add-col')?.addEventListener('click', () => {
                const rows = getDiagRows();
                const next = rows.map((row) => Array.isArray(row) ? row.slice() : []);
                next.forEach((row, ri) => row.push(ri === 0 ? `Série ${Math.max(1, row.length)}` : ''));
                applyDiagRows(next);
                updatePropsPanel();
            });
            document.getElementById('sp-diag-del-col')?.addEventListener('click', () => {
                const rows = getDiagRows();
                const colCount = Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0));
                if (colCount <= 2) return;
                const next = rows.map((row) => {
                    const clone = Array.isArray(row) ? row.slice() : [];
                    clone.pop();
                    return clone;
                });
                applyDiagRows(next);
                updatePropsPanel();
            });
            break;

        case 'latex':
            bind('sp-latex-expr', inp => canvasEditor.updateData(id, { data: { expression: inp.value } }));
            break;

        case 'timer':
            bind('sp-timer-dur', inp => canvasEditor.updateData(id, { data: { duration: +inp.value || 300 } }));
            bind('sp-timer-label', inp => canvasEditor.updateData(id, { data: { label: inp.value } }));
            break;

        case 'iframe':
            bind('sp-iframe-url', inp => canvasEditor.updateData(id, { data: { url: inp.value } }));
            bind('sp-iframe-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            break;

        case 'highlight': {
            bind('sp-hl-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-hl-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Code';
                    presetSelect.value = CODE_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-hl-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-hl-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-hl-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-hl-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bindChange('sp-hl-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-hl-code', inp => canvasEditor.updateData(id, { data: { code: inp.value } }));
            const getHls = () => Array.from(document.querySelectorAll('[data-hl-lines]')).map((inp, i) => ({
                lines: inp.value,
                label: document.querySelector(`[data-hl-label="${i}"]`)?.value || ''
            }));
            document.querySelectorAll('[data-hl-lines],[data-hl-label]').forEach(inp => {
                inp.addEventListener('input', () => canvasEditor.updateData(id, { data: { highlights: getHls() } }));
            });
            document.querySelectorAll('[data-del-hl]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const hls = getHls();
                    hls.splice(+btn.dataset.delHl, 1);
                    canvasEditor.updateData(id, { data: { highlights: hls } });
                    updatePropsPanel();
                });
            });
            document.getElementById('sp-hl-add')?.addEventListener('click', () => {
                const hls = getHls();
                hls.push({ lines: '', label: '' });
                canvasEditor.updateData(id, { data: { highlights: hls } });
                updatePropsPanel();
            });
            break;
        }

        case 'qrcode':
            bind('sp-qr-value', inp => canvasEditor.updateData(id, { data: { value: inp.value } }));
            bind('sp-qr-label', inp => canvasEditor.updateData(id, { data: { label: inp.value } }));
            bind('sp-qr-alt', inp => canvasEditor.updateData(id, { data: { alt: inp.value } }));
            break;

        case 'smartart': {
            bindChange('sp-sa-variant', inp => canvasEditor.updateData(id, { data: { variant: inp.value } }));
            const getSaItems = () => Array.from(document.querySelectorAll('[data-sa-idx]')).map(i => i.value);
            document.querySelectorAll('[data-sa-idx]').forEach(inp => {
                inp.addEventListener('input', () => canvasEditor.updateData(id, { data: { items: getSaItems() } }));
            });
            document.querySelectorAll('[data-del-sa]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const items = getSaItems();
                    items.splice(+btn.dataset.delSa, 1);
                    canvasEditor.updateData(id, { data: { items } });
                    updatePropsPanel();
                });
            });
            document.getElementById('sp-sa-add')?.addEventListener('click', () => {
                const items = getSaItems();
                items.push('');
                canvasEditor.updateData(id, { data: { items } });
                updatePropsPanel();
            });
            break;
        }

        case 'code-live':
            bindChange('sp-cl-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-cl-code', inp => canvasEditor.updateData(id, { data: { code: inp.value } }));
            document.getElementById('sp-cl-autorun')?.addEventListener('change', function() {
                canvasEditor.updateData(id, { data: { autoRun: this.checked } });
            });
            break;

        case 'quiz-live': {
            bind('sp-ql-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-ql-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Quiz';
                    presetSelect.value = ASSESSMENT_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-ql-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-ql-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-ql-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bind('sp-ql-question', inp => canvasEditor.updateData(id, { data: { question: inp.value } }));
            bind('sp-ql-duration', inp => canvasEditor.updateData(id, { data: { duration: +inp.value || 30 } }));
            bindChange('sp-ql-answer', inp => canvasEditor.updateData(id, { data: { answer: +inp.value } }));
            const getQlItems = () => Array.from(document.querySelectorAll('[data-ql-idx]')).map(i => i.value);
            document.querySelectorAll('[data-ql-idx]').forEach(inp => {
                inp.addEventListener('input', () => canvasEditor.updateData(id, { data: { options: getQlItems() } }));
            });
            document.querySelectorAll('[data-del-ql]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const items = getQlItems();
                    items.splice(+btn.dataset.delQl, 1);
                    canvasEditor.updateData(id, { data: { options: items } });
                    updatePropsPanel();
                });
            });
            document.getElementById('sp-ql-add')?.addEventListener('click', () => {
                const items = getQlItems();
                items.push('');
                canvasEditor.updateData(id, { data: { options: items } });
                updatePropsPanel();
            });
            break;
        }

        case 'cloze':
            bind('sp-cloze-sentence', inp => canvasEditor.updateData(id, { data: { sentence: inp.value } }));
            bind('sp-cloze-blanks', inp => {
                const blanks = String(inp.value || '')
                    .split(',')
                    .map(v => v.trim())
                    .filter(Boolean);
                canvasEditor.updateData(id, { data: { blanks } });
            });
            break;

        case 'mcq-single':
            bind('sp-mcqs-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-mcqs-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'QCM simple';
                    presetSelect.value = ASSESSMENT_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-mcqs-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-mcqs-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-mcqs-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bind('sp-mcqs-question', inp => canvasEditor.updateData(id, { data: { question: inp.value } }));
            bind('sp-mcqs-options', inp => canvasEditor.updateData(id, { data: { options: parseLines(inp.value) } }));
            bind('sp-mcqs-answer', inp => canvasEditor.updateData(id, { data: { answer: Math.max(0, Number(inp.value) || 0) } }));
            break;

        case 'drag-drop':
            bind('sp-dnd-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-dnd-items', inp => canvasEditor.updateData(id, { data: { items: parseLines(inp.value) } }));
            bind('sp-dnd-targets', inp => canvasEditor.updateData(id, { data: { targets: parseLines(inp.value) } }));
            break;

        case 'mcq-multi':
            bind('sp-mcqm-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-mcqm-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'QCM multi';
                    presetSelect.value = ASSESSMENT_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-mcqm-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-mcqm-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-mcqm-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bind('sp-mcqm-question', inp => canvasEditor.updateData(id, { data: { question: inp.value } }));
            bind('sp-mcqm-options', inp => canvasEditor.updateData(id, { data: { options: parseLines(inp.value) } }));
            bind('sp-mcqm-answers', inp => canvasEditor.updateData(id, { data: { answers: parseCsvNumbers(inp.value) } }));
            break;

        case 'poll-likert':
        case 'debate-mode':
        case 'postit-wall':
            bind('sp-live-prompt', inp => canvasEditor.updateData(id, { data: { prompt: inp.value } }));
            break;

        case 'exit-ticket':
            bind('sp-et-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-et-prompts', inp => canvasEditor.updateData(id, { data: { prompts: parseLines(inp.value) } }));
            break;

        case 'audience-roulette':
            bind('sp-roulette-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            break;

        case 'room-stats':
            bind('sp-rs-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-rs-metrics', inp => {
                const allowed = new Set(['students', 'hands', 'questions', 'feedback', 'poll', 'wordcloud']);
                const metrics = parseLines(inp.value)
                    .map(v => String(v || '').trim().toLowerCase())
                    .filter(v => allowed.has(v));
                canvasEditor.updateData(id, { data: { metrics } });
            });
            break;

        case 'leaderboard-live':
            bind('sp-lb-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-lb-limit', inp => canvasEditor.updateData(id, { data: { limit: Math.max(1, Math.min(20, Number(inp.value) || 5)) } }));
            break;

        case 'swot-grid':
            bind('sp-swot-strength', inp => canvasEditor.updateData(id, { data: { strength: parseLines(inp.value) } }));
            bind('sp-swot-weakness', inp => canvasEditor.updateData(id, { data: { weakness: parseLines(inp.value) } }));
            bind('sp-swot-opportunity', inp => canvasEditor.updateData(id, { data: { opportunity: parseLines(inp.value) } }));
            bind('sp-swot-threat', inp => canvasEditor.updateData(id, { data: { threat: parseLines(inp.value) } }));
            break;

        case 'decision-tree':
            bind('sp-dt-root', inp => canvasEditor.updateData(id, { data: { root: inp.value } }));
            bind('sp-dt-branches', inp => {
                const branches = parseLines(inp.value).map(line => {
                    const parts = line.split('=>');
                    const label = (parts[0] || '').trim();
                    const outcome = parts.slice(1).join('=>').trim();
                    return { label, outcome };
                }).filter(b => b.label);
                canvasEditor.updateData(id, { data: { branches } });
            });
            break;

        case 'timeline-vertical':
            bind('sp-tv-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-tv-steps', inp => canvasEditor.updateData(id, { data: { steps: parseLines(inp.value) } }));
            break;

        case 'code-compare':
            bind('sp-cc-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-cc-before', inp => canvasEditor.updateData(id, { data: { before: inp.value } }));
            bind('sp-cc-after', inp => canvasEditor.updateData(id, { data: { after: inp.value } }));
            break;

        case 'algo-stepper':
            bind('sp-as-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-as-steps', inp => {
                const fallback = canvasEditor.getSelected()?.data?.steps || [];
                const steps = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { steps } });
            });
            break;

        case 'gallery-annotable':
            bind('sp-ga-src', inp => canvasEditor.updateData(id, { data: { src: inp.value } }));
            bind('sp-ga-alt', inp => canvasEditor.updateData(id, { data: { alt: inp.value } }));
            bind('sp-ga-notes', inp => {
                const fallback = canvasEditor.getSelected()?.data?.notes || [];
                const notes = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { notes } });
            });
            break;

        case 'rank-order':
            bind('sp-rank-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-rank-items', inp => canvasEditor.updateData(id, { data: { items: parseLines(inp.value) } }));
            break;

        case 'kanban-mini':
            bind('sp-kb-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-kb-columns', inp => {
                const fallback = canvasEditor.getSelected()?.data?.columns || [];
                const columns = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { columns } });
            });
            break;

        case 'myth-reality':
            bind('sp-mr-myth', inp => canvasEditor.updateData(id, { data: { myth: inp.value } }));
            bind('sp-mr-reality', inp => canvasEditor.updateData(id, { data: { reality: inp.value } }));
            break;

        case 'flashcards-auto':
            bind('sp-fc-title', inp => canvasEditor.updateData(id, { data: { title: inp.value } }));
            bind('sp-fc-cards', inp => {
                const fallback = canvasEditor.getSelected()?.data?.cards || [];
                const cards = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { cards } });
            });
            break;

        case 'code-example':
            bind('sp-ce-label', inp => {
                const value = inp.value || '';
                canvasEditor.updateData(id, { data: { label: value } });
                const presetSelect = document.getElementById('sp-ce-label-preset');
                if (presetSelect) {
                    const normalized = value.trim() || 'Exemple';
                    presetSelect.value = CODE_EXAMPLE_LABEL_PRESETS.includes(normalized) ? normalized : '__custom__';
                }
            });
            bindChange('sp-ce-label-preset', inp => {
                if (inp.value === '__custom__') {
                    const labelInput = document.getElementById('sp-ce-label');
                    if (labelInput) labelInput.focus();
                    return;
                }
                const labelInput = document.getElementById('sp-ce-label');
                if (labelInput) labelInput.value = inp.value;
                canvasEditor.updateData(id, { data: { label: inp.value } });
            });
            bindChange('sp-ce-tone', inp => canvasEditor.updateData(id, { data: { tone: _normalizeTonePreset(inp.value) } }));
            bind('sp-ce-text', inp => canvasEditor.updateData(id, { data: { text: inp.value } }));
            bindChange('sp-ce-mode', inp => {
                const mode = ['terminal', 'live', 'stepper'].includes(inp.value) ? inp.value : 'terminal';
                canvasEditor.updateData(id, { data: { widgetType: mode } });
                updatePropsPanel();
            });
            bindChange('sp-ce-lang', inp => canvasEditor.updateData(id, { data: { language: inp.value } }));
            bind('sp-ce-code', inp => canvasEditor.updateData(id, { data: { code: inp.value } }));
            bind('sp-ce-stepper-title', inp => canvasEditor.updateData(id, { data: { stepperTitle: inp.value } }));
            bind('sp-ce-stepper-steps', inp => {
                const fallback = canvasEditor.getSelected()?.data?.stepperSteps || [];
                const stepperSteps = parseJsonArrayOr(inp.value, fallback);
                canvasEditor.updateData(id, { data: { stepperSteps } });
            });
            break;
    }

    // ── Common bindings: Label & Caption ──
    bind('sp-caption', inp => canvasEditor.updateData(id, { data: { caption: inp.value || undefined } }));
    bind('sp-label', inp => canvasEditor.updateData(id, { data: { refLabel: inp.value || undefined } }));
}

/* ── Connector Properties Panel ────────────────────────── */

function _renderConnectorProps(panel, conn) {
    const s = conn.style || {};
    const strokeVal = (s.stroke || '#818cf8').replace(/var\(.*\)/, '#818cf8');
    const sw = s.strokeWidth || 3;
    const dash = s.dashArray || '';

    // Arrow mode: none / end / start / both
    let arrowMode = 'none';
    if (conn.arrowEnd && conn.arrowStart) arrowMode = 'both';
    else if (conn.arrowEnd) arrowMode = 'end';
    else if (conn.arrowStart) arrowMode = 'start';

    const anchors = ['top', 'right', 'bottom', 'left'];
    const anchorLabels = { top: '↑ Haut', right: '→ Droite', bottom: '↓ Bas', left: '← Gauche' };
    const srcOpts = anchors.map(a => `<option value="${a}"${conn.sourceAnchor === a ? ' selected' : ''}>${anchorLabels[a]}</option>`).join('');
    const tgtOpts = anchors.map(a => `<option value="${a}"${conn.targetAnchor === a ? ' selected' : ''}>${anchorLabels[a]}</option>`).join('');

    const inputStyle = 'flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:0.72rem';

    panel.innerHTML = `
        <div class="props-section">
            <div class="props-section-title">Ligne</div>
            <div class="props-row"><label>Type</label>
                <select id="sp-conn-linetype" style="${inputStyle}">
                    <option value="straight"${conn.lineType === 'straight' ? ' selected' : ''}>Droit</option>
                    <option value="curve"${conn.lineType === 'curve' ? ' selected' : ''}>Courbe</option>
                    <option value="elbow"${conn.lineType === 'elbow' ? ' selected' : ''}>Coude</option>
                    <option value="rounded"${conn.lineType === 'rounded' ? ' selected' : ''}>Arrondi</option>
                </select>
            </div>
            <div class="props-row"><label>Trait</label>
                <select id="sp-conn-dash" style="${inputStyle}">
                    <option value=""${dash === '' ? ' selected' : ''}>Continu</option>
                    <option value="8 4"${dash === '8 4' ? ' selected' : ''}>Tirets</option>
                    <option value="2 4"${dash === '2 4' ? ' selected' : ''}>Pointillé</option>
                    <option value="8 4 2 4"${dash === '8 4 2 4' ? ' selected' : ''}>Tiret-point</option>
                </select>
            </div>
            <div class="props-row"><label>Épaisseur</label>
                <input type="range" id="sp-conn-width" min="1" max="12" value="${sw}" style="flex:1">
                <span id="sp-conn-width-label" style="min-width:22px;font-size:0.68rem;color:var(--muted);text-align:right">${sw}px</span>
            </div>
            <div class="props-row"><label>Couleur</label><input type="color" id="sp-conn-color" value="${strokeVal}" style="width:32px;height:24px;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:0"></div>
        </div>
        <div class="props-section">
            <div class="props-section-title">Flèches</div>
            <div class="props-row"><label>Pointes</label>
                <select id="sp-conn-arrows" style="${inputStyle}">
                    <option value="none"${arrowMode === 'none' ? ' selected' : ''}>Aucune</option>
                    <option value="end"${arrowMode === 'end' ? ' selected' : ''}>Fin →</option>
                    <option value="start"${arrowMode === 'start' ? ' selected' : ''}>Début ←</option>
                    <option value="both"${arrowMode === 'both' ? ' selected' : ''}>Les deux ↔</option>
                </select>
            </div>
        </div>
        <div class="props-section">
            <div class="props-section-title">Ancrage</div>
            <div class="props-row"><label>Source</label><select id="sp-conn-src-anchor" style="${inputStyle}">${srcOpts}</select></div>
            <div class="props-row"><label>Cible</label><select id="sp-conn-tgt-anchor" style="${inputStyle}">${tgtOpts}</select></div>
        </div>
        <div class="props-section">
            <div class="props-section-title">Étiquette</div>
            <div class="props-row"><input type="text" id="sp-conn-label" value="${escAttr(conn.label || '')}" placeholder="Texte sur la flèche" style="width:100%;${inputStyle}"></div>
        </div>
        <div class="props-section" style="border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
            <button class="tb-btn" id="sp-conn-delete" style="width:100%;justify-content:center;color:var(--danger);font-size:0.72rem">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                Supprimer le connecteur
            </button>
        </div>`;
}

function _bindConnectorProps(conn) {
    const id = conn.id;
    const upd = (patch) => { canvasEditor.updateConnector(id, patch); };

    document.getElementById('sp-conn-linetype')?.addEventListener('change', e => upd({ lineType: e.target.value }));

    document.getElementById('sp-conn-dash')?.addEventListener('change', e => upd({ style: { dashArray: e.target.value } }));

    const widthSlider = document.getElementById('sp-conn-width');
    const widthLabel = document.getElementById('sp-conn-width-label');
    widthSlider?.addEventListener('input', e => {
        if (widthLabel) widthLabel.textContent = e.target.value + 'px';
        upd({ style: { strokeWidth: +e.target.value } });
    });

    document.getElementById('sp-conn-color')?.addEventListener('input', e => upd({ style: { stroke: e.target.value } }));

    document.getElementById('sp-conn-arrows')?.addEventListener('change', e => {
        const v = e.target.value;
        upd({ arrowEnd: v === 'end' || v === 'both', arrowStart: v === 'start' || v === 'both' });
    });

    document.getElementById('sp-conn-src-anchor')?.addEventListener('change', e => upd({ sourceAnchor: e.target.value }));
    document.getElementById('sp-conn-tgt-anchor')?.addEventListener('change', e => upd({ targetAnchor: e.target.value }));
    document.getElementById('sp-conn-label')?.addEventListener('input', e => upd({ label: e.target.value }));

    document.getElementById('sp-conn-delete')?.addEventListener('click', () => {
        canvasEditor.removeConnector(id);
        updatePropsPanel();
        updateFormatTab();
    });
}
