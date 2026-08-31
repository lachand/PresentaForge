/*
 * slides-special-live-runtime.js — runtime éléments live (poll, exit-ticket, postit-wall,
 * roulette, room-stats, leaderboard, decision-tree, code-compare, algo-stepper,
 * gallery-annotable, kanban-mini, rank-order, myth-reality, flashcards)
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

    /**
     * Monte les éléments live/interactifs dans le container.
     * @param {Element} container
     * @param {{ prefix?: 'sl'|'cel', SlidesRenderer, isAudienceReadOnly, emitAudienceElementState, subscribeAudienceElementState, disableInteractiveControls }} ctx
     */
    async function mountLiveElements(container, ctx) {
        const P = (ctx && ctx.prefix) || 'sl';
        const SlidesRenderer = ctx?.SlidesRenderer;
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitAudienceElementState = ctx?.emitAudienceElementState || (() => false);
        const subscribeAudienceElementState = ctx?.subscribeAudienceElementState || (() => () => {});
        const disableInteractiveControls = ctx?.disableInteractiveControls || (() => {});

        const parseDataJson = (raw, fallback) => {
            try { return JSON.parse(raw || 'null') ?? fallback; } catch (_) { return fallback; }
        };

        // ── Poll Live ──
        container.querySelectorAll(`.${P}-polllive-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pollType = el.dataset.pollType === 'thumbs' ? 'thumbs' : 'scale5';
            const prompt = String(el.dataset.prompt || '').trim();
            const startBtn = el.querySelector(`.${P}-polllive-start`);
            const endBtn = el.querySelector(`.${P}-polllive-end`);
            const resultsEl = el.querySelector(`.${P}-polllive-results`);
            if (!startBtn || !endBtn || !resultsEl) return;
            const publishPollState = (extraState = {}) => emitAudienceElementState(el, 'poll-live', Object.assign({
                pollType,
                prompt,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));

            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                resultsEl.innerHTML = '<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>';
                subscribeAudienceElementState(el, 'poll-live', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }

            const renderPoll = snap => {
                if (!snap || !snap.active) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-muted,#64748b);">Sondage inactif</div>`;
                    publishPollState({ active: false });
                    return;
                }
                const fallback = snap.type === 'thumbs' ? ['Pour', 'Contre'] : ['1', '2', '3', '4', '5'];
                const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : fallback;
                const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                const total = Number(snap.total || 0);
                const totalSelections = Number(snap.totalSelections || 0);
                const denom = snap.multi ? (totalSelections || 1) : (total || 1);
                resultsEl.innerHTML = labels.map((l, i) => {
                    const c = counts[i] || 0;
                    const pct = denom > 0 ? Math.round((c / denom) * 100) : 0;
                    return `<div style="display:grid;grid-template-columns:56px 1fr 70px;gap:8px;align-items:center;font-size:0.74rem;">
                        <span>${SlidesRenderer.esc(l)}</span>
                        <div style="height:14px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#a78bfa);"></div></div>
                        <span>${c} (${pct}%)</span>
                    </div>`;
                }).join('') + `<div style="margin-top:4px;font-size:0.72rem;color:var(--sl-muted,#64748b);">${
                    snap.multi ? `${total} répondant(s) · ${totalSelections} sélections` : `${total} réponse(s)`
                }</div>`;
                publishPollState({
                    active: true,
                    counts: counts.slice(0, 32),
                    options: labels.slice(0, 16),
                    total,
                    totalSelections,
                    multi: !!snap.multi,
                });
            };

            const bridge = global.OEIRoomBridge;
            if (!bridge?.subscribePoll) {
                renderPoll({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPollState({ active: false, roomActive: false });
                return;
            }
            const unsub = bridge.subscribePoll(snap => {
                if (snap?.active && snap.type === pollType) renderPoll(snap);
                else if (!snap?.active) renderPoll({ active: false });
            });
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startPoll?.(pollType, prompt);
                if (!ok) {
                    resultsEl.innerHTML = `<div style="font-size:0.75rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</div>`;
                    publishPollState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endPoll?.(); });
            renderPoll(bridge.getPollSnapshot?.() || { active: false });
        });

        // ── Exit Ticket ──
        container.querySelectorAll(`.${P}-exitticket-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Exit ticket';
            const promptsRaw = parseDataJson(el.dataset.prompts, []);
            const prompts = (Array.isArray(promptsRaw) ? promptsRaw : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 4);
            const safePrompts = prompts.length ? prompts : ['Ce que je retiens', 'Ce qui reste flou', 'Question finale'];
            const promptsEl = el.querySelector(`.${P}-exitticket-prompts`);
            const resultsEl = el.querySelector(`.${P}-exitticket-results`);
            const startBtn = el.querySelector(`.${P}-exitticket-start`);
            const endBtn = el.querySelector(`.${P}-exitticket-end`);
            if (!promptsEl || !resultsEl || !startBtn || !endBtn) return;
            const publishExitTicketState = (extraState = {}) => emitAudienceElementState(el, 'exit-ticket', Object.assign({
                promptsHtml: promptsEl.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPrompts = () => {
                promptsEl.innerHTML = safePrompts.map((prompt, idx) => (
                    `<div style="padding:7px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 84%,#000);font-size:0.74rem;"><strong>${idx + 1}.</strong> ${SlidesRenderer.esc(prompt)}</div>`
                )).join('');
            };
            renderPrompts();
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'exit-ticket', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.promptsHtml === 'string') promptsEl.innerHTML = sync.promptsHtml;
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            if (!bridge?.subscribeExitTicket) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                resultsEl.textContent = 'Mode présentateur requis';
                publishExitTicketState({ active: false, roomActive: false });
                return;
            }
            let liveTicketId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveTicketId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveTicketId = '';
                    renderPrompts();
                    publishExitTicketState({ active: false, ticketId: '' });
                    return;
                }
                const snapPrompts = Array.isArray(snap.prompts) ? snap.prompts : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapPrompts) === JSON.stringify(safePrompts);
                if (!liveTicketId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                        publishExitTicketState({ active: false, conflict: true });
                        return;
                    }
                    liveTicketId = String(snap.ticketId || '');
                }
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre exit ticket est actif</span>';
                    publishExitTicketState({ active: false, conflict: true });
                    return;
                }
                const responses = Array.isArray(snap.responses) ? snap.responses : [];
                const top = responses.slice(0, 3);
                resultsEl.innerHTML = `<div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-bottom:4px;">${Number(snap.responsesCount || 0)} réponse(s)</div>`
                    + (top.length
                        ? top.map(entry => {
                            const pseudo = SlidesRenderer.esc(entry?.pseudo || 'Anonyme');
                            const answers = (Array.isArray(entry?.answers) ? entry.answers : []).filter(Boolean).slice(0, 2);
                            const preview = answers.map(v => SlidesRenderer.esc(v)).join(' · ');
                            return `<div style="font-size:0.68rem;padding:5px 6px;border:1px solid var(--sl-border,#2d3347);border-radius:7px;margin-top:4px;"><strong>${pseudo}</strong>${preview ? `: ${preview}` : ''}</div>`;
                        }).join('')
                        : '<div style="font-size:0.68rem;color:var(--sl-muted,#64748b);">En attente de réponses…</div>');
                publishExitTicketState({
                    active: true,
                    ticketId: String(snap.ticketId || liveTicketId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeExitTicket(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startExitTicket?.({ title, prompts: safePrompts });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un exit ticket est déjà actif)</span>';
                    publishExitTicketState({ active: false, startError: true });
                    return;
                }
                liveTicketId = String(started);
                publishExitTicketState({ active: true, ticketId: liveTicketId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getExitTicketSnapshot?.();
                if (!snap?.active) return;
                if (liveTicketId && String(snap.ticketId || '') !== liveTicketId) return;
                bridge.endExitTicket?.();
            });
            renderLive(bridge.getExitTicketSnapshot?.() || { active: false, responses: [] });
        });

        // ── Postit Wall ──
        container.querySelectorAll(`.${P}-postitlive-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const prompt = String(el.dataset.prompt || '').trim();
            const grid = el.querySelector(`.${P}-postitlive-grid`);
            const startBtn = el.querySelector(`.${P}-postitlive-start`);
            const endBtn = el.querySelector(`.${P}-postitlive-end`);
            if (!grid || !startBtn || !endBtn) return;
            const publishPostitState = (extraState = {}) => emitAudienceElementState(el, 'postit-wall', Object.assign({
                gridHtml: grid.innerHTML,
                startLabel: String(startBtn.textContent || ''),
                endVisible: endBtn.style.display !== 'none',
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                startBtn.textContent = 'Piloté';
                endBtn.style.display = 'none';
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Piloté par le présentateur</div>`;
                subscribeAudienceElementState(el, 'postit-wall', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.gridHtml === 'string') grid.innerHTML = sync.gridHtml;
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            const renderNotes = snap => {
                if (!snap || !snap.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Mur inactif</div>`;
                    publishPostitState({ active: false });
                    return;
                }
                const palette = [
                    ['#fde68a', '#78350f'],
                    ['#bfdbfe', '#1e3a8a'],
                    ['#bbf7d0', '#14532d'],
                    ['#fecdd3', '#881337'],
                    ['#ddd6fe', '#4c1d95'],
                ];
                grid.innerHTML = (snap.words || []).slice(0, 18).map(([txt, count], i) => {
                    const [bg, fg] = palette[i % palette.length];
                    return `<div style="background:${bg};color:${fg};border-radius:8px;padding:6px;font-size:0.68rem;line-height:1.3;min-height:40px;position:relative;">
                        ${SlidesRenderer.esc(txt)}
                        <span style="position:absolute;right:6px;bottom:4px;font-size:0.62rem;opacity:0.75;">×${count}</span>
                    </div>`;
                }).join('');
                publishPostitState({
                    active: true,
                    wordsCount: Array.isArray(snap.words) ? snap.words.length : 0,
                });
            };
            if (!bridge?.subscribeWordCloud) {
                renderNotes({ active: false });
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.textContent = 'Salle inactive';
                publishPostitState({ active: false, roomActive: false });
                return;
            }
            bridge.subscribeWordCloud(snap => renderNotes(snap));
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const ok = bridge.startWordCloud?.(prompt);
                if (!ok) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un mur est déjà actif)</div>`;
                    publishPostitState({ active: false, startError: true });
                }
            });
            endBtn.addEventListener('click', e => { e.preventDefault(); bridge.endWordCloud?.(); });
            renderNotes(bridge.getWordCloudSnapshot?.() || { active: false, words: [] });
        });

        // ── Audience Roulette ──
        container.querySelectorAll(`.${P}-roulette-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const pickBtn = el.querySelector(`.${P}-roulette-pick`);
            const pickedEl = el.querySelector(`.${P}-roulette-picked`);
            if (!pickBtn || !pickedEl) return;
            const publishRouletteState = (extraState = {}) => emitAudienceElementState(el, 'roulette', Object.assign({
                pickedHtml: pickedEl.innerHTML,
                pickedText: String(pickedEl.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderPick = pseudo => {
                if (!pseudo) {
                    pickedEl.textContent = '';
                    publishRouletteState({ pseudo: '' });
                    return;
                }
                pickedEl.innerHTML = `<span class="sl-picked-inline-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg></span><span>${SlidesRenderer.esc(pseudo)}</span>`;
                publishRouletteState({ pseudo: String(pseudo || '') });
            };
            if (isAudienceReadOnly) {
                pickBtn.disabled = true;
                pickBtn.style.pointerEvents = 'none';
                pickBtn.style.display = 'none';
                subscribeAudienceElementState(el, 'roulette', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.pickedHtml === 'string') pickedEl.innerHTML = sync.pickedHtml;
                    else if (typeof sync.pickedText === 'string') pickedEl.textContent = sync.pickedText;
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            if (!bridge?.pickRandomStudent) {
                pickBtn.disabled = true;
                pickBtn.textContent = 'Salle inactive';
                publishRouletteState({ roomActive: false });
                return;
            }
            bridge.subscribeRoulette?.(payload => {
                renderPick(payload?.pseudo || '');
            });
            pickBtn.addEventListener('click', e => {
                e.preventDefault();
                const pick = bridge.pickRandomStudent();
                if (!pick?.pseudo) {
                    pickedEl.textContent = 'Aucun étudiant connecté';
                    return;
                }
                renderPick(pick.pseudo);
            });
        });

        // ── Room Stats ──
        container.querySelectorAll(`.${P}-roomstats-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const metrics = parseDataJson(el.dataset.metrics, ['students', 'hands', 'questions', 'feedback']);
            const grid = el.querySelector(`.${P}-roomstats-grid`);
            const foot = el.querySelector(`.${P}-roomstats-foot`);
            if (!grid) return;
            if (isAudienceReadOnly) {
                grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>`;
                if (foot) foot.textContent = 'Stats détaillées visibles côté présentateur';
                return;
            }
            const labels = {
                students: 'Connectés',
                hands: 'Mains levées',
                questions: 'Questions',
                feedback: 'Feedback 10 min',
                poll: 'Sondage actif',
                wordcloud: 'Nuage actif',
            };
            const bridge = global.OEIRoomBridge;
            const renderStats = snap => {
                if (!snap?.active) {
                    grid.innerHTML = `<div style="grid-column:1/-1;font-size:0.74rem;color:var(--sl-muted,#64748b);">Stats indisponibles (salle inactive)</div>`;
                    if (foot) foot.textContent = 'Ouvrez la salle dans le mode présentateur';
                    return;
                }
                const metricKeys = (Array.isArray(metrics) && metrics.length ? metrics : ['students', 'hands', 'questions', 'feedback']).slice(0, 6);
                const valueFor = key => {
                    if (key === 'students') return Number(snap.studentsCount || 0);
                    if (key === 'hands') return Number(snap.handsCount || 0);
                    if (key === 'questions') return Number(snap.questionsOpen || 0);
                    if (key === 'feedback') return Number(snap.feedback10m?.total || 0);
                    if (key === 'poll') return snap.pollActive ? 'Oui' : 'Non';
                    if (key === 'wordcloud') return snap.wordCloudActive ? 'Oui' : 'Non';
                    return '--';
                };
                grid.innerHTML = metricKeys.map(key => `
                    <div style="padding:8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 82%,#000);">
                        <div style="font-size:0.64rem;color:var(--sl-muted,#64748b);text-transform:uppercase;">${SlidesRenderer.esc(labels[key] || key)}</div>
                        <div style="font-size:1.05rem;color:var(--sl-heading,#f1f5f9);font-weight:700;margin-top:2px;">${SlidesRenderer.esc(valueFor(key))}</div>
                    </div>
                `).join('');
                if (foot) foot.textContent = `Transport: ${SlidesRenderer.esc(snap.transport || 'p2p')}`;
            };
            if (!bridge?.subscribeRoom) {
                renderStats({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderStats);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderStats(bridge.getRoomSnapshot?.() || { active: false });
        });

        // ── Leaderboard Live ──
        container.querySelectorAll(`.${P}-leaderboard-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const listEl = el.querySelector(`.${P}-leaderboard-list`);
            const foot = el.querySelector(`.${P}-leaderboard-foot`);
            const limit = Math.max(1, Math.min(20, Number(el.dataset.limit || 5)));
            if (!listEl) return;
            if (isAudienceReadOnly) {
                listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Widget réservé au présentateur</div>';
                if (foot) foot.textContent = 'Classement détaillé visible côté présentateur';
                return;
            }
            const bridge = global.OEIRoomBridge;
            const renderBoard = snap => {
                if (!snap?.active) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Leaderboard indisponible (salle inactive)</div>';
                    if (foot) foot.textContent = 'Ouvrez la salle pour activer le classement';
                    return;
                }
                const rows = Array.isArray(snap.students) ? snap.students : [];
                const sorted = rows.slice().sort((a, b) => {
                    const ds = Number(b.score || 0) - Number(a.score || 0);
                    if (ds !== 0) return ds;
                    return String(a.pseudo || '').localeCompare(String(b.pseudo || ''), 'fr', { sensitivity: 'base' });
                }).slice(0, limit);
                if (!sorted.length) {
                    listEl.innerHTML = '<div style="font-size:0.74rem;color:var(--sl-muted,#64748b);">Aucun étudiant connecté</div>';
                    if (foot) foot.textContent = 'En attente de participants';
                    return;
                }
                listEl.innerHTML = sorted.map((row, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="width:22px;font-family:var(--sl-font-mono,monospace);color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="flex:1;color:var(--sl-text,#e2e8f0);font-size:0.72rem;">${SlidesRenderer.esc(row.pseudo || 'Anonyme')}</span>
                        <span style="color:var(--sl-heading,#f1f5f9);font-weight:700;font-size:0.72rem;">${Number(row.score || 0).toLocaleString()}</span>
                    </div>
                `).join('');
                if (foot) foot.textContent = `${sorted.length} / ${Number(snap.studentsCount || 0)} affichés`;
            };
            if (!bridge?.subscribeRoom) {
                renderBoard({ active: false });
                return;
            }
            const unsub = bridge.subscribeRoom(renderBoard);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            renderBoard(bridge.getRoomSnapshot?.() || { active: false });
        });

        // ── Decision Tree ──
        container.querySelectorAll(`.${P}-decisiontree-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector(`.${P}-dt-branches`);
            const branches = parseDataJson(el.dataset.branches, []);
            if (!host) return;
            host.innerHTML = (Array.isArray(branches) ? branches : []).slice(0, 8).map(b => `
                <button style="pointer-events:auto;text-align:left;padding:7px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.74rem;cursor:pointer;">
                    <div style="font-weight:700;">${SlidesRenderer.esc(b?.label || 'Branche')}</div>
                    <div style="font-size:0.7rem;color:var(--sl-muted,#64748b);margin-top:2px;">${SlidesRenderer.esc(b?.outcome || '')}</div>
                </button>`).join('');
            if (isAudienceReadOnly) disableInteractiveControls(host);
        });

        // ── Code Compare ──
        container.querySelectorAll(`.${P}-codecompare-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const host = el.querySelector(`.${P}-codecompare-view`);
            const slider = el.querySelector(`.${P}-codecompare-range`);
            const before = String(el.dataset.before || '');
            const after = String(el.dataset.after || '');
            if (!host || !slider) return;
            host.innerHTML = `<pre style="position:absolute;inset:0;margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#cbd5e1;background:#0b1020;">${before}</pre>
                <div class="${P}-codecompare-after-wrap" style="position:absolute;inset:0;overflow:hidden;width:50%;border-right:2px solid rgba(167,139,250,0.9);">
                    <pre style="margin:0;padding:10px;overflow:auto;font-size:0.72rem;font-family:var(--sl-font-mono,monospace);color:#e2e8f0;background:#0f172a;">${after}</pre>
                </div>`;
            const afterWrap = host.querySelector(`.${P}-codecompare-after-wrap`);
            const publishCodeCompareState = (extraState = {}) => emitAudienceElementState(el, 'code-compare', Object.assign({
                value: Number(slider.value) || 50,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                slider.disabled = true;
                slider.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'code-compare', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextValue = Number(sync.value);
                    if (!Number.isFinite(nextValue)) return;
                    const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
                    slider.value = String(clamped);
                    if (afterWrap) afterWrap.style.width = `${clamped}%`;
                });
                return;
            }
            slider.addEventListener('input', () => {
                if (afterWrap) afterWrap.style.width = `${slider.value}%`;
                publishCodeCompareState();
            });
            publishCodeCompareState();
        });

        // ── Algo Stepper ──
        container.querySelectorAll(`.${P}-algostepper-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const steps = parseDataJson(el.dataset.steps, []);
            const ttl = el.querySelector(`.${P}-algostepper-step-title`);
            const det = el.querySelector(`.${P}-algostepper-step-detail`);
            const code = el.querySelector(`.${P}-algostepper-code`);
            const prev = el.querySelector(`.${P}-algostepper-prev`);
            const next = el.querySelector(`.${P}-algostepper-next`);
            if (!ttl || !det || !code || !prev || !next) return;
            let idx = 0;
            const render = () => {
                const step = steps[idx] || {};
                ttl.textContent = step.title || `Étape ${idx + 1}`;
                det.textContent = step.detail || '';
                code.textContent = step.code || '';
                prev.disabled = idx <= 0;
                next.disabled = idx >= steps.length - 1;
            };
            const publishAlgoStepperState = (extraState = {}) => emitAudienceElementState(el, 'algo-stepper', Object.assign({
                index: idx,
                total: Array.isArray(steps) ? steps.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'algo-stepper', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.index);
                    if (!Number.isFinite(nextIdx)) return;
                    const max = Math.max(0, steps.length - 1);
                    idx = Math.max(0, Math.min(max, Math.trunc(nextIdx)));
                    render();
                    prev.disabled = true;
                    next.disabled = true;
                    prev.style.pointerEvents = 'none';
                    next.style.pointerEvents = 'none';
                });
                render();
                return;
            }
            prev.addEventListener('click', e => {
                e.preventDefault();
                if (idx > 0) { idx--; render(); publishAlgoStepperState(); }
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                if (idx < steps.length - 1) { idx++; render(); publishAlgoStepperState(); }
            });
            render();
            publishAlgoStepperState();
        });

        // ── Gallery Annotable ──
        container.querySelectorAll(`.${P}-galleryanno-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const src = String(el.dataset.src || '');
            const alt = String(el.dataset.alt || 'Image annotée');
            const notes = parseDataJson(el.dataset.notes, []);
            const stage = el.querySelector(`.${P}-galleryanno-stage`);
            const caption = el.querySelector(`.${P}-galleryanno-caption`);
            if (!stage || !caption) return;
            stage.innerHTML = src ? `<img src="${src}" alt="${SlidesRenderer.esc(alt)}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--sl-muted,#64748b);font-size:0.74rem;">Image non définie</div>`;
            let activeIndex = 0;
            const publishGalleryState = (extraState = {}) => emitAudienceElementState(el, 'gallery-annotable', Object.assign({
                activeIndex,
                caption: String(caption.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            (Array.isArray(notes) ? notes : []).slice(0, 20).forEach((n, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.style.cssText = `position:absolute;left:${Math.max(5, Math.min(95, Number(n.x)||0))}%;top:${Math.max(5, Math.min(95, Number(n.y)||0))}%;transform:translate(-50%,-50%);width:19px;height:19px;border-radius:50%;border:none;background:#f43f5e;color:#fff;font-size:0.62rem;pointer-events:auto;cursor:pointer;`;
                b.textContent = String(i + 1);
                b.addEventListener('click', () => {
                    activeIndex = i;
                    caption.textContent = n.text || '';
                    publishGalleryState();
                });
                stage.appendChild(b);
            });
            caption.textContent = (notes[0]?.text) || '';
            if (isAudienceReadOnly) {
                disableInteractiveControls(stage);
                subscribeAudienceElementState(el, 'gallery-annotable', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.caption === 'string') caption.textContent = sync.caption;
                });
                return;
            }
            publishGalleryState();
        });

        // ── Kanban Mini ──
        container.querySelectorAll(`.${P}-kanban-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cols = parseDataJson(el.dataset.columns, []);
            const host = el.querySelector(`.${P}-kanban-cols`);
            if (!host) return;
            host.innerHTML = (Array.isArray(cols) ? cols : []).slice(0, 4).map(col => `<div class="${P}-kb-col" style="flex:1;min-width:0;border:1px solid var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;">
                <div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;text-transform:uppercase;">${SlidesRenderer.esc(col?.name || '')}</div>
                ${(Array.isArray(col?.cards) ? col.cards : []).slice(0, 6).map((c, i) => `<div class="${P}-kb-card" draggable="true" data-card="${i}" style="pointer-events:auto;padding:5px;border:1px solid var(--sl-border,#2d3347);border-radius:6px;font-size:0.68rem;cursor:grab;background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);">${SlidesRenderer.esc(c)}</div>`).join('')}
            </div>`).join('');
            const publishKanbanState = (extraState = {}) => emitAudienceElementState(el, 'kanban-mini', Object.assign({
                hostHtml: host.innerHTML,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                disableInteractiveControls(host);
                host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                subscribeAudienceElementState(el, 'kanban-mini', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    host.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            let dragged = null;
            host.querySelectorAll(`.${P}-kb-card`).forEach(card => {
                card.addEventListener('dragstart', () => { dragged = card; });
            });
            host.querySelectorAll(`.${P}-kb-col`).forEach(col => {
                col.addEventListener('dragover', e => e.preventDefault());
                col.addEventListener('drop', e => {
                    e.preventDefault();
                    if (dragged) {
                        col.appendChild(dragged);
                        publishKanbanState();
                    }
                });
            });
            publishKanbanState();
        });

        // ── Rank Order ──
        container.querySelectorAll(`.${P}-rankorder-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const title = String(el.dataset.title || '').trim() || 'Classement';
            const initialItems = parseDataJson(el.dataset.items, []);
            const host = el.querySelector(`.${P}-rankorder-list`);
            const resultsEl = el.querySelector(`.${P}-rankorder-results`);
            const startBtn = el.querySelector(`.${P}-rankorder-start`);
            const endBtn = el.querySelector(`.${P}-rankorder-end`);
            if (!host || !resultsEl || !startBtn || !endBtn) return;
            const items = (Array.isArray(initialItems) ? initialItems : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 8);
            const safeItems = items.length >= 2 ? items : ['Option A', 'Option B', 'Option C'];
            const publishRankOrderState = (extraState = {}) => emitAudienceElementState(el, 'rank-order', Object.assign({
                listHtml: host.innerHTML,
                resultsHtml: resultsEl.innerHTML,
                startVisible: startBtn.style.display !== 'none',
                endVisible: endBtn.style.display !== 'none',
                startLabel: String(startBtn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const renderEditable = () => {
                host.innerHTML = safeItems.map((item, i) => `
                    <div class="sl-rankorder-row" data-idx="${i}" style="display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        <span style="display:flex;gap:4px;">
                            <button type="button" class="${P}-rank-up" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↑</button>
                            <button type="button" class="${P}-rank-down" data-idx="${i}" style="pointer-events:auto;padding:2px 6px;border-radius:6px;border:1px solid var(--sl-border,#2d3347);background:transparent;color:var(--sl-text,#e2e8f0);font-size:0.68rem;cursor:pointer;">↓</button>
                        </span>
                    </div>
                `).join('');
                host.querySelectorAll(`.${P}-rank-up`).forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i <= 0) return;
                        [safeItems[i - 1], safeItems[i]] = [safeItems[i], safeItems[i - 1]];
                        renderEditable();
                    });
                });
                host.querySelectorAll(`.${P}-rank-down`).forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = Number(btn.dataset.idx);
                        if (i >= safeItems.length - 1) return;
                        [safeItems[i], safeItems[i + 1]] = [safeItems[i + 1], safeItems[i]];
                        renderEditable();
                    });
                });
                publishRankOrderState({
                    mode: 'local',
                    active: false,
                    order: safeItems.slice(0, 16),
                });
            };
            const renderRankRows = rows => {
                const src = Array.isArray(rows) ? rows : [];
                if (!src.length) {
                    host.innerHTML = safeItems.map((item, i) => `
                        <div style="display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                            <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                            <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);">${SlidesRenderer.esc(item)}</span>
                        </div>
                    `).join('');
                    return;
                }
                host.innerHTML = src.map((row, i) => `
                    <div style="display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;">
                        <span style="font-family:var(--sl-font-mono,monospace);font-size:0.72rem;color:var(--sl-muted,#64748b);">${i + 1}.</span>
                        <span style="font-size:0.76rem;color:var(--sl-text,#e2e8f0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${SlidesRenderer.esc(row?.label || '')}</span>
                        <span style="font-size:0.68rem;color:var(--sl-muted,#64748b);">${Number(row?.score || 0)} pts</span>
                    </div>
                `).join('');
            };
            if (isAudienceReadOnly) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                startBtn.disabled = true;
                endBtn.disabled = true;
                startBtn.style.pointerEvents = 'none';
                endBtn.style.pointerEvents = 'none';
                disableInteractiveControls(host);
                resultsEl.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'rank-order', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.listHtml === 'string') host.innerHTML = sync.listHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultsHtml === 'string') resultsEl.innerHTML = sync.resultsHtml;
                    if (typeof sync.startVisible === 'boolean') startBtn.style.display = sync.startVisible ? '' : 'none';
                    if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                    if (typeof sync.startLabel === 'string' && sync.startLabel.trim()) startBtn.textContent = sync.startLabel;
                    startBtn.disabled = true;
                    endBtn.disabled = true;
                    startBtn.style.pointerEvents = 'none';
                    endBtn.style.pointerEvents = 'none';
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            if (!bridge?.subscribeRankOrder) {
                startBtn.style.display = 'none';
                endBtn.style.display = 'none';
                resultsEl.textContent = 'Réorganisez localement la liste';
                renderEditable();
                publishRankOrderState({ mode: 'local', active: false });
                return;
            }
            let liveRankId = '';
            const renderLive = snap => {
                if (!snap?.active) {
                    resultsEl.innerHTML = liveRankId
                        ? '<span style="color:var(--sl-success,#22c55e);">Collecte terminée</span>'
                        : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                    liveRankId = '';
                    renderRankRows([]);
                    publishRankOrderState({ mode: 'live', active: false, rankId: '' });
                    return;
                }
                const snapItems = Array.isArray(snap.items) ? snap.items : [];
                const isLikelyOwn = String(snap.title || '').trim() === title
                    && JSON.stringify(snapItems) === JSON.stringify(safeItems);
                if (!liveRankId) {
                    if (!isLikelyOwn) {
                        resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                        publishRankOrderState({ mode: 'live', active: false, conflict: true });
                        return;
                    }
                    liveRankId = String(snap.rankId || '');
                }
                if (liveRankId && String(snap.rankId || '') !== liveRankId) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre classement est actif</span>';
                    publishRankOrderState({ mode: 'live', active: false, conflict: true });
                    return;
                }
                renderRankRows(snap.rows);
                resultsEl.innerHTML = `<span style="color:var(--sl-muted,#64748b);">${Number(snap.responsesCount || 0)} participant(s)</span>`;
                publishRankOrderState({
                    mode: 'live',
                    active: true,
                    rankId: String(snap.rankId || liveRankId || ''),
                    responsesCount: Number(snap.responsesCount || 0),
                });
            };
            const unsub = bridge.subscribeRankOrder(renderLive);
            el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
            startBtn.addEventListener('click', e => {
                e.preventDefault();
                const started = bridge.startRankOrder?.({ title, items: safeItems });
                if (!started) {
                    resultsEl.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un classement est déjà actif)</span>';
                    publishRankOrderState({ mode: 'live', active: false, startError: true });
                    return;
                }
                liveRankId = String(started);
                publishRankOrderState({ mode: 'live', active: true, rankId: liveRankId, starting: true });
            });
            endBtn.addEventListener('click', e => {
                e.preventDefault();
                const snap = bridge.getRankOrderSnapshot?.();
                if (!snap?.active) return;
                if (liveRankId && String(snap.rankId || '') !== liveRankId) return;
                bridge.endRankOrder?.();
            });
            renderLive(bridge.getRankOrderSnapshot?.() || { active: false, rows: [] });
        });

        // ── Myth Reality ──
        container.querySelectorAll(`.${P}-myth-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const card = el.querySelector(`.${P}-flip-card`);
            if (!card) return;
            let flipped = false;
            const applyFlip = nextState => {
                flipped = !!nextState;
                card.classList.toggle('is-flipped', flipped);
            };
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'myth-reality', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    applyFlip(sync.flipped === true);
                });
                applyFlip(false);
                return;
            }
            card.addEventListener('click', () => {
                applyFlip(!flipped);
                emitAudienceElementState(el, 'myth-reality', { flipped });
            });
            emitAudienceElementState(el, 'myth-reality', { flipped: false });
        });

        // ── Flashcards Auto ──
        container.querySelectorAll(`.${P}-flashcards-pending`).forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const cards = parseDataJson(el.dataset.cards, []);
            const card = el.querySelector(`.${P}-flashcards-card`);
            const front = el.querySelector(`.${P}-flashcards-front`);
            const back = el.querySelector(`.${P}-flashcards-back`);
            const prev = el.querySelector(`.${P}-flashcards-prev`);
            const next = el.querySelector(`.${P}-flashcards-next`);
            if (!card || !front || !back || !prev || !next || !cards.length) return;
            let idx = 0;
            let flipped = false;
            const render = () => {
                const c = cards[idx] || {};
                front.innerHTML = `<div><div class="sl-flip-face-label">Question</div>${SlidesRenderer.esc(c.front || '')}</div>`;
                back.innerHTML = `<div><div class="sl-flip-face-label">Réponse</div>${SlidesRenderer.esc(c.back || '')}</div>`;
                card.classList.toggle('is-flipped', !!flipped);
            };
            const publishFlashcardsState = (extraState = {}) => emitAudienceElementState(el, 'flashcards', Object.assign({
                idx,
                flipped,
                total: Array.isArray(cards) ? cards.length : 0,
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                card.style.pointerEvents = 'none';
                prev.disabled = true;
                next.disabled = true;
                prev.style.pointerEvents = 'none';
                next.style.pointerEvents = 'none';
                subscribeAudienceElementState(el, 'flashcards', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const nextIdx = Number(sync.idx);
                    if (Number.isFinite(nextIdx)) {
                        idx = ((Math.trunc(nextIdx) % cards.length) + cards.length) % cards.length;
                    }
                    flipped = !!sync.flipped;
                    render();
                });
                render();
                return;
            }
            card.addEventListener('click', () => {
                flipped = !flipped;
                render();
                publishFlashcardsState();
            });
            prev.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx - 1 + cards.length) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            next.addEventListener('click', e => {
                e.preventDefault();
                idx = (idx + 1) % cards.length;
                flipped = false;
                render();
                publishFlashcardsState();
            });
            render();
            publishFlashcardsState();
        });
    }

    global.OEISlidesSpecialLiveRuntime = Object.freeze({ mountLiveElements });
})(typeof window !== 'undefined' ? window : globalThis);
