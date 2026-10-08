// Costruisce l'app in UN solo file (dist-single/index.html), funziona su Windows, Mac e Linux.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
const r = spawnSync("npx", ["vite", "build"], { stdio: "inherit", shell: true, env: { ...process.env, SINGLE: "1" } });
if (r.status === 0) {
  // sara-gest.html: da scaricare e aprire con un doppio clic. docs/index.html: la stessa pagina, per GitHub Pages
  // (Settings -> Pages -> cartella /docs), cosi' si apre anche dal telefono con un indirizzo.
  mkdirSync("docs", { recursive: true });
  copyFileSync("dist-single/index.html", "sara-gest.html");
  copyFileSync("dist-single/index.html", "docs/index.html");
}
process.exit(r.status ?? 1);
