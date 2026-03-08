class FlexboxPlaygroundPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
        this.items = [];
        this.selectedIdx = -1;
        this.nextId = 1;
    }

    async init() {
        await super.init();
        this.bindInlineCompatibility();
        this.createDefaultItems();
        this.update();
    }

    bindInlineCompatibility() {
        window.addItem = this.addItem.bind(this);
        window.removeItem = this.removeItem.bind(this);
        window.resetItems = this.resetItems.bind(this);
        window.updateItemProp = this.updateItemProp.bind(this);
        window.update = this.update.bind(this);
        window.copyCode = this.copyCode.bind(this);
    }

    createDefaultItems() {
        this.items = [];
        for (let i = 0; i < 4; i++) {
            this.items.push({
                id: this.nextId++,
                label: String(i + 1),
                grow: 0,
                shrink: 1,
                basis: 'auto',
                order: 0,
                alignSelf: 'auto',
                width: 'auto',
                height: [60, 80, 50, 70][i] || 60
            });
        }
    }

    addItem() {
        const idx = this.items.length;
        this.items.push({
            id: this.nextId++,
            label: String(idx + 1),
            grow: 0,
            shrink: 1,
            basis: 'auto',
            order: 0,
            alignSelf: 'auto',
            width: 'auto',
            height: 50 + Math.floor(Math.random() * 50)
        });
        this.update();
    }

    removeItem() {
        if (this.items.length === 0) return;

        if (this.selectedIdx >= 0 && this.selectedIdx < this.items.length) {
            this.items.splice(this.selectedIdx, 1);
            this.selectedIdx = -1;
            document.getElementById('item-props').style.display = 'none';
        } else {
            this.items.pop();
        }

        this.items.forEach((item, i) => {
            item.label = String(i + 1);
        });

        this.update();
    }

    resetItems() {
        this.nextId = 1;
        this.selectedIdx = -1;
        document.getElementById('item-props').style.display = 'none';
        this.createDefaultItems();
        this.update();
    }

    selectItem(idx) {
        this.selectedIdx = idx;
        const item = this.items[idx];

        document.getElementById('item-props').style.display = 'block';
        document.getElementById('selected-item-label').textContent = '#' + item.label;
        document.getElementById('item-grow').value = item.grow;
        document.getElementById('item-shrink').value = item.shrink;
        document.getElementById('item-basis').value = item.basis;
        document.getElementById('item-order').value = item.order;
        document.getElementById('item-align-self').value = item.alignSelf;
        document.getElementById('item-width').value = item.width;

        this.renderPreview();
    }

    updateItemProp() {
        if (this.selectedIdx < 0 || this.selectedIdx >= this.items.length) return;

        const item = this.items[this.selectedIdx];
        item.grow = parseFloat(document.getElementById('item-grow').value) || 0;
        item.shrink = parseFloat(document.getElementById('item-shrink').value) || 0;
        item.basis = document.getElementById('item-basis').value || 'auto';
        item.order = parseInt(document.getElementById('item-order').value, 10) || 0;
        item.alignSelf = document.getElementById('item-align-self').value;
        item.width = document.getElementById('item-width').value || 'auto';

        this.update();
    }

    renderPreview() {
        const container = document.getElementById('flex-container');
        if (!container) return;
        container.style.display = document.getElementById('ctl-display').value;
        container.style.flexDirection = document.getElementById('ctl-direction').value;
        container.style.justifyContent = document.getElementById('ctl-justify').value;
        container.style.alignItems = document.getElementById('ctl-align').value;
        container.style.flexWrap = document.getElementById('ctl-wrap').value;
        container.style.alignContent = document.getElementById('ctl-align-content').value;
        container.style.gap = document.getElementById('ctl-gap').value;

        container.innerHTML = '';
        this.items.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'flex-item' + (i === this.selectedIdx ? ' selected' : '');
            div.style.backgroundColor = this.COLORS[i % this.COLORS.length];
            div.style.flexGrow = item.grow;
            div.style.flexShrink = item.shrink;
            div.style.flexBasis = item.basis;
            div.style.order = item.order;
            div.style.alignSelf = item.alignSelf;
            if (item.width !== 'auto') div.style.width = item.width;
            div.style.minHeight = item.height + 'px';
            div.textContent = item.label;
            div.addEventListener('click', () => this.selectItem(i));
            container.appendChild(div);
        });

        this.renderAxisOverlay(container);
    }

    renderAxisOverlay(container) {
        const old = container.querySelector('.flex-axis-overlay');
        if (old) old.remove();

        const direction = document.getElementById('ctl-direction').value;
        const wrapMode = document.getElementById('ctl-wrap').value;
        const mainRow = direction.startsWith('row');
        const mainReverse = direction.endsWith('reverse');
        const crossReverse = wrapMode === 'wrap-reverse';

        const overlay = document.createElement('div');
        overlay.className = 'flex-axis-overlay';

        const mainLine = document.createElement('div');
        mainLine.className = 'axis-line main ' + (mainRow ? 'horizontal' : 'vertical');
        mainLine.style.setProperty('--axis-dir', mainReverse ? '-1' : '1');
        overlay.appendChild(mainLine);

        const crossLine = document.createElement('div');
        crossLine.className = 'axis-line cross ' + (mainRow ? 'vertical' : 'horizontal');
        crossLine.style.setProperty('--axis-dir', crossReverse ? '-1' : '1');
        overlay.appendChild(crossLine);

        const mainLabel = document.createElement('div');
        mainLabel.className = 'axis-label main';
        mainLabel.textContent = 'Axe principal ' + (mainRow
            ? (mainReverse ? '\u2190' : '\u2192')
            : (mainReverse ? '\u2191' : '\u2193'));
        overlay.appendChild(mainLabel);

        const crossLabel = document.createElement('div');
        crossLabel.className = 'axis-label cross';
        crossLabel.textContent = 'Axe secondaire ' + (mainRow
            ? (crossReverse ? '\u2191' : '\u2193')
            : (crossReverse ? '\u2190' : '\u2192'));
        overlay.appendChild(crossLabel);

        container.appendChild(overlay);
    }

    generateCode() {
        const display = document.getElementById('ctl-display').value;
        const direction = document.getElementById('ctl-direction').value;
        const justify = document.getElementById('ctl-justify').value;
        const align = document.getElementById('ctl-align').value;
        const wrap = document.getElementById('ctl-wrap').value;
        const alignContent = document.getElementById('ctl-align-content').value;
        const gap = document.getElementById('ctl-gap').value;

        let css = '<span class="css-selector">.container</span> <span class="css-brace">{</span>\n';
        css += '  <span class="css-prop">display</span>: <span class="css-value">' + display + '</span>;\n';
        if (direction !== 'row') css += '  <span class="css-prop">flex-direction</span>: <span class="css-value">' + direction + '</span>;\n';
        if (justify !== 'flex-start') css += '  <span class="css-prop">justify-content</span>: <span class="css-value">' + justify + '</span>;\n';
        if (align !== 'stretch') css += '  <span class="css-prop">align-items</span>: <span class="css-value">' + align + '</span>;\n';
        if (wrap !== 'nowrap') {
            css += '  <span class="css-prop">flex-wrap</span>: <span class="css-value">' + wrap + '</span>;\n';
            if (alignContent !== 'stretch') css += '  <span class="css-prop">align-content</span>: <span class="css-value">' + alignContent + '</span>;\n';
        }
        if (gap !== '0' && gap !== '0px') css += '  <span class="css-prop">gap</span>: <span class="css-value">' + gap + '</span>;\n';
        css += '<span class="css-brace">}</span>\n';

        this.items.forEach((item, i) => {
            const hasCustom = item.grow !== 0 || item.shrink !== 1 || item.basis !== 'auto'
                || item.order !== 0 || item.alignSelf !== 'auto' || item.width !== 'auto';

            if (hasCustom) {
                css += '\n<span class="css-selector">.item-' + (i + 1) + '</span> <span class="css-brace">{</span>\n';
                if (item.grow !== 0 || item.shrink !== 1 || item.basis !== 'auto') {
                    css += '  <span class="css-prop">flex</span>: <span class="css-value">' + item.grow + ' ' + item.shrink + ' ' + item.basis + '</span>;\n';
                }
                if (item.order !== 0) css += '  <span class="css-prop">order</span>: <span class="css-value">' + item.order + '</span>;\n';
                if (item.alignSelf !== 'auto') css += '  <span class="css-prop">align-self</span>: <span class="css-value">' + item.alignSelf + '</span>;\n';
                if (item.width !== 'auto') css += '  <span class="css-prop">width</span>: <span class="css-value">' + item.width + '</span>;\n';
                css += '<span class="css-brace">}</span>\n';
            }
        });

        document.getElementById('code-output').innerHTML = css;
    }

    getPlainCode() {
        const el = document.getElementById('code-output');
        return el.textContent || el.innerText;
    }

    copyCode() {
        const text = this.getPlainCode();
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
        this.generateCode();
    }
}

if (typeof window !== 'undefined') {
    window.FlexboxPlaygroundPage = FlexboxPlaygroundPage;
}
