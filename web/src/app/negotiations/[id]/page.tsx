import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "@/components/icons";
import { PricePath, type PricePathProps } from "@/components/negotiation/PricePath";
import { BrainSummary, CostBreakdown, Outcome, StepCard } from "@/components/negotiation/RunView";
import { GOALS, fullDate } from "@/lib/format";
import { buildSteps, caseFile, runsData, STATUS_LABEL, supplierName, versionOf, type Run, type Step } from "@/lib/runs";

export function generateStaticParams() {
  return runsData.runs.map((r) => ({ id: r.session_id }));
}

const find = (id: string) => runsData.runs.find((r) => r.session_id === id);

export async function generateMetadata({ params }: PageProps<"/negotiations/[id]">): Promise<Metadata> {
  const run = find((await params).id);
  return { title: run ? `${run.case_id.replace("case:", "")} · ${versionOf(run)} · ProcuDeal` : "Negotiation · ProcuDeal" };
}

function pricePath(run: Run, steps: Step[], sup: string): PricePathProps {
  const mine = steps.filter((s) => s.supplierId === sup);
  const ds = run.decisions.filter((d) => d.supplier_id === sup);
  const last = mine.at(-1);
  const deal = run.result.deal && run.result.supplier_id === sup;
  return {
    title: supplierName(run.case_id, sup),
    supplier: mine
      .filter((s) => typeof s.offer.terms.unit_price === "number")
      .map((s) => ({ round: s.round, price: s.offer.terms.unit_price as number, label: STATUS_LABEL[s.offer.status] ?? s.offer.status })),
    ours: run.trace.flatMap((t) => {
      const m = t.move as { type?: string; supplier_id?: string; term_sheets?: { terms: Record<string, unknown> }[] };
      const p = m.term_sheets?.[0]?.terms.unit_price;
      return t.actor === "buyer" && m.type === "message" && m.supplier_id === sup && typeof p === "number"
        ? [{ round: t.round, price: p, label: "Our offer" }]
        : [];
    }),
    ceiling: ds.findLast((d) => d.ceiling)?.ceiling ?? null,
    anchor: ds.find((d) => d.anchor)?.anchor ?? null,
    end: !last
      ? null
      : deal
        ? { round: last.round, price: (run.result.terms?.unit_price as number) ?? null, kind: "deal" }
        : last.offer.status === "walked_away"
          ? { round: last.round, price: null, kind: "walked" }
          : { round: last.round, price: null, kind: "open" },
  };
}

export default async function Page({ params }: PageProps<"/negotiations/[id]">) {
  const run = find((await params).id);
  if (!run) notFound();
  const cf = caseFile(run.case_id);
  const steps = buildSteps(run);
  const suppliers = [...new Set(steps.map((s) => s.supplierId))];
  const rounds = [...new Set(steps.map((s) => s.round))].sort((a, b) => a - b);
  const siblings = runsData.runs.filter((r) => r.case_id === run.case_id);

  // Previous supplier price and our previous offer per thread, for the step deltas.
  const prevSupplier = new Map<Step, number | null>();
  const prevOurs = new Map<Step, number | null>();
  for (const sup of suppliers) {
    let s: number | null = null;
    let o: number | null = null;
    for (const st of steps.filter((x) => x.supplierId === sup)) {
      prevSupplier.set(st, s);
      prevOurs.set(st, o);
      if (typeof st.offer.terms.unit_price === "number") s = st.offer.terms.unit_price;
      if (st.decision?.price !== undefined) o = st.decision.price;
    }
  }

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/negotiations" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
              <BackIcon width={14} height={14} /> All negotiations
            </Link>
            <Link
              href={`/live/${run.session_id}`}
              className="ml-auto rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12.5px] font-medium hover:bg-[var(--hover)]"
            >
              Watch it live →
            </Link>
            <Link
              href={`/negotiations/${run.session_id}/anatomy`}
              className="rounded border border-[var(--accent-line)] bg-[var(--accent-wash)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--accent-ink)] hover:bg-[var(--select)]"
            >
              Deal anatomy: every cost term, worked out →
            </Link>
          </div>
          <div>
            <h1 className="text-[22px] font-semibold">
              {run.case_id.replace("case:", "")} · {cf?.title ?? run.case_id}
            </h1>
            <p className="text-[13px] text-[var(--ink-2)]">
              {suppliers.map((s) => supplierName(run.case_id, s)).join(" · ")}
              {cf?.buyer.category_goal && <> · goal: {GOALS[cf.buyer.category_goal] ?? cf.buyer.category_goal}</>}
            </p>
            <p className="text-[12px] text-[var(--muted)]">
              {versionOf(run)} · commit <code className="font-mono">{run.commit ?? "?"}</code> · session{" "}
              <code className="font-mono">{run.session_id}</code> · played {fullDate(run.when)}
              {run.seconds !== null && <> in {Math.round(run.seconds)} s</>}
            </p>
          </div>
          {siblings.length > 1 && (
            <nav aria-label="Other runs of this case" className="flex flex-wrap gap-1.5">
              {siblings.map((r) => (
                <Link
                  key={r.session_id}
                  href={`/negotiations/${r.session_id}`}
                  aria-current={r.session_id === run.session_id ? "page" : undefined}
                  className={`rounded border px-2 py-0.5 text-[12px] tabular-nums ${
                    r.session_id === run.session_id
                      ? "border-[var(--accent)] bg-[var(--select)] font-semibold text-[var(--accent-ink)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
                  }`}
                >
                  {versionOf(r)} · {Math.round((r.result.score ?? 0) * 100)}
                </Link>
              ))}
            </nav>
          )}
        </header>

        <Outcome run={run} />

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <section className="min-w-0 space-y-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            {suppliers.map((s) => (
              <PricePath key={s} {...pricePath(run, steps, s)} />
            ))}
          </section>
          <section className="min-w-0 space-y-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="space-y-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">How our agent negotiated</h2>
              <BrainSummary run={run} steps={steps} />
            </div>
            {run.result.cost_breakdown && (
              <div className="space-y-2">
                <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Deal total cost</h2>
                <CostBreakdown parts={run.result.cost_breakdown} />
              </div>
            )}
          </section>
        </div>

        <section className="space-y-4">
          <h2 className="text-[16px] font-semibold">Move by move</h2>
          {rounds.map((r) => (
            <div key={r} className="space-y-2">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
                {r === 0 ? "Opening quotes" : `Round ${r}`}
              </h3>
              {steps
                .filter((s) => s.round === r)
                .map((s) => (
                  <StepCard
                    key={`${s.supplierId}-${s.round}`}
                    caseId={run.case_id}
                    step={s}
                    prevSupplier={prevSupplier.get(s) ?? null}
                    prevOurs={prevOurs.get(s) ?? null}
                  />
                ))}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
