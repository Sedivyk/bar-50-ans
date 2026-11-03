/* Le rendu des trois onglets. */

import { etat, nomType } from "./donnees.js";
import {
  bouteillesPour, manquants, bouteilleChoisie, etiquetteManquante,
  prefixeType, texteCherchable
} from "./accords.js";
import { glassSVG } from "./verres.js";

export const vue = { onglet: "ok", recherche: "", ambiance: "" };

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

export function carteRecette(r, manque) {
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
  const badge = (r.perso ? ' <b class="mine">ma recette</b>' : "")
    + (r.sansAlcool ? ' <b class="mine doux">sans alcool</b>' : "");
  const lien = r.lien
    ? `<p class="lien"><a href="${esc(r.lien)}" target="_blank" rel="noopener noreferrer">Voir la page d’origine</a></p>`
    : "";
  const actions = r.perso
    ? `<div class="actions"><button class="lien-btn" data-modifier-recette="${esc(r.id)}">Modifier</button>
       <button class="lien-btn danger" data-supprimer-recette="${esc(r.id)}">Supprimer</button></div>`
    : "";

  return `<details class="r${r.signature ? " sig" : ""}${r.perso ? " perso" : ""}" data-id="${esc(r.id)}">
    <summary>${thumb}<div class="st"><div class="rt">${esc(r.nom)}${badge}</div>${resume(r, manque)}</div><span class="chev" aria-hidden="true"></span></summary>
    <div class="body">${photo}<ul class="ing">${ings}</ul>
      <p class="method">${esc(r.methode)}</p>
      ${deco}${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}${lien}${actions}</div>
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

function listeRecettes() {
  const q = vue.recherche.trim().toLowerCase();
  const amb = ambianceCourante();
  const retenues = amb ? new Set(amb.recettes) : null;
  return etat.R
    .map((r) => ({ r, m: manquants(r) }))
    .filter((x) => (vue.onglet === "ok" ? x.m.length === 0 : x.m.length === 1))
    .filter((x) => !retenues || retenues.has(x.r.id))
    .filter((x) => !q || texteCherchable(x.r).includes(q));
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
  else if (amb) {
    vide = vue.onglet === "ok"
      ? `Rien de cette sélection pour l’instant. Regarde dans « Presque ».`
      : `Rien à une bouteille près ici. Regarde dans « Je peux faire ».`;
  } else vide = "Rien ici pour l’instant. Ajoute des bouteilles dans Mon bar.";

  main.innerHTML = `<input class="search" type="search" id="q" placeholder="Chercher un cocktail, une bouteille ou un type" value="${esc(vue.recherche)}" aria-label="Chercher">
    ${rubanAmbiances()}
    <p class="hint">${aide}</p>
    <div class="list">${liste.length
      ? liste.map((x) => carteRecette(x.r, x.m)).join("")
      : `<p class="empty">${vide}</p>`}</div>`;
}

function chips(ids) {
  return ids.map((id) => {
    const b = etat.ING[id];
    const perso = b.perso
      ? `<button class="fiche" data-fiche="${esc(id)}" aria-label="Options pour ${esc(b.nom)}">⋯</button>`
      : "";
    return `<span class="chip-rang"><label class="chip"><input type="checkbox" data-id="${esc(id)}"${etat.have[id] ? " checked" : ""}>
      <span>${esc(b.nom)}${b.boite ? ' <b class="box">boîte</b>' : ""}${b.perso ? ' <b class="box">à moi</b>' : ""}</span></label>${perso}</span>`;
  }).join("");
}

function rendreBar(main) {
  let html = "";
  if (!estInstallee()) {
    html += `<section class="install"><h2>Garde-le sur ton écran d’accueil</h2>
      <p>Sur iPhone : touche <b>Partager</b> (le carré avec la flèche, en bas de Safari), puis <b>Sur l’écran d’accueil</b>. Ton bar s’ouvre alors comme une application, même sans réseau.</p></section>`;
  }

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
  else rendreListe(main);
  protegerImages(main);
  centrerAmbiance(main);
}

/* Le ruban défile : on amène l’occasion choisie sous les yeux,
   sans bouger la page verticalement. */
function centrerAmbiance(racine) {
  const ruban = racine.querySelector(".ambiances");
  if (!ruban) return;
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
