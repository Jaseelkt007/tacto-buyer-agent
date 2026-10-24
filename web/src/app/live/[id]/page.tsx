import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveTabs } from "@/components/live/LiveTabs";
import { buildLive, type NodeId } from "@/lib/live";
import { contractData } from "@/lib/contracts";
import { caseFile, runsData } from "@/lib/runs";
import { storyRuns } from "@/lib/story";
import { buildZone0 } from "@/lib/zone0";

export function generateStaticParams() {
  return runsData.runs.map((r) => ({ id: r.session_id }));
}

export async function generateMetadata({ params }: PageProps<"/live/[id]">): Promise<Metadata> {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  return { title: run ? `Inside a run · ${run.case_id.replace("case:", "")} · ProcuDeal` : "Inside a run · ProcuDeal" };
}

const caseSuppliers = (caseId: string) => caseFile(caseId)?.suppliers.map((s) => s.id) ?? [];

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
  const sups = caseSuppliers(run.case_id);
  const zone0 = buildZone0(sups);
  const firstSup = sups[0] ?? "";
  const ctr = firstSup ? contractData.contracts.find((c) => c.supplier_id === firstSup)?.id.replace("ctr:", "") : undefined;
  const supNo = firstSup.replace("sup:", "");
  const researchLinks: Partial<Record<string, string>> = {
    r_tables: `/suppliers/${supNo}`,
    r_letters: `/suppliers/${supNo}#timeline`,
    r_contracts: ctr ? `/contracts/${ctr}` : "/contracts",
    r_perf: ctr ? `/contracts/${ctr}#delivery` : "/contracts",
    r_facts: "/facts",
    library: "/arguments",
    economics: run.case_id ? `/parts/${(caseFile(run.case_id)?.parts[0]?.id ?? "").replace("part:", "")}` : "/parts",
    persona: `/suppliers/${supNo}`,
    contract: ctr ? `/contracts/${ctr}` : "/contracts",
    performance: ctr ? `/contracts/${ctr}#delivery` : "/contracts",
    engine: `/live/${run.session_id}#negotiation`,
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
            Watch our agent work, in the order it happens: first the offline research a language model does on each supplier before any session
            opens (zone 0), then the negotiation itself, where code computes every number, the arena checks every argument and the supplier bot
            answers. Press play, change the run, or click any box to see what it reads, what it returns and how that is checked.
          </p>
          <p className="text-[13px]">
            <strong>
              {run.case_id.replace("case:", "")} · {live.title}
            </strong>{" "}
            <span className="text-[var(--ink-2)]">· {live.suppliers.join(", ")}</span>
          </p>
        </header>
        <LiveTabs live={live} zone0={zone0} runs={storyRuns()} scenarios={scenarios} links={links} researchLinks={researchLinks} />
      </div>
    </main>
  );
}
