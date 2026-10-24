"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchIcon } from "../icons";
import { Sparkline } from "../parts/CostBits";

export type DemandRow = {
  no: string;
  description: string;
  category: string;
  uom: string;
  forecast: number | null;
  calledOff: number | null;
  change: number | null;
  fcId: string | null;
  trend: [string, number][];
  active: number;
  qualified: number;
  lastRfq: string | null;
  bestRival: { supplier: string; price: number } | null;
  price: number | null;
  cases: string[];
};

const eur = (v: number) => v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;

export function DemandTable({ rows }: { rows: DemandRow[] }) {
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => !q || `${r.no} ${r.description} ${r.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] sm:max-w-sm">
          <SearchIcon className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search part, description, category"
            className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <span className="text-[12px] text-[var(--muted)]">{shown.length} parts</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
            <tr>
              <th className="px-3 py-2 font-medium">Part</th>
              <th className="px-3 py-2 text-right font-medium" title="Latest forecast for the next 12 months">
                Forecast 12 m
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Ordered for the last 12 months, by requested month">
                Called off 12 m
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Forecast vs called off: the figure an fc: claim states">
                Change
              </th>
              <th className="px-3 py-2 font-medium">Forecasts since 2023-12</th>
              <th className="px-3 py-2 font-medium" title="Active / qualified suppliers on the source list">
                Sources
              </th>
              <th className="px-3 py-2 font-medium" title="Cheapest quote in the latest RFQ vs today's price">
                Latest RFQ
              </th>
              <th className="px-3 py-2 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.no} className="border-t border-[var(--line)] hover:bg-[var(--hover)]">
                <td className="px-3 py-1.5">
                  <Link href={`/demand/${r.no}`} className="font-medium hover:text-[var(--accent-ink)] hover:underline">
                    {r.description}
                  </Link>
                  <div className="font-mono text-[11px] text-[var(--muted)]">
                    part:{r.no} · {r.category}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.forecast !== null ? `${r.forecast.toLocaleString("en-GB")} ${r.uom}` : "—"}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{r.calledOff !== null ? r.calledOff.toLocaleString("en-GB") : "—"}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.change !== null ? <span className={r.change > 0 ? "font-semibold" : ""}>{signed(r.change)}</span> : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <Sparkline values={r.trend} width={110} height={24} />
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  {r.active} active{r.qualified > 0 && <span className="text-[var(--ink-2)]"> · {r.qualified} qualified</span>}
                  {r.active + r.qualified <= 1 && <div className="text-[11px] text-[var(--bad)]">single source</div>}
                </td>
                <td className="px-3 py-1.5 text-[12.5px] whitespace-nowrap">
                  {r.lastRfq ?? "—"}
                  {r.bestRival && (
                    <div className="text-[11px] text-[var(--ink-2)] tabular-nums">
                      best {eur(r.bestRival.price)}
                      {r.price !== null && <> ({signed((r.bestRival.price / r.price - 1) * 100)} vs today)</>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-[12px] whitespace-nowrap text-[var(--ink-2)]">{r.cases.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
