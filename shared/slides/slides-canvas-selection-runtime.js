// @ts-check
/* slides-canvas-selection-runtime.js — runtime sélection/verrouillage pour CanvasEditor */
(function initSlidesCanvasSelectionRuntime(global) {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : global;
    if (root.OEISlidesCanvasSelectionRuntime) return;

    const isElementLocked = el => !!el?.locked;

    const syncLockVisual = context => {
        const div = context?.div;
        const el = context?.el;
        if (!div || !el) return false;

        const checkLocked = typeof context.isElementLocked === 'function'
            ? context.isElementLocked
            : isElementLocked;
        const documentRef = context.documentRef || root.document;
        const locked = checkLocked(el);

        div.classList?.toggle?.('is-locked', locked);
        let badge = div.querySelector?.('.cel-lock-badge');
        if (locked) {
            if (!badge && documentRef?.createElement) {
                badge = documentRef.createElement('span');
                badge.className = 'cel-lock-badge';
                badge.textContent = 'L';
                badge.title = 'Element verrouille';
                div.appendChild?.(badge);
            }
        } else if (badge && typeof badge.remove === 'function') {
            badge.remove();
        }

        return locked;
    };

    const updateSelectionVisuals = context => {
        const container = context?.container;
        if (!container) return 0;

        const selectedIds = (context.selectedIds && typeof context.selectedIds.has === 'function')
            ? context.selectedIds
            : new Set(Array.isArray(context.selectedIds) ? context.selectedIds : []);
        const elements = Array.isArray(context.elements) ? context.elements : [];
        const documentRef = context.documentRef || root.document;
        if (!documentRef?.createElement) return 0;

        container.querySelectorAll?.('.cel')?.forEach?.(node => {
            node.classList?.toggle?.('selected', selectedIds.has(node.dataset?.id));
        });

        container.querySelectorAll?.('.group-bbox')?.forEach?.(node => node.remove?.());

        const groups = {};
        for (const el of elements) {
            if (!el?.groupId) continue;
            if (!groups[el.groupId]) groups[el.groupId] = [];
            groups[el.groupId].push(el);
        }

        let rendered = 0;
        for (const members of Object.values(groups)) {
            if (!Array.isArray(members) || members.length < 2) continue;

            const minX = Math.min(...members.map(el => el.x));
            const minY = Math.min(...members.map(el => el.y));
            const maxX = Math.max(...members.map(el => el.x + el.w));
            const maxY = Math.max(...members.map(el => el.y + el.h));
            const hasAnySelected = members.some(el => selectedIds.has(el.id));

            const bbox = documentRef.createElement('div');
            bbox.className = 'group-bbox';
            bbox.style.left = `${minX - 4}px`;
            bbox.style.top = `${minY - 4}px`;
            bbox.style.width = `${maxX - minX + 8}px`;
            bbox.style.height = `${maxY - minY + 8}px`;
            bbox.style.borderColor = hasAnySelected ? 'var(--primary, #818cf8)' : 'rgba(255,255,255,0.2)';

            const badge = documentRef.createElement('span');
            badge.className = 'group-bbox-badge';
            badge.textContent = 'Groupe';
            badge.style.color = hasAnySelected ? 'var(--primary, #818cf8)' : 'rgba(255,255,255,0.35)';

            bbox.appendChild?.(badge);
            container.appendChild?.(bbox);
            rendered += 1;
        }

        return rendered;
    };

    root.OEISlidesCanvasSelectionRuntime = Object.freeze({
        isElementLocked,
        syncLockVisual,
        updateSelectionVisuals,
        testUtils: Object.freeze({
            isElementLocked,
            syncLockVisual,
            updateSelectionVisuals,
        }),
    });
})(window);
