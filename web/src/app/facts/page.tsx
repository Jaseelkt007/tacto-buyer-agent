import type { Metadata } from "next";
import { FactSearch } from "@/components/facts/FactSearch";

export const metadata: Metadata = { title: "Facts · ProcuDeal" };

export default function Page() {
  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-[22px] font-semibold">Facts</h1>
          <p className="max-w-3xl text-[14px] text-[var(--ink-2)]">
            Every ID our agent (or a supplier) can cite, with the exact values the arena checks a claim against (<code>data/facts.json</code>). Search
            by ID or by any value. An ID with a page in this app links to it; the arena only checks IDs that are in this list, so an unknown ID
            is contradicted.
          </p>
        </header>
        <FactSearch />
      </div>
    </main>
  );
}
