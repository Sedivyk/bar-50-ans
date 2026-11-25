/* Vérifie le relais IA (ia/worker.js) sans appeler Gemini pour de vrai :
   l'appel sortant est simulé.

   node tests/ia.mjs */

import worker, { lireDemande, lireReponse, question } from "../ia/worker.js";
import { journal } from "./serveur.mjs";

const { check, bilan } = journal();
const SITE = "https://sedivyk.github.io";
const env = { GEMINI_KEY: "cle-de-test", ORIGINES: SITE };

const demande = {
  selection: [{ ref: "stgermain", nom: "St-Germain" }],
  connus: [{ ref: "stgermain", nom: "St-Germain", a: true }, { ref: "lime", nom: "Lime" }],
  eviter: ["Le 50"]
};
const appel = (corps, origine = SITE, methode = "POST") => worker.fetch(new Request("https://relais.test/", {
  method: methode,
  headers: { "content-type": "application/json", ...(origine ? { origin: origine } : {}) },
  body: methode === "POST" ? JSON.stringify(corps) : undefined
}), env);

let envoye = null;
let reponseGemini = null;
globalThis.fetch = async (url, init) => {
  envoye = { url: String(url), init, corps: JSON.parse(init.body) };
  return reponseGemini();
};
const geminiDit = (o, statut = 200) => () => new Response(
  statut === 200 ? JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) : "{}",
  { status: statut, headers: { "content-type": "application/json" } });

/* les gardes */
check("une autre origine est refusée", (await appel(demande, "https://ailleurs.example")).status === 403);
check("sans origine, refusé aussi", (await appel(demande, null)).status === 403);
const pre = await appel(null, SITE, "OPTIONS");
check("le pré-vol CORS répond au site",
  pre.status === 204 && pre.headers.get("access-control-allow-origin") === SITE);
check("une demande sans ingrédient est refusée",
  (await appel({ selection: [] })).status === 400);
check("lireDemande coupe les listes trop longues",
  lireDemande({ selection: Array(40).fill({ ref: "a", nom: "b" }) }).selection.length === 15);

/* le chemin normal */
const reponseOk = geminiDit({ recettes: [
  { nom: "Brise de sureau", verre: "coupe", methode: "Secoue.", note: "Frais.", deco: ["Zeste"],
    ingredients: [{ q: "1 oz", ref: "stgermain", nom: "St-Germain" }, { q: "½ oz", ref: "lime", nom: "Lime" }] },
  { nom: "", verre: "coupe", methode: "x", ingredients: [{ q: "1", ref: "lime", nom: "Lime" }] },
  { nom: "Verre étrange", verre: "seau", methode: "x", ingredients: [{ q: "1", ref: "lime", nom: "Lime" }] }
] });
reponseGemini = reponseOk;
const ok = await appel(demande);
const corps = await ok.json();
check("200, avec l’en-tête CORS du site",
  ok.status === 200 && ok.headers.get("access-control-allow-origin") === SITE);
check("la clé part dans l’en-tête, jamais dans l’adresse",
  envoye.init.headers["x-goog-api-key"] === "cle-de-test" && !envoye.url.includes("cle-de-test"));
check("le modèle par défaut est le Flash-Lite le plus récent",
  envoye.url.includes("/models/gemini-flash-lite-latest:generateContent"));
check("réponse en JSON structuré demandée",
  envoye.corps.generationConfig.responseMimeType === "application/json" && !!envoye.corps.generationConfig.responseSchema);
check("la recette sans nom est écartée, le verre inconnu corrigé",
  corps.recettes.length === 2 && corps.recettes[1].verre === "court", JSON.stringify(corps.recettes.map((r) => r.nom)));

const q = question(lireDemande(demande));
check("la question cite la sélection, ce qu’elle a, et ce qu’il faut éviter",
  q.includes("stgermain : St-Germain") && q.includes("(elle l’a)") && q.includes("Le 50"));

/* les ennuis */
reponseGemini = geminiDit({}, 429);
check("quota Gemini épuisé : 429", (await appel(demande)).status === 429);
{
  const vus = [];
  let n = 0;
  reponseGemini = () => (++n === 1 ? geminiDit({}, 503)() : reponseOk());
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, init) => { vus.push(String(url).match(/models\/([^:]+)/)[1]); return avant(url, init); };
  const r = await appel(demande);
  globalThis.fetch = avant;
  check("modèle débordé (503) : on réessaie avec le secours, et ça marche",
    r.status === 200 && vus.length === 2 && vus[0] !== vus[1], vus.join(" → "));
  reponseGemini = geminiDit({}, 503);
  check("tous débordés : 502 (elle verra « Réessaie dans un moment »)", (await appel(demande)).status === 502);
  n = 0; vus.length = 0;
  reponseGemini = () => (++n <= 2 ? geminiDit({}, n === 1 ? 503 : 404)() : reponseOk());
  globalThis.fetch = async (url, init) => { vus.push(String(url).match(/models\/([^:]+)/)[1]); return avant(url, init); };
  const r3 = await appel(demande);
  globalThis.fetch = avant;
  check("débordé puis retiré (404) : on continue jusqu’à un modèle qui répond",
    r3.status === 200 && vus.length === 3, vus.join(" → "));
}
reponseGemini = geminiDit({}, 400);
check("Gemini refuse : 502", (await appel(demande)).status === 502);
reponseGemini = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "pas du json" }] } }] }));
check("réponse illisible : 502", (await appel(demande)).status === 502);
check("lireReponse ignore les pensées du modèle",
  lireReponse({ candidates: [{ content: { parts: [{ text: "bla", thought: true },
    { text: JSON.stringify({ recettes: [{ nom: "A", verre: "court", methode: "m", ingredients: [{ q: "1", ref: "x", nom: "X" }] }] }) }] } }] }).length === 1);
check("sans clé configurée : 500, sans appeler Gemini",
  (await worker.fetch(new Request("https://relais.test/", {
    method: "POST", headers: { origin: SITE }, body: JSON.stringify(demande)
  }), { ORIGINES: SITE })).status === 500);

process.exit(bilan() ? 1 : 0);
