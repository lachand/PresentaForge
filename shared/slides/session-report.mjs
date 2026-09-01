/**
 * session-report.mjs — synthèse et export du « Rapport de fin de session » salle.
 *
 * Agrège les interactions étudiantes capturées pendant une session salle
 * (questions ouvertes, feedback discret, réactions emoji), chacune taguée avec
 * l'index de slide où elle a eu lieu, puis produit :
 *   - `computeSessionInsights()` : un modèle de données pour le modal « Bilan »
 *   - `buildSessionReportHtml()`  : une page HTML autonome (imprimable) à archiver
 *
 * Aucune dépendance DOM : pur data → data / data → string. Testé via node:test.
 */

/** Réactions « je n'ai pas compris / je me questionne ». */
export const CONFUSED_EMOJI = ['❓', '😕', '🤔'];
/** Réactions positives / d'adhésion. */
export const POSITIVE_EMOJI = ['👍', '🎉', '👏', '🔥', '😀'];

/** Libellés FR des feedbacks discrets (`STUDENT_FEEDBACK.kind`). */
export const FEEDBACK_LABELS = {
    fast: 'Trop rapide',
    unclear: 'Pas clair',
    pause: 'Pause demandée',
    clear: 'C’est clair',
};

const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Nettoie un fragment HTML (titre de slide venu du deck) → texte brut. */
const stripTags = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/** Normalise un texte saisi par un étudiant : espaces compactés, borné. Les
 *  chevrons éventuels sont conservés (échappés au rendu), pas retirés. */
const plainText = (value, max = 400) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const toIndex = value => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : 0;
};

/**
 * @param {Array<{ title?: string, type?: string }>} slides
 * @param {number} index
 * @returns {string}
 */
export function slideLabel(slides, index) {
    const slide = Array.isArray(slides) ? slides[index] : null;
    const title = slide ? stripTags(slide.title) : '';
    if (title) return title;
    if (slide && slide.type) return `Slide ${index + 1} (${slide.type})`;
    return `Slide ${index + 1}`;
}

/**
 * Construit le modèle d'analyse de session.
 *
 * @param {{
 *   slides?: Array<{ title?: string, type?: string }>,
 *   questions?: Array<{ text?: string, slideIndex?: number, votes?: number, resolved?: boolean, hidden?: boolean, time?: number }>,
 *   feedback?: Array<{ kind?: string, slideIndex?: number, time?: number }>,
 *   reactions?: Array<{ emoji?: string, slideIndex?: number, time?: number }>,
 *   students?: Array<{ pseudo?: string, score?: number, quizCount?: number, quizCorrect?: number }>,
 * }} input
 */
export function computeSessionInsights(input = {}) {
    const slides = Array.isArray(input.slides) ? input.slides : [];
    const questions = Array.isArray(input.questions) ? input.questions : [];
    const feedback = Array.isArray(input.feedback) ? input.feedback : [];
    const reactions = Array.isArray(input.reactions) ? input.reactions : [];
    const students = Array.isArray(input.students) ? input.students : [];

    const slideCount = slides.length;
    const perSlide = new Map();
    const slot = idx => {
        if (!perSlide.has(idx)) {
            perSlide.set(idx, {
                index: idx,
                title: slideLabel(slides, idx),
                questions: 0,
                unclear: 0,
                fast: 0,
                pause: 0,
                clear: 0,
                confused: 0,
                positive: 0,
                reactions: 0,
                emoji: {},
                attention: 0,
            });
        }
        return perSlide.get(idx);
    };

    const openQuestions = [];
    let questionsTotal = 0;
    questions.forEach(q => {
        if (!q || q.hidden) return;
        const text = plainText(q.text);
        if (!text) return;
        questionsTotal += 1;
        const idx = toIndex(q.slideIndex);
        const s = slot(idx);
        s.questions += 1;
        if (!q.resolved) {
            openQuestions.push({
                text,
                slideIndex: idx,
                slideTitle: slideLabel(slides, idx),
                votes: Math.max(1, Number(q.votes) || 1),
                time: Number(q.time) || 0,
            });
        }
    });

    const feedbackTotals = { fast: 0, unclear: 0, pause: 0, clear: 0 };
    feedback.forEach(f => {
        if (!f) return;
        const kind = String(f.kind || '').toLowerCase();
        if (!(kind in feedbackTotals)) return;
        feedbackTotals[kind] += 1;
        const s = slot(toIndex(f.slideIndex));
        s[kind] += 1;
    });

    let reactionsTotal = 0;
    let confusedTotal = 0;
    let positiveTotal = 0;
    reactions.forEach(r => {
        if (!r || !r.emoji) return;
        reactionsTotal += 1;
        const s = slot(toIndex(r.slideIndex));
        s.reactions += 1;
        s.emoji[r.emoji] = (s.emoji[r.emoji] || 0) + 1;
        if (CONFUSED_EMOJI.includes(r.emoji)) { s.confused += 1; confusedTotal += 1; }
        if (POSITIVE_EMOJI.includes(r.emoji)) { s.positive += 1; positiveTotal += 1; }
    });

    const rows = [...perSlide.values()].map(s => {
        s.attention = s.questions * 3 + s.unclear * 2 + s.confused * 1.5 + s.pause * 1 + s.fast * 0.5;
        return s;
    }).sort((a, b) => a.index - b.index);

    const topBy = key => rows
        .filter(r => r[key] > 0)
        .sort((a, b) => b[key] - a[key] || a.index - b.index)
        .slice(0, 3)
        .map(r => ({ index: r.index, title: r.title, count: r[key] }));

    openQuestions.sort((a, b) => a.slideIndex - b.slideIndex || b.votes - a.votes || a.time - b.time);

    const stamps = [
        ...questions.map(q => Number(q && q.time) || 0),
        ...feedback.map(f => Number(f && f.time) || 0),
        ...reactions.map(r => Number(r && r.time) || 0),
    ].filter(t => t > 0);
    const firstAt = stamps.length ? Math.min(...stamps) : 0;
    const lastAt = stamps.length ? Math.max(...stamps) : 0;

    const withQuiz = students.filter(s => (s && s.quizCount) > 0);
    const totalCorrect = withQuiz.reduce((acc, s) => acc + (Number(s.quizCorrect) || 0), 0);
    const totalAnswered = withQuiz.reduce((acc, s) => acc + (Number(s.quizCount) || 0), 0);

    return {
        slideCount,
        studentCount: students.length,
        totals: {
            questions: questionsTotal,
            openQuestions: openQuestions.length,
            unclear: feedbackTotals.unclear,
            fast: feedbackTotals.fast,
            pause: feedbackTotals.pause,
            clear: feedbackTotals.clear,
            reactions: reactionsTotal,
            confused: confusedTotal,
            positive: positiveTotal,
        },
        quiz: {
            answered: totalAnswered,
            correct: totalCorrect,
            accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null,
        },
        perSlide: rows,
        hotspots: {
            questions: topBy('questions'),
            unclear: topBy('unclear'),
            confused: topBy('confused'),
        },
        openQuestions,
        span: { firstAt, lastAt, durationMs: firstAt && lastAt ? Math.max(0, lastAt - firstAt) : 0 },
    };
}

const fmtClock = ms => {
    const total = Math.max(0, Math.round(Number(ms) || 0) / 1000);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m} min ${String(s).padStart(2, '0')} s`;
};

const fmtDate = ts => {
    const d = ts ? new Date(ts) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
};

/**
 * Génère une page HTML autonome (CSS inline, aucune dépendance) résumant la session.
 *
 * @param {{
 *   deckTitle?: string,
 *   slides?: Array<{ title?: string, type?: string }>,
 *   questions?: Array<any>,
 *   feedback?: Array<any>,
 *   reactions?: Array<any>,
 *   students?: Array<{ pseudo?: string, score?: number, quizCount?: number, quizCorrect?: number }>,
 *   generatedAt?: number,
 * }} input
 * @returns {string}
 */
export function buildSessionReportHtml(input = {}) {
    const insights = computeSessionInsights(input);
    const deckTitle = stripTags(input.deckTitle) || 'Présentation';
    const students = Array.isArray(input.students) ? input.students.slice() : [];
    const generatedAt = Number(input.generatedAt) || Date.now();

    const t = insights.totals;
    const metaBits = [
        `${insights.studentCount} étudiant${insights.studentCount > 1 ? 's' : ''}`,
        insights.span.durationMs > 60000 ? `activité sur ${fmtClock(insights.span.durationMs)}` : null,
        `${t.questions} question${t.questions > 1 ? 's' : ''}`,
        `${t.reactions} réaction${t.reactions > 1 ? 's' : ''}`,
        insights.quiz.accuracy !== null ? `${insights.quiz.accuracy}% de bonnes réponses` : null,
    ].filter(Boolean);

    const questionsSection = insights.openQuestions.length
        ? (() => {
            const bySlide = new Map();
            insights.openQuestions.forEach(q => {
                if (!bySlide.has(q.slideIndex)) bySlide.set(q.slideIndex, { title: q.slideTitle, items: [] });
                bySlide.get(q.slideIndex).items.push(q);
            });
            const groups = [...bySlide.entries()].sort((a, b) => a[0] - b[0]).map(([idx, grp]) => `
        <div class="grp">
          <h3><span class="sidx">Slide ${idx + 1}</span> ${esc(grp.title)}</h3>
          <ul>
            ${grp.items.map(q => `<li>${esc(q.text)}${q.votes > 1 ? ` <span class="votes">+${q.votes - 1} autre${q.votes - 1 > 1 ? 's' : ''}</span>` : ''}</li>`).join('\n            ')}
          </ul>
        </div>`).join('\n');
            return `<section>
      <h2>Questions à traiter <span class="count">${insights.openQuestions.length}</span></h2>
      <p class="hint">Questions posées pendant la séance et non marquées comme résolues. Repère la slide concernée pour y revenir.</p>
      ${groups}
    </section>`;
        })()
        : `<section><h2>Questions à traiter</h2><p class="empty">Aucune question en attente — soit aucune n'a été posée, soit toutes ont été traitées en direct. 🎉</p></section>`;

    const heatRows = insights.perSlide
        .filter(s => s.questions || s.unclear || s.pause || s.fast || s.confused || s.reactions)
        .map(s => `
        <tr${s.attention >= 6 ? ' class="hot"' : ''}>
          <td class="s-idx">${s.index + 1}</td>
          <td class="s-title">${esc(s.title)}</td>
          <td>${s.questions || '·'}</td>
          <td>${s.unclear || '·'}</td>
          <td>${s.pause || '·'}</td>
          <td>${s.fast || '·'}</td>
          <td>${s.confused || '·'}</td>
          <td>${s.positive || '·'}</td>
        </tr>`).join('\n');

    const heatSection = heatRows
        ? `<section>
      <h2>Carte de chaleur par slide</h2>
      <p class="hint">Une ligne par slide ayant reçu au moins une interaction. Les lignes surlignées concentrent l'attention.</p>
      <div class="tbl-wrap"><table class="heat">
        <thead><tr><th>#</th><th>Slide</th><th>Questions</th><th>Pas clair</th><th>Pause</th><th>Trop rapide</th><th>😕❓</th><th>👍🎉</th></tr></thead>
        <tbody>${heatRows}
        </tbody>
      </table></div>
    </section>`
        : '';

    const hotspotList = (label, rows) => rows.length
        ? `<div class="hs"><h4>${esc(label)}</h4><ol>${rows.map(r => `<li><span class="sidx">S${r.index + 1}</span> ${esc(r.title)} <span class="c">${r.count}</span></li>`).join('')}</ol></div>`
        : '';
    const hotspotsSection = (insights.hotspots.questions.length || insights.hotspots.unclear.length || insights.hotspots.confused.length)
        ? `<section>
      <h2>Diapos à revoir en priorité</h2>
      <div class="hs-grid">
        ${hotspotList('Le plus de questions', insights.hotspots.questions)}
        ${hotspotList('Le plus de « pas clair »', insights.hotspots.unclear)}
        ${hotspotList('Le plus de « je n’ai pas compris »', insights.hotspots.confused)}
      </div>
    </section>`
        : '';

    const leaderboard = students.slice().sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    const leaderboardSection = leaderboard.some(s => (Number(s.score) || 0) > 0 || (Number(s.quizCount) || 0) > 0)
        ? `<section>
      <h2>Classement quiz</h2>
      <div class="tbl-wrap"><table class="lb">
        <thead><tr><th>#</th><th>Étudiant</th><th>Score</th><th>Réussite</th></tr></thead>
        <tbody>${leaderboard.map((s, i) => `
          <tr><td>${i + 1}</td><td>${esc(s.pseudo || 'Anonyme')}</td><td>${(Number(s.score) || 0).toLocaleString('fr-FR')} pts</td><td>${(Number(s.quizCount) || 0) > 0 ? Math.round(((Number(s.quizCorrect) || 0) / s.quizCount) * 100) + ' %' : '·'}</td></tr>`).join('')}
        </tbody>
      </table></div>
    </section>`
        : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport de session — ${esc(deckTitle)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px 64px; background: #f4f3fa; color: #1d1b1a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.55; }
  .sheet { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 16px;
    box-shadow: 0 12px 40px rgba(29,27,26,0.1); padding: 36px 40px 44px; }
  header h1 { font-size: 1.5rem; margin: 0 0 4px; }
  header .deck { color: #565f6b; font-size: 1rem; margin: 0 0 12px; }
  header .meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; }
  header .meta span { background: #eeedf4; border-radius: 999px; padding: 4px 12px; font-size: 0.82rem; font-weight: 600; }
  header .gen { color: #8a9099; font-size: 0.78rem; }
  section { margin-top: 34px; }
  h2 { font-size: 1.15rem; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin: 0 0 6px;
    display: flex; align-items: center; gap: 10px; }
  h2 .count { background: #1e3a8a; color: #fff; border-radius: 999px; font-size: 0.8rem; padding: 1px 10px; }
  .hint { color: #565f6b; font-size: 0.85rem; margin: 4px 0 14px; }
  .empty { color: #565f6b; font-style: italic; }
  .grp { margin: 14px 0; }
  .grp h3 { font-size: 0.98rem; margin: 0 0 6px; }
  .sidx, .s-idx { display: inline-block; background: #dbe4ff; color: #1e3a8a; border-radius: 6px;
    padding: 1px 8px; font-size: 0.75rem; font-weight: 700; margin-right: 4px; }
  .grp ul { margin: 0; padding-left: 22px; }
  .grp li { margin: 3px 0; }
  .votes { color: #8a9099; font-size: 0.8rem; }
  .tbl-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.87rem; margin-top: 8px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e9e7ef; }
  th { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: #565f6b; }
  table.heat td:not(.s-title):not(.s-idx), table.lb td:first-child { text-align: center; font-variant-numeric: tabular-nums; }
  table.heat td.s-idx { text-align: center; font-weight: 700; color: #8a9099; }
  tr.hot { background: #fff4e6; }
  tr.hot td.s-title { font-weight: 600; }
  .hs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 12px; }
  .hs h4 { font-size: 0.85rem; margin: 0 0 6px; color: #1e3a8a; }
  .hs ol { margin: 0; padding-left: 20px; }
  .hs li { margin: 4px 0; font-size: 0.87rem; }
  .hs li .c { color: #8a9099; font-weight: 700; white-space: nowrap; }
  .hs li .sidx { white-space: nowrap; }
  footer { margin-top: 40px; color: #8a9099; font-size: 0.75rem; text-align: center; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; max-width: none; border-radius: 0; padding: 0; }
    tr.hot { background: #f0f0f0; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <h1>Rapport de fin de session</h1>
      <p class="deck">${esc(deckTitle)}</p>
      <div class="meta">${metaBits.map(b => `<span>${esc(b)}</span>`).join('')}</div>
      <p class="gen">Généré le ${esc(fmtDate(generatedAt))}${insights.span.firstAt > 1e12 ? ` · première interaction à ${esc(fmtDate(insights.span.firstAt))}` : ''}</p>
    </header>
    ${questionsSection}
    ${hotspotsSection}
    ${heatSection}
    ${leaderboardSection}
    <footer>presentaForge — rapport de session · les données ne quittent pas cet appareil</footer>
  </div>
</body>
</html>`;
}
