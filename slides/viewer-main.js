// @ts-check
        import Reveal from '../vendor/revealjs/5.1.0/dist/reveal.esm.js';
        import Highlight from '../vendor/revealjs/5.1.0/plugin/highlight/highlight.esm.js';
        import { createWhiteboardController } from './viewer/whiteboard.js';
        import { initAudienceMode as initAudienceModeModule } from './viewer/audience-mode.js?v=4';
        import { clearNode, el, appendAll } from './viewer/dom-utils.js';
        import { resolveRealtimeContract } from './viewer/runtime-contracts.js';
        import { createViewerAppState } from './viewer/app-state.js';
        import { safePeerSend, broadcastPeers } from './viewer/room-transport.js';
        import { postSyncMessage } from './viewer/audience-sync.js';
        import { clampNumber } from './viewer/presenter-layout.js';
        import { applyStatusState } from './viewer/room-ui.js';
        import { REMOTE_HASH_ITERATIONS, sha256Hex, derivePasswordHashHex } from './viewer/remote-auth.js';

        const params = new URLSearchParams(location.search);
        let file = params.get('file') || '../data/slides/exemple-git.json';
        const isPresenterMode = params.get('mode') === 'presenter';
        const Storage = window.OEIStorage || null;
        const STORAGE_KEYS = Storage?.KEYS || {};
        const STORAGE_CHANNELS = Storage?.CHANNELS || {};
        const DRAFT_KEY = STORAGE_KEYS.PRESENT_DATA || 'oei-slide-present-data';
        const LAST_ROOM_ID_KEY = STORAGE_KEYS.LAST_ROOM_ID || 'oei-last-room-id';
        const PRESENTER_THEME_KEY = STORAGE_KEYS.PRESENTER_THEME || 'oei-presenter-theme';
        const PRESENTER_SESSION_KEY = STORAGE_KEYS.PRESENTER_SESSION || 'oei-presenter-session';
        const PRESENTER_LAYOUT_KEY = STORAGE_KEYS.PRESENTER_LAYOUT || 'oei-presenter-layout';
        const REMOTE_CONTROL_CONFIG_KEY = STORAGE_KEYS.REMOTE_CONTROL_CONFIG || 'oei-remote-control-config';
        const _ls = (() => {
            try { return window.localStorage; } catch (e) { return null; }
        })();
        const remoteControlConfigKey = roomId => (
            Storage?.remoteControlConfigKey
                ? Storage.remoteControlConfigKey(roomId)
                : `oei-remote-control-${String(roomId || '').trim()}`
        );
        const presenterAnnotationsKey = presentationId => (
            Storage?.presenterAnnotationsKey
                ? Storage.presenterAnnotationsKey(presentationId)
                : `oei-presenter-annotations-${String(presentationId || '').trim()}`
        );
        const storageGetRaw = key => {
            if (!key) return null;
            if (Storage?.getRaw) return Storage.getRaw(key);
            try { return _ls ? _ls.getItem(key) : null; } catch (e) { return null; }
        };
        const storageSetRaw = (key, value) => {
            if (!key) return false;
            if (Storage?.setRaw) return Storage.setRaw(key, value);
            try { if (!_ls) return false; _ls.setItem(key, value); return true; } catch (e) { return false; }
        };
        const storageGetJSON = (key, fallback = null) => {
            if (!key) return fallback;
            if (Storage?.getJSON) return Storage.getJSON(key, fallback);
            try {
                const raw = _ls ? _ls.getItem(key) : null;
                if (!raw) return fallback;
                return JSON.parse(raw);
            } catch (e) {
                return fallback;
            }
        };
        const _buildQrImageSrc = (value, size = 180) => {
            const safeValue = String(value || '');
            if (window.qrcode && safeValue) {
                try {
                    const qr = window.qrcode(0, 'M');
                    qr.addData(safeValue);
                    qr.make();
                    const svg = qr.createSvgTag({ cellSize: Math.max(2, Math.floor(size / 42)), margin: 1, scalable: true });
                    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
                } catch (_) {}
            }
            return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(safeValue)}`;
        };
        const storageSetJSON = (key, value) => {
            if (!key) return false;
            if (Storage?.setJSON) return Storage.setJSON(key, value);
            try { if (!_ls) return false; _ls.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
        };
        const storageRemove = key => {
            if (!key) return;
            if (Storage?.remove) { Storage.remove(key); return; }
            try { if (_ls) _ls.removeItem(key); } catch (e) {}
        };
        const UI_ICONS = window.OEI_UI_ICONS || {};
        const withIcon = (key, label) => {
            if (typeof window.oeiIconLabel === 'function') return window.oeiIconLabel(key, label);
            return `${UI_ICONS[key] || ''}${label ? `<span>${label}</span>` : ''}`;
        };
        const iconOnly = key => {
            if (typeof window.oeiIcon === 'function') return window.oeiIcon(key);
            return UI_ICONS[key] || '';
        };
        const SYNC_CHANNEL_NAME = STORAGE_CHANNELS.PRESENTER_SYNC || 'oei-slides-presenter-sync';
        const NetworkSession = window.OEINetworkSession || {};
        const {
            SYNC_MSG,
            ROOM_MSG,
            validateSyncMessage,
            validateRoomMessage,
        } = resolveRealtimeContract(window);
        const toIntOrNull = value => {
            const n = Number(value);
            return Number.isFinite(n) ? Math.trunc(n) : null;
        };
        const toNumberOr = (value, fallback = 0) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        };
        const toTrimmedString = (value, maxLen = 0) => {
            if (typeof value !== 'string') return '';
            const out = value.trim();
            return maxLen > 0 ? out.slice(0, maxLen) : out;
        };
        const PEER_OPTIONS = typeof NetworkSession.buildPeerOptions === 'function'
            ? NetworkSession.buildPeerOptions(params, storageGetJSON, window.OEI_PEER_OPTIONS)
            : { debug: 0, pingInterval: 5000, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
        const RELAY_OPTIONS = typeof NetworkSession.buildRelayOptions === 'function'
            ? NetworkSession.buildRelayOptions(params, storageGetJSON, window.OEI_RELAY_OPTIONS)
            : { enabled: false, wsUrl: '', token: '' };
        const AUDIENCE_POLICY = typeof NetworkSession.resolveAudiencePolicy === 'function'
            ? NetworkSession.resolveAudiencePolicy(params, { defaultMode: 'display', forceReadOnly: params.get('mode') === 'audience' ? true : null })
            : { mode: 'display', readOnly: true, allowAudienceActions: false };
        if (params.get('mode') === 'audience') {
            window.OEIAudienceModePolicy = AUDIENCE_POLICY;
            document.documentElement.dataset.oeiAudienceMode = AUDIENCE_POLICY.mode || 'display';
        }
        const _reconnectDelayMs = attempt => (
            typeof NetworkSession.reconnectDelayMs === 'function'
                ? NetworkSession.reconnectDelayMs(attempt)
                : (Math.min(25000, Math.round(1200 * Math.pow(1.45, Math.max(0, attempt - 1)))) + Math.round(Math.random() * 500))
        );
        const buildPresentationStorageId = data => {
            const metaId = toTrimmedString(data?.metadata?.id, 120);
            if (metaId) return metaId;
            const title = toTrimmedString(data?.metadata?.title, 160) || 'sans-titre';
            const source = toTrimmedString(file || '__draft__', 200);
            const slideCount = Array.isArray(data?.slides) ? data.slides.length : 0;
            const raw = `${source}|${title}|${slideCount}`;
            let h = 0;
            for (let i = 0; i < raw.length; i++) {
                h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
            }
            return `deck-${Math.abs(h).toString(36)}`;
        };
        // Runtime state bridge: centralize state access while keeping legacy globals for compatibility.
        const ViewerRuntime = createViewerAppState(window);
        let draftData = null;
        if (file === '__draft__') {
            draftData = storageGetJSON(DRAFT_KEY, null);
            file = null;
        }

        async function loadData() {
            if (draftData) return draftData;
            const res = await fetch(file);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        }

        /* ── Whiteboard (drawing overlay) ─────────────────── */
        let _whiteboard = null;
        const wbToggle = () => { _whiteboard?.toggle(); };

        /* ── Student Room (WebRTC P2P) ─────────────────────── */
        let _presentationData = null;
        let _presenterSyncChannel = null;
        const _postPresenterSync = msg => postSyncMessage(_presenterSyncChannel, msg, validateSyncMessage);

        const _room = {
            peer: null,
            connections: [],
            students: {},
            active: false,
        };
        const _relayRoom = {
            ws: null,
            active: false,
            roomId: '',
            reconnectTimer: null,
            reconnectAttempts: 0,
            peers: new Map(), // relayClientId -> pseudo-connection
        };
        const _roomSeenByPeer = new Map(); // peerId -> Map(rid, ts)
        const ROOM_SEEN_TTL_MS = 2 * 60 * 1000;
        const ROOM_ACKED_TYPES = new Set([
            ROOM_MSG.STUDENT_JOIN,
            ROOM_MSG.QUIZ_ANSWER,
            ROOM_MSG.STUDENT_SCORE,
            ROOM_MSG.STUDENT_HAND,
            ROOM_MSG.STUDENT_QUESTION,
            ROOM_MSG.STUDENT_FEEDBACK,
            ROOM_MSG.POLL_ANSWER,
            ROOM_MSG.WORDCLOUD_WORD,
            ROOM_MSG.EXIT_TICKET_SUBMIT,
            ROOM_MSG.RANK_ORDER_SUBMIT,
            ROOM_MSG.SYNC_REQUEST,
        ]);
        let _roomPeerReconnectTimer = null;
        let _roomPeerReconnectAttempts = 0;

        // ── Nouvelles structures de données salle ──────────────
        const _roomHands = [];       // [{ peerId, pseudo }]
        const _roomQuestions = [];   // [{ qid, text, time }]
        let _roomQuestionFilter = 'open';
        const _roomFeedback = {
            events: [],
            lastByPeer: new Map(),
        };
        let _roomPresenterMode = 'live';
        const ROOM_PRESENTER_MODES = ['live', 'interactions', 'technique'];
        let _pvQrVisible = false;
        let _pvContextView = 'status';
        let _activePoll = null;      // { pollId, type, prompt, options, multi, responses: Map }
        let _activeWordCloud = null; // { cloudId, prompt, words: Map }
        let _activeExitTicket = null; // { ticketId, title, prompts, responses: Map(peerId -> { answers, pseudo, at }) }
        let _activeRankOrder = null; // { rankId, title, items, responses: Map(peerId -> { order, pseudo, at }) }
        let _wcBroadcastTimer = null;
        const _roomBridgeSubs = {
            poll: new Set(),
            cloud: new Set(),
            exitTicket: new Set(),
            rankOrder: new Set(),
            roulette: new Set(),
            room: new Set(),
        };
        const _normalizePollType = value => {
            const raw = toTrimmedString(value, 32).toLowerCase();
            if (raw === 'scale5' || raw === 'thumbs' || raw === 'mcq-single' || raw === 'mcq-multi') return raw;
            return 'thumbs';
        };
        const _defaultPollOptions = pollType => {
            if (pollType === 'thumbs') return ['👍 Pour', '👎 Contre'];
            if (pollType === 'scale5') return ['1', '2', '3', '4', '5'];
            return ['Option A', 'Option B', 'Option C', 'Option D'];
        };
        const _sanitizePollOptions = (pollType, rawOptions) => {
            if (pollType === 'scale5') return ['1', '2', '3', '4', '5'];
            const source = Array.isArray(rawOptions) ? rawOptions : [];
            const seen = new Set();
            const cleaned = [];
            source.forEach(opt => {
                const label = toTrimmedString(opt, 80);
                if (!label) return;
                const key = label.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                cleaned.push(label);
            });
            if (pollType === 'thumbs') return cleaned.length >= 2 ? cleaned.slice(0, 2) : ['👍 Pour', '👎 Contre'];
            if (cleaned.length < 2) return _defaultPollOptions(pollType);
            return cleaned.slice(0, 8);
        };
        const _pollValueDomain = poll => {
            if (!poll) return [];
            if (poll.type === 'thumbs') return [1, 0];
            if (poll.type === 'scale5') return [1, 2, 3, 4, 5];
            return (poll.options || []).map((_, idx) => idx);
        };
        const _computePollStats = poll => {
            const values = _pollValueDomain(poll);
            const counts = values.map(v => {
                let count = 0;
                poll.responses.forEach(answer => {
                    if (poll.multi && Array.isArray(answer)) {
                        if (answer.includes(v)) count += 1;
                    } else if (!poll.multi && answer === v) {
                        count += 1;
                    }
                });
                return count;
            });
            const total = poll.responses.size;
            const totalSelections = counts.reduce((sum, v) => sum + v, 0);
            return { counts, total, totalSelections };
        };
        const _normalizePollAnswer = (poll, rawValue) => {
            const domain = new Set(_pollValueDomain(poll));
            if (!domain.size) return null;
            if (poll.multi) {
                const values = Array.isArray(rawValue) ? rawValue : [rawValue];
                const normalized = [...new Set(values.map(v => Number(v)).filter(v => Number.isFinite(v) && domain.has(v)))];
                return normalized.length ? normalized : null;
            }
            const value = Number(rawValue);
            if (!Number.isFinite(value) || !domain.has(value)) return null;
            return value;
        };
        const _sanitizeStringList = (raw, maxItems = 8, maxLen = 120, fallback = []) => {
            const source = Array.isArray(raw) ? raw : [];
            const cleaned = source
                .map(item => toTrimmedString(item, maxLen))
                .filter(Boolean)
                .slice(0, maxItems);
            if (cleaned.length) return cleaned;
            const fb = Array.isArray(fallback) ? fallback : [];
            return fb
                .map(item => toTrimmedString(item, maxLen))
                .filter(Boolean)
                .slice(0, maxItems);
        };
        const _normalizeExitTicketAnswers = (ticket, rawAnswers) => {
            if (!ticket || !Array.isArray(ticket.prompts) || !ticket.prompts.length) return null;
            const source = Array.isArray(rawAnswers) ? rawAnswers : [];
            const answers = ticket.prompts.map((_, idx) => toTrimmedString(source[idx], 280));
            return answers.some(Boolean) ? answers : null;
        };
        const _normalizeRankOrderSubmission = (rank, rawOrder) => {
            if (!rank || !Array.isArray(rank.items) || rank.items.length < 2) return null;
            const total = rank.items.length;
            const source = Array.isArray(rawOrder) ? rawOrder : [];
            const seen = new Set();
            const normalized = [];
            source.forEach(value => {
                const idx = toIntOrNull(value);
                if (idx === null || idx < 0 || idx >= total) return;
                if (seen.has(idx)) return;
                seen.add(idx);
                normalized.push(idx);
            });
            for (let i = 0; i < total; i += 1) {
                if (!seen.has(i)) normalized.push(i);
            }
            if (normalized.length !== total) return null;
            return normalized;
        };
        const _computeRankOrderAggregate = rank => {
            const items = Array.isArray(rank?.items) ? rank.items : [];
            if (!items.length) return [];
            const totals = items.map((_, itemIndex) => ({
                itemIndex,
                label: String(items[itemIndex] || ''),
                score: 0,
                votes: 0,
                posSum: 0,
            }));
            const maxScore = items.length;
            rank.responses.forEach(entry => {
                const order = Array.isArray(entry?.order) ? entry.order : [];
                order.forEach((itemIndex, pos) => {
                    const row = totals[itemIndex];
                    if (!row) return;
                    row.score += (maxScore - pos);
                    row.votes += 1;
                    row.posSum += (pos + 1);
                });
            });
            return totals
                .map(row => ({
                    itemIndex: row.itemIndex,
                    label: row.label,
                    score: row.score,
                    votes: row.votes,
                    avgPos: row.votes ? (row.posSum / row.votes) : null,
                }))
                .sort((a, b) => {
                    const ds = b.score - a.score;
                    if (ds !== 0) return ds;
                    const da = (a.avgPos ?? 999) - (b.avgPos ?? 999);
                    if (da !== 0) return da;
                    return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
                });
        };
        const _roomBridgeSnapshotPoll = () => {
            if (!_activePoll) return { active: false };
            const stats = _computePollStats(_activePoll);
            return {
                active: true,
                pollId: _activePoll.pollId,
                type: _activePoll.type,
                prompt: _activePoll.prompt || '',
                options: Array.isArray(_activePoll.options) ? _activePoll.options.slice() : [],
                multi: !!_activePoll.multi,
                counts: stats.counts,
                total: stats.total,
                totalSelections: stats.totalSelections,
            };
        };
        const _roomBridgeSnapshotCloud = () => {
            if (!_activeWordCloud) return { active: false, words: [] };
            const words = [..._activeWordCloud.words.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 48);
            return {
                active: true,
                cloudId: _activeWordCloud.cloudId,
                prompt: _activeWordCloud.prompt || '',
                words,
            };
        };
        const _roomBridgeSnapshotExitTicket = () => {
            if (!_activeExitTicket) return { active: false, responses: [] };
            const responses = [..._activeExitTicket.responses.values()]
                .sort((a, b) => Number(b?.at || 0) - Number(a?.at || 0))
                .map(entry => ({
                    pseudo: toTrimmedString(entry?.pseudo, 40) || 'Anonyme',
                    answers: Array.isArray(entry?.answers) ? entry.answers.map(v => toTrimmedString(v, 280)) : [],
                    at: Number(entry?.at || 0),
                }));
            return {
                active: true,
                ticketId: _activeExitTicket.ticketId,
                title: _activeExitTicket.title || 'Exit ticket',
                prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                responsesCount: _activeExitTicket.responses.size,
                responses,
            };
        };
        const _roomBridgeSnapshotRankOrder = () => {
            if (!_activeRankOrder) return { active: false, rows: [] };
            return {
                active: true,
                rankId: _activeRankOrder.rankId,
                title: _activeRankOrder.title || 'Classement',
                items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                responsesCount: _activeRankOrder.responses.size,
                rows: _computeRankOrderAggregate(_activeRankOrder),
            };
        };
        const _roomBridgeSnapshotRoom = () => {
            const studentsEntries = Object.entries(_room.students || {});
            const students = studentsEntries.map(([peerId, student]) => ({
                peerId,
                pseudo: String(student?.pseudo || peerId || 'Anonyme'),
                score: toNumberOr(student?.score, 0),
                quizCount: toNumberOr(student?.quizCount, 0),
                quizCorrect: toNumberOr(student?.quizCorrect, 0),
                handRaised: !!student?.handRaised,
            }));
            const questions = roomQuestionStats();
            const feedback10m = roomFeedbackStats(10 * 60 * 1000);
            const pollSnap = _roomBridgeSnapshotPoll();
            return {
                active: !!_room.active,
                transport: _room.active ? (_relayRoom.active ? 'p2p+relay' : 'p2p') : 'off',
                studentsCount: students.length,
                handsCount: _roomHands.length,
                questionsOpen: questions.open,
                questionsTotal: questions.total,
                feedback10m,
                pollActive: !!pollSnap.active,
                wordCloudActive: !!_activeWordCloud,
                exitTicketActive: !!_activeExitTicket,
                rankOrderActive: !!_activeRankOrder,
                students,
            };
        };
        const _roomBridgeEmit = (kind, payload) => {
            const listeners = _roomBridgeSubs[kind];
            if (!listeners) return;
            listeners.forEach(fn => {
                try { fn(payload); } catch (_) {}
            });
        };
        const REMOTE_PASSWORD_MIN_LEN = 8;
        const REMOTE_CHALLENGE_TTL_MS = 60 * 1000;
        const REMOTE_SESSION_TTL_MS = 15 * 60 * 1000;
        const REMOTE_LOCK_MS = 30 * 1000;

        const PresenterControls = {
            goNext: null,
            goPrev: null,
            goTo: null,
            toggleBlack: null,
            timerToggle: null,
            timerReset: null,
            switchTab: null,
        };

        const _remoteControl = {
            roomId: '',
            enabled: false,
            hash: '',
            salt: '',
            iterations: REMOTE_HASH_ITERATIONS,
            sessions: new Map(), // token -> { peerId, expiresAt }
            challenges: new Map(), // challengeId -> { peerId, clientNonce, serverNonce, expiresAt }
            failures: new Map(), // peerId -> { count, lockedUntil }
            statusText: '',
            statusTone: '',
        };
        const _roomUiStatus = {
            text: '',
            tone: '',
        };

        const _toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        const _randToken = (size = 18) => {
            const bytes = new Uint8Array(size);
            crypto.getRandomValues(bytes);
            return _toBase64Url(bytes);
        };

        function _remoteSetStatus(text, tone = '') {
            _remoteControl.statusText = String(text || '');
            _remoteControl.statusTone = tone || '';
            const statusEl = document.getElementById('rm-remote-status');
            applyStatusState(statusEl, 'rm-remote-status', _remoteControl.statusText, _remoteControl.statusTone);
        }

        function _roomSetStatus(text, tone = '') {
            _roomUiStatus.text = String(text || '');
            _roomUiStatus.tone = String(tone || '');
            const statusEl = document.getElementById('rm-room-status');
            applyStatusState(statusEl, 'rm-room-status', _roomUiStatus.text, _roomUiStatus.tone);
            const copyBtn = document.getElementById('sl-room-copy');
            if (copyBtn) {
                copyBtn.title = _roomUiStatus.text || 'Copier le lien stable';
            }
        }

        function _remoteBuildUrl(roomId) {
            return location.origin + location.pathname.replace(/[^/]*$/, '') + 'remote.html?room=' + encodeURIComponent(roomId);
        }

        function _remotePrune() {
            const now = Date.now();
            for (const [token, sess] of _remoteControl.sessions.entries()) {
                if (!sess || sess.expiresAt <= now) _remoteControl.sessions.delete(token);
            }
            for (const [challengeId, challenge] of _remoteControl.challenges.entries()) {
                if (!challenge || challenge.expiresAt <= now) _remoteControl.challenges.delete(challengeId);
            }
            for (const [peerId, fail] of _remoteControl.failures.entries()) {
                if (!fail || (fail.lockedUntil && fail.lockedUntil <= now && !fail.count)) {
                    _remoteControl.failures.delete(peerId);
                }
            }
        }

        function _remoteActiveSessionsCount() {
            _remotePrune();
            return _remoteControl.sessions.size;
        }

        function _remoteUpdateUI() {
            _remotePrune();
            const roomId = _remoteControl.roomId || toTrimmedString(document.getElementById('rm-room-id-input')?.value, 40);
            const sessions = _remoteActiveSessionsCount();
            const wrap = document.getElementById('rm-remote-link-wrap');
            const urlEl = document.getElementById('rm-remote-url');
            const qrEl = document.getElementById('rm-remote-qr');
            const enableBtn = document.getElementById('rm-remote-enable');
            const revokeBtn = document.getElementById('rm-remote-revoke');

            if (enableBtn) enableBtn.disabled = !roomId;
            if (revokeBtn) revokeBtn.disabled = !_remoteControl.enabled && sessions === 0;

            if (_remoteControl.enabled && roomId) {
                const remoteUrl = _remoteBuildUrl(roomId);
                if (wrap) wrap.style.display = '';
                if (urlEl) urlEl.textContent = remoteUrl;
                if (qrEl) qrEl.innerHTML = `<img src="${_buildQrImageSrc(remoteUrl, 180)}" alt="QR contrôle mobile">`;
                if (_room.active) {
                    _remoteSetStatus(sessions > 0
                        ? `Contrôle mobile actif (${sessions} session${sessions > 1 ? 's' : ''}).`
                        : 'Contrôle mobile actif. En attente de connexion distante.', 'ok');
                } else {
                    _remoteSetStatus('Contrôle prêt. Ouvrez la salle pour accepter les connexions mobiles.', 'warn');
                }
            } else {
                if (wrap) wrap.style.display = 'none';
                if (!_remoteControl.statusText || _remoteControl.statusTone === 'ok') {
                    _remoteSetStatus('Définissez un mot de passe puis activez le contrôle mobile.', '');
                }
            }
        }

        function _remoteLoadConfig(roomId) {
            _remoteControl.roomId = roomId;
            _remoteControl.sessions.clear();
            _remoteControl.challenges.clear();
            _remoteControl.failures.clear();
            const saved = storageGetJSON(remoteControlConfigKey(roomId), null);
            if (saved && typeof saved === 'object' && typeof saved.hash === 'string' && typeof saved.salt === 'string') {
                _remoteControl.enabled = true;
                _remoteControl.hash = saved.hash;
                _remoteControl.salt = saved.salt;
                _remoteControl.iterations = Math.max(10000, toIntOrNull(saved.iterations) || REMOTE_HASH_ITERATIONS);
                _remoteSetStatus('Contrôle mobile restauré pour cette salle.', 'ok');
            } else {
                _remoteControl.enabled = false;
                _remoteControl.hash = '';
                _remoteControl.salt = '';
                _remoteControl.iterations = REMOTE_HASH_ITERATIONS;
                _remoteSetStatus('Définissez un mot de passe puis activez le contrôle mobile.', '');
            }
            _remoteUpdateUI();
        }

        function _remotePersistConfig() {
            if (!_remoteControl.roomId) return;
            const payload = {
                hash: _remoteControl.hash,
                salt: _remoteControl.salt,
                iterations: _remoteControl.iterations,
                updatedAt: Date.now(),
            };
            storageSetJSON(remoteControlConfigKey(_remoteControl.roomId), payload);
        }

        function _remoteClearConfig(roomId) {
            if (!roomId) return;
            storageRemove(remoteControlConfigKey(roomId));
            storageRemove(REMOTE_CONTROL_CONFIG_KEY);
        }

        function _remoteDropPeer(peerId) {
            if (!peerId) return;
            for (const [token, sess] of _remoteControl.sessions.entries()) {
                if (sess?.peerId === peerId) _remoteControl.sessions.delete(token);
            }
            for (const [challengeId, challenge] of _remoteControl.challenges.entries()) {
                if (challenge?.peerId === peerId) _remoteControl.challenges.delete(challengeId);
            }
            _remoteControl.failures.delete(peerId);
            _remoteUpdateUI();
        }

        function _remoteFail(peerId) {
            const now = Date.now();
            const rec = _remoteControl.failures.get(peerId) || { count: 0, lockedUntil: 0 };
            rec.count = Math.max(0, rec.count || 0) + 1;
            if (rec.count >= 3) {
                rec.lockedUntil = now + REMOTE_LOCK_MS;
                rec.count = 0;
            }
            _remoteControl.failures.set(peerId, rec);
            return rec.lockedUntil > now ? rec.lockedUntil - now : 0;
        }

        function _remoteCheckLock(peerId) {
            const rec = _remoteControl.failures.get(peerId);
            const now = Date.now();
            if (!rec || !rec.lockedUntil) return 0;
            if (rec.lockedUntil <= now) {
                _remoteControl.failures.delete(peerId);
                return 0;
            }
            return rec.lockedUntil - now;
        }

        function _remoteSendAuthError(conn, reason, code = 'auth_error') {
            safePeerSend(conn, { type: ROOM_MSG.REMOTE_AUTH_ERROR, code, reason: String(reason || 'Authentification refusée') });
        }

        function _remoteRevokeAll(reason = 'Contrôle mobile révoqué', keepSecret = false) {
            const sessionPeers = new Set(Array.from(_remoteControl.sessions.values()).map(s => s.peerId).filter(Boolean));
            _room.connections.forEach(c => {
                if (!c?.open) return;
                if (sessionPeers.has(c.peer)) {
                    try { c.send({ type: ROOM_MSG.REMOTE_REVOKED, reason }); } catch (e) {}
                }
            });
            _remoteControl.sessions.clear();
            _remoteControl.challenges.clear();
            _remoteControl.failures.clear();
            if (!keepSecret) {
                _remoteControl.enabled = false;
                _remoteControl.hash = '';
                _remoteControl.salt = '';
                _remoteControl.iterations = REMOTE_HASH_ITERATIONS;
                _remoteClearConfig(_remoteControl.roomId);
                const pass = document.getElementById('rm-remote-password');
                if (pass) pass.value = '';
            }
            _remoteSetStatus(reason, keepSecret ? 'warn' : 'error');
            _remoteUpdateUI();
        }

        async function _remoteEnableFromPassword() {
            const pass = toTrimmedString(document.getElementById('rm-remote-password')?.value || '', 128);
            if (pass.length < REMOTE_PASSWORD_MIN_LEN) {
                _remoteSetStatus(`Mot de passe trop court (${REMOTE_PASSWORD_MIN_LEN} caractères minimum).`, 'error');
                return;
            }
            if (!_remoteControl.roomId) {
                _remoteSetStatus('ID de salle invalide.', 'error');
                return;
            }
            _remoteSetStatus('Activation du contrôle mobile…', 'warn');
            const salt = _randToken(16);
            const hash = await derivePasswordHashHex(pass, salt, REMOTE_HASH_ITERATIONS);
            _remoteControl.enabled = true;
            _remoteControl.hash = hash;
            _remoteControl.salt = salt;
            _remoteControl.iterations = REMOTE_HASH_ITERATIONS;
            _remoteControl.sessions.clear();
            _remoteControl.challenges.clear();
            _remoteControl.failures.clear();
            _remotePersistConfig();
            const passEl = document.getElementById('rm-remote-password');
            if (passEl) passEl.value = '';
            _remoteUpdateUI();
        }

        function _remoteSessionValid(conn, token) {
            if (!_remoteControl.enabled) return false;
            if (!token) return false;
            _remotePrune();
            const sess = _remoteControl.sessions.get(String(token));
            if (!sess || sess.peerId !== conn.peer) return false;
            if (sess.expiresAt <= Date.now()) {
                _remoteControl.sessions.delete(String(token));
                return false;
            }
            sess.expiresAt = Date.now() + REMOTE_SESSION_TTL_MS;
            _remoteControl.sessions.set(String(token), sess);
            return true;
        }

        function _remoteAck(conn, rid, ok, reason = '') {
            safePeerSend(conn, {
                type: ROOM_MSG.REMOTE_COMMAND_ACK,
                rid: toTrimmedString(rid, 80),
                ok: !!ok,
                reason: toTrimmedString(reason, 120),
                at: Date.now(),
            });
        }

        function _remoteRunCommand(command, payload) {
            const cmd = toTrimmedString(command, 40).toLowerCase();
            const deck = ViewerRuntime.revealDeck;
            switch (cmd) {
                case 'next':
                    if (typeof PresenterControls.goNext === 'function') { PresenterControls.goNext(); return { ok: true }; }
                    if (deck) { deck.next(); return { ok: true }; }
                    return { ok: false, reason: 'Navigation indisponible' };
                case 'prev':
                    if (typeof PresenterControls.goPrev === 'function') { PresenterControls.goPrev(); return { ok: true }; }
                    if (deck) { deck.prev(); return { ok: true }; }
                    return { ok: false, reason: 'Navigation indisponible' };
                case 'goto': {
                    const idx = toIntOrNull(payload?.index);
                    if (idx === null || idx < 0) return { ok: false, reason: 'Index invalide' };
                    if (typeof PresenterControls.goTo === 'function') { PresenterControls.goTo(idx); return { ok: true }; }
                    if (deck) { deck.slide(idx, 0, -1); return { ok: true }; }
                    return { ok: false, reason: 'Navigation indisponible' };
                }
                case 'black':
                    if (typeof PresenterControls.toggleBlack === 'function') { PresenterControls.toggleBlack(); return { ok: true }; }
                    return { ok: false, reason: 'Écran noir indisponible' };
                case 'timer-toggle':
                    if (typeof PresenterControls.timerToggle === 'function') { PresenterControls.timerToggle(); return { ok: true }; }
                    return { ok: false, reason: 'Minuteur indisponible' };
                case 'timer-reset':
                    if (typeof PresenterControls.timerReset === 'function') { PresenterControls.timerReset(); return { ok: true }; }
                    return { ok: false, reason: 'Minuteur indisponible' };
                case 'salle':
                    if (typeof PresenterControls.switchTab === 'function') { PresenterControls.switchTab('salle'); return { ok: true }; }
                    return { ok: false, reason: 'Vue salle indisponible' };
                default:
                    return { ok: false, reason: 'Commande inconnue' };
            }
        }

        function _roomEsc(s) {
            return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        function _roomCurrentSlideIndex() {
            if (ViewerRuntime.revealDeck) return ViewerRuntime.revealDeck.getState().indexh || 0;
            return Number(ViewerRuntime.presenterCurrentIndex || 0);
        }

        function _roomCurrentFragmentIndex() {
            if (ViewerRuntime.revealDeck) {
                const n = toIntOrNull(ViewerRuntime.revealDeck.getIndices?.().f ?? -1);
                return n === null ? -1 : n;
            }
            const n = toIntOrNull(ViewerRuntime.presenterCurrentFragment);
            return n === null ? -1 : n;
        }

        function _roomBuildInitMessage() {
            if (!_presentationData) return null;
            const slides = (_presentationData.slides || []).filter(s => !s.hidden);
            const opts = {
                showSlideNumber: false,
                footerText: null,
                totalSlides: slides.length,
                typography: SlidesShared.resolveTypographyDefaults(_presentationData.typography),
            };
            return {
                type: ROOM_MSG.INIT,
                title: _presentationData.metadata?.title || 'Présentation',
                slideCount: slides.length,
                currentIndex: _roomCurrentSlideIndex(),
                currentFragmentOrder: _roomCurrentFragmentIndex(),
                themeCSS: document.getElementById('sl-theme-css')?.textContent || '',
                slidesHtml: slides.map((slide, i) => SlidesRenderer.renderSlide(slide, i, opts)),
            };
        }

        function _roomSendInit(conn) {
            if (!conn || !conn.open) return false;
            const payload = _roomBuildInitMessage();
            if (!payload) return false;
            return safePeerSend(conn, payload);
        }

        function _roomAck(conn, rid, ok = true, reason = '') {
            if (!conn || !conn.open) return;
            const safeRid = toTrimmedString(rid, 120);
            if (!safeRid) return;
            safePeerSend(conn, {
                type: ROOM_MSG.ACK,
                rid: safeRid,
                ok: !!ok,
                reason: toTrimmedString(reason, 120),
                at: Date.now(),
            });
        }

        function _roomPruneSeen(peerId = '') {
            const now = Date.now();
            if (peerId) {
                const seen = _roomSeenByPeer.get(peerId);
                if (!seen) return;
                for (const [rid, ts] of seen.entries()) {
                    if ((now - ts) > ROOM_SEEN_TTL_MS) seen.delete(rid);
                }
                if (!seen.size) _roomSeenByPeer.delete(peerId);
                return;
            }
            for (const [pid, seen] of _roomSeenByPeer.entries()) {
                for (const [rid, ts] of seen.entries()) {
                    if ((now - ts) > ROOM_SEEN_TTL_MS) seen.delete(rid);
                }
                if (!seen.size) _roomSeenByPeer.delete(pid);
            }
        }

        function _roomRememberRid(peerId, rid) {
            const pid = toTrimmedString(peerId, 120);
            const key = toTrimmedString(rid, 120);
            if (!pid || !key) return;
            _roomPruneSeen(pid);
            const seen = _roomSeenByPeer.get(pid) || new Map();
            seen.set(key, Date.now());
            _roomSeenByPeer.set(pid, seen);
        }

        function _roomIsDuplicateRid(peerId, rid) {
            const pid = toTrimmedString(peerId, 120);
            const key = toTrimmedString(rid, 120);
            if (!pid || !key) return false;
            _roomPruneSeen(pid);
            return !!_roomSeenByPeer.get(pid)?.has(key);
        }

        function _relayWsOpen() {
            return !!(_relayRoom.ws && _relayRoom.ws.readyState === WebSocket.OPEN);
        }

        function _relaySendRaw(payload) {
            if (!_relayWsOpen()) return false;
            try {
                _relayRoom.ws.send(JSON.stringify(payload));
                return true;
            } catch (e) {
                return false;
            }
        }

        function _relaySendDirect(peerId, message) {
            const target = toTrimmedString(peerId, 160);
            if (!target || !message) return false;
            return _relaySendRaw({
                type: 'relay:direct',
                roomId: _relayRoom.roomId,
                token: RELAY_OPTIONS.token || '',
                to: target,
                message,
                at: Date.now(),
            });
        }

        function _relaySendBroadcast(message) {
            if (!message) return false;
            return _relaySendRaw({
                type: 'relay:broadcast',
                roomId: _relayRoom.roomId,
                token: RELAY_OPTIONS.token || '',
                message,
                at: Date.now(),
            });
        }

        function _relayConnectionFor(peerId) {
            const pid = toTrimmedString(peerId, 160) || `relay-${Math.random().toString(36).slice(2, 8)}`;
            const existing = _relayRoom.peers.get(pid);
            if (existing) return existing;
            const relayConn = {
                peer: pid,
                open: true,
                __transport: 'relay',
                send: payload => _relaySendDirect(pid, payload),
            };
            _relayRoom.peers.set(pid, relayConn);
            return relayConn;
        }

        function _relayHandleIncoming(raw) {
            if (!raw || typeof raw !== 'object') return;
            const envelope = raw;
            const msg = (envelope.message && typeof envelope.message === 'object')
                ? envelope.message
                : ((envelope.payload && typeof envelope.payload === 'object') ? envelope.payload : null);
            if (!msg) return;
            const from = toTrimmedString(
                envelope.from || envelope.peerId || envelope.clientId || envelope.source,
                160
            ) || 'relay-anon';
            const conn = _relayConnectionFor(from);
            roomHandleIncoming(conn, msg);
        }

        function _relayClearReconnectTimer() {
            if (_relayRoom.reconnectTimer) {
                clearTimeout(_relayRoom.reconnectTimer);
                _relayRoom.reconnectTimer = null;
            }
        }

        function _relayScheduleReconnect(reason = '') {
            if (!_room.active || !RELAY_OPTIONS.enabled || !RELAY_OPTIONS.wsUrl) return;
            if (_relayRoom.reconnectTimer) return;
            _relayRoom.reconnectAttempts += 1;
            const delay = _reconnectDelayMs(_relayRoom.reconnectAttempts);
            _roomSetStatus(`Relay déconnecté, reconnexion…${reason ? ` (${reason})` : ''}`, 'warn');
            _relayRoom.reconnectTimer = setTimeout(() => {
                _relayRoom.reconnectTimer = null;
                _relayOpen(_relayRoom.roomId);
            }, delay);
        }

        function _relayOpen(roomId) {
            if (!RELAY_OPTIONS.enabled || !RELAY_OPTIONS.wsUrl || !roomId) return;
            _relayClearReconnectTimer();
            if (_relayRoom.ws) {
                try { _relayRoom.ws.close(); } catch (e) {}
                _relayRoom.ws = null;
            }
            _relayRoom.roomId = String(roomId);
            try {
                _relayRoom.ws = new WebSocket(RELAY_OPTIONS.wsUrl);
            } catch (e) {
                _relayScheduleReconnect('ws-init');
                return;
            }
            _relayRoom.ws.addEventListener('open', () => {
                _relayRoom.active = true;
                _relayRoom.reconnectAttempts = 0;
                _relaySendRaw({
                    type: 'relay:join',
                    role: 'presenter',
                    roomId: _relayRoom.roomId,
                    token: RELAY_OPTIONS.token || '',
                    at: Date.now(),
                });
                _roomSetStatus('Salle active (P2P + relay).', 'ok');
            });
            _relayRoom.ws.addEventListener('message', ev => {
                let parsed = null;
                try { parsed = JSON.parse(String(ev.data || '')); } catch (e) { return; }
                if (Array.isArray(parsed)) {
                    parsed.forEach(_relayHandleIncoming);
                    return;
                }
                if (parsed?.type === 'relay:error') {
                    _roomSetStatus(`Relay: ${_roomEsc(parsed.reason || 'erreur')}`, 'warn');
                    return;
                }
                _relayHandleIncoming(parsed);
            });
            _relayRoom.ws.addEventListener('close', () => {
                _relayRoom.active = false;
                _relayRoom.ws = null;
                _relayRoom.peers.clear();
                _relayScheduleReconnect('close');
            });
            _relayRoom.ws.addEventListener('error', () => {
                _relayRoom.active = false;
                _roomSetStatus('Relay en erreur (fallback indisponible).', 'warn');
            });
        }

        function _relayClose() {
            _relayClearReconnectTimer();
            _relayRoom.reconnectAttempts = 0;
            _relayRoom.active = false;
            _relayRoom.roomId = '';
            const relayPeers = new Set(_relayRoom.peers.keys());
            relayPeers.forEach(pid => {
                delete _room.students[pid];
                _roomFeedback.lastByPeer.delete(pid);
                _roomSeenByPeer.delete(pid);
            });
            for (let i = _roomHands.length - 1; i >= 0; i--) {
                if (relayPeers.has(_roomHands[i].peerId)) _roomHands.splice(i, 1);
            }
            _relayRoom.peers.clear();
            if (_relayRoom.ws) {
                try { _relayRoom.ws.close(); } catch (e) {}
                _relayRoom.ws = null;
            }
            roomUpdatePanel();
        }

        function roomBroadcast(msg) {
            broadcastPeers(_room.connections, msg);
            if (_relayRoom.active) _relaySendBroadcast(msg);
        }

        function roomQuestionStats() {
            let open = 0;
            let resolved = 0;
            let pinned = 0;
            _roomQuestions.forEach(q => {
                if (q.read || q.hidden) return;
                if (q.pinned) pinned++;
                if (q.resolved) resolved++;
                else open++;
            });
            return { open, resolved, pinned, total: open + resolved };
        }

        function roomQuestionComparator(a, b) {
            if (!!a.hidden !== !!b.hidden) return a.hidden ? 1 : -1;
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1;
            const av = Number(a.votes) || 0;
            const bv = Number(b.votes) || 0;
            if (av !== bv) return bv - av;
            return (b.time || 0) - (a.time || 0);
        }

        function roomFilteredQuestions() {
            const active = _roomQuestions.filter(q => !q.read);
            switch (_roomQuestionFilter) {
                case 'pinned':
                    return active.filter(q => !q.hidden && !!q.pinned).sort(roomQuestionComparator);
                case 'resolved':
                    return active.filter(q => !q.hidden && !!q.resolved).sort(roomQuestionComparator);
                case 'hidden':
                    return active.filter(q => !!q.hidden).sort(roomQuestionComparator);
                case 'all':
                    return active.sort(roomQuestionComparator);
                case 'open':
                default:
                    return active.filter(q => !q.hidden && !q.resolved).sort(roomQuestionComparator);
            }
        }

        function roomFeedbackMeta(kind) {
            const map = {
                fast: { iconKey: 'feedback_fast', label: 'Trop rapide' },
                unclear: { iconKey: 'feedback_unclear', label: 'Pas clair' },
                pause: { iconKey: 'feedback_pause', label: 'Besoin de pause' },
                clear: { iconKey: 'feedback_clear', label: 'OK' },
            };
            return map[String(kind || '').toLowerCase()] || { iconKey: 'question', label: 'Feedback' };
        }

        function roomFeedbackPrune(maxAgeMs = 20 * 60 * 1000) {
            const now = Date.now();
            _roomFeedback.events = _roomFeedback.events.filter(evt => (now - evt.time) <= maxAgeMs);
            for (const [peerId, ts] of _roomFeedback.lastByPeer.entries()) {
                if ((now - ts) > maxAgeMs) _roomFeedback.lastByPeer.delete(peerId);
            }
            if (_roomFeedback.events.length > 240) _roomFeedback.events.length = 240;
        }

        function roomFeedbackStats(windowMs = 10 * 60 * 1000) {
            roomFeedbackPrune();
            const now = Date.now();
            const counts = { fast: 0, unclear: 0, pause: 0, clear: 0, other: 0 };
            _roomFeedback.events.forEach(evt => {
                if ((now - evt.time) > windowMs) return;
                const kind = String(evt.kind || '').toLowerCase();
                if (Object.prototype.hasOwnProperty.call(counts, kind)) counts[kind]++;
                else counts.other++;
            });
            const total = counts.fast + counts.unclear + counts.pause + counts.clear + counts.other;
            return { counts, total };
        }

        function roomAudienceQrUrl() {
            const roomIdVal = document.getElementById('rm-room-id-input')?.value.trim() || '';
            return _room.studentUrl || (roomIdVal ? _buildStudentUrl(roomIdVal) : '');
        }

        function roomAudienceRelayUrl() {
            const roomIdVal = document.getElementById('rm-room-id-input')?.value.trim() || '';
            if (!roomIdVal) return '';
            return _buildStudentUrl(roomIdVal, 'relay');
        }

        function roomCopyWithFeedback(btn, text, label = 'Copier') {
            if (!btn || !text) return;
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = `${iconOnly('check')}<span>Copié</span>`;
                setTimeout(() => {
                    if (!btn.isConnected) return;
                    btn.innerHTML = `${iconOnly('copy')}<span>${label}</span>`;
                }, 1200);
            }).catch(() => {});
        }

        function roomUpdateNetworkDiagnostics() {
            const statusEl = document.getElementById('rm-network-status');
            const hintEl = document.getElementById('rm-network-hint');
            const copyAutoBtn = document.getElementById('rm-network-copy-auto');
            const copyRelayBtn = document.getElementById('rm-network-copy-relay');
            const retryRelayBtn = document.getElementById('rm-network-retry-relay');
            const roomIdVal = toTrimmedString(document.getElementById('rm-room-id-input')?.value || '', 80);
            const autoUrl = roomIdVal ? _buildStudentUrl(roomIdVal, 'auto') : '';
            const relayUrl = roomIdVal ? _buildStudentUrl(roomIdVal, 'relay') : '';
            const relayConfigured = !!(RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl);
            const transportState = !_room.active ? 'Salle fermée' : (_relayRoom.active ? 'P2P + relay' : 'P2P');
            const relayState = !relayConfigured
                ? 'Relay non configuré'
                : (_relayRoom.active ? 'Relay connecté' : (_room.active ? 'Relay en reconnexion' : 'Relay prêt'));

            if (statusEl) statusEl.textContent = `${transportState} · ${relayState}`;
            if (hintEl) {
                hintEl.textContent = relayConfigured
                    ? 'Si certains étudiants sont bloqués (ex: eduroam), partagez le lien "Forcer relay".'
                    : 'Ajoutez relayWs pour offrir un fallback réseau en plus du P2P.';
            }
            if (copyAutoBtn) {
                copyAutoBtn.disabled = !autoUrl;
                copyAutoBtn.innerHTML = `${iconOnly('copy')}<span>Copier lien auto</span>`;
                copyAutoBtn.onclick = () => roomCopyWithFeedback(copyAutoBtn, autoUrl, 'Copier lien auto');
            }
            if (copyRelayBtn) {
                copyRelayBtn.disabled = !(relayConfigured && relayUrl);
                copyRelayBtn.innerHTML = `${iconOnly('copy')}<span>Copier lien relay</span>`;
                copyRelayBtn.onclick = () => roomCopyWithFeedback(copyRelayBtn, relayUrl, 'Copier lien relay');
            }
            if (retryRelayBtn) {
                retryRelayBtn.disabled = !_room.active || !relayConfigured;
            }
        }

        function roomUpdateQrButtonsUI() {
            const toolbarBtn = document.getElementById('pv-btn-room-quick');
            if (toolbarBtn) {
                if (!_room.active) {
                    toolbarBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> Ouvrir salle';
                    toolbarBtn.classList.remove('active');
                } else if (_pvQrVisible) {
                    toolbarBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Masquer QR';
                    toolbarBtn.classList.add('active');
                } else {
                    toolbarBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Afficher QR';
                    toolbarBtn.classList.remove('active');
                }
            }
        }

        function roomSetAudienceQrVisibility(show) {
            const shouldShow = !!show;
            const url = roomAudienceQrUrl();
            if (shouldShow && (!url || !_room.active)) return false;
            _pvQrVisible = shouldShow;
            _postPresenterSync({ type: SYNC_MSG.ROOM_QR, show: shouldShow, url: shouldShow ? url : '' });
            roomUpdateQrButtonsUI();
            return true;
        }

        function roomUpdatePanel() {
            const students = Object.values(_room.students);
            const n = students.length;
            const handsN = _roomHands.length;
            const qStats = roomQuestionStats();
            const questionsN = qStats.open;
            const feedbackStats10m = roomFeedbackStats(10 * 60 * 1000);
            const feedbackStats2m = roomFeedbackStats(2 * 60 * 1000);
            const feedbackUrgentN = feedbackStats2m.counts.fast + feedbackStats2m.counts.unclear + feedbackStats2m.counts.pause;

            // Mise à jour badges tabs
            const setCnt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setCnt('rm-cnt-students', n);
            setCnt('rm-cnt-hands', handsN);
            setCnt('rm-cnt-questions', questionsN);

            // Tabs visibles uniquement si salle active
            const tabs = document.getElementById('rm-tabs');
            if (tabs) tabs.style.display = _room.active ? '' : 'none';

            // ── Onglet Étudiants ─────────────────────────────
            const studentsEl = document.getElementById('sl-room-students');
            if (studentsEl) {
                clearNode(studentsEl);
                if (n === 0) {
                    studentsEl.appendChild(el('span', { className: 'rm-empty-text', text: 'En attente d\'étudiants…' }));
                } else {
                    const sorted = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));
                    const hasScores = sorted.some(s => s.score > 0);
                    const medals = ['🥇','🥈','🥉'];
                    const summary = el('div', { className: 'rm-students-summary' });
                    const dot = el('span');
                    dot.innerHTML = UI_ICONS.dot;
                    summary.appendChild(dot);
                    summary.appendChild(document.createTextNode(`${n} étudiant(s) connecté(s)`));

                    const list = el('div', { className: 'rm-student-list' });
                    sorted.forEach((s, i) => {
                        const medal = medals[i] || `${i+1}.`;
                        const row = el('div', { className: 'rm-student-row' });
                        row.appendChild(el('span', { className: 'rm-student-rank', text: medal }));
                        const name = el('span', { className: 'rm-student-name' });
                        if (s.handRaised) {
                            const hand = el('span', { className: 'rm-hand-mark' });
                            hand.innerHTML = UI_ICONS.hand;
                            name.appendChild(hand);
                        }
                        name.appendChild(document.createTextNode(String(s.pseudo || 'Anonyme')));
                        row.appendChild(name);
                        if (hasScores) row.appendChild(el('span', { className: 'rm-student-score', text: `${(s.score || 0).toLocaleString()} pts` }));
                        list.appendChild(row);
                    });
                    appendAll(studentsEl, [summary, list]);
                }
            }

            // ── Onglet Mains ─────────────────────────────────
            const handsList = document.getElementById('rm-hands-list');
            const lowerAll = document.getElementById('rm-lower-all');
            if (handsList) {
                clearNode(handsList);
                if (handsN === 0) {
                    handsList.appendChild(el('span', { className: 'rm-empty-text', text: 'Aucune main levée.' }));
                } else {
                    _roomHands.forEach(h => {
                        const row = el('div', { className: 'rm-hand-row' });
                        const handIcon = el('span', { className: 'rm-hand-icon' });
                        handIcon.innerHTML = UI_ICONS.hand;
                        const name = el('span', { className: 'rm-student-name', text: String(h.pseudo || 'Anonyme') });
                        const btn = el('button', { className: 'rm-lower-btn', text: 'Baisser' });
                        btn.dataset.peer = h.peerId;
                        appendAll(row, [handIcon, name, btn]);
                        handsList.appendChild(row);
                    });
                    handsList.querySelectorAll('.rm-lower-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const peerId = btn.dataset.peer;
                            const conn = _room.connections.find(c => c.peer === peerId && c.open);
                            if (conn) { try { conn.send({ type: ROOM_MSG.HAND_LOWER }); } catch(e) {} }
                            // Retirer de la liste locale
                            const idx = _roomHands.findIndex(h => h.peerId === peerId);
                            if (idx !== -1) _roomHands.splice(idx, 1);
                            if (_room.students[peerId]) _room.students[peerId].handRaised = false;
                            roomUpdatePanel();
                        });
                    });
                }
                if (lowerAll) lowerAll.style.display = handsN > 1 ? '' : 'none';
            }

            // ── Onglet Questions ──────────────────────────────
            const questionsList = document.getElementById('rm-questions-list');
            const questionFilterEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('rm-question-filter'));
            const questionMarkAllBtn = document.getElementById('rm-question-mark-all');
            if (questionFilterEl) questionFilterEl.value = _roomQuestionFilter;
            if (questionMarkAllBtn) questionMarkAllBtn.disabled = qStats.total === 0;
            if (questionsList) {
                const visible = roomFilteredQuestions();
                clearNode(questionsList);
                if (visible.length === 0) {
                    const emptyByFilter = {
                        open: 'Aucune question ouverte.',
                        pinned: 'Aucune question épinglée.',
                        resolved: 'Aucune question résolue.',
                        hidden: 'Aucune question masquée.',
                        all: 'Aucune question.',
                    };
                    questionsList.appendChild(el('span', { className: 'rm-empty-text', text: emptyByFilter[_roomQuestionFilter] || 'Aucune question.' }));
                } else {
                    visible.forEach(q => {
                        const ago = Math.round((Date.now() - q.time) / 1000);
                        const agoStr = ago < 60 ? `${ago}s` : `${Math.round(ago/60)}min`;
                        const row = el('div', { className: `rm-question-row${q.pinned ? ' pinned' : ''}${q.resolved ? ' resolved' : ''}${q.hidden ? ' hidden' : ''}` });
                        const head = el('div', { className: 'rm-question-head' });
                        const text = el('div', { className: 'rm-question-text', text: String(q.text || '') });
                        const dismissBtn = el('button', { className: 'rm-question-dismiss', text: q.hidden ? 'Restaurer' : 'Masquer' });
                        head.appendChild(text);
                        head.appendChild(dismissBtn);
                        row.appendChild(head);
                        const meta = el('div', { className: 'rm-question-meta' });
                        meta.appendChild(el('span', { className: 'rm-question-time', text: agoStr }));
                        meta.appendChild(el('span', { className: 'rm-question-pill', text: `${q.votes || 1} vote(s)` }));
                        if (q.pinned) meta.appendChild(el('span', { className: 'rm-question-pill pinned', text: 'Épinglée' }));
                        if (q.resolved) meta.appendChild(el('span', { className: 'rm-question-pill resolved', text: 'Résolue' }));
                        if (q.hidden) meta.appendChild(el('span', { className: 'rm-question-pill hidden', text: 'Masquée' }));
                        row.appendChild(meta);

                        const actions = el('div', { className: 'rm-question-actions' });
                        const hideBtn = el('button', { className: `rm-question-mini${q.hidden ? ' active' : ''}`, text: q.hidden ? 'Restaurer' : 'Masquer' });
                        const pinBtn = el('button', { className: `rm-question-mini${q.pinned ? ' active' : ''}`, text: q.pinned ? 'Désépingler' : 'Épingler' });
                        const resolveBtn = el('button', { className: `rm-question-mini${q.resolved ? ' active' : ''}`, text: q.resolved ? 'Rouvrir' : 'Résoudre' });
                        const archiveBtn = el('button', { className: 'rm-question-mini', text: 'Archiver' });
                        if (q.hidden) {
                            pinBtn.disabled = true;
                            resolveBtn.disabled = true;
                        }
                        appendAll(actions, [hideBtn, pinBtn, resolveBtn, archiveBtn]);
                        row.appendChild(actions);

                        dismissBtn.addEventListener('click', () => {
                            q.hidden = !q.hidden;
                            if (q.hidden) {
                                q.pinned = false;
                                q.resolved = false;
                            }
                            roomUpdatePanel();
                        });
                        hideBtn.addEventListener('click', () => {
                            q.hidden = !q.hidden;
                            if (q.hidden) {
                                q.pinned = false;
                                q.resolved = false;
                            }
                            roomUpdatePanel();
                        });
                        archiveBtn.addEventListener('click', () => {
                            q.read = true;
                            roomUpdatePanel();
                        });
                        pinBtn.addEventListener('click', () => {
                            if (q.hidden) return;
                            q.pinned = !q.pinned;
                            roomUpdatePanel();
                        });
                        resolveBtn.addEventListener('click', () => {
                            if (q.hidden) return;
                            q.resolved = !q.resolved;
                            if (q.resolved) q.pinned = false;
                            roomUpdatePanel();
                        });
                        questionsList.appendChild(row);
                    });
                }
            }

            // ── Onglet Outils: résultats sondage en direct ────
            if (_activePoll) {
                const pollResults = document.getElementById('rm-poll-results');
                if (pollResults) {
                    const snap = _roomBridgeSnapshotPoll();
                    const labels = Array.isArray(snap.options) && snap.options.length ? snap.options : ['A', 'B'];
                    const counts = Array.isArray(snap.counts) ? snap.counts : labels.map(() => 0);
                    const total = Number(snap.total || 0);
                    const totalSelections = Number(snap.totalSelections || 0);
                    const denom = snap.multi ? (totalSelections || 1) : (total || 1);
                    const bars = labels.map((label, i) => {
                        const cnt = counts[i] || 0;
                        const pct = denom ? Math.round(cnt / denom * 100) : 0;
                        return `<div class="rm-poll-bar-row">
                            <span class="rm-poll-label">${_roomEsc(label)}</span>
                            <div class="rm-poll-bar-wrap"><div class="rm-poll-bar-fill" style="width:${pct}%"></div></div>
                            <span class="rm-poll-count">${cnt} (${pct}%)</span>
                        </div>`;
                    }).join('');
                    const totalLabel = snap.multi
                        ? `${total} répondant(s) · ${totalSelections} sélections`
                        : `${total} réponse(s)`;
                    pollResults.innerHTML = `<div class="rm-poll-total">${totalLabel}</div>${bars}`;
                }
            }

            // ── Nuage: compteur ────────────────────────────────
            if (_activeWordCloud) {
                const countEl = document.getElementById('rm-cloud-count');
                if (countEl) {
                    const total = [..._activeWordCloud.words.values()].reduce((a, b) => a + b, 0);
                    countEl.textContent = `${_activeWordCloud.words.size} mots distincts · ${total} soumissions`;
                }
            }

            // ── Outils: feedback discret ───────────────────────
            const feedbackSummary = document.getElementById('rm-feedback-summary');
            if (feedbackSummary) {
                const rows = [
                    { kind: 'fast', count: feedbackStats10m.counts.fast },
                    { kind: 'unclear', count: feedbackStats10m.counts.unclear },
                    { kind: 'pause', count: feedbackStats10m.counts.pause },
                    { kind: 'clear', count: feedbackStats10m.counts.clear },
                ];
                feedbackSummary.innerHTML = rows.map(({ kind, count }) => {
                    const meta = roomFeedbackMeta(kind);
                    return `<span class=\"rm-feedback-pill\">${iconOnly(meta.iconKey)}<span>${count}</span></span>`;
                }).join('');
            }
            const feedbackList = document.getElementById('rm-feedback-list');
            if (feedbackList) {
                const recent = _roomFeedback.events.slice(0, 8);
                if (!recent.length) {
                    feedbackList.innerHTML = '<div class="rm-feedback-empty">Aucun feedback récent.</div>';
                } else {
                    feedbackList.innerHTML = recent.map(evt => {
                        const meta = roomFeedbackMeta(evt.kind);
                        const ago = Math.max(0, Math.round((Date.now() - evt.time) / 1000));
                        const agoStr = ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}min`;
                        const txt = toTrimmedString(evt.text, 80);
                        return `<div class=\"rm-feedback-row\"><span>${iconOnly(meta.iconKey)}</span><span>${_roomEsc(meta.label)}</span>${txt ? `<span>· ${_roomEsc(txt)}</span>` : ''}<span class=\"rm-feedback-time\">${agoStr}</span></div>`;
                    }).join('');
                }
            }
            const feedbackResetBtn = document.getElementById('rm-feedback-reset');
            if (feedbackResetBtn) feedbackResetBtn.disabled = feedbackStats10m.total === 0;

            // ── Bouton toolbar ────────────────────────────────
            const btn = document.getElementById('btn-student-room');
            if (btn) {
                const handBadge = handsN > 0 ? `<span class="rm-toolbar-badge">${UI_ICONS.hand}<span>${handsN}</span></span>` : '';
                const qBadge = questionsN > 0 ? `<span class="rm-toolbar-badge">${UI_ICONS.question}<span>${questionsN}</span></span>` : '';
                btn.innerHTML = _room.active
                    ? `${UI_ICONS.users}<span>${n}</span>${handBadge}${qBadge}`
                    : withIcon('users', 'Salle');
                btn.classList.toggle('active', _room.active);
            }
            roomUpdateQrButtonsUI();
            roomUpdateNetworkDiagnostics();
            const modeLabel = _room.active
                ? (_relayRoom.active ? 'P2P + relay' : 'P2P')
                : 'Salle fermée';
            const remoteSessions = _remoteActiveSessionsCount();
            const pvRoomStatusBar = document.getElementById('pv-room-status-bar');
            if (pvRoomStatusBar) {
                const urgentLabel = feedbackUrgentN > 0 ? `<span class="pv-room-status-pill warn">${iconOnly('feedback_unclear')}<span>${feedbackUrgentN} urgent</span></span>` : '';
                const remoteLabel = remoteSessions > 0
                    ? `<span class="pv-room-status-pill">${iconOnly('remote')}<span>${remoteSessions} mobile</span></span>`
                    : '';
                pvRoomStatusBar.innerHTML = `<span class="pv-room-status-pill ${_room.active ? 'ok' : ''}">${iconOnly(_room.active ? 'check' : 'stop')}<span>${_roomEsc(modeLabel)}</span></span>
                    <span class="pv-room-status-pill">${iconOnly('users')}<span>${n}</span></span>
                    <span class="pv-room-status-pill">${iconOnly('hand')}<span>${handsN}</span></span>
                    <span class="pv-room-status-pill">${iconOnly('question')}<span>${questionsN}</span></span>
                    ${urgentLabel}
                    ${remoteLabel}`;
            }
            const pvRoomMini = document.getElementById('pv-room-mini');
            if (pvRoomMini) {
                const views = [
                    { id: 'status', cls: _room.active ? 'ok' : '', icon: _room.active ? 'check' : 'stop', text: modeLabel },
                    { id: 'users', cls: '', icon: 'users', text: String(n) },
                    { id: 'hands', cls: '', icon: 'hand', text: String(handsN) },
                    { id: 'questions', cls: '', icon: 'question', text: String(questionsN) },
                ];
                if (feedbackUrgentN > 0) views.push({ id: 'urgent', cls: 'warn', icon: 'feedback_unclear', text: `${feedbackUrgentN}` });
                if (remoteSessions > 0) views.push({ id: 'remote', cls: '', icon: 'remote', text: String(remoteSessions) });
                if (!views.some(v => v.id === _pvContextView)) _pvContextView = 'status';
                pvRoomMini.innerHTML = views.map(v => (
                    `<button type="button" class="pv-room-mini-pill ${v.cls} ${_pvContextView === v.id ? 'active' : ''}" data-pv-view="${v.id}">${iconOnly(v.icon)}<span>${_roomEsc(v.text)}</span></button>`
                )).join('');
                pvRoomMini.querySelectorAll('[data-pv-view]').forEach(btnEl => {
                    btnEl.addEventListener('click', () => {
                        const nextView = toTrimmedString(btnEl.getAttribute('data-pv-view'), 24);
                        if (nextView && nextView !== _pvContextView) {
                            _pvContextView = nextView;
                            roomUpdatePanel();
                        }
                    });
                });
            }
            const pvContextDynamic = document.getElementById('pv-context-dynamic');
            if (pvContextDynamic) {
                const roomId = toTrimmedString(document.getElementById('rm-room-id-input')?.value || '', 80) || '—';
                const stableUrl = roomAudienceQrUrl();
                const handsList = _roomHands.slice(0, 4).map(h => `<li>${_roomEsc(h.pseudo || h.peerId || 'Étudiant')}</li>`).join('');
                const openQuestions = _roomQuestions
                    .filter(q => !q.read && !q.hidden && !q.resolved)
                    .slice(0, 3)
                    .map(q => `<li>${_roomEsc(toTrimmedString(q.text, 120))}</li>`)
                    .join('');
                const studentsList = Object.values(_room.students).slice(0, 5).map(s => `<li>${_roomEsc(s.pseudo || 'Étudiant')}</li>`).join('');
                if (_pvContextView === 'users') {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>Connectés: ${n}</strong><span class="pv-context-dynamic-meta">${modeLabel}</span></div>${studentsList ? `<ul class="pv-context-dynamic-list">${studentsList}</ul>` : '<div class="pv-context-dynamic-meta">Aucun étudiant connecté.</div>'}`;
                } else if (_pvContextView === 'hands') {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>Mains levées: ${handsN}</strong><span class="pv-context-dynamic-meta">interventions</span></div>${handsList ? `<ul class="pv-context-dynamic-list">${handsList}</ul>` : '<div class="pv-context-dynamic-meta">Aucune main levée.</div>'}`;
                } else if (_pvContextView === 'questions') {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>Questions ouvertes: ${questionsN}</strong><span class="pv-context-dynamic-meta">modération</span></div>${openQuestions ? `<ul class="pv-context-dynamic-list">${openQuestions}</ul>` : '<div class="pv-context-dynamic-meta">Aucune question ouverte.</div>'}`;
                } else if (_pvContextView === 'urgent') {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>Alertes urgentes: ${feedbackUrgentN}</strong><span class="pv-context-dynamic-meta">2 dernières minutes</span></div><div class="pv-context-dynamic-meta">Feedback rapide/non clair/pause.</div>`;
                } else if (_pvContextView === 'remote') {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>Mobiles actifs: ${remoteSessions}</strong><span class="pv-context-dynamic-meta">sessions contrôleur</span></div><div class="pv-context-dynamic-meta">Gestion complète dans Salle > Technique.</div>`;
                } else {
                    pvContextDynamic.innerHTML = `<div class="pv-context-dynamic-row"><strong>${_roomEsc(modeLabel)}</strong><span class="pv-context-dynamic-meta">ID: ${_roomEsc(roomId)}</span></div>
                        <div class="pv-context-dynamic-row">
                            <button class="pv-context-action-btn" id="pv-context-copy-stable" ${stableUrl ? '' : 'disabled'}>${iconOnly('copy')}<span>Copier lien stable</span></button>
                            <button class="pv-context-action-btn" id="pv-context-open-technique">${iconOnly('settings')}<span>Salle technique</span></button>
                        </div>`;
                    document.getElementById('pv-context-copy-stable')?.addEventListener('click', () => {
                        if (!stableUrl) return;
                        navigator.clipboard.writeText(stableUrl).then(() => {
                            const btnCopy = document.getElementById('pv-context-copy-stable');
                            if (!btnCopy) return;
                            btnCopy.innerHTML = `${iconOnly('check')}<span>Copié</span>`;
                            setTimeout(() => {
                                const freshBtn = document.getElementById('pv-context-copy-stable');
                                if (freshBtn) freshBtn.innerHTML = `${iconOnly('copy')}<span>Copier lien stable</span>`;
                            }, 1200);
                        });
                    });
                    document.getElementById('pv-context-open-technique')?.addEventListener('click', () => {
                        const roomModal = document.getElementById('sl-room-modal');
                        if (!roomModal) return;
                        switchRoomPresenterMode('technique', true);
                        roomModal.classList.add('open');
                        roomUpdatePanel();
                    });
                }
            }

            _roomBridgeEmit('room', _roomBridgeSnapshotRoom());
            _remoteUpdateUI();
        }

        // Alias pour compatibilité (appelé dans roomClose)
        function roomUpdateStudents() { roomUpdatePanel(); }

        // ── Word cloud render ──────────────────────────────────
        function roomRenderWordCloud() {
            if (!_activeWordCloud) return;
            const sorted = [..._activeWordCloud.words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
            const max = sorted[0]?.[1] || 1;
            const colors = ['#818cf8', '#34d399', '#f472b6', '#fb923c', '#60a5fa'];
            const dispEl = document.getElementById('sl-wc-display-presenter');
            if (dispEl) {
                clearNode(dispEl);
                sorted.forEach(([w, c], i) => {
                    const size = Math.round(12 + (c / max) * 42);
                    const word = el('span', { className: 'rm-cloud-word', text: String(w) });
                    word.style.fontSize = `${size}px`;
                    word.style.color = colors[i % 5];
                    dispEl.appendChild(word);
                    dispEl.appendChild(document.createTextNode(' '));
                });
            }
            const total = [..._activeWordCloud.words.values()].reduce((a, b) => a + b, 0);
            const cntEl = document.getElementById('sl-wc-count');
            if (cntEl) cntEl.textContent = `${_activeWordCloud.words.size} mots distincts · ${total} soumissions`;
            // Throttle broadcast vers étudiants
            if (!_wcBroadcastTimer) {
                _wcBroadcastTimer = setTimeout(() => {
                    _wcBroadcastTimer = null;
                    if (_activeWordCloud) {
                        roomBroadcast({ type: ROOM_MSG.WORDCLOUD_UPDATE, cloudId: _activeWordCloud.cloudId, words: sorted });
                        _postPresenterSync({
                            type: SYNC_MSG.WORDCLOUD_UPDATE,
                            cloudId: _activeWordCloud.cloudId,
                            prompt: _activeWordCloud.prompt || '',
                            words: sorted,
                        });
                    }
                }, 500);
            }
            roomUpdatePanel();
        }

        // ── Dashboard render ───────────────────────────────────
        function roomRenderDashboard() {
            const el = document.getElementById('rm-dashboard-content');
            if (!el) return;
            const students = Object.values(_room.students);
            const n = students.length;
            if (n === 0) { el.innerHTML = '<span class="rm-dashboard-empty">Aucun étudiant connecté.</span>'; return; }
            const scores = students.map(s => s.score || 0).filter(s => s > 0);
            const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const top = [...students].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            const fb = roomFeedbackStats(10 * 60 * 1000);
            const resp = ViewerRuntime.lastQuizResponses;
            const opts = ViewerRuntime.lastQuizOptions || [];
            let quizHtml = '';
            if (ViewerRuntime.activeQuizHandler && resp) {
                const answered = Object.keys(resp).length;
                const bars = opts.map((opt, i) => {
                    const cnt = Object.values(resp).filter(v => v === i).length;
                    const pct = answered ? Math.round(cnt / answered * 100) : 0;
                    return `<div class="rm-poll-bar-row">
                        <span class="rm-dashboard-label">${String.fromCharCode(65+i)}</span>
                        <div class="rm-poll-bar-wrap"><div class="rm-poll-bar-fill" style="width:${pct}%"></div></div>
                        <span class="rm-dashboard-count">${cnt}</span>
                    </div>`;
                }).join('');
                const noAns = students.filter(s => resp[s._peerId] === undefined).map(s => _roomEsc(s.pseudo));
                quizHtml = `<div class="rm-dashboard-quiz"><div class="rm-dashboard-quiz-head">Quiz — ${answered}/${n} réponses</div>${bars}</div>`
                    + (noAns.length ? `<div class="rm-dashboard-muted">Sans réponse : ${noAns.join(', ')}</div>` : '');
            }
            const feedbackHtml = fb.total > 0
                ? `<div class="rm-dashboard-muted">Feedback 10 min · ${iconOnly('feedback_fast')} ${fb.counts.fast} · ${iconOnly('feedback_unclear')} ${fb.counts.unclear} · ${iconOnly('feedback_pause')} ${fb.counts.pause} · ${iconOnly('feedback_clear')} ${fb.counts.clear}</div>`
                : '';
            el.innerHTML = `<div class="rm-stat-grid">
                <div class="rm-stat-card"><div class="rm-stat-val">${n}</div><div class="rm-stat-lbl">Connectés</div></div>
                <div class="rm-stat-card"><div class="rm-stat-val">${avgScore > 0 ? avgScore.toLocaleString() : '—'}</div><div class="rm-stat-lbl">Score moy.</div></div>
            </div>
            ${top && top.score > 0 ? `<div class="rm-dashboard-top">🥇 ${_roomEsc(top.pseudo)} — ${(top.score||0).toLocaleString()} pts</div>` : ''}
            ${feedbackHtml}
            ${quizHtml}`;
        }

        function roomStartPoll(typeOrConfig = 'thumbs', prompt = '') {
            if (!_room.active) return false;
            if (_activePoll) return false;
            const pollId = `poll-${Date.now()}`;
            const rawConfig = (typeOrConfig && typeof typeOrConfig === 'object')
                ? typeOrConfig
                : { type: typeOrConfig, prompt };
            const pollType = _normalizePollType(rawConfig.type);
            const pollPrompt = toTrimmedString(rawConfig.prompt, 180);
            const pollOptions = _sanitizePollOptions(pollType, rawConfig.options);
            const isMulti = pollType === 'mcq-multi';
            _activePoll = {
                pollId,
                type: pollType,
                prompt: pollPrompt,
                options: pollOptions,
                multi: isMulti,
                responses: new Map(),
            };
            roomBroadcast({
                type: ROOM_MSG.POLL_START,
                pollId,
                pollType,
                prompt: pollPrompt,
                options: pollOptions,
                multi: isMulti,
            });
            _postPresenterSync({
                type: SYNC_MSG.POLL_START,
                pollId,
                pollType,
                prompt: pollPrompt,
                options: pollOptions,
                multi: isMulti,
            });
            const pd = document.getElementById('rm-poll-prompt-display');
            if (pd) {
                if (pollPrompt) pd.textContent = pollPrompt;
                else if (pollType === 'thumbs') pd.textContent = '👍 Pour / 👎 Contre';
                else if (pollType === 'scale5') pd.textContent = 'Évaluez de 1 à 5';
                else pd.textContent = 'QCM live';
            }
            const launch = document.getElementById('rm-poll-launch');
            const live = document.getElementById('rm-poll-live');
            if (launch) launch.style.display = 'none';
            if (live) live.style.display = '';
            _roomBridgeEmit('poll', _roomBridgeSnapshotPoll());
            roomUpdatePanel();
            return pollId;
        }

        function roomEndPoll() {
            if (_activePoll) {
                roomBroadcast({ type: ROOM_MSG.POLL_END, pollId: _activePoll.pollId });
                _postPresenterSync({ type: SYNC_MSG.POLL_END, pollId: _activePoll.pollId });
            }
            _activePoll = null;
            const launch = document.getElementById('rm-poll-launch');
            const live = document.getElementById('rm-poll-live');
            if (launch) launch.style.display = '';
            if (live) live.style.display = 'none';
            _roomBridgeEmit('poll', _roomBridgeSnapshotPoll());
            roomUpdatePanel();
        }

        function roomStartWordCloud(prompt = '') {
            if (!_room.active) return false;
            if (_activeWordCloud) return false;
            const cloudId = `cloud-${Date.now()}`;
            const safePrompt = toTrimmedString(prompt, 120);
            _activeWordCloud = { cloudId, prompt: safePrompt, words: new Map() };
            roomBroadcast({ type: ROOM_MSG.WORDCLOUD_START, cloudId, prompt: safePrompt });
            _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_START, cloudId, prompt: safePrompt });
            _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_UPDATE, cloudId, prompt: safePrompt, words: [] });
            const launch = document.getElementById('rm-cloud-launch');
            const live = document.getElementById('rm-cloud-live');
            if (launch) launch.style.display = 'none';
            if (live) live.style.display = '';
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) {
                wcOverlay.style.display = 'flex';
                const pr = document.getElementById('sl-wc-prompt-presenter');
                if (pr) pr.textContent = safePrompt;
            }
            _roomBridgeEmit('cloud', _roomBridgeSnapshotCloud());
            roomUpdatePanel();
            return true;
        }

        function roomEndWordCloud() {
            if (_activeWordCloud) {
                roomBroadcast({ type: ROOM_MSG.WORDCLOUD_END, cloudId: _activeWordCloud.cloudId });
                _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_END, cloudId: _activeWordCloud.cloudId });
            }
            _activeWordCloud = null;
            if (_wcBroadcastTimer) { clearTimeout(_wcBroadcastTimer); _wcBroadcastTimer = null; }
            const launch = document.getElementById('rm-cloud-launch');
            const live = document.getElementById('rm-cloud-live');
            if (launch) launch.style.display = '';
            if (live) live.style.display = 'none';
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) wcOverlay.style.display = 'none';
            _roomBridgeEmit('cloud', _roomBridgeSnapshotCloud());
            roomUpdatePanel();
        }

        function roomStartExitTicket(configOrTitle = '', prompts = []) {
            if (!_room.active) return false;
            if (_activeExitTicket) return false;
            const rawConfig = (configOrTitle && typeof configOrTitle === 'object')
                ? configOrTitle
                : { title: configOrTitle, prompts };
            const title = toTrimmedString(rawConfig.title, 100) || 'Exit ticket';
            const promptList = _sanitizeStringList(
                rawConfig.prompts,
                4,
                180,
                ['Ce que je retiens', 'Ce qui reste flou', 'Question finale'],
            );
            if (!promptList.length) return false;
            const ticketId = `exit-${Date.now()}`;
            _activeExitTicket = {
                ticketId,
                title,
                prompts: promptList,
                responses: new Map(),
            };
            roomBroadcast({
                type: ROOM_MSG.EXIT_TICKET_START,
                ticketId,
                title,
                prompts: promptList,
            });
            _postPresenterSync({
                type: SYNC_MSG.EXIT_TICKET_START,
                ticketId,
                title,
                prompts: promptList,
            });
            _postPresenterSync({
                type: SYNC_MSG.EXIT_TICKET_UPDATE,
                ticketId,
                title,
                prompts: promptList,
                responsesCount: 0,
                responses: [],
            });
            _roomBridgeEmit('exitTicket', _roomBridgeSnapshotExitTicket());
            roomUpdatePanel();
            return ticketId;
        }

        function roomEndExitTicket() {
            if (_activeExitTicket) {
                roomBroadcast({
                    type: ROOM_MSG.EXIT_TICKET_END,
                    ticketId: _activeExitTicket.ticketId,
                });
                _postPresenterSync({
                    type: SYNC_MSG.EXIT_TICKET_END,
                    ticketId: _activeExitTicket.ticketId,
                });
            }
            _activeExitTicket = null;
            _roomBridgeEmit('exitTicket', _roomBridgeSnapshotExitTicket());
            roomUpdatePanel();
        }

        function roomStartRankOrder(configOrTitle = '', items = []) {
            if (!_room.active) return false;
            if (_activeRankOrder) return false;
            const rawConfig = (configOrTitle && typeof configOrTitle === 'object')
                ? configOrTitle
                : { title: configOrTitle, items };
            const title = toTrimmedString(rawConfig.title, 100) || 'Classement collectif';
            const itemList = _sanitizeStringList(
                rawConfig.items,
                8,
                120,
                ['Option A', 'Option B', 'Option C'],
            );
            if (itemList.length < 2) return false;
            const rankId = `rank-${Date.now()}`;
            _activeRankOrder = {
                rankId,
                title,
                items: itemList,
                responses: new Map(),
            };
            roomBroadcast({
                type: ROOM_MSG.RANK_ORDER_START,
                rankId,
                title,
                items: itemList,
            });
            _postPresenterSync({
                type: SYNC_MSG.RANK_ORDER_START,
                rankId,
                title,
                items: itemList,
            });
            _postPresenterSync({
                type: SYNC_MSG.RANK_ORDER_UPDATE,
                rankId,
                title,
                items: itemList,
                rows: [],
                responsesCount: 0,
            });
            _roomBridgeEmit('rankOrder', _roomBridgeSnapshotRankOrder());
            roomUpdatePanel();
            return rankId;
        }

        function roomEndRankOrder() {
            if (_activeRankOrder) {
                roomBroadcast({
                    type: ROOM_MSG.RANK_ORDER_END,
                    rankId: _activeRankOrder.rankId,
                });
                _postPresenterSync({
                    type: SYNC_MSG.RANK_ORDER_END,
                    rankId: _activeRankOrder.rankId,
                });
            }
            _activeRankOrder = null;
            _roomBridgeEmit('rankOrder', _roomBridgeSnapshotRankOrder());
            roomUpdatePanel();
        }

        function roomSendAudienceNudge(kind, text) {
            const feedback = document.getElementById('rm-nudge-feedback');
            if (!_room.active) {
                if (feedback) feedback.textContent = 'Ouvrez la salle pour relancer l’audience.';
                return false;
            }
            roomBroadcast({
                type: ROOM_MSG.AUDIENCE_NUDGE,
                kind: toTrimmedString(kind, 24),
                text: toTrimmedString(text, 160),
                at: Date.now(),
            });
            if (feedback) {
                feedback.textContent = `Relance envoyée: ${text}`;
                setTimeout(() => {
                    if (feedback.textContent.startsWith('Relance envoyée')) feedback.textContent = '';
                }, 1800);
            }
            return true;
        }

        function roomExposeBridge() {
            window.OEIRoomBridge = {
                isActive: () => !!_room.active,
                startPoll: (typeOrConfig, prompt) => roomStartPoll(typeOrConfig, prompt),
                startMcqSingle: (question, options) => roomStartPoll({ type: 'mcq-single', prompt: question, options }),
                startMcqMulti: (question, options) => roomStartPoll({ type: 'mcq-multi', prompt: question, options }),
                endPoll: () => roomEndPoll(),
                getPollSnapshot: () => _roomBridgeSnapshotPoll(),
                subscribePoll: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.poll.add(fn);
                    try { fn(_roomBridgeSnapshotPoll()); } catch (_) {}
                    return () => _roomBridgeSubs.poll.delete(fn);
                },
                startWordCloud: prompt => roomStartWordCloud(prompt),
                endWordCloud: () => roomEndWordCloud(),
                getWordCloudSnapshot: () => _roomBridgeSnapshotCloud(),
                subscribeWordCloud: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.cloud.add(fn);
                    try { fn(_roomBridgeSnapshotCloud()); } catch (_) {}
                    return () => _roomBridgeSubs.cloud.delete(fn);
                },
                startExitTicket: (configOrTitle, prompts) => roomStartExitTicket(configOrTitle, prompts),
                endExitTicket: () => roomEndExitTicket(),
                getExitTicketSnapshot: () => _roomBridgeSnapshotExitTicket(),
                subscribeExitTicket: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.exitTicket.add(fn);
                    try { fn(_roomBridgeSnapshotExitTicket()); } catch (_) {}
                    return () => _roomBridgeSubs.exitTicket.delete(fn);
                },
                startRankOrder: (configOrTitle, items) => roomStartRankOrder(configOrTitle, items),
                endRankOrder: () => roomEndRankOrder(),
                getRankOrderSnapshot: () => _roomBridgeSnapshotRankOrder(),
                subscribeRankOrder: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.rankOrder.add(fn);
                    try { fn(_roomBridgeSnapshotRankOrder()); } catch (_) {}
                    return () => _roomBridgeSubs.rankOrder.delete(fn);
                },
                pickRandomStudent: () => {
                    if (!_room.active) return null;
                    const ids = Object.keys(_room.students || {});
                    if (!ids.length) return null;
                    const pick = ids[Math.floor(Math.random() * ids.length)];
                    const name = _room.students[pick]?.pseudo || pick;
                    _roomBridgeEmit('roulette', { peerId: pick, pseudo: name, at: Date.now() });
                    _postPresenterSync({ type: SYNC_MSG.ROULETTE_PICK, pseudo: name });
                    return { peerId: pick, pseudo: name };
                },
                subscribeRoulette: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.roulette.add(fn);
                    return () => _roomBridgeSubs.roulette.delete(fn);
                },
                getRoomSnapshot: () => _roomBridgeSnapshotRoom(),
                subscribeRoom: fn => {
                    if (typeof fn !== 'function') return () => {};
                    _roomBridgeSubs.room.add(fn);
                    try { fn(_roomBridgeSnapshotRoom()); } catch (_) {}
                    return () => _roomBridgeSubs.room.delete(fn);
                },
            };
        }

        function _generateRoomId() {
            const words = ['algo','reseau','bdd','sys','web','secu','L1','L2','L3','info','cours'];
            const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
            return words[Math.floor(Math.random() * words.length)] + '-' + rnd;
        }

        function _buildStudentUrl(roomId, transportMode = 'auto') {
            const base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'student.html';
            if (typeof NetworkSession.buildStudentUrl === 'function') {
                return NetworkSession.buildStudentUrl(base, roomId, params, PEER_OPTIONS, RELAY_OPTIONS, {
                    transportMode,
                    audienceMode: AUDIENCE_POLICY.mode || 'display',
                });
            }
            const url = new URL(base);
            url.searchParams.set('room', String(roomId || '').trim());
            if (transportMode === 'relay' || transportMode === 'p2p') {
                url.searchParams.set('transport', transportMode);
            }
            url.searchParams.set('audienceMode', AUDIENCE_POLICY.mode || 'display');
            return url.toString();
        }

        function _roomClearPeerReconnectTimer() {
            if (_roomPeerReconnectTimer) {
                clearTimeout(_roomPeerReconnectTimer);
                _roomPeerReconnectTimer = null;
            }
        }

        function _roomSchedulePeerReconnect(reason = '') {
            if (!_room.peer || _room.peer.destroyed) return;
            if (_roomPeerReconnectTimer) return;
            _roomPeerReconnectAttempts += 1;
            const delay = _reconnectDelayMs(_roomPeerReconnectAttempts);
            _roomSetStatus(`Connexion salle instable, reconnexion…${reason ? ` (${reason})` : ''}`, 'warn');
            _roomPeerReconnectTimer = setTimeout(() => {
                _roomPeerReconnectTimer = null;
                if (!_room.peer || _room.peer.destroyed) return;
                try {
                    _room.peer.reconnect();
                } catch (e) {
                    try { _room.peer.destroy(); } catch (err) {}
                    _room.peer = null;
                    _room.active = false;
                    const idInput = document.getElementById('rm-room-id-input');
                    const idRefresh = document.getElementById('rm-room-id-refresh');
                    if (idInput) idInput.disabled = false;
                    if (idRefresh) idRefresh.disabled = false;
                    ViewerRuntime.runRoomPreviewUpdater();
                }
            }, delay);
        }

        async function roomHandleIncoming(conn, rawMsg) {
            if (!rawMsg || typeof rawMsg !== 'object') return;
            const msg = rawMsg;
            if (!validateRoomMessage(msg)) return;

            const msgType = toTrimmedString(msg.type, 80);
            const peerId = toTrimmedString(conn?.peer || 'unknown', 160) || 'unknown';
            const msgRid = toTrimmedString(msg.rid, 120);
            const ackEligible = !!msgRid && ROOM_ACKED_TYPES.has(msgType);

            if (ackEligible && _roomIsDuplicateRid(peerId, msgRid)) {
                _roomAck(conn, msgRid, true, 'duplicate');
                return;
            }
            if (ackEligible) _roomRememberRid(peerId, msgRid);

            let ackSent = false;
            const ack = (ok = true, reason = '') => {
                if (!ackEligible || ackSent) return;
                ackSent = true;
                _roomAck(conn, msgRid, ok, reason);
            };

            switch (msgType) {
                case ROOM_MSG.REMOTE_HELLO: {
                    if (!_remoteControl.enabled) {
                        _remoteSendAuthError(conn, 'Contrôle mobile désactivé.', 'remote_disabled');
                        break;
                    }
                    if (!_room.active) {
                        _remoteSendAuthError(conn, 'Salle fermée.', 'room_closed');
                        break;
                    }
                    const lockMs = _remoteCheckLock(conn.peer);
                    if (lockMs > 0) {
                        _remoteSendAuthError(conn, `Trop de tentatives. Réessayez dans ${Math.ceil(lockMs / 1000)}s.`, 'cooldown');
                        break;
                    }
                    const clientNonce = toTrimmedString(msg.clientNonce, 120);
                    if (clientNonce.length < 12) {
                        _remoteSendAuthError(conn, 'Challenge invalide.', 'bad_nonce');
                        break;
                    }
                    const challengeId = _randToken(14);
                    const serverNonce = _randToken(16);
                    _remoteControl.challenges.set(challengeId, {
                        peerId: conn.peer,
                        clientNonce,
                        serverNonce,
                        expiresAt: Date.now() + REMOTE_CHALLENGE_TTL_MS,
                    });
                    try {
                        conn.send({
                            type: ROOM_MSG.REMOTE_AUTH_CHALLENGE,
                            challengeId,
                            serverNonce,
                            salt: _remoteControl.salt,
                            iterations: _remoteControl.iterations,
                            ttlMs: REMOTE_CHALLENGE_TTL_MS,
                        });
                    } catch (e) {}
                    _remoteSetStatus('Demande de contrôle mobile en cours d’authentification.', 'warn');
                    break;
                }
                case ROOM_MSG.REMOTE_AUTH_PROOF: {
                    if (!_remoteControl.enabled) {
                        _remoteSendAuthError(conn, 'Contrôle mobile désactivé.', 'remote_disabled');
                        break;
                    }
                    const challengeId = toTrimmedString(msg.challengeId, 120);
                    const proof = toTrimmedString(msg.proof, 200);
                    const clientNonce = toTrimmedString(msg.clientNonce, 120);
                    const challenge = _remoteControl.challenges.get(challengeId);
                    _remoteControl.challenges.delete(challengeId);
                    if (!challenge || challenge.peerId !== conn.peer || challenge.expiresAt <= Date.now()) {
                        _remoteSendAuthError(conn, 'Challenge expiré. Recommencez.', 'challenge_expired');
                        break;
                    }
                    if (!proof || clientNonce !== challenge.clientNonce) {
                        const waitMs = _remoteFail(conn.peer);
                        if (waitMs > 0) {
                            _remoteSendAuthError(conn, `Accès temporairement bloqué (${Math.ceil(waitMs / 1000)}s).`, 'cooldown');
                        } else {
                            _remoteSendAuthError(conn, 'Preuve invalide.', 'invalid_proof');
                        }
                        break;
                    }
                    const expected = await sha256Hex(`${challengeId}:${challenge.clientNonce}:${challenge.serverNonce}:${_remoteControl.hash}`);
                    if (proof !== expected) {
                        const waitMs = _remoteFail(conn.peer);
                        if (waitMs > 0) {
                            _remoteSendAuthError(conn, `Accès temporairement bloqué (${Math.ceil(waitMs / 1000)}s).`, 'cooldown');
                        } else {
                            _remoteSendAuthError(conn, 'Mot de passe incorrect.', 'invalid_password');
                        }
                        break;
                    }
                    _remoteControl.failures.delete(conn.peer);
                    const token = _randToken(24);
                    const expiresAt = Date.now() + REMOTE_SESSION_TTL_MS;
                    _remoteControl.sessions.set(token, { peerId: conn.peer, expiresAt });
                    try {
                        conn.send({
                            type: ROOM_MSG.REMOTE_AUTH_OK,
                            token,
                            expiresAt,
                            ttlMs: REMOTE_SESSION_TTL_MS,
                        });
                    } catch (e) {}
                    _remoteUpdateUI();
                    break;
                }
                case ROOM_MSG.REMOTE_COMMAND: {
                    const token = toTrimmedString(msg.token, 160);
                    if (!_remoteSessionValid(conn, token)) {
                        _remoteAck(conn, msg.rid, false, 'Session expirée');
                        _remoteSendAuthError(conn, 'Session expirée. Reconnectez-vous.', 'session_expired');
                        break;
                    }
                    const outcome = _remoteRunCommand(msg.command, msg);
                    _remoteAck(conn, msg.rid, outcome.ok, outcome.reason || '');
                    _remoteUpdateUI();
                    break;
                }
                case ROOM_MSG.STUDENT_JOIN: {
                    const pseudo = toTrimmedString(msg.pseudo, 40) || 'Anonyme';
                    _room.students[peerId] = { pseudo, score: 0, quizCount: 0, quizCorrect: 0, handRaised: false };
                    conn.send({ type: ROOM_MSG.WELCOME, title: _presentationData?.metadata?.title || 'Présentation', peerId });
                    if (conn.__transport === 'relay') _roomSendInit(conn);
                    if (_activePoll) {
                        try {
                            conn.send({
                                type: ROOM_MSG.POLL_START,
                                pollId: _activePoll.pollId,
                                pollType: _activePoll.type,
                                prompt: _activePoll.prompt,
                                options: _activePoll.options,
                                multi: !!_activePoll.multi,
                            });
                        } catch(e) {}
                    }
                    if (_activeWordCloud) { try { conn.send({ type: ROOM_MSG.WORDCLOUD_START, cloudId: _activeWordCloud.cloudId, prompt: _activeWordCloud.prompt }); } catch(e) {} }
                    if (_activeExitTicket) {
                        try {
                            conn.send({
                                type: ROOM_MSG.EXIT_TICKET_START,
                                ticketId: _activeExitTicket.ticketId,
                                title: _activeExitTicket.title || 'Exit ticket',
                                prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                            });
                        } catch (e) {}
                    }
                    if (_activeRankOrder) {
                        try {
                            conn.send({
                                type: ROOM_MSG.RANK_ORDER_START,
                                rankId: _activeRankOrder.rankId,
                                title: _activeRankOrder.title || 'Classement collectif',
                                items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                            });
                        } catch (e) {}
                    }
                    roomUpdatePanel();
                    break;
                }
                case ROOM_MSG.QUIZ_ANSWER: {
                    const handler = ViewerRuntime.activeQuizHandler;
                    if (handler) handler(peerId, msg.answer);
                    break;
                }
                case ROOM_MSG.STUDENT_SCORE: {
                    if (_room.students[peerId]) {
                        _room.students[peerId].score = toNumberOr(msg.score, 0);
                        _room.students[peerId].quizCount = toNumberOr(msg.quizCount, 0);
                        _room.students[peerId].quizCorrect = toNumberOr(msg.quizCorrect, 0);
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.STUDENT_REACTION: {
                    const pseudo = toTrimmedString(msg.pseudo, 40);
                    roomShowReaction(msg.emoji, pseudo);
                    const relay = { type: ROOM_MSG.REACTION_SHOW, emoji: msg.emoji, pseudo };
                    _room.connections.forEach(c => { if (c !== conn && c.open) { try { c.send(relay); } catch(e) {} } });
                    if (_relayRoom.active) _relaySendBroadcast(relay);
                    break;
                }
                case ROOM_MSG.STUDENT_HAND: {
                    if (_room.students[peerId]) {
                        const raised = !!msg.raised;
                        _room.students[peerId].handRaised = raised;
                        if (raised) {
                            if (!_roomHands.find(h => h.peerId === peerId))
                                _roomHands.push({ peerId, pseudo: _room.students[peerId].pseudo });
                        } else {
                            const idx = _roomHands.findIndex(h => h.peerId === peerId);
                            if (idx !== -1) _roomHands.splice(idx, 1);
                        }
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.STUDENT_QUESTION: {
                    const text = toTrimmedString(msg.text, 300);
                    if (!text) { ack(false, 'empty-question'); break; }
                    const qid = toTrimmedString(msg.qid, 80) || `q-${Date.now()}`;
                    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
                    const existing = _roomQuestions.find(q => !q.read && String(q._norm || '') === normalized);
                    if (existing) {
                        existing.time = Date.now();
                        existing.read = false;
                        existing.hidden = false;
                        if (existing.resolved) existing.resolved = false;
                        if (!Array.isArray(existing.authors)) existing.authors = [];
                        if (!existing.authors.includes(peerId)) {
                            existing.authors.push(peerId);
                            existing.votes = (existing.votes || 1) + 1;
                        }
                    } else {
                        _roomQuestions.unshift({
                            qid,
                            text,
                            time: Date.now(),
                            read: false,
                            hidden: false,
                            resolved: false,
                            pinned: false,
                            votes: 1,
                            authors: [peerId],
                            _norm: normalized,
                        });
                    }
                    roomUpdatePanel();
                    break;
                }
                case ROOM_MSG.STUDENT_FEEDBACK: {
                    const kind = toTrimmedString(msg.kind, 24).toLowerCase();
                    const allow = ['fast', 'unclear', 'pause', 'clear'];
                    if (!allow.includes(kind)) { ack(false, 'feedback-invalid'); break; }
                    const now = Date.now();
                    const prev = Number(_roomFeedback.lastByPeer.get(peerId) || 0);
                    if ((now - prev) < 5000) { ack(true, 'feedback-throttled'); break; }
                    _roomFeedback.lastByPeer.set(peerId, now);
                    _roomFeedback.events.unshift({
                        peerId,
                        pseudo: _room.students[peerId]?.pseudo || 'Anonyme',
                        kind,
                        text: toTrimmedString(msg.text, 120),
                        time: now,
                    });
                    roomFeedbackPrune();
                    roomUpdatePanel();
                    break;
                }
                case ROOM_MSG.POLL_ANSWER: {
                    if (_activePoll && String(msg.pollId || '') === String(_activePoll.pollId)) {
                        const normalized = _normalizePollAnswer(_activePoll, msg.value);
                        if (normalized == null) break;
                        _activePoll.responses.set(peerId, normalized);
                        const pollSnap = _roomBridgeSnapshotPoll();
                        _roomBridgeEmit('poll', pollSnap);
                        _postPresenterSync({
                            type: SYNC_MSG.POLL_UPDATE,
                            pollId: _activePoll.pollId,
                            pollType: _activePoll.type,
                            prompt: _activePoll.prompt || '',
                            options: Array.isArray(_activePoll.options) ? _activePoll.options.slice() : [],
                            multi: !!_activePoll.multi,
                            counts: pollSnap.counts || [],
                            total: pollSnap.total || 0,
                            totalSelections: pollSnap.totalSelections || 0,
                        });
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.WORDCLOUD_WORD: {
                    if (_activeWordCloud && String(msg.cloudId || '') === String(_activeWordCloud.cloudId)) {
                        const w = toTrimmedString(msg.word, 80)
                            .toLowerCase()
                            .replace(/[^\p{L}\p{N}\s\-_'’.,!?]/gu, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (w) {
                            _activeWordCloud.words.set(w, (_activeWordCloud.words.get(w) || 0) + 1);
                            _roomBridgeEmit('cloud', _roomBridgeSnapshotCloud());
                            roomRenderWordCloud();
                        }
                    }
                    break;
                }
                case ROOM_MSG.EXIT_TICKET_SUBMIT: {
                    if (_activeExitTicket && String(msg.ticketId || '') === String(_activeExitTicket.ticketId)) {
                        const answers = _normalizeExitTicketAnswers(_activeExitTicket, msg.answers);
                        if (!answers) break;
                        _activeExitTicket.responses.set(peerId, {
                            answers,
                            pseudo: _room.students[peerId]?.pseudo || 'Anonyme',
                            at: Date.now(),
                        });
                        const snap = _roomBridgeSnapshotExitTicket();
                        _roomBridgeEmit('exitTicket', snap);
                        _postPresenterSync({
                            type: SYNC_MSG.EXIT_TICKET_UPDATE,
                            ticketId: _activeExitTicket.ticketId,
                            title: _activeExitTicket.title || 'Exit ticket',
                            prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                            responsesCount: snap.responsesCount || 0,
                            responses: (Array.isArray(snap.responses) ? snap.responses : []).slice(0, 24),
                        });
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.RANK_ORDER_SUBMIT: {
                    if (_activeRankOrder && String(msg.rankId || '') === String(_activeRankOrder.rankId)) {
                        const order = _normalizeRankOrderSubmission(_activeRankOrder, msg.order);
                        if (!order) break;
                        _activeRankOrder.responses.set(peerId, {
                            order,
                            pseudo: _room.students[peerId]?.pseudo || 'Anonyme',
                            at: Date.now(),
                        });
                        const snap = _roomBridgeSnapshotRankOrder();
                        _roomBridgeEmit('rankOrder', snap);
                        _postPresenterSync({
                            type: SYNC_MSG.RANK_ORDER_UPDATE,
                            rankId: _activeRankOrder.rankId,
                            title: _activeRankOrder.title || 'Classement collectif',
                            items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                            responsesCount: snap.responsesCount || 0,
                            rows: Array.isArray(snap.rows) ? snap.rows : [],
                        });
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.SYNC_REQUEST: {
                    if (!_roomSendInit(conn)) {
                        ack(false, 'sync-unavailable');
                        break;
                    }
                    if (_activePoll) {
                        try {
                            conn.send({
                                type: ROOM_MSG.POLL_START,
                                pollId: _activePoll.pollId,
                                pollType: _activePoll.type,
                                prompt: _activePoll.prompt || '',
                                options: _activePoll.options,
                                multi: !!_activePoll.multi,
                            });
                        } catch (e) {}
                    }
                    if (_activeWordCloud) {
                        try {
                            conn.send({
                                type: ROOM_MSG.WORDCLOUD_START,
                                cloudId: _activeWordCloud.cloudId,
                                prompt: _activeWordCloud.prompt || '',
                            });
                        } catch (e) {}
                    }
                    if (_activeExitTicket) {
                        try {
                            conn.send({
                                type: ROOM_MSG.EXIT_TICKET_START,
                                ticketId: _activeExitTicket.ticketId,
                                title: _activeExitTicket.title || 'Exit ticket',
                                prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                            });
                        } catch (e) {}
                    }
                    if (_activeRankOrder) {
                        try {
                            conn.send({
                                type: ROOM_MSG.RANK_ORDER_START,
                                rankId: _activeRankOrder.rankId,
                                title: _activeRankOrder.title || 'Classement collectif',
                                items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                            });
                        } catch (e) {}
                    }
                    const curFrag = _roomCurrentFragmentIndex();
                    try {
                        conn.send({
                            type: ROOM_MSG.SLIDE_CHANGE,
                            index: _roomCurrentSlideIndex(),
                            fragmentOrder: curFrag,
                            fragmentIndex: curFrag,
                        });
                    } catch (e) {}
                    break;
                }
                default:
                    if (ackEligible) ack(false, 'unsupported');
                    break;
            }

            if (ackEligible && !ackSent) ack(true);
        }

        async function roomOpenPeer() {
            if (_room.active) return;

            if (!window.Peer) {
                await new Promise((res, rej) => {
                    if (ViewerRuntime.isPeerScriptLoaded()) {
                        const wait = () => window.Peer ? res() : setTimeout(wait, 100);
                        wait(); return;
                    }
                    ViewerRuntime.markPeerScriptLoaded();
                    const s = document.createElement('script');
                    s.src = '../vendor/peerjs/1.5.5/peerjs.min.js';
                    s.onload = res; s.onerror = rej;
                    document.head.appendChild(s);
                });
            }

            // Read and sanitize the room ID
            const rawId = document.getElementById('rm-room-id-input')?.value.trim() || '';
            const roomId = rawId.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-{2,}/g, '-').slice(0, 40) || _generateRoomId();
            if (document.getElementById('rm-room-id-input')) document.getElementById('rm-room-id-input').value = roomId;
            storageSetRaw(LAST_ROOM_ID_KEY, roomId);
            _remoteLoadConfig(roomId);
            // Lock the ID input while the room is open
            if (document.getElementById('rm-room-id-input')) document.getElementById('rm-room-id-input').disabled = true;
            if (document.getElementById('rm-room-id-refresh')) document.getElementById('rm-room-id-refresh').disabled = true;

            const copyBtn = document.getElementById('sl-room-copy');
            if (copyBtn) {
                copyBtn.disabled = true;
                copyBtn.innerHTML = withIcon('refresh', 'Connexion…');
            }
            _roomSetStatus('Connexion P2P…', 'warn');

            _room.peer = new Peer(roomId, PEER_OPTIONS);

            _room.peer.on('open', id => {
                _roomClearPeerReconnectTimer();
                _roomPeerReconnectAttempts = 0;
                _room.active = true;
                ViewerRuntime.studentRoom = _room;
                ViewerRuntime.studentRoomBroadcast = roomBroadcast;

                const studentUrl = _buildStudentUrl(id);
                _room.studentUrl = studentUrl;

                const copyBtn = document.getElementById('sl-room-copy');
                if (copyBtn) {
                    copyBtn.disabled = false;
                    copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(studentUrl).then(() => {
                            copyBtn.innerHTML = withIcon('check', 'Copié !');
                            setTimeout(() => { copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable'); }, 2000);
                        });
                    };
                }
                if (RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl) _relayOpen(id);
                _roomSetStatus(_relayRoom.active ? 'Salle active (P2P + relay).' : 'Salle active.', 'ok');
                roomUpdateStudents();
                if (isPresenterMode) switchRoomPresenterMode('technique', true);
            });

            _room.peer.on('disconnected', () => {
                _roomSchedulePeerReconnect('signalisation');
            });

            _room.peer.on('connection', conn => {
                conn.on('open', () => {
                    _room.connections.push(conn);
                    _roomSendInit(conn);
                });

                conn.on('data', rawMsg => { roomHandleIncoming(conn, rawMsg); });

                const removeConn = () => {
                    _room.connections = _room.connections.filter(c => c !== conn);
                    // Retirer des mains levées si besoin
                    const hi = _roomHands.findIndex(h => h.peerId === conn.peer);
                    if (hi !== -1) _roomHands.splice(hi, 1);
                    _roomFeedback.lastByPeer.delete(conn.peer);
                    _roomSeenByPeer.delete(conn.peer);
                    _remoteDropPeer(conn.peer);
                    delete _room.students[conn.peer];
                    roomUpdatePanel();
                };
                conn.on('close', removeConn);
                conn.on('error', removeConn);
            });

            _room.peer.on('error', e => {
                const idInput = document.getElementById('rm-room-id-input');
                const idRefresh = document.getElementById('rm-room-id-refresh');
                if (e.type === 'unavailable-id') {
                    if (idInput) idInput.disabled = false;
                    if (idRefresh) idRefresh.disabled = false;
                    _room.active = false;
                    _roomSetStatus('ID de salle déjà utilisé.', 'error');
                    ViewerRuntime.runRoomPreviewUpdater();
                } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) {
                    _roomSchedulePeerReconnect(e.type);
                } else {
                    if (idInput) idInput.disabled = false;
                    if (idRefresh) idRefresh.disabled = false;
                    _room.active = false;
                    _roomSetStatus(`Erreur salle: ${_roomEsc(e.message || String(e))}`, 'error');
                    ViewerRuntime.runRoomPreviewUpdater();
                    roomUpdatePanel();
                }
            });
        }

        function roomClose() {
            _roomClearPeerReconnectTimer();
            _roomPeerReconnectAttempts = 0;
            const wasActive = _room.active;
            if (_pvQrVisible) {
                _pvQrVisible = false;
                _postPresenterSync({ type: SYNC_MSG.ROOM_QR, show: false, url: '' });
            }
            _room.active = false;
            _relayClose();
            if (wasActive) _remoteRevokeAll('Salle fermée : sessions mobiles révoquées.', true);
            if (_room.peer) { try { _room.peer.destroy(); } catch(e) {} _room.peer = null; }
            _room.connections = [];
            _room.students = {};
            _roomSeenByPeer.clear();
            ViewerRuntime.clearRoomRuntime();
            // Nettoyer les nouvelles structures
            _roomHands.length = 0;
            _roomQuestions.length = 0;
            _roomQuestionFilter = 'open';
            _roomFeedback.events.length = 0;
            _roomFeedback.lastByPeer.clear();
            if (_activePoll) _postPresenterSync({ type: SYNC_MSG.POLL_END, pollId: _activePoll.pollId });
            _activePoll = null;
            if (_activeWordCloud) _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_END, cloudId: _activeWordCloud.cloudId });
            _activeWordCloud = null;
            if (_activeExitTicket) _postPresenterSync({ type: SYNC_MSG.EXIT_TICKET_END, ticketId: _activeExitTicket.ticketId });
            _activeExitTicket = null;
            if (_activeRankOrder) _postPresenterSync({ type: SYNC_MSG.RANK_ORDER_END, rankId: _activeRankOrder.rankId });
            _activeRankOrder = null;
            if (_wcBroadcastTimer) { clearTimeout(_wcBroadcastTimer); _wcBroadcastTimer = null; }
            _roomBridgeEmit('poll', _roomBridgeSnapshotPoll());
            _roomBridgeEmit('cloud', _roomBridgeSnapshotCloud());
            _roomBridgeEmit('exitTicket', _roomBridgeSnapshotExitTicket());
            _roomBridgeEmit('rankOrder', _roomBridgeSnapshotRankOrder());
            // Déverrouiller l'input ID
            const idInput = document.getElementById('rm-room-id-input');
            const idRefresh = document.getElementById('rm-room-id-refresh');
            if (idInput) idInput.disabled = false;
            if (idRefresh) idRefresh.disabled = false;

            // Restaurer le lien stable de copie dès que _room.active est false
            ViewerRuntime.runRoomPreviewUpdater();
            _roomSetStatus('Salle fermée.', '');
            // Remettre les outils en mode launch
            const pollLaunch = document.getElementById('rm-poll-launch');
            const pollLive = document.getElementById('rm-poll-live');
            const cloudLaunch = document.getElementById('rm-cloud-launch');
            const cloudLive = document.getElementById('rm-cloud-live');
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (pollLaunch) pollLaunch.style.display = '';
            if (pollLive) pollLive.style.display = 'none';
            if (cloudLaunch) cloudLaunch.style.display = '';
            if (cloudLive) cloudLive.style.display = 'none';
            if (wcOverlay) wcOverlay.style.display = 'none';
            roomUpdatePanel();
            if (isPresenterMode) switchRoomPresenterMode('technique', true);
        }

        function roomShowReaction(emoji, pseudo) {
            const safe = ['👍','😕','❓','🎉','👏','🤔','🔥'].includes(emoji) ? emoji : '❓';
            const el = document.createElement('div');
            el.className = 'sl-reaction';
            el.style.left = (10 + Math.random() * 80) + 'vw';
            el.innerHTML = safe + (pseudo ? `<div class="sl-reaction-label">${_roomEsc(String(pseudo).slice(0,12))}</div>` : '');
            document.body.appendChild(el);
            el.addEventListener('animationend', () => el.remove());
        }

        // ── Init room ID input ───────────────────────────────────
        (function() {
            const input = document.getElementById('rm-room-id-input');
            const refresh = document.getElementById('rm-room-id-refresh');

            function updateRoomPreview() {
                if (_room.active) return;
                const rawId = (input?.value || '').trim();
                const id = rawId.replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/-{2,}/g, '-').slice(0, 40);
                const copyBtn = document.getElementById('sl-room-copy');
                if (!id) {
                    _remoteControl.roomId = '';
                    _remoteUpdateUI();
                    if (copyBtn) {
                        copyBtn.disabled = true;
                        copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                        copyBtn.onclick = null;
                    }
                    return;
                }
                if (_remoteControl.roomId !== id) {
                    _remoteLoadConfig(id);
                } else {
                    _remoteControl.roomId = id;
                    _remoteUpdateUI();
                }
                const url = _buildStudentUrl(id);
                if (copyBtn) {
                    copyBtn.disabled = false;
                    copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable');
                    copyBtn.onclick = () => navigator.clipboard.writeText(url).then(() => {
                        copyBtn.innerHTML = withIcon('check', 'Copié !');
                        setTimeout(() => { copyBtn.innerHTML = withIcon('copy', 'Copier le lien stable'); }, 2000);
                    });
                }
            }
            // Expose pour être appelé après ouverture de salle
            ViewerRuntime.setRoomPreviewUpdater(updateRoomPreview);

            if (input) {
                const saved = storageGetRaw(LAST_ROOM_ID_KEY);
                input.value = saved || _generateRoomId();
                input.addEventListener('input', () => {
                    // Sanitize on the fly: strip invalid chars
                    const pos = input.selectionStart;
                    const clean = input.value.replace(/[^a-zA-Z0-9\-_]/g, '-');
                    if (clean !== input.value) { input.value = clean; input.setSelectionRange(pos, pos); }
                    updateRoomPreview();
                });
                updateRoomPreview();
            }
            if (refresh) {
                refresh.addEventListener('click', () => {
                    if (input && !input.disabled) { input.value = _generateRoomId(); updateRoomPreview(); }
                });
            }
        })();
        roomExposeBridge();

        // Modal bindings
        document.getElementById('btn-student-room')?.addEventListener('click', () => document.getElementById('sl-room-modal').classList.toggle('open'));
        document.getElementById('sl-room-close-modal')?.addEventListener('click', () => document.getElementById('sl-room-modal').classList.remove('open'));
        document.getElementById('sl-room-modal')?.addEventListener('click', e => {
            if (e.target === document.getElementById('sl-room-modal')) document.getElementById('sl-room-modal').classList.remove('open');
        });

        function switchRoomPresenterMode(mode, forceSwitch = false) {
            const safeMode = ROOM_PRESENTER_MODES.includes(mode) ? mode : 'live';
            _roomPresenterMode = safeMode;

            const roomPanel = document.getElementById('sl-room-panel');
            if (!roomPanel) return;

            roomPanel.classList.remove('rm-mode-live', 'rm-mode-interactions', 'rm-mode-technique');
            roomPanel.classList.add(`rm-mode-${safeMode}`);

            document.querySelectorAll('#pv-room-mode-tabs .pv-room-mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === safeMode);
            });

            const allowedTabs = safeMode === 'live'
                ? ['students', 'hands', 'questions']
                : (safeMode === 'interactions' ? ['dashboard', 'tools'] : ['tools']);
            const defaultTab = safeMode === 'live' ? 'questions' : (safeMode === 'interactions' ? 'dashboard' : 'tools');

            let activeTab = '';
            document.querySelectorAll('#rm-tabs .rm-tab').forEach(btn => {
                const tab = toTrimmedString(btn.dataset.tab, 24);
                const visible = allowedTabs.includes(tab);
                btn.style.display = visible ? '' : 'none';
                if (btn.classList.contains('active') && visible) activeTab = tab;
            });

            if (forceSwitch || !activeTab) switchRoomTab(defaultTab);
            if (safeMode === 'technique') switchRoomTab('tools');
        }

        // ── Tabs ────────────────────────────────────────────────
        function switchRoomTab(tab) {
            const safeTab = ['students', 'hands', 'questions', 'dashboard', 'tools'].includes(tab) ? tab : 'students';
            document.querySelectorAll('.rm-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === safeTab));
            ['students', 'hands', 'questions', 'dashboard', 'tools'].forEach(t => {
                const p = document.getElementById(`rm-panel-${t}`);
                if (p) p.style.display = t === safeTab ? '' : 'none';
            });
            if (safeTab === 'dashboard') roomRenderDashboard();
        }

        document.querySelectorAll('.rm-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                switchRoomTab(toTrimmedString(btn.dataset.tab, 24));
            });
        });

        document.getElementById('rm-question-filter')?.addEventListener('change', e => {
            const next = toTrimmedString(/** @type {HTMLSelectElement} */ (e.target).value, 20);
            _roomQuestionFilter = ['open', 'pinned', 'resolved', 'hidden', 'all'].includes(next) ? next : 'open';
            roomUpdatePanel();
        });
        document.getElementById('rm-question-mark-all')?.addEventListener('click', () => {
            _roomQuestions.forEach(q => {
                if (q.read) return;
                q.hidden = true;
                q.pinned = false;
                q.resolved = false;
            });
            roomUpdatePanel();
        });
        document.getElementById('rm-feedback-reset')?.addEventListener('click', () => {
            _roomFeedback.events.length = 0;
            _roomFeedback.lastByPeer.clear();
            roomUpdatePanel();
        });

        // ── Baisser toutes les mains ─────────────────────────────
        document.getElementById('rm-lower-all')?.addEventListener('click', () => {
            _roomHands.forEach(h => {
                const c = _room.connections.find(x => x.peer === h.peerId && x.open);
                if (c) { try { c.send({ type: ROOM_MSG.HAND_LOWER }); } catch(e) {} }
                if (_room.students[h.peerId]) _room.students[h.peerId].handRaised = false;
            });
            _roomHands.length = 0;
            roomUpdatePanel();
        });

        // ── Sondage ──────────────────────────────────────────────
        document.getElementById('rm-poll-start')?.addEventListener('click', () => {
            const type = document.getElementById('rm-poll-type')?.value || 'thumbs';
            const prompt = document.getElementById('rm-poll-prompt')?.value.trim() || '';
            if (!roomStartPoll(type, prompt)) {
                const feedback = document.getElementById('rm-nudge-feedback');
                if (feedback) feedback.textContent = 'Ouvrez la salle pour lancer un sondage.';
            }
        });

        document.getElementById('rm-poll-end')?.addEventListener('click', () => {
            roomEndPoll();
        });

        // ── Nuage de mots ────────────────────────────────────────
        document.getElementById('rm-cloud-start')?.addEventListener('click', () => {
            const prompt = document.getElementById('rm-cloud-prompt')?.value.trim() || '';
            if (!roomStartWordCloud(prompt)) {
                const feedback = document.getElementById('rm-nudge-feedback');
                if (feedback) feedback.textContent = 'Ouvrez la salle pour lancer un nuage.';
            }
        });

        document.getElementById('rm-cloud-show')?.addEventListener('click', () => {
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) wcOverlay.style.display = 'flex';
        });

        document.getElementById('rm-cloud-end')?.addEventListener('click', () => {
            roomEndWordCloud();
        });

        document.getElementById('sl-wc-close-presenter')?.addEventListener('click', () => {
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) wcOverlay.style.display = 'none';
        });

        document.getElementById('rm-nudge-question')?.addEventListener('click', () => {
            roomSendAudienceNudge('question', 'Avez-vous une question a poser ?');
        });
        document.getElementById('rm-nudge-hand')?.addEventListener('click', () => {
            roomSendAudienceNudge('hand', 'Levez la main si vous voulez revenir sur ce point.');
        });
        document.getElementById('rm-nudge-poll')?.addEventListener('click', () => {
            if (_activePoll) {
                roomSendAudienceNudge('poll', 'Un sondage est en cours, pensez a voter.');
                return;
            }
            if (!roomStartPoll('thumbs', 'Avez-vous compris ce point ?')) {
                roomSendAudienceNudge('poll', 'Pensez a voter.');
            }
        });
        document.getElementById('rm-nudge-cloud')?.addEventListener('click', () => {
            if (_activeWordCloud) {
                roomSendAudienceNudge('cloud', 'Nuage de mots en cours, proposez un mot.');
                return;
            }
            if (!roomStartWordCloud('Un mot pour resumer ce slide ?')) {
                roomSendAudienceNudge('cloud', 'Proposez un mot.');
            }
        });

        // ── Diagnostic réseau ─────────────────────────────────────
        document.getElementById('rm-network-retry-relay')?.addEventListener('click', () => {
            const roomId = toTrimmedString(_room.peer?.id || _relayRoom.roomId || document.getElementById('rm-room-id-input')?.value, 80);
            if (!_room.active || !roomId) return;
            if (!(RELAY_OPTIONS.enabled && RELAY_OPTIONS.wsUrl)) return;
            _relayOpen(roomId);
            _roomSetStatus('Reconnexion relay forcée…', 'warn');
            roomUpdatePanel();
        });

        // ── Contrôle mobile ────────────────────────────────────────
        document.getElementById('rm-remote-enable')?.addEventListener('click', async () => {
            if (!_remoteControl.roomId) {
                _remoteSetStatus('Définissez un ID de salle valide.', 'error');
                return;
            }
            await _remoteEnableFromPassword();
        });
        document.getElementById('rm-remote-revoke')?.addEventListener('click', () => {
            _remoteRevokeAll('Contrôle mobile révoqué.');
        });
        document.getElementById('rm-remote-copy')?.addEventListener('click', () => {
            if (!_remoteControl.roomId || !_remoteControl.enabled) return;
            const url = _remoteBuildUrl(_remoteControl.roomId);
            navigator.clipboard.writeText(url).then(() => {
                const btn = document.getElementById('rm-remote-copy');
                if (btn) {
                    btn.innerHTML = withIcon('check', 'Lien copié');
                    setTimeout(() => { btn.innerHTML = withIcon('copy', 'Copier le lien de contrôle'); }, 1600);
                }
            });
        });
        document.getElementById('rm-remote-password')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('rm-remote-enable')?.click();
            }
        });

        /* ── Reveal.js mode (normal presentation) ─────────── */
        async function initRevealMode(data) {
            // Hide presenter view, show reveal
            document.getElementById('presenter-view').classList.remove('active');
            document.getElementById('reveal-root').style.display = '';

            const themeData = window.OEIDesignTokens?.resolvePresentationTheme
                ? window.OEIDesignTokens.resolvePresentationTheme(data)
                : (typeof data.theme === 'string'
                    ? (SlidesThemes.BUILT_IN[data.theme] || SlidesThemes.BUILT_IN.dark)
                    : (data.theme || SlidesThemes.BUILT_IN.dark));
            document.getElementById('sl-theme-css').textContent = SlidesThemes.generateCSS(themeData);
            SlidesThemes.apply(themeData);

            const root = document.getElementById('slides-root');
            SlidesRenderer.renderToReveal(data, root);

            const title = data.metadata?.title || 'Présentation';
            document.title = title;
            document.getElementById('sl-toolbar-title').textContent = title;

            const deck = new Reveal({
                width: 1280, height: 720,
                hash: true, progress: false,
                slideNumber: false,
                transition: 'slide',
                backgroundTransition: 'fade',
                controls: false,
                keyboard: true,
                plugins: [Highlight],
                highlight: { highlightOnLoad: true },
            });
            await deck.initialize();

            const mountVisible = () => {
                SlidesRenderer.mountWidgets(root, deck);
                SlidesRenderer.mountSpecialElements(root);
            };
            mountVisible();
            deck.addEventListener('slidechanged', mountVisible);

            _presentationData = data;
            const presentationId = buildPresentationStorageId(data);
            const whiteboardStorageKey = presenterAnnotationsKey(presentationId);

            // Whiteboard: init & hook slide changes
            if (!_whiteboard) {
                _whiteboard = createWhiteboardController({
                    roomIsActive: () => _room.active,
                    roomBroadcast,
                    ROOM_MSG,
                    getCurrentSlideIndex: () => deck.getIndices().h || 0,
                    storageKey: whiteboardStorageKey,
                    storageGetJSON,
                    storageSetJSON,
                });
                _whiteboard.init();
            }
            const resolveFragmentOrder = fragmentEl => {
                if (!fragmentEl) return null;
                const currentSlide = deck.getCurrentSlide();
                if (!currentSlide) return null;
                const frags = Array.from(currentSlide.querySelectorAll('.fragment'));
                const idx = frags.indexOf(fragmentEl);
                if (idx >= 0) return idx;
                const dataIdx = toIntOrNull(fragmentEl?.dataset?.fragmentIndex ?? fragmentEl?.getAttribute?.('data-fragment-index'));
                return dataIdx;
            };
            deck.addEventListener('slidechanged', e => {
                _whiteboard?.onSlideChange(e.indexh);
                if (_room.active) {
                    roomBroadcast({ type: ROOM_MSG.SLIDE_CHANGE, index: e.indexh, fragmentOrder: -1 });
                    // Auto-broadcast quiz (3.1): if the new slide has a quiz widget, start it
                    const currentSlide = deck.getCurrentSlide();
                    if (currentSlide) {
                        const quizEl = currentSlide.querySelector('.sl-quizlive-pending');
                        if (quizEl && !quizEl.dataset.autoStarted) {
                            quizEl.dataset.autoStarted = '1';
                            const startBtn = quizEl.querySelector('.sl-quizlive-start');
                            if (startBtn) setTimeout(() => startBtn.click(), 400);
                        }
                    }
                }
            });

            // Fragment sync for students
            deck.addEventListener('fragmentshown', e => {
                if (_room.active) {
                    roomBroadcast({
                        type: ROOM_MSG.SLIDE_FRAGMENT,
                        index: deck.getState().indexh,
                        fragmentOrder: resolveFragmentOrder(e.fragment),
                        fragmentIndex: e.fragment?.dataset?.fragmentIndex ?? e.fragment?.getAttribute('data-fragment-index') ?? null,
                        hidden: false,
                    });
                }
            });
            deck.addEventListener('fragmenthidden', e => {
                if (_room.active) {
                    roomBroadcast({
                        type: ROOM_MSG.SLIDE_FRAGMENT,
                        index: deck.getState().indexh,
                        fragmentOrder: resolveFragmentOrder(e.fragment),
                        fragmentIndex: e.fragment?.dataset?.fragmentIndex ?? e.fragment?.getAttribute('data-fragment-index') ?? null,
                        hidden: true,
                    });
                }
            });

            ViewerRuntime.revealDeck = deck;
        }

        /* ── Audience mode (synced from presenter) ─────────── */
        const CHANNEL_NAME = SYNC_CHANNEL_NAME;
        const isAudienceMode = params.get('mode') === 'audience';
        if (isAudienceMode) document.body.classList.add('viewer-audience');

        async function initAudienceMode(data) {
            window.OEIAudienceModePolicy = AUDIENCE_POLICY;
            document.documentElement.dataset.oeiAudienceMode = AUDIENCE_POLICY.mode || 'display';
            await initAudienceModeModule({
                data,
                Reveal,
                Highlight,
                SlidesThemes,
                SlidesRenderer,
                SYNC_MSG,
                CHANNEL_NAME,
                toTrimmedString,
                toNumberOr,
                toIntOrNull,
                validateSyncMessage: validateSyncMessage,
                audiencePolicy: AUDIENCE_POLICY,
            });
        }

        /* ── Presenter mode ───────────────────────────────── */
        function initPresenterMode(data) {
            // Hide reveal, show presenter
            document.getElementById('reveal-root').style.display = 'none';
            document.getElementById('sl-toolbar-hover-zone').style.display = 'none';
            document.getElementById('sl-toolbar').style.display = 'none';
            document.getElementById('sl-keyboard-hint').style.display = 'none';
            const pv = document.getElementById('presenter-view');
            pv.classList.add('active');

            // Presenter view theme (default: light)
            const pvSavedTheme = storageGetRaw(PRESENTER_THEME_KEY) || 'light';
            const syncViewerTheme = isLight => document.body.classList.toggle('viewer-light', !!isLight);
            if (pvSavedTheme === 'light') pv.classList.add('light');
            syncViewerTheme(pvSavedTheme === 'light');
            const pvThemeBtn = document.getElementById('pv-btn-theme');
            const PV_SVG_MOON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> Thème`;
            const PV_SVG_SUN  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Thème`;
            if (pvThemeBtn) {
                pvThemeBtn.innerHTML = pvSavedTheme === 'light' ? PV_SVG_MOON : PV_SVG_SUN;
                pvThemeBtn.addEventListener('click', () => {
                    const nowLight = pv.classList.toggle('light');
                    storageSetRaw(PRESENTER_THEME_KEY, nowLight ? 'light' : 'dark');
                    syncViewerTheme(nowLight);
                    pvThemeBtn.innerHTML = nowLight ? PV_SVG_MOON : PV_SVG_SUN;
                });
            }

            // Apply theme + scoped CSS for presenter frames
            const themeData = window.OEIDesignTokens?.resolvePresentationTheme
                ? window.OEIDesignTokens.resolvePresentationTheme(data)
                : (typeof data.theme === 'string'
                    ? (SlidesThemes.BUILT_IN[data.theme] || SlidesThemes.BUILT_IN.dark)
                    : (data.theme || SlidesThemes.BUILT_IN.dark));
            const _themeCSS = SlidesThemes.generateCSS(themeData);
            const _stripRoot = css => css.replace(/:root\s*\{[^}]*\}\s*/g, '').replace(/body\s*\{[^}]*\}\s*/g, '');
            const _pvScoped = _stripRoot(_themeCSS.replace(/\.reveal/g, '.pv-current-frame')) + '\n' + _stripRoot(_themeCSS.replace(/\.reveal/g, '.pv-next-frame'));
            document.getElementById('sl-theme-css').textContent = _themeCSS + '\n' + _pvScoped;
            SlidesThemes.apply(themeData);

            const slides = (data.slides || []).filter(s => !s.hidden);
            const title = data.metadata?.title || 'Présentation';
            document.title = `🎤 ${title} — Présentateur`;
            document.getElementById('pv-title').textContent = title;

            const opts = {
                showSlideNumber: false,
                footerText: null,
                totalSlides: slides.length,
                chapterNumbers: SlidesRenderer._buildChapterNumbers(slides, data.autoNumberChapters),
                typography: SlidesShared.resolveTypographyDefaults(data.typography),
            };

            // Open audience window
            const channel = new BroadcastChannel(CHANNEL_NAME);
            _presenterSyncChannel = channel;
            window.OEIPresenterSyncBridge = {
                SYNC_MSG,
                post: msg => {
                    if (!msg || typeof msg !== 'object') return false;
                    if (typeof validateSyncMessage === 'function' && !validateSyncMessage(msg)) return false;
                    try {
                        channel.postMessage(msg);
                        return true;
                    } catch (_) {
                        return false;
                    }
                },
            };
            const audienceUrl = new URL(location.href);
            audienceUrl.searchParams.set('mode', 'audience');
            audienceUrl.searchParams.set('audienceMode', AUDIENCE_POLICY.mode || 'display');
            const audienceWin = window.open(audienceUrl.toString(), 'oei-audience', 'noopener');

            let currentIndex = 0;
            let currentFragmentIndex = -1; // -1 = aucun fragment visible
            let blackScreen = false;
            let _pvSceneId = 'balanced';
            let _pvCustomScene = null;

            const _pvEsc = value => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const _pvClock = ms => {
                const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
                const min = String(Math.floor(total / 60)).padStart(2, '0');
                const sec = String(total % 60).padStart(2, '0');
                return `${min}:${sec}`;
            };
            const _safeFilePart = value => String(value || 'session')
                .toLowerCase()
                .replace(/[^a-z0-9\-_.]+/g, '-')
                .replace(/-{2,}/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 80) || 'session';
            const _downloadBlob = (blob, filename) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    try { link.remove(); } catch (_) {}
                }, 200);
                setTimeout(() => URL.revokeObjectURL(url), 4000);
            };
            const _prepareSaveTarget = async (suggestedName, mimeType = '', ext = '') => {
                if (typeof window.showSaveFilePicker !== 'function') return { kind: 'download' };
                try {
                    const typeEntry = (mimeType && ext)
                        ? [{ description: 'Export', accept: { [mimeType]: [ext] } }]
                        : [];
                    const handle = await window.showSaveFilePicker({
                        suggestedName,
                        types: typeEntry,
                        excludeAcceptAllOption: false,
                    });
                    return handle ? { kind: 'handle', handle } : { kind: 'download' };
                } catch (err) {
                    if (err?.name === 'AbortError') return { kind: 'cancel' };
                    return { kind: 'download' };
                }
            };
            const _saveBlob = async (target, blob, filename) => {
                if (!blob) return false;
                if (target?.kind === 'cancel') return false;
                if (target?.kind === 'handle' && target.handle?.createWritable) {
                    const writable = await target.handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return true;
                }
                _downloadBlob(blob, filename);
                return true;
            };
            const _blobToDataUrl = blob => new Promise(resolve => {
                if (!blob) {
                    resolve('');
                    return;
                }
                try {
                    const reader = new FileReader();
                    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
                    reader.onerror = () => resolve('');
                    reader.readAsDataURL(blob);
                } catch (_) {
                    resolve('');
                }
            });

            const _sessionRec = {
                active: false,
                paused: false,
                replaying: false,
                startAt: 0,
                stopAt: 0,
                pausedAccumMs: 0,
                pauseStartedAt: 0,
                events: [],
                captions: [],
                autoNotesBySlide: {},
                mediaStream: null,
                mediaRecorder: null,
                audioChunks: [],
                audioBlob: null,
                audioMimeType: 'audio/webm',
                speechRecognition: null,
                speechEnabled: false,
                replayTimers: [],
                replayAudio: null,
                lastSession: null,
                labelTimer: null,
                exportBusy: false,
                exportMessage: '',
            };
            const _recStatusEl = () => document.getElementById('pv-rec-status');
            const _recLiveEl = () => document.getElementById('pv-rec-live');
            const _recButtonEl = () => document.getElementById('pv-btn-rec');
            const _recPauseButtonEl = () => document.getElementById('pv-btn-rec-pause');
            const _replayButtonEl = () => document.getElementById('pv-btn-replay');
            const _exportButtonEl = () => document.getElementById('pv-btn-export-session');
            const _exportReplayButtonEl = () => document.getElementById('pv-btn-export-replay');
            const _setExportMessage = (message = '') => {
                _sessionRec.exportMessage = String(message || '');
                _updateRecordingUi();
            };

            const _recordElapsedMs = (now = Date.now()) => {
                if (!_sessionRec.startAt) return 0;
                const safeNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
                const activePauseMs = _sessionRec.paused && _sessionRec.pauseStartedAt
                    ? Math.max(0, safeNow - _sessionRec.pauseStartedAt)
                    : 0;
                return Math.max(0, safeNow - _sessionRec.startAt - (_sessionRec.pausedAccumMs || 0) - activePauseMs);
            };

            const _recordEvent = (type, payload = {}) => {
                if (!_sessionRec.active) return;
                if (_sessionRec.paused) return;
                _sessionRec.events.push({
                    type: String(type || '').slice(0, 48),
                    t: _recordElapsedMs(Date.now()),
                    payload: (payload && typeof payload === 'object') ? payload : {},
                });
            };

            const _setLiveCaption = (text = '', ts = 0) => {
                const el = _recLiveEl();
                if (!el) return;
                const safeText = String(text || '').trim();
                if (!safeText) {
                    el.classList.remove('active');
                    el.textContent = '';
                    return;
                }
                el.classList.add('active');
                el.innerHTML = `<strong>[${_pvEsc(_pvClock(ts))}]</strong> ${_pvEsc(safeText)}`;
            };

            const _updateRecordingUi = () => {
                const status = _recStatusEl();
                const recBtn = _recButtonEl();
                const pauseBtn = _recPauseButtonEl();
                const replayBtn = _replayButtonEl();
                const exportBtn = _exportButtonEl();
                const exportReplayBtn = _exportReplayButtonEl();
                if (recBtn) {
                    recBtn.classList.toggle('rec-active', _sessionRec.active);
                    recBtn.innerHTML = _sessionRec.active
                        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>Stop`
                        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>Enregistrer`;
                }
                if (pauseBtn) {
                    pauseBtn.disabled = !_sessionRec.active || _sessionRec.exportBusy;
                    pauseBtn.classList.toggle('active', _sessionRec.paused);
                    pauseBtn.classList.toggle('rec-paused', _sessionRec.paused);
                    pauseBtn.innerHTML = _sessionRec.paused
                        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Reprendre`
                        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>Pause`;
                }
                if (replayBtn) {
                    replayBtn.classList.toggle('active', _sessionRec.replaying);
                    replayBtn.disabled = !_sessionRec.lastSession;
                    replayBtn.innerHTML = _sessionRec.replaying
                        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>Stop replay`
                        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Replay`;
                }
                if (exportBtn) exportBtn.disabled = !_sessionRec.lastSession || _sessionRec.exportBusy;
                if (exportReplayBtn) exportReplayBtn.disabled = !_sessionRec.lastSession || _sessionRec.exportBusy;
                if (recBtn) recBtn.disabled = _sessionRec.exportBusy;
                if (replayBtn) replayBtn.disabled = _sessionRec.exportBusy || !_sessionRec.lastSession;

                if (!status) return;
                status.classList.remove('recording', 'replay');
                if (_sessionRec.exportBusy) {
                    status.textContent = _sessionRec.exportMessage || 'Export en cours…';
                    return;
                }
                if (_sessionRec.exportMessage) {
                    status.textContent = _sessionRec.exportMessage;
                    return;
                }
                if (_sessionRec.active) {
                    const elapsed = _recordElapsedMs(Date.now());
                    const parts = [];
                    parts.push(_sessionRec.paused
                        ? `Enregistrement en pause · ${_pvClock(elapsed)}`
                        : `Enregistrement en cours · ${_pvClock(elapsed)}`);
                    parts.push(_sessionRec.speechEnabled ? 'Sous-titres auto: actif' : 'Sous-titres auto: indisponible');
                    status.textContent = parts.join(' · ');
                    status.classList.add('recording');
                    if (_sessionRec.labelTimer) clearTimeout(_sessionRec.labelTimer);
                    _sessionRec.labelTimer = setTimeout(_updateRecordingUi, 1000);
                    return;
                }
                if (_sessionRec.replaying) {
                    status.textContent = 'Replay en cours';
                    status.classList.add('replay');
                    return;
                }
                if (_sessionRec.lastSession) {
                    status.textContent = `Dernière session: ${_pvClock(_sessionRec.lastSession.durationMs || 0)} · ${(_sessionRec.lastSession.events || []).length} événements · ${(_sessionRec.lastSession.captions || []).length} sous-titres`;
                    return;
                }
                status.textContent = '';
            };

            const _appendAutoNote = (slideIdx, line) => {
                if (!Number.isFinite(Number(slideIdx)) || slideIdx < 0) return;
                const key = String(slideIdx);
                if (!_sessionRec.autoNotesBySlide[key]) _sessionRec.autoNotesBySlide[key] = [];
                _sessionRec.autoNotesBySlide[key].push(String(line || '').slice(0, 420));
                if (_sessionRec.autoNotesBySlide[key].length > 180) {
                    _sessionRec.autoNotesBySlide[key] = _sessionRec.autoNotesBySlide[key].slice(-180);
                }
            };

            const _onSpeechResult = event => {
                if (!_sessionRec.active) return;
                if (_sessionRec.paused) return;
                if (!event?.results) return;
                for (let i = event.resultIndex || 0; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (!result?.isFinal) continue;
                    const transcript = String(result[0]?.transcript || '').trim();
                    if (!transcript) continue;
                    const ts = Date.now() - _sessionRec.startAt;
                    const cap = { t: ts, text: transcript, slideIndex: currentIndex };
                    _sessionRec.captions.push(cap);
                    _appendAutoNote(currentIndex, `[${_pvClock(ts)}] ${transcript}`);
                    _setLiveCaption(transcript, ts);
                    _recordEvent('caption', { text: transcript, slideIndex: currentIndex });
                    if (currentIndex >= 0) renderCurrentSlide();
                }
            };

            const _startSpeechRecognition = () => {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) {
                    _sessionRec.speechEnabled = false;
                    return;
                }
                try {
                    const rec = new SR();
                    rec.lang = 'fr-FR';
                    rec.continuous = true;
                    rec.interimResults = false;
                    rec.maxAlternatives = 1;
                    rec.onresult = _onSpeechResult;
                    rec.onerror = () => { _sessionRec.speechEnabled = false; _updateRecordingUi(); };
                    rec.onend = () => {
                        if (_sessionRec.active) {
                            try { rec.start(); } catch (_) {}
                        }
                    };
                    rec.start();
                    _sessionRec.speechRecognition = rec;
                    _sessionRec.speechEnabled = true;
                } catch (_) {
                    _sessionRec.speechEnabled = false;
                }
            };

            const _stopSpeechRecognition = () => {
                const rec = _sessionRec.speechRecognition;
                _sessionRec.speechRecognition = null;
                _sessionRec.speechEnabled = false;
                if (!rec) return;
                try { rec.onend = null; } catch (_) {}
                try { rec.onresult = null; } catch (_) {}
                try { rec.stop(); } catch (_) {}
            };

            const _pauseSessionRecording = () => {
                if (!_sessionRec.active || _sessionRec.paused) return;
                _recordEvent('record:pause', { index: currentIndex, fragmentIndex: currentFragmentIndex });
                _sessionRec.paused = true;
                _sessionRec.pauseStartedAt = Date.now();
                _stopSpeechRecognition();
                if (_sessionRec.mediaRecorder && _sessionRec.mediaRecorder.state === 'recording') {
                    if (typeof _sessionRec.mediaRecorder.pause === 'function') {
                        try { _sessionRec.mediaRecorder.pause(); } catch (_) {}
                    }
                }
                _setLiveCaption('');
                _updateRecordingUi();
            };

            const _resumeSessionRecording = (silent = false) => {
                if (!_sessionRec.active || !_sessionRec.paused) return;
                const now = Date.now();
                if (_sessionRec.pauseStartedAt) {
                    _sessionRec.pausedAccumMs += Math.max(0, now - _sessionRec.pauseStartedAt);
                }
                _sessionRec.paused = false;
                _sessionRec.pauseStartedAt = 0;
                if (_sessionRec.mediaRecorder && _sessionRec.mediaRecorder.state === 'paused') {
                    if (typeof _sessionRec.mediaRecorder.resume === 'function') {
                        try { _sessionRec.mediaRecorder.resume(); } catch (_) {}
                    }
                }
                if (!silent) _startSpeechRecognition();
                if (!silent) {
                    _recordEvent('record:resume', { index: currentIndex, fragmentIndex: currentFragmentIndex });
                    _recordEvent('goTo', { index: currentIndex });
                    if (currentFragmentIndex >= 0) {
                        _recordEvent('fragment', { slideIndex: currentIndex, fragmentIndex: currentFragmentIndex, hidden: false });
                    }
                    _recordEvent('black', { on: !!blackScreen });
                }
                _updateRecordingUi();
            };

            const _stopReplay = () => {
                _sessionRec.replayTimers.forEach(timer => clearTimeout(timer));
                _sessionRec.replayTimers = [];
                if (_sessionRec.replayAudio) {
                    const replaySrc = _sessionRec.replayAudio.src || '';
                    try { _sessionRec.replayAudio.pause(); } catch (_) {}
                    if (replaySrc.startsWith('blob:')) {
                        try { URL.revokeObjectURL(replaySrc); } catch (_) {}
                    }
                    _sessionRec.replayAudio = null;
                }
                _sessionRec.replaying = false;
                _updateRecordingUi();
            };

            const _buildSessionSnapshot = () => {
                const startedAt = _sessionRec.startAt || Date.now();
                const endedAt = _sessionRec.stopAt || Date.now();
                const effectiveDurationMs = _recordElapsedMs(endedAt);
                return {
                    version: 2,
                    createdAt: new Date(startedAt).toISOString(),
                    endedAt: new Date(endedAt).toISOString(),
                    durationMs: Math.max(0, effectiveDurationMs),
                    wallDurationMs: Math.max(0, endedAt - startedAt),
                    pausedMs: Math.max(0, (endedAt - startedAt) - effectiveDurationMs),
                    presentation: {
                        title,
                        source: file || '__draft__',
                        slideCount: slides.length,
                    },
                    events: _sessionRec.events.slice(),
                    captions: _sessionRec.captions.slice(),
                    autoNotesBySlide: JSON.parse(JSON.stringify(_sessionRec.autoNotesBySlide || {})),
                    hasAudio: !!_sessionRec.audioBlob,
                    audioMimeType: _sessionRec.audioMimeType || 'audio/webm',
                };
            };

            const _startSessionRecording = async () => {
                if (_sessionRec.active) return;
                _stopReplay();
                _sessionRec.exportMessage = '';
                _setLiveCaption('');
                _sessionRec.active = true;
                _sessionRec.paused = false;
                _sessionRec.startAt = Date.now();
                _sessionRec.stopAt = 0;
                _sessionRec.pausedAccumMs = 0;
                _sessionRec.pauseStartedAt = 0;
                _sessionRec.events = [];
                _sessionRec.captions = [];
                _sessionRec.autoNotesBySlide = {};
                _sessionRec.audioChunks = [];
                _sessionRec.audioBlob = null;
                _sessionRec.lastSession = null;
                _recordEvent('record:start', { index: currentIndex, fragmentIndex: currentFragmentIndex });
                _updateRecordingUi();

                if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
                    try {
                        _sessionRec.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
                        const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
                        _sessionRec.mediaRecorder = mimeType
                            ? new MediaRecorder(_sessionRec.mediaStream, { mimeType })
                            : new MediaRecorder(_sessionRec.mediaStream);
                        _sessionRec.audioMimeType = _sessionRec.mediaRecorder.mimeType || 'audio/webm';
                        _sessionRec.mediaRecorder.ondataavailable = ev => {
                            if (ev.data && ev.data.size > 0) _sessionRec.audioChunks.push(ev.data);
                        };
                        _sessionRec.mediaRecorder.onstop = () => {
                            if (_sessionRec.audioChunks.length) {
                                _sessionRec.audioBlob = new Blob(_sessionRec.audioChunks, {
                                    type: _sessionRec.audioMimeType || 'audio/webm',
                                });
                            }
                            if (_sessionRec.lastSession) {
                                _sessionRec.lastSession.hasAudio = !!_sessionRec.audioBlob;
                                _sessionRec.lastSession.audioMimeType = _sessionRec.audioMimeType || 'audio/webm';
                            }
                            _updateRecordingUi();
                        };
                        _sessionRec.mediaRecorder.start(1000);
                    } catch (_) {
                        _sessionRec.mediaStream = null;
                        _sessionRec.mediaRecorder = null;
                    }
                }
                _startSpeechRecognition();
                _updateRecordingUi();
            };

            const _stopSessionRecording = () => {
                if (!_sessionRec.active) return;
                if (_sessionRec.paused) _resumeSessionRecording(true);
                _recordEvent('record:stop', { index: currentIndex, fragmentIndex: currentFragmentIndex });
                _sessionRec.active = false;
                _sessionRec.paused = false;
                _sessionRec.exportMessage = '';
                _sessionRec.stopAt = Date.now();
                if (_sessionRec.labelTimer) {
                    clearTimeout(_sessionRec.labelTimer);
                    _sessionRec.labelTimer = null;
                }
                _stopSpeechRecognition();
                if (_sessionRec.mediaRecorder && _sessionRec.mediaRecorder.state !== 'inactive') {
                    try { _sessionRec.mediaRecorder.stop(); } catch (_) {}
                }
                _sessionRec.mediaRecorder = null;
                if (_sessionRec.mediaStream) {
                    try { _sessionRec.mediaStream.getTracks().forEach(track => track.stop()); } catch (_) {}
                    _sessionRec.mediaStream = null;
                }
                _sessionRec.lastSession = _buildSessionSnapshot();
                _setLiveCaption('');
                _updateRecordingUi();
                renderCurrentSlide();
            };

            const _applyReplayEvent = entry => {
                if (!entry || typeof entry !== 'object') return;
                const type = String(entry.type || '');
                const payload = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
                if (type === 'goTo' && Number.isFinite(Number(payload.index))) {
                    goTo(Math.trunc(Number(payload.index)));
                    return;
                }
                if (type === 'fragment') {
                    const targetSlide = Number.isFinite(Number(payload.slideIndex))
                        ? Math.trunc(Number(payload.slideIndex))
                        : currentIndex;
                    if (targetSlide !== currentIndex) goTo(targetSlide);
                    const frags = _getFragments(document.getElementById('pv-current-inner'));
                    const fragIdx = Number.isFinite(Number(payload.fragmentIndex))
                        ? Math.trunc(Number(payload.fragmentIndex))
                        : -1;
                    const hidden = !!payload.hidden;
                    if (hidden && fragIdx >= 0 && fragIdx < frags.length) {
                        frags[fragIdx].classList.remove('visible');
                        currentFragmentIndex = Math.max(-1, fragIdx - 1);
                    } else if (!hidden && fragIdx >= 0 && fragIdx < frags.length) {
                        frags[fragIdx].classList.add('visible');
                        currentFragmentIndex = Math.max(currentFragmentIndex, fragIdx);
                    }
                    return;
                }
                if (type === 'black') {
                    blackScreen = !!payload.on;
                    document.getElementById('pv-current-frame').style.opacity = blackScreen ? '0' : '1';
                }
            };

            const _startReplaySession = () => {
                if (!_sessionRec.lastSession) return;
                if (_sessionRec.active) return;
                if (_sessionRec.replaying) {
                    _stopReplay();
                    return;
                }
                _sessionRec.replaying = true;
                _updateRecordingUi();
                const events = Array.isArray(_sessionRec.lastSession.events) ? _sessionRec.lastSession.events : [];
                events.forEach(entry => {
                    const delay = Math.max(0, Number(entry?.t || 0));
                    const timer = setTimeout(() => _applyReplayEvent(entry), delay);
                    _sessionRec.replayTimers.push(timer);
                });
                const totalMs = Math.max(0, Number(_sessionRec.lastSession.durationMs || 0));
                _sessionRec.replayTimers.push(setTimeout(() => _stopReplay(), totalMs + 150));
                if (_sessionRec.audioBlob) {
                    try {
                        const audio = new Audio(URL.createObjectURL(_sessionRec.audioBlob));
                        _sessionRec.replayAudio = audio;
                        audio.onended = () => {
                            try { URL.revokeObjectURL(audio.src); } catch (_) {}
                            if (_sessionRec.replayAudio === audio) _sessionRec.replayAudio = null;
                        };
                        audio.play().catch(() => {});
                    } catch (_) {}
                }
            };

            const _exportSessionRecording = () => {
                if (_sessionRec.active) _stopSessionRecording();
                if (!_sessionRec.lastSession) return;
                if (!_sessionRec.audioBlob && _sessionRec.audioChunks.length) {
                    _sessionRec.audioBlob = new Blob(_sessionRec.audioChunks, {
                        type: _sessionRec.audioMimeType || 'audio/webm',
                    });
                    _sessionRec.lastSession.hasAudio = true;
                    _sessionRec.lastSession.audioMimeType = _sessionRec.audioMimeType || 'audio/webm';
                }
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const base = `${_safeFilePart(title)}-${stamp}`;
                const jsonBlob = new Blob([JSON.stringify(_sessionRec.lastSession, null, 2)], { type: 'application/json' });
                _downloadBlob(jsonBlob, `${base}.json`);
                if (_sessionRec.audioBlob) {
                    const ext = String(_sessionRec.audioMimeType || '').includes('ogg') ? 'ogg' : 'webm';
                    _downloadBlob(_sessionRec.audioBlob, `${base}.${ext}`);
                }
            };

            const _buildReplayStandaloneHtml = ({ session, audioDataUrl = '' }) => {
                const replayOpts = {
                    showSlideNumber: false,
                    footerText: null,
                    totalSlides: slides.length,
                    chapterNumbers: SlidesRenderer._buildChapterNumbers(slides, data.autoNumberChapters),
                    typography: SlidesShared.resolveTypographyDefaults(data.typography),
                };
                const payload = {
                    title,
                    generatedAt: new Date().toISOString(),
                    dimensions: { width: 1280, height: 720 },
                    slidesHtml: slides.map((slide, i) => SlidesRenderer.renderSlide(slide, i, replayOpts)),
                    themeCss: document.getElementById('sl-theme-css')?.textContent || '',
                    session,
                    audioDataUrl: audioDataUrl || '',
                };
                const payloadJson = JSON.stringify(payload).replace(/</g, '\\u003c');
                return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${_pvEsc(title)} — Replay</title>
    <style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0b1120;color:#e2e8f0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{min-height:100vh;display:flex;flex-direction:column}
.rp-app{width:min(1400px,100%);margin:0 auto;padding:16px 16px 18px;display:flex;flex-direction:column;gap:12px}
.rp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.rp-title{font-size:1rem;font-weight:700;line-height:1.2}
.rp-meta{font-size:.76rem;color:#94a3b8}
.rp-stage-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#020617;border:1px solid rgba(148,163,184,.35);border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(2,6,23,.45)}
.rp-reveal{position:absolute;left:0;top:0;width:1280px;height:720px;transform-origin:top left}
.rp-reveal .slides{position:relative;width:100%;height:100%}
.rp-reveal .slides > section{position:absolute;inset:0}
.rp-black{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .16s}
.rp-black.active{opacity:1}
.rp-controls{display:grid;grid-template-columns:auto auto auto 1fr auto auto;gap:8px;align-items:center}
.rp-btn,.rp-select{height:34px;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:#0f172a;color:#e2e8f0;padding:0 10px;font-size:.78rem;cursor:pointer}
.rp-btn:hover,.rp-select:hover{background:#111c34}
.rp-btn svg{width:14px;height:14px;vertical-align:-2px}
.rp-btn.rp-play{min-width:98px}
.rp-time{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.74rem;color:#cbd5e1;min-width:124px;text-align:right}
.rp-timeline{width:100%;height:34px;accent-color:#38bdf8}
.rp-slide-count{font-size:.75rem;color:#94a3b8;text-align:right}
.rp-audio-note{font-size:.72rem;color:#94a3b8}
.fragment{opacity:0;visibility:hidden;transition:opacity .2s ease, transform .2s ease}
.fragment.visible{opacity:1;visibility:inherit}
@media (max-width:960px){
    .rp-app{padding:12px}
    .rp-controls{grid-template-columns:auto auto auto 1fr;grid-template-areas:"prev play next time" "timeline timeline timeline timeline" "speed restart count count"}
    #rp-prev{grid-area:prev}
    #rp-play{grid-area:play}
    #rp-next{grid-area:next}
    #rp-time{grid-area:time;text-align:right}
    #rp-timeline{grid-area:timeline}
    #rp-speed{grid-area:speed}
    #rp-restart{grid-area:restart}
    #rp-slide-count{grid-area:count}
}
    </style>
    <style id="rp-theme"></style>
</head>
<body>
    <div class="rp-app">
        <div class="rp-head">
            <div>
                <div class="rp-title">${_pvEsc(title)} — Replay</div>
                <div class="rp-meta" id="rp-meta"></div>
            </div>
            <div class="rp-audio-note" id="rp-audio-note"></div>
        </div>
        <div class="rp-stage-wrap" id="rp-stage-wrap">
            <div class="reveal rp-reveal" id="rp-reveal">
                <div class="slides" id="rp-slide-root"></div>
            </div>
            <div class="rp-black" id="rp-black"></div>
        </div>
        <div class="rp-controls">
            <button class="rp-btn" id="rp-prev" type="button" title="Slide précédente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="rp-btn rp-play" id="rp-play" type="button" title="Lecture / pause">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>
                Lecture
            </button>
            <button class="rp-btn" id="rp-next" type="button" title="Slide suivante">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <input class="rp-timeline" id="rp-timeline" type="range" min="0" max="1000" step="10" value="0">
            <div class="rp-time" id="rp-time">00:00 / 00:00</div>
            <select class="rp-select" id="rp-speed" title="Vitesse de lecture">
                <option value="0.75">0.75x</option>
                <option value="1" selected>1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>
            <button class="rp-btn" id="rp-restart" type="button" title="Revenir au début">Début</button>
            <div class="rp-slide-count" id="rp-slide-count"></div>
        </div>
    </div>
    <audio id="rp-audio" preload="auto" style="display:none"></audio>
    <script id="rp-data" type="application/json">${payloadJson}</script>
    <script>
(function() {
    var payload;
    try {
        payload = JSON.parse((document.getElementById('rp-data') || {}).textContent || '{}');
    } catch (_) {
        payload = {};
    }
    var slides = Array.isArray(payload.slidesHtml) ? payload.slidesHtml : [];
    var session = payload.session && typeof payload.session === 'object' ? payload.session : {};
    var events = Array.isArray(session.events) ? session.events.slice() : [];
    events.sort(function(a, b) { return (Number(a && a.t || 0) - Number(b && b.t || 0)); });
    var totalSlides = slides.length;
    var durationMs = Math.max(0, Number(session.durationMs || 0));
    var audioUrl = String(payload.audioDataUrl || '');
    var themeCss = String(payload.themeCss || '');

    var stageWrap = document.getElementById('rp-stage-wrap');
    var reveal = document.getElementById('rp-reveal');
    var slideRoot = document.getElementById('rp-slide-root');
    var blackEl = document.getElementById('rp-black');
    var playBtn = document.getElementById('rp-play');
    var prevBtn = document.getElementById('rp-prev');
    var nextBtn = document.getElementById('rp-next');
    var restartBtn = document.getElementById('rp-restart');
    var speedEl = document.getElementById('rp-speed');
    var timeline = document.getElementById('rp-timeline');
    var timeEl = document.getElementById('rp-time');
    var countEl = document.getElementById('rp-slide-count');
    var metaEl = document.getElementById('rp-meta');
    var audioNoteEl = document.getElementById('rp-audio-note');
    var audioEl = document.getElementById('rp-audio');
    var themeEl = document.getElementById('rp-theme');

    themeEl.textContent = themeCss;
    metaEl.textContent = totalSlides + ' slides · durée ' + fmtClock(durationMs);

    if (audioUrl) {
        audioEl.src = audioUrl;
        audioNoteEl.textContent = 'Audio synchronisé intégré';
    } else {
        audioEl.removeAttribute('src');
        audioNoteEl.textContent = 'Aucun audio (replay visuel uniquement)';
    }

    timeline.max = String(Math.max(0, durationMs));
    timeline.step = '10';
    timeline.value = '0';

    var playbackRate = 1;
    var playheadMs = 0;
    var playing = false;
    var rafId = 0;
    var wallStartMs = 0;
    var lastRenderedSlide = -1;
    var manualSlideIndex = null;

    var slideAnchors = [];
    for (var i = 0; i < events.length; i++) {
        var ev = events[i];
        var tp = String(ev && ev.type || '');
        var p = ev && ev.payload && typeof ev.payload === 'object' ? ev.payload : {};
        if (tp === 'record:start' || tp === 'goTo') {
            var idx = toSlideIndex(p.index, totalSlides);
            if (idx !== null) slideAnchors.push({ t: Math.max(0, Number(ev.t || 0)), index: idx });
        }
    }
    if (!slideAnchors.length && totalSlides > 0) slideAnchors.push({ t: 0, index: 0 });

    function fmtClock(ms) {
        var total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
        var min = String(Math.floor(total / 60)).padStart(2, '0');
        var sec = String(total % 60).padStart(2, '0');
        return min + ':' + sec;
    }
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    function toInt(v) {
        var n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    function toSlideIndex(v, total) {
        var n = toInt(v);
        if (n === null) return null;
        if (n < 0 || n >= total) return null;
        return n;
    }
    function getFragments(container) {
        if (!container) return [];
        return Array.from(container.querySelectorAll('.fragment')).sort(function(a, b) {
            var ia = a.dataset.fragmentIndex != null ? parseInt(a.dataset.fragmentIndex, 10) : Number.POSITIVE_INFINITY;
            var ib = b.dataset.fragmentIndex != null ? parseInt(b.dataset.fragmentIndex, 10) : Number.POSITIVE_INFINITY;
            if (ia !== ib) return ia - ib;
            return 0;
        });
    }
    function computeStateAt(ms) {
        var state = { index: 0, fragmentIndex: -1, black: false };
        for (var i = 0; i < events.length; i++) {
            var entry = events[i];
            var t = Math.max(0, Number(entry && entry.t || 0));
            if (t > ms) break;
            var type = String(entry && entry.type || '');
            var payload = entry && entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
            if (type === 'record:start') {
                var rIdx = toSlideIndex(payload.index, totalSlides);
                if (rIdx !== null) state.index = rIdx;
                var rFrag = toInt(payload.fragmentIndex);
                state.fragmentIndex = rFrag !== null ? rFrag : -1;
                state.black = false;
                continue;
            }
            if (type === 'goTo') {
                var nextIdx = toSlideIndex(payload.index, totalSlides);
                if (nextIdx !== null) {
                    state.index = nextIdx;
                    state.fragmentIndex = -1;
                    state.black = false;
                }
                continue;
            }
            if (type === 'fragment') {
                var slideIdx = toSlideIndex(payload.slideIndex, totalSlides);
                if (slideIdx !== null && slideIdx !== state.index) continue;
                var frag = toInt(payload.fragmentIndex);
                if (frag === null) continue;
                if (payload.hidden) state.fragmentIndex = Math.min(state.fragmentIndex, frag - 1);
                else state.fragmentIndex = Math.max(state.fragmentIndex, frag);
                continue;
            }
            if (type === 'black') {
                state.black = !!payload.on;
            }
        }
        state.index = clamp(state.index, 0, Math.max(0, totalSlides - 1));
        return state;
    }
    function renderState(state) {
        if (!state || !totalSlides) return;
        if (state.index !== lastRenderedSlide) {
            slideRoot.innerHTML = slides[state.index] || '';
            var section = slideRoot.querySelector('section');
            if (section) {
                var notes = section.querySelector('aside.notes');
                if (notes) notes.remove();
            }
            lastRenderedSlide = state.index;
        }
        var frags = getFragments(slideRoot);
        for (var i = 0; i < frags.length; i++) {
            frags[i].classList.toggle('visible', i <= state.fragmentIndex);
        }
        blackEl.classList.toggle('active', !!state.black);
        countEl.textContent = 'Slide ' + (state.index + 1) + ' / ' + totalSlides;
        prevBtn.disabled = state.index <= 0;
        nextBtn.disabled = state.index >= (totalSlides - 1);
    }
    function updateTimeUi() {
        var ms = Math.max(0, Math.round(playheadMs));
        timeline.value = String(ms);
        timeEl.textContent = fmtClock(ms) + ' / ' + fmtClock(durationMs);
    }
    function syncAudio(force) {
        if (!audioUrl) return;
        var target = Math.max(0, playheadMs / 1000);
        try {
            if (force || Math.abs((audioEl.currentTime || 0) - target) > 0.2) audioEl.currentTime = target;
            audioEl.playbackRate = playbackRate;
            if (playing && audioEl.paused) audioEl.play().catch(function() {});
            if (!playing && !audioEl.paused) audioEl.pause();
        } catch (_) {}
    }
    function seek(ms, forceAudio) {
        playheadMs = clamp(Number(ms || 0), 0, durationMs);
        if (manualSlideIndex != null) manualSlideIndex = null;
        renderState(computeStateAt(playheadMs));
        updateTimeUi();
        syncAudio(!!forceAudio);
        if (playing) {
            wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        }
    }
    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    }
    function tick() {
        if (!playing) return;
        playheadMs = clamp((performance.now() - wallStartMs) * playbackRate, 0, durationMs);
        renderState(computeStateAt(playheadMs));
        updateTimeUi();
        syncAudio(false);
        if (playheadMs >= durationMs) {
            setPlaying(false);
            return;
        }
        rafId = requestAnimationFrame(tick);
    }
    function setPlayBtnLabel(isPlaying) {
        if (isPlaying) {
            playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1"/><rect x="13.5" y="6" width="3.5" height="12" rx="1"/></svg>Pause';
            return;
        }
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Lecture';
    }
    function findNearestAnchorForSlide(targetIndex) {
        var best = null;
        var bestDist = Number.POSITIVE_INFINITY;
        for (var i = 0; i < slideAnchors.length; i++) {
            var a = slideAnchors[i];
            if (a.index !== targetIndex) continue;
            var d = Math.abs(a.t - playheadMs);
            if (d < bestDist) {
                bestDist = d;
                best = a.t;
            }
        }
        return best;
    }
    function setPlaying(next) {
        if (!!next === playing) return;
        playing = !!next;
        setPlayBtnLabel(playing);
        if (!playing) {
            stopLoop();
            syncAudio(false);
            return;
        }
        if (manualSlideIndex != null) {
            var anchor = findNearestAnchorForSlide(manualSlideIndex);
            manualSlideIndex = null;
            if (anchor != null) seek(anchor, true);
        }
        if (playheadMs >= durationMs) seek(0, true);
        wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        syncAudio(true);
        tick();
    }
    function jumpSlide(delta) {
        var baseState = manualSlideIndex != null
            ? { index: manualSlideIndex, fragmentIndex: -1, black: false }
            : computeStateAt(playheadMs);
        var target = clamp(baseState.index + delta, 0, Math.max(0, totalSlides - 1));
        if (target === baseState.index) return;
        setPlaying(false);
        var anchor = findNearestAnchorForSlide(target);
        if (anchor != null) {
            seek(anchor, true);
            return;
        }
        manualSlideIndex = target;
        renderState({ index: target, fragmentIndex: -1, black: false });
    }
    function scaleStage() {
        var w = stageWrap.clientWidth || 1;
        var h = stageWrap.clientHeight || 1;
        var sx = w / 1280;
        var sy = h / 720;
        var scale = Math.min(sx, sy);
        reveal.style.transform = 'scale(' + scale + ')';
    }

    playBtn.addEventListener('click', function() { setPlaying(!playing); });
    prevBtn.addEventListener('click', function() { jumpSlide(-1); });
    nextBtn.addEventListener('click', function() { jumpSlide(1); });
    restartBtn.addEventListener('click', function() {
        setPlaying(false);
        seek(0, true);
    });
    speedEl.addEventListener('change', function() {
        var v = Number(speedEl.value);
        playbackRate = Number.isFinite(v) ? clamp(v, 0.5, 2) : 1;
        if (playing) wallStartMs = performance.now() - (playheadMs / Math.max(0.1, playbackRate));
        syncAudio(true);
    });
    timeline.addEventListener('input', function() {
        seek(Number(timeline.value || 0), true);
    });
    window.addEventListener('resize', scaleStage);
    document.addEventListener('keydown', function(ev) {
        if (ev.key === ' ' || ev.key === 'k' || ev.key === 'K') {
            ev.preventDefault();
            setPlaying(!playing);
        } else if (ev.key === 'ArrowLeft') {
            ev.preventDefault();
            jumpSlide(-1);
        } else if (ev.key === 'ArrowRight') {
            ev.preventDefault();
            jumpSlide(1);
        } else if (ev.key === 'Home') {
            ev.preventDefault();
            setPlaying(false);
            seek(0, true);
        }
    });

    setPlayBtnLabel(false);
    scaleStage();
    if (durationMs > 0) {
        seek(0, true);
    } else if (totalSlides > 0) {
        renderState({ index: 0, fragmentIndex: -1, black: false });
        updateTimeUi();
    }
})();
    </script>
</body>
</html>`;
            };

            const _exportReplayStandalone = async () => {
                if (_sessionRec.exportBusy) return;
                if (_sessionRec.active) _stopSessionRecording();
                if (!_sessionRec.lastSession) return;
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const base = `${_safeFilePart(title)}-replay-${stamp}`;
                _sessionRec.exportBusy = true;
                _setExportMessage('Préparation du replay HTML…');
                try {
                    const saveTarget = await _prepareSaveTarget(`${base}.html`, 'text/html', '.html');
                    if (saveTarget?.kind === 'cancel') {
                        _setExportMessage('Export replay annulé');
                        return;
                    }
                    if (!_sessionRec.audioBlob && _sessionRec.audioChunks.length) {
                        _sessionRec.audioBlob = new Blob(_sessionRec.audioChunks, {
                            type: _sessionRec.audioMimeType || 'audio/webm',
                        });
                        _sessionRec.lastSession.hasAudio = true;
                        _sessionRec.lastSession.audioMimeType = _sessionRec.audioMimeType || 'audio/webm';
                    }
                    const audioDataUrl = await _blobToDataUrl(_sessionRec.audioBlob);
                    const html = _buildReplayStandaloneHtml({
                        session: _sessionRec.lastSession,
                        audioDataUrl,
                    });
                    const htmlBlob = new Blob([html], { type: 'text/html' });
                    const saved = await _saveBlob(saveTarget, htmlBlob, `${base}.html`);
                    _setExportMessage(saved ? 'Replay HTML exporté' : 'Export replay annulé');
                } catch (err) {
                    console.error('Replay export error:', err);
                    _setExportMessage(`Erreur export replay: ${err?.message || 'inconnue'}`);
                } finally {
                    _sessionRec.exportBusy = false;
                    _updateRecordingUi();
                }
            };

            // ── Session persistence (file + slide) ────────────────
            try {
                const prevSess = storageGetJSON(PRESENTER_SESSION_KEY, null);
                const curFile = file || '__draft__';
                // Restore slide position if returning to the same file
                if (prevSess && prevSess.file === curFile && prevSess.slide > 0 && prevSess.slide < slides.length) {
                    currentIndex = prevSess.slide;
                }
                storageSetJSON(PRESENTER_SESSION_KEY, { file: curFile, slide: currentIndex });
            } catch(e) {}

            // Make data available to roomOpenPeer() so students receive room:init
            _presentationData = data;
            ViewerRuntime.presenterCurrentIndex = currentIndex;
            ViewerRuntime.presenterCurrentFragment = currentFragmentIndex;

            // Retourne les .fragment du conteneur triés par data-fragment-index puis ordre DOM
            function _getFragments(container) {
                return Array.from(container.querySelectorAll('.fragment')).sort((a, b) => {
                    const ia = a.dataset.fragmentIndex != null ? parseInt(a.dataset.fragmentIndex) : Infinity;
                    const ib = b.dataset.fragmentIndex != null ? parseInt(b.dataset.fragmentIndex) : Infinity;
                    return ia !== ib ? ia - ib : 0; // même index → même étape, DOM order
                });
            }

            const applyPreviewFrameBackground = (frameEl, slideData) => {
                if (!frameEl || !slideData) return;
                if (window.OEIBackgroundUtils?.applyToElement) {
                    window.OEIBackgroundUtils.applyToElement(frameEl, slideData);
                    return;
                }
                frameEl.style.background = slideData.bg || '';
            };

            function broadcastState() {
                channel.postMessage({ type: SYNC_MSG.GO_TO, index: currentIndex });
                if (blackScreen) channel.postMessage({ type: SYNC_MSG.BLACK, on: true });
                if (_activePoll) {
                    const snap = _roomBridgeSnapshotPoll();
                    channel.postMessage({
                        type: SYNC_MSG.POLL_START,
                        pollId: _activePoll.pollId,
                        pollType: _activePoll.type,
                        prompt: _activePoll.prompt || '',
                        options: Array.isArray(_activePoll.options) ? _activePoll.options.slice() : [],
                        multi: !!_activePoll.multi,
                    });
                    channel.postMessage({
                        type: SYNC_MSG.POLL_UPDATE,
                        pollId: _activePoll.pollId,
                        pollType: _activePoll.type,
                        prompt: _activePoll.prompt || '',
                        options: Array.isArray(_activePoll.options) ? _activePoll.options.slice() : [],
                        multi: !!_activePoll.multi,
                        counts: snap.counts || [],
                        total: snap.total || 0,
                        totalSelections: snap.totalSelections || 0,
                    });
                } else {
                    channel.postMessage({ type: SYNC_MSG.POLL_END });
                }
                if (_activeWordCloud) {
                    const words = [..._activeWordCloud.words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
                    channel.postMessage({ type: SYNC_MSG.WORDCLOUD_START, cloudId: _activeWordCloud.cloudId, prompt: _activeWordCloud.prompt || '' });
                    channel.postMessage({ type: SYNC_MSG.WORDCLOUD_UPDATE, cloudId: _activeWordCloud.cloudId, prompt: _activeWordCloud.prompt || '', words });
                } else {
                    channel.postMessage({ type: SYNC_MSG.WORDCLOUD_END });
                }
                if (_activeExitTicket) {
                    const exitSnap = _roomBridgeSnapshotExitTicket();
                    channel.postMessage({
                        type: SYNC_MSG.EXIT_TICKET_START,
                        ticketId: _activeExitTicket.ticketId,
                        title: _activeExitTicket.title || 'Exit ticket',
                        prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                    });
                    channel.postMessage({
                        type: SYNC_MSG.EXIT_TICKET_UPDATE,
                        ticketId: _activeExitTicket.ticketId,
                        title: _activeExitTicket.title || 'Exit ticket',
                        prompts: Array.isArray(_activeExitTicket.prompts) ? _activeExitTicket.prompts.slice() : [],
                        responsesCount: exitSnap.responsesCount || 0,
                        responses: (Array.isArray(exitSnap.responses) ? exitSnap.responses : []).slice(0, 24),
                    });
                } else {
                    channel.postMessage({ type: SYNC_MSG.EXIT_TICKET_END });
                }
                if (_activeRankOrder) {
                    const rankSnap = _roomBridgeSnapshotRankOrder();
                    channel.postMessage({
                        type: SYNC_MSG.RANK_ORDER_START,
                        rankId: _activeRankOrder.rankId,
                        title: _activeRankOrder.title || 'Classement collectif',
                        items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                    });
                    channel.postMessage({
                        type: SYNC_MSG.RANK_ORDER_UPDATE,
                        rankId: _activeRankOrder.rankId,
                        title: _activeRankOrder.title || 'Classement collectif',
                        items: Array.isArray(_activeRankOrder.items) ? _activeRankOrder.items.slice() : [],
                        rows: Array.isArray(rankSnap.rows) ? rankSnap.rows : [],
                        responsesCount: rankSnap.responsesCount || 0,
                    });
                } else {
                    channel.postMessage({ type: SYNC_MSG.RANK_ORDER_END });
                }
            }

            function _fitPreview(innerEl, frameEl, w = 1280, h = 720) {
                if (!innerEl || !frameEl) return;
                const fw = frameEl.clientWidth;
                const fh = frameEl.clientHeight;
                if (!(fw > 0) || !(fh > 0)) {
                    innerEl.style.transform = '';
                    return;
                }
                const scale = Math.min(fw / w, fh / h);
                const tx = Math.max(0, (fw - (w * scale)) / 2);
                const ty = Math.max(0, (fh - (h * scale)) / 2);
                innerEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
            }

            function renderCurrentSlide() {
                const slide = slides[currentIndex];
                if (!slide) return;

                // Current slide
                const currentFrame = document.getElementById('pv-current-frame');
                const currentInner = document.getElementById('pv-current-inner');
                currentInner.innerHTML = SlidesRenderer.renderSlide(slide, currentIndex, opts);
                const section = currentInner.querySelector('section');
                if (section) {
                    const aside = section.querySelector('aside.notes');
                    if (aside) aside.remove();
                }
                applyPreviewFrameBackground(currentFrame, slide);
                // Scale + center to fit frame
                _fitPreview(currentInner, currentFrame);

                // Next slide
                const nextInner = document.getElementById('pv-next-inner');
                const nextFrame = document.getElementById('pv-next-frame');
                if (currentIndex + 1 < slides.length) {
                    const nextSlide = slides[currentIndex + 1];
                    nextInner.innerHTML = SlidesRenderer.renderSlide(nextSlide, currentIndex + 1, opts);
                    const nextSection = nextInner.querySelector('section');
                    if (nextSection) {
                        const nAside = nextSection.querySelector('aside.notes');
                        if (nAside) nAside.remove();
                    }
                    applyPreviewFrameBackground(nextFrame, nextSlide);
                    _fitPreview(nextInner, nextFrame);
                } else {
                    nextInner.innerHTML = '<div class="pv-next-empty">Fin de la présentation</div>';
                    nextInner.style.transform = '';
                    nextFrame.style.background = '';
                    nextFrame.style.backgroundImage = '';
                    nextFrame.style.backgroundSize = '';
                    nextFrame.style.backgroundPosition = '';
                    nextFrame.style.backgroundRepeat = '';
                }

                // Notes
                const notesEl = document.getElementById('pv-notes');
                const manualNotesHtml = slide.notes
                    ? `<div class="pv-notes-prewrap">${slide.notes}</div>`
                    : '<div class="pv-notes-empty">Pas de notes pour ce slide</div>';
                const autoLines = Array.isArray(_sessionRec.autoNotesBySlide[String(currentIndex)])
                    ? _sessionRec.autoNotesBySlide[String(currentIndex)]
                    : [];
                const autoNotesHtml = autoLines.length
                    ? `<div class="pv-notes-auto"><div class="pv-notes-auto-title">Sous-titres / notes auto</div><div class="pv-notes-prewrap">${_pvEsc(autoLines.join('\n'))}</div></div>`
                    : '';
                notesEl.innerHTML = manualNotesHtml + autoNotesHtml;
                _updateRecordingUi();

                // Counter
                document.getElementById('pv-counter').textContent = `Slide ${currentIndex + 1} / ${slides.length}`;
                document.getElementById('pv-progress').textContent = `${currentIndex + 1} / ${slides.length}`;

                // Nav buttons state
                document.getElementById('pv-prev').disabled = currentIndex === 0;
                document.getElementById('pv-next-btn').disabled = currentIndex >= slides.length - 1;

                // Black screen
                currentFrame.style.opacity = blackScreen ? '0' : '1';

                // Mount special elements (LaTeX, Mermaid, Timer, Quiz) in presenter frames
                SlidesRenderer.mountSpecialElements(currentInner);
                SlidesRenderer.mountSpecialElements(nextInner);
                // Mount interactive widgets
                SlidesRenderer.mountWidgets(currentInner);
                SlidesRenderer.mountWidgets(nextInner);
                // Apply fragment visibility state (currentFragmentIndex)
                _getFragments(currentInner).forEach((f, i) => f.classList.toggle('visible', i <= currentFragmentIndex));
                ViewerRuntime.presenterCurrentFragment = currentFragmentIndex;
            }

            function goTo(idx) {
                if (idx < 0 || idx >= slides.length) return;
                currentIndex = idx;
                currentFragmentIndex = -1; // reset fragments on slide change
                _setLiveCaption('');
                ViewerRuntime.presenterCurrentIndex = idx;
                ViewerRuntime.presenterCurrentFragment = currentFragmentIndex;
                blackScreen = false;
                _recordEvent('goTo', { index: idx });
                renderCurrentSlide();
                channel.postMessage({ type: SYNC_MSG.GO_TO, index: currentIndex });
                channel.postMessage({ type: SYNC_MSG.BLACK, on: false });
                // Broadcast slide change to P2P connected students
                if (_room.active) roomBroadcast({ type: ROOM_MSG.SLIDE_CHANGE, index: idx, fragmentOrder: -1, fragmentIndex: -1 });
                // Persist current slide for resume
                try {
                    const s = storageGetJSON(PRESENTER_SESSION_KEY, {});
                    s.slide = idx;
                    storageSetJSON(PRESENTER_SESSION_KEY, s);
                } catch(e) {}
            }

            function goNext() {
                const frags = _getFragments(document.getElementById('pv-current-inner'));
                if (currentFragmentIndex < frags.length - 1) {
                    currentFragmentIndex++;
                    ViewerRuntime.presenterCurrentFragment = currentFragmentIndex;
                    frags[currentFragmentIndex].classList.add('visible');
                    _recordEvent('fragment', { slideIndex: currentIndex, fragmentIndex: currentFragmentIndex, hidden: false });
                    channel.postMessage({ type: SYNC_MSG.FRAGMENT_STEP, slideIndex: currentIndex, fragmentIndex: currentFragmentIndex });
                    if (_room.active) {
                        roomBroadcast({
                            type: ROOM_MSG.SLIDE_FRAGMENT,
                            index: currentIndex,
                            fragmentOrder: currentFragmentIndex,
                            fragmentIndex: frags[currentFragmentIndex].dataset.fragmentIndex ?? currentFragmentIndex,
                            hidden: false,
                        });
                    }
                } else {
                    goTo(currentIndex + 1);
                }
            }
            function goPrev() {
                if (currentFragmentIndex >= 0) {
                    const frags = _getFragments(document.getElementById('pv-current-inner'));
                    const removedOrder = currentFragmentIndex;
                    frags[currentFragmentIndex].classList.remove('visible');
                    channel.postMessage({ type: SYNC_MSG.FRAGMENT_STEP, slideIndex: currentIndex, fragmentIndex: currentFragmentIndex - 1 });
                    if (_room.active) {
                        roomBroadcast({
                            type: ROOM_MSG.SLIDE_FRAGMENT,
                            index: currentIndex,
                            fragmentOrder: removedOrder,
                            fragmentIndex: frags[currentFragmentIndex].dataset.fragmentIndex ?? currentFragmentIndex,
                            hidden: true,
                        });
                    }
                    _recordEvent('fragment', { slideIndex: currentIndex, fragmentIndex: removedOrder, hidden: true });
                    currentFragmentIndex--;
                    ViewerRuntime.presenterCurrentFragment = currentFragmentIndex;
                } else {
                    goTo(currentIndex - 1);
                }
            }

            function toggleBlack() {
                blackScreen = !blackScreen;
                document.getElementById('pv-current-frame').style.opacity = blackScreen ? '0' : '1';
                channel.postMessage({ type: SYNC_MSG.BLACK, on: blackScreen });
                _recordEvent('black', { on: blackScreen });
            }

            // Timer
            let timerSeconds = 0, timerRunning = false, timerInterval = null;
            const timerEl = document.getElementById('pv-timer');

            function timerFmt(s) {
                const h = Math.floor(s / 3600);
                const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
                const sec = String(s % 60).padStart(2, '0');
                return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
            }
            function timerToggle() {
                if (timerRunning) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    timerEl.classList.remove('running');
                    _recordEvent('timer', { action: 'pause', seconds: timerSeconds });
                } else {
                    timerRunning = true;
                    timerEl.classList.add('running');
                    _recordEvent('timer', { action: 'start', seconds: timerSeconds });
                    timerInterval = setInterval(() => {
                        timerSeconds++;
                        timerEl.textContent = timerFmt(timerSeconds);
                    }, 1000);
                }
            }
            function timerReset() {
                clearInterval(timerInterval);
                timerRunning = false;
                timerSeconds = 0;
                timerEl.textContent = timerFmt(0);
                timerEl.classList.remove('running');
                _recordEvent('timer', { action: 'reset', seconds: 0 });
            }

            PresenterControls.goNext = goNext;
            PresenterControls.goPrev = goPrev;
            PresenterControls.goTo = goTo;
            PresenterControls.toggleBlack = toggleBlack;
            PresenterControls.timerToggle = timerToggle;
            PresenterControls.timerReset = timerReset;

            timerEl.addEventListener('click', timerToggle);
            timerEl.addEventListener('dblclick', timerReset);

            // Nav buttons
            document.getElementById('pv-prev').addEventListener('click', goPrev);
            document.getElementById('pv-next-btn').addEventListener('click', goNext);

            function openPresenterRoomPanel() {
                const roomModal = document.getElementById('sl-room-modal');
                if (!roomModal) return;
                switchRoomPresenterMode('technique', true);
                roomModal.classList.add('open');
                roomUpdatePanel();
            }
            function openPresenterNetworkPanel() {
                openPresenterRoomPanel();
                switchRoomTab('tools');
                const diag = document.getElementById('rm-network-diagnostics');
                if (diag && typeof diag.scrollIntoView === 'function') {
                    diag.scrollIntoView({ block: 'nearest' });
                }
            }
            PresenterControls.switchTab = null;
            document.getElementById('pv-context-open-salle')?.addEventListener('click', openPresenterRoomPanel);

            // Keep room panel as modal in presenter, force technique mode for a focused workflow.
            const pvRoomPanelEl = document.getElementById('sl-room-panel');
            if (pvRoomPanelEl) {
                const remoteSection = document.getElementById('rm-remote-control');
                if (remoteSection) remoteSection.remove();
                switchRoomPresenterMode('technique', true);
                roomUpdatePanel();
            }

            // Room toolbar button and quick action
            document.getElementById('pv-btn-room')?.addEventListener('click', openPresenterRoomPanel);
            document.getElementById('pv-btn-room-quick')?.addEventListener('click', () => {
                if (!_room.active) {
                    roomOpenPeer();
                    return;
                }
                roomSetAudienceQrVisibility(!_pvQrVisible);
            });
            document.getElementById('pv-btn-network')?.addEventListener('click', () => {
                if (!_room.active) roomOpenPeer();
                openPresenterNetworkPanel();
            });
            roomUpdateQrButtonsUI();
            roomUpdateNetworkDiagnostics();

            // Toolbar buttons
            document.getElementById('pv-btn-black').addEventListener('click', toggleBlack);
            document.getElementById('pv-btn-fullscreen').addEventListener('click', () => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen();
            });
            document.getElementById('pv-btn-rec')?.addEventListener('click', async () => {
                if (_sessionRec.active) {
                    _stopSessionRecording();
                    return;
                }
                await _startSessionRecording();
            });
            document.getElementById('pv-btn-rec-pause')?.addEventListener('click', () => {
                if (!_sessionRec.active) return;
                if (_sessionRec.paused) _resumeSessionRecording();
                else _pauseSessionRecording();
            });
            document.getElementById('pv-btn-replay')?.addEventListener('click', () => {
                _startReplaySession();
            });
            document.getElementById('pv-btn-export-session')?.addEventListener('click', () => {
                _exportSessionRecording();
            });
            document.getElementById('pv-btn-export-replay')?.addEventListener('click', async () => {
                await _exportReplayStandalone();
            });
            document.getElementById('pv-btn-editor').addEventListener('click', () => {
                if (_sessionRec.active) _stopSessionRecording();
                _stopReplay();
                if (_presenterSyncChannel === channel) _presenterSyncChannel = null;
                channel.close();
                PresenterControls.goNext = null;
                PresenterControls.goPrev = null;
                PresenterControls.goTo = null;
                PresenterControls.toggleBlack = null;
                PresenterControls.timerToggle = null;
                PresenterControls.timerReset = null;
                PresenterControls.switchTab = null;
                window.location.href = 'editor.html';
            });

            // Keyboard
            document.addEventListener('keydown', e => {
                if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
                    e.preventDefault(); goNext();
                }
                if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') {
                    e.preventDefault(); goPrev();
                }
                if (e.key === 'Home') { e.preventDefault(); goTo(0); }
                if (e.key === 'End') { e.preventDefault(); goTo(slides.length - 1); }
                if (e.key === 'b' || e.key === 'B' || e.key === '.') toggleBlack();
                if (e.key === 'f' || e.key === 'F') {
                    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                    else document.exitFullscreen();
                }
                if (e.key === 't' || e.key === 'T') timerToggle();
                if (e.key === 'r' || e.key === 'R') timerReset();
                if ((e.key === 'p' || e.key === 'P') && _sessionRec.active) {
                    e.preventDefault();
                    if (_sessionRec.paused) _resumeSessionRecording();
                    else _pauseSessionRecording();
                }
                if (e.key === 's' || e.key === 'S') openPresenterRoomPanel();
                if (e.key === 'Escape') {
                    if (document.fullscreenElement) document.exitFullscreen();
                }
                if (e.key === '+' || e.key === '=') {
                    if (fontSizeIdx < FONT_SIZES.length - 1) { fontSizeIdx++; applyFontSize(); savePvLayout(); }
                }
                if (e.key === '-' || e.key === '_') {
                    if (fontSizeIdx > 0) { fontSizeIdx--; applyFontSize(); savePvLayout(); }
                }
                // Number keys to jump to slide
                if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey) {
                    const idx = parseInt(e.key) - 1;
                    if (idx < slides.length) goTo(idx);
                }
            });

            // Resize handler to re-scale slides
            const resizeObs = new ResizeObserver(() => renderCurrentSlide());
            resizeObs.observe(document.getElementById('pv-current-frame'));
            resizeObs.observe(document.getElementById('pv-next-frame'));

            // ── Font size control for notes ──────────────────
            const FONT_SIZES = [0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.5, 1.7, 2.0, 2.4];
            let fontSizeIdx = 3; // default 1.05rem
            const pvLayout = document.getElementById('presenter-view');

            // Restore saved prefs
            try {
                const saved = storageGetJSON(PRESENTER_LAYOUT_KEY, null);
                if (saved?.notesWidth) {
                    pvLayout.style.setProperty('--pv-notes-width', saved.notesWidth + 'px');
                }
                if (saved?.currentHeight && document.getElementById('pv-splitter-h')) {
                    pvLayout.style.setProperty('--pv-current-height', saved.currentHeight + '%');
                }
                if (saved?.fontSizeIdx !== undefined) {
                    fontSizeIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, saved.fontSizeIdx));
                }
                if (saved?.sceneId) {
                    _pvSceneId = toTrimmedString(saved.sceneId, 24) || 'balanced';
                }
                if (saved?.customScene && typeof saved.customScene === 'object') {
                    _pvCustomScene = {
                        notesWidth: toNumberOr(saved.customScene.notesWidth, 420),
                        fontSizeIdx: Math.max(0, Math.min(FONT_SIZES.length - 1, Math.trunc(toNumberOr(saved.customScene.fontSizeIdx, 3)))),
                    };
                    if (saved.customScene?.currentHeight != null) {
                        _pvCustomScene.currentHeight = toNumberOr(saved.customScene.currentHeight, 60);
                    }
                }
            } catch(e) {}

            function applyFontSize() {
                const sz = FONT_SIZES[fontSizeIdx];
                pvLayout.style.setProperty('--pv-notes-font-size', sz + 'rem');
                document.getElementById('pv-font-size-label').textContent = Math.round(sz * 100) + '%';
            }
            applyFontSize();

            function savePvLayout() {
                const notesCol = document.getElementById('pv-notes-col');
                if (!notesCol) return;
                const payload = {
                    notesWidth: Math.round(notesCol.getBoundingClientRect().width),
                    fontSizeIdx: fontSizeIdx,
                    sceneId: _pvSceneId,
                };
                if (_pvCustomScene) payload.customScene = _pvCustomScene;
                if (document.getElementById('pv-splitter-h')) {
                    const currentPanel = document.getElementById('pv-current-panel');
                    const slidesCol = document.getElementById('pv-slides-col');
                    if (currentPanel && slidesCol) {
                        const sh = slidesCol.getBoundingClientRect().height;
                        const ch = currentPanel.getBoundingClientRect().height;
                        payload.currentHeight = sh > 0 ? Math.round((ch / sh) * 100) : 60;
                    }
                }
                storageSetJSON(PRESENTER_LAYOUT_KEY, payload);
            }

            document.getElementById('pv-font-up').addEventListener('click', () => {
                if (fontSizeIdx < FONT_SIZES.length - 1) { fontSizeIdx++; applyFontSize(); savePvLayout(); }
            });
            document.getElementById('pv-font-down').addEventListener('click', () => {
                if (fontSizeIdx > 0) { fontSizeIdx--; applyFontSize(); savePvLayout(); }
            });

            // ── Resizable splitters ──────────────────────────
            const pvMain = document.getElementById('pv-main');
            const pvSlidesCol = document.getElementById('pv-slides-col');
            const pvNotesCol = document.getElementById('pv-notes-col');
            const pvCurrentPanel = document.getElementById('pv-current-panel');
            const pvSplitterV = document.getElementById('pv-splitter-v');
            function clampNotesWidth(targetPx = null) {
                if (!pvNotesCol) return;
                const totalW = pvMain?.getBoundingClientRect().width || pvLayout.getBoundingClientRect().width || 0;
                const minW = 280;
                const minSlidesW = Math.max(340, Math.round(totalW * 0.34));
                const splitterW = pvSplitterV?.getBoundingClientRect().width || 8;
                const maxRatio = totalW > 0 ? (totalW * 0.62) : 620;
                const maxBySpace = totalW > 0 ? (totalW - minSlidesW - splitterW) : 760;
                const maxW = Math.max(minW, Math.min(860, maxRatio, maxBySpace));
                const fallback = pvNotesCol.getBoundingClientRect().width || 420;
                const fromCssVar = parseFloat(String(pvLayout.style.getPropertyValue('--pv-notes-width') || ''));
                const raw = Number.isFinite(targetPx)
                    ? Number(targetPx)
                    : (Number.isFinite(fromCssVar) ? fromCssVar : fallback);
                const clamped = Math.round(clampNumber(raw, minW, maxW));
                pvLayout.style.setProperty('--pv-notes-width', `${clamped}px`);
            }
            clampNotesWidth();

            const SCENE_PRESETS = {
                balanced: { notesWidth: 420, fontSizeIdx: 3 },
                slide: { notesWidth: 340, fontSizeIdx: 2 },
                notes: { notesWidth: 560, fontSizeIdx: 5 },
            };

            const updateSceneButtons = () => {
                document.getElementById('pv-scene-balanced')?.classList.toggle('active', _pvSceneId === 'balanced');
                document.getElementById('pv-scene-slide')?.classList.toggle('active', _pvSceneId === 'slide');
                document.getElementById('pv-scene-notes')?.classList.toggle('active', _pvSceneId === 'notes');
                document.getElementById('pv-scene-custom')?.classList.toggle('active', _pvSceneId === 'custom');
                document.getElementById('pv-scene-custom')?.toggleAttribute('disabled', !_pvCustomScene);
            };

            const captureCurrentScene = () => {
                const out = {
                    notesWidth: Math.round(pvNotesCol?.getBoundingClientRect().width || 420),
                    fontSizeIdx,
                };
                if (document.getElementById('pv-splitter-h')) {
                    const slidesCol = document.getElementById('pv-slides-col');
                    const currentPanel = document.getElementById('pv-current-panel');
                    const sh = slidesCol?.getBoundingClientRect().height || 0;
                    const ch = currentPanel?.getBoundingClientRect().height || 0;
                    if (sh > 0 && ch > 0) out.currentHeight = Math.round((ch / sh) * 100);
                }
                return out;
            };

            const applyScene = (scene, sceneId = '', persist = true) => {
                if (!scene || typeof scene !== 'object') return;
                if (Number.isFinite(Number(scene.notesWidth))) {
                    clampNotesWidth(toNumberOr(scene.notesWidth, 420));
                }
                if (scene.currentHeight != null && document.getElementById('pv-splitter-h')) {
                    const pct = clampNumber(toNumberOr(scene.currentHeight, 60), 28, 82);
                    pvLayout.style.setProperty('--pv-current-height', `${Math.round(pct)}%`);
                }
                if (scene.fontSizeIdx != null) {
                    fontSizeIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, Math.trunc(toNumberOr(scene.fontSizeIdx, fontSizeIdx))));
                    applyFontSize();
                }
                if (sceneId) _pvSceneId = sceneId;
                updateSceneButtons();
                renderCurrentSlide();
                if (persist) savePvLayout();
            };

            const applyScenePreset = sceneId => {
                const preset = SCENE_PRESETS[sceneId];
                if (!preset) return;
                applyScene(preset, sceneId, true);
            };

            document.getElementById('pv-scene-balanced')?.addEventListener('click', () => applyScenePreset('balanced'));
            document.getElementById('pv-scene-slide')?.addEventListener('click', () => applyScenePreset('slide'));
            document.getElementById('pv-scene-notes')?.addEventListener('click', () => applyScenePreset('notes'));
            document.getElementById('pv-scene-save')?.addEventListener('click', () => {
                _pvCustomScene = captureCurrentScene();
                _pvSceneId = 'custom';
                updateSceneButtons();
                savePvLayout();
            });
            document.getElementById('pv-scene-custom')?.addEventListener('click', () => {
                if (!_pvCustomScene) return;
                applyScene(_pvCustomScene, 'custom', true);
            });

            if (_pvSceneId === 'custom' && _pvCustomScene) {
                applyScene(_pvCustomScene, 'custom', false);
            } else if (SCENE_PRESETS[_pvSceneId]) {
                applyScene(SCENE_PRESETS[_pvSceneId], _pvSceneId, false);
            } else {
                _pvSceneId = 'balanced';
                updateSceneButtons();
            }

            // Vertical splitter (notes column width)
            if (pvSplitterV && pvNotesCol) {
                pvSplitterV.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    const pointerId = e.pointerId;
                    pvSplitterV.classList.add('dragging');
                    pvLayout.classList.add('resizing');
                    const startX = e.clientX;
                    const startNotesW = pvNotesCol.getBoundingClientRect().width;
                    const onMove = ev => {
                        if (ev.pointerId !== pointerId) return;
                        const dx = startX - ev.clientX;
                        const newW = startNotesW + dx;
                        clampNotesWidth(newW);
                        renderCurrentSlide();
                    };
                    const onUp = ev => {
                        if (ev.pointerId !== pointerId) return;
                        pvSplitterV.classList.remove('dragging');
                        pvLayout.classList.remove('resizing');
                        pvSplitterV.removeEventListener('pointermove', onMove);
                        pvSplitterV.removeEventListener('pointerup', onUp);
                        pvSplitterV.removeEventListener('pointercancel', onUp);
                        try { pvSplitterV.releasePointerCapture(pointerId); } catch (_) {}
                        savePvLayout();
                        renderCurrentSlide();
                    };
                    try { pvSplitterV.setPointerCapture(pointerId); } catch (_) {}
                    pvSplitterV.addEventListener('pointermove', onMove);
                    pvSplitterV.addEventListener('pointerup', onUp);
                    pvSplitterV.addEventListener('pointercancel', onUp);
                });
            }
            let _pvResizeRaf = 0;
            window.addEventListener('resize', () => {
                if (_pvResizeRaf) cancelAnimationFrame(_pvResizeRaf);
                _pvResizeRaf = requestAnimationFrame(() => {
                    clampNotesWidth();
                    renderCurrentSlide();
                });
            });

            // Horizontal splitter (current slide / next slide split)
            const splitterH = document.getElementById('pv-splitter-h');
            if (splitterH && pvSlidesCol && pvCurrentPanel) {
                splitterH.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    const pointerId = e.pointerId;
                    splitterH.classList.add('dragging');
                    pvLayout.classList.add('resizing-h');
                    const startY = e.clientY;
                    const colRect = pvSlidesCol.getBoundingClientRect();
                    const startCurH = pvCurrentPanel.getBoundingClientRect().height;
                    const availH = colRect.height - 5; // 5 for splitter
                    const onMove = ev => {
                        if (ev.pointerId !== pointerId) return;
                        const dy = ev.clientY - startY;
                        const newH = clampNumber(startCurH + dy, 120, availH - 80);
                        const pct = Math.round((newH / colRect.height) * 100);
                        pvLayout.style.setProperty('--pv-current-height', pct + '%');
                        renderCurrentSlide();
                    };
                    const onUp = ev => {
                        if (ev.pointerId !== pointerId) return;
                        splitterH.classList.remove('dragging');
                        pvLayout.classList.remove('resizing-h');
                        splitterH.removeEventListener('pointermove', onMove);
                        splitterH.removeEventListener('pointerup', onUp);
                        splitterH.removeEventListener('pointercancel', onUp);
                        try { splitterH.releasePointerCapture(pointerId); } catch (_) {}
                        savePvLayout();
                        renderCurrentSlide();
                    };
                    try { splitterH.setPointerCapture(pointerId); } catch (_) {}
                    splitterH.addEventListener('pointermove', onMove);
                    splitterH.addEventListener('pointerup', onUp);
                    splitterH.addEventListener('pointercancel', onUp);
                });
            }

            // Clean up on close
            window.addEventListener('beforeunload', () => {
                if (_sessionRec.active) _stopSessionRecording();
                _stopReplay();
                if (_presenterSyncChannel === channel) _presenterSyncChannel = null;
                if (window.OEIPresenterSyncBridge?.post) window.OEIPresenterSyncBridge = null;
                channel.close();
                PresenterControls.goNext = null;
                PresenterControls.goPrev = null;
                PresenterControls.goTo = null;
                PresenterControls.toggleBlack = null;
                PresenterControls.timerToggle = null;
                PresenterControls.timerReset = null;
                PresenterControls.switchTab = null;
            });

            // Initial render
            renderCurrentSlide();
            // Send initial state to audience after a short delay (let it load)
            setTimeout(broadcastState, 1500);
            // Auto-start timer
            timerToggle();
        }

        /* ── Bootstrap ────────────────────────────────────── */
        async function boot() {
            try {
                const data = await loadData();
                if (isPresenterMode) {
                    initPresenterMode(data);
                } else if (isAudienceMode) {
                    await initAudienceMode(data);
                } else {
                    await initRevealMode(data);
                }
            } catch(e) {
                document.getElementById('slides-root').innerHTML =
                    `<section><h2 class="load-error-title">Erreur de chargement</h2><p class="load-error-msg">${e.message}</p></section>`;
                if (!isPresenterMode && !isAudienceMode) {
                    const deck = new Reveal({ hash: false });
                    deck.initialize();
                }
            }
        }

        boot();

        // Show keyboard hint briefly on load (normal mode only)
        if (!isPresenterMode && !isAudienceMode) {
            const hintEl = document.getElementById('sl-keyboard-hint');
            setTimeout(() => hintEl.classList.add('show'), 500);
            setTimeout(() => hintEl.classList.remove('show'), 4000);
        }

        // ── Normal mode toolbar buttons ──────────────────
        if (!isPresenterMode && !isAudienceMode) {
            document.getElementById('btn-fullscreen').addEventListener('click', () => {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen();
            });
            document.getElementById('btn-overview').addEventListener('click', () => {
                if (ViewerRuntime.revealDeck) ViewerRuntime.revealDeck.toggleOverview();
            });
            document.getElementById('btn-notes').addEventListener('click', () => {
                // Switch to presenter mode
                const url = new URL(location.href);
                url.searchParams.set('mode', 'presenter');
                window.open(url.toString(), '_blank');
            });
            document.getElementById('btn-editor').addEventListener('click', () => {
                window.location.href = 'editor.html';
            });

            // Timer (normal mode)
            let timerSeconds = 0, timerRunning = false, timerInterval = null;
            const timerEl = document.getElementById('sl-timer');

            function timerFmt(s) {
                const m = String(Math.floor(s / 60)).padStart(2, '0');
                const sec = String(s % 60).padStart(2, '0');
                return `⏱ ${m}:${sec}`;
            }
            function timerToggle() {
                if (timerRunning) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    timerEl.classList.remove('running');
                    timerEl.classList.add('paused');
                } else {
                    timerRunning = true;
                    timerEl.classList.remove('paused');
                    timerEl.classList.add('running');
                    timerInterval = setInterval(() => {
                        timerSeconds++;
                        timerEl.textContent = timerFmt(timerSeconds);
                    }, 1000);
                }
            }
            function timerReset() {
                clearInterval(timerInterval);
                timerRunning = false;
                timerSeconds = 0;
                timerEl.textContent = timerFmt(0);
                timerEl.classList.remove('running');
                timerEl.classList.add('paused');
            }
            timerEl.addEventListener('click', timerToggle);

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    const tb = document.getElementById('sl-toolbar');
                    tb.classList.toggle('force-show');
                    e.preventDefault();
                    return;
                }
                if (e.key === 'f' || e.key === 'F') {
                    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                    else document.exitFullscreen();
                }
                if (e.key === 'p' || e.key === 'P') {
                    document.getElementById('btn-notes').click();
                }
                if (e.key === 't' || e.key === 'T') timerToggle();
                if (e.key === 'r' || e.key === 'R') timerReset();
                if (e.key === 'w' || e.key === 'W') wbToggle();
                if (e.key === 's' || e.key === 'S') document.getElementById('btn-notes').click();
            });
        }
