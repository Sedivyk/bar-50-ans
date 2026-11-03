/* Vérifications visuelles et fonctionnelles de « Ton bar », format iPhone.
   Lancer :  node tests/check.mjs          (sert le dossier puis teste)
             node tests/check.mjs <url>    (teste une adresse déjà en ligne)
   Captures écrites dans captures/ (non versionné). */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "captures");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".css": "text/css; charset=utf-8"
};

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ok  " : " ÉCHEC"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function run(base) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const iPhone = devices["iPhone 13"];

  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      ...iPhone,
      viewport: { width: 390, height: 844 }, // format demandé, sans la barre du navigateur
      colorScheme: scheme,
      locale: "fr-CA"
    });
    const page = await ctx.newPage();

    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    const broken = [];
    page.on("response", (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });

    await page.goto(base, { waitUntil: "networkidle" });
    const vp = page.viewportSize();
    check(`[${scheme}] format iPhone ${vp.width}×${vp.height}`, vp.width === 390 && vp.height === 844);

    // les recettes sont chargées
    await page.waitForSelector("details.r", { timeout: 10000 });
    const nOk = Number(await page.locator("#n-ok").textContent());
    const nNear = Number(await page.locator("#n-near").textContent());
    const shown = await page.locator("details.r").count();
    check(`[${scheme}] « Je peux faire » : compteur ${nOk} = ${shown} recettes affichées`, nOk === shown);
    check(`[${scheme}] « Presque » a un compteur`, Number.isFinite(nNear));

    // onglet Presque : le compteur correspond aussi
    await page.locator("#t-near").click();
    await page.waitForTimeout(150);
    const shownNear = await page.locator("details.r").count();
    check(`[${scheme}] « Presque » : compteur ${nNear} = ${shownNear} recettes affichées`, nNear === shownNear);

    // décocher une bouteille change les compteurs
    await page.locator("#t-bar").click();
    await page.waitForSelector(".chip input");
    // St-Germain : seule bouteille possible dans plusieurs recettes, donc la décocher
    // doit vraiment faire bouger les compteurs (Patrón, elle, a Casamigos en remplaçante).
    // La case est masquée visuellement : on touche l’étiquette, comme au doigt.
    const box = page.locator('.chip input[data-id="stgermain"]');
    const chip = page.locator('.chip:has(input[data-id="stgermain"]) span');
    await chip.click();
    await page.waitForTimeout(100);
    check(`[${scheme}] St-Germain est bien décochée`, (await box.isChecked()) === false);
    const nOk2 = Number(await page.locator("#n-ok").textContent());
    const nNear2 = Number(await page.locator("#n-near").textContent());
    check(`[${scheme}] décocher St-Germain fait baisser « Je peux faire » (${nOk} → ${nOk2})`, nOk2 < nOk);
    check(`[${scheme}] et fait monter « Presque » (${nNear} → ${nNear2})`, nNear2 > nNear);

    // le compteur reste juste après la modification
    await page.locator("#t-ok").click();
    await page.waitForTimeout(150);
    check(`[${scheme}] compteur toujours juste après décochage`,
      (await page.locator("details.r").count()) === nOk2);
    await page.locator("#t-bar").click();
    await page.waitForSelector(".chip input");

    await chip.click();
    await page.waitForTimeout(100);
    const nOk3 = Number(await page.locator("#n-ok").textContent());
    const nNear3 = Number(await page.locator("#n-near").textContent());
    check(`[${scheme}] recocher St-Germain rétablit les compteurs (${nOk3} / ${nNear3})`,
      nOk3 === nOk && nNear3 === nNear);

    // l’astuce « écran d’accueil » est là
    check(`[${scheme}] astuce « écran d’accueil » présente`, await page.locator(".install").count() === 1);
    await page.screenshot({ path: path.join(SHOTS, `bar-${scheme}.png`), fullPage: true });

    // retour au premier onglet + une recette ouverte
    await page.locator("#t-ok").click();
    await page.waitForSelector("details.r");
    await page.locator("details.r").first().locator("summary").click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, `recette-${scheme}.png`), fullPage: true });

    // aucune image brisée. On déroule d'abord la page pour déclencher le
    // chargement différé, sinon une image encore en attente passerait pour
    // brisée. Brisée = chargement terminé mais largeur nulle.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await Promise.all(
        [...document.images].map((i) =>
          i.complete ? null : new Promise((r) => {
            i.addEventListener("load", r, { once: true });
            i.addEventListener("error", r, { once: true });
            setTimeout(r, 3000);
          })
        )
      );
    });
    const imgStats = await page.evaluate(() => ({
      total: document.images.length,
      charges: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length,
      brisees: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src)
    }));
    check(`[${scheme}] aucune image brisée (${imgStats.charges}/${imgStats.total} chargées)`,
      imgStats.brisees.length === 0, imgStats.brisees.join(", "));
    check(`[${scheme}] aucune requête en erreur`, broken.length === 0, broken.join(", "));
    check(`[${scheme}] aucune erreur console`, errors.length === 0, errors.join(" | "));

    // pas de défilement horizontal
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check(`[${scheme}] pas de débordement horizontal`, overflow <= 0, `${overflow}px`);

    await ctx.close();
  }

  // PWA : manifeste, icônes, service worker
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-CA" });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  check("le manifeste est déclaré", !!manifestHref);
  const manifest = await (await page.request.get(new URL(manifestHref, base).href)).json();
  check("le manifeste se nomme « Ton bar »", manifest.short_name === "Ton bar", manifest.short_name);
  check("le manifeste a 3 icônes", (manifest.icons || []).length === 3);
  check("le manifeste a une icône maskable",
    (manifest.icons || []).some((i) => String(i.purpose).includes("maskable")));
  for (const icon of manifest.icons || []) {
    const r = await page.request.get(new URL(icon.src, new URL(manifestHref, base)).href);
    check(`icône ${icon.src} servie`, r.ok(), String(r.status()));
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  check("apple-touch-icon déclaré", !!apple);
  check("apple-touch-icon servi", (await page.request.get(new URL(apple, base).href)).ok());
  check("noindex présent",
    (await page.locator('meta[name="robots"]').getAttribute("content") || "").includes("noindex"));

  const swReady = await page.evaluate(() =>
    navigator.serviceWorker.ready.then((r) => !!r.active).catch(() => false)
  );
  check("service worker actif", swReady);

  // chaque recette a soit une photo, soit un verre dessiné — jamais rien
  const couverture = await page.evaluate(() =>
    [...document.querySelectorAll("details.r")].map((d) => ({
      id: d.dataset.id,
      visuel: !!d.querySelector(".thumb img, .thumb .glass")
    }))
  );
  check(`chaque recette affichée a une vignette (${couverture.length})`,
    couverture.length > 0 && couverture.every((c) => c.visuel),
    couverture.filter((c) => !c.visuel).map((c) => c.id).join(", "));

  // une photo qui ne charge pas doit être remplacée par le verre dessiné
  const ctx2 = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, locale: "fr-CA" });
  const page2 = await ctx2.newPage();
  await page2.route("**/img/*.jpg", (route) => route.abort());
  await page2.goto(base, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("details.r");
  await page2.locator("details.r").first().locator("summary").click();
  await page2.waitForTimeout(600);
  const replis = await page2.evaluate(() => ({
    brisees: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    verres: document.querySelectorAll(".thumb .glass").length,
    grandVerre: document.querySelectorAll(".photo.noimg .glass").length
  }));
  check("photo illisible : aucune image brisée ne reste", replis.brisees === 0);
  check(`photo illisible : les vignettes deviennent des verres (${replis.verres})`, replis.verres > 0);
  check(`photo illisible : la grande photo devient un verre (${replis.grandVerre})`, replis.grandVerre > 0);
  await ctx2.close();

  // hors ligne : la page doit encore s’ouvrir et afficher des recettes
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const offlineOk = await page
    .waitForSelector("details.r", { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check("l’application s’ouvre hors ligne", offlineOk);
  await ctx.setOffline(false);

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
  console.log(`captures : ${SHOTS}`);
  if (failed.length) process.exit(1);
}

const arg = process.argv[2];
if (arg) {
  await run(arg);
} else {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  console.log(`serveur local : ${base}\n`);
  try {
    await run(base);
  } finally {
    server.close();
  }
}
