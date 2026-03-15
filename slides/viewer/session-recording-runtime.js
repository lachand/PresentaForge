// @ts-check

/**
 * @param {any} value
 * @returns {string}
 */
function safeFilePart(value) {
    return String(value || 'session')
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'session';
}

/**
 * @param {any} mime
 * @returns {string}
 */
function audioExtFromMime(mime) {
    const safe = String(mime || '').toLowerCase();
    if (safe.includes('ogg')) return 'ogg';
    if (safe.includes('mpeg')) return 'mp3';
    if (safe.includes('mp4')) return 'm4a';
    if (safe.includes('wav')) return 'wav';
    return 'webm';
}

/**
 * @param {any} mime
 * @returns {string}
 */
function audioCodecLabelFromMime(mime) {
    const safe = String(mime || '').toLowerCase();
    if (safe.includes('opus')) return 'Opus';
    if (safe.includes('ogg')) return 'Ogg';
    if (safe.includes('mpeg')) return 'MP3';
    if (safe.includes('mp4')) return 'AAC/MP4';
    if (safe.includes('wav')) return 'WAV';
    return 'WebM';
}

/**
 * @param {any} bitsPerSecond
 * @returns {string}
 */
function audioBitrateLabel(bitsPerSecond) {
    const bps = Number(bitsPerSecond);
    if (!Number.isFinite(bps) || bps <= 0) return '';
    return `${Math.round(bps / 1000)} kbps`;
}

/**
 * @param {Object} params
 * @param {URLSearchParams} [params.queryParams]
 * @param {string} [params.title]
 * @param {string} [params.sourceFile]
 * @param {any[]} [params.slides]
 * @param {any} [params.data]
 * @param {(session: any, options?: any) => any} params.normalizeReplaySessionExport
 * @param {(payload: any) => string} params.buildReplayStandaloneHtmlFn
 * @param {any} params.slidesRenderer
 * @param {any} params.slidesShared
 * @param {() => string} [params.getThemeCss]
 * @param {() => number} params.getCurrentIndex
 * @param {() => number} params.getCurrentFragmentIndex
 * @param {() => boolean} params.getBlackScreen
 * @param {(value: number) => void} params.setCurrentFragmentIndex
 * @param {(on: boolean) => void} params.setBlackScreen
 * @param {(index: number) => void} params.goTo
 * @param {() => HTMLElement | null} params.getCurrentInnerContainer
 * @param {(container: HTMLElement) => HTMLElement[]} params.getFragments
 * @param {() => void} params.renderCurrentSlide
 * @param {(value: any) => string} [params.escapeHtml]
 * @param {(ms: number) => string} [params.formatClock]
 * @param {Document} [params.documentRef]
 * @param {Window & typeof globalThis} [params.windowRef]
 * @param {Navigator} [params.navigatorRef]
 * @param {(ms?: number) => number} [params.now]
 * @param {(fn: (...args: any[]) => void, ms: number) => any} [params.setTimeoutFn]
 * @param {(id: any) => void} [params.clearTimeoutFn]
 */
export function createSessionRecordingRuntime(params = {}) {
    if (typeof params.normalizeReplaySessionExport !== 'function') {
        throw new Error('createSessionRecordingRuntime requires normalizeReplaySessionExport');
    }
    if (typeof params.buildReplayStandaloneHtmlFn !== 'function') {
        throw new Error('createSessionRecordingRuntime requires buildReplayStandaloneHtmlFn');
    }
    const getCurrentIndex = (typeof params.getCurrentIndex === 'function') ? params.getCurrentIndex : (() => 0);
    const getCurrentFragmentIndex = (typeof params.getCurrentFragmentIndex === 'function') ? params.getCurrentFragmentIndex : (() => -1);
    const getBlackScreen = (typeof params.getBlackScreen === 'function') ? params.getBlackScreen : (() => false);
    const setCurrentFragmentIndex = (typeof params.setCurrentFragmentIndex === 'function') ? params.setCurrentFragmentIndex : (() => {});
    const setBlackScreen = (typeof params.setBlackScreen === 'function') ? params.setBlackScreen : (() => {});
    const goTo = (typeof params.goTo === 'function') ? params.goTo : (() => {});
    const getCurrentInnerContainer = (typeof params.getCurrentInnerContainer === 'function')
        ? params.getCurrentInnerContainer
        : (() => null);
    const getFragments = (typeof params.getFragments === 'function')
        ? params.getFragments
        : (() => []);
    const renderCurrentSlide = (typeof params.renderCurrentSlide === 'function') ? params.renderCurrentSlide : (() => {});
    const esc = (typeof params.escapeHtml === 'function')
        ? params.escapeHtml
        : (value => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;'));
    const formatClock = (typeof params.formatClock === 'function')
        ? params.formatClock
        : (ms => {
            const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
            const min = String(Math.floor(total / 60)).padStart(2, '0');
            const sec = String(total % 60).padStart(2, '0');
            return `${min}:${sec}`;
        });
    const doc = params.documentRef || (typeof document !== 'undefined' ? document : null);
    const win = params.windowRef || (typeof window !== 'undefined' ? window : /** @type {any} */ (null));
    const nav = params.navigatorRef || (typeof navigator !== 'undefined' ? navigator : /** @type {any} */ (null));
    const now = (typeof params.now === 'function') ? params.now : (() => Date.now());
    const setTimeoutFn = (typeof params.setTimeoutFn === 'function') ? params.setTimeoutFn : setTimeout;
    const clearTimeoutFn = (typeof params.clearTimeoutFn === 'function') ? params.clearTimeoutFn : clearTimeout;

    const queryParams = params.queryParams || new URLSearchParams('');
    const recordAudioKbps = (() => {
        const fromQuery = Number(queryParams.get('recAudioKbps'));
        const fallback = 48;
        const value = Number.isFinite(fromQuery) ? fromQuery : fallback;
        return Math.max(16, Math.min(160, Math.trunc(value)));
    })();
    const recordAudioTargetBps = recordAudioKbps * 1000;
    const recordingMimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
        'audio/ogg',
        'audio/mp4',
        'audio/mpeg',
    ];
    const recordingAudioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48000 },
    };

    const createCompressedRecorder = stream => {
        const supports = type => {
            try {
                if (typeof MediaRecorder?.isTypeSupported !== 'function') return true;
                return MediaRecorder.isTypeSupported(type);
            } catch (_) {
                return false;
            }
        };
        const selectedMime = recordingMimeCandidates.find(type => supports(type)) || '';
        const bitrateCandidates = Array.from(new Set([
            recordAudioTargetBps,
            64000,
            48000,
            32000,
        ].map(v => Math.trunc(Number(v) || 0)).filter(v => v > 0)));
        const optionsToTry = [];
        for (const bps of bitrateCandidates) {
            if (selectedMime) optionsToTry.push({ mimeType: selectedMime, audioBitsPerSecond: bps, bitsPerSecond: bps });
            else optionsToTry.push({ audioBitsPerSecond: bps, bitsPerSecond: bps });
        }
        if (selectedMime) optionsToTry.push({ mimeType: selectedMime });
        optionsToTry.push({});

        let lastError = null;
        for (const opts of optionsToTry) {
            try {
                const recorder = new MediaRecorder(stream, opts);
                const effectiveMime = recorder.mimeType || selectedMime || 'audio/webm';
                const effectiveBps = Number(
                    recorder.audioBitsPerSecond
                    || opts.audioBitsPerSecond
                    || opts.bitsPerSecond
                    || 0
                ) || 0;
                return { recorder, mimeType: effectiveMime, bitsPerSecond: effectiveBps };
            } catch (err) {
                lastError = err;
            }
        }
        throw (lastError || new Error('MediaRecorder indisponible'));
    };

    const downloadBlob = (blob, filename) => {
        if (!blob || !doc) return;
        const url = URL.createObjectURL(blob);
        const link = doc.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        doc.body.appendChild(link);
        link.click();
        setTimeoutFn(() => {
            try { link.remove(); } catch (_) {}
        }, 200);
        setTimeoutFn(() => URL.revokeObjectURL(url), 4000);
    };

    const prepareSaveTarget = async (suggestedName, mimeType = '', ext = '') => {
        if (!win || typeof win.showSaveFilePicker !== 'function') return { kind: 'download' };
        try {
            const typeEntry = (mimeType && ext)
                ? [{ description: 'Export', accept: { [mimeType]: [ext] } }]
                : [];
            const handle = await win.showSaveFilePicker({
                suggestedName,
                types: typeEntry,
                excludeAcceptAllOption: false,
            });
            return handle ? { kind: 'handle', handle } : { kind: 'download' };
        } catch (err) {
            if (err?.name === 'AbortError') return { kind: 'cancel' };
            return { kind: 'download' };
        }
    };

    const saveBlob = async (target, blob, filename) => {
        if (!blob) return false;
        if (target?.kind === 'cancel') return false;
        if (target?.kind === 'handle' && target.handle?.createWritable) {
            const writable = await target.handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        }
        downloadBlob(blob, filename);
        return true;
    };

    const blobToDataUrl = blob => new Promise(resolve => {
        if (!blob) {
            resolve('');
            return;
        }
        try {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        } catch (_) {
            resolve('');
        }
    });

    const state = {
        active: false,
        paused: false,
        replaying: false,
        startAt: 0,
        stopAt: 0,
        pausedAccumMs: 0,
        pauseStartedAt: 0,
        events: [],
        captions: [],
        autoNotesBySlide: {},
        mediaStream: null,
        mediaRecorder: null,
        audioChunks: [],
        audioBlob: null,
        audioMimeType: 'audio/webm',
        audioTargetBitsPerSecond: recordAudioTargetBps,
        audioBitsPerSecond: 0,
        audioCodecLabel: '',
        speechRecognition: null,
        speechEnabled: false,
        replayTimers: [],
        replayAudio: null,
        lastSession: null,
        labelTimer: null,
        exportBusy: false,
        exportMessage: '',
    };

    const recStatusEl = () => doc?.getElementById('pv-rec-status') || null;
    const recLiveEl = () => doc?.getElementById('pv-rec-live') || null;
    const recButtonEl = () => doc?.getElementById('pv-btn-rec') || null;
    const recPauseButtonEl = () => doc?.getElementById('pv-btn-rec-pause') || null;
    const replayButtonEl = () => doc?.getElementById('pv-btn-replay') || null;
    const exportButtonEl = () => doc?.getElementById('pv-btn-export-session') || null;
    const exportReplayButtonEl = () => doc?.getElementById('pv-btn-export-replay') || null;

    const setExportMessage = (message = '') => {
        state.exportMessage = String(message || '');
        updateUi();
    };

    const recordElapsedMs = (at = now()) => {
        if (!state.startAt) return 0;
        const safeNow = Number.isFinite(Number(at)) ? Number(at) : now();
        const activePauseMs = state.paused && state.pauseStartedAt
            ? Math.max(0, safeNow - state.pauseStartedAt)
            : 0;
        return Math.max(0, safeNow - state.startAt - (state.pausedAccumMs || 0) - activePauseMs);
    };

    const recordEvent = (type, payload = {}) => {
        if (!state.active) return;
        if (state.paused) return;
        state.events.push({
            type: String(type || '').slice(0, 48),
            t: recordElapsedMs(now()),
            payload: (payload && typeof payload === 'object') ? payload : {},
        });
    };

    const setLiveCaption = (text = '', ts = 0) => {
        const live = recLiveEl();
        if (!live) return;
        const safeText = String(text || '').trim();
        if (!safeText) {
            live.classList.remove('active');
            live.textContent = '';
            return;
        }
        live.classList.add('active');
        live.innerHTML = `<strong>[${esc(formatClock(ts))}]</strong> ${esc(safeText)}`;
    };

    function updateUi() {
        const status = recStatusEl();
        const recBtn = recButtonEl();
        const pauseBtn = recPauseButtonEl();
        const replayBtn = replayButtonEl();
        const exportBtn = exportButtonEl();
        const exportReplayBtn = exportReplayButtonEl();
        if (recBtn) {
            recBtn.classList.toggle('rec-active', state.active);
            recBtn.innerHTML = state.active
                ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>Stop`
                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>Enregistrer`;
        }
        if (pauseBtn) {
            pauseBtn.disabled = !state.active || state.exportBusy;
            pauseBtn.classList.toggle('active', state.paused);
            pauseBtn.classList.toggle('rec-paused', state.paused);
            pauseBtn.innerHTML = state.paused
                ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Reprendre`
                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>Pause`;
        }
        if (replayBtn) {
            replayBtn.classList.toggle('active', state.replaying);
            replayBtn.disabled = !state.lastSession;
            replayBtn.innerHTML = state.replaying
                ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>Stop replay`
                : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polygon points="7 5 19 12 7 19 7 5"/></svg>Replay`;
        }
        if (exportBtn) exportBtn.disabled = !state.lastSession || state.exportBusy;
        if (exportReplayBtn) exportReplayBtn.disabled = !state.lastSession || state.exportBusy;
        if (recBtn) recBtn.disabled = state.exportBusy;
        if (replayBtn) replayBtn.disabled = state.exportBusy || !state.lastSession;

        if (!status) return;
        status.classList.remove('recording', 'replay');
        if (state.exportBusy) {
            status.textContent = state.exportMessage || 'Export en cours…';
            return;
        }
        if (state.exportMessage) {
            status.textContent = state.exportMessage;
            return;
        }
        if (state.active) {
            const elapsed = recordElapsedMs(now());
            const parts = [];
            parts.push(state.paused
                ? `Enregistrement en pause · ${formatClock(elapsed)}`
                : `Enregistrement en cours · ${formatClock(elapsed)}`);
            const codecLabel = state.audioCodecLabel || 'audio auto';
            const bitrateLabel = audioBitrateLabel(state.audioBitsPerSecond || state.audioTargetBitsPerSecond);
            parts.push(bitrateLabel ? `Codec: ${codecLabel} (${bitrateLabel})` : `Codec: ${codecLabel}`);
            parts.push(state.speechEnabled ? 'Sous-titres auto: actif' : 'Sous-titres auto: indisponible');
            status.textContent = parts.join(' · ');
            status.classList.add('recording');
            if (state.labelTimer) clearTimeoutFn(state.labelTimer);
            state.labelTimer = setTimeoutFn(() => updateUi(), 1000);
            return;
        }
        if (state.replaying) {
            status.textContent = 'Replay en cours';
            status.classList.add('replay');
            return;
        }
        if (state.lastSession) {
            const codec = String(state.lastSession.audioCodec || audioCodecLabelFromMime(state.lastSession.audioMimeType || ''));
            const bitrate = audioBitrateLabel(state.lastSession.audioBitsPerSecond || 0);
            const audioInfo = state.lastSession.hasAudio
                ? (bitrate ? `${codec} ${bitrate}` : codec || 'audio')
                : 'sans audio';
            status.textContent = `Dernière session: ${formatClock(state.lastSession.durationMs || 0)} · ${(state.lastSession.events || []).length} événements · ${(state.lastSession.captions || []).length} sous-titres · ${audioInfo}`;
            return;
        }
        status.textContent = '';
    }

    const appendAutoNote = (slideIdx, line) => {
        if (!Number.isFinite(Number(slideIdx)) || slideIdx < 0) return;
        const key = String(slideIdx);
        if (!state.autoNotesBySlide[key]) state.autoNotesBySlide[key] = [];
        state.autoNotesBySlide[key].push(String(line || '').slice(0, 420));
        if (state.autoNotesBySlide[key].length > 180) {
            state.autoNotesBySlide[key] = state.autoNotesBySlide[key].slice(-180);
        }
    };

    const onSpeechResult = event => {
        if (!state.active || state.paused || !event?.results) return;
        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
            const result = event.results[i];
            if (!result?.isFinal) continue;
            const transcript = String(result[0]?.transcript || '').trim();
            if (!transcript) continue;
            const ts = now() - state.startAt;
            const slideIndex = getCurrentIndex();
            state.captions.push({ t: ts, text: transcript, slideIndex });
            appendAutoNote(slideIndex, `[${formatClock(ts)}] ${transcript}`);
            setLiveCaption(transcript, ts);
            recordEvent('caption', { text: transcript, slideIndex });
            if (slideIndex >= 0) renderCurrentSlide();
        }
    };

    const startSpeechRecognition = () => {
        const SR = win?.SpeechRecognition || win?.webkitSpeechRecognition;
        if (!SR) {
            state.speechEnabled = false;
            return;
        }
        try {
            const rec = new SR();
            rec.lang = 'fr-FR';
            rec.continuous = true;
            rec.interimResults = false;
            rec.maxAlternatives = 1;
            rec.onresult = onSpeechResult;
            rec.onerror = () => { state.speechEnabled = false; updateUi(); };
            rec.onend = () => {
                if (state.active) {
                    try { rec.start(); } catch (_) {}
                }
            };
            rec.start();
            state.speechRecognition = rec;
            state.speechEnabled = true;
        } catch (_) {
            state.speechEnabled = false;
        }
    };

    const stopSpeechRecognition = () => {
        const rec = state.speechRecognition;
        state.speechRecognition = null;
        state.speechEnabled = false;
        if (!rec) return;
        try { rec.onend = null; } catch (_) {}
        try { rec.onresult = null; } catch (_) {}
        try { rec.stop(); } catch (_) {}
    };

    const pauseSessionRecording = () => {
        if (!state.active || state.paused) return;
        recordEvent('record:pause', {
            index: getCurrentIndex(),
            fragmentIndex: getCurrentFragmentIndex(),
        });
        state.paused = true;
        state.pauseStartedAt = now();
        stopSpeechRecognition();
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording' && typeof state.mediaRecorder.pause === 'function') {
            try { state.mediaRecorder.pause(); } catch (_) {}
        }
        setLiveCaption('');
        updateUi();
    };

    const resumeSessionRecording = (silent = false) => {
        if (!state.active || !state.paused) return;
        const currentNow = now();
        if (state.pauseStartedAt) state.pausedAccumMs += Math.max(0, currentNow - state.pauseStartedAt);
        state.paused = false;
        state.pauseStartedAt = 0;
        if (state.mediaRecorder && state.mediaRecorder.state === 'paused' && typeof state.mediaRecorder.resume === 'function') {
            try { state.mediaRecorder.resume(); } catch (_) {}
        }
        if (!silent) startSpeechRecognition();
        if (!silent) {
            const index = getCurrentIndex();
            const fragmentIndex = getCurrentFragmentIndex();
            recordEvent('record:resume', { index, fragmentIndex });
            recordEvent('goTo', { index });
            if (fragmentIndex >= 0) recordEvent('fragment', { slideIndex: index, fragmentIndex, hidden: false });
            recordEvent('black', { on: !!getBlackScreen() });
        }
        updateUi();
    };

    const stopReplay = () => {
        state.replayTimers.forEach(timer => clearTimeoutFn(timer));
        state.replayTimers = [];
        if (state.replayAudio) {
            const replaySrc = state.replayAudio.src || '';
            try { state.replayAudio.pause(); } catch (_) {}
            if (replaySrc.startsWith('blob:')) {
                try { URL.revokeObjectURL(replaySrc); } catch (_) {}
            }
            state.replayAudio = null;
        }
        state.replaying = false;
        updateUi();
    };

    const buildSessionSnapshot = () => {
        const startedAt = state.startAt || now();
        const endedAt = state.stopAt || now();
        const effectiveDurationMs = recordElapsedMs(endedAt);
        return {
            version: 2,
            createdAt: new Date(startedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            durationMs: Math.max(0, effectiveDurationMs),
            wallDurationMs: Math.max(0, endedAt - startedAt),
            pausedMs: Math.max(0, (endedAt - startedAt) - effectiveDurationMs),
            presentation: {
                title: String(params.title || ''),
                source: String(params.sourceFile || '__draft__'),
                slideCount: Array.isArray(params.slides) ? params.slides.length : 0,
            },
            events: state.events.slice(),
            captions: state.captions.slice(),
            autoNotesBySlide: JSON.parse(JSON.stringify(state.autoNotesBySlide || {})),
            hasAudio: !!state.audioBlob,
            audioMimeType: state.audioMimeType || 'audio/webm',
            audioBitsPerSecond: Number(state.audioBitsPerSecond || state.audioTargetBitsPerSecond || 0) || 0,
            audioCodec: state.audioCodecLabel || '',
        };
    };

    const startSessionRecording = async () => {
        if (state.active) return;
        stopReplay();
        state.exportMessage = '';
        setLiveCaption('');
        state.active = true;
        state.paused = false;
        state.startAt = now();
        state.stopAt = 0;
        state.pausedAccumMs = 0;
        state.pauseStartedAt = 0;
        state.events = [];
        state.captions = [];
        state.autoNotesBySlide = {};
        state.audioChunks = [];
        state.audioBlob = null;
        state.audioBitsPerSecond = 0;
        state.audioCodecLabel = '';
        state.lastSession = null;
        recordEvent('record:start', {
            index: getCurrentIndex(),
            fragmentIndex: getCurrentFragmentIndex(),
        });
        updateUi();

        if (nav?.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
            try {
                state.mediaStream = await nav.mediaDevices.getUserMedia({ audio: recordingAudioConstraints });
                const recorderSetup = createCompressedRecorder(state.mediaStream);
                state.mediaRecorder = recorderSetup.recorder;
                state.audioMimeType = recorderSetup.mimeType || 'audio/webm';
                state.audioBitsPerSecond = Number(recorderSetup.bitsPerSecond || recordAudioTargetBps) || recordAudioTargetBps;
                state.audioCodecLabel = audioCodecLabelFromMime(state.audioMimeType);
                state.mediaRecorder.ondataavailable = ev => {
                    if (ev.data && ev.data.size > 0) state.audioChunks.push(ev.data);
                };
                state.mediaRecorder.onstop = () => {
                    if (state.audioChunks.length) {
                        state.audioBlob = new Blob(state.audioChunks, {
                            type: state.audioMimeType || 'audio/webm',
                        });
                    }
                    if (state.lastSession) {
                        state.lastSession.hasAudio = !!state.audioBlob;
                        state.lastSession.audioMimeType = state.audioMimeType || 'audio/webm';
                        state.lastSession.audioBitsPerSecond = Number(state.audioBitsPerSecond || recordAudioTargetBps) || recordAudioTargetBps;
                        state.lastSession.audioCodec = state.audioCodecLabel || audioCodecLabelFromMime(state.audioMimeType);
                    }
                    updateUi();
                };
                state.mediaRecorder.start(1000);
            } catch (err) {
                console.warn('Session recording audio setup fallback:', err?.message || err);
                state.mediaStream = null;
                state.mediaRecorder = null;
                state.audioMimeType = 'audio/webm';
                state.audioBitsPerSecond = 0;
                state.audioCodecLabel = '';
            }
        }
        startSpeechRecognition();
        updateUi();
    };

    const stopSessionRecording = () => {
        if (!state.active) return;
        if (state.paused) resumeSessionRecording(true);
        recordEvent('record:stop', {
            index: getCurrentIndex(),
            fragmentIndex: getCurrentFragmentIndex(),
        });
        state.active = false;
        state.paused = false;
        state.exportMessage = '';
        state.stopAt = now();
        if (state.labelTimer) {
            clearTimeoutFn(state.labelTimer);
            state.labelTimer = null;
        }
        stopSpeechRecognition();
        if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
            try { state.mediaRecorder.stop(); } catch (_) {}
        }
        state.mediaRecorder = null;
        if (state.mediaStream) {
            try { state.mediaStream.getTracks().forEach(track => track.stop()); } catch (_) {}
            state.mediaStream = null;
        }
        state.lastSession = buildSessionSnapshot();
        setLiveCaption('');
        updateUi();
        renderCurrentSlide();
    };

    const applyReplayEvent = entry => {
        if (!entry || typeof entry !== 'object') return;
        const type = String(entry.type || '');
        const payload = (entry.payload && typeof entry.payload === 'object') ? entry.payload : {};
        if (type === 'goTo' && Number.isFinite(Number(payload.index))) {
            goTo(Math.trunc(Number(payload.index)));
            return;
        }
        if (type === 'fragment') {
            const currentIndex = getCurrentIndex();
            const targetSlide = Number.isFinite(Number(payload.slideIndex))
                ? Math.trunc(Number(payload.slideIndex))
                : currentIndex;
            if (targetSlide !== currentIndex) goTo(targetSlide);
            const container = getCurrentInnerContainer();
            if (!container) return;
            const frags = Array.isArray(getFragments(container)) ? getFragments(container) : [];
            const fragIdx = Number.isFinite(Number(payload.fragmentIndex)) ? Math.trunc(Number(payload.fragmentIndex)) : -1;
            const hidden = !!payload.hidden;
            if (hidden && fragIdx >= 0 && fragIdx < frags.length) {
                frags[fragIdx].classList.remove('visible');
                setCurrentFragmentIndex(Math.max(-1, fragIdx - 1));
            } else if (!hidden && fragIdx >= 0 && fragIdx < frags.length) {
                frags[fragIdx].classList.add('visible');
                setCurrentFragmentIndex(Math.max(getCurrentFragmentIndex(), fragIdx));
            }
            return;
        }
        if (type === 'black') {
            setBlackScreen(!!payload.on);
        }
    };

    const startReplaySession = () => {
        if (!state.lastSession || state.active) return;
        if (state.replaying) {
            stopReplay();
            return;
        }
        state.replaying = true;
        updateUi();
        const events = Array.isArray(state.lastSession.events) ? state.lastSession.events : [];
        events.forEach(entry => {
            const delay = Math.max(0, Number(entry?.t || 0));
            const timer = setTimeoutFn(() => applyReplayEvent(entry), delay);
            state.replayTimers.push(timer);
        });
        const totalMs = Math.max(0, Number(state.lastSession.durationMs || 0));
        state.replayTimers.push(setTimeoutFn(() => stopReplay(), totalMs + 150));
        if (state.audioBlob) {
            try {
                const audio = new Audio(URL.createObjectURL(state.audioBlob));
                state.replayAudio = audio;
                audio.onended = () => {
                    try { URL.revokeObjectURL(audio.src); } catch (_) {}
                    if (state.replayAudio === audio) state.replayAudio = null;
                };
                audio.play().catch(() => {});
            } catch (_) {}
        }
    };

    const ensureAudioBlobForExport = () => {
        if (!state.audioBlob && state.audioChunks.length) {
            state.audioBlob = new Blob(state.audioChunks, {
                type: state.audioMimeType || 'audio/webm',
            });
            if (state.lastSession) {
                state.lastSession.hasAudio = true;
                state.lastSession.audioMimeType = state.audioMimeType || 'audio/webm';
                state.lastSession.audioBitsPerSecond = Number(state.audioBitsPerSecond || recordAudioTargetBps) || recordAudioTargetBps;
                state.lastSession.audioCodec = state.audioCodecLabel || audioCodecLabelFromMime(state.audioMimeType);
            }
        }
    };

    const exportSessionRecording = () => {
        if (state.active) stopSessionRecording();
        if (!state.lastSession) return;
        ensureAudioBlobForExport();
        const slideCount = Array.isArray(params.slides) ? params.slides.length : 0;
        const sessionExport = params.normalizeReplaySessionExport(state.lastSession, {
            title: String(params.title || ''),
            slideCount,
            hasAudio: !!state.audioBlob,
            audioMimeType: state.audioMimeType || 'audio/webm',
            audioCodec: state.audioCodecLabel || audioCodecLabelFromMime(state.audioMimeType),
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const base = `${safeFilePart(params.title)}-${stamp}`;
        const jsonBlob = new Blob([JSON.stringify(sessionExport, null, 2)], { type: 'application/json' });
        downloadBlob(jsonBlob, `${base}.json`);
        if (state.audioBlob) {
            const ext = audioExtFromMime(state.audioMimeType);
            downloadBlob(state.audioBlob, `${base}.${ext}`);
        }
    };

    const buildReplayStandaloneHtml = ({ session, audioDataUrl = '' }) => {
        return params.buildReplayStandaloneHtmlFn({
            title: String(params.title || ''),
            slides: Array.isArray(params.slides) ? params.slides : [],
            data: params.data,
            session,
            audioDataUrl,
            themeCss: (typeof params.getThemeCss === 'function') ? params.getThemeCss() : '',
            slidesRenderer: params.slidesRenderer,
            slidesShared: params.slidesShared,
        });
    };

    const exportReplayStandalone = async () => {
        if (state.exportBusy) return;
        if (state.active) stopSessionRecording();
        if (!state.lastSession) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const base = `${safeFilePart(params.title)}-replay-${stamp}`;
        state.exportBusy = true;
        setExportMessage('Préparation du replay HTML…');
        try {
            const saveTarget = await prepareSaveTarget(`${base}.html`, 'text/html', '.html');
            if (saveTarget?.kind === 'cancel') {
                setExportMessage('Export replay annulé');
                return;
            }
            ensureAudioBlobForExport();
            const audioDataUrl = await blobToDataUrl(state.audioBlob);
            const html = buildReplayStandaloneHtml({
                session: state.lastSession,
                audioDataUrl,
            });
            const htmlBlob = new Blob([html], { type: 'text/html' });
            const saved = await saveBlob(saveTarget, htmlBlob, `${base}.html`);
            setExportMessage(saved ? 'Replay HTML exporté' : 'Export replay annulé');
        } catch (err) {
            console.error('Replay export error:', err);
            setExportMessage(`Erreur export replay: ${err?.message || 'inconnue'}`);
        } finally {
            state.exportBusy = false;
            updateUi();
        }
    };

    return {
        state,
        setExportMessage,
        setLiveCaption,
        updateUi,
        recordEvent,
        pauseSessionRecording,
        resumeSessionRecording,
        startSessionRecording,
        stopSessionRecording,
        startReplaySession,
        stopReplay,
        exportSessionRecording,
        exportReplayStandalone,
    };
}

export const testUtils = Object.freeze({
    safeFilePart,
    audioExtFromMime,
    audioCodecLabelFromMime,
    audioBitrateLabel,
});

