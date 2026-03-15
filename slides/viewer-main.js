// @ts-check
        import Reveal from '../vendor/revealjs/5.1.0/dist/reveal.esm.js';
        import Highlight from '../vendor/revealjs/5.1.0/plugin/highlight/highlight.esm.js';
        import { createWhiteboardController } from './viewer/whiteboard.js';
        import { initAudienceMode as initAudienceModeModule } from './viewer/audience-mode.js?v=5';
        import { clearNode, el, appendAll } from './viewer/dom-utils.js';
        import { resolveRealtimeContract } from './viewer/runtime-contracts.js';
        import { createViewerAppState } from './viewer/app-state.js';
        import { createTopicEventBus } from './viewer/event-bus.js';
        import { safePeerSend, broadcastPeers } from './viewer/room-transport.js';
        import { postSyncMessage } from './viewer/audience-sync.js';
        import { clampNumber } from './viewer/presenter-layout.js';
        import { applyStatusState } from './viewer/room-ui.js';
import {
    buildRemoteRoomUrl,
    buildStudentRoomUrl,
    computeRoomNetworkDiagnostics,
} from './viewer/room-links.js';
import {
    buildRoomSnapshot,
} from './viewer/room-bridge-snapshot.js';
import {
    buildAudienceNudgePayload,
    buildExitTicketEndPayload,
    buildExitTicketSnapshot,
    buildExitTicketStartPayload,
    buildExitTicketUpdatePayload,
    buildRankOrderEndPayload,
    buildRankOrderSnapshot,
    buildRankOrderStartPayload,
    buildRankOrderUpdatePayload,
    createExitTicketState,
    createRankOrderState,
} from './viewer/room-activity-workflow.js';
import {
    normalizeExitTicketAnswers as _normalizeExitTicketAnswers,
    normalizeRankOrderSubmission as _normalizeRankOrderSubmission,
} from './viewer/room-activity-model.js';
import {
    applyWordCloudWord,
    buildPollEndPayload,
    buildPollPromptDisplayText,
    buildPollStartPayload,
    buildWordCloudEndPayload,
    buildWordCloudStartPayload,
    buildWordCloudTopWords,
    createPollState,
    createWordCloudState,
    normalizeWordCloudWord,
} from './viewer/room-engagement-workflow.js';
import {
    computePollStats as _computePollStats,
    normalizePollAnswer as _normalizePollAnswer,
} from './viewer/room-poll-model.js';
import {
    computeRoomFeedbackStats,
    computeRoomQuestionStats,
    computeRoomTelemetryStats,
            filterRoomQuestions,
            formatRoomStudentTelemetryLabel,
            getRoomFeedbackMeta,
            isRoomStudentTelemetryFresh,
            pruneRoomFeedbackState,
        } from './viewer/room-insights.js';
        import {
            buildPresenterMiniViews,
            renderPresenterContextDynamicHtml,
            renderPresenterRoomMiniHtml,
            renderPresenterRoomStatusBarHtml,
        } from './viewer/room-panel-presenter.js';
import {
    archiveQuestion,
    buildQuestionRowClass,
    formatQuestionAgeLabel,
    getQuestionEmptyLabel,
    markAllQuestionsHidden,
    toggleQuestionHidden,
    toggleQuestionPinned,
    toggleQuestionResolved,
} from './viewer/room-panel-questions.js';
import {
    clearAllRaisedHands,
    clearRaisedHandForPeer,
} from './viewer/room-panel-hands.js';
import {
    formatWordCloudCountLabel,
    renderFeedbackListHtml,
    renderFeedbackSummaryHtml,
    renderPollResultsHtml,
    summarizeWordCloud,
} from './viewer/room-panel-tools.js';
import { updateRoomPanelRuntime } from './viewer/room-panel-runtime.js';
import {
    createRoomRemoteControl,
    runRemotePresenterCommand,
} from './viewer/room-remote-control.js';
import { createRoomRelayRuntime } from './viewer/room-relay-runtime.js';
import {
    applyStudentFeedbackMessage,
    applyStudentHandMessage,
    applyStudentQuestionMessage,
    applyStudentTelemetryMessage,
    createStudentJoinRecord,
    sendActiveRoomActivities,
    syncPeerRuntimeState,
} from './viewer/room-realtime-sync.js';
import { createCommandBus } from './viewer/command-bus.js';
import { REMOTE_HASH_ITERATIONS, sha256Hex, derivePasswordHashHex } from './viewer/remote-auth.js';
import { createRoomPeerReconnectRuntime } from './viewer/room-peer-reconnect-runtime.js';
import { createRoomPeerLifecycleRuntime } from './viewer/room-peer-lifecycle-runtime.js';
import { buildReplayStandaloneHtml } from './viewer/replay-standalone-export.js';
import {
    normalizeReplaySessionExport,
} from '../shared/slides/replay-contract.mjs';

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
        const _roomBridgeBus = createTopicEventBus(['poll', 'cloud', 'exitTicket', 'rankOrder', 'roulette', 'room']);
        const _viewerCommandBus = createCommandBus({
            maxTrace: 240,
            onError: (name, error) => {
                console.warn('[viewer:command]', name, error?.message || error);
            },
        });
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
            const words = buildWordCloudTopWords(_activeWordCloud.words, 48);
            return {
                active: true,
                cloudId: _activeWordCloud.cloudId,
                prompt: _activeWordCloud.prompt || '',
                words,
            };
        };
        const _roomBridgeSnapshotExitTicket = () => {
            return buildExitTicketSnapshot(_activeExitTicket, { toTrimmedString });
        };
        const _roomBridgeSnapshotRankOrder = () => {
            return buildRankOrderSnapshot(_activeRankOrder);
        };
        const _roomBridgeSnapshotRoom = () => {
            const questions = roomQuestionStats();
            const feedback10m = roomFeedbackStats(10 * 60 * 1000);
            const pollSnap = _roomBridgeSnapshotPoll();
            const telemetry = roomTelemetryStats();
            return buildRoomSnapshot({
                roomActive: !!_room.active,
                relayActive: !!_relayRoom.active,
                studentsByPeer: _room.students,
                handsCount: _roomHands.length,
                questionsOpen: questions.open,
                questionsTotal: questions.total,
                feedback10m,
                pollActive: !!pollSnap.active,
                wordCloudActive: !!_activeWordCloud,
                exitTicketActive: !!_activeExitTicket,
                rankOrderActive: !!_activeRankOrder,
                telemetry,
                toTrimmedString,
                toNumberOr,
            });
        };
        const _roomBridgeEmit = (kind, payload) => {
            _roomBridgeBus.emit(kind, payload);
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

        const _roomUiStatus = {
            text: '',
            tone: '',
        };

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

        const _setRoomIdInputsDisabled = active => {
            const idInput = document.getElementById('rm-room-id-input');
            const idRefresh = document.getElementById('rm-room-id-refresh');
            if (idInput) idInput.disabled = !!active;
            if (idRefresh) idRefresh.disabled = !!active;
        };

        const _roomPeerReconnectRuntime = createRoomPeerReconnectRuntime({
            room: _room,
            reconnectDelayMs: _reconnectDelayMs,
            roomSetStatus: _roomSetStatus,
            setRoomIdInputsDisabled: _setRoomIdInputsDisabled,
            runRoomPreviewUpdater: () => {
                ViewerRuntime.runRoomPreviewUpdater();
            },
        });

        const _remoteControlApi = createRoomRemoteControl({
            ROOM_MSG,
            safePeerSend,
            toTrimmedString,
            toIntOrNull,
            applyStatusState,
            buildRemoteUrl: roomId => buildRemoteRoomUrl(location.href, roomId),
            buildQrImageSrc: _buildQrImageSrc,
            storageGetJSON,
            storageSetJSON,
            storageRemove,
            remoteControlConfigKey,
            legacyConfigKey: REMOTE_CONTROL_CONFIG_KEY,
            derivePasswordHashHex,
            sha256Hex,
            hashIterations: REMOTE_HASH_ITERATIONS,
            passwordMinLen: REMOTE_PASSWORD_MIN_LEN,
            challengeTtlMs: REMOTE_CHALLENGE_TTL_MS,
            sessionTtlMs: REMOTE_SESSION_TTL_MS,
            lockMs: REMOTE_LOCK_MS,
            getRoomConnections: () => _room.connections,
            isRoomActive: () => !!_room.active,
            runCommand: (command, payload) => runRemotePresenterCommand(command, payload, {
                toTrimmedString,
                toIntOrNull,
                presenterControls: PresenterControls,
                deck: ViewerRuntime.revealDeck,
            }),
        });
        const _remoteControl = _remoteControlApi.state;
        const _remoteSetStatus = _remoteControlApi.setStatus;
        const _remoteSetRoomId = _remoteControlApi.setRoomId;
        const _remoteBuildUrl = _remoteControlApi.buildUrl;
        const _remoteUpdateUI = _remoteControlApi.updateUI;
        const _remoteLoadConfig = _remoteControlApi.loadConfig;
        const _remoteDropPeer = _remoteControlApi.dropPeer;
        const _remoteActiveSessionsCount = _remoteControlApi.activeSessionsCount;
        const _remoteRevokeAll = _remoteControlApi.revokeAll;
        const _remoteEnableFromPassword = () => _remoteControlApi.enableFromPassword();
        const _remoteHandleIncoming = (conn, msg) => _remoteControlApi.handleIncoming(conn, msg);

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

        const _relayRuntime = createRoomRelayRuntime({
            relayRoom: _relayRoom,
            room: _room,
            roomHands: _roomHands,
            roomFeedback: _roomFeedback,
            roomSeenByPeer: _roomSeenByPeer,
            relayOptions: RELAY_OPTIONS,
            toTrimmedString,
            reconnectDelayMs: _reconnectDelayMs,
            roomSetStatus: _roomSetStatus,
            roomEsc: _roomEsc,
            roomHandleIncoming: (conn, msg) => { roomHandleIncoming(conn, msg); },
            roomUpdatePanel: () => { roomUpdatePanel(); },
        });
        const _relaySendBroadcast = msg => _relayRuntime.sendBroadcast(msg);
        const _relayOpen = roomId => _relayRuntime.open(roomId);
        const _relayClose = () => _relayRuntime.close();
        const _roomPeerLifecycleRuntime = createRoomPeerLifecycleRuntime({
            room: _room,
            relayRoom: _relayRoom,
            roomHands: _roomHands,
            roomFeedback: _roomFeedback,
            roomSeenByPeer: _roomSeenByPeer,
            peerReconnectRuntime: _roomPeerReconnectRuntime,
            roomSetStatus: _roomSetStatus,
            roomEsc: _roomEsc,
            withIcon,
            buildStudentUrl: _buildStudentUrl,
            generateRoomId: _generateRoomId,
            remoteLoadConfig: _remoteLoadConfig,
            remoteDropPeer: _remoteDropPeer,
            relayOpen: _relayOpen,
            relayClose: _relayClose,
            roomSendInit: _roomSendInit,
            roomHandleIncoming: (conn, msg) => { roomHandleIncoming(conn, msg); },
            roomUpdatePanel: () => { roomUpdatePanel(); },
            roomUpdateStudents: () => { roomUpdateStudents(); },
            runRoomPreviewUpdater: () => { ViewerRuntime.runRoomPreviewUpdater(); },
            roomBroadcast: msg => { roomBroadcast(msg); },
            setRoomIdInputsDisabled: _setRoomIdInputsDisabled,
            storageSetRaw,
            lastRoomIdKey: LAST_ROOM_ID_KEY,
            viewerRuntime: ViewerRuntime,
            relayOptions: RELAY_OPTIONS,
            peerOptions: PEER_OPTIONS,
            switchRoomPresenterMode,
            isPresenterMode,
            documentRef: document,
            navigatorRef: navigator,
            windowRef: window,
        });

        function roomBroadcast(msg) {
            broadcastPeers(_room.connections, msg);
            if (_relayRoom.active) _relaySendBroadcast(msg);
        }

        function roomQuestionStats() {
            return computeRoomQuestionStats(_roomQuestions);
        }

        function roomStudentTelemetryFresh(student, maxAgeMs = 45 * 1000) {
            return isRoomStudentTelemetryFresh(student, { maxAgeMs });
        }

        function roomStudentTelemetryLabel(student) {
            return formatRoomStudentTelemetryLabel(student, { trimFn: toTrimmedString });
        }

        function roomTelemetryStats(maxAgeMs = 45 * 1000) {
            return computeRoomTelemetryStats(Object.values(_room.students || {}), { maxAgeMs });
        }

        function roomFilteredQuestions() {
            return filterRoomQuestions(_roomQuestions, _roomQuestionFilter);
        }

        function roomFeedbackMeta(kind) {
            return getRoomFeedbackMeta(kind);
        }

        function roomFeedbackPrune(maxAgeMs = 20 * 60 * 1000) {
            pruneRoomFeedbackState(_roomFeedback, { maxAgeMs, maxEvents: 240 });
        }

        function roomFeedbackStats(windowMs = 10 * 60 * 1000) {
            roomFeedbackPrune();
            return computeRoomFeedbackStats(_roomFeedback.events, { windowMs });
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
            const diagnostics = computeRoomNetworkDiagnostics({
                roomActive: _room.active,
                relayActive: _relayRoom.active,
                relayConfigured,
            });

            if (statusEl) statusEl.textContent = diagnostics.statusText;
            if (hintEl) hintEl.textContent = diagnostics.hintText;
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
            const panelState = updateRoomPanelRuntime({
                _room,
                _relayRoom,
                _roomHands,
                _roomQuestions,
                _roomQuestionFilter,
                _roomFeedback,
                _activePoll,
                _activeWordCloud,
                _pvContextView,
                ROOM_MSG,
                UI_ICONS,
                clearNode,
                el,
                appendAll,
                clearRaisedHandForPeer,
                toggleQuestionHidden,
                archiveQuestion,
                toggleQuestionPinned,
                toggleQuestionResolved,
                buildQuestionRowClass,
                formatQuestionAgeLabel,
                getQuestionEmptyLabel,
                renderPollResultsHtml,
                summarizeWordCloud,
                formatWordCloudCountLabel,
                roomFeedbackMeta,
                renderFeedbackSummaryHtml,
                renderFeedbackListHtml,
                roomQuestionStats,
                roomTelemetryStats,
                roomFeedbackStats,
                roomFilteredQuestions,
                roomStudentTelemetryLabel,
                _roomBridgeSnapshotPoll,
                _roomBridgeSnapshotRoom,
                _roomBridgeEmit,
                _remoteActiveSessionsCount,
                _remoteUpdateUI,
                roomAudienceQrUrl,
                roomUpdateQrButtonsUI,
                roomUpdateNetworkDiagnostics,
                buildPresenterMiniViews,
                renderPresenterRoomStatusBarHtml,
                renderPresenterRoomMiniHtml,
                renderPresenterContextDynamicHtml,
                iconOnly,
                withIcon,
                _roomEsc,
                toTrimmedString,
                switchRoomPresenterMode,
                onRoomUpdatePanel: roomUpdatePanel,
            });
            if (panelState && typeof panelState._pvContextView === 'string') {
                _pvContextView = panelState._pvContextView;
            }
        }

        // Alias pour compatibilité (appelé dans roomClose)
        function roomUpdateStudents() { roomUpdatePanel(); }

        // ── Word cloud render ──────────────────────────────────
        function roomRenderWordCloud() {
            if (!_activeWordCloud) return;
            const sorted = buildWordCloudTopWords(_activeWordCloud.words, 40);
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
            const nextPoll = createPollState(typeOrConfig, prompt, { now: () => Date.now(), toTrimmedString });
            _activePoll = nextPoll;
            const startPayload = buildPollStartPayload(nextPoll);
            roomBroadcast({
                type: ROOM_MSG.POLL_START,
                ...startPayload,
            });
            _postPresenterSync({
                type: SYNC_MSG.POLL_START,
                ...startPayload,
            });
            const pd = document.getElementById('rm-poll-prompt-display');
            if (pd) pd.textContent = buildPollPromptDisplayText(nextPoll);
            const launch = document.getElementById('rm-poll-launch');
            const live = document.getElementById('rm-poll-live');
            if (launch) launch.style.display = 'none';
            if (live) live.style.display = '';
            _roomBridgeEmit('poll', _roomBridgeSnapshotPoll());
            roomUpdatePanel();
            return nextPoll.pollId;
        }

        function roomEndPoll() {
            if (_activePoll) {
                const endPayload = buildPollEndPayload(_activePoll);
                roomBroadcast({ type: ROOM_MSG.POLL_END, ...endPayload });
                _postPresenterSync({ type: SYNC_MSG.POLL_END, ...endPayload });
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
            const nextCloud = createWordCloudState(prompt, { now: () => Date.now(), toTrimmedString });
            _activeWordCloud = nextCloud;
            const startPayload = buildWordCloudStartPayload(nextCloud);
            roomBroadcast({ type: ROOM_MSG.WORDCLOUD_START, ...startPayload });
            _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_START, ...startPayload });
            _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_UPDATE, ...startPayload, words: [] });
            const launch = document.getElementById('rm-cloud-launch');
            const live = document.getElementById('rm-cloud-live');
            if (launch) launch.style.display = 'none';
            if (live) live.style.display = '';
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) {
                wcOverlay.style.display = 'flex';
                const pr = document.getElementById('sl-wc-prompt-presenter');
                if (pr) pr.textContent = nextCloud.prompt || '';
            }
            _roomBridgeEmit('cloud', _roomBridgeSnapshotCloud());
            roomUpdatePanel();
            return true;
        }

        function roomEndWordCloud() {
            if (_activeWordCloud) {
                const endPayload = buildWordCloudEndPayload(_activeWordCloud);
                roomBroadcast({ type: ROOM_MSG.WORDCLOUD_END, ...endPayload });
                _postPresenterSync({ type: SYNC_MSG.WORDCLOUD_END, ...endPayload });
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
            const nextTicket = createExitTicketState({
                configOrTitle,
                prompts,
                now: () => Date.now(),
                toTrimmedString,
            });
            if (!nextTicket) return false;
            _activeExitTicket = nextTicket;
            const startPayload = buildExitTicketStartPayload(nextTicket);
            roomBroadcast({
                type: ROOM_MSG.EXIT_TICKET_START,
                ...startPayload,
            });
            _postPresenterSync({
                type: SYNC_MSG.EXIT_TICKET_START,
                ...startPayload,
            });
            const startSnapshot = _roomBridgeSnapshotExitTicket();
            _postPresenterSync({
                type: SYNC_MSG.EXIT_TICKET_UPDATE,
                ...buildExitTicketUpdatePayload(nextTicket, startSnapshot),
            });
            _roomBridgeEmit('exitTicket', startSnapshot);
            roomUpdatePanel();
            return nextTicket.ticketId;
        }

        function roomEndExitTicket() {
            if (_activeExitTicket) {
                const endPayload = buildExitTicketEndPayload(_activeExitTicket);
                roomBroadcast({
                    type: ROOM_MSG.EXIT_TICKET_END,
                    ...endPayload,
                });
                _postPresenterSync({
                    type: SYNC_MSG.EXIT_TICKET_END,
                    ...endPayload,
                });
            }
            _activeExitTicket = null;
            _roomBridgeEmit('exitTicket', _roomBridgeSnapshotExitTicket());
            roomUpdatePanel();
        }

        function roomStartRankOrder(configOrTitle = '', items = []) {
            if (!_room.active) return false;
            if (_activeRankOrder) return false;
            const nextRank = createRankOrderState({
                configOrTitle,
                items,
                now: () => Date.now(),
                toTrimmedString,
            });
            if (!nextRank) return false;
            _activeRankOrder = nextRank;
            const startPayload = buildRankOrderStartPayload(nextRank);
            roomBroadcast({
                type: ROOM_MSG.RANK_ORDER_START,
                ...startPayload,
            });
            _postPresenterSync({
                type: SYNC_MSG.RANK_ORDER_START,
                ...startPayload,
            });
            const startSnapshot = _roomBridgeSnapshotRankOrder();
            _postPresenterSync({
                type: SYNC_MSG.RANK_ORDER_UPDATE,
                ...buildRankOrderUpdatePayload(nextRank, startSnapshot),
            });
            _roomBridgeEmit('rankOrder', startSnapshot);
            roomUpdatePanel();
            return nextRank.rankId;
        }

        function roomEndRankOrder() {
            if (_activeRankOrder) {
                const endPayload = buildRankOrderEndPayload(_activeRankOrder);
                roomBroadcast({
                    type: ROOM_MSG.RANK_ORDER_END,
                    ...endPayload,
                });
                _postPresenterSync({
                    type: SYNC_MSG.RANK_ORDER_END,
                    ...endPayload,
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
            const payload = buildAudienceNudgePayload(kind, text, { now: () => Date.now(), toTrimmedString });
            roomBroadcast({
                type: ROOM_MSG.AUDIENCE_NUDGE,
                ...payload,
            });
            if (feedback) {
                feedback.textContent = `Relance envoyée: ${payload.text || text}`;
                setTimeout(() => {
                    if (feedback.textContent.startsWith('Relance envoyée')) feedback.textContent = '';
                }, 1800);
            }
            return true;
        }

        const _registerRoomCommands = () => {
            _viewerCommandBus.register('room.poll.start', payload => {
                const typeOrConfig = payload && typeof payload === 'object' && payload.typeOrConfig != null
                    ? payload.typeOrConfig
                    : (payload?.type || 'thumbs');
                const prompt = payload && typeof payload === 'object' && payload.prompt != null
                    ? payload.prompt
                    : '';
                return roomStartPoll(typeOrConfig, prompt);
            });
            _viewerCommandBus.register('room.poll.end', () => roomEndPoll());
            _viewerCommandBus.register('room.cloud.start', payload => roomStartWordCloud(payload?.prompt || ''));
            _viewerCommandBus.register('room.cloud.end', () => roomEndWordCloud());
            _viewerCommandBus.register('room.exit.start', payload => roomStartExitTicket(payload?.configOrTitle || '', payload?.prompts || []));
            _viewerCommandBus.register('room.exit.end', () => roomEndExitTicket());
            _viewerCommandBus.register('room.rank.start', payload => roomStartRankOrder(payload?.configOrTitle || '', payload?.items || []));
            _viewerCommandBus.register('room.rank.end', () => roomEndRankOrder());
            _viewerCommandBus.register('room.nudge.send', payload => roomSendAudienceNudge(payload?.kind || '', payload?.text || ''));
        };
        _registerRoomCommands();
        window.OEIViewerCommandBus = _viewerCommandBus;

        function roomExposeBridge() {
            window.OEIRoomBridge = {
                isActive: () => !!_room.active,
                startPoll: (typeOrConfig, prompt) => _viewerCommandBus.dispatch('room.poll.start', { typeOrConfig, prompt }, 'room-bridge'),
                startMcqSingle: (question, options) => _viewerCommandBus.dispatch('room.poll.start', {
                    typeOrConfig: { type: 'mcq-single', prompt: question, options },
                    prompt: '',
                }, 'room-bridge'),
                startMcqMulti: (question, options) => _viewerCommandBus.dispatch('room.poll.start', {
                    typeOrConfig: { type: 'mcq-multi', prompt: question, options },
                    prompt: '',
                }, 'room-bridge'),
                endPoll: () => _viewerCommandBus.dispatch('room.poll.end', null, 'room-bridge'),
                getPollSnapshot: () => _roomBridgeSnapshotPoll(),
                subscribePoll: fn => {
                    if (typeof fn !== 'function') return () => {};
                    const unsubscribe = _roomBridgeBus.subscribe('poll', fn);
                    try { fn(_roomBridgeSnapshotPoll()); } catch (_) {}
                    return unsubscribe;
                },
                startWordCloud: prompt => _viewerCommandBus.dispatch('room.cloud.start', { prompt }, 'room-bridge'),
                endWordCloud: () => _viewerCommandBus.dispatch('room.cloud.end', null, 'room-bridge'),
                getWordCloudSnapshot: () => _roomBridgeSnapshotCloud(),
                subscribeWordCloud: fn => {
                    if (typeof fn !== 'function') return () => {};
                    const unsubscribe = _roomBridgeBus.subscribe('cloud', fn);
                    try { fn(_roomBridgeSnapshotCloud()); } catch (_) {}
                    return unsubscribe;
                },
                startExitTicket: (configOrTitle, prompts) => _viewerCommandBus.dispatch('room.exit.start', { configOrTitle, prompts }, 'room-bridge'),
                endExitTicket: () => _viewerCommandBus.dispatch('room.exit.end', null, 'room-bridge'),
                getExitTicketSnapshot: () => _roomBridgeSnapshotExitTicket(),
                subscribeExitTicket: fn => {
                    if (typeof fn !== 'function') return () => {};
                    const unsubscribe = _roomBridgeBus.subscribe('exitTicket', fn);
                    try { fn(_roomBridgeSnapshotExitTicket()); } catch (_) {}
                    return unsubscribe;
                },
                startRankOrder: (configOrTitle, items) => _viewerCommandBus.dispatch('room.rank.start', { configOrTitle, items }, 'room-bridge'),
                endRankOrder: () => _viewerCommandBus.dispatch('room.rank.end', null, 'room-bridge'),
                getRankOrderSnapshot: () => _roomBridgeSnapshotRankOrder(),
                subscribeRankOrder: fn => {
                    if (typeof fn !== 'function') return () => {};
                    const unsubscribe = _roomBridgeBus.subscribe('rankOrder', fn);
                    try { fn(_roomBridgeSnapshotRankOrder()); } catch (_) {}
                    return unsubscribe;
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
                    return _roomBridgeBus.subscribe('roulette', fn);
                },
                getRoomSnapshot: () => _roomBridgeSnapshotRoom(),
                subscribeRoom: fn => {
                    if (typeof fn !== 'function') return () => {};
                    const unsubscribe = _roomBridgeBus.subscribe('room', fn);
                    try { fn(_roomBridgeSnapshotRoom()); } catch (_) {}
                    return unsubscribe;
                },
            };
        }

        function _generateRoomId() {
            const words = ['algo','reseau','bdd','sys','web','secu','L1','L2','L3','info','cours'];
            const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
            return words[Math.floor(Math.random() * words.length)] + '-' + rnd;
        }

        function _buildStudentUrl(roomId, transportMode = 'auto') {
            return buildStudentRoomUrl({
                currentHref: location.href,
                roomId,
                transportMode,
                audienceMode: AUDIENCE_POLICY.mode || 'display',
                networkSession: NetworkSession,
                params,
                peerOptions: PEER_OPTIONS,
                relayOptions: RELAY_OPTIONS,
            });
        }

        function _roomClearPeerReconnectTimer() {
            _roomPeerLifecycleRuntime.clearPeerReconnectTimer();
        }

        function _roomSchedulePeerReconnect(reason = '') {
            _roomPeerLifecycleRuntime.schedulePeerReconnect(reason);
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
                case ROOM_MSG.REMOTE_HELLO:
                case ROOM_MSG.REMOTE_AUTH_PROOF:
                case ROOM_MSG.REMOTE_COMMAND: {
                    await _remoteHandleIncoming(conn, msg);
                    break;
                }
                case ROOM_MSG.STUDENT_JOIN: {
                    _room.students[peerId] = createStudentJoinRecord({
                        msg,
                        peerId,
                        transport: conn.__transport || 'p2p',
                        roomCurrentSlideIndex: _roomCurrentSlideIndex,
                        roomCurrentFragmentIndex: _roomCurrentFragmentIndex,
                        toTrimmedString,
                        now: () => Date.now(),
                    });
                    safePeerSend(conn, { type: ROOM_MSG.WELCOME, title: _presentationData?.metadata?.title || 'Présentation', peerId });
                    if (conn.__transport === 'relay') _roomSendInit(conn);
                    sendActiveRoomActivities({
                        conn,
                        ROOM_MSG,
                        activePoll: _activePoll,
                        activeWordCloud: _activeWordCloud,
                        activeExitTicket: _activeExitTicket,
                        activeRankOrder: _activeRankOrder,
                    });
                    roomUpdatePanel();
                    break;
                }
                case ROOM_MSG.STUDENT_TELEMETRY: {
                    const telemetryRes = applyStudentTelemetryMessage({
                        msg,
                        peerId,
                        studentsByPeer: _room.students,
                        roomHands: _roomHands,
                        toTrimmedString,
                        toNumberOr,
                        now: () => Date.now(),
                        transport: conn.__transport || 'p2p',
                    });
                    if (telemetryRes.shouldRefresh) roomUpdatePanel();
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
                    if (applyStudentHandMessage({
                        msg,
                        peerId,
                        studentsByPeer: _room.students,
                        roomHands: _roomHands,
                    })) {
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.STUDENT_QUESTION: {
                    const questionRes = applyStudentQuestionMessage({
                        msg,
                        peerId,
                        roomQuestions: _roomQuestions,
                        toTrimmedString,
                        now: () => Date.now(),
                    });
                    if (!questionRes.ok) { ack(false, questionRes.reason || 'question-invalid'); break; }
                    roomUpdatePanel();
                    break;
                }
                case ROOM_MSG.STUDENT_FEEDBACK: {
                    const feedbackRes = applyStudentFeedbackMessage({
                        msg,
                        peerId,
                        roomFeedback: _roomFeedback,
                        studentsByPeer: _room.students,
                        toTrimmedString,
                        now: () => Date.now(),
                        minIntervalMs: 5000,
                    });
                    if (!feedbackRes.ok) { ack(false, feedbackRes.reason || 'feedback-invalid'); break; }
                    if (feedbackRes.throttled) { ack(true, 'feedback-throttled'); break; }
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
                        const w = normalizeWordCloudWord(msg.word, { toTrimmedString });
                        if (w) {
                            applyWordCloudWord(_activeWordCloud.words, w);
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
                            ...buildExitTicketUpdatePayload(_activeExitTicket, snap),
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
                            ...buildRankOrderUpdatePayload(_activeRankOrder, snap),
                        });
                        roomUpdatePanel();
                    }
                    break;
                }
                case ROOM_MSG.SYNC_REQUEST: {
                    if (!syncPeerRuntimeState({
                        conn,
                        ROOM_MSG,
                        roomSendInit: _roomSendInit,
                        roomCurrentSlideIndex: _roomCurrentSlideIndex,
                        roomCurrentFragmentIndex: _roomCurrentFragmentIndex,
                        activePoll: _activePoll,
                        activeWordCloud: _activeWordCloud,
                        activeExitTicket: _activeExitTicket,
                        activeRankOrder: _activeRankOrder,
                    })) {
                        ack(false, 'sync-unavailable');
                        break;
                    }
                    break;
                }
                default:
                    if (ackEligible) ack(false, 'unsupported');
                    break;
            }

            if (ackEligible && !ackSent) ack(true);
        }

        async function roomOpenPeer() {
            await _roomPeerLifecycleRuntime.openPeer();
        }

        function roomClose() {
            const wasActive = _room.active;
            if (_pvQrVisible) {
                _pvQrVisible = false;
                _postPresenterSync({ type: SYNC_MSG.ROOM_QR, show: false, url: '' });
            }
            _roomPeerLifecycleRuntime.closeTransport({
                setStatus: false,
                updatePanel: false,
                switchPresenterMode: false,
                runPreviewUpdater: false,
            });
            if (wasActive) _remoteRevokeAll('Salle fermée : sessions mobiles révoquées.', true);
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
                    _remoteSetRoomId('');
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
                    _remoteSetRoomId(id);
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
    markAllQuestionsHidden(_roomQuestions);
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
    });
    clearAllRaisedHands(_roomHands, _room.students);
    roomUpdatePanel();
});

        // ── Sondage ──────────────────────────────────────────────
        document.getElementById('rm-poll-start')?.addEventListener('click', () => {
            const type = document.getElementById('rm-poll-type')?.value || 'thumbs';
            const prompt = document.getElementById('rm-poll-prompt')?.value.trim() || '';
            if (!_viewerCommandBus.dispatch('room.poll.start', { typeOrConfig: type, prompt }, 'ui')) {
                const feedback = document.getElementById('rm-nudge-feedback');
                if (feedback) feedback.textContent = 'Ouvrez la salle pour lancer un sondage.';
            }
        });

        document.getElementById('rm-poll-end')?.addEventListener('click', () => {
            _viewerCommandBus.dispatch('room.poll.end', null, 'ui');
        });

        // ── Nuage de mots ────────────────────────────────────────
        document.getElementById('rm-cloud-start')?.addEventListener('click', () => {
            const prompt = document.getElementById('rm-cloud-prompt')?.value.trim() || '';
            if (!_viewerCommandBus.dispatch('room.cloud.start', { prompt }, 'ui')) {
                const feedback = document.getElementById('rm-nudge-feedback');
                if (feedback) feedback.textContent = 'Ouvrez la salle pour lancer un nuage.';
            }
        });

        document.getElementById('rm-cloud-show')?.addEventListener('click', () => {
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) wcOverlay.style.display = 'flex';
        });

        document.getElementById('rm-cloud-end')?.addEventListener('click', () => {
            _viewerCommandBus.dispatch('room.cloud.end', null, 'ui');
        });

        document.getElementById('sl-wc-close-presenter')?.addEventListener('click', () => {
            const wcOverlay = document.getElementById('sl-wordcloud-presenter');
            if (wcOverlay) wcOverlay.style.display = 'none';
        });

        document.getElementById('rm-nudge-question')?.addEventListener('click', () => {
            _viewerCommandBus.dispatch('room.nudge.send', {
                kind: 'question',
                text: 'Avez-vous une question a poser ?',
            }, 'ui');
        });
        document.getElementById('rm-nudge-hand')?.addEventListener('click', () => {
            _viewerCommandBus.dispatch('room.nudge.send', {
                kind: 'hand',
                text: 'Levez la main si vous voulez revenir sur ce point.',
            }, 'ui');
        });
        document.getElementById('rm-nudge-poll')?.addEventListener('click', () => {
            if (_activePoll) {
                _viewerCommandBus.dispatch('room.nudge.send', {
                    kind: 'poll',
                    text: 'Un sondage est en cours, pensez a voter.',
                }, 'ui');
                return;
            }
            if (!_viewerCommandBus.dispatch('room.poll.start', {
                typeOrConfig: 'thumbs',
                prompt: 'Avez-vous compris ce point ?',
            }, 'ui')) {
                _viewerCommandBus.dispatch('room.nudge.send', { kind: 'poll', text: 'Pensez a voter.' }, 'ui');
            }
        });
        document.getElementById('rm-nudge-cloud')?.addEventListener('click', () => {
            if (_activeWordCloud) {
                _viewerCommandBus.dispatch('room.nudge.send', {
                    kind: 'cloud',
                    text: 'Nuage de mots en cours, proposez un mot.',
                }, 'ui');
                return;
            }
            if (!_viewerCommandBus.dispatch('room.cloud.start', { prompt: 'Un mot pour resumer ce slide ?' }, 'ui')) {
                _viewerCommandBus.dispatch('room.nudge.send', { kind: 'cloud', text: 'Proposez un mot.' }, 'ui');
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
                SlidesRenderer.mountRuntimeElements(root, deck);
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
            const syncViewerTheme = isLight => document.body.classList.toggle('viewer-light', !!isLight);
            const pvThemeController = window.OEIThemeRuntime?.createController
                ? window.OEIThemeRuntime.createController({
                    scope: 'presenter',
                    defaultMode: 'light',
                    apply(mode) {
                        const isLight = mode === 'light';
                        pv.classList.toggle('light', isLight);
                        syncViewerTheme(isLight);
                    },
                })
                : null;
            const pvSavedTheme = pvThemeController
                ? pvThemeController.applyCurrent()
                : (storageGetRaw(PRESENTER_THEME_KEY) || 'light');
            if (!pvThemeController) {
                if (pvSavedTheme === 'light') pv.classList.add('light');
                syncViewerTheme(pvSavedTheme === 'light');
            }
            const pvThemeBtn = document.getElementById('pv-btn-theme');
            const PV_SVG_MOON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg> Thème`;
            const PV_SVG_SUN  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> Thème`;
            if (pvThemeBtn) {
                pvThemeBtn.innerHTML = pvSavedTheme === 'light' ? PV_SVG_MOON : PV_SVG_SUN;
                pvThemeBtn.addEventListener('click', () => {
                    const nextTheme = pvThemeController
                        ? pvThemeController.toggleMode()
                        : (() => {
                            const nowLight = pv.classList.toggle('light');
                            storageSetRaw(PRESENTER_THEME_KEY, nowLight ? 'light' : 'dark');
                            syncViewerTheme(nowLight);
                            return nowLight ? 'light' : 'dark';
                        })();
                    pvThemeBtn.innerHTML = nextTheme === 'light' ? PV_SVG_MOON : PV_SVG_SUN;
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
            let audienceLockActive = false;
            let audienceLockIndex = 0;
            let exerciseModeActive = false;
            const EXERCISE_MODE_DEFAULT_TITLE = 'Mode exercice';
            const EXERCISE_MODE_DEFAULT_MESSAGE = 'Travaillez l’exercice en cours. La correction arrive juste après.';
            const audienceLockBtn = document.getElementById('pv-btn-audience-lock');
            const exerciseModeBtn = document.getElementById('pv-btn-exercise');

            const _syncAudienceLockUi = () => {
                if (!audienceLockBtn) return;
                audienceLockBtn.classList.toggle('active', audienceLockActive);
                audienceLockBtn.setAttribute('aria-pressed', audienceLockActive ? 'true' : 'false');
                audienceLockBtn.title = audienceLockActive
                    ? `Verrou anti-spoiler actif (max slide ${audienceLockIndex + 1}) · L`
                    : 'Verrou anti-spoiler audience (L)';
            };

            const _syncExerciseModeUi = () => {
                if (!exerciseModeBtn) return;
                exerciseModeBtn.classList.toggle('active', exerciseModeActive);
                exerciseModeBtn.setAttribute('aria-pressed', exerciseModeActive ? 'true' : 'false');
                exerciseModeBtn.title = exerciseModeActive
                    ? 'Mode exercice actif (X)'
                    : 'Mode exercice (X)';
            };

            const _postAudienceLockState = () => {
                channel.postMessage({
                    type: SYNC_MSG.AUDIENCE_LOCK,
                    locked: audienceLockActive,
                    index: audienceLockActive ? audienceLockIndex : null,
                });
            };

            const _postExerciseModeState = () => {
                channel.postMessage({
                    type: SYNC_MSG.EXERCISE_MODE,
                    active: exerciseModeActive,
                    title: EXERCISE_MODE_DEFAULT_TITLE,
                    message: EXERCISE_MODE_DEFAULT_MESSAGE,
                });
            };

            const setAudienceLock = (locked, anchorIndex = null) => {
                audienceLockActive = !!locked;
                if (audienceLockActive) {
                    const anchor = toIntOrNull(anchorIndex);
                    audienceLockIndex = Math.max(0, anchor === null ? currentIndex : anchor);
                }
                _syncAudienceLockUi();
                _postAudienceLockState();
            };

            const toggleAudienceLock = () => setAudienceLock(!audienceLockActive, currentIndex);
            const setExerciseMode = active => {
                exerciseModeActive = !!active;
                _syncExerciseModeUi();
                _postExerciseModeState();
            };
            const toggleExerciseMode = () => setExerciseMode(!exerciseModeActive);

            _syncAudienceLockUi();
            _syncExerciseModeUi();

            const _pvEsc = value => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            const _pvFormatInline = value => {
                const formatter = window.SlidesShared?.formatInlineRichText;
                if (typeof formatter === 'function') return formatter(value ?? '');
                return _pvEsc(value).replace(/\r?\n/g, '<br>');
            };
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
            const _recordAudioKbps = (() => {
                const fromQuery = Number(params.get('recAudioKbps'));
                const fallback = 48;
                const value = Number.isFinite(fromQuery) ? fromQuery : fallback;
                return Math.max(16, Math.min(160, Math.trunc(value)));
            })();
            const _recordAudioTargetBps = _recordAudioKbps * 1000;
            const _recordingMimeCandidates = [
                'audio/webm;codecs=opus',
                'audio/ogg;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4',
                'audio/mpeg',
            ];
            const _recordingAudioConstraints = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: { ideal: 1 },
                sampleRate: { ideal: 48000 },
            };
            const _audioExtFromMime = mime => {
                const safe = String(mime || '').toLowerCase();
                if (safe.includes('ogg')) return 'ogg';
                if (safe.includes('mpeg')) return 'mp3';
                if (safe.includes('mp4')) return 'm4a';
                if (safe.includes('wav')) return 'wav';
                return 'webm';
            };
            const _audioCodecLabelFromMime = mime => {
                const safe = String(mime || '').toLowerCase();
                if (safe.includes('opus')) return 'Opus';
                if (safe.includes('ogg')) return 'Ogg';
                if (safe.includes('mpeg')) return 'MP3';
                if (safe.includes('mp4')) return 'AAC/MP4';
                if (safe.includes('wav')) return 'WAV';
                return 'WebM';
            };
            const _audioBitrateLabel = bitsPerSecond => {
                const bps = Number(bitsPerSecond);
                if (!Number.isFinite(bps) || bps <= 0) return '';
                return `${Math.round(bps / 1000)} kbps`;
            };
            const _createCompressedRecorder = stream => {
                const supports = type => {
                    try {
                        if (typeof MediaRecorder?.isTypeSupported !== 'function') return true;
                        return MediaRecorder.isTypeSupported(type);
                    } catch (_) {
                        return false;
                    }
                };
                const selectedMime = _recordingMimeCandidates.find(type => supports(type)) || '';
                const bitrateCandidates = Array.from(new Set([
                    _recordAudioTargetBps,
                    64000,
                    48000,
                    32000,
                ].map(v => Math.trunc(Number(v) || 0)).filter(v => v > 0)));
                const optionsToTry = [];
                for (const bps of bitrateCandidates) {
                    if (selectedMime) {
                        optionsToTry.push({ mimeType: selectedMime, audioBitsPerSecond: bps, bitsPerSecond: bps });
                    } else {
                        optionsToTry.push({ audioBitsPerSecond: bps, bitsPerSecond: bps });
                    }
                }
                if (selectedMime) optionsToTry.push({ mimeType: selectedMime });
                optionsToTry.push({});

                let lastError = null;
                for (const opts of optionsToTry) {
                    try {
                        const recorder = new MediaRecorder(stream, opts);
                        const effectiveMime = recorder.mimeType || selectedMime || 'audio/webm';
                        const effectiveBps = Number(
                            recorder.audioBitsPerSecond
                            || opts.audioBitsPerSecond
                            || opts.bitsPerSecond
                            || 0
                        ) || 0;
                        return { recorder, mimeType: effectiveMime, bitsPerSecond: effectiveBps };
                    } catch (err) {
                        lastError = err;
                    }
                }
                throw (lastError || new Error('MediaRecorder indisponible'));
            };
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
                audioTargetBitsPerSecond: _recordAudioTargetBps,
                audioBitsPerSecond: 0,
                audioCodecLabel: '',
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
                    const codecLabel = _sessionRec.audioCodecLabel || 'audio auto';
                    const bitrateLabel = _audioBitrateLabel(_sessionRec.audioBitsPerSecond || _sessionRec.audioTargetBitsPerSecond);
                    parts.push(bitrateLabel ? `Codec: ${codecLabel} (${bitrateLabel})` : `Codec: ${codecLabel}`);
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
                    const codec = String(_sessionRec.lastSession.audioCodec || _audioCodecLabelFromMime(_sessionRec.lastSession.audioMimeType || ''));
                    const bitrate = _audioBitrateLabel(_sessionRec.lastSession.audioBitsPerSecond || 0);
                    const audioInfo = _sessionRec.lastSession.hasAudio
                        ? (bitrate ? `${codec} ${bitrate}` : codec || 'audio')
                        : 'sans audio';
                    status.textContent = `Dernière session: ${_pvClock(_sessionRec.lastSession.durationMs || 0)} · ${(_sessionRec.lastSession.events || []).length} événements · ${(_sessionRec.lastSession.captions || []).length} sous-titres · ${audioInfo}`;
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
                    audioBitsPerSecond: Number(_sessionRec.audioBitsPerSecond || _sessionRec.audioTargetBitsPerSecond || 0) || 0,
                    audioCodec: _sessionRec.audioCodecLabel || '',
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
                _sessionRec.audioBitsPerSecond = 0;
                _sessionRec.audioCodecLabel = '';
                _sessionRec.lastSession = null;
                _recordEvent('record:start', { index: currentIndex, fragmentIndex: currentFragmentIndex });
                _updateRecordingUi();

                if (navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
                    try {
                        _sessionRec.mediaStream = await navigator.mediaDevices.getUserMedia({
                            audio: _recordingAudioConstraints,
                        });
                        const recorderSetup = _createCompressedRecorder(_sessionRec.mediaStream);
                        _sessionRec.mediaRecorder = recorderSetup.recorder;
                        _sessionRec.audioMimeType = recorderSetup.mimeType || 'audio/webm';
                        _sessionRec.audioBitsPerSecond = Number(recorderSetup.bitsPerSecond || _recordAudioTargetBps) || _recordAudioTargetBps;
                        _sessionRec.audioCodecLabel = _audioCodecLabelFromMime(_sessionRec.audioMimeType);
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
                                _sessionRec.lastSession.audioBitsPerSecond = Number(_sessionRec.audioBitsPerSecond || _recordAudioTargetBps) || _recordAudioTargetBps;
                                _sessionRec.lastSession.audioCodec = _sessionRec.audioCodecLabel || _audioCodecLabelFromMime(_sessionRec.audioMimeType);
                            }
                            _updateRecordingUi();
                        };
                        _sessionRec.mediaRecorder.start(1000);
                    } catch (err) {
                        console.warn('Session recording audio setup fallback:', err?.message || err);
                        _sessionRec.mediaStream = null;
                        _sessionRec.mediaRecorder = null;
                        _sessionRec.audioMimeType = 'audio/webm';
                        _sessionRec.audioBitsPerSecond = 0;
                        _sessionRec.audioCodecLabel = '';
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
                    _sessionRec.lastSession.audioBitsPerSecond = Number(_sessionRec.audioBitsPerSecond || _recordAudioTargetBps) || _recordAudioTargetBps;
                    _sessionRec.lastSession.audioCodec = _sessionRec.audioCodecLabel || _audioCodecLabelFromMime(_sessionRec.audioMimeType);
                }
                const sessionExport = normalizeReplaySessionExport(_sessionRec.lastSession, {
                    title,
                    slideCount: slides.length,
                    hasAudio: !!_sessionRec.audioBlob,
                    audioMimeType: _sessionRec.audioMimeType || 'audio/webm',
                    audioCodec: _sessionRec.audioCodecLabel || _audioCodecLabelFromMime(_sessionRec.audioMimeType),
                });
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                const base = `${_safeFilePart(title)}-${stamp}`;
                const jsonBlob = new Blob([JSON.stringify(sessionExport, null, 2)], { type: 'application/json' });
                _downloadBlob(jsonBlob, `${base}.json`);
                if (_sessionRec.audioBlob) {
                    const ext = _audioExtFromMime(_sessionRec.audioMimeType);
                    _downloadBlob(_sessionRec.audioBlob, `${base}.${ext}`);
                }
            };

            const _buildReplayStandaloneHtml = ({ session, audioDataUrl = '' }) => {
                return buildReplayStandaloneHtml({
                    title,
                    slides,
                    data,
                    session,
                    audioDataUrl,
                    themeCss: document.getElementById('sl-theme-css')?.textContent || '',
                    slidesRenderer: SlidesRenderer,
                    slidesShared: SlidesShared,
                });
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
                        _sessionRec.lastSession.audioBitsPerSecond = Number(_sessionRec.audioBitsPerSecond || _recordAudioTargetBps) || _recordAudioTargetBps;
                        _sessionRec.lastSession.audioCodec = _sessionRec.audioCodecLabel || _audioCodecLabelFromMime(_sessionRec.audioMimeType);
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
                channel.postMessage({
                    type: SYNC_MSG.AUDIENCE_LOCK,
                    locked: audienceLockActive,
                    index: audienceLockActive ? audienceLockIndex : null,
                });
                channel.postMessage({
                    type: SYNC_MSG.EXERCISE_MODE,
                    active: exerciseModeActive,
                    title: EXERCISE_MODE_DEFAULT_TITLE,
                    message: EXERCISE_MODE_DEFAULT_MESSAGE,
                });
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
                    ? `<div class="pv-notes-prewrap">${_pvFormatInline(slide.notes)}</div>`
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
                SlidesRenderer.mountRuntimeElements(currentInner);
                SlidesRenderer.mountRuntimeElements(nextInner);
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
            audienceLockBtn?.addEventListener('click', () => {
                toggleAudienceLock();
            });
            exerciseModeBtn?.addEventListener('click', () => {
                toggleExerciseMode();
            });
            document.getElementById('pv-btn-fullscreen')?.addEventListener('click', () => {
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
                if (e.key === 'l' || e.key === 'L') {
                    e.preventDefault();
                    toggleAudienceLock();
                }
                if (e.key === 'x' || e.key === 'X') {
                    e.preventDefault();
                    toggleExerciseMode();
                }
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
