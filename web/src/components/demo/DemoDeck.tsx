"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { s } from "./styles";

export type Chapter = { id: string; tab: string; title: string; short: string; lede: string; render: () => ReactNode };

/** Full-screen deck in the arena site's layout: a top bar with the chapters as tabs, one centred column. */
export function DemoDeck({ chapters, meta }: { chapters: Chapter[]; meta?: ReactNode }) {
  const [at, setAt] = useState(0);
  const main = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => {
      const i = chapters.findIndex((c) => `#${c.id}` === window.location.hash);
      if (i >= 0) setAt(i);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [chapters]);

  useEffect(() => {
    tabs.current?.querySelector<HTMLElement>(`[data-tab="${at}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [at]);

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
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={`${s.root} fixed inset-0 z-50 flex flex-col font-[family-name:var(--font-demo)] text-[14px] leading-normal`}>
      <header className="shrink-0 border-b border-[var(--d-line)] bg-white">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3" title="Back to the app">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--d-accent)" />
                <path d="M5 11V5h3.2a2 2 0 0 1 0 4H5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span className="text-[17px] font-medium tracking-[-0.01em]">procudeal</span>
            </span>
            <span className="h-6 w-px bg-[var(--d-line)]" aria-hidden />
            <span className="text-[15px] font-medium">Pipeline demo</span>
          </Link>
          <nav ref={tabs} aria-label="Chapters" className={`${s.scrollPane} ml-auto flex min-w-0 items-stretch gap-5 self-stretch overflow-x-auto`}>
            {chapters.map((ch, i) => (
              <button
                key={ch.id}
                type="button"
                data-tab={i}
                onClick={() => go(i)}
                aria-current={i === at ? "page" : undefined}
                className={`relative shrink-0 whitespace-nowrap font-[family-name:var(--font-demo-mono)] text-[12px] uppercase tracking-[0.1em] ${
                  i === at ? "text-[var(--d-ink)]" : "text-[#6b6b6b] hover:text-[var(--d-ink)]"
                }`}
              >
                {ch.tab}
                {i === at && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--d-accent)]" aria-hidden />}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main ref={main} className={`${s.scrollPane} min-w-0 flex-1 overflow-y-auto`}>
        <div key={c.id} className={`${s.enter} mx-auto max-w-[1280px] px-5 pb-16 pt-8 sm:px-8`}>
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--d-line)] bg-white px-3 py-1 text-[12.5px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--d-accent)]" aria-hidden />
              Chapter {at + 1} of {chapters.length}
            </span>
            {meta}
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(at - 1)}
                disabled={at === 0}
                className="rounded border border-[var(--d-line)] bg-white px-2.5 py-1 font-[family-name:var(--font-demo-mono)] text-[12px] uppercase tracking-[0.08em] enabled:hover:border-[#cfcfcf] disabled:opacity-40"
                aria-label="Previous chapter"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => go(at + 1)}
                disabled={at === chapters.length - 1}
                className="rounded border border-[var(--d-line)] bg-white px-2.5 py-1 font-[family-name:var(--font-demo-mono)] text-[12px] uppercase tracking-[0.08em] enabled:hover:border-[#cfcfcf] disabled:opacity-40"
                aria-label="Next chapter"
              >
                Next →
              </button>
            </span>
          </div>
          <div className={s.label}>
            {pad(at + 1)} / {c.short}
          </div>
          <h1 className="mt-2 max-w-[28ch] text-[clamp(30px,3.4vw,42px)] font-normal leading-[1.1] tracking-[-0.025em] sm:max-w-none">{c.title}</h1>
          <p className="mt-3 max-w-[78ch] text-[16px] leading-relaxed text-[var(--d-ink-2)]">{c.lede}</p>
          <div className="mt-8">{c.render()}</div>
          <div className="mt-14 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <button type="button" onClick={() => go(at - 1)} className="rounded-lg border border-[var(--d-line)] bg-white px-5 py-4 text-left hover:border-[#cfcfcf]">
                <div className={s.label}>← Previous</div>
                <div className="mt-1 text-[16px]">{prev.short}</div>
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button type="button" onClick={() => go(at + 1)} className="rounded-lg border border-[var(--d-line)] bg-white px-5 py-4 text-right hover:border-[#cfcfcf]">
                <div className={s.label}>Next →</div>
                <div className="mt-1 text-[16px]">{next.short}</div>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
