class ExerciseQuestionTypes {
    static normalize(value) {
        return String(value == null ? '' : value).trim().toLowerCase();
    }

    static escape(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    static safeHtml(text) {
        if (text == null) return '';
        const str = String(text);
        const allowedTags = ['code', 'b', 'i', 'em', 'strong', 'br', 'div', 'span', 'sub', 'sup'];
        const tagPattern = allowedTags.map(t => `${t}`).join('|');
        const allowedRe = new RegExp(`<(/?(?:${tagPattern}))(?:\\s+(?:class|id|style)="[^"]*")*\\s*/?>`, 'gi');
        const placeholders = [];
        const withPlaceholders = str.replace(allowedRe, (match) => {
            placeholders.push(match);
            return `\x00PH${placeholders.length - 1}\x00`;
        });
        const escaped = ExerciseQuestionTypes.escape(withPlaceholders);
        return escaped.replace(/\x00PH(\d+)\x00/g, (_, idx) => placeholders[Number(idx)]);
    }

    static normalizeArray(values) {
        return (Array.isArray(values) ? values : []).map((v) => ExerciseQuestionTypes.normalize(v));
    }

    static shuffleArray(values) {
        const copy = Array.isArray(values) ? [...values] : [];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    static arraysEqualBy(valuesA, valuesB, keyFn) {
        if (!Array.isArray(valuesA) || !Array.isArray(valuesB)) return false;
        if (valuesA.length !== valuesB.length) return false;
        for (let i = 0; i < valuesA.length; i++) {
            if (keyFn(valuesA[i], i) !== keyFn(valuesB[i], i)) return false;
        }
        return true;
    }

    static shuffleDifferent(values, keyFn) {
        const source = Array.isArray(values) ? values : [];
        if (source.length < 2) return [...source];
        let shuffled = ExerciseQuestionTypes.shuffleArray(source);
        let attempts = 0;
        while (
            attempts < 6 &&
            ExerciseQuestionTypes.arraysEqualBy(shuffled, source, keyFn)
        ) {
            shuffled = ExerciseQuestionTypes.shuffleArray(source);
            attempts += 1;
        }
        if (ExerciseQuestionTypes.arraysEqualBy(shuffled, source, keyFn)) {
            // Fallback deterministic swap to guarantee a different order.
            const fallback = [...source];
            [fallback[0], fallback[1]] = [fallback[1], fallback[0]];
            return fallback;
        }
        return shuffled;
    }

    static shuffledOnce(question, key, values) {
        if (!question || !Array.isArray(values)) return values || [];
        if (!question.__shuffleCache) question.__shuffleCache = {};
        if (!Array.isArray(question.__shuffleCache[key])) {
            const keyFn = (entry) => {
                if (entry && typeof entry === 'object') {
                    if (Object.prototype.hasOwnProperty.call(entry, 'id')) return String(entry.id);
                    if (Object.prototype.hasOwnProperty.call(entry, 'label')) return String(entry.label);
                }
                return String(entry);
            };
            question.__shuffleCache[key] = ExerciseQuestionTypes.shuffleDifferent(values, keyFn);
        }
        return question.__shuffleCache[key];
    }

    static acceptedMatch(value, expected, accepted) {
        const normalized = ExerciseQuestionTypes.normalize(value);
        if (!normalized) return false;
        if (normalized === ExerciseQuestionTypes.normalize(expected)) return true;
        if (!Array.isArray(accepted)) return false;
        return accepted.map((v) => ExerciseQuestionTypes.normalize(v)).includes(normalized);
    }

    static resolveBindContext(arg3, arg4) {
        if (arg4 && typeof arg4 === 'object') return arg4;
        if (arg3 && typeof arg3 === 'object' && Object.prototype.hasOwnProperty.call(arg3, 'signal')) return arg3;
        return {};
    }

    static getBindOptions(context) {
        if (!context || typeof context !== 'object' || !context.signal) return undefined;
        return { signal: context.signal };
    }

    static createRegistry() {
        return {
            mcq: {
                render(question, stored) {
                    const ordered = (question.options || []).map((opt, idx) => ({ idx, opt }));
                    const shuffled = ExerciseQuestionTypes.shuffledOnce(question, 'mcq_options', ordered);
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        <div class="question-options">
                            ${shuffled.map(({ idx, opt }) => `
                                <label class="option-row">
                                    <input type="radio" name="mcq" value="${idx}" ${String(stored) === String(idx) ? 'checked' : ''}>
                                    <span>${ExerciseQuestionTypes.escape(opt)}</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                },
                read(container) {
                    const checked = container.querySelector('input[name="mcq"]:checked');
                    if (!checked) return { ok: false, error: 'Sélectionnez une option.' };
                    return { ok: true, value: checked.value };
                },
                evaluate(question, answer) {
                    const ok = Number(answer) === Number(question.answer);
                    const misconceptions = question.misconceptions && typeof question.misconceptions === 'object'
                        ? question.misconceptions
                        : {};
                    const selectedKey = String(answer);
                    const hint = ok
                        ? ''
                        : String(misconceptions[selectedKey] || question.hintIncorrect || '');
                    return {
                        ok,
                        expectedText: (question.options || [])[question.answer] || String(question.answer ?? ''),
                        hint
                    };
                }
            },
            'multi-select': {
                render(question, stored) {
                    const selected = Array.isArray(stored) ? stored.map((v) => String(v)) : [];
                    const ordered = (question.options || []).map((opt, idx) => ({ idx, opt }));
                    const shuffled = ExerciseQuestionTypes.shuffledOnce(question, 'multi_options', ordered);
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        <div class="question-options">
                            ${shuffled.map(({ idx, opt }) => `
                                <label class="option-row">
                                    <input type="checkbox" name="multi-answer" value="${idx}" ${selected.includes(String(idx)) ? 'checked' : ''}>
                                    <span>${ExerciseQuestionTypes.escape(opt)}</span>
                                </label>
                            `).join('')}
                        </div>
                        <div class="hint">Plusieurs réponses peuvent être correctes.</div>
                    `;
                },
                read(container) {
                    const checked = Array.from(container.querySelectorAll('input[name="multi-answer"]:checked'));
                    if (!checked.length) return { ok: false, error: 'Sélectionnez au moins une option.' };
                    return { ok: true, value: checked.map((node) => String(node.value)) };
                },
                evaluate(question, answer) {
                    const expected = (Array.isArray(question.answer) ? question.answer : []).map((v) => String(v)).sort();
                    const actual = (Array.isArray(answer) ? answer : []).map((v) => String(v)).sort();
                    const ok = expected.length === actual.length && expected.every((v, i) => v === actual[i]);
                    const expectedText = expected.map((idx) => (question.options || [])[Number(idx)]).filter(Boolean).join(' | ');
                    let hint = '';
                    if (!ok) {
                        const missing = expected.filter((idx) => !actual.includes(idx));
                        const extra = actual.filter((idx) => !expected.includes(idx));
                        const details = [];
                        if (missing.length) {
                            details.push(`il manque ${missing.map((idx) => `"${(question.options || [])[Number(idx)] || idx}"`).join(', ')}`);
                        }
                        if (extra.length) {
                            details.push(`a retirer ${extra.map((idx) => `"${(question.options || [])[Number(idx)] || idx}"`).join(', ')}`);
                        }
                        hint = details.join(' ; ');
                        if (!hint) {
                            hint = String(question.hintIncorrect || '');
                        }
                    }
                    return { ok, expectedText, hint };
                }
            },
            short: {
                render(question, stored) {
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        <input id="short-answer" class="input" type="text" value="${ExerciseQuestionTypes.escape(stored || '')}" placeholder="Votre réponse">
                        <div class="hint">Réponse courte attendue (mot-clé ou valeur).</div>
                    `;
                },
                read(container) {
                    const value = container.querySelector('#short-answer')?.value || '';
                    if (!String(value).trim()) return { ok: false, error: 'Saisissez une réponse.' };
                    return { ok: true, value };
                },
                evaluate(question, answer) {
                    return {
                        ok: ExerciseQuestionTypes.acceptedMatch(answer, question.answer, question.accepted),
                        expectedText: String(question.answer ?? '')
                    };
                }
            },
            ordering: {
                render(question, stored) {
                    const baseItems = Array.isArray(stored) && stored.length
                        ? stored
                        : ExerciseQuestionTypes.shuffledOnce(
                            question,
                            'ordering_items',
                            (question.items || []).map((it, idx) => ({
                                id: String(it.id ?? idx),
                                label: String(it.label ?? it)
                            }))
                        );
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        <div class="ordering-list" data-role="ordering-list">
                            ${baseItems.map((item, idx) => `
                                <div class="ordering-item" data-item-id="${ExerciseQuestionTypes.escape(item.id)}">
                                    <div class="ordering-rank">${idx + 1}</div>
                                    <div class="ordering-label">${ExerciseQuestionTypes.escape(item.label)}</div>
                                    <div class="ordering-actions">
                                        <button class="btn btn-secondary btn-order" data-action="up" type="button">↑</button>
                                        <button class="btn btn-secondary btn-order" data-action="down" type="button">↓</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="hint">Utilisez ↑/↓ pour remettre dans le bon ordre.</div>
                    `;
                },
                bind(container, _question, pageOrContext, maybeContext) {
                    const list = container.querySelector('[data-role="ordering-list"]');
                    if (!list) return;
                    const context = ExerciseQuestionTypes.resolveBindContext(pageOrContext, maybeContext);
                    const listenerOptions = ExerciseQuestionTypes.getBindOptions(context);
                    list.addEventListener('click', (event) => {
                        const btn = event.target.closest('.btn-order');
                        if (!btn) return;
                        const item = btn.closest('.ordering-item');
                        if (!item) return;
                        if (btn.dataset.action === 'up' && item.previousElementSibling) {
                            item.parentElement.insertBefore(item, item.previousElementSibling);
                        } else if (btn.dataset.action === 'down' && item.nextElementSibling) {
                            item.parentElement.insertBefore(item.nextElementSibling, item);
                        }
                        Array.from(item.parentElement.children).forEach((row, i) => {
                            const rank = row.querySelector('.ordering-rank');
                            if (rank) rank.textContent = String(i + 1);
                        });
                    }, listenerOptions);
                },
                read(container) {
                    const rows = Array.from(container.querySelectorAll('.ordering-item'));
                    if (!rows.length) return { ok: false, error: 'Aucun élément à ordonner.' };
                    const value = rows.map((row) => ({
                        id: row.dataset.itemId,
                        label: row.querySelector('.ordering-label')?.textContent || ''
                    }));
                    return { ok: true, value };
                },
                evaluate(question, answer) {
                    const expected = Array.isArray(question.answer) ? question.answer.map((v) => String(v)) : [];
                    const actualIds = (answer || []).map((row) => String(row.id));
                    const actualLabels = (answer || []).map((row) => String(row.label));
                    const okByIds = expected.length && expected.every((v, i) => String(v) === actualIds[i]);
                    const okByLabels = expected.length && expected.every((v, i) => String(v) === actualLabels[i]);
                    return {
                        ok: okByIds || okByLabels,
                        expectedText: expected.join(' -> ')
                    };
                }
            },
            matching: {
                render(question, stored) {
                    const left = ExerciseQuestionTypes.shuffledOnce(question, 'matching_left', question.left || []);
                    const right = ExerciseQuestionTypes.shuffledOnce(question, 'matching_right', question.right || []);
                    const answers = stored || {};
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        <div class="matching-grid">
                            ${left.map((entry, idx) => {
                                const id = String(entry.id ?? idx);
                                const label = String(entry.label ?? entry);
                                const value = answers[id] || '';
                                return `
                                    <div class="matching-row">
                                        <div class="matching-left">${ExerciseQuestionTypes.escape(label)}</div>
                                        <select class="input matching-select" data-left-id="${ExerciseQuestionTypes.escape(id)}">
                                            <option value="">-- Associer --</option>
                                            ${right.map((opt) => {
                                                const val = String(opt.id ?? opt);
                                                const txt = String(opt.label ?? opt);
                                                return `<option value="${ExerciseQuestionTypes.escape(val)}" ${val === value ? 'selected' : ''}>${ExerciseQuestionTypes.escape(txt)}</option>`;
                                            }).join('')}
                                        </select>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                },
                read(container) {
                    const selects = Array.from(container.querySelectorAll('.matching-select'));
                    const value = {};
                    for (const select of selects) {
                        if (!select.value) return { ok: false, error: 'Complétez toutes les associations.' };
                        value[select.dataset.leftId] = select.value;
                    }
                    return { ok: true, value };
                },
                evaluate(question, answer) {
                    const expected = question.answer || {};
                    const ok = Object.keys(expected).every((k) => String(answer?.[k] ?? '') === String(expected[k]));
                    const expectedText = Object.entries(expected).map(([k, v]) => `${k}=>${v}`).join(', ');
                    return { ok, expectedText };
                }
            },
            classification: {
                render(question, stored) {
                    const answers = stored || {};
                    const items = ExerciseQuestionTypes.shuffledOnce(question, 'classification_items', question.items || []);
                    const categories = ExerciseQuestionTypes.shuffledOnce(question, 'classification_categories', question.categories || []);
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario ? `<div class="mini-scenario">${ExerciseQuestionTypes.safeHtml(question.scenario)}</div>` : ''}
                        <div class="matching-grid">
                            ${items.map((entry, idx) => {
                                const id = String(entry.id ?? idx);
                                const label = String(entry.label ?? entry);
                                const value = answers[id] || '';
                                return `
                                    <div class="matching-row">
                                        <div class="matching-left">${ExerciseQuestionTypes.escape(label)}</div>
                                        <select class="input classification-select" data-item-id="${ExerciseQuestionTypes.escape(id)}">
                                            <option value="">-- Catégorie --</option>
                                            ${categories.map((opt, i) => {
                                                const optId = String(opt.id ?? i);
                                                const optLabel = String(opt.label ?? opt);
                                                return `<option value="${ExerciseQuestionTypes.escape(optId)}" ${optId === value ? 'selected' : ''}>${ExerciseQuestionTypes.escape(optLabel)}</option>`;
                                            }).join('')}
                                        </select>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                },
                read(container) {
                    const selects = Array.from(container.querySelectorAll('.classification-select'));
                    const value = {};
                    for (const select of selects) {
                        if (!select.value) return { ok: false, error: 'Classez tous les éléments.' };
                        value[select.dataset.itemId] = select.value;
                    }
                    return { ok: true, value };
                },
                evaluate(question, answer) {
                    const expected = question.answer || {};
                    const ok = Object.keys(expected).every((k) => String(answer?.[k] ?? '') === String(expected[k]));
                    const expectedText = Object.entries(expected).map(([k, v]) => `${k}=>${v}`).join(', ');
                    return { ok, expectedText };
                }
            },
            'guided-construction': {
                render(question, stored) {
                    const tokens = Array.isArray(stored) ? stored : [];
                    const tokenPool = ExerciseQuestionTypes.shuffledOnce(question, 'guided_tokens', question.tokens || []);
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario ? `<div class="mini-scenario" style="margin-bottom:0.5rem;">${ExerciseQuestionTypes.safeHtml(question.scenario)}</div>` : ''}
                        <div class="builder-target" data-role="builder-target">
                            ${(tokens || []).map((t) => `<span class="builder-chip">${ExerciseQuestionTypes.escape(t)}</span>`).join('')}
                        </div>
                        <div class="builder-toolbar">
                            ${tokenPool.map((t) => `<button type="button" class="btn btn-secondary btn-token" data-token="${ExerciseQuestionTypes.escape(t)}">${ExerciseQuestionTypes.escape(t)}</button>`).join('')}
                        </div>
                        <div class="builder-toolbar">
                            <button type="button" class="btn btn-secondary" data-action="undo">Annuler</button>
                            <button type="button" class="btn btn-secondary" data-action="clear">Effacer</button>
                        </div>
                        <input type="hidden" id="guided-answer" value="${ExerciseQuestionTypes.escape(JSON.stringify(tokens))}">
                    `;
                },
                bind(container, _question, pageOrContext, maybeContext) {
                    const hidden = container.querySelector('#guided-answer');
                    const target = container.querySelector('[data-role="builder-target"]');
                    if (!hidden || !target) return;
                    const context = ExerciseQuestionTypes.resolveBindContext(pageOrContext, maybeContext);
                    const listenerOptions = ExerciseQuestionTypes.getBindOptions(context);

                    const repaint = () => {
                        const tokens = JSON.parse(hidden.value || '[]');
                        target.innerHTML = tokens.map((t) => `<span class="builder-chip">${ExerciseQuestionTypes.escape(t)}</span>`).join('');
                    };

                    container.addEventListener('click', (event) => {
                        const tokenBtn = event.target.closest('.btn-token');
                        if (tokenBtn) {
                            const tokens = JSON.parse(hidden.value || '[]');
                            tokens.push(tokenBtn.dataset.token);
                            hidden.value = JSON.stringify(tokens);
                            repaint();
                            return;
                        }
                        const actionBtn = event.target.closest('[data-action]');
                        if (!actionBtn) return;
                        const action = actionBtn.dataset.action;
                        const tokens = JSON.parse(hidden.value || '[]');
                        if (action === 'undo') tokens.pop();
                        if (action === 'clear') tokens.length = 0;
                        hidden.value = JSON.stringify(tokens);
                        repaint();
                    }, listenerOptions);
                },
                read(container) {
                    const raw = container.querySelector('#guided-answer')?.value || '[]';
                    const tokens = JSON.parse(raw);
                    if (!tokens.length) return { ok: false, error: 'Construisez une réponse avant validation.' };
                    return { ok: true, value: tokens };
                },
                evaluate(question, answer) {
                    const expectedTokens = Array.isArray(question.answerTokens) ? question.answerTokens : null;
                    const expectedText = String(question.answer ?? '');
                    const candidateText = Array.isArray(answer) ? answer.join(question.joinWith || '') : String(answer ?? '');
                    if (expectedTokens) {
                        const ok = JSON.stringify(answer || []) === JSON.stringify(expectedTokens);
                        return { ok, expectedText: expectedTokens.join(question.joinWith || '') };
                    }
                    const ok = ExerciseQuestionTypes.normalize(candidateText) === ExerciseQuestionTypes.normalize(expectedText);
                    return { ok, expectedText };
                }
            },
            'protocol-fill': {
                render(question, stored) {
                    const fields = question.fields || [];
                    const values = stored || {};
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.protocol ? `<div class="hint">Protocole: ${ExerciseQuestionTypes.escape(question.protocol)}</div>` : ''}
                        <div class="protocol-grid">
                            ${fields.map((field) => {
                                const key = String(field.key || '');
                                return `
                                    <label class="protocol-row">
                                        <span>${ExerciseQuestionTypes.escape(field.label || key)}</span>
                                        <input class="input protocol-input" data-field-key="${ExerciseQuestionTypes.escape(key)}" placeholder="${ExerciseQuestionTypes.escape(field.placeholder || '')}" value="${ExerciseQuestionTypes.escape(values[key] || '')}">
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    `;
                },
                read(container, question) {
                    const data = {};
                    for (const field of question.fields || []) {
                        const key = String(field.key || '');
                        const val = Array.from(container.querySelectorAll('.protocol-input'))
                            .find((input) => input.dataset.fieldKey === key)?.value || '';
                        if (!String(val).trim()) return { ok: false, error: `Champ requis: ${field.label || key}` };
                        data[key] = val;
                    }
                    return { ok: true, value: data };
                },
                evaluate(question, answer) {
                    const expected = question.answer || {};
                    const accepted = question.accepted || {};
                    const ok = Object.keys(expected).every((key) => {
                        const allowed = Array.isArray(accepted[key]) ? accepted[key] : [];
                        return ExerciseQuestionTypes.acceptedMatch(answer?.[key], expected[key], allowed);
                    });
                    const expectedText = Object.entries(expected).map(([k, v]) => `${k}: ${v}`).join(', ');
                    return { ok, expectedText };
                }
            },
            'api-debug': {
                render(question, stored) {
                    const value = stored || {};
                    const current = question.scenario?.currentResponse || {};
                    const request = question.scenario?.request || {};
                    const currentHeaders = current.headers || {};
                    const currentHeaderRows = Object.keys(currentHeaders).map((k) => ({
                        key: k,
                        value: String(currentHeaders[k] ?? '')
                    }));
                    const rows = Array.isArray(value.headers) ? value.headers : currentHeaderRows;
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario?.context ? `<div class="mini-scenario">${ExerciseQuestionTypes.escape(question.scenario.context)}</div>` : ''}
                        <div class="api-debug-grid">
                            <div class="api-debug-card">
                                <h4>Requête</h4>
                                <div><strong>Méthode:</strong> ${ExerciseQuestionTypes.escape(request.method || '')}</div>
                                <div><strong>Path:</strong> ${ExerciseQuestionTypes.escape(request.path || '')}</div>
                            </div>
                            <div class="api-debug-card">
                                <h4>Réponse actuelle</h4>
                                <div><strong>Status:</strong> ${ExerciseQuestionTypes.escape(current.status || '')}</div>
                                <div><strong>Headers:</strong> ${ExerciseQuestionTypes.escape(JSON.stringify(current.headers || {}))}</div>
                            </div>
                        </div>
                        <div class="api-debug-edit">
                            <label class="protocol-row">
                                <span>Status corrigé</span>
                                <input class="input api-status" type="number" value="${ExerciseQuestionTypes.escape(value.status ?? current.status ?? '')}" placeholder="201">
                            </label>
                            <div class="api-headers" data-role="api-headers">
                                <div class="hint">Headers de réponse corrigés</div>
                                ${(rows || []).map((row, idx) => `
                                    <div class="api-header-row">
                                        <input class="input api-header-key" data-row="${idx}" placeholder="Header" value="${ExerciseQuestionTypes.escape(row.key || '')}">
                                        <input class="input api-header-value" data-row="${idx}" placeholder="Valeur" value="${ExerciseQuestionTypes.escape(row.value || '')}">
                                        <button type="button" class="btn btn-secondary api-remove-row" data-row="${idx}">×</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="btn btn-secondary api-add-row">+ Header</button>
                        </div>
                    `;
                },
                bind(container, _question, pageOrContext, maybeContext) {
                    const root = container.querySelector('[data-role="api-headers"]');
                    if (!root) return;
                    const context = ExerciseQuestionTypes.resolveBindContext(pageOrContext, maybeContext);
                    const listenerOptions = ExerciseQuestionTypes.getBindOptions(context);
                    const rebuild = () => {
                        const rows = Array.from(root.querySelectorAll('.api-header-row'));
                        rows.forEach((row, i) => {
                            row.querySelectorAll('[data-row]').forEach((el) => el.dataset.row = String(i));
                        });
                    };
                    container.addEventListener('click', (event) => {
                        const addBtn = event.target.closest('.api-add-row');
                        if (addBtn) {
                            const idx = root.querySelectorAll('.api-header-row').length;
                            const row = document.createElement('div');
                            row.className = 'api-header-row';
                            row.innerHTML = `
                                <input class="input api-header-key" data-row="${idx}" placeholder="Header">
                                <input class="input api-header-value" data-row="${idx}" placeholder="Valeur">
                                <button type="button" class="btn btn-secondary api-remove-row" data-row="${idx}">×</button>
                            `;
                            root.appendChild(row);
                            rebuild();
                            return;
                        }
                        const removeBtn = event.target.closest('.api-remove-row');
                        if (!removeBtn) return;
                        const row = removeBtn.closest('.api-header-row');
                        if (row) row.remove();
                        rebuild();
                    }, listenerOptions);
                },
                read(container) {
                    const status = container.querySelector('.api-status')?.value || '';
                    if (!String(status).trim()) return { ok: false, error: 'Renseignez un status HTTP.' };
                    const headers = Array.from(container.querySelectorAll('.api-header-row')).map((row) => ({
                        key: row.querySelector('.api-header-key')?.value || '',
                        value: row.querySelector('.api-header-value')?.value || ''
                    })).filter((row) => String(row.key).trim());
                    return { ok: true, value: { status, headers } };
                },
                evaluate(question, answer) {
                    const expected = question.expected || {};
                    const expectedStatus = Number(expected.status);
                    const required = ExerciseQuestionTypes.normalizeArray(expected.requiredHeaders || []);
                    const forbidden = ExerciseQuestionTypes.normalizeArray(expected.forbiddenHeaders || []);
                    const provided = (answer.headers || []).map((h) => ExerciseQuestionTypes.normalize(h.key));

                    const statusOk = Number(answer.status) === expectedStatus;
                    const requiredOk = required.every((h) => provided.includes(h));
                    const forbiddenOk = forbidden.every((h) => !provided.includes(h));
                    const ok = statusOk && requiredOk && forbiddenOk;

                    const missingReq = required.filter((h) => !provided.includes(h));
                    const presentForbidden = forbidden.filter((h) => provided.includes(h));
                    const expectedText = `status=${expected.status}, requis=[${(expected.requiredHeaders || []).join(', ')}], interdits=[${(expected.forbiddenHeaders || []).join(', ')}]`;
                    const details = [];
                    if (!statusOk) details.push(`status attendu ${expected.status}`);
                    if (missingReq.length) details.push(`headers manquants ${missingReq.join(', ')}`);
                    if (presentForbidden.length) details.push(`headers interdits présents ${presentForbidden.join(', ')}`);
                    return { ok, expectedText: details.length ? `${expectedText} (${details.join(' ; ')})` : expectedText };
                }
            },
            'dijkstra-step': {
                render(question, stored) {
                    const nodes = question.graph?.nodes || [];
                    const state = question.state || {};
                    const dist = state.dist || {};
                    const pred = state.pred || {};
                    const value = stored || {};
                    const chosen = value.nextNode || '';
                    const updates = value.updates || {};

                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario ? `<div class="mini-scenario">${ExerciseQuestionTypes.safeHtml(question.scenario)}</div>` : ''}
                        <label class="protocol-row">
                            <span>Prochain sommet à extraire</span>
                            <select class="input dijkstra-next">
                                <option value="">-- Choisir --</option>
                                ${nodes.map((n) => `<option value="${ExerciseQuestionTypes.escape(n)}" ${String(chosen) === String(n) ? 'selected' : ''}>${ExerciseQuestionTypes.escape(n)}</option>`).join('')}
                            </select>
                        </label>
                        <div class="dijkstra-step-grid">
                            ${nodes.map((n) => {
                                const u = updates[n] || {};
                                const distVal = u.dist ?? dist[n] ?? '';
                                const predVal = u.pred ?? pred[n] ?? '';
                                return `
                                    <div class="dijkstra-row">
                                        <div class="dijkstra-node">${ExerciseQuestionTypes.escape(n)}</div>
                                        <input class="input dijkstra-dist" data-node="${ExerciseQuestionTypes.escape(n)}" placeholder="dist" value="${ExerciseQuestionTypes.escape(distVal)}">
                                        <input class="input dijkstra-pred" data-node="${ExerciseQuestionTypes.escape(n)}" placeholder="pred" value="${ExerciseQuestionTypes.escape(predVal)}">
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="hint">Saisissez les distances/prédécesseurs après cette itération.</div>
                    `;
                },
                read(container, question) {
                    const nextNode = container.querySelector('.dijkstra-next')?.value || '';
                    if (!nextNode) return { ok: false, error: 'Choisissez le prochain sommet.' };
                    const updates = {};
                    for (const node of (question.graph?.nodes || [])) {
                        const dist = Array.from(container.querySelectorAll('.dijkstra-dist'))
                            .find((el) => el.dataset.node === String(node))?.value || '';
                        const pred = Array.from(container.querySelectorAll('.dijkstra-pred'))
                            .find((el) => el.dataset.node === String(node))?.value || '';
                        updates[node] = { dist: String(dist).trim(), pred: String(pred).trim() };
                    }
                    return { ok: true, value: { nextNode, updates } };
                },
                evaluate(question, answer) {
                    const expected = question.expectedStep || {};
                    const expectedNext = String(expected.nextNode || '');
                    const expectedUpdates = expected.updates || {};
                    const answerUpdates = answer.updates || {};

                    const nextOk = String(answer.nextNode || '') === expectedNext;
                    const updateOk = Object.keys(expectedUpdates).every((node) => {
                        const exp = expectedUpdates[node] || {};
                        const got = answerUpdates[node] || {};
                        const distOk = ExerciseQuestionTypes.normalize(got.dist) === ExerciseQuestionTypes.normalize(exp.dist);
                        const predOk = ExerciseQuestionTypes.normalize(got.pred) === ExerciseQuestionTypes.normalize(exp.pred);
                        return distOk && predOk;
                    });
                    const ok = nextOk && updateOk;
                    return {
                        ok,
                        expectedText: `next=${expectedNext}, updates=${JSON.stringify(expectedUpdates)}`
                    };
                }
            },
            'sql-lab': {
                render(question, stored) {
                    const value = stored || {};
                    const query = value.query || question.starterQuery || '';
                    const checks = question.checks || {};
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario ? `<div class="mini-scenario">${ExerciseQuestionTypes.safeHtml(question.scenario)}</div>` : ''}
                        <div class="sql-lab-box">
                            <textarea class="sql-lab-editor" placeholder="Écrivez votre requête SQL...">${ExerciseQuestionTypes.escape(query)}</textarea>
                            <div class="sql-lab-hints">
                                ${(checks.mustContain || []).length ? `<div><strong>Doit contenir:</strong> ${(checks.mustContain || []).map((k) => `<code>${ExerciseQuestionTypes.escape(k)}</code>`).join(' ')}</div>` : ''}
                                ${(checks.forbid || []).length ? `<div><strong>À éviter:</strong> ${(checks.forbid || []).map((k) => `<code>${ExerciseQuestionTypes.escape(k)}</code>`).join(' ')}</div>` : ''}
                            </div>
                        </div>
                    `;
                },
                read(container) {
                    const query = container.querySelector('.sql-lab-editor')?.value || '';
                    if (!String(query).trim()) return { ok: false, error: 'Saisissez une requête SQL.' };
                    return { ok: true, value: { query } };
                },
                evaluate(question, answer) {
                    const query = String(answer.query || '');
                    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
                    const checks = question.checks || {};
                    const must = (checks.mustContain || []).map((k) => String(k).toLowerCase());
                    const forbid = (checks.forbid || []).map((k) => String(k).toLowerCase());

                    const missing = must.filter((k) => !normalized.includes(k));
                    const forbidden = forbid.filter((k) => normalized.includes(k));
                    const ok = missing.length === 0 && forbidden.length === 0;

                    const details = [];
                    if (missing.length) details.push(`manque: ${missing.join(', ')}`);
                    if (forbidden.length) details.push(`interdit: ${forbidden.join(', ')}`);
                    const expectedText = details.length
                        ? details.join(' | ')
                        : 'Requête conforme aux contraintes.';

                    return { ok, expectedText };
                }
            },
            'mini-case': {
                render(question, stored) {
                    const answers = stored || {};
                    return `
                        <div class="question-title">${ExerciseQuestionTypes.safeHtml(question.prompt)}</div>
                        ${question.scenario ? `<div class="mini-scenario">${ExerciseQuestionTypes.safeHtml(question.scenario)}</div>` : ''}
                        <div class="mini-case-tasks">
                            ${(question.tasks || []).map((task, idx) => {
                                const key = String(task.id || `task_${idx}`);
                                const label = task.label || key;
                                if (task.type === 'select') {
                                    return `
                                        <label class="mini-task">
                                            <span>${ExerciseQuestionTypes.escape(label)}</span>
                                            <select class="input mini-input" data-task-id="${ExerciseQuestionTypes.escape(key)}">
                                                <option value="">-- Choisir --</option>
                                                ${(task.options || []).map((opt) => {
                                                    const value = String(opt);
                                                    return `<option value="${ExerciseQuestionTypes.escape(value)}" ${String(answers[key] || '') === value ? 'selected' : ''}>${ExerciseQuestionTypes.escape(value)}</option>`;
                                                }).join('')}
                                            </select>
                                        </label>
                                    `;
                                }
                                return `
                                    <label class="mini-task">
                                        <span>${ExerciseQuestionTypes.escape(label)}</span>
                                        <input class="input mini-input" data-task-id="${ExerciseQuestionTypes.escape(key)}" placeholder="${ExerciseQuestionTypes.escape(task.placeholder || '')}" value="${ExerciseQuestionTypes.escape(answers[key] || '')}">
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    `;
                },
                read(container, question) {
                    const value = {};
                    for (const [idx, task] of (question.tasks || []).entries()) {
                        const key = String(task.id || `task_${idx}`);
                        const input = Array.from(container.querySelectorAll('.mini-input'))
                            .find((el) => el.dataset.taskId === key);
                        const val = input?.value || '';
                        if (!String(val).trim()) return { ok: false, error: `Complétez: ${task.label || key}` };
                        value[key] = val;
                    }
                    return { ok: true, value };
                },
                evaluate(question, answer) {
                    const details = [];
                    let ok = true;
                    for (const [idx, task] of (question.tasks || []).entries()) {
                        const key = String(task.id || `task_${idx}`);
                        const taskAnswer = answer?.[key];
                        const accepted = Array.isArray(task.accepted) ? task.accepted : [];
                        const taskOk = ExerciseQuestionTypes.acceptedMatch(taskAnswer, task.answer, accepted);
                        details.push(`${task.label || key}: ${task.answer}`);
                        if (!taskOk) ok = false;
                    }
                    return { ok, expectedText: details.join(' | ') };
                }
            }
        };
    }

    static get registry() {
        if (!ExerciseQuestionTypes._registry) {
            ExerciseQuestionTypes._registry = ExerciseQuestionTypes.createRegistry();
        }
        return ExerciseQuestionTypes._registry;
    }

    static get(type) {
        return ExerciseQuestionTypes.registry[type] || null;
    }
}

if (typeof window !== 'undefined') {
    window.ExerciseQuestionTypes = ExerciseQuestionTypes;
}
