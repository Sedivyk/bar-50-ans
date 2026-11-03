/* Phase 3 : les garnitures et les idées déco.

   node tools/ajouter-deco.mjs

   - ajoute la catégorie « Garnitures et déco » dans data/ingredients.json
     (tout décoché au départ, sauf le shimmer dust, qu'elle a déjà) ;
   - déplace le shimmer dust depuis « Amers et sirops », en gardant son id,
     pour ne pas perdre ce qui est coché dans son navigateur ;
   - ajoute les types de garnitures dans data/types.json ;
   - donne à chaque recette un champ « deco » : une idée principale et deux
     ou trois variantes, accordées au goût, à la couleur et à ce que montre
     la photo de la recette.

   Idempotent : relancer ne change rien. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const CAT = "Garnitures et déco";

/* ---------------------------------------------------- les types de garniture */

const TYPES_DECO = [
  ["fruit-seche", "Fruit séché", "Tranches d’orange, de lime, d’ananas séchées"],
  ["fruit-frais", "Fruit frais", "Orange, ananas, petits fruits"],
  ["herbe-fraiche", "Herbe fraîche", "Menthe, basilic, romarin"],
  ["perle-cocktail", "Perles à cocktail", "Perles de yuzu, perles de fruits"],
  ["cerise-cocktail", "Cerises à cocktail", "Luxardo, cerises au marasquin"],
  ["givrage", "Pour givrer le bord", "Sucre, sel, Tajín, sucre coloré"],
  ["fleur-comestible", "Fleurs comestibles", "Pensées, bourrache"],
  ["grain-cafe", "Grains de café", "Grains de café entiers"],
  ["epice-entiere", "Épice entière", "Bâton de cannelle, anis étoilé"],
  ["poudre-cacao", "Cacao", "Cacao en poudre"],
  ["zeste", "Zeste d’agrumes", "Zeste d’orange, de citron, de lime"]
];

/* ------------------------------------------------------ les garnitures elles-mêmes
   [id, nom, type]. Tout est décoché au départ, sauf le shimmer dust. */

const GARNITURES = [
  ["orange-sechee", "Tranches d’orange séchées", "fruit-seche"],
  ["citron-seche", "Tranches de citron séchées", "fruit-seche"],
  ["lime-sechee", "Tranches de lime séchées", "fruit-seche"],
  ["ananas-seche", "Tranches d’ananas séchées", "fruit-seche"],
  ["orange", "Oranges", "fruit-frais"],
  ["ananas", "Ananas", "fruit-frais"],
  ["petits-fruits", "Petits fruits", "fruit-frais"],
  ["menthe", "Menthe fraîche", "herbe-fraiche"],
  ["perles-cocktail", "Perles à cocktail", "perle-cocktail"],
  ["cerises-cocktail", "Cerises à cocktail", "cerise-cocktail"],
  ["sucre", "Sucre", "givrage"],
  ["sel", "Sel", "givrage"],
  ["tajin", "Tajín", "givrage"],
  ["sucre-colore", "Sucre coloré", "givrage"],
  ["fleurs-comestibles", "Fleurs comestibles", "fleur-comestible"],
  ["grains-cafe", "Grains de café", "grain-cafe"],
  ["baton-cannelle", "Bâton de cannelle", "epice-entiere"],
  ["cacao", "Cacao", "poudre-cacao"],
  ["zeste-agrumes", "Zeste d’agrumes", "zeste"]
];

/* ----------------------------------------------------------- les idées déco
   La première est l'idée principale. Les identifiants servent à mettre en
   avant ce qu'elle a déjà coché — jamais à bloquer une recette. */

const d = (texte, ...ids) => ({ texte, ids });

const DECO = {
  "le-50": [
    d("Une pincée de shimmer dust, juste avant de servir", "shimmer"),
    d("Un zeste de lime en spirale", "zeste-agrumes", "lime"),
    d("Une fleur comestible posée sur la mousse", "fleurs-comestibles")
  ],
  "margarita-st-germain": [
    d("Une tranche de lime sur le bord", "lime"),
    d("Un bord de sucre fin", "sucre"),
    d("Une fleur comestible", "fleurs-comestibles")
  ],
  "margarita-picante": [
    d("Un bord de Tajín et un quartier de lime", "tajin", "lime"),
    d("Un bord de sel", "sel"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "old-fashioned-tequila-erable": [
    d("Un grand zeste d’orange, tordu au-dessus du verre", "zeste-agrumes", "orange"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Une cerise à cocktail", "cerises-cocktail")
  ],
  "old-fashioned-a-l-erable": [
    d("Un zeste d’orange et une cerise", "zeste-agrumes", "cerises-cocktail"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Un bâton de cannelle", "baton-cannelle")
  ],
  "mai-tai": [
    d("Une tranche d’ananas et une branche de menthe", "ananas", "menthe"),
    d("Une tranche d’ananas séchée", "ananas-seche"),
    d("Une cerise à cocktail", "cerises-cocktail")
  ],
  "daiquiri-banane": [
    d("Une tranche de lime sur le bord", "lime"),
    d("Un peu de cacao râpé", "cacao"),
    d("Une fleur comestible", "fleurs-comestibles")
  ],
  "pornstar-martini": [
    d("Une demi-passion posée sur le dessus", "passion"),
    d("Une fleur comestible", "fleurs-comestibles"),
    d("Des perles à cocktail au fond du verre", "perles-cocktail")
  ],
  "espresso-martini-a-l-erable": [
    d("Trois grains de café sur la mousse", "grains-cafe"),
    d("Un voile de cacao", "cacao"),
    d("Un zeste d’orange", "zeste-agrumes")
  ],
  "carajillo": [
    d("Un zeste d’orange et quelques grains de café", "zeste-agrumes", "grains-cafe"),
    d("Un bâton de cannelle", "baton-cannelle"),
    d("Un voile de cacao", "cacao")
  ],
  "sour-amande-vanille": [
    d("Une fleur comestible posée sur la mousse", "fleurs-comestibles"),
    d("Trois gouttes d’amers, tirées en dessin", "angostura"),
    d("Une pincée de shimmer dust", "shimmer")
  ],
  "amaretto-sour": [
    d("Une cerise et une tranche d’orange séchée", "cerises-cocktail", "orange-sechee"),
    d("Un zeste d’orange", "zeste-agrumes"),
    d("Trois gouttes d’amers sur la mousse", "angostura")
  ],
  "godfather-sucre": [
    d("Un zeste d’orange", "zeste-agrumes"),
    d("Une cerise à cocktail", "cerises-cocktail"),
    d("Une tranche d’orange séchée", "orange-sechee")
  ],
  "gin-soda-boreal": [
    d("Une tranche de citron et une branche de menthe", "citron", "menthe"),
    d("Des petits fruits au fond du verre", "petits-fruits"),
    d("Une tranche de citron séchée", "citron-seche")
  ],
  "collins-au-sureau": [
    d("Une tranche de citron et une cerise", "citron", "cerises-cocktail"),
    d("Une fleur comestible", "fleurs-comestibles"),
    d("Une tranche de citron séchée", "citron-seche")
  ],
  "tom-collins": [
    d("Une tranche de citron et une cerise", "citron", "cerises-cocktail"),
    d("Une tranche de citron séchée", "citron-seche"),
    d("Une branche de menthe", "menthe")
  ],
  "jardin-d-aperol": [
    d("Une tranche d’orange et une branche de menthe", "orange", "menthe"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Des petits fruits", "petits-fruits")
  ],
  "aperol-soda": [
    d("Une tranche d’orange", "orange"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Un zeste d’orange", "zeste-agrumes")
  ],
  "lagon-bleu": [
    d("Une tranche de lime et une cerise", "lime", "cerises-cocktail"),
    d("Du sucre coloré sur le bord", "sucre-colore"),
    d("Des perles à cocktail au fond", "perles-cocktail")
  ],
  "moscow-mule": [
    d("Un quartier de lime et une grosse branche de menthe", "lime", "menthe"),
    d("Une tranche de lime séchée", "lime-sechee"),
    d("Des petits fruits", "petits-fruits")
  ],
  "dark-n-stormy": [
    d("Un quartier de lime", "lime"),
    d("Un bâton de cannelle", "baton-cannelle"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "jager-mule": [
    d("Un quartier de lime et de la menthe", "lime", "menthe"),
    d("Une tranche de lime séchée", "lime-sechee"),
    d("Un zeste d’orange", "zeste-agrumes")
  ],
  "rhum-epice-cola": [
    d("Un quartier de lime", "lime"),
    d("Un bâton de cannelle", "baton-cannelle"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "tequila-sunrise": [
    d("Une tranche d’orange et une cerise", "orange", "cerises-cocktail"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Une pincée de shimmer dust", "shimmer")
  ],
  "harvey-wallbanger": [
    d("Une tranche d’orange et une cerise", "orange", "cerises-cocktail"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Un zeste d’orange", "zeste-agrumes")
  ],
  "shooter-banana-split": [
    d("Une cerise à cocktail piquée sur le verre", "cerises-cocktail"),
    d("Un peu de cacao", "cacao"),
    d("Du sucre coloré sur le bord", "sucre-colore")
  ],
  "tarte-aux-pommes-a-la-mode": [
    d("Une râpée de cannelle sur le dessus", "baton-cannelle"),
    d("Un bord de sucre", "sucre"),
    d("Un peu de cacao", "cacao")
  ],
  "tasse-au-beurre-d-arachide": [
    d("Un voile de cacao", "cacao"),
    d("Trois grains de café", "grains-cafe"),
    d("Un bord de sucre", "sucre")
  ],
  "cafe-cremeux": [
    d("Un voile de cacao sur la crème", "cacao"),
    d("Un bâton de cannelle", "baton-cannelle"),
    d("Trois grains de café", "grains-cafe")
  ],
  "margarita-classique": [
    d("Un bord de sel et un quartier de lime", "sel", "lime"),
    d("Un bord de Tajín", "tajin"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "daiquiri-classique": [
    d("Une tranche de lime sur le bord", "lime"),
    d("Une tranche de lime séchée", "lime-sechee"),
    d("Une fleur comestible", "fleurs-comestibles")
  ],
  "whisky-sour": [
    d("Une cerise et un zeste d’orange", "cerises-cocktail", "zeste-agrumes"),
    d("Trois gouttes d’amers sur la mousse", "angostura"),
    d("Une tranche d’orange séchée", "orange-sechee")
  ],
  "gimlet-au-sureau": [
    d("Une tranche de lime sur le bord", "lime"),
    d("Une fleur comestible", "fleurs-comestibles"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "sour-a-l-orgeat": [
    d("Une tranche de citron séchée posée sur la mousse", "citron-seche"),
    d("Trois gouttes d’amers", "angostura"),
    d("Une fleur comestible", "fleurs-comestibles")
  ],
  "sidecar-a-l-erable": [
    d("Un bord de sucre et un zeste d’orange", "sucre", "zeste-agrumes"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Une cerise à cocktail", "cerises-cocktail")
  ],
  "jagerita": [
    d("Un quartier de lime et une branche de menthe", "lime", "menthe"),
    d("Un bord de sel", "sel"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "ciel-bleu": [
    d("Un zeste de citron en spirale", "zeste-agrumes", "citron"),
    d("Du sucre coloré sur le bord", "sucre-colore"),
    d("Des perles à cocktail", "perles-cocktail")
  ],
  "espresso-martini-classique": [
    d("Trois grains de café sur la mousse", "grains-cafe"),
    d("Un voile de cacao", "cacao"),
    d("Une pincée de shimmer dust", "shimmer")
  ],
  "paloma-maison": [
    d("Un bord de sel et une tranche de lime", "sel", "lime"),
    d("Une branche de menthe", "menthe"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "rhum-collins": [
    d("Une tranche de lime et de la menthe", "lime", "menthe"),
    d("Une tranche de citron séchée", "citron-seche"),
    d("Des petits fruits", "petits-fruits")
  ],
  "vodka-soda-au-sureau": [
    d("Un zeste de citron et une fleur comestible", "zeste-agrumes", "fleurs-comestibles"),
    d("Des petits fruits au fond du verre", "petits-fruits"),
    d("Une tranche de citron séchée", "citron-seche")
  ],
  "spritz-flor-del-fuego": [
    d("Une tranche d’orange", "orange"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Des petits fruits", "petits-fruits")
  ],
  "poisson-rouge-soda": [
    d("Un quartier de lime et des petits fruits", "lime", "petits-fruits"),
    d("Du sucre coloré sur le bord", "sucre-colore"),
    d("Une fleur comestible", "fleurs-comestibles")
  ],
  "tequila-soda-lime": [
    d("Deux quartiers de lime", "lime"),
    d("Un bord de sel", "sel"),
    d("Une tranche de lime séchée", "lime-sechee")
  ],
  "black-russian": [
    d("Un zeste d’orange", "zeste-agrumes"),
    d("Trois grains de café", "grains-cafe"),
    d("Une cerise à cocktail", "cerises-cocktail")
  ],
  "vieux-carre-d-erable": [
    d("Un zeste d’orange et une cerise", "zeste-agrumes", "cerises-cocktail"),
    d("Une tranche d’orange séchée", "orange-sechee"),
    d("Un bâton de cannelle", "baton-cannelle")
  ],
  "shooter-erable-cannelle": [
    d("Une râpée de cannelle sur le dessus", "baton-cannelle"),
    d("Un bord de sucre", "sucre"),
    d("Une pincée de shimmer dust", "shimmer")
  ],
  "b-52-maison": [
    d("Un voile de cacao", "cacao"),
    d("Trois grains de café", "grains-cafe"),
    d("Du sucre coloré sur le bord", "sucre-colore")
  ],
  "cafe-a-l-amaretto": [
    d("Un bâton de cannelle dans la tasse", "baton-cannelle"),
    d("Un voile de cacao", "cacao"),
    d("Un zeste d’orange", "zeste-agrumes")
  ],
  "tasse-chocolat-cafe": [
    d("Un voile de cacao sur la crème", "cacao"),
    d("Trois grains de café", "grains-cafe"),
    d("Un bâton de cannelle", "baton-cannelle")
  ]
};

// ---------------------------------------------------------------------------

const ingPath = path.join(DATA, "ingredients.json");
const recPath = path.join(DATA, "recettes.json");
const typPath = path.join(DATA, "types.json");

const ing = JSON.parse(fs.readFileSync(ingPath, "utf8"));
const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
const typ = JSON.parse(fs.readFileSync(typPath, "utf8"));

// 1. les types
const connusT = new Set(typ.types.map((t) => t.id));
for (const [id, nom, exemples] of TYPES_DECO) {
  if (!connusT.has(id)) typ.types.push({ id, nom, famille: CAT, exemples });
}
// la poudre scintillante rejoint les garnitures
const scint = typ.types.find((t) => t.id === "poudre-scintillante");
if (scint) scint.famille = CAT;
if (!typ.familles.includes(CAT)) typ.familles.push(CAT);

// 2. la catégorie et les garnitures
if (!ing.categories.includes(CAT)) ing.categories.push(CAT);
const connusI = new Map(ing.ingredients.map((b) => [b.id, b]));
for (const [id, nom, type] of GARNITURES) {
  if (connusI.has(id)) {
    const b = connusI.get(id);
    if (b.categorie !== CAT) throw new Error(`l'id « ${id} » est déjà pris par « ${b.nom} »`);
    continue;
  }
  const b = { id, nom, categorie: CAT, defaut: false, type };
  ing.ingredients.push(b);
  connusI.set(id, b);
}
// le shimmer dust change de rayon, mais garde son id : rien de coché n'est perdu
const shimmer = connusI.get("shimmer");
if (shimmer) shimmer.categorie = CAT;

// 3. les idées déco
let posees = 0;
for (const r of rec) {
  const idees = DECO[r.id];
  if (!idees) {
    if (!r.deco) console.log("  ! aucune idée déco pour " + r.id);
    continue;
  }
  for (const i of idees) {
    for (const id of i.ids) {
      if (!connusI.has(id)) throw new Error(`${r.id} : garniture inconnue « ${id} »`);
    }
  }
  r.deco = idees.map((i) => (i.ids.length ? { texte: i.texte, ids: i.ids } : { texte: i.texte }));
  posees++;
}

// 4. la déco ne doit jamais empêcher un cocktail d'apparaître
const have = {};
for (const b of ing.ingredients) have[b.id] = !!b.defaut;
const parType = {};
for (const b of ing.ingredients) (parType[b.type] ||= []).push(b.id);
const possede = (x) =>
  (x.ids || []).some((id) => have[id]) ||
  (x.types || []).some((t) => (parType[t] || []).some((id) => have[id]));
const manque = (r) => r.ingredients.filter((x) => !x.facultatif && !possede(x)).length;
const ok = rec.filter((r) => manque(r) === 0).length;
const presque = rec.filter((r) => manque(r) === 1).length;

fs.writeFileSync(typPath, JSON.stringify(typ, null, 2) + "\n", "utf8");
fs.writeFileSync(ingPath, JSON.stringify(ing, null, 2) + "\n", "utf8");
fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + "\n", "utf8");

const garnitures = ing.ingredients.filter((b) => b.categorie === CAT);
const cochees = garnitures.filter((b) => b.defaut).map((b) => b.nom);
console.log(`${garnitures.length} garnitures dans « ${CAT} »`);
console.log(`cochée(s) au départ : ${cochees.join(", ") || "aucune"}`);
console.log(`${posees} recettes ont des idées déco (sur ${rec.length})`);
console.log(`compteurs inchangés attendus : ${ok} « je peux faire », ${presque} « presque »`);
