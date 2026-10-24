"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "../icons";

export type SupplierRow = {
  id: string;
  name: string;
  country: string;
  category: string;
  detailed: boolean;
  blocked: boolean;
  abc: string | null;
  spend: number;
  colour: string | null;
  score: number | null;
  credit: number | null;
  creditDelta: number | null;
  signals: string[];
  cases: string[];
};

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ScoreDot({ colour }: { colour: string | null }) {
  if (!colour) return null;
  const c = colour === "green" ? "var(--good)" : colour === "red" ? "var(--bad)" : "var(--warn-border)";
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} aria-hidden />;
}

export function SupplierTable({ rows, fy }: { rows: SupplierRow[]; fy: string }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"detailed" | "all">("detailed");
  const [cat, setCat] = useState("");
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));

  const shown = rows.filter(
    (r) =>
      (scope === "all" || r.detailed) &&
      (!cat || r.category === cat) &&
      (!q || `${r.name} ${r.id} ${r.country} ${r.category}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] sm:max-w-sm">
          <SearchIcon className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, country"
            className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <div className="flex rounded border border-[var(--line)] bg-[var(--surface)] p-0.5 text-[12.5px]">
          {(
            [
              ["detailed", `Detailed (${rows.filter((r) => r.detailed).length})`],
              ["all", `All (${rows.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setScope(k)}
              className={`rounded px-2.5 py-1 ${scope === k ? "bg-[var(--select)] font-semibold text-[var(--accent-ink)]" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-[var(--muted)]">{shown.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
            <tr>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">ABC</th>
              <th className="px-3 py-2 font-medium">Spend {fy}</th>
              <th className="px-3 py-2 font-medium">Scorecard</th>
              <th className="px-3 py-2 font-medium" title="Higher is worse">
                Credit index
              </th>
              <th className="px-3 py-2 font-medium">Signals</th>
              <th className="px-3 py-2 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[var(--hover)]">
                <td className="px-3 py-1.5">
                  <Link href={`/suppliers/${r.id.replace("sup:", "")}`} className="font-medium hover:text-[var(--accent-ink)] hover:underline">
                    {r.name}
                  </Link>
                  <div className="font-mono text-[11px] text-[var(--muted)]">
                    {r.id} · {r.country}
                    {r.blocked && <span className="ml-1 text-[var(--bad)]">blocked</span>}
                  </div>
                </td>
                <td className="px-3 py-1.5 text-[var(--ink-2)]">{r.category}</td>
                <td className="px-3 py-1.5">{r.abc ?? "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-16 rounded-r bg-[var(--surface-3)]">
                      <span className="block h-1.5 rounded-r bg-[var(--s-ours)]" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
                    </span>
                    <span className="tabular-nums">{eur0.format(r.spend)}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  {r.score !== null ? (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <ScoreDot colour={r.colour} />
                      {r.score.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-1.5 tabular-nums">
                  {r.credit ?? "—"}
                  {r.creditDelta ? (
                    <span className={`ml-1 text-[11.5px] ${r.creditDelta > 0 ? "text-[var(--bad)]" : "text-[var(--good)]"}`}>
                      {r.creditDelta > 0 ? "▲" : "▼"}
                      {Math.abs(r.creditDelta)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {r.signals.map((s) => (
                      <span key={s} className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-1.5 text-[11px] whitespace-nowrap">
                        {s}
                      </span>
                    ))}
                  </div>
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
