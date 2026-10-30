/**
 * web-attacks-model.js - modèle PUR du simulateur d'attaques web : verdict d'une attaque (XSS réfléchi,
 * XSS stocké, injection SQL, CSRF) selon les défenses actives ET le payload saisi, profondeur de défense
 * et couverture globale. Aucune dépendance au DOM (relecture 3b, AW-I2, AW-I3, T6).
 *
 * Règles de fidélité au cours :
 * - une seule défense critique suffit à BLOQUER l'attaque simulée, mais la verdict dit « une seule
 *   couche » : une défense seule a toujours une faille ou un contournement ; deux défenses ou plus donnent
 *   une « défense en profondeur » ;
 * - la validation d'entrée est un soutien, jamais une protection suffisante ;
 * - le payload compte : un texte qui n'est pas une charge de ce type est sans effet, quelle que soit
 *   la défense ;
 * - SameSite : Strict n'envoie le cookie sur aucune requête issue d'un autre site ; Lax l'envoie encore
 *   pour une navigation de haut niveau en GET (un lien), pas pour un POST ni pour une image.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.OEITrace = Object.assign(window.OEITrace || {}, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ATTACKS = [
        { id: 'xss-reflected', label: 'XSS réfléchie' },
        { id: 'xss-stored', label: 'XSS stockée' },
        { id: 'sqli', label: 'Injection SQL' },
        { id: 'csrf', label: 'CSRF' }
    ];

    // Charges canoniques : illustrations sans effet réel hors du simulateur.
    const DEFAULT_PAYLOADS = {
        'xss-reflected': '<script>alert(1)</script>',
        'xss-stored': '<img src=x onerror="fetch(\'/vol\')" />',
        sqli: "' OR 1=1 --",
        csrf: '<form method="POST" action="https://banque.example/virement">...</form>'
    };

    const NODE_LABELS = { attacker: 'Attaquant', browser: 'Navigateur victime', app: 'Application web', db: 'Base SQL', action: 'Action sensible' };

    function normalizeDefenses(d) {
        const x = d || {};
        let sameSite = x.sameSite;
        if (sameSite === true) sameSite = 'strict';
        if (!sameSite) sameSite = 'none';
        return {
            validation: !!x.validation,
            outputEncoding: !!x.outputEncoding,
            csp: !!x.csp,
            prepared: !!x.prepared,
            csrfToken: !!x.csrfToken,
            sameSite: sameSite
        };
    }

    /** Dit si le texte est une charge du type donné : { effective, reason, method }. */
    function webAttackPayloadCheck(type, payload) {
        const p = String(payload || '');
        if (type === 'xss-reflected' || type === 'xss-stored') {
            const ok = /<\s*(script|img|svg|iframe|body|input|details|a)\b[^>]*>/i.test(p) || /\bon[a-z]+\s*=/i.test(p) || /javascript:/i.test(p);
            return ok ? { effective: true } : { effective: false, reason: 'Ce texte ne contient ni balise ni gestionnaire d\'événement : il s\'affichera comme du texte, sans exécuter de script.' };
        }
        if (type === 'sqli') {
            const ok = /('|"|--|;|\bor\b|\band\b|\bunion\b)/i.test(p);
            return ok ? { effective: true } : { effective: false, reason: 'Aucun guillemet, commentaire ni mot-clé SQL : ce texte reste une simple valeur, il ne détourne pas la requête.' };
        }
        if (type === 'csrf') {
            let method = null;
            if (/<\s*form\b/i.test(p) && !/method\s*=\s*["']?get/i.test(p)) method = 'POST';
            else if (/<\s*a\b[^>]*href|window\.open|location\s*=|<\s*form\b/i.test(p)) method = 'GET-navigation';
            else if (/<\s*img\b|<\s*iframe\b|fetch\(/i.test(p)) method = 'GET-ressource';
            return method ? { effective: true, method: method } : { effective: false, reason: 'Rien dans ce texte ne déclenche une requête vers l\'application cible.' };
        }
        return { effective: false, reason: 'Type d\'attaque inconnu.' };
    }

    function rows(def, blueprint, blockedBy) {
        return blueprint.map((b) => {
            const active = b.key === 'sameSite' ? def.sameSite !== 'none' : !!def[b.key];
            return Object.assign({}, b, { active: active, blocks: blockedBy.indexOf(b.key) !== -1 });
        });
    }

    function depthOf(activeCount) {
        if (activeCount >= 2) return { depth: 'deep', depthLabel: 'Défense en profondeur : plusieurs couches, il faut en contourner plusieurs.' };
        if (activeCount === 1) return { depth: 'single', depthLabel: 'Bloquée, mais une seule couche : si cette défense a une faille ou un contournement, l\'attaque passe.' };
        return { depth: 'none', depthLabel: '' };
    }

    /**
     * Verdict d'une attaque. payload facultatif : s'il est fourni, il est contrôlé (sinon la charge canonique du type).
     * Retourne { type, ineffective, reason, blocked, severity, signal, timeline, path, reachedNode, chainSummary,
     *   defenseImpact, blockedBy, depth, depthLabel }.
     */
    function webAttackEvaluate(type, defensesIn, payload) {
        const d = normalizeDefenses(defensesIn);
        const check = webAttackPayloadCheck(type, payload === undefined ? DEFAULT_PAYLOADS[type] : payload);
        const label = (ATTACKS.find((a) => a.id === type) || {}).label || type;
        if (!check.effective) {
            return {
                type: type, ineffective: true, reason: check.reason, blocked: false, severity: 'info',
                signal: 'Le payload est sans effet : ce n\'est pas une défense qui l\'arrête.',
                timeline: ['Le texte saisi est envoyé à l\'application.', check.reason, 'Aucune exploitation : ' + label + ' n\'a pas lieu avec ce texte.'],
                path: ['attacker', 'app'], reachedNode: 'app', chainSummary: 'Sans effet : ce texte n\'est pas une charge de type ' + label + '.',
                defenseImpact: [], blockedBy: [], depth: 'none', depthLabel: ''
            };
        }
        const base = { type: type, ineffective: false, reason: null };
        const validationRow = { key: 'validation', label: 'Validation d\'entrée', role: 'support', hint: 'Réduit la surface, mais ne suffit jamais seule : elle se contourne.' };

        if (type === 'xss-reflected' || type === 'xss-stored') {
            const stored = type === 'xss-stored';
            const blockedBy = [];
            if (d.outputEncoding) blockedBy.push('outputEncoding');
            if (d.csp) blockedBy.push('csp');
            const blocked = blockedBy.length > 0;
            const active = (d.validation ? 1 : 0) + blockedBy.length;
            return Object.assign(base, {
                blocked: blocked,
                severity: blocked ? (stored ? 'medium' : 'low') : 'critical',
                signal: blocked ? 'Le script injecté ne s\'exécute pas.' : (stored ? 'Tous les lecteurs de la page exécutent le script stocké.' : 'Le navigateur de la victime exécute le script injecté.'),
                timeline: stored ? [
                    'Le payload est enregistré en base par l\'application.',
                    blocked ? 'Au rendu, l\'encodage de sortie ou la CSP empêche l\'exécution.' : 'Au rendu, le script s\'exécute chez chaque lecteur.',
                    blocked ? 'La propagation s\'arrête sur la page.' : 'Compromission possible de tous les utilisateurs.'
                ] : [
                    'Le payload est injecté dans la requête de l\'utilisateur.',
                    d.validation ? 'La validation d\'entrée filtre une partie du bruit, mais ne suffit pas.' : 'Aucune validation d\'entrée côté serveur.',
                    blocked ? 'L\'encodage de sortie ou la CSP bloque l\'exécution du JavaScript.' : 'Le payload est renvoyé tel quel et s\'exécute chez la victime.'
                ],
                path: stored ? ['attacker', 'app', 'db', 'browser', 'action'] : ['attacker', 'app', 'browser', 'action'],
                reachedNode: blocked ? (stored ? 'browser' : (d.outputEncoding ? 'app' : 'browser')) : 'action',
                chainSummary: blocked ? 'Arrêt avant l\'impact grâce à ' + blockedBy.map((k) => (k === 'csp' ? 'la CSP' : 'l\'encodage de sortie')).join(' et ') + '.' : 'La chaîne atteint une action sensible chez la victime.',
                defenseImpact: rows(d, [validationRow,
                    { key: 'outputEncoding', label: 'Encodage de sortie', role: 'critical', hint: 'Neutralise balises et scripts au rendu.' },
                    { key: 'csp', label: 'CSP stricte', role: 'critical', hint: stored ? 'Dernière barrière si le rendu est vulnérable.' : 'Bloque l\'exécution inline et les domaines non autorisés.' }], blockedBy),
                blockedBy: blockedBy
            }, blocked ? depthOf(active) : { depth: 'none', depthLabel: '' });
        }

        if (type === 'sqli') {
            const blockedBy = d.prepared ? ['prepared'] : [];
            const blocked = blockedBy.length > 0;
            return Object.assign(base, {
                blocked: blocked,
                severity: blocked ? 'low' : 'critical',
                signal: blocked ? 'La requête paramétrée sépare les données du code SQL.' : 'Le moteur SQL interprète les morceaux injectés.',
                timeline: [
                    'Le payload atteint la couche SQL de l\'application.',
                    d.validation ? 'La validation de forme filtre une partie des entrées, mais se contourne.' : 'Aucune validation de forme sur les paramètres.',
                    blocked ? 'Requête préparée : l\'injection est neutralisée.' : 'Requête construite par concaténation : elle est détournée.'
                ],
                path: ['attacker', 'app', 'db', 'action'],
                reachedNode: blocked ? 'app' : 'action',
                chainSummary: blocked ? 'Arrêt dans le backend grâce aux requêtes préparées.' : 'La base est atteinte et la logique métier détournée.',
                defenseImpact: rows(d, [Object.assign({}, validationRow, { hint: 'Filtre syntaxique, contournable.' }),
                    { key: 'prepared', label: 'Requêtes préparées', role: 'critical', hint: 'Séparation stricte des données et du code SQL.' }], blockedBy),
                blockedBy: blockedBy
            }, blocked ? depthOf((d.validation ? 1 : 0) + 1) : { depth: 'none', depthLabel: '' });
        }

        // CSRF
        const blockedBy = [];
        if (d.csrfToken) blockedBy.push('csrfToken');
        if (d.sameSite === 'strict' || (d.sameSite === 'lax' && check.method !== 'GET-navigation')) blockedBy.push('sameSite');
        const blocked = blockedBy.length > 0;
        const lax = d.sameSite === 'lax';
        const laxPassed = lax && check.method === 'GET-navigation' && !d.csrfToken;
        return Object.assign(base, {
            blocked: blocked,
            severity: blocked ? 'medium' : 'high',
            signal: blocked ? 'La requête forgée est rejetée par la vérification de contexte.' : (laxPassed ? 'SameSite=Lax laisse passer cette navigation de haut niveau en GET : le cookie est envoyé.' : 'La session de la victime est réutilisée pour l\'action forcée.'),
            timeline: [
                'La victime charge une page piégée (méthode : ' + check.method + ').',
                blocked ? 'Le token CSRF ou SameSite invalide la requête venue d\'un autre site.' : (laxPassed ? 'SameSite=Lax envoie quand même le cookie pour un lien suivi en navigation de haut niveau.' : 'Le navigateur envoie automatiquement le cookie de session à l\'application cible.'),
                blocked ? 'L\'action sensible est stoppée.' : 'L\'action sensible s\'exécute sans le consentement de l\'utilisateur.'
            ],
            path: ['attacker', 'browser', 'app', 'action'],
            reachedNode: blocked ? 'app' : 'action',
            chainSummary: blocked ? 'Arrêt côté application grâce à ' + blockedBy.map((k) => (k === 'sameSite' ? 'SameSite' : 'au token CSRF')).join(' et ') + '.' : 'La chaîne CSRF atteint une action métier critique.',
            defenseImpact: rows(d, [
                { key: 'csrfToken', label: 'Token CSRF', role: 'critical', hint: 'Lie la requête à un contexte légitime ; protège aussi contre un GET en navigation.' },
                { key: 'sameSite', label: 'Cookie SameSite (' + d.sameSite + ')', role: 'critical', hint: 'Strict bloque tout envoi cross-site. Lax bloque POST et ressources, mais pas un lien suivi en GET.' },
                Object.assign({}, validationRow, { hint: 'Sans objet contre CSRF : la requête est légitime côté serveur.' })], blockedBy),
            blockedBy: blockedBy
        }, blocked ? depthOf(blockedBy.length) : { depth: 'none', depthLabel: '' });
    }

    /** Couverture globale (charges canoniques) : { rows: [{ id, label, blocked }], risk } avec risk = % de familles exploitables. */
    function webAttackMatrix(defenses) {
        const list = ATTACKS.map((a) => {
            const v = webAttackEvaluate(a.id, defenses);
            return { id: a.id, label: a.label, blocked: v.blocked, signal: v.signal, severity: v.severity, depth: v.depth };
        });
        const exploitable = list.filter((r) => !r.blocked).length;
        return { rows: list, risk: Math.round(exploitable / list.length * 100) };
    }

    return {
        WEB_ATTACKS: ATTACKS,
        WEB_ATTACK_PAYLOADS: DEFAULT_PAYLOADS,
        WEB_ATTACK_NODES: NODE_LABELS,
        webAttackPayloadCheck: webAttackPayloadCheck,
        webAttackEvaluate: webAttackEvaluate,
        webAttackMatrix: webAttackMatrix
    };
});
