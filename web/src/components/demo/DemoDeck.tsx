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
  const prev = chapters[at - 1];
  const next = chapters[at + 1];
  return (
    <div className={`${s.root} fixed inset-0 z-50 flex flex-col font-[family-name:var(--font-demo)] text-[14px] leading-normal`}>
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--d-line)] bg-[var(--d-panel)] px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--d-ink)] text-[11px] font-semibold tracking-wide text-white" aria-hidden>
            PD
          </span>
          <span className="text-[14px] font-semibold">ProcuDeal</span>
          <span className="hidden text-[var(--d-line)] sm:inline" aria-hidden>
            /
          </span>
          <span className="hidden text-[14px] text-[var(--d-ink-2)] sm:inline">Pipeline demo</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="mr-2 hidden text-[12.5px] tabular-nums text-[var(--d-muted)] md:inline">
            Chapter {at + 1} of {chapters.length}
          </span>
          <button
            type="button"
            onClick={() => go(at - 1)}
            disabled={at === 0}
            className="h-8 rounded-md border border-[var(--d-line)] bg-white px-3 text-[13px] font-medium text-[var(--d-ink)] shadow-[var(--d-shadow)] enabled:hover:bg-[var(--d-panel-2)] disabled:opacity-40"
            aria-label="Previous chapter"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => go(at + 1)}
            disabled={at === chapters.length - 1}
            className="h-8 rounded-md bg-[var(--d-ink)] px-3 text-[13px] font-medium text-white shadow-[var(--d-shadow)] enabled:hover:bg-[#2a2d35] disabled:opacity-40"
            aria-label="Next chapter"
          >
            Next
          </button>
          <Link href="/" className="ml-2 hidden h-8 items-center rounded-md px-2 text-[13px] text-[var(--d-ink-2)] hover:bg-[var(--d-sunk)] hover:text-[var(--d-ink)] sm:inline-flex">
            Exit
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Chapters" className={`${s.scrollPane} hidden w-[256px] shrink-0 flex-col overflow-y-auto border-r border-[var(--d-line)] bg-[var(--d-panel)] lg:flex`}>
          <div className="px-5 pb-2 pt-5 text-[12px] font-medium text-[var(--d-muted)]">Contents</div>
          <ol className="space-y-px px-3">
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === at ? "step" : undefined}
                  className={`relative flex w-full items-baseline gap-3 rounded-md py-2 pl-3 pr-2 text-left text-[13.5px] ${
                    i === at ? "bg-[var(--d-sunk)] font-medium text-[var(--d-ink)]" : "text-[var(--d-ink-2)] hover:bg-[var(--d-panel-2)] hover:text-[var(--d-ink)]"
                  }`}
                >
                  {i === at && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--d-buyer)]" aria-hidden />}
                  <span className={`w-4 shrink-0 text-right text-[12px] tabular-nums ${i === at ? "text-[var(--d-buyer)]" : "text-[var(--d-muted)]"}`}>{i + 1}</span>
                  <span className="min-w-0 leading-snug">{ch.short}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-auto px-5 pb-5 pt-8">
            <div className="h-1 overflow-hidden rounded-full bg-[var(--d-sunk)]">
              <div className="h-full rounded-full bg-[var(--d-buyer)] transition-[width] duration-300" style={{ width: `${((at + 1) / chapters.length) * 100}%` }} />
            </div>
            {footer && <div className="mt-3 text-[11.5px] leading-relaxed text-[var(--d-muted)]">{footer}</div>}
          </div>
        </nav>

        <main ref={main} className={`${s.scrollPane} min-w-0 flex-1 overflow-y-auto`}>
          <div key={c.id} className={`${s.enter} mx-auto max-w-[1320px] px-4 py-8 sm:px-10 sm:py-10`}>
            <div className="mb-8 max-w-[72ch]">
              <h1 className="text-[clamp(24px,2.4vw,32px)] font-semibold leading-tight tracking-[-0.02em]">{c.title}</h1>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--d-ink-2)]">{c.lede}</p>
            </div>
            {c.render()}
            <div className="mt-12 grid gap-3 border-t border-[var(--d-line)] pt-6 sm:grid-cols-2">
              {prev ? (
                <button type="button" onClick={() => go(at - 1)} className="rounded-lg border border-[var(--d-line)] bg-[var(--d-panel)] px-4 py-3 text-left shadow-[var(--d-shadow)] hover:border-[#cfd4da]">
                  <div className="text-[12px] text-[var(--d-muted)]">Previous</div>
                  <div className="text-[14px] font-medium">{prev.short}</div>
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" onClick={() => go(at + 1)} className="rounded-lg border border-[var(--d-line)] bg-[var(--d-panel)] px-4 py-3 text-right shadow-[var(--d-shadow)] hover:border-[#cfd4da]">
                  <div className="text-[12px] text-[var(--d-muted)]">Next</div>
                  <div className="text-[14px] font-medium">{next.short}</div>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
