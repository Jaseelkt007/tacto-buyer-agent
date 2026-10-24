// Zone 0, the offline research, as playback frames for the "Inside a run" page: how one supplier's
// dossier is built before any session opens, stage by stage, with what each stage produced.
//
// Timing: each model stage uses its average seconds per call over the full build (index.json usage);
// the four specialists run in parallel. The real build runs suppliers in parallel too; an RFQ's
// suppliers are shown one after another here. Engine v1.7c does not read these files yet.

import raw from "@/data/zone0.json";
import type { PipeFrame } from "./pipeline";

type Finding = { text: string; importance: string | null; evidence: string[] };
type Specialist = { leverage: string | null; findings: Finding[]; wants: string[]; arguments: number; question: string } | null;

export type Dossier = {
  name: string;
  meta: { model?: string; effort?: string; built?: string; seconds?: number; evidence_chars?: number; arguments?: number };
  library: { total: number; for_us: number; for_them: number; checkable: number; kinds: [string, number][]; examples: { id: string; sentence: string; refs: string[] }[] };
  specialists: Record<"economics" | "persona" | "contract" | "performance", Specialist>;
  strategy: {
    summary: string;
    decision_maker: string;
    persona: { style: string; openness: string | null; traits: string[] } | null;
    needs: { need: string; strength: string | null; detail: string; evidence: string[] }[];
    constraints: { kind: string; detail: string }[];
    levers: { arg_id: string; when: string | null; why: string; sentence: string; kind: string | null }[];
    levers_total: number;
    trades: { field: string; direction: string | null; why: string }[];
    price_view: { room: string | null; squeeze_risk: string | null; reasoning: string } | null;
    tone: { style: string | null; do: string[]; dont: string[] } | null;
    traps: string[];
    traps_total: number;
  };
  red_team: { arguments: { text: string; strength: string | null; evidence: string[] }[]; total: number; wants: string[]; red_lines: string[] } | null;
  rebuttals: { answers: { to: number | null; answer: string; arg_ids: string[] }[]; total: number; press: string[] } | null;
  validation: { dropped: { where: string; why: string; value: string }[] };
};

type Stage = { calls: number; cached: number; input_tokens: number; output_tokens: number; usd: number; seconds: number; avg_seconds: number };

export const zone0 = raw as unknown as {
  synced_at: string;
  available: boolean;
  build: { when: string; model: string; effort: string; suppliers: number; failed: number; seconds: number; stages: Record<string, Stage> } | null;
  suppliers: Record<string, Dossier>;
  playbook: { lessons: number; sections: string[]; cases: string[]; runs: number; examples: string[] } | null;
};

const SPECIALISTS = ["economics", "persona", "contract", "performance"] as const;
const short = (name: string) => name.split(" ").slice(0, 2).join(" ");

export type Zone0Run = {
  available: boolean;
  frames: PipeFrame[];
  stats: [string, string, string][];
  seconds: number;
};

export function buildZone0(supplierIds: string[]): Zone0Run {
  const b = zone0.build;
  const ds = supplierIds.map((id) => ({ id, d: zone0.suppliers[id] })).filter((x): x is { id: string; d: Dossier } => !!x.d);
  if (!zone0.available || !b || !ds.length) return { available: false, frames: [], stats: [], seconds: 0 };
  const avg = (k: string) => b.stages[k]?.avg_seconds ?? 20;
  const frames: PipeFrame[] = [];
  let t = 0;
  const push = (f: Omit<PipeFrame, "t" | "round">, advance = f.dur) => {
    frames.push({ ...f, t, round: 0 });
    t += advance;
  };

  for (const [k, { id, d }] of ds.entries()) {
    const who = short(d.name);
    const label = ds.length > 1 ? `${who} (supplier ${k + 1} of ${ds.length})` : who;
    push({
      node: "r_tables",
      stage: "evidence",
      label: `Collect evidence · ${label}`,
      dur: 0.02,
      log: `Offline, before any session: research ${d.name} (${id})`,
      state: [`${d.name}`, "Every table row about this supplier and its parts, with citable IDs"],
    }, 0.01);
    for (const n of ["r_letters", "r_contracts", "r_perf", "r_facts"]) {
      push({ node: n, stage: "evidence", label: `Collect evidence · ${label}`, dur: 0.01, log: `Reading ${n === "r_letters" ? "letters, call and meeting notes, news" : n === "r_contracts" ? "contracts, clauses, past negotiations" : n === "r_perf" ? "scorecards, quality notifications, orders" : "facts and index series"}` }, 0.005);
    }
    push({
      node: "evidence",
      from: "r_tables",
      stage: "evidence",
      label: `Evidence pack · ${label}`,
      dur: 0.05,
      log: `Evidence pack: ${(d.meta.evidence_chars ?? 0).toLocaleString("en-GB")} characters, every row with its ID (code, no model)`,
      state: [`${(d.meta.evidence_chars ?? 0).toLocaleString("en-GB")} characters of evidence`, "Built by code (research/evidence.py); each specialist gets its own slice"],
    });
    push({
      node: "library",
      from: "evidence",
      stage: "library",
      label: `Argument library · ${label}`,
      dur: 0.05,
      log: `Argument library: ${d.library.total} arguments (${d.library.for_us} for us, ${d.library.for_them} the supplier could use), figures computed by code`,
      state: [
        `${d.library.total} arguments: ${d.library.for_us} for us, ${d.library.for_them} for them; ${d.library.checkable} checkable by the arena`,
        `Kinds: ${d.library.kinds.map(([kind, n]) => `${kind.replace(/_/g, " ")} ${n}`).join(", ")}`,
        ...d.library.examples.slice(0, 2).map((e) => `“${e.sentence}”`),
      ],
    });
    const t0 = t;
    for (const s of SPECIALISTS) {
      const sp = d.specialists[s];
      frames.push({
        t: t0,
        dur: avg(`specialist:${s}`),
        node: s,
        from: "evidence",
        round: 0,
        stage: "specialists",
        label: `Four specialists in parallel · ${label}`,
        log: sp
          ? `${s[0].toUpperCase() + s.slice(1)} specialist (Opus 5.5): leverage ${sp.leverage ?? "—"}; ${sp.findings[0]?.text ?? ""}`
          : `${s} specialist: no output`,
        state: sp
          ? [`Leverage: ${sp.leverage ?? "—"} · ${sp.arguments} useful arguments picked`, ...sp.findings.slice(0, 2).map((f) => `${f.importance === "high" ? "● " : ""}${f.text}`), ...(sp.question ? [`Open question: ${sp.question}`] : [])]
          : ["No output"],
      });
    }
    t = t0 + Math.max(...SPECIALISTS.map((s) => avg(`specialist:${s}`)));
    const st = d.strategy;
    push({
      node: "lead",
      from: "economics",
      stage: "lead",
      label: `Lead strategist · ${label}`,
      dur: avg("lead"),
      log: `Lead strategist (Opus 5.5) merges the four: ${st.summary}`,
      state: [
        st.summary,
        `Decides: ${st.decision_maker}`,
        st.price_view ? `Room on price: ${st.price_view.room ?? "—"} · squeeze risk: ${st.price_view.squeeze_risk ?? "—"}` : "",
        ...st.needs.slice(0, 2).map((n) => `Needs ${n.need} (${n.strength ?? "—"}): ${n.detail}`),
        ...st.levers.slice(0, 3).map((l, i) => `Lever ${i + 1} (${l.when ?? "—"}): ${l.kind?.replace(/_/g, " ") ?? l.arg_id}: ${l.why}`),
        st.tone ? `Tone: ${st.tone.style ?? "—"}` : "",
      ].filter(Boolean),
    });
    const rt = d.red_team;
    push({
      node: "redteam",
      from: "lead",
      stage: "redteam",
      label: `Red team · ${label}`,
      dur: avg("red_team"),
      log: rt ? `Red team (Opus 5.5) plays ${who}: ${rt.total} arguments it would bring; strongest: ${rt.arguments[0]?.text ?? ""}` : "Red team: no output",
      state: rt ? [...rt.arguments.slice(0, 2).map((a) => `${a.strength ?? ""}: ${a.text}`), ...rt.red_lines.slice(0, 1).map((r) => `Red line: ${r}`)] : ["No output"],
      tone: "warn",
    });
    const rb = d.rebuttals;
    push({
      node: "rebuttals",
      from: "redteam",
      stage: "rebuttals",
      label: `Rebuttals · ${label}`,
      dur: avg("rebuttals"),
      log: rb ? `Rebuttals (Opus 5.5): ${rb.total} answers without figures; first: ${rb.answers[0]?.answer ?? ""}` : "Rebuttals: no output",
      state: rb ? rb.answers.slice(0, 2).map((a) => `To argument ${a.to ?? "?"}: ${a.answer}${a.arg_ids.length ? ` [${a.arg_ids.length} library arguments]` : ""}`) : ["No output"],
    });
    const dropped = d.validation.dropped;
    push({
      node: "validator",
      from: "rebuttals",
      stage: "validate",
      label: `Validate · ${label}`,
      dur: 0.02,
      log: dropped.length ? `Validator (code) dropped ${dropped.length} model outputs: ${[...new Set(dropped.map((x) => x.why))].join(", ")}` : "Validator (code): nothing dropped",
      state: dropped.length ? dropped.map((x) => `Dropped ${x.where}: ${x.why}`) : ["Every ID exists; no figures in text the e-mail would use"],
      tone: dropped.length ? "warn" : "good",
    });
    push({
      node: "dossier",
      from: "validator",
      stage: "save",
      label: `Dossier saved · ${label}`,
      dur: 0.01,
      log: `Saved knowledge/suppliers/${id.replace(":", "_")}.json: ${st.levers_total} levers, ${st.trades.length} trades, ${st.traps_total} traps`,
      state: [
        `knowledge/suppliers/${id.replace(":", "_")}.json`,
        `${st.levers_total} levers in order, ${st.trades.length} trades, ${st.traps_total} traps`,
        ...st.traps.slice(0, 2).map((x) => `Trap: ${x}`),
        `Built ${d.meta.built ?? "—"} with ${d.meta.model ?? "—"} (effort ${d.meta.effort ?? "—"})`,
      ],
      tone: "good",
    });
  }
  if (zone0.playbook) {
    push({
      node: "playbook",
      from: "r_facts",
      stage: "playbook",
      label: "Playbook (once for all suppliers)",
      dur: 0.02,
      log: `Playbook: ${zone0.playbook.lessons} lessons mined from ${zone0.playbook.runs} practice runs of ${zone0.playbook.cases.length} practice cases`,
      state: [
        `${zone0.playbook.lessons} lessons from ${zone0.playbook.runs} practice runs`,
        `Also stores notes per practice case (${zone0.playbook.cases.length}): those cannot transfer to the final's unseen cases`,
        ...zone0.playbook.examples.slice(0, 2).map((x) => `“${x}”`),
      ],
      tone: "warn",
    });
  }
  push({
    node: "engine",
    from: "dossier",
    stage: "live",
    label: "Handed to the live engine?",
    dur: 0.01,
    log: "Engine v1.7c does not read zone 0 yet: the negotiation in tab 2 is decided by the code engine alone",
    state: ["Not read by engine v1.7c (no live code imports knowledge/)", "Planned next: zone 1, a case strategist at wave start that turns the dossier into bounded parameters"],
    tone: "warn",
  });

  const stages = Object.entries(b.stages).filter(([k]) => k !== "total");
  const calls = stages.reduce((s, [, v]) => s + v.calls - v.cached, 0);
  const usd = stages.reduce((s, [, v]) => s + v.usd, 0);
  const dropped = ds.reduce((s, x) => s + x.d.validation.dropped.length, 0);
  return {
    available: true,
    frames,
    seconds: t,
    stats: [
      [`${ds.length * 7}`, "model calls for this case", `${ds.length} supplier${ds.length > 1 ? "s" : ""} × 7 (Opus 5.5, effort ${b.effort})`],
      [`${Math.round(t)} s`, "offline, before the session", "average stage times of the build"],
      [`${ds.reduce((s, x) => s + x.d.library.total, 0)}`, "arguments in the library", "figures computed by code"],
      [`${dropped}`, "model outputs dropped", "by the code validator"],
      [`${b.suppliers}`, "suppliers researched", `${calls} calls, $${usd.toFixed(2)}, ${Math.round(b.seconds)} s wall`],
      ["0", "moves that use it", "engine v1.7c does not read it yet"],
    ],
  };
}
