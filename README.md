# Slides Minimal Repo

Ce dépôt contient uniquement le nécessaire pour faire tourner l'écosystème Slides en local:

- `slides/` (éditeur, viewer, étudiant, remote, scripts)
- `shared/slides/` (runtime et UI Slides)
- `shared/components/` (widgets référencés par le registre)
- `data/slides/` (fichiers JSON de démo)
- `vendor/` (assets front vendorisés pour mode offline)

## Lancer en local

Utiliser un serveur HTTP statique à la racine du dépôt (pas en `file://`).

Exemples:

```bash
python3 -m http.server 8080
```

ou

```bash
npx serve -l 8080
```

Puis ouvrir `http://localhost:8080/slides/index.html`.
