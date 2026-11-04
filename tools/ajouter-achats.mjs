/* Les quatre achats du 3 novembre 2026 :
     - The Japanese Bitters — Sakura (fleur de cerisier)
     - Ms Better's Bitters — banane-bergamote
     - Opaline — poudre d'or comestible
     - Spherika — perles de yuzu

   node tools/ajouter-achats.mjs

   Les trois premiers entrent au bar, cochés : elle les a. Les perles
   existaient déjà en garniture, décochées ; on les nomme et on les coche.
   Puis quatre recettes qui s'en servent vraiment, et quelques ajouts
   facultatifs là où ça a du sens.

   Idempotent. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const SHAKE = "Secoue fort avec beaucoup de glace, puis filtre dans une coupe.";
const STIR = "Remue 20 secondes avec de la glace, puis verse sur un gros glaçon.";
const t = (q, types, o) => (o ? { q, types, facultatif: true } : { q, types });
const d = (texte, ...ids) => (ids.length ? { texte, ids } : { texte });

/* --- deux familles d'amers de plus : ils ne remplacent pas l'Angostura --- */
const TYPES = [
  ["amers-floraux", "Amers floraux", "Amers et sirops",
    "Sakura (fleur de cerisier), lavande, hibiscus"],
  ["amers-fruites", "Amers fruités", "Amers et sirops",
    "Banane-bergamote, pêche, pamplemousse"]
];

/* --- ce qu'elle vient d'acheter : coché, elle l'a --- */
const BOUTEILLES = [
  ["sakura_bitters", "Amers Sakura (fleur de cerisier)", "Amers et sirops", "amers-floraux"],
  ["bitters_banane_bergamote", "Amers banane-bergamote", "Amers et sirops", "amers-fruites"],
  // même type que le shimmer dust : l'un ou l'autre convient partout
  ["poudre-or", "Poudre d’or comestible", "Garnitures et déco", "poudre-scintillante"]
];

/* Les perles existaient déjà, décochées et sans marque. Elle a maintenant
   les perles de yuzu : on garde l'identifiant, on précise le nom, on coche. */
const RENOMMER = { "perles-cocktail": "Perles de yuzu" };
const COCHER = ["perles-cocktail"];

/* --------------------------------------------------------- les recettes */

const RECETTES = [
  {
    id: "sakura-sour", nom: "Sakura Sour", verre: "coupe",
    ingredients: [t("2 oz", ["gin"]), t("¾ oz", ["citron"]), t("½ oz", ["sirop-simple"]),
      t("3 traits", ["amers-floraux"]), t("1 blanc", ["oeuf"], 1)],
    methode: SHAKE,
    note: "Les amers Sakura sentent la fleur de cerisier : trois traits suffisent, c’est très parfumé.",
    deco: [d("Une fleur comestible posée sur la mousse", "fleurs-comestibles"),
      d("Une pincée de poudre d’or", "poudre-or"),
      d("Une cerise à cocktail", "cerises-cocktail")]
  },
  {
    id: "fleur-de-cerisier", nom: "Fleur de cerisier", verre: "coupe",
    ingredients: [t("1½ oz", ["vodka", "vodka-vanille"]), t("¾ oz", ["liqueur-sureau"]),
      t("½ oz", ["citron"]), t("2 traits", ["amers-floraux"]),
      t("1 pincée", ["poudre-scintillante"], 1)],
    methode: SHAKE,
    note: "Le Sakura et le St-Germain sont deux fleurs. Ensemble, c’est un bouquet.",
    deco: [d("Une pincée de poudre d’or", "poudre-or"),
      d("Une fleur comestible", "fleurs-comestibles"),
      d("Des perles de yuzu au fond du verre", "perles-cocktail")]
  },
  {
    id: "old-fashioned-banane-bergamote", nom: "Old Fashioned banane-bergamote", verre: "court",
    ingredients: [t("2 oz", ["whisky", "bourbon"]),
      t("¼ oz", ["sirop-simple", "whisky-erable"]),
      t("3 traits", ["amers-fruites"])],
    methode: STIR,
    note: "La bergamote relève le whisky comme un zeste, la banane l’arrondit.",
    deco: [d("Un grand zeste d’orange", "zeste-agrumes"),
      d("Une tranche d’orange séchée", "orange-sechee"),
      d("Une cerise à cocktail", "cerises-cocktail")]
  },
  {
    id: "daiquiri-a-la-bergamote", nom: "Daïquiri à la bergamote", verre: "coupe",
    ingredients: [t("2 oz", ["rhum-blanc", "rhum-vieux"]), t("¾ oz", ["lime"]),
      t("½ oz", ["sirop-simple"]), t("3 traits", ["amers-fruites"])],
    methode: SHAKE,
    note: "Trois traits transforment un daïquiri classique en quelque chose qu’on ne replace pas tout de suite.",
    deco: [d("Une tranche de lime", "lime"),
      d("Une pincée de poudre d’or", "poudre-or"),
      d("Une fleur comestible", "fleurs-comestibles")]
  }
];

/* --- des ajouts facultatifs : ils ne changent aucun compteur --- */
const AJOUTS = [
  ["daiquiri-banane", { q: "2 traits", types: ["amers-fruites"], facultatif: true }],
  ["margarita-st-germain", { q: "2 traits", types: ["amers-floraux"], facultatif: true }],
  ["pornstar-martini", { q: "1 pincée", types: ["poudre-scintillante"], facultatif: true }],
  ["shooter-banana-split", { q: "1 trait", types: ["amers-fruites"], facultatif: true }]
];

/* --- où les ranger dans les ambiances --- */
const DANS_AMBIANCE = {
  "avec-ma-belle-soeur": ["fleur-de-cerisier", "sakura-sour"],
  "noel": ["old-fashioned-banane-bergamote"],
  "piscine": ["daiquiri-a-la-bergamote"]
};

// ---------------------------------------------------------------------------

const ingPath = path.join(DATA, "ingredients.json");
const recPath = path.join(DATA, "recettes.json");
const typPath = path.join(DATA, "types.json");
const ambPath = path.join(DATA, "ambiances.json");

const ing = JSON.parse(fs.readFileSync(ingPath, "utf8"));
const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
const typ = JSON.parse(fs.readFileSync(typPath, "utf8"));
const amb = JSON.parse(fs.readFileSync(ambPath, "utf8"));

const typesConnus = new Set(typ.types.map((x) => x.id));
for (const [id, nom, famille, exemples] of TYPES) {
  if (!typesConnus.has(id)) { typ.types.push({ id, nom, famille, exemples }); typesConnus.add(id); }
}

const parId = new Map(ing.ingredients.map((b) => [b.id, b]));
for (const [id, nom, categorie, type] of BOUTEILLES) {
  if (!typesConnus.has(type)) throw new Error(`${id} : type inconnu « ${type} »`);
  if (parId.has(id)) { parId.get(id).defaut = true; continue; }
  const b = { id, nom, categorie, defaut: true, type };
  ing.ingredients.push(b);
  parId.set(id, b);
}
for (const [id, nom] of Object.entries(RENOMMER)) {
  const b = parId.get(id);
  if (!b) throw new Error("bouteille à renommer introuvable : " + id);
  b.nom = nom;
}
for (const id of COCHER) {
  const b = parId.get(id);
  if (!b) throw new Error("bouteille à cocher introuvable : " + id);
  b.defaut = true;
}

const recConnues = new Map(rec.map((r) => [r.id, r]));
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
  recConnues.set(r.id, r);
  ajoutees++;
}

let ajoutsFaits = 0;
for (const [id, ligne] of AJOUTS) {
  const r = recConnues.get(id);
  if (!r) throw new Error("recette introuvable : " + id);
  if (!ligne.facultatif) throw new Error(id + " : un ajout doit être facultatif");
  const cle = JSON.stringify(ligne.types);
  if (r.ingredients.some((x) => JSON.stringify(x.types) === cle)) continue;
  r.ingredients.push(ligne);
  ajoutsFaits++;
}

const parAmb = new Map(amb.map((a) => [a.id, a]));
for (const [id, ajouts] of Object.entries(DANS_AMBIANCE)) {
  const a = parAmb.get(id);
  if (!a) throw new Error("ambiance introuvable : " + id);
  for (const r of ajouts) {
    if (!recConnues.has(r)) throw new Error(`${id} : recette inconnue « ${r} »`);
    if (!a.recettes.includes(r)) a.recettes.unshift(r);
  }
}

/* --- contrôle : les lignes facultatives ne doivent rien changer --- */
const have = {};
for (const b of ing.ingredients) have[b.id] = !!b.defaut;
const parType = {};
for (const b of ing.ingredients) (parType[b.type] ||= []).push(b.id);
const possede = (x) =>
  (x.ids || []).some((id) => have[id]) ||
  (x.types || []).some((ty) => (parType[ty] || []).some((id) => have[id]));
const manque = (r) => r.ingredients.filter((x) => !x.facultatif && !possede(x)).length;

fs.writeFileSync(typPath, JSON.stringify(typ, null, 2) + "\n", "utf8");
fs.writeFileSync(ingPath, JSON.stringify(ing, null, 2) + "\n", "utf8");
fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + "\n", "utf8");
fs.writeFileSync(ambPath, JSON.stringify(amb, null, 2) + "\n", "utf8");

console.log(`${BOUTEILLES.length} achats au bar + les perles cochées`);
console.log(`${ajoutees} recette(s) ajoutée(s), ${ajoutsFaits} ligne(s) facultative(s) ajoutée(s)`);
console.log(`${rec.length} recettes : ${rec.filter((r) => manque(r) === 0).length} prêtes, ${rec.filter((r) => manque(r) === 1).length} à une bouteille près`);
for (const r of RECETTES) {
  console.log(`  ${r.nom.padEnd(34)} ${manque(recConnues.get(r.id)) === 0 ? "prête" : "il manque " + manque(recConnues.get(r.id))}`);
}
