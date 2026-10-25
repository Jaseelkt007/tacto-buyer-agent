import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { v19 } from "@/lib/v19";

export const metadata: Metadata = {
  title: "From price increase to a better deal · ProcuDeal",
  description:
    "How ProcuDeal negotiated P01 from €138.55 to €131.20 per unit, saving about €52,000 while meeting every supply requirement.",
};

const euro = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export default function DemoIntroduction() {
  const session = v19.sessions.find((item) => item.case_id === "P01");
  if (!session) notFound();

  const opening = session.messages.find((message) => message.actor === "supplier");
  if (opening?.price == null) notFound();

  const savings = session.result.opening_cost - session.result.deal_cost;
  const roundedSavings = euro(Math.round(savings / 1000) * 1000, 0);
  const requirements = session.result.must_haves_ok
    ? "All requirements met"
    : "Requirements not met";

  return (
    <main className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-9">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
          <Link href="/" className="text-[12px] text-[var(--ink-2)] hover:underline">
            ← All results
          </Link>
          <p className="font-mono text-[10px] tracking-[0.12em] text-[var(--muted)]">
            PROCUDEAL / P01 / PRICE INCREASE
          </p>
        </header>

        <div className="py-8 lg:py-10">
          <p className="font-mono text-[10px] tracking-[0.12em] text-[var(--accent-ink)]">
            ONE SUPPLIER. ONE NEGOTIATION. A BETTER DEAL.
          </p>
          <h1 className="mt-4 max-w-4xl text-[36px] leading-[1.08] font-light tracking-[-0.045em] sm:text-[48px] lg:text-[58px]">
            A price increase request.
            <br />
            <span className="text-[var(--accent-ink)]">~{roundedSavings} in savings.</span>
          </h1>
          <p className="mt-4 text-[13px] leading-6 text-[var(--ink-2)]">
            Gießerei Brandlhuber · HN volute casings · Recorded v1.9 negotiation
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          <section aria-label="The negotiation story" className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
            {[
              {
                step: "01",
                label: "Trigger",
                text: `Supplier demanded a 9.5% price increase to ${euro(opening.price)}/unit.`,
              },
              {
                step: "02",
                label: "Problem",
                text: "Rising procurement costs without compromising supply requirements.",
              },
              {
                step: "03",
                label: "Value created",
                text: "Autonomous, evidence-backed negotiation optimizing total contract costs.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 border-b border-[var(--line-soft)] px-6 py-6 last:border-0 sm:gap-5 sm:px-7">
                <span aria-hidden="true" className="pt-0.5 font-mono text-[11px] text-[var(--muted)]">{item.step}</span>
                <div>
                  <h2 className="text-[11px] font-medium tracking-[0.07em] text-[var(--muted)] uppercase">{item.label}</h2>
                  <p className="mt-2 max-w-md text-[17px] leading-7 tracking-[-0.015em] sm:text-[18px]">{item.text}</p>
                </div>
              </div>
            ))}
          </section>

          <section aria-labelledby="result-heading" className="flex flex-col rounded-xl border border-[var(--accent-line)] bg-[var(--accent-wash)] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="result-heading" className="font-mono text-[10px] tracking-[0.12em] text-[var(--accent-ink)]">04 / RESULT</h2>
              <span className="rounded-full border border-[var(--accent-line)] bg-white px-3 py-1.5 text-[11px] text-[var(--accent-ink)]">
                {requirements}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-end gap-x-3 gap-y-1">
              <strong className="text-[54px] leading-none font-light tracking-[-0.055em] sm:text-[68px]">{euro(session.result.unit_price)}</strong>
              <span className="pb-1 text-[14px] text-[var(--ink-2)]">/ unit secured</span>
            </div>
            <p className="mt-3 text-[13px] text-[var(--ink-2)]">
              From {euro(opening.price)}/unit in the opening offer
            </p>

            <dl className="mt-7 grid grid-cols-2 gap-5 border-t border-[var(--accent-line)] pt-6">
              <div>
                <dt className="text-[11px] text-[var(--accent-ink)]">Modeled savings</dt>
                <dd className="mt-2 text-[28px] font-medium tracking-[-0.04em] sm:text-[32px]">~{roundedSavings}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-[var(--accent-ink)]">P01 case score</dt>
                <dd className="mt-2 text-[28px] font-medium tracking-[-0.04em] sm:text-[32px]">
                  {session.result.score.toFixed(2)}<span className="text-[14px] font-normal text-[var(--ink-2)]"> / 100</span>
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-[11px] leading-5 text-[var(--accent-ink)]">
              {euro(savings)} in total-contract-cost savings, including negotiated terms.
            </p>
          </section>
        </div>

        <footer className="mt-7 flex flex-wrap items-center justify-between gap-5 border-t border-[var(--line)] pt-5 lg:mt-8">
          <p className="max-w-lg text-[11px] leading-5 text-[var(--muted)]">
            Recorded arena outcome · Savings compare opening and agreed total cost.
          </p>
          <Link href={`/live/${session.id}`} className="tacto-primary inline-flex items-center gap-5 rounded-md px-5 py-3.5 text-[11px]">
            See how the deal was made <span aria-hidden="true">→</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
