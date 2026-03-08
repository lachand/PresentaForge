# Guide utilisateur slideForge (complet)

Ce document décrit l'utilisation de l'application `slideForge` côté:

- édition de cours,
- présentation enseignant,
- diffusion audience,
- participation étudiant,
- contrôle distant.

Il inclut des captures réelles du DOM de l'application.

## 0. Identité visuelle `slideForge`

Assets utilisés dans l'application:

- `slides/assets/brand/presentaforge_favico.png` (favicon)
- `slides/assets/brand/presentaforge_logo_dark.png` (logo compact sur fond clair)
- `slides/assets/brand/presentaforge_logo_light.png` (logo compact sur fond sombre)
- `slides/assets/brand/presentaforge_text_dark.png` (logotype sur fond clair)
- `slides/assets/brand/presentaforge_text_light.png` (logotype sur fond sombre)

Prévisualisation:

![slideForge logotype clair](../../slides/assets/brand/presentaforge_text_dark.png)

![slideForge logotype sombre](../../slides/assets/brand/presentaforge_text_light.png)

## 1. Accès et démarrage

### 1.1 Lancer l'application en local

1. Ouvrir un terminal à la racine du projet.
2. Lancer un serveur web statique (exemple):

```bash
python3 -m http.server 8080
```

3. Ouvrir les URLs:

- `http://localhost:8080/slides/index.html` (index)
- `http://localhost:8080/slides/editor.html` (éditeur)
- `http://localhost:8080/slides/viewer.html` (visualisation)

### 1.2 Écran d'index

L'index centralise les présentations disponibles.

![Index desktop](./images/slides-index.png)

Version mobile:

![Index mobile](./images/slides-index-mobile.png)

## 2. Éditeur: vue générale

L'éditeur est organisé en 4 zones:

- ruban supérieur (actions),
- colonne slides à gauche (filmstrip),
- zone d'aperçu centrale,
- panneau de propriétés à droite.

![Éditeur - vue globale](./images/editor-home.png)

Capture complémentaire (vue éditeur alternative):

![Éditeur - overview](./images/editor-overview.png)

Version mobile (comportement responsive):

![Éditeur mobile](./images/editor-mobile.png)

## 3. Onglets du ruban

## 3.1 Accueil

Principales actions:

- créer, dupliquer, supprimer, déplacer un slide,
- annuler/rétablir,
- couper/copier/coller,
- ouvrir/importer.

![Éditeur - Accueil](./images/editor-home.png)

## 3.2 Insertion

Permet d'insérer:

- texte, image, forme, code, widgets,
- éléments d'évaluation (QCM, Likert, etc.),
- composants de facilitation (post-it live, roulette, stats, leaderboard),
- structures pédagogiques (footer, layouts, blocs).

![Éditeur - Insertion](./images/editor-insertion-tab.png)

### 3.2.1 Configuration du pied de page

![Modal pied de page](./images/editor-footer-modal.png)

### 3.2.2 Dispositions et masters

![Modal dispositions/masters](./images/editor-layout-master-modal.png)

### 3.2.3 Blocs pédagogiques

![Modal blocs](./images/editor-block-presets-modal.png)

## 3.3 Conception

Personnalisation visuelle:

- thème global,
- fond du slide (couleur / image / gradient),
- transitions,
- overrides par slide,
- ratio et polices.

![Éditeur - Conception](./images/editor-conception-tab.png)

Capture complémentaire (conception alternative):

![Conception - alternative](./images/editor-design-tab.png)

### 3.3.1 Gestionnaire de thèmes

![Gestionnaire de thèmes](./images/editor-theme-manager-modal.png)

## 3.4 Affichage

Actions de sortie et d'inspection:

- exports (JSON, PDF, HTML, PNG, PPTX, Markdown, ZIP),
- lancement diaporama,
- trieuse / mode plan,
- checker qualité,
- assets manager,
- design tokens,
- plugins widgets.

![Éditeur - Affichage](./images/editor-affichage-tab.png)

### 3.4.1 Menu export

![Menu export](./images/editor-export-menu.png)

### 3.4.2 Menu présenter

![Menu présenter](./images/editor-presenter-menu.png)

### 3.4.3 Outils d'audit/maintenance

Checker:

![Checker](./images/editor-checker-modal.png)

Gestionnaire d'assets:

![Assets manager](./images/editor-assets-modal.png)

Design tokens:

![Design tokens](./images/editor-design-tokens-modal.png)

Plugins widgets:

![Plugins widgets](./images/editor-widget-plugins-modal.png)

## 4. Modales et configurations globales

## 4.1 Métadonnées de la présentation

Permet de renseigner titre, auteur, niveau, établissement, description, etc.

![Métadonnées](./images/editor-metadata-modal.png)

## 4.2 Thème clair/sombre de l'éditeur

Basculer l'interface utilisateur en clair/sombre (hors thème de slides).

![Éditeur en thème clair](./images/editor-light-theme.png)

## 5. Vues de travail alternatives

## 5.1 Trieuse de diapositives

Vue grille pour réordonner rapidement.

![Trieuse](./images/editor-sorter-view.png)

## 5.2 Mode plan

Vue orientée structure et navigation.

![Mode plan](./images/editor-outline-view.png)

## 5.3 Colonne slides réduite

Quand la colonne gauche est réduite:

- bouton de ré-ouverture disponible,
- poignée gauche réutilisable pour ré-étendre.

![Colonne slides réduite](./images/editor-slides-collapsed.png)

## 6. Mode présentateur

Le mode présentateur fournit:

- slide courante,
- slide suivante,
- notes,
- contrôles de navigation,
- contrôle salle/réseau.

![Présentateur - vue générale](./images/presenter-overview.png)

Capture complémentaire (présentateur alternative):

![Présentateur - mode](./images/presenter-mode.png)

## 6.1 Salle étudiants (modale)

Suivi en direct:

- participants,
- mains levées,
- questions,
- outils de pilotage.

![Présentateur - salle](./images/presenter-room-modal.png)

Onglet questions:

![Présentateur - questions](./images/presenter-room-questions-tab.png)

## 6.2 Diagnostic réseau

Pour surveiller/reconfigurer la connectivité temps réel.

![Présentateur - réseau](./images/presenter-network-panel.png)

## 6.3 Scène orientée notes

Préset de layout mettant l'accent sur les notes.

![Présentateur - focus notes](./images/presenter-notes-focus.png)

## 7. Vue audience

Affichage passif synchronisé depuis le présentateur.

![Viewer standard](./images/viewer-standard.png)

Variante audience:

![Viewer audience](./images/viewer-audience.png)

## 8. Mode étudiant

Le mode étudiant sert à:

- suivre la présentation synchronisée,
- répondre aux interactions autorisées (QCM/sondages/etc.).

![Mode étudiant](./images/student-mode.png)

Version mobile:

![Mode étudiant mobile](./images/student-mobile.png)

## 9. Contrôle distant et quiz étudiant

Télécommande distante:

![Remote control](./images/remote-control.png)

Page quiz étudiant:

![Quiz étudiant](./images/quiz-student.png)

## 10. Parcours recommandé (enseignant)

1. Préparer la présentation dans l'éditeur (`Accueil` + `Insertion` + `Conception`).
2. Vérifier (`Affichage` > checker / assets).
3. Ouvrir le mode présentateur.
4. Ouvrir la salle étudiants et copier le lien stable.
5. Présenter, animer les interactions, suivre les retours salle.
6. Exporter les livrables nécessaires (JSON/HTML/PDF/PPTX selon usage).

## 11. Accessibilité (bonnes pratiques)

- Remplir le texte alternatif (`alt text`) pour les éléments visuels.
- Maintenir un contraste suffisant texte/fond.
- Éviter les blocs trop denses; préférer des slides lisibles à distance.
- Utiliser des libellés explicites pour les éléments interactifs.

## 12. Dépannage rapide

- Après update front, faire un hard refresh: `Ctrl+F5`.
- Si un panneau semble figé, recharger la page puis rouvrir le document.
- Si la synchro temps réel est instable, ouvrir le diagnostic réseau côté présentateur.
- En mode éditeur, si la colonne gauche est réduite:
  - cliquer le bouton d'expansion dans la zone preview,
  - ou glisser la poignée verticale gauche.

## 13. Régénérer les captures du guide

Les captures sont générées depuis rendu DOM réel (Chromium headless).

Script:

```bash
tools/slides/capture-user-guide-screenshots.sh
```

Fichiers générés dans:

- `docs/user/images/`
