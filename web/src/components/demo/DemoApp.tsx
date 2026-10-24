"use client";

import { code, showcase, stats, suppliers } from "@/lib/demo";
import { Arguments } from "./Arguments";
import { DecideFlow } from "./DecideFlow";
import { DemoDeck, type Chapter } from "./DemoDeck";
import { Issues } from "./Issues";
import { Pipeline } from "./Pipeline";
import { Prompts } from "./Prompts";
import { Replay } from "./Replay";
import { Rfq } from "./Rfq";
import { Stops } from "./Stops";
import { Suppliers } from "./Suppliers";

// Chapters follow one case from start to close, then step back to what the runs tell us.
const CHAPTERS: Chapter[] = [
  {
    id: "pipeline",
    short: "The whole pipeline",
    title: "How ProcuDeal runs a case",
    lede: "Fourteen steps take a case from the opening quote to accept or walk away. Code decides every number. A language model is only the safety net when the code fails.",
    render: () => <Pipeline />,
  },
  {
    id: "suppliers",
    short: "Who we negotiate with",
    title: `${suppliers.total} suppliers, ${suppliers.detailed_count} we can read`,
    lede: "Before the first e-mail, the engine builds a dossier from the data package: owner type, cash signals, should-cost. Most suppliers only have spend data; the detailed ones carry letters, notes and intel.",
    render: () => <Suppliers />,
  },
  {
    id: "decide",
    short: "What happens on every move",
    title: "One move, branch by branch",
    lede: "Each time a supplier answers, Negotiator.decide() walks the same list: read the reply, price every standing sheet, accept if a supplier is ready, else counter the one that waited longest.",
    render: () => <DecideFlow />,
  },
  {
    id: "prompts",
    short: "Model calls and prompts",
    title: "Where the words come from",
    lede: `The engine writes e-mails from a template; ${stats.moves.engine} of ${stats.moves.total} recorded moves never touched a model. The kit's LLM agent takes over only when the engine throws. Here is its prompt, as it is in the code.`,
    render: () => <Prompts />,
  },
  {
    id: "arguments",
    short: "Arguments and reading replies",
    title: "What we claim, and what we hear",
    lede: "Claims carry our figures next to their data IDs, so the arena can check them. Replies are read with fixed patterns that trigger a concrete change in the next move.",
    render: () => <Arguments />,
  },
  {
    id: "replay",
    short: "Replay a negotiation",
    title: "Replay a negotiation, one e-mail at a time",
    lede: "Every e-mail, claim check and decision from a recorded session, joined to the reason our engine logged for it. Press Play, or click the replay and use the arrow keys.",
    render: () => <Replay sessions={showcase.sessions} />,
  },
  {
    id: "rfq",
    short: "RFQ with several suppliers",
    title: "Several suppliers, one winner",
    lede: "In an RFQ each supplier has its own thread. The engine plays them against each other with the leader's total cost, drops the hopeless ones and ends with a short reverse auction.",
    render: () => <Rfq />,
  },
  {
    id: "stops",
    short: "Why negotiations stop",
    title: "Why a negotiation stops",
    lede: `${stats.totals.procudeal_runs} recorded runs, ${stats.totals.deals} deals. Most talks end when the supplier calls its offer final, not when the prices meet or the rounds run out.`,
    render: () => <Stops />,
  },
  {
    id: "issues",
    short: "What to fix next",
    title: "What the code review found",
    lede: "Read from the engine code, each with the line it lives on. The first one explains most of the short negotiations above.",
    render: () => <Issues />,
  },
];

export function DemoApp() {
  return (
    <DemoDeck
      chapters={CHAPTERS}
      footer={
        <>
          Engine {code.engine} at {code.commit}. {stats.totals.procudeal_runs} runs and {suppliers.total} suppliers synced {stats.synced_at.slice(0, 10)}. Use ← → to move between chapters.
        </>
      }
    />
  );
}
