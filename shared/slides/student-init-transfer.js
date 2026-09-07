/**
 * @module slides/student-init-transfer
 * Réassemblage d'un `room:init` découpé (INIT_BEGIN + N × INIT_CHUNK). Vérifie la
 * longueur + le checksum FNV-1a, redemande les tranches manquantes via INIT_NACK,
 * puis rejoue le corps du `case ROOM_MSG.INIT` via H.applyAssembledInit().
 *
 * Cause : les decks avec images base64 dépassent la taille livrable d'un message
 * PeerJS unique — ils arrivent tronqués ou pas du tout, les étudiants ne se
 * synchronisent jamais.
 */
(function attachStudentInitTransfer(root) {
    'use strict';

    const TIMEOUT_MS = 15000;       // relance NACK si le flux se tarit
    const GAP_NACK_MS = 1200;       // relance NACK après un trou dans la séquence
    const MAX_NACK_ROUNDS = 8;

    // setTimeout renvoie un objet Timeout sous Node (tests), un nombre en navigateur.
    const _later = (fn, ms) => {
        const t = setTimeout(fn, ms);
        if (t && typeof t.unref === 'function') t.unref();
        return t;
    };

    /**
     * @param {any} H - student app hub
     */
    function createStudentInitTransfer(H) {
        const ROOM_MSG = H.ROOM_MSG;
        const fnv1a32 = (root.OEIRealtimeContract && typeof root.OEIRealtimeContract.fnv1a32 === 'function')
            ? root.OEIRealtimeContract.fnv1a32
            : (() => 0);

        /** @type {null | { initId, n, len, checksum, meta, buf: string[], got: number, timer, gapTimer, rounds: number }} */
        let pending = null;

        function _clearTimers() {
            if (!pending) return;
            if (pending.timer) { clearTimeout(pending.timer); pending.timer = null; }
            if (pending.gapTimer) { clearTimeout(pending.gapTimer); pending.gapTimer = null; }
        }

        function reset() {
            _clearTimers();
            pending = null;
        }

        function _progress(pct) {
            if (typeof H.setJoinStatus === 'function') {
                H.setJoinStatus(`Réception de la présentation… ${pct} %`, 'info');
            }
        }

        function _missingIndices() {
            const out = [];
            if (!pending) return out;
            for (let i = 0; i < pending.n; i++) {
                if (typeof pending.buf[i] !== 'string') out.push(i);
            }
            return out;
        }

        function _requestMissing(reason) {
            if (!pending) return;
            const missing = _missingIndices();
            if (!missing.length) { _finish(); return; }
            pending.rounds += 1;
            if (pending.rounds > MAX_NACK_ROUNDS) { _fail(reason || 'pertes'); return; }
            if (typeof H.transport?.send === 'function') {
                H.transport.send({ type: ROOM_MSG.INIT_NACK, initId: pending.initId, missing: missing.slice(0, 4000) });
            }
            _clearTimers();
            pending.timer = _later(() => _requestMissing('timeout'), TIMEOUT_MS);
        }

        function _finish() {
            if (!pending) return true;
            const json = pending.buf.join('');
            if (json.length !== pending.len || fnv1a32(json) !== pending.checksum) {
                // Corruption : on repart de zéro et on redemande tout.
                pending.buf = new Array(pending.n);
                pending.got = 0;
                pending.rounds += 1;
                if (pending.rounds > MAX_NACK_ROUNDS) { _fail('checksum'); return true; }
                _requestMissing('checksum');
                return true;
            }
            let msg = null;
            try { msg = JSON.parse(json); } catch (_) { msg = null; }
            if (!msg || typeof msg !== 'object') { _fail('json'); return true; }
            msg.type = ROOM_MSG.INIT;
            if (msg.title == null && pending.meta.title) msg.title = pending.meta.title;
            reset();
            if (typeof H.applyAssembledInit === 'function') H.applyAssembledInit(msg);
            return true;
        }

        function _fail(why) {
            reset();
            if (typeof H.setJoinStatus === 'function') {
                H.setJoinStatus('Réception de la présentation impossible — réessai en cours…', 'error');
            }
            if (typeof H.onInitTransferFailed === 'function') H.onInitTransferFailed(why);
        }

        function handleBegin(msg) {
            if (!msg || typeof msg.initId !== 'string' || !Number.isInteger(msg.n)) return false;
            reset();
            pending = {
                initId: msg.initId,
                n: msg.n,
                len: Number(msg.len) || 0,
                checksum: (Number(msg.checksum) >>> 0),
                meta: {
                    title: msg.title || '',
                    slideCount: msg.slideCount || 0,
                    currentIndex: msg.currentIndex || 0,
                    currentFragmentOrder: (msg.currentFragmentOrder == null ? -1 : msg.currentFragmentOrder),
                },
                buf: new Array(msg.n),
                got: 0,
                timer: null,
                gapTimer: null,
                rounds: 0,
            };
            _progress(0);
            if (msg.n === 0) { _finish(); return true; }
            pending.timer = _later(() => _requestMissing('timeout'), TIMEOUT_MS);
            return true;
        }

        function handleChunk(msg) {
            if (!pending || !msg || msg.initId !== pending.initId) return false;
            const i = msg.i;
            if (Number.isInteger(i) && i >= 0 && i < pending.n && typeof pending.buf[i] !== 'string') {
                pending.buf[i] = String(msg.s == null ? '' : msg.s);
                pending.got += 1;
            }
            _progress(Math.min(100, Math.round((pending.got / pending.n) * 100)));
            if (pending.got >= pending.n) return _finish();
            // Relance ciblée si un trou traîne (chunk sauté, jamais renvoyé spontanément).
            if (pending.gapTimer) clearTimeout(pending.gapTimer);
            pending.gapTimer = _later(() => _requestMissing('gap'), GAP_NACK_MS);
            return true;
        }

        function isActive() { return !!pending; }

        return { handleBegin, handleChunk, isActive, reset };
    }

    root.OEIStudentInitTransfer = Object.freeze({ create: createStudentInitTransfer });
})(typeof window !== 'undefined' ? window : globalThis);
