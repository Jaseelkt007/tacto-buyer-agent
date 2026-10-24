import type { Metadata } from "next";
import { Ledger } from "@/components/arguments/Ledger";
import { argumentRows } from "@/lib/arguments";
import { fullDate } from "@/lib/format";
import { runsData, versionOf } from "@/lib/runs";

export const metadata: Metadata = { title: "Arguments · ProcuDeal" };

const CHECKS: [string, string, string][] = [
  ["index_change", "2 × idx:, one series, ≤ 12 months apart, ending in the last 12 months of the data", "the % change, ±0.5 pp"],
  ["rival_offer", "a quote: of this case, or another supplier's offer: in this session", "its price (reveals it to that supplier)"],
  ["delivery_record / quality_record", "sc: rows (quality also qn:)", "mean on-time % / mean ppm"],
  ["should_cost", "cost:", "the unit cost estimate"],
  ["volume_change", "fc:", "the forecast change %"],
  ["notice_period", "a letter doc: + the contract ctr:", "days of notice given vs agreed"],
];

export default function Page() {
  const rows = argumentRows();
  const versions = [...new Set([...runsData.runs].sort((a, b) => a.when.localeCompare(b.when)).map(versionOf))].filter((v) => rows.some((r) => r.version === v));
  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Arguments</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Every argument our agent sent, across all saved runs: what it cited, what the arena answered, and how the supplier&apos;s price moved in the
            reply. The arena checks at most 3 arguments per message. <strong>Verified</strong> only means the figure is true; whether it moves the
            price is up to the supplier. <strong>Duplicate</strong> means the ID was already used in this case, so the argument was wasted.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            {rows.length} arguments in {runsData.runs.length} runs · synced {fullDate(runsData.synced_at)}
          </p>
        </header>

        <Ledger rows={rows} versions={versions} initial={versions.at(-1) ?? "all"} />

        <section className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">How each argument is checked (brief/api.md)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11.5px] text-[var(--ink-2)]">
                <tr>
                  <th className="py-1 pr-3 font-medium">Argument</th>
                  <th className="py-1 pr-3 font-medium">You cite</th>
                  <th className="py-1 font-medium">Checked against</th>
                </tr>
              </thead>
              <tbody>
                {CHECKS.map(([a, b, c]) => (
                  <tr key={a} className="border-t border-[var(--line)]">
                    <td className="py-1 pr-3 font-mono text-[11.5px]">{a}</td>
                    <td className="py-1 pr-3">{b}</td>
                    <td className="py-1">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            Tolerance ±0.5 percentage points for %, else ±0.5 %. Unknown ID or wrong figure: contradicted, which costs trust. Each ID counts once per
            case, except a rival&apos;s quote, which counts once per supplier.
          </p>
        </section>
      </div>
    </main>
  );
}
