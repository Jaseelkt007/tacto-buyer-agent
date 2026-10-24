"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LiveRun } from "@/lib/live";
import type { Zone0Run } from "@/lib/zone0";
import { NEGOTIATION, RESEARCH } from "./graphs";
import { PipelinePlayer } from "./PipelinePlayer";

type Tab = "research" | "negotiation";

const fmtT = (t: number) => (t < 10 ? t.toFixed(2) : t.toFixed(1));

/** The two replays of one run: zone 0 research before the session, and the negotiation itself. */
export function LiveTabs({
  live,
  zone0,
  runs,
  scenarios,
  links,
  researchLinks,
}: {
  live: LiveRun;
  zone0: Zone0Run;
  runs: { id: string; label: string }[];
  scenarios: { label: string; id: string }[];
  links: Partial<Record<string, string>>;
  researchLinks: Partial<Record<string, string>>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("research");

  useEffect(() => {
    const h = location.hash.slice(1);
    if (h === "research" || h === "negotiation") queueMicrotask(() => setTab(h));
  }, []);
  const pick = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const toolbar = (
    <>
      <span className="text-[var(--ink-2)]">Suppliers</span>
      <div className="flex rounded border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/live/${s.id}#${tab}`)}
            className={`rounded px-2 py-0.5 ${s.id === live.id ? "bg-[var(--ink)] text-[var(--page)]" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <span className="text-[var(--ink-2)]">Run</span>
      <select
        value={live.id}
        onChange={(e) => router.push(`/live/${e.target.value}#${tab}`)}
        className="w-full min-w-0 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 sm:w-auto sm:max-w-md"
      >
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
    </>
  );

  const tabBtn = (t: Tab, n: string, title: string, sub: string) => (
    <button
      onClick={() => pick(t)}
      aria-current={tab === t ? "page" : undefined}
      className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-left ${
        tab === t ? "border-[var(--ink)] bg-[var(--surface)] shadow-sm" : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
      }`}
    >
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">{n}</span>
      <span className="block text-[14px] font-semibold">{title}</span>
      <span className="block text-[12px] text-[var(--ink-2)]">{sub}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        {tabBtn("research", "1 · Before the session", "Zone 0: offline research", "Opus 5.5 builds a dossier per supplier from all its data, with no time limit")}
        {tabBtn("negotiation", "2 · During the session", "The negotiation", "Code decides every move inside the 60-second window; the supplier bot answers")}
      </div>

      {tab === "research" ? (
        zone0.available ? (
          <>
            <div className="rounded-md border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[12.5px]">
              <strong>Built, not yet wired in.</strong> Zone 0 has researched all suppliers and saved a dossier for each, but engine v1.7c does not read
              these files: the negotiation in tab 2 was decided by code alone. The planned bridge is zone 1, a case strategist at wave start.
            </div>
            <PipelinePlayer
              key={`research-${live.id}`}
              graph={RESEARCH}
              frames={zone0.frames}
              stats={zone0.stats}
              links={researchLinks}
              toolbar={toolbar}
              note="Replayed from the saved dossiers (starter-kit/knowledge). Each model stage takes its average time per call over the full build; the four specialists run in parallel. The real build runs suppliers in parallel; an RFQ's suppliers are shown one after another."
            />
          </>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">No zone 0 dossier for this case&apos;s suppliers. Run the research and `npm run sync:zone0`.</p>
        )
      ) : (
        <PipelinePlayer
          key={`negotiation-${live.id}`}
          graph={NEGOTIATION}
          frames={live.frames}
          stats={[
            [`${live.decisions - live.llmMoves} of ${live.decisions}`, "moves decided by code", live.llmMoves ? `${live.llmMoves} by the LLM fallback` : "no LLM fallback"],
            [`${live.ourMs.toFixed(0)} ms`, "our total thinking time", "vs a 60 s budget per message"],
            [`${fmtT(live.seconds)} s`, "the whole session", "measured wall time"],
            [`${live.rounds}`, "rounds", `${live.suppliers.length} supplier${live.suppliers.length > 1 ? "s" : ""}`],
            [`${live.argsVerified} / ${live.argsSent}`, "arguments verified", "checked by the arena"],
            [`${Math.round(live.score * 100)}`, "score", live.deal ? "deal signed" : "no deal"],
          ]}
          links={links}
          toolbar={toolbar}
          note="Replayed from the saved run log. Our decision times are measured; the session's total time is measured too, and the rest of it (the supplier thinking and the arena) is spread evenly over the supplier's replies, because the log keeps no per-reply timestamps."
        />
      )}
    </div>
  );
}
