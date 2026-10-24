import type { Metadata } from "next";
import Link from "next/link";
import { DemandTable, type DemandRow } from "@/components/demand/DemandTable";
import { demandData } from "@/lib/demand";
import { fullDate } from "@/lib/format";
import { data as inbox } from "@/lib/inbox";
import { partData } from "@/lib/parts";

export const metadata: Metadata = { title: "Demand & Sourcing · ProcuDeal" };

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eurM = (v: number) => `€${(v / 1e6).toFixed(1)} M`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;

/** Spend per group in the latest year, with the change on the year before. One hue. */
function SpendBars({ data, years }: { data: Record<string, Record<string, number>>; years: string[] }) {
  const [prev, last] = [years.at(-2)!, years.at(-1)!];
  const rows = Object.entries(data)
    .map(([k, v]) => ({ k, now: v[last] ?? 0, before: v[prev] ?? 0 }))
    .sort((a, b) => b.now - a.now);
  const max = Math.max(1, ...rows.map((r) => r.now));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[minmax(0,9.5rem)_1fr_5.5rem_4rem] items-center gap-2 text-[12.5px]">
          <span className="truncate text-[var(--ink-2)]" title={r.k}>
            {r.k}
          </span>
          <span className="h-2 rounded-r bg-[var(--surface-3)]">
            <span className="block h-2 rounded-r bg-[var(--s-ours)]" style={{ width: `${(r.now / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.now >= 1e6 ? eurM(r.now) : eur0.format(r.now)}</span>
          <span className="text-right text-[11.5px] tabular-nums text-[var(--muted)]">{r.before ? signed((r.now / r.before - 1) * 100) : "new"}</span>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const s = demandData.spend;
  const [prev, last] = [s.years.at(-2)!, s.years.at(-1)!];
  const rows: DemandRow[] = demandData.parts.map((p) => {
    const price = partData.parts.find((x) => x.id === p.id)?.suppliers.find((x) => x.current_price !== null)?.current_price ?? null;
    const rfq = p.rfqs[0];
    const rival = rfq?.quotes.find((q) => !q.awarded) ?? rfq?.quotes[0];
    return {
      no: p.id.replace("part:", ""),
      description: p.description,
      category: p.category,
      uom: p.uom,
      forecast: p.latest?.qty_next_12m ?? null,
      calledOff: p.latest?.called_off_12m ?? null,
      change: p.latest?.change_pct ?? null,
      fcId: p.latest?.id ?? null,
      trend: p.snapshots.map((x) => [x.month, x.qty_next_12m]),
      active: p.sources.filter((x) => x.status === "active").length,
      qualified: p.sources.filter((x) => x.status !== "active").length,
      lastRfq: rfq?.date ?? null,
      bestRival: rival ? { supplier: rival.supplier, price: rival.unit_price } : null,
      price,
      cases: inbox.cases.filter((c) => c.parts.some((x) => x.id === p.id)).map((c) => c.case_id.replace("case:", "")),
    };
  });
  // Forecast value in €: prices are per price unit (1, 100 or 1,000 pieces, kg or m).
  const unit = new Map(demandData.parts.map((p) => [p.id.replace("part:", ""), p.price_unit]));
  const value = (r: DemandRow) => ((r.forecast ?? 0) * (r.price ?? 0)) / (unit.get(r.no) ?? 1);
  rows.sort((a, b) => value(b) - value(a));

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Demand &amp; Sourcing</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            How much we need, where else we could buy it, and where the money goes. Demand decides <strong>coverage</strong>: a deal that
            covers less than our need leaves the rest to be bought later at the fallback price plus a risk charge, which can make a cheaper
            price score worse. A rising forecast is also an argument: more volume for the supplier.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            Data package {demandData.data_version ?? "?"} (as of 2026-09-30) · synced {fullDate(demandData.synced_at)}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Where the money goes</h2>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              [`Spend ${last}`, eurM(s.total_by_year[last]), `${signed((s.total_by_year[last] / s.total_by_year[prev] - 1) * 100)} vs ${prev}`],
              ["Suppliers paid", `${s.suppliers_with_spend}`, `in ${last}`],
              ["Top 10 suppliers", `${s.top10_share} %`, "of the spend"],
              ["46 detailed suppliers", `${s.detailed_share} %`, "of the spend: the rest is the long tail"],
            ].map(([label, value, sub]) => (
              <div key={label} className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <div className="text-[11.5px] text-[var(--muted)]">{label}</div>
                <div className="text-[18px] font-semibold tabular-nums">{value}</div>
                <div className="text-[11.5px] text-[var(--ink-2)]">{sub}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
                By category, {last} <span className="font-normal normal-case">(change vs {prev})</span>
              </h3>
              <SpendBars data={s.by_category} years={s.years} />
            </div>
            <div className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
                By supplier country, {last} <span className="font-normal normal-case">(change vs {prev})</span>
              </h3>
              <SpendBars data={s.by_country} years={s.years} />
              <p className="text-[12px] text-[var(--muted)]">
                Company rule of thumb for full cost vs Germany: AT/CH 1.0–1.1, CZ/PL/HU 0.8–0.85, TR 0.75, CN 0.7.
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Top 15 suppliers, {last}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <tbody className="tabular-nums">
                  {s.top.map((t, i) => (
                    <tr key={t.supplier_id} className="border-t border-[var(--line)] first:border-t-0">
                      <td className="w-6 py-1 text-[var(--muted)]">{i + 1}</td>
                      <td className="py-1">
                        <Link href={`/suppliers/${t.supplier_id.replace("sup:", "")}`} className="hover:text-[var(--accent-ink)] hover:underline">
                          {t.name}
                        </Link>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {t.country} · {t.category}
                        </span>
                      </td>
                      <td className="w-28 py-1">
                        <span className="block h-1.5 rounded-r bg-[var(--surface-3)]">
                          <span className="block h-1.5 rounded-r bg-[var(--s-ours)]" style={{ width: `${(t.share / s.top[0].share) * 100}%` }} />
                        </span>
                      </td>
                      <td className="py-1 pl-3 text-right">{eur0.format(t.spend_eur)}</td>
                      <td className="w-14 py-1 text-right text-[var(--muted)]">{t.share} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold">Demand and sources per part</h2>
            <p className="text-[12.5px] text-[var(--ink-2)]">
              Sorted by forecast value (forecast × today&apos;s price). Change = latest forecast vs what we called off in the last 12 months:
              exactly the figure the arena checks for an <code>fc:</code> claim.
            </p>
          </div>
          <DemandTable rows={rows} />
        </section>
      </div>
    </main>
  );
}
