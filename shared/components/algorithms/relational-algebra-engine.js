/**
 * relational-algebra-engine.js - moteur PUR de l'algèbre relationnelle : sélection σ,
 * projection π, jointure ⨝, union, différence, produit ×, renommage ρ.
 * Aucune dépendance au DOM : RelationalAlgebraPage ne fait que l'afficher.
 *
 * Règles alignées sur le cours `bdd/algebre` (relecture 2c, B3, AL-I3) :
 * - conditions de sélection : `ET` plus prioritaire que `OU`, `NON`, parenthèses ;
 *   les chaînes entre quotes peuvent contenir des mots-clés (`ville = 'ET'`) ;
 * - noms de colonnes qualifiés acceptés (`Employes.age`, `Employes.departement_id =
 *   Departements.id`) ;
 * - algèbre sur des ENSEMBLES : projection et union éliminent les doublons, contrairement
 *   à `SELECT` en SQL.
 * Schéma de démonstration identique à celui du bac à sable SQL (employes, departements,
 * projets), avec un département sans projet pour que LEFT JOIN et INNER JOIN diffèrent.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.RelationalAlgebraEngine = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const INITIAL_TABLES = {
        Employes: {
            columns: ['id', 'nom', 'departement_id', 'salaire'],
            rows: [
                [1, 'Alice', 1, 52000],
                [2, 'Bob', 2, 45000],
                [3, 'Charlie', 1, 48000],
                [4, 'Diana', 3, 55000],
                [5, 'Eve', 2, 42000],
                [6, 'Frank', 1, 60000],
                [7, 'Grace', 3, 47000],
                [8, 'Hugo', 2, 51000],
                [9, 'Iris', 1, 39000],
                [10, 'Jules', 3, 58000]
            ]
        },
        Departements: {
            columns: ['id', 'nom', 'budget'],
            rows: [
                [1, 'Informatique', 500000],
                [2, 'Marketing', 300000],
                [3, 'Recherche', 450000],
                [4, 'Support', 200000]
            ]
        },
        Projets: {
            columns: ['id', 'nom', 'dept_id'],
            rows: [
                [1, 'Site Web', 1],
                [2, 'App Mobile', 1],
                [3, 'Campagne Pub', 2],
                [4, 'IA Chatbot', 3],
                [5, 'Data Lake', 3]
            ]
        }
    };

    const COMPARE_RE = /^(=|!=|<>|>=|<=|>|<)$/;

    function compare(left, oper, right) {
        switch (oper) {
            case '=': return left == right;
            case '!=':
            case '<>':
                return left != right;
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            default: return false;
        }
    }

    /**
     * Indice d'une colonne : nom exact, nom préfixé par la table source (`Employes.age`),
     * ou nom court d'une colonne qualifiée d'un résultat de jointure (`age` pour `Employes.age`).
     */
    function resolveColumn(cols, name, tableName) {
        let idx = cols.indexOf(name);
        if (idx !== -1) return idx;
        const dot = name.lastIndexOf('.');
        if (dot !== -1 && tableName && name.slice(0, dot) === tableName) {
            idx = cols.indexOf(name.slice(dot + 1));
            if (idx !== -1) return idx;
        }
        if (dot === -1) {
            const matches = [];
            cols.forEach(function (c, i) { if (c.slice(c.lastIndexOf('.') + 1) === name) matches.push(i); });
            if (matches.length === 1) return matches[0];
            if (matches.length > 1) throw new Error('Colonne ambiguë : ' + name + ' (écris ' + cols[matches[0]] + ' ou ' + cols[matches[1]] + ').');
        }
        throw new Error('Colonne inconnue : ' + name);
    }

    /** Découpe une condition en jetons ; les chaînes entre quotes restent un seul jeton. */
    function tokenizeCondition(input) {
        const tokens = [];
        const re = /\s*(\(|\)|!=|<>|>=|<=|=|>|<|'[^']*'|"[^"]*"|[^\s()=!<>'"]+)/gy;
        let m;
        let consumed = 0;
        while ((m = re.exec(input)) !== null) {
            tokens.push(m[1]);
            consumed = re.lastIndex;
        }
        if (input.slice(consumed).trim() !== '') {
            throw new Error('Condition invalide : ' + input.trim());
        }
        return tokens;
    }

    function isKeyword(token, words) {
        return token !== undefined && /^[^'"]/.test(token) && words.indexOf(token.toUpperCase()) !== -1;
    }

    /**
     * Compile une condition en fonction (row, cols) → booléen.
     * Grammaire : ou := et (OU et)* ; et := non (ET non)* ; non := NON non | atome.
     */
    function parseCondition(condStr, tableName) {
        const input = String(condStr || '').trim();
        if (!input) throw new Error('Condition invalide : vide.');
        const tokens = tokenizeCondition(input);
        let pos = 0;

        function parseOr() {
            const parts = [parseAnd()];
            while (isKeyword(tokens[pos], ['OU', 'OR'])) {
                pos++;
                parts.push(parseAnd());
            }
            return parts.length === 1 ? parts[0] : function (row, cols) { return parts.some(function (fn) { return fn(row, cols); }); };
        }

        function parseAnd() {
            const parts = [parseNot()];
            while (isKeyword(tokens[pos], ['ET', 'AND'])) {
                pos++;
                parts.push(parseNot());
            }
            return parts.length === 1 ? parts[0] : function (row, cols) { return parts.every(function (fn) { return fn(row, cols); }); };
        }

        function parseNot() {
            if (isKeyword(tokens[pos], ['NON', 'NOT'])) {
                pos++;
                const inner = parseNot();
                return function (row, cols) { return !inner(row, cols); };
            }
            return parseAtom();
        }

        function parseAtom() {
            const t = tokens[pos];
            if (t === undefined) throw new Error('Condition incomplète : ' + input);
            if (t === '(') {
                pos++;
                const inner = parseOr();
                if (tokens[pos] !== ')') throw new Error('Parenthèse fermante manquante : ' + input);
                pos++;
                return inner;
            }
            const col = t;
            const oper = tokens[pos + 1];
            const rawVal = tokens[pos + 2];
            if (!/^[A-Za-z_][\w.]*$/.test(col) || oper === undefined || !COMPARE_RE.test(oper) || rawVal === undefined) {
                throw new Error('Condition invalide : ' + input);
            }
            pos += 3;
            const parsedValue = rawVal.replace(/^['"]|['"]$/g, '');
            return function (row, cols) {
                const ci = resolveColumn(cols, col, tableName);
                const cellVal = row[ci];
                let cmpVal = parsedValue;
                if (typeof cellVal === 'number') cmpVal = Number(cmpVal);
                return compare(cellVal, oper, cmpVal);
            };
        }

        const fn = parseOr();
        if (pos < tokens.length) throw new Error('Condition invalide près de « ' + tokens[pos] + ' » : ' + input);
        return fn;
    }

    const engine = {
        parseCondition: parseCondition,
        compare: compare,

        selection: function (tableName, tableDef, condition) {
            if (!condition) throw new Error('Veuillez saisir une condition.');
            const condFn = parseCondition(condition, tableName);
            const matchedIndices = [];
            const rows = [];
            tableDef.rows.forEach(function (row, idx) {
                if (condFn(row, tableDef.columns)) {
                    matchedIndices.push(idx);
                    rows.push(row.slice());
                }
            });
            return {
                resultTable: { columns: tableDef.columns.slice(), rows: rows },
                matchedIndices: matchedIndices,
                expression: 'σ<sub>' + condition + '</sub>(' + tableName + ')',
                message: rows.length + ' ligne(s) sélectionnée(s) sur ' + tableDef.rows.length + '.'
            };
        },

        projection: function (tableName, tableDef, keepColumns) {
            if (!keepColumns.length) throw new Error('Sélectionne au moins une colonne.');
            const keepIndices = keepColumns.map(function (col) {
                const idx = tableDef.columns.indexOf(col);
                if (idx === -1) throw new Error('Colonne inconnue : ' + col);
                return idx;
            });
            const seen = new Set();
            const rows = [];
            tableDef.rows.forEach(function (row) {
                const projected = keepIndices.map(function (i) { return row[i]; });
                const key = JSON.stringify(projected);
                if (!seen.has(key)) {
                    seen.add(key);
                    rows.push(projected);
                }
            });
            const dropped = tableDef.rows.length - rows.length;
            return {
                resultTable: { columns: keepColumns.slice(), rows: rows },
                expression: 'π<sub>' + keepColumns.join(',') + '</sub>(' + tableName + ')',
                message: 'Projection : ' + keepColumns.length + ' colonne(s), ' + rows.length + ' ligne(s)' +
                    (dropped > 0 ? ' (' + dropped + ' doublon(s) éliminé(s), ce que SELECT ne fait pas).' : ' (aucun doublon à éliminer).')
            };
        },

        join: function (leftName, rightName, leftTable, rightTable, condition) {
            const rows = [];
            let columns = [];
            let message;
            if (!condition) {
                const common = leftTable.columns.filter(function (col) { return rightTable.columns.indexOf(col) !== -1; });
                if (!common.length) {
                    throw new Error('Aucune colonne commune pour la jointure naturelle : écris une condition (ex. departement_id = id).');
                }
                const rightOnly = rightTable.columns.filter(function (col) { return common.indexOf(col) === -1; });
                columns = leftTable.columns.concat(rightOnly);
                leftTable.rows.forEach(function (leftRow) {
                    rightTable.rows.forEach(function (rightRow) {
                        const matches = common.every(function (col) {
                            return leftRow[leftTable.columns.indexOf(col)] == rightRow[rightTable.columns.indexOf(col)];
                        });
                        if (matches) {
                            rows.push(leftRow.concat(rightOnly.map(function (col) { return rightRow[rightTable.columns.indexOf(col)]; })));
                        }
                    });
                });
                message = 'Jointure naturelle sur ' + common.join(', ') + ' : ' + rows.length + ' ligne(s).';
                if (!rows.length && common.length > 1) {
                    message += ' La jointure naturelle compare TOUTES les colonnes de même nom : utilise une condition (ex. departement_id = id).';
                }
            } else {
                const match = condition.match(/^([\w.]+)\s*(=|!=|<>|>=|<=|>|<)\s*([\w.]+)$/);
                if (!match) {
                    throw new Error('Format de condition : colonne1 = colonne2 (ex. departement_id = id).');
                }
                const leftColRaw = match[1];
                const oper = match[2];
                const rightColRaw = match[3];
                columns = leftTable.columns.map(function (col) { return leftName + '.' + col; })
                    .concat(rightTable.columns.map(function (col) { return rightName + '.' + col; }));
                const resolve = function (raw, name, table, otherName) {
                    const dot = raw.lastIndexOf('.');
                    if (dot !== -1 && raw.slice(0, dot) === otherName && otherName !== name) {
                        throw new Error('Colonne « ' + raw + ' » : attendue dans ' + name + '.');
                    }
                    const bare = dot === -1 ? raw : raw.slice(dot + 1);
                    const idx = table.columns.indexOf(bare);
                    if (idx === -1) throw new Error('Colonne inconnue dans ' + name + ' : ' + raw);
                    return idx;
                };
                const leftIdx = resolve(leftColRaw, leftName, leftTable, rightName);
                const rightIdx = resolve(rightColRaw, rightName, rightTable, leftName);
                leftTable.rows.forEach(function (leftRow) {
                    rightTable.rows.forEach(function (rightRow) {
                        if (compare(leftRow[leftIdx], oper, rightRow[rightIdx])) {
                            rows.push(leftRow.concat(rightRow));
                        }
                    });
                });
                message = 'Jointure : ' + rows.length + ' ligne(s).';
            }
            const expression = condition
                ? leftName + ' ⨝<sub>' + condition + '</sub> ' + rightName
                : leftName + ' ⨝ ' + rightName;
            return { resultTable: { columns: columns, rows: rows }, expression: expression, message: message };
        },

        setOperation: function (op, leftName, rightName, leftTable, rightTable) {
            if (leftTable.columns.length !== rightTable.columns.length) {
                throw new Error('Les tables doivent avoir le même nombre de colonnes.');
            }
            const sameSchema = leftTable.columns.every(function (col, idx) {
                return col.toLowerCase() === rightTable.columns[idx].toLowerCase();
            });
            if (!sameSchema) {
                throw new Error('Les schémas doivent être compatibles (mêmes colonnes dans le même ordre).');
            }
            let rows = [];
            if (op === 'union') {
                const seen = new Set();
                leftTable.rows.concat(rightTable.rows).forEach(function (row) {
                    const key = JSON.stringify(row);
                    if (!seen.has(key)) {
                        seen.add(key);
                        rows.push(row.slice());
                    }
                });
            } else {
                const rightKeys = new Set(rightTable.rows.map(function (row) { return JSON.stringify(row); }));
                rows = leftTable.rows.filter(function (row) { return !rightKeys.has(JSON.stringify(row)); })
                    .map(function (row) { return row.slice(); });
            }
            const symbol = op === 'union' ? '∪' : '−';
            return {
                resultTable: { columns: leftTable.columns.slice(), rows: rows },
                expression: leftName + ' ' + symbol + ' ' + rightName,
                message: (op === 'union' ? 'Union' : 'Différence') + ' : ' + rows.length + ' ligne(s).'
            };
        },

        product: function (leftName, rightName, leftTable, rightTable) {
            const columns = leftTable.columns.map(function (col) { return leftName + '.' + col; })
                .concat(rightTable.columns.map(function (col) { return rightName + '.' + col; }));
            const rows = [];
            leftTable.rows.forEach(function (leftRow) {
                rightTable.rows.forEach(function (rightRow) {
                    rows.push(leftRow.concat(rightRow));
                });
            });
            return {
                resultTable: { columns: columns, rows: rows },
                expression: leftName + ' × ' + rightName,
                message: 'Produit cartésien : ' + rows.length + ' ligne(s) (' + leftTable.rows.length + ' × ' + rightTable.rows.length + ').'
            };
        },

        rename: function (tableName, tableDef, oldName, newName) {
            if (!oldName || !newName) throw new Error('Remplis les deux champs.');
            const colIdx = tableDef.columns.indexOf(oldName);
            if (colIdx === -1) throw new Error('Colonne "' + oldName + '" introuvable dans ' + tableName + '.');
            if (tableDef.columns.indexOf(newName) !== -1 && oldName !== newName) {
                throw new Error('La colonne "' + newName + '" existe déjà dans ' + tableName + '.');
            }
            const columns = tableDef.columns.slice();
            columns[colIdx] = newName;
            return {
                resultTable: { columns: columns, rows: tableDef.rows.map(function (row) { return row.slice(); }) },
                expression: 'ρ<sub>' + newName + '/' + oldName + '</sub>(' + tableName + ')',
                message: 'Colonne "' + oldName + '" renommée en "' + newName + '".'
            };
        }
    };

    return { algebraEngine: engine, ALGEBRA_INITIAL_TABLES: INITIAL_TABLES };
});
