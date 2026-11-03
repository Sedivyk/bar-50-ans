/* Les fenêtres : ajouter une bouteille, ajouter ou modifier une recette,
   et la fiche d’une bouteille ajoutée. */

import { etat, fusionner, typesParFamille, nomType, enregistrerInventaire } from "./donnees.js";
import { BOUTEILLES, RECETTES, ecrire, effacer, nouvelId } from "./stockage.js";
import { enregistrer as enregistrerPhoto, supprimer as supprimerPhoto } from "./photos.js";
import { recettesPour } from "./accords.js";
import { VERRES, VERRE_ETIQUETTE } from "./verres.js";
import { esc } from "./vues.js";

let rafraichir = () => {};
export function brancher(fn) { rafraichir = fn; }

const dlg = () => document.getElementById("dlg");

function ouvrir(titre, corps, apres) {
  const d = dlg();
  /* Aucun bouton n’est de type « submit » et le formulaire ne valide rien
     lui-même : sinon Entrée fermerait la fenêtre sans rien enregistrer
     (l’envoi implicite choisit le premier bouton, c’est-à-dire la croix),
     et une vérification du navigateur bloquerait même « Annuler ». */
  d.innerHTML = `<form class="feuille" novalidate>
      <header><h2>${esc(titre)}</h2><button type="button" class="fermer" data-annuler aria-label="Fermer">✕</button></header>
      <div class="contenu">${corps}</div>
    </form>`;

  const form = d.querySelector("form");
  form.addEventListener("submit", (e) => e.preventDefault());
  d.querySelectorAll("[data-annuler]").forEach((b) => b.addEventListener("click", fermer));

  // Entrée dans un champ enregistre, sauf dans la liste des ingrédients
  // et dans les zones de texte, où elle sert à écrire.
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
    if (!["INPUT", "SELECT"].includes(e.target.tagName)) return;
    e.preventDefault();
    if (e.target.closest(".ing-ligne")) return;
    const principal = d.querySelector(".boutons .gros");
    if (principal) principal.click();
  });

  d.showModal();
  if (apres) apres(d);
  return d;
}

function fermer() { const d = dlg(); if (d.open) d.close(); }

function champ(id, etiq, attrs = "", aide = "") {
  return `<label class="ch"><span>${esc(etiq)}</span><input id="${id}" ${attrs}>
    ${aide ? `<small>${esc(aide)}</small>` : ""}</label>`;
}

/* --------------------------------------------------- ajouter une bouteille */

function optionsTypes(selection) {
  return typesParFamille().map(([famille, liste]) =>
    `<optgroup label="${esc(famille)}">` + liste.map((t) =>
      `<option value="${esc(t.id)}"${t.id === selection ? " selected" : ""}>${esc(t.nom)}${t.exemples ? " — " + esc(t.exemples) : ""}</option>`
    ).join("") + `</optgroup>`).join("");
}

function optionsCategories(selection) {
  return etat.CATS.map((c) =>
    `<option value="${esc(c)}"${c === selection ? " selected" : ""}>${esc(c)}</option>`).join("");
}

/** @param apres reçoit l’id de la bouteille créée (ou null si annulé) */
export function ajouterBouteille(apres, bouteille = null) {
  const edition = !!bouteille;
  ouvrir(edition ? "Modifier la bouteille" : "Ajouter une bouteille", `
    ${champ("b-nom", "Nom de la bouteille", `type="text" maxlength="80" autocomplete="off" value="${esc(bouteille ? bouteille.nom : "")}"`)}
    <label class="ch"><span>Catégorie</span>
      <select id="b-cat">${optionsCategories(bouteille ? bouteille.categorie : "Liqueurs")}
        <option value="__new">+ Nouvelle catégorie…</option></select></label>
    ${champ("b-cat-new", "Nom de la nouvelle catégorie", `type="text" maxlength="40" autocomplete="off"`)}
    <label class="ch"><span>Type</span>
      <select id="b-type">${optionsTypes(bouteille ? bouteille.type : "liqueur-fruitee")}</select>
      <small>Le type sert à reconnaître la bouteille dans les recettes : « Patrón, Casamigos → Tequila blanche ».</small></label>
    <div class="boutons">
      <button class="gros" id="b-ok" type="button">${edition ? "Enregistrer" : "Ajouter"}</button>
      <button type="button" class="lien-btn" data-annuler>Annuler</button>
    </div>`, (d) => {
    const cat = d.querySelector("#b-cat");
    const neuf = d.querySelector("#b-cat-new").closest(".ch");
    const majuscule = () => { neuf.style.display = cat.value === "__new" ? "" : "none"; };
    cat.addEventListener("change", majuscule);
    majuscule();
    d.querySelector("#b-nom").focus();

    d.querySelector("#b-ok").addEventListener("click", async () => {
      const nom = d.querySelector("#b-nom").value.trim();
      if (!nom) { d.querySelector("#b-nom").focus(); return; }
      const categorie = cat.value === "__new"
        ? (d.querySelector("#b-cat-new").value.trim() || "Liqueurs")
        : cat.value;
      const type = d.querySelector("#b-type").value;
      const id = bouteille ? bouteille.id : nouvelId("b");
      await ecrire(BOUTEILLES, {
        id, nom, categorie, type,
        cree: bouteille ? bouteille.cree : new Date().toISOString()
      });
      // une bouteille qu’on vient d’ajouter est cochée : elle l’a chez elle
      if (!bouteille) etat.have[id] = true;
      enregistrerInventaire();
      await fusionner();
      fermer();
      rafraichir();
      if (apres) apres(id);
    });
  });
}

/* ------------------------------------------------- fiche d’une bouteille */

export function ficheBouteille(id) {
  const b = etat.ING[id];
  if (!b) return;
  const recettes = recettesPour(id);
  const liste = recettes.length
    ? `<ul class="fiche-liste">` + recettes.slice(0, 12).map((r) =>
      `<li><button class="lien-btn" data-aller="${esc(r.id)}">${esc(r.nom)}</button></li>`).join("")
      + `</ul>${recettes.length > 12 ? `<p class="hint">…et ${recettes.length - 12} autres.</p>` : ""}`
    : `<p class="hint">Aucune recette de l’application n’utilise ce type pour l’instant. Tu peux en écrire une avec « Ajouter une recette ».</p>`;

  ouvrir(b.nom, `
    <p class="hint">${esc(b.categorie)} · ${esc(nomType(b.type))}</p>
    <h3 class="sous">Recettes qui l’utilisent</h3>
    ${liste}
    <div class="boutons">
      <button class="gros doux" id="f-modifier" type="button">Modifier</button>
      <button class="lien-btn danger" id="f-supprimer" type="button">Supprimer la bouteille</button>
    </div>`, (d) => {
    d.querySelector("#f-modifier").addEventListener("click", () => {
      fermer();
      ajouterBouteille(null, b);
    });
    d.querySelector("#f-supprimer").addEventListener("click", async () => {
      if (!confirm(`Supprimer « ${b.nom} » de ton bar ?`)) return;
      await effacer(BOUTEILLES, id);
      delete etat.have[id];
      enregistrerInventaire();
      await fusionner();
      fermer();
      rafraichir();
    });
    d.querySelectorAll("[data-aller]").forEach((bt) => bt.addEventListener("click", () => {
      fermer();
      allerA(bt.dataset.aller);
    }));
  });
}

function allerA(recetteId) {
  rafraichir();
  requestAnimationFrame(() => {
    const el = document.querySelector(`details.r[data-id="${CSS.escape(recetteId)}"]`);
    if (el) { el.open = true; el.scrollIntoView({ block: "center" }); }
  });
}

/* ----------------------------------------------- ajouter / modifier une recette */

function listeBouteilles() {
  return Object.values(etat.ING)
    .map((b) => `<option value="${esc(b.nom)}">`).join("");
}

function ligneIngredient(n, data = {}) {
  const nom = data.nom || "";
  return `<div class="ing-ligne" data-n="${n}">
    <input class="ing-q" type="text" inputmode="text" placeholder="1 oz" aria-label="Quantité" value="${esc(data.q || "")}" maxlength="20">
    <input class="ing-nom" type="text" list="toutes-bouteilles" placeholder="Bouteille ou ingrédient" aria-label="Ingrédient" value="${esc(nom)}" autocomplete="off">
    <label class="ing-opt"><input type="checkbox" class="ing-fac"${data.facultatif ? " checked" : ""}> facultatif</label>
    <button type="button" class="ing-moins" aria-label="Retirer cette ligne">−</button>
  </div>`;
}

export function ajouterRecette(recette = null) {
  const edition = !!recette;
  const lignes = edition
    ? recette.ingredients.map((x, k) => ligneIngredient(k, {
      q: x.q,
      nom: (x.ids || []).map((id) => etat.ING[id] && etat.ING[id].nom).filter(Boolean)[0]
        || (x.types || []).map(nomType)[0] || "",
      facultatif: x.facultatif
    })).join("")
    : [0, 1, 2].map((n) => ligneIngredient(n)).join("");

  let photoId = edition ? recette.photo || null : null;
  let photoNouvelle = null;   // fichier choisi, pas encore enregistré

  ouvrir(edition ? "Modifier la recette" : "Ajouter une recette", `
    <datalist id="toutes-bouteilles">${listeBouteilles()}</datalist>
    ${champ("r-nom", "Nom du cocktail", `type="text" maxlength="60" autocomplete="off" value="${esc(edition ? recette.nom : "")}"`)}

    <label class="ch"><span>Verre</span><select id="r-verre">
      ${VERRES.map((v) => `<option value="${v}"${edition && recette.verre === v ? " selected" : ""}>${esc(VERRE_ETIQUETTE[v])}</option>`).join("")}
    </select></label>

    <div class="ch"><span>Ingrédients</span>
      <div id="r-ings">${lignes}</div>
      <button type="button" class="lien-btn" id="r-plus">+ Ajouter un ingrédient</button>
      <small>Écris le nom d’une bouteille de ton bar, ou un nouvel ingrédient : on te proposera de l’ajouter.</small>
    </div>

    <label class="ch"><span>Étapes</span>
      <textarea id="r-methode" rows="3" maxlength="600" placeholder="Secoue avec de la glace, puis filtre…">${esc(edition ? recette.methode : "")}</textarea></label>

    <div class="ch"><span>Photo</span>
      <div class="photo-apercu" id="r-apercu"></div>
      <div class="gros-boutons">
        <label class="gros doux fichier">Choisir une photo
          <input type="file" id="r-photo-galerie" accept="image/*" hidden></label>
        <label class="gros doux fichier">Prendre une photo
          <input type="file" id="r-photo-camera" accept="image/*" capture="environment" hidden></label>
      </div>
      <button type="button" class="lien-btn" id="r-photo-retirer" hidden>Retirer la photo</button>
    </div>

    <label class="ch"><span>Note (facultatif)</span>
      <textarea id="r-note" rows="2" maxlength="300">${esc(edition ? recette.note || "" : "")}</textarea></label>

    ${champ("r-lien", "Lien vers la recette d’origine (facultatif)", `type="url" inputmode="url" maxlength="300" autocomplete="off" placeholder="https://…" value="${esc(edition ? recette.lien || "" : "")}"`)}

    <p class="erreur" id="r-erreur" hidden></p>
    <div class="boutons">
      <button class="gros" id="r-ok" type="button">${edition ? "Enregistrer" : "Ajouter la recette"}</button>
      <button type="button" class="lien-btn" data-annuler>Annuler</button>
    </div>`, (d) => {
    const ings = d.querySelector("#r-ings");
    const apercu = d.querySelector("#r-apercu");
    const retirer = d.querySelector("#r-photo-retirer");

    function montrerPhoto(url) {
      apercu.innerHTML = url ? `<img src="${esc(url)}" alt="Aperçu de la photo">` : "";
      retirer.hidden = !url;
    }
    if (photoId && etat.photoURL[photoId]) montrerPhoto(etat.photoURL[photoId]);

    for (const champId of ["r-photo-galerie", "r-photo-camera"]) {
      d.querySelector("#" + champId).addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        photoNouvelle = f;
        montrerPhoto(URL.createObjectURL(f));
      });
    }
    retirer.addEventListener("click", () => {
      photoNouvelle = null;
      photoId = null;
      d.querySelector("#r-photo-galerie").value = "";
      d.querySelector("#r-photo-camera").value = "";
      montrerPhoto(null);
    });

    d.querySelector("#r-plus").addEventListener("click", () => {
      ings.insertAdjacentHTML("beforeend", ligneIngredient(ings.children.length));
    });
    ings.addEventListener("click", (e) => {
      const b = e.target.closest(".ing-moins");
      if (b && ings.children.length > 1) b.closest(".ing-ligne").remove();
    });

    d.querySelector("#r-nom").focus();

    d.querySelector("#r-ok").addEventListener("click", async () => {
      const err = d.querySelector("#r-erreur");
      const dire = (m) => { err.textContent = m; err.hidden = false; };
      err.hidden = true;

      const nom = d.querySelector("#r-nom").value.trim();
      if (!nom) return dire("Il faut un nom.");
      const methode = d.querySelector("#r-methode").value.trim();

      // nom de bouteille -> identifiant ; sinon on propose de la créer
      const parNom = {};
      for (const b of Object.values(etat.ING)) parNom[b.nom.toLowerCase()] = b.id;
      const parTypeNom = {};
      for (const t of Object.values(etat.TYPES)) parTypeNom[t.nom.toLowerCase()] = t.id;

      const ingredients = [];
      const inconnus = [];
      for (const ligne of ings.querySelectorAll(".ing-ligne")) {
        const q = ligne.querySelector(".ing-q").value.trim();
        const n = ligne.querySelector(".ing-nom").value.trim();
        if (!n) continue;
        const facultatif = ligne.querySelector(".ing-fac").checked;
        const cle = n.toLowerCase();
        if (parNom[cle]) {
          ingredients.push({ q: q || "", ids: [parNom[cle]], ...(facultatif ? { facultatif: true } : {}) });
        } else if (parTypeNom[cle]) {
          ingredients.push({ q: q || "", types: [parTypeNom[cle]], ...(facultatif ? { facultatif: true } : {}) });
        } else {
          inconnus.push(n);
        }
      }
      if (inconnus.length) {
        dire(`Ces ingrédients ne sont pas encore dans ton bar : ${inconnus.join(", ")}. Ajoute-les d’abord avec « Ajouter une bouteille ».`);
        return;
      }
      if (!ingredients.length) return dire("Il faut au moins un ingrédient.");

      if (photoNouvelle) {
        try {
          if (photoId) await supprimerPhoto(photoId);
          photoId = await enregistrerPhoto(photoNouvelle);
        } catch (e) { return dire("Cette photo n’a pas pu être enregistrée."); }
      } else if (edition && recette.photo && !photoId) {
        await supprimerPhoto(recette.photo);
      }

      const id = edition ? recette.id : nouvelId("r");
      await ecrire(RECETTES, {
        id, nom,
        verre: d.querySelector("#r-verre").value,
        ingredients,
        methode: methode || "À toi de jouer.",
        note: d.querySelector("#r-note").value.trim() || undefined,
        lien: d.querySelector("#r-lien").value.trim() || undefined,
        photo: photoId || undefined,
        cree: edition ? recette.cree : new Date().toISOString(),
        modifie: new Date().toISOString()
      });
      await fusionner();
      fermer();
      rafraichir();
    });
  });
}

export async function supprimerRecette(id) {
  const r = etat.R.find((x) => x.id === id);
  if (!r || !r.perso) return;
  if (!confirm(`Supprimer « ${r.nom} » ?`)) return;
  if (r.photo) await supprimerPhoto(r.photo);
  await effacer(RECETTES, id);
  await fusionner();
  rafraichir();
}

export function modifierRecette(id) {
  const r = etat.R.find((x) => x.id === id);
  if (r && r.perso) ajouterRecette(r);
}
