/* Démarrage, onglets, et les gestes dans la page. */

import {
  etat, charger, chargerInventaire, enregistrerInventaire, enregistrerChoix
} from "./donnees.js";
import { vue, rendre, compter } from "./vues.js";
import {
  brancher, ajouterBouteille, ajouterRecette, ficheBouteille,
  modifierRecette, supprimerRecette
} from "./formulaires.js";
import { exporter, importer } from "./transfert.js";

let pret = false;

function rafraichir() { if (pret) rendre(); }
brancher(rafraichir);

/* ------------------------------------------------------------- les gestes */

function surClic(e) {
  const cible = (sel) => e.target.closest(sel);

  if (cible("#ajouter-bouteille")) return ajouterBouteille();
  if (cible("#ajouter-recette")) return ajouterRecette();

  const fiche = cible("[data-fiche]");
  if (fiche) { e.preventDefault(); return ficheBouteille(fiche.dataset.fiche); }

  const mod = cible("[data-modifier-recette]");
  if (mod) return modifierRecette(mod.dataset.modifierRecette);

  const sup = cible("[data-supprimer-recette]");
  if (sup) return supprimerRecette(sup.dataset.supprimerRecette);

  if (cible("#reset")) {
    if (!confirm("Remettre les bouteilles cochées comme au départ ? Tes bouteilles et tes recettes ajoutées restent.")) return;
    const defaut = {};
    for (const id in etat.ING) defaut[id] = etat.ING[id].perso ? !!etat.have[id] : !!etat.ING[id].defaut;
    etat.have = defaut;
    enregistrerInventaire();
    return rendre();
  }

  if (cible("#exporter")) return lancerExport();
  if (cible("#importer")) { document.getElementById("fichier-import").click(); return; }
}

async function lancerExport() {
  try {
    const n = await exporter();
    annoncer(`Fichier enregistré : ${n.bouteilles} bouteille(s), ${n.recettes} recette(s), ${n.photos} photo(s).`);
  } catch (err) {
    annoncer("L’export n’a pas fonctionné.", true);
  }
}

async function surFichier(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const n = await importer(f);
    rendre();
    annoncer(`Importé : ${n.bouteilles} bouteille(s), ${n.recettes} recette(s), ${n.photos} photo(s).`);
  } catch (err) {
    annoncer(err.message || "Ce fichier n’a pas pu être lu.", true);
  }
}

function surChangement(e) {
  const cb = e.target.closest(".chip input[type=checkbox]");
  if (cb) {
    etat.have[cb.dataset.id] = cb.checked;
    enregistrerInventaire();
    compter();
    return;
  }
  const pick = e.target.closest("select.pick");
  if (pick) {
    etat.choix[pick.dataset.r + ":" + pick.dataset.k] = pick.value;
    enregistrerChoix();
    // on redessine la carte ouverte pour que le résumé suive
    const ouvertes = [...document.querySelectorAll("details.r[open]")].map((d) => d.dataset.id);
    rendre();
    for (const id of ouvertes) {
      const d = document.querySelector(`details.r[data-id="${CSS.escape(id)}"]`);
      if (d) d.open = true;
    }
    return;
  }
  if (e.target.id === "fichier-import") surFichier(e);
}

function surSaisie(e) {
  if (e.target.id !== "q") return;
  vue.recherche = e.target.value;
  const pos = e.target.selectionStart;
  rendre();
  const champ = document.getElementById("q");
  if (champ) { champ.focus(); champ.setSelectionRange(pos, pos); }
}

/* ------------------------------------------------------------- le message */

let minuterie = null;
function annoncer(texte, probleme = false) {
  const el = document.getElementById("message");
  el.textContent = texte;
  el.className = "message" + (probleme ? " probleme" : "");
  el.hidden = false;
  clearTimeout(minuterie);
  minuterie = setTimeout(() => { el.hidden = true; }, 6000);
}

/* ------------------------------------------------------------- démarrage */

function erreur() {
  document.getElementById("main").innerHTML =
    `<p class="loading">Les recettes n’ont pas pu être chargées.<br>Vérifie ta connexion, puis réessaie.<br>
     <button class="retry" id="retry">Réessayer</button></p>`;
  document.getElementById("retry").addEventListener("click", demarrer);
}

async function demarrer() {
  document.getElementById("main").innerHTML = `<p class="loading">Un instant, on ouvre le bar…</p>`;
  try {
    await charger();
    chargerInventaire();
    pret = true;
    rendre();
  } catch (e) {
    pret = false;
    erreur();
  }
}

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  vue.onglet = t.dataset.view;
  rendre();
  window.scrollTo({ top: 0 });
}));
document.addEventListener("click", surClic);
document.addEventListener("change", surChangement);
document.addEventListener("input", surSaisie);

demarrer();

/* ------------------------------------------------- service worker (hors ligne) */

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    const avaitUnControleur = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js").catch(() => {});
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitUnControleur) return;   // toute première installation
      if (recharge) return;             // une seule fois
      recharge = true;
      location.reload();
    });
  });
}
