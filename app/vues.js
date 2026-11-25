/* Le rendu des trois onglets. */

import { etat, nomType } from "./donnees.js";
import {
  bouteillesPour, manquants, bouteilleChoisie, etiquetteManquante,
  prefixeType, texteCherchable
} from "./accords.js";
import { glassSVG } from "./verres.js";
import { rendreIdees } from "./idees.js";

export const vue = { onglet: "ok", recherche: "", ambiance: "", note: "" };

export const CAT_DECO = "Garnitures et déco";

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export function estInstallee() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  } catch (e) { return false; }
}

/* ------------------------------------------------------------- les étoiles */

/** 4.5 -> « 4,5 », 4 -> « 4 » */
export const texteNote = (n) => String(n).replace(".", ",");

function remplissage(n, i) {
  return n >= i ? "f100" : n >= i - 0.5 ? "f50" : "";
}

/* Cinq étoiles, chacune coupée en deux : la moitié gauche donne la
   demi-étoile, la droite l’étoile entière. Retoucher sa note l’efface. */
function sectionNote(r) {
  const n = etat.notes[r.id] || 0;
  let etoiles = "";
  for (let i = 1; i <= 5; i++) {
    const demi = i - 0.5;
    etoiles += `<span class="etoile ${remplissage(n, i)}"><span class="plein"></span>`
      + `<button type="button" class="demi g" data-note-r="${esc(r.id)}" data-note="${demi}" aria-label="${texteNote(demi)} étoile${demi > 1 ? "s" : ""}" aria-pressed="${n === demi}"></button>`
      + `<button type="button" class="demi d" data-note-r="${esc(r.id)}" data-note="${i}" aria-label="${i} étoile${i > 1 ? "s" : ""}" aria-pressed="${n === i}"></button></span>`;
  }
  const valeur = n
    ? `<span class="note-val">${texteNote(n)}/5</span>
       <button type="button" class="lien-btn" data-note-r="${esc(r.id)}" data-note="0">Effacer</button>`
    : `<span class="note-val vide">Pas encore notée</span>`;
  return `<section class="ma-note"><h3>Ma note</h3>
    <div class="note-ligne"><span class="etoiles" role="group" aria-label="Ma note pour ${esc(r.nom)}">${etoiles}</span>${valeur}</div></section>`;
}

/* Ses notes écrites : ce qu’elle a changé, ce qu’on en a pensé. */
function sectionCommentaire(r) {
  const t = etat.commentaires[r.id];
  return `<section class="mes-notes"><h3>Mes notes</h3>
    ${t ? `<p class="commentaire">${esc(t)}</p>` : ""}
    <button type="button" class="${t ? "lien-btn" : "gros doux"}" data-commenter="${esc(r.id)}">${t ? "Modifier mes notes" : "Écrire une note"}</button></section>`;
}

/* ------------------------------------------------------------- une recette */

function photoDe(r) {
  if (r.perso) return r.photo ? etat.photoURL[r.photo] || null : null;
  return etat.CREDITS[r.id] ? "img/" + r.id + ".jpg" : null;
}

const sansAccent = (s) => String(s).toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").trim();

/* « Tequila blanche : Patrón Silver » est utile ; « Limes : Limes » ne l’est
   pas. On annonce le type seulement quand il apprend quelque chose, et on
   prend celui auquel la bouteille choisie appartient vraiment. */
function prefixeUtile(x, choisie) {
  const types = x.types || [];
  if (!types.length) return "";
  const bouteille = etat.ING[choisie];
  const sien = bouteille && types.includes(bouteille.type) ? bouteille.type : null;
  const prefixe = sien ? nomType(sien) : prefixeType(x);
  if (!prefixe || !bouteille) return "";
  const a = sansAccent(prefixe);
  const b = sansAccent(bouteille.nom);
  if (a === b || b.startsWith(a) || a.startsWith(b)) return "";
  return prefixe;
}

function ligneIngredient(r, x, k) {
  const options = bouteillesPour(x);
  const choisie = bouteilleChoisie(r, k, x);
  let corps;

  if (choisie) {
    const prefixe = prefixeUtile(x, choisie);
    const nom = `<b>${esc(etat.ING[choisie].nom)}</b>`;
    corps = prefixe ? `<span class="tq">${esc(prefixe)} :</span> ${nom}` : nom;
    if (options.length > 1) {
      corps += `<select class="pick" data-r="${esc(r.id)}" data-k="${k}" aria-label="Choisir la bouteille">`
        + options.map((id) =>
          `<option value="${esc(id)}"${id === choisie ? " selected" : ""}>${esc(etat.ING[id].nom)}</option>`
        ).join("") + `</select>`;
    }
  } else {
    const tag = x.facultatif ? "" : ' — à acheter';
    corps = `<span class="no">${esc(etiquetteManquante(x))}${tag}</span>`;
  }
  if (x.facultatif) corps += ' <span class="opt">(facultatif)</span>';
  return `<li><span class="q">${esc(x.q)}</span><span class="in">${corps}</span></li>`;
}

function resume(r, manque) {
  if (manque.length) {
    return `<div class="rs missing">Il manque : ${esc(manque.map(etiquetteManquante).join(", "))}</div>`;
  }
  const deux = r.ingredients.filter((x) => !x.facultatif).slice(0, 2).map((x, i) => {
    const k = r.ingredients.indexOf(x);
    const c = bouteilleChoisie(r, k, x);
    return c ? etat.ING[c].nom : etiquetteManquante(x);
  });
  return `<div class="rs">${esc(deux.join(", "))}</div>`;
}

export function carteRecette(r, manque, opts = {}) {
  const src = photoDe(r);
  const verre = glassSVG(r.verre);

  const thumb = src
    ? `<span class="thumb"><img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="54" height="54" data-verre="${esc(r.verre)}"></span>`
    : `<span class="thumb" aria-hidden="true">${verre}</span>`;

  let photo;
  if (src) {
    const c = !r.perso && etat.CREDITS[r.id];
    const qui = c ? [c.photographe, c.source].filter(Boolean).join(" · ") : "";
    const credit = qui
      ? `<p class="credit">Photo : ${c.lien
        ? `<a href="${esc(c.lien)}" target="_blank" rel="noopener noreferrer">${esc(qui)}</a>`
        : esc(qui)}</p>`
      : "";
    photo = `<div class="photo"><img src="${esc(src)}" alt="${esc(r.nom)}" loading="lazy" decoding="async" data-verre="${esc(r.verre)}"></div>${credit}`;
  } else {
    photo = `<div class="photo noimg">${verre}</div>`;
  }

  const ings = r.ingredients.map((x, k) => ligneIngredient(r, x, k)).join("");
  const deco = sectionDeco(r);
  const n = etat.notes[r.id];
  const badge = (n ? ` <span class="note-mini" aria-label="Ma note : ${texteNote(n)} sur 5">★ ${texteNote(n)}</span>` : "")
    + (etat.commentaires[r.id] && !opts.suggestion ? ' <span class="com-mini" aria-label="J’ai écrit des notes">✎</span>' : "")
    + (opts.suggestion ? ' <b class="mine">idée IA</b>' : "")
    + (r.perso ? ` <b class="mine">${r.ia ? "ma recette · IA" : "ma recette"}</b>` : "")
    + (r.sansAlcool ? ' <b class="mine doux">sans alcool</b>' : "");
  const lien = r.lien
    ? `<p class="lien"><a href="${esc(r.lien)}" target="_blank" rel="noopener noreferrer">Voir la page d’origine</a></p>`
    : "";
  const pour = opts.pour && opts.pour.length
    ? `<p class="pour">Inventée pour : ${esc(opts.pour.join(", "))}</p>` : "";
  const actions = opts.suggestion
    ? (opts.gardee
      ? `<div class="actions"><span class="gardee">✓ Gardée dans tes recettes</span>
         <button class="lien-btn" data-oublier-idee="${esc(r.id)}">Retirer de la liste</button></div>`
      : `<div class="actions"><button class="gros" data-garder="${esc(r.id)}">Garder dans mes recettes</button>
         <button class="lien-btn" data-oublier-idee="${esc(r.id)}">Non merci</button></div>`)
    : r.perso
    ? `<div class="actions"><button class="lien-btn" data-modifier-recette="${esc(r.id)}">Modifier</button>
       <button class="lien-btn danger" data-supprimer-recette="${esc(r.id)}">Supprimer</button></div>`
    : "";

  return `<details class="r${r.signature ? " sig" : ""}${r.perso ? " perso" : ""}${opts.suggestion ? " ia" : ""}" data-id="${esc(r.id)}">
    <summary>${thumb}<div class="st"><div class="rt">${esc(r.nom)}${badge}</div>${resume(r, manque)}</div><span class="chev" aria-hidden="true"></span></summary>
    <div class="body">${photo}<ul class="ing">${ings}</ul>
      <p class="method">${esc(r.methode)}</p>
      ${opts.suggestion ? "" : sectionNote(r) + sectionCommentaire(r)}${deco}${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}${pour}${lien}${actions}</div>
  </details>`;
}

/* Les idées déco ne bloquent jamais une recette : celles qu’elle peut faire
   tout de suite sont mises en avant, les autres restent là, sans être
   présentées comme manquantes. */
function sectionDeco(r) {
  if (!Array.isArray(r.deco) || !r.deco.length) return "";
  const items = r.deco.map((idee) => {
    const ids = (idee.ids || []).filter((id) => id in etat.ING);
    const aTout = ids.length > 0 && ids.every((id) => etat.have[id]);
    return `<li class="${aTout ? "a-toi" : ""}">${aTout ? '<span class="coche" aria-hidden="true">✓</span>' : ""}${esc(idee.texte)}</li>`;
  }).join("");
  return `<section class="deco"><h3>Idées déco</h3><ul>${items}</ul></section>`;
}

/* ------------------------------------------------------------- les onglets */

export function compter() {
  let ok = 0, presque = 0;
  for (const r of etat.R) {
    const m = manquants(r).length;
    if (m === 0) ok++; else if (m === 1) presque++;
  }
  document.getElementById("n-ok").textContent = ok;
  document.getElementById("n-near").textContent = presque;
  return { ok, presque };
}

export function ambianceCourante() {
  return etat.AMBIANCES.find((a) => a.id === vue.ambiance) || null;
}

/* Le filtre par étoiles : « 4 et + » garde 4, 4,5 et 5. */
export const FILTRES_NOTE = [
  { id: "", nom: "Toutes les notes" },
  { id: "5", nom: "★ 5" },
  { id: "4.5", nom: "★ 4,5 et +" },
  { id: "4", nom: "★ 4 et +" },
  { id: "3", nom: "★ 3 et +" },
  { id: "aucune", nom: "Pas notées" }
];

function passeLaNote(r) {
  if (!vue.note) return true;
  const n = etat.notes[r.id] || 0;
  if (vue.note === "aucune") return !n;
  return n >= Number(vue.note);
}

function listeRecettes() {
  const q = vue.recherche.trim().toLowerCase();
  const amb = ambianceCourante();
  const retenues = amb ? new Set(amb.recettes) : null;
  const liste = etat.R
    .map((r) => ({ r, m: manquants(r) }))
    .filter((x) => (vue.onglet === "ok" ? x.m.length === 0 : x.m.length === 1))
    .filter((x) => !retenues || retenues.has(x.r.id))
    .filter((x) => passeLaNote(x.r))
    .filter((x) => !q || texteCherchable(x.r).includes(q));
  // filtrées par étoiles : les mieux notées d’abord
  if (vue.note && vue.note !== "aucune") {
    liste.sort((a, b) => (etat.notes[b.r.id] || 0) - (etat.notes[a.r.id] || 0));
  }
  return liste;
}

/* Un ruban d’occasions au-dessus de la liste : Noël, la piscine,
   l’Halloween, les ados. Il filtre l’onglet courant. */
function rubanAmbiances() {
  if (!etat.AMBIANCES.length) return "";
  const choix = [{ id: "", nom: "Tout" }].concat(etat.AMBIANCES);
  const boutons = choix.map((a) =>
    `<button class="amb${a.id === vue.ambiance ? " on" : ""}" data-amb="${esc(a.id)}"
      aria-pressed="${a.id === vue.ambiance}">${esc(a.nom)}</button>`).join("");
  return `<div class="ambiances" role="group" aria-label="Occasions">${boutons}</div>`;
}

/* Le filtre par étoiles n’apparaît qu’une fois une recette notée. */
function rubanNotes() {
  if (!Object.keys(etat.notes).length && !vue.note) return "";
  const boutons = FILTRES_NOTE.map((f) =>
    `<button class="amb filtre-note${f.id === vue.note ? " on" : ""}" data-filtre-note="${esc(f.id)}"
      aria-pressed="${f.id === vue.note}">${esc(f.nom)}</button>`).join("");
  return `<div class="ambiances notes" role="group" aria-label="Filtrer par note">${boutons}</div>`;
}

function rendreListe(main) {
  const liste = listeRecettes();
  const q = vue.recherche.trim();
  const amb = ambianceCourante();
  const aide = amb
    ? esc(amb.description)
    : (vue.onglet === "ok"
      ? "Tout ce que tu peux préparer avec ce que tu as. Touche un cocktail pour la recette."
      : "Il ne manque qu’un ingrédient. Une petite course, et c’est prêt.");
  let vide;
  if (q) vide = "Aucun cocktail ne correspond. Essaie le nom d’une bouteille ou d’un type.";
  else if (vue.note) {
    vide = vue.note === "aucune"
      ? "Tout ce qui est ici a déjà sa note."
      : "Aucun cocktail avec cette note ici. Ouvre une recette pour lui donner des étoiles.";
  } else if (amb) {
    vide = vue.onglet === "ok"
      ? `Rien de cette sélection pour l’instant. Regarde dans « Presque ».`
      : `Rien à une bouteille près ici. Regarde dans « Je peux faire ».`;
  } else vide = "Rien ici pour l’instant. Ajoute des bouteilles dans Mon bar.";

  main.innerHTML = `<input class="search" type="search" id="q" placeholder="Chercher un cocktail" value="${esc(vue.recherche)}" aria-label="Chercher">
    ${rubanAmbiances()}
    ${rubanNotes()}
    <p class="hint">${aide}</p>
    <div class="list">${liste.length
      ? liste.map((x) => carteRecette(x.r, x.m)).join("")
      : `<p class="empty">${vide}</p>`}</div>`;
}

export function chips(ids, { coche = (id) => etat.have[id], attr = "data-id", fiche = true } = {}) {
  return ids.map((id) => {
    const b = etat.ING[id];
    const perso = fiche && b.perso
      ? `<button class="fiche" data-fiche="${esc(id)}" aria-label="Options pour ${esc(b.nom)}">⋯</button>`
      : "";
    return `<span class="chip-rang"><label class="chip"><input type="checkbox" ${attr}="${esc(id)}"${coche(id) ? " checked" : ""}>
      <span>${esc(b.nom)}${b.boite ? ' <b class="box">boîte</b>' : ""}${b.perso ? ' <b class="box">à moi</b>' : ""}</span></label>${perso}</span>`;
  }).join("");
}

function rendreBar(main) {
  let html = "";
  if (!estInstallee()) {
    html += `<section class="install"><h2>Garde-le sur ton écran d’accueil</h2>
      <p>Sur iPhone : touche <b>Partager</b> (le carré avec la flèche, en bas de Safari), puis <b>Sur l’écran d’accueil</b>. Ton bar s’ouvre alors comme une application, même sans réseau.</p></section>`;
  }

  // en haut de Mon bar, pour qu’elle le trouve sans chercher
  const taille = document.documentElement.dataset.taille || "normal";
  html += `<section class="reglage-taille"><h2 class="sous">Taille du texte</h2>
    <div class="tailles" role="group" aria-label="Taille du texte">${[
      ["normal", "Grand"], ["plus", "Plus grand"], ["max", "Très grand"]
    ].map(([id, nom]) => `<button class="amb${id === taille ? " on" : ""}" data-taille="${id}" aria-pressed="${id === taille}">${nom}</button>`).join("")}</div>
  </section>`;

  html += `<div class="gros-boutons">
    <button class="gros" id="ajouter-bouteille">Ajouter une bouteille</button>
    <button class="gros" id="ajouter-recette">Ajouter une recette</button>
  </div>`;

  const miennes = etat.R.filter((r) => r.perso).length;
  if (miennes) {
    html += `<p class="hint">Tu as ${miennes} recette${miennes > 1 ? "s" : ""} à toi. Elles apparaissent avec les autres.</p>`;
  }
  html += `<p class="hint">Touche une bouteille pour l’ajouter ou la retirer.</p>`;

  for (const c of etat.CATS) {
    const ids = Object.keys(etat.ING).filter((id) => etat.ING[id].categorie === c);
    if (!ids.length) continue;
    const astuces = c === CAT_DECO
      ? `<p class="hint">La déco n’empêche jamais un cocktail d’apparaître : elle change seulement les idées mises en avant.</p>
         <button class="gros doux" id="astuces-deco">Astuces déco</button>`
      : "";
    html += `<section class="cat"><h2>${esc(c)}</h2><div class="chips">${chips(ids)}</div>${astuces}</section>`;
  }

  html += `<section class="cat"><h2>Garder une copie</h2>
    <p class="hint">Tes bouteilles, tes recettes et tes photos ne sont que sur ce téléphone. Garde-les dans un fichier si tu changes d’appareil ou si tu vides ton navigateur.</p>
    <div class="gros-boutons">
      <button class="gros doux" id="exporter">Exporter mon bar</button>
      <button class="gros doux" id="importer">Importer mon bar</button>
    </div>
    <input type="file" id="fichier-import" accept="application/json,.json" hidden>
  </section>`;

  html += `<button class="reset" id="reset">Revenir à la liste de départ</button>`;
  main.innerHTML = html;
}

export function rendre() {
  compter();
  document.querySelectorAll(".tab").forEach((t) =>
    t.setAttribute("aria-selected", t.dataset.view === vue.onglet ? "true" : "false"));
  const main = document.getElementById("main");
  if (vue.onglet === "bar") rendreBar(main);
  else if (vue.onglet === "idees") rendreIdees(main);
  else rendreListe(main);
  protegerImages(main);
  main.querySelectorAll(".ambiances").forEach(centrerAmbiance);
}

/* Le ruban défile : on amène l’occasion choisie sous les yeux,
   sans bouger la page verticalement. */
function centrerAmbiance(ruban) {
  const actif = ruban.querySelector(".amb.on");
  if (!actif) return;
  ruban.scrollLeft = Math.max(0,
    actif.offsetLeft - (ruban.clientWidth - actif.offsetWidth) / 2);
}

/* Une photo absente ou illisible devient le verre dessiné :
   on ne montre jamais d’image brisée. */
function remplacerParVerre(img) {
  const boite = img.parentElement;
  if (!boite) return;
  const credit = boite.nextElementSibling;
  boite.innerHTML = glassSVG(img.dataset.verre);
  if (boite.classList.contains("photo")) boite.classList.add("noimg");
  else boite.setAttribute("aria-hidden", "true");
  if (credit && credit.classList.contains("credit")) credit.remove();
}

export function protegerImages(racine) {
  racine.querySelectorAll("img[data-verre]").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) { remplacerParVerre(img); return; }
    img.addEventListener("error", () => remplacerParVerre(img), { once: true });
  });
}
