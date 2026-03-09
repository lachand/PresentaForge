# presentaForge

Ce depot contient uniquement le necessaire pour faire tourner `presentaForge` en local:

- `slides/` (éditeur, viewer, étudiant, remote, scripts)
- `slides/assets/brand/` (logos, favicon, identité visuelle)
- `shared/slides/` (runtime et UI Slides)
- `shared/components/` (widgets référencés par le registre)
- `data/slides/` (fichiers JSON de démo)
- `docs/user/` (guide utilisateur + captures)
- `docs/developer/replay-api/` (OpenAPI + Swagger UI replay)
- `vendor/` (assets front vendorisés pour mode offline)
- `render.yaml` + `tools/slides/*.mjs` (services relay + replay deployables, ex: Render)

## Lancer en local

Utiliser un serveur HTTP statique a la racine du depot (pas en `file://`).

Exemples:

```bash
python3 -m http.server 8080
```

ou

```bash
npx serve -l 8080
```

Puis ouvrir `http://localhost:8080/slides/index.html`.

## Services Render (relay + replay API)

Le repo inclut un blueprint `render.yaml` qui démarre:

```bash
node tools/slides/relay-server.mjs
node tools/slides/replay-api-server.mjs
```

Configurer la variable `RELAY_TOKEN` sur Render, puis utiliser l'URL relay côté viewer:

`?relayWs=wss://<service>.onrender.com&relayToken=<token>`

API replay (génération HTML autonome):

- `POST /api/replay/build`
- `GET /api/replay/healthz`
