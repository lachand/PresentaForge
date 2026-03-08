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
/* editor-narration.js — Per-slide audio narration recording using MediaRecorder API */

let _narrationStream = null;
let _narrationRecorder = null;
let _narrationChunks = [];
let _narrationSlideIdx = -1;
let _narrationStartTime = 0;

/**
 * Initialize narration controls in the notes panel area.
 */
function initNarration() {
    const target = document.getElementById('notes-right');
    if (!target) return;

    // Add narration controls in the right panel
    const controls = document.createElement('div');
    controls.id = 'narration-controls';
    controls.className = 'narration-controls';
    controls.innerHTML = `
        <div class="narration-header">
            <span class="narration-label">🎙 Narration</span>
            <span class="narration-timer" id="narration-timer">00:00</span>
        </div>
        <div class="narration-buttons">
            <button class="tb-btn narration-btn" id="btn-narration-record" title="Enregistrer la narration pour ce slide">
                <span class="narration-rec-dot"></span> Enregistrer
            </button>
            <button class="tb-btn narration-btn" id="btn-narration-stop" title="Arrêter l'enregistrement" style="display:none">
                ⏹ Arrêter
            </button>
            <button class="tb-btn narration-btn" id="btn-narration-play" title="Écouter la narration" style="display:none">
                ▶ Écouter
            </button>
            <button class="tb-btn narration-btn" id="btn-narration-delete" title="Supprimer la narration" style="display:none">
                🗑
            </button>
        </div>
        <div class="narration-status" id="narration-status"></div>
        <audio id="narration-audio" style="display:none"></audio>
    `;
    target.appendChild(controls);

    document.getElementById('btn-narration-record').addEventListener('click', startNarrationRecording);
    document.getElementById('btn-narration-stop').addEventListener('click', stopNarrationRecording);
    document.getElementById('btn-narration-play').addEventListener('click', playNarration);
    document.getElementById('btn-narration-delete').addEventListener('click', deleteNarration);
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
        status.textContent = `Narration enregistrée ${duration}`;
        status.className = 'narration-status has-narration';
    } else {
        status.textContent = 'Pas de narration';
        status.className = 'narration-status';
    }
}

async function startNarrationRecording() {
    try {
        _narrationStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        notify('Accès au microphone refusé', 'error');
        return;
    }

    _narrationSlideIdx = editor.selectedIndex;
    _narrationChunks = [];
    _narrationRecorder = new MediaRecorder(_narrationStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm'
    });

    _narrationRecorder.ondataavailable = e => {
        if (e.data.size > 0) _narrationChunks.push(e.data);
    };

    _narrationRecorder.onstop = () => {
        const blob = new Blob(_narrationChunks, { type: _narrationRecorder.mimeType });
        _saveNarrationBlob(blob, _narrationSlideIdx);
        _stopStream();
    };

    _narrationRecorder.start(100); // collect data every 100ms
    _narrationStartTime = Date.now();
    _updateRecordingTimer();

    // Update UI
    document.getElementById('btn-narration-record').style.display = 'none';
    document.getElementById('btn-narration-stop').style.display = '';
    document.getElementById('narration-status').textContent = 'Enregistrement en cours…';
    document.getElementById('narration-status').className = 'narration-status recording';
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
            document.getElementById('narration-timer').textContent = '00:00';
            return;
        }
        const elapsed = Math.floor((Date.now() - _narrationStartTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        document.getElementById('narration-timer').textContent = `${min}:${sec}`;
    }, 500);
}

async function _saveNarrationBlob(blob, slideIdx) {
    // Convert blob to base64 data URL for JSON storage
    const reader = new FileReader();
    reader.onloadend = () => {
        const slide = editor.data.slides[slideIdx];
        if (slide) {
            slide.narration = reader.result;
            slide.narrationDuration = (Date.now() - _narrationStartTime) / 1000;
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

    // Toggle: if already playing this narration, pause it
    if (audio.src && !audio.paused && audio.currentTime > 0) {
        audio.pause();
        playBtn.textContent = '▶ Écouter';
        return;
    }

    // Start or resume playback
    if (!audio.src || audio.src !== slide.narration) {
        audio.src = slide.narration;
    }
    audio.play().catch(err => {
        notify('Erreur de lecture : ' + err.message, 'error');
    });

    playBtn.textContent = '⏸ Pause';
    audio.onended = () => { playBtn.textContent = '▶ Écouter'; };
}

async function deleteNarration() {
    if (!await OEIDialog.confirm('Supprimer la narration de ce slide ?', { danger: true })) return;
    const slide = editor.currentSlide;
    if (slide) {
        delete slide.narration;
        delete slide.narrationDuration;
        editor._push();
        updateNarrationUI();

        const audio = document.getElementById('narration-audio');
        if (audio) { audio.pause(); audio.src = ''; }

        notify('Narration supprimée', 'success');
    }
}

window.initNarration = initNarration;
window.updateNarrationUI = updateNarrationUI;
