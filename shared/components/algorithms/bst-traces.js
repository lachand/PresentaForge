/**
 * bst-traces.js — générateurs de trace PURS pour l'arbre binaire de recherche
 * (BST). Contrairement aux tableaux, un arbre est indexé par VALEUR : les
 * `marks` portent des valeurs de nœuds, pas des indices. Chaque générateur
 * clone l'arbre en entrée (plain object `{value,left,right}` ou `null`,
 * jamais de classe/instance) et ne le mute jamais — chaque Step embarque son
 * propre instantané `tree`, comme `array` dans les autres familles.
 *
 * Insertion/recherche/parcours ne mutent le sous-arbre non concerné que
 * lorsque c'est l'opération elle-même (insert/delete) ; recherche et parcours
 * sont en lecture seule (le `tree` de chaque pas reste identique).
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

    function cloneTree(node) {
        if (!node) return null;
        return { value: node.value, left: cloneTree(node.left), right: cloneTree(node.right) };
    }

    function insertPlain(node, value) {
        if (!node) return { value, left: null, right: null };
        if (value === node.value) return node; // doublon : pas de mutation
        if (value < node.value) return { value: node.value, left: insertPlain(node.left, value), right: node.right };
        return { value: node.value, left: node.left, right: insertPlain(node.right, value) };
    }

    function searchPath(node, value) {
        const path = [];
        let current = node;
        while (current) {
            path.push(current.value);
            if (value === current.value) return { path, found: true };
            current = value < current.value ? current.left : current.right;
        }
        return { path, found: false };
    }

    function findMin(node) {
        let cur = node;
        while (cur.left) cur = cur.left;
        return cur.value;
    }

    function deletePlain(node, value) {
        if (!node) return null;
        if (value < node.value) return { value: node.value, left: deletePlain(node.left, value), right: node.right };
        if (value > node.value) return { value: node.value, left: node.left, right: deletePlain(node.right, value) };
        // value === node.value
        if (!node.left && !node.right) return null;
        if (!node.left) return node.right;
        if (!node.right) return node.left;
        const succ = findMin(node.right);
        return { value: succ, left: node.left, right: deletePlain(node.right, succ) };
    }

    function countPlain(node) {
        return node ? 1 + countPlain(node.left) + countPlain(node.right) : 0;
    }
    function heightPlain(node) {
        return node ? 1 + Math.max(heightPlain(node.left), heightPlain(node.right)) : 0;
    }
    function minPlain(node) {
        if (!node) return null;
        let c = node;
        while (c.left) c = c.left;
        return c.value;
    }
    function maxPlain(node) {
        if (!node) return null;
        let c = node;
        while (c.right) c = c.right;
        return c.value;
    }
    function statsOf(node) {
        return { count: countPlain(node), height: heightPlain(node), min: minPlain(node), max: maxPlain(node) };
    }

    function mk(tree, o) {
        return {
            i: 0,
            line: '',
            phase: o.phase || '',
            caption: o.caption || '',
            tree: cloneTree(tree),
            marks: {
                visited: (o.visited || []).slice(),
                found: (o.found || []).slice(),
                path: (o.path || []).slice()
            },
            order: (o.order || []).slice(),
            deleteCase: o.deleteCase || null,
            ok: o.ok !== false,
            delay: o.delay || 'normal',
            stats: statsOf(tree)
        };
    }

    function finalize(steps) {
        steps.forEach((s, idx) => { s.i = idx; });
        return steps;
    }

    /** Décrit le cas de suppression (feuille / 1 enfant / 2 enfants) sans muter l'arbre. */
    function describeDeleteCase(node, value) {
        const { path, found } = searchPath(node, value);
        if (!found) return null;
        // retrouver le nœud lui-même (même parcours que searchPath) pour compter ses enfants
        let target = node;
        while (target && target.value !== value) {
            target = value < target.value ? target.left : target.right;
        }
        const hasLeft = Boolean(target.left);
        const hasRight = Boolean(target.right);
        if (!hasLeft && !hasRight) {
            return { kind: 'leaf', replacement: null, path, message: `Suppression feuille (${value}) : retrait direct.` };
        }
        if (hasLeft !== hasRight) {
            const replacement = hasLeft ? target.left.value : target.right.value;
            const kind = hasLeft ? 'single-left' : 'single-right';
            return { kind, replacement, path, message: `Suppression à 1 enfant (${value}) : on remonte ${replacement}.` };
        }
        const replacement = findMin(target.right);
        return { kind: 'two-children', replacement, path, message: `Suppression à 2 enfants (${value}) : remplacement par successeur ${replacement}.` };
    }

    // ─────────────────────────────────────────────────────────────────────────
    function buildBstInsertTrace(tree, value) {
        const { found } = searchPath(tree, value);
        if (found) {
            return finalize([mk(tree, { phase: 'duplicate', caption: `La valeur ${value} existe déjà dans l'arbre.`, ok: false })]);
        }
        const next = insertPlain(tree, value);
        return finalize([mk(next, { phase: 'inserted', caption: `Valeur ${value} insérée avec succès.`, found: [value] })]);
    }

    function buildBstSearchTrace(tree, value) {
        const steps = [];
        let current = tree;
        const visited = [];
        while (current) {
            visited.push(current.value);
            if (value === current.value) {
                steps.push(mk(tree, { phase: 'found', caption: `Valeur ${value} trouvée dans l'arbre !`, visited: visited.slice(), found: [value] }));
                return finalize(steps);
            }
            steps.push(mk(tree, { phase: 'visit', caption: `Comparer ${value} à ${current.value}.`, visited: visited.slice() }));
            current = value < current.value ? current.left : current.right;
        }
        steps.push(mk(tree, { phase: 'not-found', caption: `Valeur ${value} non trouvée dans l'arbre.`, visited: visited.slice(), ok: false }));
        return finalize(steps);
    }

    function buildBstDeleteTrace(tree, value) {
        const guide = describeDeleteCase(tree, value);
        if (!guide) {
            return finalize([mk(tree, { phase: 'not-found', caption: `La valeur ${value} n'existe pas dans l'arbre.`, ok: false })]);
        }
        const steps = [];
        steps.push(mk(tree, {
            phase: 'preview-path', caption: guide.message, path: guide.path, found: [value], deleteCase: guide
        }));
        if (guide.replacement !== null) {
            steps.push(mk(tree, {
                phase: 'preview-replacement', caption: guide.message,
                path: guide.path, found: [value, guide.replacement], deleteCase: guide, delay: 'quick'
            }));
        }
        const next = deletePlain(tree, value);
        steps.push(mk(next, {
            phase: 'deleted', caption: `Valeur ${value} supprimée avec succès.`, deleteCase: guide
        }));
        return finalize(steps);
    }

    const TRAVERSAL_LABELS = { inorder: 'Infixe', preorder: 'Préfixe', postorder: 'Suffixe', bfs: 'Largeur' };

    function buildBstTraversalTrace(tree, type) {
        if (!tree) {
            return finalize([mk(tree, { phase: 'empty', caption: "L'arbre est vide.", ok: false })]);
        }
        const steps = [];
        const order = [];
        const visit = (value) => {
            order.push(value);
            steps.push(mk(tree, {
                phase: 'visit', caption: `${TRAVERSAL_LABELS[type] || type} : visite de ${value}.`,
                visited: order.slice(), order: order.slice()
            }));
        };

        if (type === 'inorder') {
            const go = (n) => { if (!n) return; go(n.left); visit(n.value); go(n.right); };
            go(tree);
        } else if (type === 'preorder') {
            const go = (n) => { if (!n) return; visit(n.value); go(n.left); go(n.right); };
            go(tree);
        } else if (type === 'postorder') {
            const go = (n) => { if (!n) return; go(n.left); go(n.right); visit(n.value); };
            go(tree);
        } else { // bfs
            const queue = [tree];
            while (queue.length) {
                const n = queue.shift();
                visit(n.value);
                if (n.left) queue.push(n.left);
                if (n.right) queue.push(n.right);
            }
        }

        steps.push(mk(tree, {
            phase: 'done', caption: `Parcours ${type} terminé.`, visited: order.slice(), order: order.slice()
        }));
        return finalize(steps);
    }

    return {
        buildBstInsertTrace,
        buildBstSearchTrace,
        buildBstDeleteTrace,
        buildBstTraversalTrace,
        // exposés pour les adaptateurs (compter/hauteur/min/max sans dupliquer la logique)
        bstStats: statsOf,
        bstClone: cloneTree
    };
});
