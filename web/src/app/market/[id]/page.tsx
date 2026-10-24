import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackIcon } from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { IndexExplorer } from "@/components/market/IndexExplorer";
import { change12m, extremeWindow, idxId } from "@/lib/indexRules";
import { claimsFor, clauseCases, clauseCostPct, findSeries, marketData } from "@/lib/market";

export function generateStaticParams() {
  return marketData.series.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/market/[id]">): Promise<Metadata> {
  const s = findSeries(decodeURIComponent((await params).id));
  return { title: `${s?.id ?? "Index"} · Market · ProcuDeal` };
}

const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)} %`;
const fmtVal = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v.toLocaleString("en-GB", { maximumFractionDigits: 3 });

function Card({ id, title, hint, children }: { id?: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">{title}</h2>
        {hint && <p className="text-[12.5px] text-[var(--muted)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[11.5px] text-[var(--muted)]">{label}</div>
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

const RESULT_TONE: Record<string, string> = {
  verified: "bg-[var(--good-bg)] text-[var(--good)]",
  holds: "bg-[var(--good-bg)] text-[var(--good)]",
  contradicted: "bg-[var(--bad-bg)] text-[var(--bad)]",
  off: "bg-[var(--bad-bg)] text-[var(--bad)]",
};

export default async function Page({ params }: PageProps<"/market/[id]">) {
  const s = findSeries(decodeURIComponent((await params).id));
  if (!s) notFound();
  const last = s.values.at(-1)!;
  const ch = change12m(s.values);
  const fall = extremeWindow(s.values, "fall");
  const rise = extremeWindow(s.values, "rise");
  const claims = claimsFor(s.id);
  const cases = clauseCases(s.id);

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <Link href="/market" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
            <BackIcon width={14} height={14} /> All indices
          </Link>
          <h1 className="text-[22px] font-semibold">{s.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[var(--ink-2)]">
            <code className="rounded bg-[var(--id-bg)] px-1 font-mono text-[12px]">{s.id}</code>
            <span>{s.family}</span>·<span>{s.frequency}</span>·<span>{s.unit}</span>·
            <span>
              {s.first_month} → {s.last_month}
            </span>
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <Tile label={`Latest (${last[0]})`} value={fmtVal(last[1])} sub={<span className="font-mono text-[11px]">{idxId(s.id, last[0])}</span>} />
          <Tile label="Last 12 months" value={ch ? signed(ch.change) : "—"} sub={ch ? `${ch.from} → ${ch.to}` : undefined} />
          <Tile
            label="Largest fall to latest"
            value={fall && fall.change < 0 ? signed(fall.change) : "none"}
            sub={fall && fall.change <= -0.5 ? `${fall.from} → ${fall.to} · our agent cites this` : "nothing for the agent to cite"}
          />
          <Tile label="Largest rise to latest" value={rise && rise.change > 0 ? signed(rise.change) : "none"} sub={rise && rise.change > 0 ? `${rise.from} → ${rise.to} · what a supplier would cite` : undefined} />
          <Tile label="Drives" value={`${s.drivers.length} parts`} sub={s.clauses.length ? `${s.clauses.length} contract index clause` : "no contract clause"} />
        </div>

        <Card
          title="Check a claim"
          hint="Pick two months (or click an idx: ID anywhere in the app). The change is (later ÷ earlier − 1) × 100, the way the arena computes it. Blue shading: a window the arena accepts; yellow: one it calls irrelevant."
        >
          <IndexExplorer id={s.id} name={s.name} unit={s.unit} values={s.values} />
        </Card>

        <Card
          id="claims"
          title="Claims made with this index in our runs"
          hint="Supplier claims are checked here against the data; ours carry the arena's verdict from the supplier's reply. Identical claims across runs are merged."
        >
          {claims.length ? (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Who</th>
                    <th className="px-2.5 py-1.5 font-medium">Window</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Claimed</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Data</th>
                    <th className="px-2.5 py-1.5 font-medium">Result</th>
                    <th className="px-2.5 py-1.5 font-medium">Runs</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {claims.map((c, i) => (
                    <tr key={i} className="border-t border-[var(--line)]">
                      <td className="px-2.5 py-1.5">
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${c.who === "us" ? "bg-[var(--s-ours)]" : "bg-[var(--s-supplier)]"}`} />
                        {c.who === "us" ? "Our agent" : c.by}
                        {c.who === "us" && <span className="text-[var(--muted)]"> {c.by}</span>}
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <a href={`#${idxId(s.id, c.from)}..${idxId(s.id, c.to)}`} className="text-[var(--accent-ink)] hover:underline">
                          {c.from} → {c.to}
                        </a>
                      </td>
                      <td className="px-2.5 py-1.5 text-right">{c.asserted !== null ? signed(c.asserted) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right">{c.actual !== null ? signed(c.actual, 2) : "—"}</td>
                      <td className="px-2.5 py-1.5">
                        <span className={`rounded px-1.5 py-px text-[11.5px] ${RESULT_TONE[c.result] ?? "bg-[var(--surface-3)] text-[var(--ink-2)]"}`}>{c.result}</span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {[...new Map(c.runs.map((r) => [r.case_id, r])).values()].map((r) => {
                            const latest = c.runs.filter((x) => x.case_id === r.case_id).at(-1)!;
                            return (
                              <Link
                                key={r.case_id}
                                href={`/negotiations/${latest.session_id}`}
                                className="rounded border border-[var(--line)] px-1.5 text-[11.5px] hover:bg-[var(--hover)]"
                                title={`${c.runs.filter((x) => x.case_id === r.case_id).length} runs; opens ${latest.version}`}
                              >
                                {r.case_id.replace("case:", "")} ×{c.runs.filter((x) => x.case_id === r.case_id).length}
                              </Link>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No claims with this index in our runs yet.</p>
          )}
        </Card>

        {s.drivers.length > 0 && (
          <Card
            title="Parts whose cost it drives"
            hint="Share of each part's cost that follows this index (cost_drivers, category team estimate) and what its 12-month move did to that part's cost."
          >
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Part</th>
                    <th className="px-2.5 py-1.5 font-medium">Category</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Share of cost</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Effect, 12 months</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {s.drivers.map((d) => (
                    <tr key={d.part_id} className="border-t border-[var(--line)]">
                      <td className="px-2.5 py-1.5">
                        <DataId id={d.part_id} /> {d.description}
                      </td>
                      <td className="px-2.5 py-1.5 text-[var(--ink-2)]">{d.category}</td>
                      <td className="px-2.5 py-1.5 text-right">{Math.round(d.weight * 100)} %</td>
                      <td className="px-2.5 py-1.5 text-right">{ch ? `${ch.change * d.weight >= 0 ? "+" : "−"}${Math.abs(ch.change * d.weight).toFixed(2)} pt` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {(s.clauses.length > 0 || cases.length > 0) && (
          <Card
            title="Index clauses"
            hint="A clause moves the price with the index: P = P0 × (1 − share + share × I / I_base), outside a deadband. Contracts that have one, and practice cases that offer one."
          >
            {s.clauses.map((c) => (
              <div key={c.id} className="space-y-1 rounded border border-[var(--line)] p-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <DataId id={c.id} />
                  {c.supplier_id && <DataId id={c.supplier_id} />}
                  <span className="text-[var(--ink-2)]">{c.supplier}</span>
                  <span className="text-[var(--ink-2)]">
                    · share {Math.round(c.material_share * 100)} % · deadband {c.deadband_pct} %
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--ink-2)]">{c.text}</p>
              </div>
            ))}
            {cases.map((c) => (
              <div key={c.case_id} className="space-y-2 rounded border border-[var(--line)] p-3 text-[13px]">
                <div>
                  <Link href={`/mail#${c.case_id}/case`} className="font-semibold hover:underline">
                    {c.case_id.replace("case:", "")}
                  </Link>{" "}
                  <span className="text-[var(--ink-2)]">{c.title}</span>
                </div>
                <p className="text-[12.5px] text-[var(--ink-2)]">
                  The case expects {s.id} to move <strong>{c.path !== null ? signed(c.path * 100) : "—"}</strong> over the contract; carrying an index
                  clause adds a risk charge of {c.risk_pct ?? "—"} % of the indexed spend. Cost of each clause option, as a share of spend (brief: share ×
                  max(0, |move| − deadband) + share × risk):
                </p>
                {c.path !== null && c.risk_pct !== null && (
                  <div className="overflow-x-auto rounded border border-[var(--line)]">
                    <table className="w-full text-[12.5px] tabular-nums">
                      <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                        <tr>
                          <th className="px-2.5 py-1.5 font-medium">Option</th>
                          <th className="px-2.5 py-1.5 text-right font-medium">Index move passed on</th>
                          <th className="px-2.5 py-1.5 text-right font-medium">Risk charge</th>
                          <th className="px-2.5 py-1.5 text-right font-medium">Total, % of spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-[var(--line)]">
                          <td className="px-2.5 py-1.5">No clause (fixed price)</td>
                          <td className="px-2.5 py-1.5 text-right">0.00 %</td>
                          <td className="px-2.5 py-1.5 text-right">0.00 %</td>
                          <td className="px-2.5 py-1.5 text-right font-semibold">0.00 %</td>
                        </tr>
                        {c.options.map((o) => {
                          const total = clauseCostPct(o, c.path!, c.risk_pct!);
                          const risk = o.material_share * c.risk_pct!;
                          return (
                            <tr key={`${o.material_share}-${o.deadband_pct}`} className="border-t border-[var(--line)]">
                              <td className="px-2.5 py-1.5">
                                share {Math.round(o.material_share * 100)} %, deadband {o.deadband_pct} %
                              </td>
                              <td className="px-2.5 py-1.5 text-right">{(total - risk).toFixed(2)} %</td>
                              <td className="px-2.5 py-1.5 text-right">{risk.toFixed(2)} %</td>
                              <td className="px-2.5 py-1.5 text-right font-semibold">{total.toFixed(2)} %</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {c.path !== null && (
                  <p className="text-[12px] text-[var(--muted)]">
                    {c.path > 0
                      ? "With the index expected to rise, a clause passes that rise on to us and adds the risk charge. Take one only if the supplier lowers the base price by more than the total above."
                      : "With the index expected to fall, a clause passes the fall on to us; weigh that against the risk charge."}
                  </p>
                )}
              </div>
            ))}
          </Card>
        )}

        <Card title="About this series">
          <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-[var(--ink-2)]">Source</dt>
            <dd>{s.source ?? "—"}</dd>
            {s.licence && (
              <>
                <dt className="text-[var(--ink-2)]">Licence</dt>
                <dd>{s.licence}</dd>
              </>
            )}
            {s.formula && (
              <>
                <dt className="text-[var(--ink-2)]">Formula</dt>
                <dd className="font-mono text-[12px]">{s.formula}</dd>
              </>
            )}
            {s.url && (
              <>
                <dt className="text-[var(--ink-2)]">Data URL</dt>
                <dd className="min-w-0 break-all">
                  <a href={s.url} className="text-[var(--accent-ink)] hover:underline" target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                </dd>
              </>
            )}
            <dt className="text-[var(--ink-2)]">Months</dt>
            <dd>
              {s.values.length} ({s.first_month} → {s.last_month})
            </dd>
          </dl>
        </Card>
      </div>
    </main>
  );
}
