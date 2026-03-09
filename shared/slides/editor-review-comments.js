/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-review-comments
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-review-comments.js"></script>
 */
/* editor-review-comments.js — Inline review comments for slides/canvas elements */

const REVIEW_COMMENTS_KEY = 'reviewComments';

function _reviewNowIso() {
    return new Date().toISOString();
}

function _reviewEsc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _reviewPresentationReady() {
    return !!(typeof editor !== 'undefined' && editor && editor.data && Array.isArray(editor.data.slides));
}

function _reviewEnsureStore() {
    if (!_reviewPresentationReady()) return [];
    if (!Array.isArray(editor.data[REVIEW_COMMENTS_KEY])) editor.data[REVIEW_COMMENTS_KEY] = [];
    return editor.data[REVIEW_COMMENTS_KEY];
}

function _reviewCreateId() {
    return `cmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function _reviewCurrentSlideIndex() {
    if (!_reviewPresentationReady()) return 0;
    const idx = Number(editor.selectedIndex);
    if (!Number.isFinite(idx)) return 0;
    const max = Math.max(0, editor.data.slides.length - 1);
    return Math.max(0, Math.min(max, Math.trunc(idx)));
}

function _reviewSelectedElementId() {
    if (typeof canvasEditor === 'undefined' || !canvasEditor) return null;
    if (canvasEditor.selectedId) return String(canvasEditor.selectedId);
    if (canvasEditor.selectedIds instanceof Set && canvasEditor.selectedIds.size > 0) {
        return String([...canvasEditor.selectedIds][0]);
    }
    return null;
}

function _reviewNormalizeComment(raw = {}) {
    const now = _reviewNowIso();
    const slideCount = _reviewPresentationReady() ? editor.data.slides.length : 0;
    const slideIndexRaw = Number(raw.slideIndex);
    const slideIndex = Number.isFinite(slideIndexRaw)
        ? Math.max(0, Math.min(Math.max(0, slideCount - 1), Math.trunc(slideIndexRaw)))
        : 0;
    const text = String(raw.text ?? '').trim();
    const status = raw.status === 'resolved' ? 'resolved' : 'open';
    const elementId = raw.elementId == null || raw.elementId === '' ? null : String(raw.elementId);

    return {
        id: String(raw.id || _reviewCreateId()),
        slideIndex,
        elementId,
        text,
        status,
        createdAt: String(raw.createdAt || now),
        updatedAt: String(raw.updatedAt || raw.createdAt || now),
        resolvedAt: status === 'resolved' ? String(raw.resolvedAt || raw.updatedAt || now) : null,
    };
}

function _reviewReadAll() {
    const list = _reviewEnsureStore();
    const normalized = list
        .map((item) => _reviewNormalizeComment(item))
        .filter((item) => item.text.length > 0);
    editor.data[REVIEW_COMMENTS_KEY] = normalized;
    return normalized;
}

function _reviewWriteAll(list, reason = 'review-comments') {
    if (!_reviewPresentationReady()) return;
    editor.data[REVIEW_COMMENTS_KEY] = (Array.isArray(list) ? list : [])
        .map((item) => _reviewNormalizeComment(item))
        .filter((item) => item.text.length > 0);
    if (typeof editor._push === 'function') editor._push();
    if (typeof editor.onUpdate === 'function') editor.onUpdate(reason);
}

function _reviewSortByDateDesc(list) {
    return [...list].sort((a, b) => {
        const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return db - da;
    });
}

function _reviewFormatDateTime(isoString) {
    if (!isoString) return 'Date inconnue';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Date inconnue';
    const date = d.toLocaleDateString('fr-FR');
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}

function _reviewOpenCountForCurrentSlide() {
    if (!_reviewPresentationReady()) return 0;
    const slideIndex = _reviewCurrentSlideIndex();
    return _reviewReadAll().filter((item) => item.slideIndex === slideIndex && item.status !== 'resolved').length;
}

function updateReviewCommentsBadge() {
    const btn = document.getElementById('btn-review-comments');
    if (!btn) return;

    btn.querySelectorAll('.tb-badge').forEach((el) => el.remove());
    const openCount = _reviewOpenCountForCurrentSlide();
    if (openCount <= 0) return;

    const badge = document.createElement('span');
    badge.className = `tb-badge ${openCount >= 5 ? 'danger' : 'warning'}`;
    badge.textContent = openCount > 99 ? '99+' : String(openCount);
    btn.appendChild(badge);
}

function _reviewSelectCommentTarget(comment) {
    if (!_reviewPresentationReady() || !comment) return;
    const targetSlide = Math.max(0, Math.min(editor.data.slides.length - 1, Number(comment.slideIndex) || 0));
    if (typeof editor.selectSlide === 'function') {
        editor.selectSlide(targetSlide);
    } else {
        editor.selectedIndex = targetSlide;
        if (typeof editor.onUpdate === 'function') editor.onUpdate('slides');
    }

    if (!comment.elementId || typeof canvasEditor === 'undefined' || !canvasEditor) return;
    setTimeout(() => {
        const exists = Array.isArray(canvasEditor.elements) && canvasEditor.elements.some((el) => el.id === comment.elementId);
        if (!exists) return;
        canvasEditor.select(comment.elementId);
    }, 40);
}

function _reviewBuildItemHtml(comment) {
    const statusLabel = comment.status === 'resolved' ? 'Resolue' : 'Ouverte';
    const statusClass = comment.status === 'resolved' ? 'is-resolved' : 'is-open';
    const actionToggleLabel = comment.status === 'resolved' ? 'Rouvrir' : 'Resoudre';
    const updatedAt = _reviewFormatDateTime(comment.updatedAt || comment.createdAt);
    const elementLabel = comment.elementId ? `<span class="review-comment-target">#${_reviewEsc(comment.elementId)}</span>` : '<span class="review-comment-target">slide</span>';

    return `<div class="review-comment-item ${statusClass}" data-comment-id="${_reviewEsc(comment.id)}">
        <div class="review-comment-head">
            <div class="review-comment-meta">
                <span class="review-comment-status ${statusClass}">${statusLabel}</span>
                <span class="review-comment-slide">Slide ${Number(comment.slideIndex) + 1}</span>
                ${elementLabel}
            </div>
            <span class="review-comment-date">${_reviewEsc(updatedAt)}</span>
        </div>
        <div class="review-comment-text">${_reviewEsc(comment.text)}</div>
        <div class="review-comment-actions">
            <button class="tb-btn review-comment-goto" data-action="goto">Aller</button>
            <button class="tb-btn review-comment-toggle" data-action="toggle">${actionToggleLabel}</button>
            <button class="tb-btn danger review-comment-delete" data-action="delete">Supprimer</button>
        </div>
    </div>`;
}

function openReviewCommentsModal() {
    if (!_reviewPresentationReady()) return;

    const existing = document.getElementById('review-comments-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'review-comments-modal';
    modal.className = 'modal-overlay review-comments-overlay';
    modal.innerHTML = `
            <div class="modal review-comments-modal">
                <div class="modal-header">
                    <h3 class="modal-title" style="margin:0;flex:1">Commentaires de relecture</h3>
                    <button class="modal-close" id="review-comments-close" aria-label="Fermer">✕</button>
                </div>
                <div class="review-comments-toolbar">
                    <label class="review-check"><input type="checkbox" id="review-only-current" checked> Slide courant</label>
                    <label class="review-check"><input type="checkbox" id="review-show-resolved"> Afficher resolues</label>
                </div>
                <div class="review-comment-create">
                    <textarea id="review-comment-text" rows="3" placeholder="Ajouter un commentaire de relecture (clarte, precision, coherence, etc.)"></textarea>
                    <div class="review-comment-create-actions">
                        <label class="review-check"><input type="checkbox" id="review-link-element"> Lier a l'element selectionne</label>
                        <button class="tb-btn primary" id="review-comment-add">Ajouter</button>
                    </div>
                </div>
                <div class="review-comments-list" id="review-comments-list"></div>
            </div>
        `;
    document.body.appendChild(modal);

    const listEl = modal.querySelector('#review-comments-list');
    const onlyCurrentEl = modal.querySelector('#review-only-current');
    const showResolvedEl = modal.querySelector('#review-show-resolved');
    const textEl = modal.querySelector('#review-comment-text');
    const linkElementEl = modal.querySelector('#review-link-element');

    const syncLinkElementAvailability = () => {
        const selectedElementId = _reviewSelectedElementId();
        linkElementEl.disabled = !selectedElementId;
        if (!selectedElementId) linkElementEl.checked = false;
        linkElementEl.title = selectedElementId
            ? `Lier au bloc ${selectedElementId}`
            : 'Aucun element selectionne sur le canvas';
    };

    const renderList = () => {
        const allComments = _reviewReadAll();
        const showResolved = !!showResolvedEl.checked;
        const onlyCurrent = !!onlyCurrentEl.checked;
        const currentSlideIndex = _reviewCurrentSlideIndex();

        const filtered = _reviewSortByDateDesc(allComments).filter((item) => {
            if (!showResolved && item.status === 'resolved') return false;
            if (onlyCurrent && item.slideIndex !== currentSlideIndex) return false;
            return true;
        });

        if (!filtered.length) {
            listEl.innerHTML = '<div class="review-comments-empty">Aucun commentaire pour ce filtre.</div>';
            return;
        }
        listEl.innerHTML = filtered.map(_reviewBuildItemHtml).join('');

        listEl.querySelectorAll('.review-comment-item').forEach((row) => {
            const commentId = row.getAttribute('data-comment-id');
            const comment = allComments.find((item) => item.id === commentId);
            if (!comment) return;

            row.querySelector('[data-action="goto"]')?.addEventListener('click', () => {
                _reviewSelectCommentTarget(comment);
                syncLinkElementAvailability();
                renderList();
                updateReviewCommentsBadge();
            });

            row.querySelector('[data-action="toggle"]')?.addEventListener('click', () => {
                const now = _reviewNowIso();
                const next = allComments.map((item) => {
                    if (item.id !== comment.id) return item;
                    const resolved = item.status === 'resolved';
                    return {
                        ...item,
                        status: resolved ? 'open' : 'resolved',
                        updatedAt: now,
                        resolvedAt: resolved ? null : now,
                    };
                });
                _reviewWriteAll(next, 'review-comments');
                syncLinkElementAvailability();
                renderList();
                updateReviewCommentsBadge();
            });

            row.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
                const ok = await OEIDialog.confirm('Supprimer ce commentaire ?', { danger: true });
                if (!ok) return;
                const next = allComments.filter((item) => item.id !== comment.id);
                _reviewWriteAll(next, 'review-comments');
                syncLinkElementAvailability();
                renderList();
                updateReviewCommentsBadge();
            });
        });
    };

    const addComment = () => {
        const text = String(textEl.value || '').trim();
        if (!text) {
            notify('Le commentaire est vide', 'info');
            textEl.focus();
            return;
        }
        const allComments = _reviewReadAll();
        const now = _reviewNowIso();
        const selectedElementId = linkElementEl.checked ? _reviewSelectedElementId() : null;
        const comment = _reviewNormalizeComment({
            id: _reviewCreateId(),
            slideIndex: _reviewCurrentSlideIndex(),
            elementId: selectedElementId,
            text,
            status: 'open',
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
        });

        allComments.push(comment);
        _reviewWriteAll(allComments, 'review-comments');
        textEl.value = '';
        if (linkElementEl.disabled) linkElementEl.checked = false;
        renderList();
        updateReviewCommentsBadge();
        notify('Commentaire ajoute', 'success');
    };

    modal.querySelector('#review-comments-close')?.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.remove();
    });

    modal.querySelector('#review-comment-add')?.addEventListener('click', addComment);
    textEl.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
            event.preventDefault();
            addComment();
        }
    });

    onlyCurrentEl.addEventListener('change', renderList);
    showResolvedEl.addEventListener('change', renderList);

    modal.style.display = 'flex';
    syncLinkElementAvailability();
    renderList();
    updateReviewCommentsBadge();
    setTimeout(() => textEl.focus(), 40);
}

window.openReviewCommentsModal = openReviewCommentsModal;
window.updateReviewCommentsBadge = updateReviewCommentsBadge;
