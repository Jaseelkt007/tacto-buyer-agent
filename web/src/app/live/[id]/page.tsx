import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RunMonitor } from "@/components/live/RunMonitor";
import { buildReplay, scenarios, v19 } from "@/lib/v19";
import { runsData } from "@/lib/runs";

export function generateStaticParams() {
  return [
    ...new Set([
      ...v19.sessions.map((s) => s.id),
      ...runsData.runs.map((r) => r.session_id),
    ]),
  ].map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/live/[id]">): Promise<Metadata> {
  const { id } = await params;
  const session = v19.sessions.find((s) => s.id === id);
  return {
    title: session
      ? `${session.case_id} · v1.9 negotiation demo · ProcuDeal`
      : "Negotiation replay · ProcuDeal",
  };
}

export default async function Page({ params }: PageProps<"/live/[id]">) {
  const { id } = await params;
  const session = v19.sessions.find((s) => s.id === id);
  if (!session) {
    if (runsData.runs.some((r) => r.session_id === id))
      redirect(`/negotiations/${id}`);
    notFound();
  }
  return (
    <RunMonitor
      key={session.id}
      replay={buildReplay(session)}
      options={scenarios}
      benchmark={v19.benchmark}
    />
  );
}
