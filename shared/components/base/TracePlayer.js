/**
 * TracePlayer — moteur de lecture partagé pour les visualisations pilotées par trace.
 *
 * Consomme un tableau de « pas » (`Step[]`) produit par un générateur pur et pilote
 * un curseur : play / pause / pas-avant / pas-arrière / seek / reset. Aucune
 * connaissance du DOM ni de l'algorithme — le rendu de chaque pas est délégué via
 * la fonction `render` injectée.
 *
 * Utilisé à l'identique par l'adaptateur page (`SimulationPage`) et l'adaptateur
 * slide (`*Widget.mount`). Côté page, `getDelay` lit le `SpeedController` (le
 * curseur de vitesse agit donc en direct) ; côté slide, `getDelay` renvoie une
 * constante propre au widget (cadence historique inchangée).
 *
 * @typedef {Object} TracePlayerState
 * @property {number} cursor   index du pas courant
 * @property {number} total    nombre de pas
 * @property {boolean} playing  lecture automatique en cours
 * @property {boolean} atStart  curseur sur le premier pas
 * @property {boolean} atEnd    curseur sur le dernier pas
 */
class TracePlayer {
    /**
     * @param {Object}   opts
     * @param {() => Array}            opts.getSteps       renvoie le `Step[]` courant (résolu paresseusement)
     * @param {(step: any, ctx: {cursor:number,total:number}) => void} opts.render  dessine un pas
     * @param {() => number}           opts.getDelay       délai (ms) avant le pas suivant en lecture auto
     * @param {(lineId: string|null) => void} [opts.onLine]        surlignage pseudocode (page uniquement)
     * @param {(state: TracePlayerState) => void} [opts.onStateChange] notifié à chaque changement d'état
     */
    constructor(opts = {}) {
        this.getSteps = typeof opts.getSteps === 'function' ? opts.getSteps : () => [];
        this._render = typeof opts.render === 'function' ? opts.render : () => {};
        this.getDelay = typeof opts.getDelay === 'function' ? opts.getDelay : () => 500;
        this.onLine = typeof opts.onLine === 'function' ? opts.onLine : null;
        this.onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : null;

        this.steps = [];
        this.cursor = 0;
        this.playing = false;
        this._timer = null;
        this._destroyed = false;
    }

    /** Charge le `Step[]` courant et affiche le pas 0. */
    attach() {
        this.steps = this.getSteps() || [];
        this.cursor = 0;
        this.playing = false;
        this._clearTimer();
        this._renderCurrent();
    }

    get total() {
        return this.steps.length;
    }

    _atEnd() {
        return this.cursor >= this.steps.length - 1;
    }

    _atStart() {
        return this.cursor <= 0;
    }

    /** Lance la lecture automatique (redémarre du début si la trace est terminée). */
    play() {
        if (this._destroyed || this.playing || !this.steps.length) return;
        if (this._atEnd()) {
            this.cursor = 0;
            this._renderCurrent();
        }
        this.playing = true;
        this._emitState();
        this._scheduleTick();
    }

    /** Met la lecture en pause. */
    pause() {
        if (!this.playing) {
            this._emitState();
            return;
        }
        this.playing = false;
        this._clearTimer();
        this._emitState();
    }

    toggle() {
        if (this.playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    /** Avance d'un pas et met en pause. Butée sur le dernier pas. */
    stepForward() {
        this.pause();
        if (this.cursor < this.steps.length - 1) {
            this.cursor += 1;
            this._renderCurrent();
        } else {
            this._emitState();
        }
    }

    /** Recule d'un pas et met en pause. Butée sur le premier pas. */
    stepBack() {
        this.pause();
        if (this.cursor > 0) {
            this.cursor -= 1;
            this._renderCurrent();
        } else {
            this._emitState();
        }
    }

    /** Positionne le curseur sur un pas arbitraire (clampé), en pause. */
    seek(index) {
        if (!this.steps.length) return;
        this.pause();
        const max = this.steps.length - 1;
        const target = Number.isFinite(index) ? Math.trunc(index) : 0;
        this.cursor = Math.max(0, Math.min(max, target));
        this._renderCurrent();
    }

    /** Recharge le `Step[]` (nouvelle entrée), curseur à 0, en pause. */
    reset() {
        this.playing = false;
        this._clearTimer();
        this.steps = this.getSteps() || [];
        this.cursor = 0;
        this._renderCurrent();
    }

    /** Libère le timer et coupe toutes les références (fin de vie). */
    destroy() {
        this._destroyed = true;
        this.playing = false;
        this._clearTimer();
        this.getSteps = () => [];
        this._render = () => {};
        this.onLine = null;
        this.onStateChange = null;
        this.steps = [];
    }

    // ── interne ──────────────────────────────────────────────────────────────

    _scheduleTick() {
        this._clearTimer();
        const delay = Math.max(0, Number(this.getDelay()) || 0);
        this._timer = setTimeout(() => this._tick(), delay);
    }

    _tick() {
        this._timer = null;
        if (this._destroyed || !this.playing) return;
        if (this._atEnd()) {
            this.pause();
            return;
        }
        this.cursor += 1;
        this._renderCurrent();
        if (this._atEnd()) {
            this.pause();
            return;
        }
        this._scheduleTick();
    }

    _renderCurrent() {
        const step = this.steps[this.cursor] || null;
        try {
            this._render(step, { cursor: this.cursor, total: this.steps.length });
        } finally {
            if (this.onLine) this.onLine(step ? (step.line || null) : null);
            this._emitState();
        }
    }

    _emitState() {
        if (!this.onStateChange) return;
        this.onStateChange({
            cursor: this.cursor,
            total: this.steps.length,
            playing: this.playing,
            atStart: this._atStart(),
            atEnd: this._atEnd()
        });
    }

    _clearTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }
}

// Export module (tests Node) — le fichier reste un script classique côté navigateur.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TracePlayer;
}
if (typeof window !== 'undefined') {
    window.TracePlayer = TracePlayer;
}
