/**
 * OEIFirebase — Firebase Auth + Firestore wrapper pour PresentaForge
 *
 * Config hardcodée, auto-init au chargement du script.
 * Présentation courante trackée via _currentId pour la sauvegarde auto.
 * Firestore : users/{uid}/presentations/{id} → { id, title, modified, json, public, course }
 *             users/{uid}/courseSettings/{courseSlug} → { course, banner }
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

    let _initError = null; // renseigné si _loadSDK / initializeApp échoue (gstatic bloqué…)

    async function _init() {
        await _loadSDK();
        if (typeof firebase === 'undefined' || !firebase.initializeApp) {
            throw new Error('SDK Firebase indisponible (gstatic.com bloqué ?)');
        }
        if (_app) {
            try { await firebase.app().delete(); } catch {}
            _app = null; _auth = null; _db = null; _user = null;
        }
        _app  = firebase.initializeApp(FIREBASE_CONFIG);
        _auth = firebase.auth();
        _db   = firebase.firestore();
        _initError = null;
    }

    // Promise qui se résout quand l'état auth Firebase est connu (connecté ou non)
    const _readyPromise = (async () => {
        try {
            await _init();
            // Si on revient d'une connexion Google par redirection, récupérer le résultat
            // (et signaler une éventuelle erreur) avant de résoudre l'état auth.
            await _handleRedirectResult();
            await new Promise((resolve) => {
                let unsub = () => {};
                unsub = _auth.onAuthStateChanged((user) => {
                    _user = user;
                    if (user) {
                        localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: user.email, uid: user.uid }));
                    }
                    unsub();
                    resolve();
                });
                // Filet : si onAuthStateChanged ne se déclenche jamais (storage HS), on
                // ne bloque pas indéfiniment l'ouverture de la modale.
                setTimeout(resolve, 8000);
            });
            return !!_user;
        } catch (e) {
            _initError = e && e.message ? e.message : String(e);
            console.warn('[OEIFirebase] Auto-init failed:', _initError);
            document.dispatchEvent(new CustomEvent('oei:firebase-init-failed', { detail: { message: _initError } }));
            return false;
        }
    })();

    function getInitError() { return _initError; }

    // ── Auth ──────────────────────────────────────────────────────────────────

    // Le SDK compat peut se bloquer AVANT même de faire la requête réseau si le
    // stockage local est indisponible (navigation privée, storage bloqué, quota,
    // IndexedDB HS). On choisit la persistance la plus robuste disponible, et on
    // borne l'appel dans le temps pour ne jamais laisser le bouton figé.
    let _persistenceSet = false;
    async function _ensureAuthPersistence() {
        if (_persistenceSet || !_auth || !firebase?.auth?.Auth?.Persistence) return;
        const P = firebase.auth.Auth.Persistence;
        for (const mode of [P.LOCAL, P.SESSION, P.NONE]) {
            try { await _auth.setPersistence(mode); _persistenceSet = true; return; }
            catch (_) { /* essaie le mode suivant */ }
        }
    }

    async function signIn(email, password) {
        if (!_auth) {
            // 2ᵉ chance : le 1ᵉʳ chargement du SDK a pu échouer (gstatic lent/bloqué).
            try { await _init(); } catch (_) {}
        }
        if (!_auth) {
            const e = new Error('Le SDK Firebase ne s\'est pas chargé (gstatic.com bloqué par un bloqueur de pub / un réseau filtré, ou pas de connexion).');
            e.code = 'auth/sdk-unavailable';
            throw e;
        }
        await _ensureAuthPersistence();
        const TIMEOUT_MS = (typeof window !== 'undefined' && Number(window.__OEI_FB_SIGNIN_TIMEOUT_MS) > 0)
            ? Number(window.__OEI_FB_SIGNIN_TIMEOUT_MS) : 20000;
        let timer;
        const cred = await Promise.race([
            _auth.signInWithEmailAndPassword(email, password),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const e = new Error('La connexion Firebase n\'a pas répondu (réseau bloqué ou stockage du navigateur indisponible ?).');
                    e.code = 'auth/timeout';
                    reject(e);
                }, TIMEOUT_MS);
            }),
        ]).finally(() => clearTimeout(timer));
        _user = cred.user;
        localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: _user.email, uid: _user.uid }));
        return _user;
    }

    // Connexion « Se connecter avec Google » (pop-up ; repli redirection si bloquée).
    async function signInWithGoogle() {
        if (!_auth) { try { await _init(); } catch (_) {} }
        if (!_auth || typeof firebase === 'undefined' || !firebase.auth || !firebase.auth.GoogleAuthProvider) {
            const e = new Error('Le SDK Firebase ne s\'est pas chargé (gstatic.com bloqué, ou hors-ligne).');
            e.code = 'auth/sdk-unavailable';
            throw e;
        }
        await _ensureAuthPersistence();
        const provider = new firebase.auth.GoogleAuthProvider();
        try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (_) {}
        let cred;
        try {
            cred = await _auth.signInWithPopup(provider);
        } catch (e) {
            if (e && e.code === 'auth/popup-blocked') {
                // Pop-up bloquée par le navigateur → bascule en redirection plein écran.
                await _auth.signInWithRedirect(provider);
                return null; // la page navigue ; le retour est traité par _handleRedirectResult()
            }
            throw e;
        }
        _user = cred.user;
        localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: _user.email, uid: _user.uid }));
        return _user;
    }

    // Récupère le résultat d'une connexion Google par redirection (au retour sur la page).
    async function _handleRedirectResult() {
        if (!_auth || typeof _auth.getRedirectResult !== 'function') return null;
        try {
            const res = await _auth.getRedirectResult();
            if (res && res.user) {
                _user = res.user;
                localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: _user.email, uid: _user.uid }));
                return _user;
            }
        } catch (e) {
            document.dispatchEvent(new CustomEvent('oei:firebase-redirect-error', { detail: { code: e.code, message: e.message } }));
        }
        return null;
    }

    async function signOut() {
        if (!_auth) return;
        await _auth.signOut();
        _user = null;
        _currentId = null;
        localStorage.removeItem(LS_USER_KEY);
    }

    // Envoi d'un e-mail de réinitialisation de mot de passe.
    async function sendPasswordReset(email) {
        if (!_auth) { try { await _init(); } catch (_) {} }
        if (!_auth) { const e = new Error('SDK Firebase indisponible.'); e.code = 'auth/sdk-unavailable'; throw e; }
        await _auth.sendPasswordResetEmail(String(email || '').trim());
    }

    // Lie un identifiant Google en attente (erreur account-exists-with-different-credential)
    // au compte e-mail/mot de passe existant. Après ça, la connexion Google fonctionne seule.
    async function linkGoogleToPassword(email, password, pendingCred) {
        if (!_auth) throw new Error('Firebase non initialisé');
        await _auth.signInWithEmailAndPassword(String(email || '').trim(), password);
        if (pendingCred && _auth.currentUser && typeof _auth.currentUser.linkWithCredential === 'function') {
            try { await _auth.currentUser.linkWithCredential(pendingCred); } catch (_) { /* déjà lié / non critique */ }
        }
        _user = _auth.currentUser;
        if (_user) localStorage.setItem(LS_USER_KEY, JSON.stringify({ email: _user.email, uid: _user.uid }));
        return _user;
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
            const { title, modified, public: isPublic, course, thumb, banner, level, tags, seance, author, email, institution } = d.data();
            return {
                id: d.id, title: title || 'Sans titre', modified, public: !!isPublic, course: course || '',
                thumb: thumb || null, banner: banner || null, level: level || '', tags: Array.isArray(tags) ? tags : [],
                seance: Number.isFinite(seance) ? seance : null,
                author: author || '', email: email || '', institution: institution || '',
            };
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

    /** Lit et concatène les fragments contigus `<id>__p0..` (s'arrête au premier absent). */
    async function _readParts(col, id, expected = 0) {
        let json = '';
        let i = 0;
        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            const snap = await col.doc(_partId(id, i)).get();
            if (!snap.exists) break;
            json += (snap.data() || {}).s || '';
            i++;
            if (i > 512) break; // garde-fou
        }
        if (expected && i < expected) throw new Error(`Fragments incomplets : ${i}/${expected}`);
        return { json, count: i };
    }

    async function _loadChunked(col, id, docData) {
        const n = Number(docData.chunks) || 0;
        const inline = typeof docData.json === 'string' ? docData.json : '';

        if (n > 0) {
            const { json } = await _readParts(col, id, n);
            return JSON.parse(json);
        }
        // Pas de `chunks` : deck inline classique — mais si `json` est vide/illisible,
        // tenter une récupération via d'éventuels fragments orphelins (méta qui a
        // perdu son champ `chunks`, ancienne sauvegarde partielle…).
        try {
            if (inline) return JSON.parse(inline);
        } catch (_) { /* on tente les fragments */ }
        const { json, count } = await _readParts(col, id, 0);
        if (count > 0) return JSON.parse(json);
        if (inline) return JSON.parse(inline); // relance l'erreur d'origine, explicite
        throw new Error('Présentation vide ou corrompue sur Firebase');
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
        const json = JSON.stringify(presentationData);
        if (!presentationData || !json || json === 'undefined' || json === 'null') {
            throw new Error('Présentation vide — sauvegarde annulée');
        }
        const col   = _presCol();
        const id    = existingId || col.doc().id;
        const meta_ = presentationData.metadata || {};
        const title = meta_.title || 'Sans titre';
        const course = opts.course || meta_.course || '';
        const isPublic = typeof opts.public === 'boolean' ? opts.public : false;
        const thumb = _computeThumb(presentationData);
        const level = opts.level || meta_.level || '';
        const tagsIn = opts.tags || meta_.tags || [];
        const tags = [...new Set((Array.isArray(tagsIn) ? tagsIn : []).map(t => String(t || '').trim()).filter(Boolean))];
        const bannerIn = opts.banner || meta_.banner || null;
        const banner = (bannerIn && (bannerIn.color || bannerIn.icon || bannerIn.image))
            ? { color: String(bannerIn.color || ''), icon: String(bannerIn.icon || ''), image: String(bannerIn.image || '') }
            : null;
        const seanceIn = opts.seance ?? meta_.seance;
        const seanceNum = (seanceIn == null || String(seanceIn).trim() === '') ? NaN : Number(seanceIn);
        const seance = Number.isFinite(seanceNum) ? Math.round(seanceNum) : null;
        const author = String(opts.author || meta_.author || '').trim();
        const email = String(opts.email || meta_.email || '').trim();
        const institution = String(opts.institution || meta_.institution || '').trim();
        const meta = {
            id, title, modified: new Date().toISOString(), public: isPublic, course, thumb: thumb || null,
            banner, level, tags, seance, author, email, institution,
        };

        const bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(json).length : json.length;
        // banner.image (base64 inline, jusqu'à ~150-200 Ko, cf. banner-picker.js maxImageBytes)
        // reste TOUJOURS sur le document racine (jamais découpé, seul `json` l'est) — inclus
        // dans la décision de découpage pour ne jamais laisser `json` (jusqu'à 768 Ko) ET un
        // gros bandeau cohabiter sur un même document au-delà de la limite Firestore (~1 Mio) :
        // si la somme dépasse le seuil, `json` part entièrement en fragments et le doc racine
        // ne garde plus que `meta` (bandeau compris), largement sous la limite.
        const bannerImageBytes = banner && banner.image
            ? ((typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(banner.image).length : banner.image.length)
            : 0;

        if (bytes + bannerImageBytes <= _CHUNK_BYTES) {
            await col.doc(id).set({ ...meta, json, chunks: 0 });
            if (existingId) await _clearParts(col, id, 0); // efface d'anciens fragments
            return id;
        }

        // Découpage. Écriture ATOMIQUE via un WriteBatch : tous les fragments + la
        // méta sont commités ensemble ou pas du tout → jamais de `chunks: N` avec
        // des fragments manquants. (Limite de commit Firestore : 10 Mio ; largement
        // suffisant pour un deck de slides.)
        const parts = [];
        for (let i = 0; i < json.length; i += _CHUNK_BYTES) parts.push(json.slice(i, i + _CHUNK_BYTES));
        const batch = _db.batch();
        parts.forEach((s, i) => batch.set(col.doc(_partId(id, i)), { s }));
        batch.set(col.doc(id), { ...meta, json: '', chunks: parts.length });
        await batch.commit();
        await _clearParts(col, id, parts.length); // supprime d'éventuels fragments en trop d'une version antérieure
        return id;
    }

    async function deletePresentation(id) {
        const col = _presCol();
        await _clearParts(col, id, 0);
        await col.doc(id).delete();
    }

    // Renomme le "cours" (dossier de regroupement) d'une présentation sans re-télécharger
    // ni réécrire son contenu JSON (potentiellement gros/fragmenté) — ne touche que le
    // champ `course` du document méta.
    async function updatePresentationCourse(id, course) {
        const col = _presCol();
        await col.doc(id).update({ course: String(course || '').trim() });
    }

    // Mise à jour légère de métadonnées pour l'édition groupée (page d'accueil, sélection
    // multiple) : cours/niveau/tags/auteur/email/institution, sans jamais toucher au JSON
    // (potentiellement fragmenté). `patch` ne contient que les champs à écrire — un champ
    // absent reste inchangé côté Firestore (édition groupée partielle : un champ vide dans
    // le formulaire ne doit pas écraser les valeurs existantes des présentations sélectionnées).
    const _META_TRIM_FIELDS = ['course', 'level', 'author', 'email', 'institution'];
    async function updatePresentationMeta(id, patch = {}) {
        const col = _presCol();
        const update = {};
        for (const field of _META_TRIM_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(patch, field)) {
                update[field] = String(patch[field] || '').trim();
            }
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'tags') && Array.isArray(patch.tags)) {
            update.tags = [...new Set(patch.tags.map(t => String(t || '').trim()).filter(Boolean))];
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'seance')) {
            const n = patch.seance == null ? NaN : Number(patch.seance);
            update.seance = Number.isFinite(n) ? Math.round(n) : null;
        }
        // `public` : bascule rapide "visible par les étudiants" depuis le tableau de bord
        // (badge cliquable) — gouverne aussi bien loadPublicPresentation (lien de partage)
        // que listPublicPresentationsForCourse (catalogue de cours, slides/course.html).
        if (Object.prototype.hasOwnProperty.call(patch, 'public')) {
            update.public = !!patch.public;
        }
        if (!Object.keys(update).length) return;
        await col.doc(id).update(update);
    }

    // ── Bandeaux de cours (collection dédiée : "course" est une simple chaîne libre sur
    // chaque présentation, pas une entité — il faut un endroit séparé pour porter un réglage
    // par cours) ──────────────────────────────────────────────────────────────────────────

    // Hash déterministe de la chaîne EXACTE du cours (même sensibilité à la casse que le
    // regroupement par cours de firebase-modal.js/index-main.js — "Algo" ≠ "algo") : un id de
    // document Firestore stable, sans dépendre d'une normalisation/minusculisation qui romprait
    // cette cohérence. Même idiome que _colorFromTitle (slides/index-main.js).
    function _courseSlug(course) {
        const trimmed = String(course || '').trim();
        if (!trimmed) return '__none__';
        let h = 5381;
        for (let i = 0; i < trimmed.length; i++) h = ((h * 33) ^ trimmed.charCodeAt(i)) | 0;
        return 'c-' + (h >>> 0).toString(36);
    }

    function _courseSettingsCol() {
        if (!isReady()) throw new Error('Firebase non prêt');
        return _db.collection('users').doc(_user.uid).collection('courseSettings');
    }

    function _sanitizeBanner(banner) {
        if (!banner || (!banner.color && !banner.icon && !banner.image)) return null;
        return { color: String(banner.color || ''), icon: String(banner.icon || ''), image: String(banner.image || '') };
    }

    async function getCourseBanner(course) {
        const trimmed = String(course || '').trim();
        const snap = await _courseSettingsCol().doc(_courseSlug(trimmed)).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        if (data.course !== trimmed) return null; // collision de hash improbable : on ignore plutôt que d'afficher le mauvais bandeau
        return data.banner || null;
    }

    // Un seul aller-retour réseau pour tous les cours (au chargement de la page/modale),
    // plutôt qu'un appel par cours.
    async function listCourseBanners() {
        const snap = await _courseSettingsCol().get();
        const map = {};
        snap.docs.forEach(d => {
            const data = d.data() || {};
            if (data.course) map[data.course] = data.banner || null;
        });
        return map;
    }

    async function setCourseBanner(course, banner) {
        const trimmed = String(course || '').trim();
        const col = _courseSettingsCol();
        const sanitized = _sanitizeBanner(banner);
        // merge:true — ce document porte aussi le pointeur de "présentation courante" du
        // cours (currentPresentationId, ci-dessous) : un .set() sans merge l'effacerait.
        await col.doc(_courseSlug(trimmed)).set(
            { course: trimmed, banner: sanitized, updated: new Date().toISOString() },
            { merge: true }
        );
    }

    // Déplace le bandeau lors d'un renommage en bloc d'un cours (renameFirebaseCourse). Si le
    // cours de destination a déjà son propre bandeau, on le conserve tel quel et on abandonne
    // celui de l'ancien — cohérent avec la fusion silencieuse déjà en place pour le renommage
    // des présentations elles-mêmes (pas de nouvelle UI de résolution de conflit).
    async function renameCourseBanner(oldCourse, newCourse) {
        const banner = await getCourseBanner(oldCourse);
        if (!banner) return;
        // Après un renommage en bloc (renameFirebaseCourse), plus aucune présentation ne porte
        // le nom `oldCourse` : son réglage de bandeau doit être nettoyé dans tous les cas, sinon
        // il reste orphelin et resurgirait si ce nom de cours était un jour réutilisé.
        const destination = await getCourseBanner(newCourse);
        if (!destination) await setCourseBanner(newCourse, banner);
        await setCourseBanner(oldCourse, null);
    }

    // ── Catalogue public de cours (slides/course.html) ──────────────────────────
    //
    // Lien Moodle unique par cours : slides/course.html?u=<uid>&course=<nom exact,
    // encodé>. Liste, SANS authentification (étudiant non connecté), les présentations
    // de ce cours marquées "public" (bascule rapide depuis le badge de carte, cf.
    // updatePresentationMeta ci-dessus) — l'enseignant choisit ainsi quels decks sont
    // visibles avant/pendant/après la séance, indépendamment du contenu du cours.
    // Même idiome que loadPublicPresentation : pas de isReady()/_user, juste _db.
    // Sûr côté règles : la requête filtre déjà public==true, donc chaque document
    // renvoyé satisfait la même condition que la règle de sécurité (pas de champ
    // supplémentaire à autoriser en lecture publique).
    async function listPublicPresentationsForCourse(uid, course) {
        if (!_db) throw new Error('Firebase non initialisé');
        const trimmed = String(course || '').trim();
        if (!uid || !trimmed) return [];
        const col = _db.collection('users').doc(uid).collection('presentations');
        const snap = await col.where('course', '==', trimmed).where('public', '==', true).get();
        const list = snap.docs.map(d => {
            const data = d.data() || {};
            return {
                id: d.id,
                title: data.title || 'Sans titre',
                seance: Number.isFinite(data.seance) ? data.seance : null,
                modified: data.modified || '',
                thumb: data.thumb || null,
            };
        });
        // Séance croissante quand connue (ordre pédagogique) ; sinon, plus récent d'abord.
        list.sort((a, b) => {
            if (a.seance != null && b.seance != null) return a.seance - b.seance;
            if (a.seance != null) return -1;
            if (b.seance != null) return 1;
            return String(b.modified).localeCompare(String(a.modified));
        });
        return list;
    }

    // ── Export ────────────────────────────────────────────────────────────────

    window.OEIFirebase = {
        ready,
        isReady,
        getInitError,
        getUser,
        getLastUser,
        signIn,
        signInWithGoogle,
        linkGoogleToPassword,
        sendPasswordReset,
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
        updatePresentationCourse,
        updatePresentationMeta,
        getCourseBanner,
        listCourseBanners,
        setCourseBanner,
        renameCourseBanner,
        courseSlug: _courseSlug,
        listPublicPresentationsForCourse,
    };
})();
