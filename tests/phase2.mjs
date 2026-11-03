/* Vérifie ce qu'elle peut ajouter elle-même : une bouteille, une recette
   avec une photo, le choix de la bouteille utilisée, l'export et l'import.

   node tests/phase2.mjs */

import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";
import { serve, journal, ROOT } from "./serveur.mjs";

const { check, bilan } = journal();
const iPhone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA" };

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`serveur local : ${base}\n`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone, acceptDownloads: true });
const page = await ctx.newPage();

const erreurs = [];
page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", (e) => erreurs.push(String(e)));

const compteur = async (id) => Number(await page.locator(id).textContent());
const ouvrirBar = async () => { await page.locator("#t-bar").click(); await page.waitForSelector(".chip input"); };

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector("details.r");
const okDepart = await compteur("#n-ok");
check(`au départ : ${okDepart} recettes faisables`, okDepart > 0);

/* ---------------------------------------------- 1. ajouter une bouteille */

await ouvrirBar();
await page.locator("#ajouter-bouteille").click();
await page.waitForSelector("#b-nom");
await page.locator("#b-nom").fill("Don Julio Blanco");
await page.locator("#b-cat").selectOption("Tequila");
await page.locator("#b-type").selectOption("tequila-blanche");
await page.locator("#b-ok").click();
await page.waitForSelector("#dlg:not([open])", { state: "attached" });
await page.waitForTimeout(300);

const ajoutee = page.locator('.chip:has-text("Don Julio Blanco") input');
check("la bouteille ajoutée apparaît dans Mon bar", await ajoutee.count() === 1);
check("elle est cochée d’office", await ajoutee.isChecked());
check("elle est marquée « à moi »",
  await page.locator('.chip-rang:has-text("Don Julio Blanco") .box').count() > 0);

/* --- le cœur du sujet : une bouteille ajoutée doit faire marcher les recettes --- */

// on décoche les deux tequilas du départ : il ne reste que la Don Julio
for (const id of ["patron", "casamigos"]) {
  await page.locator(`.chip:has(input[data-id="${id}"]) span`).click();
  await page.waitForTimeout(80);
}
await page.locator("#t-ok").click();
await page.waitForTimeout(250);
await page.locator("#q").fill("Margarita classique");
await page.waitForTimeout(250);
const margarita = page.locator('details.r[data-id="margarita-classique"]');
check("sans Patrón ni Casamigos, la Margarita reste faisable grâce à la Don Julio",
  await margarita.count() === 1);
await margarita.locator("summary").click();
await page.waitForTimeout(200);
const texteMarg = await margarita.locator(".ing").innerText();
check("la recette nomme la bouteille qui sera utilisée",
  texteMarg.includes("Don Julio Blanco"), texteMarg.split("\n")[0]);
check("et annonce le type visé", texteMarg.includes("Tequila blanche"));

// on remet les tequilas du départ
await ouvrirBar();
for (const id of ["patron", "casamigos"]) {
  await page.locator(`.chip:has(input[data-id="${id}"]) span`).click();
  await page.waitForTimeout(80);
}

/* ------------------------------------------- 2. choisir une autre bouteille */

await page.locator("#t-ok").click();
await page.waitForTimeout(200);
await page.locator("#q").fill("Margarita classique");
await page.waitForTimeout(250);
await page.locator('details.r[data-id="margarita-classique"] summary').click();
await page.waitForTimeout(200);
const choix = page.locator('details.r[data-id="margarita-classique"] select.pick').first();
check("un choix de bouteille est proposé quand elle en a plusieurs", await choix.count() === 1);
const options = await choix.locator("option").allTextContents();
check(`les trois tequilas blanches sont proposées (${options.length})`, options.length === 3,
  options.join(" / "));
await choix.selectOption({ label: "Don Julio Blanco" });
await page.waitForTimeout(300);
const apresChoix = await page.locator('details.r[data-id="margarita-classique"] .ing').innerText();
check("le choix est pris en compte", apresChoix.includes("Don Julio Blanco"));

/* -------------------------------------- 3. recherche par type et par bouteille */

for (const [terme, attendu] of [["tequila blanche", true], ["Don Julio", true], ["zzzz", false]]) {
  await page.locator("#q").fill(terme);
  await page.waitForTimeout(250);
  const n = await page.locator("details.r").count();
  check(`recherche « ${terme} » : ${n} résultat(s)`, attendu ? n > 0 : n === 0);
}
await page.locator("#q").fill("");
await page.waitForTimeout(200);

/* ------------------------------------- 4. ajouter une recette avec une photo */

await ouvrirBar();
await page.locator("#ajouter-recette").click();
await page.waitForSelector("#r-nom");
await page.locator("#r-nom").fill("Mon cocktail d’anniversaire");
await page.locator("#r-verre").selectOption("coupe");

const lignes = page.locator(".ing-ligne");
await lignes.nth(0).locator(".ing-q").fill("2 oz");
await lignes.nth(0).locator(".ing-nom").fill("Don Julio Blanco");
await lignes.nth(1).locator(".ing-q").fill("¾ oz");
await lignes.nth(1).locator(".ing-nom").fill("St-Germain");
await lignes.nth(2).locator(".ing-q").fill("1 pincée");
await lignes.nth(2).locator(".ing-nom").fill("Shimmer dust");
await lignes.nth(2).locator(".ing-fac").check();

await page.locator("#r-methode").fill("Secoue, filtre, et souffle les bougies.");
await page.locator("#r-note").fill("Celui-là, c’est le mien.");

// une photo « prise sur le moment » : on pousse un vrai JPEG dans l’appareil photo
const photo = fs.readFileSync(path.join(ROOT, "img", "le-50.jpg"));
await page.locator("#r-photo-camera").setInputFiles({
  name: "photo.jpg", mimeType: "image/jpeg", buffer: photo
});
await page.waitForTimeout(400);
check("l’aperçu de la photo s’affiche", await page.locator("#r-apercu img").count() === 1);

await page.locator("#r-ok").click();
await page.waitForTimeout(700);
const erreurVisible = await page.locator("#r-erreur:not([hidden])").count();
check("la recette est acceptée", erreurVisible === 0,
  erreurVisible ? await page.locator("#r-erreur").innerText() : "");

await page.locator("#t-ok").click();
await page.waitForTimeout(300);
const mienne = page.locator('details.r:has-text("Mon cocktail d’anniversaire")').first();
check("ma recette apparaît avec les autres", await mienne.count() === 1);
check("elle porte la mention « ma recette »",
  (await mienne.locator(".mine").count()) === 1);
await mienne.locator("summary").click();
await page.waitForTimeout(400);
const srcPhoto = await mienne.locator(".photo img").getAttribute("src").catch(() => null);
check("la photo prise est affichée", !!srcPhoto && srcPhoto.startsWith("blob:"), String(srcPhoto));

/* -------------------------------- 5. on la retrouve après avoir fermé l’app */

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("details.r");
await page.waitForTimeout(500);
const apresRelance = page.locator('details.r:has-text("Mon cocktail d’anniversaire")');
check("la recette est encore là après un redémarrage", await apresRelance.count() === 1);
const bouteilleEncore = await page.evaluate(() => {
  return [...document.querySelectorAll(".tab")].length > 0;
});
await ouvrirBar();
check("la bouteille ajoutée est encore là aussi",
  await page.locator('.chip:has-text("Don Julio Blanco")').count() === 1 && bouteilleEncore);

/* ------------------------------------------------ 6. exporter puis importer */

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#exporter").click()
]);
const fichier = path.join(ROOT, "captures", "mon-bar-test.json");
await download.saveAs(fichier);
const paquet = JSON.parse(fs.readFileSync(fichier, "utf8"));
check("le fichier exporté contient la bouteille", (paquet.bouteilles || []).length === 1);
check("…la recette", (paquet.recettes || []).length === 1);
check("…et la photo", (paquet.photos || []).length === 1
  && String(paquet.photos[0].image).startsWith("data:image/jpeg"));
check("…sans rien d’autre que ses données",
  paquet.application === "ton-bar" && !!paquet.inventaire);

// on efface tout, comme si elle changeait de téléphone
await page.evaluate(async () => {
  await new Promise((ok) => {
    const req = indexedDB.deleteDatabase("ton-bar");
    req.onsuccess = req.onerror = req.onblocked = ok;
  });
  localStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("details.r");
await ouvrirBar();
check("après effacement, la bouteille a bien disparu",
  await page.locator('.chip:has-text("Don Julio Blanco")').count() === 0);

await page.locator("#fichier-import").setInputFiles(fichier);
await page.waitForTimeout(1200);
await ouvrirBar();
check("l’import ramène la bouteille",
  await page.locator('.chip:has-text("Don Julio Blanco")').count() === 1);
await page.locator("#t-ok").click();
await page.waitForTimeout(400);
const revenue = page.locator('details.r:has-text("Mon cocktail d’anniversaire")');
check("l’import ramène la recette", await revenue.count() === 1);
await revenue.first().locator("summary").click();
await page.waitForTimeout(500);
const src2 = await revenue.first().locator(".photo img").getAttribute("src").catch(() => null);
check("l’import ramène la photo", !!src2 && src2.startsWith("blob:"), String(src2));

/* --------------------------------- 7. le clavier ne doit pas tout perdre */

// « Annuler » ferme sans rien enregistrer, même avec un champ rempli
await ouvrirBar();
await page.locator("#ajouter-bouteille").click();
await page.waitForSelector("#b-nom");
await page.locator("#b-nom").fill("Bouteille annulée");
await page.locator('.boutons [data-annuler]').click();
await page.waitForTimeout(400);
check("« Annuler » ferme la fenêtre", await page.locator("#dlg[open]").count() === 0);
check("« Annuler » n’enregistre rien",
  await page.locator('.chip:has-text("Bouteille annulée")').count() === 0);

// Entrée dans un champ enregistre, au lieu de fermer la fenêtre
await page.locator("#ajouter-bouteille").click();
await page.waitForSelector("#b-nom");
await page.locator("#b-nom").fill("Bombay Sapphire");
await page.locator("#b-type").selectOption("gin");
await page.locator("#b-nom").press("Enter");
await page.waitForTimeout(600);
check("Entrée enregistre la bouteille au lieu de fermer",
  await page.locator('.chip:has-text("Bombay Sapphire")').count() === 1);

/* ------------------------------------------------------------ propreté */

const brisees = await page.evaluate(() =>
  [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length);
check("aucune image brisée", brisees === 0);
check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));

await ctx.close();
await browser.close();
server.close();
fs.rmSync(fichier, { force: true });
process.exit(bilan() ? 1 : 0);
