    // ── Theme (outside IIFE so it runs immediately) ───
    (function() {
        const Storage = window.OEIStorage || null;
        const STUDENT_THEME_KEY = Storage?.KEYS?.STUDENT_THEME || 'oei-student-theme';
        const readTheme = () => {
            if (Storage?.getRaw) return Storage.getRaw(STUDENT_THEME_KEY);
            return localStorage.getItem(STUDENT_THEME_KEY);
        };
        const writeTheme = val => {
            if (Storage?.setRaw) return Storage.setRaw(STUDENT_THEME_KEY, val);
            localStorage.setItem(STUDENT_THEME_KEY, val);
            return true;
        };
        const saved = readTheme();
        const dark = saved === 'dark';
        if (dark) document.body.classList.add('dark');
        const toggleStudentTheme = function() {
            const nowDark = document.body.classList.toggle('dark');
            writeTheme(nowDark ? 'dark' : 'light');
        };
        window.OEIStudentThemeToggle = toggleStudentTheme;
    })();

    (function() {
        'use strict';
        const Storage = window.OEIStorage || null;
        const RealtimeContract = window.OEIRealtimeContract || {};
        const NetworkSession = window.OEINetworkSession || {};
        const ROOM_MSG = RealtimeContract.ROOM_MSG;
        const validateRoomMessage = typeof RealtimeContract.validateRoomMessage === 'function'
            ? RealtimeContract.validateRoomMessage
            : (() => true);
        if (!ROOM_MSG) {
            throw new Error('OEIRealtimeContract indisponible: impossible de démarrer le mode étudiant.');
        }
        const UI_ICONS = window.OEI_UI_ICONS || {};
        const icon = key => UI_ICONS[key] || '';
        const localGetJSON = (key, fallback = null) => {
            if (!key) return fallback;
            if (Storage?.getJSON) return Storage.getJSON(key, fallback);
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return fallback;
                return JSON.parse(raw);
            } catch (e) { return fallback; }
        };
        const localSetJSON = (key, value) => {
            if (!key) return false;
            if (Storage?.setJSON) return Storage.setJSON(key, value);
            try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
        };
        const sessionGetJSON = (key, fallback = null) => {
            if (!key) return fallback;
            if (Storage?.getSessionJSON) return Storage.getSessionJSON(key, fallback);
            try {
                const raw = sessionStorage.getItem(key);
                if (!raw) return fallback;
                return JSON.parse(raw);
            } catch (e) { return fallback; }
        };
        const sessionSetJSON = (key, value) => {
            if (!key) return false;
            if (Storage?.setSessionJSON) return Storage.setSessionJSON(key, value);
            try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
        };
        const sessionRemove = key => {
            if (!key) return false;
            if (typeof Storage?.removeSessionRaw === 'function') return Storage.removeSessionRaw(key);
            try { sessionStorage.removeItem(key); return true; } catch (e) { return false; }
        };
        const buildRoomKey = room => (Storage?.studentRoomKey ? Storage.studentRoomKey(room) : ('oei-student-room-' + room));
        const buildScoreKey = room => (Storage?.studentScoreKey ? Storage.studentScoreKey(room) : ('oei-student-score-' + room));
        const buildNotesKey = room => (Storage?.studentNotesKey ? Storage.studentNotesKey(room) : ('oei-student-notes-' + room));

        document.getElementById('theme-toggle')?.addEventListener('click', window.OEIStudentThemeToggle);

        const params = new URLSearchParams(location.search);
        const roomId = params.get('room');

        if (!roomId) {
            setJoinStatus('Aucune salle spécifiée. Scannez le QR code depuis la présentation.', 'error');
            document.getElementById('join-btn').disabled = true;
            return;
        }

        const toSafeString = typeof NetworkSession.toSafeString === 'function'
            ? NetworkSession.toSafeString
            : ((value, max = 300) => String(value == null ? '' : value).trim().slice(0, max));
        const toSafeInt = typeof NetworkSession.toSafeInt === 'function'
            ? NetworkSession.toSafeInt
            : (value => {
                const n = Number(value);
                return Number.isFinite(n) ? Math.trunc(n) : null;
            });
        const PEER_OPTIONS = typeof NetworkSession.buildPeerOptions === 'function'
            ? NetworkSession.buildPeerOptions(params, localGetJSON, window.OEI_PEER_OPTIONS)
            : { debug: 0, pingInterval: 5000, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
        const RELAY_OPTIONS = typeof NetworkSession.buildRelayOptions === 'function'
            ? NetworkSession.buildRelayOptions(params, localGetJSON, window.OEI_RELAY_OPTIONS)
            : { enabled: false, wsUrl: '', token: '' };
        const reconnectDelayMsShared = attempt => (
            typeof NetworkSession.reconnectDelayMs === 'function'
                ? NetworkSession.reconnectDelayMs(attempt)
                : (Math.min(30000, Math.round(1200 * Math.pow(1.45, Math.max(0, attempt - 1)))) + Math.round(Math.random() * 500))
        );
        const nextRid = typeof NetworkSession.createRidFactory === 'function'
            ? NetworkSession.createRidFactory('st')
            : (() => {
                let seq = 0;
                return () => `st-${Date.now().toString(36)}-${(seq++).toString(36)}`;
            })();

        // ── State ────────────────────────────────────────
        let pseudo = '';
        let peer = null;
        let conn = null;
        let relaySocket = null;
        let relayOpen = false;
        const relayClientId = `st-${Math.random().toString(36).slice(2, 10)}`;
        let transportMode = 'p2p';
        const studentWidgetScriptVersion = Date.now();
        let slidesHtml = [];
        let currentIndex = 0;
        let currentFragmentOrder = -1;
        let reconnectAttempts = 0;
        const MAX_RECONNECT = 30;
        const RELAY_FALLBACK_ATTEMPT = 5;
        const pendingAcks = new Map();
        const CONNECTION_STATE = Object.freeze({
            IDLE: 'idle',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            RETRYING: 'retrying',
            OFFLINE: 'offline',
        });
        let _connectionState = CONNECTION_STATE.IDLE;
        let _connectionStateSince = Date.now();
        let _connectionWatchdogTimer = null;
        let _forceReconnectCooldownUntil = 0;
        const RELIABLE_QUEUE_PREFIX = `oei-v1-student-reliable-${toSafeString(roomId, 80)}-`;
        let _reliableQueueKey = RELIABLE_QUEUE_PREFIX + 'anon';

        // Persistent storage (localStorage) for this room
        const LS_KEY = buildRoomKey(roomId);
        const SCORE_KEY = buildScoreKey(roomId); // sessionStorage compat
        const BOOKMARKS_KEY = `oei-v1-student-bookmarks-${roomId}`;
        const REVISION_KEY = `oei-v1-student-revision-${roomId}`;
        const REVISION_BUCKETS = /** @type {const} */ (['new', 'review', 'known']);
        let score = 0, quizCount = 0, quizCorrect = 0;

        // Load from localStorage first (persistent), fall back to sessionStorage
        try {
            const lsSaved = localGetJSON(LS_KEY, null);
            if (lsSaved) {
                score = lsSaved.score || 0;
                quizCount = lsSaved.quizCount || 0;
                quizCorrect = lsSaved.quizCorrect || 0;
                // Pre-fill pseudo
                if (lsSaved.pseudo) {
                    const pseudoInput = document.getElementById('pseudo-input');
                    if (pseudoInput) pseudoInput.value = lsSaved.pseudo;
                    const statusEl = document.getElementById('join-status');
                    if (statusEl) { statusEl.textContent = `Précédente session restaurée (${lsSaved.pseudo})`; statusEl.className = 'status-msg info'; }
                }
            } else {
                // Fallback: sessionStorage
                const ssSaved = sessionGetJSON(SCORE_KEY, null);
                if (ssSaved) { score = ssSaved.score || 0; quizCount = ssSaved.quizCount || 0; quizCorrect = ssSaved.quizCorrect || 0; }
            }
        } catch(e) {}

        // Navigation & room interaction state
        let _presenterIndex = 0;
        let _followPresenter = true;
        let _handRaised = false;
        let _activePollId = null;
        let _activeCloudId = null;
        let _activeExitTicketId = null;
        let _activeRankOrderId = null;
        let _activeRankOrderItems = [];
        let _nudgeTimer = null;
        let _feedbackCooldownUntil = 0;
        let _feedbackCooldownTimer = null;

        // Quiz state
        let quizActive = false;
        let quizAnswered = false;
        let quizSelectedAnswer = null;
        let quizEarnedPoints = 0;
        let quizData = null;
        let quizStartTime = 0;
        let quizTimerInterval = null;

        // Per-slide notes state
        const NOTES_KEY = buildNotesKey(roomId);
        let _notesData = {};
        _notesData = localGetJSON(NOTES_KEY, {}) || {};
        let _bookmarks = new Set((localGetJSON(BOOKMARKS_KEY, []) || []).map(v => String(v)));
        let _bookmarksOnly = false;
        let _quizSlides = new Set();
        let _checkpointRequiredSlides = new Set();
        let _checkpointCompletedSlides = new Set();
        let _revisionEnabled = false;
        const _revisionRaw = localGetJSON(REVISION_KEY, {}) || {};
        let _revisionWeeklyGoal = Number.isFinite(Number(_revisionRaw?.weeklyGoal))
            ? Math.max(1, Math.trunc(Number(_revisionRaw.weeklyGoal)))
            : 20;
        const revisionWeekKey = (ts = Date.now()) => {
            const d = new Date(ts);
            const day = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - day);
            d.setHours(0, 0, 0, 0);
            return `${d.getFullYear()}-W${String(Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
        };
        let _revisionWeeklyProgress = (() => {
            const raw = _revisionRaw?.weeklyProgress || {};
            const wk = toSafeString(raw.weekKey, 20) || revisionWeekKey();
            const done = Number.isFinite(Number(raw.done)) ? Math.max(0, Math.trunc(Number(raw.done))) : 0;
            return { weekKey: wk, done };
        })();
        if (_revisionWeeklyProgress.weekKey !== revisionWeekKey()) _revisionWeeklyProgress = { weekKey: revisionWeekKey(), done: 0 };
        let _revisionStateBySlide = (() => {
            const out = {};
            const bySlide = _revisionRaw && typeof _revisionRaw === 'object' ? _revisionRaw.bySlide : null;
            if (!bySlide || typeof bySlide !== 'object') return out;
            Object.entries(bySlide).forEach(([idx, item]) => {
                const slideIdx = Number(idx);
                if (!Number.isFinite(slideIdx) || slideIdx < 0) return;
                const bucket = REVISION_BUCKETS.includes(item?.bucket) ? item.bucket : 'new';
                out[String(slideIdx)] = {
                    bucket,
                    seen: Number.isFinite(Number(item?.seen)) ? Math.max(0, Math.trunc(Number(item.seen))) : 0,
                    nextDue: Number.isFinite(Number(item?.nextDue)) ? Math.max(0, Math.trunc(Number(item.nextDue))) : 0,
                    easiness: Number.isFinite(Number(item?.easiness)) ? Math.max(1.3, Math.min(3.2, Number(item.easiness))) : 2.5,
                    intervalDays: Number.isFinite(Number(item?.intervalDays)) ? Math.max(0, Math.trunc(Number(item.intervalDays))) : 0,
                    repetitions: Number.isFinite(Number(item?.repetitions)) ? Math.max(0, Math.trunc(Number(item.repetitions))) : 0,
                    dueAt: Number.isFinite(Number(item?.dueAt)) ? Math.max(0, Math.trunc(Number(item.dueAt))) : 0,
                    lastGrade: Number.isFinite(Number(item?.lastGrade)) ? Math.max(0, Math.min(5, Math.trunc(Number(item.lastGrade)))) : 0,
                    updatedAt: Number.isFinite(Number(item?.updatedAt)) ? Math.max(0, Math.trunc(Number(item.updatedAt))) : 0,
                };
            });
            return out;
        })();
        const _revisionLastSeenAt = new Map();

        function _saveSlideNotes() {
            const area = document.getElementById('notes-area');
            if (!area) return;
            const text = area.value;
            if (text.trim()) _notesData[String(currentIndex)] = text;
            else delete _notesData[String(currentIndex)];
            localSetJSON(NOTES_KEY, _notesData);
        }

        function _loadSlideNotes(idx) {
            const area = document.getElementById('notes-area');
            if (!area) return;
            area.value = _notesData[String(idx)] || '';
            area.placeholder = `Notes — slide ${idx + 1}\u2026`;
            _updateNotesLabel();
        }

        function _updateNotesLabel() {
            const label = document.getElementById('notes-summary-label');
            if (!label) return;
            const count = Object.keys(_notesData).length;
            label.textContent = count > 0 ? `Notes (${count} slide${count > 1 ? 's' : ''})` : 'Notes';
        }

        function saveBookmarks() {
            localSetJSON(BOOKMARKS_KEY, Array.from(_bookmarks.values()));
        }

        function bookmarksSorted() {
            return Array.from(_bookmarks.values())
                .map(v => Number(v))
                .filter(v => Number.isFinite(v) && v >= 0 && v < slidesHtml.length)
                .sort((a, b) => a - b);
        }

        function updateBookmarkControls() {
            const key = String(currentIndex);
            const markBtn = document.getElementById('bookmark-btn');
            const filterBtn = document.getElementById('bookmark-filter-btn');
            const countEl = document.getElementById('bookmark-count');
            if (markBtn) markBtn.classList.toggle('active', _bookmarks.has(key));
            if (filterBtn) {
                filterBtn.classList.toggle('active', _bookmarksOnly);
                filterBtn.disabled = _bookmarks.size === 0 && !_bookmarksOnly;
                filterBtn.title = _bookmarksOnly ? 'Quitter le mode favoris' : 'Afficher seulement les favoris';
            }
            if (countEl) countEl.textContent = String(_bookmarks.size);
            updateRevisionControls();
        }

        function saveRevisionState() {
            localSetJSON(REVISION_KEY, {
                version: 2,
                weeklyGoal: _revisionWeeklyGoal,
                weeklyProgress: _revisionWeeklyProgress,
                bySlide: _revisionStateBySlide,
                updatedAt: Date.now(),
            });
        }

        function revisionEntry(idx) {
            const key = String(idx);
            if (!_revisionStateBySlide[key]) {
                _revisionStateBySlide[key] = {
                    bucket: 'new',
                    seen: 0,
                    nextDue: 0,
                    easiness: 2.5,
                    intervalDays: 0,
                    repetitions: 0,
                    dueAt: 0,
                    lastGrade: 0,
                    updatedAt: 0,
                };
            }
            return _revisionStateBySlide[key];
        }

        function detectQuizSlides() {
            _quizSlides = new Set();
            slidesHtml.forEach((html, idx) => {
                if (typeof html !== 'string') return;
                if (html.includes('sl-quizlive-pending') || html.includes('sl-quizlive')) _quizSlides.add(idx);
            });
            detectCheckpointSlides();
        }

        function detectCheckpointSlides() {
            _checkpointRequiredSlides = new Set();
            slidesHtml.forEach((html, idx) => {
                if (typeof html !== 'string') return;
                const hasCheckpoint = html.includes('data-checkpoint-required="1"')
                    || html.includes('sl-quizlive-pending')
                    || html.includes('sl-polllive-pending')
                    || html.includes('sl-mcqsingle-pending')
                    || html.includes('sl-mcqmulti-pending')
                    || html.includes('sl-cloze-pending')
                    || html.includes('sl-dnd-pending')
                    || html.includes('sl-exitticket-pending')
                    || html.includes('sl-rankorder-pending');
                if (hasCheckpoint) _checkpointRequiredSlides.add(idx);
            });
            _checkpointCompletedSlides = new Set(
                Array.from(_checkpointCompletedSlides.values()).filter(idx => idx >= 0 && idx < slidesHtml.length)
            );
        }

        function currentSlideCheckpointLocked() {
            if (_followPresenter) return false;
            if (!_checkpointRequiredSlides.has(currentIndex)) return false;
            return !_checkpointCompletedSlides.has(currentIndex);
        }

        function updateCheckpointStatus() {
            const badge = document.getElementById('checkpoint-status');
            const nextBtn = document.getElementById('nav-next');
            if (!badge) return;
            const locked = currentSlideCheckpointLocked();
            badge.classList.toggle('active', locked);
            badge.title = locked
                ? 'Répondez au checkpoint de ce slide pour continuer'
                : '';
            if (nextBtn && !_followPresenter) {
                nextBtn.disabled = locked || currentIndex >= (slidesHtml.length - 1);
            }
        }

        function markCheckpointCompleted(idx = currentIndex, reason = '') {
            const safe = Number(idx);
            if (!Number.isFinite(safe) || safe < 0) return;
            _checkpointCompletedSlides.add(safe);
            updateCheckpointStatus();
            if (_checkpointRequiredSlides.has(safe) && typeof setConnectionDetail === 'function') {
                const detail = reason ? `Checkpoint validé (${reason})` : 'Checkpoint validé';
                setConnectionDetail(detail, 'ok');
            }
        }

        function enforceCheckpointBeforeNext(direction) {
            if (direction <= 0) return true;
            if (!currentSlideCheckpointLocked()) return true;
            updateCheckpointStatus();
            setConnectionDetail('Checkpoint requis avant le slide suivant', 'warn');
            return false;
        }

        function revisionDeck() {
            const set = new Set();
            _bookmarks.forEach(v => {
                const n = Number(v);
                if (Number.isFinite(n) && n >= 0 && n < slidesHtml.length) set.add(n);
            });
            _quizSlides.forEach(i => {
                if (i >= 0 && i < slidesHtml.length) set.add(i);
            });
            const arr = Array.from(set.values()).sort((a, b) => a - b);
            if (arr.length) return arr;
            return Array.from({ length: slidesHtml.length }, (_, i) => i);
        }

        function revisionBucketRank(bucket) {
            if (bucket === 'new') return 0;
            if (bucket === 'review') return 1;
            return 2;
        }

        function revisionOrderedDeck() {
            const now = Date.now();
            return revisionDeck().sort((a, b) => {
                const ea = revisionEntry(a);
                const eb = revisionEntry(b);
                const aDueAt = Number(ea.dueAt || ea.nextDue) || 0;
                const bDueAt = Number(eb.dueAt || eb.nextDue) || 0;
                const aDue = aDueAt <= now ? 0 : 1;
                const bDue = bDueAt <= now ? 0 : 1;
                if (aDue !== bDue) return aDue - bDue;
                const aRank = revisionBucketRank(ea.bucket);
                const bRank = revisionBucketRank(eb.bucket);
                if (aRank !== bRank) return aRank - bRank;
                if (aDueAt !== bDueAt) return aDueAt - bDueAt;
                return a - b;
            });
        }

        function revisionEnsureWeek() {
            const wk = revisionWeekKey();
            if (_revisionWeeklyProgress.weekKey !== wk) _revisionWeeklyProgress = { weekKey: wk, done: 0 };
        }

        function revisionStats() {
            const counts = { new: 0, review: 0, known: 0 };
            const deck = revisionDeck();
            const now = Date.now();
            let dueNow = 0;
            deck.forEach(idx => {
                const entry = revisionEntry(idx);
                const bucket = entry.bucket;
                if (bucket === 'review') counts.review += 1;
                else if (bucket === 'known') counts.known += 1;
                else counts.new += 1;
                const dueAt = Number(entry.dueAt || entry.nextDue) || 0;
                if (dueAt <= now) dueNow += 1;
            });
            revisionEnsureWeek();
            return {
                counts,
                total: deck.length,
                dueNow,
                weeklyDone: _revisionWeeklyProgress.done,
                weeklyGoal: _revisionWeeklyGoal,
            };
        }

        function hydrateFeedbackIcons() {
            document.querySelectorAll('.feedback-btn').forEach(btn => {
                const slot = btn.querySelector('.feedback-btn-icon');
                const key = String(btn.dataset.icon || '');
                if (!slot || !key) return;
                slot.innerHTML = icon(key);
            });
        }

        function updateRevisionControls() {
            const btn = document.getElementById('revision-btn');
            if (btn) btn.classList.toggle('active', _revisionEnabled);

            const bar = document.getElementById('revision-bar');
            if (bar) bar.style.display = _revisionEnabled ? 'flex' : 'none';

            const status = document.getElementById('revision-status');
            const stats = revisionStats();
            if (status) {
                status.innerHTML = `${icon('bookmark_star')}<span>Deck ${stats.total} · Due ${stats.dueNow} · N ${stats.counts.new} · R ${stats.counts.review} · K ${stats.counts.known} · Semaine ${stats.weeklyDone}/${stats.weeklyGoal}</span>`;
            }

            const currentBucket = revisionEntry(currentIndex).bucket;
            const markNew = document.getElementById('revision-mark-new');
            const markReview = document.getElementById('revision-mark-review');
            const markKnown = document.getElementById('revision-mark-known');
            const markEasy = document.getElementById('revision-mark-easy');
            const exportBtn = document.getElementById('revision-export');
            const importBtn = document.getElementById('revision-import');
            const exit = document.getElementById('revision-exit');

            if (markNew) {
                markNew.innerHTML = `${icon('refresh')}<span>Nouveau</span>`;
                markNew.classList.toggle('active', currentBucket === 'new');
            }
            if (markReview) {
                markReview.innerHTML = `${icon('clock')}<span>À revoir</span>`;
                markReview.classList.toggle('active', currentBucket === 'review');
            }
            if (markKnown) {
                markKnown.innerHTML = `${icon('check')}<span>Connu</span>`;
                markKnown.classList.toggle('active', currentBucket === 'known');
            }
            if (markEasy) {
                markEasy.innerHTML = `${icon('flash') || icon('check')}<span>Facile</span>`;
                markEasy.classList.toggle('active', currentBucket === 'known' && Number(revisionEntry(currentIndex).lastGrade) >= 5);
            }
            if (exportBtn) exportBtn.innerHTML = `${icon('download') || icon('copy')}<span>Export</span>`;
            if (importBtn) importBtn.innerHTML = `${icon('upload') || icon('refresh')}<span>Import</span>`;
            if (exit) exit.innerHTML = `${icon('close')}<span>Quitter</span>`;
        }

        function setRevisionMode(enabled) {
            _revisionEnabled = !!enabled;
            if (_revisionEnabled) {
                _followPresenter = false;
                _bookmarksOnly = false;
                document.getElementById('nav-follow')?.classList.remove('active');
                const ordered = revisionOrderedDeck();
                if (ordered.length && !ordered.includes(currentIndex)) showSlide(ordered[0]);
            }
            updateBookmarkControls();
            updateRevisionControls();
        }

        function applyRevisionGrade(entry, qualityRaw) {
            const now = Date.now();
            const quality = Math.max(0, Math.min(5, Math.trunc(Number(qualityRaw) || 0)));
            const prevBucket = entry.bucket;
            let reps = Number.isFinite(Number(entry.repetitions)) ? Math.max(0, Math.trunc(Number(entry.repetitions))) : 0;
            let intervalDays = Number.isFinite(Number(entry.intervalDays)) ? Math.max(0, Math.trunc(Number(entry.intervalDays))) : 0;
            let easiness = Number.isFinite(Number(entry.easiness)) ? Number(entry.easiness) : 2.5;

            if (quality < 3) {
                reps = 0;
                intervalDays = 0;
                entry.bucket = 'new';
                entry.nextDue = now + (5 * 60 * 1000);
                if (prevBucket === 'known' && _revisionWeeklyProgress.done > 0) {
                    _revisionWeeklyProgress.done = Math.max(0, _revisionWeeklyProgress.done - 1);
                }
            } else {
                reps += 1;
                if (reps === 1) intervalDays = 1;
                else if (reps === 2) intervalDays = 3;
                else {
                    const factor = quality === 3 ? Math.max(1.2, easiness * 0.85)
                        : quality === 4 ? easiness
                        : (easiness * 1.25);
                    intervalDays = Math.max(1, Math.round(Math.max(1, intervalDays) * factor));
                }
                easiness = Math.max(1.3, Math.min(3.2, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))));
                entry.bucket = quality >= 4 ? 'known' : 'review';
                entry.nextDue = now + (intervalDays * 24 * 60 * 60 * 1000);
                revisionEnsureWeek();
                if (quality >= 4 && prevBucket !== 'known') _revisionWeeklyProgress.done += 1;
            }

            entry.repetitions = reps;
            entry.intervalDays = intervalDays;
            entry.easiness = easiness;
            entry.dueAt = entry.nextDue;
            entry.lastGrade = quality;
            entry.updatedAt = now;
            entry.seen = Number(entry.seen || 0);
        }

        function markRevision(mode) {
            const qualityByMode = { new: 1, review: 3, known: 4, easy: 5 };
            const safeMode = Object.prototype.hasOwnProperty.call(qualityByMode, mode) ? mode : 'new';
            const quality = qualityByMode[safeMode];
            const entry = revisionEntry(currentIndex);
            applyRevisionGrade(entry, quality);
            saveRevisionState();
            updateRevisionControls();
            if (_revisionEnabled && quality >= 3) showRevisionStep(1);
        }

        function exportRevisionProgress() {
            revisionEnsureWeek();
            const payload = {
                version: 2,
                roomId,
                exportedAt: new Date().toISOString(),
                weeklyGoal: _revisionWeeklyGoal,
                weeklyProgress: _revisionWeeklyProgress,
                bySlide: _revisionStateBySlide,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `revision-${roomId}-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        }

        function importRevisionProgress(rawPayload) {
            if (!rawPayload || typeof rawPayload !== 'object') return false;
            const bySlide = rawPayload.bySlide;
            if (!bySlide || typeof bySlide !== 'object') return false;
            const imported = {};
            Object.entries(bySlide).forEach(([idx, item]) => {
                const slideIdx = Number(idx);
                if (!Number.isFinite(slideIdx) || slideIdx < 0) return;
                const bucket = REVISION_BUCKETS.includes(item?.bucket) ? item.bucket : 'new';
                imported[String(slideIdx)] = {
                    bucket,
                    seen: Number.isFinite(Number(item?.seen)) ? Math.max(0, Math.trunc(Number(item.seen))) : 0,
                    nextDue: Number.isFinite(Number(item?.nextDue)) ? Math.max(0, Math.trunc(Number(item.nextDue))) : 0,
                    easiness: Number.isFinite(Number(item?.easiness)) ? Math.max(1.3, Math.min(3.2, Number(item.easiness))) : 2.5,
                    intervalDays: Number.isFinite(Number(item?.intervalDays)) ? Math.max(0, Math.trunc(Number(item.intervalDays))) : 0,
                    repetitions: Number.isFinite(Number(item?.repetitions)) ? Math.max(0, Math.trunc(Number(item.repetitions))) : 0,
                    dueAt: Number.isFinite(Number(item?.dueAt)) ? Math.max(0, Math.trunc(Number(item.dueAt))) : 0,
                    lastGrade: Number.isFinite(Number(item?.lastGrade)) ? Math.max(0, Math.min(5, Math.trunc(Number(item.lastGrade)))) : 0,
                    updatedAt: Number.isFinite(Number(item?.updatedAt)) ? Math.max(0, Math.trunc(Number(item.updatedAt))) : 0,
                };
            });
            _revisionStateBySlide = imported;
            _revisionWeeklyGoal = Number.isFinite(Number(rawPayload.weeklyGoal))
                ? Math.max(1, Math.trunc(Number(rawPayload.weeklyGoal)))
                : _revisionWeeklyGoal;
            const wkRaw = rawPayload.weeklyProgress || {};
            const wk = toSafeString(wkRaw.weekKey, 20) || revisionWeekKey();
            const done = Number.isFinite(Number(wkRaw.done)) ? Math.max(0, Math.trunc(Number(wkRaw.done))) : 0;
            _revisionWeeklyProgress = { weekKey: wk, done };
            revisionEnsureWeek();
            saveRevisionState();
            updateRevisionControls();
            return true;
        }

        function showRevisionStep(direction) {
            const ordered = revisionOrderedDeck();
            if (!ordered.length) return;
            const pos = ordered.indexOf(currentIndex);
            if (pos === -1) {
                showSlide(direction > 0 ? ordered[0] : ordered[ordered.length - 1]);
                return;
            }
            const nextPos = (pos + (direction > 0 ? 1 : -1) + ordered.length) % ordered.length;
            showSlide(ordered[nextPos]);
        }

        function showByModeStep(direction) {
            if (!enforceCheckpointBeforeNext(direction)) return;
            if (_revisionEnabled) {
                showRevisionStep(direction);
                return;
            }
            if (!_bookmarksOnly) {
                showSlide(currentIndex + direction);
                return;
            }
            const list = bookmarksSorted();
            if (!list.length) {
                _bookmarksOnly = false;
                updateBookmarkControls();
                showSlide(currentIndex + direction);
                return;
            }
            const pos = list.indexOf(currentIndex);
            if (pos >= 0) {
                const nextPos = (pos + (direction > 0 ? 1 : -1) + list.length) % list.length;
                showSlide(list[nextPos]);
                return;
            }
            if (direction > 0) {
                const next = list.find(i => i > currentIndex);
                showSlide(next !== undefined ? next : list[0]);
                return;
            }
            const prev = [...list].reverse().find(i => i < currentIndex);
            showSlide(prev !== undefined ? prev : list[list.length - 1]);
        }

        // ── Utilities ────────────────────────────────────
        function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

        function setJoinStatus(msg, type) {
            const el = document.getElementById('join-status');
            if (el) { el.textContent = msg; el.className = 'status-msg ' + (type||''); }
        }

        function saveScore() {
            const data = { pseudo, score, quizCount, quizCorrect };
            sessionSetJSON(SCORE_KEY, data);
            localSetJSON(LS_KEY, data);
        }

        function updateScoreDisplay() {
            document.getElementById('score-pts').textContent = score.toLocaleString();
            document.getElementById('score-quizzes').textContent = `${quizCorrect}/${quizCount} quiz`;
        }

        function setConnectionDetail(text, tone = '') {
            const state = document.getElementById('conn-state');
            if (!state) return;
            state.textContent = String(text || '');
            state.classList.remove('ok', 'warn', 'error');
            if (tone) state.classList.add(tone);
            state.title = state.textContent;
        }

        function _safePseudoPart(name) {
            const safe = toSafeString(name, 40)
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
            return safe || 'anon';
        }

        function _setConnectionState(nextState, detail = '', tone = '') {
            const normalized = Object.values(CONNECTION_STATE).includes(nextState) ? nextState : CONNECTION_STATE.IDLE;
            _connectionState = normalized;
            _connectionStateSince = Date.now();

            const badge = document.getElementById('conn-badge');
            if (badge) {
                badge.classList.toggle('disconnected', normalized !== CONNECTION_STATE.CONNECTED);
                badge.classList.toggle('connecting', normalized === CONNECTION_STATE.CONNECTING);
                badge.classList.toggle('retrying', normalized === CONNECTION_STATE.RETRYING);
                badge.classList.toggle('offline', normalized === CONNECTION_STATE.OFFLINE);
                const titleMap = {
                    [CONNECTION_STATE.IDLE]: 'En attente',
                    [CONNECTION_STATE.CONNECTING]: 'Connexion en cours',
                    [CONNECTION_STATE.CONNECTED]: 'Connecté',
                    [CONNECTION_STATE.RETRYING]: 'Reconnexion en cours',
                    [CONNECTION_STATE.OFFLINE]: 'Hors ligne',
                };
                badge.title = titleMap[normalized] || 'État réseau';
            }

            const banner = document.getElementById('reconnect-banner');
            if (banner) {
                const showBanner = normalized === CONNECTION_STATE.CONNECTING
                    || normalized === CONNECTION_STATE.RETRYING
                    || normalized === CONNECTION_STATE.OFFLINE;
                banner.classList.toggle('visible', showBanner);
                if (!showBanner) banner.textContent = '';
            }

            const modeLabel = transportMode === 'relay' ? 'Relay' : 'P2P';
            const stateLabel = {
                [CONNECTION_STATE.IDLE]: `${modeLabel} · en attente`,
                [CONNECTION_STATE.CONNECTING]: `${modeLabel} · connexion…`,
                [CONNECTION_STATE.CONNECTED]: `${modeLabel} · connecté`,
                [CONNECTION_STATE.RETRYING]: `${modeLabel} · reconnexion…`,
                [CONNECTION_STATE.OFFLINE]: `${modeLabel} · hors ligne`,
            }[normalized] || `${modeLabel} · état inconnu`;
            const stateTone = tone || (
                normalized === CONNECTION_STATE.CONNECTED ? 'ok'
                    : normalized === CONNECTION_STATE.OFFLINE ? 'error'
                        : 'warn'
            );
            setConnectionDetail(detail || stateLabel, stateTone);
        }

        function _persistReliableQueue() {
            if (!_reliableQueueKey) return;
            const entries = Array.from(pendingAcks.values()).map(rec => ({
                rid: rec.rid,
                payload: rec.payload,
                retries: Number(rec.retries) || 0,
                maxRetries: Number(rec.maxRetries) || 3,
                retryDelay: Number(rec.retryDelay) || 1300,
                createdAt: Number(rec.createdAt) || Date.now(),
                lastSentAt: Number(rec.lastSentAt) || 0,
            }));
            if (!entries.length) {
                sessionRemove(_reliableQueueKey);
                return;
            }
            sessionSetJSON(_reliableQueueKey, entries.slice(0, 160));
        }

        function _restoreReliableQueue() {
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            const saved = sessionGetJSON(_reliableQueueKey, []);
            if (!Array.isArray(saved)) return;
            saved.slice(0, 160).forEach(raw => {
                if (!raw || typeof raw !== 'object') return;
                const rid = toSafeString(raw.rid, 120);
                const payload = (raw.payload && typeof raw.payload === 'object')
                    ? Object.assign({}, raw.payload)
                    : null;
                if (!rid || !payload || !toSafeString(payload.type, 80)) return;
                payload.rid = rid;
                payload.ts = Number(payload.ts) || Date.now();
                pendingAcks.set(rid, {
                    rid,
                    payload,
                    retries: Math.max(0, Number(raw.retries) || 0),
                    maxRetries: Math.max(1, Number(raw.maxRetries) || 3),
                    retryDelay: Math.max(500, Number(raw.retryDelay) || 1300),
                    createdAt: Number(raw.createdAt) || Date.now(),
                    lastSentAt: Number(raw.lastSentAt) || 0,
                    timer: null,
                });
            });
            if (pendingAcks.size) _persistReliableQueue();
        }

        function _setReliableQueueScope(nextPseudo) {
            const nextKey = RELIABLE_QUEUE_PREFIX + _safePseudoPart(nextPseudo);
            if (nextKey === _reliableQueueKey) return;
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            _reliableQueueKey = nextKey;
            _restoreReliableQueue();
        }

        function _scheduleReliableRetry(rid, immediate = false) {
            const safeRid = toSafeString(rid, 120);
            if (!safeRid) return;
            const rec = pendingAcks.get(safeRid);
            if (!rec) return;
            if (rec.timer) {
                clearTimeout(rec.timer);
                rec.timer = null;
            }
            const runAttempt = () => {
                const current = pendingAcks.get(safeRid);
                if (!current) return;
                if (current.retries >= current.maxRetries) {
                    clearPendingAck(safeRid);
                    if (_connectionState === CONNECTION_STATE.CONNECTED) {
                        const mode = transportMode === 'relay' ? 'Relay' : 'P2P';
                        setConnectionDetail(`${mode} · message non confirmé`, 'warn');
                    }
                    return;
                }
                const canSend = transportCanSend();
                if (canSend && transportSend(current.payload)) {
                    current.retries += 1;
                    current.lastSentAt = Date.now();
                    _persistReliableQueue();
                }
                const nextDelay = canSend ? current.retryDelay : Math.min(current.retryDelay, 1800);
                current.timer = setTimeout(runAttempt, nextDelay);
            };
            if (immediate) {
                runAttempt();
                return;
            }
            rec.timer = setTimeout(runAttempt, rec.retryDelay);
        }

        function _flushReliableQueue(reason = '') {
            if (!pendingAcks.size) return;
            const canSend = transportCanSend();
            for (const rid of pendingAcks.keys()) _scheduleReliableRetry(rid, canSend);
            if (reason && canSend) {
                const mode = transportMode === 'relay' ? 'Relay' : 'P2P';
                setConnectionDetail(`${mode} · reprise (${pendingAcks.size} msg)`, 'warn');
            }
        }

        function _startConnectionWatchdog() {
            if (_connectionWatchdogTimer) return;
            _connectionWatchdogTimer = setInterval(() => {
                if (document.hidden || !pseudo) return;
                if (_connectionState === CONNECTION_STATE.CONNECTED || _connectionState === CONNECTION_STATE.IDLE) return;
                const elapsed = Date.now() - _connectionStateSince;
                if (elapsed < 22000) return;
                const hasReconnectPath = !!(_reconnectTimer || _connOpenTimer || _peerOpenTimer);
                if (hasReconnectPath) return;
                const now = Date.now();
                if (now < _forceReconnectCooldownUntil) return;
                _forceReconnectCooldownUntil = now + 8000;
                forceReconnectNow('watchdog');
            }, 3500);
        }

        function setConnected(connected) {
            _setConnectionState(connected ? CONNECTION_STATE.CONNECTED : CONNECTION_STATE.RETRYING);
        }

        function transportCanSend() {
            return !!(conn && conn.open);
        }

        function transportSend(message) {
            if (!transportCanSend()) return false;
            try {
                conn.send(message);
                return true;
            } catch (e) {
                return false;
            }
        }

        function clearPendingAck(rid) {
            const safeRid = toSafeString(rid, 120);
            if (!safeRid) return;
            const pending = pendingAcks.get(safeRid);
            if (pending?.timer) clearTimeout(pending.timer);
            pendingAcks.delete(safeRid);
            _persistReliableQueue();
        }

        function clearAllPendingAcks(options = {}) {
            for (const pending of pendingAcks.values()) {
                if (pending?.timer) clearTimeout(pending.timer);
            }
            pendingAcks.clear();
            if (options.purgeStorage) {
                sessionRemove(_reliableQueueKey);
                return;
            }
            _persistReliableQueue();
        }

        function sendReliable(message, options = {}) {
            if (!message || typeof message !== 'object') return null;
            const rid = toSafeString(message.rid, 120) || nextRid();
            const maxRetries = Math.max(1, Number(options.maxRetries ?? 3) || 1);
            const retryDelay = Math.max(500, Number(options.retryDelay ?? 1300) || 1300);
            const payload = Object.assign({}, message, { rid, ts: message.ts || Date.now() });
            const prev = pendingAcks.get(rid);
            if (prev?.timer) clearTimeout(prev.timer);
            pendingAcks.set(rid, {
                rid,
                payload,
                retries: 0,
                maxRetries,
                retryDelay,
                createdAt: Number(prev?.createdAt) || Date.now(),
                lastSentAt: Number(prev?.lastSentAt) || 0,
                timer: null,
            });
            _persistReliableQueue();
            _scheduleReliableRetry(rid, true);
            return rid;
        }

        function showAudienceNudge(kind, text) {
            const toast = document.getElementById('nudge-toast');
            if (!toast) return;
            const iconByKind = {
                question: 'question',
                hand: 'hand',
                poll: 'poll',
                cloud: 'cloud',
            };
            const iconKey = iconByKind[String(kind || '').toLowerCase()] || 'question';
            const message = String(text || '').trim() || 'Le presentateur vous relance.';
            toast.innerHTML = `${icon(iconKey)}<span>${esc(message)}</span>`;
            toast.classList.add('show');
            if (_nudgeTimer) clearTimeout(_nudgeTimer);
            _nudgeTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 2600);
        }

        function updateFeedbackUI() {
            const now = Date.now();
            const disabled = now < _feedbackCooldownUntil;
            document.querySelectorAll('.feedback-btn').forEach(btn => { btn.disabled = disabled; });
            const sent = document.getElementById('feedback-sent');
            if (!sent) return;
            if (!disabled) {
                sent.textContent = '';
                return;
            }
            const remain = Math.max(0, Math.ceil((_feedbackCooldownUntil - now) / 1000));
            sent.textContent = `${remain}s`;
        }

        function sendDiscreteFeedback(kind, text) {
            if (Date.now() < _feedbackCooldownUntil) return;
            if (!transportCanSend()) return;
            sendReliable({
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

        // ── Slide rendering ───────────────────────────────
        function scaleSlide() {
            const frame = document.getElementById('slide-frame');
            const inner = document.getElementById('slide-inner');
            if (!frame || !inner) return;
            const host = frame.parentElement || frame;
            const fw = Math.max(0, host.clientWidth || 0);
            const fh = Math.max(0, host.clientHeight || 0);
            if (!fw || !fh) return;
            const scale = Math.max(0.05, Math.min(fw / 1280, fh / 720));
            frame.style.width = Math.round(1280 * scale) + 'px';
            frame.style.height = Math.round(720 * scale) + 'px';
            inner.style.transform = `scale(${scale})`;
        }

        function showSlide(idx) {
            _saveSlideNotes();
            if (idx < 0 || idx >= slidesHtml.length) return;
            currentIndex = idx;
            const inner = document.getElementById('slide-inner');
            const counter = document.getElementById('slide-counter');
            if (!inner) return;

            inner.innerHTML = slidesHtml[idx];
            applyFragmentProgress(-1);
            if (counter) counter.textContent = `${idx + 1} / ${slidesHtml.length}`;
            // Sync nav bar
            const navCounter = document.getElementById('slide-counter-nav');
            if (navCounter) navCounter.textContent = `${idx + 1} / ${slidesHtml.length}`;
            const prevBtn = document.getElementById('nav-prev');
            const nextBtn = document.getElementById('nav-next');
            if (prevBtn) prevBtn.disabled = idx === 0;
            if (nextBtn) nextBtn.disabled = idx === slidesHtml.length - 1;
            scaleSlide();
            mountCodeLive(inner);
            mountStudentWidgets(inner);
            _loadSlideNotes(idx);
            updateBookmarkControls();
            if (_revisionEnabled) {
                const now = Date.now();
                const prevSeen = Number(_revisionLastSeenAt.get(idx) || 0);
                if ((now - prevSeen) > 1500) {
                    const entry = revisionEntry(idx);
                    entry.seen = Number(entry.seen || 0) + 1;
                    _revisionLastSeenAt.set(idx, now);
                    saveRevisionState();
                }
            }
            updateRevisionControls();
            updateCheckpointStatus();
        }

        function applyFragmentProgress(step) {
            const inner = document.getElementById('slide-inner');
            if (!inner) return;
            const frags = Array.from(inner.querySelectorAll('.fragment'));
            const max = Number.isFinite(Number(step)) ? Math.trunc(Number(step)) : -1;
            currentFragmentOrder = max;
            frags.forEach((frag, i) => {
                const visible = i <= max;
                frag.classList.toggle('visible', visible);
                frag.classList.toggle('current-fragment', i === max && max >= 0);
            });
        }

        // ── Widget mount (OEI interactive widgets) ────────
        async function mountStudentWidgets(container) {
            const reg = window.OEI_WIDGET_REGISTRY;
            if (!reg) return;
            const slots = container.querySelectorAll('.sl-sim-container[data-widget]');
            if (!slots.length) return;
            // Stubs needed by Page-based widget classes (TcpHandshakePage, etc.)
            if (!window.ConceptPage) window.ConceptPage = class { constructor() {} async init() {} };
            if (!window.SimulationPage) window.SimulationPage = window.ConceptPage;
            if (!window.ExerciseRunnerPage) window.ExerciseRunnerPage = window.ConceptPage;
            for (const slot of slots) {
                if (slot.dataset.mounted) continue;
                const wid = slot.dataset.widget;
                if (!wid) continue;
                const entry = reg[wid];
                if (!entry) continue;
                try {
                    if (!window[entry.global]) {
                        await new Promise((res, rej) => {
                            const s = document.createElement('script');
                            s.src = `../shared/components/${entry.script}?v=${studentWidgetScriptVersion}`;
                            s.onload = res; s.onerror = rej;
                            document.head.appendChild(s);
                        });
                    }
                    const cls = window[entry.global];
                    if (!cls || typeof cls.mount !== 'function') continue;
                    const config = JSON.parse(slot.dataset.config || '{}');
                    cls.mount(slot, Object.assign({}, config, { type: wid }));
                    slot.dataset.mounted = '1';
                    // Interactivity badge
                    const badge = document.createElement('div');
                    badge.className = 'widget-interactive-badge';
                    badge.textContent = 'Interactif';
                    slot.classList.add('widget-slot-has-badge');
                    slot.appendChild(badge);
                } catch(e) {
                    console.warn('Widget mount error (student):', wid, e);
                }
            }
        }

        // ── Code Live (JS execution on student side) ──────
        function mountCodeLive(container) {
            container.querySelectorAll('.sl-codelive-pending').forEach(el => {
                if (el.dataset.studentBound) return;
                el.dataset.studentBound = '1';
                const lang = el.dataset.lang || 'javascript';
                const textarea = el.querySelector('textarea') || el.querySelector('.sl-code-area');
                const btnRun = el.querySelector('.sl-code-run') || el.querySelector('.sl-run-btn') || el.querySelector('button');
                const consoleEl = el.querySelector('.sl-code-console') || el.querySelector('.sl-console');
                if (!textarea || !btnRun || !consoleEl) return;

                textarea.readOnly = false;

                btnRun.addEventListener('click', e => {
                    e.stopPropagation(); e.preventDefault();
                    consoleEl.textContent = '';
                    if (lang === 'javascript' || lang === 'js') {
                        runJS(textarea.value, consoleEl);
                    } else {
                        consoleEl.textContent = '⚠️ Exécution Python non disponible en mode étudiant';
                    }
                });
            });
        }

        async function runJS(code, consoleEl) {
            const appendOut = (text, color) => {
                const span = document.createElement('span');
                if (color) span.style.color = color;
                span.textContent = text + '\n';
                consoleEl.appendChild(span);
            };
            if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || !URL?.createObjectURL) {
                appendOut('❌ Sandbox JavaScript indisponible');
                return;
            }
            const workerSource = [
                'const _s=(v)=>{if(typeof v==="string")return v;try{return JSON.stringify(v);}catch(_){return String(v);}};',
                'const _logs=[];',
                'const _push=(type,args)=>{_logs.push({type,text:Array.from(args||[]).map(_s).join(" ")});};',
                'console.log=(...a)=>_push("log",a);',
                'console.warn=(...a)=>_push("warn",a);',
                'console.error=(...a)=>_push("error",a);',
                'self.onmessage=async(ev)=>{',
                '  const code=String(ev?.data?.code||"");',
                '  try {',
                '    let result=(0,eval)(code);',
                '    if (result && typeof result.then==="function") result=await result;',
                '    self.postMessage({ok:true,logs:_logs,result:result===undefined?"__oei_undefined__":_s(result)});',
                '  } catch (err) {',
                '    self.postMessage({ok:false,logs:_logs,error:err?.message||String(err)});',
                '  }',
                '};'
            ].join('\n');
            const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
            const worker = new Worker(workerUrl);
            let settled = false;
            const closeWorker = () => {
                if (settled) return;
                settled = true;
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
            };
            const colorForType = (type) => {
                if (type === 'error') return '#f87171';
                if (type === 'warn') return '#fbbf24';
                return 'var(--sl-text,#cbd5e1)';
            };
            const timeout = setTimeout(() => {
                closeWorker();
                appendOut('❌ Exécution interrompue (timeout)', '#f87171');
            }, 2500);
            worker.onmessage = (event) => {
                clearTimeout(timeout);
                const payload = event?.data || {};
                const logs = Array.isArray(payload.logs) ? payload.logs : [];
                logs.forEach(log => appendOut(String(log.text || ''), colorForType(log.type)));
                if (payload.ok) {
                    if (payload.result !== '__oei_undefined__') appendOut(`→ ${String(payload.result)}`, '#a5b4fc');
                } else {
                    appendOut(`❌ ${String(payload.error || 'Erreur JavaScript')}`, '#f87171');
                }
                closeWorker();
            };
            worker.onerror = (event) => {
                clearTimeout(timeout);
                closeWorker();
                appendOut(`❌ Sandbox JavaScript: ${String(event?.message || 'Erreur worker')}`, '#f87171');
            };
            worker.postMessage({ code: String(code || '') });
        }

        // ── Quiz UI ────────────────────────────────────────
        function showQuiz(data) {
            if (quizActive) return;
            quizActive = true;
            quizAnswered = false;
            quizSelectedAnswer = null;
            quizData = data;
            quizStartTime = Date.now();

            const overlay = document.getElementById('quiz-overlay');
            overlay.innerHTML = '';
            const duration = parseInt(data.duration) || 30;
            let remaining = duration;

            // Header row (label + timer)
            const headerDiv = document.createElement('div');
            headerDiv.className = 'quiz-header';
            headerDiv.innerHTML = `<span class="quiz-label quiz-label-inline"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9.1 9a3 3 0 1 1 5.8 1c-.6 1-1.7 1.4-2.4 2.2-.4.4-.5.8-.5 1.3"/><circle cx="12" cy="17" r="1"/></svg><span>Quiz</span></span><span class="quiz-timer" id="qt-timer">${remaining}s</span>`;
            overlay.appendChild(headerDiv);

            // Question text
            const qDiv = document.createElement('div');
            qDiv.className = 'quiz-question';
            qDiv.textContent = data.question || 'Question';
            overlay.appendChild(qDiv);

            // Options
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

            // Result area
            const resultDiv = document.createElement('div');
            resultDiv.id = 'qt-result';
            overlay.appendChild(resultDiv);

            overlay.classList.add('active');

            // Countdown timer
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

        function selectAnswer(index, optEl, optsDiv, data, remaining) {
            if (quizAnswered) return;
            quizAnswered = true;
            quizSelectedAnswer = index;
            clearInterval(quizTimerInterval);

            optsDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
            optEl.classList.add('selected');

            // Calculate score at answer time (before network delay)
            const duration = parseInt(data.duration) || 30;
            const responseTime = Math.min((Date.now() - quizStartTime) / 1000, duration);
            const timeBonus = Math.max(0.5, 1 - (responseTime / duration) * 0.5);
            quizEarnedPoints = Math.round(1000 * timeBonus);

            // Send answer to presenter
            sendReliable({ type: ROOM_MSG.QUIZ_ANSWER, quizId: data.quizId, answer: index, timestamp: Date.now() }, { maxRetries: 2, retryDelay: 1200 });
            markCheckpointCompleted(currentIndex, 'quiz');

            const resultDiv = document.getElementById('qt-result');
            if (resultDiv) resultDiv.innerHTML = '<div class="quiz-result-banner sent">✓ Réponse envoyée ! En attente des résultats…</div>';
        }

        function timeoutQuiz(optsDiv) {
            quizAnswered = false;
            if (optsDiv) optsDiv.querySelectorAll('.quiz-option').forEach(o => o.classList.add('disabled'));
            const resultDiv = document.getElementById('qt-result');
            if (resultDiv) resultDiv.innerHTML = '<div class="quiz-result-banner timeout">⏰ Temps écoulé</div>';
        }

        function endQuiz(data) {
            clearInterval(quizTimerInterval);
            const overlay = document.getElementById('quiz-overlay');
            const correctAnswer = data.correctAnswer ?? -1;
            quizCount++;

            // Reveal correct answer in options
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
            updateScoreDisplay();

            // Report score to presenter for leaderboard
            sendReliable({ type: ROOM_MSG.STUDENT_SCORE, score, quizCount, quizCorrect, pseudo }, { maxRetries: 3, retryDelay: 1500 });

            // Auto-hide quiz overlay after 3.5 s
            setTimeout(() => {
                overlay.classList.remove('active');
                quizActive = false;
                quizData = null;
            }, 3500);
        }

        // ── PeerJS / Relay connection ──────────────────────
        let _buildConnPending = false;
        let _reconnectTimer = null;
        let _connOpenTimer = null;
        let _peerOpenTimer = null;
        let _lastConnectError = '';

        function clearConnOpenTimer() {
            if (_connOpenTimer) {
                clearTimeout(_connOpenTimer);
                _connOpenTimer = null;
            }
        }

        function clearReconnectTimer() {
            if (_reconnectTimer) {
                clearTimeout(_reconnectTimer);
                _reconnectTimer = null;
            }
        }

        function clearPeerOpenTimer() {
            if (_peerOpenTimer) {
                clearTimeout(_peerOpenTimer);
                _peerOpenTimer = null;
            }
        }

        function setReconnectMessage(reason, delayMs = 0, forcedMode = '') {
            const waitEl = document.getElementById('waiting-text');
            const banner = document.getElementById('reconnect-banner');
            const mode = (forcedMode || transportMode) === 'relay' ? 'Relay' : 'P2P';
            const left = delayMs > 0 ? ` · retry ${Math.max(1, Math.round(delayMs / 1000))}s` : '';
            const safeReason = toSafeString(reason || _lastConnectError || 'reconnexion', 80);
            const text = `${mode} · ${safeReason}${left}`;
            if (waitEl) waitEl.textContent = text;
            if (banner) banner.textContent = `Connexion instable — ${text}`;
            _setConnectionState(CONNECTION_STATE.RETRYING, text, 'warn');
        }

        function relaySocketReady() {
            return !!(relaySocket && relaySocket.readyState === WebSocket.OPEN);
        }

        function closeRelaySocket(resetTransport = true) {
            relayOpen = false;
            if (conn && conn.__transport === 'relay') conn.open = false;
            if (relaySocket) {
                try { relaySocket.close(); } catch (e) {}
                relaySocket = null;
            }
            if (resetTransport && transportMode === 'relay') transportMode = 'p2p';
        }

        function relaySendEnvelope(type, message, extra = {}) {
            if (!relaySocketReady()) return false;
            const payload = Object.assign({
                type,
                roomId,
                token: RELAY_OPTIONS.token || '',
                from: relayClientId,
                at: Date.now(),
            }, extra || {});
            if (message && typeof message === 'object') payload.message = message;
            try {
                relaySocket.send(JSON.stringify(payload));
                return true;
            } catch (e) {
                return false;
            }
        }

        function relayConnSend(message) {
            return relaySendEnvelope('relay:up', message);
        }

        function connectViaRelay(reason = '') {
            if (!RELAY_OPTIONS.enabled || !RELAY_OPTIONS.wsUrl) return false;
            clearConnOpenTimer();
            clearPeerOpenTimer();
            _buildConnPending = false;
            if (peer && !peer.destroyed) { try { peer.destroy(); } catch (e) {} }
            peer = null;
            closeRelaySocket(false);
            transportMode = 'relay';
            _setConnectionState(CONNECTION_STATE.CONNECTING, 'Relay · connexion…', 'warn');
            setReconnectMessage(reason || 'fallback relay');
            try {
                relaySocket = new WebSocket(RELAY_OPTIONS.wsUrl);
            } catch (e) {
                _lastConnectError = 'relay-init';
                scheduleReconnect(_lastConnectError);
                return false;
            }

            relaySocket.addEventListener('open', () => {
                relayOpen = true;
                reconnectAttempts = 0;
                _lastConnectError = '';
                clearReconnectTimer();
                conn = {
                    open: true,
                    __transport: 'relay',
                    peer: `relay:${relayClientId}`,
                    send: relayConnSend,
                    close: () => closeRelaySocket(true),
                };
                relaySendEnvelope('relay:join', null, { role: 'student', clientId: relayClientId, pseudo });
                setConnected(true);
                sendReliable({ type: ROOM_MSG.STUDENT_JOIN, pseudo }, { maxRetries: 4, retryDelay: 1200 });
                _flushReliableQueue('relay-open');
                requestResync('reconnect-relay');
                saveScore();
            });

            relaySocket.addEventListener('message', ev => {
                let payload = null;
                try { payload = JSON.parse(String(ev.data || '')); } catch (e) { return; }
                const packets = Array.isArray(payload) ? payload : [payload];
                packets.forEach(packet => {
                    if (!packet || typeof packet !== 'object') return;
                    const target = toSafeString(packet.to ?? packet.clientIdTo, 120);
                    if (target && target !== relayClientId && target !== '*' && target !== 'all') return;
                    const msg = (packet.message && typeof packet.message === 'object')
                        ? packet.message
                        : ((packet.payload && typeof packet.payload === 'object') ? packet.payload : null);
                    if (msg) {
                        handleMessage(msg);
                        return;
                    }
                    if (validateRoomMessage(packet)) {
                        handleMessage(packet);
                    }
                });
            });

            relaySocket.addEventListener('close', () => {
                relayOpen = false;
                if (conn && conn.__transport === 'relay') conn.open = false;
                setConnected(false);
                scheduleReconnect('relay fermé');
            });

            relaySocket.addEventListener('error', () => {
                relayOpen = false;
                _lastConnectError = 'relay-error';
                setConnected(false);
                scheduleReconnect(_lastConnectError);
            });
            return true;
        }

        function buildConn() {
            if (_buildConnPending) return;
            if (conn && conn.open) return;
            if (!peer || peer.destroyed || peer.disconnected) {
                reconnectSignaling();
                return;
            }
            if (conn && !conn.open && typeof conn.close === 'function') {
                try { conn.close(); } catch (e) {}
            }
            _buildConnPending = true;
            conn = peer.connect(roomId, { reliable: true });
            clearConnOpenTimer();
            _connOpenTimer = setTimeout(() => {
                if (!_buildConnPending) return;
                _lastConnectError = 'timeout';
                _buildConnPending = false;
                try { conn?.close(); } catch (e) {}
                setConnected(false);
                scheduleReconnect(_lastConnectError);
            }, 12000);

            conn.on('open', () => {
                clearConnOpenTimer();
                clearReconnectTimer();
                closeRelaySocket(false);
                transportMode = 'p2p';
                _buildConnPending = false;
                reconnectAttempts = 0;
                _lastConnectError = '';
                setConnected(true);
                sendReliable({ type: ROOM_MSG.STUDENT_JOIN, pseudo }, { maxRetries: 4, retryDelay: 1200 });
                _flushReliableQueue('p2p-open');
                requestResync('reconnect-p2p');
                saveScore();
            });

            conn.on('data', handleMessage);

            conn.on('close', () => {
                clearConnOpenTimer();
                _buildConnPending = false;
                setConnected(false);
                scheduleReconnect('connexion fermée');
            });

            conn.on('error', err => {
                clearConnOpenTimer();
                _buildConnPending = false;
                setConnected(false);
                _lastConnectError = toSafeString(err?.type || err?.message || 'error', 80);
                scheduleReconnect(_lastConnectError);
            });
        }

        function scheduleReconnect(reason = '') {
            if (_reconnectTimer) return;
            const preferRelay = typeof NetworkSession.shouldPreferRelay === 'function'
                ? NetworkSession.shouldPreferRelay(
                    reconnectAttempts,
                    reason,
                    transportMode,
                    RELAY_OPTIONS,
                    RELAY_FALLBACK_ATTEMPT
                )
                : (!!(RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl)
                    && (transportMode === 'relay'
                        || reconnectAttempts >= RELAY_FALLBACK_ATTEMPT
                        || String(reason).includes('peer-unavailable')));
            if (reconnectAttempts >= MAX_RECONNECT) {
                if (preferRelay && transportMode !== 'relay') {
                    connectViaRelay('fallback final');
                    return;
                }
                const waitEl = document.getElementById('waiting-text');
                const text = 'Connexion impossible. Réseau bloquant WebRTC (ex: eduroam). Essayez 4G/partage ou relayWs.';
                if (waitEl) waitEl.textContent = text;
                _setConnectionState(CONNECTION_STATE.OFFLINE, 'Connexion impossible (P2P/relay)', 'error');
                return;
            }
            reconnectAttempts++;
            const delay = reconnectDelayMsShared(reconnectAttempts);
            const mode = preferRelay ? 'relay' : 'p2p';
            setReconnectMessage(reason || `tentative ${reconnectAttempts}/${MAX_RECONNECT}`, delay, mode);
            _reconnectTimer = setTimeout(() => {
                _reconnectTimer = null;
                if (preferRelay) {
                    connectViaRelay(reason || 'fallback');
                    return;
                }
                forceReconnectNow(reason || 'retry');
            }, delay);
        }

        function reconnectSignaling() {
            if (!peer || peer.destroyed) { connectToPeer(); return; }
            try { peer.reconnect(); } catch (e) { connectToPeer(); }
        }

        function forceReconnectNow(reason = '') {
            clearConnOpenTimer();
            clearReconnectTimer();
            clearPeerOpenTimer();
            _buildConnPending = false;
            if (conn && typeof conn.close === 'function') {
                try { conn.close(); } catch (e) {}
            }
            conn = null;
            if (transportMode === 'relay' && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                connectViaRelay(reason || 'force-reconnect');
                return;
            }
            connectToPeer();
        }

        function connectToPeer() {
            transportMode = 'p2p';
            closeRelaySocket(false);
            if (peer && !peer.destroyed) { try { peer.destroy(); } catch (e) {} }
            clearConnOpenTimer();
            clearPeerOpenTimer();
            _buildConnPending = false;
            _setConnectionState(CONNECTION_STATE.CONNECTING, 'P2P · connexion…', 'warn');
            peer = new Peer(undefined, PEER_OPTIONS);

            _peerOpenTimer = setTimeout(() => {
                _peerOpenTimer = null;
                if (!conn || !conn.open) {
                    try { peer?.destroy?.(); } catch (e) {}
                    peer = null;
                    setConnected(false);
                    _lastConnectError = 'signalisation-timeout';
                    scheduleReconnect(_lastConnectError);
                }
            }, 10000);

            peer.on('open', () => {
                clearPeerOpenTimer();
                clearReconnectTimer();
                buildConn();
            });

            peer.on('disconnected', () => {
                clearPeerOpenTimer();
                setConnected(false);
                scheduleReconnect('signalisation perdue');
            });

            peer.on('error', e => {
                clearPeerOpenTimer();
                setConnected(false);
                _lastConnectError = toSafeString(e?.type || e?.message || 'peer-error', 80);
                if (e?.type === 'peer-unavailable' && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                    scheduleReconnect('peer-unavailable');
                    return;
                }
                scheduleReconnect(_lastConnectError);
            });
        }

        // ── Réveil écran (Page Visibility API) ────────────
        document.addEventListener('visibilitychange', () => {
            if (!pseudo) return;
            if (document.hidden) return;
            if (conn && conn.open) {
                _flushReliableQueue('resume-visible');
                requestResync('resume');
                return;
            }
            reconnectAttempts = 0;
            _buildConnPending = false;
            clearConnOpenTimer();
            clearReconnectTimer();
            clearPeerOpenTimer();
            forceReconnectNow('resume');
        });

        window.addEventListener('online', () => {
            if (!pseudo) return;
            if (conn && conn.open) {
                _flushReliableQueue('online');
                requestResync('online');
                return;
            }
            reconnectAttempts = 0;
            forceReconnectNow('online');
        });

        window.addEventListener('offline', () => {
            if (!pseudo) return;
            _setConnectionState(CONNECTION_STATE.OFFLINE, 'Réseau local indisponible', 'error');
        });

        function handleMessage(msg) {
            if (!msg?.type) return;
            if (!validateRoomMessage(msg)) return;

            switch (msg.type) {
                case ROOM_MSG.ACK:
                    clearPendingAck(msg.rid);
                    break;

                case ROOM_MSG.WELCOME:
                    if (msg.title) {
                        document.getElementById('header-title').textContent = msg.title;
                        document.title = msg.title + ' — Étudiant';
                    }
                    break;

                case ROOM_MSG.INIT: {
                    // Apply presentation theme CSS (scope .reveal → #slide-inner)
                    if (msg.themeCSS) document.getElementById('presentation-theme').textContent = msg.themeCSS.replace(/\.reveal/g, '#slide-inner');
                    // Store slides
                    slidesHtml = msg.slidesHtml || [];
                    detectQuizSlides();
                    // Switch to main view
                    document.getElementById('join-screen').style.display = 'none';
                    document.getElementById('main-view').style.display = 'flex';
                    document.getElementById('waiting-overlay').classList.remove('active');
                    document.getElementById('score-pseudo').textContent = pseudo;
                    updateScoreDisplay();
                    setConnected(true);
                    // Show current slide
                    const initIndex = typeof msg.currentIndex === 'number' ? msg.currentIndex : 0;
                    if (_revisionEnabled) {
                        const deck = revisionOrderedDeck();
                        const start = deck.includes(initIndex) ? initIndex : (deck[0] ?? initIndex);
                        showSlide(start);
                    } else {
                        showSlide(initIndex);
                    }
                    const initFragOrder = toSafeInt(msg.currentFragmentOrder ?? msg.currentFragmentIndex);
                    if (initFragOrder !== null) applyFragmentProgress(initFragOrder);
                    updateRevisionControls();
                    break;
                }

                case ROOM_MSG.SLIDE_CHANGE:
                    if (typeof msg.index === 'number') {
                        _presenterIndex = msg.index;
                        // Dismiss active quiz when slide changes
                        if (quizActive) {
                            clearInterval(quizTimerInterval);
                            document.getElementById('quiz-overlay').classList.remove('active');
                            quizActive = false;
                        }
                        if (_followPresenter) {
                            showSlide(msg.index);
                            const fragOrder = toSafeInt(msg.fragmentOrder ?? msg.fragmentIndex);
                            if (fragOrder !== null) applyFragmentProgress(fragOrder);
                        }
                    }
                    break;

                case ROOM_MSG.SLIDE_FRAGMENT: {
                    if (!_followPresenter) break;
                    const slideIdx = toSafeInt(msg.index);
                    if (slideIdx !== null && slideIdx !== currentIndex) break;
                    const hidden = msg.hidden === true || msg.hidden === 1 || String(msg.hidden || '').toLowerCase() === 'true';
                    const order = toSafeInt(msg.fragmentOrder);
                    if (order !== null) {
                        applyFragmentProgress(hidden ? (order - 1) : order);
                        break;
                    }
                    const inner = document.getElementById('slide-inner');
                    if (!inner) break;
                    const frags = Array.from(inner.querySelectorAll('.fragment'));
                    // fragmentIndex may be a string or number; match on data-fragment-index or DOM order
                    let target = null;
                    if (msg.fragmentIndex !== null && msg.fragmentIndex !== undefined) {
                        target = inner.querySelector(`.fragment[data-fragment-index="${msg.fragmentIndex}"]`);
                    }
                    if (!target && frags.length > 0) {
                        // Fallback: treat as ordered index
                        const idx = toSafeInt(msg.fragmentIndex);
                        if (idx !== null) target = frags[idx];
                    }
                    if (target) {
                        if (hidden) {
                            target.classList.remove('visible', 'current-fragment');
                        } else {
                            target.classList.add('visible', 'current-fragment');
                        }
                    }
                    break;
                }

                case ROOM_MSG.QUIZ_QUESTION:
                    showQuiz(msg);
                    break;

                case ROOM_MSG.QUIZ_END:
                    if (quizActive) endQuiz({ correctAnswer: msg.correctAnswer });
                    break;

                case ROOM_MSG.REACTION_SHOW:
                    showLocalReaction(msg.emoji);
                    break;

                case ROOM_MSG.HAND_LOWER:
                    _handRaised = false;
                    document.getElementById('hand-btn').classList.remove('raised');
                    break;

                case ROOM_MSG.AUDIENCE_NUDGE:
                    showAudienceNudge(msg.kind, msg.text);
                    break;

                case ROOM_MSG.POLL_START:
                    _activePollId = msg.pollId;
                    showPollOverlay(msg);
                    break;

                case ROOM_MSG.POLL_END:
                    _activePollId = null;
                    document.getElementById('poll-overlay').style.display = 'none';
                    break;

                case ROOM_MSG.WORDCLOUD_START:
                    _activeCloudId = msg.cloudId;
                    showWordcloudOverlay(msg);
                    break;

                case ROOM_MSG.WORDCLOUD_UPDATE:
                    if (msg.cloudId === _activeCloudId) updateWordcloudDisplay(msg.words);
                    break;

                case ROOM_MSG.WORDCLOUD_END:
                    _activeCloudId = null;
                    document.getElementById('wordcloud-overlay').style.display = 'none';
                    break;

                case ROOM_MSG.EXIT_TICKET_START:
                    _activeExitTicketId = msg.ticketId || null;
                    showExitTicketOverlay(msg);
                    break;

                case ROOM_MSG.EXIT_TICKET_END:
                    if (!_activeExitTicketId || !msg.ticketId || String(msg.ticketId) === String(_activeExitTicketId)) {
                        _activeExitTicketId = null;
                        document.getElementById('exitticket-overlay').style.display = 'none';
                    }
                    break;

                case ROOM_MSG.RANK_ORDER_START:
                    _activeRankOrderId = msg.rankId || null;
                    showRankOrderOverlay(msg);
                    break;

                case ROOM_MSG.RANK_ORDER_END:
                    if (!_activeRankOrderId || !msg.rankId || String(msg.rankId) === String(_activeRankOrderId)) {
                        _activeRankOrderId = null;
                        _activeRankOrderItems = [];
                        document.getElementById('rankorder-overlay').style.display = 'none';
                    }
                    break;
            }
        }

        function requestResync(reason = 'manual') {
            const rid = sendReliable({
                type: ROOM_MSG.SYNC_REQUEST,
                reason: toSafeString(reason, 40),
                index: currentIndex,
                fragmentOrder: currentFragmentOrder,
                transport: transportMode,
            }, { maxRetries: 4, retryDelay: 1200 });
            if (rid) {
                const waitEl = document.getElementById('waiting-text');
                const connected = transportCanSend();
                if (waitEl) waitEl.textContent = connected
                    ? 'Demande de resynchronisation envoyée…'
                    : 'Resynchronisation en file locale (en attente réseau)…';
                setConnectionDetail(
                    `${transportMode === 'relay' ? 'Relay' : 'P2P'} · ${connected ? 'resync demandé' : 'resync en attente'}`,
                    connected ? 'warn' : 'error'
                );
            }
        }

        // ── Reactions ─────────────────────────────────────
        function showLocalReaction(emoji) {
            const el = document.createElement('div');
            el.className = 'student-reaction-float';
            el.style.left = (20 + Math.random() * 60) + 'vw';
            el.textContent = emoji;
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }

        document.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                showLocalReaction(emoji);
                transportSend({ type: ROOM_MSG.STUDENT_REACTION, emoji, pseudo });
                // Brief cooldown to prevent spam
                btn.disabled = true;
                setTimeout(() => { btn.disabled = false; }, 2000);
            });
        });
        document.querySelectorAll('.feedback-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                sendDiscreteFeedback(btn.dataset.feedback, btn.dataset.text);
            });
        });
        hydrateFeedbackIcons();
        updateFeedbackUI();
        updateRevisionControls();

        // ── Nav bar ────────────────────────────────────────
        document.getElementById('nav-prev').addEventListener('click', () => {
            _followPresenter = false;
            document.getElementById('nav-follow').classList.remove('active');
            showByModeStep(-1);
        });
        document.getElementById('nav-next').addEventListener('click', () => {
            _followPresenter = false;
            document.getElementById('nav-follow').classList.remove('active');
            showByModeStep(1);
        });
        document.getElementById('bookmark-btn').addEventListener('click', () => {
            const key = String(currentIndex);
            if (_bookmarks.has(key)) _bookmarks.delete(key);
            else _bookmarks.add(key);
            saveBookmarks();
            if (_bookmarksOnly && !_bookmarks.has(String(currentIndex))) {
                const list = bookmarksSorted();
                if (list.length) showSlide(list[0]);
                else _bookmarksOnly = false;
            }
            updateBookmarkControls();
        });
        document.getElementById('bookmark-filter-btn').addEventListener('click', () => {
            if (!_bookmarksOnly) {
                if (_bookmarks.size === 0) return;
                _bookmarksOnly = true;
                _followPresenter = false;
                document.getElementById('nav-follow').classList.remove('active');
                if (!_bookmarks.has(String(currentIndex))) {
                    const list = bookmarksSorted();
                    if (list.length) showSlide(list[0]);
                }
            } else {
                _bookmarksOnly = false;
            }
            updateBookmarkControls();
        });
        document.getElementById('revision-btn').addEventListener('click', () => {
            setRevisionMode(!_revisionEnabled);
        });
        document.getElementById('revision-mark-new').addEventListener('click', () => markRevision('new'));
        document.getElementById('revision-mark-review').addEventListener('click', () => markRevision('review'));
        document.getElementById('revision-mark-known').addEventListener('click', () => markRevision('known'));
        document.getElementById('revision-mark-easy').addEventListener('click', () => markRevision('easy'));
        document.getElementById('revision-export').addEventListener('click', exportRevisionProgress);
        document.getElementById('revision-import').addEventListener('click', () => {
            document.getElementById('revision-import-file')?.click();
        });
        document.getElementById('revision-import-file').addEventListener('change', async e => {
            const file = e?.target?.files?.[0];
            if (!file) return;
            try {
                const raw = await file.text();
                const parsed = JSON.parse(raw);
                if (!importRevisionProgress(parsed)) {
                    alert('Fichier de progression invalide.');
                }
            } catch (err) {
                alert('Import impossible: JSON invalide.');
            } finally {
                e.target.value = '';
            }
        });
        document.getElementById('revision-exit').addEventListener('click', () => setRevisionMode(false));
        document.getElementById('nav-resync').addEventListener('click', () => requestResync('manual'));
        document.getElementById('nav-follow').addEventListener('click', () => {
            _followPresenter = !_followPresenter;
            if (_followPresenter && _bookmarksOnly) _bookmarksOnly = false;
            if (_followPresenter && _revisionEnabled) _revisionEnabled = false;
            document.getElementById('nav-follow').classList.toggle('active', _followPresenter);
            if (_followPresenter) showSlide(_presenterIndex);
            updateBookmarkControls();
            updateRevisionControls();
            updateCheckpointStatus();
        });

        // ── Hand raise ─────────────────────────────────────
        document.getElementById('hand-btn').addEventListener('click', () => {
            _handRaised = !_handRaised;
            document.getElementById('hand-btn').classList.toggle('raised', _handRaised);
            sendReliable({ type: ROOM_MSG.STUDENT_HAND, raised: _handRaised }, { maxRetries: 3, retryDelay: 1400 });
        });

        // ── Question overlay ───────────────────────────────
        document.getElementById('question-btn').addEventListener('click', () => {
            document.getElementById('question-overlay').style.display = 'flex';
            document.getElementById('question-text').focus();
        });
        document.getElementById('question-cancel').addEventListener('click', () => {
            document.getElementById('question-overlay').style.display = 'none';
        });
        document.getElementById('question-send').addEventListener('click', () => {
            const text = document.getElementById('question-text').value.trim();
            if (!text) return;
            sendReliable({ type: ROOM_MSG.STUDENT_QUESTION, text, qid: `q-${Date.now()}` }, { maxRetries: 3, retryDelay: 1400 });
            document.getElementById('question-text').value = '';
            document.getElementById('question-overlay').style.display = 'none';
        });

        // ── Wordcloud send ─────────────────────────────────
        document.getElementById('wc-send').addEventListener('click', sendWordcloudWord);
        document.getElementById('wc-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') sendWordcloudWord();
        });
        document.getElementById('exitticket-send').addEventListener('click', sendExitTicketAnswers);
        document.getElementById('rankorder-send').addEventListener('click', sendRankOrderSubmission);

        function sendWordcloudWord() {
            const input = document.getElementById('wc-input');
            const word = input.value.trim();
            if (!word || !_activeCloudId) return;
            sendReliable({ type: ROOM_MSG.WORDCLOUD_WORD, cloudId: _activeCloudId, word }, { maxRetries: 2, retryDelay: 1300 });
            markCheckpointCompleted(currentIndex, 'wordcloud');
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

        // ── Poll overlay helper ────────────────────────────
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
                : (pollType === 'scale5'
                    ? ['1', '2', '3', '4', '5']
                    : ['Option A', 'Option B']);
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
                sendReliable({ type: ROOM_MSG.POLL_ANSWER, pollId: _activePollId, value }, { maxRetries: 2, retryDelay: 1200 });
                markCheckpointCompleted(currentIndex, 'poll');
                buttonsEl.querySelectorAll('button').forEach(b => b.disabled = true);
                if (sentEl) {
                    sentEl.style.display = '';
                    sentEl.textContent = Array.isArray(value) ? 'Réponses envoyées ✓' : 'Réponse envoyée ✓';
                }
            };

            choices.forEach((ch, idx) => {
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
                    if (!isMulti) {
                        sendAnswer(ch.value);
                        return;
                    }
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

        // ── Wordcloud overlay helpers ──────────────────────
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
            sendReliable({
                type: ROOM_MSG.EXIT_TICKET_SUBMIT,
                ticketId: _activeExitTicketId,
                answers,
            }, { maxRetries: 3, retryDelay: 1300 });
            markCheckpointCompleted(currentIndex, 'exit-ticket');
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
            sendReliable({
                type: ROOM_MSG.RANK_ORDER_SUBMIT,
                rankId: _activeRankOrderId,
                order,
            }, { maxRetries: 3, retryDelay: 1300 });
            markCheckpointCompleted(currentIndex, 'rank-order');
            sendBtn.disabled = true;
            if (sentEl) sentEl.textContent = 'Classement envoyé ✓';
            setTimeout(() => {
                sendBtn.disabled = false;
                if (sentEl?.textContent?.includes('envoy')) sentEl.textContent = '';
            }, 1400);
        }

        // ── Join handler ──────────────────────────────────
        document.getElementById('pseudo-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('join-btn').click();
        });

        document.getElementById('join-btn').addEventListener('click', () => {
            const input = document.getElementById('pseudo-input');
            pseudo = input.value.trim();
            if (!pseudo) { input.focus(); setJoinStatus('Entrez votre prénom', 'error'); return; }

            _setReliableQueueScope(pseudo);
            _startConnectionWatchdog();
            document.getElementById('join-btn').disabled = true;
            setJoinStatus('Connexion à la salle…', 'info');

            // Show main view with waiting overlay
            document.getElementById('join-screen').style.display = 'none';
            document.getElementById('main-view').style.display = 'flex';
            document.getElementById('waiting-overlay').classList.add('active');
            document.getElementById('waiting-text').textContent = 'Connexion au présentateur…';
            reconnectAttempts = 0;
            clearConnOpenTimer();
            clearReconnectTimer();
            _setConnectionState(CONNECTION_STATE.CONNECTING, 'P2P · connexion…', 'warn');

            const requestedTransport = typeof NetworkSession.normalizeTransportMode === 'function'
                ? NetworkSession.normalizeTransportMode(params.get('transport') || 'auto')
                : toSafeString(params.get('transport'), 20).toLowerCase();
            const forceRelay = requestedTransport === 'relay';
            if (forceRelay && RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) {
                transportMode = 'relay';
                connectViaRelay('transport=relay');
                return;
            }
            connectToPeer();
        });

        // ── Notes per-slide (localStorage) ───────────────
        (function() {
            const area = document.getElementById('notes-area');
            const indicator = document.getElementById('notes-save-indicator');
            if (!area) return;

            // Load notes for current slide
            _loadSlideNotes(currentIndex);

            // Auto-save on input (debounced)
            let _noteTimer = null;
            area.addEventListener('input', () => {
                if (_noteTimer) clearTimeout(_noteTimer);
                _noteTimer = setTimeout(() => {
                    _saveSlideNotes();
                    if (indicator) { indicator.textContent = 'Sauvegardé ✓'; setTimeout(() => { if (indicator) indicator.textContent = ''; }, 1500); }
                }, 600);
            });

            // ── Export PDF — 1 feuille A4 par slide ────────
            document.getElementById('notes-export-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                _saveSlideNotes(); // Save current before export
                if (!slidesHtml.length) { alert('Aucune slide chargée.'); return; }

                const title = document.getElementById('header-title')?.textContent || 'Présentation';
                const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                // Theme CSS already scoped to #slide-inner — re-scope for print window
                const rawThemeCSS = document.getElementById('presentation-theme')?.textContent || '';
                const printThemeCSS = rawThemeCSS.replace(/#slide-inner/g, '.slide-inner-print');

                // One page per slide
                const pages = slidesHtml.map((slideHtml, i) => {
                    const slideNotes = _notesData[String(i)] || '';
                    const notesHtml = slideNotes
                        ? slideNotes.split('\n').map(line =>
                            line.trim() ? `<p>${esc(line)}</p>` : '<p class="print-empty-line"></p>'
                          ).join('')
                        : '<p class="no-note">—</p>';
                    return `<div class="slide-page">
  <div class="page-header">
    <span class="slide-num">Slide ${i + 1}\u202f/\u202f${slidesHtml.length}</span>
    <span class="slide-title-hdr">${esc(title)}</span>
    <span class="student-name">${esc(pseudo || 'Étudiant')}</span>
  </div>
  <div class="slide-frame-print">
    <div class="slide-inner-print">${slideHtml}</div>
  </div>
  <div class="notes-section">
    <div class="notes-label">Notes</div>
    <div class="notes-content">${notesHtml}</div>
  </div>
</div>`;
                }).join('\n');

                const scoreLine = (quizCount > 0 || score > 0)
                    ? `<div class="cover-score">${score > 0 ? `<span>${score.toLocaleString()}\u202fpts</span>` : ''}${quizCount > 0 ? `<span>${quizCorrect}/${quizCount} quiz</span>` : ''}</div>`
                    : '';

                const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Notes \u2014 ${esc(title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; margin: 12mm 14mm; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1e293b; }
.cover-page { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 14px; break-after: page; text-align: center; }
.cover-title { font-size: 1.8rem; font-weight: 700; color: #1e293b; }
.cover-meta { font-size: 0.9rem; color: #64748b; }
.cover-score { display: flex; gap: 12px; justify-content: center; }
.cover-score span { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 20px; padding: 4px 14px; font-size: 0.82rem; font-weight: 600; color: #475569; }
.slide-page { break-after: page; display: flex; flex-direction: column; }
.slide-page:last-of-type { break-after: auto; }
.page-header { display: flex; align-items: baseline; gap: 6px; padding-bottom: 6px; border-bottom: 1.5px solid #6366f1; margin-bottom: 8px; }
.slide-num { font-size: 0.65rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
.slide-title-hdr { flex: 1; font-size: 0.72rem; color: #64748b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; padding: 0 6px; }
.student-name { font-size: 0.65rem; color: #94a3b8; white-space: nowrap; }
.slide-frame-print { width: 100%; position: relative; overflow: hidden; border-radius: 4px; }
.slide-inner-print { width: 1280px; height: 720px; transform-origin: top left; position: relative; display: block; }
.notes-section { flex: 1; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
.notes-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1; margin-bottom: 6px; }
.notes-content { line-height: 1.7; color: #334155; font-size: 0.88rem; }
.notes-content p { margin-bottom: 3px; }
.no-note { color: #cbd5e1; font-style: italic; }
${printThemeCSS}
</style></head><body>
<div class="cover-page">
  <div class="cover-title">\uD83D\uDCDD ${esc(title)}</div>
  <div class="cover-meta">${esc(pseudo || 'Étudiant')} \u00b7 ${dateStr}</div>
  ${scoreLine}
</div>
${pages}
<script>
window.addEventListener('load', function() {
  var MM_TO_PX = 96 / 25.4;
  var printableW = (210 - (14 * 2)) * MM_TO_PX; // A4 width - left/right margins
  var printableH = (297 - (12 * 2)) * MM_TO_PX; // A4 height - top/bottom margins

  function applyScale() {
    document.querySelectorAll('.slide-frame-print').forEach(function(frame) {
      var inner = frame.querySelector('.slide-inner-print');
      if (!inner) return;
      var page = frame.closest('.slide-page');
      var pageHeader = page ? page.querySelector('.page-header') : null;
      var headerH = pageHeader ? (pageHeader.offsetHeight || 0) : 0;
      var reserveH = 12 + headerH;
      var availW = Math.max(60, Math.min(frame.offsetWidth || printableW, printableW));
      var availH = Math.max(80, printableH - reserveH);
      var scale = Math.max(0.1, Math.min(availW / 1280, availH / 720, 1));
      frame.style.height = Math.round(720 * scale) + 'px';
      // Important: do not combine transform + zoom (would scale twice).
      if (typeof inner.style.zoom === 'string') {
        inner.style.zoom = scale;
        inner.style.transform = '';
      } else {
        inner.style.transform = 'scale(' + scale + ')';
      }
    });
  }

  applyScale();
  setTimeout(function() {
    applyScale();
    setTimeout(function() { window.print(); }, 120);
  }, 140);
});
<\/script>
</body></html>`;

                const w = window.open('', '_blank', 'width=920,height=820');
                if (!w) { alert('Autorisez les popups pour exporter en PDF.'); return; }
                w.document.write(html);
                w.document.close();
            });
        })();

        // ── Resize ────────────────────────────────────────
        const ro = new ResizeObserver(scaleSlide);
        ro.observe(document.getElementById('slide-frame') || document.body);
        window.addEventListener('resize', scaleSlide);

        // Focus pseudo input on load
        document.getElementById('pseudo-input').focus();

    })();
