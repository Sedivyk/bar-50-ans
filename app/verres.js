/* Les verres dessinés : repli quand une recette n’a pas de photo,
   et quand une photo ne charge pas. Dessinés en SVG pour suivre
   les couleurs de l’application, en clair comme en sombre. */

export const VERRES = ["coupe", "court", "grand", "shooter", "tasse"];

export const VERRE_NOM = {
  coupe: "une coupe",
  court: "un verre court",
  grand: "un grand verre",
  shooter: "un verre à shooter",
  tasse: "une tasse"
};

export const VERRE_ETIQUETTE = {
  coupe: "Coupe",
  court: "Verre court",
  grand: "Grand verre",
  shooter: "Shooter",
  tasse: "Tasse"
};

const GLASS = {
  coupe: {
    out: "M20 31 H80 M22 31 C22 50 34 61 50 61 C66 61 78 50 78 31 M50 61 V79 M34 81 H66",
    liq: "M25 36 C27 49 37 56 50 56 C63 56 73 49 75 36 Z"
  },
  court: {
    out: "M30 32 L33 77 Q33 82 38 82 H62 Q67 82 67 77 L70 32 Z",
    liq: "M31.7 50 L33 77 Q33 82 38 82 H62 Q67 82 67 77 L68.3 50 Z"
  },
  grand: {
    out: "M35 17 L37 78 Q37 83 42 83 H58 Q63 83 63 78 L65 17 Z",
    liq: "M36.2 37 L37 78 Q37 83 42 83 H58 Q63 83 63 78 L63.8 37 Z"
  },
  shooter: {
    out: "M37 45 L40 77 Q40 82 45 82 H55 Q60 82 60 77 L63 45 Z",
    liq: "M38.2 57 L40 77 Q40 82 45 82 H55 Q60 82 60 77 L61.8 57 Z"
  },
  tasse: {
    out: "M30 40 L33 77 Q33 83 39 83 H59 Q65 83 65 77 L68 40 Z M68 49 C79 49 79 67 68 67",
    liq: "M30.6 48 L33 77 Q33 83 39 83 H59 Q65 83 65 77 L67.4 48 Z",
    extra: "M43 30 C46 26 40 23 43 19 M56 30 C59 26 53 23 56 19"
  }
};

export function glassSVG(verre) {
  const g = GLASS[verre] || GLASS.court;
  const nom = VERRE_NOM[verre] || VERRE_NOM.court;
  return `<svg class="glass" viewBox="0 0 100 100" role="img" aria-label="Se sert dans ${nom}" focusable="false">`
    + (g.liq ? `<path class="gl-liq" d="${g.liq}"/>` : "")
    + `<path class="gl-out" d="${g.out}"/>`
    + (g.extra ? `<path class="gl-out" d="${g.extra}"/>` : "")
    + `</svg>`;
}
