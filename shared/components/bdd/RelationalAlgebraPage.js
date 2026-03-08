class RelationalAlgebraPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
    /* ===== DATA ===== */
    const initialTables = {
        'Étudiants': {
            columns: ['id', 'nom', 'prenom', 'age', 'ville'],
            rows: [
                [1, 'Dupont', 'Alice', 21, 'Paris'],
                [2, 'Martin', 'Bob', 19, 'Lyon'],
                [3, 'Bernard', 'Claire', 22, 'Paris'],
                [4, 'Petit', 'David', 20, 'Marseille'],
                [5, 'Durand', 'Emma', 23, 'Lyon'],
                [6, 'Leroy', 'Franck', 19, 'Toulouse']
            ]
        },
        'Cours': {
            columns: ['id_cours', 'intitule', 'credits', 'enseignant'],
            rows: [
                ['C1', 'Algorithmes', 6, 'Prof. Laurent'],
                ['C2', 'Bases de données', 4, 'Prof. Moreau'],
                ['C3', 'Réseaux', 4, 'Prof. Laurent'],
                ['C4', 'Systèmes', 5, 'Prof. Simon']
            ]
        },
        'Inscriptions': {
            columns: ['id_etudiant', 'id_cours', 'note', 'semestre'],
            rows: [
                [1, 'C1', 15, 'S1'],
                [1, 'C2', 12, 'S1'],
                [2, 'C1', 14, 'S1'],
                [2, 'C3', 16, 'S2'],
                [3, 'C2', 18, 'S1'],
                [3, 'C4', 11, 'S2'],
                [4, 'C1', 9, 'S1'],
                [5, 'C2', 17, 'S2'],
                [5, 'C3', 13, 'S1'],
                [6, 'C4', 15, 'S2']
            ]
        }
    };

    let tables = {};
    let selectedTable = null;
    let currentOp = null;
    let history = [];
    let resultTable = null;
    let resultCounter = 0;

    function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

    function init() {
        tables = deepCopy(initialTables);
        selectedTable = 'Étudiants';
        currentOp = null;
        history = [];
        resultTable = null;
        resultCounter = 0;
        renderTableList();
        renderSourceTables();
        document.getElementById('opConfig').style.display = 'none';
        document.getElementById('resultSection').style.display = 'none';
        renderHistory();
        updateExprBar(null);
    }

    /* ===== TABLE LIST ===== */
    function renderTableList() {
        const el = document.getElementById('tableList');
        el.innerHTML = '';
        Object.keys(tables).forEach(name => {
            const item = document.createElement('div');
            item.className = 'table-list-item' + (name === selectedTable ? ' selected' : '');
            item.innerHTML = `<span>${name}</span><span class="row-count">${tables[name].rows.length} lignes</span>`;
            item.onclick = () => { selectedTable = name; renderTableList(); renderSourceTables(); };
            el.appendChild(item);
        });
    }

    /* ===== RENDER SOURCE TABLES ===== */
    function renderSourceTables() {
        const area = document.getElementById('sourceTablesArea');
        if (!selectedTable || !tables[selectedTable]) {
            area.innerHTML = '<p class="empty-msg">Sélectionnez une table</p>';
            return;
        }
        area.innerHTML = '';
        const t = tables[selectedTable];
        const card = document.createElement('div');
        card.className = 'card';
        const header = document.createElement('div');
        header.className = 'table-header';
        header.innerHTML = `
            <h3>${selectedTable} <span class="badge badge-primary">${t.rows.length} lignes</span></h3>
            <div class="table-actions">
                <button onclick="addRow('${selectedTable}')">+ Ligne</button>
                <button onclick="deleteTable('${selectedTable}')">Supprimer table</button>
            </div>
        `;
        card.appendChild(header);
        card.appendChild(buildTableHTML(t, selectedTable, true));
        area.appendChild(card);
    }

    function buildTableHTML(tableData, tableName, editable, highlightedRows) {
        const wrapper = document.createElement('div');
        wrapper.className = 'data-table-wrapper';
        const table = document.createElement('table');
        table.className = 'data-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        tableData.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            headRow.appendChild(th);
        });
        if (editable) {
            const th = document.createElement('th');
            th.textContent = 'Actions';
            th.style.width = '100px';
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        tableData.rows.forEach((row, ri) => {
            const tr = document.createElement('tr');
            if (highlightedRows && highlightedRows.includes(ri)) tr.className = 'highlighted';
            row.forEach((cell, ci) => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            if (editable) {
                const td = document.createElement('td');
                td.innerHTML = `<button style="font-size:0.7rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-family:var(--font);margin-right:0.2rem;" onclick="editRow('${tableName}',${ri})">Modifier</button><button style="font-size:0.7rem;padding:0.2rem 0.4rem;border:1px solid var(--danger);border-radius:4px;background:var(--card);cursor:pointer;font-family:var(--font);color:var(--danger);" onclick="deleteRow('${tableName}',${ri})">Suppr.</button>`;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrapper.appendChild(table);
        return wrapper;
    }

    /* ===== ROW CRUD ===== */
    function addRow(tableName) {
        const t = tables[tableName];
        showEditModal('Ajouter une ligne — ' + tableName, t.columns, t.columns.map(() => ''), (values) => {
            t.rows.push(values.map((v, i) => autoType(v)));
            renderTableList();
            renderSourceTables();
        });
    }

    function editRow(tableName, rowIdx) {
        const t = tables[tableName];
        showEditModal('Modifier la ligne — ' + tableName, t.columns, t.rows[rowIdx].map(String), (values) => {
            t.rows[rowIdx] = values.map(v => autoType(v));
            renderTableList();
            renderSourceTables();
        });
    }

    function deleteRow(tableName, rowIdx) {
        tables[tableName].rows.splice(rowIdx, 1);
        renderTableList();
        renderSourceTables();
    }

    function deleteTable(tableName) {
        if (Object.keys(tables).length <= 1) return;
        delete tables[tableName];
        selectedTable = Object.keys(tables)[0];
        renderTableList();
        renderSourceTables();
    }

    function autoType(v) {
        if (v === '') return '';
        const n = Number(v);
        if (!isNaN(n) && v.trim() !== '') return n;
        return v;
    }

    /* ===== EDIT MODAL ===== */
    function showEditModal(title, fields, values, onSave) {
        const overlay = document.getElementById('editOverlay');
        const modal = document.getElementById('editModal');
        let html = `<h3>${title}</h3>`;
        fields.forEach((f, i) => {
            html += `<div class="field"><label>${f}</label><input type="text" id="modalField${i}" value="${values[i] || ''}"></div>`;
        });
        html += `<div class="modal-actions">
            <button class="btn btn-secondary" style="min-width:auto;font-size:0.85rem;" onclick="closeModal()">Annuler</button>
            <button class="btn btn-primary" style="min-width:auto;font-size:0.85rem;" onclick="submitModal()">Valider</button>
        </div>`;
        modal.innerHTML = html;
        overlay.style.display = 'flex';
        window._modalSave = () => {
            const vals = fields.map((_, i) => document.getElementById('modalField' + i).value);
            onSave(vals);
            closeModal();
        };
        setTimeout(() => { const f = document.getElementById('modalField0'); if (f) f.focus(); }, 50);
    }
    function closeModal() { document.getElementById('editOverlay').style.display = 'none'; }
    function submitModal() { if (window._modalSave) window._modalSave(); }

    /* ===== OPERATIONS ===== */
    function selectOp(op) {
        currentOp = op;
        document.querySelectorAll('.op-btn').forEach(b => b.classList.toggle('active', b.dataset.op === op));
        document.getElementById('resultSection').style.display = 'none';
        resultTable = null;
        renderOpConfig(op);
    }

    function renderOpConfig(op) {
        const el = document.getElementById('opConfig');
        el.style.display = 'block';
        const tNames = Object.keys(tables);

        if (op === 'selection') {
            el.innerHTML = `
                <h4>&sigma; S&eacute;lection — Filtrer les lignes selon une condition</h4>
                <div class="field-group">
                    <label>Table source</label>
                    <select id="selTable">${tNames.map(n => `<option value="${n}" ${n===selectedTable?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Condition (ex: age > 20, ville = 'Paris', note >= 15)</label>
                    <input type="text" id="selCondition" placeholder="age > 20" style="font-family:var(--font-mono);">
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeSelection()">Ex&eacute;cuter &sigma;</button>
                </div>
                <div class="feedback" id="selFeedback"></div>
            `;
        } else if (op === 'projection') {
            const t = tables[selectedTable] || tables[tNames[0]];
            const tName = selectedTable || tNames[0];
            el.innerHTML = `
                <h4>&pi; Projection — Garder certaines colonnes</h4>
                <div class="field-group">
                    <label>Table source</label>
                    <select id="projTable" onchange="updateProjCols()">${tNames.map(n => `<option value="${n}" ${n===tName?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Colonnes &agrave; garder</label>
                    <div class="checkbox-group" id="projCols"></div>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeProjection()">Ex&eacute;cuter &pi;</button>
                </div>
                <div class="feedback" id="projFeedback"></div>
            `;
            updateProjCols();
        } else if (op === 'jointure') {
            el.innerHTML = `
                <h4>&#x2A1D; Jointure naturelle / Th&ecirc;ta-jointure</h4>
                <div class="field-group">
                    <label>Table gauche</label>
                    <select id="joinLeft">${tNames.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Table droite</label>
                    <select id="joinRight">${tNames.map((n,i) => `<option value="${n}" ${i===Math.min(1,tNames.length-1)?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Condition (ex: id = id_etudiant) — vide = jointure naturelle</label>
                    <input type="text" id="joinCond" placeholder="id = id_etudiant" style="font-family:var(--font-mono);">
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeJoin()">Ex&eacute;cuter &#x2A1D;</button>
                </div>
                <div class="feedback" id="joinFeedback"></div>
            `;
        } else if (op === 'union' || op === 'difference') {
            const symbol = op === 'union' ? '∪' : '−';
            const name = op === 'union' ? 'Union' : 'Différence';
            el.innerHTML = `
                <h4>${symbol} ${name} — Tables de m&ecirc;me sch&eacute;ma</h4>
                <div class="field-group">
                    <label>Table 1</label>
                    <select id="setT1">${tNames.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Table 2</label>
                    <select id="setT2">${tNames.map((n,i) => `<option value="${n}" ${i===Math.min(1,tNames.length-1)?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeSetOp('${op}')">Ex&eacute;cuter ${symbol}</button>
                </div>
                <div class="feedback" id="setFeedback"></div>
            `;
        } else if (op === 'produit') {
            el.innerHTML = `
                <h4>&times; Produit cart&eacute;sien</h4>
                <div class="field-group">
                    <label>Table 1</label>
                    <select id="prodT1">${tNames.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Table 2</label>
                    <select id="prodT2">${tNames.map((n,i) => `<option value="${n}" ${i===Math.min(1,tNames.length-1)?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeProduct()">Ex&eacute;cuter &times;</button>
                </div>
                <div class="feedback" id="prodFeedback"></div>
            `;
        } else if (op === 'renommage') {
            el.innerHTML = `
                <h4>&rho; Renommage — Renommer une colonne</h4>
                <div class="field-group">
                    <label>Table source</label>
                    <select id="renTable">${tNames.map(n => `<option value="${n}" ${n===selectedTable?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Ancien nom de colonne</label>
                    <input type="text" id="renOld" placeholder="nom_colonne">
                </div>
                <div class="field-group">
                    <label>Nouveau nom</label>
                    <input type="text" id="renNew" placeholder="nouveau_nom">
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" onclick="executeRename()">Ex&eacute;cuter &rho;</button>
                </div>
                <div class="feedback" id="renFeedback"></div>
            `;
        }
    }

    function updateProjCols() {
        const tName = document.getElementById('projTable').value;
        const t = tables[tName];
        if (!t) return;
        const container = document.getElementById('projCols');
        container.innerHTML = '';
        t.columns.forEach((col, i) => {
            const lbl = document.createElement('label');
            lbl.className = 'checked';
            lbl.innerHTML = `<input type="checkbox" value="${col}" checked onchange="this.parentElement.classList.toggle('checked', this.checked)"> ${col}`;
            container.appendChild(lbl);
        });
    }

    /* ===== ALGEBRA ENGINE (operations pures, sans DOM) ===== */
    const algebraEngine = {
        parseCondition(condStr) {
            const input = condStr.trim();
            if (/\bET\b/i.test(input) || /\bAND\b/i.test(input)) {
                const parts = input.split(/\bET\b|\bAND\b/i).map(p => this.parseCondition(p.trim()));
                return (row, cols) => parts.every(fn => fn(row, cols));
            }
            if (/\bOU\b/i.test(input) || /\bOR\b/i.test(input)) {
                const parts = input.split(/\bOU\b|\bOR\b/i).map(p => this.parseCondition(p.trim()));
                return (row, cols) => parts.some(fn => fn(row, cols));
            }
            const m = input.match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/);
            if (!m) throw new Error('Condition invalide : ' + input);
            const [, col, oper, rawVal] = m;
            const parsedValue = rawVal.trim().replace(/^['"]|['"]$/g, '');
            return (row, cols) => {
                const ci = cols.indexOf(col);
                if (ci === -1) throw new Error('Colonne inconnue : ' + col);
                const cellVal = row[ci];
                let cmpVal = parsedValue;
                if (typeof cellVal === 'number') cmpVal = Number(cmpVal);
                return this.compare(cellVal, oper, cmpVal);
            };
        },

        compare(left, oper, right) {
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
        },

        selection(tableName, tableDef, condition) {
            if (!condition) throw new Error('Veuillez saisir une condition.');
            const condFn = this.parseCondition(condition);
            const matchedIndices = [];
            const rows = [];
            tableDef.rows.forEach((row, idx) => {
                if (condFn(row, tableDef.columns)) {
                    matchedIndices.push(idx);
                    rows.push([...row]);
                }
            });
            return {
                resultTable: { columns: [...tableDef.columns], rows },
                matchedIndices,
                expression: `σ<sub>${condition}</sub>(${tableName})`,
                message: `${rows.length} ligne(s) sélectionnée(s) sur ${tableDef.rows.length}.`
            };
        },

        projection(tableName, tableDef, keepColumns) {
            if (!keepColumns.length) throw new Error('Sélectionnez au moins une colonne.');
            const keepIndices = keepColumns.map(col => {
                const idx = tableDef.columns.indexOf(col);
                if (idx === -1) throw new Error(`Colonne inconnue : ${col}`);
                return idx;
            });
            const seen = new Set();
            const rows = [];
            tableDef.rows.forEach(row => {
                const projected = keepIndices.map(i => row[i]);
                const key = JSON.stringify(projected);
                if (!seen.has(key)) {
                    seen.add(key);
                    rows.push(projected);
                }
            });
            return {
                resultTable: { columns: [...keepColumns], rows },
                expression: `π<sub>${keepColumns.join(',')}</sub>(${tableName})`,
                message: `Projection effectuée : ${keepColumns.length} colonne(s), ${rows.length} ligne(s) (doublons éliminés).`
            };
        },

        join(leftName, rightName, leftTable, rightTable, condition) {
            let rows = [];
            let columns = [];
            if (!condition) {
                const common = leftTable.columns.filter(col => rightTable.columns.includes(col));
                if (!common.length) {
                    throw new Error('Aucune colonne commune trouvée pour la jointure naturelle.');
                }
                const rightOnly = rightTable.columns.filter(col => !common.includes(col));
                columns = [...leftTable.columns, ...rightOnly];
                leftTable.rows.forEach(leftRow => {
                    rightTable.rows.forEach(rightRow => {
                        const matches = common.every(col => (
                            leftRow[leftTable.columns.indexOf(col)] == rightRow[rightTable.columns.indexOf(col)]
                        ));
                        if (matches) {
                            rows.push([...leftRow, ...rightOnly.map(col => rightRow[rightTable.columns.indexOf(col)])]);
                        }
                    });
                });
            } else {
                const match = condition.match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(\w+)$/);
                if (!match) {
                    throw new Error('Format de condition: colonne1 = colonne2');
                }
                const [, leftColRaw, oper, rightColRaw] = match;
                columns = [
                    ...leftTable.columns.map(col => `${leftName}.${col}`),
                    ...rightTable.columns.map(col => `${rightName}.${col}`)
                ];
                const leftCol = leftColRaw.replace(leftName + '.', '');
                const rightCol = rightColRaw.replace(rightName + '.', '');
                const leftIdx = leftTable.columns.indexOf(leftCol);
                const rightIdx = rightTable.columns.indexOf(rightCol);
                if (leftIdx === -1) throw new Error(`Colonne inconnue dans ${leftName} : ${leftColRaw}`);
                if (rightIdx === -1) throw new Error(`Colonne inconnue dans ${rightName} : ${rightColRaw}`);
                leftTable.rows.forEach(leftRow => {
                    rightTable.rows.forEach(rightRow => {
                        if (this.compare(leftRow[leftIdx], oper, rightRow[rightIdx])) {
                            rows.push([...leftRow, ...rightRow]);
                        }
                    });
                });
            }
            const expression = condition
                ? `${leftName} ⨝<sub>${condition}</sub> ${rightName}`
                : `${leftName} ⨝ ${rightName}`;
            return {
                resultTable: { columns, rows },
                expression,
                message: `Jointure effectuée : ${rows.length} ligne(s).`
            };
        },

        setOperation(op, leftName, rightName, leftTable, rightTable) {
            if (leftTable.columns.length !== rightTable.columns.length) {
                throw new Error('Les tables doivent avoir le même nombre de colonnes.');
            }
            const sameSchema = leftTable.columns.every((col, idx) => (
                col.toLowerCase() === rightTable.columns[idx].toLowerCase()
            ));
            if (!sameSchema) {
                throw new Error('Les schémas doivent être compatibles (mêmes colonnes dans le même ordre).');
            }
            let rows = [];
            if (op === 'union') {
                const seen = new Set();
                [...leftTable.rows, ...rightTable.rows].forEach(row => {
                    const key = JSON.stringify(row);
                    if (!seen.has(key)) {
                        seen.add(key);
                        rows.push([...row]);
                    }
                });
            } else {
                const rightKeys = new Set(rightTable.rows.map(row => JSON.stringify(row)));
                rows = leftTable.rows.filter(row => !rightKeys.has(JSON.stringify(row))).map(row => [...row]);
            }
            const symbol = op === 'union' ? '∪' : '−';
            return {
                resultTable: { columns: [...leftTable.columns], rows },
                expression: `${leftName} ${symbol} ${rightName}`,
                message: `${op === 'union' ? 'Union' : 'Différence'} : ${rows.length} ligne(s).`
            };
        },

        product(leftName, rightName, leftTable, rightTable) {
            const columns = [
                ...leftTable.columns.map(col => `${leftName}.${col}`),
                ...rightTable.columns.map(col => `${rightName}.${col}`)
            ];
            const rows = [];
            leftTable.rows.forEach(leftRow => {
                rightTable.rows.forEach(rightRow => {
                    rows.push([...leftRow, ...rightRow]);
                });
            });
            return {
                resultTable: { columns, rows },
                expression: `${leftName} × ${rightName}`,
                message: `Produit cartésien : ${rows.length} ligne(s) (${leftTable.rows.length} × ${rightTable.rows.length}).`
            };
        },

        rename(tableName, tableDef, oldName, newName) {
            if (!oldName || !newName) throw new Error('Veuillez remplir les deux champs.');
            const colIdx = tableDef.columns.indexOf(oldName);
            if (colIdx === -1) throw new Error(`Colonne "${oldName}" introuvable dans ${tableName}.`);
            if (tableDef.columns.includes(newName) && oldName !== newName) {
                throw new Error(`La colonne "${newName}" existe déjà dans ${tableName}.`);
            }
            const columns = [...tableDef.columns];
            columns[colIdx] = newName;
            return {
                resultTable: { columns, rows: tableDef.rows.map(row => [...row]) },
                expression: `ρ<sub>${newName}/${oldName}</sub>(${tableName})`,
                message: `Colonne "${oldName}" renommée en "${newName}".`
            };
        }
    };

    /* ===== EXECUTE OPERATIONS ===== */
    function executeSelection() {
        const fb = document.getElementById('selFeedback');
        try {
            const tName = document.getElementById('selTable').value;
            const condStr = document.getElementById('selCondition').value.trim();
            const t = tables[tName];
            const opResult = algebraEngine.selection(tName, t, condStr);
            resultTable = opResult.resultTable;
            showResult(resultTable, opResult.matchedIndices, tName);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    function executeProjection() {
        const fb = document.getElementById('projFeedback');
        try {
            const tName = document.getElementById('projTable').value;
            const checks = document.querySelectorAll('#projCols input[type=checkbox]:checked');
            const keepCols = Array.from(checks).map(c => c.value);
            const t = tables[tName];
            const opResult = algebraEngine.projection(tName, t, keepCols);
            resultTable = opResult.resultTable;
            showResult(resultTable);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    function executeJoin() {
        const fb = document.getElementById('joinFeedback');
        try {
            const leftName = document.getElementById('joinLeft').value;
            const rightName = document.getElementById('joinRight').value;
            const condStr = document.getElementById('joinCond').value.trim();
            const tL = tables[leftName];
            const tR = tables[rightName];
            const opResult = algebraEngine.join(leftName, rightName, tL, tR, condStr);
            resultTable = opResult.resultTable;
            showResult(resultTable);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    function executeSetOp(op) {
        const fb = document.getElementById('setFeedback');
        try {
            const t1Name = document.getElementById('setT1').value;
            const t2Name = document.getElementById('setT2').value;
            const t1 = tables[t1Name];
            const t2 = tables[t2Name];
            const opResult = algebraEngine.setOperation(op, t1Name, t2Name, t1, t2);
            resultTable = opResult.resultTable;
            showResult(resultTable);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    function executeProduct() {
        const fb = document.getElementById('prodFeedback');
        try {
            const t1Name = document.getElementById('prodT1').value;
            const t2Name = document.getElementById('prodT2').value;
            const t1 = tables[t1Name];
            const t2 = tables[t2Name];
            const opResult = algebraEngine.product(t1Name, t2Name, t1, t2);
            resultTable = opResult.resultTable;
            showResult(resultTable);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    function executeRename() {
        const fb = document.getElementById('renFeedback');
        try {
            const tName = document.getElementById('renTable').value;
            const oldN = document.getElementById('renOld').value.trim();
            const newN = document.getElementById('renNew').value.trim();
            const t = tables[tName];
            const opResult = algebraEngine.rename(tName, t, oldN, newN);
            resultTable = opResult.resultTable;
            showResult(resultTable);
            updateExprBar(opResult.expression);
            addHistory(opResult.expression, resultTable.rows.length);
            fb.textContent = opResult.message;
            fb.className = 'feedback success';
        } catch (e) {
            fb.textContent = e.message; fb.className = 'feedback error';
        }
    }

    /* ===== DISPLAY RESULT ===== */
    function showResult(resTable, highlightedSourceRows, sourceName) {
        const section = document.getElementById('resultSection');
        section.style.display = 'block';
        const area = document.getElementById('resultTableArea');
        area.innerHTML = '';
        area.appendChild(buildTableHTML(resTable, '_result', false));

        // Also highlight source if applicable
        if (highlightedSourceRows && sourceName) {
            const srcArea = document.getElementById('sourceTablesArea');
            srcArea.innerHTML = '';
            const t = tables[sourceName];
            const card = document.createElement('div');
            card.className = 'card';
            const header = document.createElement('div');
            header.className = 'table-header';
            header.innerHTML = `<h3>${sourceName} <span class="badge badge-primary">${t.rows.length} lignes</span></h3>
                <div class="table-actions">
                    <button onclick="addRow('${sourceName}')">+ Ligne</button>
                    <button onclick="deleteTable('${sourceName}')">Supprimer table</button>
                </div>`;
            card.appendChild(header);
            card.appendChild(buildTableHTML(t, sourceName, true, highlightedSourceRows));
            srcArea.appendChild(card);
        }
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* ===== SAVE RESULT ===== */
    function saveResultAsTable() {
        if (!resultTable) return;
        resultCounter++;
        const name = 'Résultat_' + resultCounter;
        tables[name] = deepCopy(resultTable);
        selectedTable = name;
        renderTableList();
        renderSourceTables();
    }

    /* ===== EXPRESSION BAR ===== */
    function updateExprBar(exprHTML) {
        const bar = document.getElementById('exprBar');
        if (!exprHTML) {
            bar.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">Expression : aucune opération en cours</span>';
        } else {
            bar.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;margin-right:0.5rem;">Expression :</span> ' + exprHTML;
        }
    }

    /* ===== HISTORY ===== */
    function addHistory(exprHTML, rowCount) {
        history.push({ expr: exprHTML, rows: rowCount });
        renderHistory();
    }
    function renderHistory() {
        const el = document.getElementById('historyList');
        if (history.length === 0) {
            el.innerHTML = '<p class="empty-msg">Aucune opération effectuée</p>';
            return;
        }
        el.innerHTML = '';
        history.forEach((h, i) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `<span class="hist-num">${i + 1}</span><span class="hist-expr">${h.expr}</span><span class="hist-rows">${h.rows} ligne(s)</span>`;
            el.appendChild(item);
        });
    }

    /* ===== RESET ===== */
    function resetAll() { init(); }

    /* ===== INIT ===== */
    init();
        window.selectOp = selectOp;
        window.resetAll = resetAll;
        window.saveResultAsTable = saveResultAsTable;
        window.addRow = addRow;
        window.deleteTable = deleteTable;
        window.editRow = editRow;
        window.deleteRow = deleteRow;
        window.closeModal = closeModal;
        window.submitModal = submitModal;
        window.executeSelection = executeSelection;
        window.updateProjCols = updateProjCols;
        window.executeProjection = executeProjection;
        window.executeJoin = executeJoin;
        window.executeSetOp = executeSetOp;
        window.executeProduct = executeProduct;
        window.executeRename = executeRename;
    }
}

if (typeof window !== 'undefined') {
    window.RelationalAlgebraPage = RelationalAlgebraPage;
}
