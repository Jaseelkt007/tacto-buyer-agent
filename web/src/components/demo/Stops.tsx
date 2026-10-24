"use client";

import { useMemo, useState } from "react";
import { code, stats, type RunRow } from "@/lib/demo";
import { Ticks } from "./DecideFlow";
import { s } from "./styles";
import { CodeRef, Panel, Seg, Tag } from "./ui";

/** How a recorded run closed, read off the reason our engine logged for its last move. */
const CLOSES: { id: string; label: string; test: (r: RunRow) => boolean; tone: string; note: string }[] = [
  { id: "auction", label: "Best bid after the reverse auction", test: (r) => /auction call|last call/.test(r.stop_why), tone: "var(--d-buyer)", note: "RFQ only" },
  { id: "within", label: "Its price came within 0.5 % of ours", test: (r) => /within half a percent/.test(r.stop_why), tone: "var(--d-good)", note: "the prices met" },
  { id: "health", label: "At its healthy price (strategic goals)", test: (r) => /cheapest for us with the relationship/.test(r.stop_why), tone: "var(--d-arena)", note: "stabilise / secure supply" },
  { id: "final", label: "It sent a final offer and we took it", test: (r) => r.stop === "accepted" && /final_offer/.test(r.stop_why), tone: "var(--d-warn)", note: "the supplier set the end" },
  { id: "agreed", label: "It agreed to our sheet", test: (r) => r.stop === "accepted" && /agreed/.test(r.stop_why), tone: "var(--d-good)", note: "it accepted our terms" },
  { id: "supplier_walked", label: "It walked after we pushed past its final offer", test: (r) => r.stop === "supplier_walked_after_final_push", tone: "var(--d-bad)", note: "no deal" },
  { id: "buyer_walked", label: "We walked: no sheet passed the accept check", test: (r) => r.stop === "buyer_walked", tone: "var(--d-bad)", note: "no deal" },
];

function closeOf(r: RunRow) {
  return CLOSES.find((c) => c.test(r))?.id ?? "other";
}

const WHO: { id: string; label: string }[] = [
  { id: "buyer", label: "We end it" },
  { id: "supplier", label: "The supplier ends it" },
  { id: "arena", label: "The arena ends it" },
  { id: "runner", label: "Our runner ends it" },
];

export function Stops() {
  const versions = useMemo(() => ["all", ...stats.by_version.map((v) => v.note)], []);
  const [ver, setVer] = useState("all");
  const runs = stats.runs.filter((r) => ver === "all" || r.note === ver);
  const counts = CLOSES.map((c) => ({ ...c, runs: runs.filter((r) => closeOf(r) === c.id) }));
  const max = Math.max(1, ...counts.map((c) => c.runs.length));
  const finalShare = runs.length ? counts.find((c) => c.id === "final")!.runs.length / runs.length : 0;
  const hist = new Map<number, number>();
  for (const r of runs) hist.set(r.rounds, (hist.get(r.rounds) ?? 0) + 1);
  const maxRounds = Math.max(...stats.runs.map((r) => r.rounds));
  const histMax = Math.max(1, ...hist.values());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12.5px] text-[var(--d-ink-2)]" htmlFor="ver">
          Engine version
        </label>
        <select
          id="ver"
          value={ver}
          onChange={(e) => setVer(e.target.value)}
          className="h-8 rounded-md border border-[var(--d-line)] bg-white px-2.5 text-[13px] shadow-[var(--d-shadow)]"
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              {v === "all" ? `All versions (${stats.runs.length} runs)` : `${v} (${stats.runs.filter((r) => r.note === v).length} runs)`}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title={`How ${runs.length} recorded runs ended`}>
          <div className="grid gap-5 p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <div className={`${s.plate} text-[44px] leading-none tabular-nums`}>{Math.round(finalShare * 100)} %</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--d-ink-2)]">closed because the supplier said final offer, not because the prices met. The supplier decides how long these talks last.</p>
            </div>
            <ul className="space-y-2.5">
              {counts.map((c) => (
                <li key={c.id} className="text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{c.label}</span>
                    <span className="tabular-nums font-semibold">{c.runs.length}</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-r-[3px] bg-[var(--d-sunk)]">
                    <div className="h-full rounded-r-[3px]" style={{ width: `${(c.runs.length / max) * 100}%`, background: c.tone }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--d-muted)]">
                    {c.note}
                    {c.runs.length ? `: ${Array.from(new Set(c.runs.map((r) => r.case_id.replace("case:", "")))).join(", ")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="How many messages we sent per session">
          <div className="p-4">
            <div className="flex h-[180px] items-end gap-1.5">
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map((n) => {
                const v = hist.get(n) ?? 0;
                return (
                  <div key={n} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${v} sessions with ${n} messages`}>
                    {v > 0 && <span className="text-[11px] tabular-nums text-[var(--d-ink-2)]">{v}</span>}
                    <div className="w-full max-w-[24px] rounded-t-[4px] bg-[var(--d-buyer)]" style={{ height: `${(v / histMax) * 140}px` }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1.5 border-t border-[var(--d-line)] pt-1">
              {Array.from({ length: maxRounds }, (_, i) => i + 1).map((n) => (
                <span key={n} className="flex-1 text-center text-[11px] tabular-nums text-[var(--d-muted)]">
                  {n}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--d-ink-2)]">
              Messages we sent in the whole session, all threads together. The arena allows 10 per thread; RFQ sessions add up across threads, so they can pass 10.
            </p>
          </div>
        </Panel>
      </div>

      <CaseTable />

      <Panel title="Every way the code can end a case" aside={`${code.stop_reasons.length} exits`}>
        <div className="grid gap-px bg-[var(--d-line-soft)] md:grid-cols-2">
          {WHO.map((w) => {
            const list = code.stop_reasons.filter((r) => r.who === w.id);
            if (!list.length) return null;
            return (
              <div key={w.id} className="bg-[var(--d-panel)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{w.label}</span>
                  <Tag>{list.length}</Tag>
                </div>
                <ul className="space-y-2.5">
                  {list.map((r) => (
                    <li key={r.id} className="text-[12.5px]">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">
                          <Ticks text={r.trigger} />
                        </span>
                        <CodeRef file={r.file} line={r.line} />
                      </div>
                      <p className="mt-0.5 text-[var(--d-ink-2)]">
                        <Ticks text={r.effect} />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function CaseTable() {
  const [sort, setSort] = useState<"case" | "score">("case");
  const rows = [...stats.by_case].sort((a, b) => (sort === "score" ? a.latest_score - b.latest_score : a.case_id.localeCompare(b.case_id)));
  return (
    <Panel
      title="Every case: latest run, how it ended, and the score across versions"
      aside={
        <Seg
          label="Sort cases"
          value={sort}
          onChange={setSort}
          options={[
            { value: "case", label: "By case" },
            { value: "score", label: "Weakest first" },
          ]}
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11.5px] text-[var(--d-muted)]">
            <tr>
              <th className="px-4 py-2 font-normal">Case</th>
              <th className="py-2 pr-3 font-normal">Type</th>
              <th className="py-2 pr-3 text-right font-normal">Latest</th>
              <th className="py-2 pr-3 text-right font-normal">Best</th>
              <th className="py-2 pr-3 font-normal">Score per run, oldest first</th>
              <th className="py-2 pr-3 text-right font-normal">Msgs</th>
              <th className="py-2 pr-3 font-normal">Ended</th>
              <th className="py-2 pr-4 text-right font-normal">Baselines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.case_id} className="border-t border-[var(--d-line-soft)]">
                <td className="px-4 py-2">
                  <div className={`${s.plate} text-[16px]`}>{c.case_id.replace("case:", "")}</div>
                  <div className="max-w-[260px] truncate text-[11px] text-[var(--d-muted)]">{c.title}</div>
                </td>
                <td className="py-2 pr-3 text-[var(--d-ink-2)]">{c.type.replaceAll("_", " ")}</td>
                <td className={`${s.plate} py-2 pr-3 text-right text-[17px] tabular-nums`} style={{ color: c.latest_score >= 0.7 ? "var(--d-good)" : c.latest_score > 0.3 ? "var(--d-ink)" : "var(--d-bad)" }}>
                  {c.latest_score.toFixed(2)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--d-ink-2)]">{c.best_score.toFixed(2)}</td>
                <td className="py-2 pr-3">
                  <Bars scores={c.scores} />
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{c.latest_rounds}</td>
                <td className="py-2 pr-3">
                  <Tag tone={c.latest_stop === "accepted" ? "good" : "bad"}>{c.latest_stop.replaceAll("_", " ")}</Tag>
                </td>
                <td className="py-2 pr-4 text-right text-[11.5px] tabular-nums text-[var(--d-ink-2)]">
                  {c.naive !== null && c.naive !== undefined ? `naive ${c.naive.toFixed(2)}` : ""}
                  {c.kit_llm !== null && c.kit_llm !== undefined ? `, kit LLM ${c.kit_llm.toFixed(2)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Bars({ scores }: { scores: { note: string; score: number }[] }) {
  return (
    <div className="flex h-[26px] items-end gap-[2px]">
      {scores.map((x, i) => (
        <span
          key={i}
          title={`${x.note}: ${x.score.toFixed(2)}`}
          className="w-[6px] rounded-t-[2px]"
          style={{ height: `${Math.max(2, x.score * 26)}px`, background: i === scores.length - 1 ? "var(--d-buyer)" : "var(--d-line)" }}
        />
      ))}
    </div>
  );
}
