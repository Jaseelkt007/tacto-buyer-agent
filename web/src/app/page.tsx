import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BoxesIcon,
  ChartIcon,
  CogIcon,
  ContractIcon,
  DatabaseIcon,
  FactoryIcon,
  PulseIcon,
  HandshakeIcon,
  InboxIcon,
  ScaleIcon,
} from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { v19 } from "@/lib/v19";

export const metadata: Metadata = { title: "ProcuDeal · Hollerau Pumpenwerke" };

const SECTIONS: {
  href: string;
  label: string;
  icon: ReactNode;
  text: string;
}[] = [
  {
    href: "/live",
    label: "v1.9 demo",
    icon: <PulseIcon width={20} height={20} />,
    text: "Follow real v1.9 decisions through the Python engine, then inspect the latest offline reviewer and exchange feedback.",
  },
  {
    href: "/mail",
    label: "Mail",
    icon: <InboxIcon width={20} height={20} />,
    text: "What the agent sees when a case opens: case file, supplier letter, opening quotes.",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: <FactoryIcon width={20} height={20} />,
    text: "Who we negotiate with: finances, terms, scorecards, letters, and what the agent reads into them.",
  },
  {
    href: "/parts",
    label: "Parts & Cost",
    icon: <CogIcon width={20} height={20} />,
    text: "What each part should cost: should-cost, price history, cost drivers against the price asked.",
  },
  {
    href: "/market",
    label: "Market",
    icon: <ChartIcon width={20} height={20} />,
    text: "The 33 indices and a checker that verifies any index claim the way the arena does.",
  },
  {
    href: "/contracts",
    label: "Contracts",
    icon: <ContractIcon width={20} height={20} />,
    text: "Clauses and deadlines, delivery and quality records, and whether we pay on time.",
  },
  {
    href: "/demand",
    label: "Demand",
    icon: <BoxesIcon width={20} height={20} />,
    text: "Forecasts, coverage trap, alternative sources and RFQs, and where the money goes.",
  },
  {
    href: "/negotiations",
    label: "Deals",
    icon: <HandshakeIcon width={20} height={20} />,
    text: "Every negotiation replayed move by move, with the engine's reasoning and each deal's anatomy.",
  },
  {
    href: "/arguments",
    label: "Arguments",
    icon: <ScaleIcon width={20} height={20} />,
    text: "Every argument the agent sent, the arena's verdict, and the price move that followed.",
  },
  {
    href: "/facts",
    label: "Facts",
    icon: <DatabaseIcon width={20} height={20} />,
    text: "Search the 10,356 citable IDs and the values the arena checks claims against.",
  },
];

export default function Home() {
  const featured = v19.sessions.find((s) => s.case_id === "P01");
  return (
    <main className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-9 sm:py-12">
        <header className="grid items-center gap-9 border-b border-[var(--line)] pb-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="font-mono text-[10px] tracking-[0.13em] text-[var(--muted)]">
              PROCUDEAL / ENGINE v1.9
            </p>
            <h1 className="mt-5 text-[36px] leading-[1.12] font-light tracking-[-0.045em] sm:text-[48px]">
              Better buying.
              <br />
              <span className="text-[var(--muted)]">Every move explained.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[14px] leading-7 text-[var(--ink-2)]">
              A buyer for Hollerau Pumpenwerke. Company records become a
              supplier dossier, economics become an offer, and every move has a
              reason you can inspect.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <Link
                href="/live"
                className="tacto-primary inline-flex items-center gap-3 rounded-md px-5 py-3 text-[12px]"
              >
                <PulseIcon width={16} height={16} /> Play the v1.9 negotiation{" "}
                <span>→</span>
              </Link>
              <Link
                href="/negotiations"
                className="text-[12px] text-[var(--ink-2)] hover:underline"
              >
                Explore run history ↗
              </Link>
            </div>
            <p className="mt-4 text-[11px] leading-6 text-[var(--ink-2)]">
              New in the demo: a decision reviewer with exchange feedback.
              Explore saved reviews alongside the original v1.9 replay.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-7 sm:p-8">
            <p className="font-mono text-[9px] tracking-[0.1em] text-[var(--muted)]">
              THE TEN-CASE v1.9 BENCHMARK
            </p>
            <div className="mt-5 flex items-baseline gap-3">
              <strong className="text-[66px] leading-none font-light tracking-[-0.06em]">
                {v19.benchmark.mean.toFixed(2)}
              </strong>
              <span className="text-[12px] text-[var(--muted)]">
                mean / 100
              </span>
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-5">
              {[
                [
                  `${v19.benchmark.deals}/${v19.benchmark.cases}`,
                  "valid deals",
                ],
                [String(v19.benchmark.engine_decisions), "engine decisions"],
                [String(v19.benchmark.llm_decisions), "LLM decisions"],
              ].map(([value, title]) => (
                <div key={title}>
                  <strong className="text-[23px] font-normal tracking-tight">
                    {value}
                  </strong>
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">
                    {title}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[10px] leading-5 text-[var(--muted)]">
              Original hosted practice suite. Five later baseline passes
              reproduced the same mean.
            </p>
          </div>
        </header>
        <section className="py-9">
          <p className="font-mono text-[10px] tracking-[0.1em] text-[var(--muted)]">
            FROM RECORDS TO A DEAL
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Read the supplier",
                text: "SQL and text patterns turn records into a Python dossier: costs, cash needs and capacity signals.",
              },
              {
                n: "02",
                title: "Price the package",
                text: "Calculate total cost across price, payment, quality, delivery and supplier health.",
              },
              {
                n: "03",
                title: "Choose the move",
                text: "The policy selects terms, controls concessions and decides when an offer is worth accepting.",
              },
              {
                n: "04",
                title: "Negotiate & close",
                text: "Fixed email templates carry the offer. Supplier replies return to the engine until it accepts or walks away.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-lg border border-[var(--line)] bg-white p-5"
              >
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {step.n}
                </span>
                <h2 className="mt-4 text-[14px] font-medium">{step.title}</h2>
                <p className="mt-2 text-[12px] leading-6 text-[var(--ink-2)]">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-6 text-[var(--muted)]">
            No LLM decisions were used in this suite. An exception fallback
            exists in the code, but was never triggered. Offline specialist
            research belongs to the experimental hybrid.
          </p>
        </section>
        <section className="rounded-xl border border-[var(--line)] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] p-5 sm:px-6">
            <div>
              <p className="font-mono text-[9px] tracking-[0.1em] text-[var(--muted)]">
                ORIGINAL HOSTED PRACTICE RUNS
              </p>
              <h2 className="mt-2 text-[20px] font-medium tracking-tight">
                Ten cases. Ten ways to make a deal.
              </h2>
            </div>
            {featured && (
              <Link
                href={`/live/${featured.id}`}
                className="text-[12px] text-[var(--ink-2)]"
              >
                Start with P01 →
              </Link>
            )}
          </div>
          <div className="grid sm:grid-cols-2">
            {v19.sessions.map((session) => (
              <Link
                key={session.id}
                href={`/live/${session.id}`}
                className="group flex min-w-0 items-center gap-3 border-b border-[var(--line-soft)] px-5 py-4 hover:bg-[var(--surface-2)] sm:px-6"
              >
                <span className="rounded border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[10px] text-[var(--ink-2)]">
                  {session.case_id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">
                    {session.title}
                  </span>
                  <span className="mt-1 block text-[10px] text-[var(--muted)]">
                    {session.dossiers.length} supplier
                    {session.dossiers.length > 1 ? "s" : ""} ·{" "}
                    {session.decision_count} engine decisions
                  </span>
                </span>
                <span className="text-[15px] tracking-tight tabular-nums">
                  {session.result.score.toFixed(2)}
                </span>
                <span className="text-[var(--muted)] group-hover:text-[var(--ink)]">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-10 space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[20px] font-medium tracking-tight">
              Behind every offer, a source.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.filter((s) => s.href !== "/live").map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex min-w-0 gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-2)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)]">
                  {s.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">
                    {s.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-[var(--ink-2)]">
                    {s.text}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="text-[10px] leading-6 text-[var(--muted)]">
            Citable IDs such as <DataId id="sup:70110" /> link to their source
            records. Deals retains all versions as history. This website
            presents saved data; the buyer agent never reads it.
          </p>
        </section>
      </div>
    </main>
  );
}
