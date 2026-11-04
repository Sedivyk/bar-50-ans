# -*- coding: utf-8 -*-
"""Cherche, télécharge et redimensionne les photos de cocktails (Pexafy).

Outil de développement : le site n'en a pas besoin pour fonctionner.

    set PEXAFY_KEY=...
    py -3 tools/photos.py                       # prépare ce qui manque
    py -3 tools/photos.py --tout                # refait tout
    py -3 tools/photos.py margarita-picante     # refait une recette
    py -3 tools/photos.py --rang 2 le-50        # prend le 3e meilleur résultat

Écrit  img/<slug>.jpg      800 × 500, JPEG, moins de 150 Ko
       data/credits.json   photographe, source, lien, licence
       revision-photos.html  page de révision, à approuver avant de pousser

Pexafy (https://pexafy.com) cherche dans neuf banques libres de droits
— Unsplash, Pexels, Pixabay, Kaboompics, Burst, StockSnap, Picjumbo,
Skitterphoto, NegativeSpace — et renvoie la licence et la ligne de crédit
avec chaque photo. La clé d'API reste dans l'environnement : elle n'est
jamais écrite dans le dépôt, qui est public.
"""

import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "img")
DATA = os.path.join(ROOT, "data")

API = "https://api.pexafy.com/api/v1/search/photos"
LARGEUR, HAUTEUR = 800, 500        # 16:10, comme l'affichage dans l'application
POIDS_MAX = 150 * 1024             # 150 Ko
LARGEUR_MIN = 1100                 # on refuse les originaux trop petits

# Pexafy fait de la recherche sémantique : on décrit le cocktail en anglais,
# avec sa couleur, son verre et sa garniture. « mots » sert à reclasser les
# résultats d'après la description que Pexafy donne de chaque photo.
QUETES = {
    "le-50": (
        "an elegant pale golden cocktail in a coupe glass on a bar",
        ["coupe", "martini glass", "golden", "pale", "elegant"]),
    "margarita-st-germain": (
        "a margarita served in a coupe glass with a lime wedge",
        ["margarita", "coupe", "martini glass", "lime"]),
    "margarita-picante": (
        "a spicy margarita in a short rocks glass with a chili salt rim and lime",
        ["margarita", "rocks", "salt", "lime", "chili", "short"]),
    "old-fashioned-tequila-erable": (
        "a tequila old fashioned in a rocks glass with a large ice cube and orange peel",
        ["rocks", "ice cube", "orange", "amber", "short"]),
    "old-fashioned-a-l-erable": (
        "a whisky old fashioned cocktail in a rocks glass with a big ice cube and orange twist",
        ["old fashioned", "rocks", "whisky", "whiskey", "ice cube", "orange"]),
    "mai-tai": (
        "a mai tai tiki cocktail with a pineapple slice and mint over crushed ice",
        ["tiki", "mai tai", "pineapple", "mint", "rum"]),
    "daiquiri-banane": (
        "a pale creamy yellow banana cocktail in a coupe glass with a banana slice",
        ["coupe", "martini glass", "banana", "pale", "creamy", "yellow", "white"]),
    "pornstar-martini": (
        "a passion fruit pornstar martini in a coupe glass with half a passion fruit on top",
        ["passion fruit", "martini", "coupe", "yellow", "orange"]),
    "espresso-martini-a-l-erable": (
        "an espresso martini with foam and three coffee beans on top in a martini glass",
        ["espresso", "coffee bean", "martini", "foam", "dark"]),
    "carajillo": (
        "a coffee liqueur cocktail served over ice in a short glass",
        ["coffee", "rocks", "ice", "dark", "short"]),
    "sour-amande-vanille": (
        "a creamy sour cocktail with thick egg white foam in a coupe glass",
        ["sour", "foam", "coupe", "egg white", "creamy"]),
    "amaretto-sour": (
        "an amaretto sour cocktail with foam and a cherry in a coupe glass",
        ["amaretto", "sour", "foam", "cherry", "coupe"]),
    "godfather-sucre": (
        "an amber whisky cocktail in a rocks glass over ice",
        ["whisky", "whiskey", "rocks", "amber", "ice", "short"]),
    "gin-soda-boreal": (
        "a clear gin and soda in a tall highball glass with ice",
        ["highball", "tall", "gin", "soda", "clear", "ice"]),
    "collins-au-sureau": (
        "a full tall highball glass of elderflower gin collins on a bar, lemon slice and ice, whole glass visible",
        ["collins", "tall", "highball", "lemon", "ice", "gin", "glass"]),
    "tom-collins": (
        "a tom collins cocktail in a tall glass with a lemon slice and ice",
        ["collins", "tall", "highball", "lemon", "gin"]),
    "jardin-d-aperol": (
        "a bright orange aperol cocktail in a tall glass with fresh herbs and ice",
        ["aperol", "orange", "tall", "highball", "ice", "herb"]),
    "aperol-soda": (
        "an aperol spritz in a tall glass with an orange slice and ice",
        ["aperol", "spritz", "orange", "ice", "tall"]),
    "lagon-bleu": (
        "a bright blue cocktail in a tall glass with ice",
        ["blue", "tall", "highball", "ice"]),
    "moscow-mule": (
        "a moscow mule with lime and mint, served cold with ice",
        ["mule", "copper", "mug", "lime", "mint", "ginger"]),
    "dark-n-stormy": (
        "a dark and stormy cocktail, dark rum poured over ginger beer in a tall glass with lime",
        ["dark", "rum", "ginger", "tall", "lime"]),
    "jager-mule": (
        "a dark cocktail in a tall highball glass with ginger beer, a lime wedge and plenty of ice",
        ["dark", "ginger", "lime", "tall", "highball", "ice"]),
    "rhum-epice-cola": (
        "a cuba libre, rum and cola in a tall glass with lime and ice",
        ["cola", "coke", "rum", "tall", "lime", "ice"]),
    "tequila-sunrise": (
        "a tequila sunrise cocktail in a tall glass, orange fading into red grenadine",
        ["sunrise", "orange", "red", "tall", "gradient"]),
    "harvey-wallbanger": (
        "an orange juice cocktail in a tall glass with ice and an orange slice",
        ["orange", "tall", "highball", "ice", "juice"]),
    "shooter-banana-split": (
        "colourful layered shooters in shot glasses lined up on a bar",
        ["shot glass", "shooter", "layered", "colorful"]),
    "tarte-aux-pommes-a-la-mode": (
        "a caramel coloured shot glass with cinnamon on a bar",
        ["shot glass", "caramel", "cinnamon", "amber"]),
    "tasse-au-beurre-d-arachide": (
        "a creamy brown chocolate cocktail in a coupe glass",
        ["creamy", "brown", "chocolate", "coupe", "martini"]),
    "cafe-cremeux": (
        "an irish coffee in a glass mug topped with whipped cream",
        ["coffee", "mug", "cream", "irish", "cup"]),

    # --- les 21 recettes ajoutées pour arriver à 50 ---
    "margarita-classique": (
        "a classic margarita in a coupe glass with a salt rim and a lime wedge",
        ["margarita", "coupe", "salt", "lime", "martini glass"]),
    "daiquiri-classique": (
        "a classic clear daiquiri in a coupe glass with a lime wheel",
        ["daiquiri", "coupe", "martini glass", "lime", "clear", "white"]),
    "whisky-sour": (
        "an amber whiskey sour cocktail with a layer of white foam on top and a cherry garnish",
        ["whiskey", "whisky", "sour", "foam", "cherry", "amber", "brown", "orange"]),
    "gimlet-au-sureau": (
        "a clear gin gimlet in a coupe glass with a lime wheel",
        ["gimlet", "gin", "coupe", "lime", "clear", "martini glass"]),
    "sour-a-l-orgeat": (
        "a creamy almond gin sour with thick foam in a coupe glass",
        ["sour", "foam", "coupe", "almond", "creamy", "white"]),
    "sidecar-a-l-erable": (
        "a sidecar cocktail in a coupe glass with a sugar rim and an orange twist",
        ["sidecar", "coupe", "sugar", "orange", "amber", "martini glass"]),
    "jagerita": (
        "a dark herbal margarita in a coupe glass with a lime wedge",
        ["dark", "coupe", "lime", "margarita", "martini glass"]),
    "ciel-bleu": (
        "a bright blue cocktail in a coupe glass with a lemon twist",
        ["blue", "coupe", "martini glass", "lemon"]),
    "espresso-martini-classique": (
        "a classic espresso martini with foam and coffee beans in a martini glass",
        ["espresso", "martini", "coffee bean", "foam", "dark"]),
    "paloma-maison": (
        "a paloma cocktail in a tall glass with grapefruit, lime and ice",
        ["paloma", "tall", "highball", "lime", "ice", "pink", "grapefruit"]),
    "rhum-collins": (
        "a tall highball glass of golden rum collins with a lime wheel, ice and soda, on a bar",
        ["collins", "tall", "highball", "lime", "ice", "rum", "golden", "glass"]),
    "vodka-soda-au-sureau": (
        "a clear vodka soda in a tall highball glass with lemon and ice",
        ["vodka", "soda", "tall", "highball", "lemon", "ice", "clear"]),
    "spritz-flor-del-fuego": (
        "a red orange spritz in a tall glass with ice and soda",
        ["spritz", "orange", "red", "tall", "ice"]),
    "poisson-rouge-soda": (
        "a pink cocktail in a tall glass with a lime wedge and ice",
        ["pink", "tall", "highball", "lime", "ice", "red"]),
    "tequila-soda-lime": (
        "a clear tequila soda in a tall glass with lime wedges and ice",
        ["tequila", "soda", "tall", "highball", "lime", "ice", "clear"]),
    "black-russian": (
        "a black russian, a dark coffee cocktail in a rocks glass over ice",
        ["dark", "black", "coffee", "rocks", "ice", "short"]),
    "vieux-carre-d-erable": (
        "an amber stirred cocktail in a rocks glass with a large ice cube",
        ["amber", "rocks", "ice cube", "short", "whisky", "whiskey"]),
    "shooter-erable-cannelle": (
        "an amber shot glass with cinnamon on a bar",
        ["shot glass", "amber", "cinnamon", "shooter"]),
    "b-52-maison": (
        "a layered b52 shot in a shot glass with three visible layers",
        ["shot glass", "layered", "layers", "shooter"]),
    "cafe-a-l-amaretto": (
        "a hot coffee in a mug with a splash of cream, on a table",
        ["coffee", "mug", "cream", "cup"]),
    "tasse-chocolat-cafe": (
        "a hot chocolate coffee in a mug with cocoa dusted on top",
        ["chocolate", "coffee", "mug", "cocoa", "cup"]),

    # --- les six recettes sans alcool ---
    "limonade-petillante": (
        "a tall glass of sparkling lemonade with ice, lemon slices and mint",
        ["lemonade", "tall", "lemon", "ice", "mint", "sparkling", "clear"]),
    "soda-a-l-orgeat": (
        "a tall glass of creamy white almond soda with ice and a lime wheel",
        ["tall", "white", "almond", "ice", "lime", "creamy"]),
    "passion-petillante": (
        "a tall glass of sparkling passion fruit drink with ice",
        ["passion fruit", "tall", "orange", "yellow", "ice", "sparkling"]),
    "cafe-frappe": (
        "an iced coffee in a tall glass with ice and a swirl of cream",
        ["iced coffee", "tall", "ice", "cream", "brown"]),
    "shirley-temple": (
        "a tall pink Shirley Temple mocktail with ice and a cocktail cherry",
        ["pink", "red", "tall", "cherry", "ice", "mocktail"]),
    "mule-sans-alcool": (
        "a tall glass of ginger beer with lime and plenty of ice, no alcohol",
        ["ginger", "tall", "lime", "ice", "golden"]),

    # --- pour ses grands et pour sa belle-soeur ---
    "mojito": (
        "a classic mojito in a tall glass with lots of fresh mint, lime and crushed ice",
        ["mojito", "mint", "lime", "tall", "ice", "green"]),
    "mojito-au-yuzu": (
        "a pale yellow mojito with fresh mint and lime in a tall glass with crushed ice",
        ["mojito", "mint", "lime", "tall", "ice", "yellow", "pale"]),
    "margarita-au-yuzu": (
        "a pale yellow citrus margarita in a coupe glass with a salt rim",
        ["margarita", "coupe", "yellow", "salt", "citrus", "martini glass"]),
    "gin-yuzu-soda": (
        "a clear sparkling citrus highball with ice and a lemon twist",
        ["highball", "tall", "clear", "sparkling", "lemon", "ice"]),
    "michelada": (
        "a michelada, beer in a tall glass with a chili salt rim and a lime wedge",
        ["beer", "michelada", "tall", "lime", "salt", "rim", "chili"]),
    "shandy-au-citron": (
        "a beer shandy with lemon in a tall glass on a terrace",
        ["beer", "shandy", "lemon", "tall", "golden"]),
    "shooter-au-yuzu": (
        "a bright yellow citrus shot in a shot glass on a bar",
        ["shot glass", "yellow", "citrus", "shooter"]),
    "shooter-bleu": (
        "a vivid blue curacao shot in a small shot glass, bright blue liquid",
        ["shot glass", "blue", "shooter", "bright", "vivid"]),
    "spritz-au-sureau": (
        "a pale clear sparkling cocktail in a tall glass with ice and a lemon twist, light and refreshing",
        ["tall", "pale", "clear", "white", "sparkling", "ice", "lemon", "highball"]),
    "passion-sureau-petillant": (
        "a sparkling passion fruit cocktail in a tall glass with ice and a flower",
        ["passion fruit", "tall", "sparkling", "ice", "orange", "yellow", "flower"]),
    "mojito-au-sureau": (
        "a pale floral mojito with fresh mint and lime in a tall glass with crushed ice",
        ["mojito", "mint", "lime", "tall", "ice", "pale", "clear"]),

    # --- les achats du 3 novembre ---
    "sakura-sour": (
        "a pale pink sour cocktail with thick white foam in a coupe glass, topped with a flower",
        ["sour", "foam", "coupe", "pink", "pale", "flower", "martini glass"]),
    "fleur-de-cerisier": (
        "a delicate pale pink floral cocktail in a coupe glass with an edible flower on top",
        ["coupe", "pink", "pale", "flower", "floral", "martini glass", "delicate"]),
    "old-fashioned-banane-bergamote": (
        "a dark amber stirred whiskey cocktail in a crystal rocks glass with an orange zest",
        ["amber", "rocks", "whiskey", "whisky", "orange", "crystal", "short"]),
    "daiquiri-a-la-bergamote": (
        "a clear pale daiquiri in a coupe glass with a lime wheel, dark moody bar",
        ["daiquiri", "coupe", "clear", "pale", "lime", "martini glass"]),
}


# ------------------------------------------------------------------------- API

class Pexafy:
    nom = "Pexafy"

    def __init__(self, key):
        self.h = {"x-api-key": key, "Accept": "application/json",
                  "User-Agent": "ton-bar/1.0"}

    def chercher(self, q, essai=0):
        url = (API + "?q=" + urllib.parse.quote(q)
               + "&per_page=15&orientation=landscape")
        req = urllib.request.Request(url, headers=self.h)
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                reste = r.headers.get("x-quota-remaining")
                data = json.loads(r.read().decode("utf-8"))
            return data.get("data") or [], reste
        except urllib.error.HTTPError as e:
            if e.code == 429 and essai < 4:
                attente = 20 * (essai + 1)
                print("      (limite de débit, pause de %ds)" % attente)
                time.sleep(attente)
                return self.chercher(q, essai + 1)
            raise


def choisir(photos, mots, deja, rang=0):
    """Reclasse d'après la pertinence de Pexafy et les mots attendus
    dans sa description de la photo."""
    notes = []
    for p in photos:
        if p.get("photo_id") in deja:
            continue
        if (p.get("width") or 0) < LARGEUR_MIN:
            continue
        if not (p.get("urls") or {}).get("large"):
            continue
        texte = ((p.get("description") or "") + " "
                 + (p.get("alt_description") or "") + " "
                 + (p.get("source_description") or "")).lower()
        touches = sum(1 for m in mots if m in texte)
        notes.append(((p.get("relevance_score") or 0) + 0.05 * touches, touches, p))
    notes.sort(key=lambda x: -x[0])
    return notes[rang] if len(notes) > rang else None


# ------------------------------------------------------------------- traitement

def telecharger(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ton-bar/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def recadrer(brut):
    """800 × 500, recadré au centre, JPEG sous 150 Ko."""
    im = Image.open(io.BytesIO(brut))
    if im.mode != "RGB":
        im = im.convert("RGB")

    cible = LARGEUR / HAUTEUR
    w, h = im.size
    if w / h > cible:                      # trop large : on rogne les côtés
        nw = int(h * cible)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:                                  # trop haut : on rogne haut et bas
        nh = int(w / cible)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((LARGEUR, HAUTEUR), Image.LANCZOS)

    buf = None
    for q in (75, 70, 65, 60, 55, 50):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= POIDS_MAX:
            return buf.getvalue(), q
    return buf.getvalue(), 50


def traiter(api, recette, deja, rang=0):
    slug = recette["id"]
    q, mots = QUETES.get(slug, (recette["nom"], []))
    try:
        photos, reste = api.chercher(q)
    except Exception as e:
        print("      ! recherche : %s" % e)
        return None

    pick = choisir(photos, mots, deja, rang)
    if not pick:
        print("      AUCUNE photo retenue — le verre dessiné sera utilisé")
        return None
    note, touches, p = pick

    try:
        data, qual = recadrer(telecharger(p["urls"]["large"]))
    except Exception as e:
        print("      ! téléchargement : %s" % e)
        return None

    os.makedirs(IMG, exist_ok=True)
    with open(os.path.join(IMG, slug + ".jpg"), "wb") as f:
        f.write(data)

    qui = (p.get("photographer_full_name") or p.get("photographer_username") or "").strip()
    print("      %-32s %5.1f Ko  q%d   %s / %s   (note %.2f, %d mots)"
          % (slug + ".jpg", len(data) / 1024, qual, qui or "sans nom",
             p.get("source"), note, touches))
    if reste:
        print("      quota restant : %s" % reste)

    return {
        "photographe": qui,
        "source": p.get("source") or "Pexafy",
        "lien": p.get("source_image_url") or "",
        "photographe_lien": p.get("photographer_url") or "",
        "licence": p.get("license_type") or "free",
        "photo_id": p.get("photo_id") or "",
        "description": (p.get("description") or "")[:300],
        "quete": q,
        "rang": rang,
    }


# --------------------------------------------------------- page de révision

CSS_REVISION = """
:root{color-scheme:light dark}
body{margin:0;padding:24px;background:#FBEFF2;color:#2A0E24;
 font:16px/1.5 "Figtree",system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-family:Georgia,serif;font-weight:400;font-size:1.9rem;margin:0 0 4px}
.intro{color:#76566A;margin:0 0 24px;max-width:62ch}
.grille{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))}
figure{margin:0;background:#fff;border:1px solid #EAD3DB;border-radius:14px;overflow:hidden}
.cadre{aspect-ratio:16/10;background:#F8DCE5}
.cadre img{width:100%;height:100%;object-fit:cover;display:block}
.vide{height:100%;display:flex;align-items:center;justify-content:center;
 text-align:center;color:#9C6E16;font-size:.9rem}
figcaption{padding:11px 13px;font-size:.88rem}
.slug,.cred{color:#76566A;font-size:.8rem}
.q{color:#9C6E16;font-size:.77rem}
.vu{color:#76566A;font-size:.74rem;font-style:italic}
a{color:inherit}
@media (prefers-color-scheme:dark){
 body{background:#1B0915;color:#F8E9F0}
 figure{background:#2A1122;border-color:#4A2640}
 .cadre{background:#46193A}
 .slug,.cred,.intro,.vu{color:#BE9FB1}.q,.vide{color:#E6BC63}}
"""


def page_revision(recettes, credits):
    lignes = []
    for r in recettes:
        c = credits.get(r["id"])
        if c:
            visuel = '<img src="img/%s.jpg" alt="%s" loading="lazy">' % (r["id"], r["nom"])
            qui = c.get("photographe") or "sans nom"
            legende = ('Photo : %s · %s — <a href="%s" target="_blank" rel="noopener">voir l\'original</a>'
                       % (qui, c.get("source", ""), c.get("lien", "")))
            detail = '<span class="q">Recherche : « %s »</span>' % c.get("quete", "")
            vu = '<span class="vu">%s</span>' % (c.get("description") or "")[:150]
        else:
            visuel = '<div class="vide">verre dessiné<br>(%s)</div>' % r["verre"]
            legende = "Aucune photo : l'application dessinera le verre."
            detail = ""
            vu = ""
        lignes.append(
            '<figure><div class="cadre">%s</div><figcaption>'
            '<b>%s</b><br><span class="slug">%s · verre : %s</span><br>'
            '<span class="cred">%s</span><br>%s<br>%s'
            '</figcaption></figure>'
            % (visuel, r["nom"], r["id"], r["verre"], legende, detail, vu))

    avec = sum(1 for r in recettes if credits.get(r["id"]))
    intro = ("%d recettes sur %d ont une photo. Dis-moi lesquelles remplacer : "
             "donne le nom de la recette, et au besoin une direction "
             "(« plus foncée », « avec une tranche de lime », « un autre verre »). "
             "Je relancerai la recherche pour celles-là seulement. "
             "Rien n'est poussé en ligne avant ton accord." % (avec, len(recettes)))
    html = ("<!DOCTYPE html>\n"
            '<html lang="fr"><head><meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta name="robots" content="noindex">\n'
            "<title>Révision des photos · Ton bar</title>\n"
            "<style>\n" + CSS_REVISION + "</style></head><body>\n"
            "<h1>Révision des photos</h1>\n"
            '<p class="intro">' + intro + "</p>\n"
            '<div class="grille">' + "\n".join(lignes) + "</div>\n"
            "</body></html>\n")
    with open(os.path.join(ROOT, "revision-photos.html"), "w", encoding="utf-8") as f:
        f.write(html)


# ------------------------------------------------------------------------- main

def main():
    args = list(sys.argv[1:])
    rang, tout = 0, False
    if "--rang" in args:
        i = args.index("--rang")
        rang = int(args[i + 1])
        del args[i:i + 2]
    if "--tout" in args:
        tout = True
        args.remove("--tout")
    seuls = set(args)

    with open(os.path.join(DATA, "recettes.json"), encoding="utf-8") as f:
        recettes = json.load(f)

    inconnus = seuls - {r["id"] for r in recettes}
    if inconnus:
        sys.exit("Recette(s) inconnue(s) : " + ", ".join(sorted(inconnus)))

    chemin = os.path.join(DATA, "credits.json")
    credits = {}
    if os.path.exists(chemin):
        with open(chemin, encoding="utf-8") as f:
            credits = json.load(f) or {}

    key = os.environ.get("PEXAFY_KEY", "").strip()
    if not key:
        sys.exit("PEXAFY_KEY absente : définis-la dans l'environnement, "
                 "jamais dans un fichier du dépôt.")
    api = Pexafy(key)
    print("Source : Pexafy (Unsplash, Pexels, Pixabay et six autres banques libres)\n")

    deja = {c.get("photo_id") for c in credits.values() if c.get("photo_id")}

    for r in recettes:
        slug = r["id"]
        if seuls and slug not in seuls:
            continue
        if not seuls and not tout and credits.get(slug) \
                and os.path.exists(os.path.join(IMG, slug + ".jpg")):
            continue
        print("  → %s" % r["nom"])
        if seuls or tout:
            deja.discard((credits.get(slug) or {}).get("photo_id"))
        c = traiter(api, r, deja, rang)
        if c:
            credits[slug] = c
            if c.get("photo_id"):
                deja.add(c["photo_id"])
        else:
            credits.pop(slug, None)
        time.sleep(1.2)   # on reste sous la limite de débit

    # on ne garde que les crédits dont la photo existe vraiment
    credits = {k: v for k, v in credits.items()
               if os.path.exists(os.path.join(IMG, k + ".jpg"))}

    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(credits, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    page_revision(recettes, credits)
    print("\n%d photos sur %d." % (len(credits), len(recettes)))
    print("Ouvre revision-photos.html pour approuver avant de pousser.")


if __name__ == "__main__":
    main()
