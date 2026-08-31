    // ── Theme (outside IIFE so it runs immediately) ───
    (function() {
        const controller = window.OEIThemeRuntime?.createController
            ? window.OEIThemeRuntime.createController({
                scope: 'student',
                defaultMode: 'light',
                target: 'body-dark',
                bodyElement: document.body,
                darkClass: 'dark',
            })
            : null;
        if (controller) {
            controller.applyCurrent();
            window.OEIStudentThemeToggle = function toggleStudentTheme() {
                return controller.toggleMode();
            };
            return;
        }

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

    /*
     * student-main.js — orchestrateur du mode salle étudiant (Lot 20).
     * Composé des modules classiques : student-storage / student-render / student-revision /
     * student-quiz / student-transport (chacun exposé via window.OEIStudent*). Ce fichier ne
     * garde que : câblage du hub, routage des messages room:*, écran de saisie de salle, join.
     */
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
        function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

        const params = new URLSearchParams(location.search);
        const roomId = params.get('room');

        const toSafeString = typeof NetworkSession.toSafeString === 'function'
            ? NetworkSession.toSafeString
            : ((value, max = 300) => String(value == null ? '' : value).trim().slice(0, max));
        const toSafeInt = typeof NetworkSession.toSafeInt === 'function'
            ? NetworkSession.toSafeInt
            : (value => {
                const n = Number(value);
                return Number.isFinite(n) ? Math.trunc(n) : null;
            });

        const CONNECTION_STATE = Object.freeze({
            IDLE: 'idle',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            RETRYING: 'retrying',
            OFFLINE: 'offline',
        });

        const StudentRuntime = window.OEIStudentRuntimeState?.create
            ? window.OEIStudentRuntimeState.create(window)
            : null;
        const StudentRuntimeBridge = window.OEIStudentRuntimeBridge?.create
            ? window.OEIStudentRuntimeBridge.create({ runtime: StudentRuntime })
            : null;
        const StudentTransportUIFactory = window.OEIStudentTransportUI?.create || null;

        let _studentTransportUI = null;

        function setJoinStatus(msg, type) {
            if (_studentTransportUI?.setJoinStatus) {
                _studentTransportUI.setJoinStatus(msg, type);
                return;
            }
            const el = document.getElementById('join-status');
            if (el) { el.textContent = msg; el.className = 'status-msg ' + (type || ''); }
        }

        document.getElementById('theme-toggle')?.addEventListener('click', window.OEIStudentThemeToggle);

        if (!roomId) {
            // Show manual room ID input + QR scan
            const roomInputRow = document.getElementById('room-input-row');
            const roomIdInput = document.getElementById('room-id-input');
            const joinBtn = document.getElementById('join-btn');
            const btnScanQr = document.getElementById('btn-scan-qr');
            const qrOverlay = document.getElementById('qr-scan-overlay');
            const qrVideo = document.getElementById('qr-scan-video');
            const qrClose = document.getElementById('qr-scan-close');

            if (roomInputRow) roomInputRow.classList.add('visible');
            setJoinStatus('Entrez l\'ID de la salle ou scannez le QR code.', 'info');

            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const rid = roomIdInput?.value?.trim();
                    if (!rid) { setJoinStatus('ID de salle requis.', 'error'); return; }
                    const url = new URL(location.href);
                    url.searchParams.set('room', rid);
                    location.href = url.toString();
                }, { once: true });
            }

            let _qrStream = null;
            const stopQr = () => {
                if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
                if (qrOverlay) qrOverlay.classList.remove('active');
                if (qrVideo) qrVideo.srcObject = null;
            };

            if (btnScanQr) {
                const hasBarcodeDetector = 'BarcodeDetector' in window;
                if (!hasBarcodeDetector) {
                    btnScanQr.disabled = true;
                    btnScanQr.title = 'Scanner QR non disponible dans ce navigateur';
                } else {
                    btnScanQr.addEventListener('click', async () => {
                        try {
                            _qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                            if (qrVideo) qrVideo.srcObject = _qrStream;
                            if (qrOverlay) qrOverlay.classList.add('active');
                            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                            const scan = async () => {
                                if (!qrOverlay?.classList.contains('active')) return;
                                try {
                                    const codes = await detector.detect(qrVideo);
                                    for (const code of codes) {
                                        const val = code.rawValue || '';
                                        try {
                                            const u = new URL(val);
                                            const rid = u.searchParams.get('room');
                                            if (rid) { stopQr(); const url = new URL(location.href); url.searchParams.set('room', rid); location.href = url.toString(); return; }
                                        } catch (_) {}
                                        if (/^[a-zA-Z0-9_-]{8,80}$/.test(val)) {
                                            stopQr(); const url = new URL(location.href); url.searchParams.set('room', val); location.href = url.toString(); return;
                                        }
                                    }
                                } catch (_) {}
                                requestAnimationFrame(scan);
                            };
                            requestAnimationFrame(scan);
                        } catch (err) {
                            setJoinStatus('Accès caméra refusé : ' + err.message, 'error');
                        }
                    });
                }
            }
            if (qrClose) qrClose.addEventListener('click', stopQr);
            return;
        }

        // ── Shared mutable state ─────────────────────────
        const state = {
            pseudo: '',
            transportMode: 'p2p',
            connectionState: CONNECTION_STATE.IDLE,
            connectionStateSince: Date.now(),
            slidesHtml: [],
            slideModels: [],
            renderOpts: null,
            deckMode: false,
            currentIndex: 0,
            currentFragmentOrder: -1,
            presenterIndex: 0,
            followPresenter: true,
            handRaised: false,
            quizActive: false,
            quizAnswered: false,
        };

        function _syncStudentRuntime(patch) {
            if (!patch || typeof patch !== 'object') return;
            if (StudentRuntimeBridge?.sync) {
                StudentRuntimeBridge.sync(patch);
                return;
            }
            if (!StudentRuntime?.assign) return;
            StudentRuntime.assign(patch);
        }
        function _syncTransportMode() {
            if (StudentRuntimeBridge?.setTransportMode) {
                StudentRuntimeBridge.setTransportMode(state.transportMode);
                return;
            }
            _syncStudentRuntime({ transportMode: state.transportMode });
        }

        if (typeof StudentTransportUIFactory === 'function') {
            _studentTransportUI = StudentTransportUIFactory({
                bridge: StudentRuntimeBridge,
                syncRuntime: _syncStudentRuntime,
                getTransportMode: () => state.transportMode,
                connectionStates: CONNECTION_STATE,
                initialState: state.connectionState,
            });
            if (_studentTransportUI?.getState) state.connectionState = _studentTransportUI.getState();
            if (_studentTransportUI?.getStateSince) state.connectionStateSince = _studentTransportUI.getStateSince();
        }

        const storage = window.OEIStudentStorage.create({ roomId });

        // ── Hub ──────────────────────────────────────────
        const H = {
            ROOM_MSG,
            CONNECTION_STATE,
            roomId,
            params,
            WHITEBOARD_BASE_WIDTH: 1280,
            WHITEBOARD_BASE_HEIGHT: 720,
            storage,
            NetworkSession,
            runtime: StudentRuntime,
            bridge: StudentRuntimeBridge,
            transportUI: _studentTransportUI,
            validateRoomMessage,
            icon,
            esc,
            toSafeString,
            toSafeInt,
            state,
            syncRuntime: _syncStudentRuntime,
            syncTransportMode: _syncTransportMode,
            handleMessage,
            setConnectionDetail: (text, tone) => H.transport.setConnectionDetail(text, tone),
            setConnectionState: (next, detail, tone) => H.transport.setConnectionState(next, detail, tone),
            setConnected: connected => H.transport.setConnected(connected),
        };

        H.render = window.OEIStudentRender.create(H);
        H.revision = window.OEIStudentRevision.create(H);
        H.quiz = window.OEIStudentQuiz.create(H);
        H.transport = window.OEIStudentTransport.create(H);

        _syncStudentRuntime({
            roomId,
            pseudo: state.pseudo,
            transportMode: state.transportMode,
            connectionState: state.connectionState,
            connected: false,
            currentIndex: state.currentIndex,
            currentFragmentOrder: state.currentFragmentOrder,
            presenterIndex: state.presenterIndex,
            followPresenter: state.followPresenter,
            quizActive: state.quizActive,
            quizAnswered: state.quizAnswered,
        });

        // ── room:* message router ────────────────────────
        function handleMessage(msg) {
            if (!msg?.type) return;
            if (!validateRoomMessage(msg)) return;
            if (H.transport.isResyncPending() && (
                msg.type === ROOM_MSG.INIT
                || msg.type === ROOM_MSG.SLIDE_CHANGE
                || msg.type === ROOM_MSG.SLIDE_FRAGMENT
            )) {
                H.transport.markResyncApplied(msg.type);
            }

            if (H.quiz.handleRoomMessage(msg)) return;

            switch (msg.type) {
                case ROOM_MSG.ACK:
                    H.transport.clearPendingAck(msg.rid);
                    break;

                case ROOM_MSG.WELCOME:
                    if (msg.title) {
                        document.getElementById('header-title').textContent = msg.title;
                        document.title = msg.title + ' — Étudiant';
                    }
                    break;

                case ROOM_MSG.INIT:
                    H.render.applyInit(msg);
                    H.transport.setConnected(true);
                    H.render.applyInitDisplay(msg);
                    if (state.transportMode === 'relay') {
                        setTimeout(() => {
                            if (state.connectionState === CONNECTION_STATE.CONNECTED) {
                                H.transport.sendReliable({ type: ROOM_MSG.ACTIVITIES_REQUEST }, { maxRetries: 2, retryDelay: 1000 });
                            }
                        }, 1200);
                    }
                    break;

                case ROOM_MSG.SLIDE_CHANGE:
                    H.render.applyPresenterSlideChange(msg);
                    break;

                case ROOM_MSG.SLIDE_FRAGMENT:
                    H.render.applyPresenterFragment(msg);
                    break;

                case ROOM_MSG.WHITEBOARD_SYNC:
                    H.render.applyWhiteboardSyncMessage(msg);
                    break;

                case ROOM_MSG.LASER:
                    H.render.applyLaserMessage(msg);
                    break;

                case ROOM_MSG.ZOOM:
                    H.render.applyZoomMessage(msg);
                    break;

                case ROOM_MSG.HAND_LOWER:
                    state.handRaised = false;
                    document.getElementById('hand-btn')?.classList.remove('raised');
                    document.getElementById('ssp-hand-btn')?.classList.remove('active');
                    H.transport.sendTelemetry('hand-lower', true);
                    break;

                case ROOM_MSG.SUBTITLE_ACTIVE:
                    H.render.setPresenterSubtitleActive(!!msg.active);
                    break;

                case ROOM_MSG.SUBTITLE_TEXT:
                    H.render.setSubtitleText(msg.text || '');
                    break;
            }
        }

        // ── Startup wiring ───────────────────────────────
        H.transport.bindLifecycleEvents();
        H.render.bindControls();
        H.revision.bindControls();
        H.quiz.bindControls();
        H.revision.updateBookmarkControls();
        H.revision.updateControls();

        // ── Join handler ─────────────────────────────────
        document.getElementById('pseudo-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('join-btn').click();
        });

        document.getElementById('join-btn').addEventListener('click', () => {
            const input = document.getElementById('pseudo-input');
            state.pseudo = input.value.trim();
            if (StudentRuntimeBridge?.setPseudo) StudentRuntimeBridge.setPseudo(state.pseudo);
            else _syncStudentRuntime({ pseudo: state.pseudo });
            if (!state.pseudo) { input.focus(); setJoinStatus('Entrez votre prénom', 'error'); return; }

            H.transport.setReliableQueueScope(state.pseudo);
            H.transport.startConnectionWatchdog();
            document.getElementById('join-btn').disabled = true;
            setJoinStatus('Connexion à la salle…', 'info');

            document.getElementById('join-screen').style.display = 'none';
            document.getElementById('main-view').style.display = 'flex';
            document.getElementById('waiting-overlay').classList.add('active');
            document.getElementById('waiting-text').textContent = 'Connexion au présentateur…';

            H.transport.connect({});
        });

        document.getElementById('pseudo-input').focus();
    })();
