/* presenter-supplemental.js — contrôles présentateur additionnels (laser, saut de slide,
   horloge, fin de séance). Extrait de viewer.html (chantier 8 : plus de <script> inline). */
    // ── Presenter supplemental controls (laser, slide jump, clock, etc.) ──
    window.addEventListener('load', function () {

        // ── Clock ──────────────────────────────────────────────────────
        var clockEl = document.getElementById('pv-clock');
        function updateClock() {
            if (!clockEl) return;
            var now = new Date();
            clockEl.textContent =
                String(now.getHours()).padStart(2,'0') + ':' +
                String(now.getMinutes()).padStart(2,'0') + ':' +
                String(now.getSeconds()).padStart(2,'0');
        }
        updateClock();
        setInterval(updateClock, 1000);

        // ── End Show → Analytics modal (or editor if no room) ─────────
        var _pvaEsc = function(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

        var btnEndShow = document.getElementById('pv-btn-end-show');
        if (btnEndShow) {
            btnEndShow.addEventListener('click', function () {
                var room = window._studentRoom || window.__oeiViewerRuntime?.studentRoom;
                var students = room && room.students ? Object.values(room.students) : [];
                if (!room || !room.active || students.length === 0) {
                    document.getElementById('pv-btn-editor')?.click();
                    return;
                }
                _openAnalyticsDashboard(students);
            });
        }

        function renderPvaLeaderboardHtml(students) {
            var sorted = students.slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
            var rows = sorted.map(function(s, i) {
                var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
                var acc = (s.quizCount || 0) > 0 ? ' · ' + Math.round((s.quizCorrect || 0) / s.quizCount * 100) + '% quiz' : '';
                return '<div class="pva-row"><span class="pva-rank">' + _pvaEsc(medal) + '</span>'
                    + '<span class="pva-name">' + _pvaEsc(s.pseudo || 'Anonyme') + '</span>'
                    + '<span class="pva-score">' + _pvaEsc((s.score || 0).toLocaleString('fr-FR') + ' pts' + acc) + '</span></div>';
            }).join('');
            return rows || '<div class="pva-empty">Aucun score enregistré</div>';
        }

        function renderPvaQuestionsHtml(insights) {
            var open = (insights && insights.openQuestions) || [];
            if (!open.length) return '<div class="pva-empty">Aucune question en attente.</div>';
            var groups = {};
            var order = [];
            open.forEach(function(q) {
                var k = q.slideIndex;
                if (!groups[k]) { groups[k] = { title: q.slideTitle, items: [] }; order.push(k); }
                groups[k].items.push(q);
            });
            order.sort(function(a, b) { return a - b; });
            return order.map(function(k) {
                var g = groups[k];
                var items = g.items.map(function(q) {
                    var extra = q.votes > 1 ? ' <span class="pva-q-votes">+' + (q.votes - 1) + '</span>' : '';
                    return '<li>' + _pvaEsc(q.text) + extra + '</li>';
                }).join('');
                return '<div class="pva-q-group"><div class="pva-q-slide"><span class="pva-q-num">S' + (Number(k) + 1) + '</span>'
                    + _pvaEsc(g.title) + '</div><ul class="pva-q-list">' + items + '</ul></div>';
            }).join('');
        }

        function renderPvaHotspotsHtml(insights) {
            if (!insights) return '';
            var hs = (insights && insights.hotspots) || {};
            var block = function(label, rows) {
                if (!rows || !rows.length) return '';
                var lis = rows.map(function(r) {
                    return '<li>' + _pvaEsc(r.title) + ' <span class="pva-hs-c">' + r.count + '</span></li>';
                }).join('');
                return '<div class="pva-hs"><h4>' + _pvaEsc(label) + '</h4><ol>' + lis + '</ol></div>';
            };
            return block('Le plus de questions', hs.questions)
                + block('Le plus de « pas clair »', hs.unclear)
                + block('Le plus de « pas compris »', hs.confused);
        }

        function _openAnalyticsDashboard(students) {
            var modal = document.getElementById('pv-analytics-modal');
            if (!modal) return;

            var bridge = window.OEIPresenterSyncBridge;
            var insights = null;
            try { insights = bridge && bridge.getSessionInsights ? bridge.getSessionInsights() : null; } catch (_) { insights = null; }

            var n = students.length;
            var withScore = students.filter(function(s) { return (s.quizCount || 0) > 0; });
            var totalCorrect = withScore.reduce(function(acc, s) { return acc + (s.quizCorrect || 0); }, 0);
            var totalQ = withScore.reduce(function(acc, s) { return acc + (s.quizCount || 0); }, 0);
            var avgAccuracy = totalQ > 0 ? Math.round(totalCorrect / totalQ * 100) : null;

            document.getElementById('pva-count').textContent = n + ' étudiant' + (n > 1 ? 's' : '') + ' connecté' + (n > 1 ? 's' : '');
            var accBits = [];
            if (avgAccuracy !== null) accBits.push(avgAccuracy + '% de bonnes réponses');
            if (insights && insights.totals) {
                if (insights.totals.questions) accBits.push(insights.totals.questions + ' question' + (insights.totals.questions > 1 ? 's' : ''));
                if (insights.totals.reactions) accBits.push(insights.totals.reactions + ' réaction' + (insights.totals.reactions > 1 ? 's' : ''));
            }
            document.getElementById('pva-accuracy').textContent = accBits.join(' · ') || 'Aucun quiz lancé';

            var qSection = document.getElementById('pva-questions');
            var openCount = insights && insights.openQuestions ? insights.openQuestions.length : 0;
            if (qSection) {
                qSection.hidden = !insights;
                if (insights) {
                    document.getElementById('pva-questions-count').textContent = String(openCount);
                    document.getElementById('pva-questions-list').innerHTML = renderPvaQuestionsHtml(insights);
                }
            }

            var hsSection = document.getElementById('pva-hotspots');
            var hsHtml = renderPvaHotspotsHtml(insights);
            if (hsSection) {
                hsSection.hidden = !hsHtml;
                document.getElementById('pva-hotspots-list').innerHTML = renderPvaHotspotsHtml(insights);
            }

            document.getElementById('pva-leaderboard').innerHTML = renderPvaLeaderboardHtml(students);

            modal.classList.add('is-open');
            modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') _closeAnalyticsDashboard(); }, { once: true });
        }

        function _closeAnalyticsDashboard() {
            var modal = document.getElementById('pv-analytics-modal');
            if (modal) modal.classList.remove('is-open');
        }

        document.getElementById('pva-close')?.addEventListener('click', _closeAnalyticsDashboard);
        document.getElementById('pv-analytics-modal')?.addEventListener('click', function(e) {
            if (e.target === this) _closeAnalyticsDashboard();
        });
        document.getElementById('pva-export-report')?.addEventListener('click', function() {
            var bridge = window.OEIPresenterSyncBridge;
            if (bridge && bridge.downloadSessionReport) {
                try { bridge.downloadSessionReport(); } catch (err) { console.warn('[session-report] export échoué', err); }
            }
        });
        document.getElementById('pva-go-editor')?.addEventListener('click', function() {
            _closeAnalyticsDashboard();
            document.getElementById('pv-btn-editor')?.click();
        });

        // ── Fullscreen quick-action ────────────────────────────────────
        var qaFullscreen = document.getElementById('pv-qa-fullscreen');
        if (qaFullscreen) {
            qaFullscreen.addEventListener('click', function () {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                else document.exitFullscreen?.();
            });
        }

        // ── Laser pointer ───────────────────────────────────────────────
        var laserBtn = document.getElementById('pv-qa-laser');
        var laserDot = document.getElementById('pv-laser-dot');
        var currentFrame = document.getElementById('pv-current-frame');
        var laserActive = false;
        var laserBtnActive = false;  // button held / toggled

        function postLaser(x, y, active) {
            var bridge = window.OEIPresenterSyncBridge;
            if (bridge && bridge.post) {
                bridge.post({ type: 'laser', x: x, y: y, active: active });
            }
            if (bridge && bridge.broadcastLaser) {
                bridge.broadcastLaser(x, y, active);
            }
        }

        function activateLaser() {
            if (laserActive) return;
            laserActive = true;
            if (laserBtn) laserBtn.classList.add('active');
            document.body.style.cursor = 'crosshair';
        }
        function deactivateLaser() {
            if (!laserActive) return;
            laserActive = false;
            laserBtnActive = false;
            if (laserBtn) laserBtn.classList.remove('active');
            if (laserDot) laserDot.style.display = 'none';
            document.body.style.cursor = '';
            postLaser(0, 0, false);
        }

        if (laserBtn && currentFrame && laserDot) {
            // Toggle on click
            laserBtn.addEventListener('click', function () {
                laserBtnActive = !laserBtnActive;
                if (laserBtnActive) activateLaser();
                else deactivateLaser();
            });

            // Track mouse over the presenter slide frame
            currentFrame.addEventListener('mousemove', function (e) {
                if (!laserActive) return;
                // Normalize relative to pv-current-inner (actual slide bounds after scale)
                // so coordinates match what audience and students see
                var inner = document.getElementById('pv-current-inner');
                var refRect = (inner && inner.getBoundingClientRect().width > 8)
                    ? inner.getBoundingClientRect()
                    : currentFrame.getBoundingClientRect();
                var px = Math.max(0, Math.min(1, (e.clientX - refRect.left) / refRect.width));
                var py = Math.max(0, Math.min(1, (e.clientY - refRect.top) / refRect.height));
                // Show fixed-position dot at cursor location
                laserDot.style.display = 'block';
                laserDot.style.left = e.clientX + 'px';
                laserDot.style.top  = e.clientY + 'px';
                // Broadcast normalized coords to audience and students
                postLaser(px, py, true);
            });

            currentFrame.addEventListener('mouseleave', function () {
                if (!laserActive) return;
                if (laserDot) laserDot.style.display = 'none';
                postLaser(0, 0, false);
            });

            // Escape deactivates laser
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && laserActive) deactivateLaser();
            });
        }

        // ── Zoom ────────────────────────────────────────────────────────
        var zoomBtn = document.getElementById('pv-qa-zoom');
        var zoomActive = false;
        var zoomLevel = 2;
        var zoomNx = 0.5, zoomNy = 0.5;

        function postZoom(active, x, y, scale) {
            var bridge = window.OEIPresenterSyncBridge;
            if (bridge && bridge.post) bridge.post({ type: 'zoom', active: active, x: x, y: y, scale: scale });
            if (bridge && bridge.broadcastZoom) bridge.broadcastZoom(active, x, y, scale);
        }

        function applyPresenterZoom() {
            if (!currentFrame) return;
            if (zoomActive) {
                currentFrame.style.transform = 'scale(' + zoomLevel + ')';
                currentFrame.style.transformOrigin = (zoomNx * 100) + '% ' + (zoomNy * 100) + '%';
            } else {
                currentFrame.style.transform = '';
                currentFrame.style.transformOrigin = '';
            }
        }

        function activateZoom(nx, ny) {
            zoomActive = true;
            zoomNx = typeof nx === 'number' ? Math.max(0, Math.min(1, nx)) : 0.5;
            zoomNy = typeof ny === 'number' ? Math.max(0, Math.min(1, ny)) : 0.5;
            if (zoomBtn) zoomBtn.classList.add('active');
            applyPresenterZoom();
            postZoom(true, zoomNx, zoomNy, zoomLevel);
        }

        function deactivateZoom() {
            if (!zoomActive) return;
            zoomActive = false;
            zoomLevel = 2;
            if (zoomBtn) zoomBtn.classList.remove('active');
            applyPresenterZoom();
            postZoom(false, 0.5, 0.5, 1);
        }

        if (zoomBtn) {
            zoomBtn.addEventListener('click', function () {
                if (zoomActive) deactivateZoom();
                else activateZoom(0.5, 0.5);
            });
        }

        if (currentFrame) {
            currentFrame.addEventListener('click', function (e) {
                if (!zoomActive) return;
                var inner = document.getElementById('pv-current-inner');
                var refRect = (inner && inner.getBoundingClientRect().width > 8)
                    ? inner.getBoundingClientRect()
                    : currentFrame.getBoundingClientRect();
                var nx = Math.max(0, Math.min(1, (e.clientX - refRect.left) / refRect.width));
                var ny = Math.max(0, Math.min(1, (e.clientY - refRect.top) / refRect.height));
                activateZoom(nx, ny);
            });

            currentFrame.addEventListener('wheel', function (e) {
                if (!zoomActive) return;
                e.preventDefault();
                zoomLevel = Math.max(1.2, Math.min(5, zoomLevel - e.deltaY * 0.005));
                applyPresenterZoom();
                postZoom(true, zoomNx, zoomNy, zoomLevel);
            }, { passive: false });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && zoomActive) deactivateZoom();
            if (e.key === 'z' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                var tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                if (zoomActive) deactivateZoom();
                else activateZoom(0.5, 0.5);
            }
        });

        // ── Slide overview grid ──────────────────────────────────────────
        var qaOverview  = document.getElementById('pv-qa-overview');
        var jumpOverlay = document.getElementById('pv-slide-jump');
        var jumpInput   = document.getElementById('pv-jump-input');
        var jumpGrid    = document.getElementById('pv-jump-grid');
        var jumpCount   = document.getElementById('pv-jump-count');
        var jumpClose   = document.getElementById('pv-jump-close');

        // Scale factor for thumbnail (1280→160px)
        var THUMB_W = 160, THUMB_H = 90, THUMB_SCALE = THUMB_W / 1280;

        function _makeThumbCard(slide, i, currentIdx) {
            var title = (slide.title || '').replace(/<[^>]*>/g, '').trim() || ('Slide ' + (i + 1));
            var isCurrent = (i === currentIdx);
            var card = document.createElement('button');
            card.type = 'button';
            card.dataset.idx = String(i);
            card.dataset.title = title.toLowerCase();
            card.className = 'pv-jump-card' + (isCurrent ? ' is-current' : '');

            // Thumbnail frame
            var frame = document.createElement('div');
            frame.className = 'pv-jump-card-frame';

            // Render slide HTML via SlidesRenderer if available
            var rendered = typeof window.SlidesRenderer?.renderSlide === 'function'
                ? window.SlidesRenderer.renderSlide(slide, i, {})
                : null;
            if (rendered) {
                var inner = document.createElement('div');
                inner.style.cssText = 'width:1280px;height:720px;transform-origin:top left;transform:scale(' + THUMB_SCALE + ');pointer-events:none;overflow:hidden;';
                inner.innerHTML = rendered;
                frame.appendChild(inner);
            } else {
                frame.style.display = 'flex';
                frame.style.alignItems = 'center';
                frame.style.justifyContent = 'center';
                frame.innerHTML = '<span style="font-family:Manrope,sans-serif;font-size:1.5rem;font-weight:700;color:#c1c7d2;">' + (i + 1) + '</span>';
            }

            // Number badge
            var badge = document.createElement('div');
            badge.className = 'pv-jump-card-badge';
            badge.textContent = String(i + 1);
            frame.appendChild(badge);

            // Title
            var titleEl = document.createElement('div');
            titleEl.className = 'pv-jump-card-title';
            titleEl.title = title;
            titleEl.textContent = title;

            card.appendChild(frame);
            card.appendChild(titleEl);

            card.addEventListener('click', function () {
                window.OEIPresenterSyncBridge?.goTo(i);
                closeSlideJump();
            });
            return card;
        }

        function openSlideJump() {
            if (!jumpOverlay || !jumpGrid) return;
            var bridge = window.OEIPresenterSyncBridge;
            var slides = bridge?.getSlides?.() || [];
            var currentIdx = bridge?.getCurrentIndex?.() ?? (window.ViewerRuntime?.presenterCurrentIndex ?? -1);
            jumpGrid.innerHTML = '';
            if (jumpInput) jumpInput.value = '';
            if (jumpCount) jumpCount.textContent = slides.length + ' slide' + (slides.length > 1 ? 's' : '');
            slides.forEach(function (slide, i) {
                jumpGrid.appendChild(_makeThumbCard(slide, i, currentIdx));
            });
            jumpOverlay.classList.add('is-open');
            setTimeout(function () {
                if (jumpInput) jumpInput.focus();
                // Scroll current slide into view
                var cur = jumpGrid.querySelector('[data-idx="' + currentIdx + '"]');
                if (cur) cur.scrollIntoView({ block: 'nearest' });
            }, 50);
        }
        function closeSlideJump() {
            if (jumpOverlay) jumpOverlay.classList.remove('is-open');
        }

        if (jumpInput) {
            jumpInput.addEventListener('input', function () {
                var val = jumpInput.value.trim().toLowerCase();
                Array.from(jumpGrid?.children || []).forEach(function (card) {
                    var title = card.dataset.title || '';
                    var num = card.dataset.idx ? String(parseInt(card.dataset.idx, 10) + 1) : '';
                    card.style.display = (!val || num.startsWith(val) || title.includes(val)) ? '' : 'none';
                });
            });
            jumpInput.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeSlideJump();
            });
        }
        if (jumpClose) jumpClose.addEventListener('click', closeSlideJump);
        if (jumpOverlay) {
            jumpOverlay.addEventListener('click', function (e) {
                if (e.target === jumpOverlay) closeSlideJump();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && jumpOverlay?.classList.contains('is-open')) closeSlideJump();
        });
        if (qaOverview) {
            qaOverview.addEventListener('click', openSlideJump);
        }
    });
    
