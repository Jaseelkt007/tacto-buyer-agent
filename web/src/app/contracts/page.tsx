import type { Metadata } from "next";
import { ContractTable, type ContractRow } from "@/components/contracts/ContractTable";
import { contractData, daysFromAsOf, LAST_FY } from "@/lib/contracts";
import { fullDate } from "@/lib/format";

export const metadata: Metadata = { title: "Contracts · ProcuDeal" };

export default function Page() {
  const fy = LAST_FY;
  const rows: ContractRow[] = contractData.contracts.map((c) => ({
    no: c.id.replace("ctr:", ""),
    supplier: c.supplier,
    supplierId: c.supplier_id,
    category: c.category,
    validTo: c.valid_to,
    actBy: c.termination_deadline,
    actByDays: c.termination_deadline ? daysFromAsOf(c.termination_deadline) : null,
    priceBasis: c.price_basis,
    payment: c.payment_days,
    incoterm: c.incoterm,
    otd: c.delivery.otd_requested_12m,
    colour: c.scorecard?.colour ?? null,
    complaints12m: c.quality.per_year[fy]?.supplier_caused ?? 0,
    overdue8d: c.quality.overdue_8d,
    weLate: c.payment.avg_days_late_12m,
    weLateShare: c.payment.late_share_12m,
    lateDiscounts: c.payment.discounts_taken_late,
  }));
  const all = contractData.contracts;
  const avgLate = all.reduce((s, c) => s + (c.payment.avg_days_late_12m ?? 0), 0) / all.length;
  const soon = rows.filter((r) => r.actByDays !== null && r.actByDays <= 30).length;
  const below = rows.filter((r) => r.otd !== null && r.otd < 95).length;

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Contracts &amp; Performance</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Our 46 framework contracts, and how each relationship performs in practice: does the supplier deliver on time and to quality, and
            do <strong>we</strong> pay on time? Computed from the raw order lines, goods receipts, quality notifications and invoices, the way
            the scorecard method (<code>data/SCORECARD.md</code>) defines it. Last 12 months = {contractData.year_start} to {contractData.as_of}.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            Data package {contractData.data_version ?? "?"} · synced {fullDate(contractData.synced_at)}
          </p>
        </header>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <div className="text-[11.5px] text-[var(--muted)]">Notice deadline passed or within 30 days</div>
            <div className="text-[18px] font-semibold tabular-nums">{soon} contracts</div>
            <div className="text-[11.5px] text-[var(--ink-2)]">last day to terminate or renegotiate before they renew</div>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <div className="text-[11.5px] text-[var(--muted)]">Below the 95 % on-time target</div>
            <div className="text-[18px] font-semibold tabular-nums">
              {below} of {rows.length}
            </div>
            <div className="text-[11.5px] text-[var(--ink-2)]">suppliers, last 12 months</div>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            <div className="text-[11.5px] text-[var(--muted)]">We pay late, on average</div>
            <div className="text-[18px] font-semibold tabular-nums">{avgLate.toFixed(1)} days</div>
            <div className="text-[11.5px] text-[var(--ink-2)]">after the due date (mean over contracts)</div>
          </div>
        </div>
        <ContractTable rows={rows} />
      </div>
    </main>
  );
}
