// Copy the data package's citable facts for the Facts section.
//
//   cd web && npm run sync:facts
//
// data/facts.json holds every ID the arena checks claims against, with the values it checks. It is
// served as public/facts.json and loaded by the browser only on the Facts page. No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB } from "./lib/package.mjs";

const facts = JSON.parse(await readFile(path.join(DATA, "facts.json"), "utf8"));
await writeFile(path.join(WEB, "public", "facts.json"), JSON.stringify(facts));
console.log(`${Object.keys(facts).length} facts -> public/facts.json`);
