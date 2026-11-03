/* Les ambiances : quelques cocktails regroupés par occasion.

   node tools/ajouter-ambiances.mjs

   Ajoute aussi six recettes sans alcool, pour que « Avec mes ados » ait
   de quoi servir. Elles sont marquées sansAlcool et le script refuse de
   mettre quoi que ce soit d'autre dans cette ambiance-là.

   Les 50 cocktails restent les 50 : les sans-alcool sont à part. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const LONG = "Verse sur beaucoup de glace dans un grand verre et remue doucement.";
const i = (q, ids, o) => (o ? { q, ids, facultatif: true } : { q, ids });
const d = (texte, ...ids) => (ids.length ? { texte, ids } : { texte });

/* ------------------------------------------------------- six sans alcool */

const SANS_ALCOOL = [
  {
    id: "limonade-petillante", nom: "Limonade pétillante", verre: "grand", sansAlcool: true,
    ingredients: [i("1 oz", ["citron"]), i("½ oz", ["sirop"]), i("5 oz", ["clubsoda"])],
    methode: LONG,
    note: "La base de tout. Ajoute des petits fruits ou de la menthe si tu en as.",
    deco: [d("Une branche de menthe et des petits fruits", "menthe", "petits-fruits"),
      d("Une tranche de citron séchée", "citron-seche"),
      d("Du sucre coloré sur le bord", "sucre-colore")]
  },
  {
    id: "soda-a-l-orgeat", nom: "Soda à l’orgeat", verre: "grand", sansAlcool: true,
    ingredients: [i("¾ oz", ["orgeat"]), i("½ oz", ["lime"]), i("5 oz", ["clubsoda"])],
    methode: LONG,
    note: "L’orgeat du Mai Tai, tout seul : doux, avec un fond d’amande.",
    deco: [d("Un quartier de lime", "lime"),
      d("Une cerise à cocktail", "cerises-cocktail"),
      d("Une tranche de lime séchée", "lime-sechee")]
  },
  {
    id: "passion-petillante", nom: "Passion pétillante", verre: "grand", sansAlcool: true,
    ingredients: [i("1 oz", ["passion"]), i("½ oz", ["lime"]), i("4 oz", ["clubsoda"])],
    methode: LONG,
    deco: [d("Une fleur comestible", "fleurs-comestibles"),
      d("Des petits fruits au fond du verre", "petits-fruits"),
      d("Un quartier de lime", "lime")]
  },
  {
    id: "cafe-frappe", nom: "Café frappé", verre: "grand", sansAlcool: true,
    ingredients: [i("4 oz", ["cafe"]), i("½ oz", ["sirop"]), i("1 oz", ["creme"], 1)],
    methode: "Secoue le café froid avec le sirop et beaucoup de glace, puis verse dans un grand verre.",
    deco: [d("Trois grains de café", "grains-cafe"),
      d("Un voile de cacao", "cacao"),
      d("Un bâton de cannelle", "baton-cannelle")]
  },
  {
    id: "shirley-temple", nom: "Shirley Temple", verre: "grand", sansAlcool: true,
    ingredients: [i("¾ oz", ["grenadine"]), i("½ oz", ["lime"]), i("5 oz", ["clubsoda"])],
    methode: LONG,
    note: "Le classique des enfants depuis les années 1930. La cerise n’est pas facultative.",
    deco: [d("Une cerise à cocktail", "cerises-cocktail"),
      d("Un quartier de lime", "lime"),
      d("Du sucre coloré sur le bord", "sucre-colore")]
  },
  {
    id: "mule-sans-alcool", nom: "Mule sans alcool", verre: "grand", sansAlcool: true,
    ingredients: [i("½ oz", ["lime"]), i("5 oz", ["gingerbeer"])],
    methode: LONG,
    note: "Tout le piquant du Moscow Mule, sans la vodka.",
    deco: [d("Un quartier de lime et de la menthe", "lime", "menthe"),
      d("Une tranche de lime séchée", "lime-sechee"),
      d("Des petits fruits", "petits-fruits")]
  }
];

/* ---------------------------------------------------------- les ambiances */

const AMBIANCES = [
  {
    id: "noel", nom: "C’est Noël",
    description: "Chaud, épicé, sucré à l’érable. De quoi tenir jusqu’aux cadeaux.",
    recettes: ["cafe-cremeux", "tasse-chocolat-cafe", "cafe-a-l-amaretto",
      "old-fashioned-a-l-erable", "vieux-carre-d-erable", "shooter-erable-cannelle",
      "sidecar-a-l-erable", "carajillo", "godfather-sucre",
      "espresso-martini-a-l-erable", "tarte-aux-pommes-a-la-mode"]
  },
  {
    id: "piscine", nom: "Au bord de la piscine",
    description: "Long, froid, plein de lime. À boire les pieds dans l’eau.",
    recettes: ["margarita-picante", "margarita-classique", "paloma-maison", "mai-tai",
      "daiquiri-classique", "tequila-soda-lime", "moscow-mule", "aperol-soda",
      "jardin-d-aperol", "lagon-bleu", "rhum-collins", "spritz-flor-del-fuego",
      "tequila-sunrise", "gin-soda-boreal", "tom-collins", "poisson-rouge-soda"]
  },
  {
    id: "halloween", nom: "Halloween",
    description: "Sombre, orangé, un peu inquiétant. Les lumières tamisées aident.",
    recettes: ["jagerita", "jager-mule", "black-russian", "dark-n-stormy",
      "espresso-martini-classique", "tequila-sunrise", "poisson-rouge-soda",
      "spritz-flor-del-fuego", "b-52-maison", "shooter-banana-split", "lagon-bleu"]
  },
  {
    id: "avec-mes-ados", nom: "Avec mes ados",
    description: "Sans une goutte d’alcool, et assez beaux pour qu’ils en redemandent.",
    recettes: SANS_ALCOOL.map((r) => r.id)
  }
];

// ---------------------------------------------------------------------------

const ingPath = path.join(DATA, "ingredients.json");
const recPath = path.join(DATA, "recettes.json");

const ing = JSON.parse(fs.readFileSync(ingPath, "utf8"));
const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
const connus = new Set(ing.ingredients.map((b) => b.id));
const deja = new Set(rec.map((r) => r.id));

let ajoutees = 0;
for (const r of SANS_ALCOOL) {
  for (const x of r.ingredients) {
    for (const id of x.ids) {
      if (!connus.has(id)) throw new Error(`${r.id} : ingrédient inconnu « ${id} »`);
    }
  }
  for (const idee of r.deco || []) {
    for (const id of idee.ids || []) {
      if (!connus.has(id)) throw new Error(`${r.id} : garniture inconnue « ${id} »`);
    }
  }
  if (deja.has(r.id)) { console.log("  = " + r.id + " (déjà présente)"); continue; }
  rec.push(r);
  deja.add(r.id);
  ajoutees++;
}

const parId = new Map(rec.map((r) => [r.id, r]));
for (const a of AMBIANCES) {
  if (!a.recettes.length) throw new Error(a.id + " : ambiance vide");
  for (const id of a.recettes) {
    if (!parId.has(id)) throw new Error(`${a.id} : recette inconnue « ${id} »`);
  }
  if (new Set(a.recettes).size !== a.recettes.length) throw new Error(a.id + " : doublon");
  // garde-fou : rien d'alcoolisé ne doit entrer là-dedans
  if (a.id === "avec-mes-ados") {
    const avec = a.recettes.filter((id) => !parId.get(id).sansAlcool);
    if (avec.length) throw new Error("« Avec mes ados » contient de l’alcool : " + avec.join(", "));
  }
}

fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(DATA, "ambiances.json"),
  JSON.stringify(AMBIANCES, null, 2) + "\n", "utf8");

const have = {};
for (const b of ing.ingredients) have[b.id] = !!b.defaut;
const parType = {};
for (const b of ing.ingredients) (parType[b.type] ||= []).push(b.id);
const possede = (x) =>
  (x.ids || []).some((id) => have[id]) ||
  (x.types || []).some((t) => (parType[t] || []).some((id) => have[id]));
const manque = (r) => r.ingredients.filter((x) => !x.facultatif && !possede(x)).length;

console.log(`${ajoutees} recette(s) sans alcool ajoutée(s)`);
console.log(`${rec.filter((r) => !r.sansAlcool).length} cocktails + ${rec.filter((r) => r.sansAlcool).length} sans alcool`);
for (const a of AMBIANCES) {
  const faisables = a.recettes.filter((id) => manque(parId.get(id)) === 0).length;
  console.log(`  ${a.nom.padEnd(24)} ${a.recettes.length} recettes, ${faisables} faisables au départ`);
}
