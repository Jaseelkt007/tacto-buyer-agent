"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "../icons";

export type PartRow = {
  id: string;
  description: string;
  category: string;
  abc: string | null;
  isNew: boolean;
  unit: string;
  supplier: string | null;
  price: number | null;
  fullCost: number | null;
  margin: number | null;
  drivers12m: number | null;
  asked: number | null;
  spend: number;
  cases: string[];
};

const eur = (v: number) => v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });
const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signed = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;

export function PartTable({ rows, fy }: { rows: PartRow[]; fy: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  const shown = rows.filter(
    (r) =>
      (!cat || r.category === cat) &&
      (!q || `${r.id} ${r.description} ${r.supplier ?? ""} ${r.category}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] sm:max-w-sm">
          <SearchIcon className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search part, description, supplier"
            className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
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
              <th className="px-3 py-2 font-medium">Part</th>
              <th className="px-3 py-2 font-medium">Main supplier</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium" title="The full cost our agent assumes for the main supplier">
                Full cost
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Price over full cost">
                Margin
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Weighted 12-month move of the part's cost-driver indices">
                Drivers 12 m
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Price increase the latest letter asks for">
                Asked
              </th>
              <th className="px-3 py-2 font-medium">Bought {fy}</th>
              <th className="px-3 py-2 font-medium">Cases</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[var(--hover)]">
                <td className="px-3 py-1.5">
                  <Link href={`/parts/${r.id.replace("part:", "")}`} className="font-medium hover:text-[var(--accent-ink)] hover:underline">
                    {r.description}
                  </Link>
                  <div className="font-mono text-[11px] text-[var(--muted)]">
                    {r.id} · {r.category}
                    {r.abc && ` · ${r.abc}`}
                    {r.isNew && <span className="ml-1 text-[var(--accent-ink)]">new (SOP 2027-03)</span>}
                  </div>
                </td>
                <td className="max-w-48 truncate px-3 py-1.5 text-[var(--ink-2)]" title={r.supplier ?? ""}>
                  {r.supplier ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.price !== null ? eur(r.price) : "—"}
                  <div className="text-[10.5px] text-[var(--muted)]">{r.unit}</div>
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{r.fullCost !== null ? eur(r.fullCost) : "—"}</td>
                <td
                  className={`px-3 py-1.5 text-right whitespace-nowrap tabular-nums ${r.margin !== null && r.margin < 0 ? "font-semibold text-[var(--bad)]" : ""}`}
                >
                  {r.margin !== null ? signed(r.margin) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">{r.drivers12m !== null ? signed(r.drivers12m) : "—"}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.asked !== null ? <span className="font-semibold">{signed(r.asked)}</span> : "—"}
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-14 rounded-r bg-[var(--surface-3)]">
                      <span className="block h-1.5 rounded-r bg-[var(--s-ours)]" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
                    </span>
                    <span className="tabular-nums whitespace-nowrap">{eur0.format(r.spend)}</span>
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
