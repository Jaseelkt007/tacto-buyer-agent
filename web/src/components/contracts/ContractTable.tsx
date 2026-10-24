"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchIcon } from "../icons";
import { ScoreDot } from "../suppliers/SupplierTable";

export type ContractRow = {
  no: string;
  supplier: string;
  supplierId: string;
  category: string | null;
  validTo: string;
  actBy: string | null;
  actByDays: number | null;
  priceBasis: string | null;
  payment: number | null;
  incoterm: string | null;
  otd: number | null;
  colour: string | null;
  complaints12m: number;
  overdue8d: number;
  weLate: number | null;
  weLateShare: number | null;
  lateDiscounts: number;
};

const SORTS = {
  deadline: { label: "Deadline first", fn: (a: ContractRow, b: ContractRow) => (a.actBy ?? "9").localeCompare(b.actBy ?? "9") || a.supplier.localeCompare(b.supplier) },
  otd: { label: "Worst delivery first", fn: (a: ContractRow, b: ContractRow) => (a.otd ?? 101) - (b.otd ?? 101) },
  complaints: { label: "Most complaints first", fn: (a: ContractRow, b: ContractRow) => b.complaints12m - a.complaints12m },
  paying: { label: "We pay latest first", fn: (a: ContractRow, b: ContractRow) => (b.weLate ?? -99) - (a.weLate ?? -99) },
  name: { label: "Supplier A–Z", fn: (a: ContractRow, b: ContractRow) => a.supplier.localeCompare(b.supplier) },
} as const;

export function ContractTable({ rows }: { rows: ContractRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("deadline");
  const shown = rows
    .filter((r) => !q || `${r.supplier} ${r.no} ${r.category ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort(SORTS[sort].fn);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] sm:max-w-sm">
          <SearchIcon className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search supplier, contract, category"
            className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
          className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px]"
        >
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-[var(--muted)]">{shown.length} contracts</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
            <tr>
              <th className="px-3 py-2 font-medium">Supplier · contract</th>
              <th className="px-3 py-2 font-medium" title="Last day to give notice to leave or renegotiate before the contract renews">
                Act by
              </th>
              <th className="px-3 py-2 font-medium">Terms</th>
              <th className="px-3 py-2 text-right font-medium" title="Receipts on time against the requested date, last 12 months (target 95 %)">
                On time
              </th>
              <th className="px-3 py-2 text-right font-medium" title="Supplier-caused complaints, last 12 months">
                Complaints
              </th>
              <th className="px-3 py-2 text-right font-medium" title="How late we paid this supplier on average, last 12 months">
                We pay
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.no} className="border-t border-[var(--line)] hover:bg-[var(--hover)]">
                <td className="px-3 py-1.5">
                  <Link href={`/contracts/${r.no}`} className="font-medium hover:text-[var(--accent-ink)] hover:underline">
                    {r.supplier}
                  </Link>
                  <div className="font-mono text-[11px] text-[var(--muted)]">
                    ctr:{r.no} · {r.category}
                  </div>
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                  {r.actBy ?? "—"}
                  {r.actByDays !== null && (
                    <div className={`text-[11px] ${r.actByDays <= 30 ? "font-semibold text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                      {r.actByDays < 0 ? `${-r.actByDays} days ago` : r.actByDays === 0 ? "today" : `in ${r.actByDays} days`} · ends {r.validTo}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-[12.5px] text-[var(--ink-2)]">
                  {r.payment} days · {r.incoterm}
                  <div className="text-[11px]">{r.priceBasis}</div>
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <ScoreDot colour={r.colour} />
                    {r.otd !== null ? `${r.otd.toFixed(1)} %` : "—"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.complaints12m}
                  {r.overdue8d > 0 && <div className="text-[11px] text-[var(--bad)]">{r.overdue8d} 8D overdue</div>}
                </td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {r.weLate !== null ? (
                    <span className={r.weLate >= 7 ? "font-semibold text-[var(--bad)]" : ""}>
                      {r.weLate > 0 ? `${r.weLate.toFixed(1)} days late` : "on time"}
                    </span>
                  ) : (
                    "—"
                  )}
                  {r.weLateShare !== null && <div className="text-[11px] text-[var(--muted)]">{r.weLateShare.toFixed(0)} % of invoices late</div>}
                  {r.lateDiscounts > 0 && <div className="text-[11px] text-[var(--bad)]">{r.lateDiscounts} discounts taken late</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
