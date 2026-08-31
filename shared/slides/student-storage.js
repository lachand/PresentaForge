/**
 * @module slides/student-storage
 * Persistence helpers for the student room app (localStorage / sessionStorage),
 * room-scoped storage keys, and pseudo sanitisation.
 * Extracted from student-main.js (Lot 20) — pure, no app state, no DOM.
 */
(function attachStudentStorage(root) {
    'use strict';

    const toSafeString = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);

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

        return {
            localGetJSON,
            localSetJSON,
            sessionGetJSON,
            sessionSetJSON,
            sessionRemove,
            safePseudoPart,
            keys: {
                room: buildRoomKey(roomId),
                score: buildScoreKey(roomId),
                bookmarks: `oei-v1-student-bookmarks-${roomId}`,
                revision: `oei-v1-student-revision-${roomId}`,
                notes: buildNotesKey(roomId),
                reliablePrefix: `oei-v1-student-reliable-${toSafeString(roomId, 80)}-`,
            },
        };
    }

    root.OEIStudentStorage = Object.freeze({ create: createStudentStorage });
})(window);
