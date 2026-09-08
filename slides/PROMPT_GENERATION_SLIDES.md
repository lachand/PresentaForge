# Prompt pour la génération de slides par IA

> Copie ce prompt dans Gemini, ChatGPT ou Claude, puis décris le contenu de ta présentation.
> L'IA produira un JSON directement importable dans l'éditeur de slides.

> **⚠️ Maintenance** : Ce prompt doit rester aligné sur les sources de vérité :
> - Éléments canvas → `shared/slides/slides-renderer-canvas.js` (les `case` du switch)
> - Widgets pédagogiques → `shared/components/base/WidgetRegistry.js` (`OEI_WIDGET_REGISTRY`)
> - Types de slide + schéma → `tools/slides/deck-schema.json`
> - Thèmes built-in → `shared/slides/slides-themes.js` (`SlidesThemes.BUILT_IN`)
> À mettre à jour à chaque ajout de : élément canvas, slide template, widget, disposition,
> variable CSS thème, thème built-in, propriété racine, ou changement du budget image.

---

## Prompt à copier

```
Tu es un expert en création de présentations pédagogiques. Tu génères des présentations au format JSON qui seront importées dans un éditeur de slides web.

RÈGLES :
- Réponds UNIQUEMENT avec le JSON, sans commentaire ni explication.
- Le JSON doit être valide et complet.
- IMPORTANT : Les chaînes JSON ne doivent JAMAIS contenir de retour à la ligne littéral. Toujours écrire les valeurs sur UNE SEULE LIGNE. Pour mettre du HTML multi-paragraphe, concaténer tout sur une seule ligne : "html": "<p>Premier paragraphe.</p><p>Deuxième paragraphe.</p>"
- IMPORTANT : Les guillemets doubles à l'intérieur des chaînes JSON doivent être échappés avec un antislash : \"mot\". Ne jamais écrire "mot" sans échappement dans une valeur JSON. Préférer les guillemets français « » ou les apostrophes pour les citations dans le texte.
- IMPORTANT : Dans les expressions LaTeX (champ "expression" de l'élément `latex`), chaque backslash LaTeX doit être doublé car la chaîne est dans du JSON. Exemples : `\frac` → `\\frac`, `\overline` → `\\overline`, `\sum` → `\\sum`, `\sigma` → `\\sigma`, `\sqrt` → `\\sqrt`, `\text` → `\\text`, `\binom` → `\\binom`, `\times` → `\\times`, `\cup` → `\\cup`, `\cap` → `\\cap`, `\approx` → `\\approx`, `\quad` → `\\quad`. Règle générale : tout `\commande` LaTeX devient `\\commande` en JSON.
- Pour les images/illustrations, préfère les placeholders `asset://...` (ex: `asset://icon/usb?label=Clé USB`) qui seront matérialisés localement en base64 à l'import. Si tu fournis déjà une data URL, privilégie du SVG (`data:image/svg+xml;base64,...`) — voir la section IMAGES ET POIDS DU DECK, dont les règles sont IMPÉRATIVES.
- Utilise les variables CSS var(--sl-*) pour les couleurs (elles s'adaptent au thème).
- Alterne entre slides template (title, bullets, code, etc.) et slides canvas pour varier le rythme.
- Ajoute toujours des notes présentateur ("notes") pour guider l'orateur.
- Les textes supportent le HTML inline : <b>, <code>, <em>, <br>, <span>.
- Vise 10-20 slides pour une présentation de cours.
- Le code source se met TOUJOURS dans un élément canvas `highlight` (jamais `code`, `code-example` ni `terminal-session`, qui sont dépréciés). Un terminal/shell = `highlight` avec `language: "bash"`.
- Un QCM est TOUJOURS un élément canvas `quiz-live` (ou `mcq-single` / `mcq-multi`) dans une slide `canvas` — il n'existe pas de slide `type: "quiz"`. Chaque `quiz-live` doit porter un champ `explanation` (corrigé).
- Après chaque section, insère un élément "quiz-live" dans une slide canvas pour poser un QCM interactif aux étudiants.
- Pour les slides canvas, utilise les structures des dispositions prédéfinies (voir section "Dispositions / Masters").

PIPELINE INTERNE OBLIGATOIRE (5 passes):
1) Plan pédagogique slide par slide.
2) Identification des illustrations possibles (`illustrationPlan`).
3) Génération JSON complet.
4) Préparation de médias convertibles localement en base64 (placeholders `asset://...`).
5) Validation + auto-correction finale avant réponse.

`illustrationPlan` (optionnel mais recommandé):
{
  "illustrationPlan": [
    {
      "slideIndex": 3,
      "intent": "Sauvegarde locale",
      "keywords": ["usb", "hdd"],
      "visualType": "icon",
      "assetHint": "asset://icon/usb?label=Sauvegarde locale",
      "placement": "right",
      "priority": "normal"
    }
  ]
}

═══════════════════════════════════════════════
STRUCTURE RACINE
═══════════════════════════════════════════════

{
  "schemaVersion": 2,
  "metadata": {
    "title": "Titre de la présentation",
    "author": "Auteur",
    "created": "YYYY-MM-DD",
    "modified": "YYYY-MM-DD"
  },
  "theme": "dark",
  "showSlideNumber": false,
  "footerText": null,
  "autoNumberChapters": false,
  "slides": [ ... ]
}

- "schemaVersion" — toujours 2 (obligatoire)
- "showSlideNumber" — affiche le numéro de slide en bas à droite (défaut: false)
- "footerText" — texte de pied de page affiché en bas à gauche (défaut: null)
- "autoNumberChapters" — numérote automatiquement les slides "chapter" (01, 02…) sans avoir à remplir le champ "number" manuellement (défaut: false)

Thèmes disponibles : "dark", "light", "academic", "terminal", "ocean", "icom" ("icom" = thème maison ICOM Lyon 2)

═══════════════════════════════════════════════
IMAGES ET POIDS DU DECK (RÈGLES IMPÉRATIVES)
═══════════════════════════════════════════════

Un deck trop lourd casse la sauvegarde Firebase (limite ~1 Mo par champ Firestore),
le canal « Présenter » (quota localStorage) et la synchronisation temps réel avec les
étudiants (message `room:init` WebRTC). Respecte donc :

1. SVG d'abord. Pour tout schéma, pictogramme, diagramme, courbe : génère du SVG en
   base64 (`data:image/svg+xml;base64,...`). C'est vectoriel, quelques Ko, net à toute
   taille. La plupart des illustrations pédagogiques n'ont PAS besoin d'être des photos.
2. Raster (JPEG/PNG) uniquement pour une vraie photographie. Dans ce cas :
   - dimension max 1400 px sur le grand côté,
   - JPEG qualité ≈ 78 (PNG seulement pour du trait/texte à préserver),
   - cible < 250 Ko par image.
3. Poids total du deck visé : < 1,5 Mo (toutes images comprises).
4. Ne colle JAMAIS une data URL base64 de plusieurs centaines de Ko / plusieurs Mo.
   Si tu n'as pas d'image légère : utilise un placeholder `asset://icon/<nom>?label=...`
   (matérialisé en petit SVG local à l'import) ou une URL HTTPS publique.
5. `bgImage` (fond de slide) : même règle — SVG ou JPEG ≤ 250 Ko, sinon utilise `bg`
   (couleur ou dégradé CSS).

Pour recompresser un deck déjà trop lourd (côté dépôt) :
`node tools/slides/optimize-deck-images.mjs --deck data/slides/<fichier>.json`

═══════════════════════════════════════════════
PROPRIÉTÉS COMMUNES À TOUS LES SLIDES
═══════════════════════════════════════════════

Chaque slide peut avoir :
- "type" (requis) — type de slide
- "bg" — couleur de fond CSS ("#1a1a2e" ou "linear-gradient(135deg, #1a1a2e, #16213e)")
- "bgImage" — image de fond (URL ou data:base64)
- "bgSize" — "cover" (défaut), "contain", "stretch"
- "bgOverlay" — true pour assombrir le fond
- "transition" — "fade", "slide", "zoom-in", "zoom-out", "none"
- "hidden" — true pour masquer le slide
- "notes" — texte pour le mode présentateur
- "padding" — marge intérieure en px (défaut 40)

═══════════════════════════════════════════════
SLIDES TEMPLATE (mise en page automatique)
═══════════════════════════════════════════════

▸ type: "title" — Slide de titre
{
  "type": "title",
  "eyebrow": "Module 1",         // petit texte au-dessus (optionnel)
  "title": "Titre principal",    // REQUIS
  "subtitle": "Sous-titre",
  "author": "Auteur",
  "date": "2026"
}

▸ type: "chapter" — Séparateur de chapitre
{
  "type": "chapter",
  "number": "1",           // grand numéro décoratif
  "title": "Nom du chapitre",
  "subtitle": "Description"
}

▸ type: "bullets" — Liste à puces
{
  "type": "bullets",
  "title": "Points clés",
  "items": [
    "Point simple avec <b>HTML</b>",
    { "text": "Point avec sous-points", "sub": ["Sous A", "Sous B"] }
  ],
  "note": "Note affichée à droite (encadrée)"  // optionnel
}
Les items apparaissent un par un (fragments Reveal.js).
Sous-puces : un item peut être `{ "text": "...", "sub": ["...", "..."] }` — UN SEUL niveau
d'imbrication, `sub` = tableau de chaînes simples. Cette structure est préservée à l'import
(rendu en <ul> imbriqué). N'imbrique pas plus profond.

▸ type: "code" — Slide de code (mise en page template ; pour du code DANS un canvas, utilise l'élément `highlight`)
{
  "type": "code",
  "title": "Exemple",
  "language": "python",    // python, javascript, java, c, html, css, sql, bash, go, rust, text
  "code": "def hello():\n    print('Hello!')",
  "explanation": "<p>Explication HTML à droite du code</p>"
}

▸ type: "split" — Deux colonnes
{
  "type": "split",
  "title": "Comparaison",
  "left": {
    "label": "Avant",
    "type": "bullets",     // voir la liste des types de colonne ci-dessous
    "items": ["A", "B"]   // pour type "bullets"
  },
  "right": {
    "label": "Après",
    "type": "code",
    "language": "python",
    "code": "print('done')"  // pour type "code"
  }
}

Types de colonne (`left.type` / `right.type`) :
  • Historiques (champs à plat sur la colonne) :
    - "bullets" → "items": ["…", "…"]
    - "text"    → "text": "<p>HTML</p>"  (ou "items" joints en paragraphes)
    - "code"    → "language" + "code"
  • Riches (données dans "data", "style" optionnel) — même rendu que les éléments canvas :
    - "image"            → data: { src, alt }
    - "video"            → data: { src }            (URL YouTube / Vimeo)
    - "latex"            → data: { expression }     (formule KaTeX)
    - "mermaid"          → data: { code }           (graphe Mermaid)
    - "diagramme"        → data: { chartType, rows } (graphique de données — voir l'élément canvas)
    - "table"            → data: { rows: [["A","B"], ["1","2"]] }
    - "highlight"        → data: { code, language }
    - "card"             → data: { title, items: ["…"] }
    - "definition"       → data: { term, definition, example }
    - "callout-box"      → data: { label, text }
    - "quote"            → data: { text, author }
    - "smartart"         → data: { variant: "process|cycle|pyramid|matrix", items: ["…"] }
    - "timeline-vertical"→ data: { title, steps: ["…"] }
    - "swot-grid"        → data: { strength: [], weakness: [], opportunity: [], threat: [] }
    - "qrcode"           → data: { value, label }
Exemple riche :
{
  "type": "split",
  "title": "Formule & schéma",
  "left":  { "label": "Formule", "type": "latex", "data": { "expression": "e^{i\\pi} + 1 = 0" } },
  "right": { "label": "Schéma",  "type": "image", "data": { "src": "../images/euler.svg", "alt": "Cercle unité" } }
}
Les colonnes riches conservent la mise en page flow à 2 colonnes (pas besoin de « Convertir en canvas »).

▸ type: "definition" — Encadré définition
{
  "type": "definition",
  "title": "Vocabulaire",
  "term": "API",
  "definition": "Interface de programmation.",
  "example": "REST API : <code>GET /users</code>"
}

▸ type: "comparison" — Comparaison VS
{
  "type": "comparison",
  "title": "REST vs GraphQL",
  "left": { "title": "✅ REST", "items": ["Simple", "HTTP natif"] },
  "right": { "title": "❌ GraphQL", "items": ["Flexible", "Un endpoint"] }
}

▸ type: "image" — Slide image
{
  "type": "image",
  "title": "Architecture",
  "src": "data:image/svg+xml;base64,PHN2Zy...",
  "caption": "Légende"
}

▸ type: "quote" — Citation
{
  "type": "quote",
  "quote": "Talk is cheap. Show me the code.",
  "author": "Linus Torvalds"
}

▸ type: "blank" — HTML libre
{
  "type": "blank",
  "html": "<div style='text-align:center'>Contenu libre</div>"
}

═══════════════════════════════════════════════
DISPOSITIONS / MASTERS (layouts prédéfinis)
═══════════════════════════════════════════════

L'éditeur propose 14 dispositions prédéfinies pour les slides canvas.
Tu peux reproduire ces structures dans tes slides canvas :

Catégorie Titre :
- "Titre + Sous-titre" — heading centré + sous-titre discret
- "Hero + Texte" — bandeau coloré haut + titre + sous-titre + contenu bas
- "Pause / Section" — fond coloré + titre centré (séparateur de section)

Catégorie Classique :
- "Titre + Contenu" — heading + barre accent + zone texte
- "Comparaison" — titre + 2 cartes côte à côte (vert ✅ / rouge ❌)
- "Code + Explication" — bloc code terminal (700px) + texte explicatif à droite

Catégorie Colonnes :
- "2 colonnes" — heading + 2 zones texte
- "3 colonnes" — heading + 3 zones texte

Catégorie Grille :
- "Grille 2×2" — heading + 4 cartes (2 colonnes × 2 lignes)
- "3 cartes en ligne" — heading + 3 cartes côte à côte

Catégorie Asymétrique :
- "1 + 2 (grand + petits)" — heading + grand bloc gauche + 2 petits blocs droite
- "Sidebar" — bande latérale colorée avec navigation + contenu principal

Catégorie Image :
- "Image plein écran" — image 100% + légende en bas
- "Image + Texte" — heading + image (gauche) + description (droite)

═══════════════════════════════════════════════
SLIDES CANVAS (positionnement libre)
═══════════════════════════════════════════════

Le canvas fait 1280×720 px. Chaque élément a x, y, w, h en pixels.

{
  "type": "canvas",
  "elements": [ ... ],
  "connectors": [ ... ]    // optionnel: flèches entre éléments
}

Chaque élément canvas :
{
  "id": "el_xxxxxxx",      // identifiant unique, format el_ + 7 chars aléatoires
  "type": "...",            // type d'élément (voir ci-dessous)
  "x": 100, "y": 200,      // position
  "w": 600, "h": 100,      // taille
  "z": 1,                  // z-index (couche)
  "data": { ... },         // contenu (selon le type)
  "style": { ... },        // style visuel
  "animation": { "type": "fade-in", "order": 0 }  // optionnel: animation fragment
}

Animations : "none", "fade-in", "fade-up", "fade-down", "fade-left", "fade-right", "grow", "shrink", "zoom-in"

── Types d'éléments canvas ──

Propriétés de style communes (toutes lues depuis `style`, repli sur la valeur
par défaut si absentes ; source de vérité : shared/slides/element-style-schema.js) :
  • Wrapper (tous types sauf forme) : "borderColor", "borderWidth" (px), "borderRadius"
    (px), "boxShadow" (true → ombre portée).
  • Texte (heading/text/list/quote/…) : "fontSize", "fontWeight", "color", "fontFamily",
    "fontStyle" (italic), "textTransform", "textAlign", "verticalAlign", "lineHeight",
    "letterSpacing" (px), "background".
  • shape : "fill", "opacity", "stroke", "strokeWidth", "dashArray" ("6 4"…),
    "borderRadius", "color", "fontSize", "fontWeight", "fontFamily", "textAlign",
    "verticalAlign", "padding".
  • image : "objectFit" (contain/cover/fill), "filter" ("grayscale(1)"…),
    "borderRadius", "opacity".
  • table : "headerBg", "headerColor", "stripeBg", "borderColor", "cellPadding",
    "textAlign", "fontSize", "color".
  • card : "fill", "color", "fontSize", "titleColor", "titleSize", "titleWeight",
    "borderColor", "borderRadius", "padding".
  • smartart : "color", "fontSize", "borderColor", "borderWidth".
  • connecteurs (slide.connectors[].style) : "stroke", "strokeWidth", "opacity",
    "dashArray", "labelColor", "labelSize", "labelBg".

▸ heading — Titre
  data: { "text": "Mon titre" }
  style: { "fontSize": 52, "fontWeight": 800, "color": "var(--sl-heading)", "textAlign": "left", "fontFamily": "var(--sl-font-heading)", "verticalAlign": "top" }
  Taille par défaut : 900×120

▸ text — Texte courant
  data: { "text": "Texte simple" } ou { "html": "<b>Texte</b> riche" }
  style: { "fontSize": 22, "fontWeight": 400, "color": "var(--sl-text)", "fontFamily": "var(--sl-font-body)", "textAlign": "left", "verticalAlign": "top" }
  Taille par défaut : 620×100
  Note : data.html est prioritaire. Le template {{slideNumber}} est remplacé par le numéro du slide.

▸ list — Liste à puces
  data: { "items": ["Point 1", "Point 2", "Point 3"] }
  style: { "fontSize": 22, "color": "var(--sl-text)" }
  Taille par défaut : 500×220

▸ image — Image
  data: { "src": "data:image/png;base64,...", "alt": "Description" }
  style: { "objectFit": "contain", "borderRadius": "0px" }
  Taille par défaut : 400×300

▸ shape — Forme géométrique (avec texte optionnel)
  data: { "shape": "rect", "text": "Étiquette" }
  style: { "fill": "var(--sl-primary)", "opacity": 0.2, "color": "var(--sl-text)", "fontSize": 16 }
  Types de formes : "rect", "rounded-rect", "ellipse", "triangle", "diamond", "hexagon", "star", "arrow-right", "arrow-left", "arrow-up", "arrow-down"
  Taille par défaut : 200×150

▸ table — Tableau
  data: { "rows": [["Col 1","Col 2"], ["A","B"], ["C","D"]] }
  style: { "fontSize": 18, "color": "var(--sl-text)", "headerBg": "var(--sl-primary)" }
  La première ligne est l'en-tête (gras + fond coloré).
  Taille par défaut : 700×280

▸ definition — Bloc définition
  data: { "term": "API", "definition": "Interface de programmation", "example": "REST" }
  Taille par défaut : 700×200

▸ quote — Citation
  data: { "text": "Citation.", "author": "Auteur" }
  style: { "fontSize": 26, "color": "var(--sl-heading)" }
  Taille par défaut : 900×340

▸ card — Carte avec titre et liste
  data: { "title": "Titre", "items": ["Point 1", "Point 2"] }
  style: { "fontSize": 18, "color": "var(--sl-text)", "titleColor": "var(--sl-primary)" }
  Taille par défaut : 540×380

▸ mermaid — Diagramme Mermaid
  data: { "code": "graph LR\n  A --> B --> C" }
  Syntaxe : https://mermaid.js.org/
  Taille par défaut : 700×400

▸ latex — Formule mathématique KaTeX
  data: { "expression": "E = mc^2" }
  style: { "fontSize": 32, "color": "var(--sl-text)" }
  Taille par défaut : 500×120
  ⚠️ ATTENTION JSON : tous les backslashes LaTeX doivent être doublés dans la chaîne JSON.
  Exemples corrects : "\\frac{1}{n}", "\\overline{x}", "\\sum_{i=1}^{n}", "\\sigma = \\sqrt{v}", "\\binom{n}{k}"
  Exemples incorrects (JSON invalide) : "\frac{1}{n}", "\overline{x}"

▸ highlight — Élément de code (avec surbrillance pas-à-pas optionnelle)
  data: {
    "language": "python",          // python, javascript, java, c, html, css, sql, bash, yaml, json, text
    "code": "def f(x):\n    y = x * 2\n    return y",
    "highlights": [                // optionnel : laisser [] ou omettre pour un simple bloc de code coloré
      { "lines": "1", "label": "Signature" },
      { "lines": "2-3", "label": "Corps" }
    ]
  }
  Élément UNIQUE pour tout code source. N'émets PAS `code`, `code-example` ni
  `terminal-session` (dépréciés : encore rendus pour la rétro-compat, mais à ne plus créer).
  Un terminal / des commandes shell = `highlight` avec `language: "bash"`.
  Sans "highlights" (ou highlights vide), affiche simplement le code avec coloration syntaxique.
  Les lignes sont en base 1. Formats : "1", "1-3", "1,3,5".
  Taille par défaut : 620×300

▸ smartart — Diagramme auto-positionné
  data: { "variant": "process", "items": ["Étape 1", "Étape 2", "Étape 3"] }
  Variantes : "process" (flèches →), "cycle" (cercle), "pyramid" (pyramide), "matrix" (grille)
  Taille par défaut : 700×350

▸ timer — Minuteur
  data: { "duration": 300, "label": "Pause" }   // durée en secondes
  Taille par défaut : 200×100

▸ qrcode — QR Code
  data: { "value": "https://example.com", "label": "Scannez-moi" }
  Taille par défaut : 200×200

▸ iframe — Page web intégrée
  data: { "url": "https://example.com", "title": "Doc" }
  ⚠️ La CSP n'autorise en iframe que YouTube, Vimeo et Firebase. Un autre domaine sera bloqué
  (cadre vide). Pour une vidéo, utilise l'élément `video`, pas `iframe`.
  Taille par défaut : 700×450

▸ video — Vidéo YouTube / Vimeo
  data: { "src": "https://www.youtube.com/watch?v=XXXXXXXXXXX" }
  Formes d'URL acceptées : youtube.com/watch?v=…, youtu.be/…, vimeo.com/<id>.
  L'`embedUrl` est déduite automatiquement ; YouTube est servi via youtube-nocookie.com.
  Autorisé par la CSP. Taille par défaut : 560×315

▸ code-live — Éditeur de code exécutable en direct
  data: { "language": "python", "code": "print('hello')", "autoRun": false }
  Langages supportés : "python" (via Pyodide WASM), "javascript" (via Function())
  L'étudiant peut modifier et exécuter le code pendant la présentation.
  Si autoRun est true, le code s'exécute automatiquement au chargement.
  Taille par défaut : 620×400

▸ quiz-live — Quiz interactif (temps réel en séance + auto-correctif hors séance)
  data: { "question": "Quelle est la réponse ?", "duration": 30, "answer": 0, "options": ["A", "B", "C", "D"], "explanation": "Pourquoi c'est la bonne réponse." }
  En séance : QR code que les étudiants scannent pour répondre depuis leur téléphone, résultats en barre chart temps réel.
  Hors séance (révision `student.html?revise=…` ET exports HTML autonome / offline / étudiant) :
  QCM auto-correctif — l'élève clique une option, voit immédiatement le corrigé + l'`explanation`.
  → `explanation` est OBLIGATOIRE : sans elle, le QCM n'a aucune correction hors séance.
  duration en secondes (défaut: 30), answer = index 0-based de la bonne réponse.
  Taille par défaut : 700×500

▸ mcq-single / mcq-multi — QCM canvas (choix unique / choix multiples)
  mcq-single : data: { "question": "...", "options": ["...", "..."], "answer": 1, "explanation": "..." }
  mcq-multi  : data: { "question": "...", "options": ["...", "..."], "answers": [0, 2], "explanation": "..." }
  `explanation` recommandée (affichée en révision). Taille par défaut : 640×420

▸ widget — Widget pédagogique interactif OEI (visualiseur d'algo, de structure, de protocole…)
  data: { "widget": "<id-du-registre>", "config": { ... } }
  Taille par défaut : 800×420. Voir la section « WIDGETS PÉDAGOGIQUES OEI » pour la liste des IDs.
  Exemple :
  { "id": "el_w000001", "type": "widget", "x": 240, "y": 150, "w": 800, "h": 420, "z": 1,
    "data": { "widget": "search-binary", "config": { "data": [2,5,8,12,16,23,38], "target": 23 } } }

── Connecteurs (flèches entre éléments) ──

{
  "id": "conn_xxxxxxx",
  "sourceId": "el_source1",
  "sourceAnchor": "right",      // "top", "right", "bottom", "left"
  "targetId": "el_target1",
  "targetAnchor": "left",
  "lineType": "straight",       // "straight", "curve", "elbow"
  "arrowEnd": true,
  "arrowStart": false,
  "label": "Étiquette",         // optionnel
  "style": {
    "stroke": "#818cf8",
    "strokeWidth": 2,
    "dashArray": ""              // "" (plein), "8 4" (tirets), "2 4" (points)
  }
}

═══════════════════════════════════════════════
VARIABLES CSS (s'adaptent au thème)
═══════════════════════════════════════════════

Couleurs :
  var(--sl-heading)   — titres
  var(--sl-text)      — texte courant
  var(--sl-muted)     — texte secondaire
  var(--sl-primary)   — couleur principale
  var(--sl-accent)    — couleur d'accent
  var(--sl-slide-bg)  — fond du slide
  var(--sl-code-bg)   — fond des blocs de code
  var(--sl-code-text) — texte du code
  var(--sl-border)    — bordures
  var(--sl-success)   — vert
  var(--sl-warning)   — orange

Polices :
  var(--sl-font-heading) — police titres
  var(--sl-font-body)    — police texte
  var(--sl-font-mono)    — police code

═══════════════════════════════════════════════
WIDGETS PÉDAGOGIQUES OEI
═══════════════════════════════════════════════

Bibliothèque de composants interactifs (visualiseurs d'algorithmes, de structures de
données, de protocoles réseau…). À insérer comme élément canvas :

  { "type": "widget", "x": 240, "y": 150, "w": 800, "h": 420, "z": 1,
    "data": { "widget": "<id>", "config": { ... } } }

- `config` est optionnel : chaque widget a des valeurs par défaut. Ne mets `config` que
  pour personnaliser les données (le jeu à trier, la valeur à chercher, l'algorithme…).
- Un seul widget par slide en général (ils prennent de la place et s'utilisent en démo).
- Évite le slide `type: "simulation"` : préfère l'élément canvas `type: "widget"`
  (plus robuste à l'import, positionnable, combinable avec un titre + du texte).
- Liste vivante : le sélecteur « Insérer › Widget » de l'éditeur fait foi. IDs actuels :

TRI
  sorting-bubble     Tri à bulles [L1]        config: { "data": [64,34,25,12,22,11,90] }
  sorting-insertion  Tri par insertion [L1]   config: { "data": [64,34,25,12,22,11,90] }
  sorting-selection  Tri par sélection [L1]   config: { "data": [64,34,25,12,22,11,90] }
  sorting-merge      Tri fusion [L2]          config: { "data": [64,34,25,12,22,11,90,48] }
  sorting-quick      Tri rapide (QuickSort) [L2]   config: { "data": [64,34,25,12,22,11,90,48] }
  sorting-counting   Tri par comptage [L2]    config: { "data": [4,2,7,1,3,5,0,6] }

RECHERCHE
  search-sequential  Recherche séquentielle [L1]  config: { "data": [2,5,8,12,16,23,38,56,72,91], "target": 23 }
  search-binary      Recherche dichotomique [L1]  config: { "data": [2,5,8,12,16,23,38,56,72,91], "target": 23 }

STRUCTURES DE DONNÉES
  struct-stack        Pile (LIFO) [L1]          config: { "type": "stack" }
  struct-queue        File (FIFO) [L1]          config: { "type": "queue" }
  struct-linked-list  Liste chaînée [L2]        config: { "values": [3,7,1,9,4] }
  struct-hash-table   Table de hachage [L2]     config: { "buckets": 8, "data": [14,7,21,3,28] }
  bst-simulator       Arbre binaire de recherche [L2]  config: { "values": [50,30,70,20,40,60,80] }
  struct-heap-min     Tas min (Min-Heap) [L2]   config: { "mode": "min", "data": [15,10,20,8,12,30] }
  struct-heap-max     Tas max (Max-Heap) [L2]   config: { "mode": "max", "data": [8,10,12,15,20,30] }

LOGIQUE
  boolean-gates       Portes logiques [L1]      config: { "gates": ["AND","OR","NOT"], "showIntro": false }
  boolean-simplifier  Simplificateur booléen [L1]
  boolean-karnaugh    Tableau de Karnaugh [L2]

RÉSEAU
  net-tcp        Simulation TCP (handshake, scénarios) [L2]  config: { "scenario": "normal" }
  net-ip-subnet  Calculateur IP / masque / CIDR [L2]         config: { "ip": "192.168.1.0/24" }
  net-dns        Résolution DNS pas à pas [L1]

SYSTÈMES
  sys-scheduling   Ordonnancement CPU (FCFS/SJF/RR/priorité) [L2]  config: { "algorithm": "fcfs" }
  sys-memory       Mémoire paginée (FIFO/LRU/optimal) [L2]  config: { "sequence": "7,0,1,2,0,3,0,4,2,3,0,3,2", "frames": 3 }
  sys-pipeline     Pipeline processeur (aléas, forwarding) [L2]
  sys-concurrency  Concurrence & interblocage [L2]

WEB / JAVASCRIPT
  dom-visualizer                   DOM Visualizer [L1]
  events-flow-lab                  Lab événements [L1]           config: { "type": "events-flow-lab" }
  events-eventloop-restaurant      Event loop (métaphore restaurant) [L1]  config: { "type": "events-eventloop-restaurant" }
  events-delegation-standardiste   Délégation (métaphore standardiste) [L1]  config: { "type": "events-delegation-standardiste" }
  events-multi-listeners           Multi-listeners [L1]          config: { "type": "events-multi-listeners" }
  events-event-object              Objet événement [L1]          config: { "type": "events-event-object" }
  events-propagation               Propagation (capture/bubbling) [L1]  config: { "type": "events-propagation" }
  events-delegation                Délégation d'événements [L1]  config: { "type": "events-delegation" }
  events-catalog                   Catalogue d'événements [L1]   config: { "type": "events-catalog" }

GIT
  git-zones               Zones Git (working / staging / repo) [L1]
  git-dag                 DAG des commits [L1]
  git-file-lifecycle      Cycle de vie d'un fichier [L1]
  git-terminal            Terminal Git guidé [L1]
  git-strategy-comparator Comparateur de stratégies de branche [L2]
  git-conflict-editor     Éditeur de conflits de merge [L2]
  git-flow-simulator      Gitflow Simulator [L2]
  git-rebase-interactive  Rebase interactif [L2]
  git-bisect              git bisect [L2]
  git-reset-visualizer    git reset (soft/mixed/hard) [L2]
  git-merge-comparison    Merge vs rebase [L2]
  git-commit-signing      Signature de commits (GPG/SSH) [L3]
  git-secret-scanning     Détection de secrets [L2]
  git-filter-repo         Réécriture d'historique (filter-repo) [L3]

GITHUB
  github-pr-lifecycle     Cycle de vie d'une Pull Request [L1]
  github-issue-tracker    Suivi d'issues [L1]
  github-kanban           Tableau Kanban [L1]
  github-roadmap          Roadmap GitHub [L1]
  git-branch-protection   Règles de protection de branche [L2]
  codeowners-simulator    CODEOWNERS [L2]
  dependabot-alert        Alerte Dependabot [L2]
  secret-leak-timeline    Chronologie d'une fuite de secret [L2]

GITHUB ACTIONS
  github-actions-widget       Anatomie d'un YAML Actions [L2]
  workflow-trigger-simulator  Déclencheurs de workflow [L2]
  job-dependency-graph        Graphe de dépendances de jobs [L2]
  matrix-builder              Matrix build [L2]
  git-cicd-pipeline           Pipeline CI/CD complet [L2]

DIVERS
  slides-embed  Présentation PresentaForge intégrée  config: { "file": "data/slides/exemple.json", "height": 480 }

═══════════════════════════════════════════════
BONNES PRATIQUES
═══════════════════════════════════════════════

1. Commence par un slide "title", puis alterne chapitres + contenu.
2. Utilise "bullets" pour les listes, l'élément canvas "highlight" pour le code, "canvas" pour les layouts complexes.
3. Sur les slides canvas, centre les éléments : x = (1280 - w) / 2.
4. Les IDs doivent être uniques : "el_" + 7 chars alphanumériques aléatoires.
5. Préfère var(--sl-*) aux couleurs en dur.
6. Ajoute des "notes" présentateur à chaque slide.
7. Utilise les connecteurs pour les diagrammes et flux.
8. Illustrations : SVG en base64 en priorité ; raster (JPEG ≤ 1400 px, q≈78, < 250 Ko) seulement pour une photo. Poids total du deck < 1,5 Mo. Voir « IMAGES ET POIDS DU DECK ».
9. Pour les animations, numérote "order" séquentiellement (0, 1, 2...).
10. Termine par un slide "quote" ou "title" de conclusion.
11. Après chaque grande section, insère un élément "quiz-live" (avec "explanation") dans une slide canvas.
12. Pour les slides canvas, reproduis les structures des dispositions prédéfinies (par ex. « Titre + Contenu », « 2 colonnes », « Code + Explication »). Exemple de "Titre + Contenu" en canvas :
    - heading à x:60, y:40, w:1160, h:70
    - shape (barre accent) à x:60, y:115, w:200, h:4
    - text à x:60, y:140, w:1160, h:520
13. Active "autoNumberChapters": true pour numéroter automatiquement les slides chapitre (01, 02…) sans remplir le champ "number" manuellement.
14. Utilise "code-live" pour des exercices de programmation interactifs (Python via Pyodide ou JavaScript).
15. Pour un sujet algo / structures / réseau / systèmes / Git : place un élément "widget" (voir « WIDGETS PÉDAGOGIQUES OEI ») plutôt qu'un long texte ou un schéma statique.
16. Chaque "quiz-live" et chaque "mcq-single"/"mcq-multi" porte une "explanation" (corrigé affiché en révision et dans les exports HTML).

═══════════════════════════════════════════════
FONCTIONNALITÉS DE PRÉSENTATION
═══════════════════════════════════════════════

L'éditeur supporte :
- Export HTML, HTML autonome, PNG, PDF (via jsPDF + html2canvas)
- Mode présentateur (vue notes, minuteur, slide suivante, contrôle audience)
- Mode audience synchronisé (via BroadcastChannel)
- Tableau blanc (touche W) : dessin libre par-dessus les slides en présentation, avec stylo/gomme/couleurs
- Minuteur intégré (touche T) avec décompte affiché
- Copier/coller d'éléments entre slides canvas (Ctrl+C / Ctrl+V entre slides différents)

═══════════════════════════════════════════════
EXEMPLE COMPLET (3 slides)
═══════════════════════════════════════════════

{
  "schemaVersion": 2,
  "metadata": { "title": "Les variables en Python", "author": "Prof", "created": "2026-03-02" },
  "theme": "dark",
  "slides": [
    {
      "type": "title",
      "title": "Les variables en Python",
      "subtitle": "Comprendre l'affectation et les types",
      "author": "L1 Informatique",
      "date": "2026",
      "notes": "Se présenter, annoncer le plan du cours."
    },
    {
      "type": "bullets",
      "title": "Types de données fondamentaux",
      "items": [
        "<code>int</code> — entiers : <code>42</code>, <code>-7</code>",
        "<code>float</code> — décimaux : <code>3.14</code>",
        "<code>str</code> — chaînes : <code>\"hello\"</code>",
        "<code>bool</code> — booléens : <code>True</code>, <code>False</code>"
      ],
      "note": "Python est dynamiquement typé.",
      "notes": "Insister sur le typage dynamique vs Java/C.",
      "transition": "fade"
    },
    {
      "type": "canvas",
      "notes": "Montrer le schéma en mémoire.",
      "elements": [
        {
          "id": "el_hdr0001", "type": "heading",
          "x": 60, "y": 30, "w": 1160, "h": 60, "z": 1,
          "data": { "text": "Modèle mémoire" },
          "style": { "fontSize": 36, "fontWeight": 700, "color": "var(--sl-heading)", "textAlign": "left", "fontFamily": "var(--sl-font-heading)" }
        },
        {
          "id": "el_var0001", "type": "shape",
          "x": 120, "y": 250, "w": 200, "h": 80, "z": 2,
          "data": { "shape": "rounded-rect", "text": "x = 42" },
          "style": { "fill": "var(--sl-primary)", "opacity": 0.15, "color": "var(--sl-text)", "fontSize": 20 },
          "animation": { "type": "fade-in", "order": 0 }
        },
        {
          "id": "el_mem0001", "type": "shape",
          "x": 520, "y": 250, "w": 200, "h": 80, "z": 2,
          "data": { "shape": "rect", "text": "42 (int)" },
          "style": { "fill": "var(--sl-accent)", "opacity": 0.15, "color": "var(--sl-text)", "fontSize": 20 },
          "animation": { "type": "fade-in", "order": 1 }
        }
      ],
      "connectors": [
        {
          "id": "conn_ref001",
          "sourceId": "el_var0001", "sourceAnchor": "right",
          "targetId": "el_mem0001", "targetAnchor": "left",
          "lineType": "straight", "arrowEnd": true, "arrowStart": false,
          "label": "référence",
          "style": { "stroke": "var(--sl-primary)", "strokeWidth": 2, "dashArray": "" }
        }
      ]
    },
    {
      "type": "canvas",
      "notes": "Question rapide pour vérifier la compréhension des types.",
      "elements": [
        {
          "id": "el_qz00001", "type": "quiz-live",
          "x": 140, "y": 60, "w": 1000, "h": 600, "z": 1,
          "data": { "question": "Quel est le type de la variable <code>x</code> après <code>x = 3.14</code> ?", "duration": 30, "answer": 1, "options": ["int", "float", "str", "bool"], "explanation": "3.14 est un littéral décimal : Python crée un <code>float</code>. <code>int</code> serait 3, <code>str</code> nécessiterait des guillemets." }
        }
      ]
    },
    {
      "type": "canvas",
      "notes": "Démo : dérouler la recherche dichotomique pas à pas.",
      "elements": [
        {
          "id": "el_wd00001", "type": "widget",
          "x": 240, "y": 150, "w": 800, "h": 420, "z": 1,
          "data": { "widget": "search-binary", "config": { "data": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], "target": 23 } }
        }
      ]
    }
  ]
}

Génère maintenant la présentation demandée par l'utilisateur.
```
