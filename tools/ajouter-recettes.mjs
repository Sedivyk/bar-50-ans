/* Ajoute des recettes à data/recettes.json, avec vérifications.
   node tools/ajouter-recettes.mjs
   Le script est idempotent : une recette déjà présente est ignorée. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const SHAKE = "Secoue fort avec beaucoup de glace, puis filtre dans une coupe.";
const BUILD = "Verse sur glace dans un grand verre, complète et remue doucement.";
const STIR = "Remue 20 secondes avec de la glace, puis verse sur un gros glaçon.";

const TEQ = ["patron", "casamigos"];
const RUM = ["brugal", "appleton", "cihuatan"];
const AMA = ["amaretto_miel", "amaretto_erable"];
const COFL = ["cafe_liq", "espresso_liq", "tiamaria"];
const GIN = ["beefeater", "romeos", "ungava"];
const WHISKY = ["gretzky", "auchen"];
const VODKA = ["highseas", "vvanille"];

/* q = quantité, ids = bouteilles possibles, o = facultatif */
const i = (q, ids, o) => (o ? { q, ids, facultatif: true } : { q, ids });

const NOUVELLES = [
  // ---------------------------------------------------------------- coupes
  {
    id: "margarita-classique", nom: "Margarita classique", verre: "coupe",
    ingredients: [i("2 oz", TEQ), i("1 oz", ["grandmarnier"]), i("¾ oz", ["lime"])],
    methode: SHAKE,
    note: "La vraie, la simple. Un bord de sel si le cœur t’en dit."
  },
  {
    id: "daiquiri-classique", nom: "Daïquiri classique", verre: "coupe",
    ingredients: [i("2 oz", RUM), i("1 oz", ["lime"]), i("½ oz", ["sirop"])],
    methode: SHAKE,
    note: "Trois ingrédients, rien à cacher : c’est le test d’un bon rhum."
  },
  {
    id: "whisky-sour", nom: "Whisky Sour", verre: "coupe",
    ingredients: [i("2 oz", WHISKY), i("1 oz", ["citron"]), i("½ oz", ["sirop"]),
      i("1 blanc", ["oeuf"], 1)],
    methode: SHAKE,
    note: "Le blanc d’œuf n’ajoute aucun goût : il donne la mousse."
  },
  {
    id: "gimlet-au-sureau", nom: "Gimlet au sureau", verre: "coupe",
    ingredients: [i("2 oz", GIN), i("¾ oz", ["stgermain"]), i("¾ oz", ["lime"])],
    methode: SHAKE,
    note: "Le gimlet classique, en plus floral."
  },
  {
    id: "sour-a-l-orgeat", nom: "Sour à l’orgeat", verre: "coupe",
    ingredients: [i("2 oz", GIN), i("¾ oz", ["citron"]), i("½ oz", ["orgeat"]),
      i("1 blanc", ["oeuf"], 1)],
    methode: SHAKE,
    note: "L’orgeat du Mai Tai, mais tout en douceur."
  },
  {
    id: "sidecar-a-l-erable", nom: "Sidecar à l’érable", verre: "coupe",
    ingredients: [i("1½ oz", WHISKY), i("¾ oz", ["grandmarnier"]), i("¾ oz", ["citron"]),
      i("¼ oz", ["gv"])],
    methode: SHAKE,
    note: "Un sidecar qui a passé l’hiver au Québec."
  },
  {
    id: "jagerita", nom: "Jägerita", verre: "coupe",
    ingredients: [i("1 oz", ["jager"]), i("1 oz", ["grandmarnier"]), i("¾ oz", ["lime"])],
    methode: SHAKE,
    note: "Oui, vraiment : le Jäger et la lime vont étonnamment bien ensemble."
  },
  {
    id: "ciel-bleu", nom: "Ciel bleu", verre: "coupe",
    ingredients: [i("1½ oz", GIN), i("¾ oz", ["sourpuss"]), i("¾ oz", ["citron"])],
    methode: SHAKE,
    note: "La couleur fait la moitié du travail."
  },
  {
    id: "espresso-martini-classique", nom: "Espresso Martini classique", verre: "coupe",
    ingredients: [i("1½ oz", VODKA), i("1 oz", COFL), i("1 oz", ["cafe"])],
    methode: SHAKE,
    note: "Secoue plus fort que tu penses : c’est ce qui fait la mousse."
  },

  // ---------------------------------------------------------------- grands verres
  {
    id: "paloma-maison", nom: "Paloma maison", verre: "grand",
    ingredients: [i("2 oz", TEQ), i("¾ oz", ["lime"]), i("½ oz", ["sirop", "agave"]),
      i("4 oz", ["clubsoda"])],
    methode: BUILD,
    note: "Le cocktail de tous les jours au Mexique."
  },
  {
    id: "rhum-collins", nom: "Rhum Collins", verre: "grand",
    ingredients: [i("2 oz", RUM), i("1 oz", ["lime"]), i("½ oz", ["sirop"]),
      i("3 oz", ["clubsoda"])],
    methode: BUILD
  },
  {
    id: "vodka-soda-au-sureau", nom: "Vodka soda au sureau", verre: "grand",
    ingredients: [i("1½ oz", VODKA), i("¾ oz", ["stgermain"]), i("½ oz", ["citron"]),
      i("3 oz", ["clubsoda"])],
    methode: BUILD
  },
  {
    id: "spritz-flor-del-fuego", nom: "Spritz Flor del Fuego", verre: "grand",
    ingredients: [i("1 oz", ["flor"]), i("1 oz", ["aperol"]), i("3 oz", ["clubsoda"]),
      i("½ oz", ["citron"], 1)],
    methode: BUILD,
    note: "Pour sortir enfin la Flor del Fuego de la tablette."
  },
  {
    id: "poisson-rouge-soda", nom: "Poisson rouge soda", verre: "grand",
    ingredients: [i("1½ oz", ["poisson"]), i("½ oz", ["lime"]), i("4 oz", ["clubsoda"])],
    methode: BUILD,
    note: "Simple et rose, comme il se doit."
  },
  {
    id: "tequila-soda-lime", nom: "Tequila soda lime", verre: "grand",
    ingredients: [i("2 oz", TEQ), i("½ oz", ["lime"]), i("4 oz", ["clubsoda"])],
    methode: BUILD,
    note: "Le plus léger du lot. Parfait quand la soirée est longue."
  },

  // ---------------------------------------------------------------- verres courts
  {
    id: "black-russian", nom: "Black Russian", verre: "court",
    ingredients: [i("2 oz", ["highseas"]), i("1 oz", COFL)],
    methode: "Verse sur un gros glaçon et remue doucement.",
    note: "Deux ingrédients, et il traverse les décennies."
  },
  {
    id: "vieux-carre-d-erable", nom: "Vieux carré d’érable", verre: "court",
    ingredients: [i("1 oz", WHISKY), i("1 oz", RUM), i("¼ oz", ["gv"]),
      i("2 traits", ["angostura", "orangebit"])],
    methode: STIR,
    note: "Le whisky et le rhum ensemble : plus rond que l’un ou l’autre."
  },

  // ---------------------------------------------------------------- shooters
  {
    id: "shooter-erable-cannelle", nom: "Shooter érable-cannelle", verre: "shooter",
    ingredients: [i("¾ oz", ["gv"]), i("¼ oz", ["fireball"])],
    methode: "Verse le Grands Voyageurs, puis le Fireball par-dessus. Sers bien froid."
  },
  {
    id: "b-52-maison", nom: "B-52 maison", verre: "shooter",
    ingredients: [i("½ oz", COFL), i("½ oz", ["licor43"]), i("½ oz", ["grandmarnier"])],
    methode: "Verse dans l’ordre, doucement sur le dos d’une cuillère, pour garder les trois étages."
  },

  // ---------------------------------------------------------------- tasses
  {
    id: "cafe-a-l-amaretto", nom: "Café à l’amaretto", verre: "tasse",
    ingredients: [i("1 oz", AMA), i("5 oz", ["cafe"]), i("1 oz", ["creme"], 1)],
    methode: "Verse l’amaretto dans un café chaud et remue."
  },
  {
    id: "tasse-chocolat-cafe", nom: "Tasse chocolat-café", verre: "tasse",
    ingredients: [i("1 oz", ["olmeca"]), i("1 oz", COFL), i("4 oz", ["cafe"])],
    methode: "Verse dans une tasse de café chaud et remue.",
    note: "L’Olmeca chocolat noir prend tout son sens ici."
  }
];

// ------------------------------------------------------------------ écriture

const ing = JSON.parse(fs.readFileSync(path.join(DATA, "ingredients.json"), "utf8"));
const connus = new Set(ing.ingredients.map((x) => x.id));
const recettes = JSON.parse(fs.readFileSync(path.join(DATA, "recettes.json"), "utf8"));
const deja = new Set(recettes.map((r) => r.id));

const VERRES = ["coupe", "court", "grand", "shooter", "tasse"];
let ajoutees = 0;

for (const r of NOUVELLES) {
  if (!/^[a-z0-9-]+$/.test(r.id)) throw new Error("slug invalide : " + r.id);
  if (!VERRES.includes(r.verre)) throw new Error(r.id + " : verre inconnu " + r.verre);
  if (!r.ingredients.length) throw new Error(r.id + " : aucun ingrédient");
  for (const x of r.ingredients) {
    for (const id of x.ids) {
      if (!connus.has(id)) throw new Error(r.id + " référence une bouteille inconnue : " + id);
    }
  }
  if (deja.has(r.id)) { console.log("  = " + r.id + " (déjà présente)"); continue; }
  recettes.push(r);
  deja.add(r.id);
  ajoutees++;
}

fs.writeFileSync(path.join(DATA, "recettes.json"),
  JSON.stringify(recettes, null, 2) + "\n", "utf8");

// combien sont réalisables avec l'inventaire de départ ?
const have = {};
for (const x of ing.ingredients) have[x.id] = !!x.defaut;
const manque = (r) =>
  r.ingredients.filter((x) => !x.facultatif && !x.ids.some((id) => have[id])).length;
const ok = recettes.filter((r) => manque(r) === 0).length;
const presque = recettes.filter((r) => manque(r) === 1).length;

console.log(`\n${ajoutees} recette(s) ajoutée(s) — ${recettes.length} au total`);
console.log(`avec l'inventaire de départ : ${ok} « je peux faire », ${presque} « presque »`);
const parVerre = {};
for (const r of recettes) parVerre[r.verre] = (parVerre[r.verre] || 0) + 1;
console.log("par verre :", parVerre);
