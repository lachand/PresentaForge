/*
 * slides-special-quiz-runtime.js — runtime quiz-live P2P, cloze, drag-drop, mcq-multi, mcq-single
 * Sous-runtime extrait de slides-special-runtime.js (lot 16A).
 */
(function(global){
    'use strict';

    /**
     * Monte les éléments quiz interactifs dans le container.
     * @param {Element} container
     * @param {{ SlidesRenderer, isAudienceReadOnly, emitAudienceElementState, subscribeAudienceElementState, disableInteractiveControls }} ctx
     */
    async function mountQuizElements(container, ctx) {
        const SlidesRenderer = ctx?.SlidesRenderer;
        const isAudienceReadOnly = !!ctx?.isAudienceReadOnly;
        const emitAudienceElementState = ctx?.emitAudienceElementState || (() => false);
        const subscribeAudienceElementState = ctx?.subscribeAudienceElementState || (() => () => {});
        const disableInteractiveControls = ctx?.disableInteractiveControls || (() => {});

        const parseDataJson = (raw, fallback) => {
            try { return JSON.parse(raw || 'null') ?? fallback; } catch (_) { return fallback; }
        };

        // ── Quiz Live (interactive P2P quiz with PeerJS) ──
        container.querySelectorAll('.sl-quizlive-pending').forEach(el => {
            if (el.dataset.quizliveBound) return;
            el.dataset.quizliveBound = '1';
            const roomId = el.dataset.room || 'ql-' + Math.random().toString(36).slice(2, 9);
            const correctAnswer = parseInt(el.dataset.answer) || 0;
            const duration = parseInt(el.dataset.duration) || 30;
            const btnStart = el.querySelector('.sl-quizlive-start');
            const timerEl = el.querySelector('.sl-quizlive-timer');
            const statusEl = el.querySelector('.sl-quizlive-status');
            const resultsEl = el.querySelector('.sl-quizlive-results');
            const qrEl = el.querySelector('.sl-quizlive-qr');
            const optionsEls = el.querySelectorAll('.sl-quizlive-option');
            if (!btnStart) return;

            let peer = null, connections = [], responses = {}, timerInterval = null, remaining = duration, quizActive = false;
            const optLabels = Array.from(optionsEls).map(o => o.textContent.trim().slice(1).trim());
            const nOpts = optionsEls.length;
            const questionText = el.querySelector('.sl-quizlive-question')?.textContent || '';
            const computeCounts = () => {
                const counts = Array(nOpts).fill(0);
                const total = Object.keys(responses).length;
                Object.values(responses).forEach(r => { if (r >= 0 && r < nOpts) counts[r]++; });
                return { counts, total };
            };
            const publishQuizState = (extraState = {}) => {
                const mergedState = Object.assign({
                    active: !!quizActive,
                    ended: false,
                    question: questionText,
                    options: optLabels.slice(),
                    correctAnswer: null,
                    duration,
                    remaining: Math.max(0, Number(remaining) || 0),
                    counts: computeCounts().counts,
                    totalResponses: computeCounts().total,
                    statusText: String(statusEl?.textContent || ''),
                }, (extraState && typeof extraState === 'object') ? extraState : {});
                if (mergedState.ended === true) mergedState.correctAnswer = correctAnswer;
                emitAudienceElementState(el, 'quiz-live', mergedState);
            };

            if (isAudienceReadOnly) {
                btnStart.disabled = true;
                btnStart.textContent = 'Piloté';
                btnStart.style.pointerEvents = 'none';
                optionsEls.forEach(opt => {
                    opt.style.pointerEvents = 'none';
                    opt.style.cursor = 'default';
                });
                if (qrEl) qrEl.style.display = 'none';
                if (statusEl) statusEl.textContent = 'Piloté par le présentateur';
                const renderAudienceQuiz = state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    const labels = Array.isArray(sync.options) && sync.options.length ? sync.options : optLabels;
                    const counts = Array.isArray(sync.counts) ? sync.counts.map(v => Number(v) || 0) : labels.map(() => 0);
                    const total = Math.max(0, Number(sync.totalResponses) || counts.reduce((a, b) => a + b, 0));
                    const currentRemaining = Math.max(0, Number(sync.remaining) || 0);
                    const active = sync.active === true;
                    const revealCorrect = sync.ended === true;
                    const resolvedCorrect = revealCorrect && Number.isFinite(Number(sync.correctAnswer))
                        ? Number(sync.correctAnswer)
                        : null;
                    if (timerEl) timerEl.textContent = `${currentRemaining}s`;
                    if (statusEl) {
                        const toTrimmed = (value, maxLen = 120) => {
                            if (typeof value !== 'string') return '';
                            const out = value.trim();
                            return maxLen > 0 ? out.slice(0, maxLen) : out;
                        };
                        statusEl.textContent = toTrimmed(String(sync.statusText || ''), 220)
                            || (active ? `${total} réponse(s) — ${currentRemaining}s restantes` : 'Piloté par le présentateur');
                    }
                    if (!resultsEl) return;
                    if (active && sync.ended !== true) {
                        resultsEl.style.display = '';
                        resultsEl.innerHTML = `<div style="font-size:0.85rem;color:var(--sl-muted,#94a3b8);text-align:center;padding:12px 0;">⏳ Collecte des réponses…</div>`;
                        return;
                    }
                    const shouldShow = total > 0 || sync.ended === true;
                    resultsEl.style.display = shouldShow ? '' : 'none';
                    if (!shouldShow) return;
                    let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                    html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                    counts.forEach((count, i) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isCorrect = revealCorrect && i === resolvedCorrect;
                        const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                        html += `<div style="display:flex;align-items:center;gap:8px;">
                            <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                            <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                                <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${count})</span>
                            </div>
                        </div>`;
                    });
                    html += `</div>`;
                    resultsEl.innerHTML = html;
                };
                subscribeAudienceElementState(el, 'quiz-live', renderAudienceQuiz);
                return;
            }

            const updateResults = ({ ended = false } = {}) => {
                const { counts, total } = computeCounts();
                let html = `<div style="font-size:0.75rem;color:var(--sl-muted);margin-bottom:8px;">${total} réponse${total > 1 ? 's' : ''}</div>`;
                html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
                counts.forEach((c, i) => {
                    const pct = total > 0 ? Math.round(c / total * 100) : 0;
                    const isCorrect = ended === true && i === correctAnswer;
                    const barColor = isCorrect ? '#34d399' : 'var(--sl-primary,#818cf8)';
                    html += `<div style="display:flex;align-items:center;gap:8px;">
                        <span style="min-width:24px;font-weight:700;font-size:0.85rem;color:${isCorrect ? '#34d399' : 'var(--sl-text,#cbd5e1)'};">${String.fromCharCode(65 + i)}</span>
                        <div style="flex:1;height:28px;background:color-mix(in srgb,var(--sl-surface,#1e2130) 80%,#000);border-radius:6px;overflow:hidden;position:relative;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s ease;opacity:0.8;"></div>
                            <span style="position:absolute;inset:0;display:flex;align-items:center;padding-left:8px;font-size:0.75rem;color:#fff;font-weight:600;">${pct}% (${c})</span>
                        </div>
                    </div>`;
                });
                html += `</div>`;
                resultsEl.innerHTML = html;
                publishQuizState({ ended: ended === true });
            };

            const startQuiz = async () => {
                if (quizActive) return;

                // ── If a global student room is active, use it ──────────────
                if (global._studentRoom?.active && global._studentRoomBroadcast) {
                    quizActive = true;
                    btnStart.disabled = true;
                    btnStart.textContent = '⏳';
                    statusEl.textContent = 'Diffusion via la salle étudiants…';
                    responses = {};

                    global._activeQuizHandler = (peerId, value) => {
                        if (!quizActive) return;
                        responses[peerId] = value;
                        global._lastQuizResponses = responses;
                        global._lastQuizOptions = optLabels;
                        updateResults({ ended: false });
                        const nStudents = Object.keys(global._studentRoom.students).length;
                        statusEl.textContent = `${Object.keys(responses).length}/${nStudents} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                    };

                    global._studentRoomBroadcast({
                        type: 'quiz:question',
                        quizId: roomId,
                        question: questionText,
                        options: optLabels,
                        duration: duration,
                        startedAt: Date.now(),
                    });

                    resultsEl.style.display = '';
                    updateResults({ ended: false });
                    remaining = duration;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                    btnStart.textContent = '⏹ Arrêter';
                    btnStart.disabled = false;
                    publishQuizState();

                    timerInterval = setInterval(() => {
                        remaining--;
                        timerEl.textContent = remaining + 's';
                        statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                        publishQuizState();
                        if (remaining <= 0) endQuiz();
                    }, 1000);

                    btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
                    return;
                }
                // ── Fallback: dedicated peer (original behaviour) ───────────

                quizActive = true;
                btnStart.disabled = true;
                btnStart.textContent = '⏳';
                statusEl.textContent = 'Connexion P2P en cours…';

                // Load PeerJS
                if (!global._slPeerLoaded) {
                    global._slPeerLoaded = true;
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = '../vendor/peerjs/1.5.5/peerjs.min.js';
                        s.onload = resolve; s.onerror = reject;
                        document.head.appendChild(s);
                    });
                }

                try {
                    peer = new Peer(roomId, { debug: 0 });
                    await new Promise((resolve, reject) => {
                        peer.on('open', resolve);
                        peer.on('error', (e) => {
                            // If ID taken, try with suffix
                            if (e.type === 'unavailable-id') {
                                const altId = roomId + '-' + Date.now().toString(36).slice(-4);
                                peer = new Peer(altId, { debug: 0 });
                                peer.on('open', resolve);
                                peer.on('error', reject);
                            } else reject(e);
                        });
                        setTimeout(() => reject(new Error('Timeout PeerJS')), 10000);
                    });
                } catch(e) {
                    statusEl.textContent = '❌ Erreur: ' + (e.message || e);
                    btnStart.textContent = 'Réessayer';
                    btnStart.disabled = false;
                    quizActive = false;
                    publishQuizState({ active: false, ended: true });
                    return;
                }

                const quizUrl = global.location.origin + global.location.pathname.replace(/[^/]*$/, '') + 'quiz-student.html?room=' + encodeURIComponent(peer.id);

                // Show QR code
                qrEl.style.display = '';
                qrEl.innerHTML = `<img src="${SlidesRenderer._buildQrSrc(quizUrl, 200)}" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"><div class="sl-qr-resize-handle">⇲</div>`;
                SlidesRenderer._makeQrInteractive(qrEl);

                // Handle connections
                peer.on('connection', (conn) => {
                    connections.push(conn);
                    conn.on('data', (data) => {
                        if (data && data.type === 'answer' && quizActive) {
                            responses[conn.peer] = data.value;
                            updateResults({ ended: false });
                            statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                            publishQuizState();
                        }
                    });
                    conn.on('open', () => {
                        conn.send({ type: 'quiz', question: el.querySelector('.sl-quizlive-question')?.textContent || '', options: optLabels, duration: remaining, roomId: peer.id });
                    });
                });

                // Show results area
                resultsEl.style.display = '';
                updateResults({ ended: false });

                // Start timer
                remaining = duration;
                timerEl.textContent = remaining + 's';
                statusEl.textContent = `0 réponse(s) — ${remaining}s restantes`;
                btnStart.textContent = '⏹ Arrêter';
                btnStart.disabled = false;
                publishQuizState();

                timerInterval = setInterval(() => {
                    remaining--;
                    timerEl.textContent = remaining + 's';
                    statusEl.textContent = `${Object.keys(responses).length} réponse(s) — ${remaining}s restantes`;
                    publishQuizState();
                    if (remaining <= 0) {
                        endQuiz();
                    }
                }, 1000);

                // Toggle stop
                btnStart.onclick = (e) => { e.stopPropagation(); e.preventDefault(); endQuiz(); };
            };

            const endQuiz = () => {
                quizActive = false;
                clearInterval(timerInterval);
                // Notify students via room (if active) or direct connections
                if (global._studentRoom?.active && global._studentRoomBroadcast) {
                    global._studentRoomBroadcast({ type: 'quiz:end', quizId: roomId, correctAnswer });
                    global._activeQuizHandler = null;
                    global._lastQuizResponses = null;
                    global._lastQuizOptions = null;
                } else {
                    connections.forEach(c => { try { c.send({ type: 'end' }); } catch(e) {} });
                }
                // Highlight correct answer
                optionsEls.forEach((o, i) => {
                    if (i === correctAnswer) {
                        o.style.borderColor = '#34d399';
                        o.style.background = 'color-mix(in srgb, #34d399 15%, var(--sl-slide-bg,#141620))';
                    }
                });
                statusEl.textContent = `Terminé — ${Object.keys(responses).length} réponse(s)`;
                btnStart.textContent = 'Relancer';
                btnStart.disabled = false;
                publishQuizState({ active: false, ended: true });
                btnStart.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    responses = {};
                    connections = [];
                    global._activeQuizHandler = null;
                    if (peer) { peer.destroy(); peer = null; }
                    optionsEls.forEach(o => { o.style.borderColor = ''; o.style.background = ''; });
                    resultsEl.style.display = 'none';
                    qrEl.style.display = 'none';
                    btnStart.textContent = 'Lancer';
                    btnStart.onclick = (e2) => { e2.stopPropagation(); e2.preventDefault(); startQuiz(); };
                    statusEl.textContent = 'Cliquez sur « Lancer » pour démarrer le quiz';
                    publishQuizState({ active: false, ended: false, counts: [], totalResponses: 0 });
                };
                updateResults({ ended: true });
                // Close peer after a delay
                setTimeout(() => { if (peer && !quizActive) { peer.destroy(); peer = null; } }, 5000);
            };

            publishQuizState({ active: false, ended: false });
            btnStart.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); startQuiz(); });
        });

        // ── Cloze ──
        container.querySelectorAll('.sl-cloze-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const sentence = String(el.dataset.sentence || '');
            const safeSentence = SlidesRenderer.esc(sentence);
            const blanks = parseDataJson(el.dataset.blanks, []);
            const body = el.querySelector('.sl-cloze-body');
            const btn = el.querySelector('.sl-cloze-toggle');
            if (!body || !btn) return;
            let shown = false;
            const publishClozeState = (extraState = {}) => emitAudienceElementState(el, 'cloze', Object.assign({
                shown: !!shown,
                buttonLabel: String(btn.textContent || ''),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            const render = () => {
                let i = 0;
                body.innerHTML = safeSentence.replace(/____/g, () => {
                    const ans = SlidesRenderer.esc(blanks[i++] || '...');
                    return shown
                        ? `<span style="padding:0 6px;border-bottom:2px solid #22c55e;color:#22c55e;font-weight:700;">${ans}</span>`
                        : `<span style="padding:0 12px;border-bottom:2px dashed var(--sl-primary,#818cf8);color:transparent;">___</span>`;
                });
                btn.textContent = shown ? 'Masquer les réponses' : 'Afficher les réponses';
            };
            if (isAudienceReadOnly) {
                btn.disabled = true;
                btn.style.pointerEvents = 'none';
                btn.textContent = 'Piloté';
                subscribeAudienceElementState(el, 'cloze', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    shown = sync.shown === true;
                    render();
                    btn.disabled = true;
                    btn.style.pointerEvents = 'none';
                    if (typeof sync.buttonLabel === 'string' && sync.buttonLabel.trim()) btn.textContent = sync.buttonLabel;
                });
                render();
                return;
            }
            btn.addEventListener('click', e => {
                e.preventDefault();
                shown = !shown;
                render();
                publishClozeState();
            });
            render();
            publishClozeState();
        });

        // ── Drag-drop ──
        container.querySelectorAll('.sl-dnd-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const items = parseDataJson(el.dataset.items, []);
            const targets = parseDataJson(el.dataset.targets, []);
            const itemsHost = el.querySelector('.sl-dnd-items');
            const targetsHost = el.querySelector('.sl-dnd-targets');
            if (!itemsHost || !targetsHost) return;
            const cards = Array.isArray(items) ? items : [];
            const cols = (Array.isArray(targets) && targets.length ? targets : ['Zone A', 'Zone B']).slice(0, 4);

            itemsHost.innerHTML = cards.map((label, i) => `<button class="sl-dnd-item" data-i="${i}" style="pointer-events:auto;padding:6px 10px;border-radius:8px;border:1px solid var(--sl-border,#2d3347);background:color-mix(in srgb,var(--sl-slide-bg,#1a1d27) 80%,#000);color:var(--sl-text,#e2e8f0);font-size:0.75rem;cursor:grab;" draggable="true">${SlidesRenderer.esc(label)}</button>`).join('');
            targetsHost.innerHTML = cols.map((c, i) => `<div class="sl-dnd-target" data-t="${i}" style="flex:1;min-width:0;border:1px dashed var(--sl-border,#2d3347);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:6px;"><div style="font-size:0.68rem;color:var(--sl-muted,#64748b);font-weight:700;">${SlidesRenderer.esc(c)}</div></div>`).join('');
            const syncDndState = () => emitAudienceElementState(el, 'drag-drop', {
                itemsHtml: itemsHost.innerHTML,
                targetsHtml: targetsHost.innerHTML,
            });
            if (isAudienceReadOnly) {
                itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                const title = el.querySelector('div');
                if (title && title.textContent) title.textContent = `${title.textContent} (piloté par le présentateur)`;
                subscribeAudienceElementState(el, 'drag-drop', state => {
                    if (!state || typeof state !== 'object') return;
                    if (typeof state.itemsHtml === 'string') itemsHost.innerHTML = state.itemsHtml;
                    if (typeof state.targetsHtml === 'string') targetsHost.innerHTML = state.targetsHtml;
                    itemsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                    targetsHost.querySelectorAll('[draggable]').forEach(node => node.setAttribute('draggable', 'false'));
                });
                return;
            }
            syncDndState();
            let dragHtml = '';
            itemsHost.querySelectorAll('.sl-dnd-item').forEach(btn => {
                btn.addEventListener('dragstart', e => {
                    dragHtml = btn.outerHTML;
                    e.dataTransfer?.setData('text/plain', btn.dataset.i || '');
                });
            });
            targetsHost.querySelectorAll('.sl-dnd-target').forEach(zone => {
                zone.addEventListener('dragover', e => e.preventDefault());
                zone.addEventListener('drop', e => {
                    e.preventDefault();
                    if (!dragHtml) return;
                    const marker = document.createElement('div');
                    marker.innerHTML = dragHtml;
                    const card = marker.firstElementChild;
                    if (!card) return;
                    card.setAttribute('draggable', 'false');
                    card.style.cursor = 'default';
                    zone.appendChild(card);
                    syncDndState();
                });
            });
        });

        // ── MCQ Multi ──
        container.querySelectorAll('.sl-mcqmulti-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answers = new Set(parseDataJson(el.dataset.answers, []).map(v => Number(v)));
            const host = el.querySelector('.sl-mcqmulti-options');
            const checkBtn = el.querySelector('.sl-mcqmulti-check');
            const endBtn = el.querySelector('.sl-mcqmulti-end');
            const result = el.querySelector('.sl-mcqmulti-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqMultiState = (extraState = {}) => emitAudienceElementState(el, 'mcq-multi', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-multi', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:5px;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-multi'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqMultiState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const totalSelections = Number(snap.totalSelections || 0);
                    const denom = totalSelections || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} répondant(s) · ${totalSelections} sélections</div>`;
                    publishMcqMultiState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        totalSelections,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-multi',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: true,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqMultiState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqMultiState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="checkbox" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqMultiState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const chosen = new Set(Array.from(host.querySelectorAll('input[data-opt]:checked')).map(inp => Number(inp.dataset.opt)));
                let good = 0;
                answers.forEach(v => { if (chosen.has(v)) good++; });
                const isPerfect = chosen.size === answers.size && good === answers.size;
                result.textContent = isPerfect ? 'Correct' : `${good}/${answers.size} bonne(s) réponse(s)`;
                result.style.color = isPerfect ? '#22c55e' : 'var(--sl-warning,#f59e0b)';
                publishMcqMultiState({
                    mode: 'local',
                    active: false,
                    selected: Array.from(chosen).slice(0, 24),
                    good,
                    expected: answers.size,
                    perfect: isPerfect,
                });
            });
        });

        // ── MCQ Single ──
        container.querySelectorAll('.sl-mcqsingle-pending').forEach(el => {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            const options = parseDataJson(el.dataset.options, []);
            const answer = Number(el.dataset.answer ?? 0);
            const host = el.querySelector('.sl-mcqsingle-options');
            const checkBtn = el.querySelector('.sl-mcqsingle-check');
            const endBtn = el.querySelector('.sl-mcqsingle-end');
            const result = el.querySelector('.sl-mcqsingle-result');
            if (!host || !checkBtn || !result) return;
            const questionText = String(el.querySelector('.sl-mcq-question')?.textContent || '').trim();
            const publishMcqSingleState = (extraState = {}) => emitAudienceElementState(el, 'mcq-single', Object.assign({
                hostHtml: host.innerHTML,
                resultHtml: result.innerHTML,
                resultText: String(result.textContent || ''),
                checkLabel: String(checkBtn.textContent || ''),
                checkDisabled: !!checkBtn.disabled,
                endVisible: !!(endBtn && endBtn.style.display !== 'none'),
            }, (extraState && typeof extraState === 'object') ? extraState : {}));
            if (isAudienceReadOnly) {
                checkBtn.disabled = true;
                checkBtn.textContent = 'Piloté';
                checkBtn.style.pointerEvents = 'none';
                if (endBtn) {
                    endBtn.disabled = true;
                    endBtn.style.display = 'none';
                    endBtn.style.pointerEvents = 'none';
                }
                disableInteractiveControls(host);
                result.innerHTML = '<span style="color:var(--sl-muted,#64748b);">Piloté par le présentateur</span>';
                subscribeAudienceElementState(el, 'mcq-single', state => {
                    const sync = (state && typeof state === 'object') ? state : {};
                    if (typeof sync.hostHtml === 'string') host.innerHTML = sync.hostHtml;
                    disableInteractiveControls(host);
                    if (typeof sync.resultHtml === 'string') result.innerHTML = sync.resultHtml;
                    else if (typeof sync.resultText === 'string') result.textContent = sync.resultText;
                    if (typeof sync.checkLabel === 'string' && sync.checkLabel.trim()) {
                        checkBtn.textContent = sync.checkLabel;
                    }
                    checkBtn.disabled = true;
                    checkBtn.style.pointerEvents = 'none';
                    if (endBtn) {
                        if (typeof sync.endVisible === 'boolean') endBtn.style.display = sync.endVisible ? '' : 'none';
                        endBtn.disabled = true;
                        endBtn.style.pointerEvents = 'none';
                    }
                });
                return;
            }
            const bridge = global.OEIRoomBridge;
            if (bridge?.subscribePoll) {
                host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;">
                        <span style="display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--sl-border,#2d3347);font-size:0.68rem;color:var(--sl-muted,#64748b);">${String.fromCharCode(65 + i)}</span>
                        <span>${SlidesRenderer.esc(opt)}</span>
                    </div>
                `).join('');
                let livePollId = '';
                checkBtn.textContent = 'Lancer live';
                if (endBtn) endBtn.style.display = '';
                const renderLive = snap => {
                    if (!snap?.active) {
                        result.innerHTML = livePollId
                            ? '<span style="color:var(--sl-success,#22c55e);">Sondage terminé</span>'
                            : '<span style="color:var(--sl-muted,#64748b);">Prêt</span>';
                        livePollId = '';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '' });
                        return;
                    }
                    const isLikelyOwn = snap.type === 'mcq-single'
                        && JSON.stringify(Array.isArray(snap.options) ? snap.options : []) === JSON.stringify(Array.isArray(options) ? options : []);
                    if (!livePollId) {
                        if (!isLikelyOwn) {
                            result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                            publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                            return;
                        }
                        livePollId = String(snap.pollId || '');
                    }
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Un autre sondage est actif</span>';
                        publishMcqSingleState({ mode: 'live', active: false, pollId: '', conflict: true });
                        return;
                    }
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : options;
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const denom = total || 1;
                    result.innerHTML = labels.map((label, i) => {
                        const count = counts[i] || 0;
                        const pct = Math.round((count / denom) * 100);
                        return `<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;font-size:0.68rem;margin-top:4px;">
                            <span>${SlidesRenderer.esc(label)}</span>
                            <div style="height:10px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#8b5cf6,#a78bfa);"></div></div>
                            <span>${count}</span>
                        </div>`;
                    }).join('') + `<div style="margin-top:6px;font-size:0.66rem;color:var(--sl-muted,#64748b);">${total} réponse(s)</div>`;
                    publishMcqSingleState({
                        mode: 'live',
                        active: true,
                        pollId: String(snap.pollId || livePollId || ''),
                        total,
                        counts: counts.slice(0, 32),
                        options: labels.slice(0, 16),
                    });
                };
                const unsub = bridge.subscribePoll(renderLive);
                el.addEventListener('remove', () => { try { unsub(); } catch (_) {} });
                checkBtn.addEventListener('click', e => {
                    e.preventDefault();
                    const started = bridge.startPoll?.({
                        type: 'mcq-single',
                        prompt: questionText,
                        options: Array.isArray(options) ? options : [],
                        multi: false,
                    });
                    if (!started) {
                        result.innerHTML = '<span style="color:var(--sl-warning,#f59e0b);">Ouvrez la salle (ou un sondage est déjà actif)</span>';
                        publishMcqSingleState({ mode: 'live', active: false, startError: true });
                        return;
                    }
                    livePollId = String(started);
                    publishMcqSingleState({ mode: 'live', active: true, pollId: livePollId, starting: true });
                });
                endBtn?.addEventListener('click', e => {
                    e.preventDefault();
                    const snap = bridge.getPollSnapshot?.();
                    if (!snap?.active) return;
                    if (livePollId && String(snap.pollId || '') !== String(livePollId)) return;
                    bridge.endPoll?.();
                });
                renderLive(bridge.getPollSnapshot?.() || { active: false });
                return;
            }
            const groupName = `mcq-single-${Math.random().toString(36).slice(2)}`;
            host.innerHTML = (Array.isArray(options) ? options : []).map((opt, i) => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--sl-border,#2d3347);border-radius:8px;font-size:0.76rem;"><input type="radio" name="${groupName}" data-opt="${i}" style="pointer-events:auto;"> <span>${SlidesRenderer.esc(opt)}</span></label>`).join('');
            publishMcqSingleState({ mode: 'local', active: false });
            checkBtn.addEventListener('click', () => {
                const selected = host.querySelector('input[data-opt]:checked');
                if (!selected) {
                    result.textContent = 'Sélectionnez une réponse';
                    result.style.color = 'var(--sl-warning,#f59e0b)';
                    publishMcqSingleState({ mode: 'local', active: false, selected: -1, checked: false });
                    return;
                }
                const chosen = Number(selected.dataset.opt);
                const ok = chosen === answer;
                result.textContent = ok ? 'Correct' : 'Incorrect';
                result.style.color = ok ? '#22c55e' : '#f87171';
                publishMcqSingleState({
                    mode: 'local',
                    active: false,
                    selected: chosen,
                    checked: true,
                    correct: ok,
                });
            });
        });
    }

    global.OEISlidesSpecialQuizRuntime = Object.freeze({ mountQuizElements });
})(typeof window !== 'undefined' ? window : globalThis);
