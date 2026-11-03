/* Les photos qu’elle prend ou choisit sont réduites dans le navigateur
   avant d’être gardées : 800 px de large, JPEG, pour ne pas remplir
   son téléphone. Elles ne quittent jamais l’appareil. */

import { PHOTOS, ecrire, effacer, lire, nouvelId } from "./stockage.js";

export const LARGEUR_MAX = 800;
const QUALITE = 0.75;

const liens = new Map();   // id de photo -> URL d’objet, pour ne pas en créer deux fois

function charger(file) {
  return new Promise((ok, non) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); non(new Error("image illisible")); };
    img.src = url;
  });
}

/** Réduit un fichier image à 800 px de large, en JPEG. */
export async function reduire(file) {
  const img = await charger(file);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("image vide");

  const echelle = Math.min(1, LARGEUR_MAX / w);
  const cw = Math.max(1, Math.round(w * echelle));
  const ch = Math.max(1, Math.round(h * echelle));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cw, ch);

  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", QUALITE));
  if (!blob) throw new Error("conversion impossible");
  return blob;
}

/** Réduit puis enregistre ; renvoie l’identifiant de la photo. */
export async function enregistrer(file) {
  const blob = await reduire(file);
  const id = nouvelId("p");
  await ecrire(PHOTOS, { id, blob, cree: new Date().toISOString() });
  return id;
}

export async function supprimer(id) {
  if (!id) return;
  oublier(id);
  await effacer(PHOTOS, id);
}

/** URL affichable pour une photo enregistrée, ou null. */
export async function lienVers(id) {
  if (!id) return null;
  if (liens.has(id)) return liens.get(id);
  const row = await lire(PHOTOS, id);
  if (!row || !row.blob) return null;
  const url = URL.createObjectURL(row.blob);
  liens.set(id, url);
  return url;
}

export function oublier(id) {
  const url = liens.get(id);
  if (url) { URL.revokeObjectURL(url); liens.delete(id); }
}

export function oublierTout() {
  for (const url of liens.values()) URL.revokeObjectURL(url);
  liens.clear();
}

// ------------------------------------------------- pour l’export / l’import

export function versTexte(blob) {
  return new Promise((ok, non) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = () => non(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function depuisTexte(dataURL) {
  const res = await fetch(dataURL);
  return res.blob();
}
