/**
 * @module slides/editor-json-list-editor
 * @public
 * @internal Module Slides chargé côté navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portée documentaire du module.
 */
/* editor-json-list-editor.js — éditeur de listes structurées à la place d'un JSON brut
 * (audit UX 2026-10, E-P1). Une zone <textarea data-json-list> contenant un tableau d'objets
 * (critères, étapes, colonnes, cartes…) est enrichie d'une liste de cartes : un champ par clé,
 * boutons monter / descendre / supprimer, « Ajouter ». Le <textarea> reste la source de vérité
 * (les écouteurs existants du panneau continuent de fonctionner) : il est simplement replié dans
 * un « Mode avancé : JSON ». Aucune dépendance au reste de l'éditeur.
 */

/** Libellés français des clés courantes ; les autres sont humanisées. */
const JSON_LIST_LABELS = Object.freeze({
    criterion: 'Critère', descriptors: 'Descripteurs (un par ligne, dans l\'ordre des niveaux)',
    title: 'Titre', detail: 'Détail', code: 'Code', text: 'Texte', name: 'Nom',
    cards: 'Cartes (une par ligne)', front: 'Recto', back: 'Verso', label: 'Libellé',
    x: 'Position horizontale (%)', y: 'Position verticale (%)',
});

/** Clés dont la saisie est longue : champ multiligne. */
const JSON_LIST_MULTILINE = new Set(['detail', 'code', 'text', 'back', 'front', 'body', 'description']);

const _isScalar = v => v === null || ['string', 'number', 'boolean'].includes(typeof v);
const _isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function _humanizeKey(key) {
    if (JSON_LIST_LABELS[key]) return JSON_LIST_LABELS[key];
    const s = String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Un tableau est éditable en liste si chaque élément est un objet dont les valeurs sont des
 * scalaires ou des tableaux de scalaires. Tout le reste reste en JSON brut (rien n'est perdu).
 * @param {unknown} value
 * @returns {{ ok: boolean, keys: string[] }}
 */
function analyzeJsonList(value) {
    if (!Array.isArray(value)) return { ok: false, keys: [] };
    const keys = [];
    for (const item of value) {
        if (!_isPlainObject(item)) return { ok: false, keys: [] };
        for (const [k, v] of Object.entries(item)) {
            const fine = _isScalar(v) || (Array.isArray(v) && v.every(_isScalar));
            if (!fine) return { ok: false, keys: [] };
            if (!keys.includes(k)) keys.push(k);
        }
    }
    return { ok: true, keys };
}

/** Convertit la saisie d'un champ vers le type d'origine de la valeur. */
function coerceJsonListValue(raw, like) {
    if (Array.isArray(like)) return String(raw).split('\n').map(s => s.trim()).filter(Boolean);
    if (typeof like === 'number') {
        const n = Number(raw);
        return raw !== '' && Number.isFinite(n) ? n : like;
    }
    if (typeof like === 'boolean') return raw === true || raw === 'true';
    return String(raw);
}

/** Élément vide : mêmes clés et mêmes types que le modèle fourni, valeurs vides. */
function blankJsonListItem(template, keys) {
    const out = {};
    for (const k of keys) {
        const v = template ? template[k] : '';
        out[k] = Array.isArray(v) ? [] : (typeof v === 'number' ? 0 : (typeof v === 'boolean' ? false : ''));
    }
    return out;
}

let _jleSeq = 0;

/**
 * Enrichit tous les `<textarea data-json-list>` de `root`.
 * Attributs : `data-json-list-blank` (JSON d'un élément vide, pour une liste initialement vide),
 * `data-json-list-item` (nom d'un élément, « étape », « critère »… pour les libellés),
 * `data-json-list-add` (texte du bouton d'ajout, avec le bon genre : « + Ajouter une étape »).
 * @param {ParentNode} [root]
 */
function enhanceJsonListEditors(root = document) {
    root.querySelectorAll('textarea[data-json-list]').forEach(enhanceJsonListTextarea);
}

function enhanceJsonListTextarea(textarea) {
    if (!textarea || textarea.dataset.jsonListReady === '1') return;
    let items;
    try { items = JSON.parse(textarea.value || '[]'); } catch (_) { return; }
    const shape = analyzeJsonList(items);
    if (!shape.ok) return;   // structure imbriquée : on garde le JSON brut
    let blank = null;
    try { blank = textarea.dataset.jsonListBlank ? JSON.parse(textarea.dataset.jsonListBlank) : null; } catch (_) { blank = null; }
    const keysFromBlank = blank && _isPlainObject(blank) ? Object.keys(blank) : [];
    const keys = shape.keys.length ? shape.keys : keysFromBlank;
    if (!keys.length) return;
    textarea.dataset.jsonListReady = '1';
    const itemName = textarea.dataset.jsonListItem || 'élément';
    const uid = ++_jleSeq;

    const wrap = document.createElement('div');
    wrap.className = 'jle';
    const list = document.createElement('div');
    list.className = 'jle-list';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'jle-add';
    addBtn.textContent = textarea.dataset.jsonListAdd || `+ Ajouter (${itemName})`;
    const details = document.createElement('details');
    details.className = 'jle-advanced';
    const summary = document.createElement('summary');
    summary.textContent = 'Mode avancé : JSON';
    details.appendChild(summary);
    textarea.parentNode.insertBefore(wrap, textarea);
    wrap.append(list, addBtn, details);
    details.appendChild(textarea);   // le textarea reste dans le DOM, même id, mêmes écouteurs

    const live = document.createElement('div');
    live.className = 'jle-sr';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    wrap.appendChild(live);

    let syncing = false;
    const commit = () => {
        syncing = true;
        textarea.value = JSON.stringify(items, null, 2);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        syncing = false;
    };

    const render = (focusSpec) => {
        list.textContent = '';
        if (!items.length) {
            const empty = document.createElement('p');
            empty.className = 'jle-empty';
            empty.textContent = `Aucun ${itemName} pour l'instant.`;
            list.appendChild(empty);
        }
        items.forEach((item, index) => {
            const card = document.createElement('fieldset');
            card.className = 'jle-item';
            const legend = document.createElement('legend');
            const firstText = keys.map(k => item[k]).find(v => typeof v === 'string' && v.trim());
            legend.textContent = `${index + 1}. ${firstText ? String(firstText).slice(0, 40) : itemName}`;
            card.appendChild(legend);

            keys.forEach((key) => {
                const like = item[key] !== undefined ? item[key] : (blank ? blank[key] : '');
                const id = `jle-${uid}-${index}-${key}`;
                const row = document.createElement('div');
                row.className = 'jle-field';
                const label = document.createElement('label');
                label.htmlFor = id;
                label.textContent = _humanizeKey(key);
                let input;
                if (typeof like === 'boolean') {
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.checked = !!item[key];
                } else if (typeof like === 'number') {
                    input = document.createElement('input');
                    input.type = 'number';
                    input.step = 'any';
                    input.value = item[key] === undefined ? '' : String(item[key]);
                } else if (Array.isArray(like) || JSON_LIST_MULTILINE.has(key)) {
                    input = document.createElement('textarea');
                    input.rows = Array.isArray(like) ? 3 : 2;
                    input.value = Array.isArray(item[key]) ? item[key].join('\n') : String(item[key] ?? '');
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = String(item[key] ?? '');
                }
                input.id = id;
                input.className = 'jle-input';
                input.dataset.key = key;
                const evt = input.type === 'checkbox' ? 'change' : 'input';
                input.addEventListener(evt, () => {
                    item[key] = coerceJsonListValue(input.type === 'checkbox' ? input.checked : input.value, like);
                    commit();
                });
                row.append(label, input);
                card.appendChild(row);
            });

            const bar = document.createElement('div');
            bar.className = 'jle-actions';
            const mk = (text, aria, handler, disabled) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'jle-btn';
                b.textContent = text;
                b.setAttribute('aria-label', `${aria} (${itemName} ${index + 1})`);
                b.disabled = !!disabled;
                b.addEventListener('click', handler);
                return b;
            };
            bar.append(
                mk('↑', 'Monter', () => { [items[index - 1], items[index]] = [items[index], items[index - 1]]; commit(); render({ index: index - 1, action: 'up' }); live.textContent = `${itemName} ${index + 1} déplacé en position ${index}`; }, index === 0),
                mk('↓', 'Descendre', () => { [items[index + 1], items[index]] = [items[index], items[index + 1]]; commit(); render({ index: index + 1, action: 'down' }); live.textContent = `${itemName} ${index + 1} déplacé en position ${index + 2}`; }, index === items.length - 1),
                mk('Supprimer', 'Supprimer', () => { items.splice(index, 1); commit(); render({ action: 'removed' }); live.textContent = `${itemName} supprimé`; }, false),
            );
            bar.lastChild.classList.add('jle-btn--danger');
            card.appendChild(bar);
            list.appendChild(card);
        });
        if (focusSpec) {
            if (focusSpec.action === 'added') list.querySelector(`.jle-item:nth-of-type(${focusSpec.index + 1}) .jle-input`)?.focus();
            else if (focusSpec.action === 'removed') addBtn.focus();
            else if (focusSpec.index != null) {
                const sel = focusSpec.action === 'up' ? '.jle-btn:nth-of-type(1)' : '.jle-btn:nth-of-type(2)';
                list.querySelectorAll('.jle-item')[focusSpec.index]?.querySelector(sel)?.focus();
            }
        }
    };

    addBtn.addEventListener('click', () => {
        const template = items.length ? items[items.length - 1] : blank;
        items.push(blankJsonListItem(template, keys));
        commit();
        render({ index: items.length - 1, action: 'added' });
        live.textContent = `${itemName} ajouté`;
    });

    // Édition dans le mode avancé : on resynchronise la liste si le JSON reste exploitable.
    textarea.addEventListener('change', () => {
        if (syncing) return;
        try {
            const parsed = JSON.parse(textarea.value || '[]');
            if (analyzeJsonList(parsed).ok) { items = parsed; render(); }
        } catch (_) { /* JSON en cours de saisie : on ne touche à rien */ }
    });

    render();
}
