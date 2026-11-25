/* Le relais IA de « Ton bar » : un Cloudflare Worker.

   L’application est publique et statique : elle ne peut pas garder de clé.
   Ce relais garde la clé Gemini (un secret Cloudflare, jamais dans le dépôt),
   accepte seulement des demandes de recettes venant du site, construit
   lui-même la question, et ne renvoie que des recettes.

   Déploiement : voir « Le relais IA » dans le README. */

const MODELE_PAR_DEFAUT = "gemini-flash-lite-latest";
const MODELE_SECOURS = "gemini-flash-latest";
const ORIGINES_PAR_DEFAUT = "https://sedivyk.github.io";
const VERRES = ["coupe", "court", "grand", "shooter", "tasse"];
const TAILLE_MAX = 64 * 1024;

const propre = (s, max) => String(s == null ? "" : s)
  .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Valide ce que l’application envoie. Renvoie { erreur } ou les listes nettoyées. */
export function lireDemande(o) {
  if (!o || typeof o !== "object") return { erreur: "demande illisible" };
  const liste = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const selection = liste(o.selection, 15)
    .map((x) => ({ ref: propre(x && x.ref, 60), nom: propre(x && x.nom, 80) }))
    .filter((x) => x.ref && x.nom);
  if (!selection.length) return { erreur: "aucun ingrédient choisi" };
  const connus = liste(o.connus, 500)
    .map((x) => ({ ref: propre(x && x.ref, 60), nom: propre(x && x.nom, 80), a: !!(x && x.a) }))
    .filter((x) => x.ref && x.nom);
  const eviter = liste(o.eviter, 400).map((n) => propre(n, 80)).filter(Boolean);
  return { selection, connus, eviter };
}

export function question({ selection, connus, eviter }) {
  const ligne = (x) => `- ${x.ref} : ${x.nom}${x.a ? " (elle l’a)" : ""}`;
  return `Tu es un barman créatif. Invente 3 recettes de cocktails nouvelles, en français du Québec, au tutoiement.

Ingrédients choisis, à mettre en vedette (utilise-les tous si ça goûte bon, sinon le plus possible) :
${selection.map((x) => `- ${x.ref} : ${x.nom}`).join("\n")}

Complète au besoin, de préférence avec ce qu’elle a déjà (marqué « elle l’a »), en restant simple.

Ingrédients connus. Pour chaque ingrédient de tes recettes, « ref » doit être EXACTEMENT un identifiant de cette liste ; n’en invente jamais :
${connus.map(ligne).join("\n")}

Ne refais pas ces recettes qu’elle a déjà : ${eviter.join(", ") || "aucune"}.

Règles :
- 3 à 6 ingrédients par recette ; quantités comme « 1 ½ oz », « ¾ oz », « 2 traits », « Compléter ».
- verre : coupe, court, grand, shooter ou tasse.
- methode : une ou deux phrases simples.
- note : une phrase qui donne envie.
- deco : une à trois idées de garniture courtes.
- Si aucun ingrédient choisi ne contient d’alcool, fais des recettes sans alcool.
- Les trois recettes doivent être vraiment différentes entre elles.`;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    recettes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nom: { type: "STRING" },
          verre: { type: "STRING", enum: VERRES },
          ingredients: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                q: { type: "STRING" },
                ref: { type: "STRING" },
                nom: { type: "STRING" },
                facultatif: { type: "BOOLEAN" }
              },
              required: ["q", "ref", "nom"]
            }
          },
          methode: { type: "STRING" },
          note: { type: "STRING" },
          deco: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["nom", "verre", "ingredients", "methode"]
      }
    }
  },
  required: ["recettes"]
};

/** Ne garde de la réponse de Gemini que des recettes bien formées. */
export function lireReponse(gemini) {
  const parts = (((gemini || {}).candidates || [])[0] || {}).content?.parts || [];
  const texte = parts.filter((p) => p && typeof p.text === "string" && !p.thought)
    .map((p) => p.text).join("");
  let o;
  try { o = JSON.parse(texte); } catch (e) { return []; }
  return (Array.isArray(o && o.recettes) ? o.recettes : []).slice(0, 3).map((r) => ({
    nom: propre(r && r.nom, 60),
    verre: VERRES.includes(r && r.verre) ? r.verre : "court",
    ingredients: (Array.isArray(r && r.ingredients) ? r.ingredients : []).slice(0, 10).map((x) => ({
      q: propre(x && x.q, 30), ref: propre(x && x.ref, 60), nom: propre(x && x.nom, 80),
      facultatif: !!(x && x.facultatif)
    })).filter((x) => x.ref || x.nom),
    methode: propre(r && r.methode, 600),
    note: propre(r && r.note, 300),
    deco: (Array.isArray(r && r.deco) ? r.deco : []).slice(0, 3).map((t) => propre(t, 120)).filter(Boolean)
  })).filter((r) => r.nom && r.ingredients.length);
}

function entetes(origine) {
  return {
    "access-control-allow-origin": origine,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(corps, statut, origine) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "content-type": "application/json; charset=utf-8", ...entetes(origine) }
  });
}

/** Un appel à Gemini ; null si injoignable. */
async function appelerGemini(modele, demande, cle) {
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: question(demande) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 1,
            maxOutputTokens: 4096
          }
        }),
        signal: AbortSignal.timeout(40000)
      });
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(requete, env) {
    const permises = String(env.ORIGINES || ORIGINES_PAR_DEFAUT).split(",").map((s) => s.trim());
    const origine = requete.headers.get("origin") || "";
    if (!permises.includes(origine)) return new Response("interdit", { status: 403 });

    if (requete.method === "OPTIONS") return new Response(null, { status: 204, headers: entetes(origine) });
    if (requete.method !== "POST") return json({ erreur: "méthode" }, 405, origine);
    if (!env.GEMINI_KEY) return json({ erreur: "relais pas configuré" }, 500, origine);

    const brut = await requete.text();
    if (brut.length > TAILLE_MAX) return json({ erreur: "trop gros" }, 413, origine);
    let demande;
    try { demande = lireDemande(JSON.parse(brut)); } catch (e) { demande = { erreur: "illisible" }; }
    if (demande.erreur) return json({ erreur: demande.erreur }, 400, origine);

    const modele = env.MODELE || MODELE_PAR_DEFAUT;
    // Si le modèle est débordé (503) ou en panne (500), on essaie une fois le secours.
    const modeles = [modele, MODELE_SECOURS].filter((m, i, t) => t.indexOf(m) === i);
    let res;
    for (const m of modeles) {
      res = await appelerGemini(m, demande, env.GEMINI_KEY);
      if (!res || (res.status !== 503 && res.status !== 500)) break;
      console.log("Gemini", m, res.status, "on essaie le suivant");
    }
    if (!res) return json({ erreur: "Gemini injoignable" }, 502, origine);
    if (res.status === 429) return json({ erreur: "quota" }, 429, origine);
    if (!res.ok) {
      console.log("Gemini", res.status, (await res.text()).slice(0, 500));
      return json({ erreur: "Gemini a refusé" }, 502, origine);
    }
    const recettes = lireReponse(await res.json());
    if (!recettes.length) return json({ erreur: "réponse vide" }, 502, origine);
    return json({ recettes }, 200, origine);
  }
};
