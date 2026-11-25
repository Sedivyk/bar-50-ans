/* Vérifie « Mes notes » : écrire ce qu’on a changé sur une recette, le
   retrouver après un rechargement, le chercher, l’exporter et l’effacer.

   node tests/commentaires.mjs */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, devices } from "playwright";
import { serve, journal } from "./serveur.mjs";

const { check, bilan } = journal();

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`\nserveur local : ${base}\n`);

const browser = await chromium.launch();
const erreurs = [];
const TEXTE = "J’ai mis ½ oz de sirop au lieu de ¾.\nLes enfants ont adoré — refaire à Noël.";

for (const scheme of ["light", "dark"]) {
  console.log(`\n— thème ${scheme}`);
  const ctx = await browser.newContext({
    ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA",
    colorScheme: scheme, acceptDownloads: true
  });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.on("dialog", (d) => d.accept());
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("details.r");

  const id = await page.locator("details.r").first().getAttribute("data-id");
  const carte = () => page.locator(`details.r[data-id="${id}"]`);
  await carte().locator("summary").click();

  check("chaque recette offre « Écrire une note »",
    (await carte().locator("[data-commenter]").innerText()).includes("Écrire une note"));
  check("pas de ✎ tant qu’elle n’a rien écrit", await carte().locator(".com-mini").count() === 0);

  await carte().locator("[data-commenter]").click();
  await page.waitForSelector("#c-texte");
  check("la zone de texte reçoit le curseur",
    await page.evaluate(() => document.activeElement && document.activeElement.id === "c-texte"));
  await page.locator("#c-texte").fill(TEXTE);
  await page.locator("#c-texte").press("Enter"); // Entrée sert à écrire, pas à fermer
  check("Entrée ajoute une ligne sans fermer la fenêtre", await page.locator("#dlg[open]").count() === 1);
  await page.locator("#c-texte").fill(TEXTE);
  await page.locator("#c-ok").click();
  await page.waitForTimeout(150);

  check("la recette reste ouverte après l’enregistrement", await carte().evaluate((d) => d.open));
  const affiche = await carte().locator(".commentaire").innerText();
  check("ses notes s’affichent, retours de ligne compris",
    affiche.includes("½ oz de sirop") && affiche.includes("\n"));
  check("le ✎ apparaît sur la recette", await carte().locator("summary .com-mini").count() === 1);
  check("le bouton devient « Modifier mes notes »",
    (await carte().locator("[data-commenter]").innerText()).includes("Modifier"));
  await page.screenshot({ path: `captures/commentaires-${scheme}.png` }).catch(() => {});

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("details.r");
  check("ses notes survivent au rechargement",
    ((await carte().locator(".commentaire").textContent()) || "").includes("refaire à Noël"));

  await page.locator("#q").fill("refaire à noël");
  await page.waitForTimeout(250);
  check("la recherche trouve la recette par ses notes",
    await page.locator("details.r").count() === 1 && await carte().count() === 1);
  await page.locator("#q").fill("");
  await page.waitForTimeout(150);

  if (scheme === "light") {
    await page.locator("#t-bar").click();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("#exporter").click()]);
    const fichier = path.join(os.tmpdir(), `ton-bar-com-${Date.now()}.json`);
    await dl.saveAs(fichier);
    const paquet = JSON.parse(fs.readFileSync(fichier, "utf8"));
    check("l’export contient ses notes", paquet.commentaires && paquet.commentaires[id] === TEXTE);
    fs.unlinkSync(fichier);
    await page.locator("#t-ok").click();
  }

  await carte().locator("summary").click();
  await carte().locator("[data-commenter]").click();
  await page.waitForSelector("#c-effacer");
  await page.locator("#c-effacer").click();
  await page.waitForTimeout(150);
  check("« Effacer mes notes » les retire",
    await carte().locator(".commentaire").count() === 0 && await carte().locator(".com-mini").count() === 0);
  check("et rien ne reste en mémoire",
    await page.evaluate(() => !Object.keys(JSON.parse(localStorage.getItem("ton-bar-commentaires-v1") || "{}")).length));

  await ctx.close();
}

check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));
await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
