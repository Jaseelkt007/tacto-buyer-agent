import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DemandBars } from "@/components/charts/DemandBars";
import { BackIcon } from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { caseCoverage, demandData, findDemand, PURPOSE_LABEL, type CaseCoverage, type DemandPart } from "@/lib/demand";
import { money } from "@/lib/format";
import { data as inbox } from "@/lib/inbox";
import { latestAsk, partData } from "@/lib/parts";

export function generateStaticParams() {
  return demandData.parts.map((p) => ({ id: p.id.replace("part:", "") }));
}

export async function generateMetadata({ params }: PageProps<"/demand/[id]">): Promise<Metadata> {
  const p = findDemand(`part:${(await params).id}`);
  return { title: `${p?.description ?? "Part"} · Demand · ProcuDeal` };
}

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;

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

/** Quotes a case cites (its refs or its alternative): only those are citable claims in that case. */
function caseQuotes() {
  const m = new Map<string, string[]>();
  for (const c of inbox.cases) {
    const ids = [...c.refs, c.buyer.alternative?.ref ?? ""].filter((r) => r.startsWith("quote:"));
    for (const id of ids) m.set(id, [...(m.get(id) ?? []), c.case_id.replace("case:", "")]);
  }
  return m;
}

function Findings({ p, price, cov }: { p: DemandPart; price: number | null; cov: CaseCoverage[] }) {
  const out: ReactNode[] = [];
  const l = p.latest;
  if (l?.change_pct != null) {
    out.push(
      l.change_pct > 0 ? (
        <>
          Our forecast for the next 12 months ({num(l.qty_next_12m)} {p.uom}) is <strong>{signed(l.change_pct)}</strong> above what we called off in the last 12
          months ({num(l.called_off_12m)}) <DataId id={l.id} />. More volume is worth something to the supplier: our agent cites this as its volume argument.
        </>
      ) : (
        <>
          Our forecast ({num(l.qty_next_12m)} {p.uom}) is <strong>{signed(l.change_pct)}</strong> against the last 12 months <DataId id={l.id} />: no volume
          argument here, and a supplier may use the fall against us.
        </>
      ),
    );
  }
  const active = p.sources.filter((s) => s.status === "active");
  const other = p.sources.filter((s) => s.status !== "active");
  if (p.sources.length === 1) out.push(<>Single source: only {active[0]?.supplier ?? p.sources[0].supplier} is on the source list. Walking away is costly.</>);
  else if (other.length) out.push(<>Qualified second source: {other.map((s) => s.supplier).join(", ")} (quota 0 %). A real alternative if its price is right.</>);
  const rfq = p.rfqs[0];
  const rival = rfq?.quotes.find((q) => !q.awarded);
  if (rfq && rival && price !== null) {
    out.push(
      <>
        Latest RFQ <DataId id={rfq.id} /> ({rfq.date}, {PURPOSE_LABEL[rfq.purpose] ?? rfq.purpose}): {rival.supplier} quoted {money(rival.unit_price)} <DataId id={rival.id} />,{" "}
        <strong>{signed((rival.unit_price / price - 1) * 100)}</strong> against today&apos;s {money(price)}
        {rival.unit_price > price ? ": the alternative is dearer, so it gives us no leverage on price." : ": a cheaper alternative we can point to."}
      </>,
    );
  }
  for (const c of cov) {
    const best = [...c.cells].sort((a, b) => a.premium - b.premium)[0];
    const worst = [...c.cells].sort((a, b) => b.premium - a.premium)[0];
    if (c.cells.length > 1 && worst.premium > 0) {
      out.push(
        <>
          {c.case_id.replace("case:", "")}: the coverage trap. Covering less than {num(c.need)} {p.uom} a year for {c.horizon} {c.horizon === 1 ? "year" : "years"} costs
          up to <strong className="text-[var(--bad)]">{eur0.format(worst.premium)}</strong> more than buying at today&apos;s price ({num(worst.volume)} a year for{" "}
          {worst.months} months); full coverage ({num(best.volume)} for {best.months} months) avoids it. A lower price only wins if it saves more than that.
        </>,
      );
    }
  }
  if (!out.length) return null;
  return (
    <section className="space-y-2 rounded-md border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]">What the data says</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed">
        {out.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

function CoverageTable({ c, uom }: { c: CaseCoverage; uom: string }) {
  const max = Math.max(1, ...c.cells.map((x) => x.premium));
  return (
    <div className="space-y-2 rounded border border-[var(--line)] p-3">
      <div className="text-[13px]">
        <Link href={`/mail#${c.case_id}/case`} className="font-semibold hover:underline">
          {c.case_id.replace("case:", "")}
        </Link>{" "}
        <span className="text-[var(--ink-2)]">{c.title}</span>
      </div>
      <p className="text-[12.5px] text-[var(--ink-2)]">
        Need {num(c.need)} {uom} a year over {c.horizon} {c.horizon === 1 ? "year" : "years"} = {num(c.need * c.horizon)}. Whatever the deal does not cover is bought
        later at the fallback price {money(c.fallback)} + {c.riskPct} % risk = {money(c.fallback * (1 + c.riskPct / 100))}
        {c.current !== null && <> (today: {money(c.current)})</>}. Each cell: units left uncovered, and what they cost on top of buying them at today&apos;s price.
      </p>
      <div className="overflow-x-auto rounded border border-[var(--line)]">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Volume a year {c.fixedVolume && "(fixed)"}</th>
              {c.months.map((m) => (
                <th key={m} className="px-2.5 py-1.5 text-right font-medium">
                  {m} months {c.fixedMonths && "(fixed)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.volumes.map((v) => (
              <tr key={v} className="border-t border-[var(--line)]">
                <td className="px-2.5 py-1.5">
                  {num(v)} {uom}
                  {v === c.need && <span className="text-[var(--muted)]"> = need</span>}
                </td>
                {c.months.map((m) => {
                  const cell = c.cells.find((x) => x.volume === v && x.months === m)!;
                  const ok = cell.uncovered === 0;
                  return (
                    <td
                      key={m}
                      className="px-2.5 py-1.5 text-right"
                      style={ok ? undefined : { background: `color-mix(in oklab, var(--bad) ${Math.round((cell.premium / max) * 28) + 4}%, transparent)` }}
                    >
                      {ok ? (
                        <span className="text-[var(--good)]">✓ covered</span>
                      ) : (
                        <>
                          <span className="font-semibold">+{eur0.format(cell.premium)}</span>
                          <div className="text-[11px] text-[var(--ink-2)]">{num(cell.uncovered)} uncovered</div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/demand/[id]">) {
  const p = findDemand(`part:${(await params).id}`);
  if (!p) notFound();
  const part = partData.parts.find((x) => x.id === p.id);
  const price = part?.suppliers.find((s) => s.current_price !== null)?.current_price ?? null;
  const ask = part ? latestAsk(part) : null;
  const cov = caseCoverage(p.id);
  const inCase = caseQuotes();
  const l = p.latest;

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <Link href="/demand" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
            <BackIcon width={14} height={14} /> All parts
          </Link>
          <h1 className="text-[22px] font-semibold">{p.description}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-2)]">
            <DataId id={p.id} />
            <span>{p.category}</span>
            {p.abc_class && <>· <span>ABC {p.abc_class}</span></>}
            <span>· demand and sourcing</span>
            <Link href={`/parts/${p.id.replace("part:", "")}`} className="text-[var(--accent-ink)] hover:underline">
              · price and cost →
            </Link>
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Tile label="Forecast, next 12 months" value={l ? num(l.qty_next_12m) : "—"} sub={l ? `${p.uom} · snapshot ${l.month}` : undefined} />
          <Tile label="Called off, last 12 months" value={l ? num(l.called_off_12m) : "—"} sub="by requested month" />
          <Tile label="Change" value={l?.change_pct != null ? signed(l.change_pct) : "—"} sub={l ? <span className="font-mono text-[11px]">{l.id}</span> : undefined} />
          <Tile label="Open orders" value={num(p.open_orders_qty)} sub={`${p.uom}, due after the data date`} />
          <Tile
            label="Sources"
            value={`${p.sources.filter((s) => s.status === "active").length} active`}
            sub={`${p.sources.filter((s) => s.status !== "active").length} qualified`}
          />
          <Tile label="Price today" value={price !== null ? money(price) : "—"} sub={ask?.asked_price != null ? `asked ${money(ask.asked_price)}` : undefined} />
        </div>

        <Findings p={p} price={price} cov={cov} />

        <Card
          id="forecast"
          title="Demand"
          hint="What we ordered per month (by requested date) for the last 24 months, and the latest forecast for the next 12. The case's need per year is usually the latest forecast."
        >
          <DemandBars past={p.calloff_history} future={p.forecast_lines} unit={p.uom} />
          <div className="overflow-x-auto rounded border border-[var(--line)]">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Forecast</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Next 12 months</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Called off, prior 12 months</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Change</th>
                  <th className="px-2.5 py-1.5 font-medium">Citable</th>
                </tr>
              </thead>
              <tbody>
                {[...p.snapshots].reverse().map((s) => (
                  <tr key={s.id} id={s.id} className="scroll-mt-4 border-t border-[var(--line)] target:bg-[var(--select)]">
                    <td className="px-2.5 py-1.5 font-mono text-[11.5px]">{s.id}</td>
                    <td className="px-2.5 py-1.5 text-right">{num(s.qty_next_12m)}</td>
                    <td className="px-2.5 py-1.5 text-right">{num(s.called_off_12m)}</td>
                    <td className="px-2.5 py-1.5 text-right">{s.change_pct !== null ? signed(s.change_pct) : "—"}</td>
                    <td className="px-2.5 py-1.5">
                      {s.citable ? "yes" : <span className="text-[var(--muted)]">no: order history starts 2023-10, so the prior 12 months are incomplete</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            Forecasts are shared with suppliers. The arena checks an fc: claim against the change in the last column (±0.5 percentage points).
          </p>
        </Card>

        {cov.length > 0 && (
          <Card
            id="coverage"
            title="Coverage"
            hint="The brief's formula: years = min(contract months ÷ 12, horizon); covered = min(volume, need) × years; uncovered = need × horizon − covered, bought at fallback × (1 + risk)."
          >
            {cov.map((c) => (
              <CoverageTable key={c.case_id} c={c} uom={p.uom} />
            ))}
          </Card>
        )}

        <Card title="Source list" hint="Approved suppliers for this part, their quota and who owns the tooling.">
          {p.sources.length ? (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px] tabular-nums">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Supplier</th>
                    <th className="px-2.5 py-1.5 font-medium">Status</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Quota</th>
                    <th className="px-2.5 py-1.5 font-medium">Approved since</th>
                    <th className="px-2.5 py-1.5 font-medium">Tooling</th>
                  </tr>
                </thead>
                <tbody>
                  {p.sources.map((s) => (
                    <tr key={s.supplier_id} className="border-t border-[var(--line)]">
                      <td className="px-2.5 py-1.5">
                        <DataId id={s.supplier_id} /> {s.supplier} <span className="text-[var(--muted)]">{s.country}</span>
                      </td>
                      <td className="px-2.5 py-1.5">{s.status}</td>
                      <td className="px-2.5 py-1.5 text-right">{s.quota_pct} %</td>
                      <td className="px-2.5 py-1.5">{s.approved_since ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{s.tooling_owner ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No approved source yet.</p>
          )}
        </Card>

        <Card
          id="rfqs"
          title="RFQs and quotes"
          hint="Every request for quotation for this part, newest first, quotes cheapest first. A past quote is context; it is a checkable claim only in a case that cites it (its refs or its alternative)."
        >
          {p.rfqs.length ? (
            p.rfqs.map((r) => (
              <div key={r.id} id={r.id} className="scroll-mt-4 space-y-2 rounded border border-[var(--line)] p-3 target:border-[var(--accent)]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                  <DataId id={r.id} />
                  <span className="font-semibold">{PURPOSE_LABEL[r.purpose] ?? r.purpose}</span>
                  <span className="text-[var(--ink-2)]">
                    {r.date} · {num(r.qty_per_year)} {p.uom} a year · {r.status}
                  </span>
                </div>
                <div className="overflow-x-auto rounded border border-[var(--line)]">
                  <table className="w-full text-[12.5px] tabular-nums">
                    <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                      <tr>
                        <th className="px-2.5 py-1.5 font-medium">Quote</th>
                        <th className="px-2.5 py-1.5 font-medium">Supplier</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">Price</th>
                        <th className="px-2.5 py-1.5 text-right font-medium">vs today</th>
                        <th className="px-2.5 py-1.5 font-medium">Lead · Incoterm · payment</th>
                        <th className="px-2.5 py-1.5 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.quotes.map((q) => (
                        <tr key={q.id} id={q.id} className="scroll-mt-4 border-t border-[var(--line)] target:bg-[var(--select)]">
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            <span className="font-mono text-[11.5px]">{q.id}</span>
                            {inCase.get(q.id) && <div className="text-[11px] text-[var(--accent-ink)]">cited in {inCase.get(q.id)!.join(", ")}</div>}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {q.supplier} <span className="text-[var(--muted)]">{q.country}</span>
                            {q.awarded && <span className="ml-1 rounded bg-[var(--good-bg)] px-1.5 text-[11px] text-[var(--good)]">awarded</span>}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-semibold">{money(q.unit_price)}</td>
                          <td className="px-2.5 py-1.5 text-right">{price !== null ? signed((q.unit_price / price - 1) * 100) : "—"}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">
                            {q.lead_time_days ?? "—"} d · {q.incoterm ?? "—"} · {q.payment_days ?? "—"} d{q.tooling_eur > 0 && <> · tooling {eur0.format(q.tooling_eur)}</>}
                          </td>
                          <td className="px-2.5 py-1.5 text-[var(--ink-2)]">
                            {q.missing_fields.length > 0 && <div className="text-[11.5px]">left out: {q.missing_fields.join(", ").replace(/_/g, " ")}</div>}
                            {q.remarks && <q className="italic">{q.remarks}</q>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No RFQs for this part.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
