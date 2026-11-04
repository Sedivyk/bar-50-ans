/* Vérifie les garnitures et les idées déco.

   node tests/phase3.mjs */

import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { serve, journal, ROOT } from "./serveur.mjs";

const { check, bilan } = journal();
const CAT = "Garnitures et déco";

/* ------------------------------------------------- d'abord, les données */

const ing = JSON.parse(fs.readFileSync(path.join(ROOT, "data/ingredients.json"), "utf8"));
const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "data/recettes.json"), "utf8"));
const connus = new Set(ing.ingredients.map((b) => b.id));

const garnitures = ing.ingredients.filter((b) => b.categorie === CAT);
check(`la catégorie « ${CAT} » existe`, ing.categories.includes(CAT));
check(`elle contient ${garnitures.length} garnitures`, garnitures.length >= 19);

/* Cochées au départ : le shimmer dust qu'elle avait déjà, plus la poudre
   d'or et les perles de yuzu achetées le 3 novembre. Tout le reste est à
   acheter, et doit rester décoché. */
const ATTENDUES = ["shimmer", "poudre-or", "perles-cocktail"];
const cochees = garnitures.filter((b) => b.defaut).map((b) => b.id).sort();
check(`${cochees.length} garnitures cochées au départ, les bonnes`,
  cochees.join(",") === ATTENDUES.slice().sort().join(","), cochees.join(", "));

const sansDeco = rec.filter((r) => !Array.isArray(r.deco) || !r.deco.length);
check(`les ${rec.length} recettes ont au moins une idée déco`, sansDeco.length === 0,
  sansDeco.map((r) => r.id).join(", "));

const troisIdees = rec.filter((r) => r.deco.length >= 3).length;
check(`${troisIdees} recettes ont une idée principale et au moins deux variantes`,
  troisIdees === rec.length);

const mauvaises = [];
for (const r of rec) {
  for (const idee of r.deco) {
    if (!idee.texte || !idee.texte.trim()) mauvaises.push(r.id + " : idée vide");
    for (const id of idee.ids || []) {
      if (!connus.has(id)) mauvaises.push(`${r.id} : garniture inconnue « ${id} »`);
    }
  }
}
check("toutes les garnitures citées existent", mauvaises.length === 0, mauvaises.slice(0, 3).join(" | "));

/* Une garniture peut très bien être un vrai ingrédient : la menthe d'un
   mojito en est une. Ce qui doit rester vrai, c'est que le champ « deco »
   n'entre jamais dans le calcul de ce qui manque. On sépare donc les
   garnitures qui ne servent qu'à décorer : ce sont elles qui ne doivent
   avoir aucun effet sur les compteurs. */
const typesIngredients = new Set();
const idsIngredients = new Set();
for (const r of rec) {
  for (const x of r.ingredients) {
    for (const t of x.types || []) typesIngredients.add(t);
    for (const id of x.ids || []) idsIngredients.add(id);
  }
}
const decoSeulement = garnitures.filter(
  (b) => !idsIngredients.has(b.id) && !typesIngredients.has(b.type));
const aussiIngredient = garnitures.filter(
  (b) => idsIngredients.has(b.id) || typesIngredients.has(b.type));

check(`${decoSeulement.length} garnitures ne servent qu’à décorer`,
  decoSeulement.length >= 15);
check(`${aussiIngredient.length} garnitures sont aussi de vrais ingrédients`,
  aussiIngredient.length > 0, aussiIngredient.map((b) => b.nom).join(", "));

// aucune idée déco ne cite une garniture comme si elle manquait
const citeesEnDeco = new Set();
for (const r of rec) for (const idee of r.deco || []) for (const id of idee.ids || []) citeesEnDeco.add(id);
check("les idées déco ne citent que des choses qui existent",
  [...citeesEnDeco].every((id) => connus.has(id)));

/* ------------------------------------------------- ensuite, l'application */

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
const okAvant = Number(await page.locator("#n-ok").textContent());
const presqueAvant = Number(await page.locator("#n-near").textContent());

// la Margarita classique : « Un bord de sel et un quartier de lime »
await page.locator("#q").fill("Margarita classique");
await page.waitForTimeout(250);
const marg = page.locator('details.r[data-id="margarita-classique"]');
await marg.locator("summary").click();
await page.waitForTimeout(200);

check("la recette ouverte a une section « Idées déco »",
  await marg.locator(".deco h3").innerText() === "Idées déco");
check("les trois idées sont visibles", await marg.locator(".deco li").count() === 3);
check("aucune n’est présentée comme manquante",
  (await marg.locator(".deco").innerText()).includes("à acheter") === false);
check("aucune n’est mise en avant avant d’avoir coché quoi que ce soit",
  await marg.locator(".deco li.a-toi").count() === 0);

/* cocher une garniture change immédiatement les idées mises en avant */
await page.locator("#t-bar").click();
await page.waitForSelector(".chip input");
await page.locator('.chip:has(input[data-id="sel"]) span').click();
await page.waitForTimeout(150);

const okApres = Number(await page.locator("#n-ok").textContent());
const presqueApres = Number(await page.locator("#n-near").textContent());
check(`cocher le sel ne change aucun compteur (${okAvant}/${presqueAvant} → ${okApres}/${presqueApres})`,
  okApres === okAvant && presqueApres === presqueAvant);

await page.locator("#t-ok").click();
await page.waitForTimeout(200);
await page.locator("#q").fill("Margarita classique");
await page.waitForTimeout(250);
await page.locator('details.r[data-id="margarita-classique"] summary').click();
await page.waitForTimeout(200);
const marg2 = page.locator('details.r[data-id="margarita-classique"]');
check("l’idée au sel est maintenant mise en avant",
  await marg2.locator(".deco li.a-toi").count() === 1,
  await marg2.locator(".deco").innerText());
check("et elle porte une coche", await marg2.locator(".deco li.a-toi .coche").count() === 1);
check("les deux autres idées restent visibles",
  await marg2.locator(".deco li").count() === 3);

// décocher remet comme avant
await page.locator("#t-bar").click();
await page.waitForSelector(".chip input");
await page.locator('.chip:has(input[data-id="sel"]) span').click();
await page.waitForTimeout(150);
await page.locator("#t-ok").click();
await page.waitForTimeout(200);
await page.locator("#q").fill("Margarita classique");
await page.waitForTimeout(250);
await page.locator('details.r[data-id="margarita-classique"] summary').click();
await page.waitForTimeout(200);
check("décocher le sel retire la mise en avant",
  await page.locator('details.r[data-id="margarita-classique"] .deco li.a-toi').count() === 0);

/* Cocher toutes les garnitures qui ne servent qu'à décorer ne doit rien
   changer aux compteurs : c'est la promesse « la déco n'empêche jamais
   un cocktail d'apparaître », prise par l'autre bout. */
await page.locator("#t-bar").click();
await page.waitForSelector(".chip input");
for (const b of decoSeulement.filter((x) => !x.defaut)) {
  const chip = page.locator(`.chip:has(input[data-id="${b.id}"]) span`);
  if (await chip.count()) { await chip.click(); await page.waitForTimeout(40); }
}
const okTout = Number(await page.locator("#n-ok").textContent());
const presqueTout = Number(await page.locator("#n-near").textContent());
check(`les ${decoSeulement.length} garnitures de pure déco cochées : compteurs toujours ${okAvant}/${presqueAvant}`,
  okTout === okAvant && presqueTout === presqueAvant, `${okTout}/${presqueTout}`);

/* En revanche, une garniture qui est un vrai ingrédient doit compter :
   la menthe débloque les mojitos. */
const menthe = page.locator('.chip:has(input[data-id="menthe"]) span');
if (await menthe.count()) {
  await menthe.click();
  await page.waitForTimeout(150);
  const okMenthe = Number(await page.locator("#n-ok").textContent());
  check(`cocher la menthe débloque des recettes (${okAvant} → ${okMenthe})`, okMenthe > okAvant);
  await menthe.click();
  await page.waitForTimeout(150);
  check("et la décocher les remet où elles étaient",
    Number(await page.locator("#n-ok").textContent()) === okAvant);
}

/* la page « Astuces déco » */
await page.locator("#astuces-deco").scrollIntoViewIfNeeded();
await page.locator("#astuces-deco").click();
await page.waitForSelector("#dlg[open]");
await page.waitForTimeout(200);
const astuces = page.locator(".astuce");
check("la page « Astuces déco » montre trois fiches", await astuces.count() === 3);
const texteAstuces = await page.locator("#dlg").innerText();
check("elle explique les fruits séchés (3 à 4 mm, 95 °C, 2 à 3 h)",
  texteAstuces.includes("3 ou 4 mm") && texteAstuces.includes("95 °C") && texteAstuces.includes("2 à 3 heures"));
check("elle explique comment givrer un bord",
  texteAstuces.includes("lime") && texteAstuces.includes("Tajín"));
check("elle explique les perles et le shimmer dust",
  texteAstuces.includes("shimmer dust") && texteAstuces.includes("perles"));
await page.locator('#dlg [data-annuler]').last().click();
await page.waitForTimeout(250);
check("la page se ferme", await page.locator("#dlg[open]").count() === 0);

check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));

await ctx.close();
await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
