/**
 * @throws {Error} Peut lever une erreur de chargement si le module est execute hors contexte navigateur.
 * @module slides/editor-narration
 * @public
 * @internal Module Slides charge cote navigateur.
 * @typedef {Object} OeiDocMarker
 * @property {string} scope - Portee documentaire du module.
 * @deprecated Type provisoire documentant un module legacy en migration.
 * @example
 * // Chargement navigateur:
 * // <script src="../shared/slides/editor-narration.js"></script>
 */
/* editor-narration.js - Per-slide audio narration recording using MediaRecorder API */

const Storage = window.OEIStorage || null;
const NARRATION_SETTINGS_KEY = Storage?.KEYS?.SLIDE_NARRATION_SETTINGS || 'oei-slide-narration-settings';
const MEDIA_PIPELINE_SETTINGS_KEY = Storage?.KEYS?.MEDIA_PIPELINE_SETTINGS || 'oei-media-pipeline-settings';
const NARRATION_DEFAULTS = Object.freeze({
    profile: 'balanced',
    bitrateKbps: 64,
});
const NARRATION_PROFILES = Object.freeze({
    compact: 40,
    balanced: 64,
    high: 96,
    studio: 128,
});
const NARRATION_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4;codecs=mp4a.40.2',
];

let _narrationStream = null;
let _narrationRecorder = null;
let _narrationChunks = [];
let _narrationSlideIdx = -1;
let _narrationStartTime = 0;
let _narrationSettings = _loadNarrationSettings();
let _narrationLastMeta = { mimeType: '', bitrateKbps: NARRATION_DEFAULTS.bitrateKbps };

function _readStorageJSON(key, fallback) {
    if (!key) return fallback;
    if (typeof Storage?.getJSON === 'function') return Storage.getJSON(key, fallback);
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

function _writeStorageJSON(key, value) {
    if (!key) return;
    if (typeof Storage?.setJSON === 'function') {
        Storage.setJSON(key, value);
        return;
    }
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
}

function _loadMediaPipelineSettings() {
    const raw = _readStorageJSON(MEDIA_PIPELINE_SETTINGS_KEY, null) || {};
    return (raw && typeof raw === 'object') ? raw : {};
}

function _saveMediaPipelinePatch(patch = {}) {
    const current = _loadMediaPipelineSettings();
    const next = { ...current, ...(patch || {}) };
    _writeStorageJSON(MEDIA_PIPELINE_SETTINGS_KEY, next);
}

function _loadNarrationSettings() {
    const raw = _readStorageJSON(NARRATION_SETTINGS_KEY, null) || {};
    const media = _loadMediaPipelineSettings();
    const mediaProfile = String(media.profile || '');
    const fallbackProfile = Object.prototype.hasOwnProperty.call(NARRATION_PROFILES, mediaProfile)
        ? mediaProfile
        : NARRATION_DEFAULTS.profile;
    const profile = String(raw.profile || fallbackProfile);
    const fromProfile = NARRATION_PROFILES[profile] || NARRATION_DEFAULTS.bitrateKbps;
    const mediaBitrate = Number(media.narrationBitrateKbps);
    const bitrateKbps = Math.max(
        16,
        Math.min(
            256,
            Math.round(
                Number(raw.bitrateKbps)
                || (Number.isFinite(mediaBitrate) ? mediaBitrate : 0)
                || fromProfile
            )
        )
    );
    return {
        profile: Object.prototype.hasOwnProperty.call(NARRATION_PROFILES, profile) ? profile : NARRATION_DEFAULTS.profile,
        bitrateKbps,
    };
}

function _saveNarrationSettings() {
    _writeStorageJSON(NARRATION_SETTINGS_KEY, _narrationSettings);
    const mediaProfile = _narrationSettings.profile === 'studio'
        ? 'high'
        : (Object.prototype.hasOwnProperty.call(NARRATION_PROFILES, _narrationSettings.profile)
            ? _narrationSettings.profile
            : 'balanced');
    _saveMediaPipelinePatch({
        profile: mediaProfile,
        narrationBitrateKbps: Number(_narrationSettings.bitrateKbps) || NARRATION_DEFAULTS.bitrateKbps,
    });
}

function _pickNarrationMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
    for (const candidate of NARRATION_MIME_CANDIDATES) {
        try {
            if (MediaRecorder.isTypeSupported(candidate)) return candidate;
        } catch (_) {}
    }
    return '';
}

function _buildRecorder(stream) {
    const mimeType = _pickNarrationMimeType();
    const bitrateKbps = Math.max(16, Math.min(256, Math.round(Number(_narrationSettings.bitrateKbps) || NARRATION_DEFAULTS.bitrateKbps)));
    const bitrate = bitrateKbps * 1000;

    const withAll = {};
    if (mimeType) withAll.mimeType = mimeType;
    withAll.audioBitsPerSecond = bitrate;

    let recorder = null;
    try {
        recorder = new MediaRecorder(stream, withAll);
    } catch (_) {
        const withMimeOnly = {};
        if (mimeType) withMimeOnly.mimeType = mimeType;
        try {
            recorder = new MediaRecorder(stream, withMimeOnly);
        } catch (_) {
            recorder = new MediaRecorder(stream);
        }
    }

    _narrationLastMeta = {
        mimeType: recorder?.mimeType || mimeType || 'audio/webm',
        bitrateKbps,
    };
    return recorder;
}

function _syncNarrationEncodingUI() {
    const profileEl = document.getElementById('narration-enc-profile');
    const bitrateEl = document.getElementById('narration-enc-bitrate');
    if (!profileEl || !bitrateEl) return;
    profileEl.value = _narrationSettings.profile;
    bitrateEl.value = String(_narrationSettings.bitrateKbps);
}

function _bindNarrationEncodingUI() {
    const profileEl = document.getElementById('narration-enc-profile');
    const bitrateEl = document.getElementById('narration-enc-bitrate');
    if (!profileEl || !bitrateEl) return;

    profileEl.addEventListener('change', () => {
        const profile = String(profileEl.value || NARRATION_DEFAULTS.profile);
        _narrationSettings.profile = Object.prototype.hasOwnProperty.call(NARRATION_PROFILES, profile)
            ? profile
            : NARRATION_DEFAULTS.profile;
        const preset = NARRATION_PROFILES[_narrationSettings.profile] || NARRATION_DEFAULTS.bitrateKbps;
        _narrationSettings.bitrateKbps = preset;
        bitrateEl.value = String(preset);
        _saveNarrationSettings();
    });

    bitrateEl.addEventListener('change', () => {
        const n = Math.max(16, Math.min(256, Math.round(Number(bitrateEl.value) || NARRATION_DEFAULTS.bitrateKbps)));
        _narrationSettings.bitrateKbps = n;
        bitrateEl.value = String(n);
        _saveNarrationSettings();
    });
}

/**
 * Initialize narration controls in the notes panel area.
 */
function initNarration() {
    const target = document.getElementById('notes-right');
    if (!target) return;

    const controls = document.createElement('div');
    controls.id = 'narration-controls';
    controls.className = 'narration-controls';
    controls.innerHTML = `
        <div class="narration-header">
            <span class="narration-label">🎙 Narration</span>
            <span class="narration-timer" id="narration-timer">00:00</span>
        </div>
        <div class="narration-buttons">
            <button class="tb-btn ui-btn narration-btn" id="btn-narration-record" title="Enregistrer la narration pour ce slide">
                <span class="narration-rec-dot"></span> Enregistrer
            </button>
            <button class="tb-btn ui-btn narration-btn" id="btn-narration-stop" title="Arrêter l'enregistrement" style="display:none">
                ⏹ Arrêter
            </button>
            <button class="tb-btn ui-btn narration-btn" id="btn-narration-play" title="Écouter la narration" style="display:none">
                ▶ Écouter
            </button>
            <button class="tb-btn ui-btn narration-btn" id="btn-narration-delete" title="Supprimer la narration" style="display:none">
                🗑
            </button>
        </div>
        <div class="narration-encoding">
            <label class="narration-enc-label" for="narration-enc-profile">Encodage</label>
            <select id="narration-enc-profile" class="narration-enc-select">
                <option value="compact">Compact</option>
                <option value="balanced">Equilibre</option>
                <option value="high">Haute qualite</option>
                <option value="studio">Studio</option>
            </select>
            <label class="narration-enc-label" for="narration-enc-bitrate">kbps</label>
            <input id="narration-enc-bitrate" class="narration-enc-input" type="number" min="16" max="256" step="8" />
        </div>
        <div class="narration-status" id="narration-status"></div>
        <audio id="narration-audio" style="display:none"></audio>
    `;
    target.appendChild(controls);

    document.getElementById('btn-narration-record').addEventListener('click', startNarrationRecording);
    document.getElementById('btn-narration-stop').addEventListener('click', stopNarrationRecording);
    document.getElementById('btn-narration-play').addEventListener('click', playNarration);
    document.getElementById('btn-narration-delete').addEventListener('click', deleteNarration);

    _syncNarrationEncodingUI();
    _bindNarrationEncodingUI();
}

/**
 * Update narration UI when slide changes.
 */
function updateNarrationUI() {
    const slide = editor.currentSlide;
    const playBtn = document.getElementById('btn-narration-play');
    const delBtn = document.getElementById('btn-narration-delete');
    const status = document.getElementById('narration-status');
    if (!playBtn || !delBtn || !status) return;

    const hasAudio = !!(slide?.narration);
    playBtn.style.display = hasAudio ? '' : 'none';
    delBtn.style.display = hasAudio ? '' : 'none';

    if (hasAudio) {
        const duration = slide.narrationDuration ? Math.round(slide.narrationDuration) + 's' : '';
        const mime = String(slide?.narrationMeta?.mimeType || '').trim();
        const kbps = Number(slide?.narrationMeta?.bitrateKbps || 0);
        const enc = [mime, kbps > 0 ? `${kbps} kbps` : ''].filter(Boolean).join(' · ');
        status.textContent = `Narration enregistrée ${duration}${enc ? ` (${enc})` : ''}`;
        status.className = 'narration-status has-narration';
    } else {
        status.textContent = 'Pas de narration';
        status.className = 'narration-status';
    }
}

async function startNarrationRecording() {
    if (typeof MediaRecorder === 'undefined') {
        notify('MediaRecorder non supporte par ce navigateur', 'error');
        return;
    }
    try {
        _narrationStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        notify('Accès au microphone refusé', 'error');
        return;
    }

    _narrationSlideIdx = editor.selectedIndex;
    _narrationChunks = [];
    _narrationRecorder = _buildRecorder(_narrationStream);

    _narrationRecorder.ondataavailable = e => {
        if (e.data.size > 0) _narrationChunks.push(e.data);
    };

    _narrationRecorder.onstop = () => {
        const blob = new Blob(_narrationChunks, { type: _narrationRecorder.mimeType || _narrationLastMeta.mimeType || 'audio/webm' });
        _saveNarrationBlob(blob, _narrationSlideIdx);
        _stopStream();
    };

    _narrationRecorder.start(100);
    _narrationStartTime = Date.now();
    _updateRecordingTimer();

    document.getElementById('btn-narration-record').style.display = 'none';
    document.getElementById('btn-narration-stop').style.display = '';
    const status = document.getElementById('narration-status');
    if (status) {
        const fmt = _narrationLastMeta.mimeType || 'audio/webm';
        const kbps = Number(_narrationLastMeta.bitrateKbps || _narrationSettings.bitrateKbps || NARRATION_DEFAULTS.bitrateKbps);
        status.textContent = `Enregistrement en cours… (${fmt}, ${kbps} kbps)`;
        status.className = 'narration-status recording';
    }
    notify('Enregistrement démarré', 'success');
}

function stopNarrationRecording() {
    if (_narrationRecorder && _narrationRecorder.state === 'recording') {
        _narrationRecorder.stop();
    }
    document.getElementById('btn-narration-record').style.display = '';
    document.getElementById('btn-narration-stop').style.display = 'none';
}

function _stopStream() {
    if (_narrationStream) {
        _narrationStream.getTracks().forEach(t => t.stop());
        _narrationStream = null;
    }
}

let _recTimerInterval = null;
function _updateRecordingTimer() {
    clearInterval(_recTimerInterval);
    _recTimerInterval = setInterval(() => {
        if (!_narrationRecorder || _narrationRecorder.state !== 'recording') {
            clearInterval(_recTimerInterval);
            const timer = document.getElementById('narration-timer');
            if (timer) timer.textContent = '00:00';
            return;
        }
        const elapsed = Math.floor((Date.now() - _narrationStartTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        const timer = document.getElementById('narration-timer');
        if (timer) timer.textContent = `${min}:${sec}`;
    }, 500);
}

async function _saveNarrationBlob(blob, slideIdx) {
    const reader = new FileReader();
    reader.onloadend = () => {
        const slide = editor.data.slides[slideIdx];
        if (slide) {
            slide.narration = reader.result;
            slide.narrationDuration = (Date.now() - _narrationStartTime) / 1000;
            slide.narrationMeta = {
                mimeType: String(blob?.type || _narrationLastMeta.mimeType || ''),
                bitrateKbps: Number(_narrationLastMeta.bitrateKbps || _narrationSettings.bitrateKbps || NARRATION_DEFAULTS.bitrateKbps),
                recordedAt: Date.now(),
            };
            editor._push();
            updateNarrationUI();
            notify('Narration sauvegardée', 'success');
        }
    };
    reader.readAsDataURL(blob);
}

function playNarration() {
    const slide = editor.currentSlide;
    if (!slide?.narration) return;

    const audio = document.getElementById('narration-audio');
    if (!audio) return;

    const playBtn = document.getElementById('btn-narration-play');

    if (audio.src && !audio.paused && audio.currentTime > 0) {
        audio.pause();
        playBtn.textContent = '▶ Écouter';
        return;
    }

    if (!audio.src || audio.src !== slide.narration) {
        audio.src = slide.narration;
    }
    audio.play().catch(err => {
        notify('Erreur de lecture : ' + err.message, 'error');
    });

    playBtn.textContent = '⏸ Pause';
    audio.onended = () => {
        playBtn.textContent = '▶ Écouter';
    };
}

async function deleteNarration() {
    if (!await OEIDialog.confirm('Supprimer la narration de ce slide ?', { danger: true })) return;
    const slide = editor.currentSlide;
    if (slide) {
        delete slide.narration;
        delete slide.narrationDuration;
        delete slide.narrationMeta;
        editor._push();
        updateNarrationUI();

        const audio = document.getElementById('narration-audio');
        if (audio) {
            audio.pause();
            audio.src = '';
        }

        notify('Narration supprimée', 'success');
    }
}

window.initNarration = initNarration;
window.updateNarrationUI = updateNarrationUI;
