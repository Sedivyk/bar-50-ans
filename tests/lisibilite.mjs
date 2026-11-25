/* Lecture confortable : le texte doit rester grand, et rien ne doit déborder,
   même au réglage « Très grand ».

   node tests/lisibilite.mjs */

import { chromium, devices } from "playwright";
import { serve, journal } from "./serveur.mjs";

const { check, bilan } = journal();
const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`\nserveur local : ${base}\n`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA"
});
const page = await ctx.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector("details.r");

/** Le plus petit texte visible (hors crédits photo), en px. */
const plusPetit = () => page.evaluate(() => {
  let min = 99, ou = "";
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (marche.nextNode()) {
    const n = marche.currentNode;
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest(".credit, [hidden], dialog:not([open]), .fifty")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < min) { min = px; ou = el.className || el.tagName; }
  }
  return { min, ou };
});

const deborde = () => page.evaluate(() =>
  document.documentElement.scrollWidth > window.innerWidth + 1 ||
  [...document.querySelectorAll(".tab")].some((t) => t.scrollWidth > t.clientWidth + 1) ||
  // rien ne dépasse d’une recette ouverte (la carte coupe ce qui sort)
  [...document.querySelectorAll("details.r[open]")].some((d) => {
    const bord = d.getBoundingClientRect().right;
    return [...d.querySelectorAll(".body *")].some((el) => el.getBoundingClientRect().right > bord + 1);
  }));

const ouvrirTout = () => page.evaluate(() => document.querySelectorAll("details.r").forEach((d) => { d.open = true; }));

for (const taille of ["normal", "plus", "max"]) {
  console.log(`\n— taille « ${taille} »`);
  await page.locator("#t-bar").click();
  await page.locator(`button[data-taille="${taille}"]`).click();
  await page.waitForTimeout(150);
  const racine = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  check(`texte de base : ${racine}px`, racine >= 19);

  for (const onglet of ["ok", "near", "bar", "idees"]) {
    await page.locator(`.tab[data-view="${onglet}"]`).click();
    await page.waitForTimeout(120);
    await ouvrirTout();
    const { min, ou } = await plusPetit();
    check(`[${onglet}] aucun texte sous 14,5 px (le plus petit : ${min}px)`, min >= 14.5, ou);
    check(`[${onglet}] rien ne déborde à l’horizontale`, !(await deborde()));
  }
  await page.locator(".tab[data-view=ok]").click();
  await page.screenshot({ path: `captures/taille-${taille}.png` }).catch(() => {});
}

await page.reload({ waitUntil: "networkidle" });
check("le réglage « Très grand » survit au rechargement",
  await page.evaluate(() => document.documentElement.dataset.taille) === "max");
await page.locator("#t-bar").click();
await page.locator('button[data-taille="normal"]').click();
check("revenir à « Grand » retire le réglage",
  await page.evaluate(() => !document.documentElement.dataset.taille));

check("aucune erreur", erreurs.length === 0, erreurs.join(" | "));
await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
