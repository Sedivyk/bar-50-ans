/* Vérifie les étoiles : noter une recette (demi-étoiles comprises),
   filtrer par note, et retrouver ses notes après un rechargement.

   node tests/notes.mjs */

import { chromium, devices } from "playwright";
import { serve, journal } from "./serveur.mjs";

const { check, bilan } = journal();

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`\nserveur local : ${base}\n`);

const browser = await chromium.launch();
const erreurs = [];

for (const scheme of ["light", "dark"]) {
  console.log(`\n— thème ${scheme}`);
  const ctx = await browser.newContext({
    ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA",
    colorScheme: scheme
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  page.on("pageerror", (e) => erreurs.push(String(e)));

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("details.r");

  const cartes = page.locator("details.r");
  const total = await cartes.count();
  check("aucun filtre par note tant que rien n’est noté",
    await page.locator("[data-filtre-note]").count() === 0);

  const premier = await cartes.nth(0).getAttribute("data-id");
  const second = await cartes.nth(1).getAttribute("data-id");
  const carte = (id) => page.locator(`details.r[data-id="${id}"]`);

  /* une demi-étoile : 4,5 sur la première recette */
  await carte(premier).locator("summary").click();
  await carte(premier).locator('.demi[data-note="4.5"]').click();
  await page.waitForTimeout(150);
  check("la recette reste ouverte après la note", await carte(premier).evaluate((d) => d.open));
  check("4,5/5 est affiché", (await carte(premier).locator(".note-val").innerText()) === "4,5/5");
  check("quatre étoiles pleines et une demie",
    await carte(premier).locator(".etoile.f100").count() === 4
    && await carte(premier).locator(".etoile.f50").count() === 1);
  check("le résumé porte « ★ 4,5 »",
    (await carte(premier).locator("summary .note-mini").innerText()) === "★ 4,5");

  /* trois étoiles sur la seconde */
  await carte(second).locator("summary").click();
  await carte(second).locator('.demi[data-note="3"]').click();
  await page.waitForTimeout(150);
  check("3/5 sur la seconde", (await carte(second).locator(".note-val").innerText()) === "3/5");

  if (scheme === "light") await page.screenshot({ path: "captures/notes-clair.png" }).catch(() => {});
  else await page.screenshot({ path: "captures/notes-sombre.png" }).catch(() => {});

  /* les filtres */
  check("le filtre par note apparaît", await page.locator("[data-filtre-note]").count() === 6);
  await page.locator('[data-filtre-note="4"]').click();
  await page.waitForTimeout(150);
  let ids = await cartes.evaluateAll((ds) => ds.map((d) => d.dataset.id));
  check("« 4 et + » ne garde que la 4,5", ids.length === 1 && ids[0] === premier, ids.join(","));

  await page.locator('[data-filtre-note="3"]').click();
  await page.waitForTimeout(150);
  ids = await cartes.evaluateAll((ds) => ds.map((d) => d.dataset.id));
  check("« 3 et + » garde les deux, la mieux notée d’abord",
    ids.length === 2 && ids[0] === premier && ids[1] === second, ids.join(","));

  await page.locator('[data-filtre-note="5"]').click();
  await page.waitForTimeout(150);
  check("« 5 » : aucune, avec un message", await cartes.count() === 0
    && await page.locator(".empty").count() === 1);

  await page.locator('[data-filtre-note="aucune"]').click();
  await page.waitForTimeout(150);
  check("« Pas notées » écarte les deux", await cartes.count() === total - 2);

  await page.locator('[data-filtre-note=""]').click();
  await page.waitForTimeout(150);
  check("« Toutes les notes » remet tout", await cartes.count() === total);

  /* rechargement : les notes restent */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("details.r");
  check("après rechargement, la note est toujours là",
    (await carte(premier).locator("summary .note-mini").innerText()) === "★ 4,5");

  /* retoucher la même demi-étoile efface la note ; « Effacer » aussi */
  await carte(premier).locator("summary").click();
  await carte(premier).locator('.demi[data-note="4.5"]').click();
  await page.waitForTimeout(150);
  check("retoucher sa note l’efface", await carte(premier).locator(".note-mini").count() === 0);

  await carte(second).locator("summary").click();
  await carte(second).locator('button[data-note="0"]').click();
  await page.waitForTimeout(150);
  check("« Effacer » retire la note", await carte(second).locator(".note-mini").count() === 0);
  check("plus rien de noté : le filtre disparaît",
    await page.locator("[data-filtre-note]").count() === 0);

  /* une valeur abîmée dans le stockage est ignorée, sans erreur */
  await page.evaluate((id) => localStorage.setItem("ton-bar-notes-v1",
    JSON.stringify({ [id]: 4.3, autre: "x", trop: 9 })), premier);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("details.r");
  check("4,3 est ramené à 4,5 ; les valeurs invalides sont ignorées",
    (await carte(premier).locator("summary .note-mini").innerText()) === "★ 4,5"
    && await page.locator(".note-mini").count() === 1);

  await ctx.close();
}

check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));

await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
