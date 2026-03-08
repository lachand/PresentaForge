class ResponsiveTesterPage extends ConceptPage {
    constructor(dataPath) {
        super(dataPath);
        this.currentWidth = 1024;
        this.debounceTimer = null;
        this.resizeObserver = null;
        this.overflowCheckTimer = null;

        this.examples = {
            cards: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #f1f5f9; padding: 2rem; }
  h1 { text-align: center; margin-bottom: 1.5rem; color: #1e293b; font-size: 1.5rem; }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .card h2 { color: #4f46e5; font-size: 1.1rem; margin-bottom: 0.5rem; }
  .card p { color: #64748b; font-size: 0.9rem; line-height: 1.5; }
  .card .tag {
    display: inline-block; margin-top: 0.75rem;
    padding: 0.2rem 0.6rem; background: #eef2ff;
    color: #4f46e5; border-radius: 999px;
    font-size: 0.75rem; font-weight: 600;
  }

  @media (max-width: 768px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 480px) {
    body { padding: 1rem; }
    .grid { grid-template-columns: 1fr; }
    h1 { font-size: 1.2rem; }
  }
</style>
</head>
<body>
  <h1>Nos Services</h1>
  <div class="grid">
    <div class="card">
      <h2>Developpement Web</h2>
      <p>Sites modernes et performants avec les dernieres technologies.</p>
      <span class="tag">HTML/CSS/JS</span>
    </div>
    <div class="card">
      <h2>Design UX/UI</h2>
      <p>Interfaces intuitives centrees sur l'experience utilisateur.</p>
      <span class="tag">Figma</span>
    </div>
    <div class="card">
      <h2>Base de donnees</h2>
      <p>Architecture de donnees robuste et evolutive.</p>
      <span class="tag">SQL</span>
    </div>
  </div>
</body>
</html>`,
            nav: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; }

  nav {
    background: #1e293b;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo { color: white; font-weight: 700; font-size: 1.2rem; }
  .nav-links { display: flex; gap: 1.5rem; list-style: none; }
  .nav-links a {
    color: #94a3b8; text-decoration: none;
    font-size: 0.95rem; transition: color 0.2s;
  }
  .nav-links a:hover { color: white; }

  .menu-toggle {
    display: none; background: none; border: none;
    color: white; font-size: 1.5rem; cursor: pointer;
  }

  .content { padding: 2rem; max-width: 800px; margin: 0 auto; }
  .content h1 { margin-bottom: 1rem; color: #1e293b; }
  .content p { color: #64748b; line-height: 1.6; }

  @media (max-width: 640px) {
    nav { flex-wrap: wrap; }
    .menu-toggle { display: block; }
    .nav-links {
      display: none; width: 100%;
      flex-direction: column; gap: 0.75rem;
      padding-top: 1rem;
    }
    .nav-links.open { display: flex; }
  }
</style>
</head>
<body>
  <nav>
    <div class="logo">MonSite</div>
    <button class="menu-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')">&#9776;</button>
    <ul class="nav-links">
      <li><a href="#">Accueil</a></li>
      <li><a href="#">Articles</a></li>
      <li><a href="#">Projets</a></li>
      <li><a href="#">Contact</a></li>
    </ul>
  </nav>
  <div class="content">
    <h1>Navigation responsive</h1>
    <p>Redimensionnez la largeur sous 640px pour voir le menu hamburger apparaitre.</p>
  </div>
</body>
</html>`,
            grid: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; background: #f8fafc; padding: 2rem; }
  h1 { text-align: center; margin-bottom: 0.5rem; color: #1e293b; }
  .subtitle { text-align: center; color: #64748b; margin-bottom: 2rem; font-size: 0.9rem; }

  .gallery {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 120px;
    gap: 1rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .item {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .item.tall { grid-row: span 2; }
  .item.wide { grid-column: span 2; }

  @media (max-width: 900px) {
    .gallery { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    body { padding: 1rem; }
    .gallery { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 100px; }
    .item.wide { grid-column: span 1; }
  }
  @media (max-width: 400px) {
    .gallery { grid-template-columns: 1fr; }
    .item.tall { grid-row: span 1; }
  }
</style>
</head>
<body>
  <h1>Galerie CSS Grid</h1>
  <p class="subtitle">Observez comment la grille s'adapte aux differentes tailles</p>
  <div class="gallery">
    <div class="item tall">1</div>
    <div class="item wide">2</div>
    <div class="item">3</div>
    <div class="item">4</div>
    <div class="item wide">5</div>
    <div class="item">6</div>
    <div class="item tall">7</div>
    <div class="item">8</div>
  </div>
</body>
</html>`,
            hero: `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; }

  .hero {
    background: linear-gradient(135deg, #1e293b 0%, #4f46e5 100%);
    color: white;
    padding: 6rem 2rem;
    text-align: center;
  }
  .hero h1 { font-size: 3rem; margin-bottom: 1rem; line-height: 1.1; }
  .hero p { font-size: 1.2rem; color: #cbd5e1; max-width: 600px; margin: 0 auto 2rem; line-height: 1.5; }
  .hero .cta {
    display: inline-block; padding: 0.8rem 2rem;
    background: #10b981; color: white;
    text-decoration: none; border-radius: 8px;
    font-weight: 600; font-size: 1rem;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
    padding: 3rem 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .feature { text-align: center; }
  .feature .icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
  .feature h3 { color: #1e293b; margin-bottom: 0.5rem; }
  .feature p { color: #64748b; font-size: 0.9rem; line-height: 1.5; }

  @media (max-width: 768px) {
    .hero { padding: 4rem 1.5rem; }
    .hero h1 { font-size: 2rem; }
    .hero p { font-size: 1rem; }
    .features { grid-template-columns: 1fr; gap: 1.5rem; padding: 2rem 1.5rem; }
  }

  @media (max-width: 480px) {
    .hero { padding: 3rem 1rem; }
    .hero h1 { font-size: 1.5rem; }
    .hero p { font-size: 0.9rem; }
  }
</style>
</head>
<body>
  <div class="hero">
    <h1>Creez des sites web modernes</h1>
    <p>Apprenez le responsive design et creez des interfaces qui s'adaptent a tous les ecrans.</p>
    <a href="#" class="cta">Commencer</a>
  </div>
  <div class="features">
    <div class="feature">
      <div class="icon">&#128241;</div>
      <h3>Mobile First</h3>
      <p>Concevez d'abord pour mobile, puis enrichissez pour les grands ecrans.</p>
    </div>
    <div class="feature">
      <div class="icon">&#9881;&#65039;</div>
      <h3>Flexbox & Grid</h3>
      <p>Utilisez les outils CSS modernes pour des layouts flexibles.</p>
    </div>
    <div class="feature">
      <div class="icon">&#127912;</div>
      <h3>Media Queries</h3>
      <p>Adaptez le style selon la taille de l'ecran avec @media.</p>
    </div>
  </div>
</body>
</html>`
        };

        this.commonBreakpoints = [480, 640, 768, 1024, 1280, 1536];
    }

    async init() {
        await super.init();

        this.codeEditor = document.getElementById('code-editor');
        this.previewIframe = document.getElementById('preview-iframe');
        this.iframeWrapper = document.getElementById('iframe-wrapper');
        this.widthSlider = document.getElementById('width-slider');
        this.widthDisplay = document.getElementById('width-display');
        this.deviceInfo = document.getElementById('device-info');
        this.rulerCanvas = document.getElementById('ruler-canvas');
        this.rulerContainer = document.getElementById('ruler-container');
        this.mqDisplay = document.getElementById('mq-display');
        this.btnApply = document.getElementById('btn-apply');
        this.overflowReport = document.getElementById('overflow-report');

        this.bindEvents();

        this.resizeObserver = new ResizeObserver(() => this.setWidth(this.currentWidth));
        this.resizeObserver.observe(this.iframeWrapper.parentElement);

        this.codeEditor.value = this.examples.cards;
        this.applyCode();
        this.setWidth(1024);
    }

    bindEvents() {
        this.widthSlider.addEventListener('input', () => this.setWidth(parseInt(this.widthSlider.value, 10)));

        document.querySelectorAll('.device-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.setWidth(parseInt(btn.dataset.width, 10)));
        });

        this.codeEditor.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.applyCode(), 300);
        });

        this.btnApply.addEventListener('click', () => this.applyCode());

        this.codeEditor.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const start = this.codeEditor.selectionStart;
            const end = this.codeEditor.selectionEnd;
            this.codeEditor.value = this.codeEditor.value.substring(0, start) + '  ' + this.codeEditor.value.substring(end);
            this.codeEditor.selectionStart = this.codeEditor.selectionEnd = start + 2;
        });

        document.querySelectorAll('[data-example]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.example;
                if (!this.examples[key]) return;
                this.codeEditor.value = this.examples[key];
                this.applyCode();
            });
        });
    }

    applyCode() {
        const code = this.codeEditor.value;
        const iframeDoc = this.previewIframe.contentDocument || this.previewIframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(code);
        iframeDoc.close();
        this.scheduleOverflowCheck();
    }

    setWidth(width) {
        this.currentWidth = Math.max(320, Math.min(1920, width));
        this.widthSlider.value = String(this.currentWidth);
        this.widthDisplay.textContent = this.currentWidth + ' px';

        const maxAvailable = this.iframeWrapper.parentElement.clientWidth;
        const displayWidth = Math.min(this.currentWidth, maxAvailable);

        this.iframeWrapper.style.width = displayWidth + 'px';
        this.previewIframe.style.width = this.currentWidth + 'px';

        if (this.currentWidth > maxAvailable) {
            const scale = maxAvailable / this.currentWidth;
            this.previewIframe.style.transform = 'scale(' + scale + ')';
            this.previewIframe.style.transformOrigin = 'top left';
            this.iframeWrapper.style.height = 500 * scale + 'px';
        } else {
            this.previewIframe.style.transform = 'none';
            this.iframeWrapper.style.height = 'auto';
        }

        this.updateDeviceInfo();
        this.updateDeviceButtons();
        this.updateBreakpoints();
        this.updateMediaQueryDisplay();
        this.drawRuler();
        this.scheduleOverflowCheck();
    }

    scheduleOverflowCheck() {
        clearTimeout(this.overflowCheckTimer);
        this.overflowCheckTimer = setTimeout(() => this.updateOverflowReport(), 90);
    }

    describeElement(el) {
        if (!el) return '(inconnu)';
        const id = el.id ? '#' + el.id : '';
        const cls = el.className ? '.' + String(el.className).trim().replace(/\s+/g, '.').slice(0, 32) : '';
        return '<' + el.tagName.toLowerCase() + '>' + id + cls;
    }

    updateOverflowReport() {
        if (!this.overflowReport) return;
        const iframeDoc = this.previewIframe.contentDocument || this.previewIframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.documentElement || !iframeDoc.body) return;

        const viewportWidth = iframeDoc.documentElement.clientWidth || this.currentWidth;
        const body = iframeDoc.body;
        const scrollWidth = Math.max(
            iframeDoc.documentElement.scrollWidth || 0,
            body.scrollWidth || 0
        );
        const overflowPx = Math.max(0, Math.round(scrollWidth - viewportWidth));

        const offenders = [];
        iframeDoc.querySelectorAll('body *').forEach((node) => {
            if (offenders.length >= 6) return;
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            if (rect.right > viewportWidth + 0.5 || rect.left < -0.5) {
                offenders.push({
                    node,
                    overBy: Math.round(Math.max(rect.right - viewportWidth, -rect.left))
                });
            }
        });

        if (overflowPx <= 0) {
            this.overflowReport.innerHTML = '<div class="overflow-ok">Aucun overflow horizontal detecte a ' + this.currentWidth + 'px.</div>';
            return;
        }

        const lines = offenders
            .map((item) => '<li><code>' + this.describeElement(item.node) + '</code> depasse d\'environ ' + item.overBy + 'px</li>')
            .join('');

        this.overflowReport.innerHTML = '' +
            '<div class="overflow-bad">Overflow horizontal detecte: +' + overflowPx + 'px</div>' +
            '<div class="overflow-note">Elements suspects:</div>' +
            '<ul class="overflow-list">' +
                (lines || '<li>Aucun element clairement identifie (verifier largeurs fixes, marges negatives, transform).</li>') +
            '</ul>';
    }

    updateDeviceInfo() {
        let device;
        if (this.currentWidth <= 480) {
            device = { name: 'Mobile', category: 'mobile', desc: 'petit smartphone' };
        } else if (this.currentWidth <= 640) {
            device = { name: 'Mobile large', category: 'mobile', desc: 'smartphone paysage' };
        } else if (this.currentWidth <= 768) {
            device = { name: 'Tablette', category: 'tablet', desc: 'tablette portrait' };
        } else if (this.currentWidth <= 1024) {
            device = { name: 'Desktop', category: 'desktop', desc: 'ecran standard' };
        } else if (this.currentWidth <= 1440) {
            device = { name: 'Desktop large', category: 'wide', desc: 'ecran HD' };
        } else {
            device = { name: 'Ultra-large', category: 'wide', desc: 'ecran tres large / 4K' };
        }

        this.deviceInfo.innerHTML = '<span class="info-tag ' + device.category + '">' + device.name + '</span><span>Equivalent : ' + device.desc + ' (' + this.currentWidth + 'px)</span>';
    }

    updateDeviceButtons() {
        document.querySelectorAll('.device-btn').forEach((btn) => {
            btn.classList.toggle('active', parseInt(btn.dataset.width, 10) === this.currentWidth);
        });
    }

    updateBreakpoints() {
        document.querySelectorAll('.bp-indicator').forEach((indicator) => {
            const bp = parseInt(indicator.dataset.bp, 10);
            const active = this.currentWidth >= bp;
            indicator.querySelector('.bp-dot').classList.toggle('active', active);
            indicator.querySelector('.bp-label').classList.toggle('active', active);
        });
    }

    updateMediaQueryDisplay() {
        const mqs = [
            { query: '@media (max-width: 480px)', active: this.currentWidth <= 480 },
            { query: '@media (max-width: 640px)', active: this.currentWidth <= 640 },
            { query: '@media (max-width: 768px)', active: this.currentWidth <= 768 },
            { query: '@media (max-width: 1024px)', active: this.currentWidth <= 1024 },
            { query: '@media (min-width: 768px)', active: this.currentWidth >= 768 },
            { query: '@media (min-width: 1024px)', active: this.currentWidth >= 1024 },
            { query: '@media (min-width: 1280px)', active: this.currentWidth >= 1280 }
        ];

        this.mqDisplay.innerHTML = '<strong style="color:var(--code-text);">Media queries actives a ' + this.currentWidth + 'px :</strong><br>' +
            mqs.map((mq) => {
                const cls = mq.active ? 'mq-active' : 'mq-inactive';
                const icon = mq.active ? '&#10003;' : '&#10007;';
                return '<span class="' + cls + '">' + icon + ' ' + mq.query + '</span>';
            }).join('<br>');
    }

    drawRuler() {
        const dpr = window.devicePixelRatio || 1;
        const containerWidth = this.rulerContainer.clientWidth;

        this.rulerCanvas.width = containerWidth * dpr;
        this.rulerCanvas.height = 28 * dpr;
        this.rulerCanvas.style.width = containerWidth + 'px';
        this.rulerCanvas.style.height = '28px';

        const ctx = this.rulerCanvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, containerWidth, 28);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, containerWidth, 28);

        const maxAvailable = this.iframeWrapper.parentElement.clientWidth;
        const displayWidth = Math.min(this.currentWidth, maxAvailable);
        const scale = displayWidth / this.currentWidth;
        const offset = (containerWidth - displayWidth) / 2;

        let majorStep;
        let minorStep;
        if (this.currentWidth <= 600) {
            majorStep = 50;
            minorStep = 10;
        } else if (this.currentWidth <= 1200) {
            majorStep = 100;
            minorStep = 50;
        } else {
            majorStep = 200;
            minorStep = 50;
        }

        ctx.strokeStyle = '#cbd5e1';
        ctx.fillStyle = '#64748b';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';

        for (let px = 0; px <= this.currentWidth; px += minorStep) {
            const x = offset + px * scale;
            const isMajor = px % majorStep === 0;
            const h = isMajor ? 16 : 8;

            ctx.beginPath();
            ctx.moveTo(x, 28);
            ctx.lineTo(x, 28 - h);
            ctx.lineWidth = isMajor ? 1.5 : 0.8;
            ctx.stroke();

            if (isMajor && px > 0) ctx.fillText(String(px), x, 10);
        }

        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        for (const bp of this.commonBreakpoints) {
            if (bp > this.currentWidth) continue;
            const x = offset + bp * scale;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 28);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }
}

if (typeof window !== 'undefined') {
    window.ResponsiveTesterPage = ResponsiveTesterPage;
}
