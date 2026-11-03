/* Exporter et réimporter son bar : un seul fichier JSON avec ses bouteilles,
   ses recettes, ses photos et ce qui est coché. De quoi ne rien perdre
   en changeant de téléphone ou en vidant son navigateur. */

import { etat, fusionner, chargerInventaire, enregistrerInventaire } from "./donnees.js";
import { BOUTEILLES, RECETTES, PHOTOS, tout, ecrire } from "./stockage.js";
import { versTexte, depuisTexte, oublierTout } from "./photos.js";

const FORMAT = 1;

export async function exporter() {
  const [bouteilles, recettes, photos] = await Promise.all([
    tout(BOUTEILLES), tout(RECETTES), tout(PHOTOS)
  ]);

  const paquet = {
    format: FORMAT,
    application: "ton-bar",
    date: new Date().toISOString(),
    inventaire: etat.have,
    choix: etat.choix,
    bouteilles,
    recettes,
    photos: await Promise.all(photos.map(async (p) => ({
      id: p.id, cree: p.cree, image: await versTexte(p.blob)
    })))
  };

  const blob = new Blob([JSON.stringify(paquet)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const jour = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mon-bar-${jour}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { bouteilles: bouteilles.length, recettes: recettes.length, photos: photos.length };
}

export async function importer(file) {
  const texte = await file.text();
  let paquet;
  try { paquet = JSON.parse(texte); }
  catch (e) { throw new Error("Ce fichier n’est pas lisible."); }

  if (!paquet || paquet.application !== "ton-bar" || !paquet.format) {
    throw new Error("Ce fichier ne vient pas de Ton bar.");
  }
  if (paquet.format > FORMAT) {
    throw new Error("Ce fichier vient d’une version plus récente de l’application.");
  }

  const compte = { bouteilles: 0, recettes: 0, photos: 0 };

  for (const p of paquet.photos || []) {
    if (!p || !p.id || !p.image) continue;
    try {
      await ecrire(PHOTOS, { id: p.id, blob: await depuisTexte(p.image), cree: p.cree });
      compte.photos++;
    } catch (e) { /* une photo illisible ne doit pas tout bloquer */ }
  }
  for (const b of paquet.bouteilles || []) {
    if (!b || !b.id || !b.nom) continue;
    await ecrire(BOUTEILLES, b);
    compte.bouteilles++;
  }
  for (const r of paquet.recettes || []) {
    if (!r || !r.id || !r.nom || !Array.isArray(r.ingredients)) continue;
    await ecrire(RECETTES, r);
    compte.recettes++;
  }

  oublierTout();
  for (const id of Object.keys(etat.photoURL)) delete etat.photoURL[id];
  await fusionner();

  // on rétablit ce qui était coché, sans perdre ce qui l’est déjà ici
  chargerInventaire();
  if (paquet.inventaire && typeof paquet.inventaire === "object") {
    for (const [id, v] of Object.entries(paquet.inventaire)) {
      if (id in etat.ING) etat.have[id] = !!v;
    }
    enregistrerInventaire();
  }
  if (paquet.choix && typeof paquet.choix === "object") {
    Object.assign(etat.choix, paquet.choix);
  }

  return compte;
}
