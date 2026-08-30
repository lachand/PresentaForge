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

    function getCurrentId()      { return _currentId; }
    function setCurrentId(id)    { _currentId = id || null; }
    function clearCurrentId()    { _currentId = null; }

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

    async function loadPresentation(id) {
        const doc = await _presCol().doc(id).get();
        if (!doc.exists) throw new Error('Présentation introuvable');
        return JSON.parse(doc.data().json);
    }

    // Load a public presentation without requiring auth (uid must be provided in the share link)
    async function loadPublicPresentation(uid, id) {
        if (!_db) throw new Error('Firebase non initialisé');
        const doc = await _db.collection('users').doc(uid).collection('presentations').doc(id).get();
        if (!doc.exists) throw new Error('Présentation introuvable');
        const data = doc.data();
        if (!data.public) throw new Error('Cette présentation n\'est pas publique');
        return JSON.parse(data.json);
    }

    async function savePresentation(presentationData, existingId, opts = {}) {
        const id    = existingId || _presCol().doc().id;
        const title = (presentationData.metadata && presentationData.metadata.title) || 'Sans titre';
        const course = opts.course || (presentationData.metadata && presentationData.metadata.course) || '';
        const isPublic = typeof opts.public === 'boolean' ? opts.public : false;
        const thumb = _computeThumb(presentationData);
        await _presCol().doc(id).set({
            id,
            title,
            modified: new Date().toISOString(),
            json: JSON.stringify(presentationData),
            public: isPublic,
            course,
            thumb,
        });
        return id;
    }

    async function deletePresentation(id) {
        await _presCol().doc(id).delete();
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
        listPresentations,
        loadPresentation,
        loadPublicPresentation,
        savePresentation,
        deletePresentation,
    };
})();
