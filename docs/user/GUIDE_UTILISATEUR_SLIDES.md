# Guide utilisateur presentaForge

Ce guide couvre l'utilisation de `presentaForge` sur les vues :

- index,
- éditeur,
- présentateur,
- audience,
- étudiant,
- télécommande mobile.

Le contenu a été simplifié avec moins d'illustrations pour éviter les problèmes de crop/rendu DOM sur certaines captures.

## 1. Démarrage rapide

1. Ouvrir un terminal à la racine du projet.
2. Lancer un serveur statique :

```bash
python3 -m http.server 8080
```

3. Ouvrir ensuite :

- `http://localhost:8080/slides/index.html`
- `http://localhost:8080/slides/editor.html`
- `http://localhost:8080/slides/viewer.html`

### 1.1 Démarrage "campus/eduroam" avec relay (gratuit)

Quand le P2P est bloqué sur le Wi-Fi campus, lancez le kit relay :

```bash
npm run relay:kit
```

Le script démarre :

- le serveur web (`python3 -m http.server`),
- un relay WebSocket local compatible avec la salle,
- une URL présentateur déjà configurée avec `relayWs`.

Variables utiles :

- `HTTP_PORT` (défaut `8080`)
- `RELAY_PORT` (défaut `8787`)
- `PUBLIC_HOST` (IP/hostname à partager, sinon auto-détection)
- `RELAY_TOKEN` (optionnel, recommandé hors LAN privé)

Exemple :

```bash
PUBLIC_HOST=10.42.0.15 RELAY_TOKEN=mon-token npm run relay:kit
```

Ensuite dans `Mode présentateur > Salle > Diagnostic réseau` :

- utiliser `Copier lien relay` pour les étudiants bloqués,
- ou forcer `transport=relay` si besoin.

### 1.2 Déploiement relay sur Render (gratuit)

Le dépôt contient un blueprint prêt à l'emploi : `render.yaml`.

Étapes :

1. Pousser le dépôt sur GitHub.
2. Dans Render : `New` > `Blueprint`, sélectionner le dépôt.
3. Créer la variable d'environnement `RELAY_TOKEN` (valeur secrète).
4. Déployer.
5. Récupérer l'URL Render, par exemple `https://presentaforge-relay.onrender.com`.

Utilisation côté présentateur :

- ouvrir `viewer.html` avec :
  - `relayWs=wss://presentaforge-relay.onrender.com`
  - `relayToken=<votre_token>`
- puis partager le `lien relay` depuis le diagnostic réseau.

Illustration (index) :

![Index presentaForge](./images/slides-index.png)

## 2. Éditeur

L'éditeur est organisé en 4 zones principales :

- ruban d'actions en haut,
- liste des slides à gauche,
- zone de travail centrale,
- panneau de propriétés à droite.

![Éditeur - vue générale](./images/editor-home.png)

### 2.1 Onglet Accueil

Permet de :

- créer/dupliquer/supprimer une diapositive,
- annuler/rétablir,
- gérer le presse-papier,
- ouvrir/importer et sauvegarder.

### 2.2 Onglet Insertion

Permet d'ajouter :

- contenu (titre, texte, image, forme, tableau, vidéo),
- widgets,
- éléments interactifs (QCM, Likert, activités),
- blocs pédagogiques, layouts et pied de page.

![Éditeur - Insertion](./images/editor-insertion-tab.png)

### 2.3 Onglet Conception

Permet de définir :

- thème,
- fond de slide,
- ratio,
- variantes visuelles par slide.

![Éditeur - Conception](./images/editor-conception-tab.png)

### 2.4 Onglet Affichage

Permet de :

- lancer la présentation,
- exporter (JSON, PDF, HTML, PNG, PPTX, Markdown),
- ouvrir les outils de vérification (checker, assets, tokens, plugins).

![Éditeur - Affichage](./images/editor-affichage-tab.png)

## 3. Mode présentateur

Le mode présentateur est la vue de pilotage enseignant :

- slide courante + slide suivante,
- notes,
- minuteur,
- ouverture de salle et suivi audience.

![Mode présentateur](./images/presenter-overview.png)

Bonnes pratiques :

- ouvrir la salle dès le début,
- copier le lien stable pour Moodle/ENT,
- surveiller le diagnostic réseau si connexions mobiles instables.

## 4. Vue audience

La vue audience est passive :

- pas de pilotage local de la présentation,
- synchronisation avec le présentateur,
- affichage propre pour projection secondaire.

![Vue audience](./images/viewer-audience.png)

## 5. Mode étudiant

Le mode étudiant permet de :

- rejoindre une salle,
- suivre la présentation,
- répondre aux interactions autorisées,
- utiliser favoris/révision si activés.

![Mode étudiant](./images/student-mode.png)

## 6. Télécommande mobile

La télécommande mobile sert à :

- naviguer précédent/suivant,
- écran noir,
- actions rapides de présentation,
- contrôle via salle + mot de passe si activé.

Accès : `http://localhost:8080/slides/remote.html`

## 7. Exports

Depuis l'éditeur (`Affichage`) :

- Export JSON : format source principal.
- Export PDF : support impression.
- Export HTML : partage autonome.
- Export PNG/PPTX/Markdown selon usage.

Conseil : valider visuellement le rendu sur 2-3 slides avant diffusion.

## 8. Métadonnées et accessibilité

Dans `Accueil` > `Métadonnées`, renseigner au minimum :

- titre,
- auteur,
- niveau,
- établissement.

Côté accessibilité :

- remplir l'alt text des images,
- vérifier contraste texte/fond,
- éviter les slides trop chargés.
