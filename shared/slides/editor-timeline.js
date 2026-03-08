/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-timeline
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-timeline.js"></script>
 */
/* ── editor-timeline.js — Timeline d'animations ──────────── */
/* globals: canvasEditor, editor, onUpdate, notify              */

/**
 * Initialise le bouton timeline (toggle dropdown).
 */
function initTimeline() {
    const btn = document.getElementById('btn-toggle-timeline');
    const items = document.getElementById('timeline-items');
    if (!btn || !items) return;
    items.style.display = 'none';
    items.dataset.open = '0';
    btn.style.display = 'none';
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = items.dataset.open === '1';
        items.dataset.open = isOpen ? '0' : '1';
        items.style.display = isOpen ? 'none' : '';
        btn.classList.toggle('active', !isOpen);
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', e => {
        if (!e.target.closest('#timeline-items') && !e.target.closest('#btn-toggle-timeline')) {
            items.style.display = 'none';
            items.dataset.open = '0';
            btn.classList.remove('active');
        }
    });
}

/**
 * Met à jour le contenu du panneau timeline.
 * Masque automatiquement le bouton si aucune animation.
 */
function updateTimeline() {
    const container = document.getElementById('timeline-items');
    const countBadge = document.getElementById('timeline-count');
    const toggleBtn = document.getElementById('btn-toggle-timeline');
    if (!container) return;
    const shouldStayOpen = container.dataset.open === '1';

    // No canvas / no elements
    if (!canvasEditor || !canvasEditor.elements || !canvasEditor.elements.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        container.dataset.open = '0';
        if (countBadge) countBadge.textContent = '';
        if (toggleBtn) { toggleBtn.style.display = 'none'; toggleBtn.classList.remove('active'); }
        return;
    }

    // Filter animated elements
    const animated = canvasEditor.elements
        .map((el, idx) => ({ el, idx }))
        .filter(({ el }) => el.animation && el.animation.type && el.animation.type !== 'none');

    if (countBadge) countBadge.textContent = animated.length ? animated.length : '';

    if (!animated.length) {
        container.innerHTML = '';
        container.style.display = 'none';
        container.dataset.open = '0';
        if (toggleBtn) { toggleBtn.style.display = 'none'; toggleBtn.classList.remove('active'); }
        return;
    }

    // Show the toggle button when there are animations
    if (toggleBtn) toggleBtn.style.display = 'inline-flex';

    // Sort by animation.order (fallback: original array index)
    animated.sort((a, b) => {
        const oa = a.el.animation.order ?? a.idx;
        const ob = b.el.animation.order ?? b.idx;
        return oa - ob;
    });

    const selectedId = canvasEditor.selectedId;

    container.innerHTML = animated.map(({ el }, i) => {
        const icon = _tlTypeIcon(el.type);
        const label = _tlLabel(el);
        const animType = el.animation.type;
        const sel = el.id === selectedId ? ' tl-selected' : '';
        const disableUp = i === 0 ? ' disabled' : '';
        const disableDown = i >= (animated.length - 1) ? ' disabled' : '';
        return `<div class="tl-item${sel}" draggable="true" data-el-id="${el.id}" data-tl-idx="${i}">` +
            `<span class="tl-grip" title="Glisser pour réordonner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/></svg></span>` +
            `<span class="tl-step">${i + 1}</span>` +
            `<span class="tl-icon">${icon}</span>` +
            `<span class="tl-label" title="${_escAttr(label)}">${_escHtml(label)}</span>` +
            `<span class="tl-anim">${_tlAnimLabel(animType)}</span>` +
            `<span class="tl-actions">` +
            `<button class="tl-action tl-move-up" title="Monter" data-el-id="${el.id}"${disableUp}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>` +
            `<button class="tl-action tl-move-down" title="Descendre" data-el-id="${el.id}"${disableDown}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>` +
            `<button class="tl-action tl-remove" title="Supprimer l'animation" data-el-id="${el.id}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
            `</span>` +
            `</div>`;
    }).join('');

    if (shouldStayOpen) {
        container.style.display = '';
        if (toggleBtn) toggleBtn.classList.add('active');
    } else {
        container.style.display = 'none';
        if (toggleBtn) toggleBtn.classList.remove('active');
    }

    // Bind events
    _tlBindEvents(container, animated);
}

/* ── Private helpers ─────────────────────────────────────── */

function _tlTypeIcon(type) {
    const map = {
        text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16"/><path d="M8 12h8"/><path d="M6 18h12"/></svg>',
        heading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M4 4v16"/><path d="M20 4v16"/></svg>',
        image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><polyline points="21 16 15 10 6 19"/></svg>',
        highlight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/></svg>',
        code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/></svg>',
        shape: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 3 21 12 12 21 3 12"/></svg>',
        list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
        table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
        card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h5"/></svg>',
        video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
        iframe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 10l-3 2 3 2"/><path d="M16 10l3 2-3 2"/></svg>',
        mermaid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10"/><path d="M6.7 7.2 10.9 16"/><path d="M17.3 7.2 13.1 16"/></svg>',
    };
    return map[type] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>';
}

function _tlAnimLabel(type) {
    const map = {
        fade: 'Fondu',
        appear: 'Apparition',
        slide: 'Glissé',
        zoom: 'Zoom',
        highlight: 'Mise en avant',
    };
    return _escHtml(map[type] || type || 'animation');
}

function _tlLabel(el) {
    let raw = el.data?.text || el.data?.html || '';
    // Strip HTML tags
    raw = raw.replace(/<[^>]*>/g, '').trim();
    if (!raw) raw = el.type || 'élément';
    return raw.length > 20 ? raw.slice(0, 20) + '…' : raw;
}

function _escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _escAttr(s) {
    return _escHtml(s).replace(/"/g, '&quot;');
}

function _tlApplyOrder(ordered) {
    ordered.forEach(({ el }, newOrder) => {
        canvasEditor.updateData(el.id, {
            animation: { type: el.animation.type, order: newOrder }
        });
    });
    onUpdate('slide-update');
}

function _tlBindEvents(container, animated) {
    // Click to select
    container.querySelectorAll('.tl-item').forEach(item => {
        item.addEventListener('click', e => {
            if (e.target.closest('.tl-action')) return;
            const elId = item.dataset.elId;
            canvasEditor.select(elId);
            onUpdate('select');
        });
    });

    // Remove animation
    container.querySelectorAll('.tl-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const elId = btn.dataset.elId;
            canvasEditor.updateData(elId, { animation: { type: 'none', order: 0 } });
            onUpdate('slide-update');
        });
    });

    container.querySelectorAll('.tl-move-up').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (btn.disabled) return;
            const elId = btn.dataset.elId;
            const idx = animated.findIndex(item => item.el.id === elId);
            if (idx <= 0) return;
            const ordered = [...animated];
            [ordered[idx - 1], ordered[idx]] = [ordered[idx], ordered[idx - 1]];
            _tlApplyOrder(ordered);
        });
    });
    container.querySelectorAll('.tl-move-down').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (btn.disabled) return;
            const elId = btn.dataset.elId;
            const idx = animated.findIndex(item => item.el.id === elId);
            if (idx < 0 || idx >= animated.length - 1) return;
            const ordered = [...animated];
            [ordered[idx + 1], ordered[idx]] = [ordered[idx], ordered[idx + 1]];
            _tlApplyOrder(ordered);
        });
    });

    // Drag & drop reorder
    let dragIdx = null;

    container.querySelectorAll('.tl-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            dragIdx = parseInt(item.dataset.tlIdx);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragIdx);
            item.classList.add('tl-dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('tl-dragging');
            container.querySelectorAll('.tl-item').forEach(it => it.classList.remove('tl-drag-over', 'tl-drag-before', 'tl-drag-after'));
            dragIdx = null;
        });

        item.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            container.querySelectorAll('.tl-item').forEach(it => it.classList.remove('tl-drag-before', 'tl-drag-after'));
            if (e.clientY < midY) {
                item.classList.add('tl-drag-before');
            } else {
                item.classList.add('tl-drag-after');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('tl-drag-before', 'tl-drag-after');
        });

        item.addEventListener('drop', e => {
            e.preventDefault();
            const dropIdx = parseInt(item.dataset.tlIdx);
            if (dragIdx === null || dragIdx === dropIdx) return;

            // Determine insertion: before or after
            const rect = item.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let targetIdx = e.clientY < midY ? dropIdx : dropIdx + 1;
            if (dragIdx < targetIdx) targetIdx--;

            // Build new order
            const ordered = [...animated];
            const [moved] = ordered.splice(dragIdx, 1);
            ordered.splice(targetIdx, 0, moved);

            _tlApplyOrder(ordered);
        });
    });
}

window.initTimeline = initTimeline;
window.updateTimeline = updateTimeline;
