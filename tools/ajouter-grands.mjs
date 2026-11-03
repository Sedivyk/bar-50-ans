/* Ses enfants sont de jeunes adultes, pas des ados : le garçon aime la
   bière, la fille le yuzu, les mojitos et tout ce qui est coloré.

   node tools/ajouter-grands.mjs

   - ajoute la bière et le yuzu au bar (décochés : elle ne les a pas) ;
   - ajoute huit recettes qui leur ressemblent ;
   - remplace l'ambiance « Avec mes ados » par « Avec mes grands », et
     garde les recettes sans alcool dans une ambiance « Sans alcool »,
     qui reste utile pour qui conduit.

   Idempotent. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const t = (q, types, o) => (o ? { q, types, facultatif: true } : { q, types });
const d = (texte, ...ids) => (ids.length ? { texte, ids } : { texte });

/* --------------------------------------------------------- nouveaux types */

const TYPES = [
  ["biere", "Bière", "Pour allonger", "Bière blonde, bière mexicaine"],
  ["yuzu", "Yuzu", "Amers et sirops", "Jus ou sirop de yuzu"]
];

/* ---------------------------------------------------- nouvelles bouteilles
   Décochées : ce sont des courses à faire, pas des bouteilles qu'elle a. */

const BOUTEILLES = [
  ["biere_blonde", "Bière blonde", "Pour allonger", "biere"],
  ["biere_mex", "Bière mexicaine", "Pour allonger", "biere"],
  ["yuzu", "Yuzu (jus ou sirop)", "Amers et sirops", "yuzu"],
  // même type que le club soda : n'importe laquelle des deux fait l'affaire
  ["montellier", "Montellier", "Pour allonger", "eau-petillante"]
];

/* ------------------------------------------------------ nouvelles recettes */

const RHUM = ["rhum-blanc", "rhum-vieux"];
const MENTHE = ["herbe-fraiche"];

const RECETTES = [
  {
    id: "mojito", nom: "Mojito", verre: "grand",
    ingredients: [t("2 oz", RHUM), t("¾ oz", ["lime"]), t("½ oz", ["sirop-simple"]),
      t("8 feuilles", MENTHE), t("3 oz", ["eau-petillante"])],
    methode: "Écrase doucement la menthe avec la lime et le sirop, ajoute le rhum et beaucoup de glace pilée, puis complète avec le soda.",
    note: "N’écrase pas trop la menthe : on la presse, on ne la déchire pas.",
    deco: [d("Une grosse branche de menthe et un quartier de lime", "menthe", "lime"),
      d("Une tranche de lime séchée", "lime-sechee"),
      d("Des petits fruits au fond du verre", "petits-fruits")]
  },
  {
    id: "mojito-au-yuzu", nom: "Mojito au yuzu", verre: "grand",
    ingredients: [t("2 oz", RHUM), t("¾ oz", ["yuzu"]), t("½ oz", ["lime"]),
      t("½ oz", ["sirop-simple"]), t("8 feuilles", MENTHE), t("3 oz", ["eau-petillante"])],
    methode: "Écrase la menthe avec la lime et le sirop, ajoute le yuzu, le rhum et de la glace pilée, puis complète avec le soda.",
    note: "Le yuzu est plus floral que la lime : il porte la menthe encore mieux.",
    deco: [d("Des perles de yuzu au fond du verre", "perles-cocktail"),
      d("Une grosse branche de menthe", "menthe"),
      d("Un quartier de lime", "lime")]
  },
  {
    id: "margarita-au-yuzu", nom: "Margarita au yuzu", verre: "coupe",
    ingredients: [t("2 oz", ["tequila-blanche"]), t("¾ oz", ["yuzu"]),
      t("½ oz", ["liqueur-orange"]), t("½ oz", ["lime"])],
    methode: "Secoue fort avec beaucoup de glace, puis filtre dans une coupe.",
    deco: [d("Des perles de yuzu au fond du verre", "perles-cocktail"),
      d("Un bord de sel", "sel"),
      d("Une tranche de lime séchée", "lime-sechee")]
  },
  {
    id: "gin-yuzu-soda", nom: "Gin yuzu soda", verre: "grand",
    ingredients: [t("1½ oz", ["gin"]), t("¾ oz", ["yuzu"]), t("4 oz", ["eau-petillante"])],
    methode: "Verse sur glace dans un grand verre, complète et remue doucement.",
    deco: [d("Des perles de yuzu", "perles-cocktail"),
      d("Une tranche de citron et de la menthe", "citron", "menthe"),
      d("Une fleur comestible", "fleurs-comestibles")]
  },
  {
    id: "michelada", nom: "Michelada", verre: "grand",
    ingredients: [t("1 bouteille", ["biere"]), t("¾ oz", ["lime"])],
    methode: "Givre le bord au Tajín, remplis le verre de glace, ajoute le jus de lime, puis verse la bière tout doucement.",
    note: "La bière mexicaine est faite pour ça, mais n’importe quelle blonde fait l’affaire.",
    deco: [d("Un bord de Tajín et un quartier de lime", "tajin", "lime"),
      d("Un bord de sel", "sel"),
      d("Une tranche de lime séchée", "lime-sechee")]
  },
  {
    id: "shandy-au-citron", nom: "Shandy au citron", verre: "grand",
    ingredients: [t("5 oz", ["biere"]), t("1 oz", ["citron"]), t("½ oz", ["sirop-simple"]),
      t("2 oz", ["eau-petillante"])],
    methode: "Mélange le citron et le sirop au fond du verre, ajoute de la glace, puis la bière et le soda.",
    note: "Moitié bière, moitié limonade : le plus léger de tout le livre.",
    deco: [d("Une tranche de citron et de la menthe", "citron", "menthe"),
      d("Une tranche de citron séchée", "citron-seche"),
      d("Des petits fruits", "petits-fruits")]
  },
  {
    id: "shooter-au-yuzu", nom: "Shooter au yuzu", verre: "shooter",
    ingredients: [t("¾ oz", ["vodka", "vodka-vanille"]), t("½ oz", ["yuzu"]),
      t("¼ oz", ["sirop-simple"])],
    methode: "Secoue avec de la glace et filtre dans un verre à shooter bien froid.",
    deco: [d("Des perles de yuzu au fond", "perles-cocktail"),
      d("Un bord de sucre", "sucre"),
      d("Un quartier de lime", "lime")]
  },
  {
    id: "shooter-bleu", nom: "Shooter bleu", verre: "shooter",
    ingredients: [t("¾ oz", ["liqueur-bleue"]), t("½ oz", ["vodka", "vodka-vanille"]),
      t("¼ oz", ["lime"])],
    methode: "Secoue avec de la glace et filtre dans un verre à shooter.",
    note: "Bleu électrique. C’est tout l’intérêt.",
    deco: [d("Du sucre coloré sur le bord", "sucre-colore"),
      d("Des perles à cocktail au fond", "perles-cocktail"),
      d("Une cerise à cocktail", "cerises-cocktail")]
  },

  // --- pour sa belle-sœur : sureau, fruit de la passion, bulles, et léger ---
  {
    id: "spritz-au-sureau", nom: "Spritz au sureau", verre: "grand",
    ingredients: [t("2 oz", ["liqueur-sureau"]), t("½ oz", ["citron"]),
      t("4 oz", ["eau-petillante"])],
    methode: "Verse sur glace dans un grand verre, complète et remue doucement.",
    note: "Le plus léger des apéros : du sureau et des bulles, rien d’autre.",
    deco: [d("Une fleur comestible", "fleurs-comestibles"),
      d("Une tranche de citron et de la menthe", "citron", "menthe"),
      d("Une tranche de citron séchée", "citron-seche")]
  },
  {
    id: "passion-sureau-petillant", nom: "Passion-sureau pétillant", verre: "grand",
    ingredients: [t("1 oz", ["puree-fruit"]), t("¾ oz", ["liqueur-sureau"]),
      t("½ oz", ["lime"]), t("4 oz", ["eau-petillante"])],
    methode: "Verse sur glace dans un grand verre, complète et remue doucement.",
    note: "Les deux à la fois : le fruit de la passion et le St-Germain.",
    deco: [d("Une fleur comestible", "fleurs-comestibles"),
      d("Des perles à cocktail", "perles-cocktail"),
      d("Une branche de menthe", "menthe")]
  },
  {
    id: "mojito-au-sureau", nom: "Mojito au sureau", verre: "grand",
    ingredients: [t("1½ oz", RHUM), t("¾ oz", ["liqueur-sureau"]), t("½ oz", ["lime"]),
      t("8 feuilles", MENTHE), t("3 oz", ["eau-petillante"])],
    methode: "Écrase doucement la menthe avec la lime, ajoute le rhum, le St-Germain et de la glace pilée, puis complète avec les bulles.",
    note: "Un mojito, mais floral. Celui-là est pour elle.",
    deco: [d("Une grosse branche de menthe et un quartier de lime", "menthe", "lime"),
      d("Une fleur comestible", "fleurs-comestibles"),
      d("Une tranche de lime séchée", "lime-sechee")]
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
    recettes: ["mojito", "mojito-au-yuzu", "margarita-picante", "margarita-classique",
      "paloma-maison", "mai-tai", "daiquiri-classique", "tequila-soda-lime",
      "moscow-mule", "aperol-soda", "jardin-d-aperol", "lagon-bleu", "rhum-collins",
      "spritz-flor-del-fuego", "tequila-sunrise", "gin-soda-boreal", "tom-collins",
      "poisson-rouge-soda", "michelada", "shandy-au-citron", "gin-yuzu-soda"]
  },
  {
    id: "avec-mes-grands", nom: "Avec mes grands",
    description: "Des shots, du yuzu, des mojitos et tout ce qui est coloré. Et une bière bien froide pour celui qui préfère ça.",
    recettes: ["mojito", "mojito-au-yuzu", "margarita-au-yuzu", "gin-yuzu-soda",
      "shooter-au-yuzu", "shooter-bleu", "shooter-banana-split", "b-52-maison",
      "tarte-aux-pommes-a-la-mode", "shooter-erable-cannelle", "michelada",
      "shandy-au-citron", "lagon-bleu", "ciel-bleu", "poisson-rouge-soda",
      "tequila-sunrise", "margarita-picante"]
  },
  {
    id: "avec-ma-belle-soeur", nom: "Avec ma belle-sœur",
    description: "Des mojitos, du St-Germain, du fruit de la passion et beaucoup de bulles. Léger, et ça se boit longtemps.",
    recettes: ["mojito-au-sureau", "mojito", "spritz-au-sureau",
      "passion-sureau-petillant", "le-50", "margarita-st-germain",
      "gimlet-au-sureau", "collins-au-sureau", "gin-soda-boreal",
      "vodka-soda-au-sureau", "jardin-d-aperol", "pornstar-martini",
      "passion-petillante", "aperol-soda", "tequila-soda-lime"]
  },
  {
    id: "sans-alcool", nom: "Sans alcool",
    description: "Pour celle ou celui qui conduit, et pour les après-midis.",
    recettes: ["limonade-petillante", "soda-a-l-orgeat", "passion-petillante",
      "cafe-frappe", "shirley-temple", "mule-sans-alcool"]
  }
];

// ---------------------------------------------------------------------------

const ingPath = path.join(DATA, "ingredients.json");
const recPath = path.join(DATA, "recettes.json");
const typPath = path.join(DATA, "types.json");

const ing = JSON.parse(fs.readFileSync(ingPath, "utf8"));
const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
const typ = JSON.parse(fs.readFileSync(typPath, "utf8"));

const typesConnus = new Set(typ.types.map((x) => x.id));
for (const [id, nom, famille, exemples] of TYPES) {
  if (!typesConnus.has(id)) { typ.types.push({ id, nom, famille, exemples }); typesConnus.add(id); }
}

const parId = new Map(ing.ingredients.map((b) => [b.id, b]));
for (const [id, nom, categorie, type] of BOUTEILLES) {
  if (!typesConnus.has(type)) throw new Error(`${id} : type inconnu « ${type} »`);
  if (parId.has(id)) continue;
  const b = { id, nom, categorie, defaut: false, type };
  ing.ingredients.push(b);
  parId.set(id, b);
}

const recConnues = new Set(rec.map((r) => r.id));
let ajoutees = 0;
for (const r of RECETTES) {
  for (const x of r.ingredients) {
    for (const ty of x.types || []) {
      if (!typesConnus.has(ty)) throw new Error(`${r.id} : type inconnu « ${ty} »`);
    }
  }
  for (const idee of r.deco || []) {
    for (const id of idee.ids || []) {
      if (!parId.has(id)) throw new Error(`${r.id} : garniture inconnue « ${id} »`);
    }
  }
  if (recConnues.has(r.id)) { console.log("  = " + r.id + " (déjà présente)"); continue; }
  rec.push(r);
  recConnues.add(r.id);
  ajoutees++;
}

const toutes = new Map(rec.map((r) => [r.id, r]));
const FAMILLES_ALCOOL = ["Tequila", "Rhum", "Whisky", "Gin", "Vodka", "Liqueurs"];
const typeDe = new Map(typ.types.map((x) => [x.id, x]));
const alcoolise = (id) => {
  const x = typeDe.get(id);
  return !!x && FAMILLES_ALCOOL.includes(x.famille);
};
const alcoolDans = (r) => r.ingredients.flatMap((x) =>
  (x.types || []).filter(alcoolise)
    .concat((x.ids || []).filter((bid) => parId.get(bid) && alcoolise(parId.get(bid).type))));

for (const a of AMBIANCES) {
  for (const id of a.recettes) {
    if (!toutes.has(id)) throw new Error(`${a.id} : recette inconnue « ${id} »`);
  }
  if (new Set(a.recettes).size !== a.recettes.length) throw new Error(a.id + " : doublon");
  if (a.id === "sans-alcool") {
    const fautifs = a.recettes.filter((id) => !toutes.get(id).sansAlcool || alcoolDans(toutes.get(id)).length);
    if (fautifs.length) throw new Error("« Sans alcool » contient de l’alcool : " + fautifs.join(", "));
  }
}

fs.writeFileSync(typPath, JSON.stringify(typ, null, 2) + "\n", "utf8");
fs.writeFileSync(ingPath, JSON.stringify(ing, null, 2) + "\n", "utf8");
fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(DATA, "ambiances.json"),
  JSON.stringify(AMBIANCES, null, 2) + "\n", "utf8");

const have = {};
for (const b of ing.ingredients) have[b.id] = !!b.defaut;
const parType = {};
for (const b of ing.ingredients) (parType[b.type] ||= []).push(b.id);
const possede = (x) =>
  (x.ids || []).some((id) => have[id]) ||
  (x.types || []).some((ty) => (parType[ty] || []).some((id) => have[id]));
const manque = (r) => r.ingredients.filter((x) => !x.facultatif && !possede(x)).length;

console.log(`${ajoutees} recette(s) ajoutée(s) — ${rec.length} au total`);
console.log(`${rec.filter((r) => !r.sansAlcool).length} avec alcool, ${rec.filter((r) => r.sansAlcool).length} sans`);
for (const a of AMBIANCES) {
  const ok = a.recettes.filter((id) => manque(toutes.get(id)) === 0).length;
  const presque = a.recettes.filter((id) => manque(toutes.get(id)) === 1).length;
  console.log(`  ${a.nom.padEnd(24)} ${String(a.recettes.length).padStart(2)} recettes · ${ok} prêtes · ${presque} à une bouteille près`);
}
