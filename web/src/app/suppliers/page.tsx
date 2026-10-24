import type { Metadata } from "next";
import { SupplierTable, type SupplierRow } from "@/components/suppliers/SupplierTable";
import { fullDate } from "@/lib/format";
import { data as inbox } from "@/lib/inbox";
import { LATEST_FY, SIGNAL_LABEL, supplierData } from "@/lib/suppliers";

export const metadata: Metadata = { title: "Suppliers · ProcuDeal" };

export default function Page() {
  const rows: SupplierRow[] = supplierData.suppliers
    .map((s) => {
      const d = supplierData.details[s.id];
      const sc = d?.scorecards.at(-1);
      const intel = d?.intel;
      const ev = d?.signals.evidence;
      return {
        id: s.id,
        name: s.name,
        country: s.country,
        category: s.category,
        detailed: s.detail === "full",
        blocked: s.blocked,
        abc: s.abc_class,
        spend: s.spend[LATEST_FY]?.spend_eur ?? 0,
        colour: sc?.colour ?? null,
        score: sc?.score ?? null,
        credit: intel?.credit_index ?? null,
        creditDelta:
          intel?.credit_index !== null && intel?.credit_index !== undefined && intel.credit_index_12m_ago !== null
            ? intel.credit_index - intel.credit_index_12m_ago
            : null,
        signals: ev ? (["cash", "work", "full"] as const).filter((k) => ev[k].length).map((k) => SIGNAL_LABEL[k].title) : [],
        cases: inbox.cases.filter((c) => c.suppliers.some((x) => x.id === s.id)).map((c) => c.case_id.replace("case:", "")),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Suppliers</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Who our agent negotiates with. The 46 detailed suppliers carry register facts, a contract, scorecards,
            letters and news; the other 401 are known only by name, category and spend. Signals are what our agent&apos;s
            dossier reads out of their letters and news.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            Data package {supplierData.data_version ?? "?"} (as of 2026-09-30) · synced {fullDate(supplierData.synced_at)}
          </p>
        </header>
        <SupplierTable rows={rows} fy={LATEST_FY} />
      </div>
    </main>
  );
}
