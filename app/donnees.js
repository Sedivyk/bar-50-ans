/* Charge les données du dépôt, y fond ce qu’elle a ajouté sur son appareil,
   et tient les index à jour. Les données de base ne sont jamais modifiées :
   ses ajouts vivent à côté, et sont fusionnés à l’affichage. */

import {
  BOUTEILLES, RECETTES, tout, lireInventaire, ecrireInventaire,
  lireChoix, ecrireChoix
} from "./stockage.js";
import { lienVers, oublier } from "./photos.js";

export const etat = {
  ING: {},         // id -> bouteille (du dépôt et les siennes)
  CATS: [],        // ordre d’affichage des catégories
  TYPES: {},       // id -> {id, nom, famille, exemples}
  FAMILLES: [],
  R: [],           // recettes (du dépôt et les siennes)
  AMBIANCES: [],   // regroupements par occasion
  CREDITS: {},
  parType: {},     // type -> [ids de bouteilles]
  have: {},        // id -> cochée
  choix: {},       // « recette:index » -> id de bouteille préférée
  photoURL: {}     // id de photo -> URL d’objet, pour un rendu synchrone
};

async function json(url, defaut) {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(url + " : " + res.status);
    return await res.json();
  } catch (e) {
    if (defaut !== undefined) return defaut;
    throw e;
  }
}

export async function charger() {
  const [ing, rec, typ, cred, amb] = await Promise.all([
    json("data/ingredients.json"),
    json("data/recettes.json"),
    json("data/types.json", { familles: [], types: [] }),
    json("data/credits.json", {}),
    json("data/ambiances.json", [])
  ]);

  etat.CATS = ing.categories.slice();
  etat.FAMILLES = (typ.familles || []).slice();
  etat.TYPES = {};
  for (const t of typ.types || []) etat.TYPES[t.id] = t;

  etat.ING = {};
  for (const b of ing.ingredients) etat.ING[b.id] = b;

  etat.CREDITS = cred && typeof cred === "object" ? cred : {};
  etat.AMBIANCES = Array.isArray(amb) ? amb : [];
  etat.R = rec.slice();

  await fusionner();
}

/** Ajoute ses bouteilles et ses recettes à celles du dépôt. */
export async function fusionner() {
  const [siennes, recettes] = await Promise.all([tout(BOUTEILLES), tout(RECETTES)]);

  // on repart des bouteilles du dépôt, puis on ajoute les siennes
  for (const id of Object.keys(etat.ING)) if (etat.ING[id].perso) delete etat.ING[id];
  for (const b of siennes) {
    etat.ING[b.id] = { ...b, perso: true };
    if (b.categorie && !etat.CATS.includes(b.categorie)) etat.CATS.push(b.categorie);
  }

  etat.R = etat.R.filter((r) => !r.perso).concat(
    recettes.map((r) => ({ ...r, perso: true }))
  );

  // ses photos sont dans IndexedDB : on prépare les URL avant d’afficher,
  // pour que le rendu reste synchrone
  const voulues = new Set(recettes.map((r) => r.photo).filter(Boolean));
  for (const id of Object.keys(etat.photoURL)) {
    if (!voulues.has(id)) { oublier(id); delete etat.photoURL[id]; }
  }
  await Promise.all([...voulues].map(async (id) => {
    if (!etat.photoURL[id]) {
      const url = await lienVers(id);
      if (url) etat.photoURL[id] = url;
    }
  }));

  indexer();
}

export function indexer() {
  etat.parType = {};
  for (const id in etat.ING) {
    const t = etat.ING[id].type;
    if (!t) continue;
    (etat.parType[t] ||= []).push(id);
  }
  // une recette qui pointerait vers une bouteille disparue est écartée
  etat.R = etat.R.filter((r) =>
    Array.isArray(r.ingredients) && r.ingredients.length &&
    r.ingredients.every((x) =>
      (x.ids || []).some((id) => id in etat.ING) ||
      (x.types || []).some((t) => t in etat.TYPES)));
}

export function defauts() {
  const h = {};
  for (const id in etat.ING) h[id] = !!etat.ING[id].defaut;
  return h;
}

export function chargerInventaire() {
  etat.have = lireInventaire(defauts(), new Set(Object.keys(etat.ING)));
  etat.choix = lireChoix();
}

export function enregistrerInventaire() { ecrireInventaire(etat.have); }
export function enregistrerChoix() { ecrireChoix(etat.choix); }

export function nomType(id) {
  return (etat.TYPES[id] && etat.TYPES[id].nom) || id;
}

/** Les types groupés par famille, pour la liste de choix. */
export function typesParFamille() {
  const groupes = [];
  for (const f of etat.FAMILLES) {
    const liste = Object.values(etat.TYPES).filter((t) => t.famille === f);
    if (liste.length) groupes.push([f, liste]);
  }
  const orphelins = Object.values(etat.TYPES).filter((t) => !etat.FAMILLES.includes(t.famille));
  if (orphelins.length) groupes.push(["Autre", orphelins]);
  return groupes;
}
