class SqlPlaygroundPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
    (() => {
        'use strict';

        // ── In-memory database ──
        const DB = {
            tables: {},
            autoIncrements: {},

            reset() {
                this.tables = {
                    employes: {
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
                    departements: {
                        columns: ['id', 'nom', 'budget'],
                        rows: [
                            [1, 'Informatique', 500000],
                            [2, 'Marketing', 300000],
                            [3, 'Recherche', 450000]
                        ]
                    },
                    projets: {
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
            }
        };
        DB.reset();

        // ── Tokenizer ──
        function tokenize(sql) {
            const tokens = [];
            let i = 0;
            while (i < sql.length) {
                if (/\s/.test(sql[i])) { i++; continue; }
                if (sql[i] === '-' && sql[i+1] === '-') {
                    while (i < sql.length && sql[i] !== '\n') i++;
                    continue;
                }
                if (sql[i] === "'" || sql[i] === '"') {
                    const q = sql[i]; let s = ''; i++;
                    while (i < sql.length && sql[i] !== q) { s += sql[i]; i++; }
                    i++;
                    tokens.push({ type: 'STRING', value: s });
                    continue;
                }
                if (/[0-9]/.test(sql[i]) || (sql[i] === '-' && i+1 < sql.length && /[0-9]/.test(sql[i+1]))) {
                    let n = sql[i]; i++;
                    while (i < sql.length && /[0-9.]/.test(sql[i])) { n += sql[i]; i++; }
                    tokens.push({ type: 'NUMBER', value: parseFloat(n) });
                    continue;
                }
                if (/[a-zA-Z_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(sql[i])) {
                    let w = '';
                    while (i < sql.length && /[a-zA-Z0-9_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(sql[i])) { w += sql[i]; i++; }
                    tokens.push({ type: 'WORD', value: w });
                    continue;
                }
                if (['(', ')', ',', ';', '*', '+', '-', '/', '%'].includes(sql[i])) {
                    tokens.push({ type: 'SYMBOL', value: sql[i] }); i++; continue;
                }
                if (sql[i] === '>' && sql[i+1] === '=') { tokens.push({ type: 'OP', value: '>=' }); i += 2; continue; }
                if (sql[i] === '<' && sql[i+1] === '=') { tokens.push({ type: 'OP', value: '<=' }); i += 2; continue; }
                if (sql[i] === '!' && sql[i+1] === '=') { tokens.push({ type: 'OP', value: '!=' }); i += 2; continue; }
                if (sql[i] === '<' && sql[i+1] === '>') { tokens.push({ type: 'OP', value: '!=' }); i += 2; continue; }
                if (sql[i] === '=' ) { tokens.push({ type: 'OP', value: '=' }); i++; continue; }
                if (sql[i] === '>' ) { tokens.push({ type: 'OP', value: '>' }); i++; continue; }
                if (sql[i] === '<' ) { tokens.push({ type: 'OP', value: '<' }); i++; continue; }
                if (sql[i] === '.') { tokens.push({ type: 'DOT', value: '.' }); i++; continue; }
                i++;
            }
            return tokens;
        }

        // ── Parser helpers ──
        class Parser {
            constructor(tokens) {
                this.tokens = tokens;
                this.pos = 0;
            }
            peek() { return this.pos < this.tokens.length ? this.tokens[this.pos] : null; }
            next() { return this.tokens[this.pos++]; }
            expect(type, value) {
                const t = this.next();
                if (!t) throw new Error(`Fin inattendue, attendu : ${value || type}`);
                if (t.type !== type || (value && t.value.toUpperCase() !== value.toUpperCase()))
                    throw new Error(`Attendu "${value || type}", reçu "${t.value}"`);
                return t;
            }
            isWord(val) {
                const t = this.peek();
                return t && t.type === 'WORD' && t.value.toUpperCase() === val.toUpperCase();
            }
            isSymbol(val) {
                const t = this.peek();
                return t && t.type === 'SYMBOL' && t.value === val;
            }
            isOp() {
                const t = this.peek();
                return t && t.type === 'OP';
            }
            skipSemicolon() {
                while (this.peek() && this.isSymbol(';')) this.next();
            }
        }

        // ── Expression evaluator ──
        function resolveColumn(name, row, columns, aliases) {
            let tbl = null, col = name;
            if (name.includes('.')) { [tbl, col] = name.split('.'); }
            const colLower = col.toLowerCase();
            for (let i = 0; i < columns.length; i++) {
                const c = columns[i].toLowerCase();
                const parts = c.split('.');
                const cn = parts[parts.length - 1];
                if (tbl) {
                    const tn = parts.length > 1 ? parts[0] : '';
                    if (cn === colLower && (tn === tbl.toLowerCase() || (aliases && aliases[tbl.toLowerCase()] && aliases[tbl.toLowerCase()].toLowerCase() === tn))) {
                        return row[i];
                    }
                    if (cn === colLower && aliases) {
                        for (const [alias, tableName] of Object.entries(aliases)) {
                            if (alias.toLowerCase() === tbl.toLowerCase() && c.startsWith(tableName.toLowerCase() + '.')) return row[i];
                        }
                    }
                } else {
                    if (cn === colLower) return row[i];
                }
            }
            return undefined;
        }

        function evalExpr(expr, row, columns, aliases) {
            if (expr === null || expr === undefined) return null;
            if (expr.type === 'literal') return expr.value;
            if (expr.type === 'column') {
                const v = resolveColumn(expr.name, row, columns, aliases);
                if (v === undefined) throw new Error(`Colonne inconnue : "${expr.name}"`);
                return v;
            }
            if (expr.type === 'star') return '*';
            if (expr.type === 'binary') {
                const l = evalExpr(expr.left, row, columns, aliases);
                const r = evalExpr(expr.right, row, columns, aliases);
                switch (expr.op) {
                    case '+': return (l||0) + (r||0);
                    case '-': return (l||0) - (r||0);
                    case '*': return (l||0) * (r||0);
                    case '/': return r !== 0 ? (l||0) / (r||0) : null;
                    case '%': return r !== 0 ? (l||0) % (r||0) : null;
                    case '=': return l == r ? 1 : 0;
                    case '!=': return l != r ? 1 : 0;
                    case '>': return l > r ? 1 : 0;
                    case '<': return l < r ? 1 : 0;
                    case '>=': return l >= r ? 1 : 0;
                    case '<=': return l <= r ? 1 : 0;
                }
            }
            if (expr.type === 'and') {
                return evalExpr(expr.left, row, columns, aliases) && evalExpr(expr.right, row, columns, aliases) ? 1 : 0;
            }
            if (expr.type === 'or') {
                return evalExpr(expr.left, row, columns, aliases) || evalExpr(expr.right, row, columns, aliases) ? 1 : 0;
            }
            if (expr.type === 'not') {
                return evalExpr(expr.expr, row, columns, aliases) ? 0 : 1;
            }
            if (expr.type === 'func') {
                return null; // aggregates handled elsewhere
            }
            if (expr.type === 'between') {
                const val = evalExpr(expr.expr, row, columns, aliases);
                const lo = evalExpr(expr.low, row, columns, aliases);
                const hi = evalExpr(expr.high, row, columns, aliases);
                return val >= lo && val <= hi ? 1 : 0;
            }
            if (expr.type === 'in') {
                const val = evalExpr(expr.expr, row, columns, aliases);
                for (const item of expr.values) {
                    if (evalExpr(item, row, columns, aliases) == val) return 1;
                }
                return 0;
            }
            if (expr.type === 'like') {
                const val = String(evalExpr(expr.expr, row, columns, aliases) || '');
                const pattern = String(expr.pattern).replace(/%/g, '.*').replace(/_/g, '.');
                return new RegExp('^' + pattern + '$', 'i').test(val) ? 1 : 0;
            }
            if (expr.type === 'is_null') {
                const val = evalExpr(expr.expr, row, columns, aliases);
                return (val === null || val === undefined) ? 1 : 0;
            }
            if (expr.type === 'is_not_null') {
                const val = evalExpr(expr.expr, row, columns, aliases);
                return (val !== null && val !== undefined) ? 1 : 0;
            }
            return null;
        }

        function evalAggregate(funcName, argExpr, rows, columns, aliases) {
            const fn = funcName.toUpperCase();
            if (fn === 'COUNT') {
                if (argExpr && argExpr.type === 'star') return rows.length;
                let count = 0;
                for (const r of rows) {
                    const v = evalExpr(argExpr, r, columns, aliases);
                    if (v !== null && v !== undefined) count++;
                }
                return count;
            }
            const vals = rows.map(r => evalExpr(argExpr, r, columns, aliases)).filter(v => v !== null && v !== undefined);
            if (fn === 'SUM') return vals.reduce((a, b) => a + b, 0);
            if (fn === 'AVG') return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            if (fn === 'MIN') return vals.length ? Math.min(...vals) : null;
            if (fn === 'MAX') return vals.length ? Math.max(...vals) : null;
            throw new Error(`Fonction inconnue : ${funcName}`);
        }

        function isAggregate(expr) {
            if (!expr) return false;
            if (expr.type === 'func') {
                return ['COUNT','SUM','AVG','MIN','MAX'].includes(expr.name.toUpperCase());
            }
            if (expr.type === 'binary') return isAggregate(expr.left) || isAggregate(expr.right);
            return false;
        }

        // ── Parse expressions ──
        function parseExpr(parser, stopWords) {
            return parseOr(parser, stopWords);
        }

        function parseOr(parser, stopWords) {
            let left = parseAnd(parser, stopWords);
            while (parser.isWord('OR')) {
                parser.next();
                left = { type: 'or', left, right: parseAnd(parser, stopWords) };
            }
            return left;
        }

        function parseAnd(parser, stopWords) {
            let left = parseNot(parser, stopWords);
            while (parser.isWord('AND')) {
                parser.next();
                left = { type: 'and', left, right: parseNot(parser, stopWords) };
            }
            return left;
        }

        function parseNot(parser, stopWords) {
            if (parser.isWord('NOT')) {
                parser.next();
                return { type: 'not', expr: parseComparison(parser, stopWords) };
            }
            return parseComparison(parser, stopWords);
        }

        function parseComparison(parser, stopWords) {
            let left = parseAddSub(parser, stopWords);
            if (parser.isOp()) {
                const op = parser.next().value;
                const right = parseAddSub(parser, stopWords);
                left = { type: 'binary', op, left, right };
            } else if (parser.isWord('BETWEEN')) {
                parser.next();
                const low = parseAddSub(parser, stopWords);
                parser.expect('WORD', 'AND');
                const high = parseAddSub(parser, stopWords);
                left = { type: 'between', expr: left, low, high };
            } else if (parser.isWord('IN')) {
                parser.next();
                parser.expect('SYMBOL', '(');
                const values = [];
                values.push(parseAddSub(parser, stopWords));
                while (parser.isSymbol(',')) { parser.next(); values.push(parseAddSub(parser, stopWords)); }
                parser.expect('SYMBOL', ')');
                left = { type: 'in', expr: left, values };
            } else if (parser.isWord('LIKE')) {
                parser.next();
                const pat = parser.next();
                left = { type: 'like', expr: left, pattern: pat.value };
            } else if (parser.isWord('IS')) {
                parser.next();
                if (parser.isWord('NOT')) {
                    parser.next();
                    parser.expect('WORD', 'NULL');
                    left = { type: 'is_not_null', expr: left };
                } else {
                    parser.expect('WORD', 'NULL');
                    left = { type: 'is_null', expr: left };
                }
            }
            return left;
        }

        function parseAddSub(parser, stopWords) {
            let left = parseMulDiv(parser, stopWords);
            while (parser.isSymbol('+') || parser.isSymbol('-')) {
                const op = parser.next().value;
                left = { type: 'binary', op, left, right: parseMulDiv(parser, stopWords) };
            }
            return left;
        }

        function parseMulDiv(parser, stopWords) {
            let left = parseAtom(parser, stopWords);
            while (parser.isSymbol('*') || parser.isSymbol('/') || parser.isSymbol('%')) {
                const op = parser.next().value;
                left = { type: 'binary', op, left, right: parseAtom(parser, stopWords) };
            }
            return left;
        }

        function parseAtom(parser, stopWords) {
            const t = parser.peek();
            if (!t) throw new Error('Expression attendue');

            if (t.type === 'SYMBOL' && t.value === '(') {
                parser.next();
                const expr = parseExpr(parser, stopWords);
                parser.expect('SYMBOL', ')');
                return expr;
            }
            if (t.type === 'SYMBOL' && t.value === '*') {
                parser.next();
                return { type: 'star' };
            }
            if (t.type === 'NUMBER') {
                parser.next();
                return { type: 'literal', value: t.value };
            }
            if (t.type === 'STRING') {
                parser.next();
                return { type: 'literal', value: t.value };
            }
            if (t.type === 'WORD') {
                if (t.value.toUpperCase() === 'NULL') {
                    parser.next();
                    return { type: 'literal', value: null };
                }
                if (stopWords && stopWords.includes(t.value.toUpperCase())) {
                    throw new Error('Expression attendue');
                }
                parser.next();
                // Check for function call
                if (parser.isSymbol('(')) {
                    parser.next();
                    let arg = null;
                    if (!parser.isSymbol(')')) {
                        arg = parseExpr(parser, stopWords);
                    }
                    parser.expect('SYMBOL', ')');
                    return { type: 'func', name: t.value, arg };
                }
                // Check for dot notation (table.column)
                if (parser.peek() && parser.peek().type === 'DOT') {
                    parser.next();
                    const col = parser.next();
                    return { type: 'column', name: t.value + '.' + col.value };
                }
                return { type: 'column', name: t.value };
            }
            throw new Error(`Symbole inattendu : "${t.value}"`);
        }

        // ── SELECT column list parser ──
        function parseSelectColumns(parser) {
            const cols = [];
            while (true) {
                const expr = parseExpr(parser, ['FROM','WHERE','GROUP','ORDER','HAVING','LIMIT','INNER','LEFT','RIGHT','JOIN','ON']);
                let alias = null;
                if (parser.isWord('AS')) {
                    parser.next();
                    alias = parser.next().value;
                } else if (parser.peek() && parser.peek().type === 'WORD' &&
                    !['FROM','WHERE','GROUP','ORDER','HAVING','LIMIT','INNER','LEFT','RIGHT','JOIN','ON','AND','OR'].includes(parser.peek().value.toUpperCase())) {
                    alias = parser.next().value;
                }
                cols.push({ expr, alias });
                if (parser.isSymbol(',')) { parser.next(); continue; }
                break;
            }
            return cols;
        }

        // ── Table reference with alias ──
        function parseTableRef(parser) {
            const name = parser.next().value.toLowerCase();
            let alias = null;
            if (parser.isWord('AS')) { parser.next(); alias = parser.next().value.toLowerCase(); }
            else if (parser.peek() && parser.peek().type === 'WORD' &&
                !['WHERE','GROUP','ORDER','HAVING','LIMIT','INNER','LEFT','RIGHT','JOIN','ON','SET','VALUES'].includes(parser.peek().value.toUpperCase())) {
                alias = parser.next().value.toLowerCase();
            }
            return { name, alias: alias || name };
        }

        // ── Resolve a data source (table or join) ──
        function resolveTable(tableName) {
            const t = DB.tables[tableName.toLowerCase()];
            if (!t) throw new Error(`Table inconnue : "${tableName}"`);
            return t;
        }

        function buildSource(parser) {
            const ref = parseTableRef(parser);
            const table = resolveTable(ref.name);
            const aliases = {};
            aliases[ref.alias] = ref.name;
            let columns = table.columns.map(c => ref.name + '.' + c);
            let rows = table.rows.map(r => [...r]);

            // Handle JOINs
            while (true) {
                let joinType = null;
                if (parser.isWord('INNER')) { parser.next(); parser.expect('WORD', 'JOIN'); joinType = 'INNER'; }
                else if (parser.isWord('LEFT')) { parser.next(); parser.expect('WORD', 'JOIN'); joinType = 'LEFT'; }
                else if (parser.isWord('JOIN')) { parser.next(); joinType = 'INNER'; }
                else break;

                const ref2 = parseTableRef(parser);
                const table2 = resolveTable(ref2.name);
                aliases[ref2.alias] = ref2.name;
                parser.expect('WORD', 'ON');
                const onExpr = parseExpr(parser, ['WHERE','GROUP','ORDER','HAVING','LIMIT','INNER','LEFT','RIGHT','JOIN']);

                const newCols = [...columns, ...table2.columns.map(c => ref2.name + '.' + c)];
                const newRows = [];
                const nullRight = table2.columns.map(() => null);

                for (const leftRow of rows) {
                    let matched = false;
                    for (const rightRow of table2.rows) {
                        const combined = [...leftRow, ...rightRow];
                        if (evalExpr(onExpr, combined, newCols, aliases)) {
                            newRows.push(combined);
                            matched = true;
                        }
                    }
                    if (!matched && joinType === 'LEFT') {
                        newRows.push([...leftRow, ...nullRight]);
                    }
                }
                columns = newCols;
                rows = newRows;
            }

            return { columns, rows, aliases };
        }

        // ── Execute SQL ──
        function executeSQL(sql) {
            sql = sql.trim();
            if (!sql) throw new Error('Requête vide.');
            const tokens = tokenize(sql);
            if (!tokens.length) throw new Error('Requête vide.');

            const parser = new Parser(tokens);
            const firstWord = parser.peek();
            if (!firstWord || firstWord.type !== 'WORD') throw new Error('Requête invalide.');

            const command = firstWord.value.toUpperCase();

            if (command === 'SELECT') return executeSelect(parser);
            if (command === 'INSERT') return executeInsert(parser);
            if (command === 'UPDATE') return executeUpdate(parser);
            if (command === 'DELETE') return executeDelete(parser);

            throw new Error(`Commande non supportée : "${command}". Commandes supportées : SELECT, INSERT, UPDATE, DELETE`);
        }

        function executeSelect(parser) {
            parser.expect('WORD', 'SELECT');

            let distinct = false;
            if (parser.isWord('DISTINCT')) { parser.next(); distinct = true; }

            const selectCols = parseSelectColumns(parser);

            parser.expect('WORD', 'FROM');
            const source = buildSource(parser);
            let { columns, rows, aliases } = source;

            // WHERE
            if (parser.isWord('WHERE')) {
                parser.next();
                const whereExpr = parseExpr(parser, ['GROUP','ORDER','HAVING','LIMIT']);
                rows = rows.filter(r => evalExpr(whereExpr, r, columns, aliases));
            }

            // GROUP BY
            let groupBy = null;
            if (parser.isWord('GROUP')) {
                parser.next();
                parser.expect('WORD', 'BY');
                groupBy = [];
                while (true) {
                    groupBy.push(parseExpr(parser, ['HAVING','ORDER','LIMIT']));
                    if (parser.isSymbol(',')) { parser.next(); continue; }
                    break;
                }
            }

            // HAVING
            let havingExpr = null;
            if (parser.isWord('HAVING')) {
                parser.next();
                havingExpr = parseExpr(parser, ['ORDER','LIMIT']);
            }

            // Evaluate select columns with GROUP BY
            let resultColumns = [];
            let resultRows = [];

            const hasAggregates = selectCols.some(c => isAggregate(c.expr));

            if (groupBy || hasAggregates) {
                // Group rows
                const groups = new Map();
                for (const row of rows) {
                    const key = groupBy ? groupBy.map(g => evalExpr(g, row, columns, aliases)).join('|||') : '__all__';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(row);
                }

                for (const [, groupRows] of groups) {
                    if (havingExpr) {
                        // Evaluate having with aggregate support
                        const testVal = evalHavingExpr(havingExpr, groupRows, columns, aliases);
                        if (!testVal) continue;
                    }

                    const resultRow = [];
                    for (const sc of selectCols) {
                        if (isAggregate(sc.expr)) {
                            resultRow.push(evalAggregateExpr(sc.expr, groupRows, columns, aliases));
                        } else {
                            resultRow.push(evalExpr(sc.expr, groupRows[0], columns, aliases));
                        }
                    }
                    resultRows.push(resultRow);
                }
            } else {
                // No grouping - check for star expansion
                for (const row of rows) {
                    const resultRow = [];
                    for (const sc of selectCols) {
                        if (sc.expr.type === 'star') {
                            resultRow.push(...row);
                        } else {
                            resultRow.push(evalExpr(sc.expr, row, columns, aliases));
                        }
                    }
                    resultRows.push(resultRow);
                }
            }

            // Compute result column names
            for (const sc of selectCols) {
                if (sc.alias) {
                    resultColumns.push(sc.alias);
                } else if (sc.expr.type === 'star') {
                    resultColumns.push(...columns.map(c => { const p = c.split('.'); return p[p.length - 1]; }));
                } else if (sc.expr.type === 'column') {
                    const parts = sc.expr.name.split('.');
                    resultColumns.push(parts[parts.length - 1]);
                } else if (sc.expr.type === 'func') {
                    resultColumns.push(sc.expr.name.toUpperCase() + '(...)');
                } else {
                    resultColumns.push('expr');
                }
            }

            // ORDER BY
            if (parser.isWord('ORDER')) {
                parser.next();
                parser.expect('WORD', 'BY');
                const orderClauses = [];
                while (true) {
                    const t = parser.peek();
                    let colIdx = -1;
                    if (t && t.type === 'WORD') {
                        const colName = t.value.toLowerCase();
                        parser.next();
                        if (parser.peek() && parser.peek().type === 'DOT') {
                            parser.next();
                            const cn = parser.next().value.toLowerCase();
                            colIdx = resultColumns.findIndex(c => c.toLowerCase() === cn);
                        } else {
                            colIdx = resultColumns.findIndex(c => c.toLowerCase() === colName);
                        }
                    } else if (t && t.type === 'NUMBER') {
                        parser.next();
                        colIdx = t.value - 1;
                    }
                    let dir = 'ASC';
                    if (parser.isWord('ASC')) { parser.next(); dir = 'ASC'; }
                    else if (parser.isWord('DESC')) { parser.next(); dir = 'DESC'; }
                    if (colIdx >= 0) orderClauses.push({ idx: colIdx, dir });
                    if (parser.isSymbol(',')) { parser.next(); continue; }
                    break;
                }
                resultRows.sort((a, b) => {
                    for (const oc of orderClauses) {
                        let va = a[oc.idx], vb = b[oc.idx];
                        if (va == null && vb == null) continue;
                        if (va == null) return 1;
                        if (vb == null) return -1;
                        if (typeof va === 'string') va = va.toLowerCase();
                        if (typeof vb === 'string') vb = vb.toLowerCase();
                        if (va < vb) return oc.dir === 'ASC' ? -1 : 1;
                        if (va > vb) return oc.dir === 'ASC' ? 1 : -1;
                    }
                    return 0;
                });
            }

            // DISTINCT
            if (distinct) {
                const seen = new Set();
                resultRows = resultRows.filter(r => {
                    const key = JSON.stringify(r);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }

            // LIMIT
            if (parser.isWord('LIMIT')) {
                parser.next();
                const n = parser.next();
                resultRows = resultRows.slice(0, n.value);
            }

            parser.skipSemicolon();

            return {
                type: 'result',
                columns: resultColumns,
                rows: resultRows,
                count: resultRows.length
            };
        }

        function evalAggregateExpr(expr, groupRows, columns, aliases) {
            if (expr.type === 'func' && ['COUNT','SUM','AVG','MIN','MAX'].includes(expr.name.toUpperCase())) {
                return evalAggregate(expr.name, expr.arg, groupRows, columns, aliases);
            }
            if (expr.type === 'binary') {
                const l = evalAggregateExpr(expr.left, groupRows, columns, aliases);
                const r = evalAggregateExpr(expr.right, groupRows, columns, aliases);
                switch (expr.op) {
                    case '+': return l + r; case '-': return l - r;
                    case '*': return l * r; case '/': return r ? l / r : null;
                }
            }
            return evalExpr(expr, groupRows[0], columns, aliases);
        }

        function evalHavingExpr(expr, groupRows, columns, aliases) {
            if (expr.type === 'binary' && ['=','!=','>','<','>=','<='].includes(expr.op)) {
                const l = evalAggregateExpr(expr.left, groupRows, columns, aliases);
                const r = evalAggregateExpr(expr.right, groupRows, columns, aliases);
                switch (expr.op) {
                    case '=': return l == r;
                    case '!=': return l != r;
                    case '>': return l > r;
                    case '<': return l < r;
                    case '>=': return l >= r;
                    case '<=': return l <= r;
                }
            }
            if (expr.type === 'and') return evalHavingExpr(expr.left, groupRows, columns, aliases) && evalHavingExpr(expr.right, groupRows, columns, aliases);
            if (expr.type === 'or') return evalHavingExpr(expr.left, groupRows, columns, aliases) || evalHavingExpr(expr.right, groupRows, columns, aliases);
            return evalAggregateExpr(expr, groupRows, columns, aliases);
        }

        function executeInsert(parser) {
            parser.expect('WORD', 'INSERT');
            parser.expect('WORD', 'INTO');
            const tableName = parser.next().value.toLowerCase();
            const table = resolveTable(tableName);

            let targetCols = null;
            if (parser.isSymbol('(')) {
                parser.next();
                targetCols = [];
                while (!parser.isSymbol(')')) {
                    targetCols.push(parser.next().value.toLowerCase());
                    if (parser.isSymbol(',')) parser.next();
                }
                parser.expect('SYMBOL', ')');
            }

            parser.expect('WORD', 'VALUES');
            parser.expect('SYMBOL', '(');
            const values = [];
            while (!parser.isSymbol(')')) {
                const t = parser.next();
                if (t.type === 'NUMBER') values.push(t.value);
                else if (t.type === 'STRING') values.push(t.value);
                else if (t.type === 'WORD' && t.value.toUpperCase() === 'NULL') values.push(null);
                else values.push(t.value);
                if (parser.isSymbol(',')) parser.next();
            }
            parser.expect('SYMBOL', ')');
            parser.skipSemicolon();

            if (targetCols) {
                const row = table.columns.map(() => null);
                for (let i = 0; i < targetCols.length; i++) {
                    const idx = table.columns.findIndex(c => c.toLowerCase() === targetCols[i]);
                    if (idx === -1) throw new Error(`Colonne inconnue : "${targetCols[i]}"`);
                    row[idx] = values[i];
                }
                table.rows.push(row);
            } else {
                if (values.length !== table.columns.length)
                    throw new Error(`Nombre de valeurs (${values.length}) ne correspond pas au nombre de colonnes (${table.columns.length}).`);
                table.rows.push(values);
            }

            return { type: 'message', message: '1 ligne insérée.', class: 'success' };
        }

        function executeUpdate(parser) {
            parser.expect('WORD', 'UPDATE');
            const tableName = parser.next().value.toLowerCase();
            const table = resolveTable(tableName);
            const columns = table.columns.map(c => tableName + '.' + c);

            parser.expect('WORD', 'SET');
            const assignments = [];
            while (true) {
                const col = parser.next().value.toLowerCase();
                parser.expect('OP', '=');
                const expr = parseExpr(parser, ['WHERE']);
                assignments.push({ col, expr });
                if (parser.isSymbol(',')) { parser.next(); continue; }
                break;
            }

            let whereExpr = null;
            if (parser.isWord('WHERE')) {
                parser.next();
                whereExpr = parseExpr(parser, []);
            }
            parser.skipSemicolon();

            let count = 0;
            for (const row of table.rows) {
                if (whereExpr) {
                    const fullRow = [...row];
                    if (!evalExpr(whereExpr, fullRow, columns, {})) continue;
                }
                for (const a of assignments) {
                    const idx = table.columns.findIndex(c => c.toLowerCase() === a.col);
                    if (idx === -1) throw new Error(`Colonne inconnue : "${a.col}"`);
                    row[idx] = evalExpr(a.expr, [...row], columns, {});
                }
                count++;
            }

            return { type: 'message', message: `${count} ligne(s) modifiée(s).`, class: 'success' };
        }

        function executeDelete(parser) {
            parser.expect('WORD', 'DELETE');
            parser.expect('WORD', 'FROM');
            const tableName = parser.next().value.toLowerCase();
            const table = resolveTable(tableName);
            const columns = table.columns.map(c => tableName + '.' + c);

            let whereExpr = null;
            if (parser.isWord('WHERE')) {
                parser.next();
                whereExpr = parseExpr(parser, []);
            }
            parser.skipSemicolon();

            const before = table.rows.length;
            if (whereExpr) {
                table.rows = table.rows.filter(row => !evalExpr(whereExpr, [...row], columns, {}));
            } else {
                table.rows = [];
            }
            const deleted = before - table.rows.length;

            return { type: 'message', message: `${deleted} ligne(s) supprimée(s).`, class: 'success' };
        }

        // ── UI split: editor / result / feedback ──
        const editor = document.getElementById('sqlEditor');
        const resultArea = document.getElementById('resultArea');
        const btnRun = document.getElementById('btnRun');
        const btnClear = document.getElementById('btnClear');
        const btnReset = document.getElementById('btnReset');
        const schemaToggle = document.getElementById('schemaToggle');
        const schemaPanel = document.getElementById('schemaPanel');
        const historyList = document.getElementById('historyList');
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabExamples = document.getElementById('tabExamples');
        const tabHistory = document.getElementById('tabHistory');

        const sqlEngine = {
            execute(sql) {
                return executeSQL(sql);
            },
            reset() {
                DB.reset();
            }
        };

        function createEditorController(editorEl) {
            return {
                getSQL() {
                    return editorEl.value.trim();
                },
                setSQL(sql) {
                    editorEl.value = sql;
                },
                clear() {
                    editorEl.value = '';
                    editorEl.focus();
                },
                bindShortcuts(onRun) {
                    editorEl.addEventListener('keydown', e => {
                        if (e.ctrlKey && e.key === 'Enter') {
                            e.preventDefault();
                            onRun();
                        }
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const start = editorEl.selectionStart;
                            editorEl.value = editorEl.value.substring(0, start) + '    ' + editorEl.value.substring(editorEl.selectionEnd);
                            editorEl.selectionStart = editorEl.selectionEnd = start + 4;
                        }
                    });
                }
            };
        }

        function createResultRenderer(resultEl) {
            return {
                renderTableResult(result, elapsedMs, valueFormatter) {
                    let html = `<div class="result-info">
                        <span class="count">${result.count} ligne(s) retournée(s)</span>
                        <span class="time">${elapsedMs} ms</span>
                    </div>`;
                    html += '<div class="result-table-wrapper"><table class="result-table"><thead><tr>';
                    for (const col of result.columns) html += `<th>${col}</th>`;
                    html += '</tr></thead><tbody>';
                    if (result.rows.length === 0) {
                        html += `<tr><td colspan="${result.columns.length}" style="text-align:center;color:var(--muted);padding:2rem;">Aucun résultat</td></tr>`;
                    } else {
                        for (const row of result.rows) {
                            html += '<tr>';
                            for (const value of row) html += `<td>${valueFormatter(value)}</td>`;
                            html += '</tr>';
                        }
                    }
                    html += '</tbody></table></div>';
                    resultEl.innerHTML = html;
                }
            };
        }

        function createFeedbackRenderer(resultEl) {
            return {
                showError(message) {
                    resultEl.innerHTML = `<div class="result-message error">${message}</div>`;
                },
                showMessage(message, className, elapsedMs) {
                    resultEl.innerHTML = `<div class="result-message ${className}">${message} <span style="float:right;font-size:0.8rem;color:var(--muted);">${elapsedMs} ms</span></div>`;
                },
                showResetMessage() {
                    resultEl.innerHTML = '<div class="result-message success">Base de données réinitialisée avec succès.</div>';
                }
            };
        }

        function createHistoryController(historyEl, onReplay) {
            const entries = [];
            return {
                add(sql, success) {
                    const preview = sql.length > 80 ? `${sql.slice(0, 77)}...` : sql;
                    entries.unshift({ sql, preview, success });
                    if (entries.length > 20) entries.pop();
                    this.render();
                },
                render() {
                    historyEl.innerHTML = '';
                    entries.forEach(entry => {
                        const item = document.createElement('div');
                        item.className = 'history-item';

                        const label = document.createElement('span');
                        label.textContent = entry.preview;

                        const status = document.createElement('span');
                        status.className = `status ${entry.success ? 'ok' : 'fail'}`;
                        status.textContent = entry.success ? 'OK' : 'Err';

                        item.appendChild(label);
                        item.appendChild(status);
                        item.addEventListener('click', () => onReplay(entry.sql));
                        historyEl.appendChild(item);
                    });
                }
            };
        }

        function formatValue(v) {
            if (v === null || v === undefined) return '<span style="color:var(--muted);font-style:italic;">NULL</span>';
            if (typeof v === 'number') {
                return Number.isInteger(v) ? v.toString() : v.toFixed(2);
            }
            return String(v);
        }

        const editorController = createEditorController(editor);
        const resultRenderer = createResultRenderer(resultArea);
        const feedbackRenderer = createFeedbackRenderer(resultArea);
        const historyController = createHistoryController(historyList, sql => {
            editorController.setSQL(sql);
            runQuery();
        });

        schemaToggle.addEventListener('click', () => {
            schemaPanel.classList.toggle('visible');
        });

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (btn.dataset.tab === 'examples') {
                    tabExamples.style.display = '';
                    tabHistory.style.display = 'none';
                } else {
                    tabExamples.style.display = 'none';
                    tabHistory.style.display = '';
                }
            });
        });

        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                editorController.setSQL(btn.dataset.sql);
                runQuery();
            });
        });

        btnRun.addEventListener('click', runQuery);
        btnClear.addEventListener('click', () => {
            editorController.clear();
        });
        btnReset.addEventListener('click', () => {
            sqlEngine.reset();
            feedbackRenderer.showResetMessage();
        });
        editorController.bindShortcuts(runQuery);

        function runQuery() {
            const sql = editorController.getSQL();
            if (!sql) {
                feedbackRenderer.showError('Veuillez saisir une requête SQL.');
                return;
            }

            const start = performance.now();
            try {
                const result = sqlEngine.execute(sql);
                const elapsed = (performance.now() - start).toFixed(1);
                if (result.type === 'result') {
                    resultRenderer.renderTableResult(result, elapsed, formatValue);
                } else {
                    feedbackRenderer.showMessage(result.message, result.class, elapsed);
                }
                historyController.add(sql, true);
            } catch (e) {
                feedbackRenderer.showError(`<strong>Erreur :</strong> ${e.message}`);
                historyController.add(sql, false);
            }
        }
    })();
    }
}

if (typeof window !== 'undefined') {
    window.SqlPlaygroundPage = SqlPlaygroundPage;
}
