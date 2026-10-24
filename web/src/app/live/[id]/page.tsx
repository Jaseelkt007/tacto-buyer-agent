import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LivePipeline } from "@/components/live/LivePipeline";
import { buildLive, type NodeId } from "@/lib/live";
import { runsData } from "@/lib/runs";
import { storyRuns } from "@/lib/story";

export function generateStaticParams() {
  return runsData.runs.map((r) => ({ id: r.session_id }));
}

export async function generateMetadata({ params }: PageProps<"/live/[id]">): Promise<Metadata> {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  return { title: run ? `Inside a run · ${run.case_id.replace("case:", "")} · ProcuDeal` : "Inside a run · ProcuDeal" };
}

// Latest run of a released engine version (not a one-off experiment such as "v1.7 -patience").
const latest = (caseId: string) =>
  (runsData.runs.filter((r) => r.case_id === caseId && r.note.startsWith("engine v")).at(-1) ?? runsData.runs.filter((r) => r.case_id === caseId).at(-1))
    ?.session_id;

export default async function Page({ params }: PageProps<"/live/[id]">) {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  if (!run) notFound();
  const live = buildLive(run);
  if (!live) notFound();
  const sup = run.result.supplier_id ?? run.decisions[0]?.supplier_id ?? "";
  const supPage = sup ? `/suppliers/${sup.replace("sup:", "")}` : "/suppliers";
  const replay = `/negotiations/${run.session_id}`;
  const anatomy = run.result.deal ? `${replay}/anatomy` : replay;
  const links: Partial<Record<NodeId, string>> = {
    case: `/mail#${run.case_id}/case`,
    quote: `/mail#${run.case_id}/case`,
    tables: supPage,
    letters: `${supPage}#timeline`,
    facts: "/facts",
    reader: anatomy,
    dossier: supPage,
    claims: "/arguments",
    economics: anatomy,
    policy: replay,
    llm: replay,
    writer: replay,
    arena: "/arguments",
    clock: replay,
    sales: replay,
    office: replay,
    score: anatomy,
  };
  const scenarios = [
    { label: "1", id: latest("case:P01") },
    { label: "2", id: latest("case:D02") },
    { label: "3 · RFQ", id: latest("case:P05") },
  ].filter((s): s is { label: string; id: string } => !!s.id);

  return (
    <main className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)]">Interactive replay</p>
          <h1 className="text-[28px] leading-tight font-semibold">Inside a run</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Watch our agent work through a real negotiation: which data it reads, which part of our code computes each number, what the arena
            checks, and what the supplier bot answers, in the order it happened. Press play, change the run, or click any box to see what it reads,
            what it returns and how that is checked.
          </p>
          <p className="text-[13px]">
            <strong>
              {run.case_id.replace("case:", "")} · {live.title}
            </strong>{" "}
            <span className="text-[var(--ink-2)]">· {live.suppliers.join(", ")}</span>
          </p>
        </header>
        <LivePipeline live={live} runs={storyRuns()} scenarios={scenarios} links={links} />
      </div>
    </main>
  );
}
