import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TrendLine } from "@/components/charts/TrendLine";
import { BackIcon } from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { ScoreDot } from "@/components/suppliers/SupplierTable";
import {
  CLAUSE_LABEL,
  contractData,
  daysFromAsOf,
  DELIVERY_BUCKETS,
  findContract,
  LAST_FY,
  OTD_TARGET,
  PAYMENT_BUCKETS,
  type Contract,
} from "@/lib/contracts";

export function generateStaticParams() {
  return contractData.contracts.map((c) => ({ id: c.id.replace("ctr:", "") }));
}

export async function generateMetadata({ params }: PageProps<"/contracts/[id]">): Promise<Metadata> {
  const c = findContract((await params).id);
  return { title: `${c ? `${c.supplier} contract` : "Contract"} · ProcuDeal` };
}

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const when = (d: number) => (d < 0 ? `${-d} days before the data date` : d === 0 ? "on the data date" : `${d} days after the data date`);

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

function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "bad" }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[11.5px] text-[var(--muted)]">{label}</div>
      <div className={`text-[18px] font-semibold tabular-nums ${tone === "bad" ? "text-[var(--bad)]" : ""}`}>{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

/** Horizontal bars for a distribution; one series, one hue, counts labelled. */
function Dist({ rows }: { rows: { label: string; n: number; good?: boolean }[] }) {
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-2 text-[12.5px]">
          <span className="truncate text-[var(--ink-2)]">{r.label}</span>
          <span className="h-2 rounded-r bg-[var(--surface-3)]">
            <span className={`block h-2 rounded-r ${r.good ? "bg-[var(--good)]" : "bg-[var(--s-ours)]"}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">
            {r.n} <span className="text-[var(--muted)]">({Math.round((r.n / total) * 100)} %)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Findings({ c }: { c: Contract }) {
  const out: ReactNode[] = [];
  if (c.termination_deadline) {
    const d = daysFromAsOf(c.termination_deadline);
    out.push(
      <>
        Runs to <strong>{c.valid_to}</strong> and renews unless terminated with {c.term_notice_days} days&apos; notice: the last day to act is{" "}
        <strong className={d <= 30 ? "text-[var(--bad)]" : ""}>{c.termination_deadline}</strong> ({when(d)}).
      </>,
    );
  }
  if (c.price_change_deadline && c.price_basis === "fixed per year") {
    out.push(
      <>
        Prices are fixed per calendar year. A change for 2027 needed notice by <strong>{c.price_change_deadline}</strong> (
        <DataId id={c.clauses.find((x) => x.type === "price")?.id ?? c.id} />
        ). A price letter that gives less notice can be cited against the contract; the arena checks the letter&apos;s days against the
        clause&apos;s.
      </>,
    );
  }
  const d = c.delivery;
  if (d.otd_requested_12m !== null) {
    out.push(
      <>
        Delivered <strong className={d.otd_requested_12m < OTD_TARGET ? "text-[var(--bad)]" : ""}>{d.otd_requested_12m} %</strong> on time in the
        last 12 months (target {OTD_TARGET} %; {d.otd_confirmed_12m} % against its own confirmed dates)
        {d.median_days_late_when_late !== null && <>, typically {d.median_days_late_when_late} days late when late</>}.
        {d.otd_requested_12m < OTD_TARGET && c.scorecard && (
          <>
            {" "}
            Citable: <DataId id={c.scorecard.id} /> (the arena checks the mean on-time % of the cited scorecards).
          </>
        )}
      </>,
    );
  }
  const q = c.quality;
  const qy = q.per_year[LAST_FY];
  if (qy) {
    out.push(
      <>
        {qy.supplier_caused} supplier-caused complaints in the last 12 months ({eur0.format(qy.recharged_eur)} recharged at the €150 flat fee)
        {q.overdue_8d > 0 && (
          <>
            ; <strong className="text-[var(--bad)]">{q.overdue_8d} 8D reports overdue</strong> (older than 60 days)
          </>
        )}
        .
      </>,
    );
  }
  const p = c.payment;
  if (p.late_share_12m !== null && p.avg_days_late_12m !== null && p.avg_days_late_12m > 0) {
    out.push(
      <>
        <strong>We</strong> paid {p.late_share_12m} % of its invoices late, <strong className={p.avg_days_late_12m >= 7 ? "text-[var(--bad)]" : ""}>{p.avg_days_late_12m} days</strong>{" "}
        after the due date on average (worst {p.max_days_late_12m}). The supplier has a fair complaint here; paying on time, or earlier, is something we can
        offer in exchange for price.
      </>,
    );
  }
  if (p.discounts_taken_late > 0) {
    out.push(
      <>
        We took {p.discounts_taken_late} cash discounts after the {p.skonto?.days ?? "?"}-day discount period ({eur0.format(p.late_discount_eur)}): the supplier
        can claim that back.
      </>,
    );
  }
  return (
    <section className="space-y-2 rounded-md border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]">What the record says</h2>
      <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed">
        {out.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </section>
  );
}

const POLICY: Record<string, (c: Contract) => string | null> = {
  payment: (c) => (c.payment_days !== null && c.payment_days < 60 ? `Shorter than our standard 60 days net: we pay ${60 - c.payment_days} days earlier than policy.` : null),
  delivery: (c) => (c.incoterm && c.incoterm !== "DAP" ? `${c.incoterm}, not our preferred DAP: we book and pay the freight.` : null),
};

export default async function Page({ params }: PageProps<"/contracts/[id]">) {
  const c = findContract((await params).id);
  if (!c) notFound();
  const d = c.delivery;
  const q = c.quality;
  const p = c.payment;
  const years = [...new Set([...Object.keys(q.per_year), ...Object.keys(p.per_year)])].sort();
  const deadline = c.termination_deadline ? daysFromAsOf(c.termination_deadline) : null;

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-2">
          <Link href="/contracts" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
            <BackIcon width={14} height={14} /> All contracts
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold">
              {c.type[0].toUpperCase() + c.type.slice(1)} · {c.supplier}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-2)]">
              <DataId id={c.id} />
              <DataId id={c.supplier_id} />
              <span>
                {c.valid_from} → {c.valid_to}
              </span>
              · <span>{c.price_basis}</span>
            </p>
          </div>
          {c.parts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span className="text-[var(--ink-2)]">Covers:</span>
              {c.parts.map((x) => (
                <span key={x.id} className="inline-flex items-center gap-1">
                  <DataId id={x.id} /> {x.description}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Tile
            label="Act by"
            value={c.termination_deadline ?? "—"}
            sub={deadline !== null ? `${deadline < 0 ? `${-deadline} days ago` : `in ${deadline} days`} · ends ${c.valid_to}` : undefined}
            tone={deadline !== null && deadline <= 30 ? "bad" : undefined}
          />
          <Tile
            label="On time, 12 months"
            value={d.otd_requested_12m !== null ? `${d.otd_requested_12m} %` : "—"}
            sub={`target ${OTD_TARGET} % · ${d.receipts_12m} receipts`}
            tone={d.otd_requested_12m !== null && d.otd_requested_12m < OTD_TARGET ? "bad" : undefined}
          />
          <Tile
            label="Scorecard"
            value={
              c.scorecard ? (
                <span className="inline-flex items-center gap-2">
                  <ScoreDot colour={c.scorecard.colour} />
                  {c.scorecard.score}
                </span>
              ) : (
                "—"
              )
            }
            sub={c.scorecard ? `class ${c.scorecard.class} · ${c.scorecard.ppm} ppm` : undefined}
          />
          <Tile label="Complaints, 12 months" value={q.per_year[LAST_FY]?.supplier_caused ?? 0} sub={q.overdue_8d ? `${q.overdue_8d} 8D overdue` : "no 8D overdue"} />
          <Tile
            label="We pay, 12 months"
            value={p.avg_days_late_12m !== null ? `${p.avg_days_late_12m > 0 ? "+" : ""}${p.avg_days_late_12m} days` : "—"}
            sub={p.late_share_12m !== null ? `${p.late_share_12m} % of invoices late` : undefined}
            tone={p.avg_days_late_12m !== null && p.avg_days_late_12m >= 7 ? "bad" : undefined}
          />
          <Tile label="Terms" value={`${c.payment_days ?? "—"} d · ${c.incoterm ?? "—"}`} sub={c.price_basis ?? undefined} />
        </div>

        <Findings c={c} />

        <Card id="terms" title="Clauses" hint="The contract text, clause by clause. Notes compare it with company policy (60 days net, DAP, 95 % on time, €150 per complaint).">
          <ol className="space-y-2">
            {c.clauses.map((x) => {
              const note = POLICY[x.type]?.(c);
              return (
                <li
                  key={x.id}
                  id={`clause-${x.clause}`}
                  className="scroll-mt-4 rounded border border-[var(--line)] p-2.5 target:border-[var(--accent)] target:bg-[var(--select)]"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-2)]">
                    <span className="font-semibold text-[var(--ink)]">§ {x.clause}</span>
                    <span className="rounded bg-[var(--surface-3)] px-1.5">{CLAUSE_LABEL[x.type] ?? x.type}</span>
                    <DataId id={x.id} />
                    {x.days !== null && (x.type === "price" || x.type === "term") && <span>{x.days} days&apos; notice</span>}
                    {x.series && (
                      <>
                        <Link href={`/market/${x.series}`} className="font-mono text-[11.5px] text-[var(--accent-ink)] hover:underline">
                          {x.series}
                        </Link>
                        <span>
                          share {Math.round((x.material_share ?? 0) * 100)} % · deadband {x.deadband_pct} %
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-[13.5px]">{x.text}</p>
                  {note && <p className="mt-1 text-[12px] text-[var(--bad)]">{note}</p>}
                </li>
              );
            })}
          </ol>
        </Card>

        <Card
          id="delivery"
          title="Delivery"
          hint="Each goods receipt against its order line's requested date. On time = posted between 5 days early and 2 days late (scorecard method); partial deliveries count separately."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendLine
              title="On time per month"
              unit="pct"
              target={{ value: OTD_TARGET, label: `target ${OTD_TARGET} %` }}
              points={d.monthly.slice(-24).map((m) => ({ label: m.month, value: m.otd_pct, note: `${m.lines} receipts` }))}
            />
            <div className="space-y-2">
              <div className="text-[12.5px] font-semibold">Last 12 months, {d.receipts_12m} receipts</div>
              <Dist rows={DELIVERY_BUCKETS.map(([k, label]) => ({ label, n: d.buckets_12m[k], good: k === "on_time" }))} />
              <p className="text-[12px] text-[var(--ink-2)]">
                Against its own first confirmed dates: {d.otd_confirmed_12m ?? "—"} % on time. Since 2023-10: {d.po_lines} order lines, {d.rush_orders}{" "}
                rush and {d.changed_orders} changed orders, {d.open_orders} still open
                {d.stale_price_lines > 0 && <>, {d.stale_price_lines} ordered at an outdated price</>}.
              </p>
            </div>
          </div>
        </Card>

        <Card id="quality" title="Quality" hint="Quality notifications (qn:). Supplier-caused complaints are recharged at the €150 flat fee; an 8D report is due within 60 days.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[12.5px] font-semibold">Defects, supplier-caused, since 2023-10 ({q.complaint_qty} parts)</div>
              {q.defects.length ? (
                <Dist rows={q.defects.map((x) => ({ label: x.defect, n: x.qty }))} />
              ) : (
                <p className="text-[13px] text-[var(--muted)]">No supplier-caused complaints.</p>
              )}
            </div>
            <div className="space-y-2 text-[12.5px]">
              <div className="font-semibold">8D reports</div>
              <p className="text-[var(--ink-2)]">
                Median {q.median_8d_days ?? "—"} days to close; {q.late_8d} closed after 60 days; {q.open_8d} open, of which{" "}
                <span className={q.overdue_8d ? "font-semibold text-[var(--bad)]" : ""}>{q.overdue_8d} overdue</span>. {q.returned_qty} parts returned in
                total; {eur0.format(q.recharged_eur)} recharged.
              </p>
            </div>
          </div>
          {q.recent.length > 0 && (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Notification</th>
                    <th className="px-2.5 py-1.5 font-medium">Part</th>
                    <th className="px-2.5 py-1.5 font-medium">Defect</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Qty</th>
                    <th className="px-2.5 py-1.5 font-medium">Cause</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">8D</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {q.recent.map((x) => (
                    <tr key={x.id} id={x.id} className="scroll-mt-4 border-t border-[var(--line)] target:bg-[var(--select)]">
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className="font-mono text-[11.5px]">{x.id}</span>
                        <div className="text-[11px] text-[var(--muted)]">{x.date}</div>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <DataId id={x.part_id} /> <span className="text-[var(--ink-2)]">{x.part}</span>
                      </td>
                      <td className="px-2.5 py-1.5">{x.defect}</td>
                      <td className="px-2.5 py-1.5 text-right">{x.complaint_qty}</td>
                      <td className="px-2.5 py-1.5">{x.supplier_caused ? "supplier" : "not supplier"}</td>
                      <td className="px-2.5 py-1.5 text-right">{x.d8_days !== null ? `${x.d8_days} d` : <span className="text-[var(--bad)]">open</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[12px] text-[var(--muted)]">The 12 most recent notifications. The scorecards on the supplier page give the rolling ppm.</p>
        </Card>

        <Card id="payment" title="Our payments" hint="Invoices (inv:) against their due date. This is our side of the relationship: suppliers notice when we pay late.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[12.5px] font-semibold">Last 12 months, {p.paid_12m} invoices paid</div>
              <Dist rows={PAYMENT_BUCKETS.map(([k, label]) => ({ label, n: p.buckets_12m[k], good: k === "on_time" }))} />
            </div>
            <div className="space-y-1.5 text-[12.5px] text-[var(--ink-2)]">
              <p>
                Invoice terms: {p.terms_days ?? "—"} days. {p.unpaid} invoices unpaid at the data date
                {p.overdue_now > 0 && <>, {p.overdue_now} already past due</>}.
              </p>
              <p>
                Cash discount:{" "}
                {p.skonto
                  ? `${p.skonto.pct} % within ${p.skonto.days} days. Taken ${p.discounts_taken} times, ${p.discounts_taken_late} of them after the discount period (${eur0.format(p.late_discount_eur)}).`
                  : p.discounts_taken
                    ? `none agreed, yet taken ${p.discounts_taken} times (${eur0.format(p.late_discount_eur)}).`
                    : "none agreed."}
              </p>
            </div>
          </div>
        </Card>

        <Card title="By fiscal year" hint="October to September.">
          <div className="overflow-x-auto rounded border border-[var(--line)]">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Year</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Invoiced</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Invoices</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Paid late</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Avg days late</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Complaints</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Recharged</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y} className="border-t border-[var(--line)]">
                    <td className="px-2.5 py-1.5">{y}</td>
                    <td className="px-2.5 py-1.5 text-right">{p.per_year[y] ? eur0.format(p.per_year[y].amount_eur) : "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">{p.per_year[y]?.invoices ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">{p.per_year[y] ? `${p.per_year[y].late_share} %` : "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">{p.per_year[y]?.avg_days_late ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">{q.per_year[y]?.supplier_caused ?? 0}</td>
                    <td className="px-2.5 py-1.5 text-right">{q.per_year[y] ? eur0.format(q.per_year[y].recharged_eur) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
