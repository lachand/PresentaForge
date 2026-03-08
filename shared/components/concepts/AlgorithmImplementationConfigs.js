class AlgorithmImplementationConfigs {
    static get ALGORITHMS() {
        return {
            max: {
                id: 'max',
                label: 'Trouver le maximum',
                difficulty: 1,
                needsTarget: false,
                pseudocode: [
                    'max <- T[0]',
                    'pour i de 1 à n-1',
                    '  si T[i] > max',
                    '    max <- T[i]',
                    'retourner max'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'before', label: 'max avant' },
                    { key: 'test', label: 'test' },
                    { key: 'after', label: 'max après' }
                ],
                bridge: [
                    'Pseudo-code "pour i de 1 à n-1" -> boucle for avec indice.',
                    'Pseudo-code "si condition" -> bloc if en Python et JavaScript.',
                    'Une variable de travail (max) garde le meilleur résultat courant.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'max <- T[0]',
                        python: 'max_val = tableau[0]',
                        javascript: 'let maxVal = tableau[0];'
                    },
                    {
                        pseudo: 'pour i de 1 à n-1',
                        python: 'for i in range(1, len(tableau)):',
                        javascript: 'for (let i = 1; i < tableau.length; i += 1) { ... }'
                    },
                    {
                        pseudo: 'si T[i] > max',
                        python: 'if tableau[i] > max_val:',
                        javascript: 'if (tableau[i] > maxVal) { ... }'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def maximum_tableau(tableau):',
                        '    max_val = tableau[0]',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] > max_val:',
                        '            max_val = tableau[i]',
                        '    return max_val'
                    ],
                    javascript: [
                        'function maximumTableau(tableau) {',
                        '  let maxVal = tableau[0];',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (tableau[i] > maxVal) {',
                        '      maxVal = tableau[i];',
                        '    }',
                        '  }',
                        '  return maxVal;',
                        '}'
                    ]
                }),
                resultSentence: (result) => `Le plus grand élément du tableau est ${result}.`
            },
            count: {
                id: 'count',
                label: 'Compter une valeur',
                difficulty: 1,
                needsTarget: true,
                pseudocode: [
                    'compteur <- 0',
                    'pour i de 0 à n-1',
                    '  si T[i] = cible',
                    '    compteur <- compteur + 1',
                    'retourner compteur'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'test', label: 'test' },
                    { key: 'count', label: 'compteur' }
                ],
                bridge: [
                    'L’initialisation doit être explicite: compteur = 0.',
                    'La comparaison d’égalité devient == (Python) ou === (JavaScript).',
                    'Chaque correspondance incrémente compteur de 1.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'compteur <- 0',
                        python: 'compteur = 0',
                        javascript: 'let compteur = 0;'
                    },
                    {
                        pseudo: 'si T[i] = cible',
                        python: 'if tableau[i] == cible:',
                        javascript: 'if (tableau[i] === cible) { ... }'
                    },
                    {
                        pseudo: 'compteur <- compteur + 1',
                        python: 'compteur += 1',
                        javascript: 'compteur += 1;'
                    }
                ],
                codeFactory: (target) => ({
                    python: [
                        'def compter_valeur(tableau):',
                        `    cible = ${target}`,
                        '    compteur = 0',
                        '    for i in range(len(tableau)):',
                        '        if tableau[i] == cible:',
                        '            compteur += 1',
                        '    return compteur'
                    ],
                    javascript: [
                        'function compterValeur(tableau) {',
                        `  const cible = ${target};`,
                        '  let compteur = 0;',
                        '  for (let i = 0; i < tableau.length; i += 1) {',
                        '    if (tableau[i] === cible) {',
                        '      compteur += 1;',
                        '    }',
                        '  }',
                        '  return compteur;',
                        '}'
                    ]
                }),
                resultSentence: (result, target) => `La valeur ${target} apparaît ${result} fois dans le tableau.`
            },
            sorted: {
                id: 'sorted',
                label: 'Vérifier si le tableau est trié',
                difficulty: 1,
                needsTarget: false,
                pseudocode: [
                    'est_trié <- vrai',
                    'pour i de 1 à n-1',
                    '  si T[i] < T[i-1]',
                    '    est_trié <- faux',
                    '    arrêter la boucle',
                    'retourner est_trié'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'left', label: 'T[i-1]' },
                    { key: 'right', label: 'T[i]' },
                    { key: 'test', label: 'test' },
                    { key: 'sorted', label: 'est_trié' }
                ],
                bridge: [
                    'On compare chaque paire voisine T[i-1] et T[i].',
                    'Point L1 critique: bien gérer i-1 sans sortir du tableau.',
                    'On peut quitter la boucle dès qu’une inversion est détectée.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'est_trié <- vrai',
                        python: 'est_trie = True',
                        javascript: 'let estTrie = true;'
                    },
                    {
                        pseudo: 'si T[i] < T[i-1]',
                        python: 'if tableau[i] < tableau[i - 1]:',
                        javascript: 'if (tableau[i] < tableau[i - 1]) { ... }'
                    },
                    {
                        pseudo: 'arrêter la boucle',
                        python: 'break',
                        javascript: 'break;'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def est_tableau_trie(tableau):',
                        '    est_trie = True',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] < tableau[i - 1]:',
                        '            est_trie = False',
                        '            break',
                        '    return est_trie'
                    ],
                    javascript: [
                        'function estTableauTrie(tableau) {',
                        '  let estTrie = true;',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (tableau[i] < tableau[i - 1]) {',
                        '      estTrie = false;',
                        '      break;',
                        '    }',
                        '  }',
                        '  return estTrie;',
                        '}'
                    ]
                }),
                resultSentence: (result) => (
                    result
                        ? 'Le tableau est trié par ordre croissant.'
                        : 'Le tableau n’est pas trié: au moins une inversion a été détectée.'
                )
            },
            sum: {
                id: 'sum',
                label: 'Calculer la somme',
                difficulty: 1,
                needsTarget: false,
                pseudocode: [
                    'somme <- 0',
                    'pour i de 0 à n-1',
                    '  somme <- somme + T[i]',
                    'retourner somme'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'before', label: 'somme avant' },
                    { key: 'after', label: 'somme après' }
                ],
                bridge: [
                    `L'accumulateur somme démarre obligatoirement à 0.`,
                    'Chaque élément est ajouté à somme, même les négatifs.',
                    `Il n'y a pas de condition : tous les éléments sont traités.`
                ],
                syntaxMap: [
                    {
                        pseudo: 'somme <- 0',
                        python: 'somme = 0',
                        javascript: 'let somme = 0;'
                    },
                    {
                        pseudo: 'somme <- somme + T[i]',
                        python: 'somme += tableau[i]',
                        javascript: 'somme += tableau[i];'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def calculer_somme(tableau):',
                        '    somme = 0',
                        '    for i in range(len(tableau)):',
                        '        somme += tableau[i]',
                        '    return somme'
                    ],
                    javascript: [
                        'function calculerSomme(tableau) {',
                        '  let somme = 0;',
                        '  for (let i = 0; i < tableau.length; i += 1) {',
                        '    somme += tableau[i];',
                        '  }',
                        '  return somme;',
                        '}'
                    ]
                }),
                resultSentence: (result) => `La somme des éléments du tableau est ${result}.`
            },
            min: {
                id: 'min',
                label: 'Trouver le minimum',
                difficulty: 1,
                needsTarget: false,
                pseudocode: [
                    'min <- T[0]',
                    'pour i de 1 à n-1',
                    '  si T[i] < min',
                    '    min <- T[i]',
                    'retourner min'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'before', label: 'min avant' },
                    { key: 'test', label: 'test' },
                    { key: 'after', label: 'min après' }
                ],
                bridge: [
                    `Symétrique de max : on garde la plus petite valeur vue.`,
                    `La condition T[i] < min est l'inverse de celle du max.`,
                    `Initialiser min avec T[0] garantit que la référence vient du tableau.`
                ],
                syntaxMap: [
                    {
                        pseudo: 'min <- T[0]',
                        python: 'min_val = tableau[0]',
                        javascript: 'let minVal = tableau[0];'
                    },
                    {
                        pseudo: 'si T[i] < min',
                        python: 'if tableau[i] < min_val:',
                        javascript: 'if (tableau[i] < minVal) { ... }'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def minimum_tableau(tableau):',
                        '    min_val = tableau[0]',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] < min_val:',
                        '            min_val = tableau[i]',
                        '    return min_val'
                    ],
                    javascript: [
                        'function minimumTableau(tableau) {',
                        '  let minVal = tableau[0];',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (tableau[i] < minVal) {',
                        '      minVal = tableau[i];',
                        '    }',
                        '  }',
                        '  return minVal;',
                        '}'
                    ]
                }),
                resultSentence: (result) => `Le plus petit élément du tableau est ${result}.`
            },
            linear_search: {
                id: 'linear_search',
                label: 'Recherche linéaire',
                difficulty: 2,
                needsTarget: true,
                pseudocode: [
                    'pour i de 0 à n-1',
                    '  si T[i] = cible',
                    '    retourner i',
                    'retourner -1'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'test', label: 'test' },
                    { key: 'result', label: 'résultat' }
                ],
                bridge: [
                    `On renvoie l'indice dès que la cible est trouvée (retour dans la boucle).`,
                    `Retourner -1 après la boucle signale l'absence de la cible.`,
                    `L'ordre de parcours importe : on renvoie le premier indice trouvé.`
                ],
                syntaxMap: [
                    {
                        pseudo: 'si T[i] = cible',
                        python: 'if tableau[i] == cible:',
                        javascript: 'if (tableau[i] === cible) { ... }'
                    },
                    {
                        pseudo: 'retourner i',
                        python: 'return i',
                        javascript: 'return i;'
                    },
                    {
                        pseudo: 'retourner -1',
                        python: 'return -1',
                        javascript: 'return -1;'
                    }
                ],
                codeFactory: (target) => ({
                    python: [
                        'def recherche_lineaire(tableau):',
                        `    cible = ${target}`,
                        '    for i in range(len(tableau)):',
                        '        if tableau[i] == cible:',
                        '            return i',
                        '    return -1'
                    ],
                    javascript: [
                        'function rechercheLineaire(tableau) {',
                        `  const cible = ${target};`,
                        '  for (let i = 0; i < tableau.length; i += 1) {',
                        '    if (tableau[i] === cible) {',
                        '      return i;',
                        '    }',
                        '  }',
                        '  return -1;',
                        '}'
                    ]
                }),
                resultSentence: (result, target) => (
                    result >= 0
                        ? `La cible ${target} est à l'indice ${result}.`
                        : `La cible ${target} est absente du tableau (résultat : -1).`
                )
            },
            max_abs: {
                id: 'max_abs',
                label: 'Maximum valeur absolue',
                difficulty: 2,
                needsTarget: false,
                pseudocode: [
                    'max_abs <- |T[0]|',
                    'pour i de 1 à n-1',
                    '  si |T[i]| > max_abs',
                    '    max_abs <- |T[i]|',
                    'retourner max_abs'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'abs', label: '|T[i]|' },
                    { key: 'before', label: 'max_abs avant' },
                    { key: 'test', label: 'test' },
                    { key: 'after', label: 'max_abs après' }
                ],
                bridge: [
                    'La valeur absolue s\'applique à chaque élément avant la comparaison.',
                    'max_abs stocke la plus grande valeur absolue, pas le plus grand entier signé.',
                    'Exemple: avec [-8, 5], max_abs = 8 (car |-8| = 8 > |5| = 5).'
                ],
                syntaxMap: [
                    {
                        pseudo: 'max_abs <- |T[0]|',
                        python: 'max_abs = abs(tableau[0])',
                        javascript: 'let maxAbs = Math.abs(tableau[0]);'
                    },
                    {
                        pseudo: 'si |T[i]| > max_abs',
                        python: 'if abs(tableau[i]) > max_abs:',
                        javascript: 'if (Math.abs(tableau[i]) > maxAbs) { ... }'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def max_valeur_absolue(tableau):',
                        '    max_abs = abs(tableau[0])',
                        '    for i in range(1, len(tableau)):',
                        '        if abs(tableau[i]) > max_abs:',
                        '            max_abs = abs(tableau[i])',
                        '    return max_abs'
                    ],
                    javascript: [
                        'function maxValeurAbsolue(tableau) {',
                        '  let maxAbs = Math.abs(tableau[0]);',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (Math.abs(tableau[i]) > maxAbs) {',
                        '      maxAbs = Math.abs(tableau[i]);',
                        '    }',
                        '  }',
                        '  return maxAbs;',
                        '}'
                    ]
                }),
                resultSentence: (result) => `La plus grande valeur absolue du tableau est ${result}.`
            },
            min_max: {
                id: 'min_max',
                label: 'Min et max simultanés',
                difficulty: 2,
                needsTarget: false,
                pseudocode: [
                    'min <- T[0]',
                    'max <- T[0]',
                    'pour i de 1 à n-1',
                    '  si T[i] < min',
                    '    min <- T[i]',
                    '  si T[i] > max',
                    '    max <- T[i]',
                    'retourner min, max'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'value', label: 'T[i]' },
                    { key: 'min', label: 'min' },
                    { key: 'max', label: 'max' }
                ],
                bridge: [
                    'Deux variables de travail en parallèle : min et max.',
                    'Chaque élément est comparé aux deux : d\'abord au min, puis au max.',
                    'Un seul parcours suffit pour trouver les deux valeurs extrêmes.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'min <- T[0]',
                        python: 'min_val = max_val = tableau[0]',
                        javascript: 'let minVal = tableau[0], maxVal = tableau[0];'
                    },
                    {
                        pseudo: 'si T[i] < min',
                        python: 'if tableau[i] < min_val:',
                        javascript: 'if (tableau[i] < minVal) { ... }'
                    },
                    {
                        pseudo: 'si T[i] > max',
                        python: 'if tableau[i] > max_val:',
                        javascript: 'if (tableau[i] > maxVal) { ... }'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def min_et_max(tableau):',
                        '    min_val = max_val = tableau[0]',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] < min_val:',
                        '            min_val = tableau[i]',
                        '        if tableau[i] > max_val:',
                        '            max_val = tableau[i]',
                        '    return min_val, max_val'
                    ],
                    javascript: [
                        'function minEtMax(tableau) {',
                        '  let minVal = tableau[0];',
                        '  let maxVal = tableau[0];',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (tableau[i] < minVal) {',
                        '      minVal = tableau[i];',
                        '    }',
                        '    if (tableau[i] > maxVal) {',
                        '      maxVal = tableau[i];',
                        '    }',
                        '  }',
                        '  return [minVal, maxVal];',
                        '}'
                    ]
                }),
                resultSentence: (result) => `Min / Max : ${result}.`
            },
            duplicate_check: {
                id: 'duplicate_check',
                label: 'Détection de doublon',
                difficulty: 2,
                needsTarget: false,
                pseudocode: [
                    'doublon <- faux',
                    'pour i de 1 à n-1',
                    '  si T[i] = T[i-1]',
                    '    doublon <- vrai',
                    '    arrêter la boucle',
                    'retourner doublon'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'left', label: 'T[i-1]' },
                    { key: 'right', label: 'T[i]' },
                    { key: 'test', label: 'test' },
                    { key: 'doublon', label: 'doublon' }
                ],
                bridge: [
                    'Fonctionne sur un tableau trié: les doublons sont alors adjacents.',
                    'Une seule correspondance suffit: break arrête la boucle immédiatement.',
                    'Même structure que "est trié", mais le test cherche l\'égalité.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'doublon <- faux',
                        python: 'doublon = False',
                        javascript: 'let doublon = false;'
                    },
                    {
                        pseudo: 'si T[i] = T[i-1]',
                        python: 'if tableau[i] == tableau[i - 1]:',
                        javascript: 'if (tableau[i] === tableau[i - 1]) { ... }'
                    },
                    {
                        pseudo: 'arrêter la boucle',
                        python: 'break',
                        javascript: 'break;'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def detection_doublon(tableau):',
                        '    doublon = False',
                        '    for i in range(1, len(tableau)):',
                        '        if tableau[i] == tableau[i - 1]:',
                        '            doublon = True',
                        '            break',
                        '    return doublon'
                    ],
                    javascript: [
                        'function detectionDoublon(tableau) {',
                        '  let doublon = false;',
                        '  for (let i = 1; i < tableau.length; i += 1) {',
                        '    if (tableau[i] === tableau[i - 1]) {',
                        '      doublon = true;',
                        '      break;',
                        '    }',
                        '  }',
                        '  return doublon;',
                        '}'
                    ]
                }),
                resultSentence: (result) => (
                    result
                        ? 'Un doublon adjacent a été trouvé dans le tableau.'
                        : 'Aucun doublon adjacent (tableau trié sans répétition).'
                )
            },
            bubble_sort: {
                id: 'bubble_sort',
                label: 'Tri à bulles',
                difficulty: 3,
                needsTarget: false,
                pseudocode: [
                    'pour i de 0 à n-2',
                    '  pour j de 0 à n-2-i',
                    '    si T[j] > T[j+1]',
                    '      échanger T[j] et T[j+1]'
                ],
                traceColumns: [
                    { key: 'i', label: 'i' },
                    { key: 'j', label: 'j' },
                    { key: 'left', label: 'T[j]' },
                    { key: 'right', label: 'T[j+1]' },
                    { key: 'test', label: 'test' },
                    { key: 'swap', label: 'échange' }
                ],
                bridge: [
                    'La double boucle imbriquée est caractéristique du tri à bulles.',
                    'Chaque passage du i extérieur place le plus grand élément restant à sa place.',
                    'Complexité O(n²): pour 100 éléments, environ 5000 comparaisons.'
                ],
                syntaxMap: [
                    {
                        pseudo: 'pour i de 0 à n-2',
                        python: 'for i in range(len(tableau) - 1):',
                        javascript: 'for (let i = 0; i < tableau.length - 1; i += 1) { ... }'
                    },
                    {
                        pseudo: 'si T[j] > T[j+1]',
                        python: 'if tableau[j] > tableau[j + 1]:',
                        javascript: 'if (tableau[j] > tableau[j + 1]) { ... }'
                    },
                    {
                        pseudo: 'échanger T[j] et T[j+1]',
                        python: 'tableau[j], tableau[j + 1] = tableau[j + 1], tableau[j]',
                        javascript: '[tableau[j], tableau[j + 1]] = [tableau[j + 1], tableau[j]];'
                    }
                ],
                codeFactory: () => ({
                    python: [
                        'def tri_a_bulles(tableau):',
                        '    n = len(tableau)',
                        '    for i in range(n - 1):',
                        '        for j in range(n - 1 - i):',
                        '            if tableau[j] > tableau[j + 1]:',
                        '                tableau[j], tableau[j + 1] = tableau[j + 1], tableau[j]',
                        '    return tableau'
                    ],
                    javascript: [
                        'function triABulles(tableau) {',
                        '  const n = tableau.length;',
                        '  for (let i = 0; i < n - 1; i += 1) {',
                        '    for (let j = 0; j < n - 1 - i; j += 1) {',
                        '      if (tableau[j] > tableau[j + 1]) {',
                        '        [tableau[j], tableau[j + 1]] = [tableau[j + 1], tableau[j]];',
                        '      }',
                        '    }',
                        '  }',
                        '  return tableau;',
                        '}'
                    ]
                }),
                resultSentence: (result) => `Tableau trié : [${result}].`
            }
        };
    }

    static get LEVEL_PROFILES() {
        return {
            1: {
                label: 'Niveau 1 — découverte',
                examples: {
                    max: { array: '4,7,2,9,5', target: 0 },
                    count: { array: '1,3,1,2,1', target: 1 },
                    sorted: { array: '1,2,4,6,9', target: 0 },
                    sum: { array: '3,7,2,5', target: 0 },
                    min: { array: '4,7,2,9,5', target: 0 },
                    linear_search: { array: '2,4,1,7,3', target: 7 },
                    max_abs: { array: '3,1,5,2,4', target: 0 },
                    min_max: { array: '3,7,1,9,4', target: 0 },
                    duplicate_check: { array: '1,2,3,4,5', target: 0 },
                    bubble_sort: { array: '4,2,7,1', target: 0 }
                },
                recommendation: 'Passez au niveau 2 pour introduire valeurs négatives et doublons.'
            },
            2: {
                label: 'Niveau 2 — consolidation',
                examples: {
                    max: { array: '-2,4,4,-1,7,0', target: 0 },
                    count: { array: '3,-1,3,2,3,-1,4', target: -1 },
                    sorted: { array: '-5,-2,0,0,3,8', target: 0 },
                    sum: { array: '-2,4,-1,7,0', target: 0 },
                    min: { array: '-2,4,4,-1,7,0', target: 0 },
                    linear_search: { array: '3,-1,3,2,3,-1,4', target: -1 },
                    max_abs: { array: '-8,3,-2,6,-1', target: 0 },
                    min_max: { array: '-2,5,-8,3,0', target: 0 },
                    duplicate_check: { array: '1,2,2,4,5', target: 0 },
                    bubble_sort: { array: '5,3,8,1,4', target: 0 }
                },
                recommendation: 'Passez au niveau 3 pour travailler les cas pièges et limites.'
            },
            3: {
                label: 'Niveau 3 — cas pièges',
                examples: {
                    max: { array: '-8,-3,-12,-3,-1', target: 0 },
                    count: { array: '5,2,5,5,1,5,0', target: 4 },
                    sorted: { array: '1,2,3,7,6,8', target: 0 },
                    sum: { array: '-3,-1,-2', target: 0 },
                    min: { array: '5,3,1', target: 0 },
                    linear_search: { array: '1,2,3,4,5', target: 6 },
                    max_abs: { array: '-10,-3,-7,-4', target: 0 },
                    min_max: { array: '5,5,5', target: 0 },
                    duplicate_check: { array: '1,1,2,3,4', target: 0 },
                    bubble_sort: { array: '5,4,3,2,1', target: 0 }
                },
                recommendation: 'Refaites un cycle niveau 1 à 3 sur un autre algorithme pour consolider.'
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.AlgorithmImplementationConfigs = AlgorithmImplementationConfigs;
}
