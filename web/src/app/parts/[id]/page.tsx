import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PriceHistory, type PriceSeries, type RefLine } from "@/components/charts/PriceHistory";
import { BackIcon } from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { CostLegend, CostStack, Sparkline } from "@/components/parts/CostBits";
import { money } from "@/lib/format";
import {
  BASIS_LABEL,
  findPart,
  latestAsk,
  LATEST_PO_FY,
  PO_YEARS,
  partAppearances,
  partData,
  perUnit,
  type Part,
  type PartSupplier,
} from "@/lib/parts";

export function generateStaticParams() {
  return partData.parts.map((p) => ({ id: p.id.replace("part:", "") }));
}

export async function generateMetadata({ params }: PageProps<"/parts/[id]">): Promise<Metadata> {
  const p = findPart(`part:${(await params).id}`);
  return { title: `${p?.description ?? "Part"} · ProcuDeal` };
}

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)} %`;
const month = (id: string) => id.split("@")[1] ?? id;

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

/** The findings a buyer would say out loud, each with the ID that proves it. */
function Findings({ p, main }: { p: Part; main: PartSupplier | undefined }) {
  const ask = latestAsk(p);
  const falls = p.drivers.filter((d) => d.best_fall);
  const out: ReactNode[] = [];
  if (ask?.asked_pct != null) {
    out.push(
      <>
        <strong>{p.suppliers.find((s) => s.supplier_id === ask.supplier_id)?.name ?? ask.supplier_id}</strong> asks{" "}
        <strong>{signed(ask.asked_pct)}</strong>
        {ask.asked_price != null && <> (to {money(ask.asked_price)})</>}
        {ask.effective_date && <> from {ask.effective_date}</>} <DataId id={ask.id} />.
      </>,
    );
  }
  if (p.implied_change_12m_pct !== null) {
    const gap = ask?.asked_pct != null ? ask.asked_pct - p.implied_change_12m_pct : null;
    out.push(
      <>
        {Math.round(p.index_share * 100)} % of its cost follows market indices; over the last 12 months they moved its
        cost by <strong>{signed(p.implied_change_12m_pct)}</strong>
        {gap !== null && gap > 0.5 && (
          <>
            . That leaves <strong>{gap.toFixed(1)} points</strong> of the ask that the market does not explain
          </>
        )}
        .
      </>,
    );
  }
  if (falls.length) {
    out.push(
      <>
        Index falls our agent can cite:{" "}
        {falls.map((d, i) => (
          <span key={d.series_id}>
            {i > 0 && "; "}
            {d.name.replace(/^Producer prices DE: /, "")} <strong>{signed(d.best_fall!.pct)}</strong> ({month(d.best_fall!.from)} → {month(d.best_fall!.to)})
          </span>
        ))}
        .
      </>,
    );
  }
  if (main?.margin_pct != null && main.full_cost) {
    out.push(
      main.margin_pct < 0 ? (
        <>
          Today&apos;s price {money(main.current_price)} is <strong className="text-[var(--bad)]">below</strong> its full cost (margin{" "}
          <strong className="text-[var(--bad)]">{main.margin_pct} %</strong>){" "}
          {money(main.full_cost.unit_cost)} <DataId id={main.full_cost.source} />: the supplier loses money on this part. Squeezing it further adds risk,
          and for strategic and bottleneck parts the score charges for a supplier left below a sustainable margin.
        </>
      ) : (
        <>
          Today&apos;s price {money(main.current_price)} carries a <strong>{main.margin_pct} % margin</strong> over its full cost{" "}
          {money(main.full_cost.unit_cost)} <DataId id={main.full_cost.source} />
          {main.should_cost_claim ? ": our agent can argue should-cost." : ", too thin for our agent to argue should-cost (it needs the cost below 98 % of the price)."}
        </>
      ),
    );
  }
  const below = p.conditions.find((c) => c.event?.note);
  if (below?.event?.note) {
    out.push(
      <>
        Past rounds note: <q className="italic">{below.event.note}</q> ({below.event.event_id}).
      </>,
    );
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

function SupplierCost({ p, s, max }: { p: Part; s: PartSupplier; max: number }) {
  const row = s.full_cost ? p.should_cost.find((c) => c.id === s.full_cost!.source) : undefined;
  const k = row && s.full_cost ? s.full_cost.unit_cost / row.unit_cost : 1;
  return (
    <div className="space-y-2 rounded border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="font-semibold">{s.name}</span>
        <DataId id={s.supplier_id} />
        <span className="text-[var(--ink-2)]">
          {s.country} · {s.status ?? "no source-list entry"}
          {s.quota_pct !== null && ` · quota ${s.quota_pct} %`}
          {s.tooling_owner && ` · tooling: ${s.tooling_owner}`}
        </span>
      </div>
      <div className="grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-3">
        <div>
          <span className="text-[var(--muted)]">Price </span>
          <span className="font-semibold tabular-nums">{s.current_price !== null ? money(s.current_price) : "not buying"}</span>
          {s.current_since && (
            <span className="text-[var(--muted)]">
              {" "}
              since {s.current_since} ({BASIS_LABEL[s.current_basis ?? ""] ?? s.current_basis})
            </span>
          )}
        </div>
        <div>
          <span className="text-[var(--muted)]">Full cost </span>
          <span className="font-semibold tabular-nums">{s.full_cost ? money(s.full_cost.unit_cost) : "no estimate"}</span>
          {s.full_cost && <span className="text-[var(--muted)]"> ({s.full_cost.how})</span>}
        </div>
        <div>
          <span className="text-[var(--muted)]">Should-cost argument </span>
          <span className={`font-semibold ${s.should_cost_claim ? "text-[var(--good)]" : ""}`}>
            {s.current_price === null || !s.full_cost ? "—" : s.should_cost_claim ? "yes" : "no"}
          </span>
        </div>
      </div>
      {row && (
        <CostStack
          material={row.material_eur * k}
          conversion={row.conversion_eur * k}
          overhead={row.overhead_eur * k}
          price={s.current_price}
          max={max}
        />
      )}
    </div>
  );
}

export default async function Page({ params }: PageProps<"/parts/[id]">) {
  const p = findPart(`part:${(await params).id}`);
  if (!p) notFound();
  const seen = partAppearances(p.id);
  const main = p.suppliers.find((s) => s.current_price !== null) ?? p.suppliers[0];
  const ask = latestAsk(p);
  const fy = p.po[LATEST_PO_FY];
  const costMax = Math.max(1, ...p.suppliers.flatMap((s) => [s.current_price ?? 0, s.full_cost?.unit_cost ?? 0]));

  // Price history series: suppliers in source-list order keep their colour slot.
  const withPrices = p.suppliers.filter((s) => p.conditions.some((c) => c.supplier_id === s.supplier_id)).slice(0, 3);
  const series: PriceSeries[] = withPrices.map((s, i) => ({
    name: s.name,
    slot: (i + 1) as 1 | 2 | 3,
    steps: p.conditions
      .filter((c) => c.supplier_id === s.supplier_id)
      .map((c) => ({ from: c.valid_from, to: c.valid_to, price: c.price, label: `${s.name.split(" ").slice(0, 2).join(" ")} · ${BASIS_LABEL[c.basis] ?? c.basis}` })),
  }));
  const refs: RefLine[] = [];
  if (main?.full_cost) refs.push({ value: main.full_cost.unit_cost, label: `Full cost (${main.name.split(" ").slice(0, 2).join(" ")})`, style: "cost" });
  if (ask?.asked_price != null) refs.push({ value: ask.asked_price, label: `Asked from ${ask.effective_date ?? "?"}`, style: "ask" });

  // History table: newest first, with the change against that supplier's previous price.
  const prev = new Map<string, number>();
  const hist = p.conditions.map((c) => {
    const before = prev.get(c.supplier_id) ?? null;
    prev.set(c.supplier_id, c.price);
    return { c, change: before ? ((c.price - before) / before) * 100 : null };
  });
  hist.sort((a, b) => b.c.valid_from.localeCompare(a.c.valid_from) || a.c.supplier_id.localeCompare(b.c.supplier_id));
  const supName = (id: string) => p.suppliers.find((s) => s.supplier_id === id)?.name ?? id;
  const maxWeight = Math.max(0.01, ...p.drivers.map((d) => d.weight));

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-2">
          <Link href="/parts" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
            <BackIcon width={14} height={14} /> All parts
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold">{p.description}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-2)]">
              <DataId id={p.id} />
              <span>{p.category}</span>
              {p.grade && <>· <span>{p.grade}</span></>}
              {p.net_weight_kg !== null && <>· <span>{p.net_weight_kg} kg</span></>}
              {p.pump_series && <>· <span>pump series {p.pump_series}</span></>}
              {p.abc_class && <>· <span>ABC {p.abc_class}</span></>}
              <span>· prices {perUnit(p)}</span>
              <Link href={`/demand/${p.id.replace("part:", "")}`} className="text-[var(--accent-ink)] hover:underline">
                · demand and sourcing →
              </Link>
              {p.status !== "series" && <span className="rounded bg-[var(--accent-wash)] px-1.5 text-[var(--accent-ink)]">{p.status}</span>}
            </p>
          </div>
          {seen.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span className="text-[var(--ink-2)]">Negotiated in:</span>
              {seen.map((c) => (
                <span key={c.case_id} className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5">
                  <Link href={`/mail#${c.case_id}/case`} className="font-semibold hover:underline" title={c.title}>
                    {c.case_id.replace("case:", "")}
                  </Link>
                  {c.latest && (
                    <Link href={`/negotiations/${c.latest.session_id}`} className="text-[var(--accent-ink)] hover:underline" title={c.latest.version}>
                      replay · {Math.round(c.latest.score * 100)}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Tile label="Price today" value={main?.current_price != null ? money(main.current_price) : "—"} sub={main ? main.name : undefined} />
          <Tile label="Full cost" value={main?.full_cost ? money(main.full_cost.unit_cost) : "—"} sub="what our agent assumes" />
          <Tile
            label="Margin"
            value={main?.margin_pct != null ? signed(main.margin_pct) : "—"}
            sub="(price − full cost) ÷ price"
            tone={main?.margin_pct != null && main.margin_pct < 0 ? "bad" : undefined}
          />
          <Tile label="Drivers, 12 months" value={p.implied_change_12m_pct !== null ? signed(p.implied_change_12m_pct) : "—"} sub={`${Math.round(p.index_share * 100)} % of cost index-linked`} />
          <Tile label="Asked" value={ask?.asked_pct != null ? signed(ask.asked_pct) : "—"} sub={ask ? `letter of ${ask.date}` : "no open price letter"} />
          <Tile label={`Bought ${LATEST_PO_FY}`} value={fy ? eur0.format(fy.spend_eur) : "—"} sub={fy ? `${fy.qty.toLocaleString("en-GB")} ${p.uom}` : undefined} />
        </div>

        <Findings p={p} main={main} />

        <Card
          id="should-cost"
          title="Price against cost"
          hint="Full cost is cost without margin. Our agent uses the should-cost of the supplier's own plant when there is one, else the German estimate scaled by the supplier's country (company rule of thumb)."
        >
          <CostLegend />
          {p.suppliers.length ? (
            <div className="space-y-2">
              {p.suppliers.map((s) => (
                <SupplierCost key={s.supplier_id} p={p} s={s} max={costMax} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No supplier on the source list yet.</p>
          )}
          {p.should_cost.length > 0 && (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Estimate</th>
                    <th className="px-2.5 py-1.5 font-medium">Plant</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Full cost</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Material</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Conversion</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Overhead</th>
                    <th className="px-2.5 py-1.5 font-medium">Error</th>
                    <th className="px-2.5 py-1.5 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {p.should_cost.map((c) => (
                    <tr key={c.id} id={c.id} className="scroll-mt-4 border-t border-[var(--line)] target:bg-[var(--select)]">
                      <td className="px-2.5 py-1.5">
                        <DataId id={c.id} />
                        <div className="text-[11px] text-[var(--muted)]">{c.estimate_date}</div>
                      </td>
                      <td className="px-2.5 py-1.5">{c.supplier_id ? supName(c.supplier_id) : `generic, ${c.cost_base} cost base`}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">{money(c.unit_cost)}</td>
                      <td className="px-2.5 py-1.5 text-right">{money(c.material_eur)}</td>
                      <td className="px-2.5 py-1.5 text-right">{money(c.conversion_eur)}</td>
                      <td className="px-2.5 py-1.5 text-right">{money(c.overhead_eur)}</td>
                      <td className="px-2.5 py-1.5">±{c.confidence_pct} %</td>
                      <td className="px-2.5 py-1.5 text-[var(--ink-2)]">{c.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          id="price-history"
          title="Price history"
          hint="Every price condition since 2023 and the negotiation that set it: what the supplier asked and what was settled."
        >
          <PriceHistory series={series} refs={refs} end="2026-12-31" />
          {hist.length > 0 && (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Valid</th>
                    <th className="px-2.5 py-1.5 font-medium">Supplier</th>
                    <th className="px-2.5 py-1.5 font-medium">Why</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Price</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Change</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Asked → settled</th>
                    <th className="px-2.5 py-1.5 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {hist.map(({ c, change }) => (
                    <tr key={`${c.supplier_id}${c.valid_from}`} className="border-t border-[var(--line)]">
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        {c.valid_from} → {c.valid_to ?? "open"}
                      </td>
                      <td className="max-w-44 truncate px-2.5 py-1.5" title={supName(c.supplier_id)}>
                        {supName(c.supplier_id)}
                      </td>
                      <td className="px-2.5 py-1.5">{BASIS_LABEL[c.basis] ?? c.basis}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold">{money(c.price)}</td>
                      <td className="px-2.5 py-1.5 text-right">{change !== null ? signed(change) : "—"}</td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        {c.event && (c.event.asked_pct !== null || c.event.settled_pct !== null)
                          ? `${c.event.asked_pct !== null ? signed(c.event.asked_pct) : "—"} → ${c.event.settled_pct !== null ? signed(c.event.settled_pct) : "—"}`
                          : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-[var(--ink-2)]">{c.event?.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          id="drivers"
          title="Cost drivers"
          hint="Which market indices drive this part's cost and by how much (category team estimate). Contribution = weight × the index's 12-month change. The shaded window is the fall our agent would cite (≥ 0.5 % within 12 months to the latest month), else the last 12 months."
        >
          {p.drivers.length ? (
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Index</th>
                    <th className="px-2.5 py-1.5 font-medium">Share of cost</th>
                    <th className="px-2.5 py-1.5 font-medium">Last 36 months</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">12-month change</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Contribution</th>
                    <th className="px-2.5 py-1.5 font-medium">Our agent can cite</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {p.drivers.map((d) => {
                    const s = partData.series[d.series_id];
                    const win = d.best_fall ?? d.change_12m;
                    return (
                      <tr key={d.series_id} className="border-t border-[var(--line)]">
                        <td className="px-2.5 py-1.5">
                          <div className="font-medium">{d.name}</div>
                          <div className="font-mono text-[11px] text-[var(--muted)]">
                            {d.series_id}
                            {d.last && ` · latest ${d.last.month}: ${d.last.value}`}
                            {s?.unit && ` (${s.unit})`}
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-16 rounded-r bg-[var(--surface-3)]">
                              <span className="block h-1.5 rounded-r bg-[var(--s-ours)]" style={{ width: `${(d.weight / maxWeight) * 100}%` }} />
                            </span>
                            {Math.round(d.weight * 100)} %
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5">
                          {s && <Sparkline values={s.values} mark={win ? { from: month(win.from), to: month(win.to) } : null} />}
                        </td>
                        <td className="px-2.5 py-1.5 text-right">{d.change_12m ? signed(d.change_12m.pct) : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">{d.contribution_pp !== null ? `${d.contribution_pp > 0 ? "+" : ""}${d.contribution_pp.toFixed(2)} pt` : "—"}</td>
                        <td className="px-2.5 py-1.5">
                          {d.best_fall ? (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[var(--good)]">{signed(d.best_fall.pct)}</span>
                              <div className="flex flex-wrap gap-1">
                                <DataId id={d.best_fall.from} />
                                <DataId id={d.best_fall.to} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">no fall</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="tabular-nums">
                  <tr className="border-t border-[var(--line)] bg-[var(--surface-2)]">
                    <td className="px-2.5 py-1.5 font-medium">Index-linked share</td>
                    <td className="px-2.5 py-1.5">{Math.round(p.index_share * 100)} % (the rest does not follow an index)</td>
                    <td />
                    <td className="px-2.5 py-1.5 text-right font-medium">Weighted</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold">
                      {p.implied_change_12m_pct !== null ? signed(p.implied_change_12m_pct, 2) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No cost drivers recorded.</p>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="What we bought" hint="Purchase order lines by order date, fiscal year October to September.">
            <div className="overflow-x-auto rounded border border-[var(--line)]">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Year</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Quantity</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Spend</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Avg paid</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">PO lines</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {PO_YEARS.map((y) => {
                    const r = p.po[y];
                    return (
                      <tr key={y} className="border-t border-[var(--line)]">
                        <td className="px-2.5 py-1.5">{y}</td>
                        <td className="px-2.5 py-1.5 text-right">{r ? `${r.qty.toLocaleString("en-GB")} ${p.uom}` : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">{r ? eur0.format(r.spend_eur) : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">{r && r.qty ? money((r.spend_eur / r.qty) * p.price_unit) : "—"}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          {r ? r.lines : "—"}
                          {r && r.stale_lines > 0 && (
                            <span className="ml-1 text-[11px] text-[var(--bad)]" title="Ordered at an outdated price (KNOWN_ISSUES #6)">
                              {r.stale_lines} stale
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-[var(--muted)]">
              Avg paid is {perUnit(p)}. Standard price in the material master: {p.standard_price !== null ? money(p.standard_price) : "—"}; planned lead
              time {p.planned_lead_time_days ?? "—"} days.
            </p>
          </Card>

          <Card title="Letters about this part" hint="Supplier letters, e-mails and our memos that name this part. Each opens in its supplier's timeline.">
            {p.letters.length ? (
              <ul className="space-y-2 text-[13px]">
                {p.letters.map((l) => (
                  <li key={l.id} className="space-y-0.5 rounded border border-[var(--line)] p-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--ink-2)]">
                      <span className="tabular-nums">{l.date}</span>
                      <span className="rounded bg-[var(--surface-3)] px-1.5">{l.kind}</span>
                      <DataId id={l.id} />
                    </div>
                    <div className="font-medium">{l.subject}</div>
                    <div className="text-[12px] text-[var(--ink-2)]">{l.author}</div>
                    {(l.asked_pct !== null || l.notice_days !== null) && (
                      <div className="flex flex-wrap gap-1 text-[11.5px]">
                        {l.asked_pct !== null && <span className="rounded border border-[var(--line)] px-1.5">asks {signed(l.asked_pct)}</span>}
                        {l.asked_price !== null && <span className="rounded border border-[var(--line)] px-1.5">{money(l.asked_price)}</span>}
                        {l.effective_date && <span className="rounded border border-[var(--line)] px-1.5">from {l.effective_date}</span>}
                        {l.notice_days !== null && <span className="rounded border border-[var(--line)] px-1.5">{l.notice_days} days&apos; notice</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--muted)]">No letters name this part.</p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
