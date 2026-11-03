/* Tout ce qu’elle ajoute reste sur son appareil.
   - l’inventaire coché : localStorage, clé « ton-bar-50-v1 » (inchangée)
   - ses bouteilles, ses recettes et ses photos : IndexedDB
   Rien n’est envoyé nulle part. */

export const CLE_INVENTAIRE = "ton-bar-50-v1";
export const CLE_CHOIX = "ton-bar-choix-v1";

const NOM_BASE = "ton-bar";
const VERSION_BASE = 1;
export const BOUTEILLES = "bouteilles";
export const RECETTES = "recettes";
export const PHOTOS = "photos";

let basePromise = null;

export function base() {
  if (basePromise) return basePromise;
  basePromise = new Promise((ok, non) => {
    if (!("indexedDB" in window)) { non(new Error("IndexedDB indisponible")); return; }
    const req = indexedDB.open(NOM_BASE, VERSION_BASE);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const nom of [BOUTEILLES, RECETTES, PHOTOS]) {
        if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: "id" });
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => non(req.error);
  });
  return basePromise;
}

function transaction(nom, mode) {
  return base().then((db) => db.transaction(nom, mode).objectStore(nom));
}

function attendre(req) {
  return new Promise((ok, non) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => non(req.error);
  });
}

export async function tout(nom) {
  try { return await attendre((await transaction(nom, "readonly")).getAll()) || []; }
  catch (e) { return []; }
}

export async function lire(nom, id) {
  try { return await attendre((await transaction(nom, "readonly")).get(id)); }
  catch (e) { return undefined; }
}

export async function ecrire(nom, objet) {
  await attendre((await transaction(nom, "readwrite")).put(objet));
  return objet;
}

export async function effacer(nom, id) {
  await attendre((await transaction(nom, "readwrite")).delete(id));
}

export async function vider(nom) {
  await attendre((await transaction(nom, "readwrite")).clear());
}

/** Identifiant court, unique, et qui ne ressemble pas à ceux du dépôt. */
export function nouvelId(prefixe) {
  return prefixe + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

// ------------------------------------------------------------- localStorage

export function lireInventaire(defauts, connus) {
  const have = { ...defauts };
  try {
    const s = localStorage.getItem(CLE_INVENTAIRE);
    if (s) {
      const o = JSON.parse(s);
      for (const id in o) if (connus.has(id)) have[id] = !!o[id];
    }
  } catch (e) { /* navigation privée, ou stockage plein */ }
  return have;
}

export function ecrireInventaire(have) {
  try { localStorage.setItem(CLE_INVENTAIRE, JSON.stringify(have)); } catch (e) {}
}

export function lireChoix() {
  try { return JSON.parse(localStorage.getItem(CLE_CHOIX) || "{}") || {}; }
  catch (e) { return {}; }
}

export function ecrireChoix(choix) {
  try { localStorage.setItem(CLE_CHOIX, JSON.stringify(choix)); } catch (e) {}
}
