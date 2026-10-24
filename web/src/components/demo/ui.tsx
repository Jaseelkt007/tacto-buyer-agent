"use client";

import { useState, type ReactNode } from "react";
import { s } from "./styles";

export const eur = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : v.toLocaleString("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: d, maximumFractionDigits: d });
export const eurK = (v: number | null | undefined) => {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `€${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `€${(v / 1e3).toFixed(1)}k`;
  return `€${v.toFixed(0)}`;
};
export const num = (v: number | null | undefined, d = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
export const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(d)} %`);

/** What runs a step: our code, a fixed template, a language model, or Tacto's arena. */
export type Kind = "code" | "template" | "llm" | "arena" | string;

const KIND: Record<string, { label: string; cls: string }> = {
  code: { label: "Code", cls: "bg-[var(--d-code-wash)] text-[var(--d-ink)] [--k:var(--d-code)]" },
  template: { label: "Template", cls: "bg-[var(--d-buyer-wash)] text-[var(--d-ink)] [--k:var(--d-buyer)]" },
  llm: { label: "LLM call", cls: "bg-[var(--d-llm-wash)] text-[var(--d-ink)] [--k:var(--d-llm)]" },
  arena: { label: "Arena", cls: "bg-[var(--d-arena-wash)] text-[var(--d-ink)] [--k:var(--d-arena)]" },
  runner: { label: "Runner", cls: "bg-[var(--d-sunk)] text-[var(--d-ink)] [--k:var(--d-muted)]" },
};

export function KindBadge({ kind, className = "" }: { kind: Kind; className?: string }) {
  const k = KIND[kind] ?? { label: kind, cls: "bg-[var(--d-sunk)] text-[var(--d-ink-2)] [--k:var(--d-muted)]" };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${k.cls} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--k)]" aria-hidden />
      {k.label}
    </span>
  );
}

export function kindColor(kind: Kind) {
  return (
    { code: "var(--d-code)", template: "var(--d-buyer)", llm: "var(--d-llm)", arena: "var(--d-arena)", runner: "var(--d-muted)" }[kind] ??
    "var(--d-muted)"
  );
}

/** A source location in our repo, e.g. starter-kit/…/policy.py:155. Click copies it. */
export function CodeRef({ file, line }: { file?: string; line?: number }) {
  const [copied, setCopied] = useState(false);
  if (!file) return null;
  const short = file.replace(/^starter-kit\/arena_kit\//, "").replace(/^agents\/procudeal\//, "procudeal/");
  const text = `${file}${line ? `:${line}` : ""}`;
  return (
    <button
      type="button"
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          },
          () => {},
        );
      }}
      className={`${s.code} inline-flex max-w-full items-center truncate rounded border border-[var(--d-line)] bg-[var(--d-panel)] px-1.5 py-px !text-[11px] text-[var(--d-ink-2)] hover:border-[var(--d-buyer)] hover:text-[var(--d-ink)]`}
    >
      {copied ? "copied" : `${short}${line ? `:${line}` : ""}`}
    </button>
  );
}

export function Panel({ children, className = "", title, aside }: { children: ReactNode; className?: string; title?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-lg border border-[var(--d-line)] bg-[var(--d-panel)] ${className}`}>
      {(title || aside) && (
        <header className="flex items-baseline justify-between gap-3 border-b border-[var(--d-line-soft)] px-4 py-2.5">
          {title && <h3 className="text-[13.5px] font-semibold">{title}</h3>}
          {aside && <div className="text-[12px] text-[var(--d-muted)]">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Figure({ value, label, sub, tone }: { value: ReactNode; label: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className={`${s.plate} text-[34px] tabular-nums`} style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-[12.5px] font-medium text-[var(--d-ink)]">{label}</div>
      {sub && <div className="text-[11.5px] text-[var(--d-muted)]">{sub}</div>}
    </div>
  );
}

export function Pre({ children, className = "", max = "max-h-[420px]" }: { children: ReactNode; className?: string; max?: string }) {
  return (
    <pre
      className={`${s.code} ${s.scrollPane} ${max} overflow-auto whitespace-pre-wrap break-words rounded-md border border-[var(--d-line)] bg-[var(--d-sunk)] p-3 text-[var(--d-ink)] ${className}`}
    >
      {children}
    </pre>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-[var(--d-line)] bg-[var(--d-panel)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-[12px] ${
            o.value === value ? "bg-[var(--d-ink)] font-medium text-[var(--d-panel)]" : "text-[var(--d-ink-2)] hover:bg-[var(--d-panel-2)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" | "warn" | "buyer" | "supplier" | "llm" | "arena" }) {
  const cls = {
    neutral: "bg-[var(--d-sunk)] text-[var(--d-ink-2)]",
    good: "bg-[var(--d-good-wash)] text-[var(--d-good)]",
    bad: "bg-[var(--d-bad-wash)] text-[var(--d-bad)]",
    warn: "bg-[var(--d-warn-wash)] text-[var(--d-warn)]",
    buyer: "bg-[var(--d-buyer-wash)] text-[var(--d-ink)]",
    supplier: "bg-[var(--d-supplier-wash)] text-[var(--d-ink)]",
    llm: "bg-[var(--d-llm-wash)] text-[var(--d-ink)]",
    arena: "bg-[var(--d-arena-wash)] text-[var(--d-ink)]",
  }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-px text-[11px] font-medium ${cls}`}>{children}</span>;
}
