/* Vérifie les ambiances (Noël, la piscine, l'Halloween, les ados)
   et, surtout, qu'aucune goutte d'alcool n'entre dans « Avec mes ados ».

   node tests/ambiances.mjs */

import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { serve, journal, ROOT } from "./serveur.mjs";

const { check, bilan } = journal();

const lire = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const ing = lire("ingredients.json");
const rec = lire("recettes.json");
const typ = lire("types.json");
const amb = lire("ambiances.json");

const parId = new Map(rec.map((r) => [r.id, r]));
const bouteille = new Map(ing.ingredients.map((b) => [b.id, b]));
const typeDe = new Map((typ.types || []).map((t) => [t.id, t]));

/* --------------------------------------------------------- les données */

check(`il y a ${amb.length} ambiances`, amb.length === 4);
for (const a of ["noel", "piscine", "halloween", "avec-mes-ados"]) {
  check(`l’ambiance « ${a} » existe`, amb.some((x) => x.id === a));
}

const cassees = [];
for (const a of amb) {
  if (!a.nom || !a.description) cassees.push(a.id + " : nom ou description manquant");
  if (!a.recettes.length) cassees.push(a.id + " : vide");
  for (const id of a.recettes) if (!parId.has(id)) cassees.push(`${a.id} : « ${id} » inconnue`);
  if (new Set(a.recettes).size !== a.recettes.length) cassees.push(a.id + " : doublon");
}
check("toutes les recettes citées existent", cassees.length === 0, cassees.slice(0, 3).join(" | "));

/* --- la vérification qui compte : « Avec mes ados » doit être sans alcool --- */

const FAMILLES_ALCOOL = ["Tequila", "Rhum", "Whisky", "Gin", "Vodka", "Liqueurs"];
function typeAlcoolise(id) {
  const t = typeDe.get(id);
  return !!t && FAMILLES_ALCOOL.includes(t.famille);
}
function alcoolDans(r) {
  const trouve = [];
  for (const x of r.ingredients) {
    for (const t of x.types || []) if (typeAlcoolise(t)) trouve.push(t);
    for (const bid of x.ids || []) {
      const b = bouteille.get(bid);
      if (b && typeAlcoolise(b.type)) trouve.push(b.nom);
    }
  }
  return trouve;
}

const ados = amb.find((a) => a.id === "avec-mes-ados");
const fautifs = [];
for (const id of ados.recettes) {
  const r = parId.get(id);
  if (!r.sansAlcool) fautifs.push(`${id} n’est pas marquée sans alcool`);
  const alcool = alcoolDans(r);
  if (alcool.length) fautifs.push(`${id} contient : ${alcool.join(", ")}`);
}
check(`« Avec mes ados » : ses ${ados.recettes.length} recettes sont vraiment sans alcool`,
  fautifs.length === 0, fautifs.join(" | "));

// et l'inverse : rien marqué sans alcool ne doit contenir d'alcool
const menteuses = rec.filter((r) => r.sansAlcool && alcoolDans(r).length);
check("aucune recette « sans alcool » ne contient d’alcool", menteuses.length === 0,
  menteuses.map((r) => r.id).join(", "));

const sansAlcool = rec.filter((r) => r.sansAlcool);
check(`${rec.length - sansAlcool.length} cocktails, toujours 50`,
  rec.length - sansAlcool.length === 50);
check(`${sansAlcool.length} recettes sans alcool`, sansAlcool.length === 6);

const sansPhoto = rec.filter((r) => !fs.existsSync(path.join(ROOT, "img", r.id + ".jpg")));
check(`les ${rec.length} recettes ont une photo`, sansPhoto.length === 0,
  sansPhoto.map((r) => r.id).join(", "));

/* ------------------------------------------------------ l'application */

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`\nserveur local : ${base}\n`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA"
});
const page = await ctx.newPage();
const erreurs = [];
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", (e) => erreurs.push(String(e)));

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector("details.r");

const rubans = page.locator(".amb");
check(`le ruban montre « Tout » et les ${amb.length} occasions`,
  await rubans.count() === amb.length + 1);
check("« Tout » est sélectionné au départ",
  await page.locator('.amb[data-amb=""]').getAttribute("aria-pressed") === "true");

const toutes = await page.locator("details.r").count();

for (const a of amb) {
  await page.locator(`.amb[data-amb="${a.id}"]`).click();
  await page.waitForTimeout(250);
  const montrees = await page.locator("details.r").count();
  const ids = await page.locator("details.r").evaluateAll((els) => els.map((e) => e.dataset.id));
  const hors = ids.filter((id) => !a.recettes.includes(id));
  check(`« ${a.nom} » : ${montrees} recettes, toutes de la sélection`,
    montrees > 0 && hors.length === 0, hors.join(", "));
  check(`« ${a.nom} » affiche sa description`,
    (await page.locator(".hint").first().innerText()).includes(a.description.slice(0, 24)));
}

// la sélection des ados montre bien la mention « sans alcool ».
// On repasse par « Tout » : retoucher une puce déjà active la désactive.
await page.locator('.amb[data-amb=""]').click();
await page.waitForTimeout(200);
await page.locator('.amb[data-amb="avec-mes-ados"]').click();
await page.waitForTimeout(250);
const cartes = await page.locator("details.r").count();
const badges = await page.locator("details.r .mine.doux").count();
check(`« Avec mes ados » : les ${cartes} recettes portent la mention « sans alcool »`,
  cartes > 0 && badges === cartes, `${badges}/${cartes}`);

// retoucher la même puce remet tout
await page.locator('.amb[data-amb="avec-mes-ados"]').click();
await page.waitForTimeout(250);
check("retoucher la puce enlève le filtre",
  await page.locator("details.r").count() === toutes);

// une occasion se combine avec l'onglet « Presque »
await page.locator('.amb[data-amb="piscine"]').click();
await page.waitForTimeout(200);
await page.locator("#t-near").click();
await page.waitForTimeout(250);
const idsPresque = await page.locator("details.r").evaluateAll((els) => els.map((e) => e.dataset.id));
const piscine = amb.find((a) => a.id === "piscine");
check("l’occasion reste active en changeant d’onglet",
  idsPresque.every((id) => piscine.recettes.includes(id)), idsPresque.join(", "));

check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));

await ctx.close();
await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
