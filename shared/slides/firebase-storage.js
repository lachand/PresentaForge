/**
 * OEIFirebase — Firebase Auth + Firestore wrapper pour PresentaForge
 *
 * Config hardcodée, auto-init au chargement du script.
 * Présentation courante trackée via _currentId pour la sauvegarde auto.
 * Firestore : users/{uid}/presentations/{id} → { id, title, modified, json }
 */
(function () {
    'use strict';

    // ── Config hardcodée ──────────────────────────────────────────────────────

    const FIREBASE_CONFIG = {
        apiKey:            'AIzaSyAgC2mnp4FLBCkt1l1Kkhv610qIpo2XGUE',
        authDomain:        'presentaforge-oei.firebaseapp.com',
        projectId:         'presentaforge-oei',
        storageBucket:     'presentaforge-oei.firebasestorage.app',
        messagingSenderId: '453450154046',
        appId:             '1:453450154046:web:da64608cdeea72042e916f',
    };

    const LS_USER_KEY = 'oei-firebase-user';

    // CDN Firebase SDK v10 compat
    const FB_SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const FB_SCRIPTS  = [
        FB_SDK_BASE + 'firebase-app-compat.js',
        FB_SDK_BASE + 'firebase-auth-compat.js',
        FB_SDK_BASE + 'firebase-firestore-compat.js',
    ];

    let _app       = null;
    let _auth      = null;
    let _db        = null;
    let _user      = null;
    let _sdkLoaded = false;
    let _currentId = null; // ID Firestore de la présentation ouverte/sauvegardée

    // ── SDK loading ───────────────────────────────────────────────────────────

    function _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload  = resolve;
            s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    async function _loadSDK() {
        if (_sdkLoaded) return;
        for (const src of FB_SCRIPTS) await _loadScript(src);
        _sdkLoaded = true;
    }

    // ── Init & session ────────────────────────────────────────────────────────

    async function _init() {
        await _loadSDK();
        if (_app) {
            try { await firebase.app().delete(); } catch {}
            _app = null; _auth = null; _db = null; _user = null;
        }
        _app  = firebase.initializeApp(FIREBASE_CONFIG);
        _auth = firebase.auth();
        _db   = firebase.firestore();
    }

    // Promise qui se résout quand l'état auth Firebase est connu (connecté ou non)
    const _readyPromise = (async () => {
        try {
            await _init();
            await new Promise((resolve) => {
                const unsub = _auth.onAuthStateChanged((user) => {
                    _user = user;
                    if (user) {
                        localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: user.email, uid: user.uid }));
                    }
                    unsub();
                    resolve();
                });
            });
            return !!_user;
        } catch (e) {
            console.warn('[OEIFirebase] Auto-init failed:', e.message);
            document.dispatchEvent(new CustomEvent('oei:firebase-init-failed', { detail: { message: e.message } }));
            return false;
        }
    })();

    // ── Auth ──────────────────────────────────────────────────────────────────

    async function signIn(email, password) {
        if (!_auth) throw new Error('Firebase non initialisé');
        const cred = await _auth.signInWithEmailAndPassword(email, password);
        _user = cred.user;
        localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: _user.email, uid: _user.uid }));
        return _user;
    }

    async function signOut() {
        if (!_auth) return;
        await _auth.signOut();
        _user = null;
        _currentId = null;
        localStorage.removeItem(LS_USER_KEY);
    }

    function getUser()   { return _user; }
    function isReady()   { return !!_db && !!_user; }
    function ready()     { return _readyPromise; }

    // ── Présentation courante (pour auto-save) ────────────────────────────────

    // `_loadedId` = l'id dont le CONTENU a réellement été chargé/sauvé cette session.
    // Distinct de `_currentId` (simple cible de sauvegarde qui peut n'avoir été que
    // restaurée depuis sessionStorage). Les uploads auto ne sont autorisés que si
    // `_currentId === _loadedId` (sinon on écraserait le vrai doc par un vieux brouillon).
    let _loadedId = null;

    function getCurrentId()      { return _currentId; }
    function setCurrentId(id)    { _currentId = id || null; }
    function clearCurrentId()    { _currentId = null; _loadedId = null; }
    function markLoaded(id)      { _loadedId = id || null; }
    function getLoadedId()       { return _loadedId; }

    // Adresse du dernier utilisateur connu (même sans session active)
    function getLastUser() {
        try { return JSON.parse(localStorage.getItem(LS_USER_KEY) || 'null'); }
        catch { return null; }
    }

    // ── Firestore CRUD ────────────────────────────────────────────────────────

    function _presCol() {
        if (!isReady()) throw new Error('Firebase non prêt');
        return _db.collection('users').doc(_user.uid).collection('presentations');
    }

    async function listPresentations() {
        const snap = await _presCol().orderBy('modified', 'desc').get();
        return snap.docs.map(d => {
            const { title, modified, public: isPublic, course, thumb } = d.data();
            return { id: d.id, title: title || 'Sans titre', modified, public: !!isPublic, course: course || '', thumb: thumb || null };
        });
    }

    // Extract {bg, text} from first slide — stored in Firestore to avoid loading full JSON in list view
    function _computeThumb(data) {
        const slide = data?.slides?.[0];
        if (!slide) return null;
        const bg = typeof slide.bg === 'string' && slide.bg && !slide.bg.startsWith('data:') ? slide.bg : null;
        const text = String(slide.title || data?.metadata?.title || '').replace(/<[^>]*>/g, '').slice(0, 80);
        return { bg, text };
    }

    // Firestore plafonne un champ de document ET le document entier à ~1 Mio. Les
    // decks avec images base64 dépassent largement → on découpe la chaîne JSON en
    // fragments stockés dans des documents FRÈRES de la même collection
    // (`<id>__pN`), chacun sous la limite. Documents frères (pas sous-collection)
    // → couverts par les mêmes règles de sécurité que `<id>`. Ils n'ont pas de
    // champ `modified` donc `listPresentations()` (qui fait `orderBy('modified')`)
    // les ignore automatiquement. Un deck sous la limite reste en `json` inline
    // (rétro-compatible : `chunks` absent ou 0).
    const _CHUNK_BYTES = 768 * 1024;   // marge sous ~1 048 487 octets
    const _partId = (id, i) => `${id}__p${i}`;

    async function _loadChunked(col, id, docData) {
        const n = Number(docData.chunks) || 0;
        if (n <= 0) return JSON.parse(docData.json);
        const parts = await Promise.all(
            Array.from({ length: n }, (_, i) => col.doc(_partId(id, i)).get())
        );
        let json = '';
        for (let i = 0; i < n; i++) {
            if (!parts[i].exists) throw new Error(`Fragment ${i + 1}/${n} manquant`);
            json += (parts[i].data() || {}).s || '';
        }
        return JSON.parse(json);
    }

    async function loadPresentation(id) {
        const col = _presCol();
        const doc = await col.doc(id).get();
        if (!doc.exists) throw new Error('Présentation introuvable');
        return _loadChunked(col, id, doc.data());
    }

    // Load a public presentation without requiring auth (uid must be provided in the share link)
    async function loadPublicPresentation(uid, id) {
        if (!_db) throw new Error('Firebase non initialisé');
        const col = _db.collection('users').doc(uid).collection('presentations');
        const doc = await col.doc(id).get();
        if (!doc.exists) throw new Error('Présentation introuvable');
        const data = doc.data();
        if (!data.public) throw new Error('Cette présentation n\'est pas publique');
        return _loadChunked(col, id, data);
    }

    /**
     * Supprime les documents-fragments d'index >= keepFrom. Les fragments sont
     * contigus (0..N-1) : on s'arrête au premier absent.
     */
    async function _clearParts(col, id, keepFrom, maxProbe = 128) {
        for (let i = keepFrom; i < maxProbe; i++) {
            const d = col.doc(_partId(id, i));
            // eslint-disable-next-line no-await-in-loop
            const snap = await d.get();
            if (!snap.exists) break;
            // eslint-disable-next-line no-await-in-loop
            await d.delete();
        }
    }

    async function savePresentation(presentationData, existingId, opts = {}) {
        const col   = _presCol();
        const id    = existingId || col.doc().id;
        const title = (presentationData.metadata && presentationData.metadata.title) || 'Sans titre';
        const course = opts.course || (presentationData.metadata && presentationData.metadata.course) || '';
        const isPublic = typeof opts.public === 'boolean' ? opts.public : false;
        const thumb = _computeThumb(presentationData);
        const json = JSON.stringify(presentationData);
        const meta = { id, title, modified: new Date().toISOString(), public: isPublic, course, thumb };

        const bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(json).length : json.length;

        if (bytes <= _CHUNK_BYTES) {
            await col.doc(id).set({ ...meta, json, chunks: 0 });
            if (existingId) await _clearParts(col, id, 0); // efface d'anciens fragments
            return id;
        }

        // Fragments D'ABORD, méta (chunks=N) ENSUITE — un `chunks` valide implique
        // que les fragments existent.
        const parts = [];
        for (let i = 0; i < json.length; i += _CHUNK_BYTES) parts.push(json.slice(i, i + _CHUNK_BYTES));
        for (let i = 0; i < parts.length; i++) {
            await col.doc(_partId(id, i)).set({ s: parts[i] });
        }
        await col.doc(id).set({ ...meta, json: '', chunks: parts.length });
        await _clearParts(col, id, parts.length); // supprime les fragments en trop
        return id;
    }

    async function deletePresentation(id) {
        const col = _presCol();
        await _clearParts(col, id, 0);
        await col.doc(id).delete();
    }

    // ── Export ────────────────────────────────────────────────────────────────

    window.OEIFirebase = {
        ready,
        isReady,
        getUser,
        getLastUser,
        signIn,
        signOut,
        getCurrentId,
        setCurrentId,
        clearCurrentId,
        markLoaded,
        getLoadedId,
        listPresentations,
        loadPresentation,
        loadPublicPresentation,
        savePresentation,
        deletePresentation,
    };
})();
