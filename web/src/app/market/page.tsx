import type { Metadata } from "next";
import Link from "next/link";
import { Sparkline } from "@/components/parts/CostBits";
import { fullDate } from "@/lib/format";
import { change12m, extremeWindow } from "@/lib/indexRules";
import { claimCounts, FAMILIES, marketData } from "@/lib/market";

export const metadata: Metadata = { title: "Market · ProcuDeal" };

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;
const fmtVal = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v.toLocaleString("en-GB", { maximumFractionDigits: 3 });

const FAMILY_NOTE: Record<string, string> = {
  "Producer prices DE (Eurostat)": "What German producers charge, by industry (index 2021 = 100). The usual evidence for or against a supplier's cost argument.",
  "Labour cost (Eurostat)": "German manufacturing labour cost; quarterly, carried to each month of its quarter. Every part has it as a driver.",
  "Commodities (World Bank)": "Raw-material world prices in USD.",
  "Exchange rates (ECB)": "Units of foreign currency per euro: a rise means a stronger euro, so a supplier paid in euros but costing in that currency gets cheaper.",
  "Power price (SMARD)": "German day-ahead electricity price, € per MWh.",
  "Derived notations": "Notations suppliers price against, derived from the open series (copper for cables and motors, stainless alloy surcharges). Index clauses use these.",
};

export default function Page() {
  const counts = claimCounts();
  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Market</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            The {marketData.series.length} market series in the data package. Suppliers justify price increases with them; our agent answers
            with the ones that fell. The arena checks an index claim against these values: two months of one series, at most 12 months apart,
            ending within the last 12 months of the data, ±0.5 percentage points. Open a series to check any window.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            Data package {marketData.data_version ?? "?"} (as of 2026-09-30) · synced {fullDate(marketData.synced_at)} · shaded on each line: the last 12
            months
          </p>
        </header>

        {FAMILIES.map((f) => (
          <section key={f} className="space-y-2">
            <div>
              <h2 className="text-[15px] font-semibold">{f}</h2>
              {FAMILY_NOTE[f] && <p className="text-[12.5px] text-[var(--ink-2)]">{FAMILY_NOTE[f]}</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {marketData.series
                .filter((s) => s.family === f)
                .map((s) => {
                  const ch = change12m(s.values);
                  const fall = extremeWindow(s.values, "fall");
                  const last = s.values.at(-1)!;
                  return (
                    <Link
                      key={s.id}
                      href={`/market/${s.id}`}
                      className="min-w-0 space-y-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 hover:border-[var(--accent)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium" title={s.name}>
                            {s.name.replace(/^Producer prices DE: /, "")}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--muted)]">{s.id}</div>
                        </div>
                        {ch && (
                          <span className="shrink-0 text-right">
                            <span className="block text-[15px] font-semibold tabular-nums">{signed(ch.change)}</span>
                            <span className="block text-[10.5px] text-[var(--muted)]">12 months</span>
                          </span>
                        )}
                      </div>
                      <Sparkline values={s.values.slice(-36)} mark={ch ? { from: ch.from, to: ch.to } : null} width={300} height={34} />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--ink-2)]">
                        <span className="tabular-nums">
                          {last[0]}: {fmtVal(last[1])}
                          {s.unit && !s.unit.startsWith("index") && ` ${s.unit}`}
                        </span>
                        {s.drivers.length > 0 && <span className="rounded bg-[var(--surface-3)] px-1.5">drives {s.drivers.length} parts</span>}
                        {s.clauses.length > 0 && <span className="rounded bg-[var(--surface-3)] px-1.5">{s.clauses.length} contract clause</span>}
                        {counts[s.id] && <span className="rounded bg-[var(--surface-3)] px-1.5">{counts[s.id]} claims in runs</span>}
                        {fall && fall.change <= -0.5 && <span className="rounded bg-[var(--good-bg)] px-1.5 text-[var(--good)]">citable fall {signed(fall.change)}</span>}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
