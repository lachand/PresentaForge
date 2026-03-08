/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-context-menu
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-context-menu.js"></script>
 */
/* editor-context-menu.js — Context menu and align buttons for slide editor */

function closeContextMenu() {
    const menu = document.getElementById('ctx-menu');
    if (menu) menu.classList.remove('visible');
}

function openContextMenu(id, e) {
    const menu = document.getElementById('ctx-menu');
    if (!menu) return;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('visible');
    // Show align group only when multi-selected
    const hasMulti = canvasEditor && canvasEditor.selectedIds.size >= 2;
    menu.querySelectorAll('.ctx-menu-sub').forEach(sub => sub.style.display = hasMulti ? '' : 'none');
}

function bindContextMenu() {
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('contextmenu', e => {
        // Close context menu if clicking outside canvas elements
        if (!e.target.closest('.cel')) closeContextMenu();
    });
    const menu = document.getElementById('ctx-menu');
    if (!menu) return;
    menu.querySelectorAll('[data-ctx]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.ctx;
            closeContextMenu();
            switch (action) {
                case 'cut': clipboardCut(); break;
                case 'copy': clipboardCopy(); break;
                case 'paste': clipboardPaste(); break;
                case 'duplicate': document.getElementById('fmt-duplicate')?.click(); break;
                case 'copy-to-slide': openCopyToSlideDialog(); break;
                case 'delete': canvasEditor?.removeSelected(); break;
                case 'select-all': selectAll(); break;
                case 'bring-front': document.getElementById('fmt-z-up')?.click(); break;
                case 'send-back': document.getElementById('fmt-z-down')?.click(); break;
                case 'align-left': canvasEditor?.alignElements('left'); break;
                case 'align-right': canvasEditor?.alignElements('right'); break;
                case 'align-top': canvasEditor?.alignElements('top'); break;
                case 'align-bottom': canvasEditor?.alignElements('bottom'); break;
                case 'align-center-h': canvasEditor?.alignElements('center-h'); break;
                case 'align-center-v': canvasEditor?.alignElements('center-v'); break;
                case 'distribute-h': canvasEditor?.distributeElements('h'); break;
                case 'distribute-v': canvasEditor?.distributeElements('v'); break;
                case 'auto-layout':
                    {
                        const result = canvasEditor?.autoLayoutSelected?.();
                        if (result?.moved) notify?.(`Auto-layout appliqué (${result.count} élément${result.count > 1 ? 's' : ''})`, 'success');
                        else notify?.('Sélectionnez au moins 2 éléments déverrouillés', 'info');
                    }
                    break;
            }
        });
    });
}

/* ── Align/Distribute buttons ──────────────────────────── */

function bindAlignButtons() {
    document.getElementById('fmt-el-align-left')?.addEventListener('click', () => canvasEditor?.alignElements('left'));
    document.getElementById('fmt-el-align-right')?.addEventListener('click', () => canvasEditor?.alignElements('right'));
    document.getElementById('fmt-el-align-top')?.addEventListener('click', () => canvasEditor?.alignElements('top'));
    document.getElementById('fmt-el-align-bottom')?.addEventListener('click', () => canvasEditor?.alignElements('bottom'));
    document.getElementById('fmt-el-align-ch')?.addEventListener('click', () => canvasEditor?.alignElements('center-h'));
    document.getElementById('fmt-el-align-cv')?.addEventListener('click', () => canvasEditor?.alignElements('center-v'));
    document.getElementById('fmt-el-dist-h')?.addEventListener('click', () => canvasEditor?.distributeElements('h'));
    document.getElementById('fmt-el-dist-v')?.addEventListener('click', () => canvasEditor?.distributeElements('v'));
    document.getElementById('fmt-el-auto-layout')?.addEventListener('click', () => {
        const result = canvasEditor?.autoLayoutSelected?.();
        if (result?.moved) notify?.(`Auto-layout appliqué (${result.count} élément${result.count > 1 ? 's' : ''})`, 'success');
        else notify?.('Sélectionnez au moins 2 éléments déverrouillés', 'info');
    });
}
