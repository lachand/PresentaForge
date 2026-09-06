/**
 * @module slides/student-revision
 * Student study aids: bookmarks + spaced-repetition (SM-2) revision deck.
 * Extracted from student-main.js (Lot 20).
 */
(function attachStudentRevision(root) {
    'use strict';

    const REVISION_BUCKETS = /** @type {const} */ (['new', 'review', 'known']);

    /**
     * @param {any} H - student app hub
     */
    function createStudentRevision(H) {
        const st = H.state;
        const storage = H.storage;
        const icon = H.icon;
        const toSafeString = H.toSafeString;
        // Clés lues à la volée : `storage.setCourseKey()` les re-pointe vers
        // l'archive du cours (`oei-v2-student-revise-<courseKey>-*`) après `room:init`.
        const revKey = () => storage.keys.revision;
        const bmKey = () => storage.keys.bookmarks;

        const slideCount = () => (H.render ? H.render.getSlides().length : st.slidesHtml.length);
        const showSlide = idx => H.render.showSlide(idx);

        const revisionWeekKey = (ts = Date.now()) => {
            const d = new Date(ts);
            const day = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - day);
            d.setHours(0, 0, 0, 0);
            return `${d.getFullYear()}-W${String(Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
        };

        let _bookmarks = new Set();
        let _bookmarksOnly = false;
        let _revisionEnabled = false;
        let _revisionWeeklyGoal = 20;
        let _revisionWeeklyProgress = { weekKey: revisionWeekKey(), done: 0 };
        let _revisionStateBySlide = {};
        const _revisionLastSeenAt = new Map();

        /**
         * (Re)charge favoris + état SM-2 + objectif hebdo depuis les clés de
         * stockage courantes. Appelé une fois à la construction, puis à nouveau
         * via `reloadForCourse()` quand le stockage bascule sur l'archive du cours.
         */
        function _hydrate() {
            const raw = storage.localGetJSON(revKey(), {}) || {};
            _bookmarks = new Set((storage.localGetJSON(bmKey(), []) || []).map(v => String(v)));
            _revisionWeeklyGoal = Number.isFinite(Number(raw.weeklyGoal))
                ? Math.max(1, Math.trunc(Number(raw.weeklyGoal))) : 20;
            const wkRaw = raw.weeklyProgress || {};
            _revisionWeeklyProgress = {
                weekKey: toSafeString(wkRaw.weekKey, 20) || revisionWeekKey(),
                done: Number.isFinite(Number(wkRaw.done)) ? Math.max(0, Math.trunc(Number(wkRaw.done))) : 0,
            };
            if (_revisionWeeklyProgress.weekKey !== revisionWeekKey()) {
                _revisionWeeklyProgress = { weekKey: revisionWeekKey(), done: 0 };
            }
            _revisionStateBySlide = {};
            const bySlide = raw && typeof raw === 'object' ? raw.bySlide : null;
            if (bySlide && typeof bySlide === 'object') {
                Object.entries(bySlide).forEach(([idx, item]) => {
                    const slideIdx = Number(idx);
                    if (!Number.isFinite(slideIdx) || slideIdx < 0) return;
                    const bucket = REVISION_BUCKETS.includes(item?.bucket) ? item.bucket : 'new';
                    _revisionStateBySlide[String(slideIdx)] = {
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
            }
        }
        _hydrate();

        /** Re-lit l'état depuis l'archive du cours (après `storage.setCourseKey`). */
        function reloadForCourse() {
            _hydrate();
            _bookmarksOnly = false;
            updateBookmarkControls();
            updateRevisionControls();
        }

        function saveBookmarks() {
            storage.localSetJSON(bmKey(), Array.from(_bookmarks.values()));
        }

        function bookmarksSorted() {
            return Array.from(_bookmarks.values())
                .map(v => Number(v))
                .filter(v => Number.isFinite(v) && v >= 0 && v < slideCount())
                .sort((a, b) => a - b);
        }

        // Répercute un état (classe .active + aria-pressed) sur un bouton et son
        // éventuel proxy desktop (side panel) / mobile (onglet Révision).
        function _reflect(id, active) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('active', active);
            el.setAttribute('aria-pressed', active ? 'true' : 'false');
        }

        function updateBookmarkControls() {
            const key = String(st.currentIndex);
            const marked = _bookmarks.has(key);
            const filterDisabled = _bookmarks.size === 0 && !_bookmarksOnly;
            const filterTitle = _bookmarksOnly ? 'Quitter le mode favoris' : 'Afficher seulement les favoris';
            _reflect('bookmark-btn', marked);
            _reflect('ssp-bookmark-btn', marked);
            _reflect('bookmark-filter-btn', _bookmarksOnly);
            _reflect('ssp-bookmark-filter-btn', _bookmarksOnly);
            ['bookmark-filter-btn', 'ssp-bookmark-filter-btn'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.disabled = filterDisabled;
                el.title = filterTitle;
            });
            ['bookmark-count', 'ssp-bookmark-count'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(_bookmarks.size);
            });
            updateRevisionControls();
        }

        function saveRevisionState() {
            storage.localSetJSON(revKey(), {
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
                    bucket: 'new', seen: 0, nextDue: 0, easiness: 2.5,
                    intervalDays: 0, repetitions: 0, dueAt: 0, lastGrade: 0, updatedAt: 0,
                };
            }
            return _revisionStateBySlide[key];
        }

        function revisionDeck() {
            const set = new Set();
            const count = slideCount();
            _bookmarks.forEach(v => {
                const n = Number(v);
                if (Number.isFinite(n) && n >= 0 && n < count) set.add(n);
            });
            const quizSlides = H.render ? H.render.getQuizSlides() : new Set();
            quizSlides.forEach(i => {
                if (i >= 0 && i < count) set.add(i);
            });
            const arr = Array.from(set.values()).sort((a, b) => a - b);
            if (arr.length) return arr;
            return Array.from({ length: count }, (_, i) => i);
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

        function updateRevisionControls() {
            _reflect('revision-btn', _revisionEnabled);
            _reflect('ssp-revision-btn', _revisionEnabled);

            const bar = document.getElementById('revision-bar');
            if (bar) bar.style.display = _revisionEnabled ? 'flex' : 'none';

            const status = document.getElementById('revision-status');
            const stats = revisionStats();
            if (status) {
                status.innerHTML = `${icon('bookmark_star')}<span>Deck ${stats.total} · Due ${stats.dueNow} · N ${stats.counts.new} · R ${stats.counts.review} · K ${stats.counts.known} · Semaine ${stats.weeklyDone}/${stats.weeklyGoal}</span>`;
            }

            const currentBucket = revisionEntry(st.currentIndex).bucket;
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
                markEasy.classList.toggle('active', currentBucket === 'known' && Number(revisionEntry(st.currentIndex).lastGrade) >= 5);
            }
            if (exportBtn) exportBtn.innerHTML = `${icon('download') || icon('copy')}<span>Export</span>`;
            if (importBtn) importBtn.innerHTML = `${icon('upload') || icon('refresh')}<span>Import</span>`;
            if (exit) exit.innerHTML = `${icon('close')}<span>Quitter</span>`;
        }

        function setRevisionMode(enabled) {
            _revisionEnabled = !!enabled;
            if (_revisionEnabled) {
                st.followPresenter = false;
                H.syncRuntime({ followPresenter: false });
                _bookmarksOnly = false;
                const ordered = revisionOrderedDeck();
                if (ordered.length && !ordered.includes(st.currentIndex)) showSlide(ordered[0]);
            }
            updateBookmarkControls();
            updateRevisionControls();
            H.render.updateNavSync?.();
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
            const entry = revisionEntry(st.currentIndex);
            applyRevisionGrade(entry, quality);
            saveRevisionState();
            updateRevisionControls();
            if (_revisionEnabled && quality >= 3) showRevisionStep(1);
        }

        /**
         * Exporte un bundle de révision **autonome** (porte le deck + favoris +
         * notes + planning SM-2) → transfert vers un autre appareil. Repli sur
         * l'export SM-2 seul si l'archive du cours n'est pas disponible.
         */
        function exportReviseBundle() {
            revisionEnsureWeek();
            saveRevisionState();
            saveBookmarks();
            let payload = null;
            if (typeof storage.buildReviseExport === 'function') payload = storage.buildReviseExport();
            if (!payload) {
                payload = {
                    version: 2,
                    roomId: H.roomId,
                    exportedAt: new Date().toISOString(),
                    weeklyGoal: _revisionWeeklyGoal,
                    weeklyProgress: _revisionWeeklyProgress,
                    bySlide: _revisionStateBySlide,
                };
            }
            const slug = (payload.course && payload.course.title
                ? (window.OEIStudentStorage?.slugify?.(payload.course.title) || 'cours')
                : (storage.courseKey || H.roomId || 'cours'));
            _downloadText(
                JSON.stringify(payload, null, 2),
                `revision-${slug}-${new Date().toISOString().slice(0, 10)}.json`,
            );
        }

        function _downloadText(text, filename, mime = 'application/json') {
            try {
                const blob = new Blob([text], { type: mime });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1500);
            } catch (_) { /* environnement sans Blob/URL : on ignore */ }
        }

        function _revisionToast(msg) {
            const toast = document.getElementById('nudge-toast');
            if (!toast) return;
            toast.textContent = String(msg || '');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3600);
        }

        /** Notes du cours courant en texte brut, groupées par diapo. */
        function _notesPlainText() {
            const raw = storage.localGetJSON(storage.keys.notes, {}) || {};
            const order = Object.keys(raw)
                .map(Number)
                .filter(n => Number.isFinite(n) && n >= 0)
                .sort((a, b) => a - b);
            if (!order.length) return '';
            return order
                .map(i => `— Diapo ${i + 1} —\n${String(raw[String(i)] || '').trim()}`)
                .join('\n\n');
        }

        function _openMailDraft(subject, body) {
            const href = `mailto:?subject=${encodeURIComponent(String(subject || ''))}`
                + `&body=${encodeURIComponent(String(body || '').slice(0, 6000))}`;
            try { location.href = href; } catch (_) {}
        }

        /**
         * « M'envoyer mes notes par e-mail ». Sur mobile : `navigator.share` avec le
         * fichier `.json` en pièce jointe (feuille de partage → Mail). Sinon : télécharge
         * le `.json` et ouvre un brouillon d'e-mail avec le mode d'emploi d'import.
         * Sans deck archivé : envoie au moins les notes en texte.
         */
        async function emailReviseBundle() {
            revisionEnsureWeek();
            saveRevisionState();
            saveBookmarks();

            const archiveTitle = typeof storage.loadReviseArchive === 'function'
                ? (storage.loadReviseArchive()?.meta?.title || '')
                : '';
            const courseTitle = archiveTitle
                || document.getElementById('header-title')?.textContent
                || 'Cours';
            const slug = window.OEIStudentStorage?.slugify?.(courseTitle)
                || storage.courseKey || H.roomId || 'cours';
            const stamp = new Date().toISOString().slice(0, 10);
            const subject = `Mes notes — ${courseTitle}`;
            // URL de cette page (peu importe l'hébergement) pour le mode d'emploi d'import.
            const studentUrl = (() => {
                try {
                    const o = location.origin, p = location.pathname;
                    if (o && o !== 'null' && p) return o + p;
                } catch (_) {}
                return 'student.html';
            })();

            let bundle = null;
            if (typeof storage.buildReviseExport === 'function') bundle = storage.buildReviseExport();

            if (bundle && bundle.deck) {
                const json = JSON.stringify(bundle, null, 2);
                const filename = `revision-${slug}-${stamp}.json`;

                // Feuille de partage native avec la pièce jointe (mobile + Chrome/Edge
                // desktop récents) : « Mail » y reçoit directement le fichier. `mailto:`
                // ne peut PAS porter de pièce jointe — d'où le repli téléchargement.
                try {
                    if (typeof File === 'function' && typeof navigator !== 'undefined' && navigator.canShare) {
                        const file = new File([json], filename, { type: 'application/json' });
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: subject,
                                text: `Mes notes de révision — ${courseTitle}. À rouvrir sur ordinateur : ${studentUrl} → « Importer une révision ».`,
                            });
                            return;
                        }
                    }
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                }

                _downloadText(json, filename);
                _openMailDraft(subject, [
                    `Mes notes de révision — ${courseTitle}.`,
                    '',
                    `Joins à cet e-mail le fichier « ${filename} » qui vient d'être téléchargé.`,
                    '',
                    'Pour les rouvrir sur un ordinateur :',
                    `1. Ouvre ${studentUrl}`,
                    '2. « Importer une révision » → choisis ce fichier.',
                ].join('\n'));
                _revisionToast('Fichier téléchargé — glisse-le en pièce jointe de l\'e-mail.');
                return;
            }

            // Pas encore de deck archivé : au moins les notes en texte.
            _openMailDraft(subject, [
                `Mes notes — ${courseTitle}.`,
                '',
                _notesPlainText() || '(aucune note pour l\'instant)',
            ].join('\n'));
        }

        function importRevisionProgress(rawPayload) {
            if (!rawPayload || typeof rawPayload !== 'object') return false;
            // Bundle autonome « presentaforge-revision » : favoris + notes + SM-2
            // fusionnés dans le cours courant (le deck est déjà chargé).
            if (rawPayload.type === 'presentaforge-revision') {
                if (rawPayload.revision && typeof rawPayload.revision === 'object') {
                    storage.localSetJSON(revKey(), rawPayload.revision);
                }
                if (Array.isArray(rawPayload.bookmarks)) {
                    storage.localSetJSON(bmKey(), rawPayload.bookmarks.map(String));
                }
                if (rawPayload.notes && typeof rawPayload.notes === 'object' && H.render?.rebindCourseStorage) {
                    storage.localSetJSON(storage.keys.notes, rawPayload.notes);
                    H.render.rebindCourseStorage();
                }
                _hydrate();
                revisionEnsureWeek();
                updateBookmarkControls();
                updateRevisionControls();
                return true;
            }
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
            const pos = ordered.indexOf(st.currentIndex);
            if (pos === -1) {
                showSlide(direction > 0 ? ordered[0] : ordered[ordered.length - 1]);
                return;
            }
            const nextPos = (pos + (direction > 0 ? 1 : -1) + ordered.length) % ordered.length;
            showSlide(ordered[nextPos]);
        }

        function showByModeStep(direction) {
            if (!H.render.enforceCheckpointBeforeNext(direction)) return;
            if (_revisionEnabled) {
                showRevisionStep(direction);
                return;
            }
            if (!_bookmarksOnly) {
                showSlide(st.currentIndex + direction);
                return;
            }
            const list = bookmarksSorted();
            if (!list.length) {
                _bookmarksOnly = false;
                updateBookmarkControls();
                showSlide(st.currentIndex + direction);
                return;
            }
            const pos = list.indexOf(st.currentIndex);
            if (pos >= 0) {
                const nextPos = (pos + (direction > 0 ? 1 : -1) + list.length) % list.length;
                showSlide(list[nextPos]);
                return;
            }
            if (direction > 0) {
                const next = list.find(i => i > st.currentIndex);
                showSlide(next !== undefined ? next : list[0]);
                return;
            }
            const prev = [...list].reverse().find(i => i < st.currentIndex);
            showSlide(prev !== undefined ? prev : list[list.length - 1]);
        }

        function noteSeen(target) {
            if (!_revisionEnabled) return;
            const now = Date.now();
            const prevSeen = Number(_revisionLastSeenAt.get(target) || 0);
            if ((now - prevSeen) > 1500) {
                const entry = revisionEntry(target);
                entry.seen = Number(entry.seen || 0) + 1;
                _revisionLastSeenAt.set(target, now);
                saveRevisionState();
            }
        }

        function onFollowToggle(follow) {
            if (follow && _bookmarksOnly) _bookmarksOnly = false;
            if (follow && _revisionEnabled) _revisionEnabled = false;
        }

        function bindControls() {
            // Proxies favoris/révision (side panel desktop + onglet Révision mobile) →
            // relaient vers les boutons fonctionnels #bookmark-btn / #bookmark-filter-btn / #revision-btn.
            document.getElementById('ssp-bookmark-btn')?.addEventListener('click', () => document.getElementById('bookmark-btn')?.click());
            document.getElementById('ssp-bookmark-filter-btn')?.addEventListener('click', () => document.getElementById('bookmark-filter-btn')?.click());
            document.getElementById('ssp-revision-btn')?.addEventListener('click', () => document.getElementById('revision-btn')?.click());

            document.getElementById('bookmark-btn')?.addEventListener('click', () => {
                const key = String(st.currentIndex);
                if (_bookmarks.has(key)) _bookmarks.delete(key);
                else _bookmarks.add(key);
                saveBookmarks();
                if (_bookmarksOnly && !_bookmarks.has(String(st.currentIndex))) {
                    const list = bookmarksSorted();
                    if (list.length) showSlide(list[0]);
                    else _bookmarksOnly = false;
                }
                updateBookmarkControls();
            });
            document.getElementById('bookmark-filter-btn')?.addEventListener('click', () => {
                if (!_bookmarksOnly) {
                    if (_bookmarks.size === 0) return;
                    _bookmarksOnly = true;
                    st.followPresenter = false;
                    H.syncRuntime({ followPresenter: false });
                    if (!_bookmarks.has(String(st.currentIndex))) {
                        const list = bookmarksSorted();
                        if (list.length) showSlide(list[0]);
                    }
                } else {
                    _bookmarksOnly = false;
                }
                updateBookmarkControls();
                H.render.updateNavSync?.();
            });
            document.getElementById('revision-btn')?.addEventListener('click', () => setRevisionMode(!_revisionEnabled));
            document.getElementById('revision-mark-new')?.addEventListener('click', () => markRevision('new'));
            document.getElementById('revision-mark-review')?.addEventListener('click', () => markRevision('review'));
            document.getElementById('revision-mark-known')?.addEventListener('click', () => markRevision('known'));
            document.getElementById('revision-mark-easy')?.addEventListener('click', () => markRevision('easy'));
            document.getElementById('revision-export')?.addEventListener('click', exportReviseBundle);
            document.getElementById('revision-import')?.addEventListener('click', () => {
                document.getElementById('revision-import-file')?.click();
            });
            document.getElementById('revision-import-file')?.addEventListener('change', async e => {
                const file = e?.target?.files?.[0];
                if (!file) return;
                try {
                    const raw = await file.text();
                    const parsed = JSON.parse(raw);
                    if (!importRevisionProgress(parsed)) alert('Fichier de progression invalide.');
                } catch (err) {
                    alert('Import impossible: JSON invalide.');
                } finally {
                    e.target.value = '';
                }
            });
            document.getElementById('revision-exit')?.addEventListener('click', () => setRevisionMode(false));
        }

        return {
            isEnabled: () => _revisionEnabled,
            entry: revisionEntry,
            orderedDeck: revisionOrderedDeck,
            noteSeen,
            onFollowToggle,
            setMode: setRevisionMode,
            showStep: showRevisionStep,
            showByModeStep,
            updateControls: updateRevisionControls,
            updateBookmarkControls,
            reloadForCourse,
            importProgress: importRevisionProgress,
            exportBundle: exportReviseBundle,
            emailBundle: emailReviseBundle,
            bindControls,
        };
    }

    root.OEIStudentRevision = Object.freeze({ create: createStudentRevision });
})(window);
