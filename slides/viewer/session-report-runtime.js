// @ts-check
import { buildSessionReportHtml, computeSessionInsights } from '../../shared/slides/session-report.mjs';

/**
 * Colle runtime du « Bilan de session » : lit les interactions salle taguées par
 * slide (questions ouvertes, feedback discret, réactions emoji) et produit soit
 * un modèle d'analyse pour le modal, soit un rapport HTML autonome téléchargeable.
 *
 * Aucune logique métier ici — tout est délégué à `shared/slides/session-report.mjs`.
 * Ce module ne fait que collecter les sources vivantes de `viewer-main.js`.
 *
 * @param {{
 *   documentRef?: Document,
 *   getSlides?: () => Array<{ title?: string, type?: string }>,
 *   getDeckTitle?: () => string,
 *   getQuestions?: () => Array<any>,
 *   getFeedback?: () => Array<any>,
 *   getReactions?: () => Array<any>,
 *   getStudents?: () => Array<any>,
 * }} sources
 */
export function createSessionReportRuntime(sources = {}) {
    const doc = sources.documentRef || (typeof document !== 'undefined' ? document : null);
    const call = (fn, fallback) => {
        try { const v = typeof fn === 'function' ? fn() : fn; return v == null ? fallback : v; }
        catch (_) { return fallback; }
    };

    const collect = () => ({
        deckTitle: call(sources.getDeckTitle, '')
            || (doc && doc.getElementById('pv-title')?.textContent)
            || 'Présentation',
        slides: (call(sources.getSlides, []) || []).map(s => ({ title: s.title || '', type: s.type || '' })),
        questions: (call(sources.getQuestions, []) || []).map(q => ({
            text: q.text, slideIndex: q.slideIndex, votes: q.votes,
            resolved: !!q.resolved, hidden: !!q.hidden, time: q.time,
        })),
        feedback: (call(sources.getFeedback, []) || []).map(f => ({ kind: f.kind, slideIndex: f.slideIndex, time: f.time })),
        reactions: (call(sources.getReactions, []) || []).map(r => ({ emoji: r.emoji, slideIndex: r.slideIndex, time: r.time })),
        students: (call(sources.getStudents, []) || []).map(s => ({
            pseudo: s.pseudo, score: s.score, quizCount: s.quizCount, quizCorrect: s.quizCorrect,
        })),
        generatedAt: Date.now(),
    });

    return {
        getInput: collect,
        getInsights: () => computeSessionInsights(collect()),
        /** Génère la page HTML autonome et déclenche son téléchargement. */
        download() {
            if (!doc || !doc.body) return false;
            const input = collect();
            const html = buildSessionReportHtml(input);
            const slug = String(input.deckTitle).toLowerCase()
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'session';
            const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
            const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
            const link = doc.createElement('a');
            link.href = url;
            link.download = `rapport-session-${slug}-${stamp}.html`;
            doc.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
            return true;
        },
    };
}
