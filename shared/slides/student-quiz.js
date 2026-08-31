/**
 * @module slides/student-quiz
 * Student interactions: presenter-driven quiz overlay, score + leaderboard reporting,
 * live activity overlays (poll, wordcloud, exit-ticket, rank-order), reactions, discreet
 * feedback, audience nudges, discussion / Q&A panel.
 * Extracted from student-main.js (Lot 20).
 */
(function attachStudentQuiz(root) {
    'use strict';

    /**
     * @param {any} H - student app hub
     */
    function createStudentQuiz(H) {
        const st = H.state;
        const ROOM_MSG = H.ROOM_MSG;
        const esc = H.esc;
        const icon = H.icon;
        const toSafeInt = H.toSafeInt;
        const SCORE_KEY = H.storage.keys.score;
        const LS_KEY = H.storage.keys.room;

        // ── Score ────────────────────────────────────────
        let score = 0, quizCount = 0, quizCorrect = 0;
        try {
            const lsSaved = H.storage.localGetJSON(LS_KEY, null);
            if (lsSaved) {
                score = lsSaved.score || 0;
                quizCount = lsSaved.quizCount || 0;
                quizCorrect = lsSaved.quizCorrect || 0;
                if (lsSaved.pseudo) {
                    const pseudoInput = document.getElementById('pseudo-input');
                    if (pseudoInput) pseudoInput.value = lsSaved.pseudo;
                    const statusEl = document.getElementById('join-status');
                    if (statusEl) { statusEl.textContent = `Précédente session restaurée (${lsSaved.pseudo})`; statusEl.className = 'status-msg info'; }
                }
            } else {
                const ssSaved = H.storage.sessionGetJSON(SCORE_KEY, null);
                if (ssSaved) { score = ssSaved.score || 0; quizCount = ssSaved.quizCount || 0; quizCorrect = ssSaved.quizCorrect || 0; }
            }
        } catch (e) {}

        function saveScore() {
            const data = { pseudo: st.pseudo, score, quizCount, quizCorrect };
            H.storage.sessionSetJSON(SCORE_KEY, data);
            H.storage.localSetJSON(LS_KEY, data);
        }

        function updateScoreDisplay(earnedDelta = 0) {
            const ptsEl = document.getElementById('score-pts');
            if (ptsEl) {
                ptsEl.textContent = score.toLocaleString();
                if (earnedDelta > 0) {
                    ptsEl.classList.remove('flash');
                    void ptsEl.offsetWidth;
                    ptsEl.classList.add('flash');
                    ptsEl.addEventListener('animationend', () => ptsEl.classList.remove('flash'), { once: true });
                    const delta = document.createElement('span');
                    delta.className = 'score-delta';
                    delta.textContent = `+${earnedDelta.toLocaleString()}`;
                    delta.style.cssText = 'position:absolute;';
                    const rect = ptsEl.getBoundingClientRect();
                    delta.style.left = `${rect.left + rect.width / 2}px`;
                    delta.style.top = `${rect.top}px`;
                    delta.style.position = 'fixed';
                    document.body.appendChild(delta);
                    delta.addEventListener('animationend', () => delta.remove(), { once: true });
                }
            }
            const quizzesEl = document.getElementById('score-quizzes');
            if (quizzesEl) quizzesEl.textContent = `${quizCorrect}/${quizCount} quiz`;
        }

        // ── Quiz overlay ─────────────────────────────────
        let quizAnswered = false;
        let quizSelectedAnswer = null;
        let quizEarnedPoints = 0;
        let quizData = null;
        let quizStartTime = 0;
        let quizTimerInterval = null;

        function showQuiz(data) {
            if (st.quizActive) return;
            st.quizActive = true;
            quizAnswered = false;
            H.syncRuntime({ quizActive: true, quizAnswered: false });
            quizSelectedAnswer = null;
            quizData = data;
            quizStartTime = Date.now();

            const overlay = document.getElementById('quiz-overlay');
            overlay.innerHTML = '';
            const duration = parseInt(data.duration) || 30;
            const elapsed = data.startedAt ? Math.floor((Date.now() - data.startedAt) / 1000) : 0;
            let remaining = Math.max(1, duration - elapsed);

            const headerDiv = document.createElement('div');
            headerDiv.className = 'quiz-header';
            headerDiv.innerHTML = `<span class="quiz-label quiz-label-inline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg><span>Quiz</span></span><span class="quiz-timer" id="qt-timer">${remaining}s</span>`;
            overlay.appendChild(headerDiv);

            const qDiv = document.createElement('div');
            qDiv.className = 'quiz-question';
            qDiv.textContent = data.question || 'Question';
            overlay.appendChild(qDiv);

            const optsDiv = document.createElement('div');
            optsDiv.className = 'quiz-options';
            const options = data.options || [];
            options.forEach((opt, i) => {
                const div = document.createElement('div');
                div.className = 'quiz-option';
                div.innerHTML = `<span class="quiz-opt-letter">${String.fromCharCode(65 + i)}</span><span class="quiz-opt-text">${esc(opt)}</span>`;
                div.addEventListener('click', () => selectAnswer(i, div, optsDiv, data, remaining));
                optsDiv.appendChild(div);
            });
            overlay.appendChild(optsDiv);

            const resultDiv = document.createElement('div');
            resultDiv.id = 'qt-result';
            overlay.appendChild(resultDiv);

            overlay.classList.add('active');

            clearInterval(quizTimerInterval);
            quizTimerInterval = setInterval(() => {
                remaining--;
                const timerEl = document.getElementById('qt-timer');
                if (timerEl) {
                    timerEl.textContent = remaining + 's';
                    if (remaining <= 5) timerEl.classList.add('urgent');
                }
                if (remaining <= 0) {
                    clearInterval(quizTimerInterval);
                    if (!quizAnswered) timeoutQuiz(optsDiv);
                }
            }, 1000);
        }

        function selectAnswer(index, optEl, optsDiv, data) {
            if (quizAnswered) return;
            quizAnswered = true;
            H.syncRuntime({ quizAnswered: true });
            quizSelectedAnswer = index;
            clearInterval(quizTimerInterval);

            optsDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
            optEl.classList.add('selected');

            const duration = parseInt(data.duration) || 30;
            const responseTime = Math.min((Date.now() - quizStartTime) / 1000, duration);
            const timeBonus = Math.max(0.5, 1 - (responseTime / duration) * 0.5);
            quizEarnedPoints = Math.round(1000 * timeBonus);

            H.transport.sendReliable({ type: ROOM_MSG.QUIZ_ANSWER, quizId: data.quizId, answer: index, timestamp: Date.now() }, { maxRetries: 2, retryDelay: 1200 });
            H.render.markCheckpointCompleted(st.currentIndex, 'quiz');

            const resultDiv = document.getElementById('qt-result');
            if (resultDiv) resultDiv.innerHTML = '<div class="quiz-result-banner sent">✓ Réponse envoyée ! En attente des résultats…</div>';
        }

        function timeoutQuiz(optsDiv) {
            quizAnswered = false;
            H.syncRuntime({ quizAnswered: false });
            if (optsDiv) optsDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
            const resultDiv = document.getElementById('qt-result');
            if (resultDiv) resultDiv.innerHTML = '<div class="quiz-result-banner timeout">⏰ Temps écoulé</div>';
        }

        function endQuiz(data) {
            clearInterval(quizTimerInterval);
            const overlay = document.getElementById('quiz-overlay');
            const correctAnswer = data.correctAnswer ?? -1;
            quizCount++;

            overlay.querySelectorAll('.quiz-option').forEach((o, i) => {
                if (i === correctAnswer) o.classList.add('correct');
                else if (i === quizSelectedAnswer && quizSelectedAnswer !== correctAnswer) o.classList.add('wrong');
            });

            const resultDiv = document.getElementById('qt-result');
            if (quizAnswered && quizSelectedAnswer !== null) {
                const isCorrect = quizSelectedAnswer === correctAnswer;
                if (isCorrect) {
                    quizCorrect++;
                    score += quizEarnedPoints;
                    if (resultDiv) resultDiv.innerHTML = `<div class="quiz-result-banner correct">✅ Correct ! +${quizEarnedPoints.toLocaleString()} pts</div>`;
                } else {
                    if (resultDiv) {
                        const letter = correctAnswer >= 0 ? String.fromCharCode(65 + correctAnswer) : '?';
                        resultDiv.innerHTML = `<div class="quiz-result-banner wrong">❌ Incorrect — bonne réponse : ${esc(letter)}</div>`;
                    }
                }
            } else {
                if (resultDiv) {
                    const letter = correctAnswer >= 0 ? String.fromCharCode(65 + correctAnswer) : '?';
                    resultDiv.innerHTML = `<div class="quiz-result-banner wrong">Bonne réponse : ${esc(letter)}</div>`;
                }
            }

            saveScore();
            updateScoreDisplay(quizAnswered && quizSelectedAnswer !== null && quizSelectedAnswer === (data.correctAnswer ?? -1) ? quizEarnedPoints : 0);

            H.transport.sendReliable({ type: ROOM_MSG.STUDENT_SCORE, score, quizCount, quizCorrect, pseudo: st.pseudo }, { maxRetries: 3, retryDelay: 1500 });

            setTimeout(() => {
                overlay.classList.remove('active');
                st.quizActive = false;
                H.syncRuntime({ quizActive: false });
                quizData = null;
            }, 3500);
        }

        function dismissActiveQuiz() {
            if (!st.quizActive) return;
            clearInterval(quizTimerInterval);
            document.getElementById('quiz-overlay')?.classList.remove('active');
            st.quizActive = false;
            H.syncRuntime({ quizActive: false });
        }

        // ── Reactions ────────────────────────────────────
        function showLocalReaction(emoji) {
            const el = document.createElement('div');
            el.className = 'student-reaction-float';
            el.style.left = (20 + Math.random() * 60) + 'vw';
            el.textContent = emoji;
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }

        // ── Audience nudge ───────────────────────────────
        let _nudgeTimer = null;
        function showAudienceNudge(kind, text) {
            const toast = document.getElementById('nudge-toast');
            if (!toast) return;
            const iconByKind = { question: 'question', hand: 'hand', poll: 'poll', cloud: 'cloud' };
            const iconKey = iconByKind[String(kind || '').toLowerCase()] || 'question';
            const message = String(text || '').trim() || 'Le presentateur vous relance.';
            toast.innerHTML = `${icon(iconKey)}<span>${esc(message)}</span>`;
            toast.classList.add('show');
            if (_nudgeTimer) clearTimeout(_nudgeTimer);
            _nudgeTimer = setTimeout(() => { toast.classList.remove('show'); }, 2600);
        }

        // ── Discreet feedback ────────────────────────────
        let _feedbackCooldownUntil = 0;
        let _feedbackCooldownTimer = null;
        function hydrateFeedbackIcons() {
            document.querySelectorAll('.feedback-btn').forEach(btn => {
                const slot = btn.querySelector('.feedback-btn-icon');
                const key = String(btn.dataset.icon || '');
                if (!slot || !key) return;
                slot.innerHTML = icon(key);
            });
        }
        function updateFeedbackUI() {
            const now = Date.now();
            const disabled = now < _feedbackCooldownUntil;
            document.querySelectorAll('.feedback-btn').forEach(btn => { btn.disabled = disabled; });
            const sent = document.getElementById('feedback-sent');
            if (!sent) return;
            if (!disabled) { sent.textContent = ''; return; }
            const remain = Math.max(0, Math.ceil((_feedbackCooldownUntil - now) / 1000));
            sent.textContent = `${remain}s`;
        }
        function sendDiscreteFeedback(kind, text) {
            if (Date.now() < _feedbackCooldownUntil) return;
            if (!H.transport.canSend()) return;
            H.transport.sendReliable({
                type: ROOM_MSG.STUDENT_FEEDBACK,
                kind: String(kind || '').toLowerCase(),
                text: String(text || '').slice(0, 120),
                ts: Date.now(),
            }, { maxRetries: 3, retryDelay: 1500 });
            const sent = document.getElementById('feedback-sent');
            if (sent) sent.innerHTML = `${icon('check')}<span>Envoyé</span>`;
            _feedbackCooldownUntil = Date.now() + 12000;
            updateFeedbackUI();
            if (_feedbackCooldownTimer) clearInterval(_feedbackCooldownTimer);
            _feedbackCooldownTimer = setInterval(() => {
                updateFeedbackUI();
                if (Date.now() >= _feedbackCooldownUntil) {
                    clearInterval(_feedbackCooldownTimer);
                    _feedbackCooldownTimer = null;
                    updateFeedbackUI();
                }
            }, 500);
        }

        // ── Discussion / Q&A panel ───────────────────────
        function _escHtml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        function dpSetTab(tab) {
            document.querySelectorAll('.dp-tab').forEach(b => b.classList.toggle('active', b.dataset.dpTab === tab));
            document.querySelectorAll('.dp-pane').forEach(p => p.classList.toggle('active', p.id === `dp-pane-${tab}`));
        }
        function dpAddMessage(pane, { text, from, own, broadcast }) {
            const container = document.getElementById(`dp-pane-${pane}`);
            if (!container) return;
            const empty = container.querySelector('.dp-empty');
            if (empty) empty.remove();
            const msg = document.createElement('div');
            if (broadcast) {
                msg.className = 'dp-broadcast';
                msg.innerHTML = `<span class="dp-broadcast-icon">📢</span><span>${_escHtml(text)}</span>`;
            } else {
                const initials = (from || '?').slice(0, 2).toUpperCase();
                msg.className = 'dp-msg';
                msg.innerHTML = `<div class="dp-msg-avatar">${initials}</div><div><div class="dp-msg-bubble${own ? ' own' : ''}">${_escHtml(text)}</div><div class="dp-msg-meta">${_escHtml(from || '')}</div></div>`;
            }
            container.appendChild(msg);
            container.scrollTop = container.scrollHeight;
            if (pane === 'qa') {
                const badge = document.getElementById('dp-qa-badge');
                if (badge) badge.textContent = container.querySelectorAll('.dp-msg').length;
            }
        }
        function dpUpdateKeynotes(points) {
            const container = document.getElementById('ssp-keynotes');
            if (!container) return;
            if (!points.length) {
                container.innerHTML = '<div class="ssp-keynotes-empty">Le présentateur n\'a pas encore partagé de points clés.</div>';
                return;
            }
            container.innerHTML = points.map(p =>
                `<div class="ssp-keynote-item"><div class="ssp-keynote-dot"></div><span>${_escHtml(p)}</span></div>`
            ).join('');
        }

        // ── Live activity overlays ───────────────────────
        let _activePollId = null;
        let _activeCloudId = null;
        let _activeExitTicketId = null;
        let _activeRankOrderId = null;
        let _activeRankOrderItems = [];

        function showPollOverlay(msg) {
            const overlay = document.getElementById('poll-overlay');
            const promptEl = document.getElementById('poll-prompt-text');
            const buttonsEl = document.getElementById('poll-buttons');
            const sentEl = document.getElementById('poll-sent-msg');
            if (!overlay || !buttonsEl) return;
            const pollType = (msg.pollType === 'thumbs' || msg.pollType === 'scale5' || msg.pollType === 'mcq-single' || msg.pollType === 'mcq-multi')
                ? msg.pollType
                : 'scale5';
            const isMulti = !!msg.multi || pollType === 'mcq-multi';
            const fallbackOptions = pollType === 'thumbs'
                ? ['👍 Pour', '👎 Contre']
                : (pollType === 'scale5' ? ['1', '2', '3', '4', '5'] : ['Option A', 'Option B']);
            const options = (Array.isArray(msg.options) ? msg.options : fallbackOptions)
                .map(v => String(v ?? '').trim())
                .filter(Boolean);
            const labels = options.length ? options : fallbackOptions;
            const valueDomain = pollType === 'thumbs'
                ? [1, 0]
                : (pollType === 'scale5' ? [1, 2, 3, 4, 5] : labels.map((_, i) => i));
            const choices = labels.map((label, i) => ({ label, value: valueDomain[i] ?? i }));

            promptEl.textContent = msg.prompt
                || (pollType === 'thumbs'
                    ? 'Vous en pensez quoi ?'
                    : (pollType === 'scale5' ? 'Notez de 1 à 5' : 'Choisissez une réponse'));
            sentEl.style.display = 'none';
            buttonsEl.innerHTML = '';
            const selected = new Set();
            const sendAnswer = value => {
                if (!_activePollId) return;
                H.transport.sendReliable({ type: ROOM_MSG.POLL_ANSWER, pollId: _activePollId, value }, { maxRetries: 2, retryDelay: 1200 });
                H.render.markCheckpointCompleted(st.currentIndex, 'poll');
                buttonsEl.querySelectorAll('button').forEach(b => b.disabled = true);
                if (sentEl) {
                    sentEl.style.display = '';
                    sentEl.textContent = Array.isArray(value) ? 'Réponses envoyées ✓' : 'Réponse envoyée ✓';
                }
            };

            choices.forEach((ch) => {
                const btn = document.createElement('button');
                btn.className = 'poll-choice-btn ui-btn';
                btn.textContent = ch.label;
                if (pollType === 'mcq-single' || pollType === 'mcq-multi') {
                    btn.style.fontSize = '0.95rem';
                    btn.style.padding = '10px 14px';
                } else if (pollType === 'scale5') {
                    btn.style.fontSize = '1.25rem';
                }
                btn.addEventListener('click', () => {
                    if (!isMulti) { sendAnswer(ch.value); return; }
                    if (selected.has(ch.value)) selected.delete(ch.value);
                    else selected.add(ch.value);
                    btn.classList.toggle('active', selected.has(ch.value));
                });
                buttonsEl.appendChild(btn);
            });

            if (isMulti) {
                const submit = document.createElement('button');
                submit.className = 'poll-choice-btn ui-btn';
                submit.textContent = 'Envoyer la sélection';
                submit.style.fontSize = '0.9rem';
                submit.style.padding = '10px 14px';
                submit.addEventListener('click', () => {
                    if (!selected.size) return;
                    sendAnswer(Array.from(selected));
                });
                buttonsEl.appendChild(submit);
            }
            overlay.style.display = 'flex';
        }

        function sendWordcloudWord() {
            const input = document.getElementById('wc-input');
            const word = input.value.trim();
            if (!word || !_activeCloudId) return;
            H.transport.sendReliable({ type: ROOM_MSG.WORDCLOUD_WORD, cloudId: _activeCloudId, word }, { maxRetries: 2, retryDelay: 1300 });
            H.render.markCheckpointCompleted(st.currentIndex, 'wordcloud');
            input.value = '';
            const sendBtn = document.getElementById('wc-send');
            const sentMsg = document.getElementById('wc-sent-msg');
            sendBtn.disabled = true;
            if (sentMsg) sentMsg.textContent = 'Mot envoyé ✓';
            setTimeout(() => {
                sendBtn.disabled = false;
                if (sentMsg) sentMsg.textContent = '';
            }, 5000);
        }

        function showWordcloudOverlay(msg) {
            const overlay = document.getElementById('wordcloud-overlay');
            if (!overlay) return;
            document.getElementById('wc-prompt-text').textContent = msg.prompt || 'Proposez un mot';
            document.getElementById('wc-display').innerHTML = '';
            document.getElementById('wc-input').value = '';
            document.getElementById('wc-sent-msg').textContent = '';
            overlay.style.display = 'flex';
        }

        function updateWordcloudDisplay(words) {
            const display = document.getElementById('wc-display');
            if (!display || !words?.length) return;
            const max = words[0]?.[1] || 1;
            const colors = ['#818cf8', '#34d399', '#f472b6', '#fb923c', '#60a5fa'];
            display.innerHTML = words.map(([w, c], i) => {
                const size = Math.round(10 + (c / max) * 36);
                return `<span class="wc-word" style="font-size:${size}px;color:${colors[i % 5]};">${esc(w)}</span>`;
            }).join('');
        }

        function showExitTicketOverlay(msg) {
            const overlay = document.getElementById('exitticket-overlay');
            const titleEl = document.getElementById('exitticket-title');
            const promptsEl = document.getElementById('exitticket-prompts');
            const sentEl = document.getElementById('exitticket-sent-msg');
            if (!overlay || !titleEl || !promptsEl) return;
            const title = String(msg?.title || '').trim() || 'Exit ticket';
            const prompts = (Array.isArray(msg?.prompts) ? msg.prompts : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 4);
            const safePrompts = prompts.length ? prompts : ['Votre retour'];
            titleEl.textContent = title;
            promptsEl.innerHTML = safePrompts.map((prompt, idx) => (
                `<label class="exit-prompt-row">
                    <span class="exit-prompt-label">${idx + 1}. ${esc(prompt)}</span>
                    <textarea class="exit-prompt-input" data-exit-idx="${idx}" maxlength="280" placeholder="Votre réponse..."></textarea>
                </label>`
            )).join('');
            if (sentEl) sentEl.textContent = '';
            overlay.style.display = 'flex';
        }

        function renderRankOrderOverlayList() {
            const listEl = document.getElementById('rankorder-list');
            if (!listEl) return;
            listEl.innerHTML = _activeRankOrderItems.map((item, idx) => `
                <div class="rankorder-row">
                    <span class="rankorder-index">${idx + 1}</span>
                    <span class="rankorder-label">${esc(item?.label || '')}</span>
                    <span class="rankorder-actions">
                        <button class="rank-move-btn" type="button" data-rank-move="up" data-rank-idx="${idx}" ${idx <= 0 ? 'disabled' : ''}>▲</button>
                        <button class="rank-move-btn" type="button" data-rank-move="down" data-rank-idx="${idx}" ${idx >= _activeRankOrderItems.length - 1 ? 'disabled' : ''}>▼</button>
                    </span>
                </div>
            `).join('');
            listEl.querySelectorAll('[data-rank-move]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = toSafeInt(btn.dataset.rankIdx);
                    if (idx === null || idx < 0 || idx >= _activeRankOrderItems.length) return;
                    const dir = String(btn.dataset.rankMove || '');
                    const target = dir === 'up' ? idx - 1 : idx + 1;
                    if (target < 0 || target >= _activeRankOrderItems.length) return;
                    [_activeRankOrderItems[idx], _activeRankOrderItems[target]] = [_activeRankOrderItems[target], _activeRankOrderItems[idx]];
                    renderRankOrderOverlayList();
                });
            });
        }

        function showRankOrderOverlay(msg) {
            const overlay = document.getElementById('rankorder-overlay');
            const titleEl = document.getElementById('rankorder-title');
            const sentEl = document.getElementById('rankorder-sent-msg');
            if (!overlay || !titleEl) return;
            const title = String(msg?.title || '').trim() || 'Classement collectif';
            const items = (Array.isArray(msg?.items) ? msg.items : [])
                .map(v => String(v || '').trim())
                .filter(Boolean)
                .slice(0, 8);
            const safeItems = items.length >= 2 ? items : ['Option A', 'Option B', 'Option C'];
            _activeRankOrderItems = safeItems.map((label, index) => ({ index, label }));
            titleEl.textContent = title;
            renderRankOrderOverlayList();
            if (sentEl) sentEl.textContent = '';
            overlay.style.display = 'flex';
        }

        function sendExitTicketAnswers() {
            if (!_activeExitTicketId) return;
            const promptsEl = document.getElementById('exitticket-prompts');
            const sendBtn = document.getElementById('exitticket-send');
            const sentEl = document.getElementById('exitticket-sent-msg');
            if (!promptsEl || !sendBtn) return;
            const answers = Array.from(promptsEl.querySelectorAll('[data-exit-idx]'))
                .map(input => String(input?.value || '').trim().slice(0, 280));
            if (!answers.some(Boolean)) {
                if (sentEl) sentEl.textContent = 'Ajoutez au moins une réponse.';
                return;
            }
            H.transport.sendReliable({
                type: ROOM_MSG.EXIT_TICKET_SUBMIT,
                ticketId: _activeExitTicketId,
                answers,
            }, { maxRetries: 3, retryDelay: 1300 });
            H.render.markCheckpointCompleted(st.currentIndex, 'exit-ticket');
            sendBtn.disabled = true;
            if (sentEl) sentEl.textContent = 'Réponses envoyées ✓';
            setTimeout(() => {
                sendBtn.disabled = false;
                if (sentEl?.textContent?.includes('envoy')) sentEl.textContent = '';
            }, 1400);
        }

        function sendRankOrderSubmission() {
            if (!_activeRankOrderId || !_activeRankOrderItems.length) return;
            const sendBtn = document.getElementById('rankorder-send');
            const sentEl = document.getElementById('rankorder-sent-msg');
            if (!sendBtn) return;
            const order = _activeRankOrderItems.map(item => Number(item.index)).filter(Number.isFinite);
            if (order.length < 2) return;
            H.transport.sendReliable({
                type: ROOM_MSG.RANK_ORDER_SUBMIT,
                rankId: _activeRankOrderId,
                order,
            }, { maxRetries: 3, retryDelay: 1300 });
            H.render.markCheckpointCompleted(st.currentIndex, 'rank-order');
            sendBtn.disabled = true;
            if (sentEl) sentEl.textContent = 'Classement envoyé ✓';
            setTimeout(() => {
                sendBtn.disabled = false;
                if (sentEl?.textContent?.includes('envoy')) sentEl.textContent = '';
            }, 1400);
        }

        // ── room:* message dispatch (from handleMessage) ──
        function handleRoomMessage(msg) {
            switch (msg.type) {
                case ROOM_MSG.QUIZ_QUESTION: showQuiz(msg); return true;
                case ROOM_MSG.QUIZ_END: if (st.quizActive) endQuiz({ correctAnswer: msg.correctAnswer }); return true;
                case ROOM_MSG.REACTION_SHOW: showLocalReaction(msg.emoji); return true;
                case ROOM_MSG.AUDIENCE_NUDGE: showAudienceNudge(msg.kind, msg.text); return true;
                case ROOM_MSG.POLL_START: _activePollId = msg.pollId; showPollOverlay(msg); return true;
                case ROOM_MSG.POLL_END:
                    _activePollId = null;
                    document.getElementById('poll-overlay').style.display = 'none';
                    return true;
                case ROOM_MSG.WORDCLOUD_START: _activeCloudId = msg.cloudId; showWordcloudOverlay(msg); return true;
                case ROOM_MSG.WORDCLOUD_UPDATE:
                    if (msg.cloudId === _activeCloudId) updateWordcloudDisplay(msg.words);
                    return true;
                case ROOM_MSG.WORDCLOUD_END:
                    _activeCloudId = null;
                    document.getElementById('wordcloud-overlay').style.display = 'none';
                    return true;
                case ROOM_MSG.CHAT_BROADCAST:
                    dpAddMessage('discussion', { text: msg.text, from: msg.from || 'Présentateur', own: false, broadcast: true });
                    return true;
                case ROOM_MSG.ROOM_KEYNOTE: dpUpdateKeynotes(msg.points || []); return true;
                case ROOM_MSG.EXIT_TICKET_START: _activeExitTicketId = msg.ticketId || null; showExitTicketOverlay(msg); return true;
                case ROOM_MSG.EXIT_TICKET_END:
                    if (!_activeExitTicketId || !msg.ticketId || String(msg.ticketId) === String(_activeExitTicketId)) {
                        _activeExitTicketId = null;
                        document.getElementById('exitticket-overlay').style.display = 'none';
                    }
                    return true;
                case ROOM_MSG.RANK_ORDER_START: _activeRankOrderId = msg.rankId || null; showRankOrderOverlay(msg); return true;
                case ROOM_MSG.RANK_ORDER_END:
                    if (!_activeRankOrderId || !msg.rankId || String(msg.rankId) === String(_activeRankOrderId)) {
                        _activeRankOrderId = null;
                        _activeRankOrderItems = [];
                        document.getElementById('rankorder-overlay').style.display = 'none';
                    }
                    return true;
                default: return false;
            }
        }

        // ── DOM bindings owned by this module ────────────
        function bindControls() {
            document.querySelectorAll('.reaction-btn').forEach(btn => {
                if (btn.id === 'student-cc-btn') return;
                btn.addEventListener('click', () => {
                    const emoji = btn.dataset.emoji;
                    showLocalReaction(emoji);
                    H.transport.send({ type: ROOM_MSG.STUDENT_REACTION, emoji, pseudo: st.pseudo });
                    btn.disabled = true;
                    setTimeout(() => { btn.disabled = false; }, 2000);
                });
            });
            document.querySelectorAll('.ssp-reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const emoji = btn.dataset.emoji;
                    const orig = document.querySelector(`#reaction-bar .reaction-btn[data-emoji="${CSS.escape(emoji)}"]`);
                    if (orig && !orig.disabled) orig.click();
                });
            });
            document.querySelectorAll('.feedback-btn').forEach(btn => {
                btn.addEventListener('click', () => sendDiscreteFeedback(btn.dataset.feedback, btn.dataset.text));
            });
            hydrateFeedbackIcons();
            updateFeedbackUI();

            document.querySelectorAll('.dp-tab').forEach(btn => {
                btn.addEventListener('click', () => dpSetTab(btn.dataset.dpTab));
            });

            document.getElementById('hand-btn')?.addEventListener('click', () => {
                st.handRaised = !st.handRaised;
                document.getElementById('hand-btn').classList.toggle('raised', st.handRaised);
                document.getElementById('ssp-hand-btn')?.classList.toggle('active', st.handRaised);
                H.transport.sendReliable({ type: ROOM_MSG.STUDENT_HAND, raised: st.handRaised }, { maxRetries: 3, retryDelay: 1400 });
                H.transport.sendTelemetry('hand-toggle', true);
            });
            document.getElementById('ssp-hand-btn')?.addEventListener('click', () => document.getElementById('hand-btn')?.click());
            document.getElementById('ssp-question-btn')?.addEventListener('click', () => document.getElementById('question-btn')?.click());

            document.getElementById('question-btn')?.addEventListener('click', () => {
                document.getElementById('question-overlay').style.display = 'flex';
                document.getElementById('question-text').focus();
            });
            document.getElementById('question-cancel')?.addEventListener('click', () => {
                document.getElementById('question-overlay').style.display = 'none';
            });
            document.getElementById('question-send')?.addEventListener('click', () => {
                const text = document.getElementById('question-text').value.trim();
                if (!text) return;
                H.transport.sendReliable({ type: ROOM_MSG.STUDENT_QUESTION, text, qid: `q-${Date.now()}` }, { maxRetries: 3, retryDelay: 1400 });
                dpAddMessage('qa', { text, from: 'Vous', own: true });
                document.getElementById('question-text').value = '';
                document.getElementById('question-overlay').style.display = 'none';
            });

            ['poll', 'wc', 'exitticket', 'rankorder'].forEach(id => {
                const overlayId = id === 'wc' ? 'wordcloud-overlay' : `${id}-overlay`;
                document.getElementById(`${id}-dismiss`)?.addEventListener('click', () => {
                    document.getElementById(overlayId).style.display = 'none';
                });
            });
            document.getElementById('wc-send')?.addEventListener('click', sendWordcloudWord);
            document.getElementById('wc-input')?.addEventListener('keydown', e => {
                if (e.key === 'Enter') sendWordcloudWord();
            });
            document.getElementById('exitticket-send')?.addEventListener('click', sendExitTicketAnswers);
            document.getElementById('rankorder-send')?.addEventListener('click', sendRankOrderSubmission);
        }

        return {
            handleRoomMessage,
            showQuiz,
            endQuiz,
            dismissActiveQuiz,
            saveScore,
            updateScoreDisplay,
            getScore: () => ({ score, quizCount, quizCorrect }),
            dpAddMessage,
            bindControls,
        };
    }

    root.OEIStudentQuiz = Object.freeze({ create: createStudentQuiz });
})(window);
