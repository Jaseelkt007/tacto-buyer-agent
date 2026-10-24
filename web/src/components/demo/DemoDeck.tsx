"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { s } from "./styles";

export type Chapter = { id: string; title: string; short: string; lede: string; render: () => ReactNode };

/** Full-screen deck: chapters follow one case from opening to close; ← → move between them. */
export function DemoDeck({ chapters, footer }: { chapters: Chapter[]; footer?: ReactNode }) {
  const [at, setAt] = useState(0);
  const main = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => {
      const i = chapters.findIndex((c) => `#${c.id}` === window.location.hash);
      if (i >= 0) setAt(i);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [chapters]);

  const go = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(chapters.length - 1, i));
      setAt(n);
      history.replaceState(null, "", `#${chapters[n].id}`);
      main.current?.scrollTo({ top: 0 });
    },
    [chapters],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t.closest("[data-keys]")) return; // a widget that owns the arrow keys (e.g. the replay player)
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(at + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(at - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go]);

  const c = chapters[at];
  return (
    <div className={`${s.root} fixed inset-0 z-50 flex flex-col font-[family-name:var(--font-demo)] text-[14px]`}>
      <header className="flex shrink-0 items-center gap-4 border-b border-[var(--d-line)] bg-[var(--d-panel)] px-4 py-2 sm:px-6">
        <Link href="/" className="text-[12px] text-[var(--d-ink-2)] hover:text-[var(--d-ink)] hover:underline">
          Back to the app
        </Link>
        <div className={`${s.plate} ${s.wide} hidden text-[15px] sm:block`}>ProcuDeal, inside one negotiation</div>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[var(--d-muted)]">
          <span className="hidden tabular-nums sm:inline">
            {at + 1} of {chapters.length}
          </span>
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            className="rounded border border-[var(--d-line)] px-2.5 py-1 text-[var(--d-ink)] enabled:hover:bg-[var(--d-panel-2)] disabled:opacity-40"
            aria-label="Previous chapter"
          >
            ‹ Back
          </button>
          <button
            type="button"
            onClick={() => go(at + 1)}
            disabled={at === chapters.length - 1}
            className="rounded border border-[var(--d-ink)] bg-[var(--d-ink)] px-2.5 py-1 text-[var(--d-panel)] enabled:hover:opacity-90 disabled:opacity-40"
            aria-label="Next chapter"
          >
            Next ›
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Chapters" className={`${s.scrollPane} hidden w-[232px] shrink-0 overflow-y-auto border-r border-[var(--d-line)] py-4 lg:block`}>
          <ol className="space-y-0.5 px-3">
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === at ? "step" : undefined}
                  className={`group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left ${i === at ? "bg-[var(--d-panel)] shadow-[0_0_0_1px_var(--d-line)]" : "hover:bg-[var(--d-panel-2)]"}`}
                >
                  <span
                    className={`${s.plate} mt-px w-5 shrink-0 text-right text-[17px] tabular-nums ${i === at ? "text-[var(--d-buyer)]" : i < at ? "text-[var(--d-ink-2)]" : "text-[var(--d-muted)]"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] leading-snug ${i === at ? "font-semibold" : "text-[var(--d-ink-2)]"}`}>{ch.short}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {footer && <div className="mt-6 border-t border-[var(--d-line-soft)] px-5 pt-4 text-[11.5px] leading-relaxed text-[var(--d-muted)]">{footer}</div>}
        </nav>

        <main ref={main} className={`${s.scrollPane} min-w-0 flex-1 overflow-y-auto`}>
          <div key={c.id} className={`${s.enter} mx-auto max-w-[1360px] px-4 py-6 sm:px-8 sm:py-8`}>
            <div className="mb-6 max-w-[74ch]">
              <div className="mb-2 text-[12px] text-[var(--d-muted)] lg:hidden">
                Chapter {at + 1} of {chapters.length}
              </div>
              <h1 className={`${s.plate} text-[clamp(30px,4.2vw,52px)]`}>{c.title}</h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--d-ink-2)]">{c.lede}</p>
            </div>
            {c.render()}
          </div>
        </main>
      </div>
    </div>
  );
}
