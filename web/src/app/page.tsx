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
  HandshakeIcon,
  InboxIcon,
  ScaleIcon,
} from "@/components/icons";
import { DataId } from "@/components/MailBody";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { runsData } from "@/lib/runs";
import { buildStory, storyRuns } from "@/lib/story";

export const metadata: Metadata = { title: "ProcuDeal · Hollerau Pumpenwerke" };

// The run Home plays first: the latest run of this case. Every run has its own story at /story/<id>.
const FEATURED = "case:P01";

const SECTIONS: { href: string; label: string; icon: ReactNode; text: string }[] = [
  { href: "/mail", label: "Mail", icon: <InboxIcon width={20} height={20} />, text: "What the agent sees when a case opens: case file, supplier letter, opening quotes." },
  { href: "/suppliers", label: "Suppliers", icon: <FactoryIcon width={20} height={20} />, text: "Who we negotiate with: finances, terms, scorecards, letters, and what the agent reads into them." },
  { href: "/parts", label: "Parts & Cost", icon: <CogIcon width={20} height={20} />, text: "What each part should cost: should-cost, price history, cost drivers against the price asked." },
  { href: "/market", label: "Market", icon: <ChartIcon width={20} height={20} />, text: "The 33 indices and a checker that verifies any index claim the way the arena does." },
  { href: "/contracts", label: "Contracts", icon: <ContractIcon width={20} height={20} />, text: "Clauses and deadlines, delivery and quality records, and whether we pay on time." },
  { href: "/demand", label: "Demand", icon: <BoxesIcon width={20} height={20} />, text: "Forecasts, coverage trap, alternative sources and RFQs, and where the money goes." },
  { href: "/negotiations", label: "Deals", icon: <HandshakeIcon width={20} height={20} />, text: "Every negotiation replayed move by move, with the engine's reasoning and each deal's anatomy." },
  { href: "/arguments", label: "Arguments", icon: <ScaleIcon width={20} height={20} />, text: "Every argument the agent sent, the arena's verdict, and the price move that followed." },
  { href: "/facts", label: "Facts", icon: <DatabaseIcon width={20} height={20} />, text: "Search the 10,356 citable IDs and the values the arena checks claims against." },
];

export default function Home() {
  const run = runsData.runs.filter((r) => r.case_id === FEATURED).at(-1) ?? runsData.runs.at(-1);
  return (
    <main className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">ProcuDeal · Tacto Negotiation Arena</p>
          <h1 className="text-[26px] leading-tight font-semibold">How our buyer agent makes a deal</h1>
          <p className="max-w-3xl text-[14.5px] text-[var(--ink-2)]">
            Our agent buys for Hollerau Pumpenwerke: it reads the company&apos;s data, negotiates by e-mail with Tacto&apos;s supplier bots, and
            signs the deal with the lowest total cost, or walks away. Every price, term sheet and argument is computed in code from the data, not
            by a language model. Step through one negotiation below, chapter by chapter, or pick any other run we played.
          </p>
        </header>

        {run && <StoryPlayer steps={buildStory(run)} runs={storyRuns()} current={run.session_id} />}

        <section className="space-y-3">
          <h2 className="text-[18px] font-semibold">Explore the data</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex min-w-0 gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 hover:border-[var(--accent-line)] hover:bg-[var(--accent-wash)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent-wash)] text-[var(--accent-ink)]">{s.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{s.label}</span>
                  <span className="block text-[12.5px] text-[var(--ink-2)]">{s.text}</span>
                </span>
              </Link>
            ))}
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            Every data ID in the app (like <DataId id="sup:70110" />) opens the page that explains it. Data as of 2026-09-30; runs from our benchmark. For
            people only: the agent never reads this app.
          </p>
        </section>
      </div>
    </main>
  );
}
