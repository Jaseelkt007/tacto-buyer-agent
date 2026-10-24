// Snapshot the negotiation runs our benchmark saved, for the negotiation replay UI.
//
//   cd web && npm run sync:runs
//
// scripts/bench.py writes one JSON per played session to runs/<case>/<stamp>_<agent>_<session>.json:
// the arena's trace (every e-mail both ways, claim checks, the supplier's reasons), the supplier's
// back-office chatter, and our engine's decision log per move. By default it reads runs/ on
// origin/main via git, so the web branch shows the agent's latest runs after a `git fetch`;
// RUNS_DIR=../runs reads a local folder instead. It never calls the arena: no key, no quota.

import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(WEB, "..");
const OUT_JSON = path.join(WEB, "src", "data", "runs.json");
const REF = process.env.RUNS_REF || "origin/main";
const DIR = process.env.RUNS_DIR ? path.resolve(WEB, process.env.RUNS_DIR) : null;

const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

async function sources() {
  const dir = DIR;
  if (dir) {
    const out = [];
    for (const c of await readdir(dir)) {
      if (c.startsWith(".")) continue;
      for (const f of await readdir(path.join(dir, c)).catch(() => [])) {
        if (f.endsWith(".json")) out.push({ name: `runs/${c}/${f}`, read: () => readFile(path.join(dir, c, f), "utf8") });
      }
    }
    return { from: path.relative(REPO, dir) + "/", files: out };
  }
  const names = git("ls-tree", "-r", "--name-only", REF, "runs/")
    .split("\n")
    .filter((n) => n.endsWith(".json"));
  return { from: `${REF}:runs/`, files: names.map((n) => ({ name: n, read: async () => git("show", `${REF}:${n}`) })) };
}

const { from, files } = await sources();
const runs = [];
for (const f of files) {
  // Python's json writes Infinity / NaN (e.g. no ceiling when a case has no alternative).
  const d = JSON.parse((await f.read()).replace(/(?<=[:[,]\s*)-?(?:Infinity|NaN)(?=\s*[,\]}])/g, "null"));
  const s = d.session ?? {};
  const { trace = [], ...result } = s.result ?? d.result ?? {};
  runs.push({
    file: f.name,
    case_id: d.case_id,
    agent: d.agent,
    note: d.note ?? "",
    commit: d.commit ?? null,
    when: d.when,
    seconds: d.seconds ?? null,
    session_id: d.session_id ?? s.session_id,
    replay_url: s.replay_url ?? null,
    end_reason: s.end_reason ?? null,
    rounds: s.rounds ?? null,
    result,
    trace,
    decisions: d.decisions ?? [],
    backoffice: d.backoffice ?? [],
  });
}
runs.sort((a, b) => a.case_id.localeCompare(b.case_id) || a.when.localeCompare(b.when));

await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify({ synced_at: new Date().toISOString(), source: from, runs }) + "\n");
console.log(`${runs.length} runs from ${from} -> ${path.relative(WEB, OUT_JSON)}`);
