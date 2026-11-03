/* Petit serveur de fichiers, pour tester le site comme s'il était en ligne
   (les données sont chargées par fetch : file:// ne suffit pas). */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".css": "text/css; charset=utf-8"
};

export function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

/* Petit cadre de vérifications partagé. */
export function journal() {
  const resultats = [];
  const check = (nom, pass, detail = "") => {
    resultats.push({ nom, pass });
    console.log(`${pass ? "  ok  " : " ÉCHEC"}  ${nom}${detail ? "  — " + detail : ""}`);
  };
  const bilan = () => {
    const rates = resultats.filter((r) => !r.pass);
    console.log(`\n${resultats.length - rates.length}/${resultats.length} vérifications passées`);
    return rates.length;
  };
  return { check, bilan };
}
