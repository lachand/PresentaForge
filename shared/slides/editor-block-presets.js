/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-block-presets
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-block-presets.js"></script>
 */
/* editor-block-presets.js — Bibliotheque de blocs pedagogiques (multi-slides) */

const BLOCK_LIBRARY_VERSION = '2026.03';
const _withPresetVersion = preset => ({ ...preset, version: preset.version || BLOCK_LIBRARY_VERSION });
let _blockPresetTriggerBound = false;
const _blockPresetRuntime = window.OEIEditorRuntimeState?.create
    ? window.OEIEditorRuntimeState.create(window)
    : null;
const _blockPresetCtx = () => {
    if (_blockPresetRuntime?.resolveContext) {
        return _blockPresetRuntime.resolveContext({
            editor,
            notify,
        });
    }
    return { editor, notify };
};

function _setBlockPresetModalOpen(modal, isOpen) {
    if (!modal) return;
    modal.classList.toggle('is-open', !!isOpen);
    modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    // Backward-compatible fallback for legacy modal styles.
    modal.style.display = isOpen ? 'flex' : 'none';
}

const BLOCK_PRESETS = Object.freeze([
    {
        id: 'starter-quiz',
        name: 'Ouverture + objectifs + quiz',
        description: 'Démarre un cours avec cadrage, objectifs et une première vérification rapide.',
        duration: '8-12 min',
        tags: ['Démarrage', 'Assessment'],
        slides: [
            {
                type: 'title',
                title: 'Titre de séance',
                subtitle: 'Contexte et promesse pédagogique',
                author: '',
                notes: 'Annoncez le plan et le livrable attendu en fin de séance.'
            },
            {
                type: 'bullets',
                title: 'Objectifs d’apprentissage',
                items: [
                    'Comprendre les notions clés',
                    'Savoir appliquer sur un exemple',
                    'Être capable d’expliquer la méthode'
                ],
                note: 'Durée conseillée: 3-4 minutes',
                notes: 'Demandez aux étudiants de reformuler les objectifs avec leurs mots.'
            },
            {
                type: 'quiz',
                title: 'Question de démarrage',
                quizType: 'mcq',
                options: ['Option A', 'Option B', 'Option C', 'Option D'],
                answer: '0',
                explanation: 'Expliquez pourquoi cette réponse est correcte.',
                notes: 'Utilisez ce quiz comme checkpoint d’entrée.'
            }
        ]
    },
    {
        id: 'demo-guided',
        name: 'Démonstration guidée',
        description: 'Structure en 4 slides: contexte, étape-à-étape, comparaison, synthèse.',
        duration: '12-18 min',
        tags: ['Démonstration', 'Pratique'],
        slides: [
            {
                type: 'chapter',
                title: 'Démonstration guidée',
                subtitle: 'Du problème vers la solution',
                number: '',
                notes: 'Annoncez clairement ce que la démo va prouver.'
            },
            {
                type: 'code',
                title: 'Étape 1 — Mise en place',
                language: 'python',
                code: '# Préparation\nvalues = [3, 1, 4, 1, 5]\nprint(values)',
                explanation: 'Commentez les choix techniques pendant la démo.',
                notes: 'Gardez un rythme lent, validez la compréhension.'
            },
            {
                type: 'comparison',
                title: 'Avant / Après',
                left: { title: 'Avant', items: ['Solution manuelle', 'Peu robuste', 'Difficile à maintenir'] },
                right: { title: 'Après', items: ['Approche structurée', 'Plus fiable', 'Lisible et testable'] },
                notes: 'Mettez en évidence le gain concret.'
            },
            {
                type: 'bullets',
                title: 'Points de vigilance',
                items: ['Piège fréquent n°1', 'Piège fréquent n°2', 'Checklist de validation'],
                notes: 'Terminez avec une checklist actionnable.'
            }
        ]
    },
    {
        id: 'debate-conclude',
        name: 'Débat + synthèse',
        description: 'Séquence interactive pour lancer un débat puis formaliser les conclusions.',
        duration: '10-15 min',
        tags: ['Interaction', 'Synthèse'],
        slides: [
            {
                type: 'title',
                title: 'Question de débat',
                subtitle: 'Prenez position avec arguments',
                author: '',
                notes: 'Fixez les règles du débat (temps, prise de parole).'
            },
            {
                type: 'split',
                title: 'Arguments',
                left: {
                    label: 'Position A',
                    type: 'bullets',
                    items: ['Argument A1', 'Argument A2', 'Argument A3']
                },
                right: {
                    label: 'Position B',
                    type: 'bullets',
                    items: ['Argument B1', 'Argument B2', 'Argument B3']
                },
                notes: 'Collectez les arguments en direct dans les deux colonnes.'
            },
            {
                type: 'definition',
                title: 'Critère de décision',
                term: 'Choix recommandé',
                definition: 'Formalisez la décision selon des critères observables.',
                example: 'Exemple: performance, coût, maintenabilité.',
                notes: 'Concluez avec un cadre de décision réutilisable.'
            }
        ]
    },
    {
        id: 'revision-cycle',
        name: 'Révision active',
        description: 'Cycle de rappel, auto-évaluation et plan d’action.',
        duration: '8-10 min',
        tags: ['Révision', 'Métacognition'],
        slides: [
            {
                type: 'bullets',
                title: 'Rappel express',
                items: ['Concept 1', 'Concept 2', 'Concept 3'],
                notes: 'Demandez un exemple par concept avant de passer au quiz.'
            },
            {
                type: 'quiz',
                title: 'Auto-évaluation',
                quizType: 'mcq',
                options: ['Je maîtrise', 'Je comprends partiellement', 'Je dois retravailler', 'Je ne sais pas'],
                answer: '0',
                explanation: 'Rendez explicites les critères de maîtrise.',
                notes: 'Checkpoint intermédiaire avant la conclusion.'
            },
            {
                type: 'bullets',
                title: 'Plan d’action personnel',
                items: ['Point à retravailler', 'Ressource à consulter', 'Exercice à faire cette semaine'],
                notes: 'Faites formuler un engagement concret.'
            }
        ]
    },
    {
        id: 'scene-checkpoint-live',
        name: 'Scène live — Checkpoint compréhension',
        description: 'Séquence interactive prête à l’emploi: cadrage, Likert, QCM, synthèse.',
        duration: '10-14 min',
        tags: ['Scène', 'Assessment', 'Interaction'],
        slides: [
            {
                type: 'title',
                title: 'Checkpoint live',
                subtitle: 'On vérifie la compréhension ensemble',
                author: '',
                notes: 'Annoncez la règle: participation courte, puis débrief.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc1-h1', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Niveau de confiance sur ce chapitre' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc1-p1', type: 'poll-likert', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { prompt: 'De 1 à 5, où en êtes-vous ?' }, style: {} },
                ],
                notes: 'Lancez le poll côté présentateur, puis commentez la distribution.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc1-h2', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Mini QCM de validation' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc1-q1', type: 'mcq-single', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { question: 'Quel concept est central ici ?', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 1 }, style: {} },
                ],
                notes: 'Utilisez les réponses pour décider d’une remédiation courte.'
            },
            {
                type: 'bullets',
                title: 'Synthèse du checkpoint',
                items: [
                    'Ce qui est acquis',
                    'Ce qui doit être renforcé',
                    'Action à faire avant la prochaine séance'
                ],
                notes: 'Terminez avec une action claire à réaliser.'
            }
        ]
    },
    {
        id: 'scene-prioritization-room',
        name: 'Scène live — Priorisation collective',
        description: 'Séquence de convergence: idées rapides puis classement collectif.',
        duration: '12-18 min',
        tags: ['Scène', 'Facilitation', 'Décision'],
        slides: [
            {
                type: 'chapter',
                title: 'Priorisation collective',
                subtitle: 'Converger vers les priorités du groupe',
                notes: 'Cadrez le temps et le critère de choix.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc2-h1', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Collecte rapide des idées' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc2-w1', type: 'postit-wall', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { prompt: 'Une idée clé par personne' }, style: {} },
                ],
                notes: 'Faites émerger 5-10 idées maximum.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc2-h2', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Classement collectif' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc2-r1', type: 'rank-order', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { title: 'Classez les options', items: ['Option A', 'Option B', 'Option C', 'Option D'] }, style: {} },
                ],
                notes: 'Lancez le classement puis discutez la médiane/ordre final.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc2-h3', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Décision finale' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc2-t1', type: 'text', x: 120, y: 170, w: 700, h: 460, z: 2, data: { text: 'Décision retenue, raisons, et plan d’action court terme.' }, style: { fontSize: 24, color: 'var(--sl-text)' } },
                    { id: 'sc2-s1', type: 'room-stats', x: 850, y: 170, w: 310, h: 460, z: 3, data: { title: 'Engagement', metrics: ['students', 'hands', 'questions', 'feedback'] }, style: {} },
                ],
                notes: 'Documentez la décision et le responsable associé.'
            }
        ]
    },
    {
        id: 'scene-exit-ticket-loop',
        name: 'Scène live — Boucle de clôture',
        description: 'Clôture active: feedback discret, exit-ticket et action de suite.',
        duration: '8-12 min',
        tags: ['Scène', 'Clôture', 'Feedback'],
        slides: [
            {
                type: 'canvas',
                elements: [
                    { id: 'sc3-h1', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Rétro minute' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc3-d1', type: 'debate-mode', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { prompt: 'Le rythme de la séance était-il adapté ?' }, style: {} },
                ],
                notes: 'Faites un court point sur le tempo de séance.'
            },
            {
                type: 'canvas',
                elements: [
                    { id: 'sc3-h2', type: 'heading', x: 70, y: 54, w: 1140, h: 80, z: 1, data: { text: 'Exit ticket' }, style: { fontSize: 38, fontWeight: 700, color: 'var(--sl-heading)', fontFamily: 'var(--sl-font-heading)' } },
                    { id: 'sc3-e1', type: 'exit-ticket', x: 120, y: 170, w: 1040, h: 470, z: 2, data: { title: 'Avant de partir', prompts: ['Ce que je retiens', 'Ce qui reste flou', 'Mon action d’ici la prochaine fois'] }, style: {} },
                ],
                notes: 'Collectez les retours pour ajuster la prochaine séance.'
            },
            {
                type: 'bullets',
                title: 'Suite de la séance',
                items: [
                    'Ressource à consulter',
                    'Exercice à faire',
                    'Critère de réussite pour la prochaine séance'
                ],
                notes: 'Terminez par une consigne claire et vérifiable.'
            }
        ]
    },
].map(_withPresetVersion));

function _escHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function closeBlockPresetsModal() {
    const modal = document.getElementById('block-preset-modal');
    _setBlockPresetModalOpen(modal, false);
}

function _collectBlockUsages() {
    const ctx = _blockPresetCtx();
    const slides = Array.isArray(ctx.editor?.data?.slides) ? ctx.editor.data.slides : [];
    let used = 0;
    let outdated = 0;
    for (const slide of slides) {
        const meta = slide?._blockPreset;
        if (!meta || typeof meta !== 'object') continue;
        used += 1;
        const version = String(meta.version || '');
        if (version && version !== BLOCK_LIBRARY_VERSION) outdated += 1;
    }
    return { used, outdated };
}

function _renderLibraryMeta(modal) {
    if (!modal) return;
    const subtitle = modal.querySelector('.slide-type-chooser-subtitle');
    if (!subtitle) return;
    const usage = _collectBlockUsages();
    const usageLabel = usage.used > 0
        ? `${usage.used} slide(s) issue(s) des blocs${usage.outdated > 0 ? ` · ${usage.outdated} à mettre à jour` : ''}`
        : 'Aucun bloc inséré dans cette présentation';
    subtitle.innerHTML = `
        Insérez une séquence complète (objectifs, activité, synthèse...) après le slide actuel.
        <span class="block-preset-library-meta">
            <span class="block-preset-library-version">Bibliothèque v${_escHtml(BLOCK_LIBRARY_VERSION)}</span>
            <span class="block-preset-library-usage">${_escHtml(usageLabel)}</span>
        </span>
    `;
}

function insertBlockPreset(blockId) {
    const ctx = _blockPresetCtx();
    const preset = BLOCK_PRESETS.find(item => item.id === blockId);
    if (!preset || !ctx.editor?.data?.slides) return;

    const insertAt = Number.isFinite(Number(ctx.editor.selectedIndex))
        ? Math.max(0, Number(ctx.editor.selectedIndex) + 1)
        : ctx.editor.data.slides.length;
    const slidesToInsert = _clone(preset.slides || []);
    if (!slidesToInsert.length) return;

    const insertedAt = new Date().toISOString();
    slidesToInsert.forEach((slide, idx) => {
        slide._blockPreset = {
            id: preset.id,
            name: preset.name,
            version: preset.version || BLOCK_LIBRARY_VERSION,
            insertedAt,
            positionInBlock: idx + 1,
            blockSize: slidesToInsert.length,
        };
    });
    ctx.editor.data.blockLibrary = {
        version: BLOCK_LIBRARY_VERSION,
        updatedAt: insertedAt,
    };

    ctx.editor.data.slides.splice(insertAt, 0, ...slidesToInsert);
    ctx.editor.selectedIndex = insertAt;
    ctx.editor._push();
    ctx.editor.onUpdate('slides');

    closeBlockPresetsModal();
    if (typeof ctx.notify === 'function') {
        ctx.notify(`Bloc « ${preset.name} » inséré (${slidesToInsert.length} slide${slidesToInsert.length > 1 ? 's' : ''})`, 'success');
    }
}

function openBlockPresetsModal() {
    const modal = document.getElementById('block-preset-modal');
    const grid = document.getElementById('block-preset-grid');
    if (!modal || !grid) return;
    _renderLibraryMeta(modal);

    grid.innerHTML = BLOCK_PRESETS.map(preset => {
        const chips = (preset.tags || []).map(tag => `<span class="block-preset-chip">${_escHtml(tag)}</span>`).join('');
        const outline = (preset.slides || []).map((slide, idx) => (
            `<li><span>${idx + 1}.</span><span>${_escHtml(slide.title || slide.term || slide.type || 'Slide')}</span></li>`
        )).join('');
        return `
            <button type="button" class="block-preset-card" data-block-id="${_escHtml(preset.id)}">
                <div class="block-preset-head">
                    <span class="block-preset-title">${_escHtml(preset.name)}</span>
                    <span class="block-preset-meta">${(preset.slides || []).length} slides · ${_escHtml(preset.duration || '')} · v${_escHtml(preset.version || BLOCK_LIBRARY_VERSION)}</span>
                </div>
                <p class="block-preset-desc">${_escHtml(preset.description || '')}</p>
                <div class="block-preset-chips">${chips}</div>
                <ul class="block-preset-outline">${outline}</ul>
            </button>
        `;
    }).join('');

    grid.querySelectorAll('.block-preset-card').forEach(card => {
        card.addEventListener('click', () => {
            insertBlockPreset(String(card.dataset.blockId || ''));
        });
    });

    _setBlockPresetModalOpen(modal, true);
}

function initBlockPresetsModal() {
    const modal = document.getElementById('block-preset-modal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    if (!_blockPresetTriggerBound) {
        _blockPresetTriggerBound = true;
        document.addEventListener('click', event => {
            const trigger = event.target?.closest?.('#btn-block-presets');
            if (!trigger) return;
            event.preventDefault();
            openBlockPresetsModal();
        });
    }
    document.getElementById('block-preset-close')?.addEventListener('click', closeBlockPresetsModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) closeBlockPresetsModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeBlockPresetsModal();
    });
}

window.initBlockPresetsModal = initBlockPresetsModal;
window.openBlockPresetsModal = openBlockPresetsModal;
window.closeBlockPresetsModal = closeBlockPresetsModal;
