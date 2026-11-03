/* Ton bar · service worker
   Met le site, les données et les photos en cache pour un usage hors ligne.
   Bump VERSION à chaque déploiement pour forcer le renouvellement du cache. */

const VERSION = "ton-bar-v3";
const SHELL_CACHE = VERSION + "-shell";
const RUNTIME_CACHE = VERSION + "-runtime";

/* Chemins relatifs : le site vit sous /bar-50-ans/ sur GitHub Pages,
   mais doit aussi fonctionner servi à la racine. */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./data/ingredients.json",
  "./data/recettes.json",
  "./data/credits.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/* Les photos ne sont pas listées en dur : on lit data/credits.json,
   dont chaque entrée correspond à img/<slug>.jpg. */
async function photoList() {
  try {
    const res = await fetch("./data/credits.json", { cache: "no-cache" });
    if (!res.ok) return [];
    const credits = await res.json();
    return Object.keys(credits).map((slug) => "./img/" + slug + ".jpg");
  } catch (e) {
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const urls = SHELL.concat(await photoList());
      // addAll échoue en bloc : on tolère les absences (une photo pas encore poussée).
      await Promise.all(urls.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Réseau d'abord, cache en secours : pour la page elle-même,
   pour qu'une nouvelle version arrive dès qu'il y a du réseau. */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const hit = (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw e;
  }
}

/* Cache d'abord, rafraîchi en arrière-plan : pour les données, icônes et photos. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // On garde aussi les réponses opaques (polices Google, type "cors" absent).
      if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  throw new Error("hors ligne et absent du cache : " + request.url);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return; // on ne touche à rien d'autre

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "./index.html"));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, isFont ? RUNTIME_CACHE : SHELL_CACHE));
});
