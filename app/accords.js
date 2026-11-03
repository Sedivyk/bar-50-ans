/* Est-ce qu’une recette est faisable avec ce qu’elle a ?

   Un ingrédient peut viser un type (« n’importe quelle tequila blanche »)
   ou une bouteille précise quand c’est elle qui fait le cocktail
   (le St-Germain dans « Le 50 »). Une bouteille ajoutée plus tard est
   donc reconnue tout de suite, pourvu qu’elle ait le bon type. */

import { etat, nomType } from "./donnees.js";

/** Les bouteilles de son bar qui conviennent à cet ingrédient. */
export function bouteillesPour(x) {
  const vues = new Set();
  const out = [];
  for (const id of x.ids || []) {
    if (etat.have[id] && !vues.has(id)) { vues.add(id); out.push(id); }
  }
  for (const t of x.types || []) {
    for (const id of etat.parType[t] || []) {
      if (etat.have[id] && !vues.has(id)) { vues.add(id); out.push(id); }
    }
  }
  return out;
}

export function possede(x) {
  if ((x.ids || []).some((id) => etat.have[id])) return true;
  return (x.types || []).some((t) => (etat.parType[t] || []).some((id) => etat.have[id]));
}

/** Les ingrédients non facultatifs qui manquent. */
export function manquants(r) {
  return r.ingredients.filter((x) => !x.facultatif && !possede(x));
}

/** La bouteille qui sera utilisée : son choix s’il tient encore, sinon la première. */
export function bouteilleChoisie(r, k, x) {
  const options = bouteillesPour(x);
  if (!options.length) return null;
  const pref = etat.choix[r.id + ":" + k];
  return pref && options.includes(pref) ? pref : options[0];
}

/** Ce qu’on écrit à droite de la quantité. */
export function etiquette(x, r, k) {
  if (r) {
    const choisie = bouteilleChoisie(r, k, x);
    if (choisie) return etat.ING[choisie].nom;
  } else {
    const options = bouteillesPour(x);
    if (options.length) return etat.ING[options[0]].nom;
  }
  return etiquetteManquante(x);
}

/** Quand elle ne l’a pas : on nomme le type, pas une marque en particulier. */
export function etiquetteManquante(x) {
  const noms = [];
  for (const t of x.types || []) noms.push(nomType(t));
  for (const id of x.ids || []) if (etat.ING[id]) noms.push(etat.ING[id].nom);
  return noms.join(" ou ") || "?";
}

/** Le nom du type visé, pour « Tequila blanche : ta Patrón ». */
export function prefixeType(x) {
  const types = x.types || [];
  if (types.length === 1) return nomType(types[0]);
  if (types.length > 1) return types.map(nomType).join(" ou ");
  return "";
}

/** Tout ce sur quoi la recherche doit mordre. */
export function texteCherchable(r) {
  const bouts = [r.nom];
  for (const x of r.ingredients) {
    for (const t of x.types || []) bouts.push(nomType(t));
    for (const id of x.ids || []) if (etat.ING[id]) bouts.push(etat.ING[id].nom);
    // ses bouteilles doivent aussi faire trouver la recette
    for (const id of bouteillesPour(x)) bouts.push(etat.ING[id].nom);
  }
  if (r.note) bouts.push(r.note);
  return bouts.join(" ").toLowerCase();
}

/** Les recettes qui peuvent utiliser une bouteille donnée. */
export function recettesPour(bouteilleId) {
  const b = etat.ING[bouteilleId];
  if (!b) return [];
  return etat.R.filter((r) => r.ingredients.some((x) =>
    (x.ids || []).includes(bouteilleId) || (x.types || []).includes(b.type)));
}
