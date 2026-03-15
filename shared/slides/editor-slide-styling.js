/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-slide-styling
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-slide-styling.js"></script>
 */
/* editor-slide-styling.js — Transitions, padding, background image, gradient, apply-to-all */

/* ── C1-C3: Transitions ───────────────────────────────── */

function initTransitions() {
    // Transition type chips
    document.querySelectorAll('#transition-picker .transition-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#transition-picker .transition-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const slide = editor.currentSlide;
            if (slide) {
                slide.transition = chip.dataset.transition;
                editor._push();
            }
        });
    });
    // Duration slider
    const durSlider = document.getElementById('transition-duration');
    const durLabel = document.getElementById('transition-duration-label');
    if (durSlider) durSlider.addEventListener('input', () => {
        const val = +durSlider.value;
        if (durLabel) durLabel.textContent = val + 'ms';
        const slide = editor.currentSlide;
        if (slide) { slide.transitionDuration = val; editor._push(); }
    });
    // Preview button
    document.getElementById('btn-preview-transition')?.addEventListener('click', () => {
        const frame = document.getElementById('preview-frame');
        if (!frame) return;
        const slide = editor.currentSlide;
        const transition = slide?.transition || 'none';
        const duration = (slide?.transitionDuration || 500) + 'ms';
        if (transition === 'none') return;
        const animMap = {
            'fade': [{ opacity: 0 }, { opacity: 1 }],
            'slide-left': [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
            'slide-right': [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
            'zoom-in': [{ transform: 'scale(0.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
            'zoom-out': [{ transform: 'scale(1.5)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
            'flip': [{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0)' }],
        };
        frame.animate(animMap[transition] || animMap['fade'], { duration: parseInt(duration), easing: 'ease-out' });
    });
}

function updateTransitionUI() {
    const slide = editor.currentSlide;
    if (!slide) return;
    const transition = slide.transition || 'none';
    document.querySelectorAll('#transition-picker .transition-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.transition === transition);
    });
    const dur = document.getElementById('transition-duration');
    const durLabel = document.getElementById('transition-duration-label');
    if (dur && document.activeElement !== dur) dur.value = slide.transitionDuration || 500;
    if (durLabel) durLabel.textContent = (slide.transitionDuration || 500) + 'ms';
}

/* ── C4: Slide Padding ─────────────────────────────────── */

function initSlidePadding() {
    const slider = document.getElementById('slide-padding');
    const label = document.getElementById('slide-padding-label');
    if (!slider) return;
    slider.addEventListener('input', () => {
        if (label) label.textContent = slider.value + 'px';
        const slide = editor.currentSlide;
        if (slide) { slide.padding = +slider.value; editor._push(); }
    });
}

function updateSlidePadding() {
    const slide = editor.currentSlide;
    const slider = document.getElementById('slide-padding');
    const label = document.getElementById('slide-padding-label');
    if (slider && slide && document.activeElement !== slider) slider.value = slide.padding || 40;
    if (label && slide) label.textContent = (slide.padding || 40) + 'px';
}

/* ── C5: Background Image ─────────────────────────────── */

function openBgImagePicker() {
    const slide = editor.currentSlide;
    if (!slide) return;
    const existing = slide.bgImage || '';
    // Create a small popover
    let pop = document.getElementById('bg-image-popover');
    if (pop) { pop.remove(); }
    pop = document.createElement('div');
    pop.id = 'bg-image-popover';
    pop.className = 'floating-popover bg-image-popover';
    const btn = document.getElementById('btn-bg-image');
    const rect = btn?.getBoundingClientRect();
    pop.style.top = (rect ? rect.bottom + 4 : 200) + 'px';
    pop.style.left = (rect ? rect.left : 200) + 'px';
    pop.innerHTML = `
        <div style="font-weight:600;margin-bottom:8px;font-size:0.8rem;">Image de fond</div>
        <input type="text" id="bg-img-url" value="${existing.replace(/"/g, '&quot;')}" placeholder="https://..." style="width:100%;padding:6px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);box-sizing:border-box;margin-bottom:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
            <select id="bg-img-size" style="flex:1;padding:4px;border-radius:4px;border:1px solid var(--border);background:var(--bg);color:var(--text);">
                <option value="cover" ${(slide.bgSize||'cover')==='cover'?'selected':''}>Couvrir</option>
                <option value="contain" ${slide.bgSize==='contain'?'selected':''}>Contenir</option>
                <option value="stretch" ${slide.bgSize==='stretch'?'selected':''}>Étirer</option>
            </select>
            <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" id="bg-img-overlay" ${slide.bgOverlay?'checked':''}> Overlay sombre</label>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;">
            <button id="bg-img-apply" class="tb-btn ui-btn" style="flex:1;justify-content:center;">Appliquer</button>
            <button id="bg-img-clear" class="tb-btn ui-btn" style="flex:1;justify-content:center;">Retirer</button>
        </div>
    `;
    document.body.appendChild(pop);
    pop.querySelector('#bg-img-apply').addEventListener('click', () => {
        const url = pop.querySelector('#bg-img-url').value.trim();
        const size = pop.querySelector('#bg-img-size').value;
        const overlay = pop.querySelector('#bg-img-overlay').checked;
        slide.bgImage = url;
        slide.bgSize = size;
        slide.bgOverlay = overlay;
        editor._push();
        pop.remove();
        notify(url ? 'Image de fond définie' : 'Image de fond retirée', 'success');
    });
    pop.querySelector('#bg-img-clear').addEventListener('click', () => {
        delete slide.bgImage;
        delete slide.bgSize;
        delete slide.bgOverlay;
        editor._push();
        pop.remove();
        notify('Image de fond retirée', 'success');
    });
    const closeBgImgPop = e => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', closeBgImgPop); } };
    setTimeout(() => document.addEventListener('mousedown', closeBgImgPop), 0);
}

/* ── C6: Gradient Picker ───────────────────────────────── */

function openGradientPicker() {
    const slide = editor.currentSlide;
    if (!slide) return;
    const current = slide.bgGradient || { color1: '#1a1a2e', color2: '#16213e', angle: 135 };
    let pop = document.getElementById('gradient-popover');
    if (pop) { pop.remove(); }
    pop = document.createElement('div');
    pop.id = 'gradient-popover';
    pop.className = 'floating-popover gradient-popover';
    const btn = document.getElementById('btn-gradient');
    const rect = btn?.getBoundingClientRect();
    pop.style.top = (rect ? rect.bottom + 4 : 200) + 'px';
    pop.style.left = (rect ? rect.left : 200) + 'px';
    pop.innerHTML = `
        <div style="font-weight:600;margin-bottom:8px;font-size:0.8rem;">Dégradé</div>
        <div id="grad-preview" style="height:40px;border-radius:6px;margin-bottom:8px;border:1px solid var(--border);background:linear-gradient(${current.angle}deg,${current.color1},${current.color2});"></div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <label style="font-size:0.75rem;">
                Couleur 1<br><input type="color" id="grad-c1" value="${current.color1}" style="width:50px;height:28px;border:none;cursor:pointer;">
            </label>
            <label style="font-size:0.75rem;">
                Couleur 2<br><input type="color" id="grad-c2" value="${current.color2}" style="width:50px;height:28px;border:none;cursor:pointer;">
            </label>
            <label style="font-size:0.75rem;flex:1;">
                Angle<br><input type="range" id="grad-angle" min="0" max="360" value="${current.angle}" style="width:100%;"><span id="grad-angle-val" style="font-size:0.7rem;">${current.angle}°</span>
            </label>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;" id="grad-presets"></div>
        <div style="display:flex;gap:6px;">
            <button id="grad-apply" class="tb-btn ui-btn" style="flex:1;justify-content:center;">Appliquer</button>
            <button id="grad-clear" class="tb-btn ui-btn" style="flex:1;justify-content:center;">Retirer</button>
        </div>
    `;
    document.body.appendChild(pop);
    // Presets
    const presets = [
        ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
        ['#1a1a2e', '#16213e'], ['#0f0c29', '#302b63'], ['#232526', '#414345'],
    ];
    const presetsEl = pop.querySelector('#grad-presets');
    presets.forEach(([c1, c2]) => {
        const swatch = document.createElement('div');
        swatch.className = 'gradient-swatch';
        swatch.style.background = `linear-gradient(135deg,${c1},${c2})`;
        swatch.addEventListener('click', () => {
            pop.querySelector('#grad-c1').value = c1;
            pop.querySelector('#grad-c2').value = c2;
            updatePreview();
        });
        presetsEl.appendChild(swatch);
    });
    const updatePreview = () => {
        const c1 = pop.querySelector('#grad-c1').value;
        const c2 = pop.querySelector('#grad-c2').value;
        const a = pop.querySelector('#grad-angle').value;
        pop.querySelector('#grad-angle-val').textContent = a + '°';
        pop.querySelector('#grad-preview').style.background = `linear-gradient(${a}deg,${c1},${c2})`;
    };
    pop.querySelector('#grad-c1').addEventListener('input', updatePreview);
    pop.querySelector('#grad-c2').addEventListener('input', updatePreview);
    pop.querySelector('#grad-angle').addEventListener('input', updatePreview);
    pop.querySelector('#grad-apply').addEventListener('click', () => {
        const c1 = pop.querySelector('#grad-c1').value;
        const c2 = pop.querySelector('#grad-c2').value;
        const angle = +pop.querySelector('#grad-angle').value;
        slide.bgGradient = { color1: c1, color2: c2, angle };
        slide.bg = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
        editor._push();
        pop.remove();
        notify('Dégradé appliqué', 'success');
    });
    pop.querySelector('#grad-clear').addEventListener('click', () => {
        delete slide.bgGradient;
        if (slide.bg?.startsWith('linear-gradient')) delete slide.bg;
        editor._push();
        pop.remove();
        notify('Dégradé retiré', 'success');
    });
    const closeGradPop = e => { if (!pop.contains(e.target) && e.target !== btn) { pop.remove(); document.removeEventListener('mousedown', closeGradPop); } };
    setTimeout(() => document.addEventListener('mousedown', closeGradPop), 0);
}

/* ── C7: Apply to all slides ───────────────────────────── */

async function applyBgToAll() {
    const slide = editor.currentSlide;
    if (!slide) return;
    if (!await OEIDialog.confirm('Appliquer le fond et la transition du slide actuel à tous les slides ?')) return;
    for (const s of editor.data.slides) {
        if (slide.bg) s.bg = slide.bg;
        if (slide.bgImage) s.bgImage = slide.bgImage;
        if (slide.bgGradient) s.bgGradient = { ...slide.bgGradient };
        if (slide.transition) s.transition = slide.transition;
        if (slide.transitionDuration) s.transitionDuration = slide.transitionDuration;
    }
    editor._push();
    notify('Fond appliqué à tous', 'success');
}
