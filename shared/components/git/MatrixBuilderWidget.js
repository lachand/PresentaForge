class MatrixBuilderWidget {
    static ensureStyles() {
        if (document.getElementById('mbw-styles')) return;
        const s = document.createElement('style');
        s.id = 'mbw-styles';
        s.textContent = `
.mbw { font-family: var(--font); }
.mbw-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 660px) { .mbw-layout { grid-template-columns: 1fr; } }
.mbw-panel { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; }
.mbw-panel-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 0 0 0.85rem; }
.mbw-dim { margin-bottom: 0.85rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--border); }
.mbw-dim:last-of-type { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.mbw-dim-header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.45rem; }
.mbw-dim-key { font-family: monospace; font-size: 0.8rem; font-weight: 600; color: var(--heading); flex: 1; background: transparent; border: none; outline: none; padding: 0; }
.mbw-dim-key:focus { border-bottom: 1px dashed var(--primary); }
.mbw-dim-remove { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; padding: 0 0.1rem; line-height: 1; }
.mbw-dim-remove:hover { color: #ef4444; }
.mbw-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
.mbw-tag { display: inline-flex; align-items: center; gap: 0.25rem; background: color-mix(in srgb, var(--primary) 12%, var(--hover)); border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border)); border-radius: 20px; padding: 0.15rem 0.55rem; font-size: 0.73rem; font-family: monospace; color: var(--heading); }
.mbw-tag-remove { background: none; border: none; cursor: pointer; padding: 0; line-height: 1; color: var(--muted); font-size: 0.75rem; }
.mbw-tag-remove:hover { color: #ef4444; }
.mbw-tag-input { border: 1px dashed var(--border); border-radius: 20px; padding: 0.15rem 0.5rem; font-size: 0.73rem; font-family: monospace; background: transparent; color: var(--text); outline: none; width: 80px; }
.mbw-tag-input:focus { border-color: var(--primary); width: 110px; }
.mbw-add-dim { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.85rem; }
.mbw-btn-add { padding: 0.28rem 0.7rem; border: 1.5px dashed var(--border); border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; font-size: 0.75rem; font-family: var(--font); transition: all 0.15s; }
.mbw-btn-add:hover { border-color: var(--primary); color: var(--primary); }
.mbw-count { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--primary); color: #fff; border-radius: 20px; padding: 0.2rem 0.75rem; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.75rem; }
.mbw-count-sub { font-weight: 400; font-size: 0.72rem; opacity: 0.85; }
.mbw-table-wrap { overflow-x: auto; margin-bottom: 0.85rem; }
.mbw-table { border-collapse: collapse; width: 100%; font-size: 0.72rem; }
.mbw-table th { background: var(--hover); padding: 0.35rem 0.6rem; text-align: center; border: 1px solid var(--border); font-family: monospace; font-weight: 600; color: var(--heading); }
.mbw-table td { padding: 0.3rem 0.6rem; text-align: center; border: 1px solid var(--border); font-family: monospace; font-size: 0.7rem; color: var(--muted); }
.mbw-table td.job-cell { background: color-mix(in srgb, var(--primary) 6%, var(--card)); color: var(--heading); font-weight: 500; }
.mbw-yaml { background: #0f172a; border-radius: 8px; padding: 0.75rem 1rem; font-family: monospace; font-size: 0.73rem; line-height: 1.7; overflow-x: auto; }
.mbw-yaml .y-key  { color: #7dd3fc; }
.mbw-yaml .y-val  { color: #86efac; }
.mbw-yaml .y-str  { color: #fde68a; }
.mbw-yaml .y-cmmt { color: #64748b; }
.mbw-empty { color: var(--muted); font-size: 0.8rem; font-style: italic; padding: 1rem 0; }
.mbw-flat-list { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.85rem; }
.mbw-job-chip { background: color-mix(in srgb, var(--primary) 10%, var(--hover)); border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border)); border-radius: 6px; padding: 0.2rem 0.55rem; font-family: monospace; font-size: 0.7rem; color: var(--heading); }
        `;
        document.head.appendChild(s);
    }

    static mount(container, config = {}) {
        MatrixBuilderWidget.ensureStyles();

        let dims = [
            { key: 'python-version', values: ['3.10', '3.11', '3.12'] },
            { key: 'os',             values: ['ubuntu-latest', 'windows-latest'] }
        ];

        function cartesian(arrays) {
            if (arrays.length === 0) return [[]];
            const [first, ...rest] = arrays;
            const restProduct = cartesian(rest);
            return first.flatMap(v => restProduct.map(combo => [v, ...combo]));
        }

        function getProduct() {
            const arrays = dims.map(d => d.values);
            if (arrays.some(a => a.length === 0)) return [];
            return cartesian(arrays);
        }

        function jobName(combo) {
            return combo.map(v => v.replace('ubuntu-latest', 'ubuntu').replace('windows-latest', 'windows').replace('macos-latest', 'macos')).join('-');
        }

        function renderYaml() {
            if (dims.length === 0) return `<span class="y-cmmt"># Aucune dimension définie</span>`;
            const product = getProduct();
            const lines = [
                `<span class="y-key">strategy</span><span class="y-val">:</span>`,
                `  <span class="y-key">matrix</span><span class="y-val">:</span>`,
                ...dims.map(d => {
                    const vals = d.values.length === 0
                        ? `<span class="y-val">[]</span>`
                        : `[${d.values.map(v => `<span class="y-str">'${v}'</span>`).join(', ')}]`;
                    return `    <span class="y-key">${d.key}</span><span class="y-val">:</span> ${vals}`;
                }),
                `<span class="y-cmmt"># → ${product.length} job${product.length > 1 ? 's' : ''} généré${product.length > 1 ? 's' : ''} en parallèle</span>`
            ];
            return lines.join('\n');
        }

        function renderResults() {
            const product = getProduct();
            const total = product.length;

            // Count badge
            const countHtml = `<div class="mbw-count">${total} job${total > 1 ? 's' : ''} <span class="mbw-count-sub">générés en parallèle</span></div>`;

            if (total === 0) {
                return `${countHtml}<p class="mbw-empty">Ajoutez des valeurs dans chaque dimension pour voir les jobs générés.</p>`;
            }

            let tableHtml = '';
            if (dims.length === 2) {
                // 2D table: rows = dim[0], cols = dim[1]
                const rows = dims[0].values;
                const cols = dims[1].values;
                tableHtml = `<div class="mbw-table-wrap"><table class="mbw-table">
                    <tr>
                        <th>${dims[0].key} \\ ${dims[1].key}</th>
                        ${cols.map(c => `<th>${c}</th>`).join('')}
                    </tr>
                    ${rows.map(r => `<tr>
                        <th>${r}</th>
                        ${cols.map(c => `<td class="job-cell">test (${[r, c].map(v => v.split('-')[0]).join(', ')})</td>`).join('')}
                    </tr>`).join('')}
                </table></div>`;
            } else if (dims.length === 1) {
                // Flat list
                tableHtml = `<div class="mbw-flat-list">${product.map(combo =>
                    `<span class="mbw-job-chip">test (${combo[0]})</span>`
                ).join('')}</div>`;
            } else {
                // 3+ dims: flat chip list
                tableHtml = `<div class="mbw-flat-list">${product.map(combo =>
                    `<span class="mbw-job-chip">test (${combo.join(', ')})</span>`
                ).join('')}</div>`;
            }

            return `${countHtml}${tableHtml}`;
        }

        function render() {
            container.innerHTML = `<div class="mbw">
                <div class="mbw-layout">
                    <div class="mbw-panel">
                        <p class="mbw-panel-title">Dimensions de la matrix</p>
                        <div class="mbw-dims"></div>
                        <div class="mbw-add-dim">
                            <button class="mbw-btn-add mbw-btn-add-dim">+ Nouvelle dimension</button>
                        </div>
                    </div>
                    <div class="mbw-panel">
                        <p class="mbw-panel-title">Jobs générés</p>
                        <div class="mbw-results"></div>
                        <p class="mbw-panel-title" style="margin-top:0.85rem;">YAML généré</p>
                        <div class="mbw-yaml"></div>
                    </div>
                </div>
            </div>`;

            renderDims();
            updateResults();

            container.querySelector('.mbw-btn-add-dim').addEventListener('click', () => {
                dims.push({ key: `dim-${dims.length + 1}`, values: [] });
                render();
            });
        }

        function renderDims() {
            const dimsEl = container.querySelector('.mbw-dims');
            dimsEl.innerHTML = dims.map((dim, di) => `
                <div class="mbw-dim" data-di="${di}">
                    <div class="mbw-dim-header">
                        <input class="mbw-dim-key" type="text" value="${dim.key}" placeholder="clé" data-di="${di}"/>
                        ${dims.length > 1 ? `<button class="mbw-dim-remove" data-di="${di}" title="Supprimer cette dimension">✕</button>` : ''}
                    </div>
                    <div class="mbw-tags">
                        ${dim.values.map((v, vi) => `
                            <span class="mbw-tag">
                                ${v}
                                <button class="mbw-tag-remove" data-di="${di}" data-vi="${vi}">✕</button>
                            </span>`).join('')}
                        <input class="mbw-tag-input" type="text" placeholder="+ valeur" data-di="${di}"/>
                    </div>
                </div>`).join('');

            dimsEl.querySelectorAll('.mbw-dim-key').forEach(input => {
                input.addEventListener('change', e => {
                    const di = +e.target.dataset.di;
                    dims[di].key = e.target.value.trim() || `dim-${di + 1}`;
                    updateResults();
                });
            });

            dimsEl.querySelectorAll('.mbw-dim-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                    const di = +e.currentTarget.dataset.di;
                    dims.splice(di, 1);
                    render();
                });
            });

            dimsEl.querySelectorAll('.mbw-tag-remove').forEach(btn => {
                btn.addEventListener('click', e => {
                    const di = +e.currentTarget.dataset.di;
                    const vi = +e.currentTarget.dataset.vi;
                    dims[di].values.splice(vi, 1);
                    renderDims();
                    updateResults();
                });
            });

            dimsEl.querySelectorAll('.mbw-tag-input').forEach(input => {
                const commit = e => {
                    const di = +e.target.dataset.di;
                    const val = e.target.value.trim();
                    if (!val) return;
                    if (!dims[di].values.includes(val)) {
                        dims[di].values.push(val);
                        renderDims();
                        updateResults();
                    } else {
                        e.target.value = '';
                    }
                };
                input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(e); } });
                input.addEventListener('blur', commit);
            });
        }

        function updateResults() {
            const res = container.querySelector('.mbw-results');
            if (res) res.innerHTML = renderResults();
            const yamlEl = container.querySelector('.mbw-yaml');
            if (yamlEl) yamlEl.innerHTML = renderYaml();
        }

        render();
        return { destroy() {} };
    }
}
window.MatrixBuilderWidget = MatrixBuilderWidget;
