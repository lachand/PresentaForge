// @ts-check
/**
 * Audience mode bootstrap.
 * @param {{
 *   data: any,
 *   Reveal: any,
 *   Highlight: any,
 *   SlidesThemes: any,
 *   SlidesRenderer: any,
 *   SYNC_MSG: Record<string, string>,
 *   CHANNEL_NAME: string,
 *   toTrimmedString: (value: unknown, maxLen?: number) => string,
 *   toNumberOr: (value: unknown, fallback?: number) => number,
 *   toIntOrNull: (value: unknown) => number | null,
 *   audiencePolicy?: { mode?: string, readOnly?: boolean, allowAudienceActions?: boolean } | null,
 *   validateSyncMessage?: ((msg: unknown) => boolean) | null
 * }} ctx
 */
export async function initAudienceMode(ctx) {
    const {
        data, Reveal, Highlight, SlidesThemes, SlidesRenderer,
        SYNC_MSG, CHANNEL_NAME, toTrimmedString, toNumberOr, toIntOrNull, validateSyncMessage,
        audiencePolicy,
    } = ctx;

    document.body.classList.remove('viewer-light');
    document.documentElement.dataset.oeiSlidesRole = 'audience';
    document.documentElement.dataset.oeiAudienceMode = String(audiencePolicy?.mode || 'display');
    document.getElementById('presenter-view')?.classList.remove('active');
    const revealRoot = document.getElementById('reveal-root');
    if (revealRoot) revealRoot.style.display = '';
    const toolbarZone = document.getElementById('sl-toolbar-hover-zone');
    if (toolbarZone) toolbarZone.style.display = 'none';
    const toolbar = document.getElementById('sl-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    const hint = document.getElementById('sl-keyboard-hint');
    if (hint) hint.style.display = 'none';

    const themeData = typeof data.theme === 'string'
        ? (SlidesThemes.BUILT_IN[data.theme] || SlidesThemes.BUILT_IN.dark)
        : (data.theme || SlidesThemes.BUILT_IN.dark);
    document.getElementById('sl-theme-css').textContent = SlidesThemes.generateCSS(themeData);
    SlidesThemes.apply(themeData);

    const filteredData = { ...data, slides: (data.slides || []).filter(s => !s.hidden) };
    const root = document.getElementById('slides-root');
    SlidesRenderer.renderToReveal(filteredData, root);

    const title = data.metadata?.title || 'Présentation';
    document.title = title;

    const deck = new Reveal({
        width: 1280, height: 720,
        hash: false, progress: false,
        slideNumber: false,
        transition: 'slide',
        backgroundTransition: 'fade',
        controls: false,
        keyboard: false,
        touch: false,
        plugins: [Highlight],
        highlight: { highlightOnLoad: true },
    });
    await deck.initialize();

    const mountVisible = () => {
        SlidesRenderer.mountWidgets(root, deck);
        SlidesRenderer.mountSpecialElements(root);
    };
    mountVisible();
    deck.addEventListener('slidechanged', mountVisible);

    const tryFullscreen = () => {
        document.documentElement.requestFullscreen?.().catch(() => {});
        document.removeEventListener('click', tryFullscreen);
        document.removeEventListener('keydown', tryFullscreen);
    };
    document.addEventListener('click', tryFullscreen);
    document.addEventListener('keydown', tryFullscreen);
    document.documentElement.requestFullscreen?.().catch(() => {});

    let audienceWordCloudId = null;
    let audiencePollId = null;
    let audienceExitTicketId = null;
    let audienceRankOrderId = null;
    let audienceRouletteTimer = null;
    const buildQrImageSrc = (value, size = 320) => {
        const safeValue = String(value || '');
        if (window.qrcode && safeValue) {
            try {
                const qr = window.qrcode(0, 'M');
                qr.addData(safeValue);
                qr.make();
                const svg = qr.createSvgTag({ cellSize: Math.max(2, Math.floor(size / 42)), margin: 1, scalable: true });
                return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
            } catch (_) {}
        }
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(safeValue)}`;
    };
    const audienceElementStore = (() => {
        const current = window.OEIAudienceElementState;
        if (current && typeof current === 'object') return current;
        const next = {};
        window.OEIAudienceElementState = next;
        return next;
    })();
    const audienceElementKey = (elementType, slideIndex, elementId = '') => {
        const type = toTrimmedString(elementType, 80);
        const slide = toIntOrNull(slideIndex);
        const eid = toTrimmedString(elementId, 160);
        if (!type || slide === null || slide < 0) return '';
        return `${type}::${slide}::${eid}`;
    };
    const publishAudienceElementState = (msg = {}) => {
        const elementType = toTrimmedString(msg.elementType, 80);
        const slideIndex = toIntOrNull(msg.slideIndex);
        const elementId = toTrimmedString(msg.elementId, 160);
        const state = (msg.state && typeof msg.state === 'object') ? msg.state : {};
        if (!elementType || slideIndex === null || slideIndex < 0) return;
        const key = audienceElementKey(elementType, slideIndex, elementId);
        if (key) audienceElementStore[key] = state;
        try {
            window.dispatchEvent(new CustomEvent('oei:audience-element-state', {
                detail: { elementType, slideIndex, elementId, state },
            }));
        } catch (_) {}
    };

    const setAudienceWordCloudVisible = visible => {
        const overlay = document.getElementById('sl-audience-cloud-overlay');
        if (!overlay) return;
        overlay.classList.toggle('open', !!visible);
    };

    const esc = value => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const renderAudienceWordCloud = (prompt, wordsRaw) => {
        const promptEl = document.getElementById('sl-audience-cloud-prompt');
        const displayEl = document.getElementById('sl-audience-cloud-display');
        const countEl = document.getElementById('sl-audience-cloud-count');
        if (!displayEl || !countEl) return;
        const promptSafe = toTrimmedString(prompt, 200);
        if (promptEl) promptEl.textContent = promptSafe;
        const entries = Array.isArray(wordsRaw) ? wordsRaw : [];
        const words = entries.map(entry => {
            if (Array.isArray(entry)) return [String(entry[0] || ''), toNumberOr(entry[1], 0)];
            if (entry && typeof entry === 'object') return [String(entry.word || ''), toNumberOr(entry.count, 0)];
            return ['', 0];
        }).filter(([w, c]) => w.trim().length > 0 && c > 0).slice(0, 40);
        if (!words.length) {
            displayEl.innerHTML = '<div class="audience-cloud-empty">En attente de réponses…</div>';
            countEl.textContent = '';
            return;
        }
        const max = words[0]?.[1] || 1;
        const colors = ['#818cf8', '#34d399', '#f472b6', '#fb923c', '#60a5fa'];
        displayEl.innerHTML = words.map(([w, c], i) => {
            const size = Math.round(14 + (c / max) * 46);
            return `<span class="rm-cloud-word" style="font-size:${size}px;color:${colors[i % 5]};">${esc(w)}</span>`;
        }).join(' ');
        const total = words.reduce((sum, [, c]) => sum + c, 0);
        countEl.textContent = `${words.length} mots distincts · ${total} soumissions`;
    };

    const setAudiencePollVisible = visible => {
        const overlay = document.getElementById('sl-audience-poll-overlay');
        if (!overlay) return;
        overlay.classList.toggle('open', !!visible);
    };

    const setAudienceExitTicketVisible = visible => {
        const overlay = document.getElementById('sl-audience-exit-overlay');
        if (!overlay) return;
        overlay.classList.toggle('open', !!visible);
    };

    const setAudienceRankOrderVisible = visible => {
        const overlay = document.getElementById('sl-audience-rank-overlay');
        if (!overlay) return;
        overlay.classList.toggle('open', !!visible);
    };

    const renderAudiencePoll = (pollType, prompt, countsRaw, totalRaw, optionsRaw, multiRaw, totalSelectionsRaw) => {
        const promptEl = document.getElementById('sl-audience-poll-prompt');
        const resultsEl = document.getElementById('sl-audience-poll-results');
        const totalEl = document.getElementById('sl-audience-poll-total');
        if (!resultsEl || !totalEl) return;
        const typeRaw = toTrimmedString(pollType, 20);
        const type = (typeRaw === 'thumbs' || typeRaw === 'scale5' || typeRaw === 'mcq-single' || typeRaw === 'mcq-multi')
            ? typeRaw
            : 'scale5';
        const fallbackLabels = type === 'thumbs'
            ? ['👍 Pour', '👎 Contre']
            : (type === 'scale5' ? ['1', '2', '3', '4', '5'] : ['Option A', 'Option B']);
        const labels = (Array.isArray(optionsRaw) ? optionsRaw : fallbackLabels).map(v => toTrimmedString(v, 80)).filter(Boolean);
        const safeLabels = labels.length ? labels : fallbackLabels;
        const counts = Array.isArray(countsRaw) ? countsRaw.map(v => toNumberOr(v, 0)) : safeLabels.map(() => 0);
        const total = Math.max(0, toNumberOr(totalRaw, counts.reduce((a, b) => a + b, 0)));
        const totalSelections = Math.max(0, toNumberOr(totalSelectionsRaw, counts.reduce((a, b) => a + b, 0)));
        const isMulti = !!multiRaw || type === 'mcq-multi';
        const denominator = isMulti ? (totalSelections || 1) : (total || 1);
        const safePrompt = toTrimmedString(prompt, 180)
            || (type === 'thumbs' ? '👍 Pour / 👎 Contre' : (type === 'scale5' ? 'Évaluez de 1 à 5' : 'QCM live'));
        if (promptEl) promptEl.textContent = safePrompt;

        resultsEl.innerHTML = safeLabels.map((label, i) => {
            const count = counts[i] || 0;
            const pct = denominator > 0 ? Math.round((count / denominator) * 100) : 0;
            return `<div class="aud-poll-row">
                <span>${esc(label)}</span>
                <div class="aud-poll-bar"><div class="aud-poll-fill" style="width:${pct}%"></div></div>
                <span>${count} (${pct}%)</span>
            </div>`;
        }).join('');
        totalEl.textContent = isMulti
            ? `${total} répondant(s) · ${totalSelections} sélections`
            : `${total} réponse(s)`;
    };

    const renderAudienceExitTicket = (titleRaw, promptsRaw, responsesRaw, totalRaw) => {
        const titleEl = document.getElementById('sl-audience-exit-title');
        const promptsEl = document.getElementById('sl-audience-exit-prompts');
        const responsesEl = document.getElementById('sl-audience-exit-responses');
        const totalEl = document.getElementById('sl-audience-exit-total');
        if (!promptsEl || !responsesEl || !totalEl) return;
        const title = toTrimmedString(titleRaw, 120) || 'Exit ticket';
        const prompts = (Array.isArray(promptsRaw) ? promptsRaw : [])
            .map(v => toTrimmedString(v, 160))
            .filter(Boolean)
            .slice(0, 4);
        const responses = (Array.isArray(responsesRaw) ? responsesRaw : [])
            .slice(0, 10)
            .map(entry => ({
                pseudo: toTrimmedString(entry?.pseudo, 40) || 'Anonyme',
                answers: (Array.isArray(entry?.answers) ? entry.answers : [])
                    .map(v => toTrimmedString(v, 220))
                    .filter(Boolean)
                    .slice(0, 2),
            }));
        const total = Math.max(0, toNumberOr(totalRaw, responses.length));
        if (titleEl) titleEl.textContent = title;
        promptsEl.innerHTML = prompts.length
            ? prompts.map((prompt, idx) => `<div class="aud-exit-prompt">${idx + 1}. ${esc(prompt)}</div>`).join('')
            : '<div class="aud-exit-empty">En attente des questions…</div>';
        responsesEl.innerHTML = responses.length
            ? responses.map(entry => `<div class="aud-exit-response"><strong>${esc(entry.pseudo)}</strong>${entry.answers.length ? `: ${esc(entry.answers.join(' · '))}` : ''}</div>`).join('')
            : '<div class="aud-exit-empty">En attente de réponses…</div>';
        totalEl.textContent = `${total} réponse(s)`;
    };

    const renderAudienceRankOrder = (titleRaw, rowsRaw, totalRaw) => {
        const titleEl = document.getElementById('sl-audience-rank-title');
        const listEl = document.getElementById('sl-audience-rank-list');
        const totalEl = document.getElementById('sl-audience-rank-total');
        if (!listEl || !totalEl) return;
        const title = toTrimmedString(titleRaw, 120) || 'Classement collectif';
        const rows = (Array.isArray(rowsRaw) ? rowsRaw : [])
            .slice(0, 8)
            .map(row => ({
                label: toTrimmedString(row?.label, 120),
                score: toNumberOr(row?.score, 0),
            }))
            .filter(row => row.label);
        const total = Math.max(0, toNumberOr(totalRaw, 0));
        if (titleEl) titleEl.textContent = title;
        listEl.innerHTML = rows.length
            ? rows.map((row, idx) => `<div class="aud-rank-row"><span>${idx + 1}. ${esc(row.label)}</span><span>${row.score} pts</span></div>`).join('')
            : '<div class="aud-rank-empty">En attente de classements…</div>';
        totalEl.textContent = `${total} participant(s)`;
    };

    const showAudienceRoulettePick = pseudo => {
        const toast = document.getElementById('sl-audience-roulette-toast');
        if (!toast) return;
        const safe = toTrimmedString(pseudo, 80);
        if (!safe) return;
        toast.textContent = `Roulette: ${safe}`;
        toast.classList.add('open');
        if (audienceRouletteTimer) clearTimeout(audienceRouletteTimer);
        audienceRouletteTimer = setTimeout(() => {
            toast.classList.remove('open');
        }, 3200);
    };

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (e) => {
        const msg = e.data;
        if (!msg || typeof msg !== 'object') return;
        if (validateSyncMessage && !validateSyncMessage(msg)) return;
        switch (msg.type) {
            case SYNC_MSG.GO_TO: {
                const index = toIntOrNull(msg.index);
                if (index === null) return;
                deck.slide(index, 0, -1);
                break;
            }
            case SYNC_MSG.FRAGMENT_STEP: {
                const slideIndex = toIntOrNull(msg.slideIndex);
                const fragmentIndex = toIntOrNull(msg.fragmentIndex);
                if (slideIndex === null || fragmentIndex === null) return;
                const state = deck.getState();
                if ((state?.indexh ?? -1) !== slideIndex) deck.slide(slideIndex, 0, -1);
                const slideEl = deck.getCurrentSlide();
                if (!slideEl) break;
                const frags = Array.from(slideEl.querySelectorAll('.fragment'));
                frags.forEach((frag, i) => {
                    const visible = i <= fragmentIndex;
                    frag.classList.toggle('visible', visible);
                    frag.classList.toggle('current-fragment', i === fragmentIndex && fragmentIndex >= 0);
                });
                break;
            }
            case SYNC_MSG.BLACK: {
                const on = !!msg.on;
                const revealEl = document.querySelector('.reveal');
                if (revealEl) revealEl.style.opacity = on ? '0' : '1';
                document.body.style.background = on ? '#000' : '';
                break;
            }
            case SYNC_MSG.ROOM_QR: {
                const overlay = document.getElementById('sl-audience-qr-overlay');
                const url = toTrimmedString(msg.url, 2000);
                if (msg.show && url) {
                    const img = /** @type {HTMLImageElement|null} */ (document.getElementById('sl-audience-qr-img'));
                    const urlEl = document.getElementById('sl-audience-qr-url');
                    if (img) img.src = buildQrImageSrc(url, 320);
                    if (urlEl) urlEl.textContent = url;
                    overlay?.classList.add('open');
                } else {
                    overlay?.classList.remove('open');
                }
                break;
            }
            case SYNC_MSG.ELEMENT_STATE: {
                publishAudienceElementState(msg);
                break;
            }
            case SYNC_MSG.POLL_START: {
                audiencePollId = toTrimmedString(msg.pollId, 80) || 'active';
                setAudiencePollVisible(true);
                const type = toTrimmedString(msg.pollType, 20) || 'scale5';
                renderAudiencePoll(type, msg.prompt || '', [], 0, msg.options, msg.multi, 0);
                break;
            }
            case SYNC_MSG.POLL_UPDATE: {
                const pollId = toTrimmedString(msg.pollId, 80);
                if (audiencePollId && pollId && pollId !== audiencePollId) break;
                if (!audiencePollId) audiencePollId = pollId || 'active';
                setAudiencePollVisible(true);
                renderAudiencePoll(msg.pollType, msg.prompt || '', msg.counts, msg.total, msg.options, msg.multi, msg.totalSelections);
                break;
            }
            case SYNC_MSG.POLL_END: {
                const pollId = toTrimmedString(msg.pollId, 80);
                if (audiencePollId && pollId && pollId !== audiencePollId) break;
                audiencePollId = null;
                setAudiencePollVisible(false);
                break;
            }
            case SYNC_MSG.WORDCLOUD_START: {
                audienceWordCloudId = toTrimmedString(msg.cloudId, 80) || 'active';
                setAudienceWordCloudVisible(true);
                renderAudienceWordCloud(msg.prompt || '', []);
                break;
            }
            case SYNC_MSG.WORDCLOUD_UPDATE: {
                const cloudId = toTrimmedString(msg.cloudId, 80);
                if (audienceWordCloudId && cloudId && cloudId !== audienceWordCloudId) break;
                if (!audienceWordCloudId) audienceWordCloudId = cloudId || 'active';
                setAudienceWordCloudVisible(true);
                renderAudienceWordCloud(msg.prompt || '', msg.words);
                break;
            }
            case SYNC_MSG.WORDCLOUD_END: {
                const cloudId = toTrimmedString(msg.cloudId, 80);
                if (audienceWordCloudId && cloudId && cloudId !== audienceWordCloudId) break;
                audienceWordCloudId = null;
                setAudienceWordCloudVisible(false);
                break;
            }
            case SYNC_MSG.EXIT_TICKET_START: {
                audienceExitTicketId = toTrimmedString(msg.ticketId, 80) || 'active';
                setAudienceExitTicketVisible(true);
                renderAudienceExitTicket(msg.title, msg.prompts, [], 0);
                break;
            }
            case SYNC_MSG.EXIT_TICKET_UPDATE: {
                const ticketId = toTrimmedString(msg.ticketId, 80);
                if (audienceExitTicketId && ticketId && ticketId !== audienceExitTicketId) break;
                if (!audienceExitTicketId) audienceExitTicketId = ticketId || 'active';
                setAudienceExitTicketVisible(true);
                renderAudienceExitTicket(msg.title, msg.prompts, msg.responses, msg.responsesCount);
                break;
            }
            case SYNC_MSG.EXIT_TICKET_END: {
                const ticketId = toTrimmedString(msg.ticketId, 80);
                if (audienceExitTicketId && ticketId && ticketId !== audienceExitTicketId) break;
                audienceExitTicketId = null;
                setAudienceExitTicketVisible(false);
                break;
            }
            case SYNC_MSG.RANK_ORDER_START: {
                audienceRankOrderId = toTrimmedString(msg.rankId, 80) || 'active';
                setAudienceRankOrderVisible(true);
                renderAudienceRankOrder(msg.title, [], 0);
                break;
            }
            case SYNC_MSG.RANK_ORDER_UPDATE: {
                const rankId = toTrimmedString(msg.rankId, 80);
                if (audienceRankOrderId && rankId && rankId !== audienceRankOrderId) break;
                if (!audienceRankOrderId) audienceRankOrderId = rankId || 'active';
                setAudienceRankOrderVisible(true);
                renderAudienceRankOrder(msg.title, msg.rows, msg.responsesCount);
                break;
            }
            case SYNC_MSG.RANK_ORDER_END: {
                const rankId = toTrimmedString(msg.rankId, 80);
                if (audienceRankOrderId && rankId && rankId !== audienceRankOrderId) break;
                audienceRankOrderId = null;
                setAudienceRankOrderVisible(false);
                break;
            }
            case SYNC_MSG.ROULETTE_PICK: {
                showAudienceRoulettePick(msg.pseudo);
                break;
            }
            default:
                break;
        }
    };

    window.addEventListener('beforeunload', () => channel.close());
}
