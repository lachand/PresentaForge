class GridPlaygroundPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#a855f7','#e11d48'];
        this.AREA_COLORS = {
            header: '#6366f1', sidebar: '#8b5cf6', main: '#22c55e',
            footer: '#f97316', nav: '#ec4899', aside: '#14b8a6',
            content: '#3b82f6', hero: '#f43f5e', menu: '#eab308'
        };

        this.gridItems = [];
        this.selectedIdx = -1;
        this.nextId = 1;
    }

    async init() {
        await super.init();
        this.bindInlineCompatibility();
        this.createDefaults();
        this.update();
        window.addEventListener('resize', () => {
            const container = document.getElementById('grid-container');
            if (container) this.drawGridLines(container);
        });
    }

    bindInlineCompatibility() {
        window.addGridItem = this.addGridItem.bind(this);
        window.resetGridItems = this.resetGridItems.bind(this);
        window.updateItemProp = this.updateItemProp.bind(this);
        window.update = this.update.bind(this);
        window.copyCode = this.copyCode.bind(this);
    }

    createDefaults() {
        this.gridItems = [];
        this.nextId = 1;
        for (let i = 0; i < 6; i++) {
            this.gridItems.push({
                id: this.nextId++,
                label: String(i + 1),
                gridColumn: 'auto',
                gridRow: 'auto',
                gridArea: '',
                justifySelf: 'auto'
            });
        }
    }

    addGridItem() {
        const idx = this.gridItems.length;
        this.gridItems.push({
            id: this.nextId++,
            label: String(idx + 1),
            gridColumn: 'auto',
            gridRow: 'auto',
            gridArea: '',
            justifySelf: 'auto'
        });
        this.update();
    }

    removeGridItem(idx) {
        this.gridItems.splice(idx, 1);
        this.gridItems.forEach((item, i) => {
            item.label = String(i + 1);
        });

        if (this.selectedIdx === idx) {
            this.selectedIdx = -1;
            document.getElementById('item-config').style.display = 'none';
        } else if (this.selectedIdx > idx) {
            this.selectedIdx--;
        }

        this.update();
    }

    selectGridItem(idx) {
        this.selectedIdx = idx;
        const item = this.gridItems[idx];

        document.getElementById('item-config').style.display = 'block';
        document.getElementById('sel-item-label').textContent = '#' + item.label;
        document.getElementById('item-col').value = item.gridColumn;
        document.getElementById('item-row').value = item.gridRow;
        document.getElementById('item-area').value = item.gridArea;
        document.getElementById('item-justify-self').value = item.justifySelf;

        this.update();
    }

    updateItemProp() {
        if (this.selectedIdx < 0 || this.selectedIdx >= this.gridItems.length) return;

        const item = this.gridItems[this.selectedIdx];
        item.gridColumn = document.getElementById('item-col').value || 'auto';
        item.gridRow = document.getElementById('item-row').value || 'auto';
        item.gridArea = document.getElementById('item-area').value.trim();
        item.justifySelf = document.getElementById('item-justify-self').value;

        this.update();
    }

    resetGridItems() {
        this.selectedIdx = -1;
        document.getElementById('item-config').style.display = 'none';
        this.createDefaults();
        this.update();
    }

    getAreaColor(areaName) {
        if (this.AREA_COLORS[areaName]) return this.AREA_COLORS[areaName];

        let hash = 0;
        for (let i = 0; i < areaName.length; i++) {
            hash = areaName.charCodeAt(i) + ((hash << 5) - hash);
        }
        return this.COLORS[Math.abs(hash) % this.COLORS.length];
    }

    renderPreview() {
        const container = document.getElementById('grid-container');
        const columns = document.getElementById('ctl-columns').value;
        const rows = document.getElementById('ctl-rows').value;
        const gap = document.getElementById('ctl-gap').value;
        const justifyItems = document.getElementById('ctl-justify-items').value;
        const alignItems = document.getElementById('ctl-align-items').value;
        const areasRaw = document.getElementById('ctl-areas').value.trim();

        container.style.display = 'grid';
        container.style.gridTemplateColumns = columns;
        container.style.gridTemplateRows = rows;
        container.style.gap = gap;
        container.style.justifyItems = justifyItems;
        container.style.alignItems = alignItems;
        container.style.gridTemplateAreas = areasRaw ? areasRaw : '';

        container.innerHTML = '';

        this.gridItems.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'grid-item' + (i === this.selectedIdx ? ' selected' : '');

            const useArea = item.gridArea && item.gridArea !== '';
            if (useArea) {
                div.style.gridArea = item.gridArea;
                div.style.backgroundColor = this.getAreaColor(item.gridArea);
                div.textContent = item.gridArea;
            } else {
                div.style.backgroundColor = this.COLORS[i % this.COLORS.length];
                div.textContent = item.label;
                if (item.gridColumn !== 'auto') div.style.gridColumn = item.gridColumn;
                if (item.gridRow !== 'auto') div.style.gridRow = item.gridRow;
            }

            if (item.justifySelf !== 'auto') div.style.justifySelf = item.justifySelf;

            div.addEventListener('click', () => this.selectGridItem(i));
            container.appendChild(div);
        });

        this.drawGridLines(container);
    }

    drawGridLines(container) {
        const existing = container.parentElement.querySelector('.grid-lines-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'grid-lines-overlay';

        const cs = getComputedStyle(container);
        const colWidths = cs.gridTemplateColumns.split(/\s+/).map(parseFloat);
        const rowHeights = cs.gridTemplateRows.split(/\s+/).map(parseFloat);
        const gapVal = parseFloat(cs.gap) || 0;

        let x = 0;
        for (let i = 0; i <= colWidths.length; i++) {
            const line = document.createElement('div');
            line.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;border-left:1px dashed rgba(79,70,229,0.3);left:' + x + 'px;';
            overlay.appendChild(line);

            if (i < colWidths.length) {
                const lbl = document.createElement('div');
                lbl.style.cssText = 'position:absolute;top:-18px;font-size:0.65rem;color:var(--muted);font-weight:600;left:' + (x + colWidths[i] / 2) + 'px;transform:translateX(-50%);';
                lbl.textContent = 'c' + (i + 1);
                overlay.appendChild(lbl);
            }

            if (i < colWidths.length) {
                x += colWidths[i] + (i < colWidths.length - 1 ? gapVal : 0);
            }
        }

        let y = 0;
        for (let i = 0; i <= rowHeights.length; i++) {
            const line = document.createElement('div');
            line.style.cssText = 'position:absolute;left:0;right:0;height:1px;border-top:1px dashed rgba(79,70,229,0.3);top:' + y + 'px;';
            overlay.appendChild(line);
            if (i < rowHeights.length) {
                const lbl = document.createElement('div');
                lbl.style.cssText = 'position:absolute;left:-18px;font-size:0.65rem;color:var(--muted);font-weight:600;top:' + (y + rowHeights[i] / 2) + 'px;transform:translateY(-50%);';
                lbl.textContent = 'r' + (i + 1);
                overlay.appendChild(lbl);
            }
            if (i < rowHeights.length) {
                y += rowHeights[i] + (i < rowHeights.length - 1 ? gapVal : 0);
            }
        }

        const areasRaw = (document.getElementById('ctl-areas')?.value || '').trim();
        if (areasRaw) {
            const rows = areasRaw
                .split('\n')
                .map((line) => line.trim().replace(/^"+|"+$/g, ''))
                .filter((line) => line.length > 0)
                .map((line) => line.split(/\s+/));
            const areaMap = new Map();
            rows.forEach((row, rIdx) => {
                row.forEach((name, cIdx) => {
                    if (!name || name === '.') return;
                    if (!areaMap.has(name)) {
                        areaMap.set(name, { minR: rIdx, maxR: rIdx, minC: cIdx, maxC: cIdx });
                    } else {
                        const rec = areaMap.get(name);
                        rec.minR = Math.min(rec.minR, rIdx);
                        rec.maxR = Math.max(rec.maxR, rIdx);
                        rec.minC = Math.min(rec.minC, cIdx);
                        rec.maxC = Math.max(rec.maxC, cIdx);
                    }
                });
            });

            const colStarts = [];
            let cx = 0;
            for (let i = 0; i < colWidths.length; i += 1) {
                colStarts.push(cx);
                cx += colWidths[i] + (i < colWidths.length - 1 ? gapVal : 0);
            }
            const rowStarts = [];
            let ry = 0;
            for (let i = 0; i < rowHeights.length; i += 1) {
                rowStarts.push(ry);
                ry += rowHeights[i] + (i < rowHeights.length - 1 ? gapVal : 0);
            }

            areaMap.forEach((rec, name) => {
                if (rec.minC >= colStarts.length || rec.minR >= rowStarts.length) return;
                const left = colStarts[rec.minC];
                const top = rowStarts[rec.minR];
                let width = 0;
                for (let c = rec.minC; c <= rec.maxC && c < colWidths.length; c += 1) {
                    width += colWidths[c];
                    if (c < rec.maxC) width += gapVal;
                }
                let height = 0;
                for (let r = rec.minR; r <= rec.maxR && r < rowHeights.length; r += 1) {
                    height += rowHeights[r];
                    if (r < rec.maxR) height += gapVal;
                }

                const areaBlock = document.createElement('div');
                areaBlock.className = 'grid-area-overlay';
                areaBlock.style.left = left + 'px';
                areaBlock.style.top = top + 'px';
                areaBlock.style.width = width + 'px';
                areaBlock.style.height = height + 'px';
                areaBlock.style.borderColor = this.getAreaColor(name);
                areaBlock.innerHTML = '<span class="grid-area-label">' + this.esc(name) + '</span>';
                overlay.appendChild(areaBlock);
            });
        }

        container.parentElement.appendChild(overlay);
    }

    renderItemList() {
        const list = document.getElementById('item-list');
        list.innerHTML = '';

        this.gridItems.forEach((item, i) => {
            const entry = document.createElement('div');
            entry.className = 'item-entry' + (i === this.selectedIdx ? ' selected' : '');

            const dot = document.createElement('div');
            dot.className = 'color-dot';
            dot.style.backgroundColor = item.gridArea ? this.getAreaColor(item.gridArea) : this.COLORS[i % this.COLORS.length];

            const name = document.createElement('span');
            name.className = 'item-name';
            name.textContent = item.gridArea || ('Element ' + item.label);

            const span = document.createElement('span');
            span.className = 'item-span';
            const parts = [];
            if (item.gridColumn !== 'auto') parts.push('col:' + item.gridColumn);
            if (item.gridRow !== 'auto') parts.push('row:' + item.gridRow);
            if (item.gridArea) parts.push('area:' + item.gridArea);
            span.textContent = parts.join(' ') || 'auto';

            const btnRemove = document.createElement('button');
            btnRemove.className = 'btn-remove-item';
            btnRemove.textContent = '×';
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeGridItem(i);
            });

            entry.appendChild(dot);
            entry.appendChild(name);
            entry.appendChild(span);
            entry.appendChild(btnRemove);
            entry.addEventListener('click', () => this.selectGridItem(i));
            list.appendChild(entry);
        });
    }

    generateCode() {
        const columns = document.getElementById('ctl-columns').value;
        const rows = document.getElementById('ctl-rows').value;
        const gap = document.getElementById('ctl-gap').value;
        const justifyItems = document.getElementById('ctl-justify-items').value;
        const alignItems = document.getElementById('ctl-align-items').value;
        const areasRaw = document.getElementById('ctl-areas').value.trim();

        let css = '<span class="css-selector">.grid-container</span> <span class="css-brace">{</span>\n';
        css += '  <span class="css-prop">display</span>: <span class="css-value">grid</span>;\n';
        css += '  <span class="css-prop">grid-template-columns</span>: <span class="css-value">' + this.esc(columns) + '</span>;\n';
        if (rows && rows !== 'auto') css += '  <span class="css-prop">grid-template-rows</span>: <span class="css-value">' + this.esc(rows) + '</span>;\n';
        if (gap && gap !== '0' && gap !== '0px') css += '  <span class="css-prop">gap</span>: <span class="css-value">' + this.esc(gap) + '</span>;\n';
        if (justifyItems !== 'stretch') css += '  <span class="css-prop">justify-items</span>: <span class="css-value">' + justifyItems + '</span>;\n';
        if (alignItems !== 'stretch') css += '  <span class="css-prop">align-items</span>: <span class="css-value">' + alignItems + '</span>;\n';
        if (areasRaw) {
            const lines = areasRaw.split('\n').map((line) => line.trim()).filter((line) => line);
            css += '  <span class="css-prop">grid-template-areas</span>:\n';
            lines.forEach((line, i) => {
                css += '    <span class="css-value">' + this.esc(line) + '</span>' + (i < lines.length - 1 ? '' : ';') + '\n';
            });
        }
        css += '<span class="css-brace">}</span>\n';

        this.gridItems.forEach((item, i) => {
            const hasCustom = item.gridColumn !== 'auto' || item.gridRow !== 'auto' || item.gridArea || item.justifySelf !== 'auto';
            if (hasCustom) {
                const selector = item.gridArea ? '.' + item.gridArea : '.item-' + (i + 1);
                css += '\n<span class="css-selector">' + this.esc(selector) + '</span> <span class="css-brace">{</span>\n';
                if (item.gridArea) {
                    css += '  <span class="css-prop">grid-area</span>: <span class="css-value">' + this.esc(item.gridArea) + '</span>;\n';
                } else {
                    if (item.gridColumn !== 'auto') css += '  <span class="css-prop">grid-column</span>: <span class="css-value">' + this.esc(item.gridColumn) + '</span>;\n';
                    if (item.gridRow !== 'auto') css += '  <span class="css-prop">grid-row</span>: <span class="css-value">' + this.esc(item.gridRow) + '</span>;\n';
                }
                if (item.justifySelf !== 'auto') css += '  <span class="css-prop">justify-self</span>: <span class="css-value">' + item.justifySelf + '</span>;\n';
                css += '<span class="css-brace">}</span>\n';
            }
        });

        const output = document.getElementById('code-output');
        output.innerHTML = '<button class="copy-btn" onclick="copyCode()" id="copy-btn">Copier</button>' + css;
    }

    esc(value) {
        const d = document.createElement('div');
        d.textContent = value;
        return d.innerHTML;
    }

    copyCode() {
        const output = document.getElementById('code-output');
        const text = output.textContent.replace('Copier', '').trim();
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('copy-btn');
            btn.textContent = 'Copie !';
            setTimeout(() => {
                btn.textContent = 'Copier';
            }, 1500);
        });
    }

    update() {
        this.renderPreview();
        this.renderItemList();
        this.generateCode();
    }
}

if (typeof window !== 'undefined') {
    window.GridPlaygroundPage = GridPlaygroundPage;
}
