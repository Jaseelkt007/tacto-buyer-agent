import type { Metadata } from "next";
import { PartTable, type PartRow } from "@/components/parts/PartTable";
import { fullDate } from "@/lib/format";
import { data as inbox } from "@/lib/inbox";
import { LATEST_PO_FY, latestAsk, partData, perUnit } from "@/lib/parts";

export const metadata: Metadata = { title: "Parts & Cost · ProcuDeal" };

export default function Page() {
  const rows: PartRow[] = partData.parts
    .map((p) => {
      const main = p.suppliers.find((s) => s.current_price !== null) ?? p.suppliers[0];
      return {
        id: p.id,
        description: p.description,
        category: p.category,
        abc: p.abc_class,
        isNew: p.status.startsWith("new"),
        unit: perUnit(p),
        supplier: main?.name ?? null,
        price: main?.current_price ?? null,
        fullCost: main?.full_cost?.unit_cost ?? null,
        margin: main?.margin_pct ?? null,
        drivers12m: p.implied_change_12m_pct,
        asked: latestAsk(p)?.asked_pct ?? null,
        spend: p.po[LATEST_PO_FY]?.spend_eur ?? 0,
        cases: inbox.cases.filter((c) => c.parts.some((x) => x.id === p.id)).map((c) => c.case_id.replace("case:", "")),
      };
    })
    .sort((a, b) => b.spend - a.spend);

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Parts &amp; Cost</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            What each part should cost and what we pay for it. <strong>Full cost</strong> is the cost without margin
            our agent assumes for the supplier (should-cost of its plant, or the German estimate scaled by country).{" "}
            <strong>Drivers 12 m</strong> is how much the part&apos;s cost should have moved from its cost-driver
            indices over the last 12 months; compare it with what the supplier <strong>asks</strong>.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            {partData.parts.length} parts · data package {partData.data_version ?? "?"} (as of 2026-09-30) · synced{" "}
            {fullDate(partData.synced_at)}
          </p>
        </header>
        <PartTable rows={rows} fy={LATEST_PO_FY} />
      </div>
    </main>
  );
}
