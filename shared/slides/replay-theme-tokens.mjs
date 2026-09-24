// @ts-check
/**
 * Source de vérité des couleurs du lecteur de replay standalone (préfixe
 * CSS `--rp-*`), dérivées des tokens Forge (`shared/slides/ui-primitives.css`
 * `:root`/`[data-theme="dark"]`) au lieu d'une palette bleu/slate sans rapport
 * codée en dur. Consommé par slides/viewer/replay-standalone-export.js —
 * le fichier HTML exporté reste un document unique et autonome (ces valeurs
 * sont lues à la génération, pas chargées depuis ce module au moment de la
 * lecture par le destinataire).
 *
 * Le lecteur live (`.pv-rec-*` dans slides-viewer.css) est une UI distincte
 * (badge d'état d'enregistrement, pas un lecteur de replay complet) — il n'y
 * a pas de DOM/CSS à fusionner, seulement les valeurs de couleur à aligner.
 */

export const REPLAY_DARK_TOKENS = {
    bg: '#131318',
    text: '#e5e4ee',
    muted: '#c6c6d2',
    surface: '#0f0f13',
    surfaceHover: '#26262f',
    surfaceSoft: '#1b1b22',
    border: '#3a3a45',
    stageBg: '#17171d',
    accent: '#b6c4ff',
};

export const REPLAY_LIGHT_TOKENS = {
    bg: '#faf8ff',
    text: '#1a1b21',
    muted: '#444651',
    surface: '#ffffff',
    surfaceHover: '#e9e7ef',
    surfaceSoft: '#eeedf4',
    border: '#c5c5d3',
    stageBg: '#f4f3fa',
    accent: '#1e3a8a',
};

/** Génère le bloc `:root{...}` (sombre) + `.rp-light{...}` à partir des tokens ci-dessus. */
export function buildReplayThemeCss() {
    const cssVars = (tokens) => `
    --rp-bg:${tokens.bg};
    --rp-text:${tokens.text};
    --rp-muted:${tokens.muted};
    --rp-surface:${tokens.surface};
    --rp-surface-hover:${tokens.surfaceHover};
    --rp-surface-soft:${tokens.surfaceSoft};
    --rp-border:${tokens.border};
    --rp-stage-bg:${tokens.stageBg};
    --rp-accent:${tokens.accent};`;
    return `:root{${cssVars(REPLAY_DARK_TOKENS)}
    --rp-black:rgba(0,0,0,.92);
}
body.rp-light{${cssVars(REPLAY_LIGHT_TOKENS)}
    --rp-black:rgba(15,23,42,.58);
}`;
}
