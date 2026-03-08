class AlgorithmImplementationSteps {
    static boolLabel(value) {
        return value ? 'vrai' : 'faux';
    }

    static buildMaxSteps(values) {
        const steps = [];
        let maxVal = values[0];

        steps.push({
            line: 1,
            description: `Initialisation: max <- T[0] = ${maxVal}.`,
            objective: 'Initialiser correctement la variable max.',
            why: 'On a besoin d’une référence de départ pour comparer les éléments suivants.',
            pitfall: 'Erreur fréquente: oublier l’initialisation et comparer avec une valeur arbitraire.',
            pitfallCategory: 'initialisation',
            cue: 'On initialise max avec le premier élément du tableau.',
            pointers: [0],
            vars: { i: '-', courant: values[0], max: maxVal, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const current = values[i];
            const before = maxVal;
            const update = current > maxVal;
            if (update) maxVal = current;

            steps.push({
                line: update ? 4 : 3,
                description: update
                    ? `T[${i}] = ${current} est plus grand que ${before}, max est mis à jour.`
                    : `T[${i}] = ${current} n’est pas plus grand que ${before}, max ne change pas.`,
                objective: 'Évaluer la condition puis mettre à jour si nécessaire.',
                why: 'Le maximum doit toujours représenter la meilleure valeur déjà vue.',
                pitfall: 'Erreur fréquente: modifier max même quand la condition est fausse.',
                pitfallCategory: update ? 'mise_a_jour' : 'condition',
                cue: update
                    ? 'Le test est vrai: la meilleure valeur change.'
                    : 'Le test est faux: on conserve le maximum courant.',
                pointers: [i],
                vars: { i, courant: current, max: maxVal, résultat: '-' },
                traceRow: {
                    i,
                    value: current,
                    before,
                    test: `${current} > ${before} -> ${AlgorithmImplementationSteps.boolLabel(update)}`,
                    after: maxVal
                },
                testBadge: {
                    tone: update ? 'ok' : 'warn',
                    text: `${current} > ${before} : ${AlgorithmImplementationSteps.boolLabel(update)}`
                }
            });
        }

        steps.push({
            line: 5,
            description: `Résultat final: max = ${maxVal}.`,
            objective: 'Conclure avec la variable de résultat correcte.',
            why: 'La boucle est terminée: max contient le plus grand élément rencontré.',
            pitfall: 'Erreur fréquente: retourner une mauvaise variable.',
            pitfallCategory: 'mise_a_jour',
            cue: 'Le résultat final est disponible.',
            pointers: [],
            vars: { i: '-', courant: '-', max: maxVal, résultat: maxVal },
            final: true,
            result: maxVal,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildCountSteps(values, target) {
        const steps = [];
        let count = 0;

        steps.push({
            line: 1,
            description: `Initialisation: compteur <- 0 (cible = ${target}).`,
            objective: 'Initialiser le compteur et la cible.',
            why: 'Le compteur doit partir de 0 avant le parcours.',
            pitfall: 'Erreur fréquente: initialiser le compteur avec une autre valeur.',
            pitfallCategory: 'initialisation',
            cue: 'On démarre avec 0 occurrence.',
            pointers: [],
            vars: { i: '-', cible: target, compteur: count, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 0; i < values.length; i += 1) {
            const current = values[i];
            const match = current === target;
            if (match) count += 1;

            steps.push({
                line: match ? 4 : 3,
                description: match
                    ? `T[${i}] = ${current} correspond à la cible, compteur augmente.`
                    : `T[${i}] = ${current} ne correspond pas à la cible.`,
                objective: 'Vérifier la cible et mettre à jour le compteur.',
                why: 'Chaque correspondance ajoute exactement 1 au total.',
                pitfall: 'Erreur fréquente: incrémenter le compteur même quand le test est faux.',
                pitfallCategory: match ? 'mise_a_jour' : 'condition',
                cue: match
                    ? 'Le test est vrai: on incrémente le compteur.'
                    : 'Le test est faux: le compteur reste identique.',
                pointers: [i],
                vars: { i, cible: target, compteur: count, résultat: '-' },
                traceRow: {
                    i,
                    value: current,
                    test: `${current} == ${target} -> ${AlgorithmImplementationSteps.boolLabel(match)}`,
                    count
                },
                testBadge: {
                    tone: match ? 'ok' : 'warn',
                    text: `${current} == ${target} : ${AlgorithmImplementationSteps.boolLabel(match)}`
                }
            });
        }

        steps.push({
            line: 5,
            description: `Résultat final: compteur = ${count}.`,
            objective: 'Conclure avec le nombre total d’occurrences.',
            why: 'Le parcours est terminé: compteur est la réponse finale.',
            pitfall: 'Erreur fréquente: oublier de retourner compteur.',
            pitfallCategory: 'mise_a_jour',
            cue: 'Le résultat final est disponible.',
            pointers: [],
            vars: { i: '-', cible: target, compteur: count, résultat: count },
            final: true,
            result: count,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildSortedSteps(values) {
        const steps = [];
        let sorted = true;

        steps.push({
            line: 1,
            description: 'Initialisation: est_trié <- vrai.',
            objective: 'Initialiser le verdict avant la boucle.',
            why: 'On suppose le tableau trié tant qu’aucune inversion n’est trouvée.',
            pitfall: 'Erreur fréquente: initialiser est_trié à faux, ce qui bloque le raisonnement.',
            pitfallCategory: 'initialisation',
            cue: 'On part avec est_trié = vrai.',
            pointers: [],
            vars: { i: '-', gauche: '-', droite: '-', est_trié: 'vrai', résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const left = values[i - 1];
            const right = values[i];
            const violation = right < left;
            if (violation) sorted = false;

            steps.push({
                line: violation ? 4 : 3,
                description: violation
                    ? `Inversion détectée: ${right} < ${left}, le tableau n’est pas trié.`
                    : `Paire valide: ${left} <= ${right}.`,
                objective: 'Comparer deux voisins T[i-1] et T[i].',
                why: 'Une seule inversion suffit pour conclure que le tableau n’est pas trié.',
                pitfall: 'Erreur fréquente: se tromper entre i et i-1 (erreur de borne).',
                pitfallCategory: violation ? 'condition' : 'bornes',
                cue: violation
                    ? 'Le test est vrai: est_trié devient faux.'
                    : 'Le test est faux: on continue la vérification.',
                pointers: [i - 1, i],
                vars: {
                    i,
                    gauche: left,
                    droite: right,
                    est_trié: AlgorithmImplementationSteps.boolLabel(sorted),
                    résultat: '-'
                },
                traceRow: {
                    i,
                    left,
                    right,
                    test: `${right} < ${left} -> ${AlgorithmImplementationSteps.boolLabel(violation)}`,
                    sorted: AlgorithmImplementationSteps.boolLabel(sorted)
                },
                testBadge: {
                    tone: violation ? 'bad' : 'ok',
                    text: `${right} < ${left} : ${AlgorithmImplementationSteps.boolLabel(violation)}`
                }
            });

            if (violation) {
                steps.push({
                    line: 5,
                    description: 'Arrêt anticipé de la boucle (break).',
                    objective: 'Sortir de la boucle dès que la réponse est connue.',
                    why: 'Après une inversion, continuer le parcours est inutile.',
                    pitfall: 'Erreur fréquente: oublier break et continuer à traiter des éléments.',
                    pitfallCategory: 'break',
                    cue: 'On arrête immédiatement la boucle.',
                    pointers: [i],
                    vars: {
                        i,
                        gauche: left,
                        droite: right,
                        est_trié: 'faux',
                        résultat: '-'
                    },
                    testBadge: { tone: 'bad', text: 'break exécuté' }
                });
                break;
            }
        }

        steps.push({
            line: 6,
            description: `Résultat final: est_trié = ${AlgorithmImplementationSteps.boolLabel(sorted)}.`,
            objective: 'Retourner le verdict logique final.',
            why: 'La variable est_trié synthétise toute la vérification.',
            pitfall: 'Erreur fréquente: retourner une variable différente du verdict.',
            pitfallCategory: 'condition',
            cue: 'Le verdict final est prêt.',
            pointers: [],
            vars: { i: '-', gauche: '-', droite: '-', est_trié: AlgorithmImplementationSteps.boolLabel(sorted), résultat: AlgorithmImplementationSteps.boolLabel(sorted) },
            final: true,
            result: sorted,
            testBadge: { tone: sorted ? 'ok' : 'warn', text: 'Verdict final disponible' }
        });

        return steps;
    }

    static buildSumSteps(values) {
        const steps = [];
        let sum = 0;

        steps.push({
            line: 1,
            description: `Initialisation: somme <- 0.`,
            objective: `Initialiser l'accumulateur somme à zéro.`,
            why: `L'accumulateur doit partir de 0 pour que tous les éléments soient comptés.`,
            pitfall: `Erreur fréquente: initialiser somme avec T[0] au lieu de 0 — ce serait faux.`,
            pitfallCategory: 'initialisation',
            cue: 'On initialise somme à 0 avant le parcours.',
            pointers: [],
            vars: { i: '-', courant: '-', somme: sum, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 0; i < values.length; i += 1) {
            const current = values[i];
            const before = sum;
            sum += current;

            steps.push({
                line: 3,
                description: `T[${i}] = ${current}, somme: ${before} + ${current} = ${sum}.`,
                objective: `Ajouter l'élément courant à l'accumulateur.`,
                why: 'Chaque élément est additionné sans condition, même les négatifs.',
                pitfall: `Erreur fréquente: sauter un élément négatif ou oublier la mise à jour.`,
                pitfallCategory: 'mise_a_jour',
                cue: `somme devient ${sum}.`,
                pointers: [i],
                vars: { i, courant: current, somme: sum, résultat: '-' },
                traceRow: { i, value: current, before, after: sum },
                testBadge: { tone: 'info', text: `${before} + ${current} = ${sum}` }
            });
        }

        steps.push({
            line: 4,
            description: `Résultat final: somme = ${sum}.`,
            objective: `Retourner l'accumulateur comme résultat.`,
            why: 'La boucle est terminée: somme contient la somme de tous les éléments.',
            pitfall: `Erreur fréquente: retourner une variable intermédiaire.`,
            pitfallCategory: 'mise_a_jour',
            cue: 'Le résultat final est disponible.',
            pointers: [],
            vars: { i: '-', courant: '-', somme: sum, résultat: sum },
            final: true,
            result: sum,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildMinSteps(values) {
        const steps = [];
        let minVal = values[0];

        steps.push({
            line: 1,
            description: `Initialisation: min <- T[0] = ${minVal}.`,
            objective: 'Initialiser correctement la variable min.',
            why: `On a besoin d'une référence de départ pour comparer les éléments suivants.`,
            pitfall: `Erreur fréquente: initialiser min avec une très grande valeur au lieu de T[0].`,
            pitfallCategory: 'initialisation',
            cue: 'On initialise min avec le premier élément du tableau.',
            pointers: [0],
            vars: { i: '-', courant: values[0], min: minVal, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const current = values[i];
            const before = minVal;
            const update = current < minVal;
            if (update) minVal = current;

            steps.push({
                line: update ? 4 : 3,
                description: update
                    ? `T[${i}] = ${current} est plus petit que ${before}, min est mis à jour.`
                    : `T[${i}] = ${current} n'est pas plus petit que ${before}, min ne change pas.`,
                objective: 'Évaluer la condition puis mettre à jour si nécessaire.',
                why: 'Le minimum doit toujours représenter la plus petite valeur déjà vue.',
                pitfall: `Erreur fréquente: confondre la condition < et > (copier l'algo du max).`,
                pitfallCategory: update ? 'mise_a_jour' : 'condition',
                cue: update
                    ? 'Le test est vrai: la plus petite valeur change.'
                    : 'Le test est faux: on conserve le minimum courant.',
                pointers: [i],
                vars: { i, courant: current, min: minVal, résultat: '-' },
                traceRow: {
                    i,
                    value: current,
                    before,
                    test: `${current} < ${before} -> ${AlgorithmImplementationSteps.boolLabel(update)}`,
                    after: minVal
                },
                testBadge: {
                    tone: update ? 'ok' : 'warn',
                    text: `${current} < ${before} : ${AlgorithmImplementationSteps.boolLabel(update)}`
                }
            });
        }

        steps.push({
            line: 5,
            description: `Résultat final: min = ${minVal}.`,
            objective: 'Conclure avec la variable de résultat correcte.',
            why: 'La boucle est terminée: min contient le plus petit élément rencontré.',
            pitfall: `Erreur fréquente: retourner une mauvaise variable.`,
            pitfallCategory: 'mise_a_jour',
            cue: 'Le résultat final est disponible.',
            pointers: [],
            vars: { i: '-', courant: '-', min: minVal, résultat: minVal },
            final: true,
            result: minVal,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildLinearSearchSteps(values, target) {
        const steps = [];

        for (let i = 0; i < values.length; i += 1) {
            const current = values[i];
            const match = current === target;

            steps.push({
                line: match ? 3 : 2,
                description: match
                    ? `T[${i}] = ${current} correspond à la cible: résultat = ${i}.`
                    : `T[${i}] = ${current} ne correspond pas à la cible, on continue.`,
                objective: `Comparer l'élément courant à la cible.`,
                why: `On cherche le premier indice où T[i] est égal à la cible.`,
                pitfall: `Erreur fréquente: continuer après avoir trouvé la cible au lieu de retourner.`,
                pitfallCategory: match ? 'break' : 'condition',
                cue: match
                    ? `Correspondance trouvée: on retourne l'indice.`
                    : `Pas de correspondance: on passe à l'élément suivant.`,
                pointers: [i],
                vars: { i, courant: current, cible: target, résultat: match ? i : -1 },
                traceRow: {
                    i,
                    value: current,
                    test: `${current} == ${target} -> ${AlgorithmImplementationSteps.boolLabel(match)}`,
                    result: match ? i : -1
                },
                testBadge: {
                    tone: match ? 'ok' : 'warn',
                    text: `${current} == ${target} : ${AlgorithmImplementationSteps.boolLabel(match)}`
                }
            });

            if (match) {
                steps.push({
                    line: 3,
                    description: `Retour anticipé: résultat = ${i}.`,
                    objective: `Retourner l'indice trouvé immédiatement.`,
                    why: `Dès que la cible est trouvée, inutile de continuer le parcours.`,
                    pitfall: `Erreur fréquente: oublier de retourner et continuer la boucle.`,
                    pitfallCategory: 'break',
                    cue: `La cible ${target} est à l'indice ${i}.`,
                    pointers: [i],
                    vars: { i, courant: current, cible: target, résultat: i },
                    final: true,
                    result: i,
                    testBadge: { tone: 'ok', text: `retourner ${i}` }
                });
                return steps;
            }
        }

        steps.push({
            line: 4,
            description: `Cible ${target} absente: résultat = -1.`,
            objective: `Retourner -1 pour signaler l'absence de la cible.`,
            why: `La convention universelle: -1 signifie "non trouvé" sans ambiguïté.`,
            pitfall: `Erreur fréquente: retourner 0 au lieu de -1 (confusion avec l'indice 0).`,
            pitfallCategory: 'mise_a_jour',
            cue: 'La cible est absente du tableau.',
            pointers: [],
            vars: { i: '-', courant: '-', cible: target, résultat: -1 },
            final: true,
            result: -1,
            testBadge: { tone: 'bad', text: 'Non trouvé: retourner -1' }
        });

        return steps;
    }

    static buildMaxAbsSteps(values) {
        const steps = [];
        let maxAbs = Math.abs(values[0]);

        steps.push({
            line: 1,
            description: `Initialisation: max_abs <- |T[0]| = ${maxAbs}.`,
            objective: 'Initialiser max_abs avec la valeur absolue du premier élément.',
            why: 'La valeur absolue de T[0] est la référence de départ pour la comparaison.',
            pitfall: 'Erreur fréquente: initialiser avec T[0] sans valeur absolue — incorrect si T[0] est négatif.',
            pitfallCategory: 'initialisation',
            cue: `On initialise max_abs avec |${values[0]}| = ${maxAbs}.`,
            pointers: [0],
            vars: { i: '-', courant: values[0], abs_courant: maxAbs, max_abs: maxAbs, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const current = values[i];
            const absVal = Math.abs(current);
            const before = maxAbs;
            const update = absVal > maxAbs;
            if (update) maxAbs = absVal;

            steps.push({
                line: update ? 4 : 3,
                description: update
                    ? `|T[${i}]| = ${absVal} > ${before}: max_abs mis à jour à ${maxAbs}.`
                    : `|T[${i}]| = ${absVal} <= ${before}: max_abs ne change pas.`,
                objective: 'Calculer |T[i]| et comparer avec max_abs.',
                why: 'On compare les valeurs absolues, jamais les entiers signés directement.',
                pitfall: 'Erreur fréquente: oublier d\'appliquer la valeur absolue avant la comparaison.',
                pitfallCategory: update ? 'mise_a_jour' : 'condition',
                cue: update
                    ? `|${current}| = ${absVal} > ${before}: max_abs devient ${maxAbs}.`
                    : `|${current}| = ${absVal} <= ${before}: max_abs reste ${maxAbs}.`,
                pointers: [i],
                vars: { i, courant: current, abs_courant: absVal, max_abs: maxAbs, résultat: '-' },
                traceRow: {
                    i,
                    value: current,
                    abs: absVal,
                    before,
                    test: `${absVal} > ${before} -> ${AlgorithmImplementationSteps.boolLabel(update)}`,
                    after: maxAbs
                },
                testBadge: {
                    tone: update ? 'ok' : 'warn',
                    text: `|${current}| > ${before} : ${AlgorithmImplementationSteps.boolLabel(update)}`
                }
            });
        }

        steps.push({
            line: 5,
            description: `Résultat final: max_abs = ${maxAbs}.`,
            objective: 'Retourner la plus grande valeur absolue trouvée.',
            why: 'La boucle est terminée: max_abs contient la réponse.',
            pitfall: 'Erreur fréquente: retourner une variable différente du résultat attendu.',
            pitfallCategory: 'mise_a_jour',
            cue: 'Le résultat final est disponible.',
            pointers: [],
            vars: { i: '-', courant: '-', abs_courant: '-', max_abs: maxAbs, résultat: maxAbs },
            final: true,
            result: maxAbs,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildMinMaxSteps(values) {
        const steps = [];
        let minVal = values[0];
        let maxVal = values[0];

        steps.push({
            line: 1,
            description: `Initialisation: min <- T[0] = ${minVal}, max <- T[0] = ${maxVal}.`,
            objective: 'Initialiser min et max avec le premier élément.',
            why: 'T[0] est une référence valide pour les deux: le tableau n\'est pas vide.',
            pitfall: 'Erreur fréquente: initialiser min et max à 0 — incorrect si tous les éléments sont négatifs.',
            pitfallCategory: 'initialisation',
            cue: 'On démarre avec min = max = T[0].',
            pointers: [0],
            vars: { i: '-', courant: values[0], min: minVal, max: maxVal, résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const current = values[i];
            const beforeMin = minVal;
            const beforeMax = maxVal;
            const updateMin = current < minVal;
            const updateMax = current > maxVal;
            if (updateMin) minVal = current;
            if (updateMax) maxVal = current;

            steps.push({
                line: updateMin ? 5 : 4,
                description: updateMin
                    ? `T[${i}] = ${current} < min=${beforeMin}: min mis à jour à ${minVal}.`
                    : `T[${i}] = ${current} >= min=${beforeMin}: min reste ${minVal}.`,
                objective: 'Vérifier si l\'élément courant est plus petit que min.',
                why: 'On cherche simultanément min et max en un seul parcours du tableau.',
                pitfall: 'Erreur fréquente: confondre la condition du min (< ) avec celle du max (> ).',
                pitfallCategory: updateMin ? 'mise_a_jour' : 'condition',
                cue: updateMin
                    ? `${current} < ${beforeMin}: min devient ${minVal}.`
                    : `${current} >= ${beforeMin}: min reste ${minVal}.`,
                pointers: [i],
                vars: { i, courant: current, min: minVal, max: maxVal, résultat: '-' },
                predictionTarget: 'min',
                traceRow: { i, value: current, min: minVal, max: maxVal },
                testBadge: {
                    tone: updateMin ? 'ok' : 'warn',
                    text: `${current} < ${beforeMin} : ${AlgorithmImplementationSteps.boolLabel(updateMin)}`
                }
            });

            steps.push({
                line: updateMax ? 7 : 6,
                description: updateMax
                    ? `T[${i}] = ${current} > max=${beforeMax}: max mis à jour à ${maxVal}.`
                    : `T[${i}] = ${current} <= max=${beforeMax}: max reste ${maxVal}.`,
                objective: 'Vérifier si l\'élément courant est plus grand que max.',
                why: 'Les deux comparaisons sont indépendantes: un élément peut mettre à jour les deux variables.',
                pitfall: 'Erreur fréquente: croire qu\'un seul if/else suffit pour gérer min et max.',
                pitfallCategory: updateMax ? 'mise_a_jour' : 'condition',
                cue: updateMax
                    ? `${current} > ${beforeMax}: max devient ${maxVal}.`
                    : `${current} <= ${beforeMax}: max reste ${maxVal}.`,
                pointers: [i],
                vars: { i, courant: current, min: minVal, max: maxVal, résultat: '-' },
                predictionTarget: 'max',
                testBadge: {
                    tone: updateMax ? 'ok' : 'warn',
                    text: `${current} > ${beforeMax} : ${AlgorithmImplementationSteps.boolLabel(updateMax)}`
                }
            });
        }

        steps.push({
            line: 8,
            description: `Résultat final: min = ${minVal}, max = ${maxVal}.`,
            objective: 'Retourner les deux valeurs extrêmes.',
            why: 'En un seul parcours, on a obtenu les deux réponses.',
            pitfall: 'Erreur fréquente: ne retourner qu\'une seule des deux valeurs.',
            pitfallCategory: 'mise_a_jour',
            cue: 'Les deux résultats sont disponibles.',
            pointers: [],
            vars: { i: '-', courant: '-', min: minVal, max: maxVal, résultat: `${minVal} / ${maxVal}` },
            final: true,
            result: `${minVal} / ${maxVal}`,
            testBadge: { tone: 'ok', text: 'Résultat validé' }
        });

        return steps;
    }

    static buildDuplicateCheckSteps(values) {
        const steps = [];
        let doublon = false;

        steps.push({
            line: 1,
            description: 'Initialisation: doublon <- faux.',
            objective: 'Supposer qu\'il n\'y a pas de doublon jusqu\'à preuve du contraire.',
            why: 'On part de l\'hypothèse "sans doublon", qu\'on peut réfuter en cours de parcours.',
            pitfall: 'Erreur fréquente: initialiser doublon à vrai, ce qui donnerait toujours un faux positif.',
            pitfallCategory: 'initialisation',
            cue: 'On démarre avec doublon = faux.',
            pointers: [],
            vars: { i: '-', gauche: '-', droite: '-', doublon: 'faux', résultat: '-' },
            testBadge: { tone: 'info', text: 'Aucun test conditionnel à cette étape' }
        });

        for (let i = 1; i < values.length; i += 1) {
            const left = values[i - 1];
            const right = values[i];
            const match = right === left;
            if (match) doublon = true;

            steps.push({
                line: match ? 4 : 3,
                description: match
                    ? `T[${i - 1}] = ${left} est égal à T[${i}] = ${right}: doublon trouvé !`
                    : `T[${i - 1}] = ${left} est différent de T[${i}] = ${right}: pas de doublon ici.`,
                objective: 'Comparer deux éléments adjacents du tableau.',
                why: 'Dans un tableau trié, deux éléments égaux sont forcément adjacents.',
                pitfall: 'Erreur fréquente: comparer des éléments non adjacents.',
                pitfallCategory: 'condition',
                cue: match
                    ? `${left} == ${right}: doublon détecté, doublon devient vrai.`
                    : `${left} != ${right}: on continue la vérification.`,
                pointers: [i - 1, i],
                vars: { i, gauche: left, droite: right, doublon: match ? 'vrai' : 'faux', résultat: '-' },
                traceRow: {
                    i,
                    left,
                    right,
                    test: `${left} == ${right} -> ${AlgorithmImplementationSteps.boolLabel(match)}`,
                    doublon: AlgorithmImplementationSteps.boolLabel(match)
                },
                testBadge: {
                    tone: match ? 'warn' : 'ok',
                    text: `${left} == ${right} : ${AlgorithmImplementationSteps.boolLabel(match)}`
                }
            });

            if (match) {
                steps.push({
                    line: 5,
                    description: 'Arrêt anticipé de la boucle (break): un doublon a été confirmé.',
                    objective: 'Sortir de la boucle dès qu\'un doublon est trouvé.',
                    why: 'Continuer est inutile: la réponse est connue.',
                    pitfall: 'Erreur fréquente: oublier break et continuer à comparer les éléments suivants.',
                    pitfallCategory: 'break',
                    cue: 'La boucle s\'arrête immédiatement.',
                    pointers: [i - 1, i],
                    vars: { i, gauche: left, droite: right, doublon: 'vrai', résultat: '-' },
                    testBadge: { tone: 'bad', text: 'break exécuté' }
                });
                break;
            }
        }

        steps.push({
            line: 6,
            description: `Résultat final: doublon = ${AlgorithmImplementationSteps.boolLabel(doublon)}.`,
            objective: 'Retourner le verdict sur la présence de doublons adjacents.',
            why: 'Le parcours est terminé: doublon synthétise le résultat.',
            pitfall: 'Erreur fréquente: inverser la valeur retournée ou retourner un entier au lieu d\'un booléen.',
            pitfallCategory: 'condition',
            cue: 'Le verdict final est prêt.',
            pointers: [],
            vars: {
                i: '-', gauche: '-', droite: '-',
                doublon: AlgorithmImplementationSteps.boolLabel(doublon),
                résultat: AlgorithmImplementationSteps.boolLabel(doublon)
            },
            final: true,
            result: doublon,
            testBadge: { tone: doublon ? 'warn' : 'ok', text: 'Verdict final disponible' }
        });

        return steps;
    }

    static buildBubbleSortSteps(values) {
        const steps = [];
        const arr = [...values];
        const n = arr.length;

        for (let i = 0; i < n - 1; i += 1) {
            for (let j = 0; j < n - 1 - i; j += 1) {
                const left = arr[j];
                const right = arr[j + 1];
                const shouldSwap = left > right;

                if (shouldSwap) {
                    arr[j] = right;
                    arr[j + 1] = left;
                }

                steps.push({
                    line: shouldSwap ? 4 : 3,
                    description: shouldSwap
                        ? `i=${i}, j=${j}: T[${j}]=${left} > T[${j + 1}]=${right} — échange effectué.`
                        : `i=${i}, j=${j}: T[${j}]=${left} <= T[${j + 1}]=${right} — pas d'échange.`,
                    objective: 'Comparer T[j] et T[j+1], échanger si T[j] > T[j+1].',
                    why: 'Le tri à bulles remonte les grands éléments vers la droite, passage par passage.',
                    pitfall: shouldSwap
                        ? 'Erreur fréquente: oublier la variable temporaire lors de l\'échange (écraser une valeur).'
                        : 'Erreur fréquente: échanger les éléments quand le test est faux.',
                    pitfallCategory: shouldSwap ? 'mise_a_jour' : 'condition',
                    cue: shouldSwap
                        ? `${left} > ${right}: les deux cases sont échangées.`
                        : `${left} <= ${right}: l'ordre est correct, on continue.`,
                    pointers: [j, j + 1],
                    vars: {
                        i,
                        j,
                        gauche: left,
                        droite: right,
                        échangé: AlgorithmImplementationSteps.boolLabel(shouldSwap),
                        résultat: '-'
                    },
                    arrayState: [...arr],
                    changedIndices: shouldSwap ? [j, j + 1] : [],
                    traceRow: {
                        i,
                        j,
                        left,
                        right,
                        test: `${left} > ${right} -> ${AlgorithmImplementationSteps.boolLabel(shouldSwap)}`,
                        swap: AlgorithmImplementationSteps.boolLabel(shouldSwap)
                    },
                    testBadge: {
                        tone: shouldSwap ? 'warn' : 'ok',
                        text: `${left} > ${right} : ${AlgorithmImplementationSteps.boolLabel(shouldSwap)}`
                    }
                });
            }
        }

        steps.push({
            line: 1,
            description: `Tri terminé. Tableau trié : [${arr.join(', ')}].`,
            objective: 'Le tableau est maintenant trié par ordre croissant.',
            why: 'Après n-1 passages, chaque élément est à sa place définitive.',
            pitfall: 'Rappel: le tri à bulles est O(n²) — il existe des algorithmes bien plus efficaces.',
            pitfallCategory: 'mise_a_jour',
            cue: 'Tous les passages sont terminés.',
            pointers: [],
            vars: { i: '-', j: '-', gauche: '-', droite: '-', échangé: '-', résultat: arr.join(', ') },
            arrayState: [...arr],
            skipPrediction: true,
            final: true,
            result: arr.join(', '),
            testBadge: { tone: 'ok', text: 'Tri terminé' }
        });

        return steps;
    }
}

if (typeof window !== 'undefined') {
    window.AlgorithmImplementationSteps = AlgorithmImplementationSteps;
}
