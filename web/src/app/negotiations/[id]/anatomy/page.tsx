import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackIcon } from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { anatomy, impliedMarginGap, TERM_INFO, withTerm, type Anatomy, type TermKey } from "@/lib/anatomy";
import { GOALS, money, termLabel, termValue } from "@/lib/format";
import type { CaseFile } from "@/lib/inbox";
import { caseFile, runsData, supplierName, versionOf, type Run } from "@/lib/runs";

export function generateStaticParams() {
  return runsData.runs.map((r) => ({ id: r.session_id }));
}

export async function generateMetadata({ params }: PageProps<"/negotiations/[id]/anatomy">): Promise<Metadata> {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  return { title: run ? `Anatomy ${run.case_id.replace("case:", "")} · ${versionOf(run)} · ProcuDeal` : "Deal anatomy · ProcuDeal" };
}

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const n0 = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 0 });
const n2 = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 2 });

const ORIGIN: Record<string, { label: string; cls: string }> = {
  negotiated: { label: "negotiated", cls: "bg-[var(--accent-wash)] text-[var(--accent-ink)]" },
  fixed: { label: "fixed by the case", cls: "bg-[var(--surface-3)] text-[var(--ink-2)]" },
  standard: { label: "supplier's standard terms", cls: "bg-[var(--warn-bg)] text-[var(--ink)]" },
};

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

/** The formula with this deal's numbers in it. */
function worked(k: TermKey, a: Anatomy, c: CaseFile, run: Run): string {
  const b = c.buyer as Record<string, unknown> & { freight_eur_per_unit: Record<string, number> };
  const t = a.closing as Record<string, unknown>;
  const v = a.terms[k];
  switch (k) {
    case "price":
      return a.pre
        ? `${n0(a.pre)} × ${money(b.current_unit_price as number)} + ${n0(a.committed - a.pre)} × ${money(t.unit_price as number)} = ${eur0.format(v)}`
        : `${n0(a.committed)} units × ${money(t.unit_price as number)} = ${eur0.format(v)}`;
    case "uncovered_need": {
      const need = (b.need_per_year as number) * (b.horizon_years as number);
      return `(${n0(need)} − ${n0(a.covered)}) × ${money(b.fallback_unit_price as number)} = ${eur0.format(v)}`;
    }
    case "fallback_risk":
      return `${eur0.format(a.terms.uncovered_need)} × ${b.fallback_risk_pct ?? 0} % = ${eur0.format(v)}`;
    case "payment_terms":
      return `${eur0.format(a.spend)} × ${((b.interest_rate as number) * 100).toFixed(0)} % × (${b.reference_payment_days} − ${t.payment_days}) ÷ 360 = ${eur0.format(v)}`;
    case "freight":
      return `${n0(a.committed)} × ${money(b.freight_eur_per_unit[String(t.incoterm)] ?? 0)} (${t.incoterm}) = ${eur0.format(v)}`;
    case "late_delivery":
      return `${money((b.late_cost_per_day as number) ?? 0)} × max(0, ${t.lead_time_days} − ${b.need_lead_time_days}) = ${eur0.format(v)}`;
    case "quality":
      return `${n0(a.committed)} × ${n0((t.ppm_commitment as number) ?? 0)} ÷ 1,000,000 × (${money((b.cost_per_defect as number) ?? 0)} − ${money(
        Math.min((t.chargeback_eur_per_complaint as number) ?? 0, (b.cost_per_defect as number) ?? 0),
      )}) = ${eur0.format(v)}`;
    case "tooling":
      return `${eur0.format(v)}`;
    case "index_clause":
    case "index_risk": {
      const cl = t.index_clause as { series: string; material_share: number; deadband_pct: number } | null;
      if (!cl) return "no index clause = €0";
      const path = ((b.index_paths as Record<string, number>) ?? {})[cl.series] ?? 0;
      return k === "index_clause"
        ? `${eur0.format(a.atNewPrice)} × ${cl.material_share} × max(0, ${(Math.abs(path) * 100).toFixed(1)} % − ${cl.deadband_pct} %) = ${eur0.format(v)}`
        : `${eur0.format(a.atNewPrice)} × ${cl.material_share} × ${b.index_risk_pct} % = ${eur0.format(v)}`;
    }
    case "relationship": {
      const pp = b.relationship_eur_per_point as number | undefined;
      if (!v || !pp) return b.category_goal === "stabilise" || b.category_goal === "secure_supply" ? "€0: the deal leaves the supplier a sustainable margin" : "€0: only charged in stabilise and secure-supply cases";
      const gap = impliedMarginGap(v, pp, a.years);
      return `${eur0.format(pp)} per point × soft(gap) × ${n2(a.years)} years = ${eur0.format(v)} → the deal leaves ${supplierName(run.case_id, run.result.supplier_id ?? "")} about ${gap.toFixed(1)} points below a ${b.sustainable_margin_pct} % margin`;
    }
  }
}

export default async function Page({ params }: PageProps<"/negotiations/[id]/anatomy">) {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  if (!run) notFound();
  const c = caseFile(run.case_id);
  const r = run.result;
  const back = (
    <Link href={`/negotiations/${run.session_id}`} className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
      <BackIcon width={14} height={14} /> Back to the replay
    </Link>
  );
  const header = (
    <div>
      <h1 className="text-[22px] font-semibold">
        Deal anatomy · {run.case_id.replace("case:", "")} {c?.title && <span className="font-normal text-[var(--ink-2)]">{c.title}</span>}
      </h1>
      <p className="text-[12.5px] text-[var(--muted)]">
        {versionOf(run)} · session <code className="font-mono">{run.session_id}</code>
        {c?.buyer.category_goal && <> · goal {GOALS[c.buyer.category_goal] ?? c.buyer.category_goal}</>}
      </p>
    </div>
  );

  const scoreBox = (
    <Card title="The score" hint="brief/api.md: score = clip((C_open − C_deal) ÷ (C_open − C_best), 0, 1). C is total cost over the contract horizon.">
      <p className="text-[14px] tabular-nums">
        ({eur0.format(r.c_open ?? 0)} − {r.deal ? eur0.format(r.c_deal ?? 0) : "no deal"}) ÷ ({eur0.format(r.c_open ?? 0)} − {eur0.format(r.c_best ?? 0)}) ={" "}
        <strong className="text-[18px]">{Math.round((r.score ?? 0) * 100)}</strong>
      </p>
      <p className="text-[12.5px] text-[var(--ink-2)]">
        Opening offer {eur0.format(r.c_open ?? 0)} · best possible {eur0.format(r.c_best ?? 0)} · our alternative{" "}
        {r.c_alt != null ? eur0.format(r.c_alt) : "none (no deal scores 0)"}. Each euro of C saved is worth{" "}
        {r.c_open && r.c_best && r.c_open > r.c_best ? `${(100 / (r.c_open - r.c_best)).toFixed(4)} points` : "—"}.
      </p>
    </Card>
  );

  if (!c || !r.deal || !r.terms || !r.cost_breakdown) {
    return (
      <main className="h-full overflow-auto bg-[var(--page)]">
        <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          {back}
          {header}
          {scoreBox}
          <p className="text-[13.5px] text-[var(--ink-2)]">
            No deal in this run ({run.end_reason?.replace("_", " ") ?? "no deal"}), so there is no term sheet to take apart. No deal scores the alternative.
          </p>
        </div>
      </main>
    );
  }

  const arena = r.cost_breakdown as Record<TermKey, number>;
  const a = anatomy(c, r.terms, arena.relationship ?? 0);
  const total = Object.values(a.terms).reduce((s, v) => s + v, 0);
  const keys = Object.keys(TERM_INFO) as TermKey[];
  const mismatch = keys.filter((k) => Math.abs((a.terms[k] ?? 0) - (arena[k] ?? 0)) > 1);
  const levers = c.negotiable.filter((f) => f !== "unit_price" && Array.isArray(c.term_options[f]) && (c.term_options[f] as unknown[]).length > 1);
  const deal = r.c_deal ?? total;

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          {back}
          {header}
          <p className="text-[13px] text-[var(--ink-2)]">
            Accepted <DataId id={r.offer_id ?? ""} /> from <DataId id={r.supplier_id ?? ""} /> {supplierName(run.case_id, r.supplier_id ?? "")}.
          </p>
        </header>

        {scoreBox}

        <Card
          title="Where the deal's total cost comes from"
          hint="Each term recomputed from the case file and the closing terms, the way the kit's cost.py does, and checked against the arena's breakdown for this run."
        >
          <div className="overflow-x-auto rounded border border-[var(--line)]">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
                <tr>
                  <th className="px-2.5 py-1.5 font-medium">Term</th>
                  <th className="px-2.5 py-1.5 font-medium">This deal, worked out</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">€</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Arena</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const v = a.terms[k];
                  const zero = Math.abs(v) < 0.5 && Math.abs(arena[k] ?? 0) < 0.5;
                  return (
                    <tr key={k} id={k} className={`scroll-mt-4 border-t border-[var(--line)] ${zero ? "text-[var(--muted)]" : ""}`}>
                      <td className="px-2.5 py-1.5 align-top">
                        <div className="font-medium">{TERM_INFO[k].label}</div>
                        <div className="text-[11px] text-[var(--muted)]">{TERM_INFO[k].formula}</div>
                      </td>
                      <td className="px-2.5 py-1.5 align-top">{worked(k, a, c, run)}</td>
                      <td className="px-2.5 py-1.5 text-right align-top font-semibold whitespace-nowrap">{eur0.format(v)}</td>
                      <td className="px-2.5 py-1.5 text-right align-top whitespace-nowrap">
                        {Math.abs(v - (arena[k] ?? 0)) <= 1 ? (
                          <span className="text-[var(--good)]" title={eur0.format(arena[k] ?? 0)}>
                            ✓
                          </span>
                        ) : (
                          <span className="text-[var(--bad)]">{eur0.format(arena[k] ?? 0)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--line)] bg-[var(--surface-2)] font-semibold">
                  <td className="px-2.5 py-1.5">C of the deal</td>
                  <td className="px-2.5 py-1.5 text-[var(--ink-2)]">sum of the terms</td>
                  <td className="px-2.5 py-1.5 text-right">{eur0.format(total)}</td>
                  <td className="px-2.5 py-1.5 text-right">{eur0.format(deal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {mismatch.length > 0 && (
            <p className="text-[12.5px] text-[var(--bad)]">Our recomputation differs from the arena on: {mismatch.map((k) => TERM_INFO[k].label).join(", ")}.</p>
          )}
          <p className="text-[12px] text-[var(--muted)]">
            Horizon covered: {n2(a.years)} years · committed {n0(a.committed)} units · covered {n0(a.covered)} of {n0((c.buyer.need_per_year ?? 0) * (c.buyer.horizon_years ?? 0))} needed
            {a.pre > 0 && <> · {n0(a.pre)} units bought at today&apos;s price before the new one takes effect</>}.
          </p>
        </Card>

        <Card
          title="The closing terms and where each came from"
          hint="A deal closes on our accepted sheet for the negotiable fields, the case's fixed terms, and the supplier's standard terms (its quote PDF) for anything left out."
        >
          <div className="overflow-x-auto rounded border border-[var(--line)]">
            <table className="w-full text-[12.5px] tabular-nums">
              <tbody>
                {Object.entries(a.closing).map(([k, v]) => (
                  <tr key={k} className="border-t border-[var(--line)] first:border-t-0">
                    <td className="px-2.5 py-1.5 text-[var(--ink-2)]">{termLabel(k)}</td>
                    <td className="px-2.5 py-1.5 font-semibold">{termValue(k, v)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`rounded px-1.5 py-px text-[11.5px] ${ORIGIN[a.origin[k]].cls}`}>{ORIGIN[a.origin[k]].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {levers.length > 0 && (
          <Card
            title="What each lever was worth"
            hint="Total cost C with one negotiable term set to each allowed option and everything else as closed (supplier-health charge held). This shows the buyer's side only: the supplier prices each option too."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {levers.map((f) => {
                const opts = c.term_options[f] as unknown[];
                const rows = opts.map((o) => ({ o, cost: withTerm(c, a.closing, f, o, arena.relationship ?? 0) }));
                const chosen = JSON.stringify(a.closing[f] ?? null);
                const best = Math.min(...rows.map((x) => x.cost));
                return (
                  <div key={f} className="space-y-1.5 rounded border border-[var(--line)] p-3">
                    <div className="text-[13px] font-semibold">{termLabel(f)}</div>
                    <table className="w-full text-[12.5px] tabular-nums">
                      <tbody>
                        {rows.map(({ o, cost }) => {
                          const isChosen = JSON.stringify(o ?? null) === chosen;
                          return (
                            <tr key={JSON.stringify(o)} className={isChosen ? "font-semibold" : ""}>
                              <td className="py-0.5">
                                {termValue(f, o)}
                                {isChosen && <span className="ml-1 rounded bg-[var(--accent-wash)] px-1 text-[11px] text-[var(--accent-ink)]">deal</span>}
                              </td>
                              <td className="py-0.5 text-right">{eur0.format(cost)}</td>
                              <td className={`w-24 py-0.5 text-right ${cost - total > 0.5 ? "text-[var(--bad)]" : cost - total < -0.5 ? "text-[var(--good)]" : "text-[var(--muted)]"}`}>
                                {Math.abs(cost - total) < 0.5 ? "—" : `${cost > total ? "+" : "−"}${eur0.format(Math.abs(cost - total))}`}
                              </td>
                              <td className="w-6 py-0.5 text-right">{cost === best && <span className="text-[var(--good)]">★</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
            <p className="text-[12px] text-[var(--muted)]">★ cheapest for us at the deal&apos;s price. Whether the supplier accepts it at that price is the negotiation.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
