/**
 * StackVisualizer - reusable stack/frame rendering for concept pages.
 */
class StackVisualizer {
    renderItems(container, items, options = {}) {
        if (!container) return;

        const titleSelector = options.titleSelector || 'h3';
        const title = container.querySelector(titleSelector);
        const className = options.itemClass || 'stack-item';
        const reverse = !!options.reverse;

        container.innerHTML = '';
        if (title) container.appendChild(title);

        const entries = reverse ? items.slice().reverse() : items.slice();
        entries.forEach((item) => {
            const el = document.createElement('div');
            el.className = className;
            el.textContent = item;
            container.appendChild(el);
        });
    }

    renderFrames(container, frames, options = {}) {
        if (!container) return;

        const titleSelector = options.titleSelector || 'h3';
        const title = container.querySelector(titleSelector);
        const emptyEl = options.emptyElement || null;
        const frameClass = options.frameClass || 'stack-frame';
        const formatter = options.formatter || ((frame) => frame.label);

        const previous = container.querySelectorAll('.' + frameClass);
        previous.forEach((frameEl) => frameEl.remove());

        if (!frames || frames.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (title && !container.contains(title)) {
            container.appendChild(title);
        }

        if (emptyEl) emptyEl.classList.add('hidden');

        frames.forEach((frame) => {
            const el = document.createElement('div');
            el.className = frameClass + (frame.status ? ' ' + frame.status : '');
            el.textContent = formatter(frame);
            container.appendChild(el);
        });

        container.scrollTop = container.scrollHeight;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StackVisualizer;
}

if (typeof window !== 'undefined') {
    window.StackVisualizer = StackVisualizer;
}
