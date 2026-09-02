/**
 * @module slides/student-storage
 * Persistence helpers for the student room app (localStorage / sessionStorage),
 * room-scoped storage keys, pseudo sanitisation, and the **revision archive** —
 * a per-course local snapshot (deck + bookmarks + notes + SM-2 state) keyed by a
 * stable `courseKey` derived from the deck, so students can revise after the CM
 * even once the live room is closed. Extracted from student-main.js (Lot 20).
 * Pure : no app state, no DOM.
 */
(function attachStudentStorage(root) {
    'use strict';

    const toSafeString = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);

    const REVISE_PREFIX = 'oei-v2-student-revise-';
    const REVISE_INDEX_KEY = `${REVISE_PREFIX}index`;
    const REVISE_INDEX_CAP = 8;
    const DECK_MAX_BYTES = 2_000_000;

    /**
     * Slugify a free-text string for use inside a storage key / URL param.
     * @param {string} str
     * @param {number} [maxLen=60]
     * @returns {string} lowercase `[a-z0-9-]` slug (may be empty)
     */
    function slugify(str, maxLen = 60) {
        return String(str == null ? '' : str)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, maxLen)
            .replace(/-+$/g, '');
    }

    /**
     * Deterministic FNV-1a 32-bit hash, base36-encoded.
     * @param {string} str
     * @returns {string}
     */
    function hashString(str) {
        let h = 0x811c9dc5;
        const s = String(str == null ? '' : str);
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return h.toString(36);
    }

    /**
     * Stable identity of a deck for revision archiving. Same title but different
     * author / slide count ⇒ different key (separate archives). An exact match
     * (title + author + slide count) collapses to one archive (best effort).
     * @param {any} deck - deck payload (`{ metadata, slides }`)
     * @returns {string}
     */
    function courseKeyFromDeck(deck) {
        const md = (deck && typeof deck === 'object' && deck.metadata && typeof deck.metadata === 'object')
            ? deck.metadata : {};
        const title = slugify(md.title || '', 60) || 'sans-titre';
        const author = slugify(md.author || '', 24);
        const slideCount = Array.isArray(deck && deck.slides) ? deck.slides.length : 0;
        return `${title}-${hashString(`${title}|${author}|${slideCount}`)}`;
    }

    /**
     * @param {{ roomId?: string }} [options]
     */
    function createStudentStorage(options = {}) {
        const Storage = root.OEIStorage || null;
        const roomId = toSafeString(options.roomId, 200);

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
        const localRemove = key => {
            if (!key) return false;
            if (typeof Storage?.remove === 'function') { Storage.remove(key); return true; }
            try { localStorage.removeItem(key); return true; } catch (e) { return false; }
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

        const safePseudoPart = name => {
            const safe = toSafeString(name, 40)
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
            return safe || 'anon';
        };

        // ── Revision archive (per-course, keyed by courseKey) ─────────────
        const _reviseKeys = ck => {
            const base = `${REVISE_PREFIX}${ck}`;
            return { deck: `${base}-deck`, revision: `${base}-revision`, bookmarks: `${base}-bookmarks`, notes: `${base}-notes` };
        };

        const _readIndex = () => {
            const raw = localGetJSON(REVISE_INDEX_KEY, []);
            return Array.isArray(raw) ? raw.filter(e => e && typeof e.courseKey === 'string') : [];
        };
        const _writeIndex = list => localSetJSON(REVISE_INDEX_KEY, list);

        const _deleteArchiveKeys = ck => {
            const k = _reviseKeys(ck);
            localRemove(k.deck); localRemove(k.revision); localRemove(k.bookmarks); localRemove(k.notes);
        };

        const _upsertIndex = entry => {
            let list = _readIndex().filter(e => e.courseKey !== entry.courseKey);
            list.unshift(entry);
            list.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
            if (list.length > REVISE_INDEX_CAP) {
                list.slice(REVISE_INDEX_CAP).forEach(e => _deleteArchiveKeys(e.courseKey));
                list = list.slice(0, REVISE_INDEX_CAP);
            }
            _writeIndex(list);
        };

        const _purgeLeastRecent = exceptCourseKey => {
            const list = _readIndex()
                .filter(e => e.courseKey !== exceptCourseKey)
                .sort((a, b) => (Number(a.updatedAt) || 0) - (Number(b.updatedAt) || 0));
            const victim = list[0];
            if (!victim) return false;
            _deleteArchiveKeys(victim.courseKey);
            _writeIndex(_readIndex().filter(e => e.courseKey !== victim.courseKey));
            return true;
        };

        const _seedIfEmpty = (dstKey, srcKey) => {
            if (!dstKey || !srcKey || dstKey === srcKey) return;
            if (localGetJSON(dstKey, null) != null) return;
            const src = localGetJSON(srcKey, null);
            if (src != null) localSetJSON(dstKey, src);
        };

        const _dueFromRevision = (revision, slideCount) => {
            const bySlide = revision && typeof revision === 'object' ? revision.bySlide : null;
            if (!bySlide || typeof bySlide !== 'object') return Math.max(0, Number(slideCount) || 0);
            const now = Date.now();
            let due = 0;
            Object.values(bySlide).forEach(entry => {
                if (!entry || typeof entry !== 'object') return;
                const at = Number(entry.dueAt || entry.nextDue || 0) || 0;
                if (entry.bucket === 'new' || at <= now) due += 1;
            });
            return due;
        };

        const instance = {
            localGetJSON,
            localSetJSON,
            localRemove,
            sessionGetJSON,
            sessionSetJSON,
            sessionRemove,
            safePseudoPart,
            courseKey: null,
            keys: {
                room: buildRoomKey(roomId),
                score: buildScoreKey(roomId),
                bookmarks: `oei-v1-student-bookmarks-${roomId}`,
                revision: `oei-v1-student-revision-${roomId}`,
                notes: buildNotesKey(roomId),
                reliablePrefix: `oei-v1-student-reliable-${toSafeString(roomId, 80)}-`,
            },

            /**
             * Re-point bookmarks / revision / notes storage to the per-course
             * archive keys. One-shot best-effort migration seeds them from the
             * legacy roomId-scoped keys on first contact with a course.
             * @param {string} ck - courseKey
             */
            setCourseKey(ck) {
                const safe = toSafeString(ck, 120);
                if (!safe) return;
                this.courseKey = safe;
                const k = _reviseKeys(safe);
                const prev = { bm: this.keys.bookmarks, rv: this.keys.revision, nt: this.keys.notes };
                this.keys.bookmarks = k.bookmarks;
                this.keys.revision = k.revision;
                this.keys.notes = k.notes;
                this.keys.reviseDeck = k.deck;
                this.keys.reviseIndex = REVISE_INDEX_KEY;
                if (localGetJSON(k.deck, null) == null) {
                    _seedIfEmpty(k.bookmarks, prev.bm);
                    _seedIfEmpty(k.revision, prev.rv);
                    _seedIfEmpty(k.notes, prev.nt);
                }
            },

            /**
             * Persist the deck + meta for the current course into its archive,
             * and refresh the archive index (MRU, capped).
             * @param {{ deck:any, meta:{ title?:string, author?:string, slideCount?:number, roomId?:string } }} payload
             * @returns {{ ok:boolean, reason?:string }}
             */
            saveReviseArchive(payload) {
                const ck = this.courseKey;
                if (!ck) return { ok: false, reason: 'no-course-key' };
                const deck = payload && payload.deck;
                if (!deck || !Array.isArray(deck.slides)) return { ok: false, reason: 'no-deck' };
                let serialized;
                try { serialized = JSON.stringify(deck); } catch (e) { return { ok: false, reason: 'serialize' }; }
                if (serialized.length > DECK_MAX_BYTES) return { ok: false, reason: 'deck-too-large' };

                const k = _reviseKeys(ck);
                const existing = localGetJSON(k.deck, null);
                const meta = payload.meta || {};
                const now = Date.now();
                const record = {
                    deck,
                    meta: {
                        title: toSafeString(meta.title, 200) || 'Présentation',
                        author: toSafeString(meta.author, 120),
                        slideCount: Number.isFinite(Number(meta.slideCount)) ? Math.max(0, Math.trunc(Number(meta.slideCount))) : deck.slides.length,
                        roomId: toSafeString(meta.roomId, 200),
                        firstSeenAt: (existing && existing.meta && Number(existing.meta.firstSeenAt)) || now,
                        updatedAt: now,
                    },
                };
                if (!localSetJSON(k.deck, record)) {
                    _purgeLeastRecent(ck);
                    if (!localSetJSON(k.deck, record)) return { ok: false, reason: 'quota' };
                }
                _upsertIndex({
                    courseKey: ck,
                    title: record.meta.title,
                    author: record.meta.author,
                    slideCount: record.meta.slideCount,
                    updatedAt: now,
                });
                return { ok: true };
            },

            /**
             * @param {string} [ck] - courseKey (defaults to the current one)
             * @returns {{ deck:any, meta:object } | null}
             */
            loadReviseArchive(ck) {
                const key = ck ? _reviseKeys(ck).deck : this.keys.reviseDeck;
                const rec = key ? localGetJSON(key, null) : null;
                return (rec && rec.deck && Array.isArray(rec.deck.slides)) ? rec : null;
            },

            /** @returns {Array<{courseKey,title,author,slideCount,updatedAt}>} MRU order */
            listReviseArchives() {
                return _readIndex().filter(e => localGetJSON(_reviseKeys(e.courseKey).deck, null) != null);
            },

            /** @param {string} ck - courseKey */
            deleteReviseArchive(ck) {
                _deleteArchiveKeys(ck);
                _writeIndex(_readIndex().filter(e => e.courseKey !== ck));
            },

            /**
             * SM-2 cards due today for a course (bucket "new" or past due). Falls
             * back to slideCount when no revision state exists yet.
             * @param {string} ck - courseKey
             * @returns {number}
             */
            reviseDueCount(ck) {
                const k = _reviseKeys(ck);
                const revision = localGetJSON(k.revision, null);
                const idxEntry = _readIndex().find(e => e.courseKey === ck);
                const deckRec = localGetJSON(k.deck, null);
                const slideCount = (idxEntry && idxEntry.slideCount) || (deckRec && deckRec.meta && deckRec.meta.slideCount) || 0;
                return _dueFromRevision(revision, slideCount);
            },

            /**
             * Serialize the current course's archive into a self-contained,
             * shareable bundle (carries the deck).
             * @param {string} [ck] - courseKey (defaults to current)
             * @returns {object | null}
             */
            buildReviseExport(ck) {
                const key = ck || this.courseKey;
                if (!key) return null;
                const k = _reviseKeys(key);
                const rec = localGetJSON(k.deck, null);
                if (!rec || !rec.deck) return null;
                return {
                    type: 'presentaforge-revision',
                    v: 1,
                    exportedAt: new Date().toISOString(),
                    course: {
                        title: rec.meta.title,
                        author: rec.meta.author,
                        slideCount: rec.meta.slideCount,
                    },
                    deck: rec.deck,
                    bookmarks: localGetJSON(k.bookmarks, []) || [],
                    notes: localGetJSON(k.notes, {}) || {},
                    revision: localGetJSON(k.revision, {}) || {},
                };
            },

            /**
             * Import a `presentaforge-revision` bundle : creates/replaces the
             * archive for its deck and points the instance at it. v1 = replace.
             * @param {any} payload - parsed file content
             * @returns {{ ok:boolean, courseKey?:string, reason?:string }}
             */
            importReviseFile(payload) {
                if (!payload || typeof payload !== 'object') return { ok: false, reason: 'invalid' };
                if (payload.type !== 'presentaforge-revision') return { ok: false, reason: 'no-deck' };
                const deck = payload.deck;
                if (!deck || !Array.isArray(deck.slides)) return { ok: false, reason: 'no-deck' };
                const ck = courseKeyFromDeck(deck);
                this.setCourseKey(ck);
                const course = (payload.course && typeof payload.course === 'object') ? payload.course : {};
                const res = this.saveReviseArchive({
                    deck,
                    meta: { title: course.title || deck.metadata?.title, author: course.author || deck.metadata?.author, slideCount: deck.slides.length, roomId: '' },
                });
                if (!res.ok) return { ok: false, reason: res.reason };
                const k = _reviseKeys(ck);
                if (payload.revision && typeof payload.revision === 'object') localSetJSON(k.revision, payload.revision);
                if (Array.isArray(payload.bookmarks)) localSetJSON(k.bookmarks, payload.bookmarks.map(String));
                if (payload.notes && typeof payload.notes === 'object') localSetJSON(k.notes, payload.notes);
                return { ok: true, courseKey: ck };
            },
        };
        return instance;
    }

    root.OEIStudentStorage = Object.freeze({
        create: createStudentStorage,
        courseKeyFromDeck,
        slugify,
        hashString,
    });
})(window);
