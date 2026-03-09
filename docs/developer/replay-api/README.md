# Replay API (JSON + audio)

Cette documentation décrit l'API de génération de replay HTML autonome.

## Fichiers

- `openapi.yaml` : contrat OpenAPI 3.1 (compatible Swagger)
- `request.schema.json` : schéma JSON de validation de la requête
- `swagger-ui.html` : visualisation Swagger UI locale (serveur HTTP requis)

## Champs niveaux de slide

Chaque slide peut déclarer des niveaux pédagogiques `1..4`:

- `level`: niveau unique (entier)
- `levels`: plusieurs niveaux (tableau d'entiers)
- `metadata.level` / `metadata.levels`: alias acceptés

Le générateur normalise automatiquement vers `slide.levels` (valeurs uniques triées), et le replay affiche les badges de niveaux sur chaque slide.

## Ouvrir Swagger UI

Depuis la racine du repo:

```bash
python3 -m http.server 8080
```

Puis ouvrir:

- `http://localhost:8080/docs/developer/replay-api/swagger-ui.html`

## API locale

Lancer le serveur:

```bash
npm run replay:api
```

Puis tester:

```bash
curl -X POST http://localhost:8090/api/replay/build \\
  -H 'Content-Type: application/json' \\
  -d @payload.json
```

## Déploiement via dépôt miroir (Render)

Si votre dépôt principal pousse automatiquement vers un dépôt secondaire (workflow `sync-slides-mirror.yml`):

- `render.yaml` est synchronisé vers le dépôt secondaire
- `tools/slides/replay-api-server.mjs` et `tools/slides/replay-standalone.mjs` sont synchronisés
- `docs/developer/replay-api/*` est synchronisé

Le blueprint Render du dépôt secondaire peut donc être synchronisé automatiquement après chaque push sur `main`.
