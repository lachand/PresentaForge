# presentaForge

Ce depot contient uniquement le necessaire pour faire tourner `presentaForge` en local:

- `slides/` (éditeur, viewer, étudiant, remote, scripts)
- `slides/assets/brand/` (logos, favicon, identité visuelle)
- `shared/slides/` (runtime et UI Slides)
- `shared/components/` (widgets référencés par le registre)
- `data/slides/` (fichiers JSON de démo)
- `docs/user/` (guide utilisateur + captures)
- `vendor/` (assets front vendorisés pour mode offline)

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
