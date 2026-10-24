"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Frame, LiveRun, NodeId } from "@/lib/live";

type Kind = "data" | "code" | "model" | "arena" | "supplier" | "result";

const KIND: Record<Kind, { label: string; color: string }> = {
  data: { label: "Data package", color: "var(--s-ours)" },
  code: { label: "Our code", color: "var(--s-3)" },
  model: { label: "Language model (fallback only)", color: "var(--s-model)" },
  arena: { label: "Arena", color: "var(--ink-2)" },
  supplier: { label: "Supplier bot", color: "var(--s-supplier)" },
  result: { label: "Result", color: "var(--accent)" },
};

// Where each part sits on the 1010 × 440 canvas, and what it is.
const NODES: Record<NodeId, { x: number; y: number; w?: number; h?: number; kind: Kind; title: string; sub: string; when: string; reads: string; returns: string; check: string }> = {
  case: { x: 20, y: 20, kind: "data", title: "Case file", sub: "need · goal · options", when: "When the session opens", reads: "The arena's case: need, horizon, goal, rates, negotiable fields and their options, must-haves, alternative", returns: "The rules and prices every cost is computed with", check: "Fixed by the arena; never changed by the agent" },
  quote: { x: 20, y: 100, kind: "data", title: "Quote PDFs", sub: "standard terms", when: "With each supplier's opening quote", reads: "Each supplier's quote PDF", returns: "Its standard terms: what closes for any field a term sheet leaves out", check: "Parsed line by line; a line that cannot be read is skipped" },
  tables: { x: 20, y: 180, kind: "data", title: "Data tables", sub: "suppliers · should-cost · POs", when: "Before the first move", reads: "SQLite: suppliers, supplier_intel, should_cost, scorecards, contracts, forecasts", returns: "Owner type, full-cost estimate, delivery and quality record", check: "Read only; all IDs exist in the data package" },
  letters: { x: 20, y: 260, kind: "data", title: "Letters & news", sub: "correspondence", when: "Before the first move", reads: "The supplier's letters, e-mails, our call and meeting notes, press", returns: "Text the dossier scans for what the supplier wants", check: "Read only" },
  facts: { x: 20, y: 340, kind: "data", title: "Facts & indices", sub: "10,356 citable IDs", when: "Before the first move", reads: "facts.json and the index series", returns: "IDs and values the claim bank may cite", check: "Only IDs in facts.json are cited; an unknown ID is contradicted" },
  reader: { x: 230, y: 100, kind: "code", title: "Quote reader", sub: "quote.py", when: "Once per quote", reads: "Quote PDF text", returns: "Standard terms per supplier", check: "Tolerant: unreadable lines are logged and skipped" },
  dossier: { x: 230, y: 220, kind: "code", title: "Dossier", sub: "dossier.py", when: "Once per supplier, at setup", reads: "Data tables, letters and news", returns: "Full cost, what money is worth to it, cash / work / capacity signals", check: "Every later offer caps the full-cost estimate (it never sells below its floor)" },
  claims: { x: 230, y: 340, kind: "code", title: "Claim bank", sub: "claims.py", when: "At setup; one or more per message", reads: "Facts, indices, contracts, scorecards, forecasts, rival offers", returns: "One-sentence arguments, figure next to the IDs, strongest first", check: "Figures computed the way the arena checks them; each ID once per case" },
  economics: { x: 430, y: 40, kind: "code", title: "Economics", sub: "economics.py · cost.py", when: "At setup, and for every sheet", reads: "Case file, standard terms, dossier", returns: "Total cost C of any sheet, walk-away limit, ceiling, anchor, best term mix", check: "The kit's published cost function; the deal anatomy matches the arena on every deal" },
  policy: { x: 430, y: 180, kind: "code", title: "Policy", sub: "policy.py · decide()", when: "Every time a supplier answers", reads: "Its offer, the arena's verdicts, our plan", returns: "Accept, walk away, or a counter: price, sheets, arguments", check: "Accept only if C beats the limit, must-haves hold, and it is the standing offer" },
  llm: { x: 430, y: 320, kind: "model", title: "LLM fallback", sub: "kit LLM agent", when: "Only if the engine raises an error", reads: "The conversation so far", returns: "A move written by a language model", check: "Used rarely; the replay marks every such move" },
  writer: { x: 630, y: 250, kind: "code", title: "Writer", sub: "writer.py", when: "With every counter", reads: "The decision and its arguments", returns: "The e-mail: thanks, one argument per sentence, the term sheets", check: "No figures outside claims; no urgency, budget or missing alternative" },
  arena: { x: 630, y: 110, kind: "arena", title: "Arena", sub: "routing · claim checks", when: "Every message", reads: "Our e-mail and term sheets", returns: "Verdict per argument (≤ 3): verified, duplicate, irrelevant, contradicted", check: "Tolerance ±0.5 percentage points for %, else ±0.5 %" },
  clock: { x: 630, y: 20, h: 50, kind: "arena", title: "60 s clock", sub: "per message", when: "From each supplier reply", reads: "Time to our next move", returns: "Timeout if we are late", check: "Three timeouts in a row end the thread" },
  sales: { x: 830, y: 110, kind: "supplier", title: "Supplier: sales", sub: "writes the replies", when: "After each of our messages", reads: "Our e-mail, its back office", returns: "A counter, final offer, agreement, or walking away", check: "Its prices come from its own cost and capacity data" },
  office: { x: 830, y: 250, kind: "supplier", title: "Supplier: back office", sub: "owner · finance · logistics", when: "Before sales answers", reads: "Questions from sales", returns: "Sign-offs and answers", check: "Each department sees only its own data" },
  score: { x: 630, y: 370, h: 52, kind: "result", title: "Score", sub: "total cost → 0–100", when: "When the case ends", reads: "The accepted sheet, or no deal", returns: "C of the deal and the score", check: "score = (C_open − C_deal) ÷ (C_open − C_best), clipped to 0–1" },
};
const W = 160;
const H = 58;

const EDGES: [NodeId, NodeId][] = [
  ["case", "economics"],
  ["quote", "reader"],
  ["reader", "economics"],
  ["tables", "dossier"],
  ["letters", "dossier"],
  ["dossier", "economics"],
  ["facts", "claims"],
  ["claims", "policy"],
  ["economics", "policy"],
  ["arena", "policy"],
  ["policy", "writer"],
  ["llm", "writer"],
  ["writer", "arena"],
  ["arena", "sales"],
  ["office", "sales"],
  ["sales", "arena"],
  ["policy", "arena"],
  ["arena", "score"],
  ["sales", "quote"],
];

const ROWS: { label: string; nodes: NodeId[] }[] = [
  { label: "Data", nodes: ["case", "quote", "tables", "letters", "facts"] },
  { label: "Quote reader", nodes: ["reader"] },
  { label: "Dossier", nodes: ["dossier"] },
  { label: "Claim bank", nodes: ["claims"] },
  { label: "Economics", nodes: ["economics"] },
  { label: "Policy", nodes: ["policy"] },
  { label: "LLM fallback", nodes: ["llm"] },
  { label: "Writer", nodes: ["writer"] },
  { label: "Arena", nodes: ["arena", "clock", "score"] },
  { label: "Supplier sales", nodes: ["sales"] },
  { label: "Supplier back office", nodes: ["office"] },
];

function edgePath(a: NodeId, b: NodeId) {
  const A = NODES[a];
  const B = NODES[b];
  const ah = A.h ?? H;
  const bh = B.h ?? H;
  const forward = B.x > A.x;
  const same = B.x === A.x;
  if (same) {
    const x = A.x + W / 2;
    const y1 = B.y > A.y ? A.y + ah : A.y;
    const y2 = B.y > A.y ? B.y : B.y + bh;
    return `M${x},${y1} L${x},${y2}`;
  }
  const x1 = forward ? A.x + W : A.x;
  const x2 = forward ? B.x : B.x + W;
  const y1 = A.y + ah / 2;
  const y2 = B.y + bh / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

const fmtT = (t: number) => (t < 10 ? t.toFixed(2) : t.toFixed(1));

export function LivePipeline({
  live,
  runs,
  scenarios,
  links,
}: {
  live: LiveRun;
  runs: { id: string; label: string }[];
  scenarios: { label: string; id: string }[];
  links: Partial<Record<NodeId, string>>;
}) {
  const router = useRouter();
  const frames = live.frames;
  const n = frames.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [picked, setPicked] = useState<NodeId | null>(null);
  const f: Frame = frames[Math.min(i, n - 1)];
  const go = useCallback((k: number) => setI(Math.max(0, Math.min(n - 1, k))), [n]);

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) {
      queueMicrotask(() => setPlaying(false));
      return;
    }
    const id = setTimeout(() => go(i + 1), 1100 / speed);
    return () => clearTimeout(id);
  }, [playing, i, n, speed, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  // What each node has shown so far, and which nodes have run.
  const { states, visited } = useMemo(() => {
    const st: Partial<Record<NodeId, { round: number; lines: string[] }[]>> = {};
    const v = new Set<NodeId>();
    for (const x of frames.slice(0, i + 1)) {
      v.add(x.node);
      if (x.from) v.add(x.from);
      if (x.state?.length) (st[x.node] ??= []).push({ round: x.round, lines: x.state });
    }
    return { states: st, visited: v };
  }, [frames, i]);

  const sel: NodeId = picked ?? f.node;
  const info = NODES[sel];
  const total = Math.max(live.seconds, ...frames.map((x) => x.t + x.dur));
  const roundStarts = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of frames) if (x.stage === "round" && !m.has(x.round)) m.set(x.round, x.t);
    return [...m.entries()];
  }, [frames]);
  const stageLabel = f.stage === "open" ? "Session opens" : f.stage === "prepare" ? "Prepare" : f.stage === "close" ? "Case closed" : f.round === 0 ? "Round 0: first counter" : `Round ${f.round}`;
  const btn = "rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12.5px] font-medium hover:bg-[var(--hover)] disabled:opacity-40";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          [`${live.decisions - live.llmMoves} of ${live.decisions}`, "moves decided by code", live.llmMoves ? `${live.llmMoves} by the LLM fallback` : "no LLM fallback"],
          [`${live.ourMs.toFixed(0)} ms`, "our total thinking time", `vs a 60 s budget per message`],
          [`${fmtT(live.seconds)} s`, "the whole session", "measured wall time"],
          [`${live.rounds}`, "rounds", `${live.suppliers.length} supplier${live.suppliers.length > 1 ? "s" : ""}`],
          [`${live.argsVerified} / ${live.argsSent}`, "arguments verified", "checked by the arena"],
          [`${Math.round(live.score * 100)}`, "score", live.deal ? "deal signed" : "no deal"],
        ].map(([v, l, s]) => (
          <div key={l} className="min-w-0 border-t-2 border-[var(--ink)] pt-1.5">
            <div className="text-[22px] leading-tight font-semibold tabular-nums">{v}</div>
            <div className="text-[12px]">{l}</div>
            <div className="text-[11px] text-[var(--muted)]">{s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-[var(--ink-2)]">Suppliers</span>
        <div className="flex rounded border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/live/${s.id}`)}
              className={`rounded px-2 py-0.5 ${s.id === live.id ? "bg-[var(--ink)] text-[var(--page)]" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[var(--ink-2)]">Run</span>
        <select
          value={live.id}
          onChange={(e) => router.push(`/live/${e.target.value}`)}
          className="w-full min-w-0 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 sm:w-auto sm:max-w-md"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
        <button
          className="rounded bg-[var(--ink)] px-3 py-1 text-[12.5px] font-semibold text-[var(--page)] hover:opacity-90"
          onClick={() => (i >= n - 1 ? (go(0), setPlaying(true)) : setPlaying((p) => !p))}
        >
          {playing ? "❚❚ Pause" : i >= n - 1 ? "↻ Again" : "▶ Play"}
        </button>
        <button className={btn} onClick={() => (setPlaying(false), go(0))}>
          Restart
        </button>
        <button className={btn} onClick={() => go(i - 1)} disabled={i === 0} aria-label="Step back">
          ◀
        </button>
        <button className={btn} onClick={() => go(i + 1)} disabled={i >= n - 1} aria-label="Step forward">
          ▶
        </button>
        <div className="flex rounded border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {[1, 2, 5].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} className={`rounded px-2 py-0.5 ${speed === s ? "bg-[var(--ink)] text-[var(--page)]" : "text-[var(--ink-2)]"}`}>
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[12px] text-[var(--ink-2)]">
        <span>
          <strong className="text-[var(--ink)]">{stageLabel}</strong> · step {i + 1} / {n}
        </span>
        <span>
          t = <strong className="text-[var(--ink)]">{fmtT(f.t)} s</strong> · arguments checked so far:{" "}
          {frames.slice(0, i + 1).filter((x) => x.node === "arena" && x.log.startsWith("Arena checks")).length} messages
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_17rem]">
        <div className="min-w-0 overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
          <div className="relative" style={{ width: 1010, height: 440 }}>
            <svg width={1010} height={440} className="absolute inset-0" aria-hidden>
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--line)" />
                </marker>
                <marker id="arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
                </marker>
              </defs>
              {EDGES.map(([a, b]) => {
                const on = f.from === a && f.node === b;
                return (
                  <path
                    key={`${a}-${b}`}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={on ? "var(--accent)" : "var(--line)"}
                    strokeWidth={on ? 2.5 : 1.2}
                    className={on ? "flow" : undefined}
                    markerEnd={on ? "url(#arrow-on)" : "url(#arrow)"}
                  />
                );
              })}
              {f.from && !EDGES.some(([a, b]) => a === f.from && b === f.node) && (
                <path d={edgePath(f.from, f.node)} fill="none" stroke="var(--accent)" strokeWidth={2.5} className="flow" markerEnd="url(#arrow-on)" />
              )}
              <text x={20} y={432} fontSize={10.5} fill="var(--muted)">
                DATA
              </text>
              <text x={230} y={432} fontSize={10.5} fill="var(--muted)">
                OUR CODE: EVERY NUMBER
              </text>
              <text x={830} y={432} fontSize={10.5} fill="var(--muted)">
                SUPPLIER BOT
              </text>
            </svg>
            {(Object.keys(NODES) as NodeId[]).map((id) => {
              const nd = NODES[id];
              const active = f.node === id;
              const done = visited.has(id);
              const color = KIND[nd.kind].color;
              return (
                <button
                  key={id}
                  onClick={() => setPicked(picked === id ? null : id)}
                  className={`absolute rounded-md border text-left transition-all ${active ? "pulse-ring" : ""} ${sel === id ? "ring-2 ring-[var(--accent)]" : ""}`}
                  style={{
                    left: nd.x,
                    top: nd.y,
                    width: W,
                    height: nd.h ?? H,
                    borderColor: active || done ? color : "var(--line)",
                    background: active ? `color-mix(in oklab, ${color} 22%, var(--surface))` : done ? `color-mix(in oklab, ${color} 8%, var(--surface))` : "var(--surface)",
                    opacity: active || done ? 1 : 0.55,
                    borderLeftWidth: 4,
                  }}
                  title={`${nd.title}: click for details`}
                >
                  <span className="block px-2 pt-1 text-[12.5px] leading-tight font-semibold">{nd.title}</span>
                  <span className="block px-2 font-mono text-[10.5px] leading-tight text-[var(--ink-2)]">{nd.sub}</span>
                  {done && !active && <span className="absolute top-1 right-1.5 text-[10px] text-[var(--muted)]">done</span>}
                  {active && <span className="absolute top-1 right-1.5 text-[10px] font-semibold" style={{ color }}>now</span>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded px-1.5 py-px text-[10.5px] font-semibold text-white" style={{ background: KIND[info.kind].color }}>
              {KIND[info.kind].label.toUpperCase()}
            </span>
            {picked ? (
              <button onClick={() => setPicked(null)} className="text-[11px] text-[var(--accent-ink)] hover:underline">
                follow live
              </button>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">following live</span>
            )}
          </div>
          <div className="text-[15px] font-semibold">{info.title}</div>
          {[
            ["When", info.when],
            ["Reads", info.reads],
            ["Returns", info.returns],
            ["Checked by", info.check],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">{k}</div>
              <div>{v}</div>
            </div>
          ))}
          <div className="border-t border-[var(--line)] pt-2">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">In this run, so far</div>
            {states[sel]?.length ? (
              <ul className="mt-1 space-y-1">
                {states[sel]!.slice(-3).map((s, k) => (
                  <li key={k} className="rounded bg-[var(--surface-2)] px-2 py-1">
                    <div className="text-[10.5px] text-[var(--muted)]">round {s.round}</div>
                    {s.lines.map((l, j) => (
                      <div key={j} className="break-words">
                        {l}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[var(--muted)]">{visited.has(sel) ? "Ran, nothing to report." : "Has not run yet."}</p>
            )}
          </div>
          {links[sel] && (
            <Link href={links[sel]!} className="inline-block pt-1 font-medium text-[var(--accent-ink)] hover:underline">
              Open the full page →
            </Link>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
        {(Object.keys(KIND) as Kind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND[k].color }} />
            {KIND[k].label}
          </span>
        ))}
        <span>· the glowing box is working now; arrows light up as data moves; click any box</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[14px] font-semibold">Timeline</h3>
            <span className="text-[11px] text-[var(--muted)]">x = seconds since the session opened · our moves take milliseconds (drawn at minimum width)</span>
          </div>
          <div className="overflow-x-auto">
            <div className="relative min-w-[560px]">
              {ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-[8.5rem_1fr] items-center gap-2 py-[3px] text-[11.5px]">
                  <span className="truncate text-[var(--ink-2)]">{row.label}</span>
                  <div className="relative h-3.5 rounded-sm bg-[var(--surface-2)]">
                    {roundStarts.map(([r, t0]) => (
                      <span key={r} className="absolute inset-y-0 w-px bg-[var(--line)]" style={{ left: `${(t0 / total) * 100}%` }} />
                    ))}
                    {frames.slice(0, i + 1).map((x, k) =>
                      row.nodes.includes(x.node) ? (
                        <span
                          key={k}
                          className="absolute inset-y-0 rounded-sm"
                          style={{
                            left: `${(x.t / total) * 100}%`,
                            width: `max(3px, ${(x.dur / total) * 100}%)`,
                            background: x.tone === "bad" ? "var(--bad)" : KIND[NODES[x.node].kind].color,
                            opacity: k === i ? 1 : 0.75,
                          }}
                          title={x.log}
                        />
                      ) : null,
                    )}
                    <span className="absolute -inset-y-0.5 w-0.5 bg-[var(--ink)]" style={{ left: `${(f.t / total) * 100}%` }} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 pt-1 font-mono text-[10.5px] text-[var(--muted)]">
                <span />
                <div className="relative h-4">
                  {roundStarts
                    .filter(([, t0], k, arr) => k === 0 || (t0 - arr[k - 1][1]) / total > 0.04)
                    .map(([r, t0]) => (
                      <span key={r} className="absolute" style={{ left: `${(t0 / total) * 100}%` }}>
                        R{r}
                      </span>
                    ))}
                  <span className="absolute right-0">{fmtT(total)} s</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="min-w-0 space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <h3 className="text-[14px] font-semibold">
            Event log <span className="text-[11px] font-normal text-[var(--muted)]">newest first</span>
          </h3>
          <ol className="max-h-56 space-y-1 overflow-y-auto font-mono text-[11.5px]">
            {frames
              .slice(0, i + 1)
              .slice(-12)
              .reverse()
              .map((x, k) => (
                <li key={`${x.t}-${k}`} className={`flex gap-2 ${k === 0 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>
                  <span className="shrink-0 tabular-nums text-[var(--muted)]">{fmtT(x.t).padStart(5, " ")}s</span>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: x.tone === "bad" ? "var(--bad)" : x.tone === "good" ? "var(--good)" : KIND[NODES[x.node].kind].color }} />
                  <span className="min-w-0 break-words">{x.log}</span>
                </li>
              ))}
          </ol>
        </section>
      </div>
      <p className="text-[12px] text-[var(--muted)]">
        Replayed from the saved run log. Our decision times are measured; the session&apos;s total time is measured too, and the rest of it (the supplier
        thinking and the arena) is spread evenly over the supplier&apos;s replies, because the log keeps no per-reply timestamps. ← → step, space plays.
      </p>
    </div>
  );
}
