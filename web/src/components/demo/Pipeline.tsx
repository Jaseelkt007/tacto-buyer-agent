"use client";

import { useState } from "react";
import { code, stats, suppliers, type Stage } from "@/lib/demo";
import { s } from "./styles";
import { CodeRef, Figure, kindColor, KindBadge, Panel } from "./ui";

const GROUPS: { id: string; title: string; note: string; test: (st: Stage) => boolean }[] = [
  { id: "before", title: "Before the case", note: "once per run or session", test: (st) => /once per run/.test(st.when) || st.id === "session_open" },
  { id: "setup", title: "First move of a case", note: "once per case and supplier", test: (st) => /once per (case|supplier)/.test(st.when) && st.id !== "session_open" },
  { id: "fallback", title: "Only when something breaks", note: "exception or wave cap", test: (st) => /exception/.test(st.when) },
  { id: "move", title: "Every move", note: "each time we answer", test: () => true },
];

function group(st: Stage) {
  return GROUPS.find((g) => g.test(st))!.id;
}

export function Pipeline() {
  const [sel, setSel] = useState<string>(code.stages.find((x) => x.kind === "llm")?.id ?? code.stages[0].id);
  const stage = code.stages.find((x) => x.id === sel)!;
  const order = (id: string) => code.stages.findIndex((x) => x.id === id) + 1;
  const m = stats.moves;
  const lanes = ["before", "setup", "move", "fallback"].map((id) => ({ g: GROUPS.find((x) => x.id === id)!, items: code.stages.filter((st) => group(st) === id) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 rounded-lg border border-[var(--d-line)] bg-[var(--d-panel)] p-5 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className={`${s.plate} text-[72px] leading-none tabular-nums text-[var(--d-ink)]`}>{code.llm.engine_calls_per_move}</div>
          <div className="mt-2 text-[14px] font-medium">model calls when the engine makes a move</div>
          <p className="mt-1 max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--d-ink-2)]">
            Code decides every price, sheet, claim, accept and walk-away. The e-mail is a fixed template. A model is called only when the engine throws, and then once for that move.
          </p>
        </div>
        <Figure value={`${m.kit_llm}`} label={`of ${m.total} recorded moves went to the LLM`} sub={`${m.engine} came from the engine; causes in chapter 4`} tone="var(--d-llm)" />
        <Figure value={`${stats.totals.procudeal_runs}`} label="recorded runs of our engine" sub={`${stats.totals.deals} deals over ${stats.totals.cases} cases`} />
        <Figure value={`${suppliers.total}`} label="suppliers in the data package" sub={`${suppliers.detailed_count} with letters, notes and intel for a dossier`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--d-ink-2)]">
        <span>Who runs each step:</span>
        <KindBadge kind="code" />
        <KindBadge kind="template" />
        <KindBadge kind="arena" />
        <KindBadge kind="llm" />
        <span className="text-[var(--d-muted)]">Numbers give the order the code runs them in. Click a step.</span>
      </div>

      <div className="space-y-3">
        {lanes.map(({ g, items }) => (
          <div key={g.id} className="grid gap-3 lg:grid-cols-[170px_minmax(0,1fr)]">
            <div className="pt-2">
              <div className="text-[13px] font-semibold">{g.title}</div>
              <div className="text-[11.5px] text-[var(--d-muted)]">{g.note}</div>
            </div>
            <ol className="flex flex-wrap items-stretch gap-y-2">
              {items.map((st, i) => (
                <li key={st.id} className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setSel(st.id)}
                    aria-pressed={st.id === sel}
                    className={`relative w-[188px] rounded-md border px-3 py-2 text-left transition-colors ${
                      st.id === sel ? "border-[var(--d-ink)] bg-[var(--d-panel)] shadow-[inset_0_0_0_1px_var(--d-ink)]" : "border-[var(--d-line)] bg-[var(--d-panel-2)] hover:bg-[var(--d-panel)]"
                    }`}
                  >
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r" style={{ background: kindColor(st.kind) }} aria-hidden />
                    <span className="flex items-baseline gap-2">
                      <span className={`${s.plate} text-[18px] tabular-nums text-[var(--d-muted)]`}>{order(st.id)}</span>
                      <span className="text-[12.5px] font-medium leading-snug">{st.name}</span>
                    </span>
                  </button>
                  {i < items.length - 1 && (
                    <span className="flex w-5 items-center justify-center text-[var(--d-muted)]" aria-hidden>
                      <svg width="14" height="10" viewBox="0 0 14 10">
                        <path d="M0 5h11M8 1.5 11.5 5 8 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <Panel
        key={stage.id}
        className={s.enter}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className={`${s.plate} text-[20px] text-[var(--d-muted)]`}>{order(stage.id)}</span>
            {stage.name}
            <KindBadge kind={stage.kind} />
          </span>
        }
        aside={
          <span className="flex items-center gap-2">
            {stage.when}
            <CodeRef file={stage.file} line={stage.line} />
          </span>
        }
      >
        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed">{stage.summary}</p>
            {stage.function && (
              <p className="text-[12px] text-[var(--d-muted)]">
                In code: <code className={`${s.code} !text-[11.5px] text-[var(--d-ink-2)]`}>{stage.function}</code>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="mb-1 font-semibold">Takes</div>
                <ul className="space-y-0.5 text-[var(--d-ink-2)]">
                  {stage.inputs.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold">Gives</div>
                <ul className="space-y-0.5 text-[var(--d-ink-2)]">
                  {stage.outputs.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <ul className="space-y-2 border-l border-[var(--d-line-soft)] pl-5 text-[13px] leading-relaxed text-[var(--d-ink-2)]">
            {stage.details.map((d, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[13px] top-[9px] h-1 w-1 rounded-full bg-[var(--d-muted)]" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
      <p className="text-[11.5px] text-[var(--d-muted)]">
        Read from the engine code at commit {code.commit} ({code.engine}). Runs and suppliers synced {stats.synced_at.slice(0, 16).replace("T", " ")} UTC.
      </p>
    </div>
  );
}
