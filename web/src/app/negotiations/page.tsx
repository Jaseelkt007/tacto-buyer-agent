import type { Metadata } from "next";
import Link from "next/link";
import { GOALS, fullDate } from "@/lib/format";
import { caseFile, runsData, versionOf, type Run } from "@/lib/runs";

export const metadata: Metadata = { title: "Negotiations · ProcuDeal" };

const pct = (s: number | null | undefined) => Math.round((s ?? 0) * 100);

function Cell({ run }: { run: Run | undefined }) {
  if (!run) return <td className="border-t border-[var(--line)] px-2 py-1.5 text-center text-[var(--muted)]">·</td>;
  const score = run.result.score ?? 0;
  const deal = run.result.deal;
  return (
    <td className="border-t border-[var(--line)] p-1">
      <Link
        href={`/negotiations/${run.session_id}`}
        title={`${run.case_id} · ${versionOf(run)} · ${deal ? "deal" : (run.end_reason ?? "no deal")}`}
        className="block rounded px-2 py-1 text-center tabular-nums hover:outline hover:outline-2 hover:outline-[var(--accent)]"
        // Sequential: one hue, more saturated where the score is higher.
        style={{ background: `color-mix(in oklab, var(--accent) ${Math.round(score * 55)}%, var(--surface))` }}
      >
        <span className={`text-[14px] font-semibold ${score > 0.6 ? "text-white" : "text-[var(--ink)]"}`}>{pct(score)}</span>
        {!deal && (
          <span className={`block text-[10px] ${score > 0.6 ? "text-white" : "text-[var(--ink-2)]"}`}>
            {(run.end_reason ?? "no deal").replace("_", " ")}
          </span>
        )}
      </Link>
    </td>
  );
}

export default function Page() {
  const runs = runsData.runs;
  const versions = [...new Set([...runs].sort((a, b) => a.when.localeCompare(b.when)).map(versionOf))];
  const cases = [...new Set(runs.map((r) => r.case_id))].sort((a, b) =>
    a.startsWith("case:D") === b.startsWith("case:D") ? a.localeCompare(b) : a.startsWith("case:D") ? 1 : -1,
  );
  // Latest run per (case, version).
  const pick = new Map<string, Run>();
  for (const r of runs) {
    const k = `${r.case_id}|${versionOf(r)}`;
    if (!pick.has(k) || pick.get(k)!.when < r.when) pick.set(k, r);
  }
  const mean = (v: string) => {
    const xs = cases.map((c) => pick.get(`${c}|${v}`)).filter((r): r is Run => !!r);
    return { n: xs.length, avg: xs.reduce((s, r) => s + (r.result.score ?? 0), 0) / Math.max(1, xs.length) };
  };

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Negotiations</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Every session our benchmark played, by case and agent version. Score is the share of the possible saving
            the deal captured (0–100). Open a cell to replay the negotiation: what each supplier said, what happened
            inside the supplier, what our agent decided and why, and what it wrote back.
          </p>
          <p className="text-[12px] text-[var(--muted)]">
            {runs.length} runs from <code className="font-mono">{runsData.source}</code> · synced {fullDate(runsData.synced_at)}
          </p>
        </header>

        <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
                <th className="sticky left-0 bg-[var(--surface-2)] px-3 py-2 font-medium">Case</th>
                {versions.map((v) => (
                  <th key={v} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const cf = caseFile(c);
                return (
                  <tr key={c}>
                    <th className="sticky left-0 max-w-[18rem] border-t border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-left font-normal">
                      <div className="font-semibold">{c.replace("case:", "")}</div>
                      <div className="truncate text-[12px] text-[var(--ink-2)]" title={cf?.title}>
                        {cf?.title ?? "—"}
                      </div>
                      {cf?.buyer.category_goal && (
                        <div className="text-[11px] text-[var(--muted)]">
                          {GOALS[cf.buyer.category_goal] ?? cf.buyer.category_goal}
                          {cf.suppliers.length > 1 && ` · RFQ, ${cf.suppliers.length} suppliers`}
                        </div>
                      )}
                    </th>
                    {versions.map((v) => (
                      <Cell key={v} run={pick.get(`${c}|${v}`)} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--surface-2)] text-[12px]">
                <th className="sticky left-0 bg-[var(--surface-2)] px-3 py-2 text-left font-medium text-[var(--ink-2)]">
                  Mean over cases played
                </th>
                {versions.map((v) => {
                  const m = mean(v);
                  return (
                    <td key={v} className="px-2 py-2 text-center tabular-nums">
                      <span className="font-semibold">{(m.avg * 100).toFixed(1)}</span>
                      <span className="block text-[11px] text-[var(--muted)]">{m.n} cases</span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[12px] text-[var(--muted)]">
          Means are over different case sets per version, so compare columns on the cases they share. Sandbox D01/D02 are
          free; P-cases are hosted practice.
        </p>
      </div>
    </main>
  );
}
