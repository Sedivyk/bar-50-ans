# Ton bar · 50 ans

Petite application pour savoir quoi préparer avec les bouteilles qu’on a sous la main.
Site statique, sans outil de build, publié sur GitHub Pages :
<https://sedivyk.github.io/bar-50-ans/>

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Seul point d’entrée : interface, styles et logique |
| `data/ingredients.json` | Les bouteilles, leur catégorie et celles présentes au départ |
| `data/recettes.json` | Les recettes, avec un identifiant stable et un type de verre |
| `manifest.webmanifest` | Déclaration PWA (nom, icônes, couleurs) |
| `sw.js` | Service worker : met le site en cache pour l’usage hors ligne |
| `icons/` | Le « 50 » doré, en plusieurs tailles |
| `tests/check.mjs` | Vérifications Playwright en format iPhone |

## Données

- `data/recettes.json` : chaque recette a un `id` en slug (`le-50`, `margarita-picante`…)
  qui ne doit jamais changer, un `verre` (`coupe`, `court`, `grand`, `shooter`, `tasse`)
  et une liste d’`ingredients` ; chacun porte une quantité `q`, les bouteilles
  possibles `ids`, et `facultatif: true` s’il peut être omis.
- `data/ingredients.json` : `categories` donne l’ordre d’affichage ;
  chaque bouteille a `id`, `nom`, `categorie` et `defaut` (cochée au départ).

L’inventaire coché est gardé dans le navigateur, sous la clé `ton-bar-50-v1`.
Rien n’est envoyé nulle part.

## Développement

Le site s’ouvre tel quel, mais les données sont chargées par `fetch` :
il faut donc le servir en HTTP, pas l’ouvrir en `file://`.

```sh
npm install          # Playwright, pour les vérifications seulement
npm test             # sert le dossier, teste en clair et en sombre, écrit captures/
npm run test:live    # teste l'adresse GitHub Pages
```

`npm test` vérifie le format iPhone (390 × 844), la justesse des compteurs après
un changement d’inventaire, l’absence d’image brisée et d’erreur console,
le manifeste et les icônes, et que l’application s’ouvre encore hors ligne.

## Déploiement

Pousser sur `main` suffit : GitHub Pages publie la racine du dépôt.
Après un changement de contenu mis en cache, augmenter `VERSION` dans `sw.js`
pour que les appareils déjà installés récupèrent la nouvelle version.

Le dépôt est public : aucune donnée personnelle, aucune clé, aucun jeton.
