// Snapshot the zone 0 offline research (the LLM knowledge base) for the "Inside a run" page.
//
//   cd web && npm run sync:zone0
//
// Reads ../starter-kit/knowledge (written by the agent's research pipeline: one dossier per supplier,
// the playbook, the build index) and writes src/data/zone0.json with what the page shows: per
// supplier each stage's output (specialists, lead strategy, red team, rebuttals, validation, argument
// library) and, per build, model, calls, tokens, cost and time per stage. No arena or model calls.

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REPO, WEB } from "./lib/package.mjs";

const KNOW = path.join(REPO, "starter-kit", "knowledge");
const OUT = path.join(WEB, "src", "data", "zone0.json");
const cut = (s, n = 260) => (typeof s === "string" && s.length > n ? `${s.slice(0, n - 1)}…` : (s ?? ""));
const read = async (p) => JSON.parse(await readFile(p, "utf8"));

if (!existsSync(path.join(KNOW, "index.json"))) {
  await writeFile(OUT, JSON.stringify({ synced_at: new Date().toISOString(), available: false, suppliers: {}, build: null, playbook: null }) + "\n");
  console.log("no starter-kit/knowledge/index.json: wrote an empty snapshot");
  process.exit(0);
}

const index = await read(path.join(KNOW, "index.json"));
// The build that covered the most suppliers is the full one; its usage gives the per-stage averages.
const full = [...index.runs].sort((a, b) => (b.built?.length ?? 0) - (a.built?.length ?? 0))[0];
const stages = {};
for (const [k, v] of Object.entries(full?.usage ?? {})) {
  const calls = v.calls ?? 0;
  const cached = v.cached ?? 0;
  stages[k] = {
    calls,
    cached,
    input_tokens: v.input_tokens ?? 0,
    output_tokens: v.output_tokens ?? 0,
    usd: v.usd ?? 0,
    seconds: v.seconds ?? 0,
    avg_seconds: (v.seconds ?? 0) / Math.max(1, calls - cached),
  };
}

const finding = (f) => ({ text: cut(f.text, 240), importance: f.importance ?? null, evidence: (f.evidence ?? []).slice(0, 4) });
const suppliers = {};
for (const file of (await readdir(path.join(KNOW, "suppliers"))).filter((f) => f.endsWith(".json"))) {
  const d = await read(path.join(KNOW, "suppliers", file));
  const args = d.arguments ?? [];
  const byId = Object.fromEntries(args.map((a) => [a.arg_id, a]));
  const kinds = {};
  for (const a of args) kinds[a.kind] = (kinds[a.kind] ?? 0) + 1;
  const sp = d.specialists ?? {};
  const st = d.strategy ?? {};
  suppliers[d.supplier_id] = {
    name: d.name,
    meta: d.meta ?? {},
    library: {
      total: args.length,
      for_us: args.filter((a) => a.side === "for_us").length,
      for_them: args.filter((a) => a.side === "for_them").length,
      checkable: args.filter((a) => a.checkable).length,
      kinds: Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 8),
      examples: args.filter((a) => a.side === "for_us" && a.checkable).slice(0, 3).map((a) => ({ id: a.arg_id, sentence: cut(a.sentence, 220), refs: a.refs ?? [] })),
    },
    specialists: Object.fromEntries(
      ["economics", "persona", "contract", "performance"].map((k) => [
        k,
        sp[k]
          ? {
              leverage: sp[k].leverage ?? null,
              findings: (sp[k].findings ?? []).slice(0, 3).map(finding),
              wants: (sp[k].supplier_wants ?? []).slice(0, 3).map((x) => cut(typeof x === "string" ? x : (x.text ?? JSON.stringify(x)), 140)),
              arguments: (sp[k].useful_arguments ?? []).length,
              question: cut(typeof sp[k].open_questions?.[0] === "string" ? sp[k].open_questions[0] : (sp[k].open_questions?.[0]?.text ?? ""), 160),
            }
          : null,
      ]),
    ),
    strategy: {
      summary: cut(st.summary, 320),
      decision_maker: cut(st.decision_maker, 180),
      persona: st.persona ? { style: cut(st.persona.style, 180), openness: st.persona.openness ?? null, traits: (st.persona.traits ?? []).slice(0, 6) } : null,
      needs: (st.needs ?? []).slice(0, 4).map((n) => ({ need: n.need, strength: n.strength ?? null, detail: cut(n.detail, 160), evidence: (n.evidence ?? []).slice(0, 3) })),
      constraints: (st.constraints ?? []).slice(0, 3).map((c) => ({ kind: c.kind, detail: cut(c.detail, 160) })),
      levers: (st.levers ?? []).slice(0, 6).map((l) => ({
        arg_id: l.arg_id,
        when: l.when ?? null,
        why: cut(l.why, 160),
        sentence: cut(byId[l.arg_id]?.sentence ?? "", 200),
        kind: byId[l.arg_id]?.kind ?? null,
      })),
      levers_total: (st.levers ?? []).length,
      trades: (st.trades ?? []).slice(0, 4).map((t) => ({ field: t.field, direction: t.direction ?? null, why: cut(t.why, 150) })),
      price_view: st.price_view ? { room: st.price_view.room ?? null, squeeze_risk: st.price_view.squeeze_risk ?? null, reasoning: cut(st.price_view.reasoning, 220) } : null,
      tone: st.tone ? { style: st.tone.style ?? null, do: (st.tone.do ?? []).slice(0, 3).map((x) => cut(x, 120)), dont: (st.tone.dont ?? []).slice(0, 3).map((x) => cut(x, 120)) } : null,
      traps: (st.traps ?? []).slice(0, 4).map((x) => cut(typeof x === "string" ? x : (x.text ?? JSON.stringify(x)), 140)),
      traps_total: (st.traps ?? []).length,
    },
    red_team: d.red_team
      ? {
          arguments: (d.red_team.arguments ?? []).slice(0, 3).map((a) => ({ text: cut(a.text, 220), strength: a.strength ?? null, evidence: (a.evidence ?? []).slice(0, 3) })),
          total: (d.red_team.arguments ?? []).length,
          wants: (d.red_team.wants ?? []).slice(0, 3).map((x) => cut(typeof x === "string" ? x : (x.text ?? JSON.stringify(x)), 140)),
          red_lines: (d.red_team.red_lines ?? []).slice(0, 3).map((x) => cut(typeof x === "string" ? x : (x.text ?? JSON.stringify(x)), 140)),
        }
      : null,
    rebuttals: d.rebuttals
      ? {
          answers: (d.rebuttals.rebuttals ?? []).slice(0, 3).map((r) => ({ to: r.to ?? null, answer: cut(r.answer, 220), arg_ids: (r.arg_ids ?? []).slice(0, 4) })),
          total: (d.rebuttals.rebuttals ?? []).length,
          press: (d.rebuttals.press ?? []).slice(0, 2).map((x) => cut(typeof x === "string" ? x : (x.text ?? JSON.stringify(x)), 160)),
        }
      : null,
    validation: { dropped: (d.validation?.dropped ?? []).map((x) => ({ where: x.where, why: x.why, value: cut(x.value, 120) })) },
  };
}

let playbook = null;
if (existsSync(path.join(KNOW, "playbook.json"))) {
  const p = await read(path.join(KNOW, "playbook.json"));
  const g = p.general ?? {};
  playbook = {
    lessons: (g.lessons ?? []).length,
    sections: Object.keys(g),
    cases: Object.keys(p.cases ?? {}),
    runs: Object.values(p.meta?.cases ?? {}).reduce((s, c) => s + (c.runs ?? 0), 0),
    examples: (g.lessons ?? []).slice(0, 3).map((x) => cut(typeof x === "string" ? x : (x.rule ?? x.lesson ?? x.text ?? JSON.stringify(x)), 180)),
  };
}

await writeFile(
  OUT,
  JSON.stringify({
    synced_at: new Date().toISOString(),
    available: true,
    build: full
      ? { when: full.when, model: full.model, effort: full.effort, suppliers: full.built?.length ?? 0, failed: Object.keys(full.failed ?? {}).length, seconds: full.seconds, stages }
      : null,
    suppliers,
    playbook,
  }) + "\n",
);
console.log(`${Object.keys(suppliers).length} dossiers, build of ${full?.built?.length ?? 0} suppliers -> ${path.relative(WEB, OUT)}`);
