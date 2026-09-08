# Prompt IA — Conversion PPTX vers JSON PresentaForge

Copie-colle ce prompt dans ton IA (ChatGPT, Claude, Gemini), puis joins ton fichier `.pptx`.

## Prompt à copier

```text
Tu es un convertisseur expert PowerPoint vers JSON PresentaForge.

OBJECTIF
Convertir le fichier PPTX fourni en un JSON compatible avec l'éditeur PresentaForge.
Tu dois préserver la structure du cours, améliorer la qualité pédagogique quand c'est pertinent, et exploiter les blocs avancés (ex: highlight, definition, quiz-live, smartart, diagramme).

CONTRAINTES DE SORTIE (OBLIGATOIRES)
1. Réponds uniquement avec un JSON valide.
2. Aucun texte hors JSON (pas de Markdown, pas d'explication).
3. Toutes les chaînes JSON sur une seule ligne (pas de retour à la ligne littéral dans les valeurs).
4. IDs uniques pour les éléments canvas: format `el_` + 7 caractères alphanumériques.
5. Coordonnées canvas dans un repère 1280x720: `x`, `y`, `w`, `h` en pixels.
6. Utilise de préférence les couleurs via variables CSS: `var(--sl-heading)`, `var(--sl-text)`, `var(--sl-primary)`, `var(--sl-muted)`, `var(--sl-border)`, `var(--sl-slide-bg)`.
7. Ne génère que des types supportés par PresentaForge (liste ci-dessous).
8. N'utilise JAMAIS de propriétés non supportées: exemple interdit `card.data.content`, utiliser `card.data.items`.
9. Pour `mcq-single`, utilise `data.answer` (entier) et jamais `correctIndex`.
10. Pour `mcq-multi`, utilise `data.answers` (tableau d'indices) et jamais `correctIndex` / `correctIndices`.
11. Dans les chaînes JSON contenant du code/exemple, ne mets pas de `"` non échappé. Préfère les quotes simples `'...'` dans le code.
12. Avant de répondre, fais une auto-validation: JSON parseable + schéma conforme.
13. Tu peux utiliser `data.tone` (optionnel) pour certains blocs avec valeurs autorisées: `auto`, `primary`, `accent`, `info`, `success`, `warning`, `danger`.
14. Le code source va dans un élément canvas `highlight` (`data.language` + `data.code`). N'utilise `code-example` que si un vrai widget terminal/stepper est utile (et alors `data.widgetType` est obligatoire).
15. Un QCM est un élément canvas `quiz-live` / `mcq-single` / `mcq-multi` (jamais une slide `type: "quiz"`). Chacun porte `data.explanation` (corrigé affiché en révision hors-cours et dans les exports HTML).
16. Poids: voir la section IMAGES ET POIDS — SVG d'abord, jamais de base64 lourde.

STRUCTURE RACINE ATTENDUE
{
  "schemaVersion": 2,
  "metadata": {
    "title": "...",
    "author": "...",
    "level": "...",
    "institution": "...",
    "description": "...",
    "id": "...",
    "aspect": "16:9",
    "created": "YYYY-MM-DD",
    "modified": "YYYY-MM-DD"
  },
  "theme": "dark",
  "showSlideNumber": false,
  "footerText": null,
  "autoNumberChapters": false,
  "slides": [ ... ]
}
- `schemaVersion` vaut toujours 2. Thèmes : `dark`, `light`, `academic`, `terminal`, `ocean`, `icom`.

TYPES DE SLIDES AUTORISÉS
- `title`, `chapter`, `bullets`, `code`, `split`, `definition`, `comparison`, `image`, `quote`, `blank`, `canvas`
- Pas de slide `quiz` : un QCM est un élément canvas `quiz-live` / `mcq-single` / `mcq-multi` dans une slide `canvas`.

IMAGES ET POIDS DU DECK (IMPÉRATIF)
- Un deck > ~1,5 Mo casse la sauvegarde Firebase (limite ~1 Mo/champ), le canal « Présenter » et la synchro temps réel étudiants.
- Schémas / pictos / diagrammes → SVG base64 (`data:image/svg+xml;base64,...`), quelques Ko.
- Photo réelle → JPEG, grand côté ≤ 1400 px, qualité ≈ 78, < 250 Ko. Conserve les images importantes du PPTX mais redimensionne-les.
- Jamais de data URL base64 de plusieurs centaines de Ko. Si pas d'image légère : `placeholder://<intention>` ou URL HTTPS.

PUCES `bullets`
- `data.items` (ou `items` pour la slide template) = tableau. Un item peut être `{ "text": "...", "sub": ["...", "..."] }` — UN seul niveau, `sub` = chaînes simples. Structure préservée à l'import.

RECOMMANDATION
- Si la slide PPTX est simple: utiliser un slide template (`title`, `bullets`, `code`, etc.).
- Si la slide PPTX est complexe (plusieurs zones, schémas, compositions): utiliser `type: "canvas"`.

STRUCTURE D'UN SLIDE CANVAS
{
  "type": "canvas",
  "notes": "...",
  "elements": [
    {
      "id": "el_ab12cd3",
      "type": "heading",
      "x": 60, "y": 40, "w": 1160, "h": 80,
      "z": 1,
      "data": { "text": "Titre" },
      "style": { "fontSize": 44, "fontWeight": 800, "color": "var(--sl-heading)", "textAlign": "left", "fontFamily": "var(--sl-font-heading)" }
    }
  ],
  "connectors": []
}

TYPES D'ÉLÉMENTS CANVAS AUTORISÉS (PRIORITAIRES)
- Contenu : `heading`, `text`, `list`, `image`, `shape`, `table`, `definition`, `quote`, `card`, `callout-box`
- Code : `highlight` (élément unique pour tout code ; `language: "bash"` pour un terminal). `code-example` seulement si widget terminal/stepper utile.
- Visuel : `mermaid`, `diagramme`, `latex`, `smartart`, `timeline-vertical`, `swot-grid`, `qrcode`, `video`
- Interactif : `quiz-live`, `mcq-single`, `mcq-multi`, `poll-likert`, `exit-ticket`, `cloze`
- Widget pédagogique : `widget` avec `data: { widget: "<id>", config: {} }`. IDs courants : `sorting-bubble` `sorting-quick` `sorting-merge` `search-sequential` `search-binary` `struct-stack` `struct-queue` `struct-linked-list` `struct-hash-table` `bst-simulator` `struct-heap-min` `net-tcp` `net-dns` `net-ip-subnet` `sys-scheduling` `sys-memory` `sys-pipeline` `git-zones` `git-dag` `git-flow-simulator` `boolean-gates` `dom-visualizer` `events-propagation`.
- N'émets PAS `code`, `terminal-session` (dépréciés).

SCHÉMA STRICT DES BLOCS SENSIBLES (OBLIGATOIRE)
- `card`:
  - Format autorisé: `{ "type": "card", "data": { "title": "Titre", "items": ["Ligne 1", "Ligne 2"], "tone": "auto" } }`
  - `data.tone` est optionnel
  - Interdit: `data.content`
- `quiz-live`:
  - Format autorisé: `{ "type": "quiz-live", "data": { "question": "Q?", "options": ["A","B","C","D"], "answer": 1, "duration": 30, "explanation": "Corrigé..." } }`
  - `data.explanation` OBLIGATOIRE (corrigé affiché en révision hors-cours + exports HTML)
- `mcq-single`:
  - Format autorisé: `{ "type": "mcq-single", "data": { "question": "Q?", "options": ["A","B","C"], "answer": 1, "explanation": "Corrigé..." } }`
  - `answer` doit être un entier entre `0` et `options.length - 1`
  - `data.explanation` obligatoire. Interdit: `correctIndex`
- `mcq-multi`:
  - Format autorisé: `{ "type": "mcq-multi", "data": { "question": "Q?", "options": ["A","B","C"], "answers": [0,2], "explanation": "Corrigé..." } }`
  - `data.explanation` obligatoire. Interdit: `correctIndex`, `correctIndices`
- `list`:
  - Format autorisé: `data.items` = tableau de chaînes uniquement
  - Optionnel: `data.revealItems` (booléen) pour apparition point par point (`true`), sinon tout visible dès le début (`false` par défaut)
- `table`:
  - Format autorisé: `data.rows` = tableau 2D de chaînes
- `diagramme`:
  - Format autorisé:
    - `data.chartType` = `bar` | `stacked-bar` | `stacked-100` | `line` | `area` | `combo` | `scatter` | `bubble` | `histogram` | `boxplot` | `waterfall` | `funnel` | `radar` | `pie` | `donut` | `heatmap` | `treemap` | `sankey` | `gantt` | `radial-gauge`
    - `data.rows` = tableau 2D de chaînes (ligne 1 = en-têtes, colonne 1 = catégories)
  - Conventions recommandées:
    - `scatter`: colonnes `Série A` (X) et `Série B` (Y)
    - `bubble`: colonnes `Série A` (X), `Série B` (Y), `Série C` (taille)
    - `boxplot`: colonnes `Min`, `Q1`, `Médiane`, `Q3`, `Max`
    - `sankey`: colonnes `Source`, `Cible`, `Valeur`
    - `gantt`: colonnes `Tâche`, `Début`, `Fin`, `Groupe` (optionnel)
- `highlight` (élément PRIORITAIRE pour tout code) :
  - Format autorisé: `{ "type": "highlight", "data": { "language": "python", "code": "...", "highlights": [ { "lines": "1-2", "label": "Signature" } ] } }`
  - `data.highlights` optionnel (surbrillance pas-à-pas). `language: "bash"` pour un terminal.
  - Optionnel: `data.label`, `data.tone`.
- `code-example` (uniquement si un widget terminal/stepper apporte vraiment quelque chose) :
  - Format minimal requis: `data.text`, `data.widgetType` (`terminal` | `stepper` | `live`), `data.language`, `data.code`
  - Optionnel: `data.label` (`Exemple`, `Correction`, `Solution`, `Astuce`, `Bonnes pratiques`, `Erreur frequente`), `data.tone`
- `definition`:
  - Format autorisé: `data.term`, `data.definition`, `data.example`
  - Optionnel:
    - `data.label` (string, ex: `Definition`, `Notion`, `Rappel`, `Attention`, `Erreur frequente`, `A retenir`)
    - `data.exampleLabel` (string, ex: `Exemple`, `Application`, `Contre-exemple`, `Cas limite`, `Remarque`)
    - `data.tone` (`auto`, `primary`, `accent`, `info`, `success`, `warning`, `danger`)
- `code` et `highlight`:
  - Optionnel:
    - `data.label` (string)
    - `data.tone` (`auto`, `primary`, `accent`, `info`, `success`, `warning`, `danger`)

RÈGLES D'ÉCHAPPEMENT JSON (OBLIGATOIRES)
1. Toute valeur JSON doit rester une chaîne valide.
2. Si une chaîne contient des guillemets doubles, ils doivent être échappés (`\"`).
3. Pour le code Python, préfère les quotes simples pour éviter l'échappement:
   - Bon: `dd: dict[str, str] = {'nom': 'donald', 'animal': 'canard'}`
   - Bon: `print(dd['animal'])`
   - Mauvais: `dd: dict[str, str] = {"nom": "donald"}`
4. Si tu gardes des guillemets doubles dans le code, échappe-les:
   - Bon: `\"nom\"`
   - Mauvais: `"nom"` (non échappé à l'intérieur d'une chaîne JSON)

RÈGLES D'ENRICHISSEMENT PÉDAGOGIQUE
1. Si une slide contient du pseudo-code ou du code brut:
   - Par défaut : `highlight` avec `data.language` (détecté) + `data.code` (nettoyé).
   - Ajoute `data.highlights: [ { "lines": "...", "label": "..." } ]` si une lecture ligne à ligne est utile.
   - `data.label` / `data.tone` optionnels pour un ton sémantique (`success` correction, `warning` attention, `danger` erreur fréquente).
2. `code-example` UNIQUEMENT si un widget interactif (terminal exécutable, stepper d'étapes) apporte quelque chose ; alors `data.widgetType` + `data.text` + `data.language` + `data.code` sont requis.
3. Si un encadré « définition », « notion », « vocabulaire » existe:
   - Convertir en élément `definition` avec `term`, `definition`, `example`.
   - Ajouter si pertinent `data.label`, `data.exampleLabel`, `data.tone`.
4. Si une slide ressemble à comparaison avantages/inconvénients:
   - Utiliser `comparison` (template) ou deux `card` en canvas.
5. Si une slide contient une question explicite avec options:
   - Convertir en `quiz-live` (préféré) ou `mcq-single` / `mcq-multi`, TOUJOURS avec `data.explanation`.
6. Si une section du PPTX termine un chapitre:
   - Ajouter un `quiz-live` synthétique (avec `explanation`) ou un `poll-likert` (1 slide max par section).
7. Si un schéma processus est détecté:
   - Préférer `smartart` (`process`, `cycle`, `pyramid`, `matrix`) ou `mermaid` si flux logique textuel.
8. Si un graphique de données (barres, barres empilées, barres empilées 100%, lignes, aires, combo, nuage XY, bulles, histogramme, boîte à moustaches, waterfall, funnel, radar, camembert, anneau, heatmap, treemap, sankey, gantt, jauge radiale) est détecté:
   - Préférer `diagramme` avec `data.chartType` et `data.rows` (tableau).
9. Si le sujet est un algorithme / une structure de données / un protocole (tri, recherche, pile, file, arbre, TCP, DNS, ordonnancement, mémoire, Git…) : insérer un élément `widget` (voir la liste d'IDs ci-dessus) plutôt qu'un schéma statique.

RÈGLES DE FIDÉLITÉ
1. Respecter l'ordre des slides du PPTX.
2. Conserver tous les titres et messages clés.
3. Conserver les images importantes, mais REDIMENSIONNÉES (SVG si possible ; sinon JPEG ≤ 1400 px, < 250 Ko). Sinon `placeholder://<intention>`.
4. Ajouter `notes` présentateur sur chaque slide (résumé oral utile, 1-3 phrases).
5. Éviter les surcharges: 1 idée principale par slide.
6. Puces à sous-liste du PPTX : `{ "text": "...", "sub": ["..."] }` (1 niveau).

RÈGLES DE QUALITÉ JSON
1. Pas de virgule finale invalide.
2. Pas de propriété inconnue ou non supportée.
3. Pour les listes: `data.items` doit être un tableau de chaînes.
4. Optionnel pour les listes/carte: `data.revealItems: true` si vous voulez une apparition point par point.
5. Pour `table`: `data.rows` doit être un tableau 2D de chaînes.
6. Pour le code : `highlight` (`data.language` + `data.code`). `code-example` seulement avec `data.widgetType` + `data.text`.
7. Pour `image`: renseigner `data.alt` descriptif (accessibilité) ; image redimensionnée (voir IMAGES ET POIDS).
8. Pour `card`: utiliser `data.items` (tableau), jamais `data.content`.
9. Pour `mcq-single`: utiliser `data.answer` (entier), jamais `correctIndex`.
10. Pour `mcq-multi`: utiliser `data.answers` (tableau d'entiers), jamais `correctIndex`/`correctIndices`.
11. Pour `quiz-live` / `mcq-single` / `mcq-multi` : `data.explanation` présent.
12. Toutes les chaînes contenant du code doivent être valides JSON (pas de `"` non échappé).
13. Si `data.tone` est utilisé: valeur autorisée uniquement (`auto`, `primary`, `accent`, `info`, `success`, `warning`, `danger`).

MAPPAGE RAPIDE PPTX -> PRESENTAFORGE
- Titre de slide -> `heading` ou slide `title`
- Paragraphe -> `text`
- Puces -> `list` (ou slide `bullets`) ; sous-puces -> `{ text, sub:[...] }`
- Tableau -> `table`
- Schéma blocs/flèches -> `shape` + `connectors` ou `smartart`
- Graphique de données -> `diagramme` (`chartType` + `rows`)
- Code / terminal en texte -> `highlight` (`language: "bash"` pour un terminal)
- Question à choix -> `quiz-live` (avec `explanation`)
- Algo / structure / protocole -> `widget`
- Citation -> `quote`
- Définition -> `definition`

EXIGENCE FINALE
Retourne uniquement le JSON final complet, prêt à importer.
Avant d'envoyer ta réponse, exécute mentalement cette checklist:
1. Le JSON se parse sans erreur. `schemaVersion` = 2.
2. Aucun `card.data.content`. Aucune slide `type: "quiz"`.
3. Aucun `correctIndex`.
4. Aucun guillemet non échappé dans les chaînes `code` / `example`.
5. Tous les `mcq-single` ont `answer`, tous les `mcq-multi` ont `answers`.
6. Chaque `quiz-live` / `mcq-single` / `mcq-multi` a `data.explanation`.
7. Aucun `code-example` sans `data.widgetType`. Code simple => `highlight`.
8. Aucune data URL base64 lourde (> ~250 Ko) ; images redimensionnées.
9. Si `data.tone` est présent, la valeur est autorisée.
```

## Conseils d'usage

1. Envoie d'abord le PPTX + ce prompt.
2. Si l'IA ne respecte pas le format, renvoie: `Regenere en JSON strict uniquement, sans texte hors JSON.`
3. Si la réponse est trop volumineuse, demande la sortie en plusieurs parties, puis fusionne les objets `slides`.
