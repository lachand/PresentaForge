/* remote-main.js — application « télécommande » (remote.html).
   Extrait de remote.html (chantier 8 : plus de <script> inline → CSP script-src 'self'). */
    (function() {
        'use strict';

        const RealtimeContract = window.OEIRealtimeContract || {};
        const NetworkSession = window.OEINetworkSession || {};
        const ROOM_MSG = RealtimeContract.ROOM_MSG;
        const validateRoomMessage = typeof RealtimeContract.validateRoomMessage === 'function'
            ? RealtimeContract.validateRoomMessage
            : (() => true);
        if (!ROOM_MSG) {
            throw new Error('OEIRealtimeContract indisponible: impossible de démarrer le contrôle distant.');
        }

        const qs = new URLSearchParams(location.search);
        const readPeerJSON = (key, fallback = null) => {
            if (!key) return fallback;
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return fallback;
                return JSON.parse(raw);
            } catch (e) {
                return fallback;
            }
        };
        const PEER_OPTIONS = typeof NetworkSession.buildPeerOptions === 'function'
            ? NetworkSession.buildPeerOptions(qs, readPeerJSON, window.OEI_PEER_OPTIONS)
            : { debug: 0 };
        const roomFromUrl = (qs.get('room') || '').trim();
        const autoConnect = qs.get('auto') === '1';
        if (roomFromUrl) document.getElementById('remote-room').value = roomFromUrl;

        const statusEl = document.getElementById('remote-status');
        const sessionEl = document.getElementById('remote-session');
        const connectBtn = document.getElementById('remote-connect');
        const authBtn = document.getElementById('remote-auth');
        const gotoBtn = document.getElementById('remote-goto-btn');
        const cmdButtons = Array.from(document.querySelectorAll('[data-cmd]'));

        let peer = null;
        let conn = null;
        let token = '';
        let tokenExpiresAt = 0;
        let challenge = null;
        let clientNonce = '';

        const enc = new TextEncoder();
        const toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        const fromBase64Url = value => {
            const b64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
            const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
            const bin = atob(padded);
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        };
        const randomToken = (size = 18) => {
            const bytes = new Uint8Array(size);
            crypto.getRandomValues(bytes);
            return toBase64Url(bytes);
        };
        const bytesToHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const sha256Hex = async value => {
            const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value || '')));
            return bytesToHex(new Uint8Array(digest));
        };
        const deriveHashHex = async (password, saltToken, iterations) => {
            const key = await crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({
                name: 'PBKDF2',
                hash: 'SHA-256',
                salt: fromBase64Url(saltToken),
                iterations: Math.max(10000, Number(iterations) || 120000),
            }, key, 256);
            return bytesToHex(new Uint8Array(bits));
        };

        function setStatus(text, tone) {
            statusEl.textContent = String(text || '');
            statusEl.className = `remote-status ${tone || ''}`.trim();
        }

        function updateControls() {
            const now = Date.now();
            const authed = !!token && tokenExpiresAt > now && conn && conn.open;
            cmdButtons.forEach(btn => btn.disabled = !authed);
            gotoBtn.disabled = !authed;
            authBtn.disabled = !conn || !conn.open || !challenge;
            if (!authed) {
                sessionEl.textContent = '';
                return;
            }
            const secLeft = Math.max(0, Math.round((tokenExpiresAt - now) / 1000));
            sessionEl.textContent = `Session active (${secLeft}s restantes)`;
        }

        async function authenticate() {
            if (!challenge || !conn || !conn.open) {
                setStatus('Aucun challenge actif. Reconnectez-vous.', 'warn');
                return;
            }
            const password = document.getElementById('remote-password').value.trim();
            if (password.length < 8) {
                setStatus('Mot de passe trop court (8 caractères min).', 'error');
                return;
            }
            setStatus('Vérification du mot de passe…', 'warn');
            try {
                const hash = await deriveHashHex(password, challenge.salt, challenge.iterations);
                const proof = await sha256Hex(`${challenge.challengeId}:${clientNonce}:${challenge.serverNonce}:${hash}`);
                conn.send({
                    type: ROOM_MSG.REMOTE_AUTH_PROOF,
                    challengeId: challenge.challengeId,
                    clientNonce,
                    proof,
                });
            } catch (err) {
                setStatus(`Erreur crypto: ${err.message || err}`, 'error');
            }
        }

        function closeConnection() {
            token = '';
            tokenExpiresAt = 0;
            challenge = null;
            if (conn) { try { conn.close(); } catch (e) {} }
            conn = null;
            if (peer) { try { peer.destroy(); } catch (e) {} }
            peer = null;
            updateControls();
        }

        function connectRoom() {
            const roomId = document.getElementById('remote-room').value.trim()
                .replace(/[^a-zA-Z0-9\-_]/g, '-')
                .replace(/-{2,}/g, '-')
                .slice(0, 40);
            if (!roomId) {
                setStatus('ID de salle invalide.', 'error');
                return;
            }
            document.getElementById('remote-room').value = roomId;
            qs.set('room', roomId);
            history.replaceState(null, '', `${location.pathname}?${qs.toString()}`);

            closeConnection();
            setStatus('Connexion à la salle…', 'warn');
            connectBtn.disabled = true;

            peer = new Peer(undefined, PEER_OPTIONS);
            peer.on('open', () => {
                conn = peer.connect(roomId, { reliable: true });
                conn.on('open', () => {
                    clientNonce = randomToken(16);
                    conn.send({ type: ROOM_MSG.REMOTE_HELLO, clientNonce, device: 'mobile' });
                    setStatus('Connecté. En attente du challenge…', 'warn');
                    connectBtn.disabled = false;
                    updateControls();
                });
                conn.on('data', msg => {
                    if (!msg || typeof msg !== 'object') return;
                    if (!validateRoomMessage(msg)) return;
                    switch (msg.type) {
                        case ROOM_MSG.REMOTE_AUTH_CHALLENGE:
                            challenge = {
                                challengeId: String(msg.challengeId || ''),
                                serverNonce: String(msg.serverNonce || ''),
                                salt: String(msg.salt || ''),
                                iterations: Number(msg.iterations) || 120000,
                            };
                            setStatus('Challenge reçu. Authentification…', 'warn');
                            updateControls();
                            authenticate();
                            break;
                        case ROOM_MSG.REMOTE_AUTH_OK:
                            token = String(msg.token || '');
                            tokenExpiresAt = Number(msg.expiresAt) || (Date.now() + 600000);
                            challenge = null;
                            setStatus('Contrôle mobile authentifié.', 'ok');
                            updateControls();
                            break;
                        case ROOM_MSG.REMOTE_AUTH_ERROR:
                            token = '';
                            tokenExpiresAt = 0;
                            setStatus(msg.reason || 'Authentification refusée.', 'error');
                            updateControls();
                            break;
                        case ROOM_MSG.REMOTE_COMMAND_ACK:
                            setStatus(msg.ok ? 'Commande envoyée.' : (msg.reason || 'Commande refusée.'), msg.ok ? 'ok' : 'warn');
                            break;
                        case ROOM_MSG.REMOTE_REVOKED:
                            token = '';
                            tokenExpiresAt = 0;
                            challenge = null;
                            setStatus(msg.reason || 'Session révoquée côté présentateur.', 'error');
                            updateControls();
                            break;
                        default:
                            break;
                    }
                });
                conn.on('close', () => {
                    token = '';
                    tokenExpiresAt = 0;
                    challenge = null;
                    setStatus('Connexion fermée.', 'warn');
                    updateControls();
                });
                conn.on('error', () => {
                    token = '';
                    tokenExpiresAt = 0;
                    challenge = null;
                    setStatus('Erreur de connexion.', 'error');
                    updateControls();
                });
            });
            peer.on('error', err => {
                setStatus(`Erreur PeerJS: ${err.type || err.message || err}`, 'error');
                connectBtn.disabled = false;
            });
        }

        function sendCommand(command, extra) {
            if (!conn || !conn.open || !token || tokenExpiresAt <= Date.now()) {
                setStatus('Session distante expirée. Réauthentifiez-vous.', 'warn');
                updateControls();
                return;
            }
            conn.send(Object.assign({
                type: ROOM_MSG.REMOTE_COMMAND,
                rid: randomToken(10),
                token,
                command,
            }, extra || {}));
        }

        connectBtn.addEventListener('click', connectRoom);
        // Auto-connect if ?room=<id>&auto=1 is in the URL
        if (roomFromUrl && autoConnect) setTimeout(() => connectRoom(), 300);
        authBtn.addEventListener('click', authenticate);
        document.getElementById('remote-password').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (challenge) authenticate();
                else connectRoom();
            }
        });
        const _haptic = (ms = 30) => { try { navigator.vibrate?.(ms); } catch (_) {} };
        cmdButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                if (cmd === 'prev' || cmd === 'next') _haptic(30);
                sendCommand(cmd, null);
            });
        });
        gotoBtn.addEventListener('click', () => {
            const raw = document.getElementById('remote-goto-index').value;
            const idx = Number(raw);
            if (!Number.isFinite(idx) || idx < 1) {
                setStatus('Index de slide invalide.', 'error');
                return;
            }
            sendCommand('goto', { index: Math.trunc(idx - 1) });
        });

        setInterval(updateControls, 1000);
        updateControls();
    })();
    
