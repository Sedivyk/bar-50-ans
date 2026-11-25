/* Vérifie l'onglet « Idées » : choisir des ingrédients sans toucher à son
   bar, voir ses recettes qui les utilisent, et les idées de l'IA (le relais
   est simulé : aucun appel réel à Gemini).

   node tests/idees.mjs */

import { chromium, devices } from "playwright";
import { serve, journal } from "./serveur.mjs";

const { check, bilan } = journal();
const RELAIS = "https://relais.test/idees";

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/`;
console.log(`\nserveur local : ${base}\n`);

const browser = await chromium.launch();
const erreurs = [];

async function nouvellePage(scheme, avecIA) {
  const ctx = await browser.newContext({
    ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA", colorScheme: scheme
  });
  // sans relais : on coupe l’IA, même si ADRESSE_IA est remplie
  await ctx.addInitScript((url) => { window.TON_BAR_IA = url; }, avecIA ? RELAIS : "");
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("429")) erreurs.push(m.text()); });
  page.on("pageerror", (e) => erreurs.push(String(e)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("details.r");
  return { ctx, page };
}

/* ------------------------------------------------ sans relais configuré */
{
  const { ctx, page } = await nouvellePage("light", false);

  const deborde = await page.evaluate(() => {
    const nav = document.querySelector(".tabs");
    return nav.scrollWidth > nav.clientWidth + 1 ||
      [...nav.querySelectorAll(".tab")].some((t) => t.scrollWidth > t.clientWidth + 1);
  });
  check("les quatre onglets tiennent sur un iPhone", !deborde);

  const okAvant = await page.locator("#n-ok").textContent();
  await page.locator("#t-idees").click();
  await page.waitForSelector("input[data-sel]");
  check("tous les ingrédients sont décochés au départ",
    await page.locator("input[data-sel]:checked").count() === 0
    && await page.locator("input[data-sel]").count() > 50);
  check("rien d’IA sans relais configuré", await page.locator("#inventer, .idees-ia").count() === 0);

  await page.locator('.chip:has(input[data-sel="stgermain"]) span').click();
  await page.waitForTimeout(150);
  check("le St-Germain est choisi", await page.locator('input[data-sel="stgermain"]').isChecked());
  check("choisir ne touche pas à son bar", await page.locator("#n-ok").textContent() === okAvant);
  const avecSureau = await page.locator("#idees-resultats details.r").count();
  check(`${avecSureau} recettes utilisent le St-Germain`, avecSureau >= 3);
  check("Le 50 en fait partie",
    await page.locator('#idees-resultats details.r[data-id="le-50"]').count() === 1);

  await page.locator('.chip:has(input[data-sel="lime"]) span').click();
  await page.waitForTimeout(150);
  const premiers = await page.locator("#idees-resultats details.r").evaluateAll((ds) => ds.slice(0, 1).map((d) => d.dataset.id));
  const total = await page.locator("#idees-resultats details.r").count();
  check(`avec la lime aussi : ${total} recettes, celles qui ont les deux d’abord`,
    total >= avecSureau && premiers.length === 1);
  check("la barre « Voir les idées » montre 2 choisis",
    (await page.locator("#idees-voir").innerText()).includes("2 choisis"));
  await page.screenshot({ path: "captures/idees-choix.png" }).catch(() => {});

  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#t-idees").click();
  await page.waitForSelector("input[data-sel]");
  check("la sélection survit au rechargement",
    await page.locator("input[data-sel]:checked").count() === 2);

  await page.locator("#idees-vider").click();
  await page.waitForTimeout(150);
  check("« Tout décocher » vide la sélection",
    await page.locator("input[data-sel]:checked").count() === 0
    && await page.locator("#idees-resultats .empty").count() === 1);

  await page.locator("#t-bar").click();
  check("Mon bar est intact (St-Germain toujours coché)",
    await page.locator('input[data-id="stgermain"]').isChecked());
  await ctx.close();
}

/* ------------------------------------------------ avec le relais (simulé) */
for (const scheme of ["light", "dark"]) {
  console.log(`\n— IA, thème ${scheme}`);
  const { ctx, page } = await nouvellePage(scheme, true);
  let recu = null;
  let mode = "ok";
  await page.route(RELAIS, async (route) => {
    recu = JSON.parse(route.request().postData());
    if (mode === "quota") return route.fulfill({ status: 429, body: "{}" , headers: { "access-control-allow-origin": "*" } });
    await new Promise((r) => setTimeout(r, 300));
    return route.fulfill({
      status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ recettes: [
        { nom: "Brise de sureau", verre: "coupe", methode: "Secoue avec de la glace, puis filtre.",
          note: "Florale et vive.", deco: ["Un zeste de lime"],
          ingredients: [
            { q: "1 oz", ref: "stgermain", nom: "St-Germain" },
            { q: "½ oz", ref: "lime", nom: "Lime" },
            { q: "2 gouttes", ref: "inconnu", nom: "Eau de rose" },
            { q: "Compléter", ref: "stgermain", nom: "Bière d’épinette" }] },
        { nom: "Sureau pétillant", verre: "grand", methode: "Allonge.",
          ingredients: [{ q: "1 oz", ref: "stgermain", nom: "St-Germain" }] },
        { nom: "Rien de connu", verre: "court", methode: "x",
          ingredients: [{ q: "1 oz", ref: "zzz", nom: "Introuvable" }] }
      ] })
    });
  });

  await page.locator("#t-idees").click();
  await page.waitForSelector("input[data-sel]");
  check("pas de bouton tant que rien n’est choisi", await page.locator("#inventer").count() === 0);
  await page.locator('.chip:has(input[data-sel="stgermain"]) span').click();
  await page.waitForTimeout(150);
  check("le bouton « Inventer » apparaît", await page.locator("#inventer").isEnabled());

  await page.locator("#inventer").click();
  await page.waitForTimeout(80);
  check("il patiente pendant la demande",
    (await page.locator("#inventer").innerText()).includes("Un instant") && await page.locator("#inventer").isDisabled());
  await page.waitForSelector("details.r.ia");

  check("la demande envoie la sélection, et pas sa clé ni ses données perso",
    recu && recu.selection.length === 1 && recu.selection[0].ref === "stgermain"
    && Array.isArray(recu.connus) && Array.isArray(recu.eviter) && !("inventaire" in recu));
  const ia = page.locator("details.r.ia");
  check("deux idées gardées, celle sans ingrédient connu est écartée", await ia.count() === 2);
  await ia.first().locator("summary").click();
  const texte = await ia.first().innerText();
  check("l’ingrédient inconnu n’est pas perdu : « Aussi : 2 gouttes Eau de rose »",
    texte.includes("Aussi : 2 gouttes Eau de rose"));
  check("une référence collée sur le mauvais ingrédient ne le remplace pas",
    texte.includes("Compléter Bière d’épinette"));
  check("pas d’étoiles sur une idée pas encore gardée", await ia.first().locator(".ma-note").count() === 0);
  check("« Inventée pour : St-Germain »", texte.includes("Inventée pour : St-Germain"));
  await page.screenshot({ path: `captures/idees-ia-${scheme}.png` }).catch(() => {});

  const okAvant = Number(await page.locator("#n-ok").textContent());
  await ia.first().locator("[data-garder]").click();
  await page.waitForSelector("details.r.ia .gardee");
  check("« Garder » la marque comme gardée",
    (await page.locator("details.r.ia .gardee").first().innerText()).includes("Gardée"));
  const okApres = Number(await page.locator("#n-ok").textContent());
  check(`elle compte dans « Je peux faire » (${okAvant} → ${okApres})`, okApres === okAvant + 1);

  await page.locator("#t-ok").click();
  await page.locator("#q").fill("Brise de sureau");
  await page.waitForTimeout(250);
  const gardee = page.locator("details.r.perso");
  check("elle est dans ses recettes, marquée « ma recette · IA »",
    await gardee.count() === 1 && (await gardee.innerText()).toLowerCase().includes("ma recette · ia"));
  await page.locator("#q").fill("");

  await page.locator("#t-idees").click();
  await page.waitForSelector("details.r.ia");
  await page.locator("details.r.ia").nth(1).locator("summary").click();
  await page.locator("details.r.ia").nth(1).locator("[data-oublier-idee]").click();
  await page.waitForTimeout(150);
  check("« Non merci » retire l’idée", await page.locator("details.r.ia").count() === 1);

  mode = "quota";
  await page.locator("#inventer").click();
  await page.waitForSelector(".idees-ia .erreur");
  check("quota épuisé : un message clair",
    (await page.locator(".idees-ia .erreur").innerText()).includes("Réessaie un peu plus tard"));
  check("et les idées déjà là restent", await page.locator("details.r.ia").count() === 1);

  await ctx.close();
}

check("aucune erreur console", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));

await browser.close();
server.close();
process.exit(bilan() ? 1 : 0);
