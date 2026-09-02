/**
 * @module slides/student-render
 * Student slide rendering: deck-mode rebranch onto SlidesRenderer / SlidesThemes /
 * OEISlidesSpecialRuntime (Mermaid, timers, LaTeX, quiz cloze…), legacy `slidesHtml`
 * fallback, per-slide notes, whiteboard replay, laser/zoom overlays, checkpoint gating.
 * Extracted from student-main.js (Lot 20).
 */
(function attachStudentRender(root) {
    'use strict';

    /**
     * @param {any} H - student app hub (see student-main.js)
     */
    function createStudentRender(H) {
        const st = H.state;
        const toSafeInt = H.toSafeInt;
        const esc = H.esc;
        const WB_W = H.WHITEBOARD_BASE_WIDTH;
        const WB_H = H.WHITEBOARD_BASE_HEIGHT;
        const studentWidgetScriptVersion = Date.now();

        // ── Per-slide notes ──────────────────────────────
        // Clé lue à la volée : `storage.setCourseKey()` la re-pointe vers l'archive
        // du cours après `room:init` ; `rebindCourseStorage()` recharge alors `_notesData`.
        let NOTES_KEY = H.storage.keys.notes;
        let _notesData = H.storage.localGetJSON(NOTES_KEY, {}) || {};

        /** Recharge les notes par slide depuis l'archive du cours courant. */
        function rebindCourseStorage() {
            NOTES_KEY = H.storage.keys.notes;
            _notesData = H.storage.localGetJSON(NOTES_KEY, {}) || {};
            _loadSlideNotes(st.currentIndex);
        }

        function _saveSlideNotes() {
            const area = document.getElementById('notes-area');
            const areaSide = document.getElementById('notes-area-side');
            const text = (document.activeElement === areaSide ? areaSide?.value : area?.value) ?? '';
            if (text.trim()) _notesData[String(st.currentIndex)] = text;
            else delete _notesData[String(st.currentIndex)];
            H.storage.localSetJSON(NOTES_KEY, _notesData);
        }

        function _loadSlideNotes(idx) {
            const area = document.getElementById('notes-area');
            if (area) {
                area.value = _notesData[String(idx)] || '';
                area.placeholder = `Notes — slide ${idx + 1}…`;
            }
            const areaSide = document.getElementById('notes-area-side');
            if (areaSide) {
                areaSide.value = _notesData[String(idx)] || '';
                areaSide.placeholder = `Notes — slide ${idx + 1}…`;
            }
            _updateNotesLabel();
        }

        function _updateNotesLabel() {
            const label = document.getElementById('notes-summary-label');
            if (!label) return;
            const count = Object.keys(_notesData).length;
            label.textContent = count > 0 ? `Notes (${count} slide${count > 1 ? 's' : ''})` : 'Notes';
        }

        // ── Subtitles ────────────────────────────────────
        let _subtitlePresenterActive = false;
        let _subtitleStudentEnabled = false;
        let _subtitleLastText = '';
        function _updateStudentSubtitleOverlay() {
            const overlay = document.getElementById('student-subtitle-overlay');
            if (!overlay) return;
            overlay.classList.toggle('active', _subtitlePresenterActive && _subtitleStudentEnabled);
        }

        // ── Quiz / checkpoint slide detection ────────────
        let _quizSlides = new Set();
        let _checkpointRequiredSlides = new Set();
        let _checkpointCompletedSlides = new Set();

        function detectSlides() {
            _quizSlides = new Set();
            st.slidesHtml.forEach((html, idx) => {
                if (typeof html !== 'string') return;
                if (html.includes('sl-quizlive-pending') || html.includes('sl-quizlive')) _quizSlides.add(idx);
            });
            _checkpointRequiredSlides = new Set();
            st.slidesHtml.forEach((html, idx) => {
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
                Array.from(_checkpointCompletedSlides.values()).filter(idx => idx >= 0 && idx < st.slidesHtml.length)
            );
        }

        function currentSlideCheckpointLocked() {
            if (H.reviseOffline) return false;           // révision hors salle : pas de présentateur, aucun verrou
            if (st.followPresenter) return false;
            if (!_checkpointRequiredSlides.has(st.currentIndex)) return false;
            return !_checkpointCompletedSlides.has(st.currentIndex);
        }

        function updateCheckpointStatus() {
            const badge = document.getElementById('checkpoint-status');
            const nextBtn = document.getElementById('nav-next');
            if (!badge) return;
            const locked = currentSlideCheckpointLocked();
            badge.classList.toggle('active', locked);
            badge.title = locked ? 'Répondez au checkpoint de ce slide pour continuer' : '';
            if (nextBtn && !st.followPresenter) {
                nextBtn.disabled = locked || st.currentIndex >= (st.slidesHtml.length - 1);
            }
        }

        function markCheckpointCompleted(idx = st.currentIndex, reason = '') {
            const safe = Number(idx);
            if (!Number.isFinite(safe) || safe < 0) return;
            _checkpointCompletedSlides.add(safe);
            updateCheckpointStatus();
            if (_checkpointRequiredSlides.has(safe)) {
                const detail = reason ? `Checkpoint validé (${reason})` : 'Checkpoint validé';
                H.setConnectionDetail(detail, 'ok');
            }
        }

        function enforceCheckpointBeforeNext(direction) {
            if (direction <= 0) return true;
            if (!currentSlideCheckpointLocked()) return true;
            updateCheckpointStatus();
            H.setConnectionDetail('Checkpoint requis avant le slide suivant', 'warn');
            return false;
        }

        // ── #nav-sync : contrôle contextuel « suivi / resynchronisation » ──
        // Fusionne les anciens boutons #nav-follow + #nav-resync (audit P2-1).
        //   suit + synchro (currentIndex === dernier index présentateur reçu) → pastille discrète
        //   libre OU désynchronisé → bouton plein « Rejoindre » (SYNC_REQUEST + réactive le suivi)
        //   menu / appui long → « Naviguer librement » (désactive le suivi volontairement)
        function navSyncIsSynced() {
            if (!st.followPresenter) return false;
            const cur = toSafeInt(st.currentIndex);
            const pres = toSafeInt(st.presenterIndex);
            return cur !== null && pres !== null && cur === pres;
        }

        function updateNavSync() {
            if (H.reviseOffline) return;                 // #nav-sync masqué en révision hors salle (CSS body.revise-offline)
            const el = document.getElementById('nav-sync');
            if (!el) return;
            const synced = navSyncIsSynced();
            el.dataset.state = synced ? 'synced' : 'rejoin';
            el.setAttribute('aria-pressed', synced ? 'true' : 'false');
            const label = el.querySelector('.nav-sync-label');
            if (synced) {
                if (label) label.textContent = 'Synchro';
                el.setAttribute('aria-label', 'Vous suivez le présentateur — appui long pour naviguer librement');
                el.title = 'Vous suivez le présentateur';
            } else {
                const presNum = (toSafeInt(st.presenterIndex) ?? 0) + 1;
                if (label) label.textContent = 'Rejoindre';
                el.setAttribute('aria-label', `Rejoindre le présentateur (slide ${presNum})`);
                el.title = `Rejoindre le présentateur (slide ${presNum})`;
            }
        }

        function _navSyncOutsideClick(e) {
            const wrap = document.getElementById('nav-sync-wrap');
            if (wrap && !wrap.contains(e.target)) navSyncCloseMenu();
        }
        function _navSyncKeydown(e) {
            if (e.key === 'Escape') { navSyncCloseMenu(); document.getElementById('nav-sync')?.focus(); }
        }
        function navSyncCloseMenu() {
            const menu = document.getElementById('nav-sync-menu');
            if (!menu || menu.hidden) return;
            menu.hidden = true;
            document.getElementById('nav-sync')?.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', _navSyncOutsideClick, true);
            document.removeEventListener('keydown', _navSyncKeydown, true);
        }
        function navSyncOpenMenu() {
            const menu = document.getElementById('nav-sync-menu');
            if (!menu || !menu.hidden) return;
            menu.hidden = false;
            document.getElementById('nav-sync')?.setAttribute('aria-expanded', 'true');
            document.addEventListener('click', _navSyncOutsideClick, true);
            document.addEventListener('keydown', _navSyncKeydown, true);
            menu.querySelector('button')?.focus();
        }

        function navSyncRejoin() {
            navSyncCloseMenu();
            st.followPresenter = true;
            H.syncRuntime({ followPresenter: true });
            H.revision.onFollowToggle(true);
            H.transport.requestResync('rejoindre');
            showSlide(st.presenterIndex);
            H.revision.updateBookmarkControls();
            H.revision.updateControls();
            updateCheckpointStatus();
            updateNavSync();
            H.transport.sendTelemetry('follow-toggle', true);
        }

        function navSyncGoFree() {
            navSyncCloseMenu();
            if (!st.followPresenter) { updateNavSync(); return; }
            st.followPresenter = false;
            H.syncRuntime({ followPresenter: false });
            H.revision.onFollowToggle(false);
            H.revision.updateBookmarkControls();
            H.revision.updateControls();
            updateCheckpointStatus();
            updateNavSync();
            H.setConnectionDetail('Navigation libre — vous ne suivez plus le présentateur', 'warn');
            H.transport.sendTelemetry('follow-toggle', true);
        }

        // ── Whiteboard replay ────────────────────────────
        let _whiteboardActive = false;
        let _whiteboardCurrentSlide = 0;
        const _whiteboardCommandsBySlide = {};

        function sanitizeWhiteboardPoint(raw) {
            if (!raw || typeof raw !== 'object') return null;
            const x = Number(raw.x);
            const y = Number(raw.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { x: Math.max(0, Math.min(WB_W, x)), y: Math.max(0, Math.min(WB_H, y)) };
        }

        function sanitizeWhiteboardCommands(raw) {
            if (!Array.isArray(raw)) return [];
            const out = [];
            raw.forEach(entry => {
                if (!entry || typeof entry !== 'object') return;
                if (entry.kind === 'stroke') {
                    const tool = String(entry.tool || '');
                    if (!['pen', 'highlighter', 'eraser'].includes(tool)) return;
                    const size = Number(entry.size);
                    if (!Number.isFinite(size) || size <= 0) return;
                    const points = Array.isArray(entry.points) ? entry.points.map(sanitizeWhiteboardPoint).filter(Boolean) : [];
                    if (points.length < 2) return;
                    out.push({
                        kind: 'stroke',
                        tool,
                        color: typeof entry.color === 'string' ? entry.color : '#ffffff',
                        size,
                        points,
                    });
                    return;
                }
                if (entry.kind === 'shape') {
                    const shape = String(entry.shape || '');
                    if (!['rect', 'circle', 'arrow'].includes(shape)) return;
                    const size = Number(entry.size);
                    const startX = Number(entry.startX);
                    const startY = Number(entry.startY);
                    const endX = Number(entry.endX);
                    const endY = Number(entry.endY);
                    if (![size, startX, startY, endX, endY].every(Number.isFinite) || size <= 0) return;
                    out.push({
                        kind: 'shape',
                        shape,
                        color: typeof entry.color === 'string' ? entry.color : '#ffffff',
                        size,
                        startX: Math.max(0, Math.min(WB_W, startX)),
                        startY: Math.max(0, Math.min(WB_H, startY)),
                        endX: Math.max(0, Math.min(WB_W, endX)),
                        endY: Math.max(0, Math.min(WB_H, endY)),
                    });
                }
            });
            return out;
        }

        function drawWhiteboardArrow(ctx, x1, y1, x2, y2, lineWidth) {
            const headlen = 10 + lineWidth;
            const angle = Math.atan2(y2 - y1, x2 - x1);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }

        function drawWhiteboardCommand(ctx, command, scaleX, scaleY) {
            if (!command || typeof command !== 'object') return;
            const uniformScale = Math.max(0.1, Math.min(scaleX, scaleY));
            if (command.kind === 'stroke' && Array.isArray(command.points) && command.points.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                if (command.tool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.strokeStyle = 'rgba(0,0,0,1)';
                    ctx.lineWidth = command.size * 2 * uniformScale;
                    ctx.globalAlpha = 1;
                } else if (command.tool === 'highlighter') {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = command.color;
                    ctx.lineWidth = command.size * 2.5 * uniformScale;
                    ctx.globalAlpha = 0.35;
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = command.color;
                    ctx.lineWidth = command.size * uniformScale;
                    ctx.globalAlpha = 1;
                }
                ctx.beginPath();
                ctx.moveTo(command.points[0].x * scaleX, command.points[0].y * scaleY);
                for (let i = 1; i < command.points.length; i++) {
                    const p = command.points[i];
                    ctx.lineTo(p.x * scaleX, p.y * scaleY);
                }
                ctx.stroke();
                ctx.closePath();
                ctx.restore();
                return;
            }
            if (command.kind === 'shape') {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = command.color;
                ctx.lineWidth = command.size * uniformScale;
                const x1 = command.startX * scaleX;
                const y1 = command.startY * scaleY;
                const x2 = command.endX * scaleX;
                const y2 = command.endY * scaleY;
                if (command.shape === 'rect') {
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                } else if (command.shape === 'circle') {
                    const r = Math.hypot(x2 - x1, y2 - y1);
                    ctx.beginPath();
                    ctx.arc(x1, y1, r, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (command.shape === 'arrow') {
                    drawWhiteboardArrow(ctx, x1, y1, x2, y2, ctx.lineWidth);
                }
                ctx.restore();
            }
        }

        function renderStudentWhiteboard() {
            const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('student-whiteboard'));
            const frame = document.getElementById('slide-frame');
            if (!canvas || !frame) return;
            const dpr = window.devicePixelRatio || 1;
            const width = Math.max(1, Math.round(frame.clientWidth || 0));
            const height = Math.max(1, Math.round(frame.clientHeight || 0));
            if (!width || !height) return;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            if (typeof ctx.setTransform === 'function') ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            const commands = Array.isArray(_whiteboardCommandsBySlide[String(st.currentIndex)])
                ? _whiteboardCommandsBySlide[String(st.currentIndex)]
                : [];
            const shouldShow = _whiteboardActive && st.currentIndex === _whiteboardCurrentSlide;
            canvas.classList.toggle('active', shouldShow);
            if (!shouldShow || !commands.length) return;
            const scaleX = width / WB_W;
            const scaleY = height / WB_H;
            commands.forEach(command => drawWhiteboardCommand(ctx, command, scaleX, scaleY));
        }

        function applyWhiteboardSyncMessage(msg) {
            if (!msg || typeof msg !== 'object') return;
            const slideIndex = toSafeInt(msg.slideIndex);
            _whiteboardCurrentSlide = slideIndex === null ? Math.max(0, st.presenterIndex) : Math.max(0, slideIndex);
            _whiteboardActive = !!msg.active;
            if (Array.isArray(msg.commands)) {
                _whiteboardCommandsBySlide[String(_whiteboardCurrentSlide)] = sanitizeWhiteboardCommands(msg.commands);
            }
            renderStudentWhiteboard();
        }

        // ── Laser / zoom overlays ────────────────────────
        let _laserDotHideTimer = null;
        function applyLaserMessage(msg) {
            const dot = document.getElementById('student-laser-dot');
            if (!dot) return;
            if (!msg.active) {
                dot.style.display = 'none';
                return;
            }
            const frame = document.getElementById('slide-frame');
            if (!frame) return;
            const rect = frame.getBoundingClientRect();
            const nx = typeof msg.x === 'number' ? msg.x : 0;
            const ny = typeof msg.y === 'number' ? msg.y : 0;
            dot.style.display = 'block';
            dot.style.left = (rect.left + nx * rect.width) + 'px';
            dot.style.top = (rect.top + ny * rect.height) + 'px';
            if (_laserDotHideTimer) clearTimeout(_laserDotHideTimer);
            _laserDotHideTimer = setTimeout(() => { dot.style.display = 'none'; }, 3000);
        }

        // Zoom appliqué sur #slide-frame (pas sur #slide-inner qui porte le scale de base)
        function applyZoomMessage(msg) {
            const frame = document.getElementById('slide-frame');
            if (!frame) return;
            if (!msg.active) {
                frame.style.transform = '';
                frame.style.transformOrigin = '';
                return;
            }
            const nx = typeof msg.x === 'number' ? msg.x : 0.5;
            const ny = typeof msg.y === 'number' ? msg.y : 0.5;
            const zoomScale = typeof msg.scale === 'number' && msg.scale > 0 ? msg.scale : 2;
            frame.style.transformOrigin = (nx * 100) + '% ' + (ny * 100) + '%';
            frame.style.transform = 'scale(' + zoomScale + ')';
        }

        // ── Slide scaling ────────────────────────────────
        function scaleSlide() {
            const frame = document.getElementById('slide-frame');
            const inner = document.getElementById('slide-inner');
            if (!frame || !inner) return;
            const host = frame.parentElement || frame;
            const cs = getComputedStyle(host);
            const px = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
            const py = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
            const fw = Math.max(0, (host.clientWidth || 0) - px);
            const fh = Math.max(0, (host.clientHeight || 0) - py);
            if (!fw || !fh) return;
            const scale = Math.max(0.05, Math.min(fw / 1280, fh / 720));
            frame.style.width = Math.round(1280 * scale) + 'px';
            frame.style.height = Math.round(720 * scale) + 'px';
            inner.style.transform = `scale(${scale})`;
            renderStudentWhiteboard();
        }

        function maxPresenterAllowedIndex() {
            const hardMax = Math.max(0, st.slidesHtml.length - 1);
            if (H.reviseOffline) return hardMax;         // révision hors salle : navigation libre sur tout le deck
            const safePresenterIndex = toSafeInt(st.presenterIndex);
            if (safePresenterIndex === null) return hardMax;
            return Math.max(0, Math.min(hardMax, safePresenterIndex));
        }

        // ── Deck-mode render pipeline (SlidesRenderer / SlidesThemes) ──
        function _applyDeckTheme(deck) {
            const el = document.getElementById('presentation-theme');
            if (!el || !window.SlidesThemes) return;
            let themeData;
            try {
                themeData = window.OEIDesignTokens?.resolvePresentationTheme
                    ? window.OEIDesignTokens.resolvePresentationTheme(deck)
                    : (typeof deck.theme === 'string'
                        ? (window.SlidesThemes.BUILT_IN[deck.theme] || window.SlidesThemes.BUILT_IN.dark)
                        : (deck.theme || window.SlidesThemes.BUILT_IN.dark));
            } catch (_) { themeData = window.SlidesThemes.BUILT_IN.dark; }
            try {
                el.textContent = window.SlidesThemes.generateCSS(themeData).replace(/\.reveal/g, '#slide-inner');
            } catch (_) {}
        }

        function _canRenderDeck() {
            return !!(window.SlidesRenderer
                && window.SlidesShared
                && typeof window.SlidesRenderer.renderSlide === 'function'
                && typeof window.SlidesShared.buildRenderOptions === 'function');
        }

        /**
         * Apply a `room:init` payload. Prefers `msg.deck` (JSON) → renders locally via
         * SlidesRenderer so Mermaid / timers / LaTeX / quiz cloze mount. Falls back to
         * `msg.slidesHtml` (pre-rendered, 1-version compat).
         */
        function applyInit(msg) {
            const deck = (msg && msg.deck && typeof msg.deck === 'object' && Array.isArray(msg.deck.slides))
                ? msg.deck
                : null;
            if (deck && _canRenderDeck()) {
                st.deckMode = true;
                st.slideModels = deck.slides.filter(s => s && !s.hidden);
                st.renderOpts = window.SlidesShared.buildRenderOptions(
                    Object.assign({}, deck, { slides: st.slideModels }),
                    { includeNotes: false, showSlideNumber: false, footerText: null },
                );
                _applyDeckTheme(deck);
                st.slidesHtml = st.slideModels.map((s, i) => {
                    try { return window.SlidesRenderer.renderSlide(s, i, st.renderOpts); }
                    catch (_) { return ''; }
                });
            } else {
                st.deckMode = false;
                st.slideModels = [];
                st.renderOpts = null;
                if (msg && msg.themeCSS) {
                    const el = document.getElementById('presentation-theme');
                    if (el) el.textContent = String(msg.themeCSS).replace(/\.reveal/g, '#slide-inner');
                }
                st.slidesHtml = Array.isArray(msg && msg.slidesHtml) ? msg.slidesHtml : [];
            }
            Object.keys(_whiteboardCommandsBySlide).forEach(key => { delete _whiteboardCommandsBySlide[key]; });
            _whiteboardActive = false;
            detectSlides();
        }

        // ── Runtime mount (special elements + widgets) ───
        function mountSlideRuntime(inner) {
            if (st.deckMode && window.SlidesRenderer && typeof window.SlidesRenderer.mountRuntimeElements === 'function') {
                window.SlidesRenderer.mountRuntimeElements(inner, null, { includeSpecial: true, includeWidgets: true })
                    .catch(err => console.warn('mountRuntimeElements (student):', err));
                return;
            }
            mountCodeLive(inner);
            mountStudentWidgets(inner);
            mountSpecialRender(inner);
        }

        async function mountStudentWidgets(container) {
            const reg = window.OEI_WIDGET_REGISTRY;
            if (!reg) return;
            const slots = container.querySelectorAll('.sl-sim-container[data-widget]');
            if (!slots.length) return;
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
                    const badge = document.createElement('div');
                    badge.className = 'widget-interactive-badge';
                    badge.textContent = 'Interactif';
                    slot.classList.add('widget-slot-has-badge');
                    slot.appendChild(badge);
                } catch (e) {
                    console.warn('Widget mount error (student):', wid, e);
                }
            }
        }

        function mountCodeLive(container) {
            container.querySelectorAll('.sl-codelive-pending').forEach(el => {
                if (el.dataset.studentBound) return;
                el.dataset.studentBound = '1';
                const lang = el.dataset.language || el.dataset.lang || 'javascript';
                const textarea = el.querySelector('.sl-codelive-code') || el.querySelector('textarea');
                const btnRun = el.querySelector('.sl-codelive-run') || el.querySelector('.sl-run-btn');
                const consoleEl = el.querySelector('.sl-codelive-console') || el.querySelector('.sl-console');
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

        function mountSpecialRender(container) {
            const latexEls = Array.from(container.querySelectorAll('.sl-latex-pending:not([data-rendered])'));
            if (latexEls.length) {
                const doLatex = () => {
                    latexEls.forEach(el => {
                        const target = el.querySelector('.sl-latex-render');
                        if (!target) return;
                        const expr = el.dataset.latex || target.textContent || '';
                        try {
                            target.innerHTML = window.katex.renderToString(expr, { displayMode: true, throwOnError: false });
                            el.dataset.rendered = '1';
                        } catch (_) {}
                    });
                };
                if (window.katex) {
                    doLatex();
                } else {
                    if (!document.getElementById('student-katex-css')) {
                        const link = document.createElement('link');
                        link.id = 'student-katex-css'; link.rel = 'stylesheet';
                        link.href = '../vendor/katex/0.16.11/katex.min.css';
                        document.head.appendChild(link);
                    }
                    if (!document.getElementById('student-katex-js')) {
                        const s = document.createElement('script');
                        s.id = 'student-katex-js';
                        s.src = '../vendor/katex/0.16.11/katex.min.js';
                        s.onload = doLatex;
                        document.head.appendChild(s);
                    } else {
                        const poll = setInterval(() => { if (window.katex) { clearInterval(poll); doLatex(); } }, 50);
                    }
                }
            }

            const codeEls = Array.from(container.querySelectorAll('pre > code[class*="language-"]:not([data-highlighted])'));
            if (codeEls.length) {
                const doHighlight = () => {
                    codeEls.forEach(el => {
                        try { window.hljs.highlightElement(el); } catch (_) {}
                    });
                };
                if (window.hljs) {
                    doHighlight();
                } else {
                    if (!document.getElementById('student-hljs-css')) {
                        const link = document.createElement('link');
                        link.id = 'student-hljs-css'; link.rel = 'stylesheet';
                        link.href = '../vendor/revealjs/5.1.0/plugin/highlight/monokai.css';
                        document.head.appendChild(link);
                    }
                    if (!document.getElementById('student-hljs-js')) {
                        const s = document.createElement('script');
                        s.id = 'student-hljs-js';
                        s.src = '../vendor/highlightjs/11.9.0/highlight.min.js';
                        s.onload = doHighlight;
                        document.head.appendChild(s);
                    } else {
                        const poll = setInterval(() => { if (window.hljs) { clearInterval(poll); doHighlight(); } }, 50);
                    }
                }
            }
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

        // ── Navigation / slide display ───────────────────
        function showSlide(idx) {
            _saveSlideNotes();
            let target = toSafeInt(idx);
            if (target === null) return;
            if (target < 0 || target >= st.slidesHtml.length) return;
            const allowedMax = maxPresenterAllowedIndex();
            if (target > allowedMax) {
                target = allowedMax;
                H.setConnectionDetail(`Navigation limitée à la slide ${allowedMax + 1} (présentateur)`, 'warn');
            }
            st.currentIndex = target;
            H.syncRuntime({ currentIndex: target });
            const inner = document.getElementById('slide-inner');
            const counter = document.getElementById('slide-counter');
            if (!inner) return;

            inner.innerHTML = st.slidesHtml[target];
            applyFragmentProgress(-1);
            if (counter) counter.textContent = `${target + 1} / ${st.slidesHtml.length}`;
            const navCounter = document.getElementById('slide-counter-nav');
            if (navCounter) navCounter.textContent = `${target + 1} / ${st.slidesHtml.length}`;
            const prevBtn = document.getElementById('nav-prev');
            const nextBtn = document.getElementById('nav-next');
            if (prevBtn) prevBtn.disabled = target === 0;
            if (nextBtn) nextBtn.disabled = target >= allowedMax;
            const sfnCounter = document.getElementById('sfn-counter');
            const sfnPrev = document.getElementById('sfn-prev');
            const sfnNext = document.getElementById('sfn-next');
            if (sfnCounter) sfnCounter.textContent = `${target + 1} / ${st.slidesHtml.length}`;
            if (sfnPrev) sfnPrev.disabled = target === 0;
            if (sfnNext) sfnNext.disabled = target >= allowedMax;
            scaleSlide();
            requestAnimationFrame(scaleSlide);
            applyZoomMessage({ active: false });
            mountSlideRuntime(inner);
            renderStudentWhiteboard();
            _loadSlideNotes(target);
            const sspNum = document.getElementById('ssp-slide-num');
            const sspTitle = document.getElementById('ssp-slide-title');
            if (sspNum) sspNum.textContent = `Slide ${target + 1}`;
            if (sspTitle) {
                const h = inner.querySelector('.sl-heading, h1, h2');
                sspTitle.textContent = h ? h.textContent.trim().slice(0, 64) : '—';
            }
            H.revision.updateBookmarkControls();
            H.revision.noteSeen(target);
            H.revision.updateControls();
            updateCheckpointStatus();
            updateNavSync();
            H.transport.sendTelemetry('slide');
        }

        function applyFragmentProgress(step) {
            const inner = document.getElementById('slide-inner');
            if (!inner) return;
            const frags = Array.from(inner.querySelectorAll('.fragment'));
            const max = Number.isFinite(Number(step)) ? Math.trunc(Number(step)) : -1;
            st.currentFragmentOrder = max;
            H.syncRuntime({ currentFragmentOrder: max });
            frags.forEach((frag, i) => {
                const visible = i <= max;
                frag.classList.toggle('visible', visible);
                frag.classList.toggle('current-fragment', i === max && max >= 0);
            });
            H.transport.sendTelemetry('fragment');
        }

        // ── Presenter room:* handlers (delegated from handleMessage) ──
        function applyPresenterSlideChange(msg) {
            if (typeof msg.index !== 'number') return;
            st.presenterIndex = msg.index;
            H.syncRuntime({ presenterIndex: msg.index });
            if (st.quizActive) H.quiz.dismissActiveQuiz();
            if (st.currentIndex > maxPresenterAllowedIndex()) {
                showSlide(st.presenterIndex);
            }
            if (st.followPresenter) {
                showSlide(msg.index);
                const fragOrder = toSafeInt(msg.fragmentOrder ?? msg.fragmentIndex);
                if (fragOrder !== null) applyFragmentProgress(fragOrder);
            }
            updateNavSync();
        }

        function applyPresenterFragment(msg) {
            if (!st.followPresenter) return;
            const slideIdx = toSafeInt(msg.index);
            if (slideIdx !== null && slideIdx !== st.currentIndex) return;
            const hidden = msg.hidden === true || msg.hidden === 1 || String(msg.hidden || '').toLowerCase() === 'true';
            const order = toSafeInt(msg.fragmentOrder);
            if (order !== null) {
                applyFragmentProgress(hidden ? (order - 1) : order);
                return;
            }
            const inner = document.getElementById('slide-inner');
            if (!inner) return;
            const frags = Array.from(inner.querySelectorAll('.fragment'));
            let target = null;
            if (msg.fragmentIndex !== null && msg.fragmentIndex !== undefined) {
                target = inner.querySelector(`.fragment[data-fragment-index="${msg.fragmentIndex}"]`);
            }
            if (!target && frags.length > 0) {
                const idx = toSafeInt(msg.fragmentIndex);
                if (idx !== null) target = frags[idx];
            }
            if (target) {
                if (hidden) target.classList.remove('visible', 'current-fragment');
                else target.classList.add('visible', 'current-fragment');
            }
        }

        function applyInitDisplay(msg) {
            document.getElementById('join-screen').style.display = 'none';
            document.getElementById('main-view').style.display = 'flex';
            document.getElementById('waiting-overlay').classList.remove('active');
            document.getElementById('score-pseudo').textContent = st.pseudo;
            H.quiz.updateScoreDisplay();
            const initIndex = typeof msg.currentIndex === 'number' ? msg.currentIndex : 0;
            st.presenterIndex = initIndex;
            _whiteboardCurrentSlide = Math.max(0, initIndex);
            H.syncRuntime({ presenterIndex: initIndex });
            if (H.revision.isEnabled()) {
                const deck = H.revision.orderedDeck();
                const start = deck.includes(initIndex) ? initIndex : (deck[0] ?? initIndex);
                showSlide(start);
            } else {
                showSlide(initIndex);
            }
            const initFragOrder = toSafeInt(msg.currentFragmentOrder ?? msg.currentFragmentIndex);
            if (initFragOrder !== null) applyFragmentProgress(initFragOrder);
            if (msg.whiteboard && typeof msg.whiteboard === 'object') applyWhiteboardSyncMessage(msg.whiteboard);
            else renderStudentWhiteboard();
            H.revision.updateControls();
            updateNavSync();
        }

        // ── Subtitles wiring ─────────────────────────────
        function setPresenterSubtitleActive(active) {
            _subtitlePresenterActive = !!active;
            _updateStudentSubtitleOverlay();
        }
        function setSubtitleText(text) {
            _subtitleLastText = text || '';
            const el = document.getElementById('student-subtitle-text');
            if (el) el.textContent = _subtitleLastText;
        }
        function toggleSubtitles() {
            _subtitleStudentEnabled = !_subtitleStudentEnabled;
            document.getElementById('student-cc-btn')?.classList.toggle('active', _subtitleStudentEnabled);
            document.getElementById('ssp-cc-btn')?.classList.toggle('active', _subtitleStudentEnabled);
            if (_subtitleStudentEnabled && _subtitleLastText) {
                const el = document.getElementById('student-subtitle-text');
                if (el) el.textContent = _subtitleLastText;
            }
            _updateStudentSubtitleOverlay();
        }

        // ── DOM bindings owned by this module ────────────
        function bindControls() {
            const ro = new ResizeObserver(scaleSlide);
            ro.observe(document.getElementById('slide-frame') || document.body);
            window.addEventListener('resize', scaleSlide);

            document.getElementById('student-cc-btn')?.addEventListener('click', toggleSubtitles);
            document.getElementById('ssp-cc-btn')?.addEventListener('click', toggleSubtitles);

            document.getElementById('nav-prev')?.addEventListener('click', () => {
                st.followPresenter = false;
                H.syncRuntime({ followPresenter: false });
                H.revision.showByModeStep(-1);
                updateNavSync();
            });
            document.getElementById('nav-next')?.addEventListener('click', () => {
                if (st.currentIndex >= maxPresenterAllowedIndex()) {
                    H.setConnectionDetail('Vous ne pouvez pas dépasser la slide courante du présentateur', 'warn');
                    return;
                }
                st.followPresenter = false;
                H.syncRuntime({ followPresenter: false });
                H.revision.showByModeStep(1);
                updateNavSync();
            });
            document.getElementById('sfn-prev')?.addEventListener('click', () => document.getElementById('nav-prev')?.click());
            document.getElementById('sfn-next')?.addEventListener('click', () => document.getElementById('nav-next')?.click());

            // #nav-sync — fusion suivi + resynchronisation (audit P2-1)
            const navSyncBtn = document.getElementById('nav-sync');
            if (navSyncBtn) {
                let _lpTimer = null;
                let _lpFired = false;
                const clearLp = () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } };
                navSyncBtn.addEventListener('pointerdown', e => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    _lpFired = false;
                    clearLp();
                    _lpTimer = setTimeout(() => { _lpFired = true; navSyncOpenMenu(); }, 500);
                });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => navSyncBtn.addEventListener(ev, clearLp));
                navSyncBtn.addEventListener('click', e => {
                    if (_lpFired) { _lpFired = false; e.preventDefault(); return; }
                    const menu = document.getElementById('nav-sync-menu');
                    if (menu && !menu.hidden) { navSyncCloseMenu(); return; }
                    if (navSyncBtn.dataset.state === 'rejoin') navSyncRejoin();
                    else navSyncOpenMenu();
                });
                navSyncBtn.addEventListener('contextmenu', e => { e.preventDefault(); navSyncOpenMenu(); });
            }
            document.getElementById('nav-sync-free')?.addEventListener('click', navSyncGoFree);
            updateNavSync();

            document.addEventListener('keydown', e => {
                if (document.getElementById('main-view')?.style.display === 'none') return;
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
                const overlayActive = ['quiz-overlay', 'question-overlay', 'poll-overlay',
                    'wordcloud-overlay', 'exitticket-overlay', 'rankorder-overlay'].some(id => {
                        const el = document.getElementById(id);
                        return el && (el.classList.contains('active') || (el.style.display && el.style.display !== 'none'));
                    });
                if (overlayActive) return;
                if (e.key === 'ArrowLeft') { e.preventDefault(); document.getElementById('nav-prev')?.click(); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('nav-next')?.click(); }
            });

            // Per-slide notes autosave
            const area = document.getElementById('notes-area');
            if (area) {
                _loadSlideNotes(st.currentIndex);
                const indicator = document.getElementById('notes-save-indicator');
                let _noteTimer = null;
                area.addEventListener('input', () => {
                    if (_noteTimer) clearTimeout(_noteTimer);
                    _noteTimer = setTimeout(() => {
                        _saveSlideNotes();
                        if (indicator) { indicator.textContent = 'Sauvegardé ✓'; setTimeout(() => { if (indicator) indicator.textContent = ''; }, 1500); }
                    }, 600);
                });
                const areaSide = document.getElementById('notes-area-side');
                if (areaSide) {
                    let _noteSideTimer = null;
                    areaSide.addEventListener('input', () => {
                        area.value = areaSide.value;
                        if (_noteSideTimer) clearTimeout(_noteSideTimer);
                        _noteSideTimer = setTimeout(() => { _saveSlideNotes(); }, 600);
                    });
                }
            }
            document.getElementById('fab-note')?.addEventListener('click', () => {
                const ta = document.getElementById('notes-area-side');
                if (ta) { ta.focus(); ta.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
            });
            document.getElementById('ssp-notes-export-btn')?.addEventListener('click', () => document.getElementById('notes-export-btn')?.click());
            document.getElementById('notes-export-btn')?.addEventListener('click', e => {
                e.stopPropagation();
                exportNotesPdf();
            });
        }

        // ── Notes PDF export — 1 A4 sheet per slide ──────
        function exportNotesPdf() {
            _saveSlideNotes();
            if (!st.slidesHtml.length) { alert('Aucune slide chargée.'); return; }
            const title = document.getElementById('header-title')?.textContent || 'Présentation';
            const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const rawThemeCSS = document.getElementById('presentation-theme')?.textContent || '';
            const printThemeCSS = rawThemeCSS.replace(/#slide-inner/g, '.slide-inner-print');
            const score = H.quiz.getScore();
            const pages = st.slidesHtml.map((slideHtml, i) => {
                const slideNotes = _notesData[String(i)] || '';
                const notesHtml = slideNotes
                    ? slideNotes.split('\n').map(line =>
                        line.trim() ? `<p>${esc(line)}</p>` : '<p class="print-empty-line"></p>'
                    ).join('')
                    : '<p class="no-note">—</p>';
                return `<div class="slide-page">
  <div class="page-header">
    <span class="slide-num">Slide ${i + 1} / ${st.slidesHtml.length}</span>
    <span class="slide-title-hdr">${esc(title)}</span>
    <span class="student-name">${esc(st.pseudo || 'Étudiant')}</span>
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

            const scoreLine = (score.quizCount > 0 || score.score > 0)
                ? `<div class="cover-score">${score.score > 0 ? `<span>${score.score.toLocaleString()} pts</span>` : ''}${score.quizCount > 0 ? `<span>${score.quizCorrect}/${score.quizCount} quiz</span>` : ''}</div>`
                : '';

            const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Notes — ${esc(title)}</title>
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
  <div class="cover-title">📝 ${esc(title)}</div>
  <div class="cover-meta">${esc(st.pseudo || 'Étudiant')} · ${dateStr}</div>
  ${scoreLine}
</div>
${pages}
<script>
window.addEventListener('load', function() {
  var MM_TO_PX = 96 / 25.4;
  var printableW = (210 - (14 * 2)) * MM_TO_PX;
  var printableH = (297 - (12 * 2)) * MM_TO_PX;

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
        }

        return {
            applyInit,
            applyInitDisplay,
            applyPresenterSlideChange,
            applyPresenterFragment,
            showSlide,
            applyFragmentProgress,
            scaleSlide,
            renderWhiteboard: renderStudentWhiteboard,
            applyWhiteboardSyncMessage,
            applyLaserMessage,
            applyZoomMessage,
            maxPresenterAllowedIndex,
            detectSlides,
            markCheckpointCompleted,
            updateCheckpointStatus,
            updateNavSync,
            rebindCourseStorage,
            currentSlideCheckpointLocked,
            enforceCheckpointBeforeNext,
            getQuizSlides: () => _quizSlides,
            saveSlideNotes: _saveSlideNotes,
            getNotesData: () => _notesData,
            getSlides: () => st.slidesHtml,
            setPresenterSubtitleActive,
            setSubtitleText,
            bindControls,
        };
    }

    root.OEIStudentRender = Object.freeze({ create: createStudentRender });
})(window);
