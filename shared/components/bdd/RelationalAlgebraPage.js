class RelationalAlgebraPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
    /* ===== DATA ===== */
    // Données et moteur purs : shared/components/algorithms/relational-algebra-engine.js
    const { algebraEngine, ALGEBRA_INITIAL_TABLES: initialTables } = window.RelationalAlgebraEngine;

    let tables = {};
    let selectedTable = null;
    let currentOp = null;
    let history = [];
    let resultTable = null;
    let resultCounter = 0;

    function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

    function init() {
        tables = deepCopy(initialTables);
        selectedTable = 'Employes';
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
            area.innerHTML = '<p class="empty-msg">Sélectionne une table</p>';
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
                <button data-inline-onclick="addRow('${selectedTable}')">+ Ligne</button>
                <button data-inline-onclick="deleteTable('${selectedTable}')">Supprimer table</button>
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
                td.innerHTML = `<button style="font-size:0.7rem;padding:0.2rem 0.4rem;border:1px solid var(--border);border-radius:4px;background:var(--card);cursor:pointer;font-family:var(--font);margin-right:0.2rem;" data-inline-onclick="editRow('${tableName}',${ri})">Modifier</button><button style="font-size:0.7rem;padding:0.2rem 0.4rem;border:1px solid var(--danger);border-radius:4px;background:var(--card);cursor:pointer;font-family:var(--font);color:var(--danger);" data-inline-onclick="deleteRow('${tableName}',${ri})">Suppr.</button>`;
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
        showEditModal('Ajouter une ligne - ' + tableName, t.columns, t.columns.map(() => ''), (values) => {
            t.rows.push(values.map((v, i) => autoType(v)));
            renderTableList();
            renderSourceTables();
        });
    }

    function editRow(tableName, rowIdx) {
        const t = tables[tableName];
        showEditModal('Modifier la ligne - ' + tableName, t.columns, t.rows[rowIdx].map(String), (values) => {
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
            <button class="btn btn-secondary" style="min-width:auto;font-size:0.85rem;" data-inline-onclick="closeModal()">Annuler</button>
            <button class="btn btn-primary" style="min-width:auto;font-size:0.85rem;" data-inline-onclick="submitModal()">Valider</button>
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
                <h4>&sigma; S&eacute;lection - Filtrer les lignes selon une condition</h4>
                <div class="field-group">
                    <label>Table source</label>
                    <select id="selTable">${tNames.map(n => `<option value="${n}" ${n===selectedTable?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Condition (ex : salaire > 50000, nom = 'Alice' ; ET, OU, NON et parenthèses acceptés)</label>
                    <input type="text" id="selCondition" placeholder="salaire > 50000" style="font-family:var(--font-mono);">
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeSelection()">Ex&eacute;cuter &sigma;</button>
                </div>
                <div class="feedback" id="selFeedback"></div>
            `;
        } else if (op === 'projection') {
            const t = tables[selectedTable] || tables[tNames[0]];
            const tName = selectedTable || tNames[0];
            el.innerHTML = `
                <h4>&pi; Projection - Garder certaines colonnes</h4>
                <div class="field-group">
                    <label>Table source</label>
                    <select id="projTable" data-inline-onchange="updateProjCols()">${tNames.map(n => `<option value="${n}" ${n===tName?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Colonnes &agrave; garder</label>
                    <div class="checkbox-group" id="projCols"></div>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeProjection()">Ex&eacute;cuter &pi;</button>
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
                    <label>Condition (ex : departement_id = id) - vide = jointure naturelle sur toutes les colonnes de même nom</label>
                    <input type="text" id="joinCond" placeholder="departement_id = id" style="font-family:var(--font-mono);">
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeJoin()">Ex&eacute;cuter &#x2A1D;</button>
                </div>
                <div class="feedback" id="joinFeedback"></div>
            `;
        } else if (op === 'union' || op === 'difference') {
            const symbol = op === 'union' ? '∪' : '−';
            const name = op === 'union' ? 'Union' : 'Différence';
            el.innerHTML = `
                <h4>${symbol} ${name} - Tables de m&ecirc;me sch&eacute;ma</h4>
                <div class="field-group">
                    <label>Table 1</label>
                    <select id="setT1">${tNames.map(n => `<option value="${n}">${n}</option>`).join('')}</select>
                </div>
                <div class="field-group">
                    <label>Table 2</label>
                    <select id="setT2">${tNames.map((n,i) => `<option value="${n}" ${i===Math.min(1,tNames.length-1)?'selected':''}>${n}</option>`).join('')}</select>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeSetOp('${op}')">Ex&eacute;cuter ${symbol}</button>
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
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeProduct()">Ex&eacute;cuter &times;</button>
                </div>
                <div class="feedback" id="prodFeedback"></div>
            `;
        } else if (op === 'renommage') {
            el.innerHTML = `
                <h4>&rho; Renommage - Renommer une colonne</h4>
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
                    <button class="btn btn-primary" style="font-size:0.85rem;min-width:auto;" data-inline-onclick="executeRename()">Ex&eacute;cuter &rho;</button>
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
            lbl.innerHTML = `<input type="checkbox" value="${col}" checked> ${col}`;
            const cb = lbl.querySelector('input');
            cb.addEventListener('change', () => lbl.classList.toggle('checked', cb.checked));
            container.appendChild(lbl);
        });
    }

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
                    <button data-inline-onclick="addRow('${sourceName}')">+ Ligne</button>
                    <button data-inline-onclick="deleteTable('${sourceName}')">Supprimer table</button>
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
