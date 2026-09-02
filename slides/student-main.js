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
        const reviseParam = params.get('revise');

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

        // ── Révision hors salle : student.html?revise=<courseKey> ─────────
        if (!roomId && reviseParam) {
            startOfflineRevise(reviseParam);
            return;
        }

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
            renderReviseHome();
            bindReviseImport();

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

        // ── Bottom-nav mobile : sélectionne le panneau secondaire visible ──
        function bindBottomNav() {
            const mv = document.getElementById('main-view');
            const items = document.querySelectorAll('#student-bottomnav .ui-bottomnav-item');
            if (!mv || !items.length) return;
            mv.dataset.mtab = 'slide';
            const setTab = (tab) => {
                mv.dataset.mtab = tab;
                items.forEach(b => {
                    const on = b.dataset.mtab === tab;
                    b.classList.toggle('is-active', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                });
                if (tab === 'notes') document.getElementById('notes-panel')?.setAttribute('open', '');
            };
            items.forEach(b => b.addEventListener('click', () => setTab(b.dataset.mtab)));
        }

        // ── Transport factice (mode révision hors salle : aucun réseau) ──
        function makeNoopTransport() {
            const noop = () => {};
            return {
                setConnectionDetail: noop, setConnectionState: noop, setConnected: noop,
                canSend: () => false, send: () => false, sendReliable: () => null,
                clearPendingAck: noop, clearAllPendingAcks: noop, pendingAcksSize: () => 0,
                flushReliableQueue: noop, requestResync: noop, sendTelemetry: () => false,
                startTelemetryLoop: noop, stopTelemetryLoop: noop, startConnectionWatchdog: noop,
                setReliableQueueScope: noop, restoreReliableQueue: noop,
                isResyncPending: () => false, markResyncApplied: noop, clearResyncMonitor: noop,
                connect: noop, forceReconnectNow: noop, bindLifecycleEvents: noop,
                RELAY_OPTIONS: { enabled: false, wsUrl: '', token: '' },
            };
        }

        // ── Écran de choix « Revoir tout le cours » / « Réviser (N) » ──
        function showReviseChoice(H, courseKey) {
            const overlay = document.getElementById('revise-choice');
            const title = document.getElementById('revise-choice-title');
            const btnAll = document.getElementById('revise-choice-all');
            const btnDue = document.getElementById('revise-choice-due');
            if (!overlay || !btnAll || !btnDue) { H.render.showSlide(0); return; }
            const meta = H.storage.loadReviseArchive()?.meta || {};
            const due = H.storage.reviseDueCount(courseKey);
            if (title) title.textContent = meta.title || 'Réviser';
            btnDue.textContent = due > 0 ? `Réviser (${due} à revoir)` : 'Réviser';
            btnDue.disabled = false;
            overlay.hidden = false;
            const start = (revise) => {
                overlay.hidden = true;
                if (revise) {
                    H.revision.setMode(true);
                    const deck = H.revision.orderedDeck();
                    H.render.showSlide(deck.length ? deck[0] : 0);
                } else {
                    H.render.showSlide(0);
                }
            };
            btnAll.addEventListener('click', () => start(false), { once: true });
            btnDue.addEventListener('click', () => start(true), { once: true });
        }

        // ── Mode révision hors salle ─────────────────────────────────────
        function startOfflineRevise(courseKeyRaw) {
            const courseKey = String(courseKeyRaw || '').trim();
            document.body.classList.add('revise-offline');

            const storage = window.OEIStudentStorage.create({ roomId: '' });
            storage.setCourseKey(courseKey);
            const archive = storage.loadReviseArchive();
            if (!courseKey || !archive || !archive.deck) {
                document.body.classList.remove('revise-offline');
                const row = document.getElementById('room-input-row');
                if (row) row.classList.add('visible');
                setJoinStatus('Cours introuvable sur cet appareil. Importez votre fichier de révision.', 'error');
                renderReviseHome();
                return;
            }

            const state = {
                pseudo: '', transportMode: 'p2p', connectionState: CONNECTION_STATE.OFFLINE,
                connectionStateSince: Date.now(), slidesHtml: [], slideModels: [], renderOpts: null,
                deckMode: false, currentIndex: 0, currentFragmentOrder: -1,
                presenterIndex: 0, followPresenter: false, handRaised: false,
                quizActive: false, quizAnswered: false, offlineRevise: true,
            };

            const H = {
                ROOM_MSG, CONNECTION_STATE, roomId: archive.meta.roomId || '', params,
                WHITEBOARD_BASE_WIDTH: 1280, WHITEBOARD_BASE_HEIGHT: 720,
                storage, NetworkSession,
                runtime: StudentRuntime, bridge: StudentRuntimeBridge, transportUI: null,
                validateRoomMessage, icon, esc, toSafeString, toSafeInt, state,
                reviseOffline: true,
                syncRuntime: () => {}, syncTransportMode: () => {}, handleMessage: () => {},
                setConnectionDetail: () => {}, setConnectionState: () => {}, setConnected: () => {},
            };
            H.transport = makeNoopTransport();
            H.render = window.OEIStudentRender.create(H);
            H.revision = window.OEIStudentRevision.create(H);
            H.quiz = window.OEIStudentQuiz.create(H);

            H.render.bindControls();
            H.revision.bindControls();
            H.quiz.bindControls();
            H.revision.updateBookmarkControls();
            H.revision.updateControls();

            const courseTitle = archive.meta.title || 'Révision';
            document.getElementById('header-title').textContent = courseTitle;
            document.title = courseTitle + ' — Révision';

            H.render.applyInit({ type: ROOM_MSG.INIT, deck: archive.deck, currentIndex: 0 });
            state.presenterIndex = Math.max(0, state.slidesHtml.length - 1);

            document.getElementById('join-screen').style.display = 'none';
            const mv = document.getElementById('main-view');
            mv.style.display = 'flex';
            mv.classList.add('revision-active');
            document.getElementById('waiting-overlay')?.classList.remove('active');

            bindBottomNav();
            showReviseChoice(H, courseKey);
        }

        // ── Accueil « Mes cours à réviser » (écran de saisie de salle) ──
        function renderReviseHome() {
            const section = document.getElementById('revise-list-section');
            const list = document.getElementById('revise-list');
            if (!section || !list) return;
            const store = window.OEIStudentStorage.create({ roomId: '' });
            const archives = store.listReviseArchives();
            list.textContent = '';
            if (!archives.length) { section.setAttribute('hidden', ''); return; }
            section.removeAttribute('hidden');
            archives.forEach(it => {
                const li = document.createElement('li');
                li.className = 'revise-list-item';
                const h = document.createElement('div');
                h.className = 'revise-list-item-title';
                h.textContent = it.title || 'Sans titre';
                const meta = document.createElement('div');
                meta.className = 'revise-list-item-meta';
                const due = store.reviseDueCount(it.courseKey);
                meta.textContent = `${it.slideCount || 0} slides · ${due} à revoir aujourd'hui`;
                const actions = document.createElement('div');
                actions.className = 'revise-list-item-actions';
                const go = document.createElement('button');
                go.type = 'button';
                go.className = 'ui-btn ui-btn--primary';
                go.textContent = 'Réviser';
                go.addEventListener('click', () => {
                    location.href = 'student.html?revise=' + encodeURIComponent(it.courseKey);
                });
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'ui-btn';
                del.textContent = 'Supprimer';
                del.addEventListener('click', () => {
                    if (!window.confirm(`Supprimer la révision « ${it.title} » ?`)) return;
                    store.deleteReviseArchive(it.courseKey);
                    renderReviseHome();
                });
                actions.append(go, del);
                li.append(h, meta, actions);
                list.appendChild(li);
            });
        }

        function bindReviseImport() {
            const btn = document.getElementById('revise-import-btn');
            const file = document.getElementById('revise-import-file');
            if (!btn || !file) return;
            btn.addEventListener('click', () => file.click());
            file.addEventListener('change', async e => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                try {
                    const parsed = JSON.parse(await f.text());
                    const store = window.OEIStudentStorage.create({ roomId: '' });
                    const res = store.importReviseFile(parsed);
                    if (res.ok) {
                        setJoinStatus('Révision importée ✓', 'info');
                        renderReviseHome();
                    } else {
                        setJoinStatus(res.reason === 'no-deck'
                            ? 'Ce fichier ne contient pas le cours — importez-le pendant une session.'
                            : 'Fichier de révision invalide.', 'error');
                    }
                } catch (_) {
                    setJoinStatus('Import impossible : JSON invalide.', 'error');
                } finally {
                    e.target.value = '';
                }
            });
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

        // ── Archive de révision : à chaque room:init porteur d'un deck, on
        //    (re)scope le stockage favoris/notes/SM-2 sur l'identité du cours et
        //    on persiste le deck localement → révision possible hors salle. ──
        function _archiveDeckForRevision(msg) {
            const deck = msg && msg.deck;
            if (!deck || !Array.isArray(deck.slides) || typeof storage.setCourseKey !== 'function') return;
            try {
                const ck = window.OEIStudentStorage.courseKeyFromDeck(deck);
                storage.setCourseKey(ck);
                H.render.rebindCourseStorage();
                H.revision.reloadForCourse();
                const res = storage.saveReviseArchive({
                    deck,
                    meta: {
                        title: msg.title || deck.metadata?.title || 'Présentation',
                        author: deck.metadata?.author || '',
                        slideCount: deck.slides.length,
                        roomId,
                    },
                });
                if (!res.ok) console.warn('[revise] archive non persistée:', res.reason);
            } catch (err) {
                console.warn('[revise] archive impossible:', err);
            }
        }

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
                    _archiveDeckForRevision(msg);
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

        bindBottomNav();

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
