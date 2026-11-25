/* L’onglet « Idées » : elle choisit quelques ingrédients, on lui montre
   les recettes qui les utilisent, et l’IA peut en inventer d’autres.

   Rien à configurer de son côté : l’application appelle un petit relais
   (ia/worker.js, sur Cloudflare) qui, lui seul, connaît la clé Gemini.
   Tant que ADRESSE_IA est vide, la partie IA n’apparaît simplement pas. */

import { etat, fusionner } from "./donnees.js";
import { RECETTES, ecrire, nouvelId } from "./stockage.js";
import { manquants } from "./accords.js";
import { VERRES } from "./verres.js";
import { esc, carteRecette, chips } from "./vues.js";

/** L’adresse du relais, une fois déployé (voir ia/README dans le README). */
export const ADRESSE_IA = "https://ton-bar-ia.sedivyk.workers.dev";

const CLE = "ton-bar-idees-v1";
const MAX_SUGGESTIONS = 9;

export const idees = {
  selection: new Set(),
  suggestions: [],   // { id, recette, pour: [noms], gardee }
  attente: false,
  erreur: ""
};

let rafraichir = () => {};
export function brancherIdees(fn) { rafraichir = fn; }

export function adresseIA() {
  return (typeof window !== "undefined" && "TON_BAR_IA" in window) ? window.TON_BAR_IA : ADRESSE_IA;
}

/* ------------------------------------------------------- sur l’appareil */

export function chargerIdees() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE) || "{}") || {};
    idees.selection = new Set((o.selection || []).filter((id) => id in etat.ING));
    idees.suggestions = (o.suggestions || []).filter((s) =>
      s && s.id && s.recette && recetteValide(s.recette));
  } catch (e) { /* navigation privée : on repart de zéro */ }
}

function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify({
      selection: [...idees.selection],
      suggestions: idees.suggestions
    }));
  } catch (e) {}
}

export function basculer(id, coche) {
  if (!(id in etat.ING)) return;
  if (coche) idees.selection.add(id); else idees.selection.delete(id);
  sauver();
}

export function viderSelection() {
  idees.selection.clear();
  sauver();
}

/* ------------------------------------------------------- dans ses recettes */

/** Est-ce que cette recette peut utiliser cette bouteille ? */
function utilise(r, id) {
  const b = etat.ING[id];
  return r.ingredients.some((x) =>
    (x.ids || []).includes(id) || (b.type && (x.types || []).includes(b.type)));
}

/* Celles qui utilisent le plus d’ingrédients choisis d’abord, puis celles
   qu’elle peut faire tout de suite. */
export function recettesDeLaSelection() {
  const sel = [...idees.selection];
  if (!sel.length) return [];
  return etat.R
    .map((r) => ({ r, n: sel.filter((id) => utilise(r, id)).length, m: manquants(r) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.m.length - b.m.length || a.r.nom.localeCompare(b.r.nom, "fr"));
}

/* ------------------------------------------------------- les suggestions */

function recetteValide(r) {
  return r && r.nom && Array.isArray(r.ingredients) && r.ingredients.length &&
    r.ingredients.every((x) =>
      (x.ids || []).some((id) => id in etat.ING) ||
      (x.types || []).some((t) => t in etat.TYPES));
}

const normal = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const mots = (s) => normal(s).split(/[^a-z0-9]+/).filter((m) => m.length >= 3);

/* Le nom d’abord : l’IA colle parfois une référence connue sur autre chose
   (« Eau tonique » rangée sous « gin »). Une référence n’est crue que si son
   nom ressemble à celui donné ; sinon l’ingrédient part dans « Aussi : … ». */
function retrouver(ref, nom) {
  const n = normal(nom);
  const connu = etat.ING[ref] || etat.TYPES[ref];
  if (!n) return connu ? ref : null;
  const b = Object.values(etat.ING).find((x) => normal(x.nom) === n);
  if (b) return b.id;
  const t = Object.values(etat.TYPES).find((x) => normal(x.nom) === n);
  if (t) return t.id;
  if (!connu) return null;
  const c = normal(connu.nom);
  const communs = mots(nom).filter((m) => mots(connu.nom).includes(m) || c.includes(m));
  return c.includes(n) || n.includes(c) || communs.length ? ref : null;
}

/* Ce que l’IA renvoie devient une recette comme les autres. Une bouteille
   précise est élargie à son type, pour que toute bouteille du même genre
   fasse l’affaire, comme dans les recettes du dépôt. */
export function versRecette(s) {
  if (!s || !s.nom || !Array.isArray(s.ingredients)) return null;
  const ingredients = [];
  const autres = [];
  for (const x of s.ingredients) {
    if (!x) continue;
    const q = String(x.q || "").slice(0, 30);
    const fac = x.facultatif ? { facultatif: true } : {};
    const ref = retrouver(x.ref, x.nom);
    if (ref && ref in etat.ING) {
      const b = etat.ING[ref];
      ingredients.push(b.type && b.type in etat.TYPES
        ? { q, types: [b.type], ...fac } : { q, ids: [ref], ...fac });
    } else if (ref && ref in etat.TYPES) {
      ingredients.push({ q, types: [ref], ...fac });
    } else if (x.nom) {
      autres.push(`${q} ${x.nom}`.trim());
    }
  }
  if (!ingredients.length) return null;
  let note = String(s.note || "").trim();
  if (autres.length) note = (note ? note + " " : "") + "Aussi : " + autres.join(", ") + ".";
  return {
    nom: String(s.nom).trim().slice(0, 60),
    verre: VERRES.includes(s.verre) ? s.verre : "court",
    ingredients,
    methode: String(s.methode || "").trim().slice(0, 600) || "À toi de jouer.",
    note: note.slice(0, 300) || undefined,
    deco: (Array.isArray(s.deco) ? s.deco : []).map((t) => String(t).trim())
      .filter(Boolean).slice(0, 3).map((texte) => ({ texte: texte.slice(0, 120) }))
  };
}

/* Ce qu’on envoie : les noms des ingrédients choisis, ce qu’elle a, ce qui
   existe, et les recettes à ne pas réinventer. Rien d’autre. */
function demande() {
  const sel = [...idees.selection];
  return {
    selection: sel.map((id) => ({ ref: id, nom: etat.ING[id].nom })),
    connus: Object.values(etat.ING).map((b) => ({ ref: b.id, nom: b.nom, a: !!etat.have[b.id] }))
      .concat(Object.values(etat.TYPES).map((t) => ({ ref: t.id, nom: t.nom }))),
    eviter: etat.R.map((r) => r.nom)
  };
}

export async function inventer() {
  const adresse = adresseIA();
  if (!adresse || !idees.selection.size || idees.attente) return;
  idees.attente = true;
  idees.erreur = "";
  rafraichir();

  const pour = [...idees.selection].map((id) => etat.ING[id].nom);
  const stop = new AbortController();
  const minuterie = setTimeout(() => stop.abort(), 45000);
  try {
    const res = await fetch(adresse, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(demande()),
      signal: stop.signal
    });
    if (res.status === 429) throw new Error("Beaucoup d’idées pour aujourd’hui. Réessaie un peu plus tard.");
    if (!res.ok) throw new Error("Les idées n’ont pas pu être inventées. Réessaie dans un moment.");
    const data = await res.json();
    const nouvelles = (data.recettes || []).map(versRecette).filter(Boolean)
      .map((recette) => ({ id: nouvelId("ia"), recette, pour, gardee: false }));
    if (!nouvelles.length) throw new Error("Rien de bon cette fois. Réessaie, ou change ta sélection.");
    idees.suggestions = nouvelles.concat(idees.suggestions).slice(0, MAX_SUGGESTIONS);
  } catch (e) {
    idees.erreur = navigator.onLine === false
      ? "Il faut du réseau pour inventer des recettes."
      : e.name === "AbortError" || !e.message || e instanceof TypeError
        ? "Les idées n’ont pas pu être inventées. Réessaie dans un moment."
        : e.message;
  } finally {
    clearTimeout(minuterie);
    idees.attente = false;
    sauver();
    rafraichir();
  }
}

/** « Garder » : la suggestion devient une de ses recettes. */
export async function garder(id) {
  const s = idees.suggestions.find((x) => x.id === id);
  if (!s || s.gardee) return;
  const maintenant = new Date().toISOString();
  await ecrire(RECETTES, {
    ...s.recette, id: nouvelId("r"), ia: true, cree: maintenant, modifie: maintenant
  });
  s.gardee = true;
  sauver();
  await fusionner();
  rafraichir();
}

export function oublier(id) {
  idees.suggestions = idees.suggestions.filter((x) => x.id !== id);
  sauver();
  rafraichir();
}

/* ------------------------------------------------------- l’affichage */

function carteSuggestion(s) {
  const r = { ...s.recette, id: s.id, suggestion: true };
  return carteRecette(r, manquants(r), {
    suggestion: true,
    pour: s.pour,
    gardee: s.gardee
  });
}

function sectionIA() {
  if (!adresseIA()) return "";
  const n = idees.selection.size;
  const bouton = idees.attente
    ? `<button class="gros" id="inventer" disabled>Un instant, on invente…</button>`
    : `<button class="gros" id="inventer"${n ? "" : " disabled"}>Inventer 3 recettes avec ${n > 1 ? "ces ingrédients" : "cet ingrédient"}</button>`;
  const erreur = idees.erreur ? `<p class="erreur" role="alert">${esc(idees.erreur)}</p>` : "";
  const liste = idees.suggestions.length
    ? `<div class="list">${idees.suggestions.map(carteSuggestion).join("")}</div>`
    : "";
  return `<section class="cat idees-ia"><h2>De nouvelles idées</h2>
    <p class="hint">L’IA invente des recettes autour de ta sélection. Garde celles qui te plaisent : elles rejoignent tes recettes.</p>
    ${n ? bouton : ""}${erreur}${liste}</section>`;
}

function resultats() {
  if (!idees.selection.size) {
    return `<p class="empty">Choisis un ou plusieurs ingrédients ci-dessus.</p>${sectionIA()}`;
  }
  const liste = recettesDeLaSelection();
  const titre = liste.length
    ? `${liste.length} recette${liste.length > 1 ? "s" : ""} avec ta sélection`
    : "Aucune recette avec ta sélection";
  const cartes = liste.length
    ? `<p class="hint">Celles qui en utilisent le plus d’abord.</p><div class="list">${liste.map((x) => carteRecette(x.r, x.m)).join("")}</div>`
    : `<p class="hint">Aucune de tes recettes n’utilise tout ça ensemble.</p>`;
  return `<section class="cat"><h2>${titre}</h2>${cartes}</section>${sectionIA()}`;
}

export function rendreIdees(main) {
  const n = idees.selection.size;
  let html = `<p class="hint">Choisis quelques ingrédients : on te montre tes recettes qui les utilisent${adresseIA() ? ", et l’IA peut en inventer de nouvelles" : ""}.</p>`;
  for (const c of etat.CATS) {
    const ids = Object.keys(etat.ING).filter((id) => etat.ING[id].categorie === c);
    if (!ids.length) continue;
    html += `<section class="cat"><h2>${esc(c)}</h2><div class="chips">${chips(ids, {
      coche: (id) => idees.selection.has(id), attr: "data-sel", fiche: false
    })}</div></section>`;
  }
  if (n) {
    html += `<div class="barre-idees" id="barre-idees">
      <button class="gros" id="idees-voir">Voir les idées · ${n} choisi${n > 1 ? "s" : ""}</button>
      <button class="lien-btn" id="idees-vider">Tout décocher</button></div>`;
  }
  html += `<div id="idees-resultats">${resultats()}</div>`;
  main.innerHTML = html;
}
