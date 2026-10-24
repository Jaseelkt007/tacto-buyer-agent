import Link from "next/link";
import { InboxIcon } from "@/components/icons";

// Placeholder home page; the real overview comes later.
export default function Home() {
  return (
    <main className="h-full overflow-y-auto bg-[var(--page)] px-4 py-10 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">ProcuDeal</p>
        <h1 className="mt-1 text-[28px] font-semibold">Buyer agent for Hollerau Pumpenwerke</h1>
        <p className="mt-2 text-[15px] text-[var(--ink-2)]">This page is a placeholder. More sections are on the way.</p>

        <Link
          href="/mail"
          className="mt-8 flex items-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 hover:border-[var(--accent-line)] hover:bg-[var(--accent-wash)]"
        >
          <span className="grid h-11 w-11 place-items-center rounded-md bg-[var(--accent-wash)] text-[var(--accent-ink)]">
            <InboxIcon width={22} height={22} />
          </span>
          <span>
            <span className="block text-[16px] font-semibold">Mail</span>
            <span className="block text-[13px] text-[var(--ink-2)]">
              What the agent sees when a case opens: case files, supplier letters and opening quotes.
            </span>
          </span>
        </Link>
      </div>
    </main>
  );
}
