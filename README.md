# Ton bar · 50 ans

Petite application pour savoir quoi préparer avec les bouteilles qu’on a sous la main.
50 recettes, une par année. Site statique, sans outil de build, publié sur GitHub Pages :
<https://sedivyk.github.io/bar-50-ans/>

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Seul point d’entrée : la page et tous les styles |
| `app/*.js` | Le code, en modules ES (aucune compilation, aucune dépendance) |
| `data/*.json` | Bouteilles, recettes, types et crédits photo |
| `img/` | Une photo par recette, 800 × 500 |
| `icons/` | Le « 50 » doré, en plusieurs tailles |
| `manifest.webmanifest`, `sw.js` | PWA : installation et usage hors ligne |
| `tools/` | Scripts de maintenance (photos, recettes, types) |
| `tests/` | Vérifications Playwright en format iPhone |

### Les modules

| Module | Rôle |
| --- | --- |
| `app/main.js` | Démarrage, onglets, gestes dans la page |
| `app/donnees.js` | Charge les JSON, y fond ses ajouts, tient les index |
| `app/stockage.js` | localStorage (inventaire) et IndexedDB (ses ajouts) |
| `app/accords.js` | Quelle recette est faisable, et avec quelle bouteille |
| `app/vues.js` | Le rendu des trois onglets |
| `app/formulaires.js` | Ajouter une bouteille, une recette, fiche d’une bouteille |
| `app/photos.js` | Réduction des photos dans le navigateur, puis IndexedDB |
| `app/transfert.js` | Exporter et réimporter son bar |
| `app/verres.js` | Les verres dessinés en SVG |

## Données

- `data/recettes.json` : chaque recette a un `id` en slug (`le-50`, `margarita-picante`…)
  qui ne doit jamais changer, un `verre` (`coupe`, `court`, `grand`, `shooter`, `tasse`)
  et une liste d’`ingredients`. Chaque ingrédient porte une quantité `q`, puis :
  - `types` — « n’importe quelle tequila blanche », ce qui est le cas le plus courant ;
  - `ids` — une bouteille précise, quand c’est elle qui fait le cocktail
    (le St-Germain dans « Le 50 », l’Aperol dans « Aperol soda ») ;
  - `facultatif: true` s’il peut être omis.
- `data/types.json` : le catalogue des types génériques, avec des exemples de marques.
  C’est ce qui permet à une bouteille ajoutée plus tard d’être reconnue tout de suite.
- `data/ingredients.json` : `categories` donne l’ordre d’affichage ; chaque bouteille a
  `id`, `nom`, `categorie`, `type` et `defaut` (cochée au départ).
- `data/credits.json` : photographe, source, licence et lien de chaque photo. La présence
  d’une entrée veut dire que `img/<slug>.jpg` existe ; sinon l’application dessine le verre.

## Ses données à elle

Rien ne sort de son appareil.

- L’inventaire coché : `localStorage`, clé `ton-bar-50-v1` (inchangée depuis le début).
- Ses bouteilles, ses recettes et ses photos : IndexedDB, base `ton-bar`.
- Les photos sont réduites à 800 px de large dans le navigateur avant d’être gardées.
- « Exporter mon bar » écrit un seul fichier JSON (photos comprises) que
  « Importer mon bar » sait relire, pour changer de téléphone sans rien perdre.

## Développement

Le site s’ouvre tel quel, mais les données sont chargées par `fetch` et le code
est en modules : il faut donc le servir en HTTP, pas l’ouvrir en `file://`.

```sh
npm install          # Playwright, pour les vérifications seulement
npm test             # les deux séries ci-dessous
npm run test:base    # l'application : affichage, compteurs, PWA, hors ligne
npm run test:perso   # ses ajouts : bouteille, recette, photo, export/import
npm run test:live    # teste l'adresse GitHub Pages
```

Les vérifications tournent en format iPhone (390 × 844), en clair et en sombre,
et écrivent des captures dans `captures/` (non versionné).

## Scripts de maintenance

```sh
node tools/ajouter-recettes.mjs           # ajoute des recettes, en validant tout
node tools/ajouter-types.mjs              # (re)génère les types, idempotent
set PEXAFY_KEY=...                        # clé d'API, jamais dans le dépôt
py -3 tools/photos.py                     # cherche les photos manquantes
py -3 tools/photos.py margarita-picante   # refait une photo
py -3 tools/photos.py --rang 1 le-50      # prend le résultat suivant
```

`tools/photos.py` cherche dans neuf banques libres de droits via
[Pexafy](https://pexafy.com), recadre en 800 × 500, garde le JPEG sous 150 Ko et
écrit `data/credits.json` ainsi qu’une page de révision `revision-photos.html`
à approuver avant de publier.

## Déploiement

Pousser sur `main` suffit : GitHub Pages publie la racine du dépôt.
Après un changement de contenu mis en cache, augmenter `VERSION` dans `sw.js`
pour que les appareils déjà installés récupèrent la nouvelle version.

Le dépôt est public : aucune donnée personnelle, aucune clé, aucun jeton.
Le site porte `noindex` et n’accepte aucune écriture venant de l’extérieur.
