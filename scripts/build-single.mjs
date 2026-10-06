// Costruisce l'app in UN solo file (dist-single/index.html), funziona su Windows, Mac e Linux.
import { spawnSync } from "node:child_process";
const r = spawnSync("npx", ["vite", "build"], { stdio: "inherit", shell: true, env: { ...process.env, SINGLE: "1" } });
process.exit(r.status ?? 1);
