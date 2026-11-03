/* Donne un type générique à chaque bouteille et convertit les recettes
   pour qu'elles visent un type plutôt qu'une liste de bouteilles.

   node tools/ajouter-types.mjs

   Écrit data/types.json, et met à jour data/ingredients.json et
   data/recettes.json. Idempotent : relancer ne change rien. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

/* Le catalogue des types. « exemples » sert dans la liste proposée
   quand elle ajoute une bouteille : « Patrón, Casamigos → Tequila blanche ».
   « famille » regroupe les types dans cette liste. */
const TYPES = [
  // Tequila
  ["tequila-blanche", "Tequila blanche", "Tequila", "Patrón Silver, Casamigos, Don Julio Blanco"],
  ["tequila-reposado", "Tequila reposado", "Tequila", "Casamigos Reposado, Espolòn Reposado"],
  ["tequila-anejo", "Tequila añejo", "Tequila", "Don Julio Añejo, Herradura Añejo"],
  ["mezcal", "Mezcal", "Tequila", "Del Maguey, Montelobos"],
  // Rhum
  ["rhum-blanc", "Rhum blanc", "Rhum", "Bacardí, Havana Club 3 ans"],
  ["rhum-vieux", "Rhum vieux", "Rhum", "Appleton Estate, Brugal Extra Viejo, Cihuatán"],
  ["rhum-brun", "Rhum brun", "Rhum", "Gosling’s, rhum brun fumé"],
  ["rhum-epice", "Rhum épicé", "Rhum", "Havana Club épicé, Captain Morgan"],
  // Whisky
  ["whisky", "Whisky", "Whisky", "Gretzky No. 99, Auchentoshan, Jameson"],
  ["bourbon", "Bourbon", "Whisky", "Bulleit, Maker’s Mark"],
  ["whisky-erable", "Whisky à l’érable", "Whisky", "Grands Voyageurs, Sortilège"],
  // Gin
  ["gin", "Gin", "Gin", "Beefeater, Romeo’s, Ungava, Bombay"],
  // Vodka
  ["vodka", "Vodka", "Vodka", "High Seas, Smirnoff, Absolut"],
  ["vodka-vanille", "Vodka à la vanille", "Vodka", "Absolut Vanilia, vodka à la vanille"],
  ["vodka-arachide", "Vodka au beurre d’arachide", "Vodka", "Skrewball, vodka beurre d’arachide"],
  ["alcool-piquant", "Alcool piquant", "Vodka", "Moonshine jalapeños, vodka au piment"],
  // Liqueurs
  ["liqueur-sureau", "Liqueur de sureau", "Liqueurs", "St-Germain"],
  ["liqueur-orange", "Liqueur d’orange", "Liqueurs", "Grand Marnier, Cointreau, triple sec"],
  ["liqueur-vanille", "Liqueur de vanille", "Liqueurs", "Licor 43, Galliano vanille"],
  ["amaretto", "Amaretto", "Liqueurs", "Amaretto au miel, à l’érable, Disaronno"],
  ["liqueur-cafe", "Liqueur de café", "Liqueurs", "Tia Maria, Kahlúa, liqueur d’espresso"],
  ["liqueur-cafe-creme", "Liqueur de café crémeuse", "Liqueurs", "Sheridan’s, Baileys au café"],
  ["liqueur-creme", "Liqueur crémeuse", "Liqueurs", "Baileys, crème irlandaise"],
  ["liqueur-chocolat", "Liqueur de chocolat", "Liqueurs", "Olmeca chocolat noir, crème de cacao"],
  ["liqueur-banane", "Liqueur de banane", "Liqueurs", "Crème de banane, Giffard banane"],
  ["liqueur-caramel", "Liqueur de caramel", "Liqueurs", "Butterscotch, caramel"],
  ["liqueur-pomme", "Liqueur de pomme", "Liqueurs", "Dr. McGillicuddy’s tarte aux pommes"],
  ["liqueur-cannelle", "Liqueur de cannelle", "Liqueurs", "Fireball, Goldschläger"],
  ["liqueur-bleue", "Liqueur bleue", "Liqueurs", "Sourpuss bleu, curaçao bleu"],
  ["liqueur-fruitee", "Liqueur fruitée", "Liqueurs", "Flor del Fuego, Poisson rouge, Chambord"],
  ["amer-orange", "Amer à l’orange", "Liqueurs", "Aperol, Campari"],
  ["amer-herbes", "Amer aux herbes", "Liqueurs", "Jägermeister, Fernet-Branca"],
  // Amers et sirops
  ["amers-aromatiques", "Amers aromatiques", "Amers et sirops", "Angostura, Peychaud’s"],
  ["amers-orange", "Amers à l’orange", "Amers et sirops", "Regans’, amers à l’orange"],
  ["sirop-orgeat", "Sirop d’orgeat", "Amers et sirops", "Orgeat"],
  ["sirop-simple", "Sirop simple", "Amers et sirops", "Sirop simple, sucre"],
  ["sirop-agave", "Sirop d’agave", "Amers et sirops", "Sirop d’agave"],
  ["sirop-erable", "Sirop d’érable", "Amers et sirops", "Sirop d’érable"],
  ["puree-fruit", "Purée de fruits", "Amers et sirops", "Fruit de la passion, purée de mangue"],
  ["grenadine", "Grenadine", "Amers et sirops", "Grenadine"],
  ["poudre-scintillante", "Poudre scintillante", "Amers et sirops", "Shimmer dust"],
  // Pour allonger
  ["eau-petillante", "Eau pétillante", "Pour allonger", "Club soda, Perrier"],
  ["tonic", "Tonic", "Pour allonger", "Schweppes, Fever-Tree"],
  ["ginger-beer", "Ginger beer", "Pour allonger", "Ginger beer, ginger ale"],
  ["cola", "Cola", "Pour allonger", "Coca-Cola, Pepsi"],
  ["jus-orange", "Jus d’orange", "Pour allonger", "Jus d’orange"],
  ["jus-canneberge", "Jus de canneberge", "Pour allonger", "Jus de canneberge"],
  // Garde-manger
  ["lime", "Limes", "Garde-manger", "Limes fraîches"],
  ["citron", "Citrons", "Garde-manger", "Citrons frais"],
  ["oeuf", "Œufs", "Garde-manger", "Œufs (pour la mousse)"],
  ["cafe", "Café", "Garde-manger", "Café, espresso"],
  ["creme", "Crème", "Garde-manger", "Crème 35 %, crème à café"],
  ["lait", "Lait", "Garde-manger", "Lait, boisson végétale"],
  ["autre", "Autre", "Garde-manger", "Tout le reste"]
];

/* Le type de chacune des bouteilles du départ. */
const TYPE_BOUTEILLE = {
  patron: "tequila-blanche", casamigos: "tequila-blanche", olmeca: "liqueur-chocolat",
  cihuatan: "rhum-vieux", brugal: "rhum-vieux", appleton: "rhum-vieux",
  smoky: "rhum-brun", havana: "rhum-epice",
  gv: "whisky-erable", gretzky: "whisky", auchen: "whisky",
  romeos: "gin", ungava: "gin", beefeater: "gin",
  vvanille: "vodka-vanille", highseas: "vodka", vpb: "vodka-arachide",
  moonshine: "alcool-piquant",
  stgermain: "liqueur-sureau", licor43: "liqueur-vanille",
  amaretto_miel: "amaretto", amaretto_erable: "amaretto",
  grandmarnier: "liqueur-orange", aperol: "amer-orange",
  cafe_liq: "liqueur-cafe", espresso_liq: "liqueur-cafe", tiamaria: "liqueur-cafe",
  sheridans: "liqueur-cafe-creme", butterscotch: "liqueur-caramel",
  galliano: "liqueur-vanille", banane: "liqueur-banane",
  mcgilli: "liqueur-pomme", fireball: "liqueur-cannelle", jager: "amer-herbes",
  sourpuss: "liqueur-bleue", flor: "liqueur-fruitee", poisson: "liqueur-fruitee",
  angostura: "amers-aromatiques", orangebit: "amers-orange",
  orgeat: "sirop-orgeat", passion: "puree-fruit", shimmer: "poudre-scintillante",
  clubsoda: "eau-petillante", gingerbeer: "ginger-beer", cola: "cola",
  jusorange: "jus-orange",
  lime: "lime", citron: "citron", sirop: "sirop-simple", agave: "sirop-agave",
  oeuf: "oeuf", cafe: "cafe", creme: "creme", grenadine: "grenadine"
};

/* Bouteilles qui font l'identité du cocktail : on les garde nommées,
   même si elles couvrent un type complet. */
const GARDER_PRECIS = {
  "le-50": ["stgermain"],
  "margarita-st-germain": ["stgermain"],
  "aperol-soda": ["aperol"],
  "jardin-d-aperol": ["aperol"],
  "jager-mule": ["jager"],
  "jagerita": ["jager"]
};

/* Listes qui décrivent un type sans le couvrir entièrement :
   « recette:index » → types à utiliser. */
const FORCER_TYPE = {
  "tom-collins:0": ["gin"],        // Beefeater ou Romeo’s = n’importe quel gin
  "mai-tai:1": ["rhum-vieux"]      // l’Appleton est déjà dans la ligne du dessus
};

// --------------------------------------------------------------------------

const ingPath = path.join(DATA, "ingredients.json");
const recPath = path.join(DATA, "recettes.json");
const ing = JSON.parse(fs.readFileSync(ingPath, "utf8"));
const recettes = JSON.parse(fs.readFileSync(recPath, "utf8"));

const typeIds = new Set(TYPES.map((t) => t[0]));
for (const [id, t] of Object.entries(TYPE_BOUTEILLE)) {
  if (!typeIds.has(t)) throw new Error(`${id} : type inconnu « ${t} »`);
}

// 1. le catalogue des types
const familles = [];
for (const [, , famille] of TYPES) if (!familles.includes(famille)) familles.push(famille);
fs.writeFileSync(path.join(DATA, "types.json"),
  JSON.stringify({
    familles,
    types: TYPES.map(([id, nom, famille, exemples]) => ({ id, nom, famille, exemples }))
  }, null, 2) + "\n", "utf8");

// 2. le type de chaque bouteille
for (const b of ing.ingredients) {
  const t = TYPE_BOUTEILLE[b.id];
  if (!t) throw new Error("bouteille sans type : " + b.id);
  b.type = t;
}
fs.writeFileSync(ingPath, JSON.stringify(ing, null, 2) + "\n", "utf8");

// 3. conversion des recettes
const parType = {};
for (const b of ing.ingredients) (parType[b.type] ||= []).push(b.id);

/** Les ids couvrent-ils exactement un ou plusieurs types complets ? */
function enTypes(ids) {
  const restant = new Set(ids);
  const trouves = [];
  for (const [type, membres] of Object.entries(parType)) {
    if (membres.every((m) => restant.has(m))) {
      trouves.push(type);
      for (const m of membres) restant.delete(m);
    }
  }
  return restant.size === 0 && trouves.length ? trouves : null;
}

let convertis = 0, gardes = 0;
for (const r of recettes) {
  r.ingredients = r.ingredients.map((x, k) => {
    if (x.types) return x;                       // déjà converti
    const force = FORCER_TYPE[`${r.id}:${k}`];
    if (force) {
      convertis++;
      return { q: x.q, types: force, ...(x.facultatif ? { facultatif: true } : {}) };
    }
    const precis = GARDER_PRECIS[r.id] || [];
    if (x.ids.some((id) => precis.includes(id))) { gardes++; return x; }
    const types = enTypes(x.ids);
    if (!types) { gardes++; return x; }
    convertis++;
    return { q: x.q, types, ...(x.facultatif ? { facultatif: true } : {}) };
  });
}

// 4. vérifications : rien ne doit changer pour l'inventaire de départ
const have = {};
for (const b of ing.ingredients) have[b.id] = !!b.defaut;
const aType = {};
for (const b of ing.ingredients) (aType[b.type] ||= []).push(b.id);
const possede = (x) =>
  (x.ids || []).some((id) => have[id]) ||
  (x.types || []).some((t) => (aType[t] || []).some((id) => have[id]));
const manque = (r) => r.ingredients.filter((x) => !x.facultatif && !possede(x)).length;

for (const r of recettes) {
  for (const x of r.ingredients) {
    if (!x.ids && !x.types) throw new Error(r.id + " : ingrédient sans ids ni types");
    for (const t of x.types || []) if (!typeIds.has(t)) throw new Error(r.id + " : type inconnu " + t);
    for (const id of x.ids || []) if (!(id in have)) throw new Error(r.id + " : bouteille inconnue " + id);
  }
}

fs.writeFileSync(recPath, JSON.stringify(recettes, null, 2) + "\n", "utf8");

const ok = recettes.filter((r) => manque(r) === 0).length;
const presque = recettes.filter((r) => manque(r) === 1).length;
console.log(`${TYPES.length} types, ${ing.ingredients.length} bouteilles typées`);
console.log(`${convertis} ingrédients visent un type, ${gardes} gardent une bouteille précise`);
console.log(`avec l'inventaire de départ : ${ok} « je peux faire », ${presque} « presque »`);
