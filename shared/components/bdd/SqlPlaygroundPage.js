// Moteur SQL pur : shared/components/algorithms/sql-engine.js (expose window.createSqlEngine).
// Partagé entre la page complète (SqlPlaygroundPage, avec inspecteur de pseudocode) et le widget
// standalone (SqlPlaygroundWidget, utilisable dans un deck PresentaForge).
class SqlPlaygroundPage extends ConceptPage {
    async init() {
        await super.init();
        this.mountPseudocodeInspector();
        (() => {
            'use strict';

            const sqlEngine = createSqlEngine();

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
                    feedbackRenderer.showError('Saisis une requête SQL.');
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

// ── Standalone widget ──────────────────────────────────────────
// Meme moteur SQL (createSqlEngine, partage avec SqlPlaygroundPage), UI
// compacte : editeur + resultats + reset, sans le panneau de schema, les
// exemples ni l'historique (secondaires, coupes comme pour les autres
// widgets - ex. HeapWidget qui n'expose pas Heapsort).
class SqlPlaygroundWidget {
    static mount(container, config = {}) {
        if (container.dataset.sqlw) return;
        container.dataset.sqlw = '1';
        const w = new SqlPlaygroundWidget(container, config);
        w.init();
        return w;
    }

    constructor(container, config = {}) {
        this.root = container;
        this.initialSQL = typeof config.sql === 'string' ? config.sql : 'SELECT * FROM employes;';
        this.engine = createSqlEngine();
    }

    init() {
        this.root.innerHTML = `<div class="sqlw-container widget-fit">
            <div class="widget-fit-header">
                <textarea class="sqlw-editor" data-editor spellcheck="false">${this.initialSQL}</textarea>
                <div class="sqlw-controls">
                    <button class="sqlw-btn sqlw-btn-primary" data-run>Exécuter</button>
                    <button class="sqlw-btn sqlw-btn-secondary" data-clear>Effacer</button>
                    <button class="sqlw-btn sqlw-btn-secondary" data-reset>${OEIIcons.render('refresh')} Reset BDD</button>
                </div>
            </div>
            <div class="sqlw-result widget-fit-body" data-result></div>
        </div>`;

        this._bind();
        this._run();
    }

    _q(sel) { return this.root.querySelector(sel); }

    _bind() {
        const editor = this._q('[data-editor]');
        this._q('[data-run]').addEventListener('click', () => this._run());
        this._q('[data-clear]').addEventListener('click', () => { editor.value = ''; editor.focus(); });
        this._q('[data-reset]').addEventListener('click', () => {
            this.engine.reset();
            this._q('[data-result]').innerHTML = '<div class="sqlw-message sqlw-message-success">Base de données réinitialisée.</div>';
        });
        editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); this._run(); }
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(editor.selectionEnd);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
        });
    }

    _formatValue(v) {
        if (v === null || v === undefined) return '<span class="sqlw-null">NULL</span>';
        if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
        return String(v);
    }

    _run() {
        const sql = this._q('[data-editor]').value.trim();
        const resultEl = this._q('[data-result]');
        if (!sql) {
            resultEl.innerHTML = '<div class="sqlw-message sqlw-message-error">Saisis une requête SQL.</div>';
            return;
        }
        try {
            const result = this.engine.execute(sql);
            if (result.type === 'result') {
                let html = `<div class="sqlw-result-info">${result.count} ligne(s) retournée(s)</div>`;
                html += '<div class="sqlw-table-wrap"><table class="sqlw-table"><thead><tr>';
                for (const col of result.columns) html += `<th>${col}</th>`;
                html += '</tr></thead><tbody>';
                if (result.rows.length === 0) {
                    html += `<tr><td colspan="${result.columns.length}" class="sqlw-empty">Aucun résultat</td></tr>`;
                } else {
                    for (const row of result.rows) {
                        html += '<tr>' + row.map((v) => `<td>${this._formatValue(v)}</td>`).join('') + '</tr>';
                    }
                }
                html += '</tbody></table></div>';
                resultEl.innerHTML = html;
            } else {
                resultEl.innerHTML = `<div class="sqlw-message sqlw-message-${result.class}">${result.message}</div>`;
            }
        } catch (e) {
            resultEl.innerHTML = `<div class="sqlw-message sqlw-message-error"><strong>Erreur :</strong> ${e.message}</div>`;
        }
    }

    destroy() {
        if (this.root) this.root.innerHTML = '';
    }
}

if (typeof window !== 'undefined') {
    window.SqlPlaygroundWidget = SqlPlaygroundWidget;
}
