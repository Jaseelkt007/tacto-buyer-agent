"use client";

import { useState } from "react";
import { code } from "@/lib/demo";
import { Ticks } from "./DecideFlow";
import { CodeRef, Seg, Tag } from "./ui";

const TONE = { high: "bad", medium: "warn", low: "neutral" } as const;

// Found while syncing runs/ for this page (scripts/sync-demo.mjs); about the run files, not the engine.
const DATA_NOTES = [
  "`session.rounds` counts our messages across all threads, not arena rounds: P05 shows 8 while its trace reaches round 3, and D02 shows 11, above the 10-per-thread limit.",
  "When the engine stops writing to a dropped RFQ bidder, the arena records our silence as timeouts (10 across the runs). They carry no decision of ours.",
  "Our trace calls the rival claim `rival_offer`, the arena checks it as `rival_quote`. All 7 claims the arena found irrelevant are rival quotes.",
  "A walk-away move carries no `supplier_id`, and an infinite limit is written as `Infinity` in runs/P10, which JSON.parse rejects.",
  "All 6 no-deal runs are engine v1.2: we countered below the supplier's final offer and it withdrew. The current engine treats a final offer as ready and accepts it if it passes, instead of countering it.",
];

export function Issues() {
  const [sev, setSev] = useState<"all" | "high" | "medium" | "low">("all");
  const list = code.issues.filter((i) => sev === "all" || i.severity === sev);
  const n = (k: string) => code.issues.filter((i) => i.severity === k).length;
  return (
    <div className="space-y-5">
      <Seg
        label="Severity"
        value={sev}
        onChange={setSev}
        options={[
          { value: "all", label: `All ${code.issues.length}` },
          { value: "high", label: `High ${n("high")}` },
          { value: "medium", label: `Medium ${n("medium")}` },
          { value: "low", label: `Low ${n("low")}` },
        ]}
      />
      <ol className="grid gap-3 lg:grid-cols-2">
        {list.map((i) => (
          <li
            key={i.title}
            className={`rounded-xl border bg-[var(--d-panel)] p-5 shadow-[var(--d-shadow)] ${i.severity === "high" ? "border-[#e8b4bd] lg:col-span-2" : "border-[var(--d-line)]"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={TONE[i.severity]}>{i.severity}</Tag>
              <CodeRef file={i.file} line={i.line} />
            </div>
            <h3 className={`mt-2.5 font-semibold tracking-[-0.01em] ${i.severity === "high" ? "text-[18px]" : "text-[15px]"}`}>{i.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--d-ink-2)]">
              <Ticks text={i.detail} />
            </p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-[var(--d-line)] bg-[var(--d-panel-2)] p-5">
        <h3 className="text-[13.5px] font-semibold">What the run files themselves show</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--d-ink-2)]">
          {DATA_NOTES.map((t) => (
            <li key={t}>
              <Ticks text={t} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
