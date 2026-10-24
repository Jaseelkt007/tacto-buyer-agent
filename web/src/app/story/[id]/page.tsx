import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackIcon } from "@/components/icons";
import { StoryPlayer } from "@/components/story/StoryPlayer";
import { runsData } from "@/lib/runs";
import { buildStory, storyRuns, storyTitle } from "@/lib/story";

export function generateStaticParams() {
  return runsData.runs.map((r) => ({ id: r.session_id }));
}

export async function generateMetadata({ params }: PageProps<"/story/[id]">): Promise<Metadata> {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  return { title: run ? `Story ${storyTitle(run)} · ProcuDeal` : "Story · ProcuDeal" };
}

export default async function Page({ params }: PageProps<"/story/[id]">) {
  const { id } = await params;
  const run = runsData.runs.find((r) => r.session_id === id);
  if (!run) notFound();
  return (
    <main className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
          <BackIcon width={14} height={14} /> Home
        </Link>
        <h1 className="text-[22px] font-semibold">{storyTitle(run)}</h1>
        <StoryPlayer steps={buildStory(run)} runs={storyRuns()} current={run.session_id} />
      </div>
    </main>
  );
}
