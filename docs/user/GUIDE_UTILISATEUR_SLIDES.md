# Guide utilisateur presentaForge

Ce guide couvre l'utilisation de `presentaForge` sur les vues:

- index,
- editeur,
- presentateur,
- audience,
- etudiant,
- telecommande mobile.

Le contenu a ete simplifie avec moins d'illustrations pour eviter les problemes de crop/rendu DOM sur certaines captures.

## 1. Demarrage rapide

1. Ouvrir un terminal a la racine du projet.
2. Lancer un serveur statique:

```bash
python3 -m http.server 8080
```

3. Ouvrir ensuite:

- `http://localhost:8080/slides/index.html`
- `http://localhost:8080/slides/editor.html`
- `http://localhost:8080/slides/viewer.html`

Illustration (index):

![Index presentaForge](./images/slides-index.png)

## 2. Editeur

L'editeur est organise en 4 zones principales:

- ruban d'actions en haut,
- liste des slides a gauche,
- zone de travail centrale,
- panneau de proprietes a droite.

![Editeur - vue generale](./images/editor-home.png)

### 2.1 Onglet Accueil

Permet de:

- creer/dupliquer/supprimer une diapositive,
- annuler/retablir,
- gerer le presse-papier,
- ouvrir/importer et sauvegarder.

### 2.2 Onglet Insertion

Permet d'ajouter:

- contenu (titre, texte, image, forme, tableau, video),
- widgets,
- elements interactifs (QCM, Likert, activites),
- blocs pedagogiques, layouts et pied de page.

![Editeur - Insertion](./images/editor-insertion-tab.png)

### 2.3 Onglet Conception

Permet de definir:

- theme,
- fond de slide,
- ratio,
- variantes visuelles par slide.

![Editeur - Conception](./images/editor-conception-tab.png)

### 2.4 Onglet Affichage

Permet de:

- lancer la presentation,
- exporter (JSON, PDF, HTML, PNG, PPTX, Markdown),
- ouvrir les outils de verification (checker, assets, tokens, plugins).

![Editeur - Affichage](./images/editor-affichage-tab.png)

## 3. Mode presentateur

Le mode presentateur est la vue de pilotage enseignant:

- slide courante + slide suivante,
- notes,
- minuteur,
- ouverture de salle et suivi audience.

![Mode presentateur](./images/presenter-overview.png)

Bonnes pratiques:

- ouvrir la salle des le debut,
- copier le lien stable pour Moodle/ENT,
- surveiller le diagnostic reseau si connexions mobiles instables.

## 4. Vue audience

La vue audience est passive:

- pas de pilotage local de la presentation,
- synchronisation avec le presentateur,
- affichage propre pour projection secondaire.

![Vue audience](./images/viewer-audience.png)

## 5. Mode etudiant

Le mode etudiant permet de:

- rejoindre une salle,
- suivre la presentation,
- repondre aux interactions autorisees,
- utiliser favoris/revision si actives.

![Mode etudiant](./images/student-mode.png)

## 6. Telecommande mobile

La telecommande mobile sert a:

- naviguer precedent/suivant,
- ecran noir,
- actions rapides de presentation,
- controle via salle + mot de passe si active.

Acces: `http://localhost:8080/slides/remote.html`

## 7. Exports

Depuis l'editeur (`Affichage`):

- Export JSON: format source principal.
- Export PDF: support impression.
- Export HTML: partage autonome.
- Export PNG/PPTX/Markdown selon usage.

Conseil: valider visuellement le rendu sur 2-3 slides avant diffusion.

## 8. Metadonnees et accessibilite

Dans `Accueil` > `Metadonnees`, renseigner au minimum:

- titre,
- auteur,
- niveau,
- etablissement.

Cote accessibilite:

- remplir l'alt text des images,
- verifier contraste texte/fond,
- eviter les slides trop charges.

## 9. Depannage rapide

- Si l'UI semble incoherente: `Ctrl+F5`.
- Si la synchro salle est instable: ouvrir diagnostic reseau en mode presentateur.
- Si un panneau est masque dans l'editeur: utiliser les poignets/boutons de re-ouverture.
- Si un export est incorrect: relancer un export apres rechargement de la presentation.

## 10. Identite visuelle presentaForge

Assets de marque utilises:

- `slides/assets/brand/presentaforge_favico.png`
- `slides/assets/brand/presentaforge_logo_dark.png`
- `slides/assets/brand/presentaforge_logo_light.png`
- `slides/assets/brand/presentaforge_text_dark.png`
- `slides/assets/brand/presentaforge_text_light.png`

## 11. Regenerer les captures (optionnel)

Si tu veux mettre a jour les captures du guide:

```bash
tools/slides/capture-user-guide-screenshots.sh
```

Les images sont generees dans `docs/user/images/`.
