# Ton bar · 50 ans

Petite application pour savoir quoi préparer avec les bouteilles qu’on a sous la main.
Une soixantaine de cocktails, dont 6 sans alcool. Site statique,
sans outil de build, publié sur GitHub Pages :
<https://sedivyk.github.io/bar-50-ans/>

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Seul point d’entrée : la page et tous les styles |
| `app/*.js` | Le code, en modules ES (aucune compilation, aucune dépendance) |
| `data/*.json` | Bouteilles, recettes, types, ambiances et crédits photo |
| `img/` | Une photo par recette, 800 × 500 |
| `icons/` | Le « 50 » doré, en plusieurs tailles |
| `manifest.webmanifest`, `sw.js` | PWA : installation et usage hors ligne |
| `tools/` | Scripts de maintenance (photos, recettes, types) |
| `tests/` | Vérifications Playwright en format iPhone |
| `ia/` | Le relais IA (Cloudflare Worker) qui garde la clé Gemini |

### Les modules

| Module | Rôle |
| --- | --- |
| `app/main.js` | Démarrage, onglets, gestes dans la page |
| `app/donnees.js` | Charge les JSON, y fond ses ajouts, tient les index |
| `app/stockage.js` | localStorage (inventaire) et IndexedDB (ses ajouts) |
| `app/accords.js` | Quelle recette est faisable, et avec quelle bouteille |
| `app/vues.js` | Le rendu des onglets |
| `app/idees.js` | L’onglet « Idées » : sa sélection, ses recettes, les idées de l’IA |
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
- `deco` sur chaque recette : une idée principale et deux ou trois variantes. Chaque idée
  peut citer des garnitures (`ids`) ; celles qu’elle a cochées sont mises en avant.
  **La déco ne bloque jamais une recette** : elle n’entre pas dans les ingrédients.
- `data/ambiances.json` : les regroupements par occasion — « C’est Noël », « Au bord de
  la piscine », « Avec mes grands », « Avec ma belle-sœur » et « Sans alcool ».
  Cette dernière ne contient que des recettes `sansAlcool`, et un test le vérifie en
  remontant jusqu’au type de chaque ingrédient, sans se fier à l’étiquette.

## Ses données à elle

Rien ne sort de son appareil, sauf quand elle touche « Inventer » dans l’onglet Idées
(voir plus bas).

- L’inventaire coché : `localStorage`, clé `ton-bar-50-v1` (inchangée depuis le début).
- La taille du texte (Grand, Plus grand, Très grand, en haut de Mon bar) : `localStorage`,
  clé `ton-bar-taille-v1`. Pour une lecture confortable, le texte de base fait 19 px et tout est en
  `rem`, pour que tout suive le réglage. `npm run test:lisibilite` vérifie qu’aucun texte
  ne descend sous 14,5 px et que rien ne déborde, même en « Très grand ».
- Ses notes (de ½ à 5 étoiles, par demi-étoile) : `localStorage`, clé `ton-bar-notes-v1`.
  Retoucher sa note l’efface ; le filtre par note n’apparaît qu’une fois une recette notée.
- Ses notes écrites sur une recette (« Mes notes » : ce qu’elle a changé, ce qu’on en a pensé) : `localStorage`, clé `ton-bar-commentaires-v1`. Elles sont exportées avec le reste et la recherche les lit.
- Ses bouteilles, ses recettes et ses photos : IndexedDB, base `ton-bar`.
- Les photos sont réduites à 800 px de large dans le navigateur avant d’être gardées.
- « Exporter mon bar » écrit un seul fichier JSON (photos et notes comprises) que
  « Importer mon bar » sait relire, pour changer de téléphone sans rien perdre.

## L’onglet « Idées »

Elle coche quelques ingrédients (tous décochés au départ, sans effet sur Mon bar) :
on lui montre ses recettes qui les utilisent, celles qui en utilisent le plus d’abord.
Sa sélection et les idées reçues restent dans `localStorage`, clé `ton-bar-idees-v1`.

« Inventer 3 recettes » demande de nouvelles recettes à Gemini. Elle n’a rien à
configurer : l’application appelle le relais `ia/worker.js`, qui seul connaît la clé.
On lui envoie les noms des ingrédients choisis, la liste des ingrédients connus (et
lesquels elle a) et les noms des recettes existantes, rien d’autre. « Garder dans mes
recettes » en fait une de ses recettes (IndexedDB, marquée `ia: true`).

Tant que `ADRESSE_IA` est vide dans `app/idees.js`, la partie IA n’apparaît pas.

### Le relais IA (une seule fois)

1. Une clé Gemini sur <https://aistudio.google.com/apikey>, dans un projet Google
   **sans facturation** : au pire, l’offre gratuite s’épuise, et rien n’est facturé.
2. Un compte Cloudflare (gratuit), puis :

   ```sh
   cd ia
   npx wrangler login
   npx wrangler secret put GEMINI_KEY     # colle la clé ; elle ne va jamais dans le dépôt
   npx wrangler deploy                    # affiche l'adresse https://ton-bar-ia.<compte>.workers.dev
   ```

3. Coller cette adresse dans `ADRESSE_IA` (`app/idees.js`), augmenter `VERSION`
   dans `sw.js`, pousser.

Le relais n’accepte que les appels venant de `https://sedivyk.github.io` (variable
`ORIGINES` de `ia/wrangler.toml`), construit lui-même la question et ne renvoie que des
recettes : ce n’est pas un accès libre à Gemini. Le modèle est `gemini-flash-lite-latest`,
le moins cher, modifiable par la variable `MODELE`. S’il est débordé, le relais
essaie d’autres modèles Flash (liste `MODELES_PAR_DEFAUT` dans `ia/worker.js`).

## Développement

Le site s’ouvre tel quel, mais les données sont chargées par `fetch` et le code
est en modules : il faut donc le servir en HTTP, pas l’ouvrir en `file://`.

```sh
npm install          # Playwright, pour les vérifications seulement
npm test             # toutes les séries ci-dessous
npm run test:base    # l'application : affichage, compteurs, PWA, hors ligne
npm run test:perso   # ses ajouts : bouteille, recette, photo, export/import
npm run test:deco    # garnitures, idées déco, astuces
npm run test:ambiances  # les occasions, et l'absence d'alcool chez les ados
npm run test:notes   # les étoiles, les demi-étoiles et le filtre par note
npm run test:commentaires # « Mes notes » sur une recette
npm run test:idees   # l'onglet Idées (relais simulé) et le relais lui-même
npm run test:live    # teste l'adresse GitHub Pages
```

Les vérifications tournent en format iPhone (390 × 844), en clair et en sombre,
et écrivent des captures dans `captures/` (non versionné).

## Scripts de maintenance

```sh
node tools/ajouter-recettes.mjs           # ajoute des recettes, en validant tout
node tools/ajouter-types.mjs              # (re)génère les types, idempotent
node tools/ajouter-deco.mjs               # garnitures et idées déco, idempotent
node tools/ajouter-ambiances.mjs          # occasions et recettes sans alcool
node tools/ajouter-grands.mjs             # bière, yuzu, mojitos, et les ambiances
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
