/**
 * @module slides/editor-ai-quiz
 * @internal Module Slides chargé côté navigateur.
 * @example
 * // Chargement navigateur (après editor-ai-client.js):
 * // <script src="../shared/slides/editor-ai-quiz.js"></script>
 */
/* editor-ai-quiz.js — flow "ajouter des quiz aux slides courantes" via Gemini.
   Extrait de editor-ai-pipeline.js (chantier découpe pipeline IA éditeur). */
(function initEditorAIQuizModule(globalScope) {
    'use strict';

    const root = globalScope || window;
    const S = root.OEIEditorAIPipelineShared || null;
    if (!S) {
        throw new Error('OEIEditorAIPipelineShared indisponible: impossible de démarrer le module quiz IA éditeur.');
    }
    const _client = root.OEIEditorAIClient || null;
    if (!_client) {
        throw new Error('OEIEditorAIClient indisponible: impossible de démarrer le module quiz IA éditeur.');
    }
    const _editorAiSettings = root.OEIEditorAISettings || null;
    if (!_editorAiSettings) {
        throw new Error('OEIEditorAISettings indisponible: impossible de démarrer le module quiz IA éditeur.');
    }
    const AI_PROMPT_DEFAULTS = _editorAiSettings.AI_PROMPT_DEFAULTS;

    const editor = S.editor;
    const notify = S.notify;
    const _escapeHtmlAi = S.escapeHtmlAi;
    const _tryParseJsonLoose = S.tryParseJsonLoose;
    const _computeAIQuizTarget = S.computeAIQuizTarget;
    const _callGeminiGenerate = _client._callGeminiGenerate;

const _AI_QUIZ_COMPONENT_TYPES = new Set([
    'mcq-single',
    'mcq-multi',
    'quiz-live',
    'poll-likert',
    'exit-ticket',
    'cloze',
]);

function _makeCanvasElementId() {
    return 'el_' + Math.random().toString(36).slice(2, 9);
}

function _extractCanvasHeadingText(slide) {
    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    const heading = elements
        .filter(el => String(el?.type || '').toLowerCase() === 'heading')
        .sort((a, b) => Number(a?.y || 0) - Number(b?.y || 0))[0];
    const text = String(heading?.data?.text || '').trim();
    return text;
}

function _extractSlideTitleForQuiz(slide, index) {
    const explicit = String(slide?.title || '').trim();
    if (explicit) return explicit;
    const fromCanvas = _extractCanvasHeadingText(slide);
    if (fromCanvas) return fromCanvas;
    return `Slide ${index + 1}`;
}

function _extractSlideTextForQuiz(slide) {
    const chunks = [];
    const push = (value) => {
        const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        if (text) chunks.push(text);
    };
    if (!slide || typeof slide !== 'object') return '';
    ['title', 'subtitle', 'text', 'term', 'definition', 'quote', 'caption', 'notes'].forEach(k => push(slide[k]));
    if (Array.isArray(slide.items)) slide.items.forEach(item => push(item));
    if (slide.type === 'quiz' && Array.isArray(slide.questions)) {
        slide.questions.forEach(q => {
            push(q?.question);
            if (Array.isArray(q?.options)) q.options.forEach(opt => push(opt));
        });
    }
    if (slide.type === 'canvas' && Array.isArray(slide.elements)) {
        slide.elements.forEach((el) => {
            if (!el || typeof el !== 'object') return;
            const data = (el.data && typeof el.data === 'object') ? el.data : {};
            ['text', 'title', 'question', 'prompt', 'term', 'definition', 'example', 'label', 'sentence'].forEach(k => push(data[k]));
            if (Array.isArray(data.items)) data.items.forEach(item => push(item));
            if (Array.isArray(data.options)) data.options.forEach(opt => push(opt));
            if (Array.isArray(data.prompts)) data.prompts.forEach(item => push(item));
            if (Array.isArray(data.rows)) {
                data.rows.forEach((row) => {
                    if (Array.isArray(row)) row.forEach(cell => push(cell));
                });
            }
        });
    }
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

function _buildSlidesOutlineForQuizPrompt(data, maxSlides = 90) {
    const slides = Array.isArray(data?.slides) ? data.slides : [];
    return slides.slice(0, Math.max(1, maxSlides)).map((slide, idx) => {
        const title = _extractSlideTitleForQuiz(slide, idx);
        const type = String(slide?.type || 'unknown');
        const text = _extractSlideTextForQuiz(slide).slice(0, 320);
        return `S${idx + 1} | type=${type} | titre=${title} | contenu=${text || '—'}`;
    }).join('\n');
}

function _describeQuizInsertionStrategy(tuning, slideCount) {
    const mode = String(tuning?.quizMode || 'auto-frequency').toLowerCase();
    const everyN = Math.max(2, Math.min(20, Math.trunc(Number(tuning?.quizEverySlides) || AI_PROMPT_DEFAULTS.quizEverySlides)));
    const target = Math.max(1, _computeAIQuizTarget(tuning));
    if (mode === 'every-n') return `Insérer un quiz toutes les ${everyN} slides de contenu.`;
    if (mode === 'section-end') return 'Insérer un quiz à la fin de chaque grande partie.';
    if (mode === 'hybrid') return `Mode hybride: fin de partie + toutes les ${everyN} slides.`;
    if (mode === 'none') return 'L’utilisateur demande explicitement d’ajouter des quiz: insérer 2 à 4 quiz pertinents.';
    const clamped = Math.max(1, Math.min(slideCount, target));
    return `Mode auto: proposer environ ${clamped} quiz répartis régulièrement.`;
}

function _buildGeminiQuizAugmentPrompt({ tuning, presentation }) {
    const slideCount = Array.isArray(presentation?.slides) ? presentation.slides.length : 0;
    const target = Math.max(1, Math.min(slideCount || 1, _computeAIQuizTarget(tuning)));
    const strategy = _describeQuizInsertionStrategy(tuning, slideCount);
    const outline = _buildSlidesOutlineForQuizPrompt(presentation, 100);
    return [
        'Tu dois UNIQUEMENT proposer des quiz à AJOUTER dans une présentation existante.',
        'Tu ne réécris pas toute la présentation.',
        'Réponds uniquement en JSON valide (sans markdown).',
        'Schéma JSON strict de sortie:',
        '{"quizzes":[{"afterSlide":1,"quizType":"mcq-single|mcq-multi|quiz-live|poll-likert|exit-ticket|cloze","title":"...","question":"...","options":["..."],"answer":0,"answers":[0,2],"duration":30,"prompt":"...","prompts":["..."],"sentence":"...","blanks":["..."]}]}',
        'Règles:',
        `- Nombre de quiz attendu: environ ${target}.`,
        `- Stratégie de placement: ${strategy}`,
        '- `afterSlide` est 1-based et doit être entre 1 et le nombre de slides existantes.',
        '- `quizType` doit être l’un des types autorisés du schéma.',
        '- Questions courtes, actionnables, liées au contenu de la slide précédente.',
        '- Pour mcq-single/quiz-live: options (3-5), answer = index valide.',
        '- Pour mcq-multi: options (4-6), answers = tableau d’index (>=2).',
        '- Pour exit-ticket: utiliser prompts (2-4) plutôt que options.',
        '- Pour cloze: fournir sentence + blanks.',
        `Contexte de la présentation (${slideCount} slides):`,
        outline,
    ].join('\n\n');
}

function _normalizeQuizChoiceItems(rawOptions, fallback = []) {
    const out = Array.isArray(rawOptions)
        ? rawOptions.map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim()).filter(Boolean)
        : [];
    return out.length ? out : fallback;
}

function _normalizeQuizAugmentPlan(payload, totalSlides, tuning) {
    const src = Array.isArray(payload?.quizzes) ? payload.quizzes : [];
    const maxCount = Math.max(1, Math.min(totalSlides || 1, Math.max(1, _computeAIQuizTarget(tuning))));
    const normalized = src.map((entry, idx) => {
        const rawType = String(entry?.quizType || entry?.type || '').trim().toLowerCase();
        const quizType = _AI_QUIZ_COMPONENT_TYPES.has(rawType) ? rawType : 'mcq-single';
        const afterSlideRaw = Number(entry?.afterSlide ?? entry?.slide ?? entry?.after ?? (idx + 1));
        const afterSlide = Number.isFinite(afterSlideRaw)
            ? Math.max(1, Math.min(Math.max(1, totalSlides), Math.trunc(afterSlideRaw)))
            : Math.max(1, Math.min(Math.max(1, totalSlides), idx + 1));
        const title = String(entry?.title || entry?.label || `Quiz ${idx + 1}`).trim() || `Quiz ${idx + 1}`;
        const question = String(entry?.question || entry?.prompt || '').replace(/\s+/g, ' ').trim();
        const options = _normalizeQuizChoiceItems(entry?.options, [
            'Réponse A',
            'Réponse B',
            'Réponse C',
        ]);
        const answers = Array.isArray(entry?.answers)
            ? [...new Set(entry.answers.map(v => Math.trunc(Number(v))).filter(v => Number.isFinite(v) && v >= 0 && v < options.length))]
            : [];
        let answer = Math.trunc(Number(entry?.answer));
        if (!Number.isFinite(answer) || answer < 0 || answer >= options.length) answer = 0;
        const duration = Math.max(10, Math.min(180, Math.trunc(Number(entry?.duration) || 30)));
        const prompts = _normalizeQuizChoiceItems(entry?.prompts, [question || 'Qu’avez-vous retenu ?', 'Quelle notion reste floue ?']);
        const sentence = String(entry?.sentence || question || '').trim();
        const blanks = _normalizeQuizChoiceItems(entry?.blanks, []);
        return {
            afterSlide,
            quizType,
            title,
            question,
            options,
            answer,
            answers,
            duration,
            prompt: String(entry?.prompt || question || '').trim(),
            prompts,
            sentence,
            blanks,
        };
    }).filter(Boolean);

    if (!normalized.length) return [];
    normalized.sort((a, b) => a.afterSlide - b.afterSlide);
    return normalized.slice(0, Math.max(1, maxCount * 2));
}

function _buildQuizCanvasElementData(spec) {
    const type = spec.quizType;
    if (type === 'mcq-multi') {
        const answers = spec.answers.length ? spec.answers : [0, 1].filter(i => i < spec.options.length);
        return {
            label: spec.title || 'QCM multi',
            question: spec.question || 'Sélectionnez les réponses correctes.',
            options: spec.options.slice(0, 6),
            answers,
        };
    }
    if (type === 'quiz-live') {
        return {
            label: spec.title || 'Quiz',
            question: spec.question || 'Choisissez la bonne réponse.',
            options: spec.options.slice(0, 5),
            answer: spec.answer,
            duration: spec.duration,
        };
    }
    if (type === 'poll-likert') {
        return {
            prompt: spec.prompt || spec.question || 'Votre niveau de confiance (1 à 5) ?',
        };
    }
    if (type === 'exit-ticket') {
        return {
            title: spec.title || 'Exit ticket',
            prompts: spec.prompts.slice(0, 4),
        };
    }
    if (type === 'cloze') {
        const sentence = spec.sentence || spec.question || 'Complétez: ____';
        const safeSentence = sentence.includes('____') ? sentence : `${sentence} ____`;
        return {
            sentence: safeSentence,
            blanks: spec.blanks.length ? spec.blanks : ['réponse'],
        };
    }
    return {
        label: spec.title || 'QCM simple',
        question: spec.question || 'Choisissez la meilleure réponse.',
        options: spec.options.slice(0, 6),
        answer: spec.answer,
    };
}

function _buildQuizCanvasSlide(spec, idx, sourceTitle = '') {
    const slideTitle = spec.title || `Quiz ${idx + 1}`;
    return {
        type: 'canvas',
        title: slideTitle,
        notes: sourceTitle ? `Quiz ajouté après: ${sourceTitle}` : 'Quiz ajouté par IA',
        levels: [],
        elements: [
            {
                id: _makeCanvasElementId(),
                type: 'heading',
                x: 80,
                y: 40,
                w: 1120,
                h: 104,
                z: 1,
                data: { text: slideTitle },
                style: {
                    fontWeight: 800,
                    color: 'var(--sl-heading)',
                    textAlign: 'left',
                    fontFamily: 'var(--sl-font-heading)',
                },
            },
            {
                id: _makeCanvasElementId(),
                type: spec.quizType,
                x: 120,
                y: 170,
                w: 1040,
                h: 470,
                z: 2,
                data: _buildQuizCanvasElementData(spec),
                style: {},
            },
        ],
        connectors: [],
    };
}

function _insertQuizSlidesIntoPresentation(presentation, plan) {
    const source = (presentation && typeof presentation === 'object') ? presentation : {};
    const next = JSON.parse(JSON.stringify(source));
    const slides = Array.isArray(next.slides) ? next.slides : [];
    const originalSlides = slides.slice();
    const sorted = (Array.isArray(plan) ? plan : []).slice().sort((a, b) => a.afterSlide - b.afterSlide);
    let inserted = 0;
    sorted.forEach((spec, idx) => {
        const baseAfter = Math.max(1, Math.min(originalSlides.length || 1, Number(spec.afterSlide) || 1));
        const insertAt = Math.max(0, Math.min(slides.length, baseAfter + inserted));
        const srcTitle = _extractSlideTitleForQuiz(originalSlides[baseAfter - 1], baseAfter - 1);
        slides.splice(insertAt, 0, _buildQuizCanvasSlide(spec, idx, srcTitle));
        inserted += 1;
    });
    next.slides = slides;
    next.metadata = (next.metadata && typeof next.metadata === 'object') ? next.metadata : {};
    next.metadata.modified = new Date().toISOString().slice(0, 10);
    return { data: next, inserted };
}

async function _runGeminiQuizAugmentFlow({ tuning, gemini }) {
    if (!gemini?.apiKey) {
        notify('Ajoute d’abord la clé API Gemini', 'warning');
        return;
    }
    const current = window.editor?.data;
    const totalSlides = Array.isArray(current?.slides) ? current.slides.length : 0;
    if (!current || totalSlides === 0) {
        notify('Aucune slide disponible pour ajouter des quiz', 'warning');
        return;
    }
    const prompt = _buildGeminiQuizAugmentPrompt({ tuning, presentation: current });
    try {
        notify('IA: génération de quiz à partir des slides existantes…', 'info');
        const raw = await _callGeminiGenerate({
            apiKey: gemini.apiKey,
            model: gemini.model,
            prompt,
            temperature: Math.max(0.1, Math.min(0.8, Number(gemini.temperature) || 0.3)),
            timeoutMs: gemini.requestTimeoutMs,
        });
        const parsed = _tryParseJsonLoose(raw);
        if (!parsed.ok) throw new Error(parsed.error || 'JSON de quiz invalide');
        const plan = _normalizeQuizAugmentPlan(parsed.value, totalSlides, tuning);
        if (!plan.length) {
            notify('Aucun quiz exploitable renvoyé par Gemini', 'warning');
            return;
        }

        const previewRows = plan.slice(0, 14).map((q, i) =>
            `<tr><td>${i + 1}</td><td>${q.afterSlide}</td><td>${_escapeHtmlAi(q.quizType)}</td><td>${_escapeHtmlAi(q.title || q.question || 'Quiz')}</td></tr>`
        ).join('');
        const html = `
            <div style="font-size:.92rem;margin-bottom:8px;">${plan.length} quiz proposé(s) à insérer.</div>
            <div style="max-height:260px;overflow:auto;border:1px solid var(--border,#2d3347);border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
                    <thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">#</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Après slide</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Type</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border,#2d3347);">Titre</th></tr></thead>
                    <tbody>${previewRows}</tbody>
                </table>
            </div>
        `;
        const ok = await (window.OEIDialog?.confirm
            ? window.OEIDialog.confirm(html, {
                title: 'Ajouter des quiz aux slides courantes',
                confirmLabel: 'Insérer les quiz',
                cancelLabel: 'Annuler',
                danger: false,
            })
            : Promise.resolve(true));
        if (!ok) {
            notify('Ajout de quiz annulé', 'info');
            return;
        }

        const result = _insertQuizSlidesIntoPresentation(current, plan);
        editor.load(result.data);
        notify(`${result.inserted} slide(s) quiz ajoutée(s)`, 'success');
    } catch (err) {
        notify(`Ajout de quiz impossible: ${err?.message || 'erreur inconnue'}`, 'error');
    }
}

    root.OEIEditorAIQuiz = Object.freeze({
        _runGeminiQuizAugmentFlow,
        _normalizeQuizAugmentPlan,
        _buildQuizCanvasSlide,
        _buildQuizCanvasElementData,
        _insertQuizSlidesIntoPresentation,
        _buildGeminiQuizAugmentPrompt,
        testUtils: Object.freeze({
            normalizeQuizAugmentPlan: _normalizeQuizAugmentPlan,
            computeAIQuizTarget: _computeAIQuizTarget,
            buildQuizCanvasSlide: _buildQuizCanvasSlide,
            insertQuizSlidesIntoPresentation: _insertQuizSlidesIntoPresentation,
        }),
    });
})(window);
