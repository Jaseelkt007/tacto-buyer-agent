"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ArgumentRow } from "@/lib/arguments";
import { DataId } from "../MailBody";

const LABEL: Record<string, string> = {
  rival_offer: "Rival offer",
  rival_quote: "Rival quote",
  notice_period: "Notice period",
  should_cost: "Should-cost",
  quality_record: "Quality record",
  index_change: "Index change",
  delivery_record: "Delivery record",
  volume_change: "Volume change",
};
const TONE: Record<string, string> = {
  verified: "bg-[var(--good-bg)] text-[var(--good)]",
  contradicted: "bg-[var(--bad-bg)] text-[var(--bad)]",
};
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;

/** Arguments by type, then every argument; filter by agent version. */
export function Ledger({ rows, versions, initial }: { rows: ArgumentRow[]; versions: string[]; initial: string }) {
  const [version, setVersion] = useState(initial);
  const [type, setType] = useState("");
  const mine = useMemo(() => rows.filter((r) => version === "all" || r.version === version), [rows, version]);
  const shown = mine.filter((r) => !type || r.type === type).sort((a, b) => a.case_id.localeCompare(b.case_id) || a.round - b.round);

  const byType = useMemo(() => {
    const m = new Map<string, ArgumentRow[]>();
    for (const r of mine) m.set(r.type, [...(m.get(r.type) ?? []), r]);
    return [...m.entries()]
      .map(([t, list]) => {
        const moves = list.filter((r) => r.move_pct !== null).map((r) => r.move_pct!);
        const count = (v: string) => list.filter((r) => r.verdict === v).length;
        return {
          type: t,
          n: list.length,
          verified: count("verified"),
          duplicate: count("duplicate"),
          irrelevant: count("irrelevant"),
          contradicted: count("contradicted"),
          noReply: count("no reply"),
          avgMove: moves.length ? moves.reduce((s, v) => s + v, 0) / moves.length : null,
          cases: new Set(list.map((r) => r.case_id)).size,
        };
      })
      .sort((a, b) => b.n - a.n);
  }, [mine]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-[var(--ink-2)]">Agent version</span>
        <select value={version} onChange={(e) => setVersion(e.target.value)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1">
          <option value="all">all versions</option>
          {versions.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <span className="text-[var(--muted)]">{mine.length} arguments</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[13px] tabular-nums">
          <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
            <tr>
              <th className="px-3 py-2 font-medium">Argument</th>
              <th className="px-3 py-2 text-right font-medium">Sent</th>
              <th className="px-3 py-2 font-medium">Verdicts</th>
              <th className="px-3 py-2 text-right font-medium" title="Average change of the supplier's price in the reply that checked the message (all arguments in a message share it)">
                Price move in reply
              </th>
              <th className="px-3 py-2 text-right font-medium">Cases</th>
            </tr>
          </thead>
          <tbody>
            {byType.map((t) => (
              <tr
                key={t.type}
                onClick={() => setType(type === t.type ? "" : t.type)}
                className={`cursor-pointer border-t border-[var(--line)] hover:bg-[var(--hover)] ${type === t.type ? "bg-[var(--select)]" : ""}`}
              >
                <td className="px-3 py-1.5 font-medium">{LABEL[t.type] ?? t.type}</td>
                <td className="px-3 py-1.5 text-right">{t.n}</td>
                <td className="px-3 py-1.5">
                  <div className="flex h-2 w-40 overflow-hidden rounded-full bg-[var(--surface-3)]" aria-hidden>
                    <span className="bg-[var(--good)]" style={{ width: `${(t.verified / t.n) * 100}%` }} />
                    <span className="bg-[var(--bad)]" style={{ width: `${(t.contradicted / t.n) * 100}%` }} />
                  </div>
                  <div className="text-[11.5px] text-[var(--ink-2)]">
                    {t.verified} verified
                    {t.duplicate > 0 && ` · ${t.duplicate} duplicate`}
                    {t.irrelevant > 0 && ` · ${t.irrelevant} irrelevant`}
                    {t.contradicted > 0 && ` · ${t.contradicted} contradicted`}
                    {t.noReply > 0 && ` · ${t.noReply} no reply`}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right">{t.avgMove !== null ? signed(t.avgMove) : "—"}</td>
                <td className="px-3 py-1.5 text-right">{t.cases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-[var(--muted)]">
        Click a row to list only that argument. The price move belongs to the whole message and to everything else in the supplier&apos;s reasoning,
        not to one argument: read it as a hint, not a measured effect.
      </p>

      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Case · round</th>
              <th className="px-2.5 py-1.5 font-medium">To</th>
              <th className="px-2.5 py-1.5 font-medium">Argument</th>
              <th className="px-2.5 py-1.5 font-medium">Cited</th>
              <th className="px-2.5 py-1.5 font-medium">Verdict</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Their price</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  <Link href={`/negotiations/${r.session_id}`} className="font-semibold hover:underline">
                    {r.case_id.replace("case:", "")}
                  </Link>{" "}
                  · R{r.round}
                  <div className="text-[11px] text-[var(--muted)]">{r.version}</div>
                </td>
                <td className="max-w-40 truncate px-2.5 py-1.5" title={r.supplier}>
                  {r.supplier}
                </td>
                <td className="px-2.5 py-1.5">
                  {LABEL[r.type] ?? r.type}
                  {r.asserted && <div className="text-[11px] text-[var(--ink-2)]">{r.asserted}</div>}
                </td>
                <td className="px-2.5 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {r.refs.map((id) => (
                      <DataId key={id} id={id} />
                    ))}
                  </div>
                </td>
                <td className="px-2.5 py-1.5">
                  <span className={`rounded px-1.5 py-px text-[11.5px] ${TONE[r.verdict] ?? "bg-[var(--surface-3)] text-[var(--ink-2)]"}`}>{r.verdict}</span>
                </td>
                <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                  {r.before !== null && r.after !== null ? (
                    <>
                      {r.before.toFixed(2)} → {r.after.toFixed(2)}
                      <div className="text-[11px] text-[var(--ink-2)]">{signed(r.move_pct!)}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
